// `scale` shaders: the ray-marched bite-mark photograph (an apple on black velvet, an ABFO No. 2 scale on its risers,
// lit by one photographic flash), and a depth-of-field gather. Units: millimetres, Y up, the cloth at Y ~ 0. The apple
// lies on its side, its stem axis along X (stem at +X), the bite on its top facing the copy-stand camera; the bite's
// photo frame (scale-bite.ts) maps onto the top as X = world x, Y = -world z (top-down, screen up = -z).
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL, W, H } from '../../engine/gl';
import { PATCH } from './scale-bite';

const f = (x: number) => x.toFixed(4);

/** Layout shared with scale.ts. */
export const LAY = {
  /** the apple: centre, equatorial radius, axial half length */
  AC: [0, 38.5, 0] as const, AR: 40, AH: 37,
  /** the bite's photo Y that sits on the apple's top (its upper arc and the word just behind the top) */
  BOFF: 6,
  /** the apple's tilt about Z (rad): its stem end raised, so the stem cavity shows from above */
  AROT: 0.28,
  /** the scale's mid-plane height and half thickness; its outer corner (x, z); arm length and width */
  SY: 75.8, ST: 0.8, SX0: -38, SZ0: 42, SL: 100, SW: 18,
};

export const MARCH_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform vec3 keyPos, keyDir; uniform float keyI, keyRad, keyCone;
uniform vec3 fillDir; uniform float fillI;
uniform sampler2D marksTex, wordTex, labelTex;
uniform float wordAmt, plainAmt;

const vec3 AC = vec3(${LAY.AC.map(f).join(',')});
const float AR = ${f(LAY.AR)}, AH = ${f(LAY.AH)}, BOFF = ${f(LAY.BOFF)}, AROT = ${f(LAY.AROT)};
/** World to the apple's own frame (centred, its axis X). */
vec3 toApple(vec3 p) { vec3 q = p - AC; float c = cos(AROT), s = sin(AROT); return vec3(c * q.x + s * q.y, -s * q.x + c * q.y, q.z); }
const vec4 PATCHR = vec4(${f(PATCH.x0)}, ${f(PATCH.y0)}, ${f(1 / (PATCH.x1 - PATCH.x0))}, ${f(1 / (PATCH.y1 - PATCH.y0))});
// the chunk bitten out: an ellipsoid above the top, between the arcs
const vec3 CRC = vec3(0.0, 84.6, 1.6);
const vec3 CRR = vec3(12.0, 10.2, 7.0);
const float SY = ${f(LAY.SY)}, ST = ${f(LAY.ST)}, SX0 = ${f(LAY.SX0)}, SZ0 = ${f(LAY.SZ0)}, SL = ${f(LAY.SL)}, SW = ${f(LAY.SW)};

const float M_SKIN = 1.0, M_CLOTH = 2.0, M_SCALE = 3.0, M_RISER = 4.0, M_STEM = 5.0;

float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }
vec2 opU(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

// ---------------------------------------------------------------- the apple
/** The body, lying on its side (axis X, stem at +X): a squashed sphere, broader at the stem shoulder, five soft
 *  lobes at the calyx end, a cavity at each pole. */
float appleBody(vec3 p) {
  vec3 q = toApple(p);
  float h = q.x / AH;
  float r = length(q.yz);
  float phi = atan(q.z, q.y);
  float rad = AR * (1.0 + 0.04 * h - 0.05 * h * h);
  rad += 0.55 * cos(5.0 * phi + 0.4) * smoothstep(0.1, 0.85, -h) + 0.35 * snoise(vec2(phi * 1.6, h * 2.0));
  float d = (length(vec2(r, q.x * AR / AH)) - rad) * 0.9;
  // the stem cavity (+X) and the calyx's (-X)
  d = smax(d, -(length(vec2(r, q.x - AH - 7.5)) - 13.0), 6.0);
  d = smax(d, -(length(vec2(r, q.x + AH + 6.0)) - 9.0), 4.0);
  return d;
}

/** Signed distance (mm, negative inside) to the bite's marks, the word, and the chunk; out: how deep the teeth went
 *  at p (mm, for the cut skin) and the chunk's distance. */
float gMark = 0.0, gCrater = 1e3;
float markDepth(float s, float D) {
  float body = smoothstep(0.32, -0.42, s);
  float flr = sqrt(sat(-s / 0.8));
  return D * body * (0.55 + 0.45 * flr);
}
float biteDepth(vec2 X) {
  vec2 uv = (X - PATCHR.xy) * PATCHR.zw;
  vec4 mk = textureLod(marksTex, uv, 0.0);
  float wd = textureLod(wordTex, uv, 0.0).r;
  // incisors bite deeper near the midline (centrals 0.85, laterals 0.65 in biteMark)
  float fac = mix(1.0, 0.8, sat(abs(X.x) / 13.0));
  float dU = markDepth(mk.r, 0.9 * fac) * plainAmt;
  float dC = markDepth(mk.g, 0.3);
  float dL = markDepth(mk.b, 0.2 * fac);
  float dW = markDepth(wd, 1.0 * fac) * wordAmt;
  float m = max(max(dU, dC), max(dL, dW));
  // the skin pushed up in a soft lip round each mark
  float sN = min(min(mk.r + (1.0 - plainAmt) * 6.0, mk.g), min(mk.b, wd + (1.0 - wordAmt) * 6.0));
  float lip = -0.045 * exp(-pow((sN - 0.5) / 0.38, 2.0));
  // the whole bite pressed in a little round the arcs
  vec2 e = X / vec2(17.0, 15.0);
  float dent = 0.45 * exp(-dot(e, e) * 1.6);
  gMark = m;
  return m + lip + dent;
}

float apple(vec3 p) {
  float d = appleBody(p);
  gMark = 0.0; gCrater = 1e3;
  if (p.y > 58.0 && abs(p.x) < 30.0 && abs(p.z - 4.0) < 26.0 && d < 4.0) {
    vec2 X = vec2(p.x, BOFF - p.z);
    d += biteDepth(X);
    // (no chunk is taken: the bite is an impression, the skin broken only where the teeth went through)
  }
  return d;
}

float stem(vec3 p) {
  vec3 q = toApple(p);
  vec3 a = vec3(AH - 3.0, 0.4, 0.2), b = vec3(AH + 2.5, 1.2, 0.6), c = vec3(AH + 5.0, 3.4, 1.2);
  float r = 1.6 - 0.4 * sat((q.x - a.x) / 11.0);
  return min(sdCapsule(q, a, b, r), sdCapsule(q, b, c, r * 0.92));
}

// ---------------------------------------------------------------- the cloth, the scale, its risers
float clothH(vec2 xz) {
  float far = smoothstep(55.0, 150.0, length(xz - vec2(0.0, 0.0)));
  float folds = 3.2 * snoise(xz * vec2(0.006, 0.011) + 3.1) + 1.4 * snoise(xz * 0.021 + 7.7) + 0.4 * snoise(xz * 0.07);
  return folds * far + 0.8 * far;
}
float scaleD(vec3 p) {
  float a1 = sdBox3(p - vec3(SX0 + SL * 0.5, SY, SZ0 - SW * 0.5), vec3(SL * 0.5, ST, SW * 0.5));
  float a2 = sdBox3(p - vec3(SX0 + SW * 0.5, SY, SZ0 - SL * 0.5), vec3(SW * 0.5, ST, SL * 0.5));
  return min(a1, a2) - 0.15;
}
float risers(vec3 p) {
  float h = (SY - ST) * 0.5;
  float r = sdBox3(p - vec3(SX0 + SL - 12.0, h, SZ0 - SW * 0.5), vec3(7.0, h, 6.5));
  r = min(r, sdBox3(p - vec3(SX0 + SW * 0.5, h, SZ0 - SL + 12.0), vec3(6.5, h, 7.0)));
  r = min(r, sdBox3(p - vec3(SX0 + 3.5, h, SZ0 - 3.5), vec3(3.5, h, 3.5)));
  return r - 0.6;
}

vec2 map(vec3 p) {
  vec2 r = vec2(p.y - clothH(p.xz), M_CLOTH);
  float ab = length(p - AC) - AR - 8.0;
  if (ab < r.x) r = opU(r, vec2(apple(p), M_SKIN));
  else r = opU(r, vec2(ab + 4.0, M_SKIN));
  r = opU(r, vec2(stem(p), M_STEM));
  r = opU(r, vec2(scaleD(p), M_SCALE));
  r = opU(r, vec2(risers(p), M_RISER));
  return r;
}
float mapD(vec3 p) { return map(p).x; }

vec3 calcN(vec3 p, float e) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}

/** Near the bite the height field is steep (the letters' walls): smaller steps there. */
float stepK(vec3 p) { return (p.y > 60.0 && abs(p.x) < 32.0 && abs(p.z - 4.0) < 28.0) ? 0.45 : 0.85; }

vec2 march(vec3 ro, vec3 rd, float tmax) {
  float t = 0.0;
  // start at the top of the set (nothing stands above Y = 92)
  if (ro.y > 92.0 && rd.y < 0.0) t = (ro.y - 92.0) / -rd.y;
  for (int i = 0; i < 320; i++) {
    vec3 p = ro + rd * t;
    vec2 h = map(p);
    if (abs(h.x) < 0.0003 * t + 0.002) return vec2(t, h.y);
    t += h.x * stepK(p);
    if (t > tmax) break;
  }
  return vec2(-1.0, 0.0);
}

float softShadow(vec3 ro, vec3 rd, float maxt, float k) {
  float res = 1.0, t = 0.04;
  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t;
    float h = mapD(p);
    res = min(res, k * h / t);
    t += clamp(h * stepK(p), 0.02, 6.0);
    if (res < 0.002 || t > maxt) break;
  }
  res = sat(res);
  return res * res * (3.0 - 2.0 * res);
}

float calcAO(vec3 p, vec3 n, float sc) {
  float occ = 0.0, w = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = sc * float(i * i);
    occ += (h - mapD(p + n * h)) * w;
    w *= 0.6;
  }
  return sat(1.0 - 2.2 * occ / sc);
}

float D_GGX(float NoH, float a) { float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
float V_SmithJ(float NoV, float NoL, float a) {
  float a2 = a * a;
  float gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2), gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
  return 0.5 / max(gv + gl, 1e-5);
}
float F_Sch(float f0, float VoH) { return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0); }

// ---------------------------------------------------------------- surfaces
/** The ABFO No. 2 scale's printed face at world p: white ink (0..1) and grey patch level (-1 none). Its markings are
 *  pattern only: mm ticks along both inner edges, three distortion circles, a grey-scale bar, blocks where the
 *  numerals sit (no legible figure); the case label is a sticker (labelTex). Out: the sticker (paper, ink). */
float scaleInk(vec3 p, float fp, out float grey, out vec2 sticker) {
  grey = -1.0; sticker = vec2(0.0);
  // arm coordinates: u along the arm from the outer corner, v across from the inner edge (0) outward
  bool arm1 = p.z > SZ0 - SW;
  float u = arm1 ? p.x - SX0 : SZ0 - p.z;
  float v = arm1 ? p.z - (SZ0 - SW) : (SX0 + SW) - p.x;
  float ink = 0.0;
  float fu = max(fp, 0.002);
  // mm ticks along the inner edge, past the corner square
  if (u > SW + 0.5 && u < SL - 1.0) {
    float mm = u - SW;
    float k = floor(mm + 0.5);
    float L = mod(k, 10.0) < 0.5 ? 4.2 : mod(k, 5.0) < 0.5 ? 2.8 : 1.6;
    float du = abs(mm - k);
    ink = max(ink, (1.0 - smoothstep(0.09 - fu, 0.09 + fu, du)) * step(v, L));
    // the numeral blocks by each centimetre tick: a pair of small marks, pattern only
    float kc = floor(mm / 10.0 + 0.5) * 10.0;
    vec2 nb = vec2(mm - kc - 0.2, v - 5.6);
    float blk = max(sdBox(nb - vec2(-0.55, 0.0), vec2(0.38, 0.62)), -sdBox(nb - vec2(-0.55, 0.0), vec2(0.17, 0.4)));
    blk = min(blk, sdBox(nb - vec2(0.55, 0.0), vec2(0.38, 0.62)) + 0.0 * hash11(kc));
    blk = max(blk, -sdBox(nb - vec2(0.55, 0.1 * sign(hash11(kc + 3.0) - 0.5)), vec2(0.15, 0.3)));
    if (kc > 0.5 && kc < SL - SW - 1.0) ink = max(ink, 1.0 - smoothstep(-0.03, 0.06, blk));
  }
  // the edge rule along the inner edge
  ink = max(ink, (1.0 - smoothstep(0.1 - fu, 0.1 + fu, abs(v - 0.35))) * step(SW + 0.5, u));
  // three circles: the corner and both arms' ends
  vec2 cc = arm1 ? vec2(p.x, p.z) - vec2(SX0 + SW * 0.5, SZ0 - SW * 0.5) : vec2(1e3);
  float dCirc = abs(length(cc) - 4.0);
  vec2 ce = vec2(u - (SL - 8.5), v - SW * 0.5);
  dCirc = min(dCirc, abs(length(ce) - 4.0));
  ink = max(ink, 1.0 - smoothstep(0.16, 0.16 + 2.0 * fu, dCirc));
  ink = max(ink, (1.0 - smoothstep(0.06, 0.06 + 2.0 * fu, min(abs(ce.x), abs(ce.y)))) * step(length(ce), 2.6));
  // the grey-scale bar: patches stepping from near black to light grey along the outer edge of each arm
  if (u > SW + 6.0 && u < SW + 36.0 && v > SW - 5.6 && v < SW - 1.4) {
    grey = floor((u - SW - 6.0) / 5.0) / 5.0;
  }
  // the case label: a white sticker on the long arm (arm 1)
  if (arm1) {
    vec2 s = vec2(u - 70.0, v - 10.4);
    float sd = sdBox(s, vec2(14.5, 3.6)) - 0.4;
    if (sd < 0.0) sticker = vec2(1.0, textureLod(labelTex, vec2(s.x / 29.8 + 0.5, 0.5 - s.y / 8.0), 0.0).a);
  }
  return ink;
}

vec3 env(vec3 rd) { return T_FILM * 0.15; }

vec4 shade(vec3 ro, vec3 rd, float tap) {
  vec2 h = march(ro, rd, 2500.0);
  if (h.x < 0.0) return vec4(env(rd), 3000.0);
  float t = h.x, m = h.y;
  vec3 P = ro + rd * t;
  float eN = clamp(0.0006 * t, 0.012, 0.4);
  vec3 N = calcN(P, eN);
  vec3 V = -rd;
  // re-evaluate the bite at P for its shading channels
  float dA = apple(P);
  float mk = gMark;
  vec3 L = keyPos - P; float lD = length(L); L /= lD;
  // the flash's shadow: a soft ray (the flash head's size gives the penumbra), jittered per tap over the head
  vec3 jit = (hash33(vec3(FRAG_PX * 0.73, tap * 3.1)) - 0.5) * keyRad * 0.6;
  vec3 Ls = normalize(keyPos + jit - P);
  float sh = dot(N, Ls) > 0.0 ? softShadow(P + N * 0.03, Ls, lD, lD / max(keyRad, 0.1) * 0.5) : 0.0;
  float ao = calcAO(P, N, m == M_SKIN ? 0.25 : 2.0);
  vec3 alb = T_SILVER; float rough = 0.5, f0 = 0.04, wrap = 0.0, sheen = 0.0;
  vec3 wrapTint = vec3(1.0);
  float fleshK = 0.0; vec3 fleshC = vec3(0.0); float skinCoat = 0.0;
  if (m == M_SKIN) {
    vec3 q = toApple(P);
    float hN = q.x / AH, phi = atan(q.z, q.y);
    // the skin: a dusty wax-pink blush over a stone-yellow ground, streaked along the meridians (stem to calyx) and
    // mottled, the ground showing through toward the stem; cold flash light keeps it desaturated
    vec3 deep = mix(mix(T_WAX, T_STONE, 0.06), T_FILM2, 0.66);
    vec3 mid = mix(mix(T_WAX, T_STONE, 0.2), T_SILVER, 0.35) * 0.55;
    vec3 grnd = mix(T_STONE, T_SILVER, 0.45) * 0.45;
    // the blush on the side that faced the sun (the top, where the bite is), its fringe broken into fine streaks
    vec3 nq = normalize(q);
    float sun = dot(nq, normalize(vec3(-0.25, 0.85, 0.35))) + 0.35 * fbm(vec2(phi * 1.1, hN * 1.3) + 4.0, 3);
    float base = smoothstep(-0.55, 0.45, sun);
    float st = (snoise(vec2(phi * 46.0, hN * 0.9)) * 0.6 + snoise(vec2(phi * 110.0, hN * 1.8)) * 0.4) * smoothstep(0.92, 0.55, abs(hN));
    float mott = snoise(vec2(phi * AR, q.x) * 0.25) * 0.5 + snoise(vec2(phi * AR, q.x) * 1.1) * 0.25;
    float blush = sat(base + st * 0.5 * (0.2 + base * (1.0 - base) * 3.0) + 0.18 * mott);
    // inside the blush: deep rose, broken by finer, lighter streaks (the stripes of a Pink Lady)
    float st2 = snoise(vec2(phi * 70.0, hN * 1.4)) * 0.55 + snoise(vec2(phi * 160.0, hN * 2.5)) * 0.35 + 0.3 * mott;
    // deep rose ground with paler streaks running stem to calyx, and broad paler patches where the ground shows
    // darker streaks running stem to calyx (wavering, of uneven width) over a rose ground, broad paler patches where
    // the yellow ground shows through
    float sw = snoise(vec2(phi * 44.0 + 0.3 * snoise(vec2(phi * 4.0, hN * 3.0)), hN * 0.6)) + 0.45 * snoise(vec2(phi * 120.0, hN * 1.2));
    float dark = smoothstep(-0.05, 0.55, sw);
    float pale = 0.45 * smoothstep(0.1, 0.75, snoise(vec2(phi * 5.0, hN * 2.4) + 1.3));
    vec3 inB = mix(mix(mid, deep, 0.4), deep, dark * 0.6);
    inB = mix(inB, mid * 1.08, pale * (1.0 - dark * 0.6));
    alb = mix(grnd, inB, blush);
    alb *= 0.93 + 0.1 * mott;
    // lenticels: small pale dots
    vec2 sc = vec2(phi * AR, q.x) / 1.05;
    vec2 ci = floor(sc), cf = fract(sc) - 0.5;
    vec2 jo = (hash22(ci) - 0.5) * 0.7;
    float lr = 0.07 + 0.08 * hash12(ci + 7.0);
    float len = 1.0 - smoothstep(lr * 0.5, lr, length(cf - jo));
    alb = mix(alb, mix(T_HALIDE, T_STONE, 0.35) * 0.5, len * 0.55 * step(0.35, hash12(ci + 3.0)));
    rough = 0.42 + 0.06 * snoise(P * 0.4); f0 = 0.035;
    // the skin's fine relief (the raking flash finds it): a bump on the shading normal
    {
      vec2 bq = vec2(phi * AR, q.x) * 2.6;
      float b0 = snoise(bq), bx = snoise(bq + vec2(0.05, 0.0)), by = snoise(bq + vec2(0.0, 0.05));
      vec3 tU = normalize(cross(vec3(1.0, 0.0, 0.0), N) + 1e-4), tV = normalize(cross(N, tU));
      N = normalize(N - 0.006 * ((bx - b0) / 0.05 * tU + (by - b0) / 0.05 * tV) * (1.0 - smoothstep(0.0, 0.3, mk)));
    }
    skinCoat = 1.0; wrap = 0.3; wrapTint = mix(vec3(1.0), T_WAX * 1.2, 0.5);
    // the skin round the marks pressed glassy and a little darker (a bruise starting under it)
    float bru = smoothstep(-0.05, 0.15, mk) * 0.18;
    alb *= 1.0 - bru;
    // the flesh where the teeth broke the skin
    float flesh = smoothstep(0.2, 0.36, mk);
    if (flesh > 0.0) {
      vec3 cream = mix(T_LIGHTBOX, T_STONE, 0.17) * 0.86;
      vec3 ox = mix(T_STONE, T_SILVER, 0.3) * 0.62;
      // oxidising: a little browner near the torn edge and unevenly along the groove
      float cell = hash12(floor(vec2(P.x, P.z) * 7.0));
      float oxi = sat(0.08 + 0.1 * snoise(vec2(P.x, P.z) * 0.9) + 0.4 * (1.0 - smoothstep(0.36, 0.6, mk)));
      vec3 fl = mix(cream, ox, oxi) * (0.94 + 0.08 * cell);
      fleshK = flesh; fleshC = fl;
      // the torn skin's thin edge: a darker pink line at the cut
      float rim = smoothstep(0.0, 0.4, flesh) * (1.0 - smoothstep(0.4, 1.0, flesh));
      alb = mix(alb, fl, smoothstep(0.3, 0.8, flesh));
      alb = mix(alb, deep * 0.8, rim * 0.3);
      rough = mix(rough, 0.34, flesh); f0 = mix(f0, 0.03, flesh); wrap = mix(wrap, 0.55, flesh);
      wrapTint = mix(wrapTint, vec3(1.0), flesh);
    }
    // the calyx at -X: a dark dry star
    float cr = length(q.yz);
    if (q.x < -AH + 4.0) {
      float star = smoothstep(4.5, 1.0, cr + 1.2 * cos(5.0 * phi));
      alb = mix(alb, mix(T_FILM2, T_STONE, 0.12) * 0.5, star);
      rough = mix(rough, 0.8, star);
    }
  } else if (m == M_STEM) {
    alb = mix(T_STONE, T_FILM2, 0.86) * (0.75 + 0.3 * snoise(P * vec3(0.6, 3.0, 3.0))); rough = 0.75;
  } else if (m == M_CLOTH) {
    // black velvet: almost no diffuse, a sheen at grazing angles
    float fib = snoise(P.xz * 3.5) * 0.5 + snoise(P.xz * 0.9) * 0.5;
    alb = T_FILM * (0.55 + 0.1 * fib); rough = 1.0; f0 = 0.0; sheen = 0.18 + 0.05 * fib;
  } else if (m == M_SCALE) {
    // matte black plastic; on the top face the printed markings
    alb = T_FILM * 1.1; rough = 0.55; f0 = 0.04;
    if (N.y > 0.8 && P.y > SY) {
      float grey; vec2 stk;
      float fp = t * 2.0 * tanH / 1080.0 / max(abs(dot(N, V)), 0.25);
      float ink = scaleInk(P, fp, grey, stk);
      if (grey >= 0.0) alb = mix(T_FILM2 * 0.8, T_HALIDE * 0.6, grey);
      alb = mix(alb, T_LIGHTBOX * 0.72, ink);
      if (stk.x > 0.0) { alb = mix(T_LIGHTBOX * 0.78, T_FILM * 0.8, stk.y); rough = 0.7; }
    }
  } else if (m == M_RISER) {
    alb = T_FILM2 * 0.6; rough = 0.9; f0 = 0.02;
  }
  // the flash: a small head, an inverse-square falloff
  float NoL = dot(N, L);
  float difL = sat((NoL + wrap) / (1.0 + wrap));
  vec3 difC = mix(vec3(1.0), wrapTint, sat(wrap * 2.0) * (1.0 - sat(NoL * 2.0)));
  // the head's beam: it is aimed at the subject and falls off toward the frame's edges
  float spot = mix(0.25, 1.0, smoothstep(keyCone - 0.06, keyCone + 0.02, dot(-L, keyDir)));
  float fall = keyI / (lD * lD) * 1e5 * spot;
  vec3 Hh = normalize(L + V);
  float NoV = max(dot(N, V), 1e-4), NoH = max(dot(N, Hh), 0.0);
  float a = max(rough * rough, 0.02);
  float spec = f0 > 0.0 ? F_Sch(f0, max(dot(V, Hh), 0.0)) * D_GGX(NoH, a) * V_SmithJ(NoV, max(NoL, 0.0), a) * max(NoL, 0.0) : 0.0;
  vec3 col = alb * difC * difL * fall * sh * T_LIGHTBOX;
  col += T_LIGHTBOX * spec * fall * sh;
  // the wax on the skin: a crisp image of the flash head over the broad sheen
  if (skinCoat > 0.0) {
    float ac = 0.025;
    col += T_LIGHTBOX * skinCoat * F_Sch(0.025, max(dot(V, Hh), 0.0)) * D_GGX(NoH, ac) * V_SmithJ(NoV, max(NoL, 0.0), ac) * max(NoL, 0.0) * fall * sh * 0.5;
  }
  col += T_SILVER * sheen * pow(1.0 - NoV, 4.0) * fall * (0.3 + 0.7 * sh) * sat(NoL + 0.6);
  // apple flesh is translucent: the cut glows a little with the light that reaches the fruit around it (so the
  // letters read cream even where their own walls shade their floors)
  if (fleshK > 0.0) {
    vec3 nb = normalize(P - AC);
    col += fleshK * fleshC * T_LIGHTBOX * fall * 0.42 * sat(dot(nb, L) + 0.25) * spot;
  }
  // the fill: a weak cold bounce from the copy stand's side, and the room
  col += alb * T_LIGHTBOX * fillI * sat(0.35 + 0.65 * dot(N, fillDir)) * mix(0.35, 1.0, ao);
  col += alb * T_FILM2 * 0.6 * ao;
  float depth = dot(P - ro, camF);
  // nothing here may bloom: everything stops under the bloom threshold
  col = min(col, vec3(0.95));
  return vec4(col, depth);
}

void main() {
  vec3 acc = vec3(0.0); float dep = 0.0;
  for (int k = ssK0(); k < ssK1(); k++) {
    vec2 px = FRAG_PX + rgss(k) / PX_SCALE;
    vec2 ndc = px / vec2(${W.toFixed(1)}, ${H.toFixed(1)}) * 2.0 - 1.0;
    vec3 rd = normalize(camF + camR * ndc.x * tanH * ${(W / H).toFixed(5)} + camU * ndc.y * tanH);
    vec4 s = shade(camPos, rd, float(k));
    acc += s.rgb; dep += s.a;
  }
  float w = ssWeight();
  vec3 col = acc * w;
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  fragColor = vec4(col, dep * w);
}`;

/** Depth of field: a gather over a golden-angle disc (as the drawer's); what lies behind a sharper pixel cannot
 *  spread over it. */
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
