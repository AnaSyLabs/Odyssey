// A ~6 s original jingle for the intro loader, made with Web Audio (no audio file).
// It follows IntroScene's timeline: soft pad (0-2 s), burst as the glasses explode (2 s),
// shimmer while apart, a resolving chord as they snap back (4.4 s), fade with the overlay (5-5.7 s).

/** Starts the jingle if the browser allows sound now; stays silent otherwise. Returns a stop function. */
export function playIntroJingle(): () => void {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.18;
  master.connect(ctx.destination);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0, now, 0.08);
    setTimeout(() => void ctx.close(), 500);
  };

  // Autoplay blocked (no click yet): stay silent rather than start late and out of sync.
  void ctx.resume().catch(() => {});
  setTimeout(() => ctx.state !== "running" && stop(), 300);

  const t0 = ctx.currentTime + 0.05;
  const tone = (freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 1, attack = 0.02) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const s = t0 + at;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(vol, s + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    o.connect(g).connect(master);
    o.start(s);
    o.stop(s + dur + 0.05);
  };

  // 0-2 s: low pad swells in (A2 + E3)
  tone(110, 0, 2.4, "sine", 0.5, 1.2);
  tone(164.81, 0.2, 2.2, "sine", 0.35, 1.2);

  // 2 s: the burst, a fast rising A major arpeggio plus a filtered noise whoosh
  [220, 277.18, 329.63, 440, 554.37, 659.25].forEach((f, i) => tone(f, 2 + i * 0.045, 0.9, "triangle", 0.45, 0.01));
  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const ch = noise.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(400, t0 + 2);
  bp.frequency.exponentialRampToValueAtTime(4000, t0 + 2.5);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, t0 + 2);
  ng.gain.linearRampToValueAtTime(0.25, t0 + 2.05);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
  src.connect(bp).connect(ng).connect(master);
  src.start(t0 + 2);

  // 2.3-4 s: high shimmer while the parts float apart
  tone(659.25, 2.3, 1.8, "sine", 0.12, 0.3);
  tone(880, 2.5, 1.6, "sine", 0.1, 0.3);

  // 4.4 s: snap back, a bright click and a resolving A major chord
  tone(1760, 4.4, 0.08, "square", 0.08, 0.002);
  [220, 329.63, 440, 554.37].forEach((f) => tone(f, 4.4, 1.3, "triangle", 0.35, 0.01));

  // fade out with the overlay
  master.gain.setValueAtTime(0.18, t0 + 5);
  master.gain.linearRampToValueAtTime(0, t0 + 5.7);
  return stop;
}
