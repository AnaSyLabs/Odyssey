import "server-only";
import { getAddress, isAddress, keccak256, pad, parseAbi, stringToHex, toBytes } from "viem";
import { ogOwner, ogPublic } from "@/lib/contract";

/** ConsensusRegistry on 0G Galileo (contracts/src/ConsensusRegistry.sol). Optional: when CONSENSUS_ADDRESS is unset nobody is ever banned. */
const address = () => {
  const a = process.env.CONSENSUS_ADDRESS;
  if (!a) return null;
  if (!isAddress(a)) throw new Error("CONSENSUS_ADDRESS must be an address");
  return getAddress(a);
};

const abi = parseAbi([
  "function bannedFrom(bytes32 worldId) view returns (uint64)",
  "function raiseAlert(bytes32 worldId, bytes32 kind, bytes32 ref)",
]);

const worldKey = (worldId: string) => pad(worldId as `0x${string}`, { size: 32 });

// shortcut: per-instance cache; a ban takes up to this long to show on other server instances.
const TTL_MS = 60_000;
const cache = new Map<string, { from: number; at: number }>();

/** Unix seconds from which this World ID's data is excluded, or 0 when it is not banned. */
export async function bannedFrom(worldId: string) {
  const to = address();
  if (!to) return 0;
  const hit = cache.get(worldId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.from;
  const from = Number(await ogPublic().readContract({ address: to, abi, functionName: "bannedFrom", args: [worldKey(worldId)] }));
  cache.set(worldId, { from, at: Date.now() });
  return from;
}

export const isBanned = async (worldId: string) => (await bannedFrom(worldId)) !== 0;

/** One strike for objective evidence only (README: slash on evidence, never on opinion). Failures are logged, never thrown, so an upload is not lost to a chain hiccup. */
export async function raiseAlert(worldId: string, kind: string, ref: string) {
  const to = address();
  if (!to) return;
  try {
    await ogOwner().writeContract({ address: to, abi, functionName: "raiseAlert", args: [worldKey(worldId), stringToHex(kind, { size: 32 }), keccak256(toBytes(ref))] });
    cache.delete(worldId);
  } catch (e) {
    console.error("raiseAlert failed", kind, ref, e);
  }
}
