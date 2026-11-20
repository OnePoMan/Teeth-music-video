// `scale` shaders: the ray-marched bite-mark photograph, in colour within palette 2A. A golden apple in dental-stone
// yellow (shades of stone: russet, greener by the stem, a faint desaturated wax blush) stands stem up (a cold grey-green
// leaf on the stem) on film-black velvet, ONE BITE taken out of its flank: a crescent scooped through the skin into the
// pale cream flesh, its rim scalloped by his incisal edges (the chip on #8 a notch in the scallop), his incisors' grooves
// dragged down the scoop's upper wall, the lowers' short scrapes on its lower wall. An ABFO No. 2 scale stands on the
// cloth beside the apple. The hero words are bitten OUT of the apple's other flank: letter-shaped cavities in the flesh.
// One hard flash per photograph; a depth-of-field gather. Units: mm, Y up, the cloth at Y = 0.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL, W, H } from '../../engine/gl';
import { PATCH } from './scale-bite';

const f = (x: number) => x.toFixed(4);

/** Layout shared with scale.ts. */
export const LAY = {
  /** the apple: centre, equatorial radius, half height (stem axis Y), its lean about Z */
  AC: [0, 39, 0] as const, AR: 39, AH: 38, AROT: 0.07,
  /** the bite: its azimuth about the apple's axis (from +Z toward +X), its centre's height above the apple's centre;
   *  the scoop: an ellipsoid (half sizes along the bite's tangent, up, normal), its centre out along the normal */
  BAZ: 0.5, BEL: 0.62, BH: 10, SCR: [19, 14, 15] as const, SCZ: -5.0, SCY: 0.0,
  /** the word: its azimuth and height on the apple */
  WAZ: -0.62, WH: 10,
  /** the scale: arm length, width, thickness */
  SL: 100, SWD: 18, ST: 1.6,
};

export const MARCH_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform vec3 keyPos, keyDir; uniform float keyI, keyRad, keyCone;
uniform vec3 fillDir; uniform float fillI;
uniform sampler2D wordTex, word2Tex, labelTex, digitTex;
uniform float wordAmt, wordWax, coatK, word2Amt, wordThin;
uniform vec3 W2C, W2N, W2U, W2T;      // the small supporting word: centre on the skin below the bite, normal, up
uniform vec3 BC, BN, BT, BU;      // the bite: centre on the skin, normal, tangent (photo X), up in its plane (photo Y)
uniform vec3 WC, WN, WT;          // the word: centre on the skin, normal, tangent
uniform vec3 SO, SN, SU, SV;      // the scale: outer corner, face normal, along the foot, up the upright (in the bite's plane)
uniform vec4 POST[2];             // its black posts: x, z, top y, half size
uniform vec4 upT[6]; uniform vec4 loT[6];   // tooth spans along the bite: x0, x1, depth, n

const vec3 AC = vec3(${LAY.AC.map(f).join(',')});
const float AR = ${f(LAY.AR)}, AH = ${f(LAY.AH)}, AROT = ${f(LAY.AROT)};
const vec3 SCR = vec3(${LAY.SCR.map(f).join(',')});
const float SCZ = ${f(LAY.SCZ)}, SCY = ${f(LAY.SCY)};
const vec4 PATCHR = vec4(${f(PATCH.x0)}, ${f(PATCH.y0)}, ${f(1 / (PATCH.x1 - PATCH.x0))}, ${f(1 / (PATCH.y1 - PATCH.y0))});
const float SL = ${f(LAY.SL)}, SWD = ${f(LAY.SWD)}, ST = ${f(LAY.ST)};

float lumY(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
/** A mix of two palette tokens taken in display (sRGB-like) space: a shade between them as the eye sees it. */
vec3 gmix(vec3 a, vec3 b, float t) { return pow(mix(pow(a, vec3(0.4545)), pow(b, vec3(0.4545)), t), vec3(2.2)); }
// the golden apple's shades of the palette (2A): tints and shades of stone, with silver, halide, lightbox and wax
#define STONE_G gmix(T_STONE, T_SILVER, 0.3)
#define RUSS (T_STONE * T_STONE / 0.807 * 0.62)
#define BLUSH gmix(T_STONE, gmix(T_WAX, T_HALIDE, 0.45), 0.6)
#define CREAM gmix(T_STONE, T_LIGHTBOX, 0.64)
#define OXID gmix(RUSS, T_SILVER, 0.3)
#define LEAFC gmix(T_SILVER, T_STONE, 0.22)
// (STONE_G: stone pulled toward silver, greener by the stem; RUSS: a darker, warmer shade of stone; BLUSH: the wax,
// desaturated, faint; CREAM: the flesh, stone tinted toward lightbox; OXID: the cut's faint browning; LEAFC: a cold
// green-grey between silver and stone)

const float M_SKIN = 1.0, M_CLOTH = 2.0, M_SCALE = 3.0, M_BLOCK = 4.0, M_STEM = 5.0, M_LEAF = 6.0;

vec2 opU(vec2 a, vec2 b) { return a.x < b.x ? a : b; }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }

// ---------------------------------------------------------------- the apple
vec3 toApple(vec3 p) { vec3 q = p - AC; float c = cos(AROT), s = sin(AROT); return vec3(c * q.x + s * q.y, -s * q.x + c * q.y, q.z); }
/** The skin's angle about the stem, its seam turned to the apple's back (no camera sees it). */
float sPhi(vec3 q) { const float th = 4.47; float c = cos(th), s = sin(th); return atan(q.x * s + q.z * c, q.x * c - q.z * s); }

float appleBody(vec3 p) {
  vec3 q = toApple(p);
  float h = q.y / AH;
  float r = length(q.xz);
  float phi = atan(q.z, q.x);
  float rad = AR * (1.0 + 0.08 * h - 0.06 * h * h) - 6.5 * pow(max(-h, 0.0), 2.0);
  rad += 0.3 * cos(5.0 * phi + 0.4) * smoothstep(-0.3, -0.9, h) + 0.35 * snoise(q * 0.045);
  float d = (length(vec2(r, q.y * AR / AH)) - rad) * 0.9;
  d += 8.0 * exp(-r * r / 70.0) * smoothstep(0.3, 0.85, h);
  d += 3.4 * exp(-r * r / 28.0) * smoothstep(-0.3, -0.85, h);
  return d;
}

/** How much deeper the scoop went at bite X where a tooth cut (upper or lower arc): a rounded scallop per tooth, the
 *  skin standing between teeth; #8's mesial end bites shallower (the chip's facet), so the notch shows in the rim. */
float teethCut(float X, bool upper) {
  float g = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 t = upper ? upT[i] : loT[i];
    float u = (X - t.x) / max(t.y - t.x, 0.1);
    // a canine's cusp tip is a narrow span: its pit is drawn at least ~4 mm wide and shallower (a round dimple, never
    // a slot or a fang)
    float w = t.y - t.x, hw = max(0.5 * w, 2.0);
    float uc = (X - 0.5 * (t.x + t.y)) / hw;
    if (abs(uc) < 1.15) {
      float sc = sat(1.0 - pow(abs(uc) / 1.1, 2.0)) * mix(0.5, 1.0, smoothstep(2.0, 4.5, w));
      // #8: its mesial half is the chip: the corner is missing, so it bit a shallow diagonal shelf there, then a crisp step
      // down to the full scallop (an unbitten wedge between #9 and #8 that reads as a notch in the rim)
      float facet = t.w == 8.0 ? mix(0.25 * sat(u / 0.5), 1.0, smoothstep(0.5, 0.56, u)) : 1.0;
      g = max(g, sc * mix(0.75, 1.0, t.z) * facet);
    }
  }
  return g;
}

float gCut = 1e3, gWord = 0.0;
/** The bite taken out: the scoop's signed distance (negative inside the removed volume). */
float scoop(vec3 p) {
  vec3 d = p - BC - BN * SCZ;
  vec3 q = vec3(dot(d, BT), dot(d, BU) - SCY, dot(d, BN));
  // the crescent: the upper edge arched high by the incisors, the lower edge flatter
  q.y *= mix(1.0, 1.35, smoothstep(0.0, -10.0, q.y));
  // (the ellipsoid estimate is not a bound: scaled down so the march never oversteps into the scoop)
  float s = sdEll(q, SCR) * 0.72;
  float X = dot(p - BC, BT), Y = dot(p - BC, BU) - SCY;
  // the incisors' edges: deeper scallops along the rim, their grooves dragged down the upper wall into the scoop; the
  // lowers' shorter scrapes on the lower wall
  // (only in a band at each rim: the teeth cut the rim and drag a few millimetres down the wall, not across the floor)
  float up = smoothstep(3.0, 11.0, Y), lo = smoothstep(-6.0, -14.0, Y);
  // the upper incisors cut the rim (each its own scallop) and drag down the wall; the lowers mark the far wall faintly
  // (shallow, wide arcs meeting in small points of skin: a bitten edge, never fang shapes)
  if (up > 0.0) s -= 2.3 * teethCut(X, true) * up;
  if (lo > 0.0) s -= 0.4 * teethCut(X, false) * lo;
  // tooth drag: fine grooves running down the flesh from the upper rim (perpendicular to it), fading toward the floor
  s += (0.02 + 0.03 * up) * snoise(vec2(X * 1.6, Y * 0.16)) + 0.02 * snoise(vec3(p * 2.0));
  return s * 0.8;
}

float wordDepth(vec2 X) {
  // (wordThin: the light weight the hero springs up in, its strokes eroded ~0.6 mm, before it snaps heavy)
  float wd = textureLod(wordTex, (X - PATCHR.xy) * PATCHR.zw, 0.0).r + 0.62 * wordThin;
  // the bitten edge: the outline scalloped at tooth width (~1.6 mm), torn
  float edge = smoothstep(-0.9, 0.2, wd);
  wd -= edge * 0.22 * (0.5 + 0.5 * sin(dot(X, vec2(3.9, 0.6)) + 2.0 * snoise(X * 0.6)));
  float tn = 0.06 * snoise(X * 2.2) + 0.03 * snoise(X * 7.0);
  float s = wd + tn;
  gWord = s;
  return 2.3 * smoothstep(0.3, -0.5, s) * (0.65 + 0.35 * sqrt(sat(-s / 0.8))) * wordAmt;
}

float apple(vec3 p) {
  float d = appleBody(p);
  gCut = 1e3; gWord = 9.0;
  if (dot(p - AC, WN) > 16.0) {
    vec2 X = vec2(dot(p - WC, WT), p.y - WC.y);
    if (abs(X.x) < 27.0 && abs(X.y) < 18.0 && d < 4.0) d += wordDepth(X);
  }
  if (word2Amt > 0.0 && dot(p - AC, W2N) > 16.0) {
    // a supporting word: bitten small and shallow below the bite (the hero words bite deep, elsewhere)
    vec2 X = vec2(dot(p - W2C, W2T), dot(p - W2C, W2U)) * 1.65;
    if (abs(X.x) < 27.0 && abs(X.y) < 18.0 && d < 3.0) {
      float wd = textureLod(word2Tex, (X - PATCHR.xy) * PATCHR.zw, 0.0).r * 0.5 + 0.03 * snoise(X * 1.5);
      gWord = min(gWord, wd * 2.0);
      d += 0.9 * smoothstep(0.08, -0.2, wd) * word2Amt;
    }
  }
  if (dot(p - AC, BN) > 4.0) {
    float s = scoop(p);
    gCut = s;
    d = smax(d, -s, 0.35);
  }
  return d;
}

float stem(vec3 p) {
  vec3 q = toApple(p);
  vec3 a = vec3(0.0, 24.0, 0.0), b = vec3(0.7, 35.0, 0.3), c = vec3(2.4, 44.5, 0.9);
  float r = 1.45 - 0.45 * sat((q.y - 24.0) / 20.0);
  float d = min(sdCapsule(q, a, b, r), sdCapsule(q, b, c, r * 0.95));
  return smin(d, length(q - c) - r * 1.08, 0.6);
}

/** One leaf on the stem: a pointed oval blade (cupped, drooping, a raised midrib) on a short petiole. */
const vec3 LB = vec3(1.4, 39.5, 0.6);
const vec3 LDIR = normalize(vec3(-0.82, 0.22, 0.52));
const vec3 LNRM0 = normalize(vec3(0.25, 0.95, 0.1));
vec3 leafL(vec3 p) {
  vec3 q = toApple(p) - LB;
  vec3 n = normalize(LNRM0 - LDIR * dot(LNRM0, LDIR));
  vec3 s = cross(LDIR, n);
  return vec3(dot(q, LDIR), dot(q, s), dot(q, n));
}
float leaf(vec3 p) {
  vec3 l = leafL(p);
  float pet = length(vec2(l.y, l.z + 0.02 * l.x * l.x)) - 0.55;
  pet = max(pet, max(-l.x, l.x - 7.0));
  float x = l.x - 6.0;
  float L = 36.0;
  float bend = 0.012 * x * x - 0.045 * l.y * l.y;      // droops along its length, cupped across
  float hw = 9.0 * pow(sat(sin(3.14159 * sat(x / L))), 0.75);
  float d2 = max(abs(l.y) - hw, max(-x, x - L));
  float blade = max(d2 * 0.6, abs(l.z - bend) - 0.22 - 0.2 * exp(-l.y * l.y * 2.0));
  return min(blade, pet);
}

// ---------------------------------------------------------------- the cloth, the scale, its block
float clothH(vec2 xz) {
  float far = smoothstep(200.0, 340.0, length(xz));
  return far * (3.0 * snoise(xz * 0.008 + 3.1) + 1.2 * snoise(xz * 0.02 + 7.7));
}
vec3 scaleL(vec3 p) { vec3 d = p - SO; return vec3(dot(d, SU), dot(d, SV), dot(d, SN)); }
float scaleD(vec3 p) {
  vec3 s = scaleL(p);
  float a1 = sdBox3(s - vec3(SWD * 0.5, SL * 0.5, -ST * 0.5), vec3(SWD * 0.5, SL * 0.5, ST * 0.5));
  float a2 = sdBox3(s - vec3(SL * 0.5, SWD * 0.5, -ST * 0.5), vec3(SL * 0.5, SWD * 0.5, ST * 0.5));
  return min(a1, a2) - 0.12;
}
float blockD(vec3 p) {
  float d = 1e9;
  for (int i = 0; i < 2; i++) {
    vec4 b = POST[i];
    d = min(d, sdBox3(p - vec3(b.x, b.z * 0.5, b.y), vec3(b.w, b.z * 0.5, b.w)) - 0.6);
  }
  return d;
}

vec2 map(vec3 p) {
  vec2 r = vec2(p.y - clothH(p.xz), M_CLOTH);
  float ab = length(p - AC) - AR - 6.0;
  if (ab < r.x) r = opU(r, vec2(apple(p), M_SKIN));
  else r = opU(r, vec2(ab + 3.0, M_SKIN));
  r = opU(r, vec2(stem(p), M_STEM));
  float lb = length(toApple(p) - LB - LDIR * 26.0) - 30.0;
  r = opU(r, vec2(lb < r.x ? leaf(p) * 0.6 : lb + 2.0, M_LEAF));
  r = opU(r, vec2(scaleD(p), M_SCALE));
  r = opU(r, vec2(blockD(p), M_BLOCK));
  return r;
}
float mapD(vec3 p) { return map(p).x; }

vec3 calcN(vec3 p, float e) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}

float stepK(vec3 p) {
  vec3 q = p - AC;
  if (dot(q, WN) > 14.0 && abs(q.y) < 26.0) return 0.32;
  if (length(p - BC) < 32.0) return 0.45;
  if (q.y > 20.0 && length(q.xz) < 16.0) return 0.55;
  return 0.85;
}

vec2 march(vec3 ro, vec3 rd, float tmax) {
  float t = 0.0;
  if (ro.y > 130.0 && rd.y < 0.0) t = (ro.y - 130.0) / -rd.y;
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
float digit(vec2 s, vec2 c, float k, float h, float fp) {
  vec2 d = (s - c) / vec2(h * 0.62, h);
  if (abs(d.x) > 0.5 || abs(d.y) > 0.5) return 0.0;
  float lod = log2(max(fp * 106.0 / h, 1.0));
  return textureLod(digitTex, vec2((k + d.x + 0.5) / 10.0, d.y + 0.5), lod).a;
}
float scaleInk(vec2 s, float fp, out float grey, out vec2 sticker) {
  grey = -1.0; sticker = vec2(0.0);
  float ink = 0.0;
  float fu = max(fp, 0.004);
  bool upright = s.x < SWD && s.y > SWD;
  float mm = upright ? s.y - SWD : s.x - SWD;
  float across = upright ? s.x : SWD - s.y;
  if (mm > 0.4 && mm < SL - SWD - 1.0) {
    float k = floor(mm + 0.5);
    float L = mod(k, 10.0) < 0.5 ? 4.3 : mod(k, 5.0) < 0.5 ? 2.9 : 1.7;
    ink = max(ink, (1.0 - smoothstep(0.085 - fu, 0.085 + fu, abs(mm - k))) * step(across, L));
    float kc = floor(mm / 10.0 + 0.5);
    if (kc >= 1.0 && kc <= 6.0) {
      vec2 c = upright ? vec2(6.3, SWD + kc * 10.0) : vec2(SWD + kc * 10.0, SWD - 6.3);
      ink = max(ink, digit(s, c, kc, 2.3, fu));
    }
  }
  ink = max(ink, (1.0 - smoothstep(0.09 - fu, 0.09 + fu, abs(across - 0.35))) * step(0.0, mm));
  vec2 cs[3] = vec2[3](vec2(SWD * 0.5), vec2(SWD * 0.5, SL - 9.0), vec2(SL - 9.0, SWD * 0.5));
  for (int i = 0; i < 3; i++) {
    vec2 d = s - cs[i];
    ink = max(ink, 1.0 - smoothstep(0.2, 0.2 + 2.0 * fu, abs(length(d) - 4.0)));
    ink = max(ink, 1.0 - smoothstep(0.32, 0.32 + 2.0 * fu, length(d)));
  }
  if (upright && s.x > SWD - 5.5 && s.x < SWD - 1.5 && s.y > SWD + 6.0 && s.y < SWD + 36.0) grey = floor((s.y - SWD - 6.0) / 5.0) / 5.0;
  vec2 st = s - vec2(68.0, 6.6);
  float sdk = sdBox(st, vec2(14.5, 3.6)) - 0.4;
  ink = max(ink, 1.0 - smoothstep(0.08, 0.08 + 2.0 * fu, abs(sdk)));
  if (sdk < -0.2) sticker = vec2(1.0, textureLod(labelTex, vec2(st.x / 29.8 + 0.5, st.y / 8.0 + 0.5), 0.0).a);
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
  float body0 = appleBody(P);
  float dA = apple(P);
  float cut = gCut, ws = gWord;
  vec3 L = keyPos - P; float lD = length(L); L /= lD;
  vec3 jit = (hash33(vec3(FRAG_PX * 0.73, tap * 3.1)) - 0.5) * keyRad * 0.6;
  vec3 Ls = normalize(keyPos + jit - P);
  float sh = dot(N, Ls) > 0.0 ? softShadow(P + N * 0.03, Ls, lD, lD / max(keyRad, 0.1) * 0.5) : 0.0;
  // (the bitten word's floors: soft, the flash fills them from beside the lens)
  if (m == M_SKIN && ws < 0.0) sh = mix(sh, 1.0, 0.5);
  float ao = m == M_SKIN ? mix(calcAO(P, N, 0.3), 1.0, 0.35) : calcAO(P, N, 2.0);
  vec3 alb = T_SILVER; float rough = 0.5, f0 = 0.04, wrap = 0.0, sheen = 0.0, coat = 0.0;
  float fleshK = 0.0, waxK = 0.0; vec3 fleshC = vec3(0.0);
  if (m == M_SKIN) {
    vec3 q = toApple(P);
    float hN = q.y / AH, phi = sPhi(q), cr = length(q.xz);
    float az = atan(q.x, q.z);
    // the skin: a golden apple in dental-stone yellow (a Golden Delicious): the stone ground, greener toward the stem
    // (stone pulled toward silver), a soft mottle, russet freckles and lenticels (darker, warmer shades of stone), one
    // faint wax blush on the cheek away from the bite and the word; a thin waxy coat that takes the flash
    float mot = fbm(vec2(phi * 1.6, hN * 1.8) + 4.0, 3);
    float k = 0.37 * (1.0 + 0.09 * mot + 0.04 * snoise(vec2(phi * 16.0, hN * 1.4)));
    vec3 base = mix(T_STONE, T_STONE * T_STONE / 0.807, 0.12 + 0.14 * smoothstep(0.2, -0.6, hN));
    base = mix(base, STONE_G, sat(smoothstep(0.3, 0.92, hN) * 0.75 + 0.1 * sat(0.4 - mot) + 0.08 * smoothstep(-0.4, -0.95, hN)));
    float dAz = mod(az - 2.0 + PI, 2.0 * PI) - PI;
    float cheek = exp(-dAz * dAz / 0.55) * smoothstep(-0.75, -0.1, hN) * smoothstep(0.75, 0.15, hN) * sat(0.6 + 0.8 * mot);
    base = mix(base, BLUSH, 0.32 * cheek);
    alb = base * k;
    // freckles: sparse russet dots (~4 mm cells)
    vec2 fc = vec2(phi * AR, q.y) / 4.3;
    vec2 fi = floor(fc), ff = fract(fc) - 0.5 - (hash22(fi + 21.0) - 0.5) * 0.6;
    float frk = (1.0 - smoothstep(0.015, 0.05, length(ff))) * step(0.7, hash12(fi + 9.0));
    alb = mix(alb, RUSS * k * 0.9, frk * 0.4);
    // lenticels: small russet points with a paler ring (~1.9 mm cells)
    vec2 sc = vec2(phi * AR, q.y) / 1.9;
    vec2 ci = floor(sc), cf = fract(sc) - 0.5;
    vec2 jo = (hash22(ci) - 0.5) * 0.6;
    float ang = hash12(ci + 11.0) * 6.2832;
    vec2 dl = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (cf - jo);
    dl.x *= 0.55 + 0.4 * hash12(ci + 5.0);
    float lr = 0.03 + 0.035 * hash12(ci + 7.0);
    float on = step(mix(0.7, 0.55, smoothstep(-0.2, -0.85, hN)), hash12(ci + 3.0));
    float len = (1.0 - smoothstep(lr * 0.35, lr, length(dl))) * on;
    float ring = sat((1.0 - smoothstep(lr, lr * 1.9, length(dl))) * on - len);
    alb = mix(alb, CREAM * k * 1.1, ring * 0.12);
    alb = mix(alb, RUSS * k * 0.75, len * 0.7);
    rough = 0.5 + 0.05 * snoise(P * 0.4); f0 = 0.03; wrap = 0.2; coat = 0.85;
    // (the skin's micro-relief: a fine orange-peel in the wax coat, off the cut flesh)
    float skinOnly = step(0.0, ws) * step(-0.05, body0);
    vec3 pk = vec3(snoise(P * 1.7), snoise(P * 1.7 + 17.3), snoise(P * 1.7 + 31.1)) * 0.6 + vec3(snoise(P * 4.3 + 5.0), snoise(P * 4.3 + 9.0), snoise(P * 4.3 + 2.0)) * 0.4;
    N = normalize(N + 0.05 * (pk - N * dot(pk, N)) * skinOnly);
    // the stem well: russet netting in the cavity (rougher, warmer, darker)
    float well = smoothstep(0.72, 0.9, hN) * smoothstep(12.0, 4.0, cr);
    float net = well * smoothstep(-0.15, 0.35, fbm(q.xz * 0.55 + 2.0, 4) + 0.35 * well);
    alb = mix(alb, RUSS * k * (0.75 + 0.3 * snoise(q * 1.3)), net * 0.85);
    rough = mix(rough, 0.85, net); coat *= 1.0 - net;
    // the flesh: inside the bite (below the original skin) and in the word's cavities
    float inBite = smoothstep(-0.05, -0.35, body0) * step(cut, 1.0);
    float inWord = smoothstep(0.1, -0.25, ws) * wordAmt;
    float flesh = max(inBite, inWord);
    if (flesh > 0.0) {
      float gr = 0.6 * snoise(P * 18.0) + 0.4 * snoise(P * 40.0);
      float wall = sat(0.5 - 0.5 * gr) * 0.5;
      // pale cream (stone toward lightbox), a little translucent; faint oxidation a millimetre in from the cut skin
      float brown = inBite * (1.0 - smoothstep(-0.4, -2.4, body0)) + inWord * (1.0 - smoothstep(-0.05, -0.6, ws));
      vec3 cream = CREAM * 0.5 * (1.0 - 0.18 * wall);
      vec3 flc = mix(cream, OXID * 0.5, sat(brown) * 0.4);
      // SWEET (the tender word): its bitten flesh takes the wax pink
      waxK = inWord * wordWax;
      flc = mix(flc, T_WAX * 0.78, waxK);
      alb = mix(alb, flc, flesh);
      rough = mix(rough, 0.55 + 0.15 * wall, flesh); f0 = mix(f0, 0.025, flesh); wrap = mix(wrap, 0.3, flesh); coat *= 1.0 - flesh;
      fleshK = flesh; fleshC = flc;
    }
    if (hN < -0.75) {
      float star = smoothstep(4.0, 1.0, cr + 1.1 * cos(5.0 * phi));
      alb = mix(alb, RUSS * 0.06, star);
      rough = mix(rough, 0.85, star); coat *= 1.0 - star;
    }
  } else if (m == M_STEM) {
    vec3 q = toApple(P);
    alb = mix(T_STONE * 0.09, T_FILM2, 0.3) * (0.75 + 0.35 * snoise(vec3(q.x * 3.0, q.y * 0.6, q.z * 3.0)));
    alb = mix(alb, gmix(T_SILVER, T_STONE, 0.4) * 0.3, smoothstep(42.0, 45.0, q.y));
    rough = 0.6;
  } else if (m == M_LEAF) {
    // a leaf: a cold green-grey (between silver and stone), darker than the skin, a waxy upper face, its midrib and
    // veins lighter
    vec3 l = leafL(P);
    float x = l.x - 6.0;
    float rib = 1.0 - smoothstep(0.25, 0.6, abs(l.y));
    float vu = abs(l.y) * 1.4 - x * 0.55;
    float vein = (1.0 - smoothstep(0.08, 0.3, abs(fract(vu / 5.0 + 0.5) - 0.5) * 5.0)) * smoothstep(1.0, 3.0, abs(l.y));
    alb = LEAFC * 0.2 * (0.85 + 0.25 * snoise(l.xy * 0.4));
    alb = mix(alb, LEAFC * 0.42, max(rib, vein * 0.55));
    rough = 0.32; f0 = 0.04; coat = 0.5; wrap = 0.3;
    if (dot(N, V) < 0.0) N = -N;
  } else if (m == M_CLOTH) {
    float fib = snoise(P.xz * 3.5) * 0.5 + snoise(P.xz * 0.9) * 0.5;
    float nap = snoise(P.xz * 1.6 + 3.0) * 0.5 + snoise(P.xz * 6.0) * 0.3 + snoise(P.xz * 0.25) * 0.4;
    alb = mix(vec3(1.0), T_FILM / lumY(T_FILM), 0.4) * 0.008 * (1.0 + 0.35 * fib + 0.3 * nap); rough = 1.0; f0 = 0.0; sheen = 0.16 + 0.06 * nap;
  } else if (m == M_SCALE) {
    alb = T_LIGHTBOX * 0.66; rough = 0.55; f0 = 0.04;
    vec3 s = scaleL(P);
    if (s.z > -0.3 && dot(N, SN) > 0.8) {
      float grey; vec2 stk;
      float fp = t * 2.0 * tanH / ${H.toFixed(1)} / max(abs(dot(N, V)), 0.25);
      float ink = scaleInk(s.xy, fp, grey, stk);
      if (grey >= 0.0) alb = mix(T_FILM2 * 0.8, T_HALIDE * 0.6, grey);
      if (stk.x > 0.0) { alb = mix(T_LIGHTBOX * 0.74, T_FILM * 0.8, stk.y); rough = 0.75; }
      alb = mix(alb, T_FILM * 0.6, ink);
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
  if (coat > 0.0) {
    // a crisp image of the flash head: a hard-edged small disc with no tail (no orb, nothing for the halation to catch)
    float disc = smoothstep(0.99972, 0.99986, NoH);
    col += T_LIGHTBOX * coat * disc * max(NoL, 0.0) * min(fall, 1.0) * sh * 0.75 * coatK;
  }
  col += T_SILVER * sheen * pow(1.0 - NoV, 4.0) * fall * (0.3 + 0.7 * sh) * sat(NoL + 0.6);
  // apple flesh is translucent: the cut carries some of the light that reaches the fruit around it
  // (in the narrow letter cavities the light scattered through the flesh keeps them cream, not grey)
  if (fleshK > 0.0) col += fleshK * fleshC * T_LIGHTBOX * fall * (0.16 + 0.22 * step(ws, 0.0)) * sat(dot(normalize(P - AC), L) + 0.4);
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
