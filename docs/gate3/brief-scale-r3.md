# `scale` round 3: light and graded flashes (builder brief, Opus 5.5 high)

Round 2b (`cac7a04`) passed the blind review on lyric presence, legibility and camera flow. The client called it "definitely closer". Two things are left, and both are light:
- the frames read washed-out flat yellow, with low-contrast carved letters (the blind reviewer);
- the flash pops on every beat, which is harsh and will get repetitive (the client).

**Rules:** `docs/teeth2/RULES.md` R13 (value range per shot), R37-R38 (graded impacts, instrument hits), R79 (tier ceilings), R80 (push), R81 (sweet spot), R82 (slam budget), R24 (a slam has no halation), R41 (approved stills), R71, R72. Read the `scale` card in `docs/teeth2/PLATES.md`.

**Do:**
1. **Light.** One hard key raking low across the apple, so every carved letter has black shadow walls and bright edges, and every shot reaches film-black and lightbox. Kill the flat mid-yellow close frames, which are 52.3-53.0 and 55.6-56.4 in `out/gate3/kinetic/r2b/scale-dense.png`.
2. **Flash, graded (R38, R79).**
   - The camera flash fires on tier 1 only: each line's hero onset (DIRTY, SWEET, PRETTY, TEETH, DEVIL, HANDS, NEVER, GO) and a few chosen downbeats, about 8-10 flashes in the window, against about 28 now.
   - It is a hard side flash that throws the letters into shadow and edge light for a few frames, never a whole-frame white pop.
   - Between flashes the beats get tier 2 and 3 hits: the type stretching on the kick, a nudge of 5 px or less, and the flash unit's recharge glow ticking up as a small light change.
   - The build: line 1 sparse; line 2 brighter, flash by flash, into the biggest on TEETH; "never, never, never" three quick flashes rising in strength, then the stop on GO.
3. **Keep:** every lyric-led gain of r2b (presence, rows, camera, the TEETH slam and its hold), and the approved stills 48.75, 51.50 and 55.00.

**Key-frame checkpoint first (R91).** Before touching the whole window:
- render stills at 51.21 (SWEET onset), 53.04 (PRETTY), 54.66 (TEETH) and 56.49 (DEVIL), each on and between flashes;
- render an 8 fps strip of line 2 (52.0-56.0, `--n 32 --cols 8`) to `out/gate3/kinetic/r3/checkpoint/`.

Then **stop and report the checkpoint** (≤80 words with the paths). The lead looks before you do the full pass.

**Full pass, after the lead's go:**
- clips 48.73-55.5 and 55.0-62.54 at 1080p30 with audio;
- the 8 fps strip 52.0-56.0;
- the dense sheet 49.5-56.9 (`--n 30 --cols 6`);

all to `out/gate3/kinetic/r3/`. Lint must show 0 errors. Speed ≤200 ms (report it).

**Files:** `scale*.ts` only.

**Note:** another builder is adding a type probe to `kinetic.ts`, with one small call site in `scale`. Don't edit `kinetic.ts`, and leave their call site alone if it appears. Don't commit.

**Report** in ≤150 words, plus a code map of 10-15 lines (R91).
