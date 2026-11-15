"""영상 마지막 중개사·매물 정보 화면 (사용자가 보낸 명함 이미지 스타일: 짙은 남색 + 금색).

연락처·등록번호 등은 사용자가 보낸 이미지 그대로, 매물 정보는 이 영상의 성북2구역 매물(블로그 원문)로 채운다.
"""
import math
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from render import H, PAD, W, WHITE, blit, blit_at, clamp, ease_out, font, prog, text_sprite, tlen

GOLD_HI, GOLD_MID, GOLD_LO = (255, 236, 170), (222, 176, 82), (246, 210, 122)
GOLD = (232, 190, 98)
LBLUE = (150, 190, 255)
NAVY_D, NAVY_L = (4, 14, 44), (12, 42, 108)

BADGE = '성북2구역 · 무허가주택 매물'
COMPANY = '(주)센추리21코리아'
NAME, TITLE = '이 태 리', '공인중개사'
CONTACTS = [('phone', 'Mobile', '010-4286-0252'), ('call', 'Direct', '02-2027-7073'),
            ('mail', 'E-mail', 'taeli850410@gmail.com'), ('web', 'Web', 'www.century21korea.com')]
ADDRESS = '서울특별시 강남구 테헤란로87길 21 동성빌딩 11층'
REGNO = '등록번호 11680-2017-00222 · 대표 공인중개사 김동현'
FRANCHISE = 'Each office is independently owned and operated.'
LISTING = [('소재지', '서울 성북구 성북동 (성북2구역)'),
           ('종류', '무허가건축물 (타운하우스)'),
           ('면적', '대지 8㎡(2.42평) · 연면적 39.67㎡'),
           ('거래', '매매 5억 원'),
           ('사업', '전면 철거형 · 공동주택 496세대 계획')]
OY = 90  # 정보 화면 전체를 세로 가운데로 내리는 양
BLD_Y = 760 + OY  # 빌딩 라인아트 바닥선 (이름·연락처 옆)
NOTE = ['※ 감정평가액·조합원 분양가·분담금은 관리처분 전 추정·가정치이며,',
        '사업 진행 과정에서 바뀔 수 있습니다. 이자·이주비·취득세 미포함.',
        '실거래: 국토교통부 공개자료. 내레이션: 실제 목소리 기반 AI 합성 음성.']
BLOG = ('쌤태리부동산컨설팅 블로그', 'blog.naver.com/christy0410')


def _gold_fill(mask):
    w, h = mask.size
    g = np.linspace(0, 1, h)[:, None]
    a, b, c = (np.array(v, np.float64) for v in (GOLD_HI, GOLD_MID, GOLD_LO))
    top = a[None, None, :] + (b - a)[None, None, :] * np.clip(g / 0.55, 0, 1)[..., None]
    bot = b[None, None, :] + (c - b)[None, None, :] * np.clip((g - 0.55) / 0.45, 0, 1)[..., None]
    col = np.where((g < 0.55)[..., None], top, bot)
    img = Image.fromarray(np.repeat(col, w, axis=1).astype(np.uint8), 'RGB').convert('RGBA')
    img.putalpha(mask)
    return img


@lru_cache(maxsize=None)
def gold_text(text, size, weight='X', shadow=True):
    spr = text_sprite(text, size, weight, WHITE, shadow=False)
    out = Image.new('RGBA', spr.size, (0, 0, 0, 0))
    if shadow:
        sh = Image.new('RGBA', spr.size, (0, 0, 0, 0))
        sh.putalpha(spr.getchannel('A').point(lambda v: v * 110 // 255))
        out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)), (0, 4))
    out.alpha_composite(_gold_fill(spr.getchannel('A')))
    out.info['pad'] = PAD
    return out


def _line_gold(d, xy, width, S):
    d.line([(x * S, y * S) for x, y in xy], fill=GOLD + (255,), width=width * S)


@lru_cache(maxsize=None)
def icon(kind, size=40):
    S = 4
    D = size * S
    im = Image.new('RGBA', (D, D), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c, lw = GOLD + (255,), max(2, int(D * 0.07))
    if kind == 'phone':
        d.rounded_rectangle([D * .28, D * .08, D * .72, D * .92], radius=D * .08, outline=c, width=lw)
        d.line([D * .42, D * .8, D * .58, D * .8], fill=c, width=lw)
    elif kind == 'call':  # 탁상 전화기
        d.rounded_rectangle([D * .16, D * .48, D * .84, D * .9], radius=D * .1, outline=c, width=lw)
        d.arc([D * .08, D * .12, D * .92, D * .7], 200, 340, fill=c, width=int(lw * 1.7))
        d.ellipse([D * .06, D * .3, D * .26, D * .46], fill=c)
        d.ellipse([D * .74, D * .3, D * .94, D * .46], fill=c)
        d.ellipse([D * .42, D * .6, D * .58, D * .76], outline=c, width=lw)
    elif kind == 'mail':
        d.rectangle([D * .08, D * .22, D * .92, D * .78], outline=c, width=lw)
        d.line([D * .08, D * .22, D * .5, D * .55, D * .92, D * .22], fill=c, width=lw)
    elif kind == 'web':
        d.ellipse([D * .08, D * .08, D * .92, D * .92], outline=c, width=lw)
        d.ellipse([D * .32, D * .08, D * .68, D * .92], outline=c, width=lw)
        d.line([D * .08, D * .5, D * .92, D * .5], fill=c, width=lw)
    elif kind == 'pin':
        d.ellipse([D * .2, D * .05, D * .8, D * .65], fill=c)
        d.polygon([(D * .24, D * .45), (D * .76, D * .45), (D * .5, D * .95)], fill=c)
        d.ellipse([D * .4, D * .22, D * .6, D * .42], fill=NAVY_D + (255,))
    elif kind == 'doc':
        d.rectangle([D * .15, D * .08, D * .85, D * .92], outline=c, width=lw)
        for yy in (.32, .5, .68):
            d.line([D * .3, D * yy, D * .7, D * yy], fill=c, width=lw)
    elif kind == 'link':
        d.rounded_rectangle([D * .05, D * .35, D * .6, D * .65], radius=D * .15, outline=c, width=lw)
        d.rounded_rectangle([D * .4, D * .35, D * .95, D * .65], radius=D * .15, outline=c, width=lw)
    im = im.resize((size, size), Image.LANCZOS)
    im.info['pad'] = 0
    return im


@lru_cache(maxsize=1)
def card_base():
    """정적인 배경: 남색 그라데이션, 빛 번짐, 금색 테두리·모서리 곡선, 작은 빌딩 라인아트."""
    yy, xx = np.mgrid[0:H // 2, 0:W // 2].astype(np.float32)
    k = np.clip(0.25 * xx / (W / 2) + 0.75 * yy / (H / 2), 0, 1)
    a, b = np.array(NAVY_D, np.float32), np.array(NAVY_L, np.float32)
    col = a + (b - a) * (0.5 - 0.5 * np.cos(np.pi * k))[..., None]
    g = np.exp(-(((xx - W * 0.38) / (W * 0.45)) ** 2 + ((yy - H * 0.18) / (H * 0.22)) ** 2))
    col += np.array([30, 60, 130], np.float32) * g[..., None] * 0.6
    img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).convert('RGBA')
    S = 2
    ov = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rectangle([28 * S, 28 * S, (W - 28) * S, (H - 28) * S], outline=GOLD + (200,), width=2 * S)
    for r, wdt, al in ((560, 10, 230), (600, 4, 150), (640, 2, 90)):
        d.arc([(W - 120 - r) * S, (-r + 40) * S, (W - 120 + r) * S, (r + 40) * S], 300, 360, fill=GOLD + (al,), width=wdt * S)
        d.arc([(-r + 120) * S, (H - 40 - r) * S, (r + 120) * S, (H - 40 + r) * S], 120, 180, fill=GOLD + (al,), width=wdt * S)
    # 빌딩 라인아트(오른쪽 위, 이름 옆)
    bx = [(862, 95, 170), (912, 80, 225), (970, 85, 195), (1018, 40, 130)]
    for x0, bw, bh in bx:
        y1 = BLD_Y
        d.rectangle([x0 * S, (y1 - bh) * S, (x0 + bw * 0.6) * S, y1 * S], outline=(120, 170, 255, 150), width=2 * S)
        for wy in range(y1 - bh + 14, y1 - 8, 18):
            for wx in range(x0 + 8, int(x0 + bw * 0.6) - 6, 14):
                lit = (wx * 7 + wy * 3) % 5 == 0
                d.rectangle([wx * S, wy * S, (wx + 6) * S, (wy + 8) * S], fill=(255, 214, 120, 170) if lit else (120, 170, 255, 60))
    d.line([840 * S, BLD_Y * S, 1050 * S, BLD_Y * S], fill=GOLD + (160,), width=2 * S)
    ov = ov.resize((W, H), Image.LANCZOS)
    glow = ov.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(glow)
    img.alpha_composite(ov)
    return img


@lru_cache(maxsize=None)
def badge_sprite(text):
    tw = int(tlen(text, 40, 'B'))
    w, h = tw + 80, 76
    S = 3
    im = Image.new('RGBA', (w * S, h * S), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([2 * S, 2 * S, (w - 2) * S, (h - 2) * S], radius=(h // 2) * S,
                                         fill=(10, 24, 60, 230), outline=GOLD + (255,), width=3 * S)
    im = im.resize((w, h), Image.LANCZOS)
    ts = gold_text(text, 40, 'B', shadow=False)
    im.alpha_composite(ts, (40 - PAD, h // 2 - (ts.height - 2 * PAD) // 2 - PAD))
    im.info['pad'] = 0
    return im


@lru_cache(maxsize=1)
def tab_sprite():
    w, h = 300, 78
    S = 3
    im = Image.new('RGBA', (w * S, h * S), (0, 0, 0, 0))
    m = Image.new('L', (w * S, h * S), 0)
    ImageDraw.Draw(m).polygon([(18 * S, 0), (w * S, 0), ((w - 18) * S, h * S), (0, h * S)], fill=255)
    im = _gold_fill(m.resize((w * S, h * S)))
    im = im.resize((w, h), Image.LANCZOS)
    ts = text_sprite('매물 정보', 44, 'X', (20, 22, 40), shadow=False)
    im.alpha_composite(ts, (60 - PAD, h // 2 - (ts.height - 2 * PAD) // 2 - PAD))
    im.info['pad'] = 0
    return im


@lru_cache(maxsize=None)
def row_sprite(label, value):
    w, h = 920, 70
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    g = Image.new('L', (w, 1))
    for x in range(w):
        g.putpixel((x, 0), int(150 * (1 - x / w) ** 0.6))
    bar = Image.new('RGBA', (w, h - 8), (20, 50, 120, 0))
    bar.putalpha(g.resize((w, h - 8)))
    im.alpha_composite(bar, (0, 4))
    ls = text_sprite(label, 38, 'B', WHITE, shadow=False)
    im.alpha_composite(ls, (28 - PAD, h // 2 - (ls.height - 2 * PAD) // 2 - PAD))
    sep = text_sprite('|', 36, 'M', (200, 210, 230), shadow=False)
    im.alpha_composite(sep, (210 - PAD, h // 2 - (sep.height - 2 * PAD) // 2 - PAD))
    size = 40
    while size > 28 and tlen(value, size, 'B') > w - 250:
        size -= 1
    vs = text_sprite(value, size, 'B', WHITE, shadow=False)
    im.alpha_composite(vs, (246 - PAD, h // 2 - (vs.height - 2 * PAD) // 2 - PAD))
    im.info['pad'] = 0
    return im


def _fade(base, spr, x, y, t, st, anchor='l', dist=24):
    p = prog(t, st, 0.5)
    if p <= 0:
        return
    e = ease_out(p)
    blit(base, spr, x, y + OY + (1 - e) * dist, anchor, alpha=e, use_ctx=False)


def draw(base, t):
    """t: 정보 화면이 시작된 뒤 초. 중개사·연락처·등록번호·안내·블로그만 표시(매물 배지·매물 정보 표 없음)."""
    p = prog(t, 0.0, 0.7)
    if p <= 0:
        return
    e = ease_out(p)
    blit_at(base, card_base(), 0, (1 - e) * 140, e, use_ctx=False)
    if p < 0.6:
        return
    s0 = 0.45
    _fade(base, gold_text(COMPANY, 84, 'X'), 80, 330, t, s0)
    pl = prog(t, s0 + 0.1, 0.6)
    if pl > 0:
        ln = Image.new('RGBA', (max(2, int(920 * ease_out(pl))), 3), GOLD + (230,))
        ln.info['pad'] = 0
        blit_at(base, ln, 80, 410 + OY, use_ctx=False)
    _fade(base, text_sprite(NAME, 140, 'X', WHITE), 80, 545, t, s0 + 0.18)
    nx = 80 + tlen(NAME, 140, 'X') + 36
    _fade(base, text_sprite('|', 62, 'M', (200, 210, 230), shadow=False), nx, 550, t, s0 + 0.24)
    _fade(base, text_sprite(TITLE, 56, 'B', WHITE), nx + 40, 552, t, s0 + 0.24)
    for i, (ic, lab, val) in enumerate(CONTACTS):
        y = 720 + i * 78
        st = s0 + 0.35 + i * 0.08
        _fade(base, icon(ic, 46), 90, y, t, st)
        _fade(base, text_sprite(lab, 38, 'B', LBLUE, shadow=False), 162, y, t, st)
        _fade(base, text_sprite('|', 36, 'M', (160, 175, 210), shadow=False), 326, y, t, st)
        _fade(base, text_sprite(val, 46, 'X', WHITE), 362, y, t, st)
    st = s0 + 0.75
    _fade(base, icon('pin', 42), 92, 1080, t, st)
    _fade(base, text_sprite(ADDRESS, 37, 'B', WHITE), 152, 1080, t, st)
    _fade(base, icon('doc', 40), 93, 1146, t, st + 0.06)
    _fade(base, text_sprite(REGNO, 35, 'B', WHITE), 152, 1146, t, st + 0.06)
    _fade(base, text_sprite(FRANCHISE, 32, 'M', LBLUE, shadow=False), 92, 1208, t, st + 0.12)
    st = s0 + 1.35
    pl = prog(t, st, 0.6)
    if pl > 0:
        e2 = ease_out(pl)
        for x0, x1 in ((90, 250), (830, 990)):
            ln = Image.new('RGBA', (max(2, int((x1 - x0) * e2)), 2), GOLD + (200,))
            ln.info['pad'] = 0
            blit_at(base, ln, x0, 1420 + OY, use_ctx=False)
    _fade(base, icon("link", 42), 296, 1420, t, st)
    _fade(base, gold_text(BLOG[0], 42, "B", shadow=False), 350, 1420, t, st)
    _fade(base, text_sprite(BLOG[1], 40, 'B', WHITE), W / 2, 1486, t, st + 0.08, anchor='c')
    # 회사명 위를 지나가는 금빛 반짝임
    ps = prog(t, 1.6, 0.9)
    if 0 < ps < 1:
        sx = -200 + ps * 1300
        sh = Image.new('RGBA', (120, 100), (255, 245, 210, 0))
        m = Image.new('L', (120, 100), 0)
        ImageDraw.Draw(m).polygon([(40, 0), (80, 0), (60, 100), (20, 100)], fill=150)
        sh.putalpha(m.filter(ImageFilter.GaussianBlur(10)))
        sh.info['pad'] = 0
        blit_at(base, sh, sx, 282 + OY, use_ctx=False)
