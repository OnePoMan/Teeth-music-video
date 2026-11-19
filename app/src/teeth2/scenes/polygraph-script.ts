// Plate 4 `polygraph` (34.64 - 48.73): the script. Everything the plate does is a pure function of song time, and
// this file holds the functions: the phrases and their pen timing (from data/teeth/lyrics.json), the paper's feed
// (the "rack": where the pens stand on the paper, a ticker that follows the cardio pen as it writes, whipped
// forward between phrases), the four signals, the events (the lie, the butterflies, the swing under the paper, the
// race, the tear) and the camera.
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
/** The camera goes under the paper (42.65 - 43.545), and comes back over it (44.85 - 45.271). */
export const SW0 = 42.65, SW1 = 43.545, SB0 = 44.85, SB1 = 45.271;
/** The pen lunges and the paper tears (the slit is whole by T1). */
export const T_TEAR = 48.3;

/** Channel centres (y): skin conductance, pneumo (thoracic), pneumo (abdominal), cardio. */
export const CH = [330, 150, -30, -210] as const;
/** Pens' x offsets from the rack (screen right of the writing head). */
export const PEN_OX = [215, 175, 135, 0] as const;
/** What the cardio pen's jump adds (one channel). */
export const JUMP = 180;
/** Text baseline below the cardio line. */
export const BASE_OFF = -30;
export const PEN_UP = 70;
/** Whip: how far the paper is fed to flush a phrase, and the visible half-widths either side of the rack (screen px). */
const FLUSH = 1640;

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
  /** First / last letter time (the pen touches down / leaves the last letter). */
  t0: number; t1: number;
  /** Climb / descent of the cardio line. */
  tc0: number; td1: number;
  /** The whip before this phrase: [w0, w1], and the cardio pen is down on the paper from w1. */
  w0: number; w1: number;
  /** Rack x at the phrase's first letter and last letter. */
  rack0: number; rack1: number;
  /** World extent of the text. */
  xMin: number; xMax: number; yb: number; capH: number;
  /** Text width in px at the phrase's em. */
  width: number;
  /** Camera framing for the phrase. */
  fr: Framing;
  /** The char index from which the baseline is raised (the lie). */
  raiseAt: number;
}
export interface Framing { w: number; cy: number; roll: number; tilt: number; rs: number }

/** Piecewise rack path. */
interface Seg { t0: number; t1: number; f: (t: number) => number }

const PH_DEFS: { line: number; words: number[]; hero?: boolean; mirror?: boolean }[] = [
  { line: 0, words: [0, 1, 2] }, // CALL ME IN
  { line: 0, words: [3, 4, 5] }, // THE MORNING TO
  { line: 0, words: [6], hero: true }, // APOLOGIZE
  { line: 1, words: [0, 1] }, // EVERY LITTLE
  { line: 1, words: [2, 3, 4] }, // LIE GIVES ME
  { line: 1, words: [5], hero: true }, // BUTTERFLIES
  { line: 2, words: [0, 1] }, // SOMETHING IN
  { line: 2, words: [2, 3] }, // THE WAY
  { line: 2, words: [4, 5], mirror: true }, // YOU'RE LOOKING
  { line: 2, words: [6, 7], mirror: true }, // THROUGH MY
  { line: 2, words: [8], hero: true, mirror: true }, // EYES
  { line: 3, words: [0, 1, 2] }, // DON'T KNOW IF
  { line: 3, words: [3, 4, 5] }, // I'M GONNA MAKE
  { line: 3, words: [6, 7] }, // IT OUT
  { line: 3, words: [8], hero: true }, // ALIVE
];
const LINE_T = [34.638, 38.422, 41.745, 45.272];
/** Per-phrase framing: view width (world units across the frame), camera y, roll, pitch, the rack's screen x (px from the centre). */
const FR: Framing[] = [
  { w: 1920, cy: -70, roll: -0.018, tilt: 0.05, rs: 600 },
  { w: 1840, cy: -80, roll: 0.026, tilt: -0.02, rs: 580 },
  { w: 1960, cy: -60, roll: -0.03, tilt: -0.055, rs: 650 },
  { w: 1880, cy: -70, roll: 0.018, tilt: 0.06, rs: 630 },
  { w: 1800, cy: -60, roll: -0.022, tilt: 0.0, rs: 560 },
  { w: 1980, cy: 60, roll: 0.03, tilt: 0.04, rs: 650 },
  { w: 1900, cy: 40, roll: -0.016, tilt: -0.05, rs: 600 },
  { w: 1840, cy: 50, roll: 0.024, tilt: 0.045, rs: 580 },
  { w: 1860, cy: 50, roll: 0.014, tilt: 0.0, rs: 560 },
  { w: 1920, cy: 40, roll: -0.02, tilt: 0.04, rs: 600 },
  { w: 2000, cy: 60, roll: 0.026, tilt: 0.0, rs: 650 },
  { w: 1880, cy: 50, roll: -0.02, tilt: 0.05, rs: 610 },
  { w: 1820, cy: 40, roll: 0.03, tilt: -0.03, rs: 590 },
  { w: 1900, cy: 55, roll: -0.026, tilt: 0.055, rs: 620 },
  { w: 2020, cy: 70, roll: -0.035, tilt: 0.0, rs: 660 },
];

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

// ---------------------------------------------------------------------------------------------- the script
export class Script {
  phrases: PhraseS[] = [];
  private segs: Seg[] = [];
  /** Cardio phase and pneumo phases (tables, 480 Hz). */
  private tab0 = T0 - 0.1;
  private cardioTab: Float64Array;
  private breathTab: Float64Array;
  /** Tear path (world), the slit ragged line: x, y, time the tip passed. */
  tear: { x: number; y: number; t: number; r: number }[] = [];
  /** Where the camera starts to look at the rack (for the first frames). */
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
  }

  // ------------------------------------------------------------------------------------------ build
  private build(ly: Lyrics, beats: number[]) {
    const lines: Line[] = LINE_T.map((t) => ly.lines.find((l) => Math.abs(l.start - t) < 0.3)!);
    const defs = PH_DEFS.map((d, i) => ({ d, words: d.words.map((k) => lines[d.line]!.words[k]!), i }));
    // --- word write windows, phrase by phrase
    const win: { a: number; b: number }[][] = [];
    defs.forEach(({ words }) => {
      const W: { a: number; b: number }[] = [];
      let prevB = T0;
      words.forEach((w) => {
        const a = Math.max(w.start - 0.045, prevB, T0);
        const b = Math.max(a + 0.06, a + 0.92 * (w.end - a));
        W.push({ a, b }); prevB = b;
      });
      win.push(W);
    });
    // --- whips: the last word is finished early enough for the paper to be fed before the next phrase's first letter
    const whips: { w0: number; w1: number }[] = [{ w0: T0, w1: T0 }];
    for (let k = 0; k + 1 < defs.length; k++) {
      const W = win[k]!, aNext = win[k + 1]![0]!.a;
      let gap = aNext - W[W.length - 1]!.b;
      if (gap < 0.06) {
        // compress the phrase's windows toward its first letter so that a 0.04 s whip fits
        const limit = aNext - 0.05, a0 = W[0]!.a, b1 = W[W.length - 1]!.b;
        const sc = (limit - a0) / (b1 - a0);
        for (const w of W) { w.a = a0 + (w.a - a0) * sc; w.b = a0 + (w.b - a0) * sc; }
        gap = aNext - W[W.length - 1]!.b;
      }
      let tl = aNext;
      const wb = W[W.length - 1]!.b;
      if (gap >= 0.25) {
        // land on the last beat that leaves the phrase 0.12 s to be seen
        const cand = beats.filter((b) => b >= wb + 0.12 && b <= aNext + 0.03);
        if (cand.length) tl = cand[cand.length - 1]!;
      }
      const wd = clamp(Math.min(0.14, tl - wb - 0.01), 0.04, 0.14);
      whips.push({ w0: tl - wd, w1: tl });
    }
    // --- layout of each phrase, its strokes, rack path
    let xRack = 0; // rack x at the end of the previous phrase
    let tEnd = T0;
    let inkMax = -1e9;
    let prevS: 1 | -1 = 1;
    defs.forEach(({ d, words, i }) => {
      const mirror = !!d.mirror, s: 1 | -1 = mirror ? -1 : 1, hero = !!d.hero;
      const text = words.map((w) => w.w.toUpperCase()).join(' ');
      // size: fit the width; supporting words smaller than the hero
      const st100 = strokeText(text, 'sans', 100, 4);
      let top = 0;
      for (const sk of st100.strokes) for (const p of sk) top = Math.min(top, p.y);
      const cap100 = -top;
      const raiseAt = i === 4 ? 3 : -1;
      const wMax = hero ? 1400 : 1360;
      const capMax = hero ? 300 : 112;
      const em = Math.min((wMax / st100.width) * 100, (capMax / cap100) * 100, hero ? 420 : 170);
      const st = strokeText(text, 'sans', em, em * 0.04);
      const chars = Array.from(text);
      // char times
      const times: [number, number][] = [];
      words.forEach((w, j) => {
        const { a, b } = win[i]![j]!;
        const n = Array.from(w.w).length;
        for (let c = 0; c < n; c++) times.push([a + ((b - a) * c) / n, a + ((b - a) * (c + 1)) / n]);
        if (j < words.length - 1) times.push([b, b]);
      });
      // per char ink extents
      const left: number[] = chars.map(() => Infinity), right: number[] = chars.map(() => -Infinity);
      st.strokes.forEach((sk, si) => {
        const ci = st.charOf[si]!;
        for (const p of sk) { left[ci] = Math.min(left[ci]!, p.x); right[ci] = Math.max(right[ci]!, p.x); }
      });
      const t0 = times[0]![0], t1 = times[times.length - 1]![1];
      // --- the whip, and the rack at the phrase's first letter
      const wp = whips[i]!;
      const firstCh = left.findIndex((v) => v < Infinity);
      const lastCh = right.length - 1 - [...right].reverse().findIndex((v) => v > -Infinity);
      const wText = right[lastCh]! - left[firstCh]!;
      let rackStart: number;
      const vDrift = 300 * s;
      if (i === 0) {
        rackStart = 0;
      } else {
        // clear the paper: everything before this phrase must be off screen when its first letter lands
        const rsPx = FR[i]!.rs;
        const needFwd = inkMax + FLUSH;
        const natural = xRack + vDrift * (t0 - tEnd);
        if (s === 1) rackStart = prevS === 1 ? Math.max(natural + FLUSH, needFwd) : Math.max(natural, needFwd);
        else rackStart = prevS === 1 ? inkMax + wText + 520 + 600 : natural - FLUSH;
        void rsPx;
      }
      // world origin of the text row: the first letter's left sits at the rack
      const O = rackStart - s * left[firstCh]!;
      const capH = cap100 * (em / 100);
      const yb = CH[3] + BASE_OFF;
      // strokes in world coordinates with write times
      const strokes: PtT[][] = [];
      st.strokes.forEach((sk, si) => {
        const ci = st.charOf[si]!;
        const [ra, rb] = st.charRange[ci]!;
        const [ta, tb] = times[ci]!;
        const dy = raiseAt >= 0 && ci >= raiseAt ? JUMP : 0;
        const L = st.lens[si]!;
        const arr: PtT[] = sk.map((p, k) => {
          const len = st.startLen[si]! + L[k]!;
          const u = rb > ra ? (len - ra) / (rb - ra) : 0;
          return { x: O + s * p.x, y: yb - p.y + dy, t: ta + (tb - ta) * clamp(u), first: k === 0 };
        });
        strokes.push(arr);
      });
      // --- the rack through the phrase: a ticker through the letters' lefts (and the last letter's right)
      const K: [number, number][] = [];
      chars.forEach((_, c) => { if (left[c]! < Infinity) K.push([times[c]![0], O + s * left[c]!]); });
      K.push([t1, O + s * right[lastCh]!]);
      // dedupe times
      for (let k = 1; k < K.length; k++) if (K[k]![0] <= K[k - 1]![0] + 1e-4) K[k]![0] = K[k - 1]![0] + 1e-4;
      let tick = K;
      if (i === 0) {
        // the paper is at rest until the pens drop, then it is fed, catching up with the pen
        const keep = K.filter((k) => k[0] > T_DROP + 0.07);
        tick = [[T0, K[0]![1]], [T_DROP, K[0]![1]], ...keep];
      }
      const tf = hermite(tick);
      // --- transition from the previous phrase: drift - whip - drift
      if (i > 0) {
        const xDrift0 = xRack;
        const xw0 = xDrift0 + vDrift * (wp.w0 - tEnd);
        const xw1 = xw0 + (rackStart - (xDrift0 + vDrift * (t0 - tEnd)));
        const xEnd = rackStart; // at t0
        this.segs.push({ t0: tEnd, t1: wp.w0, f: (t) => xDrift0 + vDrift * (t - tEnd) });
        this.segs.push({ t0: wp.w0, t1: wp.w1, f: (t) => lerp(xw0, xw1 + vDrift * (wp.w1 - wp.w0), ease.inOutQuart(clamp((t - wp.w0) / (wp.w1 - wp.w0)))) + 0 });
        const xa = xw1 + vDrift * (wp.w1 - wp.w0);
        this.segs.push({ t0: wp.w1, t1: t0, f: (t) => xa + vDrift * (t - wp.w1) + 0 * xEnd });
        // (drift after the whip lands exactly on rackStart at t0 by construction)
        void xEnd;
      }
      this.segs.push({ t0: i === 0 ? T0 : t0, t1, f: tf });
      xRack = tick[tick.length - 1]![1];
      tEnd = t1;
      let xMin = Infinity, xMax = -Infinity;
      for (const sk of strokes) for (const p of sk) { xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x); }
      inkMax = Math.max(inkMax, xMax, xRack + 300);
      this.phrases.push({
        words, text, hero, mirror, s, em, pen: Math.max(3.2, em * 0.052), st, times, strokes, t0, t1,
        tc0: t0 - 0.075, td1: t1 + 0.07, w0: wp.w0, w1: wp.w1, rack0: rackStart, rack1: xRack,
        xMin, xMax, yb, capH, width: st.width, fr: FR[i]!, raiseAt,
      });
      prevS = s;
    });
    // after the last phrase: the feed drifts on
    const last = this.phrases[this.phrases.length - 1]!;
    const xl = last.rack1, tl = last.t1;
    this.segs.push({ t0: tl, t1: T1 + 1, f: (t) => xl + 300 * (t - tl) });
    // the first segment's start: the paper at rest before T0
    this.segs.sort((p, q) => p.t0 - q.t0);
    // the whip before the first phrase doesn't exist; keep the arrays aligned with the phrases
    this.phrases[0]!.w0 = T0; this.phrases[0]!.w1 = T0;
    this.logTimes();
  }

  private logTimes() {
    if (typeof console === 'undefined' || false) return;
    for (const p of this.phrases) console.warn(`PG ${p.text} t0=${p.t0.toFixed(3)} t1=${p.t1.toFixed(3)} whip=${p.w0.toFixed(3)}-${p.w1.toFixed(3)} em=${p.em.toFixed(0)} W=${p.width.toFixed(0)} rack=${p.rack0.toFixed(0)}..${p.rack1.toFixed(0)}`);
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

  /** The phrase being written (or last written) at t, and the one before. */
  phraseAt(t: number): number {
    let k = 0;
    for (let i = 0; i < this.phrases.length; i++) if (t >= this.phrases[i]!.w0 + (this.phrases[i]!.w1 - this.phrases[i]!.w0) * 0.5) k = i;
    return k;
  }

  /** Is the cardio pen in the lyric (climb, letters, descent) at t? */
  cardioWriting(t: number): PhraseS | null {
    for (const p of this.phrases) if (t >= p.tc0 && t <= p.td1) return p;
    return null;
  }
  /** Pen i (0..2) is down on the paper at t. The cardio pen (3) is down except over the whips. */
  penDown(i: number, t: number): boolean {
    if (i < 3 && t < T_DROP) return false;
    if (i === 3 && t >= T_TEAR) return false;
    return true;
  }
  /** Pen lift (z) of pen i at t: the drop on the synth, and the lifts over the whips. */
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
  /** The orbit about the vertical axis: 0 = over the paper, pi = under it. */
  phi(t: number): number {
    if (t < SW0) return 0;
    if (t < SW1) return Math.PI * ease.inOutCubic((t - SW0) / (SW1 - SW0));
    if (t < SB0) return Math.PI;
    if (t < SB1) return Math.PI * (1 + ease.inOutCubic((t - SB0) / (SB1 - SB0)));
    return 2 * Math.PI;
  }
  /** Framing at t: the phrase's own, cut over on the middle of its whip. */
  framing(t: number): Framing & { cyLie: number } {
    let k = 0;
    for (let i = 0; i < this.phrases.length; i++) { const p = this.phrases[i]!; if (t >= (p.w0 + p.w1) / 2) k = i; }
    const f = this.phrases[k]!.fr;
    // the frame snaps up with the cardio pen on "lie"
    const snap = ease.outCubic(clamp((t - T_LIE) / 0.12));
    // the downbeats that fall between whips kick the frame (a small push, eased out)
    return { ...f, cyLie: 0 * snap, cy: f.cy + (k >= 4 && k < 5 ? 130 * snap : 0) };
  }
  /** Downbeat/beat kick: 0..1 pulse after the last downbeat not covered by a whip. */
  kick(t: number, beats: number[]): number {
    let b = -1;
    for (const x of beats) if (x <= t) b = x; else break;
    return b < 0 ? 0 : Math.pow(0.5, (t - b) / 0.07);
  }

  // ------------------------------------------------------------------------------------------ the tear
  private buildTear() {
    const r = mulberry32(48);
    const last = this.phrases[this.phrases.length - 1]!;
    const x0 = this.rack(T_TEAR) + 40;
    const N = 15;
    let x = x0 + 20;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const y = lerp(CH[3] + JUMP - 140, 760, u);
      x += (r() - 0.5) * 110 - 8;
      this.tear.push({ x, y, t: T_TEAR + 0.03 + 0.27 * Math.pow(u, 0.85), r: r() });
    }
    void last;
  }
}

// ---------------------------------------------------------------------------------------------- hand
/** The writing hand's shake (world units): the nerves, and after the lie a hand that will not settle. */
export function handShake(S: Script, t: number): [number, number] {
  const e = S.tremor(t);
  const a = e * 3.4 + (t > T_LIE ? 0.5 : 0);
  return [a * (0.6 * Math.sin(t * 417.0 + 1.0) + 0.4 * Math.sin(t * 733.0 + 2.0)), a * (0.6 * Math.sin(t * 389.0 + 4.0) + 0.4 * Math.sin(t * 641.0 + 0.5))];
}
