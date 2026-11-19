// Plate 3 `scene` shaders (units: cm, Y up). (1) HF_FRAG bakes the bed's heightfield once: a fitted sheet with pulled
// creases, the duvet thrown back along a diagonal fold (a rolled edge, a turned-back flap), two pillows (his, cased;
// the other bare, its case already bagged), the mattress's rounded edge dropping to a dark floor. No body shape, no dent,
// no stain: the covers are simply left. (2) MARCH_FRAG ray-marches that heightfield from the camera (soft shadows from
// the folds) and intersects the evidence markers (lopsided folded placards, a big shallow front slope that carries the
// word). Two lights: a warm tungsten bedside lamp off the head corner, and the cold work light raking across the bed
// (a spot on an arm, swung from the CPU). (3) DOF_FRAG is the depth-of-field gather (depth in alpha).
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL, W, H } from '../../engine/gl';

export const NP = 12;
export const HF = { lo: [-130, -110] as const, size: [260, 220] as const, w: 1536, h: 1300 };

export const HF_FRAG = /* glsl */ `
uniform vec2 hfLo, hfSize;
float pillowH(vec2 p, vec2 c, vec2 hs, float rot, float crumple, float seamAmp, out float wgt) {
  vec2 q = rot2(rot) * (p - c);
  crumple *= 0.3;
  vec2 u = q / hs;
  float r = pow(pow(abs(u.x), 3.0) + pow(abs(u.y), 3.0), 1.0 / 3.0);
  float ins = clamp(1.0 - r, 0.0, 1.0);
  float hh = 12.5 * pow(ins, 0.74);
  float ang = atan(u.y, u.x);
  hh += crumple * (0.9 * snoise(q * 0.11 + c) + 0.7 * sin(ang * 6.0 + 2.0 * snoise(q * 0.05)) * smoothstep(0.25, 0.95, r) * ins);
  hh += seamAmp * exp(-pow((r - 0.93) / 0.03, 2.0));
  hh *= smoothstep(0.0, 0.08, ins);
  wgt = smoothstep(0.0, 0.04, ins);
  return hh;
}
void main() {
  vec2 p = hfLo + vUv * hfSize;
  // the fitted sheet: creases pulled radially toward where it was dragged, and soft undulation
  vec2 cq = p - vec2(40.0, 150.0);
  float ang = atan(cq.y, cq.x), rad = length(cq);
  float sheet = 0.2 * sin(ang * 26.0 + 2.2 * snoise(p * 0.03)) * exp(-rad / 120.0) * smoothstep(40.0, 70.0, rad)
              + 0.5 * snoise(p * vec2(0.06, 0.035)) + 0.05 * snoise(p * 0.3)
              + 0.22 * sin(ang * 7.0 + 1.0 + 3.0 * snoise(p * 0.02 + 5.0)) * exp(-length(p - vec2(-10.0, 70.0)) / 60.0);
  // the duvet: thrown back along a diagonal line, a rolled edge and a turned-back flap
  float zf = 6.0 + 0.16 * p.x;
  float dd = (zf - p.y) * 0.987;
  float side = smoothstep(-58.0, -34.0, p.x);
  float flapEdge = 41.0 + 5.0 * snoise(vec2(p.x * 0.05, 3.0));
  float body = 7.5 * smoothstep(-1.0, 11.0, dd);
  float roll = 5.5 * exp(-pow((dd - 6.5 + 1.0 * snoise(vec2(p.x * 0.02, 1.0))) / 5.5, 2.0));
  float flap = 6.0 * smoothstep(11.0, 16.0, dd) * (1.0 - smoothstep(flapEdge - 3.0, flapEdge + 3.0, dd));
  vec2 fp = vec2(p.x * 0.03, dd * 0.055);
  float cr = 1.8 * (1.0 - abs(snoise(fp + vec2(0.0, 4.0)))) - 0.9;
  float puff = 1.6 * snoise(p * 0.024 + 3.0);
  float duv = (body + roll + flap + (cr + puff) * smoothstep(8.0, 18.0, dd)) * side;
  float wDuv = smoothstep(1.5, 6.0, dd) * side;
  float h = sheet + duv;
  // the pillows: far one bare (piping seam), near one cased and rumpled, no dent
  float wa, wb;
  float hb = pillowH(p, vec2(-74.0, -38.0), vec2(22.0, 33.0), 0.05, 0.5, 0.45, wb);
  float ha = pillowH(p, vec2(-74.0, 38.0), vec2(22.0, 33.0), -0.08, 1.0, 0.0, wa);
  float base = sheet + duv * 0.0;
  float hp = max(ha * wa, hb * wb);
  h = max(h, base + hp);
  wDuv *= 1.0 - max(wa, wb);
  // the mattress's rounded edge dropping to the floor
  float sd = sdBox(p, vec2(100.0, 80.0)) ;
  h = mix(h, -50.0, smoothstep(-1.0, 7.0, sd));
  fragColor = vec4(h, wDuv, wa, wb);
}`;

export const MARCH_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
#define NP ${NP}
uniform sampler2D hfTex, heroA, heroB, smallTex;
uniform vec2 hfLo, hfSize;
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform vec3 cPos, cDir, cCol; uniform vec2 cCone;
uniform vec3 wPos, wCol;
uniform vec4 PA[NP];   // cx, cz, lift (above the cloth), active
uniform vec4 PX[NP];   // local x axis (xz), local z axis (xz): the front slope faces +z
uniform vec4 PD[NP];   // half width, depth, ridge height, kind (0 hero, 1 small, 2 tag)
uniform vec4 PE[NP];   // atlas rect: u0, vtop, du, dv (texture units)
uniform vec4 PS[NP];   // x: weight snap (0 light .. 1 heavy), y: texels per cm of the face
uniform float atlasW;
const float YMAX = 30.0, YFLOOR = -50.0;
float pBase[NP];

float hAt(vec2 p) {
  vec2 uv = (p - hfLo) / hfSize;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return YFLOOR;
  return textureLod(hfTex, uv, 0.0).r;
}
vec4 hfAt(vec2 p) { return textureLod(hfTex, (p - hfLo) / hfSize, 0.0); }

bool marchCloth(vec3 ro, vec3 rd, out float tHit) {
  float t = 0.0;
  if (ro.y > YMAX) { if (rd.y >= 0.0) return false; t = (ro.y - YMAX) / -rd.y; }
  float tp = t;
  for (int i = 0; i < 120; i++) {
    vec3 p = ro + rd * t;
    float d = p.y - hAt(p.xz);
    if (d < 0.01 + 0.0006 * t) break;
    tp = t;
    t += max(d * 0.55, 0.1);
    if (t > 1200.0) return false;
  }
  float lo = tp, hi = t;
  for (int i = 0; i < 6; i++) {
    float m = 0.5 * (lo + hi);
    vec3 p = ro + rd * m;
    if (p.y - hAt(p.xz) < 0.0) hi = m; else lo = m;
  }
  tHit = 0.5 * (lo + hi);
  return true;
}

// ---- the evidence markers: lopsided folded placards (ridge toward the back, a big shallow front slope) ----
bool cardHit(int i, vec3 ro, vec3 rd, out float tt, out int face, out vec3 lp, out vec3 nW) {
  vec4 a = PA[i];
  if (a.w < 0.5) return false;
  vec4 ax = PX[i]; vec4 d = PD[i];
  float by = pBase[i] + a.z;
  vec2 o2 = ro.xz - a.xy;
  vec3 ol = vec3(dot(o2, ax.xy), ro.y - by, dot(o2, ax.zw));
  vec3 dl = vec3(dot(rd.xz, ax.xy), rd.y, dot(rd.xz, ax.zw));
  float W = d.x, D = d.y, Hh = d.z;
  float za = -0.28 * D;
  vec3 nf = normalize(vec3(0.0, 0.78 * D, Hh));
  vec3 nb = normalize(vec3(0.0, 0.22 * D, -Hh));
  float tn = -1e9, tf = 1e9; int fn = -1;
  for (int k = 0; k < 5; k++) {
    vec3 n; float c;
    if (k == 0) { n = vec3(1, 0, 0); c = W; }
    else if (k == 1) { n = vec3(-1, 0, 0); c = W; }
    else if (k == 2) { n = vec3(0, -1, 0); c = 0.0; }
    else if (k == 3) { n = nf; c = dot(nf, vec3(0.0, Hh, za)); }
    else { n = nb; c = dot(nb, vec3(0.0, Hh, za)); }
    float dn = dot(n, dl), nu = c - dot(n, ol);
    if (abs(dn) < 1e-7) { if (nu < 0.0) return false; continue; }
    float t = nu / dn;
    if (dn < 0.0) { if (t > tn) { tn = t; fn = k; } } else tf = min(tf, t);
  }
  if (tn > tf || tn < 0.0) return false;
  tt = tn; face = fn; lp = ol + dl * tn;
  vec3 nL = fn == 0 ? vec3(1, 0, 0) : fn == 1 ? vec3(-1, 0, 0) : fn == 2 ? vec3(0, -1, 0) : fn == 3 ? nf : nb;
  nW = vec3(ax.x * nL.x + ax.z * nL.z, nL.y, ax.y * nL.x + ax.w * nL.z);
  return true;
}
bool cardsAny(vec3 ro, vec3 rd, float tmax) {
  for (int i = 0; i < NP; i++) {
    float tt; int f; vec3 lp, n;
    if (cardHit(i, ro, rd, tt, f, lp, n) && tt < tmax) return true;
  }
  return false;
}

float hfShadow(vec3 p, vec3 L, float tmax) {
  float res = 1.0, t = 0.35;
  for (int i = 0; i < 30; i++) {
    vec3 q = p + L * t;
    if (q.y > YMAX) break;
    float d = q.y - hAt(q.xz);
    res = min(res, 1.8 * max(d - 0.05 * t - 0.2, 0.0) / t);
    t += clamp(d * 0.6, 0.25, 2.5);
    if (t > min(tmax, 60.0) || res < 0.02) break;
  }
  return clamp(res, 0.0, 1.0);
}

float cardAO(vec2 p) {
  float ao = 1.0;
  for (int i = 0; i < NP; i++) {
    vec4 a = PA[i];
    if (a.w < 0.5) continue;
    vec4 ax = PX[i]; vec4 d = PD[i];
    vec2 o = p - a.xy;
    vec2 l = vec2(dot(o, ax.xy), dot(o, ax.zw));
    float sdv = sdBox(l, vec2(d.x, 0.5 * d.y));
    ao *= 1.0 - 0.55 * exp(-max(sdv, 0.0) / 1.2) * (1.0 - smoothstep(0.5, 6.0, a.z));
  }
  return ao;
}

struct Lit { vec3 col; };
vec3 lights(vec3 P, vec3 N, vec3 V, float rough, bool cloth) {
  vec3 acc = vec3(0.0);
  vec3 q = P + N * 0.4;
  // the cold work light (a spot, hard edge)
  {
    vec3 Lv = cPos - P; float dc = length(Lv); Lv /= dc;
    float cosA = dot(-Lv, cDir);
    float spot = smoothstep(cCone.y, cCone.x, cosA);
    float nl = dot(N, Lv);
    float wrap = cloth ? clamp((nl + 0.25) / 1.25, 0.0, 1.0) : max(nl, 0.0);
    if (spot > 0.001 && wrap > 0.0) {
      float sh = mix(1.0, hfShadow(q, Lv, dc), smoothstep(0.05, 0.3, nl));
      if (sh > 0.01 && cardsAny(q, Lv, dc)) sh = 0.0;
      float att = 1.0 / (1.0 + dc * dc / 60000.0);
      acc += cCol * spot * wrap * sh * att;
    }
  }
  // the warm bedside lamp (a point, off the head corner)
  {
    vec3 Lv = wPos - P; float dw = length(Lv); Lv /= dw;
    float nl = dot(N, Lv);
    float wrap = cloth ? clamp((nl + 0.35) / 1.35, 0.0, 1.0) : max(nl, 0.0);
    if (wrap > 0.0) {
      float sh = mix(1.0, hfShadow(q, Lv, dw), smoothstep(0.05, 0.3, nl));
      if (sh > 0.01 && cardsAny(q, Lv, dw)) sh = 0.0;
      float att = 1.0 / (1.0 + dw * dw / 14000.0);
      acc += wCol * wrap * sh * att;
    }
  }
  return acc;
}

vec3 shoulder(vec3 x) {
  vec3 hi = 0.8 + 0.2 * (1.0 - exp(-(max(x, 0.8) - 0.8) / 0.2));
  return mix(x, hi, step(0.8, x));
}

float rayAtlasLod(float t, float tpc) { return max(log2(max(t * 2.0 * tanH / ${H.toFixed(1)} * tpc, 1.0)), 0.0); }

vec4 shade(vec2 px) {
  vec2 ndc = (px / vec2(${W.toFixed(1)}, ${H.toFixed(1)})) * 2.0 - 1.0;
  vec3 rd = normalize(camF + camR * ndc.x * tanH * ${(W / H).toFixed(5)} + camU * ndc.y * tanH);
  vec3 ro = camPos;
  for (int i = 0; i < NP; i++) pBase[i] = max(hAt(PA[i].xy), 0.0);
  float tC = 1e9; bool hitC = marchCloth(ro, rd, tC);
  float tK = 1e9; int kI = -1, kF = 0; vec3 kLp = vec3(0.0), kN = vec3(0.0);
  for (int i = 0; i < NP; i++) {
    float tt; int f; vec3 lp, n;
    if (cardHit(i, ro, rd, tt, f, lp, n) && tt < tK) { tK = tt; kI = i; kF = f; kLp = lp; kN = n; }
  }
  vec3 col; float depth;
  if (kI >= 0 && (!hitC || tK < tC + 0.05)) {
    // ---- a marker ----
    vec3 P = ro + rd * tK; depth = tK;
    vec4 d = PD[kI], e = PE[kI], s = PS[kI];
    vec3 paper = T_LIGHTBOX * 0.84;
    float ink = 0.0;
    vec3 inkCol = T_FILM * 1.4;
    if (kF == 3) {
      float u = kLp.x / (2.0 * d.x) + 0.5;
      float sv = (kLp.z + 0.28 * d.y) / (0.78 * d.y);
      vec2 uv = vec2(e.x + u * e.z, e.y - clamp(sv, 0.0, 1.0) * e.w);
      float lod = rayAtlasLod(tK, s.y);
      if (d.w < 0.5) {
        float a = textureLod(heroA, uv, lod).r, b = textureLod(heroB, uv, lod).r;
        ink = mix(a, b, s.x);
        inkCol = mix(T_SILVER * 1.1, T_FILM * 1.4, s.x);
      } else if (d.w < 1.5) {
        ink = textureLod(smallTex, uv, lod).r;
      } else {
        ink = textureLod(heroB, uv, lod).r;
      }
    } else if (kF == 4) {
      paper *= 0.92;
    } else paper *= 0.8;
    paper *= 0.97 + 0.05 * snoise(P.xz * 1.7 + P.y);
    vec3 alb = mix(paper, inkCol, clamp(ink, 0.0, 1.0));
    vec3 V = -rd;
    vec3 L = lights(P, kN, V, 0.5, false);
    // a faint satin on the card stock
    col = alb * (L + vec3(0.012, 0.016, 0.026));
  } else if (hitC) {
    vec3 P = ro + rd * tC; depth = tC;
    vec4 hv = hfAt(P.xz);
    float e = 0.28;
    float hx = hAt(P.xz + vec2(e, 0.0)) - hAt(P.xz - vec2(e, 0.0));
    float hz = hAt(P.xz + vec2(0.0, e)) - hAt(P.xz - vec2(0.0, e));
    vec3 N = normalize(vec3(-hx / (2.0 * e), 1.0, -hz / (2.0 * e)));
    float fade = smoothstep(300.0, 90.0, tC);
    N = normalize(N + fade * vec3(0.02 * snoise(P.xz * 0.6) + 0.008 * snoise(P.xz * 1.9), 0.0, 0.02 * snoise(P.xz * 0.6 + 7.0) + 0.008 * snoise(P.xz * 1.9 + 3.0)));
    float wDuv = hv.g, wA = hv.b, wB = hv.a;
    float wS = max(1.0 - wDuv - wA - wB, 0.0);
    vec3 sheetC = T_LIGHTBOX * vec3(0.60, 0.585, 0.55);
    vec3 duvetC = T_HALIDE * vec3(0.82, 0.80, 0.78);
    vec3 cased = T_LIGHTBOX * vec3(0.62, 0.60, 0.57);
    float stripe = 0.5 + 0.5 * sin(P.x * 3.0);
    vec3 bare = mix(T_HALIDE, T_LIGHTBOX, 0.30) * 0.82 * (1.0 - 0.22 * smoothstep(0.55, 0.75, stripe) * fade);
    vec3 alb = sheetC * wS + duvetC * wDuv + cased * wA + bare * wB;
    alb *= 0.96 + 0.06 * snoise(P.xz * 0.15) + 0.025 * snoise(P.xz * 1.3);
    float floorK = smoothstep(-20.0, -45.0, P.y);
    alb = mix(alb, T_FILM2 * 0.3, floorK);
    // curvature occlusion in the creases
    float occ = 0.0;
    for (int k = 0; k < 6; k++) {
      float a = float(k) * 1.0472 + 0.3;
      vec2 o1 = vec2(cos(a), sin(a));
      occ += max(hAt(P.xz + o1 * 2.5) - P.y - 0.3, 0.0) * 0.5 + max(hAt(P.xz + o1 * 8.0) - P.y - 1.0, 0.0) * 0.25;
    }
    float ao = (1.0 - clamp(occ * 0.17, 0.0, 0.75)) * cardAO(P.xz);
    ao = mix(ao, 1.0, floorK * 0.5);
    vec3 V = -rd;
    vec3 L = lights(P, N, V, 0.8, true);
    float sheen = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.22 * (1.0 - floorK);
    col = alb * (L * ao + vec3(0.045, 0.05, 0.07) * ao) + sheen * (L * ao) * 0.6;
  } else {
    col = T_FILM * 0.8; depth = 1.0e4;
  }
  return vec4(shoulder(col), depth);
}

void main() {
  vec2 px = FRAG_PX;
  vec4 acc = vec4(0.0);
  for (int k = ssK0(); k < ssK1(); k++) acc += shade(px + rgss(k) );
  acc *= ssWeight();
  fragColor = vec4(acc.rgb, acc.a);
}`;

export const DOF_FRAG = /* glsl */ `
uniform sampler2D src; uniform float focusD, aper, maxCoc;
const int NT = 112;
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
