"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { build, explodeParts } from "./Glasses3D";

const END = 5;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);

/** 0 = assembled, 1 = fully exploded: hit at 2s, slow-motion drift, snap back at 4s. */
function explode(t: number) {
  if (t < 2) return 0;
  if (t < 2.25) return 0.85 * (1 - (1 - span(t, 2, 2.25)) ** 3);
  if (t < 4) return 0.85 + 0.15 * smooth(span(t, 2.25, 4));
  return 1 - span(t, 4, 4.4) ** 3;
}

/** Side profile turning to a front three-quarter pose. */
function yaw(t: number) {
  if (t < 2) return 1.5 - 0.9 * smooth(span(t, 0, 2));
  if (t < 4) return 0.6 - 0.4 * span(t, 2, 4);
  return 0.2 - 0.65 * smooth(span(t, 4, 4.8));
}

export default function IntroScene({ onDone }: { onDone: () => void }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onDone();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.35;
    for (const [color, intensity, x, y, z] of [[0xffffff, 1.2, 2, 4, 6], [0xc5f467, 2.6, -6, 3, -6], [0xcdbdff, 2.2, 6, 2, -5]]) {
      const l = new THREE.DirectionalLight(color, intensity);
      l.position.set(x, y, z);
      scene.add(l);
    }

    const { g, hud, tex } = build();
    const parts = explodeParts(g);
    const gc = document.createElement("canvas");
    gc.width = 64;
    gc.height = 1;
    const gx = gc.getContext("2d")!;
    const grad = gx.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "#fff");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    gx.fillStyle = grad;
    gx.fillRect(0, 0, 64, 1);
    const glintMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), color: 0xc3f5ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.5), glintMat);
    glint.rotation.z = -0.5;
    glint.position.z = 0.2;
    g.add(glint);
    g.position.z = 2.2; // centre the long temples on the pivot
    const pivot = new THREE.Group();
    pivot.add(g);
    scene.add(pivot);

    let dist = 9.5;
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dist = 9.5 * Math.max(1, 1.5 / camera.aspect); // keep the exploded view in frame on narrow screens
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const t0 = performance.now();
    let camD = dist, raf = 0, hudOn = false, finished = false;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const t = (performance.now() - t0) / 1000;
      const k = explode(t);
      for (const p of parts) p.m.position.copy(p.base).addScaledVector(p.off, k);
      pivot.rotation.y = yaw(t);
      pivot.position.y = 0.08 * Math.sin(t * 1.4);
      pivot.scale.setScalar(1 + 0.03 * Math.sin(Math.PI * span(t, 4.4, 4.7)));
      camD += (dist * (1 + 0.5 * k) - camD) * 0.08;
      camera.position.set(0, 2.2 - 0.8 * smooth(span(t, 0, END)), camD);
      camera.lookAt(0, 0, 0);

      const gl = span(t, 4.4, 4.9);
      glint.position.x = -2.8 + 5.6 * gl;
      glintMat.opacity = 0.9 * Math.sin(Math.PI * gl);
      if (t > 4.4 && !hudOn) {
        hudOn = true;
        const c = hud.getContext("2d")!;
        c.fillStyle = "#c5f467";
        c.textBaseline = "middle";
        c.font = "bold 72px monospace";
        c.fillText("ODYSSEY", 40, 100);
        c.font = "28px monospace";
        c.fillText("READY", 44, 180);
        tex.needsUpdate = true;
      }
      renderer.render(scene, camera);
      if (t > END && !finished) {
        finished = true;
        onDone();
      }
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
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
    };
  }, [onDone]);

  return <div ref={host} className="absolute inset-0" aria-hidden />;
}
