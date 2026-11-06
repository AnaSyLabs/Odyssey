"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

type Props = { lesson: number; hudState: string; prompt: string; dark?: boolean; exploded?: boolean; lineup?: boolean; wireframe?: boolean };

// Exploded-view offset per part group from `build`; x points outward from the centre line.
const OFF: Record<string, [number, number, number]> = {
  rim: [0, 0, 0.9], bridge: [0, 0.5, 1.3], lens: [0, 0, 2], display: [0.3, 0, 2.9], camera: [0.3, 0.5, 2.4],
  pads: [0, -0.6, 0.6], ir: [0, -0.8, -0.4], mic: [0, 1.2, 0.6], wire: [0, 0.8, 0.2],
  hinge: [0.5, 0, 0.3], temple: [1, 0, -0.3], pod: [1.9, 0, 0], touch: [1.6, 1, 0],
  board: [2.8, 0.9, 0], battery: [2.6, -0.9, 0], speaker: [2.2, -0.4, -0.8],
};

// Lineup view: the same parts pulled apart front to back in assembly order (z), like a product sheet; x and y stay put.
const LINE: Record<string, [number, number]> = {
  lens: [0, 4.6], display: [0.3, 3.8], camera: [0.6, 3.3], rim: [0, 2.6], bridge: [0.5, 2.6], pads: [-0.5, 2.2], ir: [-0.7, 2.2],
  mic: [0.9, 1.4], wire: [0.7, 0.9], hinge: [0, 0.4], temple: [0, -0.4], touch: [0.9, -1.2], pod: [0, -1.4],
  board: [0.9, -2.6], battery: [-0.9, -3.4], speaker: [-0.6, -2.2],
};
const lineOffset = (sec: string) => {
  const [y, z] = LINE[sec] ?? [0, 0];
  return new THREE.Vector3(0, y, z);
};

const offset = (sec: string, x: number) => {
  const [ox, oy, oz] = OFF[sec] ?? [0, 0, 0];
  return new THREE.Vector3(ox * Math.sign(x), oy, oz);
};
const MAX_OFF = Math.max(...Object.values(OFF).map(([x, y, z]) => Math.hypot(x, y, z)));
const MAX_LINE = Math.max(...Object.values(LINE).map(([y, z]) => Math.hypot(y, z)));
/** Far-travelling parts start later, so the frame opens first and the internals fan out after it. */
const lag = (off: THREE.Vector3, max = MAX_OFF) => 0.35 * (off.length() / max);
const stagger = (k: number, lagBy: number) => {
  const x = Math.min(1, Math.max(0, (k - lagBy) / (1 - lagBy)));
  return x * x * (3 - 2 * x);
};

/** Each part of a `build` group with its assembled position and exploded-view offset. */
export function explodeParts(g: THREE.Group) {
  return g.children.map((m) => ({ m, base: m.position.clone(), off: offset(m.userData.sec as string, m.position.x), line: lineOffset(m.userData.sec as string) }));
}

const INK = 0x1e2022;
const TEAL = 0x188078;
const HEAD: Record<string, string> = { idle: "READY", capturing: "REC", signing: "SIGNED", uploading: "UPLOAD", verified: "VERIFIED", rejected: "REJECTED" };

// Callouts. `at` is in the glasses' local space; `lessons` are the Lab lessons that feature the part.
// `sec` is the exploded-view group the callout rides with; `only` callouts appear in the exploded view alone.
const PARTS = [
  { id: "mic", title: "INMP441 mic", sub: "audio capture", at: [-1.85, 0.72, 0.16], sec: "mic", dx: 22, dy: -44, lessons: [1] },
  { id: "display", title: "Transparent OLED", sub: "REC indicator", at: [2.0, 0.55, 0.08], sec: "display", dx: 24, dy: -46, lessons: [2] },
  { id: "ir", title: "850 nm IR LED", sub: "gaze tracking", at: [1.3, -0.71, 0.17], sec: "ir", dx: 26, dy: 40, lessons: [3] },
  { id: "esp", title: "ESP32 node", sub: "signs + uploads", at: [2.74, 0.4, -1.6], sec: "pod", dx: 28, dy: 8, lessons: [0, 4] },
  { id: "buzzer", title: "Buzzer", sub: "audible feedback", at: [-2.7, 0.4, -1.6], sec: "pod", dx: 14, dy: 52, lessons: [2] },
  { id: "lens", title: "Lens", sub: "focuses the HUD", at: [-1.3, -0.45, 0.01], sec: "lens", dx: -24, dy: 40, lessons: [2], only: true },
  { id: "board", title: "Logic board", sub: "ESP32-WROOM-32", at: [2.5, 0.55, -1.5], sec: "board", dx: 24, dy: -40, lessons: [0], only: true },
  { id: "battery", title: "Power cell", sub: "feeds the node", at: [2.64, 0.25, -2.1], sec: "battery", dx: 24, dy: 40, lessons: [0], only: true },
] as const;
const CALLOUTS = PARTS.map((p) => {
  const at = new THREE.Vector3(...p.at);
  const off = offset(p.sec, at.x), line = lineOffset(p.sec);
  return { at, off, lag: lag(off), line, lineLag: lag(line, MAX_LINE), only: "only" in p };
});

function rrect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI, false);
  return s;
}

function label(text: string, sub: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const x = c.getContext("2d")!;
  x.fillStyle = "#F6F3EA";
  x.textBaseline = "middle";
  x.font = "bold 52px monospace";
  x.fillText(text, 16, 34);
  x.globalAlpha = 0.7;
  x.font = "24px monospace";
  x.fillText(sub, 18, 78);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function build() {
  const g = new THREE.Group();
  let sec = "rim"; // exploded-view group of the next part, read by the intro loader
  const matte = (color: number, roughness = 0.5, metalness = 0.05) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const frame = new THREE.MeshPhysicalMaterial({ color: INK, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25 });
  const pod = new THREE.MeshPhysicalMaterial({ color: TEAL, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const dark = matte(0x16181a, 0.6);
  const steel = matte(0xc9c6bd, 0.25, 0.9);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe6e1, transparent: true, opacity: 0.16, roughness: 0.03, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.userData.sec = sec;
    parent.add(m);
    return m;
  };
  const tube = (pts: number[][], r: number, mat: THREE.Material) =>
    put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))), 48, r, 8), mat, 0, 0, 0);

  // Front frame: two bevelled rims, each with a clear lens.
  const W = 2.1, H = 1.55, R = 0.55, T = 0.13;
  const rim = new THREE.Shape(rrect(W, H, R).getPoints(32));
  rim.holes.push(new THREE.Path(rrect(W - 2 * T, H - 2 * T, R - T).getPoints(32)));
  const rimGeo = new THREE.ExtrudeGeometry(rim, { depth: 0.18, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.03, bevelSegments: 4, curveSegments: 32 });
  rimGeo.translate(0, 0, -0.09);
  const lensGeo = new THREE.ShapeGeometry(rrect(W - 2 * T, H - 2 * T, R - T), 32);
  const endGeo = new RoundedBoxGeometry(0.22, 0.34, 0.26, 3, 0.06);
  for (const s of [-1, 1]) {
    sec = "rim";
    put(rimGeo, frame, s * 1.3, 0, 0);
    sec = "lens";
    put(lensGeo, glass, s * 1.3, 0, 0.01);
    // end pieces joining the rim to the hinge
    sec = "hinge";
    put(endGeo, frame, s * 2.36, 0.4, -0.06);
  }
  sec = "bridge";
  tube([[-0.32, 0.3, 0], [-0.15, 0.43, 0.02], [0, 0.47, 0.03], [0.15, 0.43, 0.02], [0.32, 0.3, 0]], 0.065, frame);

  // Front camera on the left end piece, ambient light sensor on the right.
  sec = "camera";
  const cam = put(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 20), dark, -2.36, 0.42, 0.09);
  cam.rotation.x = Math.PI / 2;
  put(new THREE.SphereGeometry(0.035, 16, 12), matte(0x0d1b2a, 0.05, 0.3), -2.36, 0.42, 0.1);
  put(new THREE.SphereGeometry(0.025, 12, 12), matte(0xe8e4d8, 0.3), 2.36, 0.52, 0.08);

  // Nose pads on short wire arms.
  sec = "pads";
  const pad = new THREE.MeshPhysicalMaterial({ color: 0xe8e4d8, transparent: true, opacity: 0.85, roughness: 0.2, clearcoat: 1 });
  const padGeo = new THREE.SphereGeometry(0.1, 20, 20);
  for (const s of [-1, 1]) {
    tube([[s * 0.3, -0.05, -0.08], [s * 0.34, -0.2, -0.18], [s * 0.4, -0.3, -0.24]], 0.012, steel);
    const p = put(padGeo, pad, s * 0.42, -0.36, -0.26);
    p.scale.set(0.45, 1, 0.3);
    p.rotation.z = s * 0.35;
  }

  // Hinges: three knuckles and a screw, then curved temples with ear bends.
  const knuckle = new THREE.CylinderGeometry(0.05, 0.05, 0.07, 16);
  const profile = new THREE.Shape();
  profile.moveTo(0, 0.09);
  profile.lineTo(3.6, 0.065);
  profile.quadraticCurveTo(4.35, 0.05, 4.78, -0.55);
  profile.quadraticCurveTo(4.86, -0.7, 4.72, -0.7);
  profile.quadraticCurveTo(4.25, -0.12, 3.6, -0.06);
  profile.lineTo(0, -0.09);
  profile.closePath();
  const templeGeo = new THREE.ExtrudeGeometry(profile, { depth: 0.09, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 3, curveSegments: 32 });
  templeGeo.rotateY(Math.PI / 2); // profile length runs back along -z, thickness along x
  const screwGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12);
  const tipGeo = new RoundedBoxGeometry(0.06, 0.18, 0.3, 2, 0.025);
  for (const s of [-1, 1]) {
    sec = "hinge";
    for (const dy of [-0.08, 0, 0.08]) put(knuckle, dy ? frame : steel, s * 2.4, 0.4 + dy, -0.22);
    const screw = put(screwGeo, steel, s * 2.4, 0.53, -0.22);
    screw.castShadow = false;
    sec = "temple";
    put(templeGeo, frame, s * 2.4 - 0.045, 0.4, -0.25);
    // bone-conduction transducer on the inside of each temple tip
    sec = "speaker";
    put(tipGeo, dark, s * 2.32, 0.3, -4.55);
  }
  sec = "touch";
  put(new RoundedBoxGeometry(0.012, 0.1, 1.1, 2, 0.005), matte(0x2b6f66, 0.3, 0.4), -2.47, 0.4, -2.9);

  // Internals hidden inside the pods until the exploded view: logic board, batteries, speaker.
  sec = "board";
  put(new THREE.BoxGeometry(0.03, 0.32, 1.5), matte(0x1f5c3a, 0.6), 2.5, 0.4, -1.5);
  for (const [z, size] of [[-1.1, 0.2], [-1.45, 0.16], [-1.8, 0.08]]) put(new THREE.BoxGeometry(0.03, size, size), matte(0x16181a, 0.3, 0.5), 2.525, 0.42, z);
  sec = "battery";
  const cell = matte(0x8a9bb0, 0.3, 0.7);
  put(new RoundedBoxGeometry(0.1, 0.3, 0.7, 3, 0.04), cell, 2.64, 0.4, -2.1);
  put(new RoundedBoxGeometry(0.1, 0.28, 0.4, 3, 0.04), cell, -2.58, 0.4, -1.95);
  sec = "speaker";
  const spk = put(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 24), steel, -2.62, 0.4, -1.5);
  spk.rotation.z = Math.PI / 2;

  // Right temple: ESP32 pod with branding, vents, a button, a status LED and a USB-C port.
  sec = "pod";
  put(new RoundedBoxGeometry(0.3, 0.44, 2.0, 4, 0.1), pod, 2.58, 0.4, -1.6);
  const brand = put(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: label("ODYSSEY", "ESP32 · capture node"), transparent: true, toneMapped: false }), 2.735, 0.42, -1.6);
  brand.rotation.y = Math.PI / 2;
  put(new RoundedBoxGeometry(0.18, 0.02, 0.7, 2, 0.008), matte(0x1e2022, 0.15, 0.6), 2.58, 0.625, -1.85);
  for (let i = 0; i < 5; i++) put(new RoundedBoxGeometry(0.17, 0.012, 0.035, 2, 0.005), dark, 2.58, 0.625, -2.25 - i * 0.065);
  put(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 20), matte(0xf6f3ea, 0.4), 2.58, 0.63, -1.25);
  const status = new THREE.MeshStandardMaterial({ color: 0x3a9d5b, emissive: 0x3a9d5b, emissiveIntensity: 1 });
  put(new THREE.SphereGeometry(0.03, 12, 12), status, 2.58, 0.63, -0.95);
  put(new RoundedBoxGeometry(0.16, 0.07, 0.03, 2, 0.03), dark, 2.58, 0.4, -2.6);
  put(new THREE.BoxGeometry(0.1, 0.02, 0.02), steel, 2.58, 0.4, -2.605);

  // Left temple: buzzer pod with a speaker grille.
  put(new RoundedBoxGeometry(0.26, 0.38, 1.2, 4, 0.09), pod, -2.56, 0.4, -1.6);
  const hole = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10);
  for (const [dy, dz] of [[0, 0], [0.07, 0], [-0.07, 0], [0.035, 0.06], [-0.035, 0.06], [0.035, -0.06], [-0.035, -0.06]]) {
    const h = put(hole, dark, -2.69, 0.4 + dy, -1.6 + dz);
    h.rotation.z = Math.PI / 2;
  }

  // Mic board on the left rim, wired back along the top of the frame into the ESP32 pod.
  sec = "mic";
  const capsule = put(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 16), steel, 0, 0.56, 0.06);
  capsule.rotation.x = Math.PI / 2;
  put(new RoundedBoxGeometry(0.36, 0.17, 0.05, 2, 0.015), matte(0x2b6f66, 0.6), -1.85, 0.7, 0.15);
  put(new RoundedBoxGeometry(0.12, 0.08, 0.04, 2, 0.01), steel, -1.85, 0.7, 0.18);
  const port = put(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 12), dark, -1.85, 0.7, 0.2);
  port.rotation.x = Math.PI / 2;
  const wire = matte(0x188078, 0.5);
  sec = "wire";
  tube([[-1.85, 0.8, 0.1], [-1.3, 0.84, -0.1], [-0.4, 0.62, -0.12], [0, 0.56, -0.1], [0.4, 0.62, -0.12], [1.3, 0.84, -0.1], [2.25, 0.62, -0.2], [2.45, 0.55, -0.5]], 0.014, wire);

  // Transparent display: framed glass panel in front of the lens, fed by a ribbon and a lens tube from the pod.
  const hud = document.createElement("canvas");
  hud.width = 512;
  hud.height = 256;
  const tex = new THREE.CanvasTexture(hud);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const bezel = new THREE.Shape(rrect(1.38, 0.73, 0.06).getPoints(12));
  bezel.holes.push(new THREE.Path(rrect(1.3, 0.65, 0.03).getPoints(12)));
  sec = "display";
  put(new THREE.ExtrudeGeometry(bezel, { depth: 0.025, bevelEnabled: false }), dark, 1.45, 0.25, 0.05);
  put(new THREE.BoxGeometry(1.3, 0.65, 0.012), glass, 1.45, 0.25, 0.062);
  const screen = put(new THREE.PlaneGeometry(1.3, 0.65), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }), 1.45, 0.25, 0.072);
  screen.renderOrder = 2;
  put(new THREE.BoxGeometry(0.16, 0.22, 0.006), matte(0xc9852b, 0.4, 0.3), 2.2, 0.25, 0.08);
  const barrel = put(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 24), matte(0x2a2d30, 0.35, 0.4), 2.24, 0.25, 0.0);
  barrel.rotation.z = Math.PI / 2;
  for (const x of [2.14, 2.34]) {
    const ring = put(new THREE.TorusGeometry(0.1, 0.012, 8, 24), steel, x, 0.25, 0.0);
    ring.rotation.y = Math.PI / 2;
  }

  // IR LEDs in small housings on the lower rims; they glow and cast a cone toward the eye while scanning.
  const ir = new THREE.MeshStandardMaterial({ color: 0x7a1d12, emissive: 0xd93829, emissiveIntensity: 0.15, roughness: 0.2 });
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xd93829, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const cupGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.05, 20);
  const domeGeo = new THREE.SphereGeometry(0.045, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const coneGeo = new THREE.ConeGeometry(0.3, 1.4, 24, 1, true);
  sec = "ir";
  for (const s of [-1, 1]) {
    const cup = put(cupGeo, dark, s * 1.3, -0.71, 0.13);
    cup.rotation.x = Math.PI / 2;
    put(domeGeo, ir, s * 1.3, -0.71, 0.155).rotation.x = Math.PI / 2;
    const cone = put(coneGeo, coneMat, s * 1.3, -0.71, -0.56);
    cone.rotation.x = Math.PI / 2; // apex at the LED, opening toward the eye
    cone.castShadow = false;
  }

  g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.castShadow !== false) o.castShadow = true; });
  return { g, tex, hud, ir, coneMat, status };
}

export default function Glasses3D({ lesson, hudState, prompt, dark = false, exploded = false, lineup = false, wireframe = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const live = useRef({ hudState, prompt });
  const redraw = useRef<() => void>(() => {});
  const theme = useRef<(dark: boolean) => void>(() => {});
  const view = useRef({ exploded, lineup, wire: (on: boolean) => void on });

  useEffect(() => {
    live.current = { hudState, prompt };
    redraw.current();
  }, [hudState, prompt]);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      el.textContent = "WebGL is not available in this browser, so the 3D view is off. The Wiring page still works.";
      el.className += " grid place-items-center p-6 text-center text-sm";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.appendChild(renderer.domElement);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(4.6, 2.4, 8.4);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.6;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c0, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(3, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -5;
    sun.shadow.camera.right = sun.shadow.camera.top = 5;
    sun.shadow.radius = 4;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-5, 2, -4);
    scene.add(fill);

    const { g: glasses, tex, hud, ir, coneMat, status } = build();
    const parts = explodeParts(glasses).map((p) => ({ ...p, lag: lag(p.off), lineLag: lag(p.line, MAX_LINE) }));
    // guide lines: each section's centre back to where it sits when assembled
    const groups = new Map<string, { base: THREE.Vector3; off: THREE.Vector3; lag: number; line: THREE.Vector3; lineLag: number; n: number }>();
    for (const p of parts) {
      if (!p.off.lengthSq() && !p.line.lengthSq()) continue;
      const key = `${p.m.userData.sec}:${Math.sign(p.m.position.x)}`;
      const gr = groups.get(key) ?? { base: new THREE.Vector3(), off: p.off, lag: p.lag, line: p.line, lineLag: p.lineLag, n: 0 };
      gr.base.add(p.base);
      gr.n++;
      groups.set(key, gr);
    }
    const guides = [...groups.values()].map((gr) => ({ ...gr, base: gr.base.divideScalar(gr.n) }));
    const guidePos = new Float32Array(guides.length * 6);
    const guideGeo = new THREE.BufferGeometry();
    guideGeo.setAttribute("position", new THREE.BufferAttribute(guidePos, 3));
    const guideMat = new THREE.LineBasicMaterial({ color: 0xc5f467, transparent: true, opacity: 0, depthWrite: false });
    const guideLines = new THREE.LineSegments(guideGeo, guideMat);
    guideLines.frustumCulled = false;
    glasses.add(guideLines);
    // pivot keeps the exploded view centred: the glasses' own origin sits at the front of the frame
    const pivot = new THREE.Group();
    glasses.position.z = 2.2; // centre the long temples on the orbit target
    pivot.add(glasses);
    scene.add(pivot);
    view.current.wire = (on) => {
      glasses.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.isMeshStandardMaterial) m.wireframe = on;
      });
    };

    const grid = new THREE.GridHelper(16, 16, 0xffffff, 0xffffff);
    grid.position.y = -1.9;
    const gridMat = grid.material as THREE.LineBasicMaterial;
    gridMat.transparent = true;
    scene.add(grid);
    // cyan/mint rim lights pick the dark frame out of the dark theme's background
    const rims = ([[0x0099ff, 4, 5, -4], [0x10b981, -4, -2, -3]] as const).map(([color, x, y, z]) => {
      const l = new THREE.DirectionalLight(color, 0);
      l.position.set(x, y, z);
      scene.add(l);
      return l;
    });
    theme.current = (dark) => {
      gridMat.color.set(dark ? 0x00f0ff : INK);
      gridMat.opacity = dark ? 0.1 : 0.12;
      guideMat.color.set(dark ? 0xc5f467 : 0x5c8a00);
      for (const l of rims) l.intensity = dark ? 2.2 : 0;
    };
    const sc = document.createElement("canvas");
    sc.width = sc.height = 128;
    const sx = sc.getContext("2d")!;
    const grad = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(30,32,34,0.3)");
    grad.addColorStop(1, "rgba(30,32,34,0)");
    sx.fillStyle = grad;
    sx.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.89;
    scene.add(shadow);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: 0.12 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.895;
    ground.receiveShadow = true;
    scene.add(ground);

    redraw.current = () => {
      const ctx = hud.getContext("2d")!;
      const { hudState, prompt } = live.current;
      const color = hudState === "rejected" ? "#D93829" : "#188078";
      ctx.clearRect(0, 0, 512, 256);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, 500, 244);
      ctx.textBaseline = "top";
      ctx.fillStyle = color;
      ctx.font = "bold 64px monospace";
      ctx.fillText(hudState === "idle" && prompt ? "ODYSSEY" : (HEAD[hudState] ?? "READY"), 28, 24);
      ctx.fillStyle = "#1E2022";
      ctx.font = "30px monospace";
      const lines: string[] = [];
      let line = "";
      for (const word of prompt.split(/\s+/).filter(Boolean)) {
        if ((line + " " + word).trim().length > 24) { lines.push(line); line = word; } else line = (line + " " + word).trim();
      }
      if (line) lines.push(line);
      lines.slice(0, 3).forEach((l, i) => ctx.fillText(i === 2 && lines.length > 3 ? l.slice(0, 21) + "…" : l, 28, 110 + i * 40));
      tex.needsUpdate = true;
    };
    redraw.current();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 6;
    controls.maxDistance = 14;
    controls.minPolarAngle = 0.5;
    controls.maxPolarAngle = Math.PI * 0.62;
    let idle = true;
    let timer: ReturnType<typeof setTimeout>;
    controls.addEventListener("start", () => { idle = false; clearTimeout(timer); });
    controls.addEventListener("end", () => { timer = setTimeout(() => (idle = true), 4000); });

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      // keep the glasses fully in frame on narrow screens
      camera.fov = 2 * Math.atan(Math.tan((17.5 * Math.PI) / 180) * Math.max(1, 1.6 / camera.aspect)) * (180 / Math.PI);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    let onScreen = true;
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
    io.observe(el);

    const t0 = performance.now();
    const v = new THREE.Vector3();
    let amp = 0;
    let k = 0; // 0 = assembled, 1 = exploded
    let kl = 0; // 0 = assembled, 1 = lineup
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!onScreen) return;
      const t = (performance.now() - t0) / 1000;
      const goal = view.current.exploded ? 1 : 0, lineGoal = view.current.lineup ? 1 : 0;
      const ease = (x: number, to: number) => (reduced || Math.abs(to - x) < 0.002 ? to : x + (to - x) * 0.08);
      if (k !== goal || kl !== lineGoal) {
        k = ease(k, goal);
        kl = ease(kl, lineGoal);
        for (const p of parts) p.m.position.copy(p.base).addScaledVector(p.off, stagger(k, p.lag)).addScaledVector(p.line, stagger(kl, p.lineLag));
        guides.forEach((gr, i) => {
          gr.base.toArray(guidePos, i * 6);
          v.copy(gr.base).addScaledVector(gr.off, stagger(k, gr.lag)).addScaledVector(gr.line, stagger(kl, gr.lineLag)).toArray(guidePos, i * 6 + 3);
        });
        guideGeo.attributes.position.needsUpdate = true;
        guideMat.opacity = 0.35 * Math.max(k, kl);
        // both views are ~2x the assembled size; keep them in frame
        pivot.scale.setScalar(1 - 0.22 * k - 0.28 * kl);
      }
      // both pulled-apart views hold still; the lineup turns so the front-to-back row runs across the screen, lens on the left
      amp += ((idle && !reduced && !view.current.exploded && !view.current.lineup ? 0.6 : 0) - amp) * 0.04;
      pivot.rotation.y = amp * Math.sin(t * 0.5) + 0.4 * k - 0.9 * kl;
      const bob = reduced ? 0 : Math.sin(t * 1.2);
      pivot.position.y = bob * 0.07;
      shadow.scale.setScalar(1 - bob * 0.04);
      const scanning = live.current.hudState === "capturing";
      const pulse = 0.5 + 0.5 * Math.sin(t * 9);
      ir.emissiveIntensity = scanning ? 1 + pulse * 1.5 : 0.15;
      coneMat.opacity = scanning ? 0.12 + pulse * 0.14 : 0;
      status.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 3);
      controls.update();
      renderer.render(scene, camera);

      const w = el.clientWidth, h = el.clientHeight;
      const centre = camera.position.length();
      CALLOUTS.forEach((c, i) => {
        const node = labels.current[i];
        if (!node) return;
        v.copy(c.at).addScaledVector(c.off, stagger(k, c.lag)).addScaledVector(c.line, stagger(kl, c.lineLag));
        glasses.localToWorld(v);
        const far = v.distanceTo(camera.position) - centre > 1.5;
        v.project(camera);
        node.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
        const shown = c.only ? Math.max(k, kl) > 0.6 : true;
        node.style.opacity = !shown ? "0" : far ? "0.25" : "1";
      });
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); });
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      redraw.current = () => {};
      theme.current = () => {};
    };
  }, []);

  useEffect(() => theme.current(dark), [dark]);
  useEffect(() => void (view.current.exploded = exploded), [exploded]);
  useEffect(() => void (view.current.lineup = lineup), [lineup]);
  useEffect(() => view.current.wire(wireframe), [wireframe]);

  return (
    <div className="relative h-full min-h-[380px] w-full overflow-hidden">
      <div ref={host} className="absolute inset-0 touch-none" role="img" aria-label="Interactive 3D model of the Odyssey capture glasses. Drag to rotate." />
      <div className={`pointer-events-none absolute bottom-5 left-5 border-l-2 border-[var(--st-cyan)] pl-3 transition-opacity duration-500 ${exploded || lineup ? "opacity-100" : "opacity-0"}`} aria-hidden>
        <p className="text-lg font-semibold leading-tight">Odyssey capture glasses</p>
        <p className="text-sm text-[var(--st-on-var)]">3D {lineup ? "lineup" : "exploded"} view</p>
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {PARTS.map((p, i) => {
          const on = (p.lessons as readonly number[]).includes(lesson);
          const dx = p.dx * 1.6, dy = p.dy * 1.4; // longer leaders keep the boxes clear of the parts
          return (
            <div key={p.id} ref={(n) => { labels.current[i] = n; }} className="absolute left-0 top-0 transition-opacity duration-200">
              {/* leader: out from the part at an angle, then level into the box, as on a product sheet */}
              <svg className="absolute left-0 top-0 overflow-visible" width="1" height="1">
                <path d={`M0 0L${dx * 0.55} ${dy}H${dx}`} fill="none" stroke="var(--st-cyan)" strokeOpacity={on ? 0.95 : 0.7} strokeWidth="1.25" />
              </svg>
              <span className={`absolute -left-[4px] -top-[4px] size-2 rounded-full bg-[var(--st-cyan)] ${on ? "animate-pulse shadow-[0_0_8px_var(--st-cyan)]" : ""}`} />
              <span
                className={`pod absolute whitespace-nowrap rounded-lg border px-3 py-1.5 leading-snug ${on ? "border-[var(--st-cyan)]" : "border-[color-mix(in_srgb,var(--st-cyan)_40%,transparent)]"}`}
                style={{ left: dx, top: dy, transform: dx < 0 ? "translate(-100%,-50%)" : "translateY(-50%)" }}
              >
                <b className={`block text-[12px] font-semibold ${on ? "text-[var(--st-cyan)]" : "text-[var(--st-on)]"}`}>{p.title}</b>
                <span className="block text-[11px] text-[var(--st-on-var)]">({p.sub})</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
