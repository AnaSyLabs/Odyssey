# Odyssey study notes

Odyssey ("Proof-of-Reality Data") turns what smart glasses capture into tamper-evident, searchable, sellable data. This file teaches the ideas in four parts: the concepts, Arkiv and how we use it, 0G, and the cash flow. Part 5 walks each person's journey, and Part 6 is a self-test.

Everything below is about the testnet build in this repo. Where something is built but not yet confirmed live, it says so.

---

## 0. The whole system in one picture

```
 Smart glasses                  Gateway (Next.js API)                 Chains and storage
 (device key)                   (gateway key, DATA_KEY)
      |  signed capture             |
      |---------------------------> | verify signature + registry
      |                             | encrypt payload
      |                             |---- entity (metadata + ciphertext) ----> ARKIV  (searchable records)
      |                             |---- big ciphertext (> 96 KiB) --------> 0G STORAGE (files)
                                    |
 AI lab (wallet) ---- pays 0G -------------------------------------------> 0G GALILEO: OdsySubscriptions contract
      |                                                                          | 70% contributor pool
      |  asks for keys (signs in)                                                | 30% treasury
      |-------------------------> gateway checks the contract's paidUntil        |
      |<---- per-sample keys ------|                                             |
      |  reads ciphertext from Arkiv / 0G, decrypts locally                      |
                                                                                 |
 Contributor (payout wallet) <---- claims its share with a Merkle proof ---------+
```

Three sentences to remember:

1. A device signs each capture, so the capture is provably real and unaltered.
2. The data is public but encrypted, and the key is released only to wallets that paid a smart contract.
3. The contract splits each payment, and contributors claim their share with a short proof.

---

# Part 1. Concepts

## 1.1 Blockchain, blocks, testnets

- A **blockchain** is a record book that many computers keep identical copies of. New entries are bundled into **blocks**, each linked to the previous one, so history can't be quietly rewritten.
- Anyone can **read** it. Writing needs a signed **transaction** and a small fee.
- A **testnet** is a practice copy whose coins are free and worthless. Odyssey runs on two: **Arkiv Rabdi** (data) and **0G Galileo** (money and files).
- A **faucet** hands out free testnet coins. An **explorer** is a website for looking up any transaction or address.
- An **RPC** is the URL apps use to talk to a chain: read data, send transactions.

**On-chain vs off-chain.** On-chain things are public and enforced by the chain. Off-chain things (our gateway server, scripts) run on normal computers and must be trusted. A big part of Odyssey's design is deciding which is which.

## 1.2 Wallets, keys, addresses

- A **private key** is a secret 256-bit number. Anyone who has it controls the wallet. In `.env` it is `0x` plus 64 hex characters.
- A **public key** is calculated from it, and the **address** (`0x` plus 40 hex characters) is calculated from that. Each step is one-way, so an address reveals nothing about the key.
- A **wallet** is software that holds keys and signs things (MetaMask, or a key in `.env`).

Odyssey has several keys, each with one job:

| Key | Env var | Job |
| --- | --- | --- |
| Gateway (Arkiv) | `ARKIV_PRIVATE_KEY` | Writes and owns every sample, device, dataset, reward and admin record on Arkiv |
| Contract owner / 0G | `OG_PRIVATE_KEY` | Deployed the contract, sets prices, publishes reward roots, pays 0G Storage fees |
| Device | `DEVICE_PRIVATE_KEY` | Signs each capture. Never holds money. |
| Payout wallet | set per device | Receives that device's rewards |
| Admin | `ADMIN_ADDRESSES` (+ `/admin` grants) | Signs in to create datasets and see all transactions |
| Lab | `LAB_PRIVATE_KEY` | Pays for subscriptions and pulls data |

## 1.3 Hashes

A **hash** is a fingerprint of data: a fixed-length string. The same data always gives the same hash, one changed byte gives a completely different one, and you can't rebuild the data from it.

- `contentHash` is the SHA-256 of a sample's payload.
- `sensorsHash` is the SHA-256 of its sensor JSON.
- keccak256 is the hash Ethereum uses (contract, Merkle tree).

## 1.4 Signatures

A **signature** is made from a message plus a private key. Anyone with the message and signature can **recover the signer's address**, and so learn who signed without seeing the key. Change one character of the message and the recovered address changes.

The device signs one line, with `personal_sign` (EIP-191):

```
odsy-sample:v1|contentHash|kind|mime|capturedAt|lat|lon|sensorsHash
```

So the signature covers the data, the time, the place and the sensors together. The gateway recovers the signer, checks it is a registered device, and stores the signature on Arkiv so any lab can re-check it later.

## 1.5 Nonces, replay and Sign-In with Ethereum

- A **replay attack** is reusing a signed message you captured to act as someone else.
- A **nonce** ("number used once") is a random value the server issues for one purpose and never accepts twice. It defeats replay.

**SIWE login in Odyssey:**

1. The browser calls `/api/auth/nonce`. The server stores the nonce in a short-lived cookie (10 minutes).
2. MetaMask signs a readable message containing the nonce, the site's domain and an expiry. Signing costs no gas.
3. `/api/auth/verify` checks the signature, domain, nonce and expiry, then deletes the nonce.
4. The server sets a signed `httpOnly` session cookie for 7 days (HMAC with `SESSION_SECRET`).

Including the **domain** means a signature given to a phishing site can't be reused on the real one.

## 1.6 Transactions, gas, wei

- A **transaction** is a signed instruction: send coins, or call a contract function.
- **Gas** is the fee for running it, paid in the chain's coin by whoever sends it. Reads are free.
- **wei** is the smallest unit. 1 coin = 10^18 wei. Prices in the contract are in wei, and the UI shows them as 0G (`formatEther`).

Who needs coins: the gateway needs tGLM on Arkiv (every write) and 0G on Galileo (file storage and contract admin calls). A lab needs 0G for the price plus gas. A contributor needs a little 0G for gas to claim.

## 1.7 Smart contracts

A **smart contract** is a program stored at an address on a chain. Its rules run exactly as written, and nobody can bypass them, not even its author, except through functions it deliberately exposes.

Terms used in `OdsySubscriptions.sol`:

- **State variable**: data the contract remembers (`price`, `paidUntil`, `treasuryBalance`).
- **Function**: something callable. `external` means callable from outside. **`payable`** means it can receive coins (`subscribe`).
- **`msg.sender` / `msg.value`**: who called, and how much they sent.
- **Event**: a note written to the chain's log (`Subscribed`, `RewardsPublished`, `Claimed`). Cheap, and readable by scripts.
- **Custom error / revert**: when a rule fails the call reverts and nothing changes (`WrongAmount`, `InvalidProof`).
- **`onlyOwner`**: only the owner address may call. `Ownable2Step` makes ownership transfer a two-step handshake, so it can't be handed to a wrong address by mistake.
- **`nonReentrant`**: blocks **reentrancy**, an attack where a receiving contract calls back into `claim` before the first call finishes. We also follow **checks-effects-interactions**: update state first, send money last.
- **ABI**: the contract's function list in JSON, so apps know how to call it (`lib/subscriptions-abi.ts`).
- **OpenZeppelin**: audited, widely used contract building blocks (`Ownable2Step`, `ReentrancyGuard`, `MerkleProof`, `Address`).
- **Foundry** (`forge`, `cast`): the toolkit used to compile, test, deploy and query. `forge test` runs the 14 tests, `cast call` reads state.

## 1.8 Merkle trees

Problem: paying 500 contributors with 500 transactions is expensive. Solution: publish one small number that commits to everyone's payout, and let each person prove their own line.

1. Make one **leaf** per payout: `(epoch, wallet, amount)`, hashed (double-hashed in OpenZeppelin's format).
2. Hash leaves in pairs, then hash those results in pairs, up to a single hash: the **root**.
3. The owner puts only the **root** on-chain (`publishRewards`).
4. A contributor's **proof** is the short list of sibling hashes along its path to the root.
5. In `claim`, the contract recomputes the leaf from `(epoch, wallet, amount)` and checks the proof against the stored root.

What it buys: one cheap transaction per epoch however many contributors exist, and nobody can claim an amount that isn't in the tree. The leaves are stored on Arkiv (`odsy.rewards`) so the app can build proofs.

Safety nets on top: the contract caps each epoch's claims at its published `total`, and each wallet can claim once per epoch.

## 1.9 Encryption

Arkiv is public, so payloads are encrypted before they are written.

- **AES-256-GCM**: a symmetric cipher. One key locks and unlocks. The **GCM** part adds an authentication tag, so any change to the ciphertext makes decryption fail loudly.
- **Per-sample key**: `key = HKDF-SHA256(DATA_KEY, contentHash)`. **HKDF** derives many keys from one secret. Handing a lab one sample's key reveals only that sample.
- **AAD**: the `contentHash` is bound in as additional authenticated data, so a ciphertext can't be swapped between samples.
- Format stored: `0x01 | iv (12 bytes) | ciphertext | tag (16 bytes)`.
- `DATA_KEY` never leaves the gateway. **Back it up and never change it**: losing it makes every stored sample unreadable.

## 1.10 Geohash

A **geohash** turns lat/lon into a string where a shared prefix means nearby. Arkiv can filter by string prefix but has no map engine, so every sample stores its geohash.

- Precision 9 is a cell of about 5 m (stored on each sample).
- Precision 7 is about 150 m (used by the retention rule).
- "Within 1 km" becomes up to 4 prefix queries, then an exact haversine distance check.
- The map in the app draws hexagons with H3, a separate hex-grid library.

## 1.11 Identity and Sybil resistance

- **World ID** proves "one real human" without revealing who. Its output for an app is a **nullifier**, a unique token per person per app.
- The registry binds a device address to a nullifier. That gives **one human, one device**, so nobody can farm rewards with many fake devices. This is **Sybil resistance**.
- The registration page is being built by another developer. The simulator fakes the nullifier today.

## 1.12 Other terms

- **Entity** (Arkiv): one record. **Schema**: its shape.
- **Dataset**: a saved filter (place, radius, kind, device model, date range) plus a price. It is not a list of samples.
- **Epoch**: one batch of reward payouts, numbered from 1.
- **Pool / unallocated rewards**: contributor money in the contract not yet assigned to a published epoch.
- **Treasury**: the platform's share, withdrawable by the owner.
- **Gateway**: the Next.js API routes that glue everything together.
- **Simulator**: `scripts/simulate-device.ts`, stands in for the glasses.

---

# Part 2. Arkiv and our use case

## 2.1 What Arkiv is

Arkiv is a blockchain built to work like a database. Each record is an **entity** with a payload (up to **128 KiB** of bytes) plus **typed, indexed attributes** you can search with equality, ranges and string prefixes. Chain: Rabdi testnet, gas in tGLM. SDK: `@arkiv-network/sdk`.

Properties that shape the design:

| Property | Meaning | Consequence for Odyssey |
| --- | --- | --- |
| **Owner** | The wallet that created the entity. Only it can change, extend or delete it. | Every read filters `.ownedBy(gateway)`, so strangers' look-alike records are ignored. |
| **Expiry** | At most ~182 days (`ExpirationTime.max()`), extendable by the owner for a fee. | A daily job extends what matters. Everything else disappears on purpose. |
| **Read-only flag** | A `readonly` entity can never be edited. | Samples are created read-only. |
| **Indexed attributes** | Searchable. | `geohash`, `device`, `capturedAt`, `contentHash` and others are indexed. |
| **Size limit** | 128 KiB bytes per entity. | Bigger payloads go to 0G. |
| **Public** | Anyone can query and read it. | Payloads are encrypted. Metadata stays public on purpose. |
| **Events** | `EntityCreated`, `EntityPatched`, `ExpiryExtended` from a system contract (`0x4400…0044`). | The Transactions page reads these logs. |

## 2.2 Why Arkiv for this project

- It is the hackathon track, and it fits: tamper-evident records that are searchable by place and time, with no database server to trust for reads.
- Each sample keeps the device's own signature, so a lab can verify authenticity without trusting us.
- The geospatial index layer the brief asked for is the geohash attribute.

## 2.3 What we store

| Schema | One entity is | Key fields |
| --- | --- | --- |
| `odsy.samples` | One signed, encrypted capture | device, worldId, deviceType, mac, kind, capturedAt, lat, lon, geohash, contentHash, storage (`inline`/`0g`), ogRoot, mime, size, sensors (encrypted), signature, data (encrypted), enc, sensorsHash |
| `odsy.devices` | A registered device | device, worldId, deviceType, mac, payout (optional) |
| `odsy.datasets` | A saved filter plus price | name, description, lat, lon, radiusM, kind, deviceType, fromTs, toTs, price (wei), active |
| `odsy.rewards` | One reward epoch's leaves | epoch, root, total, throughBlock, leaves (JSON) |
| `odsy.admins` | An admin grant | admin, grantedBy, grantedAt |
| `odsy.subscriptions` | Legacy payment before the contract | subscriber, dataset, txHash, amount, paidUntil |

## 2.4 The write path (capture to Arkiv)

`POST /api/ingest`, in order:

1. Validate the body: kind, mime, `capturedAt` (not in the future), lat/lon as decimal strings, sensors JSON, base64 data, 65-byte signature.
2. Hash the data to get `contentHash`.
3. Rebuild the signed line and recover the signer.
4. Look the signer up in the device registry. Unknown device means 403.
5. Reject a duplicate `contentHash` (409).
6. Derive the sample key, encrypt the payload and the sensors.
7. If the sealed payload is over 96 KiB, upload it to 0G and keep only `ogRoot`.
8. Create the read-only entity with the maximum expiry, owned by the gateway.

## 2.5 The read path

- **Query by place:** compute the covering geohash prefixes, run prefix queries, then filter by exact distance. Page by `$key`.
- **Dataset membership:** a dataset's filter (centre, radius, kind, device model, dates) is applied to the samples. New captures that match join automatically.
- **Access check for payloads:** an admin sees everything. Anyone else needs an active subscription whose dataset filter matches that sample (see 4.6).
- **Large payloads:** download the ciphertext from 0G by `ogRoot`, decrypt, then check against `contentHash`.

## 2.6 Retention: extend and thin

Because entities expire, `GET /api/cron/extend` runs daily (Bearer `CRON_SECRET`):

- Finds samples expiring within `EXTEND_WITHIN_DAYS` (default 7).
- Keeps **one sample per device, per geohash-7 cell, per hour** (`THIN_GEOHASH_PRECISION=7`, `THIN_WINDOW_SECONDS=3600`), the earliest capture, and lets the rest expire.
- Always extends devices, datasets, reward epochs and admin grants.
- Leaves subscriptions to lapse (legacy only).

Labs can run `LAB_MODE=thinned` to pull only the samples the gateway keeps, using the same rule from `lib/retention.ts`.

## 2.7 Things that surprise people

- **The Transactions page's "Arkiv writes" box can be empty while your data is fine.** It reads recent event logs, and the Arkiv RPC only serves a short window. Check Explore or the dataset cards instead.
- **A sample not extended before day ~182 is gone for good.**
- **Deleting a device** is possible by the gateway (owner), but samples are separate, and the device's reward share is lost if it has no payout wallet at publish time.
- **Trust is the owner filter.** If `ARKIV_PRIVATE_KEY` on Vercel differs from the key the data was written with, reads return nothing.

---

# Part 3. 0G

0G does three separate jobs here. The test chain is **0G Galileo** (chain ID 16602, RPC `https://evmrpc-testnet.0g.ai`, explorer `chainscan-galileo.0g.ai`).

| Job | Detail |
| --- | --- |
| **Payment chain** | Labs pay in the native token **0G**. Contributors are paid in 0G. |
| **Contract host** | `OdsySubscriptions` lives on Galileo (`SUBSCRIPTIONS_ADDRESS`). |
| **File storage** | **0G Storage** holds large encrypted payloads. |

## 3.1 0G as an EVM chain

Galileo is **EVM-compatible**, so MetaMask, `viem` and Foundry work as on Ethereum. We compile with `evm_version = paris`, which avoids newer opcodes so the bytecode runs on any EVM chain. MetaMask asks to add or switch to Galileo on the first payment.

## 3.2 0G Storage

- You upload a file and get back a **root**, the Merkle root of the file. That root is how you fetch it. If one bit differs, the root won't match.
- SDK: `@0gfoundation/0g-storage-ts-sdk` (`Indexer`, `MemData`), with `OG_INDEXER_URL` for the indexer.
- The gateway's 0G key pays the storage fee for each upload.

**Flow for a large capture:** encrypt, and if the ciphertext is over 96 KiB upload it to 0G, then store `storage: "0g"` and `ogRoot` on the Arkiv entity. To read it, a lab takes `ogRoot` from Arkiv, downloads from 0G, decrypts, and checks `contentHash`.

**Mental model:** Arkiv is the index and the signature record. 0G is the warehouse for heavy bytes. The money and the contract sit on the 0G chain.

## 3.3 Arkiv vs 0G at a glance

| | Arkiv (Rabdi) | 0G (Galileo) |
| --- | --- | --- |
| Used for | Searchable records | Payments, contract, large files |
| Coin | tGLM | 0G |
| Data lifetime | At most ~182 days, extendable | Chosen at upload |
| Writers | The gateway | Gateway (files); labs and contributors (payments) |

---

# Part 4. Cash flow

## 4.1 The players and what each puts in or gets out

| Player | Puts in | Gets out |
| --- | --- | --- |
| **Lab** | The dataset price (0G) per 30 days, plus gas | 30 days of access to keys for matching samples |
| **Contract** | Holds all money | Splits each payment 70 / 30 |
| **Contributors** (payout wallets) | Captures, plus gas to claim | Their pro-rata share of the 70% |
| **Owner / operator** | Gas for `setPrice`, `publishRewards`; 0G Storage fees; Arkiv gas (via the gateway) | The 30% treasury, via `withdrawTreasury` |

The gateway server never holds sale proceeds. Money moves only through the contract.

## 4.2 Step by step

```
Lab pays price P  --subscribe(dataset)-->  OdsySubscriptions
                                              |
                     toContributors = P * contributorBps / 10000      (default 70%)
                     treasury       = P - toContributors              (the rest)
                                              |
                  +---------------------------+---------------------------+
                  |                                                       |
        unallocatedRewards += toContributors                  treasuryBalance += treasury
                  |                                                       |
     owner runs rewards:publish                                owner calls withdrawTreasury(to)
        splits pro rata by samples                                        |
        publishRewards(root, total, throughBlock)                         v
        unallocatedRewards -= total                                  owner's wallet
        rewardTotal[epoch]  = total
                  |
     contributor calls claim(epoch, wallet, amount, proof)
        rewardClaimed[epoch] += amount
        coins sent to the contributor's wallet
```

**The contract's rules at subscribe:**

- The amount sent must equal the dataset's price exactly (`WrongAmount` otherwise), and the dataset must be listed (`price > 0`).
- Access = 30 days. A renewal **stacks** from the current `paidUntil`. A lapsed subscription restarts from now.
- Prepaying is capped at **150 days** ahead (`PrepaidTooFar`), matching Arkiv's ~182-day record lifetime.
- The contributor share is `contributorBps` (default **7000 = 70%**), settable by the owner between **5000 and 10000**. Contributors always get at least half. The treasury takes the remainder, so rounding favours the treasury.
- It emits `Subscribed(subscriber, dataset, amount, toContributors, paidUntil)`, which the reward script reads.

## 4.3 Worked example

A lab pays **0.01 0G** for dataset D.

- Contributor pool: 0.007 0G. Treasury: 0.003 0G.
- D currently matches 10 samples. Device A has 6 and device B has 4. Each device has a payout wallet.
- Pro-rata split of 0.007 (amounts are floored in wei): A's wallet gets 0.0042 0G, B's wallet gets 0.0028 0G.
- After `rewards:publish`: the root covers those two leaves, `rewardTotal[1] = 0.007`, `unallocatedRewards` drops by 0.007.
- A and B each call `claim` and receive their amounts. Anyone may send the claim, but the money always goes to the wallet in the leaf.

If devices share a payout wallet, their amounts are summed into one leaf.

## 4.4 How rewards are calculated (`scripts/publish-rewards.ts`)

1. Read `rewardsThroughBlock` and `epoch` from the contract. The window starts at the next block.
2. Collect every `Subscribed` event in the window, summing `toContributors` per dataset.
3. For each paid dataset, count samples per device using **the dataset as it stands now** (today's filter, today's matching samples).
4. Look up each device's payout wallet on Arkiv.
5. Split: `wei * deviceSamples / totalSamples`, floored.
6. Build the Merkle tree of `(epoch, wallet, amount)`.
7. Save `rewards/epoch-N.json`, call `publishRewards(root, total, throughBlock)`, then store the leaves on Arkiv (`--store file` retries that step).
8. `--dry-run` shows the split and publishes nothing.

Contract guards on publishing: root must be non-zero, `total` must not exceed `unallocatedRewards`, and `throughBlock` must be after the last epoch's block and a finished block.

## 4.5 What gets left behind

- **Dust**: flooring leaves a few wei per split in the pool.
- **Devices without a payout wallet**: their share stays unallocated.
- **A paid dataset with no matching samples** (none in the dataset when the script runs): the whole contributor share stays unallocated.

Right now **nothing re-distributes those leftovers**. The script only splits money from new `Subscribed` events, and the owner can't withdraw `unallocatedRewards`. So leftovers sit in the contract. That's a gap to be aware of, not a bug in the accounting.

## 4.6 Who can read the data (what the money buys)

1. The lab signs in, then asks `/api/keys` for specific samples.
2. The gateway reads `paidUntil(lab, dataset)` from the contract and checks the sample matches that dataset's filter.
3. If paid, it returns that sample's key. It never returns `DATA_KEY`.

Limits to remember:

- Keys already handed out can't be revoked, and a lab keeps the data it already pulled.
- Renewal buys new samples and any it hasn't fetched yet.
- The same sample has the same key for every lab. Each lab still needs its own payment to get it.
- A lab could share keys or data with others, and nothing on-chain stops that.

## 4.7 How to see the cash flow

**In the app (Transactions page)**

- *Subscription payments · 0G Galileo*: every payment with amount and **To contributors**. Admins see all, others see their own. A row with "— (before the contract)" is a legacy direct transfer with no split.
- *Contributor rewards · your payout wallet*: each epoch with the amount and a **Claim** button, then "claimed".
- *Arkiv writes*: recent Arkiv log events. This box only covers a short window.

**On the contract (read-only, free)**

```bash
RPC=https://evmrpc-testnet.0g.ai
C=0xYOUR_SUBSCRIPTIONS_ADDRESS

cast call $C "contributorBps()(uint16)"          --rpc-url $RPC   # 7000
cast call $C "treasuryBalance()(uint256)"        --rpc-url $RPC   # owner's money
cast call $C "unallocatedRewards()(uint256)"     --rpc-url $RPC   # contributor money not yet in a root
cast call $C "epoch()(uint256)"                  --rpc-url $RPC   # epochs published
cast call $C "rewardsThroughBlock()(uint256)"    --rpc-url $RPC   # last block covered
cast call $C "rewardTotal(uint256)(uint256)" 1   --rpc-url $RPC   # epoch 1 published total
cast call $C "rewardClaimed(uint256)(uint256)" 1 --rpc-url $RPC   # epoch 1 claimed so far
cast call $C "claimed(uint256,address)(bool)" 1 0xWALLET --rpc-url $RPC
cast call $C "price(bytes32)(uint256)" 0xDATASET_KEY --rpc-url $RPC
cast call $C "paidUntil(address,bytes32)(uint64)" 0xLAB 0xDATASET_KEY --rpc-url $RPC
cast balance $C --rpc-url $RPC --ether                                   # everything the contract holds
```

**Reconciliation check.** The contract's balance should always equal:

```
treasuryBalance + unallocatedRewards + sum over epochs of (rewardTotal - rewardClaimed)
```

If it doesn't, something is wrong.

**Events** (on the explorer, or `cast logs`): `Subscribed`, `RewardsPublished`, `Claimed`, `TreasuryWithdrawn`, `PriceSet`, `ContributorBpsSet`.

**Before publishing:** `npm run rewards:publish -- --dry-run` prints exactly who would get what.

## 4.8 Is it in place?

| Piece | Status |
| --- | --- |
| Contract deployed on Galileo | Done (deploy recorded in the repo docs) |
| Subscribe and the 70/30 split | **Confirmed live**: the Transactions page shows a payment of 0.01 0G with 0.007 0G to contributors |
| Legacy pre-contract payment (Bandra Weather, 0.02 0G) | Shown as "before the contract", with no split |
| Payout wallet per device | Built (set at registration or via `PATCH /api/devices`) |
| Reward epoch publish | Built and unit-tested. **Not yet confirmed live** (no epoch yet, "No rewards for this wallet yet") |
| Claim in the UI | Built and tested in Foundry. **Not yet confirmed live** |
| Treasury withdrawal | Contract function exists. **No UI**, use `cast send` |
| Change the split (`setContributorBps`) | Contract function exists. **No UI** |
| Automated publishing | **Not built.** The owner runs the script by hand. |
| Redistributing leftovers (dust, unpaid devices) | **Not built** (see 4.5) |
| Audit | **Not done.** Use testnet funds only. |

**Design limits worth knowing:**

- The reward split is computed off-chain by the owner. The leaves are public on Arkiv so anyone can recheck, but the contract only enforces totals and proofs, not that the split was fair.
- Rewards follow samples in the dataset at publish time, not when they were captured.
- Operating costs (gas, storage fees, Arkiv writes) are paid by the owner and gateway wallets out of pocket. Nothing automatic takes them from the treasury.
- There are no refunds. Unlisting a dataset (`price = 0`) stops new sales, but access already paid for stays valid.

---

# Part 5. How it feels at user level

## Contributor (owns glasses)

1. Registers the device with a World ID and picks a **payout wallet** (the registration page is being built by another dev).
2. The glasses capture and sign. The gateway stores encrypted samples.
3. When labs subscribe to datasets containing their samples, shares accumulate in the pool.
4. After the owner publishes an epoch, the contributor opens **Activity**, sees the epoch and clicks **Claim**.

## Admin / operator

1. Signs in with an admin wallet (root admins from `ADMIN_ADDRESSES`, more from `/admin`).
2. Creates a dataset: a filter plus a price. This writes it to Arkiv and calls `setPrice` on the contract.
3. Watches Transactions.
4. Runs `npm run rewards:publish` periodically. Withdraws the treasury with `cast`.

## AI lab

1. Signs in with its wallet, opens **Datasets**, clicks **Subscribe**, and confirms the 0G transaction in MetaMask.
2. Runs `npm run lab:ingest` (any schedule). It signs in, reads Arkiv and 0G directly, re-verifies every signature and hash, fetches keys, decrypts, and writes JSONL and files. Runs are incremental.
3. Renews every 30 days to keep receiving new samples.

---

# Part 6. Self-test (answers at the end)

1. Why must every Arkiv read filter by owner?
2. What do you lose if `DATA_KEY` is lost?
3. Why does the contract take a Merkle root instead of a list of payouts?
4. A lab renews its subscription although it already holds keys. Why?
5. What happens to a device's reward share if it has no payout wallet?
6. A sample is 200 days old and was never extended. Where is it?
7. Which wallet pays the 0G Storage fee for a large photo?
8. Why is the device key never used for money?
9. What stops someone replaying a captured login signature?
10. The contract balance is 1.0 0G, `treasuryBalance` is 0.2, `unallocatedRewards` is 0.3 and epoch 1 has `rewardTotal` 0.6 and `rewardClaimed` 0.1. Does it reconcile?

**Answers**

1. Anyone can write entities with the same schema tag. Only the owner field can't be faked, so only the gateway's entities are trusted.
2. Every stored sample becomes unreadable, since each key is derived from it.
3. One small root commits to any number of payouts in one cheap transaction. Each person proves their own line with a short proof.
4. New samples have new keys, and keys are only released while `paidUntil` is in the future. It also keeps contributors paid.
5. It stays unallocated in the contract, and nothing currently redistributes it.
6. Deleted. The record expired, and any 0G file has no pointer to it any more.
7. The gateway's 0G wallet (`OG_PRIVATE_KEY`).
8. Device keys sit on hardware that can be lost or opened. A leak should only let someone sign fake captures, not touch earnings.
9. The nonce. The server accepts each nonce once, and the message also carries the domain and an expiry.
10. Yes: 0.2 + 0.3 + (0.6 − 0.1) = 1.0.

---

## Where things live in the code

| Topic | Path |
| --- | --- |
| Contract | `contracts/src/OdsySubscriptions.sol` |
| Contract tests / deploy | `contracts/test/`, `contracts/script/DeploySubscriptions.s.sol` |
| Arkiv schemas | `web-monorepo/apps/web/lib/schema.ts` |
| Ingest (write path) | `app/api/ingest/route.ts` |
| Encryption | `lib/crypto.ts`, `app/api/keys/route.ts` |
| Access checks | `lib/access.ts` |
| Geohash and queries | `lib/geo.ts`, `lib/query.ts`, `lib/filters.ts` |
| Retention | `lib/retention.ts`, `app/api/cron/extend/route.ts` |
| 0G Storage | `lib/og.ts` |
| Contract calls | `lib/contract.ts`, `lib/subscriptions-abi.ts` |
| Reward math and tree | `lib/rewards.ts`, `scripts/publish-rewards.ts` |
| Sign-in and sessions | `lib/session.ts`, `app/api/auth/*` |
| Admins | `lib/admins.ts`, `app/api/admins`, `app/(app)/admin` |
| Lab ingest | `scripts/lab-ingest.ts` |
| Simulator | `scripts/simulate-device.ts` |
