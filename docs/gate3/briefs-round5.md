# Gate 3, fix round after review 4: builder briefs

Written by the lead ahead of the 16:10 UTC reset (2026-11-20) so the builders start at once. Each builder is fresh. Every brief starts with the same reading.

**Read first (all three):** `docs/TEETH2-BUILDERS.md` (the gate 3 standard section supersedes the still-only scope), your plate's paragraph in `docs/TEETH2.md`, the "Gate 3" section of `docs/TEETH2-LEDGER.md`, and your plate's section of `docs/gate3/review4.md`. Source `"C:/Users/ethan/OneDrive/Documents/Claude Projects/Teeth/repo/out/env.sh"` for bun and ffmpeg (no python). Don't commit; the lead does. Touch only your plate's files (`scenes/<id>*.ts`), unless the brief says otherwise. The shared glove is `GLSL_HAND` from `match-glsl.ts`: import it, don't copy it, don't edit it (its knuckle lumps are a gate 4 kit fix). Lint your window, look at your own sheet once and fix what is obviously wrong, then report in ≤150 words: what changed, the sheet path, ms/frame, and anything you could not do.

---

## 1. `articulator`: last fix round (Opus 5.5, high)

The window is 117.79 to 131.60 (`timeline.ts`). Keep the event script: the casts close on heroes, the pin clicks, three glides, release on "let go". Keep the chrome bar with words revealed by the moving reflection band (ruling), and the sweep card behind the set. Never shoot closed or closing casts front-on (ruling: profile, three-quarter rear, or ≥45° above).

1. **An articulator, not a cage.** Delete the two front posts and the top frame's front rail. The upper member is one T-shaped arm hinged on the condylar axle between two rear posts and cantilevered forward over the casts. A single incisal pin at the arm's tip lands on the incisal table. Each cast sits on a mounting disc. The engraved bar is the arm's front cross-piece, ≤10% of frame height.
2. **Heroes at frame scale.** SWEET (≈120.5), TEETH (≈124.1), HANDS (≈126.6) and GO (131.17–131.58) each span ≥30% of frame width from the word's start to its end, with the reflection band across it. Push in; keep GO whole until 131.58.
3. **Supporting words readable.** On each line's onset, frame the bar within 30° of frontal and at ≥40% of frame width (FIGHT 117.80, LATE NIGHT 125.30, ON ME 127.40, NEVER EVER 130.30: lift NEVER EVER off dark-on-dark).
4. **No repeated top-down shot.** The overhead view with the bar across the casts is allowed at most once per line. Alternate profile (hinge in frame), three-quarter rear, and a cusp macro.
5. **Contact marks.** One macro just after a glide (≈122.5): film-black marks on the yellow cusps from the articulating paper.

Speed is a gate 4 item (110 ms/frame now); don't make it slower. Sheet: `out/gate3/articulator-f2/sheet.png`, one frame per bar plus each hero's start and end.

---

## 2. `acetate`: rework of the print, the acetate and the lyric layout (Sonnet 5.5, high)

The window is 145.41 to 159.23, where plate 13 `match` starts (`timeline.ts`). **Keep** the timing, the bar snaps and the lamp kicks. Rebuild:

1. **The hand-over to plate 13.** Trace only the six upper marks, in the shape `match-ink.ts`'s `biteTrace()` returns, **unmirrored** (plate 13 shows the sheet turned face-down, mirrored; plate 13 stays as it is: ruling), #8's chip last at ≈158.8. The lower arc stays untraced in the photograph.
2. **A photograph, not a disc.** A rectangular print with a white border on a dark desk, showing plate 5's exhibit: the golden apple's flank with skin speckle and a specular, the bite scoop with a shadowed rim and grooves, the black velvet edge, and the ABFO L-scale with ticks. Look at plate 5 (`scenes/scale*.ts`, `docs/gate2/`) for the apple and scale. The print's edges show in the 158.95 pull-back.
3. **A visible acetate sheet.** Two frosted tape strips at the top. One thin bevel line at the sheet's edge (as plate 13 draws it at 159.40), only where the lamp pool reaches. A lamp hotspot slides across the sheet. The ink casts a faint offset shadow on the print. Outside the pool the edges fall dark. Remove the two unexplained white bands (158.95–159.21, the plate's last frames).
4. **The lyric uncovered at the nib.** Each line sits in the band just outside the arc being traced and is revealed left to right, with the reveal edge locked to the nib, so the nib reaches each word's first letter at the word's `start`. Whole letters, no fades; nothing more than 0.4 s early. **Fallback (client taste call):** if this doesn't read after one honest attempt, print the words on the print and spring each up on its onset, and say so in your report.
5. **The glove.** Lit by the lamp (knuckle highlights, a readable pen), never a black mass. At 152.33 it must not sweep across the lens. At 153.33 DEVIL springs as a whole word (no lone D bracket ahead of it).
6. **SWEET and PRETTY** (148.10, 149.90): Cormorant italic in wax pink, the tender register (see `palette.ts` and the typesheet board), not Archivo.

Red only from 165.16 on; this plate has none. Sheet: `out/gate3/acetate-f1/sheet.png`, plus one ≤4 s clip of the nib uncovering a line.

---

## 3. `filed`: fix of the desk section (174.77–186.85) (Opus 5.5, high)

The bank and the loop ship; don't touch them (the last frame must still match plate 1's t=0; the lead has already fixed the tube's louvre at 12, review item #6). Work in `filed.ts`, `filed-desk.ts`, `filed-glsl.ts`.

1. **Exhibits in frame at all times.** Open on the folder lying open with the stack beside it. Each exhibit lifts from the stack, sits face-on for its TEETH (175.66, 179.06, 182.08) and slides in on the next kick. One cold pool from the tube: lightbox-bright at the centre down to film-black. No empty grey slabs; every frame reaches film-black and lightbox-bright (ruling).
2. **Radiograph backlit** (ruling: radiographs are always backlit). Swing it past the tube so it reads bright teeth on a film-black base. Photograph the cast on a white card so the black TEETH sits on a light ground.
3. **Red T.F. at full match red** (ruling) at about a third of TEETH's cap height with a heavier stroke, from 175.90 to 183.00. Drain it visibly across the close (183.4–186.4), not in 0.2 s.
4. **The glove** (`GLSL_HAND`, forearm entering from the frame edge) grips the folder's edge for the carry (187.20–190.60, in the bank: the one bank change allowed, adding the hand to the carried folder) and holds the pen that writes the tab lyric (183.4–186.8).
5. **The tab's hero.** Push in on the tab so GO is ≥20% of width at 186.50, and NEVER (184.90) doesn't wrap.

Sheet: `out/gate3/filed-f1/sheet.png` covering the desk section one frame per bar, the carry, and the last frame against plate 1's first.
