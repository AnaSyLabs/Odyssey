"use client";
// H3 map of a real dataset: the dataset's samples (public metadata from Arkiv) binned into hexagons.
import { cellToBoundary, latLngToCell } from "h3-js";
import { Map as MapLibre, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LuArrowLeft, LuEyeOff, LuLock, LuLockOpen, LuX } from "react-icons/lu";
import { useWallet } from "@/components/wallet";
import { short } from "@/lib/data";
import { useDark } from "@/lib/theme";

type Dataset = { key: string; name: string; lat: number; lon: number; radiusM: number; kind: string; paidUntil: number | null; priceDisplay: string };
type Sample = { key: string; kind: string; capturedAt: number; device: string; lat: string; lon: string; readable: boolean; storage: string };

const BASEMAP = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};
const KIND_COLOR: Record<string, string> = { image: "#00e5ff", video: "#cdbdff", audio: "#ff9100", text: "#c5f467", sensor: "#22ef7e" };
const METRICS = ["Volume", "Kind", "Access"] as const;
const RANGES = { "24h": 86_400, "7d": 7 * 86_400, "30d": 30 * 86_400, All: Infinity };
const VOLUME = ["#2e2e2e", "#c5f467"];

const mix = (a: string, b: string, t: number) => {
  const [x, y] = [a, b].map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
  return `rgb(${x.map((c, i) => Math.round(c + (y[i] - c) * Math.min(1, Math.max(0, t)))).join(",")})`;
};
// Finer hexagons for small areas: res 9 ≈ 0.1 km², res 8 ≈ 0.7 km², res 7 ≈ 5 km².
const resFor = (radiusM: number) => (radiusM <= 1_000 ? 9 : radiusM <= 5_000 ? 8 : 7);
const when = (ts: number) => new Date(ts * 1000).toLocaleString();

export default function SampleHexMap({ datasetKey }: { datasetKey: string }) {
  const { session } = useWallet();
  const dark = useDark();
  const [dataset, setDataset] = useState<Dataset | null>();
  const [samples, setSamples] = useState<Sample[]>();
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string>();
  const [range, setRange] = useState<keyof typeof RANGES>("All");
  const [kinds, setKinds] = useState<string[]>([]);
  const [device, setDevice] = useState("");
  const [metric, setMetric] = useState<(typeof METRICS)[number]>("Volume");
  const [selId, setSelId] = useState<string>();

  useEffect(() => {
    Promise.all([
      fetch("/api/datasets").then((r) => r.json()),
      fetch(`/api/samples?dataset=${datasetKey}&limit=500`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
    ]).then(([d, s]) => {
      setDataset((d.datasets ?? []).find((x: Dataset) => x.key === datasetKey) ?? null);
      if (!s.ok) setError(s.body.error ?? "could not load samples");
      setSamples(s.body.samples ?? []);
      setNow(Date.now() / 1000);
    }).catch((e) => setError(String(e)));
  }, [datasetKey, session]);

  const canView = !!dataset && (!!dataset.paidUntil || !!session?.admin);
  const res = dataset ? resFor(dataset.radiusM) : 9;
  const kindsHere = useMemo(() => [...new Set((samples ?? []).map((s) => s.kind))], [samples]);

  const cells = useMemo(() => {
    const byCell = new Map<string, Sample[]>();
    for (const s of samples ?? []) {
      if (now - s.capturedAt > RANGES[range]) continue;
      if (kinds.length && !kinds.includes(s.kind)) continue;
      if (device && !s.device.toLowerCase().includes(device.trim().toLowerCase())) continue;
      const id = latLngToCell(Number(s.lat), Number(s.lon), res);
      byCell.set(id, [...(byCell.get(id) ?? []), s]);
    }
    return [...byCell].map(([id, list]) => {
      const counts = Object.entries(list.reduce<Record<string, number>>((m, s) => ({ ...m, [s.kind]: (m[s.kind] ?? 0) + 1 }), {}));
      return {
        id, samples: list.sort((a, b) => b.capturedAt - a.capturedAt), ring: cellToBoundary(id, true) as [number, number][],
        top: counts.sort((a, b) => b[1] - a[1])[0][0], readable: list.filter((s) => s.readable).length / list.length,
        devices: [...new Set(list.map((s) => s.device))],
      };
    });
  }, [samples, now, range, kinds, device, res]);
  const sel = cells.find((c) => c.id === selId);
  const max = Math.max(1, ...cells.map((c) => c.samples.length));

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: cells.map((c) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [c.ring] },
      properties: {
        id: c.id, selected: c.id === selId, height: 30 + (c.samples.length / max) * 600,
        color: metric === "Kind" ? KIND_COLOR[c.top] ?? "#ffffff" : metric === "Access" ? mix("#ff3d71", "#22ef7e", c.readable) : mix(VOLUME[0], VOLUME[1], c.samples.length / max),
      },
    })),
  }), [cells, selId, metric, max]);

  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre>(null);
  const data = useRef(geojson);

  useEffect(() => {
    if (!canView || !box.current || !dataset) return;
    // MapLibre derives its worker URL from import.meta.url, which the bundler rewrites.
    setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
    const m = new MapLibre({
      container: box.current, style: BASEMAP[dark ? "dark" : "light"],
      center: [dataset.lon, dataset.lat], zoom: dataset.radiusM <= 1_000 ? 15 : dataset.radiusM <= 5_000 ? 13 : 11,
      pitch: 50, bearing: -20, attributionControl: { compact: true },
    });
    m.on("style.load", () => {
      m.addSource("hex", { type: "geojson", data: data.current });
      m.addLayer({ id: "hex-fill", type: "fill-extrusion", source: "hex", paint: {
        "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "height"], "fill-extrusion-opacity": 0.85,
      } });
      m.addLayer({ id: "hex-sel", type: "line", source: "hex", filter: ["==", ["get", "selected"], true], paint: { "line-color": "#ffffff", "line-width": 3 } });
    });
    m.on("click", "hex-fill", (e) => setSelId(e.features?.[0]?.properties?.id));
    m.on("mouseenter", "hex-fill", () => { m.getCanvas().style.cursor = "pointer"; });
    m.on("mouseleave", "hex-fill", () => { m.getCanvas().style.cursor = ""; });
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, [canView, dataset, dark]);

  useEffect(() => {
    data.current = geojson;
    (map.current?.getSource("hex") as { setData(d: GeoJSON.FeatureCollection): void } | undefined)?.setData(geojson);
  }, [geojson]);

  const header = (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link href="/datasets" className="icon-btn" aria-label="Back to datasets"><LuArrowLeft size={18} /></Link>
      <div>
        <p className="eyebrow">Dataset · H3 coverage map</p>
        <h1 className="text-2xl font-semibold tracking-tight">{dataset?.name ?? (dataset === null ? "Dataset not found" : "Loading…")}</h1>
      </div>
      {canView && <Link href={`/explore?dataset=${datasetKey}`} className="btn ml-auto">Open in Explore</Link>}
    </header>
  );

  if (error) return <main className="flex flex-col gap-4">{header}<p className="text-sm text-[var(--st-crimson)]" role="alert">{error}</p></main>;
  if (!dataset || !samples) return <main className="flex flex-col gap-4">{header}</main>;
  if (!canView) {
    return (
      <main className="flex flex-col gap-4">
        {header}
        <div className="glass mx-auto mt-10 max-w-md space-y-3 p-6 text-center">
          <LuEyeOff size={34} className="mx-auto text-[var(--st-cyan)]" />
          <p className="text-lg font-medium">Subscribe to open this map</p>
          <p className="text-sm text-[var(--st-on-var)]">Subscribers see every hexagon this dataset covers, the devices behind it, and can decrypt its samples.</p>
          <Link href="/datasets" className="btn primary w-full">Subscribe · {dataset.priceDisplay} 0G / 30 days</Link>
        </div>
      </main>
    );
  }

  const shownTotal = cells.reduce((n, c) => n + c.samples.length, 0);
  const toggleKind = (k: string) => setKinds((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  return (
    <main className="flex flex-col gap-4">
      {header}

      <div className="glass flex flex-wrap items-center gap-2 p-3" role="search">
        <input className="field max-w-64" placeholder="Device address, e.g. 0x2466" value={device} onChange={(e) => setDevice(e.target.value)} aria-label="Filter by device address" />
        <div className="seg" role="group" aria-label="Time range">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => <button key={r} className={range === r ? "on" : ""} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>)}
        </div>
        {kindsHere.length > 1 && (
          <div className="seg" role="group" aria-label="Kind">
            {kindsHere.map((k) => <button key={k} className={kinds.includes(k) ? "on" : ""} aria-pressed={kinds.includes(k)} onClick={() => toggleKind(k)}>{k}</button>)}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="glass relative h-[70vh] min-h-[480px] overflow-hidden" aria-label="Hexagon coverage map">
          <div ref={box} className="h-full w-full" />
          <div className="pod absolute left-3 top-3 rounded-full">
            <div className="seg" role="group" aria-label="Colour hexagons by">
              {METRICS.map((m) => <button key={m} className={metric === m ? "on" : ""} aria-pressed={metric === m} onClick={() => setMetric(m)}>{m}</button>)}
            </div>
          </div>
          <div className="pod absolute bottom-3 left-3 w-56 space-y-1.5 rounded-lg p-3">
            <p className="eyebrow">{metric} · height = samples</p>
            {metric === "Kind" ? (
              Object.entries(KIND_COLOR).map(([k, c]) => <p key={k} className="flex items-center gap-2 text-xs"><i className="size-2.5 rounded-sm" style={{ background: c }} />{k}</p>)
            ) : (
              <>
                <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${metric === "Access" ? "#ff3d71, #22ef7e" : VOLUME.join(",")})` }} />
                <p className="mono flex justify-between text-[10px] text-[var(--st-on-var)]">
                  {metric === "Access" ? <><span>encrypted</span><span>readable</span></> : <><span>0</span><span>{max}</span></>}
                </p>
              </>
            )}
          </div>
          {cells.length === 0 && <p className="pod absolute inset-x-0 top-1/2 mx-auto w-fit rounded-lg px-4 py-2 text-sm">No samples match these filters.</p>}
        </section>

        <aside className="glass h-fit space-y-4 p-6" aria-label="Cell details">
          {!sel ? (
            <>
              <div>
                <p className="eyebrow">Coverage</p>
                <p className="mt-1 text-lg font-medium">{cells.length} cells · {shownTotal} samples</p>
              </div>
              <div className="space-y-1">
                <div className="kv"><span>Area</span><span>{dataset.lat.toFixed(4)}, {dataset.lon.toFixed(4)} · {dataset.radiusM} m</span></div>
                <div className="kv"><span>H3 resolution</span><span>{res}</span></div>
                <div className="kv"><span>Devices</span><span>{new Set(cells.flatMap((c) => c.devices)).size}</span></div>
                <div className="kv"><span>Readable to you</span><span>{cells.reduce((n, c) => n + c.samples.filter((s) => s.readable).length, 0)} / {shownTotal}</span></div>
              </div>
              <p className="text-xs text-[var(--st-on-var)]">Click a hexagon to see its samples. Validator consensus per cell comes with the staking phase.</p>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="eyebrow">H3 cell · res {res}</p>
                  <p className="mono mt-1 text-sm">{sel.id}</p>
                </div>
                <button className="icon-btn" onClick={() => setSelId(undefined)} aria-label="Close cell"><LuX size={16} /></button>
              </div>
              <div className="space-y-1">
                <div className="kv"><span>Samples</span><span>{sel.samples.length}</span></div>
                <div className="kv"><span>Latest</span><span>{when(sel.samples[0].capturedAt)}</span></div>
                <div className="kv"><span>Readable to you</span><span>{Math.round(sel.readable * 100)}%</span></div>
              </div>
              <div className="space-y-1.5">
                <p className="eyebrow">Devices</p>
                <div className="flex flex-wrap gap-1">{sel.devices.map((d) => <span key={d} className="pill mono" title={d}>{short(d, 6, 4)}</span>)}</div>
              </div>
              <div className="space-y-1.5">
                <p className="eyebrow">Samples</p>
                <ul className="max-h-80 space-y-1 overflow-auto">
                  {sel.samples.map((s) => (
                    <li key={s.key}>
                      <Link href={`/explore?dataset=${datasetKey}&sample=${s.key}`} className="sub flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--st-3)]">
                        {s.readable ? <LuLockOpen size={13} className="shrink-0 text-[var(--st-phosphor)]" aria-label="readable" /> : <LuLock size={13} className="shrink-0 text-[var(--st-on-var)]" aria-label="encrypted" />}
                        <span className="pill mono">{s.kind}</span>
                        <span className="mono text-[var(--st-on-var)]">{when(s.capturedAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
