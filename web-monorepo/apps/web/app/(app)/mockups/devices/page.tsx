"use client";
import Link from "next/link";
import { useState } from "react";
import { LuGlasses, LuPlus } from "react-icons/lu";
import { hex, short } from "@/lib/data";

// Demo data in the shape of the live device registry on Arkiv (odsy.devices) plus the ConsensusRegistry strike count.
type Status = "active" | "1 strike" | "banned";
const TONE: Record<Status, string> = { active: "var(--st-phosphor)", "1 strike": "var(--st-amber)", banned: "var(--st-crimson)" };

const DEVICES = [
  { seed: 0x3f2a9c, mac: "24:0A:C4:3F:2A:9C", seen: "2 min ago", samples: 1284, earned: 6.12, status: "active" },
  { seed: 0xb71e04, mac: "24:0A:C4:B7:1E:04", seen: "1 h ago", samples: 902, earned: 4.02, status: "active" },
  { seed: 0x09d5aa, mac: "24:0A:C4:09:D5:AA", seen: "6 days ago", samples: 341, earned: 2.71, status: "1 strike" },
  { seed: 0x5c0e17, mac: "24:0A:C4:5C:0E:17", seen: "Jul 30", samples: 58, earned: 0, status: "banned" },
].map((d) => ({ ...d, status: d.status as Status, address: hex(d.seed, 40), worldId: hex(d.seed + 1, 64), payout: hex(d.seed + 2, 40), tx: hex(d.seed + 3, 64) }));

const FILTERS = ["all", "active", "1 strike", "banned"] as const;

export default function Devices() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [openAddr, setOpenAddr] = useState(DEVICES[0].address);

  const list = DEVICES.filter((d) => filter === "all" || d.status === filter);
  const open = DEVICES.find((d) => d.address === openAddr)!;

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">My devices</h1>
        <p className="muted text-sm">Glasses enrolled with your World ID and paid to your wallet. Banned devices can&apos;t upload. Demo data.</p>
        <Link href="/mockups/enroll" className="btn primary ml-auto"><LuPlus size={16} />Enroll device</Link>
      </header>

      <div className="seg" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "on" : ""} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)} <span className="mono ml-1 opacity-60">{f === "all" ? DEVICES.length : DEVICES.filter((d) => d.status === f).length}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="glass p-2" aria-label="Devices">
          {list.length === 0 && <p className="p-4 text-sm text-[var(--st-on-var)]">No device matches.</p>}
          <ul>
            {list.map((d) => (
              <li key={d.address}>
                <button onClick={() => setOpenAddr(d.address)} aria-pressed={d.address === openAddr}
                  className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-3xl px-4 py-3 text-left transition sm:grid-cols-[auto_minmax(0,1fr)_repeat(3,96px)] ${d.address === openAddr ? "bg-[var(--st-3)]" : "hover:bg-[var(--st-2)]"}`}>
                  <span className="grid size-11 place-items-center rounded-full border border-[var(--st-3)]"><LuGlasses size={20} /></span>
                  <span className="min-w-0">
                    <span className="mono block truncate text-sm">{short(d.address, 8, 6)}</span>
                    <span className="text-xs text-[var(--st-on-var)]">esp32-cam-glasses · seen {d.seen}</span>
                  </span>
                  <span className="hidden text-right sm:block"><span className="block font-semibold">{d.samples.toLocaleString()}</span><span className="eyebrow">samples</span></span>
                  <span className="hidden text-right sm:block"><span className="block font-semibold">{d.earned.toFixed(2)}</span><span className="eyebrow">0G earned</span></span>
                  <span className="pill status justify-self-end" style={{ "--tone": TONE[d.status] } as React.CSSProperties}>{d.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <aside className="glass h-fit space-y-4 p-6 lg:sticky lg:top-20" aria-label="Device details">
          <div>
            <p className="eyebrow">Device</p>
            <p className="mono mt-1 break-all text-sm">{open.address}</p>
          </div>
          <div className="space-y-1">
            <div className="kv"><span>Status</span><span style={{ color: TONE[open.status] }}>{open.status}</span></div>
            <div className="kv"><span>Device type</span><span>esp32-cam-glasses</span></div>
            <div className="kv"><span>Wi-Fi MAC</span><span className="mono">{open.mac}</span></div>
            <div className="kv"><span>World ID nullifier</span><span title={open.worldId}>{short(open.worldId)}</span></div>
            <div className="kv"><span>Payout wallet</span><span title={open.payout}>{short(open.payout, 6, 4)}</span></div>
            <div className="kv"><span>Registered (Arkiv tx)</span><span title={open.tx}>{short(open.tx)}</span></div>
            <div className="kv"><span>Samples</span><span>{open.samples.toLocaleString()}</span></div>
            <div className="kv"><span>Earned</span><span>{open.earned.toFixed(2)} 0G</span></div>
          </div>
          <p className="text-xs text-[var(--st-on-var)]">
            {open.status === "banned"
              ? "Two provable strikes banned this World ID: no uploads, no new device, and its data from the first strike on can't be decrypted. An admin can lift the ban."
              : open.status === "1 strike"
                ? "One strike on objective evidence (a replayed sample). A second strike bans the World ID."
                : "Every sample it uploads is signed by its key and checked against this registry."}
          </p>
        </aside>
      </div>
    </main>
  );
}
