# 성북2구역 재개발 추천 v2 — 토끼 캐릭터 소개 영상 (9:16, 여자 목소리)

토끼 캐릭터가 왼쪽 아래에서 앵커처럼 말하고(목소리 크기에 맞춰 고개·몸이 움직임, 입은 원본 그대로), 말풍선 자막으로 내용을 전하는 숏폼입니다.
장면 길이는 내레이션 길이에 맞춰 자동으로 정해집니다.

| 파일 | 내용 |
|---|---|
| `render2.py` | v2 렌더러 (사진 Ken Burns·마스크 리빌·스쿼시&스트레치 전환, 토끼 앵커, 말풍선) |
| `render.py` | v1 효과 라이브러리 (스냅·카운터·라인 마스크 등) |
| `bg2.py` | 배경: 흐르는 오로라 그라데이션, 필름 그레인, 설계도 격자, 성북동 라인아트 풍경(능선·계단식 저층 단지·주택), 장면 번호 고스트 숫자, ON AIR 표시 |
| `tts.py` | Gemini TTS로 장면별 여자 목소리 생성 → `voice/` |
| `music.py`, `music2.py` | 직접 합성한 오리지널 배경음악 (외부 음원 없음), 영상 길이에 맞춰 편곡 |
| `assets/` | 사용자가 보낸 사진·영상, 토끼 배경 제거본 |

## 사진 선택 기준

- 사용: 지도, 골목 사진, 현수막, 초록색 정비방식 비교표, 조감도 이미지, 조감도 드론 영상, 토끼 캐릭터 시트(클로즈업 컷)
- 제외: 파란 고층 투시도, 고층 아파트로 그린 첫 비교 그림 — 계획(최고 4층·용적률 90%)과 달라 오해 소지
- AI로 만든 이미지·영상에는 "예시 이미지/그림" 라벨 표시

## 만들기

글꼴(Pretendard)은 `fonts/`에 둡니다 (`../seongbuk2-redevelopment/README.md` 참고).
Gemini API 키는 클라우드 환경의 Network secrets에 `generativelanguage.googleapis.com` / 헤더 `x-goog-api-key`로 넣습니다.

```bash
pip install numpy scipy pillow
python3 tts.py                      # 아나운서 톤 여자 목소리(Kore) 내레이션 생성 (voice/manifest.json)
python3 render2.py mix out          # 목소리 배치 + 배경음악(목소리 아래로 낮춤) → out/mix.wav
python3 render2.py render out       # 영상 렌더 + 합치기 → out/seongbuk2_rabbit.mp4, .srt
```
