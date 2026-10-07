# Monster — treatment & style bible (draft 1)

> **Revision 2 pending (client review of pilot v5):** no visible flame anywhere (its shadows stay), no line fields on floors or water, and the opening becomes Polyphemus, Circe, Poseidon and the Trojan horse. The through-line that replaces the flame is still open. Until this treatment is rewritten, `docs/HANDOFF.md` "Pilot v5 review" overrides anything below that conflicts with it.

A code-rendered, word-synced music video for "Monster" (Jorge Rivera-Herrans, *EPIC: The Musical*, The Underworld Saga), on the P(doom) engine (`docs/ENGINE.md`) and its design rules (`docs/TREATMENT.md`): every frame a pure function of song time, karaoke per word, cuts and hits on the analysed beat grid, one restrained palette, one type system, concrete objects treated as visual puns and transformations, never storyboard illustrations of the lines. Where P(doom) drew everything as an engraving, Monster's surfaces are Greek vase painting: clay, black glaze, and lines reserved in the clay (Grammar rule 9).

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

## Grammar (revision 1, after the client's review of the first verse frames)

The first build of verse 1 read as subtitles over a quiet scene: two-line couplets in one setting at top left, unsung words shown for seconds, one slow crane for 40 s, an empty frame with a small flame. P(doom)'s own rules forbid all of it (`docs/TREATMENT.md`: words are part of the image, anticipation ~0.4 s, something always moving). Every plate now follows these rules (client-approved):

1. **One phrase on screen**: 1–4 words, each appearing as it is sung (≤ 0.4 s anticipation); the phrase is pushed out on the next beat. No couplets, no ghosted unsung text.
2. **One hero word per line** at frame scale (Archivo condensed/black, or carved), the rest of the line small.
3. **The type is a physical thing in the flame's world**: letters that stand and cast shadows, carved, painted on clay, floating, burned in by the flame. The lit word is what he sings; its shadow is what it means.
4. **Something happens every bar** (2.67 s; every 2 beats in the choruses and the bridge): sub-cuts, whips, orbits, pushes, snaps, easing into downbeats. The flame travels like P(doom)'s spark, so the shadows sweep.
5. **Full-frame engraved detail** with a full value range in every shot; the flame shown big in close-ups.
6. **A Greek medium per plate** (shadow theatre, red- and black-figure vase painting, carved frieze, stele, sea chart, masonry, bronze), one palette and type system throughout.
7. **Every word lands on its sung onset** (client note on pilot v1): no fade-ins on word entrances; 3D letters spring up starting 45 ms before the onset so they stand as the syllable sounds (`POP` in `app/src/monster/stage.ts`); camera hits and impacts key to the word onsets, not the nearest beat. The aligned word starts sit on the vocal onsets (median 30 ms early), so the data need no offset.
9. **The surfaces are Greek vase painting** (client choice, replacing P(doom)'s engraved line fields, which hurt readability behind the souls): walls are lit clay, so every shadow on them is black-figure painting (black figures on the clay, after which the palette arc is named); floors are black glaze, glossy, mirroring the flame, the walls and the letters; lines appear only as decoration reserved in the clay (meander bands, rings, the line, painted waves on water), never as an all-over texture. Letters are added white (bone faces) with black-glazed sides. Implemented in `app/src/monster/stage.ts` (the vase path, default on).
10. **No visible flame; the light is a fire behind us** (client, pilot v5 review: the flame sprite read as pasted on and was usually the brightest thing in frame). Every plate is lit by one unseen key light behind the camera, over its right shoulder (`keyLight()` in `app/src/monster/stage.ts`, or a fixed world point where the shadows must be exact); it breathes and flares on the 'orch' hits as the flame did. Its highlight on the glaze is kept low (`spec`), since its mirror image would be a flame again. Plato's cave: we see the shadows on the wall, never the fire. The through-line is each hero word's **dark double** (its shadow on clay, its reflection on water), growing plate by plate until it covers the frame in chorus 3; the four monsters of verse 2 are its vocabulary (`app/src/monster/figures.ts`).
11. **Water is a black mirror, wine-dark** (client): no line field on any floor or water; swells show only by bending what the surface mirrors (`swell`, `wine`, `reflBend` in `StageSurfaces`).
8. **Supporting words are physical too** (client note on pilot v1: "the rest of the words appear somewhat flat and understated"): no flat 2D captions; every word of the line is a thing in the shot (smaller 3D type in Archivo 112.5/600, burned into the frieze, standing on the token's rim, in the ring of souls, floating on the sea), popping on its onset and lit by the flame.

## Motifs

1. **The fire behind us** (never seen) and the **dark double** it gives every hero word: the through-line (Grammar 10). Every shadow in the video is cast by it.
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
| `everything` | 0:00–0:09.4 | (intro) / How has everything been turned against us? | The opening, in the cave, one shot with the first line. The fire behind us comes up with the swell on the clay wall, and on it, one per musical event, the shadows of verse 2's four monsters, each turning into the next (`figures.ts`): Polyphemus over his flock (sheep reserved in the clay; his one eye opens at the top of the swell), Circe at her cup on the bass note (the man on all fours at it becomes a pig), Poseidon on the rising figure (the wave heaves and curls into a scroll; an arm drives the trident up through it on 3.01; the galley pitches up on 3.34), the wooden horse (rolls in on 3.67, its hatch opens on 3.84, a rope ladder drops on 4.18). "How has" stands up under the horse. On "everything" the camera is thrown back and the word folds up from the floor; its shadow is a frieze of all four monsters, each unfolding with its letter (E, R, T, N). On "turned" their eyes open on us (archaic frontal eyes, glowing); "been turned", then "against" and a larger "us?" (7.60) stand in the band below the word; on the figure's notes (8.00/8.34/8.67/9.00) the monsters rush at us one by one, swelling and blurring, until the wall is black. |
| `endless` | 0:09.4–0:14.7 | How did suffering become so endless? | From above: a Greek-key frieze in the glazed floor; a straight groove beside it glows as it is cut: its white-hot cutting point runs with the voice and burns the line ("how did SUFFERING become so") into the inscription band, reaching each word on its onset; burned words keep an ember glow. On "so" the camera corkscrews down: the groove bends into an infinity loop (client idea), the cutting point runs it with a comet's tail (the "loading" chase), and ENDLESS? pops letter by letter as the point reaches each on its syllable: E-N-D-L on the left lobe's near arc, E-S-S-? on the right lobe's far arc, so every lap passes them in reading order. The lap closes on the cut. |
| `symbolon` | 0:14.7–0:19.4 | How am I to reunite with my estranged? | A symbolon (the tally two guest-friends broke and each kept half of): a black-glazed clay disc, REUNITE reserved in the clay across a jagged break, afloat on black mirror water, wine-dark. "How am I to" stands on the left half, facing us; the halves slam shut on "reunite"; "with my" stands on the right half. On "my" the camera sinks to the water and looks out to sea: on a far shore, against the first dawn (the accent's first use), Penelope sits at her loom, faceless, head on hand (the Chiusi skyphos pose). On "estranged?" the halves part and a dawn thread from her loom, across the water, writes the word between them in a connected script as it is sung; then she draws it back and the word unravels toward her. |
| `change` | 0:19.4–0:25.4 | Do I need to change? (+ the bar after) | Shadow play proper: CHANGE? stands in a row before the clay wall, lit by the fire behind us. From the 21.36 downbeat, one letter per eighth note snaps round and comes back black-glazed, each throwing a bigger shadow than the last (done 23.4). On the figure's notes (24.01/24.35/24.67/25.01) the shadow becomes the four monsters, one per note: C-H Polyphemus, A-N Circe, G-E Poseidon, ? the horse. |
| `souls` | 0:25.4–0:36.0 | I'm surrounded by the souls of those I've lost / I'm the only one whose line I haven't crossed | A round chamber lit by the fire behind us. On every word a shadow of a man stands up on the wall, cast by no one; SOULS folds up in a ring and each of its letters throws a person, not a letter. Sub-cut to floor level: on "line" a white-hot point sweeps across the floor cutting a line, and the line becomes the edge of our light (beyond it the floor goes dark); LINE is burned in on our side in anamorphosis (it reads from the camera). Every shadow lies beyond the line; the camera cranes up to see it. |
| `sea` | 0:36.0–0:43.4 | What if the greatest threat we'll find across the sea / Is me? | His side of the line is now the sea: black mirror water, wine-dark, its swells shown only by the reflections they bend; the far shore a burning line. THREAT stands up on the shore, black, with its broken reflection; "across the sea": the camera is pulled back over the water and the word sinks; the burning shore cools to a bone hairline as the frame settles into hook 1's (waterline 0.71 H); "Is me?" stands on the water. |
| `hook` 1 | 0:44–0:46.5 | What if I'm the monster? | The shore of black mirror water, wine-dark; the line is the waterline (the lamp is gone, client OK). The question is voiced top left; MONSTER? stands up on the waterline as it is sung, centred, bone, lit by the fire behind us. Its reflection is black-figure on the clay's orange and has no question mark; the orange develops in the water as the word is sung and breaks up in the swell with depth. On the word the camera dips until the waterline crosses the middle of the frame. |
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
- Revision 1 grammar (above): one phrase + hero word, an event every bar (2 beats when loud), a Greek medium per plate. Verse 1 is rebuilt first as the pilot and reviewed as a clip before any other plate.

## Open questions

1. Which machine renders (the render bench, `app/src/bench.ts`, measures each candidate) and so how heavy the 3D plates can be.
