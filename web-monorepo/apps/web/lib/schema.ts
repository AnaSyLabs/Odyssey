// Arkiv schemas. Shared by the gateway and the Node scripts, so no "server-only" or "@/" imports.
import { addr, bool, bytes, dec, defineSchema, key, str, u256, u64 } from "@arkiv-network/sdk/schema";

/** One captured sample. Created readonly by the gateway wallet; only the gateway can extend it. */
export const Samples = defineSchema("odsy.samples", {
  device: addr().indexed(), // address recovered from the device signature
  worldId: str().indexed(), // World ID nullifier bound to the device at registration
  deviceType: str().indexed(),
  mac: str().indexed(),
  kind: str().indexed(),
  capturedAt: u64().indexed(),
  lat: dec().indexed(),
  lon: dec().indexed(),
  geohash: str().indexed(), // precision 9, see lib/geo.ts
  contentHash: str().indexed(), // sha256 of the raw (plaintext) payload
  storage: str().indexed(), // "inline" | "0g"
  ogRoot: str().optional(), // 0G Storage merkle root when storage = "0g"
  mime: str(),
  size: u64(),
  sensors: bytes(), // JSON text as signed; encrypted when enc is set
  signature: bytes(),
  data: bytes().optional(), // the payload when storage = "inline"; encrypted when enc is set
  enc: str().optional(), // "aes-256-gcm-v1"; absent on early plaintext samples
  sensorsHash: str().optional(), // sha256 of the plaintext sensors JSON, so anyone can check the signature
});

/** Device registry, written by the World ID registration flow (POST /api/devices). */
export const Devices = defineSchema("odsy.devices", {
  device: addr().indexed(),
  worldId: str().indexed(),
  deviceType: str().indexed(),
  mac: str().indexed(),
  payout: addr().optional(), // the owner's wallet for contributor rewards; never the key on the glasses
});

/** A dataset is a saved filter over samples, sold as a 30-day subscription paid in 0G. Empty kind/deviceType and 0 from/to mean "any". */
export const Datasets = defineSchema("odsy.datasets", {
  name: str(),
  description: bytes(), // UTF-8, may exceed the 128-byte str limit
  lat: dec(),
  lon: dec(),
  radiusM: u64(),
  kind: str(),
  deviceType: str(),
  fromTs: u64(),
  toTs: u64(),
  price: u256(), // wei of 0G per 30 days
  active: bool().indexed(),
});

/** Legacy: paid periods recorded before the OdsySubscriptions contract. Still honoured until they lapse. */
export const Subscriptions = defineSchema("odsy.subscriptions", {
  subscriber: addr().indexed(),
  dataset: key().indexed(),
  txHash: str().indexed(), // the 0G Galileo payment, each usable once
  amount: u256(),
  paidUntil: u64().indexed(), // unix seconds
});

/** One published contributor-reward epoch: the leaves behind the contract's Merkle root, so claimants can get proofs. */
export const Rewards = defineSchema("odsy.rewards", {
  epoch: u64().indexed(),
  root: str().indexed(),
  total: u256(),
  throughBlock: u64(),
  leaves: bytes(), // JSON [[account, amountWei], ...]
});
