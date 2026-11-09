"""배경음악을 코드로 작곡·합성한다 → assets/bgm/bgm.mp3

외부 음원·생성 모델을 쓰지 않으므로 저작권·라이선스 걱정이 없고, 몇 번을 돌려도 같은 소리가 나온다.
필요: numpy, scipy, ffmpeg.  실행: python tools/bgm.py

- 템포는 약 116 BPM. 마디 경계 두 곳을 영상에 맞춘다:
  · 12마디 시작 = "그 문턱을 넘습니다"에서 도장이 찍히는 순간(s05 stamp) → 1마디 쉬었다가 다시 들어온다
  · 27마디 시작 = 끝 화면으로 컷되는 순간 → 마지막 한 방(C 화음)과 함께 울림을 남기고 끝난다
- 코드: Am – F – C – G 반복, 끝은 C(add9)로 밝게 닫는다
- 내레이션이 나오는 동안은 음악을 낮춘다(덕킹). 말소리 대역(1~4 kHz)은 음악에서 조금 비워 둔다
"""
import json
import os
import subprocess

import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
TOTAL = 60.0
N = int(SR * TOTAL)
rng = np.random.default_rng(11)

timing = json.load(open(os.path.join(HERE, "timing.json"), encoding="utf-8"))
L = {line["id"]: line for line in timing["lines"]}

# ------------------------------------------------------------------ 박자: 두 순간에 마디를 맞춘다 (build.py 와 같은 계산)
# s05 도장 = "문턱을" 단어 시작, 끝 화면 = 마지막 줄 끝 + 0.55 s
stamp_t = next(w["s"] for w in L["l06"]["words"] if "문턱" in w["w"])
end_card = L["l12"]["end"] + 0.55
BAR = (end_card - stamp_t) / 15  # 12마디 → 27마디
T0 = stamp_t - 12 * BAR  # 0마디 시작(0보다 조금 이르다)
BEAT = BAR / 4
STEP = BAR / 16
print(f"BPM {240 / BAR:.2f}  bar {BAR:.4f}s  t0 {T0:.3f}s  stamp {stamp_t:.3f}s  end card {end_card:.3f}s")


def at(bar, step=0.0):
    return T0 + bar * BAR + step * STEP


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ------------------------------------------------------------------ 버스(트랙)
def bus():
    return np.zeros((2, N))


drums, bass, pad, arp, fx = bus(), bus(), bus(), bus(), bus()


def place(dst, x, t, gain=1.0, pan=0.0):
    """mono x 를 시각 t 에 놓는다. pan -1(왼쪽)~1(오른쪽)."""
    i = int(round(t * SR))
    if i >= N:
        return
    if i < 0:
        x = x[-i:]
        i = 0
    x = x[: N - i]
    lg = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
    rg = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
    dst[0, i:i + len(x)] += x * gain * lg
    dst[1, i:i + len(x)] += x * gain * rg


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "highpass", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "lowpass", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x)


def saw(f, t, fmax=4000.0, hdecay=0.0, phase=0.0):
    """대역 제한 톱니파. hdecay>0 이면 높은 배음일수록 빨리 사라진다(필터 엔벌로프 흉내)."""
    out = np.zeros_like(t)
    k = 1
    while k * f < min(fmax, SR / 2 - 1000):
        amp = 1.0 / k
        if hdecay:
            amp = amp * np.exp(-t * hdecay * (k - 1))
        out += amp * np.sin(2 * np.pi * k * f * t + phase * k)
        k += 1
    return out * 0.55


def env_adsr(n, a, r, sus_end=None):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na) ** 1.5
    nr = max(1, int(r * SR))
    if nr < n:
        e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


# ------------------------------------------------------------------ 악기
def kick(vel=1.0):
    t = tt(0.5)
    f = 46 + 120 * np.exp(-t / 0.028)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.26)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.6 * (body + click)) * vel


def clap(vel=1.0):
    t = tt(0.4)
    n = rng.standard_normal(len(t))
    e = np.zeros_like(t)
    for d in (0.0, 0.011, 0.022):  # 손뼉 세 겹
        m = t >= d
        e[m] += np.exp(-(t[m] - d) / (0.012 if d < 0.02 else 0.14))
    x = bp(n, 1100, 9000) * e
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.04) * 0.35
    return (x * 0.7 + tone) * vel


def hat(vel=1.0, open_=False):
    t = tt(0.4 if open_ else 0.08)
    x = hp(rng.standard_normal(len(t)), 7500, 4) * np.exp(-t / (0.16 if open_ else 0.022))
    return x * vel


def snare_roll_hit(vel=1.0):
    t = tt(0.18)
    return (bp(rng.standard_normal(len(t)), 1500, 9000) * np.exp(-t / 0.05) * 0.8
            + np.sin(2 * np.pi * 200 * t) * np.exp(-t / 0.03) * 0.3) * vel


def bass_note(m, dur, vel=1.0):
    t = tt(dur + 0.05)
    f = mtof(m)
    x = saw(f, t, fmax=1800, hdecay=9.0) + 0.9 * np.sin(2 * np.pi * f * t)
    e = np.exp(-t / 0.5) * env_adsr(len(t), 0.004, 0.05)
    return np.tanh(1.3 * x * e) * vel


def pad_chord(notes, dur):
    t = tt(dur + 0.6)
    outL, outR = np.zeros_like(t), np.zeros_like(t)
    for m in notes:
        f = mtof(m)
        for j, (cents, pan) in enumerate(((-9, -0.7), (0, 0.0), (8, 0.7))):
            fr = f * 2 ** (cents / 1200)
            x = saw(fr, t, fmax=2600, phase=rng.uniform(0, 2 * np.pi))
            outL += x * np.cos((pan + 1) * np.pi / 4)
            outR += x * np.sin((pan + 1) * np.pi / 4)
    e = env_adsr(len(t), 0.25, 0.6)
    return np.stack([outL * e, outR * e]) / (len(notes) * 2.0)


def pluck(m, vel=1.0):
    t = tt(0.45)
    f = mtof(m)
    x = saw(f, t, fmax=6000, hdecay=22.0) + 0.3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.05)
    return x * np.exp(-t / 0.16) * env_adsr(len(t), 0.002, 0.03) * vel


def riser(dur):
    t = tt(dur)
    u = t / dur
    noise = hp(rng.standard_normal(len(t)), 3000) * (u ** 2.2)
    f = 180 * (8 ** u)  # 위로 3옥타브
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (u ** 2) * 0.25
    return noise * 0.5 + tone


def impact():
    t = tt(3.5)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.9)
    crash = hp(rng.standard_normal(len(t)), 4500, 2) * np.exp(-t / 1.2) * 0.35
    return np.tanh(1.4 * boom) * 0.9 + crash


# ------------------------------------------------------------------ 편곡
CHORDS = {  # (베이스, 패드 화음, 아르페지오 음)
    "Am": (33, [57, 60, 64, 71], [69, 72, 76, 79]),
    "F": (29, [53, 57, 60, 67], [65, 69, 72, 76]),
    "C": (36, [55, 60, 64, 74], [67, 72, 76, 79]),
    "G": (31, [55, 59, 62, 69], [67, 71, 74, 78]),
}
CYCLE = ["Am", "F", "C", "G"]
LAST_BAR = 27  # 끝 화면
chord_of = {b: CYCLE[b % 4] for b in range(LAST_BAR + 1)}
chord_of[25], chord_of[26], chord_of[27] = "F", "G", "C"  # 끝 화면 마디는 C 로 풀린다

BREAK = {11}  # 도장 직전 한 마디: 킥·베이스를 빼고 라이저
BUILD = {26}  # 끝 화면 직전 한 마디: 스네어 롤 + 라이저
INTRO = {0, 1}
LIFT = set(range(12, 20)) | {LAST_BAR}  # 판정 뒤와 끝 화면 — 오픈 하이햇, 16분 아르페지오로 조금 더 힘 있게
kicks = []

for b in range(LAST_BAR + 1):
    ch = chord_of[b]
    root, padn, arpn = CHORDS[ch]
    # 패드
    place_t = at(b)
    pc = pad_chord(padn, BAR)
    i = int(round(place_t * SR))
    j0 = max(0, -i)
    seg = pc[:, j0: max(j0, min(pc.shape[1], N - i))]
    if seg.shape[1]:
        pad[:, max(i, 0): max(i, 0) + seg.shape[1]] += seg
    # 아르페지오: 8분음표, LIFT 구간은 16분
    pattern = [0, 2, 1, 3, 2, 1, 3, 2] if b not in LIFT else [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]
    stepw = 16 // len(pattern)
    for k, p in enumerate(pattern):
        v = (0.9 if k % 4 == 0 else 0.6) * (0.55 if b in INTRO else 1.0)
        place(arp, pluck(arpn[p], v), at(b, k * stepw), pan=(-0.35 if k % 2 else 0.35))
    if b in BREAK:
        place(fx, riser(BAR), at(b), 0.5)
        for s in range(8, 16):  # 뒤 반 마디 스네어 롤
            place(drums, snare_roll_hit(0.25 + 0.55 * (s - 8) / 7), at(b, s), 0.55)
        continue
    # 베이스: 8분음표 근음, 마디 끝은 옥타브 위로 튕긴다
    if b not in INTRO:
        for s in range(0, 16, 2):
            m = root + (12 if s in (6, 14) else 0)
            place(bass, bass_note(m, STEP * 2 * 0.92, 0.95 if s % 4 == 0 else 0.75), at(b, s))
    else:
        place(bass, bass_note(root, BAR * 0.95, 0.6), at(b))
    # 드럼
    kick_steps = [0, 8] if b in INTRO else [0, 4, 8, 12]
    for s in kick_steps:
        place(drums, kick(1.0), at(b, s))
        kicks.append(at(b, s))
    if b not in INTRO:
        for s in (4, 12):
            place(drums, clap(0.55), at(b, s), pan=0.05)
    for s in range(16):
        if s % 4 == 2:
            place(drums, hat(0.42), at(b, s), pan=0.25)
        elif s % 2 == 1 and b not in INTRO:
            place(drums, hat(0.14), at(b, s), pan=0.3)
    if b in LIFT and b % 2 == 1:
        place(drums, hat(0.22, open_=True), at(b, 14), pan=0.3)
    if b in BUILD:
        place(fx, riser(BAR), at(b), 0.6)
        for s in range(16):  # 앞 반 마디는 8분, 뒤 반 마디는 16분
            if s >= 8 or s % 2 == 0:
                place(drums, snare_roll_hit(0.2 + 0.6 * s / 15), at(b, s), 0.6)

# 끝 화면으로 컷되는 순간 한 방, 다음 마디 첫 박에 C(add9) 화음으로 닫고 울림을 남긴다
place(fx, impact(), at(LAST_BAR), 0.55)
t_end = at(LAST_BAR + 1)
place(drums, kick(1.0), t_end)
place(drums, hat(0.3, open_=True), t_end, pan=0.3)
final = pad_chord([48, 55, 60, 64, 67, 74], TOTAL - t_end + 0.2) * 1.5
i = int(round(t_end * SR))
pad[:, i: i + min(final.shape[1], N - i)] += final[:, : N - i]
place(bass, bass_note(36, 2.5, 0.9), t_end)
for k, m in enumerate([72, 76, 79, 84]):  # 마지막 아르페지오 한 번
    place(arp, pluck(m, 0.7 - 0.1 * k), t_end + k * STEP * 2, pan=(-0.3 if k % 2 else 0.3))
kicks.append(t_end)

# ------------------------------------------------------------------ 사이드체인(킥이 칠 때 패드·베이스·아르페지오가 숨을 쉰다)
sc = np.ones(N)
for kt in kicks:
    i = int(round(kt * SR))
    if 0 <= i < N:
        n = min(int(0.32 * SR), N - i)
        u = np.arange(n) / SR
        sc[i:i + n] = np.minimum(sc[i:i + n], 1 - 0.55 * np.exp(-u / 0.11))
pad *= sc
bass *= sc ** 0.7
arp *= sc ** 0.5


# ------------------------------------------------------------------ 공간감: 짧은 리버브(합성 임펄스) + 핑퐁 딜레이
def reverb(x, sec=1.6, mix=0.25):
    t = tt(sec)
    ir = rng.standard_normal((2, len(t))) * np.exp(-t / (sec / 5.5))
    ir = np.stack([lp(ir[0], 6000), lp(ir[1], 6000)])
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    wet = np.stack([signal.fftconvolve(x[0], ir[0])[:N], signal.fftconvolve(x[1], ir[1])[:N]])
    return x + wet * mix


def pingpong(x, delay, fb=0.35, mix=0.22):
    d = int(delay * SR)
    out = np.zeros_like(x)
    tap = x.copy()
    for _ in range(4):
        tap = np.roll(tap, d, axis=1)
        tap[:, :d] = 0
        tap = tap[::-1] * fb  # 메아리가 좌우를 번갈아 오간다
        out += tap
    return x + out * mix


pad = reverb(lp(pad, 3200), 2.2, 0.35)
arp = reverb(pingpong(hp(arp, 250), BEAT * 0.75), 1.4, 0.22)
drums_wet = reverb(drums, 0.9, 0.12)
bass = lp(bass, 900)

mix = 1.0 * drums_wet + 0.85 * bass + 0.55 * pad + 0.4 * arp + 0.5 * fx


# ------------------------------------------------------------------ 말소리 자리 비우기: 2.5 kHz 를 넓게 -4 dB, 저역 정리
def peaking(x, f0, gain_db, q):
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * f0 / SR
    al = np.sin(w) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w), 1 - al * A]
    a = [1 + al / A, -2 * np.cos(w), 1 - al / A]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x)


mix = np.stack([peaking(hp(c, 32), 2500, -4.0, 0.7) for c in mix])

# ------------------------------------------------------------------ 덕킹: 내레이션이 나오면 -9 dB
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, "assets/voice/narration.wav"),
                      "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
voice = np.frombuffer(pcm, dtype=np.float32)
hop = SR // 100
voice = np.concatenate([voice[:N], np.zeros(max(0, N - len(voice)))])  # 내레이션이 끝난 뒤는 무음
frames = N // hop
rms = np.sqrt(np.mean(voice[: frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
db = 20 * np.log10(rms)
on = (db > -45).astype(float)
# 말 사이 짧은 틈(0.25 s 미만)은 메워서 음악이 들썩이지 않게
on = np.convolve(on, np.ones(25) / 25, mode="same") > 0.04
g = np.where(on, 10 ** (-9 / 20), 1.0)
sm = np.empty_like(g)
cur = 1.0
for k, v in enumerate(g):  # 내려갈 땐 60 ms, 올라올 땐 400 ms
    a = 1 - np.exp(-1 / (6 if v < cur else 40))
    cur += (v - cur) * a
    sm[k] = cur
duck = np.ones(N)
xs = np.arange(N) / hop
duck[: frames * hop] = np.interp(xs[: frames * hop], np.arange(frames), sm)
duck[frames * hop:] = sm[-1] if frames else 1.0
mix *= duck

# ------------------------------------------------------------------ 마무리: 시작 페이드인, 끝 페이드아웃, 부드러운 리미터
fade_in = int(0.12 * SR)
mix[:, :fade_in] *= np.linspace(0, 1, fade_in)
fo0 = int((TOTAL - 1.3) * SR)
mix[:, fo0:] *= np.linspace(1, 0, N - fo0) ** 1.5
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(1.25 * mix) / np.tanh(1.25)
mix *= 10 ** (-1.0 / 20)

os.makedirs(os.path.join(HERE, "assets/bgm"), exist_ok=True)
raw = os.path.join(HERE, "assets/bgm/.bgm.f32")
mix.T.astype(np.float32).tofile(raw)
out = os.path.join(HERE, "assets/bgm/bgm.mp3")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw,
                "-c:a", "libmp3lame", "-b:a", "256k", out], check=True)
os.remove(raw)
print("wrote", os.path.relpath(out, HERE), f"{os.path.getsize(out) / 1e6:.1f} MB")
