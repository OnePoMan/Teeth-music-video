// Teeth palette (docs/TEETH.md): ink, enamel, one glowing red; wine for its shadows and a rare rose.
import { hexToLinear } from '../engine/util';

export const T = {
  ink: '#09080A',
  ink2: '#151214',
  graphite: '#5A5352',
  ash: '#9A918C',
  enamel: '#F0EBE1',
  dentin: '#D9CBB0', // warm shading of teeth and paper
  red: '#FF1B2D', // the bite, the sung word, blood (the only colour that glows)
  wine: '#7A0A17', // dried blood, shadows of red
  rose: '#FF8FA8', // tender accent: sweet, pretty, butterflies, the rose
} as const;
export type TKey = keyof typeof T;

/** Linear RGB triplets for GL uniforms. */
export const TL: Record<TKey, [number, number, number]> = Object.fromEntries(
  Object.entries(T).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<TKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function tc(key: TKey | string, a = 1): string {
  const hex = (T as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Mix two palette colours in sRGB (for Canvas2D). */
export function tmix(a: TKey, b: TKey, k: number, alpha = 1): string {
  const pa = parseInt(T[a].slice(1), 16), pb = parseInt(T[b].slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * Math.max(0, Math.min(1, k)));
  return `rgba(${m(16)},${m(8)},${m(0)},${alpha})`;
}

const v3 = (c: [number, number, number]) => `vec3(${c.map((x) => x.toFixed(5)).join(',')})`;
/** GLSL constants for Teeth shaders (prepend to an FSPass body). */
export const TEETH_GLSL = /* glsl */ `
const vec3 T_INK = ${v3(TL.ink)};
const vec3 T_INK2 = ${v3(TL.ink2)};
const vec3 T_GRAPHITE = ${v3(TL.graphite)};
const vec3 T_ASH = ${v3(TL.ash)};
const vec3 T_ENAMEL = ${v3(TL.enamel)};
const vec3 T_DENTIN = ${v3(TL.dentin)};
const vec3 T_RED = ${v3(TL.red)};
const vec3 T_WINE = ${v3(TL.wine)};
const vec3 T_ROSE = ${v3(TL.rose)};
/** red heat ramp: 0 ink, 0.4 wine, 0.7 red, 1 white-hot */
vec3 tHeat(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 c = mix(T_INK, T_WINE, smoothstep(0.0, 0.4, x));
  c = mix(c, T_RED, smoothstep(0.35, 0.7, x));
  return mix(c, vec3(1.0, 0.75, 0.7), smoothstep(0.82, 1.0, x));
}
`;

/** Post overrides shared by every Teeth plate: red halation, restrained bloom, a little more grain. */
export const TEETH_POST = { halationTint: [1.0, 0.04, 0.05] as [number, number, number], halation: 0.3, grain: 0.06, ca: 0.6 };
