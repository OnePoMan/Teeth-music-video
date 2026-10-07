// `souls` — verse 1b, lines 1–2 (docs/MONSTER.md, revision 1), one round chamber, two set-ups.
// "I'm surrounded by the souls of those I've lost": a round cave lit by the fire behind us (never seen). On every
// word a shadow of a man stands up on the wall, and nobody casts it. SOULS folds up in a ring as it is sung, its
// letters lit, and what they throw on the wall is not letters: each casts a person. The camera circles above.
// "I'm the only one whose line I haven't crossed": down at floor level. On "line" a white-hot point sweeps across the
// chamber cutting a line into the floor, and the line becomes the edge of our light: beyond it the floor goes dark.
// LINE is burned in on our side, drawn in anamorphosis so it reads from where we stand. Every shadow is beyond the
// line; his side is empty. The camera cranes up to see it.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F, font, layout } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, keys, lerp, mulberry32, prog, pulse } from '../../engine/util';
import { flameState, GLSL_KEY_DIST } from '../motifs';
import { Stage, Word3D, keyLight, popHinge, popWords, row, vkeys, type Letter } from '../stage';

/** The chamber's radius, the ring SOULS stands on, cap heights, the ring's centre. */
const R = 6.5, RING = 3.4, CAP = 1.05, VCAP = 0.5, HOME = new THREE.Vector3(0, 0, 0.6);
/** The line in the floor (z) and its groove half-width; the anamorphic LINE's floor rectangle (near side). */
const Z_LINE = -0.25, LINE_W = 0.085;
const MAXF = 16;

const HOOKS = /* glsl */ `
${GLSL_KEY_DIST}
uniform float figA[${MAXF}], figH[${MAXF}], figV[${MAXF}], figT[${MAXF}];
uniform int nFig; uniform float tNow, sway, cylR, zLine, lineW, flameX, lineOn, revealX, headOn;
uniform vec2 home; uniform sampler2D word; uniform vec4 wordRect; uniform mat4 anaVP;
// a standing figure as a shadow: proportions in units of its height, feet at the origin, y up. v varies the build,
// the stance, the cloak (a himation from the shoulders to the shins) and a bowed head.
float figure(vec2 q, float v) {
  float sh = 0.105 + 0.02 * fract(v * 7.3), hd = 0.055 + 0.008 * fract(v * 3.1), st = 0.025 + 0.035 * fract(v * 5.7);
  float bow = step(0.55, fract(v * 13.7)) * 0.03;
  float cloak = step(0.4, fract(v * 11.1));
  vec2 hc = vec2(bow, 0.925 - bow * 0.6);
  float d = length((q - hc) * vec2(1.0, 0.88)) - hd;                               // head, a little long
  d = smin(d, sdSegment(q, vec2(bow * 0.5, 0.84), hc) - 0.024, 0.02);              // neck
  d = smin(d, sdSegment(q, vec2(-sh * 0.8, 0.8), vec2(sh * 0.8, 0.8)) - 0.04, 0.04); // shoulders
  d = smin(d, sdSegment(q, vec2(0.0, 0.52), vec2(0.0, 0.79)) - 0.078, 0.05);        // torso
  d = smin(d, sdSegment(q, vec2(-sh, 0.79), vec2(-sh - 0.015, 0.52)) - 0.026, 0.03); // arms
  d = smin(d, sdSegment(q, vec2(sh, 0.79), vec2(sh + 0.02 * (1.0 - 2.0 * fract(v * 2.7)), 0.52)) - 0.026, 0.03);
  d = smin(d, sdSegment(q, vec2(-0.04, 0.54), vec2(-st - 0.025, 0.02)) - 0.034, 0.03); // legs
  d = smin(d, sdSegment(q, vec2(0.04, 0.54), vec2(st + 0.025, 0.02)) - 0.034, 0.03);
  // the cloak: a drape from the shoulders, widening to the shins, over one arm
  float hw = mix(sh + 0.03, sh + 0.07, sat((0.8 - q.y) / 0.6));
  float drape = max(abs(q.x - 0.01) - hw, max(q.y - 0.82, 0.2 - q.y));
  d = mix(d, smin(d, drape, 0.03), cloak);
  return d;
}
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
  g = max(g, border(xz));
  return g;
}
// LINE in anamorphosis: the floor point as seen by the camera at the moment of the burn, read in screen space
float anaMask(vec2 xz) {
  if (xz.y < zLine + 0.12 || lineOn <= 0.0) return 0.0;
  vec4 c = anaVP * vec4(xz.x, 0.0, xz.y, 1.0);
  if (c.w <= 0.0) return 0.0;
  vec2 sp = c.xy / c.w * 0.5 + 0.5;
  vec2 uv = (sp - wordRect.xy) / (wordRect.zw - wordRect.xy);
  uv.y = 1.0 - uv.y;
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return 0.0;
  return smoothstep(0.25, 0.75, textureLod(word, uv, 0.0).a) * smoothstep(0.02, -0.25, sp.x - (revealX + 5.4) / 10.8);
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
  float onLine = 1.0 - smoothstep(lineW * 0.35, lineW * 1.2 + gPix, abs(P.z - zLine));
  float tr = exp(-max(flameX - P.x, 0.0) / 4.0) * step(P.x, revealX) * onLine * lineOn;
  col += mix(C_BLOOD, C_EMBER, tr) * (0.35 + tr) * onLine * step(P.x, revealX) * lineOn;
  // LINE, burned in: embers in the floor, hottest just after the flame has passed
  float m = anaMask(P.xz);
  col = mix(col, mix(C_SIGNAL * 0.9, C_EMBER * 1.3, 0.5 + 0.5 * exp(-max(flameX - P.x, 0.0) / 3.0)), m * 0.92);
  return col;
}`;

export default class Souls extends Scene {
  private st!: Stage;
  private word!: Word3D;
  private l1!: Line;
  private l2!: Line;
  private figs: { a: number; h: number; v: number; t: number }[] = [];
  private lineTex!: THREE.CanvasTexture;
  private anaCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 600);

  override async init() {
    // LINE, burned into the floor in anamorphosis: drawn tall so that, lying on the floor, it reads from the camera
    const fam = F.archivo(100, 900), px = 260, lay = layout('LINE', fam, px, 8);
    const cv = document.createElement('canvas');
    const pad = 40, cap = px * 0.72;
    cv.width = Math.ceil(lay.width + pad * 2); cv.height = Math.ceil(cap + pad * 2);
    const c = cv.getContext('2d')!;
    c.font = font(fam, px); c.letterSpacing = '8px'; c.fillStyle = '#fff'; c.textBaseline = 'alphabetic';
    c.fillText('LINE', pad, pad + cap);
    this.lineTex = new THREE.CanvasTexture(cv);
    this.lineTex.flipY = false; this.lineTex.colorSpace = THREE.NoColorSpace; this.lineTex.generateMipmaps = true;
    this.lineTex.minFilter = THREE.LinearMipmapLinearFilter;
    this.st = new Stage({
      hooks: HOOKS,
      uniforms: {
        figA: { value: new Array(MAXF).fill(0) }, figH: { value: new Array(MAXF).fill(0) }, figV: { value: new Array(MAXF).fill(0) },
        figT: { value: new Array(MAXF).fill(1e9) }, nFig: { value: 0 }, tNow: { value: 0 }, sway: { value: 0 }, cylR: { value: R },
        zLine: { value: Z_LINE }, lineW: { value: LINE_W }, flameX: { value: 0 }, lineOn: { value: 0 }, revealX: { value: -99 }, headOn: { value: 0 },
        home: { value: new THREE.Vector2(HOME.x, HOME.z) }, word: { value: this.lineTex },
        wordRect: { value: new THREE.Vector4(0.34, 0.02, 0.66, 0.165) }, anaVP: { value: new THREE.Matrix4() },
      },
    });
    this.word = new Word3D('SOULS', F.archivo(100, 900), { size: 220 });
    this.st.add(this.word);
    this.l1 = this.ctx.lyrics.get("I'm surrounded");
    this.l2 = this.ctx.lyrics.get("I'm the only one");
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
    // the second set-up: his words on his side of the line
    const li2 = w2.indexOf(lineW);
    // one phrase at a time, standing just on his side of the line, centred in the frame
    const os = 0.3 / this.only.cap, cs = 0.36 / this.crossed.cap;
    popWords(this.only, w2.slice(0, li2).map((w) => w.start), t, row(-0.4 - (this.only.width * os) / 2, Z_LINE + 0.35, 0, os), { exit: lineW.start - 0.02 });
    popWords(this.crossed, w2.slice(li2 + 1).map((w) => w.start), t, row(-0.4 - (this.crossed.width * cs) / 2, Z_LINE + 0.35, 0, cs));

    // ---- the cutting point: on "line" it sweeps across the chamber, cutting the line in
    const fx = keys(t, [[lineW.start - 0.08, -5.4], [lineW.end, 5.4, ease.inOutQuad]]);
    const sweeping = t >= lineW.start - 0.08 && t <= lineW.end + 0.05;
    u.flameX!.value = fx; u.headOn!.value = sweeping ? 1 : 0;
    u.lineOn!.value = t >= lineW.start - 0.1 ? 1 : 0;
    u.revealX!.value = t < lineW.start - 0.1 ? -99 : t <= lineW.end ? fx : 99;

    // ---- the camera: circling above in the first set-up; at floor level in the second, then craning up
    let pos: THREE.Vector3, at: THREE.Vector3, fov = 40;
    if (!second) {
      // the camera swings round the ring to each word as it is sung, looking across the ring at it
      const wa = this.wordAngles;
      let a = wa[0]!.a;
      for (let i = 0; i < wa.length; i++) {
        const k = wa[i]!;
        if (t < k.t - 0.12) break;
        const prev = i > 0 ? wa[i - 1]!.a : wa[0]!.a + 0.35;
        a = lerp(prev, k.a, prog(t, k.t - 0.12, k.t + 0.28, ease.inOutCubic));
      }
      if (t < wa[0]!.t - 0.12) a = wa[0]!.a + 0.35 * (1 - prog(t, T0, wa[0]!.t - 0.12, ease.inOutQuad)) + 0.35 * 0;
      const ca = a + Math.PI, rad = keys(t, [[T0, 5.0], [souls.start, 4.7, ease.inOutCubic], [tCut, 4.4, ease.linear]]);
      pos = new THREE.Vector3(rad * Math.cos(ca), keys(t, [[T0, 2.4], [souls.start, 2.6, ease.inOutCubic], [tCut, 2.8]]), rad * Math.sin(ca));
      at = new THREE.Vector3(RING * 0.9 * Math.cos(a), keys(t, [[T0, 1.9], [souls.start, 1.4, ease.inOutCubic]]), RING * 0.9 * Math.sin(a));
    } else {
      pos = vkeys(t, [[tCut, [-1.2, 0.95, 4.9]], [crossed.end, [-0.6, 0.95, 4.6], ease.linear], [T1, [0.4, 6.8, 6.4], ease.inOutCubic]]);
      at = vkeys(t, [[tCut, [0.6, 1.1, -4.5]], [crossed.end, [0.6, 1.1, -4.5], ease.linear], [T1, [0.0, 0.0, -1.2], ease.inOutCubic]]);
      fov = lerp(44, 48, prog(t, crossed.end, T1));
    }
    this.st.cam.set(pos, at, fov);
    // the anamorphic word is drawn from the camera as it stands when the line is burned
    if (second) {
      const ap = vkeys(lineW.start, [[tCut, [-1.2, 0.95, 4.9]], [crossed.end, [-0.6, 0.95, 4.6], ease.linear]]);
      const aat = new THREE.Vector3(0.6, 1.1, -4.5);
      const cam = this.anaCam;
      cam.fov = 44; cam.aspect = 16 / 9; cam.updateProjectionMatrix();
      cam.position.copy(ap); cam.lookAt(aat); cam.updateMatrixWorld(true);
      (u.anaVP!.value as THREE.Matrix4).multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    }

    this.st.render(renderer, out, t, keyLight(this.st.cam, audio, t, { seed: 13, I: 1.5, reach: 25 }),
      { wall: 2, cyl: [0, 0, R], freqWall: 6.5, freqFloor: 6, toneWall: 1, toneFloor: 0.45 },
      { cards: false, noFlame: true, rim: 0.8, spec: 0.05 });

    return { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35 };
  }
}
