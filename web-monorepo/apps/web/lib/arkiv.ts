import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { addr } from "@arkiv-network/sdk/schema";
import { fail } from "@/lib/api";
import { Devices } from "@/lib/schema";
import { getAddress, http, isAddress, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export { Devices, Samples } from "@/lib/schema";

export const need = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
};

/** Constant-time check of `Authorization: Bearer <env secret>`. */
export const hasBearer = (req: Request, envName: string) => {
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${need(envName)}`);
  return a.length === b.length && timingSafeEqual(a, b);
};

const chain = () => rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });

export const arkivPublic = () => createPublicClient({ chain: chain(), transport: http() });

export const arkivWallet = () => {
  const key = need("ARKIV_PRIVATE_KEY");
  if (!isHex(key)) throw new Error("ARKIV_PRIVATE_KEY must be 0x-prefixed hex");
  return createWalletClient({ chain: chain(), transport: http(), account: privateKeyToAccount(key) });
};

/** Only trust rows written by our gateway: anyone can write entities with the same schema tag. */
export const gatewayAddress = () => arkivWallet().account.address;

export async function findDevice(device: `0x${string}`) {
  const { entities } = await arkivPublic()
    .select({ $key: true, worldId: true, deviceType: true, mac: true, payout: true })
    .from(Devices)
    .where(eq("device", addr(device)))
    .ownedBy(gatewayAddress())
    .limit(1)
    .fetch();
  return entities[0];
}

/** The device a World ID already enrolled, if any: one human, one device. worldId is the lowercase hex nullifier. */
export async function findDeviceOf(worldId: string) {
  const { entities } = await arkivPublic()
    .select({ device: true, deviceType: true, mac: true })
    .from(Devices)
    .where(eq("worldId", worldId))
    .ownedBy(gatewayAddress())
    .limit(1)
    .fetch();
  return entities[0];
}

/** Tells a human which device holds their World ID and how to free it. */
export const oneDevicePerHuman = (d: { device: { value: string }; deviceType: { value: string }; mac: { value: string } }) =>
  `This World ID already enrolled a device: ${d.deviceType.value} ${d.device.value} (MAC ${d.mac.value}). Each human can enroll one device. ` +
  `To use a new one, an admin removes the old one first: npm run device:delete -- ${d.device.value} ${d.mac.value}`;

/**
 * Binds a device key to a World ID nullifier, one device per human. Callers must have verified the World ID proof.
 * Body: { device: 0x address, worldId: nullifier hash, deviceType, mac, payout: the owner's wallet, which receives the device's rewards }
 */
export async function registerDevice(b: Record<string, string> | null) {
  if (!b || !isAddress(b.device)) return fail(400, "device must be an address");
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(b.worldId ?? "")) return fail(400, "worldId must be a hex nullifier hash");
  if (!/^[\w.-]{1,64}$/.test(b.deviceType ?? "")) return fail(400, "deviceType: 1-64 chars of [A-Za-z0-9_.-]");
  if (!/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(b.mac ?? "")) return fail(400, "mac must look like AA:BB:CC:DD:EE:FF");
  if (!isAddress(b.payout)) return fail(400, "payout must be the device owner's wallet address");

  const device = getAddress(b.device);
  const worldId = b.worldId.toLowerCase();
  if (await findDevice(device)) return fail(409, "device already registered");
  // One human, one device (README: Sybil resistance).
  const owned = await findDeviceOf(worldId);
  if (owned) return fail(409, oneDevicePerHuman(owned));

  // shortcut: check-then-create races under concurrent registrations; fine at registration volume.
  const { entityKey, txHash } = await arkivWallet().createEntity(
    Devices,
    { device: addr(device), worldId, deviceType: b.deviceType, mac: b.mac.toUpperCase(), payout: addr(getAddress(b.payout)) },
    { expiration: ExpirationTime.max() },
  );
  return Response.json({ entityKey, txHash, device, worldId }, { status: 201 });
}
