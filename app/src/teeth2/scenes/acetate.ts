// Plate 12 `acetate` (145.41 - 159.23), chorus 3a, stripped. A dark desk under one angled, cold lamp: a glossy print of
// the golden apple's bite with a sheet of clear acetate taped over it (the same sheet that plate 13 lays over the casts:
// same scale, same 0.42 mm technical line). A gloved hand traces each anterior tooth's mark onto the acetate, one mark
// per sung phrase (the upper arc left to right with the chip at #8 last, on "teeth"; then the lower arc), and the lyric,
// printed on the photograph beneath in Archivo, is uncovered beside the pen as it works: each word wipes on ahead of
// its onset as unsung halide, lights lightbox white on the onset; the hero words large (the hero snaps light to black).
// The camera holds one framing per bar, easing into each downbeat, drifting a little after the pen; on the last bar it
// pulls back to the whole bite, chip and all. The lamp kicks with the kicks (152.37, 152.62, 152.95): its arm knocks, the
// pool swings and tightens and steps up in light. Files: acetate-ink.ts (layout, tracing, lyric), acetate-glsl.ts.
import * as THREE from 'three';
import { Scene, type Frame } from '../../engine/scene';
import { FSPass, SS_TAP } from '../../engine/gl';
import { clamp, ease, lerp } from '../../engine/util';
import {
  buildMarks, buildInk, buildBite, buildPhrases, layoutPhrase, drawZone, zoneCanvas, penAt, type MarkPath, type Phrase,
} from './acetate-ink';
import { MAIN_FRAG } from './acetate-glsl';

const VFOV = 26;
const Z_AC = 1.3;

interface Cam { cx: number; cy: number; w: number; roll: number; tilt: number }
/** One framing per bar (table mm centre, view width), then the whole-bite pull-back for the last frames. */
const BARS: Cam[] = [
  { cx: -12, cy: -47, w: 132, roll: -0.04, tilt: 0.15 },
  { cx: -2, cy: -50, w: 118, roll: 0.035, tilt: 0.12 },
  { cx: 17, cy: -40, w: 164, roll: -0.03, tilt: 0.16 },
  { cx: 12, cy: -48, w: 126, roll: 0.05, tilt: 0.13 },
  { cx: -14, cy: 39, w: 150, roll: 0.04, tilt: 0.15 },
  { cx: -8, cy: 41, w: 146, roll: -0.04, tilt: 0.13 },
  { cx: 0, cy: 47, w: 130, roll: 0.03, tilt: 0.15 },
  { cx: 8, cy: 47, w: 126, roll: -0.05, tilt: 0.15 },
];
const WIDE: Cam = { cx: 8, cy: 4, w: 340, roll: -0.04, tilt: 0.16 };
const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), w: lerp(a.w, b.w, k), roll: lerp(a.roll, b.roll, k), tilt: lerp(a.tilt, b.tilt, k),
});

const dataTex = (cv: HTMLCanvasElement, opts: { mips?: boolean; nearest?: boolean; premult?: boolean } = {}) => {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = !!opts.mips;
  t.minFilter = opts.mips ? THREE.LinearMipmapLinearFilter : opts.nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.magFilter = opts.nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.anisotropy = opts.mips ? 8 : 1;
  t.premultiplyAlpha = !!opts.premult;
  t.needsUpdate = true;
  return t;
};

export default class Acetate extends Scene {
  private pass!: FSPass;
  private cam = new THREE.PerspectiveCamera(VFOV, 16 / 9, 1, 5000);
  private marks: MarkPath[] = [];
  private phrases: Phrase[] = [];
  private bars: number[] = [];
  private kicks: [number, number][] = [];
  private zcv: HTMLCanvasElement[] = [];
  private ztex: THREE.CanvasTexture[] = [];
  private zkey = ['', ''];
  private zon = [0, 0];

  override init() {
    const au = this.ctx.audio;
    this.marks = buildMarks();
    this.phrases = buildPhrases(this.ctx.lyrics.lines, au.beats, this.marks, this.ctx.start, this.ctx.end);
    this.phrases.forEach(layoutPhrase);
    this.bars = au.downbeats.filter((b) => b >= this.ctx.start - 0.02 && b < this.ctx.end - 0.02);
    // the lamp's kicks: the three in the stripped chorus, and the faint ticks before them
    this.kicks = (au.onsets.kick ?? []).filter(([t]) => t >= this.ctx.start - 0.05 && t < this.ctx.end - 0.1).map(([t, v]) => [t, v] as [number, number]);
    const ink = buildInk(this.marks);
    const bite = buildBite();
    for (let z = 0; z < 2; z++) {
      this.zcv.push(zoneCanvas());
      this.ztex.push(dataTex(this.zcv[z]!, { mips: true, premult: true }) as THREE.CanvasTexture);
    }
    this.pass = new FSPass(MAIN_FRAG, {
      invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, res: { value: new THREE.Vector2() },
      lyrU: { value: this.ztex[0] }, lyrL: { value: this.ztex[1] },
      inkCov: { value: dataTex(ink.cov) }, inkDat: { value: dataTex(ink.dat, { nearest: true }) },
      bmS: { value: dataTex(bite.S, { mips: true }) }, bmG: { value: dataTex(bite.G, { mips: true }) },
      prog: { value: new Array<number>(12).fill(0) },
      keyPos: { value: new THREE.Vector3(-230, 215, 820) }, aim: { value: new THREE.Vector2(-4, 6) }, cone: { value: new THREE.Vector2() },
      lampK: { value: 0.9 },
      hTip: { value: new THREE.Vector3() }, hE1: { value: new THREE.Vector3() }, hE2: { value: new THREE.Vector3() }, hE3: { value: new THREE.Vector3() },
      handOn: { value: 0 }, zon: { value: new THREE.Vector2() }, ssTap: SS_TAP,
    });
  }

  /** The lamp's kick: a sharp attack, a short decay, summed over the onsets (weighted by their strength). */
  private kick(t: number) {
    let s = 0;
    for (const [tk, v] of this.kicks) if (t >= tk && t < tk + 0.6) s += (0.4 + v) * Math.exp(-(t - tk) / 0.085);
    return Math.min(s, 1.4);
  }

  // ------------------------------------------------------------------------------------------------ the camera
  private barCam(t: number): Cam {
    let i = 0;
    for (let k = 0; k < this.bars.length; k++) if (t >= this.bars[k]! - 1e-4) i = k;
    return BARS[Math.min(i, BARS.length - 1)]!;
  }
  private framing(t: number, pen: { x: number; y: number; on: number }): Cam {
    const end = this.ctx.end;
    const at = (t2: number) => this.barCam(t2);
    let c = at(t);
    // ease into each reframing just before its downbeat (0.17 s)
    const next = this.bars.find((b) => b > t && b - t < 0.17);
    if (next !== undefined) c = mixCam(c, at(next + 0.001), ease.inOutCubic(1 - (next - t) / 0.17));
    // the camera follows the pen a little between the snaps
    const fx = clamp((pen.x - c.cx) * 0.22, -7, 7), fy = clamp((pen.y - c.cy) * 0.18, -4, 4);
    c = { ...c, cx: c.cx + fx, cy: c.cy + fy };
    // the last bar: pull back to the whole traced bite, landing on the final downbeat
    const k = ease.inOutCubic(clamp((t - (end - 0.78)) / 0.78));
    return k > 0 ? mixCam(c, WIDE, k) : c;
  }

  private placeCamera(s: Cam) {
    const hf = Math.atan(Math.tan((VFOV * Math.PI) / 360) * (16 / 9));
    const D = s.w / 2 / Math.tan(hf);
    const tgt = new THREE.Vector3(s.cx, -s.cy, 0);
    const dir = new THREE.Vector3(0, -Math.sin(s.tilt), Math.cos(s.tilt)).normalize();
    this.cam.position.copy(tgt).addScaledVector(dir, D);
    this.cam.up.set(Math.sin(s.roll), Math.cos(s.roll), 0);
    this.cam.lookAt(tgt);
    this.cam.fov = VFOV; this.cam.aspect = 16 / 9;
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
  }

  // ------------------------------------------------------------------------------------------------ the frame
  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t;
    const u = this.pass.u;
    const pen = penAt(t, this.marks, this.phrases, this.ctx.start, this.ctx.end);
    const cam = this.framing(t, pen);
    this.placeCamera(cam);
    (u.invVP!.value as THREE.Matrix4).multiplyMatrices(this.cam.matrixWorld, this.cam.projectionMatrixInverse);
    (u.camPos!.value as THREE.Vector3).copy(this.cam.position);
    (u.res!.value as THREE.Vector2).set(out.width, out.height);

    // the lamp rides its arm: its pool is swung onto the work with each framing (a hard cone, falling to film black at the
    // frame's edges), and it kicks with the kicks: the arm knocks, the pool jolts and tightens, the light steps up
    const kk = this.kick(t);
    const kc = Math.min(kk, 1);
    u.lampK!.value = 0.9 + 0.4 * kc;
    const deg = Math.PI / 180;
    const wide = clamp((cam.w - 150) / 190), outer = Math.atan(((0.62 + 0.4 * wide) * cam.w) / 860) / deg * (1 - 0.14 * kc), inner = Math.atan(((0.29 + 0.22 * wide) * cam.w) / 860) / deg * (1 - 0.1 * kc);
    (u.cone!.value as THREE.Vector2).set(Math.cos(inner * deg), Math.cos(outer * deg));
    const ax = cam.cx * 0.85 - 7 * kk * Math.sin(t * 9.0), ay = cam.cy * 0.85 + 5 * kk * Math.cos(t * 7.0);
    (u.aim!.value as THREE.Vector2).set(ax, ay);
    (u.keyPos!.value as THREE.Vector3).set(ax - 226 + 14 * kk, -ay + 221 - 10 * kk, 820 - 26 * kk);

    // the tracing
    const pr = u.prog!.value as number[];
    for (let i = 0; i < 12; i++) pr[i] = pen.prog[i]!;

    // the lyric: the active phrase into its zone's canvas (re-drawn only when something on it changes)
    const ph = this.phrases.find((p) => t >= p.t0 && t < p.t1) ?? null;
    for (let z = 0; z < 2; z++) {
      let key = 'none';
      if (ph && ph.zone === z) {
        key = this.phrases.indexOf(ph) + ':' + Math.round(t * 120);
      }
      if (key !== this.zkey[z]) {
        this.zon[z] = drawZone(this.zcv[z]!, ph, t, z as 0 | 1) ? 1 : 0;
        this.ztex[z]!.needsUpdate = true;
        this.zkey[z] = key;
      }
    }
    (u.zon!.value as THREE.Vector2).set(this.zon[0]!, this.zon[1]!);

    // the hand and pen
    u.handOn!.value = pen.on;
    {
      const c = Math.cos(pen.tilt), s = Math.sin(pen.tilt);
      const head = pen.head + 0.025 * Math.sin(t * 2.3);
      const dx = Math.cos(head), dy = Math.sin(head);
      const e1 = new THREE.Vector3(dx * c, -dy * c, s);
      const e2 = new THREE.Vector3(-dy, -dx, 0);
      const e3 = new THREE.Vector3().crossVectors(e1, e2).normalize();
      if (e3.z < 0) e3.negate();
      (u.hTip!.value as THREE.Vector3).set(pen.x, -pen.y, Z_AC + 0.12 + pen.z);
      (u.hE1!.value as THREE.Vector3).copy(e1);
      (u.hE2!.value as THREE.Vector3).copy(e2);
      (u.hE3!.value as THREE.Vector3).copy(e3);
    }
    this.pass.render(renderer, out);
    // the lamp arm knocked by a kick: a small jolt of the frame, the lamp's own
    const sh = 3.2 * Math.min(kk, 1);
    return { shake: [sh * 0.8, -sh * 0.6] as [number, number], halation: 0.2 };
  }
}
