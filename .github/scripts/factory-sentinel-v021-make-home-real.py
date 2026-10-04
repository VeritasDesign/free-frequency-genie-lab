#!/usr/bin/env python3
"""Factory builder for Sentinel V0.2.1 Make Home Real candidate. No deploy."""
from __future__ import annotations
import argparse, hashlib, json, shutil, sys
from pathlib import Path
from zipfile import ZipFile

REPO_ROOT=Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0,str(REPO_ROOT))

from lab.release_adapter.build_sentinel_v02_review_bundle import (
    CANDIDATE_SHA256, PREFIX, RUNTIME_FILES, apply_area_submit_hotfix
)

FACTORY_BUILD_ID="sentinel-v021-make-home-real-v01"

def replace_one(text: str, old: str, new: str, name: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f"anchor_mismatch:{name}:{text.count(old)}")
    return text.replace(old,new,1)

def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--source",required=True,type=Path)
    ap.add_argument("--output-dir",required=True,type=Path)
    ap.add_argument("--source-revision",required=True)
    args=ap.parse_args()
    raw=args.source.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=CANDIDATE_SHA256:
        raise SystemExit("candidate_sha256_mismatch")
    if len(args.source_revision)!=40 or any(c not in "0123456789abcdef" for c in args.source_revision):
        raise SystemExit("source_revision_invalid")

    if args.output_dir.exists():
        shutil.rmtree(args.output_dir)
    args.output_dir.mkdir(parents=True)

    with ZipFile(args.source) as z:
        names=set(z.namelist())
        blobs={}
        for rel in RUNTIME_FILES:
            src=PREFIX+rel
            if src not in names:
                raise SystemExit("missing_runtime:"+rel)
            blobs[rel]=z.read(src)

    blobs["src/app.js"]=apply_area_submit_hotfix(blobs["src/app.js"])

    transport=blobs["lib/nws-transport.js"].decode()
    transport=replace_one(
        transport,
        "const ZONE_RE = /^[A-Z]{2}[CZ][0-9]{3}$/;\n",
        "const ZONE_RE = /^[A-Z]{2}[CZ][0-9]{3}$/;\nconst OFFICE_RE=/^[A-Z]{3}$/;\nconst GRID_RE=/^[0-9]{1,4}$/;\nconst COORD_RE=/^-?[0-9]{1,3}(?:\\.[0-9]{1,6})?$/;\n",
        "transport_validators"
    )
    transport=replace_one(
        transport,
        "function zone(v,type){ if(!ZONE_RE.test(v)) bad(400,'invalid_zone','invalid zone id'); if(v.slice(0,2)!=='MI') bad(400,'invalid_zone','V0.2 prep is MI only'); if(type==='county'&&v[2]!=='C') bad(400,'invalid_zone','county zone required'); if(type==='forecast'&&v[2]!=='Z') bad(400,'invalid_zone','forecast zone required'); return v; }\n",
        "function zone(v,type){ if(!ZONE_RE.test(v)) bad(400,'invalid_zone','invalid zone id'); if(v.slice(0,2)!=='MI') bad(400,'invalid_zone','V0.2 prep is MI only'); if(type==='county'&&v[2]!=='C') bad(400,'invalid_zone','county zone required'); if(type==='forecast'&&v[2]!=='Z') bad(400,'invalid_zone','forecast zone required'); return v; }\nfunction coord(v,min,max,key){ if(!COORD_RE.test(v||'')) bad(400,'invalid_'+key,'invalid '+key); const n=Number(v); if(!Number.isFinite(n)||n<min||n>max) bad(400,'invalid_'+key,'invalid '+key); return String(n); }\nfunction office(v){ if(!OFFICE_RE.test(v||'')) bad(400,'invalid_office','invalid forecast office'); return v; }\nfunction grid(v,key){ if(!GRID_RE.test(v||'')) bad(400,'invalid_'+key,'invalid '+key); const n=Number(v); if(!Number.isSafeInteger(n)||n<0||n>9999) bad(400,'invalid_'+key,'invalid '+key); return String(n); }\n",
        "transport_value_validators"
    )
    transport=replace_one(
        transport,
        "  else if(op==='alerts') { exactKeys(u.searchParams,new Set(['op','zone'])); const id=zone(one(u.searchParams,'zone'),'county'); out=new URL('/alerts/active',NWS_ORIGIN); out.search=new URLSearchParams({zone:id,status:'actual'}).toString(); }\n",
        "  else if(op==='point') { exactKeys(u.searchParams,new Set(['op','lat','lon'])); const lat=coord(one(u.searchParams,'lat'),-90,90,'lat'); const lon=coord(one(u.searchParams,'lon'),-180,180,'lon'); out=new URL(`/points/${lat},${lon}`,NWS_ORIGIN); }\n  else if(op==='forecast') { exactKeys(u.searchParams,new Set(['op','office','x','y'])); const o=office(one(u.searchParams,'office')); const x=grid(one(u.searchParams,'x'),'grid_x'); const y=grid(one(u.searchParams,'y'),'grid_y'); out=new URL(`/gridpoints/${o}/${x},${y}/forecast`,NWS_ORIGIN); }\n  else if(op==='alerts') { exactKeys(u.searchParams,new Set(['op','zone'])); const id=zone(one(u.searchParams,'zone'),'county'); out=new URL('/alerts/active',NWS_ORIGIN); out.search=new URLSearchParams({zone:id,status:'actual'}).toString(); }\n",
        "transport_point_forecast_ops"
    )
    blobs["lib/nws-transport.js"]=transport.encode()

    geo=blobs["src/geo.js"].decode()
    geo += "\nexport function representativePoint(g){const rs=rings(g).filter(r=>Array.isArray(r)&&r.length>2);const pts=rs.flat().filter(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]));if(!pts.length)return null;const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return {lon:(Math.min(...xs)+Math.max(...xs))/2,lat:(Math.min(...ys)+Math.max(...ys))/2,method:'official-zone-bounds-midpoint'}}\n"
    blobs["src/geo.js"]=geo.encode()

    adapter=blobs["src/adapters/nws-adapter.js"].decode()
    adapter=replace_one(
        adapter,
        "  async alerts(zone){const r=await get({op:'alerts',zone}); return {features:r.data?.features||[],evidence:r.evidence};}\n",
        "  async alerts(zone){const r=await get({op:'alerts',zone}); return {features:r.data?.features||[],evidence:r.evidence};}\n  async point(lat,lon){const r=await get({op:'point',lat:String(lat),lon:String(lon)}); return {data:r.data,evidence:r.evidence};}\n  async forecast(office,x,y){const r=await get({op:'forecast',office,x:String(x),y:String(y)}); return {data:r.data,evidence:r.evidence};}\n",
        "adapter_point_forecast"
    )
    blobs["src/adapters/nws-adapter.js"]=adapter.encode()

    state=blobs["src/state.js"].decode()
    state=replace_one(
        state,
        "nws:{status:'unconfigured',error:null,area:null,zoneFeature:null,alerts:[],lastCheck:null}",
        "nws:{status:'unconfigured',error:null,area:null,zoneFeature:null,alerts:[],lastCheck:null,forecast:[],forecastError:null,forecastPoint:null}",
        "state_forecast"
    )
    blobs["src/state.js"]=state.encode()

    app=blobs["src/app.js"].decode()
    app=replace_one(app,"import {projectGeometry} from './geo.js';","import {projectGeometry,representativePoint} from './geo.js';","app_geo_import")
    app=replace_one(
        app,
        "let events=[],watch={};\n",
        "let events=[],watch={};\nconst AREA_KEY='free-frequency-sentinel.nws-area.v1';\nfunction rememberArea(area){try{localStorage.setItem(AREA_KEY,JSON.stringify({id:area.id,type:area.type,label:area.label}))}catch{}}\nfunction restoreArea(){try{const a=JSON.parse(localStorage.getItem(AREA_KEY)||'null');if(!a||!['county','forecast'].includes(a.type)||!/^[A-Z]{2}[CZ][0-9]{3}$/.test(a.id||''))return null;return {id:a.id,type:a.type,label:String(a.label||'Home').slice(0,40),version:0}}catch{return null}}\n",
        "app_persistence_helpers"
    )

    home_start=app.index("function home(){")
    home_end=app.index("function mapTransform",home_start)
    if home_start<0 or home_end<0: raise SystemExit("anchor_mismatch:home_function")
    new_home="""function home(){const n=state.nws;const h=n.status==='ready'?(n.alerts.length?`${n.alerts.length} active NWS alert${n.alerts.length===1?'':'s'} for ${esc(n.area.name||n.area.id)}.`:`No active NWS alerts for ${esc(n.area.name||n.area.id)}.`):n.status==='loading'?'Checking NWS…':n.status==='error'?'NWS status is unknown until a successful retry.':'Choose one official NWS weather area to make weather real.';const fp=(n.forecast||[]).slice(0,4);const forecast=n.status==='ready'?`<section class="card"><div class="meta">NWS FORECAST · REAL</div>${fp.length?fp.map(p=>`<div class="evidence"><strong>${esc(p.name)}</strong><p>${esc(p.temperature)}°${esc(p.temperatureUnit)} · ${esc(p.shortForecast)}</p><p class="muted">Wind ${esc(p.windSpeed)} ${esc(p.windDirection)}</p></div>`).join(''):`<p class="muted">${esc(n.forecastError||'No forecast periods returned.')}</p>`}</section>`:'';return `<section class="card hero"><div class="meta">HOME · OFFICIAL NWS</div><h2>${h}</h2>${n.area?`<p><strong>${esc(n.area.label)} · ${esc(n.area.id)}</strong></p>`:''}<p class="muted">${n.lastCheck?`Last checked ${esc(fmt(n.lastCheck))}. `:''}Sentinel does not monitor while this page is closed. Forecast location is derived from the selected official area geometry; device location is never requested.</p><div class="row"><button class="secondary" data-go="places">${n.area?'Weather area':'Set weather area'}</button>${n.area?'<button class="primary" data-refresh-nws>Refresh now</button>':''}<button class="secondary" data-go="explore">Open Explore</button></div></section>${forecast}<div class="home-grid"><section class="card"><div class="meta">SOURCE COVERAGE</div><div class="coverage">${nwsCoverageRow()}${watch.layers.filter(x=>!x.name.startsWith('Weather')).map(x=>`<div><span>${esc(x.name)}<br><small class="muted">${esc(x.source)}</small></span><span class="label observed">SAMPLE</span></div>`).join('')}</div></section><section class="card"><div class="meta">BUT LOOK AT THIS</div><h3>Wonder stays separate from warnings.</h3><p>Discovery samples remain synthetic and visibly separate from the real NWS signal.</p><button class="primary" data-select="aurora" data-plane="sample" data-go="explore">Show sample ✦</button><p class="squirrel">🐿️📡</p></section></div>`}\n"""
    app=app[:home_start]+new_home+app[home_end:]

    app=app.replace("NWS · SESSION ONLY","NWS · SAVED ON THIS DEVICE",1)
    app=app.replace(
        "Official NWS ${esc(a.type)} zone. Version ${a.version}. The zone ID is sent to NWS when checking alerts; no device location is requested.",
        "Official NWS ${esc(a.type)} zone. Saved locally in this browser. The zone ID is sent to NWS when checking alerts; no device location is requested.",
        1
    )

    refresh_start=app.index("async function refreshNws")
    refresh_end=app.index("function commitArea",refresh_start)
    if refresh_start<0 or refresh_end<0: raise SystemExit("anchor_mismatch:refresh_function")
    new_refresh="""async function refreshNws(area=state.nws.area){if(!area)return;const prior={...state.nws};state.nws={...state.nws,status:'loading',error:null,forecastError:null};render();announce('Checking NWS');try{const [z,a]=await Promise.all([nwsAdapter.zone(area.type,area.id),nwsAdapter.alerts(area.id)]);const p=z.feature?.properties||{};const committed={...area,name:p.name||p.id||area.id,version:(prior.area?.id===area.id&&prior.area?.type===area.type?prior.area.version:0)+1};const alerts=a.features.map(f=>nwsAdapter.normalizeAlert(f,a.evidence,committed));let forecast=[],forecastError=null,forecastPoint=null;try{const rp=representativePoint(z.feature?.geometry);if(!rp)throw new Error('Official area geometry did not provide a forecast point');const pt=await nwsAdapter.point(rp.lat,rp.lon),pp=pt.data?.properties||{};if(!pp.gridId||!Number.isInteger(pp.gridX)||!Number.isInteger(pp.gridY))throw new Error('NWS point metadata did not provide a forecast grid');const fc=await nwsAdapter.forecast(pp.gridId,pp.gridX,pp.gridY);forecast=Array.isArray(fc.data?.properties?.periods)?fc.data.properties.periods.slice(0,8):[];forecastPoint={method:rp.method,gridId:pp.gridId,gridX:pp.gridX,gridY:pp.gridY}}catch(fe){forecastError=fe.message||'NWS forecast unavailable'}state.nws={status:'ready',error:null,area:committed,zoneFeature:z.feature,alerts,lastCheck:a.evidence.upstream?.responseReceived||new Date().toISOString(),forecast,forecastError,forecastPoint};rememberArea(committed);state.selected=null;announce(`NWS check complete. ${alerts.length} active alerts.`)}catch(e){state.nws={...prior,status:'error',error:e.message||'NWS unavailable'};announce('NWS check failed. Coverage status unknown.')}render()}\n"""
    app=app[:refresh_start]+new_refresh+app[refresh_end:]

    app=replace_one(
        app,
        "(async()=>{events=await fixtureAdapter.events();watch=await fixtureAdapter.watch();render()})();",
        "(async()=>{events=await fixtureAdapter.events();watch=await fixtureAdapter.watch();const saved=restoreArea();if(saved){state.nws.area=saved;render();await refreshNws(saved)}else render()})();",
        "app_startup_restore"
    )
    blobs["src/app.js"]=app.encode()

    for rel,data in blobs.items():
        out=args.output_dir/rel
        out.parent.mkdir(parents=True,exist_ok=True)
        out.write_bytes(data)

    tests="""import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {buildUpstreamUrl} from './lib/nws-transport.js';\nimport {representativePoint} from './src/geo.js';\ntest('point route stays on api.weather.gov',()=>assert.equal(buildUpstreamUrl('/api/nws?op=point&lat=43.62&lon=-84.25').href,'https://api.weather.gov/points/43.62,-84.25'));\ntest('forecast route stays on api.weather.gov',()=>assert.equal(buildUpstreamUrl('/api/nws?op=forecast&office=DTX&x=65&y=90').href,'https://api.weather.gov/gridpoints/DTX/65,90/forecast'));\ntest('point rejects unknown parameter',()=>assert.throws(()=>buildUpstreamUrl('/api/nws?op=point&lat=43&lon=-84&url=https://evil.test')));\ntest('representative point derives from official geometry',()=>assert.deepEqual(representativePoint({type:'Polygon',coordinates:[[[-85,43],[-84,43],[-84,44],[-85,44],[-85,43]]]}),{lon:-84.5,lat:43.5,method:'official-zone-bounds-midpoint'}));\n"""
    (args.output_dir/"FACTORY_TESTS.mjs").write_text(tests)

    app_check=(args.output_dir/"src/app.js").read_text()
    required=["localStorage.setItem(AREA_KEY","restoreArea()","Set area & check NWS","wireAreaForm()","Refresh now","NWS FORECAST · REAL","representativePoint(","nwsAdapter.point(","nwsAdapter.forecast("]
    missing=[x for x in required if x not in app_check]
    if missing: raise SystemExit("acceptance_marker_missing:"+",".join(missing))

    entries=[]
    for p in sorted(x for x in args.output_dir.rglob("*") if x.is_file()):
        rel=p.relative_to(args.output_dir).as_posix()
        entries.append({"path":rel,"bytes":p.stat().st_size,"sha256":hashlib.sha256(p.read_bytes()).hexdigest()})
    receipt={
        "status":"CANDIDATE_READY",
        "factory_build_id":FACTORY_BUILD_ID,
        "base_candidate_sha256":CANDIDATE_SHA256,
        "source_revision":args.source_revision,
        "production_write":False,
        "deploy":False,
        "capabilities":[
            "remember official weather area in browser localStorage",
            "restore and refresh saved area on startup",
            "real NWS alert status and last-checked time on Home",
            "manual Refresh now control",
            "NWS point/grid forecast derived from official zone geometry",
            "no device geolocation"
        ],
        "files":entries
    }
    (args.output_dir/"FACTORY_BUILD_RECEIPT.json").write_text(json.dumps(receipt,sort_keys=True,indent=2)+"\n")
    print(json.dumps(receipt,sort_keys=True))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
