"""faster-whisper word timestamps on the vocal stem -> work/teeth/whisper.json (a cross-check for align.py)."""
import json

import common  # noqa: F401
from faster_whisper import WhisperModel

from common import STEMS, WORK

m = WhisperModel("large-v3", device="cpu", compute_type="int8", cpu_threads=4)
segs, _ = m.transcribe(str(STEMS / "vocals.wav"), language="en", word_timestamps=True, vad_filter=False, beam_size=5)
out = []
for s in segs:
    print(f"{s.start:7.2f} {s.text}", flush=True)
    for w in s.words or []:
        out.append({"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)})
(WORK / "whisper.json").write_text(json.dumps(out))
