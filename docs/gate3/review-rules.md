# Blind review of the Teeth v2 rules (R1-R98)

"Wins" follows the precedence section. It gives no order inside RULES (only section I says later wins), so for A-H clashes I take the later client call, then the later ID.

## Findings

| # | Rules | Type | Evidence | Fix |
|---|---|---|---|---|
| 1 | R24 vs R92(f); TYPE §8; cards 5, 6; check 17 | conflict, superseded | R24 "flat palette fills in Archivo 900"; R92(f) "never a flat title card". R92 wins, as intended, but TYPE, both cards and check 17 still prescribe flat fills. | Replace R24 with R92(f); rewrite TYPE §8.1-2, card slam lines and check 17. |
| 2 | R51, R72 vs R92(e) | conflict | R51: `GLSL_HAND` "or matches it exactly"; R72: `match-glsl.ts` read-only; R92(e): realistic creases and cuff. All three can't hold (`uv` r2 needs it now). | A kit chore (R86) upgrades `GLSL_HAND` to R92(e); R51: "import the kit glove". |
| 3 | R26, R40 vs R92(c, d, g), R97 | practice | R26: low verses, 3a "small and slow", a drifting bridge. R92, every plate: ≥20° or 500 px per line, a ≥1.2x macro, energy "between `scale` r5 and P(doom)". R97: one band "in every brief". R40 bans "screensaver drift". | One R97 band per R26 section; R92(c, d, g) name their sections; change the bridge to "slow tracking". |
| 4 | R79 vs R38, card 6 | practice | Tier 1 is "about one a bar at most". A 2-bar chorus line has two hero onsets plus an opener: card 6 has 3 hits per line (1.5 a bar), `scale` r3 had 11 in 8 bars. | At most three per chorus line, one a bar elsewhere. |
| 5 | R80 vs R92(d), R78, R21, R81 | conflict (numbers) | Push ≤"20%"; macro "≥1.2x" (built: 1.3x, 1.35x). On `articulator` a 20% hero cap via a ≤1.2x push needs 180 px caps at line framing; title-safe (1,728 px) then holds ~17 characters (~0.55 cap each). A chorus line is 39 on one bar, R76's kept tail 20: R81 fails. | Make the macro an R36 reframe outside R80; R78: "push or macro"; a TEETH slam counts as its half-line's reframe. |
| 6 | R13 vs R90; R92(a) | conflict, unclear | R13 lists the glow token in "`acetate`", but R90 says "no glow token". R92(a)'s "p99 ≥235 (or the plate's glow token)" has no number: luminol's luma is ≈153, uv's ≈72. | p1 ≤16 plus a p99 per plate (e.g. luminol ≥150); drop `acetate`. |
| 7 | R20 vs R19, R31 | conflict | R20: "Unsung words at halide ~35%" (shown early). R19: "Nothing shows more than 0.4 s early". R31: built "as it is sung". R31 (later) wins. | Q1; default: halide only in the 0.4 s pre-roll. |
| 8 | R1 vs R30, R82 | conflict | R1: "The one deliberate echo is the bookend drawer". The TEETH slam recurs seven times, and slams are a shared idiom. R30 (later) wins. | Name the drawer, the hook and kit idioms as the deliberate recurrences. |
| 9 | R12 vs R14, R58, R59 | conflict | R12: "one hard source". Plate 3 adds a work light to tungsten, plate 11 has "no key light", plate 10 needs a studio card. | "One key source, motivated fills allowed; plate 11's key is the reaction." |
| 10 | Precedence; TYPE §8.7; R82, R28 | unclear | TYPE is unranked yet sets `filed`'s three slams ("decided here"); R82 has no outro budget. The last slam "does not exit", against R28 and the 183.40 line. | Rank TYPE below RULES; move the exception into R82; settle the exit. |
| 11 | R70 vs R91, R94, R92(e) | conflict | R70: "at most one clip ... (4 s or less)", "polish waits for gate 4". R94: a 13.8 s whole-window clip; R92(e): realism from round 1. | One deliverables list in the process doc; drop "polish waits". |
| 12 | R15 vs cards 5, 6 | conflict | R15 makes *pretty* tender (wax-pink Cormorant); cards 5 and 6 set PRETTY in Archivo black. R15 wins. | Q2. |
| 13 | R26 vs card 12 | conflict | 3a is "small and slow", but card 12 has "hero words large". R26 wins. | Q3. |
| 14 | R52, R53, R17 vs R51, R56, R60 | superseded | R52's scope includes plate 4 (machine pens) and plate 7 (no pen lyric, R56). R17 and R53 pen `acetate`'s lyric, but it is now printed (R60). | Pen lyric: plates 13, 14; signatures: 2, 7, 11, 13, 14. |
| 15 | R39 vs R36, R77 | conflict, duplicate | "Cuts only between lines" clashes with R36's in-line reframes and R39's own slam cut. R39 times the cut by the "first stressed word", R77 by "within 0.12 s of a downbeat". | Keep R77's wording; retitle R39 "Cuts between lines". |
| 16 | R41 vs R31, R34 | practice | Approved stills keep the "same composition, type and colour", but they predate whole-line type. | "Same exhibit, light, colour and beat; type per the current card." |
| 17 | How to read, R18, R19, R29, R31, R83, R89, R91; CHECKLIST; PLATES | superseded | "pending until the `kinetic.ts` probe exists", but HANDOFF: it is in (100% presence). R89's LINGER and R91's probe line are dead. "RULES open question 1/4/5/8/12" was settled by R75-R85. Card 5 describes r2b. | Delete the markers and LINGER; re-point the citations; refresh card 5 to r5. |
| 18 | R14, R16, R60, R68, R82, R92(f) | superseded (history) | "Never near 165.16" (plate 3 ends at 34.64); "older ... ruling is dead"; "after one attempt"; "Superseded where it differs". | Keep only the current rule; history to the ledger. |
| 19 | R50/R88, R29/R76, R31-R33/R75, R35/R92(c), R36/R92(d), R42/R83, R69/R85/R98, R67/R72, R17/R49, R56-R58, R22/R24, R9/R10 | duplicate | Red ends at "~186" (R9) vs "183.5-186.4" (R10). R22's 8% is "advised", but cards 5-6 and check 15 say "at least". | Merge as in the core; cards follow R22. |
| 20 | R28, R31 vs card 3 | conflict | The near words go "dissolving into blur" on each push: a fade-like exit, and the line becomes unreadable. | The rack holds the words at the R22 floor. |
| 21 | R10, R95, R92(c), R21, R57, R37, R18, R29 | unclear | R10's red monogram vs three pre-165.16 signings; R95 lacks pass marks; R92(c) "against `uv`" has no figure; R21 "whichever comes first"; R57 "Avoid"; R37 "a few pixels" vs 12 px; R18 "everything" vs full-frame slams; occlusion only on card 6. | Add thresholds and "from 165.16"; "either"; "no top-down"; scope R18 to the lyric; occlusion into R29. |
| 22 | R47 vs R54, card 7 | unclear | Exhibits "only things she touched ... and his own", yet the list includes the bed, the polygraph and "Her odontogram". | Q4. |

## A proposed slim core (40 rules)

- **Concept:** R1 (amended); R2 + R92(b) (exhibit and instrument read); R3; R4 + R53's signature clause; R5.
- **Palette and light:** R8; R9 + R10 (from 165.16 to the drain at 183.5-186.4, red is the outline, TEETH, monogram and stamp); R11; R12 (amended); R13 + R92(a) + R90 (p1 ≤16, p99 per plate); R15.
- **Type:** R17 + R18; R19 + R20; R21 + R22 (hero cap ≥20% or width ≥30%, support ≥5%, 8% advised, 11 and 12 exempt); R23; R24 = R92(f); R25 + R96 (`kinetic.ts` and `plate-kit.ts`); R26 + R92(g) + R97 (an energy band per section); R28; R29 + occlusion ≤2 frames; R76 + R29's shed clause; R82 + R30 (hook, slam budget, `filed`).
- **Camera:** R31 + R32 + R33 + R75 (on screen 7.23-186.83, holds ≤2 bars, clears on a beat or for a named set piece, ≥95% of sung frames); R34 + R81; R35 + R92(c); R36 + R92(d) (one ≥1.2x macro per half-line in choruses and per line elsewhere; a slam counts); R37 + R38 + R79; R39 + R77; R40 + R80 (pushes only); R41 (amended).
- **Stakes and craft:** R43; R45 + R27; R47 + R46; R48; R49 + R7's "no title card or credits"; R50 + R88; R51 + R92(e); R52 + R53's pen hand; R56.
- **Done:** R85 + R71.

**Where the rest goes**
- **Plate cards (13):** R6 to card 8; R14 and R44 to card 3; R16 and R54 to card 5 (exhibit numbers to the PLATES header); R55 to cards 12-13; R57 to card 6; R58 to card 11; R59 and R78 to card 10; R60 to cards 4, 8, 12; R61 to cards 5, 9, 11; R62 to the R87 transitions table.
- **Process doc (23):** R7 (publishing), R42, R63-R70, R72-R74, R83, R84, R86, R87, R89, R91 (absorbing R68), R93-R95 (R95 could join CHECKLIST), R98.
- **Merged into the core (22):** R10, R18, R20, R22, R27, R30, R32, R33, R38, R46, R53, R71, R75, R77, R79, R80, R81, R88, R90, R92, R96, R97.
- **TYPE** stays, ranked. **Archive:** the history in findings 17-18.

**Counts:** 98 before; after, 40 in RULES (13 to cards, 23 to process, 22 merged).

## Open questions for the client

1. **R20:** does the line show faintly ahead of the voice, or each word only from 0.4 s early?
2. **R15:** is *pretty* wax-pink in every chorus, or only on `acetate`? Fluor-white under UV?
3. **`acetate`:** small, eerie heroes (R26) or large ones (card 12)?
4. **R47:** are her odontogram, the bed and plate 2's radiograph (whose?) allowed exhibits?
5. **Finding 3:** how far below the chorus band do verses, 3a and the bridge sit?
