// Session tokens: base64url(JSON) + "." + HMAC-SHA256. Pure, so it can be unit-tested outside Next.
import { createHmac, timingSafeEqual } from "node:crypto";

export type Session = { address: `0x${string}`; exp: number };

const mac = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function signSession(s: Session, secret: string): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

export function readSession(token: string | undefined, secret: string, now = Date.now() / 1000): Session | null {
  const [body, sig] = token?.split(".") ?? [];
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body, secret));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
  return s.exp > now ? s : null;
}
