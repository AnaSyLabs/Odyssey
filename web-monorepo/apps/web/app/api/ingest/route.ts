import { ExpirationTime } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { addr, dec, u64 } from "@arkiv-network/sdk/schema";
import { isHex, recoverMessageAddress } from "viem";
import { keyFor } from "@/lib/access";
import { raiseAlert, isBanned } from "@/lib/consensus";
import { arkivPublic, arkivWallet, findDevice, gatewayAddress, Samples } from "@/lib/arkiv";
import { ENC, encrypt } from "@/lib/crypto";
import { gate, gateEnabled, logEpisode } from "@/lib/gate";
import { GateUnavailable } from "@/lib/gate-core";
import { geohash } from "@/lib/geo";
import { uploadTo0G } from "@/lib/og";
import { KINDS, sampleMessage, sha256, type Upload } from "@/lib/sample";

const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);
// Arkiv allows 128 KiB of bytes per entity; leave room for sensors and signature. Measured after encryption.
const INLINE_MAX = 96 * 1024;
const DECIMAL = /^-?\d{1,3}(\.\d{1,9})?$/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Device upload: verify signature and registration, store payload, write a readonly Arkiv entity. */
export async function POST(req: Request) {
  // Base64 grows the body by 4/3.
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD * 1.4 + 8192) return fail(413, "payload too large");
  const u: Upload | null = await req.json().catch(() => null);
  if (!u || typeof u !== "object") return fail(400, "body must be JSON");

  if (!KINDS.includes(u.kind)) return fail(400, `kind must be one of ${KINDS.join(", ")}`);
  if (typeof u.mime !== "string" || !/^[\w.+-]+\/[\w.+-]+$/.test(u.mime) || u.mime.length > 100) return fail(400, "bad mime");
  if (!Number.isInteger(u.capturedAt) || u.capturedAt < 1_600_000_000 || u.capturedAt > Date.now() / 1000 + 300)
    return fail(400, "capturedAt must be unix seconds, not in the future");
  if (!DECIMAL.test(u.lat ?? "") || Math.abs(Number(u.lat)) > 90) return fail(400, "lat must be a decimal string in [-90, 90]");
  if (!DECIMAL.test(u.lon ?? "") || Math.abs(Number(u.lon)) > 180) return fail(400, "lon must be a decimal string in [-180, 180]");
  if (typeof u.sensors !== "string" || u.sensors.length > 4096) return fail(400, "sensors must be JSON text up to 4 KiB");
  try {
    if (typeof JSON.parse(u.sensors) !== "object") throw 0;
  } catch {
    return fail(400, "sensors must be a JSON object");
  }
  if (typeof u.data !== "string" || u.data.length % 4 || !BASE64.test(u.data)) return fail(400, "data must be base64");
  const data = Buffer.from(u.data, "base64");
  if (!data.length || data.length > MAX_UPLOAD) return fail(413, `data must be 1..${MAX_UPLOAD} bytes`);
  if (!isHex(u.signature) || u.signature.length !== 132) return fail(400, "signature must be 65 bytes hex");

  const contentHash = sha256(data);
  const device = await recoverMessageAddress({ message: sampleMessage(u, contentHash), signature: u.signature }).catch(() => null);
  if (!device) return fail(400, "bad signature");
  const reg = await findDevice(device);
  if (!reg) return fail(403, `device ${device} is not registered`);
  if (await isBanned(reg.worldId.value)) return fail(403, "this World ID is banned");

  const gateway = gatewayAddress();
  const dup = await arkivPublic()
    .select({ $key: true, worldId: true }).from(Samples).where(eq("contentHash", contentHash)).ownedBy(gateway).limit(1).fetch();
  // shortcut: two identical uploads in the same block can both pass; add a lock if devices retry aggressively.
  // A clip another human already uploaded is a replay: provable, so a strike. The same device retrying is not.
  if (dup.entities.length && dup.entities[0].worldId.value !== reg.worldId.value) await raiseAlert(reg.worldId.value, "replay", contentHash);
  if (dup.entities.length) return Response.json({ error: "duplicate", entityKey: dup.entities[0].$key }, { status: 409 });

  // Capture gate: a 0G vision model decides capture / skip / stop for each image. If 0G cannot answer we stop
  // and store nothing; there is no local fallback decision.
  let decision, episode;
  if (gateEnabled() && u.kind === "image") {
    const base = { device, contentHash };
    try {
      decision = await gate({ data, mime: u.mime, kind: u.kind });
    } catch (e) {
      if (!(e instanceof GateUnavailable)) throw e;
      console.error("capture gate safe-stop:", e.message);
      return Response.json({ error: "safe-stop: capture gate unavailable, nothing stored", detail: e.message }, { status: 503, headers: { "retry-after": "30" } });
    }
    if (decision.action !== "capture") {
      const episodeRoot = await logEpisode({ ...base, ...decision, outcome: decision.action === "stop" ? "stopped" : "skipped" });
      return Response.json({ stored: false, decision, episodeRoot });
    }
    episode = base;
  }

  // Encrypted before it leaves the gateway; subscribers get the per-sample key from /api/keys.
  const key = keyFor(contentHash);
  const sealed = encrypt(data, key, contentHash);
  const inline = sealed.length <= INLINE_MAX;
  const ogRoot = inline ? undefined : await uploadTo0G(sealed);
  const { entityKey, txHash, expiresAt } = await arkivWallet().createEntity(
    Samples,
    {
      device: addr(device),
      worldId: reg.worldId.value,
      deviceType: reg.deviceType.value,
      mac: reg.mac.value,
      kind: u.kind,
      capturedAt: u64(u.capturedAt),
      lat: dec(u.lat),
      lon: dec(u.lon),
      geohash: geohash(Number(u.lat), Number(u.lon)),
      contentHash,
      storage: inline ? "inline" : "0g",
      ...(ogRoot && { ogRoot }),
      mime: u.mime,
      size: u64(data.length),
      sensors: new Uint8Array(encrypt(Buffer.from(u.sensors), key, contentHash)),
      sensorsHash: sha256(u.sensors),
      enc: ENC,
      signature: Buffer.from(u.signature.slice(2), "hex"),
      ...(inline && { data: new Uint8Array(sealed) }),
    },
    { expiration: ExpirationTime.max(), flags: { readonly: true } },
  );
  const episodeRoot = decision && episode ? await logEpisode({ ...episode, ...decision, outcome: "stored" }) : undefined;
  return Response.json(
    { entityKey, txHash, expiresAt: expiresAt.toString(), device, contentHash, storage: inline ? "inline" : "0g", ogRoot, decision, episodeRoot },
    { status: 201 },
  );
}
