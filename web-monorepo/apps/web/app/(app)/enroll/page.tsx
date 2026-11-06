"use client";

import { useState } from "react";
import Link from "next/link";
import { LuArrowRight, LuCheck, LuCpu, LuFingerprint, LuLoader, LuShield, LuShieldCheck } from "react-icons/lu";
import { IDKitRequestWidget, orbLegacy, type IDKitResult, type RpContext } from "@worldcoin/idkit";
import { getAddress, isAddress } from "viem";

type WorldConfig = { app_id: `app_${string}`; action: string; environment: "staging" | "production"; rp_context: RpContext };
type Receipt = { device: string; worldId: string; txHash: string };

const MAC = /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/;

export default function EnrollPage() {
  const [device, setDevice] = useState("");
  const [mac, setMac] = useState("");
  const [config, setConfig] = useState<WorldConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const ready = isAddress(device.trim()) && MAC.test(mac.trim());

  // Each World ID request needs a fresh server-signed context.
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/enroll");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setConfig(data);
    } catch (e) {
      setError(`Could not start World ID: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // Runs inside the widget: a thrown error shows there and nothing is marked verified.
  const register = async (result: IDKitResult) => {
    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device: getAddress(device.trim()), mac: mac.trim().toUpperCase(), result }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? `HTTP ${res.status}`);
      throw new Error(data.error);
    }
    setReceipt(data);
  };

  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--st-on)]">Device Enrollment</h1>
        <p className="text-sm text-[var(--st-on-var)]">
          Bind your glasses&apos; hardware key to one verified human with World&nbsp;ID. Only enrolled glasses can upload.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <section className="glass flex flex-col gap-4 p-6" aria-label="Device identity">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-[var(--st-3)] text-[var(--st-cyan)]"><LuCpu size={18} /></span>
              <div>
                <h2 className="font-semibold text-[var(--st-on)]">Step 1: Your glasses</h2>
                <p className="text-xs text-[var(--st-on-var)]">The glasses show their address and MAC on the OLED at boot (and on the serial monitor).</p>
              </div>
            </div>
            <label className="block">
              <span className="label">Device address</span>
              <input className="field mono" placeholder="0x…" value={device} disabled={!!receipt} onChange={(e) => setDevice(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Wi-Fi MAC</span>
              <input className="field mono" placeholder="AA:BB:CC:DD:EE:FF" value={mac} disabled={!!receipt} onChange={(e) => setMac(e.target.value)} />
            </label>
          </section>

          <section className="glass flex flex-col gap-4 p-6" aria-label="World ID binding">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-[var(--st-3)] text-[var(--st-iris)]"><LuFingerprint size={18} /></span>
              <div>
                <h2 className="font-semibold text-[var(--st-on)]">Step 2: Prove you are human</h2>
                <p className="text-xs text-[var(--st-on-var)]">
                  The device address is the World ID signal, so the proof only works for these glasses. One human, one device.
                </p>
              </div>
            </div>

            {error && <p role="alert" className="rounded-xl border border-[var(--st-crimson)] p-3 text-xs text-[var(--st-crimson)]">{error}</p>}

            {receipt ? (
              <div className="sub flex flex-col gap-3 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[var(--st-phosphor)]"><LuCheck size={18} /> Glasses enrolled</p>
                <div className="kv text-xs"><span>World ID nullifier</span><span className="mono break-all">{receipt.worldId}</span></div>
                <div className="kv text-xs"><span>Arkiv tx</span><span className="mono break-all">{receipt.txHash}</span></div>
                <Link href={`/capture?device=${receipt.device}`} className="btn primary self-end">
                  View captures <LuArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <button className="btn primary py-3 text-sm" disabled={!ready || busy} onClick={start}>
                {busy ? <><LuLoader size={16} className="animate-spin" /> Preparing…</> : <><LuShield size={16} /> Verify with World ID</>}
              </button>
            )}
            {!ready && !receipt && <p className="text-xs text-[var(--st-on-var)]">Enter a valid address and MAC first.</p>}
          </section>
        </div>

        <aside className="glass flex h-fit flex-col gap-3 p-6 text-xs text-[var(--st-on-var)]" aria-label="How it works">
          <h2 className="eyebrow flex items-center gap-1.5"><LuShieldCheck size={14} /> How it works</h2>
          <p>The glasses keep a secp256k1 key in flash and sign every photo with it. The gateway rejects photos from unenrolled keys.</p>
          <p>World ID proves a unique human approved this exact address, without revealing who. A second device for the same human is refused.</p>
          <p>Your signed-in wallet becomes the device&apos;s payout address, and can view the photos it captures.</p>
          <p>Testing with a staging app? Open the request in <a className="text-[var(--st-cyan)] hover:underline" href="https://simulator.worldcoin.org" target="_blank" rel="noreferrer">simulator.worldcoin.org</a>.</p>
        </aside>
      </div>

      {config && (
        <IDKitRequestWidget
          open
          onOpenChange={(open) => !open && setConfig(null)}
          app_id={config.app_id}
          action={config.action}
          environment={config.environment}
          rp_context={config.rp_context}
          allow_legacy_proofs
          preset={orbLegacy({ signal: getAddress(device.trim()) })}
          handleVerify={register}
          onSuccess={() => setConfig(null)}
          onError={(code) => setError(`World ID error: ${code}`)}
        />
      )}
    </main>
  );
}
