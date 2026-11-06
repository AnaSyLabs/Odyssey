import { readFields, updateTestimonial } from "@/lib/testimonials";
import { getSession, unauthorized } from "@/lib/session";
import { fail, route } from "@/lib/api";

/** Admins only: edit a testimonial. Multipart form: name, role, quote, and optionally a new image. */
export const PATCH = route(async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.admin) return fail(403, "admins only");
  const f = await readFields(await req.formData().catch(() => null), false);
  if (typeof f === "string") return fail(400, f);
  if (!updateTestimonial((await params).id, f)) return fail(404, "no such testimonial");
  return Response.json({ updated: true });
});
