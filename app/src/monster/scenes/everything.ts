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
import { ease, hash, lerp, prog, pulse } from '../../engine/util';
import { LineBatch } from '../../engine/lines';
import { sparkParticles } from '../../scenes/_motifs';
import { flameState } from '../motifs';
import { Stage, Word3D, popHinge, popWords, row, vkeys } from '../stage';

/** The warrior's shadow on the wall (cast by the striker, never seen), in units of its height; m: 0 a man, 1 a monster. */
const WARRIOR_HOOKS = /* glsl */ `
uniform float warOn, warH, warM, warX, wallZ0;
float warrior(vec2 q, float m) {
  float hunch = 0.16 * m;
  vec2 hc = vec2(0.03 + 0.15 * m, 0.885 - hunch);                                  // head, thrust forward and down
  float d = length((q - hc) * vec2(1.0, 0.9)) - 0.062;
  // the helmet's crest: a fan over the head, back to front; with m its edge breaks into spikes
  vec2 cq = q - (hc + vec2(-0.015, 0.03));
  float ca = atan(cq.x, cq.y);
  // spines: five, long, raking back
  float spikes = m * 0.12 * pow(max(0.0, sin(ca * 6.0 - 0.6 + 0.8 * m)), 3.0) * smoothstep(-1.2, 0.6, ca);
  float crest = max(length(cq * vec2(0.85, 1.0)) - (0.115 + spikes), -cq.y + 0.005);
  d = min(d, max(crest, abs(cq.x) - 0.14));
  d = smin(d, sdSegment(q, vec2(0.0, 0.8 - hunch), hc) - 0.03, 0.02);              // neck
  float sh = 0.12 + 0.07 * m;
  d = smin(d, sdSegment(q, vec2(-sh, 0.79 - hunch * 0.3), vec2(sh, 0.8 - hunch * 0.5)) - (0.045 + 0.02 * m), 0.04);
  d = smin(d, sdSegment(q, vec2(0.0, 0.5), vec2(0.0, 0.78 - hunch)) - (0.085 + 0.035 * m), 0.05);   // torso, cuirass
  d = smin(d, max(abs(q.x) - (0.1 + 0.03 * m), abs(q.y - 0.47) - 0.06), 0.03);      // kilt
  d = smin(d, sdSegment(q, vec2(-0.045, 0.45), vec2(-0.09 - 0.03 * m, 0.02)) - 0.038, 0.03);
  d = smin(d, sdSegment(q, vec2(0.045, 0.45), vec2(0.1 + 0.03 * m, 0.02)) - 0.038, 0.03);
  // the shield on the left arm
  d = min(d, length(q - vec2(-sh - 0.06, 0.6)) - (0.14 + 0.02 * m));
  // the spear arm: the hand drops and the forearm stretches with m; fingers become claws
  vec2 hand = vec2(sh + 0.07 + 0.06 * m, 0.6 - 0.28 * m);
  d = smin(d, sdSegment(q, vec2(sh, 0.79 - hunch * 0.5), hand) - 0.03, 0.03);
  for (int i = 0; i < 3; i++) {
    float a = -0.5 + 0.5 * float(i);
    d = min(d, sdSegment(q, hand, hand + m * 0.13 * vec2(sin(a) + 0.3, -cos(a))) - 0.014 * m);
  }
  // the spear: upright in the hand, longer with m, a leaf blade at the top
  float top = 1.3 + 0.35 * m;
  d = min(d, sdSegment(q, vec2(hand.x + 0.01, 0.02), vec2(hand.x + 0.02, top)) - 0.012);
  vec2 bq = q - vec2(hand.x + 0.02, top + 0.06);
  d = min(d, max(abs(bq.x) * 2.2 + abs(bq.y) - 0.11, 0.0) - 0.0);
  return d;
}
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) {
  if (!wall || warOn <= 0.0) return 0.0;
  vec2 q = vec2(P.x - warX, P.y) / warH;
  if (abs(q.x) > 0.6 || q.y > 1.6) return 0.0;
  float d = warrior(q, warM) * warH;
  return warOn * (1.0 - smoothstep(-0.03, 0.05, d));
}
vec3 skyTint(vec3 D, vec3 col) { return col; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return col; }`;

/** The word stands on a shallow arc (centre z, radius) facing the camera; cap height; the wall; the flame's height. */
const ARC = { cz: 4.5, R: 11 }, CAP = 1.75, WALL_Z = -10.6, FLAME_H = 0.78;
/** Where the flame lands behind the word. */
const BEHIND = new THREE.Vector3(0, 0, -8.7);
/** The supporting words' face. */
const VOICE3D = () => F.archivo(112.5, 600);

export default class Everything extends Scene {
  private st = new Stage({ hooks: WARRIOR_HOOKS, uniforms: { warOn: { value: 0 }, warH: { value: 3 }, warM: { value: 0 }, warX: { value: 0 }, wallZ0: { value: WALL_Z } } });
  private sparks = new LineBatch(20000);
  /** The flint's strikes (the bass note, then the rising figure's notes) and the strike that catches. */
  private strikes: number[] = [];
  private tCatch = 3.84;
  private hero!: Word3D;
  private howHas!: Word3D;
  private beenTurned!: Word3D;
  private againstUs!: Word3D;
  private line!: Line;

  override async init() {
    const au = this.ctx.audio;
    const hits = au.events('orch', 2.5, 4.1).map(([t]) => t);
    const pre = [au.timeOfBeat(3), ...hits.filter((t) => t < 3.75)].filter((t, i, a) => i === 0 || t - a[i - 1]! > 0.12);
    this.tCatch = hits.find((t) => t >= 3.75) ?? 3.84;
    this.strikes = [...pre, this.tCatch];
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

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const [how, has] = this.line.words as [Word, Word];
    const ev = this.w('everything'), been = this.w('been'), turned = this.w('turned'), against = this.w('against'), us = this.w('us');
    const tThrow = ev.start - 0.03;                   // the camera is thrown back as "everything" sounds
    const tLand = us.start;                           // the flame lands behind the word on "us?"

    // ---- the opening: flint strikes in the dark, each lighting the cave for an instant; the last one catches
    const tc = this.tCatch;
    let flash = 0, si = -1;
    this.strikes.forEach((ts, i) => {
      if (t >= ts) { const p = Math.pow(0.5, (t - ts) / (i === this.strikes.length - 1 ? 0.18 : 0.085)); if (p > flash) flash = p; si = i; }
    });
    const born = prog(t, tc, tc + 0.35, ease.outCubic);
    // the shadow on the wall: one per strike before the catch, larger and less a man each time
    const ns = this.strikes.length - 1;
    const wu = this.st.bg.u;
    const k = Math.max(0, Math.min(si, ns - 1));
    wu.warOn!.value = si >= 0 && si < ns ? 1 : 0;
    wu.warH!.value = 4.4 + 1.1 * k;
    wu.warM!.value = ns > 1 ? k / (ns - 1) : 1;
    wu.warX!.value = -0.6 + 0.35 * k;

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
    const stepIn = this.strikes.slice(0, -1).reduce((a, ts) => a + 0.45 * prog(t, ts, ts + 0.3, ease.outExpo), 0);
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

    // the flint's sparks, drawn over the frame at the strike point
    const lb = this.sparks;
    lb.clear();
    const flint = this.st.cam.project({ x: 0.05, y: 0.08, z: 0.2 });
    this.strikes.forEach((ts, i) => {
      if (t < ts || t > ts + 0.7) return;
      const head = (tb: number) => (tb >= ts && tb < ts + 0.05 ? { x: flint.x + (hash(i, 3) - 0.5) * 8, y: flint.y } : null);
      sparkParticles(lb, t, head, { rate: 1100, life: 0.55, speed: 520 + 140 * hash(i, 5), gravity: 1100, intensity: 1.3, seed: 17 + i * 13 });
    });
    lb.render(renderer, out);

    return { bloom: lerp(0.75, 0.45, close), bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35, shake: [0, 0.004 * land] };
  }
}
