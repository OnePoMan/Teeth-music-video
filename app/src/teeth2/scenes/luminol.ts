// Plate 11 `luminol` — the bridge (131.60 – 145.41), docs/TEETH2.md. No drums. A film-black evidence room: his dark
// shirt on a wire hanger, a thin clear evidence bag hanging on a wire just in front of it. No key light: the plate is lit
// only by the reaction (the luminol patch in the weave over the left chest) plus one constant dim cold ambient. The
// camera circles the shirt and settles on a new angle at each phrase start. A gloved hand sprays luminol from a trigger
// sprayer (the spray itself is never drawn); where it lands the patch rises over ~0.3 s, then fades, on each phrase.
// The lyric is printed on the bag's clear face and reads only where the glow is behind it: SHIRT, *rose* (wax
// Cormorant, the one warm thing), WHO, HEART, BEATING.
//
// Beats: 131.60 wide, easing to three-quarter left for "Blood" (132.30), the first spray; a push for *rose*; near-profile
// for "You're looking at me" (135.70); "like you don't know who I am": a cut to the bag's label, NAME:, easing to a
// close-up as the gloved hand's pen comes down on "don't" (137.65) and stops; NAME stays blank; WHO beside it. Three-
// quarter right for "Blood on my shirt" (139.23); a macro on the patch for HEART (141.03, glow 1 of 2, it fades); wide
// for "Still beating" (142.69, glow 2, it fades to an ember). On the 143.69 downbeat a hard cut: the shirt folded in the
// sealed bag, the seal flap slaps down; a cut to the seal strip, and the hand signs the T.F. monogram on it (pen down on
// the next beat, T.F. ~25% of the frame's width). Hard cut out at 145.41.
//
// Files: luminol-type.ts (the bag's print, the label, the seal), luminol-glsl.ts (the frame), luminol-hands.ts.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP } from '../../engine/gl';
import { clamp, ease, lerp, noise1, pulse, smootherstep } from '../../engine/util';
import { monoPenAt, monoWritten } from '../monogram';
import { LUM_FRAG } from './luminol-glsl';
import { bakeLabel, bakeLyric, SealInk, monoToFlap, LABEL, NAME_LINE, FLAP, SIGN, TILE_W, TILE_H, ATLAS_C, type LPhrase, type LWord } from './luminol-type';
import { MONO_H } from '../monogram';

const VFOV = 30;
const DEG = Math.PI / 180;
const CUT = 1e-3;
const BAG_Y = -150, BAG_Z0 = -150;
const BLOOM = new THREE.Vector3(110, -55, -335);

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
interface Spray { t: number; a: number; tau: number; fl: number; pump: boolean }

export default class LuminolPlate extends Scene {
  private pass!: FSPass;
  private phrases: LPhrase[] = [];
  private exitT = new Map<LWord, number>();
  private camKeys: Key[] = [];
  private sprays: Spray[] = [];
  private cam = new THREE.PerspectiveCamera(VFOV, 16 / 9, 5, 20000);
  private seal = new SealInk();
  private tSeal = 143.69; private tLand = 143.76; private sign0 = 144.12; private sign1 = 144.66;
  private tClose0 = 136.99; private tClose1 = 138.51;
  private tFirst = 132.3;
  private tSealCU = 143.95;
  private heroT: number[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    const lines = lyrics.lines.filter((l) => l.start >= this.ctx.start - 0.05 && l.start < this.ctx.end - 0.2);
    const beats = audio.beats.filter((b) => b > this.ctx.start - 0.5 && b < this.ctx.end + 1);
    const downs = audio.downbeats.filter((b) => b > this.ctx.start - 0.05 && b < this.ctx.end - 0.1);
    const baked = bakeLyric(lines);
    this.phrases = baked.phrases;
    const P = this.phrases;
    const nextBeat = (t: number) => beats.find((b) => b > t + 0.02) ?? t + 0.43;
    for (const [i, p] of P.entries()) {
      const nx = P[i + 1];
      const lineEnd = Math.max(...p.words.map((w) => w.end));
      let e = nx ? nx.t0 : this.ctx.end + 1;
      if (nx && nx.line !== p.line) e = Math.min(e, nextBeat(lineEnd));
      for (const w of p.words) this.exitT.set(w, Math.max(e, w.start + 0.25));
    }
    const W = (pi: number, wi: number) => P[pi]!.words[wi]!;
    const shirt = W(0, 3), rose = W(1, 0), who = W(4, 0), heart = W(6, 0), still = W(7, 0), beating = W(7, 1);
    this.heroT = [shirt.start, who.start, heart.start];
    this.tFirst = W(0, 0).start;
    // the bar grid: the seal on the last downbeat of the window, the pen down on the next beat
    this.tSeal = downs[downs.length - 1] ?? 143.69;
    this.tLand = this.tSeal + 0.07;
    this.sign0 = beats.find((b) => b > this.tSeal + 0.2) ?? this.tSeal + 0.43;
    this.sign1 = this.sign0 + 0.54;
    // the close-up on the label: from the end of "me" (the phrase's onset, "like") to the next downbeat
    this.tClose0 = P[3]!.t0 - 0.01;
    this.tClose1 = downs.find((d) => d > who.start) ?? 138.51;

    // the re-sprays: one on every phrase (the hand pumps where it is in frame), a second flare on SHIRT; HEART and
    // "Still beating" glow and fade, twice
    const sp = (t: number, a: number, tau = 0.9, fl = 0.4, pump = true) => this.sprays.push({ t, a, tau, fl, pump });
    sp(P[0]!.t0, 0.85); sp(shirt.start, 1.15); sp(rose.start, 1.1); sp(P[2]!.t0, 0.95);
    sp(P[3]!.t0, 0.95, 0.9, 0.4, false); sp(who.start, 1.15, 0.9, 0.4, false); sp(P[5]!.t0, 1.0);
    sp(heart.start, 1.55, 0.5, 0.06); sp(still.start, 1.4, 0.7, 0.22);
    void beating;
    this.sprays.sort((a, b) => a.t - b.t);

    // the camera: az (deg), el (deg), distance (mm), target xyz; cuts and eased circling moves that stop on phrases
    const k = (t: number, d: number, az: number, el: number, D: number, x: number, y: number, z: number) =>
      this.camKeys.push({ t, d, v: [az, el, D, x, y, z] });
    const d0 = (i: number, dflt: number) => downs[i] ?? dflt;
    const labX = LABEL.u0 + LABEL.w / 2, labZ = BAG_Z0 + LABEL.v0 - LABEL.h / 2;
    const tDont = P[3]!.words[2]!.start;
    // the seal strip: frame the monogram so it is ~25% of the frame's width
    const mW = SIGN.size, mX = -FLAP.hw + SIGN.x + mW / 2, mZ = BAG_Z0 - (SIGN.y + (MONO_H * SIGN.size) / 2);
    const dSeal = (4 * mW) / (2 * Math.tan((VFOV * DEG) / 2) * (16 / 9));
    this.tSealCU = (this.tLand + this.sign0) / 2;
    k(this.ctx.start, CUT, -22, 4, 1950, 0, 0, -370);
    k(this.tFirst, this.tFirst - this.ctx.start - 0.02, -40, 5, 1600, 10, 0, -350);       // three-quarter left
    k(d0(1, 133.33), d0(1, 133.33) - this.tFirst - 0.05, -30, 4, 1430, 40, -20, -345);
    k(rose.start, 0.8, -16, 3, 1170, 75, -40, -350);                                    // a push for rose
    k(P[2]!.t0, 0.7, 58, 4, 1300, 30, -40, -345);                                       // near-profile
    k(d0(3, 136.78), d0(3, 136.78) - P[2]!.t0 - 0.05, 64, 6, 1220, 30, -40, -348);
    k(this.tClose0, CUT, -5, -2, 780, labX + 40, BAG_Y, labZ);                           // the label
    k(tDont, tDont - this.tClose0 - 0.02, -9, -3, 560, labX + 20, BAG_Y, labZ);         // NAME close-up
    k(who.start, 0.4, -4, -2, 620, labX + 110, BAG_Y, labZ + 5);                        // WHO beside it
    k(this.tClose1, CUT, 30, 3, 1560, 30, 0, -365);
    k(P[5]!.t0, P[5]!.t0 - this.tClose1 - 0.02, 40, 4, 1400, 40, -20, -355);            // three-quarter right
    k(d0(5, 140.23), d0(5, 140.23) - P[5]!.t0 - 0.05, 34, 3, 1320, 50, -20, -352);
    k(heart.start, heart.start - d0(5, 140.23) - 0.02, 12, -1, 830, 100, -60, -345);     // macro on the patch
    k(d0(6, 141.96), d0(6, 141.96) - heart.start - 0.05, 8, 0, 770, 96, -60, -345);
    k(P[7]!.t0, P[7]!.t0 - d0(6, 141.96) - 0.02, -10, 5, 1750, 30, 0, -390);           // wide
    k(this.tSeal - 0.01, this.tSeal - P[7]!.t0 - 0.05, -6, 5, 1640, 30, 0, -390);
    k(this.tSeal, CUT, -6, 4, 940, 30, BAG_Y, -345);                                    // the sealed bag
    k(this.tSealCU, CUT, -8, 6, dSeal * 0.97, mX, BAG_Y, mZ + 6);                           // the seal strip
    k(this.ctx.end - 0.05, this.ctx.end - 0.05 - this.tSealCU - 0.02, -5, 6, dSeal * 0.9, mX + 4, BAG_Y, mZ + 4);

    const V = () => new THREE.Vector3();
    this.pass = new FSPass(LUM_FRAG, {
      invVP: { value: new THREE.Matrix4() }, camPos: { value: V() }, res: { value: new THREE.Vector2() }, pxAng: { value: 0 },
      mode: { value: 0 }, glowK: { value: 0 }, glowR: { value: 1 }, flapA: { value: -0.12 },
      lyrTex: { value: baked.tex }, labTex: { value: bakeLabel() }, sealTex: { value: this.seal.tex },
      tileO: { value: new THREE.Vector2() },
      wR: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      wS: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      sprayOn: { value: 0 }, sPull: { value: 0 }, sTip: { value: V() }, sE1: { value: V() }, sE2: { value: V() }, sE3: { value: V() },
      handOn: { value: 0 }, hTip: { value: V() }, hE1: { value: V() }, hE2: { value: V() }, hE3: { value: V() },
      ssTap: SS_TAP,
    });
  }

  /** The glow's level: each spray's patch rises over ~0.3 s (centred a little after the pump) and decays to its floor;
   *  the previous level carries and fades under it. */
  private glow(t: number): number {
    let carry = 0, tc = -1e9, lvl = 0;
    const at = (s: Spray, x: number, c: number, cT: number) => {
      const r0 = s.t - 0.12, r1 = s.t + 0.18;
      const rise = smootherstep(r0, r1, x);
      const dec = x < r1 ? 1 : s.fl + (1 - s.fl) * Math.exp(-(x - r1) / s.tau);
      return Math.max(c * Math.exp(-(x - cT) / 1.2), s.a * rise * dec);
    };
    for (let i = 0; i < this.sprays.length; i++) {
      const s = this.sprays[i]!;
      if (t < s.t - 0.12) break;
      lvl = at(s, t, carry, tc);
      const nx = this.sprays[i + 1];
      if (nx) { carry = at(s, nx.t - 0.12, carry, tc); tc = nx.t - 0.12; }
    }
    return lvl;
  }

  private wordState(w: LWord, t: number): [number, number, number, number] {
    const gate = clamp((t - (w.start - 0.045)) / 0.06);
    const lvl = gate * (1 - clamp((t - this.exitT.get(w)!) / 0.08));
    if (lvl <= 0) return [0, 0.5, 1, 0];
    let thr = 0.5;
    if (w.hero) {
      const snap = ease.outCubic(clamp((t - w.start) / 0.05));
      thr = w.serif ? lerp(0.64, 0.46, snap) : lerp(0.72, 0.45, snap);
    }
    return [lvl, thr, w.hero ? 1.15 : 1, w.serif ? 1 : 0];
  }

  /** Pen-hand basis on the bag's face: x right, down the face, out of it toward the camera. */
  private penBasis(head: number, tilt: number) {
    const R = new THREE.Vector3(1, 0, 0), D = new THREE.Vector3(0, 0, -1), N = new THREE.Vector3(0, -1, 0);
    const c = Math.cos(tilt), s = Math.sin(tilt), dx = Math.cos(head), dy = Math.sin(head);
    const e1 = R.clone().multiplyScalar(dx * c).addScaledVector(D, dy * c).addScaledVector(N, s);
    const e2 = R.clone().multiplyScalar(-dy).addScaledVector(D, dx);
    const e3 = new THREE.Vector3().crossVectors(e1, e2).normalize();
    if (e3.dot(N) < 0) e3.negate();
    return [e1, e2, e3];
  }
  /** The pen tip (world) and pose, or null when the hand is out of frame. */
  private pen(t: number): { p: THREE.Vector3; head: number; tilt: number } | null {
    const onFace = (u: number, v: number, hover: number) => new THREE.Vector3(u, BAG_Y - 0.45 - hover, BAG_Z0 + v);
    if (t >= this.tClose0 && t < this.tClose1) {
      // NAME: the pen comes in from the lower right, down to the blank line, and stops there
      const lab = (x: number, y: number, h: number) => onFace(LABEL.u0 + x, LABEL.v0 - y, h);
      const sx = NAME_LINE.x0 + 3, sy = NAME_LINE.y - 0.6;
      const tDown = this.phrases[3]!.words[2]!.start; // "don't"
      const tWho = this.phrases[4]!.t0;
      const kIn = ease.outCubic(clamp((t - this.tClose0) / (tDown - 0.15 - this.tClose0)));
      const kDn = ease.inOutCubic(clamp((t - (tDown - 0.15)) / 0.15));
      const kUp = ease.inOutCubic(clamp((t - tWho - 0.05) / 0.4));
      const tr = 0.35 * noise1(t * 3.1, 5);
      const x = lerp(sx + 70, sx, kIn) + 3 * kUp + tr, y = lerp(sy + 175, sy, kIn) + 5 * kUp + tr;
      const h = lerp(lerp(150, 9, kIn), 2.0, kDn) + 11 * kUp;
      return { p: lab(x, y, h), head: 1.05 + 0.08 * (1 - kIn), tilt: 0.62 };
    }
    if (t >= this.tLand && t < this.ctx.end) {
      // the seal: in from the lower right, pen down on the beat, the monogram, then away
      const fl = (fx: number, fy: number, h: number) => new THREE.Vector3(-FLAP.hw + fx, BAG_Y - 0.8 - 0.45 - h, BAG_Z0 - fy);
      const st = monoPenAt(this.sign0, this.sign0, this.sign1);
      const [sx, sy] = monoToFlap(st.x, st.y);
      let x: number, y: number, h: number;
      if (t < this.sign0) {
        const k = ease.outCubic(clamp((t - this.tLand) / (this.sign0 - this.tLand)));
        x = lerp(sx + 150, sx, k); y = lerp(sy + 140, sy, k); h = lerp(90, 0, ease.inOutCubic(k));
      } else if (t <= this.sign1) {
        const pp = monoPenAt(t, this.sign0, this.sign1);
        [x, y] = monoToFlap(pp.x, pp.y);
        h = pp.down ? 0 : 3.5;
      } else {
        const pe = monoPenAt(this.sign1, this.sign0, this.sign1);
        const [ex, ey] = monoToFlap(pe.x, pe.y);
        const k = ease.inCubic(clamp((t - this.sign1 - 0.05) / 0.55));
        x = ex + 170 * k; y = ey + 150 * k; h = 4 + 80 * ease.outQuad(clamp((t - this.sign1 - 0.05) / 0.25));
        if (k >= 1) return null;
      }
      return { p: fl(x, y, h), head: 0.95 + (x - sx) * 0.002, tilt: 0.96 + (y - sy) * 0.001 };
    }
    return null;
  }

  /** The sprayer: nozzle (world), in from the left, a pump on each spray, away before the cut. */
  private sprayer(t: number): { p: THREE.Vector3; pull: number } | null {
    const inClose = t >= this.tClose0 && t < this.tClose1;
    const t0 = this.tFirst - 0.45, t1 = this.tSeal - 0.5;
    if (t < t0 || t > t1 + 0.4 || inClose || t >= this.tSeal) return null;
    const home = new THREE.Vector3(-330, -105, -305);
    const kIn = ease.outCubic(clamp((t - t0) / 0.38));
    const kOut = ease.inCubic(clamp((t - t1) / 0.4));
    const away = new THREE.Vector3(-700, -320, -380);
    const p = home.clone().lerp(away, 1 - kIn).lerp(away, kOut);
    let pull = 0;
    for (const s of this.sprays) {
      if (!s.pump) continue;
      const u = t - (s.t - 0.06);
      if (u > -0.08 && u < 0.3) pull = Math.max(pull, u < 0 ? ease.inOutQuad(clamp((u + 0.08) / 0.08)) : 1 - ease.inOutQuad(clamp((u - 0.06) / 0.2)));
    }
    p.x += 4 * pull + 1.2 * noise1(t * 1.3, 2);
    p.z += 1.0 * noise1(t * 1.5, 9);
    return { p, pull };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, u = this.pass.u;
    const mode = t >= this.tSeal ? 1 : 0;
    u.mode!.value = mode;

    // the camera
    const [az, el, D, tx, ty, tz] = track(this.camKeys, t).map((x, i) => (i < 2 ? x * DEG : x)) as number[];
    const tgt = new THREE.Vector3(tx, ty, tz);
    const dir = new THREE.Vector3(Math.sin(az!) * Math.cos(el!), -Math.cos(az!) * Math.cos(el!), Math.sin(el!));
    this.cam.position.copy(tgt).addScaledVector(dir, D!);
    this.cam.up.set(0, 0, 1);
    this.cam.lookAt(tgt);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    (u.invVP!.value as THREE.Matrix4).multiplyMatrices(this.cam.matrixWorld, this.cam.projectionMatrixInverse);
    (u.camPos!.value as THREE.Vector3).copy(this.cam.position);
    (u.res!.value as THREE.Vector2).set(out.width, out.height);
    u.pxAng!.value = (2 * Math.tan((VFOV * DEG) / 2)) / out.height;

    // light: only the reaction (no key, no flash); the patch reveals itself outward on the first spray
    u.glowK!.value = this.glow(t);
    u.glowR!.value = 0.55 + 0.45 * ease.outCubic(clamp((t - (this.tFirst - 0.12)) / 0.5));
    // the seal flap: standing open, then slapped down on the downbeat (landing a beat-fraction later, a small bounce)
    if (!mode) u.flapA!.value = -1.5;
    else {
      const k = clamp((t - this.tSeal) / (this.tLand - this.tSeal));
      u.flapA!.value = lerp(0.62 * Math.PI, Math.PI, k * k) - (k >= 1 ? 0.035 * Math.sin((t - this.tLand) * 40) * Math.exp(-(t - this.tLand) / 0.05) : 0);
    }

    // the lyric: the current phrase's tile and its words' states
    let pi = -1;
    for (let i = 0; i < this.phrases.length; i++) if (t >= this.phrases[i]!.t0 - 0.06) pi = i;
    const wR = u.wR!.value as THREE.Vector4[], wS = u.wS!.value as THREE.Vector4[];
    for (let k = 0; k < 4; k++) { wR[k]!.set(1e4, -1e4, -1e4, 1e4); wS[k]!.set(0, 0.5, 1, 0); }
    if (pi >= 0) {
      const p = this.phrases[pi]!;
      (u.tileO!.value as THREE.Vector2).set((p.tile % ATLAS_C) * TILE_W, Math.floor(p.tile / ATLAS_C) * TILE_H);
      p.words.forEach((w, k) => { wR[k]!.set(...w.rect); wS[k]!.set(...this.wordState(w, t)); });
    }

    // the seal's monogram
    this.seal.draw(mode && t >= this.sign0 ? monoWritten(t, this.sign0, this.sign1) : 0);

    // the pen hand
    const h = this.pen(t);
    u.handOn!.value = h ? 1 : 0;
    if (h) {
      const [e1, e2, e3] = this.penBasis(h.head, h.tilt);
      (u.hTip!.value as THREE.Vector3).copy(h.p);
      (u.hE1!.value as THREE.Vector3).copy(e1!); (u.hE2!.value as THREE.Vector3).copy(e2!); (u.hE3!.value as THREE.Vector3).copy(e3!);
    }
    // the spray hand: aimed at the bloom
    const s = this.sprayer(t);
    u.sprayOn!.value = s ? 1 : 0;
    if (s) {
      const e1 = BLOOM.clone().sub(s.p).normalize();
      const e3 = new THREE.Vector3(0, 0, 1).addScaledVector(e1, -e1.z).normalize();
      const e2 = new THREE.Vector3().crossVectors(e3, e1);
      (u.sTip!.value as THREE.Vector3).copy(s.p);
      (u.sE1!.value as THREE.Vector3).copy(e1); (u.sE2!.value as THREE.Vector3).copy(e2); (u.sE3!.value as THREE.Vector3).copy(e3);
      u.sPull!.value = s.pull;
    }

    this.pass.render(this.ctx.renderer, out);
    const sh = mode ? 4 * pulse(t, this.tLand, 0.05) : 0;
    return { halation: 0.14, bloom: 0.4, shake: [sh * 0.4, -sh] as [number, number] };
  }
}
