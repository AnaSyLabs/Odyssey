import { ExpirationTime } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { addr } from "@arkiv-network/sdk/schema";
import { getAddress, isAddress } from "viem";
import { arkivPublic, arkivWallet, Devices, findDevice, gatewayAddress, hasBearer } from "@/lib/arkiv";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Binds a device key to a World ID nullifier. Called by the World ID registration page
 * after it has verified the proof server-side; this route trusts that caller via REGISTRAR_TOKEN.
 * Body: { device: 0x address, worldId: nullifier hash, deviceType, mac }
 */
export async function POST(req: Request) {
  if (!hasBearer(req, "REGISTRAR_TOKEN")) return fail(401, "unauthorized");
  const b = await req.json().catch(() => null);
  if (!b || !isAddress(b.device)) return fail(400, "device must be an address");
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(b.worldId ?? "")) return fail(400, "worldId must be a hex nullifier hash");
  if (!/^[\w.-]{1,64}$/.test(b.deviceType ?? "")) return fail(400, "deviceType: 1-64 chars of [A-Za-z0-9_.-]");
  if (!/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(b.mac ?? "")) return fail(400, "mac must look like AA:BB:CC:DD:EE:FF");

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
    { device: addr(device), worldId, deviceType: b.deviceType, mac: b.mac.toUpperCase() },
    { expiration: ExpirationTime.max() },
  );
  return Response.json({ entityKey, txHash }, { status: 201 });
}
