# How we use Arkiv

Odsy is a marketplace for first-person, real-world data (glasses, phones, sensors) sold to AI labs. Arkiv is the **index and registry** behind every live page: it answers "which samples exist, where, from which device and human, and who may read them". Schemas: [schema.md](schema.md).

## What we filter on, and why

| Query | Arkiv filter | User sees it in |
|---|---|---|
| Samples near a point | `startsWith("geohash", cell)` on up to 4 covering cells, then exact haversine in the app ([`lib/geo.ts`](../web-monorepo/apps/web/lib/geo.ts), [`lib/query.ts`](../web-monorepo/apps/web/lib/query.ts)) | `/explore` map search, `/datasets/{key}` hex map |
| Samples in a dataset | geohash + `eq("kind")`, `eq("deviceType")`, `between("capturedAt")` ([`lib/filters.ts`](../web-monorepo/apps/web/lib/filters.ts)) | Dataset sample counts and previews on `/datasets` |
| Is this upload a duplicate? | `eq("contentHash")` | `409 duplicate` on `POST /api/ingest`; a replay by another human raises a strike |
| Is this device registered? | `eq("device")` on `odsy.devices` | Ingest refuses unregistered glasses (`403`) |
| One human, one device | `eq("worldId")` on `odsy.devices` | `/enroll` refuses a second device for the same World ID |
| A device's captures | `eq("device")` on `odsy.samples` | `/capture` and `GET /api/devices` |
| Datasets for sale | `eq("active", true)` on `odsy.datasets` | `/datasets` marketplace |
| Who is admin | `eq("admin")` on `odsy.admins` | `/admin`, admin-only actions everywhere |
| What expires soon | `lt("$expiresAt", soon)` | Retention job; `expiresAtBlock` shown with each sample |
| Recent gateway writes | Arkiv entity events on `0x4400…0044` | `/activity` "recent Arkiv writes" with tx hashes |

All of them add `.ownedBy(gateway)`, so a row copied by someone else under our schema tag never shows up.

## Who can edit each entity

| Entity | Owner | Editable? | Why it fits |
|---|---|---|---|
| `odsy.samples` | Gateway | **No.** `readonly: true` | A lab pays for data that cannot be quietly changed after capture. Readonly means not even we can relabel it. |
| `odsy.devices` | Gateway | Payout wallet only | Binding a device to a World ID is done once, after a proof. |
| `odsy.datasets` | Gateway | `active` flag | Admins list and unlist; the filter itself stays what labs paid for. |
| `odsy.rewards` | Gateway | No | Leaves must match the Merkle root on the contract. |
| `odsy.admins` | Gateway | Deleted on revoke | Revoking is a delete, so the list is always current. |

The gateway owns everything because it is the party that checks device signatures and World ID proofs before writing. The device signature is stored on each sample, so anyone can re-check it without trusting the gateway (`scripts/lab-ingest.ts` does).

## When it expires

- **Samples:** written at max lifetime (~182 days). A daily job keeps **one** sample per device, geohash-7 cell (~150 m) and hour, and lets the rest expire ([`app/api/cron/extend`](../web-monorepo/apps/web/app/api/cron/extend/route.ts), [`lib/retention.ts`](../web-monorepo/apps/web/lib/retention.ts)). Ten near-identical frames from the same corner thin down to one, and storage cost follows useful data, not upload volume.
- **Banned data:** samples from a World ID with two strikes are never extended, so they drop off Arkiv on their own.
- **Legacy subscriptions:** not extended. They exist for a paid period and then disappear.
- **Devices, datasets, reward epochs, admin grants:** extended every day while they matter.

Labs that want data for longer than Arkiv keeps it run `scripts/lab-ingest.ts`, which uses `$expiresAt` as its sync cursor: new and extended samples always carry the latest one, so incremental syncs never miss a row.

## Does each feature change something users see?

| Arkiv feature | What changes for the user |
|---|---|
| Indexed attributes + `startsWith` | Map search on `/explore` returns nearest samples in one round of queries |
| `ownedBy` | Labs only ever see data the Odsy gateway verified |
| `readonly` flag | The "signature proof" panel on each sample means something: the row can't be edited |
| Expiration + extend | Contributors' unique captures stay; duplicates and banned data disappear without a delete job |
| `$expiresAt` | Shown per sample; the lab ingest cursor |
| Entity events | `/activity` lists recent gateway writes with tx hashes |
| Public reads | The Odsy MCP server (`list_datasets`, `search_samples`, `get_sample`) and `lab-ingest.ts` read straight from Arkiv |
