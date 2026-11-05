"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { IconType } from "react-icons";
import { LuArrowUpRight, LuBadgeCheck, LuClock, LuHexagon, LuOctagonX, LuSearch } from "react-icons/lu";
import { DATASETS, type Dataset, type Sample, short } from "@/lib/data";
import { setSubscribed, useSubscribed } from "@/lib/subscriptions";

const MODALITIES = ["Video", "Audio", "Gaze", "IMU", "GPS"];
const STATUS: Record<Sample["status"], [IconType, string, string]> = {
  verified: [LuBadgeCheck, "var(--st-phosphor)", "verified"],
  challenge: [LuClock, "var(--st-amber)", "in challenge window"],
  rejected: [LuOctagonX, "var(--st-crimson)", "rejected"],
};

export default function Datasets() {
  const [q, setQ] = useState("");
  const [mods, setMods] = useState<string[]>([]);
  const [open, setOpen] = useState<Dataset>();
  const [licensed, setLicensed] = useState<string>();
  const subscribed = useSubscribed(open?.id ?? "");

  const list = useMemo(
    () => DATASETS.filter((d) => (d.name + d.blurb).toLowerCase().includes(q.toLowerCase()) && mods.every((m) => d.modalities.includes(m))),
    [q, mods],
  );
  const toggle = (m: string) => setMods((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
        <p className="muted text-sm">Real-world, first-person data with a provenance proof for every sample.</p>
      </header>

      <div className="glass flex flex-wrap items-center gap-2 p-3">
        <label className="relative min-w-60 flex-1">
          <LuSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--st-on-var)]" />
          <input className="field pl-10!" placeholder="Search kitchens, streets, tools…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search datasets" />
        </label>
        <div className="seg" role="group" aria-label="Filter by modality">
          {MODALITIES.map((m) => <button key={m} className={mods.includes(m) ? "on" : ""} aria-pressed={mods.includes(m)} onClick={() => toggle(m)}>{m}</button>)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="grid content-start gap-3 md:grid-cols-2" aria-label="Datasets">
          {list.length === 0 && <p className="text-sm text-[var(--st-on-var)]">No dataset matches.</p>}
          {list.map((d) => (
            <div key={d.id} className="relative">
              <button onClick={() => setOpen(d)} aria-pressed={open?.id === d.id}
                className={`glass notch flex h-full w-full flex-col gap-3 p-6 text-left transition ${open?.id === d.id ? "ring-1 ring-[var(--st-cyan)]" : "hover:bg-[var(--st-2)]!"}`}>
                <div className="flex flex-col items-start gap-2 pr-14">
                  <span className="pill">{d.license}</span>
                  <p className="text-xl leading-snug">{d.name}</p>
                </div>
                <p className="text-xs text-[var(--st-on-var)]">{d.blurb}</p>
                <div className="flex flex-wrap gap-1">{d.modalities.map((m) => <span key={m} className="pill mono">{m}</span>)}</div>
                <div className="grid grid-cols-3 gap-2 border-t border-[var(--st-line)] pt-3 text-center">
                  <div><p className="font-semibold">{d.hours.toLocaleString()} h</p><p className="eyebrow">footage</p></div>
                  <div><p className="font-semibold">{Math.round(d.quality * 100)}</p><p className="eyebrow">quality</p></div>
                  <div><p className="font-semibold">${d.price}/h</p><p className="eyebrow">license</p></div>
                </div>
              </button>
              <span className={`notch-btn ${open?.id === d.id ? "border-transparent! bg-[var(--st-lime)] text-[#07090e]!" : ""}`} aria-hidden><LuArrowUpRight size={20} /></span>
            </div>
          ))}
        </section>

        <aside className="glass h-fit space-y-4 p-6 lg:sticky lg:top-20" aria-label="Dataset provenance">
          {!open ? (
            <p className="text-sm text-[var(--st-on-var)]">Pick a dataset to inspect its provenance: the batch root on-chain and what each sample proves.</p>
          ) : (
            <>
              <div>
                <p className="eyebrow">Provenance</p>
                <p className="mt-1 text-lg font-medium">{open.name}</p>
              </div>
              <div className="space-y-1">
                <div className="kv"><span>Samples</span><span>{open.samples.toLocaleString()}</span></div>
                <div className="kv"><span>Devices</span><span>{open.devices} (one verified human each)</span></div>
                <div className="kv"><span>Regions</span><span>{open.regions.join(" · ")}</span></div>
                <div className="kv"><span>Batch root</span><span title={open.batchRoot}>{short(open.batchRoot)}</span></div>
                <div className="kv"><span>Anchored</span><span>{open.anchoredAt}</span></div>
              </div>

              <div className="space-y-2">
                <p className="eyebrow">Sample proofs</p>
                {open.preview.map((s) => {
                  const [Icon, tone, label] = STATUS[s.status];
                  return (
                    <details key={s.id} className="acc">
                      <summary className="flex items-center gap-2">
                        <Icon size={16} className="shrink-0" style={{ color: tone }} />
                        <span className="mono text-xs">{short(s.hash, 10, 4)}</span>
                        <span className="ml-auto text-xs text-[var(--st-on-var)]">{s.place}</span>
                      </summary>
                      <div className="space-y-1 px-3 pb-3">
                        <div className="kv"><span>Status</span><span style={{ color: tone }}>{label}</span></div>
                        <div className="kv"><span>Device</span><span>{s.device}</span></div>
                        <div className="kv"><span>Captured</span><span>{s.at.slice(0, 16).replace("T", " ")} UTC</span></div>
                        <div className="kv"><span>Clip hash</span><span title={s.hash}>{short(s.hash)}</span></div>
                        <div className="kv"><span>Device signature</span><span title={s.signature}>{short(s.signature)}</span></div>
                        <div className="kv"><span>Witnesses</span><span>{s.witnesses} nearby devices</span></div>
                        <div className="kv"><span>Validator score</span><span>{s.score.toFixed(2)}</span></div>
                      </div>
                    </details>
                  );
                })}
              </div>

              <div className="space-y-2 border-t border-[var(--st-line)] pt-4">
                <div className="kv"><span>Price</span><span>${open.price} per hour · {open.license}</span></div>
                <div className="flex gap-2">
                  <button className={`btn flex-1 ${subscribed ? "" : "primary"}`} aria-pressed={subscribed} onClick={() => setSubscribed(open.id, !subscribed)}>
                    {subscribed ? "Unsubscribe" : "Subscribe to source"}
                  </button>
                  {subscribed && (
                    <Link href={`/datasets/${open.id}`} className="btn primary flex-1"><LuHexagon size={15} />Open hex map</Link>
                  )}
                </div>
                <button className="btn w-full" onClick={() => setLicensed(open.id)} disabled={licensed === open.id}>
                  {licensed === open.id ? "Request sent" : "Request license"}
                </button>
                <p className="text-xs text-[var(--st-on-var)]">Consent and license terms travel with every batch. Contributors are paid from each license.</p>
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
