import { asc } from "@arkiv-network/sdk/query";
import { formatEther } from "viem";
import { arkivPublic, gatewayAddress } from "@/lib/arkiv";
import { ogPublic, subscriptionsAddress } from "@/lib/contract";
import { type Leaf, rewardTree } from "@/lib/rewards";
import { Rewards } from "@/lib/schema";
import { getSession, unauthorized } from "@/lib/session";
import { subscriptionsAbi } from "@/lib/subscriptions-abi";

/**
 * Contributor rewards for the signed-in wallet, one row per published epoch it has a share in, with the
 * Merkle proof the contract's claim() needs. The leaves live on Arkiv (odsy.rewards), the roots on the contract.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const me = session.address.toLowerCase();
  // shortcut: one page of 100 epochs; page by key once rewards have run that long.
  const { entities } = await arkivPublic().select().from(Rewards, { onMismatch: "skip" })
    .ownedBy(gatewayAddress()).orderBy(asc("epoch")).limit(100).fetch();

  const pub = ogPublic();
  const address = subscriptionsAddress();
  const rows = [];
  for (const r of entities) {
    const epoch = r.epoch.value;
    const leaves: Leaf[] = (JSON.parse(Buffer.from(r.leaves.value.slice(2), "hex").toString("utf8")) as [string, string][])
      .map(([account, amount]) => [epoch, account as `0x${string}`, BigInt(amount)]);
    const mine = leaves.find((l) => l[1].toLowerCase() === me);
    if (!mine) continue;
    const tree = rewardTree(leaves);
    const [root, claimed] = await Promise.all([
      pub.readContract({ address, abi: subscriptionsAbi, functionName: "rewardRoot", args: [epoch] }),
      pub.readContract({ address, abi: subscriptionsAbi, functionName: "claimed", args: [epoch, mine[1]] }),
    ]);
    if (tree.root !== root) continue; // stored leaves don't match the root the contract pays against
    rows.push({
      epoch: epoch.toString(), account: mine[1], amount: mine[2].toString(), amountDisplay: formatEther(mine[2]),
      proof: tree.getProof(mine), claimed,
    });
  }
  return Response.json({ contract: address, rewards: rows.reverse() });
}
