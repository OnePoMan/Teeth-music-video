# Teeth v2: reviewer checklist

Generated from `RULES.md`; replaces `docs/critic-checklist.md` for Teeth (that file belongs to the Monster video). Read the ledger and RULES first; do not re-raise settled items (R64). If you find a conflict between a settled item and a later client call, report it to the lead and enforce neither.

Verdict words are not yet defined (RULES open question 12). Use SHIP / FIX / REWORK as: REWORK = the plate's core read fails; FIX = rule or timing defects; SHIP = polish only. At most two review rounds per plate (R69).

Tests: **lint** = frame checker (does not yet see Teeth's type; "pending" until the `kinetic.ts` probe), **histogram** = palette histogram (not built), **measured** = a number from a render, **eye** = you look. Where a test is pending, do it by eye and measure the numbers by hand.

| # | Check | Rule | Test |
|---|---|---|---|
| 1 | Does any plate, shot, trick or exhibit repeat another (including v1's)? Only the bookend drawer may echo. | R1 | eye |
| 2 | Does every image make sense, and does every light, shake or flash have a source in the scene? | R2 | eye |
| 3 | Is the monogram T.F. with its two full stops, signed only where a signature goes, and are name fields blank until 165.16? | R4, R53 | eye |
| 4 | Is the chip on #8 present where it should be, from the one tooth set, and are suspects different arches without the chip? | R5 | eye |
| 5 | Is every colour in the palette, with violet only in plate 6, luminol only in 11, tungsten only in 3 (as light, never as surface colour), and red only 165.16 - ~186? | R8, R9, R14 | histogram (pending), eye |
| 6 | Is red only the traced outline, TEETH, the monogram and the stamp, at full match red and a readable weight, with no flood? | R10 | histogram (pending), eye |
| 7 | Does anything glow or bloom except uv, fluor, luminol, match? Any soft orbs on non-glow materials, or grainy halos? | R11 | lint, eye |
| 8 | Does every shot have a hard source, real blacks, a light event on money moments, and radiographs backlit? | R12 | eye |
| 9 | Does every shot reach film-black and its plate's peak? Any mid-tone-only shot? | R13 | histogram (pending), eye |
| 10 | Is the tender register wax-pink Cormorant italic (and *sweet* in plate 6 fluor-white)? Is the apple golden stone yellow with an apple silhouette? | R15, R16 | eye |
| 11 | Fonts and craft: Archivo / Plex Mono (inside objects) / Cormorant / single-stroke; kerned; curly quotes; no outlined or haloed type; inside title-safe (96 px)? | R17, R18 | lint (pending), eye |
| 12 | Does each word light at its `start` (not more than 0.4 s early), with no fade-in entrance? | R19 | lint (pending), measured |
| 13 | Unsung halide ~35%, sung lightbox, hero snapping light to heavy on its onset? | R20 | eye |
| 14 | One hero per line at scale (cap at least 20% of frame height, or width at least 30%), readable at a glance, held start to end? (Exempt: plates 11, 12.) | R21 | measured |
| 15 | Supporting words physical (never flat captions) at cap height at least 5% (8% on a line's first frame)? | R22 | measured |
| 16 | In reveal-by-light plates, does every sung word stay above the readable floor, with the light lifting rather than creating legibility (GO's decay in plate 6 excepted)? | R23 | measured, eye |
| 17 | Do slams use flat palette fills in Archivo 900, no outlines, taking grain and motion blur but no halation? | R24 | eye |
| 18 | Do supporting words move on their surface via the kit, keyed to the beat grid? Does energy match the section? | R25, R26 | eye |
| 19 | Do breaks split along the plate's motif and never into drips, blots, blobs or spatter? Do lines exit on a beat with a move (no fade or pop)? | R27, R28 | eye |
| 20 | Is any word clipped mid-word while its line is on screen? | R29 | lint (pending), measured |
| 21 | Is the TEETH hook the planned slam for this plate, escalating on return? | R30 | eye |
| 22 | Is the current line on screen in every sung frame, built word by word with sung words staying? Count empty frames on a dense strip (8 per second). | R31 | lint (pending), measured |
| 23 | Does the line hold through a gap of up to ~3.5 s and clear on a beat? Is the intro, outro carry (186.85 - 193.76) and closing riff lyric-free? | R32, R33 | measured |
| 24 | Does the camera follow the type, each line one continuous move easing into the downbeats, with no direction reversal or jump to an unrelated view? | R34, R35 | eye |
| 25 | If there is a cut or reframe inside a line: at most one per line (verse) or half-line (chorus), opening on the sung word, already readable, line re-established in 2 frames? | R36 | eye, measured |
| 26 | Are impacts graded (downbeats strong, backbeats light, hero strongest), instrument hits only on meaningful moments, each hit revealing the type? No two repeats of a line with the same hit pattern? No flash before 48.73? | R37, R38 | eye |
| 27 | Do cuts land only between lines on the downbeat nearest the new line's first stressed word, with pickups shown as the head of the new line? | R39 | measured, eye |
| 28 | Does something happen every bar? Any breathing zoom, rush at the camera, push faster than the eye can follow, or screensaver drift? | R40 | eye |
| 29 | Does the plate keep its exhibit, palette and guards, and the approved still times (compare side by side with `docs/gate2/`)? | R41 | eye |
| 30 | (Prototypes) Judged blind against P(doom) on lyric presence, legibility and camera flow? | R42 | eye |
| 31 | Stakes: no gore, horror, wounds, faces, realistic eyes (nothing that reads as an eye)? | R43 | eye |
| 32 | The bed reads as left (no body shape, outline or stain); DEAD a neutral marker? | R44 | eye |
| 33 | Any drip, blot, blob or spatter (ink, glow, glove or tear included)? Tears slits, stains soaks? | R45 | eye |
| 34 | Is the only blood one bloom over his shirt's heart? Is anything of hers damaged or found? | R46, R47 | eye |
| 35 | Are casts ever front-on while closed or closing? | R48 | eye |
| 36 | Any HUD, counter, readout, changing number, or text along the bottom edge? More than one readable label in a frame? | R49, R50 | lint (HUD off only), eye |
| 37 | Is the glove the shared `GLSL_HAND` (film2 matte nitrile, fingers, cuff, lit only by the plate's source), clear of finished marks, and present on every pen-written lyric and carried object? | R51, R52 | eye |
| 38 | One pen hand (single-stroke), the signature excepted? | R53 | eye |
| 39 | Bite photography perpendicular with the scale in plane; exhibits numbered in plate order? | R54 | eye |
| 40 | The tracing: six upper marks, chip last; unmirrored in 12, mirrored in 13; lower arc untraced; red outline closes per anterior tooth group? | R55 | eye |
| 41 | Plate ownership: no placards outside plate 3, no scrolling trace or pen-written lyric in the chart, one butterfly sequence, hands-per-word only in 6, a literal release only in 10? | R56 | eye |
| 42 | Plate 6: uv under ~30% of any frame, GO about 25% at 76.35, no top-down view? Plate 11: lit only by the reaction, nothing outside the bloom above film2, no flash on the seal? Plate 10: reflection band, never a uniform white face? | R57, R58, R59 | measured, histogram (pending), eye |
| 43 | Client single-plate calls: THROUGH MY EYES readable from beneath; spectrogram real; plate 12 fallback; scope guards (no pouring ribbon, no mist, bite pre-modelled)? | R60, R61 | eye |
| 44 | Hand-overs: `filed` last frame vs `drawer` t=0 at 40 dB PSNR or better; `voice` to `pour` match cut; `acetate` to `match` tracing? | R62 | measured |
| 45 | Speed at 1080p at most 200 ms per frame, figure reported? | R71 | measured |
| 46 | Lint on the plate's window: zero errors (and note that it does not see Teeth type until the probe exists)? | R70 | lint |

Cross-plate section (end of every batch review): repeats across plates (R1, R56), the glove, hero scale, value range, hand-overs.
