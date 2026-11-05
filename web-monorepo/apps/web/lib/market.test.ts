// Encryption, sessions, payments and dataset filters. Run: npm test (no network).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { decrypt, ENC_OVERHEAD, encrypt, sampleKey } from "./crypto.ts";
import { matches } from "./filters.ts";
import { checkPayment, nextPaidUntil, PERIOD_SECONDS } from "./payment.ts";
import { sha256 } from "./sample.ts";
import { readSession, signSession } from "./token.ts";

const master = randomBytes(32).toString("hex");

test("per-sample keys round-trip and reject tampering", () => {
  const plain = Buffer.from("first-person clip");
  const h = sha256(plain);
  const k = sampleKey(master, h);
  const sealed = encrypt(plain, k, h);
  assert.equal(sealed.length, plain.length + ENC_OVERHEAD);
  assert.deepEqual(decrypt(sealed, k, h), plain);
  assert.throws(() => decrypt(sealed, sampleKey(master, sha256("other")), h)); // another sample's key
  assert.throws(() => decrypt(sealed, k, sha256("other"))); // ciphertext moved to another sample
  const flipped = Buffer.from(sealed);
  flipped[20] ^= 1;
  assert.throws(() => decrypt(flipped, k, h));
  assert.notDeepEqual(sampleKey(master, h), sampleKey(randomBytes(32).toString("hex"), h));
});

test("session tokens are signed and expire", () => {
  const t = signSession({ address: "0x51f18a28F4C17121770782aC95B9baAf6257053a", exp: 2_000 }, "s3cret");
  assert.equal(readSession(t, "s3cret", 1_000)?.address, "0x51f18a28F4C17121770782aC95B9baAf6257053a");
  assert.equal(readSession(t, "s3cret", 3_000), null); // expired
  assert.equal(readSession(t, "other", 1_000), null); // wrong secret
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ address: "0x0000000000000000000000000000000000000001", exp: 2_000 })).toString("base64url");
  assert.equal(readSession(`${forged}.${sig}`, "s3cret", 1_000), null);
  assert.equal(readSession(body, "s3cret", 1_000), null);
  assert.equal(readSession(undefined, "s3cret"), null);
});

test("payments must match payer, treasury, dataset and price", () => {
  const want = { payer: "0xAa00000000000000000000000000000000000001", treasury: "0xBb00000000000000000000000000000000000002", dataset: `0x${"cd".repeat(32)}`, price: 10n };
  const tx = { from: want.payer.toLowerCase(), to: want.treasury, value: 10n, input: want.dataset };
  const ok = { status: "success" as const };
  assert.equal(checkPayment(tx, ok, want), null);
  assert.equal(checkPayment({ ...tx, value: 12n }, ok, want), null);
  assert.match(checkPayment(tx, { status: "reverted" }, want)!, /reverted/);
  assert.match(checkPayment({ ...tx, from: "0x0000000000000000000000000000000000000009" }, ok, want)!, /signed-in/);
  assert.match(checkPayment({ ...tx, to: "0x0000000000000000000000000000000000000009" }, ok, want)!, /treasury/);
  assert.match(checkPayment({ ...tx, input: "0x" }, ok, want)!, /dataset key/);
  assert.match(checkPayment({ ...tx, value: 9n }, ok, want)!, /below/);
});

test("renewals stack from the paid-until time, lapsed ones restart now", () => {
  assert.equal(nextPaidUntil(5_000_000, 1_000), 5_000_000 + PERIOD_SECONDS);
  assert.equal(nextPaidUntil(500, 1_000), 1_000 + PERIOD_SECONDS);
});

test("dataset filter matches circle, kind, device type and time", () => {
  const f = { lat: 19.0596, lon: 72.8295, radiusM: 500, kind: "text", deviceType: "", fromTs: 100, toTs: 0 };
  const s = { lat: 19.0597, lon: 72.8296, kind: "text", deviceType: "esp32-cam-glasses", capturedAt: 200 };
  assert.ok(matches(f, s));
  assert.ok(!matches(f, { ...s, lat: 19.07 })); // ~1.2 km away
  assert.ok(!matches(f, { ...s, kind: "image" }));
  assert.ok(!matches(f, { ...s, capturedAt: 50 }));
  assert.ok(!matches({ ...f, deviceType: "phone" }, s));
});
