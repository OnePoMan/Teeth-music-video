// Plate 4 `polygraph` (34.64 - 48.73): the script. Everything the plate does is a pure function of song time, and
// this file holds the functions: the phrases and their pen timing (from data/teeth/lyrics.json), the paper's feed
// (the "rack": where the pens stand on the paper, a ticker that follows the cardio pen as it writes; the paper is
// whipped forward only at line starts), the four signals, the events (the lie, the butterflies, the swing under the
// paper, the race, the tear) and the camera setups.
//
// Paper frame (world units, 1 unit = 1 logical px at the base framing): x along the strip (the paper is fed toward
// -x on screen: the rack moves +x), y up. The paper's z = 0; the camera looks down -z (z > 0 is the front).
import { strokeText, type StrokeText } from '../../engine/stroke';
import { clamp, lerp, ease, mulberry32 } from '../../engine/util';
import type { Lyrics, Line, Word } from '../../engine/lyrics';

// ---------------------------------------------------------------------------------------------- constants
export const T0 = 34.64, T1 = 48.73;
/** The synths' downbeat: the three other pens drop, the paper kicks into its feed. */
export const T_DROP = 34.912;
/** "lie": the cardio pen jumps a channel. */
export const T_LIE = 40.224;
/** "butterflies": the tremor (all four pens, the paper). */
export const T_BUT = 40.484;
/** The camera swings under the paper (SW0 - SW1, landing on the 43.55 downbeat); it comes back by a cut on 45.27. */
export const SW0 = 43.1, SW1 = 43.545;
/** The pen lunges and the paper tears (the slit is whole by T1). */
export const T_TEAR = 48.3;

/** Channel centres (y): skin conductance, pneumo (thoracic), pneumo (abdominal), cardio. */
export const CH = [330, 150, -30, -210] as const;
/** Pens' x offsets from the rack (screen right of the writing head). */
export const PEN_OX = [150, 110, 70, 0] as const;
/** What the cardio pen's jump adds (one channel). */
export const JUMP = 180;
/** Text baseline below the cardio line. */
export const BASE_OFF = -30;
export const PEN_UP = 70;
/** Whip: how far the paper is fed to flush a line (clear of anything a raking view could see), and the feed's creep while a hero is held. */
const FLUSH = 3500;
const HOLD_V = 36;

export interface PtT { x: number; y: number; t: number; first: boolean }
export interface PhraseS {
  words: Word[];
  text: string;
  hero: boolean;
  mirror: boolean;
  s: 1 | -1;
  em: number;
  pen: number; // ink width (world units)
  st: StrokeText;
  /** Per char: write time window. */
  times: [number, number][];
  /** World polylines (strokes), each point with its write time. */
  strokes: PtT[][];
  /** First / last letter time. */
  t0: number; t1: number;
  /** The row (line of paper between two whips) the phrase is in, and when the next whip has landed (the ink may go). */
  row: number; vis1: number;
  /** World extent of the text. */
  xMin: number; xMax: number; yb: number; capH: number;
  /** Text width in px at the phrase's em. */
  width: number;
  /** The char index from which the baseline is raised (the lie). */
  raiseAt: number;
}
/** One written word: the cardio pen climbs out of its channel, writes it, and drops back (or runs on into the next word). */
export interface Unit {
  p: number; first: PtT; last: PtT; sIdx: number[];
  t0: number; t1: number; tc0: number; td1: number;
  joinPrev: boolean; joinNext: boolean;
}
export interface CamState { w: number; cy: number; roll: number; tilt: number; rs: number; phi: number }

/** Phrases (the words of a line that are written together), the camera width they are written under (their size follows
 *  from it) and where the pen stands on screen (rs, px right of centre). Rows: the paper is whipped only between rows. */
const PH_DEFS: { line: number; words: number[]; hero?: boolean; mirror?: boolean; w: number; rs: number }[] = [
  { line: 0, words: [0, 1, 2], w: 2250, rs: 640 }, // CALL ME IN
  { line: 0, words: [3, 4, 5], w: 2250, rs: 640 }, // THE MORNING TO
  { line: 0, words: [6], hero: true, w: 2150, rs: 750 }, // APOLOGIZE
  { line: 1, words: [0, 1], w: 1200, rs: 480 }, // EVERY LITTLE
  { line: 1, words: [2, 3, 4], w: 2100, rs: 700 }, // LIE GIVES ME
  { line: 1, words: [5], hero: true, w: 2500, rs: 750 }, // BUTTERFLIES
  { line: 2, words: [0, 1], w: 2400, rs: 650 }, // SOMETHING IN
  { line: 2, words: [2, 3], w: 2400, rs: 650 }, // THE WAY
  { line: 2, words: [4, 5], w: 2400, rs: 650 }, // YOU'RE LOOKING (written before the swing: not mirrored)
  { line: 2, words: [6, 7], mirror: true, w: 2250, rs: 700 }, // THROUGH MY (written on the paper reversed: it reads from beneath)
  { line: 2, words: [8], hero: true, mirror: true, w: 2250, rs: 750 }, // EYES
  { line: 3, words: [0, 1, 2], w: 1200, rs: 480 }, // DON'T KNOW IF
  { line: 3, words: [3, 4, 5], w: 1200, rs: 480 }, // I'M GONNA MAKE
  { line: 3, words: [6, 7], w: 1200, rs: 480 }, // IT OUT
  { line: 3, words: [8], hero: true, w: 2100, rs: 750 }, // ALIVE
];
const ROWS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10], [11, 12, 13, 14]];
const LINE_T = [34.638, 38.422, 41.745, 45.272];
/** Write windows that override the sung ones: YOU'RE LOOKING is on the paper before the camera leaves the top of it. */
const OVR: Record<string, [number, number]> = { '8:0': [42.855, 43.06], '8:1': [43.065, 43.25] };

// ---------------------------------------------------------------------------------------------- monotone hermite
function hermite(K: [number, number][]): (t: number) => number {
  const n = K.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((K[i + 1]![1] - K[i]![1]) / Math.max(1e-6, K[i + 1]![0] - K[i]![0]));
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (i === 0) m[i] = d[0] ?? 0;
    else if (i === n - 1) m[i] = d[n - 2] ?? 0;
    else m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (2 * d[i - 1]! * d[i]!) / (d[i - 1]! + d[i]!);
  }
  return (t: number) => {
    if (t <= K[0]![0]) return K[0]![1];
    if (t >= K[n - 1]![0]) return K[n - 1]![1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (K[mid]![0] <= t) lo = mid; else hi = mid; }
    const h = K[hi]![0] - K[lo]![0], u = (t - K[lo]![0]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * K[lo]![1] + (u3 - 2 * u2 + u) * h * m[lo]! + (-2 * u3 + 3 * u2) * K[hi]![1] + (u3 - u2) * h * m[hi]!;
  };
}
interface Seg { t0: number; t1: number; f: (t: number) => number }

// ---------------------------------------------------------------------------------------------- the script
export class Script {
  phrases: PhraseS[] = [];
  units: Unit[] = [];
  /** The moments the paper lands after a whip (rows 1..4); the last is the cut back over the paper. */
  landings: number[] = [];
  private segs: Seg[] = [];
  private moves: { te: number; d: number; p: CamState }[] = [];
  private cam0: CamState = { w: 2600, cy: 20, roll: -0.02, tilt: 0.05, rs: 600, phi: 0 };
  /** Cardio phase and pneumo phases (tables, 480 Hz). */
  private tab0 = T0 - 0.1;
  private cardioTab: Float64Array;
  private breathTab: Float64Array;
  /** Tear path (world), the slit ragged line: x, y, time the tip passed. */
  tear: { x: number; y: number; t: number; r: number }[] = [];
  constructor(ly: Lyrics, beats: number[]) {
    this.build(ly, beats);
    const N = Math.ceil((T1 + 0.2 - this.tab0) * 480) + 2;
    this.cardioTab = new Float64Array(N);
    this.breathTab = new Float64Array(N);
    let ph = 0.3, bp = 0.2;
    for (let i = 0; i < N; i++) {
      const t = this.tab0 + i / 480;
      this.cardioTab[i] = ph; this.breathTab[i] = bp;
      ph += this.hr(t) / 60 / 480;
      bp += this.br(t) / 60 / 480;
    }
    this.buildTear();
    this.buildCam();
  }

  // ------------------------------------------------------------------------------------------ build
  private build(ly: Lyrics, beats: number[]) {
    const lines: Line[] = LINE_T.map((t) => ly.lines.find((l) => Math.abs(l.start - t) < 0.3)!);
    // --- the phrases' geometry: size from the camera width they are written under (supporting ~10% cap height, heroes ~20%
    // but never wider than 84% of the frame, so that the whole word sits inside title-safe)
    const G = PH_DEFS.map((d, i) => {
      const words = d.words.map((k) => lines[d.line]!.words[k]!);
      const text = words.map((w) => w.w.toUpperCase()).join(' ');
      const hero = !!d.hero;
      const st100 = strokeText(text, 'sans', 100, 4);
      let top = 0;
      for (const sk of st100.strokes) for (const p of sk) top = Math.min(top, p.y);
      const cap100 = -top;
      const capT = (hero ? 0.2 : 0.1) * d.w * 9 / 16;
      const wLim = (hero ? 0.84 : 0.9) * d.w;
      const em = Math.min((capT / cap100) * 100, (wLim / st100.width) * 100, hero ? 460 : 200);
      const st = strokeText(text, 'sans', em, em * 0.04);
      const chars = Array.from(text);
      // wider word spaces (the stroke font's space is narrow at this size)
      const gapW = 0.26 * em;
      const wordOf: number[] = [];
      { let wi = 0; chars.forEach((c) => { wordOf.push(wi); if (c === ' ') wi++; }); }
      st.strokes.forEach((sk, si) => { const sh = gapW * wordOf[st.charOf[si]!]!; if (sh) for (const p of sk) p.x += sh; });
      const left: number[] = chars.map(() => Infinity), right: number[] = chars.map(() => -Infinity);
      st.strokes.forEach((sk, si) => {
        const ci = st.charOf[si]!;
        for (const p of sk) { left[ci] = Math.min(left[ci]!, p.x); right[ci] = Math.max(right[ci]!, p.x); }
      });
      const firstCh = left.findIndex((v) => v < Infinity);
      const lastCh = right.length - 1 - [...right].reverse().findIndex((v) => v > -Infinity);
      return { d, i, words, text, hero, mirror: !!d.mirror, st, em, chars, left, right, firstCh, lastCh, cap100 };
    });

    const w1s: number[] = [];
    let inkMax = -1e9;
    let tEndPrev = T0, xRackPrev = 0, sPrev: 1 | -1 = 1, prevT1 = T0;
    const rowOfPhrase: number[] = [];
    ROWS.forEach((row, r) => {
      const g0 = G[row[0]!]!;
      const s: 1 | -1 = g0.mirror ? -1 : 1;
      // --- the whip that opens the row: it lands on a beat that leaves the previous line 0.18 s to be seen, a hair
      // before the first letter; the one under the paper is hidden at the moment the paper is edge-on to the camera
      let w0 = T0, w1 = T0;
      const t0w = g0.words[0]!.start - 0.045;
      if (r > 0) {
        if (r === 3) { const te = SW0 + 0.5 * (SW1 - SW0); w0 = te - 0.006; w1 = te + 0.006; }
        else {
          const cand = beats.filter((b) => b >= prevT1 + 0.18 && b <= t0w + 0.06);
          w1 = cand.length ? cand[cand.length - 1]! : t0w - 0.005;
          w0 = w1 - (r === 4 ? 0.012 : 0.09);
        }
        this.landings.push(w1);
      }
      // --- write windows (letters spring up 45 ms ahead of the word; the pen finishes a word early, the ink waits whole)
      const wins: { a: number; b: number }[][] = [];
      let prevB = r === 0 ? T0 : w1;
      row.forEach((pi, pj) => {
        const g = G[pi]!, W: { a: number; b: number }[] = [];
        g.words.forEach((w, j) => {
          let a = Math.max(w.start - 0.045, prevB);
          if (r > 0 && pj === 0 && j === 0) a = Math.max(a, w1 + 0.012);
          const n = Array.from(w.w).length;
          let b = Math.max(a + 0.06, a + Math.min(0.92 * (w.end - a), 0.06 * n + 0.14));
          const ov = OVR[`${pi}:${j}`];
          if (ov) { a = ov[0]; b = ov[1]; }
          W.push({ a, b }); prevB = b;
        });
        wins.push(W);
      });
      // --- layout along the row
      let rowW = 0;
      row.forEach((pi, pj) => {
        const g = G[pi]!;
        rowW += g.right[g.lastCh]! - g.left[g.firstCh]! + (pj > 0 ? 0.5 * g.em : 0);
      });
      const rackStart = r === 0 ? 0 : s === 1 ? inkMax + FLUSH : inkMax + rowW + FLUSH;
      let X = rackStart;
      const K: [number, number][] = [];
      let rowT0 = 0, rowT1 = 0;
      row.forEach((pi, pj) => {
        const g = G[pi]!, W = wins[pj]!;
        const text = g.text, st = g.st, chars = g.chars;
        // char times
        const times: [number, number][] = [];
        g.words.forEach((w, j) => {
          const { a, b } = W[j]!;
          const n = Array.from(w.w).length;
          for (let c = 0; c < n; c++) times.push([a + ((b - a) * c) / n, a + ((b - a) * (c + 1)) / n]);
          if (j < g.words.length - 1) times.push([b, b]);
        });
        if (pj > 0) X += s * 0.5 * g.em;
        const O = X - s * g.left[g.firstCh]!;
        const raiseAt = pi === 4 ? 3 : -1;
        const yb = CH[3] + BASE_OFF + (pi >= 5 ? JUMP : 0);
        const capH = g.cap100 * (g.em / 100);
        const strokes: PtT[][] = [];
        st.strokes.forEach((sk, si) => {
          const ci = st.charOf[si]!;
          const [ra, rb] = st.charRange[ci]!;
          const [ta, tb] = times[ci]!;
          const dy = raiseAt >= 0 && ci >= raiseAt ? JUMP : 0;
          const L = st.lens[si]!;
          strokes.push(sk.map((p, k) => {
            const len = st.startLen[si]! + L[k]!;
            const u = rb > ra ? (len - ra) / (rb - ra) : 0;
            return { x: O + s * p.x, y: yb - p.y + dy, t: ta + (tb - ta) * clamp(u), first: k === 0 };
          }));
        });
        const t0 = times[0]![0], t1 = times[times.length - 1]![1];
        if (pj === 0) rowT0 = t0;
        rowT1 = t1;
        chars.forEach((_, c) => { if (g.left[c]! < Infinity) K.push([times[c]![0], O + s * g.left[c]!]); });
        K.push([t1, O + s * g.right[g.lastCh]!]);
        X = O + s * g.right[g.lastCh]!;
        let xMin = Infinity, xMax = -Infinity;
        for (const sk of strokes) for (const p of sk) { xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x); }
        inkMax = Math.max(inkMax, xMax, rackStart);
        const pidx = this.phrases.length;
        this.phrases.push({
          words: g.words, text, hero: g.hero, mirror: g.mirror, s, em: g.em, pen: Math.max(3, g.em * 0.046), st: g.st, times, strokes,
          t0, t1, row: r, vis1: 1e9, xMin, xMax, yb, capH, width: g.st.width, raiseAt,
        });
        rowOfPhrase.push(r);
        // --- the words of the phrase as units
        let c0 = 0;
        g.words.forEach((w, j) => {
          const n = Array.from(w.w).length, c1 = c0 + n;
          const sIdx: number[] = [];
          st.charOf.forEach((ci, si) => { if (ci >= c0 && ci < c1) sIdx.push(si); });
          if (sIdx.length) {
            const f = strokes[sIdx[0]!]![0]!, lsk = strokes[sIdx[sIdx.length - 1]!]!;
            this.units.push({
              p: pidx, first: f, last: lsk[lsk.length - 1]!, sIdx, t0: times[c0]![0], t1: times[c1 - 1]![1],
              tc0: 0, td1: 0, joinPrev: false, joinNext: false,
            });
          }
          c0 = c1 + 1;
        });
      });
      // --- the ticker: the rack follows the pen through the row
      for (let k = 1; k < K.length; k++) if (K[k]![0] <= K[k - 1]![0] + 1e-4) K[k]![0] = K[k - 1]![0] + 1e-4;
      let tick = K;
      if (r === 0) {
        // the paper is at rest until the pens drop, then it is fed, catching up with the pen
        const keep = K.filter((k) => k[0] > T_DROP + 0.07);
        tick = [[T0, K[0]![1]], [T_DROP, K[0]![1]], ...keep];
      }
      const tf = hermite(tick);
      // --- from the previous row: creep, whip, creep
      const vPrev = HOLD_V * sPrev, v2 = HOLD_V * s;
      if (r > 0) {
        const xw0 = xRackPrev + vPrev * (w0 - tEndPrev);
        const xw1 = rackStart - v2 * (rowT0 - w1);
        const xp = xRackPrev, tp = tEndPrev;
        this.segs.push({ t0: tp, t1: w0, f: (t) => xp + vPrev * (t - tp) });
        this.segs.push({ t0: w0, t1: w1, f: (t) => lerp(xw0, xw1, ease.inOutQuart(clamp((t - w0) / Math.max(1e-6, w1 - w0)))) });
        this.segs.push({ t0: w1, t1: rowT0, f: (t) => xw1 + v2 * (t - w1) });
        this.phrases.forEach((p) => { if (p.row === r - 1) p.vis1 = w1 + 0.05; });
      }
      this.segs.push({ t0: r === 0 ? T0 : rowT0, t1: rowT1, f: tf });
      xRackPrev = tick[tick.length - 1]![1];
      tEndPrev = rowT1;
      sPrev = s;
      prevT1 = rowT1;
      w1s[r] = w1;
    });
    const last = this.phrases[this.phrases.length - 1]!;
    const vL = HOLD_V * last.s;
    const xl = xRackPrev, tl = last.t1;
    this.segs.push({ t0: tl, t1: T1 + 1, f: (t) => xl + vL * (t - tl) });
    this.segs.sort((p, q) => p.t0 - q.t0);
    // --- climbs, drops and joins of the words
    const U = this.units;
    U.forEach((u, k) => {
      const prev = U[k - 1], next = U[k + 1];
      const pr = this.phrases[u.p]!.row;
      const sameRowPrev = !!prev && this.phrases[prev.p]!.row === pr, sameRowNext = !!next && this.phrases[next.p]!.row === pr;
      u.joinPrev = sameRowPrev && u.t0 - prev!.t1 < 0.07;
      u.joinNext = sameRowNext && next!.t0 - u.t1 < 0.07;
      const gapPrev = sameRowPrev ? u.t0 - prev!.t1 : u.t0 - w1s[pr]!;
      const gapNext = sameRowNext ? next!.t0 - u.t1 : 1;
      u.tc0 = u.joinPrev ? u.t0 : (k === 0 ? u.t0 : u.t0 - Math.min(0.075, gapPrev * (sameRowPrev ? 0.45 : 0.95)));
      u.td1 = u.joinNext ? next!.t0 : u.t1 + Math.min(0.07, gapNext * 0.45);
    });
  }

  // ------------------------------------------------------------------------------------------ the rack
  rack(t: number): number {
    const S = this.segs;
    if (t <= S[0]!.t0) return S[0]!.f(S[0]!.t0);
    let lo = 0, hi = S.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (S[mid]!.t0 <= t) lo = mid; else hi = mid - 1; }
    const sg = S[lo]!;
    return sg.f(Math.min(t, sg.t1));
  }
  /** Rack speed (world units / s). */
  rackV(t: number): number { const h = 1 / 960; return (this.rack(t + h) - this.rack(t - h)) / (2 * h); }

  /** Is the cardio pen in the lyric (climb, letters, drop, or the line between two joined words) at t? */
  cardioWriting(t: number): boolean {
    for (const u of this.units) if (t >= (u.joinPrev ? u.t0 : u.tc0) && t <= u.td1) return true;
    return false;
  }
  /** Pen i (0..2) is down on the paper at t. The cardio pen (3) is down until it tears through. */
  penDown(i: number, t: number): boolean {
    if (i < 3 && t < T_DROP) return false;
    if (i === 3 && t >= T_TEAR) return false;
    return true;
  }
  /** Pen lift (z) of pen i at t: the drop on the synth. */
  penZ(i: number, t: number): number {
    let z = 0;
    if (i < 3 && t < T_DROP) z = PEN_UP * (1 - ease.inCubic(clamp((t - (T_DROP - 0.16)) / 0.16)));
    return z;
  }

  // ------------------------------------------------------------------------------------------ signals
  /** Heart rate (bpm) and breathing rate (breaths/min). */
  hr(t: number): number {
    const k = (a: number, b: number, v0: number, v1: number) => lerp(v0, v1, ease.inOutCubic(clamp((t - a) / (b - a))));
    let h = 70;
    h = k(T_LIE - 0.05, T_LIE + 0.2, h, 98);
    h = k(T_BUT, T_BUT + 0.5, h, 128);
    h = k(41.9, 42.8, h, 108);
    h = k(45.27, 46.9, h, 150);
    h = k(46.9, 48.2, h, 190);
    h = k(48.2, 48.6, h, 230);
    return h;
  }
  br(t: number): number {
    const k = (a: number, b: number, v0: number, v1: number) => lerp(v0, v1, ease.inOutCubic(clamp((t - a) / (b - a))));
    let h = 15;
    h = k(T_LIE, T_LIE + 0.6, h, 24);
    h = k(T_BUT, T_BUT + 0.5, h, 36);
    h = k(42.0, 43.0, h, 26);
    h = k(45.3, 47.0, h, 40);
    h = k(47.0, 48.3, h, 60);
    return h;
  }
  private tabAt(tab: Float64Array, t: number) {
    const x = (t - this.tab0) * 480, i = clamp(Math.floor(x), 0, tab.length - 2);
    return lerp(tab[i]!, tab[i + 1]!, clamp(x - i, 0, 1));
  }
  cardioPhase(t: number) { return this.tabAt(this.cardioTab, t); }
  /** Tremor envelope 0..1: the butterflies, the settling, the race. */
  tremor(t: number): number {
    const up = ease.outQuad(clamp((t - T_BUT) / 0.05));
    const down = 1 - ease.inOutCubic(clamp((t - 41.35) / 0.7));
    let e = up * (t < 41.0 ? 1 : lerp(0.28, 1, down));
    e = Math.max(e, 0.1 * ease.outQuad(clamp((t - T_LIE) / 0.2)));
    // the nerves again, building into the race
    const race = ease.inQuad(clamp((t - 45.5) / 3.0));
    return clamp(Math.max(e * (t < 41.9 ? 1 : 0.55 + 0.45 * down), 0.12 * (t > 41.9 ? 1 : 0), 0.55 * race));
  }
  /** Amplitude of the signals' micro-tremor (world units). */
  private trem(i: number, t: number): number {
    const e = this.tremor(t);
    if (e <= 0) return 0;
    const f = (a: number, p: number) => Math.sin(6.2831853 * a * t + p);
    const ph = i * 1.7;
    return e * (0.5 * f(31.7, ph) + 0.33 * f(43.3, ph + 2) + 0.2 * f(58.1, ph + 4) + 0.12 * f(77.0, ph + 1)) * 17;
  }
  /** Pulse waveform of the cardio pen at phase ph (0..1): -> 0..1. */
  private pulse(ph: number): number {
    const f = ph - Math.floor(ph);
    const g = (c: number, w: number) => Math.exp(-((f - c) / w) * ((f - c) / w));
    return 0.95 * g(0.17, 0.03) + 0.32 * g(0.38, 0.055) - 0.2 * g(0.29, 0.03) + 0.09 * g(0.06, 0.03);
  }
  /** y of the cardio line (before the jump, `jump` raises it). */
  cardioY(t: number): number {
    const jump = this.jumpAt(t);
    const race = ease.inQuad(clamp((t - 45.5) / 3.0));
    const amp = 46 * (1 + 0.7 * race) * (t > T_LIE ? 1.15 : 1);
    const ph = this.cardioPhase(t);
    const jag = t > T_LIE ? this.jag(t) * (9 + 22 * race) : 0;
    return CH[3] + jump + amp * (this.pulse(ph) - 0.12) + this.trem(3, t) + jag;
  }
  /** The jump: a channel up in 40 ms with an overshoot, after "lie". */
  jumpAt(t: number): number {
    if (t < T_LIE) return 0;
    const u = (t - T_LIE) / 0.05;
    return JUMP * (ease.outQuad(clamp(u)) + 0.28 * Math.sin(clamp(u, 0, 1.6) * Math.PI) * (u < 1.6 ? 1 : 0));
  }
  /** Jagged noise (a hand that will not settle): value noise at ~38 Hz. */
  jag(t: number): number {
    const x = t * 38, i = Math.floor(x), f = x - i;
    const h = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
    return lerp(h(i), h(i + 1), f * f * (3 - 2 * f));
  }
  /** The other three pens' y at t (world). 0 skin conductance, 1 thoracic, 2 abdominal. */
  penY(i: number, t: number): number {
    const bp = this.tabAt(this.breathTab, t), race = ease.inQuad(clamp((t - 45.5) / 3.0));
    const tr = this.trem(i, t);
    if (i === 1) {
      const a = 58 * (1 - 0.35 * race);
      return CH[1] + a * (Math.sin(6.2831853 * bp) + 0.28 * Math.sin(2 * 6.2831853 * bp + 0.7)) + tr + (t > T_LIE ? this.jag(t + 3.1) * 4 * (1 + 3 * race) : 0);
    }
    if (i === 2) {
      const a = 50 * (1 - 0.3 * race);
      return CH[2] + a * (Math.sin(6.2831853 * bp - 0.8) + 0.2 * Math.sin(2 * 6.2831853 * bp + 1.9)) + tr + (t > T_LIE ? this.jag(t + 7.7) * 3 * (1 + 3 * race) : 0);
    }
    // skin conductance: a slow drift with sudden rises at the stimuli
    const ev = (te: number, a: number) => (t < te ? 0 : a * (1 - Math.exp(-(t - te) / 0.18)) * Math.exp(-(t - te) / 2.2));
    const rise = ev(T_LIE, 40) + ev(T_BUT, 55) + ev(42.0, 24) + ev(43.9, 30) + ev(45.4, 30) + ev(46.6, 40) + ev(47.5, 50);
    return CH[0] - 6 + 16 * Math.sin(t * 0.9) + 9 * Math.sin(t * 2.3 + 1) + rise + tr;
  }
  /** The paper's shiver (butterflies): 0..1. */
  shiver(t: number): number {
    const up = ease.outQuad(clamp((t - T_BUT) / 0.06));
    const down = 1 - ease.inOutCubic(clamp((t - 41.3) / 0.55));
    return up * down;
  }

  // ------------------------------------------------------------------------------------------ camera
  /** The setups, each eased into a downbeat. cy is written for the paper before the lie; the lie lifts every later one with the pen. */
  private buildCam() {
    const M = (te: number, d: number, p: CamState) => this.moves.push({ te, d, p });
    const cut = this.landings[3]!;
    // 1 wide on the four channels, the pen arms in; pushes in to the pens' drop on 34.91
    M(34.912, 0.27, { w: 2250, cy: 0, roll: -0.012, tilt: 0.02, rs: 640, phi: 0 });
    // 2 APOLOGIZE: a little closer and higher on the downbeat 36.64
    M(36.64, 0.6, { w: 2150, cy: -90, roll: 0.02, tilt: -0.02, rs: 750, phi: 0 });
    // 3 macro on the cardio nib, whipped in with the paper on 38.37
    M(38.37, 0.1, { w: 1200, cy: -190, roll: 0.02, tilt: 0.03, rs: 480, phi: 0 });
    // 4 low raking angle along the paper for the lie and the butterflies, eased into 40.09
    M(40.09, 0.22, { w: 2100, cy: -100, roll: 0.03, tilt: 0.1, rs: 700, phi: 0.6 });
    // 5 wide again on four channels, eased into 41.82
    M(41.82, 0.22, { w: 2400, cy: -120, roll: -0.016, tilt: -0.03, rs: 650, phi: 0 });
    // 6 the swing under the paper, landing on 43.55
    M(SW1, SW1 - SW0, { w: 2250, cy: -130, roll: 0.02, tilt: 0, rs: 740, phi: Math.PI });
    // 7 the cut back over the paper on 45.27: macro on the nib again
    M(cut, 0.0001, { w: 1200, cy: -150, roll: -0.02, tilt: 0.04, rs: 480, phi: 0 });
    // 8 ALIVE: pulled back and up on 47.00
    M(47.0, 0.3, { w: 2100, cy: -120, roll: -0.03, tilt: 0, rs: 750, phi: 0 });
    // 9 the tear: a slow push as the pen goes through
    M(T1, 0.5, { w: 1800, cy: -40, roll: -0.05, tilt: 0, rs: 690, phi: 0 });
  }
  /** Camera state at t. */
  cam(t: number): CamState {
    let prev = this.cam0;
    let out = prev;
    for (const m of this.moves) {
      const a = m.te - m.d;
      if (t < a) { out = prev; break; }
      if (t < m.te) {
        const e = ease.inOutCubic(clamp((t - a) / m.d));
        out = {
          w: lerp(prev.w, m.p.w, e), cy: lerp(prev.cy, m.p.cy, e), roll: lerp(prev.roll, m.p.roll, e),
          tilt: lerp(prev.tilt, m.p.tilt, e), rs: lerp(prev.rs, m.p.rs, e), phi: lerp(prev.phi, m.p.phi, e),
        };
        break;
      }
      prev = m.p; out = prev;
    }
    return { ...out, cy: out.cy + JUMP * ease.outCubic(clamp((t - T_LIE) / 0.12)) };
  }
  camW(t: number): number { return this.cam(t).w; }
  /** Is the camera under the paper at t? */
  under(t: number): boolean { return this.cam(t).phi > Math.PI / 2; }

  // ------------------------------------------------------------------------------------------ the tear
  private buildTear() {
    const r = mulberry32(48);
    const x0 = this.rack(T_TEAR) + 40;
    const N = 15;
    let x = x0 + 20;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const y = lerp(CH[3] + JUMP - 140, 760, u);
      x += (r() - 0.5) * 56 - 3;
      this.tear.push({ x, y, t: T_TEAR + 0.03 + 0.27 * Math.pow(u, 0.85), r: r() });
    }
  }
}

// ---------------------------------------------------------------------------------------------- hand
/** The writing hand's shake (world units): the nerves, and after the lie a hand that will not settle. */
export function handShake(S: Script, t: number): [number, number] {
  const e = S.tremor(t);
  const a = e * 3.4 + (t > T_LIE ? 0.5 : 0);
  return [a * (0.6 * Math.sin(t * 417.0 + 1.0) + 0.4 * Math.sin(t * 733.0 + 2.0)), a * (0.6 * Math.sin(t * 389.0 + 4.0) + 0.4 * Math.sin(t * 641.0 + 0.5))];
}
