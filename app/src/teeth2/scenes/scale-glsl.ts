// `scale` shaders: the ray-marched bite-mark photograph (an apple standing on film-black velvet, an ABFO No. 2 scale
// standing on the cloth in the plane of the bite, beside it), lit by one photographic flash; and a depth-of-field
// gather. Units: millimetres, Y up, the cloth at Y = 0. The apple stands stem up; the bite is on its flank facing the
// camera, so the bite's photo frame (scale-bite.ts) maps onto it as X along the tangent BT, Y = world up.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL, W, H } from '../../engine/gl';
import { PATCH } from './scale-bite';

const f = (x: number) => x.toFixed(4);

/** Layout shared with scale.ts. */
export const LAY = {
  /** the apple: centre, equatorial radius, half height (stem axis Y), its lean about Z */
  AC: [0, 39, 0] as const, AR: 39, AH: 38, AROT: 0.07,
  /** the bite: its azimuth about the apple's axis (from +Z toward +X), its centre's height above the apple's centre */
  BAZ: 0.36, BH: 3.5,
  /** the scale: its outer corner at photo X = SU0 from the bite, on the cloth, its face SW0 behind the bite's surface;
   *  arm length and width, thickness */
  SU0: 40.5, SW0: 1.2, SL: 100, SWD: 18, ST: 1.6,
};

export const MARCH_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform vec3 keyPos, keyDir; uniform float keyI, keyRad, keyCone;
uniform vec3 fillDir; uniform float fillI;
uniform sampler2D marksTex, wordTex, labelTex, digitTex;
uniform float wordAmt, wordWax, coatK;
uniform vec3 BC, BN, BT;          // the bite: centre on the skin, normal, tangent (photo X)
uniform vec3 SO;                  // the scale's outer corner (on the cloth, its face)

const vec3 AC = vec3(${LAY.AC.map(f).join(',')});
const float AR = ${f(LAY.AR)}, AH = ${f(LAY.AH)}, AROT = ${f(LAY.AROT)};
const vec4 PATCHR = vec4(${f(PATCH.x0)}, ${f(PATCH.y0)}, ${f(1 / (PATCH.x1 - PATCH.x0))}, ${f(1 / (PATCH.y1 - PATCH.y0))});
const float SL = ${f(LAY.SL)}, SWD = ${f(LAY.SWD)}, ST = ${f(LAY.ST)};

const float M_SKIN = 1.0, M_CLOTH = 2.0, M_SCALE = 3.0, M_BLOCK = 4.0, M_STEM = 5.0;

vec2 opU(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

// ---------------------------------------------------------------- the apple
/** World to the apple's frame (centred, stem axis Y, its slight lean removed). */
vec3 toApple(vec3 p) { vec3 q = p - AC; float c = cos(AROT), s = sin(AROT); return vec3(c * q.x + s * q.y, -s * q.x + c * q.y, q.z); }

/** The body: broad shoulders, tapering to the calyx, a deep stem well, a shallow calyx well, the faintest five-fold
 *  shoulders at the base. */
float appleBody(vec3 p) {
  vec3 q = toApple(p);
  float h = q.y / AH;
  float r = length(q.xz);
  float phi = atan(q.z, q.x);
  float rad = AR * (1.0 + 0.08 * h - 0.06 * h * h) - 6.5 * pow(max(-h, 0.0), 2.0);
  rad += 0.3 * cos(5.0 * phi + 0.4) * smoothstep(-0.3, -0.9, h) + 0.35 * snoise(vec2(phi * 1.5, h * 2.0));
  float d = (length(vec2(r, q.y * AR / AH)) - rad) * 0.9;
  d += 8.0 * exp(-r * r / 70.0) * smoothstep(0.3, 0.85, h);
  d += 3.4 * exp(-r * r / 28.0) * smoothstep(-0.3, -0.85, h);
  return d;
}

/** The bite: his marks sunk into the skin (each incisal mark a cut wall on its outer side and a scallop dragged toward
 *  the bite's centre; the canines sharp punctures), the word bitten between the arcs; torn skin edges. */
float gMark = 0.0, gRim = 9.0, gFlesh = 0.0;
float mdI(float s, float D) { return D * smoothstep(0.18, -0.25, s) * (0.6 + 0.4 * sqrt(sat(-s / 0.7))); }
float mdS(float s, float D) { return D * smoothstep(0.75, -0.55, s); }
float mdC(float s) { return 2.2 * pow(sat(-s / 0.7), 0.5) * smoothstep(0.06, -0.06, s); }
vec4 mkAt(vec2 X) { return textureLod(marksTex, (X - PATCHR.xy) * PATCHR.zw, 0.0); }
float biteDepth(vec2 X) {
  vec2 uv = (X - PATCHR.xy) * PATCHR.zw;
  vec4 mk = textureLod(marksTex, uv, 0.0);
  float wd = textureLod(wordTex, uv, 0.0).r;
  // torn edges: the cut wanders a little
  float tn = 0.035 * snoise(X * 2.2) + 0.012 * snoise(X * 6.0);
  float fac = mix(1.0, 0.82, sat(abs(X.x) / 13.0));
  // the incisal marks, grown just enough to close the gaps between neighbouring teeth (the kit's marks are each
  // tooth's edge; the bite's wall runs on between them) so that #8's diagonal notch is the one break in the arc
  float sU = mk.r - 0.12 + tn, sL = mk.b - 0.08 + tn, sC = mk.g + 0.38 + tn * 0.3, sB = mk.a + tn;
  float dU = mdI(sU, 1.35 * fac), dL = mdI(sL, 1.05 * fac);
  // the bridges between neighbouring teeth: the wall runs on, shallower (no break in the skin)
  float dB = mdI(sB, 0.7 * fac);
  // the drag: each mark's scallop runs on toward the bite's centre, shallowing
  vec2 dir = normalize(X + vec2(0.0, 1e-3));
  for (int k = 1; k <= 4; k++) {
    float fk = float(k);
    vec4 mq = mkAt(X + dir * 0.4 * fk);
    float wk = 0.55 * (1.0 - fk / 5.0);
    dU = max(dU, mdS(mq.r - 0.12 + tn, 1.35 * fac * wk));
    dL = max(dL, mdS(mq.b - 0.08 + tn, 1.05 * fac * wk));
    dB = max(dB, mdS(mq.a + tn, 0.7 * fac * wk));
  }
  float dC = mdC(sC);
  float sW = wd + tn * 0.8;
  float dW = 1.45 * smoothstep(0.12, -0.28, sW) * (0.5 + 0.5 * sqrt(sat(-sW / 0.8))) * wordAmt;
  float m = max(max(max(dU, dL), max(dC, dW)), dB);
  // the torn skin's edge curls up a hair
  float sN = min(min(min(sU, sL), min(sC, sW + (1.0 - wordAmt) * 6.0)), sB + 0.3);
  float lip = -0.06 * exp(-pow((sN - 0.1) / 0.12, 2.0));
  vec2 e = X / vec2(18.0, 16.0);
  float dent = 0.5 * exp(-dot(e, e) * 1.6);
  gMark = m; gRim = sN;
  // where the teeth went through the skin: the incisal cut line of each mark (a hairline of flesh), the punctures,
  // and the bitten word's cores (the hero, in white flesh)
  gFlesh = max(max(smoothstep(0.92, 1.08, max(dU, dL)), smoothstep(1.2, 1.6, dC)), smoothstep(0.45, 0.75, dW));
  return m + lip + dent;
}

vec2 photoX(vec3 p) { vec3 d = p - BC; return vec2(dot(d, BT), d.y); }

float apple(vec3 p) {
  float d = appleBody(p);
  gMark = 0.0; gRim = 9.0; gFlesh = 0.0;
  vec2 X = photoX(p);
  if (dot(p - AC, BN) > 16.0 && abs(X.x) < 28.0 && X.y > -20.0 && X.y < 22.0 && d < 4.0) d += biteDepth(X);
  return d;
}

float stem(vec3 p) {
  vec3 q = toApple(p);
  vec3 a = vec3(0.0, 24.0, 0.0), b = vec3(0.7, 35.0, 0.3), c = vec3(2.4, 43.5, 0.9);
  float r = 1.45 - 0.4 * sat((q.y - 24.0) / 20.0);
  float d = min(sdCapsule(q, a, b, r), sdCapsule(q, b, c, r * 0.95));
  // the cut end: a slight swelling
  return smin(d, length(q - c) - r * 1.08, 0.6);
}

// ---------------------------------------------------------------- the cloth, the scale, its block
float clothH(vec2 xz) {
  float far = smoothstep(180.0, 320.0, length(xz));
  return far * (3.0 * snoise(xz * 0.008 + 3.1) + 1.2 * snoise(xz * 0.02 + 7.7));
}
/** Scale-local (u along BT from the outer corner, v up from the cloth, w along BN, 0 at the face). */
vec3 scaleL(vec3 p) { vec3 d = p - SO; return vec3(dot(d, BT), d.y, dot(d, BN)); }
float scaleD(vec3 p) {
  vec3 s = scaleL(p);
  float a1 = sdBox3(s - vec3(SWD * 0.5, SL * 0.5, -ST * 0.5), vec3(SWD * 0.5, SL * 0.5, ST * 0.5));
  float a2 = sdBox3(s - vec3(SL * 0.5, SWD * 0.5, -ST * 0.5), vec3(SL * 0.5, SWD * 0.5, ST * 0.5));
  return min(a1, a2) - 0.12;
}
float blockD(vec3 p) {
  vec3 s = scaleL(p);
  return sdBox3(s - vec3(10.0, 15.0, -ST - 9.0), vec3(8.0, 15.0, 9.0)) - 0.8;
}

vec2 map(vec3 p) {
  vec2 r = vec2(p.y - clothH(p.xz), M_CLOTH);
  float ab = length(p - AC) - AR - 6.0;
  if (ab < r.x) r = opU(r, vec2(apple(p), M_SKIN));
  else r = opU(r, vec2(ab + 3.0, M_SKIN));
  r = opU(r, vec2(stem(p), M_STEM));
  r = opU(r, vec2(scaleD(p), M_SCALE));
  r = opU(r, vec2(blockD(p), M_BLOCK));
  return r;
}
float mapD(vec3 p) { return map(p).x; }

vec3 calcN(vec3 p, float e) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}

/** The bite's height field and the stem well are steep: smaller steps there. */
float stepK(vec3 p) {
  vec3 q = p - AC;
  if (dot(q, BN) > 14.0 && abs(q.y) < 30.0) return 0.42;
  if (q.y > 20.0 && length(q.xz) < 16.0) return 0.55;
  return 0.85;
}

vec2 march(vec3 ro, vec3 rd, float tmax) {
  float t = 0.0;
  if (ro.y > 130.0 && rd.y < 0.0) t = (ro.y - 130.0) / -rd.y;
  for (int i = 0; i < 300; i++) {
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
    t += clamp(h * stepK(p), 0.02, 8.0);
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

// ---------------------------------------------------------------- the ABFO No. 2's printed face
/** One digit (0..9) of the Plex Mono atlas, centred at c, h mm tall, in face coords (u right, v up). */
float digit(vec2 s, vec2 c, float k, float h, float fp) {
  vec2 d = (s - c) / vec2(h * 0.62, h);
  if (abs(d.x) > 0.5 || abs(d.y) > 0.5) return 0.0;
  float lod = log2(max(fp * 106.0 / h, 1.0));
  return textureLod(digitTex, vec2((k + d.x + 0.5) / 10.0, d.y + 0.5), lod).a;
}
/** White ink (0..1), grey patch level (-1 none), the case sticker (paper, ink). Rulers on the long arm's edge toward
 *  the bite (u = 0) and the foot's top edge (v = SWD), cm numerals, three distortion circles, a grey-scale bar. */
float scaleInk(vec2 s, float fp, out float grey, out vec2 sticker) {
  grey = -1.0; sticker = vec2(0.0);
  float ink = 0.0;
  float fu = max(fp, 0.004);
  bool upright = s.x < SWD && s.y > SWD;
  // ruler: mm along the arm past the corner square, ticks growing in from the edge
  float mm = upright ? s.y - SWD : s.x - SWD;
  float across = upright ? s.x : SWD - s.y;
  if (mm > 0.4 && mm < SL - SWD - 1.0) {
    float k = floor(mm + 0.5);
    float L = mod(k, 10.0) < 0.5 ? 4.3 : mod(k, 5.0) < 0.5 ? 2.9 : 1.7;
    ink = max(ink, (1.0 - smoothstep(0.085 - fu, 0.085 + fu, abs(mm - k))) * step(across, L));
    // the centimetre numerals, upright
    float kc = floor(mm / 10.0 + 0.5);
    if (kc >= 1.0 && kc <= 6.0) {
      vec2 c = upright ? vec2(6.3, SWD + kc * 10.0) : vec2(SWD + kc * 10.0, SWD - 6.3);
      ink = max(ink, digit(s, c, kc, 2.3, fu));
    }
  }
  ink = max(ink, (1.0 - smoothstep(0.09 - fu, 0.09 + fu, abs(across - 0.35))) * step(0.0, mm));
  // three circles: the corner and both arms' ends, each with a fine cross
  vec2 cs[3] = vec2[3](vec2(SWD * 0.5), vec2(SWD * 0.5, SL - 9.0), vec2(SL - 9.0, SWD * 0.5));
  for (int i = 0; i < 3; i++) {
    vec2 d = s - cs[i];
    ink = max(ink, 1.0 - smoothstep(0.17, 0.17 + 2.0 * fu, abs(length(d) - 4.0)));
    ink = max(ink, (1.0 - smoothstep(0.06, 0.06 + 2.0 * fu, min(abs(d.x), abs(d.y)))) * step(length(d), 2.6));
  }
  // the grey-scale bar on the long arm's outer side
  if (upright && s.x > SWD - 5.5 && s.x < SWD - 1.5 && s.y > SWD + 6.0 && s.y < SWD + 36.0) grey = floor((s.y - SWD - 6.0) / 5.0) / 5.0;
  // the case label: a white sticker on the foot
  vec2 st = s - vec2(68.0, 6.6);
  if (sdBox(st, vec2(14.5, 3.6)) - 0.4 < 0.0) sticker = vec2(1.0, textureLod(labelTex, vec2(st.x / 29.8 + 0.5, st.y / 8.0 + 0.5), 0.0).a);
  return ink;
}

vec3 env(vec3 rd) { return T_FILM * 0.1; }

vec4 shade(vec3 ro, vec3 rd, float tap) {
  vec2 h = march(ro, rd, 3000.0);
  if (h.x < 0.0) return vec4(env(rd), 4000.0);
  float t = h.x, m = h.y;
  vec3 P = ro + rd * t;
  float eN = clamp(0.0006 * t, 0.012, 0.4);
  vec3 N = calcN(P, eN);
  vec3 V = -rd;
  float dA = apple(P);
  float mk = gMark, rim = gRim, fl0 = gFlesh;
  vec3 L = keyPos - P; float lD = length(L); L /= lD;
  vec3 jit = (hash33(vec3(FRAG_PX * 0.73, tap * 3.1)) - 0.5) * keyRad * 0.6;
  vec3 Ls = normalize(keyPos + jit - P);
  float sh = dot(N, Ls) > 0.0 ? softShadow(P + N * 0.03, Ls, lD, lD / max(keyRad, 0.1) * 0.5) : 0.0;
  float ao = m == M_SKIN ? mix(calcAO(P, N, 0.25), 1.0, 0.5) : calcAO(P, N, 2.0);
  vec3 alb = T_SILVER; float rough = 0.5, f0 = 0.04, wrap = 0.0, sheen = 0.0, coat = 0.0;
  float fleshK = 0.0; vec3 fleshC = vec3(0.0);
  if (m == M_SKIN) {
    vec3 q = toApple(P);
    float hN = q.y / AH, phi = atan(q.z, q.x);
    // a deep, desaturated wax over a stone-yellow ground: a Pink Lady's blush on the side that faced the sun, broken
    // at its fringe into fine striations running stem to calyx, yellow flecks showing through
    vec3 deepW = mix(mix(mix(T_WAX, T_STONE, 0.16), T_SILVER, 0.12), T_FILM2, 0.68);
    vec3 darkW = mix(mix(T_WAX, T_STONE, 0.1), T_FILM2, 0.8);
    vec3 grnd = mix(T_STONE, T_SILVER, 0.45) * 0.42;
    vec3 nq = normalize(q);
    vec3 sunD = normalize(vec3(BN.x, 0.35, BN.z));
    float sun = dot(nq, sunD) + 0.55 * fbm(vec2(phi * 1.6, hN * 1.8) + 4.0, 3);
    float base = smoothstep(-0.25, 0.55, sun);
    float stri = snoise(vec2(phi * 22.0, hN * 0.9)) * 0.45 + snoise(vec2(phi * 64.0, hN * 1.3)) * 0.35 + snoise(vec2(phi * 150.0, hN * 2.6)) * 0.2;
    float blush = sat(base + stri * 0.45 * (0.35 + base * (1.0 - base) * 3.0));
    alb = mix(grnd, deepW, blush);
    // fine darker striations inside the blush, and the faintest yellow flecks
    alb = mix(alb, darkW, blush * smoothstep(0.05, 0.6, stri) * 0.75);
    float fl = smoothstep(0.62, 0.85, snoise(vec2(phi * 220.0, hN * 9.0)));
    alb = mix(alb, grnd * 0.9, fl * 0.35 * blush);
    // near the stem the ground shows through; the well's skin is russeted
    alb = mix(alb, grnd * 0.8, smoothstep(0.75, 0.95, hN) * 0.6);
    // lenticels: small pale dots
    vec2 sc = vec2(phi * AR, q.y) / 1.05;
    vec2 ci = floor(sc), cf = fract(sc) - 0.5;
    vec2 jo = (hash22(ci) - 0.5) * 0.7;
    float lr = 0.07 + 0.07 * hash12(ci + 7.0);
    float len = 1.0 - smoothstep(lr * 0.5, lr, length(cf - jo));
    alb = mix(alb, mix(T_HALIDE, T_STONE, 0.35) * 0.45, len * 0.5 * step(0.4, hash12(ci + 3.0)));
    rough = 0.4 + 0.05 * snoise(P * 0.4); f0 = 0.035; wrap = 0.25; coat = 1.0;
    // the skin round the bite pressed glassy and darker (bruising under it)
    alb *= 1.0 - smoothstep(-0.05, 0.12, mk) * 0.2;
    // the dented skin a little browner down its walls (bruising), never a contour
    // the flesh where the teeth went through: white-cream, a touch oxidised at the cut edges, shaded deeper down
    float flesh = fl0;
    if (flesh > 0.0) {
      vec3 cream = mix(T_LIGHTBOX, T_STONE, 0.14) * 0.84;
      vec3 ox = mix(T_STONE, T_SILVER, 0.35) * 0.55;
      float cell = hash12(floor(vec2(dot(P, BT), P.y) * 7.0));
      float oxi = sat(0.05 + 0.08 * snoise(vec2(dot(P, BT), P.y) * 0.9) + 0.25 * (1.0 - smoothstep(0.4, 0.9, flesh)));
      vec3 flc = mix(cream, ox, oxi) * (0.93 + 0.08 * cell);
      // SWEET (the tender word) is bitten in the wax register: its flesh blushes
      flc = mix(flc, T_WAX * 0.8, wordWax * smoothstep(0.8, 1.2, mk));
      alb = mix(alb, flc, flesh);
      rough = mix(rough, 0.3, flesh); f0 = mix(f0, 0.03, flesh); wrap = mix(wrap, 0.45, flesh); coat *= 1.0 - flesh;
      fleshK = flesh; fleshC = flc;
    }
    // the calyx: a dark dry star in its well
    float cr = length(q.xz);
    if (hN < -0.75) {
      float star = smoothstep(4.0, 1.0, cr + 1.1 * cos(5.0 * phi));
      alb = mix(alb, mix(T_FILM2, T_STONE, 0.15) * 0.45, star);
      rough = mix(rough, 0.85, star); coat *= 1.0 - star;
    }
  } else if (m == M_STEM) {
    vec3 q = toApple(P);
    alb = mix(T_STONE, T_FILM2, 0.88) * (0.75 + 0.3 * snoise(vec3(q.x * 3.0, q.y * 0.6, q.z * 3.0)));
    alb = mix(alb, mix(T_STONE, T_SILVER, 0.5) * 0.35, smoothstep(40.5, 43.5, q.y));
    rough = 0.6;
  } else if (m == M_CLOTH) {
    // film-black velvet: next to no diffuse, a faint sheen at grazing angles
    float fib = snoise(P.xz * 3.5) * 0.5 + snoise(P.xz * 0.9) * 0.5;
    alb = T_FILM * (0.28 + 0.05 * fib); rough = 1.0; f0 = 0.0; sheen = 0.07 + 0.02 * fib;
  } else if (m == M_SCALE) {
    alb = T_FILM * 1.2; rough = 0.55; f0 = 0.04;
    vec3 s = scaleL(P);
    if (s.z > -0.3 && dot(N, BN) > 0.8) {
      float grey; vec2 stk;
      float fp = t * 2.0 * tanH / ${H.toFixed(1)} / max(abs(dot(N, V)), 0.25);
      float ink = scaleInk(s.xy, fp, grey, stk);
      if (grey >= 0.0) alb = mix(T_FILM2 * 0.8, T_HALIDE * 0.6, grey);
      alb = mix(alb, T_LIGHTBOX * 0.72, ink);
      if (stk.x > 0.0) { alb = mix(T_LIGHTBOX * 0.78, T_FILM * 0.8, stk.y); rough = 0.7; }
    }
  } else if (m == M_BLOCK) {
    alb = T_FILM * 0.8; rough = 0.9; f0 = 0.02;
  }
  float NoL = dot(N, L);
  float difL = sat((NoL + wrap) / (1.0 + wrap));
  float spot = mix(0.3, 1.0, smoothstep(keyCone - 0.06, keyCone + 0.02, dot(-L, keyDir)));
  float fall = keyI / (lD * lD) * 1e5 * spot;
  vec3 Hh = normalize(L + V);
  float NoV = max(dot(N, V), 1e-4), NoH = max(dot(N, Hh), 0.0);
  float a = max(rough * rough, 0.02);
  float spec = f0 > 0.0 ? F_Sch(f0, max(dot(V, Hh), 0.0)) * D_GGX(NoH, a) * V_SmithJ(NoV, max(NoL, 0.0), a) * max(NoL, 0.0) : 0.0;
  vec3 col = alb * difL * fall * sh * T_LIGHTBOX;
  col += T_LIGHTBOX * spec * fall * sh;
  // the skin's wax: a hard image of the flash head
  if (coat > 0.0) {
    float ac = 0.018;
    col += T_LIGHTBOX * coat * F_Sch(0.03, max(dot(V, Hh), 0.0)) * D_GGX(NoH, ac) * V_SmithJ(NoV, max(NoL, 0.0), ac) * max(NoL, 0.0) * fall * sh * 0.6 * coatK;
  }
  col += T_SILVER * sheen * pow(1.0 - NoV, 4.0) * fall * (0.3 + 0.7 * sh) * sat(NoL + 0.6);
  // apple flesh is translucent: the cut carries a little of the light around it
  if (fleshK > 0.0) col += fleshK * fleshC * T_LIGHTBOX * fall * 0.3 * sat(dot(normalize(P - AC), L) + 0.3);
  col += alb * T_LIGHTBOX * fillI * sat(0.35 + 0.65 * dot(N, fillDir)) * mix(0.3, 1.0, ao);
  col += alb * T_FILM2 * 0.4 * ao;
  float depth = dot(P - ro, camF);
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

/** Depth of field: a gather over a golden-angle disc; what lies behind a sharper pixel cannot spread over it. */
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
