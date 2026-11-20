// Plate 9 `pour` — chorus 2, first half (103.98 – 117.79), docs/TEETH2.md. Ray-marched (pour-glsl.ts), then a
// depth-of-field gather; grain, cold halation and vignette come from the timeline's shared post.
//
//  THE POUR (103.98 – "teeth"). An upper impression in a perforated stainless tray, on a dental vibrator (painted body,
//  dial, switch, ribbed rubber platform); alginate lines the tray and the wet yellow stone fills it (scope guard: no
//  pouring ribbon, the stone is already in). The plate opens on the match cut from `voice`: level and low across the
//  wet stone to the tray's straight back wall (the clipped wave's flat top), then pulls up and out to the tray. Every
//  stomp sends a viscous shiver over the wet surface and a judder through the tray; bubbles rise and burst. Each
//  phrase's words rise out of the stone along the arch and harden from gloss to matt by the word's end; the tender
//  words (sweet, pretty) are wax pink set into the yellow. On "heart got" the whole surface sets, gloss to matt, in
//  one wave across the tray.
//  THE CAST (from "teeth", a hard cut: the time jump is the cut; the lamp swings onto the cast and flares). The cast
//  turned out, teeth up (the kit's sdCast), on its poured base, stone crumbs on the dark bench, macro depth of field,
//  the chip on #8. TEETH raised on the base's front.
//  "Late night devil, put your hands on me": the cast sits still under one low raking lamp that crosses it on each
//  word; the words rise wet on the base and harden one by one, HANDS last.
//  "never, never, never ever let go": the base held by the glove against a spinning model trimmer, a burst of stone
//  dust off the wheel on each "never"; on "let go" the wheel stops dead (its smeared rings resolve into grit) and the
//  dust settles; GO raised large on the base's front.
//  Heroes (SWEET, TEETH, HANDS, GO) rise shallow in a light weight up to 0.4 s ahead and snap to heavy, full height,
//  on their onset, letters locked in place.
//
// No label in the plate (the cast is unlabelled, docs/TEETH2.md clue ledger). Nothing glows: lit stone runs through a
// soft shoulder (pour-glsl softL) and stays under the bloom threshold.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, lerp, smoothstep } from '../../engine/util';
import type { Line, Word } from '../../engine/lyrics';
import { TeethTex, HIS } from '../teeth';
import { DOF_FRAG, MARCH_FRAG, POUR } from './pour-glsl';

/** A row of a phrase as set in relief: word indices (into the phrase), cap height (mm), family, wax; `light` is the
 *  hero's light weight (it rises in it before its onset and snaps to `fam` on it). */
interface Row { idx: number[]; cap: number; fam: string; wax?: boolean; lower?: boolean; light?: string }
interface Phrase { words: Word[]; rows: Row[]; surf: 'A' | 'B'; t0: number; t1: number; key: string; hero: number; dry: 'word' | 'hero' | 'none' }

const CANVAS_W = 2048, CANVAS_H = 1024;
/** Letters spring up this far ahead of the sung onset; a hero shows (light, shallow) at most this far ahead. */
const LEAD = 0.045, HERO_PRE = 0.38;

interface Shot {
  t0: number; pos0: number[]; pos1: number[]; at0: number[]; at1: number[]; fov: number; aper: number;
  focus?: number[]; focusAt?: boolean; ease?: (x: number) => number;
}
interface Mote { p: THREE.Vector3; v: THREE.Vector3; r: number; a: number; born: number }

/** The trimmer wheel's spin (rad/s about +z, about 1400 rpm): the face runs up past the cast (wheel centre at -x). */
const OMEGA = 150;

const num = (q: URLSearchParams | null, k: string, d: number) => { const v = q?.get(k); return v != null && v !== '' ? +v : d; };
/** A deterministic hash in [0, 1). */
const rnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

export default class Pour extends Scene {
  private tt!: TeethTex;
  private march!: FSPass;
  private dof!: FSPass;
  private rt = makeRT();
  private cv!: HTMLCanvasElement;
  private wordTex!: THREE.CanvasTexture;
  private drawn = '';
  private phrases: Phrase[] = [];
  private beats: number[] = [];
  /** the bars' downbeats in the window */
  private D: number[] = [];
  /** the cut on "teeth"; the start of "heart" (the set front); the trimmer's start and its dead stop ("let") */
  private tCut = 0;
  private tSet = 0;
  private tTrim = 0;
  private tStop = 0;
  private tGo = 0;
  private nevers: number[] = [];
  private L3words: Word[] = [];
  private shotList: Shot[] = [];

  override init() {
    this.tt = new TeethTex(HIS);
    this.cv = document.createElement('canvas');
    this.cv.width = CANVAS_W; this.cv.height = CANVAS_H;
    this.wordTex = new THREE.CanvasTexture(this.cv);
    this.wordTex.colorSpace = THREE.NoColorSpace;
    this.wordTex.minFilter = THREE.LinearFilter;
    this.wordTex.magFilter = THREE.LinearFilter;
    this.wordTex.generateMipmaps = false;
    const v3 = () => new THREE.Vector3();
    const v4s = () => Array.from({ length: POUR.NDUST }, () => new THREE.Vector4());
    this.march = new FSPass(MARCH_FRAG, {
      ssTap: SS_TAP, teethTex: { value: this.tt.texture },
      camPos: { value: v3() }, camR: { value: v3() }, camU: { value: v3() }, camF: { value: v3() }, tanH: { value: 0.3 },
      mode: { value: 0 }, time: { value: 0 },
      wordTex: { value: this.wordTex }, wordRect: { value: new THREE.Vector4() }, wordDepth: { value: 0.8 }, skirtK: { value: 0 },
      wRise: { value: new Array(8).fill(0) }, wWet: { value: new Array(8).fill(0) },
      trayOff: { value: v3() }, setP: { value: 0 }, wetAll: { value: 1 }, shiverA: { value: 0 },
      lampPos: { value: v3() }, lampDir: { value: v3() }, lampI: { value: 1 }, lampCone: { value: 0.9 }, lampRef: { value: 300 }, keyK: { value: 2.4 },
      tubeP: { value: v3() }, tubeI: { value: 1 }, fillK: { value: 0.05 }, topK: { value: 0.0 }, castOff: { value: v3() },
      trim: { value: 0 }, spinA: { value: 0 }, spinBlur: { value: 0 },
      hTip: { value: v3() }, hE1: { value: v3() }, hE2: { value: v3() }, hE3: { value: v3() }, handOn: { value: 0 },
      dustP: { value: v4s() }, dustV: { value: v4s() }, dustN: { value: 0 },
    });
    this.dof = new FSPass(DOF_FRAG, { src: { value: null }, focusD: { value: 100 }, aper: { value: 10 }, maxCoc: { value: 18 } });
    const { start, end, audio } = this.ctx;
    this.beats = audio.beats.filter((b) => b > start - 2 && b < end + 1);
    this.D = audio.downbeats.filter((b) => b >= start - 0.02 && b < end - 0.05);
    if (this.D.length < 8) throw new Error(`pour: expected 8 bars in the window, found ${this.D.length}`);
    this.buildPhrases();
    this.shotList = this.buildShots();
  }

  // ------------------------------------------------------------------ the phrases
  private buildPhrases() {
    const { start, end, lyrics } = this.ctx;
    const line = (q: string): Line => {
      const l = lyrics.find(q).find((x) => x.start >= start - 0.2 && x.start < end);
      if (!l) throw new Error(`pour: lyric not found in window: ${q}`);
      return l;
    };
    const sup = F.archivo(100, 700), hero = F.archivo(75, 900), heroL = F.archivo(75, 300);
    const wax = F.serif(600, true), waxH = F.serif(700, true), waxL = F.serif(300, true);
    const L1 = line('Fight so dirty'), L2 = line('Talk so pretty'), L3 = line('Late night devil'), L4 = line('never ever let go');
    this.tCut = L2.words[7]!.start;   // "teeth"
    this.tSet = L2.words[5]!.start;   // "heart"
    this.L3words = L3.words;
    this.nevers = L4.words.filter((w) => /^never/i.test(w.w)).map((w) => w.start);
    this.tStop = L4.words[5]!.start;  // "let"
    this.tGo = L4.words[6]!.start;    // "go"
    this.tTrim = this.D.find((d) => d >= L4.start - 0.25) ?? L4.start;
    const mk = (l: Line, ids: number[], rows: Row[], surf: 'A' | 'B', hero = -1, dry: Phrase['dry'] = surf === 'A' ? 'word' : 'none'): Phrase =>
      ({ words: ids.map((i) => l.words[i]!), rows, surf, t0: 0, t1: 0, key: `${l.i}:${ids.join(',')}:${surf}`, hero, dry });
    const R = (idx: number[], cap: number, fam = sup, w = false, light?: string): Row => ({ idx, cap, fam, wax: w, lower: w, light });
    const list: Phrase[] = [
      // the pour: along the arch, in the trough (about 14 mm wide)
      mk(L1, [0, 1, 2], [R([0, 1, 2], 6.0)], 'A'),
      mk(L1, [3, 4, 5], [R([0, 1, 2], 6.0)], 'A'),
      mk(L1, [6, 7], [R([0], 2.6), R([1], 7.4, waxH, true, waxL)], 'A', 1),
      mk(L2, [0, 1, 2], [R([0, 1], 3.0), R([2], 6.0, wax, true)], 'A'),
      mk(L2, [3, 4], [R([0, 1], 6.5)], 'A'),
      mk(L2, [5, 6], [R([0, 1], 8.0, hero)], 'A'),
      // the cast: on the poured base's front (about 13 mm high); TEETH alone ("heart got" stayed with the pour)
      mk(L2, [7], [R([0], 6.4, hero)], 'B', 0),
      mk(L3, [0, 1, 2], [R([0, 1, 2], 4.4)], 'B', -1, 'word'),
      mk(L3, [3, 4, 5], [R([0, 1], 2.6), R([2], 6.8, hero, false, heroL)], 'B', 2, 'hero'),
      mk(L3, [6, 7], [R([0, 1], 5.0)], 'B', -1, 'word'),
      mk(L4, [0, 1, 2], [R([0, 1, 2], 4.0)], 'B'),
      mk(L4, [3, 4], [R([0, 1], 4.6)], 'B'),
      mk(L4, [5, 6], [R([0], 2.6), R([1], 8.2, hero, false, heroL)], 'B', 1),
    ];
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!;
      p.t0 = Math.max(start, p.words[0]!.start - LEAD);
      if (p.surf === 'B' && list[i - 1]?.surf === 'A') p.t0 = this.tCut;
    }
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!, nx = list[i + 1];
      const lineEnd = p.words[0]!.line === nx?.words[0]!.line ? null : lyrics.lines[p.words[0]!.line]!.end;
      if (nx && lineEnd === null) p.t1 = nx.t0;
      else {
        p.t1 = this.beats.find((b) => b > (lineEnd ?? p.words[p.words.length - 1]!.end) + 0.02) ?? end;
        if (nx) p.t1 = Math.min(p.t1, nx.t0);
      }
    }
    this.phrases = list;
  }
  private phraseAt(t: number) { return this.phrases.find((p) => t >= p.t0 && t < p.t1) ?? null; }
  /** When a phrase's word first shows: its letters' lead, or (the hero) its light, shallow pre-show. */
  private showAt(p: Phrase, i: number) {
    const w = p.words[i]!;
    if (p.surf === 'B' && p.t0 === this.tCut) return p.t0;
    return i === p.hero ? Math.max(p.t0, w.start - HERO_PRE) : Math.max(p.t0, w.start - LEAD);
  }

  /** Set the phrase into the word canvas: r = the letters (crisp), g = the letters widely blurred (the meniscus foot),
   *  b = ((index + 1) * 2 + wax) * 10, unblurred and dilated past the foot (pour-glsl wordAt). Only the words already
   *  showing are set (the layout is the whole phrase's, so nothing reflows); a hero before its onset is set in its
   *  light weight on the heavy weight's letter positions. */
  private drawPhrase(p: Phrase | null, t: number) {
    let key = '-';
    let shown = 0, light = false;
    if (p) {
      shown = p.words.filter((_, i) => t >= this.showAt(p, i)).length;
      light = p.hero >= 0 && t < p.words[p.hero]!.start && t >= this.showAt(p, p.hero);
      key = `${p.key}:${p.words.map((_, i) => (t >= this.showAt(p, i) ? 1 : 0)).join('')}:${light ? 'L' : 'H'}`;
    }
    if (key === this.drawn) return;
    this.drawn = key;
    const c = this.cv.getContext('2d')!;
    c.globalCompositeOperation = 'source-over';
    c.filter = 'none';
    c.textAlign = 'left';
    c.fillStyle = '#000';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (p && shown > 0) {
      const rect = p.surf === 'A' ? POUR.RECT_A : POUR.RECT_B;
      const ppm = CANVAS_W / rect[2];
      const maxW = (rect[2] - 4) * ppm;
      const capK = (r: Row) => (r.wax ? 0.42 : 0.715); // x-height for the wax italic (lowercase), cap height otherwise
      const rows = p.rows.map((r) => {
        const txt = r.idx.map((i) => this.label(p.words[i]!, r));
        let em = (r.cap * ppm) / capK(r);
        c.font = font(r.fam, em);
        const gapF = 0.3;
        const width = () => txt.reduce((a, s) => a + c.measureText(s).width, 0) + gapF * em * (txt.length - 1);
        const w0 = width();
        if (w0 > maxW) { em *= maxW / w0; c.font = font(r.fam, em); }
        return { r, txt, em, w: width(), cap: em * capK(r), gap: gapF * em };
      });
      const lead = (a: (typeof rows)[number], b: (typeof rows)[number]) => 0.4 * Math.min(a.cap, b.cap) + (b.r.wax ? 0.3 * b.cap : 0);
      let total = rows.reduce((a, r) => a + r.cap, 0);
      for (let i = 1; i < rows.length; i++) total += lead(rows[i - 1]!, rows[i]!);
      let y = (CANVAS_H - total) / 2;
      for (let k = 0; k < rows.length; k++) {
        const row = rows[k]!;
        if (k > 0) y += lead(rows[k - 1]!, row);
        const base = y + row.cap;
        c.textBaseline = 'alphabetic';
        let x = (CANVAS_W - row.w) / 2;
        row.r.idx.forEach((wi, j) => {
          const s = row.txt[j]!;
          const heavy = font(row.r.fam, row.em);
          c.font = heavy;
          const adv = c.measureText(s).width;
          if (t >= this.showAt(p, wi)) {
            const code = ((wi + 1) * 2 + (row.r.wax ? 1 : 0)) * 10;
            // the glyphs: whole in the heavy weight; one by one, centred on the heavy weight's places, in the light one
            const glyphs: { ch: string; cx: number }[] = [];
            const isLight = light && wi === p.hero && !!row.r.light;
            if (isLight) for (let g = 0; g < s.length; g++) {
              const x0 = c.measureText(s.slice(0, g)).width, wg = c.measureText(s[g]!).width;
              glyphs.push({ ch: s[g]!, cx: x + x0 + wg / 2 });
            }
            const paint = (fill: boolean, stroke: boolean) => {
              if (isLight) {
                c.font = font(row.r.light!, row.em); c.textAlign = 'center';
                for (const g of glyphs) { if (stroke) c.strokeText(g.ch, g.cx, base); if (fill) c.fillText(g.ch, g.cx, base); }
                c.textAlign = 'left'; c.font = heavy;
              } else { if (stroke) c.strokeText(s, x, base); if (fill) c.fillText(s, x, base); }
            };
            c.globalCompositeOperation = 'lighten';
            c.filter = 'none';
            c.fillStyle = c.strokeStyle = `rgb(0,0,${code})`;
            c.lineWidth = 40; c.lineJoin = 'round';
            paint(true, true);
            c.globalCompositeOperation = 'lighter';
            const fat = p.surf === 'B' ? 7 : 0;   // the cast's letters dilated to HEART's wet, meniscus-fattened weight
            c.lineWidth = fat; c.lineJoin = 'round';
            c.filter = 'blur(2px)'; c.fillStyle = c.strokeStyle = 'rgb(255,0,0)'; paint(true, !!fat);
            c.filter = 'blur(9px)'; c.fillStyle = c.strokeStyle = 'rgb(0,255,0)'; paint(true, !!fat);
          }
          x += adv + row.gap;
        });
        y = base;
      }
    }
    c.globalCompositeOperation = 'source-over';
    c.filter = 'none';
    this.wordTex.needsUpdate = true;
  }
  private label(w: Word, r: Row) {
    const s = w.w.replace(/[,.!?]/g, '');
    return r.lower ? s.toLowerCase() : s.toUpperCase();
  }

  // ------------------------------------------------------------------ the camera
  private buildShots(): Shot[] {
    const D = this.D, SURF = POUR.SURF;
    return [
      // the match cut from `voice`: level and low across the wet stone to the tray's straight back wall (the clipped
      // wave's flat top), then up and out to the vibrator and the tray from the front-right
      { t0: D[0]!, pos0: [0, SURF + 12, 10], pos1: [-55, 96, -122], at0: [0, 0, 53.7], at1: [0, 2, 14], fov: 30, aper: 6, focusAt: true,
        ease: (x) => ease.outCubic(clamp((x - 0.04) / 0.96)) },
      // the trough along the front of the arch
      { t0: D[1]!, pos0: [-26, 86, -72], pos1: [-12, 80, -64], at0: [0, 12, 8], at1: [0, 12, 8], fov: 30, aper: 9 },
      // lower, from the left
      { t0: D[2]!, pos0: [52, 58, -72], pos1: [40, 52, -66], at0: [0, 12, 8], at1: [0, 12, 8], fov: 30, aper: 9 },
      // "heart got": high and close over the words, the set front crossing
      { t0: D[3]!, pos0: [24, 108, -98], pos1: [20, 102, -90], at0: [-2, 6, 12], at1: [-2, 6, 12], fov: 30, aper: 8, focus: [0, 12, 2] },
      // THE CAST: macro, low three-quarter from the patient's right, the lamp raking from the left
      { t0: this.tCut, pos0: [-6, -2.5, -118], pos1: [-5, -3.0, -108], at0: [-3, -15, 4], at1: [-3, -15.5, 4], fov: 27, aper: 14, focus: [-4, 0, -2] },
      // "Late night devil": from the left, low; "put your hands": from the right, closing in on the base
      { t0: D[4]!, pos0: [70, 6, -110], pos1: [56, 2, -112], at0: [0, -15, 10], at1: [0, -15, 10], fov: 26, aper: 14, focus: [0, -14, -6] },
      { t0: D[5]!, pos0: [-58, 24, -100], pos1: [-40, 12, -98], at0: [0, -16, 8], at1: [-2, -18, 4], fov: 26, aper: 14, focus: [0, -20, -12] },
      // THE TRIMMER: the cast held to the wheel by the glove (frame left), three-quarter from the right, the wheel behind
      { t0: D[6]!, pos0: [-104, 26, -128], pos1: [-90, 18, -118], at0: [-6, -6, 14], at1: [-6, -9, 12], fov: 30, aper: 7, focus: [-4, -22, -12] },
      // the third "never": from the right, low along the wheel's face, the dust coming at the lens
      { t0: this.nevers[2]!, pos0: [-118, 2, -60], pos1: [-108, -2, -56], at0: [0, -10, 36], at1: [0, -11, 36], fov: 28, aper: 9, focus: [-12, -16, 36] },
      // "never ever": low and square, the wheel filling the ground behind the teeth; it stops dead on "let"
      { t0: D[7]!, pos0: [-8, -14, -150], pos1: [-6, -15, -138], at0: [-6, 2, 30], at1: [-5, 1, 30], fov: 30, aper: 8, focus: [0, -23, -13] },
      // "go": the cut onto the base's front, macro, the dust settling
      { t0: this.tGo, pos0: [5, -17, -74], pos1: [3, -19, -67], at0: [1, -20, 10], at1: [0, -21, 10], fov: 26, aper: 12, focus: [0, -23, -13] },
    ];
  }
  private shotAt(t: number) {
    const S = this.shotList;
    let i = 0;
    while (i < S.length - 1 && t >= S[i + 1]!.t0) i++;
    return { s: S[i]!, t1: S[i + 1]?.t0 ?? this.ctx.end };
  }
  private camera(t: number) {
    const { s, t1 } = this.shotAt(t);
    const x = clamp((t - s.t0) / Math.max(0.1, t1 - s.t0));
    const k = s.ease ? s.ease(x) : ease.outCubic(x);
    const L = (a: number[], b: number[]) => new THREE.Vector3(lerp(a[0]!, b[0]!, k), lerp(a[1]!, b[1]!, k), lerp(a[2]!, b[2]!, k));
    const at = L(s.at0, s.at1);
    return { pos: L(s.pos0, s.pos1), at, fov: s.fov, aper: s.aper, focus: s.focus ? new THREE.Vector3(...s.focus) : s.focusAt ? at.clone() : null };
  }

  // ------------------------------------------------------------------ the trimmer's dust
  /** The motes in the air at t: bursts off the wheel on each "never", a trickle while the base is held to it; after the
   *  dead stop nothing new, the fines settling (drag plus a slow terminal fall). Newest first, at most NDUST. */
  private motes(t: number): Mote[] {
    const out: Mote[] = [];
    const W = new THREE.Vector2(POUR.WCX, POUR.WCY);
    const spawns: { t: number; i: number; burst: boolean }[] = [];
    let n = 0;
    for (const b of this.nevers) for (let j = 0; j < 22; j++) spawns.push({ t: b + 0.012 * j * rnd(n, 9), i: n++, burst: true });
    for (let te = this.tTrim + 0.04; te < this.tStop; te += 0.045) spawns.push({ t: te, i: n++, burst: false });
    spawns.sort((a, b) => b.t - a.t);
    const SH = 1 / 120;
    for (const s of spawns) {
      const tau = t - s.t;
      if (tau < 0 || tau > 3.0) continue;
      const i = s.i;
      const o = new THREE.Vector3(lerp(-24, 24, rnd(i, 1)), lerp(POUR.PB + 1.5, POUR.PTOP - 1.0, rnd(i, 2)), POUR.ZF - 1.0);
      // the wheel's surface velocity at the contact (it turns so the face moves up past the cast), fanned
      const rel = new THREE.Vector2(o.x - W.x, o.y - W.y);
      const tang = new THREE.Vector2(-rel.y, rel.x).multiplyScalar(Math.sign(OMEGA)).normalize();
      const fan = (rnd(i, 3) - 0.5) * 0.8;
      const dir2 = tang.clone().rotateAround(new THREE.Vector2(), fan);
      const fine = !s.burst || rnd(i, 4) < 0.45;
      const sp = fine ? lerp(250, 800, rnd(i, 5)) : lerp(900, 2400, rnd(i, 5));
      const vz = -lerp(0.15, 0.8, rnd(i, 6));
      const v0 = new THREE.Vector3(dir2.x, dir2.y, vz).normalize().multiplyScalar(sp);
      const k = fine ? lerp(9, 15, rnd(i, 7)) : lerp(3, 6, rnd(i, 7));
      const vt = fine ? lerp(22, 60, rnd(i, 8)) : lerp(350, 700, rnd(i, 8));
      const e = (1 - Math.exp(-k * tau)) / k;
      const p = o.clone().addScaledVector(v0, e);
      p.y -= vt * (tau - e);
      const r = fine ? lerp(0.14, 0.3, rnd(i, 10)) : lerp(0.25, 0.55, rnd(i, 10));
      if (p.y < POUR.PB + r) continue;   // landed: lost in the dust on the table
      const vel = v0.clone().multiplyScalar(Math.exp(-k * tau));
      vel.y -= vt * (1 - Math.exp(-k * tau));
      out.push({ p, v: vel.multiplyScalar(SH), r, a: fine ? 0.7 : 0.95, born: s.t });
      if (out.length >= POUR.NDUST) break;
    }
    return out;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer } = this.ctx;
    const u = this.march.u;
    const castMode = t >= this.tCut;
    const trimOn = t >= this.tTrim;
    // query overrides for framing work: ?pcam=x,y,z,ax,ay,az,fov,aper
    const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    const C = this.camera(t);
    const qc = qs?.get('pcam')?.split(',').map(Number);
    if (qc && qc.length >= 6) { C.pos.set(qc[0]!, qc[1]!, qc[2]!); C.at.set(qc[3]!, qc[4]!, qc[5]!); if (qc[6]) C.fov = qc[6]; if (qc[7]) C.aper = qc[7]; }
    const fw = C.at.clone().sub(C.pos).normalize();
    const rt = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(rt, fw);
    (u.camPos!.value as THREE.Vector3).copy(C.pos);
    (u.camF!.value as THREE.Vector3).copy(fw);
    (u.camR!.value as THREE.Vector3).copy(rt);
    (u.camU!.value as THREE.Vector3).copy(up);
    u.tanH!.value = Math.tan((C.fov * Math.PI) / 360);
    u.mode!.value = castMode ? 1 : 0;
    u.time!.value = t;

    // the words
    const p = this.phraseAt(t);
    this.drawPhrase(p, t);
    const { s: shot } = this.shotAt(t);
    if (castMode) {
      // turn the word on the base to face the shot's lens (constant per shot, so it never slides over the stone)
      const th = Math.atan2(shot.pos1[0]!, POUR.CEN - shot.pos1[2]!);
      const sc = -th * POUR.RB * 0.85;
      const r = POUR.RECT_B;
      (u.wordRect!.value as THREE.Vector4).set(r[0] + sc, r[1], r[2], r[3]);
    } else {
      const r = POUR.RECT_A;
      (u.wordRect!.value as THREE.Vector4).set(r[0], r[1], r[2], r[3]);
    }
    // one relief for every word in the plate: Archivo risen out of the stone, a soft shoulder and a meniscus foot
    u.wordDepth!.value = 0.7;
    u.skirtK!.value = 1.0;
    const rise = u.wRise!.value as number[], wet = u.wWet!.value as number[];
    rise.fill(0); wet.fill(0);
    if (p) {
      p.words.forEach((w, i) => {
        let r: number;
        if (p.surf === 'B' && p.t0 === this.tCut) r = 1;
        else if (i === p.hero) {
          // the hero: shallow in its light weight ahead of the onset, snapping to full height (heavy) on it
          const pre = this.showAt(p, i);
          r = t < w.start ? 0.42 * ease.outCubic(clamp((t - pre) / 0.18)) : lerp(0.42, 1, ease.outCubic(clamp((t - w.start) / 0.09)));
        } else r = ease.outCubic(clamp((t - (w.start - LEAD)) / 0.22));
        if (p.surf === 'A') r *= 1 - smoothstep(p.t1 - 0.1, p.t1, t); // sinks back into the wet stone as the next phrase comes
        rise[i] = r;
        if (p.dry === 'word') wet[i] = 1 - smoothstep(w.start, w.end, t);
        else if (p.dry === 'hero') wet[i] = 1 - smoothstep(w.start, i === p.hero ? p.t1 - 0.05 : w.end, t);   // HANDS hardens last
      });
    }

    // the stomps: a viscous shiver over the surface and a judder through the tray, both dying fast
    let lastB = -10;
    for (const b of this.beats) if (b <= t && b >= this.ctx.start - 0.01) lastB = b;
    const kick = Math.pow(0.5, (t - lastB) / 0.07);
    const vib = kick * 0.16 + 0.02;
    (u.trayOff!.value as THREE.Vector3).set(vib * Math.sin(t * 2 * Math.PI * 47.3), 0, vib * Math.cos(t * 2 * Math.PI * 51.7));
    u.shiverA!.value = 0.35 + 1.1 * kick;
    u.setP!.value = ease.inOutQuad(clamp((t - this.tSet) / (this.tCut - 0.08 - this.tSet)));
    u.wetAll!.value = 1;

    const lp = u.lampPos!.value as THREE.Vector3;
    let aim: THREE.Vector3;
    let exposure = 1;
    if (!castMode) {
      // one low raking key (frame right), so the shiver, the bubbles and the relief read; the tube behind for the wet
      lp.set(num(qs, 'lax', -400), num(qs, 'lay', 92), -70);
      aim = new THREE.Vector3(0, 10, 15);
      (u.tubeP!.value as THREE.Vector3).set(0, 520, 470);
      u.lampI!.value = 1.0; u.tubeI!.value = 0.35; u.fillK!.value = 0.018; u.topK!.value = 0.0; u.keyK!.value = num(qs, 'kk', 3.4);
      u.lampCone!.value = 0.8;
    } else {
      const ev = t - this.tCut;
      // the camera's azimuth (lamp az convention: (cos az, -sin az) on the bench)
      const azCam = Math.atan2(-C.pos.z, C.pos.x);
      let az: number;
      if (t < this.D[4]!) {
        // the light event on the cut: the lamp swings onto the cast from the front and flares, settling low and raking
        az = lerp(1.55, num(qs, 'lang', 0.35), ease.outCubic(clamp(ev / 0.2)));
      } else if (t < this.tTrim) {
        // "Late night devil, put your hands on me": the raking lamp crosses the cast on each word, side to side
        let x = 0;
        this.L3words.forEach((w) => { x += ease.inOutCubic(clamp((t - w.start + 0.04) / 0.28)); });
        // x counts the crossings made (fractional mid-crossing): even = from one side of the lens, odd = the other
        az = azCam + 1.15 * Math.cos(Math.PI * x);
      } else {
        // the trimmer: a key from the front-left, high enough to catch the wheel's face, the glove and the hood; on the
        // "go" macro it drops low and raking across the base so the relief reads
        az = t >= this.tGo ? 0.6 : 1.25;
      }
      lp.set(300 * Math.cos(az), POUR.PB + num(qs, 'ly', 38), -300 * Math.sin(az));
      aim = new THREE.Vector3(0, -15, 12);
      (u.tubeP!.value as THREE.Vector3).set(0, 600, 300);
      u.lampI!.value = num(qs, 'li', 1.0) + 0.9 * Math.exp(-ev / 0.05);
      u.tubeI!.value = 0.3; u.fillK!.value = 0.012; u.topK!.value = num(qs, 'top', 0.05); u.keyK!.value = num(qs, 'kk', 1.2);
      u.lampCone!.value = 0.72;
      if (trimOn) { lp.y = POUR.PB + (t >= this.tGo ? 40 : 70); u.lampCone!.value = 0.6; u.topK!.value = 0.08; }
      exposure = 1 + 0.3 * Math.exp(-ev / 0.06);
    }
    (u.lampDir!.value as THREE.Vector3).copy(aim.clone().sub(lp).normalize());
    u.lampRef!.value = lp.distanceTo(aim);
    // the cast set down: a few tenths of a mm of settle in the first frames after the cut
    const ds = castMode ? 0.5 * Math.pow(0.5, (t - this.tCut) / 0.03) : 0;
    (u.castOff!.value as THREE.Vector3).set(0, ds, 0);

    // the trimmer: the wheel spinning (smeared to rings over the shutter) until it stops dead on "let"; the glove
    // holding the base to it; the dust
    u.trim!.value = trimOn ? 1 : 0;
    u.handOn!.value = trimOn ? 1 : 0;
    const tRun = Math.min(t, this.tStop) - this.tTrim;
    const decel = clamp((t - this.tStop) / 0.06);   // the dead stop: 60 ms
    u.spinA!.value = trimOn ? (OMEGA * tRun + OMEGA * 0.03 * (1 - (1 - decel) * (1 - decel))) % (2 * Math.PI) : 0;
    u.spinBlur!.value = trimOn ? Math.abs(OMEGA) * (1 - decel) / 120 : 0;
    if (trimOn) {
      // the glove pinching the base's right edge (bench -x) and pressing it back to the wheel; GLSL_HAND's pen axis
      // runs from inside the stone out up to the right, so its fingertips straddle the edge
      const grip = new THREE.Vector3(42, -17.5, 16);
      const e1 = new THREE.Vector3(0.75, 0.55, -0.35).normalize();
      const e2 = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), e1).normalize();
      const e3 = new THREE.Vector3().crossVectors(e1, e2).normalize();
      // a press on each "never" (the base pushed to the wheel), easing off between
      let press = 0;
      for (const b of this.nevers) press = Math.max(press, Math.exp(-Math.max(0, t - b) / 0.18) * (t >= b - 0.05 ? 1 : 0));
      const tip = grip.clone().addScaledVector(e1, -30).add(new THREE.Vector3(0, 0, 0.6 * press));
      (u.hTip!.value as THREE.Vector3).copy(tip);
      (u.hE1!.value as THREE.Vector3).copy(e1);
      (u.hE2!.value as THREE.Vector3).copy(e2);
      (u.hE3!.value as THREE.Vector3).copy(e3);
      const ms = this.motes(t);
      const P = u.dustP!.value as THREE.Vector4[], V = u.dustV!.value as THREE.Vector4[];
      ms.forEach((m, i) => { P[i]!.set(m.p.x, m.p.y, m.p.z, m.r); V[i]!.set(m.v.x, m.v.y, m.v.z, m.a); });
      u.dustN!.value = ms.length;
    } else u.dustN!.value = 0;

    this.march.render(renderer, this.rt);
    const fp = C.focus ?? (castMode ? new THREE.Vector3(0, -14, -6) : new THREE.Vector3(0, POUR.SURF, 8));
    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = fp.clone().sub(C.pos).dot(fw);
    d.aper!.value = num(qs, 'aper', C.aper);
    d.maxCoc!.value = 16;
    this.dof.render(renderer, out);
    // nothing in this plate glows: no bloom (its soft knee haloed the lit stone against black), a trace of halation
    return { exposure, bloom: 0, halation: 0.05 };
  }
}
