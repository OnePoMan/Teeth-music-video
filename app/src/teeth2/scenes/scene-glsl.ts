// Plate 3 `scene` shaders (units: cm, Y up). (1) HF_FRAG bakes the bed's heightfield once: a wrinkled fitted sheet, a
// duvet thrown back diagonally off the far side in a few large soft folds with a rolled edge, two plump pillows with a
// seam (the near one bare, the far one cased with a dent), a padded headboard, the mattress's rounded edge. No body
// shape, no stain. (2) MARCH_FRAG ray-marches that heightfield from the camera (long soft raking shadows from the
// folds) and intersects the evidence markers (A-frame tents of folded card, the face carrying the word). Two lights:
// a smooth warm falloff from a bedside lamp just off the head side (illumination only: the bedding is white cotton),
// and the cold work light, a low raking pool swung from the CPU. (3) DOF_FRAG is the depth-of-field gather.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL, W, H } from '../../engine/gl';

export const NP = 12;
export const HF = { lo: [-130, -110] as const, size: [260, 220] as const, w: 1536, h: 1300 };

export const HF_FRAG = /* glsl */ `
uniform vec2 hfLo, hfSize;
float pillowH(vec2 p, vec2 c, vec2 hs, float rot, float dent, float crum, float piping, out float wgt) {
  vec2 q = rot2(rot) * (p - c);
  float sd = sdBox(q, hs - 7.0) - 7.0;
  float ins = clamp(-sd / 12.0, 0.0, 1.0);
  float prof = sqrt(max(1.0 - (1.0 - ins) * (1.0 - ins), 0.0));
  float dome = 1.0 - clamp(dot(q / hs, q / hs), 0.0, 1.0);
  float hh = 13.0 * prof * (0.72 + 0.28 * dome);
  vec2 dq = q / (hs * vec2(0.5, 0.42));
  hh -= dent * 3.6 * exp(-dot(dq, dq));
  hh += crum * (0.5 * snoise(q * 0.085 + c) + 0.12 * snoise(q * 0.21 + 3.0)) * smoothstep(0.05, 0.5, ins);
  hh += piping * 0.6 * exp(-pow((ins - 0.13) / 0.035, 2.0));
  hh *= smoothstep(0.0, 0.03, ins);
  wgt = smoothstep(0.0, 0.06, ins);
  return hh;
}
void main() {
  vec2 p = hfLo + vUv * hfSize;
  // the fitted sheet: creases fanning out from where the covers were dragged, soft undulation, fine wrinkles
  vec2 c0 = p - vec2(-30.0, -4.0);
  float rad0 = length(c0), ang0 = atan(c0.y, c0.x);
  // (broad soft undulation only: no small dents; the wrinkles live near the mattress edge)
  float fn1 = snoise(vec2(ang0 * 2.2 + 0.7 * snoise(p * 0.012), 1.7));
  float fan = 1.0 - sqrt(fn1 * fn1 + 0.12);
  float sdE = sdBox(p, vec2(86.0, 66.0)) - 14.0;
  float edgeK = smoothstep(-30.0, -3.0, sdE);
  float sheet = 0.5 * fan * fan * smoothstep(20.0, 60.0, rad0) * exp(-rad0 / 150.0)
              + 0.55 * snoise(p * vec2(0.032, 0.022)) + 0.4 * snoise(p * vec2(0.02, 0.016) + 9.0)
              + edgeK * 0.45 * snoise(vec2(atan(p.y, p.x) * 8.0, length(p) * 0.05) + 31.0);
  // a few long soft creases pulled across the sheet, tapering out
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 q0 = rot2(0.35 + 0.22 * fk) * (p - vec2(-10.0 + 38.0 * fk, 24.0 + 9.0 * fk));
    sheet += (0.5 - 0.1 * fk) * exp(-pow(q0.y / 4.5, 2.0)) * smoothstep(-70.0, -20.0, q0.x) * (1.0 - smoothstep(10.0, 70.0, q0.x));
  }
  // the duvet: thrown back off the far side along a diagonal line; a rolled edge, then a few large soft folds
  float ze = -20.0 + 0.22 * (p.x + 60.0);
  float dd = (ze - p.y) * 0.976;
  float s = p.x;
  float side = smoothstep(-66.0, -38.0, p.x);
  float lip = 9.5 * sin(clamp(dd / 10.0, 0.0, 1.0) * 1.5708);
  float wob = 4.0 * snoise(vec2(s * 0.03, 2.0));
  float f1 = 6.0 * exp(-pow((dd - 24.0 - wob) / 9.0, 2.0));
  float f2 = 9.0 * exp(-pow((dd - 50.0 - 1.5 * wob + 6.0 * snoise(vec2(s * 0.02, 7.0))) / 12.0, 2.0));
  float f3 = 7.5 * exp(-pow((dd - 74.0 + 5.0 * snoise(vec2(s * 0.025, 11.0))) / 10.0, 2.0));
  vec2 cq = rot2(0.7) * (p - vec2(34.0, -40.0));
  float f4 = 5.5 * exp(-pow(cq.y / 8.0, 2.0)) * smoothstep(-48.0, -20.0, cq.x) * (1.0 - smoothstep(18.0, 52.0, cq.x));
  float puff = 2.0 * snoise(vec2(s * 0.014, dd * 0.04) + 3.0);
  float cn = snoise(vec2(s * 0.045, dd * 0.08 + 5.0));
  float crease = 0.3 * (1.0 - sqrt(cn * cn + 0.3));
  float body = lip + (f1 + f2 + f3 + f4 + puff + crease) * smoothstep(6.0, 16.0, dd);
  float duv = step(0.0, dd) * side * body;
  float wDuv = smoothstep(0.0, 4.0, dd) * side;
  float h = sheet + duv;
  // the pillows: the near one bare (its case already bagged), the far one cased, with a soft dent
  float wa, wb;
  float hb = pillowH(p, vec2(-73.0, 40.0), vec2(21.0, 33.0), 0.05, 0.0, 0.3, 1.0, wb);
  float ha = pillowH(p, vec2(-72.0, -40.0), vec2(21.0, 33.0), -0.07, 1.0, 0.9, 0.0, wa);
  float hp = max(ha * wa, hb * wb);
  h = max(h, sheet + hp);
  wDuv *= 1.0 - max(wa, wb);
  // the mattress: a rounded rectangle, its edge rolling over and dropping to the floor
  float sdm = sdBox(p, vec2(86.0, 66.0)) - 14.0;
  float e = clamp(-sdm / 7.0, 0.0, 1.0);
  float drop = 7.0 * (1.0 - sqrt(max(1.0 - (1.0 - e) * (1.0 - e), 0.0)));
  h = sdm <= 0.0 ? h - drop : mix(h - 7.0, -50.0, smoothstep(0.0, 2.5, sdm));
  // the padded headboard
  float sdh = sdBox(p - vec2(-104.0, 0.0), vec2(10.0, 90.0));
  h = max(h, 36.0 * smoothstep(0.0, -2.5, sdh));
  fragColor = vec4(h, wDuv, wa, wb);
}`;

export const MARCH_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
#define NP ${NP}
uniform sampler2D hfTex, heroA, heroB, smallTex;
uniform vec2 hfLo, hfSize;
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform vec3 cPos, cAim, cCol; uniform float cRad;
uniform vec3 wPos, wCol;
uniform vec4 PA[NP];   // cx, cz, lift (above the cloth), active
uniform vec4 PX[NP];   // local x axis (xz), local z axis (xz): the front face leans toward +z
uniform vec4 PD[NP];   // half width, base depth, apex height, kind (0 hero, 1 small, 2 tag)
uniform vec4 PE[NP];   // atlas rect: u0, vtop, du, dv (texture units)
uniform vec4 PS[NP];   // x: weight snap (0 light .. 1 heavy), y: texels per cm of the face
uniform float atlasW;
const float YMAX = 40.0, YFLOOR = -50.0;
float pBase[NP];
float gT = 0.0;

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
  for (int i = 0; i < 130; i++) {
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

// ---- the evidence markers: A-frame tents of folded card (faces lean at ~58 degrees), the front face carries the word ----
bool cardHit(int i, vec3 ro, vec3 rd, out float tt, out int face, out vec3 lp, out vec3 nW) {
  vec4 a = PA[i];
  if (a.w < 0.5) return false;
  vec4 ax = PX[i]; vec4 d = PD[i];
  float by = pBase[i] + a.z;
  vec2 o2 = ro.xz - a.xy;
  vec3 ol = vec3(dot(o2, ax.xy), ro.y - by, dot(o2, ax.zw));
  vec3 dl = vec3(dot(rd.xz, ax.xy), rd.y, dot(rd.xz, ax.zw));
  float W = d.x, Hh = d.z, b = 0.5 * d.y;
  bool isFlat = d.w > 1.5;
  vec3 nf = isFlat ? vec3(0.0, 1.0, 0.0) : normalize(vec3(0.0, b, Hh));
  vec3 nb = isFlat ? vec3(0.0, 1.0, 0.0) : normalize(vec3(0.0, b, -Hh));
  float cf = nf.y * Hh;
  if (!isFlat) {
    // a true A-frame of folded card: two thin panels meeting at a ridge, the ends open (the shaded inside of the back panel shows)
    float bt = 1e9; int bf = -1; vec3 bn = vec3(0.0);
    for (int k = 0; k < 2; k++) {
      vec3 n = k == 0 ? nf : nb;
      float dn = dot(n, dl);
      if (abs(dn) < 1e-7) continue;
      float t = (cf - dot(n, ol)) / dn;
      if (t < 0.0 || t >= bt) continue;
      vec3 p = ol + dl * t;
      if (abs(p.x) > W) continue;
      if (k == 0 ? (p.z < 0.0 || p.z > b) : (p.z > 0.0 || p.z < -b)) continue;
      bt = t; bf = (k == 1 && dn < 0.0) ? 4 : (dn < 0.0 ? 3 : 5); bn = dn < 0.0 ? n : -n;
    }
    if (bf < 0) return false;
    tt = bt; face = bf; lp = ol + dl * bt;
    nW = vec3(ax.x * bn.x + ax.z * bn.z, bn.y, ax.y * bn.x + ax.w * bn.z);
    return true;
  }
  float tn = -1e9, tf = 1e9; int fn = -1;
  for (int k = 0; k < 7; k++) {
    vec3 n; float c;
    if (k == 0) { n = vec3(1, 0, 0); c = W; }
    else if (k == 1) { n = vec3(-1, 0, 0); c = W; }
    else if (k == 2) { n = vec3(0, -1, 0); c = 0.0; }
    else if (k == 3) { n = nf; c = cf; }
    else if (k == 4) { n = nb; c = cf; }
    else if (k == 5) { n = vec3(0, 0, 1); c = isFlat ? b : 1e4; }
    else { n = vec3(0, 0, -1); c = isFlat ? b : 1e4; }
    float dn = dot(n, dl), nu = c - dot(n, ol);
    if (abs(dn) < 1e-7) { if (nu < 0.0) return false; continue; }
    float t = nu / dn;
    if (dn < 0.0) { if (t > tn) { tn = t; fn = k; } } else tf = min(tf, t);
  }
  if (tn > tf || tn < 0.0) return false;
  tt = tn; face = fn; lp = ol + dl * tn;
  vec3 nL = fn == 0 ? vec3(1, 0, 0) : fn == 1 ? vec3(-1, 0, 0) : fn == 2 ? vec3(0, -1, 0) : fn == 3 ? nf : fn == 4 ? nb : fn == 5 ? vec3(0, 0, 1) : vec3(0, 0, -1);
  nW = vec3(ax.x * nL.x + ax.z * nL.z, nL.y, ax.y * nL.x + ax.w * nL.z);
  return true;
}
// signed distance (a lower bound) to marker i's solid, for soft shadows
float cardSd(int i, vec3 p) {
  vec4 a = PA[i], ax = PX[i], d = PD[i];
  vec2 o2 = p.xz - a.xy;
  vec3 l = vec3(dot(o2, ax.xy), p.y - (pBase[i] + a.z), dot(o2, ax.zw));
  float b = 0.5 * d.y, Hh = d.z;
  float dp = d.w > 1.5 ? max(l.y - Hh, abs(l.z) - b) : (b * (l.y - Hh) + Hh * abs(l.z)) * inversesqrt(b * b + Hh * Hh);
  return max(max(abs(l.x) - d.x, -l.y), dp);
}
// soft cool shadow of the markers: marched against the signed distance, penumbra widening with distance
float cardShadow(vec3 q, vec3 L, float dl, int skip) {
  float res = 1.0;
  for (int i = 0; i < NP; i++) {
    if (i == skip) continue;
    vec4 a = PA[i];
    if (a.w < 0.5) continue;
    vec4 d = PD[i];
    float b = 0.5 * d.y, Hh = d.z;
    vec3 c = vec3(a.x, pBase[i] + a.z + 0.5 * Hh, a.y);
    float Rb = length(vec3(d.x, 0.5 * Hh, b)) + 0.4;
    vec3 oc = c - q;
    float t0 = dot(oc, L);
    if (t0 < -Rb || t0 > dl + Rb) continue;
    float dist2 = dot(oc, oc) - t0 * t0;
    float m = Rb + 0.16 * max(t0, 0.0) + 1.5;
    if (dist2 > m * m) continue;
    float t = max(t0 - m, 0.3);
    float tEnd = min(t0 + m, dl);
    for (int k = 0; k < 14; k++) {
      float sd = cardSd(i, q + L * t);
      res = min(res, 3.2 * sd / t);
      t += clamp(sd, 0.3, 5.0);
      if (t > tEnd || res < 0.01) break;
    }
  }
  res = clamp(res, 0.0, 1.0);
  res = res * res * (3.0 - 2.0 * res);
  return mix(0.16, 1.0, res);
}

float hfShadow(vec3 p, vec3 L, float tmax) {
  float res = 1.0, t = 0.35;
  for (int i = 0; i < 40; i++) {
    vec3 q = p + L * t;
    if (q.y > YMAX) break;
    float d = q.y - hAt(q.xz);
    res = min(res, 1.3 * max(d - 0.08 * t - 0.4, 0.0) / t);
    t += clamp(d * 0.6, 0.3, 3.5);
    if (t > min(tmax, 100.0) || res < 0.02) break;
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
    ao *= 1.0 - 0.5 * exp(-max(sdv, 0.0) / 1.4) * (1.0 - smoothstep(0.5, 6.0, a.z));
  }
  return ao;
}

vec3 lights(vec3 P, vec3 N, bool cloth, int skip) {
  vec3 acc = vec3(0.0);
  vec3 q = P + N * 0.4;
  float warmMod = 1.0;
  // the cold work light: a low raking pool (a soft ellipse on the bed), real long shadows from the folds and the markers
  {
    vec3 Lv = cPos - P; float dc = length(Lv); Lv /= dc;
    vec2 hd = normalize(cAim.xz - cPos.xz);
    vec2 o = P.xz - cAim.xz;
    float e = length(vec2(dot(o, hd) / 1.5, dot(o, vec2(-hd.y, hd.x)))) / cRad;
    float spot = pow(1.0 - smoothstep(0.05, 0.85, e), 1.5);
    float spill = 0.025 * (1.0 - smoothstep(0.7, 2.8, e));
    float nl = dot(N, Lv);
    float wrap = cloth ? clamp((nl + 0.35) / 1.35, 0.0, 1.0) : max(nl, 0.0);
    float amt = spot + spill;
    float shadowK = 1.0;
    if (amt > 0.001 && wrap > 0.0) {
      float sh = mix(1.0, mix(hfShadow(q, Lv, dc), 1.0, 0.5 * smoothstep(110.0, 230.0, gT)), smoothstep(0.02, 0.25, nl));
      if (sh > 0.01) sh *= cardShadow(q, normalize(vec3(Lv.x * 0.6, Lv.y, Lv.z * 0.6)), dc, skip);
      shadowK = sh;
      float att = 1.0 / (1.0 + dc * dc / 60000.0);
      acc += cCol * amt * wrap * sh * att;
    }
    // where the cold light would be but is blocked (a shadow, a face turned away), the warm lamp is shadowed too: shadows stay film-cool
    float lit = smoothstep(0.35, 0.8, amt);
    float avail = (amt > 0.001 && wrap > 0.0) ? shadowK : 0.0;
    warmMod = mix(1.0, mix(0.04, 1.0, avail), lit);
  }
  // the warm bedside lamp: only a smooth falloff of light across the bed (no shadows, no texture of its own)
  {
    vec3 Lw = wPos - P; float dw = length(Lw); Lw /= dw;
    float wr = cloth ? clamp(dot(N, Lw) * 0.5 + 0.5, 0.0, 1.0) : max(dot(N, Lw), 0.0);
    float dwx = length(vec2(P.x - wPos.x, 0.7 * (P.z - wPos.z)));
    float fall = exp(-dwx / 34.0) * (1.0 - smoothstep(55.0, 140.0, dwx));
    vec3 wc = mix(vec3(0.75, 0.62, 0.5), wCol, smoothstep(0.0, 0.7, fall * 2.0));   // never a dim brown: where the lamp is weak it is simply weak
    acc += wc * wr * fall * warmMod;
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
  for (int i = 0; i < NP; i++) {
    pBase[i] = 0.0;
    if (PA[i].w < 0.5) continue;
    vec4 ax = PX[i]; vec4 d = PD[i];
    float Wd = 0.85 * d.x, Bd = 0.42 * d.y, hm = hAt(PA[i].xy);
    hm = max(hm, hAt(PA[i].xy + ax.xy * Wd)); hm = max(hm, hAt(PA[i].xy - ax.xy * Wd));
    hm = max(hm, hAt(PA[i].xy + ax.zw * Bd)); hm = max(hm, hAt(PA[i].xy - ax.zw * Bd));
    pBase[i] = max(hm, 0.0) - 0.1;
  }
  float tC = 1e9; bool hitC = marchCloth(ro, rd, tC);
  float tK = 1e9; int kI = -1, kF = 0; vec3 kLp = vec3(0.0), kN = vec3(0.0);
  for (int i = 0; i < NP; i++) {
    float tt; int f; vec3 lp, n;
    if (cardHit(i, ro, rd, tt, f, lp, n) && tt < tK) { tK = tt; kI = i; kF = f; kLp = lp; kN = n; }
  }
  vec3 col; float depth;
  if (kI >= 0 && (!hitC || tK < tC + 0.05)) {
    // ---- a marker ----
    vec3 P = ro + rd * tK; depth = tK; gT = tK;
    vec4 d = PD[kI], e = PE[kI], s = PS[kI];
    float b = 0.5 * d.y;
    vec3 paper = T_LIGHTBOX * 0.95;
    float ink = 0.0;
    vec3 inkCol = T_FILM * 1.4;
    if (kF == 3 || (d.w > 1.5 && kF == 4)) {
      float u = kLp.x / (2.0 * d.x) + 0.5;
      float sv = d.w > 1.5 ? (kLp.z + b) / (2.0 * b) : kLp.z / b;
      vec2 uv = vec2(e.x + u * e.z, e.y - clamp(sv, 0.0, 1.0) * e.w);
      float lod = rayAtlasLod(tK, s.y);
      if (d.w < 0.5) {
        float a = textureLod(heroA, uv, lod).r, bb = textureLod(heroB, uv, lod).r;
        ink = mix(a, bb, s.x);
        inkCol = mix(T_SILVER * 1.1, T_FILM * 1.4, s.x);
      } else if (d.w < 1.5) {
        ink = textureLod(smallTex, uv, lod).r;
      } else {
        ink = textureLod(heroB, uv, lod).r;
      }
      float rz = abs(kLp.z);
      paper *= (1.0 - 0.12 * exp(-rz / 0.9) * step(d.w, 1.5)) * (1.0 + 0.1 * exp(-pow((rz - 0.9) / 0.35, 2.0)) * step(d.w, 1.5));   // the fold line: a soft crease with a bright rib beside it
      paper *= 1.0 - 0.1 * clamp(sv, 0.0, 1.0) * step(d.w, 1.5);   // the base of the face a touch deeper
    } else if (kF == 4) {
      paper *= 0.9 * (1.0 + 0.45 * exp(-abs(kLp.z) / 0.45));   // the back slope: the ridge catching light
    } else if (kF == 5) {
      paper *= 0.62 * (0.55 + 0.45 * smoothstep(0.0, 2.5, abs(kLp.z)));   // the inside of the tent, in shade, deeper at the ridge
    } else paper *= 0.78;
    paper *= 0.975 + 0.035 * snoise(P.xz * 1.7 + P.y);
    vec3 alb = mix(paper, inkCol, clamp(ink, 0.0, 1.0));
    vec3 L = lights(P, kN, false, kI);
    col = alb * (L + vec3(0.05, 0.058, 0.075) * (kF == 3 ? 0.5 : 1.0));
  } else if (hitC) {
    vec3 P = ro + rd * tC; depth = tC; gT = tC;
    vec4 hv = hfAt(P.xz);
    float e = 0.28;
    float hx = hAt(P.xz + vec2(e, 0.0)) - hAt(P.xz - vec2(e, 0.0));
    float hz = hAt(P.xz + vec2(0.0, e)) - hAt(P.xz - vec2(0.0, e));
    vec3 N = normalize(vec3(-hx / (2.0 * e), 1.0, -hz / (2.0 * e)));
    float fade = smoothstep(300.0, 90.0, tC);
    N = normalize(N + fade * vec3(0.012 * snoise(P.xz * 0.9) + 0.005 * snoise(P.xz * 2.7), 0.0, 0.012 * snoise(P.xz * 0.9 + 7.0) + 0.005 * snoise(P.xz * 2.7 + 3.0)));
    float wDuv = hv.g, wA = hv.b, wB = hv.a;
    float wS = max(1.0 - wDuv - wA - wB, 0.0);
    // white cotton throughout: only slightly different weights of white
    vec3 sheetC = T_LIGHTBOX * 0.80;
    vec3 duvetC = T_LIGHTBOX * 0.90;
    vec3 cased = T_LIGHTBOX * 0.88;
    vec3 bare = mix(T_HALIDE, T_LIGHTBOX, 0.55) * 0.82;
    vec3 alb = sheetC * wS + duvetC * wDuv + cased * wA + bare * wB;
    alb *= 0.985 + 0.03 * snoise(P.xz * 1.3);
    // the padded headboard: dark film-grey, tufted
    float hbK = smoothstep(-92.0, -95.5, P.x) * smoothstep(4.0, 12.0, P.y);
    vec3 hbC = mix(T_FILM2, T_SILVER, 0.3) * (0.85 + 0.15 * cos(P.z * 0.28));
    float floorK = smoothstep(-20.0, -45.0, P.y);
    alb = mix(alb, hbC, hbK);
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
    vec3 L = lights(P, N, true, -1);
    float sheen = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.07 * (1.0 - floorK);
    vec3 amb = vec3(0.012, 0.016, 0.03) * (0.7 + 0.3 * N.y);
    col = alb * (L * ao + amb * ao) + sheen * (L * ao) * 0.5;
    col *= 0.35 + 0.65 * clamp(dot(col, vec3(0.33)) * 2.2, 0.0, 1.0);   // a firmer toe: shadows fall away to film
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
