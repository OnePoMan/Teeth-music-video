# Teeth v2: gate 4 backlog

One list, gathered from the handoff, the ledger, `docs/gate3/review1.md`-`review5.md` and the doc review. By plate in song order, then cross-cutting. Polish and speed only; the type-and-camera pass is gate 3 work (see `HANDOFF.md`). No duplicates: an item that appears in several sources is listed once.

## By plate

| plate | item | source |
|---|---|---|
| 1 `drawer` | Speed 103 - 125 ms per frame. Keep `filed`'s last frame matching t=0 (at least 40 dB PSNR) after any change. | handoff; briefs |
| 3 `scene` | Cloth material; pillow softness; chunky tent backs. Show the client that DEAD (27.30) reads as a neutral marker. | handoff; review 3; client 2026-11-20 |
| 4 `polygraph` | Pens read as map pins; the tear's white fibre edges and film2 gap (48.72); the top of wide frames. | handoff; review 2 |
| 5 `scale` | Apple macros read a little smooth up close; #8's notch reads only at zoom; speed ~190 ms (r2b target 138). | handoff; briefs |
| 6 `uv` | Gloves a little cartoonish; the swab sleeve mass at 71.00 - 71.45; lone supporting words at at least 5% cap height with the lamp in frame (62.70, 64.60, 66.20, 67.60, 68.10, 69.80); the beam over the hem or open end in two more setups. | handoff; review 2 |
| 7 `chart` | The shared glove's knuckle lumps (see cross-cutting). | review 3, 4 |
| 8 `voice` | Rebuild `voice-data.ts` and the spectrogram from the separated vocal stem (it reads as a small grey noise patch). | review 4; client 2026-11-20 |
| 9 `pour` | The turned-out cast's front teeth show slight gaps; cast frames lack lightbox-bright before the trimmer; the cast half runs 180 - 225 ms (likely the kit's `sdCast`). | handoff |
| 10 `articulator` | Speed 110 ms per frame (124 ms on the hero macros). | handoff; review 4, 5 |
| 11 `luminol` | Bag words are self-lit (WHO's W at 138.30, HEART's H at 141.30): letter brightness should follow the glow behind, with a halide floor; the bag reads as a rigid box with a rail; the forearm at 143.80 is a giant cylinder. | handoff; review 3 |
| 12 `acetate` | The lyric laid in the print's perspective (it reads as a flat overlay); the grey hard-edged lamp patch at left (145.90, 150.40). | review 5 |
| 13 `match` | The chip at the lock is small at full frame; the opening may show the sheet landing face-down. | handoff; ledger |
| 14 `filed` | TEETH at 175.95: raise a touch so the letter feet sit on the bone band; a faint edge on the glove holding the backlit radiograph. | review 5 |

## Cross-cutting

- **Kit (now R51: after `uv`'s r2 full pass, a chore ports `uv`'s glove into `GLSL_HAND`; this item closes with it):** the shared glove's knuckle lumps (`sdGlove` in `match-glsl.ts`), fixed in the kit and re-checked against the gate 2 match stills (`match`, `chart`, `uv`, `acetate`). (handoff; reviews 3, 4; ledger)
- **Render budget:** one measured 4K test render of 2 s per plate with `--samples auto`, then a whole-video budget in GPU-hours, slowest plates optimised first (lead call 2026-11-21; the review's rough estimate is 12 - 50 GPU-hours, unchecked).
- **Lint:** list the frame checker's "known false hits" so "0 errors" means something (doc review P4).
- **Checks:** a palette histogram on sheets (violet outside `uv`, luminol outside `luminol`, red outside 165.16 - 186, tungsten outside `scene`; value range per shot) and a PSNR or SSIM comparison at the approved still times, flagged for the lead and never a hard fail (doc review P2, P3; proposed).
- **Cut level:** a gate 4 cut-level reviewer (Opus xhigh) on a 1080p rough cut; a 2 fps strip of the whole song at each batch; a transitions table (13 boundaries plus the loop) and a section energy and light/dark rhythm map (doc review M4, M5; open).
- **Final:** the 4K60 render, in segments (gate 5).
