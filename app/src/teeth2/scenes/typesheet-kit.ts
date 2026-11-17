// `typesheet` helpers: the sheet's own furniture (section heads, captions, paper, film), and the karaoke line drawn
// in the lyric colour treatments A / B / C on either ground.
import type { Word } from '../../engine/lyrics';
import { F, font, layout, measure } from '../../engine/type';
import { clamp } from '../../engine/util';
import { T_HEX, trgba, type TKey } from '../palette';
import type { Region } from './typesheet-gl';

export interface Ctx2 {
  a: CanvasRenderingContext2D; // albedo
  g: CanvasRenderingContext2D; // emission
  h: CanvasRenderingContext2D; // r: relief height, g: rigid object, b: stainable cloth
  regions: Region[];
}

export const MONO = F.mono(500);
export const MONO_L = F.mono(400);

/** A small lab caption in Plex Mono, tracked. Returns its width. */
export function cap(c: CanvasRenderingContext2D, s: string, x: number, y: number, o: { col?: string; size?: number; track?: number; fam?: string; align?: CanvasTextAlign } = {}) {
  c.save();
  c.font = font(o.fam ?? MONO, o.size ?? 12);
  c.letterSpacing = `${o.track ?? 2}px`;
  c.fillStyle = o.col ?? trgba('silver');
  c.textAlign = o.align ?? 'left';
  c.textBaseline = 'alphabetic';
  c.fillText(s, x, y);
  const w = c.measureText(s).width;
  c.restore();
  return w;
}

/** A section head: number, title, a hairline to the section's right edge. */
export function head(c: CanvasRenderingContext2D, num: string, title: string, x: number, y: number, w: number) {
  const n = cap(c, num, x, y, { col: trgba('silver'), size: 13, track: 3 });
  const tw = cap(c, title, x + n + 16, y, { col: trgba('halide'), size: 13, track: 3 });
  c.fillStyle = trgba('silver', 0.55);
  c.fillRect(x + n + 16 + tw + 18, y - 5, Math.max(0, w - (n + 16 + tw + 18)), 1);
}

/** Lightbox-white paper (albedo), with a soft contact shadow on the table. */
export function paper(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: { rot?: number; col?: string; shadow?: number } = {}) {
  c.save();
  c.translate(x + w / 2, y + h / 2);
  c.rotate(o.rot ?? 0);
  c.shadowColor = 'rgba(0,0,0,0.85)';
  c.shadowBlur = 18;
  c.shadowOffsetY = 6;
  c.fillStyle = o.col ?? T_HEX.lightbox;
  c.fillRect(-w / 2, -h / 2, w, h);
  c.restore();
}

/** Run `fn` in the frame of a (rotated) rect: origin at its top-left. */
export function inRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rot: number, fn: () => void) {
  c.save();
  c.translate(x + w / 2, y + h / 2);
  c.rotate(rot);
  c.translate(-w / 2, -h / 2);
  fn();
  c.restore();
}

/** Corner registration ticks of a rect (hairline). */
export function ticks(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col = trgba('silver', 0.7), k = 10) {
  c.fillStyle = col;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
    c.fillRect(cx - (sx < 0 ? k : 0), cy, k, 1);
    c.fillRect(cx, cy - (sy < 0 ? k : 0), 1, k);
  }
}

// ------------------------------------------------------------------------------------------- the karaoke line
export type Ground = 'film' | 'white';
export type TreatId = 'A' | 'B' | 'C';

/** A word's state at t: 0 = unsung, (0,1) = being sung (letters lit), 1 = sung. Letters spring up 45 ms ahead. */
export function wordState(w: Word, t: number) {
  const n = Array.from(w.w).length;
  const p = clamp((t - (w.start - 0.045)) / Math.max(0.05, w.end - w.start), 0, 1);
  return { p, lit: p * n };
}

interface RunStyle { fam: string; size: number; col: string; up?: boolean }
export interface LineOpts {
  treat: TreatId; ground: Ground;
  /** Supporting and hero sizes (px). */
  size: number; hero: number;
  /** Which word is the hero (index in the line), and what material it takes in treatment C. */
  heroIdx: number; heroMat?: TKey;
  gap?: number;
}

/** Styles of a word in a state, per treatment and ground. */
function style(o: LineOpts, isHero: boolean, sung: boolean): RunStyle {
  const white = o.ground === 'white';
  const ink = white ? T_HEX.film : T_HEX.lightbox;
  const sup = F.archivo(112, 300), heavy = F.archivo(100, 700);
  const heroF = F.archivo(62, 900);
  if (o.treat === 'A') {
    if (isHero) return { fam: heroF, size: o.hero, col: sung ? ink : white ? trgba('film', 0.3) : trgba('halide', 0.35), up: true };
    return { fam: sup, size: o.size, col: sung ? ink : white ? trgba('film', 0.3) : trgba('halide', 0.35) };
  }
  if (o.treat === 'B') {
    // unsung: hairline weight in silver at full strength; sung: the same word heavy, lightbox white
    if (isHero) return { fam: sung ? heroF : F.archivo(62, 300), size: o.hero, col: sung ? ink : white ? T_HEX.silver : T_HEX.silver, up: true };
    return { fam: sung ? heavy : F.archivo(100, 300), size: o.size, col: sung ? ink : T_HEX.silver };
  }
  // C: as A, the hero in its plate's material colour (on white, a shade of it to hold contrast)
  const mat = o.heroMat ?? 'stone';
  const matCol = white ? shade(mat, 0.62) : T_HEX[mat];
  if (isHero) return { fam: heroF, size: o.hero, col: sung ? matCol : white ? trgba('film', 0.3) : trgba('halide', 0.35), up: true };
  return { fam: sup, size: o.size, col: sung ? ink : white ? trgba('film', 0.3) : trgba('halide', 0.35) };
}

/** A shade of a palette colour (sRGB multiply), as a CSS colour. */
export function shade(k: TKey, f: number, a = 1) {
  const n = parseInt(T_HEX[k].slice(1), 16);
  return `rgba(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)},${a})`;
}

export interface Placed { w: Word; text: string; x: number; width: number; style: RunStyle; p: number; isHero: boolean }

/** Measure the line's words as they will be drawn (sung metrics), for layout. */
export function lineWidth(words: Word[], o: LineOpts) {
  const gap = o.gap ?? o.size * 0.32;
  let x = 0;
  words.forEach((w, i) => {
    const s = style(o, i === o.heroIdx, true);
    const text = s.up ? w.w.toUpperCase() : w.w;
    x += measure(text, s.fam, s.size) + (i < words.length - 1 ? gap : 0);
  });
  return x;
}

/**
 * Draw a line at time t: each word unsung / being sung (its letters lit one by one, the current one springing up) /
 * sung, the hero at hero scale. Baselines shared. Returns the placed words (for the state brackets).
 */
export function drawLine(c: CanvasRenderingContext2D, words: Word[], t: number, o: LineOpts, x0: number, base: number): Placed[] {
  const gap = o.gap ?? o.size * 0.32;
  const out: Placed[] = [];
  let x = x0;
  words.forEach((w, i) => {
    const isHero = i === o.heroIdx;
    const st = wordState(w, t);
    const sS = style(o, isHero, true), sU = style(o, isHero, false);
    const text = sS.up ? w.w.toUpperCase() : w.w;
    // layout with the sung face (B swaps weight per letter: unsung letters sit centred in the sung slots)
    const lay = layout(text, sS.fam, sS.size);
    const layU = layout(text, sU.fam, sU.size);
    lay.glyphs.forEach((gl, gi) => {
      const k = st.lit - gi; // >= 1 lit, (0,1) springing, <= 0 unsung
      const on = k >= 1 ? 1 : k > 0 ? k : 0;
      const sty = on >= 1 ? sS : on > 0 ? sS : sU;
      c.save();
      c.font = font(sty.fam, sty.size);
      c.textBaseline = 'alphabetic';
      let gx = x + gl.x;
      if (sty === sU && sU.fam !== sS.fam) gx += (gl.w - (layU.glyphs[gi]?.w ?? gl.w)) / 2;
      let gy = base;
      if (on > 0 && on < 1) {
        // the springing letter: rises from 18% below, overshoots, settles; its ink comes up with it
        const e = 1 - Math.pow(1 - on, 3);
        gy += (1 - e) * sty.size * 0.16 - Math.sin(on * Math.PI) * sty.size * 0.03;
        c.fillStyle = sU.col;
        c.font = font(sU.fam, sU.size);
        c.globalAlpha = 1 - e;
        c.fillText(gl.ch, x + gl.x + (sU.fam !== sS.fam ? (gl.w - (layU.glyphs[gi]?.w ?? gl.w)) / 2 : 0), base);
        c.globalAlpha = e;
        c.font = font(sty.fam, sty.size);
      }
      c.fillStyle = sty.col;
      c.fillText(gl.ch, gx, gy);
      c.restore();
    });
    out.push({ w, text, x, width: lay.width, style: sS, p: st.p, isHero });
    x += lay.width + gap;
  });
  return out;
}

/** A hairline bracket under a run of the line, with its state named. */
export function bracket(c: CanvasRenderingContext2D, x0: number, x1: number, y: number, name: string, col = trgba('silver', 0.9), tcol = trgba('halide', 0.9)) {
  c.fillStyle = col;
  c.fillRect(x0, y, x1 - x0, 1);
  c.fillRect(x0, y - 6, 1, 7);
  c.fillRect(x1 - 1, y - 6, 1, 7);
  cap(c, name, x0, y + 18, { col: tcol, size: 11, track: 2 });
}
