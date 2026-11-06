# Arkiv schema

Odsy stores its sample index, device registry, datasets, reward epochs and admin grants on Arkiv's **Rabdi** testnet. Schemas are defined once in [`web-monorepo/apps/web/lib/schema.ts`](../web-monorepo/apps/web/lib/schema.ts) with `defineSchema` from `@arkiv-network/sdk/schema`, and shared by the gateway, the cron job and the Node scripts.

**Writer.** Every entity is written by one gateway wallet: `0x51f18a28F4C17121770782aC95B9baAf6257053a`. Anyone can write an entity with the same schema tag, so every read adds `.ownedBy(gateway)`. Rows from other owners are never trusted.

**Live counts** (Rabdi, 6 Nov 2026, owned by the gateway): 35 samples, 4 devices, 2 datasets, 1 legacy subscription, 1 admin grant, 0 reward epochs.

## Entities

### `odsy.samples`: one captured clip, photo, audio or sensor reading

| Field | Type | Indexed | Why it is queried |
|---|---|---|---|
| `device` | addr | ✓ | A device's captures (`/capture`, `GET /api/devices`), thinning groups |
| `worldId` | str | ✓ | Ban checks: drop a banned human's data from reads |
| `deviceType`, `mac` | str | ✓ | Dataset filter by hardware |
| `kind` | str | ✓ | Filter `image` / `video` / `audio` / `text` / `sensor` |
| `capturedAt` | u64 | ✓ | Time range filter, thinning window (`between`) |
| `lat`, `lon` | dec | ✓ | Exact distance after the geohash prefilter |
| `geohash` | str | ✓ | Geo search: `startsWith("geohash", cell)` |
| `contentHash` | str | ✓ | Duplicate and replay detection on ingest |
| `storage` | str | ✓ | `inline` or `0g` |
| `ogRoot`, `mime`, `size`, `sensors`, `signature`, `data`, `enc`, `sensorsHash` | — | | Stored, not filtered. `sensors` and `data` are AES-256-GCM ciphertext |

- **Owner:** gateway wallet. Created with `flags: { readonly: true }`: nobody can edit a sample after capture, not even the gateway.
- **Expiration:** `ExpirationTime.max()` (~182 days). The daily `/api/cron/extend` job extends **one** sample per (device, geohash-7 cell, 1 hour window); the rest are left to expire. Samples from a banned World ID are never extended.

### `odsy.devices`: the device registry (one human, one device)

| Field | Type | Indexed | Why |
|---|---|---|---|
| `device` | addr | ✓ | Ingest checks the signer is registered |
| `worldId` | str | ✓ | Refuse a second device for the same World ID |
| `deviceType`, `mac` | str | ✓ | Copied onto each sample |
| `payout` | addr | | Wallet that receives contributor rewards |

- **Owner:** gateway, written after a World ID proof (`POST /api/enroll`) or by a trusted registrar.
- **Expiration:** max, extended every day while the device is registered.

### `odsy.datasets`: a saved filter sold as a 30-day subscription

Fields: `name`, `description` (bytes, may exceed 128 B), `lat`, `lon`, `radiusM`, `kind`, `deviceType`, `fromTs`, `toTs`, `price` (u256 wei of 0G), `active` (bool, **indexed**: the marketplace lists only active ones).

- **Owner:** gateway, created by an admin from `/datasets`. Mutable: list/unlist updates `active`.
- **Expiration:** max, extended daily.

### `odsy.subscriptions` (legacy): a paid period recorded before the contract

Fields: `subscriber` (addr, ✓), `dataset` (key, ✓), `txHash` (str, ✓, each payment usable once), `amount`, `paidUntil` (u64, ✓).

- **Owner:** gateway. **Expiration:** not extended; left to lapse after `paidUntil`. New payments live in the `OdsySubscriptions` contract on 0G Galileo.

### `odsy.rewards`: one contributor reward epoch

Fields: `epoch` (u64, ✓), `root` (str, ✓), `total`, `throughBlock`, `leaves` (JSON bytes, so claimants can rebuild their Merkle proof).

- **Owner:** gateway (`npm run rewards:publish`). **Expiration:** max, extended daily, so a claim proof is always available.

### `odsy.admins`: admin grants made from `/admin`

Fields: `admin` (addr, ✓), `grantedBy`, `grantedAt`.

- **Owner:** gateway. Revoking **deletes** the entity. **Expiration:** max, extended daily.

## A query you can run

```ts
import { createPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { http } from "viem";

// Free key at https://hub.arkiv.network/access-keys; the keyless public endpoint is heavily rate limited.
const pub = createPublicClient({ chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" }), transport: http() });
const { entities } = await pub
  .select({ $key: true, kind: true, geohash: true, capturedAt: true, device: true })
  .where(eq("arkiv.schema", "odsy.samples"))
  .ownedBy("0x51f18a28F4C17121770782aC95B9baAf6257053a")
  .limit(100)
  .fetch();
console.log(entities.length, entities[0]);
```
