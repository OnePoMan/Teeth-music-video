// Plate 11 `luminol`: the frame shader. A dark evidence room: a man's white shirt on a wire hanger on a steel rail, a
// clear evidence bag hanging from two clips on a wire just in front of it, a far wall. One hard source, dimmed for the
// luminol (a narrow cold spot high at front left: a hard pool, the shirt's shadow on the wall), the luminol glow
// itself (one soft bloom soaked into the weave over the left chest, lighting the cloth round it, the bag, the glove),
// and, at the seal, the evidence camera's flash. Mode 0: the shirt on the hanger; mode 1: the shirt folded inside the
// sealed bag (a hard cut: no cloth fold), the empty hanger behind. Ray-traced in one pass: the shirt, hanger and clips
// as one SDF, the two gloved hands as SDFs in their own frames, the rail and wire as cylinders, the bag's two panels
// and its seal flap as planes (printed lyric, label and seal from textures). Units: mm, world z up, y away from the
// camera's side, x right; the bag's front panel is the plane y = -150, its top edge at z = -90.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL } from '../../engine/gl';
import { GLSL_HANDS } from './luminol-hands';
import { BAG, APPM, TILE_W, TILE_H, ATLAS_C, ATLAS_R, LABEL, FLAP } from './luminol-type';

const f = (x: number) => x.toFixed(3);

export const LUM_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
uniform mat4 invVP; uniform vec3 camPos; uniform vec2 res; uniform float pxAng;
uniform float mode, glowK, glowR, keyK, flashK, flapA;
uniform sampler2D lyrTex, labTex, sealTex;
uniform vec2 tileO;
uniform vec4 wR[4]; uniform vec4 wS[4];
uniform float sprayOn, sPull; uniform vec3 sTip, sE1, sE2, sE3;
uniform float handOn; uniform vec3 hTip, hE1, hE2, hE3;

const float BAG_Y = -150.0, BAG_Z0 = -90.0;
const vec3 KEYP = vec3(-1300.0, -1750.0, 1150.0);
const vec3 KEYAIM = vec3(0.0, 0.0, -380.0);
const vec3 SLO = vec3(-345.0, -178.0, -800.0), SHI = vec3(345.0, 95.0, 88.0);
const vec2 ATLAS = vec2(${f(TILE_W * ATLAS_C)}, ${f(TILE_H * ATLAS_R)});

${GLSL_HANDS}

vec2 boxHit(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  vec3 iv = 1.0 / rd; vec3 t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
               vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

// ---------------------------------------------------------------- the shirt on its hanger (mode 0)
float hwAt(float z) { return 226.0 + 18.0 * smoothstep(-110.0, -300.0, z) - 14.0 * smoothstep(-330.0, -520.0, z) + 10.0 * smoothstep(-560.0, -760.0, z); }
float htAt(float z) { return mix(54.0, 20.0, smoothstep(-110.0, -560.0, z)); }
float shZ(float ax) { return -50.0 - max(ax - 64.0, 0.0) * 0.46; }
float folds(vec3 p) {
  float lo = smoothstep(-240.0, -640.0, p.z);
  float f = sin(p.x * 0.041 + 1.6 * sin(p.z * 0.0043 + 0.6)) * (1.6 + 3.4 * lo);
  float ax = abs(p.x);
  f += 2.6 * sin((ax * 0.85 + p.z) * 0.026) * smoothstep(110.0, 220.0, ax) * smoothstep(-110.0, -230.0, p.z) * (1.0 - lo);
  return f;
}
float sdTorso(vec3 p) {
  float hw = hwAt(p.z), ht = htAt(p.z);
  float qx = abs(p.x) - (hw - ht);
  float cr = (qx > 0.0 ? length(vec2(qx, p.y)) : abs(p.y)) - ht;
  float top = (p.z - shZ(abs(p.x))) * 0.9;
  float hem = (-765.0 + 52.0 * (p.x * p.x) / (240.0 * 240.0)) - p.z;
  float d = smax(cr, top, 20.0);
  // the neck opening inside the collar (dark, the back of the collar inside it)
  float neck = max((length(vec2(p.x / 60.0, (p.y - 4.0) / 44.0)) - 1.0) * 44.0, -170.0 - p.z);
  d = max(d, -neck);
  d = smax(d, hem, 5.0);
  return d + folds(p);
}
float sdSleeves(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y * 1.7, p.z);
  vec3 a = vec3(206.0, 4.0, -132.0), b = vec3(240.0, -6.0, -596.0);
  float s = rcap(q, a, b, 50.0, 37.0);
  vec3 ax = normalize(b - a);
  float cuff = rcap(q, b, b + ax * 58.0, 39.0, 38.5);
  s = min(s, cuff);
  s += 1.8 * sin(q.z * 0.045 + q.x * 0.02) * smoothstep(-200.0, -380.0, q.z);
  return s * 0.58;
}
float sdCollar(vec3 p) {
  vec3 q = p - vec3(0.0, 4.0, 0.0);
  float e = length(vec2(q.x / 68.0, q.y / 52.0));
  float rad = (e - 1.0) * 58.0;
  float stand = sdBox(vec2(rad, q.z + 36.0), vec2(3.2, 15.0)) - 1.4;
  // the fall: the outer leaf round the back and sides, folded down over the stand
  float th = atan(q.x, -q.y);
  float leaf = max(abs(rad - 6.5) - 2.2, max(q.z + 17.0, -50.0 - q.z));
  leaf = max(leaf, (0.55 - abs(th)) * 40.0);
  // the two points lying on the chest
  float s = sign(p.x);
  vec2 xz = vec2(abs(p.x), p.z);
  float tri = sdTri(xz, vec2(12.0, -38.0), vec2(80.0, -48.0), vec2(50.0, -124.0)) - 1.5;
  float yf = -htAt(p.z) - 3.0 + folds(p) * 0.0;
  float pts = max(tri, abs(p.y - yf) - 2.2);
  return min(min(stand, leaf), pts);
}
float sdHanger(vec3 p) {
  float d = rcap(p, vec3(0.0, 0.0, -46.0), vec3(0.0, -17.0, 60.0), 2.3, 2.3);
  vec3 q = p - vec3(0.0, 0.0, 62.0);
  float tor = length(vec2(length(q.yz) - 17.0, q.x)) - 2.3;
  tor = max(tor, -q.z - 4.0 + min(q.y, 0.0) * 4.0);
  d = min(d, tor);
  vec3 a = vec3(abs(p.x), p.y, p.z);
  d = min(d, rcap(a, vec3(0.0, 0.0, -46.0), vec3(205.0, 0.0, -138.0), 2.3, 2.3));
  d = min(d, rcap(a, vec3(0.0, 0.0, -142.0), vec3(205.0, 0.0, -140.0), 2.3, 2.3));
  return d;
}
float sdClips(vec3 p) {
  vec3 q = vec3(abs(p.x) - 222.0, p.y - (BAG_Y + 3.0), p.z - (BAG_Z0 + 3.0));
  float body = sdBox3(q, vec3(12.0, 5.0, 10.0)) - 1.2;
  vec3 hq = vec3(abs(q.x) - 7.5, q.y, q.z);
  float hd = rcap(hq, vec3(0.0, 0.0, 10.0), vec3(-3.0, 0.0, -58.0 - BAG_Z0 - 3.0), 1.1, 1.1);
  return min(body, hd);
}
// ---------------------------------------------------------------- the shirt folded in the sealed bag (mode 1)
float sdFolded(vec3 p) {
  vec3 c = vec3(0.0, -72.0, -418.0);
  float slab = sdBox3(p - c, vec3(198.0, 12.0, 270.0)) - 14.0;
  slab += 1.5 * sin(p.x * 0.035 + 0.8) * sin(p.z * 0.02) * smoothstep(-250.0, -330.0, p.z);
  vec3 q = p - vec3(0.0, -98.0, -182.0);
  float e = length(vec2(q.x / 66.0, q.z / 30.0));
  float band = sdBox(vec2((e - 1.0) * 40.0, q.y + 8.0), vec2(3.0, 9.0)) - 1.2;
  vec2 xz = vec2(abs(p.x), p.z);
  float tri = sdTri(xz, vec2(16.0, -228.0), vec2(92.0, -222.0), vec2(58.0, -300.0)) - 1.5;
  float pts = max(tri, abs(p.y + 101.0) - 2.0);
  return min(slab, min(band, pts));
}

float mapS(vec3 p, out int m) {
  float d; m = 1;
  if (mode < 0.5) d = smin(min(sdTorso(p), sdCollar(p)), sdSleeves(p), 16.0);
  else d = sdFolded(p);
  float h = sdHanger(p); if (h < d) { d = h; m = 2; }
  float c = sdClips(p); if (c < d) { d = c; m = 3; }
  return d;
}
float mapSD(vec3 p) { int m; return mapS(p, m); }
// the shadow casters (the clips left out: their small shadows read as smudges on the cloth)
float mapShD(vec3 p) {
  float d = mode < 0.5 ? smin(min(sdTorso(p), sdCollar(p)), sdSleeves(p), 16.0) : sdFolded(p);
  return min(d, sdHanger(p));
}
float marchS(vec3 ro, vec3 rd, out int m) {
  m = -1;
  vec2 bh = boxHit(ro, rd, SLO, SHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1e9;
  float t = max(bh.x, 0.0);
  for (int i = 0; i < 140; i++) {
    if (t > bh.y) break;
    int mm;
    vec3 p = ro + rd * t;
    float h = mapS(p, mm);
    if (h < 0.06 + t * 0.00025) { m = mm; return t; }
    t += h * 0.78;
  }
  return 1e9;
}
vec3 nrmS(vec3 p) {
  const vec2 k = vec2(1.0, -1.0); const float e = 0.25;
  return normalize(k.xyy * mapSD(p + k.xyy * e) + k.yyx * mapSD(p + k.yyx * e) + k.yxy * mapSD(p + k.yxy * e) + k.xxx * mapSD(p + k.xxx * e));
}
// the hard key's shadow (the shirt, hanger and clips)
float keyShadow(vec3 P) {
  vec3 L = normalize(KEYP - P);
  vec2 bh = boxHit(P, L, SLO, SHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1.0;
  float t = max(bh.x, 1.2), res = 1.0;
  for (int i = 0; i < 36; i++) {
    if (t > bh.y) break;
    float h = mapShD(P + L * t);
    res = min(res, 30.0 * h / t);
    if (res < 0.02) break;
    t += clamp(h, 1.5, 45.0);
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

// ---------------------------------------------------------------- the hands
const vec3 HLO = vec3(-4.0, -64.0, -36.0), HHI = vec3(330.0, 50.0, 48.0);
vec3 toH(vec3 p) { vec3 d = p - hTip; return vec3(dot(d, hE1), dot(d, hE2), dot(d, hE3)); }
vec3 dirH(vec3 v) { return vec3(dot(v, hE1), dot(v, hE2), dot(v, hE3)); }
vec3 fromH(vec3 v) { return hE1 * v.x + hE2 * v.y + hE3 * v.z; }
const vec3 QLO = vec3(-300.0, -52.0, -212.0), QHI = vec3(9.0, 52.0, 24.0);
vec3 toQ(vec3 p) { vec3 d = p - sTip; return vec3(dot(d, sE1), dot(d, sE2), dot(d, sE3)); }
vec3 dirQ(vec3 v) { return vec3(dot(v, sE1), dot(v, sE2), dot(v, sE3)); }
vec3 fromQ(vec3 v) { return sE1 * v.x + sE2 * v.y + sE3 * v.z; }
float sdQ(vec3 q) { int m; return sdSprayHand(q, sPull, m); }
float sdHq(vec3 q) { int m; return sdPenHand(q, m); }

float marchPen(vec3 ro, vec3 rd, out int m) {
  m = -1;
  if (handOn < 0.5) return 1e9;
  vec3 o = toH(ro), d = dirH(rd);
  vec2 bh = boxHit(o, d, HLO, HHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1e9;
  float t = max(bh.x, 0.0);
  for (int i = 0; i < 160; i++) {
    if (t > bh.y) break;
    int mm; float h = sdPenHand(o + d * t, mm);
    if (h < 0.03) { m = mm; return t; }
    t += h * 0.8;
  }
  return 1e9;
}
float marchSpray(vec3 ro, vec3 rd, out int m) {
  m = -1;
  if (sprayOn < 0.5) return 1e9;
  vec3 o = toQ(ro), d = dirQ(rd);
  vec2 bh = boxHit(o, d, QLO, QHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1e9;
  float t = max(bh.x, 0.0);
  for (int i = 0; i < 140; i++) {
    if (t > bh.y) break;
    int mm; float h = sdSprayHand(o + d * t, sPull, mm);
    if (h < 0.04) { m = mm; return t; }
    t += h * 0.8;
  }
  return 1e9;
}
vec3 nrmQ(vec3 q) {
  const vec2 k = vec2(1.0, -1.0); const float e = 0.08;
  return normalize(k.xyy * sdQ(q + k.xyy * e) + k.yyx * sdQ(q + k.yyx * e) + k.yxy * sdQ(q + k.yxy * e) + k.xxx * sdQ(q + k.xxx * e));
}
vec3 nrmH(vec3 q) {
  const vec2 k = vec2(1.0, -1.0); const float e = 0.06;
  return normalize(k.xyy * sdHq(q + k.xyy * e) + k.yyx * sdHq(q + k.yyx * e) + k.yxy * sdHq(q + k.yxy * e) + k.xxx * sdHq(q + k.xxx * e));
}

// ---------------------------------------------------------------- light
vec3 bloomW() { return mode < 0.5 ? vec3(110.0, -58.0, -280.0) : vec3(100.0, -100.0, -300.0); }
vec2 bloomBag() { vec3 b = bloomW(); return vec2(b.x, b.z - BAG_Z0); }
float keyCone(vec3 P) { return smoothstep(0.968, 0.976, dot(normalize(P - KEYP), normalize(KEYAIM - KEYP))); }
float ggx(vec3 N, vec3 H, float rough) {
  float a2 = rough * rough * rough * rough, nh = max(dot(N, H), 0.0);
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * dd * dd);
}
// irradiance from the key (with its shadow), the glow (as a soft blue source at the bloom) and the flash
vec3 lightAt(vec3 P, vec3 N, vec3 V, float sh) {
  vec3 L = normalize(KEYP - P);
  vec3 E = vec3(0.93, 0.97, 1.0) * keyK * keyCone(P) * max(dot(N, L), 0.0) * sh;
  vec3 G = bloomW() - P; float gd = length(G);
  E += T_LUMINOL * glowK * 0.7 * max(dot(N, G / max(gd, 1.0)), 0.0) / (1.0 + gd * gd / (150.0 * 150.0));
  vec3 fv = P - camPos;
  E += vec3(flashK * 1.2 * max(dot(N, V), 0.0) * min(1.3e6 / dot(fv, fv), 1.5));
  return E;
}
// the luminol: one soft bloom soaked into the cloth (no lobes, no edges): a core, a wider wicked fringe, the weave
float bloomMask(vec3 P) {
  vec2 bc = bloomW().xz;
  vec2 d = (P.xz - bc) / (vec2(56.0, 68.0) * glowR);
  float r2 = dot(d, d) * (1.0 + 0.11 * snoise(P.xz * 0.0085 + 3.1));
  return exp(-0.5 * r2) + 0.2 * exp(-0.5 * r2 / 2.8);
}

vec3 shadeShirt(vec3 P, vec3 N, vec3 V) {
  float pxmm = length(P - camPos) * pxAng;
  float front = smoothstep(0.1, -0.35, N.y);
  // the weave (faded out where it would alias) and the cotton's slight unevenness
  float wv = sin(P.x * 2.4 + 0.7 * sin(P.z * 0.31)) * sin(P.z * 2.4);
  wv *= 1.0 - smoothstep(0.22, 0.6, pxmm);
  float tw = snoise(P.xz * vec2(0.9, 0.12)) * (1.0 - smoothstep(0.6, 1.6, pxmm));
  float soak = 0.5 + 0.5 * snoise(P.xz * 0.018 + 7.0);
  vec3 alb = T_HALIDE * 0.62 * (0.94 + 0.04 * wv + 0.03 * tw);
  // the placket's seams and the buttons (front only)
  float zTop = mode < 0.5 ? -120.0 : -236.0;
  float sx = abs(abs(P.x) - 17.0);
  float seam = (1.0 - smoothstep(0.0, 0.7 + pxmm, sx)) * step(P.z, zTop + 40.0) * front;
  alb *= 1.0 - 0.32 * seam;
  float zb = zTop - 30.0 - 95.0 * floor((zTop - 30.0 - P.z + 47.5) / 95.0);
  float br = length(vec2(P.x, P.z - zb));
  float bt = (1.0 - smoothstep(5.2, 5.9 + pxmm, br)) * front * step(P.z, zTop);
  float rim = smoothstep(3.0, 5.0, br) * bt;
  float sh = keyShadow(P + N * 1.5);
  vec3 E = lightAt(P, N, V, sh);
  // the glow bleeding into the cloth round the bloom
  float bm = bloomMask(P);
  E += T_LUMINOL * glowK * 0.1 * smoothstep(0.0, 0.6, bm) * front;
  vec3 col = alb * (E + 0.0025);
  col = mix(col, T_HALIDE * 0.5 * (E + 0.003) * (1.0 - 0.3 * rim), bt);
  // a little sheen on the cotton under the key
  vec3 L = normalize(KEYP - P), H = normalize(L + V);
  col += vec3(0.012) * ggx(N, H, 0.6) * keyK * keyCone(P) * sh;
  // the luminol
  float wvB = 0.8 + 0.2 * wv + 0.12 * (soak - 0.5);
  col += T_LUMINOL * glowK * bm * wvB * front * (1.0 - 0.8 * bt) * 1.55;
  return col;
}

vec3 shadeGlove(vec3 P, vec3 N, vec3 V, float o) {
  vec3 L = normalize(KEYP - P), Hh = normalize(L + V);
  vec3 E = lightAt(P, N, V, 1.0);
  float nv = max(dot(N, V), 0.0);
  vec3 alb = T_SILVER * 0.09;
  float spec = ggx(N, Hh, 0.62) * (0.04 + 0.2 * pow(1.0 - nv, 5.0)) * 0.6 * keyK * keyCone(P);
  // the glow behind catches the glove's edges a little (cool, matte)
  return (alb * (E * 1.25 + 0.004) + T_LIGHTBOX * spec) * mix(1.0, o, 0.5);
}
vec3 shadePenHand(vec3 P, vec3 rd, int m) {
  vec3 q = toH(P);
  vec3 nl = nrmH(q);
  if (m == 0) {
    const float e = 0.25;
    vec3 g = vec3(wrinkle(q + vec3(e, 0.0, 0.0)) - wrinkle(q - vec3(e, 0.0, 0.0)), wrinkle(q + vec3(0.0, e, 0.0)) - wrinkle(q - vec3(0.0, e, 0.0)), wrinkle(q + vec3(0.0, 0.0, e)) - wrinkle(q - vec3(0.0, 0.0, e))) / (2.0 * e);
    g -= nl * dot(g, nl);
    nl = normalize(nl - g * 0.9);
  }
  vec3 N = fromH(nl), V = -rd;
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) { float h = 1.1 * float(i * i); o += w * (h - sdHq(q + nl * h)); w *= 0.55; }
  o = clamp(1.0 - 0.09 * o, 0.0, 1.0);
  if (m == 0) return shadeGlove(P, N, V, o);
  vec3 L = normalize(KEYP - P), Hh = normalize(L + V);
  vec3 E = lightAt(P, N, V, 1.0);
  float kc = keyK * keyCone(P);
  if (m == 3) return T_SILVER * (0.9 + 0.1 * sin(q.x * 9.0)) * (ggx(N, Hh, 0.32) * 0.45 * kc + 0.45 * E + 0.003);
  if (m == 2) return T_HALIDE * 0.8 * (ggx(N, Hh, 0.2) * 0.5 * kc + 0.06 * E + 0.002);
  if (m == 1) return T_FILM * (E * 0.8 + 0.01) + T_LIGHTBOX * ggx(N, Hh, 0.45) * 0.03 * kc;
  return T_FILM2 * 1.6 * (E + 0.01);
}
vec3 shadeSprayHand(vec3 P, vec3 rd, int m) {
  vec3 q = toQ(P);
  vec3 nl = nrmQ(q);
  vec3 N = fromQ(nl), V = -rd;
  if (m == 0) return shadeGlove(P, N, V, 1.0);
  vec3 L = normalize(KEYP - P), Hh = normalize(L + V);
  vec3 E = lightAt(P, N, V, 1.0);
  float kc = keyK * keyCone(P);
  if (m == 4) return T_FILM2 * 1.6 * (E + 0.01);
  if (m == 6) return T_FILM * (E + 0.01);
  // white HDPE: diffuse, a broad soft sheen; the cap ribbed
  float rib = (q.z < -32.0 && q.z > -54.0) ? 0.85 + 0.15 * sin(atan(q.y, q.x + 42.0) * 60.0) : 1.0;
  return T_HALIDE * 0.7 * rib * (E + 0.003) + vec3(0.05) * ggx(N, Hh, 0.35) * kc;
}

// ---------------------------------------------------------------- the bag
float bagH(vec2 b) {
  float h = 1.5 * snoise(b * 0.0052 + 1.7) + 0.45 * snoise(b * 0.016 + 4.2);
  // two storage creases (the bag was folded in half, then in half again)
  h -= 1.1 * exp(-pow(b.y + 330.0 + 0.04 * b.x, 2.0) / 40.0);
  h -= 0.8 * exp(-pow(b.x - 12.0 + 0.03 * b.y, 2.0) / 30.0);
  return h;
}
vec3 bagN(vec2 b) {
  float e = 1.5;
  float h0 = bagH(b);
  vec2 g = vec2(bagH(b + vec2(e, 0.0)) - h0, bagH(b + vec2(0.0, e)) - h0) / e;
  return normalize(vec3(-g.x * 0.5, -1.0, -g.y * 0.5));
}
float bagIb(vec2 b) { vec2 d = b - bloomBag(); return glowK * exp(-dot(d, d) / (2.0 * 175.0 * 175.0)); }
// a clear polyethylene panel over what is behind it: transmission, a little haze lit by the glow, the frosted heat
// seals, the key's crisp crinkled reflection
vec3 panel(vec3 behind, vec3 P, vec2 b, vec3 rd, float topOpen) {
  vec3 N = bagN(b);
  vec3 V = -rd;
  float nv = abs(dot(N, V));
  float F = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  float de = min(${f(BAG.hw)} - abs(b.x), b.y + ${f(BAG.h)});
  de = min(de, mix(1e3, -b.y, topOpen));
  float frost = 1.0 - smoothstep(5.0, 7.5, de);
  float Ib = bagIb(b);
  vec3 L = normalize(KEYP - P), H = normalize(L + V);
  float kc = keyK * keyCone(P);
  float sp = (pow(max(dot(N, H), 0.0), 1600.0) * 7.0 + pow(max(dot(N, H), 0.0), 120.0) * 0.08) * (0.3 + F) * kc * 2.2;
  sp += flashK * pow(nv, 900.0) * 1.2;
  sp = min(sp, 0.8);
  vec3 col = behind * (0.87 - 0.3 * frost) * (1.0 - F);
  col += T_LUMINOL * Ib * (0.012 + 0.06 * frost);
  col += vec3(0.02 + 0.05 * frost) * (kc * max(dot(vec3(0.0, -1.0, 0.0), L), 0.0) + flashK);
  col += vec3(sp) * vec3(0.92, 0.96, 1.0);
  return col;
}

vec3 shade(vec2 px) {
  vec2 ndc = px / res * 2.0 - 1.0;
  vec4 qq = invVP * vec4(ndc, 1.0, 1.0);
  vec3 ro = camPos, rd = normalize(qq.xyz / qq.w - camPos);

  // ---- the planes, and their textures (sampled here, in uniform control flow)
  float tF = rd.y > 1e-4 ? (BAG_Y - ro.y) / rd.y : -1.0;
  vec3 PF = ro + rd * tF;
  vec2 bv = vec2(PF.x, PF.z - BAG_Z0);
  vec2 auv = (tileO + vec2((clamp(bv.x, -${f(BAG.hw)}, ${f(BAG.hw)}) + ${f(BAG.hw)}) * ${f(APPM)}, clamp(-bv.y, 0.0, ${f(BAG.h)}) * ${f(APPM)})) / ATLAS;
  float cov = texture(lyrTex, auv).r;
  float caa = max(fwidth(cov), 0.004);
  vec2 luv = vec2((bv.x - ${f(LABEL.u0)}) / ${f(LABEL.w)}, (${f(LABEL.v0)} - bv.y) / ${f(LABEL.h)});
  vec3 labC = texture(labTex, clamp(luv, 0.0, 1.0)).rgb;
  // the seal flap: hinged on the top edge; flapA 0 = standing up open, pi = folded down over the face
  vec3 hingeO = vec3(0.0, BAG_Y - 0.8, BAG_Z0);
  vec3 fdir = vec3(0.0, -sin(flapA), cos(flapA)), fn = vec3(0.0, cos(flapA), sin(flapA));
  float fdn = dot(rd, fn);
  float tFl = abs(fdn) > 1e-4 ? dot(hingeO - ro, fn) / fdn : -1.0;
  vec3 PFl = ro + rd * tFl;
  float fs = dot(PFl - hingeO, fdir);
  vec2 suv = vec2((PFl.x + ${f(FLAP.hw)}) / ${f(FLAP.hw * 2)}, fs / ${f(FLAP.h)});
  vec3 sealC = texture(sealTex, clamp(suv, 0.0, 1.0)).rgb;

  // ---- the opaque scene
  int ms, mh, mq;
  float tS = marchS(ro, rd, ms);
  float tH = marchPen(ro, rd, mh);
  float tQ = marchSpray(ro, rd, mq);
  // the rail (steel tube) and the bag's wire: cylinders along x
  float tR = 1e9, tWi = 1e9;
  {
    vec2 o = ro.yz - vec2(0.0, 62.0), d = rd.yz;
    float a = dot(d, d), bb = dot(o, d), c = dot(o, o) - 13.0 * 13.0, h = bb * bb - a * c;
    if (h > 0.0) { float t = (-bb - sqrt(h)) / a; if (t > 0.0) tR = t; }
    o = ro.yz - vec2(BAG_Y + 3.0, -58.0); bb = dot(o, d); c = dot(o, o) - 1.6 * 1.6; h = bb * bb - a * c;
    if (h > 0.0) { float t = (-bb - sqrt(h)) / a; if (t > 0.0) tWi = t; }
  }
  float tWall = rd.y > 1e-4 ? (900.0 - ro.y) / rd.y : 1e9;
  float tO = min(min(min(tS, tH), min(tQ, tR)), min(tWi, tWall));
  vec3 V = -rd;
  vec3 col = vec3(0.0);
  if (tO > 1e8) col = vec3(0.0);
  else if (tO == tS) {
    vec3 P = ro + rd * tS; vec3 N = nrmS(P);
    if (ms == 1) col = shadeShirt(P, N, V);
    else {
      vec3 L = normalize(KEYP - P), H = normalize(L + V);
      vec3 E = lightAt(P, N, V, keyShadow(P + N * 1.0));
      float kc = keyK * keyCone(P);
      col = ms == 2 ? T_SILVER * 0.35 * (E + 0.003) + T_LIGHTBOX * ggx(N, H, 0.22) * 0.05 * kc
                    : T_FILM2 * (E + 0.005) + T_LIGHTBOX * ggx(N, H, 0.3) * 0.04 * kc;
    }
  } else if (tO == tH) col = shadePenHand(ro + rd * tH, rd, mh);
  else if (tO == tQ) col = shadeSprayHand(ro + rd * tQ, rd, mq);
  else if (tO == tR || tO == tWi) {
    vec3 P = ro + rd * tO;
    vec2 c = tO == tR ? vec2(0.0, 62.0) : vec2(BAG_Y + 3.0, -58.0);
    vec3 N = normalize(vec3(0.0, P.yz - c));
    vec3 L = normalize(KEYP - P), H = normalize(L + V);
    vec3 E = lightAt(P, N, V, 1.0);
    col = T_SILVER * 0.3 * (E + 0.003) + T_LIGHTBOX * ggx(N, H, 0.18) * 0.06 * keyK * keyCone(P);
  } else {
    // the far wall: matte, dark; the key's hard pool on it with the shirt's shadow
    vec3 P = ro + rd * tWall;
    vec3 N = vec3(0.0, -1.0, 0.0);
    float kc = keyCone(P);
    float sh = kc > 0.001 ? keyShadow(P) : 0.0;
    vec3 alb = vec3(0.022, 0.024, 0.03) * (0.9 + 0.1 * snoise(P.xz * 0.004));
    col = alb * lightAt(P, N, V, sh) + T_FILM * 0.12;
  }

  // ---- the bag's back panel, then its printed front panel, then the seal flap
  float tBk = rd.y > 1e-4 ? ((mode < 0.5 ? BAG_Y + 14.0 : -40.0) - ro.y) / rd.y : -1.0;
  if (tBk > 0.0 && tBk < tO) {
    vec3 P = ro + rd * tBk; vec2 b = vec2(P.x, P.z - BAG_Z0);
    if (abs(b.x) < ${f(BAG.hw)} && b.y < 0.0 && b.y > -${f(BAG.h)}) col = panel(col, P, b + 37.0, rd, 0.0);
  }
  bool onBag = tF > 0.0 && tF < tO && abs(bv.x) < ${f(BAG.hw)} && bv.y < 0.0 && bv.y > -${f(BAG.h)};
  if (onBag) {
    col = panel(col, PF, bv, rd, 1.0 - mode);
    float Ib = bagIb(bv);
    vec3 L = normalize(KEYP - PF);
    float kf = keyK * keyCone(PF) * max(-L.y, 0.0);
    // the printed lyric: white ink, lit from behind by the glow (rose in wax)
    vec4 st = vec4(0.0);
    vec4 rr = vec4(0.0);
    for (int k = 0; k < 4; k++) {
      vec4 r = wR[k];
      if (bv.x > r.x && bv.x < r.z && bv.y < r.y && bv.y > r.w) { st = wS[k]; }
    }
    float a = smoothstep(st.y - caa, st.y + caa, cov) * st.x;
    vec3 inkC = mix(mix(T_LIGHTBOX, T_LUMINOL, 0.28), T_WAX, st.w);
    vec3 ink = inkC * min(0.8, (0.2 + 0.45 * Ib) * st.z + 0.5 * kf + 0.55 * flashK);
    col = mix(col, ink, a * 0.94);
    // the label: opaque paper, front-lit by the key, the glow faintly through it
    float la = step(0.0, luv.x) * step(luv.x, 1.0) * step(0.0, luv.y) * step(luv.y, 1.0);
    vec3 lab = pow(labC, vec3(2.2));
    vec3 labCol = lab * (0.85 * kf + 0.8 * flashK + 0.004) + lab * T_LUMINOL * Ib * 0.06;
    col = mix(col, labCol, la);
  }
  if (tFl > 0.0 && tFl < tO && abs(PFl.x) < ${f(FLAP.hw)} && fs > 0.0 && fs < ${f(FLAP.h)}) {
    vec3 N = fn; if (dot(N, rd) > 0.0) N = -N;
    vec3 L = normalize(KEYP - PFl);
    float kf = keyK * keyCone(PFl) * max(dot(N, L), 0.0);
    vec3 alb = pow(sealC, vec3(2.2)) * 0.82;
    vec3 sc = alb * (kf + 0.9 * flashK * max(dot(N, V), 0.0) + 0.004) + alb * T_LUMINOL * bagIb(vec2(PFl.x, PFl.z - BAG_Z0)) * 0.05;
    // the tape's own slight sheen
    vec3 H = normalize(L + V);
    sc += vec3(0.03) * ggx(N, H, 0.35) * keyK * keyCone(PFl);
    col = sc;
  }
  return col;
}

void main() {
  vec3 c = vec3(0.0);
  for (int k = ssK0(); k < ssK1(); k++) c += shade(gl_FragCoord.xy + rgss(k) * PX_SCALE);
  fragColor = vec4(c * ssWeight(), 1.0);
}
`;
