"""Word-level lyric alignment -> data/monster/lyrics.json (the pipeline of analysis/align.py, ported).

Pipeline
  1. ctc_emissions.py : frame-wise CTC log-probs of the Demucs vocal stem (mono, left, right) from two acoustic
                        models (MMS_FA, wav2vec2 LV60K).
  2. whisper_run.py   : faster-whisper large-v3 word timestamps (cross-check).
  3. vocal_feats.py   : vocal-stem RMS / pitch / onset / sibilance features (5 ms hop).
  4. this script      : one constrained CTC Viterbi pass over all of Odysseus' lines on the fused emissions
                        (garbage "star" token between lines, scored best-token minus a margin), loose per-line
                        windows around the LRC starts, manually verified anchors for hard spots; the ensemble's
                        interjections ("Monster") aligned separately in their own windows (they overlap the
                        lead); then signal-based refinement of word starts/ends, confidence scoring, QA plots.

Run:  python align.py [--plots]
"""
import json
import re
import sys
from difflib import SequenceMatcher

import common
import numpy as np

from ctcalign import align, emissions, word_table
from pron import pron

PRIMARY = "fused6"
ALTS = ("mms", "lv60k")

# Lead lines are kept within this many seconds of their LRC start (a safety net; the LRC is hand-synced).
LRC_SLACK = 1.6

# Manual anchors (seconds) for the CTC path, from the QA plots. (line, token, subword) -> (earliest start of
# the subword's first char, latest end of its last char); None = unconstrained.
ANCHORS = {}

# Final manual corrections of word boundaries after refinement, only where the plots clearly show the automatic
# result is wrong. (line, token) -> dict(start=..., end=..., syl=[later subword starts], conf=...)
FIX = {
    # L0 "against us?": "us" is sung 7.60-8.12 (vocal envelope; the client heard it late at 8.00, where the rising
    # figure starts). Pilot v5 review.
    (0, 5): dict(start=6.97, end=7.56),
    (0, 6): dict(start=7.60, end=8.14),
    # L11 (GUILT?): "if" was timed 0.48 s with "I'm" late after it (55.02-55.18). The vocal envelope dips at 54.86 and
    # 55.13 (between the syllables), and the mix's high band shows the nasal of "I'm" at 55.07-55.15 and the dental
    # onset of "the" at 55.16. Client-approved, 2026-10-09.
    (11, 1): dict(end=54.86),
    (11, 2): dict(start=54.86, end=55.13),
    (11, 3): dict(start=55.13),
}

NOTES = (
    "Timeline = gapless decode of audio/monster.mp3 (ffmpeg; the same as data/monster/audio.json and the browser). "
    "Method: CTC emissions (20 ms frames) of the Demucs htdemucs_ft vocal stem (mono, left, right) from two acoustic "
    "models (torchaudio MMS_FA, wav2vec2-large-lv60k-960h), fused; one constrained Viterbi pass over the lead lines "
    "with a margin-scored garbage token between lines; the ensemble's interjections aligned separately; starts "
    "refined on vocal rests, onsets and fricatives; ends where the voice stops or the next word starts; manual "
    "corrections from QA plots (analysis/monster/align.py FIX). Lines with voice 'ensemble' are the chorus' "
    "interjections; 'syl' gives per-subword starts for multi-syllable respellings."
)


# ---------------------------------------------------------------------------
def load_feats(source=None):
    f = dict(np.load(common.WORK / ("vocal_feats.npz" if source is None else f"vocal_feats_{source}.npz")))
    f["hop"] = float(f.pop("hop_s"))
    return f


def activity(f, rel_db=22.0, abs_db=-48.0, win_s=1.5):
    """Vocal activity mask: RMS above an absolute floor and within rel_db of the local (±win) maximum."""
    from scipy.ndimage import maximum_filter1d, median_filter
    r = median_filter(f["rms_db"], 5)
    loc = maximum_filter1d(r, int(win_s / f["hop"]))
    return (r > abs_db) & (r > loc - rel_db), r


def runs(mask):
    m = np.concatenate([[False], mask, [False]]).astype(np.int8)
    d = np.diff(m)
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


FRIC_START = re.compile(r"(s|sh|ch|z|f|th|j|c[eiy]|x|h)")
VOICED_TH = {"the", "there", "there's", "that", "that's", "they", "this", "then", "those", "them", "though"}
FRIC_END = re.compile(r"(s|z|f|x|ce|se|ze|sh|ch)$")


def refine(words, f, fix=None):
    """Signal-based refinement of CTC boundaries, per sub-word unit (analysis/align.py's rules).

    1. rest-onset : a rest (>=50 ms silence) precedes the unit and the voice re-enters >40 ms before the first CTC
                    char -> start there (CTC fires late on held vowels).
    2. onset-snap : otherwise snap to the strongest vocal onset (spectral flux) just before the CTC start.
    3. fricative  : s/sh/ch/z/f/th/j/h-initial units: CTC emits the consonant at the END of the frication; move the
                    start back to where the 4-10 kHz noise begins.
    end: next unit's start when the voice continues (legato), else the moment the voice stops.
    """
    from scipy.ndimage import uniform_filter1d
    from scipy.signal import find_peaks
    hop = f["hop"]
    act, r = activity(f, rel_db=27.0)
    n = len(r)
    sil = ~act
    sib = uniform_filter1d(f["sib_ratio"], 3)
    on = f["onset"]
    on_thr = 0.3 * np.percentile(on, 99)
    pk_idx, _ = find_peaks(on, height=on_thr, distance=int(0.04 / hop))
    units = []
    for k, w in enumerate(words):
        w["ctc_start"], w["ctc_end"] = w["start"], w["end"]
        w["ctc_subs"] = [tuple(x) for x in w["subs"]]
        for j, (a, b) in enumerate(w["subs"]):
            units.append(dict(k=k, j=j, text=pron(w["w"])[j], cs=a, ce=b, s=a, rule="ctc"))
    fix = fix or {}
    for u_i, u in enumerate(units):
        w = words[u["k"]]
        fx = fix.get((w["li"], w["ti"]))
        if fx is not None:
            starts = [fx.get("start")] + list(fx.get("syl", []))
            if u["j"] < len(starts) and starts[u["j"]] is not None:
                u["s"], u["rule"] = starts[u["j"]], "manual"
                continue
        pu = units[u_i - 1] if u_i else None
        prev_ce = pu["ce"] if pu else 0.0
        prev_cs = pu["cs"] if pu else 0.0
        s = u["cs"]
        # 1. rest-onset
        i0, i1 = int(prev_ce / hop), int(s / hop)
        done = False
        if i1 - i0 > int(0.05 / hop):
            rs = [(a, b) for a, b in runs(sil[i0:i1]) if (b - a) * hop >= 0.05]
            if rs:
                onset = (i0 + rs[-1][1]) * hop
                if s - onset > 0.04:
                    u["s"], u["rule"] = onset, "rest-onset"
                done = True
        # 2. onset snap
        if not done:
            vowel_init = u["text"][0] in "aeiou"
            lo = max(prev_ce - 0.06, prev_cs + 0.08, s - (0.25 if vowel_init else 0.12))
            hi = s + 0.04
            cand = [p for p in pk_idx if lo <= p * hop <= hi and np.median(sib[p:p + int(0.06 / hop)]) < -5]
            best, bsc = None, 0.0
            for p in cand:
                dt = s - p * hop
                wgt = 1.0 if dt < 0.06 else max(0.4, 1 - (dt - 0.06) / 0.4)
                if on[p] * wgt > bsc:
                    best, bsc = p, on[p] * wgt
            if best is not None:
                t = best * hop - 0.01
                if abs(t - s) > 0.02:
                    u["s"], u["rule"] = t, "onset-snap"
        # 3. fricative
        if FRIC_START.match(u["text"]) and u["text"] not in VOICED_TH:
            prev_fric_end = pu is not None and FRIC_END.search(pu["text"]) is not None
            lo_t = prev_ce + 0.02 if prev_fric_end else prev_ce - 0.10
            if pu is not None:
                lo_t = max(lo_t, pu["s"] + 0.10)
            lo = int(max(lo_t, s - 0.30, 0) / hop)
            a, b = max(int((s - 0.15) / hop), lo), int((s + 0.06) / hop)
            if b > a:
                pk = a + int(np.argmax(sib[a:b]))
                base = np.percentile(sib[max(0, lo - int(0.4 / hop)):lo + 1], 25) if lo > 0 else -40
                if sib[pk] >= base + 8:
                    thr = 0.5 * (base + sib[pk])
                    j = pk
                    while j - 1 >= lo and sib[j - 1] > thr:
                        j -= 1
                    if j * hop < u["s"] - 0.02:
                        u["s"], u["rule"] = j * hop, "fricative"
    for u_i in range(1, len(units)):
        units[u_i]["s"] = max(units[u_i]["s"], units[u_i - 1]["s"] + 0.03)
    for k, w in enumerate(words):
        us = [u for u in units if u["k"] == k]
        w["start"] = us[0]["s"]
        w["start_rule"] = us[0]["rule"]
        w["unit_starts"] = [u["s"] for u in us]
    for k, w in enumerate(words):
        nxt = words[k + 1]["start"] if k + 1 < len(words) else len(r) * hop
        e = max(w["ctc_end"], w["start"] + 0.08)
        j0, j1 = int(w["start"] / hop), int(e / hop)
        level = np.percentile(r[j0:max(j1, j0 + 1)], 90)
        jn = int(nxt / hop)
        low = r < level - 15.0
        q = None
        j = j1
        need = int(0.06 / hop)
        while j < min(jn, n - need):
            if low[j] and low[j:j + need].all():
                q = j * hop
                break
            j += 1
        end = min(q, nxt) if q is not None else nxt
        end = max(end, w["start"] + 0.04)
        if nxt - end < 0.03:
            end = nxt
        fx = fix.get((w["li"], w["ti"]))
        if fx is not None:
            w["manual"] = True
            if "end" in fx:
                end = fx["end"]
        w["end"] = end
        us = w["unit_starts"]
        w["subs"] = [(us[i], us[i + 1] if i + 1 < len(us) else end) for i in range(len(us))]
    return words


def norm(t):
    return re.sub(r"[^a-z]", "", t.lower())


def whisper_words():
    p = common.WORK / "whisper.json"
    return [(x["word"], x["start"], x["end"]) for x in json.loads(p.read_text())] if p.exists() else []


def map_whisper(words, ww):
    """Fuzzy sequence alignment of whisper words to lyric tokens."""
    a = [norm(w["w"]) for w in words]
    b = [norm(x[0]) for x in ww]
    m = {}
    for tag, i1, i2, j1, j2 in SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if tag == "equal" or (tag == "replace" and (i2 - i1) == (j2 - j1)):
            for d in range(i2 - i1):
                m[i1 + d] = ww[j1 + d]
    for i, w in enumerate(words):
        x = m.get(i)
        if x is not None and abs(x[1] - w["start"]) > 1.5:
            x = None
        w["whisper"] = None if x is None else (round(x[1], 3), round(x[2], 3))
    return words


def confidence(words, alt):
    for i, w in enumerate(words):
        ds = [abs(a[i]["start"] - w["ctc_start"]) for a in alt.values()]
        agree = np.mean([d <= 0.06 for d in ds]) if ds else 0.5
        p = min(1.0, w["conf"] / 0.5)
        wh = w.get("whisper")
        wagree = 0.5 if wh is None else float(abs(wh[0] - w["start"]) <= 0.15)
        c = 0.35 + 0.3 * agree + 0.2 * p + 0.15 * wagree
        if w.get("manual"):
            c = FIX.get((w["li"], w["ti"]), {}).get("conf", max(c, 0.8))
        w["conf_final"] = round(float(np.clip(c, 0, 1)), 2)
    return words


def detect_extras(words, f):
    """Vocal activity (vocal stem) not covered by any lyric word: unlisted ensemble chants, ad-libs, breaths."""
    from scipy.ndimage import median_filter
    hop = f["hop"]
    r = median_filter(f["rms_db"], 9)
    act = r > -36
    cover = np.zeros_like(act)
    for w in words:
        cover[int((w["start"] - 0.1) / hop):int((w["end"] + 0.1) / hop)] = True
    out = []
    for a, b in runs(act & ~cover):
        if out and a * hop - out[-1][1] < 0.4:
            out[-1][1] = b * hop
        else:
            out.append([a * hop, b * hop])
    return [dict(start=round(a, 2), end=round(b, 2), desc="unlisted vocal (ensemble / ad-lib / breath)") for a, b in out if b - a >= 0.5]


def align_set(E, src, idx, windows=True, margin=1.5):
    """Align the source lines `idx` (indices into src) as one sequence; returns the word table."""
    toks = [src[i][1].split(" ") for i in idx]
    lw = None
    if windows:
        lw = {}
        for k, i in enumerate(idx):
            nxt = next((src[j][0] for j in idx[k + 1:]), src[i][0] + 8)
            lw[k] = (src[i][0] - LRC_SLACK, max(nxt, src[i][0] + 2.0) + LRC_SLACK)
    anchors = {(idx.index(li), ti, si): v for (li, ti, si), v in ANCHORS.items() if li in idx}
    sp, score, _, _ = align(E, toks, margin=margin, anchors=anchors, line_windows=lw)
    return word_table(sp, toks, line_ids=idx), score


def main(plots=False, split=False, out_path=None, plot_lines=None):
    """split: align the lead lines on the karaoke model's lead voice and the ensemble's interjections on the backing
    (the Demucs vocals minus the lead), with the lead voice's features for the refinement (common.load_vocal_source).
    out_path: write the lyrics there instead of data/monster/lyrics.json (to compare runs before merging lines)."""
    src = common.load_lyrics_src()
    lead = [i for i, s in enumerate(src) if s[2] == "lead"]
    ens = [i for i, s in enumerate(src) if s[2] != "lead"]
    E = emissions("fused_lead" if split else PRIMARY)
    words, score = align_set(E, src, lead)
    alt = {}
    for k in ALTS:
        Ek = emissions(k + ("_lead" if split else ""))
        alt[k], _ = align_set(Ek, src, lead)
    Ee = emissions("fused_backing") if split else E
    # the ensemble's interjections, each alone in its own window (they overlap the lead)
    ens_words = []
    for i in ens:
        t0 = src[i][0]
        sub = Ee[int((t0 - 1.5) / 0.02): int((t0 + 3.0) / 0.02)]
        sp, _, _, _ = align(sub, [src[i][1].split(" ")], margin=1.0, t_offset=int((t0 - 1.5) / 0.02) * 0.02)
        ens_words += word_table(sp, [src[i][1].split(" ")], line_ids=[i])
    f = load_feats("lead" if split else None)
    words = refine(words, f, FIX)
    for k in range(1, len(words)):
        if words[k]["start"] < words[k - 1]["start"] + 0.02:
            words[k]["start"] = words[k - 1]["start"] + 0.02
        if words[k - 1]["end"] > words[k]["start"]:
            words[k - 1]["end"] = words[k]["start"]
    words = map_whisper(words, whisper_words())
    words = confidence(words, alt)
    # ensemble words: CTC boundaries with manual fixes only (their voice overlaps the lead's features)
    for w in ens_words:
        w["ctc_start"], w["ctc_end"], w["start_rule"] = w["start"], w["end"], "ctc"
        w["unit_starts"] = [s[0] for s in w["subs"]]
        fx = FIX.get((w["li"], w["ti"]))
        if fx:
            w.update({k: fx[k] for k in ("start", "end") if k in fx})
            w["manual"] = True
        w["conf_final"] = round(float(min(1.0, 0.3 + w["conf"])), 2)
    allw = sorted(words + ens_words, key=lambda w: (w["li"], w["ti"]))
    (common.WORK / ("align_debug_split.json" if split else "align_debug.json")).write_text(json.dumps(dict(words=allw, alt=alt), indent=1, default=float))

    lines = []
    for li, (t0, text, voice) in enumerate(src):
        ws = [w for w in allw if w["li"] == li]
        assert [w["w"] for w in ws] == text.split(" "), (li, text)
        out = []
        for w in ws:
            d = dict(w=w["w"], start=round(w["start"], 3), end=round(w["end"], 3), conf=w["conf_final"])
            if len(w["subs"]) > 1 and voice == "lead":
                d["syl"] = [[round(a, 3), round(b, 3)] for a, b in w["subs"]]
            out.append(d)
        lines.append(dict(i=li, text=text, start=out[0]["start"], end=out[-1]["end"], voice=voice, words=out))
    doc = dict(lines=lines, extras=detect_extras(allw, f), notes=NOTES)
    path = common.Path(out_path) if out_path else common.DATA / "lyrics.json"
    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False))
    print("wrote", path, "score", round(score, 1))
    for l in lines:
        lo = min(w["conf"] for w in l["words"])
        print(f"{l['i']:2d} {l['start']:7.2f}-{l['end']:7.2f} (lrc {src[l['i']][0]:6.2f}) {'E' if l['voice'] != 'lead' else ' '} conf>={lo:4.2f}  {l['text']}")
    if plots:
        make_plots(allw, alt, src, suffix="_split" if split else "", lines=plot_lines, source="lead" if split else "vocals")
    return allw, alt


def make_plots(words, alt, src, suffix="", lines=None, source="vocals"):
    from qa_plot import plot
    ww = whisper_words()
    for li, (t0, text, voice) in enumerate(src):
        if lines is not None and li not in lines:
            continue
        ws = [w for w in words if w["li"] == li]
        a = min(ws[0]["start"], ws[0]["ctc_start"]) - 0.8
        b = max(ws[-1]["end"], ws[-1]["ctc_end"]) + 0.6
        b = min(b, a + 8)
        lead = [w for w in words if w["li"] < len(src) and src[w["li"]][2] == "lead"]
        tracks = [
            ("final", [(w["w"], w["start"], w["end"]) for w in words]),
            ("ctc fused", [(w["w"], w["ctc_start"], w["ctc_end"]) for w in words]),
            ("mms", [(w["w"], w["start"], w["end"]) for w in alt["mms"]]),
            ("lv60k", [(w["w"], w["start"], w["end"]) for w in alt["lv60k"]]),
            ("whisper", ww),
        ]
        del lead
        plot(a, b, tracks, common.QA / f"line_{li:02d}{suffix}.png", title=f"L{li} [{voice}]: {text}",
             source=source if voice == "lead" else ("backing" if source != "vocals" else "vocals"))


def _arg(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None


def _lines(spec):
    """'36-41,54-63' -> {36, ..., 41, 54, ..., 63}"""
    out = set()
    for part in (spec or "").split(","):
        if part:
            a, _, b = part.partition("-")
            out.update(range(int(a), int(b or a) + 1))
    return out or None


if __name__ == "__main__":
    main(plots="--plots" in sys.argv, split="--split" in sys.argv, out_path=_arg("--out"), plot_lines=_lines(_arg("--lines")))
