// Reward epochs: works out the next payout split from on-chain subscriptions and Arkiv samples (planEpoch),
// then publishes its Merkle root and stores its leaves (publishEpoch). Shared by scripts/publish-rewards.ts and
// the admin button (POST /api/rewards/publish). No "server-only" import so the script can run it too.
import { createPublicClient as createArkivPublic, createWalletClient as createArkivWallet, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, asc, eq, gt } from "@arkiv-network/sdk/query";
import { addr, key, u256, u64 } from "@arkiv-network/sdk/schema";
import { createPublicClient, createWalletClient, getAddress, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { galileo } from "./chains.ts";
import { datasetFilter, filterWhere, matches, sampleFields } from "./filters.ts";
import { allocate, type Leaf, rewardTree } from "./rewards.ts";
import { Datasets, Devices, Rewards, Samples } from "./schema.ts";
import { subscriptionsAbi } from "./subscriptions-abi.ts";

const LOG_CHUNK = 10_000n;

export type Env = { contract: string; fromBlock?: string; ogRpc?: string; accessKey?: string; ogKey: Hex; arkivKey: Hex };

/** Chain clients: Galileo for the contract (owner wallet signs publishRewards), Arkiv for samples and stored leaves. */
export function makeDeps(e: Env) {
  const chain = rabdi({ accessKey: e.accessKey ?? "" });
  const gatewayWallet = createArkivWallet({ chain, transport: http(), account: privateKeyToAccount(e.arkivKey) });
  return {
    contract: getAddress(e.contract),
    fromBlock: e.fromBlock,
    og: createPublicClient({ chain: galileo, transport: http(e.ogRpc) }),
    owner: createWalletClient({ chain: galileo, transport: http(e.ogRpc), account: privateKeyToAccount(e.ogKey) }),
    arkiv: createArkivPublic({ chain, transport: http() }),
    gatewayWallet,
    gateway: gatewayWallet.account.address,
  };
}
export type Deps = ReturnType<typeof makeDeps>;

export type Epoch = { epoch: string; root: Hex; total: string; throughBlock: string; leaves: [string, string][] };
export type Plan = {
  epoch: bigint; fromBlock: bigint; throughBlock: bigint; earned: bigint; datasets: number;
  leaves: Leaf[]; total: bigint; root: Hex; unpaid: string[]; record: Epoch;
};
export type PlanResult = { none: string } | { plan: Plan };

/** Works out the next epoch without writing anything. `none` says why there is nothing to publish. */
export async function planEpoch(d: Deps): Promise<PlanResult> {
  const read = <F extends "rewardsThroughBlock" | "epoch">(functionName: F) => d.og.readContract({ address: d.contract, abi: subscriptionsAbi, functionName });
  const [last, epoch, latest] = await Promise.all([read("rewardsThroughBlock"), read("epoch"), d.og.getBlockNumber()]);
  if (last === 0n && !d.fromBlock) throw new Error("Set SUBSCRIPTIONS_FROM_BLOCK");
  const fromBlock = last > 0n ? last + 1n : BigInt(d.fromBlock!);
  const throughBlock = latest - 1n; // the contract only accepts finished blocks
  if (throughBlock < fromBlock) return { none: "No finished blocks since the last epoch." };

  // 1. Contributor revenue per dataset in the window.
  const revenue = new Map<string, bigint>();
  for (let from = fromBlock; from <= throughBlock; from += LOG_CHUNK) {
    const to = from + LOG_CHUNK - 1n < throughBlock ? from + LOG_CHUNK - 1n : throughBlock;
    for (const e of await d.og.getContractEvents({ address: d.contract, abi: subscriptionsAbi, eventName: "Subscribed", fromBlock: from, toBlock: to })) {
      const ds = e.args.dataset!.toLowerCase();
      revenue.set(ds, (revenue.get(ds) ?? 0n) + e.args.toContributors!);
    }
  }
  if (!revenue.size) return { none: `No subscriptions in blocks ${fromBlock}-${throughBlock}.` };

  // 2. Samples per device in each paid dataset (the dataset as it stands now).
  const samples = new Map<string, Map<string, number>>();
  for (const ds of revenue.keys()) {
    const row = await d.arkiv.getEntity(ds as Hex, Datasets).catch(() => null);
    if (!row || row.$owner.toLowerCase() !== d.gateway.toLowerCase()) continue;
    const f = datasetFilter(row);
    const counts = new Map<string, number>();
    for (let after: Hex | undefined; ;) {
      const { entities } = await d.arkiv.select({ $key: true, device: true, lat: true, lon: true, kind: true, deviceType: true, capturedAt: true })
        .from(Samples, { onMismatch: "throw" }).where(and(...filterWhere(f), ...(after ? [gt("$key", key(after))] : [])))
        .ownedBy(d.gateway).orderBy(asc("$key")).limit(100).fetch();
      for (const s of entities) if (matches(f, sampleFields(s))) counts.set(s.device.value.toLowerCase(), (counts.get(s.device.value.toLowerCase()) ?? 0) + 1);
      if (entities.length < 100) break;
      after = entities.at(-1)!.$key;
    }
    samples.set(ds, counts);
  }

  // 3. Payout wallet per device; devices without one keep their share in the contract's unallocated pool.
  const payout = new Map<string, `0x${string}` | undefined>();
  for (const device of new Set([...samples.values()].flatMap((m) => [...m.keys()]))) {
    const { entities } = await d.arkiv.select({ payout: true }).from(Devices).where(eq("device", addr(device))).ownedBy(d.gateway).limit(1).fetch();
    payout.set(device, entities[0]?.payout?.value);
  }

  const next = epoch + 1n;
  const leaves: Leaf[] = [...allocate(revenue, samples, payout)].map(([account, amount]) => [next, account, amount]);
  const earned = [...revenue.values()].reduce((a, b) => a + b, 0n);
  const unpaid = [...payout].filter(([, p]) => !p).map(([dev]) => dev);
  if (!leaves.length) return { none: "Nothing to pay out; no epoch published." };
  const total = leaves.reduce((s, l) => s + l[2], 0n);
  const root = rewardTree(leaves).root as Hex;
  const record: Epoch = { epoch: next.toString(), root, total: total.toString(), throughBlock: throughBlock.toString(), leaves: leaves.map(([, a, v]) => [a, v.toString()]) };
  return { plan: { epoch: next, fromBlock, throughBlock, earned, datasets: revenue.size, leaves, total, root, unpaid, record } };
}

/** Stores an epoch's leaves on Arkiv, where /api/rewards reads them to build claim proofs. */
// shortcut: one entity holds ~2,000 leaves (128 KiB); split an epoch across entities beyond that.
export async function storeEpoch(d: Deps, e: Epoch): Promise<string> {
  const { entityKey } = await d.gatewayWallet.createEntity(
    Rewards,
    { epoch: u64(BigInt(e.epoch)), root: e.root, total: u256(BigInt(e.total)), throughBlock: u64(BigInt(e.throughBlock)), leaves: new TextEncoder().encode(JSON.stringify(e.leaves)) },
    { expiration: ExpirationTime.max() },
  );
  return entityKey;
}

/**
 * Publishes the plan's root on the contract, then stores its leaves. `beforePublish` runs first (the script saves
 * a local copy there). If only the Arkiv write fails the root is already on-chain, so `storeError` is set and the
 * record stays in the result for a retry with storeEpoch.
 */
export async function publishEpoch(d: Deps, p: Plan, beforePublish?: (r: Epoch) => void): Promise<{ hash: Hex; entityKey?: string; storeError?: string }> {
  beforePublish?.(p.record);
  const hash = await d.owner.writeContract({ address: d.contract, abi: subscriptionsAbi, functionName: "publishRewards", args: [p.root, p.total, p.throughBlock] });
  const receipt = await d.og.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`publishRewards reverted: ${hash}`);
  try {
    return { hash, entityKey: await storeEpoch(d, p.record) };
  } catch (e) {
    return { hash, storeError: (e as Error).message };
  }
}
