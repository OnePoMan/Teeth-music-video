// SKETCH (stills only) — chorus 1, the PROBLEM / HIDING line (~49.0–54.0), ?sketch=mirror&opt=scylla: "Scylla's cliff"
// (Odyssey 12: her cave halfway up a sea cliff whose peak is always in dark cloud; Odysseus sailed past without telling
// his men she was there). PROBLEM stands lit on a rock ledge at the cliff's foot, black water below, its shadow thrown
// up the clay cliff by the fire behind us. On "hiding" the camera starts to climb the cliff face, into the cloud on
// "all along", and arrives at the cave mouth halfway up: on the cave's clay wall her six long necks and heads uncoil in
// black-figure (from the 53.36 downbeat), HIDING painted large among them.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { F } from '../../engine/type';
import type { Line } from '../../engine/lyrics';
import { ease, prog } from '../../engine/util';
import { Stage, Word3D, keyLight, popWords, type Letter } from '../stage';
import { heroFont } from '../shore';

const FOV = 40, TANF = Math.tan((FOV * Math.PI) / 360);
/** The cliff face (z), the cave (centre x, sill y, half-width, the arch's spring y) and the cloud bands (y). */
const WALL_Z = -4, CAVE = { x: 0, y0: 16.0, hw: 3.3, spring: 18.4 }, CAVE_C = 18.6;
/** The ledge at the cliff's foot (x half-width, top y, depth out from the cliff), PROBLEM on it at z. */
const LEDGE = { hw: 7.5, top: 0.42, d: 2.6 }, HERO_Z = WALL_Z + 1.5;
/** The camera: low over the water, then up the face to the cave (start/end y, distance from the cliff). */
const CAM0 = { y: 0.8, d: 16 }, CAM1 = { y: CAVE_C, d: 10.5 };
const T_CLIMB = [51.91, 53.8] as const, T_HIT = 53.36;

const HOOKS = /* glsl */ `
#define WALL_HOOK
uniform float uncoil, stT, camY;
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) { return 0.0; }
// the cave mouth: a round-headed opening (negative inside), world units on the cliff
float caveSd(vec2 p) {
  vec2 q = p - vec2(${CAVE.x.toFixed(2)}, ${CAVE.spring.toFixed(2)});
  float arch = max(length(q) - ${CAVE.hw.toFixed(2)}, -q.y);
  float box = max(abs(p.x - ${CAVE.x.toFixed(2)}) - ${CAVE.hw.toFixed(2)}, max(${CAVE.y0.toFixed(2)} - p.y, p.y - ${CAVE.spring.toFixed(2)}));
  return min(arch, box);
}
// Scylla: six necks rising from the dark at the cave's floor, uncoiling (u 0 coiled, 1 out), each ending in a head with
// its jaws open (three rows of teeth in added white). Returns the ink (x), the incision back to clay (y), added white (z).
vec3 scylla(vec2 p, float u) {
  float ink = 0.0, inc = 0.0, wht = 0.0, px = gPix;
  for (int i = 0; i < 6; i++) {
    float fi = float(i), sg = fi < 2.5 ? -1.0 : 1.0;
    float a0 = (fi - 2.5) * 0.42;                                  // the necks fan out across the opening
    float L = (2.6 + 0.9 * fract(fi * 0.618 + 0.3)) * (0.3 + 0.7 * u);
    vec2 q = vec2(${CAVE.x.toFixed(2)} + (fi - 2.5) * 0.32, ${CAVE.y0.toFixed(2)} - 0.2);
    float th = a0, ds = L / 16.0, dmin = 1e9, sAt = 0.0;
    vec2 e = vec2(0.0, 1.0);
    for (int k = 0; k < 16; k++) {
      float s = (float(k) + 0.5) / 16.0;
      // a serpent's S, wound tight into a coil before she strikes
      th = a0 + 0.55 * sin(PI * s * 1.6 + fi * 1.3) * sg + (1.0 - u) * 9.0 * s * sg + u * 0.5 * s * s * sg;
      e = vec2(sin(th), cos(th));
      vec2 q1 = q + e * ds;
      float r = mix(0.2, 0.11, s);
      float dk = sdSegment(p, q, q1) - r;
      if (dk < dmin) { dmin = dk; sAt = s; }
      q = q1;
    }
    // the head: a long muzzle along the neck's last heading, jaws open
    vec2 hp = p - q, ax = e, nx = vec2(-e.y, e.x);
    vec2 h = vec2(dot(hp, ax), dot(hp, nx) * sg) / 2.1;
    float head = length((h - vec2(0.12, 0.0)) / vec2(0.36, 0.15)) - 1.0;
    head = min(head * 0.15, length((h - vec2(-0.06, 0.04)) / vec2(0.16, 0.13)) * 0.13 - 0.13);
    float mouth = h.x - 0.02 - abs(h.y + 0.02) / 0.42;             // the gape, a wedge from the throat forward
    float hd = max(head, -mouth * 0.4);
    hd *= 2.1;
    float d = min(dmin, hd);
    float f = 1.0 - smoothstep(-px, px, d);
    ink = max(ink, f);
    // incision: a line along the neck and scale chevrons; the eye
    float along = 1.0 - smoothstep(0.008, 0.008 + px, abs(dmin + 0.06));
    float eye = 1.0 - smoothstep(0.03, 0.03 + px, abs(length(h - vec2(-0.02, 0.07)) - 0.04));
    inc = max(inc, f * max(along * step(dmin, hd), eye));
    // teeth: added white, a saw along each jaw inside the gape
    float inMouth = step(0.0, mouth) * step(h.x, 0.48);
    float sawT = abs(fract(h.x * 22.0) - 0.5) * 0.035;
    float jaw = (abs(abs(h.y + 0.02) - (h.x - 0.02) * 0.42) - sawT) * 2.1;
    wht = max(wht, inMouth * (1.0 - smoothstep(0.0, px, jaw - 0.006)) * step(0.06, h.x) * smoothstep(0.6, 0.9, u));
  }
  return vec3(ink, inc, wht);
}
vec3 wallHook(vec3 P, vec3 col) {
  float px = gPix, lum = luma(col);
  vec3 clayL = col, ink = C_INK * 0.85 + col * 0.04;
  // fissures: the rock's few cracks, drawn in glaze
  col *= 0.78 + 0.3 * smoothstep(-0.6, 0.6, snoise(P.xy * vec2(0.09, 0.05) + 7.0));
  float n = snoise(vec2(P.x * 0.2 + 0.12 * snoise(P.xy * 0.3), P.y * 0.015) + 3.1);
  float cr = abs(n) / 0.2;
  col = mix(col, ink, (1.0 - smoothstep(0.03, 0.03 + px, cr)) * smoothstep(0.1, 0.5, snoise(P.xy * vec2(0.05, 0.12) + 1.7)));
  // bands at the foot, as on a pot: black glaze at the waterline, a thin reserved line, a zigzag band
  float y = P.y;
  if (y < 0.3) col = ink;
  else if (y > 2.05 && y < 2.15) col = ink;
  else if (y > 2.25 && y < 3.05) {
    float x = P.x / 0.55, tri = abs(fract(x) - 0.5) * 2.0;
    float yy = 2.33 + tri * 0.64;
    col = mix(col, ink, 1.0 - smoothstep(0.045, 0.045 + px, abs(y - yy)));
  }
  else if (y > 3.15 && y < 3.25) col = ink;
  // the cave
  float cs = caveSd(P.xy);
  if (cs < 0.0) {
    // inside: her wall, a step back and darker, the lip's shadow along the top; she is painted on it
    float deep = smoothstep(0.0, 1.1, -cs);
    vec3 back = clayL * mix(0.25, 0.85, deep) * (0.9 + 0.1 * smoothstep(${CAVE.y0.toFixed(2)}, ${CAVE.y0 + 1.5}, y));
    vec3 s = scylla(P.xy, uncoil);
    back = mix(back, ink, s.x);
    back = mix(back, clayL * 0.9, s.y);
    back = mix(back, C_BONE * 0.9, s.z);
    // the dark she comes from, at the sill
    back = mix(back, ink, (1.0 - smoothstep(0.0, 0.7, y - ${CAVE.y0.toFixed(2)})) * (1.0 - smoothstep(1.2, 2.6, abs(P.x - ${CAVE.x.toFixed(2)}))));
    col = back;
  } else if (cs < 0.22) col = ink;
  else if (P.y < ${CAVE.y0.toFixed(2)}) {}                                     // the lip, in glaze
  else if (cs < 0.95) {
    // tongues round the mouth, alternate black and clay
    vec2 q = P.xy - vec2(${CAVE.x.toFixed(2)}, ${CAVE.spring.toFixed(2)});
    float along = q.y > 0.0 ? atan(q.x, q.y) * (${CAVE.hw.toFixed(2)} + 0.6) : (q.x > 0.0 ? 1.0 : -1.0) * (${(CAVE.hw * 1.5708 + 0.6 * 1.5708).toFixed(3)} - q.y);
    float tn = fract(along / 0.42), r = (cs - 0.3) / 0.6;
    float tongue = length(vec2((tn - 0.5) * 2.0, r * 1.2)) - 0.85;
    float tg = (1.0 - smoothstep(-0.04, 0.04, tongue)) * step(0.0, r);
    col = mix(col, ink, tg * step(0.5, fract(along / 0.84)));
    col = mix(col, ink, 1.0 - smoothstep(0.0, px, abs(cs - 0.92) - 0.03));
  }
  return col;
}
// the cloud: a wreath round the cliff below the cave, and the cap that always hides the peak
float cloudD(vec3 p) {
  float n = 0.6 + 0.7 * snoise(vec2(p.x * 0.12 + stT * 0.15, p.y * 0.35 + p.z * 0.1));
  float wreath = smoothstep(5.5, 8.0, p.y) * (1.0 - smoothstep(14.6, 16.9, p.y)) * max(n, 0.0);
  float cap = smoothstep(22.0, 26.0, p.y + 1.5 * snoise(vec2(p.x * 0.1, stT * 0.1)));
  return wreath * 1.3 + cap * 2.0;
}
vec3 fogged(vec3 P, vec3 col) {
  vec3 r = P - camPos; float len = min(length(r), 70.0); vec3 dir = normalize(r);
  float acc = 0.0, ds = len / 12.0;
  for (int i = 0; i < 12; i++) acc += cloudD(camPos + dir * ds * (float(i) + 0.5));
  float f = 1.0 - exp(-acc * ds * 0.32);
  vec3 smoke = C_INK * 1.2 + mix(C_BLOOD, C_SIGNAL, 0.5) * 0.035 * exp(-len * 0.05);
  return mix(col, smoke, f);
}
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return fogged(P, col); }
vec3 skyTint(vec3 D, vec3 col) { return fogged(camPos + D * 70.0, col); }`;

const ROCK_VERT = /* glsl */ `
precision highp float;
in vec3 position; in vec3 normal;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
out vec3 vW; out vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// the ledge: clay rock lit by the fire, its top a black-glaze shelf, a glaze band at the waterline
const ROCK_FRAG = /* glsl */ `
precision highp float;
in vec3 vW; in vec3 vN;
out vec4 fragColor;
${GLSL_COMMON}
uniform vec3 Lc; uniform float LI, reach;
void main() {
  vec3 N = normalize(vN);
  vec3 Lv = Lc - vW; float dl = length(Lv); Lv /= dl;
  float fall = LI / (1.0 + (dl / reach) * (dl / reach) * 4.0);
  float b = fall * (0.3 + 0.7 * max(dot(N, Lv), 0.0));
  vec3 clay = mix(mix(C_BLOOD, C_SIGNAL, 0.75), C_EMBER, 0.2) * 0.8;
  float grain = 0.9 + 0.1 * snoise(vW.xy * 1.3 + vW.z);
  vec3 col = clay * (0.02 + 0.8 * sat(b)) * grain;
  float top = step(0.5, N.y), y = abs(vW.y);
  col = mix(col, C_INK * 0.9 + clay * 0.03 * b, step(y, 0.12) * (1.0 - top));
  if (top < 0.5 && y > 0.2 && y < 0.25) col = C_INK * 0.9;
  fragColor = vec4(col, 1.0);
}`;

export default class SketchC1Scylla extends Scene {
  private st!: Stage;
  private hero!: Word3D;
  private hiding!: Word3D;
  private phrases: { w: Word3D; on: number[]; exit: number }[] = [];
  private rock!: THREE.RawShaderMaterial;
  private line!: Line;

  override async init() {
    this.st = new Stage({ hooks: HOOKS, maxCards: 24, uniforms: { uncoil: { value: 0 }, stT: { value: 0 }, camY: { value: 0 } } });
    this.line = this.ctx.lyrics.lines.find((l) => l.start > 49 && l.start < 50 && /problem/i.test(l.text))!;
    const ws = this.line.words;
    const pi = ws.findIndex((w) => /problem/i.test(w.w)), hi = ws.findIndex((w) => /hiding/i.test(w.w));
    this.rock = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG,
      uniforms: { Lc: { value: new THREE.Vector3() }, LI: { value: 1 }, reach: { value: 30 } },
    });
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(LEDGE.hw * 2, LEDGE.top + 0.8, LEDGE.d), this.rock);
    ledge.position.set(0, (LEDGE.top - 0.8) / 2, WALL_Z + LEDGE.d / 2);
    this.st.scene.add(ledge);
    this.hero = new Word3D(ws[pi]!.w.toUpperCase().replace(/[^A-Z?]/g, ''), heroFont(), { size: 220 });
    this.hero.lightMul = 2.2;
    this.st.add(this.hero);
    // the small phrases: "What if I'm the", "that's been", "all along?"
    for (const [a, b, exit] of [[0, pi, ws[pi]!.start + 0.45], [pi + 1, hi, ws[hi]!.start + 0.3], [hi + 1, ws.length, 54.2]] as const) {
      const w = new Word3D(ws.slice(a, b).map((x) => x.w).join(' '), F.archivo(112.5, 600), { size: 200 });
      this.st.add(w, { shadows: false });
      this.phrases.push({ w, on: ws.slice(a, b).map((x) => x.start), exit });
    }
    // HIDING, painted among her necks: black-figure, its contours incised back to the clay
    this.hiding = new Word3D('HIDING', heroFont(), { size: 220, incise: true, depth: 4 });
    for (const l of this.hiding.letters) { l.mat.uniforms.bf!.value = 1; l.mat.side = THREE.DoubleSide; }
    this.st.add(this.hiding, { shadows: false });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const ws = this.line.words, pi = ws.findIndex((w) => /problem/i.test(w.w));

    // the climb: up the face from the waterline to the cave; the look leads upward while climbing, then settles on her
    const uc = prog(t, T_CLIMB[0], T_CLIMB[1]), c = uc * uc * (2.4 - 1.4 * uc);
    const cy = CAM0.y + (CAM1.y - CAM0.y) * c, cd = CAM0.d + (CAM1.d - CAM0.d) * c;
    const lookY = (1 - c) * 3.0 + c * CAM1.y + 3.5 * Math.sin(Math.PI * uc);
    const jolt = Math.exp(-Math.max(0, t - 50.69) / 0.08) * (t > 50.69 ? 1 : 0);
    const pos = new THREE.Vector3(0.3 * (1 - c), cy + 0.03 * jolt, WALL_Z + cd);
    this.st.cam.set(pos, new THREE.Vector3(0, lookY, WALL_Z), FOV);

    // PROBLEM on the ledge, at hero scale
    const hw = this.hero, dist = pos.z - HERO_Z;
    const s0 = (0.72 * 2 * (CAM0.d - (HERO_Z - WALL_Z)) * TANF * (16 / 9)) / hw.width;
    popWords(hw, [ws[pi]!.start], t, (l: Letter) => { l.x = (l.penX - hw.width / 2) * s0; l.z = HERO_Z; l.y = LEDGE.top; l.yaw = 0; l.s = s0; }, { glow: 0.7 });
    void dist;

    // the small phrases: on the water near us, then (all along?) riding up with us in the cloud
    const [p0, p1, p2] = this.phrases as [typeof this.phrases[0], typeof this.phrases[0], typeof this.phrases[0]];
    const sm = (p: typeof p0, x0: number, y: number, z: number, cap: number) => {
      const s = cap / p.w.cap;
      popWords(p.w, p.on, t, (l: Letter) => { l.x = x0 + l.penX * s; l.z = z; l.y = y; l.s = s; l.yaw = 0.12; }, { exit: p.exit, exitDur: 0.14 });
    };
    sm(p0, -3.2, 0, WALL_Z + 9.5, 0.2);
    sm(p1, 1.0, 0, WALL_Z + 9.8, 0.2);
    sm(p2, -1.9, cy + (lookY - cy) * (4.5 / cd) - 0.55, pos.z - 4.5, 0.15);

    // HIDING and her necks: from the downbeat
    const un = prog(t, T_HIT - 0.04, T_HIT + 0.55, ease.outCubic);
    const hd = this.hiding, hs = (CAVE.hw * 2 * 0.86) / hd.width;
    hd.letters.forEach((l, i) => {
      l.x = CAVE.x - (hd.width / 2) * hs + l.penX * hs; l.y = CAVE_C - 0.15 - hd.cap * hs / 2; l.z = WALL_Z + 0.03; l.yaw = 0; l.hinge = 0; l.s = hs;
      l.on = t >= T_HIT + i * 0.035 ? 1 : 0;
      l.mat.uniforms.glow!.value = 0;
    });
    hd.update();

    const u = this.st.bg.u;
    u.uncoil!.value = un; u.stT!.value = t; u.camY!.value = cy;
    const L = keyLight(this.st.cam, audio, t, { seed: 12, right: 2.2, up: 1.6, back: 3.0, I: 1.25, reach: 22 });
    const Lc = this.st.lightCentre(L), ru = this.rock.uniforms;
    (ru.Lc!.value as THREE.Vector3).copy(Lc); ru.LI!.value = L.I; ru.reach!.value = L.reach;
    this.st.render(renderer, out, t, L, { wall: 1, wallZ: WALL_Z, gloss: 0.7, swell: 0.4, wine: 0.85, reflBend: 0.25 }, {
      noFlame: true, rim: 0.9, spec: 0.05,
      mirror: { before: () => { (ru.Lc!.value as THREE.Vector3).y *= -1; }, after: () => { (ru.Lc!.value as THREE.Vector3).y *= -1; } },
    });
    return { bloom: 0.55, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.45, halation: 0.3, shake: [0.003 * jolt, 0.006 * jolt] };
  }
}
