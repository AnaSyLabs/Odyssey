import "server-only";
import { ExpirationTime } from "@arkiv-network/sdk";
import { desc } from "@arkiv-network/sdk/query";
import { addr, u64 } from "@arkiv-network/sdk/schema";
import { getAddress, isHex } from "viem";
import { arkivPublic, arkivWallet, gatewayAddress } from "@/lib/arkiv";
import { Testimonials } from "@/lib/schema";

export const MAX_IMAGE = 96 * 1024; // same inline limit as samples
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const isHash = (h: string) => /^0x[0-9a-fA-F]{64}$/.test(h);

/** Newest first. */
export async function listTestimonials() {
  // shortcut: one page of 100; page by key if testimonials ever outgrow that.
  const { entities } = await arkivPublic()
    .select({ $key: true, hash: true, addedAt: true })
    .from(Testimonials, { onMismatch: "skip" })
    .ownedBy(gatewayAddress())
    .orderBy(desc("addedAt"))
    .limit(100)
    .fetch();
  return entities.map((e) => ({ key: e.$key, hash: e.hash.value, addedAt: Number(e.addedAt.value) }));
}

export async function addTestimonial(hash: string, mime: string, image: Uint8Array, by: string) {
  const { entityKey, txHash } = await arkivWallet().createEntity(
    Testimonials,
    { hash: hash.toLowerCase(), mime, image, addedBy: addr(getAddress(by)), addedAt: u64(Math.floor(Date.now() / 1000)) },
    { expiration: ExpirationTime.max() }, // the daily extend job keeps these alive
  );
  return { key: entityKey, txHash };
}

/** The image of a gateway-written testimonial, or null. */
export async function testimonialImage(key: string) {
  if (!isHex(key) || key.length !== 66) return null;
  const t = await arkivPublic().getEntity(key, Testimonials).catch(() => null);
  if (!t || t.$owner.toLowerCase() !== gatewayAddress().toLowerCase()) return null;
  return { mime: t.mime.value, data: Buffer.from(t.image.value.slice(2), "hex") };
}
