const fs=require('fs');
const s=fs.readFileSync('.github/workflows/cybertron-factory-bounded-dispatch-v01.yml','utf8');
for(const x of ["listing-agent-lifecycle","listing-agent-dynamic-item-specifics","production_write!==false","deploy!==false","execution_authority!=='NONE'","status:'MATCHED'","execution_authority:'NONE'"]){
 if(!s.includes(x)) throw new Error('missing '+x);
}
if(s.includes("status:'CLAIMED'")) throw new Error('dispatcher must not claim execution');
console.log('bounded dispatcher static gates PASS');
