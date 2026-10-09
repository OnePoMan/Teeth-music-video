// SKETCH (stills only) — chorus 1, the PROBLEM / HIDING line (~49.0–54.0), ?sketch=mirror&opt=scylla: "Scylla's cliff"
// (Odyssey 12: her cave halfway up a sea cliff whose peak is always in dark cloud; Odysseus sailed past without telling
// his men she was there). Wide first: the dark sea, the clay cliff rising into the cloud that hides its peak, the cave a
// dark hole halfway up. In low over the water to PROBLEM, lit on a rock ledge at the cliff's foot, its shadow thrown up the
// clay by the fire behind us. On "hiding" the camera climbs the face, through a wreath of cloud on "all along", to the
// cave mouth: from the 53.36 downbeat her six necks strike out of it in black-figure, beast heads open on rows of teeth,
// HIDING painted large in the cave among them.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { F } from '../../engine/type';
import type { Line } from '../../engine/lyrics';
import { ease, prog } from '../../engine/util';
import { Stage, Word3D, keyLight, popWords, type Letter } from '../stage';
import { heroFont } from '../shore';

const FOV = 40, TANF = Math.tan((FOV * Math.PI) / 360);
/** The cliff face (z), the cave (centre x, sill y, centre y, half-width, height above centre). */
const WALL_Z = -4, CAVE = { x: 0, y0: 16.0, cy: 18.5, hw: 3.5, up: 3.0 }, CAVE_C = 18.8;
/** The ledge at the cliff's foot (x half-width, top y, depth out from the cliff), PROBLEM on it at z. */
const LEDGE = { hw: 7.5, top: 0.42, d: 2.6 }, HERO_Z = WALL_Z + 1.5;
/** The camera: wide on the whole cliff, in low over the water to PROBLEM, then up the face to the cave (y, distance). */
const CAMW = { y: 6.5, d: 44, look: 12.5 }, CAM0 = { y: 0.8, d: 16 }, CAM1 = { y: CAVE_C, d: 13 };
const T_IN = [49.85, 50.62] as const, T_CLIMB = [51.91, 53.36] as const, T_HIT = 53.36;

const HOOKS = /* glsl */ `
#define WALL_HOOK
uniform float uncoil, stT, camY;
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) { return 0.0; }
// the cave mouth: an irregular hole worn in the rock (negative inside), world units on the cliff
float caveSd(vec2 p) {
  vec2 q = p - vec2(${CAVE.x.toFixed(2)}, ${CAVE.cy.toFixed(2)});
  float a = atan(q.y, q.x);
  vec2 e = vec2(q.x / ${CAVE.hw.toFixed(2)}, q.y / (q.y < 0.0 ? ${(CAVE.cy - CAVE.y0).toFixed(2)} : ${CAVE.up.toFixed(2)}));
  float n = 0.075 * sin(3.0 * a + 1.3) + 0.05 * sin(7.0 * a + 0.4) + 0.035 * sin(13.0 * a + 2.0) + 0.02 * sin(23.0 * a);
  return (length(e) - 1.0 - n) * 2.8;
}
float sdTaper(vec2 p, vec2 a, vec2 b, float r0, float r1) {
  vec2 pa = p - a, ba = b - a; float h = sat(dot(pa, ba) / dot(ba, ba));
  return length(pa - ba * h) - mix(r0, r1, h);
}
// one jaw's row of teeth (added white): triangles off the jaw's inner edge, pointing into the gape (sd, <0 inside)
float teeth(vec2 g, vec2 a, float ang, float L, float r0, float r1, float side) {
  vec2 d = vec2(cos(ang), sin(ang)), nn = vec2(-d.y, d.x) * side;
  vec2 pa = g - a; float s = dot(pa, d), w = dot(pa, nn);
  float r = mix(r0, r1, sat(s / L));
  float tri = 1.0 - abs(fract(s / 0.15) - 0.5) * 2.0;
  float inRow = step(0.3, s) * step(s, L * 0.9);
  return inRow > 0.5 ? max(w + r - 0.01, -r - w - 0.15 * tri) : 1.0;
}
const vec2 NB[6] = vec2[6](vec2(-3.0, 18.7), vec2(-2.2, 19.8), vec2(-1.0, 20.5), vec2(1.0, 20.5), vec2(2.2, 19.8), vec2(3.0, 18.7));
const vec2 NE[6] = vec2[6](vec2(-6.5, 17.4), vec2(-5.7, 20.9), vec2(-2.7, 21.6), vec2(2.7, 21.6), vec2(5.7, 20.9), vec2(6.5, 17.4));
const vec2 NH[6] = vec2[6](vec2(-0.92, -0.38), vec2(-0.78, 0.62), vec2(-0.5, 0.86), vec2(0.5, 0.86), vec2(0.78, 0.62), vec2(0.92, -0.38));
// Scylla: six thick necks out of the cave's dark, each ending in a beast's head, jaws wide on rows of teeth. u 0: the
// heads lurk in the cave; 1: struck out over the rock. Returns the ink (x), the incision back to clay (y), added white (z).
vec3 scylla(vec2 p, float u) {
  if (abs(p.x) > 9.5 || p.y < 14.0 || p.y > 24.5) return vec3(0.0);
  float ink = 0.0, inc = 0.0, wht = 0.0, px = gPix, HS = mix(0.75, 1.25, u);
  for (int i = 0; i < 6; i++) {
    vec2 f = normalize(NH[i]);
    vec2 b = NB[i], e = mix(vec2(NB[i].x * 0.9, 18.3 + 0.3 * abs(f.y)), NE[i], u);
    vec2 c = mix(b, e - f * 2.0, u);
    // the neck: a quadratic sweep, thick and tapering
    float dmin = 1e9; vec2 q = b;
    for (int k = 1; k <= 14; k++) {
      float s = float(k) / 14.0;
      vec2 q1 = mix(mix(b, c, s), mix(c, e, s), s);
      dmin = min(dmin, sdTaper(p, q, q1, mix(0.42, 0.3, s - 1.0 / 14.0), mix(0.42, 0.3, s)));
      q = q1;
    }
    // the head, in its own frame: forward along the neck, "up" to the outside
    float sg = f.x < 0.0 ? -1.0 : 1.0;
    vec2 nrm = vec2(-f.y, f.x) * sg, hp = p - e;
    vec2 h = vec2(dot(hp, f), dot(hp, nrm)) / HS;
    float skull = (length((h - vec2(0.0, 0.06)) / vec2(0.56, 0.48)) - 1.0) * 0.48;
    vec2 hg = vec2(0.15, 0.0), au = hg + vec2(0.0, 0.14), al = hg - vec2(0.0, 0.12);
    float upA = 0.36, loA = -0.5, Lu = 1.0, Ll = 0.85;
    float uj = sdTaper(h, au, au + Lu * vec2(cos(upA), sin(upA)), 0.3, 0.13);
    float lj = sdTaper(h, al, al + Ll * vec2(cos(loA), sin(loA)), 0.25, 0.1);
    float ear = sdTaper(h, vec2(-0.08, 0.28), vec2(-0.5, 0.78), 0.13, 0.02);
    vec2 g = h - hg; float ga = atan(g.y, g.x);
    float gul = (ga > loA + 0.02 && ga < upA - 0.02 && length(g) < 0.82) ? -0.01 : 1.0;  // the gape, dark to the gullet
    float hd = min(min(skull, ear), min(min(uj, lj), gul)) * HS;
    float d = min(dmin, hd);
    float fi = 1.0 - smoothstep(-px, px, d);
    ink = max(ink, fi);
    // incision: the neck's mane line; the skull's seam, the eye, the jaw lines
    float lw = 0.014 + px;
    float l1 = 1.0 - smoothstep(lw - px, lw, abs(dmin + 0.1));
    float seam = 1.0 - smoothstep(lw - px, lw, abs(skull * HS + 0.05));
    float eye = 1.0 - smoothstep(lw - px, lw, abs(length(h - vec2(0.1, 0.2)) - 0.1) * HS);
    float jl = 1.0 - smoothstep(lw - px, lw, abs(uj + 0.11) * HS);
    float jl2 = 1.0 - smoothstep(lw - px, lw, abs(lj + 0.1) * HS);
    float headZone = step(hd, dmin + 0.05);
    inc = max(inc, fi * max(l1 * (1.0 - headZone), headZone * max(max(seam * step(-0.3, h.x) * step(h.x, 0.25), eye), max(jl, jl2) * step(0.45, h.x))));
    // teeth: two rows of added white along the jaws, into the dark gape
    float tu = teeth(h, au, upA, Lu, 0.3, 0.13, -1.0);
    float tl = teeth(h, al, loA, Ll, 0.25, 0.1, 1.0);
    float tw = 1.0 - smoothstep(-px, px, min(tu, tl) * HS);
    wht = max(wht, tw * step(hd - 0.02, dmin) * smoothstep(0.4, 0.9, u));
  }
  return vec3(ink, inc, wht);
}
vec3 wallHook(vec3 P, vec3 col) {
  float px = gPix;
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
  // the cave: a dark hole until the fire behind us comes near enough to light her wall
  float cs = caveSd(P.xy);
  float reveal = smoothstep(11.0, 17.5, camY);
  if (cs < 0.0) {
    float deep = smoothstep(0.0, 1.6, -cs);
    col = clayL * mix(0.05, 0.8 * reveal + 0.05, deep) * (0.85 + 0.15 * smoothstep(${CAVE.y0.toFixed(2)}, ${CAVE.y0 + 1.5}, y));
    col = mix(col, ink, (1.0 - smoothstep(0.0, 0.8, y - ${CAVE.y0.toFixed(2)})) * (1.0 - smoothstep(1.4, 3.0, abs(P.x - ${CAVE.x.toFixed(2)}))));
  } else {
    // a ragged glaze edge, and the rock shadowed round the mouth
    float lip = 0.16 + 0.12 * snoise(P.xy * 1.7 + 4.0);
    col = mix(col, ink, 1.0 - smoothstep(lip, lip + px, cs));
    col *= 0.6 + 0.4 * smoothstep(0.0, 1.4, cs);
  }
  vec3 s = scylla(P.xy, uncoil);
  col = mix(col, ink, s.x);
  col = mix(col, clayL * 0.9, s.y);
  col = mix(col, C_BONE * 0.9, s.z);
  // the cliff's ragged flanks against the night
  float cw = 14.0 + 2.2 * snoise(vec2(P.y * 0.13, P.x > 0.0 ? 3.0 : 7.0)) + max(0.0, 6.0 - P.y) * 1.4;
  col = mix(col, C_INK * 0.6, smoothstep(cw, cw + 0.3, abs(P.x)));
  return col;
}
// the cloud: a wreath round the cliff below the cave (x), and the cap that always hides the peak (y)
vec2 cloudD(vec3 p) {
  float zm = 1.0 - smoothstep(${(WALL_Z + 15).toFixed(1)}, ${(WALL_Z + 20).toFixed(1)}, p.z);
  float n = 0.55 + 0.75 * snoise(vec2(p.x * 0.14 + stT * 0.15, p.y * 0.5 + p.z * 0.12));
  float wreath = smoothstep(9.0, 10.6, p.y) * (1.0 - smoothstep(12.8, 14.6, p.y)) * max(n, 0.0) * zm;
  float cap = smoothstep(22.5, 26.5, p.y + 1.5 * snoise(vec2(p.x * 0.1, stT * 0.1)));
  return vec2(wreath * 1.7, cap * 2.0);
}
vec3 fogged(vec3 P, vec3 col) {
  vec3 r = P - camPos; float len = min(length(r), 80.0); vec3 dir = normalize(r);
  vec2 acc = vec2(0.0); float ds = len / 22.0;
  for (int i = 0; i < 22; i++) acc += cloudD(camPos + dir * ds * (float(i) + 0.5));
  float f = 1.0 - exp(-(acc.x + acc.y) * ds * 0.32);
  vec3 smoke = mix(C_INK * 1.2 + mix(C_BLOOD, C_SIGNAL, 0.5) * 0.035 * exp(-len * 0.05),
                   C_BONE * 0.07 + C_SIGNAL * 0.05, acc.x / (acc.x + acc.y + 1e-4));
  return mix(col, smoke, f);
}
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return fogged(P, col); }
vec3 skyTint(vec3 D, vec3 col) { return fogged(camPos + D * 80.0, col); }`;

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
    for (const [a, b, exit] of [[0, pi, ws[pi]!.start + 0.05], [pi + 1, hi, ws[hi]!.start + 0.3], [hi + 1, ws.length, 54.2]] as const) {
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
    const uc = prog(t, T_CLIMB[0], T_CLIMB[1]), c = Math.pow(uc, 1.7);
    // first the whole cliff from far out on the sea, drifting; then in, low over the water, to PROBLEM on its onset
    const wide = 1 - prog(t, T_IN[0], T_IN[1], ease.inOutCubic), wd = CAMW.d - 3 * prog(t, 49.0, T_IN[0]);
    const cy = CAM0.y + (CAM1.y - CAM0.y) * c + (CAMW.y - CAM0.y) * wide;
    const cd = CAM0.d + (CAM1.d - CAM0.d) * c + (wd - CAM0.d) * wide;
    const lookY = (1 - c) * 3.0 + c * CAM1.y + 3.0 * Math.sin(Math.PI * uc) + (CAMW.look - 3.0) * wide;
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
    sm(p0, -1.7, cy + (lookY - cy) * (5 / cd) - 0.5, pos.z - 5, 0.16);
    sm(p1, 1.0, 0, WALL_Z + 9.8, 0.2);
    sm(p2, -2.6, cy + (lookY - cy) * (4.5 / cd) - 1.1, pos.z - 4.5, 0.15);

    // HIDING and her necks: from the downbeat
    const un = prog(t, T_HIT - 0.04, T_HIT + 0.55, ease.outCubic);
    const hd = this.hiding, hs = (CAVE.hw * 2 * 0.9) / hd.width;
    hd.letters.forEach((l, i) => {
      l.x = CAVE.x - (hd.width / 2) * hs + l.penX * hs; l.y = 17.45 - hd.cap * hs / 2; l.z = WALL_Z + 0.03; l.yaw = 0; l.hinge = 0; l.s = hs;
      l.on = t >= T_HIT + i * 0.035 ? 1 : 0;
      l.mat.uniforms.glow!.value = 0;
    });
    hd.update();

    const u = this.st.bg.u;
    u.uncoil!.value = un; u.stT!.value = t; u.camY!.value = cy;
    const L = keyLight(this.st.cam, audio, t, { seed: 12, right: 2.2, up: 1.6, back: 3.0, I: 1.25, reach: 22 * Math.max(1, cd / 11) });
    const Lc = this.st.lightCentre(L), ru = this.rock.uniforms;
    (ru.Lc!.value as THREE.Vector3).copy(Lc); ru.LI!.value = L.I; ru.reach!.value = L.reach;
    this.st.render(renderer, out, t, L, { wall: 1, wallZ: WALL_Z, gloss: 0.7, swell: 0.4, wine: 0.85, reflBend: 0.25 }, {
      noFlame: true, rim: 0.9, spec: 0.05,
      mirror: { before: () => { (ru.Lc!.value as THREE.Vector3).y *= -1; }, after: () => { (ru.Lc!.value as THREE.Vector3).y *= -1; } },
    });
    return { bloom: 0.55, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.45, halation: 0.3, shake: [0.003 * jolt, 0.006 * jolt] };
  }
}
