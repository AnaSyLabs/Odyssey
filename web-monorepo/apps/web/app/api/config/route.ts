import { connection } from "next/server";
import { galileo } from "@/lib/chains";
import { subscriptionsAddress } from "@/lib/contract";
import { route } from "@/lib/api";

/** Public settings the browser needs to pay: the subscriptions contract and its chain. */
export const GET = route(async function GET() {
  await connection(); // read env at request time, not at build
  return Response.json({ contract: subscriptionsAddress(), chainId: galileo.id });
});
