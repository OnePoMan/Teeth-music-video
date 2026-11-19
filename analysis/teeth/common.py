"""Shared paths for the Teeth analysis scripts (run with any Python 3.11+ env that has
torch/torchaudio (CPU wheels are fine), librosa, soundfile, faster-whisper).

Time reference: the gapless decode of audio/teeth.mp3 (ffmpeg / browsers trim the encoder delay),
which is what the renderer plays. Every script decodes through ffmpeg, so stems are already aligned.
"""
import os
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent          # analysis/teeth/
PROJECT = ROOT.parent.parent
CACHE = ROOT.parent / ".cache"
for var, sub in [("TORCH_HOME", "torch"), ("HF_HOME", "hf"), ("HF_HUB_CACHE", "hf/hub"), ("XDG_CACHE_HOME", "xdg"),
                 ("MPLCONFIGDIR", "mpl"), ("NUMBA_CACHE_DIR", "numba")]:
    os.environ.setdefault(var, str(CACHE / sub))
    (CACHE / sub).mkdir(parents=True, exist_ok=True)

AUDIO = PROJECT / "audio" / "teeth.mp3"
DATA = PROJECT / "data" / "teeth"
WORK = ROOT.parent / "work" / "teeth"
STEMS = WORK / "stems"
for d in (DATA, WORK, STEMS):
    d.mkdir(parents=True, exist_ok=True)
LYRICS_SRC = PROJECT / "lyrics" / "teeth.src.json"


def decode(path=AUDIO, sr=44100, mono=False):
    """Gapless ffmpeg decode -> float32 (channels, n) or (n,)."""
    ch = 1 if mono else 2
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", str(ch), "-ar", str(sr), "-"],
                         check=True, capture_output=True).stdout
    y = np.frombuffer(raw, dtype=np.float32)
    return y if mono else y.reshape(-1, ch).T.copy()


def load_stem(name, sr=None, mono=True):
    import soundfile as sf
    y, s = sf.read(STEMS / f"{name}.wav", dtype="float32", always_2d=True)
    y = y.mean(axis=1) if mono else y.T
    if sr and sr != s:
        import soxr
        y = soxr.resample(y, s, sr) if mono else np.stack([soxr.resample(c, s, sr) for c in y])
        s = sr
    return y, s
