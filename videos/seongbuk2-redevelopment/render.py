#!/usr/bin/env python3
"""성북2구역 재개발 추천 — 60초 9:16 텍스트 모션그래픽 렌더러.

PIL로 프레임을 그려 장면별 MP4로 인코딩한 뒤 concat으로 합친다.
사용법:
  python3 render.py stills OUT_DIR          # 장면별 정지 프레임(PNG) 확인
  python3 render.py render OUT_DIR          # 장면별 렌더 + 합치기 + SRT
  python3 render.py render OUT_DIR 3 7      # 특정 장면만 다시 렌더 후 합치기
"""
import math
import os
import random
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_FILES = {
    'M': os.path.join(HERE, 'fonts', 'Pretendard-Medium.otf'),
    'B': os.path.join(HERE, 'fonts', 'Pretendard-Bold.otf'),
    'X': os.path.join(HERE, 'fonts', 'Pretendard-ExtraBold.otf'),
}

# 신뢰 블루 팔레트
BG_TOP = (0x0B, 0x2A, 0x5B)
BG_BOT = (0x2F, 0x6F, 0xE0)
WHITE = (255, 255, 255)
ACC = (0x7F, 0xE3, 0xFF)
NAVY = (0x0B, 0x2A, 0x5B)
SOFT = (214, 228, 255)  # 보조 문구(흰색보다 한 톤 낮게)

PAD = 24  # 텍스트 스프라이트 여백(그림자용)
EXIT = 0.2  # 장면 퇴장 시간


# ───────────────────────── 이징 ─────────────────────────
def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def prog(t, start, dur):
    return clamp((t - start) / dur) if dur > 0 else (1.0 if t >= start else 0.0)


def ease_out(p):
    return 1 - (1 - p) ** 2


def ease_out3(p):
    return 1 - (1 - p) ** 3


def ease_in_out(p):
    return 0.5 - 0.5 * math.cos(math.pi * p)


def back_out(p, s=1.7):
    q = p - 1
    return q * q * ((s + 1) * q + s) + 1


def bounce_out(p):
    n1, d1 = 7.5625, 2.75
    if p < 1 / d1:
        return n1 * p * p
    if p < 2 / d1:
        p -= 1.5 / d1
        return n1 * p * p + 0.75
    if p < 2.5 / d1:
        p -= 2.25 / d1
        return n1 * p * p + 0.9375
    p -= 2.625 / d1
    return n1 * p * p + 0.984375


# ───────────────────────── 글꼴·스프라이트 ─────────────────────────
@lru_cache(maxsize=None)
def font(weight, size):
    return ImageFont.truetype(FONT_FILES[weight], size)


def tlen(text, size, weight):
    return font(weight, size).getlength(text)


def runs_of(spec, default_color):
    """'문자열' 또는 ((text,color),...) → ((text,color),...)"""
    if isinstance(spec, str):
        return ((spec, default_color),)
    return tuple(spec)


@lru_cache(maxsize=None)
def text_sprite(spec, size, weight='B', color=WHITE, shadow=True):
    runs = runs_of(spec, color)
    f = font(weight, size)
    asc, desc = f.getmetrics()
    full = ''.join(r[0] for r in runs)
    w = math.ceil(f.getlength(full)) + 2 * PAD
    h = asc + desc + 2 * PAD
    txt = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(txt)
    x = PAD
    for s, c in runs:
        d.text((x, PAD), s, font=f, fill=tuple(c) + (255,), anchor='la')
        x += f.getlength(s)
    if not shadow:
        txt.info['pad'] = PAD
        return txt
    a = txt.getchannel('A')
    sh = Image.new('RGBA', (w, h), (2, 12, 40, 0))
    sh.putalpha(a.point(lambda v: v * 75 // 255))
    sh = sh.filter(ImageFilter.GaussianBlur(7))
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.alpha_composite(sh, (0, 5) if h > 5 else (0, 0))
    out.alpha_composite(txt)
    out.info['pad'] = PAD
    return out


@lru_cache(maxsize=None)
def rrect(w, h, r, fill, outline=None, ow=0):
    """안티앨리어싱된 둥근 사각형 스프라이트."""
    S = 3
    im = Image.new('RGBA', (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], radius=r * S, fill=fill,
                        outline=outline, width=ow * S)
    im = im.resize((w, h), Image.LANCZOS)
    im.info['pad'] = 0
    return im


@lru_cache(maxsize=None)
def circle(d_px, fill):
    S = 4
    im = Image.new('RGBA', (d_px * S, d_px * S), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse([0, 0, d_px * S - 1, d_px * S - 1], fill=fill)
    im = im.resize((d_px, d_px), Image.LANCZOS)
    im.info['pad'] = 0
    return im


@lru_cache(maxsize=None)
def check_icon(d_px, bg, fg):
    S = 4
    D = d_px * S
    im = Image.new('RGBA', (D, D), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    dr.ellipse([0, 0, D - 1, D - 1], fill=bg)
    pts = [(D * 0.27, D * 0.52), (D * 0.44, D * 0.68), (D * 0.74, D * 0.35)]
    dr.line(pts, fill=fg, width=int(D * 0.11), joint='curve')
    for (x, y) in (pts[0], pts[2]):
        r = D * 0.055
        dr.ellipse([x - r, y - r, x + r, y + r], fill=fg)
    im = im.resize((d_px, d_px), Image.LANCZOS)
    im.info['pad'] = 0
    return im


@lru_cache(maxsize=None)
def star_sprite(size):
    S = 4
    D = size * S
    im = Image.new('RGBA', (D, D), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = D / 2
    pts = []
    for i in range(8):
        ang = math.pi / 4 * i - math.pi / 2
        r = c if i % 2 == 0 else c * 0.22
        pts.append((c + r * math.cos(ang), c + r * math.sin(ang)))
    d.polygon(pts, fill=(255, 255, 255, 255))
    im = im.resize((size, size), Image.LANCZOS)
    glow = im.filter(ImageFilter.GaussianBlur(size / 10))
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(im)
    out.info['pad'] = 0
    return out


# ───────────────────────── 합성 ─────────────────────────
class Ctx:
    alpha = 1.0
    dy = 0.0


CTX = Ctx()


def with_alpha(im, a):
    if a >= 0.999:
        return im
    out = im.copy()
    out.putalpha(im.getchannel('A').point(lambda v: int(v * a)))
    return out


def blit_at(base, im, left, top, alpha=1.0, use_ctx=True):
    a = alpha * (CTX.alpha if use_ctx else 1.0)
    if a <= 0.004:
        return
    if use_ctx:
        top += CTX.dy
    im2 = with_alpha(im, a)
    base.paste(im2, (int(round(left)), int(round(top))), im2)


def place(im, x, y, anchor='c', scale=1.0):
    pad = im.info.get('pad', 0)
    w, h = im.size
    cw, ch = (w - 2 * pad) * scale, (h - 2 * pad) * scale
    p = pad * scale
    if anchor == 'c':
        return x - cw / 2 - p, y - ch / 2 - p
    if anchor == 'l':
        return x - p, y - ch / 2 - p
    if anchor == 'r':
        return x - cw - p, y - ch / 2 - p
    if anchor == 'lt':
        return x - p, y - p
    raise ValueError(anchor)


def blit(base, im, x, y, anchor='c', alpha=1.0, scale=1.0, use_ctx=True):
    left, top = place(im, x, y, anchor, scale)
    if abs(scale - 1.0) > 1e-3:
        pad = im.info.get('pad', 0)
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BICUBIC)
        im.info['pad'] = pad * scale
    blit_at(base, im, left, top, alpha, use_ctx)


# ───────────────────────── 효과 ─────────────────────────
def fade_up(base, im, x, y, t, start, dur=0.5, dist=40, anchor='c'):
    """스태거 한 장: 아래 40px에서 떠오르며 페이드 인 (ease-out)."""
    p = prog(t, start, dur)
    if p <= 0:
        return
    e = ease_out(p)
    blit(base, im, x, y + (1 - e) * dist, anchor, alpha=e)


def line_mask(base, im, x, y, t, start, dur=0.6, anchor='c'):
    """라인 마스크: 줄 영역 안에서 아래→위로 올라오며 드러남."""
    p = prog(t, start, dur)
    if p <= 0:
        return
    e = ease_out(p)
    left, top = place(im, x, y, anchor)
    if e >= 0.999:
        blit_at(base, im, left, top, 1.0)
        return
    h = im.height
    dy = int(round((1 - e) * (h - PAD)))
    vis = im.crop((0, 0, im.width, max(1, h - dy)))
    blit_at(base, vis, left, top + dy, min(1.0, e * 1.6))


def words_of(spec, size, weight, color):
    """줄을 단어 단위로 쪼개 (runs, x_offset) 목록과 전체 폭을 돌려준다."""
    runs = runs_of(spec, color)
    chars = []
    for s, c in runs:
        for ch in s:
            chars.append((ch, c))
    full = ''.join(ch for ch, _ in chars)
    words, cur, start_i = [], [], 0
    for i, (ch, c) in enumerate(chars + [(' ', None)]):
        if ch == ' ':
            if cur:
                words.append((start_i, cur))
            cur = []
            start_i = i + 1
        else:
            cur.append((ch, c))
    out = []
    for si, cs in words:
        runs_w = []
        for ch, c in cs:
            if runs_w and runs_w[-1][1] == c:
                runs_w[-1][0] += ch
            else:
                runs_w.append([ch, c])
        xoff = tlen(full[:si], size, weight)
        out.append((tuple((r[0], r[1]) for r in runs_w), xoff))
    return out, tlen(full, size, weight)


def snap_line(base, spec, size, weight, cx, cy, t, start, color=WHITE, dur=0.8, stagger=0.1, dist=260):
    """스냅 텍스트: 단어별로 오른쪽에서 미끄러져 들어와 살짝 지나쳤다 '착' (back.out 1.7)."""
    words, total = words_of(spec, size, weight, color)
    left0 = cx - total / 2
    for i, (runs, xoff) in enumerate(words):
        p = prog(t, start + i * stagger, dur)
        if p <= 0:
            continue
        e = back_out(p)
        spr = text_sprite(runs, size, weight, color)
        blit(base, spr, left0 + xoff + (1 - e) * dist, cy, 'l', alpha=clamp(p / 0.3))


def chars_of(text, size, weight):
    out = []
    for i, ch in enumerate(text):
        out.append((ch, tlen(text[:i], size, weight)))
    return out, tlen(text, size, weight)


def drop_bounce(base, text, size, weight, color, cx, cy, t, start, dur=0.9, stagger=0.09, dist=520):
    chars, total = chars_of(text, size, weight)
    left0 = cx - total / 2
    k = 0
    for ch, xoff in chars:
        if ch == ' ':
            continue
        p = prog(t, start + k * stagger, dur)
        k += 1
        if p <= 0:
            continue
        e = bounce_out(p)
        spr = text_sprite(ch, size, weight, color)
        blit(base, spr, left0 + xoff, cy - (1 - e) * dist, 'l', alpha=clamp(p / 0.12))


def wave_text(base, text, size, weight, color, cx, cy, t, start, amp=13, period=0.6, stagger=0.08, cycles=2):
    chars, total = chars_of(text, size, weight)
    left0 = cx - total / 2
    for i, (ch, xoff) in enumerate(chars):
        if ch == ' ':
            continue
        lt = t - start - i * stagger
        off = 0.0
        if 0 < lt < period * cycles:
            off = -amp * math.sin(2 * math.pi * lt / period)
        spr = text_sprite(ch, size, weight, color)
        blit(base, spr, left0 + xoff, cy + off, 'l')


@lru_cache(maxsize=None)
def roll_mask(w, h):
    col = Image.new('L', (1, h))
    for yy in range(h):
        k = yy / max(1, h - 1)
        v = clamp(min(k / 0.24, (1 - k) / 0.2))
        col.putpixel((0, yy), int(255 * ease_in_out(v)))
    return col.resize((w, h), Image.NEAREST)


def counter(base, text, size, weight, color, x, y, t, start, dur=1.2, stagger=0.06,
            prefix=None, suffix=None, anchor='c', gap=10):
    """카운터: 숫자가 자릿수별로 슬롯머신처럼 굴러 올라감 (ease-out, 자릿수 간격 60ms).
    prefix/suffix = (text, size, weight, color) — 기준선 맞춰 고정 표시."""
    p0 = prog(t, start, 0.15)
    if p0 <= 0:
        return
    f = font(weight, size)
    asc, desc = f.getmetrics()
    lh = asc + desc
    dw = max(f.getlength(str(d)) for d in range(10))
    widths = [dw if c.isdigit() else f.getlength(c) for c in text]
    num_w = int(math.ceil(sum(widths))) + 4
    canvas = Image.new('RGBA', (num_w, lh), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    roll = None
    fill = tuple(color) + (255,)
    xx, di = 2, 0
    for c, wd in zip(text, widths):
        if c.isdigit():
            target = int(c)
            pd = prog(t, start + di * stagger, dur)
            di += 1
            if pd >= 1:
                gx = xx + (dw - f.getlength(c)) / 2
                d.text((gx, 0), c, font=f, fill=fill, anchor='la')
            else:
                if roll is None:
                    roll = Image.new('RGBA', (num_w, lh), (0, 0, 0, 0))
                    rd = ImageDraw.Draw(roll)
                pv = ease_out3(pd) * (10 + target)
                k = math.floor(pv)
                frac = pv - k
                g0, g1 = str(k % 10), str((k + 1) % 10)
                gx0 = xx + (dw - f.getlength(g0)) / 2
                rd.text((gx0, -frac * lh), g0, font=f, fill=fill, anchor='la')
                if frac > 1e-3:
                    gx1 = xx + (dw - f.getlength(g1)) / 2
                    rd.text((gx1, (1 - frac) * lh), g1, font=f, fill=fill, anchor='la')
        elif c != ' ':
            d.text((xx, 0), c, font=f, fill=fill, anchor='la')
        xx += wd
    if roll is not None:  # 굴러가는 숫자는 위아래 가장자리를 부드럽게
        roll.putalpha(ImageChops.multiply(roll.getchannel('A'), roll_mask(num_w, lh)))
        canvas.alpha_composite(roll)
    canvas.info['pad'] = 0

    parts = []  # (sprite, width, kind)
    if prefix:
        ps = text_sprite(prefix[0], prefix[1], prefix[2], prefix[3])
        parts.append((ps, tlen(prefix[0], prefix[1], prefix[2]), prefix))
    parts.append((canvas, num_w, None))
    if suffix:
        ss = text_sprite(suffix[0], suffix[1], suffix[2], suffix[3])
        parts.append((ss, tlen(suffix[0], suffix[1], suffix[2]), suffix))
    total = sum(p[1] for p in parts) + gap * (len(parts) - 1)
    if anchor == 'c':
        left = x - total / 2
    elif anchor == 'l':
        left = x
    else:
        left = x - total
    top = y - lh / 2
    baseline = top + asc
    a = ease_out(p0)
    for spr, wd, spec in parts:
        if spec is None:
            blit_at(base, spr, left, top, a)
        else:
            sasc = font(spec[2], spec[1]).getmetrics()[0]
            blit_at(base, spr, left - PAD, baseline - sasc - PAD, a)
        left += wd + gap


def ring(base, cx, cy, t, start, dur=0.8, r0=60, r1=380, w0=16, color=ACC):
    """충격파 링: 원이 퍼지며 얇아지고 사라짐."""
    p = prog(t, start, dur)
    if p <= 0 or p >= 1:
        return
    e = ease_out(p)
    r = r0 + (r1 - r0) * e
    wd = max(1.5, w0 * (1 - p))
    a = (1 - p) ** 1.2
    S = 2
    size = int(2 * (r + wd) + 8)
    im = Image.new('RGBA', (size * S, size * S), (0, 0, 0, 0))
    c = size * S / 2
    ImageDraw.Draw(im).ellipse([c - r * S, c - r * S, c + r * S, c + r * S],
                               outline=tuple(color) + (int(235 * a),), width=max(2, int(wd * S)))
    im = im.resize((size, size), Image.BILINEAR)
    blit_at(base, im, cx - size / 2, cy - size / 2)


def sparkles(base, cx, cy, t, start, spots, seed=7):
    rnd = random.Random(seed)
    for (dx, dy, sz) in spots:
        ph = rnd.random() * 0.6
        lt = t - start - ph
        if lt <= 0:
            continue
        s = 0.5 + 0.5 * math.sin(lt * 5.2 + ph * 9)
        sc = (0.35 + 0.65 * s) * min(1.0, lt / 0.25)
        spr = star_sprite(sz)
        blit(base, spr, cx + dx, cy + dy, 'c', alpha=0.45 + 0.55 * s, scale=max(0.05, sc))


def underline(base, cx, y, width, t, start, dur=0.5, thick=10, color=ACC):
    p = prog(t, start, dur)
    if p <= 0:
        return
    w = max(2, int(width * ease_out(p)))
    bar = rrect(w, thick, thick // 2, tuple(color) + (255,))
    blit(base, bar, cx - width / 2, y, 'l')


def pop(base, im, x, y, t, start, dur=0.5):
    """배지 등장: 작게 시작해 살짝 커졌다 제자리 (back.out)."""
    p = prog(t, start, dur)
    if p <= 0:
        return
    sc = 0.55 + 0.45 * back_out(p)
    blit(base, im, x, y, 'c', alpha=clamp(p / 0.3), scale=sc)


# ───────────────────────── 공통 배경·UI ─────────────────────────
def build_background():
    grad = Image.new('RGB', (1, H))
    for y in range(H):
        k = y / (H - 1)
        k = k * k * (3 - 2 * k) * 0.85 + k * 0.15
        grad.putpixel((0, y), tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * k) for i in range(3)))
    bg = grad.resize((W, H), Image.BILINEAR).convert('RGBA')

    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W - 620, -520, W + 520, 520], fill=(120, 190, 255, 70))
    gd.ellipse([-500, H - 700, 560, H + 400], fill=(150, 220, 255, 45))
    glow = glow.filter(ImageFilter.GaussianBlur(150))
    bg.alpha_composite(glow)

    dots = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    step = 54
    for yy in range(step // 2, H, step):
        for xx in range(step // 2, W, step):
            dd.ellipse([xx - 2, yy - 2, xx + 2, yy + 2], fill=(255, 255, 255, 16))
    bg.alpha_composite(dots)
    return bg.convert('RGB')


def build_beam():
    bw = 900
    im = Image.new('RGBA', (bw, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(380, 0), (560, 0), (340, H), (160, H)], fill=(255, 255, 255, 26))
    d.polygon([(600, 0), (650, 0), (430, H), (380, H)], fill=(255, 255, 255, 18))
    im = im.filter(ImageFilter.GaussianBlur(40))
    im.info['pad'] = 0
    return im


def build_particle():
    s = 40
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse([12, 12, 28, 28], fill=(200, 235, 255, 255))
    im = im.filter(ImageFilter.GaussianBlur(4))
    im.info['pad'] = 0
    return im


BG = None
BEAM = None
PART = None
PARTICLES = []
TAG = None
TOTAL = 60.0


def init_assets():
    global BG, BEAM, PART, PARTICLES, TAG
    BG = build_background()
    BEAM = build_beam()
    PART = build_particle()
    rnd = random.Random(42)
    PARTICLES = [(rnd.uniform(0, W), rnd.uniform(0, H + 200), rnd.uniform(18, 55),
                  rnd.uniform(0.35, 1.0), rnd.uniform(0.10, 0.28), rnd.uniform(0, 6.28))
                 for _ in range(24)]
    # 상단 태그
    label = (('성북2구역 · 재개발 ', WHITE), ('추천', ACC))
    tw = int(tlen('성북2구역 · 재개발 추천', 34, 'B'))
    pill = Image.new('RGBA', (tw + 96, 64), (0, 0, 0, 0))
    pill.alpha_composite(rrect(tw + 96, 64, 32, (255, 255, 255, 34), (255, 255, 255, 70), 2))
    dot = circle(14, tuple(ACC) + (255,))
    pill.alpha_composite(dot, (28, 25))
    ts = text_sprite(label, 34, 'B', WHITE, shadow=False)
    pill.alpha_composite(ts, (56 - PAD, 32 - (ts.height - 2 * PAD) // 2 - PAD))
    pill.info['pad'] = 0
    TAG = pill


def draw_ambient(base, T):
    # 움직이는 빛줄기
    period = 9.0
    x = -900 + ((T % period) / period) * (W + 900)
    base.paste(BEAM, (int(x), 0), BEAM)
    # 떠오르는 입자
    for (px, py, sp, sc, a, ph) in PARTICLES:
        y = (py - sp * T) % (H + 200) - 100
        xx = px + 14 * math.sin(T * 0.6 + ph)
        im = PART if sc > 0.95 else PART.resize((max(4, int(40 * sc)),) * 2, Image.BILINEAR)
        im2 = with_alpha(im, a)
        base.paste(im2, (int(xx), int(y)), im2)


def draw_ui(base, T):
    blit_at(base, TAG, 60, 96, use_ctx=False)
    track = rrect(960, 8, 4, (255, 255, 255, 50))
    base.paste(track, (60, 52), track)
    w = int(960 * clamp(T / TOTAL))
    if w >= 8:
        fill = rrect(w, 8, 4, tuple(ACC) + (255,))
        base.paste(fill, (60, 52), fill)


# ───────────────────────── 자막 ─────────────────────────
SUB_CY = 1420
SUB_SIZE = 44
SUB_LH = 62


@lru_cache(maxsize=None)
def subtitle_sprite(text):
    lines = text.split('\n')
    f = font('M', SUB_SIZE)
    asc, desc = f.getmetrics()
    tw = max(f.getlength(l) for l in lines)
    bw = int(tw + 88)
    bh = int(SUB_LH * len(lines) + 48 - (SUB_LH - (asc + desc)))
    box = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    box.alpha_composite(rrect(bw, bh, 26, (4, 16, 44, 178), (255, 255, 255, 40), 2))
    d = ImageDraw.Draw(box)
    y = 24
    for l in lines:
        lw = f.getlength(l)
        d.text(((bw - lw) / 2, y), l, font=f, fill=(255, 255, 255, 255), anchor='la')
        y += SUB_LH
    box.info['pad'] = 0
    return box


def draw_subtitle(base, cues, t):
    for (s, e, text) in cues:
        if s <= t < e:
            a = min(prog(t, s, 0.15), 1.0 - prog(t, e - 0.12, 0.12))
            spr = subtitle_sprite(text)
            blit(base, spr, W / 2, SUB_CY, 'c', alpha=a, use_ctx=False)


# ───────────────────────── 장면 ─────────────────────────
CX = W / 2
FOOT_Y = 1236


def foot(base, text, t, start):
    fade_up(base, text_sprite(text, 30, 'M', SOFT), CX, FOOT_Y, t, start, dist=20)


def s1(base, t):  # 0–4  훅
    fade_up(base, text_sprite('성북2구역 타운하우스 · 무허가주택', 42, 'M', SOFT), CX, 400, t, 0.0)
    snap_line(base, '서울 도심 새집', 108, 'B', CX, 540, t, 0.15)
    ring(base, CX, 800, t, 0.95, dur=0.9, r1=420)
    snap_line(base, (('5억', ACC),), 320, 'X', CX, 800, t, 0.55)
    snap_line(base, '으로 시작?', 108, 'B', CX, 1060, t, 0.9)


def s2(base, t):  # 4–8  반전
    line_mask(base, text_sprite('땅은 단', 76, 'M', SOFT), CX, 400, t, 0.1)
    counter(base, '2.42', 250, 'X', ACC, CX, 600, t, 0.3,
            suffix=('평', 130, 'B', WHITE))
    line_mask(base, text_sprite('사는 건', 76, 'M', SOFT), CX, 830, t, 1.3)
    line_mask(base, text_sprite('‘새집 받을 권리’', 108, 'B', WHITE), CX, 965, t, 1.45)
    underline(base, CX, 1050, tlen('‘새집 받을 권리’', 108, 'B') * 0.92, t, 2.0)


CALC_ROWS = [
    ('매매가', '5억 원'),
    ('감정평가액 (추정)', '약 3,848만 원'),
    ('조합원 분양가 (가정)', '15억 원'),
    ('분담금 (추정)', '약 14억 6,152만 원'),
]


@lru_cache(maxsize=None)
def calc_card(label, value):
    card = Image.new('RGBA', (920, 112), (0, 0, 0, 0))
    card.alpha_composite(rrect(920, 112, 28, (255, 255, 255, 30), (255, 255, 255, 60), 2))
    ls = text_sprite(label, 42, 'M', SOFT, shadow=False)
    card.alpha_composite(ls, (44 - PAD, 56 - (ls.height - 2 * PAD) // 2 - PAD))
    vs = text_sprite(value, 54, 'B', WHITE, shadow=False)
    vw = int(tlen(value, 54, 'B'))
    card.alpha_composite(vs, (920 - 44 - vw - PAD, 56 - (vs.height - 2 * PAD) // 2 - PAD))
    card.info['pad'] = 0
    return card


@lru_cache(maxsize=None)
def total_card():
    card = Image.new('RGBA', (920, 196), (0, 0, 0, 0))
    card.alpha_composite(rrect(920, 196, 32, tuple(ACC) + (255,)))
    ls = text_sprite('총투자금 (추정)', 42, 'B', NAVY, shadow=False)
    lw = tlen('총투자금 (추정)', 42, 'B')
    card.alpha_composite(ls, (int(460 - lw / 2) - PAD, 22 - PAD))
    card.info['pad'] = 0
    return card


def s3(base, t):  # 8–15  총투자금 계산
    line_mask(base, text_sprite('끝까지 계산하면', 88, 'B', WHITE), CX, 300, t, 0.1)
    line_mask(base, text_sprite('분양가 15억 가정', 42, 'M', SOFT), CX, 385, t, 0.25)
    for i, (lab, val) in enumerate(CALC_ROWS):
        fade_up(base, calc_card(lab, val), CX, 490 + i * 132, t, 0.55 + i * 0.25)
    t0 = 0.55 + 4 * 0.25
    fade_up(base, total_card(), CX, 1088, t, t0)
    if t >= t0 + 0.2:
        cy = 1088 + 32 + CTX_offset(t, t0)
        counter(base, '19억 6,152만', 84, 'X', NAVY, CX, cy, t, t0 + 0.2,
                prefix=('약', 46, 'B', NAVY), suffix=('원', 46, 'B', NAVY), gap=14)
    foot(base, '※ 감정가·분양가는 관리처분 전 추정치', t, 1.2)


def CTX_offset(t, start, dur=0.5, dist=40):
    return (1 - ease_out(prog(t, start, dur))) * dist


def s4(base, t):  # 15–19  질문 전환
    line_mask(base, text_sprite('‘5억이 싸냐’보다', 76, 'M', SOFT), CX, 470, t, 0.1)
    line_mask(base, text_sprite('프리미엄', 112, 'B', WHITE), CX, 630, t, 0.22)
    line_mask(base, text_sprite('4억 6천만 원', 150, 'X', ACC), CX, 800, t, 0.34)
    line_mask(base, text_sprite('적정한지가 핵심', 100, 'B', WHITE), CX, 990, t, 0.46)
    underline(base, CX, 1075, tlen('적정한지가 핵심', 100, 'B') * 0.95, t, 1.15)
    fade_up(base, text_sprite('매매가 5억 중 4억 6천만 원 이상이 프리미엄', 36, 'M', SOFT), CX, 1160, t, 1.4, dist=20)


DEALS = [  # (대지 평, 거래가 억) — 블로그 실거래 10건 + 이 매물
    ('30.9평', 8.67, '8.67억'), ('29.9평', 7.8, '7.8억'), ('29.0평', 7.3, '7.3억'),
    ('25.1평', 6.35, '6.35억'), ('15.1평', 5.85, '5.85억'), ('15.1평', 5.8, '5.8억'),
    ('23.9평', 5.8, '5.8억'), ('19.1평', 5.75, '5.75억'), ('20.0평', 5.4, '5.4억'),
    ('20.0평', 5.2, '5.2억'),
]
BAR_X0 = 262
BAR_SCALE = 66.0  # px per 억
ROW_Y0 = 520
ROW_STEP = 57
BAR_H = 38


def s5(base, t):  # 19–26  실거래 10건
    # 제목: "최근 실거래 10건"
    hs, ns = 86, 86
    w_txt = tlen('최근 실거래 ', hs, 'B')
    f = font('X', ns)
    dw = max(f.getlength(str(d)) for d in range(10))
    w_num = dw * 2 + 4 + 10 + tlen('건', ns, 'X')
    left = CX - (w_txt + w_num) / 2
    line_mask(base, text_sprite('최근 실거래', hs, 'B', WHITE), left, 300, t, 0.1, anchor='l')
    counter(base, '10', ns, 'X', ACC, left + w_txt, 300, t, 0.25, dur=1.0,
            suffix=('건', ns, 'X', ACC), anchor='l')
    fade_up(base, text_sprite('대지 크기와 상관없이 모두 5억 2천만 원 이상', 40, 'M', SOFT), CX, 392, t, 0.55, dist=20)

    lab_x = BAR_X0 - 22
    for i, (land, val, vtxt) in enumerate(DEALS):
        st = 0.85 + i * 0.08
        p = prog(t, st, 0.5)
        if p <= 0:
            continue
        e = ease_out(p)
        y = ROW_Y0 + i * ROW_STEP
        blit(base, text_sprite(land, 30, 'M', SOFT, shadow=False), lab_x, y, 'r', alpha=e)
        bw = int(val * BAR_SCALE * e)
        if bw > 4:
            blit(base, rrect(bw, BAR_H, 10, (255, 255, 255, 215)), BAR_X0, y, 'l')
        blit(base, text_sprite(vtxt, 30, 'B', WHITE, shadow=False), BAR_X0 + bw + 14, y, 'l', alpha=e)

    # 이 매물
    i = len(DEALS)
    st = 0.85 + i * 0.08 + 0.35
    p = prog(t, st, 0.6)
    if p > 0:
        e = ease_out(p)
        y = ROW_Y0 + i * ROW_STEP + 12
        blit(base, text_sprite('2.42평', 32, 'B', ACC, shadow=False), lab_x, y, 'r', alpha=e)
        bw = int(5.0 * BAR_SCALE * e)
        if bw > 4:
            blit(base, rrect(bw, BAR_H + 8, 12, tuple(ACC) + (255,)), BAR_X0, y, 'l')
        lab_left = max(BAR_X0 + bw + 14, BAR_X0 + 5.2 * BAR_SCALE + 20)
        blit(base, text_sprite('5억 · 이 매물', 34, 'X', ACC, shadow=False), lab_left, y, 'l', alpha=e)
        if p >= 1:
            ring(base, BAR_X0 + bw, y, t, st + 0.6, dur=0.7, r0=10, r1=120, w0=8)

    # 최저 5.2억 기준선
    pl = prog(t, 1.9, 0.4)
    if pl > 0:
        lx = BAR_X0 + 5.2 * BAR_SCALE
        top, bot = ROW_Y0 - 30, ROW_Y0 + len(DEALS) * ROW_STEP + 40
        seg = Image.new('RGBA', (4, 14), (*ACC, 230))
        y = top
        while y < bot:
            blit_at(base, seg, lx - 2, y, ease_out(pl))
            y += 24
        blit(base, text_sprite('최저 5.2억', 30, 'B', ACC, shadow=False), lx, top - 26, 'c', alpha=ease_out(pl))
    foot(base, '실거래 10건 (2025.5~2026.8) · 대지 = 토지 면적', t, 2.4)


def s6(base, t):  # 26–31  지역 상승 vs 제자리
    line_mask(base, text_sprite('서울 동북권 단독주택 지수', 54, 'M', SOFT), CX, 330, t, 0.1)
    counter(base, '+4.1%', 230, 'X', ACC, CX, 520, t, 0.25)
    fade_up(base, text_sprite('97.01 → 101.00 · 11개월 연속 상승', 40, 'M', WHITE), CX, 680, t, 0.9, dist=20)
    pd = prog(t, 1.15, 0.5)
    if pd > 0:
        w = int(560 * ease_out(pd))
        blit(base, rrect(max(2, w), 3, 1, (255, 255, 255, 90)), CX, 770, 'c')
    line_mask(base, text_sprite('이 일대 소형 주택은', 66, 'M', SOFT), CX, 870, t, 1.3)
    line_mask(base, text_sprite('거의 제자리', 124, 'B', WHITE), CX, 1005, t, 1.45)
    fade_up(base, text_sprite('→ 사업 변화 기대가 아직 덜 얹힌 가격', 42, 'B', ACC), CX, 1130, t, 1.9, dist=20)
    foot(base, '출처: 한국부동산원 단독주택 매매가격지수 (2025.9 → 2026.8)', t, 2.2)


@lru_cache(maxsize=None)
def badge(text):
    tw = int(tlen(text, 44, 'B'))
    b = Image.new('RGBA', (tw + 80, 84), (0, 0, 0, 0))
    b.alpha_composite(rrect(tw + 80, 84, 42, tuple(ACC) + (255,)))
    ts = text_sprite(text, 44, 'B', NAVY, shadow=False)
    b.alpha_composite(ts, (40 - PAD, 42 - (ts.height - 2 * PAD) // 2 - PAD))
    b.info['pad'] = 0
    return b


def s7(base, t):  # 31–37  추천 포인트 ①
    pop(base, badge('추천 포인트 ①'), CX, 320, t, 0.05)
    snap_line(base, '사업 방식이', 100, 'B', CX, 465, t, 0.3)
    snap_line(base, '하나로 정리됐다', 100, 'B', CX, 590, t, 0.45)
    line_mask(base, text_sprite('전면 철거형 · 공동주택', 52, 'M', SOFT), CX, 735, t, 0.95)
    counter(base, '496', 210, 'X', ACC, CX, 875, t, 1.05, suffix=('세대', 84, 'B', WHITE), gap=16)
    facts = ['2025.11 서울시 도시계획위원회 수정가결',
             '2026.03 정비구역 변경 결정고시',
             '최고 4층 · 용적률 90% 이하']
    for i, s in enumerate(facts):
        fade_up(base, text_sprite(s, 38, 'M', WHITE), CX, 1040 + i * 60, t, 1.9 + i * 0.12, dist=24)


@lru_cache(maxsize=None)
def stat_tile():
    tile = Image.new('RGBA', (440, 230), (0, 0, 0, 0))
    tile.alpha_composite(rrect(440, 230, 32, (255, 255, 255, 30), (255, 255, 255, 64), 2))
    tile.info['pad'] = 0
    return tile


def s8(base, t):  # 37–43  추천 포인트 ②
    pop(base, badge('추천 포인트 ②'), CX, 320, t, 0.05)
    snap_line(base, '짝꿍 구역이', 100, 'B', CX, 465, t, 0.3)
    snap_line(base, '먼저 달린다', 100, 'B', CX, 590, t, 0.45)
    line_mask(base, text_sprite('결합개발 상대 · 신월곡1구역', 50, 'M', SOFT), CX, 725, t, 0.95)
    for k, (tx, lab) in enumerate([(300, '최고'), (780, '세대 수 (약)')]):
        st = 1.15 + k * 0.08
        fade_up(base, stat_tile(), tx, 915, t, st)
        if t >= st:
            off = CTX_offset(t, st)
            fade_up(base, text_sprite(lab, 38, 'M', SOFT, shadow=False), tx, 850, t, st)
            if k == 0:
                counter(base, '47', 130, 'X', ACC, tx, 950 + off, t, st + 0.15,
                        suffix=('층', 60, 'B', WHITE))
            else:
                counter(base, '2,200', 94, 'X', ACC, tx, 950 + off, t, st + 0.15,
                        suffix=('세대', 46, 'B', WHITE), gap=8)
    pc = prog(t, 2.3, 0.5)
    if pc > 0:
        e = ease_out(pc)
        txt = '이주 사실상 마무리 단계'
        tw = tlen(txt, 52, 'B')
        left = CX - (tw + 70) / 2
        blit(base, check_icon(52, tuple(ACC) + (255,), tuple(NAVY) + (255,)), left + 26, 1105 + (1 - e) * 30, 'c', alpha=e)
        blit(base, text_sprite(txt, 52, 'B', WHITE), left + 70, 1105 + (1 - e) * 30, 'l', alpha=e)
    foot(base, '2026.07 사업시행변경인가 고시 보도 기준', t, 2.5)


CHECKS = [
    '분양자격 (특정무허가건축물)',
    '분양가 변동 = 분담금 변동',
    '담보대출 어려움 (등기 없음)',
    '긴 사업기간 · 기회비용',
    '토지거래허가 · 취득·보유세',
]


@lru_cache(maxsize=None)
def check_row(i, text):
    row = Image.new('RGBA', (900, 104), (0, 0, 0, 0))
    row.alpha_composite(rrect(900, 104, 26, (255, 255, 255, 28), (255, 255, 255, 56), 2))
    row.alpha_composite(rrect(64, 64, 18, tuple(ACC) + (255,)), (24, 20))
    ns = text_sprite(str(i + 1), 40, 'X', NAVY, shadow=False)
    nw = tlen(str(i + 1), 40, 'X')
    row.alpha_composite(ns, (int(56 - nw / 2) - PAD, 52 - (ns.height - 2 * PAD) // 2 - PAD))
    ts = text_sprite(text, 46, 'B', WHITE, shadow=False)
    row.alpha_composite(ts, (112 - PAD, 52 - (ts.height - 2 * PAD) // 2 - PAD))
    row.info['pad'] = 0
    return row


def s9(base, t):  # 43–49  주의사항 5가지
    line_mask(base, text_sprite('도장 찍기 전', 66, 'M', SOFT), CX, 320, t, 0.1)
    line_mask(base, text_sprite((('꼭 확인할 ', WHITE), ('5가지', ACC)), 100, 'B', WHITE), CX, 440, t, 0.22)
    for i, s in enumerate(CHECKS):
        fade_up(base, check_row(i, s), CX, 590 + i * 124, t, 0.6 + i * 0.15)


@lru_cache(maxsize=None)
def fit_row(text):
    row = Image.new('RGBA', (840, 112), (0, 0, 0, 0))
    row.alpha_composite(rrect(840, 112, 56, (255, 255, 255, 30), (255, 255, 255, 60), 2))
    row.alpha_composite(check_icon(64, tuple(ACC) + (255,), tuple(NAVY) + (255,)), (26, 24))
    ts = text_sprite(text, 56, 'B', WHITE, shadow=False)
    row.alpha_composite(ts, (116 - PAD, 56 - (ts.height - 2 * PAD) // 2 - PAD))
    row.info['pad'] = 0
    return row


def s10(base, t):  # 49–55  이런 분께 추천
    snap_line(base, '이런 분께', 104, 'B', CX, 380, t, 0.1)
    snap_line(base, (('추천합니다', ACC),), 140, 'X', CX, 530, t, 0.3)
    for i, s in enumerate(['성북동 실거주 계획', '분담금 단계적 마련', '몇 년의 기다림 OK']):
        fade_up(base, fit_row(s), CX, 720 + i * 136, t, 1.0 + i * 0.2)
    fade_up(base, text_sprite((('→ 5억이 ', WHITE), ('‘시작하기 좋은 금액’', ACC)), 48, 'B', WHITE),
            CX, 1150, t, 1.9, dist=20)


STAMP_CY = 700
STAMP_TXT = '재개발 추천'


def s11(base, t):  # 55–60  엔딩
    drop0 = 0.15
    land = drop0 + 0.09 * 4 + 0.9  # 마지막 글자 착지 (도장이 먼저, 위 문구는 착지 뒤)
    line_mask(base, text_sprite('분양자격 확인이 먼저', 62, 'M', SOFT), CX, 340, t, land + 0.05)
    line_mask(base, text_sprite('성북동 새집의 기회', 96, 'B', WHITE), CX, 460, t, land + 0.2)
    pb = prog(t, land - 0.1, 0.5)
    if pb > 0:
        sw = int(tlen(STAMP_TXT, 170, 'X') + 110)
        frame = rrect(sw, 250, 40, (127, 227, 255, 26), tuple(ACC) + (255,), 7)
        blit(base, frame, CX, STAMP_CY + 4, 'c', alpha=clamp(pb / 0.3), scale=0.85 + 0.15 * back_out(pb))
    drop_bounce(base, STAMP_TXT, 170, 'X', ACC, CX, STAMP_CY, t, drop0)
    ring(base, CX, STAMP_CY, t, land - 0.05, dur=0.9, r0=200, r1=640, w0=14)
    sparkles(base, CX, STAMP_CY, t, land, [(-470, -150, 54), (455, -140, 40), (-430, 150, 36),
                                           (480, 130, 58), (-160, -175, 30), (210, 168, 34)])
    pd = prog(t, land + 0.2, 0.5)
    if pd > 0:
        blit(base, rrect(max(2, int(120 * ease_out(pd))), 4, 2, (255, 255, 255, 120)), CX, 905, 'c')
    if t >= land + 0.3:
        a = ease_out(prog(t, land + 0.3, 0.4))
        CTX_alpha_save = CTX.alpha
        CTX.alpha = CTX_alpha_save * a
        wave_text(base, '쌤태리부동산컨설팅', 68, 'B', WHITE, CX, 990, t, land + 0.5)
        CTX.alpha = CTX_alpha_save
    fade_up(base, text_sprite('궁금한 점은 언제든 편하게 문의주세요', 40, 'M', SOFT), CX, 1085, t, land + 0.7, dist=20)


# (길이, 함수, 자막[(시작,끝,문구)] — 장면 기준 초)
SCENES = [
    (4, s1, [(0.0, 4.0, '서울 도심에서 새집을\n5억으로 시작할 수 있을까요?')]),
    (4, s2, [(0.0, 4.0, '이 매물의 땅은 2.42평,\n사는 것은 ‘새집을 받을 권리’입니다')]),
    (7, s3, [(0.0, 3.5, '분양가 15억을 가정하고\n끝까지 계산해 보면'),
             (3.5, 7.0, '5억은 입장권일 뿐,\n총투자금은 약 19억 6천만 원입니다')]),
    (4, s4, [(0.0, 4.0, '그래서 물어야 할 질문은\n‘프리미엄 4억 6천이 적정한가’입니다')]),
    (7, s5, [(0.0, 3.5, '최근 실거래 10건은 땅 크기와 상관없이\n모두 5억 2천만 원 이상에 거래됐습니다'),
             (3.5, 7.0, '권리가 확실하면 최저가보다 2천만 원 싼 셈,\n확실하지 않다면 가장 위험한 가격입니다')]),
    (5, s6, [(0.0, 2.5, '서울 동북권 단독주택 가격지수는\n11개월 연속 올랐지만'),
             (2.5, 5.0, '이 일대 소형 주택은 거의 제자리,\n사업 변화의 기대가 아직 덜 얹혀 있습니다')]),
    (6, s7, [(0.0, 3.0, '추천 포인트 첫째,\n구역 전체가 전면 철거형으로 바뀌었습니다'),
             (3.0, 6.0, '공동주택 496세대,\n사업 방식이 하나로 정리됐습니다')]),
    (6, s8, [(0.0, 3.0, '둘째, 결합개발 짝꿍인 신월곡1구역이\n먼저 달리고 있습니다'),
             (3.0, 6.0, '최고 47층·약 2,200세대,\n이주도 사실상 마무리 단계입니다')]),
    (6, s9, [(0.0, 3.0, '다만 도장 찍기 전,\n이 다섯 가지는 꼭 확인하세요'),
             (3.0, 6.0, '특히 무허가주택의 분양자격은\n계약 전에 서면으로 확인해야 합니다')]),
    (6, s10, [(0.0, 3.0, '성북동에 실제로 살 계획이 있고\n분담금을 단계적으로 마련할 수 있는 분'),
              (3.0, 6.0, '몇 년의 기다림을 견딜 수 있다면\n5억은 시작하기 좋은 금액이 될 수 있습니다')]),
    (5, s11, [(0.0, 2.6, '가격 협상보다 분양자격 확인이 먼저,\n그다음은 성북동 새집의 기회입니다'),
              (2.6, 5.0, '궁금한 점은 언제든\n편하게 연락주세요')]),
]
STARTS = []
_acc = 0
for _d, _f, _c in SCENES:
    STARTS.append(_acc)
    _acc += _d
TOTAL = float(_acc)


def render_frame(idx, t):
    dur, fn, cues = SCENES[idx]
    T = STARTS[idx] + t
    base = BG.copy()
    draw_ambient(base, T)
    draw_ui(base, T)
    last = idx == len(SCENES) - 1
    if not last and t > dur - EXIT:
        e = ease_in_out(prog(t, dur - EXIT, EXIT))
        CTX.alpha, CTX.dy = 1 - e, -36 * e
    else:
        CTX.alpha, CTX.dy = 1.0, 0.0
    fn(base, t)
    CTX.alpha, CTX.dy = 1.0, 0.0
    draw_subtitle(base, cues, t)
    return base


def encode_scene(args):
    idx, out_dir = args
    init_assets()
    dur = SCENES[idx][0]
    n = int(round(dur * FPS))
    final = os.path.join(out_dir, f'scene_{idx + 1:02d}.mp4')
    tmp = os.path.join(out_dir, f'scene_{idx + 1:02d}.tmp.mp4')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
           '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
           '-r', str(FPS), '-movflags', '+faststart', '-f', 'mp4', tmp]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for k in range(n):
        frame = render_frame(idx, k / FPS)
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f'ffmpeg failed for scene {idx + 1}')
    os.replace(tmp, final)
    return final


def fmt_srt(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def write_srt(path):
    lines, n = [], 1
    for idx, (dur, fn, cues) in enumerate(SCENES):
        for (s, e, text) in cues:
            lines.append(str(n))
            lines.append(f'{fmt_srt(STARTS[idx] + s)} --> {fmt_srt(STARTS[idx] + e)}')
            lines.append(text)
            lines.append('')
            n += 1
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def main():
    mode, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    if mode == 'stills':
        init_assets()
        # 장면별로 요소가 가장 많은 순간(퇴장 직전)
        for idx, (dur, fn, cues) in enumerate(SCENES):
            tt = float(sys.argv[3]) if len(sys.argv) > 3 else dur - EXIT - 0.05
            render_frame(idx, min(tt, dur - 0.01)).save(os.path.join(out_dir, f'still_{idx + 1:02d}.png'))
        return
    if mode == 'frame':  # 특정 전체 시각의 프레임
        init_assets()
        T = float(sys.argv[3])
        idx = max(i for i, s in enumerate(STARTS) if s <= T)
        render_frame(idx, T - STARTS[idx]).save(os.path.join(out_dir, f'frame_{T:05.2f}.png'))
        return
    if mode == 'render':
        which = [int(a) - 1 for a in sys.argv[3:]] or list(range(len(SCENES)))
        with Pool(min(4, len(which))) as pool:
            for path in pool.imap_unordered(encode_scene, [(i, out_dir) for i in which]):
                print('done', os.path.basename(path), flush=True)
        lst = os.path.join(out_dir, 'concat.txt')
        with open(lst, 'w') as f:
            for i in range(len(SCENES)):
                f.write(f"file 'scene_{i + 1:02d}.mp4'\n")
        final = os.path.join(out_dir, 'seongbuk2_redevelopment_60s.mp4')
        tmp = final + '.tmp.mp4'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
                        '-c', 'copy', '-movflags', '+faststart', tmp], check=True)
        os.replace(tmp, final)
        write_srt(os.path.join(out_dir, 'seongbuk2_redevelopment_60s.srt'))
        print('final', final)


if __name__ == '__main__':
    main()
