// Records the silent screen takes for the demo video from the production site, one webm per take.
// Usage: node rec.mjs [take numbers...]   e.g. node rec.mjs 1 3
import { chromium } from "playwright-core";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SITE = "https://odyssey-blush-seven.vercel.app";
const SAMPLE = "0x6ba287b452679b3253c29f1bfbd30fe2fcda1c4b95c06d17988211b8edcbd310"; // a real JPEG from the glasses (MAC 38:3E:51:C2:98:54)
const SUBS = "0xc3a946516f2f0CE3fc2065543cb0a8E9b105A54e";
const CONSENSUS = "0x83bea227e5D2C72f8F0F73E63175759D4E6055DC";
const OUT = new URL("./takes/", import.meta.url).pathname;
const W = 1440, H = 810; // CSS pixels; rendered at 4/3 density, so the video is 1920x1080 with larger text
const OW = 1920, OH = 1080;
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A visible cursor that follows Playwright's mouse, so clicks read on screen.
const CURSOR = `addEventListener("DOMContentLoaded", () => {
  const c = document.createElement("div");
  c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;margin:-4px 0 0 -4px;z-index:2147483647;pointer-events:none;transition:transform .08s";
  c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
  addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
  addEventListener("mousedown", () => (c.style.transform = "scale(.8)"), true);
  addEventListener("mouseup", () => (c.style.transform = ""), true);
});`;

// Chrome streams JPEG frames as the page changes; we keep each frame's timestamp and encode them at their real timing.
async function take(browser, n, fn) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 4 / 3, colorScheme: "dark" });
  // No intro animation; dark theme is the default.
  await ctx.addInitScript(() => { try { sessionStorage.setItem("odyssey:intro", "1"); document.documentElement.dataset.intro = "off"; } catch {} });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const name = `take-${String(n).padStart(2, "0")}`;
  const dir = `${OUT}${name}-frames/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  const frames = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = `${dir}${String(frames.length).padStart(5, "0")}.jpg`;
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: OW, maxHeight: OH, everyNthFrame: 1 });
  await page.mouse.move(W / 2, H / 2);
  await fn(page);
  await wait(500);
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast").catch(() => {});
  await ctx.close();
  // concat list: each frame lasts until the next one; the last until the take ended
  const lines = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`);
  lines.push(`file '${frames.at(-1).file}'`);
  writeFileSync(`${dir}list.txt`, lines.join("\n"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${dir}list.txt`, "-vf", `fps=30,scale=${OW}:${OH}:force_original_aspect_ratio=decrease,pad=${OW}:${OH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "18", `${OUT}${name}.mp4`]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${name}: ${frames.length} frames`);
}

// Move the cursor smoothly onto an element, then click it.
async function click(page, locator, pause = 600) {
  const el = page.locator(locator).first();
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
  await wait(250);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await wait(pause);
}
const scrollTo = (page, y) => page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y);
const scrollToEl = (page, sel) => page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "start" }), sel);

const TAKES = {
  // 1 · Hook: landing, then the glasses come apart in the Lineup view.
  1: async (p) => {
    await p.goto(SITE + "/", { waitUntil: "networkidle" });
    await wait(2500);
    await p.evaluate(() => document.querySelector('[aria-label="Model view"]').parentElement.scrollIntoView({ behavior: "smooth", block: "center" }));
    await wait(2000);
    await click(p, '[aria-label="Model view"] button:has-text("Lineup")', 6500);
  },
  // 2 · The capture device: 3D model running its capture cycle (cut the real glasses footage in here).
  2: async (p) => {
    await p.goto(SITE + "/device", { waitUntil: "networkidle" });
    await wait(4000);
    await p.mouse.move(W * 0.4, H * 0.5, { steps: 30 });
    await p.mouse.down(); await p.mouse.move(W * 0.55, H * 0.48, { steps: 60 }); await p.mouse.up();
    await wait(12000);
  },
  // 3 · Enroll with World ID (demo screen; the World ID step is simulated).
  3: async (p) => {
    await p.goto(SITE + "/mockups/enroll", { waitUntil: "networkidle" });
    await wait(3000);
    await p.mouse.move(520, 300, { steps: 25 }); await wait(1500);
    await p.mouse.move(520, 370, { steps: 25 }); await wait(1500);
    await click(p, 'button:has-text("Verify with World ID")', 3500);
    await wait(4000);
  },
  // 4 · Proof on Arkiv: a sample's proof on the demo dataset, then a real sample entity on the Arkiv explorer.
  4: async (p) => {
    await p.goto(SITE + "/mockups/datasets", { waitUntil: "networkidle" });
    await wait(2000);
    await click(p, 'section[aria-label="Datasets"] button', 1500);
    await click(p, 'aside details summary', 4000);
    await p.goto(`https://rabdi.explorer.arkiv.network/entity/${SAMPLE}`, { waitUntil: "networkidle" }).catch(() => {});
    await wait(6000);
    await scrollTo(p, 500); await wait(3000);
  },
  // 5 · A lab subscribes in 0G (demo), then the real subscriptions contract on 0G Galileo.
  5: async (p) => {
    await p.goto(SITE + "/mockups/datasets", { waitUntil: "networkidle" });
    await wait(2000);
    await click(p, 'section[aria-label="Datasets"] button', 1500);
    await click(p, 'aside button:has-text("Subscribe")', 2500);
    await click(p, 'aside a:has-text("Open hex map")', 5000);
    await p.goto(`https://chainscan-galileo.0g.ai/address/${SUBS}`, { waitUntil: "networkidle" }).catch(() => {});
    await wait(7000);
  },
  // 6 · MCP: the docs section (the live Claude clip is recorded by the team).
  6: async (p) => {
    await p.goto(SITE + "/docs#mcp", { waitUntil: "networkidle" });
    await wait(3000);
    await p.evaluate(() => window.scrollBy({ top: 300, behavior: "smooth" })); await wait(5000);
  },
  // 7 · Bans: the consensus section of the docs, then ConsensusRegistry on 0G Galileo.
  7: async (p) => {
    await p.goto(SITE + "/docs#consensus", { waitUntil: "networkidle" });
    await wait(4000);
    await p.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" })); await wait(3000);
    await p.goto(`https://chainscan-galileo.0g.ai/address/${CONSENSUS}`, { waitUntil: "networkidle" }).catch(() => {});
    await wait(6000);
  },
  // 8 · Rewards (demo analytics), then the deployed contracts on the docs page.
  8: async (p) => {
    await p.goto(SITE + "/mockups/analytics", { waitUntil: "networkidle" });
    await wait(4000);
    await click(p, 'button:has-text("Platform")', 3500);
    await p.goto(SITE + "/docs#tracks", { waitUntil: "networkidle" });
    await wait(1500);
    await p.evaluate(() => document.querySelector("#tracks h3:last-of-type")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    await wait(5000);
  },
};

const pick = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--headless=new", "--use-angle=metal", "--enable-gpu"] });
for (const n of pick.length ? pick : Object.keys(TAKES).map(Number)) {
  try { await take(browser, n, TAKES[n]); } catch (e) { console.error(`take ${n} failed: ${e.message.split("\n")[0]}`); }
}
await browser.close();
