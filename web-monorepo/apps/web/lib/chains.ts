// 0G Galileo testnet: where labs pay for dataset subscriptions. Shared by browser and server.
import { defineChain } from "viem";

export const galileo = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: { default: { name: "0G Chainscan", url: "https://chainscan-galileo.0g.ai" } },
  testnet: true,
});

export const ARKIV_EXPLORER = "https://rabdi.explorer.arkiv.network";
// shortcut: explorer URL paths assumed Etherscan/Blockscout-style (/tx/<hash>); adjust if either explorer differs.
export const ogTxUrl = (h: string) => `${galileo.blockExplorers.default.url}/tx/${h}`;
export const arkivTxUrl = (h: string) => `${ARKIV_EXPLORER}/tx/${h}`;
