import assert from "node:assert/strict";
import test from "node:test";
import { byDataset, fmt, monthly, sum } from "./analytics.ts";

const t = (iso: string) => Date.parse(iso) / 1000;
const rows = [
  { subscriber: "0xa", datasetName: "Bandra", amount: "0.01", toContributors: "0.007", paidAt: t("2026-11-03T10:00:00Z"), legacy: false },
  { subscriber: "0xa", datasetName: "Bandra", amount: "0.01", toContributors: "0.007", paidAt: t("2026-11-20T10:00:00Z"), legacy: false },
  { subscriber: "0xb", datasetName: "Weather", amount: "0.02", toContributors: "0", paidAt: undefined, legacy: true },
  { subscriber: "0xb", datasetName: "Weather", amount: "0.03", toContributors: "0.021", paidAt: t("2026-09-30T23:59:59Z"), legacy: false },
];

test("sum and fmt are exact in wei and trim trailing zeros", () => {
  assert.equal(fmt(sum(["0.1", "0.2"])), "0.3 0G");
  assert.equal(fmt(sum(["0.007", "0.003"])), "0.01 0G");
  assert.equal(fmt(0n), "0 0G");
});

test("monthly buckets by UTC month, oldest first, and skips rows without a timestamp", () => {
  const m = monthly(rows, (r) => r.amount, 3, t("2026-11-25T00:00:00Z"));
  assert.deepEqual(m.map((x) => x.label), ["Sep", "Oct", "Nov"]);
  assert.deepEqual(m.map((x) => fmt(x.total)), ["0.03 0G", "0 0G", "0.02 0G"]);
});

test("a payment outside the window is ignored", () => {
  const m = monthly(rows, (r) => r.amount, 1, t("2026-11-25T00:00:00Z"));
  assert.equal(fmt(m[0].total), "0.02 0G");
});

test("byDataset totals per name, biggest first", () => {
  const d = byDataset(rows);
  assert.deepEqual(d.map(([n]) => n), ["Weather", "Bandra"]);
  assert.equal(fmt(d[0][1]), "0.05 0G");
  assert.equal(fmt(byDataset(rows, (r) => r.toContributors)[1][1]), "0.014 0G");
});
