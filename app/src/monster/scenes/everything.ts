// `everything` — verse 1, line 1: "How has everything been turned against us?" (docs/MONSTER.md, revision 1).
// Every word is a thing in the room and lands on its sung onset. Close on the flame: "How has" pops up behind it.
// On "everything" the camera is thrown back and the word folds up out of the cave floor letter by letter, stone,
// standing in an arc, its shadow on the wall. "been turned" stands in front of it, and on "turned" each letter turns
// its back. The flame leaps over the word and lands behind it on "us?": the letters go black against a burning wall,
// "against us?" stands up near the camera, and every shadow runs at us.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, prog, pulse } from '../../engine/util';
import { flameState } from '../motifs';
import { Stage, Word3D, popHinge, popWords, row, vkeys } from '../stage';

/** The word stands on a shallow arc (centre z, radius) facing the camera; cap height; the wall; the flame's height. */
const ARC = { cz: 4.5, R: 11 }, CAP = 1.75, WALL_Z = -10.6, FLAME_H = 0.78;
/** Where the flame lands behind the word. */
const BEHIND = new THREE.Vector3(0, 0, -8.7);
/** The supporting words' face. */
const VOICE3D = () => F.archivo(112.5, 600);

export default class Everything extends Scene {
  private st = new Stage();
  private hero!: Word3D;
  private howHas!: Word3D;
  private beenTurned!: Word3D;
  private againstUs!: Word3D;
  private line!: Line;

  override async init() {
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

    // ---- the flame: at home, then a leap over the word (a parabola in the vertical plane), landing behind it
    const fl = flameState(audio, t, 0);
    const leap = prog(t, turned.start + 0.02, tLand, ease.inOutCubic);
    const P0 = new THREE.Vector3(0, 0, 0), P1 = new THREE.Vector3(0, 7.4, -6.0);
    const fb = new THREE.Vector3()
      .addScaledVector(P0, (1 - leap) * (1 - leap)).addScaledVector(P1, 2 * leap * (1 - leap)).addScaledVector(BEHIND, leap * leap);
    const settle = prog(t, tLand, this.ctx.end, ease.inOutQuad);
    const land = pulse(t, tLand, 0.16) * (t >= tLand ? 1 : 0);
    const flH = FLAME_H * fl.h * (1 + 0.35 * land) * (1 - 0.18 * settle) * (1 + 0.25 * Math.sin(Math.PI * leap));
    const LI = fl.I * (1 + 0.8 * land) * (1 - 0.25 * settle);

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
    const pos = vkeys(t, [
      [this.ctx.start, [0.0, 1.25, 3.6]],
      [tThrow, [0.0, 1.15, 3.2], ease.linear],
      [tThrow + 1.1, [0.0, 2.6, 12.4], ease.outExpo],
      [turned.start, [0.12, 2.5, 12.0], ease.linear],
      [tLand, [0.0, 1.35, 11.2], ease.inOutCubic],
      [this.ctx.end, [0.0, 1.05, 10.2], ease.linear],
    ]);
    const at = vkeys(t, [
      [this.ctx.start, [0.0, 0.32, 0.0]],
      [tThrow, [0.0, 0.32, 0.0], ease.linear],
      [tThrow + 1.1, [0.0, 1.7, -5.5], ease.outExpo],
      [turned.start, [0.0, 1.75, -5.6], ease.linear],
      [tLand, [0.0, 1.55, -6.5], ease.inOutCubic],
      [this.ctx.end, [0.0, 1.45, -6.5], ease.linear],
    ]);
    const fov = lerp(34, 38, prog(t, tThrow, tThrow + 1.1, ease.outExpo));
    this.st.cam.set(pos, at, fov);

    const behind = fb.z < -6.0 && fb.y < CAP * 1.1;
    const close = 1 - prog(t, tThrow - 0.05, tThrow + 0.5);
    const reach = lerp(lerp(4.5, 16, prog(t, tThrow - 0.1, tThrow + 0.9, ease.inOutQuad)), 30, prog(t, tLand - 0.4, tLand + 0.2, ease.inOutQuad));
    this.st.render(renderer, out, t, { base: fb, h: flH, I: LI * 1.15, reach }, { wall: 1, wallZ: WALL_Z, freqFloor: 6.5, freqWall: 4.2 },
      { flameBehind: behind, flameI: lerp(1, 0.5, close), gust: fl.gust * 0.6 - 0.8 * Math.cos(Math.PI * leap) * prog(t, turned.start, tLand) * (1 - prog(t, tLand - 0.2, tLand)), rim: 1.2 });

    return { bloom: lerp(0.75, 0.45, close), bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35, shake: [0, 0.004 * land] };
  }
}
