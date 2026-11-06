# Final guide-voice cut: the 8 zoomed takes plus placeholder cards where live clips go (02b, 06b), each section
# exactly as long as its narration, joined with crossfades, voice placed at each section's start.
# Voice is played 10 % faster (pitch kept) so the whole video stays under ETHGlobal's 4:00 limit.
import subprocess
from pathlib import Path

ORDER = ["01", "02", "02b", "03", "04", "05", "06", "06b", "07", "08"]
TEMPO, LEAD, TAIL, FADE = 1.10, 0.3, 0.5, 0.5
here = Path(__file__).parent
OUT = here / "final"
OUT.mkdir(exist_ok=True)

def dur(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]).decode())

def run(*a):
    subprocess.run([str(x) for x in a], check=True)

vids, auds, starts, t = [], [], [], 0.0
for k in ORDER:
    wav = OUT / f"{k}.wav"
    run("ffmpeg", "-v", "error", "-y", "-i", here / "vo" / f"{k}.mp3", "-af", f"atempo={TEMPO},aresample=48000", "-ac", "2", wav)
    v = dur(wav)
    length = LEAD + v + TAIL
    vid = OUT / f"{k}.mp4"
    if k.endswith("b"):
        # placeholder card for a clip the team films live
        run("ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "30", "-i", here / f"card-{k}.png", "-t", f"{length:.3f}",
            "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-tune", "stillimage", vid)
    else:
        src = here / "zoomed" / f"take-{k}.mp4"
        f = dur(src)
        # trim footage to the narration, or hold its last frame if it runs short
        vf = f"tpad=stop_mode=clone:stop_duration={max(0.0, length - f):.3f},trim=duration={length:.3f},setpts=PTS-STARTPTS"
        run("ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-r", "30", "-an", vid)
        print(f"{k}: voice {v:.1f}s, footage {f:.1f}s", "(held)" if f < length else "")
    vids.append(vid); auds.append(wav); starts.append(t + LEAD)
    t += length - FADE

lens = [dur(v) for v in vids]
inputs, chain, prev, off = [], [], "[0:v]", 0.0
for v in vids:
    inputs += ["-i", v]
for i in range(1, len(vids)):
    off += lens[i - 1] - FADE
    chain.append(f"{prev}[{i}:v]xfade=transition=fade:duration={FADE}:offset={off:.3f}[v{i}]")
    prev = f"[v{i}]"
n = len(vids)
for a in auds:
    inputs += ["-i", a]
for i, st in enumerate(starts):
    chain.append(f"[{n + i}:a]adelay={int(st * 1000)}:all=1[a{i}]")
chain.append("".join(f"[a{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
out = here / "odyssey-demo-AI-VOICE.mp4"
run("ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chain), "-map", prev, "-map", "[aout]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-shortest", "-movflags", "+faststart", out)
total = dur(out)
print(f"{out.name}: {int(total // 60)}:{total % 60:04.1f}", "within 2:00-4:00" if 120 <= total <= 240 else "OUTSIDE 2:00-4:00")
