"use client";
import { useState } from "react";
import { Box, Flat, PlaneText, VIEW, iso, pts, rectPts } from "./iso";
import { LEFT, PIN_X_RIGHT, PITCH, REGIONS, RIGHT, WIRES, pinY, type Region } from "./lab-data";

const GOLD = "#E5B842";
const BB_TOP = 8.5;

// Breadboard hole grid: two power rails, two five-hole blocks, a centre channel.
const HOLE_X = [48.2, 50.74, ...[0, 1, 2, 3, 4].map((k) => 54.5 + k * PITCH), ...[0, 1, 2, 3, 4].map((k) => 68.5 + k * PITCH), 82.2, 84.74];
const HOLE_Y = Array.from({ length: 17 }, (_, k) => 6.8 + k * PITCH);

function wrap(text: string, width = 19, maxLines = 3) {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if ((cur + " " + word).trim().length > width) {
      lines.push(cur);
      cur = word;
    } else cur = (cur + " " + word).trim();
  }
  lines.push(cur);
  return lines.slice(0, maxLines).map((l, i, a) => (i === a.length - 1 && lines.length > maxLines ? l.slice(0, width - 1) + "…" : l));
}

const OLED_LABEL: Record<string, string> = { idle: "READY", capturing: "REC", signing: "SIGNED", uploading: "UPLOAD", verified: "VERIFIED", rejected: "REJECTED" };

type Props = { lesson: number; hudState: string; prompt: string; focusPin?: string };

export default function Scene({ lesson, hudState, prompt, focusPin }: Props) {
  const [hover, setHover] = useState<Region | null>(null);
  const [selected, setSelected] = useState<Region | null>(null);
  const info = REGIONS[hover ?? selected ?? "module"];
  const showCallout = hover !== null || selected !== null;
  const anchorRegion = REGIONS[hover ?? selected ?? "module"];
  const [ax, ay] = iso(anchorRegion.rect[0] + anchorRegion.rect[2] / 2, anchorRegion.rect[1], anchorRegion.z + 2);

  const listening = hudState === "idle";
  const irOn = hudState === "capturing";
  const beeping = hudState === "signing" || hudState === "verified";
  const oled = [OLED_LABEL[hudState] ?? "READY", ...wrap(prompt || "Double-tap to capture")];

  const wires = WIRES.filter((w) => w.lesson <= lesson);

  return (
    <div className="relative">
      {/* key: switching lesson replays the assembly like the lessons in the video */}
      <svg key={lesson} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="h-auto w-full" role="img" aria-label="Isometric ESP32 board wired to a breadboard">
        <ellipse cx={330} cy={430} rx={330} ry={64} fill="#1E2022" opacity={0.06} />

        {/* ESP32 DevKit */}
        <g className="hardware-module">
          <Box x={0} y={0} w={28} h={55} d={1.6} color="#25282A" sw={1} />
          {/* antenna meander */}
          <Box x={5} y={2} w={18} h={25.5} z={1.6} d={0.8} color="#1B1D1F" />
          <polyline fill="none" stroke={GOLD} strokeWidth={1.6} strokeLinejoin="round"
            points={pts([iso(7, 7.5, 2.4), iso(7, 3.4, 2.4), iso(10, 3.4, 2.4), iso(10, 7.5, 2.4), iso(13, 7.5, 2.4), iso(13, 3.4, 2.4), iso(16, 3.4, 2.4), iso(16, 7.5, 2.4), iso(19, 7.5, 2.4), iso(19, 3.4, 2.4), iso(21, 3.4, 2.4)])} />
          <Box x={5} y={9} w={18} h={18.5} z={2.4} d={2.5} color="#D0D5DD" />
          <PlaneText x={7} y={17.5} z={4.95} size={2.3} fill="#1E2022">ESPRESSIF</PlaneText>
          <PlaneText x={6.3} y={21.5} z={4.95} size={1.55} fill="#6E6D68" weight={400}>ESP32-WROOM-32</PlaneText>
          <Box x={11} y={33} w={6} h={6} z={1.6} d={1} color="#111" />
          {/* EN / BOOT */}
          {[4.5, 19].map((bx, i) => (
            <g key={bx}>
              <Box x={bx} y={48} w={4.5} h={4.5} z={1.6} d={1.4} color="#3A3D40" />
              <Flat x={bx + 1} y={49} w={2.5} h={2.5} z={3.05} fill="#9AA0A6" />
              <PlaneText x={bx - 0.5} y={47.4} z={1.65} size={1.5} fill="#D0D5DD">{i ? "BOOT" : "EN"}</PlaneText>
            </g>
          ))}
          {/* power LED */}
          <Box x={13} y={44} w={2} h={2} z={1.6} d={0.6} color="#2B6CB0" />
          <ellipse className={listening ? "blink" : ""} {...(() => { const [cx, cy] = iso(14, 45, 2.4); return { cx, cy }; })()} rx={9} ry={5} fill="#2B6CB0" opacity={0.35} />
          {/* USB */}
          <Box x={9.5} y={51} w={9} h={7} z={1.6} d={2.8} color="#D0D5DD" />
          {/* headers: black base strip plus gold pins */}
          {[0.3, 25.1].map((hx) => <Box key={hx} x={hx} y={8} w={2.6} h={38.1} z={1.6} d={2.5} color="#17191B" />)}
          {LEFT.map((n, i) => <Box key={n + i} x={1.6 - 0.32} y={pinY(i) - 0.32} w={0.64} h={0.64} z={4.1} d={6} color={GOLD} sw={0.4} />)}
          {RIGHT.map((n, i) => <Box key={n + i} x={PIN_X_RIGHT - 0.32} y={pinY(i) - 0.32} w={0.64} h={0.64} z={4.1} d={6} color={GOLD} sw={0.4} />)}
          {/* pin labels follow the plane */}
          {RIGHT.map((n, i) => (
            <PlaneText key={n + i} x={28.6} y={pinY(i) + 0.55} z={1.65} size={1.5} fill={WIRES.some((w) => w.pin === n && w.lesson <= lesson) ? "#188078" : "#6E6D68"}>{n}</PlaneText>
          ))}
        </g>

        {/* breadboard */}
        <g className="hardware-module" style={{ animationDelay: "0.12s" }}>
          <Box x={46} y={4} w={40} h={47} d={BB_TOP} color="#EFE9D6" sw={1} />
          {HOLE_Y.map((y, k) => HOLE_X.map((x) => <Flat key={`${k}-${x}`} x={x - 0.45} y={y - 0.45} w={0.9} h={0.9} z={BB_TOP + 0.02} fill="#3A3D40" />))}
          <polyline fill="none" stroke="#D93829" strokeWidth={1} points={pts([iso(47.1, 5, BB_TOP + 0.03), iso(47.1, 49, BB_TOP + 0.03)])} />
          <polyline fill="none" stroke="#2B6CB0" strokeWidth={1} points={pts([iso(51.9, 5, BB_TOP + 0.03), iso(51.9, 49, BB_TOP + 0.03)])} />
        </g>

        {/* parts, dropped in as the lessons add them */}
        {lesson >= 1 && (
          <g className="hardware-module" style={{ animationDelay: "0.2s" }}>
            <Box x={53.2} y={6.5} w={12.7} h={14} z={BB_TOP} d={1.4} color="#1B6B66" />
            <Box x={57.8} y={10} w={4} h={4} z={BB_TOP + 1.4} d={1} color="#D0D5DD" />
            <PlaneText x={54} y={19.2} z={BB_TOP + 1.45} size={1.6}>INMP441</PlaneText>
          </g>
        )}
        {lesson >= 2 && (
          <g className="hardware-module" style={{ animationDelay: "0.28s" }}>
            <Box x={66.5} y={26.5} w={18} h={21.5} z={BB_TOP} d={1.4} color="#2B6CB0" />
            <Flat x={67.7} y={28.4} w={15.6} h={10} z={BB_TOP + 1.45} fill="#0B0D0E" />
            {oled.map((line, i) => (
              <PlaneText key={i} x={68.2} y={30.4 + i * 2.3} z={BB_TOP + 1.5} size={1.3} fill={i === 0 ? "#7FE3DB" : "#fff"} weight={400}>{line}</PlaneText>
            ))}
            <PlaneText x={68} y={45.5} z={BB_TOP + 1.45} size={1.6}>SSD1306</PlaneText>
            {/* buzzer */}
            <Box x={55} y={41.2} w={8} h={7.6} z={BB_TOP} d={5.5} color="#1E2022" />
            <Flat x={57.4} y={43.4} w={3.2} h={3.2} z={BB_TOP + 5.55} fill="#6E6D68" />
            {beeping && [0, 0.4, 0.8].map((d) => {
              const [cx, cy] = iso(59, 45, BB_TOP + 6);
              return <ellipse key={d} className="wave" cx={cx} cy={cy} rx={26} ry={15} fill="none" stroke="#188078" strokeWidth={2} style={{ animationDelay: `${d}s` }} />;
            })}
          </g>
        )}
        {lesson >= 3 && (
          <g className="hardware-module" style={{ animationDelay: "0.36s" }}>
            <Box x={54} y={32.2} w={4} h={4} z={BB_TOP} d={4.5} color={irOn ? "#FF6A4D" : "#8C2B22"} />
            {irOn && (() => {
              const [cx, cy] = iso(56, 34.2, BB_TOP + 5);
              return <ellipse className="ir-glow" cx={cx} cy={cy} rx={34} ry={20} fill="#FF6A4D" opacity={0.45} />;
            })()}
            <PlaneText x={52.2} y={31.4} z={BB_TOP + 0.05} size={1.4} fill="#6E6D68" weight={400}>IR 850nm</PlaneText>
          </g>
        )}

        {/* jumper wires: each draws itself from its header pin to the breadboard hole */}
        <g aria-hidden>
          {wires.map((w, i) => {
            const [x1, y1] = iso(PIN_X_RIGHT, pinY(w.from), 10.1);
            const [x2, y2] = iso(w.to[0], w.to[1], BB_TOP + 0.2);
            const lift = 34 + Math.hypot(x2 - x1, y2 - y1) * 0.18;
            const delay = 0.3 + i * 0.12;
            return (
              <g key={w.pin}>
                <path className={`jumper-wire ${focusPin === w.pin ? "focus" : ""}`} pathLength={1} stroke={w.color}
                  d={`M${x1},${y1} C${x1},${y1 - lift} ${x2},${y2 - lift} ${x2},${y2}`} style={{ animationDelay: `${delay}s` }} />
                <circle className="wire-end" cx={x2} cy={y2} r={3.2} fill={w.color} stroke="#1E2022" strokeWidth={1} style={{ animationDelay: `${delay + 0.45}s` }} />
              </g>
            );
          })}
        </g>

        {/* interactive regions */}
        {(Object.keys(REGIONS) as Region[]).map((r) => {
          const [x, y, w, h] = REGIONS[r].rect;
          return (
            <g key={r} className={`esp32-pin-group ${selected === r ? "selected" : ""}`} tabIndex={0} role="button" aria-label={REGIONS[r].title}
              onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)}
              onClick={() => setSelected((s) => (s === r ? null : r))}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected((s) => (s === r ? null : r))}>
              <polygon points={rectPts(x, y, w, h, REGIONS[r].z)} fill="rgba(24,128,120,0.001)" strokeLinejoin="round" />
            </g>
          );
        })}
      </svg>

      {showCallout && (
        <div className="ui-card active pointer-events-none absolute w-60 -translate-x-1/2 -translate-y-full p-4 text-xs"
          style={{ left: `${(ax / VIEW.w) * 100}%`, top: `${(ay / VIEW.h) * 100}%` }}>
          <p className="font-bold">{info.title}</p>
          <p className="muted mt-1 leading-snug">{info.text}</p>
        </div>
      )}
    </div>
  );
}
