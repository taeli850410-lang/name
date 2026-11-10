"""틀리게 들린 장면을 샘플링으로 여러 번 만들어, 받아쓰기에서 핵심 단어가 가장 많이 맞는 후보를 고른다."""
import json, re, sys, wave
import numpy as np
from scipy.signal import resample_poly
sys.path.insert(0, '.')
from faster_whisper import WhisperModel
from tts_chatterbox import Chatterbox, SR
from tts import chunk_bounds, trim
from tts_local import READ
import render2

KEYS = {
    2: [r'성북', r'무허가', r'2\.42|이 ?점 ?사 ?이', r'새 ?집', r'권리'],
    3: [r'15억|십오억', r'19억|십구억', r'6천만|육천만', r'4억|사억', r'적정'],
    6: [r'신월곡', r'47 ?층|사십칠 ?층', r'2,?200|이천이백', r'마무리'],
    7: [r'분양 ?자격', r'분양가', r'대출', r'사업 ?기간', r'세금', r'5가지|다섯 ?가지'],
    8: [r'분담금', r'마련', r'기다릴', r'추천'],
}
scenes = [int(a) for a in sys.argv[1:]] or sorted(KEYS)
cb = Chatterbox('ref/ref24k.wav')
asr = WhisperModel('small', device='cpu', compute_type='int8')
man = json.load(open('voice/manifest.json', encoding='utf-8'))

def score(x, keys):
    segs, _ = asr.transcribe(resample_poly(x, 2, 3).astype(np.float32), language='ko', beam_size=5)
    txt = ' '.join(s.text.strip() for s in segs)
    return sum(bool(re.search(k, txt)) for k in keys), txt

for sc in scenes:
    keys = KEYS[sc]
    best = None
    for k, (temp, seed) in enumerate([(0.0, 0), (0.6, 11), (0.7, 23), (0.7, 37), (0.8, 51), (0.6, 67)]):
        x, ended, _ = cb.synth(READ[sc - 1], temp=temp, seed=seed)
        if not ended:
            continue
        x = trim(x, SR); x = x / (np.max(np.abs(x)) or 1) * 0.9
        s, txt = score(x, keys)
        print(f'scene {sc} cand {k} (T={temp}): {s}/{len(keys)} | {txt}', flush=True)
        if best is None or s > best[0]:
            best = (s, x, txt)
        if s == len(keys):
            break
    s, x, txt = best
    with wave.open(f'voice/scene_{sc:02d}.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
    b = chunk_bounds(x, SR, render2.SCRIPT[sc - 1])
    man['scenes'][sc - 1].update({'dur': round(x.size / SR, 3), 'chunks': [[round(a, 3), round(c, 3)] for a, c in b]})
    print(f'==> scene {sc}: 선택 {s}/{len(keys)} | {txt}', flush=True)
json.dump(man, open('voice/manifest.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
