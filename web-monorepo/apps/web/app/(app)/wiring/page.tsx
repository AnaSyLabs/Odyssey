"use client";
import { useState } from "react";
import CodePane from "@/components/lab/CodePane";
import { LEFT, LESSONS, RIGHT, WIRES } from "@/components/lab/lab-data";
import Scene from "@/components/lab/Scene";

const used = new Set(WIRES.map((w) => w.pin));

export default function Wiring() {
  const [lesson, setLesson] = useState(0);
  const [focusPin, setFocusPin] = useState<string>();

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Wiring &amp; firmware</h1>
        <p className="muted text-sm">ESP32 DevKit, breadboard and reference firmware, one lesson at a time.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_460px]">
        <section className="ui-card flex flex-col justify-center p-4" aria-label="Wiring diagram">
          <Scene lesson={lesson} hudState="idle" prompt="" focusPin={focusPin} />
          <p className="muted px-2 pb-1 text-xs">Hover or click the board for pin details. Wires follow the lesson.</p>
        </section>

        <aside className="flex flex-col gap-5">
          <div className="ui-card space-y-3 p-5 text-xs">
            <p className="text-sm font-semibold">{LESSONS[lesson].title}</p>
            <p className="muted text-sm">{LESSONS[lesson].blurb}</p>
            <table className="w-full">
              <tbody>
                {WIRES.map((w) => (
                  <tr key={w.pin} className="cursor-default border-b border-[var(--ink-dark)]/10 hover:bg-[var(--accent-teal)]/10"
                    onMouseEnter={() => setFocusPin(w.pin)} onMouseLeave={() => setFocusPin(undefined)}>
                    <td className="py-1"><span className="mr-2 inline-block size-2.5 rounded-full border border-[var(--ink-dark)] align-middle" style={{ background: w.color }} />{w.pin}</td>
                    <td>{w.label}</td>
                    <td className="muted text-right">{w.part}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {[["Left header", LEFT], ["Right header", RIGHT]].map(([title, pins]) => (
              <div key={title as string}>
                <p className="muted mb-1">{title as string}</p>
                <div className="flex flex-wrap gap-1">
                  {(pins as string[]).map((p, i) => (
                    <span key={p + i} className={`rounded border px-1.5 py-0.5 ${used.has(p) && title === "Right header" ? "border-[var(--accent-teal)] bg-[var(--accent-teal)]/15 font-bold" : "border-[var(--ink-dark)]/30 muted"}`}>{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <CodePane lesson={lesson} />
        </aside>
      </div>

      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label="Lessons">
        {LESSONS.map((l, i) => (
          <button key={l.id} className={`ui-card flex flex-col p-5 text-left ${i === lesson ? "active" : ""}`} onClick={() => setLesson(i)}>
            <span className="eyebrow">Lesson {String(i + 1).padStart(2, "0")}</span>
            <span className="mt-2 block font-medium">{l.title}</span>
            <span className="muted mt-1 block text-xs leading-snug">{l.blurb}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
