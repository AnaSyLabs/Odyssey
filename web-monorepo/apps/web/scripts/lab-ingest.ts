// What an AI lab runs to pull the datasets it subscribes to into its own warehouse. It reads samples straight from
// Arkiv and 0G, re-verifies every one, asks the Odsy gateway only for per-sample decryption keys (after signing in
// with the paying wallet), and writes JSONL + files. Run it on a schedule; each run is incremental.
// Run: node --env-file-if-exists=.env scripts/lab-ingest.ts
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { createPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, asc, between, eq, gt, startsWith } from "@arkiv-network/sdk/query";
import { addr, key, u64 } from "@arkiv-network/sdk/schema";
import { getAddress, type Hex, http, isAddress, isHex, recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { decrypt } from "../lib/crypto.ts";
import { datasetFilter, filterWhere, matches, sampleFields } from "../lib/filters.ts";
import { groupOf, thinGroup } from "../lib/retention.ts";
import { type Kind, sha256, signedText } from "../lib/sample.ts";
import { Datasets, Devices, Samples } from "../lib/schema.ts";

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name} (see .env.example, "Lab ingest")`);
  return v;
};
const GATEWAY = env("ODSY_GATEWAY_ADDRESS"); // the only trusted Arkiv writer
if (!isAddress(GATEWAY)) throw new Error("ODSY_GATEWAY_ADDRESS must be an address");
const API = env("GATEWAY_URL").replace(/\/$/, "");
const LAB_KEY = env("LAB_PRIVATE_KEY");
if (!isHex(LAB_KEY) || LAB_KEY.length !== 66) throw new Error("LAB_PRIVATE_KEY must be 0x + 64 hex: the wallet that paid");
const DATASETS = env("LAB_DATASETS").split(",").map((d) => d.trim()).filter(Boolean) as Hex[];
// all: every sample the gateway wrote. thinned: only the one sample per group the gateway keeps long-term.
const MODE = process.env.LAB_MODE ?? "all";
if (MODE !== "all" && MODE !== "thinned") throw new Error("LAB_MODE must be all or thinned");
const PRECISION = Number(process.env.THIN_GEOHASH_PRECISION ?? 7); // must match the gateway's
const WINDOW = Number(process.env.THIN_WINDOW_SECONDS ?? 3600); // must match the gateway's
const GRACE = BigInt(process.env.LAB_THIN_GRACE_SECONDS ?? 3600); // wait for late uploads before picking a group's keeper
const OUT = process.env.LAB_OUT_DIR ?? "lab-data";
const og = new Indexer(process.env.OG_INDEXER_URL ?? "https://indexer-storage-testnet-turbo.0g.ai");
const arkiv = createPublicClient({ chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" }), transport: http() });
const gateway = getAddress(GATEWAY);
const lab = privateKeyToAccount(LAB_KEY);

// --- Sign in to the gateway with the lab wallet (Sign-In with Ethereum), keeping its cookies.
let cookies = "";
async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { "content-type": "application/json", cookie: cookies, ...init.headers } });
  const set = res.headers.getSetCookie().map((c) => c.split(";")[0]);
  if (set.length) cookies = [...new Map([...cookies.split("; "), ...set].filter(Boolean).map((c) => [c.split("=")[0], c])).values()].join("; ");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${body.error ?? res.status}`);
  return body;
}
const { nonce } = await call("/api/auth/nonce");
const message = createSiweMessage({
  address: lab.address, chainId: 16602, domain: new URL(API).host, uri: API, nonce, version: "1",
  statement: "Odyssey lab ingest", issuedAt: new Date(), expirationTime: new Date(Date.now() + 10 * 60_000),
});
await call("/api/auth/verify", { method: "POST", body: JSON.stringify({ message, signature: await lab.signMessage({ message }) }) });

// --- Local state, rebuilt from the output files so a crashed run never duplicates rows.
mkdirSync(join(OUT, "media"), { recursive: true });
const file = (name: string) => join(OUT, name);
const keysIn = (name: string) =>
  existsSync(file(name)) ? readFileSync(file(name), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).key as string) : [];
const decided = new Set([...keysIn("samples.jsonl"), ...keysIn("rejected.jsonl"), ...keysIn("dropped.jsonl")]);
const record = (name: string, row: { key: string; [field: string]: unknown }) => {
  appendFileSync(file(name), JSON.stringify(row) + "\n");
  decided.add(row.key);
};
const state: { cursors: Record<string, string> } = existsSync(file("state.json")) ? JSON.parse(readFileSync(file("state.json"), "utf8")) : { cursors: {} };
state.cursors ??= {};

async function scan<T extends { $key: Hex }>(page: (after?: Hex) => Promise<{ entities: readonly T[] }>) {
  const all: T[] = [];
  for (let after: Hex | undefined; ; ) {
    const { entities } = await page(after);
    all.push(...entities);
    if (entities.length < 100) return all;
    after = entities.at(-1)!.$key;
  }
}
const afterKey = (after?: Hex) => (after ? [gt("$key", key(after))] : []);

const now = BigInt(Math.floor(Date.now() / 1000));
const registry = new Map<string, string | null>(); // device -> worldId
const keepers = new Map<string, Hex | undefined>(); // group id -> kept key
const counts = { ingested: 0, rejected: 0, dropped: 0, waiting: 0, locked: 0, failed: 0 };

for (const ds of DATASETS) {
  const d = await arkiv.getEntity(ds, Datasets).catch(() => null);
  if (!d || d.$owner.toLowerCase() !== gateway.toLowerCase()) { console.error(`dataset ${ds}: not found or not from the Odsy gateway`); continue; }
  const f = datasetFilter(d);

  // Samples are created and extended with the max lifetime, so a new or extended one always has $expiresAt >= the last cursor.
  // The cursor is applied here rather than in the Arkiv query, which returned no rows for a $expiresAt filter.
  // shortcut: rescans the dataset's cells every run; move the cursor back into the query once Arkiv filters $expiresAt.
  const cursor = BigInt(state.cursors[ds] ?? "0");
  const scanned = await scan((after) =>
    arkiv.select({ $key: true, $expiresAt: true, device: true, geohash: true, capturedAt: true, lat: true, lon: true, kind: true, deviceType: true })
      .from(Samples, { onMismatch: "throw" }).where(and(...filterWhere(f), ...afterKey(after)))
      .ownedBy(gateway).orderBy(asc("$key")).limit(100).fetch(),
  );
  const inArea = scanned.filter((r) => matches(f, sampleFields(r)));
  const rows = inArea.filter((r) => r.$expiresAt >= cursor);
  console.error(`dataset ${d.name.value}: ${scanned.length} in cells, ${inArea.length} match, ${rows.length} new or extended, ${rows.filter((r) => decided.has(r.$key)).length} already done`);
  if (!scanned.length) console.error(`  filter: ${JSON.stringify(f)} (captured times are unix seconds)`);

  let next = rows.reduce((m, r) => (r.$expiresAt > m ? r.$expiresAt : m), cursor);
  const retry = (r: { $expiresAt: bigint }) => (next = r.$expiresAt < next ? r.$expiresAt : next);

  const todo: typeof rows = [];
  for (const r of rows) {
    if (decided.has(r.$key)) continue;
    if (MODE === "thinned") {
      const g = groupOf({ device: r.device.value, geohash: r.geohash.value, capturedAt: r.capturedAt.value }, PRECISION, WINDOW);
      if (g.end + GRACE > now) { counts.waiting++; retry(r); continue; } // window still open
      // shortcut: a sample uploaded after window + grace can change the keeper after we picked one; raise LAB_THIN_GRACE_SECONDS if devices upload late.
      if (!keepers.has(g.id)) {
        const members = await scan((after) =>
          arkiv.select({ $key: true, capturedAt: true }).from(Samples, { onMismatch: "throw" })
            .where(and(eq("device", addr(g.device)), startsWith("geohash", g.cell), between("capturedAt", u64(g.start), u64(g.end)), ...afterKey(after)))
            .ownedBy(gateway).orderBy(asc("$key")).limit(100).fetch(),
        );
        keepers.set(g.id, thinGroup(members.map((m) => ({ key: m.$key, capturedAt: m.capturedAt.value }))));
      }
      if (keepers.get(g.id) !== r.$key) { record("dropped.jsonl", { key: r.$key, group: g.id }); counts.dropped++; continue; }
    }
    todo.push(r);
  }

  // Decryption keys from the gateway: only granted while this wallet's subscription covers the sample.
  const sampleKeys: Record<string, string> = {};
  for (let i = 0; i < todo.length; i += 100) {
    Object.assign(sampleKeys, (await call("/api/keys", { method: "POST", body: JSON.stringify({ keys: todo.slice(i, i + 100).map((r) => r.$key) }) })).keys);
  }

  for (const r of todo) {
    try {
      const s = await arkiv.getEntity(r.$key, Samples);
      const enc = s.enc?.value;
      const contentHash = s.contentHash.value;
      const k = sampleKeys[r.$key];
      if (enc && !k) { counts.locked++; retry(r); continue; } // subscription lapsed or not covering it yet
      const open = (hex: string) => (enc ? decrypt(Buffer.from(hex.slice(2), "hex"), Buffer.from(k.slice(2), "hex"), contentHash) : Buffer.from(hex.slice(2), "hex"));
      const reject = (reason: string) => { record("rejected.jsonl", { key: r.$key, reason }); counts.rejected++; };

      const sensors = open(s.sensors.value).toString("utf8");
      const sensorsHash = s.sensorsHash?.value ?? sha256(sensors);
      if (sha256(sensors) !== sensorsHash) { reject("sensors do not match sensorsHash"); continue; }
      const u = { kind: s.kind.value as Kind, mime: s.mime.value, capturedAt: Number(s.capturedAt.value), lat: s.lat.value, lon: s.lon.value };
      const signer = await recoverMessageAddress({ message: signedText(u, contentHash, sensorsHash), signature: s.signature.value }).catch(() => null);
      if (signer?.toLowerCase() !== s.device.value.toLowerCase()) { reject("device signature does not match"); continue; }

      if (!registry.has(s.device.value)) {
        const { entities } = await arkiv.select({ worldId: true }).from(Devices).where(eq("device", addr(s.device.value))).ownedBy(gateway).limit(1).fetch();
        registry.set(s.device.value, entities[0]?.worldId.value ?? null);
      }
      if (registry.get(s.device.value) !== s.worldId.value) { reject("device not registered to this World ID"); continue; }

      const ext = { "image/jpeg": "jpg", "text/plain": "txt" }[u.mime] ?? u.mime.split("/")[1].replace(/[^\w]/g, "");
      const media = join("media", `${contentHash.slice(2)}.${ext}`);
      let data: Buffer;
      if (s.storage.value === "inline") {
        data = open(s.data!.value);
      } else {
        const tmp = file(`${media}.part`);
        rmSync(tmp, { force: true });
        const err = await og.download(s.ogRoot!.value, tmp, true);
        if (err) throw err; // transient: retried next run
        data = open(`0x${readFileSync(tmp).toString("hex")}`);
        rmSync(tmp);
      }
      if (sha256(data) !== contentHash) { reject("payload does not match contentHash"); continue; }
      writeFileSync(`${file(media)}.part`, data);
      renameSync(`${file(media)}.part`, file(media));

      record("samples.jsonl", {
        key: r.$key, dataset: ds, ...u, sensors: JSON.parse(sensors), device: s.device.value, worldId: s.worldId.value,
        deviceType: s.deviceType.value, mac: s.mac.value, geohash: s.geohash.value, contentHash, sensorsHash, storage: s.storage.value,
        ogRoot: s.ogRoot?.value, size: Number(s.size.value), encrypted: !!enc, signature: s.signature.value, file: media,
        ingestedAt: new Date().toISOString(),
      });
      counts.ingested++;
    } catch (e) {
      console.error(`sample ${r.$key}: ${(e as Error).message}`);
      counts.failed++;
      retry(r);
    }
  }
  state.cursors[ds] = next.toString();
}

writeFileSync(file("state.json"), JSON.stringify({ ...state, mode: MODE, lastRun: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ mode: MODE, datasets: DATASETS.length, ...counts, out: OUT }));
