import { getSession } from "@/lib/session";
import { route } from "@/lib/api";

export const GET = route(async function GET() {
  const s = await getSession();
  return Response.json(s ? { address: s.address, admin: s.admin, exp: s.exp } : null);
});
