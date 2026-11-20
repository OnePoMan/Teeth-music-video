// Plate 8 `voice`: the frame. A ray-cast bench (analytic: the bench, the aluminium splicing block with its channel and
// slots, the two tape halves and the splicing strip, the monitor on its stand) plus the gloved hand of match-glsl.ts
// (ray-marched; its pen swapped for a razor blade). The monitor's picture (waveform, spectrogram, caption lane, the
// hero word) is a function of the screen's own mm coordinates and is also what the block, tape, bench and glove reflect.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL } from '../../engine/gl';
import { GLSL_HAND as MATCH_HAND } from './match-glsl';
import { VD } from './voice-data';
import { SPD, XP, YC, HP, ZB, XS, MON, TCUT, TAPE_END, HS, TSL } from './voice-script';

const f = (x: number) => x.toFixed(4);
const HAND = MATCH_HAND.replace('ax * 190.0', 'ax * 1100.0').replace('float sdPen(vec3 p, out int m) {', 'float sdPenOld(vec3 p, out int m) {');

export const VOICE_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
uniform float bladeOn;
float sdPen(vec3 p, out int m);
${HAND}
// the razor: a flat single-edge blade standing in the hand's x-z plane, pinched by the thumb and the middle finger,
// the index on its spine; its cutting edge is the low side (z = -1)
float sdPen(vec3 p, out int m) {
  m = 3;
  if (bladeOn < 0.5) return 1e5;
  vec3 q = p - vec3(25.0, -0.3, 8.5);
  vec3 d = abs(q) - vec3(17.0, 0.26, 9.5);
  float b = length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - 0.06;
  vec2 sq = abs(p.xz - vec2(24.0, 8.5)) - vec2(6.5, 2.0);
  float slot = length(max(sq, 0.0)) + min(max(sq.x, sq.y), 0.0) - 1.4;
  return max(b, -slot);
}

uniform mat4 invVP; uniform vec3 camPos; uniform vec2 res; uniform float pxAng;
uniform sampler2D waveTex, specTex, laneTex, heroTex, labTex;
uniform vec3 keyPos;
uniform vec3 hTip, hE1, hE2, hE3; uniform float handOn;
uniform float tDisp, blurTau, gain, flash, glow;
uniform vec4 stp;    // the strip: centre x, y (mm), lift above the tape (mm), on
uniform vec2 dof;    // focus distance (mm), lens aperture radius (mm; 0: everything sharp)
uniform vec4 spl;    // cutOn, half gap (mm, along the horizontal of the 45 degree band), left half's shift (s), right half's shift (s)
uniform vec4 tp;     // tape travel (mm), tape gap (mm), right half's y jog (mm), strip on
uniform vec4 heroA;  // atlas row (-1: none), state (1 light, 2 heavy), width (mm), nominal height (mm)
uniform vec4 heroB;  // centre x (mm), the lie is split (1), letters, word width (px)
uniform float hLX[13]; uniform float hS[12];

const float SPD = ${f(SPD)}, XP = ${f(XP)}, YC = ${f(YC)}, HP = ${f(HP)}, A0 = 0.5;
const float ZB = ${f(ZB)}, XS = ${f(XS)}, CUTT = ${f(TCUT)};
const float VT0 = ${f(VD.t0)}, VTW = ${f(VD.nWave * VD.waveDt)}, VTS = ${f(VD.nSpec * VD.specDt)};
const float SLANT = 0.004;
const vec3 BLO = vec3(-90.0, -26.0, 0.0), BHI = vec3(90.0, 26.0, ZB);
const vec3 MP0 = vec3(0.0, ${f(MON.y0)}, ${f(MON.z0)});
const vec3 RV = vec3(1.0, 0.0, 0.0), UV_ = vec3(0.0, ${f(Math.sin(MON.tilt))}, ${f(Math.cos(MON.tilt))}), NM = vec3(0.0, -${f(Math.cos(MON.tilt))}, ${f(Math.sin(MON.tilt))});
const float TAPEW = 3.175;
const float CUTMARK = XS + ${f(TAPE_END)} - 2.0;
const float R2 = 0.70711;
const float HS = ${f(HS)};

float aaf(float d, float fw) { return clamp(0.5 - d / max(fw, 1e-4), 0.0, 1.0); }
float sdBox2(vec2 p, vec2 h, float r) { vec2 q = abs(p) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float boxT(vec3 ro, vec3 rd, vec3 lo, vec3 hi, out vec3 n) {
  vec3 iv = 1.0 / rd; vec3 t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z), tf = min(min(tmax.x, tmax.y), tmax.z);
  n = vec3(0.0, 0.0, 1.0);
  if (tn > tf || tf < 0.0 || tn < 0.0) return 1e9;
  n = -sign(rd) * step(tmin.yzx, tmin.xyz) * step(tmin.zxy, tmin.xyz);
  return tn;
}

// ------------------------------------------------------------------ the monitor's picture
vec4 spliceW(float tau, float yrel, float e) {
  if (spl.x < 0.5) return vec4(1.0, 0.0, tau, tau);
  float fw = e * SPD;
  float tL = tau - spl.z, tR = tau - spl.w;
  // the cut is a 45 degree band: the same slash through the waveform, the spectrogram and the word
  float uL = (tL - CUTT) * SPD + yrel, uR = (tR - CUTT) * SPD + yrel;
  float wR = smoothstep(-fw, fw, uR - spl.y);
  float wL = smoothstep(-fw, fw, -(uL + spl.y));
  return vec4(wL, wR, tL, tR);
}
vec3 wv(float t) { return textureLod(waveTex, vec2((t - VT0) / VTW, 0.5), 0.0).rgb; }
// (coverage, edge) of the waveform at content time tau, y offset dy (mm) from the centre line
vec2 waveTap(float tau, float dy, float fw) {
  vec4 w = spliceW(tau, dy, fw / SPD);
  float cov = 0.0, eg = 0.0;
  for (int h = 0; h < 2; h++) {
    float wt = h == 0 ? w.x : w.y;
    if (wt < 0.002) continue;
    vec3 a = wv(h == 0 ? w.z : w.w);
    float P = min(a.r * A0 * gain, 1.0) * HP, N = min(a.g * A0 * gain, 1.0) * HP;
    P = max(P, 0.35); N = max(N, 0.35);
    float c = aaf(dy - P, fw) * aaf(-dy - N, fw);
    float inner = min(P - dy, dy + N);
    cov = max(cov, wt * c);
    eg = max(eg, wt * c * (1.0 - smoothstep(0.0, 0.9 + fw, inner)));
  }
  return vec2(cov, eg);
}
vec2 glyphAt(float sx, float sy, float fw) {
  float u = (sx - (heroB.x - heroA.z * 0.5)) / heroA.z;
  if (u < 0.0 || u >= 1.0) return vec2(0.0);
  int k = 0;
  for (int i = 1; i < 12; i++) if (float(i) < heroB.z && u >= hLX[i]) k = i;
  // every letter stands on the one baseline; the envelope only lifts the tops (never under 0.85 of the cap height)
  float H = heroA.w * hS[k];
  float base = YC - 0.5 * heroA.w;
  float top = min(base + H, YC + HP);
  if (sy > top + fw || sy < base - fw) return vec2(0.0);
  float g = (sy - base) / H;
  float xpx = 40.0 + u * heroB.w;
  float ypx = heroA.x * 320.0 + 280.0 - g * 240.0;
  vec2 uv = vec2(xpx / 1536.0, 1.0 - ypx / 1280.0);
  float lod = max(0.0, log2(max(fw * heroB.w / heroA.z, fw * 240.0 / H)));
  vec4 t = textureLod(heroTex, uv, min(lod, 3.0));
  float edge = clamp((top - sy) / fw + 0.5, 0.0, 1.0);
  return t.rg * edge;
}
vec3 screenCol(vec2 s, float fw) {
  vec3 col = T_FILM * 0.7;
  vec4 heroL = vec4(0.0);
  fw = max(fw, 0.02);
  float tau = tDisp + (s.x - XP) / SPD;
  float past = aaf(s.x - XP, fw);
  // ---- the waveform panel
  if (s.y > 59.0 && s.y < 150.0) {
    float dy = s.y - YC;
    vec3 bg = T_FILM * 0.85;
    // graticule: half-height lines, the centre line, a hairline every half second (no numbers)
    float tk = abs(fract(tau / 0.5 + 0.5) - 0.5) * 0.5 * SPD;
    float tk2 = abs(fract(tau / 2.0 + 0.5) - 0.5) * 2.0 * SPD;
    bg += T_SILVER * 0.10 * aaf(abs(abs(dy) - HP * 0.5) - 0.12, fw);
    bg += T_SILVER * 0.16 * aaf(abs(dy) - 0.12, fw);
    bg += T_SILVER * (0.07 * aaf(tk - 0.1, fw) + 0.09 * aaf(tk2 - 0.14, fw));
    bg += T_SILVER * 0.35 * aaf(abs(abs(dy) - HP) - 0.1, fw);
    vec2 wc = vec2(0.0);
    for (int k = 0; k < 5; k++) wc += waveTap(tau + (float(k) - 2.0) * 0.25 * blurTau, dy, fw);
    wc *= 0.2;
    float lvl = mix(0.62, 1.0, past);
    float ck = smoothstep(1.0, 9.0, gain);
    vec3 fill = T_HALIDE * mix(0.2, 0.55, ck) * lvl * (0.95 + 0.08 * snoise(vec2(tau * 140.0, dy * 0.02)));
    vec3 edge = T_LIGHTBOX * mix(0.7, 0.9, ck) * lvl;
    col = bg;
    col = mix(col, fill, wc.x);
    col = mix(col, edge, clamp(wc.y, 0.0, 1.0) * 0.9);
    // the lie, cut: the word is sliced along the same slant at the playhead and its halves are slid
    if (heroA.x > -0.5) {
      vec2 hv = vec2(0.0);
      if (heroB.y > 0.5) {
        float gm = spl.y;
        float dxL = spl.z * SPD, dxR = spl.w * SPD;
        float wR = smoothstep(-fw, fw, ((s.x - dxR) - XP) + (s.y - YC) - gm);
        float wL = smoothstep(-fw, fw, -(((s.x - dxL) - XP) + (s.y - YC) + gm));
        vec2 a = wL > 0.002 ? glyphAt(s.x - dxL, s.y, fw) * wL : vec2(0.0);
        vec2 b = wR > 0.002 ? glyphAt(s.x - dxR, s.y, fw) * wR : vec2(0.0);
        hv = max(a, b);
      } else hv = glyphAt(s.x, s.y, fw);
      vec3 hc = heroA.y > 1.5 ? T_LIGHTBOX * 0.9 : T_HALIDE * 0.5;
      float ha = heroA.y > 1.5 ? hv.x : hv.y;
      heroL = vec4(hc, clamp(ha, 0.0, 1.0));
    }
  }
  // ---- the caption lane
  else if (s.y >= 36.0 && s.y <= 59.0) {
    col = T_FILM * 0.75;
    vec2 lu = vec2((s.x + 146.0) / 292.0, (s.y - 38.0) / 19.0);
    if (lu.x > 0.0 && lu.x < 1.0 && lu.y > 0.0 && lu.y < 1.0) {
      vec3 v = textureLod(laneTex, lu, max(0.0, log2(fw * 7.0))).rgb;
      col += T_LIGHTBOX * 0.9 * v.r + T_HALIDE * 0.36 * v.b;
    }
    col += T_SILVER * 0.25 * aaf(abs(s.y - 59.0) - 0.1, fw);
  }
  // ---- the spectrogram: built behind the playhead
  else if (s.y >= 2.0 && s.y < 36.0) {
    col = T_FILM * 0.75;
    float yb = (s.y - 3.0) / 32.0;
    float e = fw / SPD;
    vec4 w = spliceW(tau, s.y - YC, e);
    float v = 0.0;
    for (int h = 0; h < 2; h++) {
      float wt = h == 0 ? w.x : w.y;
      if (wt < 0.002) continue;
      float tt = h == 0 ? w.z : w.w;
      float sv = textureLod(specTex, vec2((tt - VT0) / VTS, clamp(yb, 0.0, 1.0)), 0.0).r;
      v = max(v, wt * sv);
    }
    v *= past * step(0.0, yb) * step(yb, 1.0);
    vec3 sc = mix(T_FILM2 * 0.9, T_SILVER * 0.8, smoothstep(0.12, 0.5, v));
    sc = mix(sc, T_HALIDE * 0.95, smoothstep(0.45, 0.8, v));
    sc = mix(sc, T_LIGHTBOX * 0.92, smoothstep(0.8, 1.0, v));
    col = mix(col, sc, step(0.02, v) * 0.96 + 0.0);
    col += T_SILVER * 0.06 * aaf(abs(s.y - YC * 0.0 - 22.0) - 0.1, fw) * 0.0;
  }
  // ---- the ruler above the waveform: ticks only
  if (s.y >= 150.0) {
    float tk = abs(fract(tau / 0.25 + 0.5) - 0.5) * 0.25 * SPD;
    float tl = abs(fract(tau / 1.0 + 0.5) - 0.5) * SPD;
    col = T_FILM * 0.75;
    col += T_SILVER * 0.4 * aaf(tk - 0.12, fw) * step(s.y, 154.0 + 0.0) * step(151.0, s.y);
    col += T_HALIDE * 0.5 * aaf(tl - 0.15, fw) * step(s.y, 158.0) * step(151.0, s.y);
  }
  // ---- the playhead
  // the cut: a dark 45 degree band across the waveform panel and the spectrogram, its edges hairlined
  if (spl.x > 0.5 && s.y > 2.0 && s.y < 150.0 && (s.y < 36.0 || s.y > 59.0)) {
    float uc = (tau - CUTT) * SPD + (s.y - YC);
    float inside = aaf(abs(uc) - spl.y, fw);
    col *= 1.0 - 0.92 * inside;
    col += T_SILVER * 0.5 * aaf(abs(abs(uc) - spl.y) - 0.13, fw) * clamp(spl.y, 0.0, 1.0);
  }
  // the playhead lives in the waveform lane only (and its ruler): never through the hero letters or the transcript
  float heroBand = heroA.x > -0.5 ? step(abs(s.y - YC), 0.62 * heroA.w + 2.0) : 0.0;
  float ph = aaf(abs(s.x - XP) - 0.3, fw) * step(59.0, s.y) * step(s.y, 160.0) * (1.0 - heroBand);
  col = mix(col, T_LIGHTBOX * 0.75, ph);
  float cap = aaf(sdBox2(s - vec2(XP, 157.0), vec2(2.4, 1.6), 0.5), fw);
  col = mix(col, T_LIGHTBOX * 0.75, cap);
  col = mix(col, heroL.rgb, heroL.a);
  // panel dividers
  col += T_SILVER * 0.30 * aaf(abs(s.y - 41.0) - 0.1, fw) * 0.0;
  // the image's own structure: a pixel grid when close, a falloff to the corners
  col *= 1.0 - 0.05 * smoothstep(0.6, 0.0, fw) * (0.5 + 0.5 * sin(s.x * 17.9)) * (0.5 + 0.5 * sin(s.y * 17.9));
  col *= 1.0 - 0.25 * pow(max(abs(s.x) / 148.0, abs(s.y - 81.0) / 81.0), 6.0);
  return col * (1.0 + flash);
}
vec3 reflScreen(vec3 P, vec3 R, vec3 env) {
  float dn = dot(R, NM);
  if (dn >= -1e-3) return env;
  float tt = dot(MP0 - P, NM) / dn;
  if (tt <= 0.0) return env;
  vec3 Q = P + R * tt - MP0;
  vec2 s = vec2(dot(Q, RV), dot(Q, UV_));
  if (abs(s.x) < 148.0 && s.y > 0.0 && s.y < 162.0) return screenCol(s, max(tt * 0.05, 0.5));
  return env;
}

// ------------------------------------------------------------------ the hand
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
  for (int i = 0; i < 150; i++) {
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
  for (int i = 0; i < 36; i++) {
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
// the glove: matte film2 nitrile (the shared glove), lit by the monitor behind the bench: a rim of its light along the
// silhouettes and the planes that face it, a faint lamp so the form still reads; true black in the folds
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
  vec3 Lm = normalize(vec3(0.0, 62.0, 95.0) - P);
  float o = aoHand(q, nl);
  float nv = max(dot(N, V), 0.0);
  float fres = 0.04 + 0.96 * pow(1.0 - nv, 4.0);
  float diff = max(dot(N, L), 0.0);
  float nm = dot(N, Lm);
  float rim = pow(1.0 - nv, 2.2) * smoothstep(-0.25, 0.55, nm);
  float face = max(nm * 0.6 + 0.4, 0.0);
  vec3 R = reflect(rd, N);
  vec3 refl = reflScreen(P, R, vec3(0.0));
  vec3 col;
  if (m == 0) {
    vec3 alb = T_FILM2 * 1.7 + T_SILVER * 0.02;
    float spec = ggx(N, Hh, 0.6) * 0.05;
    col = alb * (face * face * 2.2 + diff * 0.55 + 0.05) + T_HALIDE * 0.8 * rim * (0.35 + 0.65 * face) + T_LIGHTBOX * spec * (0.3 + fres) * 0.5 + refl * fres * 0.1;
  } else if (m == 2) {
    col = T_HALIDE * 0.7 * (ggx(N, Hh, 0.25) * 0.08 + 0.3 * diff + 0.1) + refl * 0.3;
  } else if (m == 3) {
    // the blade: bright steel, a keen edge on the low side
    float bev = 1.0 - smoothstep(1.0, 5.5, q.z / HS);
    float edge = 1.0 - smoothstep(-0.6, 0.7, q.z / HS);
    vec3 steel = mix(T_SILVER * 0.8, T_HALIDE * 0.75, bev);
    col = steel * (0.55 * diff + 0.22) + T_LIGHTBOX * ggx(N, Hh, 0.2) * 0.06 + refl * (0.5 + fres) + T_LIGHTBOX * 0.6 * edge;
  } else if (m == 1) {
    col = T_FILM * (diff * 0.6 + 0.2);
  } else {
    float weave = 0.9 + 0.1 * snoise(q * vec3(0.5, 3.0, 3.0));
    col = T_FILM2 * 1.3 * weave * (face * 1.2 + diff * 0.5 + 0.04) + T_HALIDE * 0.12 * rim;
  }
  return col * mix(1.0, o, 0.55);
}

// ------------------------------------------------------------------ the bench
float blockShadow(vec3 P, vec3 L) { vec3 n; return boxT(P + L * 0.03, L, BLO, BHI, n) < 1e8 ? 0.28 : 1.0; }
vec3 tapeShade(vec2 l, float uT, vec3 P, vec3 rd, float sh, float fw, float dEdge, float dCut) {
  vec3 L = normalize(keyPos - P);
  vec3 N = normalize(vec3(0.0, l.y * 0.075, 1.0));
  vec3 alb = mix(T_FILM2, T_SILVER, 0.2) * 1.35;
  alb *= 0.86 + 0.1 * snoise(vec2(uT * 0.55, l.y * 10.0)) + 0.04 * snoise(vec2(uT * 3.0, l.y * 40.0));
  float diff = max(dot(N, L), 0.0);
  vec3 R = reflect(rd, N);
  float spec = pow(max(dot(R, L), 0.0), 36.0);
  float fr = 0.06 + 0.94 * pow(1.0 - max(-rd.z, 0.0), 4.0);
  vec3 col = alb * (0.3 + 0.8 * diff * sh) + T_HALIDE * spec * 0.55 * sh;
  col += reflScreen(P, R, vec3(0.01)) * (0.2 + 0.7 * fr) * 0.7;
  // timing ticks in grease pencil every 45 mm, and the cut mark just before the slot (slanted with the slot)
  float tk = abs(fract(uT / 45.0 + 0.5) - 0.5) * 45.0;
  col = mix(col, T_LIGHTBOX * 0.62, aaf(tk - 0.45, fw) * aaf(abs(l.y + 1.9) - 0.9, fw) * 0.7);
  float cm = (uT + l.y) - CUTMARK;
  col = mix(col, T_LIGHTBOX * 0.8, aaf(abs(cm) * R2 - 0.5, fw) * 0.85 * (0.75 + 0.25 * snoise(vec2(l.y * 6.0, uT))));
  // the edge: a dark rim and a lit bevel
  col *= 1.0 - 0.5 * (1.0 - smoothstep(0.0, 0.3, min(dEdge, dCut)));
  col += T_HALIDE * 0.16 * (1.0 - smoothstep(0.0, 0.2, abs(min(dEdge, dCut) - 0.25))) * sh;
  return col;
}
vec3 benchCol(vec3 P, vec3 rd, float fw) {
  vec3 L = normalize(keyPos - P);
  float pool = exp(-dot(P.xy - vec2(-10.0, -6.0), P.xy - vec2(-10.0, -6.0)) / 50000.0);
  float sh = blockShadow(P, L) * handShadow(P);
  vec3 alb = T_FILM2 * (0.9 + 0.12 * snoise(P.xy * 0.4) + 0.05 * snoise(P.xy * 3.1));
  vec3 col = alb * (0.1 + 1.0 * pool * L.z * sh);
  vec3 R = reflect(rd, vec3(0.0, 0.0, 1.0));
  float fr = 0.03 + 0.97 * pow(1.0 - max(-rd.z, 0.0), 5.0);
  col += reflScreen(P, R, vec3(0.0)) * fr * 0.55;
  float wx = abs(P.x) - 88.0;
  if (wx > 0.0) {
    float k = wx / 220.0;
    float yoff = (P.x > 0.0 ? 1.0 : -1.0) * 26.0 * k * k;
    vec2 l = vec2(P.x, P.y - yoff);
    float dE = TAPEW - abs(l.y);
    float m = clamp(0.5 + dE / fw, 0.0, 1.0);
    if (m > 0.0) col = mix(col, tapeShade(l, l.x + tp.x, P, rd, sh, fw, dE, 1e3), m);
  }
  col += T_HALIDE * 0.03 * exp(-max(P.y - 40.0, 0.0) / 60.0) * smoothstep(-160.0, 0.0, P.y + 130.0) * 0.5;
  return col;
}
float tapeMask(vec2 l, bool right, float fw, out float dEdge, out float dCut) {
  dEdge = TAPEW - abs(l.y);
  float gt = tp.y * 0.5;
  if (spl.x < 0.5) dCut = 1e3;
  else dCut = right ? ((l.x + l.y) - (XS + gt)) * R2 : ((XS - gt) - (l.x + l.y)) * R2;
  return clamp(0.5 + min(dEdge, dCut) / fw, 0.0, 1.0);
}
vec3 blockTop(vec3 P, vec3 rd, float fw) {
  vec3 L = normalize(keyPos - P);
  float sh = handShadow(P);
  float brush = snoise(vec2(P.x * 0.35, P.y * 26.0)) * 0.5 + snoise(vec2(P.x * 0.9, P.y * 61.0)) * 0.25;
  vec3 alb = mix(T_SILVER, T_HALIDE, 0.3) * (0.62 + 0.1 * brush);
  float diff = max(L.z, 0.0);
  vec3 R = reflect(rd, vec3(0.0, 0.0, 1.0));
  float fr = 0.07 + 0.93 * pow(1.0 - max(-rd.z, 0.0), 5.0);
  float spec = pow(max(dot(R, L), 0.0), 14.0);
  vec3 col = alb * (0.18 + 0.82 * diff * sh) * 0.7 + T_LIGHTBOX * spec * 0.18 * sh;
  vec3 Rj = R; Rj.y += brush * 0.05; Rj = normalize(Rj);
  col += reflScreen(P, Rj, vec3(0.012)) * (0.08 + 0.7 * fr) * (0.85 + 0.15 * brush);
  // the tape channel (the tape lies in it), edges lit
  float dc = abs(P.y) - TAPEW;
  float inCh = aaf(dc, fw);
  col *= mix(1.0, 0.5, inCh);
  col += T_HALIDE * 0.1 * sh * (1.0 - smoothstep(0.0, 0.35, abs(dc))) * 0.8;
  // engraved scale ticks along the front edge (no numerals)
  float ty = P.y + 24.0;
  float tkx = abs(fract(P.x / 5.0 + 0.5) - 0.5) * 5.0;
  float tkL = abs(fract(P.x / 25.0 + 0.5) - 0.5) * 25.0;
  col *= 1.0 - 0.5 * aaf(tkx - 0.1, fw) * aaf(abs(ty - 0.9) - 0.9, fw) - 0.55 * aaf(tkL - 0.12, fw) * aaf(abs(ty - 1.4) - 1.6, fw);
  // the slots: 45 degrees at the middle, 90 and 45 the other way either side
  float s1 = abs((P.x - XS + P.y) * R2) - 0.4;
  float s2 = abs(P.x + 44.0) - 0.4;
  float s3 = 1e3;
  float sl = min(s1, min(s2, s3));
  col = mix(col, T_FILM * 0.8, aaf(sl, fw));
  col += T_HALIDE * 0.12 * sh * (1.0 - smoothstep(0.0, 0.3, abs(sl - 0.3))) * (1.0 - aaf(sl, fw));
  // the tape: left half, right half (on top), the strip
  float sp = tp.x;
  float dE, dC;
  vec2 lL = P.xy - vec2(spl.z * ${f(TSL)}, 0.0);
  float mL = tapeMask(lL, false, fw, dE, dC);
  if (mL > 0.0) col = mix(col, tapeShade(lL, lL.x + sp, P, rd, sh, fw, dE, dC), mL);
  if (spl.x > 0.5) {
    vec2 lR = P.xy - vec2(spl.w * ${f(TSL)}, tp.z);
    float dE2, dC2;
    float mR = tapeMask(lR, true, fw, dE2, dC2);
    // the right half stands a hair proud of the left: its shadow falls on it
    float dEs, dCs;
    float mS = tapeMask(lR + vec2(0.7, 0.55), true, fw, dEs, dCs);
    col *= 1.0 - 0.35 * mS * (1.0 - mR) * mL;
    if (mR > 0.0) col = mix(col, tapeShade(lR, lR.x + sp, P, rd, sh, fw, dE2, dC2), mR);
  }
  return col;
}
vec3 blockFront(vec3 P, vec3 n, vec3 rd) {
  vec3 L = normalize(keyPos - P);
  float sh = handShadow(P);
  float diff = max(dot(n, L), 0.0);
  vec3 alb = mix(T_SILVER, T_HALIDE, 0.35) * (0.8 + 0.06 * snoise(vec2(P.x * 0.3, P.z * 9.0)));
  vec3 col = alb * (0.1 + 0.55 * diff * sh);
  col += T_HALIDE * 0.07 * smoothstep(1.4, 0.0, ZB - P.z);
  col *= 0.5 + 0.5 * smoothstep(0.0, 8.0, P.z);
  return col;
}
vec3 monitorShade(vec2 s, vec3 P, vec3 rd, float t) {
  float fw = t * pxAng / max(abs(dot(rd, NM)), 0.2);
  vec3 L = normalize(keyPos - P);
  bool glass = abs(s.x) < 148.0 && s.y > 0.0 && s.y < 162.0;
  float fr = 0.04 + 0.96 * pow(1.0 - max(dot(-rd, NM), 0.0), 5.0);
  vec3 R = reflect(rd, NM);
  if (glass) {
    vec3 em = screenCol(s, fw);
    float lamp = pow(max(dot(R, L), 0.0), 90.0);
    // the glass: a faint soft reflection of the room, the lamp's streak
    vec3 gl = T_LIGHTBOX * (lamp * 0.035 + 0.006) * (0.4 + fr);
    gl += T_HALIDE * 0.02 * smoothstep(-0.2, 0.9, R.z) * 0.6;
    return em + gl;
  }
  // bezel
  vec3 bz = T_FILM * 1.2 * (0.55 + 0.6 * max(dot(NM, L), 0.0));
  bz += T_HALIDE * 0.05 * smoothstep(1.2, 0.0, abs(abs(s.x) - 148.0) - 0.0) * step(abs(s.x), 149.5) * step(0.0, s.y) * step(s.y, 162.0);
  float edgeD = min(min(158.0 - abs(s.x), s.y + 10.0), 172.0 - s.y);
  bz += T_HALIDE * 0.1 * (1.0 - smoothstep(0.0, 0.9, edgeD));
  bz += T_SILVER * 0.05 * pow(max(dot(R, L), 0.0), 10.0) * 0.5;
  // the label on the top bezel: the voicemail is exhibit 7
  vec2 lq = (s - vec2(-92.0, 167.0)) / vec2(56.0, 7.0);
  if (abs(lq.x) < 0.5 && abs(lq.y) < 0.5) {
    float ink = textureLod(labTex, vec2(lq.x + 0.5, lq.y + 0.5), max(0.0, log2(fw * 11.4))).r;
    vec3 paper = T_HALIDE * 0.5 * (0.5 + 0.5 * max(dot(NM, L), 0.0) + 0.2);
    bz = mix(paper, T_FILM * 1.2, ink);
  }
  return bz;
}

// the splicing strip: clear tape, a floating quad (carried by the glove, then lying on the joint)
vec3 stripOver(vec3 col, vec3 ro, vec3 rd, float tLim) {
  if (stp.w < 0.5 || rd.z > -1e-4) return col;
  float zq = ZB + stp.z + 0.12;
  float tq = (zq - ro.z) / rd.z;
  if (tq <= 0.0 || tq >= tLim) return col;
  vec3 Pq = ro + rd * tq;
  vec2 ls = Pq.xy - stp.xy;
  float fwq = tq * pxAng / max(-rd.z, 0.1);
  float ds = sdBox2(ls, vec2(12.5, 3.55), 0.35);
  float m = aaf(ds, fwq);
  if (m < 0.002) return col;
  vec3 L = normalize(keyPos - Pq);
  vec3 st = col * 0.9 + T_HALIDE * 0.05;
  vec3 Rs = reflect(rd, vec3(0.0, 0.0, 1.0));
  st += T_LIGHTBOX * pow(max(dot(Rs, L), 0.0), 20.0) * 0.18 + reflScreen(Pq, Rs, vec3(0.0)) * 0.3;
  st += T_LIGHTBOX * 0.3 * (1.0 - smoothstep(0.0, 0.28, abs(ds + 0.12)));
  st *= 0.96 + 0.04 * snoise(ls * vec2(0.6, 2.0));
  return mix(col, st, m * 0.9);
}
// the block as a foreground occluder out of focus: a cone-traced coverage (the blur radius at each distance from the
// lens aperture and the focus distance) of the block's box, shaded at the nearest point of it
const vec3 FGOFF = vec3(0.0, -100.0, 40.0);   // the out-of-focus slab sits between the lens and the bench
vec4 blockDof(vec3 ro, vec3 rd, float tLim) {
  vec3 c0 = 0.5 * (BLO + BHI) + FGOFF, hs = 0.5 * (BHI - BLO);
  float cov = 0.0, bestC = 0.0; vec3 Pb = vec3(0.0); float rcb = 0.5;
  float t = 8.0;
  for (int i = 0; i < 44; i++) {
    if (t > tLim) break;
    vec3 P = ro + rd * t;
    vec3 d = abs(P - c0) - hs;
    float h = length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
    float rc = dof.y * abs(t - dof.x) / dof.x + 0.15;
    float c = clamp(0.5 - h / (2.0 * rc), 0.0, 1.0);
    if (c > bestC) { bestC = c; Pb = P; rcb = rc; }
    t += max(h * 0.8, rc * 0.5);
  }
  cov = bestC;
  if (cov < 0.004) return vec4(0.0);
  vec3 Pc = clamp(Pb - FGOFF, BLO, BHI); Pc.z = ZB;
  vec3 colB = blockTop(Pc, rd, max(rcb * 1.4, 0.3));
  return vec4(colB * 0.85, cov);
}

vec3 shade(vec2 px) {
  vec2 ndc = px / res * 2.0 - 1.0;
  vec4 qq = invVP * vec4(ndc, 1.0, 1.0);
  vec3 ro = camPos, rd = normalize(qq.xyz / qq.w - camPos);
  float tBest = 1e9; int id = -1; vec3 nB = vec3(0.0, 0.0, 1.0); vec2 ms = vec2(0.0);
  bool useDof = dof.y > 0.01;
  if (rd.z < -1e-4) { tBest = -ro.z / rd.z; id = 0; }
  vec3 n1; float tBl = boxT(ro, rd, BLO, BHI, n1);
  if (useDof) tBl = 1e9;
  if (tBl < tBest) { tBest = tBl; id = 1; nB = n1; }
  float dn = dot(rd, NM);
  if (dn < -1e-4) {
    float tt = dot(MP0 - ro, NM) / dn;
    if (tt > 0.0 && tt < tBest) {
      vec3 Q = ro + rd * tt - MP0; vec2 s = vec2(dot(Q, RV), dot(Q, UV_));
      if (sdBox2(s - vec2(0.0, 81.0), vec2(158.0, 91.0), 6.0) < 0.0) { tBest = tt; id = 2; ms = s; }
    }
  }
  vec3 n2; float tSt = boxT(ro, rd, vec3(-24.0, 74.0, 0.0), vec3(24.0, 104.0, 30.0), n2);
  if (tSt < tBest) { tBest = tSt; id = 3; nB = n2; }
  vec3 n3; float tBs = boxT(ro, rd, vec3(-80.0, 56.0, 0.0), vec3(80.0, 112.0, 4.0), n3);
  if (tBs < tBest) { tBest = tBs; id = 3; nB = n3; }
  if (rd.y > 1e-4) { float tw = (330.0 - ro.y) / rd.y; if (tw < tBest) { tBest = tw; id = 4; } }
  int m;
  float tH = marchHand(ro, rd, tBest, m);
  if (tH < tBest) return stripOver(shadeHand(ro + rd * tH, rd, m), ro, rd, tH);
  vec3 P = ro + rd * tBest;
  float fwp = tBest * pxAng;
  vec3 col = vec3(0.0);
  if (id == 0) col = benchCol(P, rd, fwp / max(-rd.z, 0.1));
  else if (id == 1) {
    if (nB.z > 0.5) col = blockTop(P, rd, fwp / max(-rd.z, 0.12));
    else col = blockFront(P, nB, rd);
  } else if (id == 2) col = monitorShade(ms, P, rd, tBest);
  else if (id == 3) {
    vec3 L = normalize(keyPos - P);
    col = T_FILM2 * 0.9 * (0.25 + 0.5 * max(dot(nB, L), 0.0)) + T_HALIDE * 0.03;
  } else {
    float h = clamp(P.z / 260.0, 0.0, 1.0);
    col = T_FILM * mix(0.6, 0.3, h) + T_FILM2 * 0.2 * exp(-P.z / 90.0);
  }
  if (useDof) { vec4 fg = blockDof(ro, rd, tBest); col = mix(col, fg.rgb, fg.a); }
  return stripOver(col, ro, rd, tBest);
}
void main() {
  vec3 c = vec3(0.0);
  for (int k = ssK0(); k < ssK1(); k++) c += shade(gl_FragCoord.xy + rgss(k) * PX_SCALE);
  vec3 o = c * ssWeight();
  fragColor = vec4(min(o, vec3(0.97)), 1.0);
}`;
