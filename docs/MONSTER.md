# Monster — treatment & style bible (draft 1)

A code-rendered, word-synced music video for "Monster" (Jorge Rivera-Herrans, *EPIC: The Musical*, The Underworld Saga), on the P(doom) engine (`docs/ENGINE.md`) and its design rules (`docs/TREATMENT.md`): every frame a pure function of song time, karaoke per word, cuts and hits on the analysed beat grid, one restrained palette, one type system, engraving-style line work, concrete objects treated as visual puns and transformations, never storyboard illustrations of the lines.

## The idea in one paragraph

**A shadow play in the land of the dead.** In the Greek underworld the dead are *shades* (σκιά, shadows), and the song is sung among them. One flame, the signal-orange point that ran through P(doom) as the spark, is the only light down here; it is carried through every plate and everything we see is lit by it. **What the flame lights is the man; what it casts is the monster.** Each plate sets concrete things in front of the flame (a cave mouth, a cup, a fleet, a wooden horse, a scale, a stele, a sea chart, a wall) and lets their shadows tell the truth. Under every plate runs **the line** ("I'm the only one whose line I haven't crossed"): one hairline, a horizon, a ground line, a scale beam, a wall's coping, a course on a chart, which he walks along and, on "I will deal the blow", crosses. The three choruses are one hook in three grammatical moods, and the other self takes over a little more each time: *What if I'm the monster?* (the word stands lit on the shore; its reflection in the black water is already black-figure, a black silhouette on the clay's orange, and has no question mark: the figure asks, the water answers), *If I became the monster* (the orange seeps up above the waterline, very slightly), *Then I'll become the monster* (the palette flips from red-figure, a lit figure on black, to black-figure: the reflection is the only figure left). The video ends where it began: the flame goes out, a spark is struck, and it loops.

## Tone

- Grave the way tragedy is grave: stillness and restraint in the verses, then violence exactly on the beat. Big changes land on downbeats; inside a plate, snaps, holds, camera moves easing into downbeats (P(doom)'s motion rules unchanged).
- P(doom)'s deadpan jokes are dropped (client decision: no dry footnotes). The mono voice stays factual: counts, plate numbers, coordinates, weights, ratios.
- Not slop (unchanged): no glowing runes, no lens-flare soup, no particle nebulae, no "epic" stock imagery, no marble-statue clip art, nothing that looks AI-generated.
- Originality: no copying of the official EPIC art or of fan animatics; no drawn characters. Odysseus, Circe, Poseidon and the cyclops never appear as figures: they are objects, silhouettes without faces, and shadows. One eye in the whole video (the cyclops).

## Palette (P(doom)'s, unchanged, plus one accent)

- **ink** `#0A0A0B`, **ink2** `#151517`, **graphite** `#5E5B57`, **ash** `#9C978F`, **bone** `#EEE9DF`, **signal** `#FF4D12` (the flame, red-figure terracotta, the sung word), **ember** `#FF8A3D` (the flame's core), **blood** `#C21D0B` (the shadow's orange fringe).
- Orange on black already reads as Attic red-figure (figures in the clay's orange on a black ground); black on orange is black-figure (black silhouettes on the clay). The arc of the video is the move from one to the other.
- One rare accent, owned by home: **dawn** `#F4A99B`, Homer's "rosy-fingered" dawn, for "Penelope", "Telemachus" and the light of home on the horizon only.
- Only signal/ember glow. Bone type stays crisp.

## Typography

- **Archivo**: Odysseus' voice. Width and weight animate with the argument (wide and light in the questions, condensed and black in the decisions).
- **Cormorant Garamond italic**: the sacred register: the gods' creed ("ruthlessness is mercy upon ourselves") and the names of home.
- **IBM Plex Mono**: the ledger: plate numbers, counts (men, years, leagues), the scale's readout, chart coordinates.
- **Single-stroke fonts**: words *incised* by the flame, the way black-figure painters scratched detail through the black slip to the clay.
- Same craft rules as P(doom): kerned runs, typographic punctuation, no glyphs outside the families, no outlined or haloed type.

## Karaoke rules

Unchanged from `docs/TREATMENT.md`: every line readable and synced per word (a word appears or lights at its `start`, completes by its `end`, never ahead of the voice); each plate integrates the lyric graphically and differently; title-safe margins. New: lines with `voice: "ensemble"` (the chorus' "Monster" interjections) are set apart from Odysseus' lines (they are the shades answering him).

## Motifs

1. **The flame** and its shadow: the through-line, like the spark. Every shadow in the video is cast by it.
2. **The line**: the moral line, one hairline per plate in a different guise; crossed once, at the climax.
3. **The shades**: the dead as shadows without bodies at the edge of the light.
4. **The scale** (the in-world instrument, P(doom)'s readout's successor): a balance whose beam tips a little further toward ruthlessness each chorus; staged inside plates as a cameo, never a corner HUD.
5. **The hook**: MONSTER, one recurring typographic event that escalates through the three moods, then is chanted by the shades in the outro.
6. **The meander**: the Greek key, a single continuous line: the "endless" suffering of verse 1 and the bookend frame (P(doom)'s crop marks' successor) around the first and last frames.
7. **The water** (the reflection is the future): wherever the line is a waterline, the water shows the other self in black-figure. It is the mechanism of the palette's arc: only in the reflection in chorus 1, seeping above the line through chorus 2, the whole frame in chorus 3.

## Song map (from `data/monster/audio.json`, `data/monster/lyrics.json`)

90.0 BPM, 4/4, constant (bar = 2.667 s). No drums or bass for the first 69 s; drums drive verse 2; they drop out mid-chorus 2; the bass enters at 141 s and the bridge builds to the song's peak at 157–163 s; the final chorus and outro run at full power; a sudden hush at 208 s and one last orchestral hit at 210.7 s.

| plate | window (approx) | lyric | idea |
|---|---|---|---|
| `strike` | 0:00–0:04.7 | intro | Black. A flint strikes on the first downbeat; the flame catches; the meander frame draws itself as one line. |
| `questions` | 0:04.7–0:26 | How has everything… / How did suffering… / How am I to reunite… / Do I need to change? | Four questions, four turns of the flame: "turned against us" (the words turn their backs), "endless" (the line rides a meander that never ends), "estranged" (the line splits across a widening sea), "change" (the flame gutters and the shadow of CHANGE changes shape). |
| `shades` | 0:26–0:44 | I'm surrounded by the souls… / …line I haven't crossed / …across the sea / Is me? | The flame set on the ground; long shadows of the dead ring it, with no one casting them. A line in the dust: every shadow lies beyond it but his. The line becomes the horizon; "Is me?": his reflection's shadow stands up. |
| `hook` 1 | 0:44–0:46.5 | What if I'm the monster? | The shore of black water; the line is the waterline. A clay oil lamp floats at the left. The question is voiced top left; MONSTER? stands up on the waterline as it is sung, bone, lit. Its reflection is black-figure on the clay's orange and has no question mark; the orange develops in the water as the word is sung and breaks into ripple bands with depth. On the word the camera dips until the waterline crosses the middle of the frame. |
| `mirror` | 0:46.5–1:09 | …in the wrong / …hiding all along / …caved to guilt / …far too kind to foes, but a monster to ourselves / What if I'm the monster? | The shadow hides behind each word; "caved" folds the frame into a cave; "kind to foes / monster to ourselves" is the scale's first cameo. |
| `cyclops` | 1:09–1:19.7 | Is the cyclops struck with guilt… | The cave mouth is the eye, the boulder its pupil. Open at night under the moon; tally marks of men struck off on the rock; on "sleep" the boulder rolls back: the eye shuts. |
| `circe` | 1:19.7–1:30.3 | When the witch turns men to pigs… | A cup seen from above. MEN reflected in the potion re-forms as PIGS; the surface spirals ("insane"), then freezes ("colder… older"). |
| `poseidon` | 1:30.3–1:41 | When a God comes down… | An engraved sea of wave scrolls and a fleet in hull outlines; three lines (the trident) come down and the fleet drowns; the sea goes flat and silent ("no one dares"). |
| `horse` | 1:41–1:50.4 | Does a soldier use a wooden horse… | The horse as a carpenter's construction drawing, x-rayed: the soldiers inside are hatch marks; the city's lamps go out ("sleeping Trojans"); VILE re-letters itself into GUILE; REMORSE is thrown off. |
| `hook` 2 | 1:50.4–1:55 | If I became the monster… | The same shore, the conditional: hairline type; the orange of the reflection creeps a little way above the waterline. |
| `scale` | 1:55–2:15.4 | …threw that guilt away / …foes at bay / …everyone but us / …got home again / …unjust | GUILT is thrown off a pan and the beam drops; the foes are kept outside a bay on a chart; a circle drawn around "us"; home is a point of light on the horizon; on "unjust" the beam snaps. Drums out from 1:55 to 2:03, back for "home again". |
| `creed` | 2:15.4–2:23.3 | Oh, ruthlessness is mercy upon ourselves / And deep down I know this well | Poseidon's creed carved in Cormorant on a frieze; RUTHLESSNESS slides into MERCY's place; "deep down": the camera sinks under the line. |
| `losses` | 2:23.3–2:29 | I lost my best friend… / Five hundred men gone… | A funerary stele; three epitaphs carved and darkened; then five hundred small flames in a grid go out on "gone". |
| `course` | 2:29–2:38.5 | I must get to see Penelope and Telemachus / …dangerous oceans… / …where Poseidon won't reach us | An engraved sea chart; the two names in the dawn accent; the course plotted around the god's reach (a range ring). |
| `wall` | 2:38.5–2:43.6 | And if I gotta drop another infant from a wall / In an instant… | Restraint: Troy's wall in engraved masonry and the words alone on its coping. No figure. (Exact treatment: open question.) |
| `hook` 3 + `blackfigure` | 2:43.6–3:07 | Then I'll become the monster / I will deal the blow / …lurking deep below / …make it home | Black-figure: the frame floods orange, MONSTER is a black silhouette with incised detail. "Deal the blow": the line is crossed, the frame cut along it. "Deep below": under the waterline, the monster's shadow under the hull. "Home": the dawn on the horizon. |
| `outro` | 3:07–3:38.7 | (Monster) Penelope (Monster) Telemachus … I'll become the monster | The shades chant MONSTER from every side; each name answers small, in the dawn accent. On the last line the shadow closes over the flame; the hush at 3:28; the final hit at 3:30.7 strikes the spark of the first frame: loop. |

## Decisions (client)

- Concept: Shades (this treatment).
- Palette: P(doom)'s plus the dawn accent.
- Extras: the names of the dead (Polites, Athena, Anticlea) carved on the stele in `losses`; small EPIC easter eggs hidden in plates (an owl feather for Athena, the bag of winds, the stake).
- No Greek inscriptions; no dry footnotes.
- The "infant" line is handled with type only, no figure.
- The palette moves toward black-figure gradually and very subtly across chorus 2; the full flip is chorus 3.
- Final render: the command-line pipeline (headless Chrome + x264, as P(doom)) on a GPU machine.
- Hook 1: the reflection is the future (black-figure, in the water) and has no question mark.

## Open questions

1. Which machine renders (the render bench, `app/src/bench.ts`, measures each candidate) and so how heavy the 3D plates can be.
