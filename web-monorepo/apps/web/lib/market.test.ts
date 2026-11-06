// Encryption, sessions, reward splits and dataset filters. Run: npm test (no network).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { concat, encodeAbiParameters, keccak256, parseAbiParameters } from "viem";
import { decrypt, ENC_OVERHEAD, encrypt, sampleKey } from "./crypto.ts";
import { matches } from "./filters.ts";
import { allocate, type Leaf, rewardTree } from "./rewards.ts";
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

test("contributor revenue splits pro rata by samples, per payout wallet", () => {
  const A = "0x00000000000000000000000000000000000000aa";
  const B = "0x00000000000000000000000000000000000000bb";
  const revenue = new Map([["ds1", 7_000n], ["ds2", 10n]]);
  const samples = new Map([
    ["ds1", new Map([["dev1", 2], ["dev2", 1], ["dev3", 4]])],
    ["ds2", new Map([["dev1", 3]])],
  ]);
  const payout = new Map<string, `0x${string}` | undefined>([["dev1", A], ["dev2", A], ["dev3", undefined]]);
  const out = allocate(revenue, samples, payout);
  // ds1: 7000 over 7 samples = 1000 each; dev1+dev2 -> A (3000), dev3 has no wallet. ds2: all 10 to dev1 -> A.
  assert.deepEqual([...out], [[A, 3_010n]]);
  assert.equal(allocate(revenue, samples, new Map([["dev1", B]])).get(B), 2_010n); // floors 7000*2/7
});

test("reward leaves hash exactly like OdsySubscriptions.claim", () => {
  const leaf: Leaf = [3n, "0x00000000000000000000000000000000000000aa", 5_000n];
  const tree = rewardTree([leaf, [3n, "0x00000000000000000000000000000000000000bb", 2_000n]]);
  const solidity = keccak256(concat([keccak256(encodeAbiParameters(parseAbiParameters("uint256, address, uint256"), leaf))]));
  assert.equal(tree.leafHash(leaf), solidity);
  assert.ok(tree.getProof(leaf).length === 1);
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
