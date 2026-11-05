"use client";
import { Map as MapLibre, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LuArrowLeft, LuEyeOff, LuSearch, LuX } from "react-icons/lu";
import type { Dataset } from "@/lib/data";
import { ACCEPT_SCORE, areasOf, CITIES, cellsFor, COMMITTEE, SUPERMAJORITY, type Status } from "@/lib/hexes";
import { setSubscribed, useSubscribed } from "@/lib/subscriptions";
import { useDark } from "@/lib/theme";

const BASEMAP = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};
const STATUS: Record<Status, [string, string]> = {
  verified: ["#22ef7e", "verified"],
  challenge: ["#ff9100", "in challenge window"],
  rejected: ["#ff3d71", "rejected"],
};
const METRICS = ["Consensus", "Volume", "Quality", "Status"] as const;
const RAMPS: Record<Exclude<(typeof METRICS)[number], "Status">, string[]> = {
  Consensus: ["#ff3d71", "#ff9100", "#22ef7e"],
  Volume: ["#2e2e2e", "#c5f467"],
  Quality: ["#5203d5", "#cdbdff", "#22ef7e"],
};
const RANGES = { "24h": 1 / 30, "7d": 7 / 30, "30d": 1 };

const ramp = (stops: string[], t: number) => {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const [a, b] = [stops[i], stops[i + 1]].map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
  return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * (x - i))).join(",")})`;
};
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function HexConsensus({ dataset }: { dataset: Dataset }) {
  const subscribed = useSubscribed(dataset.id);
  const dark = useDark();
  const areas = useMemo(() => areasOf(dataset), [dataset]);
  const cells = useMemo(() => cellsFor(dataset), [dataset]);

  const [area, setArea] = useState("");
  const [range, setRange] = useState<keyof typeof RANGES>("30d");
  const [mods, setMods] = useState<string[]>([]);
  const [minConsensus, setMinConsensus] = useState(0);
  const [device, setDevice] = useState("");
  const [statuses, setStatuses] = useState<Status[]>(["verified", "challenge", "rejected"]);
  const [metric, setMetric] = useState<(typeof METRICS)[number]>("Consensus");
  const [selId, setSelId] = useState<string>();

  const toggle = <T,>(set: (f: (s: T[]) => T[]) => void, v: T) => set((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const shown = useMemo(() => cells
    .map((c) => ({ ...c, samples: Math.round(c.samples30d * RANGES[range]) }))
    .filter((c) => c.samples > 0
      && (!(area in CITIES) || c.area === area)
      && mods.every((m) => c.modalities.includes(m))
      && c.consensus * 100 >= minConsensus
      && (!device || c.devices.some((d) => d.includes(device.trim().toLowerCase())))
      && statuses.includes(c.status)),
  [cells, range, area, mods, minConsensus, device, statuses]);
  const sel = shown.find((c) => c.id === selId);

  const maxSamples = Math.max(1, ...shown.map((c) => c.samples));
  const geojson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: shown.map((c) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [c.ring] },
      properties: {
        id: c.id,
        selected: c.id === selId,
        height: 40 + (c.samples / maxSamples) * 1400,
        color: metric === "Status" ? STATUS[c.status][0]
          : metric === "Consensus" ? ramp(RAMPS.Consensus, c.consensus)
          : metric === "Volume" ? ramp(RAMPS.Volume, c.samples / maxSamples)
          : ramp(RAMPS.Quality, (c.quality - 0.25) / 0.75),
      },
    })),
  }), [shown, selId, metric, maxSamples]);

  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre>(null);
  const data = useRef(geojson);

  useEffect(() => {
    if (!subscribed || !box.current) return;
    // MapLibre derives its worker URL from import.meta.url, which the bundler rewrites.
    setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
    const [lat, lng] = CITIES[areas[0]];
    const m = new MapLibre({
      container: box.current,
      style: BASEMAP[dark ? "dark" : "light"],
      center: [lng, lat], zoom: 11.6, pitch: 50, bearing: -20,
      attributionControl: { compact: true },
    });
    m.on("style.load", () => {
      m.addSource("hex", { type: "geojson", data: data.current });
      m.addLayer({ id: "hex-fill", type: "fill-extrusion", source: "hex", paint: {
        "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "height"], "fill-extrusion-opacity": 0.82,
      } });
      m.addLayer({ id: "hex-sel", type: "line", source: "hex", filter: ["==", ["get", "selected"], true], paint: { "line-color": "#ffffff", "line-width": 3 } });
    });
    m.on("click", "hex-fill", (e) => setSelId(e.features?.[0]?.properties?.id));
    m.on("mouseenter", "hex-fill", () => { m.getCanvas().style.cursor = "pointer"; });
    m.on("mouseleave", "hex-fill", () => { m.getCanvas().style.cursor = ""; });
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, [subscribed, areas, dark]);

  useEffect(() => {
    data.current = geojson;
    (map.current?.getSource("hex") as { setData(d: GeoJSON.FeatureCollection): void } | undefined)?.setData(geojson);
  }, [geojson]);

  useEffect(() => {
    if (!(area in CITIES)) return;
    const [lat, lng] = CITIES[area];
    map.current?.flyTo({ center: [lng, lat], zoom: 12.2 });
  }, [area, dark]);

  const header = (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link href="/mockups/datasets" className="icon-btn" aria-label="Back to datasets"><LuArrowLeft size={18} /></Link>
      <div>
        <p className="eyebrow">Data source · consensus map</p>
        <h1 className="text-2xl font-semibold tracking-tight">{dataset.name}</h1>
      </div>
      {subscribed && (
        <button className="btn ml-auto" onClick={() => setSubscribed(dataset.id, false)}>Unsubscribe</button>
      )}
    </header>
  );

  if (!subscribed) {
    return (
      <main className="flex flex-col gap-4">
        {header}
        <div className="glass mx-auto mt-10 max-w-md space-y-3 p-6 text-center">
          <LuEyeOff size={34} className="mx-auto text-[var(--st-cyan)]" />
          <p className="text-lg font-medium">Subscribe to open this source</p>
          <p className="text-sm text-[var(--st-on-var)]">Subscribers see every H3 cell this source covers, the validator committee behind each batch and its live consensus.</p>
          <button className="btn primary w-full" onClick={() => setSubscribed(dataset.id, true)}>Subscribe · ${dataset.price}/h</button>
        </div>
      </main>
    );
  }

  const totalSamples = shown.reduce((s, c) => s + c.samples, 0);
  const avgConsensus = shown.length ? shown.reduce((s, c) => s + c.consensus, 0) / shown.length : 0;

  return (
    <main className="flex flex-col gap-4">
      {header}

      <div className="glass flex flex-wrap items-center gap-2 p-3" role="search">
        <label className="relative min-w-52 flex-1">
          <LuSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--st-on-var)]" />
          <input className="field pl-10!" list="areas" placeholder="Search area, e.g. Bengaluru" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Search by area" />
          <datalist id="areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
        </label>
        <input className="field max-w-56" placeholder="Device, e.g. glasses-3f2a" value={device} onChange={(e) => setDevice(e.target.value)} aria-label="Filter by device ENS name" />
        <div className="seg" role="group" aria-label="Time range">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => <button key={r} className={range === r ? "on" : ""} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Data type">
          {dataset.modalities.map((m) => <button key={m} className={mods.includes(m) ? "on" : ""} aria-pressed={mods.includes(m)} onClick={() => toggle(setMods, m)}>{m}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Batch status">
          {(Object.keys(STATUS) as Status[]).map((s) => (
            <button key={s} className={statuses.includes(s) ? "on" : ""} aria-pressed={statuses.includes(s)} onClick={() => toggle(setStatuses, s)}>
              <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: STATUS[s][0] }} />{s}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--st-on-var)]">
          <span className="eyebrow">Min consensus</span>
          <input type="range" min={0} max={100} step={5} value={minConsensus} onChange={(e) => setMinConsensus(+e.target.value)} className="accent-[var(--st-cyan)]" aria-label="Minimum consensus percent" />
          <span className="mono w-9 text-[var(--st-on)]">{minConsensus}%</span>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="glass relative h-[70vh] min-h-[480px] overflow-hidden" aria-label="Hexagon consensus map">
          <div ref={box} className="h-full w-full" />
          <div className="pod absolute left-3 top-3 rounded-full">
            <div className="seg" role="group" aria-label="Colour hexagons by">
              {METRICS.map((m) => <button key={m} className={metric === m ? "on" : ""} aria-pressed={metric === m} onClick={() => setMetric(m)}>{m}</button>)}
            </div>
          </div>
          <div className="pod absolute bottom-3 left-3 w-56 space-y-1.5 rounded-lg p-3">
            <p className="eyebrow">{metric} · height = samples</p>
            {metric === "Status" ? (
              (Object.keys(STATUS) as Status[]).map((s) => <p key={s} className="flex items-center gap-2 text-xs"><i className="size-2.5 rounded-sm" style={{ background: STATUS[s][0] }} />{STATUS[s][1]}</p>)
            ) : (
              <>
                <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${RAMPS[metric].join(",")})` }} />
                <p className="mono flex justify-between text-[10px] text-[var(--st-on-var)]">
                  {metric === "Volume" ? <><span>0</span><span>{maxSamples.toLocaleString()}</span></> : metric === "Quality" ? <><span>0.25</span><span>1.00</span></> : <><span>0%</span><span>100%</span></>}
                </p>
              </>
            )}
          </div>
          {shown.length === 0 && <p className="pod absolute inset-x-0 top-1/2 mx-auto w-fit rounded-lg px-4 py-2 text-sm">No cell matches these filters.</p>}
        </section>

        <aside className="glass h-fit space-y-4 p-6" aria-label="Cell consensus">
          {!sel ? (
            <>
              <div>
                <p className="eyebrow">Coverage</p>
                <p className="mt-1 text-lg font-medium">{shown.length} cells · {areas.length} areas</p>
              </div>
              <div className="space-y-1">
                <div className="kv"><span>Samples ({range})</span><span>{totalSamples.toLocaleString()}</span></div>
                <div className="kv"><span>Avg consensus</span><span>{pct(avgConsensus)}</span></div>
                {(Object.keys(STATUS) as Status[]).map((s) => <div key={s} className="kv"><span>{STATUS[s][1]}</span><span>{shown.filter((c) => c.status === s).length}</span></div>)}
              </div>
              <div className="sub space-y-2 p-4 text-xs text-[var(--st-on-var)]">
                <p className="eyebrow">How a cell reaches consensus</p>
                <p>A VRF picks {COMMITTEE} staked validators per batch. Each commits a hidden score, then reveals it.</p>
                <p>A vote agrees when its score is at least {ACCEPT_SCORE.toFixed(2)}. Consensus is the share of revealed stake that agrees.</p>
                <p>Verified needs {pct(SUPERMAJORITY)} of stake revealed, {pct(SUPERMAJORITY)} agreeing and a closed challenge window. Under {pct(1 - SUPERMAJORITY)} agreeing is rejected.</p>
              </div>
              <p className="text-xs text-[var(--st-on-var)]">Click a hexagon to inspect its committee.</p>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="eyebrow">H3 cell · res 8</p>
                  <p className="mono mt-1 text-sm">{sel.id}</p>
                  <p className="text-xs text-[var(--st-on-var)]">{sel.area}</p>
                </div>
                <button className="icon-btn" onClick={() => setSelId(undefined)} aria-label="Close cell"><LuX size={16} /></button>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-3xl font-semibold">{pct(sel.consensus)}</p>
                  <span className="pill status" style={{ "--tone": STATUS[sel.status][0] } as React.CSSProperties}>{STATUS[sel.status][1]}</span>
                </div>
                <div className="relative h-2 rounded-full bg-[var(--st-3)]" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: pct(sel.consensus), background: ramp(RAMPS.Consensus, sel.consensus) }} />
                  <i className="absolute -top-1 h-4 w-px bg-[var(--st-on)]" style={{ left: pct(SUPERMAJORITY) }} title="Supermajority" />
                </div>
                <p className="text-xs text-[var(--st-on-var)]">Stake-weighted agreement · line marks the {pct(SUPERMAJORITY)} supermajority</p>
              </div>

              <div className="space-y-1">
                <div className="kv"><span>Samples ({range})</span><span>{sel.samples.toLocaleString()}</span></div>
                <div className="kv"><span>Quality</span><span>{sel.quality.toFixed(2)}</span></div>
                <div className="kv"><span>Stake revealed</span><span>{pct(sel.quorum)}</span></div>
                <div className="kv"><span>Challenge window</span><span>{sel.windowHours ? `${sel.windowHours} h left` : "closed"}</span></div>
                <div className="kv"><span>Data types</span><span>{sel.modalities.join(" · ") || "none"}</span></div>
              </div>

              <div className="space-y-1.5">
                <p className="eyebrow">Devices</p>
                <div className="flex flex-wrap gap-1">{sel.devices.map((d) => <span key={d} className="pill mono">{d}</span>)}</div>
              </div>

              <div className="space-y-1.5">
                <p className="eyebrow">Committee votes</p>
                <table className="w-full text-xs">
                  <thead className="text-left text-[var(--st-outline)]"><tr><th className="font-normal">Validator</th><th className="text-right font-normal">Stake</th><th className="text-right font-normal">Score</th><th /></tr></thead>
                  <tbody className="mono">
                    {sel.votes.map((v, i) => {
                      const tone = v.score === null ? "#ff9100" : v.score >= ACCEPT_SCORE ? "#22ef7e" : "#ff3d71";
                      return (
                        <tr key={i} className="border-t border-[var(--st-line)]">
                          <td className="py-1">{v.validator}</td>
                          <td className="text-right">{v.stake.toLocaleString()}</td>
                          <td className="text-right">{v.score === null ? "—" : v.score.toFixed(2)}</td>
                          <td className="pl-2 text-right" style={{ color: tone }}>{v.score === null ? "no reveal" : v.score >= ACCEPT_SCORE ? "agree" : "reject"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-[var(--st-on-var)]">A missed reveal is slashable and counts toward neither side.</p>
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
