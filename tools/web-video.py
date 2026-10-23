#!/usr/bin/env python3
"""Make a web-sized copy of a video for the site.

Easiest: drag a video onto tools/web-video.bat. Or from the Portfolio folder:
  py tools/web-video.py "C:/Videos/recording.mp4" [--name Cubes] [--crop W:H:X:Y] [--width 1024] [--quality 30]

What it does:
  - writes Media/<name>.mp4: 30 frames a second, at most --width pixels wide,
    no sound, set up to start playing before it has fully downloaded
  - if the video you gave it is already in Media, moves that full-size original
    to _originals/ first (git ignores that folder, so it never goes online)
  - then brings the posters up to date (tools/make-posters.py)

--quality is ffmpeg's CRF: lower is sharper and bigger. 30 kept the wood grain
on 2000 textured cubes at about 6 MB for 24 seconds; 32 smeared it.
--crop cuts out a rectangle: width:height:left:top in the original's pixels.
Easier still: record with OBS's Window Capture on the renderer's window, not
Display Capture, and there's nothing to crop.
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "Media"
ORIGINALS = ROOT / "_originals"


def find_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return None


def main():
    p = argparse.ArgumentParser(description="Make a web-sized copy of a video in Media.")
    p.add_argument("video")
    p.add_argument("--name", help="file name in Media, without .mp4 (default: the video's own name)")
    p.add_argument("--crop", help="width:height:left:top")
    p.add_argument("--width", type=int, default=1024)
    p.add_argument("--quality", type=int, default=30)
    a = p.parse_args()

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        print("ffmpeg not found. Install it with:  py -m pip install imageio-ffmpeg")
        return 1

    source = Path(a.video).resolve()
    if not source.exists():
        print("No such file: " + str(source))
        return 1
    target = MEDIA / ((a.name or source.stem) + ".mp4")

    # an original already in Media moves to _originals first, so the copy can take its place
    if source.parent == MEDIA:
        ORIGINALS.mkdir(exist_ok=True)
        kept = ORIGINALS / source.name
        if kept.exists():
            print("_originals already has " + source.name + "; rename one of them first.")
            return 1
        source = Path(shutil.move(str(source), str(kept)))
        print("Original kept at " + str(kept.relative_to(ROOT)))

    filters = ([f"crop={a.crop}"] if a.crop else []) + ["fps=30", f"scale='min({a.width},iw)':-2:flags=lanczos"]
    print("Making " + str(target.relative_to(ROOT)) + " ...")
    result = subprocess.run([ffmpeg, "-v", "error", "-y", "-i", str(source), "-vf", ",".join(filters),
                             "-c:v", "libx264", "-preset", "slow", "-crf", str(a.quality),
                             "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(target)])
    if result.returncode != 0:
        print("ffmpeg couldn't convert it (see the message above).")
        return 1
    print(f"Done: {source.stat().st_size / 1e6:.1f} MB -> {target.stat().st_size / 1e6:.1f} MB")
    subprocess.run([sys.executable, str(ROOT / "tools" / "make-posters.py")])
    return 0


if __name__ == "__main__":
    sys.exit(main())
