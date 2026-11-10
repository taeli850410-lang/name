#!/usr/bin/env python3
"""성북2구역 영상용 60초 배경음악 — 코드로 직접 합성한 오리지널 곡(샘플·외부 음원 없음).

D장조, 120BPM(1박 0.5초, 1마디 2초). 장면 전환이 모두 정수 초라 박에 맞는다.
  0–4초    인트로: 패드 + 아르페지오 + 하이햇, 2–4초 라이저
  4초      드롭(2번 장면 시작): 킥·클랩·베이스 진입
  20–36초  멜로디 추가
  44–48초  브레이크다운(주의사항 구간, 드럼·베이스 빠짐)
  48–50초  빌드업(클랩 롤 + 라이저)
  50–58초  피날레(IV–V–vi–I) + 멜로디, 56.5초 '재개발 추천' 도장 임팩트
  58–60초  D 코드로 마무리, 페이드아웃
사용법: python3 music.py OUT.wav
"""
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
DUR = 60.0
N = int(SR * DUR)
BEAT = 0.5
BAR = 2.0
rng = np.random.default_rng(2026)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def add(buf, start, sig, gain=1.0):
    i = int(round(start * SR))
    if i >= buf.shape[-1]:
        return
    j = min(buf.shape[-1], i + sig.shape[-1])
    buf[..., i:j] += gain * sig[..., :j - i]


def env_adsr(n, a=0.01, r=0.1):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    if nr < n:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


# ───────── 화성 ─────────
CH = {  # 패드 보이싱, 베이스 근음, 아르페지오 음
    'Bm': ([59, 62, 66, 69], 47),
    'G': ([55, 59, 62, 66], 43),
    'D': ([57, 62, 64, 66], 50),
    'A': ([57, 61, 64, 69], 45),
}
LOOP = ['Bm', 'G', 'D', 'A']
N_BARS = 30


def chord_at(b):
    if b == 24:
        return 'A'
    if b >= 25:
        return ['G', 'A', 'Bm', 'D', 'D'][min(b - 25, 4)]
    return LOOP[(b + 2) % 4]


# ───────── 악기 ─────────
def pad_chord(notes, dur, bright):
    n = int((dur + 0.6) * SR)
    t = tt(n)
    out = np.zeros((2, n))
    for m in notes:
        f = hz(m)
        for ch, cents in ((0, (-9, 0, 6)), (1, (-5, 2, 10))):
            for c in cents:
                fr = f * 2 ** (c / 1200)
                ph = rng.random()
                out[ch] += 2 * ((fr * t + ph) % 1.0) - 1
    e = np.ones(n)
    na, nr = int(0.25 * SR), int(0.6 * SR)
    e[:na] = np.linspace(0, 1, na) ** 1.5
    e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    out *= e / (len(notes) * 3)
    return np.stack([lp(out[0], bright), lp(out[1], bright)])


def pluck(m, dur=0.7, bright=1.0):
    n = int(dur * SR)
    t = tt(n)
    f = hz(m)
    s = np.zeros(n)
    for k in range(1, 7):
        s += (1 / k ** 1.3) * np.sin(2 * np.pi * k * f * t + k) * np.exp(-t * (4 + 3.2 * k / bright))
    s *= env_adsr(n, 0.003, 0.05)
    return s * 0.6


def bass_note(m, dur=0.24):
    n = int(dur * SR)
    t = tt(n)
    f = hz(m)
    saw = 2 * ((f * t) % 1.0) - 1
    s = 0.55 * lp(saw, 700) + 0.7 * np.sin(2 * np.pi * f * t)
    return s * env_adsr(n, 0.004, 0.06) * np.exp(-t * 2.5)


def lead_note(m, dur):
    n = int((dur + 0.15) * SR)
    t = tt(n)
    f = hz(m)
    vib = 1 + (2 ** (8 / 1200) - 1) * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.15) / 0.2, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    s = np.sin(ph) + 0.18 * np.sin(3 * ph) + 0.06 * np.sin(5 * ph)
    e = env_adsr(n, 0.02, 0.15) * (0.85 + 0.15 * np.exp(-t * 3))
    return s * e * 0.5


def kick():
    n = int(0.45 * SR)
    t = tt(n)
    f = 46 + 95 * np.exp(-t / 0.035)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.003) * 0.25
    return np.tanh(1.6 * (s + click))


def clap():
    n = int(0.3 * SR)
    t = tt(n)
    noise = bp(rng.standard_normal(n), 900, 3800)
    e = np.zeros(n)
    for off in (0.0, 0.011, 0.022):
        i = int(off * SR)
        e[i:] += np.exp(-(t[:n - i]) / (0.12 if off == 0.022 else 0.008))
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04) * 0.4
    return (noise * e * 0.6 + body)


def hat(open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    t = tt(n)
    return hp(rng.standard_normal(n), 7500, 4) * np.exp(-t / (0.08 if open_ else 0.014))


def crash(length=1.8):
    n = int(length * SR)
    t = tt(n)
    s = hp(rng.standard_normal((2, n)), 4200, 2) * np.exp(-t / 0.55)
    return s


def riser(length=2.0):
    n = int(length * SR)
    t = tt(n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 2048
    zi = None
    for i in range(0, n, blk):
        fc = 400 + 7600 * (i / n) ** 2
        sos = butter(2, fc, 'low', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[i:i + blk], zi = sosfilt(sos, noise[i:i + blk], zi=zi)
    sweep = np.sin(2 * np.pi * np.cumsum(220 + 660 * (t / length) ** 2) / SR) * 0.15
    return (out + sweep) * (t / length) ** 2


def boom():
    n = int(1.4 * SR)
    t = tt(n)
    f = 38 + 60 * np.exp(-t / 0.08)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.5)


def reverb_ir(length=1.7, decay=0.45):
    n = int(length * SR)
    t = tt(n)
    ir = rng.standard_normal((2, n)) * np.exp(-t / decay)
    ir = np.stack([lp(ir[0], 6000), lp(ir[1], 6000)])
    ir[:, :int(0.012 * SR)] = 0  # 프리딜레이
    return ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))


def delay_pp(x, time=0.375, fb=0.38, taps=4):
    """모노 → 스테레오 핑퐁 딜레이."""
    out = np.zeros((2, x.shape[-1]))
    out[0] += x
    out[1] += x
    d = int(time * SR)
    g = 1.0
    for k in range(1, taps + 1):
        g *= fb
        ch = k % 2
        out[ch, d * k:] += g * x[:-d * k]
    return out


# ───────── 편곡 ─────────
def section(sec):
    if sec < 4:
        return 'intro'
    if 44 <= sec < 48:
        return 'break'
    if 48 <= sec < 50:
        return 'build'
    if sec >= 58:
        return 'end'
    if sec >= 50:
        return 'final'
    return 'main'


MELODY = {
    'Bm': ([(0, 78, 1.5), (1.5, 76, .5), (2, 74, 1), (3, 71, 1)], [(0, 74, 1), (1, 76, 1), (2, 78, 2)]),
    'G': ([(0, 74, 1.5), (1.5, 76, .5), (2, 78, 1), (3, 76, 1)], [(0, 79, 1.5), (1.5, 78, .5), (2, 74, 2)]),
    'D': ([(0, 78, 1), (1, 81, 1), (2, 78, 1.5), (3.5, 76, .5)], [(0, 81, 1.5), (1.5, 78, .5), (2, 81, 2)]),
    'A': ([(0, 76, 2), (2, 73, 1), (3, 76, 1)], [(0, 76, 1), (1, 74, 1), (2, 73, 2)]),
}
ARP_STEPS = [0, 2, 1, 3, 2, 0, 3, 1]
BASS_STEPS = [0, 3, 4, 6]  # 8분음표 위치


def compose(out_path):
    pad = np.zeros((2, N))
    arp = np.zeros(N)
    lead = np.zeros(N)
    bass = np.zeros(N)
    kicks = np.zeros(N)
    claps = np.zeros(N)
    hats = np.zeros((2, N))
    fx = np.zeros((2, N))
    kick_times = []

    K, C = kick(), clap()
    HC, HO = hat(), hat(True)

    for b in range(N_BARS):
        t0 = b * BAR
        sec = section(t0)
        name = chord_at(b)
        notes, root = CH[name]
        if sec == 'end':
            bright = 1600
        elif sec in ('break',):
            bright = 1100
        elif sec == 'intro':
            bright = 1300 + 700 * b
        else:
            bright = 2300
        pdur = BAR if sec != 'end' else 2.4
        add(pad, t0, pad_chord(notes, pdur, bright))

        # 아르페지오(8분음표, 한 옥타브 위)
        tones = [n + 12 for n in notes]
        if sec != 'end':
            for i, s in enumerate(ARP_STEPS):
                vel = 1.0 if i % 2 == 0 else 0.7
                add(arp, t0 + i * BEAT / 2, pluck(tones[s], bright=1.3 if sec == 'final' else 1.0), vel)
        else:
            for i, s in enumerate([0, 2, 3]):
                add(arp, t0 + i * BEAT, pluck(tones[s], 1.2), 0.8 - 0.2 * i)

        # 베이스
        if sec in ('main', 'final'):
            for st in BASS_STEPS:
                m = root + (12 if st == 6 else 0)
                add(bass, t0 + st * BEAT / 2, bass_note(m), 1.0 if st == 0 else 0.8)
        if sec == 'end':
            add(bass, t0, bass_note(root, 1.6) * np.exp(-tt(int(1.6 * SR)) * 0.5), 1.0)

        # 멜로디
        if 10 <= b <= 17 or 25 <= b <= 29:
            if b == 29:
                phrase = [(0, 78, 2)]
            elif b == 28:
                phrase = MELODY['D'][1]
            else:
                phrase = MELODY[name][b % 2]
            for (bt, m, d) in phrase:
                add(lead, t0 + bt * BEAT, lead_note(m, d * BEAT), 1.0)

        # 드럼
        for beat in range(4):
            tb = t0 + beat * BEAT
            if sec in ('main', 'final'):
                add(kicks, tb, K)
                kick_times.append(tb)
                if beat in (1, 3):
                    add(claps, tb, C)
            if sec in ('main', 'final') or (sec == 'intro' and t0 >= 2):
                add(hats[1], tb + BEAT / 2, HO if (sec == 'final' and beat == 3) else HC, 0.9)
                add(hats[0], tb + BEAT / 2, HC, 0.4)
            if sec == 'final' or (sec == 'main' and 20 <= tb < 44):
                add(hats[0], tb + BEAT / 4, HC, 0.35)
                add(hats[1], tb + 3 * BEAT / 4, HC, 0.35)

    # 빌드업: 클랩 롤(8분 → 16분)
    t = 48.0
    while t < 50.0 - 1e-6:
        step = BEAT / 2 if t < 49.0 else BEAT / 4
        add(claps, t, C, 0.35 + 0.5 * (t - 48) / 2)
        t += step
    # 라이저·크래시·임팩트
    add(fx, 2.0, np.stack([riser()] * 2), 0.9)
    add(fx, 48.0, np.stack([riser()] * 2), 1.0)
    for ct in (4.0, 20.0, 50.0):
        add(fx, ct, crash(), 1.0)
    add(fx, 56.5, crash(2.4), 1.3)
    add(kicks, 56.5, K, 1.0)
    add(kicks, 56.5, boom(), 0.8)
    add(fx, 58.0, crash(2.0), 0.8)
    add(kicks, 58.0, K, 0.9)
    kick_times += [56.5, 58.0]

    # 사이드체인(킥에 맞춰 패드·아르페지오·베이스가 숨쉬듯)
    sc = np.ones(N)
    tail = tt(int(0.3 * SR))
    duck = 1 - 0.45 * np.exp(-tail / 0.09)
    for kt in kick_times:
        i = int(kt * SR)
        j = min(N, i + duck.size)
        sc[i:j] = np.minimum(sc[i:j], duck[:j - i])

    # 드럼이 없는 구간(인트로·브레이크·빌드)은 멜로디 악기를 키워 음량 차이를 줄인다
    mg = np.ones(N)
    for a, b in ((0.0, 4.0), (44.0, 50.0)):
        mg[int(a * SR):int(b * SR)] = 1.9
    ramp = int(0.08 * SR)
    mg = np.convolve(mg, np.ones(ramp) / ramp, mode='same')
    pad *= mg
    arp *= mg

    arp_st = delay_pp(arp, fb=0.35)
    lead_st = delay_pp(lead, fb=0.25, taps=3) * 0.8
    lead_st[:, :] += np.stack([lead, lead]) * 0.2

    mix_dry = (pad * 0.55 + arp_st * 0.42 + np.stack([bass, bass]) * 0.5) * sc
    mix_dry += lead_st * 0.33
    mix_dry += np.stack([kicks, kicks]) * 0.85
    mix_dry += np.stack([claps, claps]) * 0.28
    mix_dry += hats * 0.09
    mix_dry += fx * 0.12

    send = pad * 0.25 + arp_st * 0.3 + lead_st * 0.3 + np.stack([claps, claps]) * 0.2
    ir = reverb_ir()
    wet = np.stack([fftconvolve(send[0], ir[0])[:N], fftconvolve(send[1], ir[1])[:N]])
    mix = mix_dry + wet * 0.35

    mix = hp(mix, 30)
    # 페이드 인/아웃
    fi = int(0.03 * SR)
    mix[:, :fi] *= np.linspace(0, 1, fi)
    fo0 = int(58.6 * SR)
    mix[:, fo0:] *= np.linspace(1, 0, N - fo0) ** 1.6
    mix = np.tanh(mix / (np.max(np.abs(mix)) + 1e-9) * 1.4) / np.tanh(1.4) * 0.89

    data = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


if __name__ == '__main__':
    compose(sys.argv[1])
