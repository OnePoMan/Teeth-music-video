// Plate 12 `acetate` shader: a dark desk under one cold angled lamp (a hard cone, falling off to film black), a glossy print
// (white border) of plate 5's exhibit (golden apple flank with speckle and a specular, the bite scoop with its shadowed rim
// and grooves, black velvet, the ABFO L-scale with ticks), the lyric printed on it (zone canvas), a visible sheet of
// acetate over it (tape strips at the top, one thin bevel line lit only inside the lamp's pool, the lamp's hotspot, the
// ink's offset shadow on the print) carrying the pen's tracing (static ink canvases revealed by the pen's progress), the
// gloved hand and pen (GLSL_HAND, the one shared glove, lit by the lamp). Table mm, y DOWN; world = (x, -y), z up.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL } from '../../engine/gl';
import { GLSL_HAND } from './match-glsl';
import { PS, PRINT, ACETATE, TRC, BM, ZONE } from './acetate-ink';

const f = (x: number) => x.toFixed(4);

export const MAIN_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
${GLSL_HAND}
uniform mat4 invVP; uniform vec3 camPos; uniform vec2 res;
uniform sampler2D lyrU, inkCov, inkDat, bmS, bmG;
uniform float prog[12];
uniform vec3 keyPos; uniform vec2 aim; uniform vec2 cone; uniform float lampK;
uniform vec3 hTip, hE1, hE2, hE3; uniform float handOn;
uniform float zon;     // the zone canvas has content

const float PS = ${f(PS)};
const float Z_PAPER = 0.4, Z_AC = 3.4;
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
    vec3 alb = T_SILVER * 0.24;
    float spec = ggx(N, Hh, 0.5) * (0.07 + 0.55 * pow(1.0 - nv, 5.0)) * 1.1;
    float bounce = max(-N.z, 0.0) * 0.9 * o + 0.06 * (0.5 + 0.5 * N.x);
    float rim = pow(1.0 - nv, 3.0) * 0.14;
    col = alb * (E * 1.4 + bounce * E + 0.012) + T_LIGHTBOX * (spec * E + rim * E * 0.5);
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

// ---- the photograph: plate 5's exhibit as a flat-bed print: a golden apple's flank (face-on, enlarged 2.2:1) on black velvet,
// one bite scooped out of it, the ABFO No. 2 L-scale lying in the bite's plane beside it (bite mm, Y up)
vec3 gmix(vec3 a, vec3 b, float t) { return pow(mix(pow(a, vec3(0.4545)), pow(b, vec3(0.4545)), t), vec3(2.2)); }
#define RUSS (T_STONE * T_STONE / 0.807 * 0.62)
#define BLUSH gmix(T_STONE, gmix(T_WAX, T_HALIDE, 0.45), 0.6)
#define CREAM gmix(T_STONE, T_LIGHTBOX, 0.64)
#define OXID gmix(RUSS, T_SILVER, 0.3)
#define BROWN (gmix(T_STONE, RUSS, 0.55) * 0.5)
const vec2 BMO = vec2(${f(BM.x0)}, ${f(BM.y0)}), BMS = vec2(${f(BM.x1 - BM.x0)}, ${f(BM.y1 - BM.y0)});
const vec2 AC0 = vec2(6.0, 4.0), AR0 = vec2(40.0, 36.0);   // the apple: centre and radii (bite mm)
const vec2 SC0 = vec2(-64.0, -55.0);   // the L-scale's outer corner; arms 100 mm long, 18 mm wide (printed 2.2:1 with everything)
float bowlH(vec2 uv) { return 6.0 * textureLod(bmS, uv, 5.0).r + 2.6 * textureLod(bmG, uv, 3.0).r; }
float sdBoxP(vec2 p, vec2 c, vec2 h) { vec2 q = abs(p - c) - h; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
float tkd(float a, float s) { return abs(a - s * floor(a / s + 0.5)); }
// the scale's ticks: a = mm along the arm from the corner, d = mm inside the arm from its inner edge
float ticks(float a, float d) {
  float m1 = (1.0 - smoothstep(0.045, 0.085, tkd(a, 1.0))) * step(0.0, d) * step(d, 1.5);
  float m5 = (1.0 - smoothstep(0.06, 0.1, tkd(a, 5.0))) * step(0.0, d) * step(d, 3.0);
  float m10 = (1.0 - smoothstep(0.07, 0.12, tkd(a, 10.0))) * step(0.0, d) * step(d, 5.2);
  return max(m1, max(m5, m10));
}
vec3 photo(vec2 tp) {
  vec2 P = vec2(tp.x, -tp.y) / PS;   // bite mm, Y up
  vec3 L = normalize(vec3(-0.5, 0.55, 0.68));
  // the black velvet: a very dark pile with a faint sheen where a fold catches the flash, a fine nap
  vec3 vel = T_FILM * (0.62 + 0.3 * snoise(P * 0.6)) * (1.0 + 0.9 * smoothstep(0.55, 1.0, snoise(P * vec2(1.1, 0.16) + 3.0)) + 0.3 * snoise(P * 13.0));
  // an apple's silhouette: round, a little broader at the shoulders than at the base, a dimple at the stem well and a shallower one at the calyx
  vec2 e = (P - AC0) / AR0;
  float tpr = 1.0 + 0.07 * e.y;
  float dimple = 0.17 * exp(-pow(e.x / 0.27, 2.0)) * smoothstep(0.0, 0.75, e.y) - 0.05 * exp(-pow(e.x / 0.24, 2.0)) * smoothstep(0.0, -0.75, e.y);
  vec2 es = vec2(e.x / tpr, e.y + dimple);
  float ang = atan(es.y, es.x);
  float r = length(es) * (1.0 + 0.007 * snoise(vec2(ang * 2.0, 1.7)));
  float aaw = max(max(length(gDX), length(gDY)) / (PS * 36.0) * 1.1, 0.0016);
  float apple = 1.0 - smoothstep(1.0 - aaw, 1.0 + 0.2 * aaw, r);
  // the flank: a sphere's normal (the silhouette falls to grazing), lit by the key from the upper left
  vec3 n = normalize(vec3(es * 0.96, sqrt(max(1.0 - 0.92 * dot(es, es), 0.03))));
  // the skin: stone gold pulled toward silver, streaked along the meridians from the stem, russet round the well, a faint wax blush
  vec3 skin = gmix(T_STONE, T_SILVER, 0.05) * 0.74;
  float mer = snoise(vec2(ang * 3.2, r * 1.3) + 5.0) * 0.6 + snoise(vec2(ang * 9.0, r * 3.0) + 11.0) * 0.4;
  skin = mix(skin, RUSS * 0.6, 0.4 * smoothstep(0.35, 0.9, mer));
  skin = mix(skin, gmix(T_STONE, T_LIGHTBOX, 0.25) * 0.7, 0.25 * smoothstep(0.1, 0.8, -mer));
  float stemNear = smoothstep(0.35, 0.95, e.y) * exp(-pow(e.x / 0.55, 2.0));
  skin = mix(skin, RUSS * 0.5, 0.55 * stemNear);
  skin = mix(skin, BLUSH * 0.55, 0.22 * smoothstep(0.0, 0.8, e.x) * smoothstep(0.9, 0.0, abs(e.y)));
  skin *= 0.9 + 0.1 * snoise(P * 0.09) + 0.05 * snoise(P * 0.5);
  // lenticels: small pale flecks, fewer and fainter than before, thicker toward the stem, a few dark ones
  float lens1 = smoothstep(0.6, 0.72, snoise(P * 2.4 + 4.0)), lens2 = smoothstep(0.64, 0.76, snoise(P * 5.5 + 9.0));
  skin = mix(skin, CREAM * 0.8, (0.42 * lens1 + 0.34 * lens2) * (0.55 + 0.6 * stemNear) * (1.0 - 0.5 * r));
  skin = mix(skin, RUSS * 0.45, 0.2 * step(0.92, snoise(P * 4.3 + 17.0)));
  skin *= 0.95 + 0.05 * snoise(P * 9.0) + 0.02 * snoise(P * 27.0);
  float dif = max(dot(n, L), 0.0);
  // curvature falloff: lit flank, terminator toward the lower right, a soft bounce at the very edge
  skin *= (0.15 + 1.25 * pow(dif, 0.9)) * (1.0 - 0.55 * pow(r, 3.0)) + 0.05 * smoothstep(0.7, 1.0, r);
  // the lamp's specular band: the soft-box's reflection, a crisp-edged streak running down the flank, bowed with the skin
  {
    float hx = -0.3 + 0.35 * pow(n.y - 0.45, 2.0);
    float dxn = abs(n.x - hx);
    float bx = (1.0 - smoothstep(0.03, 0.055, dxn)) * 0.6 + 0.4 * exp(-pow(dxn / 0.1, 2.0));
    float by = smoothstep(0.05, 0.4, n.y) * (1.0 - smoothstep(0.5, 0.9, n.y));
    float sp = bx * by * (0.8 + 0.2 * snoise(P * vec2(0.4, 1.2) + 2.0));
    skin += T_LIGHTBOX * 0.22 * sp * (1.0 - 0.5 * lens1);
    // a faint broad sheen about it
    skin += T_LIGHTBOX * 0.04 * pow(max(dot(n, normalize(vec3(-0.2, 0.3, 0.93))), 0.0), 22.0);
  }
  // the stem well: a dark cavity at the top, russet-black
  float well = exp(-(pow(e.x / 0.2, 2.0) + pow((e.y - 0.84) / 0.07, 2.0)));
  skin = mix(skin, RUSS * 0.12, 0.85 * well);
  vec3 col = mix(vel, skin, apple);
  // the stem: a dark brown rod standing out of the well; and a grey leaf curling off its tip (plate 5's exhibit)
  {
    vec2 sa = vec2(AC0.x + 0.2, AC0.y + 0.8 * AR0.y);
    vec2 sb = sa + vec2(0.8, 13.0);
    vec2 sd = sb - sa;
    float st = clamp(dot(P - sa, sd) / dot(sd, sd), 0.0, 1.0);
    float sdist = length(P - (sa + sd * st)) - (1.1 - 0.15 * st);
    float sk = 1.0 - smoothstep(-0.08, 0.1, sdist);
    float sx = clamp((P.x - sa.x) / 1.6, -1.0, 1.0);
    vec3 scol = RUSS * (0.045 + 0.03 * (1.0 - sx) + 0.02 * snoise(P * vec2(3.0, 0.7)));
    col = mix(col, scol, sk);
    vec2 la = sa + vec2(0.4, 10.5), lb = la + vec2(-16.0, 6.0);
    vec2 ld = lb - la; float ll = length(ld); vec2 lu = ld / ll, lpn = vec2(-lu.y, lu.x);
    vec2 lr = P - la;
    float lt = dot(lr, lu) / ll;
    float lw = 3.5 * pow(max(sin(3.14159 * clamp(lt, 0.0, 1.0)), 0.0), 0.75) * (1.0 - 0.25 * lt);
    float lacross = dot(lr, lpn) + 2.2 * lt * lt;
    float lsd = abs(lacross) - lw;
    float lk = (1.0 - smoothstep(-0.1, 0.12, lsd)) * step(0.0, lt) * step(lt, 1.0);
    float vein = (1.0 - smoothstep(0.0, 0.16, abs(lacross))) * 0.5 + 0.22 * pow(abs(sin((lt * 11.0 - abs(lacross) * 0.7) * 3.14159)), 14.0) * smoothstep(0.1, 1.0, lw);
    vec3 lcol = gmix(T_SILVER, T_STONE, 0.2) * (0.2 + 0.22 * clamp(0.6 + 0.8 * lacross / max(lw, 0.5), 0.0, 1.2)) * (1.0 + vein * 0.9);
    col = mix(col, lcol, lk);
  }
  // the bite
  vec2 Pb = P;   // (the bite is photographed square on)
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
    vec3 n2 = normalize(vec3(gr.x, gr.y, 1.0));
    float hb = textureLod(bmS, uv, 5.5).r;
    float hw = textureLod(bmS, uv, 7.2).r;   // the bowl's depth: dark under the walls, open in the middle
    // the skin round the cut: a bruised, slightly browned halo
    float halo = textureLod(bmS, uv, 4.2).r;
    col *= 1.0 - 0.3 * halo * (1.0 - flesh) * apple;
    col = mix(col, RUSS * 0.5 * (0.5 + 0.5 * dif), 0.22 * halo * (1.0 - flesh) * apple);
    vec3 fl = CREAM * 0.95 * (0.94 + 0.06 * snoise(P * vec2(5.0, 1.3)) + 0.04 * snoise(P * 21.0));
    fl = mix(fl, BROWN, 0.12 * hb + 0.34 * (1.0 - smoothstep(0.45, 0.95, hw)));
    // the incisors' drag: fine striations dropping from the bars across the scoop, with a lit lower lip
    float gdr = smoothstep(0.02, 0.3, textureLod(bmG, uv0, 5.0).r);
    float wob = 2.5 * snoise(vec2(Pb.x * 0.5, Pb.y * 0.3));
    float stri = pow(0.5 + 0.5 * sin(Pb.x * 11.0 + wob), 6.0) * (0.6 + 0.4 * pow(0.5 + 0.5 * sin(Pb.x * 3.3 + wob * 1.3 + Pb.y * 0.12), 2.0));
    float stri2 = pow(0.5 + 0.5 * sin(Pb.x * 27.0 + 3.0 * wob + Pb.y * 0.2), 8.0);
    float drop = 0.45 + 0.55 * smoothstep(-14.0, 14.0, Pb.y);   // strongest under the upper bars
    fl *= 1.0 - (0.4 * stri + 0.16 * stri2) * gdr * drop - 0.1 * stri * (1.0 - gdr) * drop;
    fl += T_LIGHTBOX * 0.06 * pow(0.5 + 0.5 * sin(Pb.x * 11.0 + wob + 1.7), 8.0) * drop * hw;
    float dif2 = max(dot(n2, L), 0.0);
    fl *= (0.3 + 0.7 * dif2) * (0.36 + 0.64 * smoothstep(0.3, 0.95, hw));
    // the shadowed rim: the lip of skin throws its shadow across the floor on the lamp side (upper left)
    vec2 Ld = normalize(vec2(-0.5, 0.55));
    float occ = 0.0;
    float ow = 0.0;
    for (int k = 1; k <= 8; k++) {
      float dd = 0.5 + 0.7 * float(k);
      float wk = 1.0 - 0.09 * float(k);
      float sS = textureLod(bmS, uv + Ld * dd / BMS, 1.0).r;
      occ += wk * (1.0 - smoothstep(0.38, 0.6, sS)); ow += wk;
    }
    occ /= ow;
    fl = mix(fl, BROWN * 0.55, 0.82 * smoothstep(0.0, 0.7, occ));
    // the shadowed upper wall under the rim, the flash lighting the far (lower) wall
    float rimsh = smoothstep(0.15, 0.62, textureLod(bmS, uv + vec2(0.0, 1.6 / BMS.y), 3.0).r) * (1.0 - smoothstep(0.62, 0.95, hw));
    fl *= 1.0 - 0.4 * rimsh * (1.0 - smoothstep(0.5, 0.8, s0));
    // the skin's cut lip, a thin bright edge (the wall facing the lamp)
    float lip = smoothstep(0.28, 0.5, s0) * (1.0 - smoothstep(0.5, 0.74, s0));
    vec2 lg = vec2(textureLod(bmS, uv + dxw * 0.4, 3.0).r - textureLod(bmS, uv - dxw * 0.4, 3.0).r, textureLod(bmS, uv + dyw * 0.4, 3.0).r - textureLod(bmS, uv - dyw * 0.4, 3.0).r);
    float lipLit = 0.35 + 0.65 * smoothstep(-0.2, 0.7, dot(normalize(lg + 1e-4), -Ld));
    fl = mix(fl, gmix(T_STONE, T_LIGHTBOX, 0.35) * 0.85, lip * 0.5 * lipLit);
    // his teeth: each bar a clean groove cut into the rim, dark in the floor, a lit far edge
    float gb = textureLod(bmG, uv0, 1.0).r;
    vec2 gg = vec2(textureLod(bmG, uv0 + dx, 1.5).r - textureLod(bmG, uv0 - dx, 1.5).r, textureLod(bmG, uv0 + dy, 1.5).r - textureLod(bmG, uv0 - dy, 1.5).r);
    vec3 gcol = OXID * 0.7 * (0.35 + 0.6 * max(dot(normalize(vec3(gg * 2.0, 1.0)), L), 0.0)) * (0.85 + 0.15 * snoise(P * 5.0));
    fl = mix(fl, gcol, 0.82 * smoothstep(0.35, 0.8, gb));
    col = mix(col, fl, flesh * apple);
  }
  // the ABFO No. 2 scale: a matte grey L with 1 mm, 5 mm and 10 mm ticks along its inner edges and three black rings
  {
    float dV = sdBoxP(P, SC0 + vec2(9.0, 50.0), vec2(9.0, 50.0)), dH = sdBoxP(P, SC0 + vec2(50.0, 9.0), vec2(50.0, 9.0));
    float sd = min(dV, dH);
    float cov = 1.0 - smoothstep(-0.04, 0.04, sd);
    if (cov > 0.0) {
      vec3 sc = T_HALIDE * 0.62 * (0.94 + 0.06 * snoise(P * 3.0));
      float di = -sd;
      sc += T_LIGHTBOX * 0.18 * (1.0 - smoothstep(0.0, 0.5, di));
      sc *= 0.82 + 0.18 * smoothstep(0.0, 1.2, di);
      // ticks on the vertical arm's inner (right) edge, the horizontal arm's inner (top) edge
      float tv = ticks(P.y - SC0.y, SC0.x + 18.0 - P.x) * step(SC0.y + 18.0, P.y);
      float th = ticks(P.x - SC0.x, SC0.y + 18.0 - P.y) * step(SC0.x + 18.0, P.x);
      sc = mix(sc, T_FILM * 1.4, max(tv, th) * 0.92);
      // the three black rings: the corner and the arms' mid points
      for (int i = 0; i < 3; i++) {
        vec2 c = SC0 + (i == 0 ? vec2(9.0, 9.0) : i == 1 ? vec2(9.0, 60.0) : vec2(60.0, 9.0));
        float rr = length(P - c);
        sc = mix(sc, T_FILM * 1.3, (1.0 - smoothstep(0.05, 0.2, abs(rr - 3.0))) + (1.0 - smoothstep(0.1, 0.3, rr)) * 0.0);
      }
      col = mix(col, sc, cov);
    }
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
  // the paper: a white border, a faint warm-grey cast and a soft edge where the photograph's emulsion stops
  vec3 alb = mix(T_LIGHTBOX * (0.8 + 0.03 * snoise(tp * 0.2)), photo(tp), inPhoto);
  vec4 tu = zoneInk(lyrU, tp, ${f(ZONE.yU)});
  alb = mix(alb, tu.rgb * 0.97, tu.a * zon * inPhoto);
  return alb;
}
vec3 shadePaper(vec3 P) {
  vec2 tp = TB(P);
  float E = lamp(P, vec3(0.0, 0.0, 1.0));
  float sh = handShadow(P);
  // the desk: a dark matte leather blotter, a faint grain
  vec3 alb = T_FILM2 * 0.9 * (0.9 + 0.1 * snoise(tp * 0.06)) * (0.94 + 0.06 * snoise(vec2(tp.x * 0.02, tp.y * 0.7)));
  float dP = printSd(tp);
  vec2 lsh = normalize(TB(keyPos) - tp) * 1.8;
  alb *= 1.0 - 0.75 * (1.0 - smoothstep(-0.4, 1.8, printSd(tp + lsh)));
  float aa = 0.12;
  float k = 1.0 - smoothstep(-aa, aa, dP);
  if (k > 0.0) alb = mix(alb, printAlb(tp), k);
  // the print's edge catches the lamp: a hairline of paper thickness
  alb += T_LIGHTBOX * 0.5 * (1.0 - smoothstep(0.0, 0.3, abs(dP + 0.1))) * step(dP, 0.2) * 0.0;
  return alb * (E * sh + 0.004);
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
  vec3 PA = ro + rd * tA;
  vec2 ta = TB(PA);
  float dAc = acSd(ta);
  float inAc = 1.0 - smoothstep(-0.06, 0.06, dAc);
  float Epool = lamp(PA, vec3(0.0, 0.0, 1.0));
  // the ink's shadow on the print below the acetate: offset away from the lamp, faint and soft
  {
    vec3 l = normalize(keyPos - P);
    vec2 sp = TB(P + l * ((Z_AC - Z_PAPER) / l.z));
    float sI = inkAt(sp);
    col *= 1.0 - 0.45 * sI * inAc;
  }
  // its thickness: a shadow band on the print and desk beside the cut edge (away from the lamp)
  {
    float dS = acSd(ta + normalize(TB(keyPos) - ta) * 1.5);
    col *= 1.0 - 0.5 * (1.0 - smoothstep(-0.8, 1.4, dS)) * (1.0 - inAc);
  }
  if (inAc > 0.0) {
    // the sheet: clear, faintly cool, a smudge or two, dust
    float smudge = smoothstep(0.2, 0.9, snoise(ta * 0.02 + 21.0));
    float ink = inkAt(ta);
    vec3 acol = col * vec3(0.93, 0.95, 0.97) * (1.0 + 0.05 * smudge);
    float hand = handShadow(PA);
    // the lamp's hotspot on the plastic: a broad glossy lobe that slides over the sheet as the lamp and the lens move
    vec3 Lh = normalize(keyPos - PA), Vv = normalize(camPos - PA);
    vec3 Hh = normalize(Lh + Vv);
    vec2 rip = vec2(snoise(ta * 0.045 + 3.0), snoise(ta * 0.045 + 11.0));
    vec3 Nn = normalize(vec3(rip * 0.0025, 1.0));
    float nh = max(dot(Nn, Hh), 0.0);
    float hot = pow(nh, 420.0) * 0.55 + pow(nh, 90.0) * 0.035;
    float Es = Epool * hand;
    vec3 inkBlack = T_FILM * 0.5 * (Es + 0.02);
    acol += T_LIGHTBOX * hot * Epool * hand;
    acol = mix(acol, inkBlack, ink * 0.97);
    // the cut edge: ONE thin bevel line, lit only where the lamp's pool reaches it (outside the pool the edge is dark)
    float bevel = 1.0 - smoothstep(0.05, 0.22, abs(dAc + 0.22));
    acol += T_LIGHTBOX * bevel * 0.85 * smoothstep(0.08, 0.45, Es);
    col = mix(col, acol, inAc);
  }
  // tape: two strips of frosted tape wrapped over the sheet's top edge, translucent, with a lit edge where the lamp reaches
  for (int k = 0; k < 2; k++) {
    vec2 c0 = k == 0 ? vec2(${f(ACETATE.x0 + 38)}, ${f(ACETATE.y0)}) : vec2(${f(ACETATE.x1 - 38)}, ${f(ACETATE.y0)});
    float ang = k == 0 ? 0.045 : -0.035;
    vec2 q = rot2(ang) * (ta - c0);
    float tape = sdBox2(q, vec2(0.0), vec2(17.0, 9.0), 0.3) + 0.3 * snoise(q * vec2(0.7, 2.0));
    float tk = 1.0 - smoothstep(-0.1, 0.22, tape);
    if (tk > 0.0) {
      float Et = lamp(PA, vec3(0.0, 0.0, 1.0));
      vec3 under = col * 0.62;
      vec3 tc = under + T_HALIDE * 0.34 * (0.85 + 0.15 * snoise(q * vec2(0.3, 7.0))) * Et;
      tc += T_LIGHTBOX * 0.35 * Et * (1.0 - smoothstep(0.0, 0.35, abs(tape + 0.15)));
      col = mix(col, tc, tk * 0.92);
    }
  }
  return col;
}
void main() {
  vec3 c = vec3(0.0);
  for (int k = ssK0(); k < ssK1(); k++) c += shade(gl_FragCoord.xy + rgss(k) * PX_SCALE);
  fragColor = vec4(c * ssWeight(), 1.0);
}`;
