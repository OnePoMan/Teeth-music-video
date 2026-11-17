// Plate 13 `match`: shaders.
//  PHOTO_FRAG  the photograph on each print: an upper stone cast (GLSL_TEETH, the kit's SDF) standing teeth-up on a
//              grey card, shot straight down on a copy stand (key lamp upper left, fill right), developed as a print:
//              output = the print's reflectance (linear), rendered once per cast into a target (match.ts caches it).
//  MAIN_FRAG   the frame: a dark light-table, the stack of prints (photo, white border, the cast label), the clear
//              acetate over them (sheen of the lamp's softbox, its cut edge, tape, the ink: tracing and lyric), the
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
  for (int i = 1; i <= 5; i++) { float h = 0.25 * float(i * i) * 0.5; o += w * (h - mapD(p + n * h)); w *= 0.6; }
  return clamp(1.0 - 1.0 * o, 0.0, 1.0);
}
void main() {
  vec2 uv = gl_FragCoord.xy / rtRes;
  vec2 a = vec2(${f(PHOTO.x0)} + uv.x * ${f(PHOTO.x1 - PHOTO.x0)}, ${f(PHOTO.y0)} + (1.0 - uv.y) * ${f(PHOTO.y1 - PHOTO.y0)});
  vec3 ro = CAMP, rd = normalize(vec3(a.x, 0.0, a.y) - CAMP);
  // the copy stand's lamps: the key from the upper left of the picture, a weaker fill from the right
  vec3 L = normalize(vec3(-0.5, 0.8, -0.36));
  vec3 L2 = normalize(vec3(0.75, 0.55, 0.36));
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
    vec3 card = mix(T_HALIDE, T_SILVER, 0.55) * 0.42;
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
    col = alb * (0.72 * wrap * mix(0.45, 1.0, sh) + 0.36 * wrap2 * mix(0.5, 1.0, sh2) + 0.26 * mix(o, 1.0, 0.35) * (0.6 + 0.4 * N.y) + 0.05);
    vec3 V = -rd, Hh = normalize(L + V);
    col += T_LIGHTBOX * 0.025 * pow(max(dot(N, Hh), 0.0), 16.0) * sh;
  }
  // the print: exposure, a gentle toe and shoulder, a touch of the lens's falloff
  vec2 c = uv - 0.5;
  col *= 1.05 - 0.22 * dot(c, c);
  col = col * 1.15 / (1.0 + 0.32 * col);
  // the print's grain (fixed in the paper)
  col *= 0.985 + 0.03 * (hash12(floor(gl_FragCoord.xy * 0.5) + seedF * 17.0) - 0.5);
  fragColor = vec4(min(col, vec3(0.92)), 1.0);
}`;

/** Hand-local frame: s along the pen from the tip toward the back, u lateral (+ the thumb's side, the writer's
 *  left), w up from the pen (perpendicular to it, toward the camera). mm. */
const GLSL_HAND = /* glsl */ `
float rcap(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float finger(vec3 p, vec3 a, vec3 b, vec3 c, vec3 d, vec4 r) {
  float f = rcap(p, a, b, r.x, r.y);
  f = smin(f, rcap(p, b, c, r.y, r.z), 1.6);
  f = smin(f, rcap(p, c, d, r.z, r.w), 1.8);
  return f;
}
// pen: tip cone (metal), grip, barrel, clip
float sdPen(vec3 p, out int m) {
  float r = length(p.yz);
  float cone = max(r - mix(0.35, 3.1, clamp(p.x / 9.0, 0.0, 1.0)), max(-p.x, p.x - 9.0));
  float grip = max(r - 4.25, max(9.0 - p.x, p.x - 36.0));
  float barrel = max(r - 4.6 - 0.15 * smoothstep(36.0, 40.0, p.x), max(35.5 - p.x, p.x - 138.0));
  float cap = length(vec3(max(p.x - 138.0, 0.0), p.yz)) - 4.6;
  barrel = min(barrel, max(cap, 136.0 - p.x));
  vec3 q = p - vec3(118.0, 0.0, 5.3);
  vec3 bq = abs(q) - vec3(19.0, 1.3, 0.55);
  float clip = length(max(bq, 0.0)) + min(max(bq.x, max(bq.y, bq.z)), 0.0) - 0.3;
  float d = cone; m = 2;
  if (grip < d) { d = grip; m = 1; }
  if (barrel < d) { d = barrel; m = 3; }
  if (clip < d) { d = clip; m = 2; }
  return d;
}
float sdGlove(vec3 p) {
  // a right hand in a tripod grip, seen from above and behind (the writer at the bottom of the frame):
  // index finger on top of the pen, the pad near the tip, its knuckle beside the barrel
  float d = finger(p, vec3(21.0, -4.6, 8.4), vec3(41.0, -7.2, 11.0), vec3(61.0, -10.5, 15.5), vec3(88.0, -15.0, 12.0), vec4(6.0, 6.9, 7.7, 9.3));
  // thumb on the writer's left of the pen, running back under it to its base
  float th = finger(p, vec3(31.0, 9.6, 1.4), vec3(51.0, 16.5, 2.0), vec3(74.0, 21.0, -4.0), vec3(102.0, 18.0, -11.0), vec4(7.2, 8.2, 9.8, 12.5));
  d = smin(d, th, 2.4);
  // middle finger under the pen on the other side
  float mi = finger(p, vec3(26.0, -7.6, -3.4), vec3(46.0, -14.5, -3.0), vec3(68.0, -22.0, 3.0), vec3(96.0, -29.0, 5.0), vec4(6.4, 7.4, 8.2, 9.6));
  d = smin(d, mi, 2.0);
  // ring and little fingers curled under the palm
  float ri = finger(p, vec3(60.0, -31.0, -13.0), vec3(75.0, -37.0, -9.0), vec3(90.0, -41.0, -2.0), vec3(108.0, -45.0, 1.0), vec4(7.0, 7.6, 8.2, 9.2));
  float li = finger(p, vec3(76.0, -46.0, -17.0), vec3(89.0, -52.0, -12.0), vec3(102.0, -56.0, -6.0), vec3(118.0, -58.0, -4.0), vec4(6.0, 6.6, 7.2, 8.2));
  d = smin(d, smin(ri, li, 2.0), 2.2);
  // the back of the hand (beside the pen, on the little finger's side), the thenar, the wrist out of frame
  float back = sdEll(p - vec3(128.0, -36.0, 3.0), vec3(44.0, 26.0, 13.0));
  float then = sdEll(p - vec3(116.0, 17.0, -12.0), vec3(28.0, 15.0, 13.0));
  float wrist = rcap(p, vec3(165.0, -24.0, -2.0), vec3(280.0, -18.0, 6.0), 26.0, 30.0);
  float palm = smin(smin(back, then, 10.0), wrist, 14.0);
  d = smin(d, palm, 7.0);
  // the glove's cuff-less fit: a slight looseness at the fingertip seams
  return d;
}
float sdHand(vec3 p, out int m) {
  float pen = sdPen(p, m);
  float g = sdGlove(p);
  if (g < pen) { m = 0; return g; }
  return pen;
}
float sdHandD(vec3 p) { int m; return sdHand(p, m); }
`;

export const MAIN_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
${GLSL_HAND}
uniform mat4 invVP; uniform vec3 camPos; uniform vec2 res;
uniform sampler2D photoA, photoB, trcTex, lyrTex, labTex, labBlank, stampTex;
uniform vec4 prA, prB;          // prints: ox, oy (table mm, y down), theta, on (B is the top one)
uniform float flush, redGlow;   // the tracing's red sweep (0..1), the red's lift at the lock
uniform vec4 stamp;             // MATCH: x, y (table mm, centre), angle, ink 0..1
uniform vec3 keyPos;            // the copy-stand key lamp (world)
uniform vec3 hTip, hE1, hE2, hE3; uniform float handOn;

const float Z_PAPER = 0.4, Z_AC = 1.3;
vec2 TB(vec3 p) { return vec2(p.x, -p.y); }   // world -> table (y down)
float sdBox2(vec2 p, vec2 c, vec2 h, float r) { vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec2 toPrint(vec2 tp, vec4 pr) { vec2 d = tp - pr.xy; float c = cos(pr.z), s = sin(pr.z); return vec2(c * d.x + s * d.y, -s * d.x + c * d.y); }
float printSd(vec2 q) { return sdBox2(q, vec2(${f((PRINT.x0 + PRINT.x1) / 2)}, ${f((PRINT.y0 + PRINT.y1) / 2)}), vec2(${f((PRINT.x1 - PRINT.x0) / 2)}, ${f((PRINT.y1 - PRINT.y0) / 2)}), 1.2); }

// the key lamp: irradiance on a surface (1.0 at the table's centre), a spot's falloff
float lamp(vec3 p, vec3 n) {
  vec3 d = keyPos - p; float r2 = dot(d, d); vec3 l = d * inversesqrt(r2);
  vec3 axis = normalize(vec3(-5.0, 5.0, 0.0) - keyPos);
  float spot = pow(max(dot(-l, axis), 0.0), 22.0);
  vec3 d0 = keyPos - vec3(-5.0, 5.0, 0.0);
  return max(dot(n, l), 0.0) / r2 * dot(d0, d0) / max(normalize(d0).z, 1e-3) * spot * 1.0;
}
// the lamp's softbox seen in a mirror-like surface at p with normal n (luminance 0..)
float softbox(vec3 p, vec3 rd, vec3 n) {
  vec3 R = reflect(rd, n);
  if (R.z <= 0.0) return 0.0;
  float t = (keyPos.z - p.z) / R.z;
  vec2 h = (p + R * t).xy - keyPos.xy;
  vec2 q = abs(h) - vec2(120.0, 85.0);
  float e = max(q.x, q.y);
  float body = 1.0 - smoothstep(-30.0, 22.0, e);
  float hot = 0.75 + 0.25 * (1.0 - smoothstep(0.0, 160.0, length(h)));
  return body * hot;
}

// ---- the hand (ray-marched in its own frame)
vec3 toH(vec3 p) { vec3 d = p - hTip; return vec3(dot(d, hE1), dot(d, hE2), dot(d, hE3)); }
vec3 dirH(vec3 v) { return vec3(dot(v, hE1), dot(v, hE2), dot(v, hE3)); }
vec3 fromH(vec3 v) { return hE1 * v.x + hE2 * v.y + hE3 * v.z; }
const vec3 HLO = vec3(-4.0, -94.0, -36.0), HHI = vec3(312.0, 46.0, 42.0);
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
  for (int i = 0; i < 160; i++) {
    if (t > te) break;
    int mm;
    float h = sdHand(o + d * t, mm);
    if (h < 0.002 * t * 0.01 + 0.03) { m = mm; return t; }
    t += h * 0.8;
  }
  return 1e9;
}
float handShadow(vec3 p) {
  // soft shadow of the hand toward the key lamp (on the paper below it)
  if (handOn < 0.5) return 1.0;
  vec3 l = normalize(keyPos - p);
  vec3 o = toH(p), d = dirH(l);
  vec2 bh = boxHit(o, d, HLO, HHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1.0;
  float t = max(bh.x, 0.2), res = 1.0;
  for (int i = 0; i < 48; i++) {
    if (t > bh.y) break;
    float h = sdHandD(o + d * t);
    res = min(res, 9.0 * h / t);
    if (res < 0.01) break;
    t += clamp(h, 0.6, 8.0);
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
vec3 nrmHand(vec3 q) {
  const vec2 k = vec2(1.0, -1.0); const float e = 0.08;
  return normalize(k.xyy * sdHandD(q + k.xyy * e) + k.yyx * sdHandD(q + k.yyx * e) + k.yxy * sdHandD(q + k.yxy * e) + k.xxx * sdHandD(q + k.xxx * e));
}
float aoHand(vec3 q, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) { float h = 1.2 * float(i * i); o += w * (h - sdHandD(q + n * h)); w *= 0.55; }
  return clamp(1.0 - 0.08 * o, 0.0, 1.0);
}
vec3 shadeHand(vec3 P, vec3 rd, int m) {
  vec3 q = toH(P);
  vec3 nl = nrmHand(q);
  // nitrile: a fine pebbled grip on the fingers, soft creases across the knuckles
  if (m == 0) {
    vec3 bump = vec3(snoise(q * 0.45), snoise(q * 0.45 + 7.1), snoise(q * 0.45 + 13.7));
    float crease = sin(q.x * 0.5 + snoise(q * 0.12) * 2.0) * smoothstep(0.55, 0.9, snoise(q * 0.06 + 3.0));
    nl = normalize(nl + 0.02 * bump + 0.06 * crease * vec3(1.0, 0.0, 0.0));
  }
  vec3 N = fromH(nl);
  vec3 L = normalize(keyPos - P), V = -rd, Hh = normalize(L + V);
  float ndl = max(dot(N, L), 0.0);
  float o = aoHand(q, nl);
  float E = lamp(P, N);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 col;
  float rough = m == 0 ? 0.3 : m == 2 ? 0.22 : 0.28;
  float a2 = rough * rough * rough * rough;
  float nh = max(dot(N, Hh), 0.0);
  float D = a2 / (3.14159 * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
  float spec = D * fres * 0.25;
  // the bright print below bounces into the underside; the dark room above
  vec3 R = reflect(rd, N);
  float env = mix(0.012, 0.32, (1.0 - smoothstep(-0.5, 0.1, R.z))) * o;
  float sb = softbox(P, rd, N);
  if (m == 0) {
    vec3 alb = T_FILM2 * 0.55;
    col = alb * (E * 0.9 + 0.05 * o) + T_LIGHTBOX * (spec * E * 1.6 + fres * (env * 0.7 + sb * 0.9) + 0.012 * o);
  } else if (m == 2) {
    vec3 alb = T_HALIDE * 0.75;
    col = alb * (spec * E * 3.0 + env * 0.9 + sb * 0.6 + 0.05 * E);
  } else {
    vec3 alb = m == 1 ? T_FILM * 1.2 : T_FILM2 * 0.8;
    col = alb * (E * 0.8 + 0.04) + T_LIGHTBOX * (spec * E * 2.2 + fres * (env * 0.9 + sb * 1.2));
  }
  return col;
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
// a print's reflectance at print-local q; also returns how red its ink is (the signed monogram)
vec3 printAlb(vec2 q, sampler2D photo, sampler2D lab, out float red) {
  red = 0.0;
  float inPhoto = step(abs(q.x - ${f((PRINT.x0 + PRINT.x1) / 2)}), ${f((PRINT.x1 - PRINT.x0) / 2 - PRINT.border)}) * step(abs(q.y - ${f((PRINT.y0 + PRINT.y1) / 2)}), ${f((PRINT.y1 - PRINT.y0) / 2 - PRINT.border)});
  vec3 alb = mix(T_LIGHTBOX * 0.86, photoSample(photo, q), inPhoto);
  vec4 lb = labelSample(lab, q);
  if (lb.a > 0.0) {
    red = smoothstep(0.15, 0.5, lb.r - lb.g * 2.0) * lb.a;
    alb = mix(alb, lb.rgb * 0.97, lb.a);
  }
  return alb;
}
vec3 shadePaper(vec3 P, vec3 rd, out float gloss) {
  vec2 tp = TB(P);
  vec3 N = vec3(0.0, 0.0, 1.0);
  float E = lamp(P, N);
  float sh = handShadow(P);
  vec3 alb; float red = 0.0; gloss = 0.0;
  float dB = prB.w > 0.5 ? printSd(toPrint(tp, prB)) : 1e3;
  float dA = prA.w > 0.5 ? printSd(toPrint(tp, prA)) : 1e3;
  float aa = 0.12;
  // the light table: dark frosted glass, switched off
  vec3 table = T_FILM2 * (0.55 + 0.1 * snoise(tp * 0.05)) * (0.96 + 0.04 * snoise(tp * 1.3));
  alb = table; gloss = 0.035;
  // the print underneath, its shadow on the table
  if (dA < 1e2) {
    float occA = 1.0 - smoothstep(-1.0, 3.5, printSd(toPrint(tp - vec2(1.6, 1.4), prA)));
    alb *= 1.0 - 0.6 * occA;
    float ra;
    vec3 a = printAlb(toPrint(tp, prA), photoA, labBlank, ra);
    float k = 1.0 - smoothstep(-aa, aa, dA);
    alb = mix(alb, a, k); gloss = mix(gloss, 0.05, k);
  }
  if (dB < 1e2) {
    float occB = 1.0 - smoothstep(-1.0, 3.8, printSd(toPrint(tp - vec2(1.8, 1.6), prB)));
    alb *= 1.0 - 0.55 * occB;
    float rb;
    vec3 b = printAlb(toPrint(tp, prB), photoB, labTex, rb);
    float k = 1.0 - smoothstep(-aa, aa, dB);
    alb = mix(alb, b, k); gloss = mix(gloss, 0.05, k); red = rb * k;
    // the paper's edge catches the light (its thickness), a hair of white
    alb += T_LIGHTBOX * 0.25 * (1.0 - smoothstep(0.0, 0.18, abs(dB + 0.1))) * step(dA, 1e2 - 1.0);
  }
  vec3 col = alb * (E * sh * 1.0 + 0.055) ;
  // the red ink of the signature: it carries the red's lift
  col += T_MATCH * red * redGlow * 0.9;
  return col;
}

// ---- the acetate: ink coverage (tracing + lyric) at table point tp; red fraction
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
  vec2 tp = TB(P);
  // the ink's shadow on the paper below the acetate
  {
    vec3 l = normalize(keyPos - P);
    vec2 sp = TB(P + l * ((Z_AC - Z_PAPER) / l.z));
    vec2 ik = inkAt(sp + vec2(0.35, 0.3));
    col *= 1.0 - 0.32 * ik.x;
  }
  // the glossy print or glass: a dim reflection of the softbox
  col += T_LIGHTBOX * softbox(P, rd, vec3(0.0, 0.0, 1.0)) * gloss * 2.4;
  // the acetate
  vec3 PA = ro + rd * tA;
  vec2 ta = TB(PA);
  float dAc = sdBox2(ta, vec2(${f((ACETATE.x0 + ACETATE.x1) / 2)}, ${f((ACETATE.y0 + ACETATE.y1) / 2)}), vec2(${f((ACETATE.x1 - ACETATE.x0) / 2)}, ${f((ACETATE.y1 - ACETATE.y0) / 2)}), 2.0);
  float inAc = 1.0 - smoothstep(-0.08, 0.08, dAc);
  // its cut edge throws a thin shadow line on the paper
  col *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.9, abs(dAc - 0.7))) * (1.0 - inAc);
  if (inAc > 0.0) {
    vec2 wv = vec2(snoise(ta * 0.011 + 3.0), snoise(ta * 0.011 + 9.0)) * 0.03 + vec2(snoise(ta * 0.05), snoise(ta * 0.05 + 4.0)) * 0.004;
    vec3 nA = normalize(vec3(wv, 1.0));
    float fres = 0.045 + 0.955 * pow(1.0 - abs(dot(-rd, nA)), 5.0);
    float sb = softbox(PA, rd, nA);
    // fingerprints and fine scratches show only in the sheen
    float smudge = smoothstep(0.15, 0.85, snoise(ta * 0.025 + 21.0));
    float scr = 0.0;
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      vec2 r = rot2(0.4 + fk * 1.3) * (ta - vec2(-60.0 + 35.0 * fk, -40.0 + 22.0 * fk));
      scr += (1.0 - smoothstep(0.0, 0.07, abs(r.y - 0.0015 * r.x * r.x * (fk - 1.5)))) * smoothstep(-80.0, 0.0, r.x) * (1.0 - smoothstep(10.0, 90.0, r.x));
    }
    vec2 ink = inkAt(ta);
    vec3 under = col * vec3(0.9, 0.92, 0.94);
    float sheen = (sb * 6.5 * fres) * (1.0 + 0.35 * smudge + 1.2 * scr);
    vec3 acol = under + T_LIGHTBOX * sheen * (1.0 - ink.x);
    // the ink: film-black, or the match red (lit by the lamp, lifted at the lock)
    float E = lamp(PA, vec3(0.0, 0.0, 1.0)) * handShadow(PA);
    vec3 inkBlack = T_FILM * 0.6 * (E + 0.05) + T_LIGHTBOX * sb * 0.05;
    vec3 inkRed = T_MATCH * (0.72 * E + 0.1) + T_MATCH * redGlow;
    acol = mix(acol, mix(inkBlack, inkRed, ink.y), ink.x * 0.96);
    // the cut edge catches the lamp: a bright hair along the edge
    float edge = (1.0 - smoothstep(0.0, 0.35, abs(dAc + 0.2)));
    acol += T_LIGHTBOX * edge * 0.35 * (0.3 + E);
    col = mix(col, acol, inAc);
  }
  // tape: two strips of frosted tape holding the acetate down
  for (int k = 0; k < 2; k++) {
    vec2 c0 = k == 0 ? vec2(${f(ACETATE.x0 + 14)}, ${f(ACETATE.y0 + 2)}) : vec2(${f(ACETATE.x1 - 2)}, ${f(ACETATE.y0 + 42)});
    float ang = k == 0 ? -0.6 : 0.18;
    vec2 q = rot2(ang) * (ta - c0);
    float tape = sdBox2(q, vec2(0.0), vec2(22.0, 8.5), 0.4) + 0.35 * snoise(q * vec2(0.8, 2.0));
    float tk = 1.0 - smoothstep(-0.1, 0.25, tape);
    float E = lamp(PA, vec3(0.0, 0.0, 1.0));
    vec3 tc = T_HALIDE * (0.75 + 0.05 * snoise(q * vec2(0.3, 6.0))) * (E + 0.06);
    col = mix(col, mix(col, tc, 0.62), tk);
  }
  return col;
}
void main() {
  vec3 c = vec3(0.0);
  for (int k = ssK0(); k < ssK1(); k++) c += shade(gl_FragCoord.xy + rgss(k) * PX_SCALE);
  fragColor = vec4(c * ssWeight(), 1.0);
}`;
