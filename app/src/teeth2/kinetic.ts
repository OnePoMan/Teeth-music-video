// KINETIC TYPE KIT (Teeth v2, docs/TEETH2.md "Kinetic type"). One small, pure-function API for motion-graphics
// lyrics in every plate: words keep living in their plate's world (bitten, engraved, printed...) but MOVE like motion
// graphics on that surface, and heroes may break out as full-frame slams. Everything is a function of song time.
//
// ---------------------------------------------------------------------------------------------- QUICK START
//   import { KinClock, KinWord, drawKin, kinShake } from '../kinetic';
//   const clk = new KinClock(ctx.audio, { backbeat: true });        // beats, kicks, snares, cumulative beat steps
//   const kw = new KinWord('TEETH', { size: 600, width: 62, weight: 900 }); // kerned Archivo rest layout (engine type.ts)
//   const P = kw.pose(t, clk, {                                      // per-glyph pose at song time t
//     t0: word.start,                       // lights here (letters spring `lead` = 45 ms ahead; never > 0.4 s)
//     spring: {}, stamp: { over: 1.3 },     // per-glyph arrival with overshoot; lands oversized and settles
//     stretch: { kick: 0.12, snare: 0.1 },  // width axis: wider on kicks, condensed on snares
//     weight: { from: 300 },                // light -> heavy snap on the onset
//     track: { amt: 0.08 }, lean: { perBeat: 0.05 }, slide: { perBeat: [12, 0] },
//     exit: { at: clk.leave(line.end), kind: 'collapse' },          // leaves with a move on the next beat
//   });
//   drawKin(c, kw, P, x, baseline, { fill: trgba('lightbox') });   // 2D: a full-frame Layer2D, or any canvas whose
//   o.shake = kinShake(t, P.shake * 14);                             //     texture is mapped onto a 3D object
//
// ---------------------------------------------------------------------------------------------- THE VOCABULARY
//   spring   letters arrive per glyph (stagger 15-25 ms), rising with overshoot and settling      Moves.spring
//   stretch  Archivo width axis (62-125): + on kicks, - on snares; weight axis (300-900) snaps      Moves.stretch/.weight
//   track    letter-spacing opens on each beat and closes                                          Moves.track
//   stamp    the word lands oversized and settles; P.shake is a decaying pulse for a frame shake   Moves.stamp (at: re-stamps)
//   slide    cumulative drift, one eased step per beat                                              Moves.slide
//   lean     cumulative lean, one eased step per beat, fanning across the word (P(doom)'s ASKEW)     Moves.lean
//   pressure copies condense and pack a box on successive kicks                                    pressureRows/drawPressure
//   break    the glyphs split along a plate-supplied mask (bite scallops, the razor's diagonal...)  drawKin(..., {brk})
//   exit     collapse | slide | drop | wipe on the beat after the line ends (never a fade or a pop) Moves.exit
//
// ---------------------------------------------------------------------------------------------- 2D AND 3D
//  * 2D / full frame: draw into a Layer2D (engine/gl.ts) and composite it (ctx.comp.draw ... 'replace' or 'normal').
//  * Texture on a 3D object: a Layer2D(w, h) of any size is a THREE.CanvasTexture: draw the kinetic word into it each
//    frame, `upload()`, and sample it in the object's shader.
//  * Words baked as an SDF on a surface (scale's bitten letters): build the word with KinWord.fromCells (rest glyph
//    centres in surface units), pose it as above, `packKin()` the poses into vec4 uniforms and sample the baked SDF
//    through `glslKinSDF()`: each glyph is moved, scaled, rotated and faded on the surface without re-baking.
//  Units are whatever the word was built in (px for a layer, mm on a surface). Pose y is DOWN (canvas); packKin flips
//  it for y-up surfaces.
//
// ---------------------------------------------------------------------------------------------- LYRIC-LED CAMERA
// docs/TEETH2.md "Lyric-led camera" (binding): the line is the subject of its shot and the camera follows the words,
// ONE continuous move per line (no cuts or reframes inside it), easing into the beats; the beat is an impact inside
// the shot (flash, nudge, stamp), never a new shot. The kit's helper for it:
//   const path = LyricPath.fromWords(line.words, (w, i) => [sAlong(w), dist(i)], { clk, lead: 0.06 }, [startKey, holdKey]);
//   const [s, d] = path.at(t);   // where the camera looks along the line, and how far it stands, at song time t
//   const cam = new LyricCam([{ t, target: [x, y, z], pos: [x, y, z], roll, fov }, ...], { clk }); cam.at(t)
// * Keys are the words' positions at their onsets (any numbers: an arc length along a band, a world point, a distance,
//   an angle), shifted `lead` s earlier so the camera is on the word as it lands.
// * Between keys: a monotone cubic per component (Fritsch-Carlson): it never overshoots a key, so a component whose
//   keys move one way moves one way (no direction reversals, no snapping between framings).
// * The time is warped so the move eases INTO each beat (`settle`, the pace dips on the beat) and further into each
//   downbeat (`down`), with a continuous velocity: the move breathes with the stomp but never stops or jerks. Beats stay
//   on their beats (the warp is the identity at every beat), so a key on a beat is met exactly then.
// * Before the first key and after the last the path holds. Give each line its own path; cut only between lines.
//
// ---------------------------------------------------------------------------------------------- THE TEETH HOOK
// SUPERSEDED here: the hook plan (TEETH as one recurring full-frame slam that escalates on each return, plate by plate)
// lives in docs/teeth2/TYPE.md section 8, with the 2026-11-21 lead call applied. A slam is flat palette fills in
// Archivo 900, no outlines or halos, taking the plate's grain and motion blur and no halation (R24).
//
// ---------------------------------------------------------------------------------------------- THE TYPE PROBE
// (for plate builders) The frame checker (app/scripts/lint.ts, Teeth mode) cannot see type painted into canvases or baked
// into SDFs, so the kit REPORTS what it draws. It is off in a normal render (one global check); lint switches it on.
// Per word and frame the kit records {text, role, lyric onset (+ line/k when known), box in OUTPUT px, cap height px,
// alpha, glyph range, lit, scene}. How a plate feeds it:
//  * drawKin(c, kw, P, x, base, { fill, tag })      2D: recorded automatically. tag = { start: word.start, role: 'hero' | 'sup' }
//    (start is how lint finds the word's line in lyrics.json; line/k may be given instead). The canvas must be a
//    full-frame Layer2D (16:9, 1920 x k px), or register a map first: kinMapCanvas(canvas, (x, y) => [X, Y] | null).
//    Any other canvas is recorded as UNMAPPED: lint counts it and checks nothing.
//  * drawPressure(c, text, rows, x0, tones, { start })   one record per copy (role 'pressure').
//  * Type on a 3D surface (scale's SDF letters): once per word, after the camera is set,
//      if (kinProbeOn()) kinRecord3D(kw, P, cap, restCy, (s, h) => [x, y, z, nx, ny, nz], kinCam(pos, fwd, right, up, tanH), { start, role });
//    `surf` maps surface units (s along the line, h up, as packKin takes them) to a world point (normal optional: a
//    point facing away from the camera counts as hidden). See scale.ts kinProbe().
//  * Own sprite drawing (no drawKin, e.g. lightbox)? call kinRecord2D(c, kw, P, x, base, tag) after drawing.
// Records are made only while drawing: a plate that caches a canvas and skips drawing leaves no record on those frames.
// The checks (PRESENCE, SMALL, HERO, SAFE, EARLY, CROP) and their numbers are in lint.ts; rules R18-R22, R29, R31-R33.
import { F, font, measure, layout, ARCHIVO_WIDTHS, ARCHIVO_WEIGHTS } from '../engine/type';
import type { AudioData } from '../engine/audio';
import { clamp, ease, lerp, noise1, pulse, springStep } from '../engine/util';

// ================================================================================================== timing
export interface ClockOpts {
  /** Read kicks on beats 1 and 3 of each bar and snares on 2 and 4 from the beat grid (for a stomp where the onset
   *  detector hits both on every beat, as in the choruses). Default: the analysed onsets in audio.json. */
  backbeat?: boolean;
  /** Half-life (s) of the kick/snare pulses. */
  hl?: number;
}

/** Song timing for the kit: beats, kick and snare pulses, cumulative per-beat steps, line exits. */
export class KinClock {
  private bar0 = 0;
  constructor(public audio: AudioData, public o: ClockOpts = {}) {
    // index (mod 4) of the beat that falls on the first downbeat, for the backbeat parity
    const d0 = audio.downbeats[0] ?? 0;
    this.bar0 = Math.round(audio.beatAt(d0));
  }
  beat(t: number) { return this.audio.beatAt(t); }
  beatTime(i: number) { return this.audio.timeOfBeat(i); }
  /** The last beat at or before t (s). */
  lastBeat(t: number) { return this.beatTime(Math.floor(this.beat(t) + 1e-4)); }
  /** The first beat strictly after t (s). */
  nextBeat(t: number) { return this.beatTime(Math.floor(this.beat(t) + 1e-4) + 1); }
  /** When a line (or word) ending at `end` leaves: the next beat at least `gap` after it. */
  leave(end: number, gap = 0.05) { return this.nextBeat(end + gap - 1e-3); }
  /** Position of beat i in its bar (0..3). */
  inBar(i: number) { return (((Math.round(i) - this.bar0) % 4) + 4) % 4; }
  private grid(t: number, odd: boolean, hl: number) {
    const i = Math.floor(this.beat(t) + 1e-4);
    let v = 0;
    for (let k = i; k >= i - 1; k--) if ((this.inBar(k) % 2 === 1) === odd) v = Math.max(v, pulse(t, this.beatTime(k), hl));
    return v;
  }
  /** Kick pulse at t: 1 on the hit, decaying. */
  kick(t: number) { const hl = this.o.hl ?? 0.09; return this.o.backbeat ? this.grid(t, false, hl) : this.audio.hit('kick', t, hl); }
  /** Snare pulse at t: 1 on the hit, decaying. */
  snare(t: number) { const hl = this.o.hl ?? 0.09; return this.o.backbeat ? this.grid(t, true, hl) : this.audio.hit('snare', t, hl); }
  /** Beat pulse at t (every beat). */
  onBeat(t: number, hl = 0.09) { return pulse(t, this.lastBeat(t), hl); }
  /** Kicks in (t0, t] (pressure counts these). */
  kicks(t0: number, t: number) {
    if (t <= t0) return 0;
    if (this.o.backbeat) {
      let n = 0;
      for (let i = Math.floor(this.beat(t0) + 1e-4) + 1; this.beatTime(i) <= t; i++) if (this.inBar(i) % 2 === 0) n++;
      return n;
    }
    return this.audio.events('kick', t0 + 1e-4, t + 1e-4).length;
  }
  /** Time of the last kick at or before t. */
  lastKick(t: number) {
    if (this.o.backbeat) {
      let i = Math.floor(this.beat(t) + 1e-4);
      while (this.inBar(i) % 2 !== 0) i--;
      return this.beatTime(i);
    }
    const ev = this.audio.events('kick', t - 4, t + 1e-4);
    return ev.length ? ev[ev.length - 1]![0] : -1e9;
  }
  /** A staircase: +1 per beat after t0, each step eased over `dur` s (cumulative lean, slide, pressure). */
  steps(t0: number, t: number, dur = 0.12) {
    if (t <= t0) return 0;
    let s = 0;
    for (let i = Math.floor(this.beat(t0) + 1e-4) + 1; ; i++) {
      const b = this.beatTime(i);
      if (b > t) break;
      s += ease.outCubic(clamp((t - b) / dur));
    }
    return s;
  }
}

// ================================================================================================== fonts
export interface KinStyle {
  /** Em size in the word's units (px on a layer, mm on a surface). */
  size: number;
  /** Archivo width axis (62-125) and weight (300-900) at rest. */
  width?: number;
  weight?: number;
  /** 'serif': Cormorant italic (the tender register, wax pink); its width moves by horizontal scale only. */
  family?: 'archivo' | 'serif';
  /** Extra letter spacing at rest (units). */
  track?: number;
}

/** Archivo comes as static instances: the instance nearest a continuous (width, weight). */
export function archivoAt(width: number, weight: number) {
  return F.archivo(clamp(width, 62, 125), clamp(weight, 300, 900));
}
const WIDTHS = (ARCHIVO_WIDTHS as readonly number[]).map((w) => w / 10);
void ARCHIVO_WEIGHTS;

/** One glyph at rest: its character, its centre along the line, its advance. */
export interface KinGlyph { ch: string; cx: number; adv: number }

/** One glyph's pose at a moment. */
export interface GlyphPose {
  /** Centre along the line and offset from the baseline (y DOWN), in the word's units, relative to the word's origin. */
  cx: number; y: number;
  /** Scale (sx includes the width axis), rotation (rad, clockwise on screen). */
  sx: number; sy: number; rot: number;
  /** Presence: 0 = not (yet / any more) there, 1 = settled; overshoots above 1 while springing in (3D: bite depth). */
  on: number;
  /** Continuous axes (for drawing: archivoAt picks the instance, sx carries the rest). */
  width: number; weight: number;
}
export interface KinPose { glyphs: GlyphPose[]; /** stamp's decaying pulse 0..1 (scale it to px for PostOverrides.shake) */ shake: number; /** the word's overall scale */ scale: number }

export interface Moves {
  /** The word's sung onset (lyrics `start`). It is lit here; letters start springing `lead` before it. */
  t0: number;
  /** Letters lead the onset by this much (s). Default 0.045; the kit clamps it to 0.4 (karaoke rule). */
  lead?: number;
  /** Per-glyph arrival. stagger 15-25 ms, a damped spring (freq Hz, damp), rising `rise` em from below. false: none. */
  spring?: { stagger?: number; freq?: number; damp?: number; rise?: number } | false;
  /** Lands `over` times oversized and settles; `at` (default t0) may list re-stamps (never, never, never). */
  stamp?: { at?: number | number[]; over?: number; freq?: number; damp?: number };
  /** Width axis: +kick on kicks, -snare on snares (fractions of the width). */
  stretch?: { kick?: number; snare?: number };
  /** Weight axis: from `from` to `to` (default the style's) on the onset over `dur` s (the light -> heavy snap). */
  weight?: { from?: number; to?: number; dur?: number };
  /** Letter-spacing opens by amt em on each beat and closes (half-life hl). */
  track?: { amt?: number; hl?: number };
  /** Cumulative lean (rad per beat, capped at max), fanning across the word from 0.4x to 1.6x (fan = 0: uniform). */
  lean?: { perBeat?: number; max?: number; fan?: number; from?: number };
  /** Cumulative drift (units per beat, [x, y down]). */
  slide?: { perBeat?: [number, number]; from?: number };
  /** The exit, starting at `at`: collapse (squashed onto the baseline, staggered), slide (accelerates off along x by
   *  dir), drop (falls), wipe (letters go one by one). dur default 0.16 s. */
  exit?: { at: number; kind?: 'collapse' | 'slide' | 'drop' | 'wipe'; dur?: number; dir?: number };
  /** Anchor of stretch/stamp/track: the word's centre (default) or its left edge. */
  anchor?: 'center' | 'left';
}

/**
 * A word set for kinetic type: its kerned rest layout and its poses over time. Build it once (init), pose it per frame.
 */
export class KinWord {
  glyphs: KinGlyph[] = [];
  width = 0;
  style: Required<KinStyle>;
  /** Word advance at each Archivo width instance (for the width axis); null for words built from cells. */
  private advAt: number[] | null = null;
  constructor(public text: string, style: KinStyle, glyphs?: KinGlyph[]) {
    this.style = { width: 100, weight: 900, family: 'archivo', track: 0, ...style };
    const s = this.style;
    if (glyphs) {
      this.glyphs = glyphs;
      const g0 = glyphs[0], g1 = glyphs[glyphs.length - 1];
      this.width = g0 && g1 ? g1.cx + g1.adv / 2 - (g0.cx - g0.adv / 2) : 0;
      return;
    }
    const fam = this.family(s.width, s.weight);
    const lay = layout(text, fam, s.size, s.track);
    this.glyphs = lay.glyphs.map((g) => ({ ch: g.ch, cx: g.x + g.w / 2, adv: g.w }));
    this.width = lay.width;
    if (s.family === 'archivo') this.advAt = WIDTHS.map((w) => measure(text, archivoAt(w, s.weight), s.size, s.track));
  }
  /** A word whose glyphs are already placed (e.g. baked into an SDF on a surface): rest centres and advances. */
  static fromCells(text: string, size: number, cells: { cx: number; adv: number }[], style: Partial<KinStyle> = {}) {
    const chars = Array.from(text);
    return new KinWord(text, { size, ...style }, cells.map((c, i) => ({ ch: chars[i] ?? '', cx: c.cx, adv: c.adv })));
  }
  /** The font family for drawing at a continuous width/weight. */
  family(width: number, weight: number) {
    return this.style.family === 'serif' ? F.serif(600, true) : archivoAt(width, weight);
  }
  /** Word advance ratio at a continuous width vs. the rest width (interpolated between the static instances). */
  widthRatio(width: number) {
    const a = this.advAt;
    if (!a) return width / this.style.width;
    const at = (w: number) => {
      w = clamp(w, WIDTHS[0]!, WIDTHS[WIDTHS.length - 1]!);
      let i = 0;
      while (i < WIDTHS.length - 2 && w > WIDTHS[i + 1]!) i++;
      return lerp(a[i]!, a[i + 1]!, (w - WIDTHS[i]!) / (WIDTHS[i + 1]! - WIDTHS[i]!));
    };
    return at(width) / Math.max(1e-6, at(this.style.width));
  }

  /** Every glyph's pose at song time t. Pure: the same (t, moves) always gives the same pose. */
  pose(t: number, clk: KinClock, m: Moves): KinPose {
    const s = this.style, n = this.glyphs.length, size = s.size;
    const lead = Math.min(0.4, m.lead ?? 0.045);
    const left = this.glyphs[0] ? this.glyphs[0].cx - this.glyphs[0].adv / 2 : 0;
    const ax = m.anchor === 'left' ? left : left + this.width / 2;
    // width axis
    let width = s.width;
    if (m.stretch) width *= 1 + (m.stretch.kick ?? 0.1) * clk.kick(t) - (m.stretch.snare ?? 0.1) * clk.snare(t);
    width = s.family === 'archivo' ? clamp(width, 62, 125) : width;
    const wr = this.widthRatio(width);
    // weight axis
    let weight = s.weight;
    if (m.weight) {
      const from = m.weight.from ?? 300, to = m.weight.to ?? s.weight;
      weight = t < m.t0 ? from : lerp(from, to, ease.outCubic(clamp((t - m.t0) / (m.weight.dur ?? 0.04))));
    }
    // stamp
    let S = 1, shake = 0;
    if (m.stamp) {
      const ats = Array.isArray(m.stamp.at) ? m.stamp.at : [m.stamp.at ?? m.t0];
      let at = -Infinity;
      for (const x of ats) if (x <= t + 1e-6 && x > at) at = x;
      if (at > -Infinity) {
        const over = m.stamp.over ?? 1.3;
        S = over + (1 - over) * springStep(t - at, m.stamp.freq ?? 5, m.stamp.damp ?? 0.5);
        shake = pulse(t, at, 0.05);
      }
    }
    // track, lean, slide
    const tr = m.track ? (m.track.amt ?? 0.06) * size * clk.onBeat(t, m.track.hl ?? 0.09) : 0;
    const leanSteps = m.lean ? clk.steps(m.lean.from ?? m.t0, t) : 0;
    const lean = m.lean ? Math.sign(m.lean.perBeat ?? 0.05) * Math.min(Math.abs((m.lean.perBeat ?? 0.05) * leanSteps), m.lean.max ?? 0.5) : 0;
    const slideSteps = m.slide ? clk.steps(m.slide.from ?? m.t0, t) : 0;
    const sdx = m.slide ? (m.slide.perBeat?.[0] ?? 0) * slideSteps : 0, sdy = m.slide ? (m.slide.perBeat?.[1] ?? 0) * slideSteps : 0;
    const sp = m.spring === false ? null : { stagger: 0.02, freq: 5.5, damp: 0.42, rise: 0.35, ...(m.spring ?? {}) };
    const fan = m.lean?.fan ?? 1;

    const glyphs: GlyphPose[] = this.glyphs.map((g, i) => {
      const iN = n > 1 ? i / (n - 1) : 0.5;
      // rest -> stretched/tracked -> stamped, about the anchor
      let cx = ax + (g.cx - ax) * wr + (i - (m.anchor === 'left' ? 0 : (n - 1) / 2)) * tr;
      cx = ax + (cx - ax) * S + sdx;
      let y = sdy, sx = wr * S, sy = S, on = 1;
      let rot = lean * (fan ? lerp(1 - 0.6 * fan, 1 + 0.6 * fan, iN) : 1);
      if (sp) {
        const tl = t - (m.t0 - lead + i * sp.stagger);
        if (tl < 0) on = 0;
        else {
          const k = springStep(tl, sp.freq, sp.damp);
          on = k;
          y += (1 - k) * sp.rise * size;
          sy *= 0.3 + 0.7 * k;
        }
      } else if (t < m.t0 - lead) on = 0;
      if (m.exit && t >= m.exit.at) {
        const dur = m.exit.dur ?? 0.16, kind = m.exit.kind ?? 'collapse';
        const st = kind === 'wipe' ? 0 : 0.25 * dur * (n > 1 ? i / (n - 1) : 0);
        const u = clamp((t - m.exit.at - st) / dur);
        if (kind === 'collapse') { sy *= 1 - ease.inCubic(u); sx *= 1 + 0.25 * u; if (u >= 1) on = 0; }
        else if (kind === 'slide') { cx += (m.exit.dir ?? 1) * ease.inCubic(u) * size * 8; if (u >= 1) on = 0; }
        else if (kind === 'drop') { y += ease.inQuad(u) * size * 3; rot += (m.exit.dir ?? 1) * 0.6 * u * (0.5 + iN); if (u >= 1) on = 0; }
        else if (clamp((t - m.exit.at) / dur) * n > i) on = 0; // wipe: glyph i goes at i/n of the way
      }
      return { cx, y, sx, sy, rot, on, width, weight };
    });
    return { glyphs, shake, scale: S };
  }
}

/** A frame shake [x, y] in px for PostOverrides.shake, amplitude `amp` (e.g. pose.shake * 14). */
export function kinShake(t: number, amp: number): [number, number] {
  return amp > 0.05 ? [noise1(t * 60, 11) * amp, noise1(t * 60, 12) * amp] : [0, 0];
}

// ================================================================================================== 2D drawing
/** A break: glyphs inside `mask` (a closed path, same coordinates as the drawing) move by `a`, the rest by `b`, each
 *  scaled by k (0 = whole, 1 = fully broken). Rotations pivot about `pivot`. `aOn`: alpha of the inside part (0 = the
 *  piece is gone, e.g. bitten away). The plate supplies the motif: bite scallops, a razor's diagonal, a crack. */
export interface KinBreak {
  mask: Path2D; k: number;
  a?: { dx?: number; dy?: number; rot?: number }; b?: { dx?: number; dy?: number; rot?: number };
  pivot?: [number, number]; aOn?: number;
}
export interface DrawOpts {
  /** Fill per glyph (CSS colour), or one for all. Flat fills only: no outlines, no halos. */
  fill: string | ((i: number) => string);
  /** Multiplies every glyph's presence (alpha). */
  alpha?: number;
  brk?: KinBreak;
  /** What the type probe should know about this word (role, lyric onset, lit): see THE TYPE PROBE. */
  tag?: KinTag;
}

/** Draw a posed word at (x, baseline). Each glyph: its pose about its baseline centre, at the Archivo instance nearest
 *  its width/weight, the horizontal scale carrying the continuous width. */
export function drawKin(c: CanvasRenderingContext2D, kw: KinWord, P: KinPose, x: number, base: number, o: DrawOpts) {
  const pr = kinProbeOn();
  if (pr) { pr.draw++; kinRecord2D(c, kw, P, x, base, o.tag, o.alpha ?? 1); }
  try { drawKin0(c, kw, P, x, base, o); } finally { if (pr) pr.draw--; }
}
function drawKin0(c: CanvasRenderingContext2D, kw: KinWord, P: KinPose, x: number, base: number, o: DrawOpts) {
  const one = () => drawGlyphs(c, kw, P, x, base, o);
  const b = o.brk;
  if (!b || b.k <= 0) { one(); return; }
  const piv = b.pivot ?? [x + kw.width / 2, base];
  const part = (inside: boolean, mv: KinBreak['a'], alpha: number) => {
    if (alpha <= 0.002) return;
    c.save();
    // clip in the unmoved frame (the break line stays where it was cut), then move the piece
    if (inside) c.clip(b.mask);
    else { const p = new Path2D(); p.rect(-4000, -4000, 12000, 12000); p.addPath(b.mask); c.clip(p, 'evenodd'); }
    c.translate(piv[0] + (mv?.dx ?? 0) * b.k, piv[1] + (mv?.dy ?? 0) * b.k);
    c.rotate((mv?.rot ?? 0) * b.k);
    c.translate(-piv[0], -piv[1]);
    c.globalAlpha *= alpha;
    one();
    c.restore();
  };
  part(true, b.a, b.aOn ?? 1);
  part(false, b.b, 1);
}

function drawGlyphs(c: CanvasRenderingContext2D, kw: KinWord, P: KinPose, x: number, base: number, o: DrawOpts) {
  const a0 = c.globalAlpha;
  const size = kw.style.size;
  P.glyphs.forEach((p, i) => {
    const g = kw.glyphs[i]!;
    if (p.on <= 0.001 || !g.ch.trim()) return;
    const fam = kw.family(p.width, p.weight);
    c.font = font(fam, size);
    const adv = c.measureText(g.ch).width;
    // the instance's own advance vs. the rest glyph's: sx (which already holds the width ratio) is relative to rest
    const corr = g.adv / Math.max(1e-6, adv);
    c.save();
    c.globalAlpha = a0 * clamp(p.on * 3) * (o.alpha ?? 1);
    c.fillStyle = typeof o.fill === 'string' ? o.fill : o.fill(i);
    c.translate(x + p.cx, base + p.y);
    if (p.rot) c.rotate(p.rot);
    c.scale(p.sx * corr, p.sy);
    c.fillText(g.ch, -adv / 2, 0);
    c.restore();
  });
  c.globalAlpha = a0;
}

// ================================================================================================== pressure
export interface PressureRow { y: number; size: number; width: number; weight: number; sx: number; on: number; tone: number }
/**
 * Pressure: copies of a line condense and pack a box, one more on each kick after t0 (P(doom)'s `dense`). Rows are
 * returned top to bottom (baseline y); the newest springs in. Width 125 -> 62 and weight 300 -> 900 as the box fills;
 * the leading collapses; every copy is justified to the box width. `max`: copies at full pressure.
 */
export function pressureRows(text: string, t: number, t0: number, clk: KinClock, box: { x0: number; y0: number; x1: number; y1: number }, max = 9): PressureRow[] {
  if (t < t0) return [];
  const n = Math.min(max, 1 + clk.kicks(t0, t));
  const c = n > 1 ? (n - 1) / (max - 1) : 0;
  const width = lerp(125, 62, c), weight = lerp(300, 900, c);
  const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
  const CAP = 0.686, lead = lerp(1.25, 1.02, c);
  const fam = archivoAt(width, weight);
  const size = Math.min(bh / (n * CAP * lead), bw / Math.max(1, measure(text, fam, 100) / 100));
  const adv = measure(text, fam, size);
  // the newest copy's arrival (on its kick)
  const k = springStep(t - (n > 1 ? clk.lastKick(t) : t0), 6, 0.45);
  const rows: PressureRow[] = [];
  const pitch = bh / n;
  for (let r = 0; r < n; r++) {
    const newest = r === n - 1;
    const yRest = box.y0 + pitch * (r + 0.5) + (size * CAP) / 2;
    rows.push({ y: newest ? lerp(box.y1 + size, yRest, k) : yRest, size, width, weight, sx: bw / Math.max(1, adv), on: newest ? clamp(k * 3) : 1, tone: r % 2 });
  }
  return rows;
}
/** Draw pressure rows in two alternating flat tones. */
export function drawPressure(c: CanvasRenderingContext2D, text: string, rows: PressureRow[], x0: number, tones: [string, string], tag?: KinTag) {
  const pr = kinProbeOn();
  for (const r of rows) {
    c.save();
    c.font = font(archivoAt(r.width, r.weight), r.size);
    c.globalAlpha *= r.on;
    c.fillStyle = tones[r.tone]!;
    c.translate(x0, r.y);
    c.scale(r.sx, 1);
    if (pr) {
      // the copy's box in its own frame (origin = baseline start, x scaled by sx): the line's advance by the cap height
      pr.draw++;
      kinRecordRect(c, text, { role: 'pressure', ...tag }, [0, -r.size * (tag?.capRatio ?? ARCHIVO_CAP), c.measureText(text).width, 0], c.globalAlpha, Array.from(text).length);
    }
    try { c.fillText(text, 0, 0); } finally { if (pr) pr.draw--; }
    c.restore();
  }
}

/** A half-plane mask through (x, y) at `angle` (rad): the razor's diagonal, a wipe edge. */
export function halfPlane(x: number, y: number, angle: number, R = 5000): Path2D {
  const p = new Path2D(), cs = Math.cos(angle), sn = Math.sin(angle);
  p.moveTo(x - cs * R, y - sn * R);
  p.lineTo(x + cs * R, y + sn * R);
  p.lineTo(x + cs * R - sn * R, y + sn * R + cs * R);
  p.lineTo(x - cs * R - sn * R, y - sn * R + cs * R);
  p.closePath();
  return p;
}

// ================================================================================================== 3D: SDF on a surface
export const KIN_MAX = 8;
/**
 * Pack a posed word (built with KinWord.fromCells in surface units) for glslKinSDF: per glyph
 * A = (rest cx, posed cx, posed y (up), rotation (up-space)), B = (sx, sy, presence, thin), C = (cell half-width,
 * half height, rest cy, edge margin). `thin` is 1 at weight 300 and 0 at 900 (for light -> heavy erosion).
 */
export function packKin(kw: KinWord, P: KinPose, cap: number, restCy = 0, out = new Float32Array(KIN_MAX * 12)) {
  out.fill(0);
  P.glyphs.slice(0, KIN_MAX).forEach((p, i) => {
    const g = kw.glyphs[i]!;
    const A = i * 4, B = KIN_MAX * 4 + i * 4, C = KIN_MAX * 8 + i * 4;
    out[A] = g.cx; out[A + 1] = p.cx; out[A + 2] = restCy - p.y; out[A + 3] = -p.rot;
    out[B] = Math.max(0.05, p.sx); out[B + 1] = Math.max(0.05, p.sy); out[B + 2] = p.on; out[B + 3] = clamp((900 - p.weight) / 600);
    out[C] = g.adv / 2; out[C + 1] = cap / 2; out[C + 2] = restCy; out[C + 3] = 0.3;
  });
  return out;
}
/** Write packKin's output into three THREE vec4-array uniforms (values are THREE.Vector4[]). */
export function setKinUniforms(arr: Float32Array, A: { set(x: number, y: number, z: number, w: number): unknown }[], B: typeof A, C: typeof A) {
  for (let i = 0; i < KIN_MAX; i++) {
    A[i]!.set(arr[i * 4]!, arr[i * 4 + 1]!, arr[i * 4 + 2]!, arr[i * 4 + 3]!);
    B[i]!.set(arr[KIN_MAX * 4 + i * 4]!, arr[KIN_MAX * 4 + i * 4 + 1]!, arr[KIN_MAX * 4 + i * 4 + 2]!, arr[KIN_MAX * 4 + i * 4 + 3]!);
    C[i]!.set(arr[KIN_MAX * 8 + i * 4]!, arr[KIN_MAX * 8 + i * 4 + 1]!, arr[KIN_MAX * 8 + i * 4 + 2]!, arr[KIN_MAX * 8 + i * 4 + 3]!);
  }
}
/**
 * GLSL: `float <fn>(vec2 X, out float on, out float thin)`, the signed distance (surface units, negative inside) of a
 * posed word at surface point X, sampling a baked SDF texture `tex` (patch rect = x0, y0, 1/w, 1/h) through each
 * glyph's inverse pose. Each glyph only reads inside its own rest cell, so neighbours never smear into it. `on` and
 * `thin` are those of the glyph nearest X. Declares the uniforms <u>A[8], <u>B[8], <u>C[8] and int <u>N.
 */
export function glslKinSDF(fn: string, u: string, tex: string, rect: string) {
  return /* glsl */ `
uniform vec4 ${u}A[${KIN_MAX}], ${u}B[${KIN_MAX}], ${u}C[${KIN_MAX}]; uniform int ${u}N;
float ${fn}(vec2 X, out float on, out float thin) {
  float best = 6.0; on = 0.0; thin = 0.0;
  for (int i = 0; i < ${KIN_MAX}; i++) {
    if (i >= ${u}N) break;
    vec4 A = ${u}A[i], B = ${u}B[i], C = ${u}C[i];
    if (B.z <= 0.001) continue;
    vec2 d = X - A.yz;
    float rr = (C.x + C.y) * max(B.x, B.y) + 1.5;
    if (dot(d, d) > rr * rr) continue;
    float c = cos(A.w), s = sin(A.w);
    d = vec2(c * d.x + s * d.y, -s * d.x + c * d.y) / B.xy;
    float ex = abs(d.x) - C.x;
    vec2 R = vec2(A.x + clamp(d.x, -C.x, C.x), C.z + d.y);
    float k = min(B.x, B.y);
    float v = max(textureLod(${tex}, (R - ${rect}.xy) * ${rect}.zw, 0.0).r, ex + C.w) * k;
    if (v < best) { best = v; on = B.z; thin = B.w; }
  }
  return best;
}`;
}

// ================================================================================================== lyric-led camera
/** One key of a lyric path: at song time t the path passes through v (a word's place along its line, a camera's
 *  distance, an angle, a world point: any numbers, the same count in every key). */
export interface PathKey { t: number; v: number[] }
export interface PathOpts {
  /** The clock whose beats the move eases into (none: plain time, no easing). */
  clk?: KinClock;
  /** How much the pace dips into every beat (0 = even, 0.9 = nearly stops). Default 0.3. */
  settle?: number;
  /** A further dip into every downbeat (the bar's first beat). Default 0.2. settle + down must stay below 1. */
  down?: number;
  /** Keys made by fromWords land this long before their word's onset (s), so the camera is there as it lands. */
  lead?: number;
}

/** A continuous move through keyed positions, eased into the beats (see LYRIC-LED CAMERA in the header). */
export class LyricPath {
  private k: PathKey[];
  private m: number[][] = [];
  constructor(keys: PathKey[], public o: PathOpts = {}) {
    this.k = keys.slice().sort((a, b) => a.t - b.t).filter((x, i, a) => i === 0 || x.t > a[i - 1]!.t + 1e-6);
    // Fritsch-Carlson tangents per component: monotone between keys, no overshoot
    const n = this.k.length, dim = this.k[0]?.v.length ?? 0;
    for (let i = 0; i < n; i++) this.m.push(new Array(dim).fill(0));
    for (let c = 0; c < dim; c++) {
      const d: number[] = [];
      for (let i = 0; i + 1 < n; i++) d.push((this.k[i + 1]!.v[c]! - this.k[i]!.v[c]!) / (this.k[i + 1]!.t - this.k[i]!.t));
      for (let i = 0; i < n; i++) {
        const a = d[i - 1], b = d[i];
        let m = a === undefined ? (b ?? 0) : b === undefined ? a : a * b <= 0 ? 0 : (a + b) / 2;
        if (a !== undefined && b !== undefined && a * b > 0) {
          // limit so the cubic stays monotone (alpha^2 + beta^2 <= 9)
          const al = m / a, be = m / b, s = al * al + be * be;
          if (s > 9) m *= 3 / Math.sqrt(s);
        } else if (a === undefined || b === undefined) m = 0; // ease out of the first key and into the last
        this.m[i]![c] = m;
      }
    }
  }
  /** Keys at each word's onset (minus `lead`), plus any extra keys (a start before the first word, a hold after). */
  static fromWords<W extends { start: number }>(words: W[], place: (w: W, i: number) => number[], o: PathOpts = {}, extra: PathKey[] = []) {
    const lead = o.lead ?? 0;
    return new LyricPath([...extra, ...words.map((w, i) => ({ t: w.start - lead, v: place(w, i) }))], o);
  }
  /** Song time warped so the pace dips into each beat (and further into each downbeat); identity on every beat. */
  warp(t: number) {
    const clk = this.o.clk;
    if (!clk) return t;
    const settle = this.o.settle ?? 0.3, down = this.o.down ?? 0.2, TAU = Math.PI * 2;
    const b = clk.beat(t);
    let b1 = b - (settle / TAU) * Math.sin(TAU * b);
    if (down > 0) {
      const i = Math.floor(b1 + 1e-6), x = (clk.inBar(i) + (b1 - i)) / 4;
      b1 += (4 * -down / TAU) * Math.sin(TAU * x);
    }
    return clk.beatTime(b1);
  }
  /** The path at song time t. */
  at(t: number): number[] {
    const k = this.k, n = k.length;
    if (!n) return [];
    const tw = this.warp(t);
    if (tw <= k[0]!.t) return k[0]!.v.slice();
    if (tw >= k[n - 1]!.t) return k[n - 1]!.v.slice();
    let i = 0;
    while (i + 2 < n && tw >= k[i + 1]!.t) i++;
    const a = k[i]!, b = k[i + 1]!, h = b.t - a.t, u = (tw - a.t) / h;
    const h00 = (1 + 2 * u) * (1 - u) * (1 - u), h10 = u * (1 - u) * (1 - u), h01 = u * u * (3 - 2 * u), h11 = u * u * (u - 1);
    return a.v.map((va, c) => h00 * va + h10 * h * this.m[i]![c]! + h01 * b.v[c]! + h11 * h * this.m[i + 1]![c]!);
  }
}

/** A camera key: where it looks, where it stands, its roll (rad) and vertical fov (deg). */
export interface CamKey { t: number; target: [number, number, number]; pos: [number, number, number]; roll?: number; fov?: number }
/** A lyric-led camera: target, position, roll and fov through keys as one LyricPath (eased into the beats). */
export class LyricCam {
  private p: LyricPath;
  constructor(keys: CamKey[], o: PathOpts = {}) {
    this.p = new LyricPath(keys.map((x) => ({ t: x.t, v: [...x.target, ...x.pos, x.roll ?? 0, x.fov ?? 27] })), o);
  }
  at(t: number) {
    const v = this.p.at(t);
    return { target: [v[0]!, v[1]!, v[2]!] as [number, number, number], pos: [v[3]!, v[4]!, v[5]!] as [number, number, number], roll: v[6]!, fov: v[7]! };
  }
}

// ================================================================================================== the type probe
// See THE TYPE PROBE in the header. Everything below is inert unless lint has installed globalThis.__kin = { on: true, ... }.
/** The output frame the records are in (logical px; the checker's W x H). */
const KIN_W = 1920, KIN_H = 1080;
/** Cap height / em: Archivo; Cormorant italic (lowercase: the height of its tall letters). */
const ARCHIVO_CAP = 0.686, SERIF_CAP = 0.62;

export type KinRole = 'hero' | 'sup' | 'pressure' | 'unknown';
/** What a plate tells the probe about a word it draws (all optional; start is how lint finds the word's line). */
export interface KinTag {
  /** The lyric word's onset (lyrics.json `start`, s). */
  start?: number;
  /** The lyric line (`lines[].i`) and word index in it, when the plate knows them (else lint matches text + start). */
  line?: number; k?: number;
  /** hero, sup (supporting) or pressure (copies of a hero). Untagged words are 'unknown': checked for presence, crop and safe only. */
  role?: KinRole;
  /** Lit as sung (default true); false for words shown unsung (halide). EARLY checks lit words only. */
  lit?: boolean;
  /** Cap height / em when it is not Archivo's 0.686. */
  capRatio?: number;
  /** Record this text instead of the word's (a pressure copy of a hero). */
  text?: string;
}
/** One word on one frame (box in output px, y down). */
export interface KinRec {
  scene: string; text: string; role: KinRole; start: number; line: number; k: number; lit: boolean;
  box: [number, number, number, number];
  /** Cap height on screen (px): the tallest glyph's. */
  cap: number;
  /** Presence 0..1: alpha times the most present glyph. */
  a: number;
  /** First and last glyph shown, and the glyph count. */
  g0: number; g1: number; n: number;
  /** false: drawn into a canvas with no known mapping to the frame (box is in that canvas's px; not checked). */
  mapped: boolean;
}
export interface KinProbeState { on: boolean; scene: string; recs: KinRec[]; /** > 0 while the kit is drawing glyphs (lint's fillText hook ignores them) */ draw: number }
/** The probe's state when lint has switched it on, else null (one property read: free in a normal render). */
export function kinProbeOn(): KinProbeState | null {
  const p = (globalThis as { __kin?: KinProbeState }).__kin;
  return p && p.on ? p : null;
}

export type KinMap = (x: number, y: number) => [number, number] | null;
const canvasMaps = new WeakMap<object, KinMap>();
/** Declare how a canvas's logical px land in the output frame (a flat texture on a screen, a paper): [X, Y] in frame px,
 *  or null where it is not visible. Full-frame canvases (16:9, 1920 x k px) need none. */
export function kinMapCanvas(canvas: object, map: KinMap) { canvasMaps.set(canvas, map); }
const IDENT: KinMap = (x, y) => [x, y];
function mapOf(canvas: HTMLCanvasElement): { map: KinMap; mapped: boolean } {
  const m = canvasMaps.get(canvas);
  if (m) return { map: m, mapped: true };
  if (canvas.width * 9 === canvas.height * 16 && canvas.width % KIN_W === 0) return { map: IDENT, mapped: true };
  return { map: IDENT, mapped: false };
}

function kinPush(pr: KinProbeState, tag: KinTag | undefined, text: string, box: number[], cap: number, a: number, g0: number, g1: number, n: number, mapped: boolean) {
  pr.recs.push({
    scene: pr.scene, text: tag?.text ?? text, role: tag?.role ?? 'unknown', start: tag?.start ?? -1, line: tag?.line ?? -1, k: tag?.k ?? -1,
    lit: tag?.lit ?? true, box: [box[0]!, box[1]!, box[2]!, box[3]!], cap, a, g0, g1, n, mapped,
  });
}

/** Record a posed word drawn with drawKin's geometry at (x, baseline) in context c (drawKin calls this itself). */
export function kinRecord2D(c: CanvasRenderingContext2D, kw: KinWord, P: KinPose, x: number, base: number, tag?: KinTag, alphaOpt = 1) {
  const pr = kinProbeOn();
  if (!pr) return;
  const { map, mapped } = mapOf(c.canvas);
  const m = c.getTransform();
  const h0 = (tag?.capRatio ?? (kw.style.family === 'serif' ? SERIF_CAP : ARCHIVO_CAP)) * kw.style.size;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, cap = 0, on = 0, g0 = -1, g1 = -1;
  P.glyphs.forEach((p, i) => {
    const g = kw.glyphs[i]!;
    if (p.on <= 0.001 || !g.ch.trim()) return;
    const hw = (g.adv * p.sx) / 2, h = h0 * p.sy, cs = Math.cos(p.rot), sn = Math.sin(p.rot);
    // glyph-local (lx, ly: y down from the baseline) -> canvas -> frame
    const pt = (lx: number, ly: number) => {
      const rx = lx * cs - ly * sn + x + p.cx, ry = lx * sn + ly * cs + base + p.y;
      return map(m.a * rx + m.c * ry + m.e, m.b * rx + m.d * ry + m.f);
    };
    const q = [pt(-hw, -h), pt(hw, -h), pt(hw, 0), pt(-hw, 0)];
    if (q.some((v) => !v)) return;
    for (const v of q) { x0 = Math.min(x0, v![0]); x1 = Math.max(x1, v![0]); y0 = Math.min(y0, v![1]); y1 = Math.max(y1, v![1]); }
    const t = pt(0, -h), b = pt(0, 0);
    if (t && b) cap = Math.max(cap, Math.hypot(t[0] - b[0], t[1] - b[1]));
    on = Math.max(on, p.on);
    if (g0 < 0) g0 = i;
    g1 = i;
  });
  if (g0 < 0) return;
  kinPush(pr, tag, kw.text, [x0, y0, x1, y1], cap, clamp(c.globalAlpha * alphaOpt * clamp(on * 3)), g0, g1, P.glyphs.length, mapped);
}

/** Record a text run whose box is `rect` = [x0, y0, x1, y1] in the CURRENT transform of c (y0 the cap top, y1 the baseline). */
export function kinRecordRect(c: CanvasRenderingContext2D, text: string, tag: KinTag | undefined, rect: number[], alpha: number, n: number) {
  const pr = kinProbeOn();
  if (!pr) return;
  const { map, mapped } = mapOf(c.canvas);
  const m = c.getTransform();
  const pt = (lx: number, ly: number) => map(m.a * lx + m.c * ly + m.e, m.b * lx + m.d * ly + m.f);
  const q = [pt(rect[0]!, rect[1]!), pt(rect[2]!, rect[1]!), pt(rect[2]!, rect[3]!), pt(rect[0]!, rect[3]!)];
  if (q.some((v) => !v)) return;
  const xs = q.map((v) => v![0]), ys = q.map((v) => v![1]);
  const t = pt((rect[0]! + rect[2]!) / 2, rect[1]!), b = pt((rect[0]! + rect[2]!) / 2, rect[3]!);
  kinPush(pr, tag, text, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], t && b ? Math.hypot(t[0] - b[0], t[1] - b[1]) : 0, clamp(alpha), 0, n - 1, n, mapped);
}

// ---- 3D: type on a surface
export interface KinV3 { x: number; y: number; z: number }
/** A pinhole camera as the plates' shaders have it: position, forward/right/up unit vectors, tan(vertical fov / 2), aspect. */
export interface KinCam { pos: KinV3; fwd: KinV3; right: KinV3; up: KinV3; tanH: number; aspect: number }
export function kinCam(pos: KinV3, fwd: KinV3, right: KinV3, up: KinV3, tanH: number, aspect = KIN_W / KIN_H): KinCam {
  return { pos, fwd, right, up, tanH, aspect };
}
/** World point -> output px [x, y (down), depth]; null at or behind the camera. */
export function kinProject(cam: KinCam, p: ArrayLike<number>): [number, number, number] | null {
  const dx = p[0]! - cam.pos.x, dy = p[1]! - cam.pos.y, dz = p[2]! - cam.pos.z;
  const d = dx * cam.fwd.x + dy * cam.fwd.y + dz * cam.fwd.z;
  if (d <= 0.05) return null;
  const X = (dx * cam.right.x + dy * cam.right.y + dz * cam.right.z) / (d * cam.tanH * cam.aspect);
  const Y = (dx * cam.up.x + dy * cam.up.y + dz * cam.up.z) / (d * cam.tanH);
  return [(X * 0.5 + 0.5) * KIN_W, (0.5 - Y * 0.5) * KIN_H, d];
}
/**
 * Record a word set on a 3D surface (packKin's convention). `surf(s, h)` maps a surface point (s along the line, h up, in
 * the word's units) to [x, y, z] in world space, optionally with its outward normal [x, y, z, nx, ny, nz]: a point whose
 * normal faces away from the camera is hidden. The box is the projection of every posed glyph cell (centre
 * (cx, restCy - y), size (adv * sx, cap * sy), rotated by -rot), the cap height the on-screen height of the tallest cell.
 * Not seen: the post pass's zoom and shake (a few px), occlusion by other geometry, depth of field.
 */
export function kinRecord3D(kw: KinWord, P: KinPose, cap: number, restCy: number, surf: (s: number, h: number) => number[], cam: KinCam, tag?: KinTag) {
  const pr = kinProbeOn();
  if (!pr) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, capPx = 0, on = 0, g0 = -1, g1 = -1;
  P.glyphs.forEach((p, i) => {
    const g = kw.glyphs[i]!;
    if (p.on <= 0.001 || !g.ch.trim()) return;
    const cx = p.cx, cy = restCy - p.y, hx = (g.adv * p.sx) / 2, hy = (cap * p.sy) / 2, th = -p.rot, cs = Math.cos(th), sn = Math.sin(th);
    const pt = (lx: number, ly: number) => {
      const w = surf(cx + lx * cs - ly * sn, cy + lx * sn + ly * cs);
      if (w.length >= 6 && (cam.pos.x - w[0]!) * w[3]! + (cam.pos.y - w[1]!) * w[4]! + (cam.pos.z - w[2]!) * w[5]! <= 0) return null; // faces away
      return kinProject(cam, w);
    };
    const q = [pt(-hx, hy), pt(hx, hy), pt(hx, -hy), pt(-hx, -hy)];
    if (q.some((v) => !v)) return;
    for (const v of q) { x0 = Math.min(x0, v![0]); x1 = Math.max(x1, v![0]); y0 = Math.min(y0, v![1]); y1 = Math.max(y1, v![1]); }
    const t = pt(0, hy), b = pt(0, -hy);
    if (t && b) capPx = Math.max(capPx, Math.hypot(t[0] - b[0], t[1] - b[1]));
    on = Math.max(on, p.on);
    if (g0 < 0) g0 = i;
    g1 = i;
  });
  if (g0 < 0) return;
  kinPush(pr, tag, kw.text, [x0, y0, x1, y1], capPx, clamp(on), g0, g1, P.glyphs.length, true);
}
