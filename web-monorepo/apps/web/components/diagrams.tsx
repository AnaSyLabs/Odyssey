import type { ReactNode } from "react";

// Studio tokens so the diagrams follow the dark/light toggle.
export const INK = "var(--st-on)";
const MUTED = "var(--st-on-var)";
const TEAL = "var(--st-cyan)";
const PANEL = "var(--st-2)";
const CANVAS = "var(--st-1)";
const LINE = "color-mix(in srgb, var(--st-on) 14%, transparent)";
const WIRE = "var(--st-outline)";
const SANS = "var(--font-urbanist), system-ui, sans-serif";
const CW = 6.3; // approximate advance of JetBrains Mono at 10.5px

type Pt = [number, number];

export function Figure({ n, title, w, h, caption, children }: { n: number; title: string; w: number; h: number; caption?: ReactNode; children: ReactNode }) {
  return (
    <figure className="ui-card space-y-4 p-5 sm:p-6">
      <figcaption className="flex items-center gap-2 text-sm font-medium">
        <span className="pill mono">FIG {n}</span>{title}
      </figcaption>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full min-w-[720px]" role="img" aria-label={title} fontFamily="var(--font-jetbrains), monospace">
          <defs>
            {[["arr", WIRE], ["arr-teal", TEAL]].map(([id, c]) => (
              <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={c} />
              </marker>
            ))}
          </defs>
          {children}
        </svg>
      </div>
      {caption && <p className="muted text-xs leading-relaxed">{caption}</p>}
    </figure>
  );
}

function Chip({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <rect x={x} y={y} width={text.length * 5.9 + 14} height={17} rx={8.5} fill={TEAL} fillOpacity={0.14} />
      <text x={x + 7} y={y + 12} fontSize={9.5} fontWeight={600} fill={TEAL}>{text}</text>
    </g>
  );
}

/** A component box in the site's card style: rounded, flat, title, optional tech chip and detail lines. */
export function Node({ x, y, w, h, title, tech, lines = [], tone }: { x: number; y: number; w: number; h: number; title: string; tech?: string; lines?: string[]; tone?: "accent" | "ext" }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={14} fill={tone === "ext" ? "var(--st-3)" : PANEL}
        stroke={tone === "accent" ? TEAL : LINE} strokeWidth={tone === "accent" ? 1.5 : 1} />
      <text x={x + 12} y={y + 21} fontSize={13.5} fontWeight={600} fill={INK} fontFamily={SANS}>{title}</text>
      {tech && <Chip x={x + 12} y={y + 28} text={tech} />}
      {lines.map((l, i) => (
        <text key={i} x={x + 12} y={y + (tech ? 60 : 37) + i * 15} fontSize={10.5} fill={MUTED} style={{ whiteSpace: "pre" }}>{l}</text>
      ))}
    </g>
  );
}

/** A dashed boundary: a machine, a network or a trust zone. */
export function Group({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={20} fill="var(--st-0)" fillOpacity={0.35} stroke={LINE} strokeDasharray="5 5" />
      <text x={x + 14} y={y + 18} fontSize={9.5} fontWeight={600} letterSpacing={1.2} fill="var(--st-outline)">{label}</text>
    </g>
  );
}

export function Label({ x, y, text, anchor = "middle" }: { x: number; y: number; text: string | string[]; anchor?: "middle" | "start" }) {
  const lines = Array.isArray(text) ? text : [text];
  const w = Math.max(...lines.map((l) => l.length)) * CW + 10;
  const h = lines.length * 13 + 5;
  const left = anchor === "middle" ? x - w / 2 : x;
  return (
    <g>
      <rect x={left} y={y - h / 2} width={w} height={h} rx={Math.min(9, h / 2)} fill={CANVAS} />
      {lines.map((l, i) => (
        <text key={i} x={anchor === "middle" ? x : x + 5} y={y - h / 2 + 12 + i * 13} textAnchor={anchor} fontSize={10.5} fill={MUTED}>{l}</text>
      ))}
    </g>
  );
}

/** An orthogonal (or any polyline) connector. `d` overrides `pts` for curves; `at` places the label. */
export function Edge({ pts, d, label, at, dashed, both, accent, head = true }: { pts?: Pt[]; d?: string; label?: string | string[]; at?: Pt; dashed?: boolean; both?: boolean; accent?: boolean; head?: boolean }) {
  const path = d ?? "M" + pts!.map((p) => p.join(",")).join(" L");
  const marker = accent ? "url(#arr-teal)" : "url(#arr)";
  let pos = at;
  if (!pos && pts) {
    let best = 0;
    for (let i = 1; i < pts.length; i++) {
      const len = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
      if (len > best) {
        best = len;
        pos = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2];
      }
    }
  }
  return (
    <g>
      <path d={path} fill="none" stroke={accent ? TEAL : WIRE} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? "5 4" : undefined}
        markerEnd={head ? marker : undefined} markerStart={both ? marker : undefined} />
      {label && pos && <Label x={pos[0]} y={pos[1]} text={label} />}
    </g>
  );
}

export type SeqStep = { from: string; to: string; label: string; reply?: boolean } | { self: string; label: string } | { section: string };

/** UML-style sequence diagram laid out from data: actors become columns, steps become numbered rows. */
export function Sequence({ n, title, actors, steps, caption }: { n: number; title: string; actors: { id: string; label: string; tech: string }[]; steps: SeqStep[]; caption?: ReactNode }) {
  const col = 150, left = 80, top = 78;
  const w = left * 2 + col * (actors.length - 1);
  const x = Object.fromEntries(actors.map((a, i) => [a.id, left + i * col]));
  const rows: { s: SeqStep; y: number; num: number }[] = [];
  let y = top;
  let k = 0;
  for (const s of steps) {
    const rh = "self" in s ? 40 : 32;
    rows.push({ s, y: y + rh / 2, num: "section" in s ? 0 : ++k });
    y += rh;
  }
  const h = y + 16;
  const badge = (cx: number, cy: number, num: number) => (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="var(--st-lime)" />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#07090e">{num}</text>
    </g>
  );
  return (
    <Figure n={n} title={title} w={w} h={h} caption={caption}>
      {actors.map((a) => (
        <g key={a.id}>
          <line x1={x[a.id]} y1={54} x2={x[a.id]} y2={h - 8} stroke={LINE} strokeDasharray="3 4" />
          <rect x={x[a.id] - 66} y={8} width={132} height={44} rx={14} fill={PANEL} stroke={LINE} />
          <text x={x[a.id]} y={27} textAnchor="middle" fontSize={13} fontWeight={600} fill={INK} fontFamily={SANS}>{a.label}</text>
          <text x={x[a.id]} y={42} textAnchor="middle" fontSize={9.5} fill={TEAL} fontWeight={600}>{a.tech}</text>
        </g>
      ))}
      {rows.map(({ s, y, num }, i) => {
        if ("section" in s) {
          return (
            <g key={i}>
              <rect x={8} y={y - 11} width={w - 16} height={22} rx={11} fill={TEAL} fillOpacity={0.1} />
              <text x={20} y={y + 4} fontSize={10} fontWeight={600} letterSpacing={1.2} fill={TEAL}>{s.section}</text>
            </g>
          );
        }
        if ("self" in s) {
          const sx = x[s.self];
          return (
            <g key={i}>
              <path d={`M${sx},${y - 9} h34 v18 h-30`} fill="none" stroke={WIRE} strokeWidth={1.25} strokeLinejoin="round" markerEnd="url(#arr)" />
              {badge(sx + 50, y, num)}
              <Label x={sx + 58} y={y} text={s.label} anchor="start" />
            </g>
          );
        }
        const [a, b] = [x[s.from], x[s.to]];
        const mid = (a + b) / 2;
        const lw = s.label.length * CW + 10;
        return (
          <g key={i}>
            <line x1={a} y1={y + 6} x2={b + (b > a ? -2 : 2)} y2={y + 6} stroke={s.reply ? LINE : WIRE} strokeWidth={1.25}
              strokeDasharray={s.reply ? "5 4" : undefined} markerEnd="url(#arr)" />
            {badge(mid - lw / 2 - 10, y - 6, num)}
            <Label x={mid} y={y - 6} text={s.label} />
          </g>
        );
      })}
    </Figure>
  );
}

/** A byte (or bit) layout strip: each field's width is proportional to its size, with offsets underneath. */
export function Bytes({ x, y, scale, fields, unit = "B", minW = 0, offsets = true }: { x: number; y: number; scale: number; minW?: number; unit?: string; offsets?: boolean; fields: { label: string; size: number; sub?: string; accent?: boolean }[] }) {
  const cells: { f: (typeof fields)[number]; cx: number; fw: number; off: number }[] = [];
  let cx = x;
  let off = 0;
  for (const f of fields) {
    const fw = Math.max(minW, f.size * scale);
    cells.push({ f, cx, fw, off });
    cx += fw;
    off += f.size;
  }
  return (
    <g>
      {cells.map(({ f, cx, fw, off }, i) => (
          <g key={i}>
            <rect x={cx} y={y} width={fw} height={48} fill={f.accent ? "color-mix(in srgb, var(--st-cyan) 18%, var(--st-2))" : PANEL} stroke={CANVAS} strokeWidth={2} />
            <text x={cx + fw / 2} y={y + 20} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK}>{f.label}</text>
            <text x={cx + fw / 2} y={y + 36} textAnchor="middle" fontSize={9.5} fill={MUTED}>{f.sub ?? `${f.size} ${unit}`}</text>
            {offsets && <text x={cx} y={y + 62} textAnchor="middle" fontSize={9} fill={MUTED}>{off}</text>}
          </g>
      ))}
      {offsets && <text x={cx} y={y + 62} textAnchor="middle" fontSize={9} fill={MUTED}>{off}</text>}
    </g>
  );
}
