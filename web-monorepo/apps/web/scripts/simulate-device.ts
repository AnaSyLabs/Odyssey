// Acts like a pair of Odsy glasses: registers its key, then signs and uploads samples to the gateway.
// Run: node --env-file=.env scripts/simulate-device.ts [count] [path/to/photo.jpg] [--kind text|sensor]
import { readFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sampleMessage, sha256, type Upload } from "../lib/sample.ts";

const GATEWAY = process.env.GATEWAY_URL ?? "http://localhost:3000";
// shortcut: no GPS yet, every capture is pinned to Bandra West, Mumbai; replace with the GPS fix once hardware has one.
const BANDRA = { lat: "19.0596", lon: "72.8295" };

let key = process.env.DEVICE_PRIVATE_KEY as `0x${string}` | undefined;
if (!key) {
  key = generatePrivateKey();
  console.log(`No DEVICE_PRIVATE_KEY, generated one. Save it to reuse this device:\nDEVICE_PRIVATE_KEY=${key}`);
}
const device = privateKeyToAccount(key);
const args = process.argv.slice(2);
const kindAt = args.indexOf("--kind");
const kind = kindAt >= 0 ? args.splice(kindAt, 2)[1] : "text";
if (kind !== "text" && kind !== "sensor") throw new Error("--kind must be text or sensor (pass a photo path for an image)");
const count = Number(args[0] ?? 3);
const photo = args[1];

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${GATEWAY}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// Stands in for the World ID registration page.
if (!process.env.SIM_PAYOUT_ADDRESS) throw new Error("Set SIM_PAYOUT_ADDRESS in .env: the wallet of the device owner, which receives this device's rewards");
const reg = await post(
  "/api/devices",
  {
    device: device.address,
    worldId: process.env.SIM_WORLD_ID ?? sha256(device.address), // fake nullifier, unique per sim device
    deviceType: "esp32-cam-glasses",
    mac: process.env.SIM_MAC ?? "24:0A:C4:00:00:01",
    payout: process.env.SIM_PAYOUT_ADDRESS, // the device owner's wallet, which gets this device's rewards
  },
  { authorization: `Bearer ${process.env.REGISTRAR_TOKEN}` },
);
console.log("register", device.address, reg.status, reg.body);
if (reg.status !== 201 && reg.status !== 409) process.exit(1);

for (let i = 0; i < count; i++) {
  const now = Math.floor(Date.now() / 1000);
  const sensors = JSON.stringify({ tempC: 27 + Math.random() * 4, humidity: 70 + Math.random() * 10, imu: { ax: 0.01, ay: -0.02, az: 9.81 } });
  const isPhoto = photo && i === 0;
  // A sensor sample's payload is a weather reading, like a station on the glasses would log.
  const reading = { at: new Date().toISOString(), tempC: 26 + Math.random() * 6, humidity: 65 + Math.random() * 20, pressureHpa: 1005 + Math.random() * 10, pm25: 30 + Math.random() * 60 };
  const data = isPhoto ? readFileSync(photo)
    : kind === "sensor" ? Buffer.from(JSON.stringify(reading))
    : Buffer.from(`note ${i} from ${device.address} at ${new Date().toISOString()}`);
  const u: Omit<Upload, "data" | "signature"> = {
    kind: isPhoto ? "image" : kind,
    mime: isPhoto ? "image/jpeg" : kind === "sensor" ? "application/json" : "text/plain",
    capturedAt: now,
    ...BANDRA,
    sensors,
  };
  const signature = await device.signMessage({ message: sampleMessage(u, sha256(data)) });
  const res = await post("/api/ingest", { ...u, data: data.toString("base64"), signature });
  console.log("ingest", i, res.status, res.body);
}

const near = await fetch(`${GATEWAY}/api/samples?lat=${BANDRA.lat}&lon=${BANDRA.lon}&radius=500&limit=5`).then((r) => r.json());
console.log("near Bandra", JSON.stringify(near, null, 2));
