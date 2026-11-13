"""timing.json -> 장면·자막·플래시·효과음·index.html

말소리의 단어별 시각(timing.json, tools/voice_chatterbox.py 가 만든다)에서 모든 시각을
계산한다. 장면은 tools/scenes/sNN.html 템플릿의 이중 중괄호 자리에 "그 단어를 말하는
순간"을 채워 compositions/ 에 쓴다. 목소리를 다시 만들면 이 스크립트만 다시 돌리면 된다.

  python3 tools/build.py
"""

import difflib
import html
import json
import math
import os
import re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1080, 1920
FRAME = 1 / 30

timing = json.load(open(os.path.join(HERE, "timing.json"), encoding="utf-8"))
L = {line["id"]: line for line in timing["lines"]}
# 끝 화면(명함·매물 표시)은 마지막 말이 끝나고 0.55 s 뒤에 컷되어 약 8초 선다. bgm.py 도 같은 식을 쓴다.
END_CARD_AT = L["l12"]["end"] + 0.55
TOTAL = float(math.ceil(END_CARD_AT + 8.0))


def fmt(x: float) -> str:
    return f"{x:.3f}".rstrip("0").rstrip(".")


# ------------------------------------------------------------------ 자막 글자 → 말소리 시각
REPL = {"~": "에서", "㎡": "제곱미터", "쌤": "샘", "태": "테"}


def norm_map(text: str):
    """비교용 글자열과, 각 글자가 원문 몇 번째 글자에서 왔는지."""
    out, src = [], []
    for i, c in enumerate(text):
        if re.match(r"[\s,.?!·]", c):
            continue
        for r in REPL.get(c, c):
            out.append(r)
            src.append(i)
    return "".join(out), src


class Clock:
    """한 줄의 자막 글자 위치를 Whisper 단어 시각으로 바꾼다 (글자열 정렬 + 단어 안 비례)."""

    def __init__(self, line):
        self.line = line
        self.cap_n, self.cap_src = norm_map(line["cap"])
        chars = []  # (단어 번호, 단어 안 위치, 단어 글자 수)
        asr = []
        for k, w in enumerate(line["words"]):
            n, _ = norm_map(w["w"])
            for j, ch in enumerate(n):
                asr.append(ch)
                chars.append((k, j, len(n)))
        self.asr_n, self.chars = "".join(asr), chars
        self.to_asr = [0] * len(self.cap_n)
        sm = difflib.SequenceMatcher(None, self.cap_n, self.asr_n, autojunk=False)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            for i in range(i1, i2):
                if tag == "equal":
                    self.to_asr[i] = j1 + (i - i1)
                elif tag == "replace":
                    self.to_asr[i] = j1 + int((i - i1) * (j2 - j1) / max(1, i2 - i1))
                else:  # delete: 들리지 않은 글자 → 다음 들린 자리
                    self.to_asr[i] = min(j1, max(0, len(self.asr_n) - 1))

    def at_norm(self, i: int) -> float:
        if not self.chars:
            return self.line["start"]
        if i >= len(self.cap_n):
            return self.line["end"]
        k, j, n = self.chars[min(self.to_asr[i], len(self.chars) - 1)]
        w = self.line["words"][k]
        return w["s"] + (w["e"] - w["s"]) * j / max(1, n)

    def at_index(self, pos: int) -> float:
        """자막 원문 pos 번째 글자를 말하는 순간."""
        i = next((k for k, s in enumerate(self.cap_src) if s >= pos), len(self.cap_n))
        return self.at_norm(i)

    def at(self, sub: str, occ: int = 1) -> float:
        """자막에서 sub 가 (occ 번째로) 시작하는 순간."""
        pos = -1
        for _ in range(occ):
            pos = self.line["cap"].index(sub, pos + 1)
        i = next(k for k, s in enumerate(self.cap_src) if s >= pos)
        return self.at_norm(i)


CLK = {lid: Clock(line) for lid, line in L.items()}
T = lambda lid, sub, occ=1: CLK[lid].at(sub, occ)  # noqa: E731

# ------------------------------------------------------------------ 장면 컷
# 장면은 그 장면 첫 말소리보다 0.1 s 먼저 컷된다 (그림이 말을 살짝 앞선다).
SCENE_FIRST_LINE = [("s01", None), ("s02", "l02"), ("s03", "l03"), ("s04", "l05"), ("s05", "l06"), ("s05b", "l06b"),
                    ("s06", "l07"), ("s06b", "l07b"), ("s07", "l08"), ("s08", "l10"), ("s09", "l11"), ("s10", "l12")]
starts = [0.0 if lid is None else round(L[lid]["start"] - 0.1, 3) for _, lid in SCENE_FIRST_LINE]
scenes = []
for i, (sid, _) in enumerate(SCENE_FIRST_LINE):
    end = starts[i + 1] if i + 1 < len(starts) else TOTAL
    scenes.append((sid, starts[i], round(end - starts[i], 3)))
S = {sid: start for sid, start, _ in scenes}
DUR = {sid: du for sid, _, du in scenes}

# ------------------------------------------------------------------ 장면 안 시각 (절대 시각으로 적고, 아래에서 장면 기준으로 바꾼다)
A = {}
A["s01"] = dict(a_w1=T("l01", "신용산역"), a_w2=T("l01", "바로"), a_w3=T("l01", "앞"),
                b_start=T("l01", "3.8평") - 0.12, b_slam=T("l01", "3.8평") + 0.02, b_sub=T("l01", "3.8평") + 0.45,
                c_start=T("l01", "19억") - 0.1, c_eok=T("l01", "19억"), c_man=min(T("l01", "5천만"), T("l01", "19억") + 0.3))
A["s02"] = dict(w1=T("l02", "상가로도"), w2=T("l02", "아파트가"), w3=T("l02", "나올까요"),
                b_start=T("l02", "답은") - 0.1, k2=T("l02", "조합"), hilite=T("l02", "추산서에"))
A["s03"] = dict(l1=L["l03"]["start"], v1=T("l03", "5억") - 0.2, l2=T("l03", "비례율"), v2=T("l03", "104.98%") - 0.15,
                rule=L["l03"]["end"] + 0.05, l3=T("l04", "권리가액은"), v3=T("l04", "6억"))
A["s04"] = dict(h=S["s04"] + 0.05, hs=S["s04"] + 0.45, c1=max(S["s04"] + 0.55, T("l05", "토지가")), x=T("l05", "근생은"),
                c2=T("l05", "권리가액이"), b1=T("l05", "권리가액이") + 0.35, b2=T("l05", "최소"))
A["s05"] = dict(stamp=T("l06", "문턱을"))
# 사진 장면: 조감도 + 사업 개요, 주변 매물 비교(의뢰인 인포그래픽)
A["s05b"] = dict(co=T("l06b", "롯데건설이"), name=T("l06b", "신용산"), f38=T("l06b", "38층"), hh=T("l06b", "324세대"))
A["s06b"] = dict(zoom=min(S["s06b"] + 0.75, T("l07b", "호가는") - 0.85), ho=T("l07b", "호가는"), tot=T("l07b", "총투자금은"))
A["s06"] = dict(big=T("l07", "115A"), seg1=T("l07", "115A") + 0.45, tl=T("l07", "총투자금은"), tv=T("l07", "총투자금은") + 0.2)
A["s07"] = dict(n=T("l08", "용산센트럴파크"), n2=T("l08", "용산센트럴파크") + 0.7, band=T("l08", "37억"),
                b_start=L["l09"]["start"] - 0.12, k2=T("l09", "한계선보다"), gap=T("l09", "3억"))
A["s08"] = dict(r1=T("l10", "삼각지역"), r2=T("l10", "신용산역"), r3=T("l10", "용산역", 2),
                b_start=T("l10", "남쪽엔") - 0.12, b_big=T("l10", "국제업무지구가"), b_chip=T("l10", "국제업무지구가") + 0.5)
A["s09"] = dict(big=T("l11", "조합원"), b_start=T("l11", "금액은") - 0.12, bk=T("l11", "금액은"), bbig=T("l11", "금액은") + 0.1)
A["s10"] = dict(k1=T("l12", "자세한"), k2=T("l12", "알고"), big=T("l12", "연락주세요"), b_start=L["l12"]["end"] + 0.55)

CUES = {}
for sid, cues in A.items():
    c = {k: round(v - S[sid], 3) for k, v in cues.items()}
    if "b_start" in c:
        c["b_dur"] = round(DUR[sid] - c["b_start"], 3)
    if "c_start" in c:
        c["b_dur"] = round(c["c_start"] - c["b_start"], 3)
        c["c_dur"] = round(DUR[sid] - c["c_start"], 3)
    CUES[sid] = c
# 숫자 오도미터: 굴러서 멈추는 시간. 다음 단계보다 늦게 끝나지 않게 줄인다.
c3 = CUES["s03"]
c3["v1_dur"] = round(min(1.4, c3["l2"] - c3["v1"] - 0.05), 3)
c3["n1"] = round(c3["v1"] + c3["v1_dur"] - 0.1, 3)
c3["v2_dur"] = round(min(1.35, c3["rule"] - c3["v2"]), 3)
CUES["s05b"]["dur"] = DUR["s05b"]
c6 = CUES["s06"]
c6["tv_dur"] = round(max(0.8, min(1.35, DUR["s06"] - 0.45 - c6["tv"])), 3)

# ------------------------------------------------------------------ 하드컷 플래시
INNER_CUTS = {"s01": [("b_start", "#ffffff"), ("c_start", "#ffd400")], "s02": [("b_start", "#ffffff")],
              "s07": [("b_start", "#ffd400")], "s08": [("b_start", "#ffffff")], "s09": [("b_start", "#ffffff")],
              "s10": [("b_start", "#ffffff")]}
SCENE_FLASH = {"s02": "#ffffff", "s03": "#ffd400", "s04": "#ffffff", "s05": "#ffd400", "s05b": "#ffffff", "s06": "#ffffff", "s06b": "#ffd400",
               "s07": "#ffffff", "s08": "#ffffff", "s09": "#ffd400", "s10": "#ffd400"}
flashes = [(S[sid], color) for sid, color in SCENE_FLASH.items()]
for sid, cuts in INNER_CUTS.items():
    flashes += [(round(S[sid] + CUES[sid][k], 3), color) for k, color in cuts]
flashes.sort()
too_close = [(a, b) for (a, _), (b, _) in zip(flashes, flashes[1:]) if b - a < 0.34]
assert not too_close, f"플래시가 초당 3번을 넘는다: {too_close}"

# ------------------------------------------------------------------ 효과음: (파일, 장면, 장면 기준 '맞을' 시각, 볼륨)
# 정점은 `hyperframes audio <file> --json` 으로 잰 값. 소리는 그림보다 한 프레임 늦게 맞춘다.
PEAK = {"whoosh": 0.162, "whoosh-short": 0.162, "impact-bass-1": 0.073, "impact-bass-2": 0.022,
        "pop": 0.12, "glitch-1": 0.478, "riser": 3.472}
C = CUES
SFX = [
    ("whoosh-short", "s01", C["s01"]["b_start"], 0.32), ("impact-bass-1", "s01", C["s01"]["c_eok"], 0.5),
    ("glitch-1", "s02", 0.0, 0.26), ("whoosh", "s02", C["s02"]["b_start"], 0.3),
    ("whoosh-short", "s03", 0.0, 0.3), ("riser", "s03", C["s03"]["v3"], 0.2), ("impact-bass-1", "s03", C["s03"]["v3"], 0.55),
    ("whoosh", "s04", 0.0, 0.3), ("pop", "s04", C["s04"]["x"], 0.42),
    ("whoosh-short", "s05", 0.0, 0.3), ("impact-bass-1", "s05", C["s05"]["stamp"], 0.5),
    ("whoosh", "s05b", 0.0, 0.3), ("pop", "s05b", C["s05b"]["name"], 0.36),
    ("whoosh-short", "s06b", 0.0, 0.3), ("pop", "s06b", C["s06b"]["ho"], 0.32), ("pop", "s06b", C["s06b"]["tot"], 0.36),
    ("whoosh", "s06", 0.0, 0.3), ("pop", "s06", C["s06"]["big"], 0.38), ("pop", "s06", C["s06"]["tv"] + C["s06"]["tv_dur"], 0.45),
    ("whoosh-short", "s07", 0.0, 0.3), ("whoosh", "s07", C["s07"]["b_start"], 0.3), ("pop", "s07", C["s07"]["gap"], 0.42),
    ("whoosh-short", "s08", 0.0, 0.3), ("pop", "s08", C["s08"]["r1"] + 0.3, 0.34), ("pop", "s08", C["s08"]["r2"] + 0.3, 0.3),
    ("pop", "s08", C["s08"]["r3"] + 0.3, 0.36), ("whoosh", "s08", C["s08"]["b_start"], 0.3),
    ("whoosh-short", "s09", 0.0, 0.3), ("whoosh", "s09", C["s09"]["b_start"], 0.3),
    ("whoosh-short", "s10", 0.0, 0.3), ("impact-bass-2", "s10", C["s10"]["big"], 0.5),
]


# ------------------------------------------------------------------ 자막: 줄을 쉼표·마침표에서 나누고, 길면 가운데 띄어쓰기에서 한 번 더
def groups_of(line):
    cap = line["cap"]
    pieces, start = [], 0
    for m in re.finditer(r"[,.?](?=\s|$)\s*", cap):
        pieces.append((start, m.end()))
        start = m.end()
    if start < len(cap):
        pieces.append((start, len(cap)))
    out = []
    for a, b in pieces:
        text = cap[a:b].strip()
        if not text:
            continue
        if len(text.replace(" ", "")) > 14 and " " in text:
            spaces = [a + m.start() for m in re.finditer(" ", cap[a:b].rstrip())]
            # "19억 5천만", "6억 521만" 처럼 숫자끼리 이어진 금액 사이에서는 자르지 않는다
            def splits_number(s):
                left = cap[:s].split(" ")[-1]
                right = cap[s + 1:].split(" ")[0]
                return bool(re.search(r"\d", left)) and bool(re.search(r"\d", right))
            spaces = [s for s in spaces if not splits_number(s)] or spaces
            mid = (a + b) / 2
            # 가운데에 가깝되, 한쪽이 5글자도 안 되게 남기지 않는다
            n_chars = lambda x: len(re.sub(r"[\s,.?]", "", x))
            short = lambda s: min(n_chars(cap[a:s]), n_chars(cap[s + 1:b])) < 5
            # "~면" 으로 끝나는 어절 뒤가 있으면 거기서 (조건절과 결론을 나눈다: "알고 싶으시면 / 연락주세요")
            cond = [s for s in spaces if cap[:s].endswith("면") and not short(s)]
            cut = cond[0] if cond else min(spaces, key=lambda s: abs(s - mid) + (100 if short(s) else 0))
            out += [(a, cut), (cut + 1, b)]
        else:
            out.append((a, b))
    clk = CLK[line["id"]]
    res = []
    for i, (a, b) in enumerate(out):
        lead = len(cap[a:b]) - len(cap[a:b].lstrip())
        st = clk.at_index(a + lead) if i else line["start"]
        res.append([cap[a:b].strip(), st])
    for i in range(len(res)):
        en = res[i + 1][1] if i + 1 < len(res) else line["end"]
        res[i].append(en)
    return res


def highlight(text: str) -> str:
    out = []
    for tok in text.split(" "):
        esc = html.escape(tok)
        out.append(f'<span class="hl">{esc}</span>' if re.search(r"\d", tok) else esc)
    return " ".join(out)


# 화면 글자가 내레이션과 똑같은 줄은 자막을 달지 않는다 (마지막 "자세한 정보를 알고 싶으시면 연락주세요"가 두 번 보이지 않게)
NO_CAPTION = {"l12"}
groups = []
for line in timing["lines"]:
    if line["id"] not in NO_CAPTION:
        groups += groups_of(line)
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
    #root .ghost {{ position: absolute; left: 0; right: 0; top: 1400px; text-align: center; font-size: 400px; font-weight: 700; line-height: 1;
      color: transparent; -webkit-text-stroke: 3px rgba(150, 150, 160, 0.22); letter-spacing: -0.04em; }}
    #root .gin {{ display: inline-block; }}
    #root #chrome-bar {{ position: absolute; left: 0; right: 0; top: 1360px; height: 6px; background: rgba(255, 255, 255, 0.14); }}
    #root #chrome-fill {{ position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: #ffd400; transform-origin: 0 50%; }}
  </style>
  <div id="root" data-composition-id="chrome" data-width="{W}" data-height="{H}">
    <div id="chrome-tag">신용산역 북측1구역 · 근생 매물</div>
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

# 전체 믹스 음량. 1.0 이면 -12.4 LUFS 로 나와 쇼츠 권장(-16~-14)보다 커서 -2.6 dB 낮춘다 → 약 -15 LUFS
MIX = 0.74
audio = [
    f'      <audio id="voice" class="clip" src="assets/voice/narration.wav" data-start="0" '
    f'data-duration="{fmt(speech_end + 0.05)}" data-track-index="5" data-volume="{fmt(MIX)}"></audio>'
]
# 배경음악(tools/bgm.py 가 코드로 작곡). 내레이션 자리는 파일 안에서 이미 -9 dB 덕킹돼 있다.
# 0.3 ≈ -10.5 dB → 말하는 동안 음악이 목소리보다 약 13 dB 아래(렌더러가 모노 내레이션을 +3 dB 로 올리는 것까지 따짐),
# 끝 화면에서는 덕킹이 풀려 음악이 올라온다.
BGM_VOL = 0.3
audio.append(
    f'      <audio id="bgm" class="clip" src="assets/bgm/bgm.mp3" data-start="0" '
    f'data-duration="{fmt(TOTAL)}" data-track-index="10" data-volume="{fmt(BGM_VOL)}"></audio>'
)
# 파일 길이(초). 라이저는 정점 뒤 꼬리를 잘라 임팩트에 넘긴다.
LENGTH = {"whoosh": 0.575, "whoosh-short": 0.575, "impact-bass-1": 2.116, "impact-bass-2": 2.592,
          "pop": 0.72, "glitch-1": 2.638, "riser": 3.62}
track_free = {6: 0.0, 7: 0.0, 8: 0.0, 9: 0.0, 11: 0.0, 12: 0.0}
for n, (name, sid, t, vol) in sorted(enumerate(SFX), key=lambda x: S[x[1][1]] + x[1][2] - PEAK[x[1][0]]):
    at = max(0.0, S[sid] + t - PEAK[name] + FRAME)
    dur = min(LENGTH[name], TOTAL - at)
    track = next(k for k, free in track_free.items() if free <= at)  # 겹치지 않는 트랙에 놓는다
    track_free[track] = at + dur
    fade = ' data-fade-out="0.15"' if name == "riser" else ""
    audio.append(
        f'      <audio id="sfx-{n + 1:02d}" class="clip" src="assets/sfx/{name}.mp3" data-start="{fmt(at)}" '
        f'data-duration="{fmt(dur)}" data-track-index="{track}" data-volume="{fmt(vol * MIX)}"{fade}></audio>'
    )

index = f"""<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>신용산역 북측1구역 근생 — 쇼츠</title>
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

# ------------------------------------------------------------------ 중개사무소 표시 사항 (office.json → 끝 화면 [[자리]])
OFFICE = json.load(open(os.path.join(HERE, "office.json"), encoding="utf-8"))
OFFICE_TEXT = {k: html.escape(v) for k, v in OFFICE.items() if not k.startswith("_")}
reg = " · ".join(x for x in [OFFICE["reg_no"] and f"등록번호 {OFFICE['reg_no']}", OFFICE["ceo"] and f"대표 공인중개사 {OFFICE['ceo']}"] if x)
OFFICE_TEXT["reg_html"] = f'          <div id="s10-b-reg">{html.escape(reg)}</div>' if reg else ""
missing_office = [k for k in ("reg_no", "ceo") if not OFFICE[k]]

os.makedirs(os.path.join(HERE, "compositions"), exist_ok=True)
for sid, _, _ in scenes:
    tpl = open(os.path.join(HERE, "tools/scenes", f"{sid}.html"), encoding="utf-8").read()
    missing = sorted(set(re.findall(r"\{\{(\w+)\}\}", tpl)) - set(CUES[sid]))
    assert not missing, f"{sid}: 시각이 없는 자리 {missing}"
    neg = {k: v for k, v in CUES[sid].items() if v < 0}
    assert not neg, f"{sid}: 장면 시작보다 이른 시각 {neg}"
    body = re.sub(r"\{\{(\w+)\}\}", lambda m: fmt(CUES[sid][m.group(1)]), tpl)
    body = re.sub(r"\[\[(\w+)\]\]", lambda m: OFFICE_TEXT[m.group(1)], body)
    open(os.path.join(HERE, "compositions", f"{sid}.html"), "w", encoding="utf-8").write(body)
for name, text in [("index.html", index), ("compositions/captions.html", captions),
                   ("compositions/flash.html", flash), ("compositions/chrome.html", chrome)]:
    open(os.path.join(HERE, name), "w", encoding="utf-8").write(text)

print("scenes:", ", ".join(f"{sid} {st}+{du}" for sid, st, du in scenes))
print("flashes:", len(flashes), "· captions:", len(cap_items), "· sfx:", len(SFX))
if missing_office:
    print("! office.json 에 비어 있는 광고 표시 사항:", ", ".join(missing_office))
for sid in CUES:
    print(" ", sid, " ".join(f"{k}={v}" for k, v in sorted(CUES[sid].items(), key=lambda kv: kv[1])))
