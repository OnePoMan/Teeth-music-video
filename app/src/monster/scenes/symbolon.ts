// `symbolon` — verse 1, line 3: "How am I to reunite with my estranged?" (docs/MONSTER.md, revision 1).
// A symbolon: the Greek tally, a clay token broken in two, each half kept by one of two guest-friends as proof of
// who the other is. Ours is black-glazed (red-figure: the word is the clay left in reserve), lying on a dark sea in the
// flame's light from the left. Its halves drift toward each other ("How am I to"), slam together on "reunite" and
// make the word whole; on "estranged?" the far half slides away into the dark, the camera pulls up over the widening
// water, and the word "estranged?" spreads its letters across the gap.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D, W } from '../../engine/gl';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { F, font, layout } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { rgba } from '../../engine/palette';
import { ease, keys, lerp, mulberry32, prog, pulse } from '../../engine/util';
import { flameState } from '../motifs';
import { Stage, VOICE, drawPhrase, vkeys } from '../stage';

/** Token radius and thickness (world units); the word's cap height on it. */
const RD = 1.6, TH = 0.2, CAPW = 0.36;

const SEA_HOOKS = /* glsl */ `
uniform float tSea;
float carve(vec2 xz) { return 0.0; }
// the sea: engraved water, long parallel lines rolling in slow swells
float floorLines(vec3 P, float u) {
  return u + 0.3 * sin(P.x * 1.6 + 0.8 * sin(P.z * 1.1 + tSea * 0.4) + tSea * 0.8) + 0.05 * sin(P.x * 4.1 - tSea * 1.3);
}
float extraShadow(vec3 P, bool wall) { return 0.0; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return col * 0.85; }`;

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
uniform sampler2D face; uniform vec3 Lc, camPos; uniform float LI, reach, RD, flash;
void main() {
  vec3 N = normalize(vNW);
  vec3 L = Lc - vW; float d = length(L); L /= d;
  float fall = LI / (1.0 + (d / reach) * (d / reach) * 4.0);
  float ndl = max(dot(N, L), 0.0);
  vec3 col;
  if (normalize(vN).z > 0.9) {
    // the glazed face: black, glossy (the flame's highlight slides on it), the word reserved in the clay
    vec2 uv = vec2(vP.x / (2.0 * RD) + 0.5, 0.5 - vP.y / (2.0 * RD));
    vec4 tx = texture(face, uv);
    vec3 V = normalize(camPos - vW), Hh = normalize(L + V);
    float spec = pow(max(dot(N, Hh), 0.0), 70.0) * fall;
    vec3 glaze = C_INK * (0.5 + 0.5 * ndl * fall) + C_INK2 * 0.6 * tx.g + mix(C_EMBER, C_BONE, 0.5) * spec * 1.1;
    vec3 clay = mix(C_BLOOD, C_SIGNAL, 0.75) * (0.12 + 1.05 * ndl * fall);
    col = mix(glaze, clay, tx.r);
  } else {
    // the broken edge and the rim: the clay body, rough, engraved along the thickness
    float rough = 0.75 + 0.25 * snoise(vP.xy * 18.0 + vP.z * 9.0);
    float lit = (0.1 + 0.95 * ndl * fall) * rough;
    col = mix(C_BLOOD, C_SIGNAL, 0.55) * lit;
    col *= 1.0 - 0.55 * hatch(vP.z * 55.0, sat(1.0 - lit * 1.4) * 0.6);
  }
  col += C_EMBER * flash * 0.0;
  fragColor = vec4(col, 1.0);
}`;

export default class Symbolon extends Scene {
  private st!: Stage;
  private txt = new Layer2D();
  private line!: Line;
  private halves: { grp: THREE.Group; mat: THREE.RawShaderMaterial }[] = [];
  private face!: THREE.CanvasTexture;

  override async init() {
    this.st = new Stage({ hooks: SEA_HOOKS, uniforms: { tSea: { value: 0 } } });
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
    const mk = (shape: THREE.Shape) => {
      const geo = new THREE.ExtrudeGeometry(shape, { depth: TH, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelOffset: -0.02, bevelSegments: 2, curveSegments: 4 });
      geo.computeVertexNormals();
      const mat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: TOKEN_VERT, fragmentShader: TOKEN_FRAG,
        uniforms: { face: { value: this.face }, Lc: { value: new THREE.Vector3() }, camPos: { value: new THREE.Vector3() }, LI: { value: 1 }, reach: { value: 7 }, RD: { value: RD }, flash: { value: 0 } },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.frustumCulled = false;
      const grp = new THREE.Group();
      grp.add(mesh);
      this.st.scene.add(grp);
      return { grp, mat };
    };
    this.halves = [mk(leftShape), mk(rightShape)];
  }

  private w(s: string): Word {
    return this.line.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, comp, audio } = this.ctx;
    const [how, am, i, to] = this.line.words as [Word, Word, Word, Word];
    const reunite = this.w('reunite'), withW = this.w('with'), my = this.w('my'), estr = this.w('estranged');
    const T0 = this.ctx.start, T1 = this.ctx.end;
    const tImp = audio.nearestBeat(reunite.start + 0.12);
    const split = prog(t, estr.start - 0.02, T1, ease.outCubic);
    // ---- the halves: apart and drifting together, slammed shut on "reunite", parted on "estranged?"
    const gap = keys(t, [[T0, 0.95], [reunite.start - 0.05, 0.55, ease.inOutQuad], [tImp, 0, ease.inCubic]]);
    const imp = pulse(t, tImp, 0.12) * (t >= tImp ? 1 : 0);
    const [hl, hr] = this.halves as [typeof this.halves[0], typeof this.halves[0]];
    hl.grp.position.set(-gap / 2 - 0.5 * split, 0, 0.12 * split);
    hl.grp.rotation.y = 0.06 * split;
    hr.grp.position.set(gap / 2 + 6.8 * split, 0, -2.4 * split);
    hr.grp.rotation.y = -0.05 * gap - 0.55 * split;
    hl.grp.updateMatrixWorld(true); hr.grp.updateMatrixWorld(true);
    // ---- the camera: oblique over the token, pushing in to the impact; pulled up over the sea on "estranged?"
    const pos = vkeys(t, [[T0, [-0.4, 4.5, 4.1]], [tImp, [-0.2, 3.75, 3.2], ease.inOutQuad], [estr.start, [-0.15, 3.65, 3.1], ease.linear], [T1, [1.6, 8.6, 5.6], ease.outCubic]]);
    const at = vkeys(t, [[T0, [0, 0, 0.15]], [tImp, [0, 0, 0.1], ease.inOutQuad], [estr.start, [0, 0, 0.1], ease.linear], [T1, [2.2, 0, -0.9], ease.outCubic]]);
    pos.x += 0.025 * imp * Math.sin(t * 90); pos.y += 0.02 * imp;
    this.st.cam.set(pos, at, 36);
    // ---- the light: the flame just out of frame left (its light, not its body)
    const fl = flameState(audio, t, 5);
    const Lbase = new THREE.Vector3(-3.3, 1.9, 1.9);
    const LI = fl.I * (1.75 + 0.8 * imp);
    const Lc = this.st.lightCentre({ base: Lbase, h: 1.2, I: LI, reach: 9 });
    for (const h of this.halves) {
      const u = h.mat.uniforms;
      (u.Lc!.value as THREE.Vector3).copy(Lc); (u.camPos!.value as THREE.Vector3).copy(this.st.cam.cam.position);
      u.LI!.value = LI; u.reach!.value = 9;
    }
    this.st.bg.u.tSea!.value = t;
    this.st.render(renderer, out, t, { base: Lbase, h: 1.2, I: LI * 0.8, reach: 9 }, { wall: 0, freqFloor: 5.2 }, { noFlame: true });

    // ---- the small voice; "estranged?" spreads its letters across the widening gap
    const c = this.txt.ctx;
    this.txt.clear();
    drawPhrase(c, [how, am, i, to], t, 160, 990, { exit: prog(t, tImp, tImp + 0.3) });
    drawPhrase(c, [withW, my], t, 160, 990, { exit: prog(t, estr.start, estr.start + 0.25) });
    if (t >= estr.start - 0.02) {
      const pl = this.st.cam.project(hl.grp.position), pr = this.st.cam.project(hr.grp.position);
      const cx = (pl.x + pr.x) / 2, cy = Math.max(pl.y, pr.y) + 250;
      const fam = VOICE.fam(), size = 64;
      const track = lerp(2, 70, split);
      const lay = layout('estranged?', fam, size, track);
      const a = prog(t, estr.start - 0.02, estr.start + 0.12);
      c.font = font(fam, size); c.letterSpacing = `${track}px`; c.textBaseline = 'alphabetic';
      c.fillStyle = rgba('bone', a);
      c.fillText('estranged?', Math.min(W - 120 - lay.width, Math.max(120, cx - lay.width / 2)), Math.min(1000, cy));
      c.letterSpacing = '0px';
    }
    comp.draw(renderer, this.txt.upload(), out);

    return { bloom: 0.6, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3, shake: [0, 0.006 * imp] };
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
