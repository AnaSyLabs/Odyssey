import "server-only";
import { addr } from "@arkiv-network/sdk/schema";
import { activeSubscriptions, hexBytes, loadSample, open, readAccess } from "@/lib/access";
import { arkivPublic, gatewayAddress } from "@/lib/arkiv";
import { datasetFilter } from "@/lib/filters";
import { rank, type Tool } from "@/lib/mcp-core";
import { findSamples } from "@/lib/query";
import { Datasets } from "@/lib/schema";
import { isAdmin } from "@/lib/admins";

// shortcut: ranks the newest MAX_DOCS text/sensor samples of a dataset per query; add an index or embeddings when datasets outgrow that.
const MAX_DOCS = 100;
const MAX_CHARS = 20_000;
const TEXTUAL = new Set(["text", "sensor"]);

type Row = NonNullable<Awaited<ReturnType<typeof loadSample>>>;

/** What a language model can read from a sample: its text payload (inline only) and its sensor JSON. */
function textOf(s: Row) {
  const enc = s.enc?.value;
  const hash = s.contentHash.value;
  const parts: string[] = [];
  if (s.data && s.mime.value.startsWith("text/")) parts.push(open(hexBytes(s.data.value), enc, hash).toString("utf8"));
  parts.push(open(hexBytes(s.sensors.value), enc, hash).toString("utf8"));
  return parts.join("\n");
}

const meta = (s: Row) => ({
  key: s.$key, kind: s.kind.value, capturedAt: new Date(Number(s.capturedAt.value) * 1000).toISOString(),
  lat: s.lat.value, lon: s.lon.value, contentHash: s.contentHash.value,
});

/** The three tools, bound to one wallet. Everything goes through readAccess, the same check as the web app. */
export async function toolsFor(address: `0x${string}`): Promise<Tool[]> {
  const session = { address, admin: await isAdmin(address) };
  return [
    {
      name: "list_datasets",
      description: "List the datasets this wallet has an active subscription for: key, name, area, and when access ends.",
      inputSchema: { type: "object", properties: {} },
      run: async () =>
        (await activeSubscriptions(address)).map((d) => ({ key: d.key, name: d.name, paidUntil: new Date(d.paidUntil * 1000).toISOString(), area: d.filter })),
    },
    {
      name: "search_samples",
      description:
        "Keyword search over the text and sensor samples of one subscribed dataset. Returns the best matches with a snippet, location, time and content hash. Use get_sample for the full text.",
      inputSchema: {
        type: "object",
        properties: {
          dataset: { type: "string", description: "Dataset key from list_datasets (0x + 64 hex)" },
          query: { type: "string", description: "Words to look for" },
          limit: { type: "number", description: "Results to return, 1 to 10 (default 5)" },
          from: { type: "number", description: "Only samples captured at or after this unix time" },
          to: { type: "number", description: "Only samples captured at or before this unix time" },
        },
        required: ["dataset", "query"],
      },
      run: async (a) => {
        const key = String(a.dataset).toLowerCase();
        let filter = (await activeSubscriptions(address)).find((d) => d.key.toLowerCase() === key)?.filter;
        if (!filter && session.admin) {
          const d = await arkivPublic().getEntity(key as `0x${string}`, Datasets).catch(() => null);
          if (d && d.$owner.toLowerCase() === gatewayAddress().toLowerCase()) filter = datasetFilter(d);
        }
        if (!filter) throw new Error("no active subscription for that dataset");
        const from = Math.max(Number(a.from) || 0, filter.fromTs ?? 0);
        const to = Number(a.to) || filter.toTs || 0;
        const { hits } = await findSamples({ ...filter, fromTs: from, toTs: to });
        const newest = hits.filter((h) => TEXTUAL.has(h.kind)).sort((x, y) => y.capturedAt - x.capturedAt).slice(0, MAX_DOCS);
        const canRead = await readAccess(session);
        const docs = (
          await Promise.all(
            newest.map(async (h) => {
              const s = await loadSample(h.key);
              if (!s || !(await canRead(s))) return null;
              try {
                return { s, text: textOf(s) };
              } catch {
                return null; // e.g. written under another DATA_KEY: skip it instead of failing the whole search
              }
            }),
          )
        ).filter((d) => d !== null);
        const k = Math.min(Math.max(Number(a.limit) || 5, 1), 10);
        return {
          searched: docs.length,
          results: rank(String(a.query), docs, k).map(({ doc, score }) => ({ ...meta(doc.s), score: Math.round(score * 100) / 100, snippet: doc.text.slice(0, 500) })),
        };
      },
    },
    {
      name: "get_sample",
      description: "Read one sample in full: metadata and, for text and sensor samples, the decrypted content. Needs a subscription that covers it.",
      inputSchema: { type: "object", properties: { key: { type: "string", description: "Sample key (0x + 64 hex)" } }, required: ["key"] },
      run: async (a) => {
        const s = await loadSample(String(a.key));
        if (!s) throw new Error("sample not found");
        if (!(await (await readAccess(session))(s))) throw new Error("no subscription covers this sample");
        const kind = s.kind.value;
        if (!TEXTUAL.has(kind)) return { ...meta(s), content: null, note: `${kind} samples are not returned as text; download them through the web app` };
        if (!s.data && s.storage.value === "0g") return { ...meta(s), content: null, note: "payload is stored on 0G and is not returned here" };
        return { ...meta(s), content: textOf(s).slice(0, MAX_CHARS) };
      },
    },
  ];
}
