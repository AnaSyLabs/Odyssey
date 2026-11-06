# Milestones achieved

Commit hashes are from `main`. PR merges show the merge commit, followed by the feature commits it brought in.

## M1. Repo foundation (6 Nov 2026)

| Done | Commit |
|---|---|
| Agent rules: no unasked commits, YAGNI, Ponytail | `3da831f` |
| Solidity security skills: OpenZeppelin `develop-secure-contracts` and `setup-solidity-contracts` | `bbe5087`, `77157f6` |
| Pashov `solidity-auditor` skill | `cc8763c`, `48d8877`, `524b59c`, `0665208` |
| Trail of Bits `guidelines-advisor`, `secure-workflow-guide`, `token-integration-analyzer` skills | `f0b6545`, `db4271c`, `0865afc`, `ec68e53`, `1ca92fa`, `03e206f` |
| Proof-of-Reality README and repo layout | `6352a2d` |

## M2. Web app and mock screens (6 Nov 2026)

| Done | Commit |
|---|---|
| npm workspace and Next.js scaffold, lockfile | `cd77fcb`, `ae9603e` |
| 3D glasses model and product intro | `9a399b6` |
| App shell, theme tokens, landing page | `5962637` |
| Capture device and wiring/firmware pages | `6cbc620` |
| Protocol docs page | `9e4ad35` |
| Datasets marketplace, H3 hex consensus map, enrollment, analytics, registered devices (mock data) | `e2d259f`, `0e52a01`, `0ed4580`, `e9e4a99`, `8362f77` |
| Wiring lesson picker moved above the diagram | `3fcef46` |
| Landing key figures grouped in a card | `e3b3fce` |

## M3. README, screenshots, mockups entry (6 Nov 2026)

| Done | Commit |
|---|---|
| README mockup and screenshots (PR #3) | `2028354` |
| Mockups index page and landing button | `f6a9ae6` |
| Single Mockups entry in the nav | `029ac57` |

## M4. Arkiv data layer and subscriptions (5 to 6 Nov 2026, Muneeb Illahi)

Merged through PRs #1, #2, #4, #5 and #7.

| Done | Commit |
|---|---|
| Arkiv, viem and 0G Storage dependencies; scripts, env template | `00e1022`, `fbf0ccb` |
| Arkiv schemas, geohash index, device sample protocol | `298d298` |
| Payload encryption, wallet sessions, access control | `6797256` |
| Device registry and encrypted sample ingest | `073c6ba` |
| Geo sample queries and verified reads | `89e9c64` |
| SIWE auth, datasets, subscriptions, key release APIs | `23e4953` |
| Retention cron and activity feed | `563e110` |
| Device simulator and lab-side ingest job | `66cae9f` |
| Wallet sign-in in the app shell; mock screens moved to `/mockups` | `c28ea6a` |
| Datasets marketplace on Arkiv and 0G payments | `7958cb2` |
| Live H3 coverage map, sample explorer, transactions page | `1edfbe2` |
| Skeleton loaders and sign-in overlay; wallet disconnect on sign-out | `64df833`, `d3bbd9e` |
| `OdsySubscriptions` contract with contributor reward claims | `1cf9394` |
| Subscriptions ABI; paying through the contract | `b1d9946`, `0f552d6` |
| Payout wallets and contributor reward epochs | `007e0de` |
| Merge commits | `4a9b683`, `c678346`, `4d199c7`, `3472432`, `e390aa4` |

## M5. Consensus contract (6 Nov 2026)

| Done | Commit |
|---|---|
| `ConsensusRegistry`: per-dataset rules, tile verdicts by validator median, two-strike World ID ban; 10 Foundry tests; deploy script and env | `682ce19` |
| Plain-language docs for it in the README and protocol page | `18ed4a2` |
| Merged to `main` (PR #6) | `cf3beb8` |
| Deployed to 0G Galileo: `0x83bea227e5D2C72f8F0F73E63175759D4E6055DC`, tx `0x032d1d358c84b4563dc39516c776d7198f0046f3b588ff7ed9db33490be12e34`, block 64,080,632 | (no commit: on-chain) |
| Live run: 3 validators voted, tile accepted; 2 alerts banned a World ID; `lift` cleared it | (no commit: on-chain) |

## M6. Gateway enforces the ban, repo hygiene, docs (6 Nov 2026)

| Done | Commit |
|---|---|
| Root `.gitignore`, forge `broadcast/` ignored, `.idea` untracked | `72bef96` |
| Gateway enforces bans: 403 on ingest and registration, no decryption, no retention; `replay` strike | `89d17d0` |
| README deployment table and docs aligned with the live app | `129a63d` |
| Merged to `main` (PR #8) | `a7415ee` |

## M7. Subscriptions contract deployed (6 Nov 2026)

| Done | Commit |
|---|---|
| `OdsySubscriptions` deployed to Galileo: `0xc3a946516f2f0CE3fc2065543cb0a8E9b105A54e`, tx `0xc83445b99003f52c1e12007bc8072edf5c95c54f7ae1b6cd4875b2c40f7ef980`, block 64,085,686; `owner()` and `contributorBps()` (7000) checked | (no commit: on-chain) |
| Cause of the signed-in 500s traced to the missing `SUBSCRIPTIONS_ADDRESS` and fixed locally | (no commit: env only) |

## M8. Plan, milestones and testing docs (6 Nov 2026)

| Done | Commit |
|---|---|
| `PLAN.md` rewrite, `MILESTONE.md`, end-to-end `TESTING.md` | `998b6a5`, `58c846b`, `d42a0e1` |
| `OdsySubscriptions` deploy recorded; sponsor track mapping and deployed contracts in README and protocol docs | `a91c1f7`, `408541d` |
| Cash-flow section and diagram; payout claims corrected | `9f9ada6`, `51d7579` |
| Merged to `main` (PRs #9, #10, #13) | `2fce039`, `3c58b28`, `69a2306` |

## M9. MCP server (6 Nov 2026)

| Done | Commit |
|---|---|
| MCP token, keyword ranking and JSON-RPC core with tests | `0093dfe` |
| Datasets served over MCP at `/api/mcp` with bearer tokens; token card on the datasets page | `5d4c4c6`, `d840c73` |
| Docs in README, protocol page and TESTING | `1f8747b` |
| Per-client setup (Claude Code, Cursor, Claude Desktop, other); hosted-server docs | `e190fd0`, `d9bb2e2` |
| Token-free `.mcp.json` for Claude Code without its CLI | `d1519ea`, `e7c9482` |
| Merged to `main` (PRs #11, #15, #16) | `66debde`, `7194ecf`, `9dc4c99` |

## M10. Admin grants (6 Nov 2026, Muneeb Illahi)

| Done | Commit |
|---|---|
| Admin grants stored on Arkiv, `/api/admins` to list, grant and revoke, Admins page | `e4b7de7`, `8c88ddc`, `f7d2e40` |
| Grants kept alive by the daily extend job; root vs granted admins documented | `3f2761d`, `57bd7f6` |
| Merged to `main` (PR #14) | `213d08e` |

## M11. Glasses firmware, World ID enrollment, live capture (6 Nov 2026, Mir Aatif Rafiq)

| Done | Commit |
|---|---|
| `odsy_glasses_camera` streamer, enrollment and live capture screens | `96cd161` |
| Signed touch-capture photos and real World ID enrollment | `3267436` |
| Docs for `/enroll`, `/capture`, `/admin` and the firmware | `a9d3256` |
| Explicit `WORLD_ENVIRONMENT` | `5d6f2c3` |
| Merged to `main` (PRs #12, #18) | `a64c782`, `d2b762a` |

## M12. Activity fix and live analytics (6 Nov 2026)

| Done | Commit |
|---|---|
| `/api/activity` reads only the recent blocks the Arkiv RPC serves (no more 500); feed covers about 25 minutes | `97e1185`, `06743bc` |
| Analytics helpers and payment time on `/api/subscriptions` | `f2bd62b` |
| Live `/analytics` page with contributor, lab and platform views; docs | `1f5224d`, `c6d5299` |
| Merged to `main` (PRs #17, #19) | `6eb329b`, `5bebd2c` |

## History note

The first 25 commits were rewritten and force-pushed on 6 Nov 2026 (README, skills and web scaffold in smaller commits, no co-author trailers). Branches created before that kept the old hashes, so `git log main` also shows pre-rewrite duplicates. Use `git log --first-parent main` for the clean line.
