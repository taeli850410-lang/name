#!/usr/bin/env python3
"""v2 배경음악 — 영상 길이·장면 시각에 맞춰 편곡하는 오리지널 곡(외부 음원 없음).

music.py의 악기(직접 합성)를 그대로 쓰고, 구간만 장면 시각에 맞춘다.
  marks = {'drop': 2번 장면 시작, 'break': (7번 시작, 7번 끝), 'final': 8번 시작, 'impact': 도장 시각}
"""
import math

import numpy as np

import music as M
from music import (BEAT, BAR, CH, MELODY, ARP_STEPS, BASS_STEPS, SR, add, bass_note, boom, clap,
                   crash, delay_pp, hat, hp, kick, lead_note, pad_chord, pluck, reverb_ir, riser, tt)
from scipy.signal import fftconvolve

LOOP = ['Bm', 'G', 'D', 'A']
FINAL_PROG = ['G', 'A', 'Bm', 'D']


def compose(dur, marks):
    N = int(round(dur * SR))
    n_bars = int(math.ceil(dur / BAR))
    bar_of = lambda s: int(round(s / BAR))  # noqa: E731
    drop_b = max(1, bar_of(marks['drop']))
    brk_a, brk_b = bar_of(marks['break'][0]), bar_of(marks['break'][1])
    final_b = max(brk_b + 1, bar_of(marks['final']))
    end_b = n_bars - 1  # 마지막 마디: 여운

    def section(b):
        if b < drop_b:
            return 'intro'
        if b >= end_b:
            return 'end'
        if b >= final_b:
            return 'final'
        if final_b - 1 <= b < final_b:
            return 'build'
        if brk_a <= b < brk_b:
            return 'break'
        return 'main'

    def chord_at(b):
        sec = section(b)
        if sec == 'end':
            return 'D'
        if sec == 'final':
            k = b - final_b
            left = end_b - final_b
            # 마지막 마디가 D(으뜸화음)로 끝나도록 거꾸로 맞춘다
            return FINAL_PROG[(k - left) % 4]
        if sec == 'build':
            return 'A'
        return LOOP[(b - drop_b) % 4]

    pad = np.zeros((2, N))
    arp = np.zeros(N)
    lead = np.zeros(N)
    bass = np.zeros(N)
    kicks = np.zeros(N)
    claps = np.zeros(N)
    hats = np.zeros((2, N))
    fx = np.zeros((2, N))
    kick_times = []
    K, C, HC, HO = kick(), clap(), hat(), hat(True)

    for b in range(n_bars):
        t0 = b * BAR
        sec = section(b)
        name = chord_at(b)
        notes, root = CH[name]
        bright = {'end': 1600, 'break': 1100, 'build': 1500}.get(sec, 2300)
        if sec == 'intro':
            bright = 1200 + 900 * b / max(1, drop_b)
        add(pad, t0, pad_chord(notes, BAR if sec != 'end' else 2.6, bright))
        tones = [n + 12 for n in notes]
        if sec != 'end':
            for i, s in enumerate(ARP_STEPS):
                add(arp, t0 + i * BEAT / 2, pluck(tones[s], bright=1.3 if sec == 'final' else 1.0),
                    1.0 if i % 2 == 0 else 0.7)
        else:
            for i, s in enumerate([0, 2, 3]):
                add(arp, t0 + i * BEAT, pluck(tones[s], 1.2), 0.8 - 0.2 * i)
        if sec in ('main', 'final'):
            for st in BASS_STEPS:
                add(bass, t0 + st * BEAT / 2, bass_note(root + (12 if st == 6 else 0)), 1.0 if st == 0 else 0.8)
        if sec == 'end':
            add(bass, t0, bass_note(root, 1.6) * np.exp(-tt(int(1.6 * SR)) * 0.5), 1.0)
        if sec == 'final' or (sec == 'main' and (b - drop_b) % 16 >= 8):
            phrase = MELODY[name][b % 2] if sec != 'final' or b < end_b - 1 else MELODY['D'][1]
            for (bt, m, d) in phrase:
                add(lead, t0 + bt * BEAT, lead_note(m, d * BEAT), 1.0)
        if sec == 'end':
            add(lead, t0, lead_note(78, 2 * BEAT), 0.9)
        for beat in range(4):
            tb = t0 + beat * BEAT
            if sec in ('main', 'final'):
                add(kicks, tb, K)
                kick_times.append(tb)
                if beat in (1, 3):
                    add(claps, tb, C)
            if sec in ('main', 'final') or (sec == 'intro' and b >= drop_b - 1):
                add(hats[1], tb + BEAT / 2, HO if (sec == 'final' and beat == 3) else HC, 0.9)
                add(hats[0], tb + BEAT / 2, HC, 0.4)
            if sec == 'final':
                add(hats[0], tb + BEAT / 4, HC, 0.35)
                add(hats[1], tb + 3 * BEAT / 4, HC, 0.35)
        if sec == 'build':
            t = t0
            while t < t0 + BAR - 1e-6:
                step = BEAT / 2 if t < t0 + BAR / 2 else BEAT / 4
                add(claps, t, C, 0.35 + 0.5 * (t - t0) / BAR)
                t += step

    add(fx, max(0.0, drop_b * BAR - 2.0), np.stack([riser()] * 2), 0.9)
    add(fx, (final_b - 1) * BAR, np.stack([riser()] * 2), 1.0)
    add(fx, drop_b * BAR, crash(), 1.0)
    add(fx, final_b * BAR, crash(), 1.0)
    imp = marks['impact']
    add(fx, imp, crash(2.4), 1.3)
    add(kicks, imp, K, 1.0)
    add(kicks, imp, boom(), 0.8)
    kick_times.append(imp)

    sc = np.ones(N)
    tail = tt(int(0.3 * SR))
    duck = 1 - 0.45 * np.exp(-tail / 0.09)
    for kt in kick_times:
        i = int(kt * SR)
        j = min(N, i + duck.size)
        if i < N:
            sc[i:j] = np.minimum(sc[i:j], duck[:j - i])

    mg = np.ones(N)
    for b in range(n_bars):
        if section(b) in ('intro', 'break', 'build'):
            mg[int(b * BAR * SR):int(min(N, (b + 1) * BAR * SR))] = 1.9
    ramp = int(0.08 * SR)
    mg = np.convolve(mg, np.ones(ramp) / ramp, mode='same')
    pad *= mg
    arp *= mg

    arp_st = delay_pp(arp, fb=0.35)
    lead_st = delay_pp(lead, fb=0.25, taps=3) * 0.8 + np.stack([lead, lead]) * 0.2
    mix = (pad * 0.55 + arp_st * 0.42 + np.stack([bass, bass]) * 0.5) * sc
    mix += lead_st * 0.33 + np.stack([kicks, kicks]) * 0.85 + np.stack([claps, claps]) * 0.28
    mix += hats * 0.09 + fx * 0.12
    send = pad * 0.25 + arp_st * 0.3 + lead_st * 0.3 + np.stack([claps, claps]) * 0.2
    ir = reverb_ir()
    wet = np.stack([fftconvolve(send[0], ir[0])[:N], fftconvolve(send[1], ir[1])[:N]])
    mix = hp(mix + wet * 0.35, 30)
    fi = int(0.03 * SR)
    mix[:, :fi] *= np.linspace(0, 1, fi)
    fo0 = int(max(0, dur - 1.6) * SR)
    mix[:, fo0:] *= np.linspace(1, 0, N - fo0) ** 1.6
    mix = np.tanh(mix / (np.max(np.abs(mix)) + 1e-9) * 1.4) / np.tanh(1.4) * 0.89
    return mix
