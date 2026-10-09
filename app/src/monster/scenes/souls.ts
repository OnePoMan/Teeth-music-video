// `souls` — verse 1b, lines 1–2 (docs/MONSTER.md, revision 1), one round chamber, two set-ups.
// "I'm surrounded by the souls of those I've lost": a round cave lit by the fire behind us (never seen). On every
// word a shadow of a man stands up on the wall, and nobody casts it. SOULS folds up in a ring as it is sung, its
// letters lit, and what they throw on the wall is not letters: each casts a person. The camera circles above.
// "I'm the only one whose line I haven't crossed": lower, looking across the chamber's floor to the shades on the
// wall. On "line" a white-hot point comes in from the wall cutting a groove, and the groove is the word: it writes
// "line" in one connected stroke (the script "estranged?" is written in) and runs on out to the other wall (client,
// 2026-10-09: the word is the line itself). The stroke is drawn in anamorphosis, so it reads from where we stand,
// above the line, on the dark side; the line is the edge of our light (beyond it the floor goes dark). "I haven't
// crossed" stands on our side, below it. Every shadow is beyond the line; the camera pulls back along its view.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import { strokeText } from '../../engine/stroke';
import type { Line } from '../../engine/lyrics';
import { ease, keys, lerp, mulberry32, prog, pulse } from '../../engine/util';
import { W as WPX, H as HPX } from '../../engine/gl';
import { flameState, GLSL_KEY_DIST, GLSL_SHADE } from '../motifs';
import { POP, Stage, Word3D, keyLight, popHinge, popWords, row, vkeys, type Letter } from '../stage';

/** The chamber's radius, the ring SOULS stands on, cap heights, the ring's centre. */
const R = 6.5, RING = 3.4, CAP = 1.05, VCAP = 0.5, HOME = new THREE.Vector3(0, 0, 0.6);
/** The line in the floor (z). */
const Z_LINE = -0.25;
const MAXF = 16;
/** The written line (px of the camera that sees it cut): the script's x-height, the stroke's width, where the word's
 *  centre sits across the frame (fraction of W). */
const SCRIPT = { xh: 150, w: 13, cx: 0.5 };
/** The cut's stroke: up to this many segments (the script word), in cutting order. */
const MAXSEG = 256;
/** The second set-up's camera: where it stands while the line is cut (the anamorphic word reads from here), and how
 *  it pulls back along its view at the end. */
const CAM2 = { pos: [-0.35, 1.85, 3.3] as [number, number, number], at: [0.1, 0.0, -4.0] as [number, number, number], fov: 50, back: 1.45 };
/** Where the small phrases of the second line stand (our side, near us): z, and cap height. */
const NEAR = { z: 0.3, cap: 0.2 };

const HOOKS = /* glsl */ `
${GLSL_KEY_DIST}
uniform float figA[${MAXF}], figH[${MAXF}], figV[${MAXF}], figT[${MAXF}];
uniform int nFig; uniform float tNow, sway, cylR, zLine, lineOn, revealX, headOn;
uniform vec2 home, headXZ;
// the cut, as the camera that sees it cut reads it (px, y down): the straight runs in from the walls (a, b), the
// script between them (segTex: row 0 the segments' ends, row 1 their arc length at the start and their length), the
// arc length cut so far, the stroke's width, the script's box (px), and the total length
uniform mat4 anaVP;
uniform vec4 runL, runR; uniform vec2 runS;
uniform sampler2D segTex; uniform int nSeg; uniform float revS, strokeW, totS; uniform vec4 scrBox;
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
/** A floor point as the camera saw it when the line was cut (px, y down); z < 0: behind that camera. */
vec3 anaPx(vec2 xz) {
  vec4 c = anaVP * vec4(xz.x, 0.0, xz.y, 1.0);
  if (c.w <= 0.0) return vec3(0.0, 0.0, -1.0);
  vec2 n = c.xy / c.w;
  return vec3((n.x * 0.5 + 0.5) * ${WPX.toFixed(1)}, (0.5 - n.y * 0.5) * ${HPX.toFixed(1)}, 1.0);
}
/** Distance from p to a segment cut from its start a (arc length s0, length len) as far as the arc length revS,
 *  and the arc length at the nearest point. */
vec2 segD(vec2 p, vec2 a, vec2 b, float s0, float len) {
  if (s0 >= revS) return vec2(1e9, 0.0);
  float f = min(1.0, (revS - s0) / max(len, 1e-4));
  vec2 ab = (b - a) * f;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return vec2(length(p - a - ab * h), s0 + h * len * f);
}
/** The cut near p (px of the camera that cut it): distance (px) and the arc length at its nearest point. */
vec2 cutD(vec2 p) {
  vec2 best = segD(p, runL.xy, runL.zw, 0.0, runS.x);
  vec2 r = segD(p, runR.xy, runR.zw, totS - runS.y, runS.y);
  if (r.x < best.x) best = r;
  if (p.x < scrBox.x || p.x > scrBox.z || p.y < scrBox.y || p.y > scrBox.w) return best;
  for (int i = 0; i < ${MAXSEG}; i++) {
    if (i >= nSeg) break;
    vec2 sl = texelFetch(segTex, ivec2(i, 1), 0).xy;
    if (sl.x >= revS) break;                                    // (in cutting order)
    vec4 sg = texelFetch(segTex, ivec2(i, 0), 0);
    vec2 d = segD(p, sg.xy, sg.zw, sl.x, sl.y);
    if (d.x < best.x) best = d;
  }
  return best;
}
/** The cut's groove (0..1) at a floor point, and the arc length there. */
vec2 cutAt(vec2 xz) {
  if (lineOn <= 0.0) return vec2(0.0);
  vec3 a = anaPx(xz);
  if (a.z < 0.0) return vec2(0.0);
  vec2 d = cutD(a.xy);
  return vec2(1.0 - smoothstep(strokeW * 0.5 - 0.9, strokeW * 0.5 + 0.9, d.x), d.y);
}
float carve(vec2 xz) { return max(cutAt(xz).x, border(xz)); }
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
  float dh = length(P.xz - headXZ);
  col += mix(C_EMBER, C_BONE, 0.65) * (2.4 * exp(-dh / 0.04) + 0.6 * exp(-dh / 0.3)) * headOn;
  // the cut burns: hottest just behind the point, then an ember glow that stays (the word must read on the dark side)
  vec2 c = cutAt(P.xz);
  if (c.x > 0.0) {
    float hot = exp(-max(revS - c.y, 0.0) / 900.0);
    col += mix(C_BLOOD, C_EMBER, 0.35 + 0.65 * hot) * (0.55 + 0.8 * hot) * c.x;
  }
  return col;
}`;

/** The cut: two straight runs from the walls and the script between them, as one path in the cutting camera's px. */
interface Cut {
  runL: [number, number, number, number]; runR: [number, number, number, number];
  /** Arc lengths (px): the left run, the script, the right run, and the total. */
  lenL: number; lenS: number; lenR: number; tot: number;
  segs: { a: THREE.Vector2; b: THREE.Vector2; s0: number; len: number }[];
  box: [number, number, number, number];
}

export default class Souls extends Scene {
  private st!: Stage;
  private word!: Word3D;
  private l1!: Line;
  private l2!: Line;
  private figs: { a: number; h: number; v: number; t: number }[] = [];
  private anaCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 600);
  private cut!: Cut;
  private segTex!: THREE.DataTexture;

  override async init() {
    this.l1 = this.ctx.lyrics.get("I'm surrounded");
    this.l2 = this.ctx.lyrics.get("I'm the only one");
    // the camera that sees the line cut: the anamorphic word is drawn from it
    const cam = this.anaCam;
    cam.fov = CAM2.fov; cam.aspect = WPX / HPX; cam.updateProjectionMatrix();
    cam.position.set(...CAM2.pos); cam.lookAt(new THREE.Vector3(...CAM2.at)); cam.updateMatrixWorld(true);
    this.cut = this.buildCut();
    const segs = this.cut.segs, n = Math.min(segs.length, MAXSEG);
    const data = new Float32Array(MAXSEG * 2 * 4);
    for (let i = 0; i < n; i++) {
      const s = segs[i]!;
      data.set([s.a.x, s.a.y, s.b.x, s.b.y], i * 4);
      data.set([s.s0, s.len, 0, 0], (MAXSEG + i) * 4);
    }
    this.segTex = new THREE.DataTexture(data, MAXSEG, 2, THREE.RGBAFormat, THREE.FloatType);
    this.segTex.minFilter = this.segTex.magFilter = THREE.NearestFilter;
    this.segTex.needsUpdate = true;

    this.st = new Stage({
      hooks: HOOKS,
      maxCards: 8,
      uniforms: {
        figA: { value: new Array(MAXF).fill(0) }, figH: { value: new Array(MAXF).fill(0) }, figV: { value: new Array(MAXF).fill(0) },
        figT: { value: new Array(MAXF).fill(1e9) }, nFig: { value: 0 }, tNow: { value: 0 }, sway: { value: 0 }, cylR: { value: R },
        zLine: { value: Z_LINE }, lineOn: { value: 0 }, revealX: { value: -99 }, headOn: { value: 0 },
        home: { value: new THREE.Vector2(HOME.x, HOME.z) }, headXZ: { value: new THREE.Vector2(-99, 0) },
        anaVP: { value: new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse) },
        runL: { value: new THREE.Vector4(...this.cut.runL) }, runR: { value: new THREE.Vector4(...this.cut.runR) },
        runS: { value: new THREE.Vector2(this.cut.lenL, this.cut.lenR) },
        segTex: { value: this.segTex }, nSeg: { value: n }, revS: { value: 0 }, strokeW: { value: SCRIPT.w }, totS: { value: this.cut.tot },
        scrBox: { value: new THREE.Vector4(...this.cut.box) },
      },
    });
    this.word = new Word3D('SOULS', F.archivo(100, 900), { size: 220 });
    this.st.add(this.word);
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

  /** A world point → the cutting camera's px (y down). */
  private toPx(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.anaCam);
    return new THREE.Vector2((v.x * 0.5 + 0.5) * WPX, (0.5 - v.y * 0.5) * HPX);
  }
  /** The cutting camera's px → the floor (x, z). */
  private toFloor(p: THREE.Vector2) {
    const cam = this.anaCam;
    const d = new THREE.Vector3((p.x / WPX) * 2 - 1, 1 - (p.y / HPX) * 2, 0.5).unproject(cam).sub(cam.position).normalize();
    const k = -cam.position.y / Math.min(d.y, -1e-4);
    return new THREE.Vector2(cam.position.x + d.x * k, cam.position.z + d.z * k);
  }

  /** The path of the cut: from the left wall along the line, the script "line" on the line (its baseline is the line,
   *  so it stands above it on screen, on the far side), then on along the line to the right wall. */
  private buildCut(): Cut {
    const tx = strokeText('line', 'script', 100);
    // the script's own x-height (font px), from the ink of x (the "n" and "e" are x-height letters)
    const ys = tx.strokes.flat().map((p) => p.y);
    const top = Math.min(...ys), bot = Math.max(...ys);
    const xs = tx.strokes.flat().map((p) => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const xhFont = tx.strokes.filter((_, i) => tx.charOf[i] === 2).flat().reduce((m, p) => Math.min(m, p.y), 0);   // the n's top
    const k = SCRIPT.xh / Math.max(1, -xhFont);
    // the line's direction in the cutting camera's px, and the baseline under the word's centre
    const aL = this.toPx(-R + 0.12, 0, Z_LINE), aR = this.toPx(R - 0.12, 0, Z_LINE);
    const dir = aR.clone().sub(aL).normalize(), nrm = new THREE.Vector2(dir.y, -dir.x);   // nrm points up the screen
    const cx = SCRIPT.cx * WPX;
    const tB = (cx - aL.x) / (aR.x - aL.x), base = aL.clone().lerp(aR, tB);
    const wPx = (x1 - x0) * k;
    const place = (p: { x: number; y: number }) =>
      base.clone().addScaledVector(dir, (p.x - x0) * k - wPx / 2).addScaledVector(nrm, -p.y * k);
    // the script's strokes (pen lifts are jumps: no groove between them), in cutting order
    const segs: Cut['segs'] = [];
    let s = 0;
    const strokes = tx.strokes.map((st) => st.map(place));
    const first = strokes[0]![0]!, last = strokes[strokes.length - 1]!.slice(-1)[0]!;
    // the runs from the walls meet the script where it starts and ends (both on the baseline)
    const lenL = aL.distanceTo(first), lenR = last.distanceTo(aR);
    s = lenL;
    for (const st of strokes) {
      for (let i = 1; i < st.length; i++) {
        const a = st[i - 1]!, b = st[i]!, len = a.distanceTo(b);
        if (len < 1e-3) continue;
        segs.push({ a, b, s0: s, len });
        s += len;
      }
    }
    const lenS = s - lenL;
    const all = strokes.flat();
    const pad = SCRIPT.w + 4;
    const box: [number, number, number, number] = [
      Math.min(...all.map((p) => p.x)) - pad, Math.min(...all.map((p) => p.y)) - pad,
      Math.max(...all.map((p) => p.x)) + pad, Math.max(...all.map((p) => p.y)) + pad,
    ];
    void top; void bot;
    return { runL: [aL.x, aL.y, first.x, first.y], runR: [last.x, last.y, aR.x, aR.y], lenL, lenS, lenR, tot: lenL + lenS + lenR, segs, box };
  }

  /** The cut's head at arc length s: its px in the cutting camera. */
  private headPx(s: number) {
    const c = this.cut;
    if (s <= c.lenL) return new THREE.Vector2(c.runL[0], c.runL[1]).lerp(new THREE.Vector2(c.runL[2], c.runL[3]), s / c.lenL);
    if (s >= c.tot - c.lenR) return new THREE.Vector2(c.runR[0], c.runR[1]).lerp(new THREE.Vector2(c.runR[2], c.runR[3]), (s - (c.tot - c.lenR)) / c.lenR);
    for (const g of c.segs) if (s <= g.s0 + g.len) return g.a.clone().lerp(g.b, (s - g.s0) / g.len);
    return new THREE.Vector2(c.runR[0], c.runR[1]);
  }

  /** How far the cut has gone (px of arc): in from the wall to the word's start on "line", the word written as it is
   *  sung, then out along the line to the other wall. */
  private cutS(t: number, lineW: { start: number; end: number }) {
    const c = this.cut;
    return keys(t, [[lineW.start - 0.26, 0], [lineW.start, c.lenL, ease.inQuad],
      [lineW.end - 0.06, c.lenL + c.lenS, ease.linear], [lineW.end + 0.16, c.tot, ease.inQuad]]);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const T0 = this.ctx.start, T1 = this.ctx.end;
    const w1 = this.l1.words, w2 = this.l2.words;
    const souls = w1.find((w) => w.w.toLowerCase().startsWith('souls'))!;
    const lineW = w2.find((w) => w.w.toLowerCase() === 'line')!;
    const crossed = w2[w2.length - 1]!;
    const tCut = audio.timeOfBeat(Math.floor(audio.beatAt(w2[0]!.start + 0.02)));   // the sub-cut to the second set-up
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
    // the second set-up: his words on his side of the line, near us, one phrase at a time, under the line
    const li2 = w2.indexOf(lineW);
    const os = NEAR.cap / this.only.cap, cs = NEAR.cap / this.crossed.cap;
    const nx = CAM2.pos[0] + 0.2;
    popWords(this.only, w2.slice(0, li2).map((w) => w.start), t, row(nx - (this.only.width * os) / 2, NEAR.z, 0, os),
      { exit: lineW.start - 0.02, exitDur: 0.06, exitRipple: 0 });
    popWords(this.crossed, w2.slice(li2 + 1).map((w) => w.start), t, row(nx - (this.crossed.width * cs) / 2, NEAR.z, 0, cs));

    // ---- the cut: in from the left wall along the line, "line" written in one stroke, out to the right wall
    const sNow = second ? this.cutS(t, lineW) : 0;
    const cutting = second && sNow > 0 && sNow < this.cut.tot;
    u.lineOn!.value = sNow > 0 ? 1 : 0;
    u.revS!.value = sNow;
    const head = this.toFloor(this.headPx(sNow));
    (u.headXZ!.value as THREE.Vector2).copy(head);
    u.headOn!.value = cutting ? 1 : 0;
    // the dark beyond the line follows the point across (as far right as it has been)
    let reach = -99;
    if (sNow > 0) for (let q = 0; q <= 24; q++) reach = Math.max(reach, this.toFloor(this.headPx((sNow * q) / 24)).x);
    u.revealX!.value = sNow >= this.cut.tot ? 99 : reach;

    // ---- the camera: circling above in the first set-up; in the second, still while the line is cut (the word reads
    // from here), then pulling back along its view
    let pos: THREE.Vector3, at: THREE.Vector3, fov = 40;
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
      const P = new THREE.Vector3(...CAM2.pos), A = new THREE.Vector3(...CAM2.at);
      const back = A.clone().sub(P).normalize().multiplyScalar(-CAM2.back);
      // a slow drift in toward the line before it is cut, still while it is cut, then back along the view
      const drift = new THREE.Vector3(0.12, 0.02, 0.35).multiplyScalar(1 - prog(t, tCut, lineW.start - 0.3, ease.inOutCubic));
      pos = P.clone().add(drift).addScaledVector(back, prog(t, crossed.end - 0.1, T1, ease.inOutCubic));
      at = A;
      fov = CAM2.fov;
    }
    this.st.cam.set(pos, at, fov);

    this.st.render(renderer, out, t, keyLight(this.st.cam, audio, t, { seed: 13, I: 1.5, reach: 25 }),
      { wall: 2, cyl: [0, 0, R], freqWall: 6.5, freqFloor: 6, toneWall: 1, toneFloor: 0.45 },
      { cards: false, noFlame: true, rim: 0.8, spec: 0.05 });

    return { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35 };
  }
}
