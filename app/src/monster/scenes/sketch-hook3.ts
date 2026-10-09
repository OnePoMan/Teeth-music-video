// SKETCH (stills only): hook 3, "Then I'll become the monster" (163.35–166.69), three options for the flip to
// black-figure that `blackfigure` (from 166.69) continues.
//   opt=a "the answer stands up": as MONSTER is sung the black-figure answer breaks the surface and stands where the
//         lit word was, letter by letter, while the lit word sinks; then sky and water flood with the clay's orange.
//   opt=b "through the surface": the signature dip does not stop at the waterline: the camera goes under, into the
//         clay world, where MONSTER stands black and incised (hanging from the surface's underside).
//   opt=c "the world turns over": the camera rolls 180 degrees about its view axis at the waterline; the answer
//         (painted turned over under the surface) ends up upright, standing on the line against the flooded clay.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, W, H } from '../../engine/gl';
import { ease, lerp, prog, pulse, noise1 } from '../../engine/util';
import { SHORE, StageCam, Word3D, popHinge } from '../stage';
import { LOW, SHORE_POST, Answer, heroFont, heroScale, setRegion } from '../shore';
import { Kit, WORD_Z, hookCam, landGlow, look, opt } from './sketch-hooks-kit';

const HALF = Math.PI / 2;
const CLAY_POST = { bloom: 0.3, bloomThreshold: 1.2, vignette: 0.35, grain: 0.06, ca: 0.4, halation: 0.1 };
function mixPost(a: Record<string, number>, b: Record<string, number>, k: number) {
  const o: Record<string, number> = {};
  for (const key of Object.keys(a)) o[key] = lerp(a[key]!, b[key] ?? a[key]!, k);
  return o as PostOverrides;
}

/** (b) Under the surface: the clay world, the surface's underside an ink ceiling out to the far shore. Pixels above
 *  `split` (GL px, the lens's own waterline mid-dip) are left as they are. */
const UNDER_FRAG = /* glsl */ `
uniform mat4 invVP; uniform vec3 camPos; uniform float split, t, shoreZ, menisc;
const vec3 C_WINE_U = vec3(0.028, 0.0006, 0.0062);
void main() {
  vec2 px = FRAG_PX;
  vec2 ndc = px / vec2(${W.toFixed(1)}, ${H.toFixed(1)}) * 2.0 - 1.0;
  vec4 q = invVP * vec4(ndc, 1.0, 1.0);
  vec3 D = normalize(q.xyz / q.w - camPos);
  float aw = fwidth(D.y);
  float wave = 9.0 * sin(px.x / 150.0 + t * 2.3) + 6.0 * snoise(vec2(px.x / 300.0, t * 0.5));
  float edge = split + wave - px.y;
  if (edge < 0.0) discard;
  // the underside of the surface reaches to the far shore: its edge there is the one line
  float e0 = -camPos.y / max(camPos.z - shoreZ, 1.0);
  float ceilK = smoothstep(e0 - aw, e0 + aw, D.y);
  vec3 clay = mix(C_SIGNAL * 0.6, C_EMBER * 0.62, 0.25 + 0.12 * snoise(vec2(px.x / 900.0, px.y / 500.0 + t * 0.05)));
  clay *= 1.0 - 0.28 * smoothstep(0.0, 0.5, -D.y);
  vec3 surf = mix(C_INK, C_WINE_U, 0.85) + clay * 0.05 * exp(-(D.y - e0) * 30.0);
  vec3 col = mix(clay, surf, ceilK);
  // the lens's own waterline mid-dip: a dark meniscus
  col = mix(col, C_INK, menisc * (1.0 - smoothstep(0.0, 5.0, edge)));
  fragColor = vec4(col, 1.0);
}`;

export default class SketchHook3 extends Scene {
  private o = 'a';
  private k!: Kit;
  private lit!: Word3D;
  /** (a) the answer risen into the direct render; (c) the answer turned over, only in the mirror. */
  private blk!: Word3D;
  private ans!: Answer;
  private s = 0.01;
  private on = 165.32;
  // (b) the world under the surface
  private under: FSPass | null = null;
  private underScene = new THREE.Scene();
  private underCam = new StageCam();
  private underW: Word3D | null = null;

  override init() {
    this.o = opt();
    const line = this.ctx.lyrics.get("Then I'll become");
    this.on = line.words.find((w) => /monster/i.test(w.w))?.start ?? 165.32;
    this.k = new Kit();
    this.lit = this.k.lit('MONSTER');
    this.s = heroScale(this.lit);
    this.ans = new Answer(this.k.st, 'MONSTER');
    this.blk = this.k.bf('MONSTER', this.o === 'a' ? 'direct' : 'mirror');
    if (this.o === 'b') {
      this.under = new FSPass(UNDER_FRAG, {
        invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, split: { value: 0 },
        t: { value: 0 }, shoreZ: { value: SHORE.z }, menisc: { value: 0 },
      });
      this.underW = new Word3D('MONSTER', heroFont(), { size: 220, incise: true });
      for (const l of this.underW.letters) { l.mat.uniforms.bf!.value = 1; l.mat.side = THREE.DoubleSide; }
      this.underScene.add(this.underW.group);
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const post = this.o === 'b' ? this.renderB(t, out) : this.o === 'c' ? this.renderC(t, out) : this.renderA(t, out);
    const hit = pulse(t, this.on, 0.08);
    return { ...post, shake: [noise1(t * 60, 1) * 6 * hit, noise1(t * 60, 2) * 6 * hit] };
  }

  /** The lit MONSTER standing on its onset, each letter sunk by `sink(k)` (world). */
  private poseLit(t: number, sink: (k: number) => number) {
    const capS = this.lit.cap * this.s;
    Kit.pose(this.lit, 0, this.s, (l, k, x) => {
      const h = popHinge(t, this.on, k), d = sink(k);
      return { x, y: -d, z: WORD_Z, hinge: h, on: h < HALF - 1e-4 && d < capS * 1.02 };
    });
    landGlow(this.lit, t, this.on);
  }

  // ---- (a) the answer stands up where the lit word was
  private renderA(t: number, out: THREE.WebGLRenderTarget) {
    const { renderer, audio } = this.ctx;
    const k = this.k, s = this.s, on = this.on, u = k.u;
    const capS = this.lit.cap * s, gap = 0.04 * capS;
    const c = hookCam(t, on, this.ctx.start, this.ctx.end);
    k.st.cam.set(c.pos, look(c.pos, c.pitch), 40);
    // letter by letter, left to right: the lit letter goes under, the black one comes up just behind it
    const a = (i: number) => on + 0.1 + i * 0.075;
    const sink = (i: number) => capS * 1.05 * prog(t, a(i), a(i) + 0.4, ease.inCubic);
    const rise = (i: number) => ease.outCubic(prog(t, a(i) + 0.06, a(i) + 0.46));
    this.poseLit(t, sink);
    Kit.pose(this.blk, 0, s, (l, i, x) => {
      const y = -(1 - rise(i)) * (capS + gap);
      return { x, y, z: WORD_Z + 0.04, hinge: 0, on: y + capS > 0 };
    });
    setRegion(k.st, this.ans.box(k.st, 0, s, gap));
    u.develop!.value = ease.outCubic(prog(t, on + 0.05, on + 0.6));
    u.creep!.value = 0.3 * prog(t, on, on + 0.6);
    const fl = ease.inOutCubic(prog(t, on + 0.6, on + 1.05));
    u.wFlood!.value = fl; u.sFlood!.value = fl; u.g2On!.value = 0;
    // under the surface: the black letters' unrisen part, painted on the clay (the mirror of the risen word)
    k.render(renderer, out, audio, t, () => Kit.mirrorOf(this.blk, this.ans.w, (l) => t >= on && l.y < -1e-4),
      () => this.ans.hide());
    return mixPost(SHORE_POST, CLAY_POST, fl);
  }

  // ---- (b) through the surface
  private renderB(t: number, out: THREE.WebGLRenderTarget) {
    const { renderer, audio } = this.ctx;
    const k = this.k, s = this.s, on = this.on, u = k.u;
    const capS = this.lit.cap * s, gap = 0.02 * capS;
    // the dip keeps going: level at the waterline by 165.6, then under, tilting down into the clay
    const tW = on + 0.28;
    const dip = ease.inOutCubic(prog(t, on - 0.12, tW));
    const down = ease.inOutCubic(prog(t, tW, tW + 0.55));
    const C = SHORE.cam;
    const y = lerp(C.y, 0, dip) - 0.3 * down;
    const z = lerp(C.z, LOW.z, dip) - 0.6 * down;
    const pitch = lerp(lerp(C.pitch, 0, dip), -0.115, down);
    const pos = new THREE.Vector3(0, y, z);
    // above: the shore (the camera never below the surface here)
    const pa = new THREE.Vector3(0, Math.max(y, 0.004), z);
    k.st.cam.set(pa, look(pa, pitch), 40);
    this.poseLit(t, () => 0);
    Kit.pose(this.blk, 0, s, (l, i, x) => ({ x, y: 0, z: WORD_Z, hinge: 0, on: false }));
    setRegion(k.st, this.ans.box(k.st, 0, s, gap));
    u.develop!.value = ease.outCubic(prog(t, on + 0.05, on + 0.6));
    u.creep!.value = 0.3 * prog(t, on, on + 0.6);
    u.wFlood!.value = 0; u.sFlood!.value = 0; u.g2On!.value = 0;
    // the lens's waterline sweeps up the frame as the camera crosses the surface (y from +0.03 to -0.03)
    const split = H * (0.5 - y / 0.06);
    if (split < H + 40) {
      k.render(renderer, out, audio, t, () => this.ans.pose(t, 0, s, on, gap), () => this.ans.hide());
    }
    if (split > -40) {
      const pu = new THREE.Vector3(0, Math.min(y, -0.004), z);
      this.underCam.set(pu, look(pu, pitch), 40);
      const uu = this.under!.u;
      this.underCam.invVP(uu.invVP!.value as THREE.Matrix4);
      (uu.camPos!.value as THREE.Vector3).copy(this.underCam.cam.position);
      uu.split!.value = Math.max(-40, Math.min(H + 400, split)); uu.t!.value = t;
      uu.menisc!.value = split < H ? 1 : 0;
      this.under!.render(renderer, out);
      // MONSTER under the surface: black slip, incised, upright, its top just under the surface
      Kit.pose(this.underW!, 0, s, (l, i, x) => ({ x, y: -(capS + gap), z: WORD_Z, hinge: 0, on: true }));
      renderer.setRenderTarget(out);
      renderer.clearDepth();
      renderer.render(this.underScene, this.underCam.cam);
    }
    void pos;
    return mixPost(SHORE_POST, CLAY_POST, down);
  }

  // ---- (c) the world turns over
  private renderC(t: number, out: THREE.WebGLRenderTarget) {
    const { renderer, audio } = this.ctx;
    const k = this.k, s = this.s, on = this.on, u = k.u;
    const capS = this.lit.cap * s, gap = 0.02 * capS;
    const c = hookCam(t, on, this.ctx.start, this.ctx.end);
    const roll = Math.PI * ease.inOutCubic(prog(t, on + 0.13, on + 0.83));
    // the lit word sinks out of sight as the frame turns
    this.poseLit(t, () => capS * 1.05 * prog(t, on + 0.13, on + 0.83));
    // the answer, painted turned over under the surface (its foot at the surface): upright once the frame has turned
    Kit.pose(this.blk, 0, s, (l, i, x) => {
      const h = popHinge(t, on, i);
      return { x: -x, y: gap, z: WORD_Z, hinge: h, yaw: Math.PI, on: h < HALF - 0.35 };
    });
    k.st.cam.set(c.pos, look(c.pos, c.pitch), 40);
    k.field2(this.blk, WORD_Z, capS + gap, ease.outCubic(prog(t, on + 0.05, on + 0.6)), roll);
    k.st.cam.set(c.pos, look(c.pos, c.pitch), 40, roll);
    u.develop!.value = 0; u.creep!.value = 0;
    const fl = ease.inOutCubic(prog(t, on + 0.55, on + 0.95));
    u.wFlood!.value = fl; u.sFlood!.value = 0;
    k.render(renderer, out, audio, t);
    return mixPost(SHORE_POST, CLAY_POST, fl);
  }
}
