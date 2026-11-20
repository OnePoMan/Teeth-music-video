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
import { HIS, archVariant, TeethTex, tooth, cuspTips, type Arch, type V2 } from '../teeth';
import { monoPenAt, monoWritten, MONOGRAM } from '../monogram';
import { PHOTO_FRAG, MAIN_FRAG } from './match-glsl';
import {
  PHOTO, PHOTO_SCALE, LABEL, buildTracing, buildStamp, buildLabelBase, drawLabel, labelCanvas, drawLyric, lyricCanvas,
  layoutPhrase, monoToLabel, chipPoint, rowTimes, strokePoint, writtenLength, buildGroups, LYR_CX, type Phrase,
} from './match-ink';

const T_LOCK = 165.16;
const SIGN_T0 = 165.16, SIGN_T1 = 165.7;
const VFOV = 26;
const SLIDE = 0.09;
/** Photo resolution: px per arch mm (the photo is printed 2:1). */
const PHOTO_PPM = 15;
/** The suspects, one per beat (archVariant seeds), chosen for features that show in the upper front teeth from above
 *  (a missing or peg lateral, a gap between the centrals, crowding, flaring); 163.0 gets a gap between the centrals
 *  and #10 missing (seed 11). */
const SUSPECTS = [12, 1, 37, 29, 5, 10, 34, 25, 11, 33, 17, 15];

interface Pose { x: number; y: number; th: number }
interface Ev { t: number; seed: number; pose: Pose; from: [number, number] }
interface Cam { cx: number; cy: number; w: number; roll: number; tilt: number; yaw: number }
/** One word the glove writes on the acetate: when (a..b), which row, its chars, and where its pen starts and ends. */
interface Write { a: number; b: number; ph: Phrase; row: Phrase['rows'][number]; times: [number, number][]; p0: [number, number]; p1: [number, number] }
/** The glove's heading while it writes the lyric (table, radians, y down; 0 = the forearm off to the right): up and to
 *  the right, so the hand, the sleeve and their shadow (the lamp is up and to the right) stay above the words. */
const HEAD_W = -0.75;
/** The pen tip's height (table mm above the paper) when it is down on the acetate. */
const Z_AC_PEN = 0.88;
/** MATCH, stamped on "go" (the line's last word) to the left of the bite, clear of the tracing. */
const STAMP_AT = { x: -76, y: -11, th: -0.1 };

/** Register a suspect's print on the tracing the way an examiner would: a rigid fit (no scale: the photographs are
 *  at the tracing's scale) of the suspect's midline point and canine tips onto his. The failure then shows in the
 *  teeth themselves (a gap under a bar, a canine tip on a lateral, a rotated tooth across a bar), not as an offset. */
function register(arch: Arch): Pose {
  const pts = (a: Arch): V2[] => {
    const c6 = cuspTips(tooth(a, 6))[0]!.p, c11 = cuspTips(tooth(a, 11))[0]!.p;
    const mid: V2 = [(tooth(a, 8).contactM[0] + tooth(a, 9).contactM[0]) / 2, (tooth(a, 8).contactM[1] + tooth(a, 9).contactM[1]) / 2];
    return [mid, mid, c6, c11].map(([x, y]) => [x * PHOTO_SCALE, y * PHOTO_SCALE] as V2); // the midline counts twice
  };
  const S = pts(arch), H = pts(HIS);
  const cen = (P: V2[]) => P.reduce((m, p) => [m[0] + p[0] / P.length, m[1] + p[1] / P.length] as V2, [0, 0] as V2);
  const cs = cen(S), ch = cen(H);
  let sn = 0, cn = 0;
  S.forEach((p, i) => {
    const a = [p[0] - cs[0], p[1] - cs[1]], b = [H[i]![0] - ch[0], H[i]![1] - ch[1]];
    cn += a[0]! * b[0]! + a[1]! * b[1]!; sn += a[0]! * b[1]! - a[1]! * b[0]!;
  });
  const th = Math.atan2(sn, cn), c = Math.cos(th), s = Math.sin(th);
  // table = R(th) q + o, R = [c -s; s c]
  return { x: ch[0] - (c * cs[0] - s * cs[1]), y: ch[1] - (s * cs[0] + c * cs[1]), th };
}

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
  private labSuspect!: THREE.CanvasTexture;
  private writes: Write[] = [];
  private lineC!: Line;
  private go = 0;

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
    // the suspects' prints carry their own files' labels (another case, other fine print); his arrives with the last cast
    this.labSuspect = dataTex(buildLabelBase('07-41', 'REF 07-41/3 · TYPE III STONE · TRIMMED'));
    const labBlank = this.labSuspect;
    const stamp = dataTex(buildStamp());
    this.pass = new FSPass(MAIN_FRAG, {
      invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, res: { value: new THREE.Vector2() },
      photoA: { value: null }, photoB: { value: null }, trcTex: { value: trc }, lyrTex: { value: this.lyrTex },
      labTex: { value: this.labTex }, labBlank: { value: labBlank }, stampTex: { value: stamp },
      prA: { value: new THREE.Vector4() }, prB: { value: new THREE.Vector4() },
      flush: { value: 0 }, redGlow: { value: 0 }, stamp: { value: new THREE.Vector4() }, stampSh: { value: new THREE.Vector4() },
      keyPos: { value: new THREE.Vector3(230, 240, 900) }, lampK: { value: 1 }, cone: { value: new THREE.Vector2() }, ring: { value: new THREE.Vector4() },
      hTip: { value: new THREE.Vector3() }, hE1: { value: new THREE.Vector3() }, hE2: { value: new THREE.Vector3() }, hE3: { value: new THREE.Vector3() },
      handOn: { value: 0 }, shCut: { value: 1e4 }, ssTap: SS_TAP,
      grpTex: { value: dataTex(buildGroups()) }, gpA: { value: new THREE.Vector4() }, gpB: { value: new THREE.Vector4() },
    });
    const au = this.ctx.audio;
    this.beats = au.beats.filter((b) => b > this.ctx.start - 0.3 && b < this.ctx.end + 0.5);
    // the prints: a suspect on each beat from the plate's first downbeat; his on the 164.41 downbeat
    const R = mulberry32(1332);
    const sb = this.beats.filter((b) => b >= this.ctx.start - 0.02 && b < 164.3);
    const dirs: [number, number][] = [[1, 0.15], [-0.2, -1], [-1, 0.2], [0.25, 1], [1, -0.3], [-1, -0.25], [0.1, -1], [-0.3, 1]];
    sb.forEach((b, i) => {
      const seed = SUSPECTS[i % SUSPECTS.length]!;
      const reg = register(archVariant(seed));
      this.evs.push({ t: b, seed, pose: { x: reg.x + (R() - 0.5) * 1.2, y: reg.y + (R() - 0.5) * 1.2, th: reg.th + (R() - 0.5) * 0.012 }, from: dirs[i % dirs.length]! });
    });
    this.evs.push({ t: 164.41, seed: 0, pose: { x: 0, y: 0, th: 0 }, from: [1, 0.35] });
    this.buildPhrases();
  }

  // ------------------------------------------------------------------ lyric phrases
  private buildPhrases() {
    const ly = this.ctx.lyrics;
    const lineAt = (t0: number) => ly.lines.find((l: Line) => Math.abs(l.start - t0) < 0.3)!;
    const A = lineAt(159.23), B = lineAt(162.68), C = lineAt(166.13), D = lineAt(169.37);
    this.lineC = C;
    this.go = D.words[6]!.start;
    const P = (line: Line, idx: number[], hero: number, red = false, cx = LYR_CX) =>
      ({ line, words: idx.map((i) => line.words[i]!), hero, red, t0: 0, t1: 0, rows: [], cx }) as Phrase & { cx: number };
    // lines C and D: each phrase written where the camera's walk along the arch keeps it whole in frame
    const list = [
      P(A, [0, 1, 2], -1), P(A, [3, 4, 5], -1), P(A, [6, 7], 1),
      P(B, [0, 1, 2, 3], -1), P(B, [4, 5, 6, 7], 3, true),
      P(C, [0, 1, 2], 2, false, -4), P(C, [3, 4, 5], -1, false, 10), P(C, [6, 7], -1, false, 0),
      P(D, [0, 1, 2], -1, false, 20), P(D, [3, 4], -1, false, -22), P(D, [5, 6], 1, false, -38),
    ];
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!, nx = list[i + 1];
      p.t0 = p.words[0]!.start - 0.045;
      if (nx && nx.line === p.line) p.t1 = nx.words[0]!.start - 0.045;
      else {
        p.t1 = this.beats.find((b) => b > p.line.end + 0.02) ?? p.line.end + 0.4;
        if (nx) p.t1 = Math.min(p.t1, nx.words[0]!.start - 0.045);
      }
      layoutPhrase(p, p.cx);
    }
    this.phrases = list;
    // the words the glove writes, in order (TEETH excepted: on "teeth" the glove is signing NAME)
    for (const p of list) for (const r of p.rows) {
      const { times, words } = rowTimes(p, r);
      for (const w of words) {
        if (p.red && w.wi === p.hero) continue;
        const L0 = r.st.charRange[w.c0]![0], L1 = r.st.charRange[w.c1 - 1]![1];
        const at = (L: number): [number, number] => { const q = strokePoint(r.st, L); return [r.x + q[0], r.y + q[1]]; };
        this.writes.push({ a: w.a, b: w.b, ph: p, row: r, times, p0: at(L0 + 1e-3), p1: at(L1) });
      }
    }
    this.writes.sort((x, y) => x.a - y.a);
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
      // registered on the midline and the canines, the examiner rocks it a hair (it still fails on the teeth)
      const n = clamp((t - e.t - 0.1) / 0.3);
      x += 0.8 * Math.sin(n * 3.1); th += 0.004 * Math.sin(n * 3.1);
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
        // "Late night devil...": one framing per beat, leaning toward the tooth group whose outline closes on that
        // beat's word (#8, #9, #7, #10, #6/#11, then each half); "never...let go": the camera walks the matched
        // arch tooth by tooth on the beat (#11, #10, #9, then #6, #7, #8) and lands on the chip with MATCH on GO.
        // Each keeps its phrase inside title-safe; from GO the NAME label is out of frame (right edge < table x 80).
        const walk: [number, Partial<Cam>][] = [
          [166.13, { cx: -10, cy: -24, w: 290, roll: 0.03 }], [166.56, { cx: 6, cy: -26, w: 276, roll: -0.035 }], [167.0, { cx: -16, cy: -22, w: 300, roll: 0.045 }],
          [167.43, { cx: 18, cy: -10, w: 262, roll: -0.04 }], [167.86, { cx: 26, cy: -8, w: 248, roll: 0.03 }], [168.29, { cx: -14, cy: -10, w: 270, roll: -0.03 }],
          [168.72, { cx: 12, cy: -12, w: 256, roll: 0.04 }], [169.16, { cx: 30, cy: -8, w: 250, roll: -0.03 }],
          [169.59, { cx: 34, cy: -6, w: 236, roll: 0.035 }], [170.02, { cx: 22, cy: -8, w: 230, roll: -0.03 }], [170.45, { cx: 10, cy: -6, w: 236, roll: 0.03 }],
          [170.88, { cx: -34, cy: -6, w: 236, roll: -0.035 }], [171.31, { cx: -24, cy: -8, w: 226, roll: 0.03 }], [171.74, { cx: -12, cy: -8, w: 226, roll: -0.025 }],
          [172.18, { cx: -34, cy: -46, w: 244, roll: 0.02 }], [172.61, { cx: -38, cy: -46, w: 232, roll: -0.015 }],
        ];
        if (t2 >= 173.04) {
          // the last bar: from the downbeat a slow push down onto the chip and MATCH (the lyric leaves at 173.90)
          const a: Cam = { ...base, cx: -38, cy: -46, w: 232, roll: -0.015 };
          const k = ease.inOutCubic(clamp((t2 - 173.04) / 1.7));
          return { ...a, cx: lerp(a.cx, -22, k), cy: lerp(a.cy, -8, k), w: lerp(a.w, 200, k), roll: lerp(a.roll, 0.02, k), tilt: lerp(a.tilt, 0.1, k) };
        }
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
  /** The pen writing the lyric on the acetate (table mm, z up); null once it has left after GO. */
  private writeAt(t: number): { x: number; y: number; z: number } | null {
    const W = this.writes;
    const first = W[0]!, last = W[W.length - 1]!;
    if (t < first.a) return { x: first.p0[0], y: first.p0[1], z: Z_AC_PEN + 4 * clamp((first.a - t) / 0.3) };
    if (t > last.b) {
      // GO written: the hand lifts away off to the right
      const k = clamp((t - last.b - 0.04) / 0.5);
      if (k >= 1) return null;
      return { x: last.p1[0] + 240 * ease.inCubic(k), y: last.p1[1] - 40 * ease.inCubic(k), z: Z_AC_PEN + 2 + 90 * ease.outQuad(k) };
    }
    let i = 0;
    while (i < W.length - 1 && W[i + 1]!.a <= t) i++;
    const w = W[i]!;
    if (t <= w.b) {
      const q = strokePoint(w.row.st, writtenLength(w.row.st, w.times, t));
      return { x: w.row.x + q[0], y: w.row.y + q[1], z: Z_AC_PEN };
    }
    // between words: the pen lifts and travels to the next word's first stroke
    const n = W[i + 1]!;
    const k = clamp((t - w.b) / Math.max(1e-3, n.a - w.b)), e = ease.inOutCubic(k);
    const d = Math.hypot(n.p0[0] - w.p1[0], n.p0[1] - w.p1[1]);
    return { x: lerp(w.p1[0], n.p0[0], e), y: lerp(w.p1[1], n.p0[1], e), z: Z_AC_PEN + Math.min(3 + d * 0.25, 30) * Math.sin(Math.PI * k) };
  }
  /** Pen tip (table mm, z up) and the pen's heading; null when the hand is out of frame. The glove writes every
   *  lyric word on the acetate (heading HEAD_W, forearm off to the right), dashes to the label on "teeth" to sign
   *  NAME (heading ~0.8, as at gate 2) and goes back to the lyric for "Late night devil". */
  private hand(t: number): { x: number; y: number; z: number; head: number; tilt: number } | null {
    // label point -> table (his print, locked from 165.16)
    const lab = (lx: number, ly: number) => [LABEL.x0 + lx, LABEL.y0 + ly] as const;
    const p0 = MONOGRAM.strokes[0]![0]!;
    const [sx, sy] = lab(...monoToLabel(p0.x, p0.y));
    const signHead = (x: number) => 0.8 + (x - sx) * 0.0035;
    const signTilt = (y: number) => 0.96 + (y - sy) * 0.002;
    const got = [...this.writes].reverse().find((w) => w.b <= SIGN_T0)!;
    const late = this.writes.find((w) => w.a >= SIGN_T1)!;
    const pe = monoPenAt(SIGN_T1, SIGN_T0, SIGN_T1);
    const [ex, ey] = lab(...monoToLabel(pe.x, pe.y));
    const tOff = SIGN_T1 + 0.02, tGo = SIGN_T1 + 0.07;
    if (t > got.b && t < SIGN_T0) {
      // the dash from GOT down to the label, the pen coming down onto NAME as the print locks
      const k = clamp((t - got.b) / (SIGN_T0 - got.b)), e = ease.inOutCubic(k);
      const x = lerp(got.p1[0], sx, e), y = lerp(got.p1[1], sy, e);
      return { x, y, z: lerp(Z_AC_PEN, 0, e) + 24 * Math.sin(Math.PI * k), head: lerp(HEAD_W, signHead(sx), e), tilt: lerp(0.96, signTilt(sy), e) };
    }
    if (t >= SIGN_T0 && t <= tOff) {
      const pen = monoPenAt(t, SIGN_T0, SIGN_T1);
      const [x, y] = lab(...monoToLabel(pen.x, pen.y));
      let z = pen.down || t < SIGN_T0 + 0.01 ? 0 : 3.5;
      if (t > SIGN_T1) z = 0;
      return { x, y, z, head: signHead(x), tilt: signTilt(y) };
    }
    if (t > tOff && t < late.a) {
      // signed: the pen lifts off the label, then goes back up to the top of the sheet for the next line
      const k = clamp((t - tGo) / (late.a - tGo)), e = ease.inOutCubic(k);
      return { x: lerp(ex, late.p0[0], e), y: lerp(ey, late.p0[1], e), z: lerp(4, Z_AC_PEN, e) + 30 * Math.sin(Math.PI * k), head: lerp(signHead(ex), HEAD_W, e), tilt: lerp(signTilt(ey), 0.96, e) };
    }
    const p = this.writeAt(t);
    return p ? { ...p, head: HEAD_W, tilt: 0.96 } : null;
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
    u.labTex!.value = i >= 0 && this.evs[i]!.seed === 0 ? this.labTex : this.labSuspect;
    u.photoA!.value = i >= 1 ? this.photo(this.evs[i - 1]!.seed).texture : u.photoB!.value;
    if (i < 0) (u.prB!.value as THREE.Vector4).w = 0;

    // the red: the tracing tooth by tooth from the molars, the chip on #8 last; a lift that settles
    u.flush!.value = t < T_LOCK ? -0.1 : clamp((t - T_LOCK) / 0.24) * 1.04;
    u.redGlow!.value = t < T_LOCK ? 0 : 0.85 * pulse(t, T_LOCK, 0.4) + 0.22;
    // the light event: on the lock the examiner snaps the lamp down onto the sheet: a surge, then an exposure step that
    // holds, the beam tighter and harder (the pool closes on the bite, the label and the hand; the edges go to film black)
    const lockK = t < T_LOCK ? 0 : ease.outCubic(clamp((t - T_LOCK) / 0.05));
    u.lampK!.value = 0.86 + 0.28 * lockK + (t < T_LOCK ? 0 : 0.35 * pulse(t, T_LOCK, 0.08));
    const deg = Math.PI / 180;
    (u.cone!.value as THREE.Vector2).set(Math.cos(lerp(5.0, 5.2, lockK) * deg), Math.cos(lerp(10.5, 9.2, lockK) * deg));
    // ...and pulled lower and closer: every shadow (the hand, the prints, the acetate edge) snaps harder
    (u.keyPos!.value as THREE.Vector3).set(lerp(230, 215, lockK), lerp(240, 225, lockK), lerp(900, 840, lockK));
    // the examiner's ring round the chip, drawn as the red reaches #8 (it stays until the end of the plate)
    const [rx, ry] = chipPoint();
    (u.ring!.value as THREE.Vector4).set(rx - 1.0, ry - 1.5, 8.0, clamp((t - 165.31) / 0.16) * 1.06);
    // MATCH, stamped on GO: the ink lands whole with the stamp's thump
    const go = this.go;
    (u.stamp!.value as THREE.Vector4).set(STAMP_AT.x, STAMP_AT.y, STAMP_AT.th, t >= go ? 1 : 0);
    // its block coming down onto the sheet (0.12 s) and lifting off (0.25 s): the shadow, away from the lamp, closes
    // on the stamp and sharpens as it lands
    {
      const zs = t < go ? 70 * clamp((go - t) / 0.12) : 70 * ease.inQuad(clamp((t - go - 0.04) / 0.25));
      const on = (t > go - 0.12 && t < go + 0.29) ? 1 : 0;
      const kp = u.keyPos!.value as THREE.Vector3;
      const lx = kp.x, ly = -kp.y, lz = kp.z;
      const m = zs / Math.max(1, lz - zs);
      (u.stampSh!.value as THREE.Vector4).set(STAMP_AT.x + (STAMP_AT.x - lx) * m, STAMP_AT.y + (STAMP_AT.y - ly) * m, 0.6 + zs * 0.08, on * 0.75 * (1 - zs / 140));
    }
    // "Late night devil, put your hands on me": per word, the red closes round one tooth group
    const gp = this.lineC.words.map((w) => (t < w.start - 0.03 ? 0 : clamp((t - w.start + 0.03) / Math.min(0.3, Math.max(0.16, (w.end - w.start) * 0.75))) * 1.02));
    (u.gpA!.value as THREE.Vector4).set(gp[0] ?? 0, gp[1] ?? 0, gp[2] ?? 0, gp[3] ?? 0);
    (u.gpB!.value as THREE.Vector4).set(gp[4] ?? 0, gp[5] ?? 0, gp[6] ?? 0, gp[7] ?? 0);

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
    // writing, the raised sleeve's shadow (far above the sheet, soft and off to the lower left) is left out: only the
    // glove's own shadow falls on the words; signing keeps the gate 2 shadow whole
    u.shCut!.value = t >= SIGN_T0 - 0.02 && t <= SIGN_T1 + 0.12 ? 1e4 : 155;
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
    const sh = 2.2 * land + 7 * lock + 4 * pulse(t, this.go, 0.07);
    return { shake: [sh * 0.8, -sh * 0.6] as [number, number], halation: 0.2 };
  }
}

