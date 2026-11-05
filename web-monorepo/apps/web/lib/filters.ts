// Sample filters (a geo circle plus optional kind, device type and time range). A dataset is one of these.
// Shared by the gateway and scripts/lab-ingest.ts.
import { eq, gte, lte, or, startsWith } from "@arkiv-network/sdk/query";
import { u64 } from "@arkiv-network/sdk/schema";
import { coverCircle, distanceM } from "./geo.ts";

export type Filter = { lat: number; lon: number; radiusM: number; kind?: string; deviceType?: string; fromTs?: number; toTs?: number };
type SampleFields = { lat: number; lon: number; kind: string; deviceType: string; capturedAt: number };

/** Arkiv predicates that narrow to the filter's geohash cells; `matches` then applies the exact circle. */
export const filterWhere = (f: Filter) => [
  or(coverCircle(f.lat, f.lon, f.radiusM).map((c) => startsWith("geohash", c))),
  ...(f.kind ? [eq("kind", f.kind)] : []),
  ...(f.deviceType ? [eq("deviceType", f.deviceType)] : []),
  ...(f.fromTs ? [gte("capturedAt", u64(f.fromTs))] : []),
  ...(f.toTs ? [lte("capturedAt", u64(f.toTs))] : []),
];

export const matches = (f: Filter, s: SampleFields) =>
  distanceM(f.lat, f.lon, s.lat, s.lon) <= f.radiusM &&
  (!f.kind || f.kind === s.kind) &&
  (!f.deviceType || f.deviceType === s.deviceType) &&
  (!f.fromTs || s.capturedAt >= f.fromTs) &&
  (!f.toTs || s.capturedAt <= f.toTs);

/** A Datasets row (values as Arkiv returns them) as a Filter. */
export const datasetFilter = (d: {
  lat: { value: string }; lon: { value: string }; radiusM: { value: bigint }; kind: { value: string };
  deviceType: { value: string }; fromTs: { value: bigint }; toTs: { value: bigint };
}): Filter => ({
  lat: Number(d.lat.value), lon: Number(d.lon.value), radiusM: Number(d.radiusM.value), kind: d.kind.value,
  deviceType: d.deviceType.value, fromTs: Number(d.fromTs.value), toTs: Number(d.toTs.value),
});

/** A sample row (values as Arkiv returns them) in the shape `matches` takes. */
export const sampleFields = (s: { lat: { value: string }; lon: { value: string }; kind: { value: string }; deviceType: { value: string }; capturedAt: { value: bigint } }): SampleFields => ({
  lat: Number(s.lat.value), lon: Number(s.lon.value), kind: s.kind.value, deviceType: s.deviceType.value, capturedAt: Number(s.capturedAt.value),
});
