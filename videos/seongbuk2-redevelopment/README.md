# 성북2구역 재개발 추천 — 60초 숏폼 (9:16)

- `seongbuk2_redevelopment_60s.mp4` — 1080×1920, 30fps, H.264, 60초, 자막 포함(화면에 입힘), 배경음악 포함(AAC, -16 LUFS)
- `seongbuk2_redevelopment_60s.srt` — 업로드용 별도 자막 파일
- `bgm_seongbuk2_60s.m4a` — 배경음악만 따로 (60초)
- `render.py` — 영상 생성 스크립트 (Python PIL + ffmpeg)
- `music.py` — 배경음악 생성 스크립트 (numpy + scipy)

## 배경음악 저작권

`music.py`가 코드로 직접 합성한 오리지널 곡입니다(D장조, 120BPM). 외부 음원·샘플·루프를 쓰지 않았으므로
제3자 저작권이 걸려 있지 않습니다. 장면 전환이 모두 정수 초라 박(0.5초)에 맞고, 4초 드롭(2번 장면),
44–48초 브레이크(주의사항), 50초 피날레(이런 분께 추천), 56.5초 임팩트('재개발 추천' 도장 착지)에 맞춰 편곡했습니다.

원문: 쌤태리부동산컨설팅 블로그 「성북2구역 전면 철거 전환 후 5억 매물, 실거래 10건으로 본 가격 위치」(2026.10.11)

## 다시 만들기

글꼴(Pretendard, SIL OFL)은 저장소에 넣지 않았습니다. `fonts/` 폴더에 받아 둔 뒤 실행합니다.

```bash
npm pack pretendard@1.3.9 && tar xzf pretendard-1.3.9.tgz
mkdir -p fonts && cp package/dist/public/static/Pretendard-{Medium,Bold,ExtraBold}.otf fonts/
pip install numpy scipy pillow
python3 music.py music.wav           # 배경음악 생성 (render가 있으면 자동으로 합침)
python3 render.py stills stills      # 장면별 정지 화면 확인
python3 render.py render out         # 전체 렌더 + 합치기 + SRT
python3 render.py render out 5 11    # 5번·11번 장면만 다시 렌더 후 합치기
```
