// shortcut: hex cells, votes and devices are generated from a seed, no backend; replace with the coordinator's per-cell batch API.
import { cellToBoundary, gridDisk, gridDistance, latLngToCell } from "h3-js";
import type { Dataset, Sample } from "@/lib/data";

export const CITIES: Record<string, [lat: number, lng: number]> = {
  "Bengaluru, IN": [12.9716, 77.5946], "Mumbai, IN": [19.076, 72.8777], "Delhi, IN": [28.6139, 77.209],
  "Berlin, DE": [52.52, 13.405], "Munich, DE": [48.1351, 11.582], "Stuttgart, DE": [48.7758, 9.1829],
  "Austin, US": [30.2672, -97.7431], "Detroit, US": [42.3314, -83.0458], "Tokyo, JP": [35.6762, 139.6503],
  "São Paulo, BR": [-23.5505, -46.6333], "Lagos, NG": [6.5244, 3.3792], "Jakarta, ID": [-6.2088, 106.8456],
};

export type Status = Sample["status"];
/** One committee member's revealed vote; `score: null` means the validator committed but never revealed (slashable). */
export type Vote = { validator: string; stake: number; score: number | null };

export type Cell = {
  id: string;
  area: string;
  ring: [number, number][];
  samples30d: number;
  devices: string[];
  modalities: string[];
  quality: number;
  votes: Vote[];
  consensus: number;
  quorum: number;
  windowHours: number;
  status: Status;
};

export const RES = 8;
export const COMMITTEE = 7;
export const ACCEPT_SCORE = 0.7;
export const SUPERMAJORITY = 2 / 3;
const RINGS = 5;

/** Stake-weighted tally: `consensus` is the share of revealed stake that scored at or above ACCEPT_SCORE, `quorum` the share of stake that revealed at all. */
export function tally(votes: Vote[]) {
  const sum = (vs: Vote[]) => vs.reduce((s, v) => s + v.stake, 0);
  const revealed = votes.filter((v) => v.score !== null);
  const stake = sum(revealed);
  return { consensus: stake ? sum(revealed.filter((v) => v.score! >= ACCEPT_SCORE)) / stake : 0, quorum: stake / sum(votes) };
}

/** Accepted only with quorum, a supermajority and a closed challenge window; a clear minority rejects; everything else stays open to challenge. */
export function verdict(consensus: number, quorum: number, windowHours: number): Status {
  if (quorum >= SUPERMAJORITY && consensus < 1 - SUPERMAJORITY) return "rejected";
  if (quorum >= SUPERMAJORITY && consensus >= SUPERMAJORITY && windowHours === 0) return "verified";
  return "challenge";
}

const seeded = (key: string) => {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const hexStr = (r: () => number, n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join("");

export const areasOf = (d: Dataset) => [...new Set(d.preview.map((s) => s.place))].filter((p) => p in CITIES);

export function cellsFor(d: Dataset): Cell[] {
  const validators = Array.from({ length: 86 }, (_, i) => {
    const r = seeded(`val-${i}`);
    return { validator: `0x${hexStr(r, 4)}…${hexStr(r, 4)}`, stake: 500 + Math.round(r() * 4500) };
  });

  return areasOf(d).flatMap((area) => {
    const [lat, lng] = CITIES[area];
    const origin = latLngToCell(lat, lng, RES);
    const pool = Array.from({ length: 12 }, (_, i) => { const r = seeded(`${d.id}-${area}-${i}`); return `0x${hexStr(r, 4)}…${hexStr(r, 4)}`; });

    return gridDisk(origin, RINGS).flatMap((id) => {
      const r = seeded(`${d.id}-${id}`);
      const dist = gridDistance(origin, id);
      if (r() < dist / (RINGS + 2)) return [];

      const truth = r() < 0.12 ? 0.25 + r() * 0.3 : 0.7 + r() * 0.29;
      const votes = Array.from({ length: COMMITTEE }, () => {
        const v = validators[Math.floor(r() * validators.length)];
        const score = r() < 0.07 ? null : Math.round(Math.min(1, Math.max(0, truth + (r() - 0.5) * 0.3)) * 100) / 100;
        return { ...v, score };
      });
      const { consensus, quorum } = tally(votes);
      const windowHours = r() < 0.3 ? 1 + Math.floor(r() * 71) : 0;

      return [{
        id, area,
        ring: cellToBoundary(id, true) as [number, number][],
        samples30d: Math.round((1 - dist / (RINGS + 1)) * (200 + r() * 2400)),
        devices: pool.filter(() => r() < 0.25).slice(0, 4).concat(pool[Math.floor(r() * pool.length)]).filter((v, i, a) => a.indexOf(v) === i),
        modalities: d.modalities.filter(() => r() < 0.8),
        quality: truth,
        votes, consensus, quorum, windowHours,
        status: verdict(consensus, quorum, windowHours),
      }];
    });
  });
}
