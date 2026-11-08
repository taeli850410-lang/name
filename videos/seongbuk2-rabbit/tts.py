#!/usr/bin/env python3
"""Gemini TTS로 장면별 여자 목소리 내레이션을 만든다 → voice/scene_XX.wav + voice/manifest.json

API 키는 환경 설정의 Network secrets(헤더 x-goog-api-key)로 프록시가 넣어 준다. 이 스크립트는 키를 다루지 않는다.
  python3 tts.py            # 전체
  TTS_VOICE=Zephyr python3 tts.py 3   # 3번 장면만, 다른 목소리로
"""
import base64
import json
import os
import subprocess
import sys
import time
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
API = 'https://generativelanguage.googleapis.com/v1beta'
VOICE = os.environ.get('TTS_VOICE', 'Kore')
STYLE = ('방송 뉴스의 여성 아나운서처럼 신뢰감 있고 차분한 톤으로, 표준어 발음을 또렷하게 지키며 '
         '적당히 빠른 속도로 읽어 주세요. 숫자는 자연스러운 한국어로 읽고, 쉼표와 마침표에서는 짧게 쉬어 주세요:')
VOICE_DIR = os.path.join(HERE, 'voice')


def call(method, path, body=None):
    cmd = ['curl', '-sS', '-m', '180', '-X', method, f'{API}/{path}', '-H', 'Content-Type: application/json',
           '-w', '\n%{http_code}']
    if body is not None:
        cmd += ['--data-binary', '@-']
    r = subprocess.run(cmd, input=json.dumps(body).encode() if body is not None else None, capture_output=True)
    out = r.stdout.decode('utf-8', 'replace')
    txt, _, code = out.rpartition('\n')
    return int(code or 0), txt


def pick_model():
    code, txt = call('GET', 'models?pageSize=200')
    if code != 200:
        raise SystemExit(f'모델 목록 조회 실패 (HTTP {code}): {txt[:300]}')
    names = [m['name'].split('/')[-1] for m in json.loads(txt).get('models', [])
             if 'tts' in m['name'] and 'generateContent' in m.get('supportedGenerationMethods', [])]
    if not names:
        raise SystemExit('TTS 모델이 없습니다: ' + ', '.join(names))
    pref = sorted(names, key=lambda n: (('pro' not in n), ('preview' in n), n))
    return os.environ.get('TTS_MODEL', pref[0]), names


def synth(model, text):
    body = {'contents': [{'parts': [{'text': f'{STYLE} {text}'}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICE}}}}}
    for attempt in range(5):
        code, txt = call('POST', f'models/{model}:generateContent', body)
        if code == 200:
            d = json.loads(txt)
            part = d['candidates'][0]['content']['parts'][0]['inlineData']
            rate = 24000
            for kv in part.get('mimeType', '').split(';'):
                if kv.strip().startswith('rate='):
                    rate = int(kv.split('=')[1])
            pcm = np.frombuffer(base64.b64decode(part['data']), '<i2').astype(np.float64) / 32768
            return pcm, rate
        if code in (429, 500, 503) and attempt < 4:
            time.sleep(2 ** (attempt + 1) * 2)
            continue
        raise SystemExit(f'TTS 실패 (HTTP {code}): {txt[:400]}')


def frame_rms(x, sr, hop=0.01):
    n = int(sr * hop)
    k = x.size // n
    return np.sqrt(np.mean(x[:k * n].reshape(k, n) ** 2, axis=1)), n


def trim(x, sr, thr_db=-45, margin=0.04):
    r, n = frame_rms(x, sr)
    on = np.where(r > 10 ** (thr_db / 20))[0]
    if on.size == 0:
        return x
    a = max(0, on[0] * n - int(margin * sr))
    b = min(x.size, (on[-1] + 1) * n + int(margin * sr))
    return x[a:b]


def chunk_bounds(x, sr, chunks):
    """문장 사이 쉼(120ms 이상)을 찾아 말풍선 경계로 쓴다. 쉼이 모자라면 글자 수 비율로 나눈다."""
    dur = x.size / sr
    if len(chunks) == 1:
        return [(0.0, dur)]
    r, n = frame_rms(x, sr)
    sil = r < 10 ** (-40 / 20)
    gaps, i = [], 0
    while i < sil.size:
        if sil[i]:
            j = i
            while j < sil.size and sil[j]:
                j += 1
            if (j - i) * 0.01 >= 0.12:
                gaps.append(((i + j) / 2) * 0.01)
            i = j
        else:
            i += 1
    lens = [len(c.replace('\n', '').replace(' ', '')) for c in chunks]
    tot = sum(lens)
    cuts, acc, used = [], 0, set()
    for L in lens[:-1]:
        acc += L
        exp = dur * acc / tot
        cand = [g for g in gaps if g not in used and abs(g - exp) < dur * 0.22 and (not cuts or g > cuts[-1])]
        g = min(cand, key=lambda g: abs(g - exp)) if cand else exp
        used.add(g)
        cuts.append(g)
    edges = [0.0] + cuts + [dur]
    return [(edges[k], edges[k + 1]) for k in range(len(chunks))]


def main():
    sys.path.insert(0, HERE)
    import render2
    os.makedirs(VOICE_DIR, exist_ok=True)
    model, names = pick_model()
    print('TTS 모델:', model, '| 사용 가능:', ', '.join(names), '| 목소리:', VOICE)
    only = [int(a) - 1 for a in sys.argv[1:]]
    mp = os.path.join(VOICE_DIR, 'manifest.json')
    man = json.load(open(mp, encoding='utf-8')) if os.path.exists(mp) else {'scenes': [None] * len(render2.SCRIPT)}
    for i, chunks in enumerate(render2.SCRIPT):
        if only and i not in only:
            continue
        text = render2.narration_text(i)
        pcm, sr = synth(model, text)
        pcm = trim(pcm, sr)
        fn = f'scene_{i + 1:02d}.wav'
        with wave.open(os.path.join(VOICE_DIR, fn), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes((np.clip(pcm, -1, 1) * 32767).astype('<i2').tobytes())
        bounds = chunk_bounds(pcm, sr, chunks)
        man['scenes'][i] = {'file': fn, 'dur': round(pcm.size / sr, 3), 'chunks': [[round(a, 3), round(b, 3)] for a, b in bounds]}
        print(f'scene {i + 1}: {pcm.size / sr:5.2f}s  chunks {man["scenes"][i]["chunks"]}  | {text}')
    man.update({'model': model, 'voice': VOICE})
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
