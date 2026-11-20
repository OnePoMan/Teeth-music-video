// Plate 12 `acetate`: layout (table mm, y DOWN, origin = the centre of the bite), the tracing (paths, the two static ink
// canvases the shader reveals with the pen's progress), the bite photograph's mask canvases, the lyric phrases and the
// two text-zone canvases (printed on the photograph beneath), and the pen's schedule. See acetate.ts.
//   table = PS * (X, -Y) of the photographic frame of biteMark(HIS): X right (the biter's right), Y up, mm.
//   PS = 2.2: the same scale as plate 13's tracing, so the finished sheet is the sheet that match lays over the casts.
import { SCALE } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, lerp } from '../../engine/util';
import type { Line, Word } from '../../engine/lyrics';
import { HIS, biteMark, type V2 } from '../teeth';
import { T_HEX } from '../palette';

export const PS = 2.2;
/** The bite is photographed turned (clockwise on the print, rad): the biter's head was tilted. */
export const ROT = 0.49;
const rotT = (x: number, y: number): V2 => [x * Math.cos(ROT) - y * Math.sin(ROT), x * Math.sin(ROT) + y * Math.cos(ROT)];
/** The print (table mm): a glossy photograph, a white border. */
export const PRINT = { x0: -155, x1: 155, y0: -135, y1: 135, border: 8 };
/** The acetate (table mm), taped over the print. */
export const ACETATE = { x0: -132, x1: 126, y0: -124, y1: 118 };
/** The tracing canvases' region (table mm) and resolution (px per mm, times SCALE). */
export const TRC = { x0: -48, x1: 48, y0: -42, y1: 42, ppm: 16 };
/** The bite photograph's mask region (bite mm, X right, Y up) and resolution. */
export const BM = { x0: -26, x1: 26, y0: -24, y1: 24, ppm: 24 };
/** The two lyric zones on the print (table mm): the upper one above the upper arc, the lower one below the lower arc. */
export const ZONE = { x0: -80, w: 160, h: 90, ppm: 9, yU: -126, yL: 36 };

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
};

// ------------------------------------------------------------------------------------------------ the tracing
/** The traced order: upper arc (left canine to the right canine, then #8, the chip, last), then the lower arc left to right. */
export const ORDER = [11, 10, 9, 7, 6, 8, 22, 23, 24, 25, 26, 27];

export interface MarkPath { n: number; pts: V2[]; len: number; c: V2 }

function area(p: V2[]) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1]; } return s; }

/** The 12 tooth marks as pen paths (table mm): a closed outline from the leftmost vertex, clockwise on the table (along the
 *  top edge first), resampled evenly (0.3 mm) with a hand's slight tremor, as in plate 13's tracing. */
export function buildMarks(): MarkPath[] {
  const bm = biteMark(HIS, { gap: 16 });
  const all = [...bm.upper, ...bm.lower];
  return ORDER.map((n, k) => {
    const m = all.find((q) => q.n === n)!;
    let poly: V2[] = m.poly.map(([X, Y]) => rotT(PS * X, -PS * Y));
    if (area(poly) < 0) poly = poly.slice().reverse();
    let s0 = 0;
    poly.forEach((p, i) => { if (p[0] < poly[s0]![0]) s0 = i; });
    poly = [...poly.slice(s0), ...poly.slice(0, s0)];
    poly.push(poly[0]!);
    const cum = [0];
    for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1]! + Math.hypot(poly[i]![0] - poly[i - 1]![0], poly[i]![1] - poly[i - 1]![1]));
    const L = cum[cum.length - 1]!;
    const N = Math.max(24, Math.round(L / 0.3));
    const pts: V2[] = [];
    let j = 1;
    for (let i = 0; i <= N; i++) {
      const d = (L * i) / N;
      while (j < cum.length - 1 && cum[j]! < d) j++;
      const a = poly[j - 1]!, b = poly[j]!, seg = Math.max(cum[j]! - cum[j - 1]!, 1e-6), u = clamp((d - cum[j - 1]!) / seg);
      const s = i * 0.11 + k * 3.1;
      pts.push([
        lerp(a[0], b[0], u) + 0.05 * Math.sin(s * 1.7) + 0.03 * Math.sin(s * 4.3 + 1),
        lerp(a[1], b[1], u) + 0.05 * Math.cos(s * 1.3 + 2) + 0.03 * Math.sin(s * 3.7),
      ]);
    }
    pts[N] = pts[0]!;
    const c: V2 = rotT(PS * m.center[0], -PS * m.center[1]);
    return { n, pts, len: L, c };
  });
}
export function pathAt(m: MarkPath, f: number): V2 {
  const x = clamp(f) * (m.pts.length - 1), i = Math.min(Math.floor(x), m.pts.length - 2), u = x - i;
  return [lerp(m.pts[i]![0], m.pts[i + 1]![0], u), lerp(m.pts[i]![1], m.pts[i + 1]![1], u)];
}

/** Two static canvases: coverage (white ink, 0.42 mm line, antialiased) and data (nearest-filtered: R = the mark's index
 *  * 20 + 10, G = the position along its path), so the shader shows the ink only up to the pen's progress. */
export function buildInk(marks: MarkPath[]): { cov: HTMLCanvasElement; dat: HTMLCanvasElement } {
  const k = TRC.ppm * SCALE;
  const w = (TRC.x1 - TRC.x0) * k, h = (TRC.y1 - TRC.y0) * k;
  const cov = mk(w, h), dat = mk(w, h);
  for (const cv of [cov, dat]) {
    const c = cv.getContext('2d')!;
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(k, 0, 0, k, -TRC.x0 * k, -TRC.y0 * k);
    c.lineCap = 'round'; c.lineJoin = 'round';
  }
  const cc = cov.getContext('2d')!, dc = dat.getContext('2d')!;
  cc.strokeStyle = '#fff'; cc.lineWidth = 0.42;
  dc.lineWidth = 1.1;
  marks.forEach((m, idx) => {
    cc.beginPath();
    m.pts.forEach((p, i) => { if (i === 0) cc.moveTo(p[0], p[1]); else cc.lineTo(p[0], p[1]); });
    cc.stroke();
    const N = m.pts.length - 1;
    for (let i = 0; i < N; i++) {
      dc.strokeStyle = `rgb(${idx * 20 + 10},${Math.round((255 * (i + 0.5)) / N)},0)`;
      dc.beginPath(); dc.moveTo(m.pts[i]![0], m.pts[i]![1]); dc.lineTo(m.pts[i + 1]![0], m.pts[i + 1]![1]); dc.stroke();
    }
  });
  return { cov, dat };
}

// ------------------------------------------------------------------------------------------------ the photograph's bite
/** Masks (bite mm): S = the scoop (the lens between his arcs, closed at the canines) united with his tooth bars; G = the
 *  tooth bars alone (the incisal grooves). The photograph's shader blurs them (mip levels) into a bowl and relief. */
export function buildBite(): { S: HTMLCanvasElement; G: HTMLCanvasElement } {
  const k = BM.ppm;
  const w = (BM.x1 - BM.x0) * k, h = (BM.y1 - BM.y0) * k;
  const S = mk(w, h), G = mk(w, h);
  const bm = biteMark(HIS, { gap: 16 });
  for (const cv of [S, G]) {
    const c = cv.getContext('2d')!;
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(k, 0, 0, -k, -BM.x0 * k, BM.y1 * k);
    c.fillStyle = '#fff';
  }
  const sc = S.getContext('2d')!, gc = G.getContext('2d')!;
  const yU = (X: number) => 14.9 - 0.0235 * X * X, yL = (X: number) => -11.9 + 0.0225 * X * X;
  // the scoop: its upper rim follows the upper arc (his upper bars sit on it), then it rounds out and down well below the
  // lower arc, so the lower teeth's marks lie inside the flesh as grooves on the wall (one scoop, not a mouth)
  void yL;
  const cx = 0.8, cy = -0.5, ra = 19.8, rb = 14.2;
  const XJ = 17.2, phi0 = Math.asin(clamp((yU(XJ) - cy) / rb, -1, 1));
  sc.beginPath();
  sc.moveTo(-XJ, yU(-XJ));
  for (let X = -XJ; X <= XJ; X += 0.5) sc.lineTo(X, yU(X));
  for (let a = phi0; a >= -Math.PI - phi0; a -= 0.05) {
    const wob = 1 + 0.025 * Math.sin(a * 5 + 1.3) + 0.02 * Math.sin(a * 9);
    sc.lineTo(cx + ra * wob * Math.cos(a), cy + rb * wob * Math.sin(a));
  }
  sc.closePath();
  sc.fill();
  for (const m of [...bm.upper, ...bm.lower]) {
    for (const c of [sc, gc]) {
      c.beginPath();
      m.poly.forEach((p, i) => { if (i === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); });
      c.closePath(); c.fill();
    }
  }
  return { S, G };
}

// ------------------------------------------------------------------------------------------------ the lyric
export interface Cell { ch: string; x: number; w: number }
export interface Row { words: number[]; cap: number; size: number; baseline: number; x0: number; width: number; cells: Cell[]; wordCells: [number, number][]; wtext: string[]; track: number; hero: boolean }
export interface Phrase {
  line: Line; words: Word[]; hero: number; mark: number; zone: 0 | 1; cx: number;
  t0: number; t1: number; lead: number[]; rows: Row[];
  /** the pen's inking window on the mark */
  tA: number; tB: number;
}

const HEAVY = () => F.archivo(75, 900);
const LIGHT = () => F.archivo(62, 300);
const SUPF = () => F.archivo(112, 500);
let mctx: CanvasRenderingContext2D | null = null;
const measure = () => (mctx ??= mk(8, 8).getContext('2d')!);

/** Lay out a phrase's rows (in word order, top to bottom) in table mm. */
export function layoutPhrase(p: Phrase) {
  const ctx = measure();
  const txt = (i: number) => {
    const s = p.words[i]!.w.toUpperCase().replace(/'/g, '’');
    return i === p.hero ? s.replace(/[,.]/g, '') : s;
  };
  const capRatio = (fam: string) => { ctx.font = font(fam, 100); return ctx.measureText('H').actualBoundingBoxAscent / 100; };
  // rows: runs of supporting words before the hero, the hero, supporting after
  const groups: { idx: number[]; hero: boolean }[] = [];
  if (p.hero >= 0) {
    const before = p.words.map((_, i) => i).filter((i) => i < p.hero), after = p.words.map((_, i) => i).filter((i) => i > p.hero);
    if (before.length) groups.push({ idx: before, hero: false });
    groups.push({ idx: [p.hero], hero: true });
    if (after.length) groups.push({ idx: after, hero: false });
  } else groups.push({ idx: p.words.map((_, i) => i), hero: false });
  const solo = p.hero < 0;
  const rows: Row[] = groups.map((g) => {
    const fam = g.hero ? HEAVY() : SUPF();
    const cr = capRatio(fam);
    // the string and its advance at 100 px (heavy metrics for the hero: positions are locked across the weight snap)
    const chars: { ch: string; wi: number }[] = [];
    g.idx.forEach((wi, j) => { if (j > 0) chars.push({ ch: ' ', wi: -1 }); for (const ch of Array.from(txt(wi))) chars.push({ ch, wi }); });
    ctx.font = font(fam, 100);
    const track = g.hero ? 3 : 2;
    const adv = chars.map((c) => ctx.measureText(c.ch).width + (c.ch === ' ' ? 0 : track));
    const total = adv.reduce((a, b) => a + b, 0) - track;
    const maxW = g.hero ? 80 : 84;
    const capWanted = g.hero ? 22 : solo ? 13 : 7.5;
    let size = Math.min(capWanted / cr, (maxW * 100) / total);
    const sc = size / 100;
    let x = 0;
    const cells: Cell[] = chars.map((c, i) => { const cell = { ch: c.ch, x, w: adv[i]! * sc }; x += adv[i]! * sc; return cell; });
    const wordCells: [number, number][] = g.idx.map((wi) => {
      const a = chars.findIndex((c) => c.wi === wi), b = chars.length - 1 - [...chars].reverse().findIndex((c) => c.wi === wi);
      return [a, b] as [number, number];
    });
    return { words: g.idx, cap: size * cr, size, baseline: 0, x0: p.cx - (total * sc) / 2, width: total * sc, cells, wordCells, wtext: g.idx.map(txt), track: (track * size) / 100, hero: g.hero };
  });
  const gap = 3;
  if (p.zone === 0) {
    let y = -44;
    for (let i = rows.length - 1; i >= 0; i--) { rows[i]!.baseline = y; y -= rows[i]!.cap + gap; }
  } else {
    let y = 42;
    for (const r of rows) { y += r.cap; r.baseline = y; y += gap; }
  }
  p.rows = rows;
}

/** Draw a phrase into its zone canvas at time t: words uncovered (a left-to-right wipe) ahead of their onsets as unsung
 *  halide at 35%, lit lightbox white on the onset; the hero snaps from light to black weight, letters in place. */
export function drawZone(cv: HTMLCanvasElement, p: Phrase | null, t: number, zone: 0 | 1): boolean {
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  if (!p || p.zone !== zone) return false;
  const k = ZONE.ppm * SCALE;
  const y0 = zone === 0 ? ZONE.yU : ZONE.yL;
  c.setTransform(k, 0, 0, k, -ZONE.x0 * k, -y0 * k);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  let any = false;
  for (const r of p.rows) {
    r.words.forEach((wi, j) => {
      const w = p.words[wi]!;
      const rev0 = Math.max(p.t0, w.start - p.lead[wi]!);
      const prog = clamp((t - rev0) / 0.2);
      if (prog <= 0) return;
      const sung = t >= w.start - 0.045;
      const hero = r.hero;
      const waxy = hero && /^(sweet|pretty)/i.test(w.w);
      const [a, b] = r.wordCells[j]!;
      const wx0 = r.x0 + r.cells[a]!.x, wx1 = r.x0 + r.cells[b]!.x + r.cells[b]!.w;
      c.save();
      c.beginPath(); c.rect(wx0 - 2, y0 + (r.baseline - r.cap - 4 - y0), (wx1 - wx0 + 4) * ease.outQuad(prog), r.cap + 12); c.clip();
      c.fillStyle = sung ? (waxy ? T_HEX.wax : T_HEX.lightbox) : T_HEX.halide;
      c.globalAlpha = sung ? 1 : 0.35;
      const fam = hero ? (sung ? HEAVY() : LIGHT()) : SUPF();
      c.font = font(fam, r.size);
      // one fillText per word; the letters keep their heavy-weight places (the light state is spaced out to the same width)
      const text = r.wtext[j]!, n = Array.from(text).length;
      c.textAlign = 'left'; c.fontKerning = 'none';
      c.letterSpacing = '0px';
      const nat = c.measureText(text).width;
      c.letterSpacing = `${hero && !sung ? (wx1 - wx0 - nat) / n : r.track}px`;
      c.fillText(text, wx0, r.baseline);
      c.letterSpacing = '0px';
      c.restore();
      any = true;
    });
  }
  return any;
}
export const zoneCanvas = () => mk(ZONE.w * ZONE.ppm * SCALE, ZONE.h * ZONE.ppm * SCALE);

// ------------------------------------------------------------------------------------------------ phrases and the pen's schedule
/** [line start (s), word indices, hero (index within the phrase, -1 none), mark (index into ORDER)] */
const SPEC: [number, number[], number, number][] = [
  [145.41, [0, 1, 2], 2, 0], [145.41, [3, 4, 5], -1, 1], [145.41, [6, 7], 1, 2],
  [148.87, [0, 1, 2], 2, 3], [148.87, [3, 4, 5], -1, 4], [148.87, [6, 7], 1, 5],
  [152.32, [0, 1, 2], 2, 6], [152.32, [3, 4, 5], 2, 7], [152.32, [6, 7], -1, 8],
  [155.56, [0, 1, 2], -1, 9], [155.56, [3, 4], 0, 10], [155.56, [5, 6], 1, 11],
];

/** The twelve phrases (one per mark), their windows on the print and the pen's inking window on each mark. */
export function buildPhrases(lines: Line[], beats: number[], marks: MarkPath[], start: number, end: number): Phrase[] {
  const out: Phrase[] = SPEC.map(([ls, idx, hero, mark]) => {
    const line = lines.find((l) => Math.abs(l.start - ls) < 0.3)!;
    const words = idx.map((i) => line.words[i]!);
    return {
      line, words, hero, mark, zone: mark >= 6 ? 1 : 0, cx: 0.45 * marks[mark]!.c[0],
      t0: 0, t1: 0, lead: words.map((_, i) => (i === hero ? 0.095 : 0.09)), rows: [], tA: 0, tB: 0,
    } as Phrase;
  });
  out.forEach((p, i) => {
    p.t0 = Math.max(start, p.words[0]!.start - p.lead[0]!);
    const prev = out[i - 1];
    if (!prev) return;
    if (prev.line === p.line) {
      p.t0 = Math.max(p.t0, Math.min(prev.words[prev.words.length - 1]!.end - 0.05, p.words[0]!.start - 0.05));
      prev.t1 = p.t0;
    } else {
      prev.t1 = Math.min(beats.find((b) => b > prev.line.end + 0.005) ?? prev.line.end + 0.4, p.words[0]!.start - 0.05);
      p.t0 = Math.max(p.t0, prev.t1);
    }
  });
  out[out.length - 1]!.t1 = end;
  // the pen: on its mark as the phrase begins, inked at a careful pace, lifting before the next
  out.forEach((p, i) => {
    const nx = out[i + 1];
    p.tA = i === 0 ? start + 0.12 : Math.max(p.words[0]!.start - 0.1, out[i - 1]!.tB + 0.3);
    const avail = (nx ? nx.words[0]!.start - 0.1 - 0.3 : end - 0.6) - p.tA;
    p.tB = p.tA + clamp(marks[p.mark]!.len / 24, 0.6, Math.max(avail, 0.5));
  });
  return out;
}

/** The pen at time t: tip (table mm), height above the acetate, heading and the tracing progress per mark. */
export function penAt(t: number, marks: MarkPath[], ph: Phrase[], start: number, end: number) {
  const prog = new Array<number>(12).fill(0);
  const HEAD_UP = 0.78, HEAD_LO = -0.55;
  const headOf = (i: number) => (i < 6 ? HEAD_UP : HEAD_LO);
  const S = (i: number) => marks[ph[i]!.mark]!.pts[0]!;
  let x = 0, y = 0, z = 0, head = HEAD_UP, on = 1;
  for (let i = 0; i < ph.length; i++) {
    const m = ph[i]!.mark;
    if (t >= ph[i]!.tB) prog[m] = 1;
  }
  const first = ph[0]!;
  if (t < first.tA) {
    // the hand arrives from the right and settles on the first mark as the plate begins
    const k = ease.outCubic(clamp((t - start) / (first.tA - start)));
    const s = S(0);
    x = lerp(s[0] + 46, s[0], k); y = lerp(s[1] + 30, s[1], k); z = lerp(14, 0, k); head = HEAD_UP;
  } else {
    let done = false;
    for (let i = 0; i < ph.length && !done; i++) {
      const p = ph[i]!, mp = marks[p.mark]!;
      if (t >= p.tA && t <= p.tB) {
        const u = clamp((t - p.tA) / (p.tB - p.tA));
        const f = lerp(u, u * u * (3 - 2 * u), 0.5);
        prog[p.mark] = f;
        [x, y] = pathAt(mp, f); z = 0; head = headOf(i); done = true;
      } else if (i + 1 < ph.length && t > p.tB && t < ph[i + 1]!.tA) {
        const nx = ph[i + 1]!;
        const u = ease.inOutCubic(clamp((t - p.tB) / (nx.tA - p.tB)));
        const a = S(i), b = S(i + 1);
        x = lerp(a[0], b[0], u); y = lerp(a[1], b[1], u);
        z = Math.min(11, 0.2 * Math.hypot(b[0] - a[0], b[1] - a[1]) + 3) * Math.sin(Math.PI * u);
        head = lerp(headOf(i), headOf(i + 1), u); done = true;
      } else if (i === ph.length - 1 && t > p.tB) {
        // the last mark closed: the hand lifts away to the lower right as the camera pulls back
        const k = ease.inCubic(clamp((t - p.tB) / (end - 0.3 - p.tB)));
        const s = S(i);
        x = s[0] + 300 * k; y = s[1] + 120 * k; z = 3 + 40 * ease.outQuad(clamp((t - p.tB) / 0.3)); head = HEAD_LO; done = true;
        if (k >= 1) on = 0;
      }
    }
  }
  return { x, y, z, head, tilt: 0.96, on, prog };
}
