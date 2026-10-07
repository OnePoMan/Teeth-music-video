// `everything` — verse 1, line 1: "How has everything been turned against us?" (docs/MONSTER.md, revision 1).
// Close on the flame ("How has"). On "everything" the camera is thrown back and the word folds up out of the cave
// floor letter by letter as it is sung: stone, standing in an arc round the flame, its shadow standing up on the
// wall behind. On "turned" the flame leaps over the word and lands behind it on "us?": the letters go black against
// a burning wall and their shadows swing round and run at the camera until they swallow it.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D, W } from '../../engine/gl';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, prog, pulse, springStep } from '../../engine/util';
import { flameState } from '../motifs';
import { Stage, Word3D, drawPhrase, vkeys } from '../stage';

/** The word stands on a shallow arc (centre z, radius) facing the camera; cap height; the wall; the flame's height. */
const ARC = { cz: 4.5, R: 11 }, CAP = 1.75, WALL_Z = -10.6, FLAME_H = 0.78;
/** Where the flame lands behind the word. */
const BEHIND = new THREE.Vector3(0, 0, -8.7);

export default class Everything extends Scene {
  private st = new Stage();
  private word!: Word3D;
  private txt = new Layer2D();
  private line!: Line;

  override async init() {
    this.word = new Word3D('EVERYTHING', F.archivo(87.5, 900), { size: 220 });
    this.st.add(this.word);
    this.line = this.ctx.lyrics.get('How has everything');
  }

  private w(s: string): Word {
    return this.line.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, comp, audio } = this.ctx;
    const ev = this.w('everything'), been = this.w('been'), turned = this.w('turned'), against = this.w('against'), us = this.w('us');
    const beat = (x: number) => audio.nearestBeat(x);
    const bThrow = beat(ev.start + 0.05);            // the downbeat inside "everything": the camera is thrown back
    const bLand = beat(us.start);                     // the downbeat on "us?": the flame lands behind the word

    // ---- the flame: at home, then a leap over the word (a parabola in the vertical plane), landing behind it
    const fl = flameState(audio, t, 0);
    const leap = prog(t, turned.start + 0.02, bLand, ease.inOutCubic);
    const P0 = new THREE.Vector3(0, 0, 0), P1 = new THREE.Vector3(0, 7.4, -6.0);
    const fb = new THREE.Vector3()
      .addScaledVector(P0, (1 - leap) * (1 - leap)).addScaledVector(P1, 2 * leap * (1 - leap)).addScaledVector(BEHIND, leap * leap);
    // after landing: the flame bows low (the shadows lengthen) and gutters
    const settle = prog(t, bLand, this.ctx.end, ease.inOutQuad);
    const land = pulse(t, bLand, 0.16);
    const flH = FLAME_H * fl.h * (1 + 0.35 * land) * (1 - 0.18 * settle) * (1 + 0.25 * Math.sin(Math.PI * leap));
    const LI = fl.I * (1 + 0.8 * land) * (1 - 0.25 * settle);

    // ---- the word: an arc about the flame's home, letters folding up from the floor as they are sung
    const wd = this.word, n = wd.letters.length;
    const s = CAP / wd.cap;
    for (let k = 0; k < n; k++) {
      const l = wd.letters[k]!;
      const th = ((l.penX - wd.width / 2) * s) / ARC.R;
      l.x = ARC.R * Math.sin(th); l.z = ARC.cz - ARC.R * Math.cos(th); l.y = 0;
      l.yaw = -th; l.s = s;
      const tk = ev.start + (k / (n - 1)) * Math.max(0.2, ev.end - ev.start - 0.18);
      l.on = t >= tk - 0.02 ? 1 : 0;
      l.hinge = (Math.PI / 2) * (1 - springStep(t - tk, 2.3, 0.4));
      l.mat.uniforms.glow!.value = 0.55 * pulse(t, tk, 0.22) * l.on;
    }
    wd.update();

    // ---- the camera: close on the flame; thrown back on the downbeat; drifts in as the shadows come
    const pos = vkeys(t, [
      [this.ctx.start, [0.0, 1.25, 3.6]],
      [bThrow - 0.02, [0.0, 1.15, 3.2], ease.linear],
      [bThrow + 1.1, [0.0, 2.6, 12.4], ease.outExpo],
      [turned.start, [0.12, 2.5, 12.0], ease.linear],
      [bLand, [0.0, 1.35, 11.2], ease.inOutCubic],
      [this.ctx.end, [0.0, 1.05, 10.2], ease.linear],
    ]);
    const at = vkeys(t, [
      [this.ctx.start, [0.0, 0.32, 0.0]],
      [bThrow - 0.02, [0.0, 0.32, 0.0], ease.linear],
      [bThrow + 1.1, [0.0, 1.7, -5.5], ease.outExpo],
      [turned.start, [0.0, 1.75, -5.6], ease.linear],
      [bLand, [0.0, 1.55, -6.5], ease.inOutCubic],
      [this.ctx.end, [0.0, 1.45, -6.5], ease.linear],
    ]);
    const fov = lerp(34, 38, prog(t, bThrow - 0.02, bThrow + 1.1, ease.outExpo));
    this.st.cam.set(pos, at, fov);

    // the flame is behind the word once it has crossed the arc's plane (seen from the camera)
    const behind = fb.z < -6.0 && fb.y < CAP * 1.1;
    // close on the flame its sprite is turned down so its body keeps its shape under the bloom
    const close = 1 - prog(t, bThrow - 0.05, bThrow + 0.5);
    // behind the word the light reaches further: beams between the letters run all the way to the camera
    const reach = lerp(lerp(4.5, 16, prog(t, bThrow - 0.1, bThrow + 0.9, ease.inOutQuad)), 30, prog(t, bLand - 0.4, bLand + 0.2, ease.inOutQuad));
    this.st.render(renderer, out, t, { base: fb, h: flH, I: LI * 1.15, reach }, { wall: 1, wallZ: WALL_Z, freqFloor: 6.5, freqWall: 4.2 },
      { flameBehind: behind, flameI: lerp(1, 0.5, close), gust: fl.gust * 0.6 - 0.8 * Math.cos(Math.PI * leap) * prog(t, turned.start, bLand) * (1 - prog(t, bLand - 0.2, bLand)), rim: 1.2 });

    // ---- the small voice: one phrase at a time
    const c = this.txt.ctx;
    this.txt.clear();
    const [how, has] = this.line.words as [Word, Word];
    drawPhrase(c, [how, has], t, 160, 900, { exit: prog(t, bThrow, bThrow + 0.3) });
    drawPhrase(c, [been, turned], t, W / 2, 990, { align: 0.5, exit: prog(t, against.start - 0.05, against.start + 0.2) });
    drawPhrase(c, [against, us], t, W / 2, 990, { align: 0.5, exit: prog(t, this.ctx.end - 0.45, this.ctx.end - 0.05) * 0.85 });
    comp.draw(renderer, this.txt.upload(), out);

    return { bloom: lerp(0.75, 0.45, close), bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35, shake: [0, 0.004 * land] };
  }
}
