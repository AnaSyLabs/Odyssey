import { ExpirationTime } from "@arkiv-network/sdk";
import { asc, eq } from "@arkiv-network/sdk/query";
import { bool, dec, u256, u64 } from "@arkiv-network/sdk/schema";
import { formatEther, parseEther } from "viem";
import { activeSubscriptions } from "@/lib/access";
import { arkivPublic, arkivWallet, gatewayAddress } from "@/lib/arkiv";
import { setContractPrice } from "@/lib/contract";
import { datasetFilter } from "@/lib/filters";
import { findSamples } from "@/lib/query";
import { KINDS, type Kind } from "@/lib/sample";
import { Datasets } from "@/lib/schema";
import { getSession, unauthorized } from "@/lib/session";
import { fail, route } from "@/lib/api";

const DECIMAL = /^-?\d{1,3}(\.\d{1,9})?$/;

/** Datasets for sale (admins also see inactive ones), with sample counts and the viewer's subscription. */
export const GET = route(async function GET() {
  const session = await getSession();
  const pub = arkivPublic();
  // shortcut: one page of 100 datasets, and counts scan each dataset's samples; cache both when the catalogue grows.
  const q = pub.select().from(Datasets, { onMismatch: "skip" }).ownedBy(gatewayAddress()).orderBy(asc("$key")).limit(100);
  const { entities } = await (session?.admin ? q : q.where(eq("active", true))).fetch();
  const mine = session ? await activeSubscriptions(session.address) : [];
  const datasets = await Promise.all(entities.map(async (d) => {
    const f = datasetFilter(d);
    const { hits, truncated } = await findSamples(f);
    return {
      key: d.$key, name: d.name.value, description: Buffer.from(d.description.value.slice(2), "hex").toString("utf8"), ...f,
      price: d.price.value.toString(), priceDisplay: formatEther(d.price.value), active: d.active.value,
      samples: hits.length, samplesTruncated: truncated, kinds: [...new Set(hits.map((h) => h.kind))],
      paidUntil: mine.find((m) => m.key.toLowerCase() === d.$key.toLowerCase())?.paidUntil ?? null,
    };
  }));
  return Response.json({ datasets });
});

/** Admin: create a dataset (a saved filter + a price in 0G per 30 days) and list it on the subscriptions contract. */
export const POST = route(async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.admin) return fail(403, "admins only");
  const b = await req.json().catch(() => null);
  if (!b) return fail(400, "body must be JSON");
  const name = String(b.name ?? "").trim();
  const description = String(b.description ?? "").trim();
  if (!name || Buffer.byteLength(name) > 128) return fail(400, "name: 1-128 bytes");
  if (Buffer.byteLength(description) > 4096) return fail(400, "description: up to 4 KiB");
  if (!DECIMAL.test(String(b.lat)) || Math.abs(Number(b.lat)) > 90) return fail(400, "lat must be a decimal in [-90, 90]");
  if (!DECIMAL.test(String(b.lon)) || Math.abs(Number(b.lon)) > 180) return fail(400, "lon must be a decimal in [-180, 180]");
  const radiusM = Number(b.radiusM);
  if (!Number.isInteger(radiusM) || radiusM < 1 || radiusM > 50_000) return fail(400, "radiusM: 1-50000");
  const kind = String(b.kind ?? "");
  if (kind && !KINDS.includes(kind as Kind)) return fail(400, `kind: empty or one of ${KINDS.join(", ")}`);
  const deviceType = String(b.deviceType ?? "");
  if (deviceType && !/^[\w.-]{1,64}$/.test(deviceType)) return fail(400, "bad deviceType");
  const [fromTs, toTs] = [Number(b.fromTs ?? 0), Number(b.toTs ?? 0)];
  if (!Number.isInteger(fromTs) || !Number.isInteger(toTs) || fromTs < 0 || toTs < 0 || (toTs && toTs < fromTs)) return fail(400, "bad time range");
  let price: bigint;
  try {
    price = parseEther(String(b.price));
  } catch {
    return fail(400, "price must be a number of 0G");
  }
  if (price <= 0n) return fail(400, "price must be above 0");

  const { entityKey, txHash } = await arkivWallet().createEntity(
    Datasets,
    {
      name, description: new TextEncoder().encode(description), lat: dec(String(b.lat)), lon: dec(String(b.lon)),
      radiusM: u64(radiusM), kind, deviceType, fromTs: u64(fromTs), toTs: u64(toTs), price: u256(price), active: bool(true),
    },
    { expiration: ExpirationTime.max() },
  );
  // The contract is what labs pay; if listing it there fails, "List dataset for sale" retries it.
  const priceTx = await setContractPrice(entityKey, price).catch((e: Error) => e);
  if (priceTx instanceof Error) return Response.json({ key: entityKey, txHash, error: `Saved on Arkiv, but listing it on the subscriptions contract failed: ${priceTx.message}. Refresh, then unlist and list the dataset again to retry.` }, { status: 502 });
  return Response.json({ key: entityKey, txHash, priceTx }, { status: 201 });
});
