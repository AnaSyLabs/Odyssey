import { connection } from "next/server";
import { galileo } from "@/lib/chains";
import { need } from "@/lib/arkiv";

/** Public settings the browser needs to pay: the treasury address and the payment chain. */
export async function GET() {
  await connection(); // read env at request time, not at build
  return Response.json({ treasury: need("TREASURY_ADDRESS"), chainId: galileo.id });
}
