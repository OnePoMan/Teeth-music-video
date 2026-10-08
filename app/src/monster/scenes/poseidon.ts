// `poseidon` — verse 2, lines 23–26 (docs/verse2-plan.md, "the god's board game"): "When a God comes down and makes
// a fleet drown / Is he scared that he's doing something wrong / Or does he keep us in check so we must respect him /
// And now no one dares to piss him off?"
// It opens on the god's silhouette from the opening (trident raised over the sea band) on the clay wall, and the camera
// cranes up from it over the board below: the sea seen from above as a game board, black mirror water, wine-dark,
// inside a clay border with a running-wave band, and on it the fleet as galley pieces in rows (bone-faced tokens with
// black-glazed sides, oars, a square sail). The god is never seen: his trident's shadow, cast by the fire behind us,
// sweeps onto the board on "comes down"; from "drown" it stabs a piece on each snare and the piece tips and goes under
// (rings bending the reflections only). Through "scared … wrong" it hangs over the board, trembling on the snare roll.
// "Or": he plays. On the snares the shadow rakes the last pieces into a corner and on "check" its prongs pin them
// there; on "respect" they brail up their sails. "And now no one dares": they go under on the snares, the water goes
// still and clear, and on the clay seabed the sunk fleet shows, painted in black-figure (the answer under the
// surface). The shadow lifts away on "off".
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, mulberry32, noise1, prog, pulse } from '../../engine/util';
import { flameState } from '../motifs';
import { Stage, StageCam, Word3D, popWords, vkeys, type Letter } from '../stage';
import { BOARD_HOOKS, Fleet, NP, WALL_Z, tridentUniforms } from './poseidon-board';

/** The fire behind us (a fixed world point: the trident's shadow and the words' must agree), its reach. */
const FIRE = new THREE.Vector3(6.5, 12.0, 13.0), REACH = 34;
const FOV = 40;
/** The hand that holds the trident (board x, z: off the board, behind us on the right) and the trident's scale. */
const HAND = { x: 5.4, z: 4.9 }, TS = 1.3, TIP = 1.5 * TS;
/** The fleet: three rows of four galleys, bows to the left (seen side on from above, as hulls), and the pieces' size. */
const ROWS = [-1.95, -1.1, -0.25], COLS = [-2.5, -0.9, 0.7, 2.3], ROW_DX = [0, 0.4, -0.2], PIECE_S = 1.2;
/** The pieces the trident stabs from "drown" on, one per snare, and the four it rakes into the far corner. */
const DROWNED = [10, 5, 3, 8, 7, 0, 2, 4];
const RAKED = [1, 9, 6, 11];
/** "check": where the middle prong comes down (near the far left corner), the trident's heading there (from the
 *  hand), and each raked piece's place in the two lanes between the prongs (lane -1/+1, distance back from the tip). */
const PIN = { x: -2.8, z: -1.6 };
const PIN_D = (() => { const dx = PIN.x - HAND.x, dz = PIN.z - HAND.z, l = Math.hypot(dx, dz); return { x: dx / l, z: dz / l }; })();
const LANE: Record<number, [number, number]> = { 1: [1, 0.55], 6: [1, 1.75], 9: [-1, 0.55], 11: [-1, 1.75] };
const CORNER: Record<number, [number, number]> = Object.fromEntries(Object.entries(LANE).map(([k, [lane, back]]) => {
  const off = lane * 0.375 * TS;                       // half the prongs' spacing
  return [k, [PIN.x - PIN_D.x * back - PIN_D.z * off, PIN.z - PIN_D.z * back + PIN_D.x * off]];
}));
/** The pieces' heading once raked: bows along the trident's axis, into the corner. */
const PIN_YAW = Math.atan2(-PIN_D.x, -PIN_D.z);
/** Where words stand (NDC y of their baseline under the camera at their first onset) and how much of the frame the
 *  hero fills. */
const HERO_Y = -0.5, SMALL_Y = -0.78, FILL = 0.55;

interface Phrase { w: Word3D; words: Word[]; exit: number; hero: boolean; x: number; z: number; yaw: number; cap: number }

export default class Poseidon extends Scene {
  private tri = tridentUniforms();
  private st = new Stage({
    hooks: `#define WALL_HOOK\nuniform float wallK;\nvec3 wallHook(vec3 P, vec3 col) { return col * wallK; }\n` + BOARD_HOOKS,
    uniforms: {
      ...this.tri,
      godOn: { value: 1 }, godT: { value: new THREE.Vector4(0.25, 0, 0.6, 0) }, clarity: { value: 0.28 }, tNow: { value: 0 }, wallK: { value: 1 },
      wreck: { value: Array.from({ length: NP }, () => new THREE.Vector4()) },
      ring: { value: Array.from({ length: NP }, () => new THREE.Vector4()) },
    },
  });
  private fleet!: Fleet;
  private phrases: Phrase[] = [];
  private lines!: [Line, Line, Line, Line];
  /** Per piece: when it goes under (Infinity: never in this plate), and its wreck's drift and angle. */
  private sinkAt: number[] = [];
  private wreckR: [number, number, number][] = [];
  /** Snares: the stabs, the rake's shoves, the last pieces' sinking; the snare rolls (trembling). */
  private stabs: number[] = [];
  private shoves: number[] = [];
  private rolls: number[] = [];
  private orch: number[] = [];
  private tmpCam = new StageCam();

  override async init() {
    const { lyrics, audio } = this.ctx;
    this.lines = [lyrics.get('When a God'), lyrics.get('Is he scared'), lyrics.get('Or does he keep'), lyrics.get('And now no one dares')];
    const [l1, l2, l3, l4] = this.lines;
    const drown = wd(l1, 'drown'), check = wd(l3, 'check');
    const sn = (a: number, b: number) => audio.events('snare', a, b).map(([t]) => t);
    // the stabs: the snare on "drown", then the snares that follow it, one piece each
    this.stabs = sn(drown.start - 0.05, l2.end).slice(0, DROWNED.length);
    while (this.stabs.length < DROWNED.length) this.stabs.push(drown.start + 0.33 * this.stabs.length);
    // the rake: the snares between "Or" and "check"
    const or = l3.words[0]!;
    this.shoves = sn(or.start + 0.2, check.start - 0.06).slice(-4);
    while (this.shoves.length < 4) this.shoves.push(check.start - 0.8 + 0.17 * this.shoves.length);
    // the end: the raked pieces go under two by two on the snares from the downbeat before "And now no one dares"
    const l4b = audio.timeOfBeat(Math.round(audio.beatAt(l4.words[1]!.start)));
    const last = sn(l4b - 0.06, wd(l4, 'dares').start).slice(0, 3);
    while (last.length < 3) last.push(l4b + 0.17 * last.length);
    this.rolls = sn(this.ctx.start, this.ctx.end);
    this.orch = audio.events('orch', this.ctx.start, this.ctx.end).map(([t]) => t);
    this.sinkAt = Array.from({ length: NP }, () => Infinity);
    DROWNED.forEach((p, k) => { this.sinkAt[p] = this.stabs[k]!; });
    RAKED.forEach((p, k) => { this.sinkAt[p] = last[Math.min(k, 2)]! + (k > 2 ? 0.05 : 0); });
    const rnd = mulberry32(90);
    this.wreckR = Array.from({ length: NP }, (_, i) => {
      const a = rnd() * Math.PI * 2;
      // half lie askew, half keel up (capsized)
      const ang = (rnd() - 0.5) * 1.3 + (i % 2 ? Math.PI : 0);
      return [0.14 * Math.cos(a), 0.14 * Math.sin(a), ang];
    });

    this.fleet = new Fleet(this.tri, NP, this.st.scene);

    // ---- the words: the hero of each line (Archivo 75/900, frame scale) and its small phrases (112.5/600)
    const hero = (s: string) => new Word3D(s, F.archivo(75, 900), { size: 220 });
    const small = (ws: Word[]) => new Word3D(ws.map((w) => w.w).join(' '), F.archivo(112.5, 600), { size: 200 });
    const P = (w: Word3D, words: Word[], exit: number, isHero = false, capK = 1): Phrase => {
      // (a small phrase stands where the camera looks as its last word is sung: the camera may be moving)
      const a = this.anchor(words[words.length - 1]!.start, isHero ? HERO_Y : SMALL_Y, w, isHero, capK);
      return { w, words, exit, hero: isHero, ...a };
    };
    const at = (l: Line, i: number) => l.words[i]!.start;
    const out = (t: number) => t - 0.06;
    const w1 = l1.words, w2 = l2.words, w3 = l3.words, w4 = l4.words;
    this.phrases = [
      // heroes first: they cast the shadows (a stage holds four casting runs)
      P(hero('DROWN'), [drown], out(at(l2, 0)), true),
      P(hero('SCARED?'), [wd(l2, 'scared')], out(at(l3, 0)), true),
      P(hero('CHECK'), [check], out(at(l4, 0)), true),
      P(hero('DARES?'), [wd(l4, 'dares')], this.ctx.end + 1, true),
      P(small(w1.slice(0, 3)), w1.slice(0, 3), out(at(l1, 3))),
      P(small(w1.slice(3, 5)), w1.slice(3, 5), out(at(l1, 5))),
      P(small(w1.slice(5, 9)), w1.slice(5, 9), out(drown.start)),
      P(small(w2.slice(0, 2)), w2.slice(0, 2), out(at(l2, 3))),
      P(small(w2.slice(3, 6)), w2.slice(3, 6), out(at(l2, 6))),
      P(small(w2.slice(6, 8)), w2.slice(6, 8), out(at(l3, 0))),
      P(small(w3.slice(0, 4)), w3.slice(0, 4), out(at(l3, 4))),
      P(small(w3.slice(4, 6)), w3.slice(4, 6), out(at(l3, 7))),
      P(small(w3.slice(7, 10)), w3.slice(7, 10), out(at(l3, 10))),
      P(small(w3.slice(10, 12)), w3.slice(10, 12), out(at(l4, 0)), false, 1.35),
      P(small(w4.slice(0, 4)), w4.slice(0, 4), out(at(l4, 5))),
      P(small(w4.slice(5, 9)), w4.slice(5, 9), this.ctx.end + 1),
    ];
    this.phrases.forEach((p, i) => this.st.add(p.w, { shadows: i < 4 }));
  }

  // ---------------------------------------------------------------- the camera
  /** The camera at t (no jolts): low before the wall, craned up over the board for "God", drifting each bar; on
   *  "Or" it swings toward the corner where he plays; for "no one dares" it rises to look down through the water. */
  private camPose(t: number) {
    const T0 = this.ctx.start, T1 = this.ctx.end;
    const D = this.ctx.audio.downbeats.filter((d) => d > T0 + 0.1 && d < T1 - 0.1);
    const [d1, d2, d3, d4] = [D[0] ?? 90.688, D[1] ?? 93.355, D[2] ?? 96.021, D[3] ?? 98.688];
    const or = this.lines[2].words[0]!.start;
    const pos = vkeys(t, [
      [T0, [0, 1.25, 7.2]],
      [d1 - 0.38, [0, 1.3, 7.0], ease.linear],
      [d1, [0.3, 6.6, 5.9], ease.inOutCubic],
      [d2, [-0.35, 6.35, 5.75], ease.inOutQuad],
      [or, [0.35, 6.25, 5.8], ease.inOutQuad],
      // "Or": round behind the trident's hand, looking down its shadow into the corner where he plays
      [d3, [PIN.x - PIN_D.x * 6.6 + 0.4, 5.4, PIN.z - PIN_D.z * 6.6 + 0.5], ease.inOutCubic],
      [d4 - 0.45, [PIN.x - PIN_D.x * 6.2 + 0.4, 5.2, PIN.z - PIN_D.z * 6.2 + 0.5], ease.linear],
      [d4, [0, 8.0, 4.7], ease.inOutCubic],
      [T1, [0, 7.7, 4.45], ease.linear],
    ]);
    const at = vkeys(t, [
      [T0, [0, 1.5, WALL_Z]],
      [d1 - 0.38, [0, 1.5, WALL_Z], ease.linear],
      [d1, [0, 0, 0.3], ease.inOutCubic],
      [d2, [0.1, 0, 0.2], ease.inOutQuad],
      [or, [-0.1, 0, 0.25], ease.inOutQuad],
      [d3, [PIN.x - PIN_D.x * 1.9, 0, PIN.z - PIN_D.z * 1.9], ease.inOutCubic],
      [d4 - 0.45, [PIN.x - PIN_D.x * 1.8, 0, PIN.z - PIN_D.z * 1.8], ease.linear],
      [d4, [0, 0, -0.15], ease.inOutCubic],
      [T1, [0, 0, -0.2], ease.linear],
    ]);
    return { pos, at, d1, d4 };
  }

  /** Where a phrase stands: on the board under the camera as it is at the phrase's first onset (baseline at NDC y),
   *  facing that camera, sized to the frame there. */
  private anchor(t: number, ndcY: number, w: Word3D, hero: boolean, capK: number) {
    const { pos, at } = this.camPose(t);
    const c = this.tmpCam;
    c.set(pos, at, FOV);
    const p = new THREE.Vector3(0, ndcY, 0.5).unproject(c.cam);
    const dir = p.sub(c.cam.position).normalize();
    const s = -pos.y / Math.min(dir.y, -1e-3);
    const A = pos.clone().addScaledVector(dir, s);
    const view = at.clone().sub(pos).normalize();
    const d = A.clone().sub(pos).dot(view);
    const fh = 2 * d * Math.tan((FOV * Math.PI) / 360), fw = fh * (16 / 9);
    const cap = hero ? Math.min((FILL * fw) / (w.width / w.cap), 0.24 * fh) : 0.052 * fh * capK;
    return { x: A.x, z: A.z, yaw: Math.atan2(pos.x - A.x, pos.z - A.z), cap };
  }

  // ---------------------------------------------------------------- the pieces
  private base(i: number) {
    const r = Math.floor(i / 4), c = i % 4;
    return { x: COLS[c]! + ROW_DX[r]!, z: ROWS[r]! };
  }
  /** The rake's progress (0..1): a shove on each of its snares. */
  private rake(t: number) {
    return this.shoves.reduce((a, s) => a + prog(t, s - 0.03, s + 0.11, ease.outCubic), 0) / this.shoves.length;
  }
  /** Where piece i floats at t (before it sinks). */
  private piecePos(i: number, t: number) {
    const b = this.base(i), c = CORNER[i];
    if (!c) return b;
    const h = this.rake(t);
    return { x: lerp(b.x, c[0], h), z: lerp(b.z, c[1], h) };
  }
  private tremble(t: number, seed: number) {
    let a = 0;
    for (const s of this.rolls) if (t >= s && t < s + 0.3) a += pulse(t, s, 0.05) * Math.sin((t - s) * 70 + seed);
    return a;
  }

  // ---------------------------------------------------------------- the trident's shadow
  /** Heading and reach (hand to crossbar) that put the middle prong's tip on (x, z), less `back`. */
  private aim(x: number, z: number, back = 0) {
    const dx = x - HAND.x, dz = z - HAND.z;
    return { th: Math.atan2(dz, dx), r: Math.hypot(dx, dz) - TIP - back };
  }
  private tridentPose(t: number) {
    const [l1, , l3] = this.lines;
    const comes = wd(l1, 'comes'), down = wd(l1, 'down'), or = l3.words[0]!, check = wd(l3, 'check');
    const fleetC = { x: 0, z: -0.95 };
    const hover = this.aim(fleetC.x, fleetC.z, 0.9);
    let th: number, r: number;
    // it sweeps onto the board on "comes down", like a clock hand pivoting on the hand behind us
    const th0 = Math.atan2(0.5, 1);
    if (t < down.start) {
      const u = ease.inCubic(prog(t, comes.start, down.start));
      th = lerp(th0, hover.th, u); r = hover.r;
    } else {
      // a slow menace over the fleet, then a stab on each snare from "drown"
      th = hover.th + 0.05 * Math.sin((t - down.start) * 2.2); r = hover.r + 0.15 * Math.sin((t - down.start) * 1.7);
      let prevT = down.start, prev = { th, r };
      prev = { th: hover.th + 0.05 * Math.sin((this.stabs[0]! - 0.3 - down.start) * 2.2), r: hover.r };
      for (let k = 0; k < this.stabs.length; k++) {
        const S = this.stabs[k]!, p = this.base(DROWNED[k]!), A = this.aim(p.x, p.z);
        const a = k === 0 ? S - 0.3 : prevT;
        if (t < a) break;
        if (t < a + 0.04) { th = prev.th; r = prev.r; }
        else if (t < S - 0.08) { const u = ease.inOutQuad(prog(t, a + 0.04, S - 0.08)); th = lerp(prev.th, A.th, u); r = lerp(prev.r, A.r - 0.6, u); }
        else { const u = ease.inCubic(prog(t, S - 0.08, S)); th = A.th; r = lerp(A.r - 0.6, A.r, u); }
        prev = A; prevT = S;
      }
      // after the last stab: it draws back over what is left of the fleet and hangs there, trembling on the roll
      const lastS = this.stabs[this.stabs.length - 1]!;
      if (t > lastS + 0.05) {
        const H = this.aim(0.2, -1.0, 1.1);
        const u = ease.inOutQuad(prog(t, lastS + 0.05, lastS + 0.6));
        th = lerp(prev.th, H.th, u); r = lerp(prev.r, H.r, u);
        // "Or": he plays. Behind the raked pieces, pushing them along its axis into the corner on each shove
        const cen = RAKED.reduce((a, p) => { const q = this.piecePos(p, t); return { x: a.x + q.x / RAKED.length, z: a.z + q.z / RAKED.length }; }, { x: 0, z: 0 });
        const R = this.aim(cen.x, cen.z, 0.75);
        const v = ease.inOutCubic(prog(t, or.start, this.shoves[0]! - 0.05));
        th = lerp(th, R.th, v); r = lerp(r, R.r, v);
        // "check": the prongs come down on the corner and pin them
        const C = this.aim(PIN.x, PIN.z);
        const k = ease.inCubic(prog(t, check.start - 0.12, check.start));
        th = lerp(th, C.th, k); r = lerp(r, C.r, k);
      }
    }
    const trem = this.tremble(t, 1.3);
    th += 0.012 * trem; r += 0.05 * trem;
    // it lifts away on "off": its shadow grows toward us, blurs and is gone
    const off = wd(this.lines[3], 'off');
    const lift = 2.4 * ease.inQuad(prog(t, off.start, this.ctx.end));
    const alpha = 1 - prog(t, off.start + 0.15, this.ctx.end - 0.02, ease.inQuad);
    return { th, r, lift, alpha };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const T0 = this.ctx.start;
    const u = this.st.bg.u;
    const check = wd(this.lines[2], 'check'), respect = wd(this.lines[2], 'respect');

    // ---- the camera, with a jolt on the orchestra's hits, the stabs and "check"
    const { pos, at, d1, d4 } = this.camPose(t);
    const jolts = [...this.orch, ...this.stabs, check.start];
    const jolt = jolts.reduce((a, j) => a + pulse(t, j, 0.06), 0);
    pos.y += 0.03 * jolt * noise1(t * 40, 3); pos.x += 0.025 * jolt * noise1(t * 40, 5);
    this.st.cam.set(pos, at, FOV);
    const camP = this.st.cam.cam.position;

    // ---- the opening: the god on the wall (the fire leaves the wall as the camera cranes up over the board)
    const toBoard = prog(t, d1 - 0.38, d1, ease.inOutCubic);
    u.godOn!.value = 1 - prog(t, d1 - 0.2, d1, ease.inQuad);
    (u.godT!.value as THREE.Vector4).set(0.25 + 0.02 * noise1(t * 5.3, 43), 0, 0.6 * (1 + 0.005 * noise1(t * 6.1, 41)), 0);
    u.wallK!.value = 1 - toBoard;

    // ---- the trident's shadow
    const tp = this.tridentPose(t);
    (this.tri.triA.value as THREE.Vector4).set(HAND.x, HAND.z, tp.th, tp.r);
    (this.tri.triB.value as THREE.Vector4).set(TS, tp.lift, tp.alpha * prog(t, T0, d1), 0.02);
    (this.tri.triC.value as THREE.Vector2).set(FIRE.x * 0.6, FIRE.z * 0.5);

    // ---- the pieces
    const wrecks = u.wreck!.value as THREE.Vector4[], rings = u.ring!.value as THREE.Vector4[];
    this.fleet.pieces.forEach((pc, i) => {
      const ts = this.sinkAt[i]!;
      const p = this.piecePos(i, Math.min(t, ts));
      const sink = prog(t, ts - 0.02, ts + 0.45);
      const g = pc.grp;
      const trem = this.tremble(t, i * 1.7);
      // pinned: once "check" has struck, the raked pieces stop bobbing and jolt down
      const pinned = CORNER[i] && t >= check.start ? 1 : 0;
      const bob = (1 - pinned) * 0.012 * Math.sin(t * 2.1 + i * 1.3);
      g.position.set(p.x, bob - 0.85 * ease.inQuad(sink) - 0.02 * pinned * pulse(t, check.start, 0.08) + 0.012 * trem, p.z);
      g.scale.setScalar(PIECE_S);
      g.rotation.set(-1.0 * ease.inOutQuad(sink) + 0.02 * Math.sin(t * 1.7 + i), lerp(Math.PI / 2, PIN_YAW, CORNER[i] ? ease.inOutQuad(this.rake(Math.min(t, ts))) : 0) + 0.04 * Math.sin(i * 2.3), (1 - pinned) * 0.035 * Math.sin(t * 1.9 + i * 0.7) + 0.06 * trem + 0.4 * ease.inQuad(sink) * (i % 2 ? 1 : -1), 'YXZ');
      g.visible = sink < 1;
      // "respect": the sails are brailed up to the yard
      const br = prog(t, respect.start - 0.04 + 0.035 * RAKED.indexOf(i), respect.start + 0.18 + 0.035 * RAKED.indexOf(i), ease.inOutCubic);
      pc.sail.scale.y = CORNER[i] ? 1 - 0.85 * br : 1;
      pc.glow.value = t >= ts ? 0.7 * pulse(t, ts, 0.09) : 0;
      // the wreck it leaves, painted on the seabed; the rings where it went under
      const wr = this.wreckR[i]!;
      const spread = CORNER[i] ? 1 : 0;
      const ex = p.x + wr[0] + spread * 0.5 * (p.x - PIN.x), ez = p.z + wr[1] + spread * 0.5 * (p.z - PIN.z);
      wrecks[i]!.set(ex, ez, wr[2], prog(t, ts + 0.2, ts + 0.85, ease.inOutQuad));
      rings[i]!.set(p.x, p.z, ts, t >= ts ? 0.011 : 0);
    });

    // ---- the words: each phrase stands where it was put, facing the camera, leaning back so its face is square to it
    for (const ph of this.phrases) {
      const s = ph.cap / ph.w.cap, W = ph.w.width * s;
      const dx = Math.cos(ph.yaw), dz = -Math.sin(ph.yaw);
      const x0 = ph.x - (dx * W) / 2, z0 = ph.z - (dz * W) / 2;
      popWords(ph.w, ph.words.map((w) => w.start), t, (l: Letter) => {
        l.x = x0 + dx * l.penX * s; l.z = z0 + dz * l.penX * s; l.y = 0; l.yaw = ph.yaw; l.s = s;
      }, { exit: ph.exit, exitDur: ph.hero ? 0.16 : 0.1, exitRipple: ph.hero ? 0.01 : 0, glow: ph.hero ? 0.55 : 0.4, amb: ph.hero ? 0.04 : 0.08 });
      const lean = Math.min(1.1, Math.max(0, Math.atan2(camP.y - ph.cap * 0.4, Math.hypot(camP.x - ph.x, camP.z - ph.z))));
      for (const l of ph.w.letters) {
        l.hinge = lean + l.hinge * (1 - lean / (Math.PI / 2));
        if (l.hinge > 1.2) l.on = 0;
      }
      ph.w.update();
    }

    // ---- the water: still and clear once the board is swept ("no one dares"), the fleet painted on the seabed
    const still = prog(t, d4, d4 + 0.6, ease.inOutQuad);
    u.clarity!.value = lerp(0.3, 0.85, still);
    u.tNow!.value = t;

    // ---- the fire behind us, flaring on the orchestra's hits
    const fl = flameState(audio, t, 0);
    const L = { base: FIRE, h: 0.6, I: 2.3 * fl.I * (0.75 + 0.25 * prog(t, T0, T0 + 0.25)), reach: REACH };
    this.fleet.light(this.st.lightCentre(L).clone(), L.I, L.reach, camP);
    const clip = this.fleet.shared.clipSign;
    this.st.render(renderer, out, t, L, { wall: 1, wallZ: WALL_Z, gloss: 0.8, swell: lerp(0.35, 0, still), wine: 0.7, reflBend: 0.3 }, {
      noFlame: true, rim: 0.8, spec: 0.05,
      mirror: { before: () => { clip.value = -1; }, after: () => { clip.value = 1; } },
    });
    return { bloom: 0.55, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3, shake: [0.0015 * jolt, 0.003 * jolt] };
  }
}

/** The word of a line whose letters (lower case, no punctuation) are `s`. */
function wd(l: Line, s: string): Word {
  const w = l.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s);
  if (!w) throw new Error(`word not found: ${s} in ${l.text}`);
  return w;
}
