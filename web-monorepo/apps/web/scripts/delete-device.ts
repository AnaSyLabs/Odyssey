// Admin job: removes a node from the device registry so it can no longer upload (and can enroll again).
// Its past samples stay on Arkiv. The MAC must match the registry, so a mistyped address deletes nothing.
// Run: npm run device:delete -- 0xDEVICE_ADDRESS AA:BB:CC:DD:EE:FF
import { createPublicClient, createWalletClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { addr } from "@arkiv-network/sdk/schema";
import { getAddress, http, isAddress, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Devices } from "../lib/schema.ts";

const [address, mac] = process.argv.slice(2);
if (!isAddress(address ?? "") || !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(mac ?? "")) {
  console.error("Usage: npm run device:delete -- 0xDEVICE_ADDRESS AA:BB:CC:DD:EE:FF");
  process.exit(1);
}
const key = process.env.ARKIV_PRIVATE_KEY;
if (!isHex(key)) throw new Error("Set ARKIV_PRIVATE_KEY in .env: only the gateway wallet can delete registry entries");

const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });
const wallet = createWalletClient({ chain, transport: http(), account: privateKeyToAccount(key) });
const device = getAddress(address);
const { entities } = await createPublicClient({ chain, transport: http() })
  .select({ $key: true, mac: true, deviceType: true, worldId: true })
  .from(Devices).where(eq("device", addr(device))).ownedBy(wallet.account.address).fetch();

if (!entities.length) {
  console.error(`${device} is not registered. Nothing deleted.`);
  process.exit(1);
}
const wrong = entities.find((d) => d.mac.value.toUpperCase() !== mac.toUpperCase());
if (wrong) {
  console.error(`MAC does not match: ${device} is registered with ${wrong.mac.value}. Nothing deleted.`);
  process.exit(1);
}
// Normally one entry; a check-then-create race in registerDevice could have written two.
for (const d of entities) {
  const { txHash } = await wallet.deleteEntity({ entityKey: d.$key });
  console.log(`Deleted ${device} (${d.deviceType.value}, MAC ${d.mac.value}, World ID ${d.worldId.value})\n  entity  ${d.$key}\n  tx      ${txHash}`);
}
