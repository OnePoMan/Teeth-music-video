// `symbolon` — verse 1, line 3: "How am I to reunite with my estranged?" (docs/MONSTER.md, revision 1).
// A symbolon: the Greek tally, a clay token broken in two, each half kept by one of two guest-friends as proof of
// who the other is. Ours is black-glazed (red-figure: the word is the clay left in reserve), afloat on black mirror
// water, wine-dark, lit by the fire behind us (never seen). Its halves drift toward each other ("How am I to" stands
// on the left one), slam together on "reunite" and make the word whole; "with my" stands on the right one. On "my"
// the camera sinks toward the water and looks out to sea: on a far shore, against the first dawn, Penelope sits at
// her loom, faceless, her head on her hand (the pose of the Chiusi skyphos). On "estranged?" the halves part, and a
// dawn thread that runs across the water from her loom writes the word between them as it is sung; then she draws
// it back, and the word unravels toward her.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { F, font, layout } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { LineBatch } from '../../engine/lines';
import { LIN } from '../../engine/palette';
import { strokeText, writtenLength, type StrokeText } from '../../engine/stroke';
import { ease, keys, lerp, mulberry32, prog, pulse } from '../../engine/util';
import { Stage, Word3D, keyLight, popWords, vkeys, type Letter } from '../stage';

/** Token radius and thickness (world units); the word's cap height on it. */
const RD = 1.6, TH = 0.2, CAPW = 0.36;
/** The far shore (a backdrop wall), Penelope's place on it, her scale. */
const SHORE_Z = -26, PEN = { x: 4.6, s: 2.0 };
/** The thread word: its width (world), the height of its baseline over the water, how far it stands before the gap. */
const THREAD = { w: 2.5, y: 0.42, dz: 0.75 };

const HOOKS = /* glsl */ `
#define WALL_HOOK
uniform float penOn, penX, penS;
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) { return 0.0; }
vec3 skyTint(vec3 D, vec3 col) { return col; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return col; }
float pSdEll(vec2 p, vec2 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float pSdTrap(vec2 p, float r1, float r2, float he) {
  vec2 k1 = vec2(r2, he), k2 = vec2(r2 - r1, 2.0 * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, (p.y < 0.0) ? r1 : r2), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
// Penelope at her loom (units: her own; the shore at y 0): the warp-weighted loom, the cloth woven down from its beam,
// the warp hanging to its weights; before it, on a stool, facing away from it, she sits with her head bowed on her hand
float penelope(vec2 p) {
  float d = sdSegment(p, vec2(-2.35, 0.0), vec2(-2.15, 3.4)) - 0.06;                      // the uprights, leaning back
  d = min(d, sdSegment(p, vec2(-0.45, 0.0), vec2(-0.25, 3.4)) - 0.06);
  d = min(d, sdBox(p - vec2(-1.25, 3.28), vec2(1.12, 0.07)));                             // the beam
  d = min(d, sdBox(p - vec2(-1.22, 2.86), vec2(0.86, 0.36)));                             // the cloth, woven down from it
  for (int i = 0; i < 9; i++) {                                                            // the warp, its weights
    float x = -1.98 + 0.19 * float(i);
    d = min(d, sdSegment(p, vec2(x, 2.5), vec2(x, 0.95)) - 0.014);
    d = min(d, pSdEll(p - vec2(x, 0.86), vec2(0.06, 0.1)));
  }
  d = min(d, sdSegment(p, vec2(-2.1, 1.55), vec2(-0.35, 1.55)) - 0.03);                   // the shed rod
  // her stool and her, facing right
  d = min(d, sdBox(p - vec2(0.55, 0.95), vec2(0.34, 0.05)));
  d = min(d, sdSegment(p, vec2(0.28, 0.92), vec2(0.24, 0.0)) - 0.04);
  d = min(d, sdSegment(p, vec2(0.82, 0.92), vec2(0.86, 0.0)) - 0.04);
  float f = sdSegment(p, vec2(0.5, 1.12), vec2(0.74, 1.92)) - 0.2;                         // her back, bent forward
  f = smin(f, sdCircle(p - vec2(0.98, 2.02), 0.16), 0.08);                                 // the head, bowed
  f = smin(f, pSdEll(rot2(-0.45) * (p - vec2(0.72, 1.86)), vec2(0.26, 0.48)), 0.08);       // the veil over head and back
  f = smin(f, sdSegment(p, vec2(0.48, 1.05), vec2(1.17, 1.12)) - 0.17, 0.08);              // the thigh
  f = min(f, pSdTrap(p - vec2(0.95, 0.62), 0.42, 0.24, 0.5));                              // the skirt falling from the knee
  f = smin(f, sdSegment(p, vec2(0.76, 1.84), vec2(1.12, 1.27)) - 0.07, 0.04);              // the arm down to the knee,
  f = smin(f, sdSegment(p, vec2(1.12, 1.27), vec2(1.02, 1.95)) - 0.065, 0.04);             // the hand up to the cheek
  f = min(f, pSdEll(p - vec2(1.3, 0.05), vec2(0.16, 0.06)));                               // her foot
  return min(d, f);
}
// the far shore: night, the first dawn low behind her, the shore a black strip, she and her loom black against it
vec3 wallHook(vec3 P, vec3 col) {
  vec2 q = vec2(P.x - penX, P.y);
  vec3 c = C_INK;
  float glow = exp(-dot((q - vec2(-0.6, 0.9)) * vec2(0.09, 0.32), (q - vec2(-0.6, 0.9)) * vec2(0.09, 0.32)));
  c += C_DAWN * penOn * (0.5 * glow + 0.05 * exp(-max(P.y, 0.0) * 0.25));
  float shore = 0.45 + 0.08 * sin(P.x * 0.21) + 0.05 * sin(P.x * 0.73 + 1.0);
  float aa = max(gPix, 0.01);
  float sil = max(smoothstep(aa, -aa, P.y - shore), smoothstep(aa, -aa, penelope((q - vec2(0.0, shore)) / penS) * penS));
  return mix(c, C_INK * 0.6, sil);
}`;

const TOKEN_VERT = /* glsl */ `
precision highp float;
in vec3 position; in vec3 normal;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
out vec3 vW; out vec3 vNW; out vec3 vP; out vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vNW = mat3(modelMatrix) * normal; vP = position; vN = normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const TOKEN_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec3 vW; in vec3 vNW; in vec3 vP; in vec3 vN;
out vec4 fragColor;
${GLSL_COMMON}
uniform sampler2D face; uniform vec3 Lc, camPos; uniform float LI, reach, RD;
void main() {
  float nl = length(vNW);
  vec3 N = nl > 1e-6 ? vNW / nl : vec3(0.0, 1.0, 0.0);
  vec3 L = Lc - vW; float d = length(L); L /= d;
  float fall = LI / (1.0 + (d / reach) * (d / reach) * 4.0);
  float ndl = max(dot(N, L), 0.0);
  vec3 col;
  if (vN.z / max(length(vN), 1e-6) > 0.9) {
    // the glazed face: black, glossy, the word reserved in the clay
    vec2 uv = vec2(vP.x / (2.0 * RD) + 0.5, 0.5 - vP.y / (2.0 * RD));
    vec4 tx = texture(face, uv);
    vec3 V = normalize(camPos - vW), Hh = normalize(L + V);
    float spec = pow(max(dot(N, Hh), 0.0), 70.0) * fall;
    vec3 glaze = C_INK * (0.5 + 0.5 * ndl * fall) + C_INK2 * 0.6 * tx.g + mix(C_EMBER, C_BONE, 0.5) * spec * 0.25;
    vec3 clay = mix(C_BLOOD, C_SIGNAL, 0.75) * (0.12 + 1.05 * ndl * fall);
    col = mix(glaze, clay, tx.r);
  } else {
    // the broken edge and the rim: the clay body, rough
    float rough = 0.75 + 0.25 * snoise(vP.xy * 18.0 + vP.z * 9.0);
    col = mix(C_BLOOD, C_SIGNAL, 0.55) * (0.1 + 0.95 * ndl * fall) * rough;
  }
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  fragColor = vec4(col, 1.0);
}`;

export default class Symbolon extends Scene {
  private st!: Stage;
  private line!: Line;
  /** "How am I to" standing on the left half, "with my" on the right. */
  private rimL!: Word3D;
  private rimR!: Word3D;
  private halves: { grp: THREE.Group; mat: THREE.RawShaderMaterial; cx: number }[] = [];
  private face!: THREE.CanvasTexture;
  /** "estranged?" in a single dawn thread (a connected script), and the lines it is drawn with. */
  private thread!: StrokeText;
  private lines = new LineBatch(6000, { screen2D: false, worldWidth: true, blend: 'add', depthTest: true });

  override async init() {
    this.st = new Stage({ hooks: HOOKS, uniforms: { penOn: { value: 0 }, penX: { value: PEN.x }, penS: { value: PEN.s } } });
    this.line = this.ctx.lyrics.get('How am I to reunite');
    // ---- the face: the word and a rim ring reserved in the clay (r), the wheel's turning marks in the glaze (g)
    const px = 2048, k = px / (2 * RD), cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#000'; c.fillRect(0, 0, px, px);
    c.strokeStyle = 'rgba(0,255,0,0.5)';
    for (let r = 0.1; r < RD; r += 0.035) { c.lineWidth = 1.2 + (r * 37) % 1.6; c.beginPath(); c.arc(px / 2, px / 2, r * k, 0, Math.PI * 2); c.stroke(); }
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = '#f00'; c.lineWidth = 0.035 * k;
    c.beginPath(); c.arc(px / 2, px / 2, RD * 0.9 * k, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 0.012 * k;
    c.beginPath(); c.arc(px / 2, px / 2, RD * 0.84 * k, 0, Math.PI * 2); c.stroke();
    const fam = F.archivo(87.5, 800), fpx = (CAPW / 0.72) * k;
    const lay = layout('REUNITE', fam, fpx, fpx * 0.02);
    c.font = font(fam, fpx); c.letterSpacing = `${fpx * 0.02}px`; c.fillStyle = '#f00'; c.textBaseline = 'alphabetic';
    const x0 = px / 2 - lay.width / 2, base = px / 2 + (CAPW * k) / 2;
    c.fillText('REUNITE', x0, base);
    this.face = new THREE.CanvasTexture(cv);
    this.face.flipY = false; this.face.colorSpace = THREE.NoColorSpace;
    this.face.generateMipmaps = true; this.face.minFilter = THREE.LinearMipmapLinearFilter; this.face.anisotropy = 8;
    // ---- the break: a jagged line down through the N
    const gN = lay.glyphs[3]!;
    const bx = (x0 + gN.x + gN.w * 0.5 - px / 2) / k;
    const rnd = mulberry32(31), brk: THREE.Vector2[] = [];
    const n = 16;
    const xTop = bx + 0.18, xBot = bx - 0.12;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      let x = lerp(xTop, xBot, u) + (i > 0 && i < n ? (rnd() - 0.5) * 0.2 + 0.06 * Math.sin(i * 2.3) : 0);
      const yMax = Math.sqrt(Math.max(0, RD * RD - x * x));
      const y = lerp(yMax, -Math.sqrt(Math.max(0, RD * RD - xBot * xBot)), u);
      if (i === 0) x = xTop;
      brk.push(new THREE.Vector2(x, i === 0 ? Math.sqrt(RD * RD - xTop * xTop) : y));
    }
    const leftShape = new THREE.Shape([...brk, ...arcLeft(brk[n]!, brk[0]!, RD)]);
    const rightShape = new THREE.Shape([...brk.slice().reverse(), ...arcRight(brk[0]!, brk[n]!, RD)]);
    const mk = (shape: THREE.Shape, cx: number) => {
      const geo = new THREE.ExtrudeGeometry(shape, { depth: TH, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelOffset: -0.02, bevelSegments: 2, curveSegments: 4 });
      geo.computeVertexNormals();
      const mat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: TOKEN_VERT, fragmentShader: TOKEN_FRAG,
        uniforms: { face: { value: this.face }, Lc: { value: new THREE.Vector3() }, camPos: { value: new THREE.Vector3() }, LI: { value: 1 }, reach: { value: 7 }, RD: { value: RD } },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.frustumCulled = false;
      const grp = new THREE.Group();
      grp.add(mesh);
      this.st.scene.add(grp);
      return { grp, mat, cx };
    };
    // each half's middle (x), where its phrase stands
    this.halves = [mk(leftShape, (bx - RD) / 2), mk(rightShape, (bx + RD) / 2)];
    const ws = this.line.words, voice = F.archivo(112.5, 600);
    this.rimL = new Word3D(ws.slice(0, 4).map((w) => w.w).join(' '), voice, { size: 200 });
    this.rimR = new Word3D(ws.slice(5, 7).map((w) => w.w).join(' '), voice, { size: 200 });
    for (const w of [this.rimL, this.rimR]) this.st.add(w, { shadows: false });
    this.thread = strokeText(ws[7]!.w.toLowerCase(), 'script', 100);
  }

  private w(s: string): Word {
    return this.line.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const [how, am, i, to] = this.line.words as [Word, Word, Word, Word];
    const reunite = this.w('reunite'), withW = this.w('with'), my = this.w('my'), estr = this.w('estranged');
    const T0 = this.ctx.start, T1 = this.ctx.end;
    const tImp = reunite.start;                           // the halves slam shut as "reunite" sounds
    const split = prog(t, estr.start - 0.02, T1, ease.outCubic);
    // ---- the halves: apart and drifting together, slammed shut on "reunite", parted on "estranged?"
    const gap = keys(t, [[T0, 0.95], [tImp - 0.22, 0.6, ease.inOutQuad], [tImp, 0, ease.inCubic]]);
    const imp = pulse(t, tImp, 0.12) * (t >= tImp ? 1 : 0);
    const [hl, hr] = this.halves as [typeof this.halves[0], typeof this.halves[0]];
    hl.grp.position.set(-gap / 2 - 0.9 * split, 0, 0.1 * split);
    hl.grp.rotation.y = 0.08 * split;
    hr.grp.position.set(gap / 2 + 3.6 * split, 0, -1.6 * split);
    hr.grp.rotation.y = -0.05 * gap - 0.45 * split;
    hl.grp.updateMatrixWorld(true); hr.grp.updateMatrixWorld(true);
    // ---- the camera: oblique over the token, pushing in to the impact; on "my" it sinks to the water and looks out
    // to sea, to the far shore, as the halves part
    const look = prog(t, my.start - 0.05, estr.start + 0.25, ease.inOutCubic);
    const pos = vkeys(t, [[T0, [-0.4, 4.5, 4.1]], [tImp, [-0.2, 3.75, 3.2], ease.inOutQuad], [my.start - 0.05, [-0.15, 3.65, 3.1], ease.linear],
      [estr.start + 0.25, [0.35, 1.55, 4.3], ease.inOutCubic], [T1, [0.55, 1.45, 4.6], ease.linear]]);
    const at = vkeys(t, [[T0, [0, 0, 0.15]], [tImp, [0, 0, 0.1], ease.inOutQuad], [my.start - 0.05, [0, 0, 0.1], ease.linear],
      [estr.start + 0.25, [1.9, 0.55, -8], ease.inOutCubic], [T1, [2.1, 0.5, -8], ease.linear]]);
    pos.x += 0.025 * imp * Math.sin(t * 90); pos.y += 0.02 * imp;
    this.st.cam.set(pos, at, lerp(36, 40, look));
    // ---- the light: the fire behind us; it lights the halves too
    const L = keyLight(this.st.cam, audio, t, { seed: 5, I: 1.25 + 0.6 * imp, reach: 14 });
    const Lc = this.st.lightCentre(L);
    for (const h of this.halves) {
      const u = h.mat.uniforms;
      (u.Lc!.value as THREE.Vector3).copy(Lc); (u.camPos!.value as THREE.Vector3).copy(this.st.cam.cam.position);
      u.LI!.value = L.I; u.reach!.value = L.reach;
    }
    // Penelope: the first dawn rises behind her as the camera finds her
    this.st.bg.u.penOn!.value = look;

    // ---- the phrases: a row standing on each half, facing us, leaning back a little so they read from above
    const onHalf = (h: typeof hl, w: Word3D, cap: number) => {
      const sc = cap / w.cap, ry = h.grp.rotation.y, x0 = h.cx - (w.width * sc) / 2;
      return (l: Letter) => {
        const lx = x0 + l.penX * sc, lz = 0.5;
        l.x = h.grp.position.x + lx * Math.cos(ry) + lz * Math.sin(ry);
        l.z = h.grp.position.z - lx * Math.sin(ry) + lz * Math.cos(ry);
        l.y = TH; l.s = sc; l.yaw = ry;
      };
    };
    const lean = (w: Word3D) => { for (const l of w.letters) l.hinge = 0.42 + l.hinge * (1 - 0.42 / (Math.PI / 2)); w.update(); };
    // one phrase at a time: "How am I to" lies down as "with my" stands up, and "with my" as the thread arrives
    popWords(this.rimL, [how.start, am.start, i.start, to.start], t, onHalf(hl, this.rimL, 0.27), { glow: 0.6, exit: withW.start - 0.06 });
    lean(this.rimL);
    popWords(this.rimR, [withW.start, my.start], t, onHalf(hr, this.rimR, 0.27), { glow: 0.6, exit: estr.start + 0.05 });
    lean(this.rimR);

    // the mirror water, wine-dark; the far shore is a backdrop wall
    this.st.render(renderer, out, t, L, { wall: 1, wallZ: SHORE_Z, gloss: 0.7, swell: 0.4, wine: 0.5, reflBend: 0.25 },
      { noFlame: true, cards: false, spec: 0.05 });

    // ---- "estranged?": the thread from her loom, across the water, writes the word between the halves as it is sung;
    // then she draws it back and it unravels toward her
    this.drawThread(t, estr, hl.grp.position, hr.grp.position, out);
    return { bloom: 0.6, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3, shake: [0, 0.006 * imp] };
  }

  private drawThread(t: number, estr: Word, pl: THREE.Vector3, pr: THREE.Vector3, out: THREE.WebGLRenderTarget) {
    const st = this.thread, lb = this.lines;
    lb.clear();
    const tArrive = estr.start - 0.18;
    if (t < tArrive) return;
    // the word's plane: upright, before the gap, turned to face where the camera comes to rest
    const cam = this.st.cam.cam.position;
    const gx = (pl.x + pr.x) / 2 + 0.6, gz = (pl.z + pr.z) / 2 + THREAD.dz;
    const yaw = Math.atan2(cam.x - gx, cam.z - gz);
    const k = THREAD.w / st.width, ca = Math.cos(yaw), sa = Math.sin(yaw);
    const P = (p: { x: number; y: number }) => {
      const u = (p.x - st.width / 2) * k, v = -p.y * k;          // stroke px are y down
      return new THREE.Vector3(gx + u * ca, THREAD.y + v, gz - u * sa);
    };
    // written as sung (each char over its share of the word); unravelled from its end after the word
    const nC = st.charRange.length, t0 = estr.start, t1 = Math.min(estr.end - 0.05, t0 + 0.7);
    const charTimes = Array.from({ length: nC }, (_, c) => [lerp(t0, t1, c / nC), lerp(t0, t1, (c + 1) / nC)] as [number, number]);
    const written = writtenLength(st, charTimes, t);
    const pull = prog(t, t1 + 0.04, this.ctx.end + 0.15, ease.inQuad);
    const len = written * (1 - 0.65 * pull);
    // the loom on the far shore (where the thread comes from)
    const loom = new THREE.Vector3(PEN.x - 1.2 * PEN.s, 0.45 + 2.6 * PEN.s, SHORE_Z);
    const dawn = LIN.dawn, bone = LIN.bone;
    let head = P(st.strokes[0]![0]!);
    for (let si = 0; si < st.strokes.length; si++) {
      const s0 = st.startLen[si]!;
      if (s0 >= len) break;
      const pts = st.strokes[si]!, Ls = st.lens[si]!;
      let prev = P(pts[0]!);
      for (let j = 1; j < pts.length; j++) {
        if (s0 + Ls[j - 1]! >= len) break;
        const uu = Math.min(1, (len - s0 - Ls[j - 1]!) / Math.max(1e-6, Ls[j]! - Ls[j - 1]!));
        const a = pts[j - 1]!, b = pts[j]!;
        const q = P({ x: a.x + (b.x - a.x) * uu, y: a.y + (b.y - a.y) * uu });
        // the thread's twist: a slow brightness ripple along it, so it reads as spun yarn
        const tw = 0.75 + 0.25 * Math.sin((s0 + Ls[j]!) * 0.9);
        lb.seg(prev.x, prev.y, prev.z, q.x, q.y, q.z, 0.022, (dawn[0] * 1.6 + bone[0] * 0.5) * tw, (dawn[1] * 1.6 + bone[1] * 0.5) * tw, (dawn[2] * 1.6 + bone[2] * 0.5) * tw, 1);
        prev = q; head = q;
      }
    }
    // the long thread, taut, from the loom to the word's head; it arrives across the water just before the word
    const arrive = prog(t, tArrive, estr.start + 0.02, ease.outCubic);
    const end = t < estr.start ? P(st.strokes[0]![0]!) : head;
    const from = loom, to = loom.clone().lerp(end, arrive);
    const segs = 48;
    for (let s = 0; s < segs; s++) {
      const a = from.clone().lerp(to, s / segs), b = from.clone().lerp(to, (s + 1) / segs);
      lb.seg(a.x, a.y, a.z, b.x, b.y, b.z, 0.012, dawn[0] * 0.9, dawn[1] * 0.9, dawn[2] * 0.9, 1);
    }
    lb.render(this.ctx.renderer, out, this.st.cam.cam);
  }
}

/** The disc's arc from the break's bottom end round the left side up to its top end (counter-clockwise in y-up). */
function arcLeft(bot: THREE.Vector2, top: THREE.Vector2, R: number, m = 72) {
  let a0 = Math.atan2(bot.y, bot.x), a1 = Math.atan2(top.y, top.x);
  // go the long way round through pi: from the bottom (about -pi/2) down through -pi to the top (about +pi/2)
  if (a0 > 0) a0 -= Math.PI * 2;
  if (a1 > a0) a1 -= Math.PI * 2;
  return Array.from({ length: m - 1 }, (_, i) => {
    const a = lerp(a0, a1, (i + 1) / m);
    return new THREE.Vector2(R * Math.cos(a), R * Math.sin(a));
  });
}

/** The disc's arc from the break's top end round the right side down to its bottom end. */
function arcRight(top: THREE.Vector2, bot: THREE.Vector2, R: number, m = 72) {
  const a0 = Math.atan2(top.y, top.x);
  let a1 = Math.atan2(bot.y, bot.x);
  if (a1 > a0) a1 -= Math.PI * 2;
  return Array.from({ length: m - 1 }, (_, i) => {
    const a = lerp(a0, a1, (i + 1) / m);
    return new THREE.Vector2(R * Math.cos(a), R * Math.sin(a));
  });
}
