# Teeth v2: process

How the work is run: documents, gates, staffing, builds, deliverables and reviews. The look of the video is in `RULES.md`. Each process rule keeps its R-number, so citations resolve. On process questions this file ranks with RULES (see RULES "Precedence"). When a rule here changes, its text is replaced and the ledger records why (R63).

## Documents and rulings

| ID | Rule |
|---|---|
| R63 | **Supersession.** When a rule changes, replace its text in RULES or here; the ledger records why in one line. Dead text is deleted, never struck through: a later call that supersedes an earlier one leaves only the current rule. A removed ID stays in RULES' "Retired IDs" table, so every citation leads somewhere. |
| R64 | **Settled rulings stay settled unless a later client call conflicts.** A reviewer who finds a conflict reports it to the lead and enforces neither. Taste calls go to the client, not to builders. |
| R7 | **Publishing.** No YouTube upload; nothing is published without asking the client. (Credits go in the README, R49.) |

## Gates and pacing

| ID | Rule |
|---|---|
| R65 | **Gate flow.** Gate 1 treatment (approved 2026-11-17), gate 2 stills (2026-11-19), gate 3 a contact sheet of every plate, gate 4 a 1080p rough cut, gate 5 the 4K60 final. After the client approves a gate: update `HANDOFF.md`, commit, push, open the gate's PR (`teeth-v2` to `main`; the client merges), and remind the client to start a new session. |
| R67 | **Pace the work.** Check usage before heavy or parallel work and between rounds. Above ~70% of the 5-hour window, start no new agents; checkpoint (commit, or write state to a file) and say how long until the reset. At most two parallel agents. A big task that will not fit is split across windows. The weekly limit is not a reason to pause; the 5-hour rule still holds. |
| R98 | **The round target:** one checkpoint (with its fixes) plus one full pass per plate. A third round needs the client's call, and the ledger records why the second wasn't enough. |

## Staffing

| ID | Rule |
|---|---|
| R91 | **Staffing** (client-approved 2026-11-19 and 2026-11-21; absorbs R68). The lead is Opus 5.5. **First builds:** Opus 5.5 high for 3D and lighting plates (`uv`, `articulator`, `luminol`, `filed`) and the five gate 2 plates (`drawer`, `lightbox`, `scale`, `pour`, `match`); Sonnet 5.5 high for graphic plates (`polygraph`, `chart`, `voice`, `acetate`, `scene`). **Fix rounds:** Sonnet medium only when every item is a parameter or layout edit; anything about look, light, material or re-staging stays on the plate's model at high. **Reviewers:** the batch reviewer is Opus high; the cut-level reviewer is Opus xhigh at gate 4. **Chores:** Sonnet low unless the brief names another model. No Fable. **Brief check:** a Sonnet medium reader checks any brief that changes rules or covers several plates (numbers that can't all hold, conflicts with RULES or a client call) before the build; one-plate fix lists skip it. Measure Sonnet's usage cost against Opus on the next Sonnet job before relying on the savings. |
| R68 | Absorbed into R91. |
| R66 | **A fresh builder per plate and per round**, with a short brief. Never resume a finished builder, or one whose history is past ~300k tokens. An agent stopped by a limit resumes with SendMessage, not a new spawn. |

## Building a plate

| ID | Rule |
|---|---|
| R73 | **Prove cross-cutting changes on prototypes before fan-out**, including the hardest case (a reveal-by-light plate, a light plate). |
| R93 | **Taste questions up front.** When the lead fills a type card, it asks the client the plate's taste questions in one batch, three or four plates at a time: what carries the energy, how the hero and TEETH (or the plate's slam) behave, and anything about the exhibit, hands or light. Items RULES marks "open (client, batch with R93)" go into the next batch. The answers go into the type card before the brief is written. |
| R74 | **Briefs and reports.** A brief cites rule IDs and carries only the plate's deltas, never restated rules. A builder's report (about 150 words) gives the files written, still paths, what is final and what is stubbed, ms per frame, honest weaknesses and any engine or palette change needed, plus a 10-15 line code map (files, key functions, timing tables, tunables) outside the word limit. |
| R70 | **Gate 3 standard.** Build the whole plate window (`PLATES` in `timeline.ts`): every lyric line, every beat of the plate card, something happening every bar, and the client's taste baseline from round 1 (RULES R2, R13, R24, R26, R35, R36, R51). Timing comes from `data/teeth/lyrics.json` and `audio.json`, never hard-coded; check every scripted time against the data. Nothing broken, placeholder-looking, flat or clip-art. Run the frame checker on the window (`bun scripts/render.ts lint --song teeth --only <id> --from A --to B --url http://localhost:5193`) and fix every error. Budget about 15 renders. Deliver the list below. |
| R72 | **Environment and files.** Windows, Git Bash: `source out/env.sh` puts bun and ffmpeg on PATH. Render from `app/` with `--url http://localhost:5193` (a dead port, so render.ts starts its own server) and `--out` an absolute fresh folder; typecheck with `bun x tsc --noEmit -p tsconfig.json`. One GPU is shared by up to two builders: stills and short low-res clips only. A builder edits only its plate's files (`app/src/teeth2/scenes/<id>*.ts`); `timeline.ts`, `song.ts`, `palette.ts`, `teeth.ts`, `monogram.ts` and `match-glsl.ts` are read-only except to a kit chore the lead assigns (R86); `kinetic.ts` takes additions only; `app/src/engine/` is never edited (say so in the report). Do not commit, push or switch branches; the lead commits. |
| R94 | **The client approves the checkpoint.** The lead (or an Opus medium reviewer) reviews the key-frame checkpoint first and fixes what is obvious. Then the client gets the checkpoint deliverables and the lead's R95 checklist. The 1080p full pass runs only after the client's OK. |

### Deliverables (R70, R91, R94)

**Checkpoint**, before every full build:
- 4-6 key frames showing the set, light, materials and type card (the brief names the times);
- an 8 fps strip of one full line;
- a 540p30 clip of the whole window, with audio;
- lint on the window, and the R95 checklist.

**Full pass**, after the client's OK:
- the whole window at 1080p30 with audio, in the clips the brief names;
- a contact sheet: one frame per bar, each money moment, the approved still times;
- the 8 fps strip and dense sheet the brief names;
- lint to `out/lint/<id>/`, the R95 checklist re-measured, and ms per frame;
- the report (R74).

### R95: the checkpoint checklist

Measured by the builder at the checkpoint and again on the full pass, and checked by the lead. A failed item is fixed before the client sees it, or named in the report.

| Item | Pass mark |
|---|---|
| luma p1, p50 and p99 per key still | p1 ≤16; p99 per R13 (≥235, or the card's target) |
| the exhibit and instrument visible, as % of frames per line | both read in every line (R2) |
| per-line camera travel | R35 (chorus: ≥20° orbit or ≥500 px, else the lead's OK) |
| macro ratios | ≥1.2x, or ≥1.1x where the surface forbids, reported (R36) |
| the smallest supporting cap per line | ≥5% of frame height (R21) |
| lint and presence | 0 errors; presence ≥95% (R31) |
| the occlusion and edge-crop scans | no mid-word crop; no word covered for more than 2 frames (R29) |
| the hit list by tier | within R37's ceilings |
| ms per frame | ≤200 at 1080p (R85) |
| a close still of every hand | reads as R51's glove (eye) |

## Reviews

| ID | Rule |
|---|---|
| R69 | **Review policy.** At most two review rounds per plate at gate 3: the checkpoint and the full pass (R98). The lead checks frames between rounds; one fresh Opus reviewer per batch judges a contact sheet, not every still. A reviewer reads the ledger first and does not re-raise settled items. The cut-level reviewer works at gate 4. |
| R42 | **Blind review.** Before the client sees a lyric-led prototype, a fresh reviewer judges it blind against P(doom) at matched energy, from unlabelled 8 fps strips in random order. |
| R83 | **Blind review pass:** lyric presence ≥95% of sung frames (from the probe), and the reviewer does not prefer P(doom) on presence, legibility or camera flow; energy and finish are reported, not gated. It covers the next plate types (`scale`, `uv`, `chart`); after that, the probe plus a lead spot-check replace it. |
| R84 | **Cut-level look at gate 3:** the lead presents gate 3 with a 2 fps strip of the whole song, and the last batch reviewer judges it for rhythm and repeats. The full cut-level reviewer works at gate 4. |

## Kit and tools

| ID | Rule |
|---|---|
| R86 | **Kit defects** found in a review are fixed by a chore the lead assigns, before the next batch; plates pick the fix up by re-rendering. First chore: after `uv`'s full pass, port `uv` r2's glove into `GLSL_HAND` (R51), which also retires the kit glove's knuckle lumps; re-check it against the gate 2 `match` stills and in `chart` and `acetate`. |
| R87 | **Before fan-out the lead writes** a transitions table (13 boundaries plus the loop: device, owner (the outgoing plate owns the device, the incoming plate the landing), a ±0.5 s test render) and a section energy and light/dark map, both in `PLATES.md`. The fixed hand-overs (R62) are already listed there. |
| R89 | **Lint's known false hits:** mismatches on repeated words ("never"); single-letter BLINK or EARLY from glyph-by-glyph drawing; MISSING for a word painted outside the kit (it should go through the kit, R25). Any other warning is real. Lint does not see limb crops or occlusion: the plate's scans do (R29, R95). |
