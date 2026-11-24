# Teeth v2: the rules

The one place a rule lives. Process rules (gates, staffing, builds, deliverables, reviews) are in `PROCESS.md`; plate-specific rules are on their plate cards in `PLATES.md`. Both keep their R-numbers, and the "Retired IDs" table at the end says where every removed ID went. When a rule changes, its text is replaced here and the ledger (`docs/TEETH2-LEDGER.md`) records why (R63). Dead text is deleted, never struck through.

## Precedence

When two texts disagree, the higher one wins:

1. **Client calls**, latest first (the ledger records them).
2. **This file** (RULES). `PROCESS.md` ranks with it on process questions.
3. **The ledger** (`docs/TEETH2-LEDGER.md`): settled rulings and review history.
4. **`TYPE.md`**: the type vocabulary, layout and hook plan.
5. **Plate cards** (`PLATES.md`), including the plate-specific rules they carry.
6. **Briefs** (`docs/gate3/`): plate deltas only, citing rule IDs.

The rules here are written not to conflict. A reviewer who finds a conflict reports it to the lead and enforces neither (R64). Items marked **open (client, batch with R93)** wait for the next batch of taste questions; until then they stand as written.

## How to read the tables

Columns: **Rule**, **Scope** (plates or sections), **Purpose**, **Test**, **Source**.

Tests: **lint** = the frame checker (`app/scripts/lint.ts`); through the type probe it sees kit words (presence, size, hero, safe area, early, frame-edge crop), but not limb crops or occlusion, which the plate's scans cover (R29). **histogram** = a palette histogram on a sheet (not built). **measured** = a number taken from a render. **eye** = a reviewer looks.

---

## A. Concept

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R1 | **No repeated visuals.** No plate, shot, trick or exhibit appears twice. Repeated lyrics (two pre-choruses, six chorus halves) get different exhibits and instruments. Nothing from v1 (jaws snapping on words, Rorschach cards, sheets with words in them, the ring, the blooming-rose stain, handprints, the spring-back camera, the clamp). The deliberate recurrences are the bookend drawer (plates 1 and 14, mirrored, 4 bars each way), the TEETH hook (R82) and the shared kit idioms (slams, kit moves, the glove). | all | no v1 repeats | eye | client (v1 notes); ledger |
| R2 | **Every image makes sense**, at a glance and in forensic logic. Each light, shake or flash has a source in the scene, and every particle (debris, dust, fibres) comes from an action in it; nothing is decorative. In every line the exhibit reads as itself (its edges, its label where it has one) and the instrument reads as an object in use (a lamp in a hand, a flash head, a trimmer), never a sliver at the frame edge. | all | clarity | eye | client (v1 notes); client 2026-11-23 |
| R3 | **The concept is fixed.** A forensic odontologist builds a bite-mark case against the woman he loves, and the bite is his. The narrator is the examiner; every plate is an exhibit from case 08-32 · BITE MARK in its own forensic technique. Three choruses are three methods (bite-mark photography, the stone cast, the superimposition match). The video loops (opens and closes on the steel drawer). The ending is silent after the hard stop (200.70). The reading is Eden reversed, implied and never "he killed her". CSI-familiar exhibits stay mixed. | all | story | eye | client 2026-11-17 |
| R4 | **The monogram is T.F.**, a slanted single-stroke signature drawn with its two full stops (strokes 3-4, tapped as the signing completes), signed by the gloved hand on a beat, only where a signature goes: the film's tag (~9.9), the chart (~83), the bag seal (143.69), the matched cast's NAME field (165.16) and the filed exhibits. It is red only from 165.16 (R9). Name fields stay blank until 165.16 (polygraph SUBJECT, the bag's NAME). | 2, 7, 11, 13, 14 | the twist | eye | client 2026-11-17, 2026-11-19 |
| R5 | **Tooth #8's chip** (upper right central incisor, a diagonal chip off its inner corner) shows in the radiograph, the apple's bite, the poured cast and the tracing, and is the last thing to lock at the match. Every plate builds teeth from `app/src/teeth2/teeth.ts` (one tooth set, no private anatomy). Each suspect is a visibly different `archVariant`, never with the chip. | 2, 5, 9, 12, 13, 14 | the clue chain | eye | ledger |

## B. Palette and light

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R8 | **Palette tokens only** (`app/src/teeth2/palette.ts`; tints and shades of them are allowed): film `#070A10` (ground), film2 `#0F1520` (panels, deep shadow), silver `#6E7682` (hairlines), halide `#A9B0B8` (pre-roll type), lightbox `#F1F3EE` (cold white, crisp), uv `#6A2CFF`, fluor `#CFF4FF`, luminol `#3FA9FF`, wax `#E58FA0` (tender register), stone `#E8C35A` (apple and casts), tungsten `#FFB46A`, match `#FF2A1F`. Light plates (polygraph, chart) invert to lightbox white with film-black ink. | all | one look | histogram | client 2026-11-17 |
| R9 | **Colour locks.** UV violet in plate 6 only, only where the lamp is on. Luminol blue in plate 11 only. Tungsten in plate 3 only, as light (card 3, R14). **Red** only from 165.16 until the folder's drain (183.5-186.4, visible, never in 0.2 s), and only as the traced outline, TEETH, the monogram and the stamp: full match red at a readable stroke weight, never a dim hairline, never a full-frame flood. The ring around the chip at the lock is film ink, not red. | 3, 6, 11, 13, 14 | each colour means one thing | histogram, eye | client 2026-11-17; lead 2026-11-21 |
| R11 | **Only uv, fluor, luminol and match may glow or bloom.** Bloom only above 1.0, so lightbox white stays crisp; halation tint is cold, never warm. No bloom orbs on non-glow materials: lamp reflections are crisp shapes; depth of field leaves no grainy halos on silhouettes. | all | no neon, no slop | lint, eye | treatment; ledger |
| R12 | **Light.** Each plate has one key source and real blacks (film). Motivated fills are allowed (plate 3's work light under the tungsten, plate 10's studio card); plate 11's key is the reaction (card 11, R58). A light event lands on each money moment (the first flash, the cut to the cast, the lock). Radiographs are always backlit (plates 2 and 14). | all | physical light | eye | ledger |
| R13 | **Value range, per shot.** Every shot reaches film-black and its plate's peak, measured on key stills: luma p1 ≤16 everywhere; p99 ≥235 where the peak is lightbox (every plate except 6 and 11; `acetate`'s peak is the desk lamp's pool on the white print, with no glow token). Where the peak is a glow token (`uv`, `luminol`), the p99 target is on the plate card. A shot of mid-tones only is a defect. | all | no mid-tone mush | measured, eye | lead 2026-11-21; client 2026-11-23 |
| R15 | **The tender register** (*sweet*, *pretty*, *rose*, *wife*) is wax-pink Cormorant Garamond italic. When a tender word is its line's hero, the hero idiom wins: PRETTY is Archivo black in `scale` and `uv`. *sweet*, *rose* and *wife* keep the tender register when they are not the hero. Under the UV lamp (plate 6), *sweet* is fluor-white Cormorant, like every word there. SWEET as a half-line hero stays Cormorant as built in `scale` (wax pink) and `uv` (fluor-white); on later plates: open (client, batch with R93). | all; 6 | tender voice | eye | client 2026-11-20, 2026-11-23 |

## C. Typography and kinetic type

Vocabulary, layout and the hook plan are in `TYPE.md`.

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R17 | **Fonts and craft.** Archivo (width 62-125, weight 300-900): his voice, the sung lyric; wide and light in the verses, condensed and black on the hits. IBM Plex Mono: the lab, inside objects only. Cormorant Garamond italic: the tender register (R15). One single-stroke pen hand: words a pen writes (R52) and the monogram (R4). Kerning and typographic punctuation (curly quotes, never straight); no outlined or haloed type; the lyric stays inside title-safe (96 px), except a hero's full-frame slam (R24). | all | identity, craft | lint, eye | treatment; client 2026-11-19 |
| R19 | **Timing and states.** A word appears at most 0.4 s before it is sung, and is faint (halide, ~35%) only in that pre-roll; there is no faint line ahead of the voice. It lights at its `start` (letters spring ~45 ms ahead) and completes by its `end`; a word caught mid-write between them is correct. Sung words are lightbox white; the hero takes its plate's idiom and snaps from light to heavy weight on its onset. No fade-in entrances. | all | sync, read the line | lint, measured | treatment; client 2026-11-19, 2026-11-23 |
| R21 | **Sizes.** One hero word per line, readable at a glance, inside title-safe, held from its start to its end, at hero scale: a cap height ≥20% of frame height *or* a width ≥30% of frame width (either is enough). Small heroes are a defect. Supporting words keep a cap height ≥5% of frame height; 8% is advised on a line's first frame. Exempt from hero scale: chorus 3a (`acetate`) and the bridge (`luminol`), where the section's energy sets the hero. `acetate`'s hero size: open (client, batch with R93). | all; hero exempt 11, 12 | legibility | lint, measured | lead 2026-11-21 |
| R23 | **Legibility floor (reveal-by-light plates).** Sung words of the current line never drop below readable: halide-level contrast and a cap height ≥5%. The plate's light (UV beam, luminol glow, articulator reflection, backlight) lifts them from the floor to full; it is never the only thing that makes a word readable. Named exception: GO's decay in `uv` (card 6, R57). | 2, 6, 10, 11 | reveals without lost words | measured, eye | client 2026-11-21 |
| R24 | **Slams.** Only a hero may break out full-frame. A slam belongs to the plate's world, carrying its texture, light or material, never a flat title card, with no outlines or halos. It takes the plate's grain and motion blur and adds no halation of its own; where the slam is the plate's glow material (`uv`'s fluorescing trace), it glows as that material does, under R11. `scale`'s r5 slam stands as built. | heroes | P(doom)'s hook idiom, in-world | eye | client 2026-11-20, 2026-11-23 |
| R25 | **Both layers, one kit.** Supporting words are physical things in the plate's world (bitten, engraved, written, printed, glowing), never flat captions, and move like motion graphics on that surface. Every move comes from `app/src/teeth2/kinetic.ts`, keyed to the beat grid and the kick and snare onsets in `audio.json`. New lyric-led builds start from the shared helpers in `app/src/teeth2/plate-kit.ts` (brief `docs/gate3/brief-plate-starter.md`: per-line camera plans, the macro solver, the hit tiers, the probe feed, the occlusion and edge-crop scans) and don't re-derive them. | all | motion-graphics type | eye | client 2026-11-20, 2026-11-23 |
| R26 | **Energy by section:** verses low, pre-choruses rising, choruses maximal, chorus 3a eerie (hairline weights, small and slow, lots of black), the bridge and outro falling (slow tracking, the last words held). Every plate carries a graded instrument hit on the beat plus one secondary energy element in its palette (debris, fibres, dust, spray; R2); where a card forbids particles (card 11, R61), its type card names the element. Lint reports per bar the value range, camera travel, hits by tier and a motion-energy figure (mean frame difference). Chorus plates aim at the band those figures give on P(doom)'s reference span, between `scale` r5 and P(doom) (TYPE §7). The bands for verses, pre-choruses, 3a, the bridge and the outro: open (client, batch with R93). Below the band is a finding, not a fail; the client decides. Table: TYPE §6. | by section | build | measured, eye | client 2026-11-20, 2026-11-23 |
| R28 | **Exit.** When a line is replaced it leaves with a move on a beat (collapse, slide-out, wipe, or swallowed by the next cut), never a fade or a hard pop. The only fade is GO's decay in `uv` (card 6, R57). | all | motion | eye | client 2026-11-20 |
| R29 | **No crops, no cover.** While its line is on screen, no word is clipped mid-word, and no hand, tool or object covers a sung word for more than 2 frames. A word reaching a lane's edge stops there (words stack against the edge) until its line leaves. | all | no lost words | lint (frame-edge crop), the plate's occlusion and limb scans | ledger; client 2026-11-23 |
| R76 | **Wrap and shed.** A long line is set in up to three rows on its surface, the camera framing the line so far. If it still cannot fit at the 5% floor (R21), its earliest words shed as whole words on a beat, always keeping the hero and at least the last four sung words. Each type card states which. | all | long lines | measured | lead 2026-11-21 |
| R82 | **Slams and the TEETH hook.** Slams are a shared idiom, owned by no plate. TEETH in each "got teeth" line is one recurring slam whose look escalates on each return (plan: TYPE §8). **Budget:** at most two full-frame slams per chorus plate (TEETH counts as one), at most one per verse or pre-chorus plate, none in the bridge. `acetate` has no slam: its TEETH is small and hairline. `match` has one red TEETH slam on the 165.16 lock, designed on its type card. `filed`'s three outro TEETH slams are the hook's finale and the one exception to the budget; each is heavier and held longer, and whether the last one holds (TYPE §8) or leaves with a move (R28) as the 183.40 line takes over is open (client, batch with R93). | 5, 6, 9, 10, 12-14 | the hook | eye | client 2026-11-20; lead 2026-11-21, 2026-11-23 |

## D. Lyric-led camera and impacts

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R31 | **The lyric is on screen while it is sung.** From the first sung word (7.23) to the last (186.83), every frame carries the current line: built word by word as it is sung, sung words staying, held until the next line takes over on the beat. In a gap the last line holds for up to 2 bars (~3.5 s), then clears on a beat; where a plate card names a set piece in the gap, the line clears on the beat after its last word and the set piece plays clean (named: the tag signing, 9.34-10.79, card 2). The intro (0-7.23), the outro carry (186.85-193.76) and the closing riff (193.76 on) have no lyric; the folder tab's written "never let go" may show as an in-world label. Pass mark: lyric presence ≥95% of sung frames. | 2-14 | the P(doom) bar | lint, measured | client 2026-11-21; lead 2026-11-21 |
| R34 | **The camera follows the type.** Each line is the subject of its shot. The camera moves with the words as they arrive (riding along the line as it is written, bitten, engraved or lit), pushes into the hero on its onset (R40), and keeps the newest word in the sweet spot: its centre in the middle third of the frame, with lead room ahead in the reading direction, and the line so far inside title-safe. The scene plays around and behind the line. | 2-14 | P(doom)'s grammar | eye, measured | client 2026-11-21; lead 2026-11-21 |
| R35 | **One continuous move per line:** a smooth spline that eases into the downbeats, with no direction reversals and no snapping between unrelated framings, and a framing family of its own for each line. Chorus plates report each line's travel against `scale` r5 (orbit 50-82° per line); a line under 20° of orbit *and* under 500 px of screen travel at 1080p needs the lead's OK. Travel for the other sections: open (client, batch with R93). | 2-14 | no whiplash, no stall | eye, measured | client 2026-11-21, 2026-11-23 |
| R36 | **Hero macros (type-led reframes).** Inside a line, a cut or reframe is allowed only when the type carries it: the new framing opens on the word being sung, already readable, with the line so far visible or re-established within 2 frames; never on every beat, never to an unrelated view. There is one hero macro per half-line in choruses and one per line elsewhere, at ≥1.2x the line framing (≥1.1x where the surface forbids, reported), with earlier words never shrinking below their line size. A TEETH slam counts as its half-line's macro. A macro is a reframe, not a push, so R40's push limit does not apply to it. | 2-14 | keeps R35's protection | eye, measured | client 2026-11-21, 2026-11-23 |
| R37 | **Graded impacts, never a uniform pulse.** The beat lands as an impact inside the shot (an exposure kick, a nudge or shake, a stamp, a stretch), not as a new shot: downbeats strong, backbeats light, each line's hero the strongest, building across a section. **Ceilings** (builders may go lower): tier 1 (hero onsets and the section's chosen downbeats; at most three per chorus line, one a bar elsewhere): the instrument hit, a stamp, a shake ≤12 px; tier 2 (other downbeats): a stretch or a light change, a nudge ≤5 px; tier 3 (backbeats): ≤2 px, or a type-only move. The instrument's full hit (`scale`'s flash, `uv`'s lamp, `pour`'s trimmer) is tier 1 only, and it reveals the type rather than washing it out (`scale`'s flash is a hard side flash, never a whole-frame white pop). No flash before 48.73. No two repeats of a line use the same hit pattern. Kit moves are small hits and obey the tiers. | all | the beat without whiplash | eye, measured | client 2026-11-21; lead 2026-11-21 |
| R39 | **Cuts between lines.** A line's cut lands on the downbeat nearest the start of its first word that lies within 0.12 s of a downbeat; if none does, on the downbeat nearest the line's first word. The brief names the time; the builder checks it against `audio.json`. Pickup words sung before the cut appear in the outgoing shot as the head of the new line, or the type carries the cut (a match on a word, a slam that takes the cut with it, the camera following a word into the next world). A hero slam may cut to full frame and back. Inside a line, only R36 reframes. | 2-14 | cut rhythm with pickups | measured, eye | client 2026-11-21; lead 2026-11-21 |
| R40 | **Constant motion.** Something happens every bar; big changes land on downbeats; hits on the kick and snare. No breathing zooms, no rush at the camera, no screensaver drift. A push into a hero changes the framing scale by at most 20% over the word, eased over at least 0.4 s and into the downbeat; faster or larger reads as a rush. | all | P(doom)'s energy | eye, measured | treatment (amended); lead 2026-11-21 |
| R41 | **Re-staging.** A plate may be re-staged to give the line a path (a band around the apple, a row along the jaw, a trace across the paper) if the exhibit, palette, stakes guards and approved still times hold. At each approved still's time the frame keeps the still's exhibit, light, colour and beat; the type follows the current type card. | all | story intact | eye | client 2026-11-21 |

## E. Stakes guards

The crime stays implied and never reads as violence to her.

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R43 | No gore, horror, wounds, faces or realistic eyes. People are present through gloved hands, marks and their teeth. Nothing reads as an eye (a lamp disc at the lock did). The case is a bite mark, not a killing. | all | tone | eye | treatment; ledger |
| R45 | **No drip, blot, blob or spatter anywhere**, ink included, and the ruling covers models, glows and tears: paper tears are narrow slits, never holes; a stain is a soak shaped by the weave and folds, never a soft cloud; the glove has no sphere or blob parts. A hero's letters may break only along the plate's own motif (bite scallops, the razor's diagonal, a pen stroke, a crack in stone). | all | stakes | eye | ledger; client 2026-11-20 |
| R47 | **Nothing of hers is damaged or found.** The exhibits are only things she touched (the apple, the pillowcase, the voicemail) and his own things (the shirt, the cast, his chart). The only blood is one bloom over the heart of *his* shirt (plate 11; no spatter, no drips, no tear). Whether her odontogram (plate 7), the bed (plate 3) and plate 2's radiograph are allowed exhibits: open (client, batch with R93). | all; 11 | stakes | eye | client 2026-11-17 |
| R48 | **Casts are never front-on while closed or closing** (plates 9, 10, 13). Closures are shot in profile, three-quarter, or from at least 45 degrees above, so a closed cast never reads as a grinning mouth or v1's snapping jaws. | 9, 10, 13 | stakes, R1 | eye | ledger |

## F. Craft

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R49 | **No HUD, counters or readouts.** No on-screen number ever changes value. Lab text lives only inside objects. The engine HUD is off in every render. No title card or credits on screen (credits go in the README). | all | v1 complaint, scope | lint (HUD off only), eye | client (v1 notes, handoff) |
| R50 | **Labels.** At most one label readable at a glance per frame, never along the bottom edge. Filing labels that belong to an exhibit (suspect tags, the folder tab, exhibit numbers) may be in frame if small or out of focus. Plate 13's labels: card 13. | all | clean frame | eye | lead 2026-11-21 |
| R51 | **One glove.** Every plate imports the kit glove, `GLSL_HAND` in `match-glsl.ts`: a realistic film2 nitrile glove (real proportions and joints, creases, a cuff with thickness, a real material response), lit only by its plate's source; never a black mass, a sphere or a blob. After `uv`'s full pass, a kit chore ports `uv` r2's glove into `GLSL_HAND` (R86); until then `uv` keeps its own copy in `uv-glsl.ts`, a named, temporary exception. The polygraph's machine pens are the only exception to "a hand does it". | all | one hand | eye | ledger; client 2026-11-23 |
| R52 | **The glove does it, in one pen hand.** Every pen-written lyric (plates 13, 14), every signature (R4) and every carried object shows the shared glove doing it, and the glove stays clear of finished marks. Everything a pen writes (the polygraph trace, the `match` lyric, the folder tab) is one technical single-stroke hand, not cursive; the signature is the one exception (R4). | all; pens 4, 13, 14 | the hand is his | eye | ledger; client 2026-11-19 |
| R56 | **Ownership.** A plate owns a composition together with its exhibit: plate 3 owns fabric from above and the only words on standing cards or signs; the polygraph owns the scrolling machine trace (the chart does not scroll the paper or write the lyric with its pen). One-offs: one butterfly sequence only (plate 4, a tremor of all four pens, no wing shapes; plate 8 has no wings); "put your hands on me" as a glove action per word in plate 6 only; "let go" as a literal release in plate 10 only; no "push me away" image shoves anything. Slams are shared (R82). | 3, 4, 6, 7, 8, 10 | R1 | eye | ledger |

## G. Done

| ID | Rule | Scope | Purpose | Test | Source |
|---|---|---|---|---|---|
| R85 | **Done for gate 3:** lint clean with the Teeth checks; presence ≥95% (R31); the approved still times compared with the gate 2 JPGs; both hand-offs rendered; no palette lock broken; the R95 checklist passed or its misses named; at most 200 ms per frame at 1080p, with the figure reported (the real budget is measured at gate 4 with a 4K test render per plate, `--samples auto`, then a whole-video budget, slowest plates first); a review with no rule FIX left. **REWORK** = the plate's core read fails; **FIX** = rule or timing defects; **SHIP** = polish only. | all | a shared bar | lint, measured, eye | lead 2026-11-21 |

---

## Retired IDs

Every removed ID and where its content now lives. History (dates, superseded rulings) is in the ledger.

| ID | Now in |
|---|---|
| R6 | card 8 (`voice`) |
| R7 | R49 (no title card or credits); `PROCESS.md` R7 (publishing) |
| R10 | R9 (red) |
| R14 | card 3 (`scene`) |
| R16 | card 5 (`scale`); cards 9, 12, 14 cite it |
| R18 | R17 |
| R20 | R19 |
| R22 | R21 (sizes); R24 (only heroes go full-frame); R25 (physical words) |
| R27 | R45 (breaks) |
| R30 | R82 |
| R32, R33 | R31 |
| R38 | R37 |
| R42 | `PROCESS.md` |
| R44 | card 3 (`scene`) |
| R46 | R47 |
| R53 | R4 (the signature); R52 (the pen hand) |
| R54 | card 5 (`scale`); exhibit numbers in the `PLATES.md` header |
| R55 | cards 12 and 13 |
| R57 | card 6 (`uv`) |
| R58 | card 11 (`luminol`) |
| R59 | card 10 (`articulator`) |
| R60 | cards 4, 8 and 12 |
| R61 | cards 5, 9 and 11 |
| R62 | `PLATES.md` "Hand-overs" (seeds the R87 transitions table) |
| R63-R70 | `PROCESS.md` (R68 is absorbed into R91) |
| R71 | R85 (speed) |
| R72-R74 | `PROCESS.md` |
| R75 | R31 (set pieces) |
| R77 | R39 |
| R78 | card 10 (`articulator`) |
| R79 | R37 (tiers) |
| R80 | R40 (push) |
| R81 | R34 (sweet spot) |
| R83, R84, R86, R87, R89 | `PROCESS.md` |
| R88 | R50 |
| R90 | R13 (`acetate`'s peak) |
| R91 | `PROCESS.md` (staffing, with R68) |
| R92 | (a) R13; (b) R2; (c) R35; (d) R36; (e) R51; (f) R24; (g) R26 |
| R93-R95 | `PROCESS.md` |
| R96 | R25 (the plate starter) |
| R97 | R26 (measured energy) |
| R98 | `PROCESS.md` |

The resolution table for the doc review's contradictions C1-C22 (`docs/doc-review-2026-11-21.md`) is retired: each resolution is now the rule it named, traced through this table.
