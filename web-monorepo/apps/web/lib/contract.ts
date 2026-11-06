import "server-only";
import { createPublicClient, createWalletClient, getAddress, http, isAddress, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { need } from "@/lib/arkiv";
import { galileo } from "@/lib/chains";
import { subscriptionsAbi } from "@/lib/subscriptions-abi";

/** The OdsySubscriptions contract on 0G Galileo (contracts/src/OdsySubscriptions.sol). */
export const subscriptionsAddress = () => {
  const a = need("SUBSCRIPTIONS_ADDRESS");
  if (!isAddress(a)) throw new Error("SUBSCRIPTIONS_ADDRESS must be an address");
  return getAddress(a);
};

export const ogPublic = () => createPublicClient({ chain: galileo, transport: http(process.env.OG_RPC_URL) });

/** The contract owner: sets prices. OG_PRIVATE_KEY must be the key the contract was deployed with (or OWNER). */
export const ogOwner = () => {
  const key = need("OG_PRIVATE_KEY");
  if (!isHex(key)) throw new Error("OG_PRIVATE_KEY must be 0x-prefixed hex");
  return createWalletClient({ chain: galileo, transport: http(process.env.OG_RPC_URL), account: privateKeyToAccount(key) });
};

/** Lists `dataset` on the contract at `price` wei per 30 days (0 unlists). Resolves once mined. */
export async function setContractPrice(dataset: `0x${string}`, price: bigint) {
  const hash = await ogOwner().writeContract({ address: subscriptionsAddress(), abi: subscriptionsAbi, functionName: "setPrice", args: [dataset, price] });
  const receipt = await ogPublic().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`setPrice reverted: ${hash}`);
  return hash;
}

/** paidUntil (unix seconds) for each dataset, read from the contract. */
export async function contractPaidUntil(subscriber: `0x${string}`, datasets: `0x${string}`[]) {
  const pub = ogPublic();
  const address = subscriptionsAddress();
  // shortcut: one RPC call per dataset; switch to multicall once the catalogue grows past a few dozen.
  const until = await Promise.all(datasets.map((d) => pub.readContract({ address, abi: subscriptionsAbi, functionName: "paidUntil", args: [subscriber, d] })));
  return new Map(datasets.map((d, i) => [d.toLowerCase(), Number(until[i])]));
}

const LOG_CHUNK = 10_000n; // shortcut: blocks per eth_getLogs call; index events into a table once the history is long

/** `Subscribed` events since the contract was deployed (SUBSCRIPTIONS_FROM_BLOCK), optionally for one subscriber. */
export async function subscribedEvents(subscriber?: `0x${string}`) {
  const pub = ogPublic();
  const address = subscriptionsAddress();
  const latest = await pub.getBlockNumber();
  const out = [];
  for (let from = BigInt(need("SUBSCRIPTIONS_FROM_BLOCK")); from <= latest; from += LOG_CHUNK) {
    const to = from + LOG_CHUNK - 1n < latest ? from + LOG_CHUNK - 1n : latest;
    out.push(...(await pub.getContractEvents({ address, abi: subscriptionsAbi, eventName: "Subscribed", args: subscriber ? { subscriber } : undefined, fromBlock: from, toBlock: to })));
  }
  return out;
}
