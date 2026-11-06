import "server-only";
import { uploadTo0G } from "@/lib/og";
import { decide, type Decision, type GateInput } from "@/lib/gate-core";

export type { Decision, GateInput };

/** True when the capture gate is configured. Without a key the gateway ingests as before. */
export const gateEnabled = () => Boolean(process.env.OG_COMPUTE_API_KEY);

/** Asks the 0G model whether this image should be captured. Throws GateUnavailable when 0G cannot give a real answer. */
export function gate(input: GateInput): Promise<Decision> {
  return decide(input, {
    baseUrl: process.env.OG_COMPUTE_BASE_URL ?? "https://router-api.0g.ai/v1",
    apiKey: process.env.OG_COMPUTE_API_KEY ?? "",
    model: process.env.OG_COMPUTE_MODEL ?? "qwen2.5-vl-72b-instruct",
    verifyTee: process.env.OG_COMPUTE_VERIFY_TEE !== "false",
    timeoutMs: Number(process.env.OG_COMPUTE_TIMEOUT_MS ?? 20_000),
    fetch,
  });
}

/** One line of the episode log. Holds hashes and the decision, never the image. */
export type Episode = Decision & { v: 1; at: number; device: string; contentHash: string; outcome: "stored" | "skipped" | "stopped" | "safe-stop" };

/** Appends one decision to the episode log: a small JSON record on 0G Storage. Returns its root hash, or null if the upload failed. */
export async function logEpisode(e: Omit<Episode, "v" | "at">): Promise<string | null> {
  try {
    return await uploadTo0G(Buffer.from(JSON.stringify({ v: 1, at: Math.floor(Date.now() / 1000), ...e })));
  } catch (err) {
    console.error("episode log upload failed:", err);
    return null;
  }
}
