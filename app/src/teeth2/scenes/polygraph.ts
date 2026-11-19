// Plate 4 `polygraph` (34.64 - 48.73), pre-chorus 1. Light plate: lightbox-white chart paper, film-black ink. Four pens
// (two pneumo, skin conductance, cardio); the cardio pen writes the lyric in the technical single-stroke hand, its
// trace climbing out of its line into the letters. The paper is fed like a ticker behind the writing pen and whipped
// forward between phrases; "lie": the cardio pen jumps a channel; "butterflies": all four pens tremble and the paper
// shivers; "looking through my eyes": the camera swings under the paper and looks through it (the words are written
// reversed on the paper so that they read from beneath); "make it out alive": the cardio pen races, and on the downbeat
// into chorus 1 it tears through the paper.
//
// Files: polygraph-script.ts (phrases, timing, the paper's feed, signals, camera path), polygraph-ink.ts (the ink
// target, the header), polygraph-glsl.ts (the frame).
import * as THREE from 'three';
import { Scene, type Frame } from '../../engine/scene';
import { FSPass, makeRT, clearRT, SCALE } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { clamp, ease, pulse } from '../../engine/util';
import { POLY_FRAG } from './polygraph-glsl';
import { drawInk, buildHeader, cardioPen, type InkWin } from './polygraph-ink';
import { Script, PEN_OX, CH, T0, T1, T_DROP, T_TEAR } from './polygraph-script';

const TANV = Math.tan((12 * Math.PI) / 180), TANH = TANV * (16 / 9);
const ARM_DIR = new THREE.Vector3(0.05, 0.93, 0.36).normalize();
const ARM_LEN = 1500;
/** World window of the ink target. */
const WIN = { w: 3000, h: 1500, y0: -750 };

export default class Polygraph extends Scene {
  private S!: Script;
  private pass!: FSPass;
  private lb!: LineBatch;
  private inkRT!: THREE.WebGLRenderTarget;
  private rho = 1;
  private hdr!: THREE.CanvasTexture;
  private beats: number[] = [];
  private downs: number[] = [];

  // camera scratch
  private pos = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();

  override init() {
    const au = this.ctx.audio;
    this.beats = au.beats;
    this.downs = au.downbeats.filter((b) => b >= T0 && b <= T1);
    this.S = new Script(this.ctx.lyrics, au.beats);
    this.rho = SCALE > 1 ? 2 : 1.15;
    this.inkRT = makeRT(Math.round(WIN.w * this.rho), Math.round(WIN.h * this.rho), {
      pxScale: 1, type: THREE.UnsignedByteType, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.inkRT.texture.anisotropy = 8;
    this.lb = new LineBatch(26000, { blend: 'max' });
    const h = buildHeader();
    this.hdr = new THREE.CanvasTexture(h.cv);
    this.hdr.generateMipmaps = true; this.hdr.minFilter = THREE.LinearMipmapLinearFilter; this.hdr.needsUpdate = true;
    const V4 = () => ({ value: new THREE.Vector4() });
    const vecs = (n: number) => ({ value: Array.from({ length: n }, () => new THREE.Vector4()) });
    this.pass = new FSPass(POLY_FRAG, {
      camPos: { value: new THREE.Vector3() }, camR: { value: new THREE.Vector3() }, camU: { value: new THREE.Vector3() }, camF: { value: new THREE.Vector3() },
      tanHV: { value: new THREE.Vector2(TANH, TANV) },
      inkTex: { value: this.inkRT.texture }, inkWin: V4(),
      hdrTex: { value: this.hdr }, hdrWin: { value: new THREE.Vector4(-1460, 200, h.w, h.h) },
      tNow: { value: 0 }, shiv: { value: 0 }, vel: { value: 0 }, pxu: { value: 1 }, soft: { value: 0 },
      penT: vecs(4), armS: vecs(4), armDir: { value: ARM_DIR.clone() }, armLen: { value: ARM_LEN },
      tearP: vecs(15), tearOn: { value: 0 }, tearOpen: { value: 0 }, exposure: { value: 1 },
    });
  }

  // ------------------------------------------------------------------ camera
  private placeCamera(t: number) {
    const S = this.S;
    const fr = S.framing(t);
    const phi = S.phi(t);
    // a hit on every downbeat (small, eased out), and the tear's lunge
    const kick = this.downs.reduce((m, b) => Math.max(m, pulse(t, b, 0.06)), 0);
    const w = fr.w * (1 - 0.014 * kick);
    const k = w / 1920;
    const rack = S.rack(t);
    const tx = rack - fr.rs * k * Math.cos(phi);
    const ty = fr.cy;
    const D = (w * 9 / 16 / 2) / TANV;
    const th = fr.tilt;
    // offset from the target: pitched a little, then yawed about the vertical axis
    const ox = D * Math.cos(th) * Math.sin(phi), oy = D * Math.sin(th), oz = D * Math.cos(th) * Math.cos(phi);
    this.pos.set(tx + ox, ty + oy, oz);
    this.fwd.set(tx - this.pos.x, ty - this.pos.y, -this.pos.z).normalize();
    this.right.crossVectors(this.fwd, new THREE.Vector3(0, 1, 0)).normalize();
    this.up.crossVectors(this.right, this.fwd).normalize();
    const c = Math.cos(fr.roll), s = Math.sin(fr.roll);
    const r2 = this.right.clone().multiplyScalar(c).addScaledVector(this.up, s);
    const u2 = this.up.clone().multiplyScalar(c).addScaledVector(this.right, -s);
    this.right.copy(r2); this.up.copy(u2);
    return { tx, w, D };
  }
  private project(q: THREE.Vector3): [number, number] {
    const v = q.clone().sub(this.pos);
    const zc = v.dot(this.fwd);
    if (zc < 1) return [1e5, 1e5];
    const x = v.dot(this.right) / (zc * TANH), y = v.dot(this.up) / (zc * TANV);
    return [(x * 0.5 + 0.5) * 1920, (y * 0.5 + 0.5) * 1080];
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const S = this.S, t = f.t, u = this.pass.u;
    const { tx, w } = this.placeCamera(t);
    u.camPos!.value.copy(this.pos); u.camR!.value.copy(this.right); u.camU!.value.copy(this.up); u.camF!.value.copy(this.fwd);
    u.tNow!.value = t;
    u.shiv!.value = S.shiver(t);
    u.vel!.value = S.rackV(t);
    u.pxu!.value = 1920 / w;
    u.exposure!.value = 1;

    // ---- the ink target
    const win: InkWin = { x0: tx - WIN.w / 2, y0: WIN.y0, w: WIN.w, h: WIN.h, rho: this.rho };
    clearRT(renderer, this.inkRT, [0, 0, 0], 0);
    drawInk(this.lb, S, t, win);
    this.lb.render(renderer, this.inkRT);
    (u.inkWin!.value as THREE.Vector4).set(win.x0, win.y0, win.w, win.h);

    // ---- the pens: tips, arms
    const rack = S.rack(t);
    const arms = u.armS!.value as THREE.Vector4[], tips = u.penT!.value as THREE.Vector4[];
    for (let i = 0; i < 4; i++) {
      let x: number, y: number, z = S.penZ(i, t);
      if (i < 3) {
        const sway = S.tremor(t) * 2.6 * Math.sin(t * 61 + i * 2);
        x = rack + PEN_OX[i]! + sway; y = S.penY(i, t);
      } else {
        const c = cardioPen(S, t);
        x = c.x; y = c.y;
        if (t >= T_TEAR) {
          // the lunge: the nib runs up the slit it opens, through the paper
          const tr = S.tear;
          let j = 0;
          while (j + 1 < tr.length - 1 && tr[j + 1]!.t < t) j++;
          const a = tr[j]!, b = tr[j + 1]!;
          const q = clamp((t - a.t) / Math.max(1e-3, b.t - a.t));
          const kk = ease.inQuad(clamp((t - T_TEAR) / 0.05));
          x = x + (a.x + (b.x - a.x) * q - x) * kk; y = y + (a.y + (b.y - a.y) * q - y) * kk;
          z = -30 * kk;
        }
      }
      tips[i]!.set(x, y, z, z < 1 ? 1 : 0);
      const T = new THREE.Vector3(x, y, z), B = T.clone().addScaledVector(ARM_DIR, ARM_LEN);
      const [ax, ay] = this.project(T), [bx, by] = this.project(B);
      arms[i]!.set(ax, ay, bx, by);
    }
    // ---- the tear
    const tp = u.tearP!.value as THREE.Vector4[];
    S.tear.forEach((q, i) => tp[i]!.set(q.x, q.y, q.t, q.r));
    u.tearOn!.value = t >= T_TEAR ? 1 : 0;
    u.tearOpen!.value = T_TEAR + 0.3;

    this.pass.render(renderer, out);

    // ---- post: the pens land, the paper is whipped, the tear
    let sh = 5 * pulse(t, T_DROP, 0.05) * (t >= T_DROP ? 1 : 0);
    for (const p of S.phrases.slice(1)) sh = Math.max(sh, 2.6 * pulse(t, p.w1, 0.045));
    const tearK = ease.inCubic(clamp((t - (T_TEAR + 0.1)) / 0.2));
    sh += 13 * tearK;
    const ang = t * 91;
    return { shake: [sh * Math.cos(ang), sh * 0.8 * Math.sin(ang * 1.3)] as [number, number], halation: 0.1, vignette: 0.3 };
  }
}
export { CH };
