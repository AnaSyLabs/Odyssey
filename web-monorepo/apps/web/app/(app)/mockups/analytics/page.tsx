"use client";
import { useState } from "react";
import { DATASETS, hex, short } from "@/lib/data";

// Same views, figures and wording as the live /analytics page, on demo numbers in 0G.
const og = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })} 0G`;
const MONTHS = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const [A, B, C, D] = DATASETS.map((d) => d.name);

type View = {
  blurb: string; kpis: [string, string, string?][]; chart: string; bars: [string, number][];
  split: string; rows: [string, number][]; feed: string; events: [string, string, number, boolean][];
};
const VIEWS: Record<"contributor" | "lab" | "platform", View> = {
  contributor: {
    blurb: "What your payout wallet has earned from the contributor share of dataset sales, by reward epoch.",
    kpis: [["Earned, all time", og(12.85)], ["Claimed", og(10.42)], ["Claimable now", og(2.43), "claim it on Transactions"], ["Epochs paid", "8"]],
    chart: "Earnings per epoch",
    bars: [["#1", 0.62], ["#2", 0.9], ["#3", 1.21], ["#4", 1.46], ["#5", 1.8], ["#6", 2.11], ["#7", 2.32], ["#8", 2.43]],
    split: "Claimed and claimable", rows: [["Claimed", 10.42], ["Claimable", 2.43]],
    feed: "Reward epochs",
    events: [["Epoch 8", "Waiting to be claimed", 2.43, true], ["Epoch 7", "Claimed", 2.32, true], ["Epoch 6", "Claimed", 2.11, true], ["Epoch 5", "Claimed", 1.8, true]],
  },
  lab: {
    blurb: "What this wallet has paid for dataset access, and what is still active.",
    kpis: [["Spent, all time", og(24.6)], ["This month", og(5.4)], ["Active subscriptions", "3"], ["Payments", "14"]],
    chart: "Spend per month", bars: MONTHS.map((m, i) => [m, [1.8, 2.6, 3.2, 5.0, 6.6, 5.4][i]]),
    split: "Spend by dataset", rows: [[A, 10.8], [C, 6.4], [B, 5.6], [D, 1.8]],
    feed: "Payments",
    events: [["Nov 3", C, 3.2, false], ["Oct 30", A, 1.8, false], ["Oct 22", B, 1.4, false], ["Oct 15", D, 0.6, false]],
  },
  platform: {
    blurb: "Everyone's payments through the subscriptions contract (admins only). Payments from before the contract are left out.",
    kpis: [["Revenue, all time", og(318.4)], ["To contributors", og(222.88), "70 % at the default split"], ["Treasury", og(95.52)], ["Subscribers", "41"]],
    chart: "Revenue per month", bars: MONTHS.map((m, i) => [m, [22, 31, 44, 58, 79, 84.4][i]]),
    split: "Revenue by dataset", rows: [[A, 128.6], [B, 92.4], [C, 61.2], [D, 36.2]],
    feed: "All payments",
    events: [["Nov 3", `${C} · 0x4a1f…9c02`, 3.2, false], ["Nov 2", `${A} · 0x7be0…11d4`, 1.8, false], ["Oct 31", `${B} · 0x09ad…e57a`, 1.4, false], ["Oct 30", `${A} · 0x4a1f…9c02`, 1.8, false]],
  },
};

export default function Analytics() {
  const [view, setView] = useState<keyof typeof VIEWS>("contributor");
  const v = VIEWS[view];
  const max = Math.max(...v.bars.map(([, n]) => n));
  const total = v.rows.reduce((s, [, n]) => s + n, 0);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="muted text-sm">{v.blurb} Demo data.</p>
        <div className="seg ml-auto" role="group" aria-label="View as">
          <button className={view === "contributor" ? "on" : ""} aria-pressed={view === "contributor"} onClick={() => setView("contributor")}>Contributor earnings</button>
          <button className={view === "lab" ? "on" : ""} aria-pressed={view === "lab"} onClick={() => setView("lab")}>Lab spend</button>
          <button className={view === "platform" ? "on" : ""} aria-pressed={view === "platform"} onClick={() => setView("platform")}>Platform</button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals">
        {v.kpis.map(([label, value, note], i) => (
          <div key={label} className={`glass p-6 ${i === 0 ? "bg-[var(--st-lime)]! text-[#07090e]" : ""}`}>
            <p className={`eyebrow ${i === 0 ? "text-[#07090e]/70!" : ""}`}>{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
            {note && <p className={`mt-1 text-xs ${i === 0 ? "" : "text-[var(--st-on-var)]"}`}>{note}</p>}
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="glass p-6" aria-label={v.chart}>
          <p className="text-lg font-medium">{v.chart}</p>
          <div className="mt-6 flex h-56 items-end gap-2" role="img" aria-label={`${v.chart}: ${v.bars.map(([l, n]) => `${l} ${og(n)}`).join(", ")}`}>
            {v.bars.map(([label, n], i) => (
              <div key={label} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${label} · ${og(n)}`}>
                <div className={`w-full rounded-full transition-[height] duration-500 ${i === v.bars.length - 1 ? "bg-[var(--st-lime)]" : "bg-[var(--st-3)] hover:bg-[var(--st-bright)]"}`} style={{ height: `${(n / max) * 100}%` }} />
                <span className="eyebrow">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass space-y-4 p-6" aria-label={v.split}>
          <p className="text-lg font-medium">{v.split}</p>
          {v.rows.map(([name, n]) => (
            <div key={name} className="space-y-1.5">
              <div className="kv"><span>{name}</span><span>{og(n)}</span></div>
              <div className="h-2 rounded-full bg-[var(--st-3)]"><div className="h-full rounded-full bg-[var(--st-lime)]" style={{ width: `${(n / total) * 100}%` }} /></div>
            </div>
          ))}
        </section>
      </div>

      <section className="glass p-6" aria-label={v.feed}>
        <p className="mb-3 text-lg font-medium">{v.feed}</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="eyebrow text-left"><th className="pb-2 font-semibold">When</th><th className="pb-2 font-semibold">Item</th><th className="pb-2 font-semibold">Tx</th><th className="pb-2 text-right font-semibold">Amount</th></tr>
          </thead>
          <tbody>
            {v.events.map(([date, item, n, plus], i) => (
              <tr key={date + item} className="border-t border-[var(--st-line)]">
                <td className="py-2.5 text-[var(--st-on-var)]">{date}</td>
                <td className="py-2.5">{item}</td>
                <td className="mono py-2.5 text-xs text-[var(--st-on-var)]">{view === "contributor" ? "·" : short(hex(i + (view === "lab" ? 500 : 600), 64), 8, 6)}</td>
                <td className={`mono py-2.5 text-right ${plus ? "text-[var(--st-phosphor)]" : ""}`}>{plus ? "+" : "−"}{og(n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
