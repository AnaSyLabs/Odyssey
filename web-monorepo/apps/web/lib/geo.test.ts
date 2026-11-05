// Run: npm test (node --test). No Arkiv access needed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { recoverMessageAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { coverCircle, distanceM, geohash } from "./geo.ts";
import { groupOf, thinGroup } from "./retention.ts";
import { sampleMessage, sha256 } from "./sample.ts";

test("geohash matches known values", () => {
  assert.equal(geohash(57.64911, 10.40744, 11), "u4pruydqqvj"); // the Wikipedia example
  assert.equal(geohash(19.0596, 72.8295, 5), "te7u3"); // Bandra West
});

test("coverCircle cells contain every point in the circle", () => {
  for (const [lat, lon, r] of [[19.0596, 72.8295, 500], [19.0596, 72.8295, 20], [51.5, -0.12, 5000], [-33.86, 151.2, 50_000]]) {
    const cells = coverCircle(lat, lon, r);
    assert.ok(cells.length >= 1 && cells.length <= 4, `cells ${cells.length}`);
    for (let a = 0; a < 360; a += 15) {
      const pLat = lat + ((r * 0.999) / 111_320) * Math.cos((a * Math.PI) / 180);
      const pLon = lon + ((r * 0.999) / (111_320 * Math.cos((lat * Math.PI) / 180))) * Math.sin((a * Math.PI) / 180);
      assert.ok(cells.some((c) => geohash(pLat, pLon).startsWith(c)), `point at ${a}° outside cover`);
    }
  }
});

test("distanceM is about right", () => {
  const d = distanceM(19.0596, 72.8295, 19.0596, 72.8395); // 0.01° of longitude at 19°N
  assert.ok(Math.abs(d - 1052) < 5, `${d}`);
});

test("thinGroup keeps the earliest capture, ties by key", () => {
  assert.equal(thinGroup([{ key: "0xb", capturedAt: 5n }, { key: "0xa", capturedAt: 7n }]), "0xb");
  assert.equal(thinGroup([{ key: "0xb", capturedAt: 5n }, { key: "0xa", capturedAt: 5n }]), "0xa");
  assert.equal(thinGroup([]), undefined);
});

test("groupOf buckets by device, cell and window", () => {
  const a = groupOf({ device: "0xAB", geohash: "te7u3gxyz", capturedAt: 7_205n }, 7, 3600);
  assert.deepEqual([a.id, a.start, a.end], ["0xab|te7u3gx|7200", 7200n, 10_799n]);
  assert.equal(groupOf({ device: "0xab", geohash: "te7u3gxqq", capturedAt: 10_799n }, 7, 3600).id, a.id);
  assert.notEqual(groupOf({ device: "0xab", geohash: "te7u3gxqq", capturedAt: 10_800n }, 7, 3600).id, a.id);
});

test("device signature round-trips through sampleMessage", async () => {
  const acct = privateKeyToAccount(generatePrivateKey());
  const u = { kind: "text" as const, mime: "text/plain", capturedAt: 1_790_000_000, lat: "19.0596", lon: "72.8295", sensors: "{}" };
  const hash = sha256("hello");
  const signature = await acct.signMessage({ message: sampleMessage(u, hash) });
  assert.equal(await recoverMessageAddress({ message: sampleMessage(u, hash), signature }), acct.address);
  assert.notEqual(await recoverMessageAddress({ message: sampleMessage({ ...u, lat: "19.0597" }, hash), signature }), acct.address);
});
