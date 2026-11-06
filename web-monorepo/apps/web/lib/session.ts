import "server-only";
import { cookies } from "next/headers";
import { isAdmin } from "@/lib/admins";
import { need } from "@/lib/arkiv";
import { readSession, type Session, signSession } from "@/lib/token";

export const SESSION_COOKIE = "odsy_session";
export const NONCE_COOKIE = "odsy_nonce";
export const SESSION_DAYS = 7;

/** The signed-in wallet, or null. */
export async function getSession(): Promise<(Session & { admin: boolean }) | null> {
  const s = readSession((await cookies()).get(SESSION_COOKIE)?.value, need("SESSION_SECRET"));
  return s && { ...s, admin: await isAdmin(s.address) };
}

export async function startSession(address: `0x${string}`) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86_400;
  (await cookies()).set(SESSION_COOKIE, signSession({ address, exp }, need("SESSION_SECRET")), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86_400,
  });
}

export const unauthorized = () => Response.json({ error: "sign in with your wallet first" }, { status: 401 });
