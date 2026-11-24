# Rewrite RULES into a slim core (brief, Opus 5.5 high)

The blind review `docs/gate3/review-rules.md` found 22 problems in `docs/teeth2/RULES.md` (R1-R98) and proposed a 40-rule core. The client approved the rewrite on 2026-11-23 and answered three of the review's open questions. Carry out the review's proposal with the client's answers and the lead's calls below.

**The client's answers (2026-11-23), binding:**
1. **R15, the tender word as hero:** when a tender word (*pretty*) is its line's hero, the hero idiom wins: PRETTY stays Archivo black in `scale` and `uv`. *sweet*, *rose* and *wife* keep the tender register when they are not the hero, and *sweet* stays fluor-white Cormorant under UV.
2. **R51, the glove:** `uv` round 2's glove becomes the kit glove. After `uv`'s full pass, a chore ports it into the shared kit (`GLSL_HAND`), and R51 points at it. Until then, `uv` keeps its own glove copy. That is a named, temporary exception, not a conflict.
3. **R20, pre-roll:** a word appears at most 0.4 s before it is sung, faint (halide) only in that pre-roll. There is no faint line ahead of the voice.
4. **Still open:** review questions 3 (`acetate`'s hero size), 4 (which exhibits are allowed) and 5 (the energy band for verses, 3a and the bridge). Don't decide them. Leave each where it stands, marked "open (client, batch with R93)", and list them in HANDOFF's "Open client questions".

**The lead's calls on the other findings:**
- Accept the review's fixes for findings 1, 2 (as answered above), 3, 4, 5, 6, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20 and 21.
- On findings 12, 13 and 22, apply the answers above or leave them open as in point 4.
- **Finding 6:** p1 ≤16 everywhere, and p99 ≥235 where the plate's peak is lightbox. Plates whose peak is a glow token get their p99 target on their plate card, measured at their next checkpoint. Where the number isn't known yet, mark it "set at the next checkpoint". Don't invent numbers.
- **Finding 3:** chorus plates use the band measured by R97. The other sections' bands are open (point 4).

**How:**
- **Keep IDs stable.** Surviving rules keep their R-number, with merged text. Add a short "Retired IDs" table at the end of RULES that maps every removed ID to where it went: the surviving rule, a plate card, `PROCESS.md`, TYPE, or the ledger. Briefs, cards and code comments cite these IDs, so a citation must always lead somewhere.
- **Move process rules** to a new `docs/teeth2/PROCESS.md`, with their IDs kept as headings or table rows so citations still resolve. These are R7's publishing part, R42, R63-R70, R72-R74, R83, R84, R86, R87, R89, R91 (absorbing R68), R93-R95 and R98. Put R70's and R91's deliverables, and R94's, into one deliverables list.
- **Move plate-specific rules** into their plate cards in `PLATES.md`, as the review lists them, with their IDs cited.
- **History** (dates and "older ruling is dead") goes nowhere new. It is already in the ledger, so cut it from the rule text and keep only the current rule. Keep each rule's source column short.
- **Update the dependent text:**
  - TYPE §8 items 1-2 and the slam lines on cards 5 and 6 (slams in the plate's world, R92(f); `scale` r5's slam stands as built);
  - CHECKLIST item 17;
  - card 5's status, refreshed to r5 (`8fd2354`);
  - card 6's status (r1 `65680b3`, r2 checkpoint `acb8b18`);
  - the precedence section: TYPE ranks below RULES and above plate cards; PROCESS ranks with RULES for process questions.
- **Re-point the dead citations** ("RULES open question N", "pending until the probe") to their current rules.
- The rules section stays short and builder-facing, one requirement per rule.

**Don't touch:** code, `docs/gate3/` briefs (except this one), the ledger, the archive. Don't commit.

**Report** in ≤150 words: the before and after counts, the files changed, any finding you couldn't apply cleanly and why, and a list of every change that touches plate 6 (`uv`): card 6, R57, R15, R51, R20, R13/R92(a), R79/R38, R80/R36 and R92(d), and anything else.
