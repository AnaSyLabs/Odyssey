"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Each stop: the page to open, what to point at (first visible match wins) and Odi's line. Demo pages first, then sign-in, then the docs.
const TOUR = [
  { path: "/", targets: ["h1"], title: "Welcome, explorer", text: "I'm Odi. AI is running out of internet, so Odyssey pays people to capture the real world and sells that data to AI labs. Let me show you around." },
  { path: "/device", targets: ['section[aria-label="3D model"]'], title: "Meet the glasses", text: "These camera glasses sign every capture with a key that never leaves the device. Nobody can fake where a photo came from." },
  { path: "/mockups/enroll", targets: ['section[aria-label="Device identity"]'], title: "One human, one device", text: "Enter your glasses' address, then prove you're a real person with World ID. Nobody learns who you are. This demo uses sample data." },
  { path: "/mockups/devices", targets: ['section[aria-label="Devices"]'], title: "Your devices", text: "Each enrolled device shows its samples and what it earned in 0G. Two provable strikes, like a replayed sample, ban it." },
  { path: "/mockups/datasets", targets: ['section[aria-label="Datasets"] > :first-child'], title: "The marketplace", text: "AI labs subscribe to an area for 30 days, paid in 0G. Every sample is signed by its device and checked by validators." },
  { path: "/mockups/analytics", targets: ['section[aria-label="Totals"]'], title: "Get paid", text: "Track what you captured and what you earned. Most of what labs pay goes to the people who captured the data." },
  { path: "/datasets", targets: ['[aria-labelledby="signin-title"]', 'section[aria-label="Datasets"]'], title: "Now the real thing", text: "Sign in with your wallet to use the live pages. Signing only proves the wallet is yours: no transaction, no gas." },
  { path: "/docs", targets: ["#live h2", 'a[href="/docs"]'], title: "That's the tour", text: "The full design and what's live today are here. Tap me any time for shortcuts. Good luck out there!" },
] as const;

type Rect = { top: number; left: number; width: number; height: number };

const visible = (sel: string) =>
  [...document.querySelectorAll<HTMLElement>(sel)].find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

/** Game-style walkthrough: Odi opens each page, spotlights one part and explains it in a speech bubble. */
export default function OdiTour({ step, setStep }: { step: number; setStep: (s: number | null) => void }) {
  const router = useRouter();
  const [spot, setSpot] = useState<{ step: number; rect: Rect } | null>(null);
  const stop = TOUR[step];

  // Open the stop's page, wait for its target to render (up to 4 s), scroll to it and keep the spotlight on it.
  useEffect(() => {
    if (location.pathname !== stop.path) router.push(stop.path);
    let el: HTMLElement | undefined, tries = 0;
    const measure = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setSpot({ step, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
    };
    const find = setInterval(() => {
      if (location.pathname === stop.path) el = stop.targets.map(visible).find(Boolean);
      if (el || ++tries > 26) {
        clearInterval(find);
        el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        setTimeout(measure, 350);
      }
    }, 150);
    addEventListener("scroll", measure, true);
    addEventListener("resize", measure);
    return () => { clearInterval(find); removeEventListener("scroll", measure, true); removeEventListener("resize", measure); };
  }, [step, stop, router]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && setStep(null);
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [setStep]);

  const last = step === TOUR.length - 1;
  const rect = spot?.step === step ? spot.rect : null;
  return (
    <>
      {rect && <div className="odi-spot" style={{ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }} aria-hidden />}
      <section className="odi-bubble" role="dialog" aria-label={`Odi's tour, step ${step + 1} of ${TOUR.length}`}>
        <p className="odi-step">{step + 1} / {TOUR.length}</p>
        <h2 className="odi-title">{stop.title}</h2>
        <Typed key={step} text={stop.text} />
        <div className="odi-actions">
          <button type="button" className="odi-skip" onClick={() => setStep(null)}>Skip tour</button>
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)}>Back</button>}
          <button type="button" className="odi-next" autoFocus onClick={() => setStep(last ? null : step + 1)}>{last ? "Finish" : "Next"}</button>
        </div>
      </section>
    </>
  );
}

/** NPC-style text that types itself out; screen readers get the whole line at once. */
function Typed({ text }: { text: string }) {
  // Only mounted after a click, so matchMedia is always available here.
  const [n, setN] = useState(() => (matchMedia("(prefers-reduced-motion: reduce)").matches ? text.length : 0));
  useEffect(() => {
    const t = setInterval(() => setN((c) => (c >= text.length ? (clearInterval(t), c) : c + 2)), 18);
    return () => clearInterval(t);
  }, [text]);
  return (
    <p className="odi-text">
      <span className="sr-only">{text}</span>
      <span aria-hidden>{text.slice(0, n)}</span>
    </p>
  );
}
