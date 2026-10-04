// Shared Teeth motifs: the bite (an interlocking zigzag seam and text split along it), the layer
// compositor that makes red glow, karaoke helpers, and a few procedural shapes (handprints, the heart,
// rose curves). Everything is a pure function of its arguments (seeded randomness only).
import type * as THREE from 'three';
import { FSPass } from '../engine/gl';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { clamp, hash, mulberry32, TAU } from '../engine/util';
import { TEETH_GLSL } from './palette';

// ------------------------------------------------------------------ the bite
export interface Jaw {
  /** Seam profile: y offset (px, + = down) at x, sampled every `step` px from x0. */
  x0: number; step: number; ys: Float32Array;
  /** Tooth tips: x, y (+ = an upper tooth pointing down), for drawing enamel teeth on the jaws. */
  tips: { x: number; y: number; w: number; up: boolean }[];
}

/**
 * An interlocking row of teeth across [x0, x1]: alternating bumps, down (upper teeth) and up (lower),
 * with seeded widths around `toothW` and amplitudes around `amp`; every 5th pair is a longer canine.
 * Upper region = y < seam(x), lower = y > seam(x): two jaws that fit exactly when closed.
 */
export function makeJaw(x0: number, x1: number, toothW = 64, amp = 22, seed = 1, sharp = 0.55): Jaw {
  const rnd = mulberry32(seed);
  const step = 3;
  const n = Math.ceil((x1 - x0) / step) + 1;
  const ys = new Float32Array(n);
  const tips: Jaw['tips'] = [];
  let x = x0 - rnd() * toothW;
  let i = 0;
  while (x < x1 + toothW) {
    // a canine pair every 10 teeth (longer, pointed); incisors and molars blunt-crowned
    const canine = i % 10 === 4 || i % 10 === 5;
    const w = toothW * (0.8 + 0.4 * rnd()) * (canine ? 1.1 : 1);
    const a = amp * (0.85 + 0.3 * rnd()) * (canine ? 1.65 : 1);
    const s = i % 2 === 0 ? 1 : -1;
    for (let k = Math.max(0, Math.ceil((x - x0) / step)); k < n && x0 + k * step < x + w; k++) {
      const u = (x0 + k * step - x) / w;
      if (u < 0 || u > 1) continue;
      const v = Math.abs(2 * u - 1);
      // every tooth comes to a point (the seam reads as a bite, not a wave); canines sharper and longer,
      // the others with fuller, slightly convex flanks (`sharp` 0..1 pushes them toward straight)
      const prof = canine ? Math.pow(1 - v, 1.3) : Math.pow(1 - v, 0.75 + 0.35 * sharp);
      ys[k] = s * a * prof;
    }
    tips.push({ x: x + w / 2, y: s * a, w, up: s < 0 });
    x += w;
    i++;
  }
  return { x0, step, ys, tips };
}

export function jawY(j: Jaw, x: number) {
  const f = (x - j.x0) / j.step;
  const i = Math.max(0, Math.min(j.ys.length - 2, Math.floor(f)));
  const u = clamp(f - i);
  return j.ys[i]! * (1 - u) + j.ys[i + 1]! * u;
}

/** Path of the region above (upper) or below (lower) the seam at height cy, extending `reach` px. */
export function jawRegion(j: Jaw, cy: number, upper: boolean, reach = 3000): Path2D {
  const p = new Path2D();
  const n = j.ys.length, xa = j.x0, xb = j.x0 + (n - 1) * j.step;
  p.moveTo(xa, cy + j.ys[0]!);
  for (let k = 1; k < n; k++) p.lineTo(xa + k * j.step, cy + j.ys[k]!);
  const ey = upper ? cy - reach : cy + reach;
  p.lineTo(xb, ey);
  p.lineTo(xa, ey);
  p.closePath();
  return p;
}

/** The seam itself as an open polyline path. */
export function jawSeam(j: Jaw, cy: number): Path2D {
  const p = new Path2D();
  p.moveTo(j.x0, cy + j.ys[0]!);
  for (let k = 1; k < j.ys.length; k++) p.lineTo(j.x0 + k * j.step, cy + j.ys[k]!);
  return p;
}

/** The open mouth between the two jaws (seam shifted up by gap/2 and down by gap/2). */
export function jawGapPath(j: Jaw, cy: number, gap: number): Path2D {
  const p = new Path2D();
  const n = j.ys.length;
  p.moveTo(j.x0, cy - gap / 2 + j.ys[0]!);
  for (let k = 1; k < n; k++) p.lineTo(j.x0 + k * j.step, cy - gap / 2 + j.ys[k]!);
  for (let k = n - 1; k >= 0; k--) p.lineTo(j.x0 + k * j.step, cy + gap / 2 + j.ys[k]!);
  p.closePath();
  return p;
}

/**
 * Draw `draw()` bitten by the jaw: its upper half moved up by gap/2 and its lower half down, each
 * clipped along the seam at cy. `draw` is called twice in the same coordinates.
 */
export function drawBitten(c: CanvasRenderingContext2D, j: Jaw, cy: number, gap: number, draw: (half: 'upper' | 'lower') => void) {
  for (const upper of [true, false]) {
    c.save();
    c.translate(0, upper ? -gap / 2 : gap / 2);
    c.clip(jawRegion(j, cy, upper));
    draw(upper ? 'upper' : 'lower');
    c.restore();
  }
}

/**
 * Enamel teeth along the jaws: each jaw is a saw-blade band whose biting edge is the seam (upper band
 * moved up by gap/2, lower down), `len` px deep, shaded toward the gum and split between teeth by a
 * hairline from each notch. `which` limits to one row.
 */
export function drawTeeth(c: CanvasRenderingContext2D, j: Jaw, cy: number, gap: number, fill: string, shade: string, len = 60, which: 'both' | 'upper' | 'lower' = 'both') {
  let amax = 0;
  for (const tp of j.tips) amax = Math.max(amax, Math.abs(tp.y));
  const xa = j.x0, xb = j.x0 + (j.ys.length - 1) * j.step;
  for (const upper of [true, false]) {
    if (which === 'upper' && !upper) continue;
    if (which === 'lower' && upper) continue;
    const s = upper ? 1 : -1;
    c.save();
    c.translate(0, -s * gap / 2);
    c.clip(jawRegion(j, cy, upper));
    const gum = cy - s * len;
    const y0 = Math.min(gum, cy + s * amax), y1 = Math.max(gum, cy + s * amax);
    c.fillStyle = fill;
    c.fillRect(xa, y0, xb - xa, y1 - y0);
    // toward the gum the enamel darkens
    const g = c.createLinearGradient(0, gum, 0, cy);
    g.addColorStop(0, shade); g.addColorStop(0.7, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(xa, y0, xb - xa, y1 - y0);
    // the gaps between teeth: a hairline up from each notch of this row (the other row's tips)
    c.strokeStyle = shade;
    c.lineWidth = 2;
    c.beginPath();
    for (const tp of j.tips) {
      if (tp.up !== upper) continue;
      c.moveTo(tp.x, cy + tp.y);
      c.lineTo(tp.x, gum);
    }
    c.stroke();
    c.restore();
  }
}

// ------------------------------------------------------------------ compositor
/**
 * Background + up to two Canvas2D layers, with red pushed above the bloom threshold: a pixel's
 * redness (r over g, b) multiplies it by 1 + hot. `bg` is a linear colour; `under` (optional) is a
 * texture drawn first (another pass's output).
 */
export class TeethComp {
  pass = new FSPass(/* glsl */ `
    ${TEETH_GLSL}
    uniform sampler2D a; uniform sampler2D b; uniform sampler2D under;
    uniform bool hasB, hasUnder; uniform vec3 bg; uniform float hot, hotB, gainA;
    uniform vec2 offA; uniform float zoomA;
    vec3 boost(vec3 c, float h) {
      float red = c.r - max(c.g, c.b);
      return c * (1.0 + h * smoothstep(0.35, 0.9, red));
    }
    void main() {
      vec3 col = hasUnder ? texture(under, vUv).rgb : bg;
      vec2 uv = (vUv - 0.5) / zoomA + 0.5 + offA;
      vec4 A = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture(a, uv);
      col = mix(col, boost(A.rgb, hot) * gainA, A.a);
      if (hasB) { vec4 B = texture(b, vUv); col = mix(col, boost(B.rgb, hotB), B.a); }
      fragColor = vec4(col, 1.0);
    }`, {
    a: { value: null }, b: { value: null }, under: { value: null }, hasB: { value: false }, hasUnder: { value: false },
    bg: { value: [0, 0, 0] }, hot: { value: 1.2 }, hotB: { value: 1.2 }, gainA: { value: 1 }, offA: { value: [0, 0] }, zoomA: { value: 1 },
  });
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, o: { a: THREE.Texture; b?: THREE.Texture | null; under?: THREE.Texture | null; bg?: [number, number, number]; hot?: number; hotB?: number; gainA?: number; offA?: [number, number]; zoomA?: number }) {
    const u = this.pass.u;
    u.a!.value = o.a;
    u.b!.value = o.b ?? null; u.hasB!.value = !!o.b;
    u.under!.value = o.under ?? null; u.hasUnder!.value = !!o.under;
    u.bg!.value = o.bg ?? [0, 0, 0];
    u.hot!.value = o.hot ?? 1.2; u.hotB!.value = o.hotB ?? o.hot ?? 1.2;
    u.gainA!.value = o.gainA ?? 1;
    u.offA!.value = o.offA ?? [0, 0];
    u.zoomA!.value = o.zoomA ?? 1;
    this.pass.render(renderer, out);
  }
}

// ------------------------------------------------------------------ karaoke
/** Words of the lines matching `q` (nth occurrence). */
export function lineWords(ly: Lyrics, q: string, nth = 0): Word[] { return ly.get(q, nth).words; }
/** 0 before the word, 0..1 while sung, 1 after. */
export const sung = (w: Word, t: number) => Lyrics.wordProgress(w, t);
/** Index of the last word in `ws` whose start is <= t (-1 before the first). */
export function curWord(ws: Word[], t: number) {
  let i = -1;
  for (let k = 0; k < ws.length; k++) if (t >= ws[k]!.start - 1e-4) i = k;
  return i;
}
/** Lines whose first word starts in [t0, t1). */
export function linesStarting(ly: Lyrics, t0: number, t1: number): Line[] {
  return ly.lines.filter((l) => l.words[0]!.start >= t0 - 1e-3 && l.words[0]!.start < t1);
}

// ------------------------------------------------------------------ shapes
/** A procedural handprint (palm + four fingers + thumb) as a Path2D centred on the palm, ~`s` px tall. */
export function handPath(s: number, seed = 1, left = false): Path2D {
  const r = mulberry32(seed);
  const p = new Path2D();
  const k = s / 100;
  const m = left ? -1 : 1;
  // palm: a rounded, slightly trapezoid blob
  p.ellipse(0, 12 * k, 27 * k, 31 * k, 0, 0, TAU);
  const fingers = [
    { x: -19, len: 38, w: 7.0, a: -0.22 },
    { x: -6.5, len: 46, w: 7.6, a: -0.07 },
    { x: 7, len: 43, w: 7.4, a: 0.07 },
    { x: 19, len: 33, w: 6.4, a: 0.24 },
  ];
  for (const f of fingers) {
    const len = f.len * (0.94 + 0.12 * r()), a = f.a + (r() - 0.5) * 0.12;
    const bx = m * f.x * k, by = -8 * k;
    const ex = bx + Math.sin(a) * m * len * k, ey = by - Math.cos(a) * len * k;
    capsule(p, bx, by, ex, ey, f.w * k, f.w * k * 0.82);
  }
  // thumb out to the side
  const ta = m * (1.05 + (r() - 0.5) * 0.2);
  const tx = m * 26 * k, ty = 18 * k;
  capsule(p, tx, ty, tx + Math.sin(ta) * 34 * k, ty - Math.cos(ta) * 34 * k, 8.6 * k, 7.4 * k);
  return p;
}
function capsule(p: Path2D, ax: number, ay: number, bx: number, by: number, r: number, rb = r) {
  // clockwise, like the palm's ellipse: overlapping parts union under the nonzero rule
  const a = Math.atan2(by - ay, bx - ax);
  p.moveTo(ax + Math.cos(a - Math.PI / 2) * r, ay + Math.sin(a - Math.PI / 2) * r);
  p.arc(bx, by, rb, a - Math.PI / 2, a + Math.PI / 2, false);
  p.arc(ax, ay, r, a + Math.PI / 2, a + 1.5 * Math.PI, false);
  p.closePath();
}

/** Skin lines of a print (finger joints, palm creases), to punch out with destination-out. */
export function handCreases(c: CanvasRenderingContext2D, s: number, seed = 1, left = false) {
  const r = mulberry32(seed + 99);
  const k = s / 100, m = left ? -1 : 1;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.lineCap = 'round';
  c.strokeStyle = '#000';
  // joints across the fingers
  for (const [fx, y1, y2] of [[-19, -22, -34], [-6.5, -24, -40], [7, -23, -38], [19, -20, -30]] as const) {
    for (const y of [y1, y2]) {
      c.lineWidth = (1.2 + r() * 1.4) * k;
      c.beginPath(); c.moveTo(m * (fx - 6) * k, (y + (r() - 0.5) * 3) * k); c.lineTo(m * (fx + 6) * k, (y + (r() - 0.5) * 3) * k); c.stroke();
    }
  }
  // palm creases: heart line, head line, life line
  c.lineWidth = 1.8 * k;
  c.beginPath(); c.moveTo(m * 24 * k, 0); c.quadraticCurveTo(m * 2 * k, -6 * k, m * -22 * k, 2 * k); c.stroke();
  c.beginPath(); c.moveTo(m * 22 * k, 10 * k); c.quadraticCurveTo(m * 0, 8 * k, m * -20 * k, 18 * k); c.stroke();
  c.beginPath(); c.moveTo(m * 20 * k, 12 * k); c.quadraticCurveTo(m * 8 * k, 30 * k, m * 12 * k, 42 * k); c.stroke();
  c.restore();
}

/** Seeded speckle "ink texture" for prints: punches small holes (destination-out) inside the current clip. */
export function inkSpeckle(c: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number, n = 120) {
  c.save();
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) {
    const a = hash(i, seed) * TAU, d = Math.sqrt(hash(i, seed + 1)) * R;
    const rr = 0.6 + 3.2 * hash(i, seed + 2) ** 3;
    c.globalAlpha = 0.35 + 0.65 * hash(i, seed + 3);
    c.beginPath();
    c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, 0, TAU);
    c.fill();
  }
  c.restore();
}

/** Classic heart curve point (t in 0..2π), unit height ~1 (y down), centred. */
export function heartXY(t: number): [number, number] {
  const x = 16 * Math.sin(t) ** 3;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return [x / 17, -y / 17];
}
export function heartPath(cx: number, cy: number, s: number, n = 160): Path2D {
  const p = new Path2D();
  for (let i = 0; i <= n; i++) {
    const [x, y] = heartXY((i / n) * TAU);
    if (i === 0) p.moveTo(cx + x * s, cy + y * s); else p.lineTo(cx + x * s, cy + y * s);
  }
  p.closePath();
  return p;
}

/** Rose curve r = cos(k θ) (rhodonea), points for θ in [0, θmax]. */
export function rosePoints(cx: number, cy: number, R: number, k: number, thetaMax: number, n = 600, rot = 0) {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * thetaMax;
    const r = R * Math.cos(k * th);
    out.push({ x: cx + r * Math.cos(th + rot), y: cy + r * Math.sin(th + rot) });
  }
  return out;
}

/** Deterministic ember/ash particles rising from a source rect; returns [x, y, life 0..1, size] per particle. */
export function embers(t: number, rect: { x: number; y: number; w: number; h: number }, o: { rate?: number; life?: number; rise?: number; seed?: number; t0?: number } = {}) {
  const rate = o.rate ?? 30, life = o.life ?? 2.5, rise = o.rise ?? 90, seed = o.seed ?? 3, t0 = o.t0 ?? -1e9;
  const out: [number, number, number, number][] = [];
  const n0 = Math.floor((t - life) * rate), n1 = Math.floor(t * rate);
  for (let n = n0; n <= n1; n++) {
    const tb = n / rate;
    if (tb > t || tb < t0) continue;
    const lf = life * (0.5 + 0.5 * hash(n, seed + 1));
    const age = t - tb;
    if (age > lf) continue;
    const x0 = rect.x + hash(n, seed) * rect.w, y0 = rect.y + hash(n, seed + 2) * rect.h;
    const sway = Math.sin(age * (1.3 + hash(n, seed + 3) * 2) + n) * 14 * age;
    out.push([x0 + sway + (hash(n, seed + 4) - 0.5) * 30 * age, y0 - rise * age * (0.6 + 0.8 * hash(n, seed + 5)), 1 - age / lf, 0.8 + 2.2 * hash(n, seed + 6) ** 2]);
  }
  return out;
}
