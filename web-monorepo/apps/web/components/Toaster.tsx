"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LuCircleAlert, LuX } from "react-icons/lu";
import { useDark } from "@/lib/theme";

const EVENT = "odyssey:toast";
const SHOW_MS = 6000;
const MAX = 4;

/** Shows an error message in the top-right corner. Call it from any client code. */
export const toast = (message: string) => window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));

/** useState for an error message that also toasts it. Only a changed message toasts, so polling doesn't repeat one. Clear with setError(undefined). */
export function useToastError() {
  const [error, set] = useState<string>();
  const last = useRef<string>(undefined);
  const setError = useCallback((message?: string | null) => {
    if (message && message !== last.current) toast(message);
    last.current = message || undefined;
    set(message || undefined);
  }, []);
  return [error, setError] as const;
}

/** Mounted once in the root layout. */
export default function Toaster() {
  const dark = useDark();
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const dismiss = (id: number) => setToasts((l) => l.filter((t) => t.id !== id));

  useEffect(() => {
    let next = 0;
    const show = (e: Event) => {
      const t = { id: ++next, message: String((e as CustomEvent).detail) };
      setToasts((l) => [...l.filter((x) => x.message !== t.message), t].slice(-MAX)); // a repeated message shows once
      setTimeout(() => setToasts((l) => l.filter((x) => x.id !== t.id)), SHOW_MS);
    };
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);

  return (
    <div aria-label="Notifications" className={`studio ${dark ? "" : "light"} pointer-events-none fixed right-4 top-16 z-[60] flex min-h-0! w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 bg-transparent!`}>
      {toasts.map((t) => (
        <div key={t.id} role="alert" className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[var(--st-crimson)] bg-[var(--st-1)] p-3 shadow-[var(--st-shadow)]">
          <LuCircleAlert size={18} className="mt-px shrink-0 text-[var(--st-crimson)]" aria-hidden />
          <p className="min-w-0 flex-1 break-words text-sm">{t.message}</p>
          <button className="shrink-0 text-[var(--st-on-var)] hover:text-[var(--st-on)]" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <LuX size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
