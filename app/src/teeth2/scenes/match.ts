// Plate 13 `match` (159.23 - 174.77), chorus 3b: the twist. The bite tracing (plate 12's acetate, fixed to a dark
// light-table) is laid over the top-down photographs of one suspect's stone cast after another, one print per beat,
// each sliding in under the acetate on the beat and failing to line up (archVariant: a gap, crowding, a missing
// tooth...), the camera riding the stack. The last print lands on the 164.41 downbeat ("heart"), slides into place on
// "got" and locks on "teeth" (165.16): his cast (plate 9's, the chip on #8). On the lock the tracing goes match red,
// tooth by tooth from the molars, the chip on #8 last, and TEETH (written on the acetate in the tracing pen's hand) is
// red: the first red in the video. The gloved hand signs the T.F. monogram in red into the cast label's blank NAME field.
// The lyric is written on the acetate at the top of the sheet in the tracing pen's hand ('tech', as on the type sheet).
//
// Gate 2 stills: 165.55 (the lock, the red, the hand mid-signature), 165.75 (the monogram complete), 163.0 (a suspect).
// Simple elsewhere (stubs, not broken): "Late night devil" reframes the matched arch per word (the red closing per tooth
// group is not drawn yet), "never ... let go" walks the arch on the beat to the chip and MATCH is stamped on GO.
//
// Files: match-ink.ts (layout, the tracing, the lyric, the label), match-glsl.ts (the cast photograph, the frame).
import * as THREE from 'three';
import { Scene, type Frame } from '../../engine/scene';
import { FSPass, SS_TAP, SCALE } from '../../engine/gl';
import { clamp, ease, lerp, pulse, mulberry32 } from '../../engine/util';
import type { Line } from '../../engine/lyrics';
import { HIS, archVariant, TeethTex, type Arch } from '../teeth';
import { monoPenAt, monoWritten, MONOGRAM } from '../monogram';
import { PHOTO_FRAG, MAIN_FRAG } from './match-glsl';
import {
  PHOTO, LABEL, buildTracing, buildStamp, buildLabelBase, drawLabel, labelCanvas, drawLyric, lyricCanvas,
  layoutPhrase, monoToLabel, chipPoint, type Phrase,
} from './match-ink';

const T_LOCK = 165.16;
const SIGN_T0 = 165.16, SIGN_T1 = 165.7;
const VFOV = 26;
const SLIDE = 0.09;
/** Photo resolution: px per arch mm (the photo is printed 2:1). */
const PHOTO_PPM = 15;
/** The suspects, one per beat (archVariant seeds), chosen for features that show in the upper front teeth from above
 *  (a missing or peg lateral, a gap between the centrals, crowding, flaring); 163.0 gets #7 missing with crowding. */
const SUSPECTS = [5, 25, 13, 4, 33, 17, 2, 29, 12, 1, 37, 35];

interface Pose { x: number; y: number; th: number }
interface Ev { t: number; seed: number; pose: Pose; from: [number, number] }
interface Cam { cx: number; cy: number; w: number; roll: number; tilt: number; yaw: number }

const dataTex = (cv: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};

export default class Match extends Scene {
  private photoPass!: FSPass;
  private pass!: FSPass;
  private tt!: TeethTex;
  private cache = new Map<number, THREE.WebGLRenderTarget>();
  private lru: number[] = [];
  private cam = new THREE.PerspectiveCamera(VFOV, 16 / 9, 1, 5000);
  private evs: Ev[] = [];
  private beats: number[] = [];
  private phrases: Phrase[] = [];
  private lyrCv!: HTMLCanvasElement; private lyrTex!: THREE.CanvasTexture; private lyrKey = '';
  private labCv!: HTMLCanvasElement; private labTex!: THREE.CanvasTexture; private labKey = -1;
  private labBase!: HTMLCanvasElement;

  override init() {
    this.tt = new TeethTex(HIS);
    this.photoPass = new FSPass(PHOTO_FRAG, { teethTex: { value: this.tt.texture }, rtRes: { value: new THREE.Vector2() }, seedF: { value: 0 } });
    const trc = dataTex(buildTracing());
    this.lyrCv = lyricCanvas();
    this.lyrTex = dataTex(this.lyrCv);
    this.labBase = buildLabelBase();
    this.labCv = labelCanvas();
    drawLabel(this.labCv, this.labBase, 0);
    this.labTex = dataTex(this.labCv);
    const labBlank = dataTex(this.labBase);
    const stamp = dataTex(buildStamp());
    this.pass = new FSPass(MAIN_FRAG, {
      invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, res: { value: new THREE.Vector2() },
      photoA: { value: null }, photoB: { value: null }, trcTex: { value: trc }, lyrTex: { value: this.lyrTex },
      labTex: { value: this.labTex }, labBlank: { value: labBlank }, stampTex: { value: stamp },
      prA: { value: new THREE.Vector4() }, prB: { value: new THREE.Vector4() },
      flush: { value: 0 }, redGlow: { value: 0 }, stamp: { value: new THREE.Vector4() },
      keyPos: { value: new THREE.Vector3(329, 318, 560) }, lampK: { value: 1 }, ring: { value: new THREE.Vector4() },
      hTip: { value: new THREE.Vector3() }, hE1: { value: new THREE.Vector3() }, hE2: { value: new THREE.Vector3() }, hE3: { value: new THREE.Vector3() },
      handOn: { value: 0 }, ssTap: SS_TAP,
    });
    const au = this.ctx.audio;
    this.beats = au.beats.filter((b) => b > this.ctx.start - 0.3 && b < this.ctx.end + 0.5);
    // the prints: a suspect on each beat from the plate's first downbeat; his on the 164.41 downbeat
    const R = mulberry32(1332);
    const sb = this.beats.filter((b) => b >= this.ctx.start - 0.02 && b < 164.3);
    const dirs: [number, number][] = [[1, 0.15], [-0.2, -1], [-1, 0.2], [0.25, 1], [1, -0.3], [-1, -0.25], [0.1, -1], [-0.3, 1]];
    sb.forEach((b, i) => {
      const seed = SUSPECTS[i % SUSPECTS.length]!;
      this.evs.push({ t: b, seed, pose: { x: (R() - 0.5) * 9, y: (R() - 0.5) * 7 - 2, th: (R() - 0.5) * 0.07 }, from: dirs[i % dirs.length]! });
    });
    this.evs.push({ t: 164.41, seed: 0, pose: { x: 0, y: 0, th: 0 }, from: [1, 0.35] });
    this.buildPhrases();
  }

  // ------------------------------------------------------------------ lyric phrases
  private buildPhrases() {
    const ly = this.ctx.lyrics;
    const lineAt = (t0: number) => ly.lines.find((l: Line) => Math.abs(l.start - t0) < 0.3)!;
    const A = lineAt(159.23), B = lineAt(162.68), C = lineAt(166.13), D = lineAt(169.37);
    const P = (line: Line, idx: number[], hero: number, red = false) =>
      ({ line, words: idx.map((i) => line.words[i]!), hero, red, t0: 0, t1: 0, rows: [] }) as Phrase;
    const list = [
      P(A, [0, 1, 2], -1), P(A, [3, 4, 5], -1), P(A, [6, 7], 1),
      P(B, [0, 1, 2, 3], -1), P(B, [4, 5, 6, 7], 3, true),
      P(C, [0, 1, 2], 2), P(C, [3, 4, 5], -1), P(C, [6, 7], -1),
      P(D, [0, 1, 2], -1), P(D, [3, 4], -1), P(D, [5, 6], 1),
    ];
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!, nx = list[i + 1];
      p.t0 = p.words[0]!.start - 0.045;
      if (nx && nx.line === p.line) p.t1 = nx.words[0]!.start - 0.045;
      else {
        p.t1 = this.beats.find((b) => b > p.line.end + 0.02) ?? p.line.end + 0.4;
        if (nx) p.t1 = Math.min(p.t1, nx.words[0]!.start - 0.045);
      }
      layoutPhrase(p);
    }
    this.phrases = list;
  }

  // ------------------------------------------------------------------ the cast photographs (cached per cast)
  private photo(seed: number): THREE.WebGLRenderTarget {
    let rt = this.cache.get(seed);
    if (rt) { this.lru = [seed, ...this.lru.filter((s) => s !== seed)]; return rt; }
    // keep at most four (a beat's straddling sub-frames need two, the lock needs his)
    while (this.lru.length >= 4) { const old = this.lru.pop()!; this.cache.get(old)?.dispose(); this.cache.delete(old); }
    const k = SCALE === 1 ? 1 : 1.5;
    const w = Math.round((PHOTO.x1 - PHOTO.x0) * PHOTO_PPM * k), h = Math.round((PHOTO.y1 - PHOTO.y0) * PHOTO_PPM * k);
    rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false });
    const arch: Arch = seed === 0 ? HIS : archVariant(seed);
    this.tt.set(arch);
    this.photoPass.u.rtRes!.value.set(w, h);
    this.photoPass.u.seedF!.value = seed;
    this.photoPass.render(this.ctx.renderer, rt);
    this.cache.set(seed, rt);
    this.lru = [seed, ...this.lru];
    return rt;
  }

  // ------------------------------------------------------------------ the stack: which prints, where
  /** Pose of event i's print at t (sliding in before its beat, settling after). */
  private pose(i: number, t: number): Pose {
    const e = this.evs[i]!;
    const k = ease.outCubic(clamp((t - (e.t - SLIDE)) / SLIDE));
    const D = 300 * (1 - k);
    let { x, y, th } = e.pose;
    x += e.from[0] * D; y += e.from[1] * D; th += (1 - k) * 0.12 * Math.sign(e.from[0] || 1);
    if (e.seed !== 0) {
      // the examiner nudges a suspect's print toward the tracing during its beat (it never fits)
      const n = clamp((t - e.t - 0.1) / 0.3);
      x -= e.pose.x * 0.25 * ease.inOutCubic(n); th -= e.pose.th * 0.4 * ease.inOutCubic(n);
    } else {
      // his: lands off the mark, slides into place on "got", locks on "teeth"
      const off = { x: 13, y: 8.5, th: 0.075 };
      const g = ease.inOutCubic(clamp((t - 164.84) / (T_LOCK - 164.84)));
      const near = { x: 0.9, y: 0.6, th: 0.006 };
      const lockK = ease.outBack(clamp((t - T_LOCK) / 0.07), 2.2);
      const cx = lerp(lerp(off.x, near.x, g), 0, t >= T_LOCK ? lockK : 0);
      const cy = lerp(lerp(off.y, near.y, g), 0, t >= T_LOCK ? lockK : 0);
      const ct = lerp(lerp(off.th, near.th, g), 0, t >= T_LOCK ? lockK : 0);
      x += cx; y += cy; th += ct;
    }
    return { x, y, th };
  }
  private stackAt(t: number): number {
    let i = -1;
    for (let k = 0; k < this.evs.length; k++) if (t >= this.evs[k]!.t - SLIDE) i = k;
    return i;
  }

  // ------------------------------------------------------------------ the camera
  private framing(t: number): Cam {
    // per beat during the suspects; the payoff hold from the lock; the matched arch walked to the chip at the end
    const base: Cam = { cx: 0, cy: 0, w: 330, roll: -0.04, tilt: 0.16, yaw: 0 };
    // one framing per suspect beat; each keeps the lyric band inside title-safe (a line with a hero needs
    // cy <= -85 + 0.411 * h, a line without one cy <= -58 + 0.411 * h; h = w * 9 / 16)
    const sus: Partial<Cam>[] = [
      { cx: 10, cy: 4, w: 340, roll: -0.05 }, { cx: -10, cy: 0, w: 280, roll: 0.05 }, { cx: 30, cy: 2, w: 300, roll: -0.07 },
      { cx: 0, cy: 10, w: 320, roll: 0.03 }, { cx: 16, cy: 4, w: 330, roll: -0.04 }, { cx: -6, cy: -14, w: 320, roll: 0.05 },
      { cx: 20, cy: -10, w: 340, roll: -0.03 }, { cx: 4, cy: -16, w: 310, roll: 0.04 }, { cx: 8, cy: -2, w: 280, roll: -0.05 },
      { cx: -16, cy: 0, w: 270, roll: 0.05 }, { cx: 24, cy: 4, w: 300, roll: -0.06 }, { cx: 10, cy: -12, w: 320, roll: 0.03 },
    ];
    const at = (t2: number): Cam => {
      if (t2 >= 166.13) {
        // stub: "Late night devil...": reframe per word across the matched arch; "never...let go": walk to the chip.
        // From GO (MATCH) the NAME label is kept out of frame (never both readable at once).
        const walk: [number, Partial<Cam>][] = [
          [166.13, { cx: 10, cy: -14, w: 330, roll: 0.03 }], [166.56, { cx: -12, cy: -20, w: 300, roll: -0.04 }], [167.0, { cx: 14, cy: -14, w: 330, roll: 0.05 }],
          [167.43, { cx: -6, cy: 0, w: 300, roll: -0.03 }], [167.86, { cx: 8, cy: 4, w: 340, roll: -0.04 }],
          [169.59, { cx: 30, cy: 0, w: 300, roll: 0.04 }], [170.02, { cx: 22, cy: -2, w: 290, roll: -0.03 }], [170.45, { cx: 14, cy: -4, w: 280, roll: 0.03 }],
          [170.88, { cx: 8, cy: -6, w: 268, roll: -0.04 }], [171.31, { cx: 4, cy: -8, w: 258, roll: 0.03 }], [171.74, { cx: 0, cy: -10, w: 250, roll: -0.02 }],
          [172.18, { cx: -2, cy: -30, w: 250, roll: 0.02 }], [172.61, { cx: -46, cy: -32, w: 236, roll: -0.03 }],
        ];
        let j = 0;
        while (j < walk.length - 1 && t2 >= walk[j + 1]![0]) j++;
        return { ...base, ...walk[j]![1] };
      }
      if (t2 >= 164.41 - 0.02) {
        // his print: wide on the landing, a push on "got", and on the lock a hard push in to the front teeth and the
        // label (the centrals >= 120 px wide), drifting on toward the signature
        const land: Cam = { ...base, cx: 20, cy: -16, w: 340, roll: -0.06 };
        const got: Cam = { ...base, cx: 32, cy: -18, w: 312, roll: -0.045 };
        const pay: Cam = { ...base, cx: 46, cy: -21, w: 288, roll: -0.035, tilt: 0.18 };
        const mix = (a: Cam, b: Cam, k: number): Cam => ({ cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), w: lerp(a.w, b.w, k), roll: lerp(a.roll, b.roll, k), tilt: lerp(a.tilt, b.tilt, k), yaw: 0 });
        let c = mix(land, got, ease.inOutCubic(clamp((t2 - 164.84) / (T_LOCK - 164.84))));
        c = mix(c, pay, ease.outCubic(clamp((t2 - T_LOCK) / 0.14)));
        const d = ease.inOutQuad(clamp((t2 - T_LOCK - 0.14) / 0.83));
        return { ...c, cx: c.cx + 3 * d, cy: c.cy - 1 * d, w: c.w - 6 * d };
      }
      let i = this.evs.findIndex((e) => e.t > t2) - 1;
      if (i < 0) i = 0;
      return { ...base, ...sus[i % sus.length]! };
    };
    // ease into each reframing just before its beat (0.16 s), riding with the incoming print
    const c1 = at(t);
    const next = this.beats.find((b) => b > t && b - t < 0.16);
    let c = c1;
    if (next !== undefined) {
      const c2 = at(next + 0.001);
      const k = ease.inOutCubic(1 - (next - t) / 0.16);
      c = { cx: lerp(c1.cx, c2.cx, k), cy: lerp(c1.cy, c2.cy, k), w: lerp(c1.w, c2.w, k), roll: lerp(c1.roll, c2.roll, k), tilt: lerp(c1.tilt, c2.tilt, k), yaw: lerp(c1.yaw, c2.yaw, k) };
    }
    return c;
  }

  private placeCamera(t: number) {
    const s = this.framing(t);
    // the lock's jolt: the frame kicks in a hair and settles
    const kick = pulse(t, T_LOCK, 0.08);
    const w = s.w * (1 - 0.018 * kick);
    const hf = Math.atan(Math.tan((VFOV * Math.PI) / 360) * (16 / 9));
    const D = w / 2 / Math.tan(hf);
    const tgt = new THREE.Vector3(s.cx, -s.cy, 0);
    const dir = new THREE.Vector3(Math.sin(s.yaw), -Math.sin(s.tilt), Math.cos(s.tilt)).normalize();
    this.cam.position.copy(tgt).addScaledVector(dir, D);
    this.cam.up.set(Math.sin(s.roll), Math.cos(s.roll), 0);
    this.cam.lookAt(tgt);
    this.cam.fov = VFOV; this.cam.aspect = 16 / 9;
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
  }

  // ------------------------------------------------------------------ the gloved hand
  /** Pen tip (table mm, z up) and the pen's heading; null when the hand is out of frame. */
  private hand(t: number): { x: number; y: number; z: number; head: number; tilt: number } | null {
    if (t < 164.86 || t > 166.4) return null;
    // label point -> table (his print, locked from 165.16)
    const lab = (lx: number, ly: number) => [LABEL.x0 + lx, LABEL.y0 + ly] as const;
    const p0 = MONOGRAM.strokes[0]![0]!;
    const [sx, sy] = lab(...monoToLabel(p0.x, p0.y));
    let x: number, y: number, z: number;
    if (t < SIGN_T0) {
      // in from the lower right, the pen coming down onto the label as the print locks
      const k = ease.outCubic(clamp((t - 164.86) / (SIGN_T0 - 164.86)));
      x = lerp(sx + 150, sx, k); y = lerp(sy + 120, sy, k); z = lerp(60, 0, ease.inOutCubic(k));
    } else if (t <= SIGN_T1 + 0.02) {
      const pen = monoPenAt(t, SIGN_T0, SIGN_T1);
      [x, y] = lab(...monoToLabel(pen.x, pen.y));
      z = pen.down || t < SIGN_T0 + 0.01 ? 0 : 3.5;
      if (t > SIGN_T1) z = 0;
    } else {
      const pe = monoPenAt(SIGN_T1, SIGN_T0, SIGN_T1);
      const [ex, ey] = lab(...monoToLabel(pe.x, pe.y));
      const k = ease.inCubic(clamp((t - SIGN_T1 - 0.05) / 0.6));
      x = ex + 160 * k; y = ey + 110 * k; z = 4 + 70 * ease.outQuad(clamp((t - SIGN_T1 - 0.05) / 0.25));
    }
    // the wrist pivots a little as the pen travels across the label
    const head = 0.8 + (x - sx) * 0.0035;
    return { x, y, z, head, tilt: 1.08 + (y - sy) * 0.002 };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t;
    const u = this.pass.u;
    this.placeCamera(t);
    (u.invVP!.value as THREE.Matrix4).multiplyMatrices(this.cam.matrixWorld, this.cam.projectionMatrixInverse);
    (u.camPos!.value as THREE.Vector3).copy(this.cam.position);
    (u.res!.value as THREE.Vector2).set(out.width, out.height);

    // the stack
    const i = this.stackAt(t);
    const setPr = (v: THREE.Vector4, k: number) => { if (k < 0) { v.set(0, 0, 0, 0); return; } const p = this.pose(k, t); v.set(p.x, p.y, p.th, 1); };
    setPr(u.prB!.value as THREE.Vector4, i);
    setPr(u.prA!.value as THREE.Vector4, i - 1);
    u.photoB!.value = i >= 0 ? this.photo(this.evs[i]!.seed).texture : null;
    u.photoA!.value = i >= 1 ? this.photo(this.evs[i - 1]!.seed).texture : u.photoB!.value;
    if (i < 0) (u.prB!.value as THREE.Vector4).w = 0;

    // the red: the tracing tooth by tooth from the molars, the chip on #8 last; a lift that settles
    u.flush!.value = t < T_LOCK ? -0.1 : clamp((t - T_LOCK) / 0.24) * 1.04;
    u.redGlow!.value = t < T_LOCK ? 0 : 0.85 * pulse(t, T_LOCK, 0.4) + 0.22;
    // the light event: the copy-stand lamp kicks on the lock (a surge as the print snaps home) and settles
    u.lampK!.value = 1 + (t < T_LOCK ? 0 : 0.6 * pulse(t, T_LOCK, 0.09) + 0.08 * pulse(t, T_LOCK, 0.6));
    // the examiner's ring round the chip, drawn as the red reaches #8 (it stays until the end of the plate)
    const [rx, ry] = chipPoint();
    (u.ring!.value as THREE.Vector4).set(rx - 1.0, ry - 1.5, 8.0, clamp((t - 165.31) / 0.16) * 1.06);
    // MATCH on GO (stub)
    const go = 172.61;
    (u.stamp!.value as THREE.Vector4).set(-44, 26, -0.14, t >= go ? 1 : 0);

    // the lyric
    const ph = this.phrases.find((p) => t >= Math.max(p.t0, p.red ? Math.min(p.t0, T_LOCK) : p.t0) && t < p.t1) ?? null;
    const lk = ph ? `${this.phrases.indexOf(ph)}:${Math.round(t * 240)}` : 'none';
    if (lk !== this.lyrKey) {
      drawLyric(this.lyrCv, ph, ph?.red && t < T_LOCK ? Math.min(t, ph.words[ph.hero]!.start - 0.05) : t);
      this.lyrTex.needsUpdate = true;
      this.lyrKey = lk;
    }
    // the label: the monogram signed into NAME
    const len = t < SIGN_T0 ? 0 : monoWritten(t, SIGN_T0, SIGN_T1);
    if (len !== this.labKey) {
      drawLabel(this.labCv, this.labBase, len);
      this.labTex.needsUpdate = true;
      this.labKey = len;
    }

    // the hand
    const h = this.hand(t);
    u.handOn!.value = h ? 1 : 0;
    if (h) {
      const c = Math.cos(h.tilt), s = Math.sin(h.tilt);
      const dx = Math.cos(h.head), dy = Math.sin(h.head); // table, y down: toward the lower right
      const e1 = new THREE.Vector3(dx * c, -dy * c, s);
      const e2 = new THREE.Vector3(-dy, -dx, 0);
      const e3 = new THREE.Vector3().crossVectors(e1, e2).normalize();
      if (e3.z < 0) e3.negate();
      (u.hTip!.value as THREE.Vector3).set(h.x, -h.y, 0.45 + h.z);
      (u.hE1!.value as THREE.Vector3).copy(e1);
      (u.hE2!.value as THREE.Vector3).copy(e2);
      (u.hE3!.value as THREE.Vector3).copy(e3);
    }
    this.pass.render(renderer, out);

    // post: a small jolt on each landing, a harder one on the lock
    const land = this.evs.reduce((m, e) => Math.max(m, pulse(t, e.t, 0.05)), 0);
    const lock = pulse(t, T_LOCK, 0.09);
    const sh = 2.2 * land + 7 * lock;
    return { shake: [sh * 0.8, -sh * 0.6] as [number, number], halation: 0.2 };
  }
}

