#!/usr/bin/env python3
"""한국어 원어민 음성 모델(Supertonic-3, Supertone)만으로 내레이션을 만든다 — 음성 변환(Chatterbox)을 거치지 않아
외국어 억양이 섞이지 않는다. 목소리는 여성 프리셋 F1~F5를 섞어 기준 음성과 가장 닮은 조합(style_mix.json)을 쓴다.
장면마다 Whisper 받아쓰기로 핵심 단어·숫자(gen_voice.KEYS)가 맞을 때까지 다시 만든다.

  python3 gen_native.py          # 전체
  python3 gen_native.py 2 6      # 일부 장면만
"""
import json
import os
import re
import sys
import wave

import numpy as np
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from faster_whisper import WhisperModel  # noqa: E402
from gen_voice import KEYS  # noqa: E402
from tts import chunk_bounds, trim  # noqa: E402
from tts_local import READ  # noqa: E402
import render2  # noqa: E402

SR = 24000
SPEED = float(os.environ.get('SPEED', '1.2'))
TRIES = int(os.environ.get('TRIES', '6'))


def blended_style(tts, path=os.path.join(HERE, 'style_mix.json')):
    from supertonic.core import Style
    cfg = json.load(open(path))
    base = {v: tts.get_voice_style(v) for v in cfg['names']}
    w = np.array(cfg['weights'], np.float32)
    w = w / w.sum()
    return Style(sum(wi * base[n].ttl for wi, n in zip(w, cfg['names'])),
                 sum(wi * base[n].dp for wi, n in zip(w, cfg['names']))), cfg


def main():
    from supertonic import TTS
    scenes = [int(a) for a in sys.argv[1:]] or list(range(1, 10))
    vd = os.path.join(HERE, 'voice')
    os.makedirs(vd, exist_ok=True)
    mp = os.path.join(vd, 'manifest.json')
    man = json.load(open(mp, encoding='utf-8')) if (sys.argv[1:] and os.path.exists(mp)) else {'scenes': [None] * 9}
    tts = TTS(model='supertonic-3')
    style, cfg = blended_style(tts)
    src_sr = getattr(tts, 'sample_rate', 44100)
    g = np.gcd(SR, src_sr)
    asr = WhisperModel('small', device='cpu', compute_type='int8')
    for sc in scenes:
        keys, best = KEYS[sc], None
        for k in range(TRIES):
            wav, _ = tts.synthesize(READ[sc - 1], voice_style=style, lang='ko', total_steps=16, speed=SPEED,
                                    silence_duration=0.2)
            y = trim(resample_poly(np.asarray(wav, dtype=np.float64).reshape(-1), SR // g, src_sr // g), SR)
            y = y / (np.abs(y).max() or 1) * 0.9
            segs, _ = asr.transcribe(resample_poly(y, 2, 3).astype(np.float32), language='ko', beam_size=5)
            txt = ' '.join(s.text.strip() for s in segs)
            s = sum(bool(re.search(p, txt)) for p in keys)
            print(f'scene {sc} try {k}: {s}/{len(keys)} {y.size / SR:4.2f}s | {txt}', flush=True)
            if best is None or s > best[0]:
                best = (s, y, txt)
            if s == len(keys):
                break
        s, y, txt = best
        fn = f'scene_{sc:02d}.wav'
        with wave.open(os.path.join(vd, fn), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes())
        b = chunk_bounds(y, SR, render2.SCRIPT[sc - 1])
        man['scenes'][sc - 1] = {'file': fn, 'dur': round(y.size / SR, 3), 'chunks': [[round(a, 3), round(c, 3)] for a, c in b],
                                 'asr': txt, 'score': f'{s}/{len(keys)}'}
        print(f'==> scene {sc}: {s}/{len(keys)} | {txt}', flush=True)
    man.update({'engine': 'Supertonic-3 (Supertone) 한국어 원어민 음성, 여성 프리셋 혼합 — 음성 변환 없음',
                'style_mix': {n: round(w, 3) for n, w in zip(cfg['names'], cfg['weights'])}, 'speed': SPEED})
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
