# Kinetic type, round 2: `scale` with a lyric-led camera (builder brief)

The client rejected round 1's prototypes. The type moved, but:
- **the lyric was missing from many frames:** 13 of 30 frames of `scale` showed no readable word;
- **the camera cut to a new lens on every beat:** the client called it "whiplashy" and "erratic".

The bar is P(doom): the line is on screen the whole time, and the camera follows the words.

**Read first:**
1. `docs/TEETH2.md`: "Lyric-led camera" (new, binding, supersedes the plate's cut-every-beat grammar), then "Kinetic type", "Typography", and the `scale` paragraph (its exhibit, still binding; its cutting is not).
2. **The reference.** `out/gate3/kinetic/ref/pd-loss.png` is P(doom) 9.5–16.6: the spark writes "in your training loss" and the camera rides it down the landscape, then SERVANT/BOSS roll with the world. `pd-hook-room.png` is P(doom) 22.6–30: the line builds word by word and stays. `te-scale.png` is round 1 of `scale`: the frames with no lyric and a new lens every beat are what failed. Look at all three before you design anything.
3. `app/src/teeth2/kinetic.ts` (the kit) and `app/src/teeth2/scenes/scale*.ts` (round 1).

**Setup:** source `"C:/Users/ethan/OneDrive/Documents/Claude Projects/Teeth/repo/out/env.sh"` for bun and ffmpeg (no python). Render **from `app/`**: `bun scripts/render.ts stills|sheet|video|lint --song teeth --only scale --url http://localhost:5193 --out <abs fresh path>`. For P(doom) itself, use `--song pdoom`.

## The job: `scale` (48.73–62.54), chorus 1, maximal energy

**Lines** (`data/teeth/lyrics.json`):

| start | line |
|---|---|
| 48.73 | Fight so dirty but your love's so sweet |
| 52.18 | Talk so pretty but your heart got teeth (TEETH 54.66) |
| 55.63 | Late night devil, put your hands on me |
| 58.87 | And never, never, never ever let go (GO 62.11) |

`polygraph` hands off at 48.73. `uv` takes over at 62.54.

**Re-stage it so that:**
- **Every frame carries the current line, readable.**
  - The line is built word by word as sung, and sung words stay.
  - Supporting words have a cap height of at least 5% of the frame height. The hero is at frame scale.
  - The line holds until the next one takes over.
- **Each line is one continuous camera move that follows its words.** This is the core of the job. For example, the words are bitten one after another along a band around the apple, the apple turns on its stand, and the camera rides the band so the newest bite is always in the frame's sweet spot. Push in on the hero's onset. Ease the moves into the downbeats. No cuts and no reframes inside a line.
- **The stomp stays the shutter.** Every beat is still a flash: an exposure kick and a small shake inside the continuing shot, not a new photograph.
- **Cuts happen only between lines,** on the downbeat, carried by the type where possible. Up to two hero slams may cut to full frame and back (keep round 1's TEETH hook slam, with its bite out of the H, as the first statement of the hook). DIRTY's slam is optional.
- **Keep the approved stills recognisable:** 48.75 (the first flash), 51.50 (SWEET in wax pink) and 55.00 (TEETH bitten in the apple). Keep the exhibit, the ABFO ruler, the label and the palette.
- **Use the kit's moves on the words:** spring, stamp, stretch, lean, condense. DEVIL leaning further each beat, NEVER condensing on each "never" and GO landing biggest were good; keep them.

**Kit:** you may **add** to `kinetic.ts` without breaking its API. The most useful addition is a camera helper that follows a lyric path: given the words' positions over time, it returns a smoothed camera target and position with ease into the downbeats. Every other plate will need it, so comment it at the top of the file.

**Self-check before you report.** Render a dense sheet (`--n 30`) of 49.5–56.9 at the same times as `te-scale.png`, and put it beside the P(doom) sheets:
- Is a readable line in every frame?
- Does the framing flow from frame to frame within each line?

Fix it if not.

**Deliverables:**
- Clips at 1080p30 with audio, 48.73–55.5 and 55.0–62.54, as `out/gate3/kinetic/r2/scale-*.mp4`.
- The dense sheet as `out/gate3/kinetic/r2/scale-dense.png`.
- An 8 fps frame strip of 52.0–56.0 as `out/gate3/kinetic/r2/scale-strip.png` (32 frames, `--n 32 --cols 8`), for the blind review.

Lint must show 0 errors (the known false hits are fine). Speed must be no slower than round 1 (186 ms/frame), and faster is welcome.

**Rules:**
- Don't commit.
- Touch only `scale*.ts` and `kinetic.ts` (additions only).
- `GLSL_HAND`, `teeth.ts`, `palette.ts` and `monogram.ts` are read-only.
- No drip, blot, blob or spatter shapes. No outlined or haloed type; a slam returns `halation: 0`.
- Nothing lights more than 0.4 s before its word.
- Budget about 20 renders.

**Report** in ≤200 words:
- how the camera follows the words, line by line;
- the camera helper's API, if you added one;
- the clip paths and ms/frame;
- what the self-check showed.

---

## Round 2b: fixes after the blind review (fresh builder)

Round 2 is committed. Its camera follows the words along a band round the apple, and the camera helper `LyricPath`/`LyricCam` is in `kinetic.ts`. A blind reviewer judged it against P(doom)'s chorus 26.3–30.3, using the 8 fps strips `out/gate3/kinetic/r2/scale-strip.png` (52.0–56.0; frame n = 52 + (n−1)/8) and `out/gate3/kinetic/ref/pd-strip.png`. The verdict was "within reach, not below it". P(doom) won on lyric presence, legibility and energy; camera flow was even. Fix these, in order:

1. **Open each line close.** The first words of a line ("TALK SO", "LATE NIGHT") read tiny on a distant apple (52.3–53.0, 55.6–56.4). From a line's first frame, the words are at least 8% of frame height in cap height.
2. **Keep the line whole as it builds.** Earlier words fall off the left edge and get cropped mid-word ("ETTY", "TY BUT Y", "TE"). Lead the camera, flatten the band's wrap, or pull back gently as the line grows, so the line so far stays in frame and is never cut mid-word. When a line is too long for the band, the first words may leave, but only as whole words, on a beat.
3. **No sudden push-ins.** The push onto each new word is currently 0.3 s, which reads as a jump at 53.2→53.33. Ease the moves over the word's whole duration and into the downbeat, never faster than the eye can follow.
4. **Escalate into TEETH and hold the slam.**
   - The light builds over line 2: each flash brighter and the raking light harder, so every frame reaches lightbox-bright and film-black.
   - The full-frame TEETH holds until the next line's first word (55.63), with no orphan "TE" frame before it and no blank frame after it.
   - The cut back lands straight on LATE, already readable.
5. **Line 4's cut is on "And" (58.87), off the downbeat.** Move it to the nearest downbeat, or carry the cut with the type.
6. **The 48.75 still crops the label's end.** Show the whole label "08-32 · EXHIBIT 4".
7. **Energy.** The plate reads muted (dull yellow on dark, a slow turn). Make the flashes visibly hit as exposure kicks inside the shot, and add stretch or stamps on the kicks. Make the chorus feel maximal without cutting.

**Self-check:** render the same 8 fps strip, 52.0–56.0 with `--n 32 --cols 8`, to `out/gate3/kinetic/r2b/scale-strip.png`, and the dense sheet 49.5–56.9 (`--n 30 --cols 6`) to `r2b/scale-dense.png`. Count the frames with no readable lyric or a mid-word crop. The target is 0, apart from the first frame after a cut.

**Deliverables:** clips 48.73–55.5 and 55.0–62.54, with audio, to `out/gate3/kinetic/r2b/`. Speed must stay ≤138 ms/frame, and lint must show 0 errors. The rules from round 2 still hold: don't commit, touch only `scale*.ts` and `kinetic.ts` (additions only), and budget about 15 renders.

**Report** in ≤150 words, including the self-check counts.
