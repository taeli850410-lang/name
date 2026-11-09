"""timing.json -> 장면·자막·플래시·효과음·index.html

말소리의 단어별 시각(timing.json, tools/voice_chatterbox.py 가 만든다)에서 모든 시각을
계산한다. 장면은 tools/scenes/sNN.html 템플릿의 이중 중괄호 자리에 "그 단어를 말하는
순간"을 채워 compositions/ 에 쓴다. 목소리를 다시 만들면 이 스크립트만 다시 돌리면 된다.

  python3 tools/build.py
"""

import difflib
import html
import json
import os
import re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, TOTAL = 1080, 1920, 60.0
FRAME = 1 / 30

timing = json.load(open(os.path.join(HERE, "timing.json"), encoding="utf-8"))
L = {line["id"]: line for line in timing["lines"]}


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
SCENE_FIRST_LINE = [("s01", None), ("s02", "l02"), ("s03", "l03"), ("s04", "l05"), ("s05", "l06"),
                    ("s06", "l07"), ("s07", "l08"), ("s08", "l10"), ("s09", "l11"), ("s10", "l12")]
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
A["s06"] = dict(big=T("l07", "115A"), seg1=T("l07", "115A") + 0.45, tl=T("l07", "총투자금은"), tv=T("l07", "총투자금은") + 0.2)
A["s07"] = dict(n=T("l08", "용산센트럴파크"), n2=T("l08", "용산센트럴파크") + 0.7, band=T("l08", "37억"),
                b_start=L["l09"]["start"] - 0.12, k2=T("l09", "한계선보다"), gap=T("l09", "3억"))
A["s08"] = dict(r1=T("l10", "삼각지역"), r2=T("l10", "신용산역"), r3=T("l10", "용산역", 2),
                b_start=T("l10", "남쪽엔") - 0.12, b_big=T("l10", "국제업무지구가"), b_chip=T("l10", "국제업무지구가") + 0.5)
A["s09"] = dict(big=T("l11", "조합원"), b_start=T("l11", "금액은") - 0.12, bk=T("l11", "금액은"), bbig=T("l11", "금액은") + 0.25)
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
c6 = CUES["s06"]
c6["tv_dur"] = round(max(0.8, min(1.35, DUR["s06"] - 0.45 - c6["tv"])), 3)

# ------------------------------------------------------------------ 하드컷 플래시
INNER_CUTS = {"s01": [("b_start", "#ffffff"), ("c_start", "#ffd400")], "s02": [("b_start", "#ffffff")],
              "s07": [("b_start", "#ffd400")], "s08": [("b_start", "#ffffff")], "s09": [("b_start", "#ffffff")],
              "s10": [("b_start", "#ffffff")]}
SCENE_FLASH = {"s02": "#ffffff", "s03": "#ffd400", "s04": "#ffffff", "s05": "#ffd400", "s06": "#ffffff",
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
    ("whoosh", "s06", 0.0, 0.3), ("pop", "s06", C["s06"]["big"], 0.38), ("pop", "s06", C["s06"]["tv"] + C["s06"]["tv_dur"], 0.45),
    ("whoosh-short", "s07", 0.0, 0.3), ("whoosh", "s07", C["s07"]["b_start"], 0.3), ("pop", "s07", C["s07"]["gap"], 0.42),
    ("whoosh-short", "s08", 0.0, 0.3), ("pop", "s08", C["s08"]["r1"] + 0.3, 0.34), ("pop", "s08", C["s08"]["r2"] + 0.3, 0.3),
    ("pop", "s08", C["s08"]["r3"] + 0.3, 0.36), ("whoosh", "s08", C["s08"]["b_start"], 0.3),
    ("whoosh-short", "s09", 0.0, 0.3), ("whoosh", "s09", C["s09"]["b_start"], 0.3),
    ("whoosh-short", "s10", 0.0, 0.3), ("impact-bass-2", "s10", C["s10"]["big"], 0.5),
]


# ------------------------------------------------------------------ 토끼 아나운서 (왼쪽 아래 작은 원)
# 내레이션 소리 크기 → 입 벌림·말하는 테두리, 느린 흔들림 + 효과음 순간의 끄덕임 → 고개, 정해진 간격의 깜빡임.
# 모두 미리 계산해 타임라인에 박으므로 몇 번을 렌더해도 같은 프레임이 나온다.
import array
import math
import subprocess

AV_FPS = 30
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, "assets/voice/narration.wav"),
                      "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
samples = array.array("h")
samples.frombytes(pcm)
per = 8000 // AV_FPS
levels = []
for f in range(len(samples) // per):
    win = samples[f * per:(f + 1) * per]
    rms = math.sqrt(sum(s * s for s in win) / len(win)) or 1e-9
    db = 20 * math.log10(rms / 32768)
    levels.append(min(1.0, max(0.0, (db + 42) / 24)))
smooth, prev = [], 0.0
for v in levels:  # 열릴 땐 바로, 닫힐 땐 조금 천천히
    prev = v if v > prev else 0.45 * v + 0.55 * prev
    smooth.append(prev)
mouth = []
last = None
for f, v in enumerate(smooth):
    q = 0.0 if v < 0.14 else round(v * 4) / 4
    if q != last:
        mouth.append((round(f / AV_FPS, 3), q))
        last = q
mouth.append((round(len(smooth) / AV_FPS, 3), 0.0))

end_card = S["s10"] + CUES["s10"]["b_start"]
hits = [S[sid] + t for name, sid, t, _ in SFX if name.startswith(("impact", "pop"))] + [s for s in S.values() if s > 0]


def energy(tt):
    f = int(tt * AV_FPS)
    win = smooth[max(0, f - 6): f + 7]
    return sum(win) / len(win) if win else 0.0


head = []
step = 1 / 12
tt = 0.0
while tt <= end_card + 0.4:
    e = energy(tt)
    rot = (1.6 * math.sin(2 * math.pi * tt / 2.9) + 0.9 * math.sin(2 * math.pi * tt / 1.37 + 0.7)) * (0.4 + 0.8 * e)
    y = -10 * e + 5 * math.sin(2 * math.pi * tt / 2.1 + 0.3)
    for h in hits:  # 강조 순간: 살짝 끄덕
        u = tt - h
        if -0.05 < u < 0.5:
            g = math.exp(-((u - 0.1) / 0.1) ** 2)
            rot += 3.2 * g
            y += 14 * g
    head.append((round(rot, 2), round(y, 1)))
    tt += step

blinks, seedv, bt = [], 7, 1.1
while bt < end_card - 0.5:
    blinks.append(round(bt, 2))
    seedv = (seedv * 1103515245 + 12345) % 2 ** 31
    if seedv % 7 == 0:  # 가끔 두 번 연달아
        blinks.append(round(bt + 0.32, 2))
    bt += 2.6 + 2.0 * (seedv % 1000) / 1000

AV_SCALE = 228 / 800  # 원 안쪽 지름(테두리 6px 제외) / 원본 이미지
avatar = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; pointer-events: none; }}
    #root #av {{ position: absolute; left: 50px; top: 1100px; width: 240px; height: 240px; }}
    #root #av-ring {{ position: absolute; left: -14px; top: -14px; width: 268px; height: 268px; border-radius: 50%;
      border: 5px solid #ffd400; opacity: 0.2; }}
    #root #av-disc {{ position: absolute; inset: 0; border-radius: 50%; overflow: hidden; background: #ffffff;
      border: 6px solid #ffd400; box-shadow: 0 0 0 3px #0b0b0e, 0 12px 30px rgba(0, 0, 0, 0.5); }}
    #root #av-scaler {{ position: absolute; left: 0; top: 0; width: 800px; height: 800px;
      transform: scale({AV_SCALE:.4f}); transform-origin: 0 0; }}
    #root #av-head {{ position: absolute; inset: 0; transform-origin: 400px 760px; }}
    #root #av-img {{ position: absolute; left: 0; top: 0; width: 800px; height: 800px; }}
    #root .lid-wrap {{ position: absolute; }}
    /* 깜빡임: 눈 부분 그림을 잘라 겹쳐 두고 세로로 누른다 → 눈동자·속눈썹이 감은 눈의 선이 된다.
       뒤에는 가장자리를 흐린 털 색을 깔아 원래 눈을 가린다(깜빡일 때만 보인다). */
    #root .eye-blob {{ position: absolute; opacity: 0;
      background: radial-gradient(ellipse at 50% 50%, #f2e5df 0%, #eedcd5 52%, rgba(238, 220, 213, 0) 74%); }}
    #root .eye-patch {{ position: absolute; border-radius: 50%; transform-origin: 50% 62%;
      background-image: url("assets/avatar/rabbit.jpg"); background-size: 800px 800px; }}
    #root #av-blobL {{ left: 170px; top: 278px; width: 168px; height: 150px; }}
    #root #av-blobR {{ left: 402px; top: 198px; width: 172px; height: 165px; }}
    #root #av-eyeL {{ left: 183px; top: 290px; width: 142px; height: 125px; background-position: -183px -290px; }}
    #root #av-eyeR {{ left: 415px; top: 210px; width: 145px; height: 140px; background-position: -415px -210px; }}
    #root #av-mouth-wrap {{ position: absolute; left: 364px; top: 438px; width: 54px; height: 30px; transform: rotate(-15deg); }}
    #root #av-mouth {{ position: absolute; inset: 0; transform-origin: 50% 0; border-radius: 40% 40% 50% 50% / 25% 25% 75% 75%;
      background: radial-gradient(ellipse at 50% 92%, #e07a88 0 34%, #5a1f2a 36% 100%); }}
  </style>
  <div id="root" data-composition-id="avatar" data-width="{W}" data-height="{H}">
    <div id="av">
      <div id="av-ring"></div>
      <div id="av-disc">
        <div id="av-scaler">
          <div id="av-head">
            <img id="av-img" src="assets/avatar/rabbit.jpg" alt="토끼 아나운서" />
            <div class="eye-blob" id="av-blobL"></div>
            <div class="eye-blob" id="av-blobR"></div>
            <div class="eye-patch" id="av-eyeL"></div>
            <div class="eye-patch" id="av-eyeR"></div>
            <div id="av-mouth-wrap"><div id="av-mouth"></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script>
    (function () {{
      var tl = gsap.timeline({{ paused: true }});
      var M = {json.dumps(mouth)};
      var HEAD = {json.dumps(head)};
      var BL = {json.dumps(blinks)};
      var STEP = {step:.6f};
      // 등장 · 퇴장 (끝 화면 전에 빠진다)
      tl.fromTo("#av", {{ scale: 0.5, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.45, ease: "back.out(1.6)" }}, 0.25);
      tl.to("#av", {{ scale: 0.6, opacity: 0, duration: 0.3, ease: "power3.in" }}, {fmt(end_card)});
      // 입과 테두리: 소리 크기 단계가 바뀔 때만
      tl.set("#av-mouth", {{ scaleY: 0, scaleX: 0.75, opacity: 0 }}, 0);
      tl.set("#av-ring", {{ scale: 1, opacity: 0.2 }}, 0);
      for (var i = 0; i < M.length; i++) {{
        var v = M[i][1];
        tl.set("#av-mouth", {{ scaleY: v, scaleX: 0.75 + 0.25 * v, opacity: v > 0 ? 1 : 0 }}, M[i][0]);
        tl.set("#av-ring", {{ scale: 1 + 0.05 * v, opacity: 0.2 + 0.6 * v }}, M[i][0]);
      }}
      // 고개: 1/12 초마다 미리 계산한 값
      tl.set("#av-head", {{ rotation: HEAD[0][0], y: HEAD[0][1] }}, 0);
      tl.to("#av-head", {{ keyframes: HEAD.slice(1).map(function (k) {{ return {{ rotation: k[0], y: k[1], duration: STEP, ease: "none" }}; }}) }}, 0);
      // 깜빡임
      tl.set("#av .eye-patch", {{ scaleY: 1 }}, 0);
      tl.set("#av .eye-blob", {{ opacity: 0 }}, 0);
      for (var b = 0; b < BL.length; b++) {{
        tl.to("#av .eye-blob", {{ opacity: 1, duration: 0.04, ease: "none" }}, BL[b]);
        tl.to("#av .eye-patch", {{ scaleY: 0.1, duration: 0.07, ease: "power2.in" }}, BL[b]);
        tl.to("#av .eye-patch", {{ scaleY: 1, duration: 0.1, ease: "power2.out" }}, BL[b] + 0.11);
        tl.to("#av .eye-blob", {{ opacity: 0, duration: 0.06, ease: "none" }}, BL[b] + 0.16);
      }}
      window.__timelines["avatar"] = tl;
    }})();
  </script>
</template>
"""

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


groups = []
for line in timing["lines"]:
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
    #root .cap {{ position: absolute; left: 310px; right: 56px; top: 1150px; text-align: center; word-break: keep-all; }}
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
hosts.append(host("avatar", 0, TOTAL, 45, "graphics", 10))
hosts.append(host("flash", 0, TOTAL, 50, "graphics", 3))
hosts.append(host("captions", 0, TOTAL, 60, "captions", 4))

# 전체 믹스 음량. 1.0 이면 -12.4 LUFS 로 나와 쇼츠 권장(-16~-14)보다 커서 -2.6 dB 낮춘다 → 약 -15 LUFS
MIX = 0.74
audio = [
    f'      <audio id="voice" class="clip" src="assets/voice/narration.wav" data-start="0" '
    f'data-duration="{fmt(speech_end + 0.05)}" data-track-index="5" data-volume="{fmt(MIX)}"></audio>'
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
        f'data-duration="{fmt(dur)}" data-track-index="{track}" data-volume="{fmt(vol * MIX)}"{fade}></audio>'
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
for sid, _, _ in scenes:
    tpl = open(os.path.join(HERE, "tools/scenes", f"{sid}.html"), encoding="utf-8").read()
    missing = sorted(set(re.findall(r"\{\{(\w+)\}\}", tpl)) - set(CUES[sid]))
    assert not missing, f"{sid}: 시각이 없는 자리 {missing}"
    neg = {k: v for k, v in CUES[sid].items() if v < 0}
    assert not neg, f"{sid}: 장면 시작보다 이른 시각 {neg}"
    body = re.sub(r"\{\{(\w+)\}\}", lambda m: fmt(CUES[sid][m.group(1)]), tpl)
    open(os.path.join(HERE, "compositions", f"{sid}.html"), "w", encoding="utf-8").write(body)
for name, text in [("index.html", index), ("compositions/captions.html", captions),
                   ("compositions/flash.html", flash), ("compositions/chrome.html", chrome),
                   ("compositions/avatar.html", avatar)]:
    open(os.path.join(HERE, name), "w", encoding="utf-8").write(text)

print("scenes:", ", ".join(f"{sid} {st}+{du}" for sid, st, du in scenes))
print("flashes:", len(flashes), "· captions:", len(cap_items), "· sfx:", len(SFX),
      "· avatar: mouth changes", len(mouth), "blinks", len(blinks), "head keys", len(head))
for sid in CUES:
    print(" ", sid, " ".join(f"{k}={v}" for k, v in sorted(CUES[sid].items(), key=lambda kv: kv[1])))
