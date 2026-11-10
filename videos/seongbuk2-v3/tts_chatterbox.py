#!/usr/bin/env python3
"""Chatterbox Multilingual(ONNX, MIT)로 첨부 음성의 목소리를 복제해 장면별 내레이션을 만든다.

  python3 tts_chatterbox.py REF.wav            # 전체 장면
  python3 tts_chatterbox.py REF.wav 6 7        # 일부 장면만 (다른 샘플링으로 다시)
모델: onnx-community/chatterbox-multilingual-ONNX (MODEL_DIR, 기본 /root/cbx/model)
숫자는 오독을 막기 위해 한글로 풀어 쓴 낭독용 대본(tts_local.READ)을 쓴다.
"""
import json
import os
import subprocess
import sys
import time
import wave

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tts import chunk_bounds, trim  # noqa: E402
from tts_local import READ  # noqa: E402

MD = os.environ.get('MODEL_DIR', '/root/cbx/model')
SR = 24000
START, STOP = 6561, 6562
N_LAYERS, N_KV, HEAD = 30, 16, 64
VOICE_DIR = os.path.join(HERE, 'voice')
EXAG = float(os.environ.get('EXAG', '0.45'))


def korean_normalize(text):
    out = []
    for ch in text:
        if '가' <= ch <= '힣':
            b = ord(ch) - 0xAC00
            out.append(chr(0x1100 + b // 588) + chr(0x1161 + (b % 588) // 28) + (chr(0x11A7 + b % 28) if b % 28 else ''))
        else:
            out.append(ch)
    return ''.join(out).strip()


def load_audio(path, sr=SR, start=0.0, dur=None):
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(start)] + (['-t', str(dur)] if dur else []) + \
          ['-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32)


class Chatterbox:
    def __init__(self, ref_path, ref_start=0.0, ref_dur=9.7):
        so = ort.SessionOptions()
        so.intra_op_num_threads = os.cpu_count() or 4
        o = lambda n: ort.InferenceSession(os.path.join(MD, 'onnx', n), so, providers=['CPUExecutionProvider'])  # noqa: E731
        self.enc, self.emb = o('speech_encoder.onnx'), o('embed_tokens.onnx')
        self.lm, self.dec = o('language_model.onnx'), o('conditional_decoder.onnx')
        self.tok = Tokenizer.from_file(os.path.join(MD, 'tokenizer.json'))
        ref = load_audio(ref_path, SR, ref_start, ref_dur)[None, :]
        self.cond_emb, self.prompt_tok, self.ref_x, self.prompt_feat = self.enc.run(None, {'audio_values': ref})

    def synth(self, text, exaggeration=EXAG, temp=0.0, top_p=0.9, seed=0, max_new=700, rep=1.2):
        rng = np.random.default_rng(seed)
        ids = np.array([self.tok.encode('[ko]' + korean_normalize(text)).ids], np.int64)
        pos = np.where(ids >= START, 0, np.arange(ids.shape[1])[None, :] - 1).astype(np.int64)
        feed = {'input_ids': ids, 'position_ids': pos, 'exaggeration': np.array([exaggeration], np.float32)}
        gen = np.array([[START]], np.int64)
        past = None
        mask = None
        ended = False
        for i in range(max_new):
            emb = self.emb.run(None, feed)[0]
            if i == 0:
                emb = np.concatenate((self.cond_emb, emb), axis=1)
                past = {f'past_key_values.{l}.{kv}': np.zeros([1, N_KV, 0, HEAD], np.float32)
                        for l in range(N_LAYERS) for kv in ('key', 'value')}
                mask = np.ones((1, emb.shape[1]), np.int64)
            logits, *present = self.lm.run(None, dict(inputs_embeds=emb, attention_mask=mask, **past))
            lg = logits[:, -1, :].astype(np.float64)
            sc = np.take_along_axis(lg, gen, axis=1)
            np.put_along_axis(lg, gen, np.where(sc < 0, sc * rep, sc / rep), axis=1)
            if temp <= 0:
                nxt = int(np.argmax(lg, axis=-1)[0])
            else:
                p = np.exp((lg[0] - lg[0].max()) / temp)
                p /= p.sum()
                order = np.argsort(-p)
                cum = np.cumsum(p[order])
                keep = order[:max(1, int(np.searchsorted(cum, top_p)) + 1)]
                q = p[keep] / p[keep].sum()
                nxt = int(rng.choice(keep, p=q))
            gen = np.concatenate((gen, [[nxt]]), axis=1)
            if nxt == STOP:
                ended = True
                break
            feed = {'input_ids': np.array([[nxt]], np.int64), 'position_ids': np.array([[i + 1]], np.int64),
                    'exaggeration': np.array([exaggeration], np.float32)}
            mask = np.concatenate([mask, np.ones((1, 1), np.int64)], axis=1)
            for j, k in enumerate(past):
                past[k] = present[j]
        speech = gen[:, 1:-1] if ended else gen[:, 1:]
        speech = np.concatenate([self.prompt_tok, speech], axis=1)
        wav = self.dec.run(None, {'speech_tokens': speech, 'speaker_embeddings': self.ref_x,
                                  'speaker_features': self.prompt_feat})[0]
        return np.squeeze(wav, 0).astype(np.float64), ended, speech.shape[1] - self.prompt_tok.shape[1]


def main():
    import render2
    ref = sys.argv[1]
    only = [int(a) - 1 for a in sys.argv[2:]]
    os.makedirs(VOICE_DIR, exist_ok=True)
    t0 = time.time()
    cb = Chatterbox(ref)
    print(f'load {time.time() - t0:.1f}s', flush=True)
    mp = os.path.join(VOICE_DIR, 'manifest.json')
    man = json.load(open(mp, encoding='utf-8')) if (only and os.path.exists(mp)) else {'scenes': [None] * len(READ)}
    temp = float(os.environ.get('TEMP', '0' if not only else '0.7'))
    seed = int(os.environ.get('SEED', '0'))
    for i, text in enumerate(READ):
        if only and i not in only:
            continue
        t1 = time.time()
        x, ended, ntok = cb.synth(text, temp=temp, seed=seed + i)
        x = trim(x, SR)
        x = x / (np.max(np.abs(x)) or 1) * 0.9
        fn = f'scene_{i + 1:02d}.wav'
        with wave.open(os.path.join(VOICE_DIR, fn), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
        bounds = chunk_bounds(x, SR, render2.SCRIPT[i])
        man['scenes'][i] = {'file': fn, 'dur': round(x.size / SR, 3), 'chunks': [[round(a, 3), round(b, 3)] for a, b in bounds]}
        print(f'scene {i + 1}: {x.size / SR:5.2f}s tokens {ntok} ended={ended} ({time.time() - t1:.0f}s)', flush=True)
    man.update({'engine': 'Chatterbox Multilingual ONNX (Resemble AI, MIT) — 첨부 음성 복제', 'exaggeration': EXAG})
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
