"use client";
import Link from "next/link";
import { useState } from "react";
import { LuBluetooth, LuCheck, LuFingerprint, LuKeyRound, LuScanEye } from "react-icons/lu";
import { hex, short } from "@/lib/data";

// shortcut: every step is a timed mock; swap in Web Bluetooth, IDKit, the iris matcher and the registry contract later.
const NEARBY = [
  { id: "glasses-3f2a9c", rssi: -48, fw: "0.4.2" },
  { id: "glasses-b71e04", rssi: -67, fw: "0.4.2" },
  { id: "glasses-09d5aa", rssi: -81, fw: "0.3.9" },
];

const STEPS = [
  { title: "Pair glasses", Icon: LuBluetooth, what: "Turn the glasses on and hold them close. They advertise over Bluetooth with their public device key." },
  { title: "Verify you're human", Icon: LuFingerprint, what: "World ID proves you are a unique person without revealing who. One human can enroll one device." },
  { title: "Bind owner", Icon: LuScanEye, what: "Look into the IR camera. The iris match runs on the glasses; only a salted hash leaves the device." },
  { title: "Register on-chain", Icon: LuKeyRound, what: "The secure element signs a challenge. The registry stores the device key and issues its ENS name." },
] as const;

export default function Enroll() {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(false);
  const [device, setDevice] = useState<(typeof NEARBY)[number]>();

  const run = (then: () => void) => {
    setBusy(true);
    setTimeout(() => { setBusy(false); then(); }, 1400);
  };
  const next = () => setStep((s) => s + 1);
  const reset = () => { setStep(0); setFound(false); setDevice(undefined); };
  const done = step === STEPS.length;
  const StepIcon = STEPS[Math.min(step, STEPS.length - 1)].Icon;
  const seed = device ? parseInt(device.id.slice(-6), 16) : 0;

  const record = [
    ["Device", device?.id],
    ["Device key", device && short(hex(seed, 66))],
    ["Firmware", device?.fw],
    ["World ID nullifier", step > 1 ? short(hex(seed + 1, 64)) : undefined],
    ["Owner binding", step > 2 ? `iris ${short(hex(seed + 2, 64), 6, 4)}` : undefined],
    ["ENS name", done ? `${device?.id}.odsy.eth` : undefined],
    ["Registry tx", done ? short(hex(seed + 3, 64)) : undefined],
  ];

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Enroll device</h1>
        <p className="muted text-sm">Link a pair of glasses to one verified human before it can upload.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="glass flex flex-col gap-6 p-6" aria-label="Enrollment steps">
          <ol className="grid gap-2 sm:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} aria-current={i === step ? "step" : undefined}
                className={`sub flex items-center gap-2 py-2 pl-2 pr-4 text-sm ${i === step ? "text-[var(--st-cyan)] ring-1 ring-[var(--st-cyan)]" : i < step ? "text-[var(--st-on)]" : "text-[var(--st-on-var)]"}`}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full ${i < step ? "bg-[var(--st-lime)] text-[#07090e]" : "bg-[var(--st-3)]"}`}>
                  {i < step ? <LuCheck size={14} /> : <span className="mono text-xs">{i + 1}</span>}
                </span>
                {s.title}
              </li>
            ))}
          </ol>

          {done ? (
            <div className="flex flex-col items-start gap-3 py-6">
              <span className="pill status" style={{ "--tone": "var(--st-phosphor)" } as React.CSSProperties}>Enrolled</span>
              <p className="text-xl font-semibold">{device?.id}.odsy.eth is ready to capture</p>
              <p className="text-sm text-[var(--st-on-var)]">Every clip it records is now signed with this device key and paid to your wallet.</p>
              <div className="flex gap-2">
                <Link href="/device" className="btn primary">Open capture device</Link>
                <button className="btn" onClick={reset}>Enroll another</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--st-3)] text-[var(--st-cyan)]">
                  <StepIcon size={20} />
                </span>
                <div>
                  <p className="text-lg font-medium">{STEPS[step].title}</p>
                  <p className="text-sm text-[var(--st-on-var)]">{STEPS[step].what}</p>
                </div>
              </div>

              {step === 0 && (
                found ? (
                  <ul className="space-y-2" aria-label="Nearby devices">
                    {NEARBY.map((d) => (
                      <li key={d.id} className="sub flex items-center gap-3 py-2 pl-4 pr-2">
                        <span className="mono text-sm">{d.id}</span>
                        <span className="text-xs text-[var(--st-on-var)]">{d.rssi} dBm · fw {d.fw}</span>
                        <button className="btn ml-auto py-1!" disabled={busy} onClick={() => { setDevice(d); run(next); }}>
                          {busy && device?.id === d.id ? "Pairing…" : "Pair"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <button className="btn primary self-start" disabled={busy} onClick={() => run(() => setFound(true))}>
                    {busy ? "Scanning…" : "Scan for glasses"}
                  </button>
                )
              )}
              {step === 1 && <button className="btn primary self-start" disabled={busy} onClick={() => run(next)}>{busy ? "Waiting for World App…" : "Verify with World ID"}</button>}
              {step === 2 && <button className="btn primary self-start" disabled={busy} onClick={() => run(next)}>{busy ? "Look into the camera…" : "Start iris scan"}</button>}
              {step === 3 && <button className="btn primary self-start" disabled={busy} onClick={() => run(next)}>{busy ? "Signing and registering…" : "Sign and register"}</button>}
            </div>
          )}
        </section>

        <aside className="glass h-fit space-y-2 p-6" aria-label="Device record">
          <p className="eyebrow">Device record</p>
          {record.map(([k, v]) => (
            <div key={k} className="kv"><span>{k}</span><span className={v ? "" : "text-[var(--st-outline)]!"}>{v ?? "pending"}</span></div>
          ))}
        </aside>
      </div>
    </main>
  );
}
