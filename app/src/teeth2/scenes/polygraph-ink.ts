// Plate 4 `polygraph`: the ink. Each frame the pen traces and the lyric written so far are redrawn as capsule
// segments (LineBatch) into a world-space target that the paper shader samples: R = lyric (the cardio pen's
// letters), G = the pens' traces (and the cardio line, its climb and its drop), B = the blots where a pen lands.
// Also the header (SUBJECT, left blank) as a small texture, and where the cardio pen is at any time.
import * as THREE from 'three';
import { LineBatch } from '../../engine/lines';
import { F, font } from '../../engine/type';
import { clamp, lerp, ease } from '../../engine/util';
import { T_HEX } from '../palette';
import { Script, T0, T_DROP, T_LIE, T_TEAR, PEN_OX, handShake, type PhraseS } from './polygraph-script';

export interface InkWin { x0: number; y0: number; w: number; h: number; rho: number }
const LY: [number, number, number] = [1, 0, 0], TR: [number, number, number] = [0, 1, 0], BL: [number, number, number] = [0, 0, 1];

/** World position of the cardio pen's nib at t, and whether it is writing letters. */
export function cardioPen(S: Script, t: number): { x: number; y: number; writing: boolean } {
  const p = S.cardioWriting(t);
  const rack = S.rack(t);
  if (!p) return { x: rack, y: S.cardioY(t), writing: false };
  if (t < p.t0) return { ...climbPos(S, p, t), writing: true };
  if (t <= p.t1) {
    const q = penAtPhrase(p, t);
    const [dx, dy] = handShake(S, t);
    return { x: q.x + dx, y: q.y + dy, writing: true };
  }
  // the drop back to the line
  return { ...dropPos(S, p, t), writing: true };
}

/** The climb out of the line into the first letter (the nib rides the paper's feed, so it follows a whip). */
export function climbPos(S: Script, p: PhraseS, tau: number): { x: number; y: number } {
  const u = clamp((tau - p.tc0) / (p.t0 - p.tc0));
  const first = p.strokes[0]![0]!;
  const off = first.x - S.rack(p.t0);
  return { x: S.rack(tau) + off * ease.inOutQuad(u), y: lerp(S.cardioY(tau), first.y, ease.outCubic(u)) };
}
/** The drop from the last letter back down to the line. */
export function dropPos(S: Script, p: PhraseS, tau: number): { x: number; y: number } {
  const u = clamp((tau - p.t1) / (p.td1 - p.t1));
  const q = penAtPhrase(p, p.t1);
  const off = q.x - S.rack(p.t1);
  return { x: S.rack(tau) + off * (1 - ease.inOutQuad(u)), y: lerp(q.y, S.cardioY(tau), ease.inCubic(u)) };
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
  // ---- the traces: sampled on an absolute time grid so that the ink never shimmers between frames
  const dt = 1 / 360;
  for (let i = 0; i < 4; i++) {
    const tA = Math.max(t - 3.2, i < 3 ? T_DROP : T0);
    let pvx = NaN, pvy = NaN, pOk = false;
    const sample = (tau: number) => {
      const ok = S.penDown(i, tau) && (i < 3 || !S.cardioWriting(tau));
      if (!ok) { pOk = false; return; }
      const x = S.rack(tau) + PEN_OX[i]!, y = i < 3 ? S.penY(i, tau) : S.cardioY(tau);
      if (pOk) seg(pvx, pvy, x, y, i === 3 ? 2.0 : 1.7, TR);
      pvx = x; pvy = y; pOk = true;
    };
    for (let n = Math.ceil(tA / dt); n * dt <= t; n++) sample(n * dt);
    sample(t);
  }
  // ---- the blots where the pens land (T_DROP, and after every whip)
  const lands: number[] = [T_DROP];
  for (const tl of lands) {
    if (t < tl || t - tl > 3.2) continue;
    for (let i = 0; i < 3; i++) {
      const x = S.rack(tl) + PEN_OX[i]!, y = S.penY(i, tl);
      seg(x, y, x + 0.01, y, 6.5, BL);
    }
  }
  // ---- the cardio pen: climb, letters, drop
  S.phrases.forEach((p, k) => {
    const nx = S.phrases[k + 1];
    if (t < p.t0 - 0.2 || (nx && t > nx.w1 + 0.03) || t > p.t1 + 6) return;
    const hero = p.hero ? 0.58 + 0.42 * ease.outCubic(clamp((t - p.t0) / 0.3)) : 1;
    const w = p.pen * hero;
    // the climb (not for the first phrase: the pen starts on the first letter)
    if (k > 0 && t >= p.tc0) {
      const tEnd = Math.min(t, p.t0);
      let a = climbPos(S, p, p.tc0);
      for (let n = 1; n <= 12; n++) {
        const b = climbPos(S, p, p.tc0 + ((tEnd - p.tc0) * n) / 12);
        seg(a.x, a.y, b.x, b.y, 1.8, TR); a = b;
      }
    }
    // the letters
    let prevEnd: { x: number; y: number; t: number } | null = null;
    for (const sk of p.strokes) {
      if (sk[0]!.t > t) break;
      for (let j = 0; j + 1 < sk.length; j++) {
        const a = sk[j]!, b = sk[j + 1]!;
        if (a.t > t) break;
        const [ax, ay] = handShake(S, a.t), [bx0, by0] = handShake(S, Math.min(b.t, t));
        let bx = b.x + bx0, by = b.y + by0;
        if (b.t > t) { const u = (t - a.t) / Math.max(1e-6, b.t - a.t); bx = lerp(a.x + ax, b.x + bx0, u); by = lerp(a.y + ay, b.y + by0, u); }
        seg(a.x + ax, a.y + ay, bx, by, w, LY);
      }
    }
    void prevEnd;
    // "lie": the pen jumps a channel in one jagged stroke, from the E to the G
    if (p.raiseAt >= 0) {
      const eEnd = p.strokes.filter((s2, si) => p.st.charOf[si]! < p.raiseAt).flat().reduce((m, q) => (q.t > m.t ? q : m), p.strokes[0]![0]!);
      const gStart = p.strokes.find((s2, si) => p.st.charOf[si]! >= p.raiseAt)![0]!;
      if (t >= eEnd.t) {
        const u = clamp((t - eEnd.t) / 0.03);
        let ax = eEnd.x, ay = eEnd.y;
        for (let n = 1; n <= 9; n++) {
          const v = (n / 9) * u, jag = n < 9 ? (n % 2 ? 1 : -1) * 16 * Math.sin(v * Math.PI) : 0;
          const bx = lerp(eEnd.x, gStart.x, v) + jag, by = lerp(eEnd.y, gStart.y, ease.outQuad(v)) + (n < 9 ? 24 * Math.sin(v * Math.PI) : 0);
          seg(ax, ay, bx, by, 3.0, LY); ax = bx; ay = by;
        }
      }
    }
    // the drop back to the line
    if (t > p.t1) {
      const tEnd = Math.min(t, p.td1);
      let a = dropPos(S, p, p.t1);
      for (let n = 1; n <= 10; n++) {
        const b = dropPos(S, p, p.t1 + ((tEnd - p.t1) * n) / 10);
        seg(a.x, a.y, b.x, b.y, 1.8, TR); a = b;
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
