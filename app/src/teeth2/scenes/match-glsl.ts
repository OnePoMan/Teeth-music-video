// Plate 13 `match`: shaders.
//  PHOTO_FRAG  the photograph on each print: an upper stone cast (GLSL_TEETH, the kit's SDF) standing teeth-up on a
//              grey card, shot straight down on a copy stand (key lamp upper right, fill left), developed as a print:
//              output = the print's reflectance (linear), rendered once per cast into a target (match.ts caches it).
//  MAIN_FRAG   the frame: a dark light-table, the stack of prints (photo, white border, the cast label), the clear
//              acetate over them (the lamp reflected in it, its cut edge, tape, the ink: tracing and lyric), the
//              gloved hand with the pen (ray-marched), shadows of the hand and of the ink, under a copy-stand lamp.
import { GLSL_TEETH_PALETTE } from '../palette';
import { GLSL_TEETH } from '../teeth';
import { SS_TAP_GLSL } from '../../engine/gl';
import { PRINT, PHOTO, LABEL, ACETATE, LYR, TRC, PHOTO_SCALE, STAMP } from './match-ink';

const f = (x: number) => x.toFixed(3);

export const PHOTO_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${GLSL_TEETH}
uniform vec2 rtRes;
uniform float seedF;
// bench frame: x = arch x, y up, z = arch y (the upper cast teeth-up: head = (x, -y, -z))
const vec3 CAMP = vec3(6.0, 640.0, 16.0);
const float CARD = -${f(26.0 + 0.03)};
vec3 toHead(vec3 p) { return vec3(p.x, -p.y, -p.z); }
float mapD(vec3 p) { int id; return sdCast(toHead(p), 0, id); }
vec3 nrm(vec3 p) {
  const vec2 k = vec2(1.0, -1.0); const float e = 0.05;
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}
vec2 boxHit(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  vec3 iv = 1.0 / rd; vec3 t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
const vec3 BLO = vec3(-40.0, -26.5, -12.0), BHI = vec3(40.0, 3.0, 62.0);
float shadow(vec3 ro, vec3 rd, float k) {
  teethRay(toHead(ro), toHead(rd));
  vec2 bh = boxHit(ro, rd, BLO, BHI);
  if (bh.y < max(bh.x, 0.0)) return 1.0;
  float tEnd = min(bh.y, 120.0);
  float res = 1.0, t = max(bh.x, 0.0) + 0.06 + 0.12 * hash12(gl_FragCoord.xy), ph = 1e10;
  for (int i = 0; i < 110; i++) {
    if (t > tEnd) break;
    float h = mapD(ro + rd * t);
    float y = h * h / (2.0 * ph);
    float d = sqrt(max(h * h - y * y, 0.0));
    res = min(res, k * d / max(0.0, t - y));
    ph = h;
    if (res < 0.004) break;
    t += clamp(h * 0.85, 0.05, 2.5);
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
float ao(vec3 p, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 5; i++) { float h = 0.24 * float(i * i); o += w * (h - mapD(p + n * h)); w *= 0.62; }
  return clamp(1.0 - 0.6 * o, 0.0, 1.0);
}
void main() {
  vec2 uv = gl_FragCoord.xy / rtRes;
  vec2 a = vec2(${f(PHOTO.x0)} + uv.x * ${f(PHOTO.x1 - PHOTO.x0)}, ${f(PHOTO.y0)} + (1.0 - uv.y) * ${f(PHOTO.y1 - PHOTO.y0)});
  vec3 ro = CAMP, rd = normalize(vec3(a.x, 0.0, a.y) - CAMP);
  // the copy stand's lamps: the key from the upper right of the picture (it leaves the cut-away #8 fracture, which
  // faces up and to the left, in shadow: a notch, not a knob), a weaker fill from the lower left
  vec3 L = normalize(vec3(0.72, 0.42, -0.55));
  vec3 L2 = normalize(vec3(-0.75, 0.5, 0.4));
  float tC = (CARD - ro.y) / rd.y;
  vec2 bh = boxHit(ro, rd, BLO, BHI);
  float t = max(bh.x, 0.0), tEnd = min(bh.y, tC);
  bool hit = false;
  teethRay(toHead(ro), toHead(rd));
  if (bh.x < bh.y) {
    for (int i = 0; i < 300; i++) {
      float d = mapD(ro + rd * t);
      if (d < 0.0004 * t + 0.0006) { hit = true; break; }
      t += d * 0.85;
      if (t > tEnd) break;
    }
  }
  vec3 col;
  if (!hit) {
    // the grey card: a cool mid-grey seamless, lighter toward the key, its paper tooth
    vec3 P = ro + rd * tC;
    float sh = shadow(P + vec3(0.0, 0.05, 0.0), L, 4.0);
    float sh2 = shadow(P + vec3(0.0, 0.05, 0.0), L2, 3.0);
    float grad = 0.82 + 0.2 * (1.0 - smoothstep(-60.0, 70.0, P.x + P.z * 0.8));
    float tooth = 0.97 + 0.03 * snoise(P.xz * 1.7) + 0.015 * snoise(P.xz * 6.0);
    vec3 card = mix(T_HALIDE, T_SILVER, 0.6) * 0.26;
    col = card * tooth * grad * (0.8 * sh * L.y + 0.32 * sh2 * L2.y + 0.18);
    // contact shadow under the base
    vec3 hp = toHead(P);
    col *= 0.55 + 0.45 * smoothstep(0.0, 4.0, mapD(P + vec3(0.0, 1.5, 0.0)));
  } else {
    for (int k = 0; k < 2; k++) t += mapD(ro + rd * t) * 0.9;
    vec3 P = ro + rd * t;
    vec3 N = nrm(P);
    float ndl = dot(N, L), ndl2 = dot(N, L2);
    float sh = ndl > -0.2 ? shadow(P + N * 0.08, L, 3.0) : 0.0;
    float sh2 = ndl2 > -0.2 ? shadow(P + N * 0.08, L2, 2.5) : 0.0;
    float o = ao(P, N);
    float wrap = max((ndl + 0.15) / 1.15, 0.0), wrap2 = max((ndl2 + 0.2) / 1.2, 0.0);
    // dental stone: matte, a fine powdery grain, the odd pore and bubble
    float pore = smoothstep(0.84, 0.9, snoise(P * 2.4 + seedF * 3.7)) * 0.3;
    float grain = 0.95 + 0.05 * snoise(P * 6.5) + 0.025 * snoise(P * 21.0);
    vec3 alb = T_STONE * grain * (1.0 - pore);
    // the occlusion darkens every light, so pockets (the cut-away fracture on #8, the embrasures) sit in shade
    col = alb * (0.72 * wrap * mix(0.45, 1.0, sh) + 0.36 * wrap2 * mix(0.5, 1.0, sh2) + 0.3 * (0.6 + 0.4 * N.y) + 0.06) * mix(1.0, o, 0.5);
    vec3 V = -rd, Hh = normalize(L + V);
    col += T_LIGHTBOX * 0.025 * pow(max(dot(N, Hh), 0.0), 16.0) * sh;
    // a floor of light from the copy stand's diffusers: no crease in the stone goes to black (it would read as a drawn line)
    col = max(col, alb * 0.13);
  }
  // the print: exposure, a gentle toe and shoulder, a touch of the lens's falloff
  vec2 c = uv - 0.5;
  col *= 1.08 - 0.5 * dot(c, c);
  col = col * 1.15 / (1.0 + 0.32 * col);
  // the print's grain (fixed in the paper)
  col *= 0.985 + 0.03 * (hash12(floor(gl_FragCoord.xy * 0.5) + seedF * 17.0) - 0.5);
  fragColor = vec4(min(col, vec3(0.92)), 1.0);
}`;

/** Hand-local frame: s along the pen from the tip toward the back, u lateral (+ the thumb's side, the writer's
 *  left), w up from the pen (perpendicular to it, toward the camera). mm. A right hand in a tripod grip: the pen
 *  pinched between the thumb's pad, the index pad on top and the side of the middle finger's last joint. */
export const GLSL_HAND = /* glsl */ `
float rcap(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float finger(vec3 p, vec3 a, vec3 b, vec3 c, vec3 d, vec4 r) {
  float f = rcap(p, a, b, r.x, r.y);
  f = smin(f, rcap(p, b, c, r.y, r.z), 1.4);
  f = smin(f, rcap(p, c, d, r.z, r.w), 1.6);
  return f;
}
// the pen: a steel tip cone, a black rubber grip, a satin silver barrel with a clip
float sdPen(vec3 p, out int m) {
  float r = length(p.yz);
  float cone = max(r - mix(0.3, 2.9, clamp(p.x / 9.0, 0.0, 1.0)), max(-p.x, p.x - 9.0));
  float grip = max(r - 4.2, max(9.0 - p.x, p.x - 36.0));
  float barrel = max(r - 4.5, max(35.5 - p.x, p.x - 136.0));
  float cap = length(vec3(max(p.x - 136.0, 0.0), p.yz)) - 4.5;
  barrel = min(barrel, max(cap, 134.0 - p.x));
  vec3 q = p - vec3(116.0, 0.0, 5.1);
  vec3 bq = abs(q) - vec3(18.0, 1.2, 0.5);
  float clip = length(max(bq, 0.0)) + min(max(bq.x, max(bq.y, bq.z)), 0.0) - 0.3;
  float d = cone; m = 2;
  if (grip < d) { d = grip; m = 1; }
  if (barrel < d) { d = barrel; m = 3; }
  if (clip < d) { d = clip; m = 2; }
  return d;
}
const vec3 W0 = vec3(138.0, -18.0, 2.0), W1 = vec3(205.0, -12.0, 6.0);
const float GRIP = 7.0;
float sdGlove(vec3 p) {
  p.x -= GRIP;   // the grip sits back up the barrel: the steel nib and the rubber grip show ahead of the fingertips
  float th = finger(p, vec3(30.0, 8.0, 0.6), vec3(47.0, 14.0, 3.0), vec3(70.0, 19.0, -2.0), vec3(98.0, 14.0, -9.0), vec4(6.4, 7.5, 9.2, 11.0));
  float ix = finger(p, vec3(24.0, -1.4, 9.9), vec3(40.0, -3.0, 13.0), vec3(54.0, -5.0, 21.0), vec3(80.0, -11.0, 16.0), vec4(5.9, 6.7, 7.5, 9.3));
  float mi = finger(p, vec3(26.0, -8.6, -3.0), vec3(40.0, -14.0, -6.0), vec3(55.0, -22.0, -2.0), vec3(84.0, -27.0, 8.0), vec4(6.1, 6.9, 7.7, 9.5));
  float ri = finger(p, vec3(52.0, -30.0, -14.0), vec3(66.0, -35.0, -11.0), vec3(80.0, -40.0, -4.0), vec3(100.0, -42.0, 6.0), vec4(6.6, 7.3, 7.9, 9.0));
  float li = finger(p, vec3(66.0, -43.0, -18.0), vec3(78.0, -49.0, -14.0), vec3(92.0, -53.0, -7.0), vec3(108.0, -54.0, 2.0), vec4(5.7, 6.3, 6.9, 7.9));
  float d = smin(smin(th, ix, 1.8), smin(mi, smin(ri, li, 1.8), 1.8), 1.8);
  float back = sdEll(p - vec3(114.0, -20.0, 6.0), vec3(38.0, 32.0, 13.0));
  float then = sdEll(p - vec3(110.0, 10.0, -8.0), vec3(28.0, 18.0, 12.0));
  float wrist = rcap(p, W0, W1, 23.0, 25.0);
  float palm = smin(smin(back, then, 14.0), wrist, 14.0);
  d = smin(d, palm, 6.5);
  // the glove's rolled cuff at the wrist
  vec3 ax = normalize(W1 - W0);
  vec3 q = p - (W0 + ax * 50.0);
  float along = dot(q, ax);
  float rad = length(q - ax * along);
  float cuff = length(vec2(rad - 25.4, along)) - 4.3;
  d = smin(d, cuff, 1.2);
  return max(d, along - 3.0);   // the glove ends at the roll
}
float sdSleeve(vec3 p) {
  p.x -= GRIP;
  vec3 ax = normalize(W1 - W0);
  return max(rcap(p, W0 + ax * 50.0, W0 + ax * 190.0, 29.0, 33.0), -dot(p - W0 - ax * 52.0, ax));
}
float sdHand(vec3 p, out int m) {
  float pen = sdPen(p, m);
  float g = sdGlove(p);
  float sl = sdSleeve(p);
  float d = pen;
  if (g < d) { d = g; m = 0; }
  if (sl < d) { d = sl; m = 4; }
  return d;
}
float sdHandD(vec3 p) { int m; return sdHand(p, m); }
// creases in the nitrile at the joints (a height field for the shading normal)
float jn(vec3 q, vec3 c, float r2) { vec3 d = q - c; return exp(-dot(d, d) / r2); }
float wrinkle(vec3 q) {
  q.x -= GRIP;
  float mk = jn(q, vec3(40.0, -3.0, 13.0), 30.0) + jn(q, vec3(54.0, -5.0, 21.0), 45.0) + jn(q, vec3(80.0, -11.0, 18.0), 70.0)
    + jn(q, vec3(47.0, 14.0, 3.0), 40.0) + jn(q, vec3(70.0, 21.0, -2.0), 60.0) + jn(q, vec3(40.0, -14.0, -6.0), 30.0)
    + jn(q, vec3(55.0, -22.0, -2.0), 45.0) + 0.6 * jn(q, vec3(84.0, -27.0, 8.0), 80.0);
  float ph = q.x * 1.55 + 2.2 * snoise(q * 0.18);
  return mk * (0.5 + 0.5 * sin(ph)) * 0.55 + 0.01 * snoise(q * 0.7);
}
`;

export const MAIN_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
${GLSL_HAND}
uniform mat4 invVP; uniform vec3 camPos; uniform vec2 res;
uniform sampler2D photoA, photoB, trcTex, lyrTex, labTex, labBlank, stampTex, grpTex;
uniform vec4 gpA, gpB;          // "Late night devil...": how far each group's red line has swept round (0..1)
uniform vec4 prA, prB;          // prints: ox, oy (table mm, y down), theta, on (B is the top one)
uniform float flush, redGlow;   // the tracing's red sweep (0..1), the red's lift at the lock
uniform vec4 ring;              // the examiner's ring round the chip: x, y (table mm), radius, drawn 0..1
uniform vec4 stamp;             // MATCH: x, y (table mm, centre), angle, ink 0..1
uniform vec4 stampSh;           // the rubber stamp's shadow as it comes down and lifts: x, y (table mm), softness, strength
uniform vec3 keyPos;            // the copy-stand lamp (world)
uniform float lampK;            // its brightness (steps up on the lock)
uniform vec2 cone;              // its beam: cos of the inner and outer half-angles (snaps tighter on the lock)
uniform vec3 hTip, hE1, hE2, hE3; uniform float handOn;
uniform float shCut;            // the hand's shadow is cast only by the hand-local part x < shCut (writing: the glove, not the raised sleeve)

const float Z_PAPER = 0.4, Z_AC = 1.3;
const vec3 AIM = vec3(42.0, 26.0, 0.0);   // where the lamp points (world)
vec2 TB(vec3 p) { return vec2(p.x, -p.y); }   // world -> table (y down)
float sdBox2(vec2 p, vec2 c, vec2 h, float r) { vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec2 toPrint(vec2 tp, vec4 pr) { vec2 d = tp - pr.xy; float c = cos(pr.z), s = sin(pr.z); return vec2(c * d.x + s * d.y, -s * d.x + c * d.y); }
float printSd(vec2 q) { return sdBox2(q, vec2(${f((PRINT.x0 + PRINT.x1) / 2)}, ${f((PRINT.y0 + PRINT.y1) / 2)}), vec2(${f((PRINT.x1 - PRINT.x0) / 2)}, ${f((PRINT.y1 - PRINT.y0) / 2)}), 1.2); }
float acSd(vec2 p) { return sdBox2(p, vec2(${f((ACETATE.x0 + ACETATE.x1) / 2)}, ${f((ACETATE.y0 + ACETATE.y1) / 2)}), vec2(${f((ACETATE.x1 - ACETATE.x0) / 2)}, ${f((ACETATE.y1 - ACETATE.y0) / 2)}), 2.0); }

// the lamp: a hard spot with a beam edge (1.0 on its aim point), the pool falling off to film black
float lamp(vec3 p, vec3 n) {
  vec3 d = keyPos - p; float r2 = dot(d, d); vec3 l = d * inversesqrt(r2);
  vec3 axis = normalize(AIM - keyPos);
  float spot = smoothstep(cone.y, cone.x, dot(-l, axis));
  vec3 d0 = keyPos - AIM;
  return min(lampK * max(dot(n, l), 0.0) / r2 * dot(d0, d0) / max(normalize(d0).z, 1e-3) * spot, 1.08);   // white paper never blooms
}
// the lamp seen in a glossy surface: a round reflector, its frosted bulb, the dish's rings and dark rim
float lampRefl(vec3 p, vec3 rd, vec3 n) {
  vec3 R = reflect(rd, n);
  if (R.z <= 0.0) return 0.0;
  float t = (keyPos.z - p.z) / R.z;
  float r = length((p + R * t).xy - keyPos.xy);
  // crisp shapes (no orb): the frosted bulb, a dark socket ring, the polished dish with two pressed ribs, the rim
  float aa = 0.6;
  float bulb = 1.0 - smoothstep(18.0 - aa, 18.0 + aa, r);
  float sock = smoothstep(18.0 - aa, 18.0 + aa, r) - smoothstep(23.0 - aa, 23.0 + aa, r);
  float dish = (smoothstep(23.0 - aa, 23.0 + aa, r) - smoothstep(58.0 - aa, 58.0 + aa, r)) * (0.75 - 0.4 * (r - 23.0) / 35.0) * (1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.9, abs(r - 36.0))) - 0.35 * (1.0 - smoothstep(0.0, 0.9, abs(r - 47.0))));
  return (bulb * 6.0 + sock * 0.2 + dish * 2.4) * lampK;
}

// ---- the hand (ray-marched in its own frame)
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
  // the hand's shadow under the hard lamp
  if (handOn < 0.5) return 1.0;
  vec3 l = normalize(keyPos - p);
  vec3 o = toH(p), d = dirH(l);
  vec2 bh = boxHit(o, d, HLO, HHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1.0;
  float t = max(bh.x, 0.2), res = 1.0;
  for (int i = 0; i < 64; i++) {
    if (t > bh.y) break;
    vec3 q = o + d * t;
    float h = max(sdHandD(q), q.x - shCut);
    res = min(res, 18.0 * h / t);
    if (res < 0.01) break;
    t += clamp(h, 0.4, 6.0);
  }
  res = clamp(res, 0.0, 1.0);
  res = res * res * (3.0 - 2.0 * res);
  // writing: the lit print, the label and the white cuff bounce a fill into the glove's shadow, so the words under it
  // stay legible (shCut < 1e3 only while the glove writes the lyric)
  return shCut < 1e3 ? mix(0.42, 1.0, res) : res;
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
    // the creases: the normal tilted by the wrinkle field's gradient (its tangential part)
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
  // the bright print below bounces into the undersides; the room above is dark
  float env = mix(0.006, 0.22, 1.0 - smoothstep(-0.6, 0.05, R.z)) * o;
  float lr = 0.0;
  vec3 col;
  if (m == 0) {
    // matte black nitrile: a dark diffuse body the lamp lights on its top planes, a broad soft sheen (no glossy blobs,
    // no all-round fresnel rim), and a little bounce from the lit print into the planes that face down onto it
    vec3 alb = T_SILVER * 0.09;
    float spec = ggx(N, Hh, 0.62) * (0.04 + 0.2 * pow(1.0 - nv, 5.0)) * 0.6;
    float bounce = max(-N.z, 0.0) * 0.16 * o;
    col = alb * (E * 1.25 + bounce + 0.015) + T_LIGHTBOX * spec * E;
  } else if (m == 2) {
    vec3 alb = T_HALIDE * 0.8;
    col = alb * (ggx(N, Hh, 0.2) * 0.5 * E + env * 1.4 + lr * 0.05 + 0.06 * E);
  } else if (m == 3) {
    // satin silver barrel: brushed along its length
    vec3 alb = T_SILVER * (0.9 + 0.1 * sin(q.x * 9.0 + snoise(q * 2.0)));
    col = alb * (ggx(N, Hh, 0.32) * 0.48 * E + 0.45 * E + env * 1.2 + lr * 0.04 + 0.02);
  } else if (m == 1) {
    col = T_FILM * (E * 0.8 + 0.02) + T_LIGHTBOX * (ggx(N, Hh, 0.45) * fres * 0.25 * E + fres * env * 0.5);
  } else {
    // the sleeve: dark cotton, matte
    float weave = 0.9 + 0.1 * snoise(q * vec3(0.5, 3.0, 3.0));
    col = T_FILM2 * 1.6 * weave * (E * max(dot(N, L), 0.0) * 1.2 + 0.03);
  }
  return col * mix(1.0, o, 0.5);
}

// ---- the stack of prints, the label, the table
// screen derivatives of the table point, taken once per shading sample in uniform control flow: every texture below
// is sampled with textureGrad (lookups inside branches have no valid implicit derivatives: seams at the branch edges)
vec2 gDX, gDY;
vec4 texG(sampler2D tex, vec2 uv, vec2 size) { return textureGrad(tex, uv, gDX / size, gDY / size); }
vec3 photoSample(sampler2D tex, vec2 q) {
  vec2 a = q / ${f(PHOTO_SCALE)};
  vec2 uv = vec2((a.x - ${f(PHOTO.x0)}) / ${f(PHOTO.x1 - PHOTO.x0)}, 1.0 - (a.y - ${f(PHOTO.y0)}) / ${f(PHOTO.y1 - PHOTO.y0)});
  return texG(tex, uv, vec2(${f((PHOTO.x1 - PHOTO.x0) * PHOTO_SCALE)}, ${f((PHOTO.y1 - PHOTO.y0) * PHOTO_SCALE)})).rgb;
}
vec4 labelSample(sampler2D tex, vec2 q) {
  vec2 l = (q - vec2(${f(LABEL.x0)}, ${f(LABEL.y0)})) / vec2(${f(LABEL.w)}, ${f(LABEL.h)});
  vec4 c = texG(tex, vec2(l.x, 1.0 - l.y), vec2(${f(LABEL.w)}, ${f(LABEL.h)}));
  float inside = step(0.0, l.x) * step(l.x, 1.0) * step(0.0, l.y) * step(l.y, 1.0);
  return vec4(toLinear(c.rgb / max(c.a, 1e-4)), c.a * inside);
}
vec3 printAlb(vec2 q, sampler2D photo, sampler2D lab, out float red) {
  float inPhoto = step(abs(q.x - ${f((PRINT.x0 + PRINT.x1) / 2)}), ${f((PRINT.x1 - PRINT.x0) / 2 - PRINT.border)}) * step(abs(q.y - ${f((PRINT.y0 + PRINT.y1) / 2)}), ${f((PRINT.y1 - PRINT.y0) / 2 - PRINT.border)});
  vec3 alb = mix(T_LIGHTBOX * 0.8, photoSample(photo, q), inPhoto);
  vec4 lb = labelSample(lab, q);
  red = smoothstep(0.15, 0.5, lb.r - lb.g * 2.0) * lb.a;
  return mix(alb, lb.rgb * 0.97, lb.a);
}
vec3 shadePaper(vec3 P, vec3 rd, out float gloss) {
  vec2 tp = TB(P);
  float E = lamp(P, vec3(0.0, 0.0, 1.0));
  float sh = handShadow(P);
  float red = 0.0;
  float dB = prB.w > 0.5 ? printSd(toPrint(tp, prB)) : 1e3;
  float dA = prA.w > 0.5 ? printSd(toPrint(tp, prA)) : 1e3;
  float aa = 0.12;
  // the light table: black frosted glass, switched off
  vec3 alb = T_FILM * (0.8 + 0.2 * snoise(tp * 0.05)) * (0.96 + 0.04 * snoise(tp * 1.3));
  gloss = 0.03;
  vec2 lsh = normalize(TB(keyPos) - tp) * 1.8;   // the prints throw a hard shadow away from the lamp
  if (dA < 1e2) {
    float occA = 1.0 - smoothstep(-0.4, 1.6, printSd(toPrint(tp + lsh, prA)));
    alb *= 1.0 - 0.75 * occA;
    float ra;
    vec3 a = printAlb(toPrint(tp, prA), photoA, labBlank, ra);
    float k = 1.0 - smoothstep(-aa, aa, dA);
    alb = mix(alb, a, k); gloss = mix(gloss, 0.05, k);
  }
  if (dB < 1e2) {
    float occB = 1.0 - smoothstep(-0.4, 1.8, printSd(toPrint(tp + lsh, prB)));
    alb *= 1.0 - 0.7 * occB;
    float rb;
    vec3 b = printAlb(toPrint(tp, prB), photoB, labTex, rb);
    float k = 1.0 - smoothstep(-aa, aa, dB);
    alb = mix(alb, b, k); gloss = mix(gloss, 0.05, k); red = rb * k;
    alb += T_LIGHTBOX * 0.25 * (1.0 - smoothstep(0.0, 0.18, abs(dB + 0.1))) * step(dA, 1e2 - 1.0);
  }
  vec3 col = alb * (E * sh + 0.012);
  col += T_MATCH * red * redGlow * 0.9;
  return col;
}

// ---- the acetate: ink coverage (tracing + lyric + ring + stamp) at table point tp; red fraction
vec2 inkAt(vec2 tp) {
  float a = 0.0, r = 0.0;
  // (the canvases are black at their borders and clamp to edge, so sampling outside is clean)
  vec2 lu = (tp - vec2(${f(LYR.x0)}, ${f(LYR.y0)})) / vec2(${f(LYR.x1 - LYR.x0)}, ${f(LYR.y1 - LYR.y0)});
  {
    vec2 c = texG(lyrTex, vec2(lu.x, 1.0 - lu.y), vec2(${f(LYR.x1 - LYR.x0)}, ${f(LYR.y1 - LYR.y0)})).rg;
    a = c.r; r = c.g / max(c.r, 1e-3);
  }
  vec2 tu = (tp - vec2(${f(TRC.x0)}, ${f(TRC.y0)})) / vec2(${f(TRC.x1 - TRC.x0)}, ${f(TRC.y1 - TRC.y0)});
  {
    vec2 c = texG(trcTex, vec2(tu.x, 1.0 - tu.y), vec2(${f(TRC.x1 - TRC.x0)}, ${f(TRC.y1 - TRC.y0)})).rg;
    float ord = c.g / max(c.r, 1e-3);
    float rr = ord > 0.995 ? 0.0 : smoothstep(ord - 0.04, ord, flush);  // order 1.0: the alignment marks stay black
    if (c.r > a) { r = mix(r, rr, (c.r - a) / max(c.r, 1e-3)); }
    a = max(a, c.r);
  }
  // the groups: per word, a heavier red line sweeps once round one tooth group (the outline closing round it)
  {
    vec3 c = texG(grpTex, vec2(tu.x, 1.0 - tu.y), vec2(${f(TRC.x1 - TRC.x0)}, ${f(TRC.y1 - TRC.y0)})).rgb;
    float gi = floor(c.g / max(c.r, 1e-3) * 8.0);
    float pr = gi < 0.5 ? gpA.x : gi < 1.5 ? gpA.y : gi < 2.5 ? gpA.z : gi < 3.5 ? gpA.w : gi < 4.5 ? gpB.x : gi < 5.5 ? gpB.y : gi < 6.5 ? gpB.z : gpB.w;
    float s = c.r * step(c.b / max(c.r, 1e-3), pr) * step(0.001, pr);
    r = mix(r, 1.0, s); a = max(a, s);
  }
  // the examiner's ring round the chip, drawn in one stroke, overshooting its start
  {
    vec2 d = tp - ring.xy;
    float ang = fract((atan(d.y, d.x) + 2.4) / 6.28318);
    float rr = ring.z * (1.0 + 0.06 * sin(ang * 6.28318 + 0.6) + 0.05 * ang);
    float dd = abs(length(d * vec2(1.0, 1.18)) - rr);
    float s = (1.0 - smoothstep(0.16, 0.34, dd)) * step(ang, ring.w) * step(0.001, ring.w);
    r = mix(r, 0.0, s); a = max(a, s);   // film ink: the red stays on the outline, TEETH, the monogram and the stamp
  }
  // MATCH, stamped on the acetate
  {
    vec2 d = tp - stamp.xy; float cs = cos(stamp.z), sn = sin(stamp.z);
    vec2 q = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y) / vec2(${f(STAMP.w)}, ${f(STAMP.h)}) + 0.5;
    float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
    float s = texG(stampTex, vec2(q.x, 1.0 - q.y), vec2(${f(STAMP.w)}, ${f(STAMP.h)})).a * stamp.w * inside * (0.75 + 0.25 * snoise(tp * 0.8));
    r = mix(r, 1.0, s); a = max(a, s);
  }
  return vec2(clamp(a, 0.0, 1.0), clamp(r, 0.0, 1.0));
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
  float gloss;
  vec3 col = shadePaper(P, rd, gloss);
  // the stamp's block above the sheet, just before and after it strikes: its shadow, hard as it lands
  if (stampSh.w > 0.0) {
    vec2 d = TB(P) - stampSh.xy; float cs = cos(stamp.z), sn = sin(stamp.z);
    vec2 q = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
    float sd = sdBox2(q, vec2(0.0), vec2(${f(STAMP.w / 2 + 3)}, ${f(STAMP.h / 2 + 3)}), 2.0);
    col *= 1.0 - stampSh.w * (1.0 - smoothstep(-stampSh.z, stampSh.z, sd));
  }
  // the ink's shadow on the paper below the acetate
  {
    vec3 l = normalize(keyPos - P);
    vec2 sp = TB(P + l * ((Z_AC - Z_PAPER) / l.z));
    col *= 1.0 - 0.16 * inkAt(sp + vec2(0.15, 0.12)).x;
  }
  // the glossy print or glass: the lamp's reflection
  // (the prints are semi-gloss: no mirror image of the lamp in them; only the acetate reflects it, additively)
  // the acetate
  vec3 PA = ro + rd * tA;
  vec2 ta = TB(PA);
  float dAc = acSd(ta);
  float inAc = 1.0 - smoothstep(-0.06, 0.06, dAc);
  // its thickness: a shadow band on the paper beside the cut edge (away from the lamp)
  {
    float dS = acSd(ta + normalize(TB(keyPos) - ta) * 1.1);
    col *= 1.0 - 0.55 * (1.0 - smoothstep(-0.8, 1.2, dS)) * (1.0 - inAc);
  }
  if (inAc > 0.0) {
    vec2 wv = vec2(snoise(ta * 0.011 + 3.0), snoise(ta * 0.011 + 9.0)) * 0.012 + vec2(snoise(ta * 0.05), snoise(ta * 0.05 + 4.0)) * 0.002;
    vec3 nA = normalize(vec3(wv, 1.0));
    float fres = 0.045 + 0.955 * pow(1.0 - abs(dot(-rd, nA)), 5.0);
    float lr = 0.0;   // (no mirror image of the lamp: at these angles it read as an object on the board, not a reflection)
    float smudge = smoothstep(0.2, 0.9, snoise(ta * 0.02 + 21.0));
    vec2 ink = inkAt(ta);
    vec3 acol = col * vec3(0.9, 0.92, 0.94) + T_LIGHTBOX * lr * fres * (1.0 + 0.25 * smudge) * (1.0 - ink.x);
    float E = lamp(PA, vec3(0.0, 0.0, 1.0)) * handShadow(PA);
    vec3 inkBlack = T_FILM * 0.5 * (E + 0.02);
    vec3 inkRed = T_MATCH * (0.75 * E + 0.06) + T_MATCH * redGlow;
    acol = mix(acol, mix(inkBlack, inkRed, ink.y), ink.x * 0.97);
    // the cut edge: a bright bevel where the lamp catches the sheet's thickness, a dark line on its inner side
    float bevel = 1.0 - smoothstep(0.25, 0.75, abs(dAc + 0.5));
    float inner = 1.0 - smoothstep(0.0, 0.35, abs(dAc + 1.35));
    acol = acol * (1.0 - 0.35 * inner) + T_LIGHTBOX * bevel * (0.12 + 0.55 * E);
    col = mix(col, acol, inAc);
  }
  // tape: two strips of frosted tape holding the acetate down
  for (int k = 0; k < 2; k++) {
    vec2 c0 = k == 0 ? vec2(${f(ACETATE.x0 + 14)}, ${f(ACETATE.y0 + 2)}) : vec2(${f(ACETATE.x1 - 2)}, ${f(ACETATE.y0 + 30)});
    float ang = k == 0 ? -0.6 : 0.18;
    vec2 q = rot2(ang) * (ta - c0);
    float tape = sdBox2(q, vec2(0.0), vec2(22.0, 8.5), 0.4) + 0.35 * snoise(q * vec2(0.8, 2.0));
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
