import { need } from "@/lib/arkiv";
import { handleRpc, readToken } from "@/lib/mcp-core";
import { toolsFor } from "@/lib/mcp";

/**
 * MCP server over streamable HTTP (stateless, JSON replies). Point any MCP client at this URL with
 * `Authorization: Bearer <token>`; mint the token in the app (POST /api/mcp/token). Tools: list_datasets,
 * search_samples, get_sample, limited to what the token's wallet has subscribed to.
 */
export async function POST(req: Request) {
  const address = readToken(req.headers.get("authorization"), need("SESSION_SECRET"));
  if (!address) return Response.json({ error: "missing or invalid bearer token" }, { status: 401, headers: { "www-authenticate": "Bearer" } });
  const body = await req.json().catch(() => null);
  const tools = await toolsFor(address);
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((m) => handleRpc(m, tools)))).filter((r) => r !== null);
    return replies.length ? Response.json(replies) : new Response(null, { status: 202 });
  }
  const reply = await handleRpc(body, tools);
  return reply ? Response.json(reply) : new Response(null, { status: 202 });
}

// No server-initiated stream: clients that probe with GET get 405 and fall back to POST only.
export const GET = () => new Response(null, { status: 405, headers: { allow: "POST" } });
