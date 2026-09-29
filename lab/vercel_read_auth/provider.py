#!/usr/bin/env python3
"""Cybertron Vercel read authority v0.1: GET one project; no write API.

Credential remains in the GitHub Actions environment-secret boundary. A successful
result contains only four explicitly allowlisted Vercel project metadata fields.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import sys
from urllib import error, parse, request

PROJECT_ID = re.compile(r"prj_[A-Za-z0-9]+\Z")
TEAM_ID = re.compile(r"team_[A-Za-z0-9]+\Z")

class ReadbackBlocked(ValueError):
    pass

class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ReadbackBlocked('vercel_project_read_redirect_blocked')


def read_project(project_id: str, team_id: str) -> dict:
    if not PROJECT_ID.fullmatch(project_id) or not TEAM_ID.fullmatch(team_id):
        raise ReadbackBlocked('project_or_team_id_invalid')
    token = os.environ.get('VERCEL_READ_TOKEN')
    if not token:
        raise ReadbackBlocked('VERCEL_READ_TOKEN_unavailable')
    # The only outbound endpoint and method in this authority. Never accept a
    # caller-controlled URL, path, host, method, headers or response fields.
    url = ('https://api.vercel.com/v9/projects/' + project_id + '?' +
           parse.urlencode({'teamId': team_id}))
    req = request.Request(url, method='GET', headers={
        'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
    opener = request.build_opener(NoRedirect())
    try:
        with opener.open(req, timeout=20) as resp:
            if resp.status != 200 or resp.geturl() != url:
                raise ReadbackBlocked('vercel_project_read_unexpected_response')
            data = json.load(resp)
    except error.HTTPError as exc:
        # Never include response bodies, headers, full exceptions or credentials.
        raise ReadbackBlocked('vercel_project_http_' + str(exc.code)) from None
    except (error.URLError, TimeoutError, ValueError, OSError) as exc:
        if isinstance(exc, ReadbackBlocked):
            raise
        raise ReadbackBlocked('vercel_project_read_unavailable') from None
    if not isinstance(data, dict):
        raise ReadbackBlocked('vercel_project_payload_invalid')
    fields = ('id', 'name', 'accountId', 'rootDirectory')
    return {key: data.get(key) for key in fields}


def assert_project_matches(project: dict, project_id: str, team_id: str,
                           name: str, root: str) -> None:
    if (project.get('id') != project_id or project.get('name') != name or
            project.get('accountId') != team_id):
        raise ReadbackBlocked('vercel_project_identity_mismatch')
    if project.get('rootDirectory') != root:
        raise ReadbackBlocked('vercel_root_directory_mismatch')


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--project-id', required=True)
    p.add_argument('--team-id', required=True)
    p.add_argument('--expected-name', required=True)
    p.add_argument('--expected-root', required=True)
    p.add_argument('--receipt-file', required=True, type=Path)
    args = p.parse_args(argv)
    receipt = {'capability': 'vercel_project_metadata_read_only_v0.1',
               'status': 'BLOCKED', 'method': 'GET',
               'endpoint': '/v9/projects/{projectId}',
               'project_id': args.project_id, 'expected_root': args.expected_root}
    exit_code = 2
    try:
        project = read_project(args.project_id, args.team_id)
        assert_project_matches(project, args.project_id, args.team_id,
                               args.expected_name, args.expected_root)
        receipt.update(status='READY', project=project,
                       root_verified=True, credential_boundary='github_actions_environment',
                       vercel_write_operations=0)
        exit_code = 0
    except ReadbackBlocked as exc:
        receipt['blocker'] = str(exc)
    args.receipt_file.parent.mkdir(parents=True, exist_ok=True)
    args.receipt_file.write_text(json.dumps(receipt, sort_keys=True, indent=2) + '\n')
    # The CLI displays only a status code; the receipt is a four-field allowlist.
    print('CYBERTRON_VERCEL_PROJECT_READBACK=' + receipt['status'])
    return exit_code

if __name__ == '__main__':
    sys.exit(main())
