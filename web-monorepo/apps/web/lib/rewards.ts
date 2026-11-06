// Contributor rewards: how a dataset's contributor revenue is split, and the Merkle tree the
// subscriptions contract checks claims against. Shared by the gateway and scripts/publish-rewards.ts.
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

/** Leaf layout must match OdsySubscriptions.claim: abi.encode(epoch, account, amount). */
export const LEAF_TYPES = ["uint256", "address", "uint256"];
export type Leaf = [epoch: bigint, account: `0x${string}`, amount: bigint];

/**
 * Splits each dataset's revenue across payout wallets in proportion to their devices' sample counts.
 * Amounts are floored, so the sum never exceeds the revenue; dust and the share of devices without a
 * payout wallet stay in the contract's unallocated pool for a later epoch.
 */
export function allocate(
  revenue: Map<string, bigint>, // dataset -> contributor wei earned in the window
  samples: Map<string, Map<string, number>>, // dataset -> device -> sample count
  payout: Map<string, `0x${string}` | undefined>, // device -> payout wallet
): Map<`0x${string}`, bigint> {
  const out = new Map<`0x${string}`, bigint>();
  for (const [dataset, wei] of revenue) {
    const counts = samples.get(dataset);
    if (!counts) continue;
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    if (!total) continue;
    for (const [device, n] of counts) {
      const to = payout.get(device);
      if (!to) continue;
      const key = to.toLowerCase() as `0x${string}`;
      out.set(key, (out.get(key) ?? 0n) + (wei * BigInt(n)) / BigInt(total));
    }
  }
  for (const [k, v] of out) if (v === 0n) out.delete(k);
  return out;
}

export const rewardTree = (leaves: Leaf[]) => StandardMerkleTree.of(leaves, LEAF_TYPES);
