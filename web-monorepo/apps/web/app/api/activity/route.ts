import { ENTITY_EVENTS_ABI } from "@arkiv-network/sdk";
import { eq, or } from "@arkiv-network/sdk/query";
import { addr, key } from "@arkiv-network/sdk/schema";
import { getAbiItem, type Hex } from "viem";
import { arkivPublic, gatewayAddress } from "@/lib/arkiv";
import { Subscriptions } from "@/lib/schema";
import { getSession, unauthorized } from "@/lib/session";

// The Arkiv system contract every entity operation emits its events from (SDK consts, not exported).
const ARKIV_ADDRESS = "0x4400000000000000000000000000000000000044";
const CHUNK = 10_000n; // blocks per eth_getLogs call
// shortcut: looks back at most ~7 days (2 s blocks); index events into a table if you need full history.
const MAX_CHUNKS = 30;
const LIMIT = 50;

type Event = { txHash: Hex; block: string; type: string; entityKey: Hex; schema?: string; label?: string };

/** Labels entities by their schema tag, 25 keys per query. Expired entities keep no label. */
async function label(events: Event[]) {
  const pub = arkivPublic();
  const keys = [...new Set(events.map((e) => e.entityKey))];
  const found = new Map<string, { schema?: string; label?: string }>();
  for (let i = 0; i < keys.length; i += 25) {
    const { entities } = await pub
      .select({ $key: true, "arkiv.schema": true, kind: true, name: true, deviceType: true, txHash: true })
      .where(or(keys.slice(i, i + 25).map((k) => eq("$key", key(k)))))
      .limit(100)
      .fetch();
    for (const e of entities) {
      const v = (a?: { value: unknown }) => (a?.value == null ? undefined : String(a.value));
      found.set(e.$key, { schema: v(e["arkiv.schema"]), label: v(e.kind) ?? v(e.name) ?? v(e.deviceType) ?? v(e.txHash) });
    }
  }
  return events.map((e) => ({ ...e, ...found.get(e.entityKey) }));
}

/**
 * Arkiv transactions. Admins: every recent entity the gateway created, patched or extended (samples, devices,
 * datasets, subscriptions). Labs: the Arkiv records of their own subscriptions (payments are listed by /api/subscriptions).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const pub = arkivPublic();
  const gateway = gatewayAddress();
  const latest = await pub.getBlockNumber();

  let entityKeys: Hex[] | undefined;
  if (!session.admin) {
    const { entities } = await pub.select({ $key: true }).from(Subscriptions)
      .where(eq("subscriber", addr(session.address))).ownedBy(gateway).limit(100).fetch();
    entityKeys = entities.map((e) => e.$key);
    if (!entityKeys.length) return Response.json({ events: [], latestBlock: latest.toString() });
  }

  const events: Event[] = [];
  for (let i = 0, to = latest; i < MAX_CHUNKS && events.length < LIMIT && to > 0n; i++, to -= CHUNK) {
    const range = { fromBlock: to > CHUNK ? to - CHUNK + 1n : 0n, toBlock: to };
    const args = { owner: gateway, ...(entityKeys && { entityKey: entityKeys }) };
    const logs = (await Promise.all([
      pub.getLogs({ address: ARKIV_ADDRESS, event: getAbiItem({ abi: ENTITY_EVENTS_ABI, name: "EntityCreated" }), args, ...range }),
      pub.getLogs({ address: ARKIV_ADDRESS, event: getAbiItem({ abi: ENTITY_EVENTS_ABI, name: "EntityPatched" }), args, ...range }),
      pub.getLogs({ address: ARKIV_ADDRESS, event: getAbiItem({ abi: ENTITY_EVENTS_ABI, name: "ExpiryExtended" }), args, ...range }),
    ])).flat().sort((a, b) => Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n)) || (a.logIndex ?? 0) - (b.logIndex ?? 0));
    for (const l of logs.reverse()) {
      const a = l.args as { entityKey?: Hex };
      if (a.entityKey && l.transactionHash) {
        events.push({ txHash: l.transactionHash, block: l.blockNumber!.toString(), type: l.eventName, entityKey: a.entityKey });
      }
    }
  }
  return Response.json({ events: await label(events.slice(0, LIMIT)), latestBlock: latest.toString() });
}
