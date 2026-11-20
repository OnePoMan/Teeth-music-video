// `scale` bite bake. (1) His bite's tooth spans (teeth.ts biteMark(HIS)): where along the bite each anterior tooth's
// incisal edge cut the rim of the crescent scooped out of the apple (photo frame: mm, X right = the biter's right, Y up,
// origin at the centre of the bite). #8's span starts late at its mesial end (the kit's diagonal facet): the chip's
// notch in the scalloped rim. (2) Hero words bitten OUT of the apple's flank: a signed distance field of Archivo
// condensed black capitals, each stroke built as a chain of tooth-width scallop bites (a union of overlapping bites
// along the stroke, held to the letter's outline), the letter over #8's position carrying the same diagonal notch.
import * as THREE from 'three';
import { biteMark, HIS } from '../teeth';
import { F, font } from '../../engine/type';

/** The baked patch (photo mm) and its resolution (texels per mm). */
export const PATCH = { x0: -28, y0: -20, x1: 28, y1: 22, ppm: 24 };
export const PATCH_W = Math.round((PATCH.x1 - PATCH.x0) * PATCH.ppm);
export const PATCH_H = Math.round((PATCH.y1 - PATCH.y0) * PATCH.ppm);
const FAR = 6;

/** The word's line (a near-straight arc), cap height, span, tracking, the scallop pitch. */
export const WORD = { cy: -400, r: 400, cap: 9.0, span: 27, track: 0.8, pitch: 1.15 };

type P2 = [number, number];

const texX = (i: number) => PATCH.x0 + (i + 0.5) / PATCH.ppm;
const texY = (j: number) => PATCH.y0 + (j + 0.5) / PATCH.ppm;
function texRange(a: number, b: number, o: number, n: number) {
  return [Math.max(0, Math.floor((a - o) * PATCH.ppm)), Math.min(n - 1, Math.ceil((b - o) * PATCH.ppm))] as const;
}

function halfTex(data: Float32Array, channels: 1 | 4) {
  const h = new Uint16Array(data.length);
  for (let k = 0; k < data.length; k++) h[k] = THREE.DataUtils.toHalfFloat(data[k]!);
  const tex = new THREE.DataTexture(h, PATCH_W, PATCH_H, channels === 4 ? THREE.RGBAFormat : THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** His bite's anterior teeth as spans along the bite (photo X, mm): [x0, x1, depth (0..1), n], upper and lower. */
export function toothSpans(): { upper: number[][]; lower: number[][] } {
  const bm = biteMark(HIS);
  const span = (m: (typeof bm.upper)[number]) => {
    let x0 = Infinity, x1 = -Infinity;
    for (const p of m.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
    return [x0, x1, m.depth, m.n];
  };
  return { upper: bm.upper.map(span).sort((a, b) => a[0]! - b[0]!), lower: bm.lower.map(span).sort((a, b) => a[0]! - b[0]!) };
}

/** One hero word bitten between the arcs (see the header). `serif`: Cormorant italic (the tender register). `minW`: a
 *  short word (GO) is bitten taller, up to this width (mm), so it still spans the frame without filling it with skin. */
export function bakeWord(word: string, serif = false, minW = 0): { tex: THREE.DataTexture; chip: P2; width: number } {
  const text = word.toUpperCase();
  const chars = Array.from(serif ? word.toLowerCase() : text);
  // 1. the letters' mask, drawn into the patch (canvas y down: row 0 = PATCH.y1)
  const cv = document.createElement('canvas');
  cv.width = PATCH_W; cv.height = PATCH_H;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const fam = serif ? F.serif(600, true) : F.archivo(62, 900);
  const ppm = PATCH.ppm;
  let size = (WORD.cap / 0.72) * ppm;
  c.font = font(fam, size);
  const widths = () => chars.map((ch) => c.measureText(ch).width / ppm);
  let w = widths();
  let total = w.reduce((a, b) => a + b, 0) + WORD.track * (chars.length - 1);
  if (total < minW) {
    size *= Math.min(minW / total, 1.7);
    c.font = font(fam, size);
    w = widths();
    total = w.reduce((a, b) => a + b, 0) + WORD.track * (chars.length - 1);
  }
  if (total > WORD.span) {
    size *= WORD.span / total;
    c.font = font(fam, size);
    w = widths();
    total = w.reduce((a, b) => a + b, 0) + WORD.track * (chars.length - 1);
  }
  const capMm = (size / ppm) * 0.72;
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  let acc = -total / 2;
  // the letter over #8's position (its centre ~4.2 mm right of the bite's midline) carries his chip
  const centres = chars.map((_, i) => { const s = acc + w.slice(0, i).reduce((a, b) => a + b, 0) + WORD.track * i + w[i]! / 2; return s; });
  let chipI = 0;
  centres.forEach((s, i) => { if (Math.abs(s - 4.22) < Math.abs(centres[chipI]! - 4.22)) chipI = i; });
  let chip: P2 = [4.2, capMm / 2];
  chars.forEach((ch, i) => {
    const s = centres[i]!;
    const th = s / WORD.r;
    const X = WORD.r * Math.sin(th), Y = WORD.cy + WORD.r * Math.cos(th);
    c.save();
    c.translate((X - PATCH.x0) * ppm, (PATCH.y1 - Y) * ppm);
    c.rotate(th);
    c.fillText(ch, 0, (capMm / 2) * ppm);
    if (i === chipI && !serif) {
      // the kit's chip (CHIP_8): a small diagonal break off the mesial-incisal corner. Less of the letter is bitten there (a
      // small unbitten wedge), the letter's arm intact
      const mt = c.measureText(ch);
      const L = -mt.actualBoundingBoxLeft, R = mt.actualBoundingBoxRight, T = -(capMm / 2) * ppm, capPx = capMm * ppm;
      const wpx = R - L;
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      c.moveTo(L - 4, T - 4);
      c.lineTo(L + 0.17 * wpx, T - 4);
      c.lineTo(L + 0.17 * wpx, T);
      c.lineTo(L, T + 0.13 * capPx);
      c.lineTo(L - 4, T + 0.13 * capPx);
      c.closePath();
      c.fill();
      c.globalCompositeOperation = 'source-over';
      const lx = L + 0.08 * wpx, ly = T + 0.07 * capPx;
      const px = (X - PATCH.x0) * ppm + lx * Math.cos(th) - ly * Math.sin(th), py = (PATCH.y1 - Y) * ppm + lx * Math.sin(th) + ly * Math.cos(th);
      chip = [PATCH.x0 + px / ppm, PATCH.y1 - py / ppm];
    }
    c.restore();
  });
  const img = c.getImageData(0, 0, PATCH_W, PATCH_H).data;
  const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < PATCH_W && j < PATCH_H && img[(j * PATCH_W + i) * 4 + 3]! > 127;
  // 2. the letters' exact signed distance (two Euclidean distance transforms of the mask), in mm
  const inMask = new Uint8Array(PATCH_W * PATCH_H);
  for (let j = 0; j < PATCH_H; j++) for (let i = 0; i < PATCH_W; i++) inMask[j * PATCH_W + i] = inside(i, j) ? 1 : 0;
  const dOut = edt(inMask, 1), dIn = edt(inMask, 0);
  let hwMax = 0;
  for (let k = 0; k < dIn.length; k++) if (inMask[k]) hwMax = Math.max(hwMax, dIn[k]!);
  hwMax /= ppm;
  // 3. the bites: centres on a hex grid along the strokes (where the stroke is near its full width), each as wide as
  // the stroke there; their union, held to just outside the letter's outline, scallops the edges and leaves a ridge
  // between neighbouring bites on the floor
  let bi0 = PATCH_W, bi1 = 0, bj0 = PATCH_H, bj1 = 0;
  for (let j = 0; j < PATCH_H; j++) for (let i = 0; i < PATCH_W; i++) if (inMask[j * PATCH_W + i]) { bi0 = Math.min(bi0, i); bi1 = Math.max(bi1, i); bj0 = Math.min(bj0, j); bj1 = Math.max(bj1, j); }
  const discs: number[] = [];
  const g = WORD.pitch;
  const y0 = PATCH.y1 - bj1 / ppm, y1 = PATCH.y1 - bj0 / ppm, x0 = PATCH.x0 + bi0 / ppm, x1 = PATCH.x0 + bi1 / ppm;
  for (let row = 0, Y = y0; Y <= y1; row++, Y += g * 0.866) {
    for (let X = x0 + (row % 2) * g * 0.5; X <= x1; X += g) {
      const ci = Math.round((X - PATCH.x0) * ppm), cj = Math.round((PATCH.y1 - Y) * ppm);
      if (ci < 0 || cj < 0 || ci >= PATCH_W || cj >= PATCH_H) continue;
      const r = dIn[cj * PATCH_W + ci]! / ppm;
      if (r > 0.72 * hwMax) discs.push(X, Y, r + 0.12);
    }
  }
  const out = new Float32Array(PATCH_W * PATCH_H).fill(FAR);
  const CELL = 2.5, buckets = new Map<string, number[]>();
  for (let k = 0; k < discs.length; k += 3) {
    const key = `${Math.floor(discs[k]! / CELL)},${Math.floor(discs[k + 1]! / CELL)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(k);
  }
  const [i0, i1] = texRange(x0 - 3, x1 + 3, PATCH.x0, PATCH_W);
  const [j0, j1] = texRange(y0 - 3, y1 + 3, PATCH.y0, PATCH_H);
  for (let j = j0; j <= j1; j++) {
    const py = texY(j);
    for (let i = i0; i <= i1; i++) {
      const px = texX(i);
      const idx = (PATCH_H - 1 - j) * PATCH_W + i; // mask rows run top-down
      const sLetter = (dOut[idx]! - dIn[idx]!) / ppm;
      const bx = Math.floor(px / CELL), by = Math.floor(py / CELL);
      let sd = FAR;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const list = buckets.get(`${bx + a},${by + b}`);
        if (!list) continue;
        for (const k of list) sd = Math.min(sd, Math.hypot(px - discs[k]!, py - discs[k + 1]!) - discs[k + 2]!);
      }
      out[j * PATCH_W + i] = Math.max(sLetter - 0.08, Math.min(sd, sLetter + 0.22));
    }
  }
  return { tex: halfTex(out, 1), chip, width: total };
}

/** Euclidean distance transform (Felzenszwalb–Huttenlocher), in pixels: distance from each pixel to the nearest pixel
 *  whose mask value equals `target`. */
function edt(mask: Uint8Array, target: number): Float32Array {
  const W = PATCH_W, H = PATCH_H, INF = 1e12;
  const f = new Float64Array(Math.max(W, H)), d = new Float64Array(Math.max(W, H));
  const v = new Int32Array(Math.max(W, H)), z = new Float64Array(Math.max(W, H) + 1);
  const g = new Float64Array(W * H);
  for (let k = 0; k < W * H; k++) g[k] = mask[k] === target ? 0 : INF;
  const pass = (n: number, get: (q: number) => number, set: (q: number, x: number) => void) => {
    for (let q = 0; q < n; q++) f[q] = get(q);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
      while (s <= z[k]!) { k--; s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1]! < q) k++; d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!; }
    for (let q = 0; q < n; q++) set(q, d[q]!);
  };
  for (let x = 0; x < W; x++) pass(H, (q) => g[q * W + x]!, (q, val) => { g[q * W + x] = val; });
  for (let y = 0; y < H; y++) pass(W, (q) => g[y * W + q]!, (q, val) => { g[y * W + q] = val; });
  const out = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) out[k] = Math.sqrt(g[k]!);
  return out;
}
