export const STATES=Object.freeze({BACKLOG:"BACKLOG",ELIGIBLE:"ELIGIBLE",CLAIMED:"CLAIMED",RUNNING:"RUNNING",VERIFYING:"VERIFYING",COMPLETE:"COMPLETE",BLOCKED:"BLOCKED",FAILED:"FAILED",ACCEPTED:"ACCEPTED"});
export function validateWorkOrder(w){
 const req=["task_id","execution_id","task_class","objective","scope","acceptance_contract"];
 for(const k of req) if(!w?.[k]) throw new Error("WORK_ORDER_INVALID:"+k);
 if(w.production_authority!==false) throw new Error("PRODUCTION_AUTHORITY_FORBIDDEN");
 return true;
}
export function completeReceipt(w,worker,evidence=[]){validateWorkOrder(w);return {task_id:w.task_id,execution_id:w.execution_id,worker_id:worker,result:"COMPLETE",evidence,production_modified:false};}
export function verify(w,r){
 validateWorkOrder(w);
 if(!r||r.task_id!==w.task_id||r.execution_id!==w.execution_id) return {status:"INSUFFICIENT_EVIDENCE",reason:"identity"};
 if(r.result!=="COMPLETE"||r.production_modified!==false) return {status:"REJECTED",reason:"result_or_authority"};
 const required=w.acceptance_contract.required_evidence||[];
 const kinds=new Set((r.evidence||[]).map(x=>x.kind));
 const missing=required.filter(x=>!kinds.has(x));
 return missing.length?{status:"INSUFFICIENT_EVIDENCE",reason:"missing",missing}:{status:"ACCEPTED"};
}
export function applyAcceptance(state,w,decision){
 const seen=state.executions[w.execution_id];
 if(seen) return {state,duplicate:true};
 const next=structuredClone(state); next.executions[w.execution_id]=decision.status;
 if(decision.status==="ACCEPTED"){
   next.tasks[w.task_id]="ACCEPTED";
   for(const id of (w.unlocks||[])) if(next.tasks[id]==="BACKLOG") next.tasks[id]="ELIGIBLE";
 }
 return {state:next,duplicate:false};
}
