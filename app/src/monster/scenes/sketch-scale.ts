// SKETCH (stills only) — `scale`, chorus 2 after hook 2: three options for the full weighing (the kerostasia), chosen
// with ?opt=a|b|c. Only the key frames are posed with care; motion between them is crude.
//   A "the beam is the waterline": a balance painted across the waterline, its lit pan above (bone), its other pan
//     under the surface in black-figure on the clay. 117.9 STRONGER? in the lit pan, level; 125.5 EVERYONE heaped in
//     the lit pan, US (the water's answer) in the pan below, heavier, the beam tipped.
//   B "Zeus' scales": a balance hanging out of the dark over the black sea, black-glaze pans with lit rims, small
//     black men in them, the words dropped in as weights. 117.9 STRONGER? against a life, level; 125.5 EVERYONE
//     spilling out of the high pan, US down.
//   C "the world is the scale": the horizon is the beam, the camera rolls. 125.5 EVERYONE high and small, US low and
//     heavy; 130.7 the horizon cracked behind UNJUST?.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { H as HPX } from '../../engine/gl';
import { F } from '../../engine/type';
import { ease, prog } from '../../engine/util';
import { Stage, Word3D, keyLight, popWords, type Letter } from '../stage';
import { Answer, SHORE_KEY, SHORE_OPTS, SHORE_POST, SHORE_SURF, WORD_Z, heroFont } from '../shore';
import { Balance3D, Man, scaleStage } from './sketch-scale-kit';

const FOV = 40;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export default class SketchScale extends Scene {
  private opt = 'a';
  private st!: Stage;
  private T: Record<string, number> = {};
  private pose: (t: number) => { before?: () => void; after?: () => void } | undefined = () => undefined;

  override async init() {
    this.opt = (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('opt') : null) ?? 'a';
    const { lyrics } = this.ctx;
    const at = (line: string, word: string, fb: number) => {
      try { return lyrics.get(line).words.find((x) => norm(x.w) === word)?.start ?? fb; } catch { return fb; }
    };
    const T = this.T;
    T.stronger = at('Would that make us stronger', 'stronger', 117.2);
    T.foes = at('keep our foes at bay', 'foes', 119.05);
    T.monster = at('If I became the monster to everyone', 'monster', 122.68);
    T.everyone = at('If I became the monster to everyone', 'everyone', 124.03);
    T.us = at('If I became the monster to everyone', 'us', 125.23);
    T.home = at('And made sure we got home again', 'home', 127.94);
    T.unjust = at("who would care if we're unjust", 'unjust', 130.34);
    this.st = scaleStage();
    if (this.opt === 'b') this.buildB();
    else if (this.opt === 'c') this.buildC();
    else this.buildA();
    for (const wd of this.st.words) for (const l of wd.letters) l.mat.side = THREE.DoubleSide;
  }

  private hero(text: string) {
    const w = new Word3D(text, heroFont(), { size: 220 });
    w.lightMul = 2.8;
    this.st.add(w, { shadows: false });
    return w;
  }
  private crowd(n: number) {
    const w = new Word3D(Array(n).fill('EVERYONE').join(' '), F.archivo(112.5, 600), { size: 160 });
    w.lightMul = 1.8;
    this.st.add(w, { shadows: false });
    return w;
  }
  /** Stands a run centred at (x, y, z), `width` wide (world), facing `yaw`; returns its scale. */
  private stand(w: Word3D, on: number, t: number, x: number, y: number, z: number, width: number, exit = 1e9, yaw = 0) {
    const s = width / w.width;
    popWords(w, [on], t, (l: Letter) => { l.x = x + (l.penX - w.width / 2) * s; l.y = y; l.z = z; l.yaw = yaw; l.s = s; }, { exit, exitDur: 0.15 });
    return s;
  }
  /** Places each word of a crowd run: p(k) gives its centre, cap height (world) and yaw. */
  private place(w: Word3D, ons: number[], t: number, p: (k: number) => [number, number, number, number, number], exit = 1e9) {
    popWords(w, ons, t, (l: Letter) => {
      const [x, y, z, cap, yaw] = p(l.word), s = cap / w.cap, wd = w.words[l.word]!;
      const dx = (l.penX - wd.x0 - wd.w / 2) * s;
      l.x = x + dx * Math.cos(yaw); l.z = z - dx * Math.sin(yaw); l.y = y; l.yaw = yaw; l.s = s;
    }, { exit, exitDur: 0.15 });
  }
  private proj(x: number, y: number, z: number) {
    const p = this.st.cam.project({ x, y, z });
    return new THREE.Vector2(p.x, HPX - p.y);
  }

  // ---------------------------------------------------------------- A: the beam is the waterline
  private buildA() {
    const T = this.T, st = this.st, u = st.bg.u;
    const B = { arm: 6, stem: 0.8, bowlW: 3.4, bowlH: 0.8, cord: 3.5, th: 0.07, men: 1.5 };
    const stronger = this.hero('STRONGER?');
    const crowd = this.crowd(7);
    const us = new Answer(st, 'US');
    const heap: [number, number, number, number][] = [   // x, y (from the rim), z, yaw: stacked like bricks
      [-1.5, -0.12, 0.2, 0.04], [1.5, -0.12, -0.2, -0.04], [-1.2, 0.42, -0.1, -0.05], [1.8, 0.42, 0.15, 0.05],
      [-1.6, 0.96, 0.1, 0.06], [1.3, 0.96, -0.15, -0.03], [0.1, 1.5, 0.0, 0.0],
    ];
    u.seep!.value = 0.12; u.seepK!.value = 20; u.bOn!.value = 1;
    this.pose = (t) => {
      st.cam.set({ x: 0, y: 0.3, z: 4 }, { x: 0, y: 0.0, z: -16 }, FOV);
      const a = 0.2 * ease.inOutCubic(prog(t, T.everyone! - 0.2, T.us! + 0.15));
      const f = this.proj(1, 0, WORD_Z).x - this.proj(0, 0, WORD_Z).x;
      const P = this.proj(0, 0, WORD_Z);
      (u.bP!.value as THREE.Vector2).copy(P);
      u.bA!.value = a; u.bArm!.value = B.arm * f; u.bStem!.value = B.stem * f; u.bBowlW!.value = B.bowlW * f;
      u.bBowlH!.value = B.bowlH * f; u.bCord!.value = B.cord * f; u.bTh!.value = B.th * f; u.menH!.value = B.men * f;
      u.menOn!.value = t < T.everyone! ? 1 : 0;
      // the lit pan's rim (world) and the pan below's
      const xL = -B.arm * Math.cos(a), yL = B.arm * Math.sin(a) + B.stem + B.bowlH;
      const xR = B.arm * Math.cos(a), dR = B.arm * Math.sin(a) + B.cord;
      const rD = this.proj(xR, -dR, WORD_Z);
      u.bfOn!.value = 1;
      (u.bfBox!.value as THREE.Vector4).set(P.x - 20, rD.x + B.bowlW * f + 40, P.y, rD.y - B.bowlH * f - 40);
      this.stand(stronger, T.stronger!, t, xL, yL - 0.18, WORD_Z, 6.1, T.foes! - 0.2);
      this.place(crowd, heap.map((_, k) => T.everyone! + 0.05 * k), t, (k) => {
        const h = heap[k]!;
        return [xL + h[0], yL + h[1], WORD_Z + h[2], 0.36, h[3]];
      });
      if (t < T.everyone! - 0.1) for (const l of crowd.letters) l.on = 0;
      crowd.update();
      const usS = 2.7 / us.w.cap;
      return {
        before: () => { if (t >= T.us! - 0.1) us.pose(t, xR, usS, T.us!, dR + 0.15 - 2.7); },
        after: () => us.hide(),
      };
    };
  }

  // ---------------------------------------------------------------- B: Zeus' scales
  private buildB() {
    const T = this.T, st = this.st, u = st.bg.u;
    const bal = new Balance3D(4.6, 2.5, 0.5, 3.4);
    st.scene.add(bal.group);
    const men = Array.from({ length: 9 }, (_, i) => new Man(0.11 + 0.23 * i));
    for (const m of men) st.scene.add(m.mesh);
    const stronger = this.hero('STRONGER?');
    const us = this.hero('US');
    const crowd = this.crowd(7);
    u.seep!.value = 0.3; u.seepK!.value = 14; u.skyI!.value = 0.1;
    const pivot = new THREE.Vector3(0, 6.2, -6);
    // EVERYONE: two in the high pan, one tipping over its lip, the rest falling toward the water
    const spill: [number, number, number, number, number][] = [  // dx, dy from the left rim, dz, yaw, hinge
      [0.2, -0.1, 0.2, 0.0, 0], [-0.3, 0.38, -0.3, 0.05, 0], [2.0, 0.05, 0.9, -0.45, 0.55], [1.3, -1.25, 1.2, 0.35, 0.8],
      [-0.9, -2.0, 0.8, -0.3, 0.35], [1.6, -2.8, 1.5, 0.5, 1.0], [-0.4, -3.5, 1.1, -0.15, 0.6],
    ];
    this.pose = (t) => {
      const cam = new THREE.Vector3(0, 2.75, 8);
      st.cam.set(cam, { x: 0, y: 3.1, z: -6 }, FOV);
      const a = 0.24 * ease.inOutCubic(prog(t, T.everyone! - 0.2, T.us! + 0.2));
      const L = keyLight(st.cam, this.ctx.audio, t, SHORE_KEY);
      bal.pose(pivot, a, st.lightCentre(L).clone(), L.I, cam);
      const [rL, rR] = bal.rims as [THREE.Vector3, THREE.Vector3];
      const late = t >= T.everyone! - 0.1;
      // the lives: one against STRONGER?, then a crowd in the high pan and two with US
      const spots: [THREE.Vector3, number, number][] = late
        ? [[rL, -1.9, -0.6], [rL, -1.2, -1.1], [rL, 1.3, -1.0], [rL, 1.9, -0.5], [rL, 0.5, -1.4], [rR, -1.75, 0.2], [rR, 1.75, -0.3]]
        : [[rR, 0.0, -0.3]];
      men.forEach((m, i) => {
        const s = spots[i];
        if (!s) { m.pose(0, 0, 0, 1, cam, false); return; }
        m.pose(s[0].x + s[1], s[0].y - 0.18, s[0].z + s[2], late ? 0.85 : 1.2, cam);
      });
      this.stand(stronger, T.stronger!, t, rL.x, rL.y - 0.1, rL.z + 0.3, 4.7, T.foes! - 0.2);
      this.stand(us, T.us!, t, rR.x, rR.y - 0.12, rR.z + 0.3, 2.7);
      this.place(crowd, spill.map((_, k) => T.everyone! + 0.06 * k), t, (k) => {
        const p = spill[k]!;
        return [rL.x + p[0], rL.y + p[1], rL.z + p[2], 0.36, p[3]];
      });
      crowd.letters.forEach((l) => { l.hinge = Math.max(l.hinge, spill[l.word]![4] * prog(t, T.everyone!, T.everyone! + 0.4)); });
      if (!late) for (const l of crowd.letters) l.on = 0;
      crowd.update();
      return undefined;
    };
  }

  // ---------------------------------------------------------------- C: the world is the scale
  private buildC() {
    const T = this.T, st = this.st, u = st.bg.u;
    const us = this.hero('US');
    const unjust = this.hero('UNJUST?');
    const crowd = this.crowd(8);
    u.seep!.value = 0.14; u.seepK!.value = 20;
    const spots: [number, number, number][] = [   // x, z, cap: small and light on the high side
      [-11.5, -14.5, 0.5], [-6.0, -14.8, 0.5], [-9.6, -11.5, 0.42], [-4.6, -11.8, 0.42],
      [-7.9, -8.6, 0.36], [-3.6, -8.9, 0.36], [-6.0, -6.0, 0.3], [-2.6, -6.3, 0.3],
    ];
    this.pose = (t) => {
      const roll = t < T.unjust! - 0.2 ? 0.22 * ease.inOutCubic(prog(t, T.everyone! - 0.3, T.us! + 0.25)) : 0.13;
      const cam = { x: 0, y: 0.32, z: 8.4 };
      st.cam.set(cam, { x: 0, y: 0.32, z: -16 }, FOV, roll);
      const a = this.proj(-10, 0, -16), b = this.proj(10, 0, -16), c = this.proj(0, 0, -16);
      (u.hzP!.value as THREE.Vector2).copy(c);
      (u.hzD!.value as THREE.Vector2).copy(b.clone().sub(a).normalize());
      (u.crack!.value as THREE.Vector4).set(470, 50, 26, t >= T.unjust! + 0.02 ? 1 : 0);
      const camV = new THREE.Vector3(cam.x, cam.y, cam.z);
      // US slid down to the low side, heavy; EVERYONE scattered small on the high side
      const slide = 2.5 * (1 - ease.outCubic(prog(t, T.us!, T.us! + 0.5)));
      this.stand(us, T.us!, t, 7.6 - slide, 0, WORD_Z, 6.2, T.home! - 0.2);
      this.place(crowd, spots.map((_, k) => T.everyone! + 0.04 * k), t, (k) => {
        const [x, z, cap] = spots[k]!;
        return [x, 0, z, cap, Math.atan2(camV.x - x, camV.z - z)];
      }, T.home! - 0.2);
      this.stand(unjust, T.unjust!, t, -1.6, 0, WORD_Z, 16.5);
      return undefined;
    };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const mirror = this.pose(t);
    const L = keyLight(this.st.cam, this.ctx.audio, t, SHORE_KEY);
    this.st.render(this.ctx.renderer, out, t, L, SHORE_SURF, { ...SHORE_OPTS, mirror });
    return { ...SHORE_POST };
  }
}
