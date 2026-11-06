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

## Prize: Best Use of IDKit

| World requires | How Odyssey meets it | Code |
|---|---|---|
| IDKit in a working app | `/enroll` uses `IDKitRequestWidget`; the result is posted to `POST /api/enroll` | [`enroll/page.tsx:124`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/%28app%29/enroll/page.tsx#L124) |
| A World ID credential verified on the server | Proof of Human (`orbLegacy`), verified against `developer.worldcoin.org` v4 with an RP-signed request | [`enroll/route.ts:46`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L46) |
| The trust moment and why this credential is enough | Registering a device: every reward, the 70/30 split and the two-strike ban assume one human per device. We need only "a unique human who has not enrolled a device", so Proof of Human is the minimum; a passport or selfie check would collect more than we use | see *Why this credential* above |
| A success and one meaningful alternative path | Success registers the device with the signed-in wallet as payout. Alternatives: cancel or IDKit error (banner, nothing registered), proof for another device (`400`), device or human already enrolled (`409`), banned human (`403`) | [`enroll/page.tsx:135`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/%28app%29/enroll/page.tsx#L135), [`enroll/route.ts:40`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L40), [`enroll/route.ts:42`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L42), [`enroll/route.ts:44`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L44) |
| An integration debrief | Below | |

## Integration debrief

What the code shows we ran into:

- **Nullifier formats differ by version.** v3 nullifiers are hex and v4 are decimal; we normalise to hex before storing ([`enroll/route.ts:54`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L54)).
- **Environment must match.** A staging app only accepts proofs from `simulator.worldcoin.org`, and real World App proofs need production; a mismatch fails as a rejected proof ([`enroll/route.ts:11`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L11)).
- **Binding a proof to a device** needed the signal to be the device address and a server-side check of `signal_hash` ([`enroll/route.ts:40`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/enroll/route.ts#L40)).

The team adds time to first success and the one improvement that would help most after the live run ([PRIZES.md](../PRIZES.md#integration-debrief-fill-in-after-the-live-run)).

## Status

Built on World ID v4 with an RP-signed request and verified against the developer portal, but not yet live-tested end to end by us. The ban contract was run live; the gateway ban path is not yet end to end.
