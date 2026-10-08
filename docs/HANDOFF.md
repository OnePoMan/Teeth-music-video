# Monster music video — session handoff

Read this first, then `docs/MONSTER.md` (the treatment), `docs/TREATMENT.md` (P(doom)'s style bible, whose rules still apply) and `docs/ENGINE.md` (the engine and scene API).

## Start here (next session: local, on the client's laptop; paused 2026-10-08)

Until now the work ran in Claude Code cloud sessions (an ephemeral container, no GPU). The client paused it to continue in a local session on their laptop.

**State at the pause.** Everything is committed and pushed on `ccr-af657488-ml8n3a` (head: the commit that adds this section; the code is at `ae66938`). Pilot v7 (the client's notes on pilot v6, see "Pilot v6 review") is fully built and hook 1 was verified on a clip, but **v7 is not rendered or sent**. The cloud render was stopped at the pause, and its partial segments died with the container (`out/` is gitignored). The earlier review videos (`out/review/pilot-v*.mp4`) were also only in the container; the client has the ones that were sent. Both typechecks were clean at the pause.

**Set up the laptop (once).**
1. Get the branch: `git clone https://github.com/OnePoMan/Teeth-music-video` (or `git fetch origin` in an existing clone), then `git checkout ccr-af657488-ml8n3a`.
2. Install [bun](https://bun.sh), ffmpeg with libx264, and Google Chrome (the renderer drives it headless via playwright-core; on macOS it uses Metal). Python/uv is only needed to re-run the lyric alignment (`analysis/`). The client's laptop runs **Windows** with the Claude desktop app (Code tab, Local environment, project folder = the clone). There: Git for Windows (`winget install --id Git.Git -e --source winget`; it brings Git Bash, which Claude Code uses for its Bash tool, and Git Credential Manager, which signs in to GitHub in the browser), bun (`powershell -c "irm bun.sh/install.ps1|iex"`), ffmpeg (`winget install ffmpeg`, the full build). Open a new terminal after installing, so the new PATH applies. `.gitattributes` keeps `*.sh` at LF so Git Bash can run the render scripts. Env-var prefixes such as `PDOOM_NO_HMR=1 bunx vite` are bash syntax; in PowerShell use `$env:PDOOM_NO_HMR=1; bunx vite …`.
3. `cd app && bun install`.
4. Put the client's own copy of the song at `audio/monster.mp3` (3:38.71, 48 kHz MP3; the timing data were made from it). It is gitignored: never commit it.
5. Preview: `cd app && bunx vite`, then open `http://localhost:5173/?t=43` (`?t=` start time, `&only=hook1` loads one scene; keys: space play/pause, ←/→ ±1 s, `,`/`.` one frame, `[`/`]` scenes, `l` loop the scene, `h` hide the UI).
6. Typecheck: `cd app && bunx tsc --noEmit -p . && bunx tsc --noEmit -p tsconfig.scripts.json`.

**Then, in order.**
1. **Render pilot v7.** Run `bash app/scripts/review-v7.sh` from the repo root (bash: macOS/Linux; on Windows use Git Bash or WSL). By default it uses Google Chrome on the GPU. It renders five frame-exact segments into `out/review/v7/` (it skips segments already done, so it can be resumed). The last segment ends at the hook 1 → `mirror` cut (46.022 s; `mirror` is not built yet), and its last frame (46.000 s) is held to 46.6 s, so the red missing-scene placeholder never shows. It then writes `out/review/pilot-v7.mp4` and the light copy `out/review/pilot-v7-review.mp4` (1600×900, CRF 26). It talks to a dev server at `http://localhost:5190`: start one with `cd app && PDOOM_NO_HMR=1 bunx vite --port 5190 --strictPort`, or let `render.ts` start a private one. Time the first segment: this is also the first real measure of the laptop as the final-render machine (see "Render facts").
2. **Watch the whole render** against the v7 checklist below, then send the light copy to the client with a short note of what changed.
3. **Chorus 1 (`mirror`, 46.02–69.4 s).** The client said they would come back to it. Proposals A/B/C are under "Next plate proposals"; ask before building.

**v7 checklist (the client's v6 notes; check each in the render).**
- 6.9–9.4 s (`everything`): "been turned" is flat before "against" springs, with no overlap. On "against us?" the four monsters strike the word in turn on 8.00/8.34/8.67/9.00: Polyphemus' club, Circe's staff and charging pig, Poseidon's trident, the horse's soldiers pouring down. The fire gutters into the cut. Nothing zooms at the camera.
- 36–43.4 s (`sea`): THREAT leaves together with "across the sea", not after it.
- 43.36–46.02 s (`hook1`): checked frame by frame on a clip in the cloud session (code at `ae66938`):
  - The cut from `sea` is seamless, and "Is me?" lies down.
  - "What if I'm the" pops on each onset (43.95, 44.52, 44.74, 45.14), afloat and reflected, and folds away from 45.20 as the camera starts down. It is gone before MONSTER? rises, and no speck is left over the reflection.
  - MONSTER? stands up on 45.32 with the ember flash. Its reflection has no "?" and is black-figure with an incised contour, with the orange developing behind it.
  - The camera ends with the waterline at about 0.536 H.
  - Known and accepted for now: mid-dip (45.4–45.6) the swell bends the reflected word strongly. If the client minds, lower the bend near the word, e.g. in `waterHook` re-sample `reflTex` at an `ruv` mixed toward `FRAG_PX`.

**Working style (client, current).** Delegate most of the work to subagents (the client asked for Opus 5.5 at medium effort). Review their results yourself, with stills or clips, before committing. Commit and push often, and keep this file and `docs/MONSTER.md` current.

## The job

Make the highest-quality, code-rendered music video for **"Monster"** (Jorge Rivera-Herrans, *EPIC: The Musical*, The Underworld Saga; 218.7 s) on the engine of the original **"I'm Upping My P(doom)"** video in this repo, following its design specs (deterministic three.js engine, word-synced karaoke integrated into each plate, engraving-style line work, restrained palette, Swiss typography, beat-synced cuts). It must fit the song: Odysseus' internal conflict about what he has done and what he must become.

The work is collaborative: propose, show stills/clips, ask the client (the user) before big decisions.

## Client preferences and decisions (binding)

- **Working style**: commit and push to `ccr-af657488-ml8n3a` often, and keep this file and `docs/MONSTER.md` current, so a session can be cleared and handed off at any point without losing work. Review clips go to the client as light copies (1600×900, CRF 26, ~10 MB); in cloud sessions (client on mobile) they were sent with the file-send tool. Delegate most work to subagents and review it yourself (see "Start here").
- Communication: concise, utilitarian, no emojis, no filler. Cite a fetched URL for any factual claim attributed to an external source; flag uncertainty and community-consensus guidance explicitly.
- Concept: **"Shades"**, a shadow play in the land of the dead (full treatment in `docs/MONSTER.md`).
- Palette: P(doom)'s (ink / bone / signal orange) plus one rare accent, **dawn** `#F4A99B` (Homer's rosy-fingered dawn), only for Penelope, Telemachus and home.
- Extras: the names of the dead (Polites, Athena, Anticlea) on the stele in `losses`; small EPIC easter eggs (an owl feather, the bag of winds, the stake). **No** Greek inscriptions, **no** dry/deadpan footnotes (factual mono annotations are fine).
- The "drop another infant from a wall" line: type only, no figure.
- Palette arc: red-figure (lit figure on black) → black-figure (black silhouette on clay orange). Chorus 2 shifts toward it **gradually and very subtly**; chorus 3 is the full flip.
- **Hook 1 (approved):** "the reflection is the future" with "the shadow answers" layered on: MONSTER? stands lit on a waterline; its reflection in black water is black-figure on clay orange and has **no question mark**. v7 extends it into the hook motif "the reflection disobeys" (see "Pilot v6 review" 4).
- "Don't push the design further" (no more texture/flame/scale pushes unless asked).
- **Revision 1 grammar (client review of the first verse frames, binding; `docs/MONSTER.md` "Grammar")**: one phrase on screen (1–4 words, as sung, ≤ 0.4 s early) with one hero word per line at frame scale; type as physical things in the flame's world; something happens every bar (every 2 beats in choruses/bridge); full-frame engraved detail; a Greek medium per plate. The client's words: "a lot of words on any given frame… lesser quality than the P Doom video which was a lot of dynamic movement". Verse 1 was rebuilt as the pilot under these rules; review it before building more plates.
- Final render: the **command-line pipeline** (headless Chrome + x264 CRF 16, as P(doom)) on a GPU machine the client will provide. If none works, pivot at the end (a browser render page was discussed and rejected for quality reasons: hardware/WebCodecs encoders are less efficient than x264 at equal bitrate).

## Repo state

- Branch `ccr-af657488-ml8n3a` (pushed). `main` is the untouched P(doom) repo. Other remote branches (`ccr-1136d28b-26bx1n`, `video-1080p60`) hold an earlier "Teeth" video the client wants left out of this work.
- Multi-song engine: `?song=monster` (default) or `?song=pdoom` in the preview; `--song` in `scripts/render.ts`. P(doom) still renders (checked).
- Engine changes (small, shared): `Lyrics.load`/`AudioData.load` take a data folder; `Line.voice` ('lead' | 'ensemble'); `dawn` in the palette (`C_DAWN` in GLSL); `halationTint` post parameter; `Layer2D.upload()` forces a fresh canvas snapshot (SwiftShader returned stale content otherwise); `render.ts` takes `--song`, `--browser`, `--swiftshader`.
- Monster code: `app/src/song.ts`, `app/src/monster/timeline.ts` (entries anchored to lyric lines, see the plate table), `app/src/monster/motifs.ts` (flame sprite + `flameState` (breathes with the vocal, flares on 'orch' hits), wall/floor shadow GLSL, meander path generator, `drawLamp2D`), `app/src/monster/scenes/*.ts`.
- **`app/src/monster/stage.ts` (the shadow-theatre kit, used by every verse 1 shot; surfaces in the Greek vase style by default: `clayWall`, black-glaze floor with a mirrored render of the scene and the flame's column, `carve` = decoration reserved in the clay; `vase: false` restores the engraving)**: `Word3D` (letters extruded from the font outlines, one mesh and one shadow card each; pose per letter: x, z, y, yaw, hinge (fold up from the floor), s; `glow` and `amb` uniforms), `StageCam` (`set`, `setQ`, `look`, `project`, `pxHeight`), `Stage` (fullscreen floor + wall (plane or cylinder) shader: camera rays, the flame's light, exact soft card shadows from the letters via the glyph atlas, white-line engraving in screen-constant hairlines (`pxLines`), the shadow's blood fringe; then the flame sprite and the meshes; `flameBehind`, `cards`, `noFlame` options). Scene hooks (GLSL passed to `new Stage({ hooks, uniforms })`): `carve(xz)` grooves in the floor, `floorLines(P, u)` the floor's line field, `extraShadow(P, wall)` shadows cast by nothing, `surfaceTint(P, wall, b, col)` last word on the colour; `gPix` (pixel footprint) is available to hooks for AA. `drawPhrase` (the small voice: Archivo 112.5/500 56 px, words appear as sung) and `vkeys` (vector keyframes).
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
| everything 0–9.36 | `scenes/everything.ts` | v6: the opening is the four monsters' shadows on the clay wall (`figures.ts`, stills sent for the client's recognizability check); line 1: EVERYTHING's shadow is the monster frieze, eyes open on "turned"; v7: "been turned" is flat before "against" springs (765aa5b), and on "against us?" the four strike at the word in turn on 8.00/8.34/8.67/9.00, puppet-fashion, the fire guttering into the cut on the last (94938b3; replaces the rush at the camera) |
| endless 9.36–14.69 | `scenes/endless.ts` | v6: the fuse is the groove glowing as it is cut |
| symbolon 14.69–19.36 | `scenes/symbolon.ts` | v6: phrases readable on the halves, mirror water, Penelope at her loom and the dawn thread |
| change 19.36–25.36 | `scenes/change.ts` | v6: A+B (flips to black glaze on the eighths, bigger shadows; the shadow becomes the monsters) |
| souls 25.36–36.02 | `scenes/souls.ts` | v6: no central flame; the line is the edge of our light |
| sea 36.02–43.36 | `scenes/sea.ts` | v7: no lamp, mirror water; THREAT lies down with "across the sea" (765aa5b); ends on hook 1's first frame (`SHORE` in `stage.ts`) |
| hook1 43.36–46.02 | `scenes/hook.ts` n=1 | v7 (d437124): 3D on the stage, "the reflection disobeys": wine-dark mirror water, fire behind us; "Is me?" carried over from `sea` lies down; "What if I'm the" afloat near us, truly reflected; MONSTER? stands up on the waterline, lit; its reflection is black-figure (`bf` + `incise`) with no "?", the orange developing behind it (`WATER_HOOK`); the camera dips to the waterline on MONSTER. No 2D type left (the WATERLINE ledger label and the flat question are gone). `ae66938`: the question folds away from the dip's start (45.20), and nearly flat letters are hidden. Verified on a clip (see the v7 checklist) |
| hook2 | `scenes/hook.ts` n=2 | placeholder on hook 1's 3D shore: the reflection leads the word by 0.15 s, `creep` (orange above the line). Needs its own design with the scale. |
| hook3 | `scenes/hook.ts` n=3 | draft (2D, unchanged): clay field, black MONSTER with inset incised contour, ground line, meander band. To be rebuilt on the motif (the reflection stands up and takes the word's place). |
| mirror, cyclops, circe, poseidon, horse, scale, creed, losses, course, wall, blackfigure, outro | — | not started; designs in `docs/MONSTER.md` (rework each under the revision 1 grammar before building) |

Pilot v2 (client notes on v1 applied: words on their onsets, supporting words in 3D, CHANGE?'s shadows, THREAT black, finer face engraving): review clip `out/review/pilot-v2.mp4`. Earlier: verse 1 pilot review clip `out/review/pilot-v1.mp4` (3.0–46.6 s, 30 fps, 1 sample, SwiftShader; not committed, regenerate with the command under "Render facts"). Shot designs: `docs/MONSTER.md` plate table.

## Pilot v5 review (client notes; binding unless marked open)

1. **No visible flame anywhere** (it reads as pasted on: a 2D sprite on bare floor or a flat lamp drawing on 3D water, and usually the brightest thing in frame). Keep the shadows it casts. A new visual through-line is needed (open, see proposals).
2. **Opening**: replace the warrior's shadow with **Polyphemus, Circe, Poseidon, then the Trojan horse** (an early motif for verse 2's four plates), each clearly recognizable; common symbols are fine (sheep, pig, trident).
3. **"against us?"**: "us?" is off beat and late. Diagnosed: aligned at 8.00 (low confidence) where the rising figure starts; the vocal envelope shows "us" sung 7.60–8.12 (Whisper: 7.10–7.92). Fix: `FIX` in `analysis/monster/align.py`, "against" 6.97–7.56, "us?" 7.60–8.14; pop "us?" at 7.60, keep the big hit on the 8.02 downbeat; make "us?" larger and clear of EVERYTHING's reflection.
4. **symbolon**: "How am I to" is unreadable (small, on the far rim, nearly edge-on); "with my" has the same problem.
5. **No line fields on floors or water anywhere** (symbolon's and sea's engraved swells go). Replacement open.
6. **CHANGE?** reads boring (21.1–25.1 s: nothing changes for 4 s). Open.
7. Wants a visual that ties "estranged?" to **Penelope**. Open.

**Client's choices on the v5 proposals (binding):** 1) through-line **A** (no visible flame; unseen key light behind the camera; each hero word's dark double grows plate by plate), and hook 1 may lose its lamp; 2) the opening as proposed (Polyphemus, Circe, Poseidon, the horse as shadows on the clay wall): **send four stills for a recognizability check before animating**; 3) "estranged?" **A mixed with B**: the word woven in dawn thread between the halves, unravelling as they part, strung across the water to Penelope at her loom on the far shore; if the dawn tones are too alike, change one so the most important part (the word) stands out; 4) water: **black mirror water with the wine-dark tint**; 5) CHANGE?: **A + B**.

Proposals sent to the client (recommended first):
- Through-line: **A** keep the light, lose the flame: one flickering key behind the camera, over the shoulder (still flaring on 'orch' hits); the through-line is each hero word's **dark double** (shadow on clay, reflection on water), growing plate by plate until it covers the frame in chorus 3 (= the black-figure flip); the four monsters are its vocabulary. **B** his half of the symbolon reappears in every plate in a new guise, halves meet in the outro. **C** one dawn thread (Penelope's) through every plate, replacing the line, cut on "I will deal the blow". Knock-ons of A: hook 1 loses its lamp (needs client OK, hook 1 was approved); `endless`' fuse becomes the groove glowing as it is cut; `souls`' line becomes the edge of our light.
- Opening (shadow theatre on the clay wall, one monster per musical event): 0–1.70 swell, Polyphemus (giant head and shoulders, sheep crossing, the single eye opens as a cut-out showing lit clay); 1.70–2.70 bass note, Circe (stirring a cup with her staff, a man's head becomes a pig's, tail sprouts); 2.70–3.67 Poseidon (wave heaves, trident through the crest on 3.01, a galley tips on 3.34); 3.67–4.66 the horse (rolls in on its platform, hatches open with light on 3.84/4.18). Line 1: EVERYTHING's shadow is all four; "turned" they face us; "against us?" they rush the camera on 8.00/8.34/8.67/9.00. Verse 2 plates open on their intro silhouettes. Send four stills for a recognizability check before animating. Alternative: a black-figure krater turning, four panels.
- "estranged?": **A** Penelope at her loom on a far shore (faceless, seated, cheek on hand), lit in dawn (first use of the accent), the letters strung across the water toward her; **B** the word woven in dawn thread between the halves, unravelling as they part (her shroud ruse); **C** her half's face turns dawn with her loom reserved in the clay; **D** a dawn line on the horizon only. The tie must read in ~1 s (sung 18.32–19.08, cut 19.36); start building on "my" (17.84).
- Water: **black mirror water** (no lines, swells shown only by bending reflections; optional wine-dark tint); alternatives: one running-wave band at the far shore only; low mist. Decorative bands (meander in `endless`, ring in `souls`) stay unless the client says otherwise.
- CHANGE?: **A** from the 21.36 downbeat one letter per eighth note snaps round and comes back black-glazed (done ~23.4), each flip a bigger shadow; **B** then on the figure's notes (24.01/24.35/24.67/25.01) its shadow becomes the four monsters; **C** Archivo width/weight steps per eighth (wide/light to condensed/black); **D** the bone skin cracks off, black letters underneath.

## Pilot v6 review (client notes; binding)

1. "against us?": the monsters zooming at the camera felt cheesy; the client loved the opening's animation. **Choice: each strikes in turn**, puppet moves like the opening, one per note (8.00/8.34/8.67/9.00), aimed at the word: Polyphemus brings his club down, Circe levels her staff and the pig charges, Poseidon hurls his trident, the horse's hatch bursts and shadow soldiers pour down the ladder; on the last hit the fire gutters into the cut.
2. "been turned" overlapped "against": fixed (765aa5b), a crisp hand-over on the onset.
3. THREAT lingered after "across the sea": fixed (765aa5b), they leave together.
4. Hook 1's intro must follow the new specs. **Choice: the reflection disobeys**: 3D words on the wine-dark mirror water, lit by the fire behind us; "What if I'm the" afloat and truly reflected; MONSTER? on the waterline, its reflection the black-figure answer with no "?". The motif escalates: hook 1 the reflection only drops the "?"; hook 2 it moves before the word does and the orange climbs above the line; hook 3 it stands up out of the water and takes the word's place. Signature shot every hook: the camera dips to the waterline on MONSTER (half word, half reflection).
5. Chorus 1 (`mirror`): "come back to it in a bit" (proposals below still open).

## Next plate proposals (to send with pilot v6; not yet approved)

`mirror` (0:46.5–1:09, rest of chorus 1; lines 9–14: "What if I'm in the wrong? / …the problem that's been hiding all along? / …the one who killed you every time I caved to guilt? / …far too kind to foes, / but a monster to ourselves? / What if I'm the monster?"; dense 'orch' pulse, downbeats 48.02, 50.69, 53.36, 56.02, 58.69, 61.35, 64.02, 66.69; something every 2 beats):
- **A (recommended)** stay on hook 1's shore: each line's hero word stands on the waterline, lit; its reflection answers in black-figure and grows line by line (the dark double): WRONG? → WRONG; PROBLEM above, HIDING only in the water; GUILT above, the shades lying under the water; a balance painted on the clay field, FOES' pan rising, OURSELVES' sinking into the water; MONSTER? with its reflection now taller than the word. Cuts between low angles and dips through the waterline on the 2-beat grid.
- **B** back to the cave wall: each hero word's shadow becomes one monster in turn; all four on "a monster to ourselves".
- **C** a black-figure krater turning, one painted scene per line.

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

- On a machine with Google Chrome and a GPU (the laptop): stills `cd app && bun scripts/render.ts stills --t 45.9 --only hook1 --url http://localhost:5190 --out ../out/wip/x` (then look at the PNGs); clips `bun scripts/render.ts video --from A --to B --fps 30 --samples 1 --only id --preset medium --noaudio --out ../out/review/x.mp4`; frame cost `bun scripts/render.ts perf --from 20 --to 25`. `--only` takes the scene ids that are on screen in the range (e.g. `sea,hook1`). `--to` is exclusive: frames round(from·fps) … round(to·fps)−1, frame n at n/fps.
- In a cloud container (no GPU, no Chrome): add `CHROME_PATH=/opt/pw-browsers/chromium` and `--swiftshader` (WebGL on the CPU), and for the v7 script `CHROME_PATH=/opt/pw-browsers/chromium RENDER_GL=--swiftshader bash app/scripts/review-v7.sh`. Container bench (1080p, 1 sub-frame): 2D type 438 ms, paper 1095 ms, 3D lines 931 ms, raymarched lattice 30.3 s, shoggoth 7.65 s; the v6 pilot (46.6 s at 30 fps) took about 50 min there. A final render with motion blur is not feasible there.
- Cloud sessions only: long jobs must use the Bash tool's `run_in_background` (a plain `&` job was killed when a turn ended), background jobs die after 2 h, and the container can restart and kill everything (hence the segmented scripts).
- The client still has to run the bench on the gaming laptop (~2016) and the Steam Deck (in Chrome). Now that the work runs on the laptop, the v7 render's segment times (and `perf`) measure it directly. Then write exact setup steps for the winner (Chrome, bun, ffmpeg, clone, `audio/monster.mp3`, `bun scripts/render.ts video --samples auto --shutter 0.2 [--scale 2] --out ../out/monster.mp4`, segment with `--from/--to` if needed). Design the heavy plates (cyclops cave, sea) with a quality knob until the numbers are in.

## Gotchas learned

- GLSL_COMMON already defines `heat()`: don't name a uniform `heat`.
- `hatch(u, 0)` still draws a faint hairline (AA at zero width): multiply by `smoothstep(0.02, 0.08, darkness)` where unlit must be black.
- A missing scene renders dark red (placeholder), not a bug.
- `cut()` in the timeline floors to the beat at/before a line's first word; pickups move cuts up to a beat early.
- Layer2D channel tricks used: green = "casts a shadow" (hook v1), red−green = incised line inside black slip (hook n=3).
- Black-figure letters (hook's reflection): `Word3D` option `incise` builds `incTex` (each glyph in black with a red contour ring inside it, from the same atlas layout); the letter shader's `bf` uniform (1) draws black slip with that contour scratched back to the clay, unlit. `incTex` is assigned to the letters after their uniforms are cloned: `UniformsUtils.clone` would copy the texture once per letter.
- `WATER_HOOK`: a scene that defines it in its hooks GLSL supplies `waterHook(px, ruv, rt, col)`, called on the water after the reflection is mixed in; `ruv` is the swell-bent reflection uv (where the swell moved what this point mirrors), `rt` the mirrored render there. Paint anything that should sit in the reflection with `ruv`, not `FRAG_PX`, or it will not ripple with the rest.
- `Stage.render(..., { mirror: { before, after } })` runs around the mirrored scene render, so a reflection can differ from its word: hook hides the "?" mesh and sets `bf` (n=1) and poses the word 0.15 s ahead (n=2), then restores both in `after`.
- `SHORE` (exported from `stage.ts`: the far shore's z and the camera's y, z, pitch) is the single source of truth for the sea→hook hand-off frame; `sea.ts` ends on it and `hook.ts` starts from it. Change it there only.
- The artifact host refuses XML files with a DOCTYPE (bench-pack strips it from the stroke-font SVG copies).
- faster-whisper's own decoder breaks with newer PyAV: pass an array (done in `whisper_run.py`).
- A wait loop like `until ! pgrep -f "render.ts video"` matches its own command line and never exits: use `pgrep -f "[r]ender.ts video"`.
- The no-HMR render server (`PDOOM_NO_HMR=1 bunx vite --port 5190`) does not see newly created scene files: restart it after adding one. It must stay up for a whole `video` render (the page keeps fetching from it), and a background command is killed after 2 h: restart the server before any long render if it has been up for more than ~1.5 h.
- `Stage` draws letter meshes after the floor/wall pass: a flame that is behind letters must be drawn first (`flameBehind: true`), or it shows through them.
- Floor engraving at grazing angles aliases; `pxLines` fades lines closer than ~3 px into their mean tone, and hooks should widen their AA by `gPix`.
- (Cloud) The container can restart mid-turn and kills every background job (server and renders): render long clips in segments (`app/scripts/review-v7.sh` pattern) and restart the server first.
- GLSL `pow(x, y)` is undefined for x < 0 (SwiftShader returned |x|^y): souls' shades appeared giant while rising. Write cubes and squares as products.
- A degenerate bevel triangle in an extruded letter has a zero normal; `normalize` gives NaN, which blooms into a white star. It showed only in the mirrored scene render (the glaze reflection sees the letters' undersides). The letter and token shaders now guard normals and NaN/Inf colours; keep that in any new mesh shader.
- The unseen key light's highlight on black glaze is its mirror image, a flame-like blob: keep `spec` ≈ 0.05 in key-lit shots; glazed letter faces use a narrow dim sheen for the same reason.
- Never put `pkill -f <pattern>` in the same Bash command as the thing it should not kill: the pattern matches the command's own shell (`pkill -f "[v]ite --port 5190"; ... bunx vite --port 5190` killed itself, exit 144). Kill in one call, start the server in another.
- Typecheck before committing: `cd app && bunx tsc --noEmit -p . && bunx tsc --noEmit -p tsconfig.scripts.json` (both clean at handoff).

## Next steps, in order

0. **Current:** see "Start here". Pilot v7 = the client's v6 notes (see "Pilot v6 review"), all built: the strikes on "against us?" (94938b3, `everything.ts`/`figures.ts`), the crisp "been turned" → "against" hand-off and THREAT leaving with "across the sea" (765aa5b), hook 1 in 3D with the disobeying reflection (d437124, ae66938; n=2 placeholder on the same shore). **Not yet rendered or sent.** Next: render v7 with `app/scripts/review-v7.sh` (segments in `out/review/v7/`; the last segment ends at the hook1→mirror cut and its last frame is held to 46.6 s instead of showing the red missing-scene placeholder; light copy `out/review/pilot-v7-review.mp4`), send it, then chorus 1 (`mirror`, proposals A/B/C still open). The client's v6 notes did not comment on the v2 stills (Poseidon as a bearded god, Polyphemus' beard, the sheep, CHANGE?'s frieze) that pilot v6 contained, and they "loved the animation during the opening"; treat those as accepted unless they say otherwise. History: pilot v6 = the client's v5 choices (fd3fb6a..712da0a): the four intro silhouettes (stills `out/review/opening-stills/*.jpg`, then Poseidon as a bearded god, Polyphemus' shaggy beard, fluffier sheep, CHANGE?'s evenly spaced frieze; v2 stills sent, no objection in the v6 notes), "against us?" timing fix (align.py FIX), through-line A (`keyLight()`, no sprites, `spec` low), mirror water (`swell`, `wine`), symbolon's phrases, CHANGE? A+B, estranged A+B with Penelope; sent as `out/review/pilot-v6-review.mp4` (`app/scripts/review-v6.sh`). Iterate with the client on ideas before building anything new beyond these.
1. (History) Get the client's notes on pilot v2 and apply them. v1 notes and their fixes are in `docs/MONSTER.md` Grammar rules 7–8. After v2 the client proposed ENDLESS as a loading circle or an infinity loop: built as the ∞ (commit `923b0b0`; the spinner was judged too modern for the grave tone, its "chase" kept as the flame's comet tail). Review clip sent to the client: `out/review/pilot-v3-review.mp4` (pilot v2 with the ∞ section spliced in; regenerate with a full `video` render of 3.0–46.6 s, `--only strike,everything,endless,symbolon,change,souls,sea,hook1`). Awaiting the client's notes.
   - After v3 the client noted: the opening felt disjointed and flat, and the souls background lines hurt readability. Done: the new opening inside `everything` (c633bcf), plaster shadow-screen walls (souls 5dc4195, change 84c43f3), Grammar rule 9. Review clip: `out/review/pilot-v4-review.mp4` (full pilot from 0:00).
   - Then the client asked for a better thematic through-line than P(doom)'s lines, and chose **Greek vase painting** (Grammar rule 9; commit `cff1442`): clay walls (shadows = black-figure), black-glaze floors mirroring the room, lines only as reserved decoration. Review clip sent: `out/review/pilot-v5-review.mp4` (0:00–0:46; supersedes v4, which was stopped). Awaiting notes.
   - (Resolved in v7, d437124) hook 1's question was flat 2D type; it is now 3D, afloat near the camera on the water.
2. Finish the alignment QA (karaoke split, FIX table), regenerate `data/monster/lyrics.json`, recheck hook timings.
3. Build `mirror` (rest of chorus 1), then verse 2's four plates (`cyclops`, `circe`, `poseidon`, `horse`), then chorus 2 (`hook` n=2 + `scale`, with the very subtle orange creep), the bridge (`creed`, `losses` with the names, `course` with the dawn accent, `wall` type-only), chorus 3 (`hook` n=3 + `blackfigure`), and `outro` (loop back to the first frame of `strike`).
4. Collect bench results; give the client render-machine setup steps; final render.
5. Update `README.md` (Monster section, credits: song by Jorge Rivera-Herrans, unofficial non-commercial fan video, audio not redistributed) and keep `docs/MONSTER.md` in step with what is built.

Commit after each plate and push to `ccr-af657488-ml8n3a` (the client follows the branch). Commit messages end with the session's attribution lines; no model names in commits or code.
