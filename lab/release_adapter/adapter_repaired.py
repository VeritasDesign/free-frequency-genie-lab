#!/usr/bin/env python3
"""Cybertron project-scoped static Vercel release adapter v0.1.

Safe by default: 'plan' reads an archive; 'publish' requires a distinct, exact
operator approval and a release-enabled profile. Tests use an injected fake
transport. No Git writes, no worker dispatch, no fallback project creation.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from typing import Protocol
from urllib import error, parse, request
from zipfile import ZipFile

PROJECT_ID = re.compile(r"prj_[A-Za-z0-9]+\Z")
TEAM_ID = re.compile(r"team_[A-Za-z0-9]+\Z")
NAME = re.compile(r"[a-z0-9][a-z0-9-]{0,99}\Z")
DOMAIN = re.compile(r"(?=.{4,253}\Z)[A-Za-z0-9]+(?:[.-][A-Za-z0-9-]+)+\Z")
SHA256 = re.compile(r"[0-9a-f]{64}\Z")
# Only known top-level configs and serverless api/ source are not public HTTP assets.
NONPUBLIC_CONFIG_DESTINATIONS = frozenset({"package.json", "vercel.json"})
REVISION = re.compile(r"[0-9a-f]{40}\Z")
DEPLOYMENT_URL = re.compile(r"https://[a-zA-Z0-9-]+\.vercel\.app(?=\s|$)")


class ReleaseBlocked(ValueError):
    """Preflight/readback failed; operator must resolve without auto-retry."""


def safe_path(value: str) -> str:
    if not isinstance(value, str) or '\\' in value or not value or value.startswith('/'):
        raise ReleaseBlocked('unsafe_relative_path')
    p = PurePosixPath(value)
    if any(seg in ('.', '..', '') for seg in value.split('/')) or p.as_posix() != value:
        raise ReleaseBlocked('unsafe_relative_path')
    return value


def requires_public_readback(destination: str) -> bool:
    """Exempt only top-level configs and source beneath api/ from HTTP byte readback."""
    return destination not in NONPUBLIC_CONFIG_DESTINATIONS and not destination.startswith('api/')


def parse_profile(raw: dict) -> dict:
    keys = {'project_id', 'project_name', 'team_id', 'team_slug', 'required_root',
            'production_alias', 'artifact_paths', 'readback_paths', 'release_enabled'}
    if type(raw) is not dict or set(raw) != keys:
        raise ReleaseBlocked('project_profile_schema_invalid')
    p = dict(raw)
    if not PROJECT_ID.fullmatch(p['project_id']) or not TEAM_ID.fullmatch(p['team_id']):
        raise ReleaseBlocked('project_or_team_id_invalid')
    if not NAME.fullmatch(p['project_name']) or not NAME.fullmatch(p['team_slug']):
        raise ReleaseBlocked('project_or_team_name_invalid')
    safe_path(p['required_root'])
    if not DOMAIN.fullmatch(p['production_alias']):
        raise ReleaseBlocked('alias_invalid')
    if type(p['release_enabled']) is not bool:
        raise ReleaseBlocked('release_enabled_invalid')
    if type(p['artifact_paths']) is not dict or not p['artifact_paths']:
        raise ReleaseBlocked('artifact_paths_invalid')
    for src, dest in p['artifact_paths'].items():
        safe_path(src)
        safe_path(dest)
    if len(set(p['artifact_paths'].values())) != len(p['artifact_paths']):
        raise ReleaseBlocked('destination_collision')
    # Every artifact still gets canonical and staged byte verification.
    # Only recognized, top-level Vercel/package configuration files may
    # be exempted from PUBLIC HTTP readback; never exempt arbitrary assets.
    destinations = set(p['artifact_paths'].values())
    required_public = {dest for dest in destinations if requires_public_readback(dest)}
    if (type(p['readback_paths']) is not dict or not required_public or
            set(p['readback_paths']) != required_public):
        raise ReleaseBlocked('readback_mapping_invalid')
    for route in p['readback_paths'].values():
        if type(route) is not str or not route.startswith('/'):
            raise ReleaseBlocked('readback_route_invalid')
        if route != '/':
            safe_path(route[1:])
    if len(set(p['readback_paths'].values())) != len(p['readback_paths']):
        raise ReleaseBlocked('readback_route_collision')
    return p


def load_bundle(archive: Path, p: dict) -> dict:
    # Original files are opened as raw bytes; no hosting fetch or reconstruction.
    with ZipFile(archive) as z:
        infos = z.infolist()
        paths = [i.filename for i in infos]
        if len(paths) != len(set(paths)):
            raise ReleaseBlocked('duplicate_archive_entry')
        for i in infos:
            safe_path(i.filename)
            if i.is_dir() or stat.S_IFMT(i.external_attr >> 16) == stat.S_IFLNK:
                raise ReleaseBlocked('archive_directory_or_symlink')
        if 'SOURCE_MANIFEST.json' not in paths or 'SHA256SUMS' not in paths:
            raise ReleaseBlocked('missing_canonical_manifest')
        manifest = json.loads(z.read('SOURCE_MANIFEST.json'))
        rev = manifest.get('source_revision')
        entries = manifest.get('files')
        if not isinstance(rev, str) or not REVISION.fullmatch(rev) or not isinstance(entries, list):
            raise ReleaseBlocked('source_manifest_invalid')
        wanted = p['artifact_paths']
        if set(paths) != set(wanted) | {'SOURCE_MANIFEST.json', 'SHA256SUMS'}:
            raise ReleaseBlocked('archive_contents_mismatch')
        if len(entries) != len(wanted) or {e.get('path') for e in entries} != set(wanted):
            raise ReleaseBlocked('manifest_artifact_set_mismatch')
        checks = z.read('SHA256SUMS').decode('utf8').splitlines()
        sums = {}
        for line in checks:
            if not re.fullmatch(r'[0-9a-f]{64}  [^\s]+', line):
                raise ReleaseBlocked('checksum_file_invalid')
            digest, src = line.split('  ', 1)
            if src in sums:
                raise ReleaseBlocked('duplicate_checksum_entry')
            sums[src] = digest
        if set(sums) != set(wanted):
            raise ReleaseBlocked('checksum_set_mismatch')
        blobs = {}
        for e in entries:
            src = e['path']
            blob = z.read(src)
            digest = hashlib.sha256(blob).hexdigest()
            if (digest != e.get('sha256') or digest != sums[src] or
                    len(blob) != e.get('bytes')):
                raise ReleaseBlocked('canonical_artifact_checksum_mismatch')
            blobs[wanted[src]] = blob
    return {'revision': rev, 'blobs': blobs,
            'sha256': {dest: hashlib.sha256(b).hexdigest() for dest, b in blobs.items()}}


def verify_project_identity(provider, profile: dict) -> dict:
    """One exact ID/name/scope/root gate, shared with all release preflights."""
    project = provider.get_project(profile)
    if (project.get('id') != profile['project_id'] or
            project.get('name') != profile['project_name'] or
            project.get('accountId') != profile['team_id']):
        raise ReleaseBlocked('remote_project_identity_mismatch')
    if project.get('rootDirectory') != profile['required_root']:
        raise ReleaseBlocked('remote_root_directory_mismatch')
    return project


def protected_readonly_metadata_provider():
    """Instantiate GET-only authority only inside the trusted secret boundary.

    This provider intentionally has no domain, deployment, CLI or mutating API.
    Ordinary application workers never receive VERCEL_READ_TOKEN.
    """
    import importlib.util
    module_path = Path(__file__).resolve().parent.parent / 'vercel_read_auth' / 'provider.py'
    if not module_path.is_file():
        raise ReleaseBlocked('protected_metadata_provider_unavailable')
    spec = importlib.util.spec_from_file_location('cybertron_vercel_read_only', module_path)
    if spec is None or spec.loader is None:
        raise ReleaseBlocked('protected_metadata_provider_unavailable')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    class ReadOnly:
        def get_project(self, profile):
            try:
                return module.read_project(profile['project_id'], profile['team_id'])
            except module.ReadbackBlocked as exc:
                # The error code is allowlisted by the protected provider.
                raise ReleaseBlocked(str(exc)) from None
    return ReadOnly()


def normalize_deployment(raw: dict) -> dict:
    """Normalize documented Vercel deployment representations, fail closed."""
    if type(raw) is not dict:
        raise ReleaseBlocked('deployment_response_invalid')
    project = raw.get('project')
    nested_id = project.get('id') if type(project) is dict else None
    flat_id = raw.get('projectId')
    if flat_id and nested_id and flat_id != nested_id:
        raise ReleaseBlocked('deployment_project_identity_conflict')
    state = raw.get('state')
    ready_state = raw.get('readyState')
    if state and ready_state and state != ready_state:
        raise ReleaseBlocked('deployment_state_conflict')
    result = dict(raw)
    result['projectId'] = flat_id or nested_id
    result['state'] = state or ready_state
    return result


def protected_verified_project_receipt(profile: dict) -> dict:
    """Consume metadata only from same-run protected read job; never a read token."""
    path = os.environ.get('CYBERTRON_VERIFIED_PROJECT_RECEIPT')
    run_id = os.environ.get('GITHUB_RUN_ID')
    if not path or not run_id or not run_id.isdigit():
        raise ReleaseBlocked('protected_metadata_receipt_unavailable')
    try:
        receipt = json.loads(Path(path).read_text())
    except (OSError, ValueError) as exc:
        raise ReleaseBlocked('protected_metadata_receipt_unavailable') from exc
    if (type(receipt) is not dict or
            receipt.get('source') != 'cybertron-protected-read-job-v0.1' or
            receipt.get('workflow_run') != run_id or
            receipt.get('status') != 'READY' or
            type(receipt.get('project')) is not dict):
        raise ReleaseBlocked('protected_metadata_receipt_invalid')
    return receipt['project']


def preflight_project(provider, profile: dict) -> dict:
    verify_project_identity(provider, profile)
    domains = provider.get_domains(profile)
    if profile['production_alias'] not in domains:
        raise ReleaseBlocked('production_alias_not_attached_to_project')
    before = normalize_deployment(provider.get_deployment(profile, profile['production_alias']))
    if (before.get('projectId') != profile['project_id'] or
            before.get('state') != 'READY' or not before.get('id')):
        raise ReleaseBlocked('cannot_capture_prior_production_deployment')
    return {'previous_deployment_id': before['id']}


READBACK_POLL_DELAYS = (1, 2, 4, 8, 12)
READBACK_SLEEP = time.sleep
READBACK_TRANSIENT_STATES = frozenset({'QUEUED', 'BUILDING', 'INITIALIZING'})
READBACK_TERMINAL_STATES = frozenset({'ERROR', 'CANCELED'})


def wait_for_ready_deployment(provider, profile: dict, deployment_url: str) -> dict:
    """Poll one exact attempted deployment; never trigger another deploy."""
    attempts = len(READBACK_POLL_DELAYS) + 1
    for attempt in range(attempts):
        try:
            deployment = normalize_deployment(
                provider.get_deployment(profile, deployment_url))
        except ReleaseBlocked as exc:
            if str(exc) != 'vercel_readback_unavailable':
                raise
        else:
            if deployment.get('projectId') != profile['project_id']:
                raise ReleaseBlocked('deployment_project_identity_mismatch')
            state = deployment.get('state')
            if state == 'READY':
                return deployment
            if state in READBACK_TERMINAL_STATES:
                raise ReleaseBlocked('deployment_terminal_state_' + state.lower())
            if state not in READBACK_TRANSIENT_STATES:
                raise ReleaseBlocked('deployment_state_unexpected')
        if attempt == attempts - 1:
            break
        READBACK_SLEEP(READBACK_POLL_DELAYS[attempt])
    raise ReleaseBlocked('deployment_readback_timeout')


def publish(profile: dict, bundle: dict, provider, approval: dict) -> dict:
    """Exactly one attempted deployment; no retry, promotion or rollback mutation."""
    if not profile['release_enabled']:
        raise ReleaseBlocked('profile_reference_only')
    expected_approval = {
        'project_id': profile['project_id'],
        'source_revision': bundle['revision'],
        'production_alias': profile['production_alias'],
        'intent': 'publish_exact_verified_artifacts',
    }
    if approval != expected_approval:
        raise ReleaseBlocked('explicit_project_release_approval_missing')
    rollback = preflight_project(provider, profile)
    with tempfile.TemporaryDirectory(prefix='cybertron-scoped-release-') as root:
        workspace = Path(root)
        app_root = workspace / profile['required_root']
        app_root.mkdir(parents=True, exist_ok=False)
        for dest, data in bundle['blobs'].items():
            f = app_root / dest
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(data)
            if hashlib.sha256(f.read_bytes()).hexdigest() != bundle['sha256'][dest]:
                raise ReleaseBlocked('staging_integrity_failed')
        provider.link(workspace, profile)
        link_path = workspace / '.vercel' / 'project.json'
        if not link_path.is_file() or link_path.is_symlink():
            raise ReleaseBlocked('explicit_link_metadata_missing')
        linked = json.loads(link_path.read_text())
        if linked.get('projectId') != profile['project_id'] or linked.get('orgId') != profile['team_id']:
            raise ReleaseBlocked('linked_project_identity_mismatch')
        # The workspace root, NOT dist or apps/<name>, is the Vercel CLI CWD.
        # One deployment attempt only. If provider response is lost, do not
        # assume either failure or success and NEVER retry automatically.
        try:
            deployment_url = provider.deploy(workspace, profile)
        except ReleaseBlocked as exc:
            raise ReleaseBlocked('deploy_outcome_unverified; previous_deployment_id=' +
                                 rollback['previous_deployment_id']) from exc
        try:
            if not DEPLOYMENT_URL.fullmatch(deployment_url):
                raise ReleaseBlocked('deployment_url_invalid')
            deployment = wait_for_ready_deployment(provider, profile, deployment_url)
            aliases = deployment.get('alias') or []
            if (deployment.get('projectId') != profile['project_id'] or
                    deployment.get('state') != 'READY' or
                    deployment.get('target') != 'production' or
                    profile['production_alias'] not in aliases or
                    not isinstance(deployment.get('id'), str) or not deployment['id'].startswith('dpl_')):
                raise ReleaseBlocked('deployment_identity_or_alias_not_verified')
            # Verify exact production alias bytes of every PUBLIC asset.
            # package.json, vercel.json, and api/ source have instead been verified from
            # the canonical archive and staged byte-for-byte before link.
            for dest, route in profile['readback_paths'].items():
                data = provider.read_alias(profile, route)
                if hashlib.sha256(data).hexdigest() != bundle['sha256'][dest]:
                    raise ReleaseBlocked('production_alias_artifact_mismatch')
        except ReleaseBlocked as exc:
            raise ReleaseBlocked(str(exc) + '; previous_deployment_id=' +
                                 rollback['previous_deployment_id'] +
                                 '; attempted_deployment_url=' + deployment_url) from exc
        return {
            'result': 'READY_AND_ALIAS_BYTES_MATCH',
            'project_id': profile['project_id'], 'project_name': profile['project_name'],
            'root_directory': profile['required_root'],
            'production_alias': profile['production_alias'],
            'source_revision': bundle['revision'],
            'artifact_sha256': bundle['sha256'],
            'public_alias_readback_sha256': {
                dest: bundle['sha256'][dest] for dest in profile['readback_paths']},
            'nonpublic_config_staged_sha256': {
                dest: bundle['sha256'][dest] for dest in bundle['blobs']
                if dest in NONPUBLIC_CONFIG_DESTINATIONS},
            'deployment_id': deployment['id'], 'deployment_url': deployment_url,
            'rollback_reference': rollback['previous_deployment_id'],
            'git_writes': 0, 'other_project_deploy_requests': 0,
        }


class VercelCliProvider:
    """Future opt-in transport. Requires existing authorized CLI login/token.

    Read-only project/alias metadata through REST; the only remote mutation is
    one 'vercel deploy' explicitly scoped to the previously verified project.
    """
    def __init__(self):
        self.token = os.environ.get('VERCEL_TOKEN')
        if not self.token:
            raise ReleaseBlocked('VERCEL_TOKEN_release_auth_unavailable')

    def _get(self, path: str, profile: dict):
        url = f'https://api.vercel.com{path}'
        sep = '&' if '?' in url else '?'
        url += sep + parse.urlencode({'teamId': profile['team_id']})
        req = request.Request(url, headers={'Authorization': 'Bearer ' + self.token,
                                            'Accept': 'application/json'}, method='GET')
        try:
            with request.urlopen(req, timeout=20) as response:
                return json.load(response)
        except (error.URLError, ValueError) as exc:
            raise ReleaseBlocked('vercel_readback_unavailable') from exc

    def get_project(self, profile):
        # Trusted same-run read-job receipt; no read token enters release job.
        # Missing receipt blocks; never fall back to release token.
        return protected_verified_project_receipt(profile)

    def get_domains(self, profile):
        r = self._get('/v9/projects/' + profile['project_id'] + '/domains', profile)
        return [d['name'] for d in r.get('domains', []) if isinstance(d, dict) and isinstance(d.get('name'), str)]

    def get_deployment(self, profile, ref):
        return self._get('/v13/deployments/' + parse.quote(ref, safe=''), profile)

    def _cli(self, args, workspace: Path):
        # No shell. CLI receives release token explicitly; never log argv or output.
        cmd = ['vercel'] + args + ['--scope', profile_slug(self._current_profile), '--token', self.token]
        p = subprocess.run(cmd, cwd=workspace, text=True, capture_output=True,
                           timeout=180, check=False)
        if p.returncode:
            raise ReleaseBlocked('vercel_cli_link_or_deploy_failed')
        return p.stdout + '\n' + p.stderr

    def link(self, workspace, profile):
        self._current_profile = profile
        self._cli(['link', '--yes', '--project', profile['project_id']], workspace)

    def deploy(self, workspace, profile):
        self._current_profile = profile
        output = self._cli(['deploy', '--prod', '--yes', '--project', profile['project_id']], workspace)
        urls = DEPLOYMENT_URL.findall(output)
        deployment_urls = [u for u in urls if parse.urlsplit(u).hostname != profile['production_alias']]
        if not deployment_urls:
            raise ReleaseBlocked('deployment_url_unavailable')
        return deployment_urls[0]

    def read_alias(self, profile, route):
        if route != '/':
            if not route.startswith('/'):
                raise ReleaseBlocked('readback_route_invalid')
            safe_path(route[1:])
        u = 'https://' + profile['production_alias'] + route
        # urllib follows redirects; refuse cross-domain final location.
        req = request.Request(u, method='GET')
        with request.urlopen(req, timeout=20) as response:
            if response.geturl() != u:
                raise ReleaseBlocked('production_alias_redirect')
            return response.read(12_000_000)


def profile_slug(profile):
    return profile['team_slug']


def main(argv=None):
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument('--profile', required=True, type=Path)
    a.add_argument('--artifact', required=True, type=Path)
    a.add_argument('--execute', action='store_true', help='requires exact approval JSON and release-enabled profile')
    a.add_argument('--approval', type=Path)
    a.add_argument('--verify-destination-readonly', action='store_true',
                   help='opt-in original project+alias+rollback GET preflight; no link/deploy')
    a.add_argument('--verify-project-readonly', action='store_true',
                   help='isolated GET-only project/root preflight; requires protected environment')
    opts = a.parse_args(argv)
    try:
        if ((opts.verify_destination_readonly and opts.verify_project_readonly) or
                (opts.execute and (opts.verify_destination_readonly or opts.verify_project_readonly))):
            raise ReleaseBlocked('preflight_only_and_execute_mutually_exclusive')
        p = parse_profile(json.loads(opts.profile.read_text()))
        b = load_bundle(opts.artifact, p)
        if not opts.execute:
            plan = {'mode': 'PLAN_ONLY', 'project_id': p['project_id'],
                    'project_name': p['project_name'], 'required_root': p['required_root'],
                    'alias': p['production_alias'], 'source_revision': b['revision'],
                    'artifact_sha256': b['sha256'],
                    'public_alias_readback_sha256': {
                        dest: b['sha256'][dest] for dest in p['readback_paths']},
                    'nonpublic_config_staged_sha256': {
                        dest: b['sha256'][dest] for dest in b['blobs']
                        if dest in NONPUBLIC_CONFIG_DESTINATIONS},
                    'remote_root_verified': False,
                    'release_enabled': p['release_enabled'], 'mutation_count': 0}
            if opts.verify_project_readonly:
                # Authenticated read authority stays in the trusted Actions
                # environment. This mode checks ONLY project metadata; it
                # cannot assert alias or rollback verification.
                project = verify_project_identity(protected_readonly_metadata_provider(), p)
                plan['remote_root_verified'] = True
                plan['authenticated_project_metadata'] = {
                    field: project.get(field) for field in
                    ('id', 'name', 'accountId', 'rootDirectory')}
                plan['alias_and_rollback_verified'] = False
                plan['project_readback_authority'] = 'isolated_get_only_v0.1'
            if opts.verify_destination_readonly:
                # Original project+alias+rollback GET gate is unchanged.
                prior = preflight_project(VercelCliProvider(), p)
                plan['remote_root_verified'] = True
                plan['rollback_reference'] = prior['previous_deployment_id']
            print(json.dumps(plan, indent=2))
            return 0
        if opts.approval is None:
            raise ReleaseBlocked('explicit_approval_file_required')
        receipt = publish(p, b, VercelCliProvider(), json.loads(opts.approval.read_text()))
        print(json.dumps(receipt, sort_keys=True, indent=2))
        return 0
    except (ReleaseBlocked, ValueError, FileNotFoundError) as exc:
        print('RELEASE_BLOCKED: ' + str(exc), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
