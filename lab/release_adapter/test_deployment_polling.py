"""Focused nondeploying coverage for deploy-once bounded Vercel readback polling."""
import hashlib
import importlib.util
from pathlib import Path
import unittest

MODULE = Path(__file__).with_name("adapter_repaired.py")
spec = importlib.util.spec_from_file_location("release_adapter_polling_under_test", MODULE)
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.READBACK_SLEEP = lambda _seconds: None

PUBLIC = b"<html>ready</html>"
CONFIG = b"{}"

def profile():
    return {
        "project_id": "prj_ABC123",
        "project_name": "room-noise-instrument",
        "team_id": "team_ABC123",
        "team_slug": "example-team",
        "required_root": "apps/room-noise-instrument",
        "production_alias": "room-noise-instrument.vercel.app",
        "artifact_paths": {
            "index.html": "index.html",
            "package.json": "package.json",
            "vercel.json": "vercel.json",
        },
        "readback_paths": {"index.html": "/"},
        "release_enabled": True,
    }

def bundle():
    blobs = {
        "index.html": PUBLIC,
        "package.json": CONFIG,
        "vercel.json": CONFIG,
    }
    return {
        "revision": "a" * 40,
        "blobs": blobs,
        "sha256": {k: hashlib.sha256(v).hexdigest() for k, v in blobs.items()},
    }

def approval():
    return {
        "project_id": "prj_ABC123",
        "source_revision": "a" * 40,
        "production_alias": "room-noise-instrument.vercel.app",
        "intent": "publish_exact_verified_artifacts",
    }

class FakeProvider:
    def __init__(self, post_deploy):
        self.post_deploy = list(post_deploy)
        self.deploy_count = 0
        self.post_deploy_reads = 0

    def get_project(self, p):
        return {
            "id": p["project_id"], "name": p["project_name"],
            "accountId": p["team_id"], "rootDirectory": p["required_root"],
        }

    def get_domains(self, p):
        return [p["production_alias"]]

    def get_deployment(self, p, ref):
        if ref == p["production_alias"]:
            return {"id": "dpl_previous", "projectId": p["project_id"], "state": "READY"}
        self.post_deploy_reads += 1
        item = self.post_deploy.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    def link(self, workspace, p):
        d = workspace / ".vercel"
        d.mkdir()
        (d / "project.json").write_text(
            '{"projectId":"%s","orgId":"%s"}' % (p["project_id"], p["team_id"]))

    def deploy(self, workspace, p):
        self.deploy_count += 1
        return "https://room-noise-instrument-new123.vercel.app"

    def read_alias(self, p, route):
        return PUBLIC

def ready(p):
    return {
        "id": "dpl_new", "projectId": p["project_id"], "state": "READY",
        "target": "production", "alias": [p["production_alias"]],
    }

class DeploymentPollingRegression(unittest.TestCase):
    def test_transient_unavailable_then_building_then_ready_deploys_once(self):
        p = profile()
        provider = FakeProvider([
            adapter.ReleaseBlocked("vercel_readback_unavailable"),
            {"id": "dpl_new", "projectId": p["project_id"], "state": "BUILDING"},
            ready(p),
        ])
        result = adapter.publish(p, bundle(), provider, approval())
        self.assertEqual(result["result"], "READY_AND_ALIAS_BYTES_MATCH")
        self.assertEqual(provider.deploy_count, 1)
        self.assertEqual(provider.post_deploy_reads, 3)

    def test_terminal_states_fail_closed_without_redeploy(self):
        for state in ("ERROR", "CANCELED"):
            with self.subTest(state=state):
                p = profile()
                provider = FakeProvider([
                    {"id": "dpl_new", "projectId": p["project_id"], "state": state}
                ])
                with self.assertRaisesRegex(adapter.ReleaseBlocked, "deployment_terminal_state"):
                    adapter.publish(p, bundle(), provider, approval())
                self.assertEqual(provider.deploy_count, 1)

    def test_timeout_after_only_transient_readback_failures_never_redeploys(self):
        p = profile()
        provider = FakeProvider([
            adapter.ReleaseBlocked("vercel_readback_unavailable")
            for _ in range(len(adapter.READBACK_POLL_DELAYS) + 1)
        ])
        with self.assertRaisesRegex(adapter.ReleaseBlocked, "deployment_readback_timeout"):
            adapter.publish(p, bundle(), provider, approval())
        self.assertEqual(provider.deploy_count, 1)

    def test_wrong_project_identity_fails_immediately_without_redeploy(self):
        p = profile()
        provider = FakeProvider([
            {"id": "dpl_new", "projectId": "prj_WRONG", "state": "READY"}
        ])
        with self.assertRaisesRegex(adapter.ReleaseBlocked, "deployment_project_identity_mismatch"):
            adapter.publish(p, bundle(), provider, approval())
        self.assertEqual(provider.deploy_count, 1)
        self.assertEqual(provider.post_deploy_reads, 1)

if __name__ == "__main__":
    unittest.main()
