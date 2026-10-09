// SKETCH (stills only) — chorus 1, the GUILT? line (~54.0–59.4), ?sketch=mirror&opt=vase: "the funeral vase". A giant
// Geometric funeral krater (the Dipylon grave-marker) stands on the black-glaze floor in the fire's light, a real 3D
// object; the camera tracks round it along its figure band. Bands of zigzags and meanders; the prothesis frieze
// (mirror-kit's drawing: the dead on biers under chequered shrouds, mourners with both hands at their heads), one bier
// appearing per sung word from the 55.80 word to the 58.02 word. The band ends on a burial mound with an oar planted on
// it (Elpenor's grave, Odyssey 11). The small phrases pop on the rim as sung; GUILT? stands on the rim on 58.42 as
// the camera rises over the lip.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { F } from '../../engine/type';
import type { Line } from '../../engine/lyrics';
import { clamp, ease, prog } from '../../engine/util';
import { GLSL_SHADE } from '../motifs';
import { Stage, Word3D, keyLight, popWords, type Letter } from '../stage';
import { heroFont } from '../shore';
import { GLSL_FRIEZE } from './mirror-kit';

const FOV = 40, TANF = Math.tan((FOV * Math.PI) / 360);
/** The krater's scale, the frieze (bottom y, height), the band's reference radius (arc length = angle x R_BAND). */
const VS = 1.6, FRZ = { y: 3.6 * VS, h: 1.3 }, R_BAND = 6.2;
/** The rim: its top (y) and radius. */
const RIM = { y: 5.72 * VS, r: 3.9 * VS };
/** Bier spacing along the band (the frieze's period, 1.95 frieze heights) and the mound's place (in biers). */
const SPACING = 1.95 * FRZ.h, MOUND_K = 6.15;

/** The krater's profile (unscaled r, y): foot, stem, body, shoulder, lip; then the inside of the bowl. */
const PROFILE: [number, number][] = [
  [0.0, 0.0], [1.75, 0.0], [1.75, 0.14], [1.5, 0.32], [1.28, 0.9], [1.22, 1.4], [1.9, 1.72], [2.9, 2.2], [3.55, 2.75],
  [3.92, 3.35], [4.0, 3.8], [3.9, 4.4], [3.72, 4.9], [3.68, 5.35], [3.82, 5.58], [3.95, 5.68], [3.9, 5.72],
  [3.72, 5.7], [3.56, 5.3], [3.45, 4.6], [3.1, 3.8], [2.0, 3.25], [0.0, 3.1],
];
const LIP_I = 16;

const VASE_VERT = /* glsl */ `
precision highp float;
in vec3 position; in vec3 normal; in vec2 uv;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
out vec3 vW; out vec3 vN; out vec3 vL; out float vIn;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = mat3(modelMatrix) * normal; vL = position; vIn = uv.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const VASE_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec3 vW; in vec3 vN; in vec3 vL; in float vIn;
out vec4 fragColor;
${GLSL_COMMON}
uniform vec3 Lc, camP; uniform float LI, reach, phi, nShown, bornT[6], stT, inner0;
float hash1(float n) { return fract(sin(n * 127.1 + 3.7) * 43758.5453); }
vec4 frz;
${GLSL_SHADE}
${GLSL_FRIEZE}
// a zigzag line between two rules (b: x along, y down from the band's top, px; bh its height)
float zigzag(vec2 b, float bh, float per) {
  float g = bh / 5.6;
  float d = min(abs(b.y - 0.25 * g), abs(b.y - bh + 0.25 * g)) - 0.2 * g;
  float x = b.x / per, tri = abs(fract(x) - 0.5) * 2.0;
  float h = bh - 2.4 * g, yy = 1.2 * g + tri * h;
  float sl = 2.0 * h / per;
  d = min(d, abs(b.y - yy) / sqrt(1.0 + sl * sl * 4.0) - 0.22 * g);
  return 1.0 - smoothstep(-0.8, 0.8, d);
}
// Elpenor's grave: a mound with his oar planted on it, blade up (X: frieze units, x from the mound's centre, y up)
float mound(vec2 X) {
  float d = max(length(X / vec2(0.62, 0.3)) - 1.0, -X.y) * 0.3;
  d = min(d, sdSegment(X, vec2(0.04, 0.2), vec2(0.0, 0.8)) - 0.014);
  d = min(d, length((X - vec2(-0.012, 0.86)) / vec2(0.045, 0.13)) - 1.0);
  d = min(d, sdSegment(X, vec2(-0.025, 0.66), vec2(0.03, 0.66)) - 0.008);
  return d;
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(camP - vW);
  bool inside = vIn > inner0;
  if (dot(N, V) < 0.0) N = -N;
  vec3 Lv = Lc - vW; float dl = length(Lv); Lv /= dl;
  float fall = LI / (1.0 + (dl / reach) * (dl / reach) * 4.0);
  float b = fall * (0.25 + 0.75 * max(dot(N, Lv), 0.0));
  vec3 clay = mix(mix(C_BLOOD, C_SIGNAL, 0.75), C_EMBER, 0.2) * 0.8;
  vec3 clayLit = clay * (0.02 + 0.85 * sat(b)) + C_BONE * 0.06 * smoothstep(0.9, 1.8, b);
  vec3 glaze = C_INK * 0.9 + clay * 0.03 * sat(b);
  if (inside) { fragColor = vec4(glaze * 0.6, 1.0); return; }
  // the band's coordinates: arc length round the vase (continuous about the camera's side) and height
  float dth = atan(vL.x, vL.z) - phi;
  dth -= TAU * floor((dth + PI) / TAU);
  float u = (phi + dth) * ${R_BAND.toFixed(2)}, y = vL.y;
  float pw = max(length(fwidth(vec2(u, y))) * PX_SCALE, 1e-5);
  float ink = 0.0;
  float fy0 = ${FRZ.y.toFixed(3)}, fh = ${FRZ.h.toFixed(3)}, top = fy0 + fh;
  // decoration by height, from the lip down (black glaze on the clay)
  float sc = ${VS.toFixed(2)};
  if (y > 5.5 * sc) ink = 1.0;                                                   // the lip
  else if (y > 5.02 * sc) ink = band(vec2(u, 5.5 * sc - y) / pw, 0.48 * sc / pw, 1.0);   // the meander on the neck
  else if (y > 4.95 * sc) ink = 0.0;
  else if (y > 4.88 * sc) ink = 1.0;
  else if (y > top + 0.42) ink = zigzag(vec2(u, 4.88 * sc - y) / pw, (4.88 * sc - top - 0.42) / pw, 0.38 / pw);
  else if (y > top + 0.06) ink = band(vec2(u, top + 0.42 - y) / pw, 0.36 / pw, 1.0);
  else if (y > top) ink = 1.0;
  else if (y > fy0) {
    // the prothesis: biers by sequence along the band, each appearing on its word; the mound at the band's end
    vec2 X = vec2(u / fh, (y - fy0) / fh);
    float k = floor((X.x - 0.45) / 1.95) + 1.0;   // a bier and the mourners before it come in together
    float vis = 0.0;
    for (int i = 0; i < 6; i++) if (float(i) == k) vis = sat((stT - bornT[i]) / 0.1) * step(float(i), nShown - 0.5);
    frz = vec4(0.0, fh / pw, 99.0, 1.0);
    if (k >= 0.0 && k <= 5.0) ink = frieze(vec2(u, top - y) / pw) * vis;
    float md = mound(vec2(X.x - ${MOUND_K.toFixed(2)} * 1.95, X.y - 0.02));
    ink = max(ink, 1.0 - smoothstep(-0.8, 0.8, md * fh / pw));
  }
  else if (y > fy0 - 0.08) ink = 1.0;
  else if (y > fy0 - 0.5) ink = zigzag(vec2(u, fy0 - 0.08 - y) / pw, 0.42 / pw, 0.3 / pw);
  else if (y > fy0 - 0.58) ink = 1.0;
  else if (y > 2.4 * sc) { float f = fract((fy0 - 0.58 - y) / 0.2); ink = smoothstep(0.62, 0.66, f) * (1.0 - smoothstep(0.86, 0.9, f)); }
  else { ink = 1.0; if (y < 1.5 * sc && y > 1.35 * sc) ink = 0.0; if (y < 0.45 && y > 0.35) ink = 0.0; }
  vec3 Hh = normalize(Lv + V);
  float spec = pow(max(dot(N, Hh), 0.0), 60.0) * fall * 0.18;
  vec3 col = mix(clayLit, glaze + vec3(spec) * mix(C_EMBER, C_BONE, 0.5), sat(ink));
  fragColor = vec4(col, 1.0);
}`;

/** Camera arc position (along the band) through the shot: biers come in from the right as their words are sung. */
function camU(t: number) {
  const k: [number, number][] = [[54.0, -11.4], [55.8, -1.3], [58.02, 11.4]];
  if (t >= 58.02) return 11.4 + (MOUND_K * SPACING - 0.6 - 11.4) * ease.outQuad(clamp((t - 58.02) / 1.28));
  for (let i = 1; i < k.length; i++) if (t <= k[i]![0]) {
    const [t0, u0] = k[i - 1]!, [t1, u1] = k[i]!;
    return u0 + ((u1 - u0) * (t - t0)) / (t1 - t0);
  }
  return k[0]![1];
}

export default class SketchC1Vase extends Scene {
  private st!: Stage;
  private vase!: THREE.Mesh;
  private mat!: THREE.RawShaderMaterial;
  private hero!: Word3D;
  private phrases: { w: Word3D; on: number[]; exit: number }[] = [];
  private line!: Line;

  override async init() {
    this.st = new Stage({ maxCards: 4 });
    this.line = this.ctx.lyrics.lines.find((l) => l.start > 53.5 && l.start < 55 && /guilt/i.test(l.text))!;
    const ws = this.line.words;
    const geo = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r * VS, y * VS)), 160);
    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VASE_VERT, fragmentShader: VASE_FRAG, side: THREE.DoubleSide,
      uniforms: {
        Lc: { value: new THREE.Vector3() }, camP: { value: new THREE.Vector3() }, LI: { value: 1 }, reach: { value: 30 },
        phi: { value: 0 }, nShown: { value: 0 }, bornT: { value: [0, 0, 0, 0, 0, 0] }, stT: { value: 0 },
        inner0: { value: (LIP_I + 0.5) / (PROFILE.length - 1) },
      },
    });
    this.vase = new THREE.Mesh(geo, this.mat);
    this.st.scene.add(this.vase);
    // the small phrases (1–4 words each), and GUILT?
    const gi = ws.findIndex((w) => /guilt/i.test(w.w));
    const groups = [[0, 3], [3, 6], [6, 8], [8, 10], [10, gi]];
    for (const [a, b] of groups) {
      const w = new Word3D(ws.slice(a, b).map((x) => x.w).join(' '), F.archivo(112.5, 600), { size: 200 });
      this.st.add(w, { shadows: false });
      const next = ws[b]!.start;
      this.phrases.push({ w, on: ws.slice(a, b).map((x) => x.start), exit: b < gi ? next - 0.12 : ws[gi]!.start - 0.05 });
    }
    this.hero = new Word3D(ws[gi]!.w.toUpperCase().replace(/[^A-Z?]/g, ''), heroFont(), { size: 220 });
    this.hero.lightMul = 2.2;
    this.st.add(this.hero, { shadows: false });
  }

  /** Poses a run standing on the rim, centred on the arc angle th (letters face out, along the rim). */
  private onRim(w: Word3D, th: number, s: number) {
    return (l: Letter) => {
      const a = th + ((l.penX - w.width / 2) * s) / RIM.r;
      l.x = RIM.r * Math.sin(a); l.z = RIM.r * Math.cos(a); l.y = RIM.y; l.yaw = a; l.s = s;
    };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const ws = this.line.words, gi = ws.findIndex((w) => /guilt/i.test(w.w)), tG = ws[gi]!.start;
    const ki = ws.findIndex((w) => /killed/i.test(w.w));

    // the camera: round the vase at the frieze's height, rising over the lip for GUILT?
    const phi = camU(t) / R_BAND;
    const up = prog(t, tG - 0.12, tG + 0.5, ease.inOutCubic);
    const rc = 12.0 + 4.0 * up, cy = 7.5 + 3.1 * up, ly = 7.9 + 0.5 * up;
    const pos = new THREE.Vector3(rc * Math.sin(phi), cy, rc * Math.cos(phi));
    const at = new THREE.Vector3(R_BAND * Math.sin(phi), ly, R_BAND * Math.cos(phi));
    this.st.cam.set(pos, at, FOV);

    // the biers: one per word from the 55.80 word to the 58.02 word
    const born = ws.slice(ki, ki + 6).map((w) => w.start);
    const u = this.mat.uniforms;
    u.phi!.value = phi; u.stT!.value = t; u.bornT!.value = born;
    u.nShown!.value = born.filter((b) => t >= b - 0.02).length;

    // the small phrases on the rim, each where the camera faces at its first word; GUILT? where the shot comes to rest
    for (const p of this.phrases) {
      const s = 0.32 / p.w.cap, th = camU((p.on[0]! + p.exit) / 2) / R_BAND;
      popWords(p.w, p.on, t, this.onRim(p.w, th, s), { exit: p.exit, exitDur: 0.14 });
    }
    const hd = rc - RIM.r, fw = 2 * hd * TANF * (16 / 9);
    const hs = (0.42 * fw) / this.hero.width;
    popWords(this.hero, [tG], t, this.onRim(this.hero, camU(59.4) / R_BAND, hs), { glow: 0.7 });

    const L = keyLight(this.st.cam, audio, t, { seed: 9, right: 3.2, up: 2.6, back: 3.0, I: 1.7, reach: 42 });
    const Lc = this.st.lightCentre(L);
    (u.Lc!.value as THREE.Vector3).copy(Lc); (u.camP!.value as THREE.Vector3).copy(pos);
    u.LI!.value = L.I; u.reach!.value = L.reach;
    this.st.render(renderer, out, t, L, { wall: 0, gloss: 0.55 }, {
      noFlame: true, cards: false, rim: 0.8, spec: 0.05,
      // the glaze mirrors the vase lit from above (the mirrored scene is flipped about the floor)
      mirror: { before: () => { (u.Lc!.value as THREE.Vector3).y *= -1; (u.camP!.value as THREE.Vector3).y *= -1; },
        after: () => { (u.Lc!.value as THREE.Vector3).y *= -1; (u.camP!.value as THREE.Vector3).y *= -1; } },
    });
    return { bloom: 0.5, bloomThreshold: 0.9, vignette: 0.6, grain: 0.06, ca: 0.4, halation: 0.3 };
  }
}
