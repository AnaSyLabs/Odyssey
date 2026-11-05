"use client";
import Link from "next/link";
import { useState } from "react";
import { LuGlasses, LuPlus } from "react-icons/lu";
import { hex, short } from "@/lib/data";

// shortcut: static mock devices and in-memory revoke; read from the device registry contract once it exists.
type Status = "active" | "offline" | "revoked";
const TONE: Record<Status, string> = { active: "var(--st-phosphor)", offline: "var(--st-outline)", revoked: "var(--st-crimson)" };

const DEVICES = [
  { id: "glasses-3f2a9c", fw: "0.4.2", seen: "2 min ago", clips: 1284, quality: 0.93, earned: 612.3, enrolled: "2026-08-14", status: "active" },
  { id: "glasses-b71e04", fw: "0.4.2", seen: "1 h ago", clips: 902, quality: 0.9, earned: 401.8, enrolled: "2026-09-02", status: "active" },
  { id: "glasses-09d5aa", fw: "0.3.9", seen: "6 days ago", clips: 341, quality: 0.86, earned: 270.5, enrolled: "2026-09-27", status: "offline" },
  { id: "glasses-5c0e17", fw: "0.3.7", seen: "Jul 30", clips: 58, quality: 0.71, earned: 0, enrolled: "2026-06-11", status: "revoked" },
].map((d) => ({ ...d, status: d.status as Status, seed: parseInt(d.id.slice(-6), 16) }));

const FILTERS = ["all", "active", "offline", "revoked"] as const;

export default function Devices() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [revoked, setRevoked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [openId, setOpenId] = useState(DEVICES[0].id);

  const devices = DEVICES.map((d) => (revoked.includes(d.id) ? { ...d, status: "revoked" as Status } : d));
  const list = devices.filter((d) => filter === "all" || d.status === filter);
  const open = devices.find((d) => d.id === openId)!;
  const pick = (id: string) => { setOpenId(id); setConfirm(false); };

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">My devices</h1>
        <p className="muted text-sm">Glasses enrolled to your verified identity. Only active devices can upload.</p>
        <Link href="/enroll" className="btn primary ml-auto"><LuPlus size={16} />Enroll device</Link>
      </header>

      <div className="seg" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "on" : ""} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)} <span className="mono ml-1 opacity-60">{f === "all" ? devices.length : devices.filter((d) => d.status === f).length}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="glass p-2" aria-label="Devices">
          {list.length === 0 && <p className="p-4 text-sm text-[var(--st-on-var)]">No device matches.</p>}
          <ul>
            {list.map((d) => (
              <li key={d.id}>
                <button onClick={() => pick(d.id)} aria-pressed={d.id === openId}
                  className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-3xl px-4 py-3 text-left transition sm:grid-cols-[auto_minmax(0,1fr)_repeat(3,96px)] ${d.id === openId ? "bg-[var(--st-3)]" : "hover:bg-[var(--st-2)]"}`}>
                  <span className="grid size-11 place-items-center rounded-full border border-[var(--st-3)]"><LuGlasses size={20} /></span>
                  <span className="min-w-0">
                    <span className="mono block truncate text-sm">{d.id}.odsy.eth</span>
                    <span className="text-xs text-[var(--st-on-var)]">fw {d.fw} · seen {d.seen}</span>
                  </span>
                  <span className="hidden text-right sm:block"><span className="block font-semibold">{d.clips.toLocaleString()}</span><span className="eyebrow">clips</span></span>
                  <span className="hidden text-right sm:block"><span className="block font-semibold">{d.quality.toFixed(2)}</span><span className="eyebrow">quality</span></span>
                  <span className="pill status justify-self-end" style={{ "--tone": TONE[d.status] } as React.CSSProperties}>{d.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <aside className="glass h-fit space-y-4 p-6 lg:sticky lg:top-20" aria-label="Device details">
          <div>
            <p className="eyebrow">Device</p>
            <p className="mono mt-1 text-lg">{open.id}.odsy.eth</p>
          </div>
          <div className="space-y-1">
            <div className="kv"><span>Status</span><span style={{ color: TONE[open.status] }}>{open.status}</span></div>
            <div className="kv"><span>Device key</span><span>{short(hex(open.seed, 66))}</span></div>
            <div className="kv"><span>Owner binding</span><span>iris {short(hex(open.seed + 2, 64), 6, 4)}</span></div>
            <div className="kv"><span>World ID nullifier</span><span>{short(hex(open.seed + 1, 64))}</span></div>
            <div className="kv"><span>Registry tx</span><span>{short(hex(open.seed + 3, 64))}</span></div>
            <div className="kv"><span>Enrolled</span><span>{open.enrolled}</span></div>
            <div className="kv"><span>Firmware</span><span>{open.fw}</span></div>
            <div className="kv"><span>Earned</span><span>${open.earned.toFixed(2)}</span></div>
          </div>
          {open.status === "revoked" ? (
            <p className="text-xs text-[var(--st-on-var)]">This key is revoked on-chain. New clips from it are rejected; already-licensed clips keep their proofs.</p>
          ) : confirm ? (
            <div className="space-y-2">
              <p className="text-xs text-[var(--st-on-var)]">Revoking is permanent. The glasses must be enrolled again to upload.</p>
              <div className="flex gap-2">
                <button className="btn danger flex-1" onClick={() => { setRevoked((r) => [...r, open.id]); setConfirm(false); }}>Yes, revoke</button>
                <button className="btn flex-1" onClick={() => setConfirm(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn danger w-full" onClick={() => setConfirm(true)}>Revoke device</button>
          )}
        </aside>
      </div>
    </main>
  );
}
