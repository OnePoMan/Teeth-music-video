# Teeth v2: handoff (state only)

Read this first, then `RULES.md`. Rewritten as the last step of every session; history lives in `docs/TEETH2-LEDGER.md`. Last updated 2026-11-21.

## Current gate

**Gate 3: the lyric-led type-and-camera pass.** Gate 1 (treatment) approved 2026-11-17, gate 2 (stills) approved 2026-11-19. All 14 plates exist as block-ins, but the client rejected the first kinetic prototypes (2026-11-21), so every plate's camera and type are redone under R31-R42. Scene, exhibits and light stand for seven plates (listed in PLATES).

## Status

The 14 plates x {scene, camera, type, light} matrix is in `PLATES.md` ("Status of record"). Today: camera and type are "rework" everywhere; scene and light are "approved" for polygraph, uv, scene, luminol, chart, voice, articulator and "unknown" for the rest. `scale` has a lyric-led prototype (r2b), blind-reviewed "within reach, not below", not yet client-approved.

## Next actions

1. **Frame-checker probe for Teeth type:** instrument `app/src/teeth2/kinetic.ts` to record each word's on-screen box (projected through the camera for surface type), and teach `lint.ts` presence of the current line, supporting cap height, hero scale, title-safe, nothing more than 0.4 s early, no mid-word crop.
2. **`scale` lighting and flash fix:** flashes graded (R38), light building into TEETH, the slam held, line 4's cut on a downbeat; it is the prototype for the rest.
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
