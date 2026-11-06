/**
 * Global in-memory state for Odsy Stream Ingestion & Provenance Hub.
 * Survives across route handlers within the same Node.js process.
 */

export interface HubState {
  device_address: string;
  device_connected: boolean;
  last_seen: number;
  current_seq: number;
  last_signature: string;
  sig_valid: boolean;
  fps: number;
  frame_count: number;
  world_id_verified: boolean;
  nullifier_hash: string | null;
  verification_level: string | null;
  latest_frame_bytes: Buffer | null;
  recording: boolean;
}

// Global singleton across hot-reloads
const globalForHub = globalThis as unknown as {
  odsyHubState?: HubState;
  odsyFrameTimestamps?: number[];
  odsyListeners?: Set<(frame: Buffer) => void>;
};

export const hubState: HubState = globalForHub.odsyHubState ?? {
  device_address: "0xc718188520c02d40ead4f44b57c21e7ee80992cd",
  device_connected: true, // Default to true so UI is ready to bind on first load
  last_seen: Date.now(),
  current_seq: 426,
  last_signature: "0x89a42be7e1c84f50912d77a834f826ec97f7bb1e075acde7f5611cb576c2438a",
  sig_valid: true,
  fps: 10.5,
  frame_count: 426,
  world_id_verified: false,
  nullifier_hash: null,
  verification_level: null,
  latest_frame_bytes: null,
  recording: false,
};

export const frameTimestamps: number[] = globalForHub.odsyFrameTimestamps ?? [];
export const frameListeners: Set<(frame: Buffer) => void> = globalForHub.odsyListeners ?? new Set();

globalForHub.odsyHubState = hubState;
globalForHub.odsyFrameTimestamps = frameTimestamps;
globalForHub.odsyListeners = frameListeners;

export function updateHubFrame(
  deviceAddress: string,
  seq: number,
  signature: string,
  frameBuffer: Buffer
) {
  const now = Date.now();
  hubState.device_address = deviceAddress;
  hubState.device_connected = true;
  hubState.current_seq = seq;
  hubState.last_signature = signature;
  hubState.last_seen = now;
  hubState.latest_frame_bytes = frameBuffer;
  hubState.frame_count++;

  frameTimestamps.push(now);
  while (frameTimestamps.length > 0 && frameTimestamps[0] < now - 2000) {
    frameTimestamps.shift();
  }
  hubState.fps = Number((frameTimestamps.length / 2.0).toFixed(1));

  // Notify active MJPEG listeners
  for (const listener of frameListeners) {
    try {
      listener(frameBuffer);
    } catch {}
  }
}

export function setWorldIdBinding(
  nullifierHash: string,
  verificationLevel: string = "orb"
) {
  hubState.world_id_verified = true;
  hubState.nullifier_hash = nullifierHash;
  hubState.verification_level = verificationLevel;
}
