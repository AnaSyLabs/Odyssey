import { isHex } from "viem";
import { need } from "@/lib/arkiv";
import { makeDeps, planEpoch, publishEpoch, type Plan } from "@/lib/rewards-publish";
import { getSession, unauthorized } from "@/lib/session";

const fail = (status: number, error: string) => Response.json({ error }, { status });

const hexKey = (name: string) => {
  const v = need(name);
  if (!isHex(v) || v.length !== 66) throw new Error(`${name} must be 0x + 64 hex`);
  return v;
};

/** The plan as JSON (wei amounts as strings). */
const view = (p: Plan) => ({
  epoch: p.epoch.toString(), fromBlock: p.fromBlock.toString(), throughBlock: p.throughBlock.toString(),
  earned: p.earned.toString(), datasets: p.datasets, total: p.total.toString(), root: p.root, unpaid: p.unpaid,
  leaves: p.leaves.map(([, account, amount]) => ({ account, amount: amount.toString() })),
});

/**
 * Admins only: publish the next reward epoch, the same job as `npm run rewards:publish`.
 * Body {} previews the split and returns its `root`; body { confirm: root } publishes it, but only if recomputing now
 * gives the same root (so what the admin saw is what goes on-chain). Signs with OG_PRIVATE_KEY, the contract owner.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.admin) return fail(403, "admins only");
  const b = await req.json().catch(() => ({}));
  const confirm = typeof b?.confirm === "string" ? b.confirm : undefined;

  try {
    const deps = makeDeps({
      contract: need("SUBSCRIPTIONS_ADDRESS"), fromBlock: process.env.SUBSCRIPTIONS_FROM_BLOCK, ogRpc: process.env.OG_RPC_URL,
      accessKey: process.env.ARKIV_ACCESS_KEY, ogKey: hexKey("OG_PRIVATE_KEY"), arkivKey: hexKey("ARKIV_PRIVATE_KEY"),
    });
    const r = await planEpoch(deps);
    if ("none" in r) return Response.json({ none: r.none });
    if (!confirm) return Response.json({ preview: view(r.plan) });
    if (confirm.toLowerCase() !== r.plan.root.toLowerCase()) return fail(409, "the payout split changed since you previewed it; preview again");
    const out = await publishEpoch(deps, r.plan);
    // If only the Arkiv write failed, the root is already on-chain: hand back the record so it can be stored again.
    return Response.json({ published: { ...view(r.plan), ...out, ...(out.storeError && { record: r.plan.record }) } }, { status: 201 });
  } catch (e) {
    console.error("publish rewards failed:", e);
    return fail(500, (e as Error).message);
  }
}
