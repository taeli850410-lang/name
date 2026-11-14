#!/usr/bin/env python3
"""기준 음성을 복제해 9개 장면 내레이션을 만들고, 장면마다 Whisper 받아쓰기로 핵심 단어(숫자 포함)가
모두 맞는 후보를 고른다(첫 후보는 결정적 생성, 이후 샘플링).

  REF=ref2/ref24k.wav REF_DUR=10.3 python3 gen_voice.py          # 전체
  REF=... python3 gen_voice.py 3 6                                # 일부 장면만
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
from tts import chunk_bounds, trim  # noqa: E402
from tts_chatterbox import SR, Chatterbox  # noqa: E402
from tts_local import READ  # noqa: E402
import render2  # noqa: E402

KEYS = {
    1: [r'안녕하세요', r'부동산 ?컨설팅', r'서울 ?도심', r'5억|오억', r'가능'],
    2: [r'소개해 ?드릴', r'성북', r'무 ?허 ?가|무 ?어 ?가|모 ?어 ?가', r'2평|두 ?평', r'남짓', r'받을 ?권리'],
    3: [r'15억|십오억', r'총 ?투자금', r'19억|십구억', r'6천만|육천만|6,?000만', r'4억|사억', r'따져'],
    4: [r'실거래', r'10건|열 ?건', r'5억 ?2천만|5억 ?2,?000만|오억 ?이천만', r'이상', r'꾸준히', r'그대로'],
    5: [r'추천 ?포인트', r'첫 ?번째', r'전면 ?철거', r'496|사백구십육', r'정리'],
    6: [r'두 ?번째', r'신월곡', r'47 ?층|사십칠 ?층', r'2,?200|이천이백', r'끝나'],
    7: [r'분양 ?자격', r'분양가', r'대출', r'사업 ?기간', r'세금', r'5가지|다섯 ?가지', r'확인'],
    8: [r'성북동', r'실제로', r'분담금', r'기다릴', r'추천'],
    9: [r'무엇보다', r'분양 ?자격', r'먼저', r'물어보'],
}
TRIES = [(0.0, 0), (0.6, 11), (0.7, 23), (0.7, 37), (0.8, 51), (0.6, 67), (0.7, 79), (0.6, 91), (0.7, 103)]


def main():
    ref = os.environ.get('REF', 'ref2/ref24k.wav')
    ref_dur = float(os.environ.get('REF_DUR', '10.3'))
    scenes = [int(a) for a in sys.argv[1:]] or list(range(1, 10))
    vd = os.path.join(HERE, 'voice')
    os.makedirs(vd, exist_ok=True)
    mp = os.path.join(vd, 'manifest.json')
    man = json.load(open(mp, encoding='utf-8')) if (sys.argv[1:] and os.path.exists(mp)) else {'scenes': [None] * 9}
    cb = Chatterbox(ref, ref_dur=ref_dur)
    asr = WhisperModel('small', device='cpu', compute_type='int8')
    report = []
    for sc in scenes:
        keys = KEYS[sc]
        best = None
        for k, (temp, seed) in enumerate(TRIES):
            x, ended, _ = cb.synth(READ[sc - 1], temp=temp, seed=seed)
            if not ended:
                continue
            x = trim(x, SR)
            x = x / (np.max(np.abs(x)) or 1) * 0.9
            segs, _ = asr.transcribe(resample_poly(x, 2, 3).astype(np.float32), language='ko', beam_size=5)
            txt = ' '.join(s.text.strip() for s in segs)
            s = sum(bool(re.search(p, txt)) for p in keys)
            print(f'scene {sc} cand {k} (T={temp}): {s}/{len(keys)} | {txt}', flush=True)
            if best is None or s > best[0]:
                best = (s, x, txt)
            if s == len(keys):
                break
        s, x, txt = best
        fn = f'scene_{sc:02d}.wav'
        with wave.open(os.path.join(vd, fn), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
        b = chunk_bounds(x, SR, render2.SCRIPT[sc - 1])
        man['scenes'][sc - 1] = {'file': fn, 'dur': round(x.size / SR, 3),
                                 'chunks': [[round(a, 3), round(c, 3)] for a, c in b], 'asr': txt, 'score': f'{s}/{len(keys)}'}
        report.append(f'==> scene {sc}: {s}/{len(keys)} | {txt}')
        print(report[-1], flush=True)
    man.update({'engine': 'Chatterbox Multilingual ONNX (Resemble AI, MIT) — 기준 음성 복제', 'reference': ref,
                'reference_seconds': ref_dur})
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    print('\n'.join(report))


if __name__ == '__main__':
    main()
