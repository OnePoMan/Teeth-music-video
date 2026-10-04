"""Word-level lyric alignment -> data/teeth/lyrics.json

1. One global CTC forced alignment (torchaudio MMS_FA, with the <star> garbage token between lines
   so ad-libs and backing vocals don't steal words) of lyrics/teeth.src.json against the Demucs vocal stem.
2. Word boundaries: first/last character frame of each word; a word's end is extended over the held
   vowel while the vocal stays loud (up to the next word), and short gaps are closed.
3. Cross-check: faster-whisper word timestamps (work/teeth/whisper.json, from whisper_run.py) are
   compared per word; large disagreements are printed for review.

Run: python align.py
"""
import json
import re
import sys

import common  # noqa: F401
import numpy as np
import torch
import torchaudio
from torchaudio.pipelines import MMS_FA

from common import DATA, LYRICS_SRC, WORK, load_stem

torch.set_num_threads(4)
SR = 16000
src = json.loads(LYRICS_SRC.read_text())["lines"]

y, _ = load_stem("vocals", sr=SR)
wav = torch.from_numpy(y)[None]

model = MMS_FA.get_model(with_star=True).eval()
labels = MMS_FA.get_labels(star="*")
dic = {c: i for i, c in enumerate(labels)}
STAR = dic["*"]

emis = []
with torch.inference_mode():
    hop = SR * 20
    for s in range(0, wav.shape[1], hop):
        seg = wav[:, max(0, s - SR):min(wav.shape[1], s + hop + SR)]
        e, _ = model(seg)
        e = torch.log_softmax(e, -1)[0]
        fr = e.shape[0] / seg.shape[1]  # frames per sample
        a = int(round((s - max(0, s - SR)) * fr))
        b = a + int(round(min(hop, wav.shape[1] - s) * fr))
        emis.append(e[a:b])
em = torch.cat(emis)
FRAME = wav.shape[1] / SR / em.shape[0]
print(f"emissions {em.shape}, frame {FRAME * 1000:.2f} ms")


def norm_word(w):
    return re.sub(r"[^a-z']", "", w.lower().replace("’", "'"))


# token sequence: * line0 words * line1 words * ...
tokens, owner = [], []  # owner: (line, word) per char token, or None for star
lines = []
for li, (t0, text) in enumerate(src):
    words = text.split()
    lines.append({"text": text, "lrc": t0, "words": words})
    tokens.append(STAR); owner.append(None)
    for wi, w in enumerate(words):
        for ch in norm_word(w):
            if ch in dic:
                tokens.append(dic[ch]); owner.append((li, wi))
tokens.append(STAR); owner.append(None)

# Line anchors: Whisper's timestamp for the line's first word when it finds it within 1.5 s of the
# LRC start (Whisper's line starts are tighter than the LRC's), else the LRC start. Each line is then
# CTC-aligned alone in [anchor - 0.45, next anchor + 0.2], never before the previous line's end
# (a single global pass drifts badly across the repeated choruses).
wh = json.loads((WORK / "whisper.json").read_text()) if (WORK / "whisper.json").exists() else []
anchors = []
for L in lines:
    q = norm_word(L["words"][0])
    c = [x for x in wh if norm_word(x["word"]) == q and abs(x["start"] - L["lrc"]) < 1.5 and x["end"] > x["start"]]
    anchors.append(min(c, key=lambda x: abs(x["start"] - L["lrc"]))["start"] if c else L["lrc"])
    # Whisper often stretches a line's first word back over the preceding rest: keep the LRC if later
    anchors[-1] = max(anchors[-1], L["lrc"] - 0.6)


def align_span(f0, f1, toks):
    e = em[f0:f1][None]
    t = torch.tensor([toks], dtype=torch.int32)
    ali, scores = torchaudio.functional.forced_align(e, t, blank=0)
    return ali[0].numpy(), scores[0].exp().numpy()


res = {}
n = len(lines)
prev_end = 0.0
for li, L in enumerate(lines):
    t0 = max(prev_end, anchors[li] - 0.45)
    t1 = anchors[li + 1] + 0.2 if li + 1 < n else anchors[li] + 8
    t1 = min(t1, anchors[li] + 9)
    f0, f1 = int(t0 / FRAME), min(em.shape[0], int(t1 / FRAME))
    toks, own = [STAR], [None]
    for wi, w in enumerate(L["words"]):
        for ch in norm_word(w):
            toks.append(dic[ch]); own.append(wi)
    toks.append(STAR); own.append(None)
    ali, sc = align_span(f0, f1, toks)
    spans, ti, prev = {}, -1, 0
    for fi, a_ in enumerate(ali):
        if a_ == 0:
            prev = 0
            continue
        if a_ != prev:
            ti += 1
            while ti < len(toks) and toks[ti] != a_:
                ti += 1
        prev = a_
        if own[ti] is not None:
            s_ = spans.setdefault(own[ti], [fi, fi, []])
            s_[1] = fi
            s_[2].append(sc[fi])
    ws = []
    for wi in range(len(L["words"])):
        a_, b_, c_ = spans.get(wi, [None, None, [0]])
        ws.append(None if a_ is None else [(f0 + a_) * FRAME, (f0 + b_ + 1) * FRAME, float(np.mean(c_))])
    res[li] = ws
    done = [w for w in ws if w]
    prev_end = done[-1][1] if done else prev_end

# vocal loudness (10 ms) for end refinement
hopv = int(SR * 0.01)
rms = np.sqrt(np.convolve(y ** 2, np.ones(hopv * 3) / (hopv * 3), mode="same")[::hopv] + 1e-12)
db = 20 * np.log10(rms + 1e-9)


def loud(t):
    i = int(t / 0.01)
    return db[min(max(i, 0), len(db) - 1)]


# Manual fixes, (line, word) -> start/end, from the vocal stem's spectrum (the CTC models hear nothing in
# the outro's distorted "Teeth" shouts; voice onsets at 175.70 and 179.06, the third agrees with the LRC).
FIX = {
    (48, 0): dict(start=175.66, end=177.0),
    (49, 0): dict(start=179.06, end=180.4),
    (50, 0): dict(start=182.08, end=183.0),
}
# 8th-note grid from analyze.py (if it ran before): word starts within 50 ms of a grid line snap to it
# (the chorus is sung one word per beat; CTC's 20 ms frames otherwise smear the onsets).
grid = None
af = DATA / "audio.json"
if af.exists():
    A = json.loads(af.read_text())
    grid = (A["beats"][0], A["beat_period"] / 2)


def snap(t):
    if not grid:
        return t
    g = grid[0] + round((t - grid[0]) / grid[1]) * grid[1]
    return g if abs(g - t) < 0.05 else t


out_lines = []
for li, L in enumerate(lines):
    ws = res[li]
    # fill missing words by interpolation
    for wi in range(len(ws)):
        if ws[wi] is None:
            pv = next((ws[k] for k in range(wi - 1, -1, -1) if ws[k]), None)
            nx = next((ws[k] for k in range(wi + 1, len(ws)) if ws[k]), None)
            a = pv[1] if pv else (nx[0] - 0.3 if nx else L["lrc"])
            b = nx[0] if nx else a + 0.3
            ws[wi] = [a, max(a + 0.08, b), 0.0]
    words = []
    for wi, (a, b, c) in enumerate(ws):
        nxt = ws[wi + 1][0] if wi + 1 < len(ws) else (res[li + 1][0][0] if li + 1 < n and res[li + 1][0] else a + 3)
        # held vowel: extend while the vocal stays within 14 dB of the word's peak, up to the next word
        pk = max(loud(x) for x in np.arange(a, b + 0.01, 0.01))
        e = b
        while e + 0.01 < nxt - 0.02 and loud(e + 0.01) > pk - 14 and e - b < 2.5:
            e += 0.01
        if nxt - e < 0.12:
            e = nxt  # legato: close tiny gaps
        fx = FIX.get((li, wi), {})
        a, e = fx.get("start", snap(a)), fx.get("end", e)
        words.append({"w": L["words"][wi], "start": round(a, 3), "end": round(max(e, a + 0.06), 3), "conf": round(c, 2)})
    for wi in range(len(words) - 1):  # snapping may move a start before the previous word's end
        words[wi]["end"] = round(min(words[wi]["end"], words[wi + 1]["start"]), 3)
        if wi == len(words) - 2:
            pass
    out_lines.append({"i": li, "text": L["text"], "start": words[0]["start"], "end": words[-1]["end"], "words": words})

# clean-up: strictly increasing starts (>= 80 ms apart: snapping can merge two quick words), ends never
# past the next word (or line)
flat = [w for l in out_lines for w in l["words"]]
for a, b in zip(flat, flat[1:]):
    if b["start"] < a["start"] + 0.08:
        b["start"] = round(a["start"] + 0.08, 3)
for a, b in zip(flat, flat[1:]):
    a["end"] = round(max(a["start"] + 0.06, min(a["end"], b["start"])), 3)
for l in out_lines:
    l["start"], l["end"] = l["words"][0]["start"], l["words"][-1]["end"]

# Chorus template: the four chorus lines are sung on a fixed rhythm every time (one word per beat, locked
# to the grid), but CTC loses its place in some repeats under the full band. Each line type's word
# offsets in beats from the line's anchor beat B (the first word, or "never" after the "And" pickup)
# are the median over all its repeats; every repeat is then rewritten as B + template.
if grid:
    beat0, per = A["beats"][0], A["beat_period"]
    bt = lambda t: (t - beat0) / per
    tb = lambda b: beat0 + b * per
    # a chorus is a block of four lines 8 beats apart (Fight B, Talk B+8, Late B+16, never B+24): every
    # line's anchor comes from its block's "Fight" line, the one CTC always gets right
    kinds, Bs, blockB, k_in = {}, {}, None, 0
    for l in out_lines:
        key = norm_word(l["text"].replace(" ", ""))
        if key.startswith("fight"):
            blockB, k_in = round(bt(l["words"][0]["start"])), 0
        elif blockB is not None and (key.startswith("talk") or key.startswith("late") or key.startswith("andnever")):
            k_in += 1
        else:
            blockB = None
            continue
        kinds.setdefault(key, []).append(l)
        Bs[l["i"]] = blockB + 8 * k_in
    for key, inst in kinds.items():
        offs = [[bt(w["start"]) - Bs[l["i"]] for w in l["words"]] for l in inst]
        T = np.round(np.median(np.array(offs), axis=0) * 4) / 4  # 16th-note grid
        print(f"template {key[:24]:24s}", " ".join(f"{x:+.2f}" for x in T), f"({len(inst)} repeats)")
        for l in inst:
            B = Bs[l["i"]]
            for wi, w in enumerate(l["words"]):
                w["start"] = round(tb(B + T[wi]), 3)
            for a_, b_ in zip(l["words"], l["words"][1:]):
                a_["end"] = b_["start"]
            last = l["words"][-1]
            last["end"] = round(max(last["end"], last["start"] + 0.35), 3)
    # the outro's "Never, never, never ever let go" is the same line without "And"
    andnever = next((k for k in kinds if k.startswith("andnever")), None)
    if andnever:
        offs = [[bt(w["start"]) - Bs[l["i"]] for w in l["words"]] for l in kinds[andnever]]
        T = np.round(np.median(np.array(offs), axis=0) * 4) / 4
        for l in out_lines:
            if norm_word(l["text"].replace(" ", "")).startswith("nevernever"):
                B = round(bt(l["words"][0]["start"]))
                for wi, w in enumerate(l["words"]):
                    w["start"] = round(tb(B + T[wi + 1]), 3)
                for a_, b_ in zip(l["words"], l["words"][1:]):
                    a_["end"] = b_["start"]
    for i, (a_, b_) in enumerate(zip(out_lines, out_lines[1:])):
        a_["words"][-1]["end"] = round(min(a_["words"][-1]["end"], b_["words"][0]["start"]), 3)
    for l in out_lines:
        l["start"], l["end"] = l["words"][0]["start"], l["words"][-1]["end"]

# whisper cross-check
wf = WORK / "whisper.json"
if wf.exists():
    wh = json.loads(wf.read_text())
    flat = [w for l in out_lines for w in l["words"]]
    bad = 0
    for w in flat:
        q = norm_word(w["w"])
        cands = [x for x in wh if norm_word(x["word"]) == q and abs(x["start"] - w["start"]) < 1.5]
        if not cands:
            continue
        d = min(cands, key=lambda x: abs(x["start"] - w["start"]))
        if abs(d["start"] - w["start"]) > 0.25:
            bad += 1
            print(f"  {w['w']:>12} ctc {w['start']:7.2f}  whisper {d['start']:7.2f}")
    print(f"whisper disagreements > 250 ms: {bad}/{len(flat)}")

for l in out_lines:
    print(f"{l['start']:7.2f}-{l['end']:7.2f} (lrc {lines[l['i']]['lrc']:6.2f}) {l['text']}")
json.dump({"lines": out_lines, "notes": "Word timings: MMS_FA CTC forced alignment on the Demucs vocal stem (analysis/teeth/align.py), held-vowel ends from vocal loudness."},
          open(DATA / "lyrics.json", "w"), indent=None, ensure_ascii=False)
print("wrote", DATA / "lyrics.json")
