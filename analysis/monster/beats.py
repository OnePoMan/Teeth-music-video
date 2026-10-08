"""Beat and downbeat tracking with Beat This! (CPJKU, ISMIR 2024; handles tempo changes) on the full mix and on
mix-minus-vocals -> work/monster/beats.json. analyze.py builds the final grid from it."""
import json

import common  # noqa: F401
import numpy as np
import soundfile as sf
import torch
from beat_this.inference import File2Beats

from common import STEMS, WORK, decode

torch.set_num_threads(4)
sr = 44100
mix = decode(sr=sr)                       # (2, n)
f2b = File2Beats(checkpoint_path="final0", device="cpu", dbn=False)
res = {}
for name, y in [("mix", mix.mean(0))] + [("instr", sum(sf.read(STEMS / f"{k}.wav", dtype="float32")[0].mean(1) for k in ("drums", "bass", "other")))]:
    tmp = WORK / f"_bt_{name}.wav"
    sf.write(tmp, y, sr)
    b, d = f2b(str(tmp))
    tmp.unlink()
    res[name] = {"beats": [round(float(x), 4) for x in b], "downbeats": [round(float(x), 4) for x in d]}
    ib = np.diff(b)
    print(f"{name}: {len(b)} beats, {len(d)} downbeats, median IBI {np.median(ib):.4f} s = {60 / np.median(ib):.2f} BPM")
(WORK / "beats.json").write_text(json.dumps(res))
