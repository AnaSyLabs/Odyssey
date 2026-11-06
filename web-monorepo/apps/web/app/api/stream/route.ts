import { hubState, frameListeners } from "@/lib/hub";
import fs from "node:fs";
import path from "node:path";

let cachedSamples: Buffer[] = [];

function loadSampleFrames(): Buffer[] {
  if (cachedSamples.length > 0) return cachedSamples;
  try {
    const dir = path.join(process.cwd(), "public", "stream_samples");
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
      cachedSamples = files.map((f) => fs.readFileSync(path.join(dir, f)));
    }
  } catch {}
  return cachedSamples;
}

export async function GET() {
  const encoder = new TextEncoder();
  const samples = loadSampleFrames();

  let active = true;
  let timer: NodeJS.Timeout | null = null;
  let sampleIndex = 0;

  const stream = new ReadableStream({
    start(controller) {
      function sendFrame(frameBytes: Buffer) {
        if (!active) return;
        try {
          const header = `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frameBytes.length}\r\n\r\n`;
          controller.enqueue(encoder.encode(header));
          controller.enqueue(frameBytes);
          controller.enqueue(encoder.encode("\r\n"));
        } catch {
          cleanup();
        }
      }

      // Listener for incoming real-time ESP32 frames
      const onNewFrame = (frame: Buffer) => {
        sendFrame(frame);
      };
      frameListeners.add(onNewFrame);

      // Heartbeat / Fallback generator (approx 10 FPS)
      timer = setInterval(() => {
        if (!active) return;
        // If no fresh frame from glasses in the last 2 seconds, stream sample reel
        const now = Date.now();
        if (!hubState.latest_frame_bytes || now - hubState.last_seen > 2000) {
          if (samples.length > 0) {
            const frame = samples[sampleIndex % samples.length];
            sampleIndex++;
            sendFrame(frame);
          }
        }
      }, 100);

      function cleanup() {
        active = false;
        if (timer) clearInterval(timer);
        frameListeners.delete(onNewFrame);
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      active = false;
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "multipart/x-mixed-replace; boundary=frame",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      "Pragma": "no-cache",
    },
  });
}
