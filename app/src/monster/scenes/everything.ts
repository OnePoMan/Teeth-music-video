// `everything` — the opening and verse 1, line 1: "How has everything been turned against us?" (docs/MONSTER.md).
// Black. A flint strikes on the low bass note and on each note of the rising figure: each spark lights the cave for
// an instant, and in each flash a man's shadow stands on the wall, a warrior with a crested helmet and a spear, cast
// by whoever strikes; with every strike it is bigger and less a man (hunched, the crest gone to spikes, the arm
// too long). The last strike catches: the flame steadies, the wall is empty, and the camera is already close on it.
// Every word is a thing in the room and lands on its sung onset. Close on the flame: "How has" pops up behind it.
// On "everything" the camera is thrown back and the word folds up out of the cave floor letter by letter, stone,
// standing in an arc, its shadow on the wall. "been turned" stands in front of it, and on "turned" each letter turns
// its back. The flame leaps over the word and lands behind it on "us?": the letters go black against a burning wall,
// "against us?" stands up near the camera, and every shadow runs at us.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, noise1, prog, pulse } from '../../engine/util';
import { flameState } from '../motifs';
import { GLSL_FIGURES } from '../figures';
import { Stage, Word3D, popHinge, popWords, row, vkeys } from '../stage';

/** The opening's shadow theatre on the clay wall (src/monster/figures.ts): the four monsters, one per musical event,
 *  morphing into each other (weights figW), with their animation (figA, figB) and placement (figT). */
const HOOKS = GLSL_FIGURES + /* glsl */ `
uniform vec4 figW, figA, figB, figT;
uniform float figOn;
float monsters(vec2 p) {
  vec2 q = (p - figT.xy) / figT.z;
  if (abs(q.x) > 13.0 || q.y > 10.5 || q.y < -1.0) return 1e3;
  float d = 0.0;
  if (figW.x > 0.001) d += figW.x * polyphemus(q, figA.x, figB.y);
  if (figW.y > 0.001) d += figW.y * circe(q, figA.y);
  if (figW.z > 0.001) d += figW.z * poseidon(q, figA.z, figB.w, figB.x);
  if (figW.w > 0.001) d += figW.w * trojanHorse(q - vec2(figB.z, 0.0), figA.w, figT.w, figB.z);
  return d / max(dot(figW, vec4(1.0)), 1e-3) * figT.z;
}
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) {
  if (!wall || figOn <= 0.0) return 0.0;
  float w = max(gPix * 0.75, 0.01);
  return figOn * (1.0 - smoothstep(-w, w, monsters(P.xy)));
}
vec3 skyTint(vec3 D, vec3 col) { return col; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return col; }`;

/** The opening's events: Polyphemus on the swell, Circe on the bass note, Poseidon on the rising figure, the horse
 *  on its last notes (audio.json: bass 1.75-2.75, 'orch' 3.01, 3.34, 3.67, 3.84, 4.18). */
const OPEN = { circe: 1.7, poseidon: 2.7, horse: 3.67, morph: 0.16 };

/** The word stands on a shallow arc (centre z, radius) facing the camera; cap height; the wall; the flame's height. */
const ARC = { cz: 4.5, R: 11 }, CAP = 1.75, WALL_Z = -10.6, FLAME_H = 0.78;
/** Where the flame lands behind the word. */
const BEHIND = new THREE.Vector3(0, 0, -8.7);
/** The supporting words' face. */
const VOICE3D = () => F.archivo(112.5, 600);

export default class Everything extends Scene {
  private st = new Stage({
    hooks: HOOKS,
    uniforms: {
      figW: { value: new THREE.Vector4(1, 0, 0, 0) }, figA: { value: new THREE.Vector4() }, figB: { value: new THREE.Vector4() },
      figT: { value: new THREE.Vector4(0, 0, 1, 0) }, figOn: { value: 0 },
    },
  });
  /** The rising figure's notes ('orch' onsets), for the opening's events. */
  private hits: number[] = [];
  private tCatch = 3.84;
  private hero!: Word3D;
  private howHas!: Word3D;
  private beenTurned!: Word3D;
  private againstUs!: Word3D;
  private line!: Line;

  override async init() {
    this.hits = this.ctx.audio.events('orch', 2.5, 4.5).map(([t]) => t);
    this.tCatch = this.hits.find((t) => t >= 3.75) ?? 3.84;
    this.line = this.ctx.lyrics.get('How has everything');
    const ws = this.line.words;
    this.hero = new Word3D('EVERYTHING', F.archivo(87.5, 900), { size: 220 });
    this.howHas = new Word3D(`${ws[0]!.w} ${ws[1]!.w}`, VOICE3D(), { size: 200 });
    this.beenTurned = new Word3D(`${ws[3]!.w} ${ws[4]!.w}`, VOICE3D(), { size: 200 });
    this.againstUs = new Word3D(`${ws[5]!.w} ${ws[6]!.w}`, VOICE3D(), { size: 200 });
    for (const w of [this.hero, this.howHas, this.beenTurned, this.againstUs]) this.st.add(w);
  }

  private w(s: string): Word {
    return this.line.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
  }

  /**
   * The opening (0 to the first word): a fire behind us lights the clay wall of the cave and throws the monsters'
   * shadows on it, one per musical event, each turning into the next: Polyphemus over his flock (his eye opens at
   * the top of the swell), Circe at her cup (the man at it becomes a pig on the bass note), Poseidon (the wave
   * heaves, the trident is driven up through it on the first note of the figure, the galley pitches up on the
   * second), the wooden horse (rolls in on the third, its hatches open on the fourth and fifth).
   */
  private opening(t: number, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio } = this.ctx;
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
    // the horse rolls in from the left and stops on the fourth note; its hatches open on the fourth and fifth
    const roll = -9 * (1 - prog(t, OPEN.horse - 0.02, hit(3, 3.84), ease.outCubic));
    const h1 = prog(t, hit(3, 3.84) - 0.02, hit(3, 3.84) + 0.2, ease.outCubic);
    const h2 = prog(t, hit(4, 4.18) - 0.02, hit(4, 4.18) + 0.2, ease.outCubic);
    // placement: each figure framed on its own (x, scale), blended through the morphs; the fire's flicker sways them
    const fl = flameState(audio, t, 0);
    const pl = [[0, 1], [0.2, 1.18], [0.2, 1.0], [-0.2, 1.12]] as const;
    let px = 0, ps = 0;
    w.forEach((wi, i) => { px += wi * pl[i]![0]; ps += wi * pl[i]![1]; });
    const sway = 1 + 0.006 * noise1(t * 6.1, 41);
    (u.figW!.value as THREE.Vector4).set(...w);
    (u.figA!.value as THREE.Vector4).set(eye, pig, wave, h1);
    (u.figB!.value as THREE.Vector4).set(tip, t, roll, thrust);
    (u.figT!.value as THREE.Vector4).set(px + 0.03 * noise1(t * 5.3, 43), 0, ps * sway, h2);
    u.figOn!.value = 1;
    // the camera faces the wall, drifting in
    const pos = new THREE.Vector3(0, 3.6, lerp(7.6, 6.4, prog(t, 0, this.line.words[0]!.start, ease.inOutQuad)));
    this.st.cam.set(pos, new THREE.Vector3(0, 4.2, WALL_Z), 40);
    // the fire: behind us, over the right shoulder; it comes up with the swell and flares on the figure's notes
    const up = prog(t, 0, 1.25, ease.inOutQuad);
    const Lc = new THREE.Vector3(pos.x + 2.4, pos.y + 2.4, pos.z + 3.2);
    for (const wd of this.st.words) { for (const l of wd.letters) l.on = 0; wd.update(); }
    this.st.render(renderer, out, t, { base: Lc, h: 0.6, I: (0.06 + 0.94 * up) * fl.I * 1.9, reach: 40 }, { wall: 1, wallZ: WALL_Z },
      { noFlame: true, cards: false, reflect: false });
    return { bloom: 0.5, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3 };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const [how, has] = this.line.words as [Word, Word];
    const ev = this.w('everything'), been = this.w('been'), turned = this.w('turned'), against = this.w('against'), us = this.w('us');
    const tThrow = ev.start - 0.03;                   // the camera is thrown back as "everything" sounds
    const tLand = us.start;                           // the flame lands behind the word on "us?"

    // ---- the opening: the monsters' shadows on the clay wall, until the first word
    if (t < how.start) return this.opening(t, out);
    const tc = this.tCatch, born = 1, flash = 0;
    this.st.bg.u.figOn!.value = 0;

    // ---- the flame: at home, then a leap over the word (a parabola in the vertical plane), landing behind it
    const fl = flameState(audio, t, 0);
    const leap = prog(t, turned.start + 0.02, tLand, ease.inOutCubic);
    const P0 = new THREE.Vector3(0, 0, 0), P1 = new THREE.Vector3(0, 7.4, -6.0);
    const fb = new THREE.Vector3()
      .addScaledVector(P0, (1 - leap) * (1 - leap)).addScaledVector(P1, 2 * leap * (1 - leap)).addScaledVector(BEHIND, leap * leap);
    const settle = prog(t, tLand, this.ctx.end, ease.inOutQuad);
    const land = pulse(t, tLand, 0.16) * (t >= tLand ? 1 : 0);
    const flH = FLAME_H * fl.h * (1 + 0.35 * land) * (1 - 0.18 * settle) * (1 + 0.25 * Math.sin(Math.PI * leap)) * lerp(0.2, 1, born);
    // before the catch the only light is the strikes'
    const LI = t < tc ? 2.4 * flash : fl.I * (1 + 0.8 * land) * (1 - 0.25 * settle) * (1 + 1.4 * flash * (1 - born));

    // ---- EVERYTHING: an arc about the flame's home; each letter lands on its share of the sung word
    const wd = this.hero, n = wd.letters.length, s = CAP / wd.cap;
    for (let k = 0; k < n; k++) {
      const l = wd.letters[k]!;
      const th = ((l.penX - wd.width / 2) * s) / ARC.R;
      l.x = ARC.R * Math.sin(th); l.z = ARC.cz - ARC.R * Math.cos(th); l.y = 0;
      l.yaw = -th; l.s = s;
      const tk = ev.start + (k / (n - 1)) * Math.max(0.2, ev.end - ev.start - 0.12);
      l.hinge = popHinge(t, tk);
      l.on = l.hinge < Math.PI / 2 - 1e-4 ? 1 : 0;
      l.mat.uniforms.glow!.value = 0.6 * pulse(t, tk, 0.16) * (t >= tk ? 1 : 0) * l.on;
    }
    wd.update();

    // ---- the supporting words, each landing on its onset
    const sv = (w: Word3D, cap: number) => cap / w.cap;
    const hs = sv(this.howHas, 0.21);
    popWords(this.howHas, [how.start, has.start], t, row(-1.62, -0.75, 0, hs), { exit: tThrow, exitDur: 0.18 });
    const bs = sv(this.beenTurned, 0.75), bw = this.beenTurned.width * bs;
    popWords(this.beenTurned, [been.start, turned.start], t, (l) => {
      row(-bw / 2, -1.2, 0, bs)(l);
      // "turned": each letter turns its back, a beat after it lands
      if (l.word === 1) l.yaw = Math.PI * prog(t, turned.start + 0.08, turned.start + 0.45, ease.inOutCubic);
    }, { exit: against.start - 0.02 });
    const as = sv(this.againstUs, 0.5), aw = this.againstUs.width * as;
    popWords(this.againstUs, [against.start, us.start], t, row(-aw / 2, 4.0, 0, as), { amb: 0.07 * settle });

    // ---- the camera: close on the flame; thrown back on the word; drifts in as the shadows come
    // in the dark the camera stands back to see the wall, stepping in on every strike; on the catch it rushes in
    const stepIn = 0;
    const pos = vkeys(t, [
      [0, [0.0, 1.9, 5.6 - stepIn]],
      [tc, [0.0, 1.8, 5.6 - stepIn], ease.linear],
      [tc + 0.5, [0.0, 1.25, 3.6], ease.outExpo],
      [tThrow, [0.0, 1.15, 3.2], ease.linear],
      [tThrow + 1.1, [0.0, 2.6, 12.4], ease.outExpo],
      [turned.start, [0.12, 2.5, 12.0], ease.linear],
      [tLand, [0.0, 1.35, 11.2], ease.inOutCubic],
      [this.ctx.end, [0.0, 1.05, 10.2], ease.linear],
    ]);
    const at = vkeys(t, [
      [0, [0.0, 3.2, -6.0]],
      [tc, [0.0, 3.1, -6.0], ease.linear],
      [tc + 0.5, [0.0, 0.32, 0.0], ease.outExpo],
      [tThrow, [0.0, 0.32, 0.0], ease.linear],
      [tThrow + 1.1, [0.0, 1.7, -5.5], ease.outExpo],
      [turned.start, [0.0, 1.75, -5.6], ease.linear],
      [tLand, [0.0, 1.55, -6.5], ease.inOutCubic],
      [this.ctx.end, [0.0, 1.45, -6.5], ease.linear],
    ]);
    const fov = t < tc + 0.5 ? lerp(42, 34, prog(t, tc, tc + 0.5, ease.outExpo)) : lerp(34, 38, prog(t, tThrow, tThrow + 1.1, ease.outExpo));
    this.st.cam.set(pos, at, fov);

    const behind = fb.z < -6.0 && fb.y < CAP * 1.1;
    const close = 1 - prog(t, tThrow - 0.05, tThrow + 0.5);
    // the catch lights the whole cave (the wall now empty), then the light draws in to the flame's own pool
    const pool = t < tc ? 16 : lerp(16, 4.5, prog(t, tc + 0.05, tc + 0.6, ease.inOutCubic));
    const reach = t < tThrow - 0.1 ? pool : lerp(lerp(4.5, 16, prog(t, tThrow - 0.1, tThrow + 0.9, ease.inOutQuad)), 30, prog(t, tLand - 0.4, tLand + 0.2, ease.inOutQuad));
    this.st.render(renderer, out, t, { base: fb, h: flH, I: LI * 1.15, reach }, { wall: 1, wallZ: WALL_Z, freqFloor: 6.5, freqWall: 4.2, toneWall: 1 },
      // the walls are shadow screens: plaster in one lit tone; the floor stays engraved
      { flameBehind: behind, noFlame: born <= 0, flameI: lerp(1, 0.5, close) * lerp(1.8, 1, born), gust: fl.gust * 0.6 - 0.8 * Math.cos(Math.PI * leap) * prog(t, turned.start, tLand) * (1 - prog(t, tLand - 0.2, tLand)), rim: 1.2 });

    return { bloom: lerp(0.75, 0.45, close), bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35, shake: [0, 0.004 * land] };
  }
}
