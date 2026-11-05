"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useDark } from "@/lib/theme";

const Glasses3D = dynamic(() => import("@/components/lab/Glasses3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-[var(--st-on-var)]">Loading 3D model…</div>,
});

// The glasses-side half of the protocol; filtering, anchoring and validation happen after upload.
const CYCLE = [
  { state: "idle", lesson: 0, prompt: "Double-tap to capture", what: "Idle. Nothing is recorded until the wearer asks." },
  { state: "capturing", lesson: 3, prompt: "clip 10 s · gaze on", what: "Mic, camera and IMU record a 10 s clip; the IR LED lights the eye for gaze." },
  { state: "signing", lesson: 4, prompt: "sha256 · device key", what: "The clip is hashed and signed inside the secure element with the time and nearby witnesses." },
  { state: "uploading", lesson: 4, prompt: "→ gateway", what: "Clip and signature go to a gateway, which checks the signature, duplicates and quality." },
  { state: "verified", lesson: 4, prompt: "batch anchored", what: "The clip joins a batch; its Merkle root is anchored on-chain and validators sample it." },
] as const;

const PARTS = [
  ["ESP32-WROOM-32", "Records, hashes, signs and uploads"],
  ["Secure element", "Holds the device key; it never leaves the chip"],
  ["Camera + 850 nm IR LED", "First-person video and gaze"],
  ["INMP441 mic", "Audio, 16 kHz I²S"],
  ["IMU", "Head motion, synced to frames"],
  ["OLED + buzzer", "REC indicator for bystanders"],
] as const;

export default function Device() {
  const dark = useDark();
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const s = CYCLE[step];

  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setStep((i) => (i + 1) % CYCLE.length), 2600);
    return () => clearTimeout(t);
  }, [auto, step]);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Capture device</h1>
        <p className="muted text-sm">ESP32 glasses that sign every clip at the sensor.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="glass stage relative h-[560px] overflow-hidden" aria-label="3D model">
          <div className="stage-grid pointer-events-none absolute inset-0" />
          <Glasses3D lesson={s.lesson} hudState={s.state} prompt={s.prompt} dark={dark} />
        </section>

        <aside className="flex flex-col gap-4">
          <div className="glass space-y-3 p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Capture cycle</p>
              <button className="btn py-1!" onClick={() => setAuto(!auto)} aria-pressed={auto}>{auto ? "Pause" : "Play"}</button>
            </div>
            <ol className="space-y-1">
              {CYCLE.map((c, i) => (
                <li key={c.state}>
                  <button onClick={() => { setAuto(false); setStep(i); }} aria-current={i === step ? "step" : undefined}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${i === step ? "bg-[var(--st-3)] text-[var(--st-cyan)]" : "text-[var(--st-on-var)] hover:bg-[var(--st-2)]"}`}>
                    <span className="mono mr-2 text-xs">0{i + 1}</span>{c.state === "idle" ? "Ready" : c.state[0].toUpperCase() + c.state.slice(1)}
                  </button>
                </li>
              ))}
            </ol>
            <p className="text-xs text-[var(--st-on-var)]" aria-live="polite">{s.what}</p>
          </div>

          <div className="glass space-y-2 p-6">
            <p className="eyebrow">Bill of materials</p>
            {PARTS.map(([k, v]) => <div key={k} className="kv"><span>{k}</span><span>{v}</span></div>)}
          </div>
        </aside>
      </div>
    </main>
  );
}
