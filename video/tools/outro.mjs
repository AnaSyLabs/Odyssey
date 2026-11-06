// Records the Odi outro (outro.html) as a 1920x1080 clip: final/outro.mp4.
import { chromium } from "playwright-core";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SECONDS = 7.5;
const here = new URL(".", import.meta.url).pathname;
const dir = `${here}outro-frames/`;
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
mkdirSync(`${here}final`, { recursive: true });

const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--headless=new"] });
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const cdp = await page.context().newCDPSession(page);
const frames = [];
let t0 = null;
cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  if (t0 === null) return;
  const t = Date.now() / 1000 - t0;
  if (frames.length && t - frames.at(-1).t < 1 / 30) return; // at most 30 fps
  const file = `${dir}${String(frames.length).padStart(5, "0")}.png`;
  writeFileSync(file, Buffer.from(data, "base64"));
  frames.push({ file, t });
});
await cdp.send("Page.startScreencast", { format: "png", maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
t0 = Date.now() / 1000;
await page.goto(`file://${here}outro.html`);
await new Promise((r) => setTimeout(r, SECONDS * 1000));
await cdp.send("Page.stopScreencast");
await b.close();

// concat with real timings; long holds split so ffmpeg times them correctly
const lines = frames.flatMap((f, i) => {
  let d = Math.max(0.001, (frames[i + 1]?.t ?? SECONDS) - f.t);
  const out = [];
  while (d > 0.5) { out.push(`file '${f.file}'\nduration 0.5000`); d -= 0.5; }
  out.push(`file '${f.file}'\nduration ${d.toFixed(4)}`);
  return out;
});
lines.push(`file '${frames.at(-1).file}'`);
writeFileSync(`${dir}list.txt`, lines.join("\n"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${dir}list.txt`, "-vf", "fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0b0b,format=yuv420p",
  "-t", String(SECONDS), "-c:v", "libx264", "-preset", "slow", "-crf", "16", `${here}final/outro.mp4`]);
rmSync(dir, { recursive: true, force: true });
console.log(`final/outro.mp4: ${frames.length} frames`);
