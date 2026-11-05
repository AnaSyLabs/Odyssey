// The device <-> gateway upload protocol. Shared by the gateway and the Node scripts,
// so imports stay relative and Node-runnable (no "@/" alias).
import { createHash } from "node:crypto";

export const KINDS = ["image", "video", "audio", "text", "sensor"] as const;
export type Kind = (typeof KINDS)[number];

/** What a device POSTs to /api/ingest. */
export type Upload = {
  kind: Kind;
  mime: string;
  capturedAt: number; // unix seconds, device clock
  lat: string; // decimal strings so the signed text and the stored dec match exactly
  lon: string;
  sensors: string; // JSON text, signed as sent
  data: string; // base64 payload
  signature: `0x${string}`; // EIP-191 personal_sign over sampleMessage()
};

type Signed = Pick<Upload, "kind" | "mime" | "capturedAt" | "lat" | "lon">;

export const sha256 = (b: Uint8Array | string) => `0x${createHash("sha256").update(b).digest("hex")}` as const;

/** The signed text, from hashes only, so anyone can check a signature without the (encrypted) sensors. */
export const signedText = (u: Signed, contentHash: string, sensorsHash: string) =>
  ["odsy-sample:v1", contentHash, u.kind, u.mime, u.capturedAt, u.lat, u.lon, sensorsHash].join("|");

/** The exact text the device key signs. Changing it breaks every deployed device: bump v1. */
export const sampleMessage = (u: Signed & { sensors: string }, contentHash: string) => signedText(u, contentHash, sha256(u.sensors));
