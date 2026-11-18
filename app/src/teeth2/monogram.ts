// The T.F. monogram (docs/TEETH2.md, "The clue ledger"): his signature mark, the same every time it appears (the
// film's tag ~9.9 s, the chart ~83 s, the bag seal ~143.7 s, and in red in the matched cast's NAME field at 165.16).
// A signature-monogram, not a font: one long rising bar is the T's crossbar and runs on as the F's top arm; the F
// has its own stem and a distinct middle bar crossing it. No loops anywhere (a loop at a head reads as a 9, a looped
// descender as a J): the pen turns on the spot instead. Slanted ~9°. Two pen strokes, written in this order:
//   1. the T: the pen lands at the foot and goes UP the stem (a quick upstroke), turns sharply at the head and runs
//      out along the bar's left arm, turns back on itself and sweeps right across the stem and over both letters as
//      one long rising bar, flicking out to a hair;
//   2. the F: a landing tick on the bar, straight down the stem to the foot, a quick retrace back up the stem to
//      mid-height, a short stub out to the left, and back across the stem as the middle bar, turning down as the pen
//      lifts.
// The client's letters are T.F.; the full stops are not drawn (they would be two more pen lifts, and the mark has to
// read as one shape at a glance).
//
// API (all coordinates in the UNIT BOX: x right 0..1, y down 0..MONO_H; the ink spans the whole box):
//   MONO_H                         the box's height (its width is 1)
//   MONOGRAM.strokes: V2[][]       the two pen strokes as dense polylines (in writing order)
//   MONOGRAM.length                total pen-down arc length (unit box units); `strokeStart[i]` where stroke i begins
//   monoTime(t, t0, t1)            0..1 progress of the pen's *clock* (linear) — rarely needed directly
//   monoWritten(t, t0, t1)         written length (0..MONOGRAM.length) at song time t when the mark is signed over
//                                  [t0, t1], with a pen-like speed profile: the pen accelerates out of each landing,
//                                  slows into the turns (speed ~ curvature^-1/3, the two-thirds power law of
//                                  handwriting), flicks out of the bar, and lifts between the strokes (~14% of the
//                                  time in the air). Put t0 on the beat the pen lands; ~0.45–0.7 s reads as a
//                                  confident signature.
//   monoPen(len)                   the pen tip at a written length: {x, y, angle, down}; in the gap between strokes
//                                  `down` is false and x, y travel through the air (for the gloved hand)
//   monoPenAt(t, t0, t1)           the same at a song time, with the in-air travel interpolated by time
//   drawMonogram(ctx, len, place)  Canvas2D: fills the mark written up to `len` (default all) at place
//                                  {x, y, size, width?, color?, pressure?}; x, y = the box's top-left in px, size = the
//                                  box's width in px, width = the nominal line width in px (default size * 0.022),
//                                  pressure 0..1 = how much the line swells on slow turns and thins on fast sweeps
//                                  (default 0.6). Drawn as ONE fill (all pieces wound the same way), so a
//                                  translucent colour does not double up where the line crosses itself.
//   monoSegments(len, place)       capsule segments {ax, ay, bx, by, w} in px for LineBatch (`lb.seg2(ax, ay, bx, by,
//                                  w, rgb, a)`); `monoToLines(lb, len, place, rgb, a)` does that for you. Use the
//                                  batch's 'max' blend so the joints do not double.
// `place.rot` (radians, about the box's top-left) and `place.skew` (extra slant) let a plate sign at an angle on a
// tag or a seal; keep the mark's own slant (it is in the points).
import type { V2 } from '../engine/util';

// ---------------------------------------------------------------------------------------------- the design
// Control points (before slant), roughly in a 1 x 0.6 box, y down. Each stroke is a list of pieces, each piece
// smoothed with a centripetal Catmull-Rom spline; where two pieces meet the pen turns on the spot (a cusp: it
// reverses or turns sharply without a loop).
type Pts = [number, number][];
const T_STROKE: Pts[] = [
  [[0.206, 0.628], [0.211, 0.52], [0.22, 0.36], [0.23, 0.22], [0.236, 0.13]], // the pen lands at the foot: up the T's stem
  [[0.236, 0.13], [0.16, 0.131], [0.09, 0.132], [0.045, 0.134]], // a sharp turn at the head: out along the bar's left arm
  [[0.045, 0.134], [0.11, 0.138], [0.24, 0.137], [0.42, 0.126], [0.6, 0.11], [0.78, 0.09], [0.93, 0.071], [1.0, 0.063]], // back across the stem: one long rising bar, flicked out
];
const F_STROKE: Pts[] = [
  [[0.628, 0.105], [0.623, 0.2], [0.614, 0.33], [0.604, 0.47], [0.596, 0.598]], // a landing tick on the bar, down the F's stem
  [[0.596, 0.598], [0.602, 0.5], [0.607, 0.41], [0.61, 0.368]], // back up the stem (a quick retrace) to mid-height
  [[0.61, 0.368], [0.575, 0.369], [0.53, 0.372]], // out to the left of the stem
  [[0.53, 0.372], [0.6, 0.377], [0.69, 0.374], [0.78, 0.366], [0.84, 0.374]], // across it: the F's middle bar, turning down as the pen lifts
];
/** Signature slant: x += SLANT * (0.6 - y) (the foot stays, the head leans right). */
const SLANT = 0.16;

function catmull(pts: V2[], per = 24): V2[] {
  // centripetal Catmull-Rom (alpha 0.5), end points duplicated
  const P = [pts[0]!, ...pts, pts[pts.length - 1]!];
  const out: V2[] = [];
  const tj = (ti: number, a: V2, b: V2) => ti + Math.pow(Math.hypot(b.x - a.x, b.y - a.y), 0.5) + 1e-6;
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = P[i + 2]!;
    const t0 = 0, t1 = tj(t0, p0, p1), t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3);
    for (let k = 0; k < per; k++) {
      const t = t1 + ((t2 - t1) * k) / per;
      const L = (a: V2, b: V2, ta: number, tb: number) => ({ x: ((tb - t) * a.x + (t - ta) * b.x) / (tb - ta), y: ((tb - t) * a.y + (t - ta) * b.y) / (tb - ta) });
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
      out.push(L(B1, B2, t1, t2));
    }
  }
  out.push(P[P.length - 2]!);
  return out;
}

function build() {
  const raw = [T_STROKE, F_STROKE].map((pieces) => pieces.flatMap((pc, i) => catmull(pc.map(([x, y]) => ({ x, y }))).slice(i ? 1 : 0)));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const slanted = raw.map((s) => s.map((p) => ({ x: p.x + SLANT * (0.6 - p.y), y: p.y })));
  for (const s of slanted) for (const p of s) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const k = 1 / (x1 - x0);
  const strokes = slanted.map((s) => s.map((p) => ({ x: (p.x - x0) * k, y: (p.y - y0) * k })));
  const h = (y1 - y0) * k;
  // per-point cumulative length (over all strokes, pen-down only), curvature-driven speed, nominal width factor
  const cum: Float32Array[] = [], spd: Float32Array[] = [], wid: Float32Array[] = [];
  const strokeStart: number[] = [];
  let acc = 0;
  for (const s of strokes) {
    strokeStart.push(acc);
    const n = s.length, c = new Float32Array(n), v = new Float32Array(n), w = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (i > 0) acc += Math.hypot(s[i]!.x - s[i - 1]!.x, s[i]!.y - s[i - 1]!.y);
      c[i] = acc;
    }
    const L0 = c[0]!, L = c[n - 1]! - L0;
    for (let i = 0; i < n; i++) {
      // curvature from the turning angle over a short window
      const a = s[Math.max(0, i - 3)]!, b = s[i]!, d = s[Math.min(n - 1, i + 3)]!;
      const ang = Math.abs(Math.atan2((b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x), (b.x - a.x) * (d.x - b.x) + (b.y - a.y) * (d.y - b.y)));
      const ds = Math.max(1e-4, (c[Math.min(n - 1, i + 3)]! - c[Math.max(0, i - 3)]!));
      const kappa = ang / ds; // 1 / unit
      const u = (c[i]! - L0) / Math.max(1e-6, L);
      // two-thirds power law, clamped; the pen starts and stops (min-jerk-like ramps at both ends)
      const law = Math.min(1, Math.pow(Math.max(kappa, 0.6) / 0.6, -1 / 3));
      const ramp = Math.min(1, 0.25 + u / 0.12) * Math.min(1, 0.35 + (1 - u) / 0.1);
      v[i] = Math.max(0.12, law * ramp);
      // ink: heavier where slow, a light landing, a tapering exit (the bar's flick thins to a hair)
      const land = Math.min(1, 0.55 + u / 0.05);
      const exit = 1 - Math.pow(Math.max(0, (u - 0.86) / 0.14), 1.6) * 0.8;
      w[i] = land * exit;
    }
    cum.push(c); spd.push(v); wid.push(w);
  }
  return { strokes, h, cum, spd, wid, strokeStart, length: acc };
}

const B = build();

/** Height of the unit box (its width is 1): the ink spans it exactly. */
export const MONO_H = B.h;

/** The mark in the unit box (see the file header). */
export const MONOGRAM = {
  strokes: B.strokes as readonly (readonly V2[])[],
  length: B.length,
  strokeStart: B.strokeStart as readonly number[],
  /** The ink's height in the unit box (= MONO_H). */
  height: B.h,
};

// ---------------------------------------------------------------------------------------------- timing
/** Fraction of the signing time the pen spends in the air between the strokes. */
const LIFT = 0.14;
/** Time table: pen-down time at each point (normalised so the whole signing incl. the lift is 1). */
const TT = (() => {
  const times: Float32Array[] = [];
  let tacc = 0;
  const raw: number[] = [];
  B.strokes.forEach((s, si) => {
    const c = B.cum[si]!, v = B.spd[si]!, T = new Float32Array(s.length);
    for (let i = 0; i < s.length; i++) {
      if (i > 0) tacc += (c[i]! - c[i - 1]!) / (0.5 * (v[i]! + v[i - 1]!));
      T[i] = tacc;
    }
    times.push(T);
    raw.push(tacc);
  });
  const down = tacc, lift = (down * LIFT) / (1 - LIFT), total = down + lift;
  // stroke 2's times are shifted by the lift
  const T2 = times[1]!;
  for (let i = 0; i < T2.length; i++) T2[i] = T2[i]! + lift;
  for (const T of times) for (let i = 0; i < T.length; i++) T[i] = T[i]! / total;
  return { times, liftStart: raw[0]! / total, liftEnd: (raw[0]! + lift) / total };
})();

/** Linear 0..1 progress of the signing clock over [t0, t1]. */
export const monoTime = (t: number, t0: number, t1: number) => Math.min(1, Math.max(0, (t - t0) / Math.max(1e-4, t1 - t0)));

/** Written length at song time t, the mark signed over [t0, t1] with the pen's speed profile. */
export function monoWritten(t: number, t0: number, t1: number): number {
  const u = monoTime(t, t0, t1);
  if (u <= 0) return 0;
  if (u >= 1) return B.length;
  if (u >= TT.liftStart && u <= TT.liftEnd) return B.strokeStart[1]!;
  const si = u < TT.liftStart ? 0 : 1;
  const T = TT.times[si]!, c = B.cum[si]!;
  let lo = 0, hi = T.length - 1;
  if (u <= T[0]!) return c[0]!;
  if (u >= T[hi]!) return c[hi]!;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m]! < u) lo = m; else hi = m; }
  const f = (u - T[lo]!) / Math.max(1e-9, T[hi]! - T[lo]!);
  return c[lo]! + (c[hi]! - c[lo]!) * f;
}

export interface MonoPen { x: number; y: number; angle: number; down: boolean }

function locate(len: number): { si: number; i: number; f: number } {
  const L = Math.min(Math.max(len, 0), B.length);
  const si = L < B.strokeStart[1]! ? 0 : 1;
  const c = B.cum[si]!;
  let lo = 0, hi = c.length - 1;
  if (L <= c[0]!) return { si, i: 0, f: 0 };
  if (L >= c[hi]!) return { si, i: hi - 1, f: 1 };
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m]! < L) lo = m; else hi = m; }
  return { si, i: lo, f: (L - c[lo]!) / Math.max(1e-9, c[hi]! - c[lo]!) };
}

/** The pen tip (unit box) at a written length. */
export function monoPen(len: number): MonoPen {
  const { si, i, f } = locate(len);
  const s = B.strokes[si]!, a = s[i]!, b = s[Math.min(s.length - 1, i + 1)]!;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: Math.atan2(b.y - a.y, b.x - a.x), down: len > 0 && len < B.length };
}

/** The pen tip (unit box) at song time t, signing over [t0, t1]; between the strokes it travels through the air. */
export function monoPenAt(t: number, t0: number, t1: number): MonoPen {
  const u = monoTime(t, t0, t1);
  if (u > TT.liftStart && u < TT.liftEnd) {
    const s0 = B.strokes[0]!, s1 = B.strokes[1]!;
    const a = s0[s0.length - 1]!, b = s1[0]!;
    const k = (u - TT.liftStart) / (TT.liftEnd - TT.liftStart), e = k * k * (3 - 2 * k);
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - Math.sin(Math.PI * k) * 0.06, angle: Math.atan2(b.y - a.y, b.x - a.x), down: false };
  }
  const p = monoPen(monoWritten(t, t0, t1));
  return { ...p, down: u > 0 && u < 1 };
}

// ---------------------------------------------------------------------------------------------- drawing
export interface MonoPlace {
  /** The unit box's top-left (px). */
  x: number; y: number;
  /** The box's width (px). */
  size: number;
  /** Nominal line width (px); default size * 0.022. */
  width?: number;
  /** Fill colour (Canvas2D); default the current fillStyle. */
  color?: string;
  /** 0..1: swell on slow turns, thin on fast sweeps (default 0.6). */
  pressure?: number;
  /** Rotation (radians) about the box's top-left. */
  rot?: number;
  /** Extra slant (x += skew * (MONO_H - y) in box units). */
  skew?: number;
}

interface Pt { x: number; y: number; w: number }

/** The written part of the mark as px points with widths, one list per stroke. */
function written(len: number, pl: MonoPlace): Pt[][] {
  const L = Math.min(Math.max(len, 0), B.length);
  const base = pl.width ?? pl.size * 0.022, pr = pl.pressure ?? 0.6;
  const cr = Math.cos(pl.rot ?? 0), sr = Math.sin(pl.rot ?? 0), sk = pl.skew ?? 0;
  const map = (p: V2) => {
    const ux = (p.x + sk * (MONO_H - p.y)) * pl.size, uy = p.y * pl.size;
    return { x: pl.x + ux * cr - uy * sr, y: pl.y + ux * sr + uy * cr };
  };
  const out: Pt[][] = [];
  B.strokes.forEach((s, si) => {
    const c = B.cum[si]!, v = B.spd[si]!, w = B.wid[si]!;
    if (L <= c[0]!) return;
    const pts: Pt[] = [];
    for (let i = 0; i < s.length; i++) {
      const wi = base * w[i]! * (1 + pr * (0.55 - v[i]!) * 0.45);
      if (c[i]! <= L) { pts.push({ ...map(s[i]!), w: wi }); continue; }
      const f = (L - c[i - 1]!) / Math.max(1e-9, c[i]! - c[i - 1]!);
      const a = s[i - 1]!, b = s[i]!;
      pts.push({ ...map({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }), w: wi });
      break;
    }
    out.push(pts);
  });
  return out;
}

/**
 * Canvas2D: fill the mark written up to `len` (default: all of it). One fill of same-wound pieces (quads between
 * points, a disc at every point), so overlaps never double a translucent colour.
 */
export function drawMonogram(c: CanvasRenderingContext2D, len = B.length, pl: MonoPlace) {
  const strokes = written(len, pl);
  c.save();
  if (pl.color) c.fillStyle = pl.color;
  c.beginPath();
  for (const s of strokes) {
    for (let i = 0; i < s.length; i++) {
      const p = s[i]!;
      const r = p.w / 2;
      c.moveTo(p.x + r, p.y);
      c.arc(p.x, p.y, r, 0, Math.PI * 2);
      if (i === 0) continue;
      const q = s[i - 1]!;
      const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
      if (d < 1e-6) continue;
      const nx = -dy / d, ny = dx / d, rq = q.w / 2;
      // wound like the arcs (positive in canvas coordinates)
      c.moveTo(q.x - nx * rq, q.y - ny * rq);
      c.lineTo(p.x - nx * r, p.y - ny * r);
      c.lineTo(p.x + nx * r, p.y + ny * r);
      c.lineTo(q.x + nx * rq, q.y + ny * rq);
      c.closePath();
    }
  }
  c.fill('nonzero');
  c.restore();
}

export interface MonoSeg { ax: number; ay: number; bx: number; by: number; w: number }

/** Capsule segments (px) of the mark written up to `len`, for LineBatch. */
export function monoSegments(len = B.length, pl: MonoPlace): MonoSeg[] {
  const segs: MonoSeg[] = [];
  for (const s of written(len, pl))
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1]!, b = s[i]!;
      segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, w: (a.w + b.w) / 2 });
    }
  return segs;
}

/** Push the mark into a 2D LineBatch (use its 'max' blend). `rgb` is linear (may exceed 1 for the red's glow). */
export function monoToLines(
  lb: { seg2(ax: number, ay: number, bx: number, by: number, width: number, rgb: [number, number, number], alpha?: number): void },
  len: number, pl: MonoPlace, rgb: [number, number, number], alpha = 1,
) {
  for (const s of monoSegments(len, pl)) lb.seg2(s.ax, s.ay, s.bx, s.by, s.w, rgb, alpha);
}
