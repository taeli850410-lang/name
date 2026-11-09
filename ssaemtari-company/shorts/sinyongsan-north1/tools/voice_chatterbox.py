"""narration.json -> assets/voice/narration.wav + timing.json (단어별 시각)

줄마다 Chatterbox Multilingual 로 통째로 합성한다(억양이 끊기지 않게). 한 줄에 여러 번
만들어 Whisper 로 되읽고, 숫자가 자막과 같고 문장이 맞으며 참고 목소리와 가장 닮은 것을
고른다. 문장 끝에 붙는 군소리는 마지막 단어 뒤에서 잘라 낸다. 이어 붙인 뒤 방송용 처리
(tools/master_voice.sh, 템포 포함)를 하고, 완성본을 다시 Whisper 로 읽어 단어별 시각을
timing.json 에 적는다. 자막과 장면 타이밍은 tools/build.py 가 이 시각으로 계산한다.

  python tools/voice_chatterbox.py --ref <참고목소리.wav> [--heldout <같은사람 다른녹음.wav>]

참고 목소리 녹음은 개인 음성이라 저장소에 넣지 않는다.
"""

import argparse
import difflib
import json
import os
import re
import subprocess
import time

import librosa
import numpy as np
import soundfile as sf
import torch
from faster_whisper import WhisperModel

from chatterbox.mtl_tts import ChatterboxMultilingualTTS

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEAD = 0.15  # 첫 말소리 시각(완성본 기준)
GAP = 0.22  # 줄 사이 쉼(완성본 기준)


def norm(t: str) -> str:
    t = t.replace("㎡", "제곱미터").replace("~", "에서").replace("쌤", "샘").replace("태", "테")
    return re.sub(r"[\s,.?!·]", "", t)


def digits(t: str) -> str:
    return re.sub(r"\D", "", t)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", required=True)
    ap.add_argument("--heldout")
    args = ap.parse_args()

    path = os.path.join(HERE, "narration.json")
    cfg = json.load(open(path, encoding="utf-8"))
    st = cfg["settings"]
    tempo = float(st["tempo"])

    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    sr = model.sr
    asr = WhisperModel("medium", device="cpu", compute_type="int8")

    def embed(w, in_sr):
        w16 = librosa.resample(w, orig_sr=in_sr, target_sr=16000) if in_sr != 16000 else w
        e = np.asarray(model.ve.embeds_from_wavs([w16.astype(np.float32)], sample_rate=16000)).reshape(-1)
        return e / np.linalg.norm(e)

    target = embed(librosa.load(args.heldout or args.ref, sr=16000)[0], 16000)
    model.prepare_conditionals(args.ref, exaggeration=st["exaggeration"])

    chosen = []
    for line in cfg["lines"]:
        best = None
        seeds = [line["seed"]] if "seed" in line else range(1, int(st["takes"]) + 1)
        for seed in seeds:
            torch.manual_seed(seed)
            w = model.generate(line["say"], language_id="ko", exaggeration=st["exaggeration"],
                               cfg_weight=st["cfg_weight"], temperature=st["temperature"])
            w = w.squeeze().cpu().numpy().astype(np.float32)
            segs, _ = asr.transcribe(librosa.resample(w, orig_sr=sr, target_sr=16000), language="ko", beam_size=5,
                                     word_timestamps=True, condition_on_previous_text=False)
            words = [x for s in segs for x in (s.words or [])]
            k_best, r_best = len(words), -1.0
            for k in range(1, len(words) + 1):  # 문장을 다 말한 지점 → 그 뒤 군소리는 버린다
                r = difflib.SequenceMatcher(None, norm("".join(x.word for x in words[:k])), norm(line["cap"])).ratio()
                if r > r_best + 1e-9:
                    k_best, r_best = k, r
            end = words[k_best - 1].end + 0.12 if words else len(w) / sr
            w = w[: int(min(len(w), end * sr))]
            idx = np.where(np.abs(w) > 0.01)[0]
            if len(idx):
                w = w[max(0, idx[0] - int(0.02 * sr)):]
            kept = "".join(x.word for x in words[:k_best]).strip()
            ok = digits(kept) == digits(line["cap"]) and r_best >= 0.9
            score = (ok, round(r_best, 3), float(embed(w, sr) @ target))
            print(f"  {line['id']} seed{seed} ok={ok} r={r_best:.2f} sim={score[2]:.3f} | {kept}", flush=True)
            if best is None or score > best[0]:
                best = (score, w, seed, kept)
        line["seed"] = best[2]
        chosen.append(best)
        print(f"{line['id']} -> seed {best[2]} {best[0]} | {best[3]}", flush=True)

    # 이어 붙이기 — 쉼은 완성본 기준 초이므로 템포를 곱해 원본 길이로 넣는다
    pieces = [np.zeros(int(LEAD * tempo * sr), dtype=np.float32)]
    for i, (line, (_, w, _, _)) in enumerate(zip(cfg["lines"], chosen)):
        if i > 0:
            pieces.append(np.zeros(int(line.get("pause_before", GAP) * tempo * sr), dtype=np.float32))
        pieces.append(w)
    raw = np.concatenate(pieces)
    raw = raw / max(1e-6, float(np.max(np.abs(raw)))) * 0.89
    os.makedirs(os.path.join(HERE, "assets/voice"), exist_ok=True)
    raw_path = os.path.join(HERE, "assets/voice/narration_raw.wav")
    final_path = os.path.join(HERE, "assets/voice/narration.wav")
    sf.write(raw_path, raw, sr)
    subprocess.run([os.path.join(HERE, "tools/master_voice.sh"), raw_path, final_path, str(tempo)], check=True)
    os.remove(raw_path)

    # 완성본을 다시 읽어 단어별 시각을 얻는다
    final, fsr = librosa.load(final_path, sr=16000)
    t = LEAD * tempo
    timing = []
    for i, (line, (_, w, _, _)) in enumerate(zip(cfg["lines"], chosen)):
        if i > 0:
            t += line.get("pause_before", GAP) * tempo
        start, end = t / tempo, (t + len(w) / sr) / tempo
        t += len(w) / sr
        a, b = max(0.0, start - 0.08), min(len(final) / 16000, end + 0.12)
        segs, _ = asr.transcribe(final[int(a * 16000): int(b * 16000)], language="ko", beam_size=5,
                                 word_timestamps=True, condition_on_previous_text=False)
        words = [{"w": x.word.strip(), "s": round(a + x.start, 3), "e": round(a + x.end, 3)} for s in segs for x in (s.words or [])]
        heard = " ".join(x["w"] for x in words)
        timing.append({"id": line["id"], "start": round(words[0]["s"] if words else start, 3),
                       "end": round(words[-1]["e"] if words else end, 3), "cap": line["cap"], "heard": heard,
                       "ok": digits(heard) == digits(line["cap"]), "words": words})
        print(f"{line['id']} {timing[-1]['start']:.2f}-{timing[-1]['end']:.2f} ok={timing[-1]['ok']} | {heard}", flush=True)

    json.dump(cfg, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump({"voice": cfg["voice"], "duration": timing[-1]["end"], "lines": timing},
              open(os.path.join(HERE, "timing.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("speech ends at", timing[-1]["end"], "s · all lines ok:", all(x["ok"] for x in timing))


if __name__ == "__main__":
    main()
