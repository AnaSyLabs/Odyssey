import "server-only";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { JsonRpcProvider, Wallet } from "ethers";
import { need } from "@/lib/arkiv";

const RPC = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const INDEXER = process.env.OG_INDEXER_URL ?? "https://indexer-storage-testnet-turbo.0g.ai";

/** Uploads a payload (already encrypted by the caller) to 0G Storage and returns its merkle root. */
export async function uploadTo0G(data: Uint8Array): Promise<string> {
  const signer = new Wallet(need("OG_PRIVATE_KEY"), new JsonRpcProvider(RPC));
  const [res, err] = await new Indexer(INDEXER).upload(new MemData(data), RPC, signer);
  if (err) throw new Error(`0G upload failed: ${err.message}`);
  if (!("rootHash" in res)) throw new Error("0G split the payload into fragments; raise the fragment size or lower MAX_UPLOAD_BYTES");
  return res.rootHash;
}

/** Downloads a payload from 0G Storage with merkle proof verification. */
export async function downloadFrom0G(root: string): Promise<Buffer> {
  const path = join(tmpdir(), `odsy-${randomUUID()}`);
  try {
    const err = await new Indexer(INDEXER).download(root, path, true);
    if (err) throw new Error(`0G download failed: ${err.message}`);
    return await readFile(path);
  } finally {
    await rm(path, { force: true });
  }
}
