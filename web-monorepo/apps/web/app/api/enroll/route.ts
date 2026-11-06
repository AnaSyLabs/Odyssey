import { hashSignal } from "@worldcoin/idkit/hashing";
import { signRequest } from "@worldcoin/idkit/signing";
import { getAddress, isAddress } from "viem";
import { findDevice, need, registerDevice } from "@/lib/arkiv";
import { isBanned } from "@/lib/consensus";
import { getSession, unauthorized } from "@/lib/session";

const ACTION = "register-device";
// "staging" pairs with simulator.worldcoin.org; real World App proofs need "production".
const ENVIRONMENT = process.env.WORLD_ENVIRONMENT === "staging" ? "staging" : "production";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** A fresh RP-signed World ID request context for the enroll page. The signing key never leaves the server. */
export async function GET() {
  if (!(await getSession())) return unauthorized();
  const appId = need("WORLD_APP_ID");
  const sig = signRequest({ action: ACTION, signingKeyHex: need("WORLD_RP_SIGNING_KEY") });
  return Response.json({
    app_id: appId,
    action: ACTION,
    environment: ENVIRONMENT,
    rp_context: { rp_id: need("WORLD_RP_ID"), nonce: sig.nonce, created_at: sig.createdAt, expires_at: sig.expiresAt, signature: sig.sig },
  });
}

/**
 * Verifies a World ID proof whose signal is the device address, then registers the device to that human.
 * Body: { device: 0x address, mac: "AA:BB:..", result: IDKitResult }. The signed-in wallet becomes the payout address.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  const b = await req.json().catch(() => null);
  if (!b || !isAddress(b.device) || typeof b.result !== "object") return fail(400, "need device, mac and the World ID result");
  const device = getAddress(b.device);
  const proof = b.result.responses?.[0];
  if (b.result.action !== ACTION || !proof?.nullifier) return fail(400, "not a register-device proof");
  if (b.result.environment !== ENVIRONMENT) return fail(400, `proof is from ${b.result.environment}, this app expects ${ENVIRONMENT}`);
  // The proof must commit to this device, or one human's proof could enroll any device.
  if (proof.signal_hash?.toLowerCase() !== hashSignal(device).toLowerCase()) return fail(400, "proof is not bound to this device address");
  // Fail before World ID records the verification, so the human can retry with the right device.
  if (await findDevice(device)) return fail(409, "device already registered");
  // A banned human cannot enroll a new device. Checked before World ID records another verification.
  if (await isBanned(`0x${BigInt(proof.nullifier).toString(16)}`)) return fail(403, "this World ID is banned");

  const res = await fetch(`https://developer.worldcoin.org/api/v4/verify/${need("WORLD_RP_ID")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b.result),
  });
  const verdict = await res.json().catch(() => ({}));
  if (!res.ok || !verdict.success) return fail(400, `World ID rejected the proof: ${verdict.detail ?? verdict.code ?? res.status}`);

  // v3 nullifiers are hex, v4 are decimal; the registry stores hex.
  const worldId = `0x${BigInt(proof.nullifier).toString(16)}`;
  return registerDevice({ device, worldId, deviceType: "esp32-cam-glasses", mac: b.mac, payout: session.address });
}
