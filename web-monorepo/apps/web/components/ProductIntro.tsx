"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useDark } from "@/lib/theme";
import { playIntroJingle } from "@/components/introJingle";

const IntroScene = dynamic(() => import("@/components/lab/IntroScene"), { ssr: false });
const noop = () => () => {};

/** First-visit product loader: the glasses explode into their parts and snap back together. */
export default function ProductIntro() {
  const [phase, setPhase] = useState<"play" | "leave" | "gone">("play");
  const finish = useCallback(() => setPhase((p) => (p === "play" ? "leave" : p)), []);
  // the inline script in the layout sets this before paint for repeat visits and reduced motion
  const off = useSyncExternalStore(noop, () => document.documentElement.dataset.intro === "off", () => false);
  const dark = useDark();

  // jingle: plays only if the browser allows sound without a click; stops when the loader is gone
  const stopJingle = useRef<() => void>(undefined);
  useEffect(() => {
    if (off) return;
    stopJingle.current = playIntroJingle();
    return () => stopJingle.current?.();
  }, [off]);
  useEffect(() => {
    if (phase === "gone") stopJingle.current?.();
  }, [phase]);

  useEffect(() => {
    if (off) return;
    sessionStorage.setItem("odyssey:intro", "1");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [finish, off]);

  if (off || phase === "gone") return null;
  return (
    <div
      className={`studio intro fixed inset-0 z-50 transition-opacity duration-700 ${dark ? "" : "light"} ${phase === "leave" ? "pointer-events-none opacity-0" : ""}`}
      onTransitionEnd={(e) => e.target === e.currentTarget && setPhase("gone")}
    >
      <IntroScene onDone={finish} />
      <p className="eyebrow pointer-events-none absolute inset-x-0 bottom-8 text-center tracking-[0.5em]!">ODYSSEY</p>
      <button onClick={finish} className="btn absolute right-6 top-6">Skip intro</button>
    </div>
  );
}
