#!/usr/bin/env python3
"""한국어 원어민 발음·억양(Supertonic-3) → 기준 목소리 음색(Chatterbox S3Gen 음성 변환)으로 장면별 내레이션을 만든다.
장면마다 Whisper 받아쓰기로 핵심 단어·숫자(gen_voice.KEYS)가 맞을 때까지 다시 만든다.

  REF=ref/ref24k.wav python3 gen_vc.py          # 전체
  REF=ref/ref24k.wav python3 gen_vc.py 3 6      # 일부 장면만
설정: SRC_VOICE=F5, PITCH=1.06(변환 전 원본 음높이 배율), SPEED=1.2
"""
import json
import os
import re
import subprocess
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
from vc import SR, VC, cos  # noqa: E402
import render2  # noqa: E402

SRC_VOICE = os.environ.get('SRC_VOICE', 'F5')
PITCH = float(os.environ.get('PITCH', '1.06'))
SPEED = float(os.environ.get('SPEED', '1.2'))
MAX_SEG = 9.6  # 음성 변환 한 번에 넣을 수 있는 최대 길이(모델 한도 10초)


def pitch_shift(x, r):
    if abs(r - 1) < 1e-3:
        return x
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        '-af', f'asetrate={int(SR * r)},aresample={SR},atempo={1 / r:.5f}', '-f', 'f32le', '-'],
                       input=x.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float32).astype(np.float64)


def split_points(x):
    """MAX_SEG보다 길면 가운데에 가장 가까운 쉼(무음)에서 나눈다."""
    if x.size / SR <= MAX_SEG:
        return [(0, x.size)]
    hop = int(0.01 * SR)
    r = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, 'same'))[::hop]
    quiet = np.where(r < 10 ** (-40 / 20))[0] * hop
    mid = x.size // 2
    cut = int(quiet[np.argmin(np.abs(quiet - mid))]) if quiet.size else mid
    return split_points(x[:cut]) + [(a + cut, b + cut) for a, b in split_points(x[cut:])]


def main():
    from supertonic import TTS
    scenes = [int(a) for a in sys.argv[1:]] or list(range(1, 10))
    vd = os.path.join(HERE, 'voice')
    os.makedirs(vd, exist_ok=True)
    mp = os.path.join(vd, 'manifest.json')
    man = json.load(open(mp, encoding='utf-8')) if (sys.argv[1:] and os.path.exists(mp)) else {'scenes': [None] * 9}
    vc = VC(os.environ.get('REF', 'ref/ref24k.wav'), float(os.environ.get('REF_DUR', '9.7')))
    tts = TTS(model='supertonic-3')
    style = tts.get_voice_style(SRC_VOICE)
    asr = WhisperModel('small', device='cpu', compute_type='int8')
    src_sr = getattr(tts, 'sample_rate', 44100)
    for sc in scenes:
        keys, best = KEYS[sc], None
        for k in range(int(os.environ.get('TRIES', '5'))):
            wav, _ = tts.synthesize(READ[sc - 1], voice_style=style, lang='ko', total_steps=16, speed=SPEED,
                                    silence_duration=0.2)
            x = np.asarray(wav, dtype=np.float64).reshape(-1)
            g = np.gcd(SR, src_sr)
            x = trim(resample_poly(x, SR // g, src_sr // g), SR)
            x = pitch_shift(x, PITCH)
            y = np.concatenate([vc.convert(x[a:b]) for a, b in split_points(x)])
            y = trim(y, SR)
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
    man.update({'engine': f'Supertonic-3 {SRC_VOICE} (한국어 발음·억양) → Chatterbox S3Gen 음성 변환 (기준 목소리 음색)',
                'pitch': PITCH, 'speed': SPEED})
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
