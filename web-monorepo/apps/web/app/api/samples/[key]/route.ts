import { recoverMessageAddress } from "viem";
import { hexBytes, loadSample, open, readAccess } from "@/lib/access";
import { type Kind, sha256, signedText } from "@/lib/sample";
import { getSession } from "@/lib/session";

/**
 * One sample. Anyone gets the metadata and a re-checked device signature. A wallet with access (admin, or a
 * subscription whose dataset covers the sample) also gets the decrypted sensors and, for inline payloads, the data.
 * 0G payloads: GET /api/samples/{key}/data.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const s = await loadSample(key);
  if (!s) return Response.json({ error: "not found, expired, or not written by this gateway" }, { status: 404 });

  const enc = s.enc?.value;
  const contentHash = s.contentHash.value;
  const readable = !enc || (await readAccess(await getSession()))(s);
  const sensors = readable ? open(hexBytes(s.sensors.value), enc, contentHash).toString("utf8") : undefined;
  const sensorsHash = s.sensorsHash?.value ?? sha256(sensors!); // legacy plaintext samples carry the sensors themselves
  const u = { kind: s.kind.value as Kind, mime: s.mime.value, capturedAt: Number(s.capturedAt.value), lat: s.lat.value, lon: s.lon.value };
  const signer = await recoverMessageAddress({ message: signedText(u, contentHash, sensorsHash), signature: s.signature.value }).catch(() => null);
  const data = readable && s.data ? open(hexBytes(s.data.value), enc, contentHash) : undefined;

  return Response.json({
    key,
    owner: s.$owner,
    createdAtBlock: s.$createdAt?.toString(),
    expiresAtBlock: s.$expiresAt.toString(),
    ...u,
    device: s.device.value,
    worldId: s.worldId.value,
    deviceType: s.deviceType.value,
    mac: s.mac.value,
    geohash: s.geohash.value,
    contentHash,
    sensorsHash,
    storage: s.storage.value,
    ogRoot: s.ogRoot?.value,
    size: Number(s.size.value),
    encrypted: !!enc,
    signature: s.signature.value,
    readable,
    sensors: sensors && JSON.parse(sensors),
    data: data?.toString("base64"),
    verified: {
      signature: signer?.toLowerCase() === s.device.value.toLowerCase(),
      contentHash: data ? sha256(data) === contentHash : null,
      sensorsHash: sensors ? sha256(sensors) === sensorsHash : null,
    },
  });
}
