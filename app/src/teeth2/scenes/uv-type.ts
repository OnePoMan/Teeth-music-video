// Plate 6 `uv`: the lyric as dried traces on the pillowcase. Every word of the window is laid out once on the cloth
// (cloth mm, x right, y away from the camera; the case is 760 x 510 mm) and baked into two textures in cloth space:
//   cov  the trace's coverage, blurred into a soft distance-like ramp (thresholded in the shader: a dried edge that
//        can be eroded, so a hero word appears thin and snaps heavy on its onset with its letters locked in place)
//   id   which word a texel belongs to (dilated round each word; read with texelFetch), so each word is gated by its
//        own sung onset and its phrase's exit.
// Layout: one line per row of the case, two blocks per row (the line's two hero words, as in plate 5: DIRTY, sweet,
// PRETTY, TEETH, DEVIL, HANDS, NEVER x3, GO). A block is a row of small supporting words (Archivo wide) over its hero
// (Archivo condensed black; "sweet" in Cormorant italic, the tender register). GO sits in the free centre column.
import * as THREE from 'three';
import { F, font } from '../../engine/type';
import type { Line } from '../../engine/lyrics';

export const CLOTH = { x0: -380, x1: 380, y0: -255, y1: 255 };
/** Texels per cloth mm. */
export const TPPM = 5;
export const TW = (CLOTH.x1 - CLOTH.x0) * TPPM;
export const TH = (CLOTH.y1 - CLOTH.y0) * TPPM;
/** The evidence tag (EXHIBIT 5, the plate's one label): lying on the hem near the open end; centre, half size (mm),
 *  rotation (rad). */
export const TAG = { x: 214, y: -120, hx: 30, hy: 13, rot: 0.12 };

export interface TWord {
  id: number; text: string; start: number; end: number; hero: boolean; serif?: boolean;
  /** centre and size on the cloth (mm) */
  x: number; y: number; w: number; h: number;
  phrase: number;
}
export interface TPhrase { words: TWord[]; t0: number; t1: number; block: [number, number]; hero: TWord | null }

interface BlockSpec { line: number; x0: number; base: number; row: number[]; hero: number; after?: number[]; below?: number[]; cap?: number; maxW?: number; serif?: boolean }

const ROW_CAP = 16, ROW_GAP = 12, HERO_CAP = 60;
const ROW_FAM = () => F.archivo(100, 500);
const HERO_FAM = () => F.archivo(62, 900);
const SERIF_FAM = () => F.serif(600, true);

/** The blocks (lines A..D = the window's four lines, word indices into each line). */
const BLOCKS: BlockSpec[] = [
  { line: 0, x0: -330, base: 150, row: [0, 1, 3, 4], hero: 2 },
  { line: 0, x0: 100, base: 150, row: [5, 6], hero: 7, serif: true, maxW: 215 },
  { line: 1, x0: -330, base: 30, row: [0, 1, 3, 4], hero: 2 },
  { line: 1, x0: 100, base: 30, row: [5, 6], hero: 7 },
  { line: 2, x0: -330, base: -90, row: [0, 1], hero: 2 },
  { line: 2, x0: 100, base: -90, row: [3, 4], hero: 5, below: [6, 7], maxW: 190 },   // "on me" under HANDS, clear of the tag's string
  { line: 3, x0: -335, base: -215, row: [0], hero: 1, cap: 40, maxW: 150 },
  { line: 3, x0: -80, base: -215, row: [], hero: 2, cap: 40, maxW: 150 },
  { line: 3, x0: 125, base: -215, row: [], hero: 3, after: [4], cap: 40, maxW: 140 },
  { line: 3, x0: -48, base: -150, row: [5], hero: 6, cap: 60, maxW: 108 },
];
/** The phrases on screen (1-4 words each): [line, word indices, hero index or -1]. */
const PHRASES: [number, number[], number][] = [
  [0, [0, 1, 2], 2], [0, [3, 4], -1], [0, [5, 6, 7], 7],
  [1, [0, 1, 2], 2], [1, [3, 4], -1], [1, [5, 6, 7], 7],
  [2, [0, 1, 2], 2], [2, [3, 4], -1], [2, [5, 6, 7], 5],
  [3, [0, 1], 1], [3, [2], 2], [3, [3, 4], 3], [3, [5, 6], 6],
];

const clean = (s: string) => s.replace(/[,.!?]/g, '');

/** The tag's face: manila card, the label in Plex Mono (lab text lives only inside objects). */
export function bakeTag(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 544; cv.height = 240;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#000'; c.textBaseline = 'middle'; c.textAlign = 'center';
  c.font = font(F.mono(500), 62);
  c.fillText('EXHIBIT 5', cv.width / 2 + 34, cv.height / 2 - 6);
  c.fillRect(150, 162, 300, 4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

export interface Baked { words: TWord[]; phrases: TPhrase[]; cov: THREE.CanvasTexture; id: THREE.CanvasTexture }

/** Lays the lyric out on the cloth and bakes the textures. `lines`: the window's four lines in order. */
export function bakeTraces(lines: Line[], beats: number[], plateEnd: number): Baked {
  const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, TW, TH);
  const iv = document.createElement('canvas'); iv.width = TW; iv.height = TH;
  const ic = iv.getContext('2d')!;
  ic.fillStyle = '#000'; ic.fillRect(0, 0, TW, TH);
  const X = (x: number) => (x - CLOTH.x0) * TPPM, Y = (y: number) => (CLOTH.y1 - y) * TPPM;
  const capRatio = (fam: string) => { c.font = font(fam, 1000); return c.measureText('H').actualBoundingBoxAscent / 1000; };

  const words: TWord[] = [];
  const byKey = new Map<string, TWord>();
  const place = (li: number, wi: number, text: string, fam: string, sizeMM: number, x0: number, base: number, hero: boolean, blur = 4) => {
    const px = sizeMM * TPPM;
    c.font = font(fam, px);
    const m = c.measureText(text);
    const w = m.width / TPPM;
    const asc = m.actualBoundingBoxAscent / TPPM, desc = m.actualBoundingBoxDescent / TPPM;
    const wd = lines[li]!.words[wi]!;
    const tw: TWord = { id: words.length + 1, text, start: wd.start, end: wd.end, hero, x: x0 + w / 2, y: base + (asc - desc) / 2, w, h: asc + desc, phrase: -1 };
    words.push(tw);
    byKey.set(`${li}:${wi}`, tw);
    // coverage: white on black, blurred (heroes wider: their threshold erodes them to a light weight)
    c.save();
    c.filter = `blur(${blur}px)`;
    c.fillStyle = '#fff'; c.textBaseline = 'alphabetic';
    c.fillText(text, X(x0), Y(base));
    c.restore();
    // id: dilated round the word (heroes first, so a later small word's own id wins where they meet)
    return { tw, fam, px, x0, base };
  };
  const idDraws: { tw: TWord; fam: string; px: number; x0: number; base: number }[] = [];

  for (const b of BLOCKS) {
    const L = lines[b.line]!;
    const cap = b.cap ?? HERO_CAP;
    const hfam = b.serif ? SERIF_FAM() : HERO_FAM();
    const htext = b.serif ? clean(L.words[b.hero]!.w).toLowerCase() : clean(L.words[b.hero]!.w).toUpperCase();
    let size = cap / capRatio(hfam);
    c.font = font(hfam, size * TPPM);
    const maxW = b.maxW ?? 225;
    const wHero = c.measureText(htext).width / TPPM;
    if (wHero > maxW) size *= maxW / wHero;
    idDraws.push(place(b.line, b.hero, htext, hfam, size, b.x0, b.base, true, b.serif ? 4 : 9));
    words[words.length - 1]!.serif = !!b.serif;
    const heroW = words[words.length - 1]!.w;
    const rfam = ROW_FAM();
    const rsize = ROW_CAP / capRatio(rfam);
    c.font = font(rfam, rsize * TPPM);
    const space = c.measureText(' ').width / TPPM * 1.15;
    const heroCapH = cap;
    let x = b.x0;
    for (const wi of b.row) {
      const t = clean(L.words[wi]!.w);
      const r = place(b.line, wi, t, rfam, rsize, x, b.base + heroCapH + ROW_GAP, false);
      idDraws.push(r);
      x += r.tw.w + space;
    }
    x = b.x0 + heroW + 9;
    for (const wi of b.after ?? []) {
      const t = clean(L.words[wi]!.w);
      const r = place(b.line, wi, t, rfam, rsize, x, b.base, false);
      idDraws.push(r);
      x += r.tw.w + space;
    }
    // a line's tail set under its hero, left-aligned (reads "HANDS / on me")
    x = b.x0;
    for (const wi of b.below ?? []) {
      const t = clean(L.words[wi]!.w);
      const r = place(b.line, wi, t, rfam, rsize, x, b.base - 57, false);   // under the tag's string, which lies across -118..-123
      idDraws.push(r);
      x += r.tw.w + space;
    }
  }
  // ids: heroes first
  idDraws.sort((a, b) => Number(b.tw.hero) - Number(a.tw.hero));
  for (const d of idDraws) {
    ic.font = font(d.fam, d.px);
    const col = `rgb(${d.tw.id},0,0)`;
    ic.fillStyle = col; ic.strokeStyle = col;
    ic.lineJoin = 'round';
    ic.lineWidth = (d.tw.hero ? 13 : 4) * 2 * TPPM;
    ic.strokeText(d.tw.text, X(d.x0), Y(d.base));
    ic.fillText(d.tw.text, X(d.x0), Y(d.base));
  }

  // phrases: a phrase hands over on the next phrase's onset; a line leaves on the next beat after it ends
  const phrases: TPhrase[] = PHRASES.map(([li, idx, hero]) => {
    const ws = idx.map((wi) => byKey.get(`${li}:${wi}`)!);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    // the block's extent: every word placed in the same block as this phrase's words
    for (const w of ws) { x0 = Math.min(x0, w.x - w.w / 2); x1 = Math.max(x1, w.x + w.w / 2); y0 = Math.min(y0, w.y - w.h / 2); y1 = Math.max(y1, w.y + w.h / 2); }
    return { words: ws, t0: ws[0]!.start - 0.045, t1: 0, block: [(x0 + x1) / 2, (y0 + y1) / 2] as [number, number], hero: hero >= 0 ? byKey.get(`${li}:${hero}`)! : null };
  });
  phrases.forEach((p, i) => {
    const nx = phrases[i + 1];
    const line = lines[PHRASES[i]![0]]!;
    const sameLine = nx && PHRASES[i + 1]![0] === PHRASES[i]![0];
    if (sameLine) p.t1 = nx!.t0;
    else {
      p.t1 = beats.find((b) => b > line.end + 0.02) ?? plateEnd;
      if (nx) p.t1 = Math.min(p.t1, nx.t0);
      p.t1 = Math.min(p.t1, plateEnd);
    }
    for (const w of p.words) w.phrase = i;
  });

  const tex = (cvs: HTMLCanvasElement, mips: boolean) => {
    const t = new THREE.CanvasTexture(cvs);
    t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = mips;
    t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
    t.magFilter = mips ? THREE.LinearFilter : THREE.NearestFilter;
    t.anisotropy = mips ? 8 : 1;
    t.needsUpdate = true;
    return t;
  };
  return { words, phrases, cov: tex(cv, true), id: tex(iv, false) };
}
