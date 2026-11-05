// shortcut: static demo data, no backend; replace with the gateway API once Phase 1 ships.

export type Sample = {
  id: string;
  device: string;
  at: string;
  place: string;
  seconds: number;
  hash: string;
  signature: string;
  witnesses: number;
  score: number;
  status: "verified" | "challenge" | "rejected";
};

export type Dataset = {
  id: string;
  name: string;
  blurb: string;
  modalities: string[];
  hours: number;
  samples: number;
  devices: number;
  regions: string[];
  quality: number;
  price: number;
  license: "Research" | "Commercial" | "Exclusive";
  batchRoot: string;
  anchoredAt: string;
  preview: Sample[];
};

export const hex = (seed: number, len: number) => {
  let x = Math.imul(seed + 1, 2654435761) >>> 0;
  let out = "";
  while (out.length < len) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    out += x.toString(16).padStart(8, "0");
  }
  return `0x${out.slice(0, len)}`;
};

const sample = (seed: number, place: string, status: Sample["status"] = "verified"): Sample => ({
  id: `s-${seed}`,
  device: `glasses-${hex(seed + 7, 6).slice(2)}`,
  at: new Date(Date.UTC(2026, 9, 1 + (seed % 28), 6 + (seed % 14), (seed * 7) % 60)).toISOString(),
  place,
  seconds: 10,
  hash: hex(seed, 64),
  signature: hex(seed + 99, 130),
  witnesses: seed % 4,
  score: status === "rejected" ? 0.21 : 0.78 + ((seed * 13) % 21) / 100,
  status,
});

export const DATASETS: Dataset[] = [
  {
    id: "kitchen-egocentric",
    name: "Kitchen tasks, first person",
    blurb: "Cooking, cleaning and tidying from the wearer's eyes, with gaze. Built for household-robot manipulation policies.",
    modalities: ["Video", "Audio", "Gaze", "IMU"],
    hours: 1240, samples: 446_400, devices: 312, regions: ["IN", "DE", "US"],
    quality: 0.93, price: 18, license: "Commercial",
    batchRoot: hex(11, 64), anchoredAt: "2026-11-02",
    preview: [sample(1, "Bengaluru, IN"), sample(2, "Berlin, DE"), sample(3, "Austin, US", "challenge")],
  },
  {
    id: "street-navigation",
    name: "Street navigation",
    blurb: "Walking routes through dense cities: crossings, crowds, signage. For embodied navigation and assistive agents.",
    modalities: ["Video", "Gaze", "IMU", "GPS"],
    hours: 860, samples: 309_600, devices: 204, regions: ["IN", "JP", "BR"],
    quality: 0.89, price: 14, license: "Commercial",
    batchRoot: hex(12, 64), anchoredAt: "2026-10-29",
    preview: [sample(4, "Tokyo, JP"), sample(5, "Mumbai, IN"), sample(6, "São Paulo, BR")],
  },
  {
    id: "workshop-tools",
    name: "Workshop and tool use",
    blurb: "Hands-on repair, assembly and tool handling, with fine gaze on the work piece. Rare, high-skill demonstrations.",
    modalities: ["Video", "Audio", "Gaze"],
    hours: 310, samples: 111_600, devices: 58, regions: ["DE", "US"],
    quality: 0.95, price: 32, license: "Exclusive",
    batchRoot: hex(13, 64), anchoredAt: "2026-11-04",
    preview: [sample(7, "Stuttgart, DE"), sample(8, "Detroit, US"), sample(9, "Munich, DE", "rejected")],
  },
  {
    id: "multilingual-speech",
    name: "Everyday multilingual speech",
    blurb: "Natural conversations in markets, transit and homes. Consented speakers, faces blurred at the gateway.",
    modalities: ["Audio", "Video"],
    hours: 2100, samples: 756_000, devices: 540, regions: ["IN", "NG", "ID", "MX"],
    quality: 0.86, price: 6, license: "Research",
    batchRoot: hex(14, 64), anchoredAt: "2026-10-31",
    preview: [sample(10, "Lagos, NG"), sample(11, "Jakarta, ID"), sample(12, "Delhi, IN")],
  },
];

export const STATS = { hours: 4510, devices: 1114, validators: 86, verifiedShare: 0.97 };

export const short = (h: string, a = 8, b = 6) => `${h.slice(0, a)}…${h.slice(-b)}`;
