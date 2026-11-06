import { testimonialImage } from "@/lib/testimonials";
import { fail, route } from "@/lib/api";

/** Public: an uploaded testimonial image. The list adds ?v= so an edit gets a fresh URL. */
export const GET = route(async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const img = testimonialImage((await params).id);
  if (!img) return fail(404, "not found");
  return new Response(new Uint8Array(img.data), {
    headers: {
      "content-type": img.mime,
      "cache-control": "public, max-age=86400, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
    },
  });
});
