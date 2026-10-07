"""Music analysis -> data/monster/audio.json

  * constant-tempo beat grid: Beat This! (beats.py) finds a steady 90 BPM 4/4 throughout; the grid is the
    least-squares fit of a constant period and phase to its beats (mix and mix-minus-vocals), downbeats from
    the tracker's bar phase (its occasional extra downbeats in the quiet passages are outliers),
  * sections on downbeats, from the aligned lyrics (align.py) and the stem energy,
  * 100 fps normalized envelopes (mix rms / low / mid / high, stem rms),
  * kick / snare / hat onsets from the drum stem's bands, 'orch' hits (strong attacks of the orchestral
    stem, the strings and brass stabs), vocal onsets.

Run after separate.py, beats.py and align.py:  python analyze.py
"""
import json

import common  # noqa: F401
import librosa
import numpy as np
from scipy.signal import find_peaks

from common import DATA, WORK, decode, load_stem

SR = 22050
FPS = 100
HOP = 220
mix = decode(sr=SR, mono=True)
dur = len(mix) / SR
stems = {}
for k in ("drums", "bass", "other", "vocals"):
    s = load_stem(k, sr=SR)[0]
    stems[k] = np.pad(s, (0, max(0, len(mix) - len(s))))[:len(mix)]
n_fr = int(np.ceil(dur * FPS))
t_fr = np.arange(n_fr) / FPS


def to_fps(x, sr_frames):
    """resample a frame series at sr_frames fps onto the FPS grid"""
    return np.interp(t_fr, np.arange(len(x)) / sr_frames, x)


def rms_env(y):
    return to_fps(librosa.feature.rms(y=y, frame_length=2048, hop_length=HOP, center=True)[0], SR / HOP)


def norm(x, q=99.5, gamma=0.7):
    x = np.maximum(x, 0)
    return np.clip(x / (np.percentile(x, q) + 1e-9), 0, 1) ** gamma


S = np.abs(librosa.stft(mix, n_fft=2048, hop_length=HOP))
freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)


def band(lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return to_fps(np.sqrt((S[m] ** 2).mean(0)), SR / HOP)


feat = {"rms": norm(rms_env(mix)), "low": norm(band(20, 200)), "mid": norm(band(200, 2500)), "high": norm(band(4000, 11000))}
for k in ("vocals", "drums", "bass", "other"):
    feat["vocal" if k == "vocals" else k] = norm(rms_env(stems[k]))

# ---------------------------------------------------------------- beat grid (constant tempo)
bt = json.loads((WORK / "beats.json").read_text())
allb = np.concatenate([np.array(bt["mix"]["beats"]), np.array(bt["instr"]["beats"])])
best = None
for P in np.arange(0.660, 0.672, 0.00002):
    for ph in np.arange(0, P, 0.002):
        r = (allb - ph) / P
        s = np.mean(np.minimum(np.abs((r - np.round(r)) * P), 0.08))
        if best is None or s < best[0]:
            best = (s, P, ph)
_, P, ph = best
k = np.round((allb - ph) / P)
inl = np.abs(allb - (ph + k * P)) < 0.06
(P, ph), *_ = np.linalg.lstsq(np.vstack([k[inl], np.ones(inl.sum())]).T, allb[inl], rcond=None)
ph = ph - P * np.floor(ph / P)
res = allb[inl] - (ph + np.round((allb[inl] - ph) / P) * P)
print(f"grid: {60 / P:.4f} BPM (period {P:.6f} s), phase {ph:.4f} s; |residual| median {np.median(np.abs(res)) * 1000:.1f} ms, "
      f"p95 {np.percentile(np.abs(res), 95) * 1000:.1f} ms ({inl.sum()}/{len(allb)} inliers)")
beats = ph + P * np.arange(int((dur - ph) / P) + 1)
db = np.array(bt["mix"]["downbeats"])
counts = np.bincount(np.round((db - ph) / P).astype(int) % 4, minlength=4)
off = int(np.argmax(counts))
print("tracker downbeats by beat index mod 4:", counts.tolist(), "-> bar phase", off)
downbeats = beats[off::4]
BAR = 4 * P

# ---------------------------------------------------------------- onsets
D = np.abs(librosa.stft(stems["drums"], n_fft=1024, hop_length=HOP))
fd = librosa.fft_frequencies(sr=SR, n_fft=1024)
of = SR / HOP


def flux_onsets(spec, f, lo, hi, thr, dist=0.09, gate=None):
    m = (f >= lo) & (f < hi)
    e = np.log1p(30 * spec[m]).mean(0)
    flux = to_fps(np.maximum(0, np.diff(e, prepend=e[0])), of)
    flux /= np.percentile(flux, 99.7) + 1e-9
    pk, pr = find_peaks(flux, height=thr, distance=int(dist * FPS))
    out = [[round(i / FPS, 3), round(float(min(1, h)), 3)] for i, h in zip(pk, pr["peak_heights"])]
    if gate is not None:  # drop onsets where the stem is near silent (bleed)
        out = [o for o in out if gate[min(len(gate) - 1, int(o[0] * FPS))] > 0.08]
    return out


kick = flux_onsets(D, fd, 30, 120, 0.35, gate=feat["drums"])
snare = flux_onsets(D, fd, 180, 2500, 0.45, gate=feat["drums"])
hat = flux_onsets(D, fd, 7000, 11000, 0.4, 0.06, gate=feat["drums"])
O = np.abs(librosa.stft(stems["other"], n_fft=2048, hop_length=HOP))
fo = librosa.fft_frequencies(sr=SR, n_fft=2048)
orch = flux_onsets(O, fo, 80, 6000, 0.45, 0.15, gate=feat["other"])
vo = to_fps(librosa.onset.onset_strength(y=stems["vocals"], sr=SR, hop_length=HOP), of)
vo /= np.percentile(vo, 99.7) + 1e-9
pk, pr = find_peaks(vo, height=0.3, distance=10)
vocal = [[round(i / FPS, 3), round(float(min(1, h)), 3)] for i, h in zip(pk, pr["peak_heights"])]
print(f"onsets: kick {len(kick)} snare {len(snare)} hat {len(hat)} orch {len(orch)} vocal {len(vocal)}")

# ---------------------------------------------------------------- sections (on downbeats)
ly = json.loads((DATA / "lyrics.json").read_text())["lines"]


def line(prefix, nth=0):
    c = [l for l in ly if l["text"].lower().startswith(prefix.lower())]
    return c[nth]


def bar_of(t, pickup=2):
    """downbeat of the bar a line starting at t belongs to: its own bar, or the next one when it starts with a
    short pickup (< `pickup` beats before that next downbeat)"""
    kb = int(np.floor((t - downbeats[0]) / BAR + 1e-6))
    nxt = downbeats[0] + (kb + 1) * BAR
    if nxt - t < pickup * P - 1e-6:
        kb += 1
    return kb


marks = [
    ("intro", 0),
    ("verse1", bar_of(line("How has")["start"])),
    ("verse1b", bar_of(line("I'm surrounded")["start"])),
    ("chorus1", bar_of(line("What if I'm the monster")["start"])),
    ("verse2", bar_of(line("Is the cyclops")["start"])),
    ("chorus2", bar_of(line("If I became the monster")["start"])),
    ("bridge", bar_of(line("Oh, ruthlessness")["start"])),
    ("chorus3", bar_of(line("Then I'll become")["start"])),
    ("outro", bar_of(next(l for l in ly if l["voice"] == "ensemble" and l["start"] > line("and then we'll make it home")["start"])["start"])),
]
sections = []
for i, (name, kb) in enumerate(marks):
    s = 0.0 if i == 0 else float(downbeats[0] + kb * BAR)
    e = float(downbeats[0] + marks[i + 1][1] * BAR) if i + 1 < len(marks) else dur
    sections.append({"name": name, "start": round(s, 3), "end": round(e, 3), "bar": kb})
for x in sections:
    print(f"  {x['name']:8s} bar {x['bar']:3d}  {x['start']:7.2f} - {x['end']:7.2f}")

out = {
    "duration": round(dur, 3),
    "bpm": round(60 / P, 4),
    "beat_period": round(float(P), 6),
    "time_signature": 4,
    "beats": [round(float(b), 3) for b in beats],
    "downbeats": [round(float(b), 3) for b in downbeats],
    "sections": sections,
    "fps": FPS,
    **{k: [round(float(x), 3) for x in v] for k, v in feat.items()},
    "onsets": {"kick": kick, "snare": snare, "hat": hat, "orch": orch, "vocal": vocal},
    "notes": "Constant 90 BPM 4/4 grid fitted to Beat This! beats (analysis/monster/analyze.py). Stems: Demucs htdemucs_ft.",
}
json.dump(out, open(DATA / "audio.json", "w"))
print("wrote", DATA / "audio.json")
