import { hexBytes, loadSample, open, readAccess } from "@/lib/access";
import { downloadFrom0G } from "@/lib/og";
import { sha256 } from "@/lib/sample";
import { getSession } from "@/lib/session";

/** The decrypted payload as a file (inline or from 0G), for wallets with access. Checked against contentHash. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const s = await loadSample(key);
  if (!s) return Response.json({ error: "not found" }, { status: 404 });
  if (s.enc?.value && !(await readAccess(await getSession()))(s)) {
    return Response.json({ error: "subscribe to a dataset that covers this sample" }, { status: 403 });
  }
  const blob = s.data ? hexBytes(s.data.value) : await downloadFrom0G(s.ogRoot!.value);
  const data = open(blob, s.enc?.value, s.contentHash.value);
  if (sha256(data) !== s.contentHash.value) return Response.json({ error: "payload does not match contentHash" }, { status: 502 });
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": s.mime.value,
      "content-disposition": `inline; filename="${s.contentHash.value.slice(2, 18)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox", // device-chosen mime: never run it as a page on our origin
    },
  });
}
