import assert from "node:assert/strict";
import test from "node:test";
import { tally, verdict } from "./hexes.ts";

test("tally weighs by stake and ignores missed reveals", () => {
  const { consensus, quorum } = tally([
    { validator: "a", stake: 3000, score: 0.9 },
    { validator: "b", stake: 1000, score: 0.4 },
    { validator: "c", stake: 1000, score: null },
  ]);
  assert.equal(consensus, 0.75);
  assert.equal(quorum, 0.8);
});

test("verdict needs quorum, supermajority and a closed window", () => {
  assert.equal(verdict(0.8, 0.9, 0), "verified");
  assert.equal(verdict(0.8, 0.9, 12), "challenge");
  assert.equal(verdict(0.8, 0.5, 0), "challenge");
  assert.equal(verdict(0.5, 0.9, 0), "challenge");
  assert.equal(verdict(0.2, 0.9, 0), "rejected");
});
