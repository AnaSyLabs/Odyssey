// Reads "address\tsignature\tmessage" lines from crypto_test and checks viem recovers each address,
// exactly as web-monorepo/apps/web/app/api/ingest/route.ts does. Exits 1 on any mismatch.
import { createRequire } from "node:module";
import { createInterface } from "node:readline";

const require = createRequire(new URL("../../../web-monorepo/apps/web/package.json", import.meta.url));
const { recoverMessageAddress } = require("viem");

let n = 0;
for await (const line of createInterface({ input: process.stdin })) {
  const [address, signature, message] = line.split("\t");
  const got = await recoverMessageAddress({ message, signature });
  if (got.toLowerCase() !== address) {
    console.error(`MISMATCH: ${message}\n  want ${address}\n  got  ${got}`);
    process.exit(1);
  }
  n++;
}
if (!n) {
  console.error("no signatures read");
  process.exit(1);
}
console.log(`${n} device signatures recovered by viem: OK`);
