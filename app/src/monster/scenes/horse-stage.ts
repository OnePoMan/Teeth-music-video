// `horse` helper: the stage's background pass, adapted for the two sets of the plate (docs/verse2-plan.md "horse").
//  - belly 0: outside, before the walls of Troy at night: a clay wall (masonry joints, a row of windows with the
//    city's lamps, crenellated against the night) lit by the fire behind us, the wooden horse's shadow on it, the
//    black-glaze ground mirroring it.
//  - belly 1: inside the horse: a barrel vault of clay along z (planks as seam lines, black-glazed ribs) closed at
//    z = wallZ by the horse's chest, whose planks leave gaps onto the night city and its lamps; a black-glaze floor
//    with a hatch that drops open onto the dark ground far below (lit only where our light falls through it); the
//    soldiers are shadows on the walls (`hoplite()` from figures.ts), cast by no one.
// Copied and adapted from stage.ts' BG_FRAG (the vase path only) and its card shadows: Stage is used as is, with this
// pass swapped in for its background (`HorseStage`). Candidates for the shared kit: a pluggable wall tracer in
// BG_FRAG (barrel vault, crenellated wall), a floor-hole hook (`holeCol`), and the depth occluder for things that
// fall through the floor.
import * as THREE from 'three';
import { FSPass, W, H } from '../../engine/gl';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_FIGURES } from '../figures';
import { Stage } from '../stage';

/** Lamps (end-wall gaps), soldiers' rise groups. */
export const NL = 12, NR = 10;

const BG = (NC: number) => /* glsl */ `
${GLSL_FIGURES}
uniform mat4 invVP; uniform vec3 camPos;
uniform vec3 Lc; uniform float LI, reach, rL;
uniform float wallZ, gloss, reflOn, specK;
uniform sampler2D reflTex;
uniform mat4 cardM[${NC}]; uniform vec4 cardBox[${NC}]; uniform vec4 cardMap[${NC}];
uniform float cardS[${NC}]; uniform float cardAt[${NC}]; uniform int nCards;
uniform sampler2D atlas0, atlas1, atlas2, atlas3;
// the plate's own
uniform float belly, barR, barYc, groundY, tNow, wallTop;
uniform vec4 hatchR;            // half-width, z near edge, z far edge, open (0/1)
uniform vec4 horseT, horseA;    // the horse's shadow: x, y, scale, on; hatch, ladder, roll, look
uniform vec4 lampA[${NL}];       // end-wall lamps: x, y, radius, the time it goes out
uniform int nLamp;
uniform float solRise[${NR}];
uniform int nRise;
uniform float solOn, solJolt, solMarch, gapY0, gapSp, gapH;

float atlasA(float k, vec2 uv, float lod) {
  if (k < 0.5) return textureLod(atlas0, uv, lod).a;
  if (k < 1.5) return textureLod(atlas1, uv, lod).a;
  if (k < 2.5) return textureLod(atlas2, uv, lod).a;
  return textureLod(atlas3, uv, lod).a;
}
float cardShadow(vec3 P) {
  float lit = 1.0;
  for (int i = 0; i < ${NC}; i++) {
    if (i >= nCards) break;
    vec3 p = (cardM[i] * vec4(P, 1.0)).xyz;
    vec3 l = (cardM[i] * vec4(Lc, 1.0)).xyz;
    if (p.z * l.z >= 0.0) continue;
    float s = p.z / (p.z - l.z);
    vec2 h = mix(p.xy, l.xy, s);
    vec4 b = cardBox[i];
    float rpx = rL * s / cardS[i];
    float m = rpx + 2.0;
    if (h.x < b.x - m || h.x > b.z + m || h.y < b.y - m || h.y > b.w + m) continue;
    vec2 uv = vec2(cardMap[i].x + h.x, cardMap[i].y - h.y) * cardMap[i].zw;
    float occ = atlasA(cardAt[i], uv, log2(max(1.0, 2.0 * rpx)));
    lit *= 1.0 - occ;
  }
  return 1.0 - lit;
}

float gPix = 0.01;
vec3 clayCol(float b) {
  vec3 clay = mix(mix(C_BLOOD, C_SIGNAL, 0.75), C_EMBER, 0.2) * 0.8;
  return clay * (0.02 + 0.8 * sat(b)) + C_BONE * 0.08 * smoothstep(0.9, 1.8, b);
}
/** A line of half-width w at distance d, anti-aliased by the pixel's footprint. */
float aaLine(float d, float w) { return 1.0 - smoothstep(w - gPix * 0.7, w + gPix * 0.7, d); }
float fallOff(vec3 P) { float d = length(Lc - P); return LI / (1.0 + (d / reach) * (d / reach) * 4.0); }

// ---- tracing the walls
float barrelHit(vec3 o, vec3 r) {
  float a = r.x * r.x + r.y * r.y;
  if (a < 1e-8) return 1e9;
  vec2 oo = vec2(o.x, o.y - barYc);
  float b = oo.x * r.x + oo.y * r.y, c = dot(oo, oo) - barR * barR;
  float disc = b * b - a * c;
  if (disc < 0.0) return 1e9;
  float t = (-b + sqrt(disc)) / a;
  return t > 1e-4 ? t : 1e9;
}
/** Troy's wall: crenellated against the night. */
float crenel(float x) { return wallTop + 0.6 * step(0.5, fract(x / 1.6)); }
/** The nearest wall along a ray; kind 1 the vault, 2 the horse's chest, 3 Troy's wall (0: none). */
float wallTrace(vec3 o, vec3 r, out int kind) {
  kind = 0;
  if (belly > 0.5) {
    float tb = barrelHit(o, r), te = r.z < -1e-6 ? (wallZ - o.z) / r.z : 1e9;
    if (te > 0.0 && te < tb) { kind = 2; return te; }
    if (tb < 1e8) { kind = 1; return tb; }
    return 1e9;
  }
  if (r.z < -1e-6) {
    float t = (wallZ - o.z) / r.z;
    vec3 P = o + r * t;
    if (t > 0.0 && P.y < crenel(P.x)) { kind = 3; return t; }
  }
  return 1e9;
}

// ---- the soldiers: shadows of hoplites on the vault, two staggered rows per side, packed with their shields
float soldierRow(float u, float y, float side, float row) {
  float sp = 1.0, sc = 1.12, y0 = 0.95;
  float u0 = (side > 0.0 ? 0.0 : 0.37) + (row < 0.5 ? 0.0 : sp * 0.5);
  float uH = -0.5 * (hatchR.y + hatchR.z), uMax = -wallZ - 0.55, uMin = -6.0;
  float d = 1e3;
  for (int fam = 0; fam < 2; fam++) {
    // fam 0: before the hatch, walking deeper (+u); fam 1: beyond it, walking back (-u); both go down through it
    float dir = fam == 0 ? 1.0 : -1.0;
    float us = u - dir * solMarch;
    float k0 = floor((us - u0) / sp + 0.5);
    for (int dk = -1; dk <= 1; dk++) {
      float k = k0 + float(dk), uk = u0 + k * sp;
      if (uk < uMin || uk > uMax) continue;
      if (fam == 0 && uk > uH - 0.15) continue;
      if (fam == 1 && uk <= uH - 0.15) continue;
      float pos = uk + dir * solMarch;
      float past = max(dir * (pos - uH), 0.0);
      if (past > 2.2) continue;
      float hk = hash11(k * 7.31 + side * 3.17 + row * 11.3);
      float rt = solRise[int(min(hk * float(nRise), float(nRise) - 1.0))];
      float r = sat((tNow - rt) / 0.32);
      if (r <= 0.0) continue;
      float r1 = r - 1.0;
      r = 1.0 + 2.70158 * r1 * r1 * r1 + 1.70158 * r1 * r1;              // out-back: they stand up (no pow of a negative)
      float feet = y0 - past * 1.25 + solJolt * (0.05 + 0.04 * hk) + (solMarch > 0.0 ? 0.11 * abs(sin(pos * 3.2 + hk * 6.0)) : 0.0);
      vec2 q = vec2(dir * (u - pos), y - feet) / sc;
      q.y /= max(r, 0.05);
      if (abs(q.x) > 0.6 || q.y > 1.7 || q.y < -0.2) continue;
      d = min(d, hoplite(q) * sc * min(r, 1.0));
    }
  }
  return d;
}
float soldiers(vec3 P) {
  if (solOn <= 0.0 || P.y > 3.6) return 0.0;
  float side = P.x > 0.0 ? 1.0 : -1.0, u = -P.z;
  // painted along the wall's arc (from the floor), so the vault's curve does not stretch them
  float a0 = atan(-barYc, sqrt(max(barR * barR - barYc * barYc, 0.0)));
  float s = (atan(P.y - barYc, abs(P.x)) - a0) * barR;
  float d = soldierRow(u, s, side, 0.0);
  float w = max(gPix * 0.8, 0.012);
  return solOn * (1.0 - smoothstep(-w, w, d));
}

// ---- lamps through the gaps: each burns, flares as it goes out (lampA.w), and dies to a coal
vec3 lamps(vec2 xy) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < ${NL}; i++) {
    if (i >= nLamp) break;
    vec4 L = lampA[i];
    float e = tNow - L.w, k;
    if (e < 0.0) k = 0.9 + 0.1 * sin(tNow * 11.0 + float(i) * 2.3);
    else { float f = sat(1.0 - e / 0.3); k = 1.6 * exp(-e / 0.05) + f * f * 0.9; }
    if (k <= 0.002) continue;
    float d = length(xy - L.xy);
    vec3 hue = mix(C_BLOOD, C_EMBER, sat(k));
    c += hue * k * (2.4 * (1.0 - smoothstep(L.z * 0.55, L.z, d)) + 0.55 * exp(-d / (L.z * 2.4)));
  }
  return c;
}
/** The horse's chest: horizontal planks, two battens; how far a point is inside a gap (> 0). */
float gapAt(vec2 xy) {
  float j = floor((xy.y - gapY0) / gapSp + 0.5);
  if (j < 0.0 || j > 2.0) return -1.0;
  float gy = gapY0 + j * gapSp;
  float hw = sqrt(max(barR * barR - (xy.y - barYc) * (xy.y - barYc), 0.0)) - 0.3;
  float g = min(gapH - abs(xy.y - gy), hw - abs(xy.x));
  return min(g, abs(abs(xy.x) - 1.05) - 0.07);
}

vec3 wallNormalK(vec3 P, int kind) { return kind == 1 ? normalize(vec3(-P.x, barYc - P.y, 0.0)) : vec3(0.0, 0.0, 1.0); }

/** A point of a wall, lit and shadowed, with its decoration. */
vec3 wallCol(vec3 P, int kind) {
  vec3 N = wallNormalK(P, kind);
  if (kind == 2) {
    float g = gapAt(P.xy);
    if (g > 0.0) {
      // the night outside, and the city's lamps
      vec3 night = C_INK * 0.5 + C_INK2 * 0.25 * smoothstep(gapY0, gapY0 + 2.0 * gapSp, P.y);
      return mix(clayCol(0.05), night + lamps(P.xy), smoothstep(0.0, gPix * 1.5 + 0.004, g));
    }
  }
  vec3 Lv = normalize(Lc - P);
  float fall = fallOff(P);
  float light = fall * (0.3 + 0.7 * max(dot(N, Lv), 0.0));
  float occ = cardShadow(P), ex = 0.0;
  if (kind == 1) ex = soldiers(P);
  if (kind == 3 && horseT.w > 0.0) {
    float w = max(gPix * 0.75, 0.01);
    float d = trojanHorse((P.xy - horseT.xy) / horseT.z, horseA.x, horseA.y, horseA.z, horseA.w, 0.0) * horseT.z;
    ex = horseT.w * (1.0 - smoothstep(-w, w, d));
  }
  occ = 1.0 - (1.0 - occ) * (1.0 - ex);
  vec2 sp = kind == 1 ? vec2(atan(P.y - barYc, P.x) * barR, P.z) : P.xy;
  float grain = 0.92 + 0.06 * snoise(sp * 1.1) + 0.04 * snoise(sp * 19.0);
  vec3 c = clayCol(light * (1.0 - occ)) * grain;
  vec3 glaze = C_INK * (0.6 + 0.4 * sat(light));
  if (kind == 1) {
    // planks along the vault (seams), and the ribs: black-glazed bands across it
    float pl = abs(fract(sp.x / 0.36) - 0.5) * 0.36;
    c *= 1.0 - 0.45 * aaLine(pl, 0.007);
    float rb = abs(fract((P.z - wallZ) / 1.6) - 0.5) * 1.6;
    c = mix(c, glaze, aaLine(abs(rb - 0.8), 0.07));
    float sa = (atan(P.y - barYc, abs(P.x)) - atan(-barYc, sqrt(max(barR * barR - barYc * barYc, 0.0)))) * barR;
    c = mix(c, glaze, aaLine(abs(sa - 0.88), 0.07));                  // the ledge they stand on
  } else if (kind == 2) {
    // the chest's planks, horizontal; the battens across them, glazed; the gaps' lips catch the light
    float pl = abs(fract((P.y - gapY0) / gapSp * 2.0 + 0.5) - 0.5) * gapSp * 0.5;
    c *= 1.0 - 0.4 * aaLine(pl, 0.006);
    c = mix(c, glaze, aaLine(abs(abs(P.x) - 1.05), 0.07) * step(gapY0 - gapSp, P.y));
    float gp = gapAt(P.xy);
    c = mix(c, C_INK * 0.4, aaLine(-gp, 0.02) * step(gp, 0.0));
  } else if (kind == 3) {
    // masonry courses, staggered joints
    float cy = P.y / 0.62, row = floor(cy);
    float jx = abs(fract(P.x / 1.5 + 0.5 * mod(row, 2.0)) - 0.5) * 1.5;
    float jy = abs(fract(cy) - 0.5) * 0.62;
    c *= 1.0 - 0.32 * max(aaLine(0.31 - jy, 0.012), aaLine(0.75 - jx, 0.012));
    // the windows high in the wall, each with a lamp
    float wy = wallTop - 0.9, kx = floor((P.x - 1.2) / 2.4 + 0.5), hx = hash11(kx * 3.7 + 1.3);
    vec2 wp = vec2(P.x - 1.2 - kx * 2.4 - (hx - 0.5) * 0.5, P.y - wy);
    float win = sdBox(wp, vec2(0.2, 0.3));
    vec2 wc = vec2(P.x - wp.x, wy);
    bool behind = horseT.w > 0.0 && trojanHorse((wc - horseT.xy) / horseT.z, horseA.x, horseA.y, horseA.z, horseA.w, 0.0) * horseT.z < 0.6;
    if (hx > 0.3 && win < 0.0 && !behind) {
      float lg = length(wp - vec2(0.0, -0.08));
      float k = 0.9 + 0.1 * sin(tNow * 9.0 + kx * 1.9);
      c = C_INK * 0.4 + mix(C_SIGNAL, C_EMBER, 0.7) * k * (2.2 * (1.0 - smoothstep(0.05, 0.085, lg)) + 0.4 * exp(-lg / 0.12));
    }
  }
  return c;
}

/** Through the open hatch: the ground far below, dark, lit only where our light falls through the hole. */
vec3 holeCol(vec3 P, vec3 D) {
  float tq = (groundY - P.y) / min(D.y, -1e-4);
  vec3 Q = P + D * tq;
  vec3 Lv = Lc - Q;
  vec3 X = Q + Lv * ((0.0 - Q.y) / max(Lv.y, 1e-4));
  float soft = 0.06;
  float through = smoothstep(-soft, soft, hatchR.x - abs(X.x)) * smoothstep(-soft, soft, hatchR.y - X.z) * smoothstep(-soft, soft, X.z - hatchR.z);
  float occ = cardShadow(Q);
  float grain = 0.9 + 0.1 * snoise(Q.xz * 1.3) + 0.05 * snoise(Q.xz * 17.0);
  vec3 c = clayCol(0.04 + fallOff(Q) * 0.6 * through * (1.0 - occ)) * grain;
  // the hole's cut edge: the planks' thickness, dark
  float rim = min(min(hatchR.x - abs(P.x), hatchR.y - P.z), P.z - hatchR.z);
  float farEdge = 1.0 - smoothstep(0.0, 0.09, P.z - hatchR.z);
  return mix(mix(clayCol(0.08) * 0.5, clayCol(0.6 * fallOff(P)), farEdge), c, smoothstep(0.02, 0.06, rim) * (1.0 - farEdge));
}

void main() {
  vec2 ndc = FRAG_PX / vec2(${W.toFixed(1)}, ${H.toFixed(1)}) * 2.0 - 1.0;
  vec4 q = invVP * vec4(ndc, 1.0, 1.0);
  vec3 D = normalize(q.xyz / q.w - camPos);
  float tG = D.y < -1e-6 ? -camPos.y / D.y : 1e9;
  int kind;
  float tW = wallTrace(camPos, D, kind);
  float tt = min(tG, tW);
  vec3 P = camPos + D * min(tt, 1e3);
  gPix = max(length(fwidth(P)), 1e-5);
  vec3 col = C_INK;
  if (tt < 1e8) {
    if (tW < tG) col = wallCol(P, kind);
    else if (belly > 0.5 && hatchR.w > 0.0 && abs(P.x) < hatchR.x && P.z < hatchR.y && P.z > hatchR.z) col = holeCol(P, D);
    else {
      // black glaze: a little warmth, the room mirrored in it, a low highlight
      float occ = cardShadow(P);
      vec3 Lv = normalize(Lc - P);
      float fall = fallOff(P);
      float b = fall * (0.45 + 0.55 * max(Lv.y, 0.0)) * (1.0 - occ);
      vec3 V = -D, Nf = vec3(0.0, 1.0, 0.0);
      float c5 = 1.0 - max(dot(V, Nf), 0.0);
      float fres = 0.04 + 0.96 * c5 * c5 * c5 * c5 * c5;
      vec3 R = reflect(D, Nf);
      int kR;
      float tR = wallTrace(P, R, kR);
      vec3 refl = tR < 1e8 ? wallCol(P + R * tR, kR) : C_INK;
      if (reflOn > 0.0) {
        vec4 rt = texture(reflTex, FRAG_PX / vec2(${W.toFixed(1)}, ${H.toFixed(1)}));
        if (any(isnan(rt)) || any(isinf(rt))) rt = vec4(0.0);
        refl = mix(refl, rt.rgb, rt.a);
      }
      vec3 Hh = normalize(Lv + V);
      float spec = pow(max(dot(Nf, Hh), 0.0), 260.0) * fall * (1.0 - occ);
      col = C_INK * 0.9 + clayCol(b) * 0.05 + refl * fres * gloss + mix(C_EMBER, C_BONE, 0.45) * spec * 2.5 * specK;
      if (belly > 0.5) {
        // the hatch: its seam reserved in the clay, two hinge straps at its far edge
        vec2 hc = vec2(0.0, 0.5 * (hatchR.y + hatchR.z)), hh = vec2(hatchR.x, 0.5 * (hatchR.y - hatchR.z));
        float seam = aaLine(abs(sdBox(P.xz - hc, hh)), 0.012);
        seam = max(seam, aaLine(sdBox(vec2(abs(P.x) - hatchR.x * 0.6, P.z - hatchR.z - 0.14), vec2(0.03, 0.14)), 0.0));
        col = mix(col, clayCol(b * 1.15 + 0.06), seam);
      }
    }
  } else if (belly < 0.5) {
    col = C_INK + C_INK2 * 0.15 * smoothstep(0.4, -0.1, D.y);
  }
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  fragColor = vec4(col, 1.0);
}`;

/** The plate's own uniforms (set by the scene each frame). */
function horseUniforms(): Record<string, THREE.IUniform> {
  return {
    belly: { value: 1 }, barR: { value: 2.7 }, barYc: { value: 1.1 }, groundY: { value: -6.5 }, tNow: { value: 0 }, wallTop: { value: 8 },
    hatchR: { value: new THREE.Vector4(1.95, -2.0, -3.7, 0) },
    horseT: { value: new THREE.Vector4(0, 0, 1, 0) }, horseA: { value: new THREE.Vector4(1, 1, 0, 0) },
    lampA: { value: Array.from({ length: NL }, () => new THREE.Vector4(0, 0, 0.05, 1e9)) }, nLamp: { value: 0 },
    solRise: { value: new Array(NR).fill(1e9) }, nRise: { value: 1 },
    solOn: { value: 0 }, solJolt: { value: 0 }, solMarch: { value: 0 },
    gapY0: { value: 2.1 }, gapSp: { value: 0.46 }, gapH: { value: 0.1 },
  };
}

/** The kit's Stage with this plate's background pass swapped in (the letters, cards and mirror are the Stage's). */
export class HorseStage extends Stage {
  constructor(maxCards = 16) {
    super({ maxCards });
    const u = { ...this.bg.u, ...horseUniforms() };
    (this as unknown as { bg: FSPass }).bg = new FSPass(BG(this.maxCards), u);
  }
}

// ---------------------------------------------------------------- the hatch's door and the floor's occluder
const DOOR_VERT = /* glsl */ `
precision highp float;
in vec3 position; in vec3 normal;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
out vec3 vW; out vec3 vN; out vec3 vNL; out vec3 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = mat3(modelMatrix) * normal; vNL = normal; vP = position;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const DOOR_FRAG = /* glsl */ `
precision highp float;
in vec3 vW; in vec3 vN; in vec3 vNL; in vec3 vP;
out vec4 fragColor;
${GLSL_COMMON}
uniform vec3 Lc; uniform float LI, reach;
void main() {
  float nl = length(vN);
  vec3 N = nl > 1e-6 ? vN / nl : vec3(0.0, 1.0, 0.0);
  vec3 L = Lc - vW; float d = length(L); L /= d;
  float fall = LI / (1.0 + (d / reach) * (d / reach) * 4.0);
  float lit = max(dot(N, L), 0.0) * fall;
  vec3 clay = mix(mix(C_BLOOD, C_SIGNAL, 0.75), C_EMBER, 0.2) * 0.8;
  // its top is the floor's black glaze; its underside and edges bare wood (clay), planked
  // planks run along the door (z): seams across x every 0.39; the glazed top keeps them reserved in the clay
  float seam = 1.0 - smoothstep(0.008, 0.016, abs(fract(vP.x / 0.65 + 0.5) - 0.5) * 0.65);
  float batten = 1.0 - smoothstep(0.06, 0.075, abs(abs(vP.z) - 0.5));
  vec3 wood = clay * (0.08 + 0.75 * lit);
  vec3 col;
  if (vNL.y > 0.5) col = mix(C_INK * (0.6 + 0.5 * lit) + clay * 0.04, wood * 0.45, max(seam * 0.7, batten * 0.5));
  else if (vNL.y < -0.5) col = wood * (1.0 - 0.6 * seam);
  else col = clay * (0.06 + 0.3 * lit);                      // the edges: bare wood, in the hole's shade
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  fragColor = vec4(col, 1.0);
}`;

/** The hatch: a door hinged at its far edge (pivot at y 0, z = zFar) that swings down; set `angle` (0 shut). */
export class HatchDoor {
  readonly pivot = new THREE.Group();
  readonly mat: THREE.RawShaderMaterial;
  readonly occluder = new THREE.Group();
  constructor(hx: number, zN: number, zF: number) {
    const len = zN - zF, th = 0.12;
    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: DOOR_VERT, fragmentShader: DOOR_FRAG,
      uniforms: { Lc: { value: new THREE.Vector3() }, LI: { value: 1 }, reach: { value: 20 } },
    });
    const door = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 - 0.02, th, len - 0.02), this.mat);
    door.position.set(0, -th / 2, len / 2);
    door.frustumCulled = false;
    this.pivot.position.set(0, 0, zF);
    this.pivot.add(door);
    // the floor as depth only, with the hatch's hole in it: what falls through is seen only through the hole
    const om = new THREE.MeshBasicMaterial({ colorWrite: false });
    const piece = (x0: number, x1: number, z0: number, z1: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), om);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      m.renderOrder = -10;
      m.frustumCulled = false;
      this.occluder.add(m);
    };
    piece(-8, -hx, -20, 12); piece(hx, 8, -20, 12); piece(-hx, hx, zN, 12); piece(-hx, hx, -20, zF);
  }
  set(angle: number, Lc: THREE.Vector3, LI: number, reach: number) {
    this.pivot.rotation.x = angle;
    this.pivot.visible = angle > 0.01;
    this.pivot.updateMatrixWorld(true);
    (this.mat.uniforms.Lc!.value as THREE.Vector3).copy(Lc);
    this.mat.uniforms.LI!.value = LI; this.mat.uniforms.reach!.value = reach;
  }
}
