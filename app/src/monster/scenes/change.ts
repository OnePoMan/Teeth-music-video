// `change` — verse 1, line 4: "Do I need to change?" and the bar of strings after it (docs/MONSTER.md, revision 1).
// Concept 1, "shattered and remade" (prototype for the client's choice). The shadow play proper, lit by the fire
// behind us (never seen): "Do I need to" pops up small; CHANGE? stands at frame scale on the black-glaze floor
// before the clay wall, bone, its shadow on the wall and its reflection in the glaze. On the downbeat while the word
// is still sung it cracks: fracture lines run across the letters, glowing ember for an instant, and the pieces start
// to part, slowly, so the word stays readable. Through the hush they drift apart and hang turning in the air, each
// sherd bone in front, black glaze behind, the orange clay in its broken sections, while the camera drifts among
// them. On the four notes of the rising figure they slam back in four waves, and they land black side out: the word
// that reforms is black-figure, its fractures incised through the slip to the clay. Changed, and the scars show.
// (A sherd turns over in flight; its two faces swap materials at the instant it is edge-on to the camera, so it
// reads as turned over yet lands the right way round.)
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, noise1, prog, pulse } from '../../engine/util';
import { Stage, Word3D, keyLight, popHinge, popWords, row, vkeys } from '../stage';
import { ShardWord, type Shard } from '../shards';

const CAP = 1.2, ROW_Z = -2.3, WALL_Z = -6.2;
/** Seconds each wave of sherds flies before it lands on its note. */
const FLIGHT = 0.15;
/** The camera's vertical fov (degrees) and the share of the frame's width CHANGE? fills when it lands. */
const FOV = 40, FILL = 0.72;
const EX = new THREE.Vector3(1, 0, 0), EZ = new THREE.Vector3(0, 0, 1);

export default class Change extends Scene {
  private st = new Stage({ maxCards: 96 });
  private word!: ShardWord;
  private ask!: Word3D;
  private line!: Line;
  /** The rising figure's four notes (one wave each), the crack (the downbeat while the word is sung). */
  private notes: number[] = [];
  private crack = 21.356;
  /** Each sherd's wave (0..3). */
  private wave: number[] = [];
  private s = 0.01;
  private q1 = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  private qz = new THREE.Quaternion();
  /** Each sherd's face swap as the camera sees it, and as the glaze's mirror image sees it. */
  private flips: number[] = [];
  private flipsM: number[] = [];
  private m = new THREE.Matrix4();
  private sv = new THREE.Vector3();

  override async init() {
    this.word = new ShardWord('CHANGE?', F.archivo(75, 900), { size: 220, seed: 23, lines: (_i, ch) => (ch === '?' ? 3 : 4), minShare: 0.06 });
    this.st.add(this.word as unknown as Word3D);
    this.line = this.ctx.lyrics.get('Do I need to change');
    this.ask = new Word3D(this.line.words.slice(0, 4).map((w) => w.w).join(' '), F.archivo(112.5, 600), { size: 200 });
    this.st.add(this.ask);
    const { audio } = this.ctx;
    const change = this.line.words[4]!;
    this.crack = audio.timeOfBeat(Math.ceil(audio.beatAt(change.start + 0.3)));
    this.notes = audio.events('orch', 23.8, 25.1).map(([t]) => t).slice(0, 4);
    while (this.notes.length < 4) this.notes.push(24.01 + 0.333 * this.notes.length);
    this.s = CAP / this.word.cap;
    // the waves fill the word roughly left to right, as the figure rises, with some scatter
    const sh = this.word.letters;
    const order = sh.map((l, i) => ({ i, k: l.wc.x / this.word.width + (l.r[0]! - 0.5) * 0.45 })).sort((a, b) => a.k - b.k);
    this.wave = new Array(sh.length).fill(0);
    order.forEach((o, rank) => { this.wave[o.i] = Math.min(3, Math.floor((rank * 4) / sh.length)); });
  }

  /** A sherd standing in the word (its glyph folded up by `hinge`): its centre and orientation. */
  private restPose(l: Shard, hinge: number, pos: THREE.Vector3, q: THREE.Quaternion) {
    const s = this.s, G = this.word.glyphs[l.glyph]!;
    q.setFromAxisAngle(EX, -hinge);
    pos.set(l.c.x * s, l.c.y * s, 0).applyQuaternion(q);
    pos.x += (G.penX - this.word.width / 2) * s; pos.z += ROW_Z;
  }

  /** Where a sherd hangs at time t (offset from its rest), and how far it has turned (about `axis`, and in its plane). */
  private hang(l: Shard, i: number, t: number) {
    const s = this.s, r = l.r;
    const u = (t - this.crack) / (24.0 - this.crack);
    const G = u <= 0 ? 0 : u < 1 ? u * u * (3 - 2 * u) : 1 + 0.05 * (u - 1);
    // the hairline: the fractures open at once, a little
    const gap = 0.018 * prog(t, this.crack, this.crack + 0.1, ease.outCubic);
    const rx = (l.wc.x - this.word.width / 2) * s, ry = (l.wc.y - this.word.cap * 0.45) * s;
    const rl = Math.hypot(rx, ry) || 1;
    const D = new THREE.Vector3(rx * 0.42 + (r[1]! - 0.5) * 0.9, ry * 0.7 + 0.3 + r[2]! * 0.95, -1.3 + r[3]! * 1.9);
    const off = new THREE.Vector3(rx / rl, ry / rl, 0).multiplyScalar(gap).addScaledVector(D, G);
    // a slow drift of its own while it hangs
    const dr = Math.min(1, Math.max(0, u));
    off.x += 0.05 * dr * noise1(t * 0.6, i * 3 + 1); off.y += 0.05 * dr * noise1(t * 0.55, i * 3 + 2);
    // keep it off the floor
    const restY = l.wc.y * s;
    if (restY + off.y < 0.35 && G > 0) off.y = Math.max(off.y, (0.35 - restY) * Math.min(1, G * 3));
    const a = r[4]! * Math.PI * 2;
    const axis = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    const th = (0.2 + 0.85 * r[5]!) * Math.PI * G * (0.15 + 0.85 * G);
    const ph = (r[6]! - 0.5) * 1.8 * G;
    return { off, axis, th, ph };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const [doW, iW, need, to, change] = this.line.words as [Word, Word, Word, Word, Word];
    const T0 = this.ctx.start, T1 = this.ctx.end;
    const wd = this.word, s = this.s, nG = wd.glyphs.length;
    const tPop = (k: number) => change.start + (k / (nG - 1)) * Math.min(0.36, change.end - change.start);
    const notes = this.notes;

    // ---- the camera: CHANGE? fills the frame as it lands; through the hush a slow orbit from the right that pushes in
    // among the hanging sherds; as the figure starts it draws back to the word, front on, and holds
    const wordW = wd.width * s;
    const Rh = wordW / (FILL * 2 * Math.tan((FOV * Math.PI) / 360) * (16 / 9));
    const ck = (az: number, R: number, y: number): [number, number, number] => [az, R, y];
    const keys: [number, [number, number, number], ((u: number) => number)?][] = [
      [T0, ck(0.42, Rh * 1.3, 1.45)],
      [change.start, ck(0.3, Rh * 1.02, 0.85), ease.outCubic],
      [this.crack, ck(0.27, Rh, 0.85), ease.linear],
      [23.3, ck(-0.3, Rh * 1.1, 3.3), ease.inOutQuad],
      [23.5, ck(-0.32, Rh * 1.1, 3.25), ease.linear],
      [23.95, ck(-0.1, Rh * 0.95, 0.85), ease.inOutCubic],
      [T1, ck(-0.06, Rh * 0.84, 0.8), ease.linear],
    ];
    const cv = vkeys(t, keys);
    const [az, R, cy] = [cv.x, cv.y, cv.z];
    const C = new THREE.Vector3(0, CAP * 0.48, ROW_Z);
    const kick = notes.reduce((a, tn) => a + (t >= tn ? Math.exp(-(t - tn) / 0.05) * Math.cos((t - tn) * 60) : 0), 0);
    const pos = new THREE.Vector3(C.x + R * Math.sin(az), cy + 0.012 * kick, C.z + R * Math.cos(az));
    const at = new THREE.Vector3(C.x - 0.15 * Math.sin(az), C.y + 0.12 + 0.25 * prog(t, this.crack, 23.3, ease.inOutQuad) * (1 - prog(t, 23.5, 23.95, ease.inOutCubic)), C.z);
    this.st.cam.set(pos, at, FOV);
    const camP = this.st.cam.cam.position;

    // ---- the sherds
    const crackR = prog(t, this.crack - 0.03, this.crack + 0.14, ease.outCubic) * (wd.width * 0.62 + 60);
    const glowC = t >= this.crack ? 1.1 * pulse(t, this.crack + 0.04, 0.09) : 0;
    const P = new THREE.Vector3(), Q = this.q1, rp = new THREE.Vector3(), rq = this.q2;
    wd.letters.forEach((l, i) => {
      const hinge = popHinge(t, tPop(l.glyph));
      l.on = hinge < Math.PI / 2 - 1e-4 ? 1 : 0;
      l.s = s;
      const u = l.mat.uniforms;
      const tn = notes[this.wave[i]!]!, tf0 = tn - FLIGHT;
      let flip = 0, flipM = 0, glow = glowC;
      this.restPose(l, hinge, rp, rq);
      if (t < this.crack) { P.copy(rp); Q.copy(rq); }
      else {
        const H = this.hang(l, i, Math.min(t, tf0));
        let th = H.th, ph = H.ph;
        const off = H.off;
        if (t >= tf0) {
          // the slam: accelerating all the way in, the last of a full turn, landing on the note
          const k = ease.inCubic(prog(t, tf0, tn));
          off.multiplyScalar(1 - k);
          th = lerp(th, 2 * Math.PI, k); ph = lerp(ph, 0, k);
          if (t >= tn) {
            th = 2 * Math.PI; ph = 0; off.set(0, 0, 0);
            glow += 0.6 * pulse(t, tn, 0.05);
          }
        }
        // landed sherds jolt with every later landing
        for (const tm of notes) if (t >= tm && t >= tn) off.y -= 0.01 * Math.exp(-(t - tm) / 0.035);
        P.copy(rp).add(off);
        Q.setFromAxisAngle(H.axis, th).multiply(this.qz.setFromAxisAngle(EZ, ph)).multiply(rq);
        // turned over: the faces swap at the instant the sherd is edge-on to the camera
        // (and for the glaze's mirror image, as seen from the camera mirrored in the floor)
        const swapAt = (cx: number, cy: number, cz: number) => {
          const vx = cx - P.x, vy = cy - P.y, A = cz - P.z, B = H.axis.y * vx - H.axis.x * vy;
          return A > 1e-6 ? Math.atan2(B, A) - Math.PI / 2 + 2 * Math.PI : 1.5 * Math.PI;
        };
        flip = th >= swapAt(camP.x, camP.y, camP.z) ? 1 : 0;
        flipM = th >= swapAt(camP.x, -camP.y, camP.z) ? 1 : 0;
      }
      u.flip!.value = flip;
      this.flips[i] = flip; this.flipsM[i] = flipM;
      u.glowK!.value = glow;
      u.crackA!.value = t >= this.crack - 0.03 ? 1 : 0;
      u.crackR!.value = crackR;
      (u.crackO!.value as THREE.Vector2).set(wd.width * 0.5, wd.cap * 0.45);
      this.m.compose(P, Q, this.sv.set(s, s, s));
      l.mesh.matrix.copy(this.m);
    });
    wd.update();

    // "Do I need to": standing just behind where CHANGE? will stand; it falls back as CHANGE? rises
    const as = 0.68 / this.ask.cap;
    popWords(this.ask, [doW.start, iW.start, need.start, to.start], t, row(-(this.ask.width * as) / 2, ROW_Z - 0.7, 0, as), { exit: change.start - 0.02, exitDur: 0.2 });

    // ---- the fire behind us, over the right shoulder, high: the word's shadow falls to the left on the clay. Through
    // the hush it sinks and draws in (a shorter reach): the far wall darkens round the hanging sherds, which stay lit;
    // it comes back on the first note
    const hush = prog(t, this.crack + 0.4, 22.6, ease.inOutQuad) * (1 - prog(t, notes[0]! - 0.16, notes[0]!, ease.inQuad));
    const L = keyLight(this.st.cam, audio, t, { seed: 9, right: 5.5, up: 0.5, back: 2.5, I: 1.55 * lerp(1, 2.8, hush), reach: lerp(30, 8, hush) });
    const setFlips = (f: number[]) => wd.letters.forEach((l, i) => { l.mat.uniforms.flip!.value = f[i] ?? 0; });
    this.st.render(renderer, out, t, L, { wall: 1, wallZ: WALL_Z }, {
      noFlame: true, rim: 0.8, spec: 0.05,
      mirror: { before: () => setFlips(this.flipsM), after: () => setFlips(this.flips) },
    });
    const jolt = notes.reduce((a, tn) => a + pulse(t, tn, 0.05), 0);
    return { bloom: 0.55, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3, shake: [0.002 * jolt, 0.005 * jolt] };
  }
}

