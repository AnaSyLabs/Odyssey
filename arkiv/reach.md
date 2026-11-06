# Reach

## Who it is for

**Buyers: AI and robotics labs** training embodied models. They need first-person, real-world data (what a person sees, hears and does) and today they either scrape it without consent or pay for closed collections they cannot audit. Odsy gives them datasets where every sample is traceable to a registered device, a World ID-verified human, a place and a time, with a signature they can re-check themselves.

**Sellers: people who capture data**: anyone with Odsy glasses (ESP32 + camera + mic + IMU, firmware in [`firmware/`](../firmware)), and later phones. They earn 70 % of every subscription to a dataset their samples are in, claimed per reward epoch.

**Would they use it?** Labs already pay for this data; the gap is trust and consent, which is what Odsy adds. Contributors get paid for something their devices already record. One human, one device (World ID) keeps a single person from farming rewards with fake devices.

## Can they try it today

Yes.

| Who | How | Needs |
|---|---|---|
| Anyone | **https://odyssey-blush-seven.vercel.app**: landing, protocol docs, 3D device, wiring lessons, demo screens under `/mockups` | Nothing |
| Lab | Sign in with a wallet on `/datasets`, browse datasets and sample metadata from Arkiv, subscribe with test 0G on Galileo, decrypt samples on `/explore` | Browser wallet, test 0G |
| Lab, programmatic | `npm run lab:ingest` copies a subscribed dataset from Arkiv into its own warehouse, checking every signature | Paying wallet key |
| Lab, AI tools | MCP server: `list_datasets`, `search_samples`, `get_sample` from Claude, Cursor or any MCP client, with a 7-day token from `/datasets` | Subscription |
| Contributor | `/enroll`: bind glasses to a World ID and a payout wallet; or `npm run simulate` to act as a device | World App (or the staging simulator) |

Step-by-step test plan: [TESTING.md](../TESTING.md).

**Numbers on Arkiv right now** (Rabdi, owned by the gateway `0x51f18a28F4C17121770782aC95B9baAf6257053a`, 6 Nov 2026): 35 samples, 4 registered devices, 2 datasets, 1 admin grant.

## After Mumbai

Next steps, from [PLAN.md](../PLAN.md):

1. Real data: more glasses built and enrolled, captures from real places instead of the simulator.
2. Run the reward flow end to end: first epoch published, first contributor claim.
3. Automatic consensus: validators score tiles without hand-driven scripts, verdicts gate payouts.
4. Lift the known shortcuts (each marked `shortcut:` in the code), starting with the 2,000-sample scan cap on geo queries and the in-request retention job.
5. First lab pilots on a real dataset.
