"use client";
import { LuCircleCheck, LuCircleX, LuDownload, LuLock, LuSearch } from "react-icons/lu";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useWallet } from "@/components/wallet";
import { short } from "@/lib/data";

type Row = {
  key: string; distanceM: number; kind: string; capturedAt: number; device: string; deviceType: string; storage: string;
  size: number; mime: string; encrypted: boolean; readable: boolean;
};
type Detail = Row & {
  owner: string; createdAtBlock?: string; expiresAtBlock: string; lat: string; lon: string; worldId: string; mac: string; geohash: string;
  contentHash: string; sensorsHash: string; ogRoot?: string; signature: string; sensors?: unknown; data?: string;
  verified: { signature: boolean; contentHash: boolean | null; sensorsHash: boolean | null };
};
type DatasetOption = { key: string; name: string };

const KINDS = ["", "image", "video", "audio", "text", "sensor"];
const BANDRA = { lat: "19.0596", lon: "72.8295" };
const when = (ts: number) => new Date(ts * 1000).toLocaleString();
const unix = (date: string, end = false) => (date ? String(Math.floor(new Date(`${date}T${end ? "23:59:59" : "00:00:00"}`).getTime() / 1000)) : "");

type Form = { lat: string; lon: string; radius: string; kind: string; deviceType: string; from: string; to: string };

async function fetchSamples(dataset: string, f: Form) {
  const qs = dataset
    ? new URLSearchParams({ dataset, limit: "200" })
    : new URLSearchParams(Object.entries({ lat: f.lat, lon: f.lon, radius: f.radius, kind: f.kind, deviceType: f.deviceType, from: unix(f.from), to: unix(f.to, true), limit: "200" }).filter(([, v]) => v));
  const res = await fetch(`/api/samples?${qs}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { rows: [] as Row[], error: (body.error ?? `failed (${res.status})`) as string };
  return { rows: body.samples as Row[], meta: { total: body.total as number, scanned: body.scanned as number, truncated: body.truncated as boolean } };
}

export default function ExplorePage() {
  return <Suspense fallback={<p className="text-sm text-[var(--st-on-var)]">Loading…</p>}><Explore /></Suspense>;
}

function Explore() {
  const params = useSearchParams();
  const router = useRouter();
  const { session } = useWallet();
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [dataset, setDataset] = useState(params.get("dataset") ?? "");
  const [f, setF] = useState<Form>({ ...BANDRA, radius: "500", kind: "", deviceType: "", from: "", to: "" });
  const [rows, setRows] = useState<Row[]>();
  const [meta, setMeta] = useState<{ total: number; scanned: number; truncated: boolean }>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const selected = params.get("sample");

  useEffect(() => {
    fetch("/api/datasets").then((r) => r.json()).then((b) => setDatasets((b.datasets ?? []).map((d: DatasetOption) => ({ key: d.key, name: d.name })))).catch(() => {});
  }, [session]);

  const apply = (r: Awaited<ReturnType<typeof fetchSamples>>) => {
    setLoading(false);
    setError(r.error);
    setRows(r.rows);
    if (r.meta) setMeta(r.meta);
  };
  // Re-run when the dataset or the signed-in wallet changes (access may change).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSamples(dataset, f).then(apply); }, [dataset, session]);

  const pick = (key?: string) => {
    const next = new URLSearchParams(params);
    if (key) next.set("sample", key); else next.delete("sample");
    router.replace(`/explore?${next}`, { scroll: false });
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <main className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Explore samples</h1>
        <p className="muted text-sm">Search Arkiv by place, time and type. Metadata is public; payloads decrypt for admins and subscribers.</p>
      </header>

      <form className="glass grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(6,minmax(0,1fr))_auto]" onSubmit={(e) => { e.preventDefault(); setLoading(true); fetchSamples(dataset, f).then(apply); }}>
        <label className="block"><span className="label">Dataset</span>
          <select className="field" value={dataset} onChange={(e) => setDataset(e.target.value)}>
            <option value="">Custom area</option>
            {datasets.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
          </select>
        </label>
        <fieldset className="contents" disabled={!!dataset}>
          <label className="block"><span className="label">Latitude</span><input className="field" inputMode="decimal" value={f.lat} onChange={set("lat")} /></label>
          <label className="block"><span className="label">Longitude</span><input className="field" inputMode="decimal" value={f.lon} onChange={set("lon")} /></label>
          <label className="block"><span className="label">Radius (m)</span><input className="field" type="number" min={1} max={50000} value={f.radius} onChange={set("radius")} /></label>
          <label className="block"><span className="label">Kind</span>
            <select className="field" value={f.kind} onChange={set("kind")}>{KINDS.map((k) => <option key={k} value={k}>{k || "any"}</option>)}</select>
          </label>
          <label className="block"><span className="label">From</span><input className="field" type="date" value={f.from} onChange={set("from")} /></label>
          <label className="block"><span className="label">To</span><input className="field" type="date" value={f.to} onChange={set("to")} /></label>
        </fieldset>
        <button className="btn primary self-end" disabled={loading}><LuSearch size={14} />{loading ? "Searching…" : "Search"}</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="glass overflow-hidden" aria-label="Results" aria-busy={loading}>
          <div className="flex items-center gap-3 border-b border-[var(--st-line)] px-4 py-2 text-xs text-[var(--st-on-var)]">
            {meta ? <span>{meta.total} samples{meta.truncated && ` (first ${meta.scanned} scanned)`}</span> : <span>Searching Arkiv…</span>}
            {!session && <span className="ml-auto">Sign in to decrypt what you have access to.</span>}
          </div>
          {error && <p className="p-4 text-sm text-[var(--st-crimson)]" role="alert">{error}</p>}
          {rows?.length === 0 && !error && <p className="p-4 text-sm text-[var(--st-on-var)]">No samples here. Try a larger radius or another area.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              {!!rows?.length && (
                <thead className="eyebrow">
                  <tr>{["Captured", "Kind", "Distance", "Device", "Storage", "Size", ""].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
              )}
              <tbody>
                {rows?.map((r) => (
                  <tr key={r.key} onClick={() => pick(r.key)} aria-selected={selected === r.key}
                    className={`cursor-pointer border-t border-[var(--st-line)] ${selected === r.key ? "bg-[var(--st-3)]" : "hover:bg-[var(--st-2)]"}`}>
                    <td className="px-4 py-2 mono">
                      <button className="text-left" onClick={(e) => { e.stopPropagation(); pick(r.key); }}>{when(r.capturedAt)}</button>
                    </td>
                    <td className="px-4 py-2"><span className="pill mono">{r.kind}</span></td>
                    <td className="px-4 py-2 mono">{r.distanceM} m</td>
                    <td className="px-4 py-2 mono" title={r.device}>{short(r.device, 6, 4)}</td>
                    <td className="px-4 py-2 mono">{r.storage}</td>
                    <td className="px-4 py-2 mono">{(r.size / 1024).toFixed(1)} KiB</td>
                    <td className="px-4 py-2">{!r.readable && <LuLock size={13} className="text-[var(--st-on-var)]" aria-label="encrypted" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="glass h-fit space-y-4 p-5 lg:sticky lg:top-20" aria-label="Sample">
          {selected ? <SampleDetail key={`${selected}-${session?.address}`} id={selected} /> : <p className="text-sm text-[var(--st-on-var)]">Pick a sample to see its proof and data.</p>}
        </aside>
      </div>
    </main>
  );
}

function Check({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return <div className="kv"><span>{label}</span><span className="text-[var(--st-on-var)]">needs access</span></div>;
  return (
    <div className="kv">
      <span>{label}</span>
      <span className="flex items-center justify-end gap-1" style={{ color: ok ? "var(--st-phosphor)" : "var(--st-crimson)" }}>
        {ok ? <LuCircleCheck size={12} /> : <LuCircleX size={12} />}{ok ? "valid" : "INVALID"}
      </span>
    </div>
  );
}

function SampleDetail({ id }: { id: string }) {
  const [s, setS] = useState<Detail>();
  const [error, setError] = useState<string>();
  const [text, setText] = useState<string>();

  useEffect(() => {
    fetch(`/api/samples/${id}`).then(async (r) => {
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setS(b);
      if (b.readable && /^text\/|json/.test(b.mime)) {
        setText(b.data ? new TextDecoder().decode(Uint8Array.from(atob(b.data), (c) => c.charCodeAt(0))) : await fetch(`/api/samples/${id}/data`).then((x) => x.text()));
      }
    }).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-sm text-[var(--st-crimson)]" role="alert">{error}</p>;
  if (!s) return <p className="text-sm text-[var(--st-on-var)]">Loading sample from Arkiv…</p>;
  const src = `/api/samples/${id}/data`;

  return (
    <>
      <div>
        <p className="eyebrow">Sample</p>
        <p className="mono mt-1 break-all text-xs">{s.key}</p>
      </div>

      {s.readable ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, session-gated bytes; next/image would cache them */}
          {s.mime.startsWith("image/") && <img src={src} alt={`Captured ${s.kind} sample`} className="w-full rounded-lg" />}
          {s.mime.startsWith("video/") && <video src={src} controls className="w-full rounded-lg" />}
          {s.mime.startsWith("audio/") && <audio src={src} controls className="w-full" />}
          {text !== undefined && <pre className="mono max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--st-void)] p-3 text-[11px]">{text}</pre>}
          <a href={src} download className="btn w-full"><LuDownload size={14} />Download payload</a>
        </div>
      ) : (
        <div className="sub space-y-2 p-3 text-xs text-[var(--st-on-var)]">
          <p className="flex items-center gap-2 text-[var(--st-on)]"><LuLock size={14} />Encrypted payload</p>
          <p>Subscribe to a dataset that covers this sample to decrypt it.</p>
          <Link href="/datasets" className="text-[var(--st-cyan)] hover:underline">Browse datasets →</Link>
        </div>
      )}

      <div className="space-y-1">
        <p className="eyebrow">Proof</p>
        <Check ok={s.verified.signature} label="Device signature" />
        <Check ok={s.verified.contentHash} label="Payload hash" />
        <Check ok={s.verified.sensorsHash} label="Sensors hash" />
      </div>

      <div className="space-y-1">
        <p className="eyebrow">Metadata</p>
        <div className="kv"><span>Captured</span><span>{when(s.capturedAt)}</span></div>
        <div className="kv"><span>Location</span><span>{s.lat}, {s.lon} · {s.geohash}</span></div>
        <div className="kv"><span>Kind / type</span><span>{s.kind} · {s.mime}</span></div>
        <div className="kv"><span>Device</span><span title={s.device}>{short(s.device)}</span></div>
        <div className="kv"><span>Device type</span><span>{s.deviceType}</span></div>
        <div className="kv"><span>MAC</span><span>{s.mac}</span></div>
        <div className="kv"><span>World ID</span><span title={s.worldId}>{short(s.worldId)}</span></div>
        <div className="kv"><span>Content hash</span><span title={s.contentHash}>{short(s.contentHash)}</span></div>
        <div className="kv"><span>Storage</span><span>{s.storage}{s.ogRoot && ` · ${short(s.ogRoot)}`}</span></div>
        <div className="kv"><span>Encrypted</span><span>{s.encrypted ? "AES-256-GCM, per-sample key" : "no (early sample)"}</span></div>
        <div className="kv"><span>Arkiv blocks</span><span>created {s.createdAtBlock ?? "?"} · expires {s.expiresAtBlock}</span></div>
      </div>

      {s.sensors !== undefined && (
        <div className="space-y-1">
          <p className="eyebrow">Sensors</p>
          <pre className="mono max-h-40 overflow-auto rounded-lg bg-[var(--st-void)] p-3 text-[11px]">{JSON.stringify(s.sensors, null, 2)}</pre>
        </div>
      )}
    </>
  );
}
