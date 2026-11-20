// Plate 8 `voice`: the lyric on the monitor. The hero word of each line sits in the waveform panel: its letters are
// scaled in height by the sung sound (the vocal envelope at the moment each letter is sung), snapping from light to
// heavy on the word's onset with letter positions locked; the supporting words are the caption lane under the
// waveform (1-4 words, unsung halide 35%, sung lightbox).
import * as THREE from 'three';
import { F, font } from '../../engine/type';
import { clamp, ease } from '../../engine/util';
import type { Lyrics, Line } from '../../engine/lyrics';
import { VD, WAVE_B64 } from './voice-data';
import { T0, T1, XP, SPD } from './voice-script';

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const waveBytes = b64(WAVE_B64);
/** The vocal envelope (0..1) at song time t, from the baked analysis. */
export const envAt = (t: number) => {
  const i = clamp(Math.round((t - VD.t0) / VD.waveDt - 0.5), 0, VD.nWave - 1);
  return waveBytes[i * 4 + 2]! / 255;
};

const LEAD = 0.045, PRE = 0.1;
export interface Hero {
  text: string; start: number; end: number; t0: number; t1: number; row: number; n: number;
  lx: number[]; Wpx: number; Wm: number; Hn: number; env: number[]; line: number;
}
const PICK = [{ line: 0, idx: 4, Wm: 188 }, { line: 1, idx: 2, Wm: 104 }, { line: 2, idx: 6, Wm: 188 }, { line: 3, idx: 8, Wm: 158 }];
export const AW = 1536, AH = 1280, ROWH = 320, CAP = 240, PADX = 40;

const leaveBeat = (beats: number[], end: number) => beats.find((b) => b >= end + 0.01) ?? end + 0.3;

export function buildHeroes(ly: Lyrics, beats: number[]): { heroes: Hero[]; atlas: HTMLCanvasElement } {
  const lines = ly.lines.filter((l: Line) => l.start >= T0 - 0.05 && l.start < T1);
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, AW, AH);
  const heavy = F.archivo(62, 900), light = F.archivo(62, 300);
  c.font = font(heavy, 300);
  const em = (300 * CAP) / c.measureText('H').actualBoundingBoxAscent;
  const heroes: Hero[] = [];
  PICK.forEach((p, row) => {
    const l = lines[p.line]!, w = l.words[p.idx]!;
    const text = w.w.replace(/[,.!?]/g, '').toUpperCase();
    c.font = font(heavy, em);
    const adv = [...text].map((ch) => c.measureText(ch).width + 7);
    const Wpx = adv.reduce((a, b) => a + b, 0);
    const lx = [0]; adv.forEach((a) => lx.push(lx[lx.length - 1]! + a / Wpx));
    const base = row * ROWH + PADX + CAP;
    c.textBaseline = 'alphabetic'; c.textAlign = 'center';
    let x = PADX;
    const dur = w.end - w.start;
    const env: number[] = [];
    [...text].forEach((ch, k) => {
      const cx = x + adv[k]! / 2;
      c.globalCompositeOperation = 'lighter';
      c.font = font(heavy, em); c.fillStyle = 'rgb(255,0,0)'; c.fillText(ch, cx, base);
      c.font = font(light, em); c.fillStyle = 'rgb(0,255,0)'; c.fillText(ch, cx, base);
      x += adv[k]!;
      const ta = w.start + (k / text.length) * dur, tb = w.start + ((k + 1) / text.length) * dur;
      env.push((envAt(ta) + envAt((ta + tb) / 2) + envAt(tb)) / 3);
    });
    const line = l;
    const last = lines[p.line + 1];
    heroes.push({
      text, start: w.start, end: w.end, t0: w.start - PRE,
      t1: Math.min(leaveBeat(beats, line.end), last ? last.start : 1e9, p.line === 2 ? w.end + 0.5 : 1e9), row, n: text.length, lx,
      Wpx, Wm: p.Wm, Hn: (p.Wm * CAP) / Wpx, env, line: p.line,
    });
  });
  return { heroes, atlas: cv };
}

/** Per-letter height scale and state for the hero word on screen at t. Every letter stands on one baseline and is at
 *  least 0.85 of the cap height (the envelope only lifts the tops), so the word always reads. */
export function heroState(h: Hero, t: number): { state: number; s: number[] } {
  const s: number[] = [];
  const rest = 0.95;
  const on = t >= h.start - LEAD;
  for (let k = 0; k < h.n; k++) {
    if (!on) { s.push(rest); continue; }
    const tk = h.start - LEAD + (k / h.n) * (h.end - h.start);
    const e = ease.outBack(clamp((t - tk) / 0.16), 2.4);
    const target = 0.9 + 0.2 * clamp(h.env[k]! * 1.15);
    s.push(rest + (target - rest) * (t >= tk ? e : 0));
  }
  return { state: on ? 2 : 1, s: s.map((x) => Math.max(0.85, x)) };
}

// ------------------------------------------------------------------ the transcript lane
// The supporting words ride in a lane on the monitor under the waveform: each word at its own time position (its
// start under the playhead), scrolling with the waveform; it lights as the playhead reaches it.
export const LANE = { x0: -146, x1: 146, y0: 38, y1: 57, ppm: 7 };
interface CW { text: string; start: number; end: number; cx: number; w: number }
export interface Chunk { t0: number; t1: number; words: CW[] }
const SPEC: number[][][] = [[[0, 1, 2, 3], [5, 6]], [[0, 1], [3, 4, 5]], [[0, 1, 2, 3], [4, 5], [7, 8]], [[0, 1, 2, 3], [4, 5, 6, 7]]];
const EM = 11.5;
let mctx: CanvasRenderingContext2D | null = null;
const meas = (f: string, s: string) => { mctx ??= document.createElement('canvas').getContext('2d')!; mctx.font = font(f, EM * LANE.ppm); return mctx.measureText(s).width / LANE.ppm; };

export function buildChunks(ly: Lyrics, beats: number[]): Chunk[] {
  const lines = ly.lines.filter((l: Line) => l.start >= T0 - 0.05 && l.start < T1);
  const out: (Chunk & { line: number })[] = [];
  const fam = F.archivo(100, 500);
  lines.forEach((l, li) => {
    SPEC[li]!.forEach((ids) => {
      const ws = ids.map((i) => l.words[i]!);
      const words: CW[] = ws.map((w) => ({ text: w.w.replace(/[,.!?]/g, ''), start: w.start, end: w.end, cx: w.start * SPD, w: meas(fam, w.w.replace(/[,.!?]/g, '')) }));
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
export function drawLane(cv: HTMLCanvasElement, chunks: Chunk[], t: number, tau: number, left = LANE.x0 + 1.5) {
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  const ch = chunks.find((k) => t >= k.t0 && t < k.t1);
  if (!ch) return;
  const P = LANE.ppm, base = cv.height * 0.5 + EM * 0.2 * P;
  c.globalCompositeOperation = 'lighter'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const fam = F.archivo(100, 500);
  // a word that reaches the lane's left edge stops there and the next ones stack against it until the line leaves
  let minX = Math.max(LANE.x0 + 1.5, left);
  for (const w of ch.words) {
    if (t < w.start - PRE) continue;
    const xmm = Math.max(XP + w.cx - tau * SPD, minX);
    minX = xmm + w.w + 2.0;
    const dt = tau - (w.start - LEAD);
    const sung = dt >= 0;
    const s = sung ? 0.94 + 0.06 * ease.outBack(clamp(dt / 0.14)) : 1;
    c.save();
    const x0 = (xmm - LANE.x0) * P, cx = x0 + (w.w * P) / 2;
    c.translate(cx, base); c.scale(s, s); c.translate(-cx, -base);
    c.font = font(fam, EM * P);
    c.fillStyle = sung ? 'rgb(255,0,0)' : 'rgb(0,0,255)';
    c.fillText(w.text, x0, base);
    c.restore();
    // the word's start mark on the lane's floor
    c.fillStyle = sung ? 'rgb(255,0,0)' : 'rgb(0,0,255)';
    c.fillRect(x0 - 0.5 * P * 0.5, cv.height - 2.6 * P, 0.5 * P, 2.2 * P);
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
