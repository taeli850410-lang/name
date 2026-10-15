"""영상용 배경음악을 직접 합성한다. 외부 음원을 쓰지 않으니 저작권 걱정이 없다.

    python3 bgm.py <길이(초)> <출력.wav> [시드]

76 BPM, Fmaj7 - Em7 - Dm7 - Cmaj7 를 한 마디씩 돈다. 패드 + 베이스 + 잔잔한 아르페지오에
잔향을 얹고, 소리 크기는 RMS -20 dBFS 언저리로 맞춘다.
"""
import sys
import wave

import numpy as np

SR = 48000
BPM = 76
BEAT = 60 / BPM
BAR = BEAT * 4

CHORDS = [  # (베이스 루트, 패드 화음) — MIDI 번호
    (41, [53, 57, 60, 64]),  # Fmaj7
    (40, [52, 55, 59, 62]),  # Em7
    (38, [50, 53, 57, 60]),  # Dm7
    (36, [48, 52, 55, 59]),  # Cmaj7
]
ARP = [0, 2, 1, 3, 2, 1, 3, 2]  # 8분음표마다 화음의 몇 번째 음을 칠지


def hz(m, cents=0.0):
    return 440.0 * 2 ** ((m - 69 + cents / 100) / 12)


def tail(sig, seconds=0.08):
    """음 끝을 잘라 낸 자리에서 '틱' 소리가 나지 않게 끝을 부드럽게 닫는다."""
    n = int(seconds * SR)
    sig[:, -n:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, n)))
    return sig


def add(buf, start, sig):
    sig = tail(sig.copy())
    i = int(start * SR)
    if i >= buf.shape[1]:
        return
    n = min(sig.shape[1], buf.shape[1] - i)
    buf[:, i:i + n] += sig[:, :n]


def pad(m, dur):
    t = np.arange(int((dur + 1.2) * SR)) / SR
    env = np.minimum(t / 0.7, 1.0) * np.where(t > dur, np.exp(-(t - dur) / 0.45), 1.0)
    out = []
    for c in (-2.0, 2.0):  # 좌우를 살짝 어긋나게 해서 폭을 만든다
        f = hz(m, c)
        s = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(4 * np.pi * f * t) + 0.06 * np.sin(6 * np.pi * f * t)
        out.append(s * env * (1 + 0.08 * np.sin(2 * np.pi * 0.23 * t)))
    return np.array(out) * 0.055


def bass(m, dur=1.2):
    t = np.arange(int(dur * SR)) / SR
    f = hz(m)
    env = np.minimum(t / 0.012, 1.0) * np.exp(-t / 0.55)
    s = (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t)) * env * 0.10
    return np.array([s, s])


def bell(m, vel, pan):
    t = np.arange(int(2.2 * SR)) / SR
    f = hz(m)
    env = np.minimum(t / 0.004, 1.0) * np.exp(-t / 0.7)
    s = (np.sin(2 * np.pi * f * t)
         + 0.45 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.18)
         + 0.08 * np.sin(6 * np.pi * f * t) * np.exp(-t / 0.09)) * env * vel * 0.095
    return np.array([s * (1 - pan), s * (1 + pan)])


def reverb(x, seconds=2.4, wet=0.28, seed=7):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.empty_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / 0.55)
        ir = np.convolve(ir, np.ones(24) / 24, mode="same")  # 고음을 눌러 잔향을 부드럽게
        ir /= np.sqrt(np.sum(ir ** 2))
        size = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
        y = np.fft.irfft(np.fft.rfft(x[ch], size) * np.fft.rfft(ir, size), size)[: x.shape[1]]
        out[ch] = x[ch] + wet * y
    return out


def band(x, low=40.0, high=5500.0):
    size = x.shape[1]
    f = np.fft.rfftfreq(size, 1 / SR)
    f[0] = 1e-6
    h = 1 / np.sqrt(1 + (f / high) ** 4) / np.sqrt(1 + (low / f) ** 4)
    return np.array([np.fft.irfft(np.fft.rfft(c) * h, size) for c in x])


def main():
    seconds = float(sys.argv[1])
    path = sys.argv[2]
    rng = np.random.default_rng(int(sys.argv[3]) if len(sys.argv) > 3 else 2026)  # 시드만 바꿔도 아르페지오가 달라진다
    buf = np.zeros((2, int((seconds + 3) * SR)))
    bars = int(np.ceil(seconds / BAR)) + 1

    for b in range(bars):
        root, notes = CHORDS[b % 4]
        t0 = b * BAR
        for m in notes:
            add(buf, t0, pad(m, BAR))
        add(buf, t0, bass(root))
        add(buf, t0 + 2 * BEAT, bass(root) * 0.7)
        if 2 <= b < bars - 2:  # 앞뒤 두 마디는 패드만
            for k, idx in enumerate(ARP):
                if rng.random() < 0.18:
                    continue
                m = notes[idx] + 12
                add(buf, t0 + k * BEAT / 2, bell(m, rng.uniform(0.55, 0.85), rng.uniform(-0.35, 0.35)))

    buf = band(reverb(buf))
    buf = buf[:, : int(seconds * SR)]
    buf -= buf.mean(axis=1, keepdims=True)

    rms = np.sqrt(np.mean(buf ** 2))
    buf *= 10 ** (-20 / 20) / rms
    peak = np.max(np.abs(buf))
    if peak > 10 ** (-1.5 / 20):
        buf *= 10 ** (-1.5 / 20) / peak

    pcm = (np.clip(buf.T, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"{path}: {seconds:.1f}s, rms {20*np.log10(np.sqrt(np.mean(buf**2))):.1f} dBFS, "
          f"peak {20*np.log10(np.max(np.abs(buf))):.1f} dBFS")


if __name__ == "__main__":
    main()
