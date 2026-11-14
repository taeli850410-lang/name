#!/usr/bin/env python3
"""장면별 내레이션을 음 높이 그대로 빠르게(ffmpeg atempo) 맞추고, 말풍선 타이밍을 다시 계산한다.

  TARGET=7.0 python3 speedup.py        # 초당 7음절 목표 (장면별 배속은 1.0~1.25로 제한)
원본은 voice_raw/에 보관하고 voice/를 덮어쓴다.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tts import chunk_bounds  # noqa: E402
from tts_local import READ  # noqa: E402
import render2  # noqa: E402

TARGET = float(os.environ.get('TARGET', '7.0'))
LO, HI = 1.0, 1.25


def read(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768, w.getframerate()


def main():
    vd, raw = os.path.join(HERE, 'voice'), os.path.join(HERE, 'voice_raw')
    if not os.path.isdir(raw):
        shutil.copytree(vd, raw)
    man = json.load(open(os.path.join(raw, 'manifest.json'), encoding='utf-8'))
    for i, sc in enumerate(man['scenes']):
        x, sr = read(os.path.join(raw, sc['file']))
        syl = len(re.findall(r'[가-힣]', READ[i]))
        rate = syl / (x.size / sr)
        f = min(HI, max(LO, TARGET / rate))
        out = os.path.join(vd, sc['file'])
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(raw, sc['file']),
                        '-af', f'atempo={f:.4f}', '-ar', str(sr), '-ac', '1', '-c:a', 'pcm_s16le', out], check=True)
        y, _ = read(out)
        b = chunk_bounds(y, sr, render2.SCRIPT[i])
        sc.update({'dur': round(y.size / sr, 3), 'chunks': [[round(a, 3), round(c, 3)] for a, c in b], 'tempo': round(f, 3)})
        print(f'scene {i + 1}: {rate:4.2f} → {syl / (y.size / sr):4.2f} 음절/초 (x{f:.3f}) {y.size / sr:5.2f}s')
    man['speed_target_syl_per_s'] = TARGET
    json.dump(man, open(os.path.join(vd, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
