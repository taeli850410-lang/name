#!/usr/bin/env python3
"""Supertonic-3(오픈 가중치, OpenRAIL)로 장면별 여성 아나운서 내레이션을 만든다 → voice/scene_XX.wav + manifest.json

라이선스 조건: 생성 음성을 쓰는 콘텐츠에는 'AI(기계) 생성'임을 알기 쉽게 표시해야 한다 → 영상에 'AI 음성' 표기.
숫자는 오독을 막기 위해 한글로 풀어 쓴 낭독용 대본을 쓴다(화면 자막은 render2.SCRIPT 그대로).
  python3 tts_local.py              # 전체 (기본 목소리 F1)
  VOICE=F3 python3 tts_local.py 2   # 2번 장면만 다른 목소리로
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tts import chunk_bounds, trim  # noqa: E402  (쉼 찾기·앞뒤 무음 자르기 재사용)

VOICE = os.environ.get('VOICE', 'F1')
SPEED = float(os.environ.get('SPEED', '1.12'))
SILENCE = float(os.environ.get('SILENCE', '0.2'))
STEPS = int(os.environ.get('STEPS', '16'))
VOICE_DIR = os.path.join(HERE, 'voice')

READ = [
    '서울 사대문 바로 위, 성북동에 새 주거단지가 들어섭니다.',
    '한양도성 성곽길까지 걸어서 십일 분, 광화문까지는 대중교통으로 이십칠 분. 대사관저가 모여 있는 성북동입니다.',
    '오래된 골목이, 숲과 성곽을 품은 새 단지로 바뀝니다.',
    '구역 전체가 전면 철거형으로 바뀌었고, 이천이십육 년 삼월, 공동주택 사백구십육 세대 계획이 고시됐습니다.',
    '최고 사 층의 저층 단지라, 도심에서는 보기 드문 주거 형태입니다.',
    '결합 상대인 신월곡 일구역은, 최고 사십칠 층, 약 이천이백 세대 규모로, 이주가 막바지에 있습니다.',
    '그렇다면 지금 들어가려면 얼마가 필요할까요? 매물 가격과 분담금, 분양자격까지 일대일로 알려드립니다.',
    '궁금하신 분은 지금 바로 연락 주세요.',
]


def main():
    import wave
    from supertonic import TTS
    import render2
    assert len(READ) == len(render2.SCRIPT)
    os.makedirs(VOICE_DIR, exist_ok=True)
    tts = TTS(model='supertonic-3')
    style = tts.get_voice_style(VOICE)
    sr = getattr(tts, 'sample_rate', 44100)
    only = [int(a) - 1 for a in sys.argv[1:]]
    mp = os.path.join(VOICE_DIR, 'manifest.json')
    man = json.load(open(mp, encoding='utf-8')) if (only and os.path.exists(mp)) else {'scenes': [None] * len(READ)}
    for i, text in enumerate(READ):
        if only and i not in only:
            continue
        wav, _ = tts.synthesize(text, voice_style=style, lang='ko', total_steps=STEPS, speed=SPEED,
                                 silence_duration=SILENCE)
        x = trim(np.asarray(wav, dtype=np.float64).reshape(-1), sr)
        peak = np.max(np.abs(x)) or 1.0
        x = x / peak * 0.9
        fn = f'scene_{i + 1:02d}.wav'
        with wave.open(os.path.join(VOICE_DIR, fn), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
        bounds = chunk_bounds(x, sr, render2.SCRIPT[i])
        man['scenes'][i] = {'file': fn, 'dur': round(x.size / sr, 3), 'chunks': [[round(a, 3), round(b, 3)] for a, b in bounds]}
        print(f'scene {i + 1}: {x.size / sr:5.2f}s  chunks {man["scenes"][i]["chunks"]}')
    man.update({'engine': 'Supertonic-3 (Supertone, OpenRAIL)', 'voice': VOICE, 'speed': SPEED, 'steps': STEPS, 'silence': SILENCE})
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
