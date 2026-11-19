// Plate 6 `uv` — chorus 1, second half (62.54 – 76.35), docs/TEETH2.md. A different exhibit: the pillowcase from the
// bed (EXHIBIT 5, unlabelled here), laid out on a black bench in the dark. A gloved fist holds a UV wand over the far
// side of the case and sweeps it on the beat; where the violet beam lands, dried saliva traces fluoresce fluor-white:
// each sung word is revealed by the beam on its onset and sinks back into the dark behind it; the camera tracks with
// the lamp. The violet is only ever the lamp's light (its window, its pool on the cloth, its bounce on the gloves).
//
// Beats of the plate: the lamp snaps on with the first word (62.54); the beam walks each phrase word by word, landing
// on every onset, with a carriage return to the next row of the case on each line's downbeat; on TEETH (68.47) the
// examiner brings the lamp down closer (the pool tightens and brightens, the camera pushes in); "put your hands on me":
// the lamp is held still and the other gloved hand swabs the patch under HANDS, one stroke per word, each stroke
// lifting glow off the cloth onto the cotton tip; "never, never, never ever": three sweeps, faster each time; "let go":
// the beam holds still on GO and its glow decays into the dark (the trace bleaching under the lamp: the one word
// here that fades by itself). Hero words appear thin and snap heavy on their onset (the trace's threshold drops).
//
// Files: uv-type.ts (the lyric's layout on the cloth, the trace textures), uv-glsl.ts (the frame).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP } from '../../engine/gl';
import { clamp, ease, lerp, noise1, pulse, smootherstep } from '../../engine/util';
import { T_LIN } from '../palette';
import { bakeTraces, type TPhrase, type TWord } from './uv-type';
import { UV_FRAG, NW } from './uv-glsl';

const VFOV = 30;
const HF = Math.atan(Math.tan((VFOV * Math.PI) / 360) * (16 / 9));
const DEG = Math.PI / 180;
/** Where the beam is held while the swab works (between "put your", HANDS and the patch). */
const HOLD_C: [number, number] = [205, -58];

type V2 = [number, number];
/** Camera: azimuth (deg, 0 = from the near side), elevation (deg), frame width at the target (mm), lift of the target
 *  toward the far side (mm), roll (deg); lamp: its offset from the aim point (back, up, mm). */
interface Cam { az: number; el: number; w: number; lift: number; roll: number; back: number; up: number }
const C = (az: number, el: number, w: number, lift = 22, roll = 0, back = 90, up = 62): Cam => ({ az, el, w, lift, roll, back, up });
/** One framing per phrase (uv-type.ts PHRASES), eased into its onset. */
const FRAMES: Cam[] = [
  C(-6, 60, 400, 22, -1.5), C(-2, 58, 410, 22, 0), C(5, 62, 390, 20, 1.5),
  C(-9, 57, 390, 22, -2), C(-4, 58, 410, 22, 0), C(4, 60, 400, 20, 1),
  C(8, 58, 390, 22, 2), C(2, 64, 460, 12, 0), C(-2, 66, 440, 12, -1),
  C(-10, 55, 370, 22, -2), C(-4, 57, 360, 22, 1), C(3, 59, 355, 22, -1),
  C(0, 62, 370, 20, 0),
];
const CAM_KEYS = ['az', 'el', 'w', 'lift', 'roll', 'back', 'up'] as const;

interface Key { t: number; d: number; v: number[] }
/** Piecewise moves: from each key's value to the next, eased (smootherstep), arriving at the key's time. */
function track(keys: Key[], t: number): number[] {
  const v = keys[0]!.v.slice();
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!, p = keys[i - 1]!;
    const u = smootherstep(0, 1, (t - (k.t - k.d)) / k.d);
    if (u <= 0) break;
    for (let j = 0; j < v.length; j++) v[j]! += (k.v[j]! - p.v[j]!) * u;
  }
  return v;
}

export default class UvPlate extends Scene {
  private pass!: FSPass;
  private words: TWord[] = [];
  private phrases: TPhrase[] = [];
  private beamKeys: Key[] = [];
  private blockKeys: Key[] = [];
  private camKeys: Key[] = [];
  private cam = new THREE.PerspectiveCamera(VFOV, 16 / 9, 5, 8000);
  private tTeeth = 0; private tGo = 0; private tOn = 0;
  private swab = { t0: 0, t1: 0, s: [] as number[], A: [] as V2[], B: [] as V2[] };
  private patchT0 = 0; private patchT1 = 0;
  /** When each word sinks: its phrase hands over; a hero stays through the hero-less phrase after it (DIRTY under "but your"). */
  private exitT = new Map<TWord, number>();

  override init() {
    const { lyrics, audio } = this.ctx;
    const lines = lyrics.lines.filter((l) => l.start >= this.ctx.start - 0.05 && l.start < this.ctx.end - 0.2);
    const beats = audio.beats.filter((b) => b > this.ctx.start - 0.5 && b < this.ctx.end + 1);
    const baked = bakeTraces(lines, beats, this.ctx.end);
    this.words = baked.words;
    this.phrases = baked.phrases;
    this.tOn = this.ctx.start;
    const teeth = this.words.find((w) => w.text === 'TEETH')!;
    const go = this.words.find((w) => w.text === 'GO')!;
    this.tTeeth = teeth.start; this.tGo = go.start;
    this.phrases.forEach((p, i) => {
      const nx = this.phrases[i + 1];
      for (const w of p.words) this.exitT.set(w, w.hero && nx && !nx.hero && Math.abs(nx.t0 - p.t1) < 1e-6 ? nx.t1 : p.t1);
    });

    // the beam: word to word, landing on each onset; held still for "put your hands on me"
    const hold = new Set([7, 8]);
    let prevT = -1;
    for (const [pi, p] of this.phrases.entries()) {
      for (const w of p.words) {
        const at: V2 = hold.has(pi) ? HOLD_C : [w.x, w.y];
        const gap = prevT < 0 ? 1 : w.start - prevT;
        this.beamKeys.push({ t: w.start + 0.1, d: Math.min(0.85 * gap, 0.4), v: at });
        prevT = w.start;
      }
    }
    // the framing's centre: the phrase's block (with the hold point for the swab), eased into each phrase
    this.phrases.forEach((p, i) => {
      let at: V2 = hold.has(i) ? [HOLD_C[0], HOLD_C[1] - 10] : p.block;
      const pv = this.phrases[i - 1];
      if (!p.hero && !hold.has(i) && pv?.hero) {
        // a hero-less phrase is framed with the hero it sings under
        const h = pv.hero, xs = [h.x - h.w / 2, h.x + h.w / 2, ...p.words.flatMap((w) => [w.x - w.w / 2, w.x + w.w / 2])];
        const ys = [h.y - h.h / 2, h.y + h.h / 2, ...p.words.flatMap((w) => [w.y - w.h / 2, w.y + w.h / 2])];
        at = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
      }
      const gap = i === 0 ? 1 : p.t0 - this.phrases[i - 1]!.t0;
      this.blockKeys.push({ t: p.t0 + 0.3, d: Math.min(0.9 * gap, 0.5), v: at });
      const fr = FRAMES[i]!;
      this.camKeys.push({ t: p.t0 + 0.3, d: Math.min(0.9 * gap, 0.5), v: CAM_KEYS.map((k) => fr[k]) });
      // TEETH: the lamp brought down closer and the camera pushed in; GO: a last push that holds
      if (p.words.includes(teeth)) this.camKeys.push({ t: teeth.start + 0.1, d: 0.16, v: CAM_KEYS.map((k) => C(2, 65, 320, 18, 0.5, 72, 48)[k]) });
      if (p.words.includes(go)) this.camKeys.push({ t: go.start + 0.35, d: 0.42, v: CAM_KEYS.map((k) => C(0, 66, 340, 22, 0)[k]) });
    });
    this.camKeys.sort((a, b) => a.t - b.t);

    // the swab: one stroke per word of "put your hands on me", across the patch under HANDS
    const sw = [...this.phrases[7]!.words, ...this.phrases[8]!.words];
    this.swab.s = sw.map((w) => w.start);
    this.swab.A = sw.map((_, k) => [142 + 31 * k, -108 + 3 * Math.sin(k * 2.1)] as V2);
    this.swab.B = this.swab.A.map(([x, y]) => [x + 19, y - 33] as V2);
    this.swab.t0 = this.swab.s[0]! - 0.36;
    this.swab.t1 = this.swab.s[4]! + 0.75;
    this.patchT0 = this.swab.s[0]! - 0.05;
    this.patchT1 = this.phrases[8]!.t1;

    const W = Array.from({ length: NW }, () => new THREE.Vector4());
    const V = () => new THREE.Vector3();
    this.pass = new FSPass(UV_FRAG, {
      invVP: { value: new THREE.Matrix4() }, camPos: { value: V() }, res: { value: new THREE.Vector2() },
      covTex: { value: baked.cov }, idTex: { value: baked.id }, W: { value: W },
      lC: { value: V() }, lX: { value: V() }, lY: { value: V() }, lZ: { value: V() }, lampK: { value: 1 }, irrNorm: { value: 1 },
      sP: { value: V() }, sX: { value: V() }, sY: { value: V() }, sZ: { value: V() }, swabOn: { value: 0 }, swabGlow: { value: 0 },
      strokes: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, strokeK: { value: [0, 0, 0, 0, 0] }, patchK: { value: 0 },
      pxAng: { value: 0 }, wordBounce: { value: V() }, ssTap: SS_TAP,
    });
    const st = this.pass.u.strokes!.value as THREE.Vector4[];
    for (let k = 0; k < 5; k++) st[k]!.set(this.swab.A[k]![0], this.swab.A[k]![1], this.swab.B[k]![0], this.swab.B[k]![1]);
  }

  /** The beam's aim point on the cloth (mm), with the hand's tremor. */
  private aim(t: number): V2 {
    const [x, y] = track(this.beamKeys, t);
    return [x! + 1.3 * noise1(t * 1.7, 3), y! + 1.1 * noise1(t * 1.9, 7)];
  }

  /** Per word: level (gate x exit x decay), threshold (light -> heavy snap), beam gain, residual. */
  private wordState(w: TWord, t: number, out: THREE.Vector4) {
    const p = this.phrases[w.phrase]!;
    const gate = clamp((t - (w.start - 0.045)) / 0.06);
    const exit = 1 - clamp((t - (this.exitT.get(w) ?? p.t1)) / 0.12);
    let lvl = gate * exit;
    if (w.text === 'GO') lvl *= t < w.start + 0.1 ? 1 : Math.exp(-(t - w.start - 0.1) / 0.3);
    if (lvl <= 0) { out.set(0, 0.5, 0, 0); return; }
    let thr = 0.45;
    if (w.hero) {
      const snap = ease.outCubic(clamp((t - w.start) / 0.05));
      thr = w.serif ? lerp(0.62, 0.42, snap) : lerp(0.74, 0.5, snap);
    }
    out.set(lvl, thr, w.hero ? 1.05 : 0.9, w.hero ? 0.42 : 0.3);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, u = this.pass.u;
    const cv = track(this.camKeys, t);
    const cam: Cam = Object.fromEntries(CAM_KEYS.map((k, i) => [k, cv[i]!])) as unknown as Cam;
    const az = cam.az * DEG, el = cam.el * DEG;
    const ca = Math.cos(az), sa = Math.sin(az);
    const rot = (x: number, y: number): V2 => [x * ca - y * sa, x * sa + y * ca];

    // the lamp: over the far side of the case (relative to the camera), aimed at the beam's point, its tube turning
    // a little into each sweep
    const Q = this.aim(t);
    const Qa = this.aim(t - 0.03), Qb = this.aim(t + 0.03);
    const vx = (Qb[0] - Qa[0]) / 0.06, vy = (Qb[1] - Qa[1]) / 0.06;
    const [bx, by] = rot(0, cam.back);
    const lC = new THREE.Vector3(Q[0] + bx - vx * 0.012, Q[1] + by - vy * 0.008, 3 + cam.up);
    const lZ = new THREE.Vector3(Q[0], Q[1], 3).sub(lC).normalize();
    const yaw = clamp(vx * 0.00035, -0.18, 0.18);
    const ax0 = new THREE.Vector3(Math.cos(az + yaw), Math.sin(az + yaw), 0);
    const lX = ax0.addScaledVector(lZ, -ax0.dot(lZ)).normalize();
    const lY = new THREE.Vector3().crossVectors(lZ, lX);
    (u.lC!.value as THREE.Vector3).copy(lC); (u.lX!.value as THREE.Vector3).copy(lX);
    (u.lY!.value as THREE.Vector3).copy(lY); (u.lZ!.value as THREE.Vector3).copy(lZ);
    // normalise: the flat cloth under the aim point = 1 (the same model as irr() in the shader)
    {
      const p = new THREE.Vector3(Q[0], Q[1], 3);
      const v = p.clone().sub(lC);
      const r2 = v.lengthSq();
      const l = v.normalize();
      const cz = l.dot(lZ);
      u.irrNorm!.value = Math.sqrt(r2) / (Math.max(cz ** 5, 1e-3) * Math.max(-l.z, 1e-3));
    }
    const on = t >= this.tOn ? 1 : 0;
    const closer = clamp((t - this.tTeeth) / 0.1) * (1 - clamp((t - (this.tTeeth + 0.9)) / 0.5));
    u.lampK!.value = on * (1 + 0.45 * pulse(t, this.tOn, 0.06) + 0.18 * closer + 0.35 * pulse(t, this.tTeeth, 0.07));

    // the camera
    const B = track(this.blockKeys, t), Ql = this.aim(t - 0.09);
    const [lx, ly] = rot(0, cam.lift);
    const tgt = new THREE.Vector3(0.7 * B[0]! + 0.3 * Ql[0] + lx, 0.7 * B[1]! + 0.3 * Ql[1] + ly, 3);
    const D = cam.w / 2 / Math.tan(HF);
    const dir = new THREE.Vector3(Math.cos(el) * sa, -Math.cos(el) * ca, Math.sin(el));
    this.cam.position.copy(tgt).addScaledVector(dir, D);
    const fw = tgt.clone().sub(this.cam.position).normalize();
    const right = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 0, 1)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fw).applyAxisAngle(fw, cam.roll * DEG);
    this.cam.up.copy(up);
    this.cam.lookAt(tgt);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    (u.invVP!.value as THREE.Matrix4).multiplyMatrices(this.cam.matrixWorld, this.cam.projectionMatrixInverse);
    (u.camPos!.value as THREE.Vector3).copy(this.cam.position);
    (u.res!.value as THREE.Vector2).set(out.width, out.height);
    u.pxAng!.value = (2 * Math.tan((VFOV * DEG) / 2)) / 1080;

    // the words
    const W = u.W!.value as THREE.Vector4[];
    let lit = 0;
    for (const w of this.words) {
      this.wordState(w, t, W[w.id]!);
      const d = Math.hypot(w.x - Q[0], w.y - Q[1]);
      lit = Math.max(lit, W[w.id]!.x * (w.hero ? 1 : 0.4) * clamp(1 - d / 220));
    }
    const fl = T_LIN.fluor;
    (u.wordBounce!.value as THREE.Vector3).set(fl[0], fl[1], fl[2]).multiplyScalar(0.035 * lit);

    // the swab
    const s = this.swab;
    const swOn = t > s.t0 && t < s.t1;
    u.swabOn!.value = swOn ? 1 : 0;
    const sk = u.strokeK!.value as number[];
    for (let k = 0; k < 5; k++) sk[k] = ease.inOutQuad(clamp((t - s.s[k]!) / 0.16));
    u.swabGlow!.value = sk.reduce((a, b) => a + b, 0) * 0.24;
    const pk = clamp((t - this.patchT0) / 0.06) * (1 - clamp((t - this.patchT1) / 0.12));
    u.patchK!.value = pk;
    if (swOn) {
      // the tip's path: in from the near right, down onto each stroke's start, drawn through it on the word's onset,
      // lifted between strokes, and away after "me"
      const Z0 = 6.2;
      const off: V2 = rot(260, -110);
      let x: number, y: number, z: number;
      const s0 = s.s[0]!;
      if (t < s0 - 0.02) {
        const k = ease.outCubic(clamp((t - s.t0) / (s0 - 0.02 - s.t0)));
        x = s.A[0]![0] + off[0] * (1 - k); y = s.A[0]![1] + off[1] * (1 - k); z = Z0 + 90 * (1 - k) * (1 - k);
      } else {
        let i = 0;
        while (i < 4 && t >= s.s[i + 1]! - 0.02) i++;
        const a = s.A[i]!, b = s.B[i]!;
        const ks = ease.inOutQuad(clamp((t - s.s[i]!) / 0.16));
        if (t < s.s[i]! + 0.16) { x = lerp(a[0], b[0], ks); y = lerp(a[1], b[1], ks); z = Z0; }
        else if (i < 4) {
          // back to the next stroke's start, lifted off the cloth
          const n = s.A[i + 1]!;
          const kk = ease.inOutCubic(clamp((t - s.s[i]! - 0.16) / Math.max(0.05, s.s[i + 1]! - 0.02 - s.s[i]! - 0.16)));
          x = lerp(b[0], n[0], kk); y = lerp(b[1], n[1], kk); z = Z0 + 7 * Math.sin(Math.PI * kk);
        } else {
          const k = ease.inCubic(clamp((t - s.s[4]! - 0.2) / 0.5));
          x = b[0] + off[0] * k; y = b[1] + off[1] * k; z = Z0 + 3 * clamp((t - s.s[4]! - 0.16) / 0.06) + 90 * k * k;
        }
      }
      const [hx, hy] = rot(0.93, -0.37);
      const e = 30 * DEG;
      const sX = new THREE.Vector3(hx * Math.cos(e), hy * Math.cos(e), Math.sin(e)).normalize();
      const sZ = new THREE.Vector3(0, 0, 1).addScaledVector(sX, -sX.z).normalize();
      const sY = new THREE.Vector3().crossVectors(sZ, sX);
      (u.sP!.value as THREE.Vector3).set(x, y, z);
      (u.sX!.value as THREE.Vector3).copy(sX); (u.sY!.value as THREE.Vector3).copy(sY); (u.sZ!.value as THREE.Vector3).copy(sZ);
    }

    this.pass.render(this.ctx.renderer, out);
    const kick = 0.3 * pulse(t, this.tOn, 0.05) + 0.18 * pulse(t, this.tTeeth, 0.06);
    const sh = 5 * pulse(t, this.tTeeth, 0.07);
    return { exposure: 1 + kick, halation: 0.12, bloom: 0.4, shake: [sh * 0.7, -sh * 0.5] as [number, number] };
  }
}
