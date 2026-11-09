"""Narration -> one voice track + clause timings.

Each clause ("part") is synthesized on its own with Supertonic-3 (voice F4) and the
clauses are joined with short pauses, so every caption knows exactly when it is
spoken. Writes:
  assets/voice/narration.wav   the whole voice track (starts at LEAD seconds)
  timing.json                  start/end of every line and clause, in seconds

Run from the project folder with a Python that has `supertonic` and `soundfile`:
  python tools/synth_voice.py
"""

import json
import os

import numpy as np
import soundfile as sf
from supertonic import TTS

SPEED = 1.13
STEPS = 12
VOICE = "F4"
LEAD = 0.15  # first word starts here (a caption at exactly 0 s looks pre-existing)
PAUSE_COMMA = 0.10  # after a clause that ends with a comma
PAUSE_SENTENCE = 0.24  # after a clause that ends a sentence inside a line
PAUSE_LINE = 0.20  # between lines
PAUSE_BEFORE = {"l04": 0.38, "l06": 0.30, "l12": 0.30}  # a beat of silence before a payoff


def trim(w: np.ndarray, sr: int) -> np.ndarray:
    idx = np.where(np.abs(w) > 0.01)[0]
    pad = int(0.025 * sr)
    return w[max(0, idx[0] - pad) : min(len(w), idx[-1] + pad)]


def main() -> None:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg = json.load(open(os.path.join(here, "narration.json"), encoding="utf-8"))
    tts = TTS(model="supertonic-3")
    style = tts.get_voice_style(VOICE)
    sr = tts.sample_rate

    chunks = [np.zeros(int(LEAD * sr), dtype=np.float32)]
    t = LEAD
    timing = []
    for li, line in enumerate(cfg["lines"]):
        if li > 0:
            gap = PAUSE_BEFORE.get(line["id"], PAUSE_LINE)
            chunks.append(np.zeros(int(gap * sr), dtype=np.float32))
            t += gap
        line_start = t
        parts = []
        for pi, part in enumerate(line["parts"]):
            np.random.seed(int(part.get("seed", 1)))  # TTS 잡음 고정 → 같은 입력이면 같은 소리
            wav, _ = tts.synthesize(part["say"], voice_style=style, lang="ko", total_steps=STEPS, speed=SPEED)
            w = trim(np.asarray(wav, dtype=np.float32).squeeze(), sr)
            d = len(w) / sr
            parts.append({"cap": part["cap"], "start": round(t, 3), "end": round(t + d, 3)})
            chunks.append(w)
            t += d
            if pi < len(line["parts"]) - 1:
                gap = PAUSE_COMMA if part["say"].rstrip().endswith(",") else PAUSE_SENTENCE
                chunks.append(np.zeros(int(gap * sr), dtype=np.float32))
                t += gap
        timing.append({"id": line["id"], "start": round(line_start, 3), "end": round(t, 3), "parts": parts})

    track = np.concatenate(chunks)
    peak = float(np.max(np.abs(track)))
    track = track * (0.89 / peak)  # about -1 dBFS sample peak; loudness is normalized at render
    os.makedirs(os.path.join(here, "assets/voice"), exist_ok=True)
    sf.write(os.path.join(here, "assets/voice/narration.wav"), track, sr)
    json.dump({"voice": f"supertonic-3 {VOICE}", "speed": SPEED, "duration": round(t, 3), "lines": timing},
              open(os.path.join(here, "timing.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("speech ends at", round(t, 2), "s")
    for line in timing:
        print(line["id"], line["start"], "→", line["end"])


if __name__ == "__main__":
    main()
