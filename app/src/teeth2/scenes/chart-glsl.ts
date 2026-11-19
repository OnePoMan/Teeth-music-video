// Plate 7 `chart`: the frame. A light table (a frosted panel lit from below, a dark rim), her chart taped to it (A3,
// printed form + the pen's marks + the typed header, all sampled from canvases in sheet mm), his chart beneath
// (the same form, smaller, a corner showing), and the gloved hand with the pen: THE glove of plate 13 (match-glsl.ts),
// its source taken from that file so there is one glove; lit here by the light table under it.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL } from '../../engine/gl';
import matchSrc from './match-glsl.ts?raw';
import { SHEET, MK } from './chart-form';
import { LYR } from './chart-lyric';

const m = /const GLSL_HAND = \/\* glsl \*\/ `([\s\S]*?)\n`;/.exec(matchSrc);
if (!m) throw new Error('chart: the glove (GLSL_HAND) was not found in match-glsl.ts');
// the glove as it is, its sleeve run on into an arm (the plate 13 frame ends the sleeve a hand's length from the cuff)
const GLSL_HAND = m[1]!.replace('ax * 190.0', 'ax * 1100.0');
const f = (x: number) => x.toFixed(3);

export const HAND_SCALE = 0.8;

export const CHART_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
${GLSL_HAND}
uniform mat4 invVP; uniform vec3 camPos; uniform vec2 res;
uniform sampler2D sheetA, sheetB, marksTex, lyrTex;
uniform vec4 poseA;      // her sheet: x, y (table mm, y down), rotation, 1
uniform vec4 poseB;      // his sheet: x, y, rotation, scale
uniform vec3 keyPos;     // the room lamp (soft), world
uniform vec3 hTip, hE1, hE2, hE3; uniform float handOn;
uniform float panelK;    // the light table's brightness

const float Z_A = 1.5, Z_B = 0.7;
const vec2 HALF = vec2(${f(SHEET.w / 2)}, ${f(SHEET.h / 2)});
const float HS = ${f(HAND_SCALE)};
vec2 TB(vec3 p) { return vec2(p.x, -p.y); }
float sdBox2(vec2 p, vec2 h, float r) { vec2 q = abs(p) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec2 toSheet(vec2 tp, vec4 pose) { vec2 d = tp - pose.xy; float c = cos(pose.z), s = sin(pose.z); return vec2(c * d.x + s * d.y, -s * d.x + c * d.y) / pose.w; }

vec2 gDX, gDY;
vec4 texG(sampler2D tex, vec2 uv, vec2 size) { return textureGrad(tex, uv, gDX / size, gDY / size); }

// ---- the hand: the glove's SDF at scale HS (its own frame, tip at the origin)
vec3 toH(vec3 p) { vec3 d = p - hTip; return vec3(dot(d, hE1), dot(d, hE2), dot(d, hE3)); }
vec3 dirH(vec3 v) { return vec3(dot(v, hE1), dot(v, hE2), dot(v, hE3)); }
vec3 fromH(vec3 v) { return hE1 * v.x + hE2 * v.y + hE3 * v.z; }
const vec3 HLO = vec3(-4.0, -64.0, -36.0) * HS, HHI = vec3(1300.0, 50.0, 48.0) * HS;
vec2 boxHit(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  vec3 iv = 1.0 / rd; vec3 t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
float sdHandS(vec3 q, out int m) { return sdHand(q / HS, m) * HS; }
float sdHandSD(vec3 q) { int m; return sdHandS(q, m); }
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
    float h = sdHandS(o + d * t, mm);
    if (h < 0.03) { m = mm; return t; }
    t += h * 0.85;
  }
  return 1e9;
}
float handShadow(vec3 p) {
  if (handOn < 0.5) return 1.0;
  vec3 l = normalize(keyPos - p);
  vec3 o = toH(p), d = dirH(l);
  vec2 bh = boxHit(o, d, HLO, HHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1.0;
  float t = max(bh.x, 0.3), res = 1.0;
  for (int i = 0; i < 40; i++) {
    if (t > bh.y) break;
    float h = sdHandSD(o + d * t);
    res = min(res, 7.0 * h / t);
    if (res < 0.01) break;
    t += clamp(h, 0.6, 9.0);
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
vec3 nrmHand(vec3 q) {
  const vec2 k = vec2(1.0, -1.0); const float e = 0.07;
  return normalize(k.xyy * sdHandSD(q + k.xyy * e) + k.yyx * sdHandSD(q + k.yyx * e) + k.yxy * sdHandSD(q + k.yxy * e) + k.xxx * sdHandSD(q + k.xxx * e));
}
float aoHand(vec3 q, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) { float h = 1.0 * float(i * i); o += w * (h - sdHandSD(q + n * h)); w *= 0.55; }
  return clamp(1.0 - 0.08 * o, 0.0, 1.0);
}
float ggx(vec3 N, vec3 H, float rough) {
  float a2 = rough * rough * rough * rough, nh = max(dot(N, H), 0.0);
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * dd * dd);
}
// the glove: matte film2 nitrile, lit from underneath by the light table (its sheen at the edges and creases)
vec3 shadeHand(vec3 P, vec3 rd, int m) {
  vec3 q = toH(P);
  vec3 nl = nrmHand(q);
  if (m == 0) {
    const float e = 0.25;
    vec3 qh = q / HS;
    vec3 g = vec3(wrinkle(qh + vec3(e, 0.0, 0.0)) - wrinkle(qh - vec3(e, 0.0, 0.0)), wrinkle(qh + vec3(0.0, e, 0.0)) - wrinkle(qh - vec3(0.0, e, 0.0)), wrinkle(qh + vec3(0.0, 0.0, e)) - wrinkle(qh - vec3(0.0, 0.0, e))) / (2.0 * e);
    g -= nl * dot(g, nl);
    nl = normalize(nl - g * 0.9);
  }
  vec3 N = fromH(nl);
  vec3 L = normalize(keyPos - P), V = -rd, Hh = normalize(L + V);
  float o = aoHand(q, nl);
  float nv = max(dot(N, V), 0.0);
  float fres = 0.04 + 0.96 * pow(1.0 - nv, 4.0);
  vec3 R = reflect(rd, N);
  float env = mix(0.05, 0.95, smoothstep(0.15, -0.5, R.z)) * panelK;   // the lit table below, mirrored in the sheen
  float diff = max(dot(N, L), 0.0);
  float bounce = max(-N.z, 0.0) * 0.5 * panelK;
  vec3 col;
  if (m == 0) {
    vec3 alb = mix(T_FILM2, T_SILVER, 0.16);
    float spec = ggx(N, Hh, 0.55) * 0.05;
    col = alb * (diff * 1.4 + bounce * 1.6 + 0.2) + T_HALIDE * (env * (0.07 + 0.9 * fres) * 0.5 + spec * (0.4 + fres));
  } else if (m == 2) {
    col = T_HALIDE * 0.7 * (ggx(N, Hh, 0.25) * 0.08 + 0.3 * diff + 0.55 * env * (0.2 + fres) + 0.08);
  } else if (m == 3) {
    float br = 0.9 + 0.1 * sin(q.x * 6.0 / HS + snoise(q * 1.5));
    col = T_SILVER * br * (0.35 * diff + 0.6 * env * (0.25 + fres) + 0.1) + T_HALIDE * ggx(N, Hh, 0.3) * 0.05;
  } else if (m == 1) {
    col = T_FILM * (diff * 0.6 + 0.2) + T_HALIDE * env * fres * 0.3;
  } else {
    float weave = 0.9 + 0.1 * snoise(q * vec3(0.5, 3.0, 3.0));
    col = T_FILM2 * 1.5 * weave * (diff * 1.1 + bounce * 1.2 + 0.2) + T_HALIDE * env * fres * 0.12;
  }
  return col * (m == 0 ? 0.82 : 1.0) * mix(1.0, o, 0.55);
}

// ---- paper
vec3 paperTex(vec2 q, float base) {
  float cloud = 0.5 + 0.5 * snoise(q * 0.02 + 3.0);
  float fib = snoise(q * vec2(2.2, 0.35)) * 0.5 + snoise(q * vec2(0.4, 3.1)) * 0.5;
  return T_LIGHTBOX * base * (0.985 + 0.02 * cloud + 0.007 * fib);
}
vec3 sheetAColor(vec2 q, float lampE) {
  vec2 uv = vec2(q.x / ${f(SHEET.w)} + 0.5, 0.5 - q.y / ${f(SHEET.h)});
  vec3 pr = texG(sheetA, uv, vec2(${f(SHEET.w)}, ${f(SHEET.h)})).rgb;
  vec2 mu = vec2((q.x - ${f(MK.x0)}) / ${f(MK.x1 - MK.x0)}, 1.0 - (q.y - ${f(MK.y0)}) / ${f(MK.y1 - MK.y0)});
  vec3 mk = vec3(0.0);
  if (mu.x > 0.0 && mu.x < 1.0 && mu.y > 0.0 && mu.y < 1.0) mk = texG(marksTex, mu, vec2(${f(MK.x1 - MK.x0)}, ${f(MK.y1 - MK.y0)})).rgb;
  vec2 lu = vec2((q.x - ${f(LYR.x0)}) / ${f(LYR.x1 - LYR.x0)}, 1.0 - (q.y - ${f(LYR.y0)}) / ${f(LYR.y1 - LYR.y0)});
  vec3 ly = vec3(0.0);
  if (lu.x > 0.0 && lu.x < 1.0 && lu.y > 0.0 && lu.y < 1.0) ly = texG(lyrTex, lu, vec2(${f(LYR.x1 - LYR.x0)}, ${f(LYR.y1 - LYR.y0)})).rgb;
  vec3 col = paperTex(q, 0.86 * panelK + 0.05 * lampE);
  col *= 1.0 - 0.34 * clamp(mk.b, 0.0, 1.0);
  col = mix(col, T_SILVER * 0.9, clamp(pr.b, 0.0, 1.0) * 0.85);
  col = mix(col, T_HALIDE, clamp(ly.b, 0.0, 1.0) * 0.8);
  col = mix(col, T_WAX * 0.97, clamp(ly.g, 0.0, 1.0));
  float ink = clamp(pr.r + mk.r + ly.r, 0.0, 1.0);
  return mix(col, T_FILM * 1.6, clamp(ink * 1.12, 0.0, 1.0));
}
vec3 sheetBColor(vec2 q, float lampE, float win) {
  vec2 uv = vec2(q.x / ${f(SHEET.w)} + 0.5, 0.5 - q.y / ${f(SHEET.h)});
  vec3 pr = texG(sheetB, uv, vec2(${f(SHEET.w)}, ${f(SHEET.h)}) * 0.78).rgb;
  vec3 col = paperTex(q * 1.3 + 40.0, mix(0.34, 0.80 * panelK, win) + 0.05 * lampE);
  col = mix(col, T_SILVER * 0.9, clamp(pr.b, 0.0, 1.0) * 0.85);
  return mix(col, T_FILM * 1.6, clamp(pr.r * 1.1, 0.0, 1.0));
}
// the light table: a frosted panel lit from below, masked with black card round a window just larger than her sheet
float winMask(vec2 tp) { return 1.0 - smoothstep(-0.5, 0.5, sdBox2(tp - vec2(0.0, 2.0), vec2(254.0, 170.0), 2.0)); }
vec3 tableColor(vec2 tp) {
  vec2 c = tp - vec2(0.0, 2.0);
  float d = sdBox2(c, vec2(254.0, 170.0), 2.0);
  float r = length(c / vec2(254.0, 170.0));
  vec3 panel = T_LIGHTBOX * (1.06 - 0.1 * r * r) * panelK * (0.99 + 0.012 * snoise(tp * 0.8) + 0.01 * snoise(tp * 0.07));
  // the mask: matte black card, a faint grain, a cut edge catching the light
  vec3 card = T_FILM * (1.9 + 0.5 * snoise(tp * 0.05) + 0.25 * snoise(tp * 1.7)) + T_FILM2 * 0.5 * smoothstep(0.0, 120.0, d);
  float bevel = 1.0 - smoothstep(0.0, 0.9, abs(d - 0.6));
  card += T_HALIDE * 0.22 * bevel;
  return mix(panel, card, smoothstep(-0.4, 0.4, d));
}

vec3 shade(vec2 px) {
  vec2 ndc = px / res * 2.0 - 1.0;
  vec4 qq = invVP * vec4(ndc, 1.0, 1.0);
  vec3 ro = camPos, rd = normalize(qq.xyz / qq.w - camPos);
  float tA = (Z_A - ro.z) / rd.z, tB = (Z_B - ro.z) / rd.z, tT = -ro.z / rd.z;
  vec3 PA = ro + rd * tA, PB = ro + rd * tB, PT = ro + rd * tT;
  gDX = dFdx(TB(PA)); gDY = dFdy(TB(PA));
  int m;
  float tH = marchHand(ro, rd, tA, m);
  if (tH < 1e8) return shadeHand(ro + rd * tH, rd, m);
  vec2 tpA = TB(PA), tpB = TB(PB), tpT = TB(PT);
  vec3 L = normalize(keyPos - PA);
  float lampE = max(L.z, 0.0);
  float shA = handShadow(PA);
  // table
  vec3 col = tableColor(tpT);
  // his sheet (under hers)
  {
    vec2 q = toSheet(tpB, poseB) * 1.0;
    // the sheet's own size is SHEET * poseB.w: toSheet divided by the scale, so q is in sheet mm
    float d = sdBox2(q, HALF, 0.8);
    // its shadow on the table
    vec2 qs = toSheet(tpT + vec2(-1.5, 2.2), poseB);
    float dsh = sdBox2(qs, HALF, 0.8);
    col *= 1.0 - 0.28 * (1.0 - smoothstep(-0.5, 2.5, dsh));
    if (d < 0.0) {
      vec3 b = sheetBColor(q, lampE, winMask(tpB));
      col = mix(col, b, 1.0 - smoothstep(-0.1, 0.1, d));
    }
  }
  // her sheet
  {
    vec2 q = toSheet(tpA, poseA);
    float d = sdBox2(q, HALF, 0.8);
    // the shadow it throws on whatever is below (his sheet, the table), away from the lamp
    vec2 qs = toSheet(TB(PB) + vec2(-1.2, 1.8), poseA);
    float dsh = sdBox2(qs, HALF, 0.8);
    float sA = 1.0 - smoothstep(-0.6, 2.2, dsh);
    // only where his sheet is under the shadow's ray (it is on the table otherwise: the table's shadow above)
    vec2 qt = toSheet(tpT + vec2(-0.9, 1.3), poseA);
    float dst = sdBox2(qt, HALF, 0.8);
    float sT = 1.0 - smoothstep(-0.4, 1.6, dst);
    float inB = 1.0 - smoothstep(-0.1, 0.1, sdBox2(toSheet(tpB, poseB), HALF, 0.8));
    col *= 1.0 - 0.32 * mix(sT, sA, inB);
    if (d < 0.0) {
      vec3 a = sheetAColor(q, lampE);
      // the sheet's cut edge: a thin lit bevel, a hair of shade inside it
      a *= 1.0 - 0.1 * (1.0 - smoothstep(0.0, 0.5, -d));
      a *= shA * 0.35 + 0.65;
      col = mix(col, a, 1.0 - smoothstep(-0.1, 0.1, d));
    }
    // masking tape on her corners
    for (int k = 0; k < 4; k++) {
      vec2 sg = vec2(k < 2 ? -1.0 : 1.0, (k & 1) == 0 ? -1.0 : 1.0);
      vec2 c0 = sg * (HALF - vec2(2.0, 2.0));
      vec2 tq = q - c0;
      float cs = 0.7071, sn = 0.7071 * sg.x * sg.y;
      vec2 r = vec2(cs * tq.x + sn * tq.y, -sn * tq.x + cs * tq.y);
      float tape = sdBox2(r, vec2(15.0, 6.0), 0.3) + 0.25 * snoise(r * vec2(0.9, 2.5));
      float tk = 1.0 - smoothstep(-0.1, 0.3, tape);
      vec3 tc = col * vec3(0.93, 0.945, 0.96) + T_HALIDE * 0.06 + T_LIGHTBOX * 0.1 * (1.0 - smoothstep(0.0, 0.5, abs(tape + 0.2)));
      tc *= 0.96 + 0.04 * snoise(r * vec2(0.4, 5.0));
      col = mix(col, tc, tk * 0.92);
    }
  }
  // the hand's shadow on the table beyond the sheets
  col *= mix(1.0, shA, 0.0);
  return col;
}
void main() {
  vec3 c = vec3(0.0);
  for (int k = ssK0(); k < ssK1(); k++) c += shade(gl_FragCoord.xy + rgss(k) * PX_SCALE);
  vec3 o = c * ssWeight();
  fragColor = vec4(min(o, vec3(0.97)), 1.0);
}`;
