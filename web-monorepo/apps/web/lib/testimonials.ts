import "server-only";
import { randomUUID } from "node:crypto";

const MAX_IMAGE = 512 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Fields = { name: string; role: string; quote: string; image?: { mime: string; data: Buffer } };
type Testimonial = Fields & { id: string; src?: string; updatedAt: number };

// Built in, so they come back after every deploy; images live in public/testimonials.
const SEED = [
  { id: "bertrand-juglas", name: "Bertrand Juglas", role: "Mentor, VantagePeers", quote: "Thanks for this impressive demonstration 👏", src: "/testimonials/bertrand-juglas.jpg" },
];

// shortcut: in-memory, so adds and edits vanish on every redeploy or cold start and each Vercel instance has its own list; move to Arkiv or a database before relying on them.
const g = globalThis as { testimonials?: Testimonial[] };
const store: Testimonial[] = (g.testimonials ??= SEED.map((s) => ({ ...s, updatedAt: 0 }))); // on globalThis so dev hot reloads keep the list

/** Newest first, built-in ones last. No image bytes; the image URL changes on every edit so caches pick it up. */
export const listTestimonials = () =>
  store.map(({ id, name, role, quote, src, image, updatedAt }) => ({
    id, name, role, quote, src: image ? `/api/testimonials/${id}/image?v=${updatedAt}` : src,
  })).reverse();

/** Validates a multipart form. The image is required only when adding. */
export async function readFields(form: FormData | null, needImage: boolean): Promise<Fields | string> {
  const text = (k: string) => String(form?.get(k) ?? "").trim();
  const [name, role, quote] = [text("name"), text("role"), text("quote")];
  if (!name || name.length > 80) return "name: 1 to 80 characters";
  if (role.length > 80) return "role: up to 80 characters";
  if (quote.length > 500) return "testimonial: up to 500 characters";
  const file = form?.get("image");
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile) return needImage ? "attach an image" : { name, role, quote };
  if (!IMAGE_TYPES.includes(file.type)) return "image must be JPEG, PNG or WebP";
  if (file.size > MAX_IMAGE) return "image must be 512 KiB or smaller";
  return { name, role, quote, image: { mime: file.type, data: Buffer.from(await file.arrayBuffer()) } };
}

export function addTestimonial(f: Fields) {
  const t = { ...f, id: randomUUID(), updatedAt: Date.now() };
  store.push(t);
  return { id: t.id };
}

/** Replaces the text; replaces the image only when a new one is given. False when the id is unknown. */
export function updateTestimonial(id: string, f: Fields) {
  const t = store.find((x) => x.id === id);
  if (!t) return false;
  Object.assign(t, { name: f.name, role: f.role, quote: f.quote, updatedAt: Date.now() }, f.image && { image: f.image });
  return true;
}

export const testimonialImage = (id: string) => store.find((t) => t.id === id)?.image;
