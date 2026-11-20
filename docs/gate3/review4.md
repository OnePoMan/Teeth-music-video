# Gate 3, batch review 4 (fresh Opus reviewer, 2026-11-20)

Round 2 (the last review round) for `chart`, `voice`, `articulator` after fix round 1; round 1 for `acetate` and `filed`. Review stills: `out/gate3/review4/` (voice 102.90, match 159.40).

## Plate 7 `chart`: SHIP for gate 3
Review 3: #2–#6 fixed. #1 (glove knuckle lumps, 82.05) is the shared `sdGlove` in `match-glsl.ts`: a kit fix at gate 4, re-checked against the gate 2 match stills.

## Plate 8 `voice`: FIX (one small last round now)
Review 3: #1–#4 and #6 fixed (ALIVE whole at 102.90); #5 partly.
1. **Sung words clipped by the lane edge** (93.85 "very" for "Every"; 96.50 "utterflies" while still sung). A word reaching the lane's left edge stops there (words stack against the edge) until its line leaves; never clip a word whose line is on screen.
2. **The foreground deck smears into vertical streaks** (100.90–102.00). Clean defocus instead of the directional smear on that layer (or a lower shutter); keep the deck's shape readable.
3. **The splicing strip reads faintly** (95.60). A halide-white backing with a bright edge where the monitor catches it, so it reads as the glove presses it down.
Gate 4: the spectrogram reads as a small grey noise patch in every shot.

## Plate 10 `articulator`: FIX (last round now)
Review 3: #2, #5 fixed; #1, #3, #4, #6 partly.
1. **It reads as a square cage, not an articulator** (every frame). Delete the two front posts and the top frame's front rail. The upper member is one T-shaped arm hinged on the condylar axle between two rear posts, cantilevered forward over the casts; a single incisal pin at the arm's tip lands on the incisal table; each cast on a mounting disc; the engraved bar is the arm's front cross-piece, ≤10% of frame height.
2. **Hero words not at frame scale**: SWEET (120.50), TEETH (124.10), HANDS (126.60) ~12–15% of width; GO (131.30–131.58) ~5%. Push in so each hero spans ≥30% of width from its start to its end, the reflection band across it.
3. **Supporting words unreadable in the wides**: FIGHT (117.80), LATE NIGHT foreshortened (125.30), ON ME (127.40), NEVER EVER dark on dark (130.30). On each line's onset, frame the bar within 30° of frontal at ≥40% of frame width.
4. **One composition repeats**: the top-down shot with the bar across the casts at 120.15, 120.50, 123.60, 124.10, 126.22, 126.60, 129.55, 130.30. At most once per line; alternate profile (hinge in frame), three-quarter rear, a cusp macro.
5. **No contact marks visible.** One macro after a glide (~122.5) with film-black marks on the yellow cusps.
Gate 4: 110 ms/frame.

## Plate 12 `acetate`: REWORK of the print, the acetate and the lyric layout (keep the timing, bar snaps and lamp kicks)
1. **The hand-over to plate 13 does not match.** Trace only the six upper marks, in the shape `match-ink.ts`'s `biteTrace()` gives, un-mirrored, #8's chip last (~158.8). The lower arc stays untraced in the photograph. Plate 13 stays as it is (ruling).
2. **The print is not a photograph** (all frames: a yellow disc with a cream bowl, like a fried egg). A rectangular print with a white border on a dark desk, showing plate 5's exhibit: the golden apple's flank with skin speckle and a specular, the bite scoop with a shadowed rim and grooves, the black velvet edge, the ABFO L-scale with ticks. The print's edges visible in the 158.95 pull-back.
3. **The acetate is invisible; two unexplained white bands** (158.95–159.21). Two frosted tape strips at the top; one thin bevel line at the sheet's edge (as plate 13 draws it at 159.40) only where the lamp pool reaches; a lamp hotspot sliding across the sheet; the ink casting a faint offset shadow on the print. Outside the pool the edges fall dark.
4. **The lyric is text on a yellow ground, not uncovered by the pen.** Each line in the band just outside the arc being traced, revealed left to right with the reveal edge locked to the nib, so the nib reaches each word's first letter at its `start`. Whole letters, no fades.
5. **Glove** (145.60, 152.33): a black mass; light it with the lamp (knuckle highlights, a readable pen). At 152.33 it sweeps across the lens and fills the frame: keep it off the lens. At 153.33 DEVIL's D shows as a lone grey bracket ahead of the word: spring the whole word together.
6. **SWEET and PRETTY are pink Archivo** (148.10, 149.90). The tender register is Cormorant italic in wax pink.
Taste call (client): if the pen-uncovering lyric does not read after one attempt, fall back to words printed on the print that spring up on their onset.

## Plate 14 `filed`: FIX of the desk section (174.77–186.85); the bank and the loop SHIP
1. **The desk is empty grey slabs, mid-tones only** (174.90, 177.60, 178.40, 180.90). Exhibits in frame at all times: open on the folder lying open with the stack beside it; each exhibit lifts from the stack, is face-on on its TEETH (175.66, 179.06, 182.08), slides in on the next kick. One cold pool from the tube, lightbox-bright at the centre to film-black.
2. **The radiograph is lit like a print; black TEETH sits on dark exhibits** (175.90, 179.30). Swing the radiograph past the tube so it is backlit (bright teeth, film-black base); photograph the cast on a white card so TEETH stays black on a light ground.
3. **The red reads as a dim maroon hairline** (T.F. 175.90–183.00, ~3% of width). Full match red at ~a third of TEETH's cap height, a heavier stroke; drain it visibly across the close (183.4–186.4), not in ~0.2 s.
4. **No hands**: the folder floats 187.20–190.60; the tab lyric writes itself 183.4–186.8. The shared glove (`GLSL_HAND`) grips the folder's edge, forearm entering from the frame edge, then holds the pen that writes the tab.
5. **The tab's hero is small**: NEVER at 184.90 ~10% of width and wraps; GO at 186.50 ~5%. Push in on the tab so GO is ≥20% of width. ("LET C" at 186.50 is GO mid-write: correct karaoke.)
6. **The tube's louvre changes during the carry with no source** (rule 2). Keep the tube fixed.

## Cross-plate
- Glove: chart (kit lumps, gate 4) and acetate (lighting) still fail; filed has no glove though it carries a folder and writes the tab; voice now matches.
- Hero scale is the recurring miss (articulator, filed's tab).
- Value range: filed's desk has no black or bright.
- Hand-overs: 14→1 passes; 12→13 fails (ruling).
