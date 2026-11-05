// The thinning rule. The gateway's extend job and the lab's ingest job (thinned mode) must agree on it.

/** The (device, geohash cell, time window) group a sample belongs to. */
export const groupOf = (s: { device: string; geohash: string; capturedAt: bigint }, precision: number, windowSeconds: number) => {
  const start = (s.capturedAt / BigInt(windowSeconds)) * BigInt(windowSeconds);
  const cell = s.geohash.slice(0, precision);
  return { id: `${s.device.toLowerCase()}|${cell}|${start}`, device: s.device, cell, start, end: start + BigInt(windowSeconds) - 1n };
};

/** Picks the one sample a group keeps: earliest capture, ties broken by key. */
export const thinGroup = <K extends string>(members: { key: K; capturedAt: bigint }[]): K | undefined =>
  members.reduce<{ key: K; capturedAt: bigint } | undefined>(
    (best, m) => (!best || m.capturedAt < best.capturedAt || (m.capturedAt === best.capturedAt && m.key < best.key) ? m : best),
    undefined,
  )?.key;
