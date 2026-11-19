// Plate 7 `chart`: the lyric as the chart's header field. The phrase on screen is typed into the form's header (the
// sheet's top band): supporting words small in Archivo wide, the line's hero big (Archivo condensed black; *wife* in
// wax Cormorant italic). Drawn each frame into a canvas in sheet mm; channels: R = sung (film ink), B = unsung
// (halide, 35%), G = wax. The hero snaps from light to heavy on its onset with its letters locked in place.
import { SCALE } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease } from '../../engine/util';
import type { Lyrics, Line } from '../../engine/lyrics';
import { HEAD } from './chart-form';

export const LYR = { x0: -210, x1: 210, y0: -131, y1: -60 };
export const LPPM = SCALE > 1 ? 10 : 8;

interface CW { text: string; start: number; end: number; hero: boolean; serif: boolean; em: number; w: number; x: number; heavy: string; light: string; adv: number[] }
export interface Chunk { t0: number; t1: number; words: CW[]; line: number }

/** [line index within the window, word indices per chunk, hero word index or -1 per chunk] */
const SPEC: { words: number[]; hero: number }[][] = [
  [{ words: [0, 1, 2], hero: -1 }, { words: [3, 4, 5], hero: 4 }, { words: [6, 7, 8], hero: -1 }],
  [{ words: [0, 1, 2, 3], hero: -1 }, { words: [4, 5, 6, 7], hero: -1 }, { words: [8, 9], hero: 9 }],
  [{ words: [0, 1, 2, 3], hero: -1 }, { words: [4, 5, 6, 7], hero: 4 }],
  [{ words: [0, 1, 2, 3], hero: 2 }, { words: [4, 5, 6], hero: -1 }, { words: [7, 8], hero: 7 }],
];
const clean = (s: string) => s.replace(/[,.!?]/g, '');
const LEAD = 0.045;
/** An unsung word is on the page this long before its onset (the rule: never more than 0.4 s early). */
const PRE = 0.2;

let mctx: CanvasRenderingContext2D | null = null;
const meas = (f: string, em: number, s: string) => {
  mctx ??= document.createElement('canvas').getContext('2d')!;
  mctx.font = font(f, em);
  return mctx.measureText(s).width;
};

export function buildChunks(ly: Lyrics, beats: number[], t0: number, t1: number): Chunk[] {
  const lines = ly.lines.filter((l: Line) => l.start >= t0 - 0.05 && l.start < t1);
  const out: Chunk[] = [];
  lines.forEach((l, li) => {
    const spec = SPEC[li];
    if (!spec) return;
    spec.forEach((ch, ci) => {
      const ws = ch.words.map((i) => l.words[i]!).filter(Boolean);
      const hasHero = ch.hero >= 0;
      const words: CW[] = ws.map((w) => {
        const idx = l.words.indexOf(w);
        const hero = idx === ch.hero;
        const serif = hero && ch.words.includes(9) && l.words.length === 10;
        const em = hero ? (serif ? 56 : 44) : hasHero ? 15.5 : 22;
        const text = clean(w.w);
        const heavy = hero ? (serif ? F.serif(600, true) : F.archivo(62, 900)) : F.archivo(125, 500);
        const light = hero ? (serif ? F.serif(400, true) : F.archivo(62, 300)) : F.archivo(125, 300);
        const adv = [...text].map((ch2) => meas(heavy, em, ch2));
        return { text: serif ? text : hero ? text.toUpperCase() : text, start: w.start, end: w.end, hero, serif, em, w: 0, x: 0, heavy, light, adv };
      });
      words.forEach((w) => {
        if (w.hero && !w.serif) w.adv = [...w.text].map((c) => meas(w.heavy, w.em, c));
        w.w = w.adv.reduce((a, b) => a + b, 0) + (w.hero && !w.serif ? 0.8 * (w.text.length - 1) : 0);
      });
      // layout: one baseline, centred
      const gap = hasHero ? 7.5 : 9;
      let W = words.reduce((a, w) => a + w.w, 0) + gap * (words.length - 1);
      const sc = Math.min(1, 372 / W);
      if (sc < 1) { words.forEach((w) => { w.em *= sc; w.w *= sc; w.adv = w.adv.map((a) => a * sc); }); W *= sc; }
      let x = -W / 2 + (ch.words.includes(9) && l.words.length === 10 ? -16 : 0);
      for (const w of words) { w.x = x; x += w.w + gap * sc; }
      const first = ws[0]!;
      const t0c = first.start - LEAD;
      out.push({ t0: t0c, t1: 0, words, line: li });
    });
  });
  // exits: the next chunk's entrance; the last of a line leaves on the next beat after the line ends (the hero *wife*
  // stays until the next line starts: the examiner is signing under it)
  out.forEach((c, i) => {
    const nx = out[i + 1];
    const lineEnd = lines[c.line]!.end;
    const isLast = !nx || nx.line !== c.line;
    if (!isLast) c.t1 = nx!.t0;
    else {
      const hold = c.words.some((w) => w.serif);
      const b = beats.find((x) => x >= lineEnd + 0.01) ?? lineEnd + 0.3;
      c.t1 = hold && nx ? nx.t0 : Math.min(b, nx ? nx.t0 : 1e9);
    }
  });
  return out;
}

const SUNG = 'rgb(255,0,0)', UNSUNG = 'rgb(0,0,255)', WAX = 'rgb(0,255,0)';
export function newLyricCanvas(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.round((LYR.x1 - LYR.x0) * LPPM); cv.height = Math.round((LYR.y1 - LYR.y0) * LPPM);
  return cv;
}

/** Draw the phrase on screen at t (or nothing). Returns whether anything is up. */
export function drawLyric(cv: HTMLCanvasElement, chunks: Chunk[], t: number): boolean {
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(LPPM, 0, 0, LPPM, -LYR.x0 * LPPM, -LYR.y0 * LPPM);
  c.globalCompositeOperation = 'lighter';
  c.textBaseline = 'alphabetic';
  const ch = chunks.find((k) => t >= k.t0 && t < k.t1);
  if (!ch) return false;
  const base = HEAD.base;
  const cx = c as CanvasRenderingContext2D & { letterSpacing?: string; fontKerning?: string };
  for (const w of ch.words) {
    // a word is on the page 0.2 s before it is sung (unsung: halide, light); on its onset it is sung (and the hero
    // snaps to heavy at the same letter positions: its light state is spaced out to the heavy word's width)
    if (t < w.start - PRE) continue;
    const dt = t - (w.start - LEAD);
    const sung = dt >= 0;
    const k = clamp(dt / 0.14);
    const s = sung ? (w.hero ? 0.86 : 0.9) + (w.hero ? 0.14 : 0.1) * ease.outBack(k) : 1;
    c.save();
    c.translate(w.x + w.w / 2, base); c.scale(s, s); c.translate(-(w.x + w.w / 2), -base);
    c.textAlign = 'left';
    cx.fontKerning = 'none';
    cx.letterSpacing = '0px';
    const fam = sung ? w.heavy : w.light;
    c.font = font(fam, w.em);
    if (w.hero && !w.serif) {
      const n = w.text.length;
      cx.letterSpacing = sung ? '0.8px' : `${(w.w - meas(w.light, w.em, w.text)) / n}px`;
    } else if (w.hero && w.serif) {
      cx.letterSpacing = sung ? '0px' : `${(w.w - meas(w.light, w.em, w.text)) / w.text.length}px`;
    }
    c.fillStyle = sung ? (w.serif ? WAX : SUNG) : UNSUNG;
    c.fillText(w.text, w.x, base);
    cx.letterSpacing = '0px';
    c.restore();
  }
  c.globalCompositeOperation = 'source-over';
  return true;
}
