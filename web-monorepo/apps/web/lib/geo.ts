// Geohash layer over Arkiv: every sample stores a precision-9 geohash as an indexed str,
// so "near (lat, lon)" becomes a handful of STARTSWITH prefixes plus an exact distance filter.

const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
export const GEOHASH_PRECISION = 9; // ~4.8 m x 4.8 m

export function geohash(lat: number, lon: number, precision = GEOHASH_PRECISION): string {
  let [latLo, latHi, lonLo, lonHi] = [-90, 90, -180, 180];
  let out = "";
  let bits = 0;
  let ch = 0;
  let even = true; // even bits split longitude
  while (out.length < precision) {
    if (even) {
      const mid = (lonLo + lonHi) / 2;
      ch = (ch << 1) | (lon >= mid ? 1 : 0);
      if (lon >= mid) lonLo = mid; else lonHi = mid;
    } else {
      const mid = (latLo + latHi) / 2;
      ch = (ch << 1) | (lat >= mid ? 1 : 0);
      if (lat >= mid) latLo = mid; else latHi = mid;
    }
    even = !even;
    if (++bits === 5) {
      out += B32[ch];
      bits = 0;
      ch = 0;
    }
  }
  return out;
}

const M_PER_DEG = 111_320;

// Cell size in degrees for a precision: 5 bits per char, longitude takes the odd bit.
const cellDeg = (p: number) => ({ lat: 180 / 2 ** Math.floor((5 * p) / 2), lon: 360 / 2 ** Math.ceil((5 * p) / 2) });

/**
 * Geohash prefixes whose cells together cover the circle's bounding box.
 * Picks the finest precision whose cell is still at least as big as the box, so it returns 1 to 9 prefixes.
 * shortcut: no antimeridian or pole wrap; fine for Mumbai, fix before global queries near ±180° lon.
 */
export function coverCircle(lat: number, lon: number, radiusM: number): string[] {
  const dLat = radiusM / M_PER_DEG;
  const dLon = radiusM / (M_PER_DEG * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6));
  let p = GEOHASH_PRECISION;
  while (p > 1 && (cellDeg(p).lat < 2 * dLat || cellDeg(p).lon < 2 * dLon)) p--;
  const c = cellDeg(p);
  const out = new Set<string>();
  // Step a cell at a time across the box and always include its far edge.
  for (let y = lat - dLat; ; y = Math.min(y + c.lat, lat + dLat)) {
    for (let x = lon - dLon; ; x = Math.min(x + c.lon, lon + dLon)) {
      out.add(geohash(Math.max(-90, Math.min(90, y)), Math.max(-180, Math.min(180, x)), p));
      if (x >= lon + dLon) break;
    }
    if (y >= lat + dLat) break;
  }
  return [...out];
}

export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}
