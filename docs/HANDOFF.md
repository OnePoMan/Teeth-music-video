# Monster music video — session handoff

Read this first, then `docs/MONSTER.md` (the treatment), `docs/TREATMENT.md` (P(doom)'s style bible, whose rules still apply) and `docs/ENGINE.md` (the engine and scene API).

## The job

Make the highest-quality, code-rendered music video for **"Monster"** (Jorge Rivera-Herrans, *EPIC: The Musical*, The Underworld Saga; 218.7 s) on the engine of the original **"I'm Upping My P(doom)"** video in this repo, following its design specs (deterministic three.js engine, word-synced karaoke integrated into each plate, engraving-style line work, restrained palette, Swiss typography, beat-synced cuts). It must fit the song: Odysseus' internal conflict about what he has done and what he must become.

The work is collaborative: propose, show stills/clips, ask the client (the user) before big decisions.

## Client preferences and decisions (binding)

- **Working style (client, on mobile)**: commit and push to `ccr-af657488-ml8n3a` often, and keep this file and `docs/MONSTER.md` current, so a session can be cleared and handed off at any point without losing work. Send review clips as light copies (1600×900, CRF 26, ~10 MB) via the file-send tool.
- Communication: concise, utilitarian, no emojis, no filler. Cite a fetched URL for any factual claim attributed to an external source; flag uncertainty and community-consensus guidance explicitly.
- Concept: **"Shades"**, a shadow play in the land of the dead (full treatment in `docs/MONSTER.md`).
- Palette: P(doom)'s (ink / bone / signal orange) plus one rare accent, **dawn** `#F4A99B` (Homer's rosy-fingered dawn), only for Penelope, Telemachus and home.
- Extras: the names of the dead (Polites, Athena, Anticlea) on the stele in `losses`; small EPIC easter eggs (an owl feather, the bag of winds, the stake). **No** Greek inscriptions, **no** dry/deadpan footnotes (factual mono annotations are fine).
- The "drop another infant from a wall" line: type only, no figure.
- Palette arc: red-figure (lit figure on black) → black-figure (black silhouette on clay orange). Chorus 2 shifts toward it **gradually and very subtly**; chorus 3 is the full flip.
- **Hook 1 (approved):** "the reflection is the future" with "the shadow answers" layered on: MONSTER? stands lit on a waterline; its reflection in black water is black-figure on clay orange and has **no question mark**.
- "Don't push the design further" (no more texture/flame/scale pushes unless asked).
- **Revision 1 grammar (client review of the first verse frames, binding; `docs/MONSTER.md` "Grammar")**: one phrase on screen (1–4 words, as sung, ≤ 0.4 s early) with one hero word per line at frame scale; type as physical things in the flame's world; something happens every bar (every 2 beats in choruses/bridge); full-frame engraved detail; a Greek medium per plate. The client's words: "a lot of words on any given frame… lesser quality than the P Doom video which was a lot of dynamic movement". Verse 1 was rebuilt as the pilot under these rules; review it before building more plates.
- Final render: the **command-line pipeline** (headless Chrome + x264 CRF 16, as P(doom)) on a GPU machine the client will provide. If none works, pivot at the end (a browser render page was discussed and rejected for quality reasons: hardware/WebCodecs encoders are less efficient than x264 at equal bitrate).

## Repo state

- Branch `ccr-af657488-ml8n3a` (pushed). `main` is the untouched P(doom) repo. Other remote branches (`ccr-1136d28b-26bx1n`, `video-1080p60`) hold an earlier "Teeth" video the client wants left out of this work.
- Multi-song engine: `?song=monster` (default) or `?song=pdoom` in the preview; `--song` in `scripts/render.ts`. P(doom) still renders (checked).
- Engine changes (small, shared): `Lyrics.load`/`AudioData.load` take a data folder; `Line.voice` ('lead' | 'ensemble'); `dawn` in the palette (`C_DAWN` in GLSL); `halationTint` post parameter; `Layer2D.upload()` forces a fresh canvas snapshot (SwiftShader returned stale content otherwise); `render.ts` takes `--song`, `--browser`, `--swiftshader`.
- Monster code: `app/src/song.ts`, `app/src/monster/timeline.ts` (entries anchored to lyric lines, see the plate table), `app/src/monster/motifs.ts` (flame sprite + `flameState` (breathes with the vocal, flares on 'orch' hits), wall/floor shadow GLSL, meander path generator, `drawLamp2D`), `app/src/monster/scenes/*.ts`.
- **`app/src/monster/stage.ts` (the shadow-theatre kit, used by every verse 1 shot)**: `Word3D` (letters extruded from the font outlines, one mesh and one shadow card each; pose per letter: x, z, y, yaw, hinge (fold up from the floor), s; `glow` and `amb` uniforms), `StageCam` (`set`, `setQ`, `look`, `project`, `pxHeight`), `Stage` (fullscreen floor + wall (plane or cylinder) shader: camera rays, the flame's light, exact soft card shadows from the letters via the glyph atlas, white-line engraving in screen-constant hairlines (`pxLines`), the shadow's blood fringe; then the flame sprite and the meshes; `flameBehind`, `cards`, `noFlame` options). Scene hooks (GLSL passed to `new Stage({ hooks, uniforms })`): `carve(xz)` grooves in the floor, `floorLines(P, u)` the floor's line field, `extraShadow(P, wall)` shadows cast by nothing, `surfaceTint(P, wall, b, col)` last word on the colour; `gPix` (pixel footprint) is available to hooks for AA. `drawPhrase` (the small voice: Archivo 112.5/500 56 px, words appear as sung) and `vkeys` (vector keyframes).
- Data: `data/monster/lyrics.json` (word timings, `voice` per line, `syl` for respelled words, `extras`), `data/monster/audio.json` (grid, envelopes, onsets incl. `orch`). `lyrics/monster.src.json` = line text + approximate starts (seeded from LRCLIB record 25547554).
- **The audio is not committed** (`audio/monster.mp3` is gitignored). The client must put their copy there (3:38.71, 48 kHz MP3; the timing data were made from it). In this session it came from an upload; a new session needs the client to re-upload it.
- Render bench: `app/bench.html`, `app/src/bench.ts`, `app/vite.bench.config.ts`, `app/scripts/bench-pack.ts`, `app/scripts/bench-run.ts`. Published privately at https://claude.ai/artifact/Qsvcg6ni6xs9USZhBHZSME (db collection `runs`; the cloud container's run is seeded). Read results with the ArtifactData tool (`list`, collection `runs`).

## Song facts (from the analysis)

- Constant **90.0023 BPM**, 4/4, first beat 0.0236 s, bar 2.6666 s (Beat This! beats fitted to a constant grid; median residual 8 ms).
- Sections (downbeats): intro 0–5.36, verse1 5.36–26.69, verse1b 26.69–42.69, chorus1 42.69–69.36, verse2 69.36–109.35, chorus2 109.35–136.02, bridge 136.02–162.69, chorus3 162.69–186.69, outro 186.69–218.67.
- Energy: no drums/bass until 69 s; drums drive verse 2; drums out ~114.7–122.7; bass enters 141.4; peak 157–163; full power to the hush at 208; one last orchestral hit at 210.7. A rising 4-note orchestral figure recurs every 2 bars in verse 1 (3.0, 8.0, 13.3, 18.7, 24.0 s): `flameState` flares on it.

## Plate status

| entry | file | status |
|---|---|---|
| everything 0–9.36 | `scenes/everything.ts` | pilot built; since c633bcf it is also the opening (the flint strikes and the warrior's shadow), replacing the retired `strike` plate |
| endless 9.36–14.69 | `scenes/endless.ts` | pilot built |
| symbolon 14.69–19.36 | `scenes/symbolon.ts` | pilot built |
| change 19.36–25.36 | `scenes/change.ts` | pilot built |
| souls 25.36–36.02 | `scenes/souls.ts` | pilot built (two set-ups: the ring of SOULS and the shadow crowd; the line and anamorphic LINE) |
| sea 36.02–43.36 | `scenes/sea.ts` | pilot built (ends on hook 1's frame) |
| hook1 43.36–46.02 | `scenes/hook.ts` n=1 | built (v2, approved before revision 1) |
| hook2 | `scenes/hook.ts` n=2 | placeholder: same shore with `creep` (orange above the line). Needs its own design with the scale. |
| hook3 | `scenes/hook.ts` n=3 | draft: clay field, black MONSTER with inset incised contour, ground line, meander band. |
| mirror, cyclops, circe, poseidon, horse, scale, creed, losses, course, wall, blackfigure, outro | — | not started; designs in `docs/MONSTER.md` (rework each under the revision 1 grammar before building) |

Pilot v2 (client notes on v1 applied: words on their onsets, supporting words in 3D, CHANGE?'s shadows, THREAT black, finer face engraving): review clip `out/review/pilot-v2.mp4`. Earlier: verse 1 pilot review clip `out/review/pilot-v1.mp4` (3.0–46.6 s, 30 fps, 1 sample, SwiftShader; not committed, regenerate with the command under "Render facts"). Shot designs: `docs/MONSTER.md` plate table.

## Word-timing (alignment) status

- Pipeline in `analysis/monster/` (port of P(doom)'s): `separate.py` (Demucs htdemucs_ft) → `beats.py` (Beat This!) → `whisper_run.py` (faster-whisper large-v3) → `ctc_emissions.py` (MMS_FA + LV60K on vocal mono/L/R) → `vocal_feats.py` → `align.py --plots` (fused Viterbi with margin-scored garbage token, onset/fricative refinement, per-line QA plots in `analysis/qa/monster/line_XX.png`) → `analyze.py`.
- Environment: `uv venv analysis/.venv --python 3.12`, then `uv pip install --python analysis/.venv/bin/python torch torchaudio librosa soundfile soxr scipy numpy faster-whisper matplotlib demucs beat-this numba "audio-separator[cpu]" audioread`. Model weights go to `analysis/.cache/` (MMS_FA is 1.26 GB; one download came back truncated: verify the size). All intermediates live in `analysis/work/monster/` (gitignored, not persisted across sessions: rerun the steps).
- Good: lines 0–38 and 40–54 are close; "I lost my best friend" fixed by the fused aligner.
- Known problems to fix with `FIX`/`ANCHORS` in `align.py` after viewing the QA plots:
  - L37–39: "If I became the" / ensemble "Monster" / "Oh, ruthlessness…": "Oh," starts ~134.03 but is probably held 134.0–135.4 or starts ~135.05 (LRC); decide from the plots.
  - L55 "and then we'll make it home": end runs to 189.62; the held "home" ends ~186.9 where the ensemble "Monster" enters.
  - Outro L56–63: the ensemble's "Monster" chant overlaps "Penelope"/"Telemachus" (Whisper hears up to four "monster"s per gap); lead ends run to the next lead word.
  - Fix via the lead/backing split: a mel-band-roformer karaoke model (`mel_band_roformer_karaoke_aufr33_viperx_sdr_10.1956.ckpt` via `audio-separator`, on `analysis/work/monster/mix.wav`, the gapless ffmpeg decode) was running at handoff (~40 min on 4 CPUs). Use its lead stem for the lead lines and its backing stem for the ensemble lines (add a `lead`/`backing` source to `common.load_vocal_source` and to the emissions).
- Time reference: the gapless ffmpeg decode of the MP3 (ffmpeg trims the 23 ms encoder delay; stems, beats and lyrics all share it).

## Render facts

- This cloud container has no GPU: WebGL runs on SwiftShader. Container bench (1080p, 1 sub-frame): 2D type 438 ms, paper 1095 ms, 3D lines 931 ms, raymarched lattice 30.3 s, shoggoth 7.65 s. A final render with motion blur is not feasible here.
- Stills here: `cd app && CHROME_PATH=/opt/pw-browsers/chromium bun scripts/render.ts stills --swiftshader --t 45.9 --only hook1 --out ../out/wip/x` (then look at the PNGs). Clips: `video --swiftshader --from A --to B --fps 30 --samples 1 --only id --preset medium --out ../out/review/x.mp4`.
- Long jobs must use the Bash tool's `run_in_background` (a plain `&` job was killed when a turn ended).
- The client still has to run the bench on the gaming laptop (~2016) and the Steam Deck (in Chrome); then write exact setup steps for the winner (Chrome, bun, ffmpeg, clone, `audio/monster.mp3`, `bun scripts/render.ts video --samples auto --shutter 0.2 [--scale 2] --out ../out/monster.mp4`, segment with `--from/--to` if needed). Design the heavy plates (cyclops cave, sea) with a quality knob until the numbers are in.

## Gotchas learned

- GLSL_COMMON already defines `heat()`: don't name a uniform `heat`.
- `hatch(u, 0)` still draws a faint hairline (AA at zero width): multiply by `smoothstep(0.02, 0.08, darkness)` where unlit must be black.
- A missing scene renders dark red (placeholder), not a bug.
- `cut()` in the timeline floors to the beat at/before a line's first word; pickups move cuts up to a beat early.
- Layer2D channel tricks used: green = "casts a shadow" (hook v1), red−green = incised line inside black slip (hook n=3 and the reflection).
- The artifact host refuses XML files with a DOCTYPE (bench-pack strips it from the stroke-font SVG copies).
- faster-whisper's own decoder breaks with newer PyAV: pass an array (done in `whisper_run.py`).
- A wait loop like `until ! pgrep -f "render.ts video"` matches its own command line and never exits: use `pgrep -f "[r]ender.ts video"`.
- The no-HMR render server (`PDOOM_NO_HMR=1 bunx vite --port 5190`) does not see newly created scene files: restart it after adding one.
- `Stage` draws letter meshes after the floor/wall pass: a flame that is behind letters must be drawn first (`flameBehind: true`), or it shows through them.
- Floor engraving at grazing angles aliases; `pxLines` fades lines closer than ~3 px into their mean tone, and hooks should widen their AA by `gPix`.
- Typecheck before committing: `cd app && bunx tsc --noEmit -p . && bunx tsc --noEmit -p tsconfig.scripts.json` (both clean at handoff).

## Next steps, in order

1. Get the client's notes on pilot v2 and apply them. v1 notes and their fixes are in `docs/MONSTER.md` Grammar rules 7–8. After v2 the client proposed ENDLESS as a loading circle or an infinity loop: built as the ∞ (commit `923b0b0`; the spinner was judged too modern for the grave tone, its "chase" kept as the flame's comet tail). Review clip sent to the client: `out/review/pilot-v3-review.mp4` (pilot v2 with the ∞ section spliced in; regenerate with a full `video` render of 3.0–46.6 s, `--only strike,everything,endless,symbolon,change,souls,sea,hook1`). Awaiting the client's notes.
   - After v3 the client noted: the opening felt disjointed and flat, and the souls background lines hurt readability. Done: the new opening inside `everything` (c633bcf), plaster shadow-screen walls (souls 5dc4195, change 84c43f3), Grammar rule 9. Review clip: `out/review/pilot-v4-review.mp4` (full pilot from 0:00).
   - Open consistency item: hook 1's question ("What if I'm the") is still flat 2D type at top left from before revision 1; under Grammar rule 8 it should become physical (e.g. 3D words afloat by the lamp, as `sea` ends). Ask before changing (hook 1 was approved).
2. Finish the alignment QA (karaoke split, FIX table), regenerate `data/monster/lyrics.json`, recheck hook timings.
3. Build `mirror` (rest of chorus 1), then verse 2's four plates (`cyclops`, `circe`, `poseidon`, `horse`), then chorus 2 (`hook` n=2 + `scale`, with the very subtle orange creep), the bridge (`creed`, `losses` with the names, `course` with the dawn accent, `wall` type-only), chorus 3 (`hook` n=3 + `blackfigure`), and `outro` (loop back to the first frame of `strike`).
4. Collect bench results; give the client render-machine setup steps; final render.
5. Update `README.md` (Monster section, credits: song by Jorge Rivera-Herrans, unofficial non-commercial fan video, audio not redistributed) and keep `docs/MONSTER.md` in step with what is built.

Commit after each plate (the container is ephemeral) and push to `ccr-af657488-ml8n3a`. Commit messages end with the session's attribution lines; no model names in commits or code.
