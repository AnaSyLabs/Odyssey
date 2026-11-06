// shortcut: static demo data, no backend; replace with the gateway API once Phase 1 ships.

export type Sample = {
  id: string;
  device: string; // the glasses' address, as recovered from the sample signature
  at: string;
  place: string;
  kind: "image" | "video" | "audio" | "sensor";
  storage: "Arkiv" | "0G Storage"; // payloads over 96 KiB go to 0G, the rest inline on Arkiv
  hash: string;
  signature: string;
  score: number;
  status: "verified" | "challenge" | "rejected";
};

// Mirrors a live dataset: a saved filter over samples (area, kinds), sold as a 30-day subscription in 0G.
export type Dataset = {
  id: string;
  name: string;
  blurb: string;
  modalities: string[]; // sample kinds, as on the live page
  area: string;
  samples: number;
  devices: number;
  regions: string[];
  quality: number;
  price: number; // 0G per 30 days
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

const sample = (seed: number, place: string, kind: Sample["kind"], status: Sample["status"] = "verified"): Sample => ({
  id: `s-${seed}`,
  device: hex(seed + 7, 40),
  at: new Date(Date.UTC(2026, 9, 1 + (seed % 28), 6 + (seed % 14), (seed * 7) % 60)).toISOString(),
  place,
  kind,
  storage: kind === "video" ? "0G Storage" : "Arkiv",
  hash: hex(seed, 64),
  signature: hex(seed + 99, 130),
  score: status === "rejected" ? 0.21 : 0.78 + ((seed * 13) % 21) / 100,
  status,
});

export const DATASETS: Dataset[] = [
  {
    id: "kitchen-egocentric",
    name: "Kitchen tasks, first person",
    blurb: "Cooking, cleaning and tidying from the wearer's eyes. Built for household-robot manipulation policies.",
    modalities: ["image", "video", "audio"], area: "Bengaluru, Berlin, Austin · 5 km each",
    samples: 446_400, devices: 312, regions: ["IN", "DE", "US"], quality: 0.93, price: 1.8,
    preview: [sample(1, "Bengaluru, IN", "video"), sample(2, "Berlin, DE", "image"), sample(3, "Austin, US", "image", "challenge")],
  },
  {
    id: "street-navigation",
    name: "Street navigation",
    blurb: "Walking routes through dense cities: crossings, crowds, signage. For embodied navigation and assistive agents.",
    modalities: ["image", "video", "sensor"], area: "Tokyo, Mumbai, São Paulo · 3 km each",
    samples: 309_600, devices: 204, regions: ["IN", "JP", "BR"], quality: 0.89, price: 1.4,
    preview: [sample(4, "Tokyo, JP", "video"), sample(5, "Mumbai, IN", "image"), sample(6, "São Paulo, BR", "sensor")],
  },
  {
    id: "workshop-tools",
    name: "Workshop and tool use",
    blurb: "Hands-on repair, assembly and tool handling, close up on the work piece. Rare, high-skill demonstrations.",
    modalities: ["image", "video", "audio"], area: "Stuttgart, Detroit, Munich · 2 km each",
    samples: 111_600, devices: 58, regions: ["DE", "US"], quality: 0.95, price: 3.2,
    preview: [sample(7, "Stuttgart, DE", "video"), sample(8, "Detroit, US", "image"), sample(9, "Munich, DE", "image", "rejected")],
  },
  {
    id: "multilingual-speech",
    name: "Everyday multilingual speech",
    blurb: "Natural conversations in markets, transit and homes. Consented speakers, encrypted at the gateway.",
    modalities: ["audio", "video"], area: "Lagos, Jakarta, Delhi · 10 km each",
    samples: 756_000, devices: 540, regions: ["IN", "NG", "ID", "MX"], quality: 0.86, price: 0.6,
    preview: [sample(10, "Lagos, NG", "audio"), sample(11, "Jakarta, ID", "audio"), sample(12, "Delhi, IN", "video")],
  },
];

export const STATS = { hours: 4510, devices: 1114, validators: 86, verifiedShare: 0.97 };

export const short = (h: string, a = 8, b = 6) => `${h.slice(0, a)}…${h.slice(-b)}`;
