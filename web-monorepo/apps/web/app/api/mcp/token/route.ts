import { need } from "@/lib/arkiv";
import { mintToken } from "@/lib/mcp-core";
import { getSession, unauthorized } from "@/lib/session";
import { route } from "@/lib/api";

/** A signed-in wallet gets a bearer token for /api/mcp, valid 7 days. Shown once; mint a new one any time. */
export const POST = route(async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();
  const { token, exp } = mintToken(session.address, need("SESSION_SECRET"));
  return Response.json({ token, expiresAt: exp });
});
