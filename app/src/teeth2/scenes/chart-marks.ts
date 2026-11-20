// Plate 7 `chart`: the pen's marks on her odontogram and everything that happens to them.
// A mark is a filling (F: a small hatched patch on the crown, wedges of its surface circle hatched) or a crown (C: the
// whole crown capped, cross-hatched, its circle filled). Marks are drawn each frame into a canvas in sheet mm (R = ink,
// B = the shadow of a mark that is off the paper). Script:
//   A  76.35-78.4  the pen fills the upper row, one mark per sung word (the best thing in my life)
//   B  78.94-81.5  the lower row, a stroke on every snare
//   C  82.83-86.28 on every beat the marks move: fillings hop from tooth to tooth, crowns swap, until the chart
//                  describes someone else (it ends with 7, 8, 9 marked: his corner under the sheet)
//   D  86.71-89    one quadrant per push/away: the marks lift off the paper and are gone
import type { V2 } from '../teeth';
import { ease, clamp } from '../../engine/util';
import { cell, tp, profile, INK, SILVER, CIR_R, HERS, type Cell } from './chart-form';
import type { Arch } from '../teeth';

export type Kind = 'F' | 'C';
export interface Move { t: number; dur: number; to: number }
export interface Lift { t: number; dur: number; dx: number; dy: number; rot: number }
export interface Inst { id: number; kind: Kind; home: number; t0: number; dur: number; moves: Move[]; lift: Lift | null; wedges: number[] }

const SP = 0.52;   // hatch spacing (mm)
const LW = 0.15;   // hairline (mm)
const sm = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------------------------------------- one mark
interface Style { col: (a: number) => string; w: number; a: number }
const ln = (c: CanvasRenderingContext2D | null, ax: number, ay: number, bx: number, by: number) => { if (!c) return; c.moveTo(ax, ay); c.lineTo(bx, by); };

/** Parallel hatch over a rectangle: lines x + dir*y = c; draws the first `n` (fractional) lines; returns the pen end. */
function hatchRect(c: CanvasRenderingContext2D | null, x0: number, y0: number, x1: number, y1: number, sp: number, dir: 1 | -1, n: number): V2 | null {
  const ca = dir > 0 ? x0 + y0 : x0 - y1, cb = dir > 0 ? x1 + y1 : x1 - y0;
  const N = Math.max(1, Math.floor((cb - ca) / sp));
  let tip: V2 | null = null;
  const k1 = Math.min(N, Math.ceil(n));
  if (c) c.beginPath();
  for (let k = 0; k < k1; k++) {
    const cc = ca + (k + 0.5) * sp;
    let xa: number, xb: number;
    if (dir > 0) { xa = Math.max(x0, cc - y1); xb = Math.min(x1, cc - y0); } else { xa = Math.max(x0, cc + y0); xb = Math.min(x1, cc + y1); }
    if (xb <= xa) continue;
    const ya = dir > 0 ? cc - xa : xa - cc, yb = dir > 0 ? cc - xb : xb - cc;
    const f = k + 1 > n ? n - k : 1;
    const fwd = k % 2 === 0;
    const px = fwd ? xa : xb, py = fwd ? ya : yb, qx = fwd ? xb : xa, qy = fwd ? yb : ya;
    ln(c, px, py, px + (qx - px) * f, py + (qy - py) * f);
    tip = [px + (qx - px) * f, py + (qy - py) * f];
  }
  if (c) c.stroke();
  return tip;
}
const hatchCount = (x0: number, y0: number, x1: number, y1: number, sp: number) => Math.max(1, Math.floor((x1 + y1 - x0 - y0) / sp));

/** Draw (ctx != null) or just locate the pen of a mark of `kind` on tooth `n` at progress p (0..1) with `st`. */
export function renderMark(c: CanvasRenderingContext2D | null, arch: Arch, kind: Kind, n: number, p: number, wedges: number[], st: Style): V2 {
  const cl: Cell = cell(n), pr = profile(arch, n);
  let tip: V2 = tp(cl, 0, pr.H * 0.6);
  if (c) { c.strokeStyle = st.col(st.a); c.lineWidth = LW * st.w; c.lineCap = 'round'; c.lineJoin = 'round'; }
  const pT = clamp(p / 0.7), pC = clamp((p - 0.7) / 0.3);
  const enamel = pr.enamel;
  let sMin = 1e9, sMax = -1e9;
  for (const q of enamel) { sMin = Math.min(sMin, q[0]); sMax = Math.max(sMax, q[0]); }
  if (kind === 'F') {
    // the patch: a neat rectangle on the occlusal third of the crown
    const a = tp(cl, sMin * 0.74, pr.H * 0.4), b = tp(cl, sMax * 0.74, pr.H * 0.93);
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    if (pT > 0) {
      const o = clamp(pT / 0.18);
      if (c && o > 0) {
        c.lineWidth = 0.4 * st.w;
        c.beginPath();
        const w = x1 - x0, h = y1 - y0, per = 2 * (w + h), L = per * o;
        // the outline is drawn as one stroke round the rectangle
        const pts: V2[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
        let acc = 0; c.moveTo(pts[0]![0], pts[0]![1]);
        for (let k = 1; k < pts.length && acc < L; k++) {
          const q0 = pts[k - 1]!, q1 = pts[k]!, d = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]), f = Math.min(1, (L - acc) / d);
          c.lineTo(q0[0] + (q1[0] - q0[0]) * f, q0[1] + (q1[1] - q0[1]) * f); acc += d;
        }
        c.stroke();
      }
      const nl = hatchCount(x0, y0, x1, y1, SP) * clamp((pT - 0.18) / 0.82);
      // the amalgam: hatched so close it is solid film-black (clipped to the patch)
      if (c) { c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip(); c.lineWidth = SP * 1.4 * st.w; c.lineCap = 'butt'; }
      const t = hatchRect(c, x0, y0, x1, y1, SP, 1, nl);
      if (c) c.restore();
      tip = t ?? [x0, y0];
    }
  } else {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const q of enamel) { const [x, y] = tp(cl, q[0], q[1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (pT > 0) {
      if (c) {
        // the cap: the crown outline, a touch heavier, and a cervical band
        c.save();
        c.lineWidth = 1.05 * st.w;
        c.beginPath();
        const o = clamp(pT / 0.2);
        const m = Math.max(2, Math.round(enamel.length * o));
        for (let k = 0; k < m; k++) { const [x, y] = tp(cl, enamel[k]![0], enamel[k]![1]); if (k === 0) c.moveTo(x, y); else c.lineTo(x, y); }
        if (o >= 1) c.closePath();
        c.stroke();
        c.restore();
        c.save();
        c.beginPath();
        enamel.forEach((q, k) => { const [x, y] = tp(cl, q[0], q[1]); if (k === 0) c.moveTo(x, y); else c.lineTo(x, y); });
        c.closePath(); c.clip();
      }
      const n1 = hatchCount(x0, y0, x1, y1, SP * 1.7);
      const nl1 = n1 * clamp((pT - 0.2) / 0.4), nl2 = n1 * clamp((pT - 0.6) / 0.4);
      if (c) c.lineWidth = LW * st.w * 0.9;
      const t1 = hatchRect(c, x0, y0, x1, y1, SP * 1.7, 1, nl1);
      const t2 = pT > 0.6 ? hatchRect(c, x0, y0, x1, y1, SP * 1.7, -1, nl2) : null;
      if (c) c.restore();
      tip = t2 ?? t1 ?? [x0, y0];
    }
  }
  // the surface circle
  if (pC > 0) {
    const cx = cl.cx, cy = cl.circleY;
    const r = CIR_R, r0 = 1.3;
    if (kind === 'C') {
      if (c) {
        c.save(); c.lineWidth = 0.75 * st.w;
        c.beginPath(); c.arc(cx, cy, r + 0.35, 0, Math.PI * 2 * clamp(pC / 0.3)); c.stroke(); c.restore();
        c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip(); c.lineWidth = LW * st.w * 0.9;
      }
      tip = hatchRect(c, cx - r, cy - r, cx + r, cy + r, SP * 0.9, 1, hatchCount(cx - r, cy - r, cx + r, cy + r, SP * 0.9) * clamp((pC - 0.3) / 0.7)) ?? [cx, cy];
      if (c) c.restore();
    } else {
      // wedges: 0 = O (centre), 1 = M, 2 = D, 3 = B, 4 = L (the four side wedges at 90, 270, 0, 180 degrees)
      const ang = [0, Math.PI / 2, -Math.PI / 2, Math.PI, 0];
      if (c) { c.lineWidth = SP * 0.8 * 1.4 * st.w; c.lineCap = 'butt'; }
      let k = 0;
      for (const w of wedges) {
        const f = clamp(pC * wedges.length - k); k++;
        if (f <= 0) continue;
        if (c) {
          c.save(); c.beginPath();
          if (w === 0) c.arc(cx, cy, r0, 0, Math.PI * 2);
          else { const a0 = ang[w]! - Math.PI / 4, a1 = ang[w]! + Math.PI / 4; c.arc(cx, cy, r, a0, a1); c.arc(cx, cy, r0, a1, a0, true); c.closePath(); }
          c.clip();
        }
        const t = hatchRect(c, cx - r, cy - r, cx + r, cy + r, SP * 0.8, 1, hatchCount(cx - r, cy - r, cx + r, cy + r, SP * 0.8) * f);
        if (t) tip = t;
        if (c) c.restore();
      }
    }
  }
  return tip;
}

/** The centre of a mark's drawing on tooth n (sheet mm): for placing it while it moves. */
export function markCentre(arch: Arch, n: number): V2 {
  const cl = cell(n), pr = profile(arch, n);
  const a = tp(cl, 0, pr.H * 0.5);
  return [cl.cx, (a[1] + cl.circleY) / 2];
}

// ---------------------------------------------------------------------------------------------------------- the script
const WEDGES: number[][] = [[0, 1], [0, 3], [0, 2], [0, 4], [1], [0, 1, 2], [3, 0]];

export interface Pen { t0: number; dur: number; id: number }

export class Marks {
  insts: Inst[] = [];
  /** the pen's strokes in time order: when each mark is drawn */
  strokes: Pen[] = [];
  /** time the moves start/stop, for the hand */
  tMoveA = 0; tMoveB = 0;

  constructor(private arch: Arch, wordStartsA: number[], beatsB: number[], beatsC: number[], quad: number[]) {
    let id = 0;
    const A: [number, Kind][] = [[2, 'F'], [3, 'C'], [5, 'F'], [7, 'F'], [10, 'F'], [12, 'C'], [14, 'F'], [15, 'C'], [16, 'F']];
    const B: [number, Kind][] = [[31, 'C'], [30, 'F'], [28, 'F'], [26, 'F'], [23, 'F'], [19, 'C'], [18, 'F']];
    const mk = (n: number, k: Kind, t0: number, dur: number) => {
      const s = id++;
      const w = WEDGES[(s * 3 + n) % WEDGES.length]!;
      const it: Inst = { id: s, kind: k, home: n, t0, dur, moves: [], lift: null, wedges: w };
      this.insts.push(it); this.strokes.push({ t0, dur, id: s });
      return it;
    };
    A.forEach(([n, k], i) => mk(n, k, wordStartsA[i]! - 0.01, 0.17));
    B.forEach(([n, k], i) => mk(n, k, beatsB[i]!, 0.27));
    // C: three or four marks hop on every beat. Every mark hops twice (an in-between tooth, then its place on the chart
    // that describes someone else: his chart's 3 4 7 8 9 12 13 14 above, 30 29 27 25 21 20 18 below).
    const FINAL: Record<number, number> = { 0: 3, 1: 4, 2: 8, 3: 9, 4: 12, 5: 14, 6: 13, 7: 7, 8: 10, 9: 30, 10: 29, 11: 27, 12: 25, 13: 21, 14: 20, 15: 18 };
    const PER = [4, 4, 3, 4, 3, 4, 4, 3, 3];                     // marks hopping on each of the nine beats (3-4)
    const h1: number[] = [], h2: number[] = [];
    PER.forEach((n, bi) => { for (let k = 0; k < n; k++) (h1.length < 16 ? h1 : h2).push(bi); });
    for (let seed = 1; seed < 400; seed++) {
      const rnd = (k: number) => { const x = Math.sin((k + seed * 17.3) * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
      const order = this.insts.map((q) => q.id).sort((x, y) => rnd(x) - rnd(y));
      const finals = new Set(Object.values(FINAL));
      const occ = new Map<number, number>(); this.insts.forEach((q) => occ.set(q.home, q.id));
      const cur = new Map<number, number>(); this.insts.forEach((q) => cur.set(q.id, q.home));
      const mv: { id: number; bi: number; to: number }[] = [];
      let ok = true;
      for (let bi = 0; bi < PER.length && ok; bi++) {
        const jobs: { id: number; hop: number }[] = [];
        order.forEach((id, k) => { if (h1[k] === bi) jobs.push({ id, hop: 1 }); });
        order.forEach((id, k) => { if (h2[k] === bi) jobs.push({ id, hop: 2 }); });
        for (const j of jobs) {
          const from = cur.get(j.id)!, up = from <= 16;
          let to = -1;
          if (j.hop === 2) to = FINAL[j.id]!;
          else {
            const cand: number[] = [];
            for (let n = up ? 1 : 17; n <= (up ? 16 : 32); n++) if (!occ.has(n) && !finals.has(n) && Math.abs(n - from) >= 2 && Math.abs(n - from) <= 7) cand.push(n);
            if (!cand.length) { ok = false; break; }
            to = cand[Math.floor(rnd(j.id * 7 + bi) * cand.length)]!;
          }
          if (occ.has(to) && occ.get(to) !== j.id) { ok = false; break; }
          occ.delete(from); occ.set(to, j.id); cur.set(j.id, to);
          mv.push({ id: j.id, bi, to });
        }
      }
      if (!ok) continue;
      for (const m of mv) this.insts[m.id]!.moves.push({ t: beatsC[m.bi]!, dur: 0.26, to: m.to });
      break;
    }
    this.tMoveA = beatsC[0]!; this.tMoveB = beatsC[beatsC.length - 1]! + 0.26;
    // D: one quadrant per push / away
    const qOf = (n: number) => (n <= 8 ? 0 : n <= 16 ? 1 : n >= 25 ? 2 : 3);
    const cnt = [0, 0, 0, 0];
    const R = (k: number) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    for (const it of this.insts) {
      const fin = it.moves.length ? it.moves[it.moves.length - 1]!.to : it.home;
      const q = qOf(fin), j = cnt[q]!++;
      it.lift = { t: quad[q]! + 0.04 * j, dur: 0.6, dx: 8 + R(it.id) * 16, dy: -(18 + R(it.id + 9) * 16), rot: (R(it.id + 3) - 0.5) * 0.5 };
    }
  }

  /** Current tooth, the one it comes from, the hop progress (-1 when at rest). */
  state(it: Inst, t: number): { cur: number; from: number; k: number } {
    let cur = it.home;
    for (const m of it.moves) {
      if (t >= m.t + m.dur) cur = m.to;
      else if (t >= m.t) return { cur: m.to, from: cur, k: (t - m.t) / m.dur };
      else break;
    }
    return { cur, from: cur, k: -1 };
  }

  /** Draw every mark at time t (the context is in sheet mm; 'lighter' composite). */
  draw(c: CanvasRenderingContext2D, t: number) {
    for (const it of this.insts) {
      if (t < it.t0) continue;
      const p = clamp((t - it.t0) / it.dur);
      const s = this.state(it, t);
      let kL = 0;
      if (it.lift) kL = clamp((t - it.lift.t) / it.lift.dur);
      if (kL >= 1) continue;
      const fA = s.k >= 0 ? 0.5 : 1;
      const shapeN = s.k >= 0 && s.k < 0.5 ? s.from : s.cur;
      // offset of the drawing from the shape tooth
      const c0 = markCentre(this.arch, shapeN);
      let ox = 0, oy = 0, sc = 1, rot = 0, h = 0, a = 1;
      if (s.k >= 0) {
        const e = ease.inOutCubic(s.k);
        const A = markCentre(this.arch, s.from), B = markCentre(this.arch, s.cur);
        const x = A[0] + (B[0] - A[0]) * e, y = A[1] + (B[1] - A[1]) * e;
        h = Math.sin(Math.PI * s.k);
        ox = x - c0[0]; oy = y - c0[1] - h * 16; sc = 1 + 0.5 * h; rot = 0.12 * h * (it.id % 2 ? 1 : -1);
        void fA;
      }
      if (it.lift && kL > 0) {
        const e = ease.outCubic(kL);
        ox += it.lift.dx * e; oy += it.lift.dy * e; rot = it.lift.rot * 0.15 * e; sc *= 1 + 0.12 * e; h = Math.max(h, e);
        a = 1 - sm(0.35, 1, kL);
      }
      const ground = this.shadowOf(it, t, s);
      c.save();
      c.translate(c0[0] + ox, c0[1] + oy); c.rotate(rot); c.scale(sc, sc); c.translate(-c0[0], -c0[1]);
      renderMark(c, this.arch, it.kind, shapeN, p, it.wedges, { col: INK, w: 1, a });
      c.restore();
      if (h > 0.02 && ground > 0) {
        // the shadow it casts on the paper: thicker lines at the ground position, fainter as it rises
        c.save();
        c.translate(c0[0] + ox * 0.1 + 3.4 * h, c0[1] + oy * 0.05 + 4.4 * h);
        renderMark(c, this.arch, it.kind, shapeN, p, it.wedges, { col: SILVER, w: 1, a: 1.0 * ground * (1 - 0.2 * h) });
        c.restore();
      }
    }
  }
  private shadowOf(it: Inst, t: number, s: { k: number }): number {
    if (it.lift && t >= it.lift.t) return 1 - sm(0.45, 1, (t - it.lift.t) / it.lift.dur);
    return s.k >= 0 ? 1 : 0;
  }

  /** Pen tip (sheet mm) of the stroke in progress (or just finished) at t, with its progress; null between strokes. */
  tip(t: number): { x: number; y: number; id: number; p: number; down: boolean } | null {
    for (const st of this.strokes) {
      if (t >= st.t0 - 0.0 && t <= st.t0 + st.dur) {
        const it = this.insts[st.id]!;
        const p = clamp((t - st.t0) / st.dur);
        const q = renderMark(null, this.arch, it.kind, it.home, p, it.wedges, { col: INK, w: 1, a: 1 });
        return { x: q[0], y: q[1], id: st.id, p, down: true };
      }
    }
    return null;
  }
  /** Where the pen starts a stroke (the first hatch line) and where it ends. */
  tipAt(id: number, p: number): V2 { const it = this.insts[id]!; return renderMark(null, this.arch, it.kind, it.home, p, it.wedges, { col: INK, w: 1, a: 1 }); }
}

/** His marks (static, drawn into his chart): the upper row around #8 and a few lower. */
export const HIS_MARKS: [number, Kind, number[]][] = [
  [3, 'F', [0, 1]], [4, 'C', []], [7, 'C', []], [8, 'F', [0, 3]], [9, 'F', [0, 1, 2]], [12, 'F', [0, 2]], [13, 'F', [0, 4]], [14, 'C', []],
  [30, 'C', []], [29, 'F', [0, 1]], [27, 'F', [0, 3]], [25, 'F', [0, 2]], [21, 'F', [1]], [20, 'C', []], [18, 'F', [0, 4]],
];
export function drawHisMarks(c: CanvasRenderingContext2D, arch: Arch) {
  for (const [n, k, w] of HIS_MARKS) renderMark(c, arch, k, n, 1, w.length ? w : [0], { col: INK, w: 1, a: 0.95 });
}
export { HERS };
