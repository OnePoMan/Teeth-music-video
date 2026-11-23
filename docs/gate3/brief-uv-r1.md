# `uv` round 1: the lyric-led pass (builder brief, Opus 5.5 high)

`uv` (62.54-76.35, chorus 1 second half) has approved scene and light: the pillowcase, the beam pool, the swab, and GO's decay (`af3d2d7`). Its camera and type predate the lyric-led rules. Today it uses five setups cut on downbeats, traces that sink to black after the beam passes, and no reports to the type probe. This round rebuilds the camera and type to the `uv` type card in `docs/teeth2/PLATES.md`, filled 2026-11-22. `scale` r5 (`8fd2354`) is the reference: read its `PLANS`, `MACROS`, `solveMacro`, `limb` and `kinProbe` before you start.

**Rules:** R13, R21-R23, R28-R31, R34-R41, R57, R79-R82, R71, R72. Read the `uv` card (story beats, exhibit and type card) and TYPE.md §7 and §8 item 2.

**Do:**
1. **The layout (`uv-type.ts`).** Each line is a two-row block, one half-line per row, each row ending on its hero. Size every block so the whole line fits in title-safe at that line's framing.
   - Hero: cap ≥20% of frame height on its onset (R21).
   - Supporting words: cap ≥5% (R22), and the line's first word ≥8% on its first frame.
   - Place the four blocks on different parts of the case (the hem, the open end, the side seam, the middle), so the hem or open end is readable in at least two lines.
2. **The readable floor (R23).** Every sung word of the current line stays readable outside the beam, as a dried stain at least 40 luma steps off the cloth around it. The beam lifts it to full glow, and the glow sinks back to the floor, never to black.
   - Measure the floor at 3 frames with no beam on the word, and report the values.
   - The only exception is GO's decay.
   - Keep the uv token under 30% of any frame (R57).
3. **The camera (R34-R36, R39-R40, R80-R81).**
   - One continuous move per line, riding the beam along the rows so the newest word sits in the sweet spot.
   - Cut only between lines, on the downbeat nearest each line's first stressed word.
   - Give each line its own framing family. For example:
     - line 1: a table-height raking track with the beam toward the lens;
     - line 2: a three-quarter crane down, with the lamp and glove in frame;
     - line 3: a slow orbit around the swab;
     - line 4: a low profile across the cloth for the three sweeps, then GO.
   - Never use a top-down view (elevation under about 55°).
   - Add one type-led macro per half-line onto its hero, as `scale` r5 does: DIRTY, SWEET, PRETTY, DEVIL, HANDS, NEVER and GO (TEETH is the slam). Each macro opens on the hero's onset, already readable, with the line so far in frame.
   - Pushes are ≤20% of framing scale over ≥0.4 s.
   - Report each line's travel: the orbit degrees and the screen travel of the block's centre.
4. **Impacts and the lamp (R37, R38, R79).**
   - The tiers are on the type card. Pick the downbeats from `audio.json`.
   - The hit pattern must differ from `scale`'s on the same lines: `scale` hits hardest on the heroes, `uv` on the openers and the sweeps.
   - Hits build over line 2 into TEETH.
   - Each hit reveals the words; none washes the frame violet.
5. **The TEETH hook (TYPE §8 item 2; R24, R82).**
   - On TEETH's onset (68.47), a full-frame slam: fluor-white Archivo 900 on film-black.
   - On the next beat, a condensed copy stamped over the first.
   - The beam's sweep crosses the frame as the break line, a straight wipe edge.
   - Hold until 69.44 with no orphan frame, then cut back onto LATE, already readable.
   - No halation on the slam.
6. **The probe and crops.**
   - Record every word with `kinRecord3D` on the cloth plane, using the camera actually used, macros included, and tags `hero` or `sup`.
   - Lint must show 0 errors and 100% presence.
   - Add an occlusion scan (`--query uv_occ=1`) that reports any frame where the lamp, a glove or the swab covers a sung word for more than 2 frames. It must report 0 hits.
7. **Keep:** the beam pool and its colour, the swab action (one stroke per word on "put your hands on me", one soft band per stroke), the three sweeps that speed up, GO's decay to about 25% at 76.35, the tag, every shot reaching film-black and the glow peak (R13), and speed ≤200 ms per frame.

**Code map** (`app/src/teeth2/scenes/`):
- `uv.ts:40-51`: `SET`, the camera and lamp setups.
- `uv.ts:54-64`: `track`.
- `uv.ts:90-157`: the beam path, shots and swab timing in the constructor.
- `uv.ts:176-210`: `aim`, `setup`, and the per-word level, threshold, gain and residual.
- `uv.ts:238`: the excitation memory `M`.
- `uv.ts:278-285`: the swab.
- `uv-type.ts:33-60`: `ROW_CAP`, `HERO_CAP`, `BLOCKS`, the layout.
- `uv-glsl.ts:41-50`: the uniforms.
- `uv-glsl.ts:500-545`: the cloth and trace shading.
- The kit is in `app/src/teeth2/kinetic.ts`. Additions only (R72).

**Key-frame checkpoint first (R91).**
- Stills:
  - 62.70: FIGHT, lone first word;
  - each hero onset +0.05: DIRTY 63.40, SWEET 65.02, PRETTY 66.85, DEVIL 70.31, HANDS 71.17, the first NEVER 72.90, GO 75.92;
  - 66.20: TALK, lone;
  - 68.50 and 68.93: the two slams;
  - 69.50: LATE after the cut;
  - 76.30: GO's decay at the cut.
- A **540p30 clip of the whole window, 62.54-76.35, with audio**.
- An 8 fps strip of 65.9-70.4 (`--n 36 --cols 9`).
- Lint over the window.
- Write everything to `out/gate3/kinetic/uv-r1/checkpoint/`, then **stop and report** in ≤120 words: the travel per line, the floor measurements, lint and occlusion, the ms per frame, and the paths.

**Full pass, after the lead's go:**
- clips 62.54-69.5 and 69.0-76.35 at 1080p30 with audio, plus `-share.mp4` copies (crf 24);
- the 8 fps strip 66.0-70.0 (`--n 32 --cols 8`), which is the blind-review strip;
- the dense sheet 62.6-76.3 (`--n 30 --cols 6`);
- lint 62.54-76.35 to `out/lint/uv-r1/`;

all to `out/gate3/kinetic/uv-r1/`.

**Setup:** `source out/env.sh`, then render from `app/` (R72) with `--only uv`. You work in the main checkout on `teeth-v2`. Run `git log -1` first; it should be the commit of this brief or later. You are the only builder.

**Files:** `uv*.ts`, plus additions only in `kinetic.ts`. Don't commit.

**Report** in ≤150 words, plus a code map of the deltas and the files changed (R91).

**The lead's decisions (2026-11-22, after the builder's first read):**
- **Line 4's cut lands at 72.90 on NEVER** (R39: the downbeat nearest the first stressed word). AND (72.68) is a pickup: it appears in line 3's shot as the head of line 4, as `scale` does it. The NEVER macro opens on the cut. The line 4 tier-1 opener hit moves to 72.90.
- **The second TEETH slam goes on the 8th note at 68.80.** Move the checkpoint still from 68.93 to 68.85.
- **The swab lifts a word's glow back down to the readable floor, never below it.** Raise the residual floor (today 0.015, `uv.ts:207`) and measure it against the 40-luma target. The swab lift in `uv-glsl.ts` (`amt *= 1 - 0.97*lift`) stops at the floor.
- **One swab stroke per word:** put, your, hands, on, me. HANDS's stroke is the heaviest.
- **The second row is indented to the right**, so each line's camera move only ever goes right and down (R35: no reversal).
- **The occlusion scan uses JS stand-in shapes** (capsules or boxes) for the lamp housing, the gloves and the swab, traced against each sung word's projected box.

**Checkpoint review (lead, 2026-11-23; checkpoint `b310cfb`, `out/gate3/kinetic/uv-r1/checkpoint/`).** These pass: lint (0 errors, 100% presence), the occlusion scan (0 hits), the floor (50-97 luma steps), the speed (~60 ms), the slams, and GO's decay. Keep them all. The client said "fix, then full pass". Fix these four, then run the full pass:
1. **The exhibit reads as a pillowcase in every line.** Today most frames are words on a dark void with one stitch line.
   - Put a hem, the open end or the side seam in frame in every line, and both the hem and the open end in at least two lines.
   - Give the cloth a dim film2 ambient, so its folds and weave read outside the beam. Black still reaches p1, and the floor contrast stays at least 40 luma steps.
   - The EXHIBIT 5 tag is whole and readable in at least one line. Line 1 or line 3 suits it.
2. **The lamp reads as a lamp in a gloved hand.**
   - Today it is a violet bar clipped at the top edge. In at least half of each line's frames, show the housing, the tube's end and the glove's wrist.
   - Keep it off the words; the occlusion scan stays at 0.
   - It may enter from the frame's side or top, but never as a bare sliver.
3. **Supporting words hold their size.**
   - The line's earlier words never shrink when the hero's macro opens. "Talk so" at 66.67-66.80 drops to tiny; hold it at least as big as its line framing.
   - "but your heart got" and line 4's two middle NEVERs (15 mm today) need at least 7% cap on their onsets. Give the middle NEVERs a bigger cap, or a three-row block if they won't fit.
   - Report the smallest supporting cap per line again.
4. **The macros push.**
   - Aim for at least 1.15x the line framing on DIRTY, PRETTY, DEVIL and NEVER, within R80.
   - Shift the frame so the line so far sits at the frame edge or behind the hero, rather than shrinking it. Where the curve or the frame can't allow it, report the ratio, as before.

Re-render the key stills to `checkpoint2/` and check them yourself. Then run the full pass as listed above. If the 5-hour window passes ~70% while you work, stop, leave the working tree as it is, and report.
