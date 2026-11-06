// Capture gate decision parsing and safe-stop. Run: npm test (no network, fake fetch).
import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, GateUnavailable, parseDecision, promptFor, type GateConfig } from "./gate-core.ts";

const cfg = (f: typeof fetch): GateConfig => ({ baseUrl: "https://x/v1", apiKey: "sk-test", model: "m", verifyTee: true, labels: false, timeoutMs: 1000, fetch: f });
const input = { data: Buffer.from("img"), mime: "image/jpeg", kind: "image" };
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const ok = (content: string, trace: object = { request_id: "req_1", provider: "p", tee_verified: true }) =>
  reply(200, { model: "m", choices: [{ message: { content } }], x_0g_trace: trace });

test("parses a decision out of surrounding prose", () => {
  assert.deepEqual(parseDecision('Sure: {"action":"skip","reason":"blurry"}'), { action: "skip", reason: "blurry" });
  assert.equal(parseDecision('{"action":"delete"}'), null);
  assert.equal(parseDecision("no json"), null);
});

test("returns the 0G request id and TEE flag with the decision", async () => {
  const d = await decide(input, cfg(ok('{"action":"capture","reason":"street"}')));
  assert.equal(d.action, "capture");
  assert.equal(d.requestId, "req_1");
  assert.equal(d.teeVerified, true);
});

test("safe-stop: every failure throws instead of inventing a decision", async () => {
  const down = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
  for (const f of [down, reply(503, { error: { code: "no_available_provider" } }), reply(402, { error: { code: "insufficient_balance" } }),
    ok("I cannot decide"), ok('{"action":"capture","reason":"x"}', {})]) {
    await assert.rejects(decide(input, cfg(f)), GateUnavailable);
  }
});

test("labels off: scene is ignored and the prompt is the original", async () => {
  assert.equal(parseDecision('{"action":"capture","reason":"x","scene":"street"}')?.scene, undefined);
  assert.ok(!promptFor(false).includes(`"scene"`));
  const d = await decide(input, cfg(ok('{"action":"capture","reason":"x","scene":"street"}')));
  assert.equal(d.scene, undefined);
});

test("labels on: valid scene is kept, invalid or missing scene is left out", async () => {
  assert.ok(promptFor(true).includes('"scene"'));
  assert.equal(parseDecision('{"action":"capture","reason":"x","scene":"street"}', true)?.scene, "street");
  assert.equal(parseDecision('{"action":"capture","reason":"x","scene":"spaceship"}', true)?.scene, undefined);
  assert.equal(parseDecision('{"action":"capture","reason":"x"}', true)?.scene, undefined);
  const d = await decide(input, { ...cfg(ok('{"action":"capture","reason":"x","scene":"shop"}')), labels: true });
  assert.equal(d.scene, "shop");
});
