# Odsy plan

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

## Working rules

- Keep each commit under 1000 changed lines; split big changes by area.
- Detailed commit messages: summary line with a type (`feat(web):`, `fix(firmware):`), then what and why.
- Normal `git push`; force-push only after agreeing with the team, then everyone runs `git fetch && git reset --hard origin/main`.