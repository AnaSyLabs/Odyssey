import { addTestimonial, IMAGE_TYPES, isHash, listTestimonials, MAX_IMAGE } from "@/lib/testimonials";
import { getSession, unauthorized } from "@/lib/session";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Public: every testimonial, newest first. Images are at /api/testimonials/{key}/image. */
export async function GET() {
  return Response.json({ testimonials: await listTestimonials() });
}

/** Admins only: add a testimonial. Multipart form: hash (0x + 64 hex), image (JPEG, PNG or WebP, up to 96 KiB). */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.admin) return fail(403, "admins only");
  const form = await req.formData().catch(() => null);
  const hash = String(form?.get("hash") ?? "").trim();
  const image = form?.get("image");
  if (!isHash(hash)) return fail(400, "hash must be 0x followed by 64 hex characters");
  if (!(image instanceof File)) return fail(400, "attach an image");
  if (!IMAGE_TYPES.includes(image.type)) return fail(400, "image must be JPEG, PNG or WebP");
  if (image.size > MAX_IMAGE) return fail(400, "image must be 96 KiB or smaller");
  const added = await addTestimonial(hash, image.type, new Uint8Array(await image.arrayBuffer()), session.address);
  return Response.json(added, { status: 201 });
}
