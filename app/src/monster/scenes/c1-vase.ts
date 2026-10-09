// `vase` — chorus 1, line 11 (GUILT?, 54.02–59.355): the funeral vase. A giant Geometric funeral krater (the Dipylon
// grave-marker) stands on the black-glaze floor in the fire's low light, a real 3D object; the camera makes one slow,
// steady pass round it along its figure band. Bands of zigzags and meanders; the prothesis frieze, all of it painted
// from the start: one unbroken procession of identical mourners in long robes, heads bowed, a hand raised to the head,
// walking to the right round the band past the other dead on their biers (plain black shrouds with an incised border)
// to Polites: the largest bier, lying at rest with his arms open low at his sides, palms up, in a pool of warm light at
// the band's end. The camera comes to rest on him by ~58.35 with the rim above him in shot and holds there to the cut.
// The krater has a deep body on a tall pedestal foot and two double strap handles (black glaze, thin reserved lines
// along them) at the shoulder. The small phrases pop on the rim as sung; GUILT? stands on the rim right above Polites
// on 58.42.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { F } from '../../engine/type';
import type { Line } from '../../engine/lyrics';
import { clamp } from '../../engine/util';
import { GLSL_SHADE } from '../motifs';
import { Stage, Word3D, keyLight, popWords, type Letter } from '../stage';
import { heroFont } from '../shore';

const FOV = 40, TANF = Math.tan((FOV * Math.PI) / 360);
/** The krater's scale, the frieze (bottom y, height), the band's reference radius (arc length = angle x R_BAND). */
const VS = 1.6, FRZ = { y: 4.1 * VS, h: 1.3 }, R_BAND = 6.3;
/** The rim: its top (y) and radius. */
const RIM = { y: 6.42 * VS, r: 3.75 * VS };
/** Polites's place along the band (frieze heights), and as arc length. */
const POL_X = 6.15 * 1.95, POL_U = POL_X * FRZ.h;
/** The procession: its step (frieze heights), the mourners' height, the leader's distance from Polites's centre. */
const MSTEP = 0.42, MH = 0.86, LEAD = 1.0, PS = 1.2;
/** The camera's pass: from U0 at T0, steady, easing to rest on Polites from TB to TE, then still. */
const U0 = -5.0, T0 = 54.0, TB = 57.15, TE = 58.35;

/** The krater's profile (unscaled r, y): a tall trumpet foot, a collar, the deep body, shoulder, neck and lip; then
 * the inside of the bowl. */
const PROFILE: [number, number][] = [
  [0.0, 0.0], [2.1, 0.0], [2.1, 0.1], [1.95, 0.22], [1.55, 0.6], [1.2, 1.1], [1.02, 1.6], [0.98, 1.9], [1.16, 1.98],
  [1.16, 2.07], [1.0, 2.13], [1.6, 2.22], [2.5, 2.45], [3.25, 2.9], [3.7, 3.45], [3.92, 4.1], [3.95, 4.55],
  [3.88, 5.0], [3.68, 5.45], [3.55, 5.72], [3.6, 6.08], [3.74, 6.3], [3.82, 6.38], [3.75, 6.42],
  [3.6, 6.38], [3.42, 6.0], [3.45, 5.0], [3.4, 4.0], [2.6, 3.0], [0.0, 2.7],
];
const LIP_I = 23;
/** The handles (unscaled r, y): a strap loop standing out from the shoulder, two side by side at each side. */
const HANDLE: [number, number][] = [[3.6, 5.12], [4.25, 5.2], [4.62, 5.55], [4.45, 5.92], [3.55, 5.86]];

const VASE_VERT = /* glsl */ `
precision highp float;
in vec3 position; in vec3 normal; in vec2 uv;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
out vec3 vW; out vec3 vN; out vec3 vL; out float vIn; out float vU;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = mat3(modelMatrix) * normal; vL = position; vIn = uv.y; vU = uv.x;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const VASE_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec3 vW; in vec3 vN; in vec3 vL; in float vIn; in float vU;
out vec4 fragColor;
${GLSL_COMMON}
uniform vec3 Lc, camP, poolP, poolC; uniform float LI, reach, phi, inner0, handle, keyK, poolI, poolR;
float hash1(float n) { return fract(sin(n * 127.1 + 3.7) * 43758.5453); }
${GLSL_SHADE}
// the Greek key: two rules and a running meander between them (b: x along, y down from the band's top; bh its height)
float meanderSeg(vec2 u) {
  float d = sdSegment(u, vec2(0.0, 0.0), vec2(0.0, 3.0));
  d = min(d, sdSegment(u, vec2(0.0, 3.0), vec2(3.0, 3.0)));
  d = min(d, sdSegment(u, vec2(3.0, 3.0), vec2(3.0, 1.0)));
  d = min(d, sdSegment(u, vec2(3.0, 1.0), vec2(1.0, 1.0)));
  d = min(d, sdSegment(u, vec2(1.0, 1.0), vec2(1.0, 0.0)));
  d = min(d, sdSegment(u, vec2(1.0, 0.0), vec2(4.0, 0.0)));
  return d;
}
float band(vec2 b, float bh) {
  float g = bh / 5.6;
  float d = min(abs(b.y - 0.25 * g), abs(b.y - bh + 0.25 * g)) - 0.2 * g;
  vec2 u = vec2(b.x / g, (bh - 1.3 * g - b.y) / g);
  float ux = mod(u.x, 4.0);
  d = min(d, (min(meanderSeg(vec2(ux, u.y)), meanderSeg(vec2(ux - 4.0, u.y))) - 0.24) * g);
  return 1.0 - smoothstep(-0.8, 0.8, d);
}
// a zigzag line between two rules (b: x along, y down from the band's top, px; bh its height)
float zigzag(vec2 b, float bh, float per) {
  float g = bh / 5.6;
  float d = min(abs(b.y - 0.25 * g), abs(b.y - bh + 0.25 * g)) - 0.2 * g;
  float x = b.x / per, tri = abs(fract(x) - 0.5) * 2.0;
  float h = bh - 2.4 * g, yy = 1.2 * g + tri * h;
  float sl = 2.0 * h / per;
  d = min(d, abs(b.y - yy) / sqrt(1.0 + sl * sl * 4.0) - 0.22 * g);
  return 1.0 - smoothstep(-0.8, 0.8, d);
}
// a mourner in profile, walking to the right: tall and thin, a long robe to the ankles, the head bowed, the near hand
// raised to the head, the far arm hanging at the side (units of its height, feet at the origin)
float mourner(vec2 p) {
  vec2 hc = vec2(0.068, 0.885);
  float d = length((p - hc) * vec2(0.92, 1.0)) - 0.05;                                 // the head, bowed forward
  d = min(d, sdSegment(p, vec2(0.0, 0.79), vec2(0.048, 0.86)) - 0.02);                // the neck
  float y = p.y;
  float hw = y > 0.6 ? mix(0.04, 0.055, sat((y - 0.6) / 0.19)) : mix(0.072, 0.04, sat((y - 0.035) / 0.565));
  float robe = max(abs(p.x - 0.015 * (y - 0.4)) - hw, max(y - 0.8, 0.022 - y));       // the robe, a touch forward
  d = min(d, robe * 0.95);
  d = min(d, sdSegment(p, vec2(-0.02, 0.785), vec2(0.03, 0.785)) - 0.024);            // the shoulders
  d = min(d, sdSegment(p, vec2(0.03, 0.014), vec2(0.105, 0.014)) - 0.013);            // the feet, one a step ahead
  d = min(d, sdSegment(p, vec2(-0.075, 0.014), vec2(-0.02, 0.014)) - 0.012);
  d = min(d, sdSegment(p, vec2(0.03, 0.775), vec2(0.15, 0.82)) - 0.015);                // the near arm raised,
  d = min(d, sdSegment(p, vec2(0.15, 0.82), vec2(0.09, 0.935)) - 0.013);               // the hand laid on the head
  d = min(d, length(p - vec2(0.075, 0.94)) - 0.019);
  d = min(d, sdSegment(p, vec2(-0.04, 0.77), vec2(-0.1, 0.47)) - 0.014);               // the far arm hanging
  d = min(d, length(p - vec2(-0.103, 0.455)) - 0.017);
  return d;
}
// a plain black shroud with a thin line incised round its border, back to the clay (sp from its centre, hs its half
// size, s px per unit)
float shroud(vec2 sp, vec2 hs, float s) {
  float bx = sdBox(sp, hs);
  float inS = 1.0 - smoothstep(-0.8, 0.8, bx * s);
  float line = 1.0 - smoothstep(-0.7, 0.7, (abs(sdBox(sp, hs - vec2(0.028))) - 0.0055) * s);
  return inS * (1.0 - line);
}
// one of the other dead on his bier (x from the bier's centre, frieze units), head to the left
float bierDead(vec2 X, float v) {
  float d = sdBox(vec2(X.x, X.y - 0.31), vec2(0.37, 0.02));
  d = min(d, sdBox(vec2(abs(X.x) - 0.31, X.y - 0.155), vec2(0.016, 0.155)));
  d = min(d, sdBox(vec2(abs(X.x) - 0.31, X.y - 0.02), vec2(0.035, 0.02)));
  float len = 0.6;
  vec2 fq = vec2((X.y - 0.33 - 0.075) / len, (0.5 * len - X.x) / len);
  return min(d, figure(fq, v) * len);
}
// Polites on his bier (x from the bier's centre): larger than the other dead, lying at rest, head to the left, the
// arms open low at his sides with the palms turned up
float polites(vec2 X) {
  float d = sdBox(X - vec2(0.0, 0.37), vec2(0.58, 0.026));                            // the bier
  d = min(d, sdBox(vec2(abs(X.x) - 0.5, X.y - 0.18), vec2(0.022, 0.18)));
  d = min(d, sdBox(vec2(abs(X.x) - 0.5, X.y - 0.025), vec2(0.045, 0.025)));
  vec2 p = X - vec2(0.0, 0.5);                                                         // the body's axis
  d = min(d, length(p - vec2(-0.48, 0.0)) - 0.062);                                   // head
  d = min(d, sdSegment(p, vec2(-0.43, 0.0), vec2(-0.37, 0.0)) - 0.022);
  float tw = mix(0.075, 0.03, sat((p.x + 0.37) / 0.3));                               // torso
  d = min(d, max(abs(p.y) - tw, max(-0.37 - p.x, p.x + 0.07)));
  d = min(d, sdSegment(p, vec2(-0.07, 0.0), vec2(0.2, -0.005)) - 0.034);              // thighs, shins, feet
  d = min(d, sdSegment(p, vec2(0.2, -0.005), vec2(0.44, -0.015)) - 0.021);
  d = min(d, sdSegment(p, vec2(0.44, -0.015), vec2(0.455, 0.05)) - 0.015);
  for (int k = 0; k < 2; k++) {
    // the arms open low at either side (the far one drawn above the body, the near one below), laid out towards the
    // feet a little apart from the body, the hands by the hips, palms up
    float sy = k == 0 ? 1.0 : -1.0;
    vec2 sh = vec2(-0.33, 0.035 * sy), ha = vec2(-0.05, 0.085 * sy);
    d = min(d, sdSegment(p, sh, ha) - 0.017);
    d = min(d, sdSegment(p, ha, ha + vec2(0.05, 0.0)) - 0.014);                        // the open palm, flat
    d = min(d, sdSegment(p, ha + vec2(0.05, 0.0), ha + vec2(0.068, 0.03)) - 0.009);   // the fingers turned up
    d = min(d, sdSegment(p, ha, ha + vec2(0.0, 0.026)) - 0.009);                       // the thumb
  }
  return d;
}
// the prothesis: one procession of identical mourners at an even step, walking to the right round the band to
// Polites; the other dead on their biers at regular intervals along it (each bier takes two of the procession's
// steps); beyond Polites the mourners face back to him. Returns (distance in frieze units, shroud ink).
vec2 prothesis(vec2 X, float s) {
  float P0 = ${POL_X.toFixed(4)}, S = ${MSTEP.toFixed(3)}, MH = ${MH.toFixed(3)}, LEAD = ${LEAD.toFixed(3)}, PS = ${PS.toFixed(2)};
  float d = 1e9, sh = 0.0;
  float x = X.x - P0;
  if (abs(x) < 0.85) {
    d = polites((X - vec2(P0, 0.0)) / PS) * PS;
    sh = shroud(vec2(x, X.y - 0.865), vec2(0.6, 0.075), s);
  }
  if (x < 0.0) {
    float nc = (-x - LEAD) / S;                         // the step, counted back from the leader
    float n = floor(nc + 0.5);
    bool gap = n >= 11.0 && mod(n + 1.0, 12.0) < 1.5;
    if (n >= 0.0 && !gap) d = min(d, mourner(vec2(-(nc - n) * S, X.y - 0.012) / MH) * MH);
    float m = max(floor((nc + 0.5) / 12.0 + 0.5), 1.0);
    float bx = -(nc - (12.0 * m - 0.5)) * S;
    if (abs(bx) < 0.45) {
      d = min(d, bierDead(vec2(bx, X.y), m * 0.37 + 0.11));
      sh = max(sh, shroud(vec2(bx, X.y - 0.6), vec2(0.33, 0.07), s));
    }
  } else {
    float nc = (x - LEAD) / S, n = floor(nc + 0.5);
    if (n >= 0.0) d = min(d, mourner(vec2(-(nc - n) * S, X.y - 0.012) / MH) * MH);
  }
  return vec2(d, sh);
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(camP - vW);
  bool inside = vIn > inner0;
  float aw = fwidth(vIn) * 1.2 + 1e-4;
  if (dot(N, V) < 0.0) N = -N;
  vec3 Lv = Lc - vW; float dl = max(length(Lv), 1e-4); Lv /= dl;
  float fall = keyK * LI / (1.0 + (dl / reach) * (dl / reach) * 4.0);
  float b = fall * (0.25 + 0.75 * max(dot(N, Lv), 0.0));
  // the pool of warm light on Polites
  vec3 Pv = poolP - vW; float pdl = max(length(Pv), 1e-4); Pv /= pdl;
  vec3 dc = vW - poolC;
  float pool = poolI * exp(-dot(dc, dc) / (poolR * poolR)) * (0.35 + 0.65 * max(dot(N, Pv), 0.0));
  b += pool;
  vec3 clay = mix(mix(C_BLOOD, C_SIGNAL, 0.75), C_EMBER, 0.2) * 0.8;
  vec3 clayLit = clay * (0.015 + 0.85 * sat(b)) + C_BONE * 0.06 * smoothstep(0.9, 1.8, b) + C_EMBER * 0.12 * sat(pool);
  vec3 glaze = C_INK * 0.9 + clay * 0.03 * sat(b);
  vec3 Hh = normalize(Lv + V);
  float spec = pow(max(dot(N, Hh), 0.0), 60.0) * (fall + 0.5 * pool) * 0.18;
  if (handle > 0.5) {
    // the strap handles: solid black glaze, two thin lines reserved along each strap's face (vIn runs across it; the
    // strap's edges carry vIn < 0)
    float ln = (1.0 - smoothstep(0.035, 0.035 + aw, abs(vIn - 0.2))) + (1.0 - smoothstep(0.035, 0.035 + aw, abs(vIn - 0.8)));
    ln *= step(0.0, vIn) * smoothstep(0.02, 0.06, vU) * (1.0 - smoothstep(0.94, 0.98, vU));
    fragColor = vec4(mix(glaze + vec3(spec) * mix(C_EMBER, C_BONE, 0.5), clayLit, sat(ln)), 1.0);
    return;
  }
  if (inside) { fragColor = vec4(glaze * 0.6, 1.0); return; }
  // the band's coordinates: arc length round the vase (continuous about the camera's side) and height
  float dth = atan(vL.x, vL.z) - phi;
  dth -= TAU * floor((dth + PI) / TAU);
  float u = (phi + dth) * ${R_BAND.toFixed(2)}, y = vL.y;
  float pw = max(length(fwidth(vec2(u, y))) * PX_SCALE, 1e-5);
  float ink = 0.0;
  float fy0 = ${FRZ.y.toFixed(3)}, fh = ${FRZ.h.toFixed(3)}, top = fy0 + fh;
  // decoration by height, from the lip down (black glaze on the clay)
  float sc = ${VS.toFixed(2)};
  if (y > 6.2 * sc) ink = 1.0;                                                   // the lip
  else if (y > 5.74 * sc) ink = band(vec2(u, 6.2 * sc - y) / pw, 0.46 * sc / pw);   // the meander on the neck
  else if (y > 5.67 * sc) ink = 0.0;
  else if (y > 5.6 * sc) ink = 1.0;
  else if (y > top + 0.42) ink = zigzag(vec2(u, 5.6 * sc - y) / pw, (5.6 * sc - top - 0.42) / pw, 0.38 / pw);
  else if (y > top + 0.06) ink = band(vec2(u, top + 0.42 - y) / pw, 0.36 / pw);
  else if (y > top) ink = 1.0;
  else if (y > fy0) {
    // the prothesis, all of it painted: the camera's pass reveals it
    float s = fh / pw;
    vec2 pr = prothesis(vec2(u / fh, (y - fy0) / fh), s);
    ink = max(1.0 - smoothstep(-0.8, 0.8, pr.x * s), pr.y);
  }
  else if (y > fy0 - 0.08) ink = 1.0;
  else if (y > fy0 - 0.5) ink = zigzag(vec2(u, fy0 - 0.08 - y) / pw, 0.42 / pw, 0.3 / pw);
  else if (y > fy0 - 0.58) ink = 1.0;
  else if (y > 2.9 * sc) { float f = fract((fy0 - 0.58 - y) / 0.2); ink = smoothstep(0.62, 0.66, f) * (1.0 - smoothstep(0.86, 0.9, f)); }
  else {
    ink = 1.0;
    if (y < 2.6 * sc && y > 2.48 * sc) ink = 0.0;                                // reserved lines low on the body
    if (y < 2.07 * sc && y > 1.98 * sc) ink = 0.0;                               // the collar
    if (y < 1.25 * sc && y > 1.15 * sc) ink = 0.0;                               // and down the pedestal
    if (y < 0.45 && y > 0.35) ink = 0.0;
  }
  vec3 col = mix(clayLit, glaze + vec3(spec) * mix(C_EMBER, C_BONE, 0.5), sat(ink));
  fragColor = vec4(col, 1.0);
}`;

/** A flat strap (width w across `side`, thickness k) along a curve through pts; uv.x runs along it, uv.y across its
 * two broad faces (0..1; -1 on its thin edges). */
function strapGeo(pts: THREE.Vector3[], side: THREE.Vector3, w: number, k: number): THREE.BufferGeometry {
  const c = new THREE.CatmullRomCurve3(pts), n = 40, pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const [fs, fn] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const p = c.getPointAt(i / n), T = c.getTangentAt(i / n);
      const N = new THREE.Vector3().crossVectors(T, side).normalize();
      const fN = side.clone().multiplyScalar(fs).addScaledVector(N, fn);
      for (const e of [-1, 1]) {
        const a = fs !== 0 ? fs : e, b = fs !== 0 ? e : fn;
        const v = p.clone().addScaledVector(side, (a * w) / 2).addScaledVector(N, (b * k) / 2);
        pos.push(v.x, v.y, v.z); nor.push(fN.x, fN.y, fN.z); uv.push(i / n, fs !== 0 ? -1 : (e + 1) / 2);
      }
      if (i < n) { const q = base + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Camera arc position (along the band): one steady pass, easing to rest on Polites by TE, then still. */
function camU(t: number) {
  const tc = clamp(t, T0, TE), D = TE - TB;
  const v = (POL_U - U0) / (TB - T0 + D / 2);
  if (tc <= TB) return U0 + v * (tc - T0);
  const s = tc - TB;
  return U0 + v * (TB - T0) + v * (s - (s * s) / (2 * D));
}

export default class C1Vase extends Scene {
  private st!: Stage;
  private vase!: THREE.Mesh;
  private mat!: THREE.RawShaderMaterial;
  private hero!: Word3D;
  private phrases: { w: Word3D; on: number[]; exit: number; upBy: number[] }[] = [];
  private line!: Line;

  override async init() {
    this.st = new Stage({ maxCards: 4 });
    this.line = this.ctx.lyrics.lines.find((l) => l.start > 53.5 && l.start < 55 && /guilt/i.test(l.text))!;
    const ws = this.line.words;
    const geo = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r * VS, y * VS)), 160);
    // the pool of warm light: a lamp out in front of Polites, its light centred on him on the vase's skin
    const thP = POL_U / R_BAND, fc = FRZ.y + FRZ.h * 0.5, rS = 3.95 * VS;
    const poolC = new THREE.Vector3(rS * Math.sin(thP), fc, rS * Math.cos(thP));
    const poolP = new THREE.Vector3((rS + 3) * Math.sin(thP), fc + 2.2, (rS + 3) * Math.cos(thP));
    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VASE_VERT, fragmentShader: VASE_FRAG, side: THREE.DoubleSide,
      uniforms: {
        Lc: { value: new THREE.Vector3() }, camP: { value: new THREE.Vector3() }, LI: { value: 1 }, reach: { value: 30 },
        phi: { value: 0 }, inner0: { value: (LIP_I + 0.5) / (PROFILE.length - 1) }, handle: { value: 0 },
        keyK: { value: 0.17 }, poolP: { value: poolP }, poolC: { value: poolC }, poolI: { value: 1.3 }, poolR: { value: 2.0 },
      },
    });
    this.vase = new THREE.Mesh(geo, this.mat);
    this.st.scene.add(this.vase);
    // the handles share the vase's uniforms (handle = 1), square to the band's end so they ride the shoulder
    const hMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VASE_VERT, fragmentShader: VASE_FRAG, side: THREE.DoubleSide,
      uniforms: { ...this.mat.uniforms, handle: { value: 1 } },
    });
    for (const side of [-1, 1]) for (const off of [-0.075, 0.075]) {
      const th = thP + (side * Math.PI) / 2 + off;
      const pts = HANDLE.map(([r, y]) => new THREE.Vector3(r * VS * Math.sin(th), y * VS, r * VS * Math.cos(th)));
      this.st.scene.add(new THREE.Mesh(strapGeo(pts, new THREE.Vector3(Math.cos(th), 0, -Math.sin(th)), 0.24 * VS, 0.06 * VS), hMat));
    }
    // the small phrases (1–4 words each), and GUILT?
    const gi = ws.findIndex((w) => /guilt/i.test(w.w));
    const groups = [[0, 3], [3, 6], [6, 8], [8, 10], [10, gi]];
    for (const [a, b] of groups) {
      const w = new Word3D(ws.slice(a, b).map((x) => x.w).join(' '), F.archivo(112.5, 600), { size: 200 });
      this.st.add(w, { shadows: false });
      const next = ws[b]!.start;
      this.phrases.push({ w, on: ws.slice(a, b).map((x) => x.start), exit: b < gi ? next - 0.12 : ws[gi]!.start - 0.05,
        upBy: ws.slice(a, b).map((x) => Math.min(0.12, x.end - x.start)) });
    }
    this.hero = new Word3D(ws[gi]!.w.toUpperCase().replace(/[^A-Z?]/g, ''), heroFont(), { size: 220 });
    this.hero.lightMul = 3.0;
    this.st.add(this.hero, { shadows: false });
  }

  /** Poses a run standing on the rim, centred on the arc angle th (letters face out, along the rim). */
  private onRim(w: Word3D, th: number, s: number) {
    return (l: Letter) => {
      const a = th + ((l.penX - w.width / 2) * s) / RIM.r;
      l.x = RIM.r * Math.sin(a); l.z = RIM.r * Math.cos(a); l.y = RIM.y; l.yaw = a; l.s = s;
    };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const ws = this.line.words, gi = ws.findIndex((w) => /guilt/i.test(w.w)), tG = ws[gi]!.start;

    // the camera: a steady height and distance, pulled back and raised to hold the band and the rim above it; only
    // its angle round the vase moves, then it rests on Polites
    const phi = camU(t) / R_BAND;
    const rc = 15.0, cy = 9.6, ly = 8.85;
    const pos = new THREE.Vector3(rc * Math.sin(phi), cy, rc * Math.cos(phi));
    const at = new THREE.Vector3(R_BAND * Math.sin(phi), ly, R_BAND * Math.cos(phi));
    this.st.cam.set(pos, at, FOV);

    const u = this.mat.uniforms;
    u.phi!.value = phi;

    // the small phrases on the rim, each where the camera faces mid-phrase; GUILT? where the shot comes to rest
    const hd = rc - RIM.r, fw = 2 * hd * TANF * (16 / 9);
    const hs = (0.4 * fw) / this.hero.width, thP = POL_U / R_BAND;
    this.phrases.forEach((p, i) => {
      const s = 0.32 / p.w.cap;
      // the last phrase is sung as the camera comes to rest: it stands on the rim to the left of where GUILT? lands
      const th = i < this.phrases.length - 1 ? camU((p.on[0]! + p.exit) / 2) / R_BAND
        : thP - ((this.hero.width * hs) / 2 + 0.3 + (p.w.width * s) / 2) / RIM.r;
      popWords(p.w, p.on, t, this.onRim(p.w, th, s), { exit: p.exit, exitDur: 0.14, upBy: p.upBy });
    });
    popWords(this.hero, [tG], t, this.onRim(this.hero, thP, hs), { glow: 0.7 });

    const L = keyLight(this.st.cam, audio, t, { seed: 9, right: 3.2, up: 2.6, back: 3.0, I: 1.25, reach: 42 });
    const Lc = this.st.lightCentre(L);
    (u.Lc!.value as THREE.Vector3).copy(Lc); (u.camP!.value as THREE.Vector3).copy(pos);
    u.LI!.value = L.I; u.reach!.value = L.reach;
    const flip = () => {
      for (const k of ['Lc', 'camP', 'poolP', 'poolC']) (u[k]!.value as THREE.Vector3).y *= -1;
    };
    this.st.render(renderer, out, t, L, { wall: 0, gloss: 0.55 }, {
      noFlame: true, cards: false, rim: 0.6, spec: 0.05,
      // the glaze mirrors the vase lit from above (the mirrored scene is flipped about the floor)
      mirror: { before: flip, after: flip },
    });
    return { bloom: 0.5, bloomThreshold: 0.9, vignette: 0.75, grain: 0.06, ca: 0.4, halation: 0.3 };
  }
}
