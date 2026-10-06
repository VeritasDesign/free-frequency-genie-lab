'use strict';
const C={
 base:'app01sBuNbRyjVt47',table:'tbl3ZPAJF3FvbR90p',record:'rec9atwdaxgtqKgZj',
 id:'AIR-REAL-002',task:'frequency-engine-hero-responsive-fix',exec:'AIR-REAL-002-DISPATCH-1',
 payload:"Fix the Frequency Engine landing page desktop hero image treatment. Current mobile presentation is accepted and must remain visually unchanged. On desktop, the digital Frequency device image is excessively zoomed/cropped; adjust responsive styling so the whole device, or nearly the whole device, is framed at a sensible scale while preserving Astra's desktop composition. No unrelated copy/layout changes. Source target is the current frequencyengine.com Astra build; locate the canonical source before editing. Branch/PR first; verify desktop and mobile behavior with evidence before any production deployment.",
 next:'Dispatcher/Factory locates canonical Frequency Engine source, makes bounded desktop-only responsive hero-image fix, verifies desktop + mobile, opens PR and persists receipt. Do not deploy without existing authorized deployment policy or explicit human gate.',
 target:{repo:'VeritasDesign/free-frequency-landing-lab',path:'build_landing.py',blob:'97127001e1d37eedbd5258ccd28f299de1520a0c',branch:'factory-air-real-002-frequency-hero'},
 fields:{id:'fldn5b6yeYYRMPSaM',status:'fldgOSvL9pxpNRL2I',task:'fldHLUnihNBexSkZn',payload:'fldlnFmNjotAB08qm',attempt:'fldyMDCSTEW46XKZV',claimed:'fldjB7m1c9jaMhNKR',receipt:'fldO9RGHuCX7Bv0q0',result:'flde4kea7ckvPVn2g',next:'fldTpHDML0gVrtGk5'}
};
function v(f){const x=k=>f[C.fields[k]]??'';
 if(x('id')!==C.id)throw Error('WORK_ORDER_MISMATCH');
 if(x('task')!==C.task)throw Error('TASK_CLASS_MISMATCH');
 if(x('payload')!==C.payload)throw Error('PAYLOAD_MISMATCH');
 if(x('next')!==C.next)throw Error('NEXT_ACTION_MISMATCH');
 if(x('status')==='COMPLETE'&&x('attempt')===C.exec)return 'REPLAY';
 if(x('status')==='CLAIMED'&&x('attempt')===C.exec&&x('claimed')==='Cybertron READY Dispatcher v0.2')return 'RESUME';
 if(x('status')!=='READY')throw Error('STATUS_NOT_READY');
 if(x('attempt')||x('claimed')||x('result'))throw Error('ALREADY_CLAIMED_OR_COMPLETED');
 return 'APPLY';
}
async function req(token,method,body){const u=`https://api.airtable.com/v0/${C.base}/${C.table}/${C.record}?returnFieldsByFieldId=true`;const r=await fetch(u,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body&&JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Error('AIRTABLE_'+r.status+':'+t.slice(0,200));return JSON.parse(t)}
async function main(){const token=process.env.AIRTABLE_TOKEN;if(!token)throw Error('AIRTABLE_TOKEN_REQUIRED');const before=await req(token,'GET');const d=v(before.fields||{});if(process.env.GITHUB_OUTPUT)require('fs').appendFileSync(process.env.GITHUB_OUTPUT,'decision='+d+'\n');if(d==='REPLAY'){console.log('DISPATCH_REPLAY');return}if(d==='RESUME'){console.log('DISPATCH_RESUME '+C.id);return}await req(token,'PATCH',{fields:{[C.fields.status]:'CLAIMED',[C.fields.attempt]:C.exec,[C.fields.claimed]:'Cybertron READY Dispatcher v0.2'}});console.log('DISPATCH_CLAIMED '+C.id)}
module.exports={C,v,req,main};if(require.main===module)main().catch(e=>{console.error(e.message);process.exit(1)});
