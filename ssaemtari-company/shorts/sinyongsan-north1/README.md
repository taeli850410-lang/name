# 신용산역 북측1구역 근생 — 60초 쇼츠

블로그 글 「[신용산역 북측1구역 근생] 조합 추산서로 따져본 아파트 자격」(blog.naver.com/christy0410/224470889461)을
60초 세로 영상(1080×1920, 30fps)으로 옮긴 [HyperFrames](https://github.com/heygen-com/hyperframes) 프로젝트입니다.

- 스타일: 키네틱 타이포그래피 + 하드컷 플래시. 장면 10개, 컷마다 4프레임 플래시(초당 3회를 넘지 않음)
- 내레이션: Supertonic-3 여성 목소리 F4, 한국어. **AI 합성 음성**이며 영상 안에 그렇게 표시합니다
- 자막: 절마다 따로 합성해 이어 붙였으므로 자막 시각이 말과 정확히 맞습니다
- 숫자: 블로그 본문(조합 추산서 · 국토교통부 실거래 공개자료)에 있는 것만 씁니다

## 파일

| 파일 | 역할 |
|---|---|
| `narration.json` | 대본. `say` 는 TTS 가 읽는 문장(숫자를 한글로 풀어 씀), `cap` 은 자막, `seed` 는 TTS 잡음 고정값 |
| `tools/pick_seeds.py` | 절마다 TTS 시드를 바꿔 가며 Whisper 로 되읽어, 숫자가 자막과 똑같이 들리는 시드를 고른다 |
| `tools/synth_voice.py` | 대본 → `assets/voice/narration.wav` + `timing.json`(모든 절의 시작·끝 시각) |
| `tools/build.py` | `timing.json` → `index.html`(장면 배치·효과음), `compositions/captions.html`, `flash.html`, `chrome.html` |
| `compositions/s01~s10.html` | 장면. 손으로 쓴 키네틱 타이포. 시각은 장면 기준 초 |
| `assets/kit.js` | 장면 공용 움직임 — 착지(slam), 흔들림, 단어 블러 인, 숫자 오도미터 |
| `assets/fonts/` | Pretendard (SIL OFL 1.1) |
| `assets/sfx/` | HyperFrames 에 들어 있는 효과음 (Pixabay Content License, `CREDITS.md`) |
| `assets/vendor/gsap.min.js` | GSAP 3.15.0 (GreenSock Standard License) |
| `renders/` | 렌더 결과 |

## 다시 만들기

```bash
# 1) 목소리 — supertonic, faster-whisper 가 설치된 Python (모델은 HuggingFace 에서 받는다)
python tools/pick_seeds.py        # 대본을 고쳤을 때만. 시드를 골라 narration.json 에 적는다
python tools/synth_voice.py       # narration.wav + timing.json

# 2) 시각에 묶인 파일 생성
python3 tools/build.py

# 3) 검사와 렌더
npx hyperframes@0.9.26 check
npx hyperframes@0.9.26 render -o renders/sinyongsan-north1-shorts.mp4
```

대본을 고치면 말소리 시각이 바뀝니다. `build.py` 는 장면 컷·자막·플래시·효과음을 새 시각에 맞추지만,
장면 안의 등장 시각(`compositions/sNN.html` 의 숫자)은 손으로 맞춰야 합니다.

## 바뀔 수 있는 숫자

종전자산 평가액·비례율·권리가액·분담금은 조합 추산서의 예시 금액이고 관리처분계획 수립·인가 과정에서 바뀔 수 있습니다.
영상의 판정·시점·끝 화면에 이 고지를 넣었습니다.
