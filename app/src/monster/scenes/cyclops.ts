// `cyclops` — verse 2, stanza 1 (lines 15–18): "his eye is the cave mouth" (docs/verse2-plan.md, option A).
// Inside the cave, the fire behind us (never seen). Polyphemus' shadow fills the clay wall ahead, head and shoulders;
// his one eye is the cave mouth: an almond of night with the moon in it for a pupil, and a boulder of clay that
// rolls across it like an eyelid. The words stand on the black-glaze floor between us and the wall.
//  - Open: the opening's silhouette, small and low, the eye shut, the boulder in the mouth above his head, the fire
//    low; "Is the" small. On the drums' entry the fire flares and the shadow looms up the wall (a puppet's rise) until
//    his eye is the boulder. GUILT? stands on "guilt"; his club is lifted on the snare and comes down beside the word
//    on "kills".
//  - "Up": the boulder rolls clear and the eye opens on the night; NIGHT?.
//  - "Or": the camera turns from the eye to the wall beside it; on the six snares of bar 3 his club strikes the clay
//    and each blow leaves a black tally stroke (MEN small, AVENGE before the tally).
//  - "Sleep": back to the eye; the boulder rolls across the mouth, the eye shuts, the club sinks; RIGHT? stands in
//    front of the shut eye into the cut.
// Kit candidates (to move into the shared kit once the chorus 1 branch is merged): the giant as a bust with a free
// club angle and the wall hook's cave mouth (cyclops-giant.ts), centredRow/hideFlat/faceYaw/phrases (cyclops-kit.ts).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, keys, lerp, noise1, prog, pulse, type Key } from '../../engine/util';
import { POP, Stage, Word3D, keyLight, popHinge, popWords, vkeys } from '../stage';
import { CLUB, CYCLOPS_HOOKS, MOUTH, N_TALLY } from './cyclops-giant';
import { centredRow, faceYaw, hideFlat, phrases, type Phrase } from './cyclops-kit';

/** The clay wall; the camera's vertical fov. */
const WALL_Z = -9, FOV = 42;
/** The giant (world per figure unit, base y): small and low as in the opening, then loomed up. */
const GIANT = { s0: 0.75, b0: -1.0, s1: 1.1, b1: 0 };
/** Where the words stand: the hero before the wall, the small words nearer us; their cap heights; the hero's share
 *  of the frame's width. */
const HERO_Z = -5.4, SMALL_Z = -2.0, SMALL_CAP = 0.36, HERO_CAP = 2.8, HERO_FILL = 0.62;
/** A line whose hero is followed by small words: the hero a little narrower, the words beside it on its row. */
const HERO_FILL_POST = 0.5, POST_CAP = 0.5;
/** The tally (figure units): six strokes beside his eye, the fifth across the first four. */
const TALLY: [number, number, number, number][] = [
  [5.9, 5.55, 5.9, 7.05], [6.35, 5.55, 6.35, 7.05], [6.8, 5.55, 6.8, 7.05], [7.25, 5.55, 7.25, 7.05],
  [5.55, 5.75, 7.6, 6.85], [8.15, 5.55, 8.15, 7.05],
];
const HERO_FONT = () => F.archivo(75, 900), SMALL_FONT = () => F.archivo(112.5, 600);

interface Staged { p: Phrase; w: Word3D; line: number; exit: number; dur: number; post: boolean }

export default class Cyclops extends Scene {
  private st = new Stage({
    hooks: CYCLOPS_HOOKS,
    maxCards: 24,
    uniforms: {
      gT: { value: new THREE.Vector4(0, 0, 1, 1) }, clubR: { value: 0 },
      mouth: { value: new THREE.Vector4() }, bould: { value: new THREE.Vector4() },
      tal: { value: Array.from({ length: N_TALLY }, () => new THREE.Vector4()) },
      talOn: { value: new Array(N_TALLY).fill(0) }, nightK: { value: 0 }, pool: { value: new THREE.Vector4(0, 4, 9, 1) },
    },
  });
  private lines: Line[] = [];
  private staged: Staged[] = [];
  /** Event times (from the lyrics and audio.json; see init). */
  private ev = { loom: 69.34, windup: 70.99, kills: 71.26, bar2: 72.022, up: 72.11, night: 73.38, or: 73.83, bar3: 74.688, avenge: 75.88, and: 76.87, sleep: 77.22, bar4: 77.355, right: 78.68 };
  private strikes: number[] = [];
  private clubKeys: Key[] = [];
  /** The tally strokes' world segments and each one's club angle. */
  private tallyW: [number, number, number, number][] = [];

  override async init() {
    const { lyrics: ly, audio: au } = this.ctx;
    this.lines = [ly.get('Is the cyclops'), ly.get('Is he up in the middle'), ly.get('Or does he end'), ly.get('And then sleep')];
    const [L1, L2, L3, L4] = this.lines as [Line, Line, Line, Line];
    const nextDown = (t: number) => au.downbeats.find((d) => d > t + 0.05) ?? t + 2.667;
    const ev = this.ev;
    ev.loom = au.events('snare', this.ctx.start, this.ctx.start + 1.5)[0]?.[0] ?? nextDown(this.ctx.start);
    ev.kills = L1.words[8]!.start;
    ev.windup = au.events('snare', ev.kills - 0.6, ev.kills - 0.05).at(-1)?.[0] ?? ev.kills - 0.27;
    ev.bar2 = nextDown(ev.kills); ev.up = L2.words[2]!.start; ev.night = L2.words[8]!.start;
    ev.or = L3.words[0]!.start; ev.bar3 = nextDown(ev.or); ev.avenge = L3.words[7]!.start;
    ev.and = L4.words[0]!.start; ev.sleep = L4.words[2]!.start; ev.bar4 = nextDown(ev.sleep - 0.3); ev.right = L4.words[8]!.start;
    this.strikes = au.events('snare', ev.bar3 - 0.1, ev.bar3 + 2.0).map(([t]) => t).slice(0, N_TALLY);
    while (this.strikes.length < N_TALLY) this.strikes.push(ev.bar3 + 0.333 * this.strikes.length);

    // ---- the words: one phrase on screen; the hero alone; pre-hero phrases fold as the next one springs, the hero and
    // what follows it stay to the end of the line (the next line's first word, or the cut)
    const groups: [number[][], number, string][] = [
      [[[0, 1, 2], [3, 4], [5], [6, 7, 8]], 5, 'GUILT?'],
      [[[0, 1, 2], [3, 4, 5], [6, 7], [8]], 8, 'NIGHT?'],
      [[[0], [1, 2], [3, 4, 5, 6], [7], [8, 9]], 7, 'AVENGE'],
      [[[0, 1, 2], [3, 4, 5], [6, 7], [8]], 8, 'RIGHT?'],
    ];
    const heroes: Staged[] = [], smalls: Staged[] = [];
    groups.forEach(([g, hero, heroText], li) => {
      const line = this.lines[li]!;
      const ph = phrases(line, g, hero);
      const next = this.lines[li + 1];
      // (a crisp hand-over: the line is folded flat as the next line's first word springs up)
      const lineExit = next ? next.words[0]!.start - POP.lead - 0.11 : this.ctx.end + 1;
      const heroAt = ph.findIndex((p) => p.hero);
      ph.forEach((p, k) => {
        const nx = ph[k + 1];
        let exit = lineExit, dur = 0.1;
        if (k < heroAt) { exit = nx!.words[0]!.start - POP.lead - (k === heroAt - 1 ? 0 : 0.075); dur = k === heroAt - 1 ? 0.12 : 0.07; }
        const w = p.hero ? new Word3D(heroText, HERO_FONT(), { size: 220 }) : new Word3D(p.text, SMALL_FONT(), { size: 200 });
        (p.hero ? heroes : smalls).push({ p, w, line: li, exit, dur, post: k > heroAt });
      });
    });
    // the heroes cast shadows on the clay (four atlases); the small words none
    for (const s of heroes) this.st.add(s.w);
    for (const s of smalls) this.st.add(s.w, { shadows: false });
    this.staged = [...heroes, ...smalls];

    // ---- the tally (world) and the club's angle for each blow
    const S = GIANT.s1, [px, py] = CLUB.piv;
    this.tallyW = TALLY.map(([ax, ay, bx, by]) => [ax * S, GIANT.b1 + ay * S, bx * S, GIANT.b1 + by * S]);
    const aim = TALLY.map(([ax, ay, bx, by]) => Math.atan2((ay + by) / 2 - py, (ax + bx) / 2 - px));
    // ---- the club's angle through the plate (radians ccw, absolute): raised at rest; lifted back on the snare before
    // "kills" and down beside the word on it; up again on "Or"; a blow on each snare of bar 3; sunk on "sleep"
    const up = CLUB.phi0, back = up + 0.32, down = -0.62, slump = -0.95;
    const k: Key[] = [[this.ctx.start, up], [ev.windup - 0.04, up, ease.linear], [ev.windup + 0.12, back, ease.outQuad],
      [ev.kills - 0.08, back + 0.04, ease.linear], [ev.kills, down, ease.inQuad], [ev.kills + 0.07, down + 0.05, ease.outQuad],
      [ev.kills + 0.16, down, ease.inQuad], [ev.or, down, ease.linear], [ev.or + 0.4, back, ease.inOutCubic]];
    let prev = ev.or + 0.4;
    this.strikes.forEach((s, i) => {
      const gap = s - prev, dd = Math.min(0.09, gap * 0.45);
      k.push([s - dd, back, ease.inOutQuad]);
      k.push([s, aim[i]!, ease.inQuad]);
      prev = s + Math.min(0.05, gap * 0.3);
      k.push([prev, aim[i]!, ease.linear]);
    });
    const last = prev;
    k.push([last + 0.3, up, ease.inOutCubic]);
    if (ev.sleep > last + 0.35) k.push([ev.sleep, up, ease.linear]);
    k.push([Math.max(ev.sleep, last + 0.35) + 0.55, slump, ease.inOutCubic]);
    this.clubKeys = k;
  }

  /** The camera: the eye shot (bars 1, 2, 4) and the wall beside the eye (bar 3). */
  private camera(t: number) {
    const e = this.ev, T0 = this.ctx.start, T1 = this.ctx.end;
    const pos = vkeys(t, [
      [T0, [0, 2.2, 10.6]],
      [e.loom, [0, 2.2, 10.45], ease.linear],
      [e.loom + 0.9, [0, 2.3, 9.4], ease.outCubic],
      [e.bar2, [0.2, 2.3, 9.2], ease.linear],
      [e.or, [0, 2.45, 8.8], ease.inOutQuad],
      [e.or + 0.25, [0, 2.45, 8.78], ease.linear],
      [e.bar3, [3.6, 2.4, 8.9], (x) => ease.inOutQuart(x)],
      [e.and, [3.85, 2.4, 8.75], ease.linear],
      [e.bar4, [0, 2.35, 9.2], ease.inOutCubic],
      [T1, [0, 2.35, 8.7], ease.linear],
    ]);
    const at = vkeys(t, [
      [T0, [0, 3.4, WALL_Z]],
      [e.loom, [0, 3.4, WALL_Z], ease.linear],
      [e.loom + 0.9, [0, 3.8, WALL_Z], ease.outCubic],
      [e.bar2, [0.05, 3.8, WALL_Z], ease.linear],
      [e.or, [0, 4.0, WALL_Z], ease.inOutQuad],
      [e.or + 0.25, [0, 4.0, WALL_Z], ease.linear],
      [e.bar3, [6.4, 4.1, WALL_Z], (x) => ease.inOutQuart(x)],
      [e.and, [6.6, 4.1, WALL_Z], ease.linear],
      [e.bar4, [0, 3.85, WALL_Z], ease.inOutCubic],
      [T1, [0, 3.9, WALL_Z], ease.linear],
    ]);
    return { pos, at };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx, e = this.ev, u = this.st.bg.u;

    // ---- the camera, with a jolt on the club's landings
    const lands = [e.kills, ...this.strikes];
    const jolt = lands.reduce((a, l, i) => a + (i === 0 ? 1.4 : 1) * pulse(t, l, 0.06), 0) + 0.8 * pulse(t, e.loom, 0.1);
    const { pos, at } = this.camera(t);
    pos.x += 0.025 * jolt * noise1(t * 37, 3); pos.y += 0.035 * jolt * noise1(t * 41, 5);
    this.st.cam.set(pos, at, FOV);

    // ---- the giant: low and small, then loomed up on the drums' entry (a puppet's rise, overshooting a little)
    const lu = prog(t, e.loom, e.loom + 0.6, (x) => ease.outBack(x, 1.2));
    const gs = lerp(GIANT.s0, GIANT.s1, lu), gb = lerp(GIANT.b0, GIANT.b1, lu);
    const gx = 0.02 * noise1(t * 1.3, 7);
    (u.gT!.value as THREE.Vector4).set(gx, gb, gs, 1);
    u.clubR!.value = keys(t, this.clubKeys) - CLUB.phi0;

    // ---- the cave mouth: the boulder rolls clear on "up" and back across on "sleep"; the eye opens and shuts with it
    const open = prog(t, e.up - 0.04, e.up + 0.5, ease.inOutQuad), shut = prog(t, e.sleep - 0.02, e.sleep + 0.42, ease.inOutQuad);
    const r = open * (1 - shut);
    const bx = MOUTH.clear[0] * r, by = MOUTH.clear[1] * r + 0.18 * Math.sin(Math.PI * r);
    (u.bould!.value as THREE.Vector4).set(bx, by, -bx / MOUTH.rb, 1);
    const eyeOpen = Math.min(prog(open, 0.25, 1, ease.outCubic), 1 - prog(shut, 0, 0.6, ease.inOutQuad));
    // (the mouth and its boulder ride on the shadow's eye: across it from the first frame, rising with it)
    (u.mouth!.value as THREE.Vector4).set(gx, gb + MOUTH.eyeY * gs, gs, eyeOpen);
    u.nightK!.value = prog(t, e.night - 0.02, e.night + 0.3, ease.outCubic) * (1 - shut) + 0.6 * pulse(t, e.night, 0.25);

    // ---- the tally, one stroke per blow
    const tal = u.tal!.value as THREE.Vector4[], talOn = u.talOn!.value as number[];
    this.tallyW.forEach((s, i) => {
      tal[i]!.set(...s);
      talOn[i] = prog(t, this.strikes[i]! - 0.005, this.strikes[i]! + 0.04, ease.outCubic);
    });

    // ---- the words. Each line stands on the camera's axis as it will be while it is up, facing it (no swimming): the
    // hero where the camera lands, a small phrase before it where the camera is halfway through its life (the turn pans
    // across "does he"). A small phrase after the hero stands beside it on the same row, clear of it and its reflection.
    const tanH = Math.tan((FOV * Math.PI) / 360) * (16 / 9);
    const heroRow = (li: number) => {
      const h = this.staged.find((x) => x.p.hero && x.line === li)!, post = this.staged.find((x) => x.post && x.line === li);
      const t0 = h.p.words[0]!.start + 0.3;
      const { pos: cp, at: ca } = this.camera(t0);
      const cx = cp.x + ((ca.x - cp.x) * (cp.z - HERO_Z)) / (cp.z - ca.z), fw = 2 * (cp.z - HERO_Z) * tanH;
      const hs = Math.min(HERO_CAP / h.w.cap, ((post ? HERO_FILL_POST : HERO_FILL) * fw) / h.w.width);
      const ps = post ? POST_CAP / post.w.cap : 0, hw = h.w.width * hs, pw = post ? post.w.width * ps : 0, gap = post ? 0.55 : 0;
      const x0 = cx - (hw + gap + pw) / 2;
      return { cp, hs, ps, hx: x0 + hw / 2, px: x0 + hw + gap + pw / 2 };
    };
    for (const s of this.staged) {
      const w = s.w, ons = s.p.words.map((x: Word) => x.start);
      if (s.p.hero) {
        const R = heroRow(s.line), cp = R.cp, k = w.letters.length;
        // the hero's letters land across its sung syllables (as CHANGE?), all up within ~0.22 s
        const w0 = s.p.words[0]!;
        const tk = (i: number) => w0.start + (i / Math.max(1, k - 1)) * Math.min(0.22, Math.max(0.12, w0.end - w0.start - 0.05));
        const place = centredRow(w, R.hx, HERO_Z, faceYaw(R.hx, HERO_Z, cp.x, cp.z), R.hs);
        w.letters.forEach((l, i) => {
          place(l);
          const upH = popHinge(t, tk(i));
          const gone = prog(t, s.exit + i * 0.012, s.exit + i * 0.012 + s.dur, ease.inCubic);
          l.hinge = upH + (Math.PI / 2 - upH) * gone;
          l.on = t >= tk(i) - POP.lead && gone < 0.999 ? 1 : 0;
          l.mat.uniforms.glow!.value = 0.5 * pulse(t, tk(i), 0.07) * (t >= tk(i) - 0.02 ? 1 : 0) * l.on;
        });
        w.update();
      } else if (s.post) {
        const R = heroRow(s.line);
        popWords(w, ons, t, centredRow(w, R.px, HERO_Z, faceYaw(R.px, HERO_Z, R.cp.x, R.cp.z), R.ps), { exit: s.exit, exitDur: s.dur, exitRipple: 0, glow: 0.3 });
      } else {
        const tPose = (ons[0]! + Math.min(s.exit, ons[0]! + 1.2)) / 2;
        const { pos: cp, at: ca } = this.camera(tPose);
        const cx = cp.x + ((ca.x - cp.x) * (cp.z - SMALL_Z)) / (cp.z - ca.z);
        popWords(w, ons, t, centredRow(w, cx, SMALL_Z, faceYaw(cx, SMALL_Z, cp.x, cp.z), SMALL_CAP / w.cap), { exit: s.exit, exitDur: s.dur, exitRipple: 0, glow: 0.3 });
      }
      hideFlat(w, 0.85);
    }

    // ---- the fire behind us: low at the open, flaring up on the drums' entry; it breathes and flares on the orch hits
    const fireUp = lerp(0.38, 1, prog(t, e.loom - 0.02, e.loom + 0.15, ease.outCubic)) + 0.5 * pulse(t, e.loom, 0.18);
    const L = keyLight(this.st.cam, audio, t, { seed: 15, right: 7.5, up: 0.2, back: 2.8, I: 1.5 * fireUp, reach: 34 });
    // the fire's pool on the wall: centred where the camera looks, the edges of the frame falling off into the dark
    (u.pool!.value as THREE.Vector4).set(at.x - 0.6, at.y + 0.8, 7.0, 0.2);
    this.st.render(renderer, out, t, L, { wall: 1, wallZ: WALL_Z, gloss: 0.26 }, { noFlame: true, rim: 0.8, spec: 0.05 });
    return { bloom: 0.55, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3, shake: [0.002 * jolt, 0.005 * jolt] };
  }
}
