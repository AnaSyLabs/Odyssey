"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LuCamera, LuCircleCheck, LuCircleX, LuFingerprint, LuLock } from "react-icons/lu";
import { isAddress } from "viem";
import { short } from "@/lib/data";

type Device = {
  device: string; worldId: string; mac: string; payout?: string;
  samples: { key: string; kind: string; capturedAt: number; contentHash: string; size: number }[];
};
type Sample = {
  key: string; mime: string; capturedAt: number; contentHash: string; signature: string; readable: boolean; data?: string;
  verified: { signature: boolean; contentHash: boolean | null };
};

const POLL_MS = 5000;

const Check = ({ ok, label }: { ok: boolean | null | undefined; label: string }) => (
  <div className="kv text-xs">
    <span>{label}</span>
    {ok == null ? <span className="text-[var(--st-outline)]!">not checked</span>
      : ok ? <span className="flex items-center gap-1 text-[var(--st-phosphor)]!"><LuCircleCheck size={13} /> valid</span>
      : <span className="flex items-center gap-1 text-[var(--st-crimson)]!"><LuCircleX size={13} /> invalid</span>}
  </div>
);

export default function CapturePage() {
  const [device, setDevice] = useState(useSearchParams().get("device") ?? "");
  const [info, setInfo] = useState<Device | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Sample | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = isAddress(device.trim());

  // New photos land on Arkiv when someone touches the glasses' trigger pin; poll for them.
  useEffect(() => {
    if (!valid) return;
    let stop = false;
    const load = async () => {
      const res = await fetch(`/api/devices?device=${device.trim()}`);
      const data = await res.json().catch(() => ({}));
      if (stop) return;
      if (!res.ok) return setError(data.error ?? `HTTP ${res.status}`), setInfo(null);
      setError(null);
      setInfo(data);
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, [device, valid]);

  const key = selected ?? info?.samples[0]?.key ?? null;
  useEffect(() => {
    if (!key) return;
    let stop = false;
    fetch(`/api/samples/${key}`).then((r) => r.json()).then((s) => !stop && setLoaded(s)).catch(() => {});
    return () => { stop = true; };
  }, [key]);
  const sample = loaded?.key === key ? loaded : null;


  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--st-on)]">Captures</h1>
          <p className="text-sm text-[var(--st-on-var)]">Touch the glasses&apos; trigger pin to take a signed photo. It appears here within a few seconds.</p>
        </div>
        <label className="block w-full max-w-md">
          <span className="label">Device address</span>
          <input className="field mono" placeholder="0x…" value={device} onChange={(e) => { setDevice(e.target.value); setSelected(null); }} />
        </label>
      </header>

      {error && (
        <p role="alert" className="glass p-4 text-sm text-[var(--st-crimson)]">
          {error}{error.includes("not registered") && <> · <Link className="underline" href="/enroll">Enroll it</Link></>}
        </p>
      )}

      {info && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="glass flex flex-col gap-3 p-3" aria-label="Latest capture">
            <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border border-[var(--st-edge)] bg-black">
              {!info.samples.length ? (
                <p className="flex items-center gap-2 text-sm text-[var(--st-on-var)]"><LuCamera size={16} /> No captures yet</p>
              ) : sample?.data ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:${sample.mime};base64,${sample.data}`} alt="Signed capture from the glasses" className="h-full w-full object-contain [image-rendering:pixelated]" />
              ) : sample && !sample.readable ? (
                <p className="flex items-center gap-2 text-sm text-[var(--st-on-var)]"><LuLock size={16} /> Encrypted. Sign in with the wallet that enrolled this device.</p>
              ) : (
                <p className="text-sm text-[var(--st-on-var)]">Loading…</p>
              )}
            </div>
            {info.samples.length > 0 && (
              <ul className="flex flex-col divide-y divide-[var(--st-line)] text-xs">
                {info.samples.map((s) => (
                  <li key={s.key}>
                    <button className={`flex w-full justify-between gap-3 px-2 py-2 text-left ${s.key === key ? "text-[var(--st-cyan)]" : ""}`} onClick={() => setSelected(s.key)}>
                      <span>{new Date(s.capturedAt * 1000).toLocaleString()}</span>
                      <span className="mono">{short(s.contentHash, 10, 6)} · {s.size} B</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="glass flex h-fit flex-col gap-4 p-6" aria-label="Provenance">
            <h2 className="eyebrow">Provenance</h2>
            <div className="sub space-y-2 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--st-on)]"><LuFingerprint size={14} className="text-[var(--st-iris)]" /> World ID (one human, one device)</p>
              <p className="mono break-all text-[11px]">{info.worldId}</p>
            </div>
            {sample && (
              <div className="sub space-y-2 p-3.5">
                <Check ok={sample.verified.signature} label="Device signature" />
                <Check ok={sample.verified.contentHash} label="Image matches signed hash" />
                <div className="kv text-xs"><span>Signature</span><span className="mono">{short(sample.signature, 10, 8)}</span></div>
              </div>
            )}
            <div className="kv text-xs"><span>MAC</span><span className="mono">{info.mac}</span></div>
            {info.payout && <div className="kv text-xs"><span>Owner</span><span className="mono">{short(info.payout)}</span></div>}
          </aside>
        </div>
      )}
    </main>
  );
}
