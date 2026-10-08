// `mirror` — the rest of chorus 1, lines 9–14 (docs/MONSTER.md, option A, client 2026-10-08; shot plan in
// docs/mirror-plan.md). We stay on hook 1's shore (`../shore.ts`): each line's hero word stands lit on the waterline
// and its black-figure reflection answers it, a little less obedient and a little bigger line by line (the dark
// double): WRONG? is answered by WRONG (the reflected "?" drops on the beat after); PROBLEM stands above while HIDING
// rises only in the water, taller than the word. The small words float near the camera, one phrase at a time,
// popping on their onsets. The camera cuts between low angles and dips to the waterline on each hero word (hook 1's
// signature: half word, half reflection); on "hiding" it cranes up and looks down into the water.
// Built: lines 9–10 (46.02–54.3). Lines 11–14 (guilt and the shades, the balance, MONSTER?) are phase 2: until
// then the shore holds empty.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, noise1, prog, pulse } from '../../engine/util';
import { Stage, Word3D, keyLight, popHinge, popWords } from '../stage';
import {
  FOV, LOW, SHORE_KEY, SHORE_OPTS, SHORE_POST, SHORE_SURF, VOICE, WORD_Z, bob, heroScale, hideFlat, lowPushZ, setRegion,
  shoreStage, wordBox,
} from '../shore';

const HALF = Math.PI / 2;

interface CamState { pos: THREE.Vector3; yaw: number; pitch: number }
/** A hero word on the waterline: up on `on`, folding back into the water from `out`. `stretch`: its reflection's
 *  height over the word's (the dark double growing). */
interface Hero { w: Word3D; on: number; out: number; outDur: number; stretch: number }
/** A floating phrase: its words' onsets, its exit, and where it floats (row start x, z; cap height). */
interface Phrase { w: Word3D; on: number[]; exit: number; x0: number; z0: number; cap: number }

export default class Mirror extends Scene {
  private st!: Stage;
  /** World units per font px of every hero word (MONSTER?'s scale in hook 1). */
  private s = 0.01;
  private monster!: Hero;
  private wrong!: Hero;
  private problem!: Hero;
  /** HIDING: only in the water. */
  private hiding!: Hero;
  private ph: Phrase[] = [];
  /** Key times (s): see camAt and docs/mirror-plan.md. */
  private k = {
    tD1: 0, A: 0, B: 0, wD0: 0, wD1: 0, qDrop: 0, C: 0, pD0: 0, pD1: 0, cr0: 0, cr1: 0, E: 0,
  };

  override async init() {
    const { lyrics, audio, start } = this.ctx;
    const hook = lyrics.get("What if I'm the monster", 0);
    const l9 = lyrics.get("What if I'm in the wrong"), l10 = lyrics.get("the problem that's been hiding");
    const w = (l: Line, s: string) => l.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
    const mW = hook.words.find((x) => /monster/i.test(x.w))!;
    const wrong = w(l9, 'wrong'), problem = w(l10, 'problem'), hiding = w(l10, 'hiding'), along = w(l10, 'along');
    const beat = (t: number) => audio.timeOfBeat(Math.round(audio.beatAt(t)));

    // ---- key times
    const k = this.k;
    k.tD1 = mW.start + 0.45;                        // hook 1's dip ends (its slow push runs on into this shot)
    k.A = l9.words[0]!.start;                       // cut: "What" (46.52)
    k.B = w(l9, 'in').start;                        // cut: "in" (47.62)
    k.wD0 = wrong.start - 0.12; k.wD1 = wrong.start + 0.45;   // the dip on WRONG? (48.02)
    k.qDrop = beat(wrong.start + 0.67);             // the reflection drops WRONG?'s "?" (48.69)
    k.C = l10.words[0]!.start;                      // cut: "What" (49.28)
    k.pD0 = problem.start - 0.12; k.pD1 = problem.start + 0.45; // the dip on PROBLEM (50.64)
    k.cr0 = beat(hiding.start - 0.5); k.cr1 = beat(hiding.start + 0.1);   // the crane over the water (51.36 → 52.02)
    k.E = beat(along.start + 0.25);                 // cut back to the waterline on the downbeat (53.36)

    // ---- the heroes (hook 1's MONSTER?, same font, same scale: incised for their black-figure reflections)
    this.st = shoreStage();
    const big = (s: string) => {
      const wd = new Word3D(s.toUpperCase().replace(/[,.]$/, ''), F.archivo(112.5, 900), { size: 220, incise: true });
      wd.lightMul = 2.8;
      this.st.add(wd, { shadows: false });
      return wd;
    };
    const out9 = l10.words[0]!.start - 0.18, out10 = 54.1;
    this.monster = { w: big(mW.w), on: mW.start, out: start + 0.26, outDur: 0.16, stretch: 1 };
    this.wrong = { w: big(wrong.w), on: wrong.start, out: out9, outDur: 0.14, stretch: 1 };
    this.problem = { w: big(problem.w), on: problem.start, out: out10, outDur: 0.16, stretch: 1 };
    this.hiding = { w: big(hiding.w), on: hiding.start, out: out10, outDur: 0.16, stretch: 1.15 };
    this.s = heroScale(this.monster.w);

    // ---- the floating phrases, one at a time, each placed in front of the camera it is first seen from
    const voice = F.archivo(112.5, 600);
    const phrase = (ws: Word[], exit: number, at: number, dist: number, side: number) => {
      const wd = new Word3D(ws.map((x) => x.w).join(' '), voice, { size: 200 });
      this.st.add(wd, { shadows: false });
      const c = this.camAt(at), cap = VOICE.cap;
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
      const cx = c.pos.x + fx * dist + rx * side, cz = c.pos.z + fz * dist + rz * side;
      this.ph.push({ w: wd, on: ws.map((x) => x.start), exit, x0: cx - (wd.width * cap / wd.cap) / 2, z0: cz, cap });
    };
    const i9 = l9.words.indexOf(w(l9, 'in')), i10 = l10.words.indexOf(problem);
    const iThat = l10.words.indexOf(w(l10, 'thats')), iAll = l10.words.indexOf(w(l10, 'all'));
    phrase(l9.words.slice(0, i9), k.B - 0.11, k.A, 2.6, -0.55);                         // What if I'm
    phrase(l9.words.slice(i9, -1), k.wD0, k.B, 2.6, -0.45);                            // in the
    phrase(l10.words.slice(0, i10), k.pD0, k.C, 3.0, -0.25);                           // What if I'm the
    phrase(l10.words.slice(iThat, iThat + 2), l10.words[iAll]!.start - 0.11, k.cr1, 2.4, -0.9); // that's been
    phrase(l10.words.slice(iAll), k.E - 0.1, k.cr1, 2.4, -0.75);                      // all along?
    for (const wd of this.st.words) for (const l of wd.letters) l.mat.side = THREE.DoubleSide;
  }

  /** The camera (position, yaw left of -z, pitch as the slope of its view) at time t. */
  private camAt(t: number): CamState {
    const k = this.k, T0 = this.ctx.start;
    const low = (z: number): CamState => ({ pos: new THREE.Vector3(0, LOW.y, z), yaw: 0, pitch: LOW.pitch });
    const mix = (a: CamState, b: CamState, u: number): CamState =>
      ({ pos: a.pos.clone().lerp(b.pos, u), yaw: lerp(a.yaw, b.yaw, u), pitch: lerp(a.pitch, b.pitch, u) });
    // hook 1's last frame: low at the waterline, still pushing in
    if (t < k.A) return low(lowPushZ(t, k.tD1, T0));
    // A: low over the water from the right, tracking left across it ("What if I'm")
    if (t < k.B) {
      const u = prog(t, k.A, k.B);
      return { pos: new THREE.Vector3(lerp(1.75, 1.2, u), lerp(0.32, 0.28, u), lerp(8.3, 8.0, u)), yaw: 0.07, pitch: 0.1 };
    }
    // B: a little higher, centred ("in the"); on WRONG? the dip to the waterline, then the slow push
    if (t < k.C) {
      const b: CamState = { pos: new THREE.Vector3(-0.3, 0.38, 9.0 - 0.15 * prog(t, k.B, k.wD0)), yaw: -0.012, pitch: 0.08 };
      const c = mix(b, low(LOW.z), ease.inOutCubic(prog(t, k.wD0, k.wD1)));
      c.pos.z -= 0.3 * prog(t, k.wD1, k.C + 0.6);
      return c;
    }
    // C: higher, from the left ("What if I'm the"); on PROBLEM the dip, the push; then (from the beat before "hiding")
    // the crane up, looking down into the water, where HIDING rises
    if (t < k.E) {
      const u = prog(t, k.C, k.pD0);
      const cc: CamState = { pos: new THREE.Vector3(lerp(-2.2, -1.8, u), lerp(0.6, 0.55, u), lerp(7.5, 7.7, u)), yaw: -0.085, pitch: 0.03 };
      const c = mix(cc, low(LOW.z), ease.inOutCubic(prog(t, k.pD0, k.pD1)));
      c.pos.z -= 0.3 * prog(t, k.pD1, k.E);
      const d: CamState = { pos: new THREE.Vector3(0, 0.6, 7.0 - 0.2 * prog(t, k.cr1, k.E)), yaw: 0, pitch: -0.15 };
      return mix(c, d, ease.inOutCubic(prog(t, k.cr0, k.cr1)));
    }
    // E: cut back to the waterline on the downbeat: PROBLEM above, HIDING below
    return low(8.3 - 0.25 * prog(t, k.E, k.E + 2));
  }

  /** A hero standing up on the waterline as sung, folding back into the water from its `out` (or `gone`). */
  private pose(h: Hero, t: number, gone = prog(t, h.out, h.out + h.outDur, ease.inCubic)) {
    const wd = h.w, s = this.s;
    wd.letters.forEach((l, k) => {
      l.x = (l.penX - wd.width / 2) * s; l.z = WORD_Z; l.y = 0; l.yaw = 0; l.s = s;
      const up = popHinge(t, h.on, k);
      l.hinge = up + (HALF - up) * gone;
      // (folding, a nearly flat letter is hidden: a lit sliver over the reflection)
      l.on = l.hinge < HALF - 1e-4 && gone < 0.999 && !(gone > 0 && l.hinge > 1.25) ? 1 : 0;
    });
    wd.update();
  }

  private poseAll(t: number) {
    for (const h of [this.monster, this.wrong, this.problem]) this.pose(h, t);
    // HIDING is not above the water
    for (const l of this.hiding.w.letters) l.on = 0;
    this.hiding.w.update();
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio } = this.ctx;
    const t = f.t, k = this.k;
    const c = this.camAt(t);
    this.st.cam.set(c.pos, c.pos.clone().add(new THREE.Vector3(-30 * Math.sin(c.yaw), 30 * c.pitch, -30 * Math.cos(c.yaw))), FOV);
    const cam = this.st.cam.cam.position;

    // ---- the heroes: bone, lit, an ember flash as each lands (as hook 1's MONSTER?)
    this.poseAll(t);
    for (const h of [this.monster, this.wrong, this.problem]) h.w.letters.forEach((l, i) => {
      const tk = h.on + i * 0.014;
      l.mat.uniforms.glow!.value = 0.5 * pulse(t, tk, 0.14) * (t >= tk ? 1 : 0) * l.on;
      l.mat.uniforms.amb!.value = 0.05 * prog(t, tk, tk + 0.3);
    });

    // ---- the small words afloat near us, one phrase at a time, truly reflected
    for (const p of this.ph) {
      popWords(p.w, p.on, t, bob(t, cam, p.x0, p.z0, p.cap, p.w, 0.012), { exit: p.exit, exitDur: 0.06, exitRipple: 0 });
      hideFlat(p.w);
    }

    // ---- the answer in the water: under the hero now standing the clay's orange develops (and closes as it folds)
    const active = t < this.wrong.on - 0.3 ? this.monster : t < this.problem.on - 0.3 ? this.wrong : this.problem;
    const dev = (h: Hero) => ease.outCubic(prog(t, h.on + 0.05, h.on + 0.7)) * (1 - prog(t, h.out, h.out + h.outDur));
    const u = this.st.bg.u;
    u.develop!.value = dev(active);
    const ink = (h: Hero) => h.w.letters.filter((l) => l.ch !== '?');
    const box = wordBox(this.st, ink(active), this.s, active.w.cap);
    // "hiding": the region moves from PROBLEM's reflection to HIDING's (posed for the measurement only)
    const swap = active === this.problem ? prog(t, this.hiding.on - 0.06, this.hiding.on + 0.2, ease.inOutCubic) : 0;
    if (swap > 0) {
      this.pose(this.hiding, t, 0);
      const hb = wordBox(this.st, ink(this.hiding), this.s, this.hiding.w.cap);
      box.L = lerp(box.L, hb.L, swap); box.R = lerp(box.R, hb.R, swap);
      box.H *= lerp(1, this.hiding.stretch, swap);
      this.poseAll(t);
    }
    setRegion(this.st, box);

    // the mirrored render: black slip, incised contour; each hero's reflection disobeys it a little more
    const mirror = {
      before: () => {
        for (const h of [this.monster, this.wrong, this.problem, this.hiding]) for (const l of h.w.letters) l.mat.uniforms.bf!.value = 1;
        // MONSTER: no "?" (hook 1)
        for (const l of this.monster.w.letters) if (l.ch === '?') l.mesh.visible = false;
        // WRONG?: the reflection keeps the "?" for a beat, then drops it into the water
        const qd = prog(t, k.qDrop, k.qDrop + 0.16, ease.inCubic);
        for (const l of this.wrong.w.letters) if (l.ch === '?' && qd > 0) {
          l.hinge = l.hinge + (HALF - l.hinge) * qd;
          if (l.hinge > 1.2) l.on = 0;
        }
        this.wrong.w.update();
        // PROBLEM: its reflection folds away on "hiding", and HIDING rises in its place, taller than the word
        const goneR = Math.max(prog(t, this.problem.out, this.problem.out + this.problem.outDur, ease.inCubic),
          prog(t, this.hiding.on - 0.08, this.hiding.on + 0.06, ease.inCubic));
        this.pose(this.problem, t, goneR);
        this.pose(this.hiding, t);
        for (const l of this.hiding.w.letters) {
          if (l.hinge > 1.2) l.on = 0;
          l.mesh.visible = l.on > 0;
          l.mesh.scale.y = l.s * this.hiding.stretch;
          l.mesh.updateMatrixWorld(true);
        }
      },
      after: () => {
        for (const h of [this.monster, this.wrong, this.problem, this.hiding]) for (const l of h.w.letters) l.mat.uniforms.bf!.value = 0;
        this.poseAll(t);
      },
    };
    this.st.render(renderer, out, t, keyLight(this.st.cam, audio, t, SHORE_KEY), SHORE_SURF, { ...SHORE_OPTS, mirror });

    const hit = pulse(t, this.wrong.on, 0.08) + pulse(t, this.problem.on, 0.08) + 0.5 * pulse(t, this.hiding.on, 0.08);
    return { ...SHORE_POST, shake: [noise1(t * 60, 1) * 6 * hit, noise1(t * 60, 2) * 6 * hit] };
  }
}
