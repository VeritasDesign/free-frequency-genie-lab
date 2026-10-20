// Source-only request router for a SINGLE receiver. Not a public server.
// All public deployment gates (durable routing, trusted owner provisioning,
// rate limiting, Cloudflare runtime adaptation) are deliberately absent.
export function createBridgeRouter(session,{receiverId}){
  const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
  const bearer=req=>/^Bearer ([A-Za-z0-9_-]{20,})$/.exec(req.headers.get('authorization')||'')?.[1]||'';
  return async req=>{
    const url=new URL(req.url);
    const path=url.pathname;
    if(!url.protocol.startsWith('https:'))return json(400,{error:'https_required'});
    if(!['GET','POST'].includes(req.method))return json(405,{error:'method_not_allowed'});
    const routes={
      '/api/pair/start':'POST','/api/pair/confirm':'POST',
      '/api/pair/complete':'POST','/api/animal/select':'POST',
      '/api/receiver/next':'GET','/api/pair/revoke':'POST'
    };
    if(!routes[path])return json(404,{error:'not_found'});
    if(req.method!==routes[path])return json(405,{error:'method_not_allowed'});
    if(url.searchParams.has('receiverId')&&url.searchParams.get('receiverId')!==receiverId)return json(404,{error:'not_found'});
    let body={};
    if(req.method==='POST'){
      if(Number(req.headers.get('content-length')||0)>2048)return json(413,{error:'body_too_large'});
      try{
        const raw=await req.text();
        if(raw.length>2048) return json(413,{error:'body_too_large'});
        body=JSON.parse(raw||'{}');
        if(!body||typeof body!=='object'||Array.isArray(body))throw Error('bad');
      }catch{return json(400,{error:'invalid_body'});}
    }
    if(body.receiverId&&body.receiverId!==receiverId)return json(404,{error:'not_found'});
    let result;
    if(path==='/api/pair/start')result=await session.startPairing(bearer(req));
    else if(path==='/api/pair/confirm')result=await session.confirmPairing(bearer(req));
    else if(path==='/api/pair/complete')result=await session.completePairing(body.code);
    else if(path==='/api/animal/select')result=await session.select(bearer(req),{letter:body.letter,clientEventId:body.clientEventId});
    else if(path==='/api/receiver/next')result=await session.poll(bearer(req),Number(url.searchParams.get('after')||0));
    else if(path==='/api/pair/revoke')result=await session.revoke(bearer(req));
    return json(result.status,result);
  };
}
// Never mount this directly to a public Worker. Pair completion still needs
// global code→receiver lookup with throttling and origin/CORS policy. The Roku
// cannot use this module until the secure production routing layer exists.
