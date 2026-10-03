"""Focused regression coverage for explicit project-root Vercel release profiles."""
import hashlib
import importlib.util
from pathlib import Path
import unittest

MODULE = Path(__file__).with_name("adapter_repaired.py")
spec = importlib.util.spec_from_file_location("release_adapter_project_root_under_test", MODULE)
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.READBACK_SLEEP = lambda _seconds: None

PUBLIC = b"<html>sentinel</html>"
CONFIG = b"{}"


def root_profile():
    return {
        "project_id": "prj_SENTINEL123",
        "project_name": "free-frequency-sentinel-v02-review",
        "team_id": "team_ABC123",
        "team_slug": "example-team",
        "root_mode": "project-root",
        "required_root": None,
        "production_alias": "free-frequency-sentinel-v02-review.vercel.app",
        "artifact_paths": {
            "index.html": "index.html",
            "package.json": "package.json",
            "vercel.json": "vercel.json",
        },
        "readback_paths": {"index.html": "/"},
        "release_enabled": True,
    }


def legacy_subdirectory_profile():
    p = root_profile()
    p.pop("root_mode")
    p["required_root"] = "apps/sentinel"
    return p


def bundle():
    blobs = {
        "index.html": PUBLIC,
        "package.json": CONFIG,
        "vercel.json": CONFIG,
    }
    return {
        "revision": "b" * 40,
        "blobs": blobs,
        "sha256": {k: hashlib.sha256(v).hexdigest() for k, v in blobs.items()},
    }


def approval(p):
    return {
        "project_id": p["project_id"],
        "source_revision": "b" * 40,
        "production_alias": p["production_alias"],
        "intent": "publish_exact_verified_artifacts",
    }


class RootProvider:
    def __init__(self, remote_root=None):
        self.remote_root = remote_root
        self.deploy_count = 0
        self.saw_root_asset = False

    def get_project(self, p):
        return {
            "id": p["project_id"],
            "name": p["project_name"],
            "accountId": p["team_id"],
            "rootDirectory": self.remote_root,
        }

    def get_domains(self, p):
        return [p["production_alias"]]

    def get_deployment(self, p, ref):
        if ref == p["production_alias"]:
            return {
                "id": "dpl_previous",
                "projectId": p["project_id"],
                "state": "READY",
            }
        return {
            "id": "dpl_new",
            "projectId": p["project_id"],
            "state": "READY",
            "target": "production",
            "alias": [p["production_alias"]],
        }

    def link(self, workspace, p):
        d = workspace / ".vercel"
        d.mkdir()
        (d / "project.json").write_text(
            '{"projectId":"%s","orgId":"%s"}' % (p["project_id"], p["team_id"]))

    def deploy(self, workspace, p):
        self.deploy_count += 1
        self.saw_root_asset = (workspace / "index.html").read_bytes() == PUBLIC
        self.assert_no_subdirectory_carrier = not (workspace / "apps").exists()
        return "https://sentinel-review-new123.vercel.app"

    def read_alias(self, p, route):
        return PUBLIC


class ProjectRootModeRegression(unittest.TestCase):
    def test_legacy_profile_normalizes_to_subdirectory(self):
        p = adapter.parse_profile(legacy_subdirectory_profile())
        self.assertEqual(p["root_mode"], "subdirectory")
        self.assertEqual(p["required_root"], "apps/sentinel")

    def test_project_root_requires_explicit_null_root(self):
        p = root_profile()
        p["required_root"] = "apps/sentinel"
        with self.assertRaisesRegex(
                adapter.ReleaseBlocked, "project_root_requires_null_required_root"):
            adapter.parse_profile(p)

    def test_subdirectory_mode_rejects_null_root(self):
        p = root_profile()
        p["root_mode"] = "subdirectory"
        with self.assertRaisesRegex(adapter.ReleaseBlocked, "unsafe_relative_path"):
            adapter.parse_profile(p)

    def test_project_root_identity_accepts_only_remote_null(self):
        p = adapter.parse_profile(root_profile())
        adapter.verify_project_identity(RootProvider(remote_root=None), p)
        with self.assertRaisesRegex(
                adapter.ReleaseBlocked, "remote_root_directory_mismatch"):
            adapter.verify_project_identity(
                RootProvider(remote_root="apps/sentinel"), p)

    def test_project_root_stages_at_workspace_root_and_deploys_once(self):
        p = adapter.parse_profile(root_profile())
        provider = RootProvider(remote_root=None)
        result = adapter.publish(p, bundle(), provider, approval(p))
        self.assertEqual(result["result"], "READY_AND_ALIAS_BYTES_MATCH")
        self.assertEqual(result["root_mode"], "project-root")
        self.assertIsNone(result["root_directory"])
        self.assertEqual(provider.deploy_count, 1)
        self.assertTrue(provider.saw_root_asset)
        self.assertTrue(provider.assert_no_subdirectory_carrier)


if __name__ == "__main__":
    unittest.main()
