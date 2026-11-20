# Teeth v2 — "Dental Records": treatment & style bible (draft 5, after the gate 2 calls)

A code-rendered, word-synced music video for "Teeth" (5 Seconds of Summer) on the P(doom) engine (`docs/ENGINE.md`). Every frame is a pure function of song time; lyrics are aligned per word (`data/teeth/lyrics.json`); cuts and hits sit on the analysed grid (139.0 BPM, one bar = 1.727 s; `data/teeth/audio.json`). The quality bar is the P(doom) video: a different visual idiom per plate, ray-marched 3D where it earns it, adaptive motion blur, grain and halation, a true 4K60 render.

Audio: `audio/teeth.mp3` (not committed). It sits within ~5 ms of v1's timing data with no drift (cross-correlated against the vocal onsets, 2026-11-17), so `data/teeth/*.json` is used unchanged.

Draft 3 folded in two gauntlet rounds on paper (`docs/TEETH2-LEDGER.md`): the twist made legible by a monogram, eight repeats removed, four v1 carry-overs replaced, the forensics corrected, motion added to the slow plates. Draft 4 folds in the client's answers on the taste calls (end of this file): the monogram is **T.F.**, the stakes guards, and the voicemail splice made into a clue.

## The idea in one paragraph

**A forensic odontologist builds a bite-mark case against the woman he loves, and the bite turns out to be his.** The narrator is the examiner. Every plate is an exhibit from case **08-32 · BITE MARK**, each in its own forensic technique and its own look: a radiograph on a lightbox, an empty bed under a work light, a polygraph, the bite photographed against an ABFO scale, a pillowcase under UV, a dental chart, a forensic audio edit, a stone cast poured and trimmed, an articulator, a shirt under luminol, an acetate tracing. Throughout, a gloved hand signs each exhibit with the same **monogram**, a single-stroke mark big enough to register as a shape. The case builds against "you" for two choruses. In the bridge his shirt goes into an evidence bag and the NAME field is left blank. In the last chorus the tracing of the bite is laid over the stone casts of one suspect after another, on the beat, until the last cast locks into it on "your heart got **teeth**", chip and all: it is the cast we watched him pour, and the gloved hand signs the monogram into its blank NAME field. The only red in the video arrives on that word. The accusation becomes a confession he reads at the end, and the song's lines about identity ("you turn into somebody I don't know", "you're looking at me like you don't know who I am") turn to face him. The video opens and closes on the same steel drawer of case files: it loops.

## Binding rules (from the client's notes on v1)

1. **No repeated visuals.** No plate, shot, trick or exhibit appears twice; repeated lyrics (two pre-choruses, six chorus halves) get different exhibits and different instruments; nothing from v1 (jaws snapping on words, Rorschach cards, sheets with words in them, the ring, the blooming-rose stain, handprints, spring-back camera, the clamp that will not let go). The one deliberate echo is the bookend drawer, mirrored, 4 bars each way.
2. **Every image makes sense**, at a glance and in forensic logic. Each light, shake or flash has a source in the scene. Nothing decorative that reads as debris.
3. **No HUD, counters or readouts.** No on-screen number ever changes value. At most one readable label per plate, never along the bottom edge. Lab text lives only inside objects. The engine HUD is off in every render; the frame checker fails any text in the HUD corners.
4. **Constant motion at P(doom)'s level.** Something happens every bar; sub-cuts, reframings, holds and snaps, camera moves easing into downbeats; big changes on downbeats; hits on the kick and snare. No breathing zooms, no rush at the camera, no screensaver drift.
5. **Visually exciting, not clinical.** Deadpan only in the small lab text. No gore, no horror, no wounds, no faces, no realistic eyes; people are present through gloved hands, marks and their teeth. The case is a **bite mark**, not a killing. **Stakes guards** (the crime stays implied and never reads as violence to her): no body shapes, outlines or stains on the bed; no spatter, drips or tears anywhere; the only blood is the one bloom over the heart of *his* shirt; nothing of hers is ever damaged or found, the exhibits are only things she touched (the apple, the pillowcase, the voicemail) and his own things (the shirt, the cast, his chart).
6. **Not slop.** No neon, no glowing particle clouds, no lens-flare soup, nothing that looks AI-generated. **UV violet appears in one plate only** (6, where a UV lamp is on). Luminol blue in one plate only (11).

## The clue ledger

| clue | planted | pays off |
|---|---|---|
| **The monogram**: **T.F.**, one single-stroke mark, signed by the gloved hand on a beat | plate 2 (on the film's tag, ~9.9 s), plate 7 (on the chart, ~83 s), plate 11 (on the bag seal; the NAME field above it left blank on "who I am") | 165.16: the same hand signs the same mark into the matched cast's blank NAME field |
| **Tooth #8 chipped** (upper right central incisor, a diagonal chip off its inner corner) | the radiograph (plate 2, the loupe's target); the bite in the apple (5); the poured cast (9) | the chip is the last thing to lock in at the match |
| **The cast** | plate 9: he pours and trims a stone cast of a set of teeth, unlabelled | plate 13: the matching cast is that one |
| **His chart** | plate 7: only a corner of a second chart shows under hers, #8 marked | plate 14: the full chart goes into his folder |
| **The splice** | plate 8: the gloved hand itself makes the razor cut in her voicemail on "lie" | the lie was his edit; the glove is the one that signs T.F. (a second-viewing clue, visible on the first) |
| **Empty name fields** | the monogram only ever appears where a *signature* goes (film tag, chart, bag seal); name fields stay blank: the polygraph's SUBJECT (plate 4), the bag's NAME (plate 11) | the one name field ever filled is the matched cast's, with his monogram (165.16) |

## Tone

Fast and physical. The lab's instruments (camera flash, UV lamp, vibrator table, model trimmer, articulator, polygraph pens, tape-machine playhead) are the percussion section, each motivated: a flash fires because a photograph is taken; a table shakes because stone is being vibrated. The stomp is first heard at 48.73 and the first flash in the video is on it. The lab voice is factual and dry, and the only place for humour.

## Palette (2A, Lightbox / UV): `app/src/teeth2/palette.ts`

| token | hex | role |
|---|---|---|
| **film** | `#070A10` | the ground: blue-black radiograph film base |
| **film2** | `#0F1520` | panels, deep shadow |
| **silver** | `#6E7682` | silver-halide mid-grey, hairlines |
| **halide** | `#A9B0B8` | light grey, unsung type, film detail |
| **lightbox** | `#F1F3EE` | cold white: lightbox, paper, type; crisp, never blooms |
| **uv** | `#6A2CFF` | UV violet: plate 6 only, only where the lamp is on |
| **fluor** | `#CFF4FF` | fluorescent blue-white: what glows under UV (plate 6) |
| **luminol** | `#3FA9FF` | luminol blue: plate 11 only |
| **wax** | `#E58FA0` | baseplate-wax pink: the tender register ("sweet", "pretty", "rose", "wife") |
| **stone** | `#E8C35A` | dental-stone yellow: the golden apple (plate 5) and the casts (plates 9, 10, 13): the bite and the cast share a colour |
| **tungsten** | `#FFB46A` | warm lamp: plate 3 only (the bed), never near 165.16 |
| **match** | `#FF2A1F` | red: first on "teeth" at 165.16; on the matched outline, the monogram and the stamp; drains as the folder closes (~186 s) |

Light plates (polygraph, chart) invert to lightbox white with film-black ink. Only uv, fluor, luminol and match may glow. Values are tuned on the gate 2 stills.

## Typography

- **Archivo** (width 62–125, weight 300–900): his voice, the sung lyric. Wide and light in the verses; condensed and black on the hits.
- **IBM Plex Mono**: the lab, inside objects only.
- **Cormorant Garamond italic**: the tender register, in wax pink.
- **Single-stroke fonts**: words drawn by a pen (polygraph, acetate) and the monogram.
- Craft rules from `docs/TREATMENT.md` unchanged.

## Karaoke rules

- A word appears or lights at its `start` (letters spring up ~45 ms ahead) and completes by its `end`; nothing shows more than 0.4 s early; no fade-in entrances.
- One phrase on screen (1–4 words of the line being sung); a line leaves on the next beat after it ends.
- One **hero word** per line at frame scale, readable at a glance, frontal, inside title-safe (96 px). Supporting words are physical things in the scene, never flat captions.
- States (client, gate 2: treatment A): unsung halide at ~35%, sung lightbox white, the hero in its plate's idiom; the hero word also snaps from light to heavy weight on its onset (borrowed from treatment B). ~~Letter positions locked so nothing reflows~~: superseded by kinetic type below.

## Kinetic type (client, 2026-11-20, during gate 3; binding)

The lyric is **motion-graphics type at P(doom)'s level**, not still words in a moving world. The client's three calls:

1. **Both layers.** Supporting words stay in each plate's world (bitten, engraved, written, printed, glowing), but they move like motion graphics on that surface. Hero words may break out of the world as **full-frame graphic slams** (P(doom)'s hook idiom). A slam is flat palette fills in Archivo 900, with no outlines or halos. It takes the plate's grain, halation and motion blur, so it sits in the shot.
2. **Escalating.** The type moves in the verses, builds in the pre-choruses and is maximal in the choruses. The bridge and the outro drop back.
3. **Prototype first.** One shared kit, shown as clips on three contrasting plates before it reaches all 14.

**The vocabulary** (one shared kit, `app/src/teeth2/kinetic.ts`; every move is keyed to the beat grid and the kick and snare onsets in `audio.json`):

- **Spring:** letters arrive per glyph, staggered 15–25 ms, with overshoot and settle.
- **Stretch and condense:** Archivo's width (62–125) and weight (300–900) axes move. Stretch on kicks, condense on snares.
- **Track:** letter-spacing opens and closes on the beat.
- **Stamp:** the hero lands oversized and settles, with a frame shake on its onset.
- **Slide and lean:** a word drifts or leans further on each beat (cumulative, like P(doom)'s ASKEW).
- **Pressure:** copies of a word condense and pack the frame on successive kicks, for the pre-chorus build.
- **Break:** a hero's letters split along the plate's own motif: bite scallops, the razor's diagonal, a pen stroke, a crack in stone. **Stakes guard: never into drips, blots, blobs or spatter.**
- **Exit:** every line leaves with a move on the beat after it ends: collapse, slide-out, wipe or swallowed by the next cut. Never a fade or a hard pop.

**Escalation by plate:**

| plate | energy | type |
|---|---|---|
| verses (`lightbox`, `scene`, `chart`) | low | spring, track, slide; only the line's hero stamps |
| pre-choruses (`polygraph`, `voice`) | rising | pressure builds bar by bar; condense on snares; lean |
| choruses (`scale`, `uv`, `pour`, `articulator`, `match`) | maximal | every hero stamps or slams full-frame; stretch on kicks; breaks |
| stripped chorus 3a (`acetate`) | eerie | hairline weights, small and slow, lots of black |
| bridge (`luminol`), outro (`filed`) | falling | slow tracking and drift; the last words held |

**The TEETH hook:** TEETH, in each "got teeth" line, is one recurring slam whose look escalates on each return, as P(doom)'s hook did.

**Still binding:**
- Readability at a glance, one hero per line, and the hero reaching frame scale.
- Nothing more than 0.4 s early, and the word lit at its `start`.
- The palette, including red only from the match.
- The craft rules: kerning and typographic punctuation, no outlined or haloed type.
- The stakes guards.
- "Supporting words are physical things, never flat captions": the supporting words. Only heroes may go full-frame graphic.

## Song map and plates

| # | plate | window (s) | lyric | technique / look |
|---|---|---|---|---|
| 1 | `drawer` | 0 – 7.23 | intro riff | ray-marched steel drawer under a cold overhead tube |
| 2 | `lightbox` | 7.23 – 21.10 | Some days you're the only thing I know… | backlit panoramic radiograph, silver film |
| 3 | `scene` | 21.10 – 34.64 | Sometimes you're a stranger in my bed… | empty bed under a raking work light, evidence markers |
| 4 | `polygraph` | 34.64 – 48.73 | pre 1 | light plate: chart paper, four pens |
| 5 | `scale` | 48.73 – 62.54 | chorus 1, first half | bite-mark photography: an apple, an ABFO No. 2 scale, flash on every beat |
| 6 | `uv` | 62.54 – 76.35 | chorus 1, second half | a pillowcase under a hand-held UV lamp |
| 7 | `chart` | 76.35 – 90.16 | verse 2 | light plate: odontograms on a light table |
| 8 | `voice` | 90.16 – 103.98 | pre 2 | forensic audio: a voicemail on tape, its waveform and spectrogram, the splice he cuts |
| 9 | `pour` | 103.98 – 117.79 | chorus 2, first half | stone vibrated into a teeth impression; the cast trimmed |
| 10 | `articulator` | 117.79 – 131.60 | chorus 2, second half | chrome articulator on a lit studio card, the casts gliding |
| 11 | `luminol` | 131.60 – 145.41 | bridge | dark room, a shirt, luminol |
| 12 | `acetate` | 145.41 – 159.23 | chorus 3a (stripped) | the bite traced on acetate over a print, under a desk lamp |
| 13 | `match` | 159.23 – 174.77 | chorus 3b | the tracing over suspects' casts, then the match |
| 14 | `filed` | 174.77 – 204.96 | Teeth ×3, never let go, riff, hard stop 200.7 | inside folder 08-32, the cabinet bank, the drawer closing |

### 1 `drawer` — intro (0 – 7.23)
A bank of steel filing cabinets under one cold overhead fluorescent tube. The loop frame: a drawer open a hand's width, folder **08-32** standing proud of the rest. On the riff's first note the drawer rolls fully open; on each real riff note a hanging folder flicks forward, stopping dead in the riff's gaps (2.05–2.94, 5.50–6.39), the camera's dolly along the rail carrying the speed; the flicks stop on 08-32 (its tab: **08-32 · BITE MARK**, the title as a file label). On the last beat the folder is lifted and opened, the camera tipping down into it, and we whip in, cutting on the first sung word.

### 2 `lightbox` — "Some days you're the only thing I know" (7.23 – 21.10)
A lightbox's tube strikes, two flickers on the first downbeat, then cold white behind a panoramic radiograph of a full set of teeth. The camera tracks slowly along the curve of the jaw, pushing in on downbeats. The sung words are **radiopaque**: bright silver in the film, as fillings are, each coming through as it is sung. Between the lines (9.3–10.8) a gloved hand clips a tag to the film's corner and signs it: **the monogram**, first sighting. "burning": the tube overexposes the film to white. "the nights grow cold": the tube cools and dims, the film going grey-blue, the teeth faint. "Can't look away, can't look away": a loupe pushes in to tooth #8 in two steps, one per phrase: the chip. "Beg you to stay, beg you to stay, yeah": each STAY comes through in a new filling as the camera snaps tooth to tooth along the arch, and on "yeah" the arch's fillings light one after another back to the last molar.

### 3 `scene` — "Sometimes you're a stranger in my bed" (21.10 – 34.64)
A top-down shot of an empty, unmade bed, no one in it, the one warm plate in the video: the bed sits in a low tungsten glow (a bedside lamp, the memory of the room), and the investigation's cold work light rakes across it. It reads as *left*, not as harm: the covers thrown back on one side as by someone getting up, the other pillow bare (its case is already bagged: plate 6's exhibit), no body shape, no stain. Evidence markers are set down on the sheet on the bass notes, each a placard carrying the hero word, the words never in the sheet itself: **STRANGER** (marker 1, the biggest); "love me, or you want me dead": two placards, LOVE and DEAD, the work light swinging between them on its arm. "Push me away, push me away": on each "push" (28.01, 29.30) the focus is pulled away, racking from the near markers to the far edge of the bed, the near words dissolving into blur (an optical distance, nothing shoved). "beg me to stay": the work light's swing lands on the marker STAY, the only thing in focus. No flash here: the first flash in the video belongs to the chorus.

### 4 `polygraph` — pre-chorus 1 (34.64 – 48.73)
Light plate. The cut lands on 34.64; the paper starts scrolling and the pens drop on the synths' downbeat at 34.91. Four pens (two pneumo, cardio, skin conductance). The lyric is written by the cardio pen in a single-stroke hand, the trace climbing out of its line into letters. "Every little lie gives me butterflies": on "lie" the cardio pen jumps a full channel high and stays a jagged trace; on "butterflies" all four pens tremble at once, a fast nervous flutter across every channel, the paper shivering under them (the butterflies as the body's tell, no wing shapes). "looking through my eyes": the camera goes under the paper and looks *through* it, the trace reversed against light. "make it out alive": the cardio pen races, the trace tightens, and on the downbeat into chorus 1 the pen tears through the paper. The header, small: SUBJECT, left blank.

### 5 `scale` — chorus 1, first half (48.73 – 62.54)
Bite-mark photography, and the first stomp. A bitten **golden apple** (stone yellow: the same colour as the cast he pours in chorus 2) on black velvet, the bite photographed face-on as bite marks are, a white L-shaped ABFO No. 2 scale lying beside it in the bite's plane, the camera on a tripod. **The stomp is the shutter: every beat a flash**, every flash a new photograph, cutting on every beat, varied in distance and lens (the wide exhibit, macro on the arc, the ruler's edge, the bite in profile, the chip), never cycling. The supporting words are bitten small and shallow as they are sung; the hero words deep. Each hero word is **bitten into the apple's flank** (Archivo condensed black, the letter rims scalloped at tooth width with slightly torn skin), landing on the raking-light frames so their relief reads: DIRTY, SWEET (wax pink, Cormorant), PRETTY, TEETH; DEVIL, HANDS, NEVER, GO. The chip on #8 shows in every bite as a small unbitten wedge in the scalloped rim (and as a notch in the T over #8's position). One label in frame: 08-32 · EXHIBIT 4.

### 6 `uv` — chorus 1, second half (62.54 – 76.35)
A different exhibit: the pillowcase from the bed, laid out on the bench in the dark. A gloved hand sweeps a UV lamp across it on the beat, and where the violet beam passes the dried saliva fluoresces fluor-white, each sung word revealed by the beam and sinking back into dark behind it, the camera tracking with the lamp. "put your hands on me": the glove swabs the glowing trace, one stroke per word, and each stroke lifts the glow onto the swab. "never, never, never ever": three sweeps, faster each time; on "let go" the beam holds still on GO and its glow decays slowly into the dark (the one plate where the word fades by itself). The only violet in the video.

### 7 `chart` — verse 2 (76.35 – 90.16)
Light plate, with the drums: a snare on every beat from 78.91. Her odontogram (32 teeth drawn as a numbered diagram) on a light table, filled in with a fine pen, strokes on the snares, the camera jolting to a new reframing on each kick. "the best thing in my life": the chart fills with neat hairline fillings and crowns. "I see my wife": the header is written in wax-pink Cormorant, *wife*, and the gloved hand signs **the monogram** under it. Under her chart, just a corner of another one shows, #8 marked. "you turn into somebody I don't know": her chart's markings move on every beat, fillings jumping from tooth to tooth, crowns swapping, until it describes someone else. "push me away, push me away, yeah": her chart empties, one quadrant of teeth per phrase, the pen marks lifting off the paper until only the blank diagram is left, the corner beneath still mostly hidden.

### 8 `voice` — pre-chorus 2 (90.16 – 103.98)
Forensic audio. Her voicemail ("Call me in the morning"), dubbed from the answering machine's microcassette onto quarter-inch tape that runs across a splicing block, the bright waveform drawn above it on the lab's monitor, scrolling under a playhead, a spectrogram building beneath it from a precomputed analysis of the vocal stem. Each hero word sits in the waveform's envelope, the letters shaped by the sung sound. "Every little lie": **he makes the edit**. The gloved hand (the one that signs T.F.) lays a razor in the block's 45° slot and cuts the tape on "lie", and the waveform splits at that instant with a slanted gap of silence (a diagonal splice leaves exactly this tell); a strip of splicing tape joins it. "gives me butterflies": the two halves are slid back and forth against each other, failing to line up. On a first viewing it reads as tampering; after the match it reads as *his* lie. "looking through my eyes": the playhead scrubs back over the line, the waveform reversing. "make it out alive": the waveform swells to clip, its peaks flattened, and at 103.98 the flat top of the clipped wave match-cuts to the flat, level surface of wet stone.

### 9 `pour` — chorus 2, first half (103.98 – 117.79)
Stone in an impression of a set of teeth, unlabelled, on a dental vibrator table. **The table shakes on every stomp**: ripples run across the wet yellow stone and bubbles rise to the surface and burst. Each hero word **sets in stone**, rising out of the surface as a raised relief and hardening from wet gloss to matt by its end; SWEET in wax pink set into the yellow. "heart got": the whole surface sets, gloss to matt in one wave; on "teeth" a hard cut (the time jump is the cut): the cast turned out of the impression, teeth in stone, the chip on #8. "Late night devil, put your hands on me": the cast sits still on the bench under a raking light that crosses it on each word, the relief words on its base hardening one by one, HANDS last. "never, never, never ever let go": the base is ground on a spinning model trimmer, a burst of stone dust on each "never", and on "let go" the trimmer stops dead and the dust settles.

### 10 `articulator` — chorus 2, second half (117.79 – 131.60)
The casts mounted on a chrome articulator, lit against a white studio card it reflects. A strip of articulating paper lies between the casts. On the non-hero beats the upper cast glides side to side and forward over the lower, the camera tracking like a machine part, and each glide leaves film-black contact marks on the yellow cusps (the paper's ink transfers to the teeth, as it does in practice). **The casts close only on each line's hero word** (SWEET, TEETH, HANDS, GO). The words are engraved into the articulator's chrome arms and scale, unreadable until the swinging arm catches the white studio card in its reflection and the word flares into legibility as it is sung. "put your hands on me": the incisal pin drops into its guide table, one click per word. "never, never, never ever let go": three wide glides, and on "let go" the articulator swings open and the upper cast lifts away and out of frame (the only literal letting go in the video).

### 11 `luminol` — bridge (131.60 – 145.41)
No drums. A dark evidence room; a man's shirt on a hanger, the camera circling it slowly and stopping on each phrase. A gloved hand sprays luminol, and the spray itself is invisible: only where it lands does blood glow blue, in one soft bloom over the left chest, where his heart is (no spatter, no drips, no tear: his own wound, not someone else's), re-sprayed on each vocal phrase. The lyric is printed in Archivo on the clear face of an evidence bag hanging in front of the shirt, lit only from behind by the glow, so each word reads when the stain flares behind it; the hero words large (SHIRT, *rose*, WHO, HEART, BEATING). "rose in my hand": *rose* is set in wax-pink Cormorant, the one warm thing in the room. "You're looking at me like you don't know who I am": the bag's label in close-up, NAME:, and the gloved hand's pen stops; NAME stays blank, the bag still open. "heart in my hand / Still beating": the shirt glows and fades twice, a re-spray on each phrase. On the 143.69 downbeat the shirt is in the bag, the seal comes down, and the hand signs **the monogram** on it; hard cut.

### 12 `acetate` — chorus 3a, stripped (145.41 – 159.23)
A dark desk under a single angled lamp; a 1:1 print of the apple's bite with a sheet of clear acetate taped over it. A fine pen traces each tooth's edge onto the acetate, and the camera follows the pen along the arch, holding and snapping to a new framing on each bar. The lyric is printed on the photograph beneath in Archivo, and shows only where the traced line has already passed, as if the pen's path were uncovering it; the hero words large (the strongest vocal in the song is here). The lamp's light kicks with the kicks at 152.37–152.99. By the end the acetate holds the whole arch, the chip at #8, and the line's last words are uncovered.

### 13 `match` — chorus 3b (159.23 – 174.77)
Drums back. The tracing is laid over the top-down photo of one suspect's stone cast after another, **one per beat**, each arch visibly different (a gap, crowding, a missing tooth), each failing to line up, the camera riding the stack. The last cast lands on the 164.41 downbeat ("heart"), slides into place on "got", and on "**teeth**" (165.16) locks, every tooth and last the chip on #8: it is the cast from plate 9. The lyric rides on the acetate: each line is written onto it in the tracing pen's hand at the top of the sheet, so it stays still and readable while the casts flash beneath; TEETH is the largest word on the sheet. On 165.16 the traced outline and TEETH go **red**, the first red in the video, and the gloved hand signs the monogram into the cast label's blank NAME field, in red. "Late night devil, put your hands on me": the red outline closes around one tooth group per word, front teeth to molars. "never, never, never ever let go": the camera walks the matched arch tooth by tooth on the beat and ends on the chip as the stamp MATCH comes down on GO, the plate's one readable label.

### 14 `filed` — outro (174.77 – 204.96)
Inside folder 08-32. On each TEETH (175.66, 179.06, 182.08) one of his exhibits swings face-on past the camera and into the folder, the word TEETH set huge across it in black condensed Archivo with the red monogram beside it, on camera moves cut to the kicks: his radiograph, his cast, his full chart (face-on, #8 marked). "Never, never, never ever let go": the line written on the folder's tab as it closes on them, the red draining out of the frame as it shuts. 186.85–193.76: the folder is carried down the cabinet bank, past drawers, and dropped into its drawer on a snare. 193.76–200.66, the last 4 bars of riff: the intro mirrored, the folders flicking **backwards**, one per real riff note, stopping dead in the riff's gaps, the camera's dolly carrying the speed. At the hard stop (200.70) the drawer slides back to a hand's width open, 08-32 standing proud: the first frame. The tab settles with a slight swing, then stillness to the end.

## The team plan for gate 3 (for reference)

- **Kit first** (one builder): `palette.ts`, type and karaoke helpers (port the Monster `popWords`), the radiograph shader, the tooth set (SDF, 32 teeth, chip on #8, shared by the radiograph, the apple bite, the casts and the tracing), the monogram (single-stroke, signed on a beat), the gloved hand, lab labels, post settings (grain, halation, bloom only on the glow tokens), and the spectrogram precompute from the vocal stem.
- **Plate groups**, at most three at once, in order of risk: 3D (drawer + filed, scale, pour + articulator), light and film (lightbox, scene, uv, luminol, match), graphic (polygraph, chart, voice, acetate).
- Each plate: frame checker clean → fresh reviewer → fix → until only taste calls remain or 4 rounds. A cut-level reviewer checks the whole edit at gates 3 and 4.

## Scope guards (to keep the hard parts from looking cheap)

- **pour**: no ray-marched pouring ribbon (it reads as CG toothpaste). The stone is already in; the plate is ripples, bubbles and relief.
- **luminol**: no visible mist or particles; animate only where the reaction lands. No cloth fold: hard cut to the sealed bag.
- **articulator**: chrome needs something to reflect; it lives on a white studio card.
- **scale**: the bite is pre-modelled; only the letters animate. Hero words land on the raking-light frames.
- **voice**: a real spectrogram precomputed from the vocal stem, never faked.
- The tooth set and the radiograph shader carry most plates and are proved first in the gate 2 stills.

## Gate 2: the stills

Real engine renders at 1080p, before any plate is built:
1. **Chorus 1 method**: `scale` at TEETH (the bitten word in the apple, flash, ruler).
2. **Chorus 2 method**: `pour` at "heart got teeth" (the cast turned out).
3. **Chorus 3 method**: `match` at 165.16 (the lock, the red, the monogram).
4. **Type and colour sheet**: Archivo, Plex Mono, Cormorant and the single-stroke hand on real lyric lines in their roles; unsung, sung and hero states; two or three lyric colour treatments side by side; the palette in context (on film, on lightbox white, under UV, under luminol); and one **warm-lamp variant** (a tungsten key on the lamp-lit plates, scene and acetate) beside the cold palette, for the client's call on taste call 4. The monogram drawn as T.F.
5. **The loop frame**: the drawer, a hand's width open, 08-32 standing proud.
6. **The radiograph**: `lightbox` at "only thing I know" (the core shader and the tooth set).

## Taste calls: the client's answers (2026-11-17)

1. **The monogram's letters**: **T.F.**, drawn with its full stops (client, gate 2).
2. **Apple or peach**: the **apple**.
3. **The red**: as written, on the matched outline, the monogram and the stamp; no full-frame flood.
4. **The cold palette**: cold everywhere except plate 3 (the bed), which is warm under the cold work light (client, gate 2).
5. **CSI-familiar exhibits**: keep the mix.
6. **First viewing or second**: kept as written; judged again on the rough cut.
7. **The stakes**: implied, never "he killed her". The intended reading is **Eden reversed**: he builds a case that she is the late-night devil who tempted and wounded him, and the bite in the apple turns out to be his; he is the one with teeth, the one who will not let go, and the loop sends him back to the file. The stakes guards in rule 5 keep the crime-scene grammar (the bed, the markers, the luminol) from tipping into violence; the bed's DEAD placard is the image to watch on the contact sheet.
8. **The voicemail's splice**: a **clue**. The gloved hand makes the cut itself (plate 8), so the lie is his.
9. **The silent ending**: kept.

## Gate 2 calls: the client's answers (2026-11-19)

1. **Lyric colour**: treatment A, plus the hero word snapping from light to heavy on its onset (letter positions locked).
2. **Lamp**: warm in plate 3 (the bed) only; cold everywhere else.
3. **The apple**: golden, in the palette's stone yellow (replacing the black-and-white photograph), linking the bite to the cast.
4. **Bitten letters**: the middle way: scalloped tooth-width edges with slightly torn skin, the word legible at a glance.
5. **The signature**: the angular T.F. mark, with its two full stops.
