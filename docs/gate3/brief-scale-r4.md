# `scale` round 4: whites and the flat openers (builder brief, Opus 5.5 high)

Round 3 (`8405c17`, clips `out/gate3/kinetic/r3/`) passed lint (0 errors, presence 100%) and the third blind review. The client asked for one more light fix. The reviewer named three defects, and this round fixes them and nothing else.

1. **Flat openers.** At TALK (52.26-53.03) and at LATE / LATE NIGHT (55.74-56.39), the frame is a small word on a large, even, mid-yellow face inside a spotlit oval. See `out/gate3/kinetic/r3/scale-dense.png`.
2. **No whites anywhere** (R13: every shot reaches film-black *and* lightbox). The window's peak is a mustard midtone.
3. **First letters fall into the dark** at the pool's edge: "ALK SO" and "OUR HEART" around 53.29-54.45. A word half in black reads as cropped (R29).

**Rules:** R13, R21-R22, R29, R31, R38, R41 (approved stills 48.75, 51.50, 55.00), R71, R72, R79-R82. Read the `scale` card in `docs/teeth2/PLATES.md`.

**Do:**
- **Give every shot a real white.** For example, a hot specular streak from the key on the skin, carved lips that catch near-lightbox highlights on the key side, or the flash frames peaking at lightbox. The apple stays dental-stone yellow; whites are highlights, not a lighter base colour.
- **Make the openers a composition, not a disc.** The face should run from a highlight on the key side to black on the far side within the frame, and the lone opener word should sit where the light shapes it. You may frame the opener word bigger or closer (R22 advises 8% cap height on a line's first frame).
- **Light the start of every row.** Aim the pool, or place the rows, so that no word has letters in black while its line is on screen.
- **Keep everything else:** lint 0 errors and 100% presence, the 11 graded flashes and their build, word spacing on onsets, the TEETH slam, the camera, the approved stills, and speed ≤200 ms per frame.

**Measure:** for each checkpoint still, report the luma p1, p50 and p99 of the frame. Targets: p1 ≤ 16, p99 ≥ 235, and no frame where 70% or more of the pixels sit inside one 40-step luma band.

**Code map** (r3, `app/src/teeth2/scenes/`):
- `scale.ts:85-101`: the tunables. `KEY [48,14,240]`, `AIM`, `STROBE [62,14]`, `POOL`, `FLASH_GAIN 3.2`, `FLASH_HL`, `FLASH_K`.
- `scale.ts:468-500`: the key direction, the pool aim and `keyRad`, inside `render`.
- `scale.ts:523`: `light(t)`, the burst and lamp levels.
- `scale.ts:78-82`: `PLANS` `daz`, the camera swing per line.
- `scale.ts:417`: the `wordPose` clamp.
- `scale.ts:627`: `kinProbe`, the type probe's call site. Keep it working.
- `scale-glsl.ts`: skin wrap 0.1, the uniforms `keyOut` and `keyFloor` (pool falloff), the word-floor shadow fill at 0.08, and cavity translucency at 0.05.
- Look-dev query overrides: `sc_key`, `sc_strobe`, `sc_pool`, `sc_ki`, `sc_fill`, `sc_aim`, `sc_daz<k>`, `sc_psi<k>`.

**Key-frame checkpoint first (R91).**
- Render stills at 52.30, 52.60, 52.90, 53.40, 54.10, 55.80, 56.05, 56.30, plus the approved 48.75 and 55.00.
- Render an 8 fps strip of 52.0-56.4 (`--n 36 --cols 9`).
- Write all of them to `out/gate3/kinetic/r4/checkpoint/`.
- Then **stop and report** (≤80 words, the luma table, the paths).

**Full pass, after the lead's go:**
- clips 48.73-55.5 and 55.0-62.54 at 1080p30 with audio;
- the 8 fps strip 52.0-56.0;
- the dense sheet 49.5-56.9 (`--n 30 --cols 6`);
- lint 48.73-62.54 to `out/lint/r4/`;

all to `out/gate3/kinetic/r4/`.

**Setup:** `source out/env.sh`, then render from `app/` (R72). You work in the main checkout, on branch `teeth-v2` at `eab344c` or later. Check that with `git log -1` before you start. You are the only builder.

**Files:** `scale*.ts` only. Don't commit.

**Report** in ≤150 words, plus a code map of the deltas and the files changed (R91).
