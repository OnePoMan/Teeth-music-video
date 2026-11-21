# Teeth v2: review of the spec (2026-11-21)

An outside review, done cold from the files: `TEETH2.md`, `TEETH2-LEDGER.md`, `TEETH2-BUILDERS.md`, `TEETH2-HANDOFF.md`, `critic-checklist.md`, `docs/gate3/*`, with `TREATMENT.md` (P(doom)) as the bar. I also spot-checked `app/scripts/lint.ts`, `app/src/teeth2/kinetic.ts`, `data/teeth/lyrics.json` and `audio.json`, plus the git log, wherever a doc made a claim about them. Line numbers refer to the files as they stood on 2026-11-21.

## Verdict

**Right now the spec gets in the way more than it helps.** The concept, the clue chain and the plate paragraphs are strong; on forensic logic they are tighter than P(doom)'s treatment. Sheer rule count is not the problem either. The problem is that two late binding sections, "Kinetic type" (11-20) and "Lyric-led camera" (11-21), were added on top of the older text without retiring what they replaced. The files now disagree on the most visible things in the video:

- when a line leaves the screen;
- how many words are on screen;
- whether the camera may reframe inside a line;
- whether the seven plates marked "done for gate 3" are in fact done.

A builder who reads only their brief, the treatment's plate paragraph, or the handoff will follow at least one dead rule. A reviewer told "settled items are not re-raised" will enforce rulings that the client's later calls have killed.

Overall, the process is roughly proportionate. Reviews are cheap (about 7 points each, `TEETH2-HANDOFF.md:14`), while builds and fix rounds are expensive (about 45 and 28 points). Most of the rework comes from three things:

1. cross-cutting grammar decided after seven plates had been blocked in;
2. numeric checks done by eye, round after round, because the frame checker cannot see Teeth's type;
3. rules restated in every brief, where they drift.

All three can be fixed in about a day of consolidation, before the next build.

On staffing (section 6): it is broadly on track. But Opus builders, at about 300k tokens a run, are spent on full-window builds before the look and grammar are confirmed, and on fix rounds that are only parameter edits. Retakes came from missing rules and unmeasured checks, not from model capability: first-pass REWORK hit 3 of 5 Sonnet plates and 3 of 4 Opus plates.

## The ten changes, ranked by rework saved

| # | change | why first |
|---|---|---|
| 1 | Write down what the lyric-led ruling invalidated: a plate status matrix (scene / camera / type / light × approved / rework / unknown), with the dead lines struck in the treatment, ledger and handoff | Seven "done" plates were approved under a camera grammar that is now banned, and no file says so (C3) |
| 2 | Update the handoff. It is two rounds stale and points the next session at work already done and rejected | A new lead session following it would rebuild the round 1 kit (C20) |
| 3 | Settle the lyric-led contradictions in one round of decisions: line lifetime, phrase size, pickups, instrumental gaps, reveal-by-light plates | They block every remaining plate (C1, C2, C4, C5) |
| 4 | Loosen "no reframes within a line" and "readable every frame" to versions that keep the protection (O1, O2) | As written they are stricter than P(doom) and kill the core idea of four plates |
| 5 | Make the frame checker see Teeth's type: instrument `kinetic.ts` to record each word's on-screen box, and check presence, cap height, hero scale and title-safe | Most fix-round items in reviews 1–5 are numbers measured by eye; round 1 of kinetic type failed on exactly the lyric presence the checker could not see |
| 6 | Replace `critic-checklist.md` for Teeth. It is the Monster checklist: wrong palette, wrong bar length, and lint claims that are false for Teeth | Builders are told it is "what the reviewer checks" (`TEETH2-BUILDERS.md:3`) |
| 7 | One canonical `RULES` file with rule IDs and an order of precedence; briefs cite IDs and carry only plate deltas | Briefs restate rules and drift: the red list, the value range, speed (C7, C14, C21) |
| 8 | A type card per plate (surface, line path, wrap policy, hero position, kit moves, slams) and the TEETH hook plan promoted from a code comment into the treatment | The type system has a vocabulary but no grammar for laying out a line, and 12 lines have 9–11 words (M3) |
| 9 | A transitions table: 13 boundaries plus the loop, each with an owner, a device and a test render | Lyric-led rule 4 wants cuts carried by the type, which needs both plates, but builders may touch only their own (M4) |
| 10 | Replace the per-plate speed ratchets with a measured whole-video render budget | Five different speed numbers; the real constraint, the 4K60 adaptive-sampled final, is never computed (O6) |

---

## 1. Contradictions and supersession debt (highest rework impact)

Ranked. "Dead" means a later binding text supersedes it but the old text still reads as current.

### C1. When a line leaves: three rules, two answers
- **Leaves on the beat after it ends:** `TEETH2.md:67` (karaoke), `TEETH2.md:88` (kinetic "Exit": "every line leaves with a move on the beat after it ends"), `TEETH2-LEDGER.md:103` (an empty lane in a gap is "correct karaoke, not a defect"), `critic-checklist.md:13`.
- **Held until the next line takes over:** `TEETH2.md:114` (lyric-led rule 1).
- **Where it bites** (from `lyrics.json`):
  - 9.34→10.79, the tag signing. The approved still 10.60 shows the signed tag, and under rule 1 the line "only thing I know" would now sit over it.
  - 23.11→24.49 and 78.41→79.75.
  - The outro's three TEETH gaps of about 2 s.
  - **186.83→193.76.** The last sung word ends at 186.83, but rule 1 exempts only "the closing riff (193.76 on)". So rule 1 demands a lyric over the whole 7 s folder carry, which the `filed` paragraph (`TEETH2.md:181`) and both `filed` briefs build without one.
- **Fix:** one sentence that names what happens in gaps of more than one beat, plus an explicit exemption for 186.85–193.76 (or a decision that "never let go" rides the carry).

### C2. How many words are on screen
- `TEETH2.md:67`: "One phrase on screen (1–4 words of the line being sung)". The same rule appears at `critic-checklist.md:13` and `TEETH2-BUILDERS.md:26`. None of these is struck.
- `TEETH2.md:114`: the whole line, built word by word, with sung words staying.
- 12 of the 52 lines have 9–11 words. At the lyric-led floor of a 5% cap height, an 11-word line of about 50 characters runs to about 2,000 px on one row (my estimate for Archivo at normal width), against 1,728 px of title-safe width. So the line must wrap or shed words. The only rule for that is in a brief (`brief-kinetic-r2.md:76`: "the first words may leave, but only as whole words, on a beat").
- **Fix:** strike the "1–4 words" rule and write a wrap/shed policy into the type rules (see M3).

### C3. The camera grammar: the biggest unrecorded rework
`TEETH2.md:112` supersedes "rule 4's 'sub-cuts' and every plate paragraph that cuts or reframes on each beat (`scale`'s … and the like)". "And the like" leaves the builder to find the rest. Still live in the text:

- **Rule 4** (`TEETH2.md:18`): "sub-cuts, reframings, holds and snaps".
- **Plate paragraphs:**
  - `lightbox` (`:145`): the camera "snaps tooth to tooth" inside the line "Beg you to stay…".
  - `scale` (`:154`): "cutting on every beat"; the song-map row (`:130`) still says "flash on every beat".
  - `chart` (`:160`): "the camera jolting to a new reframing on each kick".
  - `acetate` (`:175`): "snapping to a new framing on each bar".
  - `filed` (`:181`): "camera moves cut to the kicks".
- **Review instructions that ordered reframes inside lines:**
  - `review2.md:28`: scene, "snap to a new framing on the second 'stay' (33.52)", which is mid-line.
  - `review1.md:11`: polygraph, "at least four setups".
  - `review1.md:22`: uv, "4–5 setups".
  - `review3.md:24`: chart, "kick reframings differ more".
  - `briefs-round5.md:16`: articulator, "alternate profile, three-quarter rear, cusp macro".
- **Statements that are now false:** `TEETH2-LEDGER.md:131` and `TEETH2-HANDOFF.md:15`, "Scene, camera and timing work in every plate stands; only the lyric layer is redone".

**Consequence:** the seven plates listed as "Done for gate 3" (`TEETH2-HANDOFF.md:10`: polygraph, uv, scene, luminol, chart, voice, articulator) passed review under the grammar that was rejected. Their camera work is now out of spec. No file says so, and no plan or cost estimate covers it. This is the most important rework fact in the project, and it is not written down.

### C4. Cuts only between lines, and only on downbeats
`TEETH2.md:116` bans cuts inside a line, and `:118` puts cuts "only between lines, on a downbeat". But 18 of the 52 lines start more than 0.12 s away from a downbeat: pickups such as "And", "Then", "Don't know if" (from `lyrics.json` against `audio.json` `downbeats`). For those lines the two rules cannot both hold. The r2b brief ran into this at 58.87 ("And") and left the choice to the builder (`brief-kinetic-r2.md:82`). It will recur in every plate. A pickup rule is needed (see O3).

### C5. The reveal-by-light plates against "the lyric is on screen, readable, the whole time"
Four plate ideas rest on words that are readable only when a light event happens:

- **articulator:** "unreadable until the swinging arm catches the white studio card" (`TEETH2.md:169`), and a settled ruling: "reads only where a moving reflection band crosses it" (`TEETH2-LEDGER.md:99`).
- **uv:** "each sung word revealed by the beam and sinking back into dark behind it" (`:157`); GO decays (`LEDGER:79`); "DIRTY sinks to dark … before 'but'" (`review1.md:23`).
- **luminol:** "each word reads when the stain flares behind it", with the glow fading twice (`:172`).
- **lightbox:** "the teeth faint" as the tube dims (`:145`).

Lyric-led rule 1 (`:114`) and the kinetic "Exit … never a fade" (`:88`) contradict all four. Neither the lyric-led section nor the ledger says whether these ideas survive. A builder must either break a binding rule or delete the plate's concept. See O2 for a wording that keeps both.

### C6. Halation on a slam
`TEETH2.md:75`: a slam "takes the plate's grain, halation and motion blur". `brief-kinetic-r2.md:59`: "a slam returns `halation: 0`". Direct conflict.

### C7. What is red
- **Without TEETH:** the palette row (`TEETH2.md:52`) gives red to "the matched outline, the monogram and the stamp", and `briefs-gate2-plates.md:26` repeats that list to the `match` builder.
- **With TEETH:** the `match` paragraph (`:178`) has "the traced outline and TEETH go red", and `TEETH2-LEDGER.md:50` says "red stays on the outline, TEETH, the monogram and the stamp".
- **Near a flood:** the hook plan in `kinetic.ts` (lines ~72–73) has match-red TEETH "re-slams on every 8th … each a condensed copy packing the frame". That comes close to the "no full-frame flood" that taste call 3 rules out (`TEETH2.md:212`).

### C8. The monogram's full stops: two "settled" answers
`TEETH2-LEDGER.md:49`, under the settled rulings, says "drawn without full stops". Against it: `TEETH2.md:210` and `:226`, and `LEDGER:15` and `:69`, all say "with its two full stops". The older ruling is not struck.

### C9. The apple's colour
`TEETH2-LEDGER.md:41` (settled): "skin a deep, desaturated shade of wax over a stone-yellow ground". `LEDGER:69` says the golden apple "supersedes the B&W ruling", but the ledger contains no B&W ruling. The wax-skin ruling, which is the one actually superseded, still stands.

### C10. *sweet* in plate 6
The palette (`:49`) and Typography (`:60`) both say the tender register is wax pink, and the `uv` paragraph says nothing. The client's call (`LEDGER:117`), fluor-white, exists only in the ledger.

### C11. The acetate and match paragraphs describe dead versions
- **acetate** (`:175`): "the lyric … shows only where the traced line has already passed" is replaced by the spring-up fallback now in use (`LEDGER:119`, `review5.md:6`). "the acetate holds the whole arch" is replaced by the six upper marks (`LEDGER:37`, `:109`).
- **match** (`:178`): "front teeth to molars" was corrected at `LEDGER:37`, but the text is unchanged.

### C12. Labels: per plate or per frame?
- Rule 3 (`:17`): "at most one readable label **per plate**".
- `TEETH2-BUILDERS.md:25` fails a still with "more than one readable label", which is a per-frame test.
- In practice, plate 13 carries NAME and MATCH (`LEDGER:40`), PHOTO 1:1 (`:51`), and EXHIBIT 8 plus suspect labels (`:66`), and plate 14 carries the tab, 08-32 and the exhibits. The practice is per frame; the rule should say so.

### C13. Who owns frontal heroes
`LEDGER:80`: "Plate 6 avoids … frontal centred heroes (plate 5 owns them)". But kinetic type makes every chorus hero "stamp or slam full-frame" (`:96`), `uv` is a chorus plate, and the hook plan puts two TEETH slams in `uv`. The ownership ruling predates the slam idiom and now forbids it.

### C14. Value range: per plate, per shot or per frame?
- `LEDGER:102`: "every plate reaches true film-black somewhere in frame and lightbox-bright somewhere". Whether that means per plate or per frame is unclear.
- `briefs-gate2-plates.md:22` and `briefs-round5.md:42`: "**Every frame** reaches film-black and lightbox-bright".
- `luminol` is required to have "nothing outside the bloom's reach rise above film2" (`LEDGER:100`), with the glow fading between re-sprays. `acetate` stripped is "lots of black". `uv` keeps the beam under 30% of the frame. "Every frame" cannot hold in these plates.

### C15. Hero scale against the stripped section
- `LEDGER:112`: heroes reach "≥30% of frame width … in every plate; small heroes are a defect", and `:103` lists hero frame scale as still binding.
- `:97`: the acetate's type is "hairline weights, small and slow", and the hook plan has the acetate's TEETH "small" (P(doom)'s eerie hook 3).
- Supporting words have two minimums: 5% cap height (`:114`) and 8% (`brief-kinetic-r2.md:75`).

### C16. The articulator brief's numbers cannot all hold
`briefs-round5.md:13` limits the engraved bar to "≤10% of frame height", with letters at about 80% of the bar (`review3.md:43`), so a cap height of 8% or less. Item 2 (`:14`) wants heroes engraved on that bar to span "≥30% of frame width". At an 8% cap height, a five-letter Archivo word is roughly 20–25% of the frame width (my estimate), so the push-in that reaches 30% breaks the 10% bar. The 10% was meant as a physical proportion in the wide shot but is written as a fraction of the frame.

### C17. Review rounds and reviewers: four different policies
- `TEETH2.md:187`: "until only taste calls remain or 4 rounds", and "a cut-level reviewer … at gates 3 and 4".
- `LEDGER:60`: a four-round cap (gate 2).
- `TEETH2-HANDOFF.md:38`: "at most two review rounds per plate"; `HANDOFF:49`: the cut-level reviewer at gate 4 only.
- `critic-checklist.md:5`: "one critic round per plate; a second only when that round finds a real defect".
- `TEETH2.md:120`: a blind review against P(doom) before the client sees "any prototype". It is unclear whether that covers all 14 type-and-camera rebuilds.

### C18. "Graded impacts" against the every-beat moves
`:117` says impacts are "never a uniform pulse … not on every beat". But all of these still put a hit on every beat or kick:

- `:82`: "Stretch on kicks, condense on snares".
- `:83`: "Track … opens and closes on the beat".
- `:35` and `:154`: "every beat a flash".
- `brief-kinetic-r2.md:35`: "Every beat is still a flash".

### C19. The critic checklist is Monster's
- `critic-checklist.md:3` cites `MONSTER.md` "Grammar".
- `:10` gives a bar of 2.67 s; Teeth's bar is 1.727 s.
- `:19` lists the Monster palette (ink, signal, ember…).
- `:14–18` are about flame, water lines, horizon and the cyclops.
- `:5` says the checker covers items 1, 2, 5, 6 and 7. But `lint.ts:14` says it does not see "type painted into a texture", and Teeth's type is painted into textures or SDFs: only `pour.ts` uses `Word3D` or `drawPhrase`.
- `lint.ts:20` (LINGER) warns on a hero still showing 0.6 s after it is sung, the opposite of lyric-led "sung words stay".
- The treatment's claim that "the frame checker fails any text in the HUD corners" (`:17`) has no matching check in `lint.ts`. `render.ts:199` only turns the HUD off.
- `brief-kinetic-r2.md:53` accepts "the known false hits", which are not listed anywhere.

So "lint clean" is mostly empty for Teeth, and the docs present it as a gate.

### C20. The handoff is stale
- `TEETH2-HANDOFF.md:15` still says "Next: builder A writes the shared kit `kinetic.ts`…". The git log shows that work done (250601a, f51edc2, 15b6a02), rejected by the client, then rebuilt in rounds 2 and 2b (c8eb4d8, cac7a04), followed by the graded-impacts ruling (8d88d0c). The handoff mentions none of this, nor the lyric-led section or the blind review.
- `:12` says acetate and filed are "in progress" with no closing entry anywhere.
- `:17` says "every plate built" while `:16` says the gate 2 plates' batch review is still waiting.
- The treatment's draft number (`TEETH2.md:1`, "draft 5") does not match `HANDOFF:7` ("draft 4").

### C21. Five speed rules
- `TEETH2-BUILDERS.md:35`: aim for ≤100 ms.
- `briefs-gate2-plates.md:34`: ≤100 ms, written as a hard limit.
- `brief-kinetic.md:21`: ≤100 ms, or no slower than the plate was.
- `brief-kinetic-r2.md:53`: no slower than 186 ms.
- `:88`: ≤138 ms.
- `ENGINE.md:54`: under 25 ms.

None of them says what it protects (see O6).

### C22. "No rush at the camera" against "push into the hero"
`TEETH2.md:18` and `critic-checklist.md:24` ban zooms and rushes at the camera. `TEETH2.md:115` asks for "pushing into the hero on its onset", and the stamp "lands oversized" (`:84`). Both can hold, but nothing draws the line between them, so every reviewer will draw it differently.

---

## 2. Over-rigid rules

Ranked by the rework they cause. For each: the rule, what it protects, what it costs, and a looser wording that keeps the protection.

### O1. No cuts and no reframes within a line (`TEETH2.md:116`)
- **Protects:** against the "whiplash" the client rejected, and against losing the line.
- **Too strict:** stricter than the bar. P(doom)'s `room` cuts "on every beat (whip with roll, low angle, punch-in, orbit)" (`TREATMENT.md:87`), and its tone rule asks for "sub-cuts, reframings, snaps" inside plates (`TREATMENT.md:9`). The client objected to *erratic, unrelated* framings that lost the words (`LEDGER:134`), not to every cut.
- **Costs:** a camera rebuild of all seven "done" plates. It also kills type-led ideas that would pass the client's test, such as `lightbox`'s camera snapping tooth to tooth as each STAY lands, or `chart`'s raking macro on a word.
- **Looser:** "Within a line, the current line stays readable in every frame, and the framing never jumps to an unrelated view. A reframe or cut inside a line is allowed only when the type carries it: the new framing opens on the word being sung, already readable, with the line so far visible or re-established within 2 frames. At most one per line in verses, one per half-line in choruses; never on every beat."

### O2. "The lyric is on screen the whole time … supporting words as readable as the hero" (`TEETH2.md:114`), read literally
- **Protects:** against round 1's 13-of-30 empty frames.
- **Costs:** the central idea of `uv`, `luminol`, `articulator` and part of `lightbox` (C5).
- **Looser, a legibility floor:** "Sung words of the current line never drop below a readable floor: halide-level contrast, at least a 5% cap height. The plate's instrument (beam, flare, glow, backlight) lifts words *above* the floor to full; it is never the only thing that makes them readable. Named exception: GO's decay in `uv` (`LEDGER:79`)."
- Review 3 already reached this for `luminol` ("letter brightness follows the glow behind, with a halide floor", `review3.md:19`). Generalise it.

### O3. Cuts only on downbeats, only between lines (`:118`)
- **Protects:** cut rhythm.
- **Costs:** the rule cannot be satisfied for 18 of the 52 lines (C4), so each builder improvises.
- **Looser, a pickup rule:** "A cut between lines lands on the downbeat nearest the new line's first stressed word. Pickup words sung before that downbeat appear in the outgoing shot as the head of the new line, and the outgoing line clears on the pickup. Or the type carries the cut."

### O4. Value range in "every frame" (`briefs-gate2-plates.md:22`, `briefs-round5.md:42`)
- **Protects:** against mid-tone mush (review 3 rightly flagged scene, luminol and voice).
- **Costs:** fights the low-key plates (C14) and invites fake highlights that break rule 2 ("every light has a source").
- **Looser:** "Every *shot* reaches film-black, and its plate's peak (lightbox, or the glow token in `uv`, `luminol` and `acetate`). Mid-tone-only shots are a defect."

### O5. Heroes at ≥30% of frame width in every plate (`LEDGER:112`)
- **Protects:** against small heroes, the recurring miss.
- **Costs:**
  - The measure is biased by word length: GO at 30% of the width is huge; BUTTERFLIES at 30% is modest.
  - It contradicts the stripped chorus (C15).
  - Combined with frame-relative props, it gives infeasible briefs (C16).
- **Looser:** "The hero's cap height is at least 20% of frame height, *or* the word spans at least 30% of frame width, whichever comes first; held from its start to its end. Exempt: the stripped chorus 3a and the bridge, where the hero is set by the section's energy (`:97–98`)."
- Also pick one supporting-word floor (5%), with 8% as the advice for a line's first frame.

### O6. Per-plate speed ratchets (C21)
- **Protects:** what it should protect is never stated. It is the final render. The export averages 12–324 adaptive sub-frames per frame (`ENGINE.md:88–90`) at 4K, over about 12,300 frames.
- **The arithmetic** (rough, my assumptions, not checked against a real render): at 100 ms per 1080p preview frame, 4K costs about 4× the pixels, and about 36 sub-frames is typical, with SS_TAP saving up to 4× on some shaders. That gives about 4–14 s per final frame, or **roughly 12–50 GPU-hours**. "Rendered overnight in segments" (`HANDOFF:19`) is therefore not obviously true even at the 100 ms target.
- **Costs:** at block-in, the ratchets ("no slower than 186", then "≤138") spend builder attention on optimisation that gate 4 will redo, while the real budget goes unmeasured.
- **Looser:**
  - "Gate 3: at most 200 ms per frame at 1080p (iteration speed); report the figure."
  - "Gate 4: one measured 4K test render of 2 s per plate with `--samples auto`, then a whole-video budget in GPU-hours, with the slowest plates optimised first."

### O7. The blind review against P(doom) as a gate (`TEETH2.md:120`)
- **Protects:** the right thing. Round 1 was never compared against the bar.
- **Too rigid:**
  - It compares a block-in with a finished 4K reference.
  - It rests on one reviewer's preference.
  - Pass and fail are undefined. Round 2 was "within reach, not below it", with P(doom) winning on presence, legibility and energy (`brief-kinetic-r2.md:73`). Did that pass?
- **Looser:**
  - Measure lyric presence automatically (see P3).
  - The reviewer scores legibility and camera flow from 1 to 5 for both videos and ignores finish.
  - Pass: presence ≥95% of sung frames, and neither score more than 1 point below P(doom).
  - Run it for the next two or three plate *types* (a reveal-by-light plate, a light plate, a 3D plate) to calibrate, then let the lead spot-check.

### O8. "Settled: do not re-raise" with no way to unsettle (`TEETH2-LEDGER.md:3`)
- **Protects:** against endless reopening, which is good.
- **Costs:** it now forces reviewers to enforce rulings that a later client call killed: `LEDGER:99` (articulator band reveal), `:80` (frontal heroes), `:103` (empty lanes), `:131` (camera stands).
- **Looser:** "Settled unless a later client call conflicts with it. A reviewer who finds a conflict reports it to the lead and enforces neither."

### O9. "Touch nothing else" plus kit fixes deferred to gate 4
- **Protects:** builders from colliding.
- **Costs:** the glove's knuckle lumps appear in reviews 3, 4 and 5, in the handoff and in four briefs. Every plate is judged against a model known to be bad, and every round spends text on it.
- **Looser:** "Kit defects found in a batch review are fixed by a kit chore (Sonnet, low) before the next batch. Plates pick up the fix by re-rendering."

### O10. "Plate X owns Y" (`LEDGER:80, 81, 92, 99`)
- **Protects:** rule 1, no repeats.
- **Costs:** when it covers a *type layout* ("frontal centred heroes") it outlaws the shared slam idiom (C13).
- **Looser:** "A plate owns a composition *together with its exhibit* (fabric from above, words on standing cards, a scrolling machine trace). The kinetic slam is a shared idiom, like the bookend drawer: an allowed echo, escalating rather than repeating."

### O11. "At most one readable label per plate" (rule 3, `:17`)
- **Costs:** contradicts plates 13 and 14 (C12).
- **Looser:** "per frame".

### Not over-rigid: keep as they are
The 0.4 s early limit, the stakes guards, the per-plate colour locks (violet, luminol, tungsten), "no HUD or changing numbers", the single glove and the single tooth set. They are cheap to obey, they protect the video's identity, and none has caused real rework. The render budgets (about 10, 15 or 20 renders) and the report word limits are soft and sensible. "No two repeats of a line use the same hit pattern" is fine as a reviewer item.

---

## 3. Missing structure

### M1. A plate status of record
Gate 3 has 14 plates × {scene, camera, type, light}, and each cell should say approved, rework or unknown. The state now lives in prose across `HANDOFF:10–16`, five reviews and the ledger, and since the lyric-led change it is wrong (C3). This is the first thing a new lead needs and it does not exist.

### M2. A definition of done
"SHIP / FIX / REWORK" is used everywhere and defined nowhere. "Done for gate 3" has meant at least four things: a reviewer's SHIP; a lead's judgement after the last round (`LEDGER:122`); "SHIP for gate 3" with known defects; and capped out. Proposed definition for gate 3 (block-in):

- lint clean, with the Teeth checks (P3);
- lyric presence ≥95% of sung frames;
- approved still times compared side by side with the JPGs (an automatic PSNR or SSIM flag, as already done for the loop);
- both hand-offs rendered;
- the palette histogram clean;
- ms per frame under the gate ceiling;
- one reviewer pass with no FIX item on rules, only polish.

Define REWORK as "the plate's core read fails", FIX as "rule or timing defects", and SHIP as "polish only".

### M3. The type system's grammar, across 14 plates
"Kinetic type" gives a *vocabulary* (spring, stretch, stamp…) and an energy table. Lyric-led gives *constraints*. Nothing says how a line is laid out. Each plate needs a **type card**:

- the surface and its font role per word class;
- the line's path (band, row, trace, lane) and the camera that follows it;
- the **wrap/shed policy** for 9–11-word lines;
- where the hero sits relative to the line so far (in the row? replacing the row? a slam?);
- the kit moves used, and the impact tiers;
- the slam count, and the hook state.

Two more gaps:

- **No slam budget across the video.** P(doom) has 4 hooks. Teeth's hook plan has about 11 TEETH slams, and the kinetic table says *every* chorus hero "stamps or slams full-frame" (`:96`). That is a slam-fatigue risk and a rule 1 risk.
- **The hook plan lives only in a code comment** (`kinetic.ts`, around lines 59–78), and it disagrees with the treatment (C7, and `acetate` "no slam" against `:100` "each 'got teeth' line"). Move it into the treatment.

### M4. Who owns the transitions
Three of the 13 boundaries are specified, in briefs only: drawer↔filed at ≥40 dB PSNR, voice→pour on the clipped wave, acetate→match on the tracing. Lyric-led rule 4 wants cuts "carried by the type … the camera following a word out of one world into the next", which needs both plates, and builders may touch only their own files. Write a **transitions table**: boundary time; device; the outgoing plate's last 0.5 s and the incoming plate's first 0.5 s; owner (suggested: the outgoing plate owns the device, the incoming plate owns the landing); a test render of ±0.5 s in a single clip.

### M5. How the look is judged at the cut level
`TEETH2.md:187` promises a cut-level reviewer at gate 3, but the handoff moves it to gate 4. Until then, cross-plate judgement happens ad hoc in each review's "Cross-plate" section. Needed:

- an edit-level artefact at every batch: a 2 fps strip of the whole song, or a low-sample 1080p rough cut;
- a written **section energy and light/dark rhythm map**, one row per plate: key (dark or light plate), dominant hue, energy, cut density, slam count. P(doom) has a light/dark rhythm (`TREATMENT.md:19`), and Teeth has light plates (polygraph, chart) but no written rhythm.

### M6. A Teeth reviewer checklist
Build it from the rules, each item with a **test column**: lint, palette histogram, measured, or eye. Drop the Monster items.

### M7. A precedence order
Nothing says what wins when files disagree. Proposed: client calls (latest first) > the binding sections of the rules file > ledger rulings > plate paragraphs > briefs.

### M8. Rules for instrumental stretches
Lyric-led governs "within a line". The intro, the outro carry and gaps of 1.3–2 s are left open (C1). One paragraph would cover them.

### M9. Guides for decisions now left to taste
Each of these comes up in every plate and is currently argued afresh by each reviewer:

- **"The frame's sweet spot"** (`:115`), for example "the newest word's centre in the middle third, with lead room ahead in the reading direction".
- **"Push into the hero" against "no rush at the camera"**, for example "at most 15% scale change over the word's duration, eased, never faster than 0.5 s".
- **"Maximal" for a chorus.**
- **Impact tiers as a table:** tier 1 (hero onsets, chosen downbeats) gets the instrument hit, a stamp and a shake of N px; tier 2 (other downbeats) gets a stretch and a light change; tier 3 (backbeats) gets a nudge of 3 px or less.
- **"A cut carried by the type":** two or three worked examples.

### M10. One Gate 4 backlog
Gate 4 items are now spread across:

- `HANDOFF:11` and `:16`;
- the "Gate 4:" lines in `review1.md`–`review5.md`;
- `LEDGER:113` and `:122`.

Gather them into one file, organised by plate.

---

## 4. Process load

**Proportion.** The written process (about 630 lines of core docs and about 490 in `gate3/`) is not large for 14 plates, and the gate structure, with a client sign-off per gate, is cheap and right. The cost data in `HANDOFF:14` shows where the money goes: a review costs about 7 points, a build pair about 45, a fix pair about 28. **Reviews are not the problem; rebuilds are.** The process is growing in the wrong place. Each surprise produces another ruling and another restated brief, when it should produce a measured check or a fix to the grammar.

**What caused the rework so far:**
1. **Grammar decided after fan-out.** Kinetic type, then the lyric-led camera, arrived after seven plates were blocked in. "Prototype first" (`:77`) was the right instinct; it needs to be the standing rule for any cross-cutting change, *and* the prototypes must include the hardest case. For lyric-led, that is a reveal-by-light plate (uv, luminol or articulator), not only `scale`.
2. **Numbers checked by eye.** Most fix items in reviews 3–5 are measurements: hero widths of "~12–15%", "GO ~5%", words clipped at the lane edge, cap heights, a T.F. at "~6% of frame width". Each costs a fix round of about 28 points.
3. **Restated rules drift.** Every brief re-lists the palette, the guards, the glove and the speed limit, and the copies diverge (C7, C14, C21).

**Merge:**
- The shared preamble of every brief goes into `TEETH2-BUILDERS.md`. Each brief becomes: "read RULES (IDs …), your plate card, the review section; do items 1–n; deliverables".
- The treatment's history sections ("Gate 2: the stills", "the team plan", the taste-call answers, `:183–226`) go to the ledger. The rules they set are folded into the rules file.

**Cut:**
- `critic-checklist.md` as a Teeth document. Keep it for Monster.
- Strike-through as a supersession method (`:69`). Delete the dead text and leave a pointer in the ledger.

**Automate:**
- **P1. A lyric-presence and type probe in `kinetic.ts`.** Every Teeth word passes through `KinWord`/`drawKin`/`packKin`, so the kit is the single choke point. Record each glyph's screen box per frame, projected through the plate's camera for surface type, and teach `lint.ts` the Teeth checks:
  - the current line present;
  - supporting cap height ≥5%;
  - the hero threshold;
  - title-safe;
  - nothing lit more than 0.4 s early;
  - no mid-word crop.
  This automates most of what reviews 1–5 measured, and it would have caught round 1's failure before the client saw it.
- **P2. A palette histogram on sheets:** violet outside `uv`, luminol blue outside `luminol`, red outside 165.16–186, tungsten outside `scene`; plus a value range per shot.
- **P3. An automatic comparison at the approved still times** (PSNR or SSIM against the gate 2 JPGs, flagged for the lead, never a hard fail).
- **P4. List the lint's "known false hits"** in the rules file, so "0 errors" means something.

**Keep:**
- One fresh reviewer per batch.
- The two-round cap at gate 3, as the single stated policy (C17).
- The blind P(doom) comparison, for the next two or three plate types only (O7).

**The handoff:** make it a state file of 40 lines or less that the lead rewrites as the last step of every commit session: current gate, the status matrix (M1), the next action, open client questions, and usage. History belongs in the ledger.

---

## 5. Organisation

**Today, finding the current rule for anything** means reading:

- the treatment's binding rules;
- the plate paragraph;
- two later binding sections that supersede parts of both;
- ledger rulings spread over four gates;
- the client calls in two places;
- the latest brief, which may carry further one-off rulings (the "first words may leave" shed rule, the 8% floor).

Supersession is done in four different ways: strike-through, a "supersedes" sentence, a ledger-only ruling, and a brief-only instruction. None of them is reliable.

**Proposed structure** (`docs/teeth2/`):

| file | contents | rule |
|---|---|---|
| `RULES.md` | Every binding rule, numbered (R1…), each with text, scope (plates or sections), purpose, test (lint / histogram / measured / eye), and source (client date or ruling ID). The precedence order at the top. | The only place a rule lives. When a rule changes, its text is replaced and the ledger records why. |
| `PLATES.md` | 14 plate cards: story beats and exhibit (binding); type card (M3); camera per line; impact tiers; hand-offs in and out (M4); approved stills; owned compositions; status (M1). | Story beats come from today's paragraphs. Camera and type lines are rewritten to the current grammar. |
| `TYPE.md` (or a section of RULES) | The kit vocabulary, line layout, wrap/shed, pickups, gaps, impact tiers, the slam budget and the TEETH hook plan. | Moved out of the `kinetic.ts` comment; the code points here. |
| `LEDGER.md` | Chronological and append-only: each review, ruling and client call, ending with "→ R12, plate card 6". | History, never consulted for the current rule. |
| `BACKLOG.md` | Gate 4 items by plate. | One list. |
| `HANDOFF.md` | State only (see above). | Rewritten each session. |
| `CHECKLIST.md` | The reviewer checklist generated from RULES, with its test column. | Replaces `critic-checklist.md` for Teeth. |
| `gate3/` | Briefs (delta-only, citing rule IDs) and reviews. | Archive. |

**Migration, cheap and in order:**
1. **The lead, about an hour:** strike the dead lines listed in C3, C8, C9, C10 and C11; write the status matrix; rewrite the handoff.
2. **One question set to the client** (the taste-level decisions only):
   - Do the reveal-by-light plates keep their reveal on a legibility floor (O2)?
   - May the type carry a reframe inside a line (O1)?
   - Is the lyric held over the outro carry, 186.85–193.76 (C1)?
   - Is the line held through gaps such as the tag signing at 9.3–10.8 (C1)?

   Lead calls, no client needed: TEETH in red (C7); halation on slams (C6); pickups (O3); the label and value-range scope (O4, O11).
3. **A Sonnet (low) chore:** fold everything into `RULES.md` and `PLATES.md` from the treatment and ledger, with the lead checking the diff.
4. **Then the next build**, on a brief that cites rule IDs.

This fits inside one 5-hour window, and it should come before the type-and-camera pass reaches the other 13 plates.

---

## 6. Model and effort efficiency

Inputs: the lead's staffing and token figures (passed to me with the client's request), plus the round counts below, taken from `review1.md`–`review5.md`, `briefs-round5.md`, `briefs-round6.md` and the ledger. The savings figures are rough. They assume an Opus build of about 300k tokens uses about 22% of a 5-hour window, so a window holds about 1.35M Opus tokens. **I could not find Sonnet's usage weight relative to Opus written down anywhere; measure it with the usage tool on the next pair before relying on the Sonnet savings below.**

### 6.1 The retake record

**The nine plates built new at gate 3:**

| plate | model | first verdict | builder runs | reviews |
|---|---|---|---|---|
| polygraph | Sonnet | REWORK | 3 | 2 |
| scene | Sonnet | REWORK | 3 | 2 |
| acetate | Sonnet | REWORK | 3 | 2 |
| voice | Sonnet | FIX | 3, plus 1 kinetic | 2 |
| chart | Sonnet | FIX → SHIP | 2 | 2 |
| uv | Opus | REWORK | 3 | 2 |
| luminol | Opus | REWORK | 3 | 2 |
| articulator | Opus | REWORK | 3 | 2, then a lead check |
| filed | Opus | FIX | 3 | 2 |

**The five gate 2 plates:** each had one extension pass at gate 3 (review pending), after four review rounds at gate 2. `scale` has since had three kinetic runs (r1, r2, r2b), about 925k tokens for one plate's lyric layer. `lightbox` has had one kinetic run.

**Kinetic round 1:** 776k tokens (311k, 232k and 233k), all lost to a brief error.

That makes about **36 builder runs and about 7 reviews in gate 3 so far**. Builders are roughly 95% of the spend.

### 6.2 What drove the retakes

The first-round items of reviews 1–4 sort roughly as follows (my reading of each numbered item):

| cause | share of first-round items | evidence |
|---|---|---|
| **Rules that did not exist yet** (each later became a ledger ruling) | ~40% | The glove was rebuilt differently in six plates and flagged in four reviews before it became one shared model (`LEDGER:88, 101`). Value range was flagged on three plates at once, then ruled (`:102`). Hero scale had no number until review 4 (`:112`), and nor did the uv coverage (`:78`). The ink blot only became a breach at review 1 (`:77`). Placards repeated plate 3 (`:99`). The acetate→match tracing was unspecified until review 4 (`:109`). |
| **Craft: materials and light** (clay beds, a slab of a shirt, a "fried egg" print, a cage instead of an articulator, flat light) | ~35% | This is the only category where model capability plausibly matters, and it hit both models: Sonnet's scene and acetate, Opus's luminol and articulator. |
| **Measurable layout and timing** (heroes at 5–15% of width, crops, clipped words, unreadable phrases) | ~25% | Every one of these could be measured automatically. The frame checker cannot see Teeth's type (C19). |
| **Brief errors** | few items, but the largest single cost | Kinetic round 1 (776k tokens) and the articulator numbers that cannot all hold (C16). |

**Model capability is not the main driver.** First-pass REWORK hit 3 of 5 Sonnet plates and 3 of 4 Opus plates. The graphic plates are easier, so this does not prove Sonnet is as good at 3D, but it does show that Opus did not buy fewer retakes at block-in. **The retakes were driven by unclear or missing rules (about 40%) and by checks nobody could run (about 25%).** Neither is fixed by a stronger model; both are fixed by sections 1–5 above.

### 6.3 Role by role

| role | now | recommendation | reason |
|---|---|---|---|
| **The lead** | Opus | **Keep Opus.** Have it pass the doc fold and other doc chores to Sonnet at low effort. | The single most expensive mistake (776k tokens) was a brief. Brief-writing is where Opus is worth the most. |
| **First build of a 3D or lighting plate** | Opus, high | **Keep.** | Craft is where the remaining capability gap is likeliest. |
| **First build of a graphic plate** | Sonnet, high | **Keep.** | Its record (chart SHIP in one fix; voice FIX→FIX) is as good as Opus's. |
| **Fix round with a precise, numeric or layout list** (push in, uncrop, move a word, retime, a defocus) | Opus or Sonnet, high, fresh | **Sonnet, medium**, on any plate. A trial is worth running: r2b's seven items were mostly of this kind and cost 316k Opus tokens. | The list does the thinking. The work is editing parameters in existing code. |
| **Fix round for a REWORK of look, material or anatomy** | the plate's model, high | **Opus, high.** | Craft again. |
| **First-round batch review** | Opus, high | **Keep.** It is the cheapest lever in the system (3–7% of a window) and finds the defects. | Judging images for taste and craft is where Sonnet is weakest. |
| **Second-round review** (checking that a list was fixed) | Opus, high | **The lead checks lists of three items or fewer** (already done for articulator, acetate and filed). For longer lists, an **Opus at medium effort, told to check the list and the rules only**. | Most of the work is "was #3 fixed?", which needs little reasoning. |
| **Blind review against P(doom)** | Opus, high, about 72k | **Keep Opus high for the next 2–3 plate types**, then replace it with the measured presence probe (P1) plus a lead spot-check. | 72k for 2–3 tool calls is mostly reasoning over image strips. It gates the client, so do not cheapen it while the grammar is still new. |
| **Chores** | Sonnet, low | **Keep.** Add the doc fold and the probe wiring. | — |

### 6.4 A fresh builder per fix round, or resume the last one?

**Fresh is right** for anything more than a one-line change:

- A resumed builder carries its whole history (about 300k tokens) into every turn.
- The cache rarely survives the gap between a build and its review.
- Your own working rule is to avoid resuming large agents.

**What fresh builders waste** is re-exploring code: an estimated 30–60k tokens per run spent finding the plate's files, uniforms, timing tables and helpers. The fix is a **handover in every builder's report**: about 10–15 lines mapping files to what they hold, with the key functions, the timing tables and the tunables (a 60–80 word addition to the ≤150 word limit).

Combined with a shorter canonical `RULES.md` (the docs are about 15k tokens of reading today, with dead text included), I estimate this **saves 30–50k per builder run, so about 1–1.5M tokens over the roughly 30 runs remaining in gates 3 and 4: about one window.**

### 6.5 Would more upfront spend cut retakes? Yes, three checks

1. **A brief check** (Sonnet medium, about 20–30k, before any build).
   - It reads the brief, `RULES.md` and the plate card, and answers three questions:
     - Can every numeric constraint hold at once?
     - Does any line contradict a binding rule or a client call?
     - Does the brief keep anything the latest client direction rejected?
   - It would have flagged C16. Given the lyric-led reference, it would very likely have flagged kinetic round 1's "the scene, its camera and its timing stay" as conflicting with "P(doom)'s level".
   - **Cost:** about 0.3M tokens over 13 plates. **It pays off if it prevents one bad build** (about 300k).

2. **A key-frame checkpoint before the full window** (the largest saving).
   - Split each build into **phase A, lookdev:** the set, light, materials and the type card at 4–6 key frames (the approved stills plus one frame per line onset), plus a dense sheet of one line. About 35–40% of a build.
   - Then the lead or an Opus reviewer at medium effort (about 30k) looks at it.
   - Then **phase B, the full window**, by the same agent resumed while its context is still small, or by a fresh one.
   - Six of the nine first passes were REWORK: a full build thrown away on the core read. Catching half of those at phase A saves about one full Opus run per caught plate.
   - **Over the 13 type-and-camera passes still to come: about 0.8–1.2M tokens, close to one window.**

3. **Prove the grammar on the hardest plate first.**
   - The next lyric-led prototypes should be one reveal-by-light plate (`uv`, `luminol` or `articulator`) and one light plate (`chart`), not more `scale` rounds.
   - At about 600k tokens per plate (a build plus a fix), the remaining 13 plates represent about **7–8M tokens, about six windows**.
   - A grammar error found after fan-out costs a large share of that. Found on two prototypes, it costs about 1.2M.

### 6.6 Render budgets and report limits

- **Render budgets** (10, 15 or 20 renders) are about right, and the r2b overrun (20 against 15) is not where the tokens go. A dense sheet is one image of about 1.5–3k tokens to read, so even 20 renders are a minor share of a 300k run. Code reading and shader iteration dominate.
- **Changes:**
  - Count *sheets* rather than renders.
  - Require one dense sheet per line instead of single stills.
  - Once the presence probe exists (P1), replace the "count the frames by eye" self-check with the probe's report. That saves renders and makes the check exact.
- **Report limits** (≤120–200 words) are right: they protect the lead's context, which is the long-lived one. Add the code handover (6.4) as a separate section that does not count against the limit.

### 6.7 Effort levels

- **High** for first builds, round-1 reviews, the blind review and the lead.
- **Medium** for precise fix rounds, list-checking second reviews, the brief check and the key-frame checkpoint review.
- **Low** for chores.

Do not drop first builds to medium: build quality depends mostly on the reasoning about what to make, and that is where a retake costs about 300k.

### 6.8 Verdict on staffing

**Broadly on track:**
- fresh agents;
- at most two at a time;
- cheap Opus reviewers;
- Sonnet on the graphic plates.

**But the expensive resource is used in the wrong place.** Opus builders at about 300k each are spent on full-window builds before the look and the grammar are confirmed, and on fix rounds that are parameter edits. The ranked changes and rough savings over the rest of gate 3 and gate 4:

| change | rough saving |
|---|---|
| A key-frame checkpoint before every full build | ~0.8–1.2M tokens, ~1 window |
| Prove lyric-led on a reveal plate and a light plate before fan-out | protects ~7–8M tokens of fan-out; avoids a repeat of the 776k round 1 |
| Precise fix lists on Sonnet at medium effort | ~1–2M Opus-equivalent tokens, ~1–1.5 windows (depends on Sonnet's usage weight; measure it) |
| A code handover in reports, plus a shorter canonical rules file | ~1–1.5M tokens, ~1 window |
| A brief check before each build | costs ~0.3M; pays off by preventing one bad build |
| The presence probe and palette histogram instead of eye-measured fix items | ~3–5 fix rounds avoided, ~1 window |
| Lead or medium-effort list checks for second reviews | small, ~0.1–0.2M |

**Total: roughly 4–5 windows**, against an estimated 10–12 windows for the rest of the work as currently staffed. That is about a third less, and fewer retakes should also raise quality.

