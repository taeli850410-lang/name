# 성북2구역 재개발 추천 v3 — 첨부 음성 복제 내레이션 (9:16, 80초)

v2(토끼 캐릭터)에서 캐릭터를 빼고, 자막은 뉴스 자막 스타일 상자로 바꿨습니다. 자막 위 ON AIR·AI 음성 표시는 뺐습니다(`SHOW_ONAIR=1`이면 다시 표시).
내레이션은 사용자가 보낸 음성 샘플(현재: `ref/reference_voice.mp3` — 처음 보낸 목소리, 이전에 시험: `reference_voice2.wav`, `reference_voice3.mp3`)의 목소리를 복제해 새로 읽힌 것입니다.

| 파일 | 내용 |
|---|---|
| `seongbuk2_v3_voice.mp4` / `.srt` | 완성 영상 (1080×1920, 30fps, 79.5초, 마지막 7초 중개사 정보 화면) / 자막 |
| `gen_vc.py`, `vc.py` | **사용 중** — 한국어 원어민 발음·억양(Supertonic-3 F5)으로 읽은 뒤 Chatterbox S3Gen 음성 변환으로 기준 목소리 음색만 입힘 (외국인 억양 개선) |
| `endcard.py` | 마지막 중개사 정보 화면 (남색·금색 명함 스타일, 매물 정보 없음) |
| `gen_voice.py` | 전체 장면을 기준 음성으로 만들고, 장면마다 받아쓰기로 핵심 단어·숫자가 맞는 후보를 자동 선택 |
| `tts_chatterbox.py` | Chatterbox Multilingual ONNX(Resemble AI, MIT)로 기준 음성 복제 → `voice/` |
| `regen_best.py` | 잘못 들린 장면을 여러 번 다시 만들고, Whisper 받아쓰기로 핵심 단어(숫자 포함)가 모두 맞는 후보를 고름 |
| `asr_check.py` | 장면별 음성 받아쓰기 확인 |
| `render2.py` 외 | v2 렌더러 (`SHOW_RABBIT=1`이면 토끼 버전). 사진은 `../seongbuk2-rabbit/assets`를 사용 |

## 음성

- 기준 음성: `ref/reference_voice.mp3` 앞 9.7초(세 문장).
- 방식: Supertonic-3로 한국어를 자연스럽게 읽고(속도 1.2, 원본 음높이 ×1.06) → 기준 목소리로 음색 변환. 기준 목소리와의 화자 유사도 0.908 (Chatterbox 직접 생성 0.897), 음높이 141~158Hz. 2번 장면만 원본을 F3(음높이 ×0.86)로 — F5 변환 시 "권리"가 "관리"로 들려서.
- 말투: "안녕하세요, 쌤태리부동산컨설팅입니다."로 시작해 "~입니다/~습니다"로 끝나는 자연스러운 존댓말 (화면 자막 `render2.SCRIPT`, 낭독 `tts_local.READ`).
  표현력(exaggeration) 0.7, 결정적 생성 대신 샘플링(SAMPLE=1)으로 억양을 자연스럽게. 대지 면적은 말로는 "두 평 남짓", 화면에는 정확한 "2.42평".
- 속도: 초당 약 6.3음절 (이전 버전과 비슷한 원래 속도). 빠르게 하려면 `TARGET=7.0 python3 speedup.py`.
- 화면의 '예시' 표시·안내 문구는 모두 없음 (5번 현수막 사진의 '성북2구역 현장' 설명만 표시).
- 마지막 정보 화면: (주)센추리21코리아 · 이태리 공인중개사 · 연락처 · 주소 · 등록번호 · 안내 문구 · 블로그 (사용자 명함 이미지 기준). `END_CARD=0`이면 없음.
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
REF=ref/ref24k.wav python3 gen_vc.py                                   # 전체 장면: 한국어 음성 → 음색 변환 (받아쓰기 검증 포함)
SRC_VOICE=F3 PITCH=0.86 REF=ref/ref24k.wav python3 gen_vc.py 2         # 2번만 F3 원본으로
SAMPLE=1 EXAG=0.7 REF=ref/ref24k.wav REF_DUR=9.7 python3 gen_voice.py     # (이전 방식) Chatterbox 직접 생성
SAMPLE=1 EXAG=0.7 REF=ref/ref24k.wav REF_DUR=9.7 python3 gen_voice.py 4 8  # 일부 장면만 다시
python3 render2.py mix out && python3 render2.py render out
```
