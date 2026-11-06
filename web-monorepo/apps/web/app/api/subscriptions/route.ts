import { asc, eq } from "@arkiv-network/sdk/query";
import { addr } from "@arkiv-network/sdk/schema";
import { formatEther } from "viem";
import { arkivPublic, gatewayAddress } from "@/lib/arkiv";
import { ogPublic, subscribedEvents } from "@/lib/contract";
import { Datasets, Subscriptions } from "@/lib/schema";
import { getSession, unauthorized } from "@/lib/session";

/**
 * The viewer's subscription payments (admins: everyone's), newest first: `Subscribed` events from the contract,
 * plus legacy periods recorded on Arkiv before it shipped. Subscribing itself is a call to the contract.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const pub = arkivPublic();
  const legacyQ = pub.select().from(Subscriptions, { onMismatch: "skip" }).ownedBy(gatewayAddress()).orderBy(asc("$key")).limit(100);
  const [events, legacy] = await Promise.all([
    subscribedEvents(session.admin ? undefined : session.address),
    (session.admin ? legacyQ : legacyQ.where(eq("subscriber", addr(session.address)))).fetch(),
  ]);

  const now = Date.now() / 1000;
  // When each payment was made: the block's timestamp. shortcut: one RPC call per distinct block; cache once history is long.
  const paidAt = new Map<bigint, number>();
  for (const b of new Set(events.map((e) => e.blockNumber))) {
    paidAt.set(b, Number((await ogPublic().getBlock({ blockNumber: b })).timestamp));
  }
  const rows = [
    ...events.map((e) => ({
      key: `${e.transactionHash}-${e.logIndex}`, subscriber: e.args.subscriber!, dataset: e.args.dataset!, txHash: e.transactionHash,
      amount: formatEther(e.args.amount!), toContributors: formatEther(e.args.toContributors!), paidUntil: Number(e.args.paidUntil), paidAt: paidAt.get(e.blockNumber), legacy: false,
    })),
    ...legacy.entities.map((s) => ({
      key: s.$key, subscriber: s.subscriber.value, dataset: s.dataset.value, txHash: s.txHash.value,
      amount: formatEther(s.amount.value), toContributors: "0", paidUntil: Number(s.paidUntil.value), paidAt: undefined, legacy: true,
    })),
  ];
  const names = new Map<string, string>();
  for (const d of new Set(rows.map((r) => r.dataset.toLowerCase()))) {
    names.set(d, (await pub.getEntity(d as `0x${string}`, Datasets).catch(() => null))?.name.value ?? "(expired dataset)");
  }
  return Response.json({
    subscriptions: rows
      .map((r) => ({ ...r, datasetName: names.get(r.dataset.toLowerCase()), active: r.paidUntil > now }))
      .sort((a, b) => b.paidUntil - a.paidUntil),
  });
}
