// `typesheet` helpers: the light. The sheet is painted flat in Canvas2D (albedo: paper, film, ink, type), and this
// pass lights it: the cold overhead over the review table, the backlit lightbox and film, the UV lamp's beam
// (plate 6), the luminol bloom (plate 11), the work light / desk lamp in a cold or a tungsten key (taste call 4), and
// a raking light across relief set in stone (plates 9, 10). A second canvas holds what emits (fluor under the beam,
// luminol, the match red), a third the relief's height and the rigid-object mask.
import * as THREE from 'three';
import { FSPass, H } from '../../engine/gl';
import { GLSL_TEETH_PALETTE } from '../palette';

export const NR = 24;
export const LT = { BOARD: 0, LIGHTBOX: 1, UV: 2, LUMINOL: 3, LAMP: 4, STONE: 5, BED: 6, FILM: 7 } as const;
export type LType = (typeof LT)[keyof typeof LT];

/** One lit region: a rect (logical px, y down) and its light. Meaning of a/b per type in the shader below. */
export interface Region { rect: [number, number, number, number]; type: LType; a?: [number, number, number, number]; b?: [number, number, number, number]; col?: [number, number, number] }

const FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
uniform sampler2D albedo, glow, hgt;
uniform vec4 rRect[${NR}], rA[${NR}], rB[${NR}];
uniform vec3 rCol[${NR}];
uniform int nR;
uniform float glowGain;
const float HH = ${H.toFixed(1)};

vec2 toUv(vec2 p) { return vec2(p.x / 1920.0, 1.0 - p.y / HH); }
// an elliptical, rotated pool of light: 1 at the centre, soft to 0
float pool(vec2 p, vec4 e, float ang, float pw) {
  vec2 d = rot2(-ang) * (p - e.xy);
  float r = length(d / e.zw);
  return pow(clamp(1.0 - r, 0.0, 1.0), pw) * (0.6 + 0.4 * smoothstep(1.0, 0.0, r));
}
float height(vec2 p) { return texture(hgt, toUv(p)).r; }
// plain-woven cotton (logical px): over-under threads ~3.5 px apart, with slubs
float weave(vec2 p) {
  vec2 c = floor(p / 3.5);
  float tx = pow(abs(sin(p.x * 0.8976)), 0.5), ty = pow(abs(sin(p.y * 0.8976)), 0.5);
  float over = mod(c.x + c.y, 2.0);
  float th = mix(tx, ty, over);
  float slub = 0.9 + 0.1 * snoise(vec2(p.x * 0.02, p.y * 0.4)) + 0.06 * snoise(vec2(p.x * 0.5, p.y * 0.015));
  return (0.55 + 0.45 * th) * slub;
}
// an unmade sheet (local px): smooth crests and sharp creases (abs of noise), stretched along two fold
// directions and gently warped, over a slow swell
float bedH(vec2 q) {
  vec2 w = vec2(fbm(q * 0.004 + 3.1, 2), fbm(q * 0.004 + 7.7, 2)) * 60.0;
  vec2 a = rot2(0.45) * (q + w) * vec2(0.0022, 0.0068);
  vec2 b = rot2(-0.6) * (q - w * 0.6) * vec2(0.0028, 0.0085) + 5.3;
  float na = snoise(a), nb = snoise(b);
  return 0.7 * sqrt(na * na + 0.006) + 0.35 * sqrt(nb * nb + 0.01) + 0.25 * snoise(q * 0.003 + 11.0);
}

void main() {
  vec2 p = vec2(FRAG_PX.x, HH - FRAG_PX.y);
  vec3 alb = texture(albedo, vUv).rgb;
  vec3 emi = texture(glow, vUv).rgb;
  float lum = luma(alb);
  // ---- the review table: one cold overhead tube, a soft fall-off to the corners
  vec2 q = (p - vec2(900.0, 300.0)) / vec2(1500.0, 1100.0);
  float over = 0.78 + 0.2 * exp(-dot(q, q) * 1.6);
  vec3 L = vec3(over);
  // paper fibre (bright albedo) and film-base mottle (dark albedo)
  float fib = fbm(p * vec2(0.09, 0.022), 3) * 0.022 + (hash12(floor(p * 1.5)) - 0.5) * 0.012;
  float mot = fbm(p * 0.006, 4) * 0.16 + fbm(p * 0.05, 2) * 0.05;
  float paper = smoothstep(0.25, 0.6, lum);
  vec3 col = alb * L * (1.0 + mix(mot, fib, paper));
  float g = glowGain;
  for (int i = 0; i < ${NR}; i++) {
    if (i >= nR) break;
    vec4 R = rRect[i];
    if (p.x < R.x || p.y < R.y || p.x > R.x + R.z || p.y > R.y + R.w) continue;
    int ty = int(rB[i].w + 0.5);
    vec4 A = rA[i], Bq = rB[i];
    vec3 kc = rCol[i];
    vec2 lp = (p - R.xy) / R.zw;
    if (ty == ${LT.LIGHTBOX} || ty == ${LT.FILM}) {
      // backlit: the diffuser glows evenly, a touch brighter in the middle; film transmits it, its base mottled
      float bump = 0.95 + 0.05 * exp(-dot(lp - 0.5, lp - 0.5) * 3.0);
      float diff = 1.0 + (hash12(floor(p * 1.3)) - 0.5) * 0.008;
      float m = ty == ${LT.FILM} ? (1.0 + fbm(p * 0.012, 4) * 0.22 * (1.0 - paper)) : 1.0;
      col = alb * kc * bump * diff * m;
    } else if (ty == ${LT.UV}) {
      // the dark bench, a hand-held UV lamp's beam (a defined edge, brighter at its heart): the cotton's weave
      // reflects violet; the dried trace fluoresces in the threads, only inside the beam, never above white (no halo)
      vec2 d = rot2(-Bq.x) * (p - A.xy);
      float r = length(d / A.zw);
      float b = smoothstep(1.0, 0.82, r) * (0.4 + 0.6 * smoothstep(1.0, 0.15, r));
      float wv = weave(p);
      col = vec3(lum) * wv * (T_FILM2 * 0.35 + T_UV * (b + 0.1 * exp(-r * r * 1.5)) * Bq.y);
      float blot = 0.75 + 0.25 * smoothstep(-0.4, 0.4, fbm(p * 0.05, 3));
      emi *= smoothstep(0.0, 0.5, b) * wv * blot * 0.92;
      g = 1.0;
    } else if (ty == ${LT.LUMINOL}) {
      // a dark room; where the luminol lands on the stain it glows blue: only in the shirt's weave (hgt.b), one bloom
      // over the heart; the bag's print in front stands dark against it, the rest of the room catches a little light
      vec2 d = (p - A.xy) / A.z;
      float n = fbm(p * 0.02, 4);
      float field = exp(-dot(d, d) * (1.4 + 0.8 * n)) * A.w;
      float shirt = texture(hgt, toUv(p)).b;
      col = alb * (vec3(0.14) + T_LUMINOL * field * 0.3);
      col += T_LUMINOL * field * shirt * weave(p * 0.8) * (0.85 + 0.35 * n);
      g = 1.0;
    } else if (ty == ${LT.LAMP}) {
      // a lamp's pool on a dark desk / bed (cold or tungsten key)
      float b = pool(p, A, Bq.x, Bq.z);
      col = alb * kc * (Bq.y + b * 1.12) * (1.0 + mix(mot, fib, paper) * 0.8);
    } else if (ty == ${LT.STONE}) {
      // matt dental stone, relief lit by a low raking key
      float e = 1.5, hs = A.w;
      float dx = height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0));
      float dy = height(p + vec2(0.0, e)) - height(p - vec2(0.0, e));
      vec3 n = normalize(vec3(-dx * hs, -dy * hs, 1.0));
      vec3 Ld = normalize(A.xyz * vec3(1.0, 1.0, 0.0) + vec3(0.0, 0.0, 0.42));
      float pore = 1.0 + (hash12(floor(p * 1.2)) - 0.5) * 0.06 + fbm(p * 0.04, 3) * 0.05;
      float b = pool(p, vec4(R.x + R.z * 0.3, R.y + R.w * 0.35, R.z * 1.1, R.w * 1.3), 0.0, 1.0);
      float ndl = max(dot(n, Ld), 0.0);
      float rigid = texture(hgt, toUv(p)).g;
      float lit = min(1.12, 0.2 + 0.85 * (ndl / Ld.z) * (0.75 + 0.3 * b));
      col = mix(alb * kc * pore * lit, col, rigid);
    } else if (ty == ${LT.BED}) {
      // the bed seen from above under a raking work light: the mattress, the pillow and the thrown-back cover as
      // relief (hgt.r), the sheet's folds where it lies loose (hgt.b), the placard rigid and flat (hgt.g)
      vec4 hm = texture(hgt, toUv(p));
      float rigid = hm.g, fm = hm.b;
      vec2 lq = p - R.xy;
      float h0 = bedH(lq), hx = bedH(lq + vec2(1.0, 0.0)), hy = bedH(lq + vec2(0.0, 1.0));
      float e = 1.5;
      float rx = height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0));
      float ry = height(p + vec2(0.0, e)) - height(p - vec2(0.0, e));
      vec3 n = normalize(vec3(-(hx - h0) * 26.0 * fm - rx * 8.0, -(hy - h0) * 26.0 * fm - ry * 8.0, 1.0));
      n = normalize(mix(n, vec3(0.0, 0.0, 1.0), rigid));
      vec3 Ld = normalize(vec3(A.x, A.y, 0.55));
      float b = pool(p, Bq.xyzz * vec4(1.0, 1.0, 1.0, 0.75), A.z, 1.2);
      float ndl = max(dot(n, Ld), 0.0);
      float cav = mix(1.0 - 0.2 * fm * (1.0 - smoothstep(0.0, 0.6, h0)), 1.0, rigid);
      col = alb * kc * cav * (A.w + b * (0.25 + 1.05 * ndl));
    }
  }
  fragColor = vec4(col + emi * g, 1.0);
}`;

export class SheetLight {
  pass: FSPass;
  constructor(albedo: THREE.Texture, glow: THREE.Texture, hgt: THREE.Texture) {
    const arr4 = () => Array.from({ length: NR }, () => new THREE.Vector4());
    this.pass = new FSPass(FRAG, {
      albedo: { value: albedo }, glow: { value: glow }, hgt: { value: hgt },
      rRect: { value: arr4() }, rA: { value: arr4() }, rB: { value: arr4() },
      rCol: { value: Array.from({ length: NR }, () => new THREE.Vector3()) },
      nR: { value: 0 }, glowGain: { value: 1.7 },
    });
  }
  set(regions: Region[]) {
    const u = this.pass.u;
    const R = u.rRect!.value as THREE.Vector4[], A = u.rA!.value as THREE.Vector4[], B = u.rB!.value as THREE.Vector4[], C = u.rCol!.value as THREE.Vector3[];
    regions.slice(0, NR).forEach((r, i) => {
      R[i]!.set(...r.rect);
      A[i]!.set(...(r.a ?? [0, 0, 1, 1]));
      const b = r.b ?? [0, 0, 1, 0];
      B[i]!.set(b[0], b[1], b[2], r.type);
      C[i]!.set(...(r.col ?? [1, 1, 1]));
    });
    u.nR!.value = Math.min(NR, regions.length);
  }
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget) { this.pass.render(renderer, out); }
}
