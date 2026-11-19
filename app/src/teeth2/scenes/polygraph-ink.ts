// Plate 4 `polygraph`: the ink. Each frame the pen traces and the lyric written so far are redrawn as capsule
// segments (LineBatch) into a world-space target that the paper shader samples: R = lyric (the cardio pen's
// letters), G = the pens' traces (and the cardio line: its climb out of the channel, the faint line the pen draws
// between strokes, its drop back), B = the blots where a pen lands.
// The cardio trace is one continuous line: it leaves its channel, climbs into a word, writes it, and drops back (or
// runs straight on into the next word).
// Also the header (SUBJECT, left blank) as a small texture, and where the cardio pen is at any time.
import * as THREE from 'three';
import { LineBatch } from '../../engine/lines';
import { F, font } from '../../engine/type';
import { clamp, lerp, ease } from '../../engine/util';
import { T_HEX } from '../palette';
import { Script, T0, T_DROP, T_LIE, T_TEAR, PEN_OX, handShake, type PhraseS, type Unit } from './polygraph-script';

export interface InkWin { x0: number; y0: number; w: number; h: number; rho: number }
const LY: [number, number, number] = [1, 0, 0], TR: [number, number, number] = [0, 1, 0], BL: [number, number, number] = [0, 0, 1];
/** How fast the recorded paper ran past the pens before a landing (world units / s): the history that fills the fresh paper. */
const HIST_V = 420;

/** World position of the cardio pen's nib at t, and whether it is in the lyric. */
export function cardioPen(S: Script, t: number): { x: number; y: number; writing: boolean } {
  const U = S.units;
  for (let k = 0; k < U.length; k++) {
    const u = U[k]!;
    const a0 = u.joinPrev ? u.t0 : u.tc0;
    if (t < a0) break;
    const p = S.phrases[u.p]!;
    if (!u.joinPrev && t < u.t0) return { ...climbPos(S, u, t), writing: true };
    if (t <= u.t1) {
      const q = penAtPhrase(p, t);
      const [dx, dy] = handShake(S, t);
      return { x: q.x + dx, y: q.y + dy, writing: true };
    }
    if (u.joinNext) {
      const nx = U[k + 1]!;
      if (t < nx.t0) { const v = (t - u.t1) / Math.max(1e-6, nx.t0 - u.t1); return { x: lerp(u.last.x, nx.first.x, v), y: lerp(u.last.y, nx.first.y, v), writing: true }; }
    } else if (t <= u.td1) return { ...dropPos(S, u, t), writing: true };
  }
  return { x: S.rack(t), y: S.cardioY(t), writing: false };
}

/** The climb out of the line into the first letter (the nib rides the paper's feed, so it follows a whip). */
export function climbPos(S: Script, u: Unit, tau: number): { x: number; y: number } {
  const v = clamp((tau - u.tc0) / Math.max(1e-6, u.t0 - u.tc0));
  const off = u.first.x - S.rack(u.t0);
  return { x: S.rack(tau) + off * ease.inOutQuad(v), y: lerp(S.cardioY(tau), u.first.y, ease.outCubic(v)) };
}
/** The drop from the last letter back down to the line. */
export function dropPos(S: Script, u: Unit, tau: number): { x: number; y: number } {
  const v = clamp((tau - u.t1) / Math.max(1e-6, u.td1 - u.t1));
  const off = u.last.x - S.rack(u.t1);
  return { x: S.rack(tau) + off * (1 - ease.inOutQuad(v)), y: lerp(u.last.y, S.cardioY(tau), ease.inCubic(v)) };
}

/** The nib along the phrase's strokes at t (it rests at the end of a stroke until the next one starts). */
export function penAtPhrase(p: PhraseS, t: number): { x: number; y: number } {
  let best = p.strokes[0]![0]!;
  for (const sk of p.strokes) {
    if (sk[0]!.t > t) break;
    for (let j = 0; j < sk.length; j++) {
      const a = sk[j]!;
      if (a.t > t) { const b = sk[j - 1]!; return { x: lerp(b.x, a.x, (t - b.t) / Math.max(1e-6, a.t - b.t)), y: lerp(b.y, a.y, (t - b.t) / Math.max(1e-6, a.t - b.t)) }; }
      best = a;
    }
  }
  return { x: best.x, y: best.y };
}

/** Redraw the ink as of t. */
export function drawInk(lb: LineBatch, S: Script, t: number, W: InkWin) {
  lb.clear();
  const px = (x: number) => (x - W.x0) * W.rho, py = (y: number) => (W.y0 + W.h - y) * W.rho;
  const xr = W.x0 + W.w;
  const seg = (ax: number, ay: number, bx: number, by: number, w: number, col: [number, number, number]) => {
    if ((ax < W.x0 && bx < W.x0) || (ax > xr && bx > xr)) return;
    lb.seg2(px(ax), py(ay), px(bx), py(by), Math.max(w * W.rho, 0.8), col, 1);
  };
  // pen widths in screen px (the camera's width changes between setups)
  const pxw = S.camW(t) / 1920;
  const wTr = 3.1 * pxw;
  // ---- the traces: sampled on an absolute time grid so that the ink never shimmers between frames
  const dt = 1 / 360;
  for (let i = 0; i < 4; i++) {
    const tA = Math.max(t - 3.2, i < 3 ? T_DROP : T0 - 3.2);
    // the paper on which the pens have been recording: before the first drop and before each whip's landing the paper ran past
    // the pens at a steady speed, so that fresh paper arrives with its traces already across it
    let hL = T0, hS: 1 | -1 = 1, pre = -1;
    S.landings.forEach((lw, k) => { if (t >= lw) { hL = lw; hS = S.landS[k]!; } else if (t >= S.landW[k]!) pre = k; });
    // (while a whip is in flight both the paper it leaves and the paper it brings are drawn)
    const run = (hLx: number, hSx: number, all: boolean) => {
    let pvx = NaN, pvy = NaN, pOk = false;
    const sample = (tau: number) => {
      const hist = all || tau < hLx;
      const ok = S.penDown(i, tau) && (i < 3 || hist || !S.cardioWriting(tau));
      if (!ok) { pOk = false; return; }
      const xr = hist ? S.rack(hLx) - hSx * HIST_V * (hLx - tau) : S.rack(tau);
      const x = xr + PEN_OX[i]!, y = i < 3 ? S.penY(i, tau) : S.cardioY(tau);
      if (pOk) seg(pvx, pvy, x, y, wTr, TR);
      pvx = x; pvy = y; pOk = true;
    };
    for (let n = Math.ceil(tA / dt); n * dt <= t; n++) sample(n * dt);
    sample(t);
    };
    run(hL, hS, false);
    if (pre >= 0) run(S.landings[pre]!, S.landS[pre]!, true);
  }
  // ---- the blots where the pens land (T_DROP)
  if (t >= T_DROP && t - T_DROP < 3.2) {
    for (let i = 0; i < 3; i++) {
      const x = S.rack(T_DROP) + PEN_OX[i]!, y = S.penY(i, T_DROP);
      seg(x, y, x + 0.01, y, 4.5 * pxw, BL);
    }
  }
  // ---- the cardio pen, word by word: climb, letters, drop
  S.units.forEach((u, k) => {
    const p = S.phrases[u.p]!;
    if (t < (u.joinPrev ? u.t0 : u.tc0) || t > p.vis1) return;
    const hero = p.hero ? 0.58 + 0.42 * ease.outCubic(clamp((t - u.t0) / 0.3)) : 1;
    const w = p.pen * hero;
    if (!u.joinPrev && u.tc0 < u.t0 && t >= u.tc0) {
      const tEnd = Math.min(t, u.t0);
      let a = climbPos(S, u, u.tc0);
      for (let n = 1; n <= 12; n++) {
        const b = climbPos(S, u, u.tc0 + ((tEnd - u.tc0) * n) / 12);
        seg(a.x, a.y, b.x, b.y, wTr, TR); a = b;
      }
    }
    // the letters, and the line the pen draws travelling between one stroke and the next
    // (no connector between one stroke and the next, or between words: the pen is up there and leaves no line)
    for (const si of u.sIdx) {
      const sk = p.strokes[si]!;
      if (sk[0]!.t > t) break;
      for (let j = 0; j + 1 < sk.length; j++) {
        const a = sk[j]!, b = sk[j + 1]!;
        if (a.t > t) break;
        const [ax, ay] = handShake(S, a.t), [bx0, by0] = handShake(S, Math.min(b.t, t));
        let bx = b.x + bx0, by = b.y + by0;
        if (b.t > t) { const v = (t - a.t) / Math.max(1e-6, b.t - a.t); bx = lerp(a.x + ax, b.x + bx0, v); by = lerp(a.y + ay, b.y + by0, v); }
        seg(a.x + ax, a.y + ay, bx, by, w, LY);
      }
    }
    // between two words that run on: only "lie" -> the jump of a channel in one jagged stroke (the event); any other pen-up leaves no line
    if (u.joinNext && t > u.t1 && u.p === 4 && S.units[k - 1]?.p !== 4) {
      const nx = S.units[k + 1]!;
      const v1 = clamp((t - u.t1) / Math.max(1e-6, nx.t0 - u.t1));
      const lie = true;
      let ax = u.last.x, ay = u.last.y;
      for (let n = 1; n <= 9; n++) {
        const v = (n / 9) * v1;
        const jag = lie && n < 9 ? (n % 2 ? 1 : -1) * 16 * Math.sin(v * Math.PI) : 0;
        const bx = lerp(u.last.x, nx.first.x, v) + jag, by = lerp(u.last.y, nx.first.y, lie ? ease.outQuad(v) : v) + (lie && n < 9 ? 24 * Math.sin(v * Math.PI) : 0);
        seg(ax, ay, bx, by, 3 * pxw, LY); ax = bx; ay = by;
      }
    }
    // the drop back to the line
    if (!u.joinNext && t > u.t1) {
      const tEnd = Math.min(t, u.td1);
      let a = dropPos(S, u, u.t1);
      for (let n = 1; n <= 10; n++) {
        const b = dropPos(S, u, u.t1 + ((tEnd - u.t1) * n) / 10);
        seg(a.x, a.y, b.x, b.y, wTr, TR); a = b;
      }
    }
  });
}

/** The header: SUBJECT with its field left blank, and the exhibit number as fine print. World units 560 x 170 (2 px each). */
export function buildHeader(): { cv: HTMLCanvasElement; w: number; h: number } {
  const w = 560, h = 170, k = 2;
  const cv = document.createElement('canvas');
  cv.width = w * k; cv.height = h * k;
  const c = cv.getContext('2d')!;
  c.setTransform(k, 0, 0, k, 0, 0);
  c.fillStyle = T_HEX.film;
  c.textBaseline = 'alphabetic';
  c.font = font(F.mono(600), 34);
  c.fillText('SUBJECT', 6, 86);
  c.fillRect(228, 88, 300, 2.2);
  c.font = font(F.mono(400), 9.5);
  c.globalAlpha = 0.5;
  c.fillText('08-32 · EXHIBIT 3 · POLYGRAPH · 4 CH', 6, 112);
  c.globalAlpha = 1;
  return { cv, w, h };
}
export { T_LIE, T_TEAR };
