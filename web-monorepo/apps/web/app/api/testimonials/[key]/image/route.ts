import { IMAGE_TYPES, testimonialImage } from "@/lib/testimonials";

/** Public: a testimonial's image. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const img = await testimonialImage((await params).key);
  if (!img || !IMAGE_TYPES.includes(img.mime)) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "content-type": img.mime,
      "cache-control": "public, max-age=86400, immutable", // entities are written once and never updated
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
    },
  });
}
