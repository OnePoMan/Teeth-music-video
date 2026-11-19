// Teeth v2 palette 2A, "Lightbox / UV" (docs/TEETH2.md, Palette). Values are tuned on the gate 2 stills.
// Limits (binding): uv and fluor only in plate 6 (`uv`), luminol only in plate 11 (`luminol`), match (red) only
// from 165.16 to the folder closing (~186 s). Only uv, fluor, luminol and match may glow (> ~0.85 linear).
import { hexToLinear } from '../engine/util';

export const T_HEX = {
  film: '#070A10', // the ground: blue-black radiograph film base
  film2: '#0F1520', // panels, deep shadow
  silver: '#6E7682', // silver-halide mid-grey, hairlines
  halide: '#A9B0B8', // light grey: unsung type, film detail
  lightbox: '#F1F3EE', // cold white: lightbox, paper, type; crisp, never blooms
  uv: '#6A2CFF', // UV violet: plate 6 only, only where the lamp is on
  fluor: '#CFF4FF', // fluorescent blue-white: what glows under UV (plate 6)
  luminol: '#3FA9FF', // luminol blue: plate 11 only
  wax: '#E58FA0', // baseplate-wax pink: the tender register (sweet, pretty, rose, wife)
  stone: '#E8C35A', // dental-stone yellow: the casts (plates 9, 10, 13)
  match: '#FF2A1F', // red: from "teeth" at 165.16 only
  tungsten: '#FFB46A', // warm-lamp VARIANT for the gate 2 sheet only (taste call 4); not in the edit unless approved
} as const;

export type TKey = keyof typeof T_HEX;

/** Linear RGB triplets for GL uniforms. */
export const T_LIN: Record<TKey, [number, number, number]> = Object.fromEntries(
  Object.entries(T_HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<TKey, [number, number, number]>;

/** CSS rgba() for Canvas2D (sRGB, as the hex). */
export function trgba(key: TKey, a = 1): string {
  const n = parseInt(T_HEX[key].replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const v3 = (c: [number, number, number]) => `vec3(${c.map((x) => x.toFixed(5)).join(',')})`;

/** GLSL constants T_FILM, T_FILM2, … (linear). Prepend to a shader after GLSL_COMMON. */
export const GLSL_TEETH_PALETTE = Object.entries(T_LIN)
  .map(([k, c]) => `const vec3 T_${k.toUpperCase()} = ${v3(c)};`)
  .join('\n');
