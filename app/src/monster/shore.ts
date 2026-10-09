// The shore (hook 1 and chorus 1, `mirror`): black mirror water, wine-dark, lit by the fire behind us; the far
// shore is the line, a bone hairline, and the horizon. A hero word stands lit on the waterline with no mirror image
// of its own; when the water answers, the answer is painted under the surface right way round, in black-figure
// (black slip, incised contour) on the clay's orange developing in the water, rippling with the swell (client,
// 2026-10-08: "the answer under the surface"). Shared by `scenes/hook.ts` (n=1, 2) and `scenes/c1-lookback.ts`.
import * as THREE from 'three';
import { W, H } from '../engine/gl';
import { F } from '../engine/type';
import { prog } from '../engine/util';
import { SHORE, Stage, Word3D, popHinge, type Letter } from './stage';

/** Hero words stand on the water just short of the shore line. */
export const WORD_Z = SHORE.z + 0.4;
/** The camera after the dip: just over the water, nearly level (the waterline at 0.536 H), a little closer. */
export const LOW = { y: 0.055, z: 8.4, pitch: 0.0262 };
/** A hero word's width in frame (MONSTER?) after the dip, and the voice's cap height (world) and place afloat near us. */
export const BIG_W = 0.72, VOICE = { cap: 0.13, x0: -1.2, z: 6.4 };
/** The vertical field of view on the shore (degrees). */
export const FOV = 40;
const HALF = Math.PI / 2;

/** The shore's surface hooks. `extra` (GLSL) may define SHORE_FIELD with fieldPaint(q, col) (paintings under the
 *  surface on clay of their own; q is the swell-bent screen point, GL px, y up) and SHORE_SKY with skyPaint(px, col)
 *  (above the line); `fieldBot` (GL px, y up; < 0 off) ends the answer's clay field above that line, so the small
 *  words afloat below it stay on the black water. */
export const shoreHooks = (extra = '') => /* glsl */ `
#define WATER_HOOK
#define REFL_KEEP
uniform float shoreZ, skyI, develop, wordL, wordR, wordB, wordH, creep, fieldBot;
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) { return 0.0; }
/** The clay's orange as the water shows it (q: screen px of the mirrored image, depth below the word's foot). */
vec3 clayField(vec2 q, float depth) {
  return mix(C_SIGNAL * 0.6, C_EMBER * 0.62, 0.2 + 0.2 * snoise(vec2(q.x / 500.0, depth / 200.0)));
}
${extra}
/** (n=2) The orange climbing a little above the line behind the word. */
vec3 creepUp(vec3 col) {
#ifdef SHORE_SKY
  col = skyPaint(FRAG_PX, col);
#endif
  if (creep <= 0.0) return col;
  vec2 px = FRAG_PX;
  float up = px.y - wordB;
  float across = smoothstep(wordL - 90.0, wordL + 30.0, px.x) * (1.0 - smoothstep(wordR - 30.0, wordR + 90.0, px.x));
  return mix(col, clayField(px, 0.0), creep * across * exp(-max(up, 0.0) / (0.35 * wordH)) * 0.6);
}
// the far shore: a last trace of its burning, low over the horizon (as \`sea\` leaves it)
vec3 skyTint(vec3 D, vec3 col) {
  float e = max(D.y, 0.0);
  return creepUp(col + mix(C_BLOOD, C_SIGNAL, 0.45) * skyI * (0.6 * exp(-e * 30.0) + 0.06 * exp(-e * 9.0)));
}
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  if (wall) return col;
  // the water ends at the far shore, and the shore is the line, a bone hairline, and the horizon: beyond it the
  // ground takes the sky's own colour, so no black sliver opens between the line and the sky's glow
  float beyond = smoothstep(shoreZ + 0.02, shoreZ - 0.02, P.z);
  // (the glow keeps within a few px of the line: gPix grows without bound toward the true horizon, which without the
  // second term lit up as a faint second line whenever the camera stands above the water)
  float dzS = camPos.z - shoreZ, gS = dzS * dzS / (max(camPos.y, 1e-3) * 1484.0);
  float lineG = exp(-abs(P.z - shoreZ) / max(0.06, gPix * 1.5)) * exp(-abs(P.z - shoreZ) / (6.0 * gS + 1.0));
  col = mix(col, skyTint(normalize(P - camPos), C_INK), beyond);
  return col + C_BONE * 0.8 * lineG;
}
// the water answers: under the word it develops the clay's orange, and the answer (a word only the mirrored render
// holds, posed to read right way round: black slip, its contour incised) shows on it at full strength; deeper down
// the swell breaks the clay into strips
vec3 waterHook(vec2 px, vec2 ruv, vec4 rt, vec3 col) {
  vec2 q = ruv * vec2(${W.toFixed(1)}, ${H.toFixed(1)});      // where the swell has moved what this point mirrors
#ifdef SHORE_FIELD
  col = fieldPaint(q, col);
#endif
  if (develop <= 0.0) return col;
  float depth = wordB - q.y;
  if (depth < -4.0) return col;
  float t = stageT;
  float edgeN = 26.0 * snoise(vec2(depth / 30.0, t * 0.4));
  float across = smoothstep(wordL - 70.0, wordL + 10.0, q.x + edgeN) * (1.0 - smoothstep(wordR - 10.0, wordR + 70.0, q.x + edgeN));
  float down = smoothstep(-4.0, 2.0, depth) * (1.0 - smoothstep(wordH * 0.9, wordH * 2.3, depth + edgeN * 0.5));
  float band = sin(depth * 0.21 - t * 1.7 + 0.6 * snoise(vec2(q.x / 260.0, t * 0.35)));
  float strips = mix(1.0, smoothstep(-0.35, 0.55, band), smoothstep(wordH * 0.75, wordH * 1.3, depth));
  float field = develop * across * down * strips * (0.9 + 0.1 * band);
  if (fieldBot >= 0.0) field *= smoothstep(fieldBot - 24.0, fieldBot + 24.0, px.y);
  col = mix(col, clayField(q, depth), field);
  return mix(col, rt.rgb, sat(rt.a * 2.0) * smoothstep(0.08, 0.35, field));
}`;

/** The shore's stage (its hooks and their uniforms). */
export function shoreStage(extra = '', uniforms: Record<string, THREE.IUniform> = {}) {
  return new Stage({
    hooks: shoreHooks(extra),
    uniforms: {
      shoreZ: { value: SHORE.z }, skyI: { value: 0.06 }, develop: { value: 0 }, creep: { value: 0 },
      wordL: { value: 0 }, wordR: { value: W }, wordB: { value: 0 }, wordH: { value: 150 }, fieldBot: { value: -1 },
      ...uniforms,
    },
  });
}

/** The surfaces and render options of the shore (the water mirrors, wine-dark, its swells bending what it mirrors). */
export const SHORE_SURF = { wall: 0 as const, gloss: 0.75, swell: 0.45, wine: 0.85, reflBend: 0.3 };
export const SHORE_OPTS = { noFlame: true, cards: false, rim: 1.0, spec: 0.05 };
export const SHORE_KEY = { seed: 21, I: 1.3, reach: 25 };
export const SHORE_POST = { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35 };

/** The hero words' face: Archivo condensed-black, as hook 1's MONSTER?. */
export const heroFont = () => F.archivo(112.5, 900);

/** World units per font px for a hero word: MONSTER? (`ref`) fills BIG_W of the frame from the low camera. */
export function heroScale(ref: Word3D) {
  const dist = LOW.z - WORD_Z;
  return (BIG_W * 2 * dist * Math.tan((FOV * Math.PI) / 360) * (W / H)) / ref.width;
}

/** The low camera's slow push after hook 1's dip (hook 1: from `tD1` to its end `T1`, running on into `mirror`). */
export function lowPushZ(t: number, tD1: number, T1: number) {
  return LOW.z - 0.3 * prog(t, tD1, T1 + 0.6);
}

/** A letter nearly flat (rising or folding) is hidden: the low camera sees its lit top as a block on the water. */
export function hideFlat(w: Word3D, limit = 1.2) {
  for (const l of w.letters) if (l.hinge > limit) l.on = 0;
  w.update();
}

/** Places a phrase afloat in a row starting at (x0, z0), bobbing on the swell, each letter facing the camera. */
export function bob(t: number, cam: THREE.Vector3, x0: number, z0: number, cap: number, w: Word3D, amp: number) {
  return (l: Letter) => {
    const sc = cap / w.cap;
    l.x = x0 + l.penX * sc; l.z = z0; l.s = sc;
    l.y = amp * Math.sin(t * 2.1 + l.penX * 0.004 + z0);
    l.yaw = Math.atan2(cam.x - (x0 + (w.width * sc) / 2), cam.z - z0);
  };
}

/** Sets the water's answer region (where the clay's orange develops under the word). */
export function setRegion(st: Stage, b: { L: number; R: number; B: number; H: number }) {
  const u = st.bg.u;
  u.wordL!.value = b.L; u.wordR!.value = b.R; u.wordB!.value = b.B; u.wordH!.value = b.H;
}

/**
 * The water's answer: a word in black slip with its contour incised, painted right way round under the surface. It
 * exists only in the mirrored render (the floor shader shows that render on the clay field): there its letters are
 * turned upside down above the water (hinge pi) so that the mirror sets them upright below it. They unfold from the
 * deep on the onset (the hinge runs from flat to pi). Hidden in the direct render.
 */
export class Answer {
  readonly w: Word3D;
  constructor(st: Stage, text: string) {
    this.w = new Word3D(text.toUpperCase().replace(/[^A-Z]/g, ''), heroFont(), { size: 220, incise: true });
    for (const l of this.w.letters) { l.mat.uniforms.bf!.value = 1; l.mat.side = THREE.DoubleSide; }
    st.add(this.w, { shadows: false });
    this.hide();
  }
  /** The direct render never shows it. */
  hide() { for (const l of this.w.letters) l.on = 0; this.w.update(); }
  /** Poses it for the mirrored render: centred at x, `s` world units per font px, unfolding from `on`, its top `gap`
   *  (world) under the surface and sunk a further `sink`. */
  pose(t: number, x: number, s: number, on: number, gap: number, sink = 0) {
    const w = this.w;
    w.letters.forEach((l, k) => {
      l.x = x + (l.penX - w.width / 2) * s; l.z = WORD_Z; l.yaw = 0; l.s = s;
      l.hinge = Math.PI - popHinge(t, on, k);
      l.y = w.cap * s + gap + sink;
      l.on = l.hinge > HALF + 0.35 ? 1 : 0;
    });
    w.update();
  }
  /** Its clay field on screen (GL px, y up): across its ink, from the waterline, as deep as the word and its gap. */
  box(st: Stage, x: number, s: number, gap: number) {
    const w = this.w, sc = st.cam;
    const xL = Math.min(...w.letters.map((l) => x + (l.penX - w.width / 2 + l.box[0]) * s));
    const xR = Math.max(...w.letters.map((l) => x + (l.penX - w.width / 2 + l.box[2]) * s));
    const pL = sc.project({ x: xL, y: 0, z: WORD_Z }), pR = sc.project({ x: xR, y: 0, z: WORD_Z });
    const pB = sc.project({ x, y: 0, z: WORD_Z }), pT = sc.project({ x, y: w.cap * s + gap, z: WORD_Z });
    return { L: pL.x, R: pR.x, B: H - pB.y, H: Math.max(1, pB.y - pT.y) };
  }
}
