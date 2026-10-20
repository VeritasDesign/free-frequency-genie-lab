// Source-only durable state core. NOT a deployed Worker or complete pairing service.
// Storage is a Cloudflare Durable Object storage-compatible interface.
const MAX_RECEIPTS = 128; // Bounded replay protection; older IDs may be accepted again after eviction.
const validLetter = letter => typeof letter === 'string' && /^[A-Z]$/.test(letter);
const validEvent = event => typeof event === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(event);
export class DurableCommandCore {
  constructor(storage, now = () => Date.now()) { this.storage = storage; this.now = now; }
  async select({letter, clientEventId}) {
    if (!validLetter(letter)) return {status:400,error:'invalid_animal'};
    if (!validEvent(clientEventId)) return {status:400,error:'invalid_event_id'};
    // Durable Objects serialize requests for a single receiver; transaction
    // preserves the command counter and dedupe receipt across restarts.
    return this.storage.transaction(async tx => {
      if (await tx.get('revoked')) return {status:403,error:'receiver_revoked'};
      const receiptKey = 'event:' + clientEventId;
      const prior = await tx.get(receiptKey);
      if (prior) {
        if (prior.letter !== letter) return {status:409,error:'event_id_conflict'};
        return {status:200,commandId:prior.commandId,letter,deduplicated:true};
      }
      const next = (await tx.get('commandId') || 0) + 1;
      if (!Number.isSafeInteger(next)) return {status:503,error:'counter_exhausted'};
      const command = {commandId:next,letter};
      await tx.put('commandId',next);
      await tx.put('latestCommand',command);
      await tx.put(receiptKey,{...command,createdAt:this.now()});
      // Cap durable receipt growth even if a tablet sends thousands of unique taps.
      const receiptQueue = (await tx.get('receiptQueue')) || [];
      receiptQueue.push(clientEventId);
      if (receiptQueue.length > MAX_RECEIPTS) {
        const evicted = receiptQueue.shift();
        await tx.delete('event:' + evicted);
      }
      await tx.put('receiptQueue',receiptQueue);
      return {status:200,...command,deduplicated:false};
    });
  }
  async poll(after) {
    if (!Number.isSafeInteger(after) || after < 0) return {status:400,error:'invalid_cursor'};
    if (await this.storage.get('revoked')) return {status:403,error:'receiver_revoked'};
    const command = await this.storage.get('latestCommand');
    return {status:200,command:command && command.commandId > after ? command : null};
  }
  async revoke() {
    await this.storage.put('revoked',true);
    return {status:200,revoked:true};
  }
}
// Authentication, owner-approved provisioning, one-time pairing, credential
// hashing/rotation, TTL cleanup, rate limiting, and media allowlists MUST be
// implemented and reviewed in the HTTP/DO wrapper before any deployment.
