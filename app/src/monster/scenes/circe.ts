// `circe` — verse 2, lines 19–22 (docs/verse2-plan.md, "the bottom of the cup"):
//   "When the witch turns men to pigs to protect her nymphs, / is she going insane? /
//    Or did she learn to be colder when she got older, / and now she saves them the pain?"
// Open on Circe's shadow at her cup, as in the opening (figures.ts), her eye opening on us; on "witch" we are above
// the cup itself: her kylix from high above, its potion a black mirror, wine-dark; her staff's shadow lies across it
// and stirs on the snare. MEN floats on the potion; on "pigs" it folds into the surface and PIGS comes up in its place.
// "Insane?": the potion turns into a vortex, INSANE? rides round it and the camera rolls with it, the reflections smear
// round. "Or": the swirl stops dead, the surface goes glassy; COLDER stands; on "older" its C tips over and sinks and
// the rest closes up: OLDER. "Saves them the pain?": the potion drains, sinking down the black inside of the cup, and
// the tondo at its bottom is revealed (her answer: the nymphs she shelters, hand in hand in a ring dance); PAIN?
// stands on the rim.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { clamp, ease, keys, lerp, noise1, prog, pulse } from '../../engine/util';
import { GLSL_FIGURES } from '../figures';
import { POP, Stage, Word3D, keyLight, popHinge, popHingeBy, popWords, type Letter } from '../stage';
import { CUP, CupStage, FULL } from './circe-cup';

// ---------------------------------------------------------------- the open: her shadow at the cup (the opening's)
const OPEN_HOOKS = GLSL_FIGURES + /* glsl */ `
uniform vec4 figT;
uniform float figK, figAct;
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) {
  if (!wall) return 0.0;
  vec2 q = (P.xy - figT.xy) / figT.z;
  if (abs(q.x) > 13.0 || q.y > 10.5 || q.y < -1.0) return 0.0;
  float d = circe(q, figK, figT.w, figAct) * figT.z;
  float w = max(gPix * 0.75, 0.01);
  return 1.0 - smoothstep(-w, w, d);
}
vec3 skyTint(vec3 D, vec3 col) { return col; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return col; }`;
/** As in `everything`: the fire behind us (world), its reach, the wall; Circe's place and scale there. */
const FIRE = new THREE.Vector3(2.8, 2.8, 15.5), REACH = 40, WALL_Z = -10.6, FIG = { x: 0.2, s: 1.18 };

/** The faces: hero (Archivo 75/900, as CHANGE?) and the small voice (Archivo 112.5/600). */
const HERO = () => F.archivo(75, 900), VOICE3D = () => F.archivo(112.5, 600);
/** Small type's cap height on the potion (world). */
const SMALL = 0.26;
/** A world direction on the potion for an angle a (0: -z, screen-up when the camera's roll is 0; +pi/2: +x). */
const dir = (a: number) => ({ x: Math.sin(a), z: -Math.cos(a) });

type Pop = { exit?: number; exitDur?: number; ripple?: number; sink?: boolean; upBy?: (number | undefined)[] };

export default class Circe extends Scene {
  private open = new Stage({
    hooks: OPEN_HOOKS,
    uniforms: { figT: { value: new THREE.Vector4(FIG.x, 0, FIG.s, 0) }, figK: { value: 0 }, figAct: { value: 0 } },
  });
  private cup = new CupStage();
  private l1!: Line;
  private l2!: Line;
  private l3!: Line;
  private l4!: Line;
  /** Words of the open (on the cave floor) and of the cup. */
  private whenThe!: Word3D;
  private sA!: Word3D;
  private men!: Word3D;
  private to1!: Word3D;
  private pigs!: Word3D;
  private sB!: Word3D;
  private sC!: Word3D;
  private insane!: Word3D;
  private sD!: Word3D;
  private sE!: Word3D;
  private sF!: Word3D;
  private colder!: Word3D;
  private sG!: Word3D;
  private sH!: Word3D;
  private pain!: Word3D;
  private snares: number[] = [];
  private orch: number[] = [];
  /** The cut from the open to the cup: as "witch" springs up. */
  private cut = 79.955;

  override async init() {
    const ly = this.ctx.lyrics, au = this.ctx.audio;
    this.l1 = ly.get('When the witch');
    this.l2 = ly.get('is she going');
    this.l3 = ly.get('Or did she learn');
    this.l4 = ly.get('and now she saves');
    const j = (l: Line, a: number, b: number) => l.words.slice(a, b).map((w) => w.w).join(' ');
    const small = (s: string) => new Word3D(s, VOICE3D(), { size: 200 });
    const hero = (s: string) => new Word3D(s, HERO(), { size: 220 });
    this.whenThe = small(j(this.l1, 0, 2));
    this.open.add(this.whenThe, { shadows: false });
    this.sA = small(j(this.l1, 0, 4));
    this.men = hero('MEN');
    this.to1 = small(this.l1.words[5]!.w);
    this.pigs = hero('PIGS');
    this.sB = small(j(this.l1, 7, 11).replace(/,$/, ''));
    this.sC = small(j(this.l2, 0, 3));
    this.insane = hero('INSANE?');
    this.sD = small(j(this.l3, 0, 4));
    this.sE = small(j(this.l3, 4, 6));
    this.sF = small(j(this.l3, 7, 10));
    this.colder = hero('COLDER');
    this.sG = small(j(this.l4, 0, 3));
    this.sH = small(j(this.l4, 3, 6));
    this.pain = hero('PAIN?');
    for (const w of [this.sA, this.to1, this.sB, this.sC, this.sD, this.sE, this.sF, this.sG, this.sH]) this.cup.add(w);
    // (hero words on the potion have no mirror image of themselves: client, chorus 1)
    for (const w of [this.men, this.pigs, this.insane, this.colder, this.pain]) this.cup.add(w, { mirror: false });
    const T0 = this.ctx.start, T1 = this.ctx.end;
    this.snares = au.events('snare', T0, T1).map(([t]) => t);
    this.orch = au.events('orch', T0, T1).map(([t]) => t);
    this.cut = this.l1.words[2]!.start - POP.lead;
  }

  private w(l: Line, s: string, nth = 0): Word {
    return l.words.filter((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)[nth]!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    return f.t < this.cut ? this.renderOpen(f, out) : this.renderCup(f, out);
  }

  // ---------------------------------------------------------------- the open
  private renderOpen(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, T0 = this.ctx.start;
    const [when, the] = this.l1.words as [Word, Word];
    const st = this.open, u = st.bg.u;
    // her shadow at the cup, the man on all fours at it; her eye opens on us as "When" is sung; a puppet's sway
    const look = prog(t, when.start - 0.02, when.start + 0.18, ease.outBack);
    (u.figT!.value as THREE.Vector4).set(FIG.x + 0.03 * noise1(t * 5.3, 43), 0.04 * Math.sin(Math.PI * prog(t, T0, this.cut)), FIG.s, clamp(look, 0, 1.2));
    u.figK!.value = 0; u.figAct!.value = 0;
    // the camera: a push toward the cup on the wall, tilting down to it into the cut
    const k = prog(t, T0, this.cut, ease.inOutQuad);
    const pos = new THREE.Vector3(0.15 * k, lerp(3.5, 3.0, k), lerp(7.4, 5.4, k));
    const at = new THREE.Vector3(lerp(0, -0.8, k), lerp(4.0, 2.6, prog(t, T0 + 0.2, this.cut, ease.inCubic)), WALL_Z);
    st.cam.set(pos, at, 40);
    // "When the" stands on the floor before the wall
    const s = 0.5 / this.whenThe.cap, wd = this.whenThe.width * s;
    popWords(this.whenThe, [when.start, the.start], t, (l: Letter) => { l.x = -wd / 2 + l.penX * s - 0.6; l.z = -6.5; l.y = 0; l.yaw = 0; l.s = s; });
    const fl = keyLight(st.cam, this.ctx.audio, t, { seed: 7 });
    const L = { base: FIRE, h: 0.6, I: 2.4 * fl.I, reach: REACH };
    st.render(this.ctx.renderer, out, t, L, { wall: 1, wallZ: WALL_Z }, { noFlame: true, cards: false, reflect: true, rim: 0.6, spec: 0.05 });
    return { bloom: 0.55, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3 };
  }

  // ---------------------------------------------------------------- the cup
  /** The vortex's turn (radians) at t: it spins up on "insane", and stops dead on "Or". */
  private omega(t: number) {
    const ins = this.w(this.l2, 'insane'), or = this.l3.words[0]!;
    const a = ins.start - 0.06, b = ins.start + 0.35, w0 = 3.2;
    const tt = Math.min(t, or.start);
    if (tt <= a) return 0;
    if (tt <= b) return (w0 * (tt - a) * (tt - a)) / (2 * (b - a));
    return w0 * ((b - a) / 2 + (tt - b));
  }

  private renderCup(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, T1 = this.ctx.end, { renderer, audio } = this.ctx;
    const W1 = this.l1.words, W2 = this.l2.words, W3 = this.l3.words, W4 = this.l4.words;
    const men = this.w(this.l1, 'men'), pigs = this.w(this.l1, 'pigs'), nymphs = this.w(this.l1, 'nymphs');
    const ins = this.w(this.l2, 'insane'), or = W3[0]!, colder = this.w(this.l3, 'colder'), older = this.w(this.l3, 'older');
    const saves = this.w(this.l4, 'saves'), pain = this.w(this.l4, 'pain');
    const bar2 = audio.timeOfBeat(Math.ceil(audio.beatAt(nymphs.start)));          // 82.69: up over the cup
    const bar3 = audio.timeOfBeat(Math.ceil(audio.beatAt(or.start + 0.05)));       // 85.35
    const bar4 = audio.timeOfBeat(Math.ceil(audio.beatAt(older.end)));             // 88.02
    const orchD = this.orch.filter((x) => x >= bar4 - 0.05);                       // the three hits of the last bar
    const Om = this.omega(t), stopped = t >= or.start;
    const stopJolt = pulse(t, or.start, 0.07) * (stopped ? 1 : 0);

    // ---- the potion's level: it drains on the last bar's hits, and all the way on "pain"
    const h1 = orchD[1] ?? bar4 + 0.3, h2 = orchD[2] ?? bar4 + 0.63;
    const sn4 = this.snares.filter((x) => x > h2 + 0.05 && x < pain.start - 0.1)[0] ?? h2 + 0.18;
    const level = keys(t, [[h1 - 0.02, FULL], [h1 + 0.2, -0.3, ease.outCubic], [h2 - 0.02, -0.32, ease.linear], [h2 + 0.2, -0.46, ease.outCubic],
      [sn4, -0.48, ease.linear], [sn4 + 0.18, -0.57, ease.outCubic], [pain.start - 0.03, -0.59, ease.linear], [pain.start + 0.06, -0.67, ease.inQuad], [pain.start + 0.42, -CUP.D - 0.06, ease.linear]]);

    // ---- the camera: high over the cup; it comes down a little for the words, up overhead for the vortex (rolling
    // with INSANE?), stops dead on "Or", leans in for COLDER, and rises over the empty cup at the end
    const c0 = this.cut;
    const el = keys(t, [[c0, 1.42], [men.start - 0.05, 1.12, ease.inOutCubic], [bar2, 1.08, ease.linear], [ins.start - 0.05, 1.5, ease.inOutCubic],
      [bar3, 1.5, ease.linear], [colder.start - 0.03, 1.08, ease.inOutCubic], [bar4, 1.04, ease.linear], [pain.start + 0.05, 1.12, ease.inOutCubic], [T1, 1.14, ease.linear]]);
    const dist = keys(t, [[c0, 10.2], [men.start - 0.05, 8.6, ease.inOutCubic], [bar2, 8.3, ease.linear], [ins.start - 0.05, 8.5, ease.inOutCubic],
      [bar3, 8.5, ease.linear], [colder.start - 0.03, 8.2, ease.inOutCubic], [bar4, 7.9, ease.linear], [pain.start + 0.05, 7.0, ease.inOutCubic], [T1, 6.8, ease.linear]]);
    const atZ = keys(t, [[c0, 0.3], [men.start, 0.35], [bar2, 0.35], [ins.start - 0.05, -0.6, ease.inOutCubic], [bar3, -0.6], [colder.start, 0.3, ease.inOutCubic],
      [bar4, 0.3], [pain.start + 0.05, 1.45, ease.inOutCubic]]);
    const atY = Math.max(level, -0.5) * 0.6 + FULL * 0.4;
    // the roll: the vortex's turn while it spins (the camera turns with the letters), a jolt on the stop
    const rho = -Om + 0.06 * stopJolt;
    const hd = dir(rho), back = { x: -hd.x, z: -hd.z };
    const at = new THREE.Vector3(back.x * atZ, atY, back.z * atZ);
    // impacts: on PIGS, on the C's fall
    const jolt = pulse(t, pigs.start, 0.08) * (t >= pigs.start ? 1 : 0) + 0.7 * pulse(t, older.start, 0.08) * (t >= older.start ? 1 : 0);
    const pos = new THREE.Vector3(at.x + back.x * dist * Math.cos(el), at.y + dist * Math.sin(el), at.z + back.z * dist * Math.cos(el));
    pos.x += 0.04 * jolt * noise1(t * 40, 3); pos.z += 0.04 * jolt * noise1(t * 40, 5);
    const up = new THREE.Vector3(hd.x, 0, hd.z);
    this.cup.cam.set(pos, at, 40, 0, up);
    const cam = this.cup.cam.cam.position;

    // ---- the letters
    const lean = (x: number, z: number, y: number) => clamp(Math.atan2(cam.y - y, Math.hypot(cam.x - x, cam.z - z)) - 0.12, 0, 1.38);
    const psi = -rho;
    /** A straight row centred at (cx, cz), facing the camera, cap height capW (world); y on the potion. */
    const rowAt = (w: Word3D, cx: number, cz: number, capW: number, close?: (l: Letter) => number) => {
      const s = capW / w.cap, dx = Math.cos(psi), dz = -Math.sin(psi);
      return (l: Letter) => {
        const xl = (close ? close(l) : l.penX - w.width / 2) * s;
        l.x = cx + dx * xl; l.z = cz + dz * xl; l.yaw = psi; l.s = s;
      };
    };
    /** Width-fitted cap height for a hero (world width wW). */
    const fit = (w: Word3D, wW: number) => (wW / w.width) * w.cap;
    const small = (k: number) => ({ x: back.x * k, z: back.z * k });
    const pS = small(1.9 - 0.5 * clamp((el - 1.15) / 0.3)), pH = small(0.75);
    const lv = level;
    /** Pops a run on the potion: each word comes up out of it on its onset (from flat, rising through the surface), and
     *  on `exit` folds flat and sinks. */
    const cupPop = (w: Word3D, onsets: number[], place: (l: Letter) => void, o: Pop = {}) => {
      const exit = o.exit ?? 1e9, dur = o.exitDur ?? 0.2, rip = o.ripple ?? 0;
      const kIn = new Map<number, number>();
      for (const l of w.letters) {
        place(l);
        const k = kIn.get(l.word) ?? 0;
        kIn.set(l.word, k + 1);
        const on = onsets[Math.min(l.word, onsets.length - 1)]!;
        const by = o.upBy?.[Math.min(l.word, o.upBy.length - 1)];
        const ph = by !== undefined ? popHingeBy(t, on, k, by) : popHinge(t, on, k);
        const uu = 1 - ph / (Math.PI / 2);
        const gone = prog(t, exit + k * rip, exit + k * rip + dur, o.sink ? ease.linear : ease.inOutQuad);
        const capW = w.cap * l.s;
        const ln = lean(l.x, l.z, lv);
        const h = ln + (Math.PI / 2 - ln) * (1 - uu);
        l.hinge = h + (Math.PI / 2 + 0.05 - h) * gone * (o.sink ? 0.5 : 1);
        const bob = 0.02 * Math.sin(t * 2.3 + l.x * 1.7 + l.z);
        l.y = lv + bob * (stopped ? 0.2 : 1) * (1 - gone) - capW * 0.55 * (1 - Math.min(uu, 1)) - capW * (o.sink ? 1.05 * Math.max(0.3, Math.cos(h)) * gone : 0.7 * Math.max(0, (gone - 0.55) / 0.45));
        l.on = t >= on - POP.lead + k * POP.ripple && t < exit + k * rip + dur && ph <= 0.75 ? 1 : 0;   // (hideFlat)
        l.mat.uniforms.glow!.value = 0.3 * Math.pow(0.5, Math.max(0, t - on) / 0.08) * (t >= on - 0.02 ? 1 : 0) * l.on;
      }
      w.update();
    };

    // line 1: "When the witch turns" | MEN "to" -> PIGS | "to protect her nymphs"
    cupPop(this.sA, W1.slice(0, 4).map((x) => x.start), rowAt(this.sA, pS.x, pS.z, SMALL), { exit: men.start - POP.lead - 0.02, exitDur: 0.12 });
    const menCap = fit(this.pigs, 4.6), heroX = pH.x, heroZ = pH.z;
    cupPop(this.men, [men.start], rowAt(this.men, heroX, heroZ, menCap), { exit: pigs.start - 0.15, exitDur: 0.15, sink: true });
    cupPop(this.to1, [W1[5]!.start], rowAt(this.to1, pS.x, pS.z, SMALL), { exit: W1[7]!.start - POP.lead - 0.06, exitDur: 0.1 });
    cupPop(this.pigs, [pigs.start], rowAt(this.pigs, heroX, heroZ, menCap), { exit: W1[8]!.start - 0.18, exitDur: 0.16, sink: true });   // gone as "protect" comes
    cupPop(this.sB, W1.slice(7, 11).map((x) => x.start), rowAt(this.sB, pS.x, pS.z, SMALL), { exit: W2[0]!.start - POP.lead - 0.18, exitDur: 0.16, sink: true });
    // line 2: "is she going" | INSANE? round the vortex
    cupPop(this.sC, W2.slice(0, 3).map((x) => x.start), rowAt(this.sC, pS.x, pS.z, SMALL), { exit: ins.start - 0.02, exitDur: 0.12 });
    {
      const w = this.insane, capW = 0.95, s = capW / w.cap, RA = 1.75;
      const tipT = this.ctx.audio.timeOfBeat(Math.floor(this.ctx.audio.beatAt(or.start)));   // the beat before "Or": INSANE? goes under
      cupPop(w, [ins.start], (l) => {
        const al = -Om + ((l.penX - w.width / 2) * s) / RA;
        const p = dir(al);
        l.x = RA * p.x; l.z = RA * p.z; l.yaw = -al; l.s = s;
      }, { exit: Math.min(tipT, or.start - 0.15), exitDur: 0.14 });
    }
    // line 3: "Or did she learn" | "to be" COLDER | "when she got" | OLDER (the C drops away)
    // ("learn" is short: its pop is up within min(0.12 s, its sung length), the frame checker's SLOW-RISE)
    cupPop(this.sD, W3.slice(0, 4).map((x) => x.start), rowAt(this.sD, pS.x, pS.z, SMALL), { exit: W3[4]!.start - POP.lead - 0.06, exitDur: 0.12,
      upBy: W3.slice(0, 4).map((x) => (x === this.w(this.l3, 'learn') ? Math.min(0.12, x.end - x.start) : undefined)) });
    cupPop(this.sE, W3.slice(4, 6).map((x) => x.start), rowAt(this.sE, pS.x, pS.z, SMALL), { exit: W3[7]!.start - POP.lead - 0.06, exitDur: 0.12 });
    cupPop(this.sF, W3.slice(7, 10).map((x) => x.start), rowAt(this.sF, pS.x, pS.z, SMALL), { exit: older.start - 0.02, exitDur: 0.12 });
    {
      const w = this.colder, L = w.letters, capW = fit(w, 5.2);
      const cC = (L[0]!.penX + L[L.length - 1]!.penX) / 2, cO = (L[1]!.penX + L[L.length - 1]!.penX) / 2;
      const close = prog(t, older.start - 0.02, older.start + 0.22, ease.outCubic);
      const exitO = W4[0]!.start - 0.16;
      cupPop(w, [colder.start], rowAt(w, heroX, heroZ, capW, (l) => l.penX - lerp(cC, cO, close)), { exit: exitO, exitDur: 0.14 });
      // the C: on "older" it tips over backward and goes under
      const c = L[0]!, tip = prog(t, older.start - 0.02, older.start + 0.2, ease.inOutQuad);
      if (t >= older.start - 0.02) {
        // it tips over backward about its baseline, face up (still a C from up here), its top dipping into the
        // potion, and goes under top first
        c.hinge = lerp(c.hinge, Math.PI / 2 + 0.22, tip);
        c.y = lv - capW * 0.55 * prog(t, older.start + 0.06, older.start + 0.32, ease.inQuad);
        c.on = t < older.start + 0.32 ? 1 : 0;
        c.mat.uniforms.glow!.value = 0;
      }
      w.update();
    }
    // line 4: "and now she" | "saves them the" (they go down with the potion) | PAIN? on the rim
    cupPop(this.sG, W4.slice(0, 3).map((x) => x.start), rowAt(this.sG, pS.x * 0.6, pS.z * 0.6, SMALL), { exit: saves.start - POP.lead - 0.06, exitDur: 0.12 });
    cupPop(this.sH, W4.slice(3, 6).map((x) => x.start), rowAt(this.sH, pS.x * 0.4, pS.z * 0.4, SMALL), { exit: pain.start - 0.08, exitDur: 0.1 });
    {
      const w = this.pain, capW = 0.62, s = capW / w.cap, RR = (CUP.RI + CUP.RO) / 2 + 0.02;
      const a0 = Math.PI - rho;
      popWords(w, [pain.start], t, (l) => {
        const a = a0 + ((l.penX - w.width / 2) * s) / RR;
        const p = dir(-a);
        l.x = RR * p.x; l.z = RR * p.z; l.y = 0; l.yaw = a + Math.PI; l.s = s;
      }, { glow: 0.5 });
      for (const l of w.letters) {
        const ln = lean(l.x, l.z, 0) - 0.15;
        l.hinge = ln + l.hinge * (1 - ln / (Math.PI / 2));
      }
      w.update();
    }

    // ---- the staff's shadow: it lies across the cup from beyond the rim, its tip in the potion, and stirs on each
    // snare; in the vortex it drives the swirl round; it is still after "Or" and lifts away as the potion drains
    const stirs = this.snares.filter((x) => x < or.start - 0.05);
    let n = 0;
    for (const x of stirs) n += prog(t, x - 0.02, x + 0.07, ease.outCubic);
    const phi = 0.4 + 0.62 * n - 1.15 * Om;
    const lift = prog(t, h1 - 0.1, pain.start, ease.inOutCubic);
    const tipR = 0.85 + 2.8 * lift;
    const butt = { x: 4.5 + 0.2 * Math.cos(phi), z: -2.9 + 0.2 * Math.sin(phi) };
    const tip = { x: tipR * Math.cos(phi) * 0.8 + 0.35 + 2.0 * lift, z: tipR * Math.sin(phi) * 0.8 - 0.25 - 1.0 * lift };
    // ---- rings on the potion: each stir at the staff's tip; letters going in and coming out; the drain
    const rips: [number, number, number, number][] = [];
    for (const x of stirs) {
      const nn = stirs.filter((y) => y <= x).length;
      const ph = 0.4 + 0.62 * nn - 1.15 * this.omega(x);
      rips.push([0.85 * Math.cos(ph) * 0.8 + 0.35, 0.85 * Math.sin(ph) * 0.8 - 0.25, x, 0.35 * (1 - prog(t, or.start, or.start + 0.1))]);
    }
    rips.push([heroX, heroZ, pigs.start - 0.05, 0.9], [heroX, heroZ, men.start, 0.4]);
    const cl = this.colder.letters[0]!;
    rips.push([cl.x, cl.z, older.start + 0.05, 0.9]);
    for (const x of [h1, h2, sn4, pain.start]) rips.push([0, 0, x + 0.05, 0.5]);

    // ---- the vortex
    const swirl = stopped ? 0 : prog(t, ins.start - 0.08, ins.start + 0.3, ease.outCubic);
    // ---- the fire behind us (flares on the 'orch' hits)
    const L = keyLight(this.cup.cam, audio, t, { seed: 11, I: 1.55 * (1 + 0.25 * stopJolt), reach: 30, right: 2.2, up: 1.5, back: 2.5 });
    this.cup.render(renderer, out, t, L, {
      level, wine: 0.35, gloss: 0.7, mirror: false, swell: stopped ? 0 : 0.35, reflBend: 0.05, spec: 0.05, swirl, swirlT: Om,
      staff: [butt.x, butt.z, tip.x, tip.z], staffOn: 1 - prog(t, pain.start - 0.1, pain.start + 0.25), rips, tondoRot: -this.omega(T1), dancePh: 2.5 * t,
    });
    return { bloom: 0.55, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3, shake: [0, 0.004 * jolt] };
  }
}
