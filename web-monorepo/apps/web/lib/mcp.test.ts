import assert from "node:assert/strict";
import test from "node:test";
import { handleRpc, mintToken, rank, readToken, type Tool } from "./mcp-core.ts";

const ADDR = "0x51f18a28F4C17121770782aC95B9baAf6257053a" as const;
const echo: Tool = { name: "echo", description: "e", inputSchema: { type: "object" }, run: async (a) => ({ got: a }) };
const boom: Tool = { name: "boom", description: "b", inputSchema: { type: "object" }, run: async () => { throw new Error("nope"); } };

test("a minted token reads back the wallet; wrong secret, expiry and session-style tokens are rejected", () => {
  const { token, exp } = mintToken(ADDR, "s3cret", 1_000);
  assert.equal(readToken(`Bearer ${token}`, "s3cret", 1_001), ADDR);
  assert.equal(readToken(`Bearer ${token}`, "other", 1_001), null);
  assert.equal(readToken(`Bearer ${token}`, "s3cret", exp + 1), null);
  assert.equal(readToken(token, "s3cret", 1_001), null); // no "Bearer " prefix
  assert.equal(readToken(null, "s3cret"), null);
});

test("rank puts the sample with the rarer matching words first and drops non-matches", () => {
  const docs = [{ text: "temperature 31 humidity 70 at the market" }, { text: "street vendor sells mangoes near the station" }, { text: "the the the" }];
  const r = rank("mangoes station", docs, 5);
  assert.equal(r.length, 1);
  assert.equal(r[0].doc, docs[1]);
  assert.deepEqual(rank("", docs, 5), []);
});

test("initialize echoes a supported version, falls back otherwise, and notifications get no reply", async () => {
  const a = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } }, [echo])) as any;
  assert.equal(a.result.protocolVersion, "2024-11-05");
  const b = (await handleRpc({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999" } }, [echo])) as any;
  assert.equal(b.result.protocolVersion, "2025-06-18");
  assert.equal(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, [echo]), null);
});

test("tools/list hides run, tools/call returns text content and turns throws into isError", async () => {
  const list = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, [echo])) as any;
  assert.deepEqual(Object.keys(list.result.tools[0]).sort(), ["description", "inputSchema", "name"]);
  const call = (await handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "echo", arguments: { x: 1 } } }, [echo, boom])) as any;
  assert.deepEqual(JSON.parse(call.result.content[0].text), { got: { x: 1 } });
  const bad = (await handleRpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "boom" } }, [echo, boom])) as any;
  assert.equal(bad.result.isError, true);
  assert.equal(bad.result.content[0].text, "nope");
});

test("unknown tool, unknown method and malformed requests get JSON-RPC errors", async () => {
  assert.equal(((await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "x" } }, [echo])) as any).error.code, -32602);
  assert.equal(((await handleRpc({ jsonrpc: "2.0", id: 2, method: "resources/list" }, [echo])) as any).error.code, -32601);
  assert.equal(((await handleRpc({ id: 3 } as never, [echo])) as any).error.code, -32600);
});
