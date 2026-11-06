"use client";
import { useState } from "react";
import { LuBot, LuCopy } from "react-icons/lu";
import { useToastError } from "@/components/Toaster";

const TABS = ["Claude Code", "Cursor", "Claude Desktop", "Other"] as const;

/** Mints a bearer token for /api/mcp and shows a paste-ready setup for each client. The server is remote, so nothing is installed or cloned. */
export default function McpAccess() {
  const [token, setToken] = useState("");
  const [, setError] = useToastError();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Claude Code");
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/api/mcp`;

  async function mint() {
    setError("");
    const res = await fetch("/api/mcp/token", { method: "POST" });
    const b = await res.json().catch(() => ({}));
    if (res.ok) setToken(b.token);
    else setError(b.error ?? `failed (${res.status})`);
  }

  const bearer = `Bearer ${token}`;
  const snippet = {
    "Claude Code": [
      "# Option A: the CLI",
      `claude mcp add --transport http odyssey ${url} --header "Authorization: ${bearer}"`,
      "",
      "# Option B, no CLI: export the token, and save this as .mcp.json in your project",
      `export ODYSSEY_TOKEN=${token}`,
      JSON.stringify({ mcpServers: { odyssey: { type: "http", url, headers: { Authorization: "Bearer ${ODYSSEY_TOKEN}" } } } }, null, 2),
    ].join("\n"),
    Cursor: JSON.stringify({ mcpServers: { odyssey: { url, headers: { Authorization: bearer } } } }, null, 2),
    // Claude Desktop only launches local commands, so mcp-remote (run by npx, needs Node) bridges to the hosted server.
    "Claude Desktop": JSON.stringify(
      { mcpServers: { odyssey: { command: "npx", args: ["-y", "mcp-remote", url, "--header", "Authorization:${ODYSSEY_AUTH}"], env: { ODYSSEY_AUTH: bearer } } } },
      null,
      2,
    ),
    Other: `POST ${url}\nAuthorization: ${bearer}\nContent-Type: application/json\n\n{"jsonrpc":"2.0","id":1,"method":"tools/list"}`,
  }[tab];
  const where = {
    "Claude Code": "Option A needs the claude command in your terminal. Option B only needs a file, and keeps the token out of it.",
    Cursor: "Save as .cursor/mcp.json in your project, or ~/.cursor/mcp.json for every project.",
    "Claude Desktop": "Add to claude_desktop_config.json (Settings → Developer → Edit Config), then restart. Needs Node.js.",
    Other: "Any MCP client that speaks streamable HTTP and can set a header. Or call it directly:",
  }[tab];

  return (
    <section className="glass space-y-3 p-4 text-sm" aria-label="MCP access">
      <div className="flex flex-wrap items-center gap-3">
        <LuBot size={18} />
        <p className="min-w-60 flex-1">
          <b>Use your datasets in an AI tool.</b> <span className="muted">Search and read what you have subscribed to from Claude, Cursor or any MCP client. Nothing to install or clone.</span>
        </p>
        <button className="btn" onClick={mint}>{token ? "New token" : "Create token"}</button>
      </div>
      {token && (
        <div className="space-y-2">
          <p className="muted">Valid for 7 days. Copy it now; it is not shown again. Anyone with it can read your subscribed datasets.</p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Client">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={`btn ${tab === t ? "primary" : ""}`} onClick={() => { setTab(t); setCopied(false); }}>{t}</button>
            ))}
          </div>
          <p className="muted">{where}</p>
          <pre className="mono overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--st-3)] p-3 text-xs">{snippet}</pre>
          <button className="btn" onClick={() => navigator.clipboard.writeText(snippet).then(() => setCopied(true))}><LuCopy size={14} />{copied ? "Copied" : "Copy"}</button>
        </div>
      )}
    </section>
  );
}
