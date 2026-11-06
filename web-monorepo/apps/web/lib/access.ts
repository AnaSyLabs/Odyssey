import "server-only";
import { and, eq, gt } from "@arkiv-network/sdk/query";
import { addr, u64 } from "@arkiv-network/sdk/schema";
import { type Hex, isHex } from "viem";
import { arkivPublic, gatewayAddress, need } from "@/lib/arkiv";
import { contractPaidUntil } from "@/lib/contract";
import { bannedFrom } from "@/lib/consensus";
import { decrypt, sampleKey } from "@/lib/crypto";
import { datasetFilter, type Filter, matches, sampleFields } from "@/lib/filters";
import { Datasets, Samples, Subscriptions } from "@/lib/schema";

/**
 * Datasets the address has paid for and that are still within their paid period, with the paid-until time.
 * Reads the OdsySubscriptions contract, plus legacy periods recorded on Arkiv before it shipped.
 */
export async function activeSubscriptions(address: Hex) {
  const pub = arkivPublic();
  const gateway = gatewayAddress();
  const now = Math.floor(Date.now() / 1000);
  // shortcut: one page each (100 datasets, 100 legacy periods); page by key when the catalogue grows.
  const catalogue = await pub.select({ $key: true }).from(Datasets).ownedBy(gateway).limit(100).fetch();
  const onChain = await contractPaidUntil(address, catalogue.entities.map((d) => d.$key));
  const { entities } = await pub
    .select({ dataset: true, paidUntil: true })
    .from(Subscriptions, { onMismatch: "throw" })
    .where(and(eq("subscriber", addr(address)), gt("paidUntil", u64(now))))
    .ownedBy(gateway)
    .limit(100)
    .fetch();
  const until = new Map<Hex, number>();
  for (const [key, t] of onChain) if (t > now) until.set(key as Hex, t);
  for (const s of entities) {
    const k = s.dataset.value.toLowerCase() as Hex;
    until.set(k, Math.max(until.get(k) ?? 0, Number(s.paidUntil.value)));
  }
  const out: { key: Hex; name: string; paidUntil: number; filter: Filter }[] = [];
  for (const [key, paidUntil] of until) {
    const d = await pub.getEntity(key, Datasets).catch(() => null);
    if (d && d.$owner.toLowerCase() === gateway.toLowerCase()) out.push({ key, name: d.name.value, paidUntil, filter: datasetFilter(d) });
  }
  return out;
}

type SampleRow = Parameters<typeof sampleFields>[0] & { worldId: { value: string } };

/** A predicate telling whether this viewer may decrypt a sample. Admins see everything; a banned World ID's samples from its first strike on are never readable. */
export async function readAccess(session: { address: Hex; admin: boolean } | null) {
  if (!session) return async () => false;
  if (session.admin) return async () => true;
  const subs = await activeSubscriptions(session.address);
  return async (s: SampleRow) => {
    const from = await bannedFrom(s.worldId.value);
    if (from && Number(s.capturedAt.value) >= from) return false;
    return subs.some((d) => matches(d.filter, sampleFields(s)));
  };
}

export const keyFor = (contentHash: string) => sampleKey(need("DATA_KEY"), contentHash);

/** Plaintext of an encrypted (or legacy plaintext) blob. */
export const open = (blob: Uint8Array, enc: string | undefined, contentHash: string) =>
  enc ? decrypt(blob, keyFor(contentHash), contentHash) : Buffer.from(blob);

export const hexBytes = (h: string) => Buffer.from(h.slice(2), "hex");

/** Loads a gateway-written sample, or null. */
export async function loadSample(key: string) {
  if (!isHex(key) || key.length !== 66) return null;
  const s = await arkivPublic().getEntity(key, Samples).catch(() => null);
  return s && s.$owner.toLowerCase() === gatewayAddress().toLowerCase() ? s : null;
}

