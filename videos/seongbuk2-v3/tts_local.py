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
    '안녕하세요! 쌤태리부동산컨설팅이에요. 서울 도심에서 새집을 오억으로 시작할 수 있을까요?',
    '오늘 소개할 매물은 성북 이구역 무허가주택이에요. 땅은 이 점 사 이 평이지만, 사는 건 새집을 받을 권리예요.',
    '분양가 십오억으로 가정하면 총투자금은 약 십구억 육천만 원이에요. 그래서 프리미엄 사억 육천만 원이 적정한지가 핵심이에요.',
    '최근 실거래 열 건은 모두 오억 이천만 원 이상이었어요. 지역 집값은 올랐는데, 이 일대는 아직 제자리예요.',
    '추천 포인트 첫째! 구역 전체가 전면 철거형으로 바뀌어서, 사백구십육 세대 공동주택으로 사업이 하나로 정리됐어요.',
    '둘째! 결합 상대인 신월곡 일구역은, 최고 사십칠 층, 약 이천이백 세대 규모로 이주가 마무리 단계예요.',
    '다만 계약 전에는 분양자격, 분양가, 대출, 사업 기간, 세금. 이 다섯 가지는 꼭 확인하셔야 해요.',
    '성북동에 실거주 계획이 있고, 분담금을 나눠 마련하며, 기다릴 수 있는 분께 추천드려요.',
    '분양자격 확인이 먼저예요! 궁금한 점은 언제든 편하게 물어보세요.',
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
