import { hubState, setWorldIdBinding } from "@/lib/hub";
import { getAddress, isAddress } from "viem";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const nullifier = body.nullifier_hash || body.nullifier;
  if (!nullifier || typeof nullifier !== "string") {
    return Response.json({ error: "missing nullifier_hash" }, { status: 400 });
  }

  const signal = body.signal || hubState.device_address;
  const level = body.verification_level || "orb";

  setWorldIdBinding(nullifier, level);

  // Attempt Arkiv device registration if configured
  let arkivReceipt: { entityKey?: string; txHash?: string } = {};
  try {
    if (process.env.ARKIV_PRIVATE_KEY && isAddress(signal)) {
      const { arkivWallet, Devices } = await import("@/lib/arkiv");
      const { addr, ExpirationTime } = await import("@arkiv-network/sdk");
      const device = getAddress(signal);
      const res = await arkivWallet().createEntity(
        Devices,
        {
          device: addr(device),
          worldId: nullifier.toLowerCase(),
          deviceType: "esp32-cam-glasses",
          mac: "AA:BB:CC:DD:EE:01",
        },
        { expiration: ExpirationTime.max() }
      );
      arkivReceipt = { entityKey: res.entityKey, txHash: res.txHash };
    }
  } catch (err) {
    // Non-fatal if testnet gas or key is absent in local dev
    console.warn("[Arkiv Registration Notice]:", err);
  }

  return Response.json({
    success: true,
    nullifier_hash: nullifier,
    device_address: signal,
    verification_level: level,
    arkiv: arkivReceipt,
  });
}
