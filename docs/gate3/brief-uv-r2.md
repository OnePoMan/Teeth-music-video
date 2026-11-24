# `uv` round 2: gloves, beam energy, an in-world TEETH (builder brief, Opus 5.5 high)

Round 1 (`65680b3`, clips `out/gate3/kinetic/uv-r1/`, brief `brief-uv-r1.md`) passed lint (0 errors, 100% presence), `?uv_occ` (0 hits) and blind review uv-1 (R83). P(doom) still won energy. The client asked for more (2026-11-23) and agreed with all the open items; the gloves and the energy matter most.

**The client's calls (2026-11-23):**
- **Energy:** beam action on the beat. The lamp is the plate's instrument, so it works harder.
- **TEETH:** an in-world slam. The word fills the frame as glowing trace on the cloth itself, not a flat title card. This overrides R24's "flat palette fills, no halation" for `uv`'s TEETH only. Glow still obeys R11: bloom only above 1.0, and letter edges stay crisp.

**Rules:** R11, R13, R21-R23, R29, R31, R34-R40, R57, R79-R82, R71, R72. Read the `uv` card and its type card in `docs/teeth2/PLATES.md`.

**Do:**
1. **The gloves read as real black nitrile, not cartoon hands.** Today they are fat, rounded, mitten-like fingers with one smooth even sheen (see `out/gate3/kinetic/uv-r1/checkpoint2/f_0075.97.png`).
   - Use real hand proportions: slimmer fingers, tapering, of unequal lengths, with visible knuckle joints and a thumb that wraps the handle.
   - Add surface detail: fine creases at the knuckles and the palm, stretch where the grip pulls the material taut, a rolled cuff with thickness at the wrist, and a sleeve beyond it.
   - Material: thin semi-gloss nitrile. The UV tube gives a tight specular, the sheen breaks over the creases, and the fingertips catch the beam's spill.
   - Apply all of this to both the lamp hand and the swab hand. `uv` keeps its own glove copy in `uv-glsl.ts`; don't edit `match-glsl.ts`. The shared kit glove is ported from this one after the full pass (R51); it was a gate 4 item in BACKLOG.
2. **Beam action on the beat (R37, R38, R79).**
   - The pool snaps from word to word, landing on each onset with a small overshoot and settle, instead of gliding.
   - **Downbeats:** a quick sweep across the line so far, and the words it crosses flare from floor to full and back.
   - **Kicks:** the lamp pumps toward the cloth; the pool tightens and brightens, then eases back.
   - **Hero onsets (tier 1):** the hardest pump and a flare that peaks at the uv token.
   - **Line 4:** the three NEVER sweeps get faster, as they do now, plus a pump on each.
   - Grade it, with the hero the strongest and the hits building over line 2 into TEETH. Use a different pattern from `scale`'s flashes.
   - The words stay readable through every hit (the floor holds), and the uv token stays under 30% of any frame (R57).
   - The camera rides the line, not the beam, so the beam's energy never becomes camera whiplash (R35).
3. **An in-world TEETH (TYPE §8 item 2, amended).**
   - On TEETH's onset (68.47), the camera slams into a macro of the weave, and TEETH is a full-frame glowing trace on the cloth, with fibre texture and fold shading in the glow.
   - On 68.80, a condensed copy flares over it, as a second trace or a re-excitation, so it doesn't read as a translucent ghost.
   - The beam's sweep is the break line, a straight wipe edge of light across the word.
   - Hold until 69.44, then cut onto LATE, already readable.
   - No flat title-card frames and no ghost, which the reviewer saw at 68.84.
4. **The open items from blind review uv-1:**
   - Remove the slow drift at 66.1-66.8 (TALK, "Talk so"): give it a purposeful move and the beam action above.
   - "but your heart got" (68.06-68.45) must read clearly: a stronger floor or a beam pass on it.
5. **Keep:**
   - lint 0 errors and 100% presence, and the probe projecting with the camera actually used;
   - `?uv_occ` 0 hits;
   - the floor at ≥40 luma steps;
   - the pillowcase edges and the tag;
   - the lamp in view;
   - the supporting caps at ≥5%, and the macros (see the rules check below);
   - GO's decay, the swab action, and speed ≤200 ms per frame.

**Code map** (from the r1 report; `app/src/teeth2/scenes/`):
- `uv.ts`:
  - `PLANS` (per-line az/el/roll/lens, box, lamp anchor), `fit`, `buildPath`, `levelRoll`;
  - `MACROS`, `solveMacro`, `macroCam`, `camAt`;
  - `hits` (tiers 1-2), `wordState` (moves);
  - `rig` (the lamp beyond the block, the swab);
  - `renderSlam` (the slams and the wipe), and the probe feed in `render`;
  - the tunables `FLOOR`, `RIDE`, `BOX`, `LAMP_MARGIN`, `LEVEL`;
  - the logs `?uv_log`, `?uv_occ`, `?uv_box`.
- `uv-type.ts`: `BLOCKS`, `RowSpec.cap`, `CAP`, `TAG`.
- `uv-glsl.ts`:
  - the glove at about 271-330 (the lamp glove's fingers at about 16, the swab hand at 311);
  - `gloveCol` at about 444;
  - `ambK`, `lS`, `W2`/`WL`, and the floor term.
- Additions only in `kinetic.ts`; never edit `app/src/engine/`.

**Key-frame checkpoint first (R91).**
- Stills:
  - 63.45 DIRTY;
  - 66.40, mid-TALK (the old drift);
  - 66.90 PRETTY;
  - 68.25 "but your heart got";
  - 68.50 and 68.85, the two slams;
  - 71.22 HANDS (the swab glove);
  - 73.00 NEVER;
  - 75.97 GO, the lamp glove close.
- Also a beam-hit pair: one downbeat at the frame before and the frame of its sweep peak.
- A 540p30 clip of the whole window with audio, an 8 fps strip of 65.9-70.4 (`--n 36 --cols 9`), and lint.
- Write everything to `out/gate3/kinetic/uv-r2/checkpoint/`, then **stop and report** (≤120 words: the beam-hit list by tier, the glove changes, the slam, lint, occlusion, the floor, ms per frame, and the paths).

**Full pass, after the lead's go:**
- clips 62.54-69.5 and 69.0-76.35 at 1080p30 with audio, plus `-share.mp4` copies (crf 24);
- the 8 fps strip 66.0-70.0 (`--n 32 --cols 8`);
- the dense sheet 62.6-76.3 (`--n 30 --cols 6`);
- lint to `out/lint/uv-r2/`;

all to `out/gate3/kinetic/uv-r2/`.

**Setup:** `source out/env.sh`, then render from `app/` with `--only uv` (R72). You work in the main checkout on `teeth-v2`. Run `git log -1` first; it should be the commit of this brief or later. You are the only builder. Python is not installed; use `bun -e`. Iterate on single stills.

**Files:** `uv*.ts`, plus additions only in `kinetic.ts`. Don't commit. If the 5-hour window passes ~70%, stop and report.

**Report** in ≤150 words, plus a code map of the deltas and the files changed (R91).

**Checkpoint review (lead, then client, 2026-11-23; checkpoint `acb8b18`, `out/gate3/kinetic/uv-r2/checkpoint/`).** The client approved the full pass with these fixes folded in. Keep the beam pumps and sweeps, the in-world slam with no ghost, the "but your heart got" lift, and every check that passes.
1. **Gloves.** They are better but still read as a lumpy rubber hand.
   - Flatten the knuckle bulges to the slight ridges of a taut nitrile glove over real joints.
   - Replace the ribbed, bellows-like cuff with one smooth rolled bead at the wrist, the sleeve fabric beyond it.
   - Check the close still at 75.97 and the swab hand at 71.22.
2. **TALK (66.3-66.8).** "Talk so" sits small in a dim frame until PRETTY. Give the stretch a beam pass over "Talk so" on its downbeat, and frame it at least at its line size, with the move carrying on into PRETTY's macro. No near-hold.
3. **The checklist (R95), measured on the full pass:**
   - the luma p1, p50 and p99 per key still;
   - the floor at ≥40 luma steps (re-measured);
   - the exhibit and lamp visible, as % of frames per line;
   - per-line camera travel and the macro ratios;
   - the smallest supporting cap per line;
   - lint, presence, `uv_occ`, the hits by tier, and ms per frame.

Then run the full pass as listed above, into `out/gate3/kinetic/uv-r2/`.

**Rules check (lead, 2026-11-23, after the RULES rewrite).** RULES now has 40 rules (process in `PROCESS.md`; `uv`'s own rules on card 6). Three items change this full pass; the rest of the brief stands.
1. **At most three tier-1 hits per chorus line (R37).** Lines 1-3 fit already: the opener and the two heroes. Line 4 has five today: the opener at 72.90, three NEVERs and GO.
   - Keep tier 1 on the first NEVER (it is also the cut and the opener), the third "never" (74.08) and GO.
   - The second NEVER's sweep and pump drop to tier 2 (a light change and a ≤5 px nudge).
   - The three sweeps still get faster.
2. **Macros are ≥1.2x the line framing (R36),** or ≥1.1x where the surface forbids it, with the reason reported. Round 1 built SWEET at 1.11x and DEVIL and HANDS at 1.16x. Bring them to ≥1.2x, or report why the cloth and title-safe don't allow it.
3. **`uv`'s p99 target (R13)** is set on card 6 from measurement. Report the luma p1, p50 and p99 per key still, and the p99 of the fluor-white words under the beam. The lead will set the target from those numbers.
