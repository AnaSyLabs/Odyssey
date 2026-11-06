import { testimonialImage } from "@/lib/testimonials";

/** Public: a testimonial's image. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = testimonialImage((await params).id);
  if (!t) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(new Uint8Array(t.image), {
    headers: {
      "content-type": t.mime,
      "cache-control": "public, max-age=86400, immutable", // a testimonial's image never changes
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
    },
  });
}
