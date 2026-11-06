// MCP (Model Context Protocol) core: bearer tokens, keyword ranking and the JSON-RPC dispatcher.
// Pure (no Next, no network) so node --test can run it; the tools themselves live in lib/mcp.ts.
import { readSession, signSession } from "./token.ts";

const TOKEN_DAYS = 7; // shortcut: stateless tokens cannot be revoked; they just expire. Rotate SESSION_SECRET to kill all, or add a revocation list.
const tokenSecret = (secret: string) => `${secret}:mcp`; // a session cookie is never a valid MCP token, and vice versa

export const mintToken = (address: `0x${string}`, secret: string, now = Date.now() / 1000) => {
  const exp = Math.floor(now) + TOKEN_DAYS * 86_400;
  return { token: signSession({ address, exp }, tokenSecret(secret)), exp };
};

/** The wallet a bearer token was minted for, or null when it is missing, forged or expired. */
export const readToken = (header: string | null, secret: string, now = Date.now() / 1000) =>
  readSession(header?.match(/^Bearer (.+)$/)?.[1], tokenSecret(secret), now)?.address ?? null;

// ---- retrieval ----

const words = (t: string): string[] => t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** BM25 over the given documents, best first. Keyword retrieval only: no embeddings, so "car" does not find "vehicle". */
export function rank<T extends { text: string }>(query: string, docs: T[], k: number) {
  const q = [...new Set(words(query))];
  const toks = docs.map((d) => words(d.text));
  const avg = toks.reduce((n, t) => n + t.length, 0) / (docs.length || 1) || 1;
  const df = new Map<string, number>(q.map((w): [string, number] => [w, toks.filter((t) => t.includes(w)).length]));
  return docs
    .map((doc, i) => {
      const score = q.reduce((sum, w) => {
        const tf = toks[i].filter((x) => x === w).length;
        if (!tf) return sum;
        const idf = Math.log(1 + (docs.length - df.get(w)! + 0.5) / (df.get(w)! + 0.5));
        return sum + (idf * tf * 2.2) / (tf + 1.2 * (0.25 + (0.75 * toks[i].length) / avg));
      }, 0);
      return { doc, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// ---- JSON-RPC ----

export type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const err = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

/** One JSON-RPC message in, one reply out; null for notifications (HTTP 202). Stateless: no sessions, no streaming. */
export async function handleRpc(msg: Rpc, tools: Tool[]) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return err(msg?.id ?? null, -32600, "invalid request");
  if (msg.id === undefined) return null; // notification, e.g. notifications/initialized
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion);
      return ok(msg.id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "odyssey", version: "0.1.0" },
        instructions: "Search and read the Odyssey datasets this wallet has subscribed to. Start with list_datasets.",
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, { tools: tools.map(({ run, ...t }) => t) });
    case "tools/call": {
      const tool = tools.find((t) => t.name === msg.params?.name);
      if (!tool) return err(msg.id, -32602, `unknown tool ${String(msg.params?.name)}`);
      try {
        const out = await tool.run((msg.params?.arguments as Record<string, unknown>) ?? {});
        return ok(msg.id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        return ok(msg.id, { isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] });
      }
    }
    default:
      return err(msg.id, -32601, `method not found: ${msg.method}`);
  }
}
