# The Teeth type probe: making the frame checker see Teeth's lyrics (builder brief, Sonnet 5.5 high)

**Why:** Teeth's lyrics are painted into canvases and textures, or baked into SDFs, through the kit `app/src/teeth2/kinetic.ts`. The frame checker (`app/scripts/lint.ts`) only sees `Word3D`/`drawPhrase` text, so it is blind to them. Lyric presence, word size and crops have been measured by eye, round after round, and round 1 of kinetic type failed on exactly that. Background: `docs/doc-review-2026-11-21.md`, sections C19 and P1.

**Rules:** `docs/teeth2/RULES.md` R19 (timing), R21 (hero scale), R22 (5% floor), R18 (title-safe), R29 (no mid-word crop), R31-R33 (presence and gaps), R75 (set pieces), R89 (the false hits this replaces), and R72 (environment, files).

**Build:**
1. **Record in `kinetic.ts` (additions only, R72).** Every word a plate draws through the kit (`drawKin`, `packKin`/`glslKinSDF`, `pressureRows`/`drawPressure`, and any other entry point) reports, per frame:
   - the word's text and its line index from `lyrics.json`;
   - its role (hero, supporting or pressure copy);
   - its **on-screen box in output pixels**;
   - whether it is lit (sung or unsung) and its glyph range.

   For 2D layers the box is the canvas box mapped to the frame. For type on a 3D surface the plate must project it: add one small hook a plate calls with its camera and the surface mapping (UV to world), and show the pattern working in `scale` (`app/src/teeth2/scenes/scale*.ts`). Use the minimum touch in `scale`, and don't change its look.
2. **Check in `lint.ts`,** in Teeth mode only, using those records. Each failure is reported with its time:
   - **PRESENCE:** a sung frame inside a line's span, or inside an R32 hold, with no word of the current line on screen.
   - **SMALL:** a supporting word under a 5% cap height.
   - **HERO:** a hero under R21 at its peak.
   - **SAFE:** outside title-safe, 96 px.
   - **EARLY:** lit more than 0.4 s before its start.
   - **CROP:** a word's box cut by the frame edge while its line is on screen.
   - **LINGER:** retire this check for Teeth.

   Add a summary line: presence % of sung frames.
3. **Run it** on `scale` 48.73-62.54 and report the numbers. Run it on one plate that doesn't call the kit yet (for example `chart`) and report what it shows: it should say "no kit records", not pass silently.
4. **Update the kit's top comment** so the hook plan points to `docs/teeth2/TYPE.md` section 8 (that comment is superseded), and document the probe hook for plate builders in a few lines.

**Setup:** `source out/env.sh`. Lint from `app/`: `bun scripts/render.ts lint --song teeth --only scale --from 48.73 --to 62.54 --url http://localhost:5193 --out <abs path>.json`. Typecheck: `bun x tsc --noEmit -p tsconfig.json`.

**Files:** `kinetic.ts` (additions only), `app/scripts/lint.ts`, `app/scripts/render.ts` (only if lint needs a new argument), and the minimum in `scale*.ts`. Don't touch other plates. Don't commit.

**Note:** another builder is working on `scale` at the same time, on lighting and flashes. Keep your `scale` change to one small, separate call site, and say exactly where it is so the lead can merge.

**Report** in ≤150 words, plus a code map of 10-15 lines (R91): the API, the `scale` numbers, the known limits.
