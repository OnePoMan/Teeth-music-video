// Plate 10 `articulator` — chorus 2, second half (117.79 – 131.60), docs/TEETH2.md. Ray-marched (articulator-glsl.ts),
// then pour's depth-of-field gather; grain, cold halation and vignette come from the timeline's shared post.
//
// His casts (the kit's HIS, the chip on #8), poured and trimmed in plate 9, mounted on a chrome semi-adjustable
// articulator on a black table, in front of a white seamless studio sweep; a strip of black articulating paper between
// them. The upper member is one T-shaped arm hinged between two rear posts and cantilevered over the casts, a single
// incisal pin at its tip; each cast on a mounting disc. THE IDIOM (the reflection flare): the lyric is engraved in the
// arm's front cross-piece, a narrow chamfered chrome bar, a film-black
// inset with a bevel edge, legible only where a highlight band (the studio's reflection) crosses the polished face.
// The band travels along the bar word by word, arriving on each word's onset; the face is otherwise dark chrome.
// THE EVENT SCRIPT. On the non-hero words the upper member glides sideways and forward over the lower in machine
// steps, one per word, the camera locked to it laterally; each glide inks the yellow cusps with the paper's film-black
// marks. The casts close only on each line's hero: on "so" / "got" the member snaps back to centric and opens (the
// marked lower cusps show), and it shuts on SWEET and TEETH, filmed from >= 45 degrees above (never front-on at
// occlusal level). "put your hands": three pin clicks, one per word, the pin seating on HANDS. "never, never, never":
// three wide glides. CAMERA: each line opens on the bar within 30 degrees of frontal at ~44% of the frame's width; mid
// lines alternate three-quarter rear, profile (the hinge in frame) and a cusp macro (the ink after a glide); every
// hero is a macro on its word (>= 30% of the frame's width), SWEET / TEETH / HANDS from >= 45 degrees above. "let go":
// LET and GO are engraved in the static lower crossbar (its face taller, so GO fills a macro with the incisal table in
// frame); LET clicks, GO seats the pin, and the arm swings open and lifts away, the pin rising out of frame, GO whole.
// Nothing glows (bloom 0); the sweep and the band stay under the bloom threshold. No label besides the lyric.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT, W as FW, H as FH } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { ease } from '../../engine/util';
import type { Line, Word } from '../../engine/lyrics';
import { TeethTex, HIS } from '../teeth';
import { DOF_FRAG } from './pour-glsl';
import { ART_FRAG } from './articulator-glsl';
import { RIG, CENTRIC, Channel, facePoint, lowerFacePoint, poseMatrix, type Pose } from './articulator-rig';

const DEG = Math.PI / 180;
const CV_W = 2048, CV_HH = Math.round((CV_W * RIG.FHH) / RIG.FHW), CV_H = 2 * CV_HH;
const ASPECT = FW / FH;
const ZI = 150;                  // condylar axis to incisors (mm): lateral travel at the incisors per radian of yaw
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** One word as engraved: box in bar mm (u along the bar, v up the face), its family and em. */
interface Glyph { w: Word; txt: string; fam: string; em: number; cap: number; u0: number; u1: number; base: number; hero: boolean; wax: boolean }
type V3 = [number, number, number];
/** A shot, from time t: azimuth (from the front toward +x) and elevation in degrees, frame height (mm at the look-at)
 *  and the look-at, each eased from its first to its second value over `ke` seconds (default: until the next shot);
 *  how much it follows the upper member laterally; the focus point (default the look-at). */
interface Shot { t: number; phi: [number, number]; el: [number, number]; hf: [number, number]; at: [V3, V3]; track: number; tanH: number; aper: number; focus?: V3; ke?: number }
interface Phrase { kind: 'glide' | 'hero' | 'pins' | 'release'; glyphs: Glyph[]; lower: boolean; shots: Shot[]; lats: number[]; t0: number; t1: number }

export default class Articulator extends Scene {
  private tt!: TeethTex;
  private march!: FSPass;
  private dof!: FSPass;
  private rt = makeRT();
  private cv!: HTMLCanvasElement;
  private wordTex!: THREE.CanvasTexture;

  private phrases: Phrase[] = [];
  private psi = new Channel(); private theta = new Channel(); private tz = new Channel();
  private marksC = new Channel(); private lift = new Channel(); private swing = new Channel();
  private clicks: number[] = [];

  override init() {
    this.tt = new TeethTex(HIS);
    this.cv = document.createElement('canvas');
    this.cv.width = CV_W; this.cv.height = CV_H;
    this.wordTex = new THREE.CanvasTexture(this.cv);
    this.wordTex.colorSpace = THREE.NoColorSpace;
    this.wordTex.minFilter = THREE.LinearFilter; this.wordTex.magFilter = THREE.LinearFilter;
    this.wordTex.generateMipmaps = false;
    const v3 = () => new THREE.Vector3();
    this.march = new FSPass(ART_FRAG, {
      ssTap: SS_TAP, teethTex: { value: this.tt.texture },
      camPos: { value: v3() }, camR: { value: v3() }, camU: { value: v3() }, camF: { value: v3() }, tanH: { value: 0.2 },
      upInv: { value: new THREE.Matrix4() }, wordTex: { value: this.wordTex },
      marksK: { value: 0 }, bandA: { value: new THREE.Vector4() }, bandB: { value: new THREE.Vector4() },
      keyPos: { value: new THREE.Vector3(-560, 820, 620) }, keyDir: { value: v3() }, keyI: { value: 1 }, keyCone: { value: 0.92 },
      keyRef: { value: 1200 }, fillK: { value: 0.2 }, upLift: { value: 0 },
    });
    this.dof = new FSPass(DOF_FRAG, { src: { value: null }, focusD: { value: 600 }, aper: { value: 60 }, maxCoc: { value: 12 } });
    this.plan();
  }

  // ------------------------------------------------------------------ the pose at time t
  private pose(t: number): Pose {
    const psi = this.psi.at(t), tz = this.tz.at(t);
    const lat = ZI * Math.sin(psi);
    // cusp guidance lifts the upper member as it glides (in contact, never closed off centric)
    const ty = 0.32 * Math.abs(lat) + 0.3 * Math.max(tz, 0) + this.lift.at(t);
    return { psi, theta: this.theta.at(t) + this.swing.at(t), tx: 0, ty, tz };
  }

  // ------------------------------------------------------------------ the plan: phrases, motion, shots
  private plan() {
    const { start, end, lyrics } = this.ctx;
    const line = (q: string): Line => {
      const l = lyrics.find(q).find((x) => x.start >= start - 0.2 && x.start < end);
      if (!l) throw new Error(`articulator: lyric not found in window: ${q}`);
      return l;
    };
    const L1 = line('Fight so dirty'), L2 = line('Talk so pretty'), L3 = line('Late night devil'), L4 = line('never ever let go');
    const c = this.cv.getContext('2d')!;
    const sup = F.archivo(112, 500), heavy = F.archivo(75, 900), wax = F.serif(600, true);
    // a row of words centred on a bar: supporting words at cap `cs` mm, the hero filling 0.8 of the face's height;
    // shrunk to fit the bar's length; the row's ink box centred on the face
    const row = (l: Line, ids: number[], cs: number, heroIdx = -1, heroFam = heavy, hh = RIG.FHH): Glyph[] => {
      const items = ids.map((i) => {
        const w = l.words[i]!, hero = i === heroIdx, isWax = hero && heroFam === wax;
        const raw = w.w.replace(/[,.!?]/g, '');
        const txt = isWax ? raw.toLowerCase() : raw.toUpperCase();
        const fam = hero ? heroFam : sup;
        c.font = font(fam, 100);
        const m = c.measureText(txt);
        const asc = m.actualBoundingBoxAscent / 100, desc = m.actualBoundingBoxDescent / 100;
        const capE = c.measureText('H').actualBoundingBoxAscent / 100;
        const em = hero ? (1.6 * hh) / (asc + desc) : cs / capE;
        return { w, txt, fam, em, wid: (m.width / 100) * em, asc: asc * em, desc: desc * em, hero, wax: isWax };
      });
      const gap = (a: { em: number; hero: boolean }) => (a.hero ? 0.22 : 0.3) * a.em;
      let total = items.reduce((s, it, i) => s + it.wid + (i ? gap(it) : 0), 0);
      const k = Math.min(1, (2 * RIG.FHW - 10) / total);
      total *= k;
      let u = -total / 2;
      const base = ((Math.max(...items.map((it) => it.desc)) - Math.max(...items.map((it) => it.asc))) * k) / 2;
      return items.map((it, i) => {
        if (i) u += gap(it) * k;
        const wid = it.wid * k;
        const g: Glyph = { w: it.w, txt: it.txt, fam: it.fam, em: it.em * k, cap: it.asc * k, u0: u, u1: u + wid, base, hero: it.hero, wax: it.wax };
        u += wid;
        return g;
      });
    };
    const v3 = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];
    const mid = (g: Glyph) => 0.5 * (g.u0 + g.u1);
    const onBar = (g: Glyph): V3 => v3(facePoint(CENTRIC, mid(g), 0));
    const onLow = (g: Glyph): V3 => v3(lowerFacePoint(mid(g), 0));
    const groupBar = (gs: Glyph[]): V3 => v3(facePoint(CENTRIC, 0.5 * (gs[0]!.u0 + gs[gs.length - 1]!.u1), 0));
    // a hero macro: the word spans ~36% of the frame's width
    const heroHf = (g: Glyph) => (g.u1 - g.u0) / (0.36 * ASPECT);
    const S = (t: number, phi: [number, number], el: [number, number], hf: [number, number], at: V3 | [V3, V3], o: Partial<Shot> = {}): Shot => ({
      t, phi, el, hf, at: (Array.isArray(at[0]) ? at : [at, at]) as [V3, V3], track: 0, tanH: 0.19, aper: 40, ...o,
    });
    const P = (kind: Phrase['kind'], glyphs: Glyph[], lats: number[] = [], lower = false): Phrase => ({ kind, glyphs, lower, shots: [], lats, t0: 0, t1: 0 });
    const BAR: V3 = [0, RIG.FY, RIG.FZ];
    const CASTS: V3 = [0, 0, -26];
    // the onset frame: the bar within 30 degrees of its face's normal, ~44% of the frame's width, set low in the frame
    // with the arm, the disc and the hinge behind it (the front teeth hidden behind the bar from this height)
    const ONSET: V3 = [0, RIG.FY, RIG.FZ - 52];
    const ph: Phrase[] = [
      P('glide', row(L1, [0, 1, 2], 10), [-4, -7, -3]),
      P('glide', row(L1, [3, 4, 5], 10), [3, 6, 9]),
      P('hero', row(L1, [6, 7], 6.5, 7, wax)),
      P('glide', row(L2, [0, 1, 2], 10), [3, 6, 8]),
      P('glide', row(L2, [3, 4, 5], 10), [9, 10, 11]),
      P('hero', row(L2, [6, 7], 6.5, 7)),
      P('glide', row(L3, [0, 1, 2], 10), [5, 8, 10]),
      P('pins', row(L3, [3, 4, 5], 6.5, 5)),
      P('glide', row(L3, [6, 7], 10), [4, 8]),
      P('glide', row(L4, [0, 1], 10), [-4, -13]),
      P('glide', row(L4, [2], 10.4), [13]),
      P('glide', row(L4, [3, 4], 10), [-13, 3]),
      P('release', row(L4, [5, 6], 6.5, 6, heavy, RIG.LHH), [], true),
    ];
    ph.forEach((p, i) => { p.t0 = i === 0 ? start : p.glyphs[0]!.w.start - 0.045; });
    ph.forEach((p, i) => { p.t1 = ph[i + 1]?.t0 ?? end; });
    const hero = (p: Phrase) => p.glyphs.find((g) => g.hero)!;
    const push = (p: Phrase, phi: [number, number], el: [number, number], hf0: number) => {
      const h = hero(p);
      return S(p.t0, phi, el, [hf0, heroHf(h)], [groupBar(p.glyphs), onBar(h)], { ke: h.w.start - 0.03 - p.t0, focus: onBar(h), aper: 34 });
    };
    // line 1: the onset from high front-left; three-quarter rear; SWEET pushed in from >= 45 degrees above
    ph[0]!.shots = [S(ph[0]!.t0, [-16, -11], [34, 32], [182, 172], ONSET, { track: 0.6, tanH: 0.2, focus: BAR })];
    ph[1]!.shots = [S(ph[1]!.t0, [-142, -133], [30, 27], [252, 238], [0, 20, -15], { track: 0.4, tanH: 0.3, aper: 30, focus: CASTS })];
    ph[2]!.shots = [push(ph[2]!, [-9, -6], [49, 54], 150)];
    // line 2: the onset from high front-right; the cusp macro on the balancing side after the glide; TEETH
    ph[3]!.shots = [S(ph[3]!.t0, [15, 10], [35, 33], [182, 172], ONSET, { track: 0.6, tanH: 0.2, focus: BAR })];
    ph[4]!.shots = [S(ph[4]!.t0, [-74, -68], [33, 36], [50, 45], [-27, 0, -45], { tanH: 0.16, aper: 26 })];
    ph[5]!.shots = [push(ph[5]!, [10, 7], [50, 56], 150)];
    // line 3: the onset from high front-left; the pin clicks in profile (hinge in frame), the cut to HANDS on its onset
    ph[6]!.shots = [S(ph[6]!.t0, [-20, -14], [33, 35], [186, 176], ONSET, { track: 0.6, tanH: 0.2, focus: BAR })];
    {
      const p = ph[7]!, h = hero(p);
      p.shots = [
        S(p.t0, [72, 68], [11, 13], [215, 205], [0, 5, -18], { tanH: 0.22, aper: 30, focus: [0, 0, -10] }),
        S(h.w.start - 0.045, [-7, -5], [52, 55], [heroHf(h) * 1.04, heroHf(h)], onBar(h), { focus: onBar(h), aper: 34 }),
      ];
    }
    ph[8]!.shots = [S(ph[8]!.t0, [22, 16], [36, 33], [180, 170], ONSET, { track: 0.8, tanH: 0.2, focus: BAR })];
    // line 4: three wide glides: three-quarter rear, profile (hinge), then NEVER EVER frontal; LET from above, GO macro
    ph[9]!.shots = [S(ph[9]!.t0, [140, 150], [34, 38], [250, 238], [0, 15, -30], { track: 0.3, tanH: 0.3, aper: 30, focus: CASTS })];
    ph[10]!.shots = [S(ph[10]!.t0, [-74, -80], [16, 18], [222, 210], [0, 10, -25], { track: 0.5, tanH: 0.22, aper: 30, focus: [0, 0, -10] })];
    ph[11]!.shots = [S(ph[11]!.t0, [-7, 4], [36, 34], [184, 174], ONSET, { track: 0.6, tanH: 0.2, focus: BAR })];
    {
      const p = ph[12]!, go = hero(p), u = new THREE.Vector3(0, Math.cos(26 * DEG), -Math.sin(26 * DEG));
      // GO a little below centre (clear of the bottom edge), LET at the left, the incisal table and the pin above
      const at = v3(lowerFacePoint(mid(go) - 0.15 * (mid(go) - mid(p.glyphs[0]!)), 0).addScaledVector(u, 0.15 * heroHf(go)));
      p.shots = [
        S(p.t0, [-8, 12], [30, 26], [1.9 * heroHf(go), 1.12 * heroHf(go)], at, { ke: go.w.start - 0.045 - p.t0, aper: 34, focus: onLow(go) }),
        S(go.w.start - 0.045, [12, 14], [26, 27], [heroHf(go), heroHf(go) * 1.03], at, { focus: onLow(go), aper: 34 }),
      ];
    }
    this.phrases = ph;
    this.motion();
  }

  private motion() {
    const ph = this.phrases;
    const nGlide = ph.reduce((a, p) => a + (p.kind === 'glide' ? p.glyphs.length : 0), 0);
    let marks = 0;
    const OPEN = 12 * DEG;
    for (let pi = 0; pi < ph.length; pi++) {
      const p = ph[pi]!, gs = p.glyphs;
      if (p.kind === 'glide') {
        gs.forEach((g, i) => {
          const tS = g.w.start - 0.045, dur = g.w.end - g.w.start;
          const tE = g.w.start + Math.min(0.32, Math.max(0.16, 0.6 * dur));
          this.psi.to(tS, tE, Math.asin(p.lats[i]! / ZI), ease.outCubic);
          this.tz.to(tS, tE, (i % 2) * 2.0, ease.outCubic);
          marks++;
          // the ink builds quickly (readable in the cusp macro after the second line's glides), then saturates
          this.marksC.to(tE - 0.05, tE + 0.1, Math.min(1, (2.6 * marks) / nGlide), ease.outCubic);
        });
        // a glide line followed by the pin clicks ends by snapping back to centric and opening for the pin's descent
        const nx = ph[pi + 1];
        if (nx && (nx.kind === 'pins' || nx.kind === 'release')) {
          const last = gs[gs.length - 1]!;
          const tA = Math.max(last.w.start + 0.2, nx.t0 - 0.2);
          this.psi.to(tA, tA + 0.08, 0, ease.outCubic); this.tz.to(tA, tA + 0.08, 0, ease.outCubic);
          this.theta.to(tA + 0.04, tA + 0.16, nx.kind === 'pins' ? 9 * DEG : 7 * DEG, ease.outCubic);
        }
      } else if (p.kind === 'hero') {
        // "so" / "got": back to centric and open; the hero: the close, landing on its onset
        const pre = gs[0]!, hero = gs[gs.length - 1]!;
        const tA = pre.w.start - 0.02;
        this.psi.to(tA, tA + 0.09, 0, ease.outCubic); this.tz.to(tA, tA + 0.09, 0, ease.outCubic);
        this.theta.to(tA + 0.03, tA + 0.17, OPEN, ease.outCubic);
        this.theta.to(hero.w.start - 0.11, hero.w.start, 0, ease.inCubic);
        this.clicks.push(hero.w.start);
      } else {
        // pin clicks: the pin drops one step per word, seating on the last (HANDS / GO)
        const th0 = p.kind === 'pins' ? 9 * DEG : 7 * DEG;
        gs.forEach((g, i) => {
          const v = th0 * (1 - (i + 1) / gs.length);
          this.theta.to(g.w.start - 0.09, g.w.start, v, ease.inCubic);
          this.clicks.push(g.w.start);
        });
        if (p.kind === 'release') {
          // GO: the upper member swings open on its hinge and lifts away out of frame; GO stays in the lower bar
          const go = gs[gs.length - 1]!;
          this.swing.to(go.w.start + 0.1, go.w.end, 0.55, ease.inCubic);
          this.lift.to(go.w.start + 0.12, go.w.end, 190, ease.inCubic);
        }
      }
    }
  }

  private phraseAt(t: number) { return this.phrases.find((p) => t >= p.t0 && t < p.t1) ?? (t < this.phrases[0]!.t0 ? this.phrases[0]! : this.phrases[this.phrases.length - 1]!); }

  /** The reflection band on the phrase's bar: it travels across each word from its lead-in, holds wide on a hero. */
  private band(p: Phrase, t: number): THREE.Vector4 {
    const gs = p.glyphs;
    let i = -1;
    for (let k = 0; k < gs.length; k++) if (t >= gs[k]!.w.start - 0.045) i = k;
    if (i < 0) return new THREE.Vector4(gs[0]!.u0 - 30, 8, 0.3, 0);
    const g = gs[i]!, W = g.u1 - g.u0, s0 = g.w.start - 0.045;
    const on = clamp01((t - (gs[0]!.w.start - 0.045)) / 0.05);
    if (g.hero) {
      const k = clamp01((t - s0) / (g.w.end - s0 + 0.4));
      return new THREE.Vector4(lerp(g.u0 + 0.4 * W, g.u0 + 0.62 * W, k), 0.62 * W, -0.25, on);
    }
    const last = i === gs.length - 1;
    const k = ease.inOutQuad(clamp01((t - s0) / Math.max(0.12, g.w.end - s0)));
    let cu = lerp(g.u0 + 0.12 * W, g.u1 - 0.12 * W, k), I = on;
    if (last && t > g.w.end) { cu += (t - g.w.end) * 160; I *= Math.max(0, 1 - (t - g.w.end) / 0.45); }
    return new THREE.Vector4(cu, Math.max(1.0 * g.cap, 0.42 * W), 0.3, I);
  }

  /** The engraving as the shader reads it: R the cut letters, B the wax lacquer; the top half of the canvas is the
   *  upper bar, the bottom half the lower. A word is cut from its lead-in (start - 45 ms); redrawn every frame so the
   *  frame checker sees the lyric on every frame it is up. */
  private draw(p: Phrase, t: number) {
    const c = this.cv.getContext('2d')!;
    c.fillStyle = '#000'; c.fillRect(0, 0, CV_W, CV_H);
    const ppm = CV_W / (2 * RIG.FHW);
    // the lower bar's taller face maps to the same canvas half: squash its glyphs vertically to compensate
    const hh = p.lower ? RIG.LHH : RIG.FHH, ppmV = CV_HH / (2 * hh);
    const X = (u: number) => (u + RIG.FHW) * ppm, Yc = (v: number) => (p.lower ? CV_HH : 0) + (hh - v) * ppmV;
    c.textBaseline = 'alphabetic';
    for (const g of p.glyphs) {
      if (t < g.w.start - 0.045) continue;
      c.font = font(g.fam, g.em * ppm);
      c.fillStyle = g.wax ? 'rgb(255,0,255)' : 'rgb(255,0,0)';
      c.save();
      c.translate(X(g.u0), Yc(g.base));
      c.scale(1, ppmV / ppm);
      c.fillText(g.txt, 0, 0);
      c.restore();
    }
    this.wordTex.needsUpdate = true;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer } = this.ctx;
    const u = this.march.u;
    const p = this.phraseAt(t);
    this.draw(p, t);
    const pose = this.pose(t);
    (u.upInv!.value as THREE.Matrix4).copy(poseMatrix(pose)).invert();
    u.upLift!.value = this.lift.at(t) + 170 * Math.sin(Math.min(1.2, this.swing.at(t) + pose.theta));
    // the shot in force (a phrase may cut once inside it), eased over `ke` or until the next cut, following the upper
    // member laterally by `track`
    let si = 0;
    for (let i = 0; i < p.shots.length; i++) if (t >= p.shots[i]!.t) si = i;
    const sh = p.shots[si]!, sEnd = p.shots[si + 1]?.t ?? p.t1;
    const k = ease.inOutQuad(clamp01((t - sh.t) / Math.max(0.05, sh.ke ?? sEnd - sh.t)));
    const phi = lerp(sh.phi[0], sh.phi[1], k) * DEG, el = lerp(sh.el[0], sh.el[1], k) * DEG, hf = lerp(sh.hf[0], sh.hf[1], k);
    const disp = facePoint(pose, 0, 0).sub(facePoint(CENTRIC, 0, 0));
    disp.y = 0; disp.multiplyScalar(sh.track);
    const at = new THREE.Vector3(...sh.at[0]).lerp(new THREE.Vector3(...sh.at[1]), k).add(disp);
    const D = hf / (2 * sh.tanH);
    const pos = at.clone().addScaledVector(new THREE.Vector3(Math.sin(phi) * Math.cos(el), Math.sin(el), Math.cos(phi) * Math.cos(el)), D);
    const fw = at.clone().sub(pos).normalize();
    const rt = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(rt, fw);
    (u.camPos!.value as THREE.Vector3).copy(pos);
    (u.camF!.value as THREE.Vector3).copy(fw);
    (u.camR!.value as THREE.Vector3).copy(rt);
    (u.camU!.value as THREE.Vector3).copy(up);
    u.tanH!.value = sh.tanH;
    u.marksK!.value = this.marksC.at(t);
    const b = this.band(p, t);
    (u.bandA!.value as THREE.Vector4).copy(p.lower ? new THREE.Vector4(0, 1, 0, 0) : b);
    (u.bandB!.value as THREE.Vector4).copy(p.lower ? b : new THREE.Vector4(0, 1, 0, 0));
    const kp = u.keyPos!.value as THREE.Vector3;
    (u.keyDir!.value as THREE.Vector3).copy(new THREE.Vector3(0, -5, -20).sub(kp).normalize());
    u.keyRef!.value = kp.length();
    this.march.render(renderer, this.rt);
    const fp = sh.focus ? new THREE.Vector3(...sh.focus).add(disp) : at;
    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = fp.sub(pos).dot(fw);
    d.aper!.value = sh.aper;
    d.maxCoc!.value = 12;
    this.dof.render(renderer, out);
    // the clicks: the pin seating on its table jolts the frame (a mechanical source), dying in a few frames
    let shk = 0;
    for (const ct of this.clicks) if (t >= ct && t - ct < 0.2) shk = Math.max(shk, 2.5 * Math.exp(-(t - ct) / 0.035));
    return { bloom: 0, halation: 0.04, shake: [0, shk] };
  }
}
