// Payload encryption. Each sample gets its own AES-256-GCM key, derived from the gateway's DATA_KEY and the
// sample's contentHash, so handing a subscriber one sample key reveals only that sample.
// Format: 0x01 | iv (12) | ciphertext | tag (16). The contentHash is bound in as AAD.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

export const ENC = "aes-256-gcm-v1";
export const ENC_OVERHEAD = 1 + 12 + 16;

const aad = (contentHash: string) => Buffer.from(contentHash.slice(2), "hex");

export function sampleKey(dataKeyHex: string, contentHash: string): Buffer {
  const ikm = Buffer.from(dataKeyHex.replace(/^0x/, ""), "hex");
  if (ikm.length !== 32) throw new Error("DATA_KEY must be 32 bytes of hex");
  return Buffer.from(hkdfSync("sha256", ikm, "odsy-sample-key-v1", contentHash.toLowerCase(), 32));
}

export function encrypt(plain: Uint8Array, key: Buffer, contentHash: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv).setAAD(aad(contentHash));
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([Buffer.from([1]), iv, body, c.getAuthTag()]);
}

/** Throws if the key is wrong or the ciphertext was changed. */
export function decrypt(blob: Uint8Array, key: Buffer, contentHash: string): Buffer {
  const b = Buffer.from(blob);
  if (b[0] !== 1 || b.length < ENC_OVERHEAD) throw new Error("unknown ciphertext format");
  const d = createDecipheriv("aes-256-gcm", key, b.subarray(1, 13)).setAAD(aad(contentHash));
  d.setAuthTag(b.subarray(b.length - 16));
  return Buffer.concat([d.update(b.subarray(13, b.length - 16)), d.final()]);
}
