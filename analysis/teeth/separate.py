"""Stem separation with torchaudio's Hybrid Demucs (HDEMUCS_HIGH_MUSDB_PLUS) -> work/teeth/stems/*.wav
(drums, bass, other, vocals at 44.1 kHz). Chunked with overlap-add, CPU friendly."""
import common  # noqa: F401  (cache dirs)
import numpy as np
import soundfile as sf
import torch
import torchaudio
from torchaudio.pipelines import HDEMUCS_HIGH_MUSDB_PLUS

from common import STEMS, decode

torch.set_num_threads(4)
bundle = HDEMUCS_HIGH_MUSDB_PLUS
model = bundle.get_model().eval()
sr = bundle.sample_rate  # 44100
mix = torch.from_numpy(decode(sr=sr))  # (2, n)
ref = mix.mean(0)
mean, std = ref.mean(), ref.std()
x = (mix - mean) / std

seg, ov = int(sr * 10), int(sr * 1)
n = x.shape[1]
out = torch.zeros(4, 2, n)
wsum = torch.zeros(n)
fade = torch.linspace(0, 1, ov)
start = 0
with torch.inference_mode():
    while start < n:
        end = min(n, start + seg)
        chunk = x[:, start:end]
        y = model(chunk[None])[0]  # (4, 2, len)
        L = end - start
        w = torch.ones(L)
        if start > 0:
            w[:ov] = fade[:min(ov, L)]
        if end < n:
            w[-ov:] = torch.minimum(w[-ov:], fade.flip(0)[-min(ov, L):])
        out[:, :, start:end] += y * w
        wsum[start:end] += w
        print(f"{end / sr:6.1f}/{n / sr:.1f}s", flush=True)
        if end >= n:
            break
        start = end - ov
out = out / wsum.clamp_min(1e-6) * std + mean
for name, y in zip(model.sources, out):
    sf.write(STEMS / f"{name}.wav", y.T.numpy(), sr, subtype="FLOAT")
print("stems:", model.sources)
