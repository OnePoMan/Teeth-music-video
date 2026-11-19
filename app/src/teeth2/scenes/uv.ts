// Plate 6 `uv` — chorus 1, second half (62.54 – 76.35), docs/TEETH2.md. A different exhibit: the pillowcase from the
// bed (EXHIBIT 5, on its tag), laid out on a black bench in the dark. A gloved hand holds a short UV lamp low over the
// case and sweeps it on the beat; its beam is a soft pool (~40% of the frame wide) and the cloth outside it is near
// black. Where the pool lands, dried saliva traces fluoresce fluor-white, and they sink back into the dark ~0.5 s
// after it has passed (uv-glsl.ts, the excitation memory M). The camera never looks straight down (plate 3 owns
// fabric from above) and never centres a frontal hero (plate 5 owns those): five setups, cut on the downbeats —
// a table-height raking shot with the beam toward the lens, a three-quarter view of the bench with lamp and glove,
// a macro on the weave as the beam's edge uncovers letters, a swab close-up, and GO.
//
// Beats of the plate (the timing script of pass 1): the lamp snaps on with the first word (62.54); the beam walks
// each phrase word by word, landing on every onset; DIRTY sinks before "but"; on TEETH (68.47) the examiner brings the
// lamp down closer (the pool tightens and brightens, the camera pushes in); "put your hands on me": the lamp is held
// still and the other gloved hand draws a swab across the words' own traces, one stroke per word, each stroke lifting
// the glow off the cloth onto the cotton tip; "never, never, never ever": three sweeps, faster each time; "let go":
// the beam holds still on GO and its glow decays (compressed into GO's 0.43 s: ~25% left at the cut).
//
// Files: uv-type.ts (the lyric's layout on the cloth, the trace textures, the tag), uv-glsl.ts (the frame).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP } from '../../engine/gl';
import { clamp, ease, lerp, noise1, pulse, smootherstep } from '../../engine/util';
import { T_LIN } from '../palette';
import { bakeTag, bakeTraces, type TPhrase, type TWord } from './uv-type';
import { UV_FRAG, NW, NM } from './uv-glsl';

const VFOV = 30;
const HF = Math.atan(Math.tan((VFOV * Math.PI) / 360) * (16 / 9));
const DEG = Math.PI / 180;
const CUT = 1e-3;

type V2 = [number, number];
/** A setup. Camera: azimuth (deg, 0 = from the near side), elevation (deg), frame width at the focus (mm), where the
 *  focus sits in frame (fractions of width / height from centre), roll (deg). Lamp, in frame widths from the beam's
 *  aim point: to the camera's right, away from the camera, up; which way its handle points (+1 right, -1 left);
 *  the pool's radius across the tube (frame widths). */
interface Cam { az: number; el: number; w: number; ox: number; oy: number; roll: number; ls: number; lb: number; lu: number; hand: number; pr: number }
const KEYS = ['az', 'el', 'w', 'ox', 'oy', 'roll', 'ls', 'lb', 'lu', 'hand', 'pr'] as const;
const S = (az: number, el: number, w: number, ox: number, oy: number, roll: number, ls: number, lb: number, lu: number, hand: number, pr = 0.2): Cam =>
  ({ az, el, w, ox, oy, roll, ls, lb, lu, hand, pr });
const SET = {
  rakeA: S(-8, 24, 400, -0.1, -0.05, -1.5, 0.16, 0.44, 0.14, 1),
  tqA: S(42, 34, 500, 0.1, -0.04, 2, -0.3, 0.04, 0.2, -1),
  macro: S(-24, 48, 230, 0.1, -0.06, -1, -0.3, 0.14, 0.2, -1, 0.24),
  tqB: S(-40, 33, 480, 0.12, -0.04, -2, -0.34, 0.14, 0.26, -1),
  rakeB: S(30, 23, 400, 0.11, -0.05, 1.5, -0.16, 0.44, 0.14, -1),
  swab: S(10, 40, 430, -0.1, 0.12, 1, -0.24, 0.05, 0.17, -1),
  nv1: S(-32, 36, 380, -0.12, -0.04, -2, 0.3, 0.2, 0.25, 1),
  nv2: S(12, 25, 340, 0.11, -0.05, 1, -0.14, 0.44, 0.15, -1),
  nv3: S(38, 31, 330, -0.1, -0.04, 2.5, 0.34, 0.14, 0.25, 1),
  go: S(-16, 29, 330, 0.12, -0.04, -1, -0.3, 0.3, 0.25, -1),
};

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
const centre = (ws: TWord[]): V2 => {
  const x0 = Math.min(...ws.map((w) => w.x - w.w / 2)), x1 = Math.max(...ws.map((w) => w.x + w.w / 2));
  const y0 = Math.min(...ws.map((w) => w.y - w.h / 2)), y1 = Math.max(...ws.map((w) => w.y + w.h / 2));
  return [(x0 + x1) / 2, (y0 + y1) / 2];
};

export default class UvPlate extends Scene {
  private pass!: FSPass;
  private words: TWord[] = [];
  private phrases: TPhrase[] = [];
  private beamKeys: Key[] = [];
  private camKeys: Key[] = [];
  private cam = new THREE.PerspectiveCamera(VFOV, 16 / 9, 5, 8000);
  private tTeeth = 0; private tOn = 0;
  private swab = { t0: 0, t1: 0, s: [] as number[], A: [] as V2[], B: [] as V2[] };
  private exitT = new Map<TWord, [number, number]>();

  override init() {
    const { lyrics, audio } = this.ctx;
    const lines = lyrics.lines.filter((l) => l.start >= this.ctx.start - 0.05 && l.start < this.ctx.end - 0.2);
    const beats = audio.beats.filter((b) => b > this.ctx.start - 0.5 && b < this.ctx.end + 1);
    const downs = audio.downbeats.filter((b) => b > this.ctx.start + 0.1 && b < this.ctx.end - 0.1);
    const baked = bakeTraces(lines, beats, this.ctx.end);
    this.words = baked.words;
    this.phrases = baked.phrases;
    const P = this.phrases;
    this.tOn = this.ctx.start;
    const byText = (s: string) => this.words.filter((w) => w.text === s);
    const teeth = byText('TEETH')[0]!, go = byText('GO')[0]!, hands = byText('HANDS')[0]!;
    this.tTeeth = teeth.start;
    // a word sinks as its phrase hands over: dark by the next phrase's onset (DIRTY is gone before "but"), but never
    // before it has been seen
    for (const p of P) for (const w of p.words) {
      const e0 = Math.max(p.t1 - 0.11, w.start + 0.14);
      this.exitT.set(w, [e0, e0 + 0.1]);
    }

    // the beam: word to word, landing on each onset; held still over HANDS while the swab works; three sweeps across
    // the NEVERs, faster each time
    const holdP: V2 = centre([...P[7]!.words, hands]);
    const sweep = [0.5, 0.34, 0.2];
    let prevT = -1, nv = 0;
    for (const [pi, p] of P.entries()) {
      for (const w of p.words) {
        const gap = prevT < 0 ? 1 : w.start - prevT;
        if (pi === 7 || pi === 8) this.beamKeys.push({ t: w.start + 0.02, d: Math.min(0.85 * gap, 0.4), v: pi === 8 && !w.hero ? centre([hands, w]) : holdP });
        else if (w.text === 'NEVER') {
          const s = sweep[nv++]!;
          this.beamKeys.push({ t: w.start - 0.04, d: Math.min(0.12, 0.6 * gap), v: [w.x - w.w * 0.75, w.y - 4] });
          this.beamKeys.push({ t: w.start - 0.04 + s, d: s, v: [w.x + w.w * 0.08, w.y + 2] });
        } else this.beamKeys.push({ t: w.start + 0.02, d: Math.min(0.85 * gap, 0.4), v: [w.x, w.y] });
        prevT = w.start;
      }
    }

    // the shots: a cut on each setup's first phrase, eased reframings inside a setup
    const shot = (t: number, d: number, s: Cam, F: V2, o: Partial<Cam> = {}) => {
      const c = { ...s, ...o };
      this.camKeys.push({ t, d, v: [...KEYS.map((k) => c[k]), F[0], F[1]] });
    };
    const blk = (i: number) => centre(P[i]!.words);
    const ws = (...s: string[]) => this.words.filter((w) => s.includes(w.text));
    const pretty = byText('PRETTY')[0]!;
    shot(P[0]!.t0 - 0.2, CUT, SET.rakeA, blk(0));
    shot(P[1]!.t0 + 0.3, 0.4, SET.rakeA, blk(1), { w: 340, ox: 0.04, oy: -0.06 });
    shot(P[2]!.t0, CUT, SET.tqA, blk(2));
    shot(P[2]!.words[2]!.start + 0.3, 0.5, SET.tqA, blk(2), { w: 470 });
    shot(P[3]!.t0, CUT, SET.macro, centre(P[3]!.words.slice(0, 2)));
    shot(pretty.start + 0.32, 0.42, SET.macro, blk(3), { w: 390, ox: -0.1, oy: -0.04 });
    shot(P[4]!.t0 + 0.3, 0.4, SET.macro, blk(4), { w: 370, ox: 0.06, oy: -0.06 });
    shot(P[5]!.t0, CUT, SET.tqB, blk(5));
    shot(teeth.start + 0.1, 0.16, SET.tqB, centre([teeth]), { w: 380, lu: 0.2, lb: 0.22, pr: 0.17 });
    shot(P[6]!.t0, CUT, SET.rakeB, blk(6));
    shot(P[7]!.t0, CUT, SET.swab, holdP);
    shot(P[8]!.t0 + 0.3, 0.4, SET.swab, holdP, { w: 390, oy: 0.08 });
    shot(P[9]!.t0, CUT, SET.nv1, blk(9));
    shot(P[10]!.t0, CUT, SET.nv2, blk(10));
    shot(P[11]!.t0, CUT, SET.nv3, blk(11));
    const d8 = downs.find((b) => b > P[11]!.t0 && b < P[12]!.t0);
    if (d8) shot(d8, 0.22, SET.nv3, blk(11), { w: 300, ox: -0.1 });
    shot(P[12]!.t0, CUT, SET.go, blk(12));
    shot(go.start + 0.25, 0.3, SET.go, centre(ws('let', 'GO')), { w: 300 });
    this.camKeys.sort((a, b) => a.t - b.t);

    // the swab: one stroke per word of "put your hands on me", each across a trace: "put", "your", then HANDS three
    // times (between its letters' stems as far as it can), drawn toward the camera
    const sw = [...P[7]!.words, ...P[8]!.words];
    const across: [TWord, number][] = [[sw[0]!, 0.1], [sw[1]!, -0.05], [hands, -0.27], [hands, 0.06], [hands, 0.34]];
    this.swab.s = sw.map((w, k) => w.start + (k >= 2 ? 0.08 : 0.04));
    this.swab.A = across.map(([w, f]) => [w.x + f * w.w, w.y + 0.62 * w.h + 3] as V2);
    this.swab.B = across.map(([w, f]) => [w.x + f * w.w + 0.16 * w.h, w.y - 0.62 * w.h - 3] as V2);
    this.swab.t0 = this.swab.s[0]! - 0.4;
    this.swab.t1 = Math.min(this.swab.s[4]! + 0.75, P[9]!.t0);

    const W = Array.from({ length: NW }, () => new THREE.Vector4());
    const V = () => new THREE.Vector3();
    this.pass = new FSPass(UV_FRAG, {
      invVP: { value: new THREE.Matrix4() }, camPos: { value: V() }, res: { value: new THREE.Vector2() },
      covTex: { value: baked.cov }, idTex: { value: baked.id }, tagTex: { value: bakeTag() }, W: { value: W },
      lC: { value: V() }, lX: { value: V() }, lY: { value: V() }, lZ: { value: V() }, lampK: { value: 1 },
      Q: { value: new THREE.Vector2() }, pAx: { value: new THREE.Vector2(1, 0) }, pR: { value: 80 },
      M: { value: Array.from({ length: NM }, () => new THREE.Vector4()) },
      sP: { value: V() }, sX: { value: V() }, sY: { value: V() }, sZ: { value: V() }, swabOn: { value: 0 }, swabGlow: { value: 0 },
      strokes: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, strokeK: { value: [0, 0, 0, 0, 0] },
      pxAng: { value: 0 }, wordBounce: { value: V() }, ssTap: SS_TAP,
    });
    const st = this.pass.u.strokes!.value as THREE.Vector4[];
    for (let k = 0; k < 5; k++) st[k]!.set(this.swab.A[k]![0], this.swab.A[k]![1], this.swab.B[k]![0], this.swab.B[k]![1]);
  }

  /** The beam's aim point on the cloth (mm), with the hand's tremor. */
  private aim(t: number): V2 {
    const [x, y] = track(this.beamKeys, t);
    return [x! + 1.6 * noise1(t * 1.7, 3), y! + 1.3 * noise1(t * 1.9, 7)];
  }
  private setup(t: number): Cam & { fx: number; fy: number } {
    const v = track(this.camKeys, t);
    const c = Object.fromEntries(KEYS.map((k, i) => [k, v[i]!])) as unknown as Cam;
    return { ...c, fx: v[KEYS.length]!, fy: v[KEYS.length + 1]! };
  }
  /** The lamp's brightness: on with the first word, a kick on it and on TEETH (brought closer). */
  private lampK(t: number): number {
    if (t < this.tOn) return 0;
    const closer = clamp((t - this.tTeeth) / 0.1) * (1 - clamp((t - (this.tTeeth + 0.9)) / 0.5));
    return 1 + 0.45 * pulse(t, this.tOn, 0.06) + 0.25 * closer + 0.35 * pulse(t, this.tTeeth, 0.07);
  }

  /** Per word: level (gate x exit x decay), threshold (light -> heavy snap), beam gain, residual. */
  private wordState(w: TWord, t: number, out: THREE.Vector4) {
    const gate = clamp((t - (w.start - 0.045)) / 0.06);
    const [e0, e1] = this.exitT.get(w)!;
    let lvl = gate * (1 - clamp((t - e0) / (e1 - e0)));
    // GO bleaches under the held beam: ~25% left at the plate's cut
    if (w.text === 'GO' && t > w.start + 0.08) lvl *= Math.exp(-(t - w.start - 0.08) / 0.25);
    if (lvl <= 0) { out.set(0, 0.5, 0, 0); return; }
    let thr = 0.45;
    if (w.hero) {
      const snap = ease.outCubic(clamp((t - w.start) / 0.05));
      thr = w.serif ? lerp(0.62, 0.42, snap) : lerp(0.74, 0.5, snap);
    }
    out.set(lvl, thr, w.hero ? 1.15 : 0.95, 0.015);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, u = this.pass.u;
    const cam = this.setup(t);
    const az = cam.az * DEG, el = cam.el * DEG;
    const right = new THREE.Vector3(Math.cos(az), Math.sin(az), 0);
    const away = new THREE.Vector3(-Math.sin(az), Math.cos(az), 0);

    // the lamp: held off the aim point (in frame widths, relative to the camera), its window aimed at the aim point,
    // its tube across the beam's travel and turning a little into each sweep
    const Q = this.aim(t);
    const Qa = this.aim(t - 0.03), Qb = this.aim(t + 0.03);
    const vx = (Qb[0] - Qa[0]) / 0.06, vy = (Qb[1] - Qa[1]) / 0.06;
    const lC = new THREE.Vector3(Q[0], Q[1], 3)
      .addScaledVector(right, cam.ls * cam.w).addScaledVector(away, cam.lb * cam.w)
      .add(new THREE.Vector3(-vx * 0.012, -vy * 0.008, cam.lu * cam.w));
    const lZ = new THREE.Vector3(Q[0], Q[1], 3).sub(lC).normalize();
    const yaw = clamp(vx * 0.0003, -0.16, 0.16) * Math.sign(cam.hand);
    const ax0 = right.clone().multiplyScalar(Math.sign(cam.hand) || 1).applyAxisAngle(new THREE.Vector3(0, 0, 1), yaw);
    const lX = ax0.addScaledVector(lZ, -ax0.dot(lZ)).normalize();
    const lY = new THREE.Vector3().crossVectors(lZ, lX);
    (u.lC!.value as THREE.Vector3).copy(lC); (u.lX!.value as THREE.Vector3).copy(lX);
    (u.lY!.value as THREE.Vector3).copy(lY); (u.lZ!.value as THREE.Vector3).copy(lZ);
    const lk = this.lampK(t);
    u.lampK!.value = lk;
    (u.Q!.value as THREE.Vector2).set(Q[0], Q[1]);
    (u.pAx!.value as THREE.Vector2).set(lX.x, lX.y).normalize();
    u.pR!.value = cam.pr * cam.w;
    // the excitation memory: where the pool has been over the last ~0.6 s, fading with age
    const M = u.M!.value as THREE.Vector4[];
    const ages = [0, 0.05, 0.11, 0.18, 0.26, 0.35, 0.46, 0.6];
    for (let k = 0; k < NM; k++) {
      const a = ages[k]!, ta = t - a;
      const q = this.aim(ta), c = this.setup(ta);
      const wgt = Math.min(this.lampK(ta), 1.3) * (a < 0.12 ? 1 : Math.exp(-(a - 0.12) / 0.17));
      M[k]!.set(q[0], q[1], c.pr * c.w, wgt);
    }

    // the camera: the focus placed off-centre (ox, oy), never from above
    const D = cam.w / 2 / Math.tan(HF);
    const hgt = (cam.w * 9) / 16;
    const tgt = new THREE.Vector3(cam.fx, cam.fy, 3)
      .addScaledVector(right, -cam.ox * cam.w).addScaledVector(away, (-cam.oy * hgt) / Math.max(Math.sin(el), 0.3));
    const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), -Math.cos(el) * Math.cos(az), Math.sin(el));
    this.cam.position.copy(tgt).addScaledVector(dir, D);
    const fw = tgt.clone().sub(this.cam.position).normalize();
    const rt = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 0, 1)).normalize();
    const up = new THREE.Vector3().crossVectors(rt, fw).applyAxisAngle(fw, cam.roll * DEG);
    this.cam.up.copy(up);
    this.cam.lookAt(tgt);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    (u.invVP!.value as THREE.Matrix4).multiplyMatrices(this.cam.matrixWorld, this.cam.projectionMatrixInverse);
    (u.camPos!.value as THREE.Vector3).copy(this.cam.position);
    (u.res!.value as THREE.Vector2).set(out.width, out.height);
    u.pxAng!.value = (2 * Math.tan((VFOV * DEG) / 2)) / out.height;

    // the words
    const W = u.W!.value as THREE.Vector4[];
    let lit = 0;
    for (const w of this.words) {
      this.wordState(w, t, W[w.id]!);
      const d = Math.hypot(w.x - Q[0], w.y - Q[1]);
      lit = Math.max(lit, W[w.id]!.x * (w.hero ? 1 : 0.4) * clamp(1 - d / (cam.pr * cam.w * 1.6)));
    }
    const fl = T_LIN.fluor;
    (u.wordBounce!.value as THREE.Vector3).set(fl[0], fl[1], fl[2]).multiplyScalar(0.03 * lit);

    // the swab
    const s = this.swab;
    const swOn = t > s.t0 && t < s.t1;
    u.swabOn!.value = swOn ? 1 : 0;
    const SD = 0.2;
    const sk = u.strokeK!.value as number[];
    for (let k = 0; k < 5; k++) sk[k] = t < s.t1 + 0.5 ? ease.inOutQuad(clamp((t - s.s[k]!) / SD)) : 0;
    u.swabGlow!.value = sk.reduce((a, b) => a + b, 0) * 0.26;
    if (swOn) {
      // the tip's path: in from the near right, down onto each stroke's start, drawn through it, lifted between
      // strokes, and away after "me"
      const Z0 = 6.4;
      const off = new THREE.Vector3().addScaledVector(right, 260).addScaledVector(away, -110);
      let x: number, y: number, z: number;
      const s0 = s.s[0]!;
      if (t < s0 - 0.02) {
        const k = ease.outCubic(clamp((t - s.t0) / (s0 - 0.02 - s.t0)));
        x = s.A[0]![0] + off.x * (1 - k); y = s.A[0]![1] + off.y * (1 - k); z = Z0 + 90 * (1 - k) * (1 - k);
      } else {
        let i = 0;
        while (i < 4 && t >= s.s[i + 1]! - 0.02) i++;
        const a = s.A[i]!, b = s.B[i]!;
        const ks = ease.inOutQuad(clamp((t - s.s[i]!) / SD));
        if (t < s.s[i]! + SD) { x = lerp(a[0], b[0], ks); y = lerp(a[1], b[1], ks); z = Z0; }
        else if (i < 4) {
          const n = s.A[i + 1]!;
          const kk = ease.inOutCubic(clamp((t - s.s[i]! - SD) / Math.max(0.05, s.s[i + 1]! - 0.02 - s.s[i]! - SD)));
          x = lerp(b[0], n[0], kk); y = lerp(b[1], n[1], kk); z = Z0 + 9 * Math.sin(Math.PI * kk);
        } else {
          const k = ease.inCubic(clamp((t - s.s[4]! - SD - 0.05) / 0.5));
          x = b[0] + off.x * k; y = b[1] + off.y * k; z = Z0 + 3 * clamp((t - s.s[4]! - SD) / 0.06) + 90 * k * k;
        }
      }
      const h = new THREE.Vector3().addScaledVector(right, 0.64).addScaledVector(away, -0.77);
      const e = 11 * DEG;
      const sX = new THREE.Vector3(h.x * Math.cos(e), h.y * Math.cos(e), Math.sin(e)).normalize();
      const sZ = new THREE.Vector3(0, 0, 1).addScaledVector(sX, -sX.z).normalize();
      const sY = new THREE.Vector3().crossVectors(sZ, sX);
      (u.sP!.value as THREE.Vector3).set(x, y, z);
      (u.sX!.value as THREE.Vector3).copy(sX); (u.sY!.value as THREE.Vector3).copy(sY); (u.sZ!.value as THREE.Vector3).copy(sZ);
    }

    this.pass.render(this.ctx.renderer, out);
    const kick = 0.25 * pulse(t, this.tOn, 0.05) + 0.15 * pulse(t, this.tTeeth, 0.06);
    const sh = 5 * pulse(t, this.tTeeth, 0.07);
    return { exposure: 1 + kick, halation: 0.12, bloom: 0.4, shake: [sh * 0.7, -sh * 0.5] as [number, number] };
  }
}
