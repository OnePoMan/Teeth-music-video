// `articulator` rig: the machine's dimensions, the studio sweep, the upper member's pose (its rigid motion) and the
// motion channels. Shared by articulator.ts (TS) and articulator-glsl.ts (GLSL), so the constants live here.
//
// Frames: mm, the kit's head frame (teeth.ts): X the patient's left, Y up, Z anterior. The lower member, the lower
// cast and the studio are fixed in this frame (world); the upper member (the T-arm: the hinge cross-piece, the stem, the engraved front cross-piece, the upper cast, the pin) is built in
// its own local frame, equal to world when closed in centric, and placed by poseMatrix().
//
// The upper member moves like a semi-adjustable articulator's: a hinge about the condylar axis (theta, opening), a
// lateral glide (psi, a yaw about the working condyle's vertical axis), and small translations (protrusion, the cusp
// guidance lift, the release lift). The lyric is engraved in two narrow chrome crossbars, the T-arm's front cross-piece (every
// line but the last) and the lower member's (LET GO, so GO stays whole while the upper member lifts away); each bar's
// engraved face is tilted back by TILT so it reads from the high shots the closures are filmed from.
import * as THREE from 'three';

export const RIG = {
  TABLE_Y: -60,
  /** the condylar axis (hinge), the condyles' half spacing */
  HY: 20, HZ: -95, CX: 56,
  /** the crossbars: engraved face half extents, chamfer, half depth, tilt back (rad) */
  FHW: 72, FHH: 6.5, CH: 2.0, BD: 5.0, TILT: 28 * Math.PI / 180,
  /** the lower crossbar (LET GO): the same length, a taller face so GO can fill a macro */
  LHH: 9.0,
  /** the upper crossbar's face centre (upper member frame) and the lower crossbar's (world) */
  FY: 53, FZ: 58, LY: -47.5, LZ: 80,
  /** the incisal pin (rod axis x 0, z PZ) and its tip when closed */
  PZ: 44, PTIP: -35.5,
};

/** The white studio sweep behind the set: a card lying on the table from z = Z1 back to ZC, curving up (radius R)
 *  into a wall at z = ZC - R, |x| < X, up to TOP. */
export const SWEEP = { Z1: -175, ZC: -265, R: 120, X: 680, TOP: 720 };

export interface Pose { psi: number; theta: number; tx: number; ty: number; tz: number }
export const CENTRIC: Pose = { psi: 0, theta: 0, tx: 0, ty: 0, tz: 0 };

const _m = new THREE.Matrix4(), _a = new THREE.Matrix4(), _b = new THREE.Matrix4();
/** Upper member local -> world: translate * yaw about the working condyle * hinge about the condylar axis. */
export function poseMatrix(p: Pose, out = new THREE.Matrix4()) {
  const { HY, HZ, CX } = RIG;
  out.makeTranslation(p.tx, p.ty, p.tz);
  const px = p.psi < 0 ? -CX : CX; // working condyle: the side the incisors move toward
  _a.makeTranslation(px, 0, HZ); _b.makeRotationY(p.psi); _m.makeTranslation(-px, 0, -HZ);
  out.multiply(_a).multiply(_b).multiply(_m);
  _a.makeTranslation(0, HY, HZ); _b.makeRotationX(-p.theta); _m.makeTranslation(0, -HY, -HZ);
  out.multiply(_a).multiply(_b).multiply(_m);
  return out;
}

const _M = new THREE.Matrix4();
/** World position of the upper crossbar's face point (u along the bar, v up the tilted face). */
export function facePoint(p: Pose, u: number, v: number, out = new THREE.Vector3()) {
  const s = Math.sin(RIG.TILT), c = Math.cos(RIG.TILT);
  return out.set(u, RIG.FY + v * c, RIG.FZ - v * s).applyMatrix4(poseMatrix(p, _M));
}

/** Piecewise motion channel: hold, then ease from the value in force to `v` over [t0, t1]. */
export class Channel {
  segs: { t0: number; t1: number; v: number; e: (k: number) => number }[] = [];
  constructor(public v0 = 0) {}
  to(t0: number, t1: number, v: number, e: (k: number) => number) { this.segs.push({ t0, t1, v, e }); this.segs.sort((a, b) => a.t0 - b.t0); return this; }
  at(t: number) {
    let v = this.v0;
    for (const s of this.segs) {
      if (t < s.t0) break;
      if (t >= s.t1) { v = s.v; continue; }
      const k = s.e((t - s.t0) / Math.max(1e-6, s.t1 - s.t0));
      return v + (s.v - v) * k;
    }
    return v;
  }
}

/** World position of the lower crossbar's face point (fixed: it is part of the base). */
export function lowerFacePoint(u: number, v: number, out = new THREE.Vector3()) {
  const s = Math.sin(RIG.TILT), c = Math.cos(RIG.TILT);
  return out.set(u, RIG.LY + v * c, RIG.LZ - v * s);
}
