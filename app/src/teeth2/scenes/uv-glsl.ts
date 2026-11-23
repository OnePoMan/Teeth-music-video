// Plate 6 `uv`: the frame shader. A white cotton pillowcase (soft folds, the closed end and the side seam stitched, the
// far long edge a fold, the hemmed open end with its two layers, an EXHIBIT 5 tag lying on the hem) on a black bench
// in the dark. The only light is a short hand-held UV lamp (a tube behind a filter window in a black housing, a handle
// in a matte black nitrile glove) whose beam makes a soft pool on the cloth, about 40% of the frame wide: outside the
// pool the cloth is near film black; inside, a dark, low-saturation violet. Dried traces fluoresce fluor-white only
// where the beam is or has just been (the excitation memory M: the pool's recent positions, fading over ~0.5 s).
// A second gloved hand draws a cotton swab across the hero's own trace: the swabbed band goes dark, the tip glows.
// Everything is ray-traced in one pass: the cloth as a height field, the lamp + fist and the swab hand as SDFs in
// their own frames. Units: mm, world z up, the bench at z = 0.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL } from '../../engine/gl';
import { CLOTH, TAG, TW, TH, TPPM } from './uv-type';

const f = (x: number) => x.toFixed(3);

// The lamp glove's fingers, in the lamp frame round the handle's axis (y = 0, z = -15): per finger, tip -> knuckle,
// [x, angle (deg; 0 = the camera's side, -90 = the top, +90 = under, toward the cloth), distance from the axis, radius].
// A flashlight grip: the back of the hand on the camera's side, the knuckle row along its lower edge, the fingers
// curled under the handle and up its far side; the thumb along the top toward the head.
const FINGERS: [number, number, number, number][][] = [
  [[97, 222, 19.5, 5.7], [97.5, 180, 22, 6.4], [97, 122, 23.5, 7.1], [96, 52, 24.5, 8.1]],
  [[114, 228, 20, 5.8], [114.5, 186, 22.5, 6.5], [114, 126, 24, 7.2], [113, 55, 25.5, 8.4]],
  [[130.5, 226, 19.5, 5.6], [131, 184, 22, 6.3], [130.5, 125, 23.5, 7.0], [130, 58, 25, 8.1]],
  [[146.5, 220, 18.5, 5.2], [147, 180, 20.5, 5.8], [146.5, 124, 22, 6.4], [146, 62, 23.5, 7.3]],
];
const v3 = ([x, a, R]: number[]) => `vec3(${f(x!)}, ${f(R! * Math.cos((a! * Math.PI) / 180))}, ${f(-15 + R! * Math.sin((a! * Math.PI) / 180))})`;
const THUMB = [[70, -98, 21], [82, -92, 22.5], [96, -82, 24], [112, -60, 26]];
const LAMP_GLOVE = `const vec3 LT0 = ${v3(THUMB[0]!)}, LT1 = ${v3(THUMB[1]!)}, LT2 = ${v3(THUMB[2]!)}, LT3 = ${v3(THUMB[3]!)}, THEN = ${v3([104, -45, 20])};
const vec3 LF[16] = vec3[16](${FINGERS.flat().map(v3).join(', ')});
const vec4 LR[4] = vec4[4](${FINGERS.map((g) => `vec4(${g.map((j) => f(j[3]!)).join(', ')})`).join(', ')});
const vec3 LW0 = vec3(158.0, 30.0, -22.0), LW1 = vec3(262.0, 52.0, -86.0);`;

export const NW = 48;
export const NM = 8;

export const UV_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
uniform mat4 invVP; uniform vec3 camPos; uniform vec2 res;
uniform sampler2D covTex, idTex, tagTex;
uniform vec4 W[${NW}];          // per word id: level (gate x line x decay), threshold, beam gain, the readable floor
uniform vec4 W2[${NW}];         // per word id: the trace's pose on the cloth: anchor (mm), scale x, y (stamp, stretch, condense)
uniform float WL[${NW}];        // per word id: its lean (a shear, DEVIL)
uniform vec3 lC, lX, lY, lZ;    // the lamp: window centre, tube axis (toward the handle), across, window normal
uniform float lampK;
uniform float lS;               // the lamp rig's scale (round 1 review: a smaller torch and hand, whole in frame)
uniform vec2 Q, pAx; uniform float pR;   // the pool now: centre, tube axis on the cloth, radius across (mm)
uniform vec4 M[${NM}];          // the pool's recent positions: centre, radius, weight (fading with age)
uniform vec3 sP, sX, sY, sZ; uniform float swabOn, swabGlow;
uniform float gSide;            // which side of the handle faces the camera (the lamp glove mirrored to it)
uniform vec4 strokes[5]; uniform float strokeK[5], strokeW[5];
uniform float pxAng;
uniform vec3 wordBounce;        // the glow of the lit words, as light onto the hands above them

const vec2 CH = vec2(${f((CLOTH.x1 - CLOTH.x0) / 2)}, ${f((CLOTH.y1 - CLOTH.y0) / 2)});
// the cloth in the pool: dark, low-saturation violet (cotton under a Wood's lamp), and what it bounces
const vec3 POOLC = T_UV * 0.032 + T_HALIDE * 0.04;
const float HEM0 = 286.0;
// the room's dim film2 ambient (checkpoint review item 1): the case's folds, weave, seams and hem read outside the
// beam; a soft light from the far side and above, so the folds' far faces fall back to film-black
uniform float ambK;
const vec3 AMBD = vec3(-0.25, 0.62, 0.74);

// ------------------------------------------------------------------ the beam
float poolN = 0.0;   // the pool edge's wobble at this point (the reflector's unevenness), set per pixel
float poolF(vec2 p, vec2 q, float R) {
  vec2 d = p - q;
  float r = length(vec2(dot(d, pAx) / (1.45 * R), dot(d, vec2(-pAx.y, pAx.x)) / R)) + poolN;
  return (1.0 - smoothstep(0.42, 1.08, r)) + 0.035 * exp(-r * r * 0.7);
}
vec3 toLamp(vec3 p) {
  float s = clamp(dot(p - lC, lX), -48.0 * lS, 48.0 * lS);
  return normalize(lC + lX * s - p);
}
// irradiance at P (normal N): the pool, shaded by the facing toward the tube (1 on flat cloth)
float irr(vec3 P, vec3 N) {
  vec3 L = toLamp(P);
  float lam = max(dot(N, L), 0.0) / max(L.z, 0.3);
  return lampK * poolF(P.xy, Q, pR) * min(lam, 2.2);
}
// the traces' excitation: the pool now and where it has just been
float excite(vec2 p) {
  float e = 0.0;
  for (int k = 0; k < ${NM}; k++) {
    if (M[k].w <= 0.0) continue;
    e = max(e, M[k].w * poolF(p, M[k].xy, M[k].z));
  }
  return e;
}

// ------------------------------------------------------------------ the cloth
float wrinkle(vec2 p) {
  vec2 q = p + 26.0 * vec2(snoise(p * 0.004), snoise(p * 0.004 + 7.3));
  float a = snoise(q * vec2(0.0036, 0.009));
  float b = snoise(rot2(0.6) * q * vec2(0.006, 0.014) + 3.1);
  float r1 = 1.0 - sqrt(a * a + 0.03);
  float r2 = 1.0 - sqrt(b * b + 0.05);
  float c3 = snoise(rot2(1.1) * q * vec2(0.011, 0.03) + 5.5);
  float r3 = 1.0 - sqrt(c3 * c3 + 0.02);
  return 2.1 * r1 * r1 + 0.75 * r2 * r2 + 0.55 * r3 * r3 * r3 + 0.12 * snoise(rot2(-0.5) * q * 0.022 + 9.7) + 0.7 * snoise(q * 0.0025);
}
float clothE(vec2 p) {
  vec2 w = vec2(snoise(vec2(p.y * 0.011, 1.7)), snoise(vec2(p.x * 0.009, 4.2))) * 3.0;
  return -(sdBox(p + w, CH - 4.0) - 4.0);
}
// the open end: the top layer stops here; the bottom layer runs on to the case's edge
float topEdge(float y) { return CH.x - 9.0 + 2.5 * snoise(vec2(y * 0.02, 5.0)); }
float height(vec2 p) {
  float e = clothE(p);
  if (e < 0.0) return 0.0;
  float edge = sqrt(sat(e / 5.0));
  float inner = sat(e / 45.0);
  // two layers of cotton, the far long edge a soft fold (rounder), the near one a seam
  float fold = smoothstep(CH.y - 40.0, CH.y, p.y);
  float h = (2.4 + 2.4 * fold) * edge + inner * (1.4 + 2.4 * wrinkle(p));
  // the evidence crease (the case was folded for the bag): a soft valley
  float dx = p.x + 24.0 + 5.0 * snoise(vec2(p.y * 0.012, 3.0));
  h += inner * (-0.8 * exp(-dx * dx / 18.0) + 0.45 * exp(-dx * dx / 320.0));
  // the seams: along the near long edge and across the closed end, the allowance a ridge 9 mm in
  float ns = p.y + CH.y, ce = p.x + CH.x;
  h += 0.7 * exp(-pow((ns - 9.0) / 2.6, 2.0)) * (1.0 - smoothstep(HEM0 - 4.0, HEM0, p.x));
  h += 0.7 * exp(-pow((ce - 9.0) / 2.6, 2.0));
  // the hem band at the open end: a stiffer double layer, its folds flattened
  float hem = smoothstep(HEM0 - 2.0, HEM0 + 2.0, p.x);
  h = mix(h, 3.0 * edge + inner * (1.4 + wrinkle(p)), hem * 0.6) + 0.6 * hem * edge;
  // the mouth: the top layer lifts a little toward its edge and stops; beyond it only the bottom layer
  float te = topEdge(p.y);
  h += 1.4 * smoothstep(te - 40.0, te - 1.0, p.x) * edge;
  h = mix(h, 0.9 * edge, smoothstep(te - 0.4, te + 0.4, p.x));
  return max(h, 0.0);
}
float tHit(vec3 ro, vec3 rd) {
  float t = (16.0 - ro.z) / rd.z;
  for (int i = 0; i < 9; i++) {
    vec3 p = ro + rd * t;
    t += (p.z - height(p.xy)) / (-rd.z) * 0.85;
  }
  return t;
}
vec3 clothN(vec2 p) {
  const float e = 0.5;
  float hx = height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0));
  float hy = height(p + vec2(0.0, e)) - height(p - vec2(0.0, e));
  vec2 g = vec2(snoise(p * 0.9), snoise(p * 0.9 + 5.1)) * 0.03;
  return normalize(vec3(-hx / (2.0 * e) - g.x, -hy / (2.0 * e) - g.y, 1.0));
}
float foldShadow(vec3 p, vec3 l) {
  float sh = 1.0;
  for (int i = 1; i <= 7; i++) {
    vec3 q = p + l * float(i) * 2.4;
    sh = min(sh, sat(1.0 + (q.z - height(q.xy)) * 1.4));
  }
  return sh;
}
// the plain weave of the cotton (threads ~0.55 mm), faded out where a pixel covers several threads
float weave(vec2 p) {
  vec2 a = p / 0.55;
  float row = floor(a.y), col = floor(a.x);
  float wx = sin(3.1416 * fract(a.x)), wy = sin(3.1416 * fract(a.y));
  float over = mod(row + col, 2.0);
  float th = mix(wy, wx, over);   // the thread on top at this cell
  return 0.45 + 0.55 * th * (0.85 + 0.15 * snoise(vec2(row, col) * 0.7));
}
float weaveK = 0.0;
// the stitching: polyester thread fluoresces (a dashed line, 3 mm stitches)
float stitchLine(float d, float along) {
  return (1.0 - smoothstep(0.3, 0.65, abs(d))) * smoothstep(0.12, 0.28, abs(fract(along / 3.0) - 0.5));
}

// ------------------------------------------------------------------ the swab's band
// each stroke: one continuous soft band along the tip's path (the cotton rolled flat, ~17 mm wide), its width easing
// slowly along the stroke, round where the tip is now
float swabLift(vec2 p) {
  float lift = 0.0;
  for (int k = 0; k < 5; k++) {
    float pk = strokeK[k];
    if (pk <= 0.0) continue;
    vec2 a = strokes[k].xy, b = mix(strokes[k].xy, strokes[k].zw, pk);
    vec2 dir = normalize(strokes[k].zw - strokes[k].xy);
    float hw = strokeW[k] + 0.9 * snoise(vec2(dot(p, dir) * 0.035, float(k) * 3.7));
    float ds = sdSegment(p, a, b);
    lift = max(lift, 1.0 - smoothstep(hw - 2.5, hw + 1.0, ds));
  }
  return lift;
}

// ------------------------------------------------------------------ the traces
vec2 cuv(vec2 p) { return vec2((p.x - ${f(CLOTH.x0)}) / ${f(CLOTH.x1 - CLOTH.x0)}, (p.y - ${f(CLOTH.y0)}) / ${f(CLOTH.y1 - CLOTH.y0)}); }
float gLod = 0.0;
float traceGlow(vec2 p, float X, float lift) {
  vec2 uv = cuv(p);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  ivec2 ij = clamp(ivec2(uv * vec2(${TW}.0, ${TH}.0)), ivec2(0), ivec2(${TW - 1}, ${TH - 1}));
  int id = int(texelFetch(idTex, ij, 0).r * 255.0 + 0.5);
  if (id <= 0 || id >= ${NW}) return 0.0;
  vec4 w = W[id];
  if (w.x <= 0.0) return 0.0;
  // the word's pose (round 1): the baked trace read through its stamp, stretch, condense and lean about its anchor
  vec4 a = W2[id];
  vec2 q = p - a.xy;
  q.x -= WL[id] * q.y;
  uv = cuv(a.xy + q / a.zw);
  // (read only the word's own trace: where the pose reaches into a neighbour's, nothing)
  ivec2 ij2 = clamp(ivec2(uv * vec2(${TW}.0, ${TH}.0)), ivec2(0), ivec2(${TW - 1}, ${TH - 1}));
  int id2 = int(texelFetch(idTex, ij2, 0).r * 255.0 + 0.5);
  if (id2 != id && id2 != 0) return 0.0;
  float cov = mix(textureLod(covTex, uv, gLod).r, textureLod(covTex, uv, gLod + 1.6).r, 0.45);
  // dried saliva wicked into the weave: a soft, broken edge, an uneven body (60-100%), thin places
  float n = 0.06 * fbm(p * 0.07, 3) + 0.035 * snoise(p * 0.7) + 0.02 * snoise(p * 2.1);
  float c = cov + n;
  float body = smoothstep(w.y - 0.16, w.y + 0.1, c);
  float thin = smoothstep(-0.75, -0.05, fbm(p * 0.03 + 11.0, 2));
  body *= mix(0.5, 1.0, thin);
  float mott = 0.6 + 0.4 * smoothstep(-0.55, 0.55, fbm(p * 0.028 + 4.0, 3));
  mott *= 0.93 + 0.07 * snoise(p * 0.25);
  // the glow bleeds a little into the threads round the deposit
  float halo = 0.16 * smoothstep(0.08, 0.5, textureLod(covTex, uv, gLod + 2.5).r);
  float amt = max(body * mott, halo * thin) * mix(0.9 + 0.1 * snoise(p * 3.0), weave(p) * 1.25, weaveK);
  // the swab lifts the beam's glow off the cloth down to the dried floor, never below it (lead 2026-11-22); the floor
  // (w.w) is the stain the beam is not on: readable, ~40 luma steps over the cloth round it (R23)
  return amt * w.x * (X * w.z * (1.0 - 0.97 * lift) + w.w);
}

// ------------------------------------------------------------------ the tag (manila card; brightener in the paper)
float tagMask(vec2 p, out vec2 tuv) {
  vec2 l = rot2(${f(-TAG.rot)}) * (p - vec2(${f(TAG.x)}, ${f(TAG.y)}));
  tuv = l / vec2(${f(2 * TAG.hx)}, ${f(2 * TAG.hy)}) + 0.5;
  // the card, its tied end clipped at the corners, the reinforced hole
  float d = sdBox(l, vec2(${f(TAG.hx)}, ${f(TAG.hy)}) - 1.0) - 1.0;
  d = max(d, dot(vec2(-l.x, abs(l.y)), normalize(vec2(1.0, 1.0))) - ${f(TAG.hx + TAG.hy - 7)});
  float hole = length(l - vec2(${f(-TAG.hx + 6)}, 0.0)) - 2.6;
  return (1.0 - smoothstep(-0.3, 0.3, d)) * smoothstep(-0.2, 0.2, hole);
}
float tagString(vec2 p) {
  vec2 a = vec2(${f(TAG.x)}, ${f(TAG.y)}) + rot2(${f(TAG.rot)}) * vec2(${f(-TAG.hx + 6)}, 0.0);
  float d = 1e9;
  vec2 b = a;
  for (int i = 1; i <= 6; i++) {
    float s = float(i) / 6.0;
    // (round 1: it falls away toward the near edge, clear of the row the tag ends)
    vec2 c = a + vec2(-24.0 * s, -58.0 * s + 14.0 * s * s) + vec2(5.0 * sin(s * 5.0), 0.0);
    d = min(d, sdSegment(p, b, c));
    b = c;
  }
  return 1.0 - smoothstep(0.35, 0.8, d);
}

// ------------------------------------------------------------------ SDF helpers
float sdRBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float rcap(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a; float h = sat(dot(pa, ba) / dot(ba, ba));
  return length(pa - ba * h) - mix(ra, rb, h);
}
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float finger(vec3 p, vec3 a, vec3 b, vec3 c, vec3 d, vec4 r) {
  float f = rcap(p, a, b, r.x, r.y);
  f = smin(f, rcap(p, b, c, r.y, r.z), 1.4);
  return smin(f, rcap(p, c, d, r.z, r.w), 1.6);
}
vec2 boxHit(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  vec3 iv = 1.0 / rd; vec3 t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
float ggx(vec3 N, vec3 H, float rough) {
  float a2 = rough * rough * rough * rough, nh = max(dot(N, H), 0.0);
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * dd * dd);
}

// ------------------------------------------------------------------ the glove (the one glove of the film: the matte
// film2 nitrile of match-glsl.ts, same finger, palm, wrist and rolled-cuff construction). The lamp hand: lamp frame,
// y mirrored by gSide so the back of the hand and the knuckles always face the camera's side of the handle. The
// back of the hand lies over the handle's top, the four fingers curl from the knuckle row down the near side and
// under it, the thumb lies along the far top edge toward the head.
${LAMP_GLOVE}
float sdLampGlove(vec3 q) {
  q.y *= gSide;
  float d = 1e9;
  for (int k = 0; k < 4; k++) d = smin(d, finger(q, LF[k * 4], LF[k * 4 + 1], LF[k * 4 + 2], LF[k * 4 + 3], LR[k]), 1.8);
  float th = finger(q, LT0, LT1, LT2, LT3, vec4(6.4, 7.5, 9.2, 11.0));
  d = smin(d, th, 1.8);
  float back = sdEll(q - vec3(122.0, 25.0, -16.0), vec3(38.0, 12.0, 26.0));
  float then = sdEll(q - THEN, vec3(22.0, 14.0, 14.0));
  float wrist = rcap(q, LW0, LW1, 23.0, 25.0);
  float palm = smin(smin(back, then, 14.0), wrist, 14.0);
  d = smin(d, palm, 6.5);
  vec3 ax = normalize(LW1 - LW0);
  vec3 c = q - (LW0 + ax * 50.0);
  float along = dot(c, ax);
  float rad = length(c - ax * along);
  d = smin(d, length(vec2(rad - 25.4, along)) - 4.3, 1.2);
  return max(d, along - 3.0);   // the glove ends at the roll
}
float sdLampSleeve(vec3 q) {
  q.y *= gSide;
  vec3 ax = normalize(LW1 - LW0);
  vec3 c0 = LW0 + ax * 50.0;
  return max(rcap(q, c0, c0 + ax * 170.0, 29.0, 33.0), -dot(q - c0, ax) + 2.0);
}
// creases in the nitrile at the joints (a height field for the shading normal)
float jn(vec3 q, vec3 c, float r2) { vec3 d = q - c; return exp(-dot(d, d) / r2); }
float lampCrease(vec3 q) {
  q.y *= gSide;
  float mk = 0.0;
  for (int k = 0; k < 4; k++) mk += jn(q, LF[k * 4 + 1], 30.0) + jn(q, LF[k * 4 + 2], 45.0) + 0.6 * jn(q, LF[k * 4 + 3], 70.0);
  mk += jn(q, LT1, 40.0) + jn(q, LT2, 60.0);
  float ph = atan(q.z + 15.0, q.y) * 34.0 + 2.2 * snoise(q * 0.18);
  return mk * (0.5 + 0.5 * sin(ph)) * 0.55 + 0.01 * snoise(q * 0.7);
}
// The swab hand: the match glove itself (a tripod grip, swab frame), set back up the shaft; the index and middle
// pads closed a little onto the thin stick.
const float SG = 68.0;   // (round 1: gripped further up the shaft, so the hand stays clear of the word it draws through)
const vec3 SW0 = vec3(138.0, -18.0, 2.0), SW1 = vec3(205.0, -12.0, 6.0);
float sdSwabGlove(vec3 p) {
  p.x -= SG;
  float th = finger(p, vec3(30.0, 8.0, 0.6), vec3(47.0, 14.0, 3.0), vec3(70.0, 19.0, -2.0), vec3(98.0, 14.0, -9.0), vec4(6.4, 7.5, 9.2, 11.0));
  float ix = finger(p, vec3(24.0, -1.4, 7.2), vec3(40.0, -3.0, 11.0), vec3(54.0, -5.0, 20.0), vec3(80.0, -11.0, 16.0), vec4(5.9, 6.7, 7.5, 9.3));
  float mi = finger(p, vec3(26.0, -6.8, -2.6), vec3(40.0, -13.0, -6.0), vec3(55.0, -22.0, -2.0), vec3(84.0, -27.0, 8.0), vec4(6.1, 6.9, 7.7, 9.5));
  float ri = finger(p, vec3(52.0, -30.0, -14.0), vec3(66.0, -35.0, -11.0), vec3(80.0, -40.0, -4.0), vec3(100.0, -42.0, 6.0), vec4(6.6, 7.3, 7.9, 9.0));
  float li = finger(p, vec3(66.0, -43.0, -18.0), vec3(78.0, -49.0, -14.0), vec3(92.0, -53.0, -7.0), vec3(108.0, -54.0, 2.0), vec4(5.7, 6.3, 6.9, 7.9));
  float d = smin(smin(th, ix, 1.8), smin(mi, smin(ri, li, 1.8), 1.8), 1.8);
  float back = sdEll(p - vec3(114.0, -20.0, 6.0), vec3(38.0, 32.0, 13.0));
  float then = sdEll(p - vec3(110.0, 10.0, -8.0), vec3(28.0, 18.0, 12.0));
  float wrist = rcap(p, SW0, SW1, 23.0, 25.0);
  float palm = smin(smin(back, then, 14.0), wrist, 14.0);
  d = smin(d, palm, 6.5);
  vec3 ax = normalize(SW1 - SW0);
  vec3 q = p - (SW0 + ax * 50.0);
  float along = dot(q, ax);
  float rad = length(q - ax * along);
  d = smin(d, length(vec2(rad - 25.4, along)) - 4.3, 1.2);
  return max(d, along - 3.0);
}
float sdSwabSleeve(vec3 p) {
  p.x -= SG;
  vec3 ax = normalize(SW1 - SW0);
  return max(rcap(p, SW0 + ax * 50.0, SW0 + ax * 190.0, 29.0, 33.0), -dot(p - SW0 - ax * 52.0, ax));
}
float swabCrease(vec3 q) {
  q.x -= SG;
  float mk = jn(q, vec3(40.0, -3.0, 11.0), 30.0) + jn(q, vec3(54.0, -5.0, 20.0), 45.0) + jn(q, vec3(80.0, -11.0, 18.0), 70.0)
    + jn(q, vec3(47.0, 14.0, 3.0), 40.0) + jn(q, vec3(70.0, 21.0, -2.0), 60.0) + jn(q, vec3(40.0, -13.0, -6.0), 30.0)
    + jn(q, vec3(55.0, -22.0, -2.0), 45.0) + 0.6 * jn(q, vec3(84.0, -27.0, 8.0), 80.0);
  float ph = q.x * 1.55 + 2.2 * snoise(q * 0.18);
  return mk * (0.5 + 0.5 * sin(ph)) * 0.55 + 0.01 * snoise(q * 0.7);
}

// ------------------------------------------------------------------ the lamp (lamp frame: x along the tube toward the
// handle, y across, z out of the window; the housing behind the window, z < 0)
float sdWand(vec3 q, out int m) {
  // a short lamp: the head 124 x 48 mm, the window 100 x 26, a ribbed handle
  float head = sdRBox(q - vec3(0.0, 0.0, -15.0), vec3(62.0, 24.0, 15.0), 6.0);
  float win = sdRBox(q, vec3(50.0, 13.0, 1.8), 1.2);
  head = max(head, -win);
  float glass = sdRBox(q - vec3(0.0, 0.0, -1.3), vec3(50.0, 13.0, 0.5), 0.4);
  float handle = rcap(q, vec3(58.0, 0.0, -15.0), vec3(175.0, 0.0, -15.0), 14.0, 12.5);
  handle = smin(handle, sdRBox(q - vec3(176.0, 0.0, -15.0), vec3(5.0, 14.0, 14.0), 3.0), 2.0);
  float body = smin(head, handle, 7.0);
  float d = body; m = 1;
  if (glass < d) { d = glass; m = 2; }
  float g = sdLampGlove(q);
  if (g < d) { d = g; m = 0; }
  float sl = sdLampSleeve(q);
  if (sl < d) { d = sl; m = 3; }
  return d;
}
float sdWandD(vec3 q) { int m; return sdWand(q, m); }
vec3 toL(vec3 p) { vec3 d = p - lC; return vec3(dot(d, lX), dot(d, lY), dot(d, lZ)) / lS; }
vec3 dirL(vec3 v) { return vec3(dot(v, lX), dot(v, lY), dot(v, lZ)); }
vec3 fromL(vec3 v) { return lX * v.x + lY * v.y + lZ * v.z; }
const vec3 WLO = vec3(-72.0, -105.0, -180.0), WHI = vec3(410.0, 105.0, 36.0);

// ------------------------------------------------------------------ the swab hand (swab frame: origin at the cotton
// tip, x along the shaft toward the hand, z up off the shaft, y lateral)
float sdSwabHand(vec3 q, out int m) {
  float tip = sdEll(q - vec3(4.5, 0.0, 0.0), vec3(8.5, 2.9, 2.9));
  float shaft = rcap(q, vec3(8.0, 0.0, 0.0), vec3(158.0, 0.0, 0.0), 1.15, 1.25);
  float d = tip; m = 5;
  if (shaft < d) { d = shaft; m = 6; }
  float g = sdSwabGlove(q);
  if (g < d) { d = g; m = 0; }
  float sl = sdSwabSleeve(q);
  if (sl < d) { d = sl; m = 3; }
  return d;
}
float sdSwabD(vec3 q) { int m; return sdSwabHand(q, m); }
vec3 toS(vec3 p) { vec3 d = p - sP; return vec3(dot(d, sX), dot(d, sY), dot(d, sZ)); }
vec3 dirS(vec3 v) { return vec3(dot(v, sX), dot(v, sY), dot(v, sZ)); }
vec3 fromS(vec3 v) { return sX * v.x + sY * v.y + sZ * v.z; }
const vec3 SLO = vec3(-10.0, -68.0, -38.0), SHI = vec3(440.0, 38.0, 46.0);

float marchW(vec3 ro, vec3 rd, out int m) {
  m = -1;
  vec3 o = toL(ro), d = dirL(rd) / lS;
  vec2 bh = boxHit(o, d, WLO, WHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1e9;
  float t = max(bh.x, 0.0);
  for (int i = 0; i < 140; i++) {
    if (t > bh.y) break;
    int mm; float h = sdWand(o + d * t, mm);
    if (h < 0.03) { m = mm; return t; }
    t += h * 0.85 * lS;
  }
  return 1e9;
}
float marchS(vec3 ro, vec3 rd, out int m) {
  m = -1;
  if (swabOn < 0.5) return 1e9;
  vec3 o = toS(ro), d = dirS(rd);
  vec2 bh = boxHit(o, d, SLO, SHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1e9;
  float t = max(bh.x, 0.0);
  for (int i = 0; i < 140; i++) {
    if (t > bh.y) break;
    int mm; float h = sdSwabHand(o + d * t, mm);
    if (h < 0.02) { m = mm; return t; }
    t += h * 0.85;
  }
  return 1e9;
}
float swabShadow(vec3 p) {
  if (swabOn < 0.5) return 1.0;
  vec3 l = toLamp(p);
  vec3 o = toS(p), d = dirS(l);
  vec2 bh = boxHit(o, d, SLO, SHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1.0;
  float t = max(bh.x, 0.3), res = 1.0;
  for (int i = 0; i < 40; i++) {
    if (t > bh.y) break;
    float h = sdSwabD(o + d * t);
    res = min(res, 10.0 * h / t);
    if (res < 0.01) break;
    t += clamp(h, 0.3, 8.0);
  }
  res = sat(res);
  return res * res * (3.0 - 2.0 * res);
}

// ------------------------------------------------------------------ shading
// the glove: matte film2 nitrile (match-glsl.ts), a dark body with a broad soft sheen; its only light is the UV tube,
// a violet rim on the planes that face it (rimL: the tube's strength at P, Lr: toward it), and a trace of the lit
// cloth's bounce in the planes that face down onto it
vec3 gloveCol(vec3 N, vec3 V, vec3 bounceC, float rimL, vec3 Lr) {
  float nv = max(dot(N, V), 0.0);
  float fr = pow(1.0 - nv, 2.5);
  vec3 base = T_FILM2 * (0.75 + 0.45 * nv);
  float wrap = sat(dot(N, Lr) * 0.85 + 0.15);
  vec3 rim = mix(T_UV, T_HALIDE, 0.45) * rimL * wrap * sqrt(wrap) * (0.025 + 0.34 * fr);
  float spec = ggx(N, normalize(Lr + V), 0.62) * (0.04 + 0.2 * pow(1.0 - nv, 5.0)) * 0.3 * rimL;
  float down = sat(-N.z * 0.8 + 0.1);
  return base + rim + mix(T_UV, T_HALIDE, 0.6) * spec + bounceC * down * 0.05;
}
// the nitrile's creases: the normal tilted by a crease field's gradient (its tangential part)
vec3 creased(vec3 nl, vec3 g) { g -= nl * dot(g, nl); return normalize(nl - g * 0.9); }
vec3 shadeWand(vec3 P, vec3 rd, int m) {
  vec3 q = toL(P);
  const vec2 k = vec2(1.0, -1.0); const float e = 0.08;
  vec3 nl = normalize(k.xyy * sdWandD(q + k.xyy * e) + k.yyx * sdWandD(q + k.yyx * e) + k.yxy * sdWandD(q + k.yxy * e) + k.xxx * sdWandD(q + k.xxx * e));
  vec3 N = fromL(nl), V = -rd;
  vec3 bounceC = POOLC * 1.6 * lampK + wordBounce * 0.6;
  if (m == 2) {
    // the filter window: Wood's glass, near-black violet, the short tube glowing through it
    float tube = exp(-q.y * q.y / 14.0) * (1.0 - smoothstep(40.0, 49.0, abs(q.x)));
    float glassK = 0.3 + 3.2 * tube;
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    return T_UV * glassK * lampK * (1.0 - fres) + T_HALIDE * fres * 0.03;
  }
  // the tube's leak round the bezel and through the housing's seams: light from the window's rim
  vec3 near = vec3(clamp(q.x, -50.0, 50.0), clamp(q.y, -13.0, 13.0), 0.0);
  vec3 Ll = near - q; float dl = length(Ll); Ll /= max(dl, 1e-3);
  float rimL = lampK * 2.4 / (1.0 + pow(dl / 45.0, 2.0));
  if (m == 1) {
    vec2 wq = abs(q.xy) - vec2(50.0, 13.0);
    float dw = length(max(wq, 0.0)) + min(max(wq.x, wq.y), 0.0);
    float lip = exp(-max(dw, 0.0) / 1.8) * smoothstep(-7.0, -0.5, q.z);
    float sheen = ggx(nl, normalize(dirL(V) + Ll), 0.35) * 0.05 * rimL;
    // the handle's ribs
    float rib = q.x > 70.0 ? 0.8 + 0.2 * smoothstep(-0.3, 0.3, sin(q.x * 1.3)) : 1.0;
    return (T_FILM2 * (0.5 + 0.45 * ambK * sat(dot(N, normalize(AMBD)))) + bounceC * sat(-N.z * 0.8 + 0.2) * 0.4) * rib + T_UV * lip * 1.1 * lampK + mix(T_UV, T_HALIDE, 0.4) * sheen;
  }
  vec3 Lr = fromL(Ll);
  if (m == 3) {
    float weaveS = 0.9 + 0.1 * snoise(q * vec3(0.5, 3.0, 3.0));
    return T_FILM2 * 0.7 * weaveS + bounceC * sat(-N.z) * 0.06 + T_UV * 0.02 * rimL * sat(dot(N, Lr));
  }
  // the glove: the tube's direct light reaches only what is in front of the window's plane (z > 0); behind it, its leak
  const float ec = 0.25;
  vec3 g = vec3(lampCrease(q + vec3(ec, 0.0, 0.0)) - lampCrease(q - vec3(ec, 0.0, 0.0)), lampCrease(q + vec3(0.0, ec, 0.0)) - lampCrease(q - vec3(0.0, ec, 0.0)), lampCrease(q + vec3(0.0, 0.0, ec)) - lampCrease(q - vec3(0.0, 0.0, ec))) / (2.0 * ec);
  N = fromL(creased(nl, g));
  return gloveCol(N, V, bounceC, rimL * (0.35 + 0.65 * smoothstep(-6.0, 6.0, q.z)), Lr);
}
vec3 shadeSwab(vec3 P, vec3 rd, int m) {
  vec3 q = toS(P);
  const vec2 k = vec2(1.0, -1.0); const float e = 0.05;
  vec3 nl = normalize(k.xyy * sdSwabD(q + k.xyy * e) + k.yyx * sdSwabD(q + k.yyx * e) + k.yxy * sdSwabD(q + k.yxy * e) + k.xxx * sdSwabD(q + k.xxx * e));
  vec3 N = fromS(nl), V = -rd;
  float E = irr(P, N);
  vec3 bounceC = POOLC * 1.6 * lampK + wordBounce;
  if (m == 5) {
    // the cotton tip: cotton glows a little under UV itself; and the trace it has lifted glows on it
    float fib = 0.85 + 0.15 * snoise(q * 1.6);
    return POOLC * 4.0 * E * fib + T_FLUOR * swabGlow * (0.6 + 0.4 * fib) * (0.4 + 0.6 * sat(E * 1.5)) + bounceC * 0.3;
  }
  if (m == 6) return POOLC * 2.5 * E + bounceC * 0.1 * sat(-N.z + 0.3);
  if (m == 3) return T_FILM2 * (0.12 + 0.25 * max(dot(N, V), 0.0)) + POOLC * 0.5 * E + bounceC * sat(-N.z) * 0.1;
  const float ec = 0.25;
  vec3 g = vec3(swabCrease(q + vec3(ec, 0.0, 0.0)) - swabCrease(q - vec3(ec, 0.0, 0.0)), swabCrease(q + vec3(0.0, ec, 0.0)) - swabCrease(q - vec3(0.0, ec, 0.0)), swabCrease(q + vec3(0.0, 0.0, ec)) - swabCrease(q - vec3(0.0, 0.0, ec))) / (2.0 * ec);
  N = fromS(creased(nl, g));
  return gloveCol(N, V, bounceC, 0.6 * irr(P, N), toLamp(P));
}

vec3 shade(vec2 px) {
  vec2 ndc = px / res * 2.0 - 1.0;
  vec4 qq = invVP * vec4(ndc, 1.0, 1.0);
  vec3 ro = camPos, rd = normalize(qq.xyz / qq.w - camPos);
  float tC = tHit(ro, rd);
  int mw, ms;
  float tW = marchW(ro, rd, mw);
  float tS = marchS(ro, rd, ms);
  if (tW < tC && tW < tS) return shadeWand(ro + rd * tW, rd, mw);
  if (tS < tC) return shadeSwab(ro + rd * tS, rd, ms);
  vec3 P = ro + rd * tC;
  vec2 p = P.xy;
  float foot = tC * pxAng / max(-rd.z, 0.15);   // mm per pixel on the cloth
  gLod = log2(max(foot * ${TPPM}.0 * 0.7, 1.0));
  weaveK = 1.0 - smoothstep(0.09, 0.2, foot);
  poolN = 0.06 * snoise(p * 0.011 + 3.0) + 0.03 * snoise(p * 0.04);
  float inside = smoothstep(-0.5, 0.5, clothE(p));
  vec3 N = inside > 0.0 ? clothN(p) : vec3(0.0, 0.0, 1.0);
  float E = irr(P, N);
  if (E > 1e-4) E *= foldShadow(P + vec3(0.0, 0.0, 0.05), toLamp(P)) * swabShadow(P);
  float X = excite(p);
  // the bench: black, a faint grain where the pool spills onto it
  vec3 bench = POOLC * 0.12 * E * (0.85 + 0.15 * snoise(p * 0.05)) + T_FILM * 0.22;
  // the cloth: white cotton; the mouth of the open end in shadow; the band the swab has wetted a shade darker
  float lift = swabLift(p);
  float alb = (0.94 + 0.06 * snoise(p * 0.21)) * mix(1.0, weave(p), weaveK * 0.5) * (1.0 - 0.18 * lift);
  float te = topEdge(p.y);
  alb *= 1.0 - 0.75 * exp(-pow((p.x - te - 1.2) / 1.8, 2.0));
  float amb = sat(0.1 + 0.9 * dot(N, normalize(AMBD)));
  amb = amb * amb * amb * mix(1.0, weave(p), weaveK * 0.8);
  vec3 cloth = POOLC * alb * E + T_FILM * 0.2 + T_FILM2 * ambK * alb * amb;
  // the stitching: the side seam, the closed end, the hem
  float ns = p.y + CH.y, ce = p.x + CH.x;
  float st = stitchLine(ns - 7.0, p.x) * (1.0 - smoothstep(HEM0 - 4.0, HEM0, p.x)) + stitchLine(ce - 7.0, p.y)
           + stitchLine(p.x - HEM0 - 4.0, p.y) * step(p.x, te);
  cloth += T_FLUOR * st * 0.05 * X;
  vec3 col = mix(bench, cloth, inside);
  if (inside > 0.0) {
    col += T_FLUOR * traceGlow(p, X, lift) * inside * 1.2;
    // the tag: manila card (its brightener glows faint blue-white), the label printed in black, its string
    vec2 tuv; float tm = tagMask(p, tuv);
    if (tm > 0.0) {
      float ink = textureLod(tagTex, tuv, max(gLod - 1.0, 0.0)).r;
      vec3 card = (T_FLUOR * 0.3 * X + POOLC * 1.4 * E + T_FILM2 * ambK * 3.2) * (0.92 + 0.08 * snoise(p * 0.3));
      col = mix(col, card * mix(0.12, 1.0, ink) + T_FILM * 0.15, tm);
    }
    float sg = tagString(p);
    col = mix(col, T_FLUOR * 0.08 * X + POOLC * 1.2 * E + T_FILM * 0.2, sg * 0.8);
  }
  return col;
}

void main() {
  vec3 c = vec3(0.0);
  for (int k = ssK0(); k < ssK1(); k++) c += shade(gl_FragCoord.xy + rgss(k) * PX_SCALE);
  fragColor = vec4(c * ssWeight(), 1.0);
}`;
