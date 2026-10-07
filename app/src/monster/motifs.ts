// Shared Monster motifs, so they look identical in every plate (docs/MONSTER.md):
//  - the FLAME: the one light in the land of the dead (P(doom)'s spark, as an oil-lamp flame). It breathes with
//    Odysseus' voice and flares on hits; every shadow in the video is cast by it.
//  - SHADOWS: GLSL helpers that cast an occluder mask (anything drawn into a Layer2D) from the flame onto a wall
//    parallel to the screen (a scaled, softened projection) or along the floor (a screen-space ray march).
//  - the MEANDER: the Greek key as one continuous polyline (the "endless" line, the bookend frame).
import * as THREE from 'three';
import { FSPass, rtScale } from '../engine/gl';
import { rgba } from '../engine/palette';
import type { AudioData } from '../engine/audio';
import type { Line, Word } from '../engine/lyrics';
import { F, font, layout, measure, type TextLayout } from '../engine/type';
import { clamp, hash, noise1, prog } from '../engine/util';

// ---------------------------------------------------------------- the flame
/**
 * GLSL: the flame in its own units: q = (px - base) / height with y UP, base of the flame at (0, 0), tip near
 * (0, 1). Returns linear HDR emission (white-hot core, ember body, signal skirt) and coverage in .a.
 * `seed` decorrelates flames; `gust` (-1..1) bends the tip sideways.
 */
export const GLSL_FLAME = /* glsl */ `
vec4 flameAt(vec2 q, float t, float seed, float gust) {
  float y = q.y;
  // the tip wobbles more than the base; a gust bends the whole body
  float wob = (snoise(vec2(y * 2.2 - t * 4.6, seed)) * 0.055 + snoise(vec2(y * 5.3 - t * 8.9, seed + 7.1)) * 0.02) * smoothstep(0.05, 1.0, y) * (0.6 + 0.4 * y);
  float bend = gust * 0.22 * y * y;
  float x = q.x - wob - bend;
  // width profile: a round base (radius 0.17 about y = 0.17) tapering to a point at the tip
  float tip = 1.0 + 0.08 * snoise(vec2(t * 3.1, seed + 2.3));
  float w = y < 0.2 ? 0.2 * sqrt(max(0.0, 1.0 - pow((0.2 - y) / 0.2, 2.0))) : 0.2 * pow(max(0.0, 1.0 - (y - 0.2) / (tip - 0.2)), 0.75);
  float s = abs(x) / max(w, 1e-4);               // 0 on the axis, 1 at the edge
  float body = (1.0 - smoothstep(0.55, 1.0, s)) * step(-0.02, y) * step(y, tip + 0.02);
  // heat: hottest low on the axis (the core), cooling to the edge and the tip
  float core = (1.0 - smoothstep(0.0, 0.5, s)) * (1.0 - smoothstep(0.08, 0.55, y)) * step(0.0, y);
  float heatv = clamp(0.35 + 0.65 * (1.0 - s) * (1.0 - 0.55 * y), 0.0, 1.0);
  vec3 col = mix(C_BLOOD * 1.5, C_SIGNAL * 2.2, smoothstep(0.1, 0.5, heatv));
  col = mix(col, C_EMBER * 3.2, smoothstep(0.5, 0.85, heatv));
  col = mix(col, vec3(6.0, 5.1, 4.0), core);
  // the blue root of a real wick flame, kept to a faint darker band at the base (no other hues)
  col *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.07, y)) * step(0.0, y);
  // a soft skirt of light around the body (bloom does the rest)
  float d = max(s - 1.0, 0.0) * max(w, 0.05) + max(-y, 0.0) + max(y - tip, 0.0);
  float halo = exp(-d * 9.0) * (1.0 - body) * 0.35;
  return vec4(col * body + C_SIGNAL * 1.4 * halo, max(body, halo));
}`;

/** Per-frame state of a flame: its height multiplier (it breathes with the voice), brightness and gust. */
export interface FlameState { h: number; I: number; gust: number }

/**
 * The flame's breath at time t: height and brightness follow the lead vocal (Odysseus' voice is the flame),
 * flicker on a slow noise, flare on orchestral hits; `seed` decorrelates several flames.
 */
export function flameState(au: AudioData, t: number, seed = 0, o: { voice?: number; flare?: number } = {}): FlameState {
  const v = au.env('vocal', t), hit = au.hit('orch', t, 0.18) + 0.6 * au.hit('kick', t, 0.12);
  const flick = 0.5 + 0.5 * noise1(t * 7.3, 11 + seed) * noise1(t * 3.1, 17 + seed);
  const voice = o.voice ?? 1, flare = o.flare ?? 1;
  return {
    h: 0.82 + 0.22 * voice * v + 0.12 * flick + 0.25 * flare * hit,
    I: 0.85 + 0.25 * voice * v + 0.1 * flick + 0.6 * flare * hit,
    gust: 0.6 * noise1(t * 0.9, 23 + seed) + 0.3 * noise1(t * 4.7, 29 + seed),
  };
}

/** Pixel radius around a flame of height h that its sprite covers (body plus halo). */
const flameExtent = (h: number) => ({ w: h * 0.9, up: h * 1.35, down: h * 0.35 });

/**
 * Draws flames additively into a target, each only inside its own scissor box (a flame is small: a
 * fullscreen pass per flame would shade the whole frame for a few hundred pixels).
 */
export class FlameSprite {
  private pass = new FSPass(/* glsl */ `
    uniform vec2 base; uniform float height, t, seed, gust, inten;
    ${GLSL_FLAME}
    void main() {
      vec2 px = FRAG_PX;                       // logical px, y up
      vec2 q = (px - base) / height;
      vec4 f = flameAt(q, t, seed, gust);
      fragColor = vec4(f.rgb * inten, 0.0);
    }`, { base: { value: new THREE.Vector2() }, height: { value: 60 }, t: { value: 0 }, seed: { value: 0 }, gust: { value: 0 }, inten: { value: 1 } },
  { blending: THREE.CustomBlending, transparent: true });

  constructor() {
    const m = this.pass.mat;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor;
    m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
  }

  /** (x, y): base of the flame in logical px, y DOWN (Canvas convention); h: height in px. */
  draw(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, x: number, y: number, h: number, t: number, o: { seed?: number; gust?: number; intensity?: number } = {}) {
    const s = rtScale(out), H = out.height / s;
    const u = this.pass.u;
    (u.base!.value as THREE.Vector2).set(x, H - y);
    u.height!.value = h; u.t!.value = t; u.seed!.value = o.seed ?? 0; u.gust!.value = o.gust ?? 0; u.inten!.value = o.intensity ?? 1;
    const e = flameExtent(h);
    const x0 = Math.floor((x - e.w) * s), y0 = Math.floor((H - y - e.down) * s);
    const w = Math.ceil(2 * e.w * s), hh = Math.ceil((e.up + e.down) * s);
    out.scissor.set(Math.max(0, x0), Math.max(0, y0), Math.max(1, w), Math.max(1, hh));
    out.scissorTest = true;
    this.pass.render(renderer, out);
    out.scissorTest = false;
  }
}

/** GLSL: the flame's light on a surface point (px, logical, y up) for a flame base at `base` of height h: inverse-square-ish falloff. */
export const GLSL_FLAME_LIGHT = /* glsl */ `
float flameLight(vec2 px, vec2 base, float h, float reach) {
  vec2 c = base + vec2(0.0, h * 0.35);        // the light sits in the flame's body, not at its base
  float d = length(px - c) / reach;
  return 1.0 / (1.0 + d * d * 6.0);
}`;

// ---------------------------------------------------------------- shadows
/**
 * GLSL: a shadow on a wall parallel to the screen. `mask` holds the occluders (alpha) as drawn on screen; a
 * point light at `L` (uv) projects them onto the wall scaled by `k` (> 1: the wall is behind the occluders,
 * the shadow is bigger). The light's size softens the edge: `soft` (uv) jitters the light over 8 taps.
 * Returns occlusion 0..1 at uv.
 */
export const GLSL_WALL_SHADOW = /* glsl */ `
float wallShadow(sampler2D mask, vec2 uv, vec2 L, float k, float soft, vec2 aspect) {
  float occ = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 2.39996 + 0.7;
    vec2 j = vec2(cos(a), sin(a)) * soft * sqrt((float(i) + 0.5) / 8.0) / aspect;
    vec2 Lj = L + j;
    vec2 src = Lj + (uv - Lj) / k;              // the occluder point that throws its shadow here
    if (src.x < 0.0 || src.x > 1.0 || src.y < 0.0 || src.y > 1.0) continue;
    occ += texture(mask, src).a;
  }
  return occ / 8.0;
}`;

/**
 * GLSL: shadows along the floor from a light at `L` (uv): march from uv back toward the light through the
 * occluder mask; anything between this point and the light occludes it (soft by `soft`, `steps` taps).
 */
export const GLSL_FLOOR_SHADOW = /* glsl */ `
float floorShadow(sampler2D mask, vec2 uv, vec2 L, int steps, float reach) {
  float occ = 0.0;
  vec2 d = L - uv;
  float n = float(steps);
  for (int i = 1; i <= 64; i++) {
    if (i > steps) break;
    float f = float(i) / n;
    if (f * length(d) > reach) break;
    occ = max(occ, texture(mask, uv + d * f).a * (1.0 - 0.6 * f));
  }
  return occ;
}`;

// ---------------------------------------------------------------- the meander
type P2 = { x: number; y: number };

/** GLSL: distance (cell units) to the Greek key's unit (5 cells along, 4 across) drawn as one polyline. */
export const GLSL_KEY_DIST = /* glsl */ `
    // the Greek key's unit (5 cells along, 4 across) as one polyline; distance in cell units
    float keyDist(vec2 p) {
      vec2 P[11];
      P[0] = vec2(0.0, 4.0); P[1] = vec2(0.0, 0.0); P[2] = vec2(4.0, 0.0); P[3] = vec2(4.0, 3.0); P[4] = vec2(2.0, 3.0);
      P[5] = vec2(2.0, 2.0); P[6] = vec2(3.0, 2.0); P[7] = vec2(3.0, 1.0); P[8] = vec2(1.0, 1.0); P[9] = vec2(1.0, 4.0); P[10] = vec2(5.0, 4.0);
      float d = 1e9;
      for (int k = 0; k < 10; k++) d = min(d, sdSegment(p, P[k], P[k + 1]));
      // the neighbouring units' ends meet this one's (continuous line)
      d = min(d, sdSegment(p, vec2(-1.0, 4.0), vec2(0.0, 4.0)));
      return d;
    }`;

/**
 * The Greek key as one continuous polyline across a band from x0 to x1 at height y (top edge), band height h.
 * Each unit is the classic single-stroke key: up, over, down, back, in (a hook), then on to the next unit.
 */
export function meanderBand(x0: number, x1: number, y: number, h: number): P2[] {
  const g = h / 4; // the key's grid: 4 cells high, 5 cells per unit
  const unit = [
    [0, 4], [0, 0], [4, 0], [4, 3], [2, 3], [2, 2], [3, 2], [3, 1], [1, 1], [1, 4], [5, 4],
  ];
  const n = Math.max(1, Math.floor((x1 - x0) / (5 * g)));
  const ox = x0 + ((x1 - x0) - n * 5 * g) / 2;
  const pts: P2[] = [];
  for (let k = 0; k < n; k++) for (const [ux, uy] of unit) {
    const p = { x: ox + (k * 5 + ux!) * g, y: y + uy! * g };
    const last = pts[pts.length - 1];
    if (!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.y - p.y) > 1e-6) pts.push(p);
  }
  return pts;
}

/** A meander running all the way round a rectangle (the bookend frame): four bands laid inward along the edges. */
export function meanderFrame(x: number, y: number, w: number, h: number, band: number): P2[][] {
  const side = (len: number) => meanderBand(0, len, 0, band);
  // each band runs along its edge in the frame's clockwise direction, its key pattern on the inner side
  const place = (pts: P2[], ox: number, oy: number, a: number) =>
    pts.map((p) => ({ x: ox + p.x * Math.cos(a) - p.y * Math.sin(a), y: oy + p.x * Math.sin(a) + p.y * Math.cos(a) }));
  return [
    place(side(w), x, y, 0),
    place(side(h), x + w, y, Math.PI / 2),
    place(side(w), x + w, y + h, Math.PI),
    place(side(h), x, y + h, -Math.PI / 2),
  ];
}

/** Deterministic ember particles rising from a flame (2D, for Canvas or LineBatch drawing). */
export function embers(t: number, x: number, y: number, h: number, rate = 6, seed = 1): { x: number; y: number; a: number; r: number }[] {
  const out = [];
  const life = 1.6;
  const n0 = Math.floor((t - life) * rate), n1 = Math.floor(t * rate);
  for (let n = n0; n <= n1; n++) {
    const tb = n / rate, age = t - tb;
    if (age < 0 || age > life * (0.5 + 0.5 * hash(n, seed))) continue;
    const k = age / life;
    const dx = (hash(n, seed + 1) - 0.5) * h * 0.6 + Math.sin(age * 3 + n) * h * 0.15 * k;
    out.push({ x: x + dx, y: y - h * (0.7 + 2.2 * k * (0.6 + 0.4 * hash(n, seed + 2))), a: clamp(1 - k) ** 1.5, r: 0.8 + 1.2 * hash(n, seed + 3) });
  }
  return out;
}


// ---------------------------------------------------------------- the lamp
/** Size of the floating clay oil lamp (logical px) and where its flame sits relative to the body's centre. */
export const LAMP_BODY = { w: 92, h: 26, nozzle: { x: 0.64, y: -0.12 } };

/**
 * The clay oil lamp the flame burns in once it is set on the water: a low round bowl with a nozzle to the
 * right and a ring handle to the left, lit by its own flame along the rim. Canvas2D, centred at (x, y).
 */
export function drawLamp2D(c: CanvasRenderingContext2D, x: number, y: number, alpha = 1) {
  const { w, h } = LAMP_BODY;
  c.save();
  c.globalAlpha *= alpha;
  c.translate(x, y);
  c.beginPath();
  c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  c.moveTo(w * 0.35, -h * 0.28); c.quadraticCurveTo(w * 0.62, -h * 0.34, w * 0.66, -h * 0.05);
  c.quadraticCurveTo(w * 0.62, h * 0.22, w * 0.35, h * 0.18);
  const g = c.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, rgba('blood', 0.95)); g.addColorStop(0.45, rgba('ink2', 1)); g.addColorStop(1, rgba('ink', 1));
  c.fillStyle = g;
  c.fill();
  c.beginPath(); c.ellipse(-w * 0.52, -h * 0.05, 9, 7, 0, 0, Math.PI * 2);
  c.strokeStyle = rgba('ink2', 1); c.lineWidth = 4; c.stroke();
  c.beginPath(); c.ellipse(0, -h * 0.18, w * 0.47, h * 0.3, 0, Math.PI * 1.05, Math.PI * 1.95);
  c.strokeStyle = rgba('ember', 0.9); c.lineWidth = 2.2; c.stroke();
  c.beginPath(); c.ellipse(-w * 0.06, -h * 0.12, 9, 3.5, 0, 0, Math.PI * 2);
  c.fillStyle = rgba('ink', 1); c.fill();
  c.restore();
}

/** Where the flame stands for a lamp body centred at (x, y). */
export const lampFlame = (x: number, y: number) => ({ x: x + LAMP_BODY.w * LAMP_BODY.nozzle.x, y: y + LAMP_BODY.h * LAMP_BODY.nozzle.y });
