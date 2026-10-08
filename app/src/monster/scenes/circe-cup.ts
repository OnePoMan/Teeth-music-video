// `circe`'s set: Circe's kylix seen from above (docs/verse2-plan.md, "the bottom of the cup"). A small ray-traced stage of
// its own (the kit's `Stage` has a floor plane at y 0 and an endless wall; a cup needs a rim, a bowl and a liquid level
// that can sink):
//  - the rim (y 0, radius RI..RO): lit clay with a reserved band of decoration (a running wave);
//  - the bowl: a spherical cap, black glaze inside except a reserved clay band under the lip and the tondo at the
//    bottom (clay, a meander frame, three faceless nymphs hand in hand in a ring dance, black-figure with incised lines);
//  - the potion: a black mirror, wine-dark, at `level`; swells, rings and the vortex only bend what it mirrors (the
//    analytic room above and the letters, rendered mirrored about the surface); in the vortex the reflections smear round
//    (an angular blur of the mirrored image), no lines are drawn on it; shallow, it lets the painting through;
//  - her staff's shadow (black-figure) across the cup, cast by the fire behind us;
//  - outside, the black-glaze floor of her hall, the cup's handles and its shadow.
// Letters are the kit's `Word3D` with a clipping copy of its letter shader (they rise out of and sink into the potion).
// Units: world units, y up, the rim at y 0, the cup's axis at x = z = 0.
import * as THREE from 'three';
import { FSPass, makeRT, W, H } from '../../engine/gl';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { StageCam, type StageLight, type Word3D } from '../stage';

/** The cup: rim inner/outer radius, bowl depth, the reserved band under the lip, tondo radii (field, frame), floor. */
export const CUP = { RI: 3.0, RO: 3.42, D: 0.9, LIPB: 0.14, RTIN: 1.32, RT: 1.52, FLOOR: -2.4 };
/** The bowl's sphere (radius, centre height). */
export const RS = (CUP.RI * CUP.RI + CUP.D * CUP.D) / (2 * CUP.D);
export const CY = -CUP.D + RS;
/** Height of the bowl's inside at radius r. */
export const bowlY = (r: number) => CY - Math.sqrt(Math.max(0, RS * RS - r * r));
/** Radius of the potion's surface at level h. */
export const poolR = (h: number) => Math.sqrt(Math.max(0, RS * RS - (h - CY) * (h - CY)));
/** The full cup's level. */
export const FULL = -0.12;
export const MAX_RIP = 10;

// ---------------------------------------------------------------- letters that can sink (a copy of the kit's shader)
const LETTER_VERT = /* glsl */ `
precision highp float;
in vec3 position; in vec3 normal;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
out vec3 vW; out vec3 vNW; out vec3 vP; out vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vNW = mat3(modelMatrix) * normal; vP = position; vN = normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** The kit's letter shader (stage.ts, vase path) plus a clip at the potion's surface: clipS (vW.y - clipY) < 0 is
 *  discarded (1 in the shot, -1 in the mirrored render), and a wine-dark wet line where the letter meets it. */
const LETTER_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec3 vW; in vec3 vNW; in vec3 vP; in vec3 vN;
out vec4 fragColor;
${GLSL_COMMON}
uniform vec3 Lc, camPosL; uniform float LI, reach, glow, lineFreq, rim, amb, vaseL, glaze, bf;
uniform sampler2D incTex; uniform vec4 amap;
uniform float clipY, clipS;
void main() {
  if (clipS * (vW.y - clipY) < 0.0) discard;
  float nl = length(vNW);
  vec3 N = nl > 1e-6 ? vNW / nl : vec3(0.0, 0.0, 1.0);
  vec3 L = Lc - vW; float d = length(L); L /= d;
  float fall = LI / (1.0 + (d / reach) * (d / reach) * 4.0);
  float ndl = dot(N, L);
  float face = step(0.9, abs(vN.z) / max(length(vN), 1e-6));
  float lit = pow(max(ndl, 0.0), 1.3) * fall;
  float tone = sat(lit * 1.35);
  vec3 Vv = normalize(camPosL - vW), Hh = normalize(L + Vv);
  float spec = pow(max(dot(N, Hh), 0.0), 90.0) * fall;
  vec3 sideC = C_INK * (0.5 + 0.5 * tone) + mix(C_EMBER, C_BONE, 0.5) * spec * 1.6;
  vec3 faceC = C_BONE * min(tone, 0.82);
  vec3 col = mix(sideC, faceC, face);
  col += mix(C_SIGNAL, C_EMBER, 0.5) * rim * fall * pow(1.0 - abs(ndl), 6.0) * (1.0 - face) * 1.2;
  col += mix(C_BONE, C_EMBER, 0.3) * amb * (0.35 + 0.65 * face);
  col = mix(col, C_EMBER * 2.2, glow * (0.6 + 0.4 * face));
  // wet where it comes out of the potion
  float wet = 1.0 - smoothstep(0.0, 0.05, clipS * (vW.y - clipY));
  col = mix(col, col * vec3(0.45, 0.2, 0.22), wet * 0.8);
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  fragColor = vec4(col, 1.0);
}`;

/** Gives a run's letters the clipping shader (their uniforms are kept, with clipY/clipS added). */
export function clipWord(w: Word3D) {
  for (const l of w.letters) {
    const u = l.mat.uniforms;
    u.clipY = { value: -100 };
    u.clipS = { value: 1 };
    const m = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: LETTER_VERT, fragmentShader: LETTER_FRAG, uniforms: u });
    l.mat.dispose();
    l.mesh.material = m;
    l.mat = m;
  }
}

// ---------------------------------------------------------------- the cup
const CUP_FRAG = /* glsl */ `
uniform mat4 invVP; uniform vec3 camPos, Lc; uniform float LI, reach;
uniform float level, wine, gloss, specK, reflOn, stageT, swell, reflBend;
uniform sampler2D reflTex;
// the vortex: strength, its centre on screen (logical px) and the time it has turned
uniform float swirl, swirlT; uniform vec2 vortPx;
// the staff's shadow on the rim plane: from its butt (outside the rim) to its tip; on
uniform vec4 staff; uniform float staffOn;
uniform vec4 rip[${MAX_RIP}]; uniform int nRip;
uniform float tondoRot, dancePh;
const float RI = ${CUP.RI.toFixed(4)}, RO = ${CUP.RO.toFixed(4)}, DEP = ${CUP.D.toFixed(4)}, RS = ${RS.toFixed(5)}, CY = ${CY.toFixed(5)};
const float LIPB = ${CUP.LIPB.toFixed(4)}, RTIN = ${CUP.RTIN.toFixed(4)}, RT = ${CUP.RT.toFixed(4)}, FLOORY = ${CUP.FLOOR.toFixed(4)};
const vec3 C_WINE = vec3(0.028, 0.0006, 0.0062);
float gPix = 0.01;

float cSdEll(vec2 p, vec2 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float cSdTrap(vec2 p, float r1, float r2, float he) {
  vec2 k1 = vec2(r2, he), k2 = vec2(r2 - r1, 2.0 * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, (p.y < 0.0) ? r1 : r2), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
float cSdCap(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float cIncise(float d, float l, float w) { return max(d, w - l); }

vec3 clayCol(float b) {
  vec3 clay = mix(mix(C_BLOOD, C_SIGNAL, 0.75), C_EMBER, 0.2) * 0.8;
  return clay * (0.02 + 0.8 * sat(b)) + C_BONE * 0.08 * smoothstep(0.9, 1.8, b);
}
float fallAt(vec3 P) { float d = length(Lc - P); return LI / (1.0 + (d / reach) * (d / reach) * 4.0); }
float lightAt(vec3 P, vec3 N) { vec3 L = normalize(Lc - P); return fallAt(P) * (0.3 + 0.7 * max(dot(N, L), 0.0)); }

/** The staff's shadow (0..1): a long tapering rod on the rim plane; on lower surfaces it falls further from the fire. */
float staffShadow(vec3 P) {
  if (staffOn <= 0.0) return 0.0;
  vec2 away = P.xz - Lc.xz; away /= max(length(away), 1e-4);
  vec2 q = P.xz - away * (-P.y) * 0.45;
  vec2 a = staff.xy, b = staff.zw, pa = q - a, ba = b - a;
  float h = sat(dot(pa, ba) / dot(ba, ba));
  float d = length(pa - ba * h) - mix(0.1, 0.07, h);
  d = min(d, length(q - a) - 0.2);                            // its ball finial, on the floor beyond the rim
  float soft = 0.02 + 0.03 * (-P.y) + gPix;
  return staffOn * (1.0 - smoothstep(-soft, soft, d));
}
/** The cup's own shadow on the floor (the rim's disc and the handles seen from the fire). */
float cupShadow(vec3 P) {
  vec3 L = Lc - P;
  float s = (0.0 - P.y) / L.y;
  vec2 q = P.xz + L.xz * s;
  float r = length(q);
  return 1.0 - smoothstep(RO - 0.15, RO + 0.15, r);
}

// ---- the decoration
/** A running meander (Greek key): s along, v across (0..1); 1 on the black line. */
float meander(vec2 p, float w) {
  vec2 c = vec2(fract(p.x), p.y);
  float d = abs(c.y - 0.1);                                       // the running base line
  d = min(d, sdSegment(c, vec2(0.86, 0.1), vec2(0.86, 0.9)));
  d = min(d, sdSegment(c, vec2(0.86, 0.9), vec2(0.18, 0.9)));
  d = min(d, sdSegment(c, vec2(0.18, 0.9), vec2(0.18, 0.42)));
  d = min(d, sdSegment(c, vec2(0.18, 0.42), vec2(0.56, 0.42)));
  return d - w;
}

// ---- the nymphs: a faceless woman in a peplos, dancing toward +x, her arms raised to hold her neighbours' hands at
// (xh, yh) and (-xh, yh) (units: her height ~1.05, her feet at y 0)
float nymph(vec2 p, vec2 hf, vec2 hb, float ph) {
  // the chiton swept back by the step (leaning into the dance)
  vec2 q = p - vec2(-0.16 * sat(0.58 - p.y) + 0.012 * sin(ph) * sat(0.58 - p.y) / 0.58, 0.0);
  float d = cSdTrap(q - vec2(0.0, 0.31), 0.15, 0.075, 0.28);                     // the skirt, to the ankles
  d = smin(d, cSdEll(p - vec2(0.0, 0.53), vec2(0.115, 0.075)), 0.04);         // the overfold, falling over the belt
  d = smin(d, cSdEll(p - vec2(0.0, 0.67), vec2(0.075, 0.12)), 0.04);           // the body
  d = smin(d, cSdEll(p - vec2(0.055, 0.7), vec2(0.045, 0.045)), 0.03);         // breast
  d = smin(d, sdBox(p - vec2(0.012, 0.8), vec2(0.028, 0.04)), 0.02);           // neck
  vec2 hc = p - vec2(0.025, 0.885);
  float head = cSdEll(hc, vec2(0.075, 0.085));
  head = min(head, sdSegment(hc, vec2(0.06, 0.005), vec2(0.093, -0.018)) - 0.016);   // nose (no face: no eye, no mouth)
  head = smin(head, sdCircle(hc - vec2(0.045, -0.06), 0.03), 0.02);            // chin
  d = smin(d, head, 0.015);
  d = smin(d, sdCircle(p - vec2(-0.06, 0.92), 0.04), 0.02);                     // her hair in a knot
  d = smin(d, cSdCap(p, vec2(-0.05, 0.88), vec2(-0.1, 0.62), 0.032, 0.018), 0.02);  // and a lock down her back
  // her feet: the front one stepping out of the hem, the back one lifting
  d = min(d, cSdEll(p - vec2(0.08, 0.02), vec2(0.06, 0.022)));
  d = min(d, cSdCap(p, vec2(-0.12, 0.12), vec2(-0.24, 0.05), 0.025, 0.02));
  d = min(d, cSdEll(rot2(0.5) * (p - vec2(-0.27, 0.045)), vec2(0.05, 0.02)));
  // the arms, raised to the neighbours' hands
  vec2 sh = vec2(0.01, 0.77);
  d = min(d, cSdCap(p, sh, hf, 0.03, 0.02));
  d = min(d, cSdCap(p, sh - vec2(0.03, 0.0), hb, 0.03, 0.02));
  d = min(d, sdCircle(p - hf, 0.032));
  d = min(d, sdCircle(p - hb, 0.032));
  // incisions: the fillet in her hair, the overfold's edge, one fold down the skirt, a border at the hem
  float iw = 0.008;
  d = cIncise(d, abs(p.y - 0.47) + max(0.0, abs(p.x) - 0.13), iw);
  d = cIncise(d, sdSegment(q, vec2(0.02, 0.44), vec2(0.03, 0.1)), iw);
  d = cIncise(d, abs(q.y - 0.07) + max(0.0, abs(q.x) - 0.17), iw);
  d = cIncise(d, abs(q.y - 0.105) + max(0.0, abs(q.x) - 0.165), iw);
  return d;
}
/** The tondo: clay, the meander frame, the ring of three nymphs (1 where black). */
float tondoInk(vec2 xz) {
  vec2 q = rot2(tondoRot) * xz;
  float r = length(q), aa = gPix * 0.9;
  if (r > RT) return 1.0;
  float th = atan(q.y, q.x);
  // the frame: two black lines and a meander between
  float ink = 1.0 - smoothstep(0.012 - aa, 0.012 + aa, abs(r - RT + 0.012));
  ink = max(ink, 1.0 - smoothstep(0.009 - aa, 0.009 + aa, abs(r - RTIN)));
  if (r > RTIN && r < RT - 0.03) {
    float rm = 0.5 * (RTIN + RT - 0.03), bw = RT - 0.03 - RTIN;
    float n = floor(6.2831853 * rm / (bw * 1.15));
    vec2 mp = vec2(th / 6.2831853 * n, (r - RTIN) / bw);
    float dm = meander(mp, 0.075) * bw;
    ink = max(ink, 1.0 - smoothstep(-aa, aa, dm));
  }
  if (r < RTIN) {
    // three women hand in hand, dancing to the right on a ground line (the vase painters' way of showing a ring
    // dance); q is the screen's frame (x right, y down) once the camera has stopped turning
    vec2 u = vec2(q.x, -q.y);
    const float GY = -0.92, FS = 1.7, XS = 0.7;
    ink = max(ink, 1.0 - smoothstep(0.016 - aa, 0.016 + aa, abs(u.y - GY + 0.016)));
    for (int i = 0; i < 3; i++) {
      float xc = XS * float(i - 1);
      vec2 lp = (u - vec2(xc, GY)) / FS;
      if (abs(lp.x) > 0.5 || lp.y < -0.05 || lp.y > 1.05) continue;
      float hx = 0.5 * XS / FS;
      vec2 hf = i < 2 ? vec2(hx, 0.58) : vec2(0.2, 0.9);
      vec2 hb = i > 0 ? vec2(-hx, 0.58) : vec2(-0.21, 0.89);
      float d = nymph(lp, hf, hb, dancePh + float(i) * 2.1) * FS;
      ink = max(ink, 1.0 - smoothstep(-aa, aa, d));
    }
  }
  return ink;
}

// ---- what the glaze and the potion mirror
/** The hall above, lit by the fire behind us: dark, a broad warm glow toward the fire, smoke under the roof. */
vec3 hall(vec3 P, vec3 R) {
  vec3 Lv = normalize(Lc - P);
  float g = max(dot(R, Lv), 0.0);
  vec2 sp = R.xz / (R.y + 0.3);
  float smoke = smoothstep(0.0, 0.6, fbm(sp * 0.55 + vec2(0.0, stageT * 0.04), 2));
  return mix(C_BLOOD, C_EMBER, 0.45) * (0.001 + (0.012 * g * g * g * g + 0.006 * g) + 0.05 * g * smoke) * LI;
}
/** From a point inside the cup along R (upward): the bowl's wall (its clay band under the lip), or out to the hall. */
vec3 env(vec3 P, vec3 R) {
  if (R.y <= 0.0) return C_INK * 0.5;
  vec3 oc = P - vec3(0.0, CY, 0.0);
  float b = dot(oc, R), c = dot(oc, oc) - RS * RS, disc = b * b - c;
  float tw = disc > 0.0 ? -b + sqrt(disc) : 1e9;
  vec3 Pw = P + R * tw;
  if (Pw.y < 0.0) {
    vec3 N = normalize(vec3(0.0, CY, 0.0) - Pw);
    if (Pw.y > -LIPB) return clayCol(lightAt(Pw, N) * (1.0 - staffShadow(Pw))) * 0.6;
    return C_INK * 0.55;
  }
  return hall(P, R);
}
float fresnel(vec3 V, vec3 N) { float x = 1.0 - max(dot(V, N), 0.0); return 0.04 + 0.96 * x * x * x * x * x; }

// ---- the potion's surface: swells, rings, the vortex (they only bend reflections)
vec2 swellGrad(vec2 xz, float t) {
  vec2 d1 = vec2(0.287, 0.958), d2 = vec2(-0.514, 0.857), d3 = vec2(0.970, 0.243), g = vec2(0.0);
  g += d1 * 0.06 * cos(dot(xz, d1) * 1.6 + t * 0.9) * exp(-gPix * 3.2);
  g += d2 * 0.05 * cos(dot(xz, d2) * 2.9 - t * 1.3) * exp(-gPix * 6.8);
  g += d3 * 0.03 * cos(dot(xz, d3) * 5.3 + t * 2.1) * exp(-gPix * 14.4);
  return g;
}
vec2 ripGrad(vec2 xz) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < ${MAX_RIP}; i++) {
    if (i >= nRip) break;
    vec4 rp = rip[i];
    float age = stageT - rp.z;
    if (age < 0.0) continue;
    vec2 dv = xz - rp.xy; float d = length(dv);
    float front = 0.25 + 1.6 * age, w = 0.1 + 0.25 * age;
    float x = (d - front) / w;
    float env = exp(-x * x) * exp(-age * 1.4) * rp.w;
    g += (dv / max(d, 1e-3)) * env * cos((d - front) * 14.0) * 0.6;
  }
  return g;
}
float vortH(vec2 xz) {
  float r = length(xz), th = atan(xz.y, xz.x);
  float funnel = -0.3 * exp(-r * r / 1.5);
  float arms = 0.1 * sin(4.0 * th + 4.0 * log(r + 0.25) - swirlT * 6.0) * smoothstep(0.15, 0.9, r) * smoothstep(2.9, 1.6, r);
  return swirl * (funnel + arms);
}
vec2 vortGrad(vec2 xz) {
  if (swirl <= 0.001) return vec2(0.0);
  float e = 0.03, h = vortH(xz);
  return vec2(vortH(xz + vec2(e, 0.0)) - h, vortH(xz + vec2(0.0, e)) - h) / e;
}
/** How far the vortex has turned what lies at radius r (radians). */
float swirlAng(float r) { return swirl * 1.5 * exp(-r * 0.75); }

vec3 rimCol(vec3 P) {
  float r = length(P.xz), th = atan(P.z, P.x), v = (r - RI) / (RO - RI);
  float b = lightAt(P, vec3(0.0, 1.0, 0.0)) * (1.0 - staffShadow(P));
  vec3 clay = clayCol(b);
  float aa = gPix / (RO - RI) * 0.8;
  // the lip's inner and outer edges black, a band between: a running wave reserved in the clay
  float ink = 1.0 - smoothstep(0.1 - aa, 0.1 + aa, v);
  ink = max(ink, smoothstep(0.86 - aa, 0.86 + aa, v));
  if (v > 0.24 && v < 0.74) {
    float vv = (v - 0.24) / 0.5;
    float n = 30.0;
    float s = th / 6.2831853 * n;
    float ph = fract(s);
    float crest = 0.48 + 0.26 * sin(6.2831853 * ph + 0.55 * sin(6.2831853 * ph));
    float ab = gPix / ((RO - RI) * 0.5) * 1.2;
    ink = max(ink, smoothstep(-ab, ab, vv - crest));
  }
  return mix(clay, C_INK * 0.85 + clay * 0.04, ink);
}

/** The bowl's inside at P (on the sphere). */
vec3 bowlCol(vec3 P, vec3 D) {
  vec3 N = normalize(vec3(0.0, CY, 0.0) - P);
  float r = length(P.xz);
  float b = lightAt(P, N) * (1.0 - staffShadow(P));
  vec3 clay = clayCol(b);
  vec3 V = -D;
  vec3 R = reflect(D, N);
  float fr = fresnel(V, N);
  float spec = pow(max(dot(N, normalize(normalize(Lc - P) + V)), 0.0), 200.0) * fallAt(P);
  vec3 glaze = C_INK * 0.8 + clay * 0.03 + env(P + N * 0.01, R) * (0.12 + 0.88 * fr) * 0.8 + mix(C_EMBER, C_BONE, 0.45) * spec * specK;
  if (P.y > -LIPB) {
    float aa = gPix;
    return mix(glaze, clay, smoothstep(-LIPB - aa, -LIPB + aa, P.y));
  }
  if (r < RT + 0.02) {
    float ink = tondoInk(P.xz);
    vec3 painted = mix(clay, C_INK * 0.8 + clay * 0.03 + mix(C_EMBER, C_BONE, 0.45) * spec * specK * 0.4, ink);
    float aa = gPix;
    return mix(painted, glaze, smoothstep(RT - aa, RT + aa, r));
  }
  return glaze;
}

void main() {
  vec2 ndc = FRAG_PX / vec2(${W.toFixed(1)}, ${H.toFixed(1)}) * 2.0 - 1.0;
  vec4 q = invVP * vec4(ndc, 1.0, 1.0);
  vec3 D = normalize(q.xyz / q.w - camPos);
  vec3 col = C_INK;
  if (D.y >= -1e-5) { fragColor = vec4(col, 1.0); return; }
  float t0 = (0.0 - camPos.y) / D.y;
  vec3 P0 = camPos + D * t0;
  gPix = max(length(fwidth(P0)), 1e-5);
  float r0 = length(P0.xz);
  float tl0 = (level - camPos.y) / D.y;
  float gPixL = max(length(fwidth(camPos + D * tl0)), 1e-5);
  if (r0 >= RI && r0 <= RO) {
    col = rimCol(P0);
  } else if (r0 < RI) {
    vec3 oc = P0 - vec3(0.0, CY, 0.0);
    float b = dot(oc, D), c = dot(oc, oc) - RS * RS, disc = max(b * b - c, 0.0);
    float tb = -b + sqrt(disc);
    vec3 Pb = P0 + D * tb;
    float tl = level > -DEP ? (level - P0.y) / D.y : 1e9;
    if (tl < tb) {
      vec3 P = P0 + D * tl;
      gPix = gPixL;
      vec2 g = swellGrad(P.xz, stageT) * swell + ripGrad(P.xz) + vortGrad(P.xz);
      vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
      vec3 V = -D;
      float fr = fresnel(V, N);
      vec3 R = reflect(D, N);
      float r = length(P.xz);
      float sa = swirlAng(r);
      // what it mirrors: the room (analytic), the letters (the mirrored render); in the vortex smeared round
      vec2 ruv0 = FRAG_PX + vec2(N.x, -N.z) * reflBend * ${H.toFixed(1)};
      vec3 refl = vec3(0.0);
      int taps = swirl > 0.01 ? 6 : 1;
      for (int k = 0; k < 6; k++) {
        if (k >= taps) break;
        float f = taps > 1 ? float(k) / 5.0 : 0.0;
        float a = sa * (1.0 - 0.4 * f);
        vec3 Rk = R; Rk.xz = rot2(-a) * Rk.xz;
        vec3 e = env(P, Rk);
        if (reflOn > 0.0) {
          vec2 d = rot2(a) * (ruv0 - vortPx);
          vec4 rt = texture(reflTex, (vortPx + d) / vec2(${W.toFixed(1)}, ${H.toFixed(1)}));
          if (any(isnan(rt)) || any(isinf(rt))) rt = vec4(0.0);
          e = mix(e, rt.rgb, rt.a);
        }
        refl += e;
      }
      refl /= float(taps);
      float lb = lightAt(P, N) * (1.0 - staffShadow(P));
      float spec = pow(max(dot(N, normalize(normalize(Lc - P) + V)), 0.0), 260.0) * fallAt(P);
      vec3 liq = mix(C_INK * 0.5, C_WINE, wine) + clayCol(lb) * 0.006 + refl * (0.3 + 0.7 * fr) * gloss
        + mix(C_EMBER, C_BONE, 0.45) * spec * 0.5 * specK;
      // shallow: the painting shows through, darkened by the wine
      float depth = level - (CY - sqrt(max(RS * RS - r * r, 0.0)));
      float a = smoothstep(0.0, 0.09, depth);
      vec3 under = bowlCol(Pb, D);
      col = mix(under + refl * 0.2 * gloss * (1.0 - a), liq, a);
      // the meniscus: a hair of light where the potion meets the wall
      col += clayCol(lb) * 0.25 * (1.0 - smoothstep(0.0, 0.006 + gPix, depth - 0.0)) * a;
    } else {
      col = bowlCol(Pb, D);
    }
  } else {
    // outside the cup: its handles (just under the rim), its outer wall seen past the rim, the hall's floor
    vec3 col2 = C_INK;
    float th = (-0.28 - camPos.y) / D.y;
    vec3 Ph = camPos + D * th;
    float hd = 1e3;
    for (int s = 0; s < 2; s++) {
      vec2 hp = Ph.xz - vec2(s == 0 ? RO + 0.42 : -RO - 0.42, 0.0);
      hd = min(hd, abs(cSdEll(hp, vec2(0.62, 0.36))) - 0.075);
    }
    hd = max(hd, RO - 0.05 - length(Ph.xz));
    vec3 oc = P0 - vec3(0.0, CY, 0.0);
    float RSO = sqrt(RO * RO + CY * CY);
    float b = dot(oc, D), c = dot(oc, oc) - RSO * RSO, disc = b * b - c;
    float te = disc > 0.0 ? -b - sqrt(disc) : -1.0;
    float tf = (FLOORY - P0.y) / D.y;
    if (false) {
      vec3 N = vec3(0.0, 1.0, 0.0);
      float edge = smoothstep(-0.075, 0.0, hd);
      col = C_INK * 0.6 + clayCol(lightAt(Ph, N)) * 0.03 + mix(C_EMBER, C_SIGNAL, 0.5) * 0.012 * fallAt(Ph) * smoothstep(0.4, 0.9, 1.0 - edge) * (1.0 - smoothstep(0.9, 1.0, 1.0 - edge));
    } else if (te > 0.0 && (P0 + D * te).y > -DEP - 0.3) {
      vec3 P = P0 + D * te;
      vec3 N = normalize(P - vec3(0.0, CY, 0.0));
      float fr = fresnel(-D, N);
      col = C_INK * 0.7 + clayCol(lightAt(P, N)) * 0.04 + hall(P, reflect(D, N)) * (0.2 + fr);
    } else {
      vec3 P = P0 + D * tf;
      float sh = cupShadow(P);
      float lb = lightAt(P, vec3(0.0, 1.0, 0.0)) * (1.0 - sh) * (1.0 - staffShadow(P));
      col = C_INK * 0.8 + clayCol(lb) * 0.02;
    }
  }
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  fragColor = vec4(col, 1.0);
}`;

export interface CupState {
  level: number;
  wine?: number;
  gloss?: number;
  swell?: number;
  reflBend?: number;
  spec?: number;
  swirl?: number;
  swirlT?: number;
  /** The staff's shadow on the rim plane: butt (x, z) and tip (x, z), and how much of it lies there. */
  staff?: [number, number, number, number];
  staffOn?: number;
  /** Rings on the potion: [x, z, start time, strength]. */
  rips?: [number, number, number, number][];
  tondoRot?: number;
  /** Mirror the (non-hero) letters in the potion (default true). */
  mirror?: boolean;
  dancePh?: number;
}

/** The cup and the letters on (and in) its potion. */
export class CupStage {
  readonly cam = new StageCam();
  readonly scene = new THREE.Scene();
  readonly bg: FSPass;
  words: Word3D[] = [];
  private refl: THREE.WebGLRenderTarget | null = null;
  private Lc = new THREE.Vector3();
  constructor() {
    this.bg = new FSPass(CUP_FRAG, {
      invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, Lc: { value: new THREE.Vector3() },
      LI: { value: 1 }, reach: { value: 30 }, level: { value: FULL }, wine: { value: 0.6 }, gloss: { value: 0.8 }, specK: { value: 0.05 },
      reflOn: { value: 0 }, reflTex: { value: null }, stageT: { value: 0 }, swell: { value: 0.3 }, reflBend: { value: 0.06 },
      swirl: { value: 0 }, swirlT: { value: 0 }, vortPx: { value: new THREE.Vector2(W / 2, H / 2) },
      staff: { value: new THREE.Vector4() }, staffOn: { value: 0 },
      rip: { value: Array.from({ length: MAX_RIP }, () => new THREE.Vector4()) }, nRip: { value: 0 }, tondoRot: { value: 0 }, dancePh: { value: 0 },
    });
  }
  private noMirror = new Set<Word3D>();
  add(w: Word3D, o: { mirror?: boolean } = {}) {
    clipWord(w);
    if (o.mirror === false) this.noMirror.add(w);
    this.words.push(w);
    this.scene.add(w.group);
  }
  private setClip(y: number, s: number) {
    for (const w of this.words) for (const l of w.letters) { l.mat.uniforms.clipY!.value = y; l.mat.uniforms.clipS!.value = s; }
  }
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, t: number, L: StageLight, S: CupState) {
    const u = this.bg.u;
    const Lc = this.Lc.set(L.base.x, L.base.y + L.h * 0.33, L.base.z);
    this.cam.invVP(u.invVP!.value as THREE.Matrix4);
    (u.camPos!.value as THREE.Vector3).copy(this.cam.cam.position);
    (u.Lc!.value as THREE.Vector3).copy(Lc);
    u.LI!.value = L.I; u.reach!.value = L.reach;
    u.level!.value = S.level; u.wine!.value = S.wine ?? 0.6; u.gloss!.value = S.gloss ?? 0.8; u.specK!.value = S.spec ?? 0.05;
    u.swell!.value = S.swell ?? 0.3; u.reflBend!.value = S.reflBend ?? 0.06; u.stageT!.value = t;
    u.swirl!.value = S.swirl ?? 0; u.swirlT!.value = S.swirlT ?? 0;
    const vp = this.cam.project({ x: 0, y: S.level, z: 0 });
    (u.vortPx!.value as THREE.Vector2).set(vp.x, H - vp.y);
    const st = S.staff ?? [0, 0, 0, 0];
    (u.staff!.value as THREE.Vector4).set(...st);
    u.staffOn!.value = S.staffOn ?? 0;
    const rips = (S.rips ?? []).filter((r) => t >= r[2] && t - r[2] < 2.5).sort((a, b) => b[2] - a[2]).slice(0, MAX_RIP);
    rips.forEach((r, i) => (u.rip!.value as THREE.Vector4[])[i]!.set(...r));
    u.nRip!.value = rips.length;
    u.tondoRot!.value = S.tondoRot ?? 0; u.dancePh!.value = S.dancePh ?? 0;
    for (const w of this.words) w.light(Lc, L.I, L.reach, 1, this.cam.cam.position);
    // the potion mirrors the letters: the scene rendered upside down about its surface, clipped at it
    if (S.level > -CUP.D + 0.01) {
      this.refl ??= makeRT();
      renderer.setRenderTarget(this.refl);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      this.setClip(S.level, -1);
      for (const w of this.words) w.group.visible = S.mirror !== false && !this.noMirror.has(w);
      this.scene.scale.y = -1; this.scene.position.y = 2 * S.level; this.scene.updateMatrixWorld(true);
      renderer.render(this.scene, this.cam.cam);
      this.scene.scale.y = 1; this.scene.position.y = 0; this.scene.updateMatrixWorld(true);
      for (const w of this.words) w.group.visible = true;
      u.reflTex!.value = this.refl.texture; u.reflOn!.value = 1;
    } else u.reflOn!.value = 0;
    this.bg.render(renderer, out);
    // the letters: clipped at the potion while they stand in it (letters on the rim stand above y 0 anyway)
    this.setClip(S.level > -CUP.D + 0.01 ? S.level : -100, 1);
    renderer.setRenderTarget(out);
    renderer.clearDepth();
    renderer.render(this.scene, this.cam.cam);
  }
}
