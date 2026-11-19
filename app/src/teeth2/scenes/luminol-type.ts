// Plate 11 `luminol`: what is printed on the evidence bag. The bag is a clear polyethylene bag (480 x 640 mm) hanging
// in front of the shirt; bag coordinates are mm, u right (= world x), v up from the bag's top edge (so the face is
// v in [-640, 0]). Three textures:
//   lyric  one atlas tile per phrase (8 phrases, 4 x 2 tiles, 1.6 px/mm), the phrase's words in white, blurred into a
//          soft ramp (thresholded in the shader: a crisp edge at any scale, and the hero's light-to-heavy snap); words
//          of one phrase never overlap, so each word is gated by its own rectangle (`LWord.rect`)
//   label  the bag's printed label, top left: a barcode band, NAME: with its blank line, two blank lines (the plate's
//          one readable label; NAME stays blank)
//   seal   the adhesive flap (410 x 55 mm) with a tamper hatch; the T.F. monogram is signed on it at the end
import * as THREE from 'three';
import { F, font } from '../../engine/type';
import type { Line } from '../../engine/lyrics';
import { drawMonogram, MONO_H } from '../monogram';
import { trgba } from '../palette';

export const BAG = { hw: 240, h: 640 };
/** Atlas: px per bag mm, tile size (px), tiles across / down. */
export const APPM = 1.6;
export const TILE_W = BAG.hw * 2 * APPM, TILE_H = BAG.h * APPM;
export const ATLAS_C = 4, ATLAS_R = 2;
/** The label (bag mm): left, top, width, height. */
export const LABEL = { u0: -150, v0: -78, w: 140, h: 85 };
const LPPM = 8;
/** NAME's blank line on the label (label mm from its top-left): x0, x1, y. */
export const NAME_LINE = { x0: 33, x1: 128, y: 36 };
/** The seal flap (bag mm): half width, height; where the signature box sits (flap mm from its top-left), its width. */
export const FLAP = { hw: 205, h: 55 };
const SPPM = 5;
export const SIGN = { x: 245, y: 7, size: Math.min(128, 41 / MONO_H) };

export interface LWord {
  text: string; start: number; end: number; hero: boolean; serif: boolean;
  /** bag mm: u0, v0 (top), u1, v1 (bottom), dilated */
  rect: [number, number, number, number];
}
export interface LPhrase { words: LWord[]; t0: number; tile: number; line: number }

interface Row { ws: number[]; cap: number; fam: 'row' | 'hero' | 'serif'; x: number; base: number; align?: 'left' | 'center'; maxW?: number }
/** The phrases: [line, word indices, hero index or -1, rows]. Rows index into the phrase's words. Bag mm; the glow
 *  sits behind (110, -190), so the heroes are set over it. */
const SPEC: [number, number[], number, Row[]][] = [
  [0, [0, 1, 2, 3], 3, [
    { ws: [0, 1, 2], cap: 25, fam: 'row', x: 0, base: -122 },
    { ws: [3], cap: 108, fam: 'hero', x: 62, base: -280, align: 'center', maxW: 340 }]],
  [0, [4, 5, 6, 7], 4, [
    { ws: [0], cap: 150, fam: 'serif', x: 70, base: -262, align: 'center', maxW: 330 },
    { ws: [1, 2, 3], cap: 25, fam: 'row', x: -10, base: -322 }]],
  [1, [0, 1, 2, 3], -1, [
    { ws: [0, 1], cap: 28, fam: 'row', x: -60, base: -205 },
    { ws: [2, 3], cap: 28, fam: 'row', x: -60, base: -252 }]],
  [1, [4, 5, 6, 7], -1, [
    { ws: [0, 1], cap: 26, fam: 'row', x: 6, base: -104 },
    { ws: [2, 3], cap: 26, fam: 'row', x: 6, base: -146 }]],
  [1, [8, 9, 10], 8, [
    { ws: [0], cap: 96, fam: 'hero', x: 8, base: -190, maxW: 222 },
    { ws: [1, 2], cap: 26, fam: 'row', x: 8, base: -236 }]],
  [2, [0, 1, 2, 3], -1, [
    { ws: [0, 1], cap: 32, fam: 'row', x: -4, base: -178 },
    { ws: [2, 3], cap: 32, fam: 'row', x: -4, base: -228 }]],
  [2, [4, 5, 6, 7], 4, [
    { ws: [0], cap: 108, fam: 'hero', x: 62, base: -280, align: 'center', maxW: 340 },
    { ws: [1, 2, 3], cap: 25, fam: 'row', x: -10, base: -334 }]],
  [3, [0, 1], 1, [
    { ws: [0], cap: 28, fam: 'row', x: -60, base: -205 },
    { ws: [1], cap: 84, fam: 'hero', x: 62, base: -305, align: 'center', maxW: 350 }]],
];

const FAM = { row: () => F.archivo(125, 300), hero: () => F.archivo(62, 900), serif: () => F.serif(600, true) };
const clean = (s: string) => s.replace(/[,.!?]/g, '');

export function bakeLyric(lines: Line[]): { phrases: LPhrase[]; tex: THREE.CanvasTexture } {
  const cv = document.createElement('canvas'); cv.width = TILE_W * ATLAS_C; cv.height = TILE_H * ATLAS_R;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  c.textBaseline = 'alphabetic';
  const capRatio = (fam: string) => { c.font = font(fam, 1000); return c.measureText('H').actualBoundingBoxAscent / 1000; };
  const phrases: LPhrase[] = [];
  SPEC.forEach(([li, idx, hero, rows], pi) => {
    const line = lines[li]!;
    const ox = (pi % ATLAS_C) * TILE_W, oy = Math.floor(pi / ATLAS_C) * TILE_H;
    const X = (u: number) => ox + (u + BAG.hw) * APPM, Y = (v: number) => oy - v * APPM;
    const words: LWord[] = idx.map((wi, k) => {
      const w = line.words[wi]!;
      const isHero = wi === hero;
      const serif = isHero && rows.some((r) => r.fam === 'serif' && r.ws.includes(k));
      const raw = clean(w.w);
      return { text: isHero && !serif ? raw.toUpperCase() : raw.toLowerCase(), start: w.start, end: w.end, hero: isHero, serif, rect: [0, 0, 0, 0] as [number, number, number, number] };
    });
    // first word of a line keeps its capital (Blood, You’re, Still) when it is not a hero
    if (idx[0] === 0 && !words[0]!.hero) words[0]!.text = clean(line.words[0]!.w);
    // "I" stays a capital
    for (const w of words) if (w.text === 'i') w.text = 'I';
    for (const r of rows) {
      const fam = FAM[r.fam]();
      let size = r.cap / capRatio(fam);
      c.font = font(fam, size * APPM);
      const text = r.ws.map((k) => words[k]!.text).join(' ');
      let wTot = c.measureText(text).width / APPM;
      const maxW = r.maxW ?? (r.align === 'center' ? 440 : BAG.hw - 10 - r.x);
      if (wTot > maxW) { size *= maxW / wTot; c.font = font(fam, size * APPM); wTot = maxW; }
      const space = c.measureText(' ').width / APPM;
      let u = r.align === 'center' ? r.x - wTot / 2 : r.x;
      const blur = r.fam === 'row' ? 1.4 : 2.6;
      c.filter = `blur(${blur}px)`;
      c.fillStyle = '#fff';
      for (const k of r.ws) {
        const w = words[k]!;
        const m = c.measureText(w.text);
        const ww = m.width / APPM;
        c.fillText(w.text, X(u), Y(r.base));
        const asc = m.actualBoundingBoxAscent / APPM, desc = m.actualBoundingBoxDescent / APPM;
        const pad = 4;
        w.rect = [u - pad, r.base + asc + pad, u + ww + pad, r.base - desc - pad];
        u += ww + space;
      }
      c.filter = 'none';
    }
    phrases.push({ words, t0: words[0]!.start, tile: pi, line: li });
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace; tex.flipY = false; tex.anisotropy = 8; tex.needsUpdate = true;
  return { phrases, tex };
}

export function bakeLabel(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = LABEL.w * LPPM; cv.height = LABEL.h * LPPM;
  const c = cv.getContext('2d')!;
  const M = (x: number) => x * LPPM;
  c.fillStyle = trgba('lightbox'); c.fillRect(0, 0, cv.width, cv.height);
  // a barcode band (bars only, no digits)
  c.fillStyle = trgba('film');
  let x = 8, seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (x < 92) { const w = 0.35 + rnd() * 1.2; if (rnd() > 0.35) c.fillRect(M(x), M(6), M(w), M(12)); x += w + 0.3 + rnd() * 0.6; }
  // NAME: and its blank line
  c.font = font(F.mono(500), M(7) / 0.7);
  c.textBaseline = 'alphabetic';
  c.fillText('NAME:', M(8), M(NAME_LINE.y));
  c.fillStyle = trgba('silver');
  c.fillRect(M(NAME_LINE.x0), M(NAME_LINE.y + 0.4), M(NAME_LINE.x1 - NAME_LINE.x0), M(0.45));
  c.fillRect(M(8), M(54), M(120), M(0.45));
  c.fillRect(M(8), M(71), M(120), M(0.45));
  c.strokeStyle = trgba('silver', 0.8); c.lineWidth = M(0.5);
  c.strokeRect(M(2.5), M(2.5), M(LABEL.w - 5), M(LABEL.h - 5));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

/** The seal flap's print, redrawn while the monogram is being signed. */
export class SealInk {
  cv = document.createElement('canvas');
  private base = document.createElement('canvas');
  tex: THREE.CanvasTexture;
  private len = -1;
  constructor() {
    const W = FLAP.hw * 2 * SPPM, H = FLAP.h * SPPM;
    for (const k of [this.cv, this.base]) { k.width = W; k.height = H; }
    const c = this.base.getContext('2d')!;
    c.fillStyle = trgba('lightbox'); c.fillRect(0, 0, W, H);
    // the tamper hatch: fine diagonal lines, and a perforated tear line near the top
    c.strokeStyle = trgba('halide', 0.55); c.lineWidth = 0.7 * SPPM * 0.5;
    for (let x = -H; x < W; x += 3.2 * SPPM) { c.beginPath(); c.moveTo(x, H); c.lineTo(x + H, 0); c.stroke(); }
    c.fillStyle = trgba('silver', 0.9);
    for (let x = 4; x < FLAP.hw * 2 - 4; x += 3) c.fillRect(x * SPPM, 3.2 * SPPM, 1.6 * SPPM, 0.5 * SPPM);
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.NoColorSpace; this.tex.flipY = false; this.tex.anisotropy = 8;
    this.draw(0);
  }
  draw(len: number) {
    if (Math.abs(len - this.len) < 1e-4) return;
    this.len = len;
    const c = this.cv.getContext('2d')!;
    c.drawImage(this.base, 0, 0);
    if (len > 0) drawMonogram(c, len, { x: SIGN.x * SPPM, y: SIGN.y * SPPM, size: SIGN.size * SPPM, color: trgba('film'), width: SIGN.size * SPPM * 0.03 });
    this.tex.needsUpdate = true;
  }
}
/** A point of the monogram's unit box -> flap mm. */
export const monoToFlap = (x: number, y: number): [number, number] => [SIGN.x + x * SIGN.size, SIGN.y + y * SIGN.size];
