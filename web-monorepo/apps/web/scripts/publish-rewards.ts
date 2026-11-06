// Admin job: turns the contributor share of new subscription payments into one reward epoch.
// For every Subscribed event since the last epoch it splits the dataset's contributor revenue across the
// dataset's current samples, pro rata by device, paid to each device's payout wallet; then it publishes the
// Merkle root on OdsySubscriptions and stores the leaves on Arkiv so contributors can claim.
// Run: node --env-file=.env scripts/publish-rewards.ts [--dry-run]
//      node --env-file=.env scripts/publish-rewards.ts --store rewards/epoch-3.json   (retry the Arkiv write)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicClient as createArkivPublic, createWalletClient as createArkivWallet, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, asc, eq, gt } from "@arkiv-network/sdk/query";
import { addr, key, u256, u64 } from "@arkiv-network/sdk/schema";
import { createPublicClient, createWalletClient, formatEther, getAddress, type Hex, http, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { galileo } from "../lib/chains.ts";
import { datasetFilter, filterWhere, matches, sampleFields } from "../lib/filters.ts";
import { allocate, type Leaf, rewardTree } from "../lib/rewards.ts";
import { Datasets, Devices, Rewards, Samples } from "../lib/schema.ts";
import { subscriptionsAbi } from "../lib/subscriptions-abi.ts";

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
const LOG_CHUNK = 10_000n;
const dryRun = process.argv.includes("--dry-run");
const storeAt = process.argv.indexOf("--store");

const contract = getAddress(env("SUBSCRIPTIONS_ADDRESS"));
const og = createPublicClient({ chain: galileo, transport: http(process.env.OG_RPC_URL) });
const owner = createWalletClient({ chain: galileo, transport: http(process.env.OG_RPC_URL), account: privateKeyToAccount(hexKey("OG_PRIVATE_KEY")) });
const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });
const arkiv = createArkivPublic({ chain, transport: http() });
const gatewayWallet = createArkivWallet({ chain, transport: http(), account: privateKeyToAccount(hexKey("ARKIV_PRIVATE_KEY")) });
const gateway = gatewayWallet.account.address;

type Epoch = { epoch: string; root: Hex; total: string; throughBlock: string; leaves: [string, string][] };

/** Stores an epoch's leaves on Arkiv, where /api/rewards reads them to build claim proofs. */
// shortcut: one entity holds ~2,000 leaves (128 KiB); split an epoch across entities beyond that.
async function store(e: Epoch) {
  const { entityKey } = await gatewayWallet.createEntity(
    Rewards,
    { epoch: u64(BigInt(e.epoch)), root: e.root, total: u256(BigInt(e.total)), throughBlock: u64(BigInt(e.throughBlock)), leaves: new TextEncoder().encode(JSON.stringify(e.leaves)) },
    { expiration: ExpirationTime.max() },
  );
  console.log(`stored epoch ${e.epoch} leaves on Arkiv: ${entityKey}`);
}

if (storeAt >= 0) {
  await store(JSON.parse(readFileSync(process.argv[storeAt + 1], "utf8")));
  process.exit(0);
}

const read = <F extends "rewardsThroughBlock" | "epoch">(functionName: F) => og.readContract({ address: contract, abi: subscriptionsAbi, functionName });
const [last, epoch, latest] = await Promise.all([read("rewardsThroughBlock"), read("epoch"), og.getBlockNumber()]);
const fromBlock = last > 0n ? last + 1n : BigInt(env("SUBSCRIPTIONS_FROM_BLOCK"));
const throughBlock = latest - 1n; // the contract only accepts finished blocks
if (throughBlock < fromBlock) {
  console.log("No finished blocks since the last epoch.");
  process.exit(0);
}

// 1. Contributor revenue per dataset in the window.
const revenue = new Map<string, bigint>();
for (let from = fromBlock; from <= throughBlock; from += LOG_CHUNK) {
  const to = from + LOG_CHUNK - 1n < throughBlock ? from + LOG_CHUNK - 1n : throughBlock;
  for (const e of await og.getContractEvents({ address: contract, abi: subscriptionsAbi, eventName: "Subscribed", fromBlock: from, toBlock: to })) {
    const d = e.args.dataset!.toLowerCase();
    revenue.set(d, (revenue.get(d) ?? 0n) + e.args.toContributors!);
  }
}
if (!revenue.size) {
  console.log(`No subscriptions in blocks ${fromBlock}-${throughBlock}.`);
  process.exit(0);
}

// 2. Samples per device in each paid dataset (the dataset as it stands now).
const samples = new Map<string, Map<string, number>>();
for (const ds of revenue.keys()) {
  const d = await arkiv.getEntity(ds as Hex, Datasets).catch(() => null);
  if (!d || d.$owner.toLowerCase() !== gateway.toLowerCase()) continue;
  const f = datasetFilter(d);
  const counts = new Map<string, number>();
  for (let after: Hex | undefined; ;) {
    const { entities } = await arkiv.select({ $key: true, device: true, lat: true, lon: true, kind: true, deviceType: true, capturedAt: true })
      .from(Samples, { onMismatch: "throw" }).where(and(...filterWhere(f), ...(after ? [gt("$key", key(after))] : [])))
      .ownedBy(gateway).orderBy(asc("$key")).limit(100).fetch();
    for (const s of entities) if (matches(f, sampleFields(s))) counts.set(s.device.value.toLowerCase(), (counts.get(s.device.value.toLowerCase()) ?? 0) + 1);
    if (entities.length < 100) break;
    after = entities.at(-1)!.$key;
  }
  samples.set(ds, counts);
}

// 3. Payout wallet per device; devices without one keep their share in the contract's unallocated pool.
const payout = new Map<string, `0x${string}` | undefined>();
for (const device of new Set([...samples.values()].flatMap((m) => [...m.keys()]))) {
  const { entities } = await arkiv.select({ payout: true }).from(Devices).where(eq("device", addr(device))).ownedBy(gateway).limit(1).fetch();
  payout.set(device, entities[0]?.payout?.value);
}

const next = epoch + 1n;
const leaves: Leaf[] = [...allocate(revenue, samples, payout)].map(([account, amount]) => [next, account, amount]);
const total = leaves.reduce((s, l) => s + l[2], 0n);
const earned = [...revenue.values()].reduce((a, b) => a + b, 0n);
console.log(`Blocks ${fromBlock}-${throughBlock}: ${formatEther(earned)} 0G contributor revenue across ${revenue.size} dataset(s).`);
for (const [, account, amount] of leaves) console.log(`  ${account}  ${formatEther(amount)} 0G`);
const unpaid = [...payout].filter(([, p]) => !p).map(([d]) => d);
if (unpaid.length) console.log(`  devices without a payout wallet (share stays unallocated): ${unpaid.join(", ")}`);
if (!leaves.length) {
  console.log("Nothing to pay out; no epoch published.");
  process.exit(0);
}

const tree = rewardTree(leaves);
const record: Epoch = { epoch: next.toString(), root: tree.root as Hex, total: total.toString(), throughBlock: throughBlock.toString(), leaves: leaves.map(([, a, v]) => [a, v.toString()]) };
console.log(`Epoch ${next}: root ${tree.root}, total ${formatEther(total)} 0G`);
if (dryRun) process.exit(0);

// Save the leaves before publishing: without them nobody could build a proof for the new root.
mkdirSync("rewards", { recursive: true });
const file = `rewards/epoch-${next}.json`;
writeFileSync(file, JSON.stringify(record, null, 2));
const hash = await owner.writeContract({ address: contract, abi: subscriptionsAbi, functionName: "publishRewards", args: [tree.root as Hex, total, throughBlock] });
const receipt = await og.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error(`publishRewards reverted: ${hash}`);
console.log(`published epoch ${next}: ${hash}`);
try {
  await store(record);
} catch (e) {
  console.error(`Root is on-chain but storing leaves on Arkiv failed (${(e as Error).message}). Retry with: --store ${file}`);
  process.exit(1);
}
