# Odsy · Proof-of-Reality Data

> **Real-world data for AI, signed at the sensor, verified by stake, owned by the people who capture it.**

AI is running out of internet. The next frontier models, especially robots and embodied agents, need **first-person, real-world data**: what a human sees, hears, looks at and does. That data is scarce, expensive, and today it is either scraped without consent or locked inside a few big labs.

Odsy turns every pair of glasses, every sensor and every phone into a **paid, verifiable data source**, and gives AI labs a dataset they can actually trust: every sample is traceable to a real device, a real human and a real moment, and nobody can quietly change it afterwards.

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
| Arkiv gateway + geohash index (`apps/web/app/api`) | Queryable, signed sample index; see below |

## Directory structure

```
.
├── web-monorepo/  Web apps and services: Next.js gateway and coordinator, World ID, ENS, 0G, relayer, iris matcher
│   └── apps/web/   Site + Arkiv gateway: app/(app) pages, app/api (ingest, devices, samples, datasets, subscriptions, keys, auth, cron),
│                   lib (arkiv, geo, crypto, sessions, payments, 0G, sample protocol),
│                   scripts/simulate-device.ts (fake glasses), scripts/lab-ingest.ts (lab-side verified sync)
├── firmware/      ESP32 glasses: mic, IR camera, IMU, OLED, device signing
├── contracts/     Foundry: Odsy token, batch Merkle root anchor, rewards
├── .claude/       Agent skills (Solidity security, OpenZeppelin, token checks)
├── .cursor/       Cursor rules (Ponytail)
├── AGENTS.md      Rules for AI coding agents
└── CLAUDE.md      Loads AGENTS.md for Claude Code
```

## Arkiv data layer (built)

The first working slice: a device signs each capture, the gateway checks it, **encrypts the payload**, and writes one **readonly entity per sample** to [Arkiv](https://docs.arkiv.network/) (Rabdi testnet). A geohash index on top of Arkiv answers "what was captured near here?". Labs sign in with their wallet, pay in test 0G for a 30-day dataset subscription, and only then get the keys to decrypt. Code: `web-monorepo/apps/web/{app,lib,components}`.

```
 device key signs ──► POST /api/ingest ──► payload ≤ 96 KiB ──► inline in the Arkiv entity
 sha256 + metadata       │ verify sig           payload > 96 KiB ──► 0G Storage, root on Arkiv
                         │ device registered?
                         │ contentHash unique?
                         └──► Arkiv entity (readonly, max lifetime) ◄── GET /api/samples (geo)
                                                                    ◄── daily /api/cron/extend
```

### What is stored per sample (`odsy.samples`)

| Column | Type | Indexed | Notes |
|---|---|---|---|
| `device` | addr | ✓ | Recovered from the device signature; the device's identity |
| `worldId` | str | ✓ | World ID nullifier bound to the device at registration |
| `deviceType`, `mac` | str | ✓ | From the device registry, not from the upload |
| `kind` | str | ✓ | `image`, `video`, `audio`, `text`, `sensor` |
| `capturedAt` | u64 | ✓ | Unix seconds, device clock |
| `lat`, `lon` | dec | ✓ | Decimal strings, signed exactly as stored |
| `geohash` | str | ✓ | Precision 9 (≈ 5 m) |
| `contentHash` | str | ✓ | sha256 of the plaintext payload; duplicates are rejected |
| `storage`, `ogRoot` | str | `storage` ✓ | `inline` or `0g` + 0G merkle root |
| `enc`, `sensorsHash` | str | | `aes-256-gcm-v1`; sha256 of the plaintext sensors JSON |
| `mime`, `size`, `sensors`, `signature`, `data` | — | | Stored, not indexed. `sensors` and `data` are ciphertext |

Devices live in `odsy.devices` (`device`, `worldId`, `deviceType`, `mac`). One World ID can bind one device. Datasets (`odsy.datasets`) and paid periods (`odsy.subscriptions`) are Arkiv entities too. Only entities owned by the gateway wallet are trusted, since anyone can write the same schema tag.

The device signs this text with EIP-191 (`lib/sample.ts`):
`odsy-sample:v1|<sha256(data)>|<kind>|<mime>|<capturedAt>|<lat>|<lon>|<sha256(sensors JSON)>`

### Encryption

Metadata stays public so the geo index, search and signature checks work for anyone. The payload and sensor readings are encrypted with AES-256-GCM before they reach Arkiv or 0G (`lib/crypto.ts`):

- Each sample gets its own key: `HKDF-SHA256(DATA_KEY, contentHash)`. Handing out one key reveals one sample, nothing else.
- `contentHash` is bound in as authenticated data, so ciphertext can't be moved to another sample.
- The gateway releases a sample's key, or decrypts it in the app, only to an admin or to a wallet whose active subscription covers that sample.
- Anyone can still check the device signature, because it is computed over `contentHash` and `sensorsHash`. Checking the payload against `contentHash` needs access.

`DATA_KEY` is the one secret that unlocks every sample. Back it up, and never change it: samples encrypted under an old key can't be read with a new one. Deleting it makes all data unreadable. That is the crypto-shredding path, not something to do by accident. Samples written before encryption shipped have no `enc` and stay public.

### The app: sign-in, datasets, payments, transactions

Wallet sign-in uses [Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361) with any browser wallet such as MetaMask. The server checks the signed message's domain, nonce, expiry and signature, then sets a signed `httpOnly` session cookie for 7 days. Wallets listed in `ADMIN_ADDRESSES` are admins.

| Page | Anyone | Signed-in lab | Admin |
|---|---|---|---|
| **Datasets** | Browse, preview sample metadata | Subscribe or renew with test 0G, see access-until date, lab-ingest snippet | Create datasets, list or unlist them |
| **Dataset map** (`/datasets/{key}`) | — | H3 hexagon map of the dataset's samples: volume, kind and access per cell, linking into Explore | Same, for every dataset |
| **Explore samples** | Search by dataset or area, kind and time; see metadata and signature proof | Decrypt and view or download covered samples | Decrypt everything |
| **Transactions** | — | Own 0G payments and the Arkiv records of their subscriptions | Every recent Arkiv write by the gateway and every payment |

**Paying.** A dataset is a saved filter (area, kind, device type, time range) plus a price in 0G per 30 days. Subscribing works like this:

1. The wallet sends the price in 0G on **Galileo testnet** (chain 16602) to `TREASURY_ADDRESS`, with the dataset key as transaction data. The app switches or adds the network for you.
2. The server checks the receipt: success, from the signed-in wallet, to the treasury, at least the price, the right dataset in the data, and never used before.
3. The server writes an `odsy.subscriptions` entity with `paidUntil`. Renewals stack from the current `paidUntil`, up to 150 days ahead.
4. If the page closes mid-payment, **"Already paid?"** records the subscription from the transaction hash.

New samples that match a dataset are covered automatically.

### Geospatial index

Arkiv has no geo type, but it has string prefix search. Each sample stores a precision-9 geohash. For a radius query the API picks the finest geohash precision whose cells cover the circle's bounding box in at most 4 cells, sends `geohash STARTSWITH …` for each, then filters by exact haversine distance and sorts nearest first (`lib/geo.ts`).

### Retention and thinning

Arkiv entities live at most ~182 days, and nothing on Arkiv is permanent unless it is extended. `GET /api/cron/extend` (daily via `vercel.json`) does this:

1. Finds samples that expire within `EXTEND_WITHIN_DAYS`.
2. Groups them by device, by geohash cell at `THIN_GEOHASH_PRECISION`, and by `THIN_WINDOW_SECONDS` window.
3. Extends one sample per group to the maximum lifetime: the earliest capture, decided over all live samples in the group. The rest are left to expire.
4. Extends every device registration and dataset. Subscriptions expire on their own a week after `paidUntil`.

### For AI labs: ingest into your own warehouse

Arkiv keeps a sample for about 6 months, or longer if the gateway extends it. A lab doesn't need to rely on that: it runs `scripts/lab-ingest.ts` on its own schedule and keeps a permanent copy of the datasets it subscribes to.

The job signs in to the gateway with the paying wallet and asks it for one thing only: per-sample decryption keys (`POST /api/keys`). It reads all data and ciphertext straight from Arkiv and 0G, and trusts only the gateway's wallet address. For each new sample in its datasets it:

1. Takes it only if the Odsy gateway wrote it (`$owner` matches).
2. Gets the sample's key from the gateway, which grants it only while the subscription is active, and decrypts locally.
3. Checks the sensors against `sensorsHash`, then re-checks the device signature.
4. Checks that the device is registered to the stored World ID.
5. Downloads 0G media by its root, or reads inline data, and checks the decrypted payload's sha256 against `contentHash`.
6. Writes the sample to `lab-data/`.

```bash
ODSY_GATEWAY_ADDRESS=0x<gateway address> GATEWAY_URL=https://<odyssey app> \
LAB_PRIVATE_KEY=0x<paying wallet key> LAB_DATASETS=0x<dataset key>[,0x...] LAB_MODE=all npm run lab:ingest
```

Output in `lab-data/`:

| File | Contents |
|---|---|
| `samples.jsonl` | Verified samples, one per line, ready to load into a warehouse |
| `media/` | Payloads, named by content hash |
| `rejected.jsonl` | Samples that failed a check, with the reason |
| `dropped.jsonl` | Samples skipped in `thinned` mode |
| `state.json` | The sync cursor per dataset |

Runs are incremental. The cursor is `$expiresAt`: new and extended samples always have the latest one. A run that crashes never duplicates rows. A failed 0G download, or a sample whose key is refused because the subscription lapsed (`locked`), is retried on the next run.

**Policy: `LAB_MODE`**

| Mode | The lab gets | Note |
|---|---|---|
| `all` (default) | Every sample the gateway wrote | Must run more often than every ~182 days, or thinned-out samples expire before they're copied |
| `thinned` | One sample per device, geohash cell and time window: the same one the gateway keeps | Waits until a window closes plus `LAB_THIN_GRACE_SECONDS`. `THIN_GEOHASH_PRECISION` and `THIN_WINDOW_SECONDS` must match the gateway's |

`LAB_MODE` is a policy the lab chooses, not an access control. A subscriber gets keys for every sample its dataset covers, so `thinned` is honoured by the lab, not enforced. To enforce it, `POST /api/keys` would release keys only for the kept sample of each group.

### API

| Endpoint | Auth | Does |
|---|---|---|
| `POST /api/devices` | `Bearer REGISTRAR_TOKEN` | Binds `{device, worldId, deviceType, mac}`. Called by the World ID registration page after it verifies the proof |
| `POST /api/ingest` | Device signature | `{kind, mime, capturedAt, lat, lon, sensors, data (base64), signature}` → `201 {entityKey, txHash, contentHash, storage, ogRoot}` |
| `GET /api/samples?lat=&lon=&radius=&kind=&deviceType=&from=&to=&limit=` or `?dataset=` | Public (metadata) | Samples within `radius` metres (max 50 km) or in a dataset, nearest first. `readable` says whether the viewer can decrypt |
| `GET /api/samples/{key}` | Public, more with access | Metadata and the re-checked signature. With access, also the decrypted sensors and inline payload, and `verified.contentHash` |
| `GET /api/samples/{key}/data` | Access | Decrypted payload as a file (inline or from 0G), hash-checked |
| `GET /api/auth/nonce`, `POST /api/auth/verify`, `POST /api/auth/logout`, `GET /api/auth/me` | — | Sign-In with Ethereum session |
| `GET /api/datasets` | Public | Datasets with sample counts and the viewer's access-until date |
| `POST /api/datasets`, `PATCH /api/datasets/{key}` | Admin | Create a dataset, or list/unlist it with `{active}` |
| `POST /api/subscriptions` | Signed in | `{dataset, txHash}`: verify a 0G payment and grant 30 days. `425` means not mined yet; retry |
| `GET /api/subscriptions` | Signed in | Own paid periods (admin: all) |
| `POST /api/keys` | Signed in | `{keys: [...]}` → per-sample decryption keys the wallet is entitled to |
| `GET /api/activity` | Signed in | Recent Arkiv writes with tx hashes (admin: all, from the last ~7 days of logs; lab: own subscriptions) |
| `GET /api/config` | Public | Treasury address and payment chain |
| `GET /api/cron/extend` | `Bearer CRON_SECRET` | Retention job above |

### Setup

You need:

- **Node.js 22.10+** (the simulator and tests run TypeScript directly).
- **An Arkiv access key** from [hub.arkiv.network/access-keys](https://hub.arkiv.network/access-keys). The public RPC is heavily rate limited without one.
- **A gateway wallet funded with tGLM** from the [Arkiv faucet](https://hub.arkiv.network/faucet). Every sample, registration and extension is a transaction.
- **A 0G testnet wallet with tokens** ([faucet.0g.ai](https://faucet.0g.ai)). This is only needed for payloads over 96 KiB.
- **A browser wallet** (MetaMask or similar) with some Galileo test 0G, to sign in and pay. The app adds the Galileo network for you.
- **New secrets in `.env`:** `DATA_KEY` (`openssl rand -hex 32`, back it up), `SESSION_SECRET` (`openssl rand -hex 32`), `ADMIN_ADDRESSES` (your wallet address) and `TREASURY_ADDRESS` (where 0G payments go).

```bash
cd web-monorepo
npm install
cp apps/web/.env.example apps/web/.env      # fill every uncommented value
npm run dev                                 # gateway on http://localhost:3000
npm run simulate -- 3                       # fake glasses: register, upload 3 signed samples from Bandra, query nearby
npm run simulate -- 1 ./photo.jpg           # an image > 96 KiB goes through 0G
npm run simulate -- 3 --kind sensor         # weather readings (kind=sensor, application/json)
npm test                                    # geo, thinning, signature, encryption, session, payment tests (no network)
npm run lab:ingest                          # with the LAB_* vars set: pull your datasets into apps/web/lab-data/
```

Generate a key with:

```bash
node -e "import('viem/accounts').then(a=>{const k=a.generatePrivateKey();console.log(k,a.privateKeyToAccount(k).address)})"
```

### Known gaps (read before trusting the data)

- **Tamper-evident, not tamper-proof.** Samples are created `readonly`, so nobody can patch them. The gateway wallet can still delete them, and they expire if the extend job stops. For permanence, anchor a Merkle root per batch on a long-lived chain (Roadmap Phase 1).
- **The gateway is trusted.** It holds the key that writes everything and `DATA_KEY`, which decrypts everything. Anyone can re-check a sample's device signature, but a compromised gateway could refuse uploads, delete samples or leak data.
- **The paywall covers payloads, not metadata.** Location, time, device, MAC and World ID are public on Arkiv by design, because they power the geo index. A subscriber who saves the keys or data keeps them after the subscription ends.
- **Payments are checked off-chain.** The server verifies each 0G receipt and records it on Arkiv. There's no contract and no refunds. A subscription contract would make access verifiable on-chain. Only externally owned wallets can sign in, not smart-contract wallets.
- **Mockups live under `/mockups`** and show demo data only: `/mockups/datasets` (the validator-consensus hex map), `/mockups/analytics`, `/mockups/devices` and `/mockups/enroll`. They are marked "mockup" in the nav and top bar. The live routes are `/datasets`, `/datasets/{key}`, `/explore`, `/activity` and `/api/*`.
- **Explorer links** assume `/tx/<hash>` paths on chainscan-galileo.0g.ai and rabdi.explorer.arkiv.network.
- **Device keys are only as safe as the device.** Real glasses need the key in a secure element (ATECC608A) or ESP32 flash encryption. A key in plain NVS can be copied.
- **Location is hard-coded to Bandra, Mumbai**, because there is no GPS yet. Even with GPS, a signed location is only as honest as the device; witness co-signing (see *How it works*) is the planned check.
- **World ID is not verified here.** `POST /api/devices` trusts the registration page via `REGISTRAR_TOKEN`.
- **Privacy.** MAC addresses and World ID nullifiers are public on Arkiv. Images can show bystanders. Before real users: hash or drop the MAC and blur faces at the gateway. Immutable personal data also conflicts with GDPR and DPDP deletion rights. Per-sample keys make crypto-shredding possible, by destroying `DATA_KEY`, but only for all samples at once.
- **Live-tested so far:** device registration, ingest, and geo query against Arkiv. Sign-in and the UI were tested locally with mocked data. Encrypted ingest, datasets, 0G payments, decryption, the activity log and the new lab ingest have not yet run against live Arkiv and 0G.
- **Scale shortcuts** are marked `shortcut:` in code. The geo scan stops at 2,000 candidates. Duplicate and registration checks can race. The extend job runs in a single request.

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

<sub>Status: **vision document**. The pivot is not built yet; the "Built today" table is the current Odsy codebase (see README.md). Numbers (1–5 % sampling, challenge windows) are starting assumptions to tune against measured fraud rates.</sub>
