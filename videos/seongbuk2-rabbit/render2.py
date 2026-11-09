#!/usr/bin/env python3
"""성북2구역 재개발 추천 v2 — 토끼 캐릭터가 소개하는 9:16 모션그래픽 (여자 목소리 내레이션).

장면 길이는 내레이션 길이에 맞춰 정해진다(voice/manifest.json). 없으면 글자 수로 추정한다.
  python3 render2.py stills OUT          # 장면별 정지 화면
  python3 render2.py frame OUT 12.5      # 특정 시각 프레임
  python3 render2.py render OUT [n ...]  # 렌더 + 합치기 (+ voice·music 있으면 믹스)
"""
import json
import math
import os
import re
import subprocess
import sys
import wave
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import render as R  # noqa: E402  (v1 효과 라이브러리 재사용)
import bg2  # noqa: E402
from render import (ACC, CTX, FPS, H, NAVY, PAD, SOFT, W, WHITE, back_out, badge, blit,  # noqa: E402
                    blit_at, check_icon, clamp, counter, ease_in_out, ease_out, fade_up, font,
                    line_mask, pop, prog, ring, rrect, snap_line, sparkles, text_sprite, tlen,
                    underline, wave_text)

ASSET = os.path.join(HERE, 'assets')
VOICE_DIR = os.path.join(HERE, 'voice')
CX = W / 2
LEAD, TAIL, END_TAIL = 0.3, 0.45, 2.6


# ───────────────────────── 대본 (말풍선 단위) ─────────────────────────
SCRIPT = [
    ['안녕하십니까,\n쌤태리부동산컨설팅입니다.', '서울 도심에서 새집을\n5억으로 시작할 수 있을까요?'],
    ['오늘 소개할 매물은\n성북2구역 무허가주택입니다.', '땅은 2.42평이지만, 사는 것은\n‘새집을 받을 권리’입니다.'],
    ['분양가 15억을 가정하면\n총투자금은 약 19억 6천만 원.', '따라서 프리미엄 4억 6천만 원이\n적정한지가 핵심입니다.'],
    ['최근 실거래 10건은 모두\n5억 2천만 원 이상이었습니다.', '지역 집값은 올랐지만,\n이 일대는 아직 제자리입니다.'],
    ['추천 포인트 첫째,\n구역 전체가 전면 철거형으로 바뀌어', '496세대 공동주택으로\n사업이 정리됐습니다.'],
    ['둘째, 결합 상대인\n신월곡1구역은', '최고 47층, 약 2,200세대 규모로\n이주가 마무리 단계입니다.'],
    ['다만 계약 전에는\n분양자격, 분양가, 대출,', '사업기간, 세금.', '이 다섯 가지를\n반드시 확인하셔야 합니다.'],
    ['성북동 실거주 계획이 있고,\n분담금을 나눠 마련하며', '기다릴 수 있는 분께\n추천합니다.'],
    ['분양자격 확인이 먼저입니다.', '궁금한 점은 언제든\n문의해 주십시오.'],
]


def narration_text(i):
    return ' '.join(c.replace('\n', ' ') for c in SCRIPT[i])


def est_dur(text):
    syl = len(re.findall(r'[가-힣]', text)) + 1.6 * len(re.findall(r'\d', text))
    pauses = len(re.findall(r'[,.!?]', text))
    return syl / 6.6 + 0.18 * pauses


def load_timing():
    """장면별 (길이, [(말풍선 시작, 끝)...]) — 장면 기준 초."""
    man = None
    mp = os.path.join(VOICE_DIR, 'manifest.json')
    if os.path.exists(mp):
        with open(mp, encoding='utf-8') as f:
            man = json.load(f)
    scenes = []
    for i, chunks in enumerate(SCRIPT):
        if man:
            sp = man['scenes'][i]['dur']
            bounds = man['scenes'][i]['chunks']
        else:
            ds = [est_dur(c) for c in chunks]
            sp = sum(ds)
            bounds, acc = [], 0.0
            for d in ds:
                bounds.append((acc, acc + d))
                acc += d
        tail = END_TAIL if i == len(SCRIPT) - 1 else TAIL
        dur = LEAD + sp + tail
        scenes.append((dur, [(LEAD + a, LEAD + b) for a, b in bounds], LEAD, sp))
    return scenes, man is not None


TIMING, HAS_VOICE = load_timing()
STARTS = []
_acc = 0.0
for _d, *_ in TIMING:
    STARTS.append(_acc)
    _acc += _d
TOTAL = _acc
R.TOTAL = TOTAL

CHUNKS = []  # (T0, T1, text) 전역 시각
for _i, (_d, _b, _l, _s) in enumerate(TIMING):
    for (_a, _e), _txt in zip(_b, SCRIPT[_i]):
        CHUNKS.append((STARTS[_i] + _a, STARTS[_i] + _e, _txt))


# ───────────────────────── 이징·합성 보조 ─────────────────────────
def bezier(p1x, p1y, p2x, p2y):
    def f(x):
        if x <= 0:
            return 0.0
        if x >= 1:
            return 1.0
        t = x
        for _ in range(8):
            bx = 3 * (1 - t) ** 2 * t * p1x + 3 * (1 - t) * t * t * p2x + t ** 3 - x
            dx = 3 * (1 - t) ** 2 * p1x + 6 * (1 - t) * t * (p2x - p1x) + 3 * t * t * (1 - p2x)
            if abs(dx) < 1e-6:
                break
            t = clamp(t - bx / dx)
        return 3 * (1 - t) ** 2 * t * p1y + 3 * (1 - t) * t * t * p2y + t ** 3
    return f


natural = bezier(0.4, 0, 0.2, 1)


class sub_ctx:
    """그 안에서 그리는 요소의 투명도·위치를 함께 바꾼다(단계 전환용)."""
    def __init__(self, a=1.0, dy=0.0):
        self.a, self.dy = a, dy

    def __enter__(self):
        self.sa, self.sd = CTX.alpha, CTX.dy
        CTX.alpha *= self.a
        CTX.dy += self.dy

    def __exit__(self, *exc):
        CTX.alpha, CTX.dy = self.sa, self.sd


def phase_out(t, tb, dur=0.3):
    e = ease_in_out(prog(t, tb - 0.1, dur))
    return sub_ctx(1 - e, -40 * e), e


# ───────────────────────── 사진 ─────────────────────────
@lru_cache(maxsize=8)
def src(name):
    return Image.open(os.path.join(ASSET, name)).convert('RGB')


@lru_cache(maxsize=None)
def round_mask(w, h, r):
    S = 3
    m = Image.new('L', (w * S, h * S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w * S - 1, h * S - 1], radius=r * S, fill=255)
    return m.resize((w, h), Image.LANCZOS)


@lru_cache(maxsize=None)
def card_shadow(w, h, r):
    p = 40
    im = Image.new('RGBA', (w + 2 * p, h + 2 * p), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([p, p + 12, p + w, p + h + 12], radius=r, fill=(2, 10, 35, 120))
    im = im.filter(ImageFilter.GaussianBlur(18))
    im.info['pad'] = 0
    return im


@lru_cache(maxsize=None)
def scrim(w, h):
    g = Image.new('L', (1, h))
    for y in range(h):
        g.putpixel((0, y), int(185 * (y / (h - 1)) ** 1.6))
    im = Image.new('RGBA', (w, h), (3, 12, 34, 0))
    im.putalpha(g.resize((w, h)))
    return im


@lru_cache(maxsize=None)
def label_pill(text, size=26):
    tw = int(tlen(text, size, 'M'))
    im = Image.new('RGBA', (tw + 36, size + 22), (0, 0, 0, 0))
    im.alpha_composite(rrect(tw + 36, size + 22, (size + 22) // 2, (3, 12, 34, 170)))
    ts = text_sprite(text, size, 'M', WHITE, shadow=False)
    im.alpha_composite(ts, (18 - PAD, (size + 22 - (ts.height - 2 * PAD)) // 2 - PAD))
    im.info['pad'] = 0
    return im


def kb_frame(img, w, h, zoom, fx, fy):
    """Ken Burns: 원본에서 w:h 비율 영역을 zoom 배율로 잘라 (w,h)로 맞춘다."""
    iw, ih = img.size
    ar = w / h
    if iw / ih > ar:
        ch, cw = ih, ih * ar
    else:
        cw, ch = iw, iw / ar
    cw, ch = cw / zoom, ch / zoom
    x0 = clamp(fx * iw - cw / 2, 0, iw - cw)
    y0 = clamp(fy * ih - ch / 2, 0, ih - ch)
    return img.resize((w, h), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch))


def card_rgba(im, w, h, r=28):
    out = im.convert('RGBA')
    out.putalpha(round_mask(w, h, r))
    return out


def draw_card(base, im, cx, cy, w, h, t, start, reveal='mask', label=None, r=28, label_pos='tr'):
    """사진 카드: 마스크 리빌(왼→오, natural) 또는 떠오르기. 그림자·외곽선·라벨 포함."""
    p = prog(t, start, 0.9 if reveal == 'mask' else 0.5)
    if p <= 0:
        return
    left, top = cx - w / 2, cy - h / 2
    card = card_rgba(im, w, h, r)
    ol = rrect(w, h, r, (0, 0, 0, 0), (255, 255, 255, 140), 3)
    if reveal == 'mask':
        e = natural(p)
        blit_at(base, card_shadow(w, h, r), left - 40, top - 40, min(1.0, e * 1.4))
        vw = max(1, int(w * e))
        blit_at(base, card.crop((0, 0, vw, h)), left, top)
        if e > 0.98:
            blit_at(base, ol, left, top)
    else:
        e = ease_out(p)
        dy = (1 - e) * 36
        blit_at(base, card_shadow(w, h, r), left - 40, top - 40 + dy, e)
        blit_at(base, card, left, top + dy, e)
        blit_at(base, ol, left, top + dy, e)
    if label:
        lp = prog(t, start + 0.6, 0.4)
        if lp > 0:
            lb = label_pill(label)
            ly = top + 18 if label_pos == 'tr' else top + h - lb.height - 18
            blit_at(base, lb, left + w - lb.width - 18, ly, ease_out(lp))


def squash_swap(imA, imB, w, h, t, ts, dur=0.6, strips=6, stag=0.02):
    """스쿼시&스트레치: A는 위로 납작하게 빨려 올라가고 B는 아래에서 늘어나며 차오른다."""
    out = Image.new('RGB', (w, h))
    sw = w / strips
    for i in range(strips):
        e = ease_in_out(prog(t, ts + i * stag, dur))
        x0, x1 = int(i * sw), int((i + 1) * sw)
        ha = int(round(h * (1 - e)))
        hb = h - ha
        if ha > 0:
            out.paste(imA.crop((x0, 0, x1, h)).resize((x1 - x0, ha), Image.BILINEAR), (x0, 0))
        if hb > 0:
            out.paste(imB.crop((x0, 0, x1, h)).resize((x1 - x0, hb), Image.BILINEAR), (x0, ha))
    return out


@lru_cache(maxsize=4)
def drone_frame(idx):
    n = len(os.listdir(os.path.join(ASSET, 'drone')))
    idx = max(1, min(n, idx))
    return Image.open(os.path.join(ASSET, 'drone', f'{idx:04d}.jpg')).convert('RGB')


# ───────────────────────── 토끼 앵커 ─────────────────────────
RAB_S = 1.5
CROP_H = 470
EXT_L, EXT_B, MARG = 30, 70, 24
MOUTH_SRC = (157, 290)


@lru_cache(maxsize=1)
def rabbit_base():
    im = Image.open(os.path.join(ASSET, 'rabbit_closeup_cut.png')).convert('RGBA').crop((0, 0, 329, CROP_H))
    # 가장자리 흰 테두리 제거: 반투명 픽셀에 섞인 원래 배경색(밝은 회색)을 빼낸다
    arr = np.asarray(im).astype(np.float64)
    al = arr[..., 3:] / 255.0
    bgc = arr[arr[..., 3] == 0][:, :3].mean(0) if np.any(arr[..., 3] == 0) else np.array([238, 240, 245.0])
    edge = (al > 0.03) & (al < 0.97)
    fixed = np.clip((arr[..., :3] - (1 - al) * bgc) / np.maximum(al, 0.03), 0, 255)
    arr[..., :3] = np.where(edge, fixed, arr[..., :3])
    # 가장자리 띠(투명 영역에서 ~5px 안) 안에서 배경색과 거의 같은 픽셀은 투명하게
    a_img = Image.fromarray(arr[..., 3].astype(np.uint8))
    band = (np.asarray(a_img.filter(ImageFilter.MinFilter(11))) < 128) & (arr[..., 3] > 0)
    band[:, :3] = False
    band[-3:, :] = False  # 잘린 왼쪽·아래 가장자리는 건드리지 않는다
    dist = np.sqrt(((arr[..., :3] - bgc) ** 2).sum(-1))
    keep = np.clip((dist - 16) / 22, 0, 1)
    arr[..., 3] = np.where(band, arr[..., 3] * keep, arr[..., 3])
    im = Image.fromarray(arr.astype(np.uint8), 'RGBA')
    w, h = im.size
    a0 = im.getchannel('A')
    a = a0.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    a.paste(a0.crop((0, 0, 4, h)), (0, 0))                # 잘린 왼쪽 가장자리는 그대로
    a.paste(a0.crop((0, h - 4, w, h)), (0, h - 4))        # 잘린 아래 가장자리도
    im.putalpha(a)
    out = Image.new('RGBA', (w + EXT_L + MARG, h + EXT_B + MARG), (0, 0, 0, 0))
    out.paste(im, (EXT_L, MARG))
    out.paste(im.crop((0, 0, 1, h)).resize((EXT_L, h)), (0, MARG))
    row = out.crop((0, MARG + h - 1, out.width, MARG + h))
    out.paste(row.resize((out.width, EXT_B)), (0, MARG + h))
    big = out.resize((int(out.width * RAB_S), int(out.height * RAB_S)), Image.LANCZOS)
    rgb = big.convert('RGB').filter(ImageFilter.UnsharpMask(1.2, 55, 2))
    big = Image.merge('RGBA', (*rgb.split(), big.getchannel('A')))
    return big


def rabbit_mouth(open_amt):
    big = rabbit_base()
    if open_amt < 0.06:
        return big
    im = big.copy()
    mx = (MOUTH_SRC[0] + EXT_L) * RAB_S
    my = (MOUTH_SRC[1] + MARG) * RAB_S
    S = 4
    lw, lh = 90, 70
    layer = Image.new('RGBA', (lw * S, lh * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ow = (21 + 10 * open_amt) * S
    oh = (3 + 19 * open_amt) * S
    cx, cy = lw * S / 2, 14 * S
    d.ellipse([cx - ow / 2, cy - 2 * S, cx + ow / 2, cy + oh], fill=(96, 36, 52, 255))
    tw = ow * 0.62
    d.ellipse([cx - tw / 2, cy + oh * 0.42, cx + tw / 2, cy + oh * 1.02], fill=(234, 126, 140, 255))
    d.ellipse([cx - ow / 2, cy - 2 * S, cx + ow / 2, cy + oh], outline=(150, 70, 84, 255), width=S)
    layer = layer.resize((lw, lh), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.5))
    im.alpha_composite(layer, (int(mx - lw / 2), int(my - 14)))
    return im


ENV = None  # 프레임별 말하기 세기(0~1)


def load_env():
    global ENV
    wp = os.path.join(VOICE_DIR, 'narration.wav')
    n = int(math.ceil(TOTAL * FPS)) + 2
    if not os.path.exists(wp):
        env = np.zeros(n)
        for (a, b, _) in CHUNKS:
            for k in range(int(a * FPS), min(n, int(b * FPS))):
                tt = k / FPS
                env[k] = clamp(0.55 + 0.45 * math.sin(2 * math.pi * 5.1 * tt) * math.sin(2 * math.pi * 1.3 * tt + 1))
        ENV = env
        return
    with wave.open(wp) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32768
        if w.getnchannels() == 2:
            x = x.reshape(-1, 2).mean(1)
    hop = sr / FPS
    env = np.zeros(n)
    for k in range(n):
        a, b = int(k * hop), int((k + 1) * hop)
        seg = x[a:b]
        env[k] = np.sqrt(np.mean(seg ** 2)) if seg.size else 0
    ref = np.percentile(env[env > 1e-4], 90) if np.any(env > 1e-4) else 1
    env = np.clip((env / ref - 0.12) / 0.75, 0, 1)
    sm = np.zeros_like(env)
    v = 0.0
    for k in range(n):
        v = env[k] if env[k] > v else v * 0.55 + env[k] * 0.45
        sm[k] = v
    ENV = sm


def env_at(T):
    k = int(T * FPS)
    return float(ENV[k]) if ENV is not None and 0 <= k < len(ENV) else 0.0


def draw_rabbit(base, T):
    p_in = prog(T, 0.0, 0.8)
    if p_in <= 0:
        return
    e_in = back_out(p_in, 1.4)
    talk = env_at(T)
    im = rabbit_base()
    bob = 5 * math.sin(2 * math.pi * T / 2.6)
    dy = (1 - e_in) * 760 + bob - 6 * talk
    ang = 1.0 * math.sin(2 * math.pi * T / 3.4) + 1.6 * talk * math.sin(2 * math.pi * T * 2.2)
    pivot = ((EXT_L + 165) * RAB_S, (MARG + CROP_H) * RAB_S)
    if abs(ang) > 0.05:
        im = im.rotate(ang, resample=Image.BICUBIC, center=pivot)
    left = -4 - EXT_L * RAB_S
    top = H + 4 - (MARG + CROP_H) * RAB_S + dy
    base.paste(im, (int(round(left)), int(round(top))), im)


# ───────────────────────── 말풍선 자막 ─────────────────────────
BUB = (486, 1262, 1056, 1446)


@lru_cache(maxsize=1)
def bubble_box():
    x0, y0, x1, y1 = BUB
    w, h = x1 - x0, y1 - y0
    S = 3
    tail = 70
    im = Image.new('RGBA', ((w + tail) * S, (h + tail) * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ox = tail * S
    d.rounded_rectangle([ox, 0, ox + w * S, h * S], radius=34 * S, fill=(255, 255, 255, 246))
    d.polygon([(ox + 6 * S, h * S - 70 * S), (ox + 6 * S, h * S - 22 * S), (ox - 52 * S, h * S + 40 * S)],
              fill=(255, 255, 255, 246))
    im = im.resize((w + tail, h + tail), Image.LANCZOS)
    sh = Image.new('RGBA', im.size, (2, 10, 35, 0))
    sh.putalpha(im.getchannel('A').point(lambda v: v * 90 // 255))
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    out = Image.new('RGBA', (im.width, im.height + 10), (0, 0, 0, 0))
    out.alpha_composite(sh, (0, 8))
    out.alpha_composite(im)
    out.info['pad'] = 0
    return out


@lru_cache(maxsize=None)
def bubble_text(text):
    lines = text.split('\n')
    maxw = (BUB[2] - BUB[0]) - 60
    size = 42
    while size > 30 and max(tlen(l, size, 'B') for l in lines) > maxw:
        size -= 1
    lh = int(size * 1.36)
    hgt = lh * len(lines)
    im = Image.new('RGBA', (BUB[2] - BUB[0], hgt + 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = font('B', size)
    for i, l in enumerate(lines):
        lw = f.getlength(l)
        d.text(((im.width - lw) / 2, i * lh + (lh - size) / 2 - 2), l, font=f, fill=tuple(NAVY) + (255,), anchor='la')
    im.info['pad'] = 0
    return im


def draw_bubble(base, T):
    p = prog(T, 0.55, 0.45)
    if p <= 0:
        return
    sc = 0.6 + 0.4 * back_out(p)
    box = bubble_box()
    bx, by = BUB[0] - 70, BUB[1]
    if sc < 0.999:
        bw, bh = int(box.width * sc), int(box.height * sc)
        b2 = box.resize((bw, bh), Image.BICUBIC)
        # 꼬리 끝(왼쪽 아래) 기준으로 커진다
        blit_at(base, b2, bx, by + box.height - bh, clamp(p / 0.3), use_ctx=False)
        return
    blit_at(base, box, bx, by, use_ctx=False)
    cur = None
    for (a, b, txt) in CHUNKS:
        if T >= a - 0.05:
            cur = (a, b, txt)
    if cur is None:
        return
    a, b, txt = cur
    e = ease_out(prog(T, a - 0.05, 0.22))
    ts = bubble_text(txt)
    cy = (BUB[1] + BUB[3]) / 2
    blit_at(base, ts, BUB[0], cy - ts.height / 2 + (1 - e) * 14, e, use_ctx=False)


# ───────────────────────── 장면 ─────────────────────────
def s1(base, t, ch):
    fade_up(base, text_sprite('성북2구역 타운하우스 · 무허가주택', 42, 'M', SOFT), CX, 300, t, 0.1)
    snap_line(base, '서울 도심 새집', 108, 'B', CX, 440, t, 0.2)
    ring(base, CX, 690, t, 0.95, dur=0.9, r1=420)
    snap_line(base, (('5억', ACC),), 300, 'X', CX, 690, t, 0.6)
    snap_line(base, '으로 시작?', 108, 'B', CX, 940, t, 0.95)


CARD_W, CARD_H, CARD_CY = 960, 600, 560


def s2(base, t, ch):
    tb = ch[1][0] - 0.15
    if t < tb + 0.7:
        imA = kb_frame(src('map.webp'), CARD_W, CARD_H, 1.15 + 0.08 * clamp(t / 6), 0.45, 0.53)
    if t < tb:
        draw_card(base, imA, CX, CARD_CY, CARD_W, CARD_H, t, 0.1, label='위치 이해를 돕기 위한 그림')
    else:
        zb = 1.0 + 0.06 * clamp((t - tb) / 5)
        imB = kb_frame(src('alley.webp'), CARD_W, CARD_H, zb, 0.5, 0.55)
        im = squash_swap(imA, imB, CARD_W, CARD_H, t, tb) if t < tb + 0.7 else imB
        card = card_rgba(im, CARD_W, CARD_H)
        left, top = CX - CARD_W / 2, CARD_CY - CARD_H / 2
        blit_at(base, card_shadow(CARD_W, CARD_H, 28), left - 40, top - 40)
        blit_at(base, card, left, top)
        if t > tb + 0.6:
            a = ease_out(prog(t, tb + 0.6, 0.4))
            blit_at(base, scrim(CARD_W, 260), left, top + CARD_H - 260, a)
            blit_at(base, label_pill('노후 저층 주거지 · 예시 이미지'), left + CARD_W - 420, top + 18, a)
            counter(base, '2.42', 130, 'X', ACC, left + 44, top + CARD_H - 90, t, tb + 0.7,
                    prefix=('땅은 단', 56, 'B', WHITE), suffix=('평', 80, 'B', WHITE), anchor='l', gap=14)
    with phase_out(t, tb)[0]:
        line_mask(base, text_sprite('오늘의 매물', 52, 'M', SOFT), CX, 960, t, 0.5)
        line_mask(base, text_sprite('성북2구역 무허가주택', 86, 'B', WHITE), CX, 1075, t, 0.65)
    if t >= tb:
        line_mask(base, text_sprite('사는 건', 52, 'M', SOFT), CX, 950, t, tb + 0.9)
        line_mask(base, text_sprite('‘새집 받을 권리’', 96, 'B', WHITE), CX, 1060, t, tb + 1.05)
        underline(base, CX, 1135, tlen('‘새집 받을 권리’', 96, 'B') * 0.9, t, tb + 1.5)


CALC_ROWS = R.CALC_ROWS


@lru_cache(maxsize=None)
def calc_card2(label, value):
    card = Image.new('RGBA', (920, 98), (0, 0, 0, 0))
    card.alpha_composite(rrect(920, 98, 26, (255, 255, 255, 30), (255, 255, 255, 60), 2))
    ls = text_sprite(label, 40, 'M', SOFT, shadow=False)
    card.alpha_composite(ls, (44 - PAD, 49 - (ls.height - 2 * PAD) // 2 - PAD))
    vs = text_sprite(value, 50, 'B', WHITE, shadow=False)
    vw = int(tlen(value, 50, 'B'))
    card.alpha_composite(vs, (920 - 44 - vw - PAD, 49 - (vs.height - 2 * PAD) // 2 - PAD))
    card.info['pad'] = 0
    return card


@lru_cache(maxsize=None)
def total_card2():
    card = Image.new('RGBA', (920, 180), (0, 0, 0, 0))
    card.alpha_composite(rrect(920, 180, 32, tuple(ACC) + (255,)))
    ls = text_sprite('총투자금 (추정)', 40, 'B', NAVY, shadow=False)
    lw = tlen('총투자금 (추정)', 40, 'B')
    card.alpha_composite(ls, (int(460 - lw / 2) - PAD, 20 - PAD))
    card.info['pad'] = 0
    return card


def s3(base, t, ch):
    tb = ch[1][0]
    ctx, e = phase_out(t, tb)
    if e < 1:
        with ctx:
            line_mask(base, text_sprite('끝까지 계산하면', 84, 'B', WHITE), CX, 290, t, 0.1)
            line_mask(base, text_sprite('분양가 15억 가정', 40, 'M', SOFT), CX, 372, t, 0.25)
            for i, (lab, val) in enumerate(CALC_ROWS):
                fade_up(base, calc_card2(lab, val), CX, 470 + i * 114, t, 0.45 + i * 0.25)
            t0 = 0.45 + 4 * 0.25
            fade_up(base, total_card2(), CX, 1000, t, t0)
            if t >= t0 + 0.2:
                off = (1 - ease_out(prog(t, t0, 0.5))) * 40
                counter(base, '19억 6,152만', 80, 'X', NAVY, CX, 1000 + 30 + off, t, t0 + 0.2,
                        prefix=('약', 44, 'B', NAVY), suffix=('원', 44, 'B', NAVY), gap=14)
            fade_up(base, text_sprite('※ 감정가·분양가는 관리처분 전 추정치', 30, 'M', SOFT), CX, 1140, t, 1.3, dist=20)
    if t >= tb:
        line_mask(base, text_sprite('‘5억이 싸냐’보다', 70, 'M', SOFT), CX, 420, t, tb + 0.15)
        line_mask(base, text_sprite('프리미엄', 110, 'B', WHITE), CX, 585, t, tb + 0.27)
        line_mask(base, text_sprite('4억 6천만 원', 150, 'X', ACC), CX, 765, t, tb + 0.39)
        line_mask(base, text_sprite('적정한지가 핵심', 100, 'B', WHITE), CX, 950, t, tb + 0.51)
        underline(base, CX, 1035, tlen('적정한지가 핵심', 100, 'B') * 0.95, t, tb + 1.1)


DEALS = R.DEALS
B_X0, B_SC, B_Y0, B_STEP, B_H = 262, 66.0, 478, 54, 34


def s4(base, t, ch):
    tb = ch[1][0]
    ctx, e = phase_out(t, tb)
    if e < 1:
        with ctx:
            hs = 84
            w_txt = tlen('최근 실거래 ', hs, 'B')
            f = font('X', hs)
            dw = max(f.getlength(str(d)) for d in range(10))
            w_num = dw * 2 + 14 + tlen('건', hs, 'X')
            left = CX - (w_txt + w_num) / 2
            line_mask(base, text_sprite('최근 실거래', hs, 'B', WHITE), left, 290, t, 0.1, anchor='l')
            counter(base, '10', hs, 'X', ACC, left + w_txt, 290, t, 0.25, dur=1.0, suffix=('건', hs, 'X', ACC), anchor='l')
            fade_up(base, text_sprite('대지 크기와 상관없이 모두 5억 2천만 원 이상', 38, 'M', SOFT), CX, 378, t, 0.5, dist=20)
            lab_x = B_X0 - 22
            for i, (land, val, vtxt) in enumerate(DEALS):
                p = prog(t, 0.75 + i * 0.07, 0.5)
                if p <= 0:
                    continue
                ee = ease_out(p)
                y = B_Y0 + i * B_STEP
                blit(base, text_sprite(land, 29, 'M', SOFT, shadow=False), lab_x, y, 'r', alpha=ee)
                bw = int(val * B_SC * ee)
                if bw > 4:
                    blit(base, rrect(bw, B_H, 10, (255, 255, 255, 215)), B_X0, y, 'l')
                blit(base, text_sprite(vtxt, 29, 'B', WHITE, shadow=False), B_X0 + bw + 14, y, 'l', alpha=ee)
            i = len(DEALS)
            st = 0.75 + i * 0.07 + 0.3
            p = prog(t, st, 0.6)
            lx = B_X0 + 5.2 * B_SC
            if p > 0:
                ee = ease_out(p)
                y = B_Y0 + i * B_STEP + 12
                blit(base, text_sprite('2.42평', 31, 'B', ACC, shadow=False), lab_x, y, 'r', alpha=ee)
                bw = int(5.0 * B_SC * ee)
                if bw > 4:
                    blit(base, rrect(bw, B_H + 8, 12, tuple(ACC) + (255,)), B_X0, y, 'l')
                blit(base, text_sprite('5억 · 이 매물', 33, 'X', ACC, shadow=False),
                     max(B_X0 + bw + 14, lx + 20), y, 'l', alpha=ee)
            pl = prog(t, 1.7, 0.4)
            if pl > 0:
                top, bot = B_Y0 - 28, B_Y0 + len(DEALS) * B_STEP + 36
                seg = Image.new('RGBA', (4, 14), (*ACC, 230))
                y = top
                while y < bot:
                    blit_at(base, seg, lx - 2, y, ease_out(pl))
                    y += 24
                blit(base, text_sprite('최저 5.2억', 29, 'B', ACC, shadow=False), lx, top - 22, 'c', alpha=ease_out(pl))
            fade_up(base, text_sprite('실거래 10건 (2025.5~2026.8) · 대지 = 토지 면적', 28, 'M', SOFT), CX, 1150, t, 2.0, dist=16)
    if t >= tb:
        line_mask(base, text_sprite('서울 동북권 단독주택 지수', 50, 'M', SOFT), CX, 320, t, tb + 0.1)
        counter(base, '+4.1%', 200, 'X', ACC, CX, 490, t, tb + 0.25)
        fade_up(base, text_sprite('97.01 → 101.00 · 11개월 연속 상승', 38, 'M', WHITE), CX, 630, t, tb + 0.8, dist=20)
        pd = prog(t, tb + 1.0, 0.5)
        if pd > 0:
            blit(base, rrect(max(2, int(560 * ease_out(pd))), 3, 1, (255, 255, 255, 90)), CX, 712, 'c')
        line_mask(base, text_sprite('이 일대 소형 주택은', 62, 'M', SOFT), CX, 800, t, tb + 1.1)
        line_mask(base, text_sprite('거의 제자리', 120, 'B', WHITE), CX, 935, t, tb + 1.25)
        fade_up(base, text_sprite('→ 사업 변화 기대가 아직 덜 얹힌 가격', 40, 'B', ACC), CX, 1055, t, tb + 1.6, dist=20)
        fade_up(base, text_sprite('출처: 한국부동산원 단독주택 매매가격지수 (2025.9 → 2026.8)', 27, 'M', SOFT), CX, 1150, t, tb + 1.8, dist=16)


def s5(base, t, ch):
    tb = ch[1][0] - 0.1
    pop(base, badge('추천 포인트 ①'), CX, 285, t, 0.05)
    ctx, e = phase_out(t, tb)
    if e < 1:
        with ctx:
            im = kb_frame(src('banner.webp'), 960, 640, 1.0 + 0.06 * clamp(t / 6), 0.5, 0.5)
            draw_card(base, im, CX, 720, 960, 640, t, 0.25, label='성북2구역 현장')
            line_mask(base, text_sprite((('구역 전체 ', WHITE), ('전면 철거형', ACC), ('으로', WHITE)), 64, 'B', WHITE),
                      CX, 1115, t, 0.9)
    if t >= tb:
        im = kb_frame(src('compare.webp'), 960, 720, 1.0 + 0.04 * clamp((t - tb) / 5), 0.5, 0.5)
        draw_card(base, im, CX, 735, 960, 720, t, tb + 0.15)
        counter(base, '496', 84, 'X', ACC, CX, 1150, t, tb + 0.7, suffix=('세대 공동주택으로 정리', 50, 'B', WHITE), gap=12)


@lru_cache(maxsize=None)
def zone_pill(title, sub):
    w, h = 400, 158
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    im.alpha_composite(rrect(w, h, 34, (255, 255, 255, 34), (255, 255, 255, 80), 2))
    ts = text_sprite(title, 48, 'B', WHITE, shadow=False)
    tw = tlen(title, 48, 'B')
    im.alpha_composite(ts, (int(w / 2 - tw / 2) - PAD, 30 - PAD))
    ss = text_sprite(sub, 32, 'M', SOFT, shadow=False)
    sw = tlen(sub, 32, 'M')
    im.alpha_composite(ss, (int(w / 2 - sw / 2) - PAD, 98 - PAD))
    im.info['pad'] = 0
    return im


@lru_cache(maxsize=None)
def stat_tile2():
    tile = Image.new('RGBA', (440, 196), (0, 0, 0, 0))
    tile.alpha_composite(rrect(440, 196, 32, (255, 255, 255, 30), (255, 255, 255, 64), 2))
    tile.info['pad'] = 0
    return tile


def s6(base, t, ch):
    pop(base, badge('추천 포인트 ②'), CX, 285, t, 0.05)
    snap_line(base, '짝꿍 구역이', 96, 'B', CX, 410, t, 0.3)
    snap_line(base, '먼저 달린다', 96, 'B', CX, 525, t, 0.45)
    fade_up(base, zone_pill('성북2구역', '최고 4층 · 저층 주거'), 255, 700, t, 0.9)
    fade_up(base, zone_pill('신월곡1구역', '최고 47층 · 고밀 개발'), 825, 700, t, 1.1)
    pa = prog(t, 1.35, 0.6)
    if pa > 0:
        ea = ease_out(pa)
        x0, x1 = 462, 618
        xe = x0 + (x1 - x0) * ea
        blit(base, rrect(max(2, int(xe - x0)), 8, 4, tuple(ACC) + (255,)), x0, 700, 'l')
        tri = Image.new('RGBA', (30, 36), (0, 0, 0, 0))
        ImageDraw.Draw(tri).polygon([(0, 0), (30, 18), (0, 36)], fill=tuple(ACC) + (255,))
        tri.info['pad'] = 0
        blit(base, tri, xe - 4, 700, 'l', alpha=ea)
        blit(base, text_sprite('밀도 이전', 28, 'B', ACC, shadow=False), (x0 + x1) / 2, 650, 'c', alpha=ea)
    tb = ch[1][0]
    for k, (tx, lab) in enumerate([(300, '최고'), (780, '세대 수 (약)')]):
        st = tb + k * 0.1
        fade_up(base, stat_tile2(), tx, 935, t, st)
        if t >= st:
            off = (1 - ease_out(prog(t, st, 0.5))) * 40
            fade_up(base, text_sprite(lab, 36, 'M', SOFT, shadow=False), tx, 875, t, st)
            if k == 0:
                counter(base, '47', 120, 'X', ACC, tx, 965 + off, t, st + 0.15, suffix=('층', 56, 'B', WHITE))
            else:
                counter(base, '2,200', 92, 'X', ACC, tx, 965 + off, t, st + 0.15, suffix=('세대', 46, 'B', WHITE), gap=8)
    pc = prog(t, tb + 1.3, 0.5)
    if pc > 0:
        e = ease_out(pc)
        txt = '이주 사실상 마무리 단계'
        tw = tlen(txt, 50, 'B')
        left = CX - (tw + 70) / 2
        blit(base, check_icon(50, tuple(ACC) + (255,), tuple(NAVY) + (255,)), left + 25, 1105 + (1 - e) * 30, 'c', alpha=e)
        blit(base, text_sprite(txt, 50, 'B', WHITE), left + 70, 1105 + (1 - e) * 30, 'l', alpha=e)
    fade_up(base, text_sprite('2026.07 사업시행변경인가 고시 보도 기준', 27, 'M', SOFT), CX, 1172, t, tb + 1.6, dist=14)


CHECKS = R.CHECKS


@lru_cache(maxsize=None)
def check_row2(i, text):
    row = Image.new('RGBA', (900, 96), (0, 0, 0, 0))
    row.alpha_composite(rrect(900, 96, 26, (255, 255, 255, 28), (255, 255, 255, 56), 2))
    row.alpha_composite(rrect(60, 60, 18, tuple(ACC) + (255,)), (22, 18))
    ns = text_sprite(str(i + 1), 38, 'X', NAVY, shadow=False)
    nw = tlen(str(i + 1), 38, 'X')
    row.alpha_composite(ns, (int(52 - nw / 2) - PAD, 48 - (ns.height - 2 * PAD) // 2 - PAD))
    ts = text_sprite(text, 44, 'B', WHITE, shadow=False)
    row.alpha_composite(ts, (106 - PAD, 48 - (ts.height - 2 * PAD) // 2 - PAD))
    row.info['pad'] = 0
    return row


def s7(base, t, ch):
    line_mask(base, text_sprite('도장 찍기 전', 62, 'M', SOFT), CX, 290, t, 0.1)
    line_mask(base, text_sprite((('꼭 확인할 ', WHITE), ('5가지', ACC)), 96, 'B', WHITE), CX, 400, t, 0.22)
    span = max(1.5, ch[1][1] - ch[0][0] - 0.6)
    for i, s in enumerate(CHECKS):
        fade_up(base, check_row2(i, s), CX, 545 + i * 116, t, ch[0][0] + 0.5 + i * span / 5)
    pf = prog(t, ch[2][0], 0.6)
    if 0 < pf < 1:
        a = math.sin(math.pi * pf)
        for i in range(5):
            blit(base, rrect(900, 96, 26, (0, 0, 0, 0), tuple(ACC) + (255,), 3), CX, 545 + i * 116, 'c', alpha=a)


@lru_cache(maxsize=None)
def fit_row2(text):
    row = Image.new('RGBA', (820, 84), (0, 0, 0, 0))
    row.alpha_composite(rrect(820, 84, 42, (255, 255, 255, 30), (255, 255, 255, 60), 2))
    row.alpha_composite(check_icon(52, tuple(ACC) + (255,), tuple(NAVY) + (255,)), (20, 16))
    ts = text_sprite(text, 46, 'B', WHITE, shadow=False)
    row.alpha_composite(ts, (92 - PAD, 42 - (ts.height - 2 * PAD) // 2 - PAD))
    row.info['pad'] = 0
    return row


def s8(base, t, ch):
    snap_line(base, '이런 분께', 88, 'B', CX, 280, t, 0.1)
    snap_line(base, (('추천합니다', ACC),), 116, 'X', CX, 395, t, 0.28)
    for i, s in enumerate(['성북동 실거주 계획', '분담금 단계적 마련', '몇 년의 기다림 OK']):
        fade_up(base, fit_row2(s), CX, 515 + i * 98, t, 0.7 + i * 0.35)
    vw, vh = 800, 450
    st = 1.5
    if t >= st:
        idx = 1 + int((t - st) * 24)
        im = drone_frame(idx).resize((vw, vh), Image.BILINEAR)
        draw_card(base, im, CX, 990, vw, vh, t, st, reveal='fade', label='조감도 기반 예시 영상')


STAMP_Y = 930


@lru_cache(maxsize=1)
def stamp_sprite():
    txt = '재개발 추천'
    tw = int(tlen(txt, 150, 'X'))
    w, h = tw + 120, 230
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    im.alpha_composite(rrect(w, h, 40, (127, 227, 255, 34), tuple(ACC) + (255,), 8))
    ts = text_sprite(txt, 150, 'X', ACC)
    im.alpha_composite(ts, (60 - PAD, h // 2 - (ts.height - 2 * PAD) // 2 - PAD))
    im.info['pad'] = 0
    return im


def s9(base, t, ch):
    im = kb_frame(src('aerial.webp'), 960, 520, 1.0 + 0.07 * clamp(t / 6), 0.5, 0.55)
    draw_card(base, im, CX, 505, 960, 520, t, 0.1, label='조감도 기반 예시 이미지')
    land = 1.05
    ps = prog(t, land - 0.32, 0.32)
    if ps > 0:
        sc = 2.3 - 1.3 * (ps ** 2)  # 가속하며 '쾅'
        shake = 0.0
        if t > land:
            k = t - land
            shake = 9 * math.exp(-k * 9) * math.sin(k * 70)
        blit(base, stamp_sprite(), CX + shake, STAMP_Y, 'c', alpha=clamp(ps / 0.25), scale=sc)
    ring(base, CX, STAMP_Y, t, land, dur=0.9, r0=200, r1=640, w0=14)
    sparkles(base, CX, STAMP_Y, t, land + 0.05, [(-470, -120, 50), (455, -110, 38), (-430, 120, 34),
                                                 (480, 100, 54), (-160, -140, 28), (210, 135, 32)])
    if t >= land + 0.35:
        a = ease_out(prog(t, land + 0.35, 0.4))
        sa = CTX.alpha
        CTX.alpha = sa * a
        wave_text(base, '쌤태리부동산컨설팅', 60, 'B', WHITE, CX, 1095, t, land + 0.55)
        CTX.alpha = sa
    fade_up(base, text_sprite('※ AI 음성 · 일부 이미지는 이해를 돕기 위한 예시입니다', 26, 'M', SOFT), CX, 1170, t, land + 0.8, dist=12)


SCENE_FN = [s1, s2, s3, s4, s5, s6, s7, s8, s9]
STAMP_T = None  # 전역 도장 시각(음악 임팩트용)


def stamp_time():
    return STARTS[-1] + 1.05


# ───────────────────────── 프레임·인코딩 ─────────────────────────
def render_frame(idx, t):
    dur, chunks, lead, sp = TIMING[idx]
    T = STARTS[idx] + t
    base = bg2.draw_bg(T)
    last = idx == len(TIMING) - 1
    if not last and t > dur - R.EXIT:
        e = ease_in_out(prog(t, dur - R.EXIT, R.EXIT))
        CTX.alpha, CTX.dy = 1 - e, -36 * e
    else:
        CTX.alpha, CTX.dy = 1.0, 0.0
    bg2.draw_ghost(base, idx + 1, t)
    SCENE_FN[idx](base, t, chunks)
    CTX.alpha, CTX.dy = 1.0, 0.0
    draw_rabbit(base, T)
    draw_bubble(base, T)
    bg2.draw_onair(base, BUB[0] + 28, BUB[1] - 24, T, env_at(T), alpha=ease_out(prog(T, 0.9, 0.4)))
    a_on = ease_out(prog(T, 0.9, 0.4))
    if a_on > 0:  # 라이선스 조건: AI 생성 음성임을 표시
        blit_at(base, label_pill('AI 음성', 22), BUB[0] + 28 + bg2.onair_pill().width + 10, BUB[1] - 20, a_on, use_ctx=False)
    R.draw_ui(base, T)
    bg2.draw_index(base, idx + 1, len(TIMING))
    return base


def ensure_drone_frames():
    d = os.path.join(ASSET, 'drone')
    if os.path.isdir(d) and os.listdir(d):
        return
    os.makedirs(d, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '2.5', '-i', os.path.join(ASSET, 'drone.mp4'), '-t', '7.4',
                    '-vf', 'scale=900:506:flags=lanczos', '-q:v', '3', os.path.join(d, '%04d.jpg')], check=True)


def init_all():
    R.init_assets()
    bg2.init()
    load_env()


def encode_scene(args):
    idx, out_dir = args
    init_all()
    dur = TIMING[idx][0]
    n0 = int(round(STARTS[idx] * FPS))
    n1 = int(round((STARTS[idx] + dur) * FPS))
    final = os.path.join(out_dir, f'scene_{idx + 1:02d}.mp4')
    tmp = final + '.tmp.mp4'
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
           '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
           '-movflags', '+faststart', '-f', 'mp4', tmp]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for k in range(n0, n1):
        frame = render_frame(idx, k / FPS - STARTS[idx])
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
    out = []
    for n, (a, b, txt) in enumerate(CHUNKS, 1):
        nxt = CHUNKS[n][0] if n < len(CHUNKS) else TOTAL
        out += [str(n), f'{fmt_srt(a)} --> {fmt_srt(max(b, min(nxt, b + 0.6)))}', txt, '']
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))


def write_wav(path, x, sr):
    x = np.asarray(x)
    data = (np.clip(x.T if x.ndim == 2 else x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2 if x.ndim == 2 else 1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(data.tobytes())


def read_wav(path):
    with wave.open(path) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768
    return (x.reshape(-1, ch).mean(1) if ch > 1 else x), sr


def build_mix(out_dir):
    """내레이션을 장면 시각에 배치하고, 길이에 맞춘 배경음악을 목소리 아래로 깔아 mix.wav를 만든다."""
    from scipy.signal import resample_poly
    import music2
    SRM = 48000
    N = int(round(TOTAL * SRM))
    voice = np.zeros(N)
    if HAS_VOICE:
        with open(os.path.join(VOICE_DIR, 'manifest.json'), encoding='utf-8') as f:
            man = json.load(f)
        for i, sc in enumerate(man['scenes']):
            x, sr = read_wav(os.path.join(VOICE_DIR, sc['file']))
            if sr != SRM:
                g = math.gcd(SRM, sr)
                x = resample_poly(x, SRM // g, sr // g)
            a = int(round((STARTS[i] + LEAD) * SRM))
            b = min(N, a + x.size)
            voice[a:b] += x[:b - a]
        act = voice[np.abs(voice) > 1e-3]
        rms = np.sqrt(np.mean(act ** 2)) if act.size else 1
        voice *= 10 ** (-19 / 20) / rms              # 말하는 구간 RMS ≈ -19 dBFS
        write_wav(os.path.join(VOICE_DIR, 'narration.wav'), voice, SRM)
    marks = {'drop': STARTS[1], 'break': (STARTS[6], STARTS[7]), 'final': STARTS[7], 'impact': stamp_time()}
    music = music2.compose(TOTAL, marks)[:, :N]
    if music.shape[1] < N:
        music = np.pad(music, ((0, 0), (0, N - music.shape[1])))
    mrms = np.sqrt(np.mean(music ** 2))
    music *= 10 ** (-27 / 20) / mrms                # 배경음악 RMS ≈ -27 dBFS
    # 목소리가 나올 때 음악을 약 9dB 낮춘다 (어택 30ms, 릴리스 350ms)
    env = np.abs(voice)
    win = int(0.02 * SRM)
    env = np.sqrt(np.convolve(env ** 2, np.ones(win) / win, mode='same'))
    act = (env > 10 ** (-42 / 20)).astype(np.float64)
    g = np.ones(N)
    v = 0.0
    a_c, r_c = math.exp(-1 / (0.03 * SRM)), math.exp(-1 / (0.35 * SRM))
    target = 10 ** (-9 / 20)
    step = 64
    for k in range(0, N, step):
        tgt = target if act[k] > 0 else 1.0
        c = a_c ** step if tgt < v or v == 0 else r_c ** step
        v = tgt if v == 0 else tgt + (v - tgt) * c
        g[k:k + step] = v
    mix = music * g + np.stack([voice, voice])
    raw = os.path.join(out_dir, 'mix_raw.wav')
    write_wav(raw, mix / max(1.0, np.max(np.abs(mix)) / 0.97), SRM)
    gain = R.music_gain(raw)
    with wave.open(raw) as w:
        st = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64).reshape(-1, 2) / 32768
    write_wav(os.path.join(out_dir, 'mix.wav'), st.T * 10 ** (gain / 20), SRM)
    print(f'mix: total {TOTAL:.2f}s voice={HAS_VOICE} gain {gain:+.2f} dB')


def main():
    mode, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    ensure_drone_frames()
    if mode == 'info':
        print(f'voice={HAS_VOICE} total={TOTAL:.2f}s stamp={stamp_time():.2f}s')
        for i, (d, b, l, s) in enumerate(TIMING):
            print(f'scene {i + 1}: start {STARTS[i]:6.2f}  dur {d:5.2f}  speech {s:5.2f}')
        return
    if mode == 'stills':
        init_all()
        for idx, (dur, *_r) in enumerate(TIMING):
            tt = float(sys.argv[3]) if len(sys.argv) > 3 else dur - R.EXIT - 0.05
            render_frame(idx, min(tt, dur - 0.01)).save(os.path.join(out_dir, f'still_{idx + 1:02d}.png'))
        return
    if mode == 'frame':
        init_all()
        T = float(sys.argv[3])
        idx = max(i for i, s in enumerate(STARTS) if s <= T)
        render_frame(idx, T - STARTS[idx]).save(os.path.join(out_dir, f'frame_{T:05.2f}.png'))
        return
    if mode == 'mix':
        build_mix(out_dir)
        return
    if mode == 'render':
        which = [int(a) - 1 for a in sys.argv[3:]] or list(range(len(TIMING)))
        with Pool(min(4, len(which))) as pool:
            for path in pool.imap_unordered(encode_scene, [(i, out_dir) for i in which]):
                print('done', os.path.basename(path), flush=True)
        lst = os.path.join(out_dir, 'concat.txt')
        with open(lst, 'w') as f:
            for i in range(len(TIMING)):
                f.write(f"file 'scene_{i + 1:02d}.mp4'\n")
        silent = os.path.join(out_dir, 'video_only.mp4')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
                        '-c', 'copy', '-movflags', '+faststart', silent + '.tmp.mp4'], check=True)
        os.replace(silent + '.tmp.mp4', silent)
        write_srt(os.path.join(out_dir, 'seongbuk2_rabbit.srt'))
        mix = os.path.join(out_dir, 'mix.wav')
        final = os.path.join(out_dir, 'seongbuk2_rabbit.mp4')
        if os.path.exists(mix):
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', silent, '-i', mix, '-map', '0:v', '-map', '1:a',
                            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest',
                            '-movflags', '+faststart', final + '.tmp.mp4'], check=True)
        else:
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', silent, '-c', 'copy', final + '.tmp.mp4'], check=True)
        os.replace(final + '.tmp.mp4', final)
        print('final', final)


if __name__ == '__main__':
    main()
