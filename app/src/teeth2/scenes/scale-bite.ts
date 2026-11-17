// `scale` bite bake: distance fields of the bite in the apple, computed once on the CPU (init) and sampled by the
// ray-march (scale-glsl.ts) as a height field. All in the bite's PHOTO frame (teeth.ts `biteMark`): mm, X right, Y up,
// origin at the centre of the bite, the biter's right on the image's right, upper arc above.
//
//  - marks texture (RGBA): signed distance (mm, negative inside) to R: his upper incisor marks (#7–#10, #8 chipped),
//    G: the four canine marks (#6, #11, #22, #27), B: his lower incisor marks (#23–#26). Straight from biteMark(HIS).
//  - word textures (R): signed distance (mm) to one hero word, its letters standing in for the upper incisor marks:
//    single-stroke capitals whose strokes are rounded bars like an incisal edge's mark, set on the upper arc's curve,
//    upright to it, canine mark to canine mark. The letter over #8 loses its mesial-incisal corner on a slant: the
//    chip, the same notch biteMark cuts in #8's bar, so the chip shows as a small gap in the arc in every word.
import * as THREE from 'three';
import { biteMark, HIS, tooth, type V2 } from '../teeth';
import { strokeText } from '../../engine/stroke';

/** The baked patch (photo mm) and its resolution (texels per mm). */
export const PATCH = { x0: -26, y0: -18, x1: 26, y1: 22, ppm: 24 };
export const PATCH_W = Math.round((PATCH.x1 - PATCH.x0) * PATCH.ppm);
export const PATCH_H = Math.round((PATCH.y1 - PATCH.y0) * PATCH.ppm);
const FAR = 6;

/** The letters' arc: a circle through the upper incisors' marks, flattened a little for legibility. */
export const ARC = { cx: 0, cy: -22.5, r: 34, cap: 6.4, pitch: 5.5, hw: 0.78 };

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
function polySDF(out: Float32Array, ch: number, poly: V2[], margin = 2.5) {
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

/** His bite (upper incisors, canines, lower incisors) as three signed distance channels. */
export function bakeMarks(): THREE.DataTexture {
  const out = new Float32Array(PATCH_W * PATCH_H * 4).fill(FAR);
  const bm = biteMark(HIS);
  for (const m of [...bm.upper, ...bm.lower]) {
    const t = tooth(HIS, m.n);
    const ch = t.cls === 'canine' ? 1 : t.jaw === 'upper' ? 0 : 2;
    polySDF(out, ch, m.poly);
  }
  return halfTex(out, 4);
}

/** Where a hero word's letters sit (photo mm), for the camera to frame them. */
export interface WordLayout { centres: V2[]; chipLetter: number; chipAt: V2 }

/** One hero word bitten into the upper arc (see the header). */
export function bakeWord(word: string): { tex: THREE.DataTexture; layout: WordLayout } {
  const text = word.toUpperCase();
  const chars = Array.from(text);
  const st = strokeText(text, 'readable', 100, 0, false);
  const pxToMm = ARC.cap / st.capHeight;
  // each letter's ink box (stroke px, y down from the baseline)
  const boxes = chars.map(() => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }));
  st.strokes.forEach((s, k) => {
    const b = boxes[st.charOf[k]!]!;
    for (const p of s) { b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x); b.y0 = Math.min(b.y0, p.y); b.y1 = Math.max(b.y1, p.y); }
  });
  const n = chars.length;
  // fit the word between the canine marks (|X| < ~13.4 at the letters' ends)
  // proportional spacing: each letter's ink width plus its bars' rounding, a clear gap of skin between letters (as
  // between teeth); the word shrinks if it would run past the canine marks
  const XC = 0.84; // letters a little condensed, like the narrow marks of incisal edges
  const inkW = boxes.map((b) => (b.x1 - b.x0) * pxToMm * XC + 2 * ARC.hw);
  const GAP = 1.25, SPAN = 28.5;
  const total0 = inkW.reduce((a, b) => a + b, 0) + GAP * (n - 1);
  const shrink = Math.min(1, SPAN / total0);
  const cap = ARC.cap * shrink;
  const centresS: number[] = [];
  { let acc = -(total0 * shrink) / 2; for (let i = 0; i < n; i++) { centresS.push(acc + (inkW[i]! * shrink) / 2); acc += (inkW[i]! + GAP) * shrink; } }
  // letter frames: centre on the arc, rotated to its tangent
  const frames = chars.map((_, i) => {
    const th = centresS[i]! / ARC.r;
    return { th, c: [ARC.cx + ARC.r * Math.sin(th), ARC.cy + ARC.r * Math.cos(th)] as V2 };
  });
  const toPhoto = (i: number, lx: number, ly: number): V2 => {
    const { th, c } = frames[i]!;
    const ct = Math.cos(th), sn = Math.sin(th);
    return [c[0] + lx * ct + ly * sn, c[1] - lx * sn + ly * ct];
  };
  // segments in photo mm; letter-local: x from the ink box's centre, y up from the cap's mid-height
  const segs: number[] = [];
  const segLetter: number[] = [];
  st.strokes.forEach((s, k) => {
    const i = st.charOf[k]!, b = boxes[i]!;
    const cx = (b.x0 + b.x1) / 2, cy = -st.capHeight / 2;
    const loc = s.map((p) => [(p.x - cx) * pxToMm * shrink * XC, -(p.y - cy) * pxToMm * shrink] as V2);
    for (let q = 0; q + 1 < loc.length; q++) {
      const a = toPhoto(i, loc[q]![0], loc[q]![1]), bb = toPhoto(i, loc[q + 1]![0], loc[q + 1]![1]);
      segs.push(a[0], a[1], bb[0], bb[1]);
      segLetter.push(i);
    }
    if (loc.length === 1) { const a = toPhoto(i, loc[0]![0], loc[0]![1]); segs.push(a[0], a[1], a[0], a[1]); segLetter.push(i); }
  });
  // the chip: the letter nearest #8's mark centre (biteMark: X ~ +4.2) loses its mesial-incisal (top-left) corner
  const x8 = 4.22;
  let chipLetter = 0;
  frames.forEach((f, i) => { if (Math.abs(f.c[0] - x8) < Math.abs(frames[chipLetter]!.c[0] - x8)) chipLetter = i; });
  const cb = boxes[chipLetter]!;
  const halfW = ((cb.x1 - cb.x0) / 2) * pxToMm * shrink * XC, top = cap / 2;
  // the facet: the top-left (mesial-incisal) end of the letter cut off on a slant, as biteMark cuts #8's bar: shorter
  // along the top edge than along the bar's lower edge (letter-local mm)
  const K1: V2 = [-halfW - ARC.hw + 1.0, top + ARC.hw + 0.3];
  const K2: V2 = [-halfW - ARC.hw + 0.25, top - ARC.hw - 0.6];
  let nx = K2[1] - K1[1], ny = -(K2[0] - K1[0]);
  const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
  // n points away from the removed corner
  if ((-halfW - 2 - K1[0]) * nx + (top + 2 - K1[1]) * ny > 0) { nx = -nx; ny = -ny; }
  const chipFrame = frames[chipLetter]!;
  const ctc = Math.cos(chipFrame.th), stc = Math.sin(chipFrame.th);
  const toLocal = (x: number, y: number): V2 => {
    const dx = x - chipFrame.c[0], dy = y - chipFrame.c[1];
    return [dx * ctc - dy * stc, dx * stc + dy * ctc];
  };

  const out = new Float32Array(PATCH_W * PATCH_H).fill(FAR);
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (let k = 0; k < segs.length; k += 2) { bx0 = Math.min(bx0, segs[k]!); bx1 = Math.max(bx1, segs[k]!); by0 = Math.min(by0, segs[k + 1]!); by1 = Math.max(by1, segs[k + 1]!); }
  const [i0, i1] = texRange(bx0 - 3, bx1 + 3, PATCH.x0, PATCH_W);
  const [j0, j1] = texRange(by0 - 3, by1 + 3, PATCH.y0, PATCH_H);
  const nseg = segs.length / 4;
  for (let j = j0; j <= j1; j++) {
    const py = texY(j);
    for (let i = i0; i <= i1; i++) {
      const px = texX(i);
      let dOther = Infinity, dChip = Infinity;
      for (let k = 0; k < nseg; k++) {
        const o = k * 4;
        const dd = segD(px, py, segs[o]!, segs[o + 1]!, segs[o + 2]!, segs[o + 3]!);
        if (segLetter[k] === chipLetter) { if (dd < dChip) dChip = dd; } else if (dd < dOther) dOther = dd;
      }
      // the chip: the corner region is subtracted from the chipped letter only
      const [lx, ly] = toLocal(px, py);
      const keep = (lx - K1[0]) * nx + (ly - K1[1]) * ny;          // > 0 on the kept side of the facet
      const region = Math.max(lx - 0.2, top - ARC.hw - 1.2 - ly);    // < 0 in the top bar's band, left half
      const inChip = Math.max(keep, region);                        // < 0 inside the chip
      const sChip = Math.max(dChip - ARC.hw, -inChip);
      out[j * PATCH_W + i] = Math.min(dOther - ARC.hw, sChip);
    }
  }
  return {
    tex: halfTex(out, 1),
    layout: { centres: frames.map((f) => f.c), chipLetter, chipAt: toPhoto(chipLetter, -halfW, top) },
  };
}
