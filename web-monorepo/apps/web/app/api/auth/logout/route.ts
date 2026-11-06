import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { route } from "@/lib/api";

export const POST = route(async function POST() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
});
