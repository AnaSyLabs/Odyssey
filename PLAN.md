# Odyssey plan

Offline-first crypto transfers from smart glasses: say a send, confirm by voice, pass an iris check and a 0G Compute checkpoint, then the signed EIP-3009 authorization hops across a mesh until a device with internet relays it on Sepolia.

## Where we are

| Area | Status |
|---|---|
| Web Studio (`web/`) | Done: wallet, send, 3D glasses simulator, voice (ElevenLabs realtime STT + TTS), memory, World ID, ENS, 0G pages, docs, wiring |
| Backend (`backend/`) | Done: chains, balances, EIP-3009 relayer, glasses state machine, iris matching, 0G checkpoint, Agent Pass, mesh chunk protocol |
| Contracts (`contracts/`) | `OdsyToken` deployed on Sepolia. `EpisodeAnchor` written and tested, **not deployed** |
| Iris (`iris/`) | Done: open-iris template server, sample eyes |
| ENS | Done: `odsy.eth` subregistry + Permissioned Resolver on Sepolia, device subnames, contacts |
| Firmware (`firmware/`) | In progress: ESP32-CAM capture to a local server and an amp test. Not yet wired to the backend flow |
| Mesh | Protocol is real (backend), transport is simulated in the browser. No BLE yet |
| Demo video (`video/`) | Compositions and narration written; final render not published |

## 1. Submission (do first)

- [ ] Deploy `EpisodeAnchor` on 0G Galileo, set `OG_ANCHOR_ADDRESS` / `OG_ANCHOR_FROM_BLOCK`, add the address to the README.
- [ ] Render the demo video (under 3 min) from `video/`, upload, link it in the README.
- [ ] Deploy the web app (live demo URL) and point it at a hosted backend.
- [ ] Fill README *Submission* TODOs: team names, Telegram, X.
- [ ] Do one live World ID run (IDKit link + Agent Pass approval) and record "time to first success" in the README and `/world-id` page.
- [ ] Full dry run of the README "Try it without hardware" steps 1 to 8 on a clean checkout.

## 2. Hardware: glasses talk to the backend

Owner: Mir-Aatif-Rafiq (firmware), ekas (backend glue).

- [ ] ESP32 records the voice command, posts audio to `/api/voice/stt`, then the text to `/api/glasses/say`.
- [ ] Show the backend's reply prompt on the OLED and play TTS through the amp (`firmware/amp_test` as the base).
- [ ] IR eye capture at 640x480 (what open-iris is tuned for), send to `iris/server.py` `/template`, post `{ code, mask }` to `/api/glasses/iris`.
- [ ] Replace the local `server.py` receiver in `firmware/test_photo_send` with the real endpoints; move Wi-Fi and server URL out of the sketch into config.
- [ ] One end-to-end send on real hardware, filmed for the video.

## 3. Real mesh transport

- [ ] Native BLE client (phone or ESP32) that carries the existing chunk format from `/api/mesh/encode`.
- [ ] Gateway node posts chunks to `/api/mesh/ingest` and returns the ACK chunks to the sender.
- [ ] Test: sender with no internet, two hops, relay confirmed on Sepolia.

## 4. Hardening before real funds

These are marked `shortcut:` in the code; each one is fine for a demo and must change before real use.

- [ ] Wallet key in `localStorage` (`web/lib/wallet.ts`): move to an encrypted keystore.
- [ ] Iris templates, World ID nullifiers and Agent Pass bindings are in memory (`backend/src/main.rs`): persist them encrypted, nullifier `UNIQUE`.
- [ ] 0G 24 h spend ledger is in memory (`backend/src/og.rs`): rebuild from anchored episodes on start.
- [ ] Iris match rotates the whole bit string (`backend/src/iris.rs`): rotate per row on the real polar layout.
- [ ] ENS device index is read-modify-write (`web/app/api/ens/device/route.ts`): use registry events.
- [ ] Agent Pass Basic auth sends client id/secret unencoded (`backend/src/agentpass.rs`): form-encode per RFC 6749.
- [ ] `odsy.eth` subregistry deploy block is hard-coded (`web/lib/ens.ts`): update after any redeploy.

## 5. Quality

- [ ] CI on push: `cargo test` (backend), `forge test` (contracts), `npm run lint && npm run build` (web).
- [ ] An end-to-end test of the glasses flow (say, confirm, iris, 0G approve, relay) against a local chain.

## 6. Arkiv data layer and subscriptions (`web-monorepo/apps/web`, `contracts/`)

Testnets only (Arkiv Rabdi, 0G Galileo); mainnet is out of scope for the hackathon. Out of scope for this section and tracked elsewhere: glasses firmware and real GPS, the World ID registration page (another developer), automated reward publishing, treasury and split controls in the UI, and the contract audit.

Done and confirmed live: device registration, signed and encrypted uploads, geo queries, wallet sign-in, dataset creation, lab ingest sign-in. Built and unit-tested but not yet run live: everything below that touches the contract.

### Live testing (do first, in this order)

- [ ] Fix the `GET /api/datasets` 500: read the error in the `npm run dev` terminal; usually a missing env var or an unreachable RPC.
- [ ] Run `forge test -vv` and `npm test` on a machine where Foundry works (expect 14 passed, pass 13).
- [ ] Deploy `OdsySubscriptions` to Galileo; set `SUBSCRIPTIONS_ADDRESS` and `SUBSCRIPTIONS_FROM_BLOCK`; check `owner()` and `contributorBps()`.
- [ ] Create a dataset, confirm `setPrice` lands on-chain (no 502).
- [ ] Subscribe as a lab from MetaMask; confirm `paidUntil` and unlocked payloads.
- [ ] Run `lab:ingest` and check decrypted JSONL and files in `lab-data/`.
- [ ] `rewards:publish --dry-run`, then publish epoch 1; claim from the payout wallet; confirm `AlreadyClaimed` on a second claim.
- [ ] Upload a payload over 96 KiB to exercise 0G Storage, then download it through the lab ingest.
- [ ] Open Activity as admin, lab and payout wallets; run `/api/cron/extend` once with the cron secret.

### Deploy to Vercel

- [ ] Root directory `web-monorepo/apps/web`, Node 22.x; add the 11 required env vars (see the setup guide).
- [ ] Set `MAX_UPLOAD_BYTES` to about 3 MB (Vercel rejects bodies over 4.5 MB, and base64 adds a third).
- [ ] Add `maxDuration` to the ingest and cron routes if logs show timeouts.
- [ ] Point the simulator at the Vercel URL and run `npm run simulate -- 2`.

### Demo polish

- [ ] The `/mockups` screens (Analytics, mock datasets with the consensus map, My devices and Enroll) use fake data; wire them to Arkiv or label them clearly in the demo.
- [ ] Record one clean run: device upload, dataset, paid subscription, lab pull, reward claim.

### Known limits (marked `shortcut:` in the code)

- [ ] One reward epoch holds about 2,000 leaves (one 128 KiB Arkiv entity); split an epoch across entities beyond that.
- [ ] Datasets are fetched one page of 100, one RPC call per dataset; use multicall and paging.
- [ ] `Subscribed` events are read with chunked `eth_getLogs`; index them into a table once the history is long.
- [ ] The duplicate-upload check can race when two identical uploads land in one block.
- [ ] `DATA_KEY` is a single secret with no rotation; losing it makes every stored sample unreadable. Back it up.
- [ ] The reward split is computed off-chain by the owner; it is checkable from the public leaves but not enforced by the contract.
- [ ] No CI or integration tests for this part; add `forge test` and `npm test` to CI.

## Working rules

- Keep each commit under 1000 changed lines; split big changes by area.
- Detailed commit messages: summary line with a type (`feat(web):`, `fix(firmware):`), then what and why.
- Normal `git push`; force-push only after agreeing with the team, then everyone runs `git fetch && git reset --hard origin/main`.