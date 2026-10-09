// Chorus 1 after hook 1 (46.022–68.689), "Into the water" (client concept 2026-10-09; the approved stills are the
// sketch's, `out/stills/mirror/`). Each line goes one step further into the water, on hook 1's shore at night, while
// the far shore fills with the dead; each line has its own stretch of shore (x offsets) and its own set-up, cut on the
// beat:
//   A 46.022 line 1: WRONG? sinks to its waist (lit above, its black-figure twin below, on a running-wave field)
//   B 49.022 line 2: PROBLEM the tip, HIDING the bulk beneath; the camera tracks along on "all along"
//   C 54.022 line 3: GUILT? over a Geometric prothesis frieze, one bier per word from "killed" to "caved"
//   D 59.355 line 4: the bronze beam (client colouring A1): FOES in the lit pan at its high end, OURSELVES? sinking
//            at the low end over the black-figure pan with his men; the world tips (camera roll)
//   E 64.689 line 5: level, then hook 1's dip: MONSTER? over its answer risen from the deep (cut to cyclops 68.688)
// No word has a mirror image; only the black-figure twins and answers show under the water (the mirrored render).
// The waterline keeps its screen height across the cuts (`LINE_Y`): A opens on hook 1's (582 px) and tilts to the
// plate's during its push; E's dip ends on hook 1's again.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { H as HPX, W as WPX } from '../../engine/gl';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { clamp, ease, keys, lerp, noise1, prog, pulse } from '../../engine/util';
import { SHORE, Stage, Word3D, keyLight, popHinge, popWords, type Letter } from '../stage';
import { BIG_W, FOV, LOW, SHORE_KEY, SHORE_OPTS, SHORE_POST, SHORE_SURF, VOICE, WORD_Z, heroFont, hideFlat } from '../shore';
import { clipAtWater, mirrorStage } from './mirror-kit';

const PI = Math.PI;
const TANF = Math.tan((FOV * PI) / 360);
/** Each line's stretch of shore. */
const X = { A: 0, B: 40, C: 80, D: 120, E: 160 };
/** Hook 1's waterline (px from the top) as it cuts to A, and the plate's. */
const LINE_HOOK = 582, LINE_Y = 490;
/** The bronze beam (D): its ends, bar and knob heights, depth, and the lit pan at its high end (world). */
// (the pivot, the post, stands at X.D: FOES' arm short, OURSELVES?' long, so the heavy side carries the bigger word)
const BEAM = { x0: X.D - 3.8, x1: X.D + 8.1, h: 0.26, knob: 0.46, knobW: 0.32, z: WORD_Z + 0.05, depth: 0.32 };
const PAN = { x0: X.D - 3.5, x1: X.D - 0.85, h: 0.08, lip: 0.3, lipW: 0.1 };

interface Cam { x: number; y: number; z: number; pitch: number; roll: number }
/** A hero (lit, clipped at the water) and its black-figure twin (the part under the surface). */
interface Hero { w: Word3D; bf: Word3D; on: number; from: number; to: number }
/** Where a small phrase stands: its left end (x, z), cap height and yaw (world); `amp` bobs it on the swell. */
interface Place { x: number; z: number; cap: number; yaw: number; amp?: number }
/** A small phrase standing on the water: its words pop on their onsets, it folds away at `exit`; it is shown only in
 *  its set-up [t0, t1). `place` gets the phrase's width (world) at a cap height. */
interface Small { w: Word3D; on: number[]; exit: number; t0: number; t1: number; place: (wd: (cap: number) => number, c: Cam) => Place }

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
  /** Bronze props built from glyphs (".-.": two knobs and a bar): the beam, and the lit pan (a tray and its lips). */
  private beam!: Word3D;
  private pan!: Word3D;
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
    this.cuts = [
      audio.timeOfBeat(Math.floor(audio.beatAt(T.l10!)) + 0.5),
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
    this.post.prop = true;
    this.st.add(this.post, { shadows: false });
    clipAtWater(this.post, 1);
    const bronze = () => {
      const b = new Word3D('.-.', heroFont(), { size: 220 });
      b.prop = true; b.lightMul = 2.2;
      for (const l of b.letters) l.mat.uniforms.bronze!.value = 1;
      this.st.add(b, { shadows: false });
      clipAtWater(b, 1);
      return b;
    };
    this.beam = bronze();
    this.pan = bronze();

    // the small words: 1–4 word phrases standing on the water in the set, one at a time beside the hero
    const voice = F.archivo(112.5, 600);
    const sl = (l: Line, a: string, b?: string) => l.words.slice(l.words.indexOf(w(l, a)), b ? l.words.indexOf(w(l, b)) : undefined);
    const small = (ws: Word[], exit: number, t0: number, t1: number, place: Small['place']) => {
      const wd = new Word3D(ws.map((x) => x.w.replace(/[,.]$/, '')).join(' '), voice, { size: 200 });
      this.st.add(wd, { shadows: false });
      this.small.push({ w: wd, on: ws.map((x) => x.start), exit, t0, t1, place });
    };
    /** exit just before the next phrase's first word lands */
    const before = (wd: Word) => wd.start - 0.13;
    const centred = (x: number, z: number, cap: number) => (wd: (c: number) => number): Place => ({ x: x - wd(cap) / 2, z, cap, yaw: 0 });

    // A: "What if I'm" centred where WRONG? will stand; "in the" just left of WRONG?, on its line
    const wA = this.heroPose(0);
    small(sl(l9, 'what', 'in'), before(w(l9, 'in')), 46, cAB, centred(X.A, -3.0, 0.28));
    small(sl(l9, 'in', 'wrong'), 1e9, 46, cAB, (wd) => ({ x: wA.x - wA.width / 2 - 0.22 - wd(0.31), z: wA.z + 0.2, cap: 0.31, yaw: 0 }));
    // B: "What if I'm the" left of PROBLEM on its line; "that's been", then "all along?" right of it (read in order)
    const wB = this.heroPose(1);
    const rightOfB = () => ({ x: wB.x + wB.width / 2 + 0.3, z: wB.z, cap: 0.3, yaw: 0 });
    small(sl(l10, 'what', 'problem'), before(w(l10, 'thats')), cAB, cBC, (wd) => ({ x: wB.x - wB.width / 2 - 0.3 - wd(0.3), z: wB.z, cap: 0.3, yaw: 0 }));
    small(sl(l10, 'thats', 'hiding'), before(w(l10, 'all')), cAB, cBC, rightOfB);
    small(sl(l10, 'all'), 1e9, cAB, cBC, rightOfB);
    // C: the phrases stand on the line where GUILT? will stand, over the frieze as its biers come one per word;
    // "I caved to" left of GUILT?
    const wC = this.heroPose(2), onC = centred(X.C, wC.z, 0.46);
    small(sl(l11, 'what', 'im'), before(w(l11, 'im')), cBC, cCD, onC);
    small(sl(l11, 'im', 'killed'), before(w(l11, 'killed')), cBC, cCD, onC);
    small(sl(l11, 'killed', 'every'), before(w(l11, 'every')), cBC, cCD, onC);
    small(sl(l11, 'every', 'i'), before(w(l11, 'i')), cBC, cCD, onC);
    small(sl(l11, 'i', 'guilt'), 1e9, cBC, cCD, (wd) => ({ x: wC.x - wC.width / 2 - 0.25 - wd(0.4), z: wC.z, cap: 0.4, yaw: 0 }));
    // D: the phrases stand on the water near us, below the beam and clear of its words
    const nearD = centred(X.D + 1.65, -9.3, 0.25);
    small(sl(l12, 'what', 'far'), before(w(l12, 'far')), cCD, cDE, nearD);
    small(sl(l12, 'far', 'foes'), before(w(l13, 'but')), cCD, cDE, nearD);
    small(sl(l13, 'but', 'ourselves'), T.ours! - 0.1, cCD, cDE, nearD);
    // E: afloat near us as in hook 1, bobbing on the swell, before the dip
    small(sl(l14, 'what', 'monster'), T.m2! + 0.02, cDE, 1e9, (wd) => ({ x: X.E - wd(VOICE.cap) / 2, z: VOICE.z - 1, cap: VOICE.cap, yaw: 0, amp: 0.012 }));
  }

  /** Where each hero stands (world): centre x, plane z, width (MONSTER?'s comes from the frame, see render). */
  private heroPose(i: number) {
    return [
      { x: X.A + 1.1, z: -4.6, width: 5.6 },
      { x: X.B, z: -6, width: 3.6 },
      { x: X.C + 0.8, z: -6, width: 5.6 },
      { x: (PAN.x0 + PAN.x1) / 2, z: BEAM.z + 0.04, width: 2.3 },
      { x: X.D + 4.15, z: WORD_Z + 0.3, width: 7.3 },
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
    if (t < cCD) {      // C: GUILT? over the frieze, a slow push
      const y = 0.62, z = 4.4 - 0.4 * prog(t, cBC, cCD);
      return { x: X.C, y, z, pitch: pitchFor(y, z, LINE_Y), roll: 0 };
    }
    if (t < cDE) {      // D: the beam: the world tips as FOES' side rises, slamming on the downbeat
      const roll = keys(t, [[T.foes!, 0], [T.foes! + 0.5, 0.07, (u) => ease.outBack(u, 1.8)], [T.small!, 0.07],
        [T.small! + 0.3, 0.1, (u) => ease.outBack(u, 2.2)], [T.ours!, 0.1], [T.ours! + 0.35, 0.14, ease.outCubic],
        [T.slam!, 0.14], [T.slam! + 0.25, 0.21, (u) => ease.outBack(u, 2.2)]]);
      const y = 0.55, z = -5.4;
      return { x: X.D + 2.3, y, z, pitch: pitchFor(y, z, LINE_Y), roll };
    }
    // E: level, then hook 1's dip to the waterline and its slow push
    const u = ease.inOutCubic(prog(t, T.m2! - 0.12, T.m2! + 0.45));
    const y = lerp(0.5, LOW.y, u), z = LOW.z - 0.4 * prog(t, T.m2! + 0.45, this.ctx.end);
    return { x: X.E, y, z, pitch: lerp(pitchFor(0.5, LOW.z, LINE_Y), LOW.pitch, u), roll: 0 };
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

  /** Poses a ".-." prop: a bar from x0 to x1 (bottom at y, height h) and a knob centred on each end (kh tall, kw
   *  wide, its bottom kdy below the bar's), `depth` deep (world). */
  private bar(w: Word3D, x0: number, x1: number, y: number, z: number, h: number, kh: number, kw: number, kdy: number, depth: number, on: boolean) {
    const ls = w.letters, dz = depth / (220 * 0.17);
    const fit = (l: Letter, cx: number, bottom: number, wd: number, ht: number) => {
      const sx = wd / Math.max(1, l.box[2] - l.box[0]), sy = ht / Math.max(1, l.box[3] - l.box[1]);
      l.x = cx - ((l.box[0] + l.box[2]) / 2) * sx; l.y = bottom - l.box[1] * sy; l.z = z; l.yaw = 0; l.hinge = 0; l.s = sy;
      l.on = on ? 1 : 0;
      return [sx, sy] as const;
    };
    const sc = [fit(ls[0]!, x0, y - kdy, kw, kh), fit(ls[1]!, (x0 + x1) / 2, y, x1 - x0, h), fit(ls[2]!, x1, y - kdy, kw, kh)];
    w.update();
    ls.forEach((l, i) => { l.mesh.scale.set(sc[i]![0], sc[i]![1], dz); l.mesh.updateMatrixWorld(true); });
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

    // ---- the bronze beam (D): it rises from the water just before FOES lands in its pan
    const beamUp = setup === 3 ? ease.outCubic(prog(t, T.foes! - 0.6, T.foes! - 0.1)) : 0;
    const by = -0.6 * (1 - beamUp), beamOn = setup === 3 && t >= T.foes! - 0.6;
    this.bar(this.beam, BEAM.x0, BEAM.x1, by, BEAM.z, BEAM.h, BEAM.knob, BEAM.knobW, (BEAM.knob - BEAM.h) / 2, BEAM.depth, beamOn);
    this.bar(this.pan, PAN.x0, PAN.x1, by + BEAM.h, BEAM.z, PAN.h, PAN.lip, PAN.lipW, 0, BEAM.depth, beamOn);
    u.beamX!.value.set(BEAM.x0, BEAM.x1, beamUp);

    // ---- the heroes: where each stands, its scale, how far it is sunk (world), and its twin under the surface
    type Pose = { h: Hero; x: number; z: number; width: number; sink: number };
    const sW = (h: Hero, width: number) => width / h.w.width;
    const hs = [H.wrong, H.problem, H.guilt, H.foes, H.ours, H.monster];
    const poses: Pose[] = hs.map((h, i) => ({ h, ...this.heroPose(i), sink: 0 }));
    poses[5]!.width = BIG_W * fw(WORD_Z);
    const cap = (p: Pose) => p.h.w.cap * sW(p.h, p.width);
    // WRONG? sinks to its waist on the next two hits; FOES stands in its pan on the beam; OURSELVES? lands low and
    // sinks as the beam slams
    const hA = audio.timeOfBeat(Math.round(audio.beatAt(T.wrong!)) + 0.5), hB = audio.timeOfBeat(Math.round(audio.beatAt(T.wrong!)) + 1);
    poses[0]!.sink = cap(poses[0]!) * keys(t, [[hA - 0.02, 0], [hA + 0.1, 0.27, (v) => ease.outBack(v, 1.6)], [hB - 0.02, 0.27], [hB + 0.1, 0.5, (v) => ease.outBack(v, 1.6)]]);
    poses[3]!.sink = -(by + BEAM.h + PAN.h);
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

    // the post (the fulcrum, lit type: a stretched "I") rises from the water at the centre of the beam
    const pl = this.post.letters[0]!;
    const pW = 0.3 / Math.max(1, pl.box[2] - pl.box[0]);
    const rise = ease.outCubic(prog(t, T.foes! - 0.3, T.foes! + 0.4));
    const px = X.D;
    this.run(this.post, px, WORD_Z + 0.25, pW, -0.4, () => 0, setup === 3 && t >= T.foes! - 0.3);
    pl.x = px - (pl.box[0] + pl.box[2]) / 2 * pW;
    this.post.update();
    const pk = (1.6 * rise + 0.4) / (this.post.cap * pW);
    pl.mesh.scale.y = pW * pk; pl.mesh.updateMatrixWorld(true);

    // ---- the small words
    for (const sm of this.small) {
      const p = sm.place((cp) => sm.w.width * cp / sm.w.cap, c);
      const sc = p.cap / sm.w.cap;
      const cx = Math.cos(p.yaw), cz = -Math.sin(p.yaw);
      popWords(sm.w, sm.on, t, (l: Letter) => {
        l.x = p.x + cx * l.penX * sc; l.z = p.z + cz * l.penX * sc; l.yaw = p.yaw; l.s = sc;
        l.y = p.amp ? p.amp * Math.sin(t * 2.1 + l.penX * 0.004 + p.z) : 0;
      }, { exit: sm.exit, exitDur: 0.08, exitRipple: 0 });
      if (t < sm.t0 || t >= sm.t1) for (const l of sm.w.letters) l.on = 0;
      hideFlat(sm.w);
    }

    // ---- the crowd of the dead on the far shore (world space, fixed per stretch of shore): one at WRONG?, more on
    // every beat, a dense crowd from FOES on
    const beatT = audio.timeOfBeat(Math.floor(audio.beatAt(t) + 1e-4));
    const lin = (v: number) => v;
    const nDead = Math.floor(keys(beatT, [[T.wrong!, 1], [T.problem!, 5, lin], [T.along! + 0.6, 10, lin], [T.killed!, 12, lin],
      [T.guilt!, 26, lin], [T.foes!, 28, lin], [T.foes! + 0.6, 300, lin]]) + 1e-6);
    const crowdH = 0.5, cells = 130;
    u.crowdH!.value = crowdH; u.crowdPx!.value = 1 / pxAt(c.x, SHORE.z);
    u.crowdOne!.value = t >= T.wrong! - 0.02 ? 1 : 0;
    u.crowdD!.value = nDead >= 299 ? 0.95 : Math.max(0, nDead - 1) / cells;
    u.crowdX!.value = [X.A + 11.15, X.B + 0.37, X.C + 0.37, X.D + 0.37, X.E + 0.37][setup]!;
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
      const p = poses[0]!;
      const k = field(0, p.x, p.z, p.width * 0.66, cap(p) * 0.5 + 0.62, develop(hA - 0.02));
      fB[0]!.set((cap(p) * 0.5 + 0.12) * k, 0.24 * k, 2, -1);
    } else if (setup === 1) {
      const p = poses[1]!, gap = 0.08 * cap(p);
      const aw = p.width * 3, deep = this.ans.hiding.cap * (aw / this.ans.hiding.width);
      const k = field(0, p.x, p.z, aw * 0.58, deep + gap + 0.75, develop(T.hiding! - 0.05));
      fB[0]!.set((deep + gap + 0.15) * k, 0.32 * k, 1, -1);
    } else if (setup === 2) {
      // a meander band, the frieze (one bier per word from "killed" to "caved"), a second band; to the frame's foot
      const p = poses[2]!, d = develop(T.killed! - 0.15);
      const k = field(0, X.C, p.z, 7.9, 4.3, 1);
      fA[0]!.z *= d;
      fB[0]!.set(0.11 * k, 0.32 * k, 1, 2.68 * k);
      (u.frz!.value as THREE.Vector4).set(0.53 * k, 2.05 * k, this.bierOn.reduce((s, on) => s + prog(t, on - 0.03, on + 0.15), 0), d);
    } else if (setup === 3) {
      // a soft band pinned to the water under the beam; the black-figure pan with his men under OURSELVES?
      const p = poses[4]!, d = develop(T.ours! + 0.1), cx = (BEAM.x0 + BEAM.x1) / 2;
      const ps = 0.07 * p.width, depth = Math.max(0, p.sink) + 0.15 + 2.2 * ps + 0.45;
      const k = field(1, cx, BEAM.z, (BEAM.x1 - BEAM.x0) / 2 + 0.3, depth, d);
      (u.pan!.value as THREE.Vector4).set((p.x - cx) * k, (Math.max(0, p.sink) + 0.12 + 1.72 * ps) * k, ps * k, d);
    } else {
      const an = proj(X.E, -0.02, WORD_Z);
      const k = field(2, X.E, WORD_Z, 0.62 * fw(WORD_Z), 1, 1);
      fA[2]!.set(an.x, an.y, fA[2]!.z * develop(T.m2! + 0.05), an.y + 80);
      void k;
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
          // the answer risen from the deep, wider than the frame, just under the surface
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
