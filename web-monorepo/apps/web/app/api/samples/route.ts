import { readAccess } from "@/lib/access";
import { arkivPublic, gatewayAddress } from "@/lib/arkiv";
import { datasetFilter, type Filter } from "@/lib/filters";
import { coverCircle } from "@/lib/geo";
import { findSamples } from "@/lib/query";
import { KINDS, type Kind } from "@/lib/sample";
import { Datasets } from "@/lib/schema";
import { getSession } from "@/lib/session";

const MAX_RADIUS_M = 50_000;

const fail = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Geo query, public metadata only:
 *   GET /api/samples?lat=19.06&lon=72.83&radius=500[&kind=image][&deviceType=..][&from=unix][&to=unix][&limit=50]
 *   GET /api/samples?dataset=<dataset key>[&limit=50]
 * Nearest first. `readable` says whether the signed-in wallet may decrypt it (GET /api/samples/{key}).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const limit = Math.min(Number(q.get("limit") ?? 50), 500);
  if (!(limit > 0)) return fail(400, "bad limit");

  let f: Filter;
  const dataset = q.get("dataset");
  if (dataset) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(dataset)) return fail(400, "dataset must be a dataset key");
    const d = await arkivPublic().getEntity(dataset as `0x${string}`, Datasets).catch(() => null);
    if (!d || d.$owner.toLowerCase() !== gatewayAddress().toLowerCase()) return fail(404, "dataset not found");
    f = datasetFilter(d);
  } else {
    const [lat, lon, radius] = [Number(q.get("lat")), Number(q.get("lon")), Number(q.get("radius") ?? 1000)];
    const [kind, deviceType, from, to] = [q.get("kind") ?? "", q.get("deviceType") ?? "", q.get("from") ?? "", q.get("to") ?? ""];
    if (!q.get("lat") || !q.get("lon") || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return fail(400, "lat and lon are required");
    if (!(radius > 0 && radius <= MAX_RADIUS_M)) return fail(400, `radius must be 1..${MAX_RADIUS_M} m`);
    if (kind && !KINDS.includes(kind as Kind)) return fail(400, `kind must be one of ${KINDS.join(", ")}`);
    if (deviceType && !/^[\w.-]{1,64}$/.test(deviceType)) return fail(400, "bad deviceType");
    if ((from && !/^\d+$/.test(from)) || (to && !/^\d+$/.test(to))) return fail(400, "from/to must be unix seconds");
    f = { lat, lon, radiusM: radius, kind, deviceType, fromTs: Number(from), toTs: Number(to) };
  }

  const [{ scanned, truncated, hits }, canRead] = await Promise.all([findSamples(f), getSession().then(readAccess)]);
  return Response.json({
    cells: coverCircle(f.lat, f.lon, f.radiusM),
    scanned,
    truncated,
    total: hits.length,
    samples: hits.slice(0, limit).map(({ row, ...h }) => ({ ...h, readable: !h.encrypted || canRead(row) })),
  });
}
