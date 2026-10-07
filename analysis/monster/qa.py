"""QA plots for the alignment -> analysis/qa/monster/qa_XXX.png: vocal-stem mel spectrogram and loudness per
10 s window, with the aligned words (lead above, ensemble below), Whisper's words and the beat grid.

Run after align.py:  python qa.py [t0 t1]
"""
import json
import sys

import common  # noqa: F401
import librosa
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from common import DATA, QA, WORK, load_stem  # noqa: E402

SR = 16000
y, _ = load_stem("vocals", sr=SR)
ly = json.loads((DATA / "lyrics.json").read_text())["lines"]
wh = json.loads((WORK / "whisper.json").read_text()) if (WORK / "whisper.json").exists() else []
au = json.loads((DATA / "audio.json").read_text()) if (DATA / "audio.json").exists() else None
dur = len(y) / SR
t_from, t_to = (float(sys.argv[1]), float(sys.argv[2])) if len(sys.argv) > 2 else (0.0, dur)
HOP = 160
M = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=SR, n_fft=1024, hop_length=HOP, n_mels=96, fmax=6000), ref=np.max)
rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=HOP)[0]
rdb = 20 * np.log10(rms + 1e-6)
W = 10.0
for k, t0 in enumerate(np.arange(t_from, t_to, W)):
    t1 = t0 + W
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(20, 7), sharex=True, gridspec_kw={"height_ratios": [3, 1]})
    i0, i1 = int(t0 * SR / HOP), int(t1 * SR / HOP)
    a1.imshow(M[:, i0:i1], origin="lower", aspect="auto", extent=[t0, t1, 0, 96], cmap="magma", vmin=-70, vmax=0)
    a2.plot(np.arange(i0, min(i1, len(rdb))) * HOP / SR, rdb[i0:i1], lw=0.8, color="k")
    if au:
        for b in au["beats"]:
            if t0 <= b < t1:
                for a in (a1, a2):
                    a.axvline(b, color="w" if a is a1 else "0.6", lw=0.5, alpha=0.35)
    for l in ly:
        ens = l.get("voice") == "ensemble"
        for w in l["words"]:
            if w["end"] < t0 or w["start"] > t1:
                continue
            yb = 8 if ens else 70
            col = "cyan" if ens else "lime"
            a1.axvline(w["start"], color=col, lw=1.0)
            a1.plot([w["start"], w["end"]], [yb, yb], color=col, lw=3)
            a1.text(w["start"] + 0.02, yb + 3, w["w"], color=col, fontsize=9, rotation=0)
    for x in wh:
        if t0 <= x["start"] < t1:
            a1.plot([x["start"], x["end"]], [88, 88], color="orange", lw=2)
            a1.text(x["start"], 90, x["word"], color="orange", fontsize=8)
    a1.set_xlim(t0, t1)
    a1.set_title(f"vocals {t0:.0f}-{t1:.0f} s   green: aligned lead · cyan: aligned ensemble · orange: whisper · lines: beats")
    fig.tight_layout()
    fig.savefig(QA / f"qa_{int(t0):03d}.png", dpi=70)
    plt.close(fig)
print("wrote", QA)
