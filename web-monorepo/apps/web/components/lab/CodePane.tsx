"use client";
import { useEffect, useRef, useState } from "react";
import { SKETCH } from "./lab-data";

/** Source listing; the line currently "executing" steps through the active lesson's block. */
export default function CodePane({ lesson }: { lesson: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 650);
    return () => clearInterval(t);
  }, []);

  const box = useRef<HTMLDivElement>(null);
  const block = SKETCH.flatMap(([, l], i) => (l === lesson ? [i] : []));
  const executing = block.length ? block[tick % block.length] : -1;

  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(".executing");
    if (box.current && el) box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight / 2, behavior: "smooth" });
  }, [executing]);

  return (
    <div ref={box} className="ui-card mono relative h-72 overflow-auto px-2 py-4 text-xs leading-5" role="region" aria-label="Firmware source">
      {SKETCH.map(([text, l], i) => (
        <div key={i} className={`code-line ${i === executing ? "executing" : ""}`}>
          <span className="muted w-5 shrink-0 text-right select-none">{i + 1}</span>
          <span className={l === lesson ? "font-bold" : text.trim().startsWith("//") ? "muted" : ""}>{text}</span>
        </div>
      ))}
    </div>
  );
}
