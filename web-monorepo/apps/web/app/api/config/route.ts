import { connection } from "next/server";
import { galileo } from "@/lib/chains";
import { subscriptionsAddress } from "@/lib/contract";

/** Public settings the browser needs to pay: the subscriptions contract and its chain. */
export async function GET() {
  await connection(); // read env at request time, not at build
  return Response.json({ contract: subscriptionsAddress(), chainId: galileo.id });
}
