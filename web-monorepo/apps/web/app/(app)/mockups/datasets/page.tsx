"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { IconType } from "react-icons";
import { LuArrowUpRight, LuBadgeCheck, LuClock, LuHexagon, LuOctagonX, LuSearch } from "react-icons/lu";
import { DATASETS, type Dataset, type Sample, short } from "@/lib/data";
import { setSubscribed, useSubscribed } from "@/lib/subscriptions";

// Same layout and wording as the live /datasets page, on demo data and with a pretend subscription.
const KINDS = ["image", "video", "audio", "text", "sensor"];
const STATUS: Record<Sample["status"], [IconType, string, string]> = {
  verified: [LuBadgeCheck, "var(--st-phosphor)", "passed validation"],
  challenge: [LuClock, "var(--st-amber)", "being checked"],
  rejected: [LuOctagonX, "var(--st-crimson)", "rejected"],
};

export default function Datasets() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [open, setOpen] = useState<Dataset>();
  const subscribed = useSubscribed(open?.id ?? "");

  const list = useMemo(
    () => DATASETS.filter((d) => (d.name + d.blurb).toLowerCase().includes(q.toLowerCase()) && (!kind || d.modalities.includes(kind))),
    [q, kind],
  );

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
        <p className="muted text-sm">Signed first-person data on Arkiv. Subscribe for 30 days with 0G to decrypt and download it. Demo data.</p>
      </header>

      <div className="glass flex flex-wrap items-center gap-2 p-3">
        <label className="relative min-w-60 flex-1">
          <LuSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--st-on-var)]" />
          <input className="field pl-10!" placeholder="Search datasets…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search datasets" />
        </label>
        <div className="seg" role="group" aria-label="Filter by kind">
          {KINDS.map((k) => <button key={k} className={kind === k ? "on" : ""} aria-pressed={kind === k} onClick={() => setKind(kind === k ? "" : k)}>{k}</button>)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="grid content-start gap-3 md:grid-cols-2" aria-label="Datasets">
          {list.length === 0 && <p className="text-sm text-[var(--st-on-var)]">No dataset matches.</p>}
          {list.map((d) => (
            <Card key={d.id} d={d} open={open?.id === d.id} onOpen={() => setOpen(d)} />
          ))}
        </section>

        <aside className="glass h-fit space-y-4 p-6 lg:sticky lg:top-20" aria-label="Dataset details">
          {!open ? (
            <p className="text-sm text-[var(--st-on-var)]">Pick a dataset to see what it covers, preview its samples and subscribe.</p>
          ) : (
            <>
              <div>
                <p className="eyebrow">Dataset</p>
                <p className="mt-1 text-lg font-medium">{open.name}</p>
                <p className="mt-1 text-xs text-[var(--st-on-var)]">{open.blurb}</p>
              </div>
              <div className="space-y-1">
                <div className="kv"><span>Area</span><span>{open.area}</span></div>
                <div className="kv"><span>Kind</span><span>{open.modalities.join(" · ")}</span></div>
                <div className="kv"><span>Samples now</span><span>{open.samples.toLocaleString()} (new ones included)</span></div>
                <div className="kv"><span>Devices</span><span>{open.devices} (one verified human each)</span></div>
                <div className="kv"><span>Pass rate</span><span>{Math.round(open.quality * 100)} % of checked samples</span></div>
              </div>

              <div className="space-y-2">
                <p className="eyebrow">Latest samples</p>
                {open.preview.map((s) => {
                  const [Icon, tone, label] = STATUS[s.status];
                  return (
                    <details key={s.id} className="acc">
                      <summary className="flex items-center gap-2 text-xs">
                        <Icon size={14} className="shrink-0" style={{ color: tone }} />
                        <span className="pill mono">{s.kind}</span>
                        <span className="mono text-[var(--st-on-var)]">{s.at.slice(0, 16).replace("T", " ")}</span>
                        <span className="ml-auto text-[var(--st-on-var)]">{s.place}</span>
                      </summary>
                      <div className="space-y-1 px-3 pb-3">
                        <div className="kv"><span>Validation</span><span style={{ color: tone }}>{label} · score {s.score.toFixed(2)}</span></div>
                        <div className="kv"><span>Device</span><span title={s.device}>{short(s.device, 6, 4)}</span></div>
                        <div className="kv"><span>Content hash</span><span title={s.hash}>{short(s.hash)}</span></div>
                        <div className="kv"><span>Device signature</span><span title={s.signature}>{short(s.signature)}</span></div>
                        <div className="kv"><span>Stored on</span><span>{s.storage} · encrypted</span></div>
                      </div>
                    </details>
                  );
                })}
              </div>

              <div className="space-y-3 border-t border-[var(--st-line)] pt-4">
                <div className="kv"><span>Price</span><span>{open.price} 0G per 30 days</span></div>
                {subscribed && <p className="flex items-center gap-2 text-sm text-[var(--st-phosphor)]"><LuBadgeCheck size={16} />Subscribed (demo)</p>}
                {subscribed && <Link href={`/mockups/datasets/${open.id}`} className="btn w-full"><LuHexagon size={15} />Open hex map</Link>}
                <button className={`btn w-full ${subscribed ? "" : "primary"}`} aria-pressed={subscribed} onClick={() => setSubscribed(open.id, !subscribed)}>
                  {subscribed ? "Cancel demo subscription" : `Subscribe · ${open.price} 0G / 30 days`}
                </button>
                <p className="text-xs text-[var(--st-on-var)]">On the live page this pays through the subscriptions contract; 70 % goes to the contributors.</p>
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

function Card({ d, open, onOpen }: { d: Dataset; open: boolean; onOpen: () => void }) {
  const subscribed = useSubscribed(d.id);
  return (
    <div className="relative">
      <button onClick={onOpen} aria-pressed={open}
        className={`glass notch flex h-full w-full flex-col gap-3 p-6 text-left transition ${open ? "ring-1 ring-[var(--st-cyan)]" : "hover:bg-[var(--st-2)]!"}`}>
        <div className="flex flex-col items-start gap-2 pr-14">
          {subscribed ? <span className="pill status" style={{ "--tone": "var(--st-phosphor)" } as React.CSSProperties}>subscribed</span> : <span className="pill">for sale</span>}
          <p className="text-xl leading-snug">{d.name}</p>
        </div>
        <p className="line-clamp-3 text-xs text-[var(--st-on-var)]">{d.blurb}</p>
        <div className="flex flex-wrap gap-1">{d.modalities.map((k) => <span key={k} className="pill mono">{k}</span>)}</div>
        <div className="grid grid-cols-3 gap-2 border-t border-[var(--st-line)] pt-3 text-center">
          <div><p className="font-semibold">{d.samples.toLocaleString()}</p><p className="eyebrow">samples</p></div>
          <div><p className="font-semibold">{d.price}</p><p className="eyebrow">0G / 30 days</p></div>
          <div><p className="font-semibold">{d.devices}</p><p className="eyebrow">devices</p></div>
        </div>
      </button>
      <span className={`notch-btn ${open ? "border-transparent! bg-[var(--st-lime)] text-[#07090e]!" : ""}`} aria-hidden><LuArrowUpRight size={20} /></span>
    </div>
  );
}
