# 신용산역 북측1구역 근생 — 쇼츠 (64초)

블로그 글 「[신용산역 북측1구역 근생] 조합 추산서로 따져본 아파트 자격」(blog.naver.com/christy0410/224470889461)을
64초 세로 영상(1080×1920, 30fps)으로 옮긴 [HyperFrames](https://github.com/heygen-com/hyperframes) 프로젝트입니다.

- 길이: 내레이션 약 55초 + 끝 화면(중개사무소·매물 표시) 약 8초 = 64초. 처음엔 60초였으나 끝 화면을 오래 보여 달라는 요청으로 늘렸습니다
- 스타일: 키네틱 타이포그래피 + 하드컷 플래시. 장면 10개, 컷마다 4프레임 플래시(초당 3회를 넘지 않음)
- 내레이션: 의뢰인 본인 목소리 10초를 참고해 Chatterbox Multilingual(MIT)로 합성한 "또렷한 아나운서" 톤.
  **AI 합성 음성**이며 끝 화면 고지에 그렇게 적습니다(오른쪽 위 "AI 음성" 꼬리표는 의뢰인 요청으로 뺐습니다). 참고 녹음은 개인 음성이라 저장소에 넣지 않습니다
- 자막과 화면 등장 시각: 완성된 음성을 Whisper 로 다시 읽어 얻은 단어별 시각에서 계산합니다
- 배경음악: `tools/bgm.py` 가 코드로 작곡·합성합니다(외부 음원·생성 모델 없음). 장면 5의 판정과 끝 화면 컷에 마디를 맞추고,
  내레이션이 나오는 동안은 낮춥니다
- 끝 화면: 의뢰인 명함의 중개사무소 표시 사항(`office.json`) + 매물 표시 사항 + 추산서 고지
- 숫자: 블로그 본문(조합 추산서 · 국토교통부 실거래 공개자료)에 있는 것만 씁니다

## 파일

| 파일 | 역할 |
|---|---|
| `narration.json` | 대본. `say` 는 TTS 가 읽는 문장(숫자를 한글로 풀어 씀), `cap` 은 자막, `seed` 는 고른 합성 회차, `settings` 는 톤 설정 |
| `tools/voice_chatterbox.py` | 줄마다 3번 합성 → Whisper 로 숫자·문장 확인, 본인 목소리와 가장 닮은 것 선택 → 문장 끝 군소리 제거 → 이어 붙여 방송용 처리 → `assets/voice/narration.wav` + `timing.json`(단어별 시각) |
| `tools/master_voice.sh` | 방송용 음성 처리: 저역 잡음·웅웅거림 제거, 명료도, 치찰음, 압축, 템포, −16 LUFS |
| `tools/bgm.py` | 배경음악 작곡·합성 → `assets/bgm/bgm.mp3` (numpy, scipy, ffmpeg). 박자를 `timing.json` 의 두 순간에 맞추고 내레이션 자리를 덕킹 |
| `office.json` | 끝 화면 중개사무소 표시 사항(명칭·소재지·연락처·등록번호·대표 공인중개사·소속 공인중개사) |
| `tools/build.py` | `timing.json` → 장면 컷, 자막, 플래시, 효과음, 배경음악, `index.html`. `tools/scenes/` 템플릿에 "그 단어를 말하는 순간"을 채워 `compositions/` 에 쓴다 |
| `tools/scenes/s01~s10.html` | 장면 템플릿(손으로 쓴 키네틱 타이포). 이중 중괄호 자리가 시각 |
| `compositions/` | 생성물. 직접 고치지 말고 템플릿을 고친다 |
| `assets/kit.js` | 장면 공용 움직임 — 착지(slam), 흔들림, 단어 블러 인, 숫자 오도미터 |
| `assets/fonts/` | Pretendard (SIL OFL 1.1) |
| `assets/sfx/` | HyperFrames 에 들어 있는 효과음 (Pixabay Content License, `CREDITS.md`) |
| `assets/vendor/gsap.min.js` | GSAP 3.15.0 (GreenSock Standard License) |
| `renders/` | 렌더 결과 |

## 다시 만들기

```bash
# 1) 목소리 — chatterbox-tts, faster-whisper 가 설치된 Python. 모델은 HuggingFace 에서 받는다
python tools/voice_chatterbox.py --ref <참고 목소리 10초.wav> --heldout <같은 사람 다른 녹음.wav>

# 2) 배경음악 — 목소리를 바꿨으면 다시 (박자·덕킹이 내레이션 시각을 따른다)
python tools/bgm.py

# 3) 장면·자막·효과음을 새 시각으로
python3 tools/build.py

# 4) 검사와 렌더
npx hyperframes@0.9.26 check
npx hyperframes@0.9.26 render -o renders/sinyongsan-north1-shorts.mp4
```

대본을 고쳐도 시각은 손으로 맞추지 않습니다. `build.py` 가 각 장면의 "이 단어에서 등장" 지점을
`timing.json` 의 단어 시각으로 다시 계산합니다. 단, 템플릿이 찾는 단어(예: `T("l01", "3.8평")`)가
자막에서 빠지면 빌드가 멈추므로 `build.py` 의 해당 줄도 같이 고칩니다.

## 바뀔 수 있는 숫자

종전자산 평가액·비례율·권리가액·분담금은 조합 추산서의 예시 금액이고 관리처분계획 수립·인가 과정에서 바뀔 수 있습니다.
영상의 판정·시점·끝 화면에 이 고지를 넣었습니다.
