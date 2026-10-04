# Code-rendered music videos: Teeth, and I'm Upping My P(doom)

Generative, code-rendered music videos with word-synced karaoke typography. Every frame is a deterministic function of song time, so the live preview in the browser and the offline 1080p60 (or 4K60) export are identical. One engine (`app/src/engine/`) drives two videos, picked with `?song=` in the preview and `--song` in the renderer:

- **Teeth** (default, `teeth`): "Teeth" by 5 Seconds of Summer. Concept, palette and plate-by-plate treatment in [`docs/TEETH.md`](docs/TEETH.md).
- **I'm Upping My P(doom)** (`pdoom`): see [below](#im-upping-my-pdoom).

## Teeth

**Love leaves marks.** Every plate is a surface something presses into: teeth into type, a body into a bedsheet, ink into a folded Rorschach card, blood into a shirt, hands onto the frame. Running through the whole video is the bite, a red zigzag seam across the frame: two interlocking rows of teeth, a hairline when closed, a glowing mouth when open. In the choruses every word is set full-frame and bitten shut between the jaws on its beat.

| plate | section | idea |
|---|---|---|
| `seam` | intro (bass riff) | the closed bite breathes with the bass; TEETH yawns open and snaps shut on the first word |
| `ember` | verse 1a | cold and frosted; words thaw to red heat as sung, "burning" catches fire, the camera is yanked back on "can't look away" |
| `sheets` | verse 1b | words rise under a lit bedsheet (a height field with cast shadows); the sheet is shoved on "push me away" |
| `rorschach` ×2 | pre-choruses | one inkblot card per line, folded and pressed on the beat, scored by a deadpan clinician; the last card's jaw snaps into the chorus |
| `jaw` ×3 | choruses | full-frame bitten words; grime and splatter, a dripping "sweet", a heart that grows teeth, handprints, NEVER stacked, GO held in the bite |
| `ring` | verse 2 | a hairline-engraved ring with the line around its band; it turns and grows teeth on its inner face |
| `shirt` | bridge + stripped chorus | blood blooms through a white shirt; a pen-drawn rose unwinds into a heart that keeps beating with no drums under it |
| `throat` | outro | three TEETH shouts, the last line, a tunnel of tooth rings biting on the snare, then the seam goes out at the hard stop |

**Audio.** The song itself is not in the repository. Put your copy of the recording at `audio/teeth.mp3` (the timing data was made from a 3:25 (205.0 s), 48 kHz MP3 of the song; a different edit or master may need a re-run of the analysis below).

**Timing data** (`data/teeth/`, made by `analysis/teeth/`, any Python 3.11+ environment with torch/torchaudio CPU wheels, librosa, soundfile and faster-whisper):

```sh
cd analysis/teeth
python separate.py     # Demucs (torchaudio HDEMUCS_HIGH_MUSDB_PLUS) stems -> analysis/work/teeth/stems/
python whisper_run.py  # faster-whisper large-v3 word timestamps (a cross-check)
python align.py        # data/teeth/lyrics.json: MMS_FA CTC forced alignment per line, held-vowel ends,
                       # beat snapping and the chorus rhythm template (one word per beat, all six repeats)
python analyze.py      # data/teeth/audio.json: 139.0 BPM grid, downbeats, sections, envelopes, onsets
```

The line-level lyric text and approximate line starts (`lyrics/teeth.src.json`) come from LRCLIB; word timings are derived from the audio.

**Render** (from `app/`, see [Render the video](#render-the-video) for the options):

```sh
bun scripts/render.ts video --samples auto --shutter 0.2 --out ../out/teeth.mp4
```

Without a GPU (a Linux container, CI), point the renderer at a Chromium binary and use WebGL on the CPU: `bun scripts/render.ts video --browser /path/to/chrome --swiftshader --fps 30 --samples 1 --out ../out/teeth.mp4`. Expect about 0.5–1.2 s per frame on 4 cores.

# I'm Upping My P(doom)

**Watch it in 4K on YouTube:** https://www.youtube.com/watch?v=5EoO5413dBY

The YouTube upload is an earlier render: it averages only 4 sub-frames per frame for motion blur, so fast motion shows stepped copies, and YouTube's compression smears the film grain. For the best version, render it locally (see [Render the video](#render-the-video)): the current code picks up to 324 sub-frames per frame where the motion needs them.

The video was made with Claude (Opus 5.5) in Claude Code: the concept and treatment, the lyric alignment and audio analysis, the renderer, every scene and the renders were all worked out in conversation with Claude.

The song is not ours: see [Credits](#credits) for who wrote and made it.

The concept, style bible and plate-by-plate treatment are in [`docs/TREATMENT.md`](docs/TREATMENT.md). The engine and scene API are documented in [`docs/ENGINE.md`](docs/ENGINE.md).

## Layout

- `audio/pdoom.mp3` — the song (the Claude-Pop version, see Credits). `audio/teeth.mp3` is not in the repository (see [Teeth](#teeth)).
- `lyrics/lyrics.src.js` — the original line-level lyrics (approximate timings).
- `analysis/` — Python (uv) tools that produced the timing data: Demucs stem separation, CTC forced alignment cross-checked with Whisper, beat/downbeat/onset analysis. See `analysis/align.py` and `analysis/analyze.py`.
- `data/lyrics.json` — word-level (and some syllable-level) lyric timings.
- `data/audio.json` — tempo (132.007 BPM), beats, downbeats, sections, drum/vocal onsets and loudness envelopes.
- `app/` — the renderer: TypeScript + three.js, bun + Vite.
  - `src/engine/` — renderer core: timeline playback, post-processing (bloom, halation, grain), typography (Archivo, IBM Plex Mono, Cormorant Garamond, single-stroke plotter fonts), GPU line batches, HUD.
  - `src/scenes/` — one module per plate (`open`, `loss`, `prompt`, `hook`, `room`, `shoggoth`, `spacetime`, `ascent`, `bureau`, `leftturn`, `paperclips`, `fuse`, `stack`, `dense`, `loom`, `ilya`, `outro`) plus shared motifs.
  - `src/timeline.ts` — the P(doom) edit: scene windows anchored to lyric lines and snapped to the beat grid. `src/teeth/` holds the Teeth timeline, palette, motifs and scenes; `src/song.ts` picks the song.
  - `scripts/render.ts` — offline renderer (headless Chrome → raw frames over WebSocket → ffmpeg).
- `out/` — renders (not in the repo).

## Requirements

[bun](https://bun.sh), Google Chrome (the offline renderer drives it headless through playwright-core) and ffmpeg with libx264. The analysis tools need [uv](https://docs.astral.sh/uv/); the renderer doesn't.

## Preview

```sh
cd app
bun install
bunx vite
```

Open http://localhost:5173 (Teeth) or http://localhost:5173/?song=pdoom and use the keys below. `?t=23` starts at a given time.

| Key | Action |
|---|---|
| space | play / pause |
| ← / → | seek ±1 s (±5 s with shift) |
| `,` / `.` | step one frame |
| `[` / `]` | previous / next scene |
| `l` | loop the current scene |
| `h` | hide the UI |

The preview renders in real time on a recent Mac. The export is not real time and is heavier.

## Render the video

```sh
cd app
bun scripts/render.ts video --song pdoom --samples auto --shutter 0.2 --out ../out/pdoom.mp4
```

- **Output:** 1920×1080 at 60 fps, x264 CRF 16, AAC audio.
- **Motion blur:** every frame is the average of many sub-frames spread over a short shutter (`--shutter 0.2`, a fifth of the frame time), so fast motion leaves a continuous streak instead of a few stepped copies. `--samples auto` picks the count per frame: 12 for a still frame, 36 for ordinary camera motion, 108 or 324 for whips, slams and fast zooms. It stops once more sub-frames would no longer change the image by more than `--tol` levels of 255 (default 3). `--samples N` takes a fixed N instead (`--samples 4` makes a quick draft). How it works: "Motion blur and sampling" in [`docs/ENGINE.md`](docs/ENGINE.md).
- **Other modes:** `stills`, `sheet` (contact sheets, `--cuts` for every scene boundary), `perf`, and `plates` (regenerates `public/plates/`, the stills used by the outro's rewind montage; rerun it after changing a scene).

### 4K

```sh
cd app
bun scripts/render.ts video --song pdoom --scale 2 --samples auto --shutter 0.2 --x264 aq-mode=3:rc-lookahead=30 --out ../out/pdoom-4k.mp4
```

- **Output:** a true 3840×2160 render (not an upscale): every layer, line and shader is rendered at the physical resolution. Scenes are laid out in 1920×1080 logical pixels, so the 4K frame looks like the 1080p one, only sharper.
- **Cost:** GPU-bound. A frame takes from about 40 ms (a still frame) to over 10 s (the ray-marched rooms at 108–324 sub-frames). The whole song took about 2.5 hours on an M5 Pro, rendered as segments in two parallel pipelines (`--from`/`--to`, then a lossless concat). Each pipeline uses about 5 GB for headless Chrome plus about 4 GB for ffmpeg; the shorter x264 lookahead above keeps ffmpeg's memory down.
- **Encoding:** the film grain is rendered per 4K pixel, which is expensive to encode: at the default CRF 16 the file runs at about 670 Mbit/s (13 GB for the song, 8× the 1080p file), `--crf 18` gives about 450 Mbit/s and `--crf 20` about 230 Mbit/s.
- `--scale 2` works with every mode. `stills` then saves full-resolution PNGs, and `perf` measures 4K frame times. In the browser preview, add `&scale=2` to the URL.

## Regenerate the timing data

The committed `data/*.json` files are all the renderer needs. Regenerating them needs the stems and intermediates, which are not in the repo:

- **Stems:** Demucs `htdemucs_ft` into `analysis/stems/htdemucs_ft/pdoom/` (`uv run python -m demucs -n htdemucs_ft -o stems ../audio/pdoom.mp3`), plus the lead vocal from a mel-band-roformer karaoke model (audio-separator) in `analysis/stems/karaoke/lead.wav`.
- **Intermediates:** `ctc_emissions.py`, `whisper_run.py` and `vocal_feats.py` write them to `analysis/work/`. The pipeline is described at the top of `analysis/align.py`.

```sh
cd analysis
uv run python align.py      # data/lyrics.json
uv run python analyze.py    # data/audio.json
```

The models download about 4 GB of weights into `analysis/.cache/`; delete that folder afterwards.

## Credits

- **Teeth:** "Teeth" by 5 Seconds of Summer. The song, its recording and its lyrics belong to their writers and rights holders; this is an unofficial, non-commercial fan video. Line-level lyric timings were seeded from [LRCLIB](https://lrclib.net).
- **I'm Upping My P(doom):** "I'm Upping My P(doom)". The lyrics are by [osmarks](https://docs.osmarks.net/hypha/p%28doom%29_song_objectively_correct_interpretation), built on an opening verse and chorus by [MusicPerson](https://www.udio.com/creators/MusicPerson), with lines suggested on the EleutherAI Discord and help from Claude on the outro and final chorus. The original was generated with Udio and released in November 2024 ([YouTube](https://www.youtube.com/watch?v=uEB5E67vcPA)). This video uses the "Claude-Pop" version made with Suno, posted by [deckard (@slimer48484)](https://x.com/slimer48484/status/2097752569212756134) in September 2026.
- **Fonts:** Archivo, IBM Plex Mono and Cormorant Garamond (SIL Open Font License). Single-stroke EMS and Hershey fonts via the `hersheytext` package (OFL / public domain).

## License

The code is released under the [MIT License](LICENSE). The fonts in `app/public/fonts/` keep their own licenses (see Credits), and the songs and lyrics (`audio/`, `lyrics/`, `data/lyrics.json`, `data/teeth/lyrics.json`) are not covered by it: they belong to their authors (see Credits).
