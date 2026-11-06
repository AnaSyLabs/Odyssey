import "server-only";
import { randomUUID } from "node:crypto";

export const MAX_IMAGE = 512 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Testimonial = { id: string; name: string; quote: string; mime: string; image: Buffer; addedAt: number };

// shortcut: in-memory, so testimonials vanish on every redeploy or cold start and each Vercel instance has its own list; move to Arkiv or a database before relying on them.
const g = globalThis as { testimonials?: Testimonial[] };
const store = (g.testimonials ??= []); // on globalThis so dev hot reloads keep the list

/** Newest first, without the image bytes. */
export const listTestimonials = () =>
  store.map(({ id, name, quote, addedAt }) => ({ id, name, quote, addedAt })).reverse();

export function addTestimonial(name: string, quote: string, mime: string, image: Buffer) {
  const t = { id: randomUUID(), name, quote, mime, image, addedAt: Math.floor(Date.now() / 1000) };
  store.push(t);
  return { id: t.id };
}

export const testimonialImage = (id: string) => store.find((t) => t.id === id);
