"use client";
import { useState } from "react";
import { LuBot, LuCopy } from "react-icons/lu";

/** Mints a bearer token for /api/mcp and shows how to plug it into an MCP client. The token is shown once. */
export default function McpAccess() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/api/mcp`;

  async function mint() {
    setError("");
    const res = await fetch("/api/mcp/token", { method: "POST" });
    const b = await res.json().catch(() => ({}));
    if (res.ok) setToken(b.token);
    else setError(b.error ?? `failed (${res.status})`);
  }
  const config = JSON.stringify({ mcpServers: { odyssey: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);

  return (
    <section className="glass space-y-3 p-4 text-sm" aria-label="MCP access">
      <div className="flex flex-wrap items-center gap-3">
        <LuBot size={18} />
        <p className="flex-1 min-w-60">
          <b>Use your datasets in an AI tool.</b> <span className="muted">Search and read what you have subscribed to from Claude, Cursor or any MCP client.</span>
        </p>
        <button className="btn" onClick={mint}>{token ? "New token" : "Create token"}</button>
      </div>
      {error && <p className="text-[var(--st-red,#f87171)]">{error}</p>}
      {token && (
        <div className="space-y-2">
          <p className="muted">Valid for 7 days. Copy it now; it is not shown again. Anyone with it can read your subscribed datasets.</p>
          <pre className="mono overflow-x-auto rounded-lg bg-[var(--st-3)] p-3 text-xs">{config}</pre>
          <button className="btn" onClick={() => navigator.clipboard.writeText(config)}><LuCopy size={14} />Copy config</button>
        </div>
      )}
    </section>
  );
}
