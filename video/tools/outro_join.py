# Appends the Odi outro (final/outro.mp4) to the guide cut with a crossfade; the audio runs on into silence.
import subprocess
from pathlib import Path
here = Path(__file__).parent
FADE = 0.6
def dur(f): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]).decode())
main, outro, out = here / "odyssey-demo-AI-VOICE.mp4", here / "final" / "outro.mp4", here / "odyssey-demo-AI-VOICE-odi.mp4"
m, o = dur(main), dur(outro)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(main), "-i", str(outro), "-filter_complex",
    f"[0:v][1:v]xfade=transition=fade:duration={FADE}:offset={m - FADE:.3f}[v];[0:a]apad=whole_dur={m + o - FADE:.3f}[a]",
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)], check=True)
t = dur(out)
print(f"{out.name}: {int(t // 60)}:{t % 60:04.1f}", "within 2:00-4:00" if 120 <= t <= 240 else "OUTSIDE 2:00-4:00")
