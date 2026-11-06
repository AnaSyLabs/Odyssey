import { testimonialImage } from "@/lib/testimonials";

/** Public: an uploaded testimonial image. The list adds ?v= so an edit gets a fresh URL. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const img = testimonialImage((await params).id);
  if (!img) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "content-type": img.mime,
      "cache-control": "public, max-age=86400, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
    },
  });
}
