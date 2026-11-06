// Totals and chart buckets for the Analytics page. Pure, so node --test can run it. Amounts are 0G as decimal strings.
import { formatEther, parseEther } from "viem";

export type Payment = { subscriber: string; datasetName?: string; amount: string; toContributors: string; paidAt?: number; legacy: boolean };

const wei = (s: string) => parseEther(s);
export const sum = (xs: string[]) => xs.reduce((n, x) => n + wei(x), 0n);

/** 0G for display: at most 4 decimals, no trailing zeros. */
export const fmt = (w: bigint) => `${Number(formatEther(w)).toLocaleString("en-US", { maximumFractionDigits: 4 })} 0G`;

/** The last `n` calendar months (UTC), oldest first, with the total of `pick(row)` paid in each. Rows without a timestamp are skipped. */
export function monthly<T extends { paidAt?: number }>(rows: T[], pick: (r: T) => string, n: number, now = Date.now() / 1000) {
  const end = new Date(now * 1000);
  const months = Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (n - 1 - i), 1));
    return { key: d.getUTCFullYear() * 12 + d.getUTCMonth(), label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }), total: 0n };
  });
  for (const r of rows) {
    if (r.paidAt === undefined) continue;
    const d = new Date(r.paidAt * 1000);
    const m = months.find((x) => x.key === d.getUTCFullYear() * 12 + d.getUTCMonth());
    if (m) m.total += wei(pick(r));
  }
  return months;
}

/** Totals per dataset name, biggest first. */
export function byDataset(rows: Payment[], pick: (r: Payment) => string = (r) => r.amount) {
  const t = new Map<string, bigint>();
  for (const r of rows) t.set(r.datasetName ?? "(unknown)", (t.get(r.datasetName ?? "(unknown)") ?? 0n) + wei(pick(r)));
  return [...t].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));
}
