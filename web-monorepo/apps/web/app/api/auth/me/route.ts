import { getSession } from "@/lib/session";

export async function GET() {
  const s = await getSession();
  return Response.json(s ? { address: s.address, admin: s.admin, exp: s.exp } : null);
}
