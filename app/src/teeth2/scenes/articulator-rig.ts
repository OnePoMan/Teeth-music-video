// `articulator` rig: the machine's dimensions, its pose (the upper member's rigid motion) and the reflection solver.
// Shared by articulator.ts (TS) and articulator-glsl.ts (GLSL): the two must agree exactly, so the constants live here.
//
// Frames: mm, the kit's head frame (teeth.ts): X the patient's left, Y up, Z anterior. The lower member, the lower
// cast and the studio are fixed in this frame (world); the upper member (frame, upper cast, mounting, pin) is built in
// its own local frame, equal to world when closed in centric, and placed by poseMatrix().
//
// The upper member moves like a semi-adjustable articulator's: a hinge about the condylar axis (theta, opening), a
// lateral glide (psi, a yaw about the working condyle's vertical axis), and small translations (the Bennett shift,
// protrusion, the guidance lift). The lettering is engraved in the front face of the upper member's crossbar; it
// reads only where that polished face reflects the white studio card (a flat standing far in front of the set). The
// solver (faceLit) runs the same reflection test as the shader, so the motion can be solved to bring each word into
// the card's reflection on its onset: the swinging arm catching the card IS the karaoke.
import * as THREE from 'three';

export const RIG = {
  TABLE_Y: -60,
  /** the condylar axis (hinge), the condyles' half spacing */
  HY: 20, HZ: -95, CX: 56,
  /** the crossbar's front face (engraved): plane z = FZ, centre y = FY, half extents */
  FZ: 24, FY: 53, FHW: 61, FHH: 17,
  /** the incisal pin (rod axis x 0, z PZ) and its tip when closed */
  PZ: 56, PTIP: -35.5,
};

/** The white studio card: a flat standing far in front of the set, facing it (plane z = Z). */
export const CARD = { Z: 2600, X0: -270, X1: 1487, Y0: -885, Y1: 188 };

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

/** Signed distance (mm, + inside) of the reflected ray's hit to the card's border; -1e3 if it misses the plane. */
export function cardInside(P: THREE.Vector3, R: THREE.Vector3) {
  if (R.z <= 1e-4) return -1e3;
  const s = (CARD.Z - P.z) / R.z;
  const x = P.x + R.x * s, y = P.y + R.y * s;
  return Math.min(x - CARD.X0, CARD.X1 - x, y - CARD.Y0, CARD.Y1 - y);
}

const _P = new THREE.Vector3(), _N = new THREE.Vector3(), _D = new THREE.Vector3(), _R = new THREE.Vector3();
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3(), _T = new THREE.Vector3();
/** Is the face point (u, v) (face mm: u along +x, v up from FY) lit by the card's reflection, seen from `cam`? */
export function faceLit(p: Pose, cam: THREE.Vector3, u: number, v: number) {
  poseMatrix(p, _M);
  _P.set(u, RIG.FY + v, RIG.FZ).applyMatrix4(_M);
  _M.decompose(_T, _Q, _S);
  _N.set(0, 0, 1).applyQuaternion(_Q);
  _D.copy(_P).sub(cam).normalize();
  _R.copy(_D).addScaledVector(_N, -2 * _D.dot(_N));
  return cardInside(_P, _R);
}
/** The world position of a face point under a pose. */
export function facePoint(p: Pose, u: number, v: number, out = new THREE.Vector3()) {
  return out.set(u, RIG.FY + v, RIG.FZ).applyMatrix4(poseMatrix(p, _M));
}

/** Bisection for f(x) = 0 on [a, b]; null if f does not change sign. */
export function bisect(f: (x: number) => number, a: number, b: number, it = 48): number | null {
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return null;
  for (let i = 0; i < it; i++) {
    const m = 0.5 * (a + b), fm = f(m);
    if (fm * fa <= 0) b = m; else { a = m; fa = fm; }
  }
  return 0.5 * (a + b);
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
