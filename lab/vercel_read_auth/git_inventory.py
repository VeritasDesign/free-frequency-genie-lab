#!/usr/bin/env python3
"""Read-only Vercel Git/fan-out inventory for a fixed allowlisted project set."""
from __future__ import annotations
import json
import os
from urllib import parse, request, error

TEAM_ID="team_6lvKuv1CthbbshHpQoleqR2R"
PROJECTS={
    "connection-field-instrument":"prj_Fw5ajxndKKfzpbDSYLTi7zWmbR2Z",
    "room-noise-instrument":"prj_0egxqb5S3QwPPUtMAiYJNAOHju86",
    "phenom":"prj_sjAaXrT1rnESqpSDlZgcJrcyklES",
    "listing_agent_v0":"prj_iBbMna2uhxVMk2eqMbRhMOKbChnf",
    "free-frequency-factory":"prj_pPfDaTfR0D8ri4zGbV1hbybfCVvr",
    "the-room-v0-4":"prj_iqCAylxvhZgx2YQmPIqjDTCUFWc2",
    "free_frequency_os_v0":"prj_JupSjtsJA4OC1hqJz5KSuZCkFr31",
    "zillions-for-autumn":"prj_FA00NatBOjc1ejoQ1X2rsEiqH1gp",
    "shannon-bishop-basket":"prj_zq4Ug9nvjkVqNVqILrSnc1EecLbw",
    "justine-autumn":"prj_ZI2dCF2DjCPVI8RTPMZlqrtqvSdj",
}

class InventoryBlocked(ValueError):
    pass

class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise InventoryBlocked("vercel_inventory_redirect_blocked")

def get_project(project_id: str) -> dict:
    token=os.environ.get("VERCEL_READ_TOKEN")
    if not token:
        raise InventoryBlocked("VERCEL_READ_TOKEN_unavailable")
    url=("https://api.vercel.com/v9/projects/"+project_id+"?"+
         parse.urlencode({"teamId":TEAM_ID}))
    req=request.Request(url, method="GET", headers={
        "Authorization":"Bearer "+token,
        "Accept":"application/json",
    })
    try:
        with request.build_opener(NoRedirect()).open(req, timeout=20) as resp:
            if resp.status != 200 or resp.geturl() != url:
                raise InventoryBlocked("vercel_inventory_unexpected_response")
            data=json.load(resp)
    except error.HTTPError as exc:
        raise InventoryBlocked("vercel_inventory_http_"+str(exc.code)) from None
    except (error.URLError, TimeoutError, OSError, ValueError) as exc:
        if isinstance(exc, InventoryBlocked):
            raise
        raise InventoryBlocked("vercel_inventory_unavailable") from None
    if not isinstance(data, dict):
        raise InventoryBlocked("vercel_inventory_payload_invalid")
    return data

def sanitized(name: str, expected_id: str, data: dict) -> dict:
    if data.get("id") != expected_id or data.get("name") != name or data.get("accountId") != TEAM_ID:
        raise InventoryBlocked("vercel_inventory_identity_mismatch")
    link=data.get("link")
    link_summary=None
    if isinstance(link, dict):
        link_summary={
            "type": link.get("type"),
            "repo": link.get("repo"),
            "org": link.get("org"),
            "productionBranch": link.get("productionBranch"),
            "repoId": link.get("repoId"),
        }
    return {
        "id": data.get("id"),
        "name": data.get("name"),
        "rootDirectory": data.get("rootDirectory"),
        "commandForIgnoringBuildStep": data.get("commandForIgnoringBuildStep"),
        "enableAffectedProjectsDeployments": data.get("enableAffectedProjectsDeployments"),
        "link": link_summary,
    }

def main() -> int:
    rows=[]
    for name, project_id in PROJECTS.items():
        rows.append(sanitized(name, project_id, get_project(project_id)))
    print(json.dumps({
        "status":"READY",
        "capability":"vercel_git_fanout_inventory_read_only_v0.1",
        "team_id":TEAM_ID,
        "projects":rows,
        "vercel_write_operations":0,
        "deployments":0,
    }, sort_keys=True))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
