# 성북2구역 재개발 추천 v3 — 첨부 음성 복제 내레이션 (9:16, 63초)

v2(토끼 캐릭터)에서 캐릭터를 빼고, 자막은 뉴스 자막 스타일 상자로 바꿨습니다.
내레이션은 사용자가 보낸 음성 샘플(`ref/reference_voice.mp3`)의 목소리를 복제해 새로 읽힌 것입니다.

| 파일 | 내용 |
|---|---|
| `seongbuk2_v3_voice.mp4` / `.srt` | 완성 영상 (1080×1920, 30fps, 63.6초, -16.7 LUFS) / 자막 |
| `tts_chatterbox.py` | Chatterbox Multilingual ONNX(Resemble AI, MIT)로 기준 음성 복제 → `voice/` |
| `regen_best.py` | 잘못 들린 장면을 여러 번 다시 만들고, Whisper 받아쓰기로 핵심 단어(숫자 포함)가 모두 맞는 후보를 고름 |
| `asr_check.py` | 장면별 음성 받아쓰기 확인 |
| `render2.py` 외 | v2 렌더러 (`SHOW_RABBIT=1`이면 토끼 버전). 사진은 `../seongbuk2-rabbit/assets`를 사용 |

## 음성

- 기준 음성: 첨부 파일 앞 9.7초. 복제 결과의 음높이 약 170Hz (기준 175Hz).
- 숫자는 한글로 풀어 쓴 낭독용 대본(`tts_local.READ`) 사용.
- 받아쓰기 확인: 19억 6천만 원·4억 6천만 원·47층·2,200세대 등 숫자 모두 정확.
  "무허가"는 ㅎ이 약해진 자연 발음("무어가")으로 인식됨.
- AI 생성 음성이므로 영상에 'AI 음성'을 표시했습니다.

## 배경음악

직접 합성한 오리지널 곡(`music.py`, `music2.py`). v2보다 6dB 키워 목소리 없는 구간 약 -24 dBFS,
목소리가 나올 때는 7dB 낮춰 목소리보다 약 9dB 아래로 깔립니다.

## 만들기

```bash
pip install numpy scipy pillow onnxruntime tokenizers faster-whisper supertonic==1.3.1
# 모델: huggingface.co/onnx-community/chatterbox-multilingual-ONNX → /root/cbx/model (MODEL_DIR)
python3 tts_chatterbox.py ref/reference_voice.mp3   # 전체 장면 음성
python3 regen_best.py 3 6                          # 잘못 들린 장면만 다시
python3 render2.py mix out && python3 render2.py render out
```
