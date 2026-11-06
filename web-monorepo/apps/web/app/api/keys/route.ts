import { keyFor, loadSample, readAccess } from "@/lib/access";
import { getSession, unauthorized } from "@/lib/session";

/**
 * Per-sample decryption keys for a signed-in lab: POST {"keys": [entityKey, ...]} (max 100).
 * The lab fetches ciphertext from Arkiv/0G itself and decrypts locally (scripts/lab-ingest.ts).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  const b = await req.json().catch(() => null);
  if (!Array.isArray(b?.keys) || b.keys.length > 100) return Response.json({ error: "keys: array of up to 100 entity keys" }, { status: 400 });

  const canRead = await readAccess(session);
  const keys: Record<string, string> = {};
  const denied: string[] = [];
  for (const k of b.keys) {
    const s = await loadSample(String(k));
    if (s?.enc?.value && (await canRead(s))) keys[s.$key] = `0x${keyFor(s.contentHash.value).toString("hex")}`;
    else denied.push(String(k));
  }
  return Response.json({ keys, denied });
}
