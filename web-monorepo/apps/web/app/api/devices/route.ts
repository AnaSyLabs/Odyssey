import { ExpirationTime } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { addr } from "@arkiv-network/sdk/schema";
import { getAddress, isAddress } from "viem";
import { arkivPublic, arkivWallet, Devices, findDevice, gatewayAddress, hasBearer } from "@/lib/arkiv";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Binds a device key to a World ID nullifier. Called by the World ID registration page
 * after it has verified the proof server-side; this route trusts that caller via REGISTRAR_TOKEN.
 * Body: { device: 0x address, worldId: nullifier hash, deviceType, mac, payout?: owner's wallet for rewards }
 */
export async function POST(req: Request) {
  if (!hasBearer(req, "REGISTRAR_TOKEN")) return fail(401, "unauthorized");
  const b = await req.json().catch(() => null);
  if (!b || !isAddress(b.device)) return fail(400, "device must be an address");
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(b.worldId ?? "")) return fail(400, "worldId must be a hex nullifier hash");
  if (!/^[\w.-]{1,64}$/.test(b.deviceType ?? "")) return fail(400, "deviceType: 1-64 chars of [A-Za-z0-9_.-]");
  if (!/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(b.mac ?? "")) return fail(400, "mac must look like AA:BB:CC:DD:EE:FF");
  if (b.payout !== undefined && !isAddress(b.payout)) return fail(400, "payout must be an address");

  const device = getAddress(b.device);
  const worldId: string = b.worldId.toLowerCase();
  if (await findDevice(device)) return fail(409, "device already registered");
  // One human, one device (README: Sybil resistance).
  const { entities } = await arkivPublic()
    .select({ $key: true }).from(Devices).where(eq("worldId", worldId)).ownedBy(gatewayAddress()).limit(1).fetch();
  if (entities.length) return fail(409, "this World ID already has a device");

  // shortcut: check-then-create races under concurrent registrations; fine at registration volume.
  const { entityKey, txHash } = await arkivWallet().createEntity(
    Devices,
    { device: addr(device), worldId, deviceType: b.deviceType, mac: b.mac.toUpperCase(), ...(b.payout && { payout: addr(getAddress(b.payout)) }) },
    { expiration: ExpirationTime.max() },
  );
  return Response.json({ entityKey, txHash }, { status: 201 });
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
