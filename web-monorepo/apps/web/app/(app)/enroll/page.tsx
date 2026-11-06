"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LuArrowRight, LuCheck, LuCpu, LuFingerprint, LuLoader, LuShield, LuShieldCheck } from "react-icons/lu";
import { IDKitRequestWidget, orbLegacy, type IDKitResult, type RpContext } from "@worldcoin/idkit";
import { getAddress, isAddress } from "viem";
import { useToastError } from "@/components/Toaster";

type WorldConfig = { app_id: `app_${string}`; action: string; environment: "staging" | "production"; rp_context: RpContext };
type Receipt = { device: string; worldId: string; txHash: string };

const MAC = /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/;
const ORB_NEEDED = "Enrolling a device needs Orb verification. Verify at a World Orb (world.org/find-orb), then try again with the Human credential.";
const ONE_DEVICE = "Your World ID has already enrolled a device. Each human can enroll one device.";
const WORLD_ERRORS: Record<string, string> = {
  user_rejected: "You declined the request in World App. Click Verify with World ID to try again.",
  cancelled: "Verification was cancelled. Click Verify with World ID to try again.",
  credential_unavailable: ORB_NEEDED,
  max_verifications_reached: ONE_DEVICE,
  nullifier_replayed: ONE_DEVICE,
  connection_failed: "Couldn't reach World App. Check your connection and try again.",
  timeout: "World App didn't answer in time. Try again.",
};

export default function EnrollPage() {
  // A laptop node prints /enroll?device=..&mac=..&type=laptop; prefill from it.
  const q = useSearchParams();
  const [device, setDevice] = useState(q.get("device") ?? "");
  const [mac, setMac] = useState(q.get("mac") ?? "");
  const [config, setConfig] = useState<WorldConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useToastError();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [deviceType, setDeviceType] = useState(q.get("type") === "laptop" ? "laptop" : "esp32-cam-glasses");

  const ready = isAddress(device.trim()) && MAC.test(mac.trim());

  // Each World ID request needs a fresh server-signed context.
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      // Check before World ID: a proof spent on an enrolled device can't be reused.
      if ((await fetch(`/api/devices?device=${getAddress(device.trim())}`)).ok)
        return setError("This device is already enrolled. Open Captures to see its uploads.");
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
      body: JSON.stringify({ device: getAddress(device.trim()), mac: mac.trim().toUpperCase(), deviceType, result }),
    });
    const data = await res.json();
    if (!res.ok) {
      setConfig(null); // close the widget so its generic "declined" screen doesn't hide the real reason
      setError(data.error ?? `Enrollment failed (HTTP ${res.status}). Try again.`);
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
              <span className="label">Device type</span>
              <select className="field" value={deviceType} disabled={!!receipt} onChange={(e) => setDeviceType(e.target.value)}>
                <option value="esp32-cam-glasses">Odsy glasses (ESP32)</option>
                <option value="laptop">Laptop / Pi node</option>
              </select>
            </label>
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
            {error && !receipt && <p role="alert" className="text-sm text-[var(--st-amber)]">{error}</p>}
          </section>
        </div>

        <aside className="glass flex h-fit flex-col gap-3 p-6 text-xs text-[var(--st-on-var)]" aria-label="How it works">
          <h2 className="eyebrow flex items-center gap-1.5"><LuShieldCheck size={14} /> How it works</h2>
          <p>The glasses keep a secp256k1 key in flash and sign every photo with it. The gateway rejects photos from unenrolled keys.</p>
          <p>World ID proves a unique human approved this exact address, without revealing who. A second device for the same human is refused.</p>
          <p>Your signed-in wallet becomes the device&apos;s payout address, and can view the photos it captures.</p>
          <p>Testing with a staging app? Open the request in <a className="text-[var(--st-cyan)] underline" href="https://simulator.worldcoin.org" target="_blank" rel="noreferrer">simulator.worldcoin.org</a>.</p>
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
          // failed_by_host_app means register() threw and already showed the gateway's reason.
          onError={(code) => void (code !== "failed_by_host_app" && setError(WORLD_ERRORS[code] ?? `World ID error (${code}). Start the verification again.`))}
        />
      )}
    </main>
  );
}
