// Plate 14 `filed`, part 1 (174.77 – 186.85): inside folder 08-32. The folder lies open on a dark bench under the
// fitting; on each TEETH one of his exhibits is turned into it, the word set huge across it in black condensed
// Archivo (light snapping to heavy on the onset) with the red monogram beside it:
//  - his radiograph is lowered upright onto the fold, face-on to the lens, and on the next downbeat falls face down
//    toward the camera onto the near panel;
//  - the photograph of his cast (shot from above, as plate 13's prints) swings in on its edge like a door, then falls;
//  - his full chart (#8 ringed) slides in face-up under an overhead camera and is laid on top.
// Then the far panel closes over them ("Never, never, never ever let go" is written on the back of its tab as it
// comes over); the chart's monogram, the last red, sits in the closing wedge and drains as the panel shuts on "go".
// Pure functions of t; the times are read from the analysed beats and the lyric (see filed.ts).
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
  /** kicks (for the cut before LET) */
  kickNear: (t: number) => number;
}

// ------------------------------------------------------------------------------------------- the exhibits
/** Half sizes (m): the radiograph (a panoramic film, 244 x 128 mm), the cast's print, his chart (the A3 form at 0.786). */
export const EX_S: [number, number][] = [[0.122, 0.064], [0.1, 0.074], [0.165, 0.106]];

export interface ExPose { c: V3; x: V3; y: V3; on: boolean }

/** An exhibit standing on its bottom edge at `pivot`, turned theta about the fold's axis (pi/2 upright facing +z, pi
 *  face down on the near panel) and yaw about the vertical. */
function onEdge(pivot: V3, theta: number, yaw: number, halfH: number): ExPose {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const rot = (v: V3) => v3(cy * v.x + sy * v.z, v.y, -sy * v.x + cy * v.z);
  const up = rot(v3(0, Math.sin(theta), -Math.cos(theta)));
  return { c: pivot.clone().addScaledVector(up, halfH), x: rot(v3(1, 0, 0)), y: up, on: true };
}

/** A page falling from upright onto its face: accelerating, a small bounce on landing. */
function fall(t: number, t0: number, t1: number) {
  if (t <= t0) return Math.PI / 2;
  const u = clamp((t - t0) / (t1 - t0));
  let th = Math.PI / 2 + (Math.PI / 2) * u * u;
  if (t > t1) th = Math.PI - 0.05 * Math.exp(-(t - t1) * 14) * Math.abs(Math.sin((t - t1) * 30));
  return th;
}

export function exhibits(t: number, T: DeskTimes): ExPose[] {
  const { b, teeth } = T;
  const off: ExPose = { c: v3(0, -1, 0), x: v3(1, 0, 0), y: v3(0, 0, 1), on: false };
  // 1 the radiograph: lowered onto the fold into the beat before its word, falls on the next downbeat
  let e0 = off;
  const d0a = b(1), d0b = b(2);
  if (t >= d0a) {
    const d = 0.3 * (1 - ease.outCubic(clamp((t - d0a) / (d0b - d0a))));
    e0 = onEdge(v3(0.004, 0.0016 + d, 0.003), fall(t, b(4), b(5)), 0, EX_S[0]![1]);
  }
  // 2 the cast's print: swings in on its edge (a door on the fold), then falls on the 179.95 downbeat
  let e1 = off;
  const s1a = b(9), s1b = b(10);
  if (t >= s1a) {
    const u = ease.outCubic(clamp((t - s1a) / (s1b - s1a)));
    e1 = onEdge(v3(lerp(0.34, -0.006, u), 0.0026, 0.004), fall(t, b(12), b(13)), lerp(-1.25, 0.02, u), EX_S[1]![1]);
  }
  // 3 his chart: slides in face up over the far panel, settles onto the stack
  let e2 = off;
  const c2a = b(16), c2b = b(17), c2c = b(18);
  if (t >= c2a) {
    const u = ease.outCubic(clamp((t - c2a) / (c2b - c2a)));
    const w = ease.inQuad(clamp((t - c2b) / (c2c - c2b)));
    const c = v3(lerp(0.03, 0.002, u), lerp(0.075, 0.0036, w) + 0.0, lerp(-0.4, 0.113, u));
    const yaw = lerp(-0.16, -0.012, u) * (1 - 0.6 * w);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    // the chart's top toward the fold: it reads upright from the front
    e2 = { c, x: v3(cy, 0, -sy), y: v3(-sy, 0, -cy), on: true };
  }
  void teeth;
  return [e0, e1, e2];
}

/** F, the far panel: open until the chart is in, swings over (165 deg by the 183.40 downbeat, covering TEETH), then
 *  closes slowly through the line and shuts on "go". */
export function phiF(t: number, T: DeskTimes, go: number) {
  const { b } = T;
  const a = 3.0, c = 3.035;
  if (t <= b(18)) return 0;
  if (t <= b(20)) return a * ease.inOutCubic((t - b(18)) / (b(20) - b(18)));
  if (t <= b(24)) return lerp(a, c, ease.inOutQuad((t - b(20)) / (b(24) - b(20))));
  if (t <= go) return lerp(c, Math.PI, ease.inQuad((t - b(24)) / (go - b(24))));
  return Math.PI - 0.012 * Math.exp(-(t - go) * 18) * Math.abs(Math.sin((t - go) * 40));
}

// ------------------------------------------------------------------------------------------- the camera
const P = (pos: V3, at: V3, fov: number, aper = 10, up?: V3): CamPose => ({ pos, at, fov, aper, up });

export function deskShots(T: DeskTimes, letT: number): Shot[] {
  const { b } = T;
  const cutLet = T.kickNear(letT - 0.12);
  return [
    // the open folder, low, the radiograph lowered into frame face-on: TEETH
    { t0: b(0), t1: b(3), a: P(v3(0.03, 0.09, 0.42), v3(0.0, 0.066, 0.0), 36), b: P(v3(0.02, 0.078, 0.31), v3(0.0, 0.064, 0.0), 36) },
    // a three-quarter from the right: it falls toward us
    { t0: b(3), t1: b(6), a: P(v3(0.2, 0.13, 0.31), v3(-0.01, 0.05, 0.04), 40), b: P(v3(0.17, 0.115, 0.27), v3(-0.01, 0.04, 0.06), 40) },
    // above: the folder, the radiograph face down, the far panel and its tab
    { t0: b(6), t1: b(8), a: P(v3(-0.06, 0.43, 0.44), v3(0.0, 0.0, 0.02), 42), b: P(v3(-0.03, 0.41, 0.38), v3(0.0, 0.0, 0.02), 42) },
    // low from the left: the cast's print swings in on its edge: TEETH
    { t0: b(8), t1: b(12), a: P(v3(-0.13, 0.095, 0.37), v3(0.0, 0.078, 0.0), 36), b: P(v3(-0.07, 0.085, 0.29), v3(0.0, 0.074, 0.0), 36) },
    // from the right, higher: it falls
    { t0: b(12), t1: b(14), a: P(v3(0.17, 0.17, 0.34), v3(0.0, 0.03, 0.05), 40), b: P(v3(0.15, 0.16, 0.31), v3(0.0, 0.03, 0.06), 40) },
    // straight down: the chart slides in face up: TEETH; the far panel rises toward the lens
    { t0: b(14), t1: b(19), a: P(v3(0.0, 0.5, 0.085), v3(0.0, 0.0, 0.085), 34, 6, v3(0, 0, -1)), b: P(v3(0.0, 0.47, 0.095), v3(0.0, 0.0, 0.095), 34, 6, v3(0, 0, -1)) },
    // front, high: the panel coming over, the wedge, the tab: NEVER, NEVER, NEVER EVER
    { t0: b(19), t1: b(22), a: P(v3(-0.08, 0.21, 0.5), v3(-0.1, 0.02, 0.2), 30), b: P(v3(-0.1, 0.185, 0.46), v3(-0.1, 0.018, 0.215), 30) },
    { t0: b(22), t1: cutLet, a: P(v3(-0.09, 0.17, 0.43), v3(-0.1, 0.014, 0.235), 26, 14), b: P(v3(-0.1, 0.15, 0.39), v3(-0.105, 0.012, 0.24), 26, 14) },
    // the tab's other end: LET GO, the panel shut
    { t0: cutLet, t1: b(28), a: P(v3(-0.088, 0.118, 0.37), v3(-0.089, 0.006, 0.256), 14.5, 16), b: P(v3(-0.089, 0.104, 0.352), v3(-0.089, 0.006, 0.256), 14, 16) },
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
 *  monogram (B). Placement in the exhibit's uv: the word's left/right, its baseline, the monogram's box. */
export function overlay(i: number): HTMLCanvasElement {
  const [sx, sy] = EX_S[i]!;
  const cw = 2048, ch = Math.round((cw * sy) / sx);
  const cv = mk(cw, ch);
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, cw, ch);
  c.globalCompositeOperation = 'lighter';
  // [left, right, baseline] of TEETH and [x, y, size] of the monogram, in canvas fractions
  const L = ([
    [[0.06, 0.74, 0.74], [0.775, 0.3, 0.19]],
    [[0.05, 0.73, 0.33], [0.775, 0.17, 0.18]],
    [[0.05, 0.72, 0.775], [0.34, 0.885, 0.12]],
  ] as const)[i]!;
  const [x0, x1, base] = L[0], [mx, my, ms] = L[1];
  const heavy = F.archivo(62, 900), light = F.archivo(62, 300);
  const word = 'TEETH';
  let size = 400;
  c.font = font(heavy, size);
  const w0 = c.measureText(word).width;
  size = (size * (x1 - x0) * cw) / w0;
  c.font = font(heavy, size);
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
  drawMonogram(c, MONOGRAM.length, { x: mx * cw, y: my * ch - (ms * cw * MONO_H) / 2, size: ms * cw, color: 'rgb(0,0,255)' });
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
interface Row { st: StrokeText; words: number[]; x: number; y: number; pen: number }

/** The line on the back of the tab's insert (insert mm, 105 x 20.4, x right, y down): NEVER, NEVER, / NEVER EVER on
 *  the left, LET over a big GO (the hero) on the right, in the one technical pen hand. */
export class TabLyric {
  cv: HTMLCanvasElement;
  private rows: Row[] = [];
  private key = '';
  private ppm: number;
  constructor(private words: LyrWord[]) {
    const cw = 2048;
    this.ppm = cw / (DESK.INSW * 2000);
    this.cv = mk(cw, Math.round(cw * DESK.INSH / DESK.INSW));
    const txt = (i: number) => (i === 5 ? words[i]!.w.replace(/[,.]/g, '') : words[i]!.w).toUpperCase();
    const row = (idx: number[], em: number, x: number, y: number, pen: number): Row => ({ st: strokeText(idx.map(txt).join(' '), 'sans', em, em * 0.05), words: idx, x, y, pen });
    this.rows = [row([0, 1], 4.8, 4, 8.2, 0.36), row([2, 3], 4.8, 4, 16.2, 0.36), row([4], 5.0, 74, 7.2, 0.38), row([5], 13.5, 72, 18.4, 0.85)];
  }
  draw(t: number) {
    const lens = this.rows.map((r) => {
      const times: [number, number][] = [];
      r.words.forEach((wi, j) => {
        const w = this.words[wi]!;
        const a = w.start - 0.045, b = w.start + Math.min(wi === 5 ? 0.26 : 0.3, Math.max(0.12, (w.end - w.start) * 0.8));
        const s = wi === 5 ? w.w.replace(/[,.]/g, '') : w.w;
        for (let i = 0; i < s.length; i++) times.push([a + ((b - a) * i) / s.length, a + ((b - a) * (i + 1)) / s.length]);
        if (j < r.words.length - 1) times.push([b, b]);
      });
      return writtenLength(r.st, times, t);
    });
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
