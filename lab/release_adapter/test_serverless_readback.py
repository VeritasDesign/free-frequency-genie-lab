"""Focused nondeploying regression coverage for serverless source readback policy."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

MODULE = Path(__file__).with_name("adapter_repaired.py")
spec = importlib.util.spec_from_file_location("release_adapter_under_test", MODULE)
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)

PUBLIC = {"index.html", "app.js", "style.css"}
API = {"api/ping.js", "api/speed.js"}
CONFIG = {"package.json", "vercel.json"}

def profile(paths, readback):
    return {
        "project_id": "prj_ABC123", "project_name": "connection-tester",
        "team_id": "team_ABC123", "team_slug": "example-team",
        "required_root": "apps/connection-tester",
        "production_alias": "connection-tester.vercel.app",
        "artifact_paths": {p: p for p in paths},
        "readback_paths": {p: "/" if p == "index.html" else "/" + p for p in readback},
        "release_enabled": False,
    }

def archive_at(path, paths):
    payload = {p: ("original:" + p).encode() for p in paths}
    revision = "a" * 40
    manifest = {"source_revision": revision, "files": [
        {"path": p, "sha256": hashlib.sha256(b).hexdigest(), "bytes": len(b)}
        for p, b in payload.items()
    ]}
    with ZipFile(path, "w") as z:
        for p, b in payload.items():
            z.writestr(p, b)
        z.writestr("SOURCE_MANIFEST.json", json.dumps(manifest))
        z.writestr("SHA256SUMS", "".join(
            hashlib.sha256(b).hexdigest() + "  " + p + "\n"
            for p, b in payload.items()))
    return payload

class ServerlessReadbackRegression(unittest.TestCase):
    def test_api_exempt_from_http_only_but_canonical_and_staged_integrity_remain(self):
        paths = PUBLIC | API | CONFIG
        p = adapter.parse_profile(profile(paths, PUBLIC))
        self.assertEqual(set(p["readback_paths"]), PUBLIC)
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "source.zip"
            original = archive_at(archive, paths)
            bundle = adapter.load_bundle(archive, p)
            self.assertEqual(set(bundle["blobs"]), paths)
            for name, data in bundle["blobs"].items():
                self.assertEqual(data, original[name])
                staged = Path(tmp) / "staged" / name
                staged.parent.mkdir(parents=True, exist_ok=True)
                staged.write_bytes(data)
                self.assertEqual(hashlib.sha256(staged.read_bytes()).hexdigest(),
                                 bundle["sha256"][name])
            # An altered API source must still fail canonical archive integrity.
            with ZipFile(archive, "a") as z:
                z.writestr("api/ping.js", b"altered")
            with self.assertRaises(adapter.ReleaseBlocked):
                adapter.load_bundle(archive, p)

    def test_non_api_asset_cannot_escape_readback(self):
        for missing in ("assets/private.js", "apiary.js", "API/ping.js", "api"):
            with self.subTest(missing=missing):
                paths = PUBLIC | CONFIG | {missing}
                with self.assertRaisesRegex(adapter.ReleaseBlocked, "readback_mapping_invalid"):
                    adapter.parse_profile(profile(paths, PUBLIC))

    def test_room_noise_four_public_assets_plan_only(self):
        public = {"app.js", "index.html", "style-1997.css", "style.css"}
        paths = public | CONFIG
        p = adapter.parse_profile(profile(paths, public))
        self.assertEqual(len(p["readback_paths"]), 4)
        self.assertFalse(p["release_enabled"])
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "room-noise.zip"
            archive_at(archive, paths)
            result = adapter.load_bundle(archive, p)
            self.assertEqual(len(result["sha256"]), 6)
            self.assertEqual(set(p["readback_paths"]), public)

    def test_unsafe_paths_and_release_gate_fail_closed(self):
        for unsafe in ("../escape.js", "/api/ping.js", "api/../ping.js", "api\\ping.js"):
            with self.subTest(unsafe=unsafe):
                with self.assertRaises(adapter.ReleaseBlocked):
                    adapter.parse_profile(profile(PUBLIC | CONFIG | {unsafe}, PUBLIC))
        p = adapter.parse_profile(profile(PUBLIC | API | CONFIG, PUBLIC))
        with self.assertRaisesRegex(adapter.ReleaseBlocked, "profile_reference_only"):
            adapter.publish(p, {"revision": "a" * 40}, None, {})

if __name__ == "__main__":
    unittest.main()
