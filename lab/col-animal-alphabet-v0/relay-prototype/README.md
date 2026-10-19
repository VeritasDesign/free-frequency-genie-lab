# Col's Animal Alphabet — volatile local relay proof

**Not deployed. Not production ready.** Uses only Node built-in libraries. Start with Node >=20: `npm test` and `npm start`. Server listens on **127.0.0.1** only, not accessible to the Roku or Fire tablet.

This is a bounded protocol exercise before selecting approved durable HTTPS hosting. The server stores pairing codes, tokens, and latest command **in RAM**; restart loses everything. Do not put this on a public hostname. There is no persistent database, no account owner verification, and no protection against a malicious party who obtains a pairing code; further security work required.

Protocol: `POST /api/pair/start` → code + receiver credential; `POST /api/pair/complete` → sender credential; `POST /api/animal/select` → increasing commandId; `GET /api/receiver/next` → command; `POST /api/pair/revoke` → revocation. The server restricts animal IDs to A–Z, requires bearer tokens for control and polling, rejects disallowed browser origins, limits body size and rate, expires codes in two minutes and paired sessions after 24h.

**Not yet done:** persistent storage, atomic counters across instances, deployment, independent security review, Roku Task client, tablet sender UI, animal media catalog. A real paired service needs HTTPS, durable state, secure provisioning and an explicit cost/authorization gate. Keep the public PWA and all existing production Workers unchanged until the isolated service is ready.
