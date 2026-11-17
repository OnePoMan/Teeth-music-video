// Plate 13 `match`: the layout (table mm) and the 2D ink: the tracing on the acetate (static), the lyric written on the
// acetate in the tracing pen's hand (per frame), the cast label on each print (NAME field; the monogram signed in red).
// Frames (all mm, y DOWN, as on a sheet of paper):
//  - TABLE: the light table; origin = where the arch origin (the point between #8 and #9's incisal edges) of a print
//    sits when the print is perfectly aligned under the tracing.
//  - PRINT-LOCAL: a print's own frame, its arch origin at 0; a print is placed on the table by (ox, oy, theta).
//  - ARCH (real mm, teeth.ts): print-local = arch * PHOTO_SCALE (the photo is enlarged 2:1).
import { SCALE } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { strokeText, drawStrokeText, writtenLength, type StrokeText } from '../../engine/stroke';
import { clamp } from '../../engine/util';
import type { Line, Word } from '../../engine/lyrics';
import { HIS, tooth, occlusalOutline, incisalEdge, toothPos, type V2 } from '../teeth';
import { drawMonogram, monoWritten, MONO_H } from '../monogram';
import { T_HEX } from '../palette';

export const PHOTO_SCALE = 1.75;
/** The print (print-local mm): a glossy 11x8.5" print, a white border. */
export const PRINT = { x0: -125, x1: 155, y0: -98, y1: 116, border: 7 };
/** The photograph inside the border, in ARCH mm (the region the cast photo render covers). */
export const PHOTO = {
  x0: (PRINT.x0 + PRINT.border) / PHOTO_SCALE, y0: (PRINT.y0 + PRINT.border) / PHOTO_SCALE,
  x1: (PRINT.x1 - PRINT.border) / PHOTO_SCALE, y1: (PRINT.y1 - PRINT.border) / PHOTO_SCALE,
};
/** The cast label stuck on the print (print-local mm, top-left and size). */
export const LABEL = { x0: 97, y0: -4, w: 56, h: 40, ppm: 18 };
/** Where the monogram is signed (label mm): the NAME field's line. */
export const MONO_PLACE = { x: 17.5, y: 11.6, size: 33 };
/** The acetate (table mm): fixed to the table, the prints slide in under it. */
export const ACETATE = { x0: -138, x1: 86, y0: -126, y1: 140 };
/** The lyric band on the acetate (table mm) and its canvas resolution. */
export const LYR = { x0: -138, x1: 86, y0: -122, y1: -10, ppm: 9 };
/** The tracing's canvas region (table mm). */
export const TRC = { x0: -84, x1: 84, y0: -42, y1: 112, ppm: 12 };

const mkCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.round(w); c.height = Math.round(h);
  return c;
};

// ------------------------------------------------------------------------------------------------ the tracing
/** Red-flush order per tooth (0 first .. 1 last): the molars first, the incisors after, the chip on #8 last. */
export function flushOrder(n: number) {
  if (n === 8) return 0.97;
  const pos = toothPos(n);
  return 0.06 + ((7 - pos) / 7) * 0.8 + (n >= 9 ? 0.03 : 0);
}

/** The bite tracing on the acetate: every upper tooth's outline and the anterior incisal edges, in a fine pen line
 *  with a hand's tremor. R = ink coverage, G = the tooth's flush order (for the red's sweep). Static. */
export function buildTracing(): HTMLCanvasElement {
  const k = TRC.ppm * SCALE;
  const cv = mkCanvas((TRC.x1 - TRC.x0) * k, (TRC.y1 - TRC.y0) * k);
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(k, 0, 0, k, -TRC.x0 * k, -TRC.y0 * k);
  c.lineCap = 'round'; c.lineJoin = 'round';
  // a hand's tremor: smooth low-amplitude wobble along the line (deterministic)
  const wob = (p: V2, i: number, n: number): V2 => {
    const s = i * 0.37 + n * 3.1;
    return [p[0] + 0.07 * Math.sin(s * 1.7) + 0.04 * Math.sin(s * 4.3 + 1), p[1] + 0.07 * Math.cos(s * 1.3 + 2) + 0.04 * Math.sin(s * 3.7)];
  };
  for (let n = 1; n <= 16; n++) {
    const t = tooth(HIS, n);
    const g = Math.round(flushOrder(n) * 255);
    c.strokeStyle = `rgb(255,${g},0)`;
    const o = occlusalOutline(t, 96).map((p) => [p[0] * PHOTO_SCALE, p[1] * PHOTO_SCALE] as V2);
    c.lineWidth = 0.46;
    c.beginPath();
    // the pen goes round once and overshoots its start a little (a traced outline is never closed exactly)
    const L = o.length;
    for (let i = 0; i <= L + 3; i++) {
      const p = wob(o[i % L]!, i, n);
      if (i === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]);
    }
    c.stroke();
    const e = incisalEdge(t);
    if (e) {
      c.lineWidth = 0.34;
      c.beginPath();
      e.forEach((q, i) => { const p = wob([q[0] * PHOTO_SCALE, q[1] * PHOTO_SCALE], i, n + 40); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
      c.stroke();
    }
  }
  // the midline tick and two registration crosses (an overlay's alignment marks)
  c.strokeStyle = 'rgb(255,255,0)';
  c.lineWidth = 0.4;
  const cross = (x: number, y: number, r: number) => { c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke(); };
  cross(-78, 22, 4); cross(78, 22, 4); cross(0, 104, 4);
  c.beginPath(); c.moveTo(0, -14); c.lineTo(0, -6); c.stroke();
  return cv;
}

// ------------------------------------------------------------------------------------------------ the stamp
/** MATCH, a rubber stamp (static, alpha = ink). Its size in mm. */
export const STAMP = { w: 76, h: 26, ppm: 12 };
export function buildStamp(): HTMLCanvasElement {
  const k = STAMP.ppm * SCALE;
  const cv = mkCanvas(STAMP.w * k, STAMP.h * k);
  const c = cv.getContext('2d')!;
  c.setTransform(k, 0, 0, k, 0, 0);
  c.fillStyle = '#fff'; c.strokeStyle = '#fff';
  c.lineWidth = 1.6;
  c.strokeRect(1.4, 1.4, STAMP.w - 2.8, STAMP.h - 2.8);
  c.font = font(F.archivo(75, 900), 19);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillText('MATCH', STAMP.w / 2, STAMP.h / 2 + 7);
  // a stamp's uneven ink: knock out specks
  c.globalCompositeOperation = 'destination-out';
  let s = 12345;
  const R = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 900; i++) {
    c.globalAlpha = 0.3 + R() * 0.7;
    c.beginPath(); c.arc(R() * STAMP.w, R() * STAMP.h, 0.08 + R() * 0.35, 0, Math.PI * 2); c.fill();
  }
  return cv;
}

// ------------------------------------------------------------------------------------------------ the label
/** The label's printed part (white sticker, film ink): small lab text (unreadable at frame scale) and the NAME field. */
export function buildLabelBase(): HTMLCanvasElement {
  const k = LABEL.ppm * SCALE;
  const cv = mkCanvas(LABEL.w * k, LABEL.h * k);
  const c = cv.getContext('2d')!;
  c.setTransform(k, 0, 0, k, 0, 0);
  const r = 1.6;
  c.fillStyle = T_HEX.lightbox;
  c.beginPath(); c.roundRect(0, 0, LABEL.w, LABEL.h, r); c.fill();
  const ink = T_HEX.film;
  // the header rule and the lab's small print
  c.fillStyle = ink;
  c.fillRect(2.4, 6.6, LABEL.w - 4.8, 0.32);
  c.font = font(F.mono(500), 1.25);
  c.textBaseline = 'alphabetic';
  c.globalAlpha = 0.5;
  c.fillText('08-32 · STONE CAST · MAX · PHOTO 1.75:1', 2.6, 4.6);
  c.font = font(F.mono(400), 1.0);
  c.globalAlpha = 0.42; c.fillText('EXHIBIT 9 · TYPE IV STONE · TRIMMED · BAGGED', 2.6, 37.0);
  c.globalAlpha = 1;
  // NAME: the one readable field
  c.font = font(F.mono(600), 3.6);
  c.fillText('NAME', 2.6, 25.4);
  c.fillRect(13.6, 25.9, LABEL.w - 16.2, 0.34);
  c.font = font(F.mono(400), 1.0);
  c.globalAlpha = 0.42;
  c.fillText('DATE', 2.6, 31.6);
  c.fillRect(9.6, 32.0, 16, 0.22);
  c.fillText('EXAM.', 28.6, 31.6);
  c.fillRect(35.6, 32.0, 17.6, 0.22);
  c.globalAlpha = 1;
  return cv;
}

/** The live label: the printed base and the monogram signed up to `len` (red). */
export function drawLabel(cv: HTMLCanvasElement, base: HTMLCanvasElement, len: number) {
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.drawImage(base, 0, 0);
  if (len <= 0) return;
  const k = LABEL.ppm * SCALE;
  c.setTransform(k, 0, 0, k, 0, 0);
  drawMonogram(c, len, { x: MONO_PLACE.x, y: MONO_PLACE.y, size: MONO_PLACE.size, width: 0.62, color: T_HEX.match, pressure: 0.7 });
}
export const labelCanvas = () => mkCanvas(LABEL.w * LABEL.ppm * SCALE, LABEL.h * LABEL.ppm * SCALE);
/** Pen tip on the label (label mm) for a monogram pen point (unit box). */
export const monoToLabel = (x: number, y: number): V2 => [MONO_PLACE.x + x * MONO_PLACE.size, MONO_PLACE.y + y * MONO_PLACE.size];
export { monoWritten, MONO_H };

// ------------------------------------------------------------------------------------------------ the lyric
export interface Phrase {
  line: Line; words: Word[]; hero: number; t0: number; t1: number;
  red: boolean;
  rows: { st: StrokeText; words: number[]; x: number; y: number; width: number; pen: number }[];
}

const HERO_EM = 50, SUP_EM = 15, SOLO_EM = 17;
const HERO_BASE = -27, SUP_BASE = -75, SOLO_BASE = -44;

/** Lay a phrase out on the acetate (table mm): supporting words on a row above the hero, both centred on the arch. */
export function layoutPhrase(p: Phrase) {
  const sup = p.words.map((_, i) => i).filter((i) => i !== p.hero);
  const txt = (i: number) => (i === p.hero ? p.words[i]!.w.replace(/[,.]/g, '').toUpperCase() : p.words[i]!.w);
  const row = (idx: number[], em: number, y: number, pen: number) => {
    const st = strokeText(idx.map(txt).join(' '), 'tech', em);
    return { st, words: idx, x: -st.width / 2, y, width: st.width, pen };
  };
  p.rows = [];
  if (p.hero >= 0) {
    if (sup.length) p.rows.push(row(sup, SUP_EM, SUP_BASE, 0.55));
    p.rows.push(row([p.hero], HERO_EM, HERO_BASE, 1.15));
  } else p.rows.push(row(sup, SOLO_EM, SOLO_BASE, 0.6));
}

/** Write the phrase into the lyric canvas (R = ink, G = red), each word while it is sung. */
export function drawLyric(cv: HTMLCanvasElement, p: Phrase | null, t: number) {
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  if (!p) return;
  const k = LYR.ppm * SCALE;
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const r of p.rows) {
    // char times: each word written from its onset (letters ~45 ms early) over most of its length
    const times: [number, number][] = [];
    r.words.forEach((wi, j) => {
      const w = p.words[wi]!;
      const hero = wi === p.hero;
      const a = w.start - 0.045, b = w.start + Math.min(hero ? 0.26 : 0.3, Math.max(0.12, (w.end - w.start) * 0.8));
      const s = hero ? w.w.replace(/[,.]/g, '') : w.w;
      for (let i = 0; i < s.length; i++) times.push([a + ((b - a) * i) / s.length, a + ((b - a) * (i + 1)) / s.length]);
      if (j < r.words.length - 1) times.push([b, b]);
    });
    const len = writtenLength(r.st, times, t);
    if (len <= 0) continue;
    const red = p.red && r.words.includes(p.hero);
    c.setTransform(k, 0, 0, k, (r.x - LYR.x0) * k, (r.y - LYR.y0) * k);
    c.strokeStyle = red ? 'rgb(255,255,0)' : 'rgb(255,0,0)';
    c.lineWidth = r.pen;
    drawStrokeText(c, r.st, len);
    // a marker's second pass on the hero: a slightly offset trace gives the line its body
    if (r.words.includes(p.hero)) {
      c.setTransform(k, 0, 0, k, (r.x - LYR.x0 + 0.35) * k, (r.y - LYR.y0 + 0.2) * k);
      c.lineWidth = r.pen * 0.8;
      drawStrokeText(c, r.st, Math.max(0, len - 4));
    }
  }
}
export const lyricCanvas = () => mkCanvas((LYR.x1 - LYR.x0) * LYR.ppm * SCALE, (LYR.y1 - LYR.y0) * LYR.ppm * SCALE);
export const clamp01 = clamp;
