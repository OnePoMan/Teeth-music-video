# Gate 3: extending the five gate 2 plates to their full windows (builder briefs)

These plates were built as stills at gate 2, and the client approved those stills. Gate 3 takes each to its whole window at block-in quality. One fresh Opus 5.5 (high) builder per plate, two at a time, one review each.

**Read first (every plate):**
- `docs/TEETH2-BUILDERS.md`: the gate 3 standard section supersedes the still-only scope.
- Your plate's paragraph in `docs/TEETH2.md`, and the gate 2 sections at its end.
- The "Gate 3" section of `docs/TEETH2-LEDGER.md`: rulings and client taste calls, all settled.
- Your plate's approved stills in `docs/gate2/` (JPGs; the time is in the filename).

**Setup:** source `"C:/Users/ethan/OneDrive/Documents/Claude Projects/Teeth/repo/out/env.sh"` for bun and ffmpeg (there is no python).

**Rules:**
- Don't commit.
- Touch only your plate's files (`scenes/<id>*.ts`).
- The shared glove is `GLSL_HAND` from `match-glsl.ts`. Import it and never edit it: its knuckle lumps are a gate 4 kit fix.

**What holds for every plate:**
- **Keep the approved stills.** At each approved still's time the frame must still read as that still: the same composition, type and colour. Small differences that come from motion are fine. Render those times and compare them with the JPGs.
- **Timing comes from the data.** Take it from `data/teeth/lyrics.json` and `audio.json`. A word lights at its `start`, and nothing shows more than 0.4 s early. A hero snaps from light to heavy on its onset with its letters locked. One hero per line, and it reaches frame scale (≥30% of width).
- **Constant motion and the event script.** Follow your paragraph's event script. Give each line a new eased framing. Never repeat a composition from another plate (rule 1). No HUD and no counters.
- **Value range.** Every frame reaches film-black and lightbox-bright.
- **Palette 2A:**
  - violet only in `uv`;
  - luminol blue only in `luminol`;
  - red only from 165.16 to about 186, and only in the match's outline, the monogram and the stamp;
  - tungsten only in `scene`.
- **Stakes guards.** No drip, blot, blob or spatter shapes; no gore, faces or horror. Radiographs are always backlit.
- **The glove.** Every pen-written lyric and every carried object shows the glove.

**Deliverable:**
- A contact sheet at `out/gate3/<id>-f1/sheet.png`: one frame per bar, each money moment, and the approved still times.
- At most one ≤4 s clip of the hardest moment.
- Lint your window with 0 errors. Speed ≤100 ms/frame.

**Report** in ≤150 words: what moves now, the sheet path, ms/frame, how the approved still times compare, and anything you could not do. Budget about 15 renders.

---

## 1. `drawer`: intro, 0–7.23
- Approved still: `5-loop-frame-0.20.jpg` (the drawer a hand's width open, 08-32 standing proud).
- **Plate 14 depends on this plate.** `filed` patches `drawer`'s `MARCH_FRAG`, and its last frame (≈204.9) must match `drawer`'s t=0 at ≥40 dB PSNR. Don't change anything `filed` relies on at t=0. After your changes, render `drawer` at 0 and `filed` at its last frame and check the match.
- Hand-off to `lightbox` at 7.23.

## 2. `lightbox`: "Some days you're the only thing I know", 7.23–21.10
- Approved stills: `6-radiograph-know-9.05.jpg`, `6b-radiograph-tag-10.60.jpg`.
- This plate holds the core radiograph shader and the tooth set (`teeth.ts`: HIS set, with the chip on #8). Keep the radiograph backlit throughout.
- Hand-off from `drawer` at 7.23 and to `scene` at 21.10.

## 3. `scale`: chorus 1, first half, 48.73–62.54
- Approved stills: `1b-scale-first-flash-48.75.jpg`, `1c-scale-sweet-51.50.jpg`, `1-chorus1-scale-teeth-55.00.jpg`.
- The golden apple in the palette's stone yellow, the bitten word with scalloped tooth-width edges, the flash and the ABFO ruler.
- Plate 12 (`acetate`) photographs this exhibit, so keep its look.
- Carried from gate 2: the apple macros read a little smooth up close, and #8's notch in the bite reads only at zoom. Fix them if it's cheap.
- Hand-off from `polygraph` at 48.73 (its last frame is 48.72).

## 4. `pour`: chorus 2, first half, 103.98–117.79
- Approved stills: `2b-pour-heart-109.40.jpg`, `2-chorus2-pour-teeth-110.20.jpg` (the cast turned out).
- Plate 8 (`voice`) match-cuts into this plate at 103.98 on ALIVE. Look at `voice`'s last frames and make the cut land.
- Carried from gate 2: the turned-out cast's front teeth show slight gaps. Fix it if it's cheap.
- Closed or closing casts are never shot front-on (ruling).
- Hand-off to `articulator` at 117.79.

## 5. `match`: chorus 3b, 159.23–174.77
- Approved stills: `3c-match-suspect-163.00.jpg`, `3b-match-signing-165.55.jpg`, `3-chorus3-match-165.75.jpg`.
- Red starts at 165.16, the lock: the matched outline, then the T.F. monogram.
- The tracing is one object with plate 12 (ruling): the six upper marks of `biteTrace()` (`match-ink.ts`), shown mirrored here because the sheet lies face-down. Plate 12's last frames (≈158.8–159.21) show the sheet traced unmirrored. Your opening may show the sheet landing face-down, but don't change the traced shape.
- Carried from gate 2: the chip at the lock is small at full frame. Fix it if it's cheap.
- Hand-off to `filed` at 174.77.
- This plate owns `GLSL_HAND` (`match-glsl.ts`). Don't edit the glove: other plates import it.
