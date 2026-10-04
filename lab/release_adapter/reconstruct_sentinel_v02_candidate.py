#!/usr/bin/env python3
"""Reconstruct the exact Sentinel V0.2 candidate ZIP from provenance-pinned base64 chunks."""
from __future__ import annotations
import argparse, base64, hashlib, json
from pathlib import Path

EXPECTED_CANDIDATE_SHA256="017e86298b32aa56c3d4c327b2db290a8c7561758640d8f9068a31bc7429f956"
EXPECTED_SOURCE_REVISION="8eba21d8a769f8a94f3b31a9ce0a14a2188fb0dd"

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--chunks-dir", required=True, type=Path)
    ap.add_argument("--output", required=True, type=Path)
    args=ap.parse_args()

    prov_path=args.chunks_dir/"SOURCE_PROVENANCE.json"
    prov=json.loads(prov_path.read_text(encoding="utf-8"))
    if prov.get("candidate_sha256") != EXPECTED_CANDIDATE_SHA256:
        raise SystemExit("provenance_candidate_sha256_mismatch")
    if prov.get("source_revision") != EXPECTED_SOURCE_REVISION:
        raise SystemExit("provenance_source_revision_mismatch")

    expected={row["name"]:row for row in prov["chunks"]}
    ordered=prov["chunk_order"]
    if ordered != [f"part{i:03d}.b64" for i in range(8)]:
        raise SystemExit("chunk_order_invalid")
    if set(ordered) != set(expected):
        raise SystemExit("chunk_manifest_mismatch")

    parts=[]
    for name in ordered:
        path=args.chunks_dir/name
        data=path.read_bytes()
        row=expected[name]
        if len(data) != row["bytes"]:
            raise SystemExit("chunk_length_mismatch:"+name)
        if sha256(data) != row["sha256"]:
            raise SystemExit("chunk_sha256_mismatch:"+name)
        try:
            text=data.decode("ascii")
        except UnicodeDecodeError:
            raise SystemExit("chunk_non_ascii:"+name) from None
        parts.append(text)

    encoded="".join(parts).encode("ascii")
    if len(encoded) != prov["base64_bytes"]:
        raise SystemExit("base64_length_mismatch")
    try:
        raw=base64.b64decode(encoded, validate=True)
    except Exception:
        raise SystemExit("base64_decode_invalid") from None
    if len(raw) != prov["candidate_bytes"]:
        raise SystemExit("candidate_size_mismatch")
    if sha256(raw) != EXPECTED_CANDIDATE_SHA256:
        raise SystemExit("candidate_sha256_mismatch")

    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_bytes(raw)
    print(json.dumps({
        "status":"READY",
        "candidate_sha256":EXPECTED_CANDIDATE_SHA256,
        "candidate_bytes":len(raw),
        "source_revision":EXPECTED_SOURCE_REVISION,
        "chunks":len(ordered),
    },sort_keys=True))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
