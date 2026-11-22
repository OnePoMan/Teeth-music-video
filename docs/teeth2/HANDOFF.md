# Teeth v2: handoff (state only)

Read this first, then `RULES.md`. Rewritten as the last step of every session; history lives in `docs/TEETH2-LEDGER.md`. Last updated 2026-11-21.

## Current gate

**Gate 3: the lyric-led type-and-camera pass.** Gate 1 (treatment) approved 2026-11-17, gate 2 (stills) approved 2026-11-19. All 14 plates exist as block-ins, but the client rejected the first kinetic prototypes (2026-11-21), so every plate's camera and type are redone under R31-R42. Scene, exhibits and light stand for seven plates (listed in PLATES).

## Status

The 14 plates x {scene, camera, type, light} matrix is in `PLATES.md` ("Status of record"). Today: camera and type are "rework" everywhere; scene and light are "approved" for polygraph, uv, scene, luminol, chart, voice, articulator and "unknown" for the rest. `scale` round 3 (`8405c17`, clips in `out/gate3/kinetic/r3/`) has a raking key and pool, 11 graded tier-1 flashes, and word spacing held on onsets. The type probe (`de41447`) is in: the Teeth lint now sees kit words, and `scale` shows 0 errors and 100% presence (414/414). The third blind review (strips in `../blind-r3/`, key `out/merge/blind-r3-key.txt`) passes R83: it preferred `scale` on presence, legibility, camera flow and type as subject; P(doom) won on energy and finish. The client asked for the flat frames to be fixed: `scale` round 4 (`a4afd26`, clips in `out/gate3/kinetic/r4/`, brief `docs/gate3/brief-scale-r4.md`) adds a feathered pool aimed at the row starts and a strip-light streak for whites. Every checkpoint still reaches p1 0 and p99 236-245; lint shows 0 errors and 100% presence; 129 ms per frame. The camera is unchanged since r3. The fourth blind review (`../blind-r4/`, key `out/merge/blind-r4-key.txt`) preferred `scale` overall, on presence, legibility, type as subject and finish (narrowly), but **preferred P(doom) on camera flow** ("barely moves: a slow drift around the sphere"), which strictly fails R83. Reviewer 3 preferred the same camera. Both reviewers rank `scale` low on energy (one hue, one object, one slow shot).

## Next actions

1. **`scale` round 5, camera and energy** (client 2026-11-22: bigger continuous moves plus one hero macro per half-line, carving debris, motion between r4 and P(doom)). Brief `docs/gate3/brief-scale-r5.md`, checkpoint first.
2. **Clean up:** the two builder worktrees in `.claude/worktrees/` are merged. Remove each `app/node_modules` junction with `cmd //c rmdir` before `git worktree remove`, so the main copy is untouched.
3. **Lyric-led prototypes on `uv` (the reveal-by-light case) and `chart` (a light plate)**, with a key-frame checkpoint (set, light, materials, type card at 4-6 key frames) reviewed before each full-window build (R73). Fill their type cards first.
4. Write the transitions table and the energy map (R87) before fan-out.
5. Then fan out to the other plates on briefs that cite rule IDs; gate 4 items are in `BACKLOG.md`.

## Open client questions

None. The lead settled the open questions as R75-R90.

## Staffing

R91 (client-approved 2026-11-21): the lead is Opus; first builds Opus high (3D/light) or Sonnet high (graphic); a key-frame checkpoint (4-6 frames plus an 8 fps strip of one line) before every full build; Sonnet medium fix rounds only for parameter or layout lists; a Sonnet medium brief check on rule-changing or multi-plate briefs; code maps in reports; the type probe on Sonnet high. Measure Sonnet's usage cost on the next Sonnet job.

Pacing (R67): check usage first; no new agents above ~70% of the 5-hour window.

## Machine and files

Render from `app/` (R72); code in `app/src/teeth2/`; reviews and briefs in `docs/gate3/`; the pre-consolidation texts in `docs/teeth2/archive/`. After each approved gate: update this file, commit, push, open the PR, remind the client to start a new session.
