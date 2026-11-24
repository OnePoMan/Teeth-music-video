# Teeth v2: the type system

The kinetic vocabulary, how a line is laid out, pickups, gaps, impact tiers and the TEETH hook plan. Rules are in `RULES.md` (R15-R29, R76 and R82 type; R31-R41 camera and impacts); per-plate type cards are in `PLATES.md`. This file ranks below RULES and the ledger and above the plate cards (RULES "Precedence"). The kit is `app/src/teeth2/kinetic.ts` (its top comment documents the API; its hook-plan comment is superseded by section 8, and the comment should be changed to point here: not done, code untouched).

## 1. Principles

- The lyric is motion-graphics type at P(doom)'s level. Supporting words live in the plate's world but move on that surface; heroes may break out as full-frame slams in the plate's world (R24, R25).
- The type escalates across the song (section 6) and the TEETH hook escalates on every return (section 8).
- The lyric is on screen while sung and the camera follows it (R31, R34-R36). Prove it on prototypes before it reaches all 14 plates (`PROCESS.md` R73).

## 2. The vocabulary (the shared kit)

Every move is keyed to the beat grid and the kick and snare onsets in `audio.json`. A kit move is a small hit and obeys graded impacts (R37). New builds take the camera plans, macro solver, hit tiers and scans from `plate-kit.ts` (R25).

| move | what it does | kit |
|---|---|---|
| spring | letters arrive per glyph, staggered 15-25 ms, with overshoot and settle | `Moves.spring` |
| stretch / condense | Archivo's width (62-125) and weight (300-900) axes move: stretch on kicks, condense on snares; the weight snaps light to heavy on a hero's onset | `Moves.stretch`, `.weight` |
| track | letter-spacing opens on the beat and closes | `Moves.track` |
| stamp | the hero lands oversized and settles, with a frame shake on its onset (`P.shake`) | `Moves.stamp` |
| slide / lean | a word drifts or leans further on each beat, cumulatively (P(doom)'s ASKEW) | `Moves.slide`, `.lean` |
| pressure | copies of a word condense and pack the frame on successive kicks (pre-chorus builds) | `pressureRows`, `drawPressure` |
| break | a hero's letters split along the plate's own motif mask (bite scallops, the razor's diagonal, a pen stroke, a crack in stone); never into drips, blots, blobs or spatter (R45) | `drawKin(..., { brk })` |
| exit | a line leaves with a move on a beat: collapse, slide, drop or wipe; never a fade or a hard pop (R28) | `Moves.exit` |

Surfaces: a 2D full-frame layer, a canvas texture mapped onto a 3D object, or an SDF baked on a surface (`KinWord.fromCells`, `packKin`, `glslKinSDF`). Camera helper: `LyricPath.fromWords` (where the camera looks along the line, and how far it stands, at time t) and `LyricCam` (a keyed spline); keys sit at the words' onset positions, shifted 0.06 s early, a monotone cubic between them (no overshoot, no reversals), time-warped to ease into each beat and further into each downbeat.

## 3. Line layout

- **The whole current line** is on screen, built word by word as sung, sung words staying, held until the next line takes over on the beat (R31). A word shows at most 0.4 s before it is sung, faint only in that pre-roll (R19).
- **Surface and path** are per plate (the type card): the surface (bitten, engraved, written, printed, glowing), the line's path (a band, a row, a trace, a lane) and the camera that follows it.
- **Sizes (R21):** supporting words at least 5% cap height (8% advised on a line's first frame); the hero at cap 20% of frame height or 30% of frame width; inside title-safe (96 px, so 1,728 px of width at 1080p).
- **No mid-word crop, and no cover** for more than 2 frames, while the line is on screen (R29).
- **Wrap and shed (R76):** up to three rows on the surface, the camera framing the line so far; if it still cannot fit at the 5% floor, the earliest words shed as whole words on a beat, always keeping the hero and the last four sung words. Lines of 9-11 words: indices 1, 3, 5, 7, 10, 11, 20, 21, 23, 26, 27, 37.
- **Hero relative to the line:** per plate (in the row, replacing the row, or a slam); see the type cards.
- **The sweet spot (R34):** the newest word's centre in the middle third, with lead room ahead in the reading direction, and the line so far inside title-safe.

## 4. Pickups

A line's cut lands on the downbeat nearest the start of its first word that lies within 0.12 s of a downbeat; if none does, on the downbeat nearest the line's first word (R39). Pickup words sung before the cut appear in the outgoing shot as the head of the new line, and the outgoing line clears on the pickup. Or the type carries the cut. About 18 of the 52 lines start more than 0.12 s off a downbeat ("And", "Then", "Don't know if"). The brief names each cut time. Built examples of a cut carried by the type: the `scale` and `uv` TEETH slams cutting back onto LATE.

## 5. Gaps and lyric-free stretches

- The last line holds through a gap of up to about 2 bars (about 3.5 s), then clears on a beat (R31). Gaps of note: 9.34 - 10.79 (the tag signing), 23.11 - 24.49, 78.41 - 79.75, the outro's TEETH gaps of about 2 s (177.00 - 179.06, 180.40 - 182.08). The tag signing is a named set piece, so the line clears on the beat after its last word (R31).
- No lyric: the intro (0 - 7.23), the outro carry (186.85 - 193.76) and the closing riff (193.76 on). The folder tab's written "never let go" may show in-world (R31).

## 6. Escalation by section

Every plate carries a graded instrument hit on the beat plus one secondary energy element in its palette (R26). Lint measures the band per bar (R26, §7).

| section | plates | energy | band | type |
|---|---|---|---|---|
| verses | `lightbox`, `scene`, `chart` | low | open (client, batch with R93) | spring, track, slide; only the line's hero stamps |
| pre-choruses | `polygraph`, `voice` | rising | open (client, batch with R93) | pressure builds bar by bar; condense on snares; lean |
| choruses | `scale`, `uv`, `pour`, `articulator`, `match` | maximal | P(doom)'s measured band (§7) | every hero stamps or slams full-frame (within the slam budget, R82); stretch on kicks; breaks |
| stripped chorus 3a | `acetate` | eerie | open (client, batch with R93) | hairline weights, small and slow, lots of black (hero size: open, R21) |
| bridge, outro | `luminol`, `filed` | falling | open (client, batch with R93) | slow tracking; the last words held |

## 7. Impact tiers

Structure and ceilings (R37): **tier 1** hero onsets and chosen downbeats, at most three per chorus line and one a bar elsewhere: the plate's instrument hit (a flash, the lamp, the trimmer), a stamp, a shake up to 12 px; **tier 2** the other downbeats: a stretch or a light change, a nudge up to 5 px; **tier 3** the backbeats: up to 2 px, or a type-only move. Impacts build across a section; a line's hero is its strongest; no two repeats of a line use the same hit pattern; each hit reveals the type rather than washing it out. Each type card picks its chosen downbeats.

**Energy band (R26):** the plate-starter job (`docs/gate3/brief-plate-starter.md`) records here the per-bar figures (value range, camera travel, hits by tier, motion energy) measured on P(doom)'s reference span, `scale` r5 and `uv`, and the chorus target band between `scale` r5 and P(doom). Not yet measured.

## 8. The TEETH hook plan

TEETH, in each "...got teeth" line, is one recurring full-frame slam whose look escalates on every return (P(doom)'s hook idiom, R82). A slam belongs to the plate's world, carrying its texture, light or material, never a flat title card; no outlines or halos; it takes the plate's grain and motion blur and adds no halation of its own (R24). `scale`'s slam (item 1) stands as built. Items 3-7 are starting points: each plate's type card designs its slam in the plate's world.

1. **`scale` 54.66 (chorus 1a), the statement, as built in r5.** TEETH is first bitten into the apple on its onset (stamp and shake, the approved 55.00 still); on the next beat (55.20) it slams full-frame: film-black Archivo 62/900 stretched tall on a stone-yellow field, 2 inverted punch frames, stamp 1.3 to 1, stretch on the kick; on the 8th note a scalloped bite (his arch, #8's chip a flat notch) breaks a piece out of the word and it flies off; the next line's first word (55.63) cuts back to the apple. Clean, one slam, one break. It stands as built (R24).
2. **`uv` 68.47 (chorus 1b), in the cloth.** Two slams. On the onset the camera slams into a macro of the weave and TEETH is a full-frame glowing trace on the pillowcase, with fibre texture and fold shading in the glow (glow per R11: bloom only above 1.0, letter edges crisp). On 68.80 a condensed copy flares over it (pressure x2), as a second trace or a re-excitation, never a ghost. The beam's sweep is the break line (a straight wipe edge of light). It holds until LATE (69.44). No flat title-card frames.
3. **`pour` 109.91 (chorus 2a).** Film letters slam onto the wet stone field and the table's shake re-stamps them on every 8th of the hold (stretch on the kick, condense on the snare); the break is a crack in stone, pieces staying put.
4. **`articulator` 123.72 (chorus 2b).** TEETH split along the occlusal line into an upper and a lower half that slam shut on the word (break inverted: the halves arrive), film on studio-card white; frame shake doubled.
5. **`acetate` 151.35 (chorus 3a, stripped).** The breakdown, no slam: hairline weight 300, small, tracked wide, lots of black, a slow lean; it is traced, not stamped (P(doom)'s hook 3). No slam here (R82).
6. **`match` 165.16 (chorus 3b), maximal: the first red.** TEETH goes match red on the sheet and locks with the traced outline and the monogram. One red TEETH slam on the lock, with no red copies (no flood, R9); the rest of its design goes on the `match` type card (R82).
7. **`filed` 175.66 / 179.06 / 182.08 (outro), falling.** Three slams, each heavier and held longer, set huge across his exhibits as they come face-on; the red monogram beside each. The last one holds longest and leaves with a move as the 183.40 line takes over (R28, R82); the red drains at 183.5 - 186.4 (R9).

**Slam budget (R82):** at most two full-frame slams per chorus plate (TEETH counts as one), at most one per verse or pre-chorus plate, none in the bridge; `acetate` none; `filed`'s three outro slams are R82's one exception. Plan item 2 (`uv`, two TEETH slams) uses its whole budget on TEETH.

## 9. Open items

Per plate, on the type cards: the hero's position relative to its line, the chosen downbeats, and the `match` slam's design. Collect worked examples of a type-carried cut as plates are built.
