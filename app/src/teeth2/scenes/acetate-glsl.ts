// Plate 12 `acetate` shader: a dark desk under one cold angled lamp (a hard cone, falling off to film black), a glossy
// print of the golden apple's bite with the lyric printed on it (zone canvases), a sheet of clear acetate taped over it
// carrying the pen's tracing (static ink canvases revealed by the pen's progress), the gloved hand and pen (GLSL_HAND,
// the one shared glove). Table mm, y DOWN; world = (x, -y), z up; the print at z 0.4, the acetate at z 1.3.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL } from '../../engine/gl';
import { GLSL_HAND } from './match-glsl';
import { PS, ROT, PRINT, ACETATE, TRC, BM, ZONE } from './acetate-ink';

const f = (x: number) => x.toFixed(4);

export const MAIN_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
${GLSL_HAND}
uniform mat4 invVP; uniform vec3 camPos; uniform vec2 res;
uniform sampler2D lyrU, lyrL, inkCov, inkDat, bmS, bmG;
uniform float prog[12];
uniform vec3 keyPos; uniform vec2 aim; uniform vec2 cone; uniform float lampK;
uniform vec3 hTip, hE1, hE2, hE3; uniform float handOn;
uniform vec2 zon;     // the zone canvases' content (upper, lower)

const float PS = ${f(PS)};
const float RC = ${f(Math.cos(ROT))}, RS = ${f(Math.sin(ROT))};
const float Z_PAPER = 0.4, Z_AC = 1.3;
vec2 TB(vec3 p) { return vec2(p.x, -p.y); }
float sdBox2(vec2 p, vec2 c, vec2 h, float r) { vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float printSd(vec2 p) { return sdBox2(p, vec2(${f((PRINT.x0 + PRINT.x1) / 2)}, ${f((PRINT.y0 + PRINT.y1) / 2)}), vec2(${f((PRINT.x1 - PRINT.x0) / 2)}, ${f((PRINT.y1 - PRINT.y0) / 2)}), 1.2); }
float acSd(vec2 p) { return sdBox2(p, vec2(${f((ACETATE.x0 + ACETATE.x1) / 2)}, ${f((ACETATE.y0 + ACETATE.y1) / 2)}), vec2(${f((ACETATE.x1 - ACETATE.x0) / 2)}, ${f((ACETATE.y1 - ACETATE.y0) / 2)}), 2.0); }

// the lamp: a hard cold spot (1.0 x lampK on its aim point), the pool falling off to film black; white never blooms
float lamp(vec3 p, vec3 n) {
  vec3 AIM = vec3(aim.x, -aim.y, 0.0);
  vec3 d = keyPos - p; float r2 = dot(d, d); vec3 l = d * inversesqrt(r2);
  vec3 axis = normalize(AIM - keyPos);
  float spot = smoothstep(cone.y, cone.x, dot(-l, axis));
  vec3 d0 = keyPos - AIM;
  return min(lampK * max(dot(n, l), 0.0) / r2 * dot(d0, d0) / max(normalize(d0).z, 1e-3) * spot, 1.06);
}

// ---- the hand (as plate 13: ray-marched in its own frame)
vec3 toH(vec3 p) { vec3 d = p - hTip; return vec3(dot(d, hE1), dot(d, hE2), dot(d, hE3)); }
vec3 dirH(vec3 v) { return vec3(dot(v, hE1), dot(v, hE2), dot(v, hE3)); }
vec3 fromH(vec3 v) { return hE1 * v.x + hE2 * v.y + hE3 * v.z; }
const vec3 HLO = vec3(-4.0, -64.0, -36.0), HHI = vec3(330.0, 50.0, 48.0);
vec2 boxHit(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  vec3 iv = 1.0 / rd; vec3 t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
float marchHand(vec3 ro, vec3 rd, float tMax, out int m) {
  m = -1;
  if (handOn < 0.5) return 1e9;
  vec3 o = toH(ro), d = dirH(rd);
  vec2 bh = boxHit(o, d, HLO, HHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1e9;
  float t = max(bh.x, 0.0), te = min(bh.y, tMax);
  for (int i = 0; i < 180; i++) {
    if (t > te) break;
    int mm;
    float h = sdHand(o + d * t, mm);
    if (h < 0.025) { m = mm; return t; }
    t += h * 0.8;
  }
  return 1e9;
}
float handShadow(vec3 p) {
  if (handOn < 0.5) return 1.0;
  vec3 l = normalize(keyPos - p);
  vec3 o = toH(p), d = dirH(l);
  vec2 bh = boxHit(o, d, HLO, HHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1.0;
  float t = max(bh.x, 0.2), res = 1.0;
  for (int i = 0; i < 64; i++) {
    if (t > bh.y) break;
    float h = sdHandD(o + d * t);
    res = min(res, 8.0 * h / t);
    if (res < 0.01) break;
    t += clamp(h, 0.4, 6.0);
  }
  res = clamp(res, 0.0, 1.0);
  return mix(0.16, 1.0, res * res * (3.0 - 2.0 * res));
}
vec3 nrmHand(vec3 q) {
  const vec2 k = vec2(1.0, -1.0); const float e = 0.06;
  return normalize(k.xyy * sdHandD(q + k.xyy * e) + k.yyx * sdHandD(q + k.yyx * e) + k.yxy * sdHandD(q + k.yxy * e) + k.xxx * sdHandD(q + k.xxx * e));
}
float aoHand(vec3 q, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) { float h = 1.1 * float(i * i); o += w * (h - sdHandD(q + n * h)); w *= 0.55; }
  return clamp(1.0 - 0.09 * o, 0.0, 1.0);
}
float ggx(vec3 N, vec3 H, float rough) {
  float a2 = rough * rough * rough * rough, nh = max(dot(N, H), 0.0);
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * dd * dd);
}
vec3 shadeHand(vec3 P, vec3 rd, int m) {
  vec3 q = toH(P);
  vec3 nl = nrmHand(q);
  if (m == 0) {
    const float e = 0.25;
    vec3 g = vec3(wrinkle(q + vec3(e, 0.0, 0.0)) - wrinkle(q - vec3(e, 0.0, 0.0)), wrinkle(q + vec3(0.0, e, 0.0)) - wrinkle(q - vec3(0.0, e, 0.0)), wrinkle(q + vec3(0.0, 0.0, e)) - wrinkle(q - vec3(0.0, 0.0, e))) / (2.0 * e);
    g -= nl * dot(g, nl);
    nl = normalize(nl - g * 0.9);
  }
  vec3 N = fromH(nl);
  vec3 L = normalize(keyPos - P), V = -rd, Hh = normalize(L + V);
  float o = aoHand(q, nl);
  float E = lamp(P, N);
  float nv = max(dot(N, V), 0.0);
  float fres = 0.045 + 0.955 * pow(1.0 - nv, 5.0);
  vec3 R = reflect(rd, N);
  float env = mix(0.006, 0.22, 1.0 - smoothstep(-0.6, 0.05, R.z)) * o;
  vec3 col;
  if (m == 0) {
    // matte film2 nitrile: a dark diffuse body the lamp lights on its top planes, a broad soft sheen, a little bounce
    // from the lit print into the planes that face down onto it
    vec3 alb = T_SILVER * 0.09;
    float spec = ggx(N, Hh, 0.62) * (0.04 + 0.2 * pow(1.0 - nv, 5.0)) * 0.6;
    float bounce = max(-N.z, 0.0) * 0.45 * o + 0.05 * (0.5 + 0.5 * N.x);
    col = alb * (E * 1.25 + bounce + 0.015) + T_LIGHTBOX * spec * E;
  } else if (m == 2) {
    col = T_HALIDE * 0.8 * (ggx(N, Hh, 0.2) * 0.5 * E + env * 1.4 + 0.06 * E);
  } else if (m == 3) {
    vec3 alb = T_SILVER * (0.9 + 0.1 * sin(q.x * 9.0 + snoise(q * 2.0)));
    col = alb * (ggx(N, Hh, 0.32) * 0.48 * E + 0.45 * E + env * 1.2 + 0.02);
  } else if (m == 1) {
    col = T_FILM * (E * 0.8 + 0.02) + T_LIGHTBOX * (ggx(N, Hh, 0.45) * fres * 0.25 * E + fres * env * 0.5);
  } else {
    float weave = 0.9 + 0.1 * snoise(q * vec3(0.5, 3.0, 3.0));
    col = T_FILM2 * 1.6 * weave * (E * max(dot(N, L), 0.0) * 1.2 + 0.03);
  }
  return col * mix(1.0, o, 0.5);
}

// ---- texture lookups with the screen derivatives of the table point (taken once per sample, in uniform control flow)
vec2 gDX, gDY;
vec4 texG(sampler2D tex, vec2 uv, vec2 size) { return textureGrad(tex, uv, gDX / size, gDY / size); }

// ---- the photograph: a golden apple's flank (face-on, enlarged), the bite scooped out of it
vec3 gmix(vec3 a, vec3 b, float t) { return pow(mix(pow(a, vec3(0.4545)), pow(b, vec3(0.4545)), t), vec3(2.2)); }
#define RUSS (T_STONE * T_STONE / 0.807 * 0.62)
#define BLUSH gmix(T_STONE, gmix(T_WAX, T_HALIDE, 0.45), 0.6)
#define CREAM gmix(T_STONE, T_LIGHTBOX, 0.64)
#define OXID gmix(RUSS, T_SILVER, 0.3)
const vec2 BMO = vec2(${f(BM.x0)}, ${f(BM.y0)}), BMS = vec2(${f(BM.x1 - BM.x0)}, ${f(BM.y1 - BM.y0)});
float bowlH(vec2 uv) { return 6.0 * textureLod(bmS, uv, 5.0).r + 2.6 * textureLod(bmG, uv, 3.0).r; }
vec3 photo(vec2 tp) {
  vec2 P = vec2(tp.x, -tp.y) / PS;   // bite mm, Y up
  vec3 L = normalize(vec3(-0.42, 0.62, 0.66));
  vec3 vel = T_FILM * (0.7 + 0.3 * snoise(P * 0.8));
  vec2 e = P / vec2(52.0, 48.0);
  float ang = atan(e.y, e.x);
  float r = length(e) * (1.0 + 0.012 * snoise(vec2(ang * 3.0, 1.7)) + 0.07 * exp(-pow(P.x / 7.0, 2.0)) * smoothstep(0.5, 1.0, e.y));
  float apple = 1.0 - smoothstep(0.97, 1.0, r);
  vec3 n = normalize(vec3(e * 0.95, sqrt(max(1.0 - 0.9 * dot(e, e), 0.04))));
  // the skin: stone gold pulled toward silver, russet toward the stem (top), a faint wax blush, lenticels
  vec3 skin = gmix(T_STONE, T_SILVER, 0.16) * 0.8;
  float streak = snoise(vec2(ang * 7.0, r * 2.2));
  skin = mix(skin, RUSS * 0.6, 0.35 * smoothstep(0.1, 0.95, e.y) + 0.06 * smoothstep(0.2, 0.8, streak));
  skin = mix(skin, BLUSH * 0.55, 0.22 * smoothstep(0.0, 0.8, e.x) * smoothstep(0.8, 0.0, abs(e.y)));
  skin = mix(skin, CREAM * 0.7, 0.45 * step(0.86, snoise(P * 2.3 + 4.0)));
  skin *= 0.93 + 0.07 * snoise(P * 9.0);
  skin *= (0.24 + 0.95 * max(dot(n, L), 0.0)) * (1.0 - 0.55 * pow(r, 4.0));
  skin = mix(skin, RUSS * 0.25, 0.9 * smoothstep(9.0, 2.0, length(P - vec2(0.0, 43.0))));
  vec3 col = mix(vel, skin, apple);
  // the bite
  vec2 Pb = vec2(RC * P.x - RS * P.y, RS * P.x + RC * P.y);   // the bite's own frame (the bite is photographed turned)
  vec2 uv0 = (Pb - BMO) / BMS;
  float inB = step(0.0, uv0.x) * step(uv0.x, 1.0) * step(0.0, uv0.y) * step(uv0.y, 1.0);
  if (inB > 0.5) {
    // the scoop's torn edge is warped (low frequency); his tooth bars are not (the pen follows them exactly)
    vec2 uv = uv0 + (vec2(snoise(P * 0.35), snoise(P * 0.35 + 5.0)) * 0.4 + vec2(snoise(P * 0.9 + 2.0), snoise(P * 0.9 + 8.0)) * 0.07) / BMS;
    float s0 = texG(bmS, uv, BMS * PS).r;
    float gS = texG(bmG, uv0, BMS * PS).r;
    float flesh = max(smoothstep(0.38, 0.62, s0), smoothstep(0.38, 0.62, gS));
    vec2 dx = vec2(0.28 / BMS.x, 0.0), dy = vec2(0.0, 0.28 / BMS.y);
    vec2 gr = vec2(bowlH(uv + dx) - bowlH(uv - dx), bowlH(uv + dy) - bowlH(uv - dy)) / 0.56;
    vec2 dxw = vec2(2.6 / BMS.x, 0.0), dyw = vec2(0.0, 2.6 / BMS.y);
    vec2 gw = vec2(textureLod(bmS, uv + dxw, 7.0).r - textureLod(bmS, uv - dxw, 7.0).r, textureLod(bmS, uv + dyw, 7.0).r - textureLod(bmS, uv - dyw, 7.0).r) * 4.0;
    gr += gw;
    vec3 n2 = normalize(vec3(RC * gr.x + RS * gr.y, -RS * gr.x + RC * gr.y, 1.0));
    float hb = textureLod(bmS, uv, 5.5).r;
    float hw = textureLod(bmS, uv, 7.2).r;   // the bowl's depth: dark under the walls, open in the middle
    vec3 fl = CREAM * 1.6 * (0.9 + 0.1 * snoise(P * vec2(7.0, 1.3)));
    fl = mix(fl, OXID, 0.1 * hb);
    // the incisors' drag: fine striations dropping from the bars across the scoop
    float stri = pow(0.5 + 0.5 * sin(Pb.x * 10.0 + 2.5 * snoise(vec2(Pb.x * 0.5, Pb.y * 0.3))), 5.0);
    fl *= 1.0 - 0.2 * stri * smoothstep(0.02, 0.3, textureLod(bmG, uv0, 5.0).r);
    float dif = max(dot(n2, L), 0.0);
    fl *= (0.4 + 0.85 * dif) * (0.5 + 0.5 * smoothstep(0.3, 0.95, hw));
    // the skin's cut lip, a thin bright edge
    float lip = smoothstep(0.28, 0.5, s0) * (1.0 - smoothstep(0.5, 0.74, s0));
    fl = mix(fl, gmix(T_STONE, T_LIGHTBOX, 0.35) * 0.85, lip * 0.5);
    // his teeth: each bar a clean groove cut into the rim, dark in the floor, a lit far edge
    float gb = textureLod(bmG, uv0, 1.0).r;
    vec2 gg = vec2(textureLod(bmG, uv0 + dx, 1.5).r - textureLod(bmG, uv0 - dx, 1.5).r, textureLod(bmG, uv0 + dy, 1.5).r - textureLod(bmG, uv0 - dy, 1.5).r);
    vec2 ggp = vec2(RC * gg.x + RS * gg.y, -RS * gg.x + RC * gg.y);
    vec3 gcol = OXID * 0.7 * (0.35 + 0.6 * max(dot(normalize(vec3(ggp * 2.0, 1.0)), L), 0.0)) * (0.85 + 0.15 * snoise(P * 5.0));
    fl = mix(fl, gcol, 0.82 * smoothstep(0.35, 0.8, gb));
    col = mix(col, fl, flesh * apple);
  }
  return col;
}
const vec2 ZX = vec2(${f(ZONE.x0)}, ${f(ZONE.w)});
// printed ink: premultiplied canvas texels
vec4 zoneInk(sampler2D tex, vec2 tp, float y0) {
  vec2 q = (tp - vec2(ZX.x, y0)) / vec2(ZX.y, ${f(ZONE.h)});
  float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  vec4 c = texG(tex, vec2(q.x, 1.0 - q.y), vec2(ZX.y, ${f(ZONE.h)}));
  return vec4(toLinear(c.rgb / max(c.a, 1e-3)), c.a * inside);
}
vec3 printAlb(vec2 tp) {
  float inPhoto = step(abs(tp.x - ${f((PRINT.x0 + PRINT.x1) / 2)}), ${f((PRINT.x1 - PRINT.x0) / 2 - PRINT.border)}) * step(abs(tp.y - ${f((PRINT.y0 + PRINT.y1) / 2)}), ${f((PRINT.y1 - PRINT.y0) / 2 - PRINT.border)});
  vec3 alb = mix(T_LIGHTBOX * 0.8, photo(tp), inPhoto);
  vec4 tu = zoneInk(lyrU, tp, ${f(ZONE.yU)}), tl = zoneInk(lyrL, tp, ${f(ZONE.yL)});
  alb = mix(alb, tu.rgb * 0.97, tu.a * zon.x * inPhoto);
  alb = mix(alb, tl.rgb * 0.97, tl.a * zon.y * inPhoto);
  return alb;
}
vec3 shadePaper(vec3 P) {
  vec2 tp = TB(P);
  float E = lamp(P, vec3(0.0, 0.0, 1.0));
  float sh = handShadow(P);
  // the desk: a dark matte leather blotter, a faint grain
  vec3 alb = T_FILM2 * 0.8 * (0.9 + 0.1 * snoise(tp * 0.06)) * (0.94 + 0.06 * snoise(vec2(tp.x * 0.02, tp.y * 0.7)));
  float dP = printSd(tp);
  vec2 lsh = normalize(TB(keyPos) - tp) * 1.8;
  alb *= 1.0 - 0.75 * (1.0 - smoothstep(-0.4, 1.8, printSd(tp + lsh)));
  float aa = 0.12;
  float k = 1.0 - smoothstep(-aa, aa, dP);
  if (k > 0.0) alb = mix(alb, printAlb(tp), k);
  return alb * (E * sh + 0.006);
}

// ---- the tracing: ink coverage on the acetate at table point tp (shown up to the pen's progress on each mark)
float inkAt(vec2 tp) {
  vec2 tu = (tp - vec2(${f(TRC.x0)}, ${f(TRC.y0)})) / vec2(${f(TRC.x1 - TRC.x0)}, ${f(TRC.y1 - TRC.y0)});
  if (tu.x < 0.0 || tu.x > 1.0 || tu.y < 0.0 || tu.y > 1.0) return 0.0;
  vec2 uv = vec2(tu.x, 1.0 - tu.y);
  vec2 sz = vec2(${f(TRC.x1 - TRC.x0)}, ${f(TRC.y1 - TRC.y0)});
  float cov = texG(inkCov, uv, sz).r;
  if (cov < 0.004) return 0.0;
  vec4 d = texG(inkDat, uv, sz);
  if (d.r < 0.01) return 0.0;
  int idx = clamp(int(floor(d.r * 255.0 / 20.0 + 0.03)), 0, 11);
  return cov * step(d.g, prog[idx] + 0.002);
}

vec3 shade(vec2 px) {
  vec2 ndc = px / res * 2.0 - 1.0;
  vec4 qq = invVP * vec4(ndc, 1.0, 1.0);
  vec3 ro = camPos, rd = normalize(qq.xyz / qq.w - camPos);
  float tP = (Z_PAPER - ro.z) / rd.z;
  float tA = (Z_AC - ro.z) / rd.z;
  vec3 P = ro + rd * tP;
  gDX = dFdx(TB(P)); gDY = dFdy(TB(P));
  int m;
  float tH = marchHand(ro, rd, tA, m);
  if (tH < 1e8) return shadeHand(ro + rd * tH, rd, m);
  vec3 col = shadePaper(P);
  // the ink's shadow on the print below the acetate
  {
    vec3 l = normalize(keyPos - P);
    vec2 sp = TB(P + l * ((Z_AC - Z_PAPER) / l.z));
    col *= 1.0 - 0.14 * inkAt(sp + vec2(0.15, 0.12));
  }
  vec3 PA = ro + rd * tA;
  vec2 ta = TB(PA);
  float dAc = acSd(ta);
  float inAc = 1.0 - smoothstep(-0.06, 0.06, dAc);
  // its thickness: a shadow band on the print and desk beside the cut edge (away from the lamp)
  {
    float dS = acSd(ta + normalize(TB(keyPos) - ta) * 1.1);
    col *= 1.0 - 0.5 * (1.0 - smoothstep(-0.8, 1.2, dS)) * (1.0 - inAc);
  }
  if (inAc > 0.0) {
    float smudge = smoothstep(0.2, 0.9, snoise(ta * 0.02 + 21.0));
    float ink = inkAt(ta);
    vec3 acol = col * vec3(0.92, 0.94, 0.96) * (1.0 + 0.04 * smudge);
    float E = lamp(PA, vec3(0.0, 0.0, 1.0)) * handShadow(PA);
    vec3 inkBlack = T_FILM * 0.5 * (E + 0.02);
    acol = mix(acol, inkBlack, ink * 0.97);
    // the cut edge: a bright bevel where the lamp catches the sheet's thickness, a dark line on its inner side
    float bevel = 1.0 - smoothstep(0.25, 0.75, abs(dAc + 0.5));
    float inner = 1.0 - smoothstep(0.0, 0.35, abs(dAc + 1.35));
    acol = acol * (1.0 - 0.35 * inner) + T_LIGHTBOX * bevel * (0.015 + 0.55 * E);
    col = mix(col, acol, inAc);
  }
  // tape: two strips of frosted tape holding the acetate down along its top edge
  for (int k = 0; k < 2; k++) {
    vec2 c0 = k == 0 ? vec2(${f(ACETATE.x0 + 22)}, ${f(ACETATE.y0 + 1)}) : vec2(${f(ACETATE.x1 - 22)}, ${f(ACETATE.y0 + 1)});
    float ang = k == 0 ? 0.05 : -0.04;
    vec2 q = rot2(ang) * (ta - c0);
    float tape = sdBox2(q, vec2(0.0), vec2(22.0, 8.0), 0.4) + 0.35 * snoise(q * vec2(0.8, 2.0));
    float tk = 1.0 - smoothstep(-0.1, 0.25, tape);
    float E = lamp(PA, vec3(0.0, 0.0, 1.0));
    vec3 tc = T_HALIDE * (0.75 + 0.05 * snoise(q * vec2(0.3, 6.0))) * (E + 0.03);
    col = mix(col, mix(col, tc, 0.62), tk);
  }
  return col;
}
void main() {
  vec3 c = vec3(0.0);
  for (int k = ssK0(); k < ssK1(); k++) c += shade(gl_FragCoord.xy + rgss(k) * PX_SCALE);
  fragColor = vec4(c * ssWeight(), 1.0);
}`;
