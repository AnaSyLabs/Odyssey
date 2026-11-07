"use client";
import { useCallback, useEffect, useState } from "react";
import { formatEther } from "viem";
import { LuShieldCheck } from "react-icons/lu";
import { Loading, RowsSkeleton } from "@/components/Skeleton";
import { useToastError } from "@/components/Toaster";
import { errorText, useWallet } from "@/components/wallet";
import { api } from "@/lib/fetch";
import { short } from "@/lib/data";

type Admin = { address: string; root: boolean; grantedBy?: string; grantedAt?: number };

// SignInGate in the app shell guarantees a session here.
export default function AdminPage() {
  const { session } = useWallet();
  if (!session) return null;
  if (!session.admin) {
    return (
      <main className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Admins</h1>
        <p className="muted text-sm" role="alert">Only admins can see this page. Sign in with an admin wallet, or ask an admin to add yours.</p>
      </main>
    );
  }
  return (
    <>
      <Admins key={session.address} me={session.address} />
      <PublishRewards />
    </>
  );
}

function Admins({ me }: { me: string }) {
  const [admins, setAdmins] = useState<Admin[]>();
  const [error, setError] = useToastError();
  const [notice, setNotice] = useState<string>();
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<string>();

  const load = useCallback(() => api("/api/admins").then((b) => setAdmins(b.admins)).catch((e) => setError(errorText(e))), [setError]);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("add");
    setError(undefined);
    setNotice(undefined);
    try {
      const b = await api("/api/admins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
      setNotice(`${short(b.address, 6, 4)} is now an admin. If they are signed in already, they should reload the page.`);
      setAddress("");
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(undefined);
    }
  };

  const remove = async (a: string) => {
    setBusy(a);
    setError(undefined);
    setNotice(undefined);
    try {
      await api(`/api/admins?address=${a}`, { method: "DELETE" });
      setNotice(`${short(a, 6, 4)} is no longer an admin.`);
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <main className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Admins</h1>
        <p className="muted text-sm">Admins create and price datasets and see every transaction. Each grant is written to Arkiv by the gateway, so the list is public and auditable.</p>
      </header>
      {notice && <p className="text-sm text-[var(--st-phosphor)]" role="status">{notice}</p>}

      <form className="glass flex flex-wrap items-end gap-3 p-4" onSubmit={add}>
        <label className="block min-w-64 flex-1">
          <span className="label">Wallet address</span>
          <input className="field mono" required placeholder="0x…" pattern="\s*0x[0-9a-fA-F]{40}\s*" title="A 0x wallet address: 0x followed by 40 hex characters"
            autoComplete="off" spellCheck={false} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <button className="btn primary" disabled={!!busy}>{busy === "add" ? "Writing to Arkiv…" : "Make admin"}</button>
      </form>

      <section className="glass overflow-hidden" aria-label="Admins">
        <p className="eyebrow border-b border-[var(--st-line)] px-4 py-3">Current admins</p>
        {!admins && !error && <Loading label="Loading admins from Arkiv" className="p-4"><RowsSkeleton rows={3} /></Loading>}
        {!!admins?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="eyebrow"><tr>{["Wallet", "Role", "Added by", "Added on", ""].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.address} className="border-t border-[var(--st-line)]">
                    <td className="px-4 py-2 mono" title={a.address}>
                      {short(a.address, 8, 6)}
                      {a.address.toLowerCase() === me.toLowerCase() && <span className="pill ml-2">you</span>}
                    </td>
                    <td className="px-4 py-2">
                      <span className="pill status inline-flex items-center gap-1" style={{ "--tone": a.root ? "var(--st-cyan)" : "var(--st-phosphor)" } as React.CSSProperties}>
                        <LuShieldCheck size={11} aria-hidden />{a.root ? "root" : "admin"}
                      </span>
                    </td>
                    <td className="px-4 py-2 mono" title={a.grantedBy}>{a.root ? "ADMIN_ADDRESSES" : short(a.grantedBy ?? "", 6, 4)}</td>
                    <td className="px-4 py-2 mono">{a.grantedAt ? new Date(a.grantedAt * 1000).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {a.root
                        ? <span className="muted" title="Root admins are set in the ADMIN_ADDRESSES environment variable">set in env</span>
                        : a.address.toLowerCase() === me.toLowerCase()
                          ? <span className="muted" title="Ask another admin to remove you">can&apos;t remove yourself</span>
                          : <button className="btn" disabled={!!busy} onClick={() => remove(a.address)}>{busy === a.address ? "Removing…" : "Remove"}</button>}
                    </td>
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

type Split = { epoch: string; fromBlock: string; throughBlock: string; earned: string; datasets: number; total: string; root: string; unpaid: string[]; leaves: { account: string; amount: string }[] };
type Done = Split & { hash: string; entityKey?: string; storeError?: string; record?: unknown };

/** Preview, then confirm: runs the same job as `npm run rewards:publish`. */
function PublishRewards() {
  const [split, setSplit] = useState<Split>();
  const [done, setDone] = useState<Done>();
  const [none, setNone] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<"preview" | "publish">();

  const post = async (body: object) => {
    setError(undefined);
    try {
      return await call("/api/rewards/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) {
      setError(errorText(e));
    }
  };
  const preview = async () => {
    setBusy("preview");
    setSplit(undefined); setDone(undefined); setNone(undefined);
    const b = await post({});
    if (b?.preview) setSplit(b.preview);
    else if (b?.none) setNone(b.none);
    setBusy(undefined);
  };
  const publish = async () => {
    if (!split) return;
    setBusy("publish");
    const b = await post({ confirm: split.root });
    if (b?.published) { setDone(b.published); setSplit(undefined); }
    setBusy(undefined);
  };

  return (
    <section className="glass mt-4 flex flex-col gap-3 p-4" aria-label="Publish rewards">
      <div>
        <p className="eyebrow">Contributor rewards</p>
        <p className="muted text-sm">Turns subscription payments since the last epoch into claimable rewards. Preview the split first; publishing signs one transaction with the contract owner wallet and cannot be undone.</p>
      </div>
      {error && <p className="text-sm text-[var(--st-crimson)]" role="alert">{error}</p>}
      {none && <p className="muted text-sm" role="status">{none}</p>}
      <div><button className="btn" disabled={!!busy} onClick={preview}>{busy === "preview" ? "Working it out…" : "Preview next epoch"}</button></div>

      {split && (
        <div className="flex flex-col gap-2 text-xs">
          <p>Epoch {split.epoch}, blocks {split.fromBlock} to {split.throughBlock}: {formatEther(BigInt(split.earned))} 0G contributor revenue across {split.datasets} dataset(s). Paying out {formatEther(BigInt(split.total))} 0G.</p>
          <table className="w-full text-left">
            <thead className="eyebrow"><tr><th className="py-1 font-semibold">Payout wallet</th><th className="py-1 font-semibold">0G</th></tr></thead>
            <tbody>{split.leaves.map((l) => <tr key={l.account} className="border-t border-[var(--st-line)]"><td className="mono py-1" title={l.account}>{short(l.account, 8, 6)}</td><td className="mono py-1">{formatEther(BigInt(l.amount))}</td></tr>)}</tbody>
          </table>
          {!!split.unpaid.length && <p className="muted">{split.unpaid.length} device(s) have no payout wallet; their share stays in the unallocated pool.</p>}
          <div><button className="btn primary" disabled={!!busy} onClick={publish}>{busy === "publish" ? "Publishing on 0G…" : `Publish epoch ${split.epoch}`}</button></div>
        </div>
      )}

      {done && (
        <div className="text-sm text-[var(--st-phosphor)]" role="status">
          <p>Published epoch {done.epoch}: <a className="underline" href={`https://chainscan-galileo.0g.ai/tx/${done.hash}`} target="_blank" rel="noreferrer">{short(done.hash, 8, 6)}</a>. Contributors can claim now.</p>
          {done.storeError && <p className="text-[var(--st-crimson)]" role="alert">The root is on-chain but saving the claim data to Arkiv failed ({done.storeError}). Claims will not work until it is stored. Save the text below as rewards/epoch-{done.epoch}.json and run <code>npm run rewards:publish -- --store rewards/epoch-{done.epoch}.json</code>.</p>}
          {done.storeError && <textarea className="field mono mt-2 h-32 w-full text-xs" readOnly value={JSON.stringify(done.record)} aria-label="Epoch record to store" />}
        </div>
      )}
    </section>
  );
}
