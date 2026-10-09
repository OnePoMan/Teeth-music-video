// SKETCH (stills only): hook 2, "If I became the monster and threw that guilt away" (110.02–115.35), two options.
//   opt=a "the answer touches the surface": the black-figure answer MONSTER rises under the surface until its top
//         touches the underside, a beat before the lit MONSTER stands; the clay's orange seeps a little above the line.
//   opt=b "guilt thrown away": GUILE? carried over the cut stands on the shore; MONSTER stands with its answer; on
//         "threw that guilt away" a lit GUILT is thrown into the water and sinks, black-figure below the surface.
// Both: GUILE? from the horse stands on the waterline at the cut and lies down as "If" begins.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { ease, lerp, prog, pulse, noise1 } from '../../engine/util';
import { popHinge, type Word3D } from '../stage';
import { SHORE_POST, Answer, heroScale, hideFlat, setRegion } from '../shore';
import { Kit, WORD_Z, hookCam, landGlow, look, opt } from './sketch-hooks-kit';

export default class SketchHook2 extends Scene {
  private o = 'a';
  private k!: Kit;
  private big!: Word3D;
  private guile!: Word3D;
  private guilt!: Word3D;
  private guiltBF!: Word3D;
  private ans!: Answer;
  private s = 0.01;
  private on = { if: 110.46, monster: 112.0, threw: 113.14, that: 113.72, guilt: 113.96, away: 114.29 };

  override init() {
    this.o = opt();
    const line = this.ctx.lyrics.get('If I became the monster and threw');
    const find = (re: RegExp, d: number) => line.words.find((w) => re.test(w.w))?.start ?? d;
    this.on = { if: find(/^if$/i, 110.46), monster: find(/monster/i, 112.0), threw: find(/threw/i, 113.14),
      that: find(/^that$/i, 113.72), guilt: find(/guilt/i, 113.96), away: find(/away/i, 114.29) };
    this.k = new Kit();
    this.big = this.k.lit('MONSTER');
    this.guile = this.k.lit('GUILE?');
    this.guilt = this.k.lit('GUILT');
    this.guiltBF = this.k.bf('GUILT', 'mirror');
    this.s = heroScale(this.big);
    this.ans = new Answer(this.k.st, 'MONSTER');
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio } = this.ctx;
    const t = f.t, k = this.k, s = this.s, on = this.on, u = k.u;
    const capS = this.big.cap * s;

    // ---- the camera: hook 1's dip on MONSTER; (b) on "threw" it pulls back and up to show the throw
    const c = hookCam(t, on.monster, this.ctx.start, this.ctx.end);
    let pos = c.pos, pitch = c.pitch;
    if (this.o === 'b') {
      const pb = ease.inOutCubic(prog(t, on.threw - 0.05, on.that + 0.25));
      pos = pos.clone().lerp(new THREE.Vector3(7.4, 0.4, 25), pb);
      pitch = lerp(pitch, 0.004, pb);
    }
    k.st.cam.set(pos, look(pos, pitch), 40);

    // ---- GUILE?, carried over the cut: standing on the waterline, it lies down as "If" begins
    Kit.pose(this.guile, 0, s, (l, i, x) => {
      const h = (Math.PI / 2) * prog(t, on.if - 0.06 + i * 0.012, on.if + 0.16 + i * 0.012, ease.inCubic);
      return { x, y: 0, z: WORD_Z, hinge: h, on: true };
    });
    hideFlat(this.guile);

    // ---- MONSTER: stands on its onset (no "?": the conditional)
    Kit.pose(this.big, 0, s, (l, i, x) => {
      const h = popHinge(t, on.monster, i);
      return { x, y: 0, z: WORD_Z, hinge: h, on: h < Math.PI / 2 - 1e-4 };
    });
    landGlow(this.big, t, on.monster);

    // ---- the answer under the surface
    let gap = 0.06 * capS, sink = 0, unfold = on.monster;
    if (this.o === 'a') {
      // it rises from the deep until its top touches the underside of the surface, a beat before the word stands
      gap = 0;
      unfold = on.monster - 0.75;
      sink = capS * 1.4 * (1 - ease.outCubic(prog(t, on.monster - 0.6, on.monster - 0.08)));
      u.develop!.value = ease.outCubic(prog(t, on.monster - 0.7, on.monster - 0.15));
      // for the first time the orange seeps a little above the line around the word
      u.creep!.value = 0.34 * ease.outCubic(prog(t, on.monster - 0.05, on.monster + 0.7));
    } else {
      u.develop!.value = ease.outCubic(prog(t, on.monster + 0.05, on.monster + 0.7));
      u.creep!.value = 0;
    }
    setRegion(k.st, this.ans.box(k.st, 0, s, gap + sink * 0.5));

    // ---- (b) GUILT: up on "threw", thrown on "that", into the water by "guilt", sinking through "away"; under the
    // surface it is black-figure (its sunk part painted in the water, on clay of its own)
    let guiltOn = 0;
    if (this.o === 'b') {
      const sg = s * 0.9, capG = this.guilt.cap * sg;
      const pA = prog(t, on.that - 0.05, on.guilt + 0.12);           // the throw: an arc from near MONSTER to the right
      const land = on.guilt + 0.12;
      const d = capG * 1.15 * prog(t, land, on.away + 0.8);
      const xc = lerp(6, 20.6, pA), yArc = 9 * 4 * pA * (1 - pA);
      const tilt = lerp(-0.9, 0.12, ease.outCubic(pA));
      Kit.pose(this.guilt, xc, sg, (l, i, x) => {
        const h = t < on.that ? popHinge(t, on.threw, i) : tilt;
        return { x, y: t < land ? yArc : -d, z: WORD_Z, hinge: h,
          on: t >= on.threw - 0.05 && h < Math.PI / 2 - 1e-4 && d < capG * 1.1 };
      });
      landGlow(this.guilt, t, on.threw);
      guiltOn = t >= land ? 1 : 0;
      k.field2(this.guilt, WORD_Z, capG * 1.05, guiltOn);
    } else {
      Kit.pose(this.guilt, 0, s, (l, i, x) => ({ x, y: 0, z: WORD_Z, hinge: 0, on: false }));
      u.g2On!.value = 0;
    }

    k.render(renderer, out, audio, t, () => {
      this.ans.pose(t, 0, s, unfold, gap, sink);
      if (guiltOn) Kit.mirrorOf(this.guilt, this.guiltBF);
      else for (const l of this.guiltBF.letters) l.on = 0;
      this.guiltBF.update();
    }, () => this.ans.hide());

    const hit = pulse(t, on.monster, 0.08);
    return { ...SHORE_POST, shake: [noise1(t * 60, 1) * 6 * hit, noise1(t * 60, 2) * 6 * hit] };
  }
}
