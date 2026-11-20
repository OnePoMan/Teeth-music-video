// Plate 8 `voice`: the script (pure functions of song time): the display clock (playback, the scrub back, the whip
// forward), the tape and the cut, the halves' slide, the swell to clip, the camera shots, the gloved hand's poses.
// Units: mm on the bench (z up, x right, y away from the lens), seconds of song time.
import * as THREE from 'three';
import { clamp, lerp, ease } from '../../engine/util';

export const T0 = 90.163, T1 = 103.976;
/** The cut: the razor's edge reaches the bottom of the 45 degree slot on the beat that carries "lie" (94.48). */
export const TCUT = 94.479;
export const SPD = 110;       // monitor: mm of screen per second of audio
export const TSPD = 38;       // tape: mm per second under the block
export const XP = -25;        // the playhead's x on the screen (mm)
export const YC = 104, HP = 44;   // the waveform panel's centre line and half height (screen mm)
export const HS = 0.8;        // the glove, scaled
export const ZB = 14;         // the block's top face
export const XS = 0;          // the 45 degree slot crosses the channel at x = 0
export const SCRUB0 = 98.796, SCRUB_BACK = 94.14;

const q = (a: number, b: number, t: number, f: (x: number) => number = ease.inOutCubic) => f(clamp((t - a) / (b - a)));

/** Display clock: the audio time under the playhead. Playback, then on "through" the playhead scrubs back over the
 *  line (the waveform reverses) to just before the splice, hangs, and whips forward to be back in time on the downbeat. */
export function tDisp(t: number): number {
  if (t < SCRUB0) return t;
  if (t < 99.86) return lerp(SCRUB0, SCRUB_BACK, q(SCRUB0, 99.86, t));
  if (t < 100.0) return SCRUB_BACK + 0.04 * Math.sin((t - 99.86) * 60);
  if (t < 100.522) return lerp(SCRUB_BACK, 100.522, q(100.0, 100.522, t, ease.inOutQuad));
  // the playhead hangs at the end of the vocal: the clipped plateau stops under it
  if (t > 103.2) return 103.2 + 0.09 * (1 - Math.exp(-(t - 103.2) / 0.09));
  return t;
}
/** Seconds of audio the display sweeps during one shutter (for the blur). */
export function dispRate(t: number): number {
  const e = 1 / 120;
  return Math.abs(tDisp(t + e) - tDisp(t - e)) / (2 * e);
}

const TA = 93.7, TB = 94.3;
/** The tape's travel past the block (s of tape-time): rolling, then stopped dead for the cut. */
export function tapeTime(t: number): number {
  if (t < TA) return t - T0;
  if (t < TB) { const k = (t - TA) / (TB - TA); return TA - T0 + (TB - TA) * (k - k * k / 2); }
  return TA - T0 + (TB - TA) / 2;
}
export const TAPE_END = tapeTime(TB + 1) * TSPD;

export interface Splice { cutOn: number; gh: number; oL: number; oR: number; gapTape: number; yJog: number; strip: number }
const SLIDE: [number, number][] = [[95.343, 0], [95.774, 0.21], [96.206, -0.15], [96.638, 0.1], [97.069, -0.06]];
export function splice(t: number): Splice {
  const cutOn = t >= TCUT ? 1 : 0;
  const open = clamp((t - TCUT) / 0.07);
  const gh = 0.075 * ease.outCubic(open);
  let oR = 0;
  if (t >= SLIDE[0]![0]) {
    oR = SLIDE[SLIDE.length - 1]![1];
    for (let i = 1; i < SLIDE.length; i++) {
      if (t < SLIDE[i]![0]) { oR = lerp(SLIDE[i - 1]![1], SLIDE[i]![1], q(SLIDE[i - 1]![0], SLIDE[i]![0], t, ease.outCubic)); break; }
    }
  }
  const oL = -0.3 * oR;
  return { cutOn, gh, oL, oR, gapTape: cutOn * 3.4 * ease.outCubic(open), yJog: 1.15 * clamp(Math.abs(oR) * 5) * Math.sign(oR || 1), strip: t >= 94.93 ? 1 : 0 };
}

/** The swell to clip: gain on the waveform from "gonna" to "alive". */
export function gain(t: number): number {
  const k = clamp((t - 100.9) / 2.4);
  return 1 + 13 * Math.pow(k * k * (3 - 2 * k), 1.6);
}

// ------------------------------------------------------------------ the camera
export interface Cam { tx: number; ty: number; tz: number; D: number; az: number; el: number; roll: number; fov: number }
const C = (tx: number, ty: number, tz: number, D: number, az = 0, el = 7, roll = 0, fov = 30): Cam => ({ tx, ty, tz, D, az, el, roll, fov });
/** A point on the screen (sx, sy mm) in world mm (the screen leans back 7 degrees). */
export const MON = { y0: 62, z0: 30, tilt: (7 * Math.PI) / 180 };
export const scr = (sx: number, sy: number): [number, number, number] => [sx, MON.y0 + sy * Math.sin(MON.tilt), MON.z0 + sy * Math.cos(MON.tilt)];
const S = (sx: number, sy: number, D: number, az = 0, el = 7, roll = 0, fov = 30) => { const p = scr(sx, sy); return C(p[0], p[1], p[2], D, az, el, roll, fov); };

interface Shot { t0: number; t1: number; A: Cam; B: Cam; ease?: (x: number) => number; kick?: boolean }
const D = [90.163, 91.889, 93.616, 95.343, 97.069, 98.796, 100.522, 102.249, 103.976];
export const SHOTS: Shot[] = [
  // bar 1: the whole bench, pushing in
  { t0: D[0]!, t1: 91.026, A: S(-6, 72, 335, -7, 7, 0, 30), B: S(4, 72, 300, -2, 7, 0, 30) },
  // the whole bench: the tape rolling over the block, the monitor behind
  { t0: 91.026, t1: D[1]!, A: C(-6, 30, 104, 400, 18, 10, 0.02, 34), B: C(0, 30, 106, 372, 12, 9, 0.015, 34) },
  // bar 2: the monitor, tracking along the screen
  { t0: D[1]!, t1: D[2]!, A: S(-22, 84, 285, 7, 7, 0.012), B: S(14, 84, 262, -5, 7, -0.008) },
  // bar 3: the glove comes in low and the razor hovers over the slot
  { t0: D[2]!, t1: 94.25, A: C(10, 6, 52, 255, 24, 11, -0.02, 36), B: C(2, 2, 42, 215, 30, 15, -0.03, 36) },
  // the plunge, macro
  { t0: 94.25, t1: TCUT, A: C(2, -2, 27, 140, 46, 19, 0.03, 30), B: C(1, -1, 22, 118, 46, 24, 0.04, 30) },
  // the cut: the monitor, the waveform splits
  { t0: TCUT, t1: 94.695, A: S(-8, 91, 252, -9, 6, -0.015), B: S(-14, 92, 228, -9, 6, -0.015) },
  // the razor lifts out and the cut tape lies open, slanted
  { t0: 94.695, t1: 94.911, A: C(0, 0, 18, 125, 44, 22, 0.03, 30), B: C(0, 0, 18, 108, 44, 25, 0.03, 30) },
  // "gives": the monitor, lower, the slanted gap travelling away from the playhead
  { t0: 94.911, t1: D[3]!, A: S(-30, 82, 262, 12, 4, 0.02), B: S(-48, 80, 238, 12, 4, 0.02) },
  // bar 4: the block, macro: the strip, the halves slid back and forth
  { t0: D[3]!, t1: 96.206, A: C(4, -1, 16, 150, -18, 30, -0.04, 30), B: C(6, -1, 16, 128, -24, 33, -0.05, 30) },
  // the bench, wide and low: the monitor's halves against the block's
  { t0: 96.206, t1: D[4]!, A: C(-4, 28, 104, 395, 14, 10, 0.025, 34), B: C(0, 30, 106, 365, 10, 9, 0.02, 34) },
  // bar 5: the monitor from the right
  { t0: D[4]!, t1: 97.933, A: S(-44, 82, 292, -17, 5, -0.02), B: S(-24, 82, 252, -10, 6, -0.01) },
  // "you're looking": in tighter, from the other side
  { t0: 97.933, t1: D[5]!, A: S(18, 70, 215, 15, 6, 0.03), B: S(8, 72, 196, 9, 6, 0.02) },
  // bar 6: the scrub
  { t0: D[5]!, t1: D[6]!, A: S(-6, 86, 270, 4, 7, 0), B: S(-6, 86, 238, 0, 7, 0) },
  // bar 7: low and wide, the block in the foreground
  { t0: D[6]!, t1: D[7]!, A: C(26, 30, 76, 270, 30, 9, 0.02, 40), B: C(16, 32, 80, 245, 26, 8, 0.015, 40) },
  // bar 8: onto the clipped wave: ends level on its flat top
  { t0: D[7]!, t1: D[8]!, A: S(-4, 86, 270, 0, 7, 0), B: S(-96, 134, 75, 0, 7, 0), ease: (x) => ease.inOutCubic(clamp((x - 0.7) / 0.3)) },
];
export const CUTS = D.concat([97.933, 91.026, 94.25, TCUT, 94.695, 94.911, 96.206]).sort((a, b) => a - b);

export function camAt(t: number): Cam {
  let sh = SHOTS[0]!;
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const k = (sh.ease ?? ease.outCubic)(clamp((t - sh.t0) / (sh.t1 - sh.t0)));
  const a = sh.A, b = sh.B;
  return { tx: lerp(a.tx, b.tx, k), ty: lerp(a.ty, b.ty, k), tz: lerp(a.tz, b.tz, k), D: lerp(a.D, b.D, k), az: lerp(a.az, b.az, k), el: lerp(a.el, b.el, k), roll: lerp(a.roll, b.roll, k), fov: lerp(a.fov, b.fov, k) };
}

// ------------------------------------------------------------------ the hand
export interface HandPose { on: boolean; blade: boolean; tip: THREE.Vector3; e1: THREE.Vector3; e2: THREE.Vector3; e3: THREE.Vector3 }
const frame = (hx: number, hy: number, tilt: number) => {
  const n = Math.hypot(hx, hy), x = hx / n, y = hy / n, c = Math.cos(tilt), s = Math.sin(tilt);
  const e1 = new THREE.Vector3(x * c, y * c, s), e2 = new THREE.Vector3(y, -x, 0);
  const e3 = new THREE.Vector3().crossVectors(e1, e2).normalize();
  if (e3.z < 0) e3.negate();
  return { e1, e2, e3 };
};
const place = (target: THREE.Vector3, f: ReturnType<typeof frame>, h: [number, number, number]) =>
  target.clone().sub(f.e1.clone().multiplyScalar(h[0] * HS)).sub(f.e2.clone().multiplyScalar(h[1] * HS)).sub(f.e3.clone().multiplyScalar(h[2] * HS));

const OUT = new THREE.Vector3(190, -110, 78);
const SLOT_HEAD: [number, number] = [0.7071, -0.7071];
const BLADE_PT: [number, number, number] = [25, -0.3, -1];
const PAD_PT: [number, number, number] = [38, 3, 4];
export function handAt(t: number): HandPose {
  const none: HandPose = { on: false, blade: false, tip: new THREE.Vector3(), e1: new THREE.Vector3(1, 0, 0), e2: new THREE.Vector3(0, 1, 0), e3: new THREE.Vector3(0, 0, 1) };
  // (a) the razor
  if (t >= 93.35 && t < 95.1) {
    const hover = new THREE.Vector3(XS - 1.5, 1.0, ZB + 24);
    const down = new THREE.Vector3(XS, 0, ZB - 2.4);
    let P = hover.clone(), tilt = 0.62, hx = SLOT_HEAD[0], hy = SLOT_HEAD[1];
    if (t < 94.05) {
      const k = ease.outQuart(q(93.35, 94.05, t, (x) => x));
      P = OUT.clone().lerp(hover, k); P.z += 14 * Math.sin(Math.PI * k) * (1 - k);
      tilt = lerp(0.9, 0.62, k);
    } else if (t < 94.19) {
      P.z += 1.2 * Math.sin((t - 94.05) * 18);
    } else if (t < 94.36) {
      P.z += 5.5 * ease.outCubic(q(94.19, 94.36, t, (x) => x)); tilt = 0.64;
    } else if (t < TCUT) {
      const k = ease.inQuad(q(94.36, TCUT, t, (x) => x));
      P = hover.clone().add(new THREE.Vector3(0, 0, 5.5)).lerp(down, k); tilt = lerp(0.64, 0.12, k);
    } else if (t < 94.56) {
      P = down.clone(); tilt = 0.12;
    } else {
      const k = q(94.56, 95.05, t, ease.inQuad);
      const kk = ease.outCubic(q(94.56, 94.74, t, (x) => x));
      P = down.clone().lerp(hover, kk).lerp(OUT.clone().setZ(60), k); tilt = lerp(0.12, 0.7, kk);
    }
    const f = frame(hx, hy, tilt);
    return { on: true, blade: true, tip: place(P, f, BLADE_PT), ...f };
  }
  // (b) the empty hand slides the right half back and forth
  if (t >= 95.05 && t < 97.4) {
    const sp = splice(t);
    const pad = new THREE.Vector3(XS + 17 + sp.oR * TSPD, 0.6, ZB + 1.2);
    let P = pad.clone(), tilt = 0.5;
    if (t < 95.343) { const k = ease.outCubic(q(95.05, 95.343, t, (x) => x)); P = OUT.clone().setZ(40).lerp(pad.clone().add(new THREE.Vector3(0, 0, 3)), k); }
    else if (t > 96.95) { const k = ease.inCubic(q(96.95, 97.4, t, (x) => x)); P = pad.clone().lerp(OUT.clone().setZ(70), k); }
    else P.z += 1.6 * Math.abs(Math.sin(((t - 95.343) / 0.4316) * Math.PI)) * 0.8;
    const f = frame(0.93, -0.37, tilt);
    return { on: true, blade: false, tip: place(P, f, PAD_PT), ...f };
  }
  return none;
}
