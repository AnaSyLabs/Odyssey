// Turns this laptop (or a Pi) into an Odsy capture node: a persistent device key, webcam photos and mic clips
// captured with ffmpeg, signed and uploaded to the gateway on a loop.
// Run: npm run laptop-node -- [seconds between captures, 0 = once] [--audio] [--sim: skip World ID via REGISTRAR_TOKEN]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, networkInterfaces, platform } from "node:os";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sampleMessage, sha256, type Upload } from "../lib/sample.ts";

const GATEWAY = (process.env.GATEWAY_URL ?? "http://localhost:3000").replace(/\/$/, "");
// shortcut: no GPS, location comes from env or defaults to Bandra West; read CoreLocation/gpsd if nodes start moving.
const LOC = { lat: process.env.NODE_LAT ?? "19.0596", lon: process.env.NODE_LON ?? "72.8295" };
const args = process.argv.slice(2);
const audio = args.includes("--audio");
const every = Number(args.find((a) => !a.startsWith("--")) ?? 60);
if (!Number.isFinite(every) || every < 0) throw new Error("seconds must be a number >= 0");

// The key is the node's identity: keep it across restarts, readable only by this user.
const dir = join(homedir(), ".odsy");
const keyFile = join(dir, "device.key");
if (!existsSync(keyFile)) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(keyFile, generatePrivateKey(), { mode: 0o600 });
}
const device = privateKeyToAccount(readFileSync(keyFile, "utf8").trim() as `0x${string}`);
const mac = Object.values(networkInterfaces()).flat()
  .find((i) => i && !i.internal && i.mac !== "00:00:00:00:00:00")?.mac.toUpperCase() ?? "00:00:00:00:00:01";

const onMac = platform() === "darwin";
// Writes to stdout so nothing touches disk. macOS asks for camera/mic permission for the terminal on first run.
const ffmpeg = (input: string[], output: string[]) =>
  execFileSync("ffmpeg", ["-loglevel", "error", ...input, ...output, "pipe:1"], { maxBuffer: 20 * 1024 * 1024, timeout: 30_000 });
const photo = () => ffmpeg(
  onMac ? ["-f", "avfoundation", "-pixel_format", "uyvy422", "-framerate", "30", "-video_size", "1280x720", "-i", "default"] : ["-f", "v4l2", "-i", "/dev/video0"],
  ["-frames:v", "1", "-f", "mjpeg"],
);
const clip = () => ffmpeg(
  onMac ? ["-f", "avfoundation", "-i", ":default"] : ["-f", "alsa", "-i", "default"],
  ["-t", "5", "-ac", "1", "-ar", "16000", "-f", "wav"],
);

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${GATEWAY}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const registered = async () => (await fetch(`${GATEWAY}/api/devices?device=${device.address}`)).ok;

const time = () => new Date().toTimeString().slice(0, 8);
console.log(`
Odsy laptop node
  address  ${device.address}
  MAC      ${mac}
  key      ${keyFile}
  gateway  ${GATEWAY}
  capture  photo${audio ? " + 5 s audio" : ""}, ${every ? `every ${every} s` : "once"}
`);
if (!(await registered())) {
  if (args.includes("--sim")) {
    // Dev only (needs REGISTRAR_TOKEN): a fake World ID, like the simulator. Real nodes enroll below.
    const reg = await post(
      "/api/devices",
      { device: device.address, worldId: sha256(device.address), deviceType: "laptop", mac, ...(process.env.SIM_PAYOUT_ADDRESS && { payout: process.env.SIM_PAYOUT_ADDRESS }) },
      { authorization: `Bearer ${process.env.REGISTRAR_TOKEN}` },
    );
    if (reg.status !== 201 && reg.status !== 409) {
      console.error(`Registration failed (${reg.status}): ${reg.body?.error ?? JSON.stringify(reg.body)}`);
      process.exit(1);
    }
    console.log("Registered with a simulated World ID (--sim).\n");
  } else {
    console.log(`Not enrolled yet. Open this link, sign in and verify with World ID:\n\n  ${GATEWAY}/enroll?device=${device.address}&mac=${mac}&type=laptop\n\nWaiting for enrollment...`);
    while (!(await registered())) await new Promise((r) => setTimeout(r, 5000));
    console.log("Enrolled.\n");
  }
}

async function upload(kind: "image" | "audio", mime: string, data: Buffer) {
  const u: Omit<Upload, "data" | "signature"> = {
    kind, mime, capturedAt: Math.floor(Date.now() / 1000), ...LOC,
    sensors: JSON.stringify({ source: "laptop", platform: platform() }),
  };
  const signature = await device.signMessage({ message: sampleMessage(u, sha256(data)) });
  const res = await post("/api/ingest", { ...u, data: data.toString("base64"), signature });
  const size = `${(data.length / 1024).toFixed(1)} KB`.padStart(9);
  console.log(res.status === 201
    ? `${time()}  ${kind.padEnd(5)} ${size}  uploaded  ${res.body.entityKey}`
    : `${time()}  ${kind.padEnd(5)} ${size}  FAILED ${res.status}: ${res.body?.error ?? JSON.stringify(res.body)}`);
}

do {
  try {
    await upload("image", "image/jpeg", photo());
    if (audio) await upload("audio", "audio/wav", clip());
  } catch (e) {
    console.error(`${time()}  capture failed: ${(e as Error).message}`); // keep running: a busy camera or a gateway blip is not fatal
  }
  if (every) await new Promise((r) => setTimeout(r, every * 1000));
} while (every);
