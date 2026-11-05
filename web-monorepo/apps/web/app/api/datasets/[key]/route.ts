import { bool } from "@arkiv-network/sdk/schema";
import { isHex } from "viem";
import { arkivWallet } from "@/lib/arkiv";
import { Datasets } from "@/lib/schema";
import { getSession, unauthorized } from "@/lib/session";

/** Admin: list or unlist a dataset: PATCH {"active": false}. Existing subscriptions keep working until they lapse. */
export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.admin) return Response.json({ error: "admins only" }, { status: 403 });
  const { key } = await params;
  const b = await req.json().catch(() => null);
  if (!isHex(key) || key.length !== 66 || typeof b?.active !== "boolean") return Response.json({ error: "need a dataset key and {active: boolean}" }, { status: 400 });
  const { txHash } = await arkivWallet().patchEntity(Datasets, key, { set: { active: bool(b.active) } });
  return Response.json({ txHash });
}
