// `mirror` — the rest of chorus 1, lines 9–14 (docs/MONSTER.md; client 2026-10-08, "the answer under the surface";
// shot plan in docs/mirror-plan.md). We stay on hook 1's shore (`../shore.ts`) and glide along it, low and
// continuous; each line's hero word stands up on the waterline as we pass, lit, with no mirror image of its own. The
// water answers rarely, and right way round, painted in black-figure on the clay under the surface:
//   WRONG? stands alone, clean. PROBLEM stands, and on "hiding" HIDING appears under it, and lingers, sinking slowly
//   into line 11. From "killed you" to "caved" the shades of the dead (souls' figures) appear lying under the surface
//   one by one, and GUILT? stands above them. FOES and OURSELVES? stand either side of a balance painted across the
//   waterline: FOES' pan rises out of the water (bone, lit, above the line), OURSELVES' pan sinks into it. MONSTER?
//   ends it, with hook 1's dip to the waterline, its answer MONSTER under the surface bigger than the word.
// The small words float near the camera and travel with it, one phrase at a time, below the clay. Cuts only on
// strong downbeats with no word popping near them, the waterline at the same height across each cut.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { H as HPX } from '../../engine/gl';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { clamp, ease, keys, lerp, noise1, prog, pulse } from '../../engine/util';
import { GLSL_SHADE } from '../motifs';
import { Stage, Word3D, keyLight, popHinge, popWords } from '../stage';
import {
  Answer, FOV, LOW, SHORE_KEY, SHORE_OPTS, SHORE_POST, SHORE_SURF, WORD_Z, bob, heroFont, heroScale, hideFlat, lowPushZ,
  setRegion, shoreStage,
} from '../shore';

const HALF = Math.PI / 2;
/** The glide: its speed (world units/s), height and pitch (the waterline at ~0.52 H). */
const GLIDE = { v: 3.0, y: 0.3, pitch: 0.002 };
/** The small words: baseline on screen (fraction of H from the top) and cap height (fraction of H); the clay
 *  field ends above them (BOT). */
const PH = { y: 0.84, cap: 0.055 }, BOT = 0.77;
/** An answer's top under the surface (fraction of the hero's cap height). */
const GAP = 0.06;
/** The shades: their length lying down, spacing and depths under the surface (world units). */
const SHADE = { len: 4.2, step: 5.4, depth: [1.2, 1.85], tilt: [0.06, -0.05, 0.03, -0.07, 0.05] };
/** The balance (world units): FOES-OURSELVES gap, arm, pan scale. */
const BAL = { gap: 10, arm: 3.6, s: 2.6, k: 0.62 };

const EXTRA = /* glsl */ `
#define SHORE_FIELD
#define SHORE_SKY
uniform vec4 shBox, bBox;             // the clay patches under the shades and the balance: L, R, top, bottom (GL px)
uniform float shD, bD;                // and how far each has developed
uniform vec4 shA[5];                  // each shade: centre x, y (GL px), length (px), shown
uniform float shT[5];                 // and its tilt
uniform vec2 bP; uniform float bL, bR, bS, bA, bSink, bOn, waterY;
${GLSL_SHADE}
/** A clay patch under the surface (its edges ragged with the swell). */
float patchM(vec2 q, vec4 b) {
  float e = 22.0 * snoise(vec2(q.y / 30.0, stageT * 0.4));
  float across = smoothstep(b.x - 50.0, b.x + 10.0, q.x + e) * (1.0 - smoothstep(b.y - 10.0, b.y + 50.0, q.x + e));
  float down = (1.0 - smoothstep(b.z - 3.0, b.z + 3.0, q.y)) * smoothstep(b.w - 40.0, b.w + 40.0, q.y + e * 0.5);
  float m = across * down;
  if (fieldBot >= 0.0) m *= smoothstep(fieldBot - 24.0, fieldBot + 24.0, FRAG_PX.y);
  return m;
}
// the shades, lying on their backs under the surface, head to the left
float shadesMask(vec2 q) {
  float m = 0.0;
  for (int i = 0; i < 5; i++) {
    vec4 a = shA[i];
    if (a.w <= 0.0) continue;
    float cs = cos(shT[i]), sn = sin(shT[i]);
    vec2 r = vec2(cs * (q.x - a.x) + sn * (q.y - a.y), -sn * (q.x - a.x) + cs * (q.y - a.y));   // a little askew
    vec2 f = vec2(r.y / a.z, 0.5 - r.x / a.z);                       // the figure's frame: up the body, feet right
    float d = figure(f, 0.03 + 0.09 * float(i)) * a.z;              // (variants without the cloak)
    m = max(m, (1.0 - smoothstep(-0.8, 0.8, d)) * a.w);
  }
  return m;
}
// the balance (GL px): a beam about a pivot on the waterline, tipping by bA (+: FOES' end, the left, up), a post down
// into the water, and a pan hung from each end (OURSELVES', the right, sinking on its cords by bSink)
float balDist(vec2 q) {
  vec2 dir = vec2(cos(bA), -sin(bA));
  vec2 eL = bP - dir * bL, eR = bP + dir * bR;
  float th = bS * 0.06;
  float d = sdSegment(q, eL, eR) - th;
  d = min(d, sdSegment(q, bP, bP - vec2(0.0, bS * 1.5)) - th * 1.1);
  d = min(d, sdSegment(q, bP - vec2(bS * 0.3, bS * 1.5), bP - vec2(-bS * 0.3, bS * 1.5)) - th);
  d = min(d, length(q - bP) - th * 2.2);
  for (int s = 0; s < 2; s++) {
    vec2 e = s == 0 ? eL : eR;
    vec2 rim = e - vec2(0.0, bS * (0.42 + (s == 0 ? 0.0 : bSink)));
    float w = bS * 0.5;
    d = min(d, sdSegment(q, e, rim - vec2(w, 0.0)) - th * 0.45);
    d = min(d, sdSegment(q, e, rim + vec2(w, 0.0)) - th * 0.45);
    vec2 b = (q - rim) / vec2(w, bS * 0.28);
    d = min(d, max((length(b) - 1.0) * bS * 0.28, q.y - rim.y));
  }
  return d;
}
vec3 fieldPaint(vec2 q, vec3 col) {
  if (shD > 0.0) {
    float m = shD * patchM(q, shBox);
    col = mix(col, clayField(q, shBox.z - q.y), m);
    col = mix(col, C_INK, shadesMask(q) * smoothstep(0.1, 0.5, m));
  }
  if (bD > 0.0) {
    float m = bD * patchM(q, bBox);
    col = mix(col, clayField(q, bBox.z - q.y), m);
    col = mix(col, C_INK, (1.0 - smoothstep(-0.8, 0.8, balDist(q))) * smoothstep(0.1, 0.5, m));
  }
  return col;
}
// above the line the balance is lit: bone on the black (FOES' pan coming up out of the water)
vec3 skyPaint(vec2 px, vec3 col) {
  if (bOn <= 0.0 || px.y < waterY) return col;
  float m = 1.0 - smoothstep(-0.8, 0.8, balDist(px));
  return mix(col, C_BONE * 0.8, m * bOn * smoothstep(waterY, waterY + 2.0, px.y));
}`;

interface CamState { pos: THREE.Vector3; yaw: number; pitch: number; bot: number }
/** A hero word on the waterline: centre x, scale (of the hook's hero scale), up on `on`, folding from `out`. */
interface Hero { w: Word3D; x: number; k: number; on: number; out: number }
/** A floating phrase: its words' onsets, its exit, where it floats on screen (x fraction). */
interface Phrase { w: Word3D; on: number[]; exit: number; fx: number }

/** ∫ of a linear ramp from 0 (at a) to 1 (at b): a velocity ramp's distance. */
const rampInt = (t: number, a: number, b: number) =>
  t <= a ? 0 : t < b ? ((t - a) * (t - a)) / (2 * (b - a)) : (b - a) / 2 + (t - b);

export default class Mirror extends Scene {
  private st!: Stage;
  /** World units per font px of a hero word at k = 1 (MONSTER?'s scale in hook 1). */
  private s = 0.01;
  private heroes: Hero[] = [];
  private hero: Record<'monster' | 'wrong' | 'problem' | 'guilt' | 'foes' | 'ours' | 'monster2', Hero> = {} as never;
  private ans: Record<'monster' | 'hiding' | 'monster2', Answer> = {} as never;
  private ph: Phrase[] = [];
  /** Key times (s), all from the lyric onsets and the beat grid: see camAt and docs/mirror-plan.md. */
  private k: Record<string, number> = {};
  private shadeOn: number[] = [];
  private shadeX: number[] = [];
  private pivotX = 0;

  override async init() {
    const { lyrics, audio } = this.ctx;
    const hook = lyrics.get("What if I'm the monster", 0);
    const l9 = lyrics.get("What if I'm in the wrong"), l10 = lyrics.get("the problem that's been hiding");
    const l11 = lyrics.get('who killed you every time'), l12 = lyrics.get('far too kind to foes');
    const l13 = lyrics.get('but a monster to ourselves'), l14 = lyrics.lines.find((l) => l.start > l13.start && /monster/i.test(l.text))!;
    const w = (l: Line, s: string) => l.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
    const bar = (t: number) => audio.timeOfBeat(Math.round(audio.beatAt(t)));
    const first = (l: Line) => l.words[0]!.start;
    const mW = hook.words.find((x) => /monster/i.test(x.w))!;
    const wrong = w(l9, 'wrong'), problem = w(l10, 'problem'), hiding = w(l10, 'hiding');
    const guilt = w(l11, 'guilt'), foes = w(l12, 'foes'), ours = w(l13, 'ourselves'), m2 = w(l14, 'monster');

    // ---- key times
    const k = this.k;
    k.tD1 = mW.start + 0.45;                         // hook 1's dip ends (its slow push runs on into the glide)
    k.mon = mW.start; k.wrong = wrong.start; k.problem = problem.start; k.hiding = hiding.start; k.l11 = first(l11);
    k.guilt = guilt.start; k.foes = foes.start; k.small = w(l13, 'monster').start; k.ours = ours.start; k.m2 = m2.start;
    // the cuts: strong downbeats with no word popping within 0.1 s (53.36, 58.69); the beam slams on 64.02
    k.cut1 = bar(w(l10, 'along').start + 0.25); k.cut2 = bar(guilt.start + 0.25); k.slam = bar(ours.start + 0.44);
    k.l14 = first(l14);
    k.end = this.ctx.end;
    this.shadeOn = [w(l11, 'killed').start, w(l11, 'you').start, w(l11, 'every').start, w(l11, 'time').start, w(l11, 'caved').start];

    // ---- the stage, the heroes and the answers
    this.st = shoreStage(EXTRA, {
      shBox: { value: new THREE.Vector4() }, bBox: { value: new THREE.Vector4() }, shD: { value: 0 }, bD: { value: 0 },
      shA: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, shT: { value: SHADE.tilt },
      bP: { value: new THREE.Vector2() }, bL: { value: 100 }, bR: { value: 100 }, bS: { value: 50 }, bA: { value: 0 },
      bSink: { value: 0 }, bOn: { value: 0 }, waterY: { value: 0 },
    });
    const hero = (word: Word, o: Partial<Hero> & { out: number }): Hero => {
      const wd = new Word3D(word.w.toUpperCase().replace(/[,.]$/, ''), heroFont(), { size: 220 });
      wd.lightMul = 2.8;
      this.st.add(wd, { shadows: false });
      const h: Hero = { w: wd, x: 0, k: 1, on: word.start, ...o };
      this.heroes.push(h);
      return h;
    };
    const H = this.hero;
    H.monster = hero(mW, { out: wrong.start - 0.2 });
    this.s = heroScale(H.monster.w);
    H.wrong = hero(wrong, { out: problem.start - 0.2, x: this.centreX(wrong.start + 0.9) });
    H.problem = hero(problem, { out: first(l11) - 0.18, x: this.centreX(problem.start + 0.9) });
    H.guilt = hero(guilt, { out: foes.start - 0.2, x: this.centreX(guilt.start + 0.8) });
    H.foes = hero(foes, { out: m2.start - 0.2, k: BAL.k });
    H.ours = hero(ours, { out: m2.start - 0.2, k: BAL.k });
    H.monster2 = hero(m2, { out: 1e9, x: this.centreX(m2.start + 1.2) });
    // FOES and OURSELVES? either side of the balance, the pair centred where we will be just after FOES lands
    const wF = H.foes.w.width * this.s * BAL.k, wO = H.ours.w.width * this.s * BAL.k, tot = wF + BAL.gap + wO;
    const pc = this.centreX(foes.start + 1.0);
    H.foes.x = pc - tot / 2 + wF / 2; H.ours.x = pc + tot / 2 - wO / 2;
    this.pivotX = pc - tot / 2 + wF + BAL.gap / 2;
    // the shades lie under where GUILT? will stand
    this.shadeX = [0, 1, 2, 3, 4].map((i) => H.guilt.x + (i - 2) * SHADE.step);
    this.ans.monster = new Answer(this.st, mW.w);
    this.ans.hiding = new Answer(this.st, hiding.w);
    this.ans.monster2 = new Answer(this.st, m2.w);

    // ---- the floating phrases, one at a time (exits: the next phrase's first onset, or 1.2 s after the last word)
    const voice = F.archivo(112.5, 600);
    const sl = (l: Line, a: string, b?: string) => l.words.slice(l.words.indexOf(w(l, a)), b ? l.words.indexOf(w(l, b)) : undefined);
    const groups: [Word[], number][] = [
      [sl(l9, 'what', 'in'), 0.36], [sl(l9, 'in', 'wrong'), 0.6],
      [sl(l10, 'what', 'problem'), 0.36], [sl(l10, 'thats', 'hiding'), 0.4], [sl(l10, 'all'), 0.62],
      [sl(l11, 'what', 'one'), 0.36], [sl(l11, 'one', 'every'), 0.6], [sl(l11, 'every', 'i'), 0.38], [sl(l11, 'i', 'guilt'), 0.62],
      [sl(l12, 'what', 'far'), 0.36], [sl(l12, 'far', 'foes'), 0.6],
      [sl(l13, 'but', 'ourselves'), 0.5],
      [l14.words.slice(0, l14.words.indexOf(m2)), 0.4],
    ];
    groups.forEach(([ws, fx], i) => {
      const wd = new Word3D(ws.map((x) => x.w).join(' '), voice, { size: 200 });
      this.st.add(wd, { shadows: false });
      const next = groups[i + 1]?.[0][0]?.start ?? m2.start - 0.01;
      const exit = Math.min(next - 0.11, ws[ws.length - 1]!.start + 1.2);
      this.ph.push({ w: wd, on: ws.map((x) => x.start), exit: i === groups.length - 1 ? m2.start - 0.12 : exit, fx });
    });
    for (const wd of this.st.words) for (const l of wd.letters) l.mat.side = THREE.DoubleSide;
  }

  /** The glide's x: from rest at hook 1's end up to speed, slower over the balance, slowing again for MONSTER?. */
  private glideX(t: number) {
    const k = this.k, T0 = this.ctx.start;
    return GLIDE.v * rampInt(t, T0, T0 + 0.8) - 1.8 * rampInt(t, k.foes! - 0.6, k.foes! + 0.4) - 0.6 * rampInt(t, k.m2! - 0.6, k.m2! + 0.4);
  }

  /** The camera (position, yaw left of -z, pitch as the slope of its view, where the clay field ends) at time t. */
  private camAt(t: number): CamState {
    const k = this.k, T0 = this.ctx.start;
    const x = this.glideX(t);
    // one glide, two cuts on the downbeats: nearer and looking back at PROBLEM and HIDING, then wide for GUILT and the balance;
    // the pitch (so the waterline) never changes across a cut. From line 14 the glide moves in for MONSTER?
    const [z0, yaw] = t < k.cut1! ? [8.4, 0] : t < k.cut2! ? [6.4, 0.06] : [14.5, 0];
    const z = t < k.cut2! ? z0 : lerp(z0, LOW.z, ease.inOutCubic(prog(t, k.l14!, k.m2! + 0.45)));
    let c: CamState = { pos: new THREE.Vector3(x, GLIDE.y, z), yaw, pitch: GLIDE.pitch, bot: BOT };
    const mix = (a: CamState, b: CamState, u: number): CamState =>
      ({ pos: a.pos.clone().lerp(b.pos, u), yaw: lerp(a.yaw, b.yaw, u), pitch: lerp(a.pitch, b.pitch, u), bot: lerp(a.bot, b.bot, u) });
    // hook 1's last frame (low at the waterline, still pushing in) rising into the glide
    const hookEnd: CamState = { pos: new THREE.Vector3(x, LOW.y, lowPushZ(t, k.tD1!, T0)), yaw: 0, pitch: LOW.pitch, bot: 1.6 };
    c = mix(hookEnd, c, ease.inOutCubic(prog(t, T0, T0 + 1.0)));
    // MONSTER?: hook 1's dip to the waterline, then the slow push to the cut
    const low: CamState = { pos: new THREE.Vector3(x, LOW.y, LOW.z), yaw: 0, pitch: LOW.pitch, bot: 1.6 };
    c = mix(c, low, ease.inOutCubic(prog(t, k.m2! - 0.12, k.m2! + 0.45)));
    c.pos.z -= 0.45 * prog(t, k.m2! + 0.45, k.end!);
    return c;
  }

  /** The world x at the centre of the frame, on the waterline, at time t. */
  private centreX(t: number) {
    const c = this.camAt(t);
    return c.pos.x - Math.tan(c.yaw) * (c.pos.z - WORD_Z);
  }

  private setCam(c: CamState) {
    this.st.cam.set(c.pos, c.pos.clone().add(new THREE.Vector3(-30 * Math.sin(c.yaw), 30 * c.pitch, -30 * Math.cos(c.yaw))), FOV);
  }

  /** A hero standing up on the waterline as sung, folding back into the water from its `out`. */
  private pose(h: Hero, t: number) {
    const wd = h.w, s = this.s * h.k;
    const gone = prog(t, h.out, h.out + 0.16, ease.inCubic);
    wd.letters.forEach((l, j) => {
      l.x = h.x + (l.penX - wd.width / 2) * s; l.z = WORD_Z; l.y = 0; l.yaw = 0; l.s = s;
      const up = popHinge(t, h.on, j);
      l.hinge = up + (HALF - up) * gone;
      l.on = l.hinge < HALF - 1e-4 && gone < 0.999 && !(gone > 0 && l.hinge > 1.2) ? 1 : 0;
    });
    wd.update();
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio } = this.ctx;
    const t = f.t, k = this.k, H = this.hero, sc = this.st.cam;
    const c = this.camAt(t);
    this.setCam(c);
    const cam = sc.cam.position;

    // ---- the heroes: bone, lit, an ember flash as each lands (as hook 1's MONSTER?)
    for (const h of this.heroes) {
      this.pose(h, t);
      h.w.letters.forEach((l, i) => {
        const tk = h.on + i * 0.014;
        l.mat.uniforms.glow!.value = 0.5 * pulse(t, tk, 0.14) * (t >= tk ? 1 : 0) * l.on;
        l.mat.uniforms.amb!.value = 0.05 * prog(t, tk, tk + 0.3);
      });
    }

    // ---- the small words afloat near us, travelling with us, low in the frame, one phrase at a time
    for (const p of this.ph) {
      const r = new THREE.Vector3(p.fx * 2 - 1, 1 - PH.y * 2, 0.5).unproject(sc.cam).sub(cam).normalize();
      const d = -cam.y / Math.min(r.y, -1e-3);
      const P = cam.clone().addScaledVector(r, d);
      const cap = PH.cap * 2 * d * Math.tan((FOV * Math.PI) / 360);
      const x0 = P.x - (p.w.width * cap / p.w.cap) / 2;
      popWords(p.w, p.on, t, bob(t, cam, x0, P.z, cap, p.w, 0.01), { exit: p.exit, exitDur: 0.06, exitRipple: 0 });
      hideFlat(p.w);
    }

    // ---- the answers under the surface (MONSTER from hook 1, folding away with its word; HIDING, lingering and
    // sinking into line 11; MONSTER, bigger than the word), each on the clay developing under it
    const u = this.st.bg.u, s = this.s, gapK = GAP * H.monster.w.cap;
    const mOut = H.monster.out;
    const answers = [
      { a: this.ans.monster, x: 0, s, on: k.mon!, d: 1 - prog(t, mOut - 0.1, mOut + 0.2), sink: 2.5 * prog(t, mOut - 0.1, mOut + 0.2, ease.inCubic) },
      { a: this.ans.hiding, x: H.problem.x, s, on: k.hiding!,
        d: ease.outCubic(prog(t, k.hiding! + 0.05, k.hiding! + 0.7)) * (1 - prog(t, this.shadeOn[3]!, k.guilt!)),
        sink: 0.45 * Math.max(0, t - k.l11!) },
      { a: this.ans.monster2, x: H.monster2.x, s: s * 1.3, on: k.m2!, d: ease.outCubic(prog(t, k.m2! + 0.05, k.m2! + 0.7)), sink: 0 },
    ];
    const act = answers.filter((a) => a.d > 0 && t >= a.on - 0.1);
    const cur = act[act.length - 1];
    u.develop!.value = cur ? cur.d : 0;
    if (cur) setRegion(this.st, cur.a.box(this.st, cur.x, cur.s, gapK * cur.s));
    u.fieldBot!.value = c.bot >= 1.5 ? -1 : (1 - c.bot) * HPX;

    // ---- the shades: lying under the surface, one more on each word from "killed you" to "caved"
    const proj = (x: number, y: number) => { const p = sc.project({ x, y, z: WORD_Z }); return new THREE.Vector2(p.x, HPX - p.y); };
    const lenPx = proj(SHADE.len, 0).x - proj(0, 0).x;
    const shA = u.shA!.value as THREE.Vector4[];
    this.shadeX.forEach((x, i) => {
      const on = this.shadeOn[i]!, shown = prog(t, on - 0.03, on + 0.18);
      const p = proj(x, -SHADE.depth[i % 2]! - 0.6 * (1 - ease.outCubic(prog(t, on - 0.03, on + 0.35))));
      shA[i]!.set(p.x, p.y, lenPx, shown);
    });
    const wl = proj(H.guilt.x, 0), deep = proj(H.guilt.x, -3.0);
    const sL = proj(this.shadeX[0]! - SHADE.len / 2, 0).x, sR = proj(this.shadeX[4]! + SHADE.len / 2, 0).x;
    (u.shBox!.value as THREE.Vector4).set(sL - 30, sR + 30, wl.y, deep.y);
    u.shD!.value = prog(t, this.shadeOn[0]! - 0.1, this.shadeOn[0]! + 0.25) * (1 - prog(t, k.foes! - 0.1, k.foes! + 0.4));

    // ---- the balance across the waterline: FOES' pan rises out of the water, a jolt on the small "monster",
    // OURSELVES' pan sinks beneath it, the beam slams on the downbeat
    const bOn = prog(t, k.foes! - 0.05, k.foes! + 0.25) * (1 - prog(t, k.m2! - 0.4, k.m2! - 0.12));
    const P = proj(this.pivotX, 0), bS = proj(this.pivotX, BAL.s).y - P.y;
    u.bOn!.value = bOn; u.bD!.value = bOn; u.waterY!.value = P.y;
    (u.bP!.value as THREE.Vector2).copy(P);
    u.bL!.value = P.x - proj(this.pivotX - BAL.arm, 0).x; u.bR!.value = proj(this.pivotX + BAL.arm, 0).x - P.x; u.bS!.value = bS;
    u.bA!.value = keys(t, [[k.foes!, 0], [k.foes! + 0.45, 0.22, (x) => ease.outBack(x, 1.8)],
      [k.small!, 0.22], [k.small! + 0.25, 0.27, (x) => ease.outBack(x, 2.5)], [k.ours!, 0.27], [k.ours! + 0.4, 0.36, ease.outCubic],
      [k.slam!, 0.36], [k.slam! + 0.3, 0.42, (x) => ease.outBack(x, 2.2)]]);
    u.bSink!.value = keys(t, [[k.ours!, 0], [k.slam!, 0.5, ease.inOutCubic], [k.slam! + 0.5, 1.5, ease.inCubic]]);
    const arm = u.bL!.value as number, bw = 0.5 * bS;
    (u.bBox!.value as THREE.Vector4).set(P.x - arm - bw - 40, P.x + (u.bR!.value as number) + bw + 90, P.y, P.y - 2.5 * bS);

    // the mirrored render holds no image of the heroes: only the small words' true reflections and the answers
    const mirror = {
      before: () => {
        for (const h of this.heroes) for (const l of h.w.letters) l.mesh.visible = false;
        for (const a of act) a.a.pose(t, a.x, a.s, a.on, gapK * a.s, a.sink);
      },
      after: () => {
        for (const a of answers) a.a.hide();
        for (const h of this.heroes) h.w.update();
      },
    };
    this.st.render(renderer, out, t, keyLight(this.st.cam, audio, t, SHORE_KEY), SHORE_SURF, { ...SHORE_OPTS, mirror });

    const hit = this.heroes.reduce((a, h) => a + (h === H.monster ? 0 : pulse(t, h.on, 0.08)), 0) + 1.2 * pulse(t, k.slam!, 0.1);
    return { ...SHORE_POST, shake: [noise1(t * 60, 1) * 6 * hit, noise1(t * 60, 2) * 6 * hit].map((v) => clamp(v, -12, 12)) as [number, number] };
  }
}
