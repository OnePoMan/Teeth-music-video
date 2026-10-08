"""Stem separation with Demucs htdemucs_ft (the fine-tuned Hybrid Transformer, a bag of four models) ->
work/monster/stems/{drums,bass,other,vocals}.wav at 44.1 kHz. CPU friendly (chunked, overlapped)."""
import common  # noqa: F401  (cache dirs)
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model

from common import STEMS, decode

torch.set_num_threads(4)
model = get_model("htdemucs_ft")
model.eval()
sr = model.samplerate  # 44100
mix = torch.from_numpy(decode(sr=sr))  # (2, n)
ref = mix.mean(0)
mean, std = ref.mean(), ref.std()
x = (mix - mean) / std
with torch.inference_mode():
    out = apply_model(model, x[None], device="cpu", shifts=1, split=True, overlap=0.25, progress=True, num_workers=0)[0]
out = out * std + mean
for name, y in zip(model.sources, out):
    sf.write(STEMS / f"{name}.wav", y.T.numpy(), sr, subtype="FLOAT")
print("stems:", model.sources)
