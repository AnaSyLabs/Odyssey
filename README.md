# Odsy · Proof-of-Reality Data

> **Real-world data for AI, signed at the sensor, verified by stake, owned by the people who capture it.**

AI is running out of internet. The next frontier models, especially robots and embodied agents, need **first-person, real-world data**: what a human sees, hears, looks at and does. That data is scarce, expensive, and today it is either scraped without consent or locked inside a few big labs.

Odsy turns every pair of glasses, every sensor and every phone into a **paid, verifiable data source**, and gives AI labs a dataset they can actually trust: every sample is traceable to a real device, a real human and a real moment, and nobody can quietly change it afterwards.

![Odyssey web app: landing page, datasets marketplace, wiring lessons and contributor analytics](docs/screenshots/mockup.png)

```
  capture ──► sign ──► filter ──► store ──► anchor ──► verify ──► pay
  (device)   (chip)    (TEE)      (0G)      (chain)    (stake)    (token)
```

---

## Why now

| The problem | Odsy's answer |
|---|---|
| Labs can't tell real data from synthetic or faked uploads | Each sample is signed by a hardware key inside the device at capture time |
| One person can run 1,000 fake devices | One human, one device: linked with World ID (Proof of Human) |
| Datasets get edited, poisoned or relabelled after the fact | Batch Merkle roots on-chain: any change breaks the proof |
| Checking every sample doesn't scale | Optimistic acceptance plus random, staked spot-checks of 1 to 5 % |
| Contributors give data away for free | Gasless, batched payouts to every contributor |
| Immutable storage vs privacy law | Encrypted per batch; destroy the key to forget the data (crypto-shredding) |

---

## How it works

**1. Capture: trust starts at the sensor.**
Glasses (ESP32 + mic + IR camera + IMU) record short clips. A key in the secure element signs `hash · device · time · witnesses`. Nearby devices on the Bluetooth mesh can co-sign as witnesses.

**2. Filter: machines first, at machine speed.**
Gateways inside a TEE check the signature, duplicates (perceptual hash), format, blur and silence, and blur faces and plates. Most junk dies here, off-chain.

**3. Store: data off-chain, truth on-chain.**
Encrypted batches go to 0G Storage. One Merkle root per batch goes on-chain, so a million samples cost one transaction.

**4. Verify: optimistic, staked, random.**
Each batch opens a challenge window. A VRF-picked committee of staked validators scores a small random sample (commit-reveal, so nobody copies votes). Hidden honeypots grade the validators. Anyone can challenge with a bond.

**5. Pay: one root, many claims.**
Each epoch publishes a rewards Merkle root. Contributors claim gaslessly.
`reward = base × quality score × rarity`

---

## Stake and slash

| Role | Stakes | Slashed for |
|---|---|---|
| **Contributor** | Nothing: World ID + device key is the spam filter | Never slashed; rewards withheld, device banned |
| **Gateway** | Medium | Anchoring a batch that hides bad or duplicate data |
| **Validator** | Medium | Failed honeypots, missed reveals, losing a challenge |
| **Challenger** | Bond per challenge | Frivolous challenges |

Slashing only happens on **objective evidence** (bad signature, duplicate, failed honeypot, proven fake), never on "the majority disagreed".

---

## Why it scales

- **On-chain cost is flat**: one root per batch, not one transaction per sample.
- **Verification grows with the sample, not the dataset**: 1 to 5 % is checked, and it's random, so cheaters can't know which.
- **No real-time coordination**: gateways and validators scale out independently.
- **Existing chain**: 0G Chain or an Ethereum L2. We build a data protocol, not a blockchain.

---

## What already exists in this repo

| Built today | Becomes |
|---|---|
| ESP32 glasses firmware, mic, IR camera, OLED | The capture device |
| open-iris + iris matcher | Owner check before a device can upload |
| World ID IDKit, "one human, one wallet" | Sybil resistance: one human, one device |
| 0G Storage uploads (memory notes) | Encrypted batch storage |
| 0G Compute rule engine (approve / hold) | TEE quality filter |
| EIP-3009 gasless token + relayer | Contributor payouts |
| Bluetooth mesh chunk protocol | Witness co-signing and offline upload |
| ENS device subnames (`glasses-xxxx.odsy.eth`) | Public device identity and reputation |
| Next.js server + MongoDB on Vercel | Gateway and coordinator MVP |

## The web app

A mock-data front end for the whole flow, built with Next.js in `web-monorepo/apps/web`. Subscriptions, earnings and device enrollment are simulated in the browser; there is no gateway or chain behind them yet.

| Page | What it shows |
|---|---|
| `/` | Landing page with the interactive 3D glasses |
| `/datasets` | Dataset marketplace, mock subscriptions, H3 hex consensus map of subscribed sources |
| `/analytics` | Contributor earnings and company spend |
| `/device` | 3D capture device: interactive, exploded, wireframe |
| `/devices` · `/enroll` | Registered devices and the enrollment flow |
| `/wiring` | ESP32 wiring and reference firmware, one lesson at a time |
| `/docs` | Protocol docs |

| Datasets | Wiring & firmware | Analytics |
|---|---|---|
| ![Datasets](docs/screenshots/datasets.png) | ![Wiring](docs/screenshots/wiring.png) | ![Analytics](docs/screenshots/analytics.png) |

Run it:

```bash
cd web-monorepo
npm install
npm run dev   # http://localhost:3000
```

## Directory structure

```
.
├── web-monorepo/  Web apps and services: Next.js gateway and coordinator, World ID, ENS, 0G, relayer, iris matcher
├── firmware/      ESP32 glasses: mic, IR camera, IMU, OLED, device signing
├── contracts/     Foundry: Odsy token, batch Merkle root anchor, rewards
├── docs/          Screenshots used in this README
├── .claude/       Agent skills (Solidity security, OpenZeppelin, token checks)
├── .cursor/       Cursor rules (Ponytail)
├── AGENTS.md      Rules for AI coding agents
└── CLAUDE.md      Loads AGENTS.md for Claude Code
```

## Roadmap

- [ ] **Phase 1: Prove it.** Device signing, upload to 0G, batch roots on-chain, test-token rewards. The team does the spot-checks.
- [ ] **Phase 2: Stake it.** Permissioned staked validators, honeypots, challenge window, slashing.
- [ ] **Phase 3: Open it.** Permissionless validators, TEE gateways, rarity rewards, buyer marketplace with licensing.
- [ ] **Phase 4: Value it.** Reward data by how much it actually improves a model.

---

## For AI labs

Buy datasets with a **provenance proof per sample**: the device that captured it, the verified human behind it, when and where, its validation score, and a Merkle proof that it hasn't changed since. Clear consent and licensing travel with every batch.

## For contributors

Wear it, capture your world, get paid. Your data is encrypted, your identity stays private (World ID reveals nothing about who you are), and you can revoke it.

---

<sub>Status: **early build**. The web app above runs on mock data; the protocol (gateway, contracts, staking) is not built yet, and the "Built today" table is the existing Odsy codebase. Numbers (1–5 % sampling, challenge windows) are starting assumptions to tune against measured fraud rates.</sub>
