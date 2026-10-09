// STILLS ONLY: the chorus 1 rework, "Into the water" (client concept 2026-10-09), loaded for the `mirror` entry under
// ?sketch=mirror. One key frame per lyric line; motion between them is crude. Each line goes one step further into
// the water, on hook 1's shore at night, while the far shore fills with the dead:
//   48.75 WRONG? waist-deep (lit above, black-figure below);  52.9 PROBLEM the tip, HIDING the bulk beneath;
//   58.7 GUILT? over a Geometric prothesis frieze;  64.2 the horizon a tipped beam: FOES high, OURSELVES? sinking;
//   67.6 level, low: MONSTER? over its giant black-figure answer.
// Each line has its own stretch of shore (x offsets), so nothing of one shows in another.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { H as HPX, W as WPX } from '../../engine/gl';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { clamp, ease, keys, lerp, noise1, prog, pulse } from '../../engine/util';
import { SHORE, Stage, Word3D, keyLight, popHinge, popWords, type Letter } from '../stage';
import { BIG_W, FOV, LOW, SHORE_KEY, SHORE_OPTS, SHORE_POST, SHORE_SURF, WORD_Z, heroFont } from '../shore';
import { clipAtWater, sketchStage } from './sketch-mirror-kit';

const PI = Math.PI;
const TANF = Math.tan((FOV * PI) / 360);
/** Each line's stretch of shore. */
const X = { A: 0, B: 40, C: 80, D: 120, E: 160 };

interface Cam { x: number; y: number; z: number; pitch: number; roll: number }
/** A hero (lit, clipped at the water) and its black-figure twin (the part under the surface). */
interface Hero { w: Word3D; bf: Word3D; on: number; from: number; to: number }
interface Small { w: Word3D; on: number[]; from: number; exit: number; place: () => { x: number; z: number; cap: number; yaw: number } }

export default class SketchMirror extends Scene {
  private st!: Stage;
  private T: Record<string, number> = {};
  private hero: Record<'wrong' | 'problem' | 'guilt' | 'foes' | 'ours' | 'monster', Hero> = {} as never;
  private ans: Record<'hiding' | 'monster', Word3D> = {} as never;
  private post!: Word3D;
  private small: Small[] = [];
  private bierOn: number[] = [];

  override async init() {
    const { lyrics } = this.ctx;
    const l9 = lyrics.get("What if I'm in the wrong"), l10 = lyrics.get('the problem that\'s been hiding');
    const l11 = lyrics.get('who killed you every time'), l12 = lyrics.get('far too kind to foes');
    const l13 = lyrics.get('but a monster to ourselves');
    const l14 = lyrics.lines.find((l) => l.start > l13.start && /monster/i.test(l.text))!;
    const w = (l: Line, s: string) => l.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
    const T = this.T;
    T.wrong = w(l9, 'wrong').start; T.problem = w(l10, 'problem').start; T.hiding = w(l10, 'hiding').start;
    T.all = w(l10, 'all').start; T.along = w(l10, 'along').start;
    T.l10 = l10.words[0]!.start; T.l11 = l11.words[0]!.start; T.l12 = l12.words[0]!.start; T.l14 = l14.words[0]!.start;
    T.guilt = w(l11, 'guilt').start; T.foes = w(l12, 'foes').start; T.small = w(l13, 'monster').start;
    T.ours = w(l13, 'ourselves').start; T.m2 = l14.words.find((x) => /monster/i.test(x.w))!.start;
    T.slam = 64.02;
    T.killed = w(l11, 'killed').start;
    this.bierOn = ['killed', 'you', 'every', 'time', 'caved'].map((s) => w(l11, s).start);

    this.st = sketchStage();
    const hero = (text: string, on: number, from: number, to: number): Hero => {
      const wd = new Word3D(text, heroFont(), { size: 220 });
      wd.lightMul = 2.8;
      this.st.add(wd, { shadows: false });
      clipAtWater(wd, 1);
      const bf = new Word3D(text, heroFont(), { size: 220, incise: true });
      for (const l of bf.letters) { l.mat.uniforms.bf!.value = 1; l.mat.side = THREE.DoubleSide; }
      this.st.add(bf, { shadows: false });
      clipAtWater(bf, -1);
      return { w: wd, bf, on, from, to };
    };
    const H = this.hero;
    H.wrong = hero('WRONG?', T.wrong, T.wrong - 0.1, T.l10);
    H.problem = hero('PROBLEM', T.problem, T.l10, T.l11);
    H.guilt = hero('GUILT?', T.guilt, T.l11, T.l12);
    H.foes = hero('FOES', T.foes, T.l12, T.l14);
    H.ours = hero('OURSELVES?', T.ours, T.l12, T.l14);
    H.monster = hero('MONSTER?', T.m2, T.l14, 1e9);
    const answer = (text: string) => {
      const a = new Word3D(text, heroFont(), { size: 220, incise: true });
      for (const l of a.letters) { l.mat.uniforms.bf!.value = 1; l.mat.side = THREE.DoubleSide; }
      this.st.add(a, { shadows: false });
      return a;
    };
    this.ans.hiding = answer('HIDING');
    this.ans.monster = answer('MONSTER');
    this.post = new Word3D('I', heroFont(), { size: 220 });
    this.post.lightMul = 2.2;
    this.st.add(this.post, { shadows: false });
    clipAtWater(this.post, 1);

    // the small words, standing on the water in the set (never a strip along the bottom of the frame)
    const voice = F.archivo(112.5, 600);
    const sl = (l: Line, a: string, b?: string) => l.words.slice(l.words.indexOf(w(l, a)), b ? l.words.indexOf(w(l, b)) : undefined);
    const small = (ws: Word[], exit: number, place: Small['place']) => {
      const wd = new Word3D(ws.map((x) => x.w.replace(/[,.]$/, '')).join(' '), voice, { size: 200 });
      this.st.add(wd, { shadows: false });
      this.small.push({ w: wd, on: ws.map((x) => x.start), from: ws[0]!.start - 0.1, exit, place });
    };
    small(sl(l9, 'what', 'wrong'), T.l10 - 0.1, () => ({ x: X.A - 2.3, z: -0.7, cap: 0.15, yaw: 0.25 }));
    small(sl(l10, 'all'), T.l11 - 0.1, () => ({ x: X.B + 2.2, z: -6, cap: 0.3, yaw: 0 }));
    small(sl(l11, 'caved', 'guilt'), T.l12 - 0.1, () => ({ x: X.C - 5.2, z: -6, cap: 0.3, yaw: 0 }));
    small(sl(l13, 'but', 'ourselves'), T.l14 - 0.1, () => ({ x: X.D - 3.9, z: -12.5, cap: 0.2, yaw: 0 }));
  }

  /** The camera at time t: one move per line (crude between the key frames). */
  private cam(t: number): Cam {
    const T = this.T;
    if (t < T.l10!) {   // skimming fast and low toward the far shore
      return { x: X.A, y: 0.35, z: 9 - 6.6 * ease.outCubic(prog(t, 46.0, 49.6)), pitch: -0.06, roll: 0 };
    }
    if (t < T.l11!) {   // nearer PROBLEM, tracking along on "all along"
      return { x: X.B - 0.4 + 1.6 * Math.max(0, t - T.all!), y: 0.5, z: 4.2 - 0.25 * prog(t, T.l10!, T.l11!), pitch: -0.085, roll: 0 };
    }
    if (t < T.l12!) {   // GUILT? over the frieze
      return { x: X.C, y: 0.62, z: 4.4 - 0.4 * prog(t, T.l11!, T.l12!), pitch: -0.1, roll: 0 };
    }
    if (t < T.l14!) {   // the beam: the world tips as FOES' side rises, slamming on the downbeat
      const roll = keys(t, [[T.foes!, 0], [T.foes! + 0.5, 0.07, (u) => ease.outBack(u, 1.8)], [T.small!, 0.07],
        [T.small! + 0.3, 0.1, (u) => ease.outBack(u, 2.2)], [T.ours!, 0.1], [T.ours! + 0.35, 0.14, ease.outCubic],
        [T.slam!, 0.14], [T.slam! + 0.25, 0.21, (u) => ease.outBack(u, 2.2)]]);
      return { x: X.D, y: 0.55, z: -6.5, pitch: -0.05, roll };
    }
    // levelled out, hook 1's dip to the waterline and its slow push
    const u = ease.inOutCubic(prog(t, T.m2! - 0.12, T.m2! + 0.45));
    return { x: X.E, y: lerp(0.5, LOW.y, u), z: LOW.z - 0.4 * prog(t, T.m2! + 0.45, this.ctx.end), pitch: lerp(-0.03, LOW.pitch, u), roll: 0 };
  }

  /** Poses a run centred at x on the plane z, `s` world units per font px, baseline at y. */
  private run(w: Word3D, x: number, z: number, s: number, y: number, hinge: (j: number) => number, on: boolean) {
    w.letters.forEach((l, j) => {
      l.x = x + (l.penX - w.width / 2) * s; l.z = z; l.y = y; l.yaw = 0; l.s = s;
      l.hinge = hinge(j);
      l.on = on && l.hinge < PI / 2 - 1e-3 || on && l.hinge > PI / 2 + 0.35 ? 1 : 0;
    });
    w.update();
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio } = this.ctx;
    const t = f.t, T = this.T, H = this.hero, st = this.st, u = st.bg.u;
    const c = this.cam(t);
    const pos = new THREE.Vector3(c.x, c.y, c.z);
    st.cam.set(pos, pos.clone().add(new THREE.Vector3(0, 30 * c.pitch, -30)), FOV, c.roll);
    const proj = (x: number, y: number, z: number) => { const p = st.cam.project({ x, y, z }); return new THREE.Vector2(p.x, HPX - p.y); };
    const pxPer = (z: number) => HPX / (2 * (c.z - z) * TANF);       // px per world unit at depth z (unrolled)
    const fw = (z: number) => 2 * (c.z - z) * TANF * (WPX / HPX);    // frame width (world) at depth z

    // ---- the heroes: where each stands, its scale, how far it is sunk (world), and its twin under the surface
    type Pose = { h: Hero; x: number; z: number; width: number; sink: number };
    const sW = (h: Hero, width: number) => width / h.w.width;
    const poses: Pose[] = [
      { h: H.wrong, x: X.A, z: -4.6, width: 6.0, sink: 0 },
      { h: H.problem, x: X.B, z: -6, width: 3.6, sink: 0 },
      { h: H.guilt, x: X.C, z: -6, width: 6.4, sink: 0 },
      { h: H.foes, x: X.D - 4.1, z: WORD_Z, width: 2.7, sink: 0 },
      { h: H.ours, x: X.D + 1.9, z: WORD_Z, width: 7.0, sink: 0 },
      { h: H.monster, x: X.E, z: WORD_Z, width: BIG_W * fw(WORD_Z), sink: 0 },
    ];
    const cap = (p: Pose) => p.h.w.cap * sW(p.h, p.width);
    // WRONG? sinks to its waist on the next two hits; OURSELVES? lands low and sinks as the beam slams
    poses[0]!.sink = cap(poses[0]!) * keys(t, [[48.35, 0], [48.47, 0.27, (v) => ease.outBack(v, 1.6)], [48.67, 0.27], [48.79, 0.5, (v) => ease.outBack(v, 1.6)]]);
    poses[4]!.sink = cap(poses[4]!) * keys(t, [[T.ours! + 0.1, 0], [T.ours! + 0.4, 0.15, ease.outCubic], [T.slam!, 0.18], [T.slam! + 0.2, 0.45, (v) => ease.outBack(v, 1.5)]]);
    for (const p of poses) {
      const s = sW(p.h, p.width), live = t >= p.h.from && t < p.h.to;
      this.run(p.h.w, p.x, p.z, s, -p.sink, (j) => popHinge(t, p.h.on, j), live);
      p.h.w.letters.forEach((l, i) => {
        const tk = p.h.on + i * 0.014;
        l.mat.uniforms.glow!.value = 0.5 * pulse(t, tk, 0.14) * (t >= tk ? 1 : 0) * l.on;
        l.mat.uniforms.amb!.value = 0.05 * prog(t, tk, tk + 0.3);
      });
    }

    // the post (the fulcrum) rises from the water at the centre of the beam
    const postOn = t >= T.l12! && t < T.l14!;
    const pl = this.post.letters[0]!;
    const pW = 0.3 / Math.max(1, pl.box[2] - pl.box[0]);
    const rise = ease.outCubic(prog(t, T.foes! - 0.3, T.foes! + 0.4));
    this.run(this.post, X.D - 2.1, WORD_Z + 0.1, pW, -0.4, () => 0, postOn);
    pl.x = X.D - 2.1 - (pl.box[0] + pl.box[2]) / 2 * pW;
    this.post.update();
    const pk = (1.6 * rise + 0.4) / (this.post.cap * pW);
    pl.mesh.scale.y = pW * pk; pl.mesh.updateMatrixWorld(true);

    // ---- the small words
    for (const sm of this.small) {
      const p = sm.place();
      const sc = p.cap / sm.w.cap;
      const cx = Math.cos(p.yaw), cz = -Math.sin(p.yaw);
      popWords(sm.w, sm.on, t, (l: Letter) => {
        l.x = p.x + cx * l.penX * sc; l.z = p.z + cz * l.penX * sc; l.y = 0; l.yaw = p.yaw; l.s = sc;
      }, { exit: sm.exit, exitDur: 0.08 });
      if (t < sm.from) for (const l of sm.w.letters) l.on = 0;
      sm.w.update();
    }

    // ---- the crowd of the dead on the far shore: one at WRONG?, more on every beat, a dense crowd from FOES on
    const beatT = audio.timeOfBeat(Math.floor(audio.beatAt(t)));
    const nDead = keys(beatT, [[T.wrong!, 1], [T.problem!, 6], [T.along! + 0.6, 9], [T.killed!, 11], [T.guilt!, 25], [T.foes!, 26], [T.foes! + 0.6, 300]]);
    const crowdH = 0.5, dist = c.z - SHORE.z, cells = fw(SHORE.z) / (0.36 * crowdH);
    u.crowdH!.value = crowdH; u.crowdPx!.value = 1 / pxPer(SHORE.z);
    u.crowdOne!.value = t >= T.wrong! ? 1 : 0;
    u.crowdD!.value = nDead >= 299 ? 0.95 : Math.max(0, nDead - 1) / (1.6 * cells);
    u.crowdX!.value = t < T.l10! ? X.A + 0.84 * fw(SHORE.z) / 2 : c.x + 0.37;
    u.glowI!.value = 0.07 + 0.07 * clamp(nDead / 60, 0, 1);
    void dist;

    // ---- the clay fields under the surface (anchors just under the waterline, GL px)
    const fA = u.fA!.value as THREE.Vector4[], fB = u.fB!.value as THREE.Vector4[];
    for (const v of fA) v.set(0, 0, 0, 0);
    for (const v of fB) v.set(0, 0, 0, -1);
    (u.frz!.value as THREE.Vector4).set(0, 0, 0, 0);
    (u.pan!.value as THREE.Vector4).set(0, 0, 0, 0);
    const a = proj(c.x - 1, 0, -6), b = proj(c.x + 1, 0, -6);
    u.fR!.value = Math.atan2(b.y - a.y, b.x - a.x);
    const develop = (on: number) => ease.outCubic(prog(t, on, on + 0.35));
    if (t < T.l10!) {
      const p = poses[0]!, k = pxPer(p.z), an = proj(p.x, -0.02, p.z);
      const d = develop(48.33);
      fA[0]!.set(an.x, an.y, p.width * 0.68 * k * d, (cap(p) * 0.5 * k + 120) * d);
      fB[0]!.set(cap(p) * 0.5 * k + 26, 52, 2, -1);
    } else if (t < T.l11!) {
      const p = poses[1]!, k = pxPer(p.z), gap = 0.08 * cap(p);
      const aw = p.width * 3, as = aw / this.ans.hiding.width, an = proj(p.x, -0.02, p.z);
      const d = develop(T.hiding! - 0.05);
      const deep = this.ans.hiding.cap * as * k;
      fA[0]!.set(an.x, an.y, aw * 0.58 * k * d, (deep + 110) * d);
      fB[0]!.set(deep + gap * k + 22, 48, 1, -1);
      void gap;
    } else if (t < T.l12!) {
      const p = poses[2]!, an = proj(p.x, -0.02, p.z);
      fA[0]!.set(an.x, an.y, 1150 * develop(T.killed! - 0.15), an.y + 60);
      fB[0]!.set(16, 46, 1, 16 + 46 + 14 + 236 + 14);
      (u.frz!.value as THREE.Vector4).set(16 + 46 + 14, 236, this.bierOn.reduce((s, on) => s + prog(t, on - 0.03, on + 0.15), 0), develop(T.killed! - 0.15));
    } else if (t < T.l14!) {
      const p = poses[4]!, k = pxPer(p.z), an = proj(p.x, -0.02, p.z);
      const d = develop(T.ours! + 0.1), sunkPx = p.sink * k, ps = 0.1 * p.width * k;
      fA[1]!.set(an.x, an.y, 1300 * d, (sunkPx + 30 + 1.72 * ps + 0.45 * ps + 70) * d);
      (u.pan!.value as THREE.Vector4).set(0, sunkPx + 22 + 1.72 * ps, ps, d);
    } else {
      const an = proj(c.x, -0.02, WORD_Z);
      fA[2]!.set(an.x, an.y, 1150 * develop(T.m2! + 0.05), an.y + 80);
    }

    // ---- the mirrored render: only the black-figure twins and answers
    const twins = poses.filter((p) => p.sink > 0 && t >= p.h.from && t < p.h.to);
    const mirror = {
      before: () => {
        for (const p of twins) this.run(p.h.bf, p.x, p.z, sW(p.h, p.width), p.sink, () => PI, true);
        if (t >= T.hiding! - 0.1 && t < T.l11!) {
          const p = poses[1]!, s = p.width * 3 / this.ans.hiding.width;
          this.run(this.ans.hiding, p.x, p.z, s, this.ans.hiding.cap * s + 0.08 * cap(p), (j) => PI - popHinge(t, T.hiding!, j), true);
        }
        if (t >= T.m2! - 0.1) {
          const fwE = fw(WORD_Z), s = 1.32 * fwE / this.ans.monster.width;
          const rise = 4 * (1 - ease.outCubic(prog(t, T.m2! + 0.05, T.m2! + 0.75)));
          this.run(this.ans.monster, X.E, WORD_Z, s, this.ans.monster.cap * s + 0.05 * cap(poses[5]!) + rise, (j) => PI - popHinge(t, T.m2!, j), true);
        }
      },
      after: () => {
        for (const w of [...poses.map((p) => p.h.bf), this.ans.hiding, this.ans.monster]) { for (const l of w.letters) l.on = 0; w.update(); }
      },
    };
    mirror.after();
    st.render(renderer, out, t, keyLight(st.cam, audio, t, SHORE_KEY), SHORE_SURF, { ...SHORE_OPTS, mirror });

    const hit = poses.reduce((s, p) => s + pulse(t, p.h.on, 0.08), 0) + 1.2 * pulse(t, T.slam!, 0.1);
    return { ...SHORE_POST, shake: [noise1(t * 60, 1) * 6 * hit, noise1(t * 60, 2) * 6 * hit].map((v) => clamp(v, -12, 12)) as [number, number] };
  }
}
