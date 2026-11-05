import { ExpirationTime } from "@arkiv-network/sdk";
import { asc, eq } from "@arkiv-network/sdk/query";
import { addr, key, u256, u64 } from "@arkiv-network/sdk/schema";
import { createPublicClient, formatEther, http, isHex } from "viem";
import { activeSubscriptions } from "@/lib/access";
import { arkivPublic, arkivWallet, gatewayAddress, need } from "@/lib/arkiv";
import { galileo } from "@/lib/chains";
import { checkPayment, MAX_PREPAID_SECONDS, nextPaidUntil } from "@/lib/payment";
import { Datasets, Subscriptions } from "@/lib/schema";
import { getSession, unauthorized } from "@/lib/session";

const fail = (status: number, error: string) => Response.json({ error }, { status });
const og = () => createPublicClient({ chain: galileo, transport: http(process.env.OG_RPC_URL) });

/** The viewer's paid periods (admins: everyone's), newest first. */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const pub = arkivPublic();
  const q = pub.select().from(Subscriptions, { onMismatch: "skip" }).ownedBy(gatewayAddress()).orderBy(asc("$key")).limit(100);
  // shortcut: one page of 100 periods; page by key for busier wallets.
  const { entities } = await (session.admin ? q : q.where(eq("subscriber", addr(session.address)))).fetch();
  const names = new Map<string, string>();
  for (const s of entities) {
    if (!names.has(s.dataset.value)) names.set(s.dataset.value, (await pub.getEntity(s.dataset.value, Datasets).catch(() => null))?.name.value ?? "(expired dataset)");
  }
  const rows = entities.map((s) => ({
    key: s.$key, subscriber: s.subscriber.value, dataset: s.dataset.value, datasetName: names.get(s.dataset.value),
    txHash: s.txHash.value, amount: formatEther(s.amount.value), paidUntil: Number(s.paidUntil.value),
    active: Number(s.paidUntil.value) > Date.now() / 1000,
    createdAtBlock: s.$createdAt?.toString(),
  }));
  return Response.json({ subscriptions: rows.sort((a, b) => b.paidUntil - a.paidUntil) });
}

/**
 * Record a payment: POST {"dataset": key, "txHash": 0G Galileo tx}. The tx must come from the signed-in wallet,
 * pay at least the price to TREASURY_ADDRESS, carry the dataset key as its data, and not be used before.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  const b = await req.json().catch(() => null);
  if (!isHex(b?.dataset) || b.dataset.length !== 66 || !isHex(b?.txHash) || b.txHash.length !== 66) return fail(400, "need dataset and txHash (32-byte hex)");
  const dataset = b.dataset.toLowerCase() as `0x${string}`;
  const txHash = b.txHash.toLowerCase() as `0x${string}`;

  const pub = arkivPublic();
  const gateway = gatewayAddress();
  const d = await pub.getEntity(dataset, Datasets).catch(() => null);
  if (!d || d.$owner.toLowerCase() !== gateway.toLowerCase()) return fail(404, "dataset not found");
  if (!d.active.value) return fail(409, "dataset is not for sale");

  const used = await pub.select({ $key: true }).from(Subscriptions).where(eq("txHash", txHash)).ownedBy(gateway).limit(1).fetch();
  if (used.entities.length) return fail(409, "this payment was already used");

  const chain = og();
  const [tx, receipt] = await Promise.all([
    chain.getTransaction({ hash: txHash }).catch(() => null),
    chain.getTransactionReceipt({ hash: txHash }).catch(() => null),
  ]);
  if (!tx || !receipt) return fail(425, "transaction not found or not mined yet; retry in a few seconds");
  const bad = checkPayment(tx, receipt, { payer: session.address, treasury: need("TREASURY_ADDRESS"), dataset, price: d.price.value });
  if (bad) return fail(402, bad);

  const now = Math.floor(Date.now() / 1000);
  const current = (await activeSubscriptions(session.address)).find((s) => s.key.toLowerCase() === dataset)?.paidUntil ?? 0;
  const paidUntil = nextPaidUntil(current, now);
  if (paidUntil - now > MAX_PREPAID_SECONDS) return fail(409, "already prepaid for the maximum period");

  // shortcut: the used-tx check and this write can race if the same tx is posted twice at once; add a lock for real money.
  const { entityKey, txHash: arkivTx } = await arkivWallet().createEntity(
    Subscriptions,
    { subscriber: addr(session.address), dataset: key(dataset), txHash, amount: u256(tx.value), paidUntil: u64(paidUntil) },
    { expiration: ExpirationTime.atDate(new Date((paidUntil + 7 * 86_400) * 1000)) },
  );
  return Response.json({ key: entityKey, arkivTx, paidUntil }, { status: 201 });
}
