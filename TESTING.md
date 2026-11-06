# End-to-end testing

Run these in order on a fresh checkout. Everything uses testnets with free tokens: Arkiv Rabdi and 0G Galileo. Budget about an hour, mostly faucets. Tick the boxes as you go.

Use your own wallets. Never paste a private key into chat, Slack or Git.

## 0. Prerequisites

- Node.js 22.10+, Git, [Foundry](https://getfoundry.sh) (`forge`, `cast`), MetaMask.
- An Arkiv access key from hub.arkiv.network/access-keys.
- Wallets (make each with `cast wallet new`):

| Role | Env var | Needs |
|---|---|---|
| Gateway | `ARKIV_PRIVATE_KEY` | tGLM from the Arkiv faucet |
| Owner and consensus operator | `OG_PRIVATE_KEY` | 0G from faucet.0g.ai |
| Device | `DEVICE_PRIVATE_KEY` | nothing |
| Admin | `ADMIN_ADDRESSES` (address only) | a MetaMask account |
| Lab | `LAB_PRIVATE_KEY` | 0G, also imported into MetaMask |
| Payout | `SIM_PAYOUT_ADDRESS` (address only) | a little 0G, in MetaMask |
| Validators (3) | none in the app | a little 0G each |

```bash
git clone https://github.com/AnaSyLabs/Odyssey.git && cd Odyssey
git submodule update --init --recursive
cd web-monorepo && npm install
cp apps/web/.env.example apps/web/.env     # fill every uncommented value
openssl rand -hex 32   # DATA_KEY (back it up) and again for SESSION_SECRET
openssl rand -hex 16   # REGISTRAR_TOKEN and again for CRON_SECRET
```

## 1. Automated checks (no tokens)

```bash
cd contracts && forge test            # expect 24 passed: 14 subscriptions + 10 consensus
cd ../web-monorepo && npm test        # expect pass 13, fail 0
npm run build                         # compiles, lists /mockups and the live routes
```

- [ ] 24 contract tests pass
- [ ] 13 web tests pass
- [ ] build succeeds

## 2. Gateway, subscriptions and rewards

Deploy the subscriptions contract and start the app.

```bash
cd contracts
forge script script/DeploySubscriptions.s.sol --rpc-url galileo --broadcast --private-key $OG_PRIVATE_KEY
# put the address in SUBSCRIPTIONS_ADDRESS and the deploy block in SUBSCRIPTIONS_FROM_BLOCK in apps/web/.env
cd ../web-monorepo && npm run dev       # http://localhost:3000
```

1. **Sign in as admin.** MetaMask on the admin account, click Sign in, sign the message. Expect Datasets, Explore, Activity and a Create dataset form.
2. **Send samples.** In a second terminal: `npm run simulate -- 5` and `npm run simulate -- 5 --kind sensor`. A `409 already registered` on the second run is expected.
3. **Explore.** Search 19.0596, 72.8295 with a 1 km radius. Expect the 10 samples on the map, payloads encrypted.
4. **Create a dataset** (Bandra test, 19.0596 72.8295, radius 1000, price 0.01 0G, leave device model empty). Expect no 502. Copy its key into `LAB_DATASETS`.
5. **Subscribe as the lab.** Switch MetaMask to the lab account, open the dataset, Subscribe, approve Galileo and confirm 0.01 0G. Expect "Paid until" 30 days out and unlocked payloads. Activity shows 0.007 0G to contributors.
6. **Pull the data.** `npm run lab:ingest`. Expect JSONL and files in `apps/web/lab-data/`.
7. **Rewards.** `npm run rewards:publish -- --dry-run` (expect the payout address with 0.007 0G), then without `--dry-run`. Sign in as the payout account, Activity, Claim. The balance rises by about 0.007 0G and a second claim reverts with `AlreadyClaimed`.
8. **Large payload.** `npm run simulate -- 1 ./photo.jpg` with a file over 96 KiB, then `lab:ingest` again. Expect the file through 0G Storage.
9. **Retention.** `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/extend`. Expect a JSON summary.

- [ ] samples visible on Explore
- [ ] dataset created, no 502
- [ ] lab subscribed, payloads unlocked
- [ ] `lab:ingest` wrote files
- [ ] epoch published and claimed, second claim reverts
- [ ] over-96 KiB payload round-trips
- [ ] cron returns a summary

### 2b. World ID enrollment (optional)

Needs a World ID app with a `register-device` action (developer.world.org; use a staging app with simulator.worldcoin.org). Set `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY` and `WORLD_ENVIRONMENT=staging`, restart, and sign in.

1. Open `/enroll`, enter the glasses' (or a simulated) device address and MAC.
2. Approve the request in World App or the simulator.
3. Expect the device registered with your wallet as payout, visible on `/capture`.
4. Enroll the same device again: `409 already registered`. Use the same World ID for another device: `409 already has a device`.
5. After the ban in part 3, a banned World ID gets `403` here too.

- [ ] enrollment registers the device and sets the payout wallet
- [ ] a proof for a different device address is rejected

## 3. Consensus contract and the ban

### 3a. Deploy and check

```bash
cd contracts
cp .env.example .env        # ADMIN and OPERATOR = the owner wallet's address, COMMITTEE_SIZE=3
forge script script/Deploy.s.sol --rpc-url galileo --private-key $OG_PRIVATE_KEY            # dry run
forge script script/Deploy.s.sol --rpc-url galileo --private-key $OG_PRIVATE_KEY --broadcast
export CONSENSUS=0x...      # the printed address; also set CONSENSUS_ADDRESS in apps/web/.env, then restart npm run dev
cast call $CONSENSUS "quorumBps()(uint16)" --rpc-url galileo      # 6667
cast call $CONSENSUS "committeeSize()(uint8)" --rpc-url galileo   # 3
cast call $CONSENSUS "strikeLimit()(uint8)" --rpc-url galileo     # 2
```

### 3b. A tile is accepted

```bash
R="--rpc-url galileo --private-key $OG_PRIVATE_KEY"
V=$(cast keccak VALIDATOR)
cast send $CONSENSUS "grantRole(bytes32,address)" $V <validator1> $R     # repeat for validators 2 and 3
DS=$(cast keccak "e2e-dataset")
cast send $CONSENSUS "createDataset(bytes32,(uint8,uint32,uint32,uint32,uint16,uint8,bool))" $DS "(8,86400,20,3,300,70,false)" $R
cast send $CONSENSUS "submitTile(bytes32,uint64,uint64,bytes32,uint32,uint32)" $DS 1 20000 0x0000000000000000000000000000000000000000000000000000000000000001 400 5 $R
ID=$(cast call $CONSENSUS "tileId(bytes32,uint64,uint64)(bytes32)" $DS 1 20000 --rpc-url galileo)
cast call $CONSENSUS "tiles(bytes32)(bytes32,uint32,uint32,uint8,uint8)" $ID --rpc-url galileo   # checked = 12, status 2 (Open)
# each validator votes: 10 of 12 checked clips passed
cast send $CONSENSUS "vote(bytes32,uint32)" $ID 10 --rpc-url galileo --private-key <validator key>   # x3
cast call $CONSENSUS "tiles(bytes32)(bytes32,uint32,uint32,uint8,uint8)" $ID --rpc-url galileo   # status 3 (Accepted), votes 3
```

Rejection: submit another tile and vote 8, 8, 8. 8 of 12 is below two thirds, so status 4 (Rejected). A tile with fewer than 20 clips stays Pending (status 1) and rejects votes.

### 3c. Two strikes ban a human, through the gateway

Register a simulated device with a known World ID, then ban it.

```bash
cd web-monorepo
export SIM_WORLD_ID=0x00000000000000000000000000000000000000000000000000000000000e2e1
npm run simulate -- 2                    # registers and uploads 2 samples, expect 201
W=$SIM_WORLD_ID
KIND=$(cast format-bytes32-string replay)
REF1=$(cast format-bytes32-string ref1); REF2=$(cast format-bytes32-string ref2)
cast send $CONSENSUS "raiseAlert(bytes32,bytes32,bytes32)" $W $KIND $REF1 $R   # strike 1
cast call $CONSENSUS "isBanned(bytes32)(bool)" $W --rpc-url galileo                # false
cast send $CONSENSUS "raiseAlert(bytes32,bytes32,bytes32)" $W $KIND $REF2 $R   # strike 2
cast call $CONSENSUS "isBanned(bytes32)(bool)" $W --rpc-url galileo                # true
```

Wait 60 seconds (the gateway caches bans), then check each effect:

| Check | Expected |
|---|---|
| `npm run simulate -- 1` from the banned device | `403 this World ID is banned` |
| Register another device with the same `SIM_WORLD_ID` | `403 this World ID is banned` (or `409` if one is already bound) |
| As the lab, `POST /api/keys` for the banned device's samples captured after its first strike | listed under `denied`, no key |
| Explore, sample marked readable for the lab | `readable: false` |
| An admin | still reads everything |
| `lift` (below), wait 60 s, upload again | `201` |

```bash
cast send $CONSENSUS "lift(bytes32)" $W $R
cast call $CONSENSUS "isBanned(bytes32)(bool)" $W --rpc-url galileo    # false
```

### 3d. The automatic strike

A clip another human already uploaded is a `replay` strike.

```bash
SIM_WORLD_ID=0x00000000000000000000000000000000000000000000000000000000000e2e2 DEVICE_PRIVATE_KEY=<a new device key> npm run simulate -- 1 ./same-file.txt
SIM_WORLD_ID=0x00000000000000000000000000000000000000000000000000000000000e2e3 DEVICE_PRIVATE_KEY=<another key> npm run simulate -- 1 ./same-file.txt
```

The second upload returns `409 duplicate`. Then `cast call $CONSENSUS "strikes(bytes32)(uint8)" 0x00000000000000000000000000000000000000000000000000000000000e2e3 --rpc-url galileo` returns 1. The same device uploading the same file twice must not add a strike.

- [ ] tile accepted at 10 of 12, rejected at 8 of 12, small tile pending
- [ ] two alerts ban, one does not
- [ ] banned World ID gets 403 on upload and registration
- [ ] banned samples are not decryptable by a subscriber, admin still reads
- [ ] `lift` restores access
- [ ] replay from another World ID adds exactly one strike

## 4. Pages

With `npm run dev` running, open each and check it loads without errors:

- [ ] `/` landing, with a Mockups button that opens `/mockups`
- [ ] `/mockups` and its four screens open without sign-in
- [ ] `/datasets`, `/explore`, `/activity` show the sign-in overlay until a wallet signs in
- [ ] `/device`, `/wiring`, `/docs` open without sign-in; `/docs` links the deployed contract

## 5. MCP server

With `npm run dev` running and a wallet signed in:

```bash
# mint a token from a signed-in browser session cookie, or use the Create token button on /datasets
T=<token>
curl -s -X POST localhost:3000/api/mcp -H "authorization: Bearer $T" -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
curl -s -X POST localhost:3000/api/mcp -H "authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_samples","arguments":{"dataset":"<dataset key>","query":"note"}}}'
```

- [ ] no token, or a session cookie used as a token, returns `401`
- [ ] `tools/list` shows `list_datasets`, `search_samples`, `get_sample`
- [ ] a subscribed lab finds its text samples; a wallet without a subscription gets "no active subscription for that dataset"
- [ ] `get_sample` returns the decrypted text; a banned World ID's later samples are refused
- [ ] connect Claude Code (`claude mcp add --transport http ...`) and ask it to list your datasets

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `command not found: forge` | Foundry is not on PATH; run `foundryup` and reopen the terminal |
| `Set X in .env` | That variable is empty or commented out |
| `must be 0x + 64 hex` | An address where a private key goes |
| 502 creating a dataset | `setPrice` failed: the owner wallet has no 0G, or `OG_PRIVATE_KEY` did not deploy the contract |
| 401 from the simulator | `REGISTRAR_TOKEN` is empty |
| Arkiv writes fail with insufficient funds | The gateway wallet has no tGLM |
| Ban has no effect | `CONSENSUS_ADDRESS` unset, the dev server was not restarted, or the 60 s cache has not expired |
| `forge` fails to find OpenZeppelin | Run `git submodule update --init --recursive` in the repo root |
| Lab ingest finds 0 samples | The dataset's device model or dates exclude them; recreate it with those fields empty |
