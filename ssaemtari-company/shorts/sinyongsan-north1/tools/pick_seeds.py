"""Pick a TTS seed per clause that is heard exactly right.

TTS draws random noise, so the same text can come out with a digit slurred
("칠천육백오십" heard as "칠천이백오십"). For every clause this tries seeds in
turn, transcribes the result with Whisper (medium, Korean) and keeps the first
seed whose transcript has the same digits as the caption and reads close to it.
The chosen seeds are written back to narration.json.

  python tools/pick_seeds.py            # every clause
  python tools/pick_seeds.py l03 l06    # only these lines
"""

import difflib
import json
import os
import re
import sys

import numpy as np
from faster_whisper import WhisperModel
from supertonic import TTS

SEEDS = range(1, 13)
SPEED, STEPS, VOICE = 1.13, 12, "F4"


def norm(text: str) -> str:
    t = text.replace("㎡", "제곱미터").replace("~", "에서").replace("%", "퍼센트")
    t = t.replace("쌤", "샘").replace("태", "테")  # Whisper spells 쌤 as 샘; 태/테 sound the same
    return re.sub(r"[\s,.?!·]", "", t)


def digits(text: str) -> str:
    return re.sub(r"\D", "", text)


def main() -> None:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(here, "narration.json")
    cfg = json.load(open(path, encoding="utf-8"))
    only = set(sys.argv[1:])
    tts = TTS(model="supertonic-3")
    style = tts.get_voice_style(VOICE)
    sr = tts.sample_rate
    asr = WhisperModel("medium", device="cpu", compute_type="int8")

    for line in cfg["lines"]:
        if only and line["id"] not in only:
            continue
        for i, part in enumerate(line["parts"]):
            best = None
            for seed in SEEDS:
                np.random.seed(seed)
                wav, _ = tts.synthesize(part["say"], voice_style=style, lang="ko", total_steps=STEPS, speed=SPEED)
                w = np.asarray(wav, dtype=np.float32).squeeze()
                a16 = np.interp(np.arange(0, len(w), sr / 16000), np.arange(len(w)), w).astype(np.float32)
                segs, _ = asr.transcribe(a16, language="ko", beam_size=5, condition_on_previous_text=False)
                heard = "".join(s.text for s in segs).strip()
                ratio = difflib.SequenceMatcher(None, norm(heard), norm(part["cap"])).ratio()
                ok = digits(heard) == digits(part["cap"]) and ratio >= 0.85
                if best is None or (ok, ratio) > (best[1], best[2]):
                    best = (seed, ok, ratio, heard)
                if ok and ratio >= 0.95:
                    break
            seed, ok, ratio, heard = best
            part["seed"] = seed
            flag = "OK " if ok else "?? "
            print(f"{flag}{line['id']}.{i} seed={seed} r={ratio:.2f} | {part['cap']} | 들림: {heard}", flush=True)

    json.dump(cfg, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
