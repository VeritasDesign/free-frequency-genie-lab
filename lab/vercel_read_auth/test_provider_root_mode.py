"""Focused tests for explicit project-root verification in the protected Vercel reader."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).with_name("provider.py")
spec = importlib.util.spec_from_file_location("vercel_read_provider_under_test", MODULE)
provider = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provider)


class ProjectRootReadAuthorityRegression(unittest.TestCase):
    def test_assert_project_matches_accepts_null_root_only_when_expected(self):
        project = {
            "id": "prj_ABC123",
            "name": "sentinel-review",
            "accountId": "team_ABC123",
            "rootDirectory": None,
        }
        provider.assert_project_matches(
            project, "prj_ABC123", "team_ABC123", "sentinel-review", None)
        with self.assertRaisesRegex(
                provider.ReadbackBlocked, "vercel_root_directory_mismatch"):
            provider.assert_project_matches(
                project, "prj_ABC123", "team_ABC123",
                "sentinel-review", "apps/sentinel")

    def test_cli_expected_project_root_emits_ready_null_root_receipt(self):
        original = provider.read_project
        provider.read_project = lambda _project, _team: {
            "id": "prj_ABC123",
            "name": "sentinel-review",
            "accountId": "team_ABC123",
            "rootDirectory": None,
        }
        try:
            with tempfile.TemporaryDirectory() as tmp:
                receipt = Path(tmp) / "receipt.json"
                rc = provider.main([
                    "--project-id", "prj_ABC123",
                    "--team-id", "team_ABC123",
                    "--expected-name", "sentinel-review",
                    "--expected-project-root",
                    "--receipt-file", str(receipt),
                ])
                self.assertEqual(rc, 0)
                data = json.loads(receipt.read_text())
                self.assertEqual(data["status"], "READY")
                self.assertEqual(data["root_mode"], "project-root")
                self.assertIsNone(data["expected_root"])
                self.assertIsNone(data["project"]["rootDirectory"])
                self.assertEqual(data["vercel_write_operations"], 0)
        finally:
            provider.read_project = original

    def test_cli_subdirectory_mode_remains_compatible(self):
        original = provider.read_project
        provider.read_project = lambda _project, _team: {
            "id": "prj_ABC123",
            "name": "room-noise",
            "accountId": "team_ABC123",
            "rootDirectory": "apps/room-noise",
        }
        try:
            with tempfile.TemporaryDirectory() as tmp:
                receipt = Path(tmp) / "receipt.json"
                rc = provider.main([
                    "--project-id", "prj_ABC123",
                    "--team-id", "team_ABC123",
                    "--expected-name", "room-noise",
                    "--expected-root", "apps/room-noise",
                    "--receipt-file", str(receipt),
                ])
                self.assertEqual(rc, 0)
                data = json.loads(receipt.read_text())
                self.assertEqual(data["root_mode"], "subdirectory")
                self.assertEqual(data["expected_root"], "apps/room-noise")
        finally:
            provider.read_project = original


if __name__ == "__main__":
    unittest.main()
