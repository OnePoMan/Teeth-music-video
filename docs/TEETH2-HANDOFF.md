# Teeth v2 — handoff

Read this first in every new session ("Continue Teeth v2 from the handoff"), then `docs/TEETH2.md` (the treatment) and `docs/TEETH2-LEDGER.md` (settled decisions and defects).

## Where we are

- **Gate 1 (treatment and plate list): approved by the client 2026-11-17.** `docs/TEETH2.md` draft 4 (two gauntlet rounds on paper, then the client's taste-call answers). PR #9 holds it; the client merges.
- **Gate 2 (the stills): approved by the client 2026-11-19.** Next, start here: **gate 3** on the economy plan below. The set is in `docs/gate2/` (JPGs; `0-contact-sheet.jpg` first), rendered from the committed scenes after four gauntlet rounds and a fifth pass on the apple (now golden, per the client's calls, recorded at the end of the treatment). Known items carried into gate 3: the apple macros read a little smooth up close, and #8's notch in the bite reads only at zoom; the turned-out cast's front teeth show slight gaps; the chip at the lock is small at full frame; every plate runs 35–200 ms per frame (a render-time cost, not a look problem).
- **Gate 3 progress (lead session started 2026-11-19).** The gate 3 standard is in `docs/TEETH2-BUILDERS.md`; reviews in `docs/gate3/`; rulings in the ledger's "Gate 3" section. Never resume a finished builder; start a fresh one per round.
  - **Batch 1 (`polygraph`, `uv`): done for gate 3** (two reviews, three builder passes; `docs/gate3/review1.md`, `review2.md`). Final sheets: `out/gate3/polygraph-f2/sheet.png`, `out/gate3/uv-f2/sheet.png`. Gate 4 polish list: polygraph pens read as map pins, the tear needs fibre edges and a film2 gap, the top of wide frames still a little empty; uv gloves still a little cartoonish, the swab sleeve a dark mass at 71.00–71.45, supporting words alone in the dark at ≥5% cap height with the lamp in frame, the beam over the hem or open end in two more setups.
  - **Batch 2 (`scene`, `luminol`):** `scene` **done for gate 3** (final sheet `out/gate3/scene-f2/sheet.png`; gate 4: cloth, pillow softness, chunky tent back panels). `luminol` still needs its **last small fix round** (three items in `docs/gate3/review3.md`: ambient down to film2, the stain as a soak not a cloud, the folded collar as a V), Opus, into `out/gate3/luminol-f2/`.
  - **Batch 3 (`chart`, `voice`, `articulator`): fix round 1 done and committed** (sheets `out/gate3/chart-f1/`, `voice-f1/`, `articulator-f1/sheet.png`). Their second (last) review goes with the next batch's first. Lead notes for it: chart now has black amalgam, a dark light-table surround, his corner with #8 and a T.F. push-in; the glove's knuckle lumps come from the shared `sdGlove` in `match-glsl.ts` (a kit fix for gate 4, since it changes the approved match stills). voice has the 45° splice band, oblique monitor shots, the transcript lane and the glove laying the strip; the strip reads faintly, the foreground block smears at 100.90–102.00, ALIVE briefly reads "ALIve" mid-swell (letter range narrowed after the sheet, not re-rendered). articulator now has a white sweep, a narrow chrome bar with a travelling highlight band, closures from ≥46° above, the hinge in frame, LET GO on a static lower bar, 13 framings, 110 ms/frame; but the machine reads as a square cage more than a dental articulator, and the words are small in the wides.
  - **For the client at the gate:** the voice spectrogram is a real STFT of the full mix, since no vocal stem exists on disk (accept, or separate a stem before gate 4?); *sweet* in plate 6 in fluor-white; THROUGH MY EYES readable from beneath in plate 4; DEAD in plate 3 reads as a neutral marker.
  - **Cost:** a build pair ~45 points of a 5-hour window, a fix pair ~28, a review ~7; a plate in full ~5–6 weekly points. Week at 94% on 2026-11-20 08:10 UTC (the client will apply a banked reset at the limit; start no builder that could be cut off by it); the client has banked resets, so the weekly limit is not a reason to pause (the 5-hour rule still holds).
  - **Still to build:** `filed` (Opus) and `acetate` (Sonnet); then the five gate 2 plates extended to their full windows (`drawer`, `lightbox`, `scale`, `pour`, `match`, Opus). Then the gate 3 contact sheet of every plate and a cut-level look before the client.
- **Gate 3: every plate built and shown as a contact sheet.** Code is in `app/src/teeth2/` (kit: `palette.ts`, `teeth.ts`, `monogram.ts`; plates: `scenes/<id>.ts`; boards: `?board=typesheet`, `?board=kittest`). The builder brief is `docs/TEETH2-BUILDERS.md`.
- Render on this machine: `source <scratchpad>/env.sh` (or put the WinGet bun and ffmpeg folders on PATH), then `cd app && bun scripts/render.ts stills --song teeth --t <t> --only <id> --url http://localhost:5193 --out <absolute fresh folder>`.
- Later gates: 3 contact sheet of every plate, 4 1080p rough cut, 5 4K60 final (rendered overnight in segments).
- **After the client approves a gate:** update this file, commit, push, open the gate's PR (`teeth-v2` → `main`; the client merges), and remind the client to start a new session.

## Client decisions (binding)

- Concept "Dental Records": the examiner is the narrator; the bite is his; the video loops.
- Tone: visually exciting at P(doom)'s level; deadpan only in small lab text; no gore, horror or faces.
- Palette 2A Lightbox / UV (see the treatment); red only from the match.
- Three choruses = three methods: bite-mark photography, the stone cast, the superimposition match.
- No title card or credits on screen (credits go in the README). No YouTube upload; nothing published without asking.
- v1 complaints that are now rules: no repeated visuals, every image makes sense, no HUD or counters, constant motion.
- Stills (gate 2) must include the fonts and lyric colour choices.

## Team and models

**Economy plan from gate 3 on (client-approved 2026-11-19).** Gate 2 used about half a week of the Pro limit; these rules bring gate 3 to roughly one to one and a half weeks:

1. **A fresh builder per plate** with a short brief (`docs/TEETH2-BUILDERS.md` + the plate's paragraph + the relevant ledger rulings). Never resume a builder whose history is past ~300k tokens; start a new one.
2. **Models by plate type**: Sonnet 5.5 (high) builds the graphic plates (`polygraph`, `chart`, `voice`, `acetate`, `scene`); Opus 5.5 (high) builds the 3D/lighting plates (`uv`, `articulator`, `luminol`, `filed`) and extends the five gate 2 plates (`drawer`, `lightbox`, `scale`, `pour`, `match`) past their stills.
3. **At most two review rounds per plate**: the lead checks the frames between rounds; one fresh Opus reviewer per batch, judging a contact sheet (not every still).
4. **Gate 3 at block-in quality**: full motion and timing for every plate, judged on contact sheets plus a few short low-res clips of the hard moments; final polish waits for gate 4, on what reads in motion.
5. **Two builders at a time** (fewer 5-hour stalls).
6. **A new lead session per gate**, and the gate spread over about two weekly resets. Check usage after the first batch and adjust.

| role | model / effort |
|---|---|
| orchestrator (lead session, new per gate) | Opus 5.5, high |
| builders, 3D/lighting plates and the gate 2 plates (≤2 at once, fresh per plate) | Opus 5.5, high |
| builders, graphic plates (fresh per plate) | Sonnet 5.5, high |
| batch reviewer (fresh, a contact sheet per batch) | Opus 5.5, high |
| cut-level reviewer (gate 4) | Opus 5.5, xhigh |
| chores (encodes, sheets) | Sonnet 5.5, low |

The client has no Fable access; don't assign it. The lead owns the render queue (one GPU: AMD RX 9070 XT). Report usage at each gate.

**Usage (client is on the Pro plan):** gate 2 (six stills, three review rounds, three fix rounds, three builders at a time) took about half of a week's limit and hit the 5-hour limit several times. Agents stopped by a limit resume with SendMessage, not a new spawn. Gate 3 (14 full plates) will not fit at this rate; the client chooses how to economise (see the gate 2 report).

## Machine setup (Windows, done 2026-11-17)

- ffmpeg 9.0.2, uv 0.13.8, bun 1.4.4 via winget. They may not be on PATH in Git Bash: the binaries are under `%LOCALAPPDATA%\Microsoft\WinGet\Links` and `...\WinGet\Packages\`. Open a fresh terminal.
- Run uv from PowerShell, not Git Bash (Git Bash breaks uv's Python install with Unix-style symlinks).
- The song: `audio/teeth.mp3` (gitignored; the client's copy is `../5 Seconds of Summer - Teeth (Lyrics).mp3`). It sits within ~5 ms of `data/teeth/*.json`, with no drift; the data is used unchanged.
- The repo clone is `Claude Projects/Teeth/repo`, branch `teeth-v2` off `main`. v1 Teeth lives on `origin/ccr-1136d28b-26bx1n` (code) and `origin/video-1080p60` (render); only its timing data and `analysis/teeth/` were brought over.
