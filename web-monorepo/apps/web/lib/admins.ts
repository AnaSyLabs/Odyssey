import "server-only";
import { ExpirationTime } from "@arkiv-network/sdk";
import { asc, eq } from "@arkiv-network/sdk/query";
import { addr, u64 } from "@arkiv-network/sdk/schema";
import { getAddress } from "viem";
import { arkivPublic, arkivWallet, gatewayAddress } from "@/lib/arkiv";
import { Admins } from "@/lib/schema";

export type AdminRow = { address: string; root: boolean; grantedBy?: string; grantedAt?: number };

/** Root admins come from ADMIN_ADDRESSES. They can't be removed from the app, so a bad grant can never lock everyone out. */
export const rootAdmins = () =>
  (process.env.ADMIN_ADDRESSES ?? "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
export const isRootAdmin = (address: string) => rootAdmins().includes(address.toLowerCase());

// shortcut: per-instance cache so every request doesn't query Arkiv; a revoke can take up to this long on other server instances.
const TTL_MS = 10_000;
const cache = new Map<string, { admin: boolean; at: number }>();

/** Every grant row for an address. More than one only after two grants raced; revoke removes them all. */
const grantsFor = (address: string) =>
  arkivPublic()
    .select({ $key: true, grantedBy: true, grantedAt: true })
    .from(Admins, { onMismatch: "skip" })
    .where(eq("admin", addr(getAddress(address))))
    .ownedBy(gatewayAddress())
    .limit(100)
    .fetch()
    .then((r) => r.entities);

/** Root admin, or granted from the /admin page. If Arkiv can't be reached a non-root wallet is treated as not admin. */
export async function isAdmin(address: string): Promise<boolean> {
  if (isRootAdmin(address)) return true;
  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.admin;
  try {
    const admin = (await grantsFor(address)).length > 0;
    cache.set(key, { admin, at: Date.now() });
    return admin;
  } catch (e) {
    console.error("admin lookup failed", e);
    return false;
  }
}

/** Root admins first, then granted admins, newest grant first. */
export async function listAdmins(): Promise<AdminRow[]> {
  // shortcut: one page of 100 grants; page by key if the admin list ever outgrows that.
  const { entities } = await arkivPublic()
    .select({ $key: true, admin: true, grantedBy: true, grantedAt: true })
    .from(Admins, { onMismatch: "skip" })
    .ownedBy(gatewayAddress())
    .orderBy(asc("$key"))
    .limit(100)
    .fetch();
  const root = rootAdmins();
  const granted = new Map<string, AdminRow>();
  for (const e of entities) {
    const a = e.admin.value.toLowerCase();
    if (root.includes(a) || granted.has(a)) continue; // a root admin never shows as granted; a raced duplicate shows once
    granted.set(a, { address: getAddress(a), root: false, grantedBy: e.grantedBy.value, grantedAt: Number(e.grantedAt.value) });
  }
  return [
    ...root.map((a) => ({ address: getAddress(a), root: true })),
    ...[...granted.values()].sort((x, y) => (y.grantedAt ?? 0) - (x.grantedAt ?? 0)),
  ];
}

/** Records `address` as an admin, granted by `by`. Returns false when it already was one. */
export async function grantAdmin(address: string, by: string) {
  if (await isAdmin(address)) return false;
  const { entityKey, txHash } = await arkivWallet().createEntity(
    Admins,
    { admin: addr(getAddress(address)), grantedBy: addr(getAddress(by)), grantedAt: u64(Math.floor(Date.now() / 1000)) },
    { expiration: ExpirationTime.max() }, // the daily extend job keeps these alive
  );
  cache.delete(address.toLowerCase());
  return { entityKey, txHash };
}

/** Removes a granted admin. Returns how many grant rows were deleted (0 = wasn't a granted admin). */
export async function revokeAdmin(address: string) {
  const grants = await grantsFor(address);
  const wallet = arkivWallet();
  for (const g of grants) await wallet.deleteEntity({ entityKey: g.$key });
  cache.delete(address.toLowerCase());
  return grants.length;
}
