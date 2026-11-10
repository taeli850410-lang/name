import sys, glob, wave, numpy as np
from scipy.signal import resample_poly
sys.path.insert(0, '.')
from faster_whisper import WhisperModel
from tts_local import READ
m = WhisperModel('small', device='cpu', compute_type='int8')
which = [int(a) for a in sys.argv[1:]] or list(range(1, 10))
for i in which:
    with wave.open(f'voice/scene_{i:02d}.wav') as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32768
    segs, _ = m.transcribe(resample_poly(x, 16000, sr).astype(np.float32), language='ko', beam_size=5)
    print(f'[{i}] 대본: {READ[i-1]}\n    인식: ' + ' '.join(s.text.strip() for s in segs), flush=True)
