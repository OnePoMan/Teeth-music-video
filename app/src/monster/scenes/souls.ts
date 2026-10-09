// `souls` — verse 1b, lines 1–2 (docs/MONSTER.md, revision 1), one round chamber, two set-ups.
// "I'm surrounded by the souls of those I've lost": a round cave lit by the fire behind us (never seen). On every
// word a shadow of a man stands up on the wall, and nobody casts it. SOULS folds up in a ring as it is sung, its
// letters lit, and what they throw on the wall is not letters: each casts a person. The camera circles above.
// "I'm the only one whose line I haven't crossed": down at floor level, looking across the chamber to the shades on
// the wall. On "line" a white-hot point comes in from the left wall and cuts a straight groove across the floor, and
// the groove becomes the edge of our light: beyond it the floor goes dark. LINE stands on the line (client,
// 2026-10-09, option A): each letter folds up out of the groove as the point passes under it, and its shadow falls
// away from us, across the dark and onto the wall among the shades: the word's dark double stands with the dead.
// "I haven't crossed" stands small on our side, nearer us. The camera cranes up: the shades beyond, LINE on the
// line, our half empty.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line } from '../../engine/lyrics';
import { ease, keys, lerp, mulberry32, prog, pulse } from '../../engine/util';
import { flameState, GLSL_KEY_DIST, GLSL_SHADE } from '../motifs';
import { POP, Stage, Word3D, keyLight, popHinge, popWords, row, vkeys, type Letter } from '../stage';

/** The chamber's radius, the ring SOULS stands on, cap heights, the ring's centre. */
const R = 6.5, RING = 3.4, CAP = 1.05, VCAP = 0.5, HOME = new THREE.Vector3(0, 0, 0.6);
/** The line in the floor (z) and its groove's half-width. */
const Z_LINE = -0.25, LINE_W = 0.11;
const MAXF = 16;
/** LINE, standing on the line: its cap height, the x of its centre, its extrusion (font px at size 220). */
const LINE = { cap: 1.0, x: -0.2, depth: 26 };
/** The second set-up's camera: low across the floor, then the crane up and back (its last pose). */
const CAM2 = {
  a: [-1.2, 1.6, 4.9] as [number, number, number], b: [-0.6, 1.6, 4.6] as [number, number, number],
  at: [0.6, 0.75, -4.5] as [number, number, number],
  end: [0.2, 6.3, 5.7] as [number, number, number], endAt: [0.0, 0.0, -0.9] as [number, number, number],
};
/** The key light's height in the second set-up (its foot; below LINE's top, so the double stands above the word). */
const LIGHT_Y = 0.2;
/** Where the small phrases of the second line stand (our side, near us): z, cap height, x of their centre. */
const NEAR = { z: 0.75, cap: 0.17, x: -0.75 };

const HOOKS = /* glsl */ `
${GLSL_KEY_DIST}
uniform float figA[${MAXF}], figH[${MAXF}], figV[${MAXF}], figT[${MAXF}];
uniform int nFig; uniform float tNow, sway, cylR, zLine, lineW, flameX, lineOn, revealX, headOn;
uniform vec2 home;
${GLSL_SHADE}
// the floor is the inside of a cup: black glaze with a meander border round the foot of the wall, reserved in the clay
float border(vec2 xz) {
  float r = length(xz), band = 0.42, r1 = cylR - 0.18, r0 = r1 - band;
  if (r < r0 - 0.1 || r > r1 + 0.1) return 0.0;
  float cell = band / 4.0;
  float a = atan(xz.y, xz.x) * cylR / cell;                    // cells along the rim
  vec2 p = vec2(mod(a, 5.0), (r - r0) / cell);
  float d = keyDist(p) * cell;
  float key = 1.0 - smoothstep(0.012 - gPix, 0.024 + gPix, d);
  float rims = max(1.0 - smoothstep(0.01, 0.02 + gPix, abs(r - r0 + 0.07)), 1.0 - smoothstep(0.01, 0.02 + gPix, abs(r - r1 - 0.07)));
  return max(key, rims);
}
float carve(vec2 xz) {
  float g = (1.0 - smoothstep(lineW * 0.5 - gPix, lineW + gPix, abs(xz.y - zLine))) * step(xz.x, revealX) * lineOn;
  return max(g, border(xz));
}
// the floor in rings round the flame's home
float floorLines(vec3 P, float u) { return length(P.xz - home) * 2.4 + 0.2 * snoise(P.xz * 0.2); }
float extraShadow(vec3 P, bool wall) {
  if (!wall) return 0.0;
  float a = atan(P.z, P.x), occ = 0.0;
  for (int i = 0; i < ${MAXF}; i++) {
    if (i >= nFig) break;
    float rise = sat((tNow - figT[i]) / 0.4);
    if (rise <= 0.0) continue;
    float r1 = rise - 1.0;                                            // out-back: they stand up (no pow: its base is negative)
    rise = 1.0 + 2.70158 * r1 * r1 * r1 + 1.70158 * r1 * r1;
    float da = a - figA[i]; da = da - 6.2831853 * floor((da + 3.14159265) / 6.2831853);
    float h = figH[i] * rise;
    vec2 p = vec2(da * cylR, P.y);
    p.x -= sway * p.y * (0.6 + 0.4 * fract(figV[i] * 4.1));        // they waver with the flame
    vec2 q = p / max(h, 0.01);
    if (abs(q.x) > 0.4 || q.y > 1.1) continue;
    float d = figure(q, figV[i]) * h;
    occ = max(occ, 1.0 - smoothstep(-0.05, 0.07, d));
  }
  return occ;
}
vec3 skyTint(vec3 D, vec3 col) { return col; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  if (wall) return col;
  // the line is the edge of our light: beyond it (once it is cut) the floor is dark, its mirror gone
  float beyond = smoothstep(zLine - 0.02, zLine - 0.1 - gPix, P.z) * step(P.x, revealX) * lineOn;
  col *= 1.0 - 0.82 * beyond;
  // the cutting point, white-hot
  float dh = length(P.xz - vec2(flameX, zLine));
  col += mix(C_EMBER, C_BONE, 0.65) * (2.4 * exp(-dh / 0.04) + 0.6 * exp(-dh / 0.3)) * headOn;
  // the groove burns: hottest just behind the point, then a dim ember glow that stays
  float onLine = (1.0 - smoothstep(lineW * 0.35, lineW * 1.2 + gPix, abs(P.z - zLine))) * step(P.x, revealX) * lineOn;
  float hot = exp(-max(flameX - P.x, 0.0) / 1.2);
  col += mix(C_BLOOD, C_EMBER, hot) * (0.3 + 1.1 * hot) * onLine;
  return col;
}`;

export default class Souls extends Scene {
  private st!: Stage;
  private word!: Word3D;
  private lineWord!: Word3D;
  private l1!: Line;
  private l2!: Line;
  private figs: { a: number; h: number; v: number; t: number }[] = [];

  override async init() {
    this.l1 = this.ctx.lyrics.get("I'm surrounded");
    this.l2 = this.ctx.lyrics.get("I'm the only one");
    this.st = new Stage({
      hooks: HOOKS,
      maxCards: 8,
      uniforms: {
        figA: { value: new Array(MAXF).fill(0) }, figH: { value: new Array(MAXF).fill(0) }, figV: { value: new Array(MAXF).fill(0) },
        figT: { value: new Array(MAXF).fill(1e9) }, nFig: { value: 0 }, tNow: { value: 0 }, sway: { value: 0 }, cylR: { value: R },
        zLine: { value: Z_LINE }, lineW: { value: LINE_W }, flameX: { value: -99 }, lineOn: { value: 0 }, revealX: { value: -99 }, headOn: { value: 0 },
        home: { value: new THREE.Vector2(HOME.x, HOME.z) },
      },
    });
    this.word = new Word3D('SOULS', F.archivo(100, 900), { size: 220 });
    this.st.add(this.word);
    // LINE: the hero of the second set-up, the same face as SOULS, thin enough to stand in the groove
    this.lineWord = new Word3D('LINE', F.archivo(100, 900), { size: 220, depth: LINE.depth });
    this.st.add(this.lineWord);
    const ws = this.l1.words, si = ws.findIndex((w) => w.w.toLowerCase().startsWith('souls'));
    const voice = F.archivo(112.5, 600);
    this.pre = new Word3D(ws.slice(0, si).map((w) => w.w).join(' '), voice, { size: 200 });
    this.post = new Word3D(ws.slice(si + 1).map((w) => w.w).join(' '), voice, { size: 200 });
    const voice2 = F.archivo(100, 600);
    this.only = new Word3D(this.l2.words.slice(0, this.l2.words.findIndex((w) => w.w.toLowerCase() === 'line')).map((w) => w.w).join(' '), voice2, { size: 200 });
    this.crossed = new Word3D(this.l2.words.slice(this.l2.words.findIndex((w) => w.w.toLowerCase() === 'line') + 1).map((w) => w.w).join(' '), voice2, { size: 200 });
    for (const w of [this.pre, this.post, this.only]) this.st.add(w, { shadows: false });
    this.st.add(this.crossed, { shadows: false });
    // the ring: every word of the line stands on it, read from the flame outward; SOULS centred on the far side
    const s = CAP / this.word.cap, sv = VCAP / this.pre.cap;
    const As = this.word.width * s, gap = 0.45;
    this.ringPre = (penX: number) => -Math.PI / 2 + (-As / 2 - gap - (this.pre.width - penX) * sv) / RING;
    this.ringSouls = (penX: number) => -Math.PI / 2 + ((penX - this.word.width / 2) * s) / RING;
    this.ringPost = (penX: number) => -Math.PI / 2 + (As / 2 + gap + penX * sv) / RING;
    // the shades: one stands up behind each word as it is sung, one behind each letter of SOULS
    const r = mulberry32(17);
    const soulsW = ws[si]!;
    this.pre.words.forEach((w, i) => this.figs.push({ a: this.ringPre(w.x0 + w.w / 2), h: 3.0 + r() * 0.7, v: r(), t: ws[i]!.start }));
    this.word.letters.forEach((l, k) => this.figs.push({ a: this.ringSouls(l.penX), h: 3.4 + r() * 0.5, v: r(), t: soulsW.start + (k / 4) * Math.min(0.42, soulsW.end - soulsW.start) }));
    this.post.words.forEach((w, i) => this.figs.push({ a: this.ringPost(w.x0 + w.w / 2), h: 3.0 + r() * 0.7, v: r(), t: ws[si + 1 + i]!.start }));
    // the camera's targets: the angle of each word in sung order
    this.wordAngles = [
      ...this.pre.words.map((w, i) => ({ t: ws[i]!.start, a: this.ringPre(w.x0 + w.w / 2) })),
      { t: soulsW.start, a: -Math.PI / 2 },
      ...this.post.words.map((w, i) => ({ t: ws[si + 1 + i]!.start, a: this.ringPost(w.x0 + w.w / 2) })),
    ];
  }
  private pre!: Word3D;
  private post!: Word3D;
  private only!: Word3D;
  private crossed!: Word3D;
  private ringPre!: (penX: number) => number;
  private ringSouls!: (penX: number) => number;
  private ringPost!: (penX: number) => number;
  private wordAngles: { t: number; a: number }[] = [];

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const T0 = this.ctx.start, T1 = this.ctx.end;
    const w1 = this.l1.words, w2 = this.l2.words;
    const souls = w1.find((w) => w.w.toLowerCase().startsWith('souls'))!;
    const lineW = w2.find((w) => w.w.toLowerCase() === 'line')!;
    const crossed = w2[w2.length - 1]!;
    const tCut = audio.timeOfBeat(Math.floor(audio.beatAt(w2[0]!.start + 0.02)));   // the sub-cut to floor level
    const second = t >= tCut;
    const u = this.st.bg.u;
    u.tNow!.value = t;
    const fl = flameState(audio, t, 13);
    u.sway!.value = 0.05 * fl.gust;
    const nf = this.figs.length;
    this.figs.forEach((g, i) => {
      (u.figA!.value as number[])[i] = g.a; (u.figH!.value as number[])[i] = g.h;
      (u.figV!.value as number[])[i] = g.v; (u.figT!.value as number[])[i] = g.t;
    });
    u.nFig!.value = nf;

    // ---- SOULS: a ring, facing its centre, folding up as sung
    const wd = this.word, n = wd.letters.length, s = CAP / wd.cap;
    for (let k = 0; k < n; k++) {
      const l = wd.letters[k]!;
      const th = this.ringSouls(l.penX);
      l.x = RING * Math.cos(th); l.z = RING * Math.sin(th); l.y = 0; l.s = s;
      l.yaw = Math.atan2(-l.x, -l.z);
      const tk = souls.start + (k / (n - 1)) * Math.min(0.42, souls.end - souls.start);
      // SOULS stands until the sub-cut, then lies down with the rest of the line
      const up = popHinge(t, tk), gone = prog(t, tCut - 0.3 + k * 0.01, tCut - 0.08 + k * 0.01, ease.inCubic);
      l.hinge = up + (Math.PI / 2 - up) * gone;
      l.on = l.hinge < Math.PI / 2 - 1e-4 ? 1 : 0;
      l.mat.uniforms.glow!.value = 0.45 * pulse(t, tk, 0.16) * (t >= tk ? 1 : 0) * l.on;
    }
    wd.update();
    const si = w1.indexOf(souls), sv = VCAP / this.pre.cap;
    const onRing = (f: (penX: number) => number) => (l: Letter) => {
      const th = f(l.penX);
      l.x = RING * Math.cos(th); l.z = RING * Math.sin(th); l.y = 0; l.s = sv; l.yaw = Math.atan2(-l.x, -l.z);
    };
    popWords(this.pre, w1.slice(0, si).map((w) => w.start), t, onRing(this.ringPre), { exit: tCut - 0.3 });
    popWords(this.post, w1.slice(si + 1).map((w) => w.start), t, onRing(this.ringPost), { exit: tCut - 0.3 });
    // the second set-up: his words on his side of the line, near us, one phrase at a time, below LINE
    const li2 = w2.indexOf(lineW);
    const os = NEAR.cap / this.only.cap, cs = NEAR.cap / this.crossed.cap;
    popWords(this.only, w2.slice(0, li2).map((w) => w.start), t, row(NEAR.x - (this.only.width * os) / 2, NEAR.z, 0, os),
      { exit: lineW.start - 0.02, exitDur: 0.06, exitRipple: 0 });
    popWords(this.crossed, w2.slice(li2 + 1).map((w) => w.start), t, row(NEAR.x - (this.crossed.width * cs) / 2, NEAR.z, 0, cs),
      { exit: crossed.end - 0.02, exitDur: 0.08, exitRipple: 0 });   // gone as the crane starts: our half is empty
      // (all letters at once: a ripple left it reading "aven't rossed" mid-fold)

    // ---- the cutting point: in from the left wall, slowing as it passes under LINE, then out to the right wall (and
    // on, unseen, beyond it, so the groove's heat runs out of the right end as it cools)
    const lw = this.lineWord, ls = LINE.cap / lw.cap, lx0 = LINE.x - (lw.width * ls) / 2;
    const xA = lx0 + lw.letters[0]!.penX * ls, xB = lx0 + lw.letters[lw.letters.length - 1]!.penX * ls;
    const tA = lineW.start + 0.02, tB = lineW.start + 0.32, tIn = lineW.start - 0.16, tOut = lineW.end;
    const fx = keys(t, [[tIn, -R + 0.15], [tA, xA, ease.inQuad], [tB, xB, ease.linear], [tOut, R - 0.15, ease.linear], [tOut + 1.5, R + 9, ease.linear]]);
    u.flameX!.value = fx; u.headOn!.value = second && t >= tIn && t <= tOut ? 1 : 0;
    u.lineOn!.value = second && t >= tIn ? 1 : 0;
    u.revealX!.value = t < tIn ? -99 : t <= tOut ? fx : 99;

    // ---- LINE: each letter folds up out of the groove as the point passes under it
    const place = row(lx0, Z_LINE, 0, ls);
    for (const l of lw.letters) {
      place(l);
      const xk = l.x, tk = tA + ((xk - xA) / Math.max(1e-4, xB - xA)) * (tB - tA);
      l.hinge = popHinge(t, tk + POP.lead);
      l.on = second && t >= tk ? 1 : 0;
      l.mat.uniforms.glow!.value = 0.55 * pulse(t, tk, 0.2) * l.on;
    }
    lw.update();

    // ---- the camera: circling above in the first set-up; at floor level in the second, then craning up and back
    let pos: THREE.Vector3, at: THREE.Vector3, fov = 40;
    const tCrane = crossed.end;
    if (!second) {
      // the camera swings round the ring to each word as it is sung, looking across the ring at it. Where a word
      // follows before the last swing has ended the camera jumps (a cut) as the next swing starts: if that jump would
      // fall just after the previous word's pop, the swing starts a little earlier, so the cut comes first and the
      // word pops on it (v7 note 8: nothing pops in on the frame before a cut)
      const wa = this.wordAngles;
      const lead = (i: number) => {
        const p = wa[i - 1], tj = wa[i]!.t - 0.12;
        if (!p) return 0.12;
        const tp = p.t - POP.lead;
        return tj > tp - 0.02 && tj < tp + 0.1 ? wa[i]!.t - tp + 0.02 : 0.12;
      };
      let a = wa[0]!.a;
      for (let i = 0; i < wa.length; i++) {
        const k = wa[i]!, ld = lead(i);
        if (t < k.t - ld) break;
        const prev = i > 0 ? wa[i - 1]!.a : wa[0]!.a + 0.35;
        a = lerp(prev, k.a, prog(t, k.t - ld, k.t + 0.28, ease.inOutCubic));
      }
      if (t < wa[0]!.t - 0.12) a = wa[0]!.a + 0.35 * (1 - prog(t, T0, wa[0]!.t - 0.12, ease.inOutQuad));
      const ca = a + Math.PI, rad = keys(t, [[T0, 5.0], [souls.start, 4.7, ease.inOutCubic], [tCut, 4.4, ease.linear]]);
      pos = new THREE.Vector3(rad * Math.cos(ca), keys(t, [[T0, 2.4], [souls.start, 2.6, ease.inOutCubic], [tCut, 2.8]]), rad * Math.sin(ca));
      at = new THREE.Vector3(RING * 0.9 * Math.cos(a), keys(t, [[T0, 1.9], [souls.start, 1.4, ease.inOutCubic]]), RING * 0.9 * Math.sin(a));
    } else {
      pos = vkeys(t, [[tCut, CAM2.a], [tCrane, CAM2.b, ease.linear], [T1, CAM2.end, ease.inOutCubic]]);
      at = vkeys(t, [[tCut, CAM2.at], [tCrane, CAM2.at, ease.linear], [T1, CAM2.endAt, ease.inOutCubic]]);
      fov = lerp(44, 50, prog(t, tCrane, T1, ease.inOutCubic));
    }
    // the key light: behind the camera; in the second set-up it stays where the low camera stood (low, so LINE's
    // shadow runs across the dark and up the wall above him, among the shades), and the crane leaves it behind
    if (second) this.st.cam.set(vkeys(Math.min(t, tCrane), [[tCut, CAM2.a], [tCrane, CAM2.b, ease.linear]]), new THREE.Vector3(...CAM2.at), 44);
    else this.st.cam.set(pos, at, fov);
    const L = keyLight(this.st.cam, audio, t, { seed: 13, I: 1.5, reach: 25, up: second ? LIGHT_Y - this.st.cam.cam.position.y : undefined });
    this.st.cam.set(pos, at, fov);

    this.st.render(renderer, out, t, L,
      { wall: 2, cyl: [0, 0, R], freqWall: 6.5, freqFloor: 6, toneWall: 1, toneFloor: 0.45 },
      { cards: second, noFlame: true, rim: 0.8, spec: 0.05 });

    return { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35 };
  }
}
