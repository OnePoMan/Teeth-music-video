// Plate 6 `uv` — chorus 1, second half (62.54 – 76.35), docs/teeth2/PLATES.md. A different exhibit: the pillowcase
// from the bed (EXHIBIT 5, on its tag), laid out on a black bench in the dark. A gloved hand holds a short UV lamp low
// over the case and sweeps it on the beat; its beam is a soft pool and the cloth outside it is near black. Where the
// pool lands, dried saliva traces fluoresce fluor-white, and they sink back to their dried floor ~0.5 s after it has
// passed (uv-glsl.ts, the excitation memory M), never to black (R23). Never from above (plate 3 owns fabric from above).
//
// ROUND 1, THE LYRIC-LED PASS (docs/gate3/brief-uv-r1.md and its lead's decisions; the uv type card):
//  * each line is a two-row block on its own part of the case (uv-type.ts), every sung word of the current line on
//    a readable floor, lifted to full glow by the beam as it lands on the word's onset;
//  * ONE continuous camera move per line (kinetic.ts LyricPath, one key per word: the line so far framed whole in
//    title-safe, leaning toward the newest word, riding right and down only), each line its own framing family
//    (PLANS); cuts only between lines, on the downbeat nearest each line's first stressed word (R39, R77);
//  * one type-led macro per half-line onto its hero (MACROS, as scale r5): it opens on the hero's onset, already
//    readable, with the line so far in frame, pushes in <= 8% over >= 0.4 s, and leaves by an eased pull-back into the
//    line's move or by the line's cut;
//  * graded impacts (HITS): tier 1 the lamp (it drops closer, the pool tightens, the glow peaks) on the openers and
//    the three sweeps hardest, the heroes lighter, building over line 2 into TEETH; tier 2 the other downbeats; tier 3
//    the backbeats;
//  * TEETH (68.47): a full-frame slam, fluor-white Archivo 900 on film-black; on the 8th (68.80) a condensed copy is
//    stamped over it and the beam's sweep crosses the frame as the break line (a straight wipe edge) taking the first
//    copy away; held to LATE (69.44), then cut back to the cloth straight onto LATE, already readable;
//  * "put your hands on me": one swab stroke per word (HANDS the heaviest), each lifting the glow onto the cotton down to
//    the floor; "never, never, never ever": three sweeps, faster each time; "let go": the beam holds still on GO and its
//    glow decays (~25% at the 76.35 cut, R57: the one word that fades);
//  * every word reports to the type probe (kinRecord3D on the cloth plane, the camera as cut, macros included).
// Look-dev logs (render.ts prints console warnings): ?uv_log=1 (travel per line, macros, sizes), ?uv_occ=1 (the
// occlusion scan: lamp, gloves and swab against every sung word, JS stand-in capsules), ?uv_box=1 (word boxes).
//
// Files: uv-type.ts (the lyric's layout on the cloth, the trace textures, the tag), uv-glsl.ts (the frame).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, SS_TAP, W as FW, H as FH } from '../../engine/gl';
import { clamp, ease, lerp, noise1, pulse, smootherstep, springStep } from '../../engine/util';
import { T_LIN, trgba } from '../palette';
import { KinClock, KinWord, LyricPath, drawKin, halfPlane, kinCam, kinProbeOn, kinRecord3D, kinShake, type KinPose } from '../kinetic';
import { bakeTag, bakeTraces, type TWord } from './uv-type';
import { UV_FRAG, NW, NM } from './uv-glsl';

const DEG = Math.PI / 180;
const ASP = 16 / 9;
/** The cloth's mean height under the words (mm). */
const ZC = 3;
type V2 = [number, number];
type V3 = THREE.Vector3;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const QP = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;

/**
 * Each line's framing family and its one move: azimuth (deg, 0 = from the near side, + = from the right), elevation
 * (deg; never from above: <= 54), roll (deg), each from the line's cut to its end; the lens (vertical fov, deg). The
 * lamp, in frame widths from the beam's aim point: to the camera's right, away, up; which way its handle points;
 * the pool's radius (frame widths). open: the first framing's distance over the whole line's (the line opens close on
 * its first word: >= 8% cap).
 */
interface Plan { az: V2; el: V2; roll: V2; fov: number; ls: number; lb: number; lu: number; hand: number; pr: number; open: number; lm?: number }
const PLANS: Plan[] = [
  // line 1: a raking track at the lowest height the line's size allows, the beam toward the lens (the lamp beyond the
  // words), tracking right with the words
  { az: [-16, -4], el: [50, 54], roll: [-1.5, -0.5], fov: 30, ls: 0.1, lb: 0.1, lu: 0.15, hand: 1, pr: 0.2, open: 0.58 },
  // line 2: a three-quarter crane down from the right, the lamp and its glove in frame
  { az: [28, 18], el: [54, 47], roll: [2, 1], fov: 30, ls: 0.16, lb: 0.0, lu: 0.07, hand: -1, pr: 0.2, open: 0.58, lm: 14 },
  // line 3: a slow orbit round the swab, left to right
  { az: [-26, 10], el: [52, 49], roll: [-1.5, 1.5], fov: 30, ls: -0.1, lb: 0.1, lu: 0.15, hand: -1, pr: 0.2, open: 0.58 },
  // line 4: a lower profile across the cloth for the three sweeps, then GO
  { az: [-36, -24], el: [48, 50], roll: [-2, -1], fov: 32, ls: 0.1, lb: 0.1, lu: 0.2, hand: 1, pr: 0.19, open: 0.58, lm: 40 },
];
/** How far the framing leans from the line so far's centre toward the newest word (R81: the sweet spot). */
const RIDE = 0.35;
/** Title-safe in NDC is 0.9 x 0.822; the line's framing keeps this margin inside (stamps, shake), a macro a little less. */
const BOX = { x: 0.86, y: 0.76 }, BOX_M = { x: 0.88, y: 0.79 };
/** HERO MACROS (R36, as scale r5): [line, hero word index in the line's words (lyric k), exit word k (-1: the line's
 *  cut), eased exit]. One per half-line: DIRTY | SWEET, PRETTY | (TEETH slams), DEVIL | HANDS, NEVER | GO. DIRTY,
 *  PRETTY, DEVIL and NEVER leave by an eased pull-back starting before the next half-line's first word (a cut there
 *  would be a second reframe in that half-line); SWEET, HANDS and GO hold to the cut. */
const MACROS: [number, number, number, boolean][] = [[0, 2, 3, true], [0, 7, -1, false], [1, 2, 3, true], [2, 2, 3, true], [2, 5, -1, false], [3, 1, 2, true], [3, 6, -1, false]];
const MACRO_PUSH = 1.08, MACRO_EASE = 0.6, MACRO_LEAD = 0.3;
/** The size a macro aims its hero at (cap, fraction of the frame height), and the floor every supporting word keeps. */
const MACRO_CAP = 0.25, SUP_MIN = 0.053;
/** The readable floor (R23): the dried stain's level outside the beam (a fraction of the glow's), measured >= 40 luma
 *  steps over the cloth round it. Look-dev override: uv_floor=r. */
const FLOOR = 0.05;
/** How far beyond the block's far edge the lamp's ground point stays at least (mm). */
const LAMP_MARGIN = 32;

interface Cam { tx: number; ty: number; D: number; az: number; el: number; roll: number; fov: number; mac: number }
interface Basis { pos: V3; tgt: V3; fw: V3; rt: V3; up: V3; tanH: number }
function basis(c: Cam): Basis {
  const az = c.az * DEG, el = c.el * DEG;
  const dir = V(Math.cos(el) * Math.sin(az), -Math.cos(el) * Math.cos(az), Math.sin(el));
  const tgt = V(c.tx, c.ty, ZC);
  const pos = tgt.clone().addScaledVector(dir, c.D);
  const fw = dir.clone().negate();
  const rt0 = new THREE.Vector3().crossVectors(fw, V(0, 0, 1)).normalize();
  const up0 = new THREE.Vector3().crossVectors(rt0, fw);
  const r = c.roll * DEG;
  const rt = rt0.clone().multiplyScalar(Math.cos(r)).addScaledVector(up0, -Math.sin(r));
  const up = up0.clone().multiplyScalar(Math.cos(r)).addScaledVector(rt0, Math.sin(r));
  return { pos, tgt, fw, rt, up, tanH: Math.tan((c.fov * DEG) / 2) };
}
/** The roll (deg) that levels the cloth's x axis (the rows' baselines) at the frame's centre from (az, el): the
 *  three-quarter and orbiting framings read their rows near level instead of running downhill (LEVEL of it). */
const LEVEL = 0.8;
const levelRoll = (az: number, el: number) => LEVEL * (-Math.atan2(-Math.sin(az * DEG) * Math.sin(el * DEG), Math.cos(az * DEG)) / DEG);
/** World point -> NDC x, y (y up) and depth. */
function proj(B: Basis, p: V3): [number, number, number] {
  const q = p.clone().sub(B.pos), z = q.dot(B.fw);
  return [q.dot(B.rt) / (z * B.tanH * ASP), q.dot(B.up) / (z * B.tanH), z];
}
const blendCam = (a: Cam, b: Cam, w: number): Cam => ({
  tx: lerp(a.tx, b.tx, w), ty: lerp(a.ty, b.ty, w), D: Math.exp(lerp(Math.log(a.D), Math.log(b.D), w)), az: lerp(a.az, b.az, w),
  el: lerp(a.el, b.el, w), roll: lerp(a.roll, b.roll, w), fov: lerp(a.fov, b.fov, w), mac: w < 0.5 ? a.mac : b.mac,
});

interface Line { k: number; t0: number; t1: number; words: TWord[]; plan: Plan; path: LyricPath; box: [number, number, number, number] }
interface Macro { line: number; hero: TWord; t0: number; t1: number; te: number; ease: boolean; cam: Cam; push: number; cap: number; span: number; sup: number; ratio: number }
interface Hit { t: number; k: number; tier: 1 | 2 }
interface Key { t: number; d: number; v: number[] }
/** Piecewise moves: from each key's value to the next, eased (smootherstep), arriving at the key's time. */
function track(keys: Key[], t: number): number[] {
  const v = keys[0]!.v.slice();
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!, p = keys[i - 1]!;
    const u = smootherstep(0, 1, (t - (k.t - k.d)) / k.d);
    if (u <= 0) break;
    for (let j = 0; j < v.length; j++) v[j]! += (k.v[j]! - p.v[j]!) * u;
  }
  return v;
}
const corners = (ws: TWord[]) => ws.flatMap((w) => {
  const x0 = w.x0, x1 = w.x0 + w.w, y0 = w.y - w.h / 2, y1 = w.y + w.h / 2;
  // (heroes: room for the stamp and the stretch to the right)
  const g = w.hero || w.st === 'mid' ? 0.08 * w.w : 0;
  return [V(x0, y0, ZC), V(x1 + g, y0, ZC), V(x1 + g, y1, ZC), V(x0, y1, ZC)];
});

/** Stand-in shapes for the occlusion scan: capsules [a, b, radius] in the lamp's frame (x along the tube toward the
 *  handle, y across, z out of the window) and the swab's (x up the shaft from the tip): uv-glsl.ts's SDFs, rounded up. */
const LAMP_CAPS: [number[], number[], number][] = [
  [[-50, 0, -15], [50, 0, -15], 26], [[58, 0, -15], [178, 0, -15], 15], [[88, 14, -15], [150, 14, -15], 30],
  [[158, 30, -22], [262, 52, -86], 26], [[210, 41, -55], [360, 70, -150], 33],
];
const SWAB_CAPS: [number[], number[], number][] = [
  [[0, 0, 0], [9, 0, 0], 3.2], [[8, 0, 0], [158, 0, 0], 1.4], [[90, -8, 4], [155, -32, 2], 16], [[145, -20, 4], [220, -16, 4], 30],
  [[256, -14, 6], [400, -4, 14], 33],
];

export default class UvPlate extends Scene {
  private pass!: FSPass;
  private words: TWord[] = [];
  private lines: Line[] = [];
  private macros: Macro[] = [];
  private hits: Hit[] = [];
  private backs: number[] = [];
  private beamKeys: Key[] = [];
  private clk!: KinClock;
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 5, 8000);
  private tTeeth = 0; private tSlam2 = 0; private tOn = 0;
  private swab = { t0: 0, t1: 0, s: [] as number[], sd: [] as number[], A: [] as V2[], B: [] as V2[], wt: [] as number[] };
  private kws = new Map<TWord, KinWord>();
  private L = new Layer2D();
  private slamA!: KinWord; private slamB!: KinWord;
  private logged = false; private occLogged = false;

  override init() {
    const { lyrics, audio } = this.ctx;
    const src = lyrics.lines.filter((l) => l.start >= this.ctx.start - 0.05 && l.start < this.ctx.end - 0.2);
    this.clk = new KinClock(audio, { backbeat: true });
    const baked = bakeTraces(src);
    this.words = baked.words;
    this.tOn = this.ctx.start;
    const byText = (s: string) => this.words.filter((w) => w.text.toUpperCase() === s);
    const hands = byText('HANDS')[0]!;
    const teeth = src[1]!.words[src[1]!.words.length - 1]!;
    this.tTeeth = teeth.start;
    this.tSlam2 = this.clk.beatTime(Math.floor(this.clk.beat(teeth.start) + 1e-4) + 1) + 0.5 * (this.clk.beatTime(Math.floor(this.clk.beat(teeth.start) + 1e-4) + 2) - this.clk.beatTime(Math.floor(this.clk.beat(teeth.start) + 1e-4) + 1));

    // the lines: each cut on the downbeat nearest the start of its first word within 0.12 s of a downbeat (R77), else
    // on the downbeat nearest its first word; line 2 ends on the TEETH slam
    const downs = audio.downbeats;
    const near = (t: number) => downs.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), Infinity);
    const cuts = src.map((l, k) => {
      if (k === 0) return this.ctx.start;
      const w = l.words.find((x) => Math.abs(near(x.start) - x.start) < 0.12);
      return w ? near(w.start) : near(l.words[0]!.start);
    });
    for (let k = 0; k < src.length; k++) {
      const t1 = k === 1 ? this.tTeeth : (cuts[k + 1] ?? this.ctx.end);
      const ws = baked.blocks[k]!.words.slice().sort((a, b) => a.start - b.start);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const w of ws) { x0 = Math.min(x0, w.x0); x1 = Math.max(x1, w.x0 + w.w); y0 = Math.min(y0, w.y - w.h / 2); y1 = Math.max(y1, w.y + w.h / 2); }
      this.lines.push({ k, t0: cuts[k]!, t1, words: ws, plan: PLANS[k]!, path: null as unknown as LyricPath, box: [x0, y0, x1, y1] });
    }
    for (const L of this.lines) this.buildPath(L);
    this.macros = MACROS.map(([k, hi, xi, ez]) => this.solveMacro(this.lines[k]!, hi, xi, ez)).filter((m): m is Macro => !!m);

    // the probe's words (cells in cloth mm)
    for (const w of this.words) this.kws.set(w, KinWord.fromCells(w.text, w.size, w.cells, { family: w.serif ? 'serif' : 'archivo', width: w.st === 'sup' ? 100 : 62 }));

    // the beam: word to word, landing on each onset (a jump on each cut); held still over "put your HANDS" while the
    // swab works; three sweeps across the NEVERs, faster each time; held still on GO
    const sweep = [0.5, 0.34, 0.2];
    for (const L of this.lines) {
      const sung = L.words.filter((w) => w.start >= L.t0 - 0.05);
      const standing = L.words.filter((w) => w.start < L.t0 - 0.05);
      const first = sung[0] ?? standing[standing.length - 1]!;
      const swabbed = L.k === 2 ? L.words.filter((w) => w.line === 2 && w.k >= 3) : [];
      const holdP: V2 = swabbed.length ? [(hands.x0 - 40 + hands.x0 + hands.w) / 2, hands.y - 4] : [0, 0];
      let prevT = L.t0;
      const seq = [first, ...sung.filter((w) => w !== first)];
      seq.forEach((w, i) => {
        const t = i === 0 ? L.t0 + 0.001 : w.start + 0.02;
        const d = i === 0 ? 0.001 : Math.min(0.85 * (w.start - prevT), 0.4);
        if (w.rep) {
          const s = sweep[w.rep - 1]!;
          if (i === 0) this.beamKeys.push({ t, d, v: [w.x0 - 0.1 * w.w, w.y - 3] });
          else this.beamKeys.push({ t: w.start - 0.04, d: Math.min(0.12, 0.6 * (w.start - prevT)), v: [w.x0 - 0.1 * w.w, w.y - 3] });
          this.beamKeys.push({ t: Math.max(t, w.start - 0.04) + s, d: s, v: [w.x0 + 0.95 * w.w, w.y + 2] });
        } else if (swabbed.includes(w)) this.beamKeys.push({ t, d, v: holdP });
        else this.beamKeys.push({ t, d, v: [w.x, w.y] });
        prevT = Math.max(w.start, L.t0);
      });
    }
    this.beamKeys.sort((a, b) => a.t - b.t);

    // the hits (R37, R38, R79; the type card): tier 1, the lamp: hardest on the openers and the three sweeps, the
    // heroes lighter; line 2 builds into TEETH (its opener, PRETTY and the downbeat before TEETH each stronger); tier 2,
    // the other downbeats; tier 3, the backbeats (a nudge)
    const L4 = this.lines[3]!;
    const nev = L4.words.filter((w) => w.rep).sort((a, b) => a.rep - b.rep);
    const H1: [number, number][] = [
      [this.lines[0]!.t0, 1.0], [byText('DIRTY')[0]!.start, 0.45], [byText('SWEET')[0]!.start, 0.5],
      [this.lines[1]!.t0, 0.7], [byText('PRETTY')[0]!.start, 0.8], [downs.find((d) => d > byText('PRETTY')[0]!.start && d < this.tTeeth) ?? 0, 0.9],
      [this.lines[2]!.t0, 1.0], [byText('DEVIL')[0]!.start, 0.5], [hands.start, 0.55],
      [L4.t0, 1.0], [nev[1]!.start, 1.0], [nev[2]!.start, 1.0], [byText('GO')[0]!.start, 0.6],
    ];
    for (const [t, k] of H1) if (t > 0) this.hits.push({ t, k, tier: 1 });
    for (const d of downs) if (d >= this.ctx.start && d < this.ctx.end && !this.hits.some((h) => Math.abs(h.t - d) < 0.1) && !(d > this.tTeeth && d < this.lines[2]!.t0)) this.hits.push({ t: d, k: 1, tier: 2 });
    this.hits.sort((a, b) => a.t - b.t);
    this.backs = audio.beats.filter((b) => b >= this.ctx.start && b < this.ctx.end && !this.hits.some((h) => Math.abs(h.t - b) < 0.1));

    // the swab: one stroke per word of "put your hands on me", each across its own trace and drawn toward the camera,
    // HANDS the heaviest (a wider band, a longer stroke)
    const sw = this.lines[2]!.words.filter((w) => w.line === 2 && w.k >= 3).sort((a, b) => a.start - b.start);
    this.swab.s = sw.map((w) => w.start + 0.04);
    this.swab.sd = sw.map((w) => (w === hands ? 0.3 : 0.18));
    this.swab.wt = sw.map((w) => (w === hands ? 2 : 1));
    this.swab.A = sw.map((w) => [w.x - 0.04 * w.w + 0.16 * w.h, w.y + 0.62 * w.h + 3] as V2);
    this.swab.B = sw.map((w) => [w.x - 0.04 * w.w, w.y - 0.62 * w.h - 3] as V2);
    const andW = this.lines[2]!.words.find((w) => w.line === 3)!;
    this.swab.t0 = this.swab.s[0]! - 0.4;
    this.swab.t1 = Math.min(this.swab.s[4]! + this.swab.sd[4]! + 0.32, andW.start - 0.06);

    // the TEETH slam: the first copy (wide) fills title-safe; the second, condensed and tall
    const a0 = new KinWord('TEETH', { size: 400, width: 100, weight: 900 });
    this.slamA = new KinWord('TEETH', { size: (400 * (FW - 2 * 96) * 0.9) / a0.width, width: 100, weight: 900 });
    const b0 = new KinWord('TEETH', { size: 400, width: 62, weight: 900 });
    this.slamB = new KinWord('TEETH', { size: (400 * (FW - 2 * 96) * 0.78) / b0.width, width: 62, weight: 900 });

    const W = Array.from({ length: NW }, () => new THREE.Vector4());
    const W2 = Array.from({ length: NW }, () => new THREE.Vector4(0, 0, 1, 1));
    this.pass = new FSPass(UV_FRAG, {
      invVP: { value: new THREE.Matrix4() }, camPos: { value: V(0, 0, 0) }, res: { value: new THREE.Vector2() },
      covTex: { value: baked.cov }, idTex: { value: baked.id }, tagTex: { value: bakeTag() }, W: { value: W }, W2: { value: W2 }, WL: { value: new Array(NW).fill(0) },
      lC: { value: V(0, 0, 0) }, lX: { value: V(0, 0, 0) }, lY: { value: V(0, 0, 0) }, lZ: { value: V(0, 0, 0) }, lampK: { value: 1 },
      Q: { value: new THREE.Vector2() }, pAx: { value: new THREE.Vector2(1, 0) }, pR: { value: 80 },
      M: { value: Array.from({ length: NM }, () => new THREE.Vector4()) },
      sP: { value: V(0, 0, 0) }, sX: { value: V(0, 0, 0) }, sY: { value: V(0, 0, 0) }, sZ: { value: V(0, 0, 0) }, swabOn: { value: 0 }, swabGlow: { value: 0 },
      strokes: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, strokeK: { value: [0, 0, 0, 0, 0] }, strokeW: { value: sw.map((w) => (w === hands ? 12 : 7.5)) },
      pxAng: { value: 0 }, wordBounce: { value: V(0, 0, 0) }, gSide: { value: 1 }, ssTap: SS_TAP,
    });
    const st = this.pass.u.strokes!.value as THREE.Vector4[];
    for (let k = 0; k < 5; k++) st[k]!.set(this.swab.A[k]![0], this.swab.A[k]![1], this.swab.B[k]![0], this.swab.B[k]![1]);
  }

  // ================================================================================================ the camera
  /** The framing that holds `pts` whole inside the box at (az, el, roll, fov), leaning toward `lean` by `ride`: the
   *  target on the cloth and the distance. */
  private fit(pts: V3[], lean: V3, az: number, el: number, roll: number, fov: number, ride: number, box = BOX): Cam {
    const c: Cam = { tx: 0, ty: 0, D: 500, az, el, roll, fov, mac: -1 };
    for (const p of pts) { c.tx += p.x / pts.length; c.ty += p.y / pts.length; }
    const ok = (D: number) => {
      const B = basis({ ...c, D });
      for (const p of pts) { const [x, y, z] = proj(B, p); if (z < 20 || Math.abs(x) > box.x || Math.abs(y) > box.y) return false; }
      return true;
    };
    for (let pass = 0; pass < 4; pass++) {
      let lo = 30, hi = 8000;
      for (let it = 0; it < 26; it++) { const m = Math.sqrt(lo * hi); if (ok(m)) hi = m; else lo = m; }
      c.D = hi;
      if (pass === 3) break;
      const B = basis(c);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of pts) { const [x, y] = proj(B, p); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      // centre the line so far; on the last pass lean toward the newest word, but only into the slack the box leaves
      // (the lean never makes the framing wider)
      const [nx, ny] = proj(B, lean);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, kx = Math.max(0, box.x - (x1 - x0) / 2), ky = Math.max(0, box.y - (y1 - y0) / 2);
      const ox = pass === 2 ? cx + clamp(ride * (nx - cx), -kx, kx) : cx, oy = pass === 2 ? cy + clamp(ride * (ny - cy), -ky, ky) : cy;
      const a = az * DEG, wx = ox * c.D * B.tanH * ASP, wy = (oy * c.D * B.tanH) / Math.max(0.3, Math.sin(el * DEG));
      c.tx += wx * Math.cos(a) - wy * Math.sin(a);
      c.ty += wx * Math.sin(a) + wy * Math.cos(a);
    }
    return c;
  }
  /** The smallest distance at which pts fit at this target and angle. */
  private needD(c: Cam, pts: V3[], box = BOX) {
    let lo = 30, hi = 8000;
    for (let it = 0; it < 26; it++) {
      const m = Math.sqrt(lo * hi), B = basis({ ...c, D: m });
      if (pts.every((p) => { const [x, y, z] = proj(B, p); return z > 20 && Math.abs(x) <= box.x && Math.abs(y) <= box.y; })) hi = m; else lo = m;
    }
    return hi;
  }
  /** A word's cap height and span on screen (fractions of the frame's height and width) through camera c. */
  private size(c: Cam | Basis, w: TWord): [number, number] {
    const B = 'pos' in c ? c : basis(c);
    const a = proj(B, V(w.x, w.base, ZC)), b = proj(B, V(w.x, w.base + w.cap, ZC));
    const l = proj(B, V(w.x0, w.y, ZC)), r = proj(B, V(w.x0 + w.w, w.y, ZC));
    return [Math.hypot((a[0] - b[0]) * ASP, a[1] - b[1]) / 2, Math.hypot(r[0] - l[0], (r[1] - l[1]) / ASP) / 2];
  }

  /** ONE MOVE PER LINE (R34, R35, R81): a key per word on its onset (less a lead): the line so far framed whole in the
   *  box, leaning toward the newest word, at the plan's angles for that moment; the distance only grows (it opens
   *  close on the first word and eases back as the line fills), the target only moves right and toward the camera
   *  (down the rows), and the hold eases a little further back until the cut. */
  private buildPath(L: Line) {
    const P = L.plan, n = L.words.length, lead = 0.06;
    const prog = (t: number) => clamp((t - L.t0) / Math.max(1e-3, L.t1 - L.t0));
    const ang = (t: number) => { const u = prog(t); return [lerp(P.az[0], P.az[1], u), lerp(P.el[0], P.el[1], u), lerp(P.roll[0], P.roll[1], u)] as const; };
    const i0 = Math.max(0, L.words.filter((w) => w.start < L.t0 + 0.1).length - 1);
    const keys: { t: number; c: Cam }[] = [];
    for (let i = i0; i < n; i++) {
      const w = L.words[i]!;
      const t = i === i0 ? L.t0 : Math.max(L.t0 + 0.02, w.start - lead);
      const [az, el, roll] = ang(t);
      keys.push({ t, c: this.fit(corners(L.words.slice(0, i + 1)), V(w.x, w.y, ZC), az, el, roll + levelRoll(az, el), P.fov, RIDE) });
    }
    const Dend = Math.max(...keys.map((k) => k.c.D));
    keys[0]!.c.D = Math.max(keys[0]!.c.D, Dend * P.open);
    // one way only: the target right and down the rows, the distance back
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1]!.c, b = keys[i]!.c, ws = L.words.slice(0, i0 + i + 1);
      b.tx = Math.max(b.tx, a.tx); b.ty = Math.min(b.ty, a.ty);
      b.D = Math.max(b.D, a.D, this.needD(b, corners(ws)));
    }
    const last = keys[keys.length - 1]!;
    const [az1, el1, roll1] = ang(L.t1);
    const r1 = roll1 + levelRoll(az1, el1);
    keys.push({ t: L.t1, c: { ...last.c, az: az1, el: el1, roll: r1, D: Math.max(last.c.D * 1.03, this.needD({ ...last.c, az: az1, el: el1, roll: r1 }, corners(L.words))) } });
    L.path = new LyricPath(keys.map((k) => ({ t: k.t, v: [k.c.tx, k.c.ty, Math.log(k.c.D), k.c.az, k.c.el, k.c.roll] })), { clk: this.clk, settle: 0.3, down: 0.2 });
  }
  private lineCam(L: Line, t: number): Cam {
    const v = L.path.at(t);
    return { tx: v[0]!, ty: v[1]!, D: Math.exp(v[2]!), az: v[3]!, el: v[4]!, roll: v[5]!, fov: L.plan.fov, mac: -1 };
  }

  /** A HERO MACRO (R36): searched round the line's own framing at the hero's onset (azimuth +-20, elevation, three
   *  lenses), the framing that holds every word bitten... lit before it leaves whole in the box, every supporting word
   *  >= SUP_MIN, and brings the hero nearest MACRO_CAP (R21: 20% cap; else its span), preferring a visibly different
   *  angle (a reframe, not a nudge). It opens MACRO_PUSH wider and pushes in over the hero word (R80). */
  private solveMacro(L: Line, hk: number, xk: number, easeOut: boolean): Macro | null {
    const hero = L.words.find((w) => w.line === L.k && w.k === hk);
    if (!hero) return null;
    const exitW = xk >= 0 ? L.words.find((w) => w.line === L.k && w.k === xk) : undefined;
    const t0 = Math.max(hero.start, L.t0);
    const t1 = !exitW ? L.t1 : easeOut ? exitW.start - MACRO_LEAD : exitW.start - 0.07;
    const te = easeOut ? Math.min(t1 + MACRO_EASE, L.t1) : t1;
    const ws = L.words.filter((w) => w.start < te - 0.02 || w === hero);
    const pts = corners(ws);
    const lc = this.lineCam(L, t0);
    let best: { c: Cam; cap: number; span: number; sup: number; score: number } | null = null;
    for (let da = -20; da <= 20; da += 4) for (let de = -8; de <= 8; de += 2) for (const fov of [26, 34, 42]) {
      const el = lc.el + de;
      if (el > 54 || el < 30) continue;
      const roll = (lc.roll - levelRoll(lc.az, lc.el)) * 0.5 + levelRoll(lc.az + da, el);
      const f = this.fit(pts, V(hero.x, hero.y, ZC), lc.az + da, el, roll, fov, 0.3, BOX_M);
      f.D *= MACRO_PUSH;
      const B = basis(f);
      const [cap, span] = this.size(B, hero);
      let sup = 1;
      for (const w of ws) if (!w.hero) sup = Math.min(sup, this.size(B, w)[0]);
      const diff = Math.abs(da) + Math.abs(de) + Math.abs(fov - lc.fov) / 2 >= 8 ? 0.05 : 0;
      const score = (sup >= SUP_MIN ? 10 : sup * 100) + (cap >= 0.205 || span >= 0.31 ? 1 : 0) + Math.min(cap, MACRO_CAP) / MACRO_CAP + 0.3 * Math.min(span, 0.45) + diff - 0.004 * Math.abs(de);
      if (!best || score > best.score) best = { c: f, cap, span, sup, score };
    }
    if (!best) { console.warn(`UVMACRO no framing for ${hero.text}`); return null; }
    // back off to the target size where the framing could go tighter
    if (best.cap > MACRO_CAP) { best.c.D *= best.cap / MACRO_CAP; const s = this.size(best.c, hero); best.cap = s[0]; best.span = s[1]; }
    const [lcap] = this.size(lc, hero);
    return { line: L.k, hero, t0, t1, te, ease: easeOut, cam: { ...best.c, mac: this.macros.length }, push: Math.max(0.4, hero.end - hero.start), cap: best.cap, span: best.span, sup: best.sup, ratio: best.cap / Math.max(1e-3, lcap) };
  }
  private macroCam(M: Macro, mi: number, t: number): Cam {
    const u = ease.inOutQuad(clamp((t - M.t0) / M.push));
    const dr = (mi % 2 ? 1 : -1) * 1.5 * (ease.inOutQuad(clamp((t - M.t0) / Math.max(0.3, M.t1 - M.t0))) - 0.5);
    return { ...M.cam, D: M.cam.D / lerp(1, MACRO_PUSH, u), az: M.cam.az + dr, mac: mi };
  }
  private lineAt(t: number): Line {
    let L = this.lines[0]!;
    for (const x of this.lines) if (x.t0 <= t + 1e-6) L = x;
    return L;
  }
  /** The camera at t: a hero macro while one is open (and its eased pull-back), else the line's one move. */
  private camAt(t: number, L = this.lineAt(t)): Cam {
    for (let mi = 0; mi < this.macros.length; mi++) {
      const M = this.macros[mi]!;
      if (M.line !== L.k || t < M.t0 - 1e-6) continue;
      if (t < M.t1 - 1e-6) return this.macroCam(M, mi, t);
      if (M.ease && t < M.te - 1e-6) return blendCam(this.macroCam(M, mi, t), this.lineCam(L, t), ease.inOutCubic(clamp((t - M.t1) / (M.te - M.t1))));
    }
    return this.lineCam(L, t);
  }
  private slamAt(t: number) { return t >= this.tTeeth - 1e-6 && t < this.lines[2]!.t0 - 1e-6; }

  // ================================================================================================ light and hits
  /** The tier-1 hit's strength at t (0..1+): the lamp's drop, the pool's tightening, the glow's peak. */
  private hit1(t: number) { return this.hits.reduce((a, h) => (h.tier === 1 ? Math.max(a, h.k * pulse(t, h.t, 0.11)) : a), 0); }
  /** The lamp's brightness: on with the first word; tier-1 hits lift it, tier-2 downbeats kick it a little. */
  private lampK(t: number): number {
    if (t < this.tOn) return 0;
    let k = 1;
    for (const h of this.hits) if (t >= h.t) k += (h.tier === 1 ? 0.5 * h.k : 0.14) * pulse(t, h.t, h.tier === 1 ? 0.1 : 0.07);
    return k;
  }
  /** The beam's aim point on the cloth (mm), with the hand's tremor. */
  private aim(t: number): V2 {
    const [x, y] = track(this.beamKeys, t);
    return [x! + 1.6 * noise1(t * 1.7, 3), y! + 1.3 * noise1(t * 1.9, 7)];
  }

  /** Per word at t: level (gate x its line on screen x GO's decay), and its pose on the cloth (anchor, scale, lean). */
  private wordState(w: TWord, t: number, L: Line) {
    if (w.disp !== L.k) return null;
    const standing = w.start < L.t0 + 0.05;
    const gate = standing ? 1 : clamp((t - (w.start - 0.045)) / 0.06);
    if (gate <= 0) return null;
    let lvl = gate;
    const go = w.st === 'go';
    // GO does not hold its floor (the one exception, R23/R57): it bleaches under the held beam to ~25% to the eye at
    // the cut (the glow is far over white at full level: ~2-3% linear left at the cut)
    if (go && t > w.start + 0.08) lvl *= Math.exp((-(t - w.start - 0.08) / (this.ctx.end - w.start - 0.08)) * Math.log(1 / 0.016));
    // the moves (the type card): a hero stamps (lands oversized and settles; GO biggest) and stretches on the kick;
    // the first NEVER condenses on each later "never"; the middle NEVERs land a quarter wider and condense, each
    // narrower; DEVIL leans further each beat
    const tl = t - (standing ? L.t0 - 0.2 : w.start - 0.045);
    const over = go ? 1.16 : w.hero ? (w.serif ? 1.05 : 1.08) : w.st === 'mid' ? 1.05 : 1.02;
    const S = over + (1 - over) * springStep(Math.max(0, tl), 5, 0.5);
    let sx = S, sy = S, lean = 0;
    if (w.hero || w.st === 'mid') sx *= 1 + 0.04 * this.clk.kick(t) - 0.03 * this.clk.snare(t);
    if (w.rep === 1) {
      const nv = this.lines[3]!.words.filter((x) => x.rep > 1);
      for (const x of nv) sx *= 1 - 0.08 * ease.outCubic(clamp((t - x.start) / 0.12));
    }
    if (w.rep > 1) sx *= (w.rep === 2 ? 0.93 : 0.84) * (1 + 0.22 * (1 - springStep(Math.max(0, tl), 4.5, 0.55)));
    if (w.text === 'DEVIL') lean = Math.min(0.07 * this.clk.steps(w.start - 0.1, t), 0.22);
    return { lvl, ax: w.x0, ay: w.base + w.cap / 2, sx, sy, lean };
  }
  /** The word's pose for the probe (kinetic.ts KinPose, glyph centres in cloth mm). */
  private kinPose(w: TWord, s: { lvl: number; ax: number; sx: number; sy: number; lean: number }): KinPose {
    return {
      shake: 0, scale: s.sy,
      glyphs: w.cells.map((c) => ({ cx: s.ax + (c.cx - s.ax) * s.sx, y: 0, sx: s.sx, sy: s.sy, rot: Math.atan(s.lean), on: s.lvl, width: w.st === 'sup' ? 100 : 62, weight: w.st === 'sup' ? 500 : 900 })),
    };
  }

  /** Where the lamp and the swab are at t (camera c): the lamp's frame and the pool; the swab's tip and frame. */
  private rig(t: number, c: Cam, L: Line) {
    const P = L.plan, az = c.az * DEG;
    const right = V(Math.cos(az), Math.sin(az), 0), away = V(-Math.sin(az), Math.cos(az), 0);
    const lc = c.mac >= 0 ? this.lineCam(L, t) : c;
    const w = 2 * lc.D * Math.tan((lc.fov * DEG) / 2) * ASP;   // (the line's framing: a macro does not move the lamp)
    const h1 = this.hit1(t);
    const Q = this.aim(t), Qa = this.aim(t - 0.03), Qb = this.aim(t + 0.03);
    const vx = (Qb[0] - Qa[0]) / 0.06, vy = (Qb[1] - Qa[1]) / 0.06;
    // (tier 1: the examiner brings the lamp down closer, so the pool tightens and brightens)
    // (round 1: it hovers beyond the line's far edge, whatever row the beam is on, so it never hangs over a sung row;
    // it shines back toward the lens onto the word)
    const g = V(Q[0], Q[1], ZC).addScaledVector(right, P.ls * w).addScaledVector(away, P.lb * w);
    g.y = Math.max(g.y, L.box[3] + (P.lm ?? LAMP_MARGIN));
    const lC = g.add(V(-vx * 0.012, -vy * 0.008, P.lu * w * (1 - 0.3 * clamp(h1))));
    const lZ = V(Q[0], Q[1], ZC).sub(lC).normalize();
    const yaw = clamp(vx * 0.0003, -0.16, 0.16) * Math.sign(P.hand);
    const ax0 = right.clone().multiplyScalar(Math.sign(P.hand) || 1).applyAxisAngle(V(0, 0, 1), yaw);
    const lX = ax0.addScaledVector(lZ, -ax0.dot(lZ)).normalize();
    const lY = new THREE.Vector3().crossVectors(lZ, lX);
    const pr = P.pr * w * (1 - 0.16 * clamp(h1));
    // the swab: in from the near right, down onto each stroke's start, drawn through it, lifted between strokes, away
    // after "me"
    const s = this.swab;
    const swOn = t > s.t0 && t < s.t1;
    let sP: V3 | null = null, sX = V(1, 0, 0), sY = V(0, 1, 0), sZ = V(0, 0, 1);
    if (swOn) {
      const Z0 = 6.4;
      const off = V(0, 0, 0).addScaledVector(right, 260).addScaledVector(away, -110);
      let x: number, y: number, z: number;
      const s0 = s.s[0]!;
      if (t < s0 - 0.02) {
        const k = ease.outCubic(clamp((t - s.t0) / (s0 - 0.02 - s.t0)));
        x = s.A[0]![0] + off.x * (1 - k); y = s.A[0]![1] + off.y * (1 - k); z = Z0 + 90 * (1 - k) * (1 - k);
      } else {
        let i = 0;
        while (i < 4 && t >= s.s[i + 1]! - 0.02) i++;
        const a = s.A[i]!, b = s.B[i]!, SD = s.sd[i]!;
        const ks = ease.inOutQuad(clamp((t - s.s[i]!) / SD));
        if (t < s.s[i]! + SD) { x = lerp(a[0], b[0], ks); y = lerp(a[1], b[1], ks); z = Z0; }
        else if (i < 4) {
          const n = s.A[i + 1]!;
          const kk = ease.inOutCubic(clamp((t - s.s[i]! - SD) / Math.max(0.05, s.s[i + 1]! - 0.02 - s.s[i]! - SD)));
          x = lerp(b[0], n[0], kk); y = lerp(b[1], n[1], kk); z = Z0 + 9 * Math.sin(Math.PI * kk);
        } else {
          const k = ease.inCubic(clamp((t - s.s[4]! - SD - 0.03) / 0.28));
          x = b[0] + off.x * k; y = b[1] + off.y * k; z = Z0 + 3 * clamp((t - s.s[4]! - SD) / 0.06) + 90 * k * k;
        }
      }
      // (from the near side, a little to the right, held low: the hand stays below the word it is drawing through)
      const h = V(0, 0, 0).addScaledVector(right, 0.4).addScaledVector(away, -0.92);
      const e = 12 * DEG;   // held like a pen (the match glove's grip), low
      sX = V(h.x * Math.cos(e), h.y * Math.cos(e), Math.sin(e)).normalize();
      sZ = V(0, 0, 1).addScaledVector(sX, -sX.z).normalize();
      sY = new THREE.Vector3().crossVectors(sZ, sX);
      sP = V(x, y, z);
    }
    return { Q, lC, lX, lY, lZ, pr, w, gSide: P.hand < 0 ? -1 : 1, swOn, sP, sX, sY, sZ };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, u = this.pass.u;
    if (QP?.get('uv_log') && !this.logged) { this.logged = true; this.logTravel(); }
    if (QP?.get('uv_occ') && !this.occLogged) { this.occLogged = true; this.occScan(); }
    if (this.slamAt(t)) return this.renderSlam(t, out);
    const L = this.lineAt(t);
    const c = this.camAt(t, L);
    const B = basis(c);
    const R = this.rig(t, c, L);
    (u.lC!.value as V3).copy(R.lC); (u.lX!.value as V3).copy(R.lX);
    (u.lY!.value as V3).copy(R.lY); (u.lZ!.value as V3).copy(R.lZ);
    u.lampK!.value = this.lampK(t);
    u.gSide!.value = R.gSide;   // the glove's back and knuckles toward the camera
    (u.Q!.value as THREE.Vector2).set(R.Q[0], R.Q[1]);
    (u.pAx!.value as THREE.Vector2).set(R.lX.x, R.lX.y).normalize();
    u.pR!.value = R.pr;
    // the excitation memory: where the pool has been over the last ~0.6 s, fading with age
    const M = u.M!.value as THREE.Vector4[];
    const ages = [0, 0.05, 0.11, 0.18, 0.26, 0.35, 0.46, 0.6];
    for (let k = 0; k < NM; k++) {
      const a = ages[k]!, ta = t - a;
      const La = this.lineAt(ta), ca = this.lineCam(La, ta);
      const q = this.aim(ta), wa = 2 * ca.D * Math.tan((ca.fov * DEG) / 2) * ASP;
      const wgt = Math.min(this.lampK(ta), 1.3) * (a < 0.12 ? 1 : Math.exp(-(a - 0.12) / 0.17));
      M[k]!.set(q[0], q[1], La.plan.pr * wa * (1 - 0.16 * clamp(this.hit1(ta))), wgt);
    }

    // the camera
    this.cam.fov = c.fov;
    this.cam.position.copy(B.pos);
    this.cam.up.copy(B.up);
    this.cam.lookAt(B.pos.clone().add(B.fw));
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    (u.invVP!.value as THREE.Matrix4).multiplyMatrices(this.cam.matrixWorld, this.cam.projectionMatrixInverse);
    (u.camPos!.value as V3).copy(B.pos);
    (u.res!.value as THREE.Vector2).set(out.width, out.height);
    u.pxAng!.value = (2 * B.tanH) / out.height;

    // the words
    const W = u.W!.value as THREE.Vector4[], W2 = u.W2!.value as THREE.Vector4[], WL = u.WL!.value as number[];
    const h1 = this.hit1(t);
    const fl0 = QP?.get('uv_floor') ? +QP.get('uv_floor')! : FLOOR;
    let lit = 0;
    const probe = kinProbeOn();
    const kc = probe ? kinCam(B.pos, B.fw, B.rt, B.up, B.tanH) : null;
    const box = QP?.get('uv_box') ? [] as string[] : null;
    for (const w of this.words) {
      const s = this.wordState(w, t, L);
      if (!s) { W[w.id]!.set(0, 0.5, 0, 0); continue; }
      let thr = 0.45;
      if (w.hero) {
        const snap = ease.outCubic(clamp((t - w.start) / 0.05));
        thr = w.serif ? lerp(0.62, 0.42, snap) : w.start < L.t0 + 0.05 ? (w.serif ? 0.42 : 0.5) : lerp(0.74, 0.5, snap);
      }
      W[w.id]!.set(s.lvl, thr, (w.hero ? 1.15 : 0.95) * (1 + 0.25 * clamp(h1)), fl0);
      W2[w.id]!.set(s.ax, s.ay, s.sx, s.sy);
      WL[w.id] = s.lean;
      const d = Math.hypot(w.x - R.Q[0], w.y - R.Q[1]);
      lit = Math.max(lit, s.lvl * (w.hero ? 1 : 0.4) * clamp(1 - d / (R.pr * 1.6)));
      if (kc) kinRecord3D(this.kws.get(w)!, this.kinPose(w, s), w.cap, w.base + w.cap / 2, (x, y) => [x, y, ZC + 1, 0, 0, 1], kc, { start: w.start, role: w.hero ? 'hero' : 'sup' });
      if (box) {
        const pts = corners([w]).map((p) => proj(B, p));
        const xs = pts.map((p) => (p[0] * 0.5 + 0.5) * FW), ys = pts.map((p) => (0.5 - p[1] * 0.5) * FH);
        box.push(`${w.text} ${Math.min(...xs).toFixed(0)},${Math.min(...ys).toFixed(0)},${Math.max(...xs).toFixed(0)},${Math.max(...ys).toFixed(0)} beam ${(d / R.pr).toFixed(2)}`);
      }
    }
    if (box) console.warn(`UVBOX ${t.toFixed(2)} ${box.join(' | ')}`);
    const fl = T_LIN.fluor;
    (u.wordBounce!.value as V3).set(fl[0], fl[1], fl[2]).multiplyScalar(0.03 * lit);

    // the swab
    const s = this.swab;
    u.swabOn!.value = R.swOn ? 1 : 0;
    const sk = u.strokeK!.value as number[];
    for (let k = 0; k < 5; k++) sk[k] = t < s.t1 + 0.5 && L.k === 2 ? ease.inOutQuad(clamp((t - s.s[k]!) / s.sd[k]!)) : 0;
    u.swabGlow!.value = sk.reduce((a, b, k) => a + b * s.wt[k]!, 0) * 0.2;
    if (R.sP) {
      (u.sP!.value as V3).copy(R.sP);
      (u.sX!.value as V3).copy(R.sX); (u.sY!.value as V3).copy(R.sY); (u.sZ!.value as V3).copy(R.sZ);
    }

    this.pass.render(this.ctx.renderer, out);
    // GRADED IMPACTS (R37, R79): tier 1 a shake of up to 12 px with the lamp's hit, tier 2 an exposure kick and up to
    // 5 px on the other downbeats, tier 3 up to 2 px on the backbeats
    let shake = 12 * h1, kick = 0;
    for (const h of this.hits) if (h.tier === 2 && t >= h.t) { const p = pulse(t, h.t, 0.05); shake = Math.max(shake, 5 * p); kick = Math.max(kick, 0.08 * p); }
    for (const b of this.backs) if (t >= b && t < b + 0.3) shake = Math.max(shake, 2 * pulse(t, b, 0.04));
    kick = Math.max(kick, 0.1 * h1);
    return { exposure: 1 + kick, halation: 0.12, bloom: 0.4, shake: kinShake(t, Math.min(12, shake)) };
  }

  // ================================================================================================ the TEETH slam
  /** THE TEETH HOOK, hook 2 of 7 (TYPE.md section 8 item 2; R24, R82): on TEETH's onset a full-frame slam, fluor-white
   *  Archivo 900 on film-black, stamped and shaking; on the 8th (68.80) a condensed copy is stamped over it, and the
   *  beam's sweep crosses the frame as the break line: a straight wipe edge, left to right, taking the first copy away
   *  behind it. Flat fills, no outlines; the plate's grain and no halation. Held to LATE with no orphan frame. */
  private renderSlam(t: number, out: THREE.WebGLRenderTarget): PostOverrides {
    const c = this.L.ctx;
    this.L.clear(trgba('film'));
    c.textBaseline = 'alphabetic';
    const tag = { role: 'hero' as const, start: this.tTeeth };
    let shake = 0;
    // the first copy
    const A = this.slamA;
    const PA = A.pose(t, this.clk, { t0: this.tTeeth, lead: 0, spring: false, stamp: { at: this.tTeeth, over: 1.22 }, stretch: { kick: 0.08, snare: 0.05 }, track: { amt: 0.02 }, anchor: 'center' });
    shake = Math.max(shake, 12 * PA.shake);
    const capA = A.style.size * 0.686;
    const xA = (FW - A.width) / 2, baseA = FH / 2 + capA / 2;
    const t2 = this.tSlam2;
    // the beam's sweep: a straight edge, tilted a little, crossing the frame in 0.22 s from the second slam
    const ws = clamp((t - t2) / 0.22);
    const edge = lerp(-260, FW + 260, ease.inOutQuad(ws));
    if (t < t2) drawKin(c, A, PA, xA, baseA, { fill: trgba('fluor'), tag });
    else if (ws < 1) {
      // behind the edge (already swept) the first copy is gone; ahead of it, it still stands, a shade down under the copy
      drawKin(c, A, PA, xA, baseA, { fill: trgba('fluor', 0.42), brk: { mask: halfPlane(edge, FH / 2, Math.PI / 2 + 0.16), k: 1, aOn: 0 } });
    }
    if (t >= t2) {
      const Bk = this.slamB;
      const PB = Bk.pose(t, this.clk, { t0: t2, lead: 0, spring: false, stamp: { at: t2, over: 1.28 }, stretch: { kick: 0.1, snare: 0.06 }, anchor: 'center' });
      const tall = Math.min(1.75, 700 / (0.686 * Bk.style.size));
      for (const g of PB.glyphs) g.sy *= tall;
      const capB = Bk.style.size * 0.686 * tall;
      drawKin(c, Bk, PB, (FW - Bk.width) / 2, FH / 2 + capB / 2, { fill: trgba('fluor'), tag });
      shake = Math.max(shake, 12 * PB.shake);
    }
    this.L.upload();
    this.ctx.comp.draw(this.ctx.renderer, this.L.texture, out, { mode: 'replace' });
    return { exposure: 1, halation: 0, bloom: 0, shake: kinShake(t, Math.min(12, shake)), zoom: 1 + 0.02 * Math.max(PA.shake, 0) };
  }

  // ================================================================================================ look-dev logs
  /** uv_log=1: per line, the camera's travel (its orbit round the target, summed along the move, and the block
   *  centre's travel on screen, px at 1080p, summed; a reframe's jump is not travel), the framing range, the sizes
   *  (the first word's cap on its first frame, the smallest supporting cap over the line, each hero's peak cap and
   *  span), and each macro. */
  private logTravel() {
    const deg = (r: number) => ((r * 180) / Math.PI).toFixed(0);
    for (const L of this.lines) console.warn(`UVLAY ${L.k + 1}: ` + L.words.map((w) => `${w.text}[r${w.row} x${w.x0.toFixed(0)}+${w.w.toFixed(0)} b${w.base.toFixed(0)} c${w.cap}]`).join(' '));
    for (const L of this.lines) {
      let orb = 0, scr = 0, jumps = 0, prev: { d: V3; sx: number; sy: number; mac: number } | null = null, Dmin = 1e9, Dmax = 0, supMin = 1, supAt = 0;
      const heroPk = new Map<string, [number, number, number]>();
      const cen = V((L.box[0] + L.box[2]) / 2, (L.box[1] + L.box[3]) / 2, ZC);
      const t1 = L.t1;
      for (let t = L.t0; t < t1 - 1e-6; t += 1 / 30) {
        const c = this.camAt(t, L), B = basis(c);
        const d = B.pos.clone().sub(B.tgt).normalize();
        const [x, y] = proj(B, cen);
        const cur = { d, sx: (x * 0.5 + 0.5) * 1920, sy: (0.5 - y * 0.5) * 1080, mac: c.mac };
        const ds = prev ? Math.hypot(cur.sx - prev.sx, cur.sy - prev.sy) : 0;
        if (prev && (prev.mac === cur.mac || (ds < 40 && prev.d.angleTo(d) < 0.05))) { orb += prev.d.angleTo(d); scr += ds; } else if (prev) jumps++;
        if (c.mac < 0) { Dmin = Math.min(Dmin, c.D); Dmax = Math.max(Dmax, c.D); }
        prev = cur;
        for (const w of L.words) {
          const s = this.wordState(w, t, L);
          if (!s || s.lvl < 0.2) continue;
          const [cap, span] = this.size(B, w);
          if (!w.hero && t > w.start + 0.12 && cap < supMin) { supMin = cap; supAt = t; }
          if (w.hero) { const p = heroPk.get(w.text) ?? [0, 0, 0]; if (Math.abs(t - w.start) < 0.05 && cap > p[2]) p[2] = cap; heroPk.set(w.text, [Math.max(p[0], cap), Math.max(p[1], span), p[2]]); }
        }
      }
      const w0 = L.words.find((w) => w.start >= L.t0 - 0.05) ?? L.words[0]!;
      const c0 = this.camAt(L.t0 + 0.034, L), [cap0] = this.size(c0, w0);
      console.warn(`UVLOG line ${L.k + 1} ${L.t0.toFixed(2)}-${t1.toFixed(2)}: orbit ${deg(orb)} deg, block centre ${scr.toFixed(0)} px, framing ${(Dmax / Dmin).toFixed(2)}x${jumps ? `, reframes ${jumps}` : ''}; first word ${w0.text} cap ${(cap0 * 100).toFixed(1)}%; smallest supporting cap ${(supMin * 100).toFixed(1)}% at ${supAt.toFixed(2)}; heroes ${[...heroPk].map(([k, v]) => `${k} peak cap ${(v[0] * 100).toFixed(1)}% span ${(v[1] * 100).toFixed(1)}% onset cap ${(v[2] * 100).toFixed(1)}%`).join(', ')}`);
      for (const M of this.macros.filter((m) => m.line === L.k)) console.warn(`UVLOG   macro ${M.hero.text} ${M.t0.toFixed(2)}-${M.t1.toFixed(2)}${M.ease ? ` (eased to ${M.te.toFixed(2)})` : ''}: az ${M.cam.az.toFixed(0)} el ${M.cam.el.toFixed(0)} fov ${M.cam.fov}, hero cap ${(M.cap * 100).toFixed(1)}% span ${(M.span * 100).toFixed(1)}% (${M.ratio.toFixed(2)}x the line's), smallest supporting ${(M.sup * 100).toFixed(1)}%`);
    }
  }

  /** uv_occ=1, THE OCCLUSION SCAN (the lead's decision 2026-11-22): every frame of the window (30 fps, the slam
   *  excepted), the lamp housing, its glove and sleeve, and the swab, its glove and sleeve as stand-in capsules
   *  (LAMP_CAPS, SWAB_CAPS) projected by the frame's camera, traced against each sung word's projected box (a 9 x 4
   *  grid of points; a point is covered when a capsule's projection covers it: every shape stands over the cloth, so it
   *  is in front of the word wherever it projects onto it). A word counts as covered on a
   *  frame when more than 15% of its points are; a hit is a word covered for more than 2 frames running. */
  private occScan() {
    const runs = new Map<TWord, number>(), hits: string[] = [];
    let frames = 0, worst = 0;
    for (let t = this.ctx.start; t < this.ctx.end - 1e-6; t += 1 / 30) {
      if (this.slamAt(t)) continue;
      frames++;
      const L = this.lineAt(t), c = this.camAt(t, L), B = basis(c), R = this.rig(t, c, L);
      // the capsules as screen discs along their axes (centre px, radius px, depth)
      const discs: [number, number, number, number, string][] = [];
      const add = (a: V3, b: V3, r: number, id: string) => {
        for (let i = 0; i <= 10; i++) {
          const p = a.clone().lerp(b, i / 10), [x, y, z] = proj(B, p);
          if (z <= 5) continue;
          discs.push([(x * 0.5 + 0.5) * FW, (0.5 - y * 0.5) * FH, (r / (z * B.tanH)) * (FH / 2), z, id]);
        }
      };
      const fromL = (v: number[]) => R.lC.clone().addScaledVector(R.lX, v[0]!).addScaledVector(R.lY, v[1]! * R.gSide).addScaledVector(R.lZ, v[2]!);
      LAMP_CAPS.forEach(([a, b, r], i) => add(fromL(a), fromL(b), r, ['lamp head', 'lamp handle', 'lamp glove', 'lamp wrist', 'lamp sleeve'][i]!));
      if (R.swOn && R.sP) {
        const fromS = (v: number[]) => R.sP!.clone().addScaledVector(R.sX, v[0]!).addScaledVector(R.sY, v[1]!).addScaledVector(R.sZ, v[2]!);
        SWAB_CAPS.forEach(([a, b, r], i) => add(fromS(a), fromS(b), r, ['swab tip', 'swab shaft', 'swab fingers', 'swab glove', 'swab sleeve'][i]!));
      }
      for (const w of this.words) {
        const s = this.wordState(w, t, L);
        if (!s || s.lvl < 0.2 || t < w.start - 0.02) { runs.delete(w); continue; }
        let n = 0, cov = 0;
        const by = new Map<string, number>();
        for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) {
          const p = V(w.x0 + ((i + 0.5) / 9) * w.w, w.y - w.h / 2 + ((j + 0.5) / 4) * w.h, ZC);
          const [x, y] = proj(B, p), px = (x * 0.5 + 0.5) * FW, py = (0.5 - y * 0.5) * FH;
          n++;
          // (everything stands on or over the cloth, so whatever projects over a word's point is in front of it)
          const hit = discs.find((d) => Math.hypot(px - d[0], py - d[1]) < d[2]);
          if (hit) { cov++; by.set(hit[4], (by.get(hit[4]) ?? 0) + 1); }
        }
        const f = cov / n;
        worst = Math.max(worst, f);
        if (f > 0.15) {
          const r = (runs.get(w) ?? 0) + 1;
          runs.set(w, r);
          if (r === 3) hits.push(`${w.text} from ${(t - 2 / 30).toFixed(2)} (${(f * 100).toFixed(0)}% covered, by ${[...by].sort((a, b) => b[1] - a[1])[0]![0]})`);
        } else runs.delete(w);
      }
    }
    for (const h of hits) console.warn(`UVOCC hit: ${h}`);
    console.warn(`UVOCC total: ${hits.length} hit(s) over ${frames} frames (a word > 15% covered by the lamp, a glove or the swab for more than 2 frames); worst single-frame cover ${(worst * 100).toFixed(0)}%`);
  }
}
