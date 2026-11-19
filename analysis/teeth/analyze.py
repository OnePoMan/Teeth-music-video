"""Music analysis -> data/teeth/audio.json: constant-tempo beat grid, downbeats, sections (from the
aligned lyrics), 100 fps loudness envelopes (mix bands + Demucs stems) and onsets (kick / snare / hat
from the drum stem's bands, vocal onsets from the vocal stem).

Run after separate.py and align.py:  python analyze.py
"""
import json

import common  # noqa: F401
import librosa
import numpy as np
from scipy.ndimage import maximum_filter1d
from scipy.signal import find_peaks

from common import DATA, decode, load_stem

SR = 22050
FPS = 100
HOP = SR // FPS  # 220.5 -> use 220 and rescale
HOP = 220
mix = decode(sr=SR, mono=True)
dur = len(mix) / SR
stems = {k: np.pad(y := load_stem(k, sr=SR)[0], (0, max(0, len(mix) - len(y))))[:len(mix)] for k in ("drums", "bass", "other", "vocals")}
n_fr = int(np.ceil(dur * FPS))
t_fr = np.arange(n_fr) / FPS


def to_fps(x, sr_frames):
    """resample a frame series at sr_frames fps onto the FPS grid"""
    src = np.arange(len(x)) / sr_frames
    return np.interp(t_fr, src, x)


def rms_env(y):
    r = librosa.feature.rms(y=y, frame_length=2048, hop_length=HOP, center=True)[0]
    return to_fps(r, SR / HOP)


def norm(x, q=99.5, gamma=0.7):
    x = np.maximum(x, 0)
    s = np.percentile(x, q) + 1e-9
    return np.clip(x / s, 0, 1) ** gamma


S = np.abs(librosa.stft(mix, n_fft=2048, hop_length=HOP))
freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)


def band(S, lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return to_fps(np.sqrt((S[m] ** 2).mean(0)), SR / HOP)


feat = {
    "rms": norm(rms_env(mix)),
    "low": norm(band(S, 20, 200)),
    "mid": norm(band(S, 200, 2500)),
    "high": norm(band(S, 4000, 11000)),
}
for k in ("vocals", "drums", "bass", "other"):
    feat["vocal" if k == "vocals" else k] = norm(rms_env(stems[k]))

# ---------------------------------------------------------------- tempo / beat grid
oenv = librosa.onset.onset_strength(y=stems["drums"] + 0.5 * mix, sr=SR, hop_length=HOP, aggregate=np.median)
of = SR / HOP
tempo0, beats0 = librosa.beat.beat_track(onset_envelope=oenv, sr=SR, hop_length=HOP, units="time")
tempo0 = float(np.atleast_1d(tempo0)[0])
print("librosa tempo", tempo0)
# refine: constant period + phase maximizing the onset envelope sampled on the grid
ot = np.arange(len(oenv)) / of
best = None
for bpm in np.arange(tempo0 - 2, tempo0 + 2, 0.005):
    p = 60 / bpm
    for ph in np.arange(0, p, 0.004):
        g = np.arange(ph, dur, p)
        v = np.interp(g, ot, oenv).mean()
        if best is None or v > best[0]:
            best = (v, bpm, ph)
_, bpm, ph = best
period = 60 / bpm
print(f"grid: {bpm:.3f} BPM, phase {ph:.3f}")
beats = np.arange(ph, dur, period)

# ---------------------------------------------------------------- onsets from the drum stem bands
D = np.abs(librosa.stft(stems["drums"], n_fft=1024, hop_length=HOP))
fd = librosa.fft_frequencies(sr=SR, n_fft=1024)


def band_onsets(lo, hi, thr, dist=0.09):
    m = (fd >= lo) & (fd < hi)
    e = np.log1p(30 * D[m]).mean(0)
    flux = np.maximum(0, np.diff(e, prepend=e[0]))
    flux = to_fps(flux, of)
    flux /= np.percentile(flux, 99.7) + 1e-9
    pk, pr = find_peaks(flux, height=thr, distance=int(dist * FPS))
    return [[round(i / FPS, 3), round(float(min(1, h)), 3)] for i, h in zip(pk, pr["peak_heights"])]


kick = band_onsets(30, 120, 0.35)
snare = band_onsets(180, 2500, 0.45)
hat = band_onsets(7000, 11000, 0.4, 0.06)
vo = librosa.onset.onset_strength(y=stems["vocals"], sr=SR, hop_length=HOP)
vo = to_fps(vo, of)
vo /= np.percentile(vo, 99.7) + 1e-9
pk, pr = find_peaks(vo, height=0.3, distance=10)
vocal = [[round(i / FPS, 3), round(float(min(1, h)), 3)] for i, h in zip(pk, pr["peak_heights"])]
print(f"onsets: kick {len(kick)} snare {len(snare)} hat {len(hat)} vocal {len(vocal)}")

# ---------------------------------------------------------------- downbeats: phase with most kick energy on beat 1
kick_t = np.array([k[0] for k in kick]); kick_s = np.array([k[1] for k in kick])
scores = []
for off in range(4):
    db = beats[off::4]
    s = sum(kick_s[np.abs(kick_t - b) < 0.05].sum() for b in db)
    scores.append(s)
print("downbeat phase scores (kick)", np.round(scores, 1))
ly = json.loads((DATA / "lyrics.json").read_text())["lines"]
# chorus lines ("Fight so dirty") — their first word is usually a pickup or on beat 1; report positions
for l in ly:
    if l["text"].startswith("Fight") or l["text"].startswith("Blood"):
        b = (l["words"][0]["start"] - ph) / period
        print(f"  {l['text'][:22]:22s} starts at beat {b:7.2f} (mod 4: {b % 4:4.2f})")
off = int(np.argmax(scores))
downbeats = beats[off::4]

# ---------------------------------------------------------------- sections from the lyric structure
def bar_before(t, tol=0.25):
    """the downbeat at or before t (a pickup up to `tol` s before a downbeat belongs to the next bar)"""
    k = np.searchsorted(downbeats, t + tol, side="right") - 1
    return float(downbeats[max(0, k)])


def first(prefix, nth=0):
    c = [l for l in ly if l["text"].startswith(prefix)]
    return c[nth]["words"][0]["start"]


marks = [
    ("intro", 0.0),
    ("verse1", bar_before(first("Some days", 0))),
    ("pre1", bar_before(first("Call me", 0))),
    ("chorus1", bar_before(first("Fight", 0))),
    ("verse2", bar_before(first("Some days", 1))),
    ("pre2", bar_before(first("Call me", 1))),
    ("chorus2", bar_before(first("Fight", 2))),
    ("bridge", bar_before(first("Blood", 0))),
    ("chorus3", bar_before(first("Fight", 4))),
    ("outro", bar_before([l for l in ly if l["text"] == "Teeth"][0]["words"][0]["start"] - 1.0)),
]
sections = [{"name": n, "start": round(s, 3), "end": round(marks[i + 1][1] if i + 1 < len(marks) else dur, 3)} for i, (n, s) in enumerate(marks)]
for x in sections:
    print(f"  {x['name']:8s} {x['start']:7.2f} - {x['end']:7.2f}")

out = {
    "duration": round(dur, 3),
    "bpm": round(bpm, 3),
    "beat_period": round(period, 5),
    "time_signature": 4,
    "beats": [round(float(b), 3) for b in beats],
    "downbeats": [round(float(b), 3) for b in downbeats],
    "sections": sections,
    "fps": FPS,
    **{k: [round(float(x), 3) for x in v] for k, v in feat.items()},
    "onsets": {"kick": kick, "snare": snare, "hat": hat, "vocal": vocal},
}
json.dump(out, open(DATA / "audio.json", "w"))
print("wrote", DATA / "audio.json", "(sections are filled in by sections.py)")
