// Plate 10 `articulator` — chorus 2, second half (117.79 – 131.60), docs/TEETH2.md. Ray-marched (articulator-glsl.ts),
// then pour's depth-of-field gather; grain, cold halation and vignette come from the timeline's shared post.
//
// His casts (the kit's HIS, the chip on #8), poured and trimmed in plate 9, mounted on a chrome semi-adjustable
// articulator on a black table, a strip of black articulating paper between them. One hard key (a spot, above
// front-left) and the white studio card: a big flat standing far in front of the set that the chrome mirrors.
// THE IDIOM (the reflection flare). The lyric is engraved in the polished front face of the upper member's crossbar,
// frosted letters that are black on black until the face mirrors the card. Every motion of the upper member is solved
// (articulator-rig.ts faceLit, the same test the shader runs) so that the card's reflection reaches each word on its
// onset: on the non-hero words the upper member glides sideways and forward over the lower in machine steps, one per
// word, the card's edge wiping along the line as it goes, the camera tracking the crossbar like a machine part; each
// glide inks the yellow cusps with the paper's film-black marks. THE HERO CLOSES. On SWEET, TEETH, HANDS and GO the
// member snaps back to centric and drops shut on its hinge, the incisal pin seating on its guide table: the card's
// edge rises over the hero word in the last degree of the close, so it flares at the click (a hard, frontal shot).
// "put your hands on me": three clicks of the pin, one per word, PUT and YOUR lighting low on the bar and HANDS as
// the pin seats; "on me" two small glides. "never, never, never ever": three wide glides, side to side. "let go":
// LET clicks, GO closes and flares, then the upper member lifts off its condyles, still mirroring the card, and
// swings away out of frame, leaving the marked lower cast and the paper.
// Nothing glows (bloom 0); the card stays under the bloom threshold. No label in the plate besides the lyric.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { ease } from '../../engine/util';
import type { Line, Word } from '../../engine/lyrics';
import { TeethTex, HIS } from '../teeth';
import { DOF_FRAG } from './pour-glsl';
import { ART_FRAG } from './articulator-glsl';
import { RIG, Channel, bisect, faceLit, facePoint, poseMatrix, type Pose } from './articulator-rig';

const DEG = Math.PI / 180;
const CV_W = 2048, CV_H = Math.round((2048 * RIG.FHH) / RIG.FHW);
const MARGIN = 0.9;              // mm past a word's box the card's edge must reach
const ZI = -RIG.HZ;              // incisors to the condylar axis (mm): lateral displacement per radian of glide

/** One word as engraved: box in face mm (u left/right, v bottom/top), its family and em. */
interface Glyph { w: Word; txt: string; fam: string; em: number; u0: number; u1: number; v0: number; v1: number; base: number; wax: boolean }
interface Cam { phi: number; el: number; D: number; Hf: number; off: [number, number, number]; track: boolean; aper: number }
interface Phrase {
  mode: 'yaw' | 'pitch'; glyphs: Glyph[]; t0: number; t1: number; cam: Cam;
  /** yaw: the glide's net lateral displacement at the incisors and its forward travel (mm) */
  lat?: number; fwd?: number;
  /** solved: the camera's look-at and position at t0, the face point it tracks */
  at0?: THREE.Vector3; pos0?: THREE.Vector3; tgt?: [number, number]; release?: boolean;
}

export default class Articulator extends Scene {
  private tt!: TeethTex;
  private march!: FSPass;
  private dof!: FSPass;
  private rt = makeRT();
  private cv!: HTMLCanvasElement;
  private wordTex!: THREE.CanvasTexture;

  private phrases: Phrase[] = [];
  private psi = new Channel(); private theta = new Channel(); private tx = new Channel(); private tz = new Channel();
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
      camPos: { value: v3() }, camR: { value: v3() }, camU: { value: v3() }, camF: { value: v3() }, tanH: { value: 0.03 },
      upInv: { value: new THREE.Matrix4() }, wordTex: { value: this.wordTex },
      wordRect: { value: new THREE.Vector4(-RIG.FHW, -RIG.FHH, 2 * RIG.FHW, 2 * RIG.FHH) },
      marksK: { value: 0 }, lowK: { value: 1 },
      keyPos: { value: new THREE.Vector3(-620, 760, 760) }, keyDir: { value: v3() }, keyI: { value: 1 }, keyCone: { value: 0.93 },
      keyRef: { value: 1200 }, fillK: { value: 0.16 }, upLift: { value: 0 },
    });
    this.dof = new FSPass(DOF_FRAG, { src: { value: null }, focusD: { value: 1800 }, aper: { value: 120 }, maxCoc: { value: 14 } });
    this.plan();
  }

  // ------------------------------------------------------------------ the pose at time t
  private pose(t: number, psiOverride?: number, thetaOverride?: number): Pose {
    const psi = psiOverride ?? this.psi.at(t), tx = this.tx.at(t), tz = this.tz.at(t);
    const lat = tx + ZI * Math.sin(psi);
    // cusp guidance lifts the upper member as it glides (in contact, never closed off centric)
    const ty = 0.4 * Math.abs(lat) + 0.3 * Math.max(tz, 0) + this.lift.at(t);
    let theta = thetaOverride ?? this.theta.at(t);
    if (thetaOverride === undefined) theta += this.swing.at(t) - this.lift.at(t) / (2 * 1900);
    return { psi, theta, tx, ty, tz };
  }

  // ------------------------------------------------------------------ the plan: phrases, motion, cameras
  private plan() {
    const { start, end, lyrics } = this.ctx;
    const line = (q: string): Line => {
      const l = lyrics.find(q).find((x) => x.start >= start - 0.2 && x.start < end);
      if (!l) throw new Error(`articulator: lyric not found in window: ${q}`);
      return l;
    };
    const L1 = line('Fight so dirty'), L2 = line('Talk so pretty'), L3 = line('Late night devil'), L4 = line('never ever let go');
    const c = this.cv.getContext('2d')!;
    const sup = F.archivo(112, 500), hero = F.archivo(75, 900), wax = F.serif(600, true);
    const capK = (fam: string) => (fam === wax ? 0.42 : 0.715);
    const glyph = (w: Word, fam: string, cap: number, u0: number, vc: number, isWax = false): Glyph => {
      const txt = isWax ? w.w.replace(/[,.!?]/g, '').toLowerCase() : w.w.replace(/[,.!?]/g, '').toUpperCase();
      const em = cap / capK(fam);
      c.font = font(fam, 100);
      const wid = (c.measureText(txt).width / 100) * em;
      const asc = isWax ? 0.45 * cap : 0;   // the italic t rises above the x-height
      return { w, txt, fam, em, u0, u1: u0 + wid, v0: vc - cap / 2, v1: vc + cap / 2 + asc, base: vc - cap / 2, wax: isWax };
    };
    const row = (l: Line, ids: number[], cap: number, u0: number, vc: number): Glyph[] => {
      let u = u0;
      return ids.map((i) => { const g = glyph(l.words[i]!, sup, cap, u, vc); u = g.u1 + 0.42 * cap / 0.715 * 0.6; return g; });
    };
    const centred = (g: Glyph, uc: number) => { const w = g.u1 - g.u0; g.u0 = uc - w / 2; g.u1 = uc + w / 2; return g; };
    const cam = (phi: number, el: number, D: number, Hf: number, off: [number, number, number], track: boolean, aper = 110): Cam =>
      ({ phi: phi * DEG, el: el * DEG, D, Hf, off, track, aper });
    const Y = (g: Glyph[], camv: Cam, lat: number, fwd: number): Phrase => ({ mode: 'yaw', glyphs: g, t0: 0, t1: 0, cam: camv, lat, fwd });
    const P = (g: Glyph[], camv: Cam, release = false): Phrase => ({ mode: 'pitch', glyphs: g, t0: 0, t1: 0, cam: camv, release });
    const W = (l: Line, i: number) => l.words[i]!;
    this.phrases = [
      // the shots vary scale (macro on the line, the casts and the bar, the whole machine) and height; the glides'
      // shots must stand at the card's edge (the azimuth is solved), the heroes face the bar (the elevation is solved)
      Y(row(L1, [0, 1, 2], 7.0, -55, 7), cam(-30, 6, 1800, 92, [0, -22, 0], true), -2, 2.5),
      Y(row(L1, [3, 4, 5, 6], 6.5, -56, 1), cam(-30, 4, 1600, 62, [0, 2, 0], true, 140), -5, 0.5),
      P([centred(glyph(W(L1, 7), wax, 12, 0, -2.5, true), 16)], cam(-12, 0, 1900, 84, [-4, -20, 0], false, 90)),
      Y(row(L2, [0, 1, 2], 9.5, -50, 5), cam(-31, 9, 2200, 150, [0, -45, 0], true, 70), 3, 1),
      Y(row(L2, [3, 4, 5, 6], 6.2, -58, -5), cam(-29, 5, 1800, 80, [6, -8, 0], true), -4, 3),
      P([centred(glyph(W(L2, 7), hero, 24, 0, 0), -6)], cam(-13, 0, 1900, 74, [0, -16, 0], false, 90)),
      Y(row(L3, [0, 1, 2], 6.5, -56, 4), cam(-30, 3, 1500, 62, [0, -2, 0], true, 140), 4, 2),
      P([glyph(W(L3, 3), sup, 5, -56, -11), glyph(W(L3, 4), sup, 5, -40, -3), glyph(W(L3, 5), hero, 14, -18, 8.5)], cam(-15, 0, 1800, 96, [0, -24, 0], false, 90)),
      Y(row(L3, [6, 7], 8.0, 8, -6), cam(-30, 2, 1700, 96, [-10, -30, 0], true), -3, 0),
      Y(row(L4, [0, 1], 10.0, -52, 6), cam(-30, 7, 2200, 150, [10, -45, 0], true, 70), -8, 0),
      Y(row(L4, [2], 11.0, -6, -1), cam(-31, 11, 1700, 70, [-6, -10, 0], true), 8, 1),
      Y(row(L4, [3, 4], 8.5, -45, 5), cam(-29, 3, 2000, 105, [4, -30, 0], true), -9, 2),
      P([glyph(W(L4, 5), sup, 5.5, -46, -12), glyph(W(L4, 6), hero, 21, -20, 4)], cam(-12, 0, 1900, 128, [0, -34, 0], false, 90), true),
    ];
    // phrase windows: from the first word's lead-in to the next phrase's
    const ph = this.phrases;
    // a hero shot opens 0.12 s ahead of its word: the snap back to centric and the opening before the close
    ph.forEach((p) => { p.t0 = Math.max(start, p.glyphs[0]!.w.start - 0.045 - (p.mode === 'pitch' ? 0.12 : 0)); });
    ph.forEach((p, i) => { p.t1 = ph[i + 1]?.t0 ?? end; });
    for (let pass = 0; pass < 2; pass++) this.solve(pass);
  }

  /** Camera position and look-at for a phrase at time t (with the solved base), the face tracked if the shot tracks. */
  private camAt(p: Phrase, t: number, poseT?: Pose) {
    const at = p.at0!.clone(), pos = p.pos0!.clone();
    if (p.cam.track) {
      const d = facePoint(poseT ?? this.pose(t), p.tgt![0], p.tgt![1]).sub(facePoint(this.pose(p.t0), p.tgt![0], p.tgt![1]));
      at.add(d); pos.add(d);
    }
    return { at, pos };
  }
  private placeCam(p: Phrase, poseT0: Pose, phi: number, el: number) {
    const tg = facePoint(poseT0, p.tgt![0], p.tgt![1]);
    const at = tg.clone().add(new THREE.Vector3(...p.cam.off));
    const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(el), Math.sin(el), Math.cos(phi) * Math.cos(el));
    p.at0 = at; p.pos0 = at.clone().addScaledVector(dir, p.cam.D);
  }

  private solve(pass: number) {
    const ph = this.phrases;
    this.psi = new Channel(); this.theta = new Channel(); this.marksC = new Channel();
    this.lift = new Channel(); this.swing = new Channel(); this.clicks = [];
    if (pass === 0) { this.tx = new Channel(); this.tz = new Channel(); }
    const nYaw = ph.filter((p) => p.mode === 'yaw').reduce((a, p) => a + p.glyphs.length, 0);
    let marks = 0;
    const warn: string[] = [];
    for (const p of ph) {
      const gs = p.glyphs;
      const uc = 0.5 * (Math.min(...gs.map((g) => g.u0)) + Math.max(...gs.map((g) => g.u1)));
      const vc = 0.5 * (Math.min(...gs.map((g) => g.v0)) + Math.max(...gs.map((g) => g.v1)));
      p.tgt = [uc, vc];
      const keyT = (g: Glyph) => [g.w.start - 0.045, g.w.start + Math.min(0.15, 0.7 * (g.w.end - g.w.start))] as const;
      if (p.mode === 'yaw') {
        // the glide's translation over the phrase (pass 1 sets it from pass 0's solved yaw)
        const tEnd = keyT(gs[gs.length - 1]!)[1];
        if (pass === 0) {
          this.tx.to(p.t0, tEnd, p.lat!, ease.inOutQuad);
          this.tz.to(p.t0, tEnd, p.fwd!, ease.inOutQuad);
        }
        const psiA = this.psi.at(p.t0);
        const lead = (g: Glyph) => [g.u0 - MARGIN, 0.5 * (g.v0 + g.v1)] as const;
        const tail = (g: Glyph) => [g.u1 + MARGIN, 0.5 * (g.v0 + g.v1)] as const;
        // the camera's azimuth: the card's edge sits just before the first word at the phrase's start
        const p0 = this.pose(p.t0, psiA);
        const [lu, lv] = lead(gs[0]!);
        const phi = bisect((ph_) => { this.placeCam(p, p0, ph_, p.cam.el); return faceLit(p0, p.pos0!, lu, lv); }, -55 * DEG, -10 * DEG);
        if (phi === null) warn.push(`yaw cam ${gs[0]!.txt}`);
        this.placeCam(p, p0, phi ?? p.cam.phi, p.cam.el);
        let cur = psiA;
        for (const g of gs) {
          const [tS, tE] = keyT(g);
          const at = (t: number, u: number, v: number) => (s: number) => { const q = this.pose(t, s); return faceLit(q, this.camAt(p, t, q).pos, u, v); };
          const sS = bisect(at(tS, ...lead(g)), cur - 0.07, cur + 0.02) ?? cur;
          const sE = bisect(at(tE, ...tail(g)), cur - 0.09, cur + 0.01);
          if (sE === null) warn.push(`yaw word ${g.txt}`);
          const s0 = Math.min(sS, cur);
          this.psi.to(Math.max(tS - 0.06, p.t0), tS, s0, ease.inOutQuad);
          this.psi.to(tS, tE, sE ?? s0 - 0.02, ease.outCubic);
          cur = sE ?? s0 - 0.02;
          marks++;
          this.marksC.to(tS, tE, marks / nYaw, ease.outCubic);
        }
        if (pass === 0) {
          // net lateral displacement wanted at the incisors: the Bennett shift makes up what the yaw does not
          const tx = p.lat! - ZI * Math.sin(cur);
          this.tx.segs = this.tx.segs.filter((s) => s.t0 !== p.t0);
          this.tx.to(p.t0, tEnd, tx, ease.inOutQuad);
        }
      } else {
        // the hero: snap back to centric, open; close on the word, the card's edge rising over it at the click
        const tSnap = p.t0, tOpen = p.t0 + 0.08;
        this.psi.to(tSnap, tOpen, 0, ease.outCubic);
        if (pass === 0) { this.tx.to(tSnap, tOpen, 0, ease.outCubic); this.tz.to(tSnap, tOpen, 0, ease.outCubic); }
        const closed: Pose = { psi: 0, theta: 0, tx: 0, ty: 0, tz: 0 };
        const top = gs[gs.length - 1]!;
        const tu = 0.5 * (top.u0 + top.u1), tv = top.v1 + MARGIN;
        const el = bisect((e) => { this.placeCam(p, closed, p.cam.phi, e); return faceLit(closed, p.pos0!, tu, tv); }, -12 * DEG, 16 * DEG);
        if (el === null) warn.push(`pitch cam ${top.txt}`);
        this.placeCam(p, closed, p.cam.phi, el ?? 0);
        const thAt = (u: number, v: number) => (th: number) => faceLit({ ...closed, theta: th }, p.pos0!, u, v);
        const th0 = bisect(thAt(0.5 * (gs[0]!.u0 + gs[0]!.u1), gs[0]!.v0 - MARGIN), 0, 0.2) ?? 0.02;
        const thOpen = Math.max(th0 + 0.006, 4.5 * DEG);
        this.theta.to(tSnap, tOpen, thOpen, ease.outCubic);
        gs.forEach((g, i) => {
          const [tS] = keyT(g);
          const tE = tS + 0.11;
          const thS = i === 0 ? th0 + 0.003 : null;
          const thE = i === gs.length - 1 ? 0 : bisect(thAt(0.5 * (g.u0 + g.u1), g.v1 + MARGIN), 0, 0.2) ?? 0;
          if (thS !== null) this.theta.to(Math.max(tOpen, tS - 0.12), tS, thS, ease.inOutQuad);
          this.theta.to(tS, tE, thE, ease.inCubic);   // accelerating into the stop: the click
          this.clicks.push(tE);
        });
        if (p.release) {
          // GO: the upper member lifts off its condyles still mirroring the card, then swings away out of frame
          this.lift.to(131.3, 131.58, 160, ease.inCubic);
          this.swing.to(131.42, 131.6, 0.5, ease.inCubic);
        }
      }
    }
    if (pass === 1 && warn.length) console.warn('articulator solve:', warn.join('; '));
  }

  private phraseAt(t: number) { return this.phrases.find((p) => t >= p.t0 && t < p.t1) ?? (t < this.phrases[0]!.t0 ? this.phrases[0]! : this.phrases[this.phrases.length - 1]!); }

  /** The engraving as the shader reads it. A word is cut into the canvas from its lead-in (start - 45 ms): before
   *  that it could not be read anyway (black fill in an unlit face), and the frame checker sees what is drawn.
   *  Redrawn every frame so the checker sees the lyric on every frame it is up. */
  private draw(p: Phrase, t: number) {
    const c = this.cv.getContext('2d')!;
    c.fillStyle = '#000'; c.fillRect(0, 0, CV_W, CV_H);
    const ppm = CV_W / (2 * RIG.FHW);
    const X = (u: number) => (u + RIG.FHW) * ppm, Yc = (v: number) => (RIG.FHH - v) * ppm;
    c.textBaseline = 'alphabetic';
    for (const g of p.glyphs) {
      if (t < g.w.start - 0.045) continue;
      c.font = font(g.fam, g.em * ppm);
      c.fillStyle = g.wax ? 'rgb(255,255,0)' : 'rgb(255,0,0)';
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
    const M = poseMatrix(pose);
    (u.upInv!.value as THREE.Matrix4).copy(M).invert();
    u.upLift!.value = this.lift.at(t) + 120 * this.swing.at(t);
    const { at, pos } = this.camAt(p, t, pose);
    const fw = at.clone().sub(pos).normalize();
    const rt = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(rt, fw);
    (u.camPos!.value as THREE.Vector3).copy(pos);
    (u.camF!.value as THREE.Vector3).copy(fw);
    (u.camR!.value as THREE.Vector3).copy(rt);
    (u.camU!.value as THREE.Vector3).copy(up);
    u.tanH!.value = p.cam.Hf / 2 / p.cam.D;
    u.marksK!.value = this.marksC.at(t);
    const kp = u.keyPos!.value as THREE.Vector3;
    (u.keyDir!.value as THREE.Vector3).copy(new THREE.Vector3(0, -5, -20).sub(kp).normalize());
    u.keyRef!.value = kp.length();
    this.march.render(renderer, this.rt);
    const fp = facePoint(pose, p.tgt![0], p.tgt![1]);
    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = fp.sub(pos).dot(fw);
    d.aper!.value = p.cam.aper;
    d.maxCoc!.value = 14;
    this.dof.render(renderer, out);
    // the clicks: the pin seating on its table jolts the frame (a mechanical source), dying in a few frames
    let sh = 0;
    for (const c of this.clicks) if (t >= c) sh = Math.max(sh, 3.0 * Math.exp(-(t - c) / 0.035) * (t - c < 0.2 ? 1 : 0));
    return { bloom: 0, halation: 0.04, shake: [0, sh] };
  }
}

