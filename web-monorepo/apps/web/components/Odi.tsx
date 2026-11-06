"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  ["/docs", "How Odyssey works"],
  ["/datasets", "Browse datasets"],
  ["/enroll", "Enroll your glasses"],
  ["/wiring", "Wire up the hardware"],
  ["https://github.com/AnaSyLabs/Odyssey", "Code on GitHub"],
] as const;

/** Odi, the Odyssey guide: a little camera bot docked bottom-right whose lens eye follows the pointer. */
export default function Odi() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // The iris follows the pointer (up to 8 units, the gap inside the lens ring): write CSS vars straight to the DOM so moving the mouse never re-renders.
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
        el.style.setProperty("--odi-x", `${((dx / d) * 8 * k).toFixed(2)}px`);
        el.style.setProperty("--odi-y", `${((dy / d) * 8 * k).toFixed(2)}px`);
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
      {open && (
        <nav className="odi-panel" aria-label="Odi quick links">
          <p className="odi-hi">Hi, I&apos;m Odi. I see the world so AI can learn from it. Where to?</p>
          <ul>
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
      <button type="button" className="odi-btn" aria-label="Odi, the Odyssey guide: open quick links" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 120 108" aria-hidden focusable="false">
          <g className="odi-body">
            {/* antenna with the capture LED */}
            <line x1="60" y1="20" x2="60" y2="9" stroke="#c5f467" strokeWidth="4" strokeLinecap="round" />
            <circle className="odi-led" cx="60" cy="7" r="5" fill="#ff4d4d" />
            {/* ears, head and face plate */}
            <rect x="8" y="48" width="10" height="22" rx="5" fill="#8fbf3a" />
            <rect x="102" y="48" width="10" height="22" rx="5" fill="#8fbf3a" />
            <rect x="16" y="20" width="88" height="80" rx="26" fill="#c5f467" />
            <rect x="24" y="28" width="72" height="56" rx="20" fill="#1a1f14" />
            <path d="M31 37a14 14 0 0 1 10-6" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="3" strokeLinecap="round" />
            {/* the lens eye: ring stays put, the iris follows the pointer */}
            <g className="odi-eyes">
              <circle cx="60" cy="56" r="20" fill="#2b3320" stroke="#c5f467" strokeWidth="3" />
              <g className="odi-pupils">
                <circle cx="60" cy="56" r="12" fill="#0b0b0b" />
                <circle cx="64" cy="52" r="4" fill="#fff" />
              </g>
            </g>
            <path d="M50 92q10 5 20 0" fill="none" stroke="#1a1f14" strokeWidth="4" strokeLinecap="round" />
          </g>
        </svg>
      </button>
    </div>
  );
}
