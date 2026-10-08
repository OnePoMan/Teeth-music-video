"""Shared paths for the Monster analysis scripts (any Python 3.11+ env with torch/torchaudio (CPU wheels are
fine), demucs, librosa, soundfile, soxr and faster-whisper; `uv venv` + `uv pip install` in analysis/.venv).

Time reference: the gapless decode of audio/monster.mp3 (ffmpeg / browsers trim the encoder delay),
which is what the renderer plays. Every script decodes through ffmpeg, so the stems are already aligned.
"""
import os
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent          # analysis/monster/
PROJECT = ROOT.parent.parent
CACHE = ROOT.parent / ".cache"
for var, sub in [("TORCH_HOME", "torch"), ("HF_HOME", "hf"), ("HF_HUB_CACHE", "hf/hub"), ("XDG_CACHE_HOME", "xdg"),
                 ("MPLCONFIGDIR", "mpl"), ("NUMBA_CACHE_DIR", "numba")]:
    os.environ.setdefault(var, str(CACHE / sub))
    (CACHE / sub).mkdir(parents=True, exist_ok=True)

AUDIO = PROJECT / "audio" / "monster.mp3"
DATA = PROJECT / "data" / "monster"
WORK = ROOT.parent / "work" / "monster"
STEMS = WORK / "stems"
QA = ROOT.parent / "qa" / "monster"
for d in (DATA, WORK, STEMS, QA):
    d.mkdir(parents=True, exist_ok=True)
LYRICS_SRC = PROJECT / "lyrics" / "monster.src.json"


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


KARAOKE = WORK / "karaoke" / "mix_(Vocals)_mel_band_roformer_karaoke_aufr33_viperx_sdr_10.wav"


def load_vocal_source(name, sr=None):
    """'vocals' = Demucs vocal stem (mono sum), 'vocL'/'vocR' = its left/right channel (double-tracked or
    panned parts sit closer to a single voice in one channel); 'lead' = the lead voice from the mel-band-roformer
    karaoke model (audio-separator on work/monster/mix.wav, the gapless decode), 'backing' = the Demucs vocal stem
    minus that lead (the ensemble's chants). Both are sample-aligned with the Demucs stems (checked: lag 0)."""
    if name in ("vocL", "vocR"):
        y, s = load_stem("vocals", sr=sr, mono=False)
        return y[0 if name == "vocL" else 1], s
    if name in ("lead", "backing"):
        import soundfile as sf
        lead, s = sf.read(KARAOKE, dtype="float32", always_2d=True)
        y = lead.mean(axis=1)
        if name == "backing":
            v, sv = load_stem("vocals")
            assert sv == s
            n = min(len(v), len(y))
            y = v[:n] - y[:n]
        if sr and sr != s:
            import soxr
            y, s = soxr.resample(y, s, sr), sr
        return y, s
    return load_stem("vocals", sr=sr)


def load_lyrics_src():
    """lyrics/monster.src.json -> list of (start, text, voice)."""
    import json
    return [(r[0], r[1], r[2] if len(r) > 2 else "lead") for r in json.loads(LYRICS_SRC.read_text())["lines"]]


def grid():
    """(beat period, first beat) of the analysed constant grid (data/monster/audio.json)."""
    import json
    a = json.loads((DATA / "audio.json").read_text())
    return a["beat_period"], a["beats"][0]
