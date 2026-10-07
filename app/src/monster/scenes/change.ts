// `change` — verse 1, line 4: "Do I need to change?" and the bar of strings after it (docs/MONSTER.md, revision 1).
// The shadow play proper, lit by the fire behind us (never seen): CHANGE? stands in a row before the clay wall, its
// shadow on it. From the downbeat after the word, on every eighth note one letter snaps round and comes back
// black-glazed, and each one throws a bigger shadow than the last. Then, on the notes of the rising figure, the
// shadow becomes the four monsters of verse 2, one by one: Polyphemus, Circe, Poseidon, the horse.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, prog, pulse } from '../../engine/util';
import { flameState } from '../motifs';
import { GLSL_FIGURES } from '../figures';
import { Stage, Word3D, popHinge, popWords, row, vkeys } from '../stage';

const CAP = 1.15, ROW_Z = -2.3, WALL_Z = -6.2;
/** The fire behind us (world). */
const FIRE = new THREE.Vector3(7.0, 1.7, 10.5);
/** The letters (by index in CHANGE?) whose shadow each monster takes, and its natural height and centre (figure units). */
const GROUPS = [
  { letters: [0, 1], h: 9.2, cx: 0.0 },
  { letters: [2, 3], h: 6.6, cx: -0.1 },
  { letters: [4, 5], h: 8.1, cx: 0.75 },
  { letters: [6], h: 7.3, cx: 0.3 },
] as const;

const HOOKS = GLSL_FIGURES + /* glsl */ `
uniform vec4 mX, mY, mS, mOn;                       // each monster: feet on the wall (x, y), scale, shown (0..1)
uniform float mT;
float monster(int i, vec2 q) {
  if (i == 0) return polyphemus(q, 1.0, mT);
  if (i == 1) return circe(q, 1.0, 0.0);
  if (i == 2) return max(poseidon(q, 1.0, 1.0, 0.6, 0.0), abs(q.x - 0.75) - 2.65);
  return trojanHorse(q, 1.0, 1.0, 0.0, 0.0);
}
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) {
  if (!wall) return 0.0;
  float lit = 1.0;
  for (int i = 0; i < 4; i++) {
    float on = mOn[i];
    if (on <= 0.001) continue;
    float s = mS[i] * (0.55 + 0.45 * on);
    vec2 q = (P.xy - vec2(mX[i], mY[i])) / s;
    if (abs(q.x) > 8.0 || q.y > 10.5 || q.y < -1.0) continue;
    float d = monster(i, q) * s;
    float w = max(gPix * 0.75, 0.012);
    lit *= mix(1.0, smoothstep(-w, w, d), sat(on * 3.0));
  }
  return 1.0 - lit;
}
vec3 skyTint(vec3 D, vec3 col) { return col; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return col; }`;

export default class Change extends Scene {
  private st = new Stage({
    hooks: HOOKS,
    uniforms: { mX: { value: new THREE.Vector4() }, mY: { value: new THREE.Vector4() }, mS: { value: new THREE.Vector4(1, 1, 1, 1) }, mOn: { value: new THREE.Vector4() }, mT: { value: 0 } },
  });
  private word!: Word3D;
  private ask!: Word3D;
  private line!: Line;
  /** The figure's notes after the flips: one monster each. */
  private notes: number[] = [];

  override async init() {
    this.word = new Word3D('CHANGE?', F.archivo(100, 900), { size: 220 });
    this.st.add(this.word);
    this.line = this.ctx.lyrics.get('Do I need to change');
    this.ask = new Word3D(this.line.words.slice(0, 4).map((w) => w.w).join(' '), F.archivo(112.5, 600), { size: 200 });
    this.st.add(this.ask);
    this.notes = this.ctx.audio.events('orch', 23.8, 25.1).map(([t]) => t).slice(0, 4);
    while (this.notes.length < 4) this.notes.push(24.01 + 0.333 * this.notes.length);
  }

  /** Where the shadow of a point falls on the wall (the ray from the fire through it). */
  private onWall(p: THREE.Vector3, L: THREE.Vector3) {
    const k = (WALL_Z - L.z) / (p.z - L.z);
    return { x: L.x + (p.x - L.x) * k, y: L.y + (p.y - L.y) * k };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const [doW, iW, need, to, change] = this.line.words as [Word, Word, Word, Word, Word];
    const T0 = this.ctx.start, T1 = this.ctx.end;
    // the flips: one letter per eighth note from the first beat after the word has stood up (the 21.36 downbeat)
    const wd = this.word, n = wd.letters.length, s = CAP / wd.cap;
    const tPop = (k: number) => change.start + (k / (n - 1)) * Math.min(0.42, change.end - change.start);
    const b0 = Math.ceil(audio.beatAt(tPop(n - 1)) - 0.05);
    const flipAt = (k: number) => audio.timeOfBeat(b0 + k * 0.5);

    // ---- the word: a straight row, folding up fast as it is sung; then each letter snaps round, black-glazed,
    // and throws a bigger shadow
    for (let k = 0; k < n; k++) {
      const l = wd.letters[k]!;
      l.x = (l.penX - wd.width / 2) * s; l.z = ROW_Z; l.y = 0; l.s = s;
      const tk = tPop(k);
      l.hinge = popHinge(t, tk);
      l.on = l.hinge < Math.PI / 2 - 1e-4 ? 1 : 0;
      const tf = flipAt(k), spin = prog(t, tf - 0.02, tf + 0.2, ease.outCubic);
      l.yaw = 2 * Math.PI * spin;
      l.mat.uniforms.glaze!.value = spin > 0.5 ? 1 : 0;
      l.shadowS = 1 + (0.8 + 0.2 * k) * ease.outBack(prog(t, tf + 0.04, tf + 0.3));
      l.mat.uniforms.glow!.value = 0.45 * pulse(t, tk, 0.16) * (t >= tk ? 1 : 0) * l.on + 0.35 * pulse(t, tf + 0.1, 0.1) * (t >= tf + 0.1 ? 1 : 0);
    }
    // "Do I need to": standing where CHANGE? will stand, just behind its row; it falls back as CHANGE? rises
    const as = 0.62 / this.ask.cap;
    popWords(this.ask, [doW.start, iW.start, need.start, to.start], t, row(-(this.ask.width * as) / 2, ROW_Z - 0.7, 0, as), { exit: change.start - 0.02, exitDur: 0.2 });

    // ---- the fire: it breathes, flares on the figure's notes
    const fl = flameState(audio, t, 9);
    const L = { base: FIRE, h: 0.8, I: fl.I * 2.3, reach: 40 };
    const Lc = this.st.lightCentre(L).clone();

    // ---- the shadow becomes the monsters, one per note: each takes its letters' shadow and grows out of it
    const u = this.st.bg.u;
    // the monsters stand as one frieze, all of a height: half as tall again as the word's shadow at its tallest
    let hF = 0;
    for (const l of wd.letters) hF = Math.max(hF, this.onWall(new THREE.Vector3(l.x, CAP * (l.shadowS ?? 1), l.z), Lc).y);
    hF *= 1.25;
    GROUPS.forEach((g, i) => {
      const tn = this.notes[i]!;
      const on = ease.outBack(prog(t, tn - 0.02, tn + 0.18));
      let x0 = Infinity, x1 = -Infinity;
      for (const k of g.letters) {
        const l = wd.letters[k]!, ss = l.shadowS ?? 1, half = 0.5 * (l.box[2] - l.box[0]) * s * ss;
        const a = this.onWall(new THREE.Vector3(l.x - half, 0, l.z), Lc), b = this.onWall(new THREE.Vector3(l.x + half, CAP * ss, l.z), Lc);
        x0 = Math.min(x0, a.x); x1 = Math.max(x1, b.x);
        l.castShadow = t < tn - 0.01;
      }
      // as tall again as the shadow it takes, standing on the floor line
      const sc = hF / g.h;
      const cx = (x0 + x1) / 2, mid = this.onWall(new THREE.Vector3(0, 0, ROW_Z), Lc).x;
      (u.mX!.value as THREE.Vector4).setComponent(i, mid + (cx - mid) * 1.6 - g.cx * sc);
      (u.mY!.value as THREE.Vector4).setComponent(i, 0);
      (u.mS!.value as THREE.Vector4).setComponent(i, sc);
      (u.mOn!.value as THREE.Vector4).setComponent(i, t >= tn - 0.02 ? Math.max(on, 0.001) : 0);
    });
    u.mT!.value = t;
    wd.update();

    // ---- the camera: a three-quarter view of word and wall, drawing back as the shadow grows, pushing in at the end
    const bEnd = audio.beatAt(flipAt(n - 1));
    const pos = vkeys(t, [[T0, [3.4, 1.5, 6.6]], [change.start, [2.7, 0.85, 6.2], ease.outCubic], [flipAt(0), [2.6, 0.9, 6.3], ease.linear],
      [audio.timeOfBeat(bEnd + 0.5), [2.4, 1.1, 7.6], ease.inOutCubic], [this.notes[0]!, [2.3, 1.1, 7.8], ease.linear], [T1, [2.1, 1.05, 7.9], ease.inOutCubic]]);
    const at = vkeys(t, [[T0, [0.0, 1.6, -3.5]], [change.start, [0.0, 2.2, -4.5], ease.outCubic], [flipAt(0), [-0.3, 2.3, -4.6], ease.linear],
      [audio.timeOfBeat(bEnd + 0.5), [-0.9, 2.6, -5.0], ease.inOutCubic], [T1, [-1.0, 2.7, -5.2], ease.linear]]);
    const kick = this.notes.reduce((a, tn) => a + pulse(t, tn, 0.08), 0);
    pos.y += 0.02 * kick;
    this.st.cam.set(pos, at, 42);

    this.st.render(renderer, out, t, L, { wall: 1, wallZ: WALL_Z }, { noFlame: true, rim: 0.8, spec: 0.05 });
    return { bloom: 0.55, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3, shake: [0, 0.004 * kick] };
  }
}
