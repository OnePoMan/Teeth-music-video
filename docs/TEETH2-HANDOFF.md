# Teeth v2 — handoff

Read this first in every new session ("Continue Teeth v2 from the handoff"), then `docs/TEETH2.md` (the treatment) and `docs/TEETH2-LEDGER.md` (settled decisions and defects).

## Where we are

- **Gate 1 (treatment and plate list): approved by the client 2026-11-17.** `docs/TEETH2.md` draft 4 (two gauntlet rounds on paper, then the client's taste-call answers). PR #9 holds it; the client merges.
- **Gate 2 (the stills): in review by the client.** The set is in `docs/gate2/` (JPGs; `0-contact-sheet.jpg` first), rendered from the committed scenes after four gauntlet rounds (see the ledger). No plate is built past its still until the client approves. Open items the client was told about: the apple's bite rim and #8 notch read only up close in the wide; the turned-out cast's front teeth still show slight gaps; the chip at the lock is small at full frame; every plate runs 35–200 ms per frame (over the 25 ms target: a render-time cost, not a look problem). Client calls pending: lyric colour treatment A/B/C, cold vs warm lamp, the B&W apple (a lead ruling), how literal the bitten letters are, the signature mark.
- **Next after approval: gate 3, every plate built and shown as a contact sheet.** Code is in `app/src/teeth2/` (kit: `palette.ts`, `teeth.ts`, `monogram.ts`; plates: `scenes/<id>.ts`; boards: `?board=typesheet`, `?board=kittest`). The builder brief is `docs/TEETH2-BUILDERS.md`.
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
