"use client";
import { useState } from "react";
import { DATASETS, hex, short } from "@/lib/data";

// shortcut: static mock figures; read from the rewards and license contracts once they exist.
const MONTHS = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const VIEWS = {
  contributor: {
    blurb: "What your glasses earned from every license sold on your clips.",
    kpis: [["Earned, all time", usd(1284.6)], ["This month", usd(212.4), "+18% vs Oct"], ["Clips accepted", "3,912", "97% pass rate"], ["Avg quality score", "0.91"]],
    chart: "Earnings per month",
    monthly: [42, 55, 61, 48, 73, 88, 95, 102, 121, 146, 180, 212.4],
    split: "Earnings by dataset",
    rows: [[DATASETS[0].name, 612.3], [DATASETS[1].name, 401.8], [DATASETS[3].name, 270.5]] as [string, number][],
    feed: "Recent payouts",
    events: [["Nov 04", "Epoch 46 rewards claimed", 61.2], ["Oct 28", "Epoch 45 rewards claimed", 54.9], ["Oct 21", "Epoch 44 rewards claimed", 48.3], ["Oct 14", "Epoch 43 rewards claimed", 47.1]] as [string, string, number][],
  },
  company: {
    blurb: "What your team spent licensing verified data, and where it went.",
    kpis: [["Spent, all time", usd(184_320)], ["This month", usd(22_860), "+9% vs Oct"], ["Hours licensed", "9,840"], ["Avg cost per hour", usd(18.73)]],
    chart: "Spend per month",
    monthly: [6200, 8100, 9400, 11800, 12500, 14200, 15900, 16400, 18100, 19800, 20960, 22860],
    split: "Spend by dataset",
    rows: [[DATASETS[0].name, 89_280], [DATASETS[2].name, 49_920], [DATASETS[1].name, 33_600], [DATASETS[3].name, 11_520]] as [string, number][],
    feed: "Recent invoices",
    events: [["Nov 03", `License · ${DATASETS[2].name}`, 9920], ["Oct 30", `License · ${DATASETS[0].name}`, 7200], ["Oct 22", `License · ${DATASETS[1].name}`, 4200], ["Oct 15", `License · ${DATASETS[3].name}`, 1540]] as [string, string, number][],
  },
};

export default function Analytics() {
  const [view, setView] = useState<keyof typeof VIEWS>("contributor");
  const v = VIEWS[view];
  const max = Math.max(...v.monthly);
  const total = v.rows.reduce((s, [, n]) => s + n, 0);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="muted text-sm">{v.blurb}</p>
        <div className="seg ml-auto" role="group" aria-label="View as">
          <button className={view === "contributor" ? "on" : ""} aria-pressed={view === "contributor"} onClick={() => setView("contributor")}>Contributor earnings</button>
          <button className={view === "company" ? "on" : ""} aria-pressed={view === "company"} onClick={() => setView("company")}>Company spend</button>
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
          <div className="flex items-center justify-between">
            <p className="text-lg font-medium">{v.chart}</p>
            <span className="pill">Last 12 months</span>
          </div>
          <div className="mt-6 flex h-56 items-end gap-2" role="img" aria-label={`${v.chart}: ${MONTHS.map((m, i) => `${m} ${usd(v.monthly[i])}`).join(", ")}`}>
            {v.monthly.map((n, i) => (
              <div key={MONTHS[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${MONTHS[i]} · ${usd(n)}`}>
                <div className={`w-full rounded-full transition-[height] duration-500 ${i === v.monthly.length - 1 ? "bg-[var(--st-lime)]" : "bg-[var(--st-3)] hover:bg-[var(--st-bright)]"}`} style={{ height: `${(n / max) * 100}%` }} />
                <span className="eyebrow">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass space-y-4 p-6" aria-label={v.split}>
          <p className="text-lg font-medium">{v.split}</p>
          {v.rows.map(([name, n]) => (
            <div key={name} className="space-y-1.5">
              <div className="kv"><span>{name}</span><span>{usd(n)}</span></div>
              <div className="h-2 rounded-full bg-[var(--st-3)]"><div className="h-full rounded-full bg-[var(--st-lime)]" style={{ width: `${(n / total) * 100}%` }} /></div>
            </div>
          ))}
        </section>
      </div>

      <section className="glass p-6" aria-label={v.feed}>
        <p className="mb-3 text-lg font-medium">{v.feed}</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="eyebrow text-left"><th className="pb-2 font-semibold">Date</th><th className="pb-2 font-semibold">Item</th><th className="pb-2 font-semibold">Tx</th><th className="pb-2 text-right font-semibold">Amount</th></tr>
          </thead>
          <tbody>
            {v.events.map(([date, item, n], i) => (
              <tr key={item + date} className="border-t border-[var(--st-line)]">
                <td className="py-2.5 text-[var(--st-on-var)]">{date}</td>
                <td className="py-2.5">{item}</td>
                <td className="mono py-2.5 text-xs text-[var(--st-on-var)]">{short(hex(i + (view === "company" ? 500 : 400), 64))}</td>
                <td className={`mono py-2.5 text-right ${view === "contributor" ? "text-[var(--st-phosphor)]" : ""}`}>{view === "contributor" ? "+" : "−"}{usd(n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
