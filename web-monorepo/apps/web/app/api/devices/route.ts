import { desc, eq } from "@arkiv-network/sdk/query";
import { addr } from "@arkiv-network/sdk/schema";
import { getAddress, isAddress } from "viem";
import { arkivPublic, arkivWallet, Devices, findDevice, gatewayAddress, hasBearer, registerDevice, Samples } from "@/lib/arkiv";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Public registry entry and newest samples of one device: GET /api/devices?device=0x.. */
export async function GET(req: Request) {
  const d = new URL(req.url).searchParams.get("device") ?? "";
  if (!isAddress(d)) return fail(400, "device must be an address");
  const device = getAddress(d);
  const reg = await findDevice(device);
  if (!reg) return fail(404, "device not registered");
  const { entities } = await arkivPublic()
    .select({ $key: true, kind: true, capturedAt: true, contentHash: true, size: true })
    .from(Samples).where(eq("device", addr(device))).ownedBy(gatewayAddress()).orderBy(desc("capturedAt")).limit(12).fetch();
  return Response.json({
    device, worldId: reg.worldId.value, deviceType: reg.deviceType.value, mac: reg.mac.value, payout: reg.payout?.value,
    samples: entities.map((s) => ({ key: s.$key, kind: s.kind.value, capturedAt: Number(s.capturedAt.value), contentHash: s.contentHash.value, size: Number(s.size.value) })),
  });
}

/**
 * Registers a device for a trusted external registrar (REGISTRAR_TOKEN) that verified World ID itself.
 * The app's own flow is POST /api/enroll. Body: see registerDevice.
 */
export async function POST(req: Request) {
  if (!hasBearer(req, "REGISTRAR_TOKEN")) return fail(401, "unauthorized");
  return registerDevice(await req.json().catch(() => null));
}

/**
 * Sets or changes the payout wallet that receives a device's contributor rewards.
 * Body: { device: 0x address, payout: 0x address }. Same REGISTRAR_TOKEN trust as registration.
 */
export async function PATCH(req: Request) {
  if (!hasBearer(req, "REGISTRAR_TOKEN")) return fail(401, "unauthorized");
  const b = await req.json().catch(() => null);
  if (!b || !isAddress(b.device) || !isAddress(b.payout)) return fail(400, "need device and payout addresses");
  const reg = await findDevice(getAddress(b.device));
  if (!reg) return fail(404, "device not registered");
  const { txHash } = await arkivWallet().patchEntity(Devices, reg.$key, { set: { payout: addr(getAddress(b.payout)) } });
  return Response.json({ txHash });
}
