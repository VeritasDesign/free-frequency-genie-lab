'use strict';
const cp=require('child_process'),fs=require('fs');
const b=require('./air-sentinel-001-builder.cjs'),d=require('./cybertron-airtable-sentinel-dispatcher-v01.cjs');
const run=a=>cp.execFileSync('git',a,{cwd:'target',encoding:'utf8'}).trim();
const branch='factory-air-sentinel-001-real-first';
function validateResume({parents,changed,provenance,verification}){
 if(parents.length!==2||parents[1]!==b.PIN)throw Error('RESUME_SOURCE_MISMATCH');
 const allowed=[b.ROOT+'src/app.js',b.ROOT+'src/state.js',b.ROOT+'src/geo.js',b.ROOT+'REAL_FIRST_TESTS.mjs'];
 if(!changed.length||changed.some(p=>!allowed.includes(p)&&!p.startsWith(b.ROOT+'FACTORY_EVIDENCE/')))throw Error('RESUME_DIFF_MISMATCH');
 if(provenance.work_order!==d.C.id||provenance.attempt!==d.C.attempt||provenance.source_commit!==b.PIN||provenance.production_write!==false||provenance.deploy!==false)throw Error('RESUME_RECEIPT_MISMATCH');
 if(verification.status!=='PASS'||verification.source_commit!==b.PIN||verification.live_nws.status!=='PASS'||verification.browser_fixture_tests.length!==2)throw Error('RESUME_VERIFICATION_MISSING');return true;
}
function main(){const ref=run(['ls-remote','origin','refs/heads/'+branch]);if(!ref){if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'reuse=false\n');return}
 const sha=ref.split(/\s/)[0];run(['fetch','origin','refs/heads/'+branch]);run(['checkout','--detach',sha]);
 const parents=run(['rev-list','--parents','-n','1',sha]).split(' '),changed=run(['diff','--name-only',b.PIN,sha]).split('\n');
 const e='target/'+b.ROOT+'FACTORY_EVIDENCE/';const provenance=JSON.parse(fs.readFileSync(e+'provenance.json')),verification=JSON.parse(fs.readFileSync(e+'verification.json'));
 validateResume({parents,changed,provenance,verification});fs.copyFileSync(e+'verification.json','evidence/verification.json');
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'reuse=true\n');console.log('FACTORY_RESUME_VERIFIED_EXISTING_CANDIDATE '+sha+' original_run='+provenance.run);
}
module.exports={validateResume};if(require.main===module)main();
