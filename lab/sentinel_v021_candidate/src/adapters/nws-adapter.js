const decodeEnvelope = envelope => {
  if(!envelope?.representation?.bytes) throw new Error('Missing NWS representation');
  const bin=atob(envelope.representation.bytes); const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};
const get=async params=>{
  const res=await fetch(`/api/nws?${new URLSearchParams(params)}`,{headers:{Accept:'application/json'}});
  const envelope=await res.json();
  if(!res.ok||!envelope.ok) throw new Error(envelope.error||`NWS transport ${res.status}`);
  return {data:decodeEnvelope(envelope),evidence:envelope};
};
const featureProps=f=>f?.properties||{};
export class NwsAdapter{
  async zone(type,id){const r=await get({op:'zone',type,id}); return {feature:r.data,evidence:r.evidence};}
  async alerts(zone){const r=await get({op:'alerts',zone}); return {features:r.data?.features||[],evidence:r.evidence};}
  async point(lat,lon){const r=await get({op:'point',lat:String(lat),lon:String(lon)}); return {data:r.data,evidence:r.evidence};}
  async forecast(office,x,y){const r=await get({op:'forecast',office,x:String(x),y:String(y)}); return {data:r.data,evidence:r.evidence};}
  normalizeAlert(f,evidence,area){
    const p=featureProps(f), id=String(p.id||f.id||crypto.randomUUID());
    return {id:`nws:${id}`,sourceId:id,kind:'nws',origin:'real',title:p.event||p.headline||'NWS alert',headline:p.headline||p.event||'NWS alert',kicker:'NWS OFFICIAL SOURCE · REAL',summary:p.description||'No source description supplied.',instruction:p.instruction||'',issuer:p.senderName||p.sender||'National Weather Service',areaDesc:p.areaDesc||area.name||area.id,severity:p.severity||'Unknown',urgency:p.urgency||'Unknown',certainty:p.certainty||'Unknown',sent:p.sent||null,effective:p.effective||null,onset:p.onset||null,expires:p.expires||null,ends:p.ends||null,status:p.status||'Unknown',messageType:p.messageType||'Unknown',references:p.references||[],geometry:f.geometry||null,provenance:`NWS official source · selected zone ${area.id}`,time:`Retrieved ${evidence.upstream?.responseReceived||'time unknown'}`,retrieval:evidence.upstream||{},representationSha256:evidence.representation?.sha256||null,sourceUrl:evidence.upstream?.url||null,areaVersion:area.version};
  }
}
