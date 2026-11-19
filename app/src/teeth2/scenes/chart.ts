// Plate 7 `chart` (76.35 - 90.16), verse 2. Light plate: her dental chart (A3, an odontogram of 32 numbered teeth) taped
// to a light table, filled in with a fine pen by the gloved hand; the camera jolts to a new reframing on every kick
// (the drums come in at 78.91). The lyric is typed into the chart's header field (hero big; *wife* in wax Cormorant,
// the hand signs T.F. under it); the pen never writes the lyric and the paper never scrolls (that is the polygraph).
//   76.35  "the best thing in my life": the pen fills the upper row, one mark per sung word, then the lower row on
//          every snare from 78.91 (fillings and crowns, neat hairlines)
//   81.96  "I see my wife": *wife* typed in the header, the gloved hand signs T.F. under it (the monogram)
//   82.71  "you turn into somebody I don't know": on every beat the chart's markings move: fillings hop from tooth to
//          tooth, crowns swap, until it describes someone else (7, 8, 9 marked, as on the corner of his chart beneath)
//   86.71  "push me away, push me away, yeah": the chart empties, one quadrant per push / away: the marks lift off
//          the paper and are gone; the blank diagram is left, his corner still mostly hidden
// Files: chart-form.ts (the printed forms), chart-marks.ts (the pen's marks and their script), chart-lyric.ts (the
// header's type), chart-glsl.ts (the frame; the glove is taken from match-glsl.ts).
import * as THREE from 'three';
import { Scene, type Frame } from '../../engine/scene';
import { FSPass, SS_TAP } from '../../engine/gl';
import { clamp, lerp, ease, pulse } from '../../engine/util';
import { HIS } from '../teeth';
import { drawMonogram, monoWritten, monoPenAt, MONO_H } from '../monogram';
import { buildHers, buildHis, cell, profile, tp, MK, MPPM, HEAD, HERS } from './chart-form';
import { Marks, drawHisMarks } from './chart-marks';
import { buildChunks, drawLyric, newLyricCanvas, LPPM, LYR, type Chunk } from './chart-lyric';
import { CHART_FRAG } from './chart-glsl';

const VFOV = 28;
const Z_A = 1.5;
const SIGN_T0 = 82.1, SIGN_T1 = 82.62;
const SIG = { size: 18 };

interface Cam { cx: number; cy: number; w: number; roll: number; tilt: number; yaw: number }
const fr = (x: number) => x - Math.floor(x);
const R = (i: number, k: number) => fr(Math.sin(i * 12.9898 + k * 78.233 + 4.1) * 43758.5453);

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

interface Hand { x: number; y: number; z: number; head: number; tilt: number }

export default class Chart extends Scene {
  private pass!: FSPass;
  private marks!: Marks;
  private chunks: Chunk[] = [];
  private cam = new THREE.PerspectiveCamera(VFOV, 16 / 9, 1, 6000);
  private mkCv!: HTMLCanvasElement; private mkTex!: THREE.CanvasTexture;
  private lyCv!: HTMLCanvasElement; private lyTex!: THREE.CanvasTexture;
  private kicks: number[] = [];
  private shots: Cam[] = [];
  private poseB = new THREE.Vector4();
  private sig = { x: -20, y: HEAD.sigY - 0.5 - MONO_H * SIG.size };
  private lastStrokeEnd = 0;

  override init() {
    const au = this.ctx.audio, ly = this.ctx.lyrics;
    const T0 = this.ctx.start;
    const line = (i: number) => ly.lines.filter((l) => l.start >= T0 - 0.05 && l.start < this.ctx.end)[i]!;
    const wsA = line(0).words.map((w) => w.start);
    const beatsAll = au.beats;
    const dr = au.onsets.snare ?? [];
    void dr;
    const beatsB = beatsAll.filter((b) => b >= 78.9 && b < 81.7).slice(0, 7);
    const beatsC = beatsAll.filter((b) => b >= 82.75 && b < 86.4).slice(0, 9);
    const l3 = line(3).words;
    const quad = [l3[2]!.start, l3[4]!.start, l3[5]!.start, l3[7]!.start];
    this.marks = new Marks(HERS, wsA, beatsB, beatsC, quad);
    const last = this.marks.strokes[this.marks.strokes.length - 1]!;
    this.lastStrokeEnd = last.t0 + last.dur;
    this.chunks = buildChunks(ly, beatsAll, T0, this.ctx.end);
    const wife = this.chunks.flatMap((c) => c.words).find((w) => w.serif);
    if (wife) this.sig.x = wife.x + 0.5;

    // canvases and textures
    this.mkCv = document.createElement('canvas');
    this.mkCv.width = Math.round((MK.x1 - MK.x0) * MPPM); this.mkCv.height = Math.round((MK.y1 - MK.y0) * MPPM);
    this.mkTex = dataTex(this.mkCv);
    this.lyCv = newLyricCanvas();
    this.lyTex = dataTex(this.lyCv);
    const sheetA = dataTex(buildHers());
    const sheetB = dataTex(buildHis((c) => drawHisMarks(c, HIS)));

    // his chart: under hers, rotated a little; #8's crown sits just beyond her top edge
    const th = 0.1, sc = 0.78;
    const c8 = cell(8), p8 = profile(HIS, 8);
    const q = tp(c8, 0, p8.H * 0.5);
    const tx = 88, ty = -166;
    const co = Math.cos(th), si = Math.sin(th);
    this.poseB.set(tx - sc * (co * q[0] - si * q[1]), ty - sc * (si * q[0] + co * q[1]), th, sc);

    this.pass = new FSPass(CHART_FRAG, {
      invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, res: { value: new THREE.Vector2() },
      sheetA: { value: sheetA }, sheetB: { value: sheetB }, marksTex: { value: this.mkTex }, lyrTex: { value: this.lyTex },
      poseA: { value: new THREE.Vector4(0, 0, 0.008, 1) }, poseB: { value: this.poseB },
      keyPos: { value: new THREE.Vector3(-260, 360, 1100) },
      hTip: { value: new THREE.Vector3() }, hE1: { value: new THREE.Vector3() }, hE2: { value: new THREE.Vector3() }, hE3: { value: new THREE.Vector3() },
      handOn: { value: 0 }, panelK: { value: 1 }, ssTap: SS_TAP,
    });

    // the kicks: the frame jolts to a new reframing on each one (from the first drum fill on, one per kick)
    const ks = (au.onsets.kick ?? []).map((k) => k[0]).filter((t) => t >= 78.8 && t < this.ctx.end - 0.2);
    const kk: number[] = [T0, 77.21, 78.08];
    for (const t of ks) if (t - kk[kk.length - 1]! > 0.3) kk.push(t);
    this.kicks = kk;
    this.shots = kk.map((t, i) => this.makeShot(t, i));
  }

  // ------------------------------------------------------------------ the camera
  private makeShot(kt: number, i: number): Cam {
    const base = { roll: 0, tilt: 0.2, yaw: 0 };
    let s: Cam;
    if (kt < 78.5) {
      const L: Cam[] = [
        { cx: -60, cy: -58, w: 410, roll: 0.02, tilt: 0.22, yaw: 0.02 },
        { cx: 5, cy: -72, w: 330, roll: -0.035, tilt: 0.18, yaw: -0.02 },
        { cx: 70, cy: -56, w: 350, roll: 0.04, tilt: 0.25, yaw: 0.03 },
      ];
      s = L[i]!;
    } else if (kt < 81.9) {
      const hx = this.hand(kt + 0.12)?.x ?? 0;
      const W = [340, 390, 330, 410, 360, 380][i % 6]!;
      s = { cx: clamp(0.55 * hx + (R(i, 1) - 0.5) * 60, -95, 95), cy: -50 + (R(i, 2) - 0.5) * 16, w: W, roll: (R(i, 3) - 0.5) * 0.11, tilt: 0.2 + R(i, 4) * 0.2, yaw: (R(i, 5) - 0.5) * 0.06 };
    } else if (kt < 82.75) {
      s = kt < 82.2 ? { cx: -8, cy: -84, w: 262, roll: -0.025, tilt: 0.16, yaw: 0.015 } : { cx: 0, cy: -88, w: 214, roll: 0.03, tilt: 0.14, yaw: -0.015 };
    } else if (kt < 86.5) {
      const W = [440, 350, 465, 370, 450, 340, 460, 390, 420][i % 9]!;
      s = { cx: (R(i, 1) - 0.5) * 70, cy: -38 + (R(i, 2) - 0.5) * 14, w: W, roll: (R(i, 3) - 0.5) * 0.1, tilt: 0.2 + R(i, 4) * 0.26, yaw: (R(i, 5) - 0.5) * 0.07 };
    } else {
      const D: Partial<Cam>[] = [
        { cx: -95, cy: -48, w: 350, roll: 0.03 }, { cx: -118, cy: -52, w: 305, roll: -0.04 }, { cx: 100, cy: -48, w: 340, roll: -0.035 },
        { cx: -100, cy: -46, w: 345, roll: 0.045 }, { cx: -58, cy: -54, w: 300, roll: -0.05 }, { cx: 104, cy: -46, w: 350, roll: 0.035 },
        { cx: 24, cy: -40, w: 450, roll: -0.02 }, { cx: 52, cy: -48, w: 410, roll: 0.025, tilt: 0.26 },
      ];
      const j = this.kicks.filter((k) => k >= 86.5).length;
      s = { ...base, cx: 0, cy: -44, w: 360, ...D[Math.min(j, D.length - 1)]! };
    }
    // the header (the hero) stays inside title-safe at the top
    const h = (s.w * 9) / 16;
    const cmax = -126 + 0.411 * h;
    s.cy = Math.min(s.cy, cmax);
    // the lower row's tooth numbers (y 55..59) never sit on the frame's bottom edge: cut clear below, or inside title-safe
    const bottom = s.cy + h / 2;
    if (bottom > 50 && bottom < 62.5 + 0.089 * h) {
      const cB = 62.5 - 0.411 * h;
      s.cy = cB <= cmax ? cB : Math.min(s.cy, 50 - h / 2);
    }
    return s;
  }
  private framing(t: number): Cam {
    let i = 0;
    while (i + 1 < this.kicks.length && t >= this.kicks[i + 1]!) i++;
    const cur = this.shots[i]!, prev = this.shots[Math.max(0, i - 1)]!;
    const k = i === 0 ? 1 : ease.outCubic(clamp((t - this.kicks[i]!) / 0.11));
    const m = (a: number, b: number) => lerp(a, b, k);
    return { cx: m(prev.cx, cur.cx), cy: m(prev.cy, cur.cy), w: m(prev.w, cur.w), roll: m(prev.roll, cur.roll), tilt: m(prev.tilt, cur.tilt), yaw: m(prev.yaw, cur.yaw) };
  }
  private placeCamera(t: number) {
    const s = this.framing(t);
    const kick = this.kicks.reduce((m, k) => Math.max(m, pulse(t, k, 0.05)), 0);
    const w = s.w * (1 - 0.012 * kick);
    const hf = Math.atan(Math.tan((VFOV * Math.PI) / 360) * (16 / 9));
    const D = w / 2 / Math.tan(hf);
    const tgt = new THREE.Vector3(s.cx, -s.cy, Z_A);
    const dir = new THREE.Vector3(Math.sin(s.yaw), -Math.sin(s.tilt), Math.cos(s.tilt)).normalize();
    this.cam.position.copy(tgt).addScaledVector(dir, D);
    this.cam.up.set(Math.sin(s.roll), Math.cos(s.roll), 0);
    this.cam.lookAt(tgt);
    this.cam.fov = VFOV; this.cam.aspect = 16 / 9;
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
  }

  // ------------------------------------------------------------------ the gloved hand
  private headAt(y: number) { return 0.5 + 0.55 * clamp((-50 - y) / 25); }
  /** The pen (sheet mm, z above the sheet); null when the hand is out of the frame. */
  private hand(t: number): Hand | null {
    const M = this.marks, S = M.strokes;
    const sigP0 = monoPenAt(SIGN_T0, SIGN_T0, SIGN_T1);
    const sx = this.sig.x + sigP0.x * SIG.size, sy = this.sig.y + sigP0.y * SIG.size;
    const mk = (x: number, y: number, z: number): Hand => ({ x, y, z, head: this.headAt(y), tilt: 0.78 });
    if (t < S[0]!.t0) { const q = M.tipAt(S[0]!.id, 0.0); return mk(q[0], q[1], 5 + 18 * (S[0]!.t0 - t)); }
    // strokes
    for (let i = 0; i < S.length; i++) {
      const st = S[i]!;
      if (t >= st.t0 && t <= st.t0 + st.dur) { const q = M.tipAt(st.id, clamp((t - st.t0) / st.dur)); return mk(q[0], q[1], 0); }
      const nx = S[i + 1];
      const end = st.t0 + st.dur;
      if (nx && t > end && t < nx.t0) {
        const a = M.tipAt(st.id, 1), b = M.tipAt(nx.id, 0.0);
        const k = ease.inOutCubic(clamp((t - end) / (nx.t0 - end)));
        return mk(lerp(a[0], b[0], k), lerp(a[1], b[1], k), 7 * Math.sin(Math.PI * k));
      }
    }
    // to the signature line, the signing, and out
    const end = this.lastStrokeEnd;
    if (t > end && t < SIGN_T0) {
      const a = M.tipAt(S[S.length - 1]!.id, 1);
      const k = ease.inOutCubic(clamp((t - end) / (SIGN_T0 - end)));
      return mk(lerp(a[0], sx, k), lerp(a[1], sy, k), 22 * Math.sin(Math.PI * k) * (1 - 0.5 * k));
    }
    if (t >= SIGN_T0 && t <= SIGN_T1 + 0.03) {
      const p = monoPenAt(t, SIGN_T0, SIGN_T1);
      return mk(this.sig.x + p.x * SIG.size, this.sig.y + p.y * SIG.size, p.down ? 0 : 4);
    }
    if (t > SIGN_T1 + 0.03) {
      const e = monoPenAt(SIGN_T1, SIGN_T0, SIGN_T1);
      const ex = this.sig.x + e.x * SIG.size, ey = this.sig.y + e.y * SIG.size;
      const k = clamp((t - SIGN_T1 - 0.08) / 0.5);
      if (k >= 1) return null;
      const hd = this.headAt(ey);
      const away = 300 * ease.inQuad(k);
      return { x: ex + Math.cos(hd) * away, y: ey + Math.sin(hd) * away, z: 4 + 50 * k, head: hd, tilt: 0.78 };
    }
    return null;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t, u = this.pass.u;
    this.placeCamera(t);
    (u.invVP!.value as THREE.Matrix4).multiplyMatrices(this.cam.matrixWorld, this.cam.projectionMatrixInverse);
    (u.camPos!.value as THREE.Vector3).copy(this.cam.position);
    (u.res!.value as THREE.Vector2).set(out.width, out.height);

    // the pen's marks
    {
      const c = this.mkCv.getContext('2d')!;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#000'; c.fillRect(0, 0, this.mkCv.width, this.mkCv.height);
      c.setTransform(MPPM, 0, 0, MPPM, -MK.x0 * MPPM, -MK.y0 * MPPM);
      c.globalCompositeOperation = 'lighter';
      this.marks.draw(c, t);
      c.globalCompositeOperation = 'source-over';
      this.mkTex.needsUpdate = true;
    }
    // the header: the lyric, then the signature
    {
      drawLyric(this.lyCv, this.chunks, t);
      if (t >= SIGN_T0) {
        const c = this.lyCv.getContext('2d')!;
        c.setTransform(LPPM, 0, 0, LPPM, -LYR.x0 * LPPM, -LYR.y0 * LPPM);
        c.globalCompositeOperation = 'lighter';
        drawMonogram(c, monoWritten(t, SIGN_T0, SIGN_T1), { x: this.sig.x, y: this.sig.y, size: SIG.size, width: 0.55, color: 'rgb(255,0,0)', pressure: 0.6, skew: 0.0 });
        c.globalCompositeOperation = 'source-over';
      }
      this.lyTex.needsUpdate = true;
    }

    // the hand
    const h = this.hand(t);
    u.handOn!.value = h ? 1 : 0;
    if (h) {
      const dx = Math.cos(h.head), dy = Math.sin(h.head);
      const c = Math.cos(h.tilt), s = Math.sin(h.tilt);
      const e1 = new THREE.Vector3(dx * c, -dy * c, s);
      const e2 = new THREE.Vector3(-dy, -dx, 0);
      const e3 = new THREE.Vector3().crossVectors(e1, e2).normalize();
      if (e3.z < 0) e3.negate();
      (u.hTip!.value as THREE.Vector3).set(h.x, -h.y, Z_A + 0.05 + h.z);
      (u.hE1!.value as THREE.Vector3).copy(e1);
      (u.hE2!.value as THREE.Vector3).copy(e2);
      (u.hE3!.value as THREE.Vector3).copy(e3);
    }
    this.pass.render(renderer, out);

    // post: a jolt on every kick
    const kick = this.kicks.reduce((m, k) => Math.max(m, pulse(t, k, 0.045)), 0);
    const sh = 3.4 * kick;
    return { shake: [sh * 0.8, -sh * 0.6] as [number, number], halation: 0.02, vignette: 0.2 };
  }
}
