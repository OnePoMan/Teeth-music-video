// Plate 14 `filed`, parts 2 and 3, in plate 1's world (drawer-glsl.ts, the same bank, tube and drawer):
//  - the carry (186.85 – 193.76): the shut folder carried along the bank past the drawers, toward the open drawer
//    under the tube; held over its slot and dropped into it on a snare (it lands on its rails standing proud);
//  - the mirror (193.76 – 200.70): plate 1's riff backwards. On each real riff note the folder behind the gap flicks
//    forward over it, so the gap walks back from 08-32, one folder per note, nothing moving in the riff's held
//    chords; the camera's dolly along the rail carries the speed; on the last note the drawer slides back to a hand's
//    width and the camera settles into the loop pose on the hard stop;
//  - the stop (200.70 –): the folders' and the tab's slight swing settles (by ~201.9), then plate 1's first frame.
// The outro's riff is the intro's riff at the same tempo: its notes are plate 1's (drawer.ts, read from the analysed
// mid band) shifted from the intro's first downbeat to the 193.76 downbeat (the band plays over it here, so no
// separate onsets can be read; the drums keep every beat).
import * as THREE from 'three';
import { clamp, ease, hash, lerp } from '../../engine/util';
import { LAY } from './drawer-glsl';
import { T_FIRST, FLICKS, T_LIFT, LOOP_POSE, type Pose } from './drawer';

/** Plate 1's loop-frame values (drawer.ts: OPEN0, OPEN1, LIFT0, LEAN0). */
export const OPEN0 = 0.1, OPEN1 = 0.58, LIFT0 = 0.055, LEAN0 = -0.09;
const PICKUP = 7.06;

export interface BankTimes {
  /** beat k of the plate (k = 0 is the 174.77 downbeat) */
  b: (k: number) => number;
  /** the drop's snare */
  snare: number;
  /** the outro riff's first downbeat (193.76) and the intro's (0.38): the riff's offset */
  riff0: number; intro0: number;
  /** the hard stop */
  stop: number;
}

/** The outro's riff notes: phrase A 4, the chord, phrase B 7, the chord, the last 4 (the last one closes the drawer). */
export function riffNotes(T: BankTimes) {
  const off = T.riff0 - T.intro0;
  return [T_FIRST, ...FLICKS, T_LIFT, PICKUP].map((x) => x + off);
}

/** The gap: folder index of the first folder behind it (3 = 08-32 after the drop, one more per note). */
export function gapIndex(t: number, notes: number[]) {
  let g = LAY.K0832;
  for (let i = 0; i < notes.length - 1; i++) g += ease.outCubic(clamp((t - notes[i]!) / 0.11));
  return g;
}

/** The folders' swing into their two leaning groups: 1 through the carry and the riff; on the last note the drawer's
 *  slide back straightens them, the stop swings them a little, and it dies out completely. */
export function swingAmt(t: number, notes: number[], stop: number) {
  const n = notes[notes.length - 1]!;
  if (t <= n) return 1;
  if (t <= stop) return 1 - ease.inOutCubic((t - n) / (stop - n));
  const u = t - stop;
  if (u >= 1.2) return 0;
  return -0.16 * Math.exp(-u * 3.2) * Math.sin(u * Math.PI * 2 * 1.5) * (1 - ease.inOutQuad(clamp((u - 0.8) / 0.4)));
}

const restTilt = (k: number) => (k === LAY.K0832 ? LEAN0 : (hash(k, 3.1) - 0.5) * 0.05 + (k === 0 ? 0.03 : 0));

export function folders(g: number, s: number, tilt: number[], zs: number[]) {
  for (let k = 0; k < LAY.NF; k++) {
    const back = clamp(k + 1 - g);
    const grp = lerp(0.045, -0.2, back);
    tilt[k] = lerp(restTilt(k), grp, s);
    zs[k] = lerp(0, lerp(-0.012, -0.06, back), s);
  }
}

/** The drawer's travel: fully open until the last note, then the slide back, landing on the stop. */
export function drawerOpen(t: number, notes: number[], stop: number) {
  const n = notes[notes.length - 1]!;
  if (t <= n) return OPEN1;
  if (t <= stop) return lerp(OPEN1, OPEN0, ease.inQuad((t - n) / (stop - n)));
  return OPEN0;
}

// -------------------------------------------------------------------------------------------- the carry
const G = 9.81;
/** The drop's height above the rails. */
const DROP_H = 0.15;

/** 08-32's rod centre (world) while carried, and its own tilt; null once it rests in the drawer. */
export function carry(t: number, T: BankTimes): { pos: THREE.Vector3; tilt: number; yaw: number } | null {
  const { b } = T;
  const land = T.snare, release = land - Math.sqrt((2 * DROP_H) / G);
  if (t >= land) return null;
  const slotZ = OPEN1 - LAY.FZ0 - LAY.K0832 * LAY.FDZ - 0.06;
  const restY = LAY.YR + LIFT0;
  // the walk: from the dark end of the bank toward the tube, slowing into the drawer
  const w = clamp((t - b(28)) / (b(40) - b(28)));
  const x = lerp(1.15, 0, ease.inOutQuad(w) * 0.25 + w * 0.75);
  const app = ease.inOutCubic(clamp((t - b(36)) / (b(40) - b(36))));
  const z = lerp(0.82, slotZ, app);
  const bob = 0.004 * Math.sin((t - b(28)) * Math.PI * 2 * 1.16) * (1 - app);
  let y = lerp(1.12, restY + DROP_H, app) + bob;
  if (t > release) y = restY + DROP_H - 0.5 * G * (t - release) ** 2;
  const sway = 0.025 * Math.sin((t - b(28)) * Math.PI * 1.16) * (1 - app);
  // carried face-first toward the light (its label side ahead), turned square to the drawer on the approach
  return { pos: new THREE.Vector3(x, y, z), tilt: sway, yaw: lerp(-1.15, 0, app) };
}

// -------------------------------------------------------------------------------------------- cameras
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const gapZ = (open: number, g: number) => open - LAY.FZ0 - (g - 0.5) * LAY.FDZ;

/** Plate 1's over-the-drawer pose at gap g (drawer.ts cameraPose). */
export function overPose(open: number, g: number): Pose {
  const gz = gapZ(open, g);
  return { pos: v3(-0.1, LAY.YR + 0.38, gz + 0.36), at: v3(0.01, LAY.YR - 0.016, gz - 0.02), fov: 38, focus: -1, aper: 14 };
}

function mixPose(a: Pose, b: Pose, u: number): Pose {
  return { pos: a.pos.clone().lerp(b.pos, u), at: a.at.clone().lerp(b.at, u), fov: lerp(a.fov, b.fov, u), focus: u < 0.5 ? a.focus : b.focus, aper: lerp(a.aper, b.aper, u) };
}

/** The carry's shots: alongside, ahead and low, from above the drawer, then over the slot for the drop. */
export function carryPose(t: number, T: BankTimes, folder: THREE.Vector3 | null): Pose {
  const { b } = T;
  const f = folder ?? v3(0, LAY.YR + LIFT0, OPEN1 - LAY.FZ0 - LAY.K0832 * LAY.FDZ);
  const k = (i: number) => clamp((t - b(i)) / (b(i + 4) - b(i)));
  if (t < b(32)) {
    const u = ease.inOutQuad(k(28));
    return { pos: v3(f.x - lerp(0.8, 0.7, u), 1.24, 1.28), at: v3(f.x + 0.05, 1.0, 0.72), fov: 36, focus: 0, aper: 10 };
  }
  if (t < b(36)) {
    const u = ease.inOutQuad(k(32));
    return { pos: v3(lerp(-0.2, -0.35, u), 0.86, 1.3), at: v3(f.x, 1.03, 0.7), fov: 36, focus: 0, aper: 10 };
  }
  if (t < b(40)) {
    const u = ease.inOutQuad(k(36));
    return { pos: v3(lerp(-0.48, -0.42, u), lerp(1.72, 1.66, u), 1.05), at: v3(f.x * 0.55, 1.0, 0.55), fov: 40, focus: 0, aper: 10 };
  }
  // over the slot: settles into plate 1's over pose at 08-32 for the riff
  const end = overPose(OPEN1, LAY.K0832);
  const start: Pose = { pos: v3(-0.13, LAY.YR + 0.5, end.pos.z + 0.14), at: v3(0.0, LAY.YR + 0.06, end.at.z), fov: 40, focus: -1, aper: 12 };
  return mixPose(start, end, ease.inOutCubic(clamp((t - b(40)) / (b(43) - b(40)))));
}

/** The mirror's dolly: continuous through each phrase (from just before its first note to its last flick's landing),
 *  dead still in the held chords. */
function dollyIndex(t: number, notes: number[]) {
  const phrases: [number, number][] = [[0, 3], [4, 10], [11, 13]];
  let g = LAY.K0832;
  for (const [a, z] of phrases) {
    const t0 = notes[a]! - 0.2, t1 = notes[z]! + 0.11;
    const g0 = LAY.K0832 + a, g1 = LAY.K0832 + z + 1;
    if (t < t0) return g;
    if (t <= t1) { const u = (t - t0) / (t1 - t0); return lerp(g0, g1, u * u * (3 - 2 * u) * 0.25 + u * 0.75); }
    g = g1;
  }
  return g;
}

export function mirrorPose(t: number, notes: number[], stop: number): Pose {
  const open = drawerOpen(t, notes, stop);
  const over = overPose(open, dollyIndex(t, notes));
  if (t >= stop) return { ...LOOP_POSE, pos: LOOP_POSE.pos.clone(), at: LOOP_POSE.at.clone() };
  const n = notes[notes.length - 1]! - 0.24;
  if (t <= n) return over;
  return mixPose(over, LOOP_POSE, ease.inOutCubic((t - n) / (stop - n)));
}
