import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRelay} from './server.mjs';

test('pair, select, repeat, reject unauthorized, revoke',async()=>{
  let clock=1000;
  const relay=createRelay({now:()=>clock,origin:'http://localhost:8788'});
  const server=createServer((req,res)=>relay.handle(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const call=async(path,method='GET',body,auth)=>{
    const res=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(auth?{authorization:'Bearer '+auth}:{})},body:body?JSON.stringify(body):undefined});
    return {status:res.status,data:await res.json()};
  };
  try{
    const start=await call('/api/pair/start','POST',{});
    assert.equal(start.status,201);
    assert.match(start.data.code,/^\d{6}$/);
    const {receiverId,receiverToken,code}=start.data;
    assert.equal((await call('/api/animal/select','POST',{receiverId,letter:'B'},'bad')).status,401);
    const paired=await call('/api/pair/complete','POST',{code});
    assert.equal(paired.status,200);
    assert.equal((await call('/api/pair/complete','POST',{code})).status,404);
    const sender=paired.data.senderToken;
    const first=await call('/api/animal/select','POST',{receiverId,letter:'B'},sender);
    const second=await call('/api/animal/select','POST',{receiverId,letter:'B'},sender);
    assert.equal(first.data.commandId,1);assert.equal(second.data.commandId,2);
    assert.equal((await call('/api/receiver/next?receiverId='+receiverId+'&after=0','GET',null,'bad')).status,401);
    const next=await call('/api/receiver/next?receiverId='+receiverId+'&after=1','GET',null,receiverToken);
    assert.deepEqual(next.data.command,{commandId:2,letter:'B'});
    assert.equal((await call('/api/receiver/next?receiverId='+receiverId+'&after=2','GET',null,receiverToken)).data.command,null);
    assert.equal((await call('/api/animal/select','POST',{receiverId,letter:'https://bad'},sender)).status,400);
    assert.equal((await call('/api/pair/revoke','POST',{receiverId},sender)).data.revoked,true);
    assert.equal((await call('/api/receiver/next?receiverId='+receiverId+'&after=0','GET',null,receiverToken)).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('pair code expires',async()=>{
  let clock=0;const relay=createRelay({now:()=>clock});
  const server=createServer((req,res)=>relay.handle(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port;
    const start=await (await fetch(base+'/api/pair/start',{method:'POST',body:'{}'})).json();
    clock=120001;
    const res=await fetch(base+'/api/pair/complete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:start.code})});
    assert.equal(res.status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});


test('optional receiver bootstrap secret rejects anonymous and incorrect requests',async()=>{
  const relay=createRelay({bootstrapSecret:'test-only-local-bootstrap-secret'});
  const server=createServer((req,res)=>relay.handle(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port+'/api/pair/start';
    const call=async(auth)=>fetch(base,{method:'POST',headers:auth?{authorization:'Bearer '+auth}:{},body:'{}'});
    assert.equal((await call()).status,401);
    assert.equal((await call('wrong')).status,401);
    const ok=await call('test-only-local-bootstrap-secret');
    assert.equal(ok.status,201);
    const data=await ok.json();
    assert.match(data.code,/^\d{6}$/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
