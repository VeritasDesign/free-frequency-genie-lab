// Source-only authenticated durable receiver logic. NOT a deployed HTTP service.
// Caller must authenticate owner-authorized receiver provisioning before constructing
// a receiver and must enforce request/body/rate limits at the HTTP boundary.
import {createHash, randomBytes, randomInt, timingSafeEqual} from 'node:crypto';
import {DurableCommandCore} from './durable-core.mjs';
const digest = x => createHash('sha256').update(x).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const equal = (a,b) => {
  if(typeof a!=='string'||typeof b!=='string')return false;
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
};
export class DurableReceiverSession {
  constructor(storage,{now=()=>Date.now(),pairingTtlMs=120000}={}) {
    this.storage=storage;this.now=now;this.pairingTtlMs=pairingTtlMs;
    this.commands=new DurableCommandCore(storage,now);
  }
  async register({ownerAuthorized=false}={}) {
    if(!ownerAuthorized)return {status:403,error:'owner_authorization_required'};
    return this.storage.transaction(async tx=>{
      if(await tx.get('receiverHash'))return {status:409,error:'already_registered'};
      const receiverToken=token();
      await tx.put('receiverHash',digest(receiverToken));
      await tx.put('revoked',false);
      return {status:201,receiverToken};
    });
  }
  async startPairing(receiverToken) {
    return this.storage.transaction(async tx=>{
      if(await tx.get('revoked'))return {status:403,error:'receiver_revoked'};
      if(!equal(await tx.get('receiverHash'),digest(receiverToken||'')))return {status:401,error:'unauthorized'};
      const code=String(randomInt(0,1000000)).padStart(6,'0');
      await tx.put('pairingHash',digest(code));
      await tx.put('pairingExpiry',this.now()+this.pairingTtlMs);
      await tx.put('pairingConfirmed',false);
      await tx.put('pairingAttempts',0);
      return {status:200,code,expiresInSeconds:Math.ceil(this.pairingTtlMs/1000)};
    });
  }
  async confirmPairing(receiverToken) {
    return this.storage.transaction(async tx=>{
      if(await tx.get('revoked'))return {status:403,error:'receiver_revoked'};
      if(!equal(await tx.get('receiverHash'),digest(receiverToken||'')))return {status:401,error:'unauthorized'};
      if(!(await tx.get('pairingHash'))||this.now()>=await tx.get('pairingExpiry'))return {status:410,error:'pairing_expired'};
      await tx.put('pairingConfirmed',true);
      return {status:200,confirmed:true};
    });
  }
  async completePairing(code) {
    return this.storage.transaction(async tx=>{
      if(await tx.get('revoked'))return {status:403,error:'receiver_revoked'};
      if(typeof code!=='string'||!/^\d{6}$/.test(code))return {status:400,error:'invalid_code'};
      const hashed=await tx.get('pairingHash');
      if(!hashed||this.now()>=await tx.get('pairingExpiry'))return {status:404,error:'invalid_or_expired_code'};
      const attempts=await tx.get('pairingAttempts')||0;
      if(attempts>=5)return {status:429,error:'pairing_attempts_exhausted'};
      if(!equal(hashed,digest(code))){
        await tx.put('pairingAttempts',attempts+1);
        return {status:404,error:'invalid_or_expired_code'};
      }
      if(!await tx.get('pairingConfirmed'))return {status:409,error:'tv_confirmation_required'};
      const senderToken=token();
      await tx.put('senderHash',digest(senderToken));
      await tx.delete('pairingHash');
      await tx.delete('pairingExpiry');
      await tx.delete('pairingConfirmed');
      await tx.delete('pairingAttempts');
      return {status:200,senderToken};
    });
  }
  async select(senderToken,request) {
    if(await this.storage.get('revoked'))return {status:403,error:'receiver_revoked'};
    if(!equal(await this.storage.get('senderHash'),digest(senderToken||'')))return {status:401,error:'unauthorized'};
    return this.commands.select(request);
  }
  async poll(receiverToken,after) {
    if(await this.storage.get('revoked'))return {status:403,error:'receiver_revoked'};
    if(!equal(await this.storage.get('receiverHash'),digest(receiverToken||'')))return {status:401,error:'unauthorized'};
    return this.commands.poll(after);
  }
  async revoke(receiverToken) {
    if(!equal(await this.storage.get('receiverHash'),digest(receiverToken||'')))return {status:401,error:'unauthorized'};
    return this.commands.revoke();
  }
}
// WARNING: This is Node test scaffolding, not a Cloudflare Worker implementation.
// A production DO needs Web Crypto, owner-controlled provisioning, per-IP/receiver
// throttling, durable pairing-code lookup, expiry/cleanup, and security review.
