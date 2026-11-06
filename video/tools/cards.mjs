// Renders the placeholder cards for clips the team still has to film live (1920x1080 PNGs).
import { chromium } from "playwright-core";

const CARDS = {
  "02b": {
    title: "Real glasses capturing",
    what: ["A teammate taps capture on the glasses.", "The OLED shows REC, then SIGNED.", "Cut to /capture as the new photo appears."],
    how: "Film with a laptop webcam or a camera, not a phone. About 7 seconds.",
  },
  "06b": {
    title: "Claude answering over MCP",
    what: ["Claude Desktop or Claude Code, connected with a lab wallet's MCP token.", "Type: “What was captured near Bandra today?”", "Let it call list_datasets, search_samples, get_sample and answer."],
    how: "Screen-record at 1080p. About 13 seconds; trim the waiting.",
  },
};

const html = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1920px;height:1080px;background:#0b0b0b;color:#f4f4f4;font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;display:grid;place-items:center}
  .card{width:1320px;border:2px dashed #c5f467;border-radius:40px;padding:72px 88px}
  .tag{display:inline-block;background:#c5f467;color:#07090e;font-weight:700;letter-spacing:.12em;font-size:26px;padding:10px 22px;border-radius:999px}
  h1{font-size:72px;margin:36px 0 28px;font-weight:600;letter-spacing:-.01em}
  li{font-size:36px;line-height:1.5;color:#e6e6e6}
  ul{margin:0 0 36px;padding-left:40px}
  p{font-size:30px;color:#a0a0a0;margin:0}
</style></head><body><div class="card">
  <span class="tag">LIVE CLIP TO RECORD</span>
  <h1>${c.title}</h1>
  <ul>${c.what.map((w) => `<li>${w}</li>`).join("")}</ul>
  <p>${c.how}</p>
</div></body></html>`;

const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [k, c] of Object.entries(CARDS)) {
  await p.setContent(html(c));
  await p.screenshot({ path: new URL(`./card-${k}.png`, import.meta.url).pathname });
  console.log(`card-${k}.png`);
}
await b.close();
