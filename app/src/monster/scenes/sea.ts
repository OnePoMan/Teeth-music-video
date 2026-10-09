// `sea` — verse 1b, lines 3–4: "What if the greatest threat we'll find across the sea / Is me?" (docs/MONSTER.md,
// revision 1). His side of the line has become the sea: black mirror water with Homer's wine-dark tint, its swells
// shown only by how they bend what it mirrors, lit by the fire behind us (never seen); far off, the line itself, now
// a burning shore. On "threat" the word stands up on the far shore, black against the burning line, its reflection
// broken by the swell. "across the sea": the camera is pulled back across the water and the word goes small; it lies
// down with that phrase; the water settles into hook 1's frame (the waterline at 0.71 H).
// Line 7 (ME?, 42.31–43.36; client, 2026-10-09): ME? stands up near us on the water as the line's hero, its first word
// small beside it; its shadow, thrown by the fire behind us across the water, is not letters but Odysseus (odysseus.ts,
// the drawn bow), giant on a low clay bank risen on the far shore where THREAT sank. It fades and the bank sinks as the
// fire dips into the cut; hook 1 carries ME? over at the same size and place.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, prog, pulse } from '../../engine/util';
import { GLSL_ODYSSEUS, odysseusUniforms, setOdysseus } from '../odysseus';
import { heroFont, placeMe } from '../shore';
import { SHORE as SHORE_FRAME, Stage, Word3D, keyLight, popHinge, popWords, vkeys, type Letter } from '../stage';

/** The far shore (z), THREAT's cap height, the final camera (hook 1's first frame, shared with `hook`). */
const SHORE = SHORE_FRAME.z, CAP = 2.1;
const END = SHORE_FRAME.cam;
/** "across the sea": the row's z and cap height, and the camera's height pulled back (the row's top stays below the
 * far shore's line, so it never crosses THREAT). */
const ROW = { x: 0.5, z: -4.5, cap: 0.54, camY: 1.5 };
/** The bank (z, height) and Odysseus on it (x, height); ME? and the word before it stand at shore.ts' ME. */
const BANK = { z: SHORE - 0.5, h: 8.0 }, ODY = { x: -2.2, h: 7.2 };

const HOOKS = /* glsl */ `
uniform float tSea, shoreZ;
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
uniform float skyI, toHook, bankH, odyFade;
${GLSL_ODYSSEUS}
// the bank catches his shadow, cast by the fire behind us across the water
float extraShadow(vec3 P, bool wall) { return wall ? odyFade * odysseusWall(P.xy, gPix) : 0.0; }
// the far shore burns: a low band of light over the horizon that the words stand black against
vec3 skyGlow(vec3 D) {
  float e = max(D.y, 0.0);
  return mix(C_BLOOD, C_SIGNAL, 0.45) * skyI * (0.6 * exp(-e * 30.0) + 0.06 * exp(-e * 9.0));
}
vec3 skyTint(vec3 D, vec3 col) { return col + skyGlow(D); }
float bankTop(float x) { return bankH * (0.95 + 0.05 * snoise(vec2(x * 0.05, 3.1))); }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  // the bank: low clay lit by our fire; above it, the sky
  if (wall) return mix(col * 1.15, C_INK + skyGlow(normalize(P - camPos)), smoothstep(-gPix, gPix, P.y - bankTop(P.x)));
  // the water ends at the far shore; the shore is the line, burning
  float beyond = smoothstep(shoreZ + 0.02, shoreZ - 0.02, P.z);
  float lineG = exp(-abs(P.z - shoreZ) / max(0.06, gPix * 1.5));
  // beyond it the ground takes the sky's own colour: the shore line is the horizon, no black sliver above it
  col = mix(col, C_INK + skyGlow(normalize(P - camPos)), beyond);
  // as the water settles into hook 1's frame the burning shore cools to its waterline, a bone hairline
  col += mix(mix(C_BLOOD, C_EMBER, 0.55) * 1.1, C_BONE * 0.8, toHook) * lineG;
  return col;
}`;

export default class Sea extends Scene {
  private st!: Stage;
  private word!: Word3D;
  private l1!: Line;
  private l2!: Line;
  /** The floating phrases: "What if the greatest", "we'll find", "across the sea" (tracked wide), "Is me?". */
  private ph: Word3D[] = [];
  private me!: Word3D;

  override async init() {
    this.st = new Stage({
      hooks: HOOKS,
      uniforms: { tSea: { value: 0 }, shoreZ: { value: SHORE }, skyI: { value: 1 }, toHook: { value: 0 }, bankH: { value: 0 }, odyFade: { value: 0 }, ...odysseusUniforms() },
    });
    this.word = new Word3D('THREAT', F.archivo(75, 900), { size: 220 });
    this.word.lightMul = 0.12;                            // black against the burning shore
    this.st.add(this.word, { shadows: false });
    this.l1 = this.ctx.lyrics.get('What if the greatest threat');
    this.l2 = this.ctx.lyrics.get('Is me');
    const ws = this.l1.words, voice = F.archivo(112.5, 600);
    const wi = ws.findIndex((w) => w.w.toLowerCase().startsWith('threat')), ai = ws.findIndex((w) => w.w.toLowerCase().startsWith('across'));
    this.ph = [
      new Word3D(ws.slice(0, wi).map((w) => w.w).join(' '), voice, { size: 200 }),
      new Word3D(ws.slice(wi + 1, ai).map((w) => w.w).join(' '), voice, { size: 200 }),
      new Word3D(ws.slice(ai).map((w) => w.w).join(' '), voice, { size: 200, tracking: 90 }),
      new Word3D(this.l2.words[0]!.w, voice, { size: 200 }),
    ];
    this.me = new Word3D(this.l2.words.slice(1).map((w) => w.w.toUpperCase()).join(' '), heroFont(), { size: 220 });
    this.st.add(this.me, { shadows: false });
    for (const w of this.ph) this.st.add(w, { shadows: false });
    for (const w of this.st.words) for (const l of w.letters) l.mat.side = THREE.DoubleSide;
  }

  private w(l: Line, s: string): Word {
    return l.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const T0 = this.ctx.start;
    const threat = this.w(this.l1, 'threat'), across = this.w(this.l1, 'across'), sea = this.w(this.l1, 'sea');
    const wi = this.l1.words.indexOf(threat);
    const tOut = sea.end + 0.9;
    const back = prog(t, across.start - 0.05, sea.end + 0.4, ease.outExpo);
    // the camera sinks into hook 1's frame once THREAT and "across the sea" have gone (lower, the row would cross THREAT)
    const settle = prog(t, tOut, this.l2.words[0]!.start - 0.1, ease.inOutCubic);

    // ---- the camera: low over the water gliding toward the shore; pulled back and up across the sea, so that the
    // row floating before us stands below the far shore; settling into hook 1
    const p0 = vkeys(t, [[T0, [0.7, 0.8, 3.2]], [across.start - 0.05, [0.45, 0.7, 1.6], ease.linear]]);
    const p1 = new THREE.Vector3(0.1, ROW.camY, END.z - 1.2), p2 = new THREE.Vector3(0, END.y, END.z);
    const pos = p0.clone().lerp(p1, back).lerp(p2, settle);
    const at = pos.clone().add(new THREE.Vector3(lerp(-0.8, 0, back), lerp(0.4, 30 * END.pitch, Math.max(back, settle)), -30));
    this.st.cam.set(pos, at, 40);

    // ---- THREAT: standing up on the far shore as sung, black against the line; it lies down with "across the sea"
    // (client note: it may linger after it is sung, but leaves when that phrase leaves, not after)
    const wd = this.word, n = wd.letters.length, s = CAP / wd.cap;
    for (let k = 0; k < n; k++) {
      const l = wd.letters[k]!;
      l.x = -0.4 + (l.penX - wd.width / 2) * s; l.z = SHORE - 0.25; l.y = 0; l.yaw = 0; l.s = s;
      const tk = threat.start + (k / (n - 1)) * Math.min(0.36, threat.end - threat.start);
      const up = popHinge(t, tk), gone = prog(t, tOut + k * 0.01, tOut + k * 0.01 + 0.22, ease.inCubic);
      l.hinge = up + (Math.PI / 2 - up) * gone;
      l.on = l.hinge < Math.PI / 2 - 1e-4 && gone < 0.999 ? 1 : 0;
      l.mat.uniforms.glow!.value = 0.5 * pulse(t, tk, 0.14) * (t >= tk ? 1 : 0) * l.on;
      l.mat.uniforms.amb!.value = 0;
    }
    wd.update();

    // ---- the floating words: each pops up out of the swell on its onset, bobbing, facing the camera; one phrase at a time
    const ws = this.l1.words, cam = this.st.cam.cam.position;
    const ai = ws.indexOf(across);
    const bobRow = (x0: number, z0: number, cap: number, w: Word3D) => (l: Letter) => {
      const sc = cap / w.cap;
      l.x = x0 + l.penX * sc; l.z = z0; l.s = sc;
      l.y = 0.025 * Math.sin(t * 2.1 + l.penX * 0.004 + z0);
      l.yaw = Math.atan2(cam.x - (x0 + (w.width * sc) / 2), cam.z - z0);
    };
    const u0 = this.st.bg.u;
    const [q0, q1, pA, pM] = this.ph as [Word3D, Word3D, Word3D, Word3D];
    const cx = (w: Word3D, cap: number, xc: number) => xc - (w.width * cap / w.cap) / 2;
    popWords(q0, ws.slice(0, wi).map((w) => w.start), t, bobRow(cx(q0, 0.3, 0.75), -2.2, 0.3, q0), { exit: threat.start - 0.02 });
    popWords(q1, ws.slice(wi + 1, ai).map((w) => w.start), t, bobRow(cx(q1, 0.36, 0.5), -2.8, 0.36, q1), { exit: across.start - 0.02 });
    // "across the sea": one row tracked wide, spanning the water between us and the shore
    popWords(pA, ws.slice(ai).map((w) => w.start), t, bobRow(cx(pA, ROW.cap, ROW.x), ROW.z, ROW.cap, pA), { exit: tOut, amb: 0.16 });
    // "Is" small, beside ME?; ME? the hero, near us, facing us, lit by the fire behind us
    // (shared with hook 1, which carries both over the cut: placeMe)
    const me = this.me, mp = placeMe(t, cam, pM, me);
    popWords(pM, [this.l2.words[0]!.start], t, mp.is);
    const tMe = this.l2.words[1]!.start;
    popWords(me, [tMe], t, mp.me);
    // its shadow: Odysseus on the bank, rising with ME?, fading as the fire dips into the cut; the bank sinks with him,
    // gone by the cut to hook 1
    const fade = 1 - prog(t, this.ctx.end - 0.4, this.ctx.end - 0.02, ease.inQuad);
    const sink = 1 - prog(t, this.ctx.end - 0.4, this.ctx.end - 0.1, ease.inQuad);
    u0.bankH!.value = BANK.h * prog(t, this.l2.words[0]!.start - 0.35, tMe - 0.05, ease.outCubic) * sink;
    u0.odyFade!.value = prog(t, tMe - 0.02, tMe + 0.2, ease.outCubic) * fade;
    setOdysseus(u0, { x: ODY.x, h: ODY.h, pose: 'archer', lean: 0, stretch: 1 });

    const u = u0;
    u.tSea!.value = t;
    const toHook = prog(t, this.l2.words[0]!.start - 0.3, this.ctx.end - 0.15, ease.inOutQuad);
    u.skyI!.value = (0.55 + 0.45 * prog(t, threat.start - 0.3, threat.start + 0.2) - 0.25 * settle) * (1 - 0.92 * toHook);
    u.toHook!.value = toHook;
    // the fire behind us; the water mirrors, wine-dark, its swells bending what it mirrors
    this.st.render(renderer, out, t, keyLight(this.st.cam, audio, t, { seed: 21, I: 1.3 * (0.35 + 0.65 * (1 - prog(t, this.ctx.end - 0.4, this.ctx.end - 0.02))), reach: 25 }),
      { wall: 1, wallZ: BANK.z, gloss: 0.75, swell: 0.45, wine: 0.85, reflBend: 0.3 },
      { noFlame: true, cards: false, rim: 1.0, spec: 0.05 });

    return { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35 };
  }
}

