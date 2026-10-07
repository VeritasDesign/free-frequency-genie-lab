'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT='lab/sentinel_v021_candidate/';
const PIN='e4e6bf8197f177861e1fb9e6378a2a8e7bb85c7b';
function replaceOnce(s,a,b){if(s.split(a).length!==2)throw Error('SOURCE_ANCHOR_MISMATCH');return s.replace(a,b)}
function build(root){
 const state=path.join(root,ROOT,'src/state.js'),app=path.join(root,ROOT,'src/app.js');
 const nextState=replaceOnce(fs.readFileSync(state,'utf8'),"plane:'sample'","plane:'nws'");
 let nextApp=replaceOnce(fs.readFileSync(app,'utf8'),'EXPLORE · MIXED ORIGIN',"EXPLORE · ${state.plane==='nws'?'NOAA/NWS':'DEMO / SAMPLES'}");
 nextApp=replaceOnce(nextApp,'>Sample discovery</button>','>Demo / Samples</button>');
 fs.writeFileSync(state,nextState);fs.writeFileSync(app,nextApp);
 const geo=path.join(root,ROOT,'src/geo.js');
 const nextGeo=replaceOnce(fs.readFileSync(geo,'utf8'),'Math.round((n+Number.EPSILON)*1e6)/1e6','Math.round((n+Number.EPSILON)*1e4)/1e4');
 fs.writeFileSync(geo,nextGeo);
 const test=`import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from './src/state.js';
import {representativePoint} from './src/geo.js';
import {buildUpstreamUrl} from './lib/nws-transport.js';
import {readFileSync} from 'node:fs';
test('official geometry point avoids NWS precision redirect',()=>{
 const g={type:'Polygon',coordinates:[[[-84.887345,43.147312],[-83.887345,43.147312],[-83.887345,44.147312],[-84.887345,44.147312],[-84.887345,43.147312]]]};
 const p=representativePoint(g);assert.equal(p.lat,43.6473);assert.equal(p.lon,-84.3873);
 assert.equal(buildUpstreamUrl('/api/nws?op=point&lat='+p.lat+'&lon='+p.lon).pathname,'/points/43.6473,-84.3873');
});
test('Explore defaults to official NWS plane',()=>assert.equal(initialState.plane,'nws'));
test('samples remain explicit and real event evidence flow is preserved',()=>{
 const a=readFileSync(new URL('./src/app.js',import.meta.url),'utf8');
 for(const s of ['Demo / Samples','data-explain=','NWS OFFICIAL SOURCE · REAL','EXPLAIN THIS · NWS EVIDENCE','captureMapState(state)','wireAreaForm()','localStorage.setItem(AREA_KEY','nwsAdapter.forecast('])assert.ok(a.includes(s),s);
});
`;
 fs.writeFileSync(path.join(root,ROOT,'REAL_FIRST_TESTS.mjs'),test);
 return [ROOT+'src/state.js',ROOT+'src/app.js',ROOT+'src/geo.js',ROOT+'REAL_FIRST_TESTS.mjs'];
}
module.exports={build,PIN,ROOT,replaceOnce};
if(require.main===module){const files=build(process.argv[2]||'target');console.log(JSON.stringify({builder:'trusted-deterministic-sentinel-real-first',source_commit:PIN,changed_files:files,production_write:false,deploy:false}));}
