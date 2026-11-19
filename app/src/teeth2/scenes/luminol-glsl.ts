// Plate 11 `luminol`: the frame shader. A film-black evidence room: a man's dark shirt on a wire hanger on a steel rail,
// a thin clear polyethylene evidence bag hanging from two clips on a wire just in front of it. There is no key light:
// the plate is lit only by the reaction (the luminol patch soaked into the weave over the left chest, which lights the
// folds round it, the bag's face and the gloves locally) plus one constant, dim, cold ambient (a dome, brighter from
// above, the same in every shot). Mode 0: the shirt on the hanger; mode 1: the shirt folded inside the sealed bag (a
// hard cut: no cloth fold), the empty hanger behind. Ray-traced in one pass: the shirt, hanger and clips as one SDF,
// the two gloved hands as SDFs in their own frames, the rail and wire as cylinders, the bag's two panels and its seal
// flap as planes (printed lyric, label and seal from textures). Units: mm, world z up, y away from the camera's side,
// x right; the bag's front panel is the plane y = -150, its top edge at z = -150 (below the collar and shoulders).
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL } from '../../engine/gl';
import { GLSL_HANDS } from './luminol-hands';
import { BAG, APPM, TILE_W, TILE_H, ATLAS_C, ATLAS_R, LABEL, FLAP } from './luminol-type';

const f = (x: number) => x.toFixed(3);

export const LUM_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
uniform mat4 invVP; uniform vec3 camPos; uniform vec2 res; uniform float pxAng;
uniform float mode, glowK, glowR, flapA;
uniform sampler2D lyrTex, labTex, sealTex;
uniform vec2 tileO;
uniform vec4 wR[4]; uniform vec4 wS[4];
uniform float sprayOn, sPull; uniform vec3 sTip, sE1, sE2, sE3;
uniform float handOn; uniform vec3 hTip, hE1, hE2, hE3;

const float BAG_Y = -150.0, BAG_Z0 = -150.0;
const vec3 SLO = vec3(-345.0, -178.0, -800.0), SHI = vec3(345.0, 95.0, 88.0);
const vec2 ATLAS = vec2(${f(TILE_W * ATLAS_C)}, ${f(TILE_H * ATLAS_R)});
// the one ambient: cold, dim, constant (a dome brighter from above)
const vec3 AMBC = vec3(0.78, 0.88, 1.0);
const float AMBK = 0.24;

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
// half width: chest under the arms, a slight waist, the tails; half thickness: full at the hanger, flat below
float hwAt(float z) { return 214.0 - 12.0 * smoothstep(-240.0, -460.0, z) + 9.0 * smoothstep(-500.0, -720.0, z); }
float htAt(float z) { return mix(50.0, 17.0, smoothstep(-110.0, -520.0, z)); }
// the shoulder line: from the collar base down the hanger's arms to the seam, then over the sleeve head
float shZ(float ax) { return -42.0 - max(ax - 58.0, 0.0) * 0.62; }
float folds(vec3 p) {
  float lo = smoothstep(-200.0, -660.0, p.z);
  float ax = abs(p.x);
  // long vertical drape folds, deeper toward the hem, wandering a little
  float f = sin(p.x * 0.041 + 1.6 * sin(p.z * 0.0043 + 0.6)) * (1.1 + 3.4 * lo);
  f += sin(p.x * 0.087 + 2.3 + 0.9 * sin(p.z * 0.0065 + 1.1)) * (0.4 + 1.8 * lo);
  // the drag from the hanger's ends: diagonal folds from the shoulder points toward the middle
  f += 2.6 * sin((ax * 0.85 + p.z) * 0.026) * smoothstep(100.0, 200.0, ax) * smoothstep(-120.0, -240.0, p.z) * (1.0 - lo);
  // a shallow V of drape under the collar
  f += 1.6 * sin((ax * 0.9 - p.z * 0.55) * 0.034) * smoothstep(40.0, 90.0, ax) * (1.0 - smoothstep(150.0, 200.0, ax)) * smoothstep(-110.0, -170.0, p.z) * (1.0 - smoothstep(-260.0, -330.0, p.z));
  return f;
}
float zb0() { return mode < 0.5 ? -120.0 : -331.0; }
// the placket's line: the shirt's middle (folded, the bundle lies right of the label, a little askew)
float pkX() { return mode < 0.5 ? 0.0 : 75.0; }
float btnDist(vec3 p) {
  float zt = zb0() - 30.0;
  float zb = zt - 95.0 * floor((zt - p.z + 47.5) / 95.0);
  return p.z > zt + 47.5 ? 1e3 : length(vec2(p.x - pkX(), p.z - zb));
}
float sdTorso(vec3 p) {
  float hw = hwAt(p.z), ht = htAt(p.z);
  float qx = abs(p.x) - (hw - ht);
  float cr = (qx > 0.0 ? length(vec2(qx, p.y)) : abs(p.y)) - ht;
  float top = (p.z - shZ(abs(p.x))) * 0.85;
  float hem = (-768.0 + 95.0 * (p.x * p.x) / (240.0 * 240.0)) - p.z;
  float d = smax(cr, top, 18.0);
  // the neck opening inside the collar (dark, the back of the collar inside it)
  float neck = max((length(vec2(p.x / 60.0, (p.y - 4.0) / 44.0)) - 1.0) * 44.0, -170.0 - p.z);
  d = max(d, -neck);
  d = smax(d, hem, 5.0);
  d += folds(p);
  // the button placket (a raised double layer down the front) and its buttons
  float fr = step(p.y, 0.0) * step(p.z, -112.0);
  d -= fr * 1.3 * (1.0 - smoothstep(15.5, 18.5, abs(p.x)));
  d -= fr * 1.6 * (1.0 - smoothstep(4.6, 6.0, btnDist(p)));
  return d;
}
float sdSleeves(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y * 1.5, p.z);
  vec3 a = vec3(214.0, -6.0, -142.0), b = vec3(244.0, -18.0, -648.0);
  float s = rcap(q, a, b, 47.0, 35.0);
  vec3 ax = normalize(b - a);
  float cuff = rcap(q, b, b + ax * 62.0, 37.5, 37.0);
  s = min(s, cuff);
  // slack: soft horizontal creases where the sleeve hangs, and a twist at the elbow
  s += 1.7 * sin(q.z * 0.047 + q.x * 0.03) * smoothstep(-220.0, -380.0, q.z);
  s += 1.1 * sin(q.z * 0.11 + 1.3) * smoothstep(-420.0, -520.0, q.z) * (1.0 - smoothstep(-560.0, -620.0, q.z));
  return s * 0.64;
}
float sdCollar(vec3 p) {
  vec3 q = p - vec3(0.0, 4.0, 0.0);
  float e = length(vec2(q.x / 68.0, q.y / 52.0));
  float rad = (e - 1.0) * 58.0;
  float stand = sdBox(vec2(rad, q.z + 36.0), vec2(3.2, 15.0)) - 1.4;
  // the fall: the outer leaf round the back and sides, folded down over the stand
  float th = atan(q.x, -q.y);
  float leaf = max(abs(rad - 6.5) - 2.4, max(q.z + 17.0, -52.0 - q.z));
  leaf = max(leaf, (0.55 - abs(th)) * 40.0);
  // the two points lying on the chest, their tips lifted a little off it
  vec2 xz = vec2(abs(p.x), p.z);
  float tri = sdTri(xz, vec2(12.0, -36.0), vec2(82.0, -46.0), vec2(48.0, -128.0)) - 1.5;
  float lift = 5.0 * smoothstep(-70.0, -128.0, p.z);
  float yf = -htAt(p.z) - 4.0 - lift;
  float pts = max(tri, abs(p.y - yf) - 2.6);
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
  float hd = rcap(hq, vec3(0.0, 0.0, 10.0), vec3(-3.0, 0.0, -118.0 - BAG_Z0 - 3.0), 1.1, 1.1);
  return min(body, hd);
}
// ---------------------------------------------------------------- the shirt folded in the sealed bag (mode 1)
const vec3 FC = vec3(70.0, -72.0, -511.0);
const float COLZ = -295.0;
float sdFolded(vec3 p) {
  vec3 r = p - FC;
  // a soft folded bundle: pillowed in the middle, the sleeves folded in behind (two grooves), lumpy
  float pil = 7.0 * max(1.0 - r.x * r.x / (165.0 * 165.0), 0.0) * max(1.0 - r.z * r.z / (270.0 * 270.0), 0.0);
  float slab = sdBox3(r, vec3(165.0, 12.0, 270.0)) - 14.0 - pil;
  slab += 1.6 * snoise(p.xz * 0.012 + 3.0) + 2.4 * exp(-pow(abs(r.x) - 108.0, 2.0) / 40.0) * step(p.y, FC.y);
  slab += 1.4 * exp(-pow(p.z + 563.0 + 0.03 * p.x, 2.0) / 60.0);
  // the collar, squashed flat by the bag: the fall round the back (an arch), and its two points lying down the front
  vec2 c = vec2(p.x - 75.0, p.z - COLZ);
  c.y += 0.07 * c.x + 1.2 * snoise(c * 0.02 + 1.0);
  float eo = length(c / vec2(86.0, 38.0)), ei = length(c / vec2(64.0, 22.0));
  float arch = max(max((eo - 1.0) * 36.0, (1.0 - ei) * 22.0), -(c.y + 4.0));
  float yTop = FC.y - 26.0 - pil;
  float band = max(arch, abs(p.y - (yTop - 5.0)) - 5.5) - 1.0;
  float s = sign(p.x - 75.0);
  vec2 xz = vec2(abs(p.x - 75.0), p.z - COLZ);
  vec2 tip = vec2(50.0 + 6.0 * s, -84.0 + 9.0 * s);
  float tri = sdTri(xz, vec2(13.0, -10.0), vec2(86.0, -2.0), tip) - 1.5;
  float pts = max(tri, abs(p.y - (yTop - 2.5)) - 2.4);
  return min(slab, min(band, pts));
}

float mapS(vec3 p, out int m) {
  float d; m = 1;
  if (mode < 0.5) d = smin(min(sdTorso(p), sdCollar(p)), sdSleeves(p), 6.0);
  else d = sdFolded(p);
  float h = sdHanger(p); if (h < d) { d = h; m = 2; }
  float c = sdClips(p); if (c < d) { d = c; m = 3; }
  return d;
}
float mapSD(vec3 p) { int m; return mapS(p, m); }
float mapAO(vec3 p) { return mode < 0.5 ? smin(min(sdTorso(p), sdCollar(p)), sdSleeves(p), 6.0) : sdFolded(p); }
float marchS(vec3 ro, vec3 rd, out int m) {
  m = -1;
  vec2 bh = boxHit(ro, rd, SLO, SHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1e9;
  float t = max(bh.x, 0.0);
  for (int i = 0; i < 150; i++) {
    if (t > bh.y) break;
    int mm;
    vec3 p = ro + rd * t;
    float h = mapS(p, mm);
    if (h < 0.06 + t * 0.00025) { m = mm; return t; }
    t += h * 0.75;
  }
  return 1e9;
}
vec3 nrmS(vec3 p) {
  const vec2 k = vec2(1.0, -1.0); const float e = 0.25;
  return normalize(k.xyy * mapSD(p + k.xyy * e) + k.yyx * mapSD(p + k.yyx * e) + k.yxy * mapSD(p + k.yxy * e) + k.xxx * mapSD(p + k.xxx * e));
}
// the cloth's occlusion (the creases, the sleeves against the body, under the collar)
float aoS(vec3 P, vec3 N) {
  float o = 0.0, w = 1.0;
  for (int i = 0; i < 4; i++) {
    float h = 4.0 + 18.0 * float(i * i);
    o += w * clamp((h - mapAO(P + N * h)) / h, 0.0, 1.0);
    w *= 0.6;
  }
  return clamp(1.0 - 0.62 * o, 0.04, 1.0);
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

// ---------------------------------------------------------------- light: the ambient and the reaction, nothing else
vec3 bloomW() { return mode < 0.5 ? vec3(110.0, -55.0, -335.0) : vec3(128.0, -104.0, -369.0); }
float ggx(vec3 N, vec3 H, float rough) {
  float a2 = rough * rough * rough * rough, nh = max(dot(N, H), 0.0);
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * dd * dd);
}
vec3 amb(vec3 N, float o) { return AMBC * AMBK * (0.3 + 0.7 * (0.5 + 0.5 * N.z)) * o; }
// the reaction as a small soft area source lying on the cloth (wrapped: it is a patch, not a point)
vec3 glowL(vec3 P, vec3 N) {
  vec3 G = bloomW() - P; float d = max(length(G), 1.0);
  return T_LUMINOL * glowK * 0.85 * clamp(dot(N, G / d) * 0.8 + 0.2, 0.0, 1.0) / (1.0 + d * d / (105.0 * 105.0));
}
vec3 glowSpec(vec3 P, vec3 N, vec3 V, float rough) {
  vec3 G = bloomW() - P; float d = max(length(G), 1.0);
  vec3 L = G / d, H = normalize(L + V);
  return T_LUMINOL * glowK * ggx(N, H, rough) * max(dot(N, L), 0.0) / (1.0 + d * d / (105.0 * 105.0));
}
// the stain: one irregular patch soaked into the weave over the left chest (~150 x 175 mm), broken by the threads and
// the folds, with a faint wicked fringe; fixed in place, only its brightness changes
float bloomMask(vec3 P) {
  vec2 d = P.xz - bloomW().xz;
  vec2 w = d + 17.0 * vec2(snoise(d * 0.009 + 1.3), snoise(d * 0.009 + 7.7));
  float r = length(w / (vec2(76.0, 88.0) * glowR));
  float n = 0.6 * snoise(w * 0.019 + 2.0) + 0.3 * snoise(w * 0.047 + 5.0) + 0.07 * snoise(w * 0.12 + 9.0);
  float e = r + 0.3 * n;
  float core = 1.0 - smoothstep(0.74, 1.0, e);
  // a faint tide line where the soak stopped, and a little wicking past it along the threads
  float tide = exp(-pow((e - 0.94) / 0.05, 2.0)) * 0.22;
  float wick = (1.0 - smoothstep(0.95, 1.3, e)) * 0.08;
  return core * (0.62 + 0.38 * (1.0 - smoothstep(0.0, 0.95, r))) + tide + wick;
}

vec3 shadeShirt(vec3 P, vec3 N, vec3 V) {
  float pxmm = length(P - camPos) * pxAng;
  float front = smoothstep(0.15, -0.35, N.y);
  // the weave (faded out where it would alias) and the cotton's slub
  float wv = sin(P.x * 2.4 + 0.7 * sin(P.z * 0.31)) * sin(P.z * 2.4);
  wv *= 1.0 - smoothstep(0.22, 0.6, pxmm);
  float tw = snoise(P.xz * vec2(0.9, 0.12)) * (1.0 - smoothstep(0.6, 1.6, pxmm));
  vec3 alb = mix(T_SILVER, T_FILM2, 0.3) * 0.46 * (0.93 + 0.05 * wv + 0.04 * tw);
  // the placket's stitch lines and the buttons
  float zTop = zb0();
  float sx = abs(abs(P.x - pkX()) - 17.0);
  float seam = (1.0 - smoothstep(0.0, 0.7 + pxmm, sx)) * step(P.z, zTop + 40.0) * front;
  alb *= 1.0 - 0.4 * seam;
  float br = btnDist(P);
  float bt = (1.0 - smoothstep(5.0, 5.8 + pxmm, br)) * front;
  // the inside of the folded collar's arch (mode 1): the back of the neck, in shadow
  if (mode > 0.5) {
    vec2 c = vec2(P.x - 75.0, P.z - COLZ); c.y += 0.07 * c.x + 1.2 * snoise(c * 0.02 + 1.0);
    alb *= 1.0 - 0.6 * step(length(c / vec2(64.0, 22.0)), 1.0) * step(-4.0, c.y);
  }
  float o = aoS(P, N);
  vec3 E = amb(N, o) + glowL(P, N) * (0.4 + 0.6 * o);
  vec3 col = alb * E;
  col = mix(col, T_HALIDE * 0.06 * E, bt * 0.8);
  // a faint cotton sheen from the dome at grazing angles (shapes the folds' edges)
  float nv = max(dot(N, V), 0.0);
  col += AMBC * AMBK * 0.02 * pow(1.0 - nv, 3.0) * o * (0.5 + 0.5 * N.z);
  col += glowSpec(P, N, V, 0.55) * 0.012 + glowSpec(P, N, V, 0.25) * 0.02 * bt;
  // the luminol, in the cloth: crests brighter than the valleys, the threads breaking it up
  float bm = bloomMask(P);
  float fv = folds(P);
  float brk = (0.62 + 0.38 * smoothstep(2.5, -2.5, fv)) * (0.78 + 0.22 * wv) * (0.88 + 0.12 * snoise(P.xz * 0.11 + 4.0));
  col += T_LUMINOL * glowK * bm * brk * front * (1.0 - 0.85 * bt) * (0.6 + 0.4 * o) * 1.15;
  return col;
}

vec3 shadeGlove(vec3 P, vec3 N, vec3 V, float o) {
  // matte nitrile (the match plate's glove): a dark diffuse body, a broad soft sheen where the glow catches it
  vec3 alb = T_SILVER * 0.09;
  vec3 E = amb(N, o) + glowL(P, N);
  float nv = max(dot(N, V), 0.0);
  vec3 sp = glowSpec(P, N, V, 0.62) * (0.05 + 0.2 * pow(1.0 - nv, 5.0));
  return alb * E * 1.3 + sp * 0.5 + alb * AMBC * AMBK * 0.25 * pow(1.0 - nv, 4.0) * o;
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
  vec3 E = amb(N, o) + glowL(P, N);
  vec3 R = reflect(rd, N);
  float env = AMBK * (0.1 + 0.9 * smoothstep(-0.2, 0.9, R.z));
  if (m == 3) return T_SILVER * (0.9 + 0.1 * sin(q.x * 9.0)) * (0.35 * E + env * 0.25) + glowSpec(P, N, V, 0.3) * 0.25;
  if (m == 2) return T_HALIDE * 0.8 * (0.1 * E + env * 0.2) + glowSpec(P, N, V, 0.2) * 0.3;
  if (m == 1) return T_FILM * E * 0.8 + glowSpec(P, N, V, 0.45) * 0.03;
  return T_FILM2 * 0.9 * E;
}
vec3 shadeSprayHand(vec3 P, vec3 rd, int m) {
  vec3 q = toQ(P);
  vec3 nl = nrmQ(q);
  vec3 N = fromQ(nl), V = -rd;
  if (m == 0) return shadeGlove(P, N, V, 1.0);
  vec3 E = amb(N, 1.0) + glowL(P, N);
  if (m == 4) return T_FILM2 * 0.9 * E;
  if (m == 6) return T_FILM * E;
  // white HDPE: diffuse, a broad soft sheen; the cap ribbed
  float rib = (q.z < -32.0 && q.z > -54.0) ? 0.85 + 0.15 * sin(atan(q.y, q.x + 42.0) * 60.0) : 1.0;
  return T_HALIDE * 0.38 * rib * E + glowSpec(P, N, V, 0.35) * 0.05;
}

// ---------------------------------------------------------------- the bag: thin polyethylene, crinkled
float bagH(vec2 b) {
  float h = 1.4 * snoise(b * 0.0052 + 1.7) + 0.45 * snoise(b * 0.016 + 4.2);
  // the crinkles: soft ridges at two scales
  h += 0.9 * (1.0 - abs(snoise(b * vec2(0.012, 0.017) + 9.1))) + 0.12 * (1.0 - abs(snoise(b * 0.05 + 3.3)));
  // two storage creases (the bag was folded in half, then in half again)
  h -= 1.1 * exp(-pow(b.y + 330.0 + 0.04 * b.x, 2.0) / 40.0);
  h -= 0.8 * exp(-pow(b.x - 12.0 + 0.03 * b.y, 2.0) / 30.0);
  return h;
}
vec3 bagN(vec2 b) {
  float e = 1.2;
  float h0 = bagH(b);
  vec2 g = vec2(bagH(b + vec2(e, 0.0)) - h0, bagH(b + vec2(0.0, e)) - h0) / e;
  return normalize(vec3(-g.x * 0.85, -1.0, -g.y * 0.85));
}
// the bag's outline: soft, not ruled (the film is thin and hangs from two clips; the open top sags between them)
float bagEdge(vec2 b, float topOpen) {
  float hw = ${f(BAG.hw)} + 3.0 * sin(b.y * 0.021 + 1.0) + 1.8 * sin(b.y * 0.047);
  float bot = b.y + ${f(BAG.h)} - 4.0 * sin(b.x * 0.017 + 0.5);
  float top = -b.y - topOpen * 11.0 * max(1.0 - b.x * b.x / (222.0 * 222.0), 0.0);
  return min(min(hw - abs(b.x), bot), top);
}
// how much of the reaction's light reaches a point of the bag (it hangs ~90 mm in front of the stain)
float bagIb(vec3 P) { vec3 G = bloomW() - P; return glowK / (1.0 + dot(G, G) / (150.0 * 150.0)); }
// a clear polyethylene panel over what is behind it: transmission, the glow scattered in its crinkles and heat seals,
// the dim dome reflected in the crinkles (soft highlights, no key)
vec3 panel(vec3 behind, vec3 P, vec2 b, vec3 rd, float de) {
  vec3 N = bagN(b);
  vec3 V = -rd;
  float nv = abs(dot(N, V));
  float F = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  float frost = 1.0 - smoothstep(4.0, 7.0, de);
  float Ib = bagIb(P);
  float crk = clamp(length(N.xz) * 3.5, 0.0, 1.0);
  vec3 R = reflect(rd, N * sign(-dot(N, rd)));
  float env = AMBK * (0.02 + 1.4 * smoothstep(0.45, 0.95, R.z));
  vec3 col = behind * (0.88 - 0.3 * frost) * (1.0 - F);
  col += T_LUMINOL * Ib * (0.004 + 0.045 * frost + 0.03 * crk);
  col += AMBC * env * F * 0.8 + AMBC * AMBK * 0.03 * frost;
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
    o = ro.yz - vec2(BAG_Y + 3.0, -118.0); bb = dot(o, d); c = dot(o, o) - 1.6 * 1.6; h = bb * bb - a * c;
    if (h > 0.0) { float t = (-bb - sqrt(h)) / a; if (t > 0.0) tWi = t; }
  }
  float tO = min(min(min(tS, tH), tQ), min(tR, tWi));
  vec3 V = -rd;
  // the room: film-black
  vec3 col = T_FILM;
  if (tO > 1e8) col = T_FILM;
  else if (tO == tS) {
    vec3 P = ro + rd * tS; vec3 N = nrmS(P);
    if (ms == 1) col = shadeShirt(P, N, V);
    else {
      vec3 E = amb(N, 1.0) + glowL(P, N);
      vec3 R = reflect(rd, N);
      float env = AMBK * (0.1 + 0.9 * smoothstep(-0.2, 0.9, R.z));
      col = ms == 2 ? T_SILVER * (0.25 * E + 0.2 * env) + glowSpec(P, N, V, 0.22) * 0.15
                    : T_FILM2 * E + glowSpec(P, N, V, 0.3) * 0.05;
    }
  } else if (tO == tH) col = shadePenHand(ro + rd * tH, rd, mh);
  else if (tO == tQ) col = shadeSprayHand(ro + rd * tQ, rd, mq);
  else {
    vec3 P = ro + rd * tO;
    vec2 c = tO == tR ? vec2(0.0, 62.0) : vec2(BAG_Y + 3.0, -118.0);
    vec3 N = normalize(vec3(0.0, P.yz - c));
    vec3 R = reflect(rd, N);
    float env = AMBK * (0.05 + 0.95 * smoothstep(0.0, 0.95, R.z));
    col = T_SILVER * (0.2 * (amb(N, 1.0) + glowL(P, N)) + 0.25 * env) + glowSpec(P, N, V, 0.18) * 0.1;
  }

  // ---- the bag's back panel, then its printed front panel, then the seal flap
  float tBk = rd.y > 1e-4 ? ((mode < 0.5 ? BAG_Y + 14.0 : -40.0) - ro.y) / rd.y : -1.0;
  if (tBk > 0.0 && tBk < tO) {
    vec3 P = ro + rd * tBk; vec2 b = vec2(P.x, P.z - BAG_Z0);
    float de = bagEdge(b, 1.0 - mode);
    if (de > 0.0) col = panel(col, P, b + 37.0, rd, de);
  }
  float deF = bagEdge(bv, 1.0 - mode);
  bool onBag = tF > 0.0 && tF < tO && deF > 0.0;
  if (onBag) {
    col = panel(col, PF, bv, rd, deF);
    float Ib = bagIb(PF);
    // the printed lyric: white ink, lit only from behind by the glow (rose in wax)
    vec4 st = vec4(0.0);
    for (int k = 0; k < 4; k++) {
      vec4 r = wR[k];
      if (bv.x > r.x && bv.x < r.z && bv.y < r.y && bv.y > r.w) { st = wS[k]; }
    }
    float a = smoothstep(st.y - caa, st.y + caa, cov) * st.x;
    vec3 inkC = mix(mix(T_LIGHTBOX, T_LUMINOL, 0.3), T_WAX, st.w);
    vec3 Gk = bloomW() - PF; float Ik = glowK / (1.0 + dot(Gk, Gk) / (118.0 * 118.0));
    vec3 ink = inkC * min(0.85, (0.02 + 0.85 * Ik) * st.z);
    col = mix(col, ink, a * 0.94);
    // the label: opaque paper (the dome on its face), the glow coming through it from behind: the print in silhouette
    float la = step(0.0, luv.x) * step(luv.x, 1.0) * step(0.0, luv.y) * step(luv.y, 1.0);
    vec3 lab = pow(labC, vec3(2.2));
    vec3 labCol = lab * (AMBC * AMBK * 0.13 + mix(T_LUMINOL, T_LIGHTBOX, 0.25) * Ib * 0.5);
    col = mix(col, labCol, la);
  }
  if (tFl > 0.0 && tFl < tO && abs(PFl.x) < ${f(FLAP.hw)} && fs > 0.0 && fs < ${f(FLAP.h)}) {
    vec3 N = fn; if (dot(N, rd) > 0.0) N = -N;
    vec3 alb = pow(sealC, vec3(2.2)) * 0.82;
    vec3 sc = alb * (amb(N, 1.0) * 0.3 + glowL(PFl, N) * 0.8);
    // the tape's own slight sheen, from the dome
    vec3 R = reflect(rd, N);
    sc += AMBC * AMBK * 0.025 * smoothstep(0.0, 0.9, R.z);
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
