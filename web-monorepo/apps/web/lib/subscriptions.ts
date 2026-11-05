"use client";
import { useSyncExternalStore } from "react";

// shortcut: subscriptions live in localStorage with no payment or access check; replace with the gateway's subscription API.
const KEY = "odyssey:subscriptions";
const listeners = new Set<() => void>();
const read = () => localStorage.getItem(KEY) ?? "";

export function useSubscribed(id: string) {
  const ids = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => void listeners.delete(cb)),
    read,
    () => "",
  );
  return ids.split(",").includes(id);
}

export function setSubscribed(id: string, on: boolean) {
  const ids = new Set(read().split(",").filter(Boolean));
  if (on) ids.add(id);
  else ids.delete(id);
  localStorage.setItem(KEY, [...ids].join(","));
  listeners.forEach((cb) => cb());
}
