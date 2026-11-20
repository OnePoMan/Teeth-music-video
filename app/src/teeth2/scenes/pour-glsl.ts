// `pour` shaders: one ray-marched pass for both halves of the plate, then a depth-of-field gather.
//  mode 0  THE POUR: an upper impression in a perforated stainless tray, on a dental vibrator (painted body, front
//          dial, ribbed rubber platform). Alginate (cool grey) lines the tray: a rim inside the wall and the palate's
//          dome in the middle; the wet stone fills the horseshoe trough the teeth left. Its free surface is a height
//          field: a fine viscous shiver over the whole surface on every stomp, the odd bubble, the relief words rising
//          out of the stone with a meniscus foot, and the set front (gloss to matt) sweeping across on "heart got".
//  mode 1  THE CAST: the upper cast fresh out of the impression, teeth up (the kit's sdCast), on its poured base (an
//          irregular horseshoe patty, slumped at the foot), micro-pitted with bubble voids, on a dark bench with stone
//          crumbs, under one low raking lamp. The line's hero word is raised, shallow and crisp, on the base's front.
// Units mm, bench frame y up. The camera looks from bench -z toward +z (screen right = bench -x). The upper cast
// teeth-up maps to the head frame as head = (x, -y, -z) (teeth.ts); the tray uses the same arch (arch y = bench z).
import { W, H, SS_TAP_GLSL } from '../../engine/gl';
import { GLSL_TEETH_PALETTE } from '../palette';
import { GLSL_TEETH } from '../teeth';
import { GLSL_HAND } from './match-glsl';

export const POUR = {
  /** mode 0: the stone's level, the platform's top, the bench */
  SURF: 12.0, PAD: -2.0, BENCH_A: -64.0,
  /** mode 1: the bench, the poured base's top */
  PB: -30.0, PTOP: -16.5,
  /** the words' surface frames: polar about (x 0, z CEN); A on the stone (radius RA, v inward), B on the base's
   *  side (radius RB, v = y) */
  CEN: 24.0, RA: 24.0, RB: 37.0,
  /** text rects (s, v, width, height), mm; B's s is offset per shot so the word faces the lens */
  RECT_A: [-28.0, -14.0, 56.0, 28.0] as [number, number, number, number],
  RECT_B: [-30.0, -38.0, 60.0, 30.0] as [number, number, number, number],
  /** the model trimmer (mode 1, trim on): the abrasive wheel's face plane (z), its centre (x, y, below the table), radius */
  ZF: 50.0, WCX: -40.0, WCY: -52.0, RW: 125.0,
  /** how many dust motes the shader takes */
  NDUST: 48,
};

export const MARCH_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${GLSL_TEETH}
${GLSL_HAND}
${SS_TAP_GLSL}
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform int mode;
uniform float time;
uniform sampler2D wordTex; uniform vec4 wordRect; uniform float wordDepth, skirtK;
uniform float wRise[8], wWet[8];
uniform vec3 trayOff;                 // the vibration
uniform float setP, wetAll, shiverA;  // the set front, the wetness, the stomp's shiver
uniform vec3 lampPos, lampDir; uniform float lampI, lampCone, lampRef, keyK;
uniform vec3 tubeP; uniform float tubeI, fillK, topK;
uniform vec3 castOff;
uniform float trim, spinA, spinBlur;  // the model trimmer: on, the wheel's angle, its angular smear over the shutter
uniform vec3 hTip, hE1, hE2, hE3; uniform float handOn;   // the glove's frame (bench mm): GLSL_HAND's pen tip, axes
uniform vec4 dustP[${POUR.NDUST}], dustV[${POUR.NDUST}]; uniform int dustN;   // motes: pos + radius, smear + opacity
const float ZF = ${POUR.ZF.toFixed(2)}, RW = ${POUR.RW.toFixed(2)};
const vec2 WC = vec2(${POUR.WCX.toFixed(2)}, ${POUR.WCY.toFixed(2)});
const float SURF = ${POUR.SURF.toFixed(2)}, PAD = ${POUR.PAD.toFixed(2)}, BENCH_A = ${POUR.BENCH_A.toFixed(2)};
const float PB = ${POUR.PB.toFixed(2)}, PTOP = ${POUR.PTOP.toFixed(2)};
const float CEN = ${POUR.CEN.toFixed(2)}, RA = ${POUR.RA.toFixed(2)}, RB = ${POUR.RB.toFixed(2)};

bool SHM = false;   // shadow rays and AO: without the words and the stone's free surface (their conservative bound reads as occlusion)
float sdRBox(vec3 p, vec3 b, float r) { return sdBox3(p, b - r) - r; }

// ------------------------------------------------------------------ the words (a height map on a surface)
// wordTex: r = the letters (lightly blurred: crisp walls), g = the same, widely blurred (the meniscus foot),
// b = ((word index + 1) * 2 + wax) * 10 / 255, unblurred and dilated past the foot
vec4 wordAt(vec2 sv) {
  vec2 uv = (sv - wordRect.xy) / wordRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  vec4 tx = textureLod(wordTex, uv, 0.0);
  float k = floor(tx.b * 25.5 + 0.5);
  if (k < 1.5) return vec4(0.0);
  int idx = clamp(int(k) / 2 - 1, 0, 7);
  float wax = mod(k, 2.0);
  float core = smoothstep(0.2, 0.8, tx.r);
  float h = mix(core, 0.3 * core + 0.7 * smoothstep(0.08, 0.92, tx.g), skirtK);
  float r = wRise[idx];
  return vec4(h * r, wax, wWet[idx], max(tx.r, tx.g) * step(0.001, r));
}
float wordSlope(vec2 sv) {
  const float e = 0.05;
  float h0 = wordAt(sv).x;
  float hx = wordAt(sv + vec2(e, 0.0)).x, hy = wordAt(sv + vec2(0.0, e)).x;
  return length(vec2(hx - h0, hy - h0)) / e;
}
// polar surface frames: s along the arc (screen right +), v inward (A) or up (B)
vec2 svA(vec2 xz) { vec2 d = xz - vec2(0.0, CEN); return vec2(-atan(xz.x, CEN - xz.y) * RA, RA - length(d)); }
vec2 svB(vec3 p) { return vec2(-atan(p.x, CEN - p.z) * RB, p.y); }

// ------------------------------------------------------------------ mode 0: the pour
// bubbles: one per 4.6 mm cell at most; rise as a dome, burst, leave a crater that flows back
float bubbles(vec2 xz, float wet) {
  if (wet < 0.02) return 0.0;
  const float CS = 7.0;
  vec2 c = floor(xz / CS);
  if (hash12(c * 1.37 + 4.1) > 0.22) return 0.0;
  vec2 o = (c + 0.3 + 0.4 * hash22(c + 9.3)) * CS;
  float r0 = 0.45 + 0.6 * hash12(c + 2.7);
  float per = 1.3 + 1.6 * hash12(c + 7.9);
  float a = fract(time / per + hash12(c + 5.5));
  float d = length(xz - o);
  float h = 0.0;
  if (a < 0.75) {
    float g = smoothstep(0.0, 0.75, a);
    float r = r0 * (0.4 + 0.6 * g);
    float q = d / r;
    // the dome, and the slurry drawn up around its foot (a rim)
    h = q < 1.0 ? r * 0.75 * g * sqrt(1.0 - q * q) : 0.0;
    h += r * 0.12 * g * exp(-pow((q - 1.08) / 0.18, 2.0));
  } else {
    // popped: a crater with a raised lip, flowing back level
    float b = (a - 0.75) / 0.25;
    float q = d / (r0 * (1.0 + 0.4 * b));
    float k = (1.0 - b) * (1.0 - b);
    h = -r0 * 0.5 * k * exp(-q * q * 2.5) + r0 * 0.18 * k * exp(-pow((q - 1.0) / 0.22, 2.0));
  }
  return h * wet;
}
// the set front: 0 wet .. 1 set (left to right on screen = bench +x to -x), a ragged edge
float setMask(vec2 xz) {
  float f = mix(42.0, -48.0, setP);
  float u = xz.x + 3.5 * fbm(xz * 0.09 + 3.0, 2);
  return min(1.0, smoothstep(f - 3.5, f + 3.5, u) * step(0.001, setP) + step(0.999, setP));
}
// the stomp: a fine, viscous shiver over the whole wet surface (no rings, no centre), dying fast
float shiver(vec2 xz) {
  vec3 a = vec3(xz * 0.42, time * 5.0), b = vec3(xz * 0.95 + 5.0, time * 8.0 + 3.0);
  return shiverA * (0.026 * snoise(a) + 0.004 * snoise(b));
}
// the alginate's surface (head of the tray frame): the rim inside the wall, the palate's dome; low in the trough
float algH(float al) {
  float rim = 0.0;
  float dome = (1.0 - smoothstep(-19.0, -7.2, al)) * (0.8 + 0.6 * (1.0 - smoothstep(-26.0, -12.0, al)));   // under the stone
  return SURF - 2.2 + rim + dome;
}
// the stone's surface height above SURF at xz; the wetness and the word sample
float surfH(vec2 xz, float al, float t2, out float wet, out vec4 wd) {
  float sm = setMask(xz);
  wet = wetAll * (1.0 - sm);
  wd = wordAt(svA(xz));
  float wall = -t2;   // distance to the tray wall (the stone fills the palate too)
  float h = shiver(xz) * (1.0 - sm) * smoothstep(0.0, 2.0, wall) * (1.0 - smoothstep(0.02, 0.35, wd.w));
  h += bubbles(xz, wet) * (1.0 - wd.w) * smoothstep(1.0, 2.5, wall);
  h += wordDepth * wd.x;
  h += 0.7 * exp(-max(wall, 0.0) / 0.55);   // the meniscus, up the steel and the alginate
  return h;
}
// the stainless tray: walls, floor and the handle out of its front (tray frame: bottom on y = PAD)
float trayShell(vec3 q, float t2) {
  float outer = max(t2 - 1.4, abs(q.y - (SURF + 1.2 + PAD) * 0.5) - (SURF + 1.2 - PAD) * 0.5);
  float inner = max(t2, PAD + 1.2 - q.y);
  float tray = max(outer, -inner);
  // the rim rolled outward
  tray = min(tray, length(vec2(t2 - 1.6, q.y - SURF - 1.0)) - 0.9);
  vec3 hq = q - vec3(0.0, SURF - 0.4, -33.0);
  float handle = sdRBox(hq, vec3(7.0 - 0.05 * (hq.z + 22.0), 1.0, 23.0), 0.9);
  handle = max(handle, -sdCapsule(hq, vec3(0.0, -3.0, -15.0), vec3(0.0, 3.0, -15.0), 2.4));
  return min(tray, handle);
}
float mapA(vec3 p, out int mat) {
  float d = p.y - BENCH_A; mat = 0;
  // the vibrator: a painted body, a dial on its front, the ribbed rubber platform overhanging it
  float bh = (PAD - 8.0 - BENCH_A) * 0.5;
  vec3 bq = p - vec3(0.0, BENCH_A + bh, 24.0);
  float body = sdRBox(bq, vec3(54.0 + 0.04 * (bh - bq.y), bh, 46.0), 8.0);
  if (body < d) { d = body; mat = 1; }
  vec3 kq = p - vec3(-28.0, BENCH_A + bh + 3.0, 24.0 - 46.0);
  float knob = max(length(kq.xy) - 8.0 - 0.25 * sin(atan(kq.y, kq.x) * 18.0), abs(kq.z + 4.0) - 4.0);
  knob = min(knob, max(length(kq.xy) - 11.0, abs(kq.z + 0.6) - 0.6));
  if (knob < d) { d = knob; mat = 7; }
  vec3 sq = p - vec3(26.0, BENCH_A + bh + 3.0, 24.0 - 47.0);
  float sw = sdRBox(sq, vec3(5.0, 8.0, 2.0), 1.5);
  sw = min(sw, sdCapsule(sq, vec3(0.0, 0.0, -1.0), vec3(0.0, 3.5, -6.0), 1.4));
  if (sw < d) { d = sw; mat = 7; }
  vec3 pq = p - vec3(0.0, PAD - 4.0, 24.0);
  float pad = sdRBox(pq, vec3(62.0, 4.0, 54.0), 3.0);
  pad = max(pad, -(sdRBox(pq - vec3(0.0, 4.6, 0.0), vec3(58.0, 1.4, 50.0), 1.0)));   // the raised lip
  if (pad < d) { d = pad; mat = 2; }
  // the tray
  vec3 q = p - trayOff;
  float bnd = sdBox3(q - vec3(0.0, 6.0, -8.0), vec3(46.0, 12.0, 80.0));
  if (bnd > d) return d;
  vec2 al = tArchLine(q.xz, 0);
  float t2 = smax(al.x - 10.5, q.z - 49.0, 3.0);
  float shell = trayShell(q, t2);
  if (shell < d) { d = shell; mat = 3; }
  if (t2 > 0.5) return d;
  float alg = max(t2, (q.y - algH(al.x)) * 0.7);
  if (alg < d) { d = alg; mat = 6; }
  if (SHM) return d;
  if (q.y > SURF - 3.0) {
    float wet = 0.0; vec4 wd = vec4(0.0);
    float h = surfH(q.xz, al.x, t2, wet, wd);
    float g = wd.w > 0.0 ? wordDepth * wordSlope(svA(q.xz)) : 0.0;
    float st = max(t2, (q.y - SURF - h) / sqrt(1.0 + g * g) * 0.75);
    if (st < d) { d = st; mat = 4; }
  }
  return d;
}

// ------------------------------------------------------------------ mode 1: the cast
vec3 toHead(vec3 p) { return vec3(p.x, -p.y, -p.z); }
// the poured base: a slumped horseshoe patty, lumpy, its top ragged
float patty(vec3 p) {
  vec2 al = tArchLine(p.xz, 0);
  float lump = 0.55 * snoise(p * 0.08 + 2.0) + 0.2 * snoise(p * 0.23 + 7.0);
  float slump = 1.4 * smoothstep(PTOP, PB, p.y);
  float side = al.x - (CAST_REACH + 3.2 + slump + lump * 0.35);
  float back = p.z - (50.0 + 2.5 * snoise(vec2(p.x * 0.05, 1.7)));
  float top = p.y - (PTOP + 1.4 * fbm(p.xz * 0.06 + 7.0, 2));
  return max(smax(smax(side, back, 3.0), top, 2.2), PB - p.y);
}
// micro-pitting and bubble voids in the stone
float voids(vec3 p) {
  vec3 c = floor(p / 1.1);
  vec3 h = hash33(c + 3.1);
  float d = 1e3;
  if (h.x < 0.1) { vec3 o = (c + 0.3 + 0.4 * hash33(c + 7.7)) * 1.1; d = length(p - o) - (0.04 + 0.08 * h.y); }
  vec3 c2 = floor(p / 4.0);
  vec3 h2 = hash33(c2 + 11.3);
  if (h2.x < 0.07) { vec3 o = (c2 + 0.3 + 0.4 * hash33(c2 + 5.1)) * 4.0; d = min(d, length(p - o) - (0.15 + 0.25 * h2.y)); }
  return d;
}
// stone crumbs on the bench around the cast (none under it)
float crumbs(vec3 p) {
  float lid = p.y - (PB + 1.7);
  if (lid > 0.5) return lid;
  const float CS = 5.0;
  vec2 c = floor(p.xz / CS);
  vec2 f = p.xz / CS - c;
  float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * CS;
  float bound = max(edge + 0.4, lid);
  vec3 h = hash33(vec3(c, 4.2));
  vec2 o = (c + 0.4 + 0.2 * hash22(c + 1.7)) * CS;
  float rr = length((o - vec2(0.0, 20.0)) / vec2(1.0, 1.25));
  if (h.x > 0.2 * smoothstep(44.0, 48.0, rr) * (1.0 - smoothstep(52.0, 60.0, rr))) return min(bound, 1e3);
  float r = 0.35 + 0.85 * h.y * h.y;
  vec3 q = p - vec3(o.x, PB + r * 0.45, o.y);
  q.xz = rot2(h.z * 6.28) * q.xz;
  // a chip of set stone: a few random cutting planes around a squat core, flat on the bench
  float dd = max(abs(q.y) - r * 0.5, length(q.xz) - r * 1.3);
  for (int k = 0; k < 5; k++) {
    vec3 n = normalize(hash33(vec3(c, float(k) + 9.1)) * 2.0 - 1.0 + vec3(0.0, 0.25, 0.0));
    dd = max(dd, dot(q, n) - r * (0.55 + 0.35 * hash12(c + float(k) * 3.3)));
  }
  return min(dd * 0.9, bound);
}
// the model trimmer: the abrasive wheel (its face at z = ZF, the lower part under the table) and its steel hood ring
float sdWheel(vec3 p) {
  float r = length(p.xy - WC);
  return max(r - RW, abs(p.z - (ZF + 8.0)) - 8.0);
}
float sdHood(vec3 p) {
  float r = length(p.xy - WC);
  float ring = max(abs(r - (RW + 7.0)) - 1.6, abs(p.z - (ZF + 9.0)) - 12.0);
  float lip = max(max(r - (RW + 8.6), (RW + 1.5) - r), abs(p.z - (ZF - 3.0)) - 1.4);   // the rolled front lip
  return min(ring, lip) - 0.4;
}
// the glove (GLSL_HAND's shared model, the pen left out), its forearm carried on out of frame
vec3 toHm(vec3 p) { vec3 d = p - hTip; return vec3(dot(d, hE1), dot(d, hE2), dot(d, hE3)); }
float sdArmP(vec3 p) { p.x -= GRIP; vec3 ax = normalize(W1 - W0); return rcap(p, W0 + ax * 180.0, W0 + ax * 620.0, 32.5, 38.0); }
float handMapP(vec3 q, out int m) {
  float d = sdGlove(q); m = 8;
  float s = min(sdSleeve(q), sdArmP(q));
  if (s < d) { d = s; m = 11; }
  return d;
}
float mapB(vec3 p, out int id, out int mat) {
  p -= castOff;
  mat = 5; id = 0;
  float d = patty(p);
  if (trim > 0.5) d = max(d, p.z - ZF + 0.3);   // the heel ground flat against the wheel
  if (p.y > PTOP - 4.0) {
    int cid;
    float c = sdCast(toHead(p), 0, cid);
    if (c < d) id = cid;
    d = smin(c, d, 2.2);
  }
  // the hero word, raised on the base's front
  if (!SHM && abs(d) < 1.5 && p.z < 10.0) {
    vec2 sv = svB(p);
    vec4 wd = wordAt(sv);
    if (wd.x > 0.0) {
      float g = wordDepth * wordSlope(sv);
      d = (d - wordDepth * wd.x) / sqrt(1.0 + g * g) * 0.9;
    }
  }
  if (!SHM && abs(d) < 0.8) d = max(d, -voids(p));
  float cr = crumbs(p);
  if (cr < d) { d = cr; id = 0; }
  if (trim > 0.5) {
    float w = sdWheel(p);
    if (w < d) { d = w; mat = 9; id = 0; }
    float hd = sdHood(p);
    if (hd < d) { d = hd; mat = 10; id = 0; }
  }
  if (handOn > 0.5) {
    vec3 q = toHm(p);
    float hb = sdBox3(q - vec3(330.0, -12.0, 2.0), vec3(345.0, 62.0, 52.0));
    if (hb < d) {
      int hm; float hd = handMapP(q, hm);
      if (hd < d) { d = hd; mat = hm; id = 0; }
    }
  }
  return d;
}

// ------------------------------------------------------------------ shared
float map(vec3 p, out int id, out int mat) {
  if (mode == 0) { id = 0; return mapA(p, mat); }
  float dB = p.y - PB;
  float d = mapB(p, id, mat);
  if (dB < d) { mat = 0; id = 0; return dB; }
  return d;
}
float mapD(vec3 p) { int id, mat; return map(p, id, mat); }
vec3 nrm(vec3 p, float e) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}
vec2 boxHit(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  vec3 iv = 1.0 / rd; vec3 t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
void sceneBox(out vec3 lo, out vec3 hi) {
  if (mode == 0) { lo = vec3(-75.0, BENCH_A, -70.0); hi = vec3(75.0, SURF + 5.0, 90.0); }
  else if (trim > 0.5 || handOn > 0.5) { lo = vec3(-260.0, PB, -160.0); hi = vec3(200.0, 120.0, 140.0); }
  else { lo = vec3(-130.0, PB, -110.0) + castOff; hi = vec3(130.0, 3.0, 140.0) + castOff; }
}
float shadow(vec3 ro, vec3 rd, float tMax) {
  SHM = true;
  if (mode == 1) teethRay(toHead(ro - castOff), toHead(rd));
  vec3 lo, hi; sceneBox(lo, hi);
  vec2 bh = boxHit(ro, rd, lo, hi);
  float tEnd = min(min(bh.y, tMax), 300.0);
  float res = 1.0, t = max(bh.x, 0.0) + 0.05 + 0.03 * hash12(gl_FragCoord.xy), ph = 1e10;
  for (int i = 0; i < 72; i++) {
    if (t > tEnd) break;
    float h = mapD(ro + rd * t);
    float y = h * h / (2.0 * ph);
    float dd = sqrt(max(h * h - y * y, 0.0));
    res = min(res, 12.0 * dd / max(0.0, t - y));
    ph = h;
    if (res < 0.004) break;
    t += clamp(h * 0.85, 0.06, 6.0);
  }
  SHM = false;
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
float ao(vec3 p, vec3 n) {
  // on the shadow map (no words, no free stone surface): the relief's conservative distance would read as occlusion
  SHM = true;
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) { float h = 0.3 * float(i * i) * 0.5; o += w * (h - mapD(p + n * h)); w *= 0.6; }
  SHM = false;
  return clamp(1.0 - 1.0 * o, 0.0, 1.0);
}
// the lab around: dark; the overhead tube (a lightbox-white bar along x) seen in reflections, the lamp's head
vec3 envAt(vec3 P, vec3 R, float gain) {
  vec3 c = T_FILM2 * (0.12 + 0.18 * clamp(R.y, 0.0, 1.0));
  if (R.y > 0.02) {
    float k = (tubeP.y - P.y) / R.y;
    vec3 X = P + R * k;
    float a = abs(X.z - tubeP.z) / 34.0, b = abs(X.x - tubeP.x) / 520.0;
    float tube = (1.0 - smoothstep(0.55, 1.0, a)) * (1.0 - smoothstep(0.9, 1.0, b));
    float halo = exp(-a * a * 0.08) * (1.0 - smoothstep(0.8, 1.2, b)) * 0.05;
    c += T_LIGHTBOX * (tube * 0.9 + halo) * tubeI * gain;
    c += T_HALIDE * 0.04 * smoothstep(0.1, 0.8, R.y) + T_SILVER * 0.08 * exp(-R.y * R.y * 10.0);
  }
  vec3 lv = lampPos - P;
  float ld = length(lv);
  float ar = 55.0 / ld, cs = dot(R, lv / ld);
  c += T_LIGHTBOX * (1.0 - smoothstep(ar * ar * 0.5 - 0.0003, ar * ar * 0.5, 1.0 - cs)) * 0.8 * min(lampI, 1.0);
  return c;
}
// the lamp: a spot (point + cone), its fall-off normalised to 1 at the subject (lampRef mm away)
vec3 lampL(vec3 P, out float att) {
  vec3 lv = lampPos - P;
  float d2 = dot(lv, lv);
  vec3 L = lv * inversesqrt(d2);
  float cone = smoothstep(lampCone, lampCone + 0.1, dot(-L, normalize(lampDir)));
  att = lampI * cone * lampRef * lampRef / d2;
  return L;
}
// exposure of lit stone: linear to 0.8, then a soft shoulder (lit midtones land on #E8C35A; nothing blooms)
float softL(float x) { return x < 0.7 ? x : 0.7 + 0.48 * (1.0 - exp(-(x - 0.7) / 0.48)); }

vec3 stoneAlb(vec3 P) {
  float grain = 0.96 + 0.04 * snoise(P * 6.0) + 0.03 * snoise(P * 21.0);
  float pore = smoothstep(0.86, 0.93, snoise(P * 3.1)) * 0.25 + smoothstep(0.82, 0.9, snoise(P * 9.0 + 3.3)) * 0.15;
  return T_STONE * grain * (1.0 - pore);
}

vec4 shadePx(vec2 px) {
  vec2 ndc = px / vec2(${W.toFixed(1)}, ${H.toFixed(1)}) * 2.0 - 1.0;
  vec3 rd = normalize(camF + camR * ndc.x * tanH * ${(W / H).toFixed(6)} + camU * ndc.y * tanH);
  vec3 ro = camPos;
  vec3 lo, hi; sceneBox(lo, hi);
  vec2 bh = boxHit(ro, rd, lo, hi);
  float yF = mode == 0 ? BENCH_A : PB;
  float tF = rd.y < 0.0 ? (yF - ro.y) / rd.y : 1e9;
  if (mode == 1) teethRay(toHead(ro - castOff), toHead(rd));
  float t = max(bh.x, 0.0);
  float tEnd = min(bh.y, tF);
  bool hit = false; int id = 0, mat = 0;
  if (bh.x < bh.y && bh.y > 0.0) {
    for (int i = 0; i < 360; i++) {
      float d = map(ro + rd * t, id, mat);
      if (d < 0.0004 * t + 0.0012) { hit = true; break; }
      t += d * 0.9;
      if (t > tEnd) break;
    }
  }
  vec3 P = vec3(0.0), N = vec3(0.0, 1.0, 0.0);
  if (!hit) {
    if (tF > 1e8) return vec4(T_FILM * 0.12, 1500.0);
    t = tF; P = ro + rd * t; mat = 0; id = 0;
  } else {
    for (int k = 0; k < 2; k++) t += mapD(ro + rd * t) * 0.9;
    P = ro + rd * t;
    N = nrm(P, mat == 4 ? 0.035 : 0.04);
  }
  float depth = min(dot(P - camPos, camF), 1500.0);
  vec3 V = -rd;
  float att; vec3 L = lampL(P, att);
  float ndl = dot(N, L);
  float sh = ndl > -0.1 && att > 0.001 ? shadow(P + N * 0.05, L, length(lampPos - P)) : 0.0;
  float a = mat == 0 ? 1.0 : ao(P, N);
  vec3 Hh = normalize(L + V);
  float sky = fillK * (0.4 + 0.6 * max(N.y, 0.0)) * a;
  float top = topK * max(dot(N, normalize(tubeP - P)), 0.0) * a;
  vec3 col;
  if (mat == 0) {
    // the bench: near-black, a faint grain, the lamp's pool; stone dust near the cast
    float g = 0.9 + 0.1 * fbm(P.xz * 0.08, 3) + 0.05 * snoise(P.xz * 1.3);
    vec3 alb = T_FILM2 * 1.1 * g;
    if (mode == 1) {
      // slate: a fine honed grain and faint scratches, read by the grazing key
      vec2 e = vec2(0.15, 0.0);
      float b0 = fbm(P.xz * 0.9, 3) + 0.4 * snoise(P.xz * vec2(0.15, 3.2) + 7.0);
      float bx = fbm((P.xz + e.xy) * 0.9, 3) + 0.4 * snoise((P.xz + e.xy) * vec2(0.15, 3.2) + 7.0);
      float bz = fbm((P.xz + e.yx) * 0.9, 3) + 0.4 * snoise((P.xz + e.yx) * vec2(0.15, 3.2) + 7.0);
      N = normalize(vec3(-(bx - b0) / 0.15 * 0.06, 1.0, -(bz - b0) / 0.15 * 0.06));
      ndl = dot(N, L);
      alb = mix(T_FILM2, T_SILVER * 0.3, 0.6) * g;
    }
    if (mode == 1) {
      float rr = length((P.xz - castOff.xz - vec2(0.0, 20.0)) / vec2(1.0, 1.25));
      float dust = smoothstep(0.55, 0.9, snoise(P.xz * 0.9) * 0.5 + 0.5 + 0.25 * snoise(P.xz * 5.0)) * (1.0 - smoothstep(48.0, 85.0, rr));
      alb = mix(alb, T_STONE * 0.12, dust * 0.0);
    }
    float ca = clamp(0.15 + mapD(P + vec3(0.0, 3.0, 0.0)) / 5.0, 0.12, 1.0);
    col = alb * (keyK * 1.6 * max(ndl, 0.0) * att * sh + sky * 0.6) * ca;
    col += T_LIGHTBOX * 0.01 * pow(max(dot(N, Hh), 0.0), 30.0) * att * sh;
  } else if (mat == 1 || mat == 2 || mat == 7) {
    // the vibrator: painted grey body, black rubber platform (ribbed), black dial and switch
    vec3 alb = mat == 1 ? T_HALIDE * 0.3 : T_FILM2 * 1.1;
    if (mat == 2 && N.y > 0.7) { float rib = smoothstep(0.2, 0.8, abs(fract(P.z / 3.2) - 0.5) * 2.0); alb *= 0.65 + 0.45 * rib; }
    col = alb * (keyK * 0.7 * max(ndl, 0.0) * att * sh + sky + top);
    float sp = pow(max(dot(N, Hh), 0.0), mat == 2 ? 10.0 : 50.0) * (mat == 2 ? 0.02 : 0.15);
    col += T_LIGHTBOX * sp * att * sh;
    col += envAt(P, reflect(rd, N), 1.0) * (mat == 2 ? 0.02 : 0.1) * a;
  } else if (mat == 3) {
    // stainless: brushed, reflecting the lab and the tube; rim-lock perforations in the wall
    vec3 q = P - trayOff;
    vec3 R = reflect(rd, N);
    float fr = 0.55 + 0.45 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    col = envAt(P, R, 1.0) * T_HALIDE * 1.3 * fr;
    col += T_SILVER * 0.5 * (keyK * 0.6 * max(ndl, 0.0) * att * sh + sky * 1.5 + top);
    col += T_LIGHTBOX * 0.5 * pow(max(dot(N, Hh), 0.0), 60.0) * att * sh;
    if (abs(N.y) < 0.5 && q.y > PAD + 2.0 && q.y < SURF - 1.0) {
      vec2 hp = vec2(atan(q.x, q.z - 20.0) * 30.0, q.y - (PAD + SURF) * 0.5);
      vec2 cell = fract(hp / 3.6) - 0.5;
      col *= 0.25 + 0.75 * smoothstep(0.17, 0.24, length(cell));
    }
    col *= a;
  } else if (mat == 6) {
    // alginate: cool grey, moist, a soft sheen
    // a matt slate (blue alginate): film2 lifted toward halide, distinct from the bright steel
    vec3 alb = mix(T_FILM2 * 3.2, T_HALIDE * 0.3, 0.35) * (0.94 + 0.06 * snoise(P * 1.3) + 0.03 * snoise(P * 9.0));
    col = alb * softL(keyK * 0.85 * max(ndl, 0.0) * att * sh + sky + top);
    col += T_LIGHTBOX * 0.012 * pow(max(dot(N, Hh), 0.0), 8.0) * att * sh;
  } else if (mat == 8 || mat == 11) {
    // the glove: matte film2 nitrile, a soft sheen on the knuckles from the lamp; the sleeve dark cotton
    vec3 alb = mat == 8 ? T_FILM2 * 1.9 : T_FILM2 * 1.15;
    float wrap = max((ndl + 0.2) / 1.2, 0.0);
    col = alb * (keyK * 1.1 * wrap * att * sh + sky * 2.0 + top + 0.01);
    if (mat == 8) col += T_HALIDE * 0.07 * pow(max(dot(N, Hh), 0.0), 10.0) * att * sh;
    col *= mix(0.5, 1.0, a);
  } else if (mat == 9) {
    // the abrasive wheel: grit (sharp when it stands still), smeared into rings while it spins; a band of ground
    // stone packed into it where the casts meet it
    vec2 dq = P.xy - WC;
    float r = length(dq);
    float grit = 0.5 + 0.5 * snoise(rot2(-spinA) * dq * 0.75) * 0.8 + 0.2 * snoise(rot2(-spinA) * dq * 2.6);
    float ring = 0.5 + 0.35 * snoise(vec2(r * 0.75, 3.7)) + 0.15 * snoise(vec2(r * 2.6, 8.1));
    float k = clamp(spinBlur * r / 2.5, 0.0, 1.0);
    float g = mix(grit, ring, k);
    vec3 alb = mix(T_FILM2 * 2.0, T_SILVER * 0.5, g);
    float band = exp(-pow((r - 50.0) / 9.0, 2.0)) * mix(0.25 + 0.3 * snoise(rot2(-spinA) * dq * 0.3), 0.3, k);
    alb = mix(alb, T_STONE * 0.22, clamp(band, 0.0, 1.0));
    float wrap = max((ndl + 0.1) / 1.1, 0.0);
    col = alb * softL(keyK * wrap * att * sh + sky * 1.5 + top) * mix(0.6, 1.0, a);
  } else if (mat == 10) {
    // the hood: brushed steel catching the lamp and the tube
    vec3 R = reflect(rd, N);
    float fr = 0.55 + 0.45 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    col = envAt(P, R, 1.0) * T_HALIDE * 1.3 * fr;
    col += T_SILVER * 0.5 * (keyK * 0.6 * max(ndl, 0.0) * att * sh + sky * 1.5 + top);
    col += T_LIGHTBOX * 0.9 * pow(max(dot(N, Hh), 0.0), 50.0) * att * sh;
    col *= a;
  } else {
    // dental stone: wet (darker, a mirror for the lab) or set (matt, powdery, porous)
    float wet = 0.0; vec4 wd = vec4(0.0);
    float wax = 0.0;
    if (mode == 0) {
      vec3 q = P - trayOff;
      vec2 al = tArchLine(q.xz, 0);
      surfH(q.xz, al.x, smax(al.x - 10.5, q.z - 49.0, 3.0), wet, wd);
      wet = mix(wet, min(wet, wd.z), smoothstep(0.02, 0.3, wd.w));
      wax = wd.y * smoothstep(0.3, 0.6, wd.x);
      wet *= smoothstep(-1.0, 0.5, q.y - SURF);
    } else if (P.z < 10.0) {
      vec3 q = P - castOff;
      wd = wordAt(svB(q));
      wax = wd.y * smoothstep(0.3, 0.6, wd.x);
      wet = wd.z * smoothstep(0.02, 0.3, wd.w);   // a word on the base still wet, hardening to matt
    }
    vec3 alb = stoneAlb(P);
    alb = mix(alb, T_WAX * (0.95 + 0.05 * snoise(P * 5.0)), wax);
    alb *= mix(1.0, 0.84, wet);
    // crisp creases (gingival margins, interproximal), a tight cavity term
    SHM = true; float cav = mode == 1 ? clamp(mapD(P + N * 0.28) / 0.28, 0.0, 1.0) : 1.0; SHM = false;
    float wrap = max((ndl + 0.08) / 1.08, 0.0);
    float lit = keyK * wrap * att * sh + sky + top + 0.02 * a;
    col = alb * softL(lit) * mix(0.68, 1.0, cav);
    col += T_LIGHTBOX * (0.02 + 0.07 * wax) * pow(max(dot(N, Hh), 0.0), mix(14.0, 30.0, wax)) * att * sh * (1.0 - wet);
    if (wet > 0.0) {
      vec3 R = reflect(rd, N);
      float fr = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
      col += min(envAt(P, R, 3.0) * fr * wet, vec3(0.8));
      // the wet sheen: a broad, soft lobe of the key across the surface
      col += T_LIGHTBOX * 0.2 * pow(max(dot(N, Hh), 0.0), 24.0) * att * sh * wet;
    }
  }
  return vec4(col, depth);
}

void main() {
  vec2 px = FRAG_PX;
  vec3 c = vec3(0.0);
  float dmin = 1e9;
  for (int k = ssK0(); k < ssK1(); k++) { vec4 s = shadePx(px + rgss(k)); c += s.rgb; dmin = min(dmin, s.a); }
  c *= ssWeight();
  // the stone dust off the trimmer: matt motes lit by the lamp, smeared along their flight over the shutter
  for (int i = 0; i < ${POUR.NDUST}; i++) {
    if (i >= dustN) break;
    vec4 dp = dustP[i], dv = dustV[i];
    vec3 d0 = dp.xyz - camPos, d1 = d0 + dv.xyz;
    float z0 = dot(d0, camF), z1 = dot(d1, camF);
    if (z0 < 8.0 || z1 < 8.0 || z0 > dmin) continue;
    vec2 k = vec2(${(W / H).toFixed(6)} * tanH, tanH);
    vec2 s0 = (vec2(dot(d0, camR), dot(d0, camU)) / (z0 * k) * 0.5 + 0.5) * vec2(${W.toFixed(1)}, ${H.toFixed(1)});
    vec2 s1 = (vec2(dot(d1, camR), dot(d1, camU)) / (z1 * k) * 0.5 + 0.5) * vec2(${W.toFixed(1)}, ${H.toFixed(1)});
    vec2 ab = s1 - s0, ap = px - s0;
    float h = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float dist = length(ap - ab * h);
    float rp = max(dp.w * ${(H / 2).toFixed(1)} / (z0 * tanH), 0.6);
    float cov = (1.0 - smoothstep(rp * 0.6, rp + 0.9, dist)) * dv.w * clamp(rp * 2.0 / (rp * 2.0 + length(ab)), 0.15, 1.0);
    if (cov <= 0.002) continue;
    float att; vec3 L = lampL(dp.xyz, att);
    vec3 mc = T_STONE * softL(keyK * 0.75 * att + 0.04);
    c = mix(c, mc, cov);
    if (cov > 0.4) dmin = min(dmin, z0);
  }
  // depth: the nearest tap, so a silhouette pixel belongs to the object in focus (an averaged depth there would
  // blur it into the background and leave a dithered fringe around the edge)
  fragColor = vec4(c, dmin);
}`;

// The depth-of-field gather (after drawer-glsl's): src.a holds the view depth (mm).
export const DOF_FRAG = /* glsl */ `
uniform sampler2D src; uniform float focusD, aper, maxCoc;
const int NT = 144;
float coc(float d) { return min(aper * abs(d - focusD) / max(d, 1e-3), maxCoc); }
void main() {
  // texelFetch, never filtered taps: a bilinear tap across a silhouette mixes the near and far depths into a fake
  // mid depth with a large circle of confusion, which leaked the foreground's colour into the background as a halo
  ivec2 P0 = ivec2(gl_FragCoord.xy), SZ = textureSize(src, 0);
  vec4 c0 = texelFetch(src, P0, 0);
  float d0 = c0.a, r0 = coc(d0);
  float w0 = 1.0 / max(r0 * r0, 1.0);
  vec3 acc = c0.rgb * w0; float ws = w0;
  float R = max(min(maxCoc, r0 + 8.0), 1.0);
  float rot = 0.0;
  for (int i = 0; i < NT; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(NT)) * R;
    float th = fi * 2.39996323 + rot;
    vec2 off = r * vec2(cos(th), sin(th));
    vec4 s = texelFetch(src, clamp(P0 + ivec2(floor(off * PX_SCALE + 0.5)), ivec2(0), SZ - 1), 0);
    float rs = coc(s.a);
    if (s.a > d0) rs = min(rs, r0 + 0.5);
    float w = sat(rs - r + 0.75) / max(rs * rs, 1.0);
    acc += s.rgb * w; ws += w;
  }
  fragColor = vec4(acc / ws, 1.0);
}`;
