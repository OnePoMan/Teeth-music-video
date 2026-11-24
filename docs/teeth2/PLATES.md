# Teeth v2: plate cards

14 plates in song order. Rules are in `RULES.md` (cited as R-numbers), process in `PROCESS.md`; the type grammar and hook plan are in `TYPE.md`, which ranks above these cards. Story beats and exhibits below are binding. Plate-specific rules live on their card, under their own R-number (R6, R14, R16, R44, R54, R55, R57-R61, R78), and rank as plate cards. Windows are the `PLATES` table in `app/src/teeth2/timeline.ts`. Song: 139.0 BPM, one bar = 1.727 s. Lines are from `data/teeth/lyrics.json` (start in s).

**Exhibit numbers (R54),** in plate order: radiograph 1, bed 2, polygraph 3, apple 4, pillowcase 5, chart 6, voicemail 7, cast 8.

**Value range (R13):** p1 ≤16 on every plate; p99 ≥235 on every plate whose peak is lightbox. Cards 6 and 11 carry their glow-token target.

## Hand-overs (R62)

`filed`'s last frame matches `drawer`'s t=0 at ≥40 dB PSNR (the loop). `voice` match-cuts into `pour` at 103.98 (the clipped wave's flat top to the wet stone surface). `acetate` hands the tracing to `match` (R55). The other hand-offs go in the transitions table (R87, still to write).

## Status of record

Cells: **approved** (a review or the client shipped it), **rework**, **unknown**. Camera and type are "rework" on every plate until its lyric-led pass is approved: `scale` has r5 built and `uv` is in round 2 (see their cards). Scene and light are "approved" for the seven plates the ledger lists as done for gate 3 (their scene, exhibits and light stand); everything else is "unknown": the five gate 2 plates have approved stills (client, 2026-11-19) but their extended windows have not been reviewed, and `acetate` and `filed` were lead-checked after their last fix round with no review.

| # | plate | scene | camera | type | light |
|---|---|---|---|---|---|
| 1 | drawer | unknown | rework | rework | unknown |
| 2 | lightbox | unknown | rework | rework | unknown |
| 3 | scene | approved | rework | rework | approved |
| 4 | polygraph | approved | rework | rework | approved |
| 5 | scale | unknown | rework | rework | unknown |
| 6 | uv | approved | rework | rework | approved |
| 7 | chart | approved | rework | rework | approved |
| 8 | voice | approved | rework | rework | approved |
| 9 | pour | unknown | rework | rework | unknown |
| 10 | articulator | approved | rework | rework | approved |
| 11 | luminol | approved | rework | rework | approved |
| 12 | acetate | unknown | rework | rework | unknown |
| 13 | match | unknown | rework | rework | unknown |
| 14 | filed | unknown | rework | rework | unknown |

---

## 1 `drawer`: intro (0 - 7.23)

- **Lines:** none (intro riff).
- **Story beats and exhibit:** a bank of steel filing cabinets under one cold overhead fluorescent tube, ray-marched. The loop frame: a drawer open a hand's width, folder **08-32** standing proud of the rest. On the riff's first note the drawer rolls fully open; on each real riff note a hanging folder flicks forward, stopping dead in the riff's gaps (2.05 - 2.94, 5.50 - 6.39), a dolly along the rail carrying the speed. The flicks stop on 08-32 (tab: **08-32 · BITE MARK**, the title as a file label). On the last beat the folder is lifted and opened, tipping down into it, and we whip in, cutting on the first sung word.
- **Approved stills:** `docs/gate2/5-loop-frame-0.20.jpg`.
- **Hand-offs:** in: the loop, from plate 14's last frame (R62, at least 40 dB PSNR). Out: `lightbox` at 7.23 (cut on the first sung word).
- **Owned compositions:** the bookend drawer (a deliberate recurrence, R1). `filed` patches `drawer`'s `MARCH_FRAG`: do not change anything `filed` relies on at t=0.
- **Known carried:** speed 103 - 125 ms per frame (BACKLOG).
- **Status:** scene unknown / camera rework / type rework / light unknown.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO

## 2 `lightbox`: 7.23 - 21.10, verse 1

- **Lines:** 7.23 Some days you're the only thing I know / 10.79 Only thing that's burning when the nights grow cold / 14.19 Can't look away, can't look away / 17.65 Beg you to stay, beg you to stay, yeah
- **Story beats and exhibit:** a lightbox's tube strikes, two flickers on the first downbeat, then cold white behind a **panoramic radiograph** of a full set of teeth (backlit throughout; this plate holds the core radiograph shader and the tooth set, chip on #8). The sung words are **radiopaque**, bright silver in the film, as fillings are, each coming through as it is sung (R23 floor). Between the lines (9.3 - 10.8) a gloved hand clips a tag to the film's corner and signs it: **the monogram**, first sighting. "burning": the tube overexposes the film to white. "the nights grow cold": the tube cools and dims, the film going grey-blue, the teeth faint. "Can't look away": a loupe pushes in to tooth #8 in two steps, one per phrase: the chip. "Beg you to stay, beg you to stay, yeah": each STAY comes through in a new filling, and on "yeah" the arch's fillings light one after another back to the last molar.
- **Approved stills:** `6-radiograph-know-9.05.jpg`, `6b-radiograph-tag-10.60.jpg` (the signed tag).
- **Hand-offs:** in: `drawer` 7.23. Out: `scene` 21.10.
- **Owned compositions:** the radiograph and the loupe.
- **Set piece (R31):** the tag signing (9.34 - 10.79): the line clears on the beat after its last word and the signing plays clean.
- **Status:** scene unknown / camera rework / type rework / light unknown.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO

## 3 `scene`: 21.10 - 34.64, verse 1 cont.

- **Lines:** 21.10 Sometimes you're a stranger in my bed / 24.49 Don't know if you love me, or you want me dead / 28.01 Push me away, push me away / 31.09 Then beg me to stay, beg me to stay, yeah
- **Story beats and exhibit:** top-down, an empty unmade bed under a low tungsten glow (the one warm plate, R14) and the investigation's cold work light, raking. It reads as *left*, not as harm (R44): covers thrown back on one side as by someone getting up, the other pillow bare (its case is already bagged: plate 6's exhibit), no body shape, no stain. A-frame evidence markers (folded card) are set down on the bass notes, each carrying the hero word, never in the sheet itself: **STRANGER** (marker 1, the biggest); "love me, or you want me dead": two placards, LOVE and DEAD (a neutral marker), the work light swinging between them on its arm. "Push me away, push me away": on each "push" (28.01, 29.30) the focus is pulled away, racking from the near markers to the far edge of the bed (nothing shoved); the near markers go soft but their words stay readable at the supporting floor (R21, R29), never dissolving; the second rack is deeper than the first. "beg me to stay": the work light's swing lands on the marker STAY, the only thing in focus. No flash here.
- **R14, tungsten is illumination, never surface colour:** a clear amber falloff from one side of frame, a bedside lamp's memory of the room, under the cold work light (a motivated fill, R12). The bedding stays white; no brown mottling or brown shadows.
- **R44, the bed reads as left, not as harm:** covers thrown back as by someone getting up, the other pillow bare, no body shape, outline or stain. DEAD is a neutral marker.
- **Approved stills:** none (gate 2 did not cover it).
- **Hand-offs:** in: `lightbox` 21.10. Out: `polygraph` 34.64 (hard cut on the synths' downbeat).
- **Owned compositions:** fabric from above; the only words on standing cards or signs (R56).
- **Known carried:** cloth material, pillow softness, chunky tent backs; DEAD still to be shown to the client as a neutral marker.
- **Status:** scene approved / camera rework / type rework / light approved.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO

## 4 `polygraph`: 34.64 - 48.73, pre-chorus 1

- **Lines:** 34.64 Call me in the morning to apologize / 38.42 Every little lie gives me butterflies / 41.74 Something in the way you're looking through my eyes / 45.27 Don't know if I'm gonna make it out alive
- **Story beats and exhibit:** a light plate: scrolling chart paper, four pens (two pneumo, cardio, skin conductance). The paper starts scrolling and the pens drop on the synths' downbeat at 34.91. The lyric is written by the cardio pen in a single-stroke hand, the trace climbing out of its baseline into letters and dropping back (no pen-lift hairlines inside letters). "Every little lie": on "lie" the cardio pen jumps a full channel high and stays a jagged trace. "butterflies": all four pens tremble at once, a fast nervous flutter across every channel (the one butterfly sequence, no wing shapes). "looking through my eyes": under the paper, looking *through* it, backlit, the trace reversed against light; EYES stays readable (R60, below). "make it out alive": the cardio pen races, the trace tightens, and on the downbeat into chorus 1 the pen tears through the paper: a narrow ragged slit (R45). The header, small: SUBJECT, left blank.
- **R60 (client call):** THROUGH MY EYES, seen from beneath, stays readable, not mirrored (a deliberate cheat).
- **Approved stills:** none.
- **Hand-offs:** in: `scene` 34.64. Out: `scale` at 48.73 (last frame 48.72, the tear).
- **Owned compositions:** the scrolling machine trace and the machine look (R56).
- **Known carried:** pens read as map pins; the tear's white fibre edges and film2 gap; the top of wide frames.
- **Status:** scene approved / camera rework / type rework / light approved.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO

## 5 `scale`: 48.73 - 62.54, chorus 1 first half

- **Lines:** 48.73 Fight so dirty but your love's so sweet / 52.18 Talk so pretty but your heart got teeth (TEETH 54.66) / 55.63 Late night devil, put your hands on me / 58.87 And never, never, never ever let go (GO 62.11)
- **Story beats and exhibit:** bite-mark photography, and the first stomp. A bitten **golden apple** (R16, below) on black velvet, the bite photographed face-on as bite marks are (R54, below), a white L-shaped ABFO No. 2 scale beside it in the bite's plane. **The stomp is the shutter**: the flash is an instrument hit inside the continuing shot, graded (R37), never a new photograph on every beat. Supporting words are bitten small and shallow as they are sung; each hero word is **bitten into the apple's flank** (Archivo condensed black, the rims scalloped at tooth width with slightly torn skin): DIRTY, SWEET (wax pink, Cormorant), PRETTY (Archivo black, R15), TEETH; DEVIL, HANDS, NEVER, GO. The chip on #8 shows in every bite as a small unbitten wedge in the scalloped rim (and as a notch in the T over #8's position). One label in frame: 08-32 · EXHIBIT 4 (whole, never cropped).
- **R16, the apple is golden:** stone yellow (the bite and the cast share a colour), a true apple silhouette with stem well and stem, so the wax-pink tender word still separates. Cards 9, 12 and 14 show the same stone yellow.
- **R54, bite photography:** the lens is perpendicular to the bite with the scale in the bite's plane, in every shot of the bite. (Exhibit numbers: the header.)
- **R61, scope guard:** the bite is pre-modelled; only the letters animate.
- **Value range (R13):** peak lightbox, p99 ≥235 (r4 checkpoints measured 236-245).
- **Approved stills:** `1b-scale-first-flash-48.75.jpg`, `1c-scale-sweet-51.50.jpg`, `1-chorus1-scale-teeth-55.00.jpg`.
- **Hand-offs:** in: `polygraph` 48.73. Out: `uv` 62.54.
- **Owned compositions:** the apple, the ABFO scale and the bitten word; plate 12 photographs this exhibit, so keep its look.
- **Known carried:** apple macros read a little smooth up close; #8's notch reads only at zoom. From blind review 5: the mid-tone ochre (TALK and LATE read "tan on tan"), lines shrinking at 54.6 - 55.1, and the SWEET and GO macros capped at 1.3x by the apple's curve.
- **Status:** scene unknown / camera rework / type rework / light unknown. **Round 5 is built** (`00be710` plus the limb fix `8fd2354`, brief `docs/gate3/brief-scale-r5.md`, clips `out/gate3/kinetic/r5/`): a camera family per line, hero macros on DIRTY, SWEET, PRETTY, DEVIL, HANDS, NEVER and GO, carving debris, line 4 in 3 rows, a per-glyph limb check (`--query sc_limb=1`, 0 hits), and the light following the line. Lint 0 errors, 0 warnings, 100% presence; 150 ms per frame. Blind review 5 (`../blind-r5/`) passes R83; P(doom) still wins energy and finish.

#### Type card (`scale`, as built in r5)
- **Surface:** the golden apple's flank. Words are baked as an SDF on the surface (`KinWord.fromCells`, posed and `packKin`'d: moved, scaled, rotated per glyph without re-baking). The TEETH slam is a full-frame layer (below). Label: 08-32 · EXHIBIT 4.
- **Line path:** a band around the apple; words are bitten one after another along the band as sung, the apple turns on its stand, and the camera rides the band (`LyricPath` / `LyricCam` in `kinetic.ts`) so the newest bite stays in the sweet spot (R34). One continuous move per line with its own camera family (R35); the line holds until the next takes over (R31).
- **Wrap/shed policy (R76):** wrap. The line so far stays in frame and is never cut mid-word or lost over the apple's limb (R29, the `sc_limb` scan); line 4 is set in 3 rows. A line's first words: 8% cap height advised on its first frame, 5% floor (R21).
- **Hero position:** bitten deep in the apple's flank at hero scale (R21), with one hero macro per half-line (R36): DIRTY | SWEET, PRETTY | TEETH (the slam), DEVIL | HANDS, NEVER | GO. SWEET is wax-pink Cormorant; PRETTY is Archivo black (R15).
- **Kit moves:** spring, stamp, stretch, lean, condense. DEVIL leans further each beat; NEVER condenses on each "never"; GO lands biggest.
- **Impact tiers (R37):** the flash is a hard side flash that throws the carved letters into shadow and edge light; it hits hardest on hero onsets and chosen downbeats (tier 1), with smaller light changes, stretches and nudges on the beats between (tiers 2-3). The light builds over line 2 into TEETH (each flash brighter, raking light harder). Carving debris is the secondary energy element (R26).
- **Slams:** up to two (R82). TEETH is the hook's first statement (below); DIRTY's slam is optional. The r5 slam stands as built (R24): it takes grain and motion blur, no halation.
- **Hook state:** hook 1 of 7, the statement (TYPE §8 item 1): TEETH (54.66) is bitten into the apple on its onset (stamp and shake, the approved 55.00 still); on the next beat (55.20) it slams full-frame (film-black Archivo 62/900 stretched tall on a stone-yellow field, 2 inverted punch frames, stamp 1.3 to 1, stretch on the kick); on the 8th note a scalloped bite (his arch, #8's chip a flat notch) breaks a piece out of the word and it flies off; the slam holds until the next line's first word (55.63) with no orphan frame, then cuts back to the apple straight onto LATE, already readable. Line 4's cut on "And" (58.87) follows R39.

## 6 `uv`: 62.54 - 76.35, chorus 1 second half

- **Lines:** 62.54 Fight so dirty but your love's so sweet / 65.99 Talk so pretty but your heart got teeth / 69.44 Late night devil, put your hands on me / 72.68 And never, never, never ever let go
- **Story beats and exhibit:** the pillowcase from the bed (hem, open end and side seam readable; one label, EXHIBIT 5, on a tag), laid on the bench in the dark. A gloved hand sweeps a UV lamp (a short tube in a black housing with a handle) across it on the beat; where the violet beam passes, the dried saliva fluoresces fluor-white (R57: beam pool under ~30% of any frame), each sung word lifted by the beam from its readable floor (R23). "put your hands on me": the glove swabs the glowing trace, one stroke per word, and each stroke lifts the glow onto the swab (one continuous soft band per stroke along the swab's path; the only plate with a glove action per word, R56). "never, never, never ever": three sweeps, faster each time; on "let go" the beam holds still on GO and its glow decays slowly into the dark, compressed into its 0.43 s, about 25% left at the 76.35 cut (the one plate where the word fades by itself, R28). *sweet* is fluor-white Cormorant (R15). The only violet in the video (R9).
- **R57, plate 6 rules:** UV is a beam pool: the uv token covers under ~30% of any frame, and the rest stays film or film2. GO's decay is compressed into its 0.43 s (about 25% left at the 76.35 cut). No top-down view.
- **Value range (R13):** p1 ≤16. The peak is the uv token's glow; p99 ≥235 per shot, set from the r2 full pass (lead, 2026-11-24): the fluor-white words under the beam reach 255, and the key stills reach 242-255. A single frame between beam hits may sit lower (66.40, p99 91, inside a shot that peaks at 255).
- **Glove (R51):** `uv` keeps its own glove copy in `uv-glsl.ts`, the named temporary exception. After `uv`'s full pass, a kit chore ports this round's glove into `GLSL_HAND` (R86), and `uv` then imports the kit glove.
- **Approved stills:** none.
- **Hand-offs:** in: `scale` 62.54. Out: `chart` 76.35.
- **Owned compositions:** horizontal cloth, a moving beam, table-height oblique shots (never top-down, which is plate 3's). Slams are a shared idiom (R82).
- **Known carried:** the swab sleeve mass at 71.00 - 71.45; lone supporting words at ≥5% cap height with the lamp in frame (62.70, 64.60, 66.20, 67.60, 68.10, 69.80); the beam over the hem in two more setups.
- **Status:** scene approved / camera rework / type rework / light approved. **Round 1** (`65680b3`, brief `docs/gate3/brief-uv-r1.md`, clips `out/gate3/kinetic/uv-r1/`): lint 0 errors and 100% presence, `?uv_occ` 0 hits, macros 1.11-1.35x, 59 ms per frame; blind review uv-1 passes R83, P(doom) still wins energy. **Round 2** (brief `docs/gate3/brief-uv-r2.md`: realistic nitrile gloves, beam action on the beat, an in-world TEETH): the key-frame checkpoint is `acb8b18` (`out/gate3/kinetic/uv-r2/checkpoint/`); the lead and the client reviewed it on 2026-11-23 and approved the full pass with fixes folded in (gloves, TALK at 66.3 - 66.8, the R95 checklist; see the brief's "Checkpoint review"). The full pass goes into `out/gate3/kinetic/uv-r2/`.

#### Type card (filled by the lead 2026-11-22; round 2 deltas from `docs/gate3/brief-uv-r2.md`)
- **Surface:** the pillowcase. Words are dried saliva traces in the weave, baked in cloth space (`uv-type.ts`: coverage and id textures). Every sung word of the current line sits on a **readable floor** (R23): a dried stain at least 40 luma steps off the cloth around it, even outside the beam. The beam lifts it to fluor-white glow, and the glow sinks back to the floor, never to black, about 0.5 s after the beam leaves. A word shows at most 0.4 s before it is sung (R19). Supporting words are Archivo wide; heroes are Archivo condensed black (PRETTY included, R15); *sweet* is fluor-white Cormorant italic. The words report to the type probe through `kinRecord3D` on the cloth plane. Label: EXHIBIT 5 on the tag (whole, never cropped).
- **Line path:** each line is a compact block of two rows, one half-line per row, each row ending on its hero: "Fight so DIRTY / but your love's so SWEET". The whole line fits in title-safe at the line's framing (R34), so no first words are shed. Each line sits on its own part of the case (the hem, the open end, the side seam, the middle), so the cuts between lines also move across the exhibit. The beam walks the block word by word, snapping to each onset. The camera rides the line, not the beam (R34), one continuous move per line with its own framing family (R35).
- **Wrap/shed policy (R76):** none needed, because the block is sized so the line so far stays in title-safe at the line's framing. A line's first word: 8% cap height advised on its first frame; lone supporting words keep ≥5% with the lamp in frame. The lamp, the glove and the swab never cover a sung word for more than 2 frames (R29, the `?uv_occ` scan).
- **Hero position:** the end of each row, at hero scale (R21) on its onset. One hero macro per half-line (R36), as in `scale` r5: DIRTY | SWEET, PRETTY | TEETH (the slam counts as its half-line's macro), DEVIL | HANDS, NEVER | GO, at ≥1.2x the line framing (≥1.1x where the cloth forbids, reported; r1 built 1.11-1.35x). The macro opens on the hero's onset, already readable, with the line so far still in frame.
- **Kit moves:** a hero arrives thin and snaps heavy on its onset (the trace's erosion threshold is its weight and stamp), with a stretch on the kick. NEVER condenses on each "never" as the sweeps speed up. DEVIL leans. GO lands biggest, then decays.
- **Impact tiers (R37):** the instrument is the lamp; round 2 makes it work on the beat. The pool snaps word to word with a small overshoot and settle, and the uv token stays under 30% of any frame (R57).
  - **Tier 1** (hero onsets and the line openers 62.54, 65.99, 69.44, 72.68): the hardest lamp pump, the pool tightening, the glow flaring to the uv token, with up to 12 px of shake.
  - **Tier 2** (the other downbeats): a quick sweep across the line so far, the words it crosses flaring from floor to full and back, up to 5 px.
  - **Kicks:** the lamp pumps toward the cloth, the pool tightening and brightening, then easing back, graded below the hero's pump.
  - **Tier 3** (backbeats): a nudge of up to 2 px.
  - At most three tier-1 hits per chorus line (R37). Line 4 (three NEVER sweeps, each with a pump, then GO) is the tightest; the full pass's hit list checks it.
  - The hits build over line 2 into TEETH. The pattern differs from `scale`'s flashes on the same lines (R37): `scale` builds its flash on the heroes; `uv` lands its hardest hits on the sweeps and the openers.
- **Slams:** two, both on TEETH (R82, the whole budget). In the plate's world (R24): glowing trace on the cloth, with the plate's grain and motion blur; the glow obeys R11 (bloom only above 1.0, letter edges crisp).
- **Hook state:** hook 2 of 7 (TYPE §8 item 2).
  - On TEETH's onset (68.47), the camera slams into a macro of the weave, and TEETH is a full-frame glowing trace on the cloth, with fibre texture and fold shading in the glow.
  - On 68.80, a condensed copy flares over it, as a second trace or a re-excitation, never a translucent ghost.
  - The beam's sweep is the break line, a straight wipe edge of light across the word.
  - The slam holds until LATE (69.44) with no orphan frame, then cuts back to the cloth straight onto LATE, already readable. No flat title-card frames.
  - GO (75.92) is the one word that fades: the beam holds still on it and the glow decays to about 25% at the 76.35 cut (R57).

## 7 `chart`: 76.35 - 90.16, verse 2

- **Lines:** 76.35 Some days you're the best thing in my life / 79.75 Sometimes when I look at you, I see my wife / 82.71 Then you turn into somebody I don't know / 86.33 And you push me away, push me away, yeah
- **Story beats and exhibit:** a light plate, with the drums: a snare on every beat from 78.91. Her odontogram (32 teeth as a numbered diagram) on a light table (paper glowing from beneath, a dark table surround as the black anchor), filled in with a fine pen, strokes on the snares. "the best thing in my life": the chart fills with neat hairline fillings (solid film-black amalgam) and crowns. "I see my wife": the header is written in wax-pink Cormorant, *wife*, and the gloved hand signs **the monogram** under it (~83, large while signed). Under her chart, one corner of another chart shows (top-right, 12% of frame or less, teeth #6-#10, only #8 circled). "you turn into somebody I don't know": her chart's markings move on every beat, fillings jumping from tooth to tooth, crowns swapping, until it describes someone else (3-4 marks per beat with a visible ink lift). "push me away, push me away, yeah": her chart empties, one quadrant per phrase, until only the blank diagram is left, the corner beneath still mostly hidden.
- **Approved stills:** none.
- **Hand-offs:** in: `uv` 76.35. Out: `voice` 90.16.
- **Owned compositions:** the light table and chart. The polygraph owns the scrolling paper: the chart does not scroll it or write the lyric with its pen (R56).
- **Open (client, batch with R93):** whether her odontogram is an allowed exhibit (R47).
- **Known carried:** the shared glove's knuckle lumps (fixed by the kit glove port, R51, R86).
- **Status:** scene approved / camera rework / type rework / light approved.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO

## 8 `voice`: 90.16 - 103.98, pre-chorus 2

- **Lines:** 90.16 Call me in the morning to apologize / 93.04 Every little lie gives me butterflies / 97.07 Something in the way you're looking through my eyes / 100.52 Don't know if I'm gonna make it out alive
- **Story beats and exhibit:** forensic audio. Her voicemail ("Call me in the morning"), dubbed from the answering machine's microcassette onto quarter-inch tape across a splicing block; the bright waveform on the lab's monitor (oblique, with bezel and glass), scrolling under a playhead, a spectrogram beneath it (a real analysis, R60, below). A transcript lane on the monitor carries the supporting words, each at its time position, scrolling with the waveform. Each hero word sits in the waveform's envelope (per-letter height at least 0.85 of cap height, shared baseline). "Every little lie": **he makes the edit.** The gloved hand lays a razor in the block's 45-degree slot and cuts the tape on "lie"; the waveform splits at that instant with a slanted gap of silence (a dark 45-degree band through waveform and word); a strip of splicing tape (brought in by the glove, halide-white backing) joins it. "gives me butterflies": the two halves are slid against each other, failing to line up (offset by a few px). "looking through my eyes": the playhead scrubs back over the line, the waveform reversing. "make it out alive": the waveform swells to clip, its peaks flattened, and at 103.98 the flat top of the clipped wave match-cuts to the flat, level surface of wet stone. The playhead stays in the waveform lane.
- **R6, the splice is a clue:** the gloved hand makes the razor cut itself, so the lie is his.
- **R60 (client call):** the spectrogram is a real analysis of a separated vocal stem (`analysis/teeth/separate.py`), rebuilt in `voice-data.ts` at gate 4, never faked.
- **Approved stills:** none.
- **Hand-offs:** in: `chart` 90.16. Out: `pour` at 103.98 on ALIVE (match cut, R62).
- **Owned compositions:** the monitor and tape.
- **Known carried:** the spectrogram reads as a small grey noise patch; rebuild from the vocal stem.
- **Status:** scene approved / camera rework / type rework / light approved.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO

## 9 `pour`: 103.98 - 117.79, chorus 2 first half

- **Lines:** 103.98 Fight so dirty but your love's so sweet / 107.43 Talk so pretty but your heart got teeth / 110.88 Late night devil, put your hands on me / 114.12 And never, never, never ever let go
- **Story beats and exhibit:** stone in an impression of a set of teeth, unlabelled, on a dental vibrator table. **The table shakes on every stomp** (graded, R37): ripples run across the wet stone (stone yellow, R16) and bubbles rise and burst (no pouring ribbon, R61, below). Each hero word **sets in stone**, rising as a raised relief (Archivo condensed black, HEART's weight) and hardening from wet gloss to matt by its end; SWEET in wax pink set into the yellow. "heart got": the whole surface sets, gloss to matt in one wave; on "teeth" a hard cut (the time jump is the cut): the cast turned out of the impression, teeth in stone, the chip on #8, the maxillary pour filling the palate (it becomes the upper cast at 165). "Late night devil, put your hands on me": the cast sits still on the bench under a raking light that crosses it on each word, the relief words on its base hardening one by one, HANDS last (TEETH on the base matches HEART's weight). "never, never, never ever let go": the base is ground on a spinning model trimmer, a burst of stone dust on each "never", and on "let go" the trimmer stops dead and the dust settles. The cast is never front-on while closing (R48).
- **R61, scope guard:** no ray-marched pouring ribbon (the stone is already in; ripples, bubbles and relief).
- **Approved stills:** `2b-pour-heart-109.40.jpg`, `2-chorus2-pour-teeth-110.20.jpg`.
- **Hand-offs:** in: `voice` 103.98 (match cut). Out: `articulator` 117.79.
- **Owned compositions:** the poured stone and the model trimmer.
- **Known carried:** the turned-out cast's front teeth show slight gaps; cast frames lack lightbox-bright before the trimmer; the cast half runs 180 - 225 ms (likely the kit's `sdCast`).
- **Status:** scene unknown / camera rework / type rework / light unknown.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO

## 10 `articulator`: 117.79 - 131.60, chorus 2 second half

- **Lines:** 117.79 Fight so dirty but your love's so sweet / 121.24 Talk so pretty but your heart got teeth / 124.69 Late night devil, put your hands on me / 127.93 And never, never, never ever let go
- **Story beats and exhibit:** the casts mounted on a chrome articulator (one T-shaped upper arm hinged on the condylar axle between two rear posts, cantilevered forward over the casts; a single incisal pin at the arm's tip; each cast on a mounting disc), lit against a white studio card it reflects (a seamless sweep behind the set). A strip of articulating paper lies between the casts. On the non-hero beats the upper cast glides side to side and forward over the lower; each glide leaves film-black contact marks on the yellow cusps. **The casts close only on each line's hero word** (SWEET, TEETH, HANDS, GO), never front-on (R48). The words are engraved in the articulator's chrome (the arm's front cross-piece, a narrow bar) and flare to full where the swinging arm's reflection band crosses them, from a readable floor (R23, R59, below). "put your hands on me": the incisal pin drops into its guide table, one click per word. "never, never, never ever let go": three wide glides, and on "let go" the articulator swings open and the upper cast lifts away and out of frame (the only literal letting go).
- **R59, the reflection:** the lyric is engraved in chrome and lifted to full where a moving reflection band crosses it (above the R23 floor); the chrome face is never a uniform white field; the chrome needs the white studio card to reflect (a motivated fill, R12).
- **R78, proportions:** the 10% engraved bar is a physical proportion seen in the wide shot only; heroes reach R21 scale by the camera's push or a hero macro (R36, R40), not by enlarging the bar.
- **Approved stills:** none.
- **Hand-offs:** in: `pour` 117.79. Out: `luminol` 131.60.
- **Owned compositions:** chrome on a studio card (the engraved bar).
- **Known carried:** speed 110 - 124 ms per frame; the hero scale versus the bar's 10% height (settled by R78). The top-down shot with the bar across the casts is allowed at most once per line.
- **Status:** scene approved / camera rework / type rework / light approved.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO

## 11 `luminol`: 131.60 - 145.41, bridge

- **Lines:** 132.30 Blood on my shirt, rose in my hand / 135.70 You're looking at me like you don't know who I am / 139.23 Blood on my shirt, heart in my hand / 142.69 Still beating
- **Story beats and exhibit:** no drums. A dark evidence room; a man's shirt on a hanger (collar points, sloping shoulders, hanging sleeves, button placket, vertical drape), lit only by the reaction (R58, below). A gloved hand sprays luminol; the spray is invisible: only where it lands does blood glow blue, in one irregular soak of about 15% of frame width over the left chest, where his heart is (no spatter, no drips, no tear: his own wound), re-sprayed on each vocal phrase. The lyric is printed in Archivo on the clear face of a thin polyethylene evidence bag hanging in front of the shirt, lit only from behind by the glow, so each word is lifted by the stain from its readable floor (R23); hero words large (SHIRT, *rose*, WHO, HEART, BEATING). "rose in my hand": *rose* is wax-pink Cormorant, the one warm thing in the room. "You're looking at me like you don't know who I am": the bag's label in close-up, NAME:, and the gloved hand's pen stops; NAME stays blank, the bag still open. "heart in my hand / Still beating": the shirt glows and fades twice, a re-spray on each phrase. On the 143.69 downbeat the shirt is in the bag (the collar folded flat, its two points a V), the seal comes down, and the hand signs **the monogram** on the seal strip (about 25% of frame width as it is signed); hard cut.
- **R58, plate 11 light:** lit only by the reaction (its key, R12) plus a constant dim cold ambient; no key light, no light change between shots, no flash on the seal; nothing outside the bloom's reach rises above film2. Plate 11 (vertical hanging shirt, circling camera, glow fixed) stays apart from plate 6 (horizontal cloth, moving beam, table-height oblique shots).
- **R61, scope guard:** no visible mist or particles, no cloth fold (hard cut to the sealed bag).
- **Value range (R13):** p1 ≤16. The peak is the luminol glow; the p99 target is set at the next checkpoint.
- **Approved stills:** none.
- **Hand-offs:** in: `articulator` 131.60. Out: `acetate` 145.41 (hard cut after the signing).
- **Owned compositions:** the vertical hanging shirt and the evidence bag.
- **Known carried:** bag words self-lit (WHO's W 138.30, HEART's H 141.30): letter brightness should follow the glow with a halide floor; the bag a rigid box with a rail; the forearm at 143.80 a giant cylinder.
- **Status:** scene approved / camera rework / type rework / light approved.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO

## 12 `acetate`: 145.41 - 159.23, chorus 3a stripped

- **Lines:** 145.41 Fight so dirty but your love's so sweet / 148.87 Talk so pretty but your heart got teeth / 152.32 Late night devil, put your hands on me / 155.56 And never, never, never ever let go
- **Story beats and exhibit:** a dark desk under a single angled lamp; a 1:1 rectangular print (white border, black velvet edge) of plate 5's bite (the golden apple's flank (R16) with skin speckle, a specular band and curvature falloff, the scoop with a shadowed rim and groove striations, the ABFO L-scale with ticks), with a sheet of clear acetate taped over it (two frosted tape strips, a thin bevel only where the lamp pool reaches, the ink casting a faint offset shadow). A fine pen, held by the shared glove trailing behind and below the nib, traces **the six upper marks of `biteTrace()`**, unmirrored, #8's chip last (~158.8); the lower arc stays untraced. The lyric is **printed on the print and springs up on its onset** (R60, below); whole words, hero words large (the strongest vocal in the song is here; against R21 and R26's "small": open, client, batch with R93); SWEET and PRETTY in wax-pink Cormorant. The lamp's light kicks with the kicks at 152.37 - 152.99. In the last 0.4 s the glove lifts clear to the right so all six marks and the chip read; the pull-back (158.95) shows the bordered print, the apple's outline, the L-scale, tape and bevel.
- **R55, the tracing** (one object across plates 12 and 13): the six upper marks of `biteTrace()` (`match-ink.ts`), the chip on #8 last (~158.8). Plate 12 traces it unmirrored; plate 13 shows it mirrored because the sheet is turned face-down onto the casts. The lower arc stays untraced in the photograph.
- **R60 (client call):** the lyric prints on the print and springs up on its onset (the client's pre-approved fallback for a pen-uncovered lyric, in use).
- **Value range (R13):** peak lightbox (the desk lamp's pool on the white print; no glow token), p99 ≥235.
- **Approved stills:** none.
- **Hand-offs:** in: `luminol` 145.41. Out: `match` 159.23 (the tracing, R55).
- **Owned compositions:** the traced sheet over a print under a desk lamp.
- **Known carried:** the lyric laid in the print's perspective (it reads as a flat overlay); the grey hard-edged lamp patch at left (145.90, 150.40). Last fix round was lead-checked, with no review.
- **Status:** scene unknown / camera rework / type rework / light unknown.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO

## 13 `match`: 159.23 - 174.77, chorus 3b

- **Lines:** 159.23 Fight so dirty but your love's so sweet / 162.68 Talk so pretty but your heart got teeth / 166.13 Late night devil, put your hands on me / 169.37 And never, never, never ever let go
- **Story beats and exhibit:** drums back. The tracing (mirrored: the sheet is turned face-down onto the casts; the opening may show it landing) is laid over the top-down photo of one suspect's stone cast after another, **one per beat**, each arch visibly different (a gap, crowding, a missing tooth), each failing to line up. The last cast lands on the 164.41 downbeat ("heart"), slides into place on "got", and on "**teeth**" (165.16) locks, every tooth and last the chip on #8: it is the cast from plate 9 (a photograph labelled PHOTO 1:1). The lyric is written onto the acetate in the tracing pen's hand at the top of the sheet, so it stays readable while the casts flash beneath; TEETH is the largest word on the sheet. On 165.16 the traced outline and TEETH go **red**, the first red in the video, and the gloved hand signs the monogram into the cast label's blank NAME field, in red (NAME is the readable label at the lock). "Late night devil, put your hands on me": the red outline closes around one anterior tooth group per word. "never, never, never ever let go": the matched arch is walked tooth by tooth on the beat and ends on the chip as the stamp MATCH comes down on GO (MATCH readable only from GO, never with NAME in one frame; R50).
- **R55, the tracing:** the same object as card 12's, shown mirrored here; the lower arc stays untraced in the photograph; the red outline closes per anterior tooth group, one per word.
- **Labels (R50):** NAME (with the monogram) is the readable label at the lock; MATCH is readable only from GO, never both in one frame; the cast photograph's label is "PHOTO 1:1".
- **Approved stills:** `3c-match-suspect-163.00.jpg`, `3b-match-signing-165.55.jpg`, `3-chorus3-match-165.75.jpg`.
- **Hand-offs:** in: `acetate` 159.23 (R55). Out: `filed` 174.77.
- **Owned compositions:** the superimposition. This plate owns `GLSL_HAND` (`match-glsl.ts`); other plates import it (R51). After `uv`'s full pass a kit chore ports `uv` r2's glove into it (R86); re-check the gate 2 stills afterwards.
- **Known carried:** the chip at the lock is small at full frame; the opening may show the sheet landing face-down.
- **Status:** scene unknown / camera rework / type rework / light unknown.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO

## 14 `filed`: 174.77 - 204.96, outro

- **Lines:** 175.66 Teeth / 179.06 Teeth / 182.08 Teeth / 183.40 Never, never, never ever let go (ends 186.83)
- **Story beats and exhibit:** inside folder 08-32, open with the stack beside it, one cold pool from the tube (lightbox-bright at the centre to film-black). On each TEETH (175.66, 179.06, 182.08) one of his exhibits sits face-on past the camera and slides into the folder, the word TEETH set huge across it in black condensed Archivo with the red monogram beside it (R4, R9); each slam heavier and held longer than the last (R82) (about a third of TEETH's cap height, heavy stroke): his radiograph (backlit, R12: it swings past the tube so it reads bright teeth on a film-black base), his cast (stone yellow, R16; photographed on a white card so TEETH stays black on light), his full chart (face-on, #8 marked). "Never, never, never ever let go": the line is written on the folder's tab (the glove holds the pen) as it closes on them, the red draining out of the frame as it shuts (183.5 - 186.4, R9). The last TEETH (182.08) leaves with a move as this line takes over (R28, R82). 186.85 - 193.76 (no lyric, R31): the folder is carried by the glove down the cabinet bank, past drawers, and dropped into its drawer on a snare. 193.76 - 200.66, the last 4 bars of riff: the intro mirrored, the folders flicking **backwards**, one per real riff note, stopping dead in the riff's gaps, a dolly carrying the speed. At the hard stop (200.70) the drawer slides back to a hand's width open, 08-32 standing proud: the first frame. The tab settles with a slight swing, then stillness to the end.
- **Approved stills:** none.
- **Hand-offs:** in: `match` 174.77. Out: the loop to `drawer` (last frame ~204.9 matches `drawer` t=0 at at least 40 dB PSNR, R62).
- **Owned compositions:** the folder, the exhibits and the cabinet bank. The tube's louvre stays fixed (it was set at 12).
- **Known carried:** TEETH at 175.95 (raise a touch so the letter feet sit on the bone band); a faint edge on the glove holding the backlit radiograph. Last fix round was lead-checked, with no review.
- **Status:** scene unknown / camera rework / type rework / light unknown.

#### Type card (TODO)
- Surface: TODO
- Line path: TODO
- Wrap/shed policy: TODO
- Hero position: TODO
- Kit moves: TODO
- Impact tiers: TODO
- Slams: TODO
- Hook state: TODO
