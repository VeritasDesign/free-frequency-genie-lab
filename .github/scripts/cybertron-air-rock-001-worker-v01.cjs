'use strict';
const {createHash}=require('node:crypto');
const C=Object.freeze({
 base:'app01sBuNbRyjVt47',table:'tbl3ZPAJF3FvbR90p',record:'recqLDb65ZOQyKxnl',
 id:'AIR-ROCK-001',task:'harmless-hash',payload:'KAW',step:1,max:1,
 attempt:'AIR-ROCK-001-SCHEDULED-V01',owner:'Cybertron ROCK Scheduled Worker v0.1',
 next:'Fresh scheduled worker must compute SHA-256 of literal payload KAW, write a durable receipt/result, mark COMPLETE, and terminate. No external or production actions.',
 fields:{id:'fldn5b6yeYYRMPSaM',status:'fldgOSvL9pxpNRL2I',task:'fldHLUnihNBexSkZn',
 payload:'fldlnFmNjotAB08qm',step:'fldZz2dIKt7hoxxdD',max:'fldNVK0fO1mlCvRVJ',
 attempt:'fldyMDCSTEW46XKZV',claimed:'fldjB7m1c9jaMhNKR',
 receipt:'fldO9RGHuCX7Bv0q0',result:'flde4kea7ckvPVn2g',next:'fldTpHDML0gVrtGk5'}
});
const digest=createHash('sha256').update(Buffer.from(C.payload,'utf8')).digest('hex');
function decision(f){
 const get=k=>f[C.fields[k]]??'';
 const status=v=>typeof v==='object'&&v!==null?v.name:v;
 if(get('id')!==C.id||get('task')!==C.task||get('payload')!==C.payload||get('step')!==C.step||get('max')!==C.max)throw Error('CONTRACT_MISMATCH');
 const s=status(get('status'));
 if(s==='COMPLETE'){
   if(get('attempt')!==C.attempt||get('claimed')!==C.owner||get('result')!==digest)throw Error('FOREIGN_COMPLETE');
   const receipt=JSON.parse(get('receipt'));
   if(receipt.work_order!==C.id||receipt.attempt!==C.attempt||receipt.worker!==C.owner||receipt.sha256!==digest||receipt.algorithm!=='SHA-256'||receipt.encoding!=='UTF-8'||receipt.bytes!==3||receipt.production_write!==false||receipt.deploy!==false)throw Error('INVALID_RECEIPT');
   return 'REPLAY';
 }
 if(s==='CLAIMED'&&get('attempt')===C.attempt&&get('claimed')===C.owner){
   if(get('result')||get('receipt')||get('next')!==C.next)throw Error('CLAIMED_STATE_TAMPERED');
   return 'RESUME';
 }
 if(get('next')!==C.next)throw Error('NEXT_ACTION_MISMATCH');
 if(s!=='READY'||get('attempt')||get('claimed')||get('receipt')||get('result'))throw Error('NOT_CLAIMABLE');
 return 'CLAIM';
}
async function request(method,fields){
 const token=process.env.AIRTABLE_TOKEN;
 if(!token)throw Error('AIRTABLE_TOKEN_REQUIRED');
 const url='https://api.airtable.com/v0/'+C.base+'/'+C.table+'/'+C.record+'?returnFieldsByFieldId=true';
 const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(fields?{body:JSON.stringify({fields})}:{})});
 const body=await r.text();if(!r.ok)throw Error('AIRTABLE_'+r.status+':'+body.slice(0,160));
 return JSON.parse(body).fields;
}
async function main(){
 let f=await request('GET');let d=decision(f);
 if(d==='REPLAY'){console.log('ROCK_REPLAY');return;}
 if(d==='CLAIM'){
   await request('PATCH',{[C.fields.status]:'CLAIMED',[C.fields.attempt]:C.attempt,[C.fields.claimed]:C.owner});
   f=await request('GET');if(decision(f)!=='RESUME')throw Error('CLAIM_READBACK_FAILED');
 }
 const receipt=JSON.stringify({work_order:C.id,attempt:C.attempt,worker:C.owner,algorithm:'SHA-256',encoding:'UTF-8',bytes:3,sha256:digest,production_write:false,deploy:false});
 await request('PATCH',{[C.fields.status]:'COMPLETE',[C.fields.result]:digest,[C.fields.receipt]:receipt,[C.fields.next]:'Verified harmless hash completed; no further action.'});
 f=await request('GET');if(decision(f)!=='REPLAY')throw Error('COMPLETION_READBACK_FAILED');
 console.log('ROCK_COMPLETE '+digest);
}
module.exports={C,digest,decision,main};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
