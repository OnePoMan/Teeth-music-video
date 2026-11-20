# Kinetic type: the shared kit and three prototypes (builder briefs)

The client changed the lyric direction on 2026-11-20. The words become motion-graphics type at P(doom)'s level. The binding rules are the "Kinetic type" section of `docs/TEETH2.md`: read it first, and read it closely. For the bar, read P(doom)'s own treatment, `docs/TREATMENT.md`, and its typography and plate sections: the hook slams, UPPING rising, FOOM shattering, typographic pressure, ASKEW leaning. Its scene code lives in `app/src/scenes/`: reuse its tricks, above all `hook.ts` (the escalating slam), `dense-press.ts` (typographic pressure), `dense-askew.ts` (lean per beat) and `fuse.ts`, and the engine's text helpers in `app/src/engine/`.

**Read first (all builders):**
- `docs/TEETH2-BUILDERS.md` (the gate 3 standard section).
- `docs/TEETH2.md`: Typography, Karaoke rules, Kinetic type, and your plate's paragraph.
- The "Gate 3" section of `docs/TEETH2-LEDGER.md`.

**Setup:** source `"C:/Users/ethan/OneDrive/Documents/Claude Projects/Teeth/repo/out/env.sh"` for bun and ffmpeg (no python).

**Rules:**
- Don't commit.
- Touch only the files named in your section.
- The shared glove (`GLSL_HAND`) and the kit (`teeth.ts`, `palette.ts`, `monogram.ts`) are read-only.
- The scene, its camera and its timing stay. **Only the lyric layer changes**, and the scene may react to it: a frame shake on a stamp, a cut taking a slam with it.

**Deliverable for the client** (these clips are what the client judges):
- Up to three clips per plate, 4–6 s each, at 1080p30 **with audio**: `video --song teeth --only <id> --from A --to B --fps 30 --url http://localhost:5193 --out <abs>.mp4`.
- Plus a contact sheet.
- Lint with 0 errors; speed ≤100 ms/frame, or no slower than the plate already was.

---

## Builder A (Opus 5.5, high): the kit and `scale`

1. **`app/src/teeth2/kinetic.ts`** (plus a GLSL helper file if needed): one small API that every plate can use, in 2D (a canvas texture laid on a surface, or a full-frame layer) and in 3D (a texture mapped onto the plate's object).
   - It covers the whole vocabulary: spring, stretch and condense on Archivo's axes, track, stamp, slide and lean, pressure, break along a motif mask the plate supplies, and exit.
   - It reads timing from the lyric and audio data (words, beats, kick and snare onsets).
   - It renders type with the existing font loading and kerning. Find how the typesheet board and current plates set Archivo.
   - Comment the API at the top of the file so the next builders can use it in minutes.
2. **`scale` (48.73–62.54) rebuilt on the kit.** Chorus energy, maximal:
   - The bitten words spring and stretch into the apple's skin.
   - Heroes stamp.
   - Up to two heroes may break out as full-frame slams, cutting back to the apple on the next flash.
   - TEETH (≈55.0) is the first statement of the **TEETH hook slam**; later choruses escalate it. Design it so it can escalate: write the plan for its later returns as a comment in `kinetic.ts`.
   - Keep the approved still at 55.00 recognisable: the hero TEETH bitten in the apple, before or after its slam.
3. **Clips:** 50.0–55.5 and 55.0–61.0 (plus one more of your choice), to `out/gate3/kinetic/scale-*.mp4`. Sheet to `out/gate3/kinetic/scale-sheet.png`.

Report in ≤200 words: the kit's API in 5 lines, what `scale` now does, the clip paths, ms/frame, and anything the next builders must know.

## Builder B (Sonnet 5.5, high): `voice` on the kit (after A)

`voice` (90.16–103.98), pre-chorus 2, rising energy:
- The transcript lane's words spring and track.
- Pressure builds bar by bar toward ALIVE: copies of the line condense and pack the monitor on the kicks.
- The razor cut breaks LIE along its 45° diagonal.
- ALIVE slams full-frame into the 103.98 match cut.

Files: `voice*.ts` only. Clips: 93.0–98.5 and 98.5–104.0 to `out/gate3/kinetic/voice-*.mp4`. Report in ≤150 words.

## Builder C (Opus 5.5, high): `lightbox` on the kit (after A, beside B)

`lightbox` (7.23–21.10), verse 1, low energy:
- The words become **part of the film**: grease-pencil marks, or lettering that shows only where the backlight passes through, never white captions floating over it.
- They spring, track and slide.
- Only each line's hero stamps: KNOW, BURNING, AWAY, STAY.
- COLD condenses as the tube dims.

Files: `lightbox*.ts` only. Clips: 8.0–13.5 and 15.0–21.0 to `out/gate3/kinetic/lightbox-*.mp4`. Report in ≤150 words.
