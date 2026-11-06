// Records the screen takes for the demo video from the production site.
// Each take: a 2880x1620 master (2x, so zooms stay sharp) plus a JSON of camera targets ("focus" boxes) for zoom.py.
// Capture pauses during page loads, so no loading screens end up in the footage.
// Usage: node rec.mjs [take numbers...]
import { chromium } from "playwright-core";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SITE = "https://odyssey-blush-seven.vercel.app";
const SAMPLE = "0x6ba287b452679b3253c29f1bfbd30fe2fcda1c4b95c06d17988211b8edcbd310"; // a real JPEG from the glasses (MAC 38:3E:51:C2:98:54)
const SUBS = "0xc3a946516f2f0CE3fc2065543cb0a8E9b105A54e";
const CONSENSUS = "0x83bea227e5D2C72f8F0F73E63175759D4E6055DC";
const OUT = new URL("./takes/", import.meta.url).pathname;
const W = 1440, H = 810, DSF = 2; // CSS viewport; frames are 2880x1620
mkdirSync(OUT, { recursive: true });
// STRETCH (JSON {take: factor}, from fit.py) lengthens a take's pauses so it runs as long as its narration
const STRETCH = JSON.parse(process.env.STRETCH ?? "{}");
let stretch = 1;
const wait = (ms) => new Promise((r) => setTimeout(r, ms * stretch));

const CURSOR = `addEventListener("DOMContentLoaded", () => {
  const c = document.createElement("div");
  c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;margin:-3px 0 0 -3px;z-index:2147483647;pointer-events:none;transition:transform .08s";
  c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
  addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
  addEventListener("mousedown", () => (c.style.transform = "scale(.8)"), true);
  addEventListener("mouseup", () => (c.style.transform = ""), true);
});`;

async function take(browser, n, fn) {
  stretch = STRETCH[n] ?? 1;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, colorScheme: "dark" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("odyssey:intro", "1"); document.documentElement.dataset.intro = "off"; } catch {} });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const name = `take-${String(n).padStart(2, "0")}`;
  const dir = `${OUT}${name}-frames/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);

  // effective clock: real time minus the time spent paused on page loads
  let recording = false, paused = 0, pausedAt = Date.now() / 1000, start = null;
  const now = () => Date.now() / 1000 - paused;
  const frames = [], events = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    if (!recording) return;
    const file = `${dir}${String(frames.length).padStart(5, "0")}.jpg`;
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: now() }); // arrival time, on the same pause-adjusted clock as the camera targets
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });
  const rec = (on) => {
    if (on && !recording) { paused += Date.now() / 1000 - pausedAt; recording = true; start ??= now(); }
    if (!on && recording) { pausedAt = Date.now() / 1000; recording = false; }
  };
  const api = {
    page,
    async go(url) {
      rec(false);
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
      await wait(900);
      rec(true);
      // Chrome only sends a frame when the screen changes: nudge the cursor so the loaded page reaches the video
      await page.mouse.move(W / 2 + 3, H / 2 + 3); await page.mouse.move(W / 2, H / 2); await wait(300);
    },
    // camera target for a full-width table row: scroll it to the middle and frame only its name and value cells
    async focusRow(text, zmax = 2.4, pad = 24) {
      const row = page.locator("tr", { hasText: text }).first();
      await row.evaluate((r) => r.scrollIntoView({ block: "center", behavior: "smooth" })).catch(() => {});
      await wait(700);
      const boxes = await row.locator("td").evaluateAll((tds, text) => {
        const r = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
        const value = tds.find((td) => td.textContent.includes(text)) ?? tds.at(-1);
        return [r(tds[0]), r(value)];
      }, text).catch(() => null);
      if (!boxes) return console.warn(`  no row ${text}`);
      const [a, b] = boxes, x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), x1 = Math.max(a[2], b[2]), y1 = Math.max(a[3], b[3]);
      events.push({ t: now() - start, kind: "focus", box: [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad], zmax });
    },
    // camera target: zoom onto this element's box (CSS px), capped at zmax
    async focus(sel, zmax = 1.8, pad = 40) {
      const el = typeof sel === "string" ? page.locator(sel).first() : sel.first();
      const b = await el.boundingBox().catch(() => null);
      if (b) events.push({ t: now() - start, kind: "focus", box: [b.x - pad, b.y - pad, b.width + 2 * pad, b.height + 2 * pad], zmax });
      else console.warn(`  no box for ${sel}`);
    },
    wide() { events.push({ t: now() - start, kind: "wide" }); },
    // wait off-camera (e.g. while a map draws), then nudge so the finished screen reaches the video
    async offCamera(ms) { rec(false); await wait(ms); rec(true); await page.mouse.move(W / 2 + 3, H / 2 + 3); await page.mouse.move(W / 2, H / 2); await wait(300); },
  };
  await page.mouse.move(W / 2, H / 2);
  await fn(api);
  await wait(400);
  const end = now();
  await cdp.send("Page.stopScreencast").catch(() => {});
  await ctx.close();

  // frames carry their own (pause-adjusted) timestamps; the first frame starts the take
  // Chrome sends bursts after a page load; ffmpeg would give each image at least 1/25 s, stretching the take.
  // Keep at most one frame per 1/30 s (the newest), so the footage stays on the same clock as the camera targets.
  const kept = [];
  for (const f of frames) {
    if (kept.length && f.t - kept.at(-1).t < 1 / 30) kept[kept.length - 1] = { ...f, t: kept.at(-1).t };
    else kept.push(f);
  }
  frames.length = 0; frames.push(...kept);
  const t0 = frames[0].t;
  // long still holds are split into <= 0.5 s entries: ffmpeg's concat demuxer mis-times a single long image duration
  const lines = frames.flatMap((f, i) => {
    let d = Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t);
    const out = [];
    while (d > 0.5) { out.push(`file '${f.file}'\nduration 0.5000`); d -= 0.5; }
    out.push(`file '${f.file}'\nduration ${d.toFixed(4)}`);
    return out;
  });
  lines.push(`file '${frames.at(-1).file}'`);
  writeFileSync(`${dir}list.txt`, lines.join("\n"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${dir}list.txt`, "-vf", `fps=30,scale=${W * DSF}:${H * DSF},format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "16", `${OUT}${name}.mp4`]);
  const shift = t0 - start; // events are on the same clock as frames; align them to the video's zero
  writeFileSync(`${OUT}${name}.json`, JSON.stringify({ W, H, DSF, duration: end - t0, events: events.map((e) => ({ ...e, t: Math.max(0, e.t - shift) })) }, null, 1));
  rmSync(dir, { recursive: true, force: true });
  console.log(`${name}: ${frames.length} frames, ${(end - t0).toFixed(1)} s, ${events.length} camera moves`);
}

async function click(page, sel, pause = 600) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
  await wait(250);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await wait(pause);
}
const glide = (page, x, y) => page.mouse.move(x, y, { steps: 30 });
const centre = (page, sel) => page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "center" }), sel);

const TAKES = {
  // 1 · Hook: headline, then the glasses slide apart into the Lineup view.
  1: async ({ page, go, focus, wide }) => {
    await go(SITE + "/");
    await wait(600);
    await focus("h1", 1.5, 60); await wait(3200);
    wide();
    await page.evaluate(() => document.querySelector('[aria-label="Model view"]').parentElement.scrollIntoView({ behavior: "smooth", block: "center" }));
    await wait(1600);
    await focus('[aria-label="Model view"] button:has-text("Lineup")', 2.2, 120);
    await click(page, '[aria-label="Model view"] button:has-text("Lineup")', 900);
    await focus(page.locator('[aria-label="Model view"]').locator("xpath=.."), 1.25, 0); await wait(6000);
  },
  // 2 · The capture device: 3D glasses, then the capture cycle stepping through its states.
  2: async ({ page, go, focus, wide }) => {
    await go(SITE + "/device");
    await focus('section[aria-label="3D model"]', 1.3, 10);
    await glide(page, 500, 420); await page.mouse.down(); await page.mouse.move(700, 400, { steps: 60 }); await page.mouse.up();
    await wait(5500);
    await focus(page.locator('p.eyebrow:has-text("Capture cycle")').locator("xpath=.."), 2.0, 30); await wait(9000);
    wide(); await wait(1500);
  },
  // 3 · Enroll with World ID (demo screen; the World ID step is simulated).
  3: async ({ page, go, focus }) => {
    await go(SITE + "/mockups/enroll");
    await wait(800);
    await focus('section[aria-label="Device identity"]', 1.7, 30);
    await glide(page, 420, 300); await wait(1300); await glide(page, 420, 370); await wait(2200);
    await focus('section[aria-label="World ID binding"]', 1.8, 30);
    await click(page, 'button:has-text("Verify with World ID")', 3200);
    await focus('section[aria-label="World ID binding"]', 1.6, 30); await wait(4500);
  },
  // 4 · Proof: a sample's proof on the demo dataset, then a real photo from the glasses on the Arkiv explorer.
  4: async ({ page, go, focus, focusRow, wide }) => {
    await go(SITE + "/mockups/datasets");
    await click(page, 'section[aria-label="Datasets"] button', 1200);
    await click(page, "aside details summary", 600);
    await focus("aside details", 2.0, 30); await wait(5000);
    wide();
    await go(`https://rabdi.explorer.arkiv.network/entity/${SAMPLE}`);
    await wait(1500);
    await focusRow("esp32-cam-glasses"); await wait(3000);
    await focusRow("aes-256-gcm-v1"); await wait(3000);
    await focusRow("image/jpeg"); await wait(2500);
    await focusRow("worldId", 2.0); await wait(3000);
    wide(); await wait(1200);
  },
  // 5 · A lab pays in 0G (demo), the coverage map, then the real subscriptions contract on 0G Galileo.
  5: async ({ page, go, focus, wide, offCamera }) => {
    await go(SITE + "/mockups/datasets");
    await click(page, 'section[aria-label="Datasets"] button', 1200);
    await focus('aside[aria-label="Dataset details"]', 1.5, 20); await wait(2500);
    await focus('aside button:has-text("Subscribe")', 2.4, 80);
    await click(page, 'aside button:has-text("Subscribe")', 1800);
    wide();
    await click(page, 'aside a:has-text("Open hex map")', 300);
    await offCamera(7000);
    await wait(4500);
    await go(`https://chainscan-galileo.0g.ai/address/${SUBS}`);
    await wait(1500);
    await focus("table tbody tr", 1.9, 40); await wait(5000);
    wide(); await wait(1000);
  },
  // 6 · MCP: the docs section and its three tools.
  6: async ({ page, go, focus }) => {
    await go(SITE + "/docs");
    await centre(page, "#mcp table"); await wait(900);
    await focus("#mcp table", 1.7, 30); await wait(7000);
  },
  // 7 · Bans: the two-strike rules, then ConsensusRegistry on 0G Galileo.
  7: async ({ page, go, focus, wide }) => {
    await go(SITE + "/docs");
    const rules = page.locator('#consensus h3:has-text("Two strikes")');
    await rules.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 220)); await wait(900);
    await focus(rules.locator("xpath=following-sibling::*[2]"), 1.6, 20); await wait(4500);
    wide();
    await go(`https://chainscan-galileo.0g.ai/address/${CONSENSUS}`);
    await wait(1500);
    await focus(page.getByText(/A total of \d+ records/), 2.6, 80); await wait(3000);
    await focus("table tbody", 1.5, 20); await wait(3500);
    wide(); await wait(1000);
  },
  // 8 · Rewards (demo analytics), then the deployed contracts.
  8: async ({ page, go, focus, wide }) => {
    await go(SITE + "/mockups/analytics");
    await focus('section[aria-label="Totals"]', 1.5, 20); await wait(3500);
    wide();
    await click(page, 'button:has-text("Platform")', 1200);
    await focus('section[aria-label="Totals"]', 1.5, 20); await wait(3000);
    await go(SITE + "/docs");
    const h = page.locator('h3:has-text("Deployed contracts")');
    await h.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 150)); await wait(800);
    await focus(h.locator("xpath=following-sibling::*[1]"), 1.8, 30); await wait(4500);
  },
};

const pick = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--headless=new", "--use-angle=metal", "--enable-gpu"] });
for (const n of pick.length ? pick : Object.keys(TAKES).map(Number)) {
  try { await take(browser, n, TAKES[n]); } catch (e) { console.error(`take ${n} failed: ${e.message.split("\n")[0]}`); }
}
await browser.close();
