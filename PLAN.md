# Odyssey plan

Proof-of-Reality data for AI: devices sign what they capture, a gateway encrypts and stores it on Arkiv and 0G, labs pay for it on-chain, validators spot-check it, and bad actors get banned. See [README.md](README.md) for the protocol and [MILESTONE.md](MILESTONE.md) for what is already done. Testing steps are in [TESTING.md](TESTING.md).

Testnets only (Arkiv Rabdi, 0G Galileo). Mainnet is out of scope until the audit in section 3 is done.

## Where we are

| Area | Status |
|---|---|
| Web app (`web-monorepo/apps/web`) | Done: landing, 3D device, wiring lessons, protocol docs, live Datasets / Explore / Activity behind wallet sign-in, demo screens under `/mockups` |
| Gateway (Arkiv + 0G) | Done: signed and encrypted ingest, geo search, paid subscriptions, lab ingest, retention cron. Live-tested up to ingest and dataset creation |
| `OdsySubscriptions` | Deployed on Galileo `0xc3a946516f2f0CE3fc2065543cb0a8E9b105A54e`, 14 tests. Subscribe and claim not yet run live |
| `ConsensusRegistry` | Deployed on Galileo `0x83bea227e5D2C72f8F0F73E63175759D4E6055DC`, 10 tests, hand-tested live. Gateway enforces bans |
| World ID enrollment | `/enroll` verifies the proof (signal = device address) and registers the device with a payout wallet. Not yet live-tested |
| Firmware (`firmware/`) | `odsy_glasses_camera` signs captures with a device key and uploads to the gateway; hardware run not yet confirmed here |
| Contract audit | Not done |

## 1. Live testing (do first, in this order)

Steps are in [TESTING.md](TESTING.md).

- [ ] Run `forge test` and `npm test` (expect 24 and 13 passing).
- [x] Deploy `OdsySubscriptions` to Galileo and set `SUBSCRIPTIONS_ADDRESS` and `SUBSCRIPTIONS_FROM_BLOCK` locally.
- [ ] Set the same two variables on Vercel and redeploy (signed-in requests return 500 until then).
- [ ] Create a dataset, subscribe as a lab, pull it with `lab:ingest`.
- [ ] Publish reward epoch 1 and claim it from the payout wallet.
- [ ] Upload a payload over 96 KiB to exercise 0G Storage.
- [ ] Run the consensus ban flow end to end through the gateway (TESTING.md, part 3).
- [ ] Run `/api/cron/extend` once with the cron secret.

## 2. Wallets and roles

- [ ] Replace the shared testnet wallet with separate keys: Arkiv gateway, 0G owner/operator, web admin (a human wallet), contract admin (multisig). The current wallet's address is also in `lib/market.test.ts`, so treat it as public.
- [ ] Redeploy `ConsensusRegistry` with the new roles, then update `CONSENSUS_ADDRESS`, the README table and the docs link.
- [ ] Verify the contract source on the Galileo explorer.
- [ ] Rotate the Arkiv access key that was shared in chat.

## 3. Consensus: from hand-driven to automatic

- [ ] A script or admin page to add validators, create a dataset on the contract and submit tiles, instead of `cast`.
- [ ] Compute tile counts (clips, devices) and the H3 cell per epoch from Arkiv and submit them on a schedule.
- [ ] More strike sources besides `replay`: failed honeypot, impossible location jump between samples, bad signature from a registered device. Objective evidence only.
- [ ] Appeal path: an admin screen to lift a ban.
- [ ] Phase 2 contract work: validator staking and slashing, commit-reveal, honeypots, challenge window. Each rule change means a redeploy until then.
- [ ] Run the `solidity-auditor` skill on both contracts and get an external review before any real money.

## 4. Deploy to Vercel

- [ ] Root directory `web-monorepo/apps/web`, Node 22.x. Env vars: `ARKIV_ACCESS_KEY`, `ARKIV_PRIVATE_KEY`, `OG_PRIVATE_KEY`, `REGISTRAR_TOKEN`, `CRON_SECRET`, `DATA_KEY`, `SESSION_SECRET`, `ADMIN_ADDRESSES`, `SUBSCRIPTIONS_ADDRESS`, `SUBSCRIPTIONS_FROM_BLOCK`, `CONSENSUS_ADDRESS`, and for `/enroll` `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, `WORLD_ENVIRONMENT`.
- [ ] Set `MAX_UPLOAD_BYTES` to about 3 MB (Vercel rejects bodies over 4.5 MB, and base64 adds a third).
- [ ] Add `maxDuration` to the ingest and cron routes if logs show timeouts.
- [ ] Point the simulator at the Vercel URL and run `npm run simulate -- 2`.

## 5. Hardware and real data

- [ ] Confirm the ESP32 camera firmware signs and uploads to `/api/ingest` end to end on real hardware (`firmware/odsy_glasses_camera`).
- [ ] Live-test `/enroll` with a World ID app (staging works with simulator.worldcoin.org).
- [ ] Real GPS instead of the hard-coded Bandra location; witness co-signing.
- [ ] Device key in a secure element (ATECC608A) or ESP32 flash encryption.
- [ ] Batch Merkle roots on a long-lived chain.
- [ ] Hash or drop the MAC, blur faces at the gateway.

## 6. Demo polish

- [ ] Wire the `/mockups` screens to real data, or keep them clearly labelled.
- [ ] Retake the README screenshots for the live pages, including `/analytics`.
- [ ] Analytics follow-ups: samples per device for contributors, a dollar view once there is a price feed, quality and pass-rate figures once consensus drives payouts.
- [ ] Record one clean run: device upload, dataset, paid subscription, lab pull, reward claim, a ban.

## 7. Known limits (marked `shortcut:` in the code)

- [ ] One reward epoch holds about 2,000 leaves (one 128 KiB Arkiv entity); split an epoch across entities beyond that.
- [ ] Datasets are fetched one page of 100, one RPC call per dataset; use multicall and paging.
- [ ] `Subscribed` events are read with chunked `eth_getLogs`; index them into a table once the history is long.
- [ ] The duplicate-upload check can race when two identical uploads land in one block.
- [ ] `DATA_KEY` is a single secret with no rotation; losing it makes every stored sample unreadable. Back it up.
- [ ] The reward split is computed off-chain by the owner; it is checkable from the public leaves but not enforced by the contract.
- [ ] Ban checks are cached 60 seconds per server instance.
- [ ] No CI. Add `forge test`, `npm test` and `npm run build` on push.

## Working rules

- Never commit without asking first (see [AGENTS.md](AGENTS.md)).
- Keep each commit under 1000 changed lines; split big changes by area. Generated lockfiles are the exception.
- Detailed commit messages: a summary line with a type (`feat(web):`, `fix(contracts):`), then what and why.
