// Plate 6 `uv`: the frame shader. A pillowcase (white cotton, folds and the evidence crease, sewn edges, the hem band
// with its stitching) laid out on a black bench in the dark; the only light is a hand-held UV wand (a black housing,
// a long filter window over a tube) held by a gloved fist above the far side of the case, raking its violet beam
// across the cloth. Where the beam lands the dried traces fluoresce fluor-white (uv-type.ts: one word per id, gated
// by the scene). A second gloved hand works a cotton swab on the patch under HANDS. Everything is ray-traced in one
// pass: the cloth as a height field, the wand + fist and the swab hand as SDFs in their own frames (bounding boxes).
// Units: mm, world z up, the bench at z = 0.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL } from '../../engine/gl';
import { CLOTH, PATCH, TW, TH, TPPM } from './uv-type';

const f = (x: number) => x.toFixed(3);

export const NW = 48;

export const UV_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
uniform mat4 invVP; uniform vec3 camPos; uniform vec2 res;
uniform sampler2D covTex, idTex;
uniform vec4 W[${NW}];          // per word id: level (gate x exit x decay), threshold, beam gain, residual
uniform vec3 lC, lX, lY, lZ;    // the wand: window centre, tube axis, across, window normal (out, toward the cloth)
uniform float lampK, irrNorm;
uniform vec3 sP, sX, sY, sZ; uniform float swabOn, swabGlow;
uniform vec4 strokes[5]; uniform float strokeK[5]; uniform float patchK;
uniform float pxAng;
uniform vec3 wordBounce;        // the glow of the lit words, as light onto the hands above them

const vec2 CH = vec2(${f((CLOTH.x1 - CLOTH.x0) / 2)}, ${f((CLOTH.y1 - CLOTH.y0) / 2)});

// ------------------------------------------------------------------ the lamp
// A line source (the tube, 140 mm) behind a window, in a reflector: across the tube a beam of about +-27 degrees,
// along it a cosine lobe; inverse square from the nearest point of the tube. irrNorm makes the flat cloth under the
// aim point 1.0.
float irr(vec3 p, vec3 N) {
  vec3 d = p - lC;
  float s = clamp(dot(d, lX), -70.0, 70.0);
  vec3 v = p - (lC + lX * s);
  float r2 = max(dot(v, v), 1.0);
  vec3 l = v * inversesqrt(r2);
  float cz = dot(l, lZ);
  if (cz <= 0.0) return 0.0;
  float ty = abs(dot(l, lY)) / cz;
  float prof = 1.0 - smoothstep(0.2, 0.44, ty);
  float along = pow(cz, 5.0);
  // a faint wide spill from the housing's lip, so the pool's edge has a tail and not a cut
  prof = prof * along + 0.02 * pow(cz, 2.0) * (1.0 - smoothstep(0.4, 1.4, ty));
  return min(lampK * irrNorm * prof * max(dot(N, -l), 0.0) * inversesqrt(r2), 3.0);
}
vec3 toLamp(vec3 p) {
  float s = clamp(dot(p - lC, lX), -70.0, 70.0);
  return normalize(lC + lX * s - p);
}

// ------------------------------------------------------------------ the cloth
float wrinkle(vec2 p) {
  vec2 q = p + 22.0 * vec2(snoise(p * 0.0045), snoise(p * 0.0045 + 7.3));
  float r1 = 1.0 - abs(snoise(q * vec2(0.0042, 0.0095)));
  float r2 = 1.0 - abs(snoise(rot2(0.7) * q * vec2(0.006, 0.013) + 3.1));
  float r3 = 1.0 - abs(snoise(rot2(-0.4) * q * 0.03 + 9.7));
  return 1.35 * r1 * r1 * r1 + 0.6 * r2 * r2 * r2 + 0.22 * r3 * r3 * r3 + 0.15 * snoise(q * 0.02);
}
float clothE(vec2 p) {
  // the case is not cut straight: its sewn edges wander a few mm, and its corners are soft
  vec2 w = vec2(snoise(vec2(p.y * 0.011, 1.7)), snoise(vec2(p.x * 0.009, 4.2))) * 3.5;
  return -(sdBox(p + w, CH - 3.0) - 3.0);
}
float height(vec2 p) {
  float e = clothE(p);
  if (e < 0.0) return 0.0;
  float edge = sqrt(sat(e / 3.5));
  float inner = sat(e / 30.0);
  float h = 2.4 * edge + inner * max(wrinkle(p), -1.6);
  // the evidence fold: the case was folded in half for the bag; its crease runs across, a valley with soft shoulders
  float dx = p.x + 24.0 + 5.0 * snoise(vec2(p.y * 0.012, 3.0));
  h += inner * (-1.2 * exp(-dx * dx / 8.0) + 0.7 * exp(-dx * dx / 260.0));
  // the seam allowance under the three sewn edges; the hem band at the open end (a double layer)
  h += 0.35 * exp(-pow((e - 9.0) / 3.0, 2.0)) * (1.0 - smoothstep(286.0, 290.0, p.x));
  h += 0.55 * smoothstep(287.0, 291.0, p.x) * edge;
  return max(h, 0.0);
}
float tHit(vec3 ro, vec3 rd) {
  float t = (7.0 - ro.z) / rd.z;
  for (int i = 0; i < 6; i++) {
    vec3 p = ro + rd * t;
    t += (p.z - height(p.xy)) / (-rd.z) * 0.85;
  }
  return t;
}
vec3 clothN(vec2 p) {
  const float e = 0.5;
  float hx = height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0));
  float hy = height(p + vec2(0.0, e)) - height(p - vec2(0.0, e));
  // the cotton's tooth (a soft fbm, coarser than the weave, which would alias)
  vec2 g = vec2(snoise(p * 0.9), snoise(p * 0.9 + 5.1)) * 0.035 + vec2(snoise(p * 2.3 + 2.0), snoise(p * 2.3 + 8.0)) * 0.02;
  return normalize(vec3(-hx / (2.0 * e) - g.x, -hy / (2.0 * e) - g.y, 1.0));
}
float foldShadow(vec3 p, vec3 l) {
  float sh = 1.0;
  for (int i = 1; i <= 7; i++) {
    float s = float(i) * 2.2;
    vec3 q = p + l * s;
    sh = min(sh, sat(1.0 + (q.z - height(q.xy)) * 1.6));
  }
  return sh;
}

// ------------------------------------------------------------------ the traces
vec2 cuv(vec2 p) { return vec2((p.x - ${f(CLOTH.x0)}) / ${f(CLOTH.x1 - CLOTH.x0)}, (p.y - ${f(CLOTH.y0)}) / ${f(CLOTH.y1 - CLOTH.y0)}); }
float gLod = 0.0;
float traceGlow(vec2 p, float E) {
  vec2 uv = cuv(p);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  ivec2 ij = clamp(ivec2(uv * vec2(${TW}.0, ${TH}.0)), ivec2(0), ivec2(${TW - 1}, ${TH - 1}));
  int id = int(texelFetch(idTex, ij, 0).r * 255.0 + 0.5);
  if (id <= 0 || id >= ${NW}) return 0.0;
  vec4 w = W[id];
  if (w.x <= 0.0) return 0.0;
  float cov = textureLod(covTex, uv, gLod).r;
  // dried saliva: an irregular edge (it wicked into the weave), a mottled body, a brighter tide line at the rim
  float n = 0.035 * fbm(p * 0.16, 3) + 0.03 * snoise(p * 1.1);
  float c = cov + n;
  float body = smoothstep(w.y - 0.045, w.y + 0.045, c);
  float rim = exp(-pow((c - w.y - 0.03) / 0.03, 2.0));
  float mott = 0.84 + 0.12 * snoise(p * 0.08 + 3.0) + 0.05 * snoise(p * 0.5);
  float amt = body * mott + rim * 0.4 * sat(body * 4.0);
  return amt * w.x * (E * w.z + w.w);
}
// the patch under HANDS (a dried, broken trace), minus where the swab has lifted it
float patchGlow(vec2 p, float E) {
  if (patchK <= 0.0) return 0.0;
  vec2 q = (p - vec2(${f(PATCH.x)}, ${f(PATCH.y)})) / vec2(${f(PATCH.rx)}, ${f(PATCH.ry)});
  float d = length(q) - 1.0 + 0.22 * snoise(p * 0.025) + 0.08 * snoise(p * 0.09);
  float m = 1.0 - smoothstep(-0.3, 0.04, d);
  if (m <= 0.0) return 0.0;
  m *= 0.62 + 0.38 * smoothstep(-0.4, 0.5, fbm(p * 0.05, 3));
  m += 0.4 * exp(-pow((d + 0.06) / 0.06, 2.0));   // its tide line
  float lift = 0.0;
  for (int k = 0; k < 5; k++) {
    float pk = strokeK[k];
    if (pk <= 0.0) continue;
    vec2 a = strokes[k].xy, b = mix(strokes[k].xy, strokes[k].zw, pk);
    float ds = sdSegment(p, a, b) + 1.1 * snoise(p * 0.45 + float(k) * 3.0);
    lift = max(lift, 1.0 - smoothstep(4.0, 6.5, ds));
  }
  return m * (1.0 - 0.9 * lift) * patchK * (E * 0.42 + 0.02);
}
// the hem's stitching: polyester thread fluoresces where the beam passes
float stitch(vec2 p) {
  float on = 1.0 - smoothstep(0.35, 0.7, abs(p.x - 293.0));
  float dash = smoothstep(0.15, 0.3, abs(fract(p.y / 3.2) - 0.5));
  return on * dash;
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

// ------------------------------------------------------------------ the wand and the fist (lamp frame: x along the
// tube toward the handle, y across, z out of the window; the housing behind the window, z < 0)
// a point on a ring round the handle's axis (x, at angle a in the y-z plane, radius r)
vec3 ring(float x, float a, float r) { return vec3(x, cos(a) * r, -16.0 + sin(a) * r); }
float sdFist(vec3 q) {
  // four fingers wrapped round the handle from the palm (on +y), over the window side (+z), to the far side
  float d = 1e9;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float x = 120.0 + fk * 17.5;
    float r = mix(8.6, 7.0, fk / 3.0);
    float R = 13.5 + r * 0.85;
    float lean = 2.5;
    d = min(d, finger(q, ring(x + lean, 0.25, R + 2.0), ring(x, 1.05, R), ring(x - lean * 0.5, 1.95, R), ring(x - lean, 2.75, R - 1.5), vec4(r * 1.08, r, r * 0.95, r * 0.86)));
  }
  float palm = sdEll(q - vec3(152.0, 27.0, -22.0), vec3(44.0, 15.0, 27.0));
  float thumb = finger(q, vec3(128.0, 24.0, -36.0), vec3(112.0, 14.0, -36.0), vec3(100.0, 6.0, -34.0), vec3(93.0, 1.0, -32.5), vec4(10.0, 9.0, 8.2, 7.6));
  float wrist = rcap(q, vec3(178.0, 24.0, -30.0), vec3(290.0, 30.0, -95.0), 24.0, 26.0);
  float h = smin(smin(palm, thumb, 6.0), wrist, 12.0);
  d = smin(d, h, 5.5);
  // the rolled cuff, and the glove ends there
  vec3 ax = normalize(vec3(112.0, 6.0, -65.0));
  vec3 c0 = vec3(178.0, 24.0, -30.0) + ax * 62.0;
  float along = dot(q - c0, ax);
  float rad = length(q - c0 - ax * along);
  d = smin(d, length(vec2(rad - 25.5, along)) - 4.2, 1.2);
  return max(d, along - 3.0);
}
float sdSleeveW(vec3 q) {
  vec3 ax = normalize(vec3(112.0, 6.0, -65.0));
  vec3 c0 = vec3(178.0, 24.0, -30.0) + ax * 62.0;
  return max(rcap(q, c0, c0 + ax * 220.0, 30.0, 34.0), -dot(q - c0, ax) + 2.0);
}
float sdWand(vec3 q, out int m) {
  float head = sdRBox(q - vec3(0.0, 0.0, -17.0), vec3(90.0, 26.0, 17.0), 6.0);
  float win = sdRBox(q, vec3(77.0, 16.5, 1.8), 1.2);
  head = max(head, -win);
  float glass = sdRBox(q - vec3(0.0, 0.0, -1.3), vec3(77.0, 16.5, 0.5), 0.4);
  float handle = rcap(q, vec3(86.0, 0.0, -16.0), vec3(205.0, 0.0, -16.0), 14.5, 13.0);
  handle = smin(handle, sdRBox(q - vec3(205.0, 0.0, -16.0), vec3(5.0, 15.0, 15.0), 3.0), 2.0);
  float body = smin(head, handle, 7.0);
  float d = body; m = 1;
  if (glass < d) { d = glass; m = 2; }
  float g = sdFist(q);
  if (g < d) { d = g; m = 0; }
  float sl = sdSleeveW(q);
  if (sl < d) { d = sl; m = 3; }
  return d;
}
float sdWandD(vec3 q) { int m; return sdWand(q, m); }
vec3 toL(vec3 p) { vec3 d = p - lC; return vec3(dot(d, lX), dot(d, lY), dot(d, lZ)); }
vec3 dirL(vec3 v) { return vec3(dot(v, lX), dot(v, lY), dot(v, lZ)); }
vec3 fromL(vec3 v) { return lX * v.x + lY * v.y + lZ * v.z; }
const vec3 WLO = vec3(-100.0, -40.0, -140.0), WHI = vec3(520.0, 75.0, 30.0);

// ------------------------------------------------------------------ the swab hand (swab frame: origin at the cotton
// tip, x along the shaft toward the hand, z up off the shaft, y lateral)
float sdSwabHand(vec3 q, out int m) {
  float tip = sdEll(q - vec3(4.5, 0.0, 0.0), vec3(8.5, 2.8, 2.8));
  float shaft = rcap(q, vec3(8.0, 0.0, 0.0), vec3(158.0, 0.0, 0.0), 1.15, 1.25);
  float d = tip; m = 5;
  if (shaft < d) { d = shaft; m = 6; }
  float ix = finger(q, vec3(64.0, 0.0, 3.6), vec3(80.0, -1.0, 9.5), vec3(97.0, -2.0, 17.5), vec3(121.0, -3.0, 23.0), vec4(6.2, 7.0, 7.8, 9.0));
  float th = finger(q, vec3(60.0, 6.8, 0.6), vec3(76.0, 13.5, 4.5), vec3(93.0, 18.0, 10.5), vec3(114.0, 14.0, 19.0), vec4(7.0, 7.7, 8.5, 10.0));
  float mi = finger(q, vec3(68.0, -5.6, -3.2), vec3(84.0, -12.0, 1.5), vec3(100.0, -16.0, 9.5), vec3(122.0, -16.5, 18.0), vec4(6.0, 6.8, 7.6, 8.8));
  float ri = finger(q, vec3(92.0, -19.0, -4.0), vec3(105.0, -24.0, 3.0), vec3(118.0, -25.0, 11.0), vec3(130.0, -22.0, 18.0), vec4(5.8, 6.4, 7.0, 8.0));
  float palm = sdEll(q - vec3(142.0, -5.0, 27.0), vec3(36.0, 29.0, 14.0));
  float wrist = rcap(q, vec3(160.0, -5.0, 33.0), vec3(300.0, -8.0, 72.0), 22.0, 24.0);
  float g = smin(smin(smin(ix, th, 1.8), smin(mi, ri, 1.8), 1.8), smin(palm, wrist, 12.0), 6.0);
  vec3 ax = normalize(vec3(140.0, -3.0, 39.0));
  vec3 c0 = vec3(160.0, -5.0, 33.0) + ax * 60.0;
  float along = dot(q - c0, ax);
  float rad = length(q - c0 - ax * along);
  g = smin(g, length(vec2(rad - 23.5, along)) - 4.0, 1.2);
  g = max(g, along - 3.0);
  if (g < d) { d = g; m = 0; }
  float sl = max(rcap(q, c0, c0 + ax * 220.0, 28.0, 32.0), -along + 2.0);
  if (sl < d) { d = sl; m = 3; }
  return d;
}
float sdSwabD(vec3 q) { int m; return sdSwabHand(q, m); }
vec3 toS(vec3 p) { vec3 d = p - sP; return vec3(dot(d, sX), dot(d, sY), dot(d, sZ)); }
vec3 dirS(vec3 v) { return vec3(dot(v, sX), dot(v, sY), dot(v, sZ)); }
vec3 fromS(vec3 v) { return sX * v.x + sY * v.y + sZ * v.z; }
const vec3 SLO = vec3(-10.0, -60.0, -40.0), SHI = vec3(520.0, 50.0, 260.0);

float marchW(vec3 ro, vec3 rd, out int m) {
  m = -1;
  vec3 o = toL(ro), d = dirL(rd);
  vec2 bh = boxHit(o, d, WLO, WHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1e9;
  float t = max(bh.x, 0.0);
  for (int i = 0; i < 160; i++) {
    if (t > bh.y) break;
    int mm; float h = sdWand(o + d * t, mm);
    if (h < 0.03) { m = mm; return t; }
    t += h * 0.85;
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
  for (int i = 0; i < 160; i++) {
    if (t > bh.y) break;
    int mm; float h = sdSwabHand(o + d * t, mm);
    if (h < 0.02) { m = mm; return t; }
    t += h * 0.85;
  }
  return 1e9;
}
// the swab hand's shadow in the beam
float swabShadow(vec3 p) {
  if (swabOn < 0.5) return 1.0;
  vec3 l = toLamp(p);
  vec3 o = toS(p), d = dirS(l);
  vec2 bh = boxHit(o, d, SLO, SHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1.0;
  float t = max(bh.x, 0.3), res = 1.0;
  for (int i = 0; i < 48; i++) {
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
vec3 gloveCol(vec3 P, vec3 N, vec3 V, float E, vec3 bounceC) {
  // matte black nitrile: the violet only where light reaches it, a broad soft sheen, the pool's bounce from below
  vec3 alb = T_SILVER * 0.09;
  vec3 L = toLamp(P), Hh = normalize(L + V);
  float nv = max(dot(N, V), 0.0);
  float spec = ggx(N, Hh, 0.55) * (0.05 + 0.25 * pow(1.0 - nv, 5.0)) * 0.7;
  float down = sat(-N.z * 0.8 + 0.2);
  return alb * T_UV * E * 1.4 + T_UV * spec * E * 0.6 + bounceC * down * (alb * 1.2 + 0.02);
}
vec3 shadeWand(vec3 P, vec3 rd, int m) {
  vec3 q = toL(P);
  const vec2 k = vec2(1.0, -1.0); const float e = 0.08;
  vec3 nl = normalize(k.xyy * sdWandD(q + k.xyy * e) + k.yyx * sdWandD(q + k.yyx * e) + k.yxy * sdWandD(q + k.yxy * e) + k.xxx * sdWandD(q + k.xxx * e));
  vec3 N = fromL(nl), V = -rd;
  // the pool below lights the undersides violet (and the glow of the words a little)
  vec3 bounceC = T_UV * 0.05 * lampK + wordBounce * 0.5;
  if (m == 2) {
    // the filter window: Wood's glass, near-black violet, the tube glowing through it (brightest along its axis)
    float tube = exp(-q.y * q.y / 18.0) * (1.0 - smoothstep(66.0, 76.0, abs(q.x)));
    float glassK = 0.55 + 2.6 * tube;
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    return T_UV * glassK * lampK * (1.0 - fres) + T_HALIDE * fres * 0.02;
  }
  if (m == 1) {
    // satin black housing; a violet lip where the window's light leaks at the bezel
    vec2 wq = abs(q.xy) - vec2(77.0, 16.5);
    float dw = length(max(wq, 0.0)) + min(max(wq.x, wq.y), 0.0);
    float lip = exp(-max(dw, 0.0) / 1.6) * smoothstep(-7.0, -0.5, q.z);
    vec3 Hh = normalize(vec3(0.0, 0.0, -1.0) + V);
    float sheen = ggx(N, normalize(-vec3(0.0, 0.0, 1.0) + V), 0.35) * 0.02;
    return T_FILM2 * 0.4 + bounceC * sat(-N.z * 0.8 + 0.2) * 0.25 + T_UV * lip * 0.9 * lampK + T_UV * sheen * lampK;
  }
  if (m == 3) {
    float weave = 0.9 + 0.1 * snoise(q * vec3(0.5, 3.0, 3.0));
    return T_FILM2 * 0.6 * weave + bounceC * sat(-N.z) * 0.05;
  }
  // the fist: the window's own spill reaches the index finger beside the head
  float spill = exp(-max(q.x - 90.0, 0.0) / 22.0) * sat(dot(nl, normalize(vec3(-0.6, 0.0, 0.8))));
  return gloveCol(P, N, V, 0.0, bounceC) + T_UV * spill * 0.05 * lampK;
}
vec3 shadeSwab(vec3 P, vec3 rd, int m) {
  vec3 q = toS(P);
  const vec2 k = vec2(1.0, -1.0); const float e = 0.05;
  vec3 nl = normalize(k.xyy * sdSwabD(q + k.xyy * e) + k.yyx * sdSwabD(q + k.yyx * e) + k.yxy * sdSwabD(q + k.yxy * e) + k.xxx * sdSwabD(q + k.xxx * e));
  vec3 N = fromS(nl), V = -rd;
  float E = irr(P, N);
  vec3 bounceC = T_UV * 0.05 * lampK + wordBounce;
  if (m == 5) {
    // the cotton tip: violet where the beam reaches it, and the glow it has lifted off the cloth
    float fib = 0.85 + 0.15 * snoise(q * 1.6);
    return T_UV * 0.42 * E * fib + T_FLUOR * swabGlow * (0.55 + 0.45 * fib) * (0.35 + 0.65 * sat(E * 1.5)) + bounceC * 0.3;
  }
  if (m == 6) {
    return T_UV * 0.12 * E + bounceC * 0.08 * sat(-N.z + 0.3);
  }
  if (m == 3) return T_FILM2 * 0.6 + T_UV * 0.05 * E;
  return gloveCol(P, N, V, E, bounceC);
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
  gLod = log2(max(tC * pxAng / max(-rd.z, 0.15) * ${TPPM}.0 * 0.7, 1.0));
  float inside = smoothstep(-0.5, 0.5, clothE(p));
  vec3 N = inside > 0.0 ? clothN(p) : vec3(0.0, 0.0, 1.0);
  float E = irr(P, N);
  vec3 col;
  if (E > 1e-4) {
    vec3 l = toLamp(P);
    E *= foldShadow(P + vec3(0.0, 0.0, 0.05), l) * swabShadow(P);
  }
  // the bench: black, a faint grain; the cloth: white cotton, its violet reflectance
  vec3 bench = T_UV * 0.025 * E * (0.85 + 0.15 * snoise(p * 0.05)) + T_FILM * 0.25;
  float alb = 0.78 * (0.94 + 0.06 * snoise(p * 0.21));
  vec3 cloth = T_UV * 0.3 * alb * min(E, 2.4) + T_FLUOR * 0.008 * E + T_FILM * 0.2;
  // the hem band's slight shade (a double layer, a hair less translucent) and its stitching
  cloth += T_FLUOR * stitch(p) * 0.05 * sat(E);
  col = mix(bench, cloth, inside);
  if (inside > 0.0) {
    float g = traceGlow(p, E) + patchGlow(p, E);
    col += T_FLUOR * g * inside;
  }
  return col;
}

void main() {
  vec3 c = vec3(0.0);
  for (int k = ssK0(); k < ssK1(); k++) c += shade(gl_FragCoord.xy + rgss(k) * PX_SCALE);
  fragColor = vec4(c * ssWeight(), 1.0);
}`;
