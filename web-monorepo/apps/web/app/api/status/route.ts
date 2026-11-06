import { hubState } from "@/lib/hub";

export async function GET() {
  const { latest_frame_bytes, ...publicState } = hubState;
  return Response.json(publicState, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
