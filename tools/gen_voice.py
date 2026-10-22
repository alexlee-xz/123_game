"""Generate mp3 voice clips for every line the game speaks, with edge-tts.

Why: the WeChat in-app browser has no speechSynthesis, so a game that only uses browser TTS is silent there.
Every spoken line is pre-generated as audio/v/<id>.mp3, where <id> = NG.audio.vid(text) (see js/core/audio.js).

Steps:
  1. powershell -NoProfile -File tools\\collect_voice.ps1 -Reps 150     (collects lines -> tools/voice_lines.json; run it a few times)
  2. python tools/gen_voice.py                                         (generates missing mp3, writes js/core/voicemap.js)

Existing mp3 files are skipped. voicemap.js lists exactly the ids that have a file, so the browser never asks for a missing one.

Speed: edge-tts clips carry ~0.2 s of silence at the start and ~0.9 s at the end. Every clip is trimmed and re-encoded
at 32 kbps with ffmpeg (needs ffmpeg on PATH), so the voice starts sooner and the files are 2-3x smaller.
Trimmed files are recognised by their 32 kbps header, so running this script again only touches new/untrimmed clips.
voicemap.js also lists NG.voiceWarm: short, frequently used lines that the page pre-loads in the background.
"""
import asyncio
import json
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "audio" / "v"
LINES = ROOT / "tools" / "voice_lines.json"
MAP_JS = ROOT / "js" / "core" / "voicemap.js"
VOICE = "zh-CN-XiaoyiNeural"      # warm, friendly Mandarin (same voice as the abc_game project)
RATE = "-8%"                       # slightly slower for 4-6 year olds
MIN_BYTES = 400                    # anything smaller is a failed/empty download (trimmed clips can be ~1 KB)
WARM_MAX_CHARS = 6                 # lines up to this length are pre-loaded by the page (~2 MB in total)
TRIM_FILTER = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,"
               "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse")
_BR_MPEG2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]


def mp3_kbps(path):
    """Bitrate from the first MPEG frame header (0 if unknown)."""
    data = path.read_bytes()[:8192]
    if data[:3] == b"ID3":
        n = 10 + ((data[6] & 0x7F) << 21 | (data[7] & 0x7F) << 14 | (data[8] & 0x7F) << 7 | (data[9] & 0x7F))
        data = path.read_bytes()[n:n + 4096]
    for i in range(len(data) - 3):
        if data[i] == 0xFF and (data[i + 1] & 0xE0) == 0xE0:
            ver, layer, idx = (data[i + 1] >> 3) & 3, (data[i + 1] >> 1) & 3, data[i + 2] >> 4
            if ver == 2 and layer == 1 and 0 < idx < 15:       # MPEG-2 (24 kHz) layer III
                return _BR_MPEG2_L3[idx]
    return 0


def trim(path):
    """Cut leading/trailing silence and re-encode at 32 kbps. Returns True if the file was rewritten."""
    ff = shutil.which("ffmpeg")
    if not ff:
        print("WARNING: ffmpeg not found, clips are left untrimmed", flush=True)
        return False
    if mp3_kbps(path) == 32:
        return False
    tmp = path.with_suffix(".tmp.mp3")
    r = subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(path), "-af", TRIM_FILTER,
                        "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "32k", str(tmp)])
    if r.returncode != 0 or not tmp.exists() or tmp.stat().st_size < MIN_BYTES:
        tmp.unlink(missing_ok=True)
        return False
    tmp.replace(path)
    return True


async def main():
    lines = json.loads(LINES.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(6)
    todo = [(i, t) for i, t in lines.items() if not (OUT / f"{i}.mp3").exists() or (OUT / f"{i}.mp3").stat().st_size < MIN_BYTES]
    print(f"{len(lines)} lines, {len(todo)} to generate", flush=True)
    done = 0

    async def run(i, text):
        nonlocal done
        out = OUT / f"{i}.mp3"
        async with sem:
            for attempt in range(4):
                try:
                    await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(out))
                    if out.stat().st_size >= MIN_BYTES:
                        done += 1
                        if done % 100 == 0:
                            print(f"  {done}/{len(todo)}", flush=True)
                        return
                except Exception as e:  # network hiccup: retry
                    if attempt == 3:
                        print("FAIL", i, text, e, flush=True)
                await asyncio.sleep(1.0 + attempt)
            out.unlink(missing_ok=True)

    await asyncio.gather(*(run(i, t) for i, t in todo))

    # trim silence + shrink (only clips that are not 32 kbps yet)
    files = [OUT / f"{i}.mp3" for i in lines if (OUT / f"{i}.mp3").exists()]
    with ThreadPoolExecutor(max_workers=6) as ex:
        n = sum(ex.map(trim, files))
    print(f"trimmed {n} clips", flush=True)

    have = sorted(i for i in lines if (OUT / f"{i}.mp3").exists() and (OUT / f"{i}.mp3").stat().st_size >= MIN_BYTES)
    hs = set(have)
    warm = [i for i, t in sorted(lines.items(), key=lambda kv: (len(kv[1]), kv[1])) if i in hs and len(t) <= WARM_MAX_CHARS]
    MAP_JS.write_text(
        "/* 由 tools/gen_voice.py 生成：audio/v/ 里有录音的台词（voiceMap），以及打开页面后在后台预先下载的常用短句（voiceWarm）。不要手改。 */\n"
        "(function (root) {\n  'use strict';\n  const NG = root.NG = root.NG || {};\n"
        "  NG.voiceMap = {" + ",".join(f'"{i}":1' for i in have) + "};\n"
        "  NG.voiceWarm = [" + ",".join(f'"{i}"' for i in warm) + "];\n"
        "})(typeof window !== 'undefined' ? window : globalThis);\n",
        encoding="utf-8")
    total = sum((OUT / f"{i}.mp3").stat().st_size for i in have)
    print(f"{len(have)}/{len(lines)} clips available, {total / 1e6:.1f} MB; wrote {MAP_JS.relative_to(ROOT)}")
    if len(have) < len(lines):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
