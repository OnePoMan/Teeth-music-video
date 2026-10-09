// `shield` — chorus 1, lines 12–13 (FOES / OURSELVES?, 59.355–64.689): the shield. A round, deep-dished bronze
// hoplite shield fills the frame, lit by the fire behind us (bronze as the letters' `bronze` look: signal-orange body,
// bone highlight). FOES stands on its face, the side his enemies see, plain and polished. On line 13's first word
// (62.34) the shield swings round on its vertical axis to show its inside, the side his own men see: a clay lining where
// Odysseus's shadow (odysseus.ts, the bow drawn) stands over a row of his men's shades, the arrow aimed down into them,
// painted black-figure. OURSELVES? and the arm strap under it slam on together on the 64.02 downbeat.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { F } from '../../engine/type';
import type { Line } from '../../engine/lyrics';
import { ease, prog } from '../../engine/util';
import { GLSL_SHADE } from '../motifs';
import { GLSL_ODYSSEUS, odysseusUniforms, setOdysseus } from '../odysseus';
import { Stage, Word3D, keyLight, popWords, type Letter } from '../stage';
import { heroFont } from '../shore';

const FOV = 40;
/** The shield: bowl radius, rim radius, the bowl's depth (world). */
const R_BOWL = 2.62, R_RIM = 3.05, DEPTH = 1.0;
/** Inside: the painted ground line (y), Odysseus (x, height), the men (first x, spacing, count), the arm strap (y, half-length, height, z). */
const GROUND = -1.5, ODY = { x: -1.15, h: 2.25 }, MEN = { x0: 0.15, dx: 0.42, n: 5 }, STRAP = { y: 1.22, hl: 1.7, h: 0.66, z: 0.22 };
const NM = MEN.n;
/** His aim: from his shoulders (0.81 h up) down at the middle of the row of men, chest high. */
const ODY_AIM = Math.atan2(GROUND + 0.62 - (GROUND + 0.81 * ODY.h), MEN.x0 + MEN.dx * 1.5 - ODY.x);
const T_SWING = [62.3, 62.78] as const, T_SLAM = 64.02;

/** The bowl's profile (r, depth): the dome out to the rim, then the flat rim and its rolled lip. */
function profile(): THREE.Vector2[] {
  const p: THREE.Vector2[] = [];
  for (let i = 0; i <= 28; i++) { const r = (R_BOWL * i) / 28; p.push(new THREE.Vector2(r, DEPTH * Math.pow(1 - (r / R_BOWL) ** 2, 0.8))); }
  p.push(new THREE.Vector2(R_BOWL + 0.05, -0.01), new THREE.Vector2(R_RIM - 0.06, -0.03), new THREE.Vector2(R_RIM, -0.07), new THREE.Vector2(R_RIM - 0.03, -0.13));
  return p;
}

const SH_VERT = /* glsl */ `
precision highp float;
in vec3 position; in vec3 normal;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
out vec3 vW; out vec3 vN; out vec3 vL; out vec3 vT; out vec3 vR;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = mat3(modelMatrix) * normal; vL = position;
  vec2 rd = position.xz / max(length(position.xz), 1e-4);
  vT = mat3(modelMatrix) * vec3(-rd.y, 0.0, rd.x); vR = mat3(modelMatrix) * vec3(rd.x, 0.0, rd.y);   // turned (circumferential) and radial
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SH_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec3 vW; in vec3 vN; in vec3 vL; in vec3 vT; in vec3 vR;
out vec4 fragColor;
${GLSL_COMMON}
uniform vec3 Lc, camP, axisW; uniform float LI, reach, strap, menT;
uniform float mX[${NM}], mH[${NM}], mV[${NM}];
${GLSL_SHADE}
${GLSL_ODYSSEUS}
// beaten, lathe-turned bronze: a dark umber body warming to signal orange where the fire falls, and instead of a round
// glare a streak of reflected light running across the turned rings (anisotropic along the turning, circumferential T)
vec3 bronzeC(vec3 N, vec3 V, vec3 Lv, vec3 T, float fall, float polish) {
  float tone = sat(pow(max(dot(N, Lv), 0.0), 1.4) * fall * 1.15);
  vec3 umber = mix(C_INK, C_BLOOD, 0.45) * 0.55;
  vec3 body = mix(umber, mix(C_SIGNAL, C_EMBER, 0.25) * 0.9, pow(tone, 0.85));
  vec3 Hh = normalize(Lv + V);
  T = normalize(T - N * dot(T, N));
  float th = dot(T, Hh), aniso = pow(sqrt(max(1.0 - th * th, 0.0)), mix(500.0, 1400.0, polish)) * fall;
  float broad = pow(max(dot(N, Hh), 0.0), 6.0) * fall * 0.06;
  return mix(body, C_BONE * 0.95, sat(aniso * mix(0.45, 0.85, polish) + broad));
}
// the raised turned rings on the face (radius, half-width): height profile and its slope
const vec2 RINGS[4] = vec2[4](vec2(0.62, 0.07), vec2(1.28, 0.08), vec2(1.92, 0.08), vec2(2.42, 0.07));
vec2 ringsH(float r) {
  float h = 0.0, dh = 0.0;
  for (int i = 0; i < 4; i++) {
    float x = (r - RINGS[i].x) / RINGS[i].y, g = exp(-x * x * 2.0);
    h += g; dh += -4.0 * x * g / RINGS[i].y;
  }
  return vec2(h, dh);
}
void main() {
  vec3 N = normalize(vN), V = normalize(camP - vW);
  vec3 Lv = Lc - vW; float dl = length(Lv); Lv /= dl;
  float fall = LI / (1.0 + (dl / reach) * (dl / reach) * 4.0);
  if (dot(N, V) < 0.0) N = -N;
  if (strap > 0.5) { fragColor = vec4(mix(C_INK, C_BLOOD, 0.3) * (0.35 + 0.5 * sat(max(dot(N, Lv), 0.0) * fall)), 1.0); return; }
  bool inside = dot(axisW, V) < 0.0;
  float r = length(vL.xz);
  vec2 X = vec2(vL.x, -vL.z);
  if (!inside || r > ${R_BOWL.toFixed(2)} + 0.03) {
    // the face: turned bronze, concentric raised rings (a bumped normal), umber in the hollows at their feet; the rim
    // a little duller, a groove where the bowl meets it, and a bone highlight running along the rolled lip
    float px = max(fwidth(r), 1e-4);
    vec2 rh = r < ${R_BOWL.toFixed(2)} ? ringsH(r) : vec2(0.0);
    vec3 Nb = normalize(N - normalize(vR) * rh.y * 0.035 * sign(dot(N, normalize(axisW))));
    vec3 col = bronzeC(Nb, V, Lv, vT, fall, r > ${R_BOWL.toFixed(2)} ? 0.4 : 1.0);
    float hollow = 0.0;
    for (int i = 0; i < 4; i++) { float x = abs(r - RINGS[i].x) / RINGS[i].y; hollow = max(hollow, smoothstep(0.9, 1.3, x) * (1.0 - smoothstep(1.3, 2.4, x))); }
    col = mix(col, mix(C_INK, C_BLOOD, 0.4) * 0.35, hollow * 0.55);
    col = mix(col, C_INK * 0.9, (1.0 - smoothstep(0.0, px, abs(r - ${(R_BOWL + 0.06).toFixed(2)}) - 0.012)) * 0.8);
    float lit = sat(0.35 + 0.65 * max(dot(N, Lv), 0.0) * fall * 1.5);
    col = mix(col, C_BONE * 0.95, (1.0 - smoothstep(0.0, px * 1.5, abs(r - ${(R_RIM - 0.035).toFixed(3)}) - 0.018)) * lit);
    fragColor = vec4(col, 1.0);
    return;
  }
  // the inside, as his own men see it: a clay lining, painted black-figure (seen from behind: mirror x)
  vec2 p = vec2(-X.x, X.y);
  float px = max(length(fwidth(p)), 1e-4);
  float b = fall * (0.3 + 0.7 * max(dot(N, Lv), 0.0));
  vec3 clay = mix(mix(C_BLOOD, C_SIGNAL, 0.75), C_EMBER, 0.2) * 0.8;
  vec3 clayL = clay * (0.03 + 0.85 * sat(b)) * (0.94 + 0.06 * snoise(p * 4.0));
  vec3 ink = C_INK * 0.85 + clay * 0.03 * b;
  float occ = 0.0, inc = 0.0;
  // the ground line, and a band of tongues below it
  if (p.y < ${GROUND.toFixed(2)} && p.y > ${(GROUND - 0.1).toFixed(2)}) occ = 1.0;
  float ty = ${(GROUND - 0.16).toFixed(2)} - p.y;
  if (ty > 0.0 && ty < 0.32) { float tn = fract(p.x / 0.2); occ = max(occ, (1.0 - smoothstep(-px, px, length(vec2((tn - 0.5) * 0.2, ty * 0.55)) - 0.075)) * step(0.5, fract(p.x / 0.4))); }
  // a ring at the bowl's edge
  occ = max(occ, 1.0 - smoothstep(0.0, px, abs(r - ${(R_BOWL - 0.1).toFixed(2)}) - 0.035));
  // Odysseus, the bow drawn, aimed at his men
  occ = max(occ, odysseusWall(vec2(p.x, p.y - ${GROUND.toFixed(2)}), px));
  // his men: small shades in a row, faces turned to him, the nearest shrinking back
  for (int i = 0; i < ${NM}; i++) {
    vec2 q = vec2(p.x - mX[i], p.y - ${GROUND.toFixed(2)}) / mH[i];
    if (abs(q.x) > 0.4 || q.y > 1.1 || q.y < -0.02) continue;
    float lean = 0.12 * (1.0 - float(i) / ${NM}.0) * menT;
    q.x -= lean * q.y;
    float d = figure(q, mV[i]);
    vec2 hc = vec2(0.0, 0.925);
    d = min(d, sdSegment(q, hc + vec2(-0.05, -0.006), hc + vec2(-0.074, -0.026)) - 0.009);
    occ = max(occ, 1.0 - smoothstep(-px, px, d * mH[i]));
  }
  vec3 col = mix(clayL, ink, occ);
  fragColor = vec4(col, 1.0);
}`;

export default class C1Shield extends Scene {
  private st!: Stage;
  private shield = new THREE.Group();
  private mat!: THREE.RawShaderMaterial;
  private strapMat!: THREE.RawShaderMaterial;
  private strap!: THREE.Mesh;
  private foes!: Word3D;
  private ours!: Word3D;
  private phrases: { w: Word3D; on: number[]; exit: number; inside: boolean }[] = [];
  private l1!: Line;
  private l2!: Line;

  override async init() {
    this.st = new Stage({ maxCards: 4 });
    this.l1 = this.ctx.lyrics.lines.find((l) => l.start > 59 && l.start < 60.5 && /foes/i.test(l.text))!;
    this.l2 = this.ctx.lyrics.lines.find((l) => l.start > 62 && l.start < 63 && /ourselves/i.test(l.text))!;
    const mx: number[] = [], mh: number[] = [], mv: number[] = [];
    for (let i = 0; i < NM; i++) { mx.push(MEN.x0 + i * MEN.dx + (i % 2) * 0.04); mh.push(0.95 + 0.12 * ((i * 0.618) % 1)); mv.push((i * 0.37 + 0.11) % 1); }
    const uni = () => ({
      Lc: { value: new THREE.Vector3() }, camP: { value: new THREE.Vector3() }, axisW: { value: new THREE.Vector3(0, 0, 1) },
      LI: { value: 1 }, reach: { value: 30 }, strap: { value: 0 }, menT: { value: 0 },
      mX: { value: mx }, mH: { value: mh }, mV: { value: mv }, ...odysseusUniforms(),
    });
    const mk = () => new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: SH_VERT, fragmentShader: SH_FRAG, side: THREE.DoubleSide, uniforms: uni() });
    this.mat = mk();
    this.strapMat = mk(); this.strapMat.uniforms.strap!.value = 1;
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile(), 180), this.mat);
    bowl.rotation.x = Math.PI / 2;                                   // the lathe's axis (y) to the shield's (+z, the face)
    this.shield.add(bowl);
    const strap = this.strap = new THREE.Mesh(new THREE.BoxGeometry(STRAP.hl * 2, STRAP.h, 0.07), this.strapMat);
    strap.position.set(0, STRAP.y, STRAP.z);
    this.shield.add(strap);
    this.st.scene.add(this.shield);

    const w1 = this.l1.words, w2 = this.l2.words;
    const fi = w1.findIndex((w) => /foes/i.test(w.w)), oi = w2.findIndex((w) => /ourselves/i.test(w.w));
    this.foes = new Word3D(w1[fi]!.w.toUpperCase().replace(/[^A-Z?]/g, ''), heroFont(), { size: 220 });
    this.ours = new Word3D(w2[oi]!.w.toUpperCase().replace(/[^A-Z?]/g, ''), heroFont(), { size: 220 });
    this.foes.lightMul = 2.0; this.ours.lightMul = 2.0;
    this.st.add(this.foes, { shadows: false });
    this.st.add(this.ours, { shadows: false });
    // small phrases: "What if I've" / "been far too" / "kind to" on the face's rim; "but a monster to" inside
    for (const [a, b, inside] of [[0, 3, false], [3, 6, false], [6, fi, false]] as const) {
      const w = new Word3D(w1.slice(a, b).map((x) => x.w).join(' '), F.archivo(112.5, 600), { size: 200 });
      this.st.add(w, { shadows: false });
      this.phrases.push({ w, on: w1.slice(a, b).map((x) => x.start), exit: w1[b]!.start - 0.08, inside });
    }
    const w = new Word3D(w2.slice(0, oi).map((x) => x.w).join(' '), F.archivo(112.5, 600), { size: 200 });
    this.st.add(w, { shadows: false });
    this.phrases.push({ w, on: w2.slice(0, oi).map((x) => x.start), exit: T_SLAM - 0.05, inside: true });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const w1 = this.l1.words, fi = w1.findIndex((w) => /foes/i.test(w.w));

    // the swing: a half turn on its vertical axis, a little overshoot as it settles
    const sw = prog(t, T_SWING[0], T_SWING[1], ease.inOutCubic);
    const after = Math.max(0, t - T_SWING[1]);
    const yaw = Math.PI * sw + (t > T_SWING[1] ? 0.06 * Math.exp(-after / 0.15) * Math.sin(after * 2 * Math.PI * 3) : 0);
    const slam = t > T_SLAM ? Math.exp(-(t - T_SLAM) / 0.09) : 0;
    const beat1 = t > 61.35 ? Math.exp(-(t - 61.35) / 0.1) : 0;
    this.shield.rotation.set(0.04 * Math.sin(t * 0.7), yaw, 0.02 * beat1);
    this.shield.position.set(0, 0, -0.25 * slam);
    // the arm strap comes with OURSELVES?, slapped across the lining on the downbeat
    const sp = prog(t, T_SLAM - 0.03, T_SLAM + 0.07, ease.outCubic);
    this.strap.visible = sp > 0; this.strap.scale.set(Math.max(sp, 1e-3), 1, 1);
    this.shield.updateMatrixWorld(true);

    const push = 9.4 - 0.25 * prog(t, 59.4, 64.7);
    const pos = new THREE.Vector3(0, 0.05, push);
    this.st.cam.set(pos, new THREE.Vector3(0, 0, 0), FOV);

    // words in the shield's frame (outside: facing +z; inside: facing -z, mirrored so they read from behind)
    const place = (w: Word3D) => { w.group.position.copy(this.shield.position); w.group.quaternion.copy(this.shield.quaternion); w.group.updateMatrixWorld(true); };
    const fw = this.foes, fs = (2 * R_BOWL * 0.82) / fw.width;
    popWords(fw, [w1[fi]!.start], t, (l: Letter) => {
      l.x = (l.penX - fw.width / 2) * fs; l.y = -fw.cap * fs * 0.5; l.z = DEPTH + 0.05; l.yaw = 0; l.s = fs;
    }, { glow: 0.7, exit: T_SWING[0] + 0.2, exitDur: 0.01 });
    place(fw);
    const ow = this.ours, os = (2 * STRAP.hl * 0.9) / ow.width;
    popWords(ow, [T_SLAM], t, (l: Letter) => {
      l.x = -((l.penX - ow.width / 2) * os); l.y = STRAP.y - ow.cap * os * 0.5; l.z = STRAP.z - 0.06; l.yaw = Math.PI; l.s = os;
    }, { glow: 0.9 });
    place(ow);
    for (const p of this.phrases) {
      const s = 0.2 / p.w.cap, x0 = -p.w.width * s / 2;
      popWords(p.w, p.on, t, (l: Letter) => {
        if (!p.inside) { l.x = x0 + l.penX * s; l.y = -1.95; l.z = 0.6; l.yaw = 0; }
        else { l.x = -(x0 + l.penX * s); l.y = GROUND - 0.85; l.z = 0.05; l.yaw = Math.PI; }
        l.s = s;
      }, { exit: p.exit, exitDur: 0.14 });
      place(p.w);
    }

    // Odysseus over his men: the bow drawn on them; they shrink back as OURSELVES? lands
    const L = keyLight(this.st.cam, audio, t, { seed: 4, right: 2.4, up: 1.8, back: 3.0, I: 1.45, reach: 30 });
    const Lc = this.st.lightCentre(L);
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(this.shield.quaternion);
    for (const m of [this.mat, this.strapMat]) {
      const u = m.uniforms;
      (u.Lc!.value as THREE.Vector3).copy(Lc); (u.camP!.value as THREE.Vector3).copy(pos); (u.axisW!.value as THREE.Vector3).copy(axis);
      u.LI!.value = L.I; u.reach!.value = L.reach; u.menT!.value = prog(t, T_SLAM - 0.05, T_SLAM + 0.2, ease.outCubic);
      setOdysseus(u, { x: ODY.x, h: ODY.h, pose: 'archer', turn: 0, aim: ODY_AIM, incise: true, lean: 0, stretch: 1, on: true, hair: 'loose' });
    }
    this.st.render(renderer, out, t, L, { wall: 0, floor: 0 }, { noFlame: true, cards: false, reflect: false, rim: 0.8, spec: 0.05 });
    return { bloom: 0.5, bloomThreshold: 0.9, vignette: 0.6, grain: 0.06, ca: 0.4, halation: 0.3, shake: [0.004 * slam, 0.008 * slam] };
  }
}
