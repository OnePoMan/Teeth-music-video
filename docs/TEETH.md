# Teeth — treatment & style bible

A generative, code-rendered music video for "Teeth" (5 Seconds of Summer) with word-synced karaoke typography. It runs on the same engine as the P(doom) video (`docs/ENGINE.md`): every frame is a pure function of song time, the lyric is aligned per word, and cuts and hits sit on the analysed beat grid (139.0 BPM, constant).

## The idea in one paragraph

**Love leaves marks.** Every plate is a surface that something presses into: teeth into type, a body into a bedsheet, ink into a folded card, blood into a shirt, hands onto the frame. Running through the whole video is **the bite**: a red zigzag seam across the frame, two interlocking rows of teeth. Closed, it is a hairline crack; open, it is a glowing mouth. The lyric is what gets bitten: in the choruses every word is snapped shut between the jaws exactly when it is sung. The verses are quiet, cold and tactile (embers, sheets, a ring); the pre-choruses are Rorschach cards read by a deadpan clinician; the bridge bleeds into a white shirt; the outro swallows the camera.

## Song map (from `data/teeth/audio.json`, `data/teeth/lyrics.json`)

| section | time | music | plate |
|---|---|---|---|
| intro | 0 – 7.2 | distorted bass riff alone | `seam` |
| verse 1a | 7.2 – 21.1 | voice + bass, no drums | `ember` |
| verse 1b | 21.1 – 34.5 | voice + bass | `sheets` |
| pre 1 | 34.5 – 48.7 | synths enter, no drums | `rorschach` (cards I–IV) |
| chorus 1 | 48.7 – 76.4 | stomp: kick + clap on every beat | `jaw` n=1 |
| verse 2 | 76.4 – 90.2 | drums continue, lighter | `ring` |
| pre 2 | 90.2 – 104.0 | drums out | `rorschach` (cards V–VIII) |
| chorus 2 | 104.0 – 131.6 | stomp | `jaw` n=2 |
| bridge + chorus 3a | 131.6 – 159.2 | no drums; the chorus returns stripped | `shirt` |
| chorus 3b | 159.2 – 174.8 | drums back, everything | `jaw` n=3 |
| outro | 174.8 – 205.0 | three "Teeth" shouts, last line, 8 bars of riff, hard stop at 200.7 | `throat` |

The chorus is sung on a fixed grid, one word per beat: "Fight(1) so(2) dirty(3) but(4) your(4.5) love's(5) so(6) sweet(6.75)", 8 beats per line, 4 lines per half. The alignment enforces that template across all six repeats (see `analysis/teeth/align.py`).

## Palette (`app/src/teeth/palette.ts`)

- **ink** `#09080A` background, **ink2** `#151214`, **graphite** `#5A5352`, **ash** `#9A918C`.
- **enamel** `#F0EBE1`: type, paper, teeth. Never blooms.
- **red** `#FF1B2D`: the bite, the sung word, blood. The only colour that glows.
- **wine** `#7A0A17`: dried blood, shadows of red.
- **rose** `#FF8FA8`: the rare tender accent, owned by "sweet", "pretty", the butterflies and the rose.
- Light plates (cards, sheets, the shirt) invert to enamel paper with ink, which gives the edit a light/dark rhythm. Red stays red on both.

## Typography

- **Archivo** (width 62–125, weight 300–900): the voice. Thin and wide in the cold verses, black and condensed when bitten.
- **Cormorant Garamond italic**: the tender register ("sweet", "pretty", "rose", "wife").
- **IBM Plex Mono**: the clinician: card numbers, scoring codes, timestamps, footnotes.
- Karaoke: a word appears or lights exactly at its `start` and completes by its `end`; unsung words wait dim at most a line ahead. Every proportional run is kerned (`layout()` / `glyphX()`).

## Plates

### `seam` — intro
Black. On the riff's first note a red hairline cuts the frame: the closed bite. The bass envelope opens it like breath, each note a gasp of red light between interlocking teeth. In the last bar TEETH is set across the seam, its letters split along the zigzag; the jaw yawns open and snaps shut on the first sung word.

### `ember` — "Some days you're the only thing I know"
Cold, still, nearly black. The lines are set wide and thin in Archivo 300, frosted; each word thaws to red heat as it is sung and cools to wine. "burning" catches fire (a shader flame fed by the glyphs). "nights grow cold": rime crystals branch across the frame and over "cold". "Can't look away": the camera tries to pan off and is yanked back by a spring, twice. "Beg you to stay": the words are dragged toward the edge and stretch (width axis) rather than let go.

### `sheets` — "Sometimes you're a stranger in my bed"
A white sheet under a raking light, rendered as a height field. Words rise from under the cloth as they are sung (relief, soft shadows), "stranger" the biggest shape in the bed. "or you want me dead": the light drops, the relief flattens. "Push me away": the sheet is shoved, a fold travelling across it on each push. "beg me to stay": tension wrinkles radiate from the word that holds on.

### `rorschach` ×2 — "Call me in the morning to apologize"
Enamel cards, one per line, ink pressed out from the centre fold in black and red. The blot resolves into the line: a moth for the morning call, butterflies whose wings are the card folding on the beat, a mask whose eye holes we fall through, a jaw for "make it out alive" whose seam becomes the chorus' bite. A clinician's scoring runs in the margin in mono (`CARD III · RESPONSE: “a mask” · W F C' (Hd) · subject did not look away`). Pre 2 repeats the test on cards V–VIII, wetter and redder.

### `jaw` ×3 — the chorus
The frame is a mouth. Each word is set full-frame and bitten into place on its beat: the jaws part over the preceding eighth, the throat glows, they snap shut as the word is sung (shake, a red crack left across the letters). Each line has its own idiom: "dirty" is ink-grimed and splattered; "love's so sweet" switches to rose Cormorant and drips; "pretty" is glossy serif; "heart got teeth" is a heart whose cleft opens into a bite; "Late night devil" turns the field red; "put your hands on me" slaps handprints on the frame, one per word; "never, never, never" stacks; on "let go" the jaw clamps and will not let go, shaking the held word. The second half of each chorus answers the first (inverted to paper, reframed). n=2 adds more paper and blood; n=3 is the maximal version that strobes between all of them.

### `ring` — "Some days you're the best thing in my life"
A ring drawn in hairlines turns in the dark, the line written around its band. "I see my wife": the ring faces us, WIFE engraved inside. "Then you turn into somebody I don't know": the ring turns edge-on and back, and its inner face has grown teeth. "push me away": each push shoves it deeper into the dark.

### `shirt` — bridge + stripped chorus
A white shirt (woven enamel, a placket and buttons). "Blood on my shirt": red stains bloom through the weave. "rose in my hand": a mathematical rose (rhodonea curves) drawn by a pen. "like you don't know who I am": the words lose focus. "heart in my hand / Still beating": the rose's petals fold into a heart that beats on the grid with no drums under it. The stripped chorus is sung softly around the beating heart; on "heart got teeth" its cleft opens; handprints are left in blood on the shirt.

### `throat` — outro
Three shouts of TEETH, each a different bite (enamel on ink, ink on red, red on enamel). "Never, never, never ever let go": the last clamp. Then eight bars of riff: the camera is swallowed down a throat of concentric tooth rings that bite on every snare. At the hard stop (200.7 s) everything cuts to black but the red seam, which closes to a hairline and goes out.
