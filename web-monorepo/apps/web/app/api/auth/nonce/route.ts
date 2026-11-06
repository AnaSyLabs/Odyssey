import { cookies } from "next/headers";
import { generateSiweNonce } from "viem/siwe";
import { NONCE_COOKIE } from "@/lib/session";
import { route } from "@/lib/api";

/** Step 1 of Sign-In with Ethereum: a one-time nonce, also kept in an httpOnly cookie to check on verify. */
export const GET = route(async function GET() {
  const nonce = generateSiweNonce();
  (await cookies()).set(NONCE_COOKIE, nonce, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth", maxAge: 600,
  });
  return Response.json({ nonce });
});
