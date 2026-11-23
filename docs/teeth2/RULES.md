# Teeth v2: the rules

The one place a rule lives. When a rule changes, its text is replaced here and the ledger (`docs/TEETH2-LEDGER.md`) records why. Dead text is deleted, never struck through. Built 2026-11-21 from the treatment, ledger, builders' brief, handoff, the gate 3 briefs and reviews, and `docs/doc-review-2026-11-21.md`. The earlier files are kept in `docs/teeth2/archive/`.

## Precedence

When two texts disagree, the higher one wins:

1. **Client calls**, latest first (dated in the Source column; the ledger records them).
2. **This file** (RULES).
3. **The ledger** (`docs/TEETH2-LEDGER.md`): settled rulings and review history.
4. **Plate cards** (`PLATES.md`).
5. **Briefs** (`docs/gate3/`): they carry plate deltas only and cite rule IDs.

A settled ruling stays settled unless a later client call conflicts with it (R64).

## How to read the tables

Columns: **Rule** (the text), **Scope** (the plates or sections it covers), **Purpose** (what it protects), **Test**, **Source**.

Tests: **lint** = the frame checker (`app/scripts/lint.ts`); it does not yet see Teeth's type (type is painted into textures), so a lint test on type is **pending** until the `kinetic.ts` probe exists (see `HANDOFF.md`). **histogram** = a palette histogram on a sheet (pending, not built). **measured** = a number taken from a render (a cap height, a width, a time, ms per frame). **eye** = a reviewer looks.

---

## A. Concept

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R1 | **No repeated visuals.** No plate, shot, trick or exhibit appears twice. Repeated lyrics (two pre-choruses, six chorus halves) get different exhibits and instruments. Nothing from v1 (jaws snapping on words, Rorschach cards, sheets with words in them, the ring, the blooming-rose stain, handprints, the spring-back camera, the clamp). The one deliberate echo is the bookend drawer (plates 1 and 14), mirrored, 4 bars each way. | all | no v1 repeats | eye | client notes on v1; ledger "Settled" |
| R2 | **Every image makes sense**, at a glance and in forensic logic. Each light, shake or flash has a source in the scene. Nothing decorative that reads as debris. | all | clarity | eye | client notes on v1; treatment rule 2 |
| R3 | **The concept is fixed.** A forensic odontologist builds a bite-mark case against the woman he loves, and the bite is his. The narrator is the examiner; every plate is an exhibit from case 08-32 · BITE MARK in its own forensic technique. Three choruses are three methods (bite-mark photography, the stone cast, the superimposition match). The video loops (opens and closes on the steel drawer). The ending is silent after the hard stop (200.70). The reading is Eden reversed, implied and never "he killed her". CSI-familiar exhibits stay mixed. | all | story | eye | client 2026-11-17 (gate 1, taste calls 5, 7, 9) |
| R4 | **The monogram is T.F.**, a single-stroke mark signed by the gloved hand on a beat, only where a signature goes: the film's tag (~9.9), the chart (~83), the bag seal (143.69), then the matched cast's NAME field (165.16) and the filed exhibits. Name fields stay blank until 165.16 (polygraph SUBJECT, the bag's NAME). | 2, 7, 11, 13, 14 | the twist | eye | client 2026-11-17 (taste call 1); ledger "Settled" |
| R5 | **Tooth #8's chip** (upper right central incisor, a diagonal chip off its inner corner) shows in the radiograph, the apple's bite, the poured cast and the tracing, and is the last thing to lock at the match. Every plate builds teeth from `app/src/teeth2/teeth.ts` (one tooth set, no private anatomy). Each suspect is a visibly different `archVariant`, never with the chip. | 2, 5, 9, 12, 13, 14 | the clue chain | eye | ledger Gate 2 review 1 |
| R6 | **The voicemail splice is a clue:** the gloved hand makes the razor cut itself (plate 8), so the lie is his. | 8 | second-viewing clue | eye | client 2026-11-17 (taste call 8) |
| R7 | No title card or credits on screen (credits go in the README). No YouTube upload; nothing is published without asking. | all | scope | eye | client (handoff, "Client decisions") |

## B. Palette and light

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R8 | **Palette tokens only** (`app/src/teeth2/palette.ts`; tints and shades of them are allowed): film `#070A10` (ground), film2 `#0F1520` (panels, deep shadow), silver `#6E7682` (hairlines), halide `#A9B0B8` (unsung type), lightbox `#F1F3EE` (cold white, crisp), uv `#6A2CFF`, fluor `#CFF4FF`, luminol `#3FA9FF`, wax `#E58FA0` (tender register), stone `#E8C35A` (apple and casts), tungsten `#FFB46A`, match `#FF2A1F`. Light plates (polygraph, chart) invert to lightbox white with film-black ink. | all | one look | histogram (pending) | client 2026-11-17 (palette 2A) |
| R9 | **Colour locks.** UV violet appears in plate 6 only, only where the lamp is on. Luminol blue in plate 11 only. Tungsten in plate 3 only (R14). Red only from 165.16 to the folder closing (~186 s) (R10). | 6, 11, 3, 13-14 | each colour means one thing | histogram (pending) | client 2026-11-17; ledger "Settled" |
| R10 | **Red** is the traced outline, TEETH, the monogram and the stamp, nothing else. It is full match red at a readable stroke weight, never a dim hairline. It drains as the folder closes (~183.5-186.4, visibly, not in 0.2 s). No full-frame red flood. The ring around the chip at the lock is drawn in film ink, not red. | 13, 14 | the one payoff | histogram (pending), eye | client 2026-11-17 (taste call 3); ledger rulings review 2 and batch review 4; lead 2026-11-21 (the hook plan's every-8th red copies in `match` are cut) |
| R11 | **Only uv, fluor, luminol and match may glow or bloom.** Bloom only above 1.0, so lightbox white stays crisp; halation tint is cold, never warm. No bloom orbs on non-glow materials: lamp reflections are crisp shapes; depth of field leaves no grainy halos on silhouettes. | all | no neon, no slop | lint, eye | treatment rule 6; ledger review 2 |
| R12 | **Light.** Each plate has one hard source and real blacks (film); a light event lands on each money moment (the first flash, the cut to the cast, the lock). Radiographs are always backlit (plates 2 and 14). Plate 14's radiograph swings past the tube so it reads bright teeth on film-black. | all | physical light | eye | ledger Gate 2 review 1; batch review 4 |
| R13 | **Value range, per shot.** Every shot reaches film-black and its plate's peak (lightbox, or the glow token in `uv`, `luminol` and `acetate`). A shot of mid-tones only is a defect. | all | no mid-tone mush | histogram (pending), eye | lead 2026-11-21 |
| R14 | **Tungsten is illumination, never surface colour.** Plate 3 only: a clear amber falloff from one side of frame, a bedside lamp's memory of the room, under the cold work light. The bedding stays white; no brown mottling or brown shadows (stakes guard). Never near 165.16. | 3 | the one warm plate | eye, histogram (pending) | client 2026-11-19 (gate 2 call 2); ledger batch review 2 |
| R15 | **The tender register** (*sweet*, *pretty*, *rose*, *wife*) is wax-pink Cormorant Garamond italic. Exception: in plate 6 *sweet* is fluor-white Cormorant, like every word under the UV lamp. | all; 6 | tender voice | eye | treatment; client 2026-11-20 |
| R16 | **The apple is golden**, in stone yellow (the bite and the cast share a colour), a true apple silhouette with stem well and stem, so the wax-pink tender word still separates. The older "deep, desaturated wax skin" ruling is dead. | 5, 12, 14 | link bite to cast | eye | client 2026-11-19 (gate 2 call 3) |

## C. Typography and kinetic type

Vocabulary, layout and the hook plan are in `TYPE.md`.

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R17 | **Fonts.** Archivo (width 62-125, weight 300-900): his voice, the sung lyric; wide and light in the verses, condensed and black on the hits. IBM Plex Mono: the lab, inside objects only. Cormorant Garamond italic: the tender register (R15). Single-stroke fonts: words drawn by a pen (polygraph, acetate) and the monogram. | all | identity | eye | treatment; client 2026-11-19 |
| R18 | **Type craft.** Kerning and typographic punctuation (curly quotes, never straight); no outlined or haloed type; everything inside title-safe (96 px). | all | craft | lint (pending), eye | `TREATMENT.md` craft rules |
| R19 | **Karaoke timing.** A word lights at its `start` (letters spring ~45 ms ahead) and completes by its `end`. Nothing shows more than 0.4 s early. No fade-in entrances. A word caught mid-write between `start` and `end` is correct. | all | sync | lint (pending), measured | treatment; ledger batch review 2 |
| R20 | **States.** Unsung words at halide ~35%, sung words lightbox white, the hero in its plate's idiom; the hero also snaps from light to heavy weight on its onset. | all | read the line | eye | client 2026-11-19 (gate 2 call 1) |
| R21 | **One hero word per line**, readable at a glance, inside title-safe, held from its start to its end. **Hero scale:** cap height at least 20% of frame height, *or* the word spans at least 30% of frame width, whichever comes first. Exempt: the stripped chorus 3a (`acetate`) and the bridge (`luminol`), where the section's energy sets the hero. Small heroes are a defect. | all; exempt 11, 12 | no small heroes | measured | ledger batch review 4; lead 2026-11-21 |
| R22 | **Supporting words** are physical things in the plate's world, never flat captions, and keep a cap height of at least 5% of frame height (8% advised on a line's first frame). Only heroes may go full-frame graphic. | all | legibility | measured | treatment; lead 2026-11-21 |
| R23 | **Legibility floor (reveal-by-light plates).** Sung words of the current line never drop below readable: halide-level contrast and a cap height of at least 5%. The plate's light (UV beam, luminol glow, articulator reflection, backlight) lifts them from the floor to full; it is never the only thing that makes a word readable. Named exception: GO's slow decay in `uv` (R57). | 2, 6, 10, 11 | reveals without lost words | measured, eye | client 2026-11-21 (call 1) |
| R24 | **Slams.** A hero may break out as a full-frame graphic slam: flat palette fills in Archivo 900, no outlines or halos. A slam takes the plate's grain and motion blur but **no halation glow** (a slam returns `halation: 0`). | heroes | P(doom)'s hook idiom | eye | client 2026-11-20 (kinetic type); lead 2026-11-21 |
| R25 | **Both layers, one kit.** Supporting words stay in the plate's world (bitten, engraved, written, printed, glowing) but move like motion graphics on that surface. Every move comes from `app/src/teeth2/kinetic.ts` and is keyed to the beat grid and the kick and snare onsets in `audio.json`. | all | motion-graphics type | eye | client 2026-11-20 |
| R26 | **Energy escalates:** verses low, pre-choruses rising, choruses maximal, the stripped chorus 3a eerie (hairline weights, small and slow, lots of black), the bridge and outro falling (slow tracking and drift, the last words held). Table in `TYPE.md`. | by section | build | eye | client 2026-11-20 |
| R27 | **Break.** A hero's letters may split along the plate's own motif (bite scallops, the razor's diagonal, a pen stroke, a crack in stone), never into drips, blots, blobs or spatter. | heroes | stakes | eye | client 2026-11-20; R45 |
| R28 | **Exit.** When a line is replaced it leaves with a move on a beat (collapse, slide-out, wipe, or swallowed by the next cut), never a fade or a hard pop. The only fade is GO's decay in `uv`. | all | motion | eye | client 2026-11-20; R32 |
| R29 | **No word is clipped mid-word** while its line is on screen. A word reaching a lane's edge stops there (words stack against the edge) until its line leaves; a line too long for its band may shed its first words only as whole words, on a beat. | all | no cropped words | lint (pending), measured | ledger batch review 4 (voice); brief r2b item 2 |
| R30 | **The TEETH hook.** TEETH in each "got teeth" line is one recurring slam whose look escalates on each return. The plan is in `TYPE.md`. | 5, 6, 9, 10, 12-14 | the hook | eye | client 2026-11-20 |

## D. Lyric-led camera and impacts

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R31 | **The lyric is on screen while it is sung.** From the first sung word (7.23) to the last (186.83), every frame carries the current line: built word by word as it is sung, sung words staying, the line held until the next line takes over on the beat. Presence threshold: R83, R85. | 2-14 | the P(doom) bar; round 1 had 13 of 30 empty frames | lint (pending probe), measured | client 2026-11-21 |
| R32 | **Gaps.** The last line holds through a gap of up to about 2 bars (about 3.5 s), then clears on a beat, so set pieces play clean if they run longer. | 2-14 | no dead air, no clutter | measured | client 2026-11-21 (call 3) |
| R33 | **Lyric-free stretches:** the intro (0 - 7.23), the outro carry (186.85 - 193.76) and the closing riff (193.76 on) have no lyric. The folder tab's written "never let go" may show as an in-world label. | 1, 14 | the loop | eye | client 2026-11-21 (call 4) |
| R34 | **The camera follows the type.** Each line is the subject of its shot. The camera moves with the words as they arrive (riding along the line as it is written, bitten, engraved or lit), pushes into the hero on its onset (eased; R40), and keeps the newest word in the frame's sweet spot. The scene plays around and behind the line. | 2-14 | P(doom)'s grammar | eye | client 2026-11-21 |
| R35 | **One continuous move per line:** a smooth spline that eases into the downbeats, with no direction reversals and no snapping between unrelated framings. | 2-14 | no whiplash | eye | client 2026-11-21 |
| R36 | **Type-led reframe inside a line.** A cut or reframe inside a line is allowed only when the type carries it: the new framing opens on the word being sung, already readable, with the line so far visible or re-established within 2 frames. At most one per line in verses and one per half-line in choruses. Never on every beat, never to an unrelated view. | 2-14 | keeps the protection of R35 | eye, measured | client 2026-11-21 (call 2) |
| R37 | **Impacts are graded, never a uniform pulse.** The beat lands as an impact inside the shot (an exposure kick, a nudge or shake of a few pixels, a stamp, a stretch), not as a new shot. Downbeats strong, backbeats light, each line's hero the strongest, building across a section. Stretch on kicks, condense on snares and track on beats are small hits and obey this grading. | all | the beat without whiplash | eye | client 2026-11-21 (graded impacts) |
| R38 | **Instrument hits** (`scale`'s flash, `uv`'s lamp, `pour`'s trimmer) fire on moments that mean something, the hero onsets and chosen downbeats, not on every beat; the beats between carry smaller hits. Each hit reveals the type rather than washing it out: `scale`'s flash is a hard side flash that throws the carved letters into shadow and edge light, not a whole-frame white pop. No flash before 48.73. No two repeats of a line use the same hit pattern. | 5, 6, 9, all | no wash-out | eye | client 2026-11-21; ledger "Settled" |
| R39 | **Cuts only between lines.** A cut lands on the downbeat nearest the new line's first stressed word. Pickup words sung before that downbeat appear in the outgoing shot as the head of the new line, or the type carries the cut (a match on a word, a slam that takes the cut with it, the camera following a word into the next world). A hero slam may cut to full frame and back. | 2-14 | cut rhythm with pickups | measured, eye | client 2026-11-21 (camera 4); lead 2026-11-21 |
| R40 | **Constant motion.** Something happens every bar; big changes land on downbeats; hits on the kick and snare. No breathing zooms, no rush at the camera, no screensaver drift. A push into a hero is eased over the word's whole duration and into the downbeat, never faster than the eye can follow (R80). | all | P(doom)'s energy | eye | treatment rule 4 (as amended); brief r2b item 3 |
| R41 | **Plates may be re-staged** to give the line a path (a band around the apple, a row along the jaw, a trace across the paper), provided the exhibit, palette, stakes guards and approved still times hold. At each approved still's time the frame still reads as that still (same composition, type and colour; small motion differences are fine). | all | story intact | eye, PSNR flag (pending) | client 2026-11-21; briefs, gate 2 plates |
| R42 | **Blind review.** Before the client sees a lyric-led prototype, a fresh reviewer judges it blind against P(doom) at matched energy from unlabelled 8 fps strips in random order, and must not prefer P(doom) on lyric presence, legibility or camera flow. Pass and fail: R83. | prototypes | the bar | eye | client 2026-11-21 |

## E. Stakes guards

The crime stays implied and never reads as violence to her.

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R43 | No gore, horror, wounds, faces or realistic eyes. People are present through gloved hands, marks and their teeth. Nothing reads as an eye (a lamp disc at the lock did). The case is a bite mark, not a killing. | all | tone | eye | treatment rule 5; ledger review 3 |
| R44 | **The bed reads as left, not as harm:** covers thrown back as by someone getting up, the other pillow bare, no body shape, outline or stain. DEAD is a neutral marker. | 3 | stakes | eye | client 2026-11-17; client 2026-11-20 |
| R45 | **No drip, blot, blob or spatter anywhere**, ink included, and the ruling covers models, glows and tears: paper tears are narrow slits, never holes; a stain is a soak shaped by the weave and folds, never a soft cloud; the glove has no sphere or blob parts. | all | stakes | eye | ledger batch 1, 2, 3 |
| R46 | **The only blood** is one bloom over the heart of *his* shirt (no spatter, no drips, no tear). | 11 | stakes | eye | client 2026-11-17 |
| R47 | **Nothing of hers is damaged or found.** The exhibits are only things she touched (the apple, the pillowcase, the voicemail) and his own things (the shirt, the cast, his chart). | all | stakes | eye | client 2026-11-17 |
| R48 | **Casts are never front-on while closed or closing** (plates 9, 10, 13). Closures are shot in profile, three-quarter, or from at least 45 degrees above, so a closed cast never reads as a grinning mouth or v1's snapping jaws. | 9, 10, 13 | stakes, R1 | eye | ledger batch review 3 |

## F. Craft

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R49 | **No HUD, counters or readouts.** No on-screen number ever changes value. Lab text lives only inside objects. The engine HUD is off in every render. | all | v1 complaint | lint (HUD off only), eye | client notes on v1 |
| R50 | **Labels:** at most one readable label per *frame*, never along the bottom edge. Plate 13: NAME (with the monogram) is the readable label at the lock, MATCH is readable only from GO, never both in one frame; the cast photograph's label is "PHOTO 1:1". | all; 13 | clean frame | eye | lead 2026-11-21; ledger Gate 2 review 1 and 2 |
| R51 | **One glove.** Every plate imports `GLSL_HAND` from `match-glsl.ts` (or matches it exactly): a single matte film2 nitrile glove, segmented fingers, a cuff, lit only by its plate's source; never a black mass, never a sphere or blob. The polygraph's machine pens are the only exception to "a hand does it". | all | one hand | eye | ledger batch 2, 3 |
| R52 | **Every pen-written lyric and every carried object shows the shared glove doing it.** The glove stays clear of finished marks. | 4, 7, 12, 13, 14 | the hand is his | eye | ledger batch review 4 |
| R53 | **One pen hand** (a technical single-stroke hand, not cursive) for everything a pen writes (polygraph, acetate, match). The signature is the one exception: the T.F. mark stays a slanted signature, drawn **with its two full stops** (monogram strokes 3-4, tapped as the signing completes). | 4, 7, 12, 13 | one hand | eye | ledger Gate 2 review 2; client 2026-11-19 (gate 2 call 5) |
| R54 | **Bite photography:** the lens is perpendicular to the bite with the scale in the bite's plane (every shot of the bite in plate 5). Exhibits are numbered in plate order: radiograph 1, bed 2, polygraph 3, apple 4, pillowcase 5, chart 6, voicemail 7, cast 8. | 5 | forensic logic | eye | ledger Gate 2 review 3 |
| R55 | **The tracing is one object across plates 12 and 13:** the six upper marks of `biteTrace()` (`match-ink.ts`), the chip on #8 last (~158.8). Plate 12 traces it unmirrored; plate 13 shows it mirrored because the sheet is turned face-down onto the casts. The lower arc stays untraced in the photograph. In plate 13 the red outline closes per anterior tooth group, one per word. | 12, 13 | the match | eye | ledger batch review 4; Gate 2 review 1 |
| R56 | **Ownership.** A plate owns a composition together with its exhibit: plate 3 owns fabric from above and the only words on standing cards or signs; the polygraph owns the scrolling machine trace (the chart does not scroll the paper or write the lyric with its pen). One-offs: one butterfly sequence only (plate 4, a tremor of all four pens, no wing shapes; plate 8 has no wings); "put your hands on me" as a glove action per word in plate 6 only; "let go" as a literal release in plate 10 only; no "push me away" image shoves anything. The kinetic slam is a shared idiom, not owned (R82). | 3, 4, 6, 7, 8, 10 | R1 | eye | ledger "Settled", batch 1 and 3 |
| R57 | **Plate 6 (`uv`):** UV is a beam pool; the uv token covers under ~30% of any frame, the rest stays film or film2. GO's decay is compressed into its 0.43 s (about 25% left at the 76.35 cut). Avoid the top-down view. | 6 | no violet flood | measured, histogram (pending) | ledger batch review 1 |
| R58 | **Plate 11 (`luminol`):** lit only by the reaction plus a constant dim cold ambient; no key light, no light change between shots, no flash on the seal; nothing outside the bloom's reach rises above film2. Plate 11 (vertical hanging shirt, circling camera, glow fixed) stays apart from plate 6 (horizontal cloth, moving beam, table-height oblique shots). | 11 | R1, R45 | histogram (pending), eye | ledger batch review 2, 3 |
| R59 | **Plate 10 (`articulator`):** the lyric is engraved in chrome and lifted to full where a moving reflection band crosses it (above the R23 floor); the chrome face is never a uniform white field; chrome needs a white studio card to reflect. | 10 | R23, R1 | eye | ledger batch review 3 |
| R60 | **Client calls on single plates.** Plate 4: THROUGH MY EYES from beneath stays readable, not mirrored (a deliberate cheat). Plate 8: the spectrogram is a real analysis of a separated vocal stem (`analysis/teeth/separate.py`), rebuilt in `voice-data.ts` at gate 4, never faked. Plate 12: if the pen-uncovering lyric does not read after one attempt, words print on the print and spring up on their onset (the fallback is pre-approved and now in use). | 4, 8, 12 | taste calls | eye | client 2026-11-20 |
| R61 | **Scope guards.** `pour`: no ray-marched pouring ribbon (the stone is already in; ripples, bubbles and relief). `luminol`: no visible mist or particles, no cloth fold (hard cut to the sealed bag). `scale`: the bite is pre-modelled, only the letters animate. | 5, 9, 11 | keeps hard parts from looking cheap | eye | treatment, scope guards |
| R62 | **Hand-overs and the loop.** `filed`'s last frame matches `drawer`'s t=0 at >= 40 dB PSNR. `voice` match-cuts into `pour` at 103.98 (the clipped wave's flat top to the wet stone surface). `acetate` hands the tracing to `match` (R55). The other hand-offs go in the transitions table (R87). | 1, 8, 9, 12, 13, 14 | seamless cuts | measured | briefs, gate 2 plates; treatment |

## G. Process

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R63 | **Precedence and supersession.** The order is at the top of this file. When a rule changes, replace its text here; delete dead text in the old files (leave a pointer in the ledger); a later call that supersedes an earlier one leaves only the current rule. | all docs | no dead rules | eye | doc review 2026-11-21 |
| R64 | **Settled rulings stay settled unless a later client call conflicts.** A reviewer who finds a conflict reports it to the lead and enforces neither. Taste calls go to the client, not to builders. | all | no re-raising | eye | lead 2026-11-21 |
| R65 | **Gate flow.** Gate 1 treatment (approved 2026-11-17), gate 2 stills (2026-11-19), gate 3 a contact sheet of every plate, gate 4 a 1080p rough cut, gate 5 the 4K60 final. After the client approves a gate: update `HANDOFF.md`, commit, push, open the gate's PR (`teeth-v2` to `main`; the client merges), and remind the client to start a new session. | process | gates | eye | client; handoff |
| R66 | **A fresh builder per plate and per round**, with a short brief. Never resume a finished builder, or one whose history is past ~300k tokens. An agent stopped by a limit resumes with SendMessage, not a new spawn. | builders | cost | eye | client 2026-11-19 (economy plan) |
| R67 | **Pace the work.** Check usage before heavy or parallel work and between rounds. Above ~70% of the 5-hour window start no new agents; checkpoint (commit, or write state to a file) and say how long until the reset. At most two parallel agents. A big task that will not fit is split across windows. The weekly limit is not a reason to pause; the 5-hour rule still holds. | all | no mid-task stops | eye | user's global preference; client 2026-11-20 |
| R68 | **Economy plan** (approved 2026-11-19): Sonnet 5.5 (high) builds graphic plates (`polygraph`, `chart`, `voice`, `acetate`, `scene`); Opus 5.5 (high) builds 3D and lighting plates (`uv`, `articulator`, `luminol`, `filed`) and extends the five gate 2 plates; batch reviewer Opus high; cut-level reviewer Opus xhigh at gate 4; chores Sonnet low. No Fable. Superseded where it differs by R91. | staffing | cost | eye | client 2026-11-19 |
| R69 | **Review policy.** At most two review rounds per plate at gate 3 (the single policy). The lead checks frames between rounds; one fresh Opus reviewer per batch judges a contact sheet, not every still. A reviewer reads the ledger first and does not re-raise settled items. The cut-level reviewer works at gate 4. | gate 3 | cost | eye | lead 2026-11-21; handoff |
| R70 | **Gate 3 standard (block-in).** Build the whole plate window (`PLATES` in `timeline.ts`): every lyric line, every beat of the plate card, something happening every bar. Timing comes from `data/teeth/lyrics.json` and `audio.json`, never hard-coded; check every scripted time against the data. Block-in quality: forms, light, composition, timing and motion read at a glance; nothing broken, placeholder-looking, flat or clip-art; polish waits for gate 4. Run the frame checker on the window (`bun scripts/render.ts lint --song teeth --only <id> --from A --to B --url http://localhost:5193`) and fix every error. Deliverable: a contact sheet (one frame per bar, each money moment, the approved still times) plus at most one clip of the hardest moment (4 s or less). Budget about 15 renders. The report is short (about 150 words, plus the files, ms per frame, and known weaknesses). | builders | gate 3 | lint, eye | builders' brief, gate 3 standard |
| R71 | **Speed.** Gate 3: at most 200 ms per frame at 1080p, and report the figure. The real budget is measured at gate 4 with a 4K test render per plate (`--samples auto`), then a whole-video budget, slowest plates first. | all | final render time | measured | lead 2026-11-21 |
| R72 | **Environment and files.** Windows, Git Bash: `source out/env.sh` puts bun and ffmpeg on PATH. Render from `app/` with `--url http://localhost:5193` (a dead port, so render.ts starts its own server) and `--out` an absolute fresh folder; typecheck with `bun x tsc --noEmit -p tsconfig.json`. One GPU is shared by up to two builders: stills and short low-res clips only. A builder edits only its plate's files (`app/src/teeth2/scenes/<id>*.ts`); `timeline.ts`, `song.ts`, `palette.ts`, `teeth.ts`, `monogram.ts` and `match-glsl.ts` are read-only (ask the lead), `kinetic.ts` takes additions only, and `app/src/engine/` is never edited (say so in the report). Do not commit, push or switch branches; the lead commits. | builders | no collisions | eye | builders' brief |
| R73 | **Prove cross-cutting changes on prototypes before fan-out**, including the hardest case (a reveal-by-light plate, a light plate), with a key-frame checkpoint (the set, light, materials and type card at 4-6 key frames) before each full-window build. | lead | avoid rework | eye | client 2026-11-20 (prototype first); doc review section 6 |
| R74 | **Briefs and reports.** A brief cites rule IDs and carries only the plate's deltas, never restated rules. A builder reports files written, still paths, what is final and what is stubbed, ms per frame, honest weaknesses and any engine or palette change needed. | lead, builders | no drift | eye | doc review section 4 |

---

## Where each review contradiction (C1-C22) is resolved

| C | Resolution |
|---|---|
| C1 line lifetime | R31, R32, R33 (hold up to ~3.5 s, then clear on a beat; outro carry has no lyric). Set pieces: R75. |
| C2 words on screen | The "1-4 words" rule is deleted. R31 (whole line built word by word). Wrap/shed: R76. |
| C3 camera grammar | R34-R36, R39, R40 replace rule 4's sub-cuts and every per-beat cut; each plate's camera status is "rework" in `PLATES.md`. |
| C4 pickups | R39. |
| C5 reveal-by-light | R23, R59. |
| C6 halation on a slam | R24 (grain and motion blur, no halation). |
| C7 red | R10 (outline, TEETH, monogram, stamp; every-8th copies cut). |
| C8 full stops | R53 (with two full stops; the "without" ruling is dead). |
| C9 apple colour | R16 (golden; the wax-skin ruling is dead). |
| C10 *sweet* | R15 (fluor-white in plate 6). |
| C11 acetate and match paragraphs | R55, R60; `PLATES.md` cards 12 and 13 carry the current versions (spring-up lyric, six upper marks, per anterior tooth group). |
| C12 labels | R50 (per frame). R88. |
| C13 frontal heroes | R56 (the slam is a shared idiom); confirmed by R82. |
| C14 value range | R13 (per shot). |
| C15 hero scale vs stripped section | R21 (exempt 3a and the bridge), R22 (one 5% floor, 8% advised). |
| C16 articulator numbers | R78. |
| C17 reviews | R69 (two rounds). Cut-level reviewer: gate 4 (R69); blind review: R83; gate 3 look: R84. |
| C18 graded impacts | R37, R38. |
| C19 critic checklist | `CHECKLIST.md` replaces it for Teeth; tests marked pending where the probe is missing; lint's known false hits: R89. |
| C20 handoff stale | `HANDOFF.md` rewritten as state only. |
| C21 speed | R71. |
| C22 push vs rush | R40 (eased over the word); numeric limit: R80. |

## H. Lead decisions on the open questions (2026-11-21; binding)

The consolidation left 17 questions open; the lead settled them. They are numbered on from R74 and rank as RULES.

| ID | Rule | Settles |
|---|---|---|
| R75 | **Set pieces clear the line.** Gaps of up to about 2 bars hold the last line (R32), **except** where a plate card names a set piece in the gap: then the line clears on the beat after its last word and the set piece plays clean. Named set pieces: the tag signing (9.34-10.79, `lightbox`). The gaps 23.11-24.49 and 78.41-79.75 hold unless their cards name one. | Q1 |
| R76 | **Wrap and shed.** A long line is set in up to three rows on its surface (as `scale` r2b does), the camera framing the line so far. If it still cannot fit at the R22 floor, its earliest words shed as whole words on a beat, always keeping the hero and at least the last four sung words. Each type card states which. | Q2 |
| R77 | **Pickups.** A line's cut lands on the downbeat nearest the start of its first word that lies within 0.12 s of a downbeat; if none does, on the downbeat nearest the line's first word. The brief names the time; the builder checks it against `audio.json`. | Q3 |
| R78 | **Articulator proportions.** The 10% engraved bar is a physical proportion seen in the wide shot only; heroes reach R21 scale by the camera's push, not by enlarging the bar. | Q4, C16 |
| R79 | **Impact tiers (ceilings, builders may go lower).** Tier 1 (hero onsets and the section's chosen downbeats, about one a bar at most): the instrument hit, a stamp, a shake of up to 12 px. Tier 2 (other downbeats): a stretch or a light change, a nudge of up to 5 px. Tier 3 (backbeats): up to 2 px, or a type-only move. | Q5 |
| R80 | **Push into a hero:** at most a 20% change of framing scale over the word, eased over at least 0.4 s. Faster or larger reads as a rush at the camera (R40). | Q6, C22 |
| R81 | **The sweet spot:** the newest word's centre in the middle third of the frame, with lead room ahead in the reading direction, and the line so far inside title-safe. | Q7 |
| R82 | **Slams are a shared idiom,** not owned; the ledger's "plate 5 owns frontal centred heroes" is dead. **Slam budget:** at most two full-frame slams per chorus plate (TEETH counts as one), at most one per verse or pre-chorus plate, none in the bridge. `acetate` has no slam: its TEETH is small and hairline (P(doom)'s eerie hook 3). The `match` slam is one red TEETH on the 165.16 lock, designed on its type card. | Q8, Q9, C13 |
| R83 | **Blind review pass:** lyric presence of at least 95% of sung frames (measured by the probe once it exists), and the reviewer does not prefer P(doom) on presence, legibility or camera flow; energy and finish are reported, not gated. It covers the next plate types (`scale`, `uv`, `chart`); after that, the probe plus a lead spot-check replace it. | Q10 |
| R84 | **Cut-level look at gate 3:** the lead presents gate 3 with a 2 fps strip of the whole song, and the last batch reviewer judges it for rhythm and repeats. The full cut-level reviewer works at gate 4. | Q11 |
| R85 | **Done for gate 3:** lint clean with the Teeth checks; presence of at least 95%; the approved still times compared with the gate 2 JPGs; both hand-offs rendered; no palette lock broken; ms per frame under R71; a review with no rule FIX left. **REWORK** = the plate's core read fails; **FIX** = rule or timing defects; **SHIP** = polish only. | Q12 |
| R86 | **Kit defects** found in a batch review are fixed by a Sonnet chore, assigned by the lead, before the next batch (the glove's knuckle lumps first); plates pick the fix up by re-rendering. | Q13 |
| R87 | **Before fan-out the lead writes** a transitions table (13 boundaries plus the loop: device, owner (the outgoing plate owns the device, the incoming plate the landing), a ±0.5 s test render) and a section energy and light/dark map, both in `PLATES.md`. | Q14 |
| R88 | **Labels:** at most one label *readable at a glance* per frame (R50). Filing labels that belong to an exhibit (suspect tags, the folder tab, exhibit numbers) may be in frame if small or out of focus. | Q15 |
| R89 | **Lint's known false hits (until the probe):** MISSING for words painted into textures or canvases; mismatches on repeated words ("never"); single-letter BLINK or EARLY from glyph-by-glyph drawing; LINGER on held lines (it contradicts R31 and goes when the probe lands). Any other warning is real. | Q16 |
| R90 | **`acetate`'s peak is lightbox:** the desk lamp's pool on the white print. It has no glow token. | Q17 |
| R91 | **Staffing (client-approved 2026-11-21, replaces R68's split where they differ):** the lead stays Opus. First builds: Opus high for 3D and lighting plates, Sonnet high for graphic plates. **Every full build starts with a key-frame checkpoint:** the set, light, materials and type card at 4-6 key frames **plus an 8 fps strip of one full line**, reviewed by the lead (or an Opus medium reviewer) before the full window. **Fix rounds:** Sonnet medium only when every item is a parameter or layout edit; anything about look, light, material or re-staging stays on the plate's model at high. **Brief check:** a Sonnet medium reader checks any brief that changes rules or covers several plates (numbers that can't all hold, conflicts with RULES or a client call) before the build; one-plate fix lists skip it. **Reports** add a 10-15 line code map (files, key functions, timing tables, tunables) outside the word limit. **The type probe** in `kinetic.ts` is built by Sonnet high. Measure Sonnet's usage cost against Opus on the next Sonnet job before relying on the savings. | staffing |

## I. Client taste and the one-round process (client-approved 2026-11-23; binding)

`scale` took five rounds and `uv` three. Almost every round came from a client call that applied to every plate but was learned one plate at a time, or from a defect no check could see. These rules carry those calls forward, so every remaining plate starts where `scale` r5 and `uv` r2 ended up. Each is numbered on from R91 and ranks as RULES. Where one differs from an earlier rule, the later rule wins.

| ID | Rule | Settles |
|---|---|---|
| R92 | **The client's taste baseline, from round 1 on every plate:** (a) every shot reaches film-black and its peak, measured at p1 ≤16 and p99 ≥235 (or the plate's glow token, R13); (b) the exhibit reads as itself in every line (its edges, its label where it has one) and the instrument reads as an object in use (a lamp in a hand, a flash head, a trimmer), never a sliver at the frame edge; (c) one move per line with a framing family of its own, travel reported per line against `scale` r5 (orbit 50-82°) and `uv`; a line under 20° of orbit *and* under 500 px of screen travel at 1080p needs the lead's OK; (d) one type-led hero macro per half-line in choruses and one per line elsewhere, at ≥1.2x the line framing (≥1.1x where the surface forbids, reported), with earlier words never shrinking below their line size; (e) hands and gloves are realistic: proportions, joints, creases, a cuff with thickness, a real material response; (f) slams belong to the plate's world, carrying its texture, light or material, never a flat title card (amends R24 for new builds; `scale` r5's slam stands); (g) energy: a graded instrument hit on the beat plus one secondary energy element in the plate's palette (debris, fibres, dust, spray), aiming between `scale` r5 and P(doom). | `scale` r3-r5, `uv` r1-r2 |
| R93 | **Taste questions up front.** When the lead fills a type card, it asks the client the plate's taste questions in one batch, three or four plates at a time: what carries the energy, how the hero and TEETH (or the plate's slam) behave, and anything about the exhibit, hands or light. The answers go into the type card before the brief is written. | rework |
| R94 | **The client approves the checkpoint.** The lead reviews the key-frame checkpoint first and fixes what is obvious. Then the client gets the 540p30 whole-window clip with audio, the key frames and the lead's R95 checklist. The 1080p full pass runs only after the client's OK. This amends R91's "reviewed by the lead". | rework |
| R95 | **The checkpoint checklist**, measured by the builder and checked by the lead: the luma p1, p50 and p99 per key still; the exhibit and instrument visible (% of frames per line); per-line camera travel; the macro ratios; the smallest supporting cap per line; lint and presence; the occlusion and edge-crop scans; the hit list by tier; ms per frame; a close still of every hand in the plate. A failed item is fixed before the client sees the checkpoint, or named in the report. | rework |
| R96 | **The plate starter.** New lyric-led builds start from the shared helpers in `app/src/teeth2/plate-kit.ts` (brief `docs/gate3/brief-plate-starter.md`): per-line camera plans, the macro solver, the graded hit tiers, the probe feed, and the occlusion and edge-crop scans. They don't re-derive them from `scale` or `uv`. | builder cost |
| R97 | **Measured energy.** Lint reports, per bar: the value range, the camera travel, the hit count by tier, and a motion-energy figure (mean frame difference). The same figures measured once on P(doom)'s reference span set the target band in every brief. Below the band is a finding, not a fail; the client decides. | energy |
| R98 | **The round target:** one checkpoint (with its fixes) plus one full pass per plate. A third round needs the client's call, and the ledger records why the second wasn't enough. | rework |
