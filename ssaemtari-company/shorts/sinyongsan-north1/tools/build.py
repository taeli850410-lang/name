"""timing.json -> index.html, compositions/captions.html, flash.html, chrome.html.

장면(compositions/s01~s10.html)은 손으로 쓴다. 이 스크립트는 말소리 시각에
묶이는 것만 만든다 — 장면 컷 시각, 자막, 컷마다 터지는 플래시, 효과음 배치.

  python3 tools/build.py
"""

import html
import json
import os
import re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, TOTAL = 1080, 1920, 60.0
FRAME = 1 / 30

timing = json.load(open(os.path.join(HERE, "timing.json"), encoding="utf-8"))
L = {line["id"]: line for line in timing["lines"]}

# 장면은 그 장면의 첫 말소리보다 0.1 s 먼저 컷된다 (그림이 말을 살짝 앞선다).
SCENE_FIRST_LINE = [("s01", None), ("s02", "l02"), ("s03", "l03"), ("s04", "l05"), ("s05", "l06"),
                    ("s06", "l07"), ("s07", "l08"), ("s08", "l10"), ("s09", "l11"), ("s10", "l12")]
starts = [0.0 if lid is None else round(L[lid]["start"] - 0.1, 3) for _, lid in SCENE_FIRST_LINE]
scenes = []
for i, (sid, _) in enumerate(SCENE_FIRST_LINE):
    end = starts[i + 1] if i + 1 < len(starts) else TOTAL
    scenes.append((sid, starts[i], round(end - starts[i], 3)))
S = {sid: start for sid, start, _ in scenes}

# 하드컷 플래시: (절대 시각, 색). 장면 사이 컷 + 장면 안의 샷 컷(장면 기준 시각).
INNER_CUTS = {"s01": [(1.52, "#ffffff"), (3.26, "#ffd400")], "s02": [(1.62, "#ffffff")], "s07": [(5.39, "#ffd400")],
              "s08": [(3.13, "#ffffff")], "s09": [(3.2, "#ffffff")], "s10": [(3.25, "#ffffff")]}
SCENE_FLASH = {"s02": "#ffffff", "s03": "#ffd400", "s04": "#ffffff", "s05": "#ffd400", "s06": "#ffffff",
               "s07": "#ffffff", "s08": "#ffffff", "s09": "#ffd400", "s10": "#ffd400"}
flashes = [(S[sid], color) for sid, color in SCENE_FLASH.items()]
for sid, cuts in INNER_CUTS.items():
    flashes += [(round(S[sid] + t, 3), color) for t, color in cuts]
flashes.sort()

# 효과음: (파일, 장면, 장면 기준 '맞을' 시각, 볼륨, 파일 안에서 정점까지 걸리는 시간)
# 정점은 `hyperframes audio <file> --json` 으로 잰 값. 소리는 그림보다 한 프레임 늦게 맞춘다.
PEAK = {"whoosh": 0.162, "whoosh-short": 0.162, "impact-bass-1": 0.073, "impact-bass-2": 0.022,
        "pop": 0.12, "glitch-1": 0.478, "riser": 3.472}
SFX = [
    ("whoosh-short", "s01", 1.52, 0.32), ("impact-bass-1", "s01", 3.34, 0.5),
    ("glitch-1", "s02", 0.0, 0.26), ("whoosh", "s02", 1.62, 0.3),
    ("whoosh-short", "s03", 0.0, 0.3), ("riser", "s03", 6.05, 0.2), ("impact-bass-1", "s03", 6.05, 0.55),
    ("whoosh", "s04", 0.0, 0.3), ("pop", "s04", 2.9, 0.42),
    ("whoosh-short", "s05", 0.0, 0.3), ("impact-bass-1", "s05", 1.5, 0.5),
    ("whoosh", "s06", 0.0, 0.3), ("pop", "s06", 0.75, 0.38), ("pop", "s06", 4.55, 0.45),
    ("whoosh-short", "s07", 0.0, 0.3), ("whoosh", "s07", 5.39, 0.3), ("pop", "s07", 9.0, 0.42),
    ("whoosh-short", "s08", 0.0, 0.3), ("pop", "s08", 0.12, 0.34), ("pop", "s08", 1.0, 0.3), ("pop", "s08", 1.9, 0.36),
    ("whoosh", "s08", 3.13, 0.3),
    ("whoosh-short", "s09", 0.0, 0.3), ("whoosh", "s09", 3.2, 0.3),
    ("whoosh-short", "s10", 0.0, 0.3), ("impact-bass-2", "s10", 1.3, 0.5),
]


def fmt(x: float) -> str:
    return f"{x:.3f}".rstrip("0").rstrip(".")


# ------------------------------------------------------------------ 자막
def split_clause(cap: str, start: float, end: float):
    """한 절이 길면(공백 뺀 14자 초과) 가운데에 가까운 띄어쓰기에서 둘로 나눈다. 시간은 글자 수로 나눈다."""
    plain = cap.replace(" ", "")
    if len(plain) <= 14 or " " not in cap or end - start < 1.3:
        return [(cap, start, end)]
    spaces = [m.start() for m in re.finditer(" ", cap)]
    mid = len(cap) / 2
    cut = min(spaces, key=lambda s: abs(s - mid))
    a, b = cap[:cut], cap[cut + 1:]
    ta = start + (end - start) * len(a.replace(" ", "")) / len(plain)
    return [(a, start, ta), (b, ta, end)]


def highlight(text: str) -> str:
    out = []
    for tok in text.split(" "):
        esc = html.escape(tok)
        out.append(f'<span class="hl">{esc}</span>' if re.search(r"\d", tok) else esc)
    return " ".join(out)


groups = []
for line in timing["lines"]:
    for p in line["parts"]:
        groups += split_clause(p["cap"], p["start"], p["end"])
cap_items = []
for i, (text, st, en) in enumerate(groups):
    open_at = max(0.12, st - 0.04)
    nxt = groups[i + 1][1] - 0.04 if i + 1 < len(groups) else en + 0.3
    close_at = min(nxt, en + 0.35) if nxt - en < 0.45 else en + 0.12
    cap_items.append((f"cap-{i + 1:02d}", text, round(open_at, 3), round(close_at - open_at, 3)))

cap_html = "\n".join(
    f'    <div id="{cid}" class="cap clip" data-start="{fmt(st)}" data-duration="{fmt(du)}">'
    f'<span class="cap-in">{highlight(text)}</span></div>'
    for cid, text, st, du in cap_items
)
cap_js = "\n".join(
    f'      tl.fromTo("#{cid} .cap-in", {{ opacity: 0, filter: "blur(6px)" }}, '
    f'{{ opacity: 1, filter: "blur(0px)", duration: 0.12, ease: "power2.out" }}, {fmt(st)});'
    for cid, _, st, _ in cap_items
)
captions = f"""<template>
  <style>
    @font-face {{ font-family: "Pretendard"; font-weight: 800; src: url("assets/fonts/Pretendard-ExtraBold.woff2") format("woff2"); }}
    #root {{ position: absolute; inset: 0; font-family: "Pretendard", sans-serif; }}
    #root .cap {{ position: absolute; left: 70px; right: 70px; top: 1150px; text-align: center; word-break: keep-all; }}
    #root .cap-in {{ display: inline; font-size: 50px; font-weight: 800; line-height: 1.42; color: #ffffff; letter-spacing: -0.02em;
      background: #141418; padding: 8px 22px; border-radius: 14px;
      -webkit-box-decoration-break: clone; box-decoration-break: clone; }}
    #root .hl {{ color: #ffd400; }}
  </style>
  <div id="root" data-composition-id="captions" data-width="{W}" data-height="{H}">
{cap_html}
  </div>
  <script>
    (function () {{
      var tl = gsap.timeline({{ paused: true }});
{cap_js}
      window.__timelines["captions"] = tl;
    }})();
  </script>
</template>
"""

# ------------------------------------------------------------------ 플래시
flash_js = "\n".join(
    f'      tl.fromTo("#flash-sheet", {{ opacity: 0.92, backgroundColor: "{c}" }}, '
    f'{{ opacity: 0, duration: 0.13, ease: "power2.out", immediateRender: false }}, {fmt(t)});'
    for t, c in flashes
)
flash = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; pointer-events: none; }}
    #root #flash-sheet {{ position: absolute; inset: 0; background: #ffffff; opacity: 0; }}
  </style>
  <div id="root" data-composition-id="flash" data-width="{W}" data-height="{H}">
    <div id="flash-sheet" data-layout-ignore></div>
  </div>
  <script>
    (function () {{
      // 하드컷마다 한 번: 0.92 → 0, 4 프레임. 초당 3번을 넘지 않는다(광과민 기준).
      var tl = gsap.timeline({{ paused: true }});
      tl.set("#flash-sheet", {{ opacity: 0 }}, 0);
{flash_js}
      window.__timelines["flash"] = tl;
    }})();
  </script>
</template>
"""

# ------------------------------------------------------------------ 상단 꼬리표 · 진행 막대
speech_end = timing["duration"]
# 화면 아래 1/3 은 플랫폼 UI(설명·버튼)가 덮는 자리라 읽을 글자를 두지 않는다. 장면 번호만 크게 깐다.
ghost_js = "\n".join(
    f'      tl.fromTo("#ghost-{i + 1:02d} .gin", {{ y: 90, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.3, ease: "expo.out" }}, {fmt(st)});'
    for i, (sid, st, du) in enumerate(scenes)
)
ghosts = "\n".join(
    f'    <div id="ghost-{i + 1:02d}" class="ghost clip" data-start="{fmt(st)}" data-duration="{fmt(du)}" data-layout-ignore><span class="gin">{i + 1:02d}</span></div>'
    for i, (sid, st, du) in enumerate(scenes)
)
chrome = f"""<template>
  <style>
    @font-face {{ font-family: "Pretendard"; font-weight: 700; src: url("assets/fonts/Pretendard-Bold.woff2") format("woff2"); }}
    #root {{ position: absolute; inset: 0; font-family: "Pretendard", sans-serif; pointer-events: none; }}
    #root #chrome-tag {{ position: absolute; left: 56px; top: 172px; font-size: 28px; font-weight: 700; color: #ffd400;
      background: rgba(11, 11, 14, 0.9); border: 2px solid #ffd400; padding: 6px 16px; border-radius: 10px; letter-spacing: -0.01em; }}
    #root #chrome-ai {{ position: absolute; right: 56px; top: 172px; font-size: 28px; font-weight: 700; color: #f7f7f2;
      background: rgba(11, 11, 14, 0.9); border: 2px solid #6f6f78; padding: 6px 14px; border-radius: 10px; }}
    #root .ghost {{ position: absolute; left: 0; right: 0; top: 1400px; text-align: center; font-size: 400px; font-weight: 700; line-height: 1;
      color: transparent; -webkit-text-stroke: 3px rgba(150, 150, 160, 0.22); letter-spacing: -0.04em; }}
    #root .gin {{ display: inline-block; }}
    #root #chrome-bar {{ position: absolute; left: 0; right: 0; top: 1360px; height: 6px; background: rgba(255, 255, 255, 0.14); }}
    #root #chrome-fill {{ position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: #ffd400; transform-origin: 0 50%; }}
  </style>
  <div id="root" data-composition-id="chrome" data-width="{W}" data-height="{H}">
    <div id="chrome-tag">신용산역 북측1구역 · 근생 매물</div>
    <div id="chrome-ai">AI 음성</div>
{ghosts}
    <div id="chrome-bar" data-layout-ignore><div id="chrome-fill"></div></div>
  </div>
  <script>
    (function () {{
      var tl = gsap.timeline({{ paused: true }});
      tl.fromTo("#chrome-fill", {{ scaleX: 0 }}, {{ scaleX: 1, duration: {fmt(TOTAL)}, ease: "none" }}, 0);
{ghost_js}
      window.__timelines["chrome"] = tl;
    }})();
  </script>
</template>
"""

# ------------------------------------------------------------------ index.html
host = lambda cid, st, du, z, kind, track: (
    f'      <div id="{cid}" data-composition-id="{cid}" data-composition-src="compositions/{cid}.html" '
    f'data-start="{fmt(st)}" data-duration="{fmt(du)}" data-track-index="{track}" data-track-kind="{kind}" '
    f'data-width="{W}" data-height="{H}" style="z-index: {z}"></div>'
)
hosts = [host(sid, st, du, 1, "graphics", 1) for sid, st, du in scenes]
hosts.append(host("chrome", 0, TOTAL, 40, "graphics", 2))
hosts.append(host("flash", 0, TOTAL, 50, "graphics", 3))
hosts.append(host("captions", 0, TOTAL, 60, "captions", 4))

audio = [
    f'      <audio id="voice" class="clip" src="assets/voice/narration.wav" data-start="0" '
    f'data-duration="{fmt(speech_end + 0.05)}" data-track-index="5" data-volume="0.85"></audio>'
]
# 파일 길이(초). 라이저는 정점 뒤 꼬리를 잘라 임팩트에 넘긴다.
LENGTH = {"whoosh": 0.575, "whoosh-short": 0.575, "impact-bass-1": 2.116, "impact-bass-2": 2.592,
          "pop": 0.72, "glitch-1": 2.638, "riser": 3.62}
track_free = {6: 0.0, 7: 0.0, 8: 0.0, 9: 0.0}
for n, (name, sid, t, vol) in sorted(enumerate(SFX), key=lambda x: S[x[1][1]] + x[1][2] - PEAK[x[1][0]]):
    at = max(0.0, S[sid] + t - PEAK[name] + FRAME)
    dur = min(LENGTH[name], TOTAL - at)
    track = next(k for k, free in track_free.items() if free <= at)  # 겹치지 않는 트랙에 놓는다
    track_free[track] = at + dur
    fade = ' data-fade-out="0.15"' if name == "riser" else ""
    audio.append(
        f'      <audio id="sfx-{n + 1:02d}" class="clip" src="assets/sfx/{name}.mp3" data-start="{fmt(at)}" '
        f'data-duration="{fmt(dur)}" data-track-index="{track}" data-volume="{vol}"{fade}></audio>'
    )

index = f"""<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>신용산역 북측1구역 근생 — 60초 쇼츠</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <script src="assets/kit.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: #0b0b0e; }}
      #root {{ position: relative; width: {W}px; height: {H}px; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{fmt(TOTAL)}" data-width="{W}" data-height="{H}">
{chr(10).join(hosts)}
{chr(10).join(audio)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""

os.makedirs(os.path.join(HERE, "compositions"), exist_ok=True)
for name, text in [("index.html", index), ("compositions/captions.html", captions),
                   ("compositions/flash.html", flash), ("compositions/chrome.html", chrome)]:
    open(os.path.join(HERE, name), "w", encoding="utf-8").write(text)

print("scenes:", ", ".join(f"{sid} {st}+{du}" for sid, st, du in scenes))
print("flashes:", len(flashes), "· captions:", len(cap_items), "· sfx:", len(SFX))
