#!/usr/bin/env python3
"""Build the exact Sentinel V0.2 isolated-review release bundle from the preserved candidate ZIP."""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

CANDIDATE_SHA256="017e86298b32aa56c3d4c327b2db290a8c7561758640d8f9068a31bc7429f956"
PREFIX="sentinel-v02-transport-only/"
RUNTIME_FILES=(
    "index.html",
    "styles.css",
    "package.json",
    "vercel.json",
    "api/nws.js",
    "lib/nws-transport.js",
    "fixtures/events.js",
    "src/app.js",
    "src/state.js",
    "src/geo.js",
    "src/adapters/catalog.js",
    "src/adapters/fixture-adapter.js",
    "src/adapters/nws-adapter.js",
    "src/adapters/source-adapter.js",
)

def safe(name: str) -> None:
    p=PurePosixPath(name)
    if (not name or name.startswith("/") or "\\" in name or
        any(x in ("", ".", "..") for x in name.split("/")) or p.as_posix()!=name):
        raise SystemExit("unsafe_zip_path")

def deterministic_info(name: str) -> ZipInfo:
    i=ZipInfo(name, date_time=(1980,1,1,0,0,0))
    i.compress_type=ZIP_DEFLATED
    i.external_attr=(0o100644 & 0xFFFF) << 16
    return i

def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--source", required=True, type=Path)
    ap.add_argument("--output", required=True, type=Path)
    ap.add_argument("--source-revision", required=True)
    args=ap.parse_args()

    if len(args.source_revision)!=40 or any(c not in "0123456789abcdef" for c in args.source_revision):
        raise SystemExit("source_revision_invalid")
    raw=args.source.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=CANDIDATE_SHA256:
        raise SystemExit("candidate_sha256_mismatch")

    with ZipFile(args.source) as zin:
        names=zin.namelist()
        if len(names)!=len(set(names)):
            raise SystemExit("candidate_duplicate_entry")
        blobs={}
        for rel in RUNTIME_FILES:
            safe(rel)
            src=PREFIX+rel
            if src not in names:
                raise SystemExit("candidate_runtime_file_missing:"+rel)
            blobs[rel]=zin.read(src)

    entries=[
        {"path":p,"sha256":hashlib.sha256(blobs[p]).hexdigest(),"bytes":len(blobs[p])}
        for p in RUNTIME_FILES
    ]
    manifest=json.dumps(
        {"source_revision":args.source_revision,"files":entries},
        sort_keys=True,separators=(",",":")
    ).encode()
    sums="".join(f"{e['sha256']}  {e['path']}\n" for e in entries).encode()

    args.output.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(args.output,"w") as zout:
        for p in RUNTIME_FILES:
            zout.writestr(deterministic_info(p),blobs[p])
        zout.writestr(deterministic_info("SOURCE_MANIFEST.json"),manifest)
        zout.writestr(deterministic_info("SHA256SUMS"),sums)

    print(json.dumps({
        "status":"READY",
        "candidate_sha256":CANDIDATE_SHA256,
        "source_revision":args.source_revision,
        "release_bundle_sha256":hashlib.sha256(args.output.read_bytes()).hexdigest(),
        "runtime_files":entries,
    },sort_keys=True))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
