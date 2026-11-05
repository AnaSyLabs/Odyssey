"use client";
import { LuExternalLink } from "react-icons/lu";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loading, RowsSkeleton } from "@/components/Skeleton";
import { errorText, useWallet } from "@/components/wallet";
import { arkivTxUrl, ogTxUrl } from "@/lib/chains";
import { short } from "@/lib/data";

type Payment = { key: string; subscriber: string; dataset: string; datasetName: string; txHash: string; amount: string; paidUntil: number; active: boolean };
type Event = { txHash: string; block: string; type: string; entityKey: string; schema?: string; label?: string };

const KIND: Record<string, string> = {
  "odsy.samples": "Sample", "odsy.devices": "Device", "odsy.datasets": "Dataset", "odsy.subscriptions": "Subscription",
};
const ACTION: Record<string, string> = { EntityCreated: "created", EntityPatched: "updated", ExpiryExtended: "extended" };

function TxLink({ href, hash }: { href: string; hash: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="mono inline-flex items-center gap-1 text-[var(--st-cyan)] hover:underline">
      {short(hash, 8, 6)}<LuExternalLink size={11} aria-label="opens explorer" />
    </a>
  );
}

// SignInGate in the app shell guarantees a session here.
export default function Activity() {
  const { session } = useWallet();
  return session && <Ledger key={session.address} admin={session.admin} />;
}

function Ledger({ admin }: { admin: boolean }) {
  const [payments, setPayments] = useState<Payment[]>();
  const [events, setEvents] = useState<Event[]>();
  const [latest, setLatest] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const get = async (url: string) => {
      const r = await fetch(url);
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error ?? `${url} failed (${r.status})`);
      return b;
    };
    get("/api/subscriptions").then((b) => setPayments(b.subscriptions)).catch((e) => setError(errorText(e)));
    get("/api/activity").then((b) => { setEvents(b.events); setLatest(b.latestBlock); }).catch((e) => setError(errorText(e)));
  }, []);

  return (
    <main className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="muted text-sm">
          {admin ? "Every recent write by the gateway on Arkiv, and every subscription payment on 0G." : "Your subscription payments on 0G and the Arkiv records that grant access."}
        </p>
      </header>
      {error && <p className="text-sm text-[var(--st-crimson)]" role="alert">{error}</p>}

      <section className="glass overflow-hidden" aria-label="Payments">
        <p className="eyebrow border-b border-[var(--st-line)] px-4 py-3">Subscription payments · 0G Galileo</p>
        {!payments && !error && <Loading label="Loading payments" className="p-4"><RowsSkeleton rows={2} /></Loading>}
        {payments?.length === 0 && <p className="p-4 text-sm text-[var(--st-on-var)]">No payments yet. <Link href="/datasets" className="text-[var(--st-cyan)] hover:underline">Browse datasets</Link></p>}
        {!!payments?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="eyebrow"><tr>{["Dataset", ...(admin ? ["Subscriber"] : []), "Amount", "Paid until", "Payment tx"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.key} className="border-t border-[var(--st-line)]">
                    <td className="px-4 py-2">{p.datasetName}</td>
                    {admin && <td className="px-4 py-2 mono" title={p.subscriber}>{short(p.subscriber, 6, 4)}</td>}
                    <td className="px-4 py-2 mono">{p.amount} 0G</td>
                    <td className="px-4 py-2 mono" style={{ color: p.active ? "var(--st-phosphor)" : undefined }}>{new Date(p.paidUntil * 1000).toLocaleDateString()}</td>
                    <td className="px-4 py-2"><TxLink href={ogTxUrl(p.txHash)} hash={p.txHash} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass overflow-hidden" aria-label="Arkiv transactions">
        <p className="eyebrow border-b border-[var(--st-line)] px-4 py-3">Arkiv writes · Rabdi testnet{latest && ` · latest block ${latest}`}</p>
        {!events && !error && <Loading label="Reading Arkiv logs" className="p-4"><RowsSkeleton rows={5} /></Loading>}
        {events?.length === 0 && <p className="p-4 text-sm text-[var(--st-on-var)]">No writes in the last ~7 days.</p>}
        {!!events?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="eyebrow"><tr>{["Block", "What", "Entity", "Transaction"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={`${e.txHash}-${e.entityKey}-${e.type}`} className="border-t border-[var(--st-line)]">
                    <td className="px-4 py-2 mono">{e.block}</td>
                    <td className="px-4 py-2">
                      {KIND[e.schema ?? ""] ?? "Expired entity"} {ACTION[e.type] ?? e.type}
                      {e.label && <span className="pill mono ml-2" title={e.label}>{e.label.length > 18 ? `${e.label.slice(0, 16)}…` : e.label}</span>}
                    </td>
                    <td className="px-4 py-2 mono">
                      {e.schema === "odsy.samples" ? <Link href={`/explore?sample=${e.entityKey}`} className="text-[var(--st-cyan)] hover:underline">{short(e.entityKey, 8, 4)}</Link> : short(e.entityKey, 8, 4)}
                    </td>
                    <td className="px-4 py-2"><TxLink href={arkivTxUrl(e.txHash)} hash={e.txHash} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
