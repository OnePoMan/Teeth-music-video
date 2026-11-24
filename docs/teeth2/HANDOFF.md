# Teeth v2: handoff (state only)

Read this first, then `RULES.md` and `PROCESS.md`. Rewritten as the last step of every session; history lives in `docs/TEETH2-LEDGER.md`. Last updated 2026-11-23.

## Current gate

**Gate 3: the lyric-led type-and-camera pass.** Gate 1 (treatment) approved 2026-11-17, gate 2 (stills) approved 2026-11-19. All 14 plates exist as block-ins, but the client rejected the first kinetic prototypes (2026-11-21), so every plate's camera and type are redone under R31-R41. Scene, exhibits and light stand for seven plates (listed in PLATES).

## Status

The 14 plates x {scene, camera, type, light} matrix is in `PLATES.md` ("Status of record"). Today: camera and type are "rework" everywhere; scene and light are "approved" for polygraph, uv, scene, luminol, chart, voice, articulator and "unknown" for the rest. `scale` round 3 (`8405c17`, clips in `out/gate3/kinetic/r3/`) has a raking key and pool, 11 graded tier-1 flashes, and word spacing held on onsets. The type probe (`de41447`) is in: the Teeth lint now sees kit words, and `scale` shows 0 errors and 100% presence (414/414). The third blind review (strips in `../blind-r3/`, key `out/merge/blind-r3-key.txt`) passes R83: it preferred `scale` on presence, legibility, camera flow and type as subject; P(doom) won on energy and finish. The client asked for the flat frames to be fixed: `scale` round 4 (`a4afd26`, clips in `out/gate3/kinetic/r4/`, brief `docs/gate3/brief-scale-r4.md`) adds a feathered pool aimed at the row starts and a strip-light streak for whites. Every checkpoint still reaches p1 0 and p99 236-245; lint shows 0 errors and 100% presence; 129 ms per frame. The camera is unchanged since r3. The fourth blind review (`../blind-r4/`, key `out/merge/blind-r4-key.txt`) preferred `scale` overall, on presence, legibility, type as subject and finish (narrowly), but **preferred P(doom) on camera flow** ("barely moves: a slow drift around the sphere"), which strictly fails R83. Reviewer 3 preferred the same camera. Both reviewers rank `scale` low on energy (one hue, one object, one slow shot). **`scale` round 5** (client 2026-11-22: bigger moves plus one hero macro per half-line, carving debris, motion between r4 and P(doom); brief `docs/gate3/brief-scale-r5.md`) is `00be710` plus the limb fix `8fd2354`. Each line has its own camera family; there are macros on DIRTY, SWEET, PRETTY, DEVIL, HANDS, NEVER and GO; carving debris; line 4 in 3 rows; a per-glyph limb check (`--query sc_limb=1`, 0 hits); and the light follows the line. Lint shows 0 errors, 0 warnings and 100% presence; 150 ms per frame; clips in `out/gate3/kinetic/r5/`. The fifth blind review (`../blind-r5/`) passes R83: `scale` was preferred on presence, legibility, camera flow and type as subject, and P(doom) on energy and finish. Still open: the mid-tone ochre (the reviewer calls TALK and LATE "tan on tan"), lines shrinking at 54.6-55.1, and SWEET and GO macros capped at 1.3x by the apple's curve. Lint can't see limb crops or occlusion; the `sc_limb` scan covers `scale` only. **`uv` round 1** (brief `docs/gate3/brief-uv-r1.md`, type card filled in PLATES) is `65680b3`: two-row line blocks on the case edges, a camera family per line, hero macros 1.11-1.35x, a readable floor, the TEETH double slam, the lamp in a gloved hand, lint 0 errors and 100% presence, `?uv_occ` 0 hits, 59 ms per frame; clips in `out/gate3/kinetic/uv-r1/`. Blind review uv-1 (`../blind-uv1/`) passes R83; P(doom) still wins energy. Open: slow drift at 66.1-66.8, the TEETH slams read as flat title cards, and a murky "but your heart got". **`uv` round 2** (brief `docs/gate3/brief-uv-r2.md`): the key-frame checkpoint `acb8b18` (`out/gate3/kinetic/uv-r2/checkpoint/`) has realistic-glove work, beam pumps and sweeps on the beat, and an in-world TEETH slam; the lead and the client reviewed it on 2026-11-23 and approved the full pass with fixes (gloves, TALK, the R95 checklist), recorded at the end of the brief.

**The rules were rewritten on 2026-11-23** (brief `docs/gate3/brief-rules-rewrite.md`, from the blind review `docs/gate3/review-rules.md`): RULES is a 40-rule core; process rules are in `PROCESS.md`; plate-specific rules are on their cards; every removed ID is in RULES' "Retired IDs" table. The client's answers: PRETTY as hero stays Archivo black (R15), `uv` r2's glove becomes the kit glove (R51, R86), and a word shows at most 0.4 s before it is sung (R19).

## Next actions

The client's taste baseline (R92, now merged into RULES R2, R13, R24, R26, R35, R36, R51) applies from round 1 on every plate. Process (`PROCESS.md`): taste questions up front (R93), the client approves the 540p checkpoint before any full pass (R94), the R95 checklist, and one checkpoint plus one full pass per plate (R98).

1. **`uv` round 2 full pass** (client-approved with the checkpoint fixes; brief `docs/gate3/brief-uv-r2.md`) into `out/gate3/kinetic/uv-r2/`. It measures the R95 checklist, including the luma p99 that sets card 6's glow-token target (R13), and checks the tier-1 count on line 4 (R37).
2. **The kit glove port** (R51, R86): after `uv`'s full pass, a chore ports `uv` r2's glove into `GLSL_HAND`; re-check the gate 2 `match` stills, `chart` and `acetate`. (BACKLOG's cross-cutting glove item and `brief-uv-r2.md` still call it a gate 4 item; R51 now makes it gate 3.)
3. **The plate starter and the energy checks** (`docs/gate3/brief-plate-starter.md`, Sonnet high, after `uv` is done). A Sonnet medium brief check runs first (R91). It records P(doom)'s band in TYPE §7, which sets the chorus band (R26).
4. **Taste questions for `chart`** and the next three plates in one batch (R93), with the open client questions below. Then fill their type cards, and run `chart` on the starter.
5. Write the transitions table and the energy map (R87) before fan-out.
6. Then fan out to the other plates; gate 4 items are in `BACKLOG.md`.

## Open client questions

From the rules review (`docs/gate3/review-rules.md`); each is marked "open (client, batch with R93)" where it stands, and goes in the next batch of taste questions:

1. **`acetate`'s hero size** (review question 3): small, eerie heroes (R21, R26) or the card's large ones (card 12)?
2. **Allowed exhibits** (review question 4): are her odontogram (plate 7), the bed (plate 3) and plate 2's radiograph allowed under R47?
3. **Energy bands outside the choruses** (review question 5): how far below the chorus band do the verses, 3a and the bridge sit (and the pre-choruses and outro)? Also the camera-travel floor for those sections (R26, R35).
4. **SWEET as a half-line hero on later plates** (raised by the rewrite): R15's answer makes the hero idiom win for PRETTY and keeps *sweet* Cormorant under UV; `scale` and `uv` keep SWEET Cormorant as built, but `pour`, `articulator`, `acetate` and `match` need a call.

## Staffing

`PROCESS.md` R91 (client-approved 2026-11-21): the lead is Opus; first builds Opus high (3D/light) or Sonnet high (graphic); a key-frame checkpoint (4-6 frames plus an 8 fps strip of one line) before every full build; Sonnet medium fix rounds only for parameter or layout lists; a Sonnet medium brief check on rule-changing or multi-plate briefs; code maps in reports; measure Sonnet's usage cost on the next Sonnet job.

Pacing (`PROCESS.md` R67): check usage first; no new agents above ~70% of the 5-hour window.

## Machine and files

Render from `app/` (`PROCESS.md` R72); code in `app/src/teeth2/`; reviews and briefs in `docs/gate3/`; the pre-consolidation texts in `docs/teeth2/archive/`. After each approved gate: update this file, commit, push, open the PR, remind the client to start a new session.
