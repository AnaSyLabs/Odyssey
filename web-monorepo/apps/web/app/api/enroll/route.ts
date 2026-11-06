import { hashSignal } from "@worldcoin/idkit/hashing";
import { signRequest } from "@worldcoin/idkit/signing";
import { getAddress, isAddress } from "viem";
import { findDevice, need, registerDevice } from "@/lib/arkiv";
import { isBanned } from "@/lib/consensus";
import { getSession, unauthorized } from "@/lib/session";
import { fail, route } from "@/lib/api";

const ACTION = "register-device";
const DEVICE_TYPES = ["esp32-cam-glasses", "laptop"];
const ORB = ["orb", "proof_of_human"];
// "staging" pairs with simulator.worldcoin.org; real World App proofs need "production".
const ENVIRONMENT = process.env.WORLD_ENVIRONMENT === "staging" ? "staging" : "production";

/** A fresh RP-signed World ID request context for the enroll page. The signing key never leaves the server. */
export const GET = route(async function GET() {
  if (!(await getSession())) return unauthorized();
  const appId = need("WORLD_APP_ID");
  const sig = signRequest({ action: ACTION, signingKeyHex: need("WORLD_RP_SIGNING_KEY") });
  return Response.json({
    app_id: appId,
    action: ACTION,
    environment: ENVIRONMENT,
    rp_context: { rp_id: need("WORLD_RP_ID"), nonce: sig.nonce, created_at: sig.createdAt, expires_at: sig.expiresAt, signature: sig.sig },
  });
});

/**
 * Verifies a World ID proof whose signal is the device address, then registers the device to that human.
 * Body: { device: 0x address, mac: "AA:BB:..", deviceType?: one of DEVICE_TYPES, result: IDKitResult }. The signed-in wallet becomes the payout address.
 */
export const POST = route(async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  const b = await req.json().catch(() => null);
  if (!b || !isAddress(b.device) || typeof b.result !== "object") return fail(400, "need device, mac and the World ID result");
  const deviceType = b.deviceType ?? DEVICE_TYPES[0];
  if (!DEVICE_TYPES.includes(deviceType)) return fail(400, `deviceType must be one of ${DEVICE_TYPES.join(", ")}`);
  const device = getAddress(b.device);
  const proof = b.result.responses?.[0];
  if (b.result.action !== ACTION || !proof?.nullifier) return fail(400, "This is not a device enrollment proof. Close the window and start again from this page.");
  if (b.result.environment !== ENVIRONMENT)
    return fail(400, ENVIRONMENT === "production"
      ? "This proof came from the World ID simulator, but this app only accepts the real World App. Scan the code with World App."
      : "This proof came from the real World App, but this app is in test mode. Use simulator.worldcoin.org.");
  // One human, one device rests on the Orb: documents and phones are far easier to farm. v3 says "orb", v4 "proof_of_human".
  if (!ORB.includes(proof.identifier))
    return fail(403, `Enrolling a device needs Orb verification, but this proof is from your ${proof.identifier ?? "non-Orb"} credential. Verify at a World Orb (world.org/find-orb), then choose the Human credential here.`);
  // The proof must commit to this device, or one human's proof could enroll any device.
  if (proof.signal_hash?.toLowerCase() !== hashSignal(device).toLowerCase()) return fail(400, "This proof was made for a different device address. Check the address and try again.");
  // Fail before World ID records the verification, so the human can retry with the right device.
  if (await findDevice(device)) return fail(409, "This device is already enrolled. Open Captures to see its uploads.");
  // A banned human cannot enroll a new device. Checked before World ID records another verification.
  if (await isBanned(`0x${BigInt(proof.nullifier).toString(16)}`)) return fail(403, "This World ID is banned for uploading fake or replayed data, so it can't enroll devices.");

  const res = await fetch(`https://developer.worldcoin.org/api/v4/verify/${need("WORLD_RP_ID")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b.result),
  });
  const verdict = await res.json().catch(() => ({}));
  if (verdict.code === "max_verifications_reached")
    return fail(409, "Your World ID has already enrolled a device. Each human can enroll one device.");
  if (!res.ok || !verdict.success) return fail(400, `World ID rejected the proof (${verdict.detail ?? verdict.code ?? res.status}). Start the verification again.`);

  // v3 nullifiers are hex, v4 are decimal; the registry stores hex.
  const worldId = `0x${BigInt(proof.nullifier).toString(16)}`;
  return registerDevice({ device, worldId, deviceType, mac: b.mac, payout: session.address });
});
