// `scale` bite bake: distance fields of the bite in the apple, computed once on the CPU (init) and sampled by the
// ray-march (scale-glsl.ts) as a height field. All in the bite's PHOTO frame (teeth.ts `biteMark`): mm, X right, Y up,
// origin at the centre of the bite, the biter's right on the image's right, upper arc above.
//
//  - marks texture (RGBA): signed distance (mm, negative inside) to R: his upper incisor marks (#7–#10; #8's mesial
//    end cut on the kit's diagonal facet: the chip), G: the four canine marks (#6, #11, #22, #27), B: his lower
//    incisor marks (#23–#26). Straight from biteMark(HIS); the shader sinks them as impressions.
//  - word textures (R): signed distance (mm) to a hero word bitten INSIDE the bite, between the two arcs: Archivo
//    condensed black capitals, each stroke built as a chain of tooth-width scallop impressions (a union of
//    overlapping bites along the stroke, each as wide as the stroke), so the letters' edges are scalloped like a bitten
//    edge and their floors carry a ridge between neighbouring bites.
import * as THREE from 'three';
import { biteMark, HIS, tooth } from '../teeth';
import { F, font } from '../../engine/type';

/** The baked patch (photo mm) and its resolution (texels per mm). */
export const PATCH = { x0: -28, y0: -20, x1: 28, y1: 22, ppm: 24 };
export const PATCH_W = Math.round((PATCH.x1 - PATCH.x0) * PATCH.ppm);
export const PATCH_H = Math.round((PATCH.y1 - PATCH.y0) * PATCH.ppm);
const FAR = 6;

/** The word's arc (between the bite's arcs, gently concave like the upper arc), cap height, the scallop pitch. */
export const WORD = { cy: -59, r: 59.8, cap: 9.0, span: 26.5, track: 0.75, pitch: 1.15 };

type P2 = [number, number];

function segD(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, qx = px - ax, qy = py - ay;
  const l2 = dx * dx + dy * dy;
  const h = l2 > 0 ? Math.max(0, Math.min(1, (qx * dx + qy * dy) / l2)) : 0;
  const ex = qx - dx * h, ey = qy - dy * h;
  return Math.sqrt(ex * ex + ey * ey);
}

const texX = (i: number) => PATCH.x0 + (i + 0.5) / PATCH.ppm;
const texY = (j: number) => PATCH.y0 + (j + 0.5) / PATCH.ppm;
function texRange(a: number, b: number, o: number, n: number) {
  return [Math.max(0, Math.floor((a - o) * PATCH.ppm)), Math.min(n - 1, Math.ceil((b - o) * PATCH.ppm))] as const;
}

/** Union of a polygon's signed distance into channel `ch` of a 4-channel field. */
function polySDF(out: Float32Array, ch: number, poly: P2[], margin = 2.5) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const [i0, i1] = texRange(x0 - margin, x1 + margin, PATCH.x0, PATCH_W);
  const [j0, j1] = texRange(y0 - margin, y1 + margin, PATCH.y0, PATCH_H);
  const n = poly.length;
  for (let j = j0; j <= j1; j++) {
    const py = texY(j);
    for (let i = i0; i <= i1; i++) {
      const px = texX(i);
      let d = Infinity, inside = false;
      for (let k = 0, l = n - 1; k < n; l = k++) {
        const [ax, ay] = poly[l]!, [bx, by] = poly[k]!;
        d = Math.min(d, segD(px, py, ax, ay, bx, by));
        if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
      }
      const s = inside ? -d : d;
      const idx = (j * PATCH_W + i) * 4 + ch;
      if (s < out[idx]!) out[idx] = s;
    }
  }
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

/** His bite (upper incisors, canines, lower incisors) as three signed distance channels; #8's centre and chip. */
export function bakeMarks(): { tex: THREE.DataTexture; chip: P2; c8: P2 } {
  const out = new Float32Array(PATCH_W * PATCH_H * 4).fill(FAR);
  const bm = biteMark(HIS);
  let chip: P2 = [1.7, 14.0], c8: P2 = [4.2, 14.3];
  for (const m of [...bm.upper, ...bm.lower]) {
    const t = tooth(HIS, m.n);
    const ch = t.cls === 'canine' ? 1 : t.jaw === 'upper' ? 0 : 2;
    polySDF(out, ch, m.poly);
    if (m.n === 8) {
      c8 = m.center;
      // the facet: the mark's mesial-most point (smallest X)
      let mi = m.poly[0]!;
      for (const p of m.poly) if (p[0] < mi[0]) mi = p;
      chip = mi;
    }
  }
  // A: the skin between neighbouring incisal marks is bitten too (the bite's wall runs on from tooth to tooth), except
  // across #9-#8, where #8's chipped mesial end leaves the notch: the one break in his upper arc
  const ends = (n: number) => {
    const m = [...bm.upper, ...bm.lower].find((k) => k.n === n)!;
    let lo = m.poly[0]!, hi = m.poly[0]!;
    for (const p of m.poly) { if (p[0] < lo[0]) lo = p; if (p[0] > hi[0]) hi = p; }
    return { lo, hi, c: m.center };
  };
  const pairs: [number, number][] = [[10, 9], [8, 7], [23, 24], [24, 25], [25, 26]];
  for (const [a, b] of pairs) {
    const A = ends(a), B = ends(b);
    // from a's right end to b's left end, along the line of their centres' edge
    const p0: P2 = [A.hi[0] - 0.4, (A.hi[1] + A.c[1]) / 2], p1: P2 = [B.lo[0] + 0.4, (B.lo[1] + B.c[1]) / 2];
    const [i0, i1] = texRange(Math.min(p0[0], p1[0]) - 2, Math.max(p0[0], p1[0]) + 2, PATCH.x0, PATCH_W);
    const [j0, j1] = texRange(Math.min(p0[1], p1[1]) - 2, Math.max(p0[1], p1[1]) + 2, PATCH.y0, PATCH_H);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const s = segD(texX(i), texY(j), p0[0], p0[1], p1[0], p1[1]) - 0.5;
      const idx = (j * PATCH_W + i) * 4 + 3;
      if (s < out[idx]!) out[idx] = s;
    }
  }
  return { tex: halfTex(out, 4), chip, c8 };
}

/** One hero word bitten between the arcs (see the header). `serif`: Cormorant italic (the tender register). */
export function bakeWord(word: string, serif = false): THREE.DataTexture {
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
  chars.forEach((ch, i) => {
    const s = acc + w[i]! / 2;
    acc += w[i]! + WORD.track;
    const th = s / WORD.r;
    const X = WORD.r * Math.sin(th), Y = WORD.cy + WORD.r * Math.cos(th);
    c.save();
    c.translate((X - PATCH.x0) * ppm, (PATCH.y1 - Y) * ppm);
    c.rotate(th);
    c.fillText(ch, 0, (capMm / 2) * ppm);
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
  return halfTex(out, 1);
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
