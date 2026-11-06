import { addTestimonial, listTestimonials, readFields } from "@/lib/testimonials";
import { getSession, unauthorized } from "@/lib/session";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Public: every testimonial, newest first. */
export async function GET() {
  return Response.json({ testimonials: listTestimonials() });
}

/** Admins only: add a testimonial. Multipart form: name, role, quote, image (JPEG, PNG or WebP, up to 512 KiB). */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.admin) return fail(403, "admins only");
  const f = await readFields(await req.formData().catch(() => null), true);
  if (typeof f === "string") return fail(400, f);
  return Response.json(addTestimonial(f), { status: 201 });
}
