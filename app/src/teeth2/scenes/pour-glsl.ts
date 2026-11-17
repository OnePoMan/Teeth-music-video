// `pour` shaders: one ray-marched pass for both halves of the plate, then a depth-of-field gather.
//  mode 0  THE POUR: an upper impression tray brimming with wet dental stone on a vibrator table. The stone's free
//          surface is a height field: ripples from the tray walls on every stomp, bubbles that rise and burst, the
//          relief words rising out of it, and the set front (gloss to matt) sweeping across on "heart got".
//  mode 1  THE CAST: the upper cast turned out, teeth up, on a trimmed plinth (an art base with a flat front facet that
//          carries the relief words), on a dark bench under a low raking lamp.
// Units mm, bench frame y up. The camera looks from bench -z toward +z (screen right = bench -x). The upper cast
// teeth-up maps to the head frame as head = (x, -y, -z) (teeth.ts); the tray uses the same arch (arch y = bench z).
import { W, H, SS_TAP_GLSL } from '../../engine/gl';
import { GLSL_TEETH_PALETTE } from '../palette';
import { GLSL_TEETH } from '../teeth';

export const POUR = {
  /** mode 0: the stone's level, the pad's top, the bench */
  SURF: 12.0, PAD: -2.0, BENCH_A: -60.0,
  /** mode 1: the plinth's front facet (z = -FZ), bottom (= the bench) and top */
  FZ: 13.5, PB: -42.0, PT: -16.0,
  /** the text rects (s = -x, v), mm: on the stone surface (v = z) and on the plinth's front facet (v = y) */
  RECT_A: [-26.5, 4.0, 53.0, 26.5] as [number, number, number, number],
  RECT_B: [-23.0, -40.5, 46.0, 23.0] as [number, number, number, number],
  NRIP: 6,
};

export const MARCH_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${GLSL_TEETH}
${SS_TAP_GLSL}
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform int mode;
uniform float time;
uniform sampler2D wordTex; uniform vec4 wordRect; uniform float wordDepth;
uniform float wRise[8], wWet[8];
uniform vec4 rip[${POUR.NRIP}];       // stomps: (strength, birth time, -, -)
uniform vec3 trayOff;                 // the vibration
uniform float setP;                   // the set front (0 all wet .. 1 all set)
uniform float wetAll;                 // the surface's wetness before it sets
uniform vec3 lampPos, lampDir; uniform float lampI, lampCone;
uniform vec3 tubeP; uniform float tubeI;
uniform float fillK, topK, vibA;
uniform vec3 castOff;                 // mode 1: the cast's settle
const float SURF = ${POUR.SURF.toFixed(2)}, PAD = ${POUR.PAD.toFixed(2)}, BENCH_A = ${POUR.BENCH_A.toFixed(2)};
const float FZ = ${POUR.FZ.toFixed(2)}, PB = ${POUR.PB.toFixed(2)}, PT = ${POUR.PT.toFixed(2)};

bool SHM = false;
float sdRBox(vec3 p, vec3 b, float r) { return sdBox3(p, b - r) - r; }

// ------------------------------------------------------------------ the words (a height map on a surface)
// wordTex: r = height (blurred: the bevel), g = r * (word index + 1) / 8, b = r * wax; on opaque black
vec4 wordAt(vec2 sv) {
  vec2 uv = (sv - wordRect.xy) / wordRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  vec4 tx = textureLod(wordTex, uv, 0.0);
  if (tx.r < 0.02) return vec4(0.0);
  int idx = clamp(int(floor(tx.g / tx.r * 8.0 + 0.5)) - 1, 0, 7);
  float hh = smoothstep(0.1, 0.9, tx.r);
  float wax = smoothstep(0.35, 0.65, tx.b);
  return vec4(hh * wRise[idx], wax, wWet[idx], tx.r * step(0.001, wRise[idx]));
}
/** The relief's slope (|grad| of the risen height, 1/mm), for a distance bound that stays honest on the bevels. */
float wordSlope(vec2 sv) {
  const float e = 0.06;
  float h0 = wordAt(sv).x;
  float hx = wordAt(sv + vec2(e, 0.0)).x, hy = wordAt(sv + vec2(0.0, e)).x;
  return length(vec2(hx - h0, hy - h0)) / e;
}
// A symmetric arch line: tArchLine (teeth.ts) soft-mins over the half arch only, which leaves a crease along the
// midline of the base; this one adds the mirrored half (the midline then joins like any other vertex).
vec2 archLineS(vec2 xz, int jaw) {
  int row = 32 + jaw;
  vec2 q = vec2(abs(xz.x), xz.y);
  float sgn = 1.0, es = 0.0, gs = 0.0, ws = 0.0;
  const float K = 2.0;
  vec4 a = tth(row, 0);
  for (int k = 1; k < 16; k++) {
    vec4 b = tth(row, k);
    if (b.w <= 0.0) break;
    for (int m = 0; m < 2; m++) {
      vec2 A = a.xy, B = b.xy;
      if (m == 1) { A.x = -A.x; B.x = -B.x; }
      vec2 pa = q - A, ba = B - A;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      float dd = length(pa - ba * h);
      es += exp(-dd / K);
      float w = 1.0 / (dd * dd + 4.0);
      gs += w * mix(a.z, b.z, h); ws += w;
    }
    if (q.x >= a.x && q.x < b.x) { float kk = (q.x - a.x) / max(b.x - a.x, 1e-4); sgn = q.y > mix(a.y, b.y, kk) ? -1.0 : 1.0; }
    a = b;
  }
  if (q.x >= a.x) sgn = 1.0;
  float d = -K * log(max(es, 1e-30));
  return vec2(max(d, 0.0) * sgn, gs / max(ws, 1e-6));
}
/** sdCast (teeth.ts) for the upper cast, on the symmetric arch line. Head frame. */
float castS(vec3 p, out int id) {
  vec2 al = archLineS(vec2(p.x, -p.z), 0);
  float base = tBase(p, 0, al);
  id = 0;
  float yz = max(-3.5 - p.y, p.y - 15.0);
  float zone = max(abs(al.x) - 9.5, yz);
  if (zone > base + 2.5) return base;
  float dg = smin(tSockets(p, 0), base, 2.2);
  if (zone > dg + 0.6) return dg;
  float dt = sdTeeth(p, 0, id);
  if (dg < dt) id = 0;
  return smin(dt, dg, 0.55);
}

// ------------------------------------------------------------------ mode 0: the pour
// the tray's inner outline (neg inside): the upper arch line offset buccally, closed behind the molars
float trayIn(vec2 xz) {
  vec2 al = archLineS(xz, 0);
  return smax(al.x - 8.0, xz.y - 47.0, 4.0);
}
// distance from the wall into the stone, for the ripples
// bubbles: one per 3.2 mm cell at most; rise as a dome, burst, leave a crater that flows back
float bubbles(vec2 xz, float wet) {
  if (wet < 0.02) return 0.0;
  const float CS = 4.6;
  vec2 c = floor(xz / CS);
  float h0 = hash12(c * 1.37 + 4.1);
  if (h0 > 0.16) return 0.0;
  vec2 o = (c + 0.25 + 0.5 * hash22(c + 9.3)) * CS;
  float r0 = 0.35 + 0.5 * hash12(c + 2.7);
  float per = 1.1 + 1.4 * hash12(c + 7.9);
  float a = fract(time / per + hash12(c + 5.5));
  float d = length(xz - o);
  float h = 0.0;
  if (a < 0.72) {
    float g = smoothstep(0.0, 0.72, a);
    float r = r0 * (0.4 + 0.6 * g);
    float q = d / r;
    h = q < 1.0 ? r * 0.75 * g * sqrt(1.0 - q * q) : 0.0;
  } else {
    float b = (a - 0.72) / 0.28;
    float r = r0 * (1.0 + 0.6 * b);
    float q = d / r;
    h = -r0 * 0.5 * (1.0 - b) * (1.0 - b) * exp(-q * q * 2.2) + r0 * 0.25 * (1.0 - b) * exp(-pow((q - 1.1) / 0.25, 2.0));
  }
  return h * wet;
}
// the set front: 0 wet .. 1 set (left to right on screen = bench +x to -x), a ragged edge
float setMask(vec2 xz) {
  float f = mix(42.0, -48.0, setP);
  float u = xz.x + 3.5 * fbm(xz * 0.09 + 3.0, 2);
  return min(1.0, smoothstep(f - 3.5, f + 3.5, u) * step(0.001, setP) + step(0.999, setP));
}
float ripples(vec2 xz, float tin) {
  float h = 0.0;
  for (int i = 0; i < ${POUR.NRIP}; i++) {
    vec4 r = rip[i];
    float age = time - r.y;
    if (r.x <= 0.0 || age < 0.0 || age > 1.6) continue;
    // a ring packet running in from the walls, and a softer one from the middle outward
    float fr = 4.0 + 46.0 * age;
    float x = tin - fr;
    float env = exp(-age * 2.6) * exp(-x * x / (8.0 + 30.0 * age)) * smoothstep(21.0, 11.0, fr);
    h += r.x * 0.14 * env * (sin(x * 2.1) + 0.35 * sin(x * 4.3 + 1.0));
    vec2 o = vec2(-14.0 + 28.0 * hash11(r.y * 7.13), 10.0 + 22.0 * hash11(r.y * 3.71 + 1.3));
    float rc = length(xz - o) - 34.0 * age;
    h += r.x * 0.2 * exp(-age * 2.8) * exp(-rc * rc / (6.0 + 40.0 * age)) * sin(rc * 1.9);
  }
    return h;
}
// the surface height above SURF (mm) at xz; also the wetness and the word sample
float surfH(vec2 xz, out float wet, out vec4 wd) {
  float tin0 = max(-trayIn(xz), 0.0);
  float tin = tin0 + 1.2 * snoise(xz * 0.07 + 2.0);
  float sm = setMask(xz);
  wet = wetAll * (1.0 - sm);
  wd = wordAt(vec2(-xz.x, xz.y));
  float h = ripples(xz, tin) * (1.0 - sm) * smoothstep(0.0, 2.5, tin) * (1.0 - smoothstep(0.02, 0.35, wd.w));
  h += bubbles(xz, wet) * (1.0 - wd.w);
  h += wordDepth * wd.x;
  // the meniscus up the wall
  h += 0.45 * exp(-tin0 / 0.7);
  return h;
}
// the stainless tray: walls, floor and the handle out of its front (tray frame: bottom on y = PAD)
float trayShell(vec3 q, float t2) {
  float outer = max(t2 - 1.5, abs(q.y - (SURF + 0.6 + PAD) * 0.5) - (SURF + 0.6 - PAD) * 0.5);
  float inner = max(t2, PAD + 1.2 - q.y);
  float tray = max(outer, -inner);
  vec3 hq = q - vec3(0.0, SURF - 1.3, -32.0);
  float handle = sdRBox(hq, vec3(7.5 - 0.06 * (hq.z + 22.0), 1.1, 23.0), 1.0);
  handle = max(handle, -sdCapsule(hq, vec3(0.0, -3.0, -16.0), vec3(0.0, 3.0, -16.0), 2.6));
  return min(tray, handle);
}
float mapA(vec3 p, out int mat) {
  float dBench = p.y - BENCH_A;
  float d = dBench; mat = 0;
  float dBody = sdRBox(p - vec3(0.0, (BENCH_A + PAD - 7.0) * 0.5, 24.0), vec3(64.0, (PAD - 7.0 - BENCH_A) * 0.5, 60.0), 6.0);
  if (dBody < d) { d = dBody; mat = 1; }
  float dPad = sdRBox(p - vec3(0.0, PAD - 3.5, 24.0), vec3(60.0, 3.5, 56.0), 2.5);
  if (dPad < d) { d = dPad; mat = 2; }
  vec3 q = p - trayOff;
  // cheap bound around the tray
  float bnd = sdBox3(q - vec3(0.0, 5.0, -8.0), vec3(42.0, 10.0, 75.0));
  if (bnd > d) return d;
  float t2 = trayIn(q.xz);
  float tray = trayShell(q, t2);
  if (tray < d) { d = tray; mat = 3; }
  if (SHM) return d;
  if (t2 < 2.0 && q.y > SURF - 3.0) {
    float wet = 0.0; vec4 wd = vec4(0.0);
    float h = surfH(q.xz, wet, wd);
    float g = wd.w > 0.0 ? wordDepth * wordSlope(vec2(-q.x, q.z)) : 0.0;
    float st = max(t2, (q.y - SURF - h) / sqrt(1.0 + g * g) * 0.7);
    if (st < d) { d = st; mat = 4; }
  } else if (t2 < 0.0) {
    float st = max(t2, q.y - SURF - 1.0);
    if (st < d) { d = st; mat = 4; }
  }
  return d;
}

// ------------------------------------------------------------------ mode 1: the cast
vec3 toHead(vec3 p) { return vec3(p.x, -p.y, -p.z); }
float plinth(vec3 p) {
  vec2 q = vec2(abs(p.x), p.z);
  float d = -q.y - FZ;
  d = smax(d, dot(q - vec2(24.0, -FZ), normalize(vec2(18.0, -13.0))), 0.8);
  d = smax(d, q.x - 37.5, 0.8);
  d = smax(d, q.y - 50.0, 0.8);
  return smax(d, max(PB - p.y, p.y - PT), 0.7);
}
float mapB(vec3 p, out int id, out int mat) {
  p -= castOff;
  float pl = plinth(p);
  mat = 5; id = 0;
  float d = pl;
  if (p.y > PT - 6.0) {
    int cid;
    float c = max(castS(toHead(p), cid), PT - 0.05 - p.y);
    if (c < pl) id = cid;
    d = smin(c, pl, 0.7);
  }
  // the relief words on the front facet
  float w = -p.z - FZ;
  if (!SHM && abs(w) < 2.5 && p.y < PT && p.y > PB) {
    vec4 wd = wordAt(vec2(-p.x, p.y));
    if (wd.x > 0.0) {
      float g = wordDepth * wordSlope(vec2(-p.x, p.y));
      float body = max(w - wordDepth * wd.x, -w - 0.4) / sqrt(1.0 + g * g) * 0.9;
      if (body < d) { d = body; }
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
  if (mode == 0) { lo = vec3(-70.0, BENCH_A, -60.0); hi = vec3(70.0, SURF + 4.0, 90.0); }
  else {
    lo = vec3(-40.0, PB, -FZ - 3.0) + castOff; hi = vec3(40.0, 3.0, 52.0) + castOff;
  }
}
float shadow(vec3 ro, vec3 rd, float tMax) {
  SHM = true;
  if (mode == 1) teethRay(toHead(ro - castOff), toHead(rd));
  vec3 lo, hi; sceneBox(lo, hi);
  vec2 bh = boxHit(ro, rd, lo, hi);
  float tEnd = min(min(bh.y, tMax), 260.0);
  float res = 1.0, t = max(bh.x, 0.0) + 0.05 + 0.03 * hash12(gl_FragCoord.xy), ph = 1e10;
  for (int i = 0; i < 110; i++) {
    if (t > tEnd) break;
    float h = mapD(ro + rd * t);
    float y = h * h / (2.0 * ph);
    float dd = sqrt(max(h * h - y * y, 0.0));
    res = min(res, 9.0 * dd / max(0.0, t - y));
    ph = h;
    if (res < 0.004) break;
    t += clamp(h * 0.8, 0.03, 3.0);
  }
  SHM = false;
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
// the relief words shadowing the surface they stand on: a short height-field march in the surface frame
// (sv on the surface, h along its normal n); L the light
float hfShadow(vec2 sv, float h, vec2 Ls, float Lh) {
  if (Lh <= 0.0) return 0.0;
  float res = 1.0;
  for (int i = 1; i <= 20; i++) {
    float st = 0.06 * float(i * i) * 0.5 + 0.04;
    float hs = h + Lh * st;
    if (hs > wordDepth + 0.05) break;
    float H = wordDepth * wordAt(sv + Ls * st).x;
    if (H > 0.002) res = min(res, 6.0 * (hs - H) / st);
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
float ao(vec3 p, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) { float h = 0.35 * float(i * i) * 0.5; o += w * (h - mapD(p + n * h)); w *= 0.6; }
  return clamp(1.0 - 1.0 * o, 0.0, 1.0);
}
// the lab around: dim, and the overhead tube (a lightbox-white bar along x) seen in reflections
vec3 envAt(vec3 P, vec3 R, float gain) {
  vec3 c = T_FILM2 * (0.18 + 0.22 * clamp(R.y, 0.0, 1.0));
  if (R.y > 0.02) {
    float k = (tubeP.y - P.y) / R.y;
    vec3 X = P + R * k;
    float a = abs(X.z - tubeP.z) / 16.0, b = abs(X.x - tubeP.x) / 520.0;
    float tube = (1.0 - smoothstep(0.55, 1.0, a)) * (1.0 - smoothstep(0.9, 1.0, b));
    float halo = exp(-a * a * 0.08) * (1.0 - smoothstep(0.8, 1.2, b)) * 0.05;
    c += T_LIGHTBOX * (tube * 0.9 + halo) * tubeI * gain;
    c += T_HALIDE * 0.05 * smoothstep(0.1, 0.8, R.y) + T_SILVER * 0.1 * exp(-R.y * R.y * 10.0);
  }
  // the lamp's head, a small bright disc
  vec3 lv = lampPos - P;
  float ld = length(lv);
  float cs = dot(R, lv / ld);
  float ar = 28.0 / ld;
  c += T_LIGHTBOX * smoothstep(1.0 - ar * ar * 0.5, 1.0 - ar * ar * 0.3, cs) * 0.9 * lampI;
  return c;
}
// the lamp: a spot (point + cone) and its fall-off
vec3 lampL(vec3 P, out float att) {
  vec3 lv = lampPos - P;
  float d = length(lv);
  vec3 L = lv / d;
  float cone = smoothstep(lampCone, lampCone + 0.12, dot(-L, normalize(lampDir)));
  att = lampI * cone * (1.0 / (1.0 + d * d / 160000.0));
  return L;
}

vec3 stoneAlb(vec3 P) {
  float grain = 0.95 + 0.05 * snoise(P * 7.0) + 0.03 * snoise(P * 23.0);
  float pore = smoothstep(0.86, 0.93, snoise(P * 3.1)) * 0.45 + smoothstep(0.8, 0.9, snoise(P * 9.0 + 3.3)) * 0.25;
  return T_STONE * grain * (1.0 - pore);
}

vec4 shadePx(vec2 px) {
  vec2 ndc = px / vec2(${W.toFixed(1)}, ${H.toFixed(1)}) * 2.0 - 1.0;
  vec3 rd = normalize(camF + camR * ndc.x * tanH * ${(W / H).toFixed(6)} + camU * ndc.y * tanH);
  vec3 ro = camPos;
  vec3 lo, hi; sceneBox(lo, hi);
  vec2 bh = boxHit(ro, rd, lo, hi);
  // the floor plane
  float yF = mode == 0 ? BENCH_A : PB;
  float tF = rd.y < 0.0 ? (yF - ro.y) / rd.y : 1e9;
  if (mode == 1) teethRay(toHead(ro - castOff), toHead(rd));
  float t = max(bh.x, 0.0);
  float tEnd = min(bh.y, tF);
  bool hit = false; int id = 0, mat = 0;
  if (bh.x < bh.y && bh.y > 0.0) {
    for (int i = 0; i < 320; i++) {
      float d = map(ro + rd * t, id, mat);
      if (d < 0.0004 * t + 0.0015) { hit = true; break; }
      t += d * 0.9;
      if (t > tEnd) break;
    }
  }
  float depth;
  vec3 P, N;
  if (!hit) {
    if (tF > 1e8) {
      // the far wall: dark, the lamp's spill on it
      float sp = exp(-pow((dot(rd, normalize(vec3(lampPos.x, 0.0, lampPos.z + 900.0))) - 0.92) / 0.08, 2.0)) * exp(-rd.y * rd.y / 0.04);
      return vec4(T_FILM * 0.3 + T_FILM2 * 0.6 * sp * float(mode), 4000.0);
    }
    t = tF; P = ro + rd * t; N = vec3(0.0, 1.0, 0.0); mat = 0; id = 0;
  } else {
    for (int k = 0; k < 2; k++) t += mapD(ro + rd * t) * 0.9;
    P = ro + rd * t;
    N = nrm(P, mat == 4 ? 0.04 : 0.05);
  }
  depth = dot(P - camPos, camF);
  vec3 V = -rd;
  float att; vec3 L = lampL(P, att);
  float ndl = dot(N, L);
  float sh = ndl > -0.1 && att > 0.001 ? shadow(P + N * 0.06, L, length(lampPos - P)) : 0.0;
  if (sh > 0.0 && hit && mode == 0 && mat == 4) {
    vec3 q = P - trayOff;
    sh *= hfShadow(vec2(-q.x, q.z), q.y - SURF, vec2(-L.x, L.z), L.y);
  } else if (sh > 0.0 && hit && mode == 1 && mat == 5) {
    vec3 q = P - castOff;
    float w = -q.z - FZ;
    if (abs(w) < 1.5) sh *= hfShadow(vec2(-q.x, q.y), w, vec2(-L.x, L.y), -L.z);
  }
  float a = mat == 0 ? 1.0 : ao(P, N);
  vec3 Hh = normalize(L + V);
  float sky = fillK * (0.4 + 0.6 * max(N.y, 0.0)) * a;
  vec3 col;
  if (mat == 0) {
    // the bench: dark, a faint grain, the lamp's pool; a little contact darkening
    float g = 0.9 + 0.1 * fbm(P.xz * 0.08, 3) + 0.04 * snoise(P.xz * 1.3);
    vec3 alb = mix(T_FILM2 * 1.6, T_SILVER * 0.16, float(mode)) * g;
    float ca = clamp(0.35 + mapD(P + vec3(0.0, 4.0, 0.0)) / 6.0, 0.25, 1.0);
    col = alb * (2.4 * max(ndl, 0.0) * att * sh + sky * 0.8) * ca;
    col += T_LIGHTBOX * 0.012 * pow(max(dot(N, Hh), 0.0), 30.0) * att * sh;
  } else if (mat == 1 || mat == 2) {
    // the vibrator: a painted grey body and a black ribbed rubber top
    bool pad = mat == 2;
    vec3 alb = pad ? T_FILM2 * 1.2 : T_SILVER * 0.55;
    if (pad && N.y > 0.7) { float rib = 0.5 + 0.5 * sin(P.z * 2.2); alb *= 0.75 + 0.3 * rib; }
    col = alb * (1.3 * max(ndl, 0.0) * att * sh + sky);
    float sp = pow(max(dot(N, Hh), 0.0), pad ? 12.0 : 40.0) * (pad ? 0.03 : 0.12);
    col += T_LIGHTBOX * sp * att * sh;
    col += envAt(P, reflect(rd, N), 1.0) * (pad ? 0.02 : 0.08) * a;
  } else if (mat == 3) {
    // stainless tray: brushed, reflecting the lab and the tube
    vec3 R = reflect(rd, N);
    float fr = 0.55 + 0.45 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    col = envAt(P, R, 1.0) * T_HALIDE * 1.3 * fr;
    col += T_SILVER * 0.55 * (max(ndl, 0.0) * att * sh + sky * 1.5);
    col += T_LIGHTBOX * 0.6 * pow(max(dot(N, Hh), 0.0), 60.0) * att * sh;
    col *= a;
  } else if (mat == 6) {
    // alginate: a cool grey, moist, a soft sheen
    vec3 alb = T_HALIDE * 0.42 * (0.92 + 0.08 * snoise(P * 1.5));
    col = alb * (1.3 * max(ndl, 0.0) * att * sh + sky + topK * max(dot(N, normalize(tubeP - P)), 0.0) * a);
    col += T_LIGHTBOX * 0.08 * pow(max(dot(N, Hh), 0.0), 40.0) * att * sh;
  } else {
    // dental stone: wet (dark, saturated, a mirror for the lab) or set (matt, powdery, porous)
    float wet = 0.0; vec4 wd = vec4(0.0);
    float wax = 0.0;
    if (mode == 0) {
      vec3 q = P - trayOff;
      surfH(q.xz, wet, wd);
      wet = mix(wet, min(wet, wd.z), smoothstep(0.02, 0.3, wd.w));
      wax = wd.y * smoothstep(0.3, 0.6, wd.x);
      wet *= smoothstep(-1.0, 0.5, q.y - SURF);
    } else {
      vec3 q = P - castOff;
      float w = -q.z - FZ;
      if (abs(w) < 2.5) { wd = wordAt(vec2(-q.x, q.y)); wax = wd.y * smoothstep(0.3, 0.6, wd.x); }
    }
    vec3 alb = stoneAlb(P);
    alb = mix(alb, T_WAX * (0.95 + 0.05 * snoise(P * 5.0)), wax);
    alb *= mix(1.0, 0.72, wet);
    alb = mix(alb, pow(alb, vec3(1.12)) * 1.05, wet);
    float wrap = max((ndl + 0.12) / 1.12, 0.0);
    col = alb * (1.6 * wrap * att * sh + sky + 0.03 * a + topK * max(dot(N, normalize(tubeP - P)), 0.0) * a);
    // dry stone: a faint sheen at grazing; wax: a soft waxy lobe
    col += T_LIGHTBOX * (0.025 + 0.08 * wax) * pow(max(dot(N, Hh), 0.0), mix(14.0, 30.0, wax)) * att * sh * (1.0 - wet);
    if (wet > 0.0) {
      vec3 R = reflect(rd, N);
      float fr = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
      col += min(envAt(P, R, 14.0) * fr * wet, vec3(0.85));
      col += T_LIGHTBOX * 0.3 * pow(max(dot(N, Hh), 0.0), 300.0) * att * sh * wet;
    }
  }
  return vec4(col, depth);
}

void main() {
  vec2 px = FRAG_PX;
  vec4 c = vec4(0.0);
  for (int k = ssK0(); k < ssK1(); k++) c += shadePx(px + rgss(k));
  c *= ssWeight();
  fragColor = c;
}`;

// The depth-of-field gather (after drawer-glsl's): src.a holds the view depth (mm).
export const DOF_FRAG = /* glsl */ `
uniform sampler2D src; uniform float focusD, aper, maxCoc;
const int NT = 96;
float coc(float d) { return min(aper * abs(d - focusD) / max(d, 1e-3), maxCoc); }
void main() {
  vec4 c0 = texture(src, vUv);
  float d0 = c0.a, r0 = coc(d0);
  float w0 = 1.0 / max(r0 * r0, 1.0);
  vec3 acc = c0.rgb * w0; float ws = w0;
  float R = max(maxCoc, 1.0);
  float rot = hash12(FRAG_PX) * 6.2831853;
  for (int i = 0; i < NT; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(NT)) * R;
    float th = fi * 2.39996323 + rot;
    vec2 off = r * vec2(cos(th), sin(th));
    vec4 s = texture(src, vUv + off / vec2(${W.toFixed(1)}, ${H.toFixed(1)}));
    float rs = coc(s.a);
    if (s.a > d0) rs = min(rs, r0 + 0.5);
    float w = sat(rs - r + 0.75) / max(rs * rs, 1.0);
    acc += s.rgb * w; ws += w;
  }
  fragColor = vec4(acc / ws, 1.0);
}`;
