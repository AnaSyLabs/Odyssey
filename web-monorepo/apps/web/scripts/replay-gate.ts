// Replays a folder of images through the capture gate in POST /api/ingest, in filename order, and writes episodes.jsonl.
// Needs a registered device: run `npm run simulate` once and keep its DEVICE_PRIVATE_KEY in .env.
// Run: node --env-file=.env scripts/replay-gate.ts path/to/images [episodes.jsonl]
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { sampleMessage, sha256, type Upload } from "../lib/sample.ts";

const GATEWAY = process.env.GATEWAY_URL ?? "http://localhost:3000";
const [dir, out = "episodes.jsonl"] = process.argv.slice(2);
if (!dir || !process.env.DEVICE_PRIVATE_KEY) throw new Error("usage: replay-gate.ts <images dir> [out.jsonl], with DEVICE_PRIVATE_KEY set");
const device = privateKeyToAccount(process.env.DEVICE_PRIVATE_KEY as `0x${string}`);
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

for (const file of readdirSync(dir).sort().filter((f) => MIME[extname(f).toLowerCase()])) {
  const data = readFileSync(join(dir, file));
  const u: Omit<Upload, "data" | "signature"> = {
    kind: "image", mime: MIME[extname(file).toLowerCase()], capturedAt: Math.floor(Date.now() / 1000),
    lat: "19.0596", lon: "72.8295", sensors: "{}",
  };
  const signature = await device.signMessage({ message: sampleMessage(u, sha256(data)) });
  const res = await fetch(`${GATEWAY}/api/ingest`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...u, data: data.toString("base64"), signature }) });
  const body = await res.json().catch(() => null);
  const verdict = res.status === 503 ? "SAFE-STOP" : body?.decision?.action ?? (res.status === 201 ? "stored (gate off)" : `http ${res.status}`);
  console.log(file.padEnd(28), verdict.padEnd(10), body?.decision?.reason ?? body?.error ?? "", "| 0G req", body?.decision?.requestId ?? "-", "| log", body?.episodeRoot ?? "-");
  appendFileSync(out, JSON.stringify({ file, status: res.status, ...body }) + "\n");
  if (body?.decision?.action === "stop") { console.log("gate said stop: halting the replay, as the glasses would stop recording."); break; }
  if (res.status === 503) { console.log("safe-stop: 0G could not decide; halting."); break; }
}
