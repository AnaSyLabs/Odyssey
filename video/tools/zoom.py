# Turns each take's camera targets (takes/take-NN.json) into eased zooms and joins the takes with crossfades.
# Input: 2880x1620 masters from rec.mjs. Output: zoomed/take-NN.mp4 (1920x1080) and silent-cut.mp4.
# Usage: python3 zoom.py [take numbers...]
import json, subprocess, sys
from pathlib import Path

MOVE = 0.8      # seconds for a camera move (ease in-out)
DRIFT = 0.035   # slow push-in while holding a shot (+3.5 %)
FADE = 0.5      # crossfade between takes
here = Path(__file__).parent
T, Z = here / "takes", here / "zoomed"
Z.mkdir(exist_ok=True)

def dur(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]).decode())

def piecewise(keys, var="it"):
    """keys: [(t0, t1, v0, v1)] in time order; v eases from v0 to v1 over [t0, t1] and holds between segments."""
    if not keys:
        return "1"
    expr = f"{keys[-1][3]:.4f}"
    for t0, t1, v0, v1 in reversed(keys):
        u = f"clip(({var}-{t0:.3f})/{max(t1 - t0, 0.001):.3f},0,1)"
        ease = f"({v0:.4f}+({v1 - v0:.4f})*{u}*{u}*(3-2*{u}))"
        expr = f"if(lt({var},{t0:.3f}),{v0:.4f},if(lt({var},{t1:.3f}),{ease},{expr}))"
    return expr

def camera(meta):
    W, H, d = meta["W"], meta["H"], meta["duration"]
    z, cx, cy = 1.0, W / 2, H / 2
    zk, xk, yk = [], [], []
    ev = meta["events"]
    for i, e in enumerate(ev):
        t = e["t"]
        nxt = ev[i + 1]["t"] if i + 1 < len(ev) else d
        if e["kind"] == "focus":
            x, y, w, h = e["box"]
            tz = max(1.0, min(e["zmax"], W / max(w, 1), H / max(h, 1)))
            tx, ty = x + w / 2, y + h / 2
        else:
            tz, tx, ty = 1.0, W / 2, H / 2
        move_end = min(t + MOVE, nxt)
        # keep the view inside the frame
        clampc = lambda c, full, zz: min(max(c, full / (2 * zz)), full - full / (2 * zz))
        tx, ty = clampc(tx, W, tz), clampc(ty, H, tz)
        zk.append((t, move_end, z, tz)); xk.append((t, move_end, cx, tx)); yk.append((t, move_end, cy, ty))
        z, cx, cy = tz, tx, ty
        # slow push-in while holding a focused shot
        if e["kind"] == "focus" and nxt - move_end > 1:
            dz = tz * (1 + DRIFT)
            zk.append((move_end, nxt, z, dz))
            z = dz
            cx, cy = clampc(cx, W, z), clampc(cy, H, z)
    return zk, xk, yk

def render(n):
    name = f"take-{n:02d}"
    meta = json.loads((T / f"{name}.json").read_text())
    zk, xk, yk = camera(meta)
    s = meta["DSF"]  # CSS px -> master px
    zx, xx, yx = piecewise(zk), piecewise([(a, b, c * s, d * s) for a, b, c, d in xk]), piecewise([(a, b, c * s, d * s) for a, b, c, d in yk])
    vf = (f"zoompan=z='{zx}':x='clip({xx}-iw/zoom/2,0,iw-iw/zoom)':y='clip({yx}-ih/zoom/2,0,ih-ih/zoom)'"
          f":d=1:s=1920x1080:fps=30,format=yuv420p")
    (Z / f"{name}.vf").write_text(vf)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(T / f"{name}.mp4"), "-/vf", str(Z / f"{name}.vf"),
                    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-an", str(Z / f"{name}.mp4")], check=True)
    print(f"{name}: {len(meta['events'])} moves, {dur(Z / f'{name}.mp4'):.1f} s")

def join(takes):
    files = [Z / f"take-{n:02d}.mp4" for n in takes]
    lens = [dur(f) for f in files]
    inputs, chain, prev, off = [], [], "[0:v]", 0.0
    for f in files:
        inputs += ["-i", str(f)]
    for i in range(1, len(files)):
        off += lens[i - 1] - FADE
        out = f"[v{i}]"
        chain.append(f"{prev}[{i}:v]xfade=transition=fade:duration={FADE}:offset={off:.3f}{out}")
        prev = out
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chain), "-map", prev,
                    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(here / "silent-cut.mp4")], check=True)
    print(f"silent-cut.mp4: {dur(here / 'silent-cut.mp4'):.1f} s")

if __name__ == "__main__":
    pick = [int(a) for a in sys.argv[1:]] or list(range(1, 9))
    for n in pick:
        render(n)
    if len(pick) == 8:
        join(pick)
