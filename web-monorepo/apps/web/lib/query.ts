import "server-only";
import { and, asc, gt } from "@arkiv-network/sdk/query";
import { key } from "@arkiv-network/sdk/schema";
import { arkivPublic, gatewayAddress, Samples } from "@/lib/arkiv";
import { distanceM } from "@/lib/geo";
import { type Filter, filterWhere, matches, sampleFields } from "@/lib/filters";

// shortcut: scans at most this many candidates in the covering cells; add finer cells or a mirror DB when cells get dense.
export const MAX_SCAN = 2_000;

/** Sample metadata matching a filter, nearest first. Payloads are not read. */
export async function findSamples(f: Filter) {
  const client = arkivPublic();
  const gateway = gatewayAddress();
  const hits = [];
  let last: `0x${string}` | undefined;
  let scanned = 0;
  // Page by key so concurrent writes can't shift pages.
  for (;;) {
    const page = await client
      .select({
        $key: true, $createdAt: true, $expiresAt: true, device: true, worldId: true, deviceType: true, mac: true, kind: true,
        capturedAt: true, lat: true, lon: true, geohash: true, contentHash: true, storage: true, ogRoot: true, scene: true, mime: true,
        size: true, enc: true,
      })
      .from(Samples, { onMismatch: "throw" })
      .where(and(...filterWhere(f), ...(last ? [gt("$key", key(last))] : [])))
      .ownedBy(gateway)
      .orderBy(asc("$key"))
      .limit(100)
      .fetch();
    for (const r of page.entities) {
      if (!matches(f, sampleFields(r))) continue;
      hits.push({
        key: r.$key, distanceM: Math.round(distanceM(f.lat, f.lon, Number(r.lat.value), Number(r.lon.value)) * 10) / 10,
        device: r.device.value, worldId: r.worldId.value, deviceType: r.deviceType.value, mac: r.mac.value, kind: r.kind.value,
        capturedAt: Number(r.capturedAt.value), lat: r.lat.value, lon: r.lon.value, geohash: r.geohash.value,
        contentHash: r.contentHash.value, storage: r.storage.value, ogRoot: r.ogRoot?.value, scene: r.scene?.value, mime: r.mime.value,
        size: Number(r.size.value), encrypted: !!r.enc?.value, createdAtBlock: r.$createdAt?.toString(), expiresAtBlock: r.$expiresAt.toString(),
        row: r,
      });
    }
    scanned += page.entities.length;
    const tail = page.entities.at(-1)?.$key;
    if (page.entities.length < 100 || !tail || scanned >= MAX_SCAN) break;
    last = tail;
  }
  hits.sort((a, b) => a.distanceM - b.distanceM);
  return { scanned, truncated: scanned >= MAX_SCAN, hits };
}
