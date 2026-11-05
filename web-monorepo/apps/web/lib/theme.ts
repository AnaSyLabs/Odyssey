"use client";
import { useSyncExternalStore } from "react";

const KEY = "odyssey:theme";
const listeners = new Set<() => void>();

/** Lab theme: the Stitch dark design by default, or the original cream light theme. */
export function useDark() {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => void listeners.delete(cb)),
    () => localStorage.getItem(KEY) !== "light",
    () => true,
  );
}

export function setDark(dark: boolean) {
  localStorage.setItem(KEY, dark ? "dark" : "light");
  listeners.forEach((cb) => cb());
}
