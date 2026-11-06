import { cookies } from "next/headers";
import { isHex, recoverMessageAddress } from "viem";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { isAdmin } from "@/lib/admins";
import { NONCE_COOKIE, startSession } from "@/lib/session";
import { fail, route } from "@/lib/api";

/** Step 2 of Sign-In with Ethereum: check the signed message, then set the session cookie. */
export const POST = route(async function POST(req: Request) {
  const jar = await cookies();
  const nonce = jar.get(NONCE_COOKIE)?.value;
  jar.delete({ name: NONCE_COOKIE, path: "/api/auth" });
  const b = await req.json().catch(() => null);
  if (!nonce || typeof b?.message !== "string" || !isHex(b?.signature)) return fail(401, "missing message, signature or nonce");

  const message = parseSiweMessage(b.message);
  const domain = req.headers.get("host") ?? "";
  if (!message.address || !validateSiweMessage({ message, domain, nonce })) return fail(401, "message is expired, for another site, or reused");
  // shortcut: EOA wallets only (ecrecover); smart-contract wallets need ERC-1271 via viem's verifySiweMessage.
  const signer = await recoverMessageAddress({ message: b.message, signature: b.signature }).catch(() => null);
  if (signer?.toLowerCase() !== message.address.toLowerCase()) return fail(401, "signature does not match the address");

  await startSession(message.address);
  return Response.json({ address: message.address, admin: await isAdmin(message.address) });
});
