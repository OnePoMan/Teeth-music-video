// `cyclops` helper: small type-staging tools adapted from the kit (stage.ts' row/popWords, hook.ts' hideFlat).
// Kit candidates (move into stage.ts once the chorus 1 branch is merged): `centredRow`, `hideFlat`, `phrases`.
import type { Letter, Word3D } from '../stage';
import type { Line, Word } from '../../engine/lyrics';

/** A row of letters standing on the floor, centred on (cx, cz), facing `yaw` (0: +z, toward the camera). */
export function centredRow(w: Word3D, cx: number, cz: number, yaw: number, s: number, y = 0) {
  const dx = Math.cos(yaw), dz = -Math.sin(yaw), half = (w.width * s) / 2;
  return (l: Letter) => {
    const u = l.penX * s - half;
    l.x = cx + dx * u; l.z = cz + dz * u; l.y = y; l.yaw = yaw; l.s = s;
  };
}

/** On a camera above the floor a nearly flat letter shows its lit top as a block: hide letters folded past `max`. */
export function hideFlat(w: Word3D, max = 1.2) {
  for (const l of w.letters) if (l.hinge > max) l.on = 0;
  w.update();
}

/** The yaw that turns a word at (x, z) to face a camera at (cx, cz). */
export function faceYaw(x: number, z: number, cx: number, cz: number) {
  return Math.atan2(cx - x, cz - z);
}

/** A line split into phrases of word indices (the hero alone in its own group). */
export interface Phrase { words: Word[]; text: string; hero: boolean }
export function phrases(line: Line, groups: number[][], hero: number): Phrase[] {
  return groups.map((g) => ({
    words: g.map((i) => line.words[i]!),
    text: g.map((i) => line.words[i]!.w).join(' '),
    hero: g.length === 1 && g[0] === hero,
  }));
}
