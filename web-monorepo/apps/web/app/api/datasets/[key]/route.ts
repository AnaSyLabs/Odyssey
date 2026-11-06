import { bool } from "@arkiv-network/sdk/schema";
import { isHex } from "viem";
import { arkivPublic, arkivWallet, gatewayAddress } from "@/lib/arkiv";
import { setContractPrice } from "@/lib/contract";
import { Datasets } from "@/lib/schema";
import { getSession, unauthorized } from "@/lib/session";

/**
 * Admin: list or unlist a dataset: PATCH {"active": false}. Sets the contract price to the dataset's price or 0;
 * paid access keeps working until it lapses. Listing again also repairs a contract price that failed to set.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.admin) return Response.json({ error: "admins only" }, { status: 403 });
  const { key } = await params;
  const b = await req.json().catch(() => null);
  if (!isHex(key) || key.length !== 66 || typeof b?.active !== "boolean") return Response.json({ error: "need a dataset key and {active: boolean}" }, { status: 400 });
  const d = await arkivPublic().getEntity(key, Datasets).catch(() => null);
  if (!d || d.$owner.toLowerCase() !== gatewayAddress().toLowerCase()) return Response.json({ error: "dataset not found" }, { status: 404 });

  const priceTx = await setContractPrice(key, b.active ? d.price.value : 0n);
  const { txHash } = await arkivWallet().patchEntity(Datasets, key, { set: { active: bool(b.active) } });
  return Response.json({ txHash, priceTx });
}
