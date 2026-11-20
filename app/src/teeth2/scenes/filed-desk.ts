// Plate 14 `filed`, part 1 (174.77 – 186.85): inside folder 08-32. The folder lies open on a bench in the one cold
// pool the fitting throws, his three exhibits stacked beside it. On each TEETH the glove lifts the top exhibit off the
// stack and holds it face-on to the lens, the word set huge across it in black condensed Archivo (light snapping to
// heavy on the onset) with the red T.F. beside it; on the next kick it slides the exhibit into the folder:
//  - his radiograph, swung up past the tube so it is backlit (bright teeth on a film-black base), shot from below;
//  - the photograph of his cast on a white card (TEETH black on a light ground), shot from above the front;
//  - his full chart (#8 ringed), shot from above the right.
// Then the far panel swings over them and closes slowly through the line; the glove writes "Never, never, never ever
// let go" on the back of its tab, GO the hero; the chart's red T.F., in the closing wedge, drains as the panel shuts.
// Pure functions of t; the times are read from the analysed beats, kicks and the lyric (see filed.ts).
import * as THREE from 'three';
import { clamp, ease, lerp } from '../../engine/util';
import { F, font } from '../../engine/type';
import { strokeText, drawStrokeText, writtenLength, type StrokeText } from '../../engine/stroke';
import { drawMonogram, MONOGRAM, MONO_H } from '../monogram';
import { DESK } from './filed-glsl';

export type V3 = THREE.Vector3;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export interface Shot { t0: number; t1: number; a: CamPose; b: CamPose }
export interface CamPose { pos: V3; at: V3; fov: number; aper: number; up?: V3 }

/** The script's times, all from the data (filed.ts fills them in). */
export interface DeskTimes {
  /** beat k of the plate (k = 0 is the 174.77 downbeat) */
  b: (k: number) => number;
  /** the three TEETH onsets */
  teeth: [number, number, number];
  /** the kick nearest t */
  kickNear: (t: number) => number;
  /** the line's LET and GO onsets */
  letT: number; go: number;
}

/** Per exhibit: lift off the stack, face-on (held), slide into the folder (kick), landed. Plus the cuts. */
export interface ExTimes { l0: number; l1: number; s0: number; s1: number; cut: number }
export function exTimes(T: DeskTimes): ExTimes[] {
  const { b, teeth, kickNear } = T;
  return [
    { l0: b(0) + 0.1, l1: teeth[0] + 0.14, s0: kickNear(b(6)), s1: kickNear(b(6)) + 0.32, cut: kickNear(teeth[0]) },
    { l0: b(8), l1: teeth[1] + 0.14, s0: kickNear(b(14)), s1: kickNear(b(14)) + 0.32, cut: kickNear(teeth[1]) },
    { l0: b(15), l1: teeth[2] + 0.12, s0: kickNear(b(19)), s1: kickNear(b(19)) + 0.22, cut: kickNear(teeth[2]) },
  ];
}

// ------------------------------------------------------------------------------------------- the exhibits
/** Half sizes (m): the radiograph (a panoramic film, 244 x 128 mm), the cast's print, his chart (the A3 form at 0.786). */
export const EX_S: [number, number][] = [[0.122, 0.064], [0.1, 0.074], [0.165, 0.106]];

export interface ExPose { c: V3; x: V3; y: V3; on: boolean }
interface QPose { c: V3; q: THREE.Quaternion }

const qOf = (x: V3, y: V3) => {
  const n = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
};
const flat = (c: V3, yaw: number): QPose => {
  // face up, its top toward the fold (it reads upright from the front)
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  return { c, q: qOf(v3(cy, 0, -sy), v3(-sy, 0, -cy)) };
};
/** The stack beside the folder (the chart at the bottom, the radiograph on top) and the exhibits' places in it. */
const STACK = (i: number) => flat(v3(0.36 + [0.004, -0.006, 0.0][i]!, 0.0006 + 0.0011 * (2 - i), 0.07 + [0.006, -0.004, 0.0][i]!), [0.05, -0.04, 0.02][i]!);
const FOLDED = (i: number) => flat(v3([0.004, -0.01, 0.002][i]!, DESK.YN + 0.0005 + 0.0011 * i, [0.118, 0.12, 0.113][i]!), [0.03, -0.035, -0.012][i]!);

/** The face-on shots: the exhibit's centre, the direction to the lens, the lens distance, the fov. */
export const FACE: { c: V3; dir: V3; d: number; fov: number }[] = [
  // the radiograph high under the tube, the lens below it looking up: the tube lights it from behind
  { c: v3(0.06, 0.36, 0.12), dir: v3(0, -0.3, 0.14).normalize(), d: 0.37, fov: 34 },
  // the cast's print over the folder, the lens above the front
  { c: v3(0.02, 0.2, 0.12), dir: v3(0, 0.7, 0.72).normalize(), d: 0.375, fov: 30 },
  // the chart, the lens above the right
  { c: v3(-0.02, 0.17, 0.08), dir: v3(0.5, 0.75, 0.45).normalize(), d: 0.62, fov: 30 },
];
const facePose = (i: number): QPose => {
  const f = FACE[i]!;
  const fw = f.dir.clone().negate();
  const rt = new THREE.Vector3().crossVectors(fw, v3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(rt, fw);
  return { c: f.c.clone(), q: qOf(rt, up) };
};

function mixQ(a: QPose, b: QPose, u: number, arc: number): QPose {
  const c = a.c.clone().lerp(b.c, u);
  c.y += arc * Math.sin(Math.PI * u);
  return { c, q: a.q.clone().slerp(b.q, u) };
}
const toEx = (p: QPose, on = true): ExPose => ({ c: p.c, x: v3(1, 0, 0).applyQuaternion(p.q), y: v3(0, 1, 0).applyQuaternion(p.q), on });

/** Exhibit i's pose at t, as a QPose. */
function exQ(i: number, t: number, X: ExTimes[]): QPose {
  const e = X[i]!;
  if (t <= e.l0) return STACK(i);
  if (t <= e.l1) {
    const u = (t - e.l0) / (e.l1 - e.l0);
    // up off the stack first, then turned to the lens, decelerating through the cut (the radiograph is lifted slowly
    // in the pool, then swung up under the tube)
    return mixQ(STACK(i), facePose(i), i === 0 ? ease.inOutCubic(u ** 1.6) : ease.outCubic(u), i === 0 ? 0.05 : 0.07);
  }
  if (t <= e.s0) {
    const p = facePose(i);
    // held: the hand's small drift
    p.c.y += 0.0015 * Math.sin((t - e.l1) * 3.1);
    p.c.x += 0.001 * Math.sin((t - e.l1) * 2.3);
    return p;
  }
  if (t <= e.s1) return mixQ(facePose(i), FOLDED(i), ease.inOutCubic((t - e.s0) / (e.s1 - e.s0)), 0.02);
  return FOLDED(i);
}

export function exhibits(t: number, X: ExTimes[]): ExPose[] {
  return [0, 1, 2].map((i) => toEx(exQ(i, t, X)));
}

/** The glove (filed.ts hands it to the shader): the pen tip (the hand frame's origin) and its frame, all world (m). */
export interface HandPose { tip: V3; e1: V3; e2: V3; e3: V3; pen: boolean }
/** A pinch at a card's corner (GLSL_HAND's grip with the pen gone: the card's edge lies along the pen's axis between
 *  the thumb pad and the middle finger, under the index): `along` from the corner outward along the edge (the arm's
 *  way), `up` from the edge away from the card. */
export function pinch(corner: V3, along: V3, up: V3, inset = 0.047): HandPose {
  const e1 = along.clone().normalize(), e3 = up.clone().normalize();
  const e2 = new THREE.Vector3().crossVectors(e1, e3);
  const tip = corner.clone().addScaledVector(e1, -inset).addScaledVector(e3, -0.003).addScaledVector(e2, -0.001);
  return { tip, e1, e2, e3, pen: false };
}
/** The pen's frame for a nib at `nib`: e1 up the pen (heading in the xz plane, tilt above it), e3 up from it. */
export function penFrame(nib: V3, heading: number, tilt: number): HandPose {
  const c = Math.cos(tilt);
  const e1 = v3(Math.cos(heading) * c, Math.sin(tilt), Math.sin(heading) * c).normalize();
  const e3 = v3(0, 1, 0).addScaledVector(e1, -e1.y).normalize();
  const e2 = new THREE.Vector3().crossVectors(e1, e3);
  return { tip: nib.clone(), e1, e2, e3, pen: true };
}

/** The glove holding exhibit i at its top right corner (null outside its reach-in .. withdraw). */
function exHand(i: number, t: number, X: ExTimes[]): HandPose | null {
  const e = X[i]!;
  const tin = i === 0 ? 0.28 : 0.35, tout = i === 2 ? 0.1 : 0.3;
  if (t < e.l0 - tin || t > e.s1 + tout) return null;
  const tt = clamp(t, e.l0, e.s1);
  const p = toEx(exQ(i, tt, X));
  const [sx, sy] = EX_S[i]!;
  const corner = p.c.clone().addScaledVector(p.x, sx).addScaledVector(p.y, sy);
  const h = pinch(corner, p.x, p.y);
  // reaching in from, and withdrawing to, outside the frame along the arm, rising
  const k = t < e.l0 ? 1 - ease.outCubic((t - (e.l0 - tin)) / tin) : t > e.s1 ? ease.inCubic((t - e.s1) / tout) : 0;
  if (k > 0) h.tip.addScaledVector(h.e1, 0.3 * k).add(v3(0, 0.14 * k, 0));
  return h;
}

/** F, the far panel: open until the chart is in, swings over on the kick (to ~165 deg by the 183.40 downbeat, a
 *  wedge open over the exhibits), closes slowly through the line, shuts on "go". */
export function phiF(t: number, T: DeskTimes, X: ExTimes[]) {
  const { b, go } = T;
  const s = X[2]!.s0 + 0.03, a = 2.88, c = 2.98;
  if (t <= s) return 0;
  if (t <= b(20)) return a * ease.inOutCubic((t - s) / (b(20) - s));
  if (t <= b(24)) return lerp(a, c, ease.inOutQuad((t - b(20)) / (b(24) - b(20))));
  if (t <= go) return lerp(c, Math.PI, ease.inQuad((t - b(24)) / (go - b(24))));
  return Math.PI - 0.012 * Math.exp(-(t - go) * 18) * Math.abs(Math.sin((t - go) * 40));
}

/** The tab's back (the lyric's surface) at panel angle phi: insert mm (x right, y down) to world, and its normal. */
export function tabPoint(phi: number, xmm: number, ymm: number) {
  const vF = v3(0, Math.sin(phi), -Math.cos(phi));
  const gx = (xmm / (DESK.INSW * 2000) - 0.5) * 2 * DESK.INSW, gy = (ymm / (DESK.INSH * 2000) - 0.5) * 2 * DESK.INSH;
  const p = v3(DESK.TABX + gx, DESK.YF, 0).addScaledVector(vF, DESK.PH + DESK.TAB0 + DESK.TABH + gy);
  const n = v3(0, -Math.cos(phi), -Math.sin(phi));
  return { p, n };
}

/** The glove at t (one hand: the exhibits in turn, then the pen on the tab). */
export function deskHand(t: number, T: DeskTimes, X: ExTimes[], lyr: TabLyric): HandPose | null {
  const penIn = X[2]!.s1 + 0.1;
  if (t >= penIn) {
    const nb = lyr.nib(t);
    const phi = phiF(t, T, X);
    const tp = tabPoint(phi, nb.x, nb.y);
    // lifts between words; comes in from the right before the line and leaves after GO
    const pre = 1 - ease.outCubic(clamp((t - penIn) / Math.max(0.05, lyr.t0 - 0.05 - penIn)));
    const post = ease.inCubic(clamp((t - lyr.t1 - 0.05) / 0.4));
    const lift = 0.0008 + nb.lift * 0.001 + 0.12 * (pre + post);
    const nib = tp.p.addScaledVector(tp.n, lift).add(v3(0.25 * (pre + post), 0, 0.05 * (pre + post)));
    // the wrist pivots a little as the pen travels along the line
    return penFrame(nib, -0.6 + (nb.x - 50) * 0.0025, 1.0);
  }
  for (let i = 2; i >= 0; i--) { const h = exHand(i, t, X); if (h) return h; }
  return null;
}

// ------------------------------------------------------------------------------------------- the camera
const P = (pos: V3, at: V3, fov: number, aper = 10, up?: V3): CamPose => ({ pos, at, fov, aper, up });
const faceShot = (i: number, t0: number, t1: number, aper = 9): Shot => {
  const f = FACE[i]!;
  return { t0, t1, a: P(f.c.clone().addScaledVector(f.dir, f.d * 1.05), f.c.clone(), f.fov, aper), b: P(f.c.clone().addScaledVector(f.dir, f.d * 0.95), f.c.clone(), f.fov, aper) };
};

export function deskShots(T: DeskTimes, X: ExTimes[]): Shot[] {
  const { b, kickNear } = T;
  const k22 = kickNear(b(22)), cutLet = kickNear(T.letT - 0.12);
  // LET GO on the shut tab: the push-in's target and its lens direction (above the front)
  const lg = tabPoint(Math.PI, 57, 14).p, dLG = v3(-0.3, 0.8, 0.52).normalize();
  return [
    // the open folder and the stack in the pool, high from the front right: the glove lifts the radiograph
    { t0: b(0), t1: X[0]!.cut, a: P(v3(0.3, 0.36, 0.66), v3(0.14, 0.05, 0.03), 40, 8), b: P(v3(0.34, 0.3, 0.86), v3(0.12, 0.17, 0.06), 44, 8) },
    // under it, the tube behind it: TEETH
    faceShot(0, X[0]!.cut, X[0]!.s0, 8),
    // low from the left: the radiograph slides into the folder, the cast's print lifts
    { t0: X[0]!.s0, t1: X[1]!.cut, a: P(v3(-0.46, 0.27, 0.36), v3(0.06, 0.06, 0.04), 38, 8), b: P(v3(-0.42, 0.25, 0.42), v3(0.08, 0.1, 0.06), 38, 8) },
    faceShot(1, X[1]!.cut, X[1]!.s0),
    // low from the right, across the stack: the print slides in, the chart lifts
    { t0: X[1]!.s0, t1: X[2]!.cut, a: P(v3(0.7, 0.26, 0.05), v3(0.08, 0.04, 0.06), 38, 8), b: P(v3(0.66, 0.25, 0.1), v3(0.08, 0.08, 0.07), 38, 8) },
    faceShot(2, X[2]!.cut, X[2]!.s0),
    // high from the front left: the chart slides in, the far panel swings over
    { t0: X[2]!.s0, t1: b(20), a: P(v3(-0.22, 0.44, 0.64), v3(0.0, 0.03, 0.06), 36, 8), b: P(v3(-0.2, 0.4, 0.58), v3(-0.03, 0.04, 0.12), 36, 8) },
    // the tab and the wedge under it (the red T.F. draining): NEVER, NEVER
    { t0: b(20), t1: k22, a: P(v3(-0.2, 0.28, 0.47), v3(-0.11, 0.04, 0.22), 28, 11), b: P(v3(-0.19, 0.26, 0.45), v3(-0.11, 0.04, 0.225), 28, 11) },
    // the whole line on the tab: NEVER EVER
    { t0: k22, t1: cutLet, a: P(v3(-0.15, 0.2, 0.36), v3(-0.105, 0.045, 0.24), 26, 12), b: P(v3(-0.145, 0.19, 0.35), v3(-0.105, 0.045, 0.24), 26, 12) },
    // in on LET GO
    { t0: cutLet, t1: b(28), a: P(lg.clone().addScaledVector(dLG, 0.135), lg.clone(), 22, 12), b: P(lg.clone().addScaledVector(dLG, 0.098), lg.clone(), 22, 12) },
  ];
}

export function shotPose(shots: Shot[], t: number): CamPose {
  let s = shots[0]!;
  for (const x of shots) if (t >= x.t0) s = x;
  const u = ease.inOutQuad(clamp((t - s.t0) / (s.t1 - s.t0)));
  return {
    pos: s.a.pos.clone().lerp(s.b.pos, u), at: s.a.at.clone().lerp(s.b.at, u),
    fov: lerp(s.a.fov, s.b.fov, u), aper: lerp(s.a.aper, s.b.aper, u), up: s.a.up,
  };
}

// ------------------------------------------------------------------------------------------- canvases
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/** TEETH across an exhibit (R heavy, G light: the same letter centres, so nothing reflows on the snap) and the
 *  monogram (B), a third of TEETH's cap height, a heavy stroke. */
export function overlay(i: number): HTMLCanvasElement {
  const [sx, sy] = EX_S[i]!;
  const cw = 2048, ch = Math.round((cw * sy) / sx);
  const cv = mk(cw, ch);
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, cw, ch);
  c.globalCompositeOperation = 'lighter';
  // [left, right, baseline] of TEETH in canvas fractions; the monogram right of the word (or under it, for the chart:
  // it then sits near the folder's open edge, in the closing wedge)
  const L = ([[0.05, 0.72, 0.7], [0.06, 0.74, 0.31], [0.05, 0.72, 0.74]] as const)[i]!;
  const [x0, x1, base] = L;
  const heavy = F.archivo(62, 900), light = F.archivo(62, 300);
  const word = 'TEETH';
  let size = 400;
  c.font = font(heavy, size);
  const w0 = c.measureText(word).width;
  size = (size * (x1 - x0) * cw) / w0;
  c.font = font(heavy, size);
  const cap = c.measureText('T').actualBoundingBoxAscent;
  const adv = [...word].map((ch2) => c.measureText(ch2).width);
  const tot = adv.reduce((a, b2) => a + b2, 0);
  let x = x0 * cw + ((x1 - x0) * cw - tot) / 2;
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  [...word].forEach((ch2, k) => {
    const cx = x + adv[k]! / 2;
    c.font = font(heavy, size); c.fillStyle = 'rgb(255,0,0)'; c.fillText(ch2, cx, base * ch);
    c.font = font(light, size); c.fillStyle = 'rgb(0,255,0)'; c.fillText(ch2, cx, base * ch);
    x += adv[k]!;
  });
  const mh = cap * 0.36, ms = mh / MONO_H;
  // (the chart's sits by its near edge, right of the tab: it shows in the closing wedge while it drains)
  const mx = i === 2 ? 0.42 * cw : x1 * cw + cw * 0.025;
  const my = i === 2 ? 0.955 * ch - mh : base * ch - mh;
  drawMonogram(c, MONOGRAM.length, { x: mx, y: my, size: ms, width: ms * 0.075, color: 'rgb(0,0,255)' });
  return cv;
}

/** Plate 1's tab insert, typed the same way (drawer.ts), ink in alpha. */
export function labelCanvas(): HTMLCanvasElement {
  const LABEL = '08-32 · BITE MARK';
  const cw = 2048, ch = Math.round((2048 * DESK.INSH) / DESK.INSW);
  const cv = mk(cw, ch);
  const c = cv.getContext('2d')!;
  c.clearRect(0, 0, cw, ch);
  const fam = F.mono(500);
  let size = 200;
  c.font = font(fam, size);
  size = (size * cw * 0.9) / c.measureText(LABEL).width;
  c.font = font(fam, size);
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillText(LABEL, cw / 2, ch * (1 - 0.52) + (size * 0.7) / 2);
  return cv;
}

export interface LyrWord { w: string; start: number; end: number }
interface Row { st: StrokeText; words: number[]; x: number; y: number; pen: number; times: [number, number][] }
interface WordSpan { row: number; a: number; b: number; l0: number; l1: number }

/** The point at written length `len` of a stroke text (its pen head). */
function headAt(st: StrokeText, len: number): { x: number; y: number } {
  let last = st.strokes[0]?.[0] ?? { x: 0, y: 0 };
  for (let i = 0; i < st.strokes.length; i++) {
    const s0 = st.startLen[i]!, pts = st.strokes[i]!, L = st.lens[i]!;
    if (s0 > len) break;
    const r = len - s0;
    for (let j = 1; j < pts.length; j++) {
      if (L[j]! >= r) {
        const u = (r - L[j - 1]!) / Math.max(1e-6, L[j]! - L[j - 1]!);
        return { x: pts[j - 1]!.x + (pts[j]!.x - pts[j - 1]!.x) * u, y: pts[j - 1]!.y + (pts[j]!.y - pts[j - 1]!.y) * u };
      }
    }
    last = pts[pts.length - 1]!;
  }
  return last;
}

/** The line on the back of the tab's insert (insert mm, 105 x 20.4, x right, y down), in the one technical pen hand:
 *  NEVER, NEVER, NEVER EVER on one row across the top, LET and a big GO (the hero) under it. */
export class TabLyric {
  cv: HTMLCanvasElement;
  t0: number; t1: number;
  private rows: Row[] = [];
  private spans: WordSpan[] = [];
  private key = '';
  private ppm: number;
  constructor(private words: LyrWord[]) {
    const cw = 2048;
    this.ppm = cw / (DESK.INSW * 2000);
    this.cv = mk(cw, Math.round(cw * DESK.INSH / DESK.INSW));
    const txt = (i: number) => (i === 5 ? words[i]!.w.replace(/[,.]/g, '') : words[i]!.w).toUpperCase();
    const row = (idx: number[], em: number, x: number, y: number, pen: number): Row => ({ st: strokeText(idx.map(txt).join(' '), 'sans', em, em * 0.05), words: idx, x, y, pen, times: [] });
    const a = row([0, 1, 2, 3], 5.2, 0, 7.4, 0.36);
    a.x = (105 - a.st.width) / 2;
    const l = row([4], 5.2, 0, 18.4, 0.38), g = row([5], 14, 0, 18.8, 0.9);
    const tot = l.st.width + 3.5 + g.st.width;
    l.x = (105 - tot) / 2; g.x = l.x + l.st.width + 3.5;
    this.rows = [a, l, g];
    this.rows.forEach((r, ri) => {
      let ci = 0;
      r.words.forEach((wi, j) => {
        const w = this.words[wi]!;
        const t0 = w.start - 0.045, t1 = w.start + Math.min(wi === 5 ? 0.26 : 0.3, Math.max(0.12, (w.end - w.start) * 0.8));
        const s = wi === 5 ? w.w.replace(/[,.]/g, '') : w.w;
        const l0 = r.st.charRange[ci]![0];
        for (let k = 0; k < s.length; k++) r.times.push([t0 + ((t1 - t0) * k) / s.length, t0 + ((t1 - t0) * (k + 1)) / s.length]);
        ci += s.length;
        const l1 = r.st.charRange[ci - 1]![1];
        this.spans.push({ row: ri, a: t0, b: t1, l0, l1 });
        if (j < r.words.length - 1) { r.times.push([t1, t1]); ci++; }
      });
    });
    this.t0 = this.spans[0]!.a; this.t1 = this.spans[this.spans.length - 1]!.b;
  }
  private pt(ri: number, len: number) {
    const r = this.rows[ri]!, h = headAt(r.st, len);
    return { x: r.x + h.x, y: r.y + h.y };
  }
  /** The nib (insert mm) and its lift (mm) at t: on the line while writing, gliding (lifted) between words. */
  nib(t: number): { x: number; y: number; lift: number } {
    const S = this.spans;
    if (t <= S[0]!.a) return { ...this.pt(S[0]!.row, S[0]!.l0 + 0.01), lift: 0 };
    for (let i = 0; i < S.length; i++) {
      const s = S[i]!;
      if (t <= s.b) return { ...this.pt(s.row, writtenLength(this.rows[s.row]!.st, this.rows[s.row]!.times, t)), lift: 0 };
      const n = S[i + 1];
      if (n && t < n.a) {
        const u = (t - s.b) / (n.a - s.b), k = u * u * (3 - 2 * u);
        const p = this.pt(s.row, s.l1), q = this.pt(n.row, n.l0 + 0.01);
        return { x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k), lift: 2.5 * Math.sin(Math.PI * u) };
      }
    }
    const s = S[S.length - 1]!;
    return { ...this.pt(s.row, s.l1), lift: 0 };
  }
  draw(t: number) {
    const lens = this.rows.map((r) => writtenLength(r.st, r.times, t));
    const key = lens.map((l) => l.toFixed(1)).join(',');
    if (key === this.key) return false;
    this.key = key;
    const c = this.cv.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000'; c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#fff';
    const k = this.ppm;
    this.rows.forEach((r, i) => {
      if (lens[i]! <= 0) return;
      c.setTransform(k, 0, 0, k, r.x * k, r.y * k);
      c.lineWidth = r.pen;
      drawStrokeText(c, r.st, lens[i]!);
    });
    return true;
  }
}
