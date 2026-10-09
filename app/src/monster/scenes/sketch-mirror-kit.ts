// Kit for the chorus 1 rework stills (`sketch-mirror.ts`, "Into the water"): the shore's hooks rewritten so that
//  - the far shore holds a crowd of the dead (souls' standing figures, black against a faint ember glow), drawn on
//    the plane of the shore line in world space (so it tilts with the camera's roll), never in the water's mirror;
//  - the water paints up to three soft clay fields under the surface (in screen px, rotated with the roll), with
//    decorative bands (meander, running wave), a Geometric prothesis frieze, a kerostasia pan, and shows the
//    black-figure letters of the mirrored render on them;
//  - letters can be clipped at the water plane (`clipAtWater`): the hero above it lit, its black-figure twin below.
import * as THREE from 'three';
import { W, H } from '../../engine/gl';
import { GLSL_SHADE } from '../motifs';
import { SHORE, Stage, Word3D } from '../stage';

const GW = W.toFixed(1), GH = H.toFixed(1);

export const SKETCH_HOOKS = /* glsl */ `
#define WATER_HOOK
#define REFL_KEEP
uniform float shoreZ, skyI, glowI, crowdD, crowdH, crowdX, crowdPx, crowdOne, fR;
uniform vec4 fA[3];   // clay fields: anchor x, y (GL px, just under the surface), half width, depth (px)
uniform vec4 fB[3];   // their bands: top (px below the anchor), height, type (1 meander, 2 running wave), second top (<0 off)
uniform vec4 frz;     // the frieze (field 0): top (px below the anchor), height, biers shown, on
uniform vec4 pan;     // the pan (field 1): centre x, y (local px), half width, on
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) { return 0.0; }
${GLSL_SHADE}
float hash1(float n) { return fract(sin(n * 127.1 + 3.7) * 43758.5453); }
vec3 viewDir() {
  vec2 ndc = FRAG_PX / vec2(${GW}, ${GH}) * 2.0 - 1.0;
  vec4 q = invVP * vec4(ndc, 1.0, 1.0);
  return normalize(q.xyz / q.w - camPos);
}
// the dead on the far shore: rows of standing shades on the shore's plane (world x, y), the front row filling first
float crowd(vec2 p) {
  float h = crowdH, cw = 0.36 * h, m = 0.0, aa = crowdPx;
  p.x -= crowdX;
  for (int r = 0; r < 3; r++) {
    float fr = float(r);
    float dens = sat((crowdD - fr * 0.28) * 1.6);
    if (dens <= 0.0 && !(r == 0 && crowdOne > 0.0)) continue;
    vec2 pr = vec2(p.x + fr * cw * 0.41, p.y - fr * 0.05 * h);
    float ci = floor(pr.x / cw);
    for (int k = -1; k <= 1; k++) {
      float i = ci + float(k);
      bool on = hash1(i * 1.37 + fr * 91.7) < dens || (r == 0 && i == 0.0 && crowdOne > 0.0);
      if (!on) continue;
      float sc = h * (1.0 - 0.08 * fr) * (0.88 + 0.22 * hash1(i * 5.3 + fr));
      float jx = (hash1(i * 3.1 + fr * 7.7) - 0.5) * 0.45 * cw;
      vec2 fq = vec2(pr.x - (i + 0.5) * cw - jx, pr.y) / sc;
      float d = figure(fq, hash1(i * 9.1 + fr * 3.3)) * sc;
      m = max(m, 1.0 - smoothstep(-aa, aa, d));
    }
  }
  return m;
}
vec3 skyTint(vec3 D, vec3 col) {
  float e = max(D.y, 0.0);
  col += mix(C_BLOOD, C_SIGNAL, 0.45) * skyI * (0.6 * exp(-e * 30.0) + 0.06 * exp(-e * 9.0));
  vec3 V = viewDir();
  if (V.y < 0.0 && D.y > 0.0) return col;            // the water's mirror of the sky: no crowd, no glow band
  if (D.z > -1e-4) return col;
  float s = (shoreZ - camPos.z) / D.z;
  vec2 p = camPos.xy + D.xy * s;                     // on the shore's plane
  col += mix(C_BLOOD, C_SIGNAL, 0.55) * glowI * exp(-max(p.y, 0.0) / (crowdH * 1.5));
  return mix(col, C_INK, crowd(p));
}
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  if (wall) return col;
  float beyond = smoothstep(shoreZ + 0.02, shoreZ - 0.02, P.z);
  float dzS = camPos.z - shoreZ, gS = dzS * dzS / (max(camPos.y, 1e-3) * 1484.0);
  float lineG = exp(-abs(P.z - shoreZ) / max(0.06, gPix * 1.5)) * exp(-abs(P.z - shoreZ) / (6.0 * gS + 1.0));
  col = mix(col, skyTint(normalize(P - camPos), C_INK), beyond);
  return col + C_BONE * 0.8 * lineG;
}
vec3 clayField(vec2 q, float depth) {
  return mix(C_SIGNAL * 0.6, C_EMBER * 0.62, 0.2 + 0.2 * snoise(vec2(q.x / 500.0, depth / 200.0)));
}
// a field's soft edge (L: local px, x right, y down from the anchor)
float patchMask(vec2 L, vec4 a) {
  float e = 34.0 * snoise(vec2(L.y / 110.0, stageT * 0.3 + a.x * 0.013));
  float e2 = 30.0 * snoise(vec2(L.x / 140.0, 3.7 + stageT * 0.3));
  float fx = min(a.z, a.w) * 0.28 + 30.0;
  float across = 1.0 - smoothstep(a.z - fx, a.z + fx, abs(L.x) + e);
  float down = smoothstep(-3.0, 8.0, L.y) * (1.0 - smoothstep(a.w - fx, a.w + fx, L.y + e2));
  return across * down;
}
// the Greek key: two rules and a running meander between them (b: x along, y down from the band's top; bh its height)
float meanderSeg(vec2 u) {
  float d = sdSegment(u, vec2(0.0, 0.0), vec2(0.0, 3.0));
  d = min(d, sdSegment(u, vec2(0.0, 3.0), vec2(3.0, 3.0)));
  d = min(d, sdSegment(u, vec2(3.0, 3.0), vec2(3.0, 1.0)));
  d = min(d, sdSegment(u, vec2(3.0, 1.0), vec2(1.0, 1.0)));
  d = min(d, sdSegment(u, vec2(1.0, 1.0), vec2(1.0, 0.0)));
  d = min(d, sdSegment(u, vec2(1.0, 0.0), vec2(4.0, 0.0)));
  return d;
}
float band(vec2 b, float bh, float type) {
  float g = bh / 5.6;
  float d = min(abs(b.y - 0.25 * g), abs(b.y - bh + 0.25 * g)) - 0.2 * g;
  vec2 u = vec2(b.x / g, (bh - 1.3 * g - b.y) / g);    // the pattern's own units, up from its base
  if (type < 1.5) {
    float ux = mod(u.x, 4.0);
    d = min(d, (min(meanderSeg(vec2(ux, u.y)), meanderSeg(vec2(ux - 4.0, u.y))) - 0.24) * g);
  } else {
    // running wave: a crest line curling over
    float crest = abs(u.y - 1.5 - 1.2 * sin(u.x * 1.5708)) - 0.26;
    d = min(d, crest * g * 0.7);
  }
  return 1.0 - smoothstep(-0.8, 0.8, d);
}
// a Geometric mourner: profile-less, both hands raised to the head (units of its height, feet at the origin)
float mourner(vec2 p, float v) {
  float d = length((p - vec2(0.0, 0.885)) * vec2(1.0, 0.85)) - 0.058;
  float yy = sat((p.y - 0.46) / 0.31);
  float tor = max(abs(p.x) - mix(0.022, 0.125, yy), max(p.y - 0.78, 0.44 - p.y));
  d = min(d, tor);
  d = min(d, sdSegment(p, vec2(0.0, 0.76), vec2(0.0, 0.85)) - 0.022);
  for (int k = 0; k < 2; k++) {
    float sx = k == 0 ? -1.0 : 1.0;
    d = min(d, sdSegment(p, vec2(0.115 * sx, 0.77), vec2((0.2 + 0.02 * v) * sx, 0.9)) - 0.019);
    d = min(d, sdSegment(p, vec2((0.2 + 0.02 * v) * sx, 0.9), vec2(0.04 * sx, 0.96)) - 0.017);
    d = min(d, sdSegment(p, vec2(0.035 * sx, 0.46), vec2(0.075 * sx, 0.25)) - 0.042);
    d = min(d, sdSegment(p, vec2(0.075 * sx, 0.25), vec2(0.07 * sx, 0.02)) - 0.02);
    d = min(d, sdSegment(p, vec2(0.07 * sx, 0.015), vec2(0.07 * sx + 0.045, 0.012)) - 0.014);
  }
  return d;
}
// the prothesis: the dead laid out on biers under a chequered shroud, mourners either side (Dipylon style)
float frieze(vec2 L) {
  float fh = frz.y;
  vec2 X = vec2(L.x / fh, (frz.x + fh - L.y) / fh);
  if (X.y < -0.05 || X.y > 1.05) return 0.0;
  float P = 1.95;
  float k = floor(X.x / P + 0.5);
  float x = X.x - k * P;
  float rank = k == 0.0 ? 0.0 : (k > 0.0 ? 2.0 * k - 1.0 : -2.0 * k);
  float shown = sat(frz.z - rank);
  if (shown <= 0.0) return 0.0;
  float d = sdBox(vec2(x, X.y - 0.31), vec2(0.37, 0.02));                 // the bier
  d = min(d, sdBox(vec2(abs(x) - 0.31, X.y - 0.155), vec2(0.016, 0.155)));
  d = min(d, sdBox(vec2(abs(x) - 0.31, X.y - 0.02), vec2(0.035, 0.02)));
  float len = 0.6;                                                        // the dead, head to the left
  vec2 fq = vec2((X.y - 0.33 - 0.075) / len, (0.5 * len - x) / len);
  d = min(d, figure(fq, 0.31 + 0.17 * k) * len);
  float ink = 1.0 - smoothstep(-0.8, 0.8, d * fh);
  // the shroud: a chequered cloth held over the body
  vec2 sp = vec2(x, X.y - 0.6);
  float inS = 1.0 - smoothstep(-0.8, 0.8, sdBox(sp, vec2(0.33, 0.075)) * fh);
  float chk = mod(floor((x + 0.33) / 0.066) + floor((X.y - 0.525) / 0.05), 2.0);
  float rimS = 1.0 - smoothstep(-0.8, 0.8, (abs(sdBox(sp, vec2(0.33, 0.075))) - 0.008) * fh);
  ink = max(ink, max(inS * chk, rimS));
  // mourners: two either side, facing the bier
  float mh = 0.66;
  for (int j = 0; j < 4; j++) {
    float mx = j == 0 ? -0.58 : j == 1 ? -0.83 : j == 2 ? 0.58 : 0.83;
    vec2 mp = vec2(x - mx, X.y) / mh;
    ink = max(ink, 1.0 - smoothstep(-0.8, 0.8, mourner(mp, float(j) * 0.37 + k * 0.21) * mh * fh));
  }
  return ink * shown;
}
// the kerostasia's pan: a black bowl on three cords, the small shades of the living standing in it
float panInk(vec2 L) {
  vec2 p = (L - pan.xy) / pan.z;                 // y down, unit: the pan's half width
  float ps = pan.z;
  float e = (length(p / vec2(1.0, 0.4)) - 1.0) * 0.4;
  float d = max(e, -p.y);                        // the bowl: a half ellipse below its rim
  d = min(d, sdBox(p, vec2(1.04, 0.035)));       // the rim
  d = min(d, sdSegment(p, vec2(-1.0, 0.0), vec2(0.0, -1.7)) - 0.018);
  d = min(d, sdSegment(p, vec2(1.0, 0.0), vec2(0.0, -1.7)) - 0.018);
  d = min(d, length(p - vec2(0.0, -1.72)) - 0.06);
  for (int i = 0; i < 4; i++) {
    float fx = -0.6 + 0.4 * float(i);
    float sh = 0.52 + 0.06 * hash1(float(i) * 4.1);
    vec2 fq = vec2(p.x - fx, -p.y + 0.02) / sh;
    d = min(d, figure(fq, hash1(float(i) * 2.3 + 0.5)) * sh);
  }
  float ink = 1.0 - smoothstep(-0.8, 0.8, d * ps);
  // the bowl's incised band (reserved back to the clay)
  float inc = 1.0 - smoothstep(0.6, 1.4, abs((length(p / vec2(0.82, 0.3)) - 1.0) * 0.3 * ps));
  return ink * (1.0 - inc * step(0.05, p.y));
}
vec3 waterHook(vec2 px, vec2 ruv, vec4 rt, vec3 col) {
  vec2 q = ruv * vec2(${GW}, ${GH});
  float cs = cos(fR), sn = sin(fR), mAll = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 a = fA[i];
    if (a.z <= 0.0) continue;
    vec2 r = q - a.xy;
    vec2 L = vec2(cs * r.x + sn * r.y, sn * r.x - cs * r.y);
    float m = patchMask(L, a);
    if (m <= 0.001) continue;
    col = mix(col, clayField(q, L.y), m);
    float ink = 0.0;
    vec4 b = fB[i];
    if (b.z > 0.5) {
      ink = max(ink, band(vec2(L.x, L.y - b.x), b.y, b.z) * step(-2.0, L.y - b.x) * step(L.y - b.x, b.y + 2.0));
      if (b.w >= 0.0) ink = max(ink, band(vec2(L.x, L.y - b.w), b.y, b.z) * step(-2.0, L.y - b.w) * step(L.y - b.w, b.y + 2.0));
    }
    if (i == 0 && frz.w > 0.0) ink = max(ink, frieze(L) * frz.w);
    if (i == 1 && pan.w > 0.0) ink = max(ink, panInk(L) * pan.w);
    col = mix(col, C_INK, ink * smoothstep(0.15, 0.55, m));
    mAll = max(mAll, m);
  }
  return mix(col, rt.rgb, sat(rt.a * 2.0) * smoothstep(0.08, 0.35, mAll));
}`;

/** The sketch's stage: the rewritten shore hooks and their uniforms. */
export function sketchStage() {
  return new Stage({
    hooks: SKETCH_HOOKS,
    uniforms: {
      shoreZ: { value: SHORE.z }, skyI: { value: 0.06 }, glowI: { value: 0 }, crowdD: { value: 0 }, crowdH: { value: 0.5 },
      crowdX: { value: 0 }, crowdPx: { value: 0.02 }, crowdOne: { value: 0 }, fR: { value: 0 },
      fA: { value: [0, 1, 2].map(() => new THREE.Vector4()) }, fB: { value: [0, 1, 2].map(() => new THREE.Vector4(0, 0, 0, -1)) },
      frz: { value: new THREE.Vector4() }, pan: { value: new THREE.Vector4() },
    },
  });
}

/** Clips a run's letters at the water plane: sign +1 keeps what is above it (a hero in the direct render), -1 what
 *  is below (a black-figure twin in the mirrored render, where the scene is flipped about y = 0). */
export function clipAtWater(w: Word3D, sign: number) {
  for (const l of w.letters) {
    l.mat.uniforms.clipS = { value: sign };
    l.mat.fragmentShader = l.mat.fragmentShader.replace('void main() {',
      'uniform float clipS;\nvoid main() {\n  if (clipS * vW.y < 0.0) discard;');
    l.mat.needsUpdate = true;
  }
}
