// Plate 5 `scale` — chorus 1, first half (48.73 – 62.54), docs/TEETH2.md. Bite-mark photography and the first stomp,
// shot in colour within palette 2A (a hard flash, true blacks). A GOLDEN apple in dental-stone yellow (a Golden
// Delicious: russet freckles and lenticels, greener toward the stem, a faint wax blush; the bite and the cast he pours
// in chorus 2 share the colour) stands stem up, one cold grey-green leaf on the stem, on film-black velvet, ONE BITE
// taken out of its shoulder (a crescent scooped into the pale cream flesh, its rim scalloped by his incisal edges with
// #8's chip a notch in the scallop; teeth.ts biteMark(HIS)). An ABFO No. 2 scale stands on the cloth beside it, its
// sticker the plate's one readable label (08-32 · EXHIBIT 4).
//
// LYRIC-LED CAMERA (docs/TEETH2.md; round 2, re-staged in round 2b after the blind review). Each sung line is bitten,
// word by word as it is sung, into the apple's front in short left-aligned ROWS (P(doom)'s cards; scale-bite.ts
// bakeLine: the whole line baked once; the kinetic kit poses every letter on it), the heroes bitten big and deep, the
// supporting words shallow. ONE continuous camera move per line (kinetic.ts LyricPath, one key per word) frames the
// line SO FAR, whole: it opens close on the first word, then eases right, down and gently back as the rows fill, each
// step spread over the word before and eased into the beats, so the line is never cropped and nothing jumps. The
// apple turns on its stand under the move; the camera tilts to sit square to the row being written.
//   line 1 "Fight so dirty...": from the exhibit (the approved first flash: bite, ruler and the whole label, FIGHT big
//          on the apple's flank) the camera pushes in to the whole line, ending on SWEET (wax pink: the approved 51.50).
//   line 2 "Talk so pretty...": opens close on TALK; the light builds beat by beat into TEETH, alone on the last row
//          (the approved 55.00), which then slams full-frame (the hook's first statement, a bite out of its H) and
//          holds to LATE.
//   line 3 "Late night devil...": from above, descending; DEVIL leans further each beat; it carries AND across the cut.
//   line 4 "And never, never...": cut on the downbeat 59.08 (AND already standing); each NEVER lands wider and condenses
//          (each copy narrower); GO, biggest, alone on the last row.
// The stomp is the shutter: every beat a flash (an exposure kick with a punch of zoom, the head overshooting, a few
// pixels of shake; the words stretch on the kicks) inside the continuing shot. Cuts only between lines, on downbeats,
// each landing on its first word already readable (and the TEETH slam and back).
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
/** Cap heights (mm): supporting words, heroes, SWEET (Cormorant lowercase), GO, TEETH, and line 1's opening row
 *  (read from the exhibit's distance). Round 2b: supporting words bigger and heroes smaller than round 2, so a whole
 *  line sets as a short page on the apple's front. */
const CAP = { sup: 4.4, hero: 8.0, serif: 10, go: 10.5, teeth: 8.5, open: 8.5 };
/** Bite depth (mm): supporting words shallow, heroes deep. */
const DEPTH = { sup: 1.3, hero: 2.3, go: 2.8 };

/** The hero words by line (word index in the line): DIRTY, SWEET; PRETTY, TEETH; DEVIL, HANDS; NEVER x3, GO. */
const HEROES: number[][] = [[2, 7], [2, 7], [2, 5], [1, 2, 3, 6]];
/** ROUND 2B: each line is set in left-aligned rows (the first word index of each row), running down the apple's
 *  front, so the line so far is always whole in frame (P(doom)'s two-row cards):
 *    FIGHT / SO DIRTY / BUT YOUR LOVE'S / SO sweet         TALK SO / PRETTY BUT / YOUR HEART GOT / TEETH
 *    LATE NIGHT / DEVIL, PUT / YOUR HANDS / ON ME AND        AND NEVER, / NEVER, NEVER / EVER LET / GO
 *  (the hook words, TEETH and GO, close their lines alone on the last row: short, so they stay on the apple's front)
 *  (line 3 carries AND across the cut to line 4, which lands on the downbeat 59.08) */
const ROWS: number[][] = [[0, 1, 3, 6], [0, 2, 4, 7], [0, 2, 4, 6], [0, 2, 4, 6]];
/** The first row's cap top over the band's middle, and the gap between rows (mm). */
const ROW_TOP = [20, 17, 17, 19], ROW_GAP = 2.6;

/** Round 2b: a longer lens (18 deg vertical, was 27) from further back, so the close apple's curve does not crowd the
 *  ends of a row against its silhouette; LENS: how much further back the camera stands for the same framing. */
const FOV = 18, LENS = Math.tan((27 * Math.PI) / 360) / Math.tan((FOV * Math.PI) / 360);
/** The frame's height and width per mm of camera distance (16:9). */
const FH_D = 2 * Math.tan((FOV * Math.PI) / 360), FW_D = FH_D * (16 / 9);

/**
 * Each line's one move. a, el, roll, daz: the camera's azimuth and elevation round the apple, its roll, and how far it
 * stands off the line's normal, from the line's start to its end (the elevation also follows the rows down). psi0:
 * the apple's turn at the cut (0 = the bite square to the exhibit camera); the lines are set on the apple's far side
 * from the bite. dEx: line 1's distance on the exhibit (the approved first flash).
 */
interface Plan { a: [number, number]; el: [number, number]; roll: [number, number]; daz: [number, number]; psi0: number; wide?: boolean; dEx?: number }
const PLANS: Plan[] = [
  { a: [-0.3, 0.2], el: [0.5, -0.1], roll: [0, -0.02], daz: [0.5, -0.04], psi0: 0, wide: true, dEx: 190 * LENS },
  { a: [-0.3, 0.15], el: [0.06, 0.12], roll: [0.05, -0.02], daz: [0.0, 0.04], psi0: 2.4 },
  { a: [-1.5, -1.05], el: [0.36, 0.08], roll: [0.08, 0.0], daz: [0.0, 0.04], psi0: 1.0 },
  { a: [-0.7, -0.25], el: [-0.02, 0.16], roll: [-0.05, 0.03], daz: [0.0, 0.04], psi0: 2.0 },
];

interface LWord {
  text: string; key: string; start: number; end: number; hero: boolean; cap: number; depth: number; wax: boolean;
  /** the word's letters on the band (cells in mm along it) and its rest extent and centre */
  kw: KinWord; x0: number; x1: number; cx: number;
  /** its cap box's centre height over the band's middle (its row) */
  hc: number;
  /** which NEVER (1..3; 0 otherwise) */
  rep: number;
  /** when its moves start: its onset, or earlier for a word already standing at its line's cut (it is read at once) */
  m0: number;
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
    type SW = { w: string; start: number; end: number };
    const src = lyrics.linesIn(this.ctx.start, this.ctx.end).filter((l) => l.start < this.ctx.end - 0.1)
      .map((l) => ({ words: l.words.map((w) => ({ w: w.w, start: w.start, end: w.end })) as SW[], cut: l.words[0]!.start }));
    // cuts land on downbeats: a line whose first word is sung off the downbeat ("And", 58.87) cuts on the next
    // downbeat, and the words sung before it are carried across the cut: bitten at the end of the line before (on
    // their onsets) and standing in the new line from its first frame
    const downs = audio.downbeats;
    src.forEach((l, k) => {
      const s0 = l.words[0]!.start;
      const near = downs.reduce((a, b) => (Math.abs(b - s0) < Math.abs(a - s0) ? b : a), Infinity);
      if (k === 0 || Math.abs(near - s0) < 0.06) return;
      l.cut = downs.find((d) => d > s0) ?? s0;
      for (const w of l.words) if (w.start < l.cut - 1e-3) src[k - 1]!.words.push({ ...w });
    });
    src.forEach((l, k) => {
      const plan = PLANS[k] ?? PLANS[PLANS.length - 1]!;
      const heroes = HEROES[k] ?? [];
      const rows = ROWS[k] ?? [0];
      const t0 = k === 0 ? this.ctx.start : l.cut;
      let nev = 0;
      const ws = l.words.map((w, i) => {
        const text = w.w.replace(/'/g, '’').replace(/[^A-Za-z’]/g, '');
        const key = text.replace(/’/g, '').toLowerCase();
        const hero = heroes.includes(i);
        const wax = key === 'sweet', go = key === 'go';
        const rep = hero && key === 'never' ? ++nev : 0;
        const row = rows.filter((r) => r <= i).length - 1;
        return { text, key, start: w.start, end: w.end, hero, wax, go, rep, row };
      });
      const band = bakeLine(ws.map((w) => ({
        text: w.text, serif: w.wax, chip: w.hero && !w.wax, row: w.row,
        cap: w.wax ? CAP.serif : w.go ? CAP.go : w.key === 'teeth' ? CAP.teeth : w.hero ? CAP.hero : k === 0 && w.row === 0 ? CAP.open : CAP.sup,
        condense: w.rep > 1 ? [1, 1, 0.8, 0.64][w.rep] : 1,
      })), { top: ROW_TOP[k] ?? 19, gap: ROW_GAP });
      const words: LWord[] = ws.map((w, i) => {
        const b = band.words[i]!;
        return {
          text: w.text, key: w.key, start: w.start, end: w.end, hero: w.hero, wax: w.wax, rep: w.rep, cap: b.cap,
          depth: w.go ? DEPTH.go : w.hero ? DEPTH.hero : DEPTH.sup,
          kw: KinWord.fromCells(w.wax ? w.text.toLowerCase() : w.text.toUpperCase(), b.cap / 0.72, b.cells, { family: w.wax ? 'serif' : 'archivo', width: 62 }),
          x0: b.x0, x1: b.x1, cx: b.cx, hc: b.hc,
          // a word sung at (or before) the cut already stands in the first frame (its letters sprang 0.17 s ahead)
          m0: w.start < t0 + 0.05 ? Math.min(w.start, t0 - 0.12) : w.start,
        };
      });
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

    // ROUND 2B CAMERA: each line's one move frames the line SO FAR, whole. One key per word, on its onset (less a
    // lead): the box round every word sung by then (rows included), its centre on the frame's centre and the camera
    // as far back as the box needs (title-safe margins), never nearer than DMIN. The move from one key to the next
    // runs over the whole of the word before, so the camera leads: the room for the next word is made before it
    // lands, and the line is never cropped. As the line grows the box only grows (rows are left-aligned and run
    // down), so the camera eases right, down and gently back, one way only, into the beats (LyricPath); the line
    // opens close (its first word alone fills the frame's middle). Line 1 starts on the exhibit and pushes in.
    const DMIN = 58 * LENS;
    for (const L of this.lines) {
      const P = L.plan, n = L.words.length;
      const prog = (t: number) => clamp((t - L.t0) / Math.max(1e-3, L.t1 - L.t0));
      const box = (i: number) => {
        let s0 = 1e9, s1 = -1e9, h0 = 1e9, h1 = -1e9;
        for (const w of L.words.slice(0, i + 1)) {
          s0 = Math.min(s0, w.x0); s1 = Math.max(s1, w.x1 + (w.rep ? 0.12 * (w.x1 - w.x0) : 0));
          h1 = Math.max(h1, w.hc + (w.wax ? 0.75 : 0.5) * w.cap); h0 = Math.min(h0, w.hc - (w.wax ? 0.3 : 0.5) * w.cap);
        }
        // on the curved band the line's ends turn away: frame its chord, and leave room for stamps and stretch
        const chord = 2 * RB * Math.sin(Math.min(1.5, (s1 - s0) / (2 * RB)));
        const D = Math.max(DMIN, (chord + 8) / (FW_D * 0.8), (h1 - h0 + 4) / (FH_D * 0.76));
        // hn: the newest row's height (the camera tilts to sit square to it, so the row being written reads flat)
        return { s: (s0 + s1) / 2, h: (h0 + h1) / 2, D, hn: L.words[i]!.hc };
      };
      const vec = (t: number, b: { s: number; h: number; hn: number }, D: number, wide: number) => {
        const u = prog(t);
        return [b.s, b.h, D, lerp(P.a[0], P.a[1], u), lerp(P.el[0], P.el[1], u), lerp(P.roll[0], P.roll[1], u), lerp(P.daz[0], P.daz[1], u), wide, b.hn];
      };
      const lead = 0.06;
      const boxes = L.words.map((_, i) => box(i));
      // distances: lines 2-4 only ever ease back as the line grows; line 1 only pushes in, from the exhibit to the
      // whole line's frame (every box fits on the way)
      const Dend = Math.max(...boxes.map((b) => b.D));
      const Dk = boxes.map((b, i) => (P.wide ? lerp(P.dEx ?? 160, Dend, ease.inOutQuad(clamp(i / Math.max(1, n - 2)))) : b.D));
      for (let i = 1; i < n; i++) Dk[i] = P.wide ? Math.min(Dk[i]!, Dk[i - 1]!) : Math.max(Dk[i]!, Dk[i - 1]!);
      const wideAt = (i: number) => (P.wide ? (i <= 0 ? 1 : i === 1 ? 0.6 : 0) : 0);
      // the cut frames every word standing or landing on it (AND carried across, NEVER on the downbeat)
      const i0 = Math.max(0, L.words.filter((w) => w.start < L.t0 + 0.1).length - 1);
      const keys: { t: number; v: number[] }[] = [{ t: L.t0, v: vec(L.t0, boxes[i0]!, Dk[i0]!, wideAt(0)) }];
      L.words.forEach((w, i) => {
        const t = Math.max(L.t0 + 0.02, w.start - lead);
        if (i > i0) keys.push({ t, v: vec(t, boxes[i]!, Dk[i]!, wideAt(i)) });
      });
      // the hold: the move carries on, easing a little further back and round, until the next line takes over
      keys.push({ t: L.t1, v: vec(L.t1, boxes[n - 1]!, Dk[n - 1]! * (P.wide ? 0.97 : 1.04), 0) });
      L.path = new LyricPath(keys, { clk: this.clk, settle: 0.3, down: 0.2 });
      // the apple's turn at the cut sets where the line sits on it: its first box square to the camera's azimuth
      L.az0 = P.a[0] - P.daz[0] - P.psi0 - boxes[i0]!.s / RB;
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
      lnA: { value: v4s(LN_G) }, lnB: { value: v4s(LN_G) }, lnC: { value: v4s(LN_G) }, lnW: { value: v4s(LN_W) }, lnH: { value: Array.from({ length: LN_W }, () => new THREE.Vector2()) }, lnNW: { value: 0 },
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
        t0: w.m0, spring: { stagger: 0.018, rise: 0.3, freq: 6 }, weight: { from: 300, to: 900, dur: 0.06 },
        stamp: { at: w.m0 - 0.045, over: 1.07, freq: 6 },
        track: { amt: 0.05 }, stretch: { kick: 0.14, snare: 0.08 }, anchor: 'center',
      };
    }
    const m: Moves = {
      t0: w.m0, spring: { stagger: 0.02, freq: 5, damp: 0.36, rise: 0.12 },
      stamp: { at: w.m0 - 0.045, over: 1.25 }, weight: { from: 300, to: 900, dur: 0.04 },
      stretch: { kick: 0.09, snare: 0.08 }, track: { amt: 0.04 }, anchor: 'left',
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
      const f = 1 + 0.35 * (1 - springStep(Math.max(0, t - (w.m0 - 0.045)), 4.5, 0.55));
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
    const Hd = m.lnH!.value as THREE.Vector2[];
    let g = 0, nw = 0, s0 = 1e9, s1 = -1e9, shake = 0, hmax = 0;
    for (const w of Ln.words) {
      if (t < w.m0 - 0.4 || nw >= LN_W) continue;
      const P = this.wordPose(w, t);
      const n = w.kw.glyphs.length;
      if (g + n > LN_G) break;
      packKin(w.kw, P, w.cap, w.hc, this.pk);
      let x0 = 1e9, x1 = -1e9, hx = 0;
      for (let i = 0; i < n; i++) {
        const a = i * 4, b = KIN_MAX * 4 + i * 4, c = KIN_MAX * 8 + i * 4;
        A[g + i]!.set(this.pk[a]!, this.pk[a + 1]!, this.pk[a + 2]!, this.pk[a + 3]!);
        B[g + i]!.set(this.pk[b]!, this.pk[b + 1]!, this.pk[b + 2]!, this.pk[b + 3]!);
        C[g + i]!.set(this.pk[c]!, this.pk[c + 1]!, this.pk[c + 2]!, w.depth + (w.wax ? 10 : 0));
        const p = P.glyphs[i]!;
        if (p.on > 0.001) {
          const e = (w.kw.glyphs[i]!.adv / 2) * p.sx + (w.cap / 2) * Math.abs(Math.sin(p.rot)) * p.sy + 1;
          x0 = Math.min(x0, p.cx - e); x1 = Math.max(x1, p.cx + e);
          hx = Math.max(hx, (w.cap / 2) * p.sy * (w.wax ? 1.6 : 1) + Math.abs(p.y) + (w.kw.glyphs[i]!.adv / 2) * Math.abs(Math.sin(p.rot)));
        }
      }
      if (x1 > x0) {
        Wd[nw]!.set(x0, x1, g, g + n);
        Hd[nw]!.set(w.hc - hx - 1.5, w.hc + hx + 1.5);
        hmax = Math.max(hmax, Math.abs(w.hc) + hx);
        nw++; g += n; s0 = Math.min(s0, x0); s1 = Math.max(s1, x1);
        shake = Math.max(shake, P.shake * (!w.hero ? 3 : w.wax ? 4 : w.key === 'go' ? 14 : 10));
      }
    }
    m.lnNW!.value = nw;
    (m.lnS!.value as THREE.Vector2).set(s0, s1);
    m.lineTex!.value = Ln.band.tex;
    (m.lineRect!.value as THREE.Vector4).set(...Ln.band.rect);
    (m.band!.value as THREE.Vector4).set(Ln.az0, HB, RB, hmax + 1.5);

    // ---- the camera: one move along the line (kinetic.ts LyricPath), the apple turning under it
    const [sf, hf, D, az, el0, roll, daz, wide, hn] = Ln.path.at(t) as [number, number, number, number, number, number, number, number, number];
    const psi = az - daz - (Ln.az0 + sf / RB);
    (m.aYaw!.value as THREE.Vector2).set(Math.cos(psi), Math.sin(psi));
    const onBand = turn(flank(Ln.az0 + sf / RB, HB + hf).C, psi);
    const at = onBand.clone().lerp(EXHIBIT, 0.7 * wide);
    // the camera's elevation follows the rows down the apple's curve (square to the line it frames)
    // (never below the cloth: at least 10 mm over the table)
    const el = Math.max(el0 + (1 - wide) * 0.75 * Math.atan2(HB + lerp(hf, hn, 0.6), LAY.AR), Math.asin(clamp((10 - at.y) / D, -1, 1)));
    const pos = at.clone().addScaledVector(dirAz(az, el), D);
    const fov = FOV;
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
    const Dn = D / LENS, far = clamp((Dn - 60) / 130);
    const beat = this.clk.lastBeat(t);
    // ESCALATION (round 2b): the light builds over line 2 into TEETH, one step per beat: each flash brighter, the key
    // swung a little further out (a steeper rake from a smaller, harder source) and the fill gone, so every frame
    // reaches lightbox-bright and film-black; the chorus after the hook stays near the top
    const nb = Math.max(1, Math.round((Ln.t1 - Ln.t0) / (this.clk.nextBeat(Ln.t0) - this.clk.lastBeat(Ln.t0))));
    const esc = Ln.k === 0 ? 0.25 : Ln.k === 1 ? lerp(0.3, 1, clamp(this.clk.steps(Ln.t0 - 1e-3, t, 0.08) / nb)) : 0.8;
    const rake = lerp(1, 1.2, esc);
    const key = pos.clone().addScaledVector(up, (16 + 0.25 * Dn) * LENS * lerp(1, 1.25, esc)).addScaledVector(rt, -(30 + 0.3 * Dn) * LENS * rake);
    const burst = Math.max(pulse(t, beat, 0.03), pulse(t, Ln.t0, 0.03));
    const I = lerp(1.95, 1.15, far) * lerp(0.9, 1.4, esc);
    (m.keyPos!.value as THREE.Vector3).copy(key);
    m.keyI!.value = (I * key.distanceToSquared(at)) / 1e5 * (1 + 1.2 * burst);
    m.keyRad!.value = lerp(3, 5, far) * lerp(1, 0.35, esc);
    (m.keyDir!.value as THREE.Vector3).copy(at.clone().sub(key).normalize());
    m.keyCone!.value = 0.8;
    (m.fillDir!.value as THREE.Vector3).copy(pos.clone().sub(at).normalize());
    m.fillI!.value = 0.05 * (1 - far) * (1 - 0.8 * esc);
    m.coatK!.value = lerp(0.4, 1, far);
    this.march.render(renderer, this.rt);

    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = onBand.clone().sub(pos).dot(fw);
    d.aper!.value = qv('aper')?.[0] ?? lerp(9 * Math.min(1, 70 / Dn), 2.5, wide);
    this.dof.render(renderer, out);
    // the flash reaches the film as an exposure kick (multiplicative: the blacks stay black); a few pixels of shake on
    // every beat, more on a hero's stamp
    // the flash hits the film as an exposure kick inside the shot (multiplicative: the blacks stay black), with a
    // punch of zoom and a few pixels of shake on every beat, more on the kicks and a hero's stamp
    const onKick = this.clk.inBar(Math.round(this.clk.beat(beat))) % 2 === 0;
    const kick = Math.max(lerp(0.5, 1.0, esc) * (onKick ? 1 : 0.7) * pulse(t, beat, 0.05), (Ln.k === 0 ? 0.8 : 0.6) * pulse(t, Ln.t0, 0.05));
    shake += (onKick ? 4 : 2.5) * pulse(t, beat, 0.04);
    return { exposure: 1 + kick, halation: 0.04, shake: kinShake(t, shake), zoom: 1 + 0.022 * (onKick ? 1 : 0.6) * pulse(t, beat, 0.06) };
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
      // (round 2b: no per-letter spring on the slam: the whole word is there from its first frame, no orphan TE)
      spring: sl.teeth ? false : { stagger: 0.022, freq: 5.5, damp: 0.4, rise: 0.7 },
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
