"""한국어 발음이 자연스러운 Supertonic 음성 → Chatterbox 음성 변환(S3Gen)으로 기준 목소리 음색만 입힌다."""
import os, sys, wave
import numpy as np
import onnxruntime as ort
from scipy.signal import resample_poly
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from tts_chatterbox import MD, load_audio
SR = 24000

class VC:
    def __init__(self, ref_path, ref_dur=9.7):
        so = ort.SessionOptions(); so.intra_op_num_threads = os.cpu_count() or 4
        self.enc = ort.InferenceSession(f'{MD}/onnx/speech_encoder.onnx', so, providers=['CPUExecutionProvider'])
        self.dec = ort.InferenceSession(f'{MD}/onnx/conditional_decoder.onnx', so, providers=['CPUExecutionProvider'])
        ref = load_audio(ref_path, SR, 0.0, ref_dur)[None, :]
        _, self.tok, self.xv, self.feat = self.enc.run(None, {'audio_values': ref})
        self.ref_xv = self.xv

    def tokens(self, x):
        return self.enc.run(None, {'audio_values': x.astype(np.float32)[None, :]})[1]

    def convert(self, x):
        """x: 24kHz mono float (<=10s). 기준 목소리로 바꾼 24kHz 음성을 돌려준다."""
        src = self.tokens(x)
        speech = np.concatenate([self.tok, src], axis=1).astype(np.int64)
        wav = self.dec.run(None, {'speech_tokens': speech, 'speaker_embeddings': self.xv, 'speaker_features': self.feat})[0]
        return np.squeeze(wav, 0).astype(np.float64)

    def xvec(self, x):
        return self.enc.run(None, {'audio_values': x.astype(np.float32)[None, :]})[2][0]

def cos(a, b): return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
