// `change` — verse 1, line 4: "Do I need to change?" and the bar of strings after it (docs/MONSTER.md, revision 1).
// The shadow play proper: the flame on the floor, CHANGE? standing close in front of it, the wall behind. The word
// folds up as it is sung; then on every eighth note the flame gutters to a new place and the shadow on the wall jumps
// to a new shape while the lit word stays exactly as it was. Through the instrumental the flame sinks and creeps up
// to the letters: their shadows stretch up the wall, huge and toothed, the camera pushes in under them, and on the
// last downbeat the flame all but goes out.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, mulberry32, prog, pulse } from '../../engine/util';
import { flameState } from '../motifs';
import { Stage, Word3D, popHinge, popWords, row, vkeys } from '../stage';

const CAP = 1.15, ROW_Z = -2.3, WALL_Z = -5.6, FLAME_H = 0.62;

export default class Change extends Scene {
  private st = new Stage();
  private word!: Word3D;
  private ask!: Word3D;
  private line!: Line;
  /** the gutter's eighth-note places (x, z, height multiplier) */
  private jumps: [number, number, number][] = [];

  override async init() {
    this.word = new Word3D('CHANGE?', F.archivo(100, 900), { size: 220 });
    this.st.add(this.word);
    this.line = this.ctx.lyrics.get('Do I need to change');
    this.ask = new Word3D(this.line.words.slice(0, 4).map((w) => w.w).join(' '), F.archivo(112.5, 600), { size: 200 });
    this.st.add(this.ask);
    const r = mulberry32(7);
    for (let i = 0; i < 12; i++) this.jumps.push([(r() - 0.5) * 3.0, -1.25 + (r() - 0.5) * 0.45, 0.6 + r() * 0.8]);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const [doW, iW, need, to, change] = this.line.words as [Word, Word, Word, Word, Word];
    const T0 = this.ctx.start, T1 = this.ctx.end;
    const beat = audio.beatAt(t);
    const bChange = audio.beatAt(change.start);
    const bEnd = audio.beatAt(change.end);
    const bOut = audio.beatAt(T1) - 2;                   // the downbeat where the flame all but goes out
    // ---- the flame: still, then guttering to a new place on every eighth note of "change?", then sinking toward the word
    const fl = flameState(audio, t, 9);
    const base = new THREE.Vector3(0, 0, 0.0);
    let hMul = 1;
    const e8 = Math.floor((beat - bChange) * 2);          // eighth-note index since "change"
    if (beat >= bChange && beat < bEnd + 0.5) {
      const j = this.jumps[Math.max(0, e8) % this.jumps.length]!;
      const ph = (beat - bChange) * 2 - e8;
      const snap = ease.outExpo(Math.min(1, ph * 3));
      const jp = this.jumps[Math.max(0, e8 - 1) % this.jumps.length]!;
      const prev = e8 <= 0 ? [0, 0, 1] : jp;
      base.set(lerp(prev[0]!, j[0], snap), 0, lerp(prev[1]!, j[1], snap));
      hMul = lerp(prev[2]!, j[2], snap);
    }
    const creep = prog(beat, bEnd + 0.5, bOut, ease.inOutCubic);
    if (beat >= bEnd + 0.5) {
      const jl = this.jumps[Math.max(0, Math.floor((bEnd + 0.5 - bChange) * 2) - 1) % this.jumps.length]!;
      base.set(lerp(jl[0], 0.15, creep), 0, lerp(jl[1], ROW_Z + 0.95, creep));
      hMul = lerp(jl[2], 0.42, creep);
    }
    const dying = prog(beat, bOut, bOut + 0.5) * (1 - 0.65 * prog(beat, bOut + 1, bOut + 1.12) * (1 - prog(beat, bOut + 1.12, bOut + 1.5)));
    const flH = FLAME_H * fl.h * hMul * (1 - 0.75 * dying);
    const LI = fl.I * (1.9 + 0.5 * creep) * (1 - 0.85 * dying);

    // ---- the word: a straight row facing the flame and the camera, folding up fast as it is sung
    const wd = this.word, n = wd.letters.length, s = CAP / wd.cap;
    for (let k = 0; k < n; k++) {
      const l = wd.letters[k]!;
      l.x = (l.penX - wd.width / 2) * s; l.z = ROW_Z; l.y = 0; l.yaw = 0; l.s = s;
      const tk = change.start + (k / (n - 1)) * Math.min(0.42, change.end - change.start);
      l.hinge = popHinge(t, tk);
      l.on = l.hinge < Math.PI / 2 - 1e-4 ? 1 : 0;
      l.mat.uniforms.glow!.value = 0.45 * pulse(t, tk, 0.16) * (t >= tk ? 1 : 0) * l.on;
    }
    wd.update();
    // "Do I need to": standing where CHANGE? will stand, just behind its row; it falls back as CHANGE? rises
    const as = 0.62 / this.ask.cap;
    popWords(this.ask, [doW.start, iW.start, need.start, to.start], t, row(-(this.ask.width * as) / 2, ROW_Z - 0.7, 0, as), { exit: change.start - 0.02, exitDur: 0.2 });

    // ---- the camera: a three-quarter view of word and wall; under the looming shadow it pushes in and looks up
    const pos = vkeys(t, [[T0, [3.4, 1.5, 6.6]], [change.start, [2.7, 0.85, 6.2], ease.outCubic], [audio.timeOfBeat(bEnd + 0.5), [2.3, 0.8, 5.5], ease.linear],
      [audio.timeOfBeat(bOut), [1.5, 0.75, 3.6], ease.inOutCubic], [T1, [1.35, 0.7, 3.3], ease.linear]]);
    const at = vkeys(t, [[T0, [0.0, 1.6, -3.5]], [change.start, [0.0, 2.5, -4.5], ease.outCubic], [audio.timeOfBeat(bEnd + 0.5), [0.0, 2.6, -4.6], ease.linear],
      [audio.timeOfBeat(bOut), [0.0, 3.1, -5.5], ease.inOutCubic], [T1, [0.0, 3.2, -5.5], ease.linear]]);
    this.st.cam.set(pos, at, lerp(38, 46, creep));

    this.st.render(renderer, out, t, { base, h: flH, I: LI, reach: lerp(15, 18, creep) }, { wall: 1, wallZ: WALL_Z, freqFloor: 4.5, freqWall: 4.2 },
      { gust: fl.gust * 0.6 + (beat >= bChange && beat < bEnd + 0.5 ? 0.6 * Math.sin(e8 * 2.1) : 0), rim: 1.3 });

    return { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5 + 0.2 * creep, grain: 0.06, ca: 0.6, halation: 0.35 };
  }
}
