// `articulator` shader: one ray-marched pass (then pour's depth-of-field gather).
// The set: a chrome semi-adjustable articulator on a black table, the lower member fixed (world = the kit's head
// frame), the upper member placed by `upInv` (world -> its local frame); the stone casts (the kit's sdCast) mounted on
// trimmed plaster and chrome mounting plates; a strip of articulating paper between them; one hard key (a spot,
// above front-left); the white studio card, a flat far in front of the set, seen only in the chrome (and as the soft
// front fill it bounces). The chrome is a pure mirror of that environment, so its highlights are crisp shapes: the
// card's rectangle and the key's lamp head. The lyric is engraved in the crossbar's front face (frosted letters in
// the polish): black on black until the face reflects the card, then dark letters in a white field.
import { W, H, SS_TAP_GLSL } from '../../engine/gl';
import { GLSL_TEETH_PALETTE } from '../palette';
import { GLSL_TEETH } from '../teeth';
import { RIG, CARD } from './articulator-rig';

const f = (x: number) => x.toFixed(3);

export const ART_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${GLSL_TEETH}
${SS_TAP_GLSL}
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform mat4 upInv;
uniform sampler2D wordTex; uniform vec4 wordRect;
uniform float marksK, lowK;
uniform vec3 keyPos, keyDir; uniform float keyI, keyCone, keyRef, fillK, upLift;
const float TABLE_Y = ${f(RIG.TABLE_Y)}, FZ = ${f(RIG.FZ)}, FY = ${f(RIG.FY)}, FHW = ${f(RIG.FHW)}, FHH = ${f(RIG.FHH)};
const float PZ = ${f(RIG.PZ)}, PTIP = ${f(RIG.PTIP)};
const float CARD_Z = ${f(CARD.Z)}, CARD_X0 = ${f(CARD.X0)}, CARD_X1 = ${f(CARD.X1)}, CARD_Y0 = ${f(CARD.Y0)}, CARD_Y1 = ${f(CARD.Y1)};
bool SHM = false;

float sdRBox(vec3 p, vec3 b, float r) { return sdBox3(p, b - r) - r; }
float cylY(vec3 p, float r, float h, float rr) {
  vec2 d = vec2(length(p.xz) - r + rr, abs(p.y) - h + rr);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rr;
}
// ------------------------------------------------------------------ the machine
float upperChrome(vec3 q) {
  // the crossbar (its front face engraved), the side arms, the bridge over the cast, the mounting plate,
  // the condylar housings at the back, the incisal pin's bracket, rod and lock nut at the front
  float d = sdRBox(q - vec3(0.0, FY, FZ - 7.0), vec3(FHW + 1.6, FHH + 0.5, 7.0), 1.6);
  vec3 qa = vec3(abs(q.x), q.y, q.z);
  d = min(d, sdRBox(qa - vec3(58.0, FY, -38.0), vec3(6.0, 13.0, 62.0), 4.5));
  d = min(d, sdRBox(q - vec3(0.0, 43.5, -30.0), vec3(52.0, 3.5, 40.0), 1.5));
  d = min(d, cylY(q - vec3(0.0, 37.5, -22.0), 33.0, 2.5, 1.0));
  // the condylar housings: drums across the condyles (their guidance scale is the brief's fixed engraving)
  vec3 hq = qa - vec3(56.0, 28.0, -95.0);
  d = min(d, cylY(hq.yxz, 12.0, 10.0, 1.5));
  d = min(d, sdRBox(q - vec3(0.0, 33.0, 0.5 * (FZ - 1.0 + PZ + 7.0)), vec3(7.0, 3.4, 0.5 * (PZ + 8.0 - FZ)), 3.0));
  d = min(d, cylY(q - vec3(0.0, 0.5 * (36.0 + PTIP), PZ), 3.0, 0.5 * (36.0 - PTIP), 1.0));
  d = min(d, cylY(q - vec3(0.0, 27.5, PZ), 5.5, 2.2, 0.6));
  return d;
}
float lowerChrome(vec3 p) {
  vec3 pa = vec3(abs(p.x), p.y, p.z);
  float d = sdRBox(p - vec3(0.0, -56.0, -24.0), vec3(64.0, 4.0, 94.0), 2.5);
  d = min(d, cylY(p - vec3(0.0, -46.0, -22.0), 16.0, 6.5, 1.0));
  d = min(d, cylY(p - vec3(0.0, -37.5, -22.0), 33.0, 2.5, 0.8));
  d = min(d, cylY(pa - vec3(56.0, -16.0, -95.0), 6.0, 36.0, 1.0));
  d = min(d, length(pa - vec3(56.0, 20.0, -95.0)) - 7.0);
  d = min(d, sdRBox(p - vec3(0.0, -46.0, PZ), vec3(7.0, 6.5, 7.0), 1.0));
  d = min(d, sdRBox(p - vec3(0.0, PTIP - 2.5, PZ), vec3(13.0, 2.5, 11.0), 0.8));
  return d;
}
// mat: 0 table, 1 lower chrome, 2 lower cast, 3 upper cast, 4 plaster, 5 paper, 6 upper chrome
float map(vec3 p, out int mat, out int tid) {
  tid = 0; mat = 0;
  float d = p.y - TABLE_Y;
  float c = lowerChrome(p); if (c < d) { d = c; mat = 1; }
  float pl = cylY(p - vec3(0.0, -30.5, -22.0), 31.0, 5.0, 1.2); if (pl < d) { d = pl; mat = 4; }
  if (sdBox3(p - vec3(0.0, -11.75, -26.5), vec3(39.0, 15.8, 36.5)) < d) {
    int id; float cc = sdCast(p, 1, id); if (cc < d) { d = cc; mat = 2; tid = id; }
  }
  // the paper: across the occlusal plane at the premolars, its free ends drooping beyond the arch
  vec3 pq = p - vec3(0.0, 0.12 - 0.3 * max(abs(p.x) - 36.0, 0.0), -24.0);
  float pp = sdRBox(pq, vec3(60.0, 0.07, 6.0), 0.05) * 0.9; if (pp < d) { d = pp; mat = 5; }
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
const vec3 BOX_LO = vec3(-140.0, ${f(RIG.TABLE_Y)}, -140.0);
vec3 boxHi() { return vec3(140.0, 110.0 + upLift, 80.0); }
float shadow(vec3 ro, vec3 rd, float tMax) {
  SHM = true;
  rayTeeth(ro, rd);
  vec2 bh = boxHit(ro, rd, BOX_LO - 1.0, boxHi());
  float tEnd = min(min(bh.y, tMax), 500.0);
  float res = 1.0, t = 0.06 + 0.03 * hash12(gl_FragCoord.xy), ph = 1e10;
  for (int i = 0; i < 80; i++) {
    if (t > tEnd) break;
    float h = mapD(ro + rd * t);
    float y = h * h / (2.0 * ph);
    float dd = sqrt(max(h * h - y * y, 0.0));
    res = min(res, 16.0 * dd / max(0.0, t - y));
    ph = h;
    if (res < 0.004) break;
    t += clamp(h * 0.85, 0.04, 6.0);
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
// ------------------------------------------------------------------ light
// the card, lit toward its middle: its radiance falls off near the edges (a reflection, not a printed panel)
vec3 cardL(vec3 Hc) {
  float k = (0.8 + 0.2 * smoothstep(0.0, 420.0, CARD_X1 - Hc.x)) * (0.82 + 0.18 * smoothstep(0.0, 380.0, CARD_Y1 - Hc.y));
  return T_LIGHTBOX * 0.88 * k;
}
// the studio as a mirror sees it: black, the card, the key's lamp head
vec3 env(vec3 P, vec3 R) {
  // the dark studio: black above, the dim floor below a soft horizon
  vec3 c = T_FILM * 0.012 + T_FILM2 * 0.3 * smoothstep(0.0, -0.08, R.y) * (0.6 + 0.4 * smoothstep(-0.1, -0.6, R.y));
  if (R.z > 1e-4) {
    float s = (CARD_Z - P.z) / R.z;
    vec3 Hc = P + R * s;
    float ins = min(min(Hc.x - CARD_X0, CARD_X1 - Hc.x), min(Hc.y - CARD_Y0, CARD_Y1 - Hc.y));
    c = mix(c, cardL(Hc), smoothstep(-1.5, 1.5, ins));
  }
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
  float on = smoothstep(h * 0.85, h * 0.85 + 0.08, marksK);
  float n = 0.5 + 0.5 * snoise(vec2(Pc.x * 0.7, Pc.z * 2.6) + float(tid) * 7.13);
  float n2 = 0.5 + 0.5 * snoise(vec2(Pc.x * 2.4 + 5.0, Pc.z * 0.8) + float(tid) * 3.7);
  float thr = mix(0.9, 0.45, marksK);
  return top * on * max(smoothstep(thr, thr + 0.025, n), 0.8 * smoothstep(thr + 0.05, thr + 0.075, n2));
}

// one bounce for the chrome: what the mirror sees nearby (the casts, the plaster, the other chrome, the table),
// shaded simply (no shadows), else the studio
vec3 shadeSimple(vec3 P, vec3 N, int mat, vec3 rd) {
  float att; vec3 L = keyL(P, att); float ndl = max(dot(N, L), 0.0);
  float fill = fillK * (0.25 + 0.75 * max(dot(N, normalize(vec3(800.0, -300.0, CARD_Z) - P)), 0.0));
  if (mat == 2 || mat == 3) return T_STONE * softL(2.3 * ndl * att + fill);
  if (mat == 4) return mix(T_HALIDE, T_LIGHTBOX, 0.35) * 0.62 * softL(1.6 * ndl * att + fill);
  if (mat == 1 || mat == 6) return env(P, reflect(rd, N)) * 0.8;
  if (mat == 5) return T_FILM * 1.4;
  return T_FILM2 * 0.9 * (2.2 * ndl * att + fill * 0.5);
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

// a ray that leaves the set: the table beyond it (matte black, the key's falloff, no shadows), else the dark studio
vec4 missCol(vec3 ro, vec3 rd) {
  if (rd.y >= -1e-4) return vec4(T_FILM * 0.06, 5000.0);
  float t = (TABLE_Y - ro.y) / rd.y;
  vec3 P = ro + rd * t;
  float att; vec3 L = keyL(P, att);
  vec3 alb = T_FILM2 * 0.9 * (0.92 + 0.08 * fbm(P.xz * 0.05, 2));
  float fill = fillK * 0.25;
  return vec4(alb * (2.2 * max(L.y, 0.0) * att + fill * 0.5), min(dot(P - camPos, camF), 5000.0));
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
  // the card's bounce: a broad soft fill from the front
  vec3 Fd = normalize(vec3(800.0, -300.0, CARD_Z) - P);
  float fill = fillK * (0.25 + 0.75 * max(dot(N, Fd), 0.0)) * a;
  vec3 Hh = normalize(L + V);
  vec3 col;
  if (mat == 0) {
    // the table: matte black, a faint grain, the key's pool
    float g = 0.92 + 0.08 * fbm(P.xz * 0.05, 2);
    vec3 alb = T_FILM2 * 0.9 * g;
    col = alb * (2.2 * max(ndl, 0.0) * att * sh + fill * 0.5) * (0.35 + 0.65 * a);
  } else if (mat == 1 || mat == 6) {
    vec3 R = reflect(rd, N);
    float fr = 0.86 + 0.14 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 e = reflCol(P + N * 0.05, R);
    col = e * fr * 0.92 * mix(0.6, 1.0, a);
    vec3 q = (upInv * vec4(P, 1.0)).xyz;
    // the incisal pin's scale and the guide table's graduations: fixed engraving, frosted lines
    float tick = 0.0;
    if (mat == 6 && length(q.xz - vec2(0.0, PZ)) < 3.4 && q.z > PZ && q.y > -24.0 && q.y < 22.0) {
      float fy = abs(fract(q.y / 2.0) - 0.5) * 2.0;
      float big = abs(fract(q.y / 10.0 + 0.05) - 0.5) < 0.05 ? 1.0 : 0.0;
      tick = (1.0 - smoothstep(0.08, 0.16, 1.0 - fy)) * step(abs(q.x), big > 0.5 ? 2.6 : 1.4);
    }
    if (mat == 1 && P.y > PTIP - 0.3 && abs(P.z - PZ) < 10.0 && abs(P.x) < 12.0) {
      float fx = abs(fract(P.x / 2.0) - 0.5) * 2.0;
      tick = (1.0 - smoothstep(0.08, 0.18, 1.0 - fx)) * step(abs(P.z - PZ), 6.0 + 3.0 * step(abs(P.x), 0.6));
    }
    // the engraved lyric on the crossbar's front face
    float letter = 0.0, wax = 0.0;
    if (mat == 6 && abs(q.z - FZ) < 0.25 && abs(q.x) < FHW && abs(q.y - FY) < FHH) {
      vec2 uv = vec2((q.x - wordRect.x) / wordRect.z, (q.y - FY - wordRect.y) / wordRect.w);
      if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) { vec4 w = texture(wordTex, uv); letter = w.r; wax = w.g; }
    }
    vec3 frost = T_FILM2 * 0.08 + T_SILVER * 0.006 * max(ndl, 0.0) * att * sh;
    // black fill in black polish is invisible: the letters separate only as the field around them mirrors the card
    float fl = dot(col, vec3(0.2126, 0.7152, 0.0722));
    vec3 frostE = mix(col, frost, smoothstep(0.02, 0.18, fl));
    col = mix(col, frostE, max(tick * 0.85, letter * (1.0 - wax)));
    // the tender word is filled with wax-pink lacquer: glossy, it mirrors the card in its own colour
    col = mix(col, e * T_WAX * 0.95, letter * wax);
  } else if (mat == 5) {
    // articulating paper: thin, black carbon coating with a dull sheen
    col = T_FILM * 1.4 * (max(ndl, 0.0) * att * sh * 1.5 + fill);
    col += T_SILVER * 0.05 * pow(max(dot(N, Hh), 0.0), 18.0) * att * sh;
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
    alb = mix(alb, T_FILM * 1.2, mk);
    SHM = true; float cav = clamp(mapD(P + N * 0.3) / 0.3, 0.0, 1.0); SHM = false;
    float wrap = max((ndl + 0.08) / 1.08, 0.0);
    float lit = 2.3 * wrap * att * sh + fill + 0.02 * a;
    col = alb * softL(lit) * mix(0.62, 1.0, cav) * mix(1.0, lowK, float(!up));
    col += T_LIGHTBOX * 0.025 * pow(max(dot(N, Hh), 0.0), 16.0) * att * sh * (1.0 - mk);
  }
  return vec4(col, depth);
}

void main() {
  vec2 px = FRAG_PX;
  vec3 c = vec3(0.0); float dmin = 1e9;
  for (int k = ssK0(); k < ssK1(); k++) { vec4 s = shadePx(px + rgss(k)); c += s.rgb; dmin = min(dmin, s.a); }
  fragColor = vec4(c * ssWeight(), dmin);
}`;
