import type { ReactNode } from "react";

// Isometric projection: plane x runs right-down, plane y runs left-down, z is up. Units are millimetres.
export const C = Math.cos(Math.PI / 6);
export const S = 0.5;
export const K = 6; // px per mm
export const OX = 316;
export const OY = 70;
export const VIEW = { w: 780, h: 520 };

export type Pt = [number, number];
export const iso = (x: number, y: number, z = 0): Pt => [OX + (x - y) * C * K, OY + (x + y) * S * K - z * K];
export const pts = (p: Pt[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

export const rectPts = (x: number, y: number, w: number, h: number, z: number) =>
  pts([iso(x, y, z), iso(x + w, y, z), iso(x + w, y + h, z), iso(x, y + h, z)]);

type BoxProps = { x: number; y: number; w: number; h: number; z?: number; d: number; color: string; stroke?: string; sw?: number };

/** A box seen from above-front: top face plus the two faces that point at the camera. */
export function Box({ x, y, w, h, z = 0, d, color, stroke = "#1E2022", sw = 0.7 }: BoxProps) {
  const t = z + d;
  const common = { stroke, strokeWidth: sw, strokeLinejoin: "round" as const };
  return (
    <g>
      <polygon {...common} fill={shade(color, 0.72)} points={pts([iso(x, y + h, z), iso(x + w, y + h, z), iso(x + w, y + h, t), iso(x, y + h, t)])} />
      <polygon {...common} fill={shade(color, 0.52)} points={pts([iso(x + w, y, z), iso(x + w, y + h, z), iso(x + w, y + h, t), iso(x + w, y, t)])} />
      <polygon {...common} fill={color} points={rectPts(x, y, w, h, t)} />
    </g>
  );
}

export function Flat({ x, y, w, h, z, fill, stroke }: { x: number; y: number; w: number; h: number; z: number; fill: string; stroke?: string }) {
  return <polygon points={rectPts(x, y, w, h, z)} fill={fill} stroke={stroke} strokeWidth={0.5} />;
}

/** Text lying flat on the board plane, skewed with it. */
export function PlaneText({ x, y, z = 0, size, fill = "#fff", weight = 700, children }: { x: number; y: number; z?: number; size: number; fill?: string; weight?: number; children: ReactNode }) {
  const [X, Y] = iso(x, y, z);
  return (
    <text transform={`matrix(${C * K} ${S * K} ${-C * K} ${S * K} ${X} ${Y})`} fontSize={size} fill={fill} fontWeight={weight} style={{ userSelect: "none" }}>
      {children}
    </text>
  );
}
