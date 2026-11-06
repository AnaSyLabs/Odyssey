# Arkiv: how Odyssey uses it

Arkiv is Odyssey's data layer. Every capture from the glasses, every registered device, every dataset and every reward epoch is an Arkiv entity, so the whole state of the network is public and queryable. Diagrams and a demo path: [TRACKS.md, Arkiv](../TRACKS.md#arkiv-the-data-layer).

Code links point at commit `4c4aa82` so the line numbers stay right.

## Where the code uses Arkiv

| What | How | Code |
|---|---|---|
| Entity types | Six typed schemas: `odsy.samples`, `odsy.devices`, `odsy.datasets`, `odsy.subscriptions`, `odsy.rewards`, `odsy.admins` | [`schema.ts:5`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/schema.ts#L5) (Samples), [`schema.ts:28`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/schema.ts#L28) (Devices), [`schema.ts:37`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/schema.ts#L37) (Datasets), [`schema.ts:61`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/schema.ts#L61) (Rewards) |
| One entity per capture | `POST /api/ingest` checks the device signature, then writes a readonly sample entity: device, World ID, geohash, time, content hash, signature, encrypted payload | [`ingest/route.ts:47`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/ingest/route.ts#L47) (signature), [`ingest/route.ts:85`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/ingest/route.ts#L85) (`createEntity`) |
| Duplicate check | Before writing, query Arkiv for a sample with the same content hash owned by the gateway | [`ingest/route.ts:55`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/ingest/route.ts#L55) |
| Payload limit | Up to 96 KiB is stored inline in the entity; larger payloads go to 0G Storage with the root kept on Arkiv | [`ingest/route.ts:18`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/ingest/route.ts#L18), [`ingest/route.ts:84`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/ingest/route.ts#L84) |
| Encryption | AES-256-GCM per sample, key derived from the content hash; proof stays public, data stays private | [`crypto.ts:17`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/crypto.ts#L17) |
| Device registry | Enrollment writes an `odsy.devices` entity with the World ID and payout wallet, never expiring | [`arkiv.ts:55`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/arkiv.ts#L55) (`registerDevice`), [`arkiv.ts:71`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/arkiv.ts#L71) |
| Geo search | Geohash index (about 4.8 m cells); a circle is covered by geohash prefixes and queried on Arkiv | [`geo.ts:43`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/geo.ts#L43) (`coverCircle`), [`query.ts:12`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/query.ts#L12) (`findSamples`) |
| Paid access | Active subscriptions are read from Arkiv by subscriber and `paidUntil` | [`access.ts:16`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/access.ts#L16) |
| Retention | A daily job extends only the samples worth keeping (one per device, cell and time window) and lets the rest and banned data expire | [`cron/extend/route.ts:29`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/app/api/cron/extend/route.ts#L29), [`retention.ts:11`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/retention.ts#L11) |
| AI access | The MCP server's `list_datasets`, `search_samples` and `get_sample` tools read the same Arkiv entities | [`mcp.ts:37`](https://github.com/AnaSyLabs/Odyssey/blob/4c4aa82961f61a6da434d7895f5f10e2f3605d89/web-monorepo/apps/web/lib/mcp.ts#L37) |

## Status

Samples, the device registry, datasets and geo search are live-tested on Rabdi. Reward epochs have not been run live, and the retention job is built but not scheduled yet.
