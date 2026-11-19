// Plate 3 `scene`: the faces of the evidence markers, baked to atlases. A marker is a lopsided folded placard: its big
// shallow front slope carries the word (Archivo, ink on card stock), a numbered tab, a ruled border. Heroes get two
// atlases (A: the unsung state, wide and light; B: the sung state, condensed and black: the snap on the word's onset).
// Supporting words get small cards, one cell per word (shelf-packed). Faces are drawn in centimetres.
import * as THREE from 'three';
import { F, font } from '../../engine/type';

export const HERO_D = 26, HERO_H = 7.5;
export const HERO_LS = Math.hypot(0.78 * HERO_D, HERO_H);
export const SMALL_D = 6.5, SMALL_H = 2.6;
export const SMALL_LS = Math.hypot(0.78 * SMALL_D, SMALL_H);
export const SMALL_CAP = 2.8;
export const TAG_D = 9, TAG_H = 0.35, TAG_W = 23;
export const TAG_LS = Math.hypot(0.78 * TAG_D, TAG_H);
export const TAG_TEXT = '08-32 · EXHIBIT 2';

export interface Rect { u0: number; vtop: number; du: number; dv: number; tpc: number; faceW: number }

/** Hero faces: [word, number on the tab, face width (cm)]. */
export const HEROES: [string, number, number][] = [
  ['STRANGER', 1, 62], ['LOVE', 2, 40], ['DEAD', 3, 40], ['PUSH', 4, 40], ['STAY', 5, 40],
];
const PPCM = 24;

function canvas(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000';
  c.fillRect(0, 0, w, h);
  return { cv, c };
}
function toTex(cv: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(cv);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  return t;
}
function measure(c: CanvasRenderingContext2D, fam: string, text: string) {
  c.font = font(fam, 100);
  const m = c.measureText(text);
  return { w: m.width / 100, asc: m.actualBoundingBoxAscent / 100 };
}

function drawHeroFace(c: CanvasRenderingContext2D, word: string, n: number, W: number, heavy: boolean) {
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  c.lineWidth = 0.5;
  c.strokeRect(1.0, 1.0, W - 2.0, HERO_LS - 2.0);
  // the numbered tab: a filled square, the digit knocked out of it
  c.fillRect(1.9, 1.9, 4.6, 4.6);
  c.fillStyle = '#000';
  c.font = font(F.mono(700), 3.6);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(String(n), 4.2, 4.3);
  // the word
  const fam = heavy ? F.archivo(62, 900) : F.archivo(125, 300);
  const m = measure(c, fam, word);
  const x0 = 7.6, avail = W - 2.4 - x0;
  const size = Math.min(avail / m.w, (heavy ? 12.6 : 8.2) / m.asc);
  c.fillStyle = '#fff';
  c.font = font(fam, size);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillText(word, x0 + avail / 2, HERO_LS / 2 + (m.asc * size) / 2 + 0.6);
}

export function buildHeroAtlases() {
  const SZ = 2048;
  const A = canvas(SZ, SZ), B = canvas(SZ, SZ);
  const rects: Record<string, Rect> = {};
  const layout: [string, number, number, number, number][] = []; // key, x, y, face w, face h
  let x = 8, y = 8;
  const hw = HEROES.map((h) => h[2]);
  // rows: STRANGER; LOVE + DEAD; PUSH + STAY
  const placeAt = (key: string, px: number, py: number, w: number, h: number) => layout.push([key, px, py, w, h]);
  const rh = Math.ceil(HERO_LS * PPCM) + 10;
  placeAt('STRANGER', 8, 8, hw[0]!, HERO_LS);
  placeAt('LOVE', 8, 8 + rh, hw[1]!, HERO_LS);
  placeAt('DEAD', 8 + Math.ceil(hw[1]! * PPCM) + 10, 8 + rh, hw[2]!, HERO_LS);
  placeAt('PUSH', 8, 8 + 2 * rh, hw[3]!, HERO_LS);
  placeAt('STAY', 8 + Math.ceil(hw[3]! * PPCM) + 10, 8 + 2 * rh, hw[4]!, HERO_LS);
  placeAt('TAG', 8, 8 + 3 * rh, TAG_W, TAG_LS);
  void x; void y;
  for (const [key, px, py, w, h] of layout) {
    const cw = Math.ceil(w * PPCM), ch = Math.ceil(h * PPCM);
    if (key === 'TAG') {
      for (const [k, S] of [[B, true]] as const) {
        const c = k.c;
        c.save(); c.beginPath(); c.rect(px, py, cw, ch); c.clip();
        c.setTransform(PPCM, 0, 0, PPCM, px, py);
        c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = 0.28;
        c.strokeRect(0.6, 0.6, w - 1.2, h - 1.2);
        const fam = F.mono(600);
        const m = measure(c, fam, TAG_TEXT);
        const size = Math.min((w - 3.4) / m.w, 1.55 / m.asc);
        c.font = font(fam, size); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.fillText(TAG_TEXT, w / 2, h / 2 + (m.asc * size) / 2);
        c.restore();
        void S;
      }
    } else {
      const hero = HEROES.find((hh) => hh[0] === key)!;
      for (const [k, heavy] of [[A, false], [B, true]] as const) {
        const c = k.c;
        c.save(); c.beginPath(); c.rect(px, py, cw, ch); c.clip();
        c.setTransform(PPCM, 0, 0, PPCM, px, py);
        drawHeroFace(c, hero[0], hero[1], w, heavy);
        c.restore();
      }
    }
    rects[key] = { u0: px / SZ, vtop: 1 - py / SZ, du: (w * PPCM) / SZ, dv: (h * PPCM) / SZ, tpc: PPCM, faceW: w };
  }
  return { A: toTex(A.cv), B: toTex(B.cv), rects };
}

const SMALL_PPCM = 36;
export function smallFamily() { return F.archivo(100, 500); }

/** One cell per word; the face is the word's width plus margins. */
export function buildSmallAtlas(words: string[]) {
  const SZ = 2048;
  const { cv, c } = canvas(SZ, SZ);
  const rects: Record<string, Rect> = {};
  const fam = smallFamily();
  let x = 8, y = 8;
  const rh = Math.ceil(SMALL_LS * SMALL_PPCM) + 10;
  for (const w of words) {
    if (rects[w]) continue;
    const m = measure(c, fam, w);
    const size = SMALL_CAP / m.asc;
    const faceW = Math.max(m.w * size + 3.0, 7);
    const cw = Math.ceil(faceW * SMALL_PPCM);
    if (x + cw + 8 > SZ) { x = 8; y += rh; }
    c.save(); c.beginPath(); c.rect(x, y, cw, Math.ceil(SMALL_LS * SMALL_PPCM)); c.clip();
    c.setTransform(SMALL_PPCM, 0, 0, SMALL_PPCM, x, y);
    c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = 0.2;
    c.strokeRect(0.5, 0.5, faceW - 1.0, SMALL_LS - 1.0);
    c.font = font(fam, size); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillText(w, faceW / 2, SMALL_LS / 2 + (m.asc * size) / 2);
    c.restore();
    rects[w] = { u0: x / SZ, vtop: 1 - y / SZ, du: cw / SZ, dv: Math.ceil(SMALL_LS * SMALL_PPCM) / SZ, tpc: SMALL_PPCM, faceW };
    x += cw + 10;
  }
  return { tex: toTex(cv), rects };
}
