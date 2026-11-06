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

/** Odi, the Odyssey guide: a pair of capture glasses docked bottom-right whose eyes follow the pointer. */
export default function Odi() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Eyes follow the pointer: write CSS vars straight to the DOM so moving the mouse never re-renders.
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
        el.style.setProperty("--odi-x", `${((dx / d) * 4.5 * k).toFixed(2)}px`);
        el.style.setProperty("--odi-y", `${((dy / d) * 4.5 * k).toFixed(2)}px`);
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
        <svg viewBox="0 0 120 84" aria-hidden focusable="false">
          <g className="odi-body">
            {/* temples */}
            <path d="M8 34 2 28M112 34l6-6" stroke="#c5f467" strokeWidth="5" strokeLinecap="round" />
            {/* frame: two lenses and the bridge */}
            <circle cx="34" cy="40" r="25" fill="#0f1a10" stroke="#c5f467" strokeWidth="6" />
            <circle cx="86" cy="40" r="25" fill="#0f1a10" stroke="#c5f467" strokeWidth="6" />
            <path d="M56 34q4-5 8 0" fill="none" stroke="#c5f467" strokeWidth="6" strokeLinecap="round" />
            {/* lens glare */}
            <path d="M20 30a16 16 0 0 1 10-9M72 30a16 16 0 0 1 10-9" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round" />
            {/* eyes */}
            <g className="odi-eyes">
              <circle cx="34" cy="42" r="10" fill="#f4f4f4" />
              <circle cx="86" cy="42" r="10" fill="#f4f4f4" />
              <g className="odi-pupils" fill="#0b0b0b">
                <circle cx="34" cy="42" r="5" />
                <circle cx="86" cy="42" r="5" />
              </g>
            </g>
            {/* smile under the bridge */}
            <path d="M53 66q7 6 14 0" fill="none" stroke="#c5f467" strokeWidth="4" strokeLinecap="round" />
            {/* capture LED */}
            <circle className="odi-led" cx="12" cy="20" r="4" fill="#ff4d4d" />
          </g>
        </svg>
      </button>
    </div>
  );
}
