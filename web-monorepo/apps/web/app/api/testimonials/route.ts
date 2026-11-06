import { addTestimonial, IMAGE_TYPES, listTestimonials, MAX_IMAGE } from "@/lib/testimonials";
import { getSession, unauthorized } from "@/lib/session";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Public: every testimonial, newest first. Images are at /api/testimonials/{id}/image. */
export async function GET() {
  return Response.json({ testimonials: listTestimonials() });
}

/** Admins only: add a testimonial. Multipart form: name, quote, image (JPEG, PNG or WebP, up to 512 KiB). */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.admin) return fail(403, "admins only");
  const form = await req.formData().catch(() => null);
  const name = String(form?.get("name") ?? "").trim();
  const quote = String(form?.get("quote") ?? "").trim();
  const image = form?.get("image");
  if (!name || name.length > 80) return fail(400, "name: 1 to 80 characters");
  if (!quote || quote.length > 500) return fail(400, "testimonial: 1 to 500 characters");
  if (!(image instanceof File)) return fail(400, "attach an image");
  if (!IMAGE_TYPES.includes(image.type)) return fail(400, "image must be JPEG, PNG or WebP");
  if (image.size > MAX_IMAGE) return fail(400, "image must be 512 KiB or smaller");
  return Response.json(addTestimonial(name, quote, image.type, Buffer.from(await image.arrayBuffer())), { status: 201 });
}
