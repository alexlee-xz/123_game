"""Generate mp3 voice clips for every line the game speaks, with edge-tts.

Why: the WeChat in-app browser has no speechSynthesis, so a game that only uses browser TTS is silent there.
Every spoken line is pre-generated as audio/v/<id>.mp3, where <id> = NG.audio.vid(text) (see js/core/audio.js).

Steps:
  1. powershell -NoProfile -File tools\\collect_voice.ps1 -Reps 150     (collects lines -> tools/voice_lines.json; run it a few times)
  2. python tools/gen_voice.py                                         (generates missing mp3, writes js/core/voicemap.js)

Existing mp3 files are skipped. voicemap.js lists exactly the ids that have a file, so the browser never asks for a missing one.
"""
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "audio" / "v"
LINES = ROOT / "tools" / "voice_lines.json"
MAP_JS = ROOT / "js" / "core" / "voicemap.js"
VOICE = "zh-CN-XiaoyiNeural"      # warm, friendly Mandarin (same voice as the abc_game project)
RATE = "-8%"                       # slightly slower for 4-6 year olds
MIN_BYTES = 800                    # anything smaller is a failed/empty download


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

    have = sorted(i for i in lines if (OUT / f"{i}.mp3").exists() and (OUT / f"{i}.mp3").stat().st_size >= MIN_BYTES)
    MAP_JS.write_text(
        "/* 由 tools/gen_voice.py 生成：audio/v/ 里有录音的台词。不要手改。 */\n"
        "(function (root) {\n  'use strict';\n  const NG = root.NG = root.NG || {};\n"
        "  NG.voiceMap = {" + ",".join(f'"{i}":1' for i in have) + "};\n"
        "})(typeof window !== 'undefined' ? window : globalThis);\n",
        encoding="utf-8")
    total = sum((OUT / f"{i}.mp3").stat().st_size for i in have)
    print(f"{len(have)}/{len(lines)} clips available, {total / 1e6:.1f} MB; wrote {MAP_JS.relative_to(ROOT)}")
    if len(have) < len(lines):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
