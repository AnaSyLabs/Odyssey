"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import OdiTour from "@/components/OdiTour";

const LINKS = [
  ["/docs", "How Odyssey works"],
  ["/datasets", "Browse datasets"],
  ["/enroll", "Enroll your glasses"],
  ["/wiring", "Wire up the hardware"],
  ["https://github.com/AnaSyLabs/Odyssey", "Code on GitHub"],
] as const;

/** Odi, the Odyssey guide: a round robot avatar docked bottom-right whose glowing eyes follow the pointer. */
export default function Odi() {
  const [open, setOpen] = useState(false);
  const [tour, setTour] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // The eyes follow the pointer (up to 4 units, so they stay on the visor): write CSS vars straight to the DOM so moving the mouse never re-renders.
  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 300);
        el.style.setProperty("--odi-x", `${((dx / d) * 4 * k).toFixed(2)}px`);
        el.style.setProperty("--odi-y", `${((dy / d) * 4 * k).toFixed(2)}px`);
      });
    };
    addEventListener("pointermove", move);
    return () => { removeEventListener("pointermove", move); cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const click = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("keydown", key);
    addEventListener("pointerdown", click);
    return () => { removeEventListener("keydown", key); removeEventListener("pointerdown", click); };
  }, [open]);

  return (
    <div ref={root} className="odi">
      {tour !== null && <OdiTour step={tour} setStep={setTour} />}
      {open && tour === null && (
        <nav className="odi-panel" aria-label="Odi quick links">
          <p className="odi-hi">Hi, I&apos;m Odi. I see the world so AI can learn from it. Where to?</p>
          <ul>
            <li><button type="button" className="odi-tour-btn" onClick={() => { setOpen(false); setTour(0); }}>Take the tour ★</button></li>
            {LINKS.map(([href, label]) => (
              <li key={href}>
                {href.startsWith("http")
                  ? <a href={href} target="_blank" rel="noreferrer">{label} ↗</a>
                  : <Link href={href} onClick={() => setOpen(false)}>{label} →</Link>}
              </li>
            ))}
          </ul>
        </nav>
      )}
      <button type="button" className="odi-btn" aria-label="Odi, the Odyssey guide: open quick links" aria-expanded={open} onClick={() => { setTour(null); setOpen((o) => !o); }}>
        <svg viewBox="0 0 100 100" aria-hidden focusable="false">
          <defs>
            <radialGradient id="odi-dome" cx="35%" cy="25%" r="80%">
              <stop offset="0" stopColor="#e6ffb0" />
              <stop offset=".45" stopColor="#c5f467" />
              <stop offset="1" stopColor="#6f9a24" />
            </radialGradient>
            <filter id="odi-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="odi-clip"><circle cx="50" cy="50" r="50" /></clipPath>
          </defs>
          <g clipPath="url(#odi-clip)">
            <circle cx="50" cy="50" r="50" fill="#1b2116" />
            {/* the head peeks up from the bottom of the badge */}
            <g className="odi-body">
              <line x1="50" y1="16" x2="50" y2="34" stroke="#a9d84e" strokeWidth="4" strokeLinecap="round" />
              <circle className="odi-led" cx="50" cy="14" r="5" fill="url(#odi-dome)" />
              <rect x="42" y="32" width="16" height="6" rx="3" fill="#a9d84e" />
              <path d="M4 104C4 64 24 37 50 37s46 27 46 67Z" fill="url(#odi-dome)" />
              <path d="M22 56a32 32 0 0 1 16-12" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3.5" strokeLinecap="round" />
              {/* visor */}
              <path d="M17 104C17 76 31 60 50 60s33 16 33 44Z" fill="#0a0d07" />
              {/* glowing eyes: they look toward the pointer and blink together */}
              <g className="odi-eyes">
                <g className="odi-pupils" fill="#eaffc4" filter="url(#odi-glow)">
                  <ellipse cx="38" cy="79" rx="7.5" ry="8.5" />
                  <ellipse cx="62" cy="79" rx="7.5" ry="8.5" />
                </g>
              </g>
            </g>
          </g>
        </svg>
      </button>
    </div>
  );
}
