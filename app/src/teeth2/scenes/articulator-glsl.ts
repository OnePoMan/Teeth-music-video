// `articulator` shader: one ray-marched pass (then pour's depth-of-field gather).
// The set: a chrome semi-adjustable articulator on a matte black table, in front of a white seamless studio sweep that
// stands behind it (the card the chrome mirrors). The lower member is fixed (world = the kit's head frame), the upper
// member placed by `upInv` (world -> its local frame); the stone casts (the kit's sdCast) on trimmed plaster; a strip of
// black articulating paper between them. Light: one hard key (a spot above front-left), a long softbox strip overhead
// (the bright lines along the chrome's top edges), the sweep lit as a gradient pool, and its bounce as a rim from behind.
// The chrome is a mirror of that environment (one bounce into the set). The lyric is engraved in the two narrow
// chamfered crossbars: a film-black inset with a bevel edge, legible only where the moving reflection band (bandA on
// the upper bar, bandB on the lower) crosses the polished face; elsewhere the face is dark chrome with a soft gradient.
import { W, H, SS_TAP_GLSL } from '../../engine/gl';
import { GLSL_TEETH_PALETTE } from '../palette';
import { GLSL_TEETH } from '../teeth';
import { RIG, SWEEP } from './articulator-rig';

const f = (x: number) => x.toFixed(4);

export const ART_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${GLSL_TEETH}
${SS_TAP_GLSL}
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform mat4 upInv;
uniform sampler2D wordTex;
uniform float marksK;
uniform vec4 bandA, bandB;   // the reflection band on each bar: centre u (mm), half width, slant, intensity
uniform vec3 keyPos, keyDir; uniform float keyI, keyCone, keyRef, fillK, upLift;
const float TABLE_Y = ${f(RIG.TABLE_Y)};
const float FHW = ${f(RIG.FHW)}, FHH = ${f(RIG.FHH)}, LHH = ${f(RIG.LHH)}, CH = ${f(RIG.CH)}, BD = ${f(RIG.BD)};
const float TS = ${f(Math.sin(RIG.TILT))}, TC = ${f(Math.cos(RIG.TILT))};
const vec3 UBAR = vec3(0.0, ${f(RIG.FY)}, ${f(RIG.FZ)}), LBAR = vec3(0.0, ${f(RIG.LY)}, ${f(RIG.LZ)});
const float PZ = ${f(RIG.PZ)}, PTIP = ${f(RIG.PTIP)};
const float SW_Z1 = ${f(SWEEP.Z1)}, SW_ZC = ${f(SWEEP.ZC)}, SW_R = ${f(SWEEP.R)}, SW_X = ${f(SWEEP.X)}, SW_TOP = ${f(SWEEP.TOP)};
bool SHM = false;

float sdRBox(vec3 p, vec3 b, float r) { return sdBox3(p, b - r) - r; }
float cylY(vec3 p, float r, float h, float rr) {
  vec2 d = vec2(length(p.xz) - r + rr, abs(p.y) - h + rr);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rr;
}
// a box with its four long (x) edges chamfered at 45 degrees
float sdChamf(vec3 p, vec3 b, float c) {
  return max(sdBox3(p, b), (abs(p.y) + abs(p.z) - (b.y + b.z - c)) * 0.7071);
}
// a crossbar's frame: x along the bar, y up the tilted face, z out of the face (0 on the face)
vec3 barL(vec3 q, vec3 C) { vec3 d = q - C; return vec3(d.x, d.y * TC - d.z * TS, d.y * TS + d.z * TC); }
float barSD(vec3 q, vec3 C, float hh) { vec3 l = barL(q, C); l.z += BD; return sdChamf(l, vec3(FHW + CH, hh + CH, BD), CH); }

// ------------------------------------------------------------------ the machine
// The upper member is one T-shaped arm: a cross-piece on the condylar axle between the two rear posts, a single stem
// cantilevered forward over the upper cast's mounting disc, the engraved bar as its front cross-piece, and the incisal
// pin hanging from the stem's tip just behind the bar. No side arms, no front posts: nothing frames the casts.
float upperChrome(vec3 q) {
  float d = barSD(q, UBAR, FHH);
  vec3 qa = vec3(abs(q.x), q.y, q.z);
  // the hinge cross-piece over the condyles, and the condylar housings (drums riding on the condyles) under its ends
  d = min(d, sdRBox(q - vec3(0.0, 44.0, -97.0), vec3(62.0, 5.0, 6.0), 2.0));
  vec3 hq = qa - vec3(56.0, 28.0, -95.0);
  d = min(d, cylY(hq.yxz, 12.0, 9.0, 1.5));
  d = min(d, sdRBox(qa - vec3(56.0, 37.0, -95.0), vec3(5.0, 8.0, 6.0), 1.5));
  // the stem: from the cross-piece forward over the cast into the back of the engraved bar, deeper over the cast
  float zs = clamp((q.z + 97.0) / 150.0, 0.0, 1.0);
  d = min(d, sdRBox(q - vec3(0.0, 47.0 - 1.0 * zs, -22.0), vec3(7.0 - 1.5 * zs, 4.5 - 1.0 * zs, 76.0), 2.0));
  // the mounting boss and the upper cast's mounting disc
  d = min(d, cylY(q - vec3(0.0, 40.5, -22.0), 9.0, 3.0, 1.0));
  d = min(d, cylY(q - vec3(0.0, 37.5, -22.0), 33.0, 2.0, 0.8));
  // the incisal pin at the stem's tip: rod with its scale, lock nut
  d = min(d, cylY(q - vec3(0.0, 0.5 * (45.0 + PTIP), PZ), 3.0, 0.5 * (45.0 - PTIP), 1.0));
  d = min(d, cylY(q - vec3(0.0, 36.0, PZ), 5.5, 2.2, 0.6));
  return d;
}
float lowerChrome(vec3 p) {
  vec3 pa = vec3(abs(p.x), p.y, p.z);
  float d = cylY(p - vec3(0.0, -46.0, -22.0), 16.0, 6.5, 1.0);
  d = min(d, cylY(p - vec3(0.0, -37.5, -22.0), 33.0, 2.5, 0.8));
  // the condylar posts and the condyles (the hinge)
  d = min(d, cylY(pa - vec3(56.0, -16.0, -95.0), 6.0, 36.0, 1.0));
  d = min(d, length(pa - vec3(56.0, 20.0, -95.0)) - 7.0);
  // the incisal guide table on its pedestal
  d = min(d, sdRBox(p - vec3(0.0, -46.0, PZ), vec3(7.0, 6.5, 7.0), 1.0));
  d = min(d, sdRBox(p - vec3(0.0, PTIP - 2.5, PZ), vec3(13.0, 2.5, 10.0), 0.8));
  // the lower crossbar across the base's front edge
  d = min(d, barSD(p, LBAR, LHH));
  return d;
}
// mat: 0 table, 1 lower chrome, 2 lower cast, 3 upper cast, 4 plaster, 5 paper, 6 upper chrome, 7 black lacquered base
float map(vec3 p, out int mat, out int tid) {
  tid = 0; mat = 0;
  float d = p.y - TABLE_Y;
  float bs = sdRBox(p - vec3(0.0, -56.0, -18.0), vec3(66.0, 4.0, 100.0), 2.5); if (bs < d) { d = bs; mat = 7; }
  float c = lowerChrome(p); if (c < d) { d = c; mat = 1; }
  float pl = cylY(p - vec3(0.0, -30.5, -22.0), 31.0, 5.0, 1.2); if (pl < d) { d = pl; mat = 4; }
  if (sdBox3(p - vec3(0.0, -11.75, -26.5), vec3(39.0, 15.8, 36.5)) < d) {
    int id; float cc = sdCast(p, 1, id); if (cc < d) { d = cc; mat = 2; tid = id; }
  }
  // the paper: across the occlusal plane at the premolars, its free ends drooping beyond the arch
  vec3 pq = p - vec3(0.0, 0.12 - 0.42 * max(abs(p.x) - 38.0, 0.0), -26.0);
  float pp = sdRBox(pq, vec3(66.0, 0.08, 7.5), 0.05) * 0.85; if (pp < d) { d = pp; mat = 5; }
  vec3 q = (upInv * vec4(p, 1.0)).xyz;
  float uc = upperChrome(q); if (uc < d) { d = uc; mat = 6; }
  float pu = cylY(q - vec3(0.0, 30.5, -22.0), 31.0, 5.0, 1.2); if (pu < d) { d = pu; mat = 4; }
  if (sdBox3(q - vec3(0.0, 11.75, -25.0), vec3(41.0, 15.8, 38.0)) < d) {
    int id; float cc = sdCast(q, 0, id); if (cc < d) { d = cc; mat = 3; tid = id; }
  }
  return d;
}
float mapD(vec3 p) { int m, i; return map(p, m, i); }
vec3 nrm(vec3 p, float e) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}
void rayTeeth(vec3 ro, vec3 rd) {
  vec3 ru = (upInv * vec4(ro, 1.0)).xyz, du = mat3(upInv) * rd;
  teethRay(ru, du); uint cu = tCand & 0x0000FFFFu;
  teethRay(ro, rd); tCand = (tCand & 0xFFFF0000u) | cu;
}
vec2 boxHit(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  vec3 iv = 1.0 / rd; vec3 t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
const vec3 BOX_LO = vec3(-150.0, ${f(RIG.TABLE_Y)}, -150.0);
vec3 boxHi() { return vec3(150.0, 110.0 + upLift, 100.0); }
float shadow(vec3 ro, vec3 rd, float tMax) {
  SHM = true;
  rayTeeth(ro, rd);
  vec2 bh = boxHit(ro, rd, BOX_LO - 1.0, boxHi());
  float tEnd = min(min(bh.y, tMax), 500.0);
  float res = 1.0, t = 0.06 + 0.03 * hash12(gl_FragCoord.xy), ph = 1e10;
  for (int i = 0; i < 56; i++) {
    if (t > tEnd) break;
    float h = mapD(ro + rd * t);
    float y = h * h / (2.0 * ph);
    float dd = sqrt(max(h * h - y * y, 0.0));
    res = min(res, 16.0 * dd / max(0.0, t - y));
    ph = h;
    if (res < 0.004) break;
    t += clamp(h * 0.9, 0.06, 8.0);
  }
  SHM = false;
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
float ao(vec3 p, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) { float h = 0.35 * float(i * i); o += w * (h - mapD(p + n * h)); w *= 0.6; }
  return clamp(1.0 - 0.6 * o, 0.0, 1.0);
}
// ------------------------------------------------------------------ the studio
// the sweep, analytically: the flat on the table, the curve (a quarter cylinder about x), the wall
float sweepHit(vec3 ro, vec3 rd, out vec3 N) {
  float best = 1e9; N = vec3(0.0, 1.0, 0.0);
  float yc = TABLE_Y + SW_R;
  if (rd.y < -1e-5) {
    float t = (TABLE_Y + 0.4 - ro.y) / rd.y; vec3 P = ro + rd * t;
    if (t > 0.0 && P.z <= SW_Z1 && P.z >= SW_ZC && abs(P.x) < SW_X) { best = t; N = vec3(0.0, 1.0, 0.0); }
  }
  vec2 o = vec2(ro.y - yc, ro.z - SW_ZC), dd = rd.yz;
  float a = dot(dd, dd), b = dot(o, dd), c = dot(o, o) - SW_R * SW_R, disc = b * b - a * c;
  if (disc > 0.0 && a > 1e-8) {
    float t = (-b + sqrt(disc)) / a; vec3 P = ro + rd * t;
    if (t > 0.0 && t < best && P.y < yc && P.z < SW_ZC && abs(P.x) < SW_X) { best = t; N = normalize(vec3(0.0, yc - P.y, SW_ZC - P.z)); }
  }
  if (rd.z < -1e-5) {
    float t = (SW_ZC - SW_R - ro.z) / rd.z; vec3 P = ro + rd * t;
    if (t > 0.0 && t < best && P.y >= yc && P.y < SW_TOP && abs(P.x) < SW_X) { best = t; N = vec3(0.0, 0.0, 1.0); }
  }
  return best < 1e8 ? best : -1.0;
}
// the sweep's light: a pool from the overhead softbox, brightest low behind the set, falling off to the card's edges
vec3 sweepCol(vec3 P) {
  float h = P.y - TABLE_Y;
  float lx = 1.0 - smoothstep(0.18 * SW_X, SW_X, abs(P.x));
  float lh = exp(-max(h - 50.0, 0.0) / 330.0);
  float lz = smoothstep(SW_Z1 + 10.0, SW_Z1 - 80.0, P.z);
  float g = 0.97 + 0.03 * snoise(P.xy * 0.02 + P.z * 0.01);
  return T_LIGHTBOX * 0.9 * mix(0.12, 1.0, lx) * mix(0.3, 1.0, lh) * mix(0.55, 1.0, lz) * g;
}
// the studio as a mirror sees it: black, the overhead strip, the sweep, the black table, the key's lamp head
vec3 env(vec3 P, vec3 R) {
  vec3 c = T_FILM * 0.01 + T_FILM2 * 0.05 * smoothstep(-0.2, 0.6, R.y);
  float tBest = 1e9;
  if (R.y > 1e-4) {
    float s = (650.0 - P.y) / R.y; vec3 Hs = P + R * s;
    float k = smoothstep(300.0, 270.0, abs(Hs.x)) * smoothstep(-80.0, -65.0, Hs.z) * smoothstep(-20.0, -35.0, Hs.z);
    if (k > 0.0) { c = mix(c, T_LIGHTBOX * 0.96, k); tBest = s; }
  }
  vec3 Ns; float ts = sweepHit(P, R, Ns);
  if (ts > 0.0 && ts < tBest) { c = sweepCol(P + R * ts); tBest = ts; }
  else if (ts < 0.0 && R.y < 0.0) c = T_FILM2 * 0.04;
  vec3 kv = keyPos - P; float kd = length(kv);
  float ca = dot(R, kv / kd), ar = 70.0 / kd;
  c += T_LIGHTBOX * 0.92 * smoothstep(1.0 - 0.5 * ar * ar * 1.06, 1.0 - 0.5 * ar * ar * 0.94, ca) * min(keyI, 1.0);
  return c;
}
vec3 keyL(vec3 P, out float att) {
  vec3 lv = keyPos - P; float d2 = dot(lv, lv); vec3 L = lv * inversesqrt(d2);
  att = keyI * smoothstep(keyCone, keyCone + 0.06, dot(-L, keyDir)) * keyRef * keyRef / d2;
  return L;
}
// soft fill: the overhead strip from above and the sweep's bounce from behind (a rim)
float fillT(vec3 P, vec3 N) {
  float top = 0.5 + 0.5 * N.y;
  float back = max(dot(N, normalize(vec3(0.0, 120.0, -420.0) - P)), 0.0);
  return fillK * (0.35 * top * top + 1.1 * back * back);
}
float softL(float x) { return x < 0.7 ? x : 0.7 + 0.48 * (1.0 - exp(-(x - 0.7) / 0.48)); }
vec3 stoneAlb(vec3 P) {
  float g = 0.96 + 0.04 * snoise(P * 6.0) + 0.03 * snoise(P * 21.0);
  float pore = smoothstep(0.86, 0.93, snoise(P * 3.1)) * 0.25 + smoothstep(0.82, 0.9, snoise(P * 9.0 + 3.3)) * 0.15;
  return T_STONE * g * (1.0 - pore);
}
// the articulating paper's ink on the cusps: short crisp streaks along the glides, more with every glide
float marks(vec3 Pc, vec3 Nc, int tid, bool upper) {
  float top = upper ? smoothstep(1.4, 0.3, Pc.y) * smoothstep(0.1, 0.5, -Nc.y) : smoothstep(-1.8, -0.5, Pc.y) * smoothstep(-0.1, 0.4, Nc.y);
  if (top <= 0.0) return 0.0;
  float h = hash12(vec2(float(tid), upper ? 3.1 : 7.7));
  float on = smoothstep(h * 0.8, h * 0.8 + 0.06, marksK);
  // contact patches on the cusp tips, drawn out a little along the glide (x), crisp edged: only the surface within
  // ~1 mm of the contact plane takes the carbon, so the marks sit on the tips and ridges, never down the crown
  float tip = upper ? 1.0 - smoothstep(-0.2, 0.9, Pc.y) : smoothstep(-0.9, 0.2, Pc.y);
  float n = 0.5 + 0.5 * snoise(vec2(Pc.x * 0.45, Pc.z * 0.7) + float(tid) * 7.13);
  float thr = mix(0.62, 0.38, marksK);
  return top * on * smoothstep(0.45, 0.6, tip) * smoothstep(thr, thr + 0.02, n);
}

// one bounce for the chrome: what the mirror sees nearby, shaded simply (no shadows), else the studio
vec3 shadeSimple(vec3 P, vec3 N, int mat, vec3 rd) {
  float att; vec3 L = keyL(P, att); float ndl = max(dot(N, L), 0.0);
  float fill = fillT(P, N);
  if (mat == 2 || mat == 3) return T_STONE * softL(2.3 * ndl * att + fill);
  if (mat == 4) return mix(T_HALIDE, T_LIGHTBOX, 0.35) * 0.62 * softL(1.6 * ndl * att + fill);
  if (mat == 1 || mat == 6) return env(P, reflect(rd, N)) * 0.8;
  if (mat == 5) return T_FILM * 1.4;
  if (mat == 7) return env(P, reflect(rd, N)) * 0.06;
  return T_FILM2 * 0.25 * (2.2 * ndl * att + fill * 0.3);
}
vec3 reflCol(vec3 P, vec3 R) {
  rayTeeth(P, R);
  float t = 0.12; int m, id;
  for (int i = 0; i < 44; i++) {
    vec3 X = P + R * t;
    float d = map(X, m, id);
    if (d < 0.01 + t * 0.002) return shadeSimple(X, nrm(X, 0.05), m, R);
    t += d * 0.9;
    if (t > 180.0) break;
  }
  return env(P, R);
}

// a ray that leaves the set: the sweep, else the black table (the key's falloff, no shadows), else the dark studio
vec4 missCol(vec3 ro, vec3 rd) {
  vec3 Ns; float ts = sweepHit(ro, rd, Ns);
  if (ts > 0.0) { vec3 P = ro + rd * ts; return vec4(sweepCol(P), min(dot(P - camPos, camF), 5000.0)); }
  if (rd.y >= -1e-4) return vec4(T_FILM * 0.02, 5000.0);
  float t = (TABLE_Y - ro.y) / rd.y;
  vec3 P = ro + rd * t;
  float att; vec3 L = keyL(P, att);
  vec3 alb = T_FILM2 * 0.28 * (0.92 + 0.08 * fbm(P.xz * 0.05, 2));
  return vec4(alb * (2.2 * max(L.y, 0.0) * att + fillK * 0.1), min(dot(P - camPos, camF), 5000.0));
}

// the reflection band on a bar, at bar coordinates (u, v): a flat-topped streak with soft shoulders, slanted
float bandAt(vec4 B, vec2 uv) {
  if (B.w <= 0.0) return 0.0;
  float x = (uv.x - B.x - B.z * uv.y) / B.y;
  float x2 = x * x;
  float tail = x < -0.8 ? 0.42 * exp((x + 0.8) / 2.4) * (1.0 - smoothstep(-1.4, -0.8, x)) : 0.0;
  return B.w * (exp(-x2 * x2) * 0.96 + 0.04 * exp(-x2 * 0.5) + tail);
}
// the engraving: r = the letter (cut floor), b = wax lacquer; the bevel from a ring of taps around the point
vec3 engrave(vec3 field, float bnd, vec2 l, bool upper) {
  float hh = upper ? FHH : LHH;
  vec2 tuv = vec2((l.x + FHW) / (2.0 * FHW), (l.y + hh) / (4.0 * hh) + (upper ? 0.5 : 0.0));
  if (tuv.x <= 0.0 || tuv.x >= 1.0) return field;
  vec4 w = texture(wordTex, tuv);
  float du = 0.42 / (2.0 * FHW), dv = 0.42 / (4.0 * hh);
  float e = texture(wordTex, tuv + vec2(du, 0.0)).r, wv = texture(wordTex, tuv - vec2(du, 0.0)).r;
  float n = texture(wordTex, tuv + vec2(0.0, dv)).r, s = texture(wordTex, tuv - vec2(0.0, dv)).r;
  float ring = max(max(e, wv), max(n, s));
  if (ring < 0.01 && w.r < 0.01) return field;
  vec2 gr = vec2(e - wv, n - s);
  // the bevel slopes down into the letter; the faces turned up-left catch the band, the others fall dark
  float emb = clamp(dot(gr, vec2(-0.55, 0.83)) * 1.6, -1.0, 1.0);
  float bev = smoothstep(0.02, 0.5, ring) * (1.0 - smoothstep(0.35, 0.6, w.r));
  vec3 bevC = field * (0.7 + 0.5 * emb) + T_LIGHTBOX * (0.06 + 0.05 * emb) * (0.15 + 0.85 * bnd);
  vec3 col = mix(field, min(bevC, vec3(0.97)), bev);
  vec3 floorC = mix(T_FILM * 0.015, T_WAX * (0.1 + 0.85 * bnd), w.b);
  return mix(col, floorC, smoothstep(0.35, 0.65, w.r));
}

vec4 shadePx(vec2 px) {
  vec2 ndc = px / vec2(${W.toFixed(1)}, ${H.toFixed(1)}) * 2.0 - 1.0;
  vec3 rd = normalize(camF + camR * ndc.x * tanH * ${(W / H).toFixed(6)} + camU * ndc.y * tanH);
  vec3 ro = camPos;
  float pixK = 2.0 * tanH / ${H.toFixed(1)};
  vec2 bh = boxHit(ro, rd, BOX_LO - 1.0, boxHi());
  if (!(bh.x < bh.y && bh.y > 0.0)) return missCol(ro, rd);
  rayTeeth(ro, rd);
  float t = max(bh.x, 0.0);
  bool hit = false; int mat = 0, tid = 0;
  for (int i = 0; i < 420; i++) {
    float d = map(ro + rd * t, mat, tid);
    if (d < max(0.003, t * pixK * 0.35)) { hit = true; break; }
    t += d * 0.85;
    if (t > bh.y) break;
  }
  if (!hit) return missCol(ro, rd);
  vec3 P = ro + rd * t;
  vec3 N = nrm(P, max(0.02, t * pixK * 0.6));
  float depth = dot(P - camPos, camF);
  vec3 V = -rd;
  float att; vec3 L = keyL(P, att);
  float ndl = dot(N, L);
  float sh = ndl > -0.05 && att > 0.001 ? shadow(P + N * 0.06, L, length(keyPos - P)) : 0.0;
  float a = ao(P, N);
  float fill = fillT(P, N) * a;
  vec3 Hh = normalize(L + V);
  vec3 col;
  if (mat == 0) {
    // the table: matte black, a faint grain, the key's pool
    float g = 0.92 + 0.08 * fbm(P.xz * 0.05, 2);
    vec3 alb = T_FILM2 * 0.28 * g;
    col = alb * (2.2 * max(ndl, 0.0) * att * sh + fill * 0.3) * (0.35 + 0.65 * a);
  } else if (mat == 1 || mat == 6) {
    vec3 R = reflect(rd, N);
    float fr = 0.86 + 0.14 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 q = (upInv * vec4(P, 1.0)).xyz;
    // the bars' engraved faces keep only 15% of their reflection and face the empty studio: the studio alone will do
    // there (skips the bounce march on the frame-filling bar in the hero macros)
    bool onFace = false;
    {
      bool u6 = mat == 6; vec3 qb = u6 ? q : P; vec3 C = u6 ? UBAR : LBAR; float hh = u6 ? FHH : LHH;
      vec3 l = barL(qb, C); vec3 Nl = u6 ? mat3(upInv) * N : N;
      onFace = abs(l.z) < 0.3 && abs(l.y) < hh && abs(l.x) < FHW && Nl.y * TS + Nl.z * TC > 0.97;
    }
    vec3 e = onFace ? env(P, R) : reflCol(P + N * 0.05, R);
    col = e * fr * 0.92 * mix(0.6, 1.0, a);
    // the incisal pin's scale and the guide table's graduations: fixed engraving, frosted lines
    float tick = 0.0;
    if (mat == 6 && length(q.xz - vec2(0.0, PZ)) < 3.4 && q.z > PZ && q.y > -24.0 && q.y < 30.0) {
      float fy = abs(fract(q.y / 2.0) - 0.5) * 2.0;
      float big = abs(fract(q.y / 10.0 + 0.05) - 0.5) < 0.05 ? 1.0 : 0.0;
      tick = (1.0 - smoothstep(0.08, 0.16, 1.0 - fy)) * step(abs(q.x), big > 0.5 ? 2.6 : 1.4);
    }
    if (mat == 1 && P.y > PTIP - 0.3 && abs(P.z - PZ) < 10.0 && abs(P.x) < 12.0) {
      float fx = abs(fract(P.x / 2.0) - 0.5) * 2.0;
      tick = (1.0 - smoothstep(0.08, 0.18, 1.0 - fx)) * step(abs(P.z - PZ), 5.0 + 3.0 * step(abs(P.x), 0.6));
    }
    col = mix(col, T_FILM2 * 0.06, tick * 0.85);
    // the crossbars: a bevelled chrome gradient, the travelling reflection band, the engraving on the face
    bool up = mat == 6;
    vec3 qb = up ? q : P;
    vec3 C = up ? UBAR : LBAR;
    float hh = up ? FHH : LHH;
    if (barSD(qb, C, hh) < 0.08) {
      vec3 l = barL(qb, C);
      vec3 Nl = up ? mat3(upInv) * N : N;
      float nz = Nl.y * TS + Nl.z * TC, ny = Nl.y * TC - Nl.z * TS;
      vec4 B = up ? bandA : bandB;
      float bnd = bandAt(B, l.xy);
      if (abs(l.x) < FHW + CH + 0.01) {
        // face: dark polish darkening toward the bottom edge; chamfers: the top one bright (the strip), the low one dim
        float face = smoothstep(0.85, 0.97, nz);
        float grad = 0.5 + 0.5 * clamp(l.y / hh, -1.0, 1.0);
        vec3 base = mix(col, col * 0.15 + T_HALIDE * (0.002 + 0.02 * grad * grad), face);
        float chamfer = (1.0 - face) * smoothstep(0.2, 0.6, abs(ny));
        float cb = ny > 0.0 ? 1.15 : 0.55;
        vec3 field = base + T_LIGHTBOX * 0.9 * bnd * mix(1.0, cb, chamfer);
        field = min(field, vec3(0.97));
        col = face > 0.5 && abs(l.z) < 0.3 && abs(l.y) < hh ? engrave(field, bnd, l.xy, up) : field;
      }
    }
  } else if (mat == 7) {
    // the base: black lacquered steel, a dim gloss that only picks up the bright things at a glancing angle
    float fr = 0.05 + 0.6 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
    col = reflCol(P + N * 0.05, reflect(rd, N)) * fr + T_FILM2 * 0.2 * max(ndl, 0.0) * att * sh;
  } else if (mat == 5) {
    // articulating paper: thin, black carbon coating with a dull sheen
    col = T_FILM * 1.4 * (max(ndl, 0.0) * att * sh * 1.5 + fill);
    col += T_SILVER * 0.07 * pow(max(dot(N, Hh), 0.0), 14.0) * att * sh;
  } else if (mat == 4) {
    // trimmed mounting plaster: chalky white, matt (kept under the stone's value)
    vec3 alb = mix(T_HALIDE, T_LIGHTBOX, 0.35) * 0.62 * (0.96 + 0.04 * snoise(P * 2.0));
    float wrap = max((ndl + 0.1) / 1.1, 0.0);
    col = alb * softL(1.6 * wrap * att * sh + fill + 0.02 * a);
  } else {
    bool up = mat == 3;
    vec3 q = up ? (upInv * vec4(P, 1.0)).xyz : P;
    vec3 Nq = up ? mat3(upInv) * N : N;
    vec3 alb = stoneAlb(q);
    float mk = tid > 0 ? marks(q, Nq, tid, up) : 0.0;
    alb = mix(alb, T_FILM * 0.4, mk);
    SHM = true; float cav = clamp(mapD(P + N * 0.3) / 0.3, 0.0, 1.0); SHM = false;
    float wrap = max((ndl + 0.08) / 1.08, 0.0);
    float lit = 2.3 * wrap * att * sh + fill + 0.02 * a;
    col = alb * softL(lit) * mix(0.62, 1.0, cav);
    col += T_LIGHTBOX * 0.03 * pow(max(dot(N, Hh), 0.0), 16.0) * att * sh * (1.0 - mk);
  }
  return vec4(col, depth);
}

void main() {
  vec2 px = FRAG_PX;
  vec3 c = vec3(0.0); float dmin = 1e9;
  for (int k = ssK0(); k < ssK1(); k++) { vec4 s = shadePx(px + rgss(k)); c += s.rgb; dmin = min(dmin, s.a); }
  fragColor = vec4(c * ssWeight(), dmin);
}`;
