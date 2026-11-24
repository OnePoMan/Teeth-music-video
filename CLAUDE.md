# Teeth v2: notes for Claude sessions

Start with `docs/teeth2/HANDOFF.md` (the current state and next actions), then `docs/teeth2/RULES.md` (the 40 build rules), `docs/teeth2/PROCESS.md` (gates, staffing, deliverables) and the plate's card in `docs/teeth2/PLATES.md`. History is in `docs/TEETH2-LEDGER.md`. Work on branch `teeth-v2`. To resume, the client usually says "Continue Teeth v2 from the handoff".

## Working preferences (the client's standing instructions)

- **Never run into the 5-hour usage limit.** Check usage before heavy or parallel work (builders, reviews, renders) and between rounds. Above ~70% of the 5-hour window, start no new agents: checkpoint (commit), and tell the client when the window resets. Run one or two agents at a time. Prefer fresh agents with short briefs over resuming agents with long histories. Commit before heavy runs. When a task won't fit in the remaining window, say so up front.
- **The weekly limit is not a reason to pause Teeth.** The client has banked resets. Report weekly usage, but don't offer "wait for the weekly reset" as an option.
- **After each approved gate:** update HANDOFF, commit, push, open the gate's PR, and remind the client to start a new session.
- **No Fable model.** Staffing is R91 in `PROCESS.md`: the lead on Opus; Opus high for 3D and light builds, Sonnet high for graphic plates.
- **Ask before a plate round** when rules or briefs have just changed. Taste questions go to the client up front, in batches (R93), and the client approves the 540p checkpoint before any full pass (R94).
- Keep the client's personal details out of anything sent to outside services.

## Running in a cloud session (Linux)

- **Tools:** [bun](https://bun.sh), Google Chrome or Chromium (the renderer drives it headless through playwright-core) and ffmpeg with libx264. Then `cd app && bun install`. `out/env.sh` (R72) exists only on the Windows laptop; on Linux, just have the tools on PATH.
- **The song isn't in git.** `audio/teeth.mp3` is a commercial recording and this repo is public, so it is ignored and must never be committed. Ask the client to upload it into the session, and place it at `audio/teeth.mp3`. Renders without it have no audio and may fail the timing checks.
- **No GPU, probably.** The engine renders WebGL in headless Chrome. Without a GPU, Chrome falls back to software rendering, which is far slower. Measure ms per frame on one still before planning, then scope runs to stills, lint and short low-res clips. A 1080p full pass may need the laptop.
- **Renders aren't in git.** `out/` (about 3.4 GB of clips, stills, lint JSON) is ignored. So are the blind-review folders `../blind-*` outside the repo. Re-render what you need from the commits cited in HANDOFF.
- **Reference images in git:** `docs/teeth2/media/` holds JPG copies of the P(doom) reference strip (used by the R83 blind reviews) and the latest contact sheets and strips. There are no clips, since the clips carry the song.
- **Commands** (from `app/`): `bun scripts/render.ts lint --song teeth --only <plate> --from <s> --to <s> --url http://localhost:5193 --out <abs>.json`; stills, strips and clips use the same script (see its modes). Typecheck with `bun x tsc --noEmit -p tsconfig.json`; the errors in `typesheet-p2.ts` and `typesheet-swatch.ts` are pre-existing.
