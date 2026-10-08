# Verse 2 plan: option A, "what lies beneath" (prototype stage)

Status (2026-10-08, cloud session, branch `ccr-f57d57bf-gvkp5i`): the client was offered A (recommended) and B ("the shadow plays", one clay wall for the whole verse) in `docs/HANDOFF.md` "Next plate proposals" and said to continue with the rest of the project. A is being prototyped: each plate's set, its first line and its "Or" turn, shown to the client as stills before the full build. B stays open until the client sees them.

## The idea

Each stanza of verse 2 asks whether a monster acts out of guilt (two lines), then "Or…" offers the cold reason (two lines). The guilt questions are lit: bone letters, red-figure, the man asking. On "Or" the shot turns to what lies under or inside the monster's own place, and the cold answer is there in black-figure (black on the clay): the giant's shadow on his cave wall, the bottom of Circe's cup, the bed of Poseidon's sea, the belly of the horse. It carries chorus 1's motif (the client, v7 note 8: the water shows what lies beneath the question) into the verse, and the black-figure share of the frame grows plate by plate (the dark double, through-line A) without flipping the palette (that is chorus 3's).

As agreed for the opening (v5), each plate opens on its monster's silhouette from the opening (`figures.ts`), for under a bar, then goes somewhere new: the client found that background monsters repeating earlier shots read as trite (v7 note 4), so no plate may simply restage the opening's wall.

## Binding rules (docs/MONSTER.md "Grammar", docs/HANDOFF.md client notes)

- One phrase on screen: the line's words appear as sung (never early by more than ~0.4 s) and leave on the next beat after the line. One hero word per line at frame scale: Archivo 75/900 (condensed black, as CHANGE?), a `Word3D` with bone faces and black-glazed sides. The rest of the line is small 3D type (Archivo 112.5/600, `popWords`), a physical thing in the shot: no flat 2D captions.
- Every word lands on its sung onset: letters spring up `POP.lead` (45 ms) before it (`popHinge`, `popWords`); no fade-ins on entrances. Hits and camera impacts key to word onsets or drum hits, not to the nearest beat.
- Something happens every bar (2.67 s); verse 2 has drums, so use the snare figure (below) for puppet moves, jolts and sub-cuts. Cuts on downbeats; camera moves ease into downbeats. No zooms at the camera (the client found them cheesy).
- No visible flame: the light is the fire behind us (`keyLight()`), `noFlame: true`, glaze highlight low (`spec` ~0.05). Clay walls (their shadows are black-figure), black-glaze floors that mirror the room, water a black mirror with the wine-dark tint (`swell`, `wine`). No line fields on floors or water; lines only as decoration reserved in the clay (meander, running-wave band, the incised contours of black-figure).
- Palette: ink, ink2, graphite, ash, bone, signal, ember, blood. Dawn is home's only (not in verse 2). Only signal/ember glow; bone type stays crisp.
- No figures with faces: the monsters are silhouettes and shadows (archaic frontal eyes are allowed; the cyclops' is the video's one eye). "Don't push the design further": no extra texture, flame or grain.
- Readable: hero words large and close to frontal. On low cameras a nearly flat letter shows its lit top as a block: hide letters with `hinge > 1.2` (see `hideFlat` in `hook.ts`). Keep type inside the title-safe area (96 px).
- Deterministic (a pure function of `f.t`), NaN-safe normals in any new mesh shader, no `pow()` of negatives in GLSL, `frameIdx()` for per-frame jitter (docs/ENGINE.md, docs/HANDOFF.md "Gotchas learned").

## Working around the chorus 1 branch (until `worktree-agent-af2b23a466a275eeb` is merged)

The chorus 1 work (`mirror.ts`, `shore.ts`, hook 1 converted to the answer under the surface, one horizon line) is only on the client's laptop. Until it is merged here:
- Do not edit `hook.ts`, `sea.ts`, `stage.ts`, `timeline.ts`, `figures.ts`, `motifs.ts`, `shards.ts` (they may be changed there). Each plate lives in `app/src/monster/scenes/<plate>.ts` (the timeline entries already exist) plus its own helpers `scenes/<plate>-*.ts`. Copy and adapt kit code you need into your helper; list anything that should move into the shared kit later.
- Things that depend on that branch are listed in `docs/HANDOFF.md` ("Depends on the chorus 1 branch"); add to it rather than guessing what is there.

## Music and timing (data/monster/audio.json, lyrics.json; find lines by content, never hard-code word times)

| plate | window (timeline cuts) | lines | "Or" |
|---|---|---|---|
| `cyclops` | 68.69–79.36 | 15–18 | 73.83 |
| `circe` | 79.36–90.02 | 19–22 | 84.86 |
| `poseidon` | 90.02–100.69 | 23–26 | 95.40 |
| `horse` | 100.69–110.02 | 27–30 | 106.07 |

- Downbeats: 69.355, 72.022, 74.688, 77.355, 80.022, 82.688, 85.355, 88.021, 90.688, 93.355, 96.021, 98.688, 101.354, 104.021, 106.688, 109.354.
- The drums enter on 69.34 and stay at full power to 110.7. The snare plays one figure every bar: beats 1, 1&, 2, 2e, 3, 3& (e.g. 74.67, 75.00, 75.33, 75.49, 76.00, 76.33), beat 4 open: the vocal pickups ("Or", "And then", "is she") fall there. `audio.events('snare', t0, t1)`.
- 'orch' hits on every beat through the cyclops stanza (69.33–79.34: the fire flares on them via `keyLight`), sparser after (81.34, 84.67, 86.68, 88.01/88.32/88.65, 91.34, 92.63, 95.30, 98.55, 108.0, 109.01). Snare rolls in the Poseidon stanza: 93.3–95.3, 96.3–97.3, 99.0–100.7. The vocal grows through Poseidon and the horse.
- Each stanza: bars 1–2 the guilt questions, the "Or" pickup on beat 4 of bar 2, bars 3–4 the cold answer.

## The plates

### `cyclops` (68.69–79.36): his eye is the cave mouth

Lines: "Is the cyclops struck with guilt when he kills?" (68.99–71.74; "cyclops" 69.26, "struck" 69.92, "guilt" 70.50, "kills" 71.26) / "Is he up in the middle of the night?" ("up" 72.11, "night" 73.38) / "Or does he end my men to avenge his friend" ("men" 75.32, "avenge" 75.88, "friend" 76.46) / "And then sleep knowing he has done him right?" ("sleep" 77.22, "right" 78.68). Heroes: GUILT?, NIGHT?, AVENGE, RIGHT? (the words he sings; the image enacts the others: "up" opens the eye, "sleep" shuts it).

Inside the cave, the fire behind us. The wall ahead is clay; Polyphemus' shadow fills it, head and shoulders, close and huge (from `polyphemus()` in `figures.ts`, rescaled; no other figure). Its one eye is the cave mouth: an almond opening onto the night (ink, with the moon in it as a bone disc: the pupil), and a boulder (clay, black-figure contour) beside it that can roll across it like an eyelid. The words stand on the black-glaze floor between us and the wall, lit, their shadows on the clay below his.
- Open (68.69): the eye shut (the boulder across the mouth), the fire low; "Is the" small. On the drums' entry (69.34) the fire flares and the shadow looms up the wall (a puppet's rise, not a zoom). GUILT? stands on "guilt" (70.50); on "kills" (71.26) the shadow's club comes down beside the word (it does not hit it), on the snare.
- "Up" (72.11): the boulder rolls clear and the eye opens on the night; NIGHT? (73.38).
- "Or" (73.83): the turn. The camera turns from the eye to the wall beside it: on the six snare hits of bar 3 (74.67–76.33) his club strikes the clay and each blow leaves a black tally stroke, one per man (MEN small on 75.32); AVENGE stands on 75.88 before the tally.
- "Sleep" (77.22): back to the eye; the boulder rolls across the mouth and the eye shuts; RIGHT? (78.68) stands in front of the shut eye into the cut.

### `circe` (79.36–90.02): the bottom of the cup

Lines: "When the witch turns men to pigs to protect her nymphs," ("witch" 80.00, "men" 80.70, "pigs" 81.04, "nymphs" 82.52) / "is she going insane?" ("insane" 83.72) / "Or did she learn to be colder when she got older," ("colder" 86.00, "older" 87.39) / "and now she saves them the pain?" ("saves" 88.44, "pain" 89.32). Heroes: PIGS (MEN re-formed), INSANE?, COLDER→OLDER, PAIN?.

Her kylix seen from high above, almost straight down: a round clay cup (its rim and inner wall clay, a reserved band of decoration on the rim), the potion inside a black mirror, wine-dark. Her staff's shadow (black-figure) lies across the cup and stirs on the beat; she is never seen (open on her silhouette at the cup from the opening for under a bar, then the camera is above the cup by "witch").
- MEN floats on the potion (3D letters standing on the surface, seen from above at a steep angle so they read); on "pigs" (81.04) it sinks (folds flat into the surface and vanishes) and PIGS comes up in its place, the same spot, as if re-formed. One word, not a colour change.
- "Insane?" (83.72): the potion turns into a vortex: INSANE?'s letters ride round it, the camera rolls with them, the reflections in the potion smear round (no lines drawn on the liquid).
- "Or" (84.86): the swirl stops dead and the surface goes glassy (swell 0); COLDER stands on 86.00; on "older" (87.39) its C drops away (tips over and sinks) and the rest closes up: OLDER.
- "Pain" (89.32): the potion drains (the surface sinks down the cup's black inner wall) and the tondo at the bottom of the cup is revealed, black-figure on clay: her answer, the nymphs she shelters (three faceless women hand in hand in a ring dance; incised contours, as Penelope in `symbolon.ts`). A kylix's inner basin was often painted at the bottom, in a round frame (the tondo), "so that as the liquid is consumed an image is revealed" (https://en.wikipedia.org/wiki/Kylix). PAIN? stands at the rim, not over the painting.

### `poseidon` (90.02–100.69): the god's board game

Lines: "When a God comes down and makes a fleet drown" ("God" 90.68, "down" 91.36, "fleet" 92.30, "drown" 92.62) / "Is he scared that he's doing something wrong" ("scared" 93.26, "wrong" 94.68) / "Or does he keep us in check so we must respect him" ("check" 96.62, "respect" 97.80) / "And now no one dares to piss him off?" ("dares" 99.34, "off" 100.03). Heroes: DROWN, SCARED?, CHECK, DARES?.

The sea from high above as a game board: black mirror water (wine-dark) inside a clay border with a reserved running-wave band (the board's edge, the sea's decoration), the fleet as galley pieces in rows on it: bone-faced tokens with black-glazed sides (like the letters), hull-shaped, legible from above. (The board game as a Greek image: Exekias' amphora in the Vatican Museums "depicts Achilles and Ajax playing a board game", https://en.wikipedia.org/wiki/Exekias.) The god is never seen: his trident's shadow (black-figure, from the opening's trident) falls across the board as the weapon comes down, cast by the fire behind us; the camera is oblique enough for the shadow to read as a trident.
- Open on his silhouette from the opening (trident raised) for under a bar, then the board. "Comes down" (91.36): the trident's shadow sweeps onto the board; "drown" (92.62): galley pieces sink, one per snare (tip and go under, rings bending the reflections only).
- "Scared…wrong": the trident's shadow hangs over the board, trembling on the snare roll (93.3–95.3); SCARED?.
- "Or" (95.40): he plays. On "check" (96.62) the trident pins the last pieces in a corner of the board; RESPECT on 97.80.
- "No one dares" (99.34): the board lies swept and still; under the water, on the clay seabed, the sunk fleet shows in black-figure (the answer under the surface; its look should match chorus 1's painted answers, which are on the laptop branch: build it here, flag it for matching). DARES? on 99.34; the shadow lifts away on "off" (100.03).

### `horse` (100.69–110.02): inside the horse

Lines: "Does a soldier use a wooden horse to kill sleeping Trojans" ("soldier" 101.32, "horse" 102.55, "kill" 103.19, "sleeping" 103.38, "Trojans" 103.94) / "'cause he is vile?" ("vile" 105.32) / "Or does he throw away his remorse" ("throw" 106.62, "remorse" 107.82) / "and save more lives with guile?" ("lives" 109.16, "guile" 109.79–110.46). Heroes: TROJANS, VILE?, REMORSE, GUILE? (VILE re-lettered).

Open on the wooden horse from the opening (its silhouette on its platform) before the walls of Troy at night, the city's lamps (ember points) in the wall; then the camera goes in through the open hatch. Inside: the belly is a long clay chamber (planks as reserved seam lines on the clay, ribs), the floor black glaze; the soldiers are their shadows on the clay walls (`hoplite()` shapes, packed in rows with their shields: black-figure), cast by no one. Through gaps between the planks the city's lamps go out one by one on the snares ("sleeping Trojans"). TROJANS on 103.94.
- VILE? (105.32) stands in the belly, frame scale.
- "Or" (106.07): the hatch in the floor drops open on "throw" (106.62) and REMORSE (107.82) is thrown out through it, falling away.
- "Guile" (109.79): VILE re-letters itself into GUILE? (the V folds into a U, a G slides in before it) as the soldiers' shadows file down toward the hatch.
- Known clash: "guile" is sung 109.79–110.46 but the horse→hook 2 cut is at 110.021 (`timeline.ts`), so GUILE? would be up for 0.23 s. Start the re-lettering on "lives" (109.16) so the word is GUILE by its onset, and flag it: whether hook 2 carries GUILE? across the cut, or the cut moves, is decided with hook 2's design, which depends on the chorus 1 branch.

## Prototype deliverable (per plate)

- `app/src/monster/scenes/<plate>.ts` (+ helpers) covering the whole window at prototype quality: the set, the camera, the hero words and the supporting words on their onsets, the open, the "Or" turn and the end image.
- Stills (`bun scripts/render.ts stills --only <plate> --t ...`) at: the first frame, each hero word ~0.25 s after its onset, the "Or" turn's first downbeat + 0.3 s, and the last frame. Look at every one.
- Typecheck clean (`bunx tsc --noEmit -p .`), frame cost noted (`render.ts perf`, SwiftShader is ~10–20× slower than the laptop's GTX 1650).

## Status after the critic loop (2026-10-08, end of the cloud session)

All four plates are built over their whole windows, in `app/src/monster/scenes/{cyclops,circe,poseidon,horse}.ts` (+ helpers), and went through the critic step (`docs/critic-checklist.md`): fresh critics, blind pairs against approved frames, fixes, repeat. Each critic round found real defects, and the fixes are in (crisp hand-overs on the frame the next word springs, no leftover letters, no flat letter blocks, hero words popping as a whole, hits on the snares, no pop-before-cut glitches, title-safe type, no debris). The words' mirror images on liquid were dropped in `circe` (potion) and `poseidon` (board) after the critics read them as ghost duplicates, as the client found in chorus 1 (v7 note 8). Not yet seen in a clip: motion was judged from frame sequences only.

Blind pairs (new frame vs approved frame; wins/losses for the new frame, by round): cyclops 1–5, 3–3, 2–4; circe 1–5, ~4–1, 3–3; poseidon 0–6, 0–6 (round 2 named the ghost mirror copy of every word, fixed in the last round); horse 2–3, 0–6. The recurring gaps named blind: value range (mid-orange fields with few darks), hero words doubled by their reflection in the glaze, and some compositions (cyclops' figure crowded left with the right half empty; the boulder beside the open eye reading as an eyepatch or a balloon). These are partly design calls for the client (below).

For the client (taste calls the critics raised, not fixed):
- Hero-word mirror images on the black-glaze floors (cyclops, horse; verse 1 has them too): drop them as on water? The blind critics read them as doubled type. (`docs/HANDOFF.md` dependency 9.)
- Value range: more darks within the look (a stronger falloff of the fire's pool) would answer the most common blind gap; the client's rule is "don't push the design further".
- `cyclops`: the open eye reads as an eyeball with a moon pupil more than as a cave mouth onto the night, and the boulder beside it as an eyepatch; the "Or" turn is a modest pan; the four heroes share one layout over his torso.
- `circe`: 9 s of the same top-down cup framing; a nearly empty bar after "Or" (84.9–86.0); MEN's sink reads as a cut-off word in a still.
- `poseidon`: the board can read as a toy tabletop in a black void; "respect" is small under CHECK (RESPECT as a second hero?); the opening shows the god's silhouette with the board, close to restaging the opening's wall.
- `horse`: "UILE?" is a non-word for ~0.2 s during the re-lettering; GUILE? is up ~0.4 s before "guile" is sung; three of the four heroes share the corridor framing.
- The horse→hook 2 cut inside "guile" (dependency 5).

Critic files and reference frames were in the cloud container's scratchpad and are gone. Reference frames to regenerate for the next critic rounds (into `out/ref/`, gitignored): Monster 6.5, 8.4, 12.5, 18.6, 22.6, 24.6, 29.6, 33.5 (`--only everything,endless,symbolon,change,souls`); P(doom) 12.5, 26.5, 44.0, 74.0, 84.0 (`--song pdoom --only loss,room,spacetime,bureau,leftturn`).
