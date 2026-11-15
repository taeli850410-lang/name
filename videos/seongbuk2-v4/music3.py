#!/usr/bin/env python3
"""v4 배경음악 — 잔잔하고 고급스러운 피아노 곡(C장조, 92BPM). 코드로 직접 합성한 오리지널(외부 음원·샘플 없음).

  인트로: 피아노만 → 'groove'부터 부드러운 비트 → 'break'(잠긴 카드)에서 숨 죽임 → 'final'(상담)에서 다시 풀림 →
  'impact'(전화번호 등장)에 은은한 임팩트 → 마지막 마디는 Cmaj9로 여운.
"""
import math

import numpy as np
from scipy.signal import fftconvolve

from music import SR, add, bp, hp, lp, reverb_ir, tt

BPM = 92
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(92)

CH = {  # 왼손 보이싱, 베이스, 오른손 아르페지오 음
    'Fmaj7': ([53, 57, 60, 64], 41, [65, 69, 72, 76]),
    'Em7': ([52, 55, 59, 62], 40, [64, 67, 71, 74]),
    'Dm7': ([50, 53, 57, 60], 38, [62, 65, 69, 72]),
    'Cmaj9': ([48, 55, 59, 62], 36, [60, 64, 67, 71]),
    'G6': ([50, 55, 59, 64], 43, [62, 67, 71, 76]),
    'Am7': ([52, 57, 60, 64], 45, [64, 69, 72, 76]),
}
LOOP = ['Fmaj7', 'Em7', 'Dm7', 'Cmaj9']
FINAL = ['Fmaj7', 'G6', 'Am7', 'Cmaj9']
MELODY = {
    'Fmaj7': [(0, 76, 1.5), (1.5, 74, 0.5), (2, 72, 2)],
    'Em7': [(0, 74, 1.5), (1.5, 72, 0.5), (2, 71, 2)],
    'Dm7': [(0, 72, 1), (1, 74, 1), (2, 77, 1.5), (3.5, 76, 0.5)],
    'Cmaj9': [(0, 76, 3), (3, 79, 1)],
    'G6': [(0, 74, 1), (1, 76, 1), (2, 79, 2)],
    'Am7': [(0, 81, 1.5), (1.5, 79, 0.5), (2, 76, 2)],
}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def piano(m, dur=2.6, vel=1.0):
    """해머 타격음 + 약간 어긋난 배음(현의 비조화성) + 두 줄 코러스로 만든 피아노 소리."""
    n = int(dur * SR)
    t = tt(n)
    f = hz(m)
    B = 0.00035
    bright = 0.6 + 0.4 * vel
    s = np.zeros(n)
    for k in range(1, 11):
        fk = f * k * math.sqrt(1 + B * k * k)
        if fk > SR / 2.2:
            break
        amp = (1 / k ** (1.25 - 0.35 * bright))
        decay = 1.1 + 0.55 * k + f / 900
        for det in (-0.7, 0.7):
            s += 0.5 * amp * np.sin(2 * np.pi * fk * (2 ** (det / 1200)) * t + k) * np.exp(-t * decay)
    ham = lp(rng.standard_normal(n), 2500) * np.exp(-t / 0.004) * 0.08
    att = np.minimum(1, t / 0.003)
    rel = np.ones(n)
    nr = int(0.25 * SR)
    rel[-nr:] = np.linspace(1, 0, nr)
    return (s * att + ham) * rel * vel * 0.35


def soft_pad(notes, dur):
    n = int((dur + 1.0) * SR)
    t = tt(n)
    out = np.zeros((2, n))
    for m in notes:
        for ch, det in ((0, -6), (1, 6)):
            fr = hz(m + 12) * 2 ** (det / 1200)
            out[ch] += np.sin(2 * np.pi * fr * t) + 0.3 * np.sin(4 * np.pi * fr * t + 1)
    e = np.minimum(1, t / 0.8) * np.minimum(1, np.maximum(0, (n / SR - t) / 1.0))
    return out * e / (len(notes) * 4)


def sub_bass(m, dur):
    n = int(dur * SR)
    t = tt(n)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    return s * np.minimum(1, t / 0.01) * np.exp(-t * 1.2) * 0.5


def kick():
    n = int(0.35 * SR)
    t = tt(n)
    f = 50 + 45 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)


def rim():
    n = int(0.12 * SR)
    t = tt(n)
    return (bp(rng.standard_normal(n), 1500, 4500) * np.exp(-t / 0.012) * 0.6
            + np.sin(2 * np.pi * 1700 * t) * np.exp(-t / 0.02) * 0.3)


def shaker():
    n = int(0.09 * SR)
    t = tt(n)
    return hp(rng.standard_normal(n), 6000, 4) * np.exp(-t / 0.02) * np.minimum(1, t / 0.008)


def swell(length):
    n = int(length * SR)
    t = tt(n)
    noise = lp(rng.standard_normal(n), 3000)
    return noise * (t / length) ** 2.5


def compose(dur, marks):
    N = int(round(dur * SR))
    nb = int(math.ceil(dur / BAR))
    bar_of = lambda s: int(round(s / BAR))  # noqa: E731
    drop_b, groove_b = max(1, bar_of(marks['drop'])), bar_of(marks.get('groove', marks['drop']))
    brk_a, brk_b = bar_of(marks['break'][0]), max(bar_of(marks['break'][1]), bar_of(marks['break'][0]) + 1)
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
        return 'calm'

    def chord(b):
        sec = section(b)
        if sec == 'end':
            return 'Cmaj9'
        if sec == 'final':
            return FINAL[(b - final_b) % 4]
        return LOOP[b % 4]

    pno = np.zeros((2, N))
    mel = np.zeros((2, N))
    pad = np.zeros((2, N))
    bass = np.zeros(N)
    drum = np.zeros((2, N))
    fx = np.zeros((2, N))
    K, Rm = kick(), rim()
    for b in range(nb):
        t0 = b * BAR
        sec = section(b)
        name = chord(b)
        lh, root, rh = CH[name]
        vel = {'intro': 0.6, 'calm': 0.7, 'groove': 0.8, 'break': 0.55, 'final': 0.9, 'end': 0.75}[sec]
        # 왼손: 베이스 + 화음
        add(pno, t0, np.stack([piano(root, 3.2, vel)] * 2) * np.array([[1.0], [0.7]]))
        for i, m in enumerate(lh):
            add(pno, t0 + 0.012 * i, np.stack([piano(m, 2.4, vel * 0.7)] * 2) * np.array([[0.8], [0.8]]))
        if sec in ('calm', 'groove', 'final'):
            add(pno, t0 + 2 * BEAT, np.stack([piano(lh[1], 1.6, vel * 0.55), piano(lh[2], 1.6, vel * 0.55)]))
        # 오른손 아르페지오(8분음표, 구간에 따라 밀도 조절)
        pat = [0, 2, 1, 3, 2, 1, 3, 2]
        steps = {'intro': [0, 2, 4, 6], 'calm': range(8), 'groove': range(8), 'break': [0, 4], 'final': range(8), 'end': [0, 2, 4]}[sec]
        for i in steps:
            m = rh[pat[i]]
            pan = 0.5 + 0.35 * ((m - 60) / 24)
            note = piano(m, 1.4, vel * (0.55 if i % 2 else 0.7))
            add(pno, t0 + i * BEAT / 2, np.stack([note * (1 - pan) * 1.4, note * pan * 1.4]))
        # 멜로디(높은 음, 그루브·피날레)
        if sec in ('groove', 'final') or (sec == 'end'):
            phrase = MELODY[name] if sec != 'end' else [(0, 76, 2), (2, 79, 2)]
            for (bt, m, d) in phrase:
                note = piano(m + 12 if sec == 'final' and bt == 0 else m, max(1.2, d * BEAT + 0.8), vel)
                add(mel, t0 + bt * BEAT, np.stack([note * 0.8, note]))
        # 패드·베이스
        if sec in ('calm', 'groove', 'break', 'final', 'end'):
            add(pad, t0, soft_pad(lh, BAR))
        if sec in ('groove', 'final'):
            add(bass, t0, sub_bass(root, BEAT * 2.5))
            add(bass, t0 + 2.5 * BEAT, sub_bass(root, BEAT * 1.4) * 0.7)
        # 드럼(부드럽게, 셔플 느낌)
        if sec in ('groove', 'final'):
            for beat in range(4):
                tb = t0 + beat * BEAT
                if beat in (0, 2):
                    add(drum, tb, np.stack([K, K]) * 0.8)
                if beat in (1, 3):
                    add(drum, tb, np.stack([Rm * 0.7, Rm]))
                for j, sw in enumerate((0, 0.58)):
                    sh = shaker() * (0.5 if j else 0.35)
                    add(drum, tb + sw * BEAT, np.stack([sh * 0.6, sh]))
    # 잠긴 카드 끝에서 차오르는 소리 → 상담 장면에서 풀림
    sw_len = min(2.5, max(1.0, final_b * BAR - brk_a * BAR))
    add(fx, final_b * BAR - sw_len, np.stack([swell(sw_len)] * 2) * 0.25)
    imp = marks['impact']
    n = int(2.5 * SR)
    t = tt(n)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 35 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.7)
    shimmer = hp(rng.standard_normal(n), 5000) * np.exp(-t / 0.6) * 0.15
    add(fx, imp, np.stack([boom * 0.5 + shimmer, boom * 0.5 + shimmer * 0.9]))
    for m in (84, 88, 91):  # 높은 피아노 반짝임
        add(mel, imp + 0.02 * (m - 84), np.stack([piano(m, 2.0, 0.6)] * 2) * 0.6)

    dry = pno * 0.55 + mel * 0.5 + pad * 0.5 + np.stack([bass, bass]) * 0.55 + drum * 0.35 + fx
    send = pno * 0.4 + mel * 0.5 + pad * 0.3
    ir = reverb_ir(2.4, 0.7)
    wet = np.stack([fftconvolve(send[0], ir[0])[:N], fftconvolve(send[1], ir[1])[:N]])
    mix = hp(dry + wet * 0.45, 30)
    fi = int(0.03 * SR)
    mix[:, :fi] *= np.linspace(0, 1, fi)
    fo0 = int(max(0, dur - 2.2) * SR)
    mix[:, fo0:] *= np.linspace(1, 0, N - fo0) ** 1.4
    mix = np.tanh(mix / (np.max(np.abs(mix)) + 1e-9) * 1.2) / np.tanh(1.2) * 0.89
    return mix
