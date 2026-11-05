"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { LuArrowRight, LuBanknote, LuBot, LuCloudUpload, LuCpu, LuDatabase, LuFilter, LuGlasses, LuLink, LuMoon, LuScale, LuShieldCheck, LuSun, LuUserCheck } from "react-icons/lu";
import Logo from "@/components/Logo";
import { STATS } from "@/lib/data";
import { setDark, useDark } from "@/lib/theme";

const Glasses3D = dynamic(() => import("@/components/lab/Glasses3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-[var(--st-on-var)]">Loading 3D model…</div>,
});

const FIGURES = [
  [STATS.hours.toLocaleString(), "h", "Verified first-person data"],
  [STATS.devices.toLocaleString(), "", "Capture devices"],
  [String(Math.round(STATS.verifiedShare * 100)), "%", "Samples pass validation"],
  ["1", "tx", "Per batch, any size"],
];

const PIPELINE = [
  [LuGlasses, "Capture", "device"],
  [LuCpu, "Sign", "secure chip"],
  [LuFilter, "Filter", "TEE gateway"],
  [LuDatabase, "Store", "encrypted"],
  [LuLink, "Anchor", "Merkle root"],
  [LuScale, "Verify", "staked sample"],
  [LuBanknote, "Pay", "contributor"],
] as const;

const WHY = [
  [LuCpu, "Signed at the sensor", "A hardware key inside the device signs every clip at capture. Uploads that weren't captured can't be signed."],
  [LuUserCheck, "One human, one device", "Every device is linked to a verified, anonymous human, so one person can't fake a thousand devices."],
  [LuLink, "Tamper-proof by design", "Batch fingerprints live on-chain. Edit, poison or relabel one sample and its proof breaks."],
  [LuScale, "Verified by stake", "Random, staked validators spot-check every batch; honeypots grade them; anyone can challenge with a bond."],
] as const;

const ROLES = [
  [LuGlasses, "Contributors", "Wear it, capture your world, get paid per verified clip. Encrypted, private, revocable."],
  [LuShieldCheck, "Validators", "Stake, score random samples, earn for honest work. Lose stake only on objective evidence."],
  [LuBot, "AI labs", "License datasets with a provenance proof per sample and consent that travels with the data."],
] as const;

const VIEWS = ["Interactive", "Exploded", "Wireframe"] as const;

export default function Landing() {
  const dark = useDark();
  const [view, setView] = useState<(typeof VIEWS)[number]>("Interactive");

  return (
    <div className={`studio ${dark ? "" : "light"}`}>
      <header className="topbar sticky top-0 z-30">
        <nav className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4" aria-label="Main">
          <Link href="/" className="mr-auto flex h-8 items-center gap-2 text-[15px] font-semibold leading-none">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--st-lime)] text-[#07090e]"><Logo size={15} /></span>
            <span>ODYSSEY</span>
          </Link>
          <button className="icon-btn" onClick={() => setDark(!dark)} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
            {dark ? <LuSun size={18} /> : <LuMoon size={18} />}
          </button>
          <Link href="/docs" className="btn">Protocol</Link>
          <Link href="/datasets" className="btn primary">Browse datasets</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="pt-20 text-center">
          <span className="pill status" style={{ "--tone": "var(--st-cyan)" } as React.CSSProperties}>Proof-of-Reality Data</span>
          <h1 className="mx-auto mt-4 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">AI is running out of internet. Give it reality.</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-[var(--st-on-var)]">
            Real-world data for AI, signed at the sensor, verified by stake, owned by the people who capture it.
          </p>
          <div className="mt-8 flex justify-center gap-2">
            <Link href="/datasets" className="btn primary px-5! py-2.5!">Browse datasets <LuArrowRight size={16} /></Link>
            <Link href="/device" className="btn px-5! py-2.5!">See the device</Link>
          </div>

          <div className="glass stage relative mt-14 h-[520px] overflow-hidden text-left">
            <div className="stage-grid pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute -top-24 left-1/4 size-96 rounded-full bg-[var(--st-cyan)] opacity-[0.08] blur-3xl" />
            <div className="absolute inset-0">
              <Glasses3D lesson={1} hudState="capturing" prompt="clip 10 s · gaze on" dark={dark} exploded={view === "Exploded"} wireframe={view === "Wireframe"} />
            </div>
            <div className="seg pod absolute left-4 top-4" role="group" aria-label="Model view">
              {VIEWS.map((v) => <button key={v} className={view === v ? "on" : ""} aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>)}
            </div>
          </div>
        </section>

        <section className="glass mt-8 grid grid-cols-2 divide-[var(--st-line,rgba(128,128,128,.2))] py-2 text-center max-lg:[&>*:nth-child(n+3)]:border-t lg:grid-cols-4 lg:divide-x" aria-label="Key figures">
          {FIGURES.map(([v, u, k]) => (
            <div key={k} className="border-[var(--st-line,rgba(128,128,128,.2))] px-4 py-8">
              <p className="text-4xl font-semibold tabular-nums tracking-tight">{v}<span className="ml-1 text-xl text-[var(--st-lime)]">{u}</span></p>
              <p className="eyebrow mt-2">{k}</p>
            </div>
          ))}
        </section>

        <section className="glass relative mb-16 mt-8 overflow-hidden p-8" aria-labelledby="pipeline">
          <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[var(--st-phosphor)] opacity-[0.07] blur-3xl" />
          <span className="pill status" style={{ "--tone": "var(--st-phosphor)" } as React.CSSProperties}><LuCloudUpload size={12} />From lens to ledger</span>
          <h2 id="pipeline" className="mt-4 text-3xl font-semibold tracking-tight">Every clip carries its own proof.</h2>
          <p className="mt-2 max-w-xl text-[var(--st-on-var)]">
            Data stays off-chain, encrypted. Only one fingerprint per batch goes on-chain, so a million samples cost one
            transaction, and verification grows with the sample checked, not the dataset.
          </p>
          <div className="relative mt-10">
            <div className="absolute inset-x-[7%] top-5 h-px bg-[var(--st-line)]" aria-hidden>
              <span className="mesh-packet absolute -top-[3px] size-[7px] rounded-full bg-[var(--st-phosphor)] shadow-[0_0_10px_var(--st-phosphor)]" />
            </div>
            <ol className="relative grid grid-cols-7 gap-2 text-center">
              {PIPELINE.map(([Icon, t, d], i) => (
                <li key={t} className="flex flex-col items-center">
                  <span className={`grid size-10 place-items-center rounded-full border border-[var(--st-line)] bg-[var(--st-2)] ${i === PIPELINE.length - 1 ? "text-[var(--st-phosphor)]" : "text-[var(--st-cyan)]"}`}>
                    <Icon size={18} />
                  </span>
                  <p className="mt-3 text-sm font-medium">{t}</p>
                  <p className="eyebrow mt-0.5 hidden sm:block">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="grid gap-3 pb-16 sm:grid-cols-2 lg:grid-cols-4" aria-label="Why it can be trusted">
          {WHY.map(([Icon, t, d], i) => (
            <div key={t} className="glass p-6">
              <p className="eyebrow flex items-center justify-between">0{i + 1}<Icon size={18} className="text-[var(--st-cyan)]" /></p>
              <p className="mt-4 text-lg font-medium">{t}</p>
              <p className="text-xs text-[var(--st-on-var)]">{d}</p>
            </div>
          ))}
        </section>

        <section className="pb-20" aria-labelledby="roles">
          <h2 id="roles" className="text-center text-3xl font-semibold tracking-tight">Three sides, one network.</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {ROLES.map(([Icon, t, d]) => (
              <div key={t} className="glass p-6">
                <Icon size={26} className="text-[var(--st-cyan)]" />
                <p className="mt-4 text-lg font-medium">{t}</p>
                <p className="mt-1 text-sm text-[var(--st-on-var)]">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--st-line)]">
        <p className="eyebrow mx-auto flex max-w-6xl justify-between px-4 py-6">
          <span>© 2026 ODYSSEY</span>
          <Link href="/docs" className="hover:text-[var(--st-on)]">Protocol docs</Link>
        </p>
      </footer>
    </div>
  );
}
