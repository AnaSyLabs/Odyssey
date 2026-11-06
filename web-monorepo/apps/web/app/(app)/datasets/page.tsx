"use client";
import { LuArrowUpRight, LuBadgeCheck, LuHexagon, LuLock, LuLockOpen, LuPlus, LuSearch } from "react-icons/lu";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, type Hex } from "viem";
import McpAccess from "@/components/McpAccess";
import { CardsSkeleton, Loading, RowsSkeleton } from "@/components/Skeleton";
import { useToastError } from "@/components/Toaster";
import { errorText, useWallet } from "@/components/wallet";
import { ogTxUrl } from "@/lib/chains";
import { short } from "@/lib/data";
import { subscriptionsAbi } from "@/lib/subscriptions-abi";

type Dataset = {
  key: Hex; name: string; description: string; lat: number; lon: number; radiusM: number; kind: string; deviceType: string;
  fromTs: number; toTs: number; price: string; priceDisplay: string; active: boolean; samples: number; samplesTruncated: boolean;
  kinds: string[]; paidUntil: number | null;
};
type Preview = { key: Hex; kind: string; capturedAt: number; distanceM: number; readable: boolean; device: string };

const KINDS = ["", "image", "video", "audio", "text", "sensor"];
const day = (ts: number) => new Date(ts * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const range = (d: Dataset) => (d.fromTs || d.toTs ? `${d.fromTs ? day(d.fromTs) : "…"} → ${d.toTs ? day(d.toTs) : "now"}` : "All time");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postJson(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { res, body: await res.json().catch(() => ({})) };
}

async function fetchDatasets(): Promise<{ list?: Dataset[]; error?: string }> {
  const res = await fetch("/api/datasets");
  const body = await res.json().catch(() => ({}));
  return res.ok ? { list: body.datasets } : { error: body.error ?? `Could not load datasets (${res.status})` };
}

export default function Datasets() {
  const { session } = useWallet();
  const [list, setList] = useState<Dataset[]>();
  const [loadError, setLoadError] = useToastError();
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<Hex>();
  const [creating, setCreating] = useState(false);

  const apply = useCallback((r: Awaited<ReturnType<typeof fetchDatasets>>) => {
    setLoadError(r.error);
    if (r.list) setList(r.list);
  }, [setLoadError]);
  const load = useCallback(async () => apply(await fetchDatasets()), [apply]);
  useEffect(() => { fetchDatasets().then(apply); }, [apply, session]);

  const [kind, setKind] = useState("");
  const shown = useMemo(
    () => (list ?? []).filter((d) => (d.name + d.description).toLowerCase().includes(q.toLowerCase()) && (!kind || !d.kind || d.kind === kind || d.kinds.includes(kind))),
    [list, q, kind],
  );
  const open = list?.find((d) => d.key === openKey);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
          <p className="muted text-sm">Live, signed first-person data on Arkiv. Subscribe for 30 days with test 0G to decrypt and download it.</p>
        </div>
        {session?.admin && (
          <button className="btn ml-auto" onClick={() => { setCreating(true); setOpenKey(undefined); }}><LuPlus size={16} />New dataset</button>
        )}
      </header>

      {session && <McpAccess />}

      <div className="glass flex flex-wrap items-center gap-2 p-3">
        <label className="relative min-w-60 flex-1">
          <LuSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--st-on-var)]" />
          <input className="field pl-10!" placeholder="Search datasets…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search datasets" />
        </label>
        <div className="seg" role="group" aria-label="Filter by kind">
          {KINDS.slice(1).map((k) => <button key={k} className={kind === k ? "on" : ""} aria-pressed={kind === k} onClick={() => setKind(kind === k ? "" : k)}>{k}</button>)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="grid content-start gap-3 md:grid-cols-2" aria-label="Datasets" aria-busy={!list && !loadError}>
          {!list && !loadError && <Loading label="Loading datasets from Arkiv" className="contents"><CardsSkeleton count={4} /></Loading>}
          {list && shown.length === 0 && (
            <p className="text-sm text-[var(--st-on-var)]">{list.length ? "No dataset matches." : session?.admin ? "No datasets yet. Create the first one." : "No datasets for sale yet."}</p>
          )}
          {shown.map((d) => (
            <div key={d.key} className="relative">
            <button onClick={() => { setOpenKey(d.key); setCreating(false); }} aria-pressed={openKey === d.key}
              className={`glass notch flex h-full w-full flex-col gap-3 p-6 text-left transition ${openKey === d.key ? "ring-1 ring-[var(--st-cyan)]" : "hover:bg-[var(--st-2)]!"}`}>
              <div className="flex flex-col items-start gap-2 pr-14">
                {d.paidUntil ? <span className="pill status" style={{ "--tone": "var(--st-phosphor)" } as React.CSSProperties}>subscribed</span>
                  : <span className="pill">{d.active ? "for sale" : "unlisted"}</span>}
                <p className="text-xl leading-snug">{d.name}</p>
              </div>
              {d.description && <p className="line-clamp-3 text-xs text-[var(--st-on-var)]">{d.description}</p>}
              <div className="flex flex-wrap gap-1">
                {(d.kind ? [d.kind] : d.kinds).map((k) => <span key={k} className="pill mono">{k}</span>)}
                <span className="pill mono">{d.radiusM >= 1000 ? `${d.radiusM / 1000} km` : `${d.radiusM} m`} radius</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-[var(--st-line)] pt-3 text-center">
                <div><p className="font-semibold">{d.samples.toLocaleString()}{d.samplesTruncated && "+"}</p><p className="eyebrow">samples</p></div>
                <div><p className="font-semibold">{d.priceDisplay}</p><p className="eyebrow">0G / 30 days</p></div>
                <div><p className="font-semibold">{d.paidUntil ? day(d.paidUntil) : "—"}</p><p className="eyebrow">access until</p></div>
              </div>
            </button>
            <span className={`notch-btn ${openKey === d.key ? "border-transparent! bg-[var(--st-lime)] text-[#07090e]!" : ""}`} aria-hidden><LuArrowUpRight size={20} /></span>
            </div>
          ))}
        </section>

        <aside className="glass h-fit space-y-4 p-6 lg:sticky lg:top-20" aria-label="Dataset details">
          {creating ? <NewDataset onDone={async (key) => { setCreating(false); await load(); if (key) setOpenKey(key); }} />
            : open ? <Detail key={open.key} d={open} reload={load} />
            : <p className="text-sm text-[var(--st-on-var)]">Pick a dataset to see what it covers, preview its samples and subscribe.</p>}
        </aside>
      </div>
    </main>
  );
}

function Detail({ d, reload }: { d: Dataset; reload: () => Promise<void> }) {
  const { session, signIn, pay } = useWallet();
  const [preview, setPreview] = useState<Preview[]>();
  const [step, setStep] = useState<string>();
  const [tx, setTx] = useState<Hex>();
  const [, setError] = useToastError();
  const busy = !!step && step !== "done";

  useEffect(() => {
    fetch(`/api/samples?dataset=${d.key}&limit=8`).then((r) => r.json()).then((b) => setPreview(b.samples ?? [])).catch(() => setPreview([]));
  }, [d.key, d.paidUntil]);

  // The contract records access in the same transaction; wait until the gateway sees the new paid-until.
  const subscribe = async () => {
    setError(undefined);
    try {
      setStep("Confirm the payment in your wallet…");
      const { contract } = await fetch("/api/config").then((r) => r.json());
      const hash = await pay(contract, BigInt(d.price), encodeFunctionData({ abi: subscriptionsAbi, functionName: "subscribe", args: [d.key] }));
      setTx(hash);
      setStep("Waiting for 0G Galileo to confirm the payment…");
      for (let i = 0; i < 40; i++) {
        await sleep(3000);
        const now = (await fetchDatasets()).list?.find((x) => x.key === d.key);
        if (now?.paidUntil && now.paidUntil > (d.paidUntil ?? 0)) {
          setStep("done");
          await reload();
          return;
        }
      }
      throw new Error("Payment sent, but access hasn't shown up after 2 minutes. Check the payment link below, then refresh.");
    } catch (e) {
      setError(errorText(e));
      setStep(undefined);
    }
  };

  const toggle = async () => {
    const { res, body } = await postJson(`/api/datasets/${d.key}`, { active: !d.active }, "PATCH");
    if (res.ok) await reload(); else setError(body.error);
  };

  return (
    <>
      <div>
        <p className="eyebrow">Dataset</p>
        <p className="mt-1 text-lg font-medium">{d.name}</p>
        {d.description && <p className="mt-1 whitespace-pre-line text-xs text-[var(--st-on-var)]">{d.description}</p>}
      </div>
      <div className="space-y-1">
        <div className="kv"><span>Area</span><span>{d.lat.toFixed(4)}, {d.lon.toFixed(4)} · {d.radiusM} m</span></div>
        <div className="kv"><span>Kind</span><span>{d.kind || "any"}</span></div>
        <div className="kv"><span>Device type</span><span>{d.deviceType || "any"}</span></div>
        <div className="kv"><span>Captured</span><span>{range(d)}</span></div>
        <div className="kv"><span>Samples now</span><span>{d.samples.toLocaleString()}{d.samplesTruncated && "+"} (new ones included)</span></div>
        <div className="kv"><span>Dataset key</span><span title={d.key}>{short(d.key)}</span></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Latest samples</p>
          <Link href={`/explore?dataset=${d.key}`} className="text-xs text-[var(--st-cyan)] hover:underline">Open in Explore →</Link>
        </div>
        {!preview && <Loading label="Loading samples"><RowsSkeleton rows={3} /></Loading>}
        {preview?.length === 0 && <p className="text-xs text-[var(--st-on-var)]">No samples match yet.</p>}
        {preview?.map((s) => (
          <Link key={s.key} href={`/explore?dataset=${d.key}&sample=${s.key}`} className="sub flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--st-3)]">
            {s.readable ? <LuLockOpen size={14} className="shrink-0 text-[var(--st-phosphor)]" aria-label="readable" /> : <LuLock size={14} className="shrink-0 text-[var(--st-on-var)]" aria-label="encrypted" />}
            <span className="pill mono">{s.kind}</span>
            <span className="mono text-[var(--st-on-var)]">{new Date(s.capturedAt * 1000).toLocaleString()}</span>
            <span className="ml-auto mono">{short(s.key, 6, 4)}</span>
          </Link>
        ))}
      </div>

      <div className="space-y-3 border-t border-[var(--st-line)] pt-4">
        <div className="kv"><span>Price</span><span>{d.priceDisplay} 0G per 30 days</span></div>
        {d.paidUntil && (
          <p className="flex items-center gap-2 text-sm text-[var(--st-phosphor)]"><LuBadgeCheck size={16} />Access until {day(d.paidUntil)}</p>
        )}
        {(d.paidUntil || session?.admin) && (
          <Link href={`/datasets/${d.key}`} className="btn w-full"><LuHexagon size={15} />Open hex map</Link>
        )}
        {!session ? (
          <button className="btn primary w-full" onClick={() => signIn().catch((e) => setError(errorText(e)))}>Sign in with wallet to subscribe</button>
        ) : (
          <button className="btn primary w-full" onClick={subscribe} disabled={busy || (!d.active && !d.paidUntil)}>
            {busy ? step : d.paidUntil ? `Renew for 30 days · ${d.priceDisplay} 0G` : `Subscribe · ${d.priceDisplay} 0G / 30 days`}
          </button>
        )}
        {step === "done" && <p className="text-sm text-[var(--st-phosphor)]" role="status">Subscribed. Samples in this dataset now decrypt for your wallet.</p>}
        {tx && <a className="block truncate text-xs text-[var(--st-cyan)] hover:underline" href={ogTxUrl(tx)} target="_blank" rel="noreferrer">Payment tx {short(tx)} ↗</a>}

        {d.paidUntil && (
          <details className="acc">
            <summary className="text-xs">Pull it into your warehouse</summary>
            <div className="space-y-2 px-3 pb-3 text-xs text-[var(--st-on-var)]">
              <p>Run the lab ingest job with the wallet you paid from. It verifies every sample and decrypts it locally.</p>
              <pre className="mono overflow-x-auto rounded-lg bg-[var(--st-void)] p-2 text-[10px] text-[var(--st-on)]">{`GATEWAY_URL=${typeof location === "undefined" ? "" : location.origin}
LAB_PRIVATE_KEY=0x<this wallet's key>
LAB_DATASETS=${d.key}
npm run lab:ingest`}</pre>
            </div>
          </details>
        )}

        {session?.admin && (
          <button className={`btn w-full ${d.active ? "danger" : ""}`} onClick={toggle}>{d.active ? "Unlist dataset" : "List dataset for sale"}</button>
        )}
      </div>
    </>
  );
}

function NewDataset({ onDone }: { onDone: (key?: Hex) => Promise<void> }) {
  const [f, setF] = useState({ name: "", description: "", lat: "19.0596", lon: "72.8295", radiusM: "500", kind: "", deviceType: "", from: "", to: "", price: "0.01" });
  const [busy, setBusy] = useState(false);
  const [, setError] = useToastError();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const ts = (date: string, end = false) => (date ? Math.floor(new Date(`${date}T${end ? "23:59:59" : "00:00:00"}`).getTime() / 1000) : 0);

  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError(undefined);
      const { res, body } = await postJson("/api/datasets", {
        name: f.name, description: f.description, lat: f.lat, lon: f.lon, radiusM: Number(f.radiusM), kind: f.kind,
        deviceType: f.deviceType, fromTs: ts(f.from), toTs: ts(f.to, true), price: f.price,
      });
      setBusy(false);
      if (res.ok) await onDone(body.key); else setError(body.error ?? `failed (${res.status})`);
    }}>
      <div>
        <p className="eyebrow">New dataset</p>
        <p className="mt-1 text-xs text-[var(--st-on-var)]">A saved filter over samples. Subscribers get every match, including new captures.</p>
      </div>
      <label className="block"><span className="label">Name</span><input className="field" required maxLength={128} value={f.name} onChange={set("name")} /></label>
      <label className="block"><span className="label">Description</span><textarea className="field" rows={3} maxLength={4000} value={f.description} onChange={set("description")} /></label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block"><span className="label">Latitude</span><input className="field" required inputMode="decimal" value={f.lat} onChange={set("lat")} /></label>
        <label className="block"><span className="label">Longitude</span><input className="field" required inputMode="decimal" value={f.lon} onChange={set("lon")} /></label>
        <label className="block"><span className="label">Radius (m)</span><input className="field" required type="number" min={1} max={50000} value={f.radiusM} onChange={set("radiusM")} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label">Kind</span>
          <select className="field" value={f.kind} onChange={set("kind")}>{KINDS.map((k) => <option key={k} value={k}>{k || "any"}</option>)}</select>
        </label>
        <label className="block"><span className="label">Device model</span><input className="field" placeholder="any, e.g. esp32-cam-glasses" title="The registered capture device model, not a sensor. Leave empty for any device." value={f.deviceType} onChange={set("deviceType")} /></label>
        <label className="block"><span className="label">Captured from</span><input className="field" type="date" value={f.from} onChange={set("from")} /></label>
        <label className="block"><span className="label">Captured to</span><input className="field" type="date" value={f.to} onChange={set("to")} /></label>
      </div>
      <label className="block"><span className="label">Price (0G per 30 days)</span><input className="field" required inputMode="decimal" value={f.price} onChange={set("price")} /></label>
      <div className="flex gap-2">
        <button className="btn primary flex-1" disabled={busy}>{busy ? "Writing to Arkiv…" : "Create dataset"}</button>
        <button type="button" className="btn" onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  );
}
