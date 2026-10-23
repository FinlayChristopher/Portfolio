#!/usr/bin/env python3
"""Make a poster image for every video in Media.

A video's poster is a .jpg with the same name next to it (Cubes.mp4 -> Cubes.jpg).
Browsers show it before the video plays, and iPhones show nothing without it.

A poster is made when it's missing or older than its video, from the frame one
second in (the very first frame is often black). To use a frame you picked
yourself, save it over the .jpg after the video: it's then newer, so it's kept.

Runs automatically before every commit (.githooks/pre-commit) and whenever
preview.bat starts. Run it by hand with:  py tools/make-posters.py
Needs ffmpeg: either on PATH, or  py -m pip install imageio-ffmpeg
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "Media"
VIDEOS = {".mp4", ".webm"}


def find_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return None


def needs_poster(video, poster):
    return not poster.exists() or poster.stat().st_mtime < video.stat().st_mtime


def make_poster(ffmpeg, video, poster):
    for at in ("1", "0"):   # one second in; a clip shorter than that falls back to its first frame
        result = subprocess.run(
            [ffmpeg, "-v", "error", "-y", "-ss", at, "-i", str(video), "-frames:v", "1",
             "-vf", "scale='min(1280,iw)':-2", "-q:v", "3", str(poster)],
            capture_output=True)
        if result.returncode == 0 and poster.exists() and not needs_poster(video, poster):
            return True
    return False


def main():
    stage = "--stage" in sys.argv   # the commit hook adds new posters to the commit
    todo = [(v, v.with_suffix(".jpg")) for v in sorted(MEDIA.rglob("*"))
            if v.suffix.lower() in VIDEOS and needs_poster(v, v.with_suffix(".jpg"))]
    if not todo:
        return 0
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        print("Posters: ffmpeg not found, so these videos have no up-to-date poster:")
        for video, _ in todo:
            print("  " + str(video.relative_to(ROOT)))
        print("Install it with:  py -m pip install imageio-ffmpeg")
        return 0   # never block a commit over a poster
    made = []
    for video, poster in todo:
        if make_poster(ffmpeg, video, poster):
            made.append(poster)
            print("Poster made: " + str(poster.relative_to(ROOT)))
        else:
            print("Couldn't make a poster for " + str(video.relative_to(ROOT)))
    if stage and made:
        subprocess.run(["git", "add", "--"] + [str(p) for p in made], cwd=ROOT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
