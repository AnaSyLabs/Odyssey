// The capture gate's decision call, kept free of server-only imports so `npm test` can run it with a fake fetch.

export type Action = "capture" | "skip" | "stop";
export type GateInput = { data: Buffer; mime: string; kind: string };
export type Decision = {
  action: Action;
  reason: string;
  /** x_0g_trace.request_id from the 0G router: ties this decision to one real compute call. */
  requestId: string;
  provider?: string;
  model: string;
  /** true only when the router reported TEE verification for this call. */
  teeVerified?: boolean;
};
export type GateConfig = { baseUrl: string; apiKey: string; model: string; verifyTee: boolean; timeoutMs: number; fetch: typeof fetch };

/** 0G could not give a real decision (down, out of credit, garbled answer). The gateway must stop, not guess. */
export class GateUnavailable extends Error {}

const PROMPT =
  "You are the capture gate of a pair of smart glasses that collect real-world data for AI labs. " +
  "Look at this photo and decide what the glasses should do. " +
  'Answer with JSON only: {"action":"capture"|"skip"|"stop","reason":"<one sentence>"}. ' +
  "capture = a clear, useful scene of the real world. " +
  "skip = ONLY an image that is completely black or almost entirely dark (for example a covered lens). " +
  "The camera is a low-resolution black-and-white sensor, so grainy, blurry, grayscale or low-detail images are normal and must be captured, not skipped. " +
  "stop = the photo shows something that must not be recorded: a face at close range, a screen with private content, a bathroom or changing room, a ID card or payment card.";

/** Pulls {"action","reason"} out of a model reply. Returns null when it is not a valid decision. */
export function parseDecision(text: string): { action: Action; reason: string } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (j.action !== "capture" && j.action !== "skip" && j.action !== "stop") return null;
    return { action: j.action, reason: String(j.reason ?? "").slice(0, 300) };
  } catch {
    return null;
  }
}

export async function decide(input: GateInput, cfg: GateConfig): Promise<Decision> {
  let res: Response;
  try {
    res = await cfg.fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(cfg.timeoutMs),
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        max_tokens: 120,
        ...(cfg.verifyTee && { verify_tee: true }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: `data:${input.mime};base64,${input.data.toString("base64")}` } },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    throw new GateUnavailable(`0G compute unreachable: ${(e as Error).message}`);
  }
  const body = await res.json().catch(() => null);
  // 402 insufficient_balance, 429, 502, 503 no_available_provider and any other non-2xx all land here.
  if (!res.ok) throw new GateUnavailable(`0G compute ${res.status}: ${body?.error?.code ?? body?.error?.message ?? "error"}`);
  const requestId = body?.x_0g_trace?.request_id;
  const parsed = parseDecision(String(body?.choices?.[0]?.message?.content ?? ""));
  if (!requestId || !parsed) throw new GateUnavailable("0G compute returned no usable decision");
  return {
    ...parsed,
    requestId,
    provider: body.x_0g_trace.provider,
    model: String(body.model ?? cfg.model),
    ...(cfg.verifyTee && { teeVerified: body.x_0g_trace.tee_verified === true }),
  };
}
