import { ExpirationTime } from "@arkiv-network/sdk";
import { and, asc, between, eq, gt, lt, startsWith } from "@arkiv-network/sdk/query";
import { addr, key, u64 } from "@arkiv-network/sdk/schema";
import type { Hex } from "viem";
import { bannedFrom } from "@/lib/consensus";
import { arkivPublic, arkivWallet, Devices, gatewayAddress, hasBearer, Samples } from "@/lib/arkiv";
import { Admins, Datasets, Rewards, Testimonials } from "@/lib/schema";
import { groupOf, thinGroup } from "@/lib/retention";

const PRECISION = Number(process.env.THIN_GEOHASH_PRECISION ?? 7); // geohash-7 ≈ 153 m x 153 m
const WINDOW = Number(process.env.THIN_WINDOW_SECONDS ?? 3600);
const WITHIN_DAYS = Number(process.env.EXTEND_WITHIN_DAYS ?? 7);
const BLOCK_SECONDS = 2; // Rabdi block time

/** Reads every page of a query, paging by entity key. */
async function scan<T extends { $key: Hex }>(page: (after?: Hex) => Promise<{ entities: readonly T[] }>) {
  const all: T[] = [];
  for (let after: Hex | undefined; ; ) {
    const { entities } = await page(after);
    all.push(...entities);
    if (entities.length < 100) return all;
    after = entities.at(-1)!.$key;
  }
}
const afterKey = (after?: Hex) => (after ? [gt("$key", key(after))] : []);

/**
 * Retention: extends samples about to expire, keeping only one per (device, geohash cell, time window),
 * and extends every device registration, dataset, reward epoch, admin grant and testimonial. Subscriptions are left to expire after their paid period. Schedule daily (Vercel cron or any scheduler) with
 * `Authorization: Bearer $CRON_SECRET`.
 * shortcut: runs in one request; split into batches if a day's expiring set outgrows the function timeout.
 */
export async function GET(req: Request) {
  if (!hasBearer(req, "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  const pub = arkivPublic();
  const gateway = gatewayAddress();
  const { currentBlock } = await pub.getBlockTiming();
  const soon = u64(currentBlock + BigInt(Math.ceil((WITHIN_DAYS * 86_400) / BLOCK_SECONDS)));

  const expiring = await scan((after) =>
    pub.select({ $key: true, device: true, worldId: true, geohash: true, capturedAt: true })
      .from(Samples, { onMismatch: "throw" }).where(and(lt("$expiresAt", soon), ...afterKey(after)))
      .ownedBy(gateway).orderBy(asc("$key")).limit(100).fetch(),
  );

  // The keeper of a group is decided over all its live samples, not just the expiring ones,
  // so a sample dropped in an earlier run is never revived later.
  const groups = new Map<string, ReturnType<typeof groupOf>>();
  for (const s of expiring) {
    const g = groupOf({ device: s.device.value, geohash: s.geohash.value, capturedAt: s.capturedAt.value }, PRECISION, WINDOW);
    groups.set(g.id, g);
  }
  const expiringKeys = new Set(expiring.map((s) => s.$key));
  const keep: Hex[] = [];
  for (const g of groups.values()) {
    const members = await scan((after) =>
      pub.select({ $key: true, capturedAt: true }).from(Samples, { onMismatch: "throw" })
        .where(and(
          eq("device", addr(g.device)),
          startsWith("geohash", g.cell),
          between("capturedAt", u64(g.start), u64(g.end)),
          ...afterKey(after),
        ))
        .ownedBy(gateway).orderBy(asc("$key")).limit(100).fetch(),
    );
    const keeper = thinGroup(members.map((m) => ({ key: m.$key, capturedAt: m.capturedAt.value })));
    // Banned data is left to expire. It is excluded from reads anyway, so keeping it alive would only cost gas.
    const k = expiring.find((s) => s.$key === keeper);
    const from = k ? await bannedFrom(k.worldId.value) : 0;
    const banned = from !== 0 && Number(k!.capturedAt.value) >= from;
    if (keeper && expiringKeys.has(keeper) && !banned) keep.push(keeper);
  }

  const devices = await scan((after) =>
    pub.select({ $key: true }).from(Devices, { onMismatch: "throw" }).where(and(lt("$expiresAt", soon), ...afterKey(after)))
      .ownedBy(gateway).orderBy(asc("$key")).limit(100).fetch(),
  );

  const datasets = await scan((after) =>
    pub.select({ $key: true }).from(Datasets, { onMismatch: "throw" }).where(and(lt("$expiresAt", soon), ...afterKey(after)))
      .ownedBy(gateway).orderBy(asc("$key")).limit(100).fetch(),
  );

  const rewards = await scan((after) =>
    pub.select({ $key: true }).from(Rewards, { onMismatch: "throw" }).where(and(lt("$expiresAt", soon), ...afterKey(after)))
      .ownedBy(gateway).orderBy(asc("$key")).limit(100).fetch(),
  );

  const admins = await scan((after) =>
    pub.select({ $key: true }).from(Admins, { onMismatch: "throw" }).where(and(lt("$expiresAt", soon), ...afterKey(after)))
      .ownedBy(gateway).orderBy(asc("$key")).limit(100).fetch(),
  );

  const testimonials = await scan((after) =>
    pub.select({ $key: true }).from(Testimonials, { onMismatch: "throw" }).where(and(lt("$expiresAt", soon), ...afterKey(after)))
      .ownedBy(gateway).orderBy(asc("$key")).limit(100).fetch(),
  );

  const toExtend = [...keep, ...devices.map((d) => d.$key), ...datasets.map((d) => d.$key), ...rewards.map((r) => r.$key), ...admins.map((a) => a.$key), ...testimonials.map((t) => t.$key)];
  const wallet = arkivWallet();
  for (let i = 0; i < toExtend.length; i += 50) {
    await wallet.executeBatch({
      extensions: toExtend.slice(i, i + 50).map((entityKey) => ({ entityKey, expiration: ExpirationTime.max() })),
    });
  }
  return Response.json({
    expiringSamples: expiring.length,
    groups: groups.size,
    extendedSamples: keep.length,
    droppedSamples: expiring.length - keep.length,
    extendedDevices: devices.length,
    extendedDatasets: datasets.length,
    extendedRewardEpochs: rewards.length,
    extendedAdmins: admins.length,
    extendedTestimonials: testimonials.length,
  });
}
