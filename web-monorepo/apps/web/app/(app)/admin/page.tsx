"use client";
import { useCallback, useEffect, useState } from "react";
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
  return <Admins key={session.address} me={session.address} />;
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
