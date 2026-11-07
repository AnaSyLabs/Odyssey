// Admin job: turns the contributor share of new subscription payments into one reward epoch.
// For every Subscribed event since the last epoch it splits the dataset's contributor revenue across the
// dataset's current samples, pro rata by device, paid to each device's payout wallet; then it publishes the
// Merkle root on OdsySubscriptions and stores the leaves on Arkiv so contributors can claim.
// The same logic runs from the admin page's "Publish rewards" button (lib/rewards-publish.ts).
// Run: node --env-file=.env scripts/publish-rewards.ts [--dry-run]
//      node --env-file=.env scripts/publish-rewards.ts --store rewards/epoch-3.json   (retry the Arkiv write)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { formatEther, isHex } from "viem";
import { type Epoch, makeDeps, planEpoch, publishEpoch, storeEpoch } from "../lib/rewards-publish.ts";

const env = (n: string) => {
  const v = process.env[n];
  if (!v) throw new Error(`Set ${n} in .env`);
  return v;
};
const hexKey = (n: string) => {
  const v = env(n);
  if (!isHex(v) || v.length !== 66) throw new Error(`${n} must be 0x + 64 hex`);
  return v;
};
const dryRun = process.argv.includes("--dry-run");
const storeAt = process.argv.indexOf("--store");

const deps = makeDeps({
  contract: env("SUBSCRIPTIONS_ADDRESS"),
  fromBlock: process.env.SUBSCRIPTIONS_FROM_BLOCK,
  ogRpc: process.env.OG_RPC_URL,
  accessKey: process.env.ARKIV_ACCESS_KEY,
  ogKey: hexKey("OG_PRIVATE_KEY"),
  arkivKey: hexKey("ARKIV_PRIVATE_KEY"),
});

if (storeAt >= 0) {
  const e: Epoch = JSON.parse(readFileSync(process.argv[storeAt + 1], "utf8"));
  console.log(`stored epoch ${e.epoch} leaves on Arkiv: ${await storeEpoch(deps, e)}`);
  process.exit(0);
}

const r = await planEpoch(deps);
if ("none" in r) {
  console.log(r.none);
  process.exit(0);
}
const p = r.plan;
console.log(`Blocks ${p.fromBlock}-${p.throughBlock}: ${formatEther(p.earned)} 0G contributor revenue across ${p.datasets} dataset(s).`);
for (const [, account, amount] of p.leaves) console.log(`  ${account}  ${formatEther(amount)} 0G`);
if (p.unpaid.length) console.log(`  devices without a payout wallet (share stays unallocated): ${p.unpaid.join(", ")}`);
console.log(`Epoch ${p.epoch}: root ${p.root}, total ${formatEther(p.total)} 0G`);
if (dryRun) process.exit(0);

// Save the leaves before publishing: without them nobody could build a proof for the new root.
const file = `rewards/epoch-${p.epoch}.json`;
const out = await publishEpoch(deps, p, (rec) => {
  mkdirSync("rewards", { recursive: true });
  writeFileSync(file, JSON.stringify(rec, null, 2));
});
console.log(`published epoch ${p.epoch}: ${out.hash}`);
if (out.storeError) {
  console.error(`Root is on-chain but storing leaves on Arkiv failed (${out.storeError}). Retry with: --store ${file}`);
  process.exit(1);
}
console.log(`stored epoch ${p.epoch} leaves on Arkiv: ${out.entityKey}`);
