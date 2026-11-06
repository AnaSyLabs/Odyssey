"use client";
import Link from "next/link";
import { useState } from "react";
import { LuArrowRight, LuCheck, LuCpu, LuFingerprint, LuLoader, LuShield, LuShieldCheck } from "react-icons/lu";
import { hex } from "@/lib/data";

// Same two steps and wording as the live /enroll page; World ID and the Arkiv write are simulated.
const DEMO = { device: "0x3F2a9C61b7E04d5A0c9D5aA17e3B2f8C6d1E4a90", mac: "24:0A:C4:3F:2A:9C" };
const MAC = /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export default function Enroll() {
  const [device, setDevice] = useState(DEMO.device);
  const [mac, setMac] = useState(DEMO.mac);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ worldId: string; txHash: string } | null>(null);
  const ready = ADDRESS.test(device.trim()) && MAC.test(mac.trim());

  const verify = () => {
    setBusy(true);
    setTimeout(() => { setBusy(false); setReceipt({ worldId: hex(41, 64), txHash: hex(42, 64) }); }, 1400);
  };

  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--st-on)]">Device Enrollment</h1>
        <p className="text-sm text-[var(--st-on-var)]">
          Bind your glasses&apos; hardware key to one verified human with World&nbsp;ID. Only enrolled glasses can upload. Demo: nothing is sent.
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
            {receipt ? (
              <div className="sub flex flex-col gap-3 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[var(--st-phosphor)]"><LuCheck size={18} /> Glasses enrolled (demo)</p>
                <div className="kv text-xs"><span>World ID nullifier</span><span className="mono break-all">{receipt.worldId}</span></div>
                <div className="kv text-xs"><span>Arkiv tx</span><span className="mono break-all">{receipt.txHash}</span></div>
                <div className="flex gap-2 self-end">
                  <button className="btn" onClick={() => setReceipt(null)}>Start over</button>
                  <Link href="/mockups/devices" className="btn primary">See my devices <LuArrowRight size={14} /></Link>
                </div>
              </div>
            ) : (
              <button className="btn primary py-3 text-sm" disabled={!ready || busy} onClick={verify}>
                {busy ? <><LuLoader size={16} className="animate-spin" /> Waiting for World App…</> : <><LuShield size={16} /> Verify with World ID</>}
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
          <p>The real flow is on <Link className="text-[var(--st-cyan)] underline" href="/enroll">Enroll device</Link>.</p>
        </aside>
      </div>
    </main>
  );
}
