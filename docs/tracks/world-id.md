# World ID: how Odyssey uses it

World ID gives Odyssey one human per device: a pair of glasses can only be enrolled by a verified human, one human can enroll only one device, and two provable strikes ban the human, not just the key. Diagrams and a demo path: [TRACKS.md, World ID](../TRACKS.md#world-id-one-human-one-device).

Code links point at commit `4c4aa82` so the line numbers stay right.

## Where the code uses World ID

| What | How | Code |
|---|---|---|
| IDKit on `/enroll` | `IDKitRequestWidget` with the `orbLegacy` preset; the signal is the glasses' address | [`enroll/page.tsx:124`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/%28app%29/enroll/page.tsx#L124), [`enroll/page.tsx:132`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/%28app%29/enroll/page.tsx#L132) (signal) |
| Errors shown to the user | A cancelled or failed proof shows `World ID error: <code>`; nothing is registered | [`enroll/page.tsx:135`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/%28app%29/enroll/page.tsx#L135) |
| Right action only | The server accepts only `register-device` proofs | [`enroll/route.ts:37`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L37) |
| Proof bound to the device | The proof's signal hash must equal the device address, so a proof for one pair cannot enroll another | [`enroll/route.ts:40`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L40) |
| One device, one human | Same device again: `409`. Banned human: `403` | [`enroll/route.ts:42`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L42), [`enroll/route.ts:44`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L44) |
| Server-side verification | The proof is verified against `developer.worldcoin.org` (v4, RP-signed request) | [`enroll/route.ts:46`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L46) |
| Device bound to the nullifier | The nullifier is stored as the device's `worldId`, with the signed-in wallet as payout | [`enroll/route.ts:55`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L55), [`arkiv.ts:55`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/arkiv.ts#L55) (`registerDevice`) |
| Every sample carries its human | Each sample entity stores the World ID that captured it | [`schema.ts:5`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/schema.ts#L5) |
| Two strikes ban the World ID | Uploads from a banned World ID are refused, and its data from the first strike on is unreadable | [`ingest/route.ts:51`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/ingest/route.ts#L51), [`consensus.ts:25`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/consensus.ts#L25), [`access.ts:47`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/access.ts#L47) |

## Why this credential

We need one fact: this is a unique human who has not enrolled a device before. No name, age or document. The `orbLegacy` preset gives a per-app nullifier, and that nullifier is all we store.

## Status

Built on World ID v4 with an RP-signed request and verified against the developer portal, but not yet live-tested end to end by us. The ban contract was run live; the gateway ban path is not yet end to end.
