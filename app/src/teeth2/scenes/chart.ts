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
import { buildHers, buildHis, cell, profile, crownCentre, MK, MPPM, HEAD, HERS, SCRAP } from './chart-form';
import { Marks, drawHisMarks } from './chart-marks';
import { buildChunks, drawLyric, newLyricCanvas, LPPM, LYR, type Chunk } from './chart-lyric';
import { CHART_FRAG } from './chart-glsl';

const VFOV = 28;
const Z_A = 1.5;
const SIGN_T0 = 82.1, SIGN_T1 = 82.62;
const SIG = { size: 26 };
/** The camera's reframing: it lands across the kick (from TR0 before to TR1 after). */
const TR0 = 0.05, TR1 = 0.04;
/** The push-in on the signing, and the pull back (T.F. is >= 15% of the frame's width between 82.31 and 82.71). */
const PUSH0 = 82.2, PUSH1 = 82.31, PULL0 = 82.66, PULL1 = 82.8;
const SAFE_X = 0.1 + 0.014, SAFE_Y = 0.1778 + 0.014;
interface Box { x0: number; x1: number; y0: number; y1: number; mx: number; my: number }
type ShotKind = 'W' | 'M' | 'O' | 'T' | 'X';

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
  private fitCam = new THREE.PerspectiveCamera(VFOV, 16 / 9, 1, 6000);
  private signShot: Cam = { cx: 0, cy: -80, w: 110, roll: -0.02, tilt: 0.16, yaw: 0 };
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

    // his chart: a scrap of it (teeth 6-10, #8 ringed) tucked under her top-right edge, lying on the dark card
    const th = 0.07, sc = 0.78;
    const tx = 150, ty = -155;
    const co = Math.cos(th), si = Math.sin(th);
    this.poseB.set(tx - sc * (co * SCRAP.cx - si * SCRAP.cy), ty - sc * (si * SCRAP.cx + co * SCRAP.cy), th, sc);

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
    for (const t of ks) if (t - kk[kk.length - 1]! > 0.22) kk.push(t);
    this.kicks = kk;
    // the signature's shot: T.F. big, 'Then' (the next phrase's first word) kept in reach on the left
    {
      const wc = this.chunks.find((c) => c.words.some((w) => w.serif));
      if (wc) {
        const nx = this.chunks[this.chunks.indexOf(wc) + 1];
        const wf = wc.words.find((w) => w.serif)!;
        const wMax = SIG.size / 0.17;   // T.F. stays >= 15% of the frame's width
        let x0 = Math.min(...wc.words.map((w) => w.x));
        const x1 = Math.max(wf.x + wf.w, this.sig.x + SIG.size) + 8;
        // the next phrase's first word ('Then') is kept in reach as far as the width allows
        if (nx) x0 = Math.min(x0, Math.max(nx.words[0]!.x - 4, x1 - 0.9 * wMax));
        const y0 = HEAD.base - 0.78 * wf.em, y1 = HEAD.sigY + 2;
        const w = Math.min(wMax, Math.max((x1 - x0) / 0.9, ((y1 - y0) / 0.84) * (16 / 9)));
        this.signShot = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 + 1, w, roll: -0.02, tilt: 0.14, yaw: 0.01 };
      }
    }
    const KINDS: ShotKind[] = ['W', 'O', 'M', 'T', 'W', 'M', 'O', 'T'];
    let nO = 0;
    this.shots = kk.map((t, i) => {
      let kind: ShotKind;
      if (i === 0) kind = 'M'; else if (i === 1) kind = 'O'; else if (i === 2) kind = 'W';
      else if (Math.abs(t - 78.91) < 0.05 || Math.abs(t - 85.82) < 0.05) kind = 'X';
      else kind = KINDS[(i - 3) % KINDS.length]!;
      if (kind === 'O') nO++;
      const raw = this.rawShot(kind, i, t, nO);
      if (kind === 'X') return raw;
      const t0 = t + TR1, t1 = (kk[i + 1] ?? this.ctx.end) - TR0;
      const boxes: Box[] = [];
      for (const ch of this.chunks) {
        if (!(ch.t0 < t1 - 0.03 && ch.t1 > t0)) continue;
        let x0 = 1e9, x1 = -1e9, em = 0, serif = false;
        for (const w of ch.words) { x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x + w.w); em = Math.max(em, w.em); serif = serif || w.serif; }
        boxes.push({ x0, x1, y0: HEAD.base - 0.8 * em, y1: HEAD.base + (serif ? 0.3 * em : 0.06 * em), mx: SAFE_X, my: SAFE_Y });
      }
      // a corner of his chart (the scrap's top edge) stays in the frame
      boxes.push({ x0: 138, x1: 196, y0: -178, y1: -166, mx: 0.03, my: 0.03 });
      const res = this.fit(raw, boxes);
      return res;
    });
  }

  private rawShot(kind: ShotKind, i: number, kt: number, nO: number): Cam {
    const r = (k: number) => R(i, k) - 0.5;
    const hx = this.hand(kt + 0.1)?.x ?? 0;
    switch (kind) {
      case 'W': return { cx: r(1) * 30, cy: -40, w: 545, roll: r(3) * 0.05, tilt: 0.2, yaw: r(5) * 0.04 };
      case 'M': return { cx: clamp(0.35 * hx + r(1) * 50, -70, 70), cy: -70, w: 400 + r(2) * 40, roll: r(3) * 0.1, tilt: 0.24 + R(i, 4) * 0.1, yaw: r(5) * 0.06 };
      case 'O': return { cx: (nO % 2 ? 1 : -1) * (20 + R(i, 1) * 30), cy: -66, w: 430, roll: (nO % 2 ? -1 : 1) * (0.05 + R(i, 3) * 0.06), tilt: 0.72, yaw: (nO % 2 ? -1 : 1) * (0.2 + R(i, 5) * 0.08) };
      case 'T': return { cx: r(1) * 80, cy: -64, w: 390, roll: (R(i, 3) < 0.5 ? -1 : 1) * (0.1 + R(i, 2) * 0.07), tilt: 0.42, yaw: r(5) * 0.3 };
      default: {
        // a macro on one tooth (only in an instrumental gap, where the header is empty)
        const n = Math.abs(kt - 78.91) < 0.05 ? 12 : 8;
        const c = crownCentre(cell(n), profile(HERS, n).H);
        return { cx: c[0], cy: c[1], w: n === 12 ? 96 : 92, roll: n === 12 ? -0.08 : 0.07, tilt: 0.36, yaw: n === 12 ? 0.14 : -0.12 };
      }
    }
  }

  // ------------------------------------------------------------------ the camera
  private setCam(c: THREE.PerspectiveCamera, s: Cam, wMul = 1) {
    const w = s.w * wMul;
    const hf = Math.atan(Math.tan((VFOV * Math.PI) / 360) * (16 / 9));
    const D = w / 2 / Math.tan(hf);
    const tgt = new THREE.Vector3(s.cx, -s.cy, Z_A);
    const dir = new THREE.Vector3(Math.sin(s.yaw), -Math.sin(s.tilt), Math.cos(s.tilt)).normalize();
    c.position.copy(tgt).addScaledVector(dir, D);
    c.up.set(Math.sin(s.roll), Math.cos(s.roll), 0);
    c.lookAt(tgt);
    c.fov = VFOV; c.aspect = 16 / 9;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }
  private viol(s: Cam, boxes: Box[]) {
    this.setCam(this.fitCam, s);
    const v = { l: 0, r: 0, t: 0, b: 0 }, p = new THREE.Vector3();
    for (const bx of boxes) {
      for (const [x, y] of [[bx.x0, bx.y0], [bx.x1, bx.y0], [bx.x0, bx.y1], [bx.x1, bx.y1]] as [number, number][]) {
        p.set(x, -y, Z_A).project(this.fitCam);
        v.l = Math.max(v.l, -(1 - bx.mx) - p.x); v.r = Math.max(v.r, p.x - (1 - bx.mx));
        v.t = Math.max(v.t, p.y - (1 - bx.my)); v.b = Math.max(v.b, -(1 - bx.my) - p.y);
      }
    }
    return v;
  }
  /** Nudge and widen a shot until every box (sheet mm) sits inside its margins in the frame. */
  private fit(s0: Cam, boxes: Box[]): Cam {
    const s = { ...s0 };
    for (let it = 0; it < 160; it++) {
      const v = this.viol(s, boxes);
      if (v.l + v.r + v.t + v.b < 1e-4) break;
      const hh = (s.w * 9) / 32, cosT = Math.max(Math.cos(s.tilt), 0.45);
      let grow = 1;
      if (v.l > 0 && v.r > 0) grow = Math.max(grow, 1 + 0.5 * (v.l + v.r) + 0.004); else s.cx += (v.r - v.l) * (s.w / 2) * 0.8;
      if (v.t > 0 && v.b > 0) grow = Math.max(grow, 1 + 0.3 * (v.t + v.b) + 0.004); else s.cy += ((v.b - v.t) * hh * 0.8) / cosT;
      if (it > 50) grow *= 1.01;
      s.w *= grow;
    }
    return s;
  }
  private base(t: number): Cam {
    let i = 0;
    while (i + 1 < this.kicks.length && t >= this.kicks[i + 1]! - TR0) i++;
    const cur = this.shots[i]!, prev = this.shots[Math.max(0, i - 1)]!;
    const k = i === 0 ? 1 : ease.outCubic(clamp((t - (this.kicks[i]! - TR0)) / (TR0 + TR1)));
    const m = (a: number, b: number) => lerp(a, b, k);
    return { cx: m(prev.cx, cur.cx), cy: m(prev.cy, cur.cy), w: m(prev.w, cur.w), roll: m(prev.roll, cur.roll), tilt: m(prev.tilt, cur.tilt), yaw: m(prev.yaw, cur.yaw) };
  }
  private framing(t: number): Cam {
    const b = this.base(t);
    const k = ease.inOutCubic(clamp((t - PUSH0) / (PUSH1 - PUSH0))) * (1 - ease.inCubic(clamp((t - PULL0) / (PULL1 - PULL0))));
    if (k <= 0) return b;
    const S = this.signShot, m = (a: number, c: number) => lerp(a, c, k);
    return { cx: m(b.cx, S.cx), cy: m(b.cy, S.cy), w: m(b.w, S.w), roll: m(b.roll, S.roll), tilt: m(b.tilt, S.tilt), yaw: m(b.yaw, S.yaw) };
  }
  private placeCamera(t: number) {
    const kick = this.kicks.reduce((m, k) => Math.max(m, pulse(t, k, 0.05)), 0);
    this.setCam(this.cam, this.framing(t), 1 - 0.012 * kick);
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
    const sh = 2.6 * kick;
    return { shake: [sh * 0.8, -sh * 0.6] as [number, number], halation: 0.02, vignette: 0.2 };
  }
}
