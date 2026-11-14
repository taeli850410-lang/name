# 성북2구역 재개발 추천 v3 — 첨부 음성 복제 내레이션 (9:16, 70초)

v2(토끼 캐릭터)에서 캐릭터를 빼고, 자막은 뉴스 자막 스타일 상자로 바꿨습니다. 자막 위 ON AIR·AI 음성 표시는 뺐습니다(`SHOW_ONAIR=1`이면 다시 표시).
내레이션은 사용자가 보낸 음성 샘플(현재: `ref/reference_voice.mp3` — 처음 보낸 목소리, 이전에 시험: `reference_voice2.wav`, `reference_voice3.mp3`)의 목소리를 복제해 새로 읽힌 것입니다.

| 파일 | 내용 |
|---|---|
| `seongbuk2_v3_voice.mp4` / `.srt` | 완성 영상 (1080×1920, 30fps, 70.4초) / 자막 |
| `gen_voice.py` | 전체 장면을 기준 음성으로 만들고, 장면마다 받아쓰기로 핵심 단어·숫자가 맞는 후보를 자동 선택 |
| `tts_chatterbox.py` | Chatterbox Multilingual ONNX(Resemble AI, MIT)로 기준 음성 복제 → `voice/` |
| `regen_best.py` | 잘못 들린 장면을 여러 번 다시 만들고, Whisper 받아쓰기로 핵심 단어(숫자 포함)가 모두 맞는 후보를 고름 |
| `asr_check.py` | 장면별 음성 받아쓰기 확인 |
| `render2.py` 외 | v2 렌더러 (`SHOW_RABBIT=1`이면 토끼 버전). 사진은 `../seongbuk2-rabbit/assets`를 사용 |

## 음성

- 기준 음성: `ref/reference_voice.mp3` 앞 9.7초(세 문장). 생성 음성 평균 음높이 약 166Hz (기준 파일 약 152Hz).
- 말투: "안녕하세요, 쌤태리부동산컨설팅입니다."로 시작해 "~입니다/~습니다"로 끝나는 자연스러운 존댓말 (화면 자막 `render2.SCRIPT`, 낭독 `tts_local.READ`).
  표현력(exaggeration) 0.7, 결정적 생성 대신 샘플링(SAMPLE=1)으로 억양을 자연스럽게. 대지 면적은 말로는 "두 평 남짓", 화면에는 정확한 "2.42평".
- 속도: 목소리 원래 속도(초당 약 6.4음절). 빠르게 하려면 `TARGET=7.0 python3 speedup.py`.
- 화면의 '예시' 표시·안내 문구는 모두 없음 (5번 현수막 사진의 '성북2구역 현장' 설명만 표시).
- 숫자는 한글로 풀어 쓴 낭독용 대본(`tts_local.READ`) 사용.
- 받아쓰기 확인: 19억 6천만 원·4억 6천만 원·47층·2,200세대 등 숫자 모두 정확.
  "무허가"는 ㅎ이 약해진 자연 발음("무어가")으로 인식됨.

## 배경음악

직접 합성한 오리지널 곡(`music.py`, `music2.py`). v2보다 6dB 키워 목소리 없는 구간 약 -24 dBFS,
목소리가 나올 때는 7dB 낮춰 목소리보다 약 9dB 아래로 깔립니다.

## 만들기

```bash
pip install numpy scipy pillow onnxruntime tokenizers faster-whisper supertonic==1.3.1
# 모델: huggingface.co/onnx-community/chatterbox-multilingual-ONNX → /root/cbx/model (MODEL_DIR)
ffmpeg -i ref/reference_voice.mp3 -ac 1 -ar 24000 -c:a pcm_s16le ref/ref24k.wav
SAMPLE=1 EXAG=0.7 REF=ref/ref24k.wav REF_DUR=9.7 python3 gen_voice.py     # 전체 장면 (받아쓰기 검증 포함)
SAMPLE=1 EXAG=0.7 REF=ref/ref24k.wav REF_DUR=9.7 python3 gen_voice.py 4 8  # 일부 장면만 다시
python3 render2.py mix out && python3 render2.py render out
```
