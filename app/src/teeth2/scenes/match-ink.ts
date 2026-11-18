// Plate 13 `match`: the layout (table mm) and the 2D ink: the tracing on the acetate (static), the lyric written on the
// acetate in the tracing pen's hand (per frame), the cast label on each print (NAME field; the monogram signed in red).
// Frames (all mm, y DOWN, as on a sheet of paper):
//  - TABLE: the light table; origin = where the arch origin (the point between #8 and #9's incisal edges) of a print
//    sits when the print is perfectly aligned under the tracing.
//  - PRINT-LOCAL: a print's own frame, its arch origin at 0; a print is placed on the table by (ox, oy, theta).
//  - ARCH (real mm, teeth.ts): print-local = arch * PHOTO_SCALE (the photo is enlarged 2.2:1).
import { SCALE } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { strokeText, drawStrokeText, writtenLength, type StrokeText } from '../../engine/stroke';
import { clamp } from '../../engine/util';
import type { Line, Word } from '../../engine/lyrics';
import { HIS, tooth, biteMark, type V2 } from '../teeth';
import { drawMonogram, monoWritten, MONO_H } from '../monogram';
import { T_HEX } from '../palette';

export const PHOTO_SCALE = 2.2;
/** The print (print-local mm): a glossy 13x10" print, a white border. */
export const PRINT = { x0: -150, x1: 190, y0: -112, y1: 140, border: 8 };
/** The photograph inside the border, in ARCH mm (the region the cast photo render covers). */
export const PHOTO = {
  x0: (PRINT.x0 + PRINT.border) / PHOTO_SCALE, y0: (PRINT.y0 + PRINT.border) / PHOTO_SCALE,
  x1: (PRINT.x1 - PRINT.border) / PHOTO_SCALE, y1: (PRINT.y1 - PRINT.border) / PHOTO_SCALE,
};
/** The cast label stuck on the print (print-local mm, top-left and size). */
export const LABEL = { x0: 80, y0: -54, w: 56, h: 40, ppm: 18 };
/** Where the monogram is signed (label mm): the NAME field's line. */
export const MONO_PLACE = { x: 17.5, y: 11.6, size: 33 };
/** The acetate (table mm): fixed to the table, the prints slide in under it. */
export const ACETATE = { x0: -150, x1: 73, y0: -150, y1: 160 };
/** The lyric band on the acetate (table mm) and its canvas resolution. */
export const LYR = { x0: -150, x1: 73, y0: -140, y1: -26, ppm: 9 };
/** Where the lyric is centred (table x). */
export const LYR_CX = -12;
/** The tracing's canvas region (table mm). */
export const TRC = { x0: -72, x1: 72, y0: -24, y1: 40, ppm: 16 };

const mkCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.round(w); c.height = Math.round(h);
  return c;
};

// ------------------------------------------------------------------------------------------------ the tracing
/** The bite's upper arc (biteMark(HIS), canine to canine) mapped back onto the arch: per tooth, the outline of the mark
 *  it left (a rounded bar along an incisal edge, a small triangle for a canine) in arch mm. #8's bar is the shortened,
 *  slanted one: the chip. (The bite's lower arc belongs on the mandibular overlay; this sheet is laid on the maxillary
 *  casts.) */
export function biteTrace(): { n: number; poly: V2[] }[] {
  const gap = 16;
  const bm = biteMark(HIS, { gap });
  const ts = [6, 7, 8, 9, 10, 11].map((n) => tooth(HIS, n)).filter((t) => t.present);
  const canY = Math.max(...ts.map((t) => t.center[1]));
  return bm.upper.map((m) => ({ n: m.n, poly: m.poly.map(([X, Y]) => [-X, canY - (Y - gap / 2)] as V2) }));
}
/** Red-flush order per tooth (0 first .. 1 last): the canines, the laterals, #9, and the chip on #8 last. */
export function flushOrder(n: number) {
  return n === 8 ? 0.97 : n === 9 ? 0.72 : n === 7 || n === 10 ? 0.42 : 0.1;
}
/** Where the chip is (print-local mm): the mesial-incisal corner of #8's mark. */
export function chipPoint(): V2 {
  const m = biteTrace().find((q) => q.n === 8)!;
  // the mark's mesial end (nearest the midline, x -> 0)
  let best = m.poly[0]!;
  for (const p of m.poly) if (Math.abs(p[0]) < Math.abs(best[0])) best = p;
  return [best[0] * PHOTO_SCALE, best[1] * PHOTO_SCALE];
}

/** The bite tracing on the acetate: the six upper anterior marks, a technical pen's even line with a hand's slight
 *  tremor. R = ink coverage, G = the tooth's flush order (for the red's sweep; 1.0 = never red). Static. */
export function buildTracing(): HTMLCanvasElement {
  const k = TRC.ppm * SCALE;
  const cv = mkCanvas((TRC.x1 - TRC.x0) * k, (TRC.y1 - TRC.y0) * k);
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(k, 0, 0, k, -TRC.x0 * k, -TRC.y0 * k);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const wob = (p: V2, i: number, n: number): V2 => {
    const s = i * 0.37 + n * 3.1;
    return [p[0] + 0.05 * Math.sin(s * 1.7) + 0.03 * Math.sin(s * 4.3 + 1), p[1] + 0.05 * Math.cos(s * 1.3 + 2) + 0.03 * Math.sin(s * 3.7)];
  };
  for (const { n, poly } of biteTrace()) {
    c.strokeStyle = `rgb(255,${Math.round(flushOrder(n) * 255)},0)`;
    c.lineWidth = 0.42;
    const o = poly.map((p) => [p[0] * PHOTO_SCALE, p[1] * PHOTO_SCALE] as V2);
    c.beginPath();
    const L = o.length;
    for (let i = 0; i <= L + 1; i++) { const p = wob(o[i % L]!, i, n); if (i === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); }
    c.stroke();
  }
  // the midline tick and the registration crosses (an overlay's alignment marks; they stay black)
  c.strokeStyle = 'rgb(255,255,0)';
  c.lineWidth = 0.35;
  const cross = (x: number, y: number, r: number) => { c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke(); };
  cross(-58, 4, 3.5); cross(58, 4, 3.5);
  c.beginPath(); c.moveTo(0, -12); c.lineTo(0, -5); c.stroke();
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
  c.fillText('08-32 · STONE CAST · MAX · PHOTO 2.2:1', 2.6, 4.6);
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

const HERO_EM = 40, SUP_EM = 12.5, SOLO_EM = 14;
const HERO_BASE = -37, SUP_BASE = -80, SOLO_BASE = -50;

/** Lay a phrase out on the acetate (table mm): supporting words on a row above the hero, both centred on the arch. */
export function layoutPhrase(p: Phrase) {
  const sup = p.words.map((_, i) => i).filter((i) => i !== p.hero);
  // a technical pen hand: upright single-stroke capitals (Hershey Sans, as through a lettering guide)
  const txt = (i: number) => (i === p.hero ? p.words[i]!.w.replace(/[,.]/g, '') : p.words[i]!.w).toUpperCase();
  const row = (idx: number[], em: number, y: number, pen: number) => {
    const st = strokeText(idx.map(txt).join(' '), 'sans', em, em * 0.04);
    return { st, words: idx, x: LYR_CX - st.width / 2, y, width: st.width, pen };
  };
  p.rows = [];
  if (p.hero >= 0) {
    if (sup.length) p.rows.push(row(sup, SUP_EM, SUP_BASE, 0.5));
    p.rows.push(row([p.hero], HERO_EM, HERO_BASE, 1.0));
  } else p.rows.push(row(sup, SOLO_EM, SOLO_BASE, 0.55));
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
  }
}
export const lyricCanvas = () => mkCanvas((LYR.x1 - LYR.x0) * LYR.ppm * SCALE, (LYR.y1 - LYR.y0) * LYR.ppm * SCALE);
export const clamp01 = clamp;
