# Teeth v2: builder brief (shared by every plate and kit builder)

Read first: `docs/TEETH2.md` (the treatment: binding rules, palette, type, karaoke rules, your plate's paragraph), `docs/TEETH2-LEDGER.md` (settled items: never re-open them), `docs/ENGINE.md` (the engine), `docs/critic-checklist.md` (what the reviewer checks). For idioms and quality, read one Monster plate that does what you need, e.g. `app/src/monster/scenes/c1-vase.ts` or `circe-cup.ts` (ray-marched 3D), `poseidon-board.ts` (graphic).

## Environment (Windows, Git Bash)

- Tools: `source "C:/Users/ethan/OneDrive/Documents/Claude Projects/Teeth/repo/out/env.sh"` puts bun and ffmpeg on PATH. (If that file is gone: bun and ffmpeg are under `%LOCALAPPDATA%/Microsoft/WinGet/Packages/`.)
- Stills: `cd app && bun scripts/render.ts stills --song teeth --t 55.0,55.3 --only scale --out ../out/gate2/scale`, then **look at the PNGs** with the Read tool. Give `--out` an absolute path to a fresh folder (an existing or relative one fails with EEXIST on this machine), and pass `--url http://localhost:5193` (a dead port) so render.ts starts its own server without live reload: other builders' edits then cannot reload your page mid-render. A board (not part of the edit): `--query board=typesheet --only typesheet`.
- Typecheck your files: `cd app && bun x tsc --noEmit -p tsconfig.json 2>&1 | grep teeth2/` (`bunx` is not on PATH here).
- One GPU (AMD RX 9070 XT) is shared by up to two builders: render stills and short low-res clips only, and don't run `perf` on long ranges. Be economical: few, purposeful renders; look at each one.

## Files

- Song: `app/src/song.ts` (`teeth`), edit: `app/src/teeth2/timeline.ts` (plate windows; `?board=<id>` for review boards). Do not edit either; ask the lead.
- Post: every entry already gets the Teeth look from `app/src/teeth2/timeline.ts` (no HUD, bloom only above 1.0, cold halation tint, grain, vignette, CA). Return only the overrides your moment needs (flash, shake, exposure); never set `halationTint` warm.
- Palette: `app/src/teeth2/palette.ts` (`T_HEX`, `T_LIN`, `trgba()`, `GLSL_TEETH_PALETTE` with `T_FILM` … `T_MATCH`). Use only these colours (plus tints and shades of them). Do not edit it; ask the lead.
- Kit (shared, owned by the kit builder): `app/src/teeth2/teeth.ts` (the tooth set), `app/src/teeth2/monogram.ts` (the T.F. monogram). Read-only for plate builders.
- Your plate: `app/src/teeth2/scenes/<id>.ts` plus your own helpers `app/src/teeth2/scenes/<id>-*.ts`. Touch nothing else. Never edit `app/src/engine/`; if you need an engine change, say so in your report.
- Do not commit, push or switch branches; the lead commits.

## The gate 2 standard

- A still is a frame of the **real plate** at that song time, rendered by the engine, not a mock-up: write the scene so it is a pure function of `f.t` and can be built out to the full plate later. For gate 2 the still's moment must be finished to final quality; other moments of the plate may be simple, but nothing broken or placeholder-looking may show at the still's time.
- The bar is the P(doom) / Monster plates: lit, textured, physical, with depth and grain; nothing flat or clip-art, nothing that looks AI-generated.
- Rules that fail a still: any HUD, counter or changing number; more than one readable label; text along the bottom edge; text outside title-safe (96 px); outlined or haloed type; straight quotes in lyrics; a face, wound, gore or horror; a colour outside the palette or outside its plate (violet only in `uv`, luminol only in `luminol`, red only from 165.16 to ~186 s); glow on anything but uv, fluor, luminol, match.
- Lyrics follow the karaoke rules in the treatment (sung on the word's `start`, nothing more than 0.4 s early, one phrase on screen, one hero word per line at frame scale).

## The gate 3 standard (block-in; supersedes the still-only scope above)

- Build the **whole plate window** (see `PLATES` in `timeline.ts`): every lyric line of the window under the karaoke rules, every beat of your plate's paragraph, and something happening every bar (a cut, reframing, snap or event on the grid, eased into downbeats). Timing comes from `data/teeth/lyrics.json` (per-word `start`/`end`) and `data/teeth/audio.json` (beats, downbeats, bpm); never hard-code a time the data already holds, and check every scripted time against the data.
- **Block-in quality**: forms, light, composition, timing and motion are right and read at a glance; materials and fine detail may be rough. Nothing broken, placeholder-looking, flat or clip-art may show anywhere in the window. Final polish waits for gate 4.
- The rules that fail a still (above) hold for every frame. Run the frame checker on your window before reporting: `bun scripts/render.ts lint --song teeth --only <id> --from A --to B --url http://localhost:5193` and fix every error.
- **Your deliverable is a contact sheet**: `bun scripts/render.ts sheet --song teeth --only <id> --times <one per bar plus each money moment> --cols 4 --url http://localhost:5193 --out <absolute path>.png`, plus at most one short clip of the plate's hardest moment (≤4 s, `video --song teeth --only <id> --from A --to A+4 --fps 30 --noaudio --url http://localhost:5193 --out <absolute path>.mp4`). Look at the sheet yourself and fix what is obviously wrong once before reporting; the lead and a reviewer judge the sheet.
- **Economy**: budget about 15 renders in all (stills, sheets, one clip). Render only what you will look at. Keep your report short.
- Aim for ≤ 100 ms per frame at 1080p; report the figure.

## Your report (final message)

Files written; still paths; what at the still's moment is final and what elsewhere in the plate is stubbed; ms per frame at 1080p (from the render log, or `bun scripts/render.ts perf --song teeth --from A --to A+0.5 --only <id>`); known weaknesses, honestly; any engine or palette change you need.
