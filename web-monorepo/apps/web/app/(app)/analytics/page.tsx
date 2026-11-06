"use client";
import { LuExternalLink } from "react-icons/lu";
import { useEffect, useState } from "react";
import { Loading, RowsSkeleton } from "@/components/Skeleton";
import { errorText, useWallet } from "@/components/wallet";
import { byDataset, fmt, monthly, type Payment, sum } from "@/lib/analytics";
import { ogTxUrl } from "@/lib/chains";
import { short } from "@/lib/data";

type Sub = Payment & { key: string; dataset: string; txHash: string; paidUntil: number; active: boolean };
type Reward = { epoch: string; amount: string; amountDisplay: string; claimed: boolean };
type View = "contributor" | "lab" | "platform";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(b.error ?? `${url} failed (${res.status})`);
  return b;
}
const day = (ts?: number) => (ts ? new Date(ts * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "before the contract");

// SignInGate in the app shell guarantees a session here.
export default function Analytics() {
  const { session } = useWallet();
  return session && <Board key={session.address} address={session.address} admin={session.admin} />;
}

function Board({ address, admin }: { address: string; admin: boolean }) {
  const [view, setView] = useState<View>("contributor");
  const [subs, setSubs] = useState<Sub[]>();
  const [rewards, setRewards] = useState<Reward[]>();
  const [error, setError] = useState("");

  useEffect(() => {
    get<{ subscriptions: Sub[] }>("/api/subscriptions").then((b) => setSubs(b.subscriptions)).catch((e) => setError(errorText(e)));
    get<{ rewards: Reward[] }>("/api/rewards").then((b) => setRewards(b.rewards)).catch((e) => setError(errorText(e)));
  }, []);

  const loading = !subs || !rewards;
  const mine = (subs ?? []).filter((s) => s.subscriber.toLowerCase() === address.toLowerCase());
  const onChain = (subs ?? []).filter((s) => !s.legacy);
  const ordered = [...(rewards ?? [])].reverse(); // oldest epoch first

  // One shape for the three views: figures, a bar chart, a split and a feed.
  let kpis: [string, string, string?][] = [];
  let chart: { label: string; n: bigint }[] = [];
  let chartTitle = "";
  let split: [string, bigint][] = [];
  let splitTitle = "";
  let feed: { date: string; item: string; tx?: string; amount: string; plus: boolean }[] = [];
  let feedTitle = "";
  let blurb = "";

  if (!loading && view === "contributor") {
    const earned = sum(rewards.map((r) => r.amountDisplay));
    const claimed = sum(rewards.filter((r) => r.claimed).map((r) => r.amountDisplay));
    blurb = "What your payout wallet has earned from the contributor share of dataset sales, by reward epoch.";
    kpis = [["Earned, all time", fmt(earned)], ["Claimed", fmt(claimed)], ["Claimable now", fmt(earned - claimed), "claim it on Transactions"], ["Epochs paid", String(rewards.length)]];
    chartTitle = "Earnings per epoch";
    chart = ordered.slice(-12).map((r) => ({ label: `#${r.epoch}`, n: sum([r.amountDisplay]) }));
    splitTitle = "Claimed and claimable";
    split = [["Claimed", claimed], ["Claimable", earned - claimed]];
    feedTitle = "Reward epochs";
    feed = rewards.map((r) => ({ date: `Epoch ${r.epoch}`, item: r.claimed ? "Claimed" : "Waiting to be claimed", amount: fmt(sum([r.amountDisplay])), plus: true }));
  } else if (!loading && view === "lab") {
    const rows = mine;
    const thisMonth = monthly(rows, (r) => r.amount, 1)[0].total;
    blurb = "What this wallet has paid for dataset access, and what is still active.";
    kpis = [["Spent, all time", fmt(sum(rows.map((r) => r.amount)))], ["This month", fmt(thisMonth)], ["Active subscriptions", String(new Set(rows.filter((r) => r.active).map((r) => r.dataset)).size)], ["Payments", String(rows.length)]];
    chartTitle = "Spend per month";
    chart = monthly(rows, (r) => r.amount, 6).map((m) => ({ label: m.label, n: m.total }));
    splitTitle = "Spend by dataset";
    split = byDataset(rows);
    feedTitle = "Payments";
    feed = rows.map((r) => ({ date: day(r.paidAt), item: r.datasetName ?? "(expired dataset)", tx: r.legacy ? undefined : r.txHash, amount: fmt(sum([r.amount])), plus: false }));
  } else if (!loading) {
    const rows = onChain;
    const revenue = sum(rows.map((r) => r.amount));
    const toContributors = sum(rows.map((r) => r.toContributors));
    blurb = "Everyone's payments through the subscriptions contract (admins only). Payments from before the contract are left out.";
    kpis = [["Revenue, all time", fmt(revenue)], ["To contributors", fmt(toContributors), "70 % at the default split"], ["Treasury", fmt(revenue - toContributors)], ["Subscribers", String(new Set(rows.map((r) => r.subscriber.toLowerCase())).size)]];
    chartTitle = "Revenue per month";
    chart = monthly(rows, (r) => r.amount, 6).map((m) => ({ label: m.label, n: m.total }));
    splitTitle = "Revenue by dataset";
    split = byDataset(rows);
    feedTitle = "All payments";
    feed = rows.map((r) => ({ date: day(r.paidAt), item: `${r.datasetName ?? "(expired dataset)"} · ${short(r.subscriber, 6, 4)}`, tx: r.txHash, amount: fmt(sum([r.amount])), plus: true }));
  }
  const max = chart.reduce((m, c) => (c.n > m ? c.n : m), 0n) || 1n;
  const splitTotal = split.reduce((s, [, n]) => s + n, 0n) || 1n;
  const bar = (n: bigint, of: bigint) => `${Number((n * 10_000n) / of) / 100}%`;

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="muted text-sm">{blurb || "Live figures from the subscriptions contract and Arkiv."}</p>
        <div className="seg ml-auto" role="group" aria-label="View as">
          <button className={view === "contributor" ? "on" : ""} aria-pressed={view === "contributor"} onClick={() => setView("contributor")}>Contributor earnings</button>
          <button className={view === "lab" ? "on" : ""} aria-pressed={view === "lab"} onClick={() => setView("lab")}>Lab spend</button>
          {admin && <button className={view === "platform" ? "on" : ""} aria-pressed={view === "platform"} onClick={() => setView("platform")}>Platform</button>}
        </div>
      </header>

      {error && <p className="text-sm text-[var(--st-red,#f87171)]">{error}</p>}
      {loading && !error && <Loading label="Reading the contract" className="p-4"><RowsSkeleton rows={5} /></Loading>}

      {!loading && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals">
            {kpis.map(([label, value, note], i) => (
              <div key={label} className={`glass p-6 ${i === 0 ? "bg-[var(--st-lime)]! text-[#07090e]" : ""}`}>
                <p className={`eyebrow ${i === 0 ? "text-[#07090e]/70!" : ""}`}>{label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
                {note && <p className={`mt-1 text-xs ${i === 0 ? "" : "text-[var(--st-on-var)]"}`}>{note}</p>}
              </div>
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="glass p-6" aria-label={chartTitle}>
              <p className="text-lg font-medium">{chartTitle}</p>
              {chart.length === 0 ? (
                <p className="mt-6 text-sm text-[var(--st-on-var)]">Nothing to chart yet.</p>
              ) : (
                <div className="mt-6 flex h-56 items-end gap-2" role="img" aria-label={`${chartTitle}: ${chart.map((c) => `${c.label} ${fmt(c.n)}`).join(", ")}`}>
                  {chart.map((c, i) => (
                    <div key={c.label + i} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${c.label} · ${fmt(c.n)}`}>
                      <div className={`w-full rounded-full transition-[height] duration-500 ${i === chart.length - 1 ? "bg-[var(--st-lime)]" : "bg-[var(--st-3)] hover:bg-[var(--st-bright)]"}`} style={{ height: c.n ? bar(c.n, max) : "2px" }} />
                      <span className="eyebrow">{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="glass space-y-4 p-6" aria-label={splitTitle}>
              <p className="text-lg font-medium">{splitTitle}</p>
              {split.length === 0 && <p className="text-sm text-[var(--st-on-var)]">Nothing yet.</p>}
              {split.map(([name, n]) => (
                <div key={name} className="space-y-1.5">
                  <div className="kv"><span>{name}</span><span>{fmt(n)}</span></div>
                  <div className="h-2 rounded-full bg-[var(--st-3)]"><div className="h-full rounded-full bg-[var(--st-lime)]" style={{ width: bar(n, splitTotal) }} /></div>
                </div>
              ))}
            </section>
          </div>

          <section className="glass p-6" aria-label={feedTitle}>
            <p className="mb-3 text-lg font-medium">{feedTitle}</p>
            {feed.length === 0 ? (
              <p className="text-sm text-[var(--st-on-var)]">
                {view === "contributor" ? "No rewards for this wallet yet. Your share shows up after the next reward epoch, once a dataset with your device's samples sells." : "No payments yet."}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="eyebrow text-left"><th className="pb-2 font-semibold">When</th><th className="pb-2 font-semibold">Item</th><th className="pb-2 font-semibold">Tx</th><th className="pb-2 text-right font-semibold">Amount</th></tr>
                </thead>
                <tbody>
                  {feed.map((f, i) => (
                    <tr key={i} className="border-t border-[var(--st-line)]">
                      <td className="py-2.5 text-[var(--st-on-var)]">{f.date}</td>
                      <td className="py-2.5">{f.item}</td>
                      <td className="mono py-2.5 text-xs">
                        {f.tx ? <a href={ogTxUrl(f.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--st-cyan)] hover:underline">{short(f.tx, 8, 6)}<LuExternalLink size={11} aria-label="opens explorer" /></a> : "·"}
                      </td>
                      <td className={`mono py-2.5 text-right ${f.plus ? "text-[var(--st-phosphor)]" : ""}`}>{f.plus ? "+" : "−"}{f.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}
