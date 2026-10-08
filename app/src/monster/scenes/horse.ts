// `horse` — verse 2, lines 27–30 (docs/verse2-plan.md "horse"). Heroes: TROJANS, VILE?, REMORSE, GUILE? (VILE re-lettered).
//  - Open (to the first downbeat): outside Troy's wall at night, the wooden horse's shadow on the clay, the city's
//    lamps in the windows; the camera pushes toward the horse's open hatch and cuts inside on the downbeat.
//  - Inside: a clay barrel vault (planks, glazed ribs), black-glaze floor with a hatch, the horse's chest at the far end
//    with gaps onto the night city. Soldiers are shadows on the walls (cast by no one), standing up on the snares.
//  - Line 27: the lamps beyond the gaps go out one by one on the snares; TROJANS stands at frame scale.
//  - Line 28: VILE? stands in the same place.
//  - Line 29 ("Or"): the camera rises over the hatch; it drops open on the "throw" onset; REMORSE stands at its edge,
//    tips back into it and falls away to the ground far below (lit only where our light comes through the hole).
//  - Line 30: VILE? stands again (orch hit) and re-letters from "lives": V folds down, U folds up, G slides in, so the
//    word is GUILE? by its onset; the soldiers' shadows file toward the hatch and go down through it.
// GUILE? is sung past the cut to hook 2 (110.021): the re-lettering starts early (see the plan's note).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, mulberry32, noise1, prog, pulse } from '../../engine/util';
import { POP, Word3D, keyLight, popHinge, popWords, vkeys, type Letter } from '../stage';
import { HatchDoor, HorseStage, NL, NR } from './horse-stage';

/** The vault (radius, axis height), the chest's z, the ground under the hatch, the hatch (half-width, near z, far z). */
const BAR = { R: 2.7, yc: 1.1 }, END_Z = -8.0, GROUND_Y = -6.5, HATCH = { hx: 1.95, zN: -2.0, zF: -3.7 };
/** Where the heroes stand; where the small phrases stand (before the hatch, and beyond it once it is open). */
const HERO_Z = -5.4, SMALL_Z = -3.0, FAR_Z = -4.25, SMALL_CAP = 0.32;
/** Outside: Troy's wall (z, top), the horse's shadow (x, scale). */
const TROY = { z: -8, top: 7.6 }, HORSE = { x: -0.4, s: 1.0 };
const FOV = 40;

type Phrase = { w: Word3D; on: number[]; exit: number; x: number; z: number; cap: number };

export default class Horse extends Scene {
  private st = new HorseStage(16);
  private door = new HatchDoor(HATCH.hx, HATCH.zN, HATCH.zF);
  private l1!: Line; private l2!: Line; private l3!: Line; private l4!: Line;
  private trojans!: Word3D; private vile!: Word3D; private guile!: Word3D; private remorse!: Word3D;
  private phrases: Phrase[] = [];
  private snares: number[] = [];
  private lampOut: number[] = [];
  private tTip = 108.33;
  private tRe = 109.01;

  override async init() {
    const { lyrics, audio } = this.ctx;
    this.l1 = lyrics.get('Does a soldier');
    this.l2 = lyrics.get('cause he is');
    this.l3 = lyrics.get('Or does he throw');
    this.l4 = lyrics.get('and save more lives');
    const hero = F.archivo(75, 900), voice = F.archivo(112.5, 600);
    this.trojans = new Word3D('TROJANS', hero, { size: 220 });
    this.vile = new Word3D('VILE?', hero, { size: 220 });
    this.guile = new Word3D('GUILE?', hero, { size: 220 });
    this.remorse = new Word3D('REMORSE', hero, { size: 220 });
    for (const w of [this.trojans, this.vile, this.guile, this.remorse]) this.st.add(w);
    this.st.scene.add(this.door.pivot, this.door.occluder);

    // the small phrases (1–4 words), each leaving as the next one starts
    const T1 = this.ctx.end;
    const mk = (line: Line, a: number, b: number, exit: number, x: number, z: number) => {
      const ws = line.words.slice(a, b);
      const w = new Word3D(ws.map((x) => x.w).join(' '), voice, { size: 200 });
      this.st.add(w, { shadows: false });
      this.phrases.push({ w, on: ws.map((x) => x.start), exit, x, z, cap: SMALL_CAP });
    };
    const ix = (l: Line, s: string) => l.words.findIndex((w) => w.w.toLowerCase().replace(/[^a-z]/g, '') === s);
    const w1 = this.l1.words, w2 = this.l2.words, w3 = this.l3.words, w4 = this.l4.words;
    const iSol = ix(this.l1, 'soldier'), iWood = ix(this.l1, 'wooden'), iTo = ix(this.l1, 'to'), iTro = ix(this.l1, 'trojans');
    const iThrow = ix(this.l3, 'throw'), iRem = ix(this.l3, 'remorse');
    const iLives = ix(this.l4, 'lives'), iGuile = ix(this.l4, 'guile');
    const hand = (w: Word) => w.start - POP.lead - 0.02;
    mk(this.l1, 0, iSol, T1 + 1, -2.9, -5.0);   // outside: gone at the cut
    this.phrases[0]!.cap = 0.5;
    mk(this.l1, iSol, iWood, hand(w1[iWood]!), 0, SMALL_Z);
    mk(this.l1, iWood, iTo, hand(w1[iTo]!), 0, SMALL_Z);
    mk(this.l1, iTo, iTro, hand(w1[iTro]!), 0, SMALL_Z);
    mk(this.l2, 0, w2.length - 1, hand(w2[w2.length - 1]!), 0, SMALL_Z);
    mk(this.l3, 0, iThrow, hand(w3[iThrow]!), 0, FAR_Z);
    mk(this.l3, iThrow, iRem, hand(w3[iRem]!), 0, FAR_Z);
    mk(this.l4, 0, iLives, hand(w4[iLives]!), 0, FAR_Z);
    mk(this.l4, iLives, iGuile, T1 + 1, 0, -3.95);
    this.phrases[this.phrases.length - 1]!.cap = 0.22;

    this.snares = audio.events('snare', this.ctx.start - 0.1, T1).map(([t]) => t);
    // the lamps go out on the snares from "kill" until VILE?
    const kill = w1[ix(this.l1, 'kill')]!, vileW = w2[w2.length - 1]!;
    this.lampOut = this.snares.filter((t) => t >= kill.start - 0.25 && t < vileW.start).slice(0, NL);
    const rem = w3[iRem]!;
    this.tTip = audio.events('snare', rem.start + 0.35, rem.start + 0.9).map(([t]) => t)[0] ?? rem.end;
    this.tRe = audio.events('orch', rem.end + 0.3, w4[iLives]!.start).map(([t]) => t)[0] ?? w4[iLives]!.start - 0.15;

    // lamp positions in the gaps (deterministic), each going out in a shuffled order
    const r = mulberry32(31);
    const u = this.st.bg.u;
    const n = this.lampOut.length;
    const gy = [2.1, 2.56, 3.02], slots: [number, number][] = [];
    for (let k = 0; k < n; k++) {
      const j = k % 3;
      const hw = Math.sqrt(BAR.R * BAR.R - (gy[j]! - BAR.yc) ** 2) - 0.45;
      let x = (r() * 2 - 1) * hw;
      if (Math.abs(Math.abs(x) - 1.05) < 0.2) x += x > 0 ? 0.3 : -0.3;
      slots.push([x, gy[j]!]);
    }
    const order = slots.map((_, i) => i).sort(() => r() - 0.5);
    order.forEach((si, k) => {
      const [x, y] = slots[si]!;
      (u.lampA!.value as THREE.Vector4[])[k]!.set(x, y, 0.065, this.lampOut[k]!);
    });
    u.nLamp!.value = n;
    // the soldiers stand up on the snares of the first bar inside
    const rise = this.snares.filter((t) => t >= this.cutIn() - 0.05 && t < w1[iTo]!.start).slice(0, NR);
    while (rise.length < 2) rise.push(this.cutIn() + 0.3 * rise.length);
    (u.solRise!.value as number[]).splice(0, rise.length, ...rise);
    u.nRise!.value = rise.length;
  }

  /** The cut inside: the first downbeat after the plate starts. */
  private cutIn() {
    const au = this.ctx.audio;
    return au.downbeats.find((d) => d > this.ctx.start + 0.2) ?? this.ctx.start + 0.66;
  }

  /** Letters of a hero word standing in a row facing +z, centred on x0. */
  private place(w: Word3D, cap: number, x0: number, z: number) {
    const s = cap / w.cap;
    return (l: Letter) => { l.x = x0 + (l.penX - w.width / 2) * s; l.z = z; l.y = 0; l.yaw = 0; l.s = s; };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const T0 = this.ctx.start, T1 = this.ctx.end, tCut = this.cutIn();
    const inside = t >= tCut;
    const u = this.st.bg.u;
    const w1 = this.l1.words, w3 = this.l3.words, w4 = this.l4.words;
    const trojW = w1[w1.length - 1]!, vileW = this.l2.words[this.l2.words.length - 1]!;
    const throwW = w3.find((w) => w.w.toLowerCase().startsWith('throw'))!, remW = w3[w3.length - 1]!;
    const orW = w3[0]!, livesW = w4.find((w) => w.w.toLowerCase().startsWith('lives'))!, guileW = w4[w4.length - 1]!;
    const beatAfter = (x: number) => audio.timeOfBeat(Math.ceil(audio.beatAt(x + 0.01)));
    u.tNow!.value = t;

    // ---- the frame width a hero should fill, from the camera's distance
    const tanW = 2 * Math.tan((FOV * Math.PI) / 360) * (16 / 9);
    const capFor = (w: Word3D, dist: number, fill: number) => (fill * tanW * dist) / (w.width / w.cap);

    // ---- the camera
    let pos: THREE.Vector3, at: THREE.Vector3;
    const hatchC = HATCH.zF + (HATCH.zN - HATCH.zF) / 2;
    if (!inside) {
      const hx = HORSE.x - 0.15 * HORSE.s, hy = 3.34 * HORSE.s;
      pos = vkeys(t, [[T0, [0.7, 2.2, 9.5]], [tCut, [hx, 2.2, -3.4], ease.inCubic]]);
      at = vkeys(t, [[T0, [0.0, 3.7, TROY.z]], [tCut, [hx, hy, TROY.z], ease.inOutQuad]]);
    } else {
      const d4 = audio.downbeats.filter((d) => d > tCut - 0.01);
      const b2 = d4[1] ?? tCut + 2.67, b3 = d4[2] ?? tCut + 5.33, b4 = d4[3] ?? tCut + 8.0;
      const camHero: [number, number, number] = [0, 1.42, HERO_Z + 5.0];
      pos = vkeys(t, [
        [tCut, [0.9, 1.75, 4.6]],
        [b2, camHero, ease.inOutQuad],
        [vileW.start, [-0.12, 1.38, HERO_Z + 4.8], ease.inOutQuad],
        [orW.start, [0.0, 1.45, HERO_Z + 4.9], ease.linear],
        [b3, [0.0, 2.45, 1.3], ease.inOutCubic],
        [this.tTip, [0.0, 2.35, 1.0], ease.linear],
        [this.tTip + 0.55, [0.0, 3.0, -0.6], ease.inOutQuad],
        [this.tRe - 0.05, [0.0, 3.0, -0.65], ease.linear],
        [b4, camHero, ease.inOutCubic],
        [T1, [0.0, 1.42, HERO_Z + 4.65], ease.linear],
      ]);
      at = vkeys(t, [
        [tCut, [0.0, 1.25, END_Z]],
        [b2, [0.0, 1.28, END_Z], ease.inOutQuad],
        [orW.start, [0.0, 1.28, END_Z], ease.linear],
        [b3, [0.0, 0.25, -3.2], ease.inOutCubic],
        [this.tTip, [0.0, 0.3, -3.0], ease.linear],
        [this.tTip + 0.55, [0.0, -4.0, hatchC - 0.3], ease.inOutQuad],
        [this.tRe - 0.05, [0.0, -4.3, hatchC - 0.3], ease.linear],
        [b4, [0.0, 0.3, END_Z], ease.inOutCubic],
        [T1, [0.0, 0.3, END_Z], ease.linear],
      ]);
    }
    // jolts: the hatch dropping, REMORSE's tip, GUILE?'s onset
    const jolt = pulse(t, throwW.start + 0.05, 0.06) + 0.6 * pulse(t, guileW.start, 0.06);
    pos.y += 0.03 * jolt * noise1(t * 40, 7);
    this.st.cam.set(pos, at, FOV);

    // ---- hero words
    const heroDist = 5.0;
    const showHero = (w: Word3D, on: number, exit: number, fill: number) =>
      popWords(w, [on], t, this.place(w, capFor(w, heroDist, fill), 0, HERO_Z), { exit, exitDur: 0.2, glow: 0.55 });
    const hideFlat = (w: Word3D) => { for (const l of w.letters) if (l.hinge > 1.2) l.on = 0; w.update(); };
    showHero(this.trojans, trojW.start, beatAfter(this.l1.end), 0.66); hideFlat(this.trojans);

    // VILE? and its re-lettering into GUILE?
    const gCap = capFor(this.guile, heroDist, 0.62), gs = gCap / this.guile.cap;
    const vx = (l: Letter) => (l.penX - this.vile.width / 2) * gs, gx = (l: Letter) => (l.penX - this.guile.width / 2) * gs;
    const tA = livesW.start, mv = prog(t, tA + 0.08, tA + 0.42, ease.inOutCubic);
    const vileExit = beatAfter(this.l2.end);
    this.vile.letters.forEach((l, k) => {
      l.z = HERO_Z; l.y = 0; l.yaw = 0; l.s = gs;
      const first = popHinge(t, vileW.start, k), gone1 = prog(t, vileExit + k * 0.01, vileExit + 0.2 + k * 0.01, ease.inCubic);
      const again = popHinge(t, this.tRe, k);
      let h = t < this.tRe - POP.lead ? first + (Math.PI / 2 - first) * gone1 : again;
      l.x = vx(l);
      if (k === 0) h = Math.max(h, (Math.PI / 2) * prog(t, tA, tA + 0.12, ease.inCubic));   // V folds down
      else l.x = lerp(vx(l), gx(this.guile.letters[k + 1]!), mv);                            // I L E ? make room
      l.hinge = h;
      l.on = h < 1.2 && t < tA + 0.42 ? 1 : 0;
      const on = t < this.tRe - POP.lead ? vileW.start : this.tRe;
      l.mat.uniforms.glow!.value = 0.5 * pulse(t, on, 0.16) * (t >= on - 0.02 ? 1 : 0) * l.on;
    });
    this.vile.update();
    this.guile.letters.forEach((l, k) => {
      l.z = HERO_Z; l.y = 0; l.yaw = 0; l.s = gs; l.x = gx(l);
      let h = Math.PI / 2;
      if (k === 0) {                                     // G slides in from the left, standing up as it comes
        h = popHinge(t, tA + 0.3);
        l.x = gx(l) - 1.4 * (1 - prog(t, tA + 0.26, tA + 0.56, ease.outCubic));
      } else if (k === 1) {                              // U folds up where V was, then moves into its place
        h = popHinge(t, tA + 0.12);
        l.x = lerp(vx(this.vile.letters[0]!), gx(l), mv);
      } else h = t >= tA + 0.42 ? 0 : Math.PI / 2;       // the rest take over from VILE's I L E ?
      l.hinge = h;
      l.on = h < 1.2 ? 1 : 0;
      l.mat.uniforms.glow!.value = 0.6 * pulse(t, guileW.start, 0.14) * (t >= guileW.start - 0.02 ? 1 : 0) * l.on
        + 0.45 * pulse(t, k === 0 ? tA + 0.3 : tA + 0.12, 0.14) * (k < 2 ? 1 : 0) * l.on;
    });
    this.guile.update();

    // REMORSE: stands at the hatch's near edge, tips back into it and falls to the ground below
    const rCap = capFor(this.remorse, 4.2, 0.62), rs = rCap / this.remorse.cap;
    const tip = this.tTip, fallT = Math.max(0, t - tip - 0.12);
    this.remorse.letters.forEach((l, k) => {
      l.x = (l.penX - this.remorse.width / 2) * rs; l.yaw = 0; l.s = rs;
      const up = popHinge(t, remW.start, k);
      const back = (Math.PI / 2) * ease.inQuad(prog(t, tip, tip + 0.14));
      l.hinge = t < tip ? up : back + 2.2 * fallT;
      l.z = HATCH.zN + 0.1 - (HATCH.zN - hatchC + 0.1) * prog(t, tip + 0.05, tip + 0.4, ease.outQuad);
      l.y = -0.5 * 14 * fallT * fallT;
      l.on = t >= remW.start - POP.lead + k * POP.ripple && l.y > GROUND_Y + 0.3 && (l.hinge < 1.2 || t >= tip) ? 1 : 0;
      l.castShadow = true;
      l.mat.uniforms.glow!.value = 0.55 * pulse(t, remW.start, 0.16) * (t >= remW.start - 0.02 ? 1 : 0) * l.on;
    });
    this.remorse.update();

    // ---- small phrases
    for (const p of this.phrases) {
      const s = p.cap / p.w.cap;
      popWords(p.w, p.on, t, (l) => { l.x = p.x - (p.w.width * s) / 2 + l.penX * s; l.z = p.z; l.y = 0; l.yaw = 0; l.s = s; },
        { exit: p.exit, exitDur: 0.1, exitRipple: 0 });
      // the phrases of the other set are not shown
      const outside = p.z === -5.0;
      if (outside === inside) for (const l of p.w.letters) l.on = 0;
      hideFlat(p.w);
    }
    if (inside) for (const w of [this.trojans]) w.update();
    else for (const w of [this.trojans, this.vile, this.guile, this.remorse]) { for (const l of w.letters) l.on = 0; w.update(); }

    // ---- the sets
    u.belly!.value = inside ? 1 : 0;
    u.barR!.value = BAR.R; u.barYc!.value = BAR.yc; u.groundY!.value = GROUND_Y; u.wallTop!.value = TROY.top;
    const open = inside && t >= throwW.start - 0.02;
    (u.hatchR!.value as THREE.Vector4).set(HATCH.hx, HATCH.zN, HATCH.zF, open ? 1 : 0);
    (u.horseT!.value as THREE.Vector4).set(HORSE.x + 0.02 * noise1(t * 4, 3), 0, HORSE.s, inside ? 0 : 1);
    (u.horseA!.value as THREE.Vector4).set(1, 1, 0, 0);
    // the soldiers: up from the cut, a hop on each snare, filing to the hatch from just before "lives"
    u.solOn!.value = inside ? 1 : 0;
    u.solJolt!.value = this.snares.reduce((a, s) => a + (s > tCut + 1.5 ? pulse(t, s, 0.05) : 0), 0);
    const m0 = livesW.start - 0.3;
    u.solMarch!.value = t < m0 ? 0 : 1.6 * (t - m0) * (0.6 + 0.4 * prog(t, m0, m0 + 0.4));

    // ---- the light: the fire behind us (kept inside the vault)
    const L = keyLight(this.st.cam, audio, t, inside ? { seed: 27, right: 1.4, up: 0.8, back: 2.4, I: 1.6, reach: 20 } : { seed: 27, I: 1.7, reach: 40 });
    if (inside) {
      L.base.x = Math.max(-1.6, Math.min(1.6, L.base.x));
      L.base.y = Math.min(L.base.y, 3.0);
    }
    const Lc = this.st.lightCentre(L).clone();
    const x = t - throwW.start + 0.02;
    const ang = !open ? 0 : (Math.PI / 2) * (1 - Math.exp(-x * 5) * Math.cos(x * 15));
    this.door.set(ang, Lc, L.I, L.reach);
    this.door.occluder.visible = open;

    // in the glaze's mirror, nothing below the floor
    const below: THREE.Object3D[] = [];
    const before = () => {
      below.length = 0;
      for (const o of [this.door.pivot, this.door.occluder]) if (o.visible) { below.push(o); o.visible = false; }
      for (const l of this.remorse.letters) if (l.mesh.visible && l.y < -0.01) { below.push(l.mesh); l.mesh.visible = false; }
    };
    const after = () => { for (const o of below) o.visible = true; };
    this.st.render(renderer, out, t, L, inside ? { wall: 1, wallZ: END_Z } : { wall: 1, wallZ: TROY.z },
      { noFlame: true, rim: 0.8, spec: 0.05, mirror: { before, after } });
    return { bloom: 0.6, bloomThreshold: 0.85, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3, shake: [0.002 * jolt, 0.005 * jolt] };
  }
}
