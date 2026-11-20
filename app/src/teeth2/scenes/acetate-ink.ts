// Plate 12 `acetate`: layout (table mm, y DOWN, origin = the centre of the bite), the tracing (the six UPPER marks of
// match-ink.ts's biteTrace(), unmirrored: paths and the two static ink canvases the shader reveals with the pen's
// progress), the bite photograph's mask canvases, the lyric phrases and the zone canvas (printed on the photograph, each
// word springing up on its onset), and the pen's schedule. See acetate.ts.
//   table = PS * (X, -Y) of the photographic frame of biteMark(HIS): X right (the biter's right), Y up, mm.
//   PS = 2.2: the same scale as plate 13's tracing; plate 13 shows this sheet turned face-down (mirrored): not changed.
import { SCALE } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, lerp } from '../../engine/util';
import type { Line, Word } from '../../engine/lyrics';
import { HIS, biteMark, type V2 } from '../teeth';
import { T_HEX } from '../palette';

export const PS = 2.2;
/** The bite is photographed square on (the tracing is the one object across plates 12 and 13: no turn). */
export const ROT = 0;
const rotT = (x: number, y: number): V2 => [x * Math.cos(ROT) - y * Math.sin(ROT), x * Math.sin(ROT) + y * Math.cos(ROT)];
/** The print (table mm): a glossy photograph, a white border. */
export const PRINT = { x0: -155, x1: 155, y0: -135, y1: 135, border: 8 };
/** The acetate (table mm), taped over the print. */
export const ACETATE = { x0: -124, x1: 118, y0: -102, y1: 112 };
/** The tracing canvases' region (table mm) and resolution (px per mm, times SCALE). */
export const TRC = { x0: -48, x1: 48, y0: -42, y1: 42, ppm: 16 };
/** The bite photograph's mask region (bite mm, X right, Y up) and resolution. */
export const BM = { x0: -26, x1: 26, y0: -24, y1: 24, ppm: 24 };
/** The lyric zone on the print (table mm): the band above the upper arc. */
export const ZONE = { x0: -85, w: 170, h: 88, ppm: 9, yU: -128 };

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
};

// ------------------------------------------------------------------------------------------------ the tracing
/** The traced order: the upper arc left to right (#11, #10, #9, then #7, #6), the chip on #8 last. The lower arc stays
 *  untraced in the photograph. */
export const ORDER = [11, 10, 9, 7, 6, 8];

export interface MarkPath { n: number; pts: V2[]; len: number; c: V2 }

function area_cy(p: V2[]) { return p.reduce((a, q) => a + q[1], 0) / p.length; }
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
    if (n === 8) {
      // the chip is #8's mesial end (the left end here): start on the top edge just past it so the pen closes on the chip
      const xs = poly.map((p) => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
      const j = poly.findIndex((p, i) => i > 1 && p[0] > x0 + 0.34 * (x1 - x0) && p[1] <= area_cy(poly) );
      if (j > 0) poly = [...poly.slice(j), ...poly.slice(0, j)];
    }
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
export interface Row {
  words: number[]; cap: number; size: number; baseline: number; x0: number; width: number; fam: string;
  cells: Cell[]; wordCells: [number, number][]; wtext: string[]; track: number; hero: boolean; waxy: boolean[];
}
export interface Phrase {
  line: Line; words: Word[]; hero: number; cx: number;
  t0: number; t1: number; rows: Row[];
}

/** The tender register (Cormorant italic, wax pink): sweet and pretty. */
const isWaxy = (w: string) => /^(sweet|pretty)/i.test(w);
const HEAVY = () => F.archivo(75, 900);
const SUPF = () => F.archivo(100, 600);
const SERIF = () => F.serif(600, true);
let mctx: CanvasRenderingContext2D | null = null;
const measure = () => (mctx ??= mk(8, 8).getContext('2d')!);

/** Lay out a phrase's rows (in word order, top to bottom) in table mm, stacked up from just above the upper arc. */
export function layoutPhrase(p: Phrase) {
  const ctx = measure();
  const waxy = (i: number) => isWaxy(p.words[i]!.w);
  const txt = (i: number) => {
    const w = p.words[i]!.w.replace(/'/g, '’');
    if (waxy(i)) return w.toLowerCase().replace(/[,.]/g, '');
    // heroes are capitals; the supporting words keep the case they are sung in
    return i === p.hero ? w.toUpperCase().replace(/[,.]/g, '') : w;
  };
  const capRatio = (fam: string) => { ctx.font = font(fam, 100); return ctx.measureText('H').actualBoundingBoxAscent / 100; };
  const groups: { idx: number[]; hero: boolean }[] = [];
  if (p.hero >= 0) {
    const before = p.words.map((_, i) => i).filter((i) => i < p.hero), after = p.words.map((_, i) => i).filter((i) => i > p.hero);
    if (before.length) groups.push({ idx: before, hero: false });
    groups.push({ idx: [p.hero], hero: true });
    if (after.length) groups.push({ idx: after, hero: false });
  } else groups.push({ idx: p.words.map((_, i) => i), hero: false });
  const solo = p.hero < 0;
  const rows: Row[] = groups.map((g) => {
    const wx = g.hero && waxy(g.idx[0]!);
    const fam = g.hero ? (wx ? SERIF() : HEAVY()) : SUPF();
    const cr = capRatio(fam);
    const chars: { ch: string; wi: number }[] = [];
    g.idx.forEach((wi, j) => { if (j > 0) chars.push({ ch: ' ', wi: -1 }); for (const ch of Array.from(txt(wi))) chars.push({ ch, wi }); });
    ctx.font = font(fam, 100);
    const track = wx ? 0 : g.hero ? 3 : 1;
    const adv = chars.map((c) => ctx.measureText(c.ch).width + (c.ch === ' ' ? 0 : track));
    const total = adv.reduce((a, b) => a + b, 0) - track;
    const maxW = g.hero ? 92 : 90;
    const capWanted = g.hero ? (wx ? 17 : /^go$/i.test(p.words[g.idx[0]!]!.w) ? 42 : 22) : solo ? 14 : 10.5;
    const size = Math.min(capWanted / cr, (maxW * 100) / total);
    const sc = size / 100;
    let x = 0;
    const cells: Cell[] = chars.map((c, i) => { const cell = { ch: c.ch, x, w: adv[i]! * sc }; x += adv[i]! * sc; return cell; });
    const wordCells: [number, number][] = g.idx.map((wi) => {
      const a = chars.findIndex((c) => c.wi === wi), b = chars.length - 1 - [...chars].reverse().findIndex((c) => c.wi === wi);
      return [a, b] as [number, number];
    });
    return {
      words: g.idx, cap: size * cr, size, baseline: 0, x0: p.cx - (total * sc) / 2, width: total * sc, fam, cells, wordCells,
      wtext: g.idx.map(txt), track: (track * size) / 100, hero: g.hero, waxy: g.idx.map(waxy),
    };
  });
  const gap = 3.5;
  let y = -44;
  for (let i = rows.length - 1; i >= 0; i--) { rows[i]!.baseline = y; y -= rows[i]!.cap + gap; }
  // 'let GO': the small word sits on GO's baseline to its left (a stack would put it out of frame above the tall GO)
  if (rows.length === 2 && rows[1]!.hero && /^go$/i.test(rows[1]!.wtext[0]!)) {
    const a = rows[0]!, b = rows[1]!, tot = a.width + 7 + b.width;
    a.x0 = p.cx - tot / 2; b.x0 = a.x0 + a.width + 7; a.baseline = b.baseline;
  }
  p.rows = rows;
}

/** Draw a phrase into the zone canvas at time t: every word that has been sung is printed whole on the print; a word
 *  springs up on its onset (a short rise and a scale overshoot, whole letters, no fade). The pre-approved fallback of the
 *  nib reveal (see acetate.ts, "the nib"). */
export function drawZone(cv: HTMLCanvasElement, p: Phrase | null, t: number): boolean {
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  if (!p) return false;
  const k = ZONE.ppm * SCALE;
  let any = false;
  for (const r of p.rows) {
    r.words.forEach((wi, j) => {
      const w = p.words[wi]!;
      const u = clamp((t - (w.start - 0.02)) / 0.24);
      if (t < w.start - 0.02) return;
      const [a, b] = r.wordCells[j]!;
      const wx0 = r.x0 + r.cells[a]!.x, wx1 = r.x0 + r.cells[b]!.x + r.cells[b]!.w - (r.waxy[j] ? 0 : r.track);
      const s = 0.8 + 0.2 * ease.outBack(u, 2.2), rise = (1 - ease.outCubic(u)) * r.cap * 0.22;
      const cx = (wx0 + wx1) / 2;
      c.setTransform(k, 0, 0, k, -ZONE.x0 * k, -ZONE.yU * k);
      c.translate(cx, r.baseline); c.scale(s, s); c.translate(-cx, -r.baseline + rise);
      c.fillStyle = r.waxy[j] ? T_HEX.wax : T_HEX.lightbox;
      c.font = font(r.fam, r.size);
      c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fontKerning = 'none';
      c.letterSpacing = `${r.track}px`;
      c.fillText(r.wtext[j]!, wx0, r.baseline);
      c.letterSpacing = '0px';
      any = true;
    });
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  return any;
}
export const zoneCanvas = () => mk(ZONE.w * ZONE.ppm * SCALE, ZONE.h * ZONE.ppm * SCALE);

// ------------------------------------------------------------------------------------------------ phrases and the pen's schedule
/** [line start (s), word indices, hero (index within the phrase, -1 none)] */
const SPEC: [number, number[], number][] = [
  [145.41, [0, 1, 2], 2], [145.41, [3, 4, 5], -1], [145.41, [6, 7], 1],
  [148.87, [0, 1, 2], 2], [148.87, [3, 4, 5], -1], [148.87, [6, 7], 1],
  [152.32, [0, 1, 2], 2], [152.32, [3, 4, 5], 2], [152.32, [6, 7], -1],
  [155.56, [0, 1, 2], -1], [155.56, [3, 4], 0], [155.56, [5, 6], 1],
];
/** The pen's inking window on each of the six marks (ORDER): bar by bar left to right, then the chip, slow and careful,
 *  closing on #8's chip at about 158.8 (the word GO). The lamp kicks (152.37-152.99) land while #7 is inked. */
export const SCHED: [number, number][] = [[145.55, 146.85], [147.25, 148.75], [149.35, 151.35], [151.85, 153.55], [153.95, 155.35], [156.2, 158.85]];

/** The twelve phrases (the lyric's rows, one phrase on screen), centred on `camX(t)` (the framing at their onset). */
export function buildPhrases(lines: Line[], beats: number[], camX: (t: number) => number, start: number, end: number): Phrase[] {
  const out: Phrase[] = SPEC.map(([ls, idx, hero]) => {
    const line = lines.find((l) => Math.abs(l.start - ls) < 0.3)!;
    const words = idx.map((i) => line.words[i]!);
    return { line, words, hero, cx: Math.max(-55, Math.min(55, camX(words[0]!.start) * 0.9)), t0: 0, t1: 0, rows: [] } as Phrase;
  });
  out.forEach((p, i) => {
    p.t0 = Math.max(start, p.words[0]!.start - 0.05);
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
  return out;
}

/** The pen at time t: tip (table mm), height above the acetate, heading and the tracing progress per mark. */
export function penAt(t: number, marks: MarkPath[], start: number, end: number) {
  const prog = new Array<number>(12).fill(0);
  const HEAD = 0.78;
  const S = (i: number) => marks[i]!.pts[0]!;
  let x = 0, y = 0, z = 0, on = 1;
  const n = marks.length;
  for (let i = 0; i < n; i++) if (t >= SCHED[i]![1]) prog[i] = 1;
  if (t < SCHED[0]![0]) {
    // the hand arrives from the right and settles on the first mark as the plate begins
    const k = ease.outCubic(clamp((t - start) / (SCHED[0]![0] - start)));
    const s = S(0);
    x = lerp(s[0] + 46, s[0], k); y = lerp(s[1] + 30, s[1], k); z = lerp(14, 0, k);
  } else {
    for (let i = 0; i < n; i++) {
      const [a, b] = SCHED[i]!, mp = marks[i]!;
      if (t >= a && t <= b) {
        const u = clamp((t - a) / (b - a));
        const f = lerp(u, u * u * (3 - 2 * u), 0.5);
        prog[i] = f;
        [x, y] = pathAt(mp, f); z = 0;
        break;
      } else if (i + 1 < n && t > b && t < SCHED[i + 1]![0]) {
        const nx = SCHED[i + 1]!;
        const u = ease.inOutCubic(clamp((t - b) / (nx[0] - b)));
        const p0 = pathAt(mp, 1), p1 = S(i + 1);
        x = lerp(p0[0], p1[0], u); y = lerp(p0[1], p1[1], u);
        z = Math.min(11, 0.2 * Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 3) * Math.sin(Math.PI * u);
        break;
      } else if (i === n - 1 && t > b) {
        // the last mark closed: the pen lifts, the hand draws back to the lower right as the camera pulls away
        const k = ease.inCubic(clamp((t - b) / (end + 0.4 - b)));
        const p0 = pathAt(mp, 1);
        x = p0[0] + 260 * k; y = p0[1] + 110 * k; z = 3 + 36 * ease.outQuad(clamp((t - b) / 0.35));
        if (k >= 1) on = 0;
      }
    }
  }
  return { x, y, z, head: HEAD, tilt: 0.85, on, prog };
}
