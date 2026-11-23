# Teeth v2: handoff (state only)

Read this first, then `RULES.md`. Rewritten as the last step of every session; history lives in `docs/TEETH2-LEDGER.md`. Last updated 2026-11-23.

## Current gate

**Gate 3: the lyric-led type-and-camera pass.** Gate 1 (treatment) approved 2026-11-17, gate 2 (stills) approved 2026-11-19. All 14 plates exist as block-ins, but the client rejected the first kinetic prototypes (2026-11-21), so every plate's camera and type are redone under R31-R42. Scene, exhibits and light stand for seven plates (listed in PLATES).

## Status

The 14 plates x {scene, camera, type, light} matrix is in `PLATES.md` ("Status of record"). Today: camera and type are "rework" everywhere; scene and light are "approved" for polygraph, uv, scene, luminol, chart, voice, articulator and "unknown" for the rest. `scale` round 3 (`8405c17`, clips in `out/gate3/kinetic/r3/`) has a raking key and pool, 11 graded tier-1 flashes, and word spacing held on onsets. The type probe (`de41447`) is in: the Teeth lint now sees kit words, and `scale` shows 0 errors and 100% presence (414/414). The third blind review (strips in `../blind-r3/`, key `out/merge/blind-r3-key.txt`) passes R83: it preferred `scale` on presence, legibility, camera flow and type as subject; P(doom) won on energy and finish. The client asked for the flat frames to be fixed: `scale` round 4 (`a4afd26`, clips in `out/gate3/kinetic/r4/`, brief `docs/gate3/brief-scale-r4.md`) adds a feathered pool aimed at the row starts and a strip-light streak for whites. Every checkpoint still reaches p1 0 and p99 236-245; lint shows 0 errors and 100% presence; 129 ms per frame. The camera is unchanged since r3. The fourth blind review (`../blind-r4/`, key `out/merge/blind-r4-key.txt`) preferred `scale` overall, on presence, legibility, type as subject and finish (narrowly), but **preferred P(doom) on camera flow** ("barely moves: a slow drift around the sphere"), which strictly fails R83. Reviewer 3 preferred the same camera. Both reviewers rank `scale` low on energy (one hue, one object, one slow shot). **`scale` round 5** (client 2026-11-22: bigger moves plus one hero macro per half-line, carving debris, motion between r4 and P(doom); brief `docs/gate3/brief-scale-r5.md`) is `00be710` plus the limb fix `8fd2354`. Each line has its own camera family; there are macros on DIRTY, SWEET, PRETTY, DEVIL, HANDS, NEVER and GO; carving debris; line 4 in 3 rows; a per-glyph limb check (`--query sc_limb=1`, 0 hits); and the light follows the line. Lint shows 0 errors, 0 warnings and 100% presence; 150 ms per frame; clips in `out/gate3/kinetic/r5/`. The fifth blind review (`../blind-r5/`) passes R83: `scale` was preferred on presence, legibility, camera flow and type as subject, and P(doom) on energy and finish. Still open: the mid-tone ochre (the reviewer calls TALK and LATE "tan on tan"), lines shrinking at 54.6-55.1, and SWEET and GO macros capped at 1.3x by the apple's curve. Lint can't see limb crops or occlusion; the `sc_limb` scan covers `scale` only. **`uv` round 1** (brief `docs/gate3/brief-uv-r1.md`, type card filled in PLATES) is `65680b3`: two-row line blocks on the case edges, a camera family per line, hero macros 1.11-1.35x, a readable floor, the TEETH double slam, the lamp in a gloved hand, lint 0 errors and 100% presence, `?uv_occ` 0 hits, 59 ms per frame; clips in `out/gate3/kinetic/uv-r1/`. Blind review uv-1 (`../blind-uv1/`) passes R83; P(doom) still wins energy. Open: slow drift at 66.1-66.8, the TEETH slams read as flat title cards, and a murky "but your heart got".

## Next actions

1. **The client reviews `uv` r1** (`out/gate3/kinetic/uv-r1/*-share.mp4`). `scale` r5 is held as the reference (client, 2026-11-22).
2. **The lyric-led prototype on `chart` (a light plate)**, with a key-frame checkpoint (set, light, materials, type card at 4-6 key frames) reviewed before each full-window build (R73). Fill their type cards first.
3. Write the transitions table and the energy map (R87) before fan-out.
4. Then fan out to the other plates on briefs that cite rule IDs; gate 4 items are in `BACKLOG.md`.

## Open client questions

None. The lead settled the open questions as R75-R90.

## Staffing

R91 (client-approved 2026-11-21): the lead is Opus; first builds Opus high (3D/light) or Sonnet high (graphic); a key-frame checkpoint (4-6 frames plus an 8 fps strip of one line) before every full build; Sonnet medium fix rounds only for parameter or layout lists; a Sonnet medium brief check on rule-changing or multi-plate briefs; code maps in reports; the type probe on Sonnet high. Measure Sonnet's usage cost on the next Sonnet job.

Pacing (R67): check usage first; no new agents above ~70% of the 5-hour window.

## Machine and files

Render from `app/` (R72); code in `app/src/teeth2/`; reviews and briefs in `docs/gate3/`; the pre-consolidation texts in `docs/teeth2/archive/`. After each approved gate: update this file, commit, push, open the PR, remind the client to start a new session.
