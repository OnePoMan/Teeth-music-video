// Plate 5 `scale` — chorus 1, first half (48.73 – 62.54), docs/TEETH2.md. Bite-mark photography and the first stomp,
// shot in colour within palette 2A (a hard flash, true blacks). A GOLDEN apple in dental-stone yellow (a Golden
// Delicious: russet freckles and lenticels, greener toward the stem, a faint wax blush; the bite and the cast he pours
// in chorus 2 share the colour) stands stem up, one cold grey-green leaf on the stem, on film-black velvet, ONE BITE
// taken out of its shoulder (a crescent scooped into the pale cream flesh, its rim scalloped by his incisal edges with
// #8's chip a notch in the scallop; teeth.ts biteMark(HIS)). An ABFO No. 2 scale stands on the cloth beside it, its
// sticker the plate's one readable label (08-32 · EXHIBIT 4).
//
// LYRIC-LED CAMERA (docs/TEETH2.md, round 2). Each sung line is bitten, word by word as it is sung, along a band round
// the apple's equator (scale-bite.ts bakeLine: the whole line baked once; the kinetic kit poses every letter on it).
// The apple turns on its stand so the newest bite comes round into the frame's sweet spot, and ONE continuous camera
// move per line rides the band (kinetic.ts LyricPath: keyed by the words' places at their onsets, monotone, eased into
// the beats), pushing in on each hero's onset: the heroes are bitten big and deep, the supporting words shallow.
//   line 1 "Fight so dirty...": from the exhibit (the approved first flash: bite, ruler and label) the camera sinks
//          and swings round onto the band, pushing in on DIRTY and on SWEET (wax pink, Cormorant: the approved 51.50).
//   line 2 "Talk so pretty...": low from the left, it tracks the band and rises, pushing in on PRETTY and onto TEETH
//          (the approved 55.00); TEETH then slams full-frame (the hook's first statement, a bite out of its H).
//   line 3 "Late night devil...": from above, descending as it rides; DEVIL leans further each beat.
//   line 4 "And never, never...": low, rising; each NEVER lands wider and condenses (each copy narrower); GO, biggest.
// The stomp is the shutter: every beat a flash (the head overshoots, an exposure kick, a few pixels of shake) inside
// the continuing shot. Cuts only between lines, on the next line's first bite (and the TEETH slam and back).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, SS_TAP, makeRT, W as FW, H as FH } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, lerp, pulse, springStep } from '../../engine/util';
import { trgba } from '../palette';
import { KinClock, KinWord, KIN_MAX, LyricPath, drawKin, kinShake, packKin, type KinPose, type Moves } from '../kinetic';
import { DOF_FRAG, LAY, LN_G, LN_W, MARCH_FRAG } from './scale-glsl';
import { bakeLine, toothSpans, type BandLine } from './scale-bite';

const LABEL = '08-32 · EXHIBIT 4';

/** The band: its middle over the apple's centre and the radius its arc length is measured at (mm). */
const HB = -2, RB = 39;
/** Cap heights (mm): supporting words, heroes, SWEET (Cormorant lowercase: its x-height near a hero's cap), GO. */
const CAP = { sup: 5.5, hero: 12, serif: 15, go: 17 };
/** Bite depth (mm): supporting words shallow, heroes deep. */
const DEPTH = { sup: 1.3, hero: 2.3, go: 2.8 };

/** The hero words by line (word index in the line): DIRTY, SWEET; PRETTY, TEETH; DEVIL, HANDS; NEVER x3, GO. */
const HEROES: number[][] = [[2, 7], [2, 7], [2, 5], [1, 2, 3, 6]];

/**
 * Each line's one move. D: the camera's distance (mm): at the cut, at each word's onset, and at the hold (never
 * growing: the move only pushes in). a, el, roll, daz: the camera's azimuth and elevation round the apple, its roll,
 * and how far it stands off the newest word's normal (3/4), from the line's start to its end. psi0: the apple's turn
 * at the cut (0 = the bite square to the exhibit camera).
 */
interface Plan { D: number[]; a: [number, number]; el: [number, number]; roll: [number, number]; daz: [number, number]; psi0: number; wide?: boolean }
const PLANS: Plan[] = [
  { D: [172, 165, 150, 118, 114, 110, 106, 102, 78, 72], a: [0.5, 0.75], el: [0.62, 0.18], roll: [0, -0.02], daz: [0, 0.2], psi0: 0, wide: true },
  { D: [140, 134, 126, 106, 103, 100, 97, 94, 68, 62], a: [-0.3, 0.2], el: [0.02, 0.17], roll: [0.06, -0.02], daz: [-0.25, 0.3], psi0: 2.4 },
  { D: [140, 134, 126, 106, 102, 98, 88, 85, 82, 78], a: [-1.6, -1.0], el: [0.48, 0.12], roll: [0.1, 0.0], daz: [-0.2, 0.15], psi0: 1.0 },
  { D: [136, 128, 114, 106, 100, 96, 92, 64, 58], a: [-0.7, -0.2], el: [-0.04, 0.22], roll: [-0.06, 0.04], daz: [-0.3, 0.2], psi0: -0.6 },
];

interface LWord {
  text: string; key: string; start: number; end: number; hero: boolean; cap: number; depth: number; wax: boolean;
  /** the word's letters on the band (cells in mm along it) and its rest extent and centre */
  kw: KinWord; x0: number; x1: number; cx: number;
  /** which NEVER (1..3; 0 otherwise) */
  rep: number;
}
interface Line { k: number; t0: number; t1: number; words: LWord[]; band: BandLine; az0: number; path: LyricPath; plan: Plan }
/** A full-frame slam (kinetic.ts): the hero breaks out of the photograph as flat type, from t0 to the next line. */
interface Slam { t0: number; t1: number; land: number; kw: KinWord; teeth: boolean }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const AC = V(...LAY.AC);
/** A frame on the apple's flank (rest frame) at azimuth az (from +Z toward +X) and height h over its centre: the skin
 *  point C, its outward normal N, its tangent T (to the right, seen from outside), its up U. */
function flank(az: number, h: number, el = 0) {
  const N = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)), T = V(Math.cos(az), 0, -Math.sin(az));
  const U = new THREE.Vector3().crossVectors(N, T);
  // the body without its noise and wells (scale-glsl.ts appleBody): bisect outward along N
  const c = Math.cos(LAY.AROT), s = Math.sin(LAY.AROT);
  const body = (p: THREE.Vector3) => {
    const qx = p.x - AC.x, qy = p.y - AC.y, qz = p.z - AC.z;
    const lx = c * qx + s * qy, ly = -s * qx + c * qy;
    const hh = ly / LAY.AH;
    const rad = LAY.AR * (1 + 0.08 * hh - 0.06 * hh * hh) - 6.5 * Math.max(-hh, 0) ** 2;
    return Math.hypot(Math.hypot(lx, qz), (ly * LAY.AR) / LAY.AH) - rad;
  };
  const at = (k: number) => AC.clone().add(V(0, h, 0)).addScaledVector(N, k);
  let lo = 0, hi = 60;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (body(at(m)) > 0) hi = m; else lo = m; }
  return { C: at(lo), N, T, U };
}
// the bite sits on the apple's upper shoulder, facing up and out
const BITE0 = flank(LAY.BAZ, 0, LAY.BEL);
// the bite taken on the diagonal (as an apple is held): its arch turned in the plane, never a level mouth-like slot
const BITE = (() => {
  const a = 0.95, c = Math.cos(a), s = Math.sin(a);
  return { C: BITE0.C, N: BITE0.N, T: BITE0.T.clone().multiplyScalar(c).addScaledVector(BITE0.U, s), U: BITE0.U.clone().multiplyScalar(c).addScaledVector(BITE0.T, -s) };
})();
/** The scale: standing on the cloth to the right of the apple in the bite's plane (as the apple stood for the exhibit
 *  photograph; the apple turns, the scale stays), held on two black posts. */
const SO = BITE0.C.clone().addScaledVector(BITE0.T, 38).addScaledVector(BITE0.U, -34).addScaledVector(BITE0.N, 1.0);
const postAt = (u: number, v: number, back: number) => {
  const p = SO.clone().addScaledVector(BITE0.T, u).addScaledVector(BITE0.U, v).addScaledVector(BITE0.N, -back);
  return new THREE.Vector4(p.x, p.z, p.y - 4, 4);
};
const POSTS = [postAt(9, 6, 8), postAt(88, 6, 8)];
/** The exhibit's aim (the approved first flash): between the bitten apple and the scale. */
const EXHIBIT = BITE0.C.clone().addScaledVector(BITE0.T, 43).addScaledVector(BITE0.U, -4);
/** A direction at azimuth az (from +Z toward +X) and elevation el. */
const dirAz = (az: number, el: number) => V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
/** A rest-frame point turned with the apple by psi about its vertical axis. */
const turn = (p: THREE.Vector3, psi: number) => p.clone().sub(AC).applyAxisAngle(UP, psi).add(AC);

/** Look-development overrides from the page URL (render.ts --query sc_cam=...): sc_<name>=v1,v2,... */
const QP = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
function qv(name: string): number[] | null {
  const s = QP?.get('sc_' + name);
  return s ? s.split(',').map(Number) : null;
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, mips = false) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const tex = new THREE.CanvasTexture(cv);
  tex.generateMipmaps = mips;
  tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}
const v4s = (n: number) => Array.from({ length: n }, () => new THREE.Vector4());

export default class ScalePlate extends Scene {
  private march!: FSPass;
  private dof!: FSPass;
  private rt = makeRT();
  private lines: Line[] = [];
  private slams: Slam[] = [];
  private clk!: KinClock;
  private L = new Layer2D();
  private pk = new Float32Array(KIN_MAX * 12);

  override init() {
    const { lyrics, audio } = this.ctx;
    // the case sticker: Plex Mono, ink on transparent (the paper is shaded in the march); 29.8 x 8 mm
    const label = canvasTex(2048, Math.round((2048 * 8) / 29.8), (c) => {
      const fam = F.mono(500);
      let size = 200;
      c.font = font(fam, size);
      size = (size * 2048 * 0.86) / c.measureText(LABEL).width;
      c.font = font(fam, size);
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(LABEL, 1024, c.canvas.height * 0.52);
    });
    // the scale's cm numerals: Plex Mono digits, one per cell (64 x 106 px)
    const digits = canvasTex(640, 106, (c) => {
      c.font = font(F.mono(500), 128);
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (let k = 0; k < 10; k++) c.fillText(String(k), 32 + k * 64, 58, 60);
    }, true);
    const spans = toothSpans();
    const v4 = (a: number[][]) => a.map((s) => new THREE.Vector4(s[0], s[1], s[2], s[3]));
    this.clk = new KinClock(audio, { backbeat: true });

    // the lines: each baked along the band, each its own camera move
    const src = lyrics.linesIn(this.ctx.start, this.ctx.end).filter((l) => l.start < this.ctx.end - 0.1);
    src.forEach((l, k) => {
      const plan = PLANS[k] ?? PLANS[PLANS.length - 1]!;
      const heroes = HEROES[k] ?? [];
      let nev = 0;
      const ws = l.words.map((w, i) => {
        const text = w.w.replace(/'/g, '’').replace(/[^A-Za-z’]/g, '');
        const key = text.replace(/’/g, '').toLowerCase();
        const hero = heroes.includes(i);
        const wax = key === 'sweet', go = key === 'go';
        const rep = hero && key === 'never' ? ++nev : 0;
        return { text, key, start: w.start, end: w.end, hero, wax, go, rep };
      });
      const band = bakeLine(ws.map((w) => ({
        text: w.text, serif: w.wax, chip: w.hero && !w.wax,
        cap: w.wax ? CAP.serif : w.go ? CAP.go : w.hero ? CAP.hero : CAP.sup,
        condense: w.rep > 1 ? [1, 1, 0.8, 0.64][w.rep] : 1,
      })));
      const words: LWord[] = ws.map((w, i) => {
        const b = band.words[i]!;
        return {
          text: w.text, key: w.key, start: w.start, end: w.end, hero: w.hero, wax: w.wax, rep: w.rep, cap: b.cap,
          depth: w.go ? DEPTH.go : w.hero ? DEPTH.hero : DEPTH.sup,
          kw: KinWord.fromCells(w.wax ? w.text.toLowerCase() : w.text.toUpperCase(), b.cap / 0.72, b.cells, { family: w.wax ? 'serif' : 'archivo', width: 62 }),
          x0: b.x0, x1: b.x1, cx: b.cx,
        };
      });
      const t0 = k === 0 ? this.ctx.start : l.words[0]!.start - 0.045;
      this.lines.push({ k, t0, t1: this.ctx.end, words, band, az0: 0, path: null as unknown as LyricPath, plan });
    });
    this.lines.forEach((L, k) => { if (this.lines[k + 1]) L.t1 = this.lines[k + 1]!.t0; });

    // the slam: TEETH (the hook's first statement), bitten into the apple on its onset (the approved 55.00), slams
    // full-frame on the next beat (kinetic.ts, THE TEETH HOOK) until the next line's cut
    const L2 = this.lines[1];
    const teeth = L2?.words.find((w) => w.key === 'teeth');
    if (L2 && teeth) {
      const t0 = this.clk.nextBeat(teeth.start + 0.3);
      const kw0 = new KinWord('TEETH', { size: 520, width: 62, weight: 900 });
      const fit = (FW - 2 * 96) / (1.2 * kw0.width);
      this.slams.push({ t0, t1: L2.t1, land: t0, kw: new KinWord('TEETH', { size: 520 * fit, width: 62, weight: 900 }), teeth: true });
      L2.t1 = t0;
    }

    // each line's camera move: keyed by its words' places along the band at their onsets
    for (const L of this.lines) {
      const P = L.plan, n = L.words.length;
      const prog = (t: number) => clamp((t - L.t0) / Math.max(1e-3, L.t1 - L.t0));
      // the camera rides the writing head: the newest word's end sits ~30% of the frame right of centre, so the word
      // lands whole in the frame's sweet spot and the line so far trails to its left (a wide hero comes out centred)
      const look = (w: LWord, D: number) => w.x1 - Math.min(0.21 * D, 19);
      const vec = (t: number, s: number, D: number, wide: number) => {
        const u = prog(t);
        return [s, D, lerp(P.a[0], P.a[1], u), lerp(P.el[0], P.el[1], u), lerp(P.roll[0], P.roll[1], u), lerp(P.daz[0], P.daz[1], u), wide];
      };
      const hi = L.words.findIndex((w) => w.hero);
      const wideAt = (i: number) => (P.wide ? (i <= 0 ? 1 : i >= hi ? 0 : 0.55) : 0);
      const lead = 0.05;
      const w0 = L.words[0]!, wl = L.words[n - 1]!;
      // at the cut the first word lands just left of centre; the keys only ever move on along the line
      const s0 = w0.cx - 3;
      let sPrev = s0;
      const sAt = (x: number) => (sPrev = Math.max(x, sPrev + 1));
      // each word two keys: on its onset the camera has come only so far that the word before is still in frame and
      // the new one lands on the right (never on blank skin ahead of the bite); ~0.2 s on it has settled the new word
      // into the sweet spot, a hero with the push in (its distance is reached after the onset, never before)
      const keys: { t: number; v: number[] }[] = [{ t: L.t0, v: vec(L.t0, s0, P.D[0]!, wideAt(-1)) }];
      L.words.forEach((w, i) => {
        const D1 = P.D[i + 1]!, Don = w.hero ? P.D[i]! : D1;
        const tOn = Math.max(L.t0 + 0.02, w.start - lead);
        const prevEnd = i > 0 ? L.words[i - 1]!.x1 : s0;
        const sOn = Math.min(look(w, D1), prevEnd - 0.03 * Don);
        keys.push({ t: tOn, v: vec(tOn, sAt(sOn), Don, wideAt(i)) });
        const next = L.words[i + 1];
        const tSet = Math.min(w.start + 0.3, (next ? next.start - lead : L.t1) - 0.06);
        if (tSet > tOn + 0.05 && (sOn < look(w, D1) - 0.5 || Don !== D1)) keys.push({ t: tSet, v: vec(tSet, sAt(look(w, D1)), D1, wideAt(i)) });
      });
      keys.push({ t: L.t1, v: vec(L.t1, sAt(look(wl, P.D[n]!) + 4), P.D[n + 1] ?? P.D[n]! * 0.94, 0) });
      L.path = new LyricPath(keys, { clk: this.clk, settle: 0.3, down: 0.2 });
      // the apple's turn at the cut sets where the line sits on it: s0 square to the camera's off-normal azimuth
      L.az0 = P.a[0] - P.daz[0] - P.psi0 - s0 / RB;
    }

    this.march = new FSPass(MARCH_FRAG, {
      ssTap: SS_TAP,
      camPos: { value: V(0, 0, 0) }, camR: { value: V(0, 0, 0) }, camU: { value: V(0, 0, 0) }, camF: { value: V(0, 0, 0) },
      tanH: { value: 0.3 },
      keyPos: { value: V(0, 0, 0) }, keyDir: { value: V(0, -1, 0) }, keyI: { value: 1 }, keyRad: { value: 10 }, keyCone: { value: 0.8 },
      fillDir: { value: V(0, 1, 0) }, fillI: { value: 0.02 },
      lineTex: { value: this.lines[0]!.band.tex }, labelTex: { value: label }, digitTex: { value: digits },
      coatK: { value: 1 }, aYaw: { value: new THREE.Vector2(1, 0) },
      band: { value: new THREE.Vector4() }, lineRect: { value: new THREE.Vector4() },
      lnA: { value: v4s(LN_G) }, lnB: { value: v4s(LN_G) }, lnC: { value: v4s(LN_G) }, lnW: { value: v4s(LN_W) }, lnNW: { value: 0 },
      lnS: { value: new THREE.Vector2() },
      BC: { value: BITE.C }, BN: { value: BITE.N }, BT: { value: BITE.T }, BU: { value: BITE.U }, POST: { value: POSTS },
      SO: { value: SO }, SN: { value: BITE0.N }, SU: { value: BITE0.T }, SV: { value: BITE0.U },
      upT: { value: v4(spans.upper) }, loT: { value: v4(spans.lower) },
    });
    this.dof = new FSPass(DOF_FRAG, { src: { value: null }, focusD: { value: 100 }, aper: { value: 10 }, maxCoc: { value: 18 } });
  }

  private lineAt(t: number): Line {
    let L = this.lines[0]!;
    for (const x of this.lines) if (x.t0 <= t + 1e-6) L = x;
    return L;
  }

  /** A word's moves (kinetic.ts), chorus energy. Every word: its letters spring up into the skin one by one (~20 ms
   *  apart), light to heavy on the onset, wider on the kicks and condensed on the snares, growing to the right (the
   *  skin there is still whole). Supporting words: small, quick, tracking open on the beat. Heroes STAMP (land
   *  oversized, the frame shakes). SWEET springs softer; DEVIL leans further each beat; HANDS tracks wide; each NEVER
   *  lands wide and condenses; GO lands biggest. */
  private moves(w: LWord): Moves {
    if (!w.hero) {
      return {
        t0: w.start, spring: { stagger: 0.018, rise: 0.3, freq: 6 }, weight: { from: 300, to: 900, dur: 0.06 },
        track: { amt: 0.04 }, stretch: { kick: 0.06, snare: 0.06 }, anchor: 'left',
      };
    }
    const m: Moves = {
      t0: w.start, spring: { stagger: 0.02, freq: 5, damp: 0.36, rise: 0.12 },
      stamp: { at: w.start - 0.045, over: 1.25 }, weight: { from: 300, to: 900, dur: 0.04 },
      stretch: { kick: 0.1, snare: 0.08 }, track: { amt: 0.04 }, anchor: 'left',
    };
    if (w.key === 'sweet') { m.spring = { stagger: 0.025, freq: 4, damp: 0.45, rise: 0.15 }; m.stamp!.over = 1.15; m.stretch = { kick: 0.05, snare: 0.04 }; }
    if (w.key === 'devil') m.lean = { perBeat: 0.13, max: 0.3, fan: 1, from: w.start - 0.1 };
    if (w.key === 'hands') m.track = { amt: 0.09, hl: 0.12 };
    if (w.rep) { m.stamp!.over = 1.1; m.stretch = { kick: 0.04, snare: 0.12 }; }
    if (w.key === 'go') { m.stamp!.over = 1.45; m.stretch = { kick: 0.16, snare: 0.06 }; }
    return m;
  }
  private wordPose(w: LWord, t: number): KinPose {
    const P = w.kw.pose(t, this.clk, this.moves(w));
    if (w.rep) {
      // NEVER lands a third wider and condenses onto its (each time narrower) letters
      const f = 1 + 0.35 * (1 - springStep(Math.max(0, t - (w.start - 0.045)), 4.5, 0.55));
      for (const g of P.glyphs) { g.cx = w.x0 + (g.cx - w.x0) * f; g.sx *= f; }
    }
    return P;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer } = this.ctx;
    const sl = this.slams.find((x) => t >= x.t0 - 1e-6 && t < x.t1);
    if (sl) return this.renderSlam(sl, t, out);
    const Ln = this.lineAt(t);
    const m = this.march.u;

    // ---- the line on the apple: every word sung so far (and the one springing in), posed by the kit
    const A = m.lnA!.value as THREE.Vector4[], B = m.lnB!.value as THREE.Vector4[], C = m.lnC!.value as THREE.Vector4[], Wd = m.lnW!.value as THREE.Vector4[];
    let g = 0, nw = 0, s0 = 1e9, s1 = -1e9, shake = 0, hmax = 0;
    for (const w of Ln.words) {
      if (t < w.start - 0.4 || nw >= LN_W) continue;
      const P = this.wordPose(w, t);
      const n = w.kw.glyphs.length;
      if (g + n > LN_G) break;
      packKin(w.kw, P, w.cap, 0, this.pk);
      let x0 = 1e9, x1 = -1e9;
      for (let i = 0; i < n; i++) {
        const a = i * 4, b = KIN_MAX * 4 + i * 4, c = KIN_MAX * 8 + i * 4;
        A[g + i]!.set(this.pk[a]!, this.pk[a + 1]!, this.pk[a + 2]!, this.pk[a + 3]!);
        B[g + i]!.set(this.pk[b]!, this.pk[b + 1]!, this.pk[b + 2]!, this.pk[b + 3]!);
        C[g + i]!.set(this.pk[c]!, this.pk[c + 1]!, this.pk[c + 2]!, w.depth + (w.wax ? 10 : 0));
        const p = P.glyphs[i]!;
        if (p.on > 0.001) {
          const e = (w.kw.glyphs[i]!.adv / 2) * p.sx + (w.cap / 2) * Math.abs(Math.sin(p.rot)) * p.sy + 1;
          x0 = Math.min(x0, p.cx - e); x1 = Math.max(x1, p.cx + e);
          hmax = Math.max(hmax, (w.cap / 2) * p.sy + Math.abs(p.y) + (w.kw.glyphs[i]!.adv / 2) * Math.abs(Math.sin(p.rot)));
        }
      }
      if (x1 > x0) {
        Wd[nw]!.set(x0, x1, g, g + n);
        nw++; g += n; s0 = Math.min(s0, x0); s1 = Math.max(s1, x1);
        if (w.hero) shake = Math.max(shake, P.shake * (w.wax ? 4 : w.key === 'go' ? 14 : 10));
      }
    }
    m.lnNW!.value = nw;
    (m.lnS!.value as THREE.Vector2).set(s0, s1);
    m.lineTex!.value = Ln.band.tex;
    (m.lineRect!.value as THREE.Vector4).set(...Ln.band.rect);
    (m.band!.value as THREE.Vector4).set(Ln.az0, HB, RB, hmax + 1.5);

    // ---- the camera: one move along the line (kinetic.ts LyricPath), the apple turning under it
    const [sf, D, az, el, roll, daz, wide] = Ln.path.at(t) as [number, number, number, number, number, number, number];
    const psi = az - daz - (Ln.az0 + sf / RB);
    (m.aYaw!.value as THREE.Vector2).set(Math.cos(psi), Math.sin(psi));
    const onBand = turn(flank(Ln.az0 + sf / RB, HB).C, psi);
    const at = onBand.clone().lerp(EXHIBIT, wide);
    const pos = at.clone().addScaledVector(dirAz(az, el), D);
    const fov = 27;
    const qc = qv('cam');
    if (qc) { pos.set(qc[0]!, qc[1]!, qc[2]!); at.set(qc[3]!, qc[4]!, qc[5]!); }
    const fw = at.clone().sub(pos).normalize();
    let rt = new THREE.Vector3().crossVectors(fw, UP).normalize();
    let up = new THREE.Vector3().crossVectors(rt, fw);
    if (roll) { rt = rt.applyAxisAngle(fw, roll); up = up.applyAxisAngle(fw, roll); }
    (m.camPos!.value as THREE.Vector3).copy(pos);
    (m.camF!.value as THREE.Vector3).copy(fw);
    (m.camR!.value as THREE.Vector3).copy(rt);
    (m.camU!.value as THREE.Vector3).copy(up);
    m.tanH!.value = Math.tan((fov * Math.PI) / 360);

    // ---- the flash: on the camera, a hand above and left of the lens so each bitten letter's walls take light on one
    // side; it fires on every beat (the head overshoots and settles), the photograph continuing
    const far = clamp((D - 60) / 130);
    const key = pos.clone().addScaledVector(up, 16 + 0.25 * D).addScaledVector(rt, -(30 + 0.3 * D));
    const beat = this.clk.lastBeat(t);
    const burst = Math.max(pulse(t, beat, 0.02), pulse(t, Ln.t0, 0.02));
    const I = lerp(1.95, 1.15, far);
    (m.keyPos!.value as THREE.Vector3).copy(key);
    m.keyI!.value = (I * key.distanceToSquared(at)) / 1e5 * (1 + 0.8 * burst);
    m.keyRad!.value = lerp(3, 5, far);
    (m.keyDir!.value as THREE.Vector3).copy(at.clone().sub(key).normalize());
    m.keyCone!.value = 0.8;
    (m.fillDir!.value as THREE.Vector3).copy(pos.clone().sub(at).normalize());
    m.fillI!.value = 0.05 * (1 - far);
    m.coatK!.value = lerp(0.4, 1, far);
    this.march.render(renderer, this.rt);

    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = onBand.clone().sub(pos).dot(fw);
    d.aper!.value = qv('aper')?.[0] ?? lerp(9 * Math.min(1, 70 / D), 2.5, wide);
    this.dof.render(renderer, out);
    // the flash reaches the film as an exposure kick (multiplicative: the blacks stay black); a few pixels of shake on
    // every beat, more on a hero's stamp
    const kick = Math.max(0.22 * pulse(t, beat, 0.03), (Ln.k === 0 ? 0.7 : 0.4) * pulse(t, Ln.t0, 0.045));
    shake += 2.5 * pulse(t, beat, 0.04);
    return { exposure: 1 + kick, halation: 0.04, shake: kinShake(t, shake) };
  }

  /** A full-frame slam (kinetic.ts): flat palette fills in Archivo 900, no outlines or halos, taking the plate's post.
   *  TEETH, the hook's first statement: film-black Archivo 62/900 stretched tall on a stone-yellow field (the apple's,
   *  the cast's colour), inverted punch frames, stamped 1.2x; on the 8th note a scalloped bite (his arch: one
   *  tooth-width scallop per tooth, #8's chipped) breaks a piece out of the word and it flies off. The next line's
   *  first bite cuts back to the apple. */
  private renderSlam(sl: Slam, t: number, out: THREE.WebGLRenderTarget): PostOverrides {
    const c = this.L.ctx, au = this.ctx.audio;
    const punch = sl.teeth && t < sl.t0 + 0.05;
    const field = sl.teeth ? (punch ? 'film' : 'stone') : 'film';
    const ink = sl.teeth ? (punch ? 'stone' : 'film') : 'lightbox';
    this.L.clear(trgba(field));
    c.textBaseline = 'alphabetic';
    const kw = sl.kw;
    // TEETH stands tall: its cap height ~690 px at rest, ~830 px at the stamp's peak (inside title safe)
    const tall = sl.teeth ? Math.min(1.8, 690 / (0.686 * kw.style.size)) : 1.0;
    const cap = kw.style.size * 0.686 * tall;
    const base = FH / 2 + cap / 2;
    const x = (FW - kw.width) / 2;
    const P = kw.pose(t, this.clk, {
      t0: sl.land, lead: sl.land - sl.t0,
      spring: { stagger: sl.teeth ? 0.018 : 0.022, freq: 5.5, damp: 0.4, rise: sl.teeth ? 0.45 : 0.7 },
      stamp: { at: sl.t0, over: 1.2 },
      stretch: sl.teeth ? { kick: 0.25, snare: 0 } : { kick: 0.1, snare: 0.12 },
      weight: sl.teeth ? undefined : { from: 500, to: 900, dur: 0.05 },
      track: { amt: 0.03 },
    });
    if (tall !== 1) for (const g of P.glyphs) g.sy *= tall;
    let brk;
    let shake = P.shake * (sl.teeth ? 22 : 16);
    if (sl.teeth) {
      // the bite: on the 8th after the slam
      const tb = au.timeOfBeat(au.beatAt(sl.t0) + 0.5);
      // (the bitten piece is snatched out of frame in ~3 frames; the rest of the word jolts and holds, bitten)
      const k = clamp((t - tb) / 0.1);
      if (t >= tb) {
        const bx = x + kw.width * 0.97, by = base - cap * 1.05;
        brk = { mask: this.biteMask(bx, by, cap * 0.42), k: ease.outCubic(k), a: { dx: 1400, dy: -900, rot: 0.6 }, b: { dx: -26, dy: 18, rot: -0.012 }, pivot: [bx, by] as [number, number] };
        shake += 14 * pulse(t, tb, 0.05);
      }
    }
    drawKin(c, kw, P, x, base, { fill: trgba(ink), brk });
    this.L.upload();
    this.ctx.comp.draw(this.ctx.renderer, this.L.texture, out, { mode: 'replace' });
    return { exposure: 1, halation: 0, shake: kinShake(t, shake), zoom: 1 + 0.03 * P.shake }; // no halation: a slam is never haloed
  }

  /** His bite as a break mask: a crescent bitten from the upper right, its rim a row of tooth-width scallops (convex
   *  arcs meeting in points, as incisal edges leave them), #8's scallop flattened at one corner (the chip). */
  private biteMask(cx: number, cy: number, R: number): Path2D {
    const p = new Path2D();
    const N = 7, a0 = Math.PI * 0.35, a1 = Math.PI * 1.25; // the rim facing the word (lower left)
    const pts: [number, number][] = [];
    for (let j = 0; j <= 280; j++) {
      const a = lerp(a0, a1, j / 280);
      const u = ((a - a0) / (a1 - a0)) * N, k = Math.floor(Math.min(u, N - 1e-6)), f = u - k;
      let bulge = Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
      if (k === 3 && f < 0.45) bulge = Math.min(bulge, 0.35 + f); // #8: the chipped corner
      const r = R * (1 + 0.075 * bulge);
      pts.push([cx + r * Math.cos(a) * 1.25, cy + r * Math.sin(a)]);
    }
    p.moveTo(cx + 3 * R * Math.cos(a0), cy + 3 * R * Math.sin(a0));
    for (const [px, py] of pts) p.lineTo(px, py);
    p.lineTo(cx + 3 * R * Math.cos(a1), cy + 3 * R * Math.sin(a1));
    p.lineTo(cx + 3 * R, cy - 3 * R);
    p.closePath();
    return p;
  }
}
