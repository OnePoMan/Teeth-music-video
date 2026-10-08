// `everything` — the opening and verse 1, line 1: "How has everything been turned against us?" (docs/MONSTER.md).
// A fire behind us, never seen, lights the clay wall of a cave. On it, one per musical event, the shadows of the four
// monsters of verse 2, each turning into the next (src/monster/figures.ts): Polyphemus over his flock, Circe at her
// cup, Poseidon's wave and trident, the wooden horse. "How has" stands up on the floor under the horse. On
// "everything" the camera is thrown back and the word folds up out of the floor letter by letter, lit by the fire,
// and its shadow on the wall is all four monsters, each unfolding with its letter. On "turned" their eyes open on
// us; "against us?" stands up near the camera; and on the notes of the rising figure they strike at the word one by
// one, like puppets (client: the zoom at the camera felt cheesy): Polyphemus' club comes down, Circe levels her staff
// and the pig charges, Poseidon hurls his trident, soldiers pour out of the horse; the letters beneath each one jolt,
// and on the last hit the fire gutters into the cut.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, noise1, prog, pulse } from '../../engine/util';
import { flameState } from '../motifs';
import { GLSL_FIGURES } from '../figures';
import { POP, Stage, Word3D, popHinge, popWords, vkeys } from '../stage';

/**
 * The shadow theatre on the clay wall. The opening (figMode 0): one figure, morphing through the four (weights
 * figW) with its animation (figA, figB) and placement (figT). Line 1 (figMode 1): the frieze of all four, each
 * with its own place (frX, frS), rising out of the floor line with its letter (frUp), swelling about a point when
 * it rushes at us (frG about frGx, frGy) with its penumbra (frBlur); eyes open on us (frLook) and glow (eyeW).
 */
const HOOKS = GLSL_FIGURES + /* glsl */ `
uniform vec4 figW, figA, figB, figT;
uniform float figOn, figMode;
uniform vec4 frX, frY, frS, frUp, frG, frGx, frGy, frBlur, frAct;
uniform float frLook, frEye, frTime, eyeGlow;
uniform vec4 eyeW[5];
float monsters(vec2 p) {
  vec2 q = (p - figT.xy) / figT.z;
  if (abs(q.x) > 13.0 || q.y > 10.5 || q.y < -1.0) return 1e3;
  float d = 0.0;
  if (figW.x > 0.001) d += figW.x * polyphemus(q, figA.x, figB.y, 0.0);
  if (figW.y > 0.001) d += figW.y * circe(q, figA.y, 0.0, 0.0);
  if (figW.z > 0.001) d += figW.z * poseidon(q, figA.z, figB.w, figB.x, 0.0, 0.0);
  if (figW.w > 0.001) d += figW.w * trojanHorse(q - vec2(figB.z, 0.0), figA.w, figT.w, figB.z, 0.0, 0.0);
  return d / max(dot(figW, vec4(1.0)), 1e-3) * figT.z;
}
float frMonster(int i, vec2 q) {
  if (i == 0) return polyphemus(q, frEye, frTime, frAct.x);
  if (i == 1) return circe(q, 1.0, frLook, frAct.y);
  if (i == 2) {                                                                                     // the god and his trident only
    float m = abs(q.x - 0.5) - 3.3, d = max(poseidon(q, 1.0, 1.0, 0.6, frLook, frAct.z), m);
    return frAct.z > 0.0 ? min(d, max(trident(q - vec2(0.6, 0.0), 2.05, 7.2, frAct.z), -m)) : d;   // (thrown, past his side)
  }
  return trojanHorse(q, 1.0, 1.0, 0.0, frLook, frAct.w);
}
float frieze(vec2 p) {
  float lit = 1.0;
  for (int i = 0; i < 4; i++) {
    float s = frS[i], up = frUp[i], g = frG[i];
    if (s <= 0.0 || up <= 0.01) continue;
    vec2 G = vec2(frGx[i], frGy[i]);
    vec2 q = (G + (p - G) / g - vec2(frX[i], frY[i])) / s;
    q.y /= up;
    if (abs(q.x) > 8.0 || q.y > 10.5 || q.y < -1.0) continue;
    float d = frMonster(i, q) * s * g * min(up, 1.0);
    float w = max(gPix * 0.75, frBlur[i]);
    lit *= smoothstep(-w, w, d);
  }
  return 1.0 - lit;
}
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) {
  if (!wall || figOn <= 0.0) return 0.0;
  if (figMode > 0.5) return figOn * frieze(P.xy);
  float w = max(gPix * 0.75, 0.01);
  return figOn * (1.0 - smoothstep(-w, w, monsters(P.xy)));
}
vec3 skyTint(vec3 D, vec3 col) { return col; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  if (!wall || eyeGlow <= 0.0) return col;
  float gl = 0.0;
  for (int i = 0; i < 5; i++) {
    vec4 e = eyeW[i];
    if (e.w <= 0.0) continue;
    vec2 d = (P.xy - e.xy) / vec2(e.z, e.z * 0.55);
    gl += e.w * exp(-dot(d, d) * 1.4);
  }
  return col + mix(C_EMBER, C_BONE, 0.35) * gl * eyeGlow;
}`;

/** The opening's events: Polyphemus on the swell, Circe on the bass note, Poseidon on the rising figure, the horse
 *  on its last notes (audio.json: bass 1.75-2.75, 'orch' 3.01, 3.34, 3.67, 3.84, 4.18). */
const OPEN = { circe: 1.7, poseidon: 2.7, horse: 3.67, morph: 0.16 };
/** The fire behind us (world), never seen; its reach. The wall. */
const FIRE = new THREE.Vector3(2.8, 2.8, 15.5), REACH = 40, WALL_Z = -10.6;
/** The word stands on a shallow arc (centre z, radius) well before the wall, facing the camera; its cap height. */
const ARC = { cz: 10.5, R: 14 }, CAP = 1.6;
/**
 * The frieze behind the word (wall units): each monster's x and scale; the letter of EVERYTHING it unfolds with
 * (E, R, T, N); the point it swells about when it rushes at us (figure-local); its eyes (figure-local x, y,
 * half-width) for the glow.
 */
const FRIEZE = [
  { x: -9.3, s: 0.74, letter: 0, g: [0, 5.6], eyes: [[0, 6.75, 0.78]] },
  { x: -1.5, s: 0.72, letter: 3, g: [-1.2, 3.6], eyes: [[-3.15, 5.82, 0.2], [1.6, 1.55, 0.3]] },
  { x: 4.7, s: 0.66, letter: 5, g: [0.6, 4.4], eyes: [[0.32, 4.72, 0.22]] },
  { x: 10.2, s: 0.68, letter: 8, g: [0.6, 4.2], eyes: [[3.22, 6.3, 0.36]] },
] as const;
/** The frieze stands this high on the wall, clear of the word before it. */
const FR_Y = 1.25;
/** The supporting words' face. */
const VOICE3D = () => F.archivo(112.5, 600);

export default class Everything extends Scene {
  private st = new Stage({
    hooks: HOOKS,
    uniforms: {
      figW: { value: new THREE.Vector4(1, 0, 0, 0) }, figA: { value: new THREE.Vector4() }, figB: { value: new THREE.Vector4() },
      figT: { value: new THREE.Vector4(0, 0, 1, 0) }, figOn: { value: 0 }, figMode: { value: 0 },
      frX: { value: new THREE.Vector4() }, frY: { value: new THREE.Vector4() }, frS: { value: new THREE.Vector4() }, frUp: { value: new THREE.Vector4() },
      frG: { value: new THREE.Vector4(1, 1, 1, 1) }, frGx: { value: new THREE.Vector4() }, frGy: { value: new THREE.Vector4() },
      frBlur: { value: new THREE.Vector4() }, frAct: { value: new THREE.Vector4() }, frLook: { value: 0 }, frEye: { value: 1 }, frTime: { value: 0 }, eyeGlow: { value: 0 },
      eyeW: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) },
    },
  });
  /** 'orch' onsets: the opening's figure notes, and the rush's. */
  private hits: number[] = [];
  private rush: number[] = [];
  private hero!: Word3D;
  private howHas!: Word3D;
  private beenTurned!: Word3D;
  private againstUs!: Word3D;
  private line!: Line;

  override async init() {
    const au = this.ctx.audio;
    this.hits = au.events('orch', 2.5, 4.5).map(([t]) => t);
    this.rush = au.events('orch', 7.8, 9.1).map(([t]) => t).slice(0, 4);
    while (this.rush.length < 4) this.rush.push(8.0 + 0.333 * this.rush.length);
    this.line = this.ctx.lyrics.get('How has everything');
    const ws = this.line.words;
    this.hero = new Word3D('EVERYTHING', F.archivo(87.5, 900), { size: 220 });
    this.howHas = new Word3D(`${ws[0]!.w} ${ws[1]!.w}`, VOICE3D(), { size: 200 });
    this.beenTurned = new Word3D(`${ws[3]!.w} ${ws[4]!.w}`, VOICE3D(), { size: 200 });
    this.againstUs = new Word3D(`${ws[5]!.w} ${ws[6]!.w}`, VOICE3D(), { size: 200 });
    // no letter casts a card shadow here: the word's shadow is the frieze
    for (const w of [this.hero, this.howHas, this.beenTurned, this.againstUs]) this.st.add(w, { shadows: false });
  }

  private w(s: string): Word {
    return this.line.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
  }

  /** The fire's light: it comes up with the opening swell, flickers, flares on the figure's notes. */
  private fire(t: number) {
    const fl = flameState(this.ctx.audio, t, 0);
    return { base: FIRE, h: 0.6, I: (0.06 + 0.94 * prog(t, 0, 1.25, ease.inOutQuad)) * fl.I * 2.4, reach: REACH };
  }

  /**
   * The opening (0 to the first word): the monsters' shadows, one per musical event, each turning into the next:
   * Polyphemus over his flock (his eye opens at the top of the swell), Circe at her cup (the man at it becomes a pig
   * on the bass note), Poseidon (the wave heaves, the trident is driven up through it on the first note of the
   * figure, the galley pitches up on the second), the wooden horse (rolls in on the third, its hatch opens on the
   * fourth and a rope ladder drops on the fifth).
   */
  private opening(t: number) {
    const h = this.hits, hit = (i: number, d: number) => h[i] ?? d;
    const m = OPEN.morph;
    const toC = prog(t, OPEN.circe - m / 2, OPEN.circe + m / 2, ease.inOutCubic);
    const toP = prog(t, OPEN.poseidon - m / 2, OPEN.poseidon + m / 2, ease.inOutCubic);
    const toH = prog(t, OPEN.horse - 0.02, OPEN.horse + m, ease.inOutCubic);
    const w = [1 - toC, toC - toP, toP - toH, toH] as const;
    const u = this.st.bg.u;
    const eye = prog(t, 0.95, 1.4, ease.outCubic);
    const pig = prog(t, 1.95, 2.45, ease.inOutCubic);
    const wave = lerp(prog(t, OPEN.poseidon - 0.05, hit(0, 3.01), ease.outCubic), 0, prog(t, OPEN.horse, OPEN.horse + 0.25, ease.inCubic));
    const thrust = prog(t, hit(0, 3.01) - 0.06, hit(0, 3.01) + 0.07, ease.outCubic);
    const tip = prog(t, hit(1, 3.34) - 0.04, hit(1, 3.34) + 0.32, ease.outBack);
    const roll = -9 * (1 - prog(t, OPEN.horse - 0.02, hit(3, 3.84), ease.outCubic));
    const h1 = prog(t, hit(3, 3.84) - 0.02, hit(3, 3.84) + 0.2, ease.outCubic);
    const h2 = prog(t, hit(4, 4.18) - 0.02, hit(4, 4.18) + 0.2, ease.outCubic);
    // placement: each figure framed on its own (x, scale), blended through the morphs; the fire's flicker sways them
    const pl = [[0, 1], [0.2, 1.18], [0.6, 1.15], [-0.2, 1.12]] as const;
    let px = 0, ps = 0;
    w.forEach((wi, i) => { px += wi * pl[i]![0]; ps += wi * pl[i]![1]; });
    (u.figW!.value as THREE.Vector4).set(...w);
    (u.figA!.value as THREE.Vector4).set(eye, pig, wave, h1);
    (u.figB!.value as THREE.Vector4).set(tip, t, roll, thrust);
    (u.figT!.value as THREE.Vector4).set(px + 0.03 * noise1(t * 5.3, 43), 0, ps * (1 + 0.006 * noise1(t * 6.1, 41)), h2);
    u.figOn!.value = 1; u.figMode!.value = 0; u.eyeGlow!.value = 0;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer } = this.ctx;
    const u = this.st.bg.u;
    const [how, has] = this.line.words as [Word, Word];
    const ev = this.w('everything'), been = this.w('been'), turned = this.w('turned'), against = this.w('against'), us = this.w('us');
    const tThrow = ev.start - 0.03;                   // the camera is thrown back as "everything" sounds
    const R = this.rush;
    // ---- the strikes, one per note of the figure, each with a little wind-up, each ending on the word: the club comes
    // down on E V, the spell and then the pig on Y, the trident on T, the soldiers at I N and on G; and when each lands
    const club = t < R[0]! - 0.04 ? -0.35 * prog(t, R[0]! - 0.24, R[0]! - 0.04, ease.outQuad)
      : t < R[0]! + 0.06 ? lerp(-0.35, 2.56, ease.inQuad(prog(t, R[0]! - 0.04, R[0]! + 0.06)))
      : 2.56 - 0.1 * Math.sin(Math.PI * prog(t, R[0]! + 0.06, R[0]! + 0.22));
    const circeAct = prog(t, R[1]! - 0.08, R[1]! + 0.32);          // (the spell lands at act 0.35, the pig at 0.6)
    const hurl = t < R[2]! - 0.05 ? -prog(t, R[2]! - 0.2, R[2]! - 0.05, ease.outQuad) : prog(t, R[2]! - 0.05, R[2]! + 0.14);
    const b0 = R[3]! - 0.2, burst = prog(t, b0, b0 + 0.53);
    const sold = SOLDIERS.map((o) => b0 + 0.53 * (o + 0.62));
    const pigLands = R[1]! + 0.16, lands = [R[0]! + 0.06, R[1]! + 0.06, pigLands, R[2]! + 0.14, sold[0]!, sold[1]!];
    /** When each of EVERYTHING's letters is struck (E V | E R Y | T H | I N G); Y twice, by the spell and the pig. */
    const hitAt = [lands[0]!, lands[0]! + 0.015, lands[1]! + 0.05, lands[1]! + 0.025, lands[1]!, lands[3]!, lands[3]! + 0.025, sold[0]!, sold[0]! + 0.02, sold[1]!];

    // ---- EVERYTHING: an arc before the wall; each letter lands on its share of the sung word, and jolts when the
    // monster above it strikes
    const wd = this.hero, n = wd.letters.length, s = CAP / wd.cap;
    const tk = (k: number) => ev.start + (k / (n - 1)) * Math.max(0.2, ev.end - ev.start - 0.12);
    for (let k = 0; k < n; k++) {
      const l = wd.letters[k]!;
      const th = ((l.penX - wd.width / 2) * s) / ARC.R;
      l.x = ARC.R * Math.sin(th); l.z = ARC.cz - ARC.R * Math.cos(th);
      const hop = (h: number) => Math.sin(Math.PI * prog(t, h, h + 0.17));
      l.y = 0.22 * (hop(hitAt[k]!) + (k === 4 ? hop(pigLands) : 0));
      l.yaw = -th; l.s = s;
      l.hinge = popHinge(t, tk(k));
      l.on = l.hinge < Math.PI / 2 - 1e-4 ? 1 : 0;
      l.mat.uniforms.glow!.value = 0.6 * pulse(t, tk(k), 0.16) * (t >= tk(k) ? 1 : 0) * l.on;
    }
    wd.update();

    // ---- the supporting words, each landing on its onset
    const sv = (w: Word3D, cap: number) => cap / w.cap;
    const hs = sv(this.howHas, 0.5), hw = this.howHas.width * hs;
    popWords(this.howHas, [how.start, has.start], t, rowAt(-hw / 2, -6.2, hs), { exit: tThrow, exitDur: 0.18 });
    // the band below the word: "been turned", then "against" with a larger, nearer "us?"
    const bs = sv(this.beenTurned, 0.5), bw = this.beenTurned.width * bs;
    // (a crisp hand-over: "been turned" is flat again just as "against" starts to spring up, no overlap)
    popWords(this.beenTurned, [been.start, turned.start], t, rowAt(-bw / 2, -0.4, bs), { exit: against.start - POP.lead - 0.135, exitDur: 0.07 });
    const ag = this.againstUs, a0 = ag.words[0]!, a1 = ag.words[1]!;
    const sa = sv(ag, 0.45), su = sv(ag, 0.95);
    popWords(ag, [against.start, us.start], t, (l) => {
      if (l.word === 0) rowAt(-2.9 - a0.x0 * sa, -0.4, sa)(l);
      else rowAt(0.2 - a1.x0 * su, 0.0, su)(l);
    }, { amb: 0.08 });

    // ---- the camera
    const pos = vkeys(t, [
      [0, [0.0, 3.6, 7.6]],
      [how.start, [0.0, 3.6, 6.4], ease.inOutQuad],
      [tThrow, [0.0, 3.4, 6.2], ease.linear],
      [tThrow + 0.9, [0.0, 3.0, 11.3], ease.outExpo],
      [turned.start, [0.1, 3.0, 11.0], ease.linear],
      [us.start, [0.0, 2.95, 10.6], ease.inOutCubic],
      [this.ctx.end, [0.0, 2.9, 10.2], ease.linear],
    ]);
    const at = vkeys(t, [
      [0, [0.0, 4.2, WALL_Z]],
      [how.start - 0.1, [0.0, 4.2, WALL_Z], ease.linear],
      [how.start + 0.3, [0.0, 3.1, WALL_Z], ease.inOutCubic],
      [tThrow, [0.0, 3.1, WALL_Z], ease.linear],
      [tThrow + 0.9, [0.0, 3.3, WALL_Z], ease.outExpo],
      [this.ctx.end, [0.0, 3.2, WALL_Z], ease.linear],
    ]);
    // a jolt as each strike lands
    const jolt = lands.reduce((a, r) => a + pulse(t, r, 0.08), 0);
    pos.x += 0.05 * jolt * noise1(t * 40, 3); pos.y += 0.05 * jolt * noise1(t * 40, 5);
    this.st.cam.set(pos, at, 40);

    if (t < how.start) {
      this.opening(t);
    } else {
      // ---- the frieze: the horse moves to its place as the camera is thrown back; the others unfold with their letters
      const toSlot = prog(t, tThrow, tThrow + 0.9, ease.outExpo);
      const look = prog(t, turned.start + 0.02, turned.start + 0.22, ease.outBack);
      const v = (k: 'frX' | 'frY' | 'frS' | 'frUp' | 'frG' | 'frGx' | 'frGy' | 'frBlur') => u[k]!.value as THREE.Vector4;
      const eyes = u.eyeW!.value as THREE.Vector4[];
      let ei = 0;
      FRIEZE.forEach((m, i) => {
        let x: number = m.x, y = FR_Y, sc: number = m.s, up = Math.cos(popHinge(t, tk(m.letter)));
        if (i === 3) { x = lerp(-0.2, m.x, toSlot); y = FR_Y * toSlot; sc = lerp(1.12, m.s, toSlot); up = 1; }
        v('frX').setComponent(i, x); v('frY').setComponent(i, y); v('frS').setComponent(i, sc); v('frUp').setComponent(i, up);
        v('frG').setComponent(i, 1); v('frGx').setComponent(i, x + sc * m.g[0]); v('frGy').setComponent(i, y + sc * m.g[1]);
        v('frBlur').setComponent(i, 0.015);
        m.eyes.forEach((e, j) => {
          const [ex, ey] = i === 1 && j === 1 ? pigEye(e[0], e[1], circeAct) : [e[0], e[1]];   // the pig's eye goes with it as it leaps
          eyes[ei++]!.set(x + sc * ex, y + sc * ey, sc * e[2] * 1.6, up > 0.5 ? 1 : 0);
        });
      });
      (u.frAct!.value as THREE.Vector4).set(club, circeAct, hurl, burst);
      u.frLook!.value = look; u.frEye!.value = lerp(0.14, 1, look); u.frTime!.value = t;
      u.eyeGlow!.value = look * (0.35 + 1.1 * pulse(t, turned.start + 0.05, 0.25));
      u.figOn!.value = 1; u.figMode!.value = 1;
    }

    // on the last hit the fire gutters into the cut
    const L = this.fire(t);
    L.I *= 1 - 0.85 * prog(t, this.ctx.end - 0.2, this.ctx.end - 0.03, ease.inQuad);
    // the glaze mirrors the wall only: here the word's dark double is its shadow
    this.st.render(renderer, out, t, L, { wall: 1, wallZ: WALL_Z }, { noFlame: true, cards: false, reflect: false, rim: 0.6, spec: 0.05 });
    return { bloom: 0.55, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3, shake: [0, 0.003 * jolt] };
  }
}

/** Circe's pig's eye (figure-local, (ex, ey) as it stands at the cup) once she acts: circe() in figures.ts crouches
 *  the pig, hops it and dives it onto the word, turning it by `pr` about its middle (at rest 3.05, 1.275). */
function pigEye(ex: number, ey: number, act: number): [number, number] {
  const sat = (x: number) => Math.min(1, Math.max(0, x));
  const cr = sat((act - 0.1) / 0.15), f = sat((act - 0.25) / 0.35);
  const pr = -0.15 * cr * (1 - f) + 0.5 * f * f - 0.3 * f * (1 - f);
  const px = 3.05 + 0.12 * cr * (1 - f) - 0.3 * f, py = 1.275 - 0.615 * f + 3.2 * f * (1 - f);
  const vx = ex - 3.05, vy = ey - 1.275, c = Math.cos(pr), s = Math.sin(pr);
  return [px + c * vx - s * vy, py + s * vx + c * vy];
}

/** The soldiers' starts in the horse's burst (0..1); each lands 0.62 later (trojanHorse() in figures.ts). */
const SOLDIERS = [0, 0.05, 0.3, 0.5];

/** Letters in a row standing on the floor at z0, facing the camera (+z), from x0. */
function rowAt(x0: number, z0: number, s: number) {
  return (l: { x: number; z: number; y: number; yaw: number; s: number; penX: number }) => {
    l.x = x0 + l.penX * s; l.z = z0; l.y = 0; l.yaw = 0; l.s = s;
  };
}
