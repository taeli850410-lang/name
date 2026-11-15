#!/usr/bin/env python3
"""v4 배경음악(밝은 버전) — 경쾌한 피아노 팝(D장조, 108BPM). 코드로 직접 합성한 오리지널(외부 음원·샘플 없음).

  I–V–vi–IV(D–A/C#–Bm–G) 진행, 엇박 피아노 화음 + 글로켄슈필 멜로디 + 클랩·셰이커.
  인트로부터 밝게 → 'drop'에서 가벼운 비트 → 'groove'에서 풀 비트 → 'break'(잠긴 카드)에서 가볍게 숨 고르기 →
  'final'(상담)에서 G–A–Bm–D로 상승 → 'impact'(전화번호)에 반짝이는 임팩트 → 마지막 마디 D코드 여운.
"""
import math

import numpy as np
from scipy.signal import fftconvolve

from music import SR, add, bp, clap, hp, lp, reverb_ir, tt
from music3 import hz, piano, sub_bass

BPM = 108
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(108)

CH = {  # 왼손 보이싱, 베이스, 오른손(엇박 화음·아르페지오)
    'D': ([50, 57, 62, 66], 38, [66, 69, 74, 78]),
    'A': ([49, 57, 61, 64], 37, [64, 69, 73, 76]),
    'Bm': ([47, 54, 59, 62], 35, [62, 66, 71, 74]),
    'G': ([43, 55, 59, 62], 43, [62, 67, 71, 74]),
}
LOOP = ['D', 'A', 'Bm', 'G']
FINAL = ['G', 'A', 'Bm', 'D']
MELODY = {
    'D': [(0, 78, 1), (1, 81, 1), (2, 78, 0.5), (2.5, 76, 0.5), (3, 74, 1)],
    'A': [(0, 76, 1.5), (1.5, 73, 0.5), (2, 76, 1), (3, 78, 1)],
    'Bm': [(0, 78, 1), (1, 74, 1), (2, 71, 1), (3, 74, 1)],
    'G': [(0, 74, 1), (1, 76, 1), (2, 79, 2)],
}


def glock(m, dur=1.2, vel=1.0):
    """글로켄슈필: 금속 막대 특유의 어긋난 배음(1, 2.76, 5.40배)이 빠르게 사라지는 맑은 소리."""
    n = int(dur * SR)
    t = tt(n)
    f = hz(m)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2)
         + 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 5.0)
         + 0.25 * np.sin(2 * np.pi * f * 5.40 * t) * np.exp(-t * 9.0))
    return s * np.minimum(1, t / 0.002) * vel * 0.25


def kick():
    n = int(0.3 * SR)
    t = tt(n)
    f = 55 + 70 * np.exp(-t / 0.025)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)


def shaker(bright=1.0):
    n = int(0.08 * SR)
    t = tt(n)
    return hp(rng.standard_normal(n), 6500, 4) * np.exp(-t / (0.018 * bright)) * np.minimum(1, t / 0.006)


def tamb():
    n = int(0.18 * SR)
    t = tt(n)
    jingle = bp(rng.standard_normal(n), 7000, 12000) * np.exp(-t / 0.05)
    return jingle * 0.6


def riser(length):
    n = int(length * SR)
    t = tt(n)
    noise = hp(rng.standard_normal(n), 2000)
    sweep = np.sin(2 * np.pi * np.cumsum(300 + 1500 * (t / length) ** 2) / SR) * 0.2
    return (noise * 0.6 + sweep) * (t / length) ** 2.2


def compose(dur, marks):
    N = int(round(dur * SR))
    nb = int(math.ceil(dur / BAR))
    bar_of = lambda s: int(round(s / BAR))  # noqa: E731
    drop_b = max(1, bar_of(marks['drop']))
    groove_b = max(drop_b, bar_of(marks.get('groove', marks['drop'])))
    brk_a = bar_of(marks['break'][0])
    brk_b = max(bar_of(marks['break'][1]), brk_a + 1)
    final_b = max(brk_b, bar_of(marks['final']))
    end_b = nb - 1

    def section(b):
        if b < drop_b:
            return 'intro'
        if b >= end_b:
            return 'end'
        if b >= final_b:
            return 'final'
        if brk_a <= b < brk_b:
            return 'break'
        if b >= groove_b:
            return 'groove'
        return 'lift'

    def chord(b):
        sec = section(b)
        if sec == 'end':
            return 'D'
        if sec == 'final':
            return FINAL[(b - final_b) % 4]
        return LOOP[b % 4]

    pno = np.zeros((2, N))
    mel = np.zeros((2, N))
    bass = np.zeros(N)
    drum = np.zeros((2, N))
    fx = np.zeros((2, N))
    K, C, T = kick(), clap(), tamb()
    for b in range(nb):
        t0 = b * BAR
        sec = section(b)
        name = chord(b)
        lh, root, rh = CH[name]
        vel = {'intro': 0.85, 'lift': 0.9, 'groove': 0.95, 'break': 0.75, 'final': 1.0, 'end': 0.85}[sec]
        # 왼손: 베이스 옥타브(1·3박)
        for beat in (0, 2):
            if sec == 'break' and beat == 2:
                continue
            add(pno, t0 + beat * BEAT, np.stack([piano(root + 12, 1.6, vel * 0.8), piano(root + 12, 1.6, vel * 0.7)]))
        add(pno, t0, np.stack([piano(lh[1], 1.8, vel * 0.55), piano(lh[2], 1.8, vel * 0.55)]))
        # 오른손: 인트로는 반짝이는 아르페지오, 이후엔 엇박 스타카토 화음
        if sec in ('intro', 'end'):
            for i, k in enumerate([0, 1, 2, 3, 2, 1, 2, 3]):
                m = rh[k]
                note = piano(m, 0.9, vel * (0.75 if i % 2 else 0.9))
                pan = 0.5 + 0.3 * ((m - 66) / 12)
                add(pno, t0 + i * BEAT / 2, np.stack([note * (1 - pan) * 1.5, note * pan * 1.5]))
        else:
            for i in range(8):
                if i % 2 == 0 and not (sec == 'final' and i in (0, 4)):
                    continue
                for j, m in enumerate(rh[:3]):
                    note = piano(m, 0.32, vel * 0.6)
                    add(pno, t0 + i * BEAT / 2 + 0.006 * j, np.stack([note * 0.95, note * 1.05]))
        # 멜로디: 피아노 + 글로켄슈필(한 옥타브 위)
        if sec in ('lift', 'groove', 'final', 'end'):
            phrase = MELODY[name] if sec != 'end' else [(0, 81, 2), (2, 86, 2)]
            if sec == 'lift' and b % 2:
                phrase = phrase[:2]
            for (bt, m, d) in phrase:
                add(mel, t0 + bt * BEAT, np.stack([piano(m, max(0.9, d * BEAT + 0.5), vel * 0.85)] * 2) * np.array([[0.8], [1.0]]))
                if sec in ('groove', 'final', 'end'):
                    g = glock(m + 12, 1.2, vel)
                    add(mel, t0 + bt * BEAT, np.stack([g * 1.0, g * 0.8]))
        if sec == 'break':
            for i, m in enumerate((rh[3] + 12, rh[1] + 12)):
                g = glock(m, 1.4, 0.8)
                add(mel, t0 + i * 2 * BEAT, np.stack([g, g]))
        # 베이스
        if sec in ('lift', 'groove', 'final'):
            for st in (0, 1.5, 2, 3.5):
                add(bass, t0 + st * BEAT, sub_bass(root + 12, BEAT * (1.4 if st in (0, 2) else 0.45)) * (1.0 if st in (0, 2) else 0.7))
        # 드럼
        for beat in range(4):
            tb = t0 + beat * BEAT
            if sec in ('groove', 'final') or (sec == 'lift' and beat in (0, 2)):
                add(drum, tb, np.stack([K, K]) * (0.85 if sec != 'lift' else 0.6))
            if sec in ('groove', 'final') and beat in (1, 3):
                add(drum, tb, np.stack([C * 0.9, C]) * 0.6)
            if sec in ('intro', 'lift', 'groove', 'final', 'break'):
                for j in range(2 if sec in ('intro', 'break') else 4):
                    sh = shaker() * (0.55 if j % 2 == 0 else 0.35) * (0.7 if sec in ('intro', 'break') else 1.0)
                    off = j * (BEAT / 2 if sec in ('intro', 'break') else BEAT / 4)
                    add(drum, tb + off, np.stack([sh * 0.7, sh]))
            if sec == 'final' and beat in (1, 3):
                add(drum, tb + BEAT / 2, np.stack([T * 0.8, T]) * 0.5)
    # 상담 장면 직전 상승음
    rl = min(2.2, max(1.0, (final_b - brk_a) * BAR))
    add(fx, final_b * BAR - rl, np.stack([riser(rl)] * 2) * 0.22)
    add(drum, final_b * BAR, np.stack([C, C]) * 0.7)
    # 전화번호 등장: 반짝이는 글로켄슈필 아르페지오 + 부드러운 붐
    imp = marks['impact']
    n = int(2.0 * SR)
    t = tt(n)
    boom = np.sin(2 * np.pi * np.cumsum(45 + 40 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.5)
    add(fx, imp, np.stack([boom, boom]) * 0.45)
    for k, m in enumerate((86, 90, 93, 98)):
        g = glock(m, 1.5, 0.9)
        add(mel, imp + 0.07 * k, np.stack([g * (0.7 + 0.1 * k), g * (1.0 - 0.1 * k)]))

    dry = pno * 0.55 + mel * 0.55 + np.stack([bass, bass]) * 0.5 + drum * 0.4 + fx
    send = pno * 0.3 + mel * 0.4
    ir = reverb_ir(1.6, 0.45)
    wet = np.stack([fftconvolve(send[0], ir[0])[:N], fftconvolve(send[1], ir[1])[:N]])
    mix = hp(dry + wet * 0.3, 35)
    fi = int(0.02 * SR)
    mix[:, :fi] *= np.linspace(0, 1, fi)
    fo0 = int(max(0, dur - 2.0) * SR)
    mix[:, fo0:] *= np.linspace(1, 0, N - fo0) ** 1.3
    mix = np.tanh(mix / (np.max(np.abs(mix)) + 1e-9) * 1.25) / np.tanh(1.25) * 0.89
    return mix
