# `scale` round 5: camera and energy (builder brief, Opus 5.5 high)

Round 4 (`a4afd26`, clips `out/gate3/kinetic/r4/`) fixed the light: true whites, lit openers, lit row starts, lint clean. The fourth blind review still preferred P(doom) on camera flow ("barely moves: a slow drift around the sphere"), and two reviewers in a row rated `scale` low on energy: one hue, one object, one slow shot. The client asked for this round.

**The client's calls (2026-11-22):**
- **Camera:** both bigger continuous moves per line *and* one tight macro reframe onto the hero per half-line.
- **Energy:** carving debris (chips and dust as each word is bitten).
- **Target:** clearly more alive than r4, calmer than P(doom). Words stay readable at all times.

The client rejected round 1 as "whiplashy", so R35, R36, R40 and R80 are the guard rails here, not suggestions.

**Rules:** R21-R22, R29, R31-R32, R34-R41, R79-R82, R13 (keep r4's value range), R71, R72. Read the `scale` card in `docs/teeth2/PLATES.md`.

**Do:**
1. **Bigger moves, one per line (R34, R35, R40).**
   - Each line gets one purposeful spline: an orbit, a crane or a track that **rides along the words as they are carved**, keeping the newest word in the sweet spot (R81), and eases into the downbeats with no reversals.
   - Then a push into the hero on its onset (≤20% framing scale over ≥0.4 s, R80).
   - First measure r4's camera travel per line (orbit degrees and screen travel of the apple's centre) and aim for roughly 2-3x that. Report both numbers.
   - Give each of the four lines its own framing family at the line cuts (R39, on the downbeat): for example a three-quarter wide on line 1, a low raking profile across the skin on line 2, a high angle on line 3, an orbit on line 4. The cuts between lines then add variety.
2. **One macro reframe per half-line, onto its hero (R36).**
   - The heroes are DIRTY | SWEET, PRETTY | (TEETH is the slam, which already takes the cut), DEVIL | HANDS, NEVER | GO.
   - The macro opens on the hero's onset, already readable, at about 2x the line framing, close enough to see the carved walls.
   - The line so far must stay in frame and readable (each word's cap ≥5%, R22), at the frame edge or behind the hero. R36 allows a reframe only when the line so far is visible or back within 2 frames.
   - Get out of the macro the same way: a type-led reframe onto the next word, or the line cut.
   - At most one per half-line, never on consecutive beats.
3. **Carving debris (R37, R79).**
   - As each word is carved, chips of stone-yellow skin and cream flesh, plus a little dust, spray from the cut, lit by the same key so they catch the streak.
   - Grade it: tier 1 (hero onsets) a real burst; supporting words a small puff; nothing between words.
   - Debris never crosses a word that's on screen in a way that hurts reading. It falls out of frame or settles within about 0.5 s.
   - Stay in the palette: no new hues.
4. **Keep:**
   - r4's light: the pool, the streak, the whites, and every frame reaching black and lightbox.
   - The 11 graded flashes and their build.
   - Word spacing, the TEETH slam and its hold, and the approved stills 48.75, 51.50 and 55.00 (R41). Use those as camera waypoints.
   - Lint 0 errors and 100% presence; `kinProbe` must keep projecting with the camera actually used, including in the macros.
   - Speed ≤200 ms per frame.

**Code map** (r4; `app/src/teeth2/scenes/`):
- `scale.ts:78-82`: `PLANS`, the per-line camera plans (`daz` swing).
- `scale.ts:91-120`: the light tunables, which stay.
- `scale.ts:417`: the `wordPose` clamp.
- `scale.ts:556-575`: the light uniforms.
- `scale.ts:627`: `kinProbe`.
- The lyric camera helpers `LyricPath` and `LyricCam` are in `app/src/teeth2/kinetic.ts`. You may add to them, but **additions only** (R72). Don't change existing behaviour that other plates call.
- Look-dev query overrides: `sc_*`.

**Key-frame checkpoint first (R91).**
- Render stills at:
  - 50.0 (line 1 mid-move);
  - each macro onset: 49.59 DIRTY, 51.21 SWEET, 53.04 PRETTY, 56.49 DEVIL, and HANDS, NEVER and GO from the timing data;
  - a debris burst at a hero onset +0.1 s;
  - the approved 48.75, 51.50 and 55.00.
- Render a **540p30 clip of the whole window, 48.73-62.54, with audio**. The camera can only be judged in motion.
- Render an 8 fps strip of 52.0-59.0 (`--n 56 --cols 8`).
- Write everything to `out/gate3/kinetic/r5/checkpoint/`, then **stop and report** (≤100 words: r4's and r5's camera travel per line, and the paths).

**Full pass, after the lead's go:**
- clips 48.73-55.5 and 55.0-62.54 at 1080p30 with audio;
- the 8 fps strip 52.0-56.0;
- the dense sheet 49.5-56.9 (`--n 30 --cols 6`);
- lint 48.73-62.54 to `out/lint/r5/`;
- compressed `-share.mp4` copies (crf 24) of both clips;

all to `out/gate3/kinetic/r5/`.

**Setup:** `source out/env.sh`, then render from `app/` (R72). You work in the main checkout on `teeth-v2`; run `git log -1` first, which should be the commit of this brief or later. You are the only builder.

**Files:** `scale*.ts`, plus additions only in `kinetic.ts`. Don't commit.

**Report** in ≤150 words, plus a code map of the deltas and the files changed (R91).
