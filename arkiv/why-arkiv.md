# Why Arkiv

Odsy sells real-world sensor data to AI labs. A lab's first question is "can I trust this?": was it captured by a real device, by a real human, at that place and time, and has nobody changed it since? Arkiv is where we keep the answer.

## If we swapped Arkiv for Postgres, users would lose

1. **Tamper evidence they can check themselves.** Samples are `readonly` entities. In Postgres the operator (us) could edit a row, relabel a location or swap a payload, and a lab would never know. On Arkiv the row and its device signature are fixed at capture, and the write is a transaction anyone can look up.
2. **Reading without asking us.** A lab's ingest job ([`scripts/lab-ingest.ts`](../web-monorepo/apps/web/scripts/lab-ingest.ts)) reads metadata and ciphertext straight from Arkiv, filtered by `$owner = gateway`, and asks our server for one thing only: decryption keys. If our gateway is down, the index is still there. With Postgres every read goes through our API, and we can show each lab a different version of the data.
3. **Proof of who wrote it.** `$owner` is the gateway wallet. A lab pins that address and knows every row came through our signature and World ID checks. With Postgres there is no owner on a row, only our word.
4. **Retention as a rule, not a promise.** Expiration is part of the entity. Duplicates and banned data expire on a schedule anyone can see (`$expiresAt`); there is no hidden delete job and no "we kept it just in case". Contributors can check that their best capture was extended.
5. **Open composability.** Another app (a robotics lab's own viewer, a map, a reputation service for devices) can query `odsy.samples` by geohash today without an API key from us.

## What we kept off Arkiv, and why

| Kept off | Where it lives | Why |
|---|---|---|
| Payloads over 96 KiB (video, longer audio) | 0G Storage; only the root is on Arkiv | Entity size limit and cost per byte. The Arkiv row still pins the content hash |
| Plaintext payloads and sensor readings | Encrypted (AES-256-GCM) before they reach Arkiv | Data is sold; public plaintext would give it away. Per-sample keys only go to paying wallets |
| `DATA_KEY` and decryption keys | Gateway env, handed out per sample by `POST /api/keys` | Secrets; deleting the key is our crypto-shredding path |
| Payments, subscription periods, reward claims | `OdsySubscriptions` contract on 0G Galileo | Money needs a contract that holds funds and enforces the 70/30 split. Arkiv only stores the reward leaves so claimants can get proofs |
| Strikes and bans | `ConsensusRegistry` contract on 0G Galileo | Bans must be enforced by validator median on-chain, not by the gateway alone |
| Sessions, nonces, MCP tokens | Signed cookies / bearer tokens | Short-lived, private, no reason to be public |
| Testimonials | In memory (see `lib/testimonials.ts`) | Marketing copy, not data anyone needs to query or verify |
