# Guide-voice version of the demo: ElevenLabs narration per section over the zoomed takes.
# Each zoomed take (zoomed/take-NN.mp4) is held on its last frame until its narration ends, then the takes
# are joined with crossfades and each section's voice is placed where its take starts.
# The key is read from ~/.elevenlabs_key (never written into the repo). Usage: python3 voice.py [voice_id]
import json, subprocess, sys, urllib.request
from pathlib import Path

VOICE = sys.argv[1] if len(sys.argv) > 1 else "onwK4e9ZLuTAKqWW03F9"  # Daniel: steady broadcaster
KEY = Path("~/.elevenlabs_key").expanduser().read_text().strip()
LEAD, TAIL, FADE = 0.4, 0.8, 0.5  # pause before the voice in each section, after it, and the crossfade
here = Path(__file__).parent
VO, SEC = here / "vo", here / "sec"
VO.mkdir(exist_ok=True); SEC.mkdir(exist_ok=True)

def dur(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]).decode())

def run(*a):
    subprocess.run([str(x) for x in a], check=True)

secs = json.load(open(here / "vo.json"))
starts, mp3s, vids = [], [], []
t = 0.0
for s in secs:
    n = s["n"]
    mp3 = VO / f"{n:02d}.mp3"
    if not mp3.exists():
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
            data=json.dumps({"text": s["text"], "model_id": "eleven_multilingual_v2",
                             "voice_settings": {"stability": 0.55, "similarity_boost": 0.75, "style": 0.15, "use_speaker_boost": True}}).encode(),
            headers={"xi-api-key": KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"})
        mp3.write_bytes(urllib.request.urlopen(req).read())
    v, src = dur(mp3), here / "zoomed" / f"take-{n:02d}.mp4"
    f = dur(src)
    target = max(f, LEAD + v + TAIL)
    out = SEC / f"{n:02d}.mp4"
    # hold the last frame until the narration is done; never cut the footage short
    run("ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"tpad=stop_mode=clone:stop_duration={target - f:.3f}",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-r", "30", "-an", out)
    starts.append(t + LEAD); mp3s.append(mp3); vids.append(out)
    print(f"section {n}: voice {v:.1f}s, footage {f:.1f}s -> {target:.1f}s, starts at {t:.1f}s")
    t += target - FADE  # the next take fades in over the last FADE seconds of this one

# video: crossfade chain
lens = [dur(v) for v in vids]
inputs, chain, prev, off = [], [], "[0:v]", 0.0
for v in vids:
    inputs += ["-i", v]
for i in range(1, len(vids)):
    off += lens[i - 1] - FADE
    chain.append(f"{prev}[{i}:v]xfade=transition=fade:duration={FADE}:offset={off:.3f}[v{i}]")
    prev = f"[v{i}]"
# audio: each section's voice delayed to its start, mixed, loudness-normalised
k = len(vids)
for m in mp3s:
    inputs += ["-i", m]
for i, st in enumerate(starts):
    chain.append(f"[{k + i}:a]aresample=48000,adelay={int(st * 1000)}:all=1[a{i}]")
chain.append("".join(f"[a{i}]" for i in range(len(mp3s))) + f"amix=inputs={len(mp3s)}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
out = here / "odyssey-demo-AI-VOICE.mp4"
run("ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chain), "-map", prev, "-map", "[aout]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
    "-shortest", "-movflags", "+faststart", out)
total = dur(out)
print(f"{out.name}: {total:.1f}s ({int(total // 60)}:{total % 60:04.1f})", "within 2:00-4:00" if 120 <= total <= 240 else "OUTSIDE 2:00-4:00")
