# Teeth v2: reviewer checklist

Generated from `RULES.md` (and `PROCESS.md` for process checks); replaces `docs/critic-checklist.md` for Teeth (that file belongs to the Monster video). Read the ledger and RULES first; do not re-raise settled items (R64). If you find a conflict between a settled item and a later client call, report it to the lead and enforce neither. Plate-specific rules are on the plate cards in `PLATES.md`.

Verdicts (R85): REWORK = the plate's core read fails; FIX = rule or timing defects; SHIP = polish only. At most two review rounds per plate (R69).

Tests: **lint** = frame checker (through the type probe it sees kit words: presence, size, hero, safe area, early, frame-edge crop; it does not see limb crops or occlusion, which the plate's scans cover), **histogram** = palette histogram (not built), **measured** = a number from a render, **eye** = you look. Where a test is not built, do it by eye and measure the numbers by hand.

| # | Check | Rule | Test |
|---|---|---|---|
| 1 | Does any plate, shot, trick or exhibit repeat another (including v1's)? Only the deliberate recurrences may repeat: the bookend drawer, the TEETH hook and the shared kit idioms. | R1 | eye |
| 2 | Does every image make sense; does every light, shake, flash and particle have a source in the scene? Does the exhibit read as itself and the instrument as an object in use, in every line? | R2 | eye, measured |
| 3 | Is the monogram T.F. with its two full stops, signed by the glove only where a signature goes, red only from 165.16, and are name fields blank until 165.16? | R4, R52 | eye |
| 4 | Is the chip on #8 present where it should be, from the one tooth set, and are suspects different arches without the chip? | R5 | eye |
| 5 | Is every colour in the palette, with violet only in plate 6, luminol only in 11, tungsten only in 3 (as light, never as surface colour), and red only from 165.16 to the drain (183.5 - 186.4)? | R8, R9, card 3 (R14) | histogram, eye |
| 6 | Is red only the traced outline, TEETH, the monogram and the stamp, at full match red and a readable weight, with no flood? | R9 | histogram, eye |
| 7 | Does anything glow or bloom except uv, fluor, luminol, match? Any soft orbs on non-glow materials, or grainy halos? | R11 | lint, eye |
| 8 | Does every shot have one key source (motivated fills allowed), real blacks, a light event on money moments, and radiographs backlit? | R12 | eye |
| 9 | Does every shot reach film-black and its plate's peak: luma p1 ≤16, p99 ≥235 (or the card's glow-token target)? Any mid-tone-only shot? | R13 | measured, eye |
| 10 | Is the tender register wax-pink Cormorant italic where the word is not the hero (PRETTY Archivo black in `scale` and `uv`; *sweet* fluor-white in plate 6)? Is the apple golden stone yellow with an apple silhouette? | R15, card 5 (R16) | eye |
| 11 | Fonts and craft: Archivo / Plex Mono (inside objects) / Cormorant / one single-stroke pen hand; kerned; curly quotes; no outlined or haloed type; the lyric inside title-safe (96 px), slams excepted? | R17 | lint, eye |
| 12 | Does each word appear at most 0.4 s before it is sung (faint only in that pre-roll, no faint line ahead of the voice), light at its `start`, with no fade-in entrance? | R19 | lint, measured |
| 13 | Sung words lightbox, the hero in its plate's idiom snapping light to heavy on its onset? | R19 | eye |
| 14 | One hero per line at scale (cap ≥20% of frame height, or width ≥30%), readable at a glance, held start to end? (Exempt: plates 11, 12.) | R21 | lint, measured |
| 15 | Supporting words physical (never flat captions) at cap height ≥5% (8% advised on a line's first frame)? | R21, R25 | lint, measured |
| 16 | In reveal-by-light plates, does every sung word stay above the readable floor, with the light lifting rather than creating legibility (GO's decay in plate 6 excepted)? | R23 | measured, eye |
| 17 | Does each slam belong to the plate's world (its texture, light or material), never a flat title card, with no outlines or halos, taking grain and motion blur and no halation of its own (a glow-material slam glowing under R11)? `scale`'s r5 slam stands as built. | R24 | eye |
| 18 | Do supporting words move on their surface via the kit, keyed to the beat grid? Is there a graded instrument hit plus one secondary energy element, and does energy match the section's band? | R25, R26 | eye, measured |
| 19 | Do breaks split along the plate's motif and never into drips, blots, blobs or spatter? Do lines exit on a beat with a move (no fade or pop)? | R45, R28 | eye |
| 20 | Is any word clipped mid-word, or covered by a hand, tool or object for more than 2 frames, while its line is on screen? | R29 | lint, the plate's scans, measured |
| 21 | Is the TEETH hook the planned slam for this plate, escalating on return, within the slam budget? | R82 | eye |
| 22 | Is the current line on screen in every sung frame (presence ≥95%), built word by word with sung words staying? | R31 | lint, measured |
| 23 | Does the line hold through a gap of up to ~3.5 s and clear on a beat (or clear for a named set piece)? Are the intro, outro carry (186.85 - 193.76) and closing riff lyric-free? | R31 | measured |
| 24 | Does the camera follow the type, each line one continuous move with its own framing family, easing into the downbeats, with no reversal or jump to an unrelated view, the newest word in the sweet spot? Chorus lines: travel ≥20° or ≥500 px, or the lead's OK? | R34, R35 | eye, measured |
| 25 | One hero macro per half-line (chorus) or line (elsewhere) at ≥1.2x (≥1.1x reported), opening on the sung word, already readable, line re-established in 2 frames, earlier words not shrinking? | R36 | eye, measured |
| 26 | Are impacts graded within the tier ceilings (tier 1 at most three per chorus line, one a bar elsewhere; ≤12 / ≤5 / ≤2 px), the instrument's full hit only at tier 1 and revealing the type? No two repeats of a line with the same hit pattern? No flash before 48.73? | R37 | eye, measured |
| 27 | Does each cut between lines land on R39's downbeat, with pickups shown as the head of the new line or the type carrying the cut? | R39 | measured, eye |
| 28 | Does something happen every bar? Any breathing zoom, rush at the camera, push of more than 20% or under 0.4 s, or screensaver drift? | R40 | eye, measured |
| 29 | Does the plate keep its exhibit, palette and guards, and at each approved still time the still's exhibit, light, colour and beat (compare side by side with `docs/gate2/`)? | R41 | eye |
| 30 | (Prototypes) Judged blind against P(doom) on lyric presence, legibility and camera flow? | R42, R83 | eye |
| 31 | Stakes: no gore, horror, wounds, faces, realistic eyes (nothing that reads as an eye)? | R43 | eye |
| 32 | The bed reads as left (no body shape, outline or stain); DEAD a neutral marker? | card 3 (R44) | eye |
| 33 | Any drip, blot, blob or spatter (ink, glow, glove or tear included)? Tears slits, stains soaks? | R45 | eye |
| 34 | Is the only blood one bloom over his shirt's heart? Is anything of hers damaged or found? | R47 | eye |
| 35 | Are casts ever front-on while closed or closing? | R48 | eye |
| 36 | Any HUD, counter, readout, changing number, title card, credits, or text along the bottom edge? More than one label readable at a glance in a frame? | R49, R50 | lint (HUD off only), eye |
| 37 | Is the glove the kit glove (`GLSL_HAND`; `uv`'s own copy until the port), realistic nitrile, lit only by the plate's source, clear of finished marks, and present on every pen-written lyric, signature and carried object? | R51, R52 | eye |
| 38 | One single-stroke pen hand for everything a pen writes, the signature excepted? | R52 | eye |
| 39 | Bite photography perpendicular with the scale in plane; exhibits numbered in plate order? | card 5 (R54) | eye |
| 40 | The tracing: six upper marks, chip last; unmirrored in 12, mirrored in 13; lower arc untraced; red outline closes per anterior tooth group? | cards 12, 13 (R55) | eye |
| 41 | Plate ownership: no placards outside plate 3, no scrolling trace or pen-written lyric in the chart, one butterfly sequence, hands-per-word only in 6, a literal release only in 10? | R56 | eye |
| 42 | Plate 6: uv under ~30% of any frame, GO about 25% at 76.35, no top-down view? Plate 11: lit only by the reaction, nothing outside the bloom above film2, no flash on the seal? Plate 10: reflection band, never a uniform white face? | cards 6, 11, 10 (R57, R58, R59) | measured, histogram, eye |
| 43 | Client single-plate calls: THROUGH MY EYES readable from beneath; spectrogram real; plate 12's printed lyric; scope guards (no pouring ribbon, no mist, bite pre-modelled)? | cards 4, 8, 12 (R60); cards 5, 9, 11 (R61) | eye |
| 44 | Hand-overs: `filed` last frame vs `drawer` t=0 at 40 dB PSNR or better; `voice` to `pour` match cut; `acetate` to `match` tracing? | PLATES "Hand-overs" (R62) | measured |
| 45 | Speed at 1080p at most 200 ms per frame, figure reported? | R85 | measured |
| 46 | Lint on the plate's window: zero errors (known false hits: R89)? | R85, R70 | lint |
| 47 | Did the builder's R95 checklist pass, or are its misses named? | R95 | measured |

Cross-plate section (end of every batch review): repeats across plates (R1, R56), the glove, hero scale, value range, hand-overs.
