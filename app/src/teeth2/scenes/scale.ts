// Plate 5 `scale` — chorus 1, first half (48.73 – 62.54), docs/TEETH2.md. Bite-mark photography and the first stomp,
// shot in colour within palette 2A (a hard flash, true blacks). A GOLDEN apple in dental-stone yellow (a Golden
// Delicious: russet freckles and lenticels, greener toward the stem, a faint wax blush; the bite and the cast he pours
// in chorus 2 share the colour) stands stem up, one cold grey-green leaf on the stem, on film-black velvet, ONE BITE
// taken out of its flank (a crescent scooped into the pale cream flesh, its rim scalloped by his incisal
// edges with #8's chip a notch in the scallop, his incisors' grooves dragged down the scoop's wall, the lowers' short
// scrapes below; teeth.ts biteMark(HIS)). An ABFO No. 2 scale stands on the cloth beside it, facing the copy camera,
// its sticker the plate's one readable label (08-32 · EXHIBIT 4). The stomp is the shutter: every beat a flash, every
// flash a new photograph, a new camera each time (the exhibit at 3/4, the bite in profile, macro on the bitten rim, the
// ruler's edge, the scale's corner, the chip). Bitten flesh is cream (SWEET's takes the wax pink); nothing blooms.
//
// The hero words are bitten OUT of the apple's other flank: letter-shaped cavities into the flesh, Archivo condensed
// black built from tooth-width scallop bites, the letter over #8's position chipped; a 3/4 macro so the skin curves
// away and the cavities show depth (scale-bite.ts). A hero shot cuts on the word's onset (45 ms ahead) when the beat
// lands just after it; the word stays until the line leaves (the next beat after its end). The flash: the scene's
// light overshoots as the shutter fires and exposure kicks (multiplicative: blacks stay black).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, SS_TAP, makeRT, W as FW, H as FH } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, hash, lerp, pulse } from '../../engine/util';
import { trgba } from '../palette';
import { KinClock, KinWord, KIN_MAX, drawKin, kinShake, packKin, setKinUniforms, type KinPose, type Moves } from '../kinetic';
import { DOF_FRAG, LAY, MARCH_FRAG } from './scale-glsl';
import { bakeWord, toothSpans } from './scale-bite';

const LABEL = '08-32 · EXHIBIT 4';

/** The hero words, by line (docs/TEETH2.md, plate 5). [line search text, word index in the line]. */
const HEROES: [string, number][] = [
  ['Fight so dirty', 2], ['Fight so dirty', 7],
  ['Talk so pretty', 2], ['Talk so pretty', 7],
  ['Late night devil', 2], ['Late night devil', 5],
  ['And never, never', 1], ['And never, never', 6],
];

type Kind = 'wide' | 'oblique' | 'ruler' | 'profile' | 'macro' | 'rake' | 'corner' | 'chip' | 'slam';
/** One camera per beat (the hero beats are 'rake'), designed in order so nothing repeats. */
const KINDS: Kind[] = [
  'wide', 'ruler', 'rake', 'profile', 'oblique', 'macro', 'rake', 'corner',
  'wide', 'macro', 'rake', 'profile', 'oblique', 'ruler', 'rake', 'chip',
  'oblique', 'macro', 'rake', 'corner', 'rake', 'profile', 'wide', 'ruler',
  'rake', 'macro', 'oblique', 'chip', 'profile', 'wide', 'wide', 'rake',
];

interface Hero {
  word: string; start: number; cut: number; leave: number; tex: THREE.DataTexture; wax: boolean; chip: [number, number]; width: number; hold: boolean;
  /** the word's letters as a kinetic word on the flank (mm), its cap height; when it first shows bitten (after a slam:
   *  the cut back to the apple, where it springs in again); the onsets of a held hero's repeats (never x3) */
  kw: KinWord; cap: number; appleAt: number; reps: number[];
}
/** A full-frame slam (kinetic.ts): the hero breaks out of the photograph as flat type, from t0 to the next flash. */
interface Slam { hero: number; t0: number; t1: number; land: number; kw: KinWord; teeth: boolean }
/** line: which lyric line of the window the shot falls in (0..3: each line has its own camera move); sub: the n-th
 *  photograph of a held hero (NEVER: one new photograph per beat while it is sung three times). */
interface Shot { i: number; t0: number; t1: number; kind: Kind; hero: number; sub: number; line: number }
/** Each hero's own photograph (the 3/4 macro on the bitten flank, varied): camera azimuth off the word's normal, its
 *  elevation, roll, the aim's offset on the flank (mm), the flash's offset from the lens (along the flank's tangent,
 *  up). SWEET (1) and TEETH (3) keep the gate 2 framing of their approved stills exactly. */
const HERO_V: { daz: number; el: number; roll: number; ax: number; fT: number; fU: number }[] = [
  { daz: 0.42, el: 0.0, roll: 0.09, ax: -1.5, fT: -55, fU: 24 },    // DIRTY: low, rolled, raked hard from the upper left
  { daz: 0.7, el: 0.17, roll: -0.02, ax: -3.0, fT: -40, fU: 14 },   // SWEET (approved still)
  { daz: -0.45, el: 0.24, roll: -0.07, ax: 2.0, fT: 40, fU: 18 },   // PRETTY: from the other side, the flash mirrored
  { daz: 0.7, el: 0.17, roll: -0.02, ax: -3.0, fT: -40, fU: 14 },   // TEETH (approved still)
  { daz: 0.3, el: 0.5, roll: 0.16, ax: -1.0, fT: -30, fU: 30 },     // DEVIL: looking down onto the flank
  { daz: -0.2, el: -0.08, roll: -0.12, ax: 0.5, fT: 45, fU: 10 },   // HANDS: near-square, from a hair below
  { daz: 0.55, el: 0.1, roll: 0.05, ax: -2.0, fT: -40, fU: 16 },    // NEVER (then pulled back, one photograph a beat)
  { daz: 0.62, el: 0.1, roll: 0.04, ax: -5.0, fT: -45, fU: 20 },    // GO: bitten taller, the apple's edge in frame
];
/** NEVER's later photographs: the camera pulls back a step per beat until the whole exhibit is in frame. */
const NEVER_V: { daz: number; el: number; roll: number; d: number }[] = [
  { daz: -0.3, el: 0.3, roll: -0.1, d: 78 },
  { daz: 0.15, el: -0.06, roll: 0.12, d: 100 },
  { daz: -0.5, el: 0.42, roll: -0.06, d: 135 },
  { daz: 0.4, el: 0.22, roll: 0.08, d: 185 },
  { daz: 0.78, el: 0.36, roll: -0.04, d: 265 },
];
type Pose = { pos: THREE.Vector3; at: THREE.Vector3; fov: number; roll: number; aper: number; focus: THREE.Vector3 };
type Light = { pos: THREE.Vector3; I: number; rad: number; fillDir: THREE.Vector3; fill: number; cone?: number; coat?: number };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

const AC = V(...LAY.AC);
/** A frame on the apple's flank at azimuth az (from +Z toward +X) and height h over its centre: the skin point C,
 *  its outward normal N (horizontal), its tangent T (to the right, seen from outside). */
function flank(az: number, h: number, el = 0) {
  const N = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)), T = V(Math.cos(az), 0, -Math.sin(az));
  const U = new THREE.Vector3().crossVectors(N, T);
  // the body without its noise and wells (scale-glsl.ts appleBody): bisect outward along N
  const c = Math.cos(LAY.AROT), s = Math.sin(LAY.AROT);
  const body = (p: THREE.Vector3) => {
    const qx = p.x - AC.x, qy = p.y - AC.y, qz = p.z - AC.z;
    const lx = c * qx + s * qy, ly = -s * qx + c * qy;
    const hh = ly / LAY.AH;
    const rad = LAY.AR * (1 + 0.08 * hh - 0.06 * hh * hh) - 6.5 * Math.max(-hh, 0) ** 2;
    return Math.hypot(Math.hypot(lx, qz), (ly * LAY.AR) / LAY.AH) - rad;
  };
  const at = (k: number) => AC.clone().add(V(0, h, 0)).addScaledVector(N, k);
  let lo = 0, hi = 60;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (body(at(m)) > 0) hi = m; else lo = m; }
  return { C: at(lo), N, T, U };
}
/** The bite (its crescent faces right-front), the word (on the left-front flank). */
// the bite sits on the apple's upper shoulder, facing up and out: the lens looks down onto it, perpendicular
const BITE0 = flank(LAY.BAZ, 0, LAY.BEL);
// the bite taken on the diagonal (as an apple is held): its arch turned in the plane, never a level mouth-like slot
const BITE = (() => {
  const a = 0.95, c = Math.cos(a), s = Math.sin(a);
  return { C: BITE0.C, N: BITE0.N, T: BITE0.T.clone().multiplyScalar(c).addScaledVector(BITE0.U, s), U: BITE0.U.clone().multiplyScalar(c).addScaledVector(BITE0.T, -s) };
})();
const WORDF = flank(LAY.WAZ, LAY.WH);
/** The copy camera's azimuth for the exhibit: the bite seen at 3/4 on the apple's right, its crescent in the outline. */
const CAZ = LAY.BAZ - 1.08;
const DC = V(Math.sin(CAZ), 0, Math.cos(CAZ)), RC = V(Math.cos(CAZ), 0, -Math.sin(CAZ));
/** The scale: standing on the cloth to the right of the apple, its face in the bite's plane (as bite-mark photography
 *  requires: the lens perpendicular to the bite, the scale in the bite's plane). */
// (it lies in the bite's tangent plane beside it, held on two black posts)
const SO = BITE0.C.clone().addScaledVector(BITE0.T, 38).addScaledVector(BITE0.U, -34).addScaledVector(BITE0.N, 1.0);
const postAt = (u: number, v: number, back: number) => {
  const p = SO.clone().addScaledVector(BITE0.T, u).addScaledVector(BITE0.U, v).addScaledVector(BITE0.N, -back);
  return new THREE.Vector4(p.x, p.z, p.y - 4, 4);
};
const POSTS = [postAt(9, 6, 8), postAt(88, 6, 8)];
/** The small supporting words: bitten below the bite, facing the same way. */
const W2 = flank(LAY.BAZ + 0.22, 0, LAY.BEL - 0.6);
/** A direction at azimuth az (from +Z toward +X) and elevation el. */
const dirAz = (az: number, el: number) => V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
/** A point on a flank frame at (X right, Y up) mm, `out` along its normal, the skin's sag allowed for. */
function onF(F: { C: THREE.Vector3; N: THREE.Vector3; T: THREE.Vector3; U: THREE.Vector3 }, X: number, Y: number, out = 0) {
  const sag = (X * X + Y * Y) / (2 * LAY.AR);
  return F.C.clone().addScaledVector(F.T, X).addScaledVector(F.U, Y).addScaledVector(F.N, out - sag);
}

/** Look-development overrides from the page URL (render.ts --query sc_cam=...): sc_<name>=v1,v2,... */
const QP = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
function qv(name: string): number[] | null {
  const s = QP?.get('sc_' + name);
  return s ? s.split(',').map(Number) : null;
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, mips = false) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const tex = new THREE.CanvasTexture(cv);
  tex.generateMipmaps = mips;
  tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export default class ScalePlate extends Scene {
  private march!: FSPass;
  private dof!: FSPass;
  private rt = makeRT();
  private empty!: THREE.DataTexture;
  private heroes: Hero[] = [];
  private shots: Shot[] = [];
  private c8: [number, number] = [4.2, 12.5];
  private slams: Slam[] = [];
  private clk!: KinClock;
  private L = new Layer2D();
  private pk = new Float32Array(KIN_MAX * 12);

  override init() {
    const { lyrics, audio } = this.ctx;
    // the case sticker: Plex Mono, ink on transparent (the paper is shaded in the march); 29.8 x 8 mm
    const label = canvasTex(2048, Math.round((2048 * 8) / 29.8), (c) => {
      const fam = F.mono(500);
      let size = 200;
      c.font = font(fam, size);
      size = (size * 2048 * 0.86) / c.measureText(LABEL).width;
      c.font = font(fam, size);
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(LABEL, 1024, c.canvas.height * 0.52);
    });
    // the scale's cm numerals: Plex Mono digits, one per cell (64 x 106 px)
    const digits = canvasTex(640, 106, (c) => {
      c.font = font(F.mono(500), 128);
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (let k = 0; k < 10; k++) c.fillText(String(k), 32 + k * 64, 58, 60);
    }, true);

    const spans = toothSpans();
    const s8 = spans.upper.find((s) => s[3] === 8)!;
    this.c8 = [s8[0]!, LAY.SCY + 11];
    const v4 = (a: number[][]) => a.map((s) => new THREE.Vector4(s[0], s[1], s[2], s[3]));
    const e = new THREE.DataTexture(new Uint16Array([THREE.DataUtils.toHalfFloat(6)]), 1, 1, THREE.RedFormat, THREE.HalfFloatType);
    e.needsUpdate = true;
    this.empty = e;

    // the cuts: every beat in the window; a hero word's beat moves to its onset (45 ms ahead) when it lands just after
    const beats = audio.beats.filter((b) => b >= this.ctx.start - 0.01 && b < this.ctx.end - 0.01);
    const cuts = beats.slice();
    for (const [line, wi] of HEROES) {
      const l = lyrics.get(line);
      const w = l.words[wi]!;
      const j = beats.findIndex((b) => b >= w.start - 0.12 && b <= w.start + 0.2);
      const cut = w.start - 0.045;
      if (j >= 0) cuts[j] = cut;
      const word = w.w.replace(/[^A-Za-z]/g, '');
      // a word sung again straight after itself (never, never, never) is one hero, held until the last is sung
      let k = wi;
      while (l.words[k + 1] && l.words[k + 1]!.w.replace(/[^A-Za-z]/g, '').toLowerCase() === word.toLowerCase()) k++;
      const end = l.words[k]!.end;
      // the hero leaves on the beat after it is sung (~0.3 s on), so the line's later words are not held up by it
      const leave = beats.find((b) => b >= end + 0.25) ?? this.ctx.end;
      const wax = word.toLowerCase() === 'sweet';
      const bw = bakeWord(word, wax, 18);
      const kw = KinWord.fromCells(wax ? word.toLowerCase() : word.toUpperCase(), bw.cap / 0.72, bw.cells, { family: wax ? 'serif' : 'archivo', width: 62 });
      const reps = l.words.slice(wi, k + 1).map((x) => x.start);
      this.heroes.push({ word, start: w.start, cut, leave, tex: bw.tex, wax, chip: bw.chip, width: bw.width, hold: k > wi, kw, cap: bw.cap, appleAt: cut, reps });
    }
    for (let k = 0; k + 1 < this.heroes.length; k++) this.heroes[k]!.leave = Math.min(this.heroes[k]!.leave, this.heroes[k + 1]!.cut);
    const lineStarts = lyrics.lines.map((l) => l.start).filter((x) => x >= this.ctx.start - 0.05 && x < this.ctx.end);
    this.shots = cuts.map((t0, i) => ({
      i, t0, t1: cuts[i + 1] ?? this.ctx.end, kind: KINDS[i % KINDS.length]!,
      hero: this.heroes.findIndex((h) => Math.abs(h.cut - t0) < 1e-3), sub: 0,
      line: Math.max(0, lineStarts.filter((x) => x <= t0 + 0.1).length - 1),
    }));
    for (const s of this.shots) if (s.hero >= 0) s.kind = 'rake';
    // a held hero (NEVER x3): every beat while it is sung is another photograph of it, the camera pulling back
    this.heroes.forEach((h, k) => {
      if (!h.hold) return;
      let n = 0;
      for (const s of this.shots) if (s.t0 > h.cut + 1e-3 && s.t0 < h.leave - 1e-3) { s.hero = k; s.kind = 'rake'; s.sub = ++n; }
    });

    // the slams: up to two heroes break out of the photograph as full-frame type (kinetic.ts), cutting back to the
    // apple on the next flash. DIRTY on its onset, the chorus's first hero; TEETH (the hook's first statement) bitten
    // into the apple on its onset first (the approved still), slamming on the next beat (see kinetic.ts, THE TEETH HOOK)
    const slamAt = (k: number, onset: boolean) => {
      const h = this.heroes[k]!;
      const i = onset ? this.shots.findIndex((x) => Math.abs(x.t0 - h.cut) < 1e-3) : this.shots.findIndex((x) => x.t0 > h.cut + 0.1);
      if (i < 0 || i + 1 >= this.shots.length) return;
      const s = this.shots[i]!, nx = this.shots[i + 1]!;
      s.kind = 'slam'; s.hero = k;
      const teeth = h.word.toLowerCase() === 'teeth';
      const kw = teeth ? new KinWord('TEETH', { size: 520, width: 62, weight: 900 }) : new KinWord(h.word.toUpperCase(), { size: 300, width: 112, weight: 900 });
      // fit the word inside title safe (the stamp's overshoot included)
      // (the stamp lands 1.2x: at its peak the word just fills title safe, 96 px each side)
      const fit = (FW - 2 * 96) / (1.2 * kw.width);
      const kf = teeth ? new KinWord('TEETH', { size: 520 * fit, width: 62, weight: 900 }) : new KinWord(h.word.toUpperCase(), { size: 300 * fit, width: 112, weight: 900 });
      this.slams.push({ hero: k, t0: s.t0, t1: nx.t0, land: Math.max(s.t0, h.start), kw: kf, teeth });
      if (onset) { nx.kind = 'rake'; nx.hero = k; h.appleAt = nx.t0; }
      else h.leave = Math.min(h.leave, nx.t0); // the bite took it: the next photograph is the next line's
    };
    // the supporting words are baked up front (no bake mid-render)
    for (const l of lyrics.linesIn(this.ctx.start, this.ctx.end)) for (const x of l.words) {
      const wd = x.w.replace(/[^A-Za-z]/g, '');
      if (wd && !this.heroes.some((h) => Math.abs(h.start - x.start) < 1e-3)) this.bakeSupport(wd);
    }
    slamAt(0, true);
    slamAt(3, false);
    this.clk = new KinClock(audio, { backbeat: true });
    const v4s = () => Array.from({ length: KIN_MAX }, () => new THREE.Vector4());
    this.march = new FSPass(MARCH_FRAG, {
      ssTap: SS_TAP,
      camPos: { value: V(0, 0, 0) }, camR: { value: V(0, 0, 0) }, camU: { value: V(0, 0, 0) }, camF: { value: V(0, 0, 0) },
      tanH: { value: 0.3 },
      keyPos: { value: V(0, 0, 0) }, keyDir: { value: V(0, -1, 0) }, keyI: { value: 1 }, keyRad: { value: 10 }, keyCone: { value: 0.8 },
      fillDir: { value: V(0, 1, 0) }, fillI: { value: 0.02 },
      wordTex: { value: this.empty }, labelTex: { value: label }, digitTex: { value: digits },
      wordWax: { value: 0 }, coatK: { value: 1 },
      kwA: { value: v4s() }, kwB: { value: v4s() }, kwC: { value: v4s() }, kwN: { value: 0 },
      k2A: { value: v4s() }, k2B: { value: v4s() }, k2C: { value: v4s() }, k2N: { value: 0 },
      BC: { value: BITE.C }, BN: { value: BITE.N }, BT: { value: BITE.T }, BU: { value: BITE.U }, POST: { value: POSTS },
      WC: { value: WORDF.C }, WN: { value: WORDF.N }, WT: { value: WORDF.T },
      SO: { value: SO }, SN: { value: BITE0.N }, SU: { value: BITE0.T }, SV: { value: BITE0.U },
      word2Tex: { value: this.empty }, W2C: { value: W2.C }, W2N: { value: W2.N }, W2U: { value: W2.U }, W2T: { value: W2.T },
      upT: { value: v4(spans.upper) }, loT: { value: v4(spans.lower) },
    });
    this.dof = new FSPass(DOF_FRAG, { src: { value: null }, focusD: { value: 100 }, aper: { value: 10 }, maxCoc: { value: 18 } });
  }

  private support = new Map<string, { tex: THREE.DataTexture; kw: KinWord; cap: number }>();
  /** The supporting word being sung at t (a word of the current line that is not a hero), baked on first use, and its
   *  kinetic pose: its letters spring up into the skin one by one, the line drifts a step along the flank on every
   *  beat (slide) with its spacing opening on the beat (track), and it collapses on the beat after the line ends. */
  private bakeSupport(word: string) {
    let e = this.support.get(word);
    if (!e) {
      const bw = bakeWord(word);
      e = { tex: bw.tex, kw: KinWord.fromCells(word.toUpperCase(), bw.cap / 0.72, bw.cells, { width: 62 }), cap: bw.cap };
      this.support.set(word, e);
    }
    return e;
  }
  private supportWord(t: number): { tex: THREE.DataTexture; kw: KinWord; cap: number; P: KinPose } | null {
    const line = this.ctx.lyrics.lineAt(t + 0.045) ?? this.ctx.lyrics.lastLine(t);
    if (!line) return null;
    const exitAt = this.clk.leave(line.end);
    if (t > exitAt + 0.2) return null;
    let w = null as (typeof line.words)[number] | null;
    for (const x of line.words) if (x.start - 0.045 <= t) w = x;
    if (!w) return null;
    const word = w.w.replace(/[^A-Za-z]/g, '');
    if (!word || this.heroes.some((h) => Math.abs(h.start - w!.start) < 1e-3)) return null;
    // a repeat of the hero being held (the second and third "never") is the hero itself, not a second word
    const [hk] = this.heroAt(t);
    if (hk >= 0 && this.heroes[hk]!.word.toLowerCase() === word.toLowerCase()) return null;
    const e = this.bakeSupport(word);
    const P = e.kw.pose(t, this.clk, {
      t0: w.start, spring: { stagger: 0.018, rise: 0.3, freq: 6 }, weight: { from: 300, to: 900, dur: 0.06 },
      track: { amt: 0.06 }, slide: { perBeat: [0.9, 0], from: line.start }, stretch: { kick: 0.08, snare: 0.08 },
      exit: { at: exitAt, kind: 'collapse', dur: 0.14 },
    });
    return { ...e, P };
  }

  private shotAt(t: number): Shot {
    let s = this.shots[0]!;
    for (const x of this.shots) if (x.t0 <= t + 1e-6) s = x;
    return s;
  }

  /** The hero word bitten in the apple at t (or -1). */
  private heroAt(t: number): [number] {
    for (let k = 0; k < this.heroes.length; k++) {
      const h = this.heroes[k]!;
      if (t >= h.cut && t < h.leave) return [k];
    }
    return [-1];
  }

  /** The hero's letters on the flank (kinetic.ts), chorus energy: each letter springs into the skin 20 ms after the
   *  last, the jaw pressing a hair past full depth and settling; the word STAMPS (lands 1.3x and settles, the frame
   *  shakes); light to heavy on the onset; wider on the kicks, condensed on the snares, tracking open on the beat.
   *  Per word: SWEET springs softer; PRETTY slides; DEVIL leans further on each beat (askew); HANDS tracks wide; NEVER
   *  re-stamps on each "never", condensing harder each time; GO lands biggest. */
  private heroPose(k: number, t: number): KinPose {
    const h = this.heroes[k]!;
    const after = h.appleAt > h.cut + 1e-3; // back from a slam: it springs in again on the cut
    const t0 = after ? h.appleAt : h.start;
    const m: Moves = {
      t0, lead: after ? 0 : h.start - h.cut,
      spring: { stagger: 0.02, freq: 5, damp: 0.36, rise: 0.12 },
      stamp: { at: h.hold ? h.reps.map((x) => Math.max(x - 0.045, h.cut)) : t0 - (after ? 0 : h.start - h.cut), over: 1.3 },
      weight: after ? undefined : { from: 300, to: 900, dur: 0.04 },
      stretch: { kick: 0.1, snare: 0.08 }, track: { amt: 0.05 },
    };
    const w = h.word.toLowerCase();
    if (w === 'sweet') { m.spring = { stagger: 0.025, freq: 4, damp: 0.45, rise: 0.15 }; m.stamp!.over = 1.15; m.stretch = { kick: 0.05, snare: 0.04 }; }
    if (w === 'pretty') m.slide = { perBeat: [-1.2, 0] };
    if (w === 'devil') m.lean = { perBeat: 0.13, max: 0.3, fan: 1, from: h.cut - 0.1 };
    if (w === 'hands') m.track = { amt: 0.16, hl: 0.12 };
    if (w === 'go') { m.stamp!.over = 1.45; m.stretch = { kick: 0.16, snare: 0.06 }; }
    const P = h.kw.pose(t, this.clk, m);
    if (h.hold) {
      // NEVER, NEVER, NEVER: each repeat condenses the word harder (pressure on the surface)
      const n = h.reps.filter((x) => x - 0.045 <= t).length;
      const c = [1, 1, 0.84, 0.7][Math.min(3, n)]!;
      const mid = (h.kw.glyphs[0]!.cx + h.kw.glyphs[h.kw.glyphs.length - 1]!.cx) / 2;
      for (const g of P.glyphs) { g.cx = mid + (g.cx - mid) * c; g.sx *= c; g.sy *= 1 + 0.5 * (1 - c); }
    }
    return P;
  }

  /** The camera and the flash for a shot at local progress u (0..1) through it. */
  private pose(s: Shot, u: number): { P: Pose; L: Light } {
    const h1 = hash(s.i, 1.7), h2 = hash(s.i, 5.3), h3 = hash(s.i, 9.1);
    const occ = this.shots.filter((x) => x.kind === s.kind && x.i < s.i).length;
    const B = BITE.C;
    let P: Pose, L: Light;
    const fill = (d: THREE.Vector3, f: number) => ({ fillDir: d.clone().normalize(), fill: f });
    const flashOn = (pos: THREE.Vector3, at: THREE.Vector3, I: number, rad = 5): Light => ({
      // the flash on the camera, a hand above the lens
      pos: pos.clone().addScaledVector(UP, 16), I, rad, ...fill(pos.clone().sub(at), 0.0),
    });
    switch (s.kind) {
      case 'wide': {
        // the exhibit: the lens perpendicular to the bite, the scale in its plane beside the apple; a hard flash on the
        // camera (a hand above and left of the lens), so the apple throws its shadow onto the velvet and the scale
        const at = BITE0.C.clone().addScaledVector(BITE0.T, 36 + 6 * (h1 - 0.5)).addScaledVector(BITE0.U, -4 + 4 * (h2 - 0.5));
        const pos = at.clone().addScaledVector(BITE0.N, 245 + 20 * h1).addScaledVector(BITE0.U, 10 * h3).addScaledVector(BITE0.T, -8 * h2);
        P = { pos, at, fov: 30, roll: (h3 - 0.5) * 0.06, aper: 2.5, focus: B };
        L = { ...flashOn(pos, at, s.i === 0 ? 1.35 : 1.15, 3), pos: pos.clone().addScaledVector(BITE0.U, 70).addScaledVector(BITE0.T, -85) };
        if (occ >= 3) {
          // the last exhibit shot: tighter, the apple alone, the bite and the small bitten word below it square to the lens
          const a2 = BITE0.C.clone().lerp(W2.C, 0.55);
          const p2 = a2.clone().addScaledVector(W2.N.clone().add(BITE0.N).normalize(), 118).addScaledVector(BITE0.T, -10);
          P = { pos: p2, at: a2, fov: 30, roll: 0.05, aper: 6, focus: W2.C };
          L = { ...flashOn(p2, a2, 1.1, 3), pos: p2.clone().addScaledVector(BITE0.U, 50).addScaledVector(BITE0.T, -60) };
        }
        break;
      }
      case 'oblique': {
        // the whole exhibit from above at 3/4, each time from a different side and height
        const o = [[-0.62, 0.5, 265], [0.2, 0.8, 310], [-0.3, 0.3, 225]][occ % 3]!;
        const at = AC.clone().add(V(0, 0, 0));
        const pos = at.clone().addScaledVector(dirAz(LAY.BAZ + o[0]! + 0.12 * (h1 - 0.5), o[1]! + 0.06 * (h2 - 0.5)), o[2]! + 20 * h3);
        P = { pos, at, fov: 26, roll: (h2 - 0.5) * 0.15, aper: 5, focus: B };
        L = flashOn(pos, at, 0.85);
        break;
      }
      case 'ruler': {
        // grazing along the scale's foot from its far end: the millimetre ticks recede to the corner, the bitten apple
        // soft beyond it
        // (then down the upright from its top end; then square on its grey patches and ticks, the apple soft beside)
        const sp = (u: number, v: number, n = 0) => SO.clone().addScaledVector(BITE0.T, u).addScaledVector(BITE0.U, v).addScaledVector(BITE0.N, n);
        let at = sp(-14, 12 + 6 * h2), pos = sp(128 + 14 * h1, 7 + 5 * h3, 24 + 10 * h2), focus = sp(50, 9);
        if (occ % 3 === 1) { at = sp(-10, -6); pos = sp(10 + 4 * h1, 132 + 12 * h3, 26 + 8 * h2); focus = sp(9, 55); }
        else if (occ % 3 === 2) { const g = sp(14, 38); at = sp(-2, 40 + 6 * h2); pos = g.clone().addScaledVector(BITE0.N, 62 + 10 * h3).addScaledVector(BITE0.T, 34).addScaledVector(BITE0.U, -12); focus = g; }
        P = { pos, at, fov: 30, roll: (h3 - 0.5) * 0.15, aper: 16, focus };
        L = flashOn(pos, at, 0.9, 8);
        break;
      }
      case 'profile': {
        // the bite in profile: its crescent cut out of the outline, the flash raking across its wall
        // (each time another height: level, from high above the shoulder, low on the cloth's horizon)
        const o = [[-1.45, 0.06, 170], [-1.4, 0.62, 190], [-1.2, -0.03, 215]][occ % 3]!;
        const at = B.clone().addScaledVector(BITE.N, -10).add(V(0, 2, 0));
        const pos = at.clone().addScaledVector(dirAz(LAY.BAZ + o[0]! + 0.25 * (h1 - 0.5), o[1]! + 0.1 * h3), o[2]! + 30 * h2);
        P = { pos, at, fov: 20, roll: 0, aper: 10, focus: B };
        L = { pos: at.clone().addScaledVector(dirAz(LAY.BAZ - 0.6, 0.5), 300), I: 1.1, rad: 12, ...fill(pos.clone().sub(at), 0.03) };
        break;
      }
      case 'macro': {
        // macro on the bitten rim at 3/4: the incisors' scallops and their grooves down the wall
        // (each time from elsewhere: 3/4 from the left, from above into the scoop, low from the side along the rim)
        const o = [[-0.75, 0.32, -2, 90], [-0.15, 0.85, 6, 80], [-1.15, 0.1, -9, 100]][occ % 3]!;
        const at = onF(BITE, o[2]! + 4 * (h1 - 0.5), LAY.SCY + 5 + 3 * h2, -4);
        const pos = at.clone().addScaledVector(dirAz(LAY.BAZ + o[0]! + 0.3 * (h3 - 0.5), o[1]! + 0.1 * (h1 - 0.5)), o[3]!);
        P = { pos, at, fov: 22, roll: (h2 - 0.5) * 0.2, aper: 30, focus: at };
        L = flashOn(pos, at, 0.9, 8);
        break;
      }
      case 'corner': {
        // the scale's corner target (its ringed dot) sharp in the foreground, the bite soft above and beyond it
        // (each time another of its three targets: the corner, the top of the upright, the end of the foot by the label)
        const o = [[9, 9, -16, 10, 26, -18], [9, LAY.SL - 9, -18, -16, 22, 14], [LAY.SL - 9, 9, -22, 8, 8, -16]][occ % 3]!;
        const tg = SO.clone().addScaledVector(BITE0.T, o[0]!).addScaledVector(BITE0.U, o[1]!);
        const at = tg.clone().addScaledVector(BITE0.T, o[2]!).addScaledVector(BITE0.U, o[3]!);
        const pos = tg.clone().addScaledVector(BITE0.N, 72 + 14 * h3).addScaledVector(BITE0.T, o[4]! + 10 * h1).addScaledVector(BITE0.U, o[5]! + 10 * h2);
        P = { pos, at, fov: 30, roll: (h1 - 0.5) * 0.2, aper: 22, focus: tg };
        L = flashOn(pos, at, 0.9, 8);
        break;
      }
      case 'chip': {
        // extreme macro on his chip: the chipped letter of the word bitten in, or #8's notch in the bite's rim
        const hk = this.heroAt(s.t0 + 0.02)[0];
        if (hk >= 0) {
          const c = this.heroes[hk]!.chip;
          // (close enough that the chipped letter and its neighbours fill the frame, the notch at its corner)
          const at = onF(WORDF, c[0] - 6.0, c[1] - 2.2, -1.4);
          const pos = at.clone().addScaledVector(dirAz(LAY.WAZ + 0.75, 0.08), 30);
          P = { pos, at, fov: 32, roll: 0.06, aper: 9, focus: onF(WORDF, c[0] + 0.5, c[1] - 0.5, -1.0) };
          L = { pos: pos.clone().addScaledVector(UP, 8).addScaledVector(WORDF.T, 20), I: 2.4, rad: 4, ...fill(pos.clone().sub(at), 0.05), coat: 0.1 };
        } else {
          const at = onF(BITE, this.c8[0], this.c8[1], -2);
          const pos = at.clone().addScaledVector(dirAz(LAY.BAZ - 0.6, 0.45), 45);
          P = { pos, at, fov: 20, roll: (h2 - 0.5) * 0.12, aper: 45, focus: at };
          L = flashOn(pos, at, 0.85);
        }
        break;
      }
      case 'rake':
      default: {
        // the hero frame: a 3/4 macro on the flank where the word is bitten out, the skin curving away, a hard flash
        // beside the lens so each cavity's walls take light on one side; each hero its own angle (HERO_V), sized so the
        // word spans about half the frame. A held hero's later photographs pull back a step a beat (NEVER_V).
        const hk = s.hero >= 0 ? s.hero : this.heroAt(s.t0 + 0.02)[0];
        const v = HERO_V[hk] ?? HERO_V[1]!;
        const H = this.heroes[hk];
        const keep = hk === 1 || hk === 3 || !H;
        let daz = v.daz, el = v.el, roll = v.roll;
        // (the frame is 0.853 d wide at 27 degrees: d = 2.34 w cos(daz) puts the word at ~half of it)
        let d = keep ? 58 : Math.max(42, H!.width * Math.cos(daz) * 2.34);
        const nv = s.sub > 0 ? NEVER_V[Math.min(s.sub, NEVER_V.length) - 1]! : null;
        if (nv) { daz = nv.daz; el = nv.el; roll = nv.roll; d = nv.d; }
        const back = clamp((d - 60) / 200);
        const at = onF(WORDF, v.ax, 0.5, -2.0).lerp(AC.clone().add(V(0, 4, 0)), 0.75 * back);
        const pos = at.clone().addScaledVector(dirAz(LAY.WAZ + daz + 0.05 * (h1 - 0.5), el + 0.03 * h2), d);
        P = { pos, at, fov: 27, roll: roll + (h3 - 0.5) * 0.05, aper: 22 * Math.min(1, 58 / d), focus: onF(WORDF, 0, 0, -0.6) };
        L = { pos: pos.clone().addScaledVector(UP, v.fU + 0.15 * (d - 58)).addScaledVector(WORDF.T, v.fT), I: 2.0 - 0.9 * back, rad: 3 + 4 * back, ...fill(pos.clone().sub(at), 0.06), coat: 0.6 * back };
        break;
      }
    }
    // each line its own camera move through its photographs: line 1 dollies in, line 2 tracks sideways, line 3 arcs
    // round the apple, line 4 pulls back and up (all eased so they settle into the next flash)
    const e = ease.inOutCubic(clamp(u));
    let push = 0.035 * ease.outCubic(clamp(u));
    const off = P.pos.clone().sub(P.at);
    P.at = P.at.clone();
    if (s.line === 0) push += 0.04 * e;
    else if (s.line === 1) {
      const r = new THREE.Vector3().crossVectors(off, UP).normalize().multiplyScalar(off.length() * 0.025 * (2 * e - 1));
      P.pos = P.pos.clone().add(r); P.at.add(r);
    } else if (s.line === 2) P.pos = P.at.clone().add(off.applyAxisAngle(UP, 0.07 * (2 * e - 1)));
    else { push -= 0.06 * e; P.pos = P.pos.clone().addScaledVector(UP, off.length() * 0.03 * e); }
    P.pos = P.pos.clone().lerp(P.at, push);
    return { P, L };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer } = this.ctx;
    const s = this.shotAt(t);
    if (s.kind === 'slam') {
      const sl = this.slams.find((x) => Math.abs(x.t0 - s.t0) < 1e-3);
      if (sl) return this.renderSlam(sl, t, out);
    }
    const u = (t - s.t0) / Math.max(1e-3, s.t1 - s.t0);
    const { P, L } = this.pose(s, u);
    const qc = qv('cam');
    if (qc) { P.pos.set(qc[0]!, qc[1]!, qc[2]!); P.at.set(qc[3]!, qc[4]!, qc[5]!); P.fov = qc[6] ?? P.fov; }
    const fw = P.at.clone().sub(P.pos).normalize();
    let rt = new THREE.Vector3().crossVectors(fw, UP);
    if (rt.lengthSq() < 1e-6) rt = V(1, 0, 0);
    rt.normalize();
    let up = new THREE.Vector3().crossVectors(rt, fw);
    if (P.roll) { rt = rt.clone().applyAxisAngle(fw, P.roll); up = up.clone().applyAxisAngle(fw, P.roll); }
    const m = this.march.u;
    (m.camPos!.value as THREE.Vector3).copy(P.pos);
    (m.camF!.value as THREE.Vector3).copy(fw);
    (m.camR!.value as THREE.Vector3).copy(rt);
    (m.camU!.value as THREE.Vector3).copy(up);
    m.tanH!.value = Math.tan((P.fov * Math.PI) / 360);
    // the flash: the shutter fires on the cut; the head's output overshoots and settles into the photograph
    const burst = pulse(t, s.t0, 0.02);
    (m.keyPos!.value as THREE.Vector3).copy(L.pos);
    // L.I is the irradiance at the subject: the head sits wherever the shot needs it, inverse-square beyond
    m.keyI!.value = (L.I * L.pos.distanceToSquared(P.at)) / 1e5 * (1 + 0.8 * burst);
    m.keyRad!.value = L.rad;
    (m.keyDir!.value as THREE.Vector3).copy(P.at.clone().sub(L.pos).normalize());
    m.keyCone!.value = L.cone ?? 0.8;
    (m.fillDir!.value as THREE.Vector3).copy(L.fillDir);
    m.fillI!.value = L.fill;
    m.coatK!.value = L.coat ?? 1;
    const [hk] = this.heroAt(t);
    let shake = 0;
    m.wordTex!.value = hk >= 0 ? this.heroes[hk]!.tex : this.empty;
    m.wordWax!.value = hk >= 0 && this.heroes[hk]!.wax ? 1 : 0;
    m.kwN!.value = 0;
    if (hk >= 0 && t >= this.heroes[hk]!.appleAt - 1e-4) {
      const h = this.heroes[hk]!, P = this.heroPose(hk, t);
      packKin(h.kw, P, h.cap, 0, this.pk);
      setKinUniforms(this.pk, m.kwA!.value, m.kwB!.value, m.kwC!.value);
      m.kwN!.value = Math.min(KIN_MAX, h.kw.glyphs.length);
      shake = P.shake * (h.word.toLowerCase() === 'sweet' ? 4 : 10);
    }
    // the line's other words, one at a time as sung, bitten small and shallow below the bite (the hero is elsewhere)
    const sw = this.supportWord(t);
    m.word2Tex!.value = sw ? sw.tex : this.empty;
    m.k2N!.value = 0;
    if (sw) {
      packKin(sw.kw, sw.P, sw.cap, 0, this.pk);
      setKinUniforms(this.pk, m.k2A!.value, m.k2B!.value, m.k2C!.value);
      m.k2N!.value = Math.min(KIN_MAX, sw.kw.glyphs.length);
    }
    this.march.render(renderer, this.rt);

    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = P.focus.clone().sub(P.pos).dot(fw);
    d.aper!.value = qv('aper')?.[0] ?? P.aper;
    this.dof.render(renderer, out);
    // the flash reaches the film as an exposure kick (multiplicative: the blacks stay black)
    const kick = s.i === 0 ? 0.7 * pulse(t, s.t0, 0.045) : 0.25 * pulse(t, s.t0, 0.025);
    return { exposure: 1 + kick, halation: 0.04, shake: kinShake(t, shake) };
  }

  /** A full-frame slam (kinetic.ts): flat palette fills in Archivo 900, no outlines or halos, taking the plate's post.
   *  DIRTY: lightbox on film, wide (width 112), its letters springing up from below 22 ms apart, stamped 1.22x; it
   *  stretches on the kick and condenses on the snare. TEETH, the hook's first statement: film-black Archivo 62/900
   *  stretched tall on a stone-yellow field (the apple's, the cast's colour), inverted punch frames, stamped 1.3x;
   *  on the 8th note a scalloped bite (his arch: one tooth-width scallop per tooth, #8's chipped) breaks a piece out
   *  of the word and it flies off. The next flash cuts back to the apple. */
  private renderSlam(sl: Slam, t: number, out: THREE.WebGLRenderTarget): PostOverrides {
    const c = this.L.ctx, au = this.ctx.audio;
    const punch = sl.teeth && t < sl.t0 + 0.05;
    const field = sl.teeth ? (punch ? 'film' : 'stone') : 'film';
    const ink = sl.teeth ? (punch ? 'stone' : 'film') : 'lightbox';
    this.L.clear(trgba(field));
    c.textBaseline = 'alphabetic';
    const kw = sl.kw;
    // TEETH stands tall: its cap height ~690 px at rest, ~830 px at the stamp's peak (inside title safe)
    const tall = sl.teeth ? Math.min(1.8, 690 / (0.686 * kw.style.size)) : 1.0;
    const cap = kw.style.size * 0.686 * tall;
    const base = FH / 2 + cap / 2;
    const x = (FW - kw.width) / 2;
    const P = kw.pose(t, this.clk, {
      t0: sl.land, lead: sl.land - sl.t0,
      spring: { stagger: sl.teeth ? 0.018 : 0.022, freq: 5.5, damp: 0.4, rise: sl.teeth ? 0.45 : 0.7 },
      stamp: { at: sl.t0, over: 1.2 },
      stretch: sl.teeth ? { kick: 0.25, snare: 0 } : { kick: 0.1, snare: 0.12 },
      weight: sl.teeth ? undefined : { from: 500, to: 900, dur: 0.05 },
      track: { amt: 0.03 },
    });
    if (tall !== 1) for (const g of P.glyphs) g.sy *= tall;
    let brk;
    let shake = P.shake * (sl.teeth ? 22 : 16);
    if (sl.teeth) {
      // the bite: on the 8th after the slam
      const tb = au.timeOfBeat(au.beatAt(sl.t0) + 0.5);
      // (the bitten piece is snatched out of frame in ~3 frames; the rest of the word jolts and holds, bitten)
      const k = clamp((t - tb) / 0.1);
      if (t >= tb) {
        const bx = x + kw.width * 0.97, by = base - cap * 1.05;
        brk = { mask: this.biteMask(bx, by, cap * 0.42), k: ease.outCubic(k), a: { dx: 1400, dy: -900, rot: 0.6 }, b: { dx: -26, dy: 18, rot: -0.012 }, pivot: [bx, by] as [number, number] };
        shake += 14 * pulse(t, tb, 0.05);
      }
    }
    drawKin(c, kw, P, x, base, { fill: trgba(ink), brk });
    this.L.upload();
    this.ctx.comp.draw(this.ctx.renderer, this.L.texture, out, { mode: 'replace' });
    return { exposure: 1, halation: 0, shake: kinShake(t, shake), zoom: 1 + 0.03 * P.shake }; // no halation: a slam is never haloed
  }

  /** His bite as a break mask: a crescent bitten from the upper right, its rim a row of tooth-width scallops (convex
   *  arcs meeting in points, as incisal edges leave them), #8's scallop flattened at one corner (the chip). */
  private biteMask(cx: number, cy: number, R: number): Path2D {
    const p = new Path2D();
    const N = 7, a0 = Math.PI * 0.35, a1 = Math.PI * 1.25; // the rim facing the word (lower left)
    const pts: [number, number][] = [];
    for (let j = 0; j <= 280; j++) {
      const a = lerp(a0, a1, j / 280);
      const u = ((a - a0) / (a1 - a0)) * N, k = Math.floor(Math.min(u, N - 1e-6)), f = u - k;
      let bulge = Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
      if (k === 3 && f < 0.45) bulge = Math.min(bulge, 0.35 + f); // #8: the chipped corner
      const r = R * (1 + 0.075 * bulge);
      pts.push([cx + r * Math.cos(a) * 1.25, cy + r * Math.sin(a)]);
    }
    p.moveTo(cx + 3 * R * Math.cos(a0), cy + 3 * R * Math.sin(a0));
    for (const [px, py] of pts) p.lineTo(px, py);
    p.lineTo(cx + 3 * R * Math.cos(a1), cy + 3 * R * Math.sin(a1));
    p.lineTo(cx + 3 * R, cy - 3 * R);
    p.closePath();
    return p;
  }
}
