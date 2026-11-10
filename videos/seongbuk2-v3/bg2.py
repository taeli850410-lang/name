"""v2 배경: 흐르는 오로라 그라데이션 + 필름 그레인 + 설계도 격자 + 성북동 라인아트 풍경 + 장면 번호 고스트 숫자."""
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import render as R
from render import ACC, CTX, H, PAD, SOFT, W, WHITE, blit, blit_at, circle, clamp, ease_out, font, prog, rrect, tlen

LW, LH = 270, 480
_YY, _XX = np.mgrid[0:LH, 0:LW].astype(np.float32)
BLOBS = [  # 색, 반경(높이 비율), 중심x, 중심y, 흔들림x, 흔들림y, 주기, 위상, 세기
    ((70, 200, 255), 0.30, 0.88, 0.10, 0.10, 0.05, 23, 0.0, 0.40),
    ((92, 76, 236), 0.34, 0.08, 0.42, 0.08, 0.09, 29, 1.7, 0.36),
    ((38, 168, 214), 0.28, 0.72, 0.74, 0.12, 0.07, 19, 3.1, 0.28),
    ((24, 70, 180), 0.42, 0.30, 0.98, 0.10, 0.04, 31, 4.2, 0.40),
]
BASE_LR = GRAIN = GRID = VIGNETTE = None
SKY = []
RINGS = []


def build_grid():
    step = 72
    m = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(m)
    for x in range(step // 2, W, step):
        d.line([(x, 0), (x, H)], fill=255, width=1)
    for y in range(step // 2, H, step):
        d.line([(0, y), (W, y)], fill=255, width=1)
    for y in range(step // 2, H, step * 4):
        for x in range(step // 2, W, step * 4):
            d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=255)
    g = Image.new('L', (1, H))
    for y in range(H):
        k = y / H
        g.putpixel((0, y), int(14 + 16 * k))  # 아래로 갈수록 조금 진하게
    g = g.resize((W, H))
    a = Image.fromarray((np.asarray(m, np.uint16) * np.asarray(g, np.uint16) // 255).astype(np.uint8))
    im = Image.new('RGBA', (W, H), (170, 215, 255, 0))
    im.putalpha(a)
    return im


def build_vignette():
    yy, xx = np.mgrid[0:H // 4, 0:W // 4].astype(np.float32)
    cx, cy = W / 8, H / 8 * 0.9
    d = np.sqrt(((xx - cx) / (W / 8)) ** 2 + ((yy - cy) / (H / 8)) ** 2)
    a = np.clip((d - 0.75) / 0.6, 0, 1) ** 1.5 * 110
    im = Image.new('RGBA', (W // 4, H // 4), (2, 8, 26, 0))
    im.putalpha(Image.fromarray(a.astype(np.uint8)))
    return im.resize((W, H), Image.BILINEAR)


def _ridge(width, base_y, amp, seed, peaks):
    rnd = random.Random(seed)
    ph = [rnd.random() * 6.28 for _ in range(3)]
    pts = []
    for x in range(0, width + 1, 8):
        u = x / width
        y = base_y
        y -= amp * (0.35 * math.sin(u * 7 + ph[0]) + 0.2 * math.sin(u * 17 + ph[1]) + 0.08 * math.sin(u * 41 + ph[2]))
        for (pu, ph_, pw) in peaks:
            y -= ph_ * math.exp(-((u - pu) / pw) ** 2)
        pts.append((x, y))
    return pts


def build_skyline():
    """하단 풍경 라인아트: 북악산 능선(뒤) · 계단식 저층 단지(가운데) · 주택과 나무(앞)."""
    Wd, Hd = W + 160, 520
    S = 2
    layers = []
    # 1) 능선 두 겹
    im = Image.new('RGBA', (Wd * S, Hd * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for k, (by, amp, fill, line, peaks) in enumerate([
        (250, 40, (120, 175, 255, 22), (165, 210, 255, 55), [(0.62, 120, 0.10), (0.80, 70, 0.08)]),
        (300, 30, (90, 150, 245, 30), (150, 200, 255, 70), [(0.30, 60, 0.12), (0.52, 85, 0.07)]),
    ]):
        pts = [(x * S, y * S) for x, y in _ridge(Wd, by, amp, 11 + k, peaks)]
        d.polygon(pts + [(Wd * S, Hd * S), (0, Hd * S)], fill=fill)
        d.line(pts, fill=line, width=2 * S)
    layers.append((im.resize((Wd, Hd), Image.LANCZOS), H - Hd, 25, 41))
    # 2) 계단식 저층 단지
    im = Image.new('RGBA', (Wd * S, Hd * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rnd = random.Random(7)
    x = 20
    while x < Wd - 60:
        bw = rnd.randint(110, 170)
        floors = rnd.randint(3, 4)
        fh = 30
        base_y = Hd - rnd.randint(60, 110)
        for f in range(floors):  # 위층일수록 뒤로 물러나는 테라스형
            inset = f * 14
            y1 = base_y - f * fh
            d.rectangle([(x + inset) * S, (y1 - fh) * S, (x + bw - inset * 0.4) * S, y1 * S],
                        fill=(10, 30, 82, 215), outline=(150, 205, 255, 80), width=2 * S)
            for wx in range(int(x + inset + 12), int(x + bw - inset * 0.4 - 10), 18):
                lit = rnd.random() < 0.18
                col = (127, 227, 255, 150) if lit else (150, 200, 255, 38)
                d.rectangle([wx * S, (y1 - fh + 9) * S, (wx + 8) * S, (y1 - 9) * S], fill=col)
        d.rectangle([x * S, base_y * S, (x + bw) * S, Hd * S], fill=(10, 30, 82, 215))
        x += bw + rnd.randint(30, 70)
    layers.append((im.resize((Wd, Hd), Image.LANCZOS), H - Hd, 45, 37))
    # 3) 앞쪽 주택·나무
    im = Image.new('RGBA', (Wd * S, Hd * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rnd = random.Random(3)
    x = 0
    while x < Wd:
        if rnd.random() < 0.35:
            r = rnd.randint(18, 30)
            cy = Hd - 40 - r
            d.ellipse([(x) * S, (cy - r) * S, (x + 2 * r) * S, (cy + r) * S], fill=(8, 34, 70, 235),
                      outline=(120, 220, 200, 70), width=2 * S)
            d.line([(x + r) * S, (cy + r) * S, (x + r) * S, (Hd - 30) * S], fill=(120, 220, 200, 70), width=2 * S)
            x += 2 * r + rnd.randint(6, 20)
            continue
        hw = rnd.randint(70, 110)
        hh = rnd.randint(42, 64)
        gy = Hd - 30
        d.rectangle([x * S, (gy - hh) * S, (x + hw) * S, gy * S], fill=(6, 22, 58, 240), outline=(150, 205, 255, 75), width=2 * S)
        d.polygon([(x - 8) * S, (gy - hh) * S, (x + hw / 2) * S, (gy - hh - 30) * S, (x + hw + 8) * S, (gy - hh) * S],
                  fill=(6, 22, 58, 240), outline=(150, 205, 255, 75))
        d.rectangle([(x + hw * 0.6) * S, (gy - 30) * S, (x + hw * 0.6 + 16) * S, gy * S], fill=(127, 227, 255, 60))
        x += hw + rnd.randint(16, 40)
    d.rectangle([0, (Hd - 30) * S, Wd * S, Hd * S], fill=(6, 20, 52, 245))
    d.line([0, (Hd - 30) * S, Wd * S, (Hd - 30) * S], fill=(150, 205, 255, 80), width=2 * S)
    layers.append((im.resize((Wd, Hd), Image.LANCZOS), H - Hd + 40, 70, 33))
    return layers


def init():
    global BASE_LR, GRAIN, GRID, VIGNETTE, SKY, RINGS
    k = _XX / LW * 0.35 + _YY / LH * 0.65
    c0 = np.array([4, 15, 44], np.float32)
    c1 = np.array([16, 54, 142], np.float32)
    BASE_LR = c0 + (c1 - c0) * k[..., None]
    rng = np.random.default_rng(5)
    GRAIN = [rng.normal(0, 3.0, (H, W)).astype(np.int16)]
    GRID = build_grid()
    VIGNETTE = build_vignette()
    SKY = build_skyline()
    rnd = random.Random(9)
    RINGS = [(rnd.uniform(60, W - 60), rnd.uniform(200, 1150), rnd.uniform(26, 80), rnd.uniform(8, 18),
              rnd.uniform(0, 6.28)) for _ in range(7)]


_RING_CACHE = {}


def ring_sprite(r):
    r = int(r)
    if r not in _RING_CACHE:
        S = 3
        im = Image.new('RGBA', (2 * r * S + 8, 2 * r * S + 8), (0, 0, 0, 0))
        ImageDraw.Draw(im).ellipse([4, 4, 4 + 2 * r * S, 4 + 2 * r * S], outline=(190, 225, 255, 255), width=2 * S)
        im = im.resize((2 * r + 3, 2 * r + 3), Image.LANCZOS)
        im.info['pad'] = 0
        _RING_CACHE[r] = im
    return _RING_CACHE[r]


def draw_bg(T):
    f = BASE_LR.copy()
    for (col, r, cx, cy, ax, ay, per, ph, st) in BLOBS:
        bx = (cx + ax * math.sin(2 * math.pi * T / per + ph)) * LW
        by = (cy + ay * math.cos(2 * math.pi * T / (per * 1.3) + ph)) * LH
        a = st * np.exp(-((_XX - bx) ** 2 + (_YY - by) ** 2) / (r * LH) ** 2)
        f += (np.array(col, np.float32) - f) * a[..., None]
    img = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    arr = np.asarray(img, dtype=np.int16) + GRAIN[0][..., None]
    base = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    base.paste(GRID, (0, 0), GRID)
    # 천천히 지나가는 빛줄기
    period = 11.0
    x = -900 + ((T % period) / period) * (W + 900)
    base.paste(R.BEAM, (int(x), 0), R.BEAM)
    # 떠다니는 얇은 링
    for (rx, ry, rr, sp, ph) in RINGS:
        y = ry - (T * sp) % 260 + 130 * math.sin(T * 0.2 + ph) * 0.2
        a = 0.10 + 0.06 * math.sin(T * 0.7 + ph)
        blit(base, ring_sprite(rr), rx + 18 * math.sin(T * 0.3 + ph), y, 'c', alpha=a, use_ctx=False)
    # 하단 성북동 풍경(시차 이동)
    for (spr, y, amp, per) in SKY:
        xo = int(-80 + amp * math.sin(2 * math.pi * T / per))
        base.paste(spr, (xo, y), spr)
    base.paste(VIGNETTE, (0, 0), VIGNETTE)
    return base


_GHOST = {}


def ghost_sprite(n):
    if n not in _GHOST:
        f = font('X', 470)
        txt = f'{n:02d}'
        w = int(f.getlength(txt)) + 40
        asc, desc = f.getmetrics()
        im = Image.new('RGBA', (w, asc + desc + 40), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((20, 20), txt, font=f, fill=(0, 0, 0, 0), stroke_width=3,
                                stroke_fill=(200, 230, 255, 255), anchor='la')
        im.info['pad'] = 20
        _GHOST[n] = im
    return _GHOST[n]


def draw_ghost(base, n, t):
    """장면 번호를 크게, 아주 옅게 겹쳐 쓰는 잡지식 레이아웃."""
    p = prog(t, 0.0, 0.8)
    e = ease_out(p)
    blit(base, ghost_sprite(n), W - 20 + (1 - e) * 120, 360, 'r', alpha=0.11 * e)


def draw_index(base, n, total):
    spec = ((f'{n:02d}', ACC), (f' / {total:02d}', SOFT))
    spr = R.text_sprite(spec, 30, 'B', WHITE, shadow=False)
    w = tlen(f'{n:02d} / {total:02d}', 30, 'B')
    blit(base, spr, W - 60 - w, 128, 'l', use_ctx=False)


_ONAIR = None


def onair_pill():
    global _ONAIR
    if _ONAIR is None:
        tw = tlen('ON AIR', 24, 'X')
        w = int(tw + 150)
        im = Image.new('RGBA', (w, 44), (0, 0, 0, 0))
        im.alpha_composite(rrect(w, 44, 22, (4, 14, 40, 215), (255, 255, 255, 60), 2))
        ts = R.text_sprite('ON AIR', 24, 'X', WHITE, shadow=False)
        im.alpha_composite(ts, (40 - PAD, 22 - (ts.height - 2 * PAD) // 2 - PAD))
        im.info['pad'] = 0
        _ONAIR = im
    return _ONAIR


def draw_onair(base, x, y, T, talk, alpha=1.0):
    """'ON AIR' 표시 + 목소리 크기에 맞춰 움직이는 소리 막대."""
    if alpha <= 0:
        return
    pill = onair_pill()
    blit_at(base, pill, x, y, alpha, use_ctx=False)
    pulse = 0.55 + 0.45 * (0.5 + 0.5 * math.sin(T * 6.0))
    dot = circle(14, (255, 82, 92, 255))
    blit_at(base, dot, x + 16, y + 15, alpha * pulse, use_ctx=False)
    bx = x + pill.width - 92
    for i in range(5):
        hgt = 6 + 20 * clamp(talk * (0.55 + 0.45 * math.sin(T * 13 + i * 1.7)))
        bar = rrect(6, max(6, int(hgt)), 3, tuple(ACC) + (255,))
        blit_at(base, bar, bx + i * 14, y + 22 - hgt / 2, alpha, use_ctx=False)
