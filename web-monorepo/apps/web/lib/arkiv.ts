import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createPublicClient, createWalletClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { addr } from "@arkiv-network/sdk/schema";
import { Devices } from "@/lib/schema";
import { http, isHex } from "viem";
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
    .select({ $key: true, worldId: true, deviceType: true, mac: true })
    .from(Devices)
    .where(eq("device", addr(device)))
    .ownedBy(gatewayAddress())
    .limit(1)
    .fetch();
  return entities[0];
}
