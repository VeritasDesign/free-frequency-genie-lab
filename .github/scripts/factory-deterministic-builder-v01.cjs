'use strict';

const TASKS=Object.freeze({
  'sentinel-v021-forecast-coordinate-fix':Object.freeze({
    issueNumber:95,
    baseBranch:'factory-sentinel-v021-make-home-real',
    files:['lab/sentinel_v021_candidate/src/geo.js','lab/sentinel_v021_candidate/FACTORY_TESTS.mjs']
  })
});

function round6(n){return Math.round((n+Number.EPSILON)*1e6)/1e6}

function patchGeo(source){
  const old="return {lon:(Math.min(...xs)+Math.max(...xs))/2,lat:(Math.min(...ys)+Math.max(...ys))/2,method:'official-zone-bounds-midpoint'}";
  const next="return {lon:round6((Math.min(...xs)+Math.max(...xs))/2),lat:round6((Math.min(...ys)+Math.max(...ys))/2),method:'official-zone-bounds-midpoint'}";
  if(!source.includes(old)) throw new Error('geo_expected_source_not_found');
  if(!source.includes('function round6(')) source="function round6(n){return Math.round((n+Number.EPSILON)*1e6)/1e6}\n"+source;
  return source.replace(old,next);
}

function patchTests(source){
  const marker="test('representative point derives from official geometry'";
  if(!source.includes(marker)) throw new Error('test_anchor_not_found');
  if(source.includes("representative point is transport-safe at <=6 decimals")) return source;
  return source+"\n"+[
    "test('representative point is transport-safe at <=6 decimals',()=>{",
    "  const p=representativePoint({type:'Polygon',coordinates:[[[1.123456789,2.123456789],[3.987654321,2.123456789],[3.987654321,4.987654321],[1.123456789,4.987654321],[1.123456789,2.123456789]]]});",
    "  for(const n of [p.lat,p.lon]) assert.match(String(n),/^-?\\d+(?:\\.\\d{1,6})?$/);",
    "});"
  ].join('\n')+"\n";
}

function build(taskClass,files){
  const task=TASKS[taskClass]; if(!task) throw new Error('unsupported_task_class');
  return {
    [task.files[0]]:patchGeo(files[task.files[0]]),
    [task.files[1]]:patchTests(files[task.files[1]])
  };
}
module.exports={TASKS,round6,patchGeo,patchTests,build};
