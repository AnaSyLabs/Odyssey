import { getAddress, isAddress } from "viem";
import { grantAdmin, isRootAdmin, listAdmins, revokeAdmin } from "@/lib/admins";
import { getSession, unauthorized } from "@/lib/session";
import { fail, route } from "@/lib/api";

/** Admins only: the root admins (ADMIN_ADDRESSES) and the wallets granted admin from the /admin page. */
export const GET = route(async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.admin) return fail(403, "admins only");
  return Response.json({ me: session.address, admins: await listAdmins() });
});

/** Admins only: make a wallet an admin. Body: { address }. */
export const POST = route(async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.admin) return fail(403, "admins only");
  const b = await req.json().catch(() => null);
  if (!b || typeof b.address !== "string" || !isAddress(b.address.trim())) return fail(400, "address must be a 0x wallet address");
  const address = getAddress(b.address.trim());
  const granted = await grantAdmin(address, session.address);
  if (!granted) return fail(409, "that wallet is already an admin");
  return Response.json({ address, ...granted }, { status: 201 });
});

/** Admins only: remove a granted admin. Query: ?address=0x... Root admins and your own wallet can't be removed here. */
export const DELETE = route(async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.admin) return fail(403, "admins only");
  const raw = new URL(req.url).searchParams.get("address")?.trim() ?? "";
  if (!isAddress(raw)) return fail(400, "address must be a 0x wallet address");
  const address = getAddress(raw);
  if (isRootAdmin(address)) return fail(400, "root admins are set in ADMIN_ADDRESSES and can't be removed here");
  if (address.toLowerCase() === session.address.toLowerCase()) return fail(400, "you can't remove yourself; ask another admin");
  if (!(await revokeAdmin(address))) return fail(404, "that wallet wasn't granted admin from this page");
  return Response.json({ address, removed: true });
});
