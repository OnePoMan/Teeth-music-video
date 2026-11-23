# The plate starter and the energy checks (builder brief, Sonnet 5.5 high)

`scale` (`8fd2354`) and `uv` (`65680b3`, round 2 in progress) each built the same lyric-led machinery from scratch: per-line camera plans, hero macros, graded hits, the probe feed, and a plate-only crop scan (`sc_limb`, `uv_occ`). A builder's first read of a large plate cost about 10% of the 5-hour window. This job lifts that machinery into shared helpers (R96) and adds the lint figures that make energy and value range measurable (R97), so the remaining 12 plates start from working parts.

**Rules:** R25, R29, R34-R40, R72, R79-R82, R92, R95-R97. Read section I of `docs/teeth2/RULES.md` first.

**Do:**
1. **`app/src/teeth2/plate-kit.ts`, a new file.** It must not change `scale` or `uv` behaviour; leave both plates on their own code. Port from them into plate-agnostic helpers:
   - **Line camera plans:** a per-line plan (framing family, orbit, elevation, lens, ride), with `fit` and `needD`-style solving that keeps a line's word boxes in title-safe at a given framing, and path building with no reversals (R35). The source is `uv.ts` (`PLANS`, `fit`, `needD`, `buildPath`, `levelRoll`). `scale.ts` `PLANS`/`lineCam`/`blendCam` is the curved-surface variant.
   - **The macro solver:** `MACROS`/`solveMacro`/`macroCam`/`camAt` from `uv.ts`, and the long-lens fallback in `scale.ts`'s `solveMacro`. Inputs: the hero box, the line-so-far boxes, the target ratio (R92 d: ≥1.2x) and the ease. It returns the camera and the ratio actually achieved.
   - **Hit tiers:** given `audio.json` (beats, downbeats, kick and snare onsets), the line and hero onsets, and the plate's chosen downbeats, it returns a graded hit list (tier, time, strength) that builds across a section and obeys R79's ceilings. It also offers a helper that varies the pattern so two repeats of a line differ (R38).
   - **The probe feed:** a thin wrapper over `kinRecord3D`/`kinRecordRect` for a word on a parametric surface (a plane, a sphere, a cylinder), tagged `hero` or `sup`.
   - **Crop scans:** the occlusion scan (stand-in capsules and boxes against each sung word's projected box, as in `uv.ts`'s `?uv_occ`) and the edge or limb scan (a per-glyph n·v test on curved surfaces, as in `scale.ts`'s `limb`). Each is enabled by one query flag and logs hits in a common format.
2. **Lint figures (R97)**, in `app/scripts/lint.ts` as additions:
   - **Per bar:**
     - the luma p1, p50 and p99, sampled from rendered frames;
     - the camera travel, from the probe's camera records: orbit degrees about the line's centre, and the screen travel of the line's centre;
     - the hit count by tier, through a new `kinHit(tier, t)` probe hook that plates call;
     - the motion energy, as the mean absolute frame difference.
   - Add a summary line per plate window, in the same style as "kit: presence X%".
3. **P(doom)'s band.** Measure the motion energy, the cut or reframe rate, and the value range per bar on P(doom)'s reference span: the clip `out/gate3/kinetic/ref/pd-strip.png` was made from. Find it in the repo or `out/`, or render it with the engine. Record the numbers and a suggested target band (between `scale` r5 and P(doom), R92 g) in `docs/teeth2/TYPE.md` §7, measured the same way on `scale` r5 and `uv`.
4. **A usage doc** at the top of `plate-kit.ts`: how a new plate wires its lines, macros, hits, probe and scans in about 40 lines. Use a flat-plane example.

**Checks:**
- Typecheck is clean, apart from the known `typesheet-*` errors.
- `scale` and `uv` lint and renders are byte-identical before and after. Diff one still from each and their lint JSON.
- Run the new lint figures over `scale` 48.73-62.54 and `uv` 62.54-76.35 and include them in the report.

**Setup:** `source out/env.sh`, then render from `app/` (R72). You work in the main checkout on `teeth-v2`, after the `uv` builder has finished; you are the only builder. Never edit `app/src/engine/`. Additions only in `kinetic.ts` and `lint.ts`. Don't commit. Python is not installed; use `bun -e`. If the 5-hour window passes ~70%, stop and report.

**Report** in ≤150 words: the API, the P(doom), `scale` and `uv` figures, the suggested band, and anything that wouldn't generalise. Add a code map (R91).
