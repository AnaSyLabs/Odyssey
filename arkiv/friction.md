# Arkiv friction log

What got in our way building Odsy on Arkiv (Rabdi testnet, `@arkiv-network/sdk`), ordered by how much time it cost. Each item: what we expected, what happened, how to reproduce, what would help.

## 1. `eth_getLogs` only works for the last ~900 blocks

- **Expected:** read entity events (create, update, extend, delete) for the gateway's history, to show users a feed of writes with tx hashes.
- **Happened:** any range older than roughly 900 blocks (~30 minutes at 2 s/block) fails with `segment_range_of(transactions): NotImplemented`. Our `/api/activity` returned 500 until we capped it at 800 blocks in 200-block chunks. The feed now covers only ~25 minutes.
- **Reproduce:** `eth_getLogs` on the Rabdi RPC with `address: 0x4400000000000000000000000000000000000044` and `fromBlock = latest - 2000`.
- **Would help:** full log history, or an SDK query for "entities written by owner X, newest first, with tx hash". A clearer error ("log range too old, max N blocks") would have saved an hour.
- Code: [`app/api/activity/route.ts`](../web-monorepo/apps/web/app/api/activity/route.ts)

## 2. No geo type

- **Expected:** "samples within 500 m of here", the core query for a data marketplace of real-world captures.
- **Happened:** no geo index, so we store a precision-9 geohash as an indexed `str`, query up to 4 covering cells with `startsWith`, then filter by haversine in the app. Dense cells mean scanning many rows, so we cap a query at 2,000 candidates.
- **Would help:** a native geo point with radius or bounding-box queries, or at least numeric range on two `dec` attributes in one query being fast enough to replace this. Code: [`lib/geo.ts`](../web-monorepo/apps/web/lib/geo.ts), [`lib/query.ts`](../web-monorepo/apps/web/lib/query.ts)

## 3. Anyone can write under your schema tag

- **Expected:** a schema name (`odsy.samples`) to be ours.
- **Happened:** any wallet can create entities with the same tag and fields. Every read must add `.ownedBy(gateway)`, and forgetting it once shows forged rows to users. Nothing in the SDK warns when a query has no owner filter.
- **Would help:** a way to bind a schema/namespace to an owner set, or a client-level default owner filter, plus a loud docs note on this.

## 4. No uniqueness constraint

- **Expected:** "one device per World ID" and "one sample per content hash" enforced by the store.
- **Happened:** we check then create, which races: two identical uploads in the same block both pass, and two concurrent admin grants create two rows (revoke deletes all of them). Marked `shortcut:` in [`lib/arkiv.ts`](../web-monorepo/apps/web/lib/arkiv.ts), [`app/api/ingest/route.ts`](../web-monorepo/apps/web/app/api/ingest/route.ts), [`lib/admins.ts`](../web-monorepo/apps/web/lib/admins.ts).
- **Would help:** a unique-index option on an attribute (per owner), or a conditional create ("create unless an entity with `contentHash = x` and owner = me exists").

## 5. Page size cap and the error that suggests offsets

- **Happened:** `limit` above 100 fails with `limit 1000 exceeds the node maximum of 100. Page through the results with an offset instead.` Offset paging shifts under concurrent writes, so we page by `$key` (`gt("$key", last)` + `orderBy(asc("$key"))`) in every scan.
- **Reproduce:** `.limit(1000).fetch()` on any query.
- **Would help:** document the 100 cap up front, a cursor-based page helper in the SDK (`for await (const page of query.pages())`), and an error message that recommends key paging, not offsets.

## 6. Max lifetime (~182 days) means we run a keep-alive job

- **Expected:** at least devices, datasets and reward epochs (which back on-chain Merkle claims) could live as long as we need.
- **Happened:** everything expires, so a daily cron extends every registry row plus one sample per thinning group, 50 extensions per batch. If the cron stops for six months, the device registry and claim proofs vanish.
- **Would help:** a prepaid "extend until block N" beyond 182 days, or auto-renew funded from the owner's balance. We like expiration for samples (see [how-you-use-arkiv.md](how-you-use-arkiv.md)); it is the registry rows where it hurts.

## 7. `str` limited to 128 bytes

- **Happened:** dataset descriptions overflowed, so `description` is `bytes()` holding UTF-8. Not indexed, and not readable as text in generic explorers.
- **Would help:** state the limit in the schema builder's types or error (`str() max 128 bytes`), or a `text()` type for longer non-indexed strings.

## 8. Internal constants not exported

- The Arkiv system contract address (`0x4400…0044`) that emits entity events is not exported by the SDK; we hard-coded it. `ENTITY_EVENTS_ABI` is exported, the address it applies to is not.

## 9. Public endpoint rate limit

- Without an access key the Rabdi public RPC is heavily rate limited; a simple 100-row query with no key hung for over two minutes during our tests. The SDK's warning is good. Would help: say in the quickstart that a free key is needed for anything beyond a hello-world.

## What worked well

- `defineSchema` with typed attributes and `select(...).from(Schema).where(...).ownedBy(...)` read well and caught type errors early.
- `onMismatch: "throw" | "skip"` on `from()` was exactly what we needed for rows that don't match the schema.
- `flags: { readonly: true }` gave us tamper evidence in one line.
- `executeBatch` for extensions kept the retention job to a few transactions a day.
