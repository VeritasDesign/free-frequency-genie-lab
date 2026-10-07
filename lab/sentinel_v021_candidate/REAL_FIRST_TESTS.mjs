import test from 'node:test';
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
