// Plate 8 `voice`: the lyric on the monitor, rebuilt on the kinetic kit (kinetic.ts, docs/TEETH2.md "Kinetic type").
// Pre-chorus, rising energy. Two canvases are laid on the monitor's screen as textures (channels as ink: r = bright
// lightbox, b = dim halide, composited with 'lighter'):
//  * the lane (the transcript under the waveform): each word is a KinWord that springs up in the light weight and
//    unsung tone 0.1 s ahead, snaps heavy and lit on its onset, tracks and stretches on the beat, leans a little more
//    each beat as the energy rises, and collapses onto the baseline when its chunk leaves;
//  * the panel (the waveform's own area): the hero words MORNING, LIE and THROUGH (spring, stamp, stretch on the kicks,
//    the letters' heights lifted by the sung sound; LIE is broken along the razor's 45 degree diagonal and its halves
//    slide with the monitor's) and, from bar 5, the pressure: one more copy of the chunk being sung on every kick,
//    condensing and packing the panel until ALIVE slams full-frame (voice.ts).
import * as THREE from 'three';
import { F, font, measure } from '../../engine/type';
import { clamp, ease, lerp } from '../../engine/util';
import type { Lyrics, Line } from '../../engine/lyrics';
import { KinClock, KinWord, archivoAt, drawKin, halfPlane, pressureRows, type KinBreak } from '../kinetic';
import { VD, WAVE_B64 } from './voice-data';
import { T0, T1, XP, YC, SPD, TCUT, splice } from './voice-script';

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const waveBytes = b64(WAVE_B64);
/** The vocal envelope (0..1) at song time t, from the baked analysis. */
export const envAt = (t: number) => {
  const i = clamp(Math.round((t - VD.t0) / VD.waveDt - 0.5), 0, VD.nWave - 1);
  return waveBytes[i * 4 + 2]! / 255;
};

const LEAD = 0.045, PRE = 0.1;
const INK_B = 'rgb(255,0,0)';   // bright (r)
const leaveBeat = (beats: number[], end: number) => beats.find((b) => b >= end + 0.01) ?? end + 0.3;

// ------------------------------------------------------------------ the panel (heroes and pressure)
/** The kinetic layer's patch on the monitor's screen (mm): the waveform panel. */
export const KIN = { x0: -148, x1: 148, y0: 59, y1: 150, ppm: 6 };
export function newKinCanvas() {
  const cv = document.createElement('canvas');
  cv.width = Math.round((KIN.x1 - KIN.x0) * KIN.ppm); cv.height = Math.round((KIN.y1 - KIN.y0) * KIN.ppm);
  return cv;
}
/** Set the panel's drawing space: units are screen mm, x right, y DOWN with y = -(screen y up). */
function kinSpace(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(KIN.ppm, 0, 0, KIN.ppm, -KIN.x0 * KIN.ppm, KIN.y1 * KIN.ppm);
  c.globalCompositeOperation = 'lighter'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  return c;
}

export interface Hero {
  text: string; kw: KinWord; start: number; end: number; exitAt: number; exitKind: 'collapse' | 'drop' | 'slide' | 'wipe';
  x: number; base: number; tall: number; env: number[]; lie: boolean; lean: boolean; stampAt: number;
}
// [line of the window, word index, word width (mm), tall factor, exit kind]
const PICK: [number, number, number, number, Hero['exitKind']][] = [[0, 4, 190, 1.3, 'collapse'], [1, 2, 112, 1.3, 'drop'], [2, 6, 190, 1.3, 'slide']];

export function buildHeroes(ly: Lyrics, clk: KinClock): Hero[] {
  const lines = ly.lines.filter((l: Line) => l.start >= T0 - 0.05 && l.start < T1);
  return PICK.map(([li, idx, Wm, tall, exitKind]) => {
    const l = lines[li]!, w = l.words[idx]!;
    const text = w.w.replace(/[,.!?]/g, '').toUpperCase();
    const probe = new KinWord(text, { size: 100, width: 62, weight: 900 });
    const size = (Wm * 100) / probe.width;
    const kw = new KinWord(text, { size, width: 62, weight: 900 });
    const lie = li === 1;
    const cap = 0.686 * size * tall;
    // THROUGH stays up through "my" and leaves on the next beat; the others leave on the beat after their line ends
    const exitAt = li === 2 ? clk.leave(l.words[idx + 1]!.end) : clk.leave(l.end);
    const g0 = kw.glyphs[0]!;
    // LIE: the razor's diagonal passes through the playhead, between the L and the I
    const x = lie ? XP - (g0.cx + g0.adv / 2) : -kw.width / 2;
    const env: number[] = [];
    const dur = w.end - w.start;
    for (let k = 0; k < text.length; k++) {
      const ta = w.start + (k / text.length) * dur, tb = w.start + ((k + 1) / text.length) * dur;
      env.push((envAt(ta) + envAt((ta + tb) / 2) + envAt(tb)) / 3);
    }
    return { text, kw, start: w.start, end: w.end, exitAt, exitKind, x, base: cap / 2 - YC, tall, env, lie, lean: li === 2, stampAt: lie ? TCUT : w.start };
  });
}

/** Draws the hero word on screen at t into the panel; returns its stamp pulse (for a frame shake), or -1 if none is up. */
function drawHero(c: CanvasRenderingContext2D, h: Hero, t: number, clk: KinClock): number {
  if (t < h.start - LEAD || t >= h.exitAt + 0.3) return -1;
  const P = h.kw.pose(t, clk, {
    t0: h.start, lead: LEAD,
    spring: { stagger: 0.022, freq: 5.5, damp: 0.42, rise: 0.5 },
    stamp: { at: h.stampAt, over: h.lie ? 1.15 : 1.25 },
    stretch: { kick: 0.1, snare: 0.08 },
    weight: { from: 300, dur: 0.05 },
    track: { amt: 0.02 },
    lean: h.lean ? { perBeat: 0.03, max: 0.16 } : undefined,
    exit: { at: h.exitAt, kind: h.exitKind, dur: 0.16, dir: -1 },
  });
  // the sung sound lifts each letter's top (never under 0.85 of the cap height)
  P.glyphs.forEach((g, i) => {
    const tk = h.start - LEAD + (i / h.kw.glyphs.length) * (h.end - h.start);
    const e = ease.outBack(clamp((t - tk) / 0.16), 2.4);
    const target = 0.9 + 0.2 * clamp(h.env[i]! * 1.15);
    g.sy *= h.tall * Math.max(0.85, 0.95 + (target - 0.95) * (t >= tk ? e : 0));
  });
  let brk: KinBreak | undefined;
  if (h.lie && t >= TCUT) {
    // the razor's 45 degree slash through the playhead: its halves slide with the monitor's (spliceW) and part by the gap
    const sp = splice(t);
    brk = { mask: halfPlane(XP, -YC, Math.PI / 4), k: 1, a: { dx: sp.oL * SPD - sp.gh }, b: { dx: sp.oR * SPD + sp.gh }, pivot: [XP, -YC] };
  }
  drawKin(c, h.kw, P, h.x, h.base, { fill: INK_B, brk });
  return P.shake;
}

// ------------------------------------------------------------------ pressure
export const P_T0 = 97.069, P_MAX = 7;
const PBOX = { x0: -146, y0: -148, x1: 146, y1: -62 };
/** The chunk being sung (lane chunk, lines 3 and 4) and the words of it sung by t: the pressure's copies. */
function pressText(chunks: Chunk[], t: number): { i: number; text: string } | null {
  const i = chunks.findIndex((k) => k.line >= 2 && t >= k.t0 && t < k.t1);
  if (i < 0) return null;
  const ws = chunks[i]!.words.filter((w) => t >= w.start - LEAD);
  if (ws.length) return { i, text: ws.map((w) => w.text.toUpperCase()).join(' ') };
  // the chunk has just begun and none of its words is up yet: the last chunk's copies stand until the first word springs
  const pv = chunks[i - 1];
  return pv && pv.line >= 2 ? { i: i - 1, text: pv.words.map((w) => w.text.toUpperCase()).join(' ') } : null;
}
function drawRows(c: CanvasRenderingContext2D, text: string, t: number, clk: KinClock, sy: number, k: number) {
  const rows = pressureRows(text, t, P_T0, clk, PBOX, P_MAX);
  for (const r of rows) {
    c.save();
    c.font = font(archivoAt(r.width, r.weight), r.size);
    const adv = c.measureText(text).width;
    const sx = Math.min(r.sx, 2.4);
    c.globalAlpha *= r.on;
    // flat dim tone (b) and, as the pressure rises, a lift of bright (r); the tones alternate
    c.fillStyle = `rgb(${Math.round((r.tone ? 70 : 150) * k)},0,${r.tone ? 175 : 255})`;
    c.translate(-(adv * sx) / 2, r.y);
    c.scale(sx, sy);
    c.fillText(text, 0, 0);
    c.restore();
  }
}
function drawPressure(c: CanvasRenderingContext2D, chunks: Chunk[], t: number, clk: KinClock) {
  if (t < P_T0) return;
  const cur = pressText(chunks, t);
  if (!cur) return;
  const n = Math.min(P_MAX, 1 + clk.kicks(P_T0, t));
  const k = n > 1 ? (n - 1) / (P_MAX - 1) : 0;
  const ch = chunks[cur.i]!;
  // a new chunk: the old copies collapse onto their baselines, then the new ones rise (never a pop)
  const prev = chunks[cur.i - 1];
  const u = clamp((t - (ch.words[0]!.start - LEAD)) / 0.16);
  if (prev && prev.line >= 2 && u < 1 && u > 0) {
    drawRows(c, prev.words.map((w) => w.text.toUpperCase()).join(' '), t, clk, Math.max(0.001, 1 - ease.outCubic(clamp(u * 2))), k);
    drawRows(c, cur.text, t, clk, Math.max(0.001, ease.outCubic(clamp(u * 2 - 1))), k);
  } else drawRows(c, cur.text, t, clk, 1, k);
}

/** Draw the panel's layer at t. Returns the heroes' stamp pulse (0..1) for a frame shake. */
export function drawPanel(cv: HTMLCanvasElement, heroes: Hero[], chunks: Chunk[], t: number, clk: KinClock): { on: boolean; shake: number } {
  const c = kinSpace(cv);
  let shake = 0, on = false;
  drawPressure(c, chunks, t, clk);
  for (const h of heroes) {
    const s = drawHero(c, h, t, clk);
    if (s >= 0) { on = true; shake = Math.max(shake, s); }
  }
  return { on: on || t >= P_T0, shake };
}

// ------------------------------------------------------------------ the transcript lane
// The supporting words ride in a lane on the monitor under the waveform: each word at its own time position (its
// start under the playhead), scrolling with the waveform; it lights as the playhead reaches it.
export const LANE = { x0: -146, x1: 146, y0: 38, y1: 57, ppm: 7 };
interface CW { text: string; start: number; end: number; cx: number; w: number; kw: KinWord }
export interface Chunk { t0: number; t1: number; words: CW[]; line: number }
const SPEC: number[][][] = [[[0, 1, 2, 3], [5, 6]], [[0, 1], [3, 4, 5]], [[0, 1, 2, 3], [4, 5], [7, 8]], [[0, 1, 2, 3], [4, 5, 6, 7]]];
const EM = 11.5, LEXIT = 0.16;

export function buildChunks(ly: Lyrics, beats: number[]): Chunk[] {
  const lines = ly.lines.filter((l: Line) => l.start >= T0 - 0.05 && l.start < T1);
  const out: Chunk[] = [];
  lines.forEach((l, li) => {
    SPEC[li]!.forEach((ids) => {
      const ws = ids.map((i) => l.words[i]!);
      const words: CW[] = ws.map((w) => {
        const text = w.w.replace(/[,.!?]/g, '');
        const kw = new KinWord(text, { size: EM * LANE.ppm, width: 100, weight: 500 });
        return { text, start: w.start, end: w.end, cx: w.start * SPD, w: kw.width / LANE.ppm, kw };
      });
      for (let i = 1; i < words.length; i++) words[i]!.cx = Math.max(words[i]!.cx, words[i - 1]!.cx + words[i - 1]!.w + 2.0);
      out.push({ t0: Math.max(T0, ws[0]!.start - PRE), t1: 0, words, line: li });
    });
  });
  out.forEach((c, i) => {
    const nx = out[i + 1];
    if (nx && nx.line === c.line) c.t1 = nx.t0;
    else { const b = leaveBeat(beats, lines[c.line]!.end); c.t1 = Math.min(b, nx ? nx.t0 : 1e9); }
  });
  return out;
}
export function newLaneCanvas() {
  const cv = document.createElement('canvas');
  cv.width = Math.round((LANE.x1 - LANE.x0) * LANE.ppm); cv.height = Math.round((LANE.y1 - LANE.y0) * LANE.ppm);
  return cv;
}
/** t: song time (which words are up); tau: the audio time under the playhead (where they sit, and whether the playhead has passed). */
export function drawLane(cv: HTMLCanvasElement, chunks: Chunk[], clk: KinClock, t: number, tau: number, left = LANE.x0 + 1.5) {
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  const P = LANE.ppm, base = cv.height * 0.5 + EM * 0.2 * P;
  c.globalCompositeOperation = 'lighter'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  // the chunk that is leaving (collapsing) first, the one being sung on top
  const live = chunks.filter((k) => t >= k.t0 && t < k.t1 + LEXIT).sort((a, b) => a.t0 - b.t0);
  for (const ch of live) {
    // a word that reaches the lane's left edge stops there and the next ones stack against it until the line leaves
    let minX = Math.max(LANE.x0 + 1.5, left);
    const leaving = t >= ch.t1;
    for (const w of ch.words) {
      if (t < w.start - PRE) continue;
      const xmm = Math.max(XP + w.cx - tau * SPD, minX);
      minX = xmm + w.w + 2.0;
      const sung = tau >= w.start - LEAD;
      const x0 = (xmm - LANE.x0) * P;
      const pose = w.kw.pose(t, clk, {
        t0: w.start, lead: PRE,
        spring: { stagger: 0.018, rise: 0.45 },
        weight: { from: 300, to: 700, dur: 0.06 },
        stretch: { kick: 0.07, snare: 0.06 },
        track: { amt: 0.03 },
        lean: { perBeat: 0.012, max: 0.08, fan: 0, from: ch.t0 },
        exit: { at: ch.t1, kind: 'collapse', dur: LEXIT },
        anchor: 'left',
      });
      drawKin(c, w.kw, pose, x0, base, { fill: sung ? 'rgb(255,0,0)' : 'rgb(0,0,255)' });
      // the word's start mark on the lane's floor
      if (!leaving) {
        c.fillStyle = sung ? 'rgb(255,0,0)' : 'rgb(0,0,255)';
        c.fillRect(x0 - 0.5 * P * 0.5, cv.height - 2.6 * P, 0.5 * P, 2.2 * P);
      }
    }
  }
  c.globalCompositeOperation = 'source-over';
}

/** The bezel's label (the voicemail is exhibit 7): the one readable label on the plate besides the lyric. */
export function buildLabel(): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 80;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, 640, 80);
  c.fillStyle = 'rgb(255,0,0)'; c.font = font(F.mono(500), 40); c.textBaseline = 'middle'; c.textAlign = 'center';
  c.fillText('08-32 · EXHIBIT 7', 320, 42);
  return cv;
}
export const dataTex = (cv: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8;
  return t;
};
void lerp; void measure;
