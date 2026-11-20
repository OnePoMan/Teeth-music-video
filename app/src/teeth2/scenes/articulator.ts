// Plate 10 `articulator` — chorus 2, second half (117.79 – 131.60), docs/TEETH2.md. Ray-marched (articulator-glsl.ts),
// then pour's depth-of-field gather; grain, cold halation and vignette come from the timeline's shared post.
//
// His casts (the kit's HIS, the chip on #8), poured and trimmed in plate 9, mounted on a chrome semi-adjustable
// articulator on a black table, in front of a white seamless studio sweep; a strip of black articulating paper between
// them. THE IDIOM (the reflection flare): the lyric is engraved in a narrow chamfered chrome crossbar, a film-black
// inset with a bevel edge, legible only where a highlight band (the studio's reflection) crosses the polished face.
// The band travels along the bar word by word, arriving on each word's onset; the face is otherwise dark chrome.
// THE EVENT SCRIPT. On the non-hero words the upper member glides sideways and forward over the lower in machine
// steps, one per word, the camera locked to it laterally; each glide inks the yellow cusps with the paper's film-black
// marks. The casts close only on each line's hero: on "so" / "got" the member snaps back to centric and opens (the
// marked lower cusps show), and it shuts on SWEET and TEETH, filmed from >= 45 degrees above (never front-on at
// occlusal level). "put your hands": three pin clicks, one per word, the pin seating on HANDS. "never, never, never":
// three wide glides from high three-quarter shots. "let go": LET and GO are engraved in the static lower crossbar; LET
// clicks, GO closes, and the upper member swings open and lifts away out of frame while GO stays whole.
// Nothing glows (bloom 0); the sweep and the band stay under the bloom threshold. No label besides the lyric.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { ease } from '../../engine/util';
import type { Line, Word } from '../../engine/lyrics';
import { TeethTex, HIS } from '../teeth';
import { DOF_FRAG } from './pour-glsl';
import { ART_FRAG } from './articulator-glsl';
import { RIG, CENTRIC, Channel, facePoint, poseMatrix, type Pose } from './articulator-rig';

const DEG = Math.PI / 180;
const CV_W = 2048, CV_HH = Math.round((CV_W * RIG.FHH) / RIG.FHW), CV_H = 2 * CV_HH;
const ZI = 150;                  // condylar axis to incisors (mm): lateral travel at the incisors per radian of yaw
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** One word as engraved: box in bar mm (u along the bar, v up the face), its family and em. */
interface Glyph { w: Word; txt: string; fam: string; em: number; cap: number; u0: number; u1: number; base: number; hero: boolean; wax: boolean }
/** A shot: azimuth (from the front toward +x) and elevation in degrees, frame height (mm at the look-at), each eased
 *  from its first to its second value over the phrase; the look-at; how much it follows the upper member. */
interface Shot { phi: [number, number]; el: [number, number]; hf: [number, number]; at: [number, number, number]; track: number; tanH: number; aper: number; focus?: [number, number, number] }
interface Phrase { kind: 'glide' | 'hero' | 'pins' | 'release'; glyphs: Glyph[]; lower: boolean; shot: Shot; lats: number[]; t0: number; t1: number }

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
    const capK = (fam: string) => (fam === wax ? 0.42 : 0.715);
    // a row of words centred on the bar, supporting words at `cs`, the hero at `ch`, shrunk to fit the face
    const row = (l: Line, ids: number[], cs: number, heroIdx = -1, ch = 10.4, heroFam = heavy): Glyph[] => {
      const items = ids.map((i) => {
        const w = l.words[i]!, hero = i === heroIdx, isWax = hero && heroFam === wax;
        const raw = w.w.replace(/[,.!?]/g, '');
        const txt = isWax ? raw.toLowerCase() : raw.toUpperCase();
        const fam = hero ? heroFam : sup, cap = hero ? ch : cs;
        c.font = font(fam, 100);
        return { w, txt, fam, cap, wid: (c.measureText(txt).width / 100) * (cap / capK(fam)), hero, wax: isWax };
      });
      const gap = (a: { cap: number }) => 0.45 * a.cap;
      let total = items.reduce((s, it, i) => s + it.wid + (i ? gap(it) : 0), 0);
      const k = Math.min(1, (2 * RIG.FHW - 10) / total);
      total *= k;
      let u = -total / 2;
      const capMax = Math.max(...items.map((it) => it.cap * k));
      return items.map((it, i) => {
        if (i) u += gap(it) * k;
        const cap = it.cap * k, em = cap / capK(it.fam), wid = it.wid * k;
        const g: Glyph = { w: it.w, txt: it.txt, fam: it.fam, em, cap, u0: u, u1: u + wid, base: -capMax / 2 - (it.wax ? 0.1 * cap : 0), hero: it.hero, wax: it.wax };
        u += wid;
        return g;
      });
    };
    const S = (phi: [number, number], el: [number, number], hf: [number, number], at: [number, number, number], track: number, tanH = 0.19, aper = 40, focus?: [number, number, number]): Shot =>
      ({ phi, el, hf, at, track, tanH, aper, focus });
    const P = (kind: Phrase['kind'], glyphs: Glyph[], shot: Shot, lats: number[] = [], lower = false): Phrase =>
      ({ kind, glyphs, lower, shot, lats, t0: 0, t1: 0 });
    const BAR: [number, number, number] = [0, RIG.FY, RIG.FZ];
    this.phrases = [
      // line 1 — the opening three-quarter wide: upper member, hinge, pin and guide table, the sweep behind
      P('glide', row(L1, [0, 1, 2], 10), S([-40, -35], [27, 24], [255, 235], [0, 10, 0], 0.6, 0.2, 30, BAR), [-4, -7, -3]),
      P('glide', row(L1, [3, 4, 5], 10), S([-36, -32], [17, 15], [180, 170], [0, 30, 6], 1, 0.17, 60, BAR), [3, 6, 9]),
      P('hero', row(L1, [6, 7], 6.5, 7, 7.5, wax), S([-14, -10], [53, 56], [185, 175], [0, 30, 0], 0, 0.19, 40, BAR)),
      // line 2 — the paper macro (three-quarter, low), the far side, then TEETH from above
      P('glide', row(L2, [0, 1, 2], 10), S([-50, -46], [7, 10], [170, 158], [-10, 20, 0], 1, 0.15, 45, [-34, 2, -18]), [-3, -6, -8]),
      P('glide', row(L2, [3, 4, 5], 10), S([38, 34], [21, 19], [185, 172], [0, 28, 4], 1, 0.17, 60, BAR), [4, 7, 9]),
      P('hero', row(L2, [6, 7], 6.5, 7), S([12, 8], [58, 61], [160, 150], [0, 40, 12], 0, 0.19, 40, BAR)),
      // line 3 — the right three-quarter wide, the pin clicks from above, a close tracking shot
      P('glide', row(L3, [0, 1, 2], 10), S([44, 38], [29, 27], [245, 225], [0, 10, 0], 0.6, 0.2, 30, BAR), [-4, -7, -9]),
      P('pins', row(L3, [3, 4, 5], 6.5, 5), S([-5, -3], [47, 51], [185, 172], [0, 10, 30], 0, 0.19, 40, BAR)),
      P('glide', row(L3, [6, 7], 10), S([-37, -34], [12, 11], [178, 168], [0, 26, 8], 1, 0.16, 60, BAR), [5, 9]),
      // line 4 — three wide glides from high three-quarters, then LET GO in the lower bar and the release
      P('glide', row(L4, [0, 1], 10), S([-32, -28], [47, 49], [265, 250], [0, 10, -4], 0.3, 0.19, 30, BAR), [-3, 13]),
      P('glide', row(L4, [2], 10.4), S([30, 34], [52, 54], [245, 235], [0, 10, -4], 0.3, 0.19, 30, BAR), [-13]),
      P('glide', row(L4, [3, 4], 10), S([-4, 2], [58, 60], [235, 220], [0, 12, -4], 0.3, 0.19, 30, BAR), [13, 3]),
      P('release', row(L4, [5, 6], 6.5, 6), S([9, 6], [46, 47], [225, 220], [0, -26, 48], 0, 0.19, 30, [0, RIG.LY, RIG.LZ]), [], true),
    ];
    const ph = this.phrases;
    ph.forEach((p, i) => { p.t0 = i === 0 ? start : p.glyphs[0]!.w.start - 0.045; });
    ph.forEach((p, i) => { p.t1 = ph[i + 1]?.t0 ?? end; });
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
          this.marksC.to(tE - 0.05, tE + 0.1, marks / nGlide, ease.outCubic);
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
    const X = (u: number) => (u + RIG.FHW) * ppm, Yc = (v: number) => (p.lower ? CV_HH : 0) + (RIG.FHH - v) * ppm;
    c.textBaseline = 'alphabetic';
    for (const g of p.glyphs) {
      if (t < g.w.start - 0.045) continue;
      c.font = font(g.fam, g.em * ppm);
      c.fillStyle = g.wax ? 'rgb(255,0,255)' : 'rgb(255,0,0)';
      c.fillText(g.txt, X(g.u0), Yc(g.base));
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
    // the shot, eased over the phrase, following the upper member laterally by `track`
    const sh = p.shot, k = ease.inOutQuad(clamp01((t - p.t0) / Math.max(0.1, p.t1 - p.t0)));
    const phi = lerp(sh.phi[0], sh.phi[1], k) * DEG, el = lerp(sh.el[0], sh.el[1], k) * DEG, hf = lerp(sh.hf[0], sh.hf[1], k);
    const disp = facePoint(pose, 0, 0).sub(facePoint(CENTRIC, 0, 0));
    disp.y = 0; disp.multiplyScalar(sh.track);
    const at = new THREE.Vector3(...sh.at).add(disp);
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
