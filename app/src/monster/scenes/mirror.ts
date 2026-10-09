// Chorus 1 after hook 1 (46.022–68.689), "Into the water" (client concept 2026-10-09; the approved stills are the
// sketch's, `out/stills/mirror/`). Each line goes one step further into the water, on hook 1's shore at night, while
// the far shore fills with the dead; each line has its own stretch of shore (x offsets) and its own set-up, cut on the
// beat:
//   A 46.022 line 1: WRONG? sinks to its waist (lit above, its black-figure twin below, on a running-wave field)
//   B 49.022 line 2: PROBLEM the tip, HIDING the bulk beneath; the camera tracks along on "all along"
//   C 54.022 line 3: GUILT? over a Geometric prothesis frieze, one bier per word
//   D 59.355 line 4: the horizon a tipped beam: FOES high, OURSELVES? sinking
//   E 64.689 line 5: level, low: MONSTER? over its giant black-figure answer (cut to cyclops at 68.688)
// No word has a mirror image; only the black-figure twins and answers show under the water (the mirrored render).
// The waterline keeps its screen height across the cuts where it can (`lineY`): A opens on hook 1's (582 px) and
// tilts down to the plate's (490 px) during its push.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { H as HPX, W as WPX } from '../../engine/gl';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { clamp, ease, keys, lerp, noise1, prog, pulse } from '../../engine/util';
import { SHORE, Stage, Word3D, keyLight, popHinge, popWords, type Letter } from '../stage';
import { BIG_W, FOV, LOW, SHORE_KEY, SHORE_OPTS, SHORE_POST, SHORE_SURF, WORD_Z, heroFont, hideFlat } from '../shore';
import { clipAtWater, mirrorStage } from './mirror-kit';

const PI = Math.PI;
const TANF = Math.tan((FOV * PI) / 360);
/** Each line's stretch of shore. */
const X = { A: 0, B: 40, C: 80, D: 120, E: 160 };
/** Hook 1's waterline (px from the top) as it cuts to A, and the plate's. */
const LINE_HOOK = 582, LINE_Y = 490;

interface Cam { x: number; y: number; z: number; pitch: number; roll: number }
/** A hero (lit, clipped at the water) and its black-figure twin (the part under the surface). */
interface Hero { w: Word3D; bf: Word3D; on: number; from: number; to: number }
/** A small phrase standing on the water: its words pop on their onsets, it folds away at `exit`; it is shown only in
 *  its set-up [t0, t1). `place` gives its left end (x, z), cap height and yaw (world). */
interface Small { w: Word3D; on: number[]; exit: number; t0: number; t1: number; place: (sc: (cap: number) => number) => { x: number; z: number; cap: number; yaw: number } }

/** The camera's pitch (as `Cam.pitch`, + up) that puts the far shore's line `lineY` px from the top of the frame. */
function pitchFor(y: number, z: number, lineY: number) {
  const below = Math.atan(y / (z - SHORE.z));
  return -Math.tan(below - Math.atan(((lineY - HPX / 2) / (HPX / 2)) * TANF));
}

export default class Mirror extends Scene {
  private st!: Stage;
  private T: Record<string, number> = {};
  /** The cuts: A→B, B→C, C→D, D→E. */
  private cuts: number[] = [];
  private hero: Record<'wrong' | 'problem' | 'guilt' | 'foes' | 'ours' | 'monster', Hero> = {} as never;
  private ans: Record<'hiding' | 'monster', Word3D> = {} as never;
  private post!: Word3D;
  private small: Small[] = [];
  private bierOn: number[] = [];

  override async init() {
    const { lyrics, audio } = this.ctx;
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
    T.killed = w(l11, 'killed').start;
    const beat = (t: number) => audio.timeOfBeat(Math.round(audio.beatAt(t)));
    T.slam = beat(64.02);
    this.bierOn = ['killed', 'you', 'every', 'time', 'caved'].map((s) => w(l11, s).start);
    // the cuts, on the beat grid: A→B on the off-beat after WRONG?'s second sink (no whole beat falls between its
    // sink and line 2's first word, 0.21 s after the cut), then on the beat before each line's first word
    const bAB = audio.beatAt(T.l10!);
    this.cuts = [
      audio.timeOfBeat(Math.floor(bAB) + 0.5),
      audio.timeOfBeat(Math.floor(audio.beatAt(T.l11!))),
      audio.timeOfBeat(Math.floor(audio.beatAt(T.l12!))),
      audio.timeOfBeat(Math.floor(audio.beatAt(T.l14!))),
    ];
    const [cAB, cBC, cCD, cDE] = this.cuts as [number, number, number, number];

    this.st = mirrorStage();
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
    H.wrong = hero('WRONG?', T.wrong, T.wrong - 0.1, cAB);
    H.problem = hero('PROBLEM', T.problem, cAB, cBC);
    H.guilt = hero('GUILT?', T.guilt, cBC, cCD);
    H.foes = hero('FOES', T.foes, cCD, cDE);
    H.ours = hero('OURSELVES?', T.ours, cCD, cDE);
    H.monster = hero('MONSTER?', T.m2, cDE, 1e9);
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

    // the small words: 1–4 word phrases standing on the water in the set, one at a time beside the hero
    const voice = F.archivo(112.5, 600);
    const sl = (l: Line, a: string, b?: string) => l.words.slice(l.words.indexOf(w(l, a)), b ? l.words.indexOf(w(l, b)) : undefined);
    const small = (ws: Word[], exit: number, t0: number, t1: number, place: Small['place']) => {
      const wd = new Word3D(ws.map((x) => x.w.replace(/[,.]$/, '')).join(' '), voice, { size: 200 });
      this.st.add(wd, { shadows: false });
      this.small.push({ w: wd, on: ws.map((x) => x.start), exit, t0, t1, place });
    };
    // A: "What if I'm" centred where WRONG? will stand; "in the" just left of WRONG?, on its line
    const wA = this.heroPose(0);
    small(sl(l9, 'what', 'in'), w(l9, 'in').start - 0.13, 46, cAB, (sc) => ({ x: X.A - 0.5 * sc(0.28), z: -3.0, cap: 0.28, yaw: 0 }));
    small(sl(l9, 'in', 'wrong'), 1e9, 46, cAB, (sc) => ({ x: wA.x - wA.width / 2 - 0.22 - sc(0.2), z: wA.z + 0.2, cap: 0.2, yaw: 0 }));
    // B: "What if I'm the", then "that's been" left of PROBLEM on its line; "all along?" right of it
    const wB = this.heroPose(1);
    const leftOfB = (cap: number, sc: (c: number) => number) => ({ x: wB.x - wB.width / 2 - 0.3 - sc(cap), z: wB.z, cap, yaw: 0 });
    small(sl(l10, 'what', 'problem'), w(l10, 'thats').start - 0.16, cAB, cBC, (sc) => leftOfB(0.27, sc));
    small(sl(l10, 'thats', 'hiding'), w(l10, 'all').start - 0.16, cAB, cBC, (sc) => leftOfB(0.27, sc));
    small(sl(l10, 'all'), 1e9, cAB, cBC, () => ({ x: wB.x + wB.width / 2 + 0.3, z: wB.z, cap: 0.27, yaw: 0 }));
    // (lines 3–5: the sketch's phrases, to be completed)
    small(sl(l11, 'caved', 'guilt'), 1e9, cBC, cCD, () => ({ x: X.C - 5.2, z: -6, cap: 0.3, yaw: 0 }));
    small(sl(l13, 'but', 'ourselves'), T.slam! - 0.05, cCD, cDE, () => ({ x: X.D - 3.9, z: -12.5, cap: 0.2, yaw: 0 }));
  }

  /** Where each hero stands (world): centre x, plane z, width (MONSTER?'s comes from the frame, see render). */
  private heroPose(i: number) {
    return [
      { x: X.A + 0.6, z: -4.6, width: 6.0 },
      { x: X.B, z: -6, width: 3.6 },
      { x: X.C, z: -6, width: 6.4 },
      { x: X.D - 3.84, z: WORD_Z, width: 1.62 },
      { x: X.D + 1.12, z: WORD_Z, width: 7.0 },
      { x: X.E, z: WORD_Z, width: 0 },
    ][i]!;
  }

  /** The camera at time t: one set-up per line. */
  private cam(t: number): Cam {
    const T = this.T, [cAB, cBC, cCD, cDE] = this.cuts as [number, number, number, number];
    if (t < cAB) {      // A: skimming low toward the far shore, tilting from hook 1's waterline to the plate's
      const x = X.A, y = 0.35, z = 7 - 4.5 * ease.outCubic(prog(t, 46.022, 49.4));
      const lineY = lerp(LINE_HOOK, LINE_Y, ease.inOutQuad(prog(t, 46.1, 47.9)));
      return { x, y, z, pitch: pitchFor(y, z, lineY), roll: 0 };
    }
    if (t < cBC) {      // B: nearer PROBLEM, tracking along on "all along"
      const y = 0.5, z = 4.2 - 0.25 * prog(t, cAB, cBC);
      const x = X.B - 0.4 + 1.3 * ease.inOutQuad(prog(t, T.all! - 0.05, cBC + 0.4)) * (cBC + 0.45 - T.all!);
      return { x, y, z, pitch: pitchFor(y, z, LINE_Y), roll: 0 };
    }
    if (t < cCD) {      // C: GUILT? over the frieze
      return { x: X.C, y: 0.62, z: 4.4 - 0.4 * prog(t, cBC, cCD), pitch: -0.1, roll: 0 };
    }
    if (t < cDE) {      // D: the beam: the world tips as FOES' side rises, slamming on the downbeat
      const roll = keys(t, [[T.foes!, 0], [T.foes! + 0.5, 0.07, (u) => ease.outBack(u, 1.8)], [T.small!, 0.07],
        [T.small! + 0.3, 0.1, (u) => ease.outBack(u, 2.2)], [T.ours!, 0.1], [T.ours! + 0.35, 0.14, ease.outCubic],
        [T.slam!, 0.14], [T.slam! + 0.25, 0.21, (u) => ease.outBack(u, 2.2)]]);
      return { x: X.D, y: 0.55, z: -7.6, pitch: -0.05, roll };
    }
    // E: levelled out, hook 1's dip to the waterline and its slow push
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
    const [cAB, cBC, cCD, cDE] = this.cuts as [number, number, number, number];
    const setup = t < cAB ? 0 : t < cBC ? 1 : t < cCD ? 2 : t < cDE ? 3 : 4;
    const c = this.cam(t);
    const pos = new THREE.Vector3(c.x, c.y, c.z);
    st.cam.set(pos, pos.clone().add(new THREE.Vector3(0, 30 * c.pitch, -30)), FOV, c.roll);
    const proj = (x: number, y: number, z: number) => { const p = st.cam.project({ x, y, z }); return new THREE.Vector2(p.x, HPX - p.y); };
    /** px per world unit at a point on the water (along the water's line on screen, so it holds under the roll) */
    const pxAt = (x: number, z: number) => proj(x + 0.5, 0, z).distanceTo(proj(x - 0.5, 0, z));
    const fw = (z: number) => 2 * (c.z - z) * TANF * (WPX / HPX);    // frame width (world) at depth z

    // ---- the heroes: where each stands, its scale, how far it is sunk (world), and its twin under the surface
    type Pose = { h: Hero; x: number; z: number; width: number; sink: number };
    const sW = (h: Hero, width: number) => width / h.w.width;
    const hs = [H.wrong, H.problem, H.guilt, H.foes, H.ours, H.monster];
    const poses: Pose[] = hs.map((h, i) => ({ h, ...this.heroPose(i), sink: 0 }));
    poses[5]!.width = BIG_W * fw(WORD_Z);
    const cap = (p: Pose) => p.h.w.cap * sW(p.h, p.width);
    // WRONG? sinks to its waist on the next two hits; OURSELVES? lands low and sinks as the beam slams
    const hA = audio.timeOfBeat(Math.round(audio.beatAt(T.wrong!)) + 0.5), hB = audio.timeOfBeat(Math.round(audio.beatAt(T.wrong!)) + 1);
    poses[0]!.sink = cap(poses[0]!) * keys(t, [[hA - 0.02, 0], [hA + 0.1, 0.27, (v) => ease.outBack(v, 1.6)], [hB - 0.02, 0.27], [hB + 0.1, 0.5, (v) => ease.outBack(v, 1.6)]]);
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
    const postOn = setup === 3;
    const pl = this.post.letters[0]!;
    const pW = 0.3 / Math.max(1, pl.box[2] - pl.box[0]);
    const rise = ease.outCubic(prog(t, T.foes! - 0.3, T.foes! + 0.4));
    this.run(this.post, X.D - 2.68, WORD_Z + 0.1, pW, -0.4, () => 0, postOn);
    pl.x = X.D - 2.68 - (pl.box[0] + pl.box[2]) / 2 * pW;
    this.post.update();
    const pk = (1.6 * rise + 0.4) / (this.post.cap * pW);
    pl.mesh.scale.y = pW * pk; pl.mesh.updateMatrixWorld(true);

    // ---- the small words
    for (const sm of this.small) {
      const p = sm.place((cp) => sm.w.width * cp / sm.w.cap);
      const sc = p.cap / sm.w.cap;
      const cx = Math.cos(p.yaw), cz = -Math.sin(p.yaw);
      popWords(sm.w, sm.on, t, (l: Letter) => {
        l.x = p.x + cx * l.penX * sc; l.z = p.z + cz * l.penX * sc; l.y = 0; l.yaw = p.yaw; l.s = sc;
      }, { exit: sm.exit, exitDur: 0.08, exitRipple: 0 });
      if (t < sm.t0 || t >= sm.t1) for (const l of sm.w.letters) l.on = 0;
      hideFlat(sm.w);
    }

    // ---- the crowd of the dead on the far shore (world space, fixed per stretch of shore): one at WRONG?, more on
    // every beat, a dense crowd from FOES on
    const beatT = audio.timeOfBeat(Math.floor(audio.beatAt(t) + 1e-4));
    const nDead = keys(beatT, [[T.wrong!, 1], [T.problem!, 5], [T.along! + 0.6, 10], [T.killed!, 12], [T.guilt!, 26], [T.foes!, 28], [T.foes! + 0.6, 300]]);
    const crowdH = 0.5, cells = 130;
    u.crowdH!.value = crowdH; u.crowdPx!.value = 1 / pxAt(c.x, SHORE.z);
    u.crowdOne!.value = t >= T.wrong! - 0.02 ? 1 : 0;
    u.crowdD!.value = nDead >= 299 ? 0.95 : Math.max(0, nDead - 1) / cells;
    u.crowdX!.value = [X.A + 9.5, X.B + 0.37, X.C + 0.37, X.D + 0.37, X.E + 0.37][setup]!;
    u.glowI!.value = 0.07 + 0.07 * clamp(nDead / 60, 0, 1);

    // ---- the clay fields under the surface: each anchored to a world point on the water every frame, sized in world
    // units (converted to px at that point), turned with the water's line on screen
    const fA = u.fA!.value as THREE.Vector4[], fB = u.fB!.value as THREE.Vector4[];
    for (const v of fA) v.set(0, 0, 0, 0);
    for (const v of fB) v.set(0, 0, 0, -1);
    (u.frz!.value as THREE.Vector4).set(0, 0, 0, 0);
    (u.pan!.value as THREE.Vector4).set(0, 0, 0, 0);
    const develop = (on: number) => ease.outCubic(prog(t, on, on + 0.35));
    /** Field i under (x, z): half width and depth (world, below the surface); returns px per world unit there. */
    const field = (i: number, x: number, z: number, halfW: number, depth: number, d: number) => {
      const an = proj(x, -0.02, z), a = proj(x - 1, 0, z), b = proj(x + 1, 0, z), k = pxAt(x, z);
      u.fR!.value = Math.atan2(b.y - a.y, b.x - a.x);
      fA[i]!.set(an.x, an.y, halfW * k * d, depth * k * d);
      return k;
    };
    if (setup === 0) {
      const p = poses[0]!, d = develop(hA - 0.02);
      const k = field(0, p.x, p.z, p.width * 0.62, cap(p) * 0.5 + 0.62, d);
      fB[0]!.set((cap(p) * 0.5 + 0.12) * k, 0.24 * k, 2, -1);
    } else if (setup === 1) {
      const p = poses[1]!, gap = 0.08 * cap(p);
      const aw = p.width * 3, deep = this.ans.hiding.cap * (aw / this.ans.hiding.width);
      const k = field(0, p.x, p.z, aw * 0.58, deep + gap + 0.75, develop(T.hiding! - 0.05));
      fB[0]!.set((deep + gap + 0.15) * k, 0.32 * k, 1, -1);
    } else if (setup === 2) {
      // (phase 2: the frieze's sizes in world units)
      const p = poses[2]!, an = proj(p.x, -0.02, p.z);
      field(0, p.x, p.z, 1, 1, 0);
      fA[0]!.set(an.x, an.y, 1150 * develop(T.killed! - 0.15), an.y + 60);
      fB[0]!.set(16, 46, 1, 16 + 46 + 14 + 236 + 14);
      (u.frz!.value as THREE.Vector4).set(16 + 46 + 14, 236, this.bierOn.reduce((s, on) => s + prog(t, on - 0.03, on + 0.15), 0), develop(T.killed! - 0.15));
    } else if (setup === 3) {
      const p = poses[4]!, an = proj(p.x, -0.02, p.z), k = pxAt(p.x, p.z);
      field(1, p.x, p.z, 1, 1, 0);
      const d = develop(T.ours! + 0.1), sunkPx = p.sink * k, ps = 0.1 * p.width * k;
      fA[1]!.set(an.x, an.y, 1300 * d, (sunkPx + 30 + 1.72 * ps + 0.45 * ps + 70) * d);
      (u.pan!.value as THREE.Vector4).set(0, sunkPx + 22 + 1.72 * ps, ps, d);
    } else {
      const an = proj(c.x, -0.02, WORD_Z);
      field(2, c.x, WORD_Z, 1, 1, 0);
      fA[2]!.set(an.x, an.y, 1150 * develop(T.m2! + 0.05), an.y + 80);
    }

    // ---- the mirrored render: only the black-figure twins and answers
    const twins = poses.filter((p) => p.sink > 0 && t >= p.h.from && t < p.h.to);
    const mirror = {
      before: () => {
        for (const p of twins) this.run(p.h.bf, p.x, p.z, sW(p.h, p.width), p.sink, () => PI, true);
        if (setup === 1 && t >= T.hiding! - 0.1) {
          const p = poses[1]!, s = p.width * 3 / this.ans.hiding.width;
          this.run(this.ans.hiding, p.x, p.z, s, this.ans.hiding.cap * s + 0.08 * cap(p), (j) => PI - popHinge(t, T.hiding!, j), true);
        }
        if (setup === 4 && t >= T.m2! - 0.1) {
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
