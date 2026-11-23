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
// The stomp is the shutter (round 3, graded): one hard key rakes low across the apple from a strobe head at the upper
// left; the strobe fires only on tier 1 (the opening photograph and each hero's onset), a hard side flash that throws
// the bitten letters into black shadow and bright edge light for a few frames; between flashes the modelling lamp
// ticks back up as the unit recharges, the words stretch on the kicks, and the frame nudges a few pixels on the
// downbeats. Cuts only between lines, on downbeats,
// each landing on its first word already readable (and the TEETH slam and back).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, SS_TAP, makeRT, W as FW, H as FH } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, lerp, pulse, springStep } from '../../engine/util';
import { trgba } from '../palette';
import { KinClock, KinWord, KIN_MAX, LyricPath, drawKin, kinCam, kinProbeOn, kinRecord3D, kinShake, packKin, type KinPose, type Moves } from '../kinetic';
import { DOF_FRAG, LAY, LN_G, LN_W, MARCH_FRAG } from './scale-glsl';
import { bakeLine, toothSpans, type BandLine } from './scale-bite';

const LABEL = '08-32 · EXHIBIT 4';

/** The band: its middle over the apple's centre and the radius its arc length is measured at (mm). */
const HB = -2, RB = 39;
/** Cap heights (mm): supporting words, heroes, SWEET (Cormorant lowercase), GO, TEETH, and line 1's opening row
 *  (read from the exhibit's distance). Round 2b: supporting words bigger and heroes smaller than round 2, so a whole
 *  line sets as a short page on the apple's front. */
const CAP = { sup: 4.4, hero: 8.0, serif: 10, go: 10.5, teeth: 8.5, open: 7.6, sup1: 4.6, sup1b: 5.2, hero1: 7.6 };
/** Bite depth (mm): supporting words shallow, heroes deep. */
const DEPTH = { sup: 1.3, hero: 2.3, go: 2.8 };

/** The hero words by line (word index in the line): DIRTY, SWEET; PRETTY, TEETH; DEVIL, HANDS; NEVER x3, GO. */
const HEROES: number[][] = [[2, 7], [2, 7], [2, 5], [1, 2, 3, 6]];
/** ROUND 2B: each line is set in left-aligned rows (the first word index of each row), running down the apple's
 *  front, so the line so far is always whole in frame (P(doom)'s two-row cards). ROUND 5 (lead 2026-11-22): line 4 in
 *  three wider rows; line 1 keeps four (three would need a 78 mm first row, 115 deg of the apple's curve, which no
 *  framing can read whole) but is set higher (ROW_TOP), so SWEET sits off the apple's underside:
 *    FIGHT / SO DIRTY / BUT YOUR LOVE'S / SO sweet         TALK SO / PRETTY BUT / YOUR HEART GOT / TEETH
 *    LATE NIGHT / DEVIL, PUT / YOUR HANDS / ON ME AND        AND NEVER, / NEVER, NEVER / EVER LET GO
 *  (line 3 carries AND across the cut to line 4, which lands on the downbeat 59.08) */
const ROWS: number[][] = [[0, 1, 3, 6], [0, 2, 4, 7], [0, 2, 4, 6], [0, 2, 4]];
/** The first row's cap top over the band's middle, and the gap between rows (mm). (round 5: line 3 raised, so its
 *  last row is not on the apple's underside) */
const ROW_TOP = [21, 17, 21, 25], ROW_GAP = [2.0, 2.6, 2.6, 2.6];

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
// ROUND 5 (client 2026-11-22: bigger continuous moves): each line its own framing family and a move 2-3x round 4's
// (r4: a [-0.3,0.2] [-0.3,0.15] [-1.5,-1.05] [-0.7,-0.25]; el [0.5,-0.1] [0.06,0.12] [0.36,0.08] [-0.02,0.16]; daz
// [0.5,-0.04] [0.25,0.2] [0.15,0.05] [0.15,0]). Line 1 keeps its start (the approved 48.75) and line 2 its end (the
// approved 55.00).
//   line 1: the three-quarter exhibit, pushing in and swinging round the apple to the line's left;
//   line 2: a low raking profile across the skin (from below and well off the rows' right), rising and squaring up
//           into TEETH;
//   line 3: a high angle, craning down over the rows as they fill;
//   line 4: an orbit across the face, from the rows' left round to their right.
const PLANS: Plan[] = [
  { a: [-0.3, 0.6], el: [0.5, -0.4], roll: [0, -0.07], daz: [0.42, -0.6], psi0: 0, wide: true, dEx: 190 * LENS },
  { a: [-0.7, 0.15], el: [-0.14, 0.1], roll: [0.1, -0.02], daz: [-0.3, -0.02], psi0: 2.4 },
  { a: [-1.9, -0.8], el: [0.5, -0.12], roll: [0.1, -0.05], daz: [-0.1, 0.55], psi0: 1.0 },
  { a: [-1.3, 0.1], el: [0.3, -0.1], roll: [-0.09, 0.07], daz: [-0.4, 0.08], psi0: 2.0 },
];
/** ROUND 5: how far the line's framing leans from the line so far's centre toward its newest word (R81: the newest
 *  word in the sweet spot, the camera riding along the words as they are bitten). Look-dev override: sc_ride=k. */
const RIDE = 0.32;

/** ROUND 5 HERO MACROS (R36; client 2026-11-22): one tight reframe per half-line onto its hero, opening on the hero's
 *  onset, already readable, at about MACRO_K x the line framing, close enough to see the bitten walls, the line so far
 *  still whole in frame (receding behind the hero). It leaves by a cut on the onset of a later word (a type-led
 *  reframe), at the line's cut, or (ease = 1, where a cut would make a second reframe in the half-line: lead
 *  2026-11-22) by a continuous eased pull-back into the line's own move (MACRO_EASE s, starting before the exit word).
 *  [line, hero word, exit word (-1: the cut), ease] (word indices in the line):
 *    DIRTY -> eases out from 50.58 onto SO (BUT YOUR LOVE'S bitten in the macro) | SWEET -> the cut
 *    PRETTY -> HEART (53.90, a downbeat) | (TEETH is the slam)
 *    DEVIL -> HANDS (its own macro, 57.36, a downbeat) | HANDS -> the cut (ON ME AND bitten in it)
 *    NEVER (the cut, 59.08) -> the second NEVER (59.73) | GO -> the plate's end */
const MACROS: [number, number, number, number][] = [[0, 2, 6, 1], [0, 7, -1, 0], [1, 2, 5, 0], [2, 2, 5, 0], [2, 5, -1, 0], [3, 1, 2, 0], [3, 6, -1, 0]];
/** ROUND 5 LIMB CHECK (R29, R31; lead 2026-11-22): no glyph of a word on screen may sit where the skin turns more than
 *  ~60 deg from the lens (n.v below this), nor behind the apple's silhouette. The solvers keep a margin over it. */
const LIMB_NV = 0.5, LIMB_NV_SOLVE = 0.51;
/** The eased exit: it starts this long before the exit word and lasts MACRO_EASE (>= 0.5 s). */
const MACRO_EASE = 0.6, MACRO_EASE_LEAD = 0.3;
/** The macro's hero scale over the line framing's (the brief: about 2x), the push inside it (the framing at its onset
 *  this much wider, eased in over the hero word: R80 <= 20%), and its slow drift round the hero (radians, whole macro). */
const MACRO_K = 2.0, MACRO_PUSH = 1.16, MACRO_DRIFT = 0.07;

/** ROUND 5 CARVING DEBRIS (R37, R79): chips of skin and flesh and a little dust from each bitten letter, graded:
 *  [chips per letter, dust per letter, speed (mm/s), life (s)] for a hero (tier 1) and a supporting word. */
const DEBRIS = { hero: [9, 7, 1.0, 0.55], sup: [2, 2, 0.55, 0.38] };
/** Gravity on the chips and the dust (mm/s^2, slowed: the macro's scale) and the dust's drag (1/s). */
const DEB_G = [210, 50], DEB_DRAG = 3.5;

/** ROUND 3: how much of the space to a neighbour on its row a posed word may take (each side). */
const SPACE_USE = 0.2;
/** ROUND 3: the key (degrees off the lens axis toward the light; degrees of that swung up from the left; its distance
 *  past the camera's, mm). Look-dev override: sc_key=a,b,d. */
const KEY = [48, 14, 240];
/** Where the pool is aimed from the line's centre (frame widths right, up). Look-dev override: sc_aim=x,y. */
const AIM = [-0.22, 0.08];
/** The strobe on its side bracket, lower and more grazing than the modelling lamp (same terms; sc_strobe=a,b), so a
 *  flash throws the letters' walls into longer shadow and harder edge light rather than brightening the skin. */
const STROBE = [62, 14];
/** The exhibit photograph's light (line 1's opening framing, the approved 48.75): a flash just off the lens. */
const EXHIBIT_KEY = [24, 40] as const;
/** The strobe's pool, in fractions of the frame's width at the subject: full light inside `in`, down to the `floor`
 *  level by `out`. Look-dev override: sc_pool=in,out,floor. */
const POOL = [0.0, 0.62, 0.0];
/** ROUND 4: the pool is feathered (hottest at its aim, falling linearly in angle raised to this power), so the face runs
 *  from the key side to black on the far side. Look-dev override: sc_gam=g. */
const POOL_GAM = 2.2;
/** The strobe: its burst over the modelling lamp (x strength) and its decay half-life (s): a few frames. */
const FLASH_GAIN = 3.2, FLASH_HL = 0.045;
/** ROUND 4: the burst on the close framings (look-dev override: sc_fg=g). */
const FLASH_GAIN_CLOSE = 2.4;
/** ROUND 4 WHITES: the wax coat's specular lobe (roughness, gain), the key's hot streak on the skin; the wet sheen of the
 *  cut flesh (gain). Look-dev overrides: sc_coat=rough,gain, sc_wet=gain. */
const COAT = [0.28, 3.5], WET = 8, CUT = 0.95;
/** ROUND 4: the key's level on the close framings (the feathered pool spends less light than the even disc; the
 *  exhibit framing keeps its approved level). Look-dev override: sc_ki=k. */
const KEY_I = 1.5;
/** ROUND 4: the strobe's strip tube: half length (mm) and tilt from the frame's vertical (degrees), so its reflection on the
 *  skin is a streak. Look-dev override: sc_strip=half,tilt. */
const STRIP = [110, 30];
/** ROUND 4 (fix): where the strip hangs from the key's point, per line (mm up, right of the frame), so the hot core lands
 *  above or beside the line's opening word, never behind it. Look-dev override: sc_stripc<k>=up,right. */
const STRIP_C: number[][] = [[0, 0], [200, -100], [80, -40], [0, 0]];
/** ROUND 5: the strip's length per line (x STRIP), so line 2's lower, more raking opener keeps r4's tight hot core. */
const STRIP_K = [1, 0.45, 0.8, 1];
/** ROUND 5 LIGHT FOLLOWS THE LINE: every word must face the key at least this much (n.l), and the pool reaches past the
 *  farthest word by this margin (frame widths). Look-dev overrides: sc_litnl, sc_litm. */
const LIT_NL = 0.3, LIT_MARGIN = 0.2;
/** ROUND 4 (fix): the coat's soft shoulder lobe (roughness, gain) under the tight core (COAT). Override: sc_coatb=r,g. */
const COAT_B = [0.5, 0.08];
/** TIER 1 FLASHES (R38): strength by hero (and the opening exhibit photograph); every other beat gets no flash.
 *  Line 1 sparse and low; line 2 building into the biggest on TEETH; the three NEVERs rising, then GO. */
const FLASH_K: Record<string, number | number[]> = {
  open: 0.75, dirty: 0.4, sweet: 0.5, pretty: 0.65, teeth: 1.0, devil: 0.6, hands: 0.65, never: [0.45, 0.62, 0.8], go: 0.95,
};

interface LWord {
  text: string; key: string; start: number; end: number; hero: boolean; cap: number; depth: number; wax: boolean;
  /** the word's letters on the band (cells in mm along it) and its rest extent and centre */
  kw: KinWord; x0: number; x1: number; cx: number;
  /** its cap box's centre height over the band's middle (its row) */
  hc: number;
  /** its row, and how far along the band its posed letters may reach (round 3: the spaces always read) */
  row: number; lim0: number; lim1: number;
  /** which NEVER (1..3; 0 otherwise) */
  rep: number;
  /** when its moves start: its onset, or earlier for a word already standing at its line's cut (it is read at once) */
  m0: number;
}
interface Line { k: number; t0: number; t1: number; words: LWord[]; band: BandLine; az0: number; path: LyricPath; plan: Plan; lp?: { p: THREE.Vector3; n: THREE.Vector3 }[] }
/** A full-frame slam (kinetic.ts): the hero breaks out of the photograph as flat type, from t0 to the next line. */
interface Slam { t0: number; t1: number; land: number; kw: KinWord; teeth: boolean }
/** A hero macro (MACROS), solved in the apple's rest frame: it looks at T from T + dir * dist (pushed in over pushDur),
 *  through a lens of half-height tanH, rolled, the apple held at turn psi; Ph the hero's centre (the focus); ratio its
 *  hero size over the line framing's, off its angle off square (deg), fov (deg). */
interface MacroF { T: THREE.Vector3; dir: THREE.Vector3; dist: number }
interface Macro { line: number; hero: string; t0: number; t1: number; ease: boolean; te: number; A: MacroF; path: LyricPath | null; tanH: number; ratioB: number; Ph: THREE.Vector3; psi: number; roll: number; pushDur: number; ratio: number; off: number; fov: number }
/** A debris particle (CARVING DEBRIS): born at ts at p0 (rest frame) with velocity v0, chips tumbling (axis ax, rate
 *  spin; the skin side n0), dust drifting. kind 0 a chip, 1 dust. */
interface Chip { line: number; ts: number; life: number; p0: THREE.Vector3; v0: THREE.Vector3; size: number; kind: number; flesh: boolean; ax: THREE.Vector3; n0: THREE.Vector3; spin: number; seed: number }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const AC = V(...LAY.AC);
/** A frame on the apple's flank (rest frame) at azimuth az (from +Z toward +X) and height h over its centre: the skin
 *  point C, its outward normal N, its tangent T (to the right, seen from outside), its up U. */
function flank(az: number, h: number, el = 0) {
  const N = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)), T = V(Math.cos(az), 0, -Math.sin(az));
  const U = new THREE.Vector3().crossVectors(N, T);
  // the body without its noise and wells (scale-glsl.ts appleBody): bisect outward along N
  const at = (k: number) => AC.clone().add(V(0, h, 0)).addScaledVector(N, k);
  let lo = 0, hi = 60;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (appleBody(at(m)) > 0) hi = m; else lo = m; }
  return { C: at(lo), N, T, U };
}
/** The apple's body without its noise and wells (scale-glsl.ts appleBody): signed distance-like, 0 on the skin. */
function appleBody(p: THREE.Vector3) {
  const c = Math.cos(LAY.AROT), s = Math.sin(LAY.AROT);
  const qx = p.x - AC.x, qy = p.y - AC.y, qz = p.z - AC.z;
  const lx = c * qx + s * qy, ly = -s * qx + c * qy;
  const hh = ly / LAY.AH;
  const rad = LAY.AR * (1 + 0.08 * hh - 0.06 * hh * hh) - 6.5 * Math.max(-hh, 0) ** 2;
  return Math.hypot(Math.hypot(lx, qz), (ly * LAY.AR) / LAY.AH) - rad;
}
/** ROUND 5: the skin's true outward normal at p (the body's gradient; flank()'s N is level, the skin tilts away
 *  above and below the apple's middle). */
function skinN(p: THREE.Vector3) {
  const e = 0.05, d = (x: number, y: number, z: number) => appleBody(V(p.x + x, p.y + y, p.z + z));
  return V(d(e, 0, 0) - d(-e, 0, 0), d(0, e, 0) - d(0, -e, 0), d(0, 0, e) - d(0, 0, -e)).normalize();
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

/** A camera: where it stands and looks, its basis, tan of its half fov; the apple's turn under it; D the framing's
 *  distance at the plate's lens (sizes the light and the focus); wide (the exhibit's share); onBand (the focus point);
 *  macro (the index of the hero macro in use, -1 on the line's own move). */
interface Cam { pos: THREE.Vector3; at: THREE.Vector3; fw: THREE.Vector3; rt: THREE.Vector3; up: THREE.Vector3; roll: number; tanH: number; psi: number; D: number; wide: number; onBand: THREE.Vector3; macro: number }
/** The camera's basis looking from pos at at, rolled by roll about its axis. */
function basis(pos: THREE.Vector3, at: THREE.Vector3, roll = 0) {
  const fw = at.clone().sub(pos).normalize();
  let rt = new THREE.Vector3().crossVectors(fw, UP).normalize();
  let up = new THREE.Vector3().crossVectors(rt, fw);
  if (roll) { rt = rt.applyAxisAngle(fw, roll); up = up.applyAxisAngle(fw, roll); }
  return { fw, rt, up };
}

export default class ScalePlate extends Scene {
  private march!: FSPass;
  private dof!: FSPass;
  private rt = makeRT();
  private lines: Line[] = [];
  private slams: Slam[] = [];
  private macros: Macro[] = [];
  private chips: Chip[] = [];
  /** the strobe's tier-1 firings: time, strength, line */
  private flashes: { t: number; k: number; line: number }[] = [];
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
        return { text, key, start: w.start, end: w.end, hero, wax, go, rep, row, i };
      });
      const band = bakeLine(ws.map((w) => ({
        text: w.text, serif: w.wax, chip: w.hero && !w.wax, row: w.row,
        // (round 3: line 1 is first seen from the exhibit's distance, so its supporting words and DIRTY are set larger:
        // R22's 5% floor while the camera is still pushing in, and DIRTY's R21 hero scale)
        cap: w.wax ? CAP.serif : w.go ? CAP.go : w.key === 'teeth' ? CAP.teeth : w.hero ? (k === 0 ? CAP.hero1 : CAP.hero) : k === 0 && w.row === 0 ? CAP.open : k === 0 ? (w.row === 1 ? CAP.sup1b : CAP.sup1) : CAP.sup,
        condense: w.rep > 1 ? [1, 1, 0.8, 0.64][w.rep] : 1,
      })), { top: ROW_TOP[k] ?? 19, gap: ROW_GAP[k] ?? 2.6 });
      const words: LWord[] = ws.map((w, i) => {
        const b = band.words[i]!;
        return {
          text: w.text, key: w.key, start: w.start, end: w.end, hero: w.hero, wax: w.wax, rep: w.rep, cap: b.cap,
          depth: w.go ? DEPTH.go : w.hero ? DEPTH.hero : DEPTH.sup,
          kw: KinWord.fromCells(w.wax ? w.text.toLowerCase() : w.text.toUpperCase(), b.cap / 0.72, b.cells, { family: w.wax ? 'serif' : 'archivo', width: 62 }),
          x0: b.x0, x1: b.x1, cx: b.cx, hc: b.hc, row: w.row, lim0: -1e9, lim1: 1e9,
          // a word sung at (or before) the cut already stands in the first frame (its letters sprang 0.17 s ahead)
          m0: w.start < t0 + 0.05 ? Math.min(w.start, t0 - 0.12) : w.start,
        };
      });
      // ROUND 3 SPACING: how far each posed word may reach (stamps, stretches, NEVER's landing): a fifth of the space
      // to a neighbour on its row, so at least three fifths of every space always reads; a row's ends a quarter cap
      words.forEach((w, i) => {
        const p = words[i - 1], n = words[i + 1];
        w.lim0 = p && p.row === w.row ? w.x0 - SPACE_USE * (w.x0 - p.x1) : w.x0 - 0.25 * w.cap;
        w.lim1 = n && n.row === w.row ? w.x1 + SPACE_USE * (n.x0 - w.x1) : w.x1 + 0.25 * w.cap;
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

    // ROUND 3 FLASHES: the opening photograph (the approved first flash) and each hero's onset, nothing else
    this.flashes.push({ t: this.ctx.start, k: FLASH_K.open as number, line: 0 });
    for (const L of this.lines) {
      for (const w of L.words) {
        const s = FLASH_K[w.key];
        if (!w.hero || s === undefined) continue;
        const k = Array.isArray(s) ? s[Math.max(0, w.rep - 1)] ?? s[s.length - 1]! : s;
        this.flashes.push({ t: w.start, k, line: L.k });
      }
    }
    this.flashes.sort((a, b) => a.t - b.t);

    // ROUND 2B CAMERA: each line's one move frames the line SO FAR, whole. One key per word, on its onset (less a
    // lead): the box round every word sung by then (rows included), its centre on the frame's centre and the camera
    // as far back as the box needs (title-safe margins), never nearer than DMIN. The move from one key to the next
    // runs over the whole of the word before, so the camera leads: the room for the next word is made before it
    // lands, and the line is never cropped. As the line grows the box only grows (rows are left-aligned and run
    // down), so the camera eases right, down and gently back, one way only, into the beats (LyricPath); the line
    // opens close (its first word alone fills the frame's middle). Line 1 starts on the exhibit and pushes in.
    const DMIN = 58 * LENS;
    for (const L of this.lines) {
      // (look-dev overrides per line: sc_daz<k>=from,to and sc_psi<k>=turn)
      const dq = qv('daz' + L.k), pq0 = qv('psi' + L.k);
      if (dq || pq0) L.plan = { ...L.plan, daz: (dq as [number, number]) ?? L.plan.daz, psi0: pq0?.[0] ?? L.plan.psi0 };
      const P = L.plan, n = L.words.length;
      const prog = (t: number) => clamp((t - L.t0) / Math.max(1e-3, L.t1 - L.t0));
      const ride = qv('ride')?.[0] ?? RIDE;
      const box = (i: number) => {
        let s0 = 1e9, s1 = -1e9, h0 = 1e9, h1 = -1e9;
        for (const w of L.words.slice(0, i + 1)) {
          s0 = Math.min(s0, w.x0); s1 = Math.max(s1, w.x1 + (w.rep ? 0.12 * (w.x1 - w.x0) : 0));
          h1 = Math.max(h1, w.hc + (w.wax ? 0.75 : 0.5) * w.cap); h0 = Math.min(h0, w.hc - (w.wax ? 0.3 : 0.5) * w.cap);
        }
        // (round 5: the framing leans down toward the newest word's row (RIDE), so the camera rides down the rows as they
        // are bitten and the newest sits nearer the frame's middle; the box is still framed whole round that point; only
        // down, never back along a row, so the move never reverses)
        const wn = L.words[i]!, s = (s0 + s1) / 2, h = lerp((h0 + h1) / 2, wn.hc, ride);
        const ws = 2 * Math.max(s1 - s, s - s0), hs = 2 * Math.max(h1 - h, h - h0);
        // on the curved band the line's ends turn away: frame its chord, and leave room for stamps and stretch
        const chord = 2 * RB * Math.sin(Math.min(1.5, ws / (2 * RB)));
        const D = Math.max(DMIN, (chord + 8) / (FW_D * 0.77), (hs + 4) / (FH_D * 0.74));
        // hn: the newest row's height (the camera tilts to sit square to it, so the row being written reads flat)
        return { s, h, D, hn: wn.hc };
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

    if (QP?.get("sc_rows")) for (const L of this.lines) console.warn("SCROWS " + L.k + " " + L.words.map((w) => `${w.text}[r${w.row} ${w.x0.toFixed(0)}..${w.x1.toFixed(0)} h${w.hc.toFixed(0)} c${w.cap}]`).join(" "));
    // ROUND 5 LIGHT FOLLOWS THE LINE: the corners of every word of each line (rest frame) with the skin's normal there
    for (const L of this.lines) {
      L.lp = [];
      for (const w of L.words) for (const sx of [w.lim0, (w.lim0 + w.lim1) / 2, w.lim1]) for (const h of [w.hc - 0.5 * w.cap, w.hc + 0.5 * w.cap]) {
        const C = flank(L.az0 + sx / RB, HB + h).C;
        L.lp.push({ p: C, n: skinN(C) });
      }
    }
    // ROUND 5 HERO MACROS: solved once (each against the line framing alone, so a macro chained onto another is sized
    // against the line), then opened
    const solved = (QP?.get("sc_rows") ? [] : MACROS.filter(([k]) => this.lines[k]).map(([k, hi, xi, ez], idx) => this.solveMacro(this.lines[k]!, hi, xi, idx, !!ez))).filter((x): x is Macro => !!x);
    this.macros = solved;

    // ROUND 5 CARVING DEBRIS: as each letter is bitten (its spring's onset), chips of skin (stone yellow on one side,
    // cream flesh on the other) and a little dust spray from the cut, out of the skin and away down the apple (the
    // rows below are not bitten yet, so nothing crosses a standing word), falling out of frame or gone within ~0.5 s.
    // Graded: heroes (tier 1) a real burst; supporting words a small puff; nothing between words.
    let seed = 0x5ca1e;
    const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const rv = () => V(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    for (const L of this.lines) {
      for (const w of L.words) {
        const [nc, nd, sp, life] = w.hero ? DEBRIS.hero : DEBRIS.sup;
        const stagger = w.hero ? (w.key === 'sweet' ? 0.025 : 0.02) : 0.018;
        w.kw.glyphs.forEach((g, gi) => {
          const ts = w.m0 - 0.045 + gi * stagger;
          for (let j = 0; j < nc! + nd!; j++) {
            const dust = j >= nc!;
            const f = flank(L.az0 + (g.cx + (rnd() - 0.5) * g.adv * 0.8) / RB, HB + w.hc + (rnd() - 0.5) * w.cap * 0.9);
            const s = sp! * (0.5 + rnd());
            const v0 = skinN(f.C).multiplyScalar((22 + 30 * rnd()) * s).addScaledVector(f.T, (rnd() - 0.4) * 40 * s).addScaledVector(f.U, (-0.15 - 0.55 * rnd()) * 40 * s);
            this.chips.push({
              line: L.k, ts: ts + rnd() * 0.03, life: life! * (dust ? 1.2 : 0.7 + 0.5 * rnd()), p0: f.C.clone().addScaledVector(f.N, 0.3), v0,
              size: dust ? 0.05 + 0.06 * rnd() : (w.hero ? 0.22 : 0.15) + (w.hero ? 0.45 : 0.2) * rnd() ** 2, kind: dust ? 1 : 0,
              flesh: rnd() < 0.45, ax: rv(), n0: rv(), spin: 8 + 22 * rnd(), seed: rnd(),
            });
          }
        });
      }
    }

    this.march = new FSPass(MARCH_FRAG, {
      ssTap: SS_TAP,
      camPos: { value: V(0, 0, 0) }, camR: { value: V(0, 0, 0) }, camU: { value: V(0, 0, 0) }, camF: { value: V(0, 0, 0) },
      tanH: { value: 0.3 },
      keyPos: { value: V(0, 0, 0) }, keyDir: { value: V(0, -1, 0) }, keyI: { value: 1 }, keyRad: { value: 10 }, keyCone: { value: 0.8 }, keyOut: { value: 0.74 }, keyFloor: { value: 0.3 }, keyShape: { value: 0 }, keyGam: { value: 1 },
      fillDir: { value: V(0, 1, 0) }, fillI: { value: 0.02 },
      lineTex: { value: this.lines[0]!.band.tex }, labelTex: { value: label }, digitTex: { value: digits },
      coatK: { value: 1 }, coatS: { value: new THREE.Vector2(COAT[0]!, COAT[1]!) }, wetS: { value: WET }, cutK: { value: 0.5 }, keyStrip: { value: V(0, 0, 0) }, keyStripC: { value: V(0, 0, 0) }, coatB: { value: new THREE.Vector2() }, coatF: { value: 1 }, aYaw: { value: new THREE.Vector2(1, 0) },
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

  /** The camera at t on line Ln: a hero macro while one is open, else the line's one move. */
  private cam(Ln: Line, t: number): Cam {
    for (let mi = 0; mi < this.macros.length; mi++) {
      const M = this.macros[mi]!;
      if (M.line !== Ln.k || t < M.t0 - 1e-6) continue;
      if (t < M.t1 - 1e-6) return this.macroCam(mi, t);
      // the eased exit: the macro (held at its last frame) pulls back into the line's own move, continuously
      if (M.ease && t < M.te - 1e-6) return this.blendCam(this.macroCam(mi, t), this.lineCam(Ln, t), ease.inOutCubic(clamp((t - M.t1) / (M.te - M.t1))));
    }
    return this.lineCam(Ln, t);
  }

  /** Two cameras blended in the apple's rest frame (target, direction, log distance and lens, roll, the apple's turn). */
  private blendCam(a: Cam, b: Cam, w: number): Cam {
    const psi = a.psi + w * Math.atan2(Math.sin(b.psi - a.psi), Math.cos(b.psi - a.psi));
    const atA = turn(a.at, -a.psi), atB = turn(b.at, -b.psi);
    const dA = turn(a.pos, -a.psi).sub(atA), dB = turn(b.pos, -b.psi).sub(atB);
    const lg = (x: number, y: number) => Math.exp(lerp(Math.log(x), Math.log(y), w));
    const dist = lg(dA.length(), dB.length()), dir = dA.normalize().lerp(dB.normalize(), w).normalize();
    const atR = atA.lerp(atB, w), roll = lerp(a.roll, b.roll, w);
    const pos = turn(atR.clone().addScaledVector(dir, dist), psi), at = turn(atR, psi);
    const { fw, rt, up } = basis(pos, at, roll);
    const onBand = turn(turn(a.onBand, -a.psi).lerp(turn(b.onBand, -b.psi), w), psi);
    return { pos, at, fw, rt, up, roll, tanH: lg(a.tanH, b.tanH), psi, D: lg(a.D, b.D), wide: lerp(a.wide, b.wide, w), onBand, macro: -1 };
  }

  /** A hero macro at t: the solved framing, pushed in over the hero word (MACRO_PUSH, eased) and drifting slowly round
   *  the hero (MACRO_DRIFT), the apple held at its turn from the macro's onset. */
  private macroCam(mi: number, t: number): Cam {
    const M = this.macros[mi]!;
    // the room path: from the opening (A) through a framing per word bitten in the macro, each reached just before its
    // word lands (a monotone spline eased into the beats, kinetic.ts LyricPath), so the newest word always has room
    let T = M.A.T, dir = M.A.dir.clone(), dist = M.A.dist, tanH = M.tanH;
    if (M.path) {
      const v = M.path.at(t);
      T = V(v[0]!, v[1]!, v[2]!); dir = V(v[3]!, v[4]!, v[5]!).normalize(); dist = Math.exp(v[6]!); tanH = Math.exp(v[7]!);
    } else dist *= lerp(MACRO_PUSH, 1, ease.inOutQuad(clamp((t - M.t0) / M.pushDur))); // the push into the hero (R80), where the macro does not make room
    const dr = MACRO_DRIFT * (mi % 2 ? 1 : -1) * (ease.inOutQuad(clamp((t - M.t0) / Math.max(0.2, M.t1 - M.t0))) - 0.5);
    const P = T.clone().addScaledVector(dir.applyAxisAngle(UP, dr), dist);
    const pos = turn(P, M.psi), at = turn(T, M.psi);
    const { fw, rt, up } = basis(pos, at, M.roll);
    const tanF = Math.tan((FOV * Math.PI) / 360);
    return { pos, at, fw, rt, up, roll: M.roll, tanH, psi: M.psi, D: (dist * tanH) / tanF, wide: 0, onBand: turn(M.Ph, M.psi), macro: mi };
  }

  /** ROUND 5: solve a hero macro (MACROS). A, its opening: searched over the camera's direction round the hero (rest
   *  frame) and three lenses, the framing that brings the hero closest to MACRO_K x its size in the line framing while
   *  every word of the line so far stays whole inside the frame (inside title-safe, with room for stamps), each at a
   *  readable size (>= 6.4% cap) and no part of it turned more than ~65 deg from the lens (the hero ~57). Among framings
   *  that reach the target it prefers the hero seen 14-32 deg off square (the bitten walls show). B, if words are bitten
   *  before the macro leaves: the same lens, a direction near A's, with room for them; the camera eases from A to B as
   *  they arrive (riding along, one way). */
  private solveMacro(L: Line, hi: number, xi: number, idx: number, easeOut: boolean): Macro | null {
    const hero = L.words[hi]!;
    const t0 = hero.start;
    // an eased exit starts before its exit word and runs MACRO_EASE (or to the line's cut); the room framing then holds
    // every word bitten before the pull-back ends
    // (a cut exit lands two frames before its word, so the word springs in the line's framing; onto another macro's
    // hero it lands on the onset, so the two macros meet with no frame between)
    const chained = xi >= 0 && MACROS.some(([k, h]) => k === L.k && h === xi);
    const t1 = xi < 0 ? L.t1 : easeOut ? L.words[xi]!.start - MACRO_EASE_LEAD : L.words[xi]!.start - (chained ? 0 : 0.07);
    const te = easeOut ? Math.min(t1 + MACRO_EASE, L.t1) : t1;
    const last = xi < 0 ? L.words.length - 1 : easeOut ? L.words.filter((w) => w.start < te).length - 1 : xi - 1;
    const at = (s: number, h: number) => flank(L.az0 + s / RB, HB + h);
    const roll = L.plan.roll[0] * 0.5 + (idx % 2 ? 0.05 : -0.05);
    const asp = 16 / 9, BX = 0.8, BY = 0.74;
    type Pt = { p: THREE.Vector3; N: THREE.Vector3; hero: boolean };
    type CapS = { c: THREE.Vector3; a: THREE.Vector3; b: THREE.Vector3; N: THREE.Vector3; hero: boolean; row: number; mm: number };
    const geom = (ws: LWord[]) => {
      const pts: Pt[] = [], caps: CapS[] = [];
      for (const w of ws) {
        const top = w.hc + (w.wax ? 0.75 : 0.55) * w.cap, bot = w.hc - (w.wax ? 0.3 : 0.55) * w.cap;
        const x1 = w.rep ? Math.max(w.lim1, w.x1 + 0.35 * (w.x1 - w.x0)) : w.lim1;
        for (const s of [w.lim0, (w.lim0 + x1) / 2, x1]) for (const h of [top, bot]) { const f = at(s, h); pts.push({ p: f.C, N: skinN(f.C), hero: w === hero }); }
        const f = at(w.cx, w.hc);
        caps.push({ c: f.C, a: at(w.cx, w.hc - w.cap / 2).C, b: at(w.cx, w.hc + w.cap / 2).C, N: skinN(f.C), hero: w === hero, row: w.row, mm: w.cap });
      }
      return { pts, caps, cen: pts.reduce((a, q) => a.add(q.p), V(0, 0, 0)).multiplyScalar(1 / pts.length) };
    };
    const Ph = at(hero.cx, hero.hc).C;
    const proj = (pos: THREE.Vector3, B: ReturnType<typeof basis>, tanH: number, p: THREE.Vector3) => {
      const q = p.clone().sub(pos), z = q.dot(B.fw);
      return [q.dot(B.rt) / (z * tanH * asp), q.dot(B.up) / (z * tanH), z] as const;
    };
    const capOf = (pos: THREE.Vector3, B: ReturnType<typeof basis>, tanH: number, c: CapS) => {
      const a = proj(pos, B, tanH, c.a), b = proj(pos, B, tanH, c.b);
      return Math.hypot((a[0] - b[0]) * asp, a[1] - b[1]) / 2;
    };
    // the line framing's hero size at the onset (the reference for MACRO_K)
    const lc = this.lineCam(L, t0), g0 = geom(L.words.slice(0, hi + 1)), wHero = g0.caps.find((c) => c.hero)!;
    const lineCap = capOf(lc.pos, { fw: lc.fw, rt: lc.rt, up: lc.up }, lc.tanH, { ...wHero, a: turn(wHero.a, lc.psi), b: turn(wHero.b, lc.psi) });
    type Sol = { T: THREE.Vector3; dir: THREE.Vector3; dist: number; tanH: number; cap: number; sup: number; off: number; score: number };
    let rej: number[] = [];
    // (round 5: in a room framing the newest row is never the smallest on screen)
    const newRow = L.words[last]!.row;
    const search = (g: ReturnType<typeof geom>, fovs: number[], dirs: THREE.Vector3[], target: number, rowRule = false): Sol | null => {
      const fit = (dir: THREE.Vector3, tanH: number) => {
        let T = Ph.clone().lerp(g.cen, 0.5), D = 0;
        for (let pass = 0; pass < 3; pass++) {
          const B = basis(T.clone().addScaledVector(dir, 100), T, roll);
          const ok = (d: number) => {
            const pos = T.clone().addScaledVector(dir, d);
            for (const q of g.pts) { const [x, y, z] = proj(pos, B, tanH, q.p); if (z < 3 || Math.abs(x) > BX || Math.abs(y) > BY) return false; }
            return true;
          };
          let lo = 4, hi2 = 700;
          if (!ok(hi2)) return null;
          for (let it = 0; it < 22; it++) { const m = (lo + hi2) / 2; if (ok(m)) hi2 = m; else lo = m; }
          D = hi2;
          if (pass === 2) break;
          const pos = T.clone().addScaledVector(dir, D);
          let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
          for (const q of g.pts) { const [x, y] = proj(pos, B, tanH, q.p); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
          T = T.addScaledVector(B.rt, ((x0 + x1) / 2) * D * tanH * asp).addScaledVector(B.up, ((y0 + y1) / 2) * D * tanH);
        }
        return { T, D };
      };
      let best: Sol | null = null;
      rej = [0, 0, 0, 0, 0, 0];
      for (const fov of fovs) {
        const tanH = Math.tan((fov * Math.PI) / 360);
        for (const dir of dirs) {
          const f = fit(dir, tanH);
          if (!f) { rej[0]++; continue; }
          // every part of every word faces the lens well enough to read: stand further back until it does (a nearer
          // lens sees the line's ends more obliquely)
          const faces = (p: THREE.Vector3) => !g.pts.some((q) => q.N.dot(p.clone().sub(q.p).normalize()) < (q.hero ? LIMB_NV_SOLVE + 0.05 : LIMB_NV_SOLVE));
          let pos = f.T.clone().addScaledVector(dir, f.D);
          for (const k of [1.25, 1.6, 2.1, 2.8, 2, 2]) { if (faces(pos)) break; f.D = f.D * (k / (k === 1.25 ? 1 : 1)); pos = f.T.clone().addScaledVector(dir, f.D); }
          if (pos.y < 6 || pos.distanceTo(AC) < LAY.AR + 8) { rej[1]++; continue; }
          if (!faces(pos)) { rej[2]++; continue; }
          const B = basis(pos, f.T, roll);
          let sup = 1, cap = 0, bad = false, off = 0, kNew = 1, kOld = 1;
          for (const c of g.caps) {
            const face = c.N.dot(pos.clone().sub(c.c).normalize());
            if (face < (c.hero ? 0.7 : 0.5)) { bad = true; break; }
            const k = capOf(pos, B, tanH, c);
            if (c.hero) { cap = k; off = Math.acos(face); } else sup = Math.min(sup, k);
            if (c.row === newRow) kNew = Math.min(kNew, k / c.mm); else kOld = Math.min(kOld, k / c.mm);
          }
          if (bad || (rowRule && kNew < 0.97 * kOld)) { rej[3]++; continue; }
          const eff = Math.min(cap, target), supEff = sup * (eff / cap);
          if (supEff < 0.058) { rej[4]++; continue; }
          const score = eff / target + (off > 0.24 && off < 0.56 ? 0.06 : 0) + 0.4 * Math.min(supEff, 0.11);
          if (!best || score > best.score) best = { T: f.T, dir, dist: f.D, tanH, cap, sup, off, score };
        }
      }
      if (best && best.cap > target) {
        // back off to the target size where the framing could go tighter
        const B = basis(best.T.clone().addScaledVector(best.dir, 100), best.T, roll);
        let lo = best.dist, hi2 = best.dist * 4;
        for (let it = 0; it < 22; it++) {
          const m = (lo + hi2) / 2;
          if (capOf(best.T.clone().addScaledVector(best.dir, m), B, best.tanH, g.caps.find((c) => c.hero)!) > target) lo = m; else hi2 = m;
        }
        best.cap = target; best.dist = hi2;
      }
      return best;
    };
    const An = L.az0 + hero.cx / RB, dirs: THREE.Vector3[] = [];
    for (let ia = -8; ia <= 8; ia++) for (let ie = -6; ie <= 8; ie++) dirs.push(dirAz(An + ia * 0.15, ie * 0.1));
    const A = search(g0, [10, 13, 18, 24, 32, 42], dirs, MACRO_K * lineCap);
    if (!A) {
      let best = -1, bd = "", worstP = -1;
      for (let az = -3.14; az < 3.14; az += 0.02) for (let el = -0.6; el < 1.3; el += 0.02) {
        const d = dirAz(az, el); let mn = 1, wi = -1;
        g0.pts.forEach((q, i) => { const v = q.N.dot(d); if (v < mn) { mn = v; wi = i; } });
        if (mn > best) { best = mn; bd = az.toFixed(2) + "," + el.toFixed(2); worstP = wi; }
      }
      const W = g0.pts[worstP]!;
      console.warn(`SCDBG ${hero.text}: best orthographic min n.d ${best.toFixed(2)} at az,el ${bd}; worst point ${worstP} p ${W.p.toArray().map((x) => x.toFixed(0))} n ${W.N.toArray().map((x) => x.toFixed(2))}`);
    }
    if (!A) { console.warn(`SCLIMB solve: no macro framing for ${hero.text} (rejected: fit, place, face, centre, size: ${rej.join()})`); return null; }
    // the room path: a framing per word bitten in the macro (and in its eased exit), on A's lens, near the framing
    // before it; held on A a moment, then each reached just before its word lands
    let Bs: Sol | null = null, path: LyricPath | null = null;
    if (last > hi) {
      const fA = [(Math.atan(A.tanH) * 360) / Math.PI], vec = (x: Sol) => [x.T.x, x.T.y, x.T.z, x.dir.x, x.dir.y, x.dir.z, Math.log(x.dist), Math.log(x.tanH)];
      const keys = [{ t: t0, v: vec(A) }, { t: t0 + Math.min(0.2, 0.4 * (L.words[hi + 1]!.start - t0)), v: vec(A) }];
      let prev = A;
      for (let j = hi + 1; j <= last; j++) {
        const near: THREE.Vector3[] = [];
        for (let ia = -3; ia <= 3; ia++) for (let ie = -3; ie <= 3; ie++) near.push(prev.dir.clone().applyAxisAngle(UP, ia * 0.1).add(V(0, ie * 0.08, 0)).normalize());
        const gB = geom(L.words.slice(0, j + 1));
        const fAll = [10, 13, 18, 24, 32];
        // (the best of: A's lens near the framing before, A's lens anywhere, any lens anywhere; the newest-row rule unless none passes)
        const cands = [search(gB, fA, near, prev.cap, true), search(gB, fA, dirs, prev.cap, true), search(gB, fAll, dirs, prev.cap, true)].filter((x): x is Sol => !!x);
        const F = cands.length ? cands.reduce((a, b) => (b.cap > a.cap * 1.04 ? b : a)) : search(gB, fAll, dirs, prev.cap);
        if (!F) { console.warn(`SCLIMB solve: no room framing for ${L.words[j]!.text} in the macro on ${hero.text} (rejected: ${rej.join()})`); continue; }
        keys.push({ t: Math.max(keys[keys.length - 1]!.t + 0.12, L.words[j]!.start - 0.08), v: vec(F) });
        prev = Bs = F;
      }
      path = new LyricPath(keys, { clk: this.clk, settle: 0.2, down: 0.1 });
    }
    return {
      line: L.k, hero: hero.text, t0, t1, ease: easeOut, te, A, path, tanH: A.tanH, Ph, psi: lc.psi,
      roll, pushDur: Math.max(0.4, hero.end - hero.start), ratio: A.cap / lineCap, ratioB: Bs ? Bs.cap / lineCap : A.cap / lineCap,
      off: (A.off * 180) / Math.PI, fov: (Math.atan(A.tanH) * 360) / Math.PI,
    };
  }

  /** The line's own camera at t: the line's one move (LyricPath), the apple turned under it (psi). D: the distance the
   *  framing would have at the plate's lens (FOV), which sizes the light's pool and the depth of field. */
  private lineCam(Ln: Line, t: number): Cam {
    const [sf, hf, D, az, el0, roll, daz, wide, hn] = Ln.path.at(t) as [number, number, number, number, number, number, number, number, number];
    const psi = az - daz - (Ln.az0 + sf / RB);
    const onBand = turn(flank(Ln.az0 + sf / RB, HB + hf).C, psi);
    const at = onBand.clone().lerp(EXHIBIT, 0.7 * wide);
    // the camera's elevation follows the rows down the apple's curve (square to the line it frames)
    // (never below the cloth: at least 10 mm over the table)
    const el = Math.max(el0 + (1 - wide) * 0.75 * Math.atan2(HB + lerp(hf, hn, 0.6), LAY.AR), Math.asin(clamp((10 - at.y) / D, -1, 1)));
    const pos = at.clone().addScaledVector(dirAz(az, el), D);
    const qc = qv('cam');
    if (qc) { pos.set(qc[0]!, qc[1]!, qc[2]!); at.set(qc[3]!, qc[4]!, qc[5]!); }
    const { fw, rt, up } = basis(pos, at, roll);
    return { pos, at, fw, rt, up, roll, tanH: Math.tan((FOV * Math.PI) / 360), psi, D, wide, onBand, macro: -1 };
  }

  /** ROUND 5 LIMB CHECK: every glyph of every word drawn at t (its four corners and centre, posed by the kit, on the
   *  skin) against the frame's camera: the skin's true normal must face the lens (n.v >= LIMB_NV) and nothing of the
   *  apple may stand between (a march from the glyph toward the lens through the body). Returns the worst n.v and
   *  the glyphs that fail. */
  private limb(Ln: Line, t: number, cm: Cam) {
    const hits: { word: string; nv: number; occ: boolean }[] = [];
    let worst = 1;
    const camR = turn(cm.pos, -cm.psi);
    for (const w of Ln.words) {
      if (t < w.m0 - 0.4) continue;
      const P = this.wordPose(w, t);
      let bad: { nv: number; occ: boolean } | null = null;
      P.glyphs.forEach((p, i) => {
        const g = w.kw.glyphs[i]!;
        if (p.on <= 0.02 || !g.ch.trim()) return;
        const cy = w.hc - p.y, hx = (g.adv * p.sx) / 2, hy = (w.cap * p.sy) / 2, cs = Math.cos(-p.rot), sn = Math.sin(-p.rot);
        for (const [lx, ly] of [[-hx, hy], [hx, hy], [hx, -hy], [-hx, -hy], [0, 0]] as const) {
          const C = flank(Ln.az0 + (p.cx + lx * cs - ly * sn) / RB, HB + cy + lx * sn + ly * cs).C;
          const v = camR.clone().sub(C), dist = v.length();
          v.divideScalar(dist);
          const nv = skinN(C).dot(v);
          worst = Math.min(worst, nv);
          let occ = false;
          if (nv >= LIMB_NV) for (let k = 1; k <= 24 && !occ; k++) occ = appleBody(C.clone().addScaledVector(v, 1.5 + Math.min(dist, 160) * (k / 24) ** 2)) < -0.3;
          if (nv < LIMB_NV || occ) { if (!bad || nv < bad.nv) bad = { nv, occ }; }
        }
      });
      if (bad) hits.push({ word: w.text, ...(bad as { nv: number; occ: boolean }) });
    }
    return { worst, hits };
  }

  /** sc_limb=1: the limb check over the whole window, every frame (console warnings, printed by render.ts): each word
   *  that fails, the span it fails over and its worst n.v; then the total. */
  private logLimb() {
    const fails = new Map<string, { t0: number; t1: number; nv: number; occ: boolean; n: number }>();
    let frames = 0, hitFrames = 0, worst = 1;
    for (let t = this.ctx.start; t < this.ctx.end - 1e-6; t += 1 / 30) {
      if (this.slams.some((x) => t >= x.t0 - 1e-6 && t < x.t1)) continue;
      const Ln = this.lineAt(t), r = this.limb(Ln, t, this.cam(Ln, t));
      frames++; worst = Math.min(worst, r.worst);
      if (r.hits.length) hitFrames++;
      for (const h of r.hits) {
        const k = `L${Ln.k + 1} ${h.word}`, e = fails.get(k);
        if (e) { e.t1 = t; e.nv = Math.min(e.nv, h.nv); e.occ ||= h.occ; e.n++; } else fails.set(k, { t0: t, t1: t, nv: h.nv, occ: h.occ, n: 1 });
      }
    }
    for (const [k, e] of fails) console.warn(`SCLIMB ${k} ${e.t0.toFixed(2)}-${e.t1.toFixed(2)} (${e.n} frames): worst n.v ${e.nv.toFixed(2)}${e.occ ? ', occluded' : ''}`);
    console.warn(`SCLIMB total: ${hitFrames} of ${frames} frames with a glyph past the limb (n.v < ${LIMB_NV} or occluded); worst n.v over all glyphs ${worst.toFixed(2)}`);
  }

  /** sc_log=1: the camera's travel per line (console warnings, printed by render.ts): its orbit round the apple in the
   *  apple's own frame (degrees, summed along the move) and in the room, and the apple centre's travel on screen (px at
   *  1080p, summed), measured on the continuous moves only (a reframe's jump is not travel). */
  private logged = false;
  private limbLogged = false;
  private logTravel() {
    const H2 = 540, W2 = 960, deg = (r: number) => ((r * 180) / Math.PI).toFixed(0);
    // one pass over a line: "seen" is the camera as cut (line move and macros; a reframe's jump is not travel), "path"
    // the line's own move alone, as if no macro interrupted it (round 4 had only this)
    const pass = (L: Line, t1: number, f: (t: number) => Cam) => {
      type Smp = { dR: THREE.Vector3; sx: number; sy: number; mac: number };
      let orb = 0, scr = 0, jumps = 0, prev = null as Smp | null, Dmin = 1e9, Dmax = 0;
      for (let t = L.t0; t < t1 - 1e-6; t += 1 / 30) {
        const c = f(t);
        const dR = c.pos.clone().sub(AC).normalize().applyAxisAngle(UP, -c.psi);
        const q = AC.clone().sub(c.pos), z = q.dot(c.fw);
        const cur: Smp = { dR, sx: W2 + (q.dot(c.rt) / (z * c.tanH * (16 / 9))) * W2, sy: H2 - (q.dot(c.up) / (z * c.tanH)) * H2, mac: c.macro };
        const ds = prev ? Math.hypot(cur.sx - prev.sx, cur.sy - prev.sy) : 0;
        if (prev && (prev.mac === cur.mac || ds < 40)) { orb += prev.dR.angleTo(dR); scr += ds; } else if (prev) jumps++;
        if (c.macro < 0) { Dmin = Math.min(Dmin, c.D); Dmax = Math.max(Dmax, c.D); }
        prev = cur;
      }
      return `orbit ${deg(orb)} deg, apple centre ${scr.toFixed(0)} px, framing ${(Dmax / Dmin).toFixed(2)}x${jumps ? `, reframes ${jumps}` : ""}`;
    };
    for (const L of this.lines) {
      const t1 = Math.min(L.t1, ...this.slams.map((x) => (x.t0 >= L.t0 ? x.t0 : Infinity)));
      for (const M of this.macros.filter((x) => x.line === L.k)) console.warn(`SCLOG   macro ${M.hero} ${M.t0.toFixed(2)}-${M.t1.toFixed(2)}: ${M.ratio.toFixed(2)}x the line's hero (${M.ratioB.toFixed(2)}x with room), ${M.off.toFixed(0)} deg off square, fov ${M.fov.toFixed(0)}`);
      console.warn(`SCLOG line ${L.k + 1} ${L.t0.toFixed(2)}-${t1.toFixed(2)}: path: ${pass(L, t1, (t) => this.lineCam(L, t))}; seen: ${pass(L, t1, (t) => this.cam(L, t))}`);
    }
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
    // ROUND 3: the word is held inside its reach (lim0..lim1): a stamp or stretch that would close a space is taken
    // up by scaling the word about its own box instead, so the gap to each neighbour never shuts
    let e0 = 1e9, e1 = -1e9;
    P.glyphs.forEach((g, i) => {
      const h = (w.kw.glyphs[i]!.adv / 2) * Math.abs(g.sx);
      e0 = Math.min(e0, g.cx - h); e1 = Math.max(e1, g.cx + h);
    });
    if (e1 > e0 && (e0 < w.lim0 || e1 > w.lim1)) {
      const n0 = Math.max(e0, w.lim0), n1 = Math.min(e1, w.lim1), k = Math.max(0.05, (n1 - n0) / (e1 - e0));
      for (const g of P.glyphs) { g.cx = n0 + (g.cx - e0) * k; g.sx *= k; }
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
        // (round 3: graded, R79: a supporting word's stamp is a tier-3 hit; a hero's lands with its flash, tier 1)
        shake = Math.max(shake, P.shake * (!w.hero ? 1.5 : w.wax ? 4 : w.key === 'go' ? 12 : 9));
      }
    }
    m.lnNW!.value = nw;
    (m.lnS!.value as THREE.Vector2).set(s0, s1);
    m.lineTex!.value = Ln.band.tex;
    (m.lineRect!.value as THREE.Vector4).set(...Ln.band.rect);
    (m.band!.value as THREE.Vector4).set(Ln.az0, HB, RB, hmax + 1.5);

    // ---- the camera: one move along the line (kinetic.ts LyricPath), the apple turning under it, or a hero macro
    if (QP?.get('sc_log') && !this.logged) { this.logged = true; this.logTravel(); }
    if (QP?.get('sc_limb') && !this.limbLogged) { this.limbLogged = true; this.logLimb(); }
    const cm = this.cam(Ln, t);
    const { pos, at, fw, rt, up, psi, D, wide, onBand } = cm;
    (m.aYaw!.value as THREE.Vector2).set(Math.cos(psi), Math.sin(psi));
    (m.camPos!.value as THREE.Vector3).copy(pos);
    (m.camF!.value as THREE.Vector3).copy(fw);
    (m.camR!.value as THREE.Vector3).copy(rt);
    (m.camU!.value as THREE.Vector3).copy(up);
    m.tanH!.value = cm.tanH;
    if (kinProbeOn()) this.kinProbe(Ln, t, pos, fw, rt, up, psi, cm.tanH); // type probe (lint only)

    // ---- ROUND 3 LIGHT: one hard key, a strobe head on a stand off to the left, raking LOW across the apple's face
    // (KEY: degrees off the lens axis, degrees of that swung up from the left), so every bitten letter has black
    // shadow walls on the side away from it and bright cream edges on the side facing it, and the skin falls off
    // across the apple's curve toward film-black. Its modelling lamp lights the shot between flashes; the strobe
    // fires from the same head (the flash: FLASHES, tier 1 only), throwing the letters into hard shadow and edge
    // light for a few frames, never a whole-frame pop (the light is in the scene, not on the film).
    const Dn = D / LENS, far = clamp((Dn - 60) / 130);
    const kq = qv('key') ?? KEY, sq = qv('strobe') ?? STROBE;
    const { fl, lamp } = this.light(t);
    // (round 4: on the close framings the burst is a little lower (FLASH_GAIN_CLOSE), so a flash rakes the letters into
    // edge light without washing the brighter, feathered face toward white; the exhibit's first flash is unchanged)
    const FG = lerp(qv('fg')?.[0] ?? FLASH_GAIN_CLOSE, FLASH_GAIN, wide);
    // (the strobe's burst outshines the lamp: the light's direction follows whichever dominates)
    const wf = (FG * fl) / (lamp + FG * fl);
    // (on the exhibit framing, the approved first flash, the light is the photograph's: near the lens, upper left, so
    // the bite's flesh, the white scale and its label read; it swings round to the rake as the camera pushes in)
    // (round 5: the pool and the rake follow the whole line, so no word falls past the light into black)
    const LL = this.lineLight(Ln, cm, kq[0]!, kq[1]!), dka = LL.dka * (1 - wide);
    const ka = (lerp(lerp(kq[0]! - dka, sq[0]! - dka, wf), EXHIBIT_KEY[0], wide) * Math.PI) / 180;
    const kb = (lerp(lerp(kq[1]!, sq[1]!, wf), EXHIBIT_KEY[1], wide) * Math.PI) / 180;
    const kDir = fw.clone().multiplyScalar(-Math.cos(ka)).addScaledVector(rt, -Math.sin(ka) * Math.cos(kb)).addScaledVector(up, Math.sin(ka) * Math.sin(kb)).normalize();
    const key = at.clone().addScaledVector(kDir, kq[2]! + 0.6 * D);
    (m.keyPos!.value as THREE.Vector3).copy(key);
    const I = lerp(2.1, 1.5, far) * lerp(qv('ki')?.[0] ?? KEY_I, 1, wide);
    m.keyI!.value = (I * key.distanceToSquared(at)) / 1e5 * (lamp + FG * fl);
    // the strobe's tube is smaller than the modelling lamp's glow: the flash's shadows are the hardest
    m.keyRad!.value = lerp(2.4, 3.6, far) * (1 - 0.5 * clamp(fl));
    // (aimed toward the key's side of the line's centre (AIM, in frame widths): the key side of the face is the
    // brightest and the apple's own curve carries the light down toward shadow on the far side, a gradient across
    // the face rather than an even disc; the pool's top and bottom edges fall to film-black)
    const am = qv('aim') ?? LL.aim;
    const aim = at.clone().addScaledVector(rt, am[0]! * FW_D * D * (1 - wide)).addScaledVector(up, am[1]! * FW_D * D * (1 - wide));
    (m.keyDir!.value as THREE.Vector3).copy(aim.sub(key).normalize());
    // the pool: a snooted strobe aimed at the line so far, full over the line's middle and falling toward film-black
    // at the frame's edges (the close openers are never a flat field of yellow); the exhibit's flash is broad
    const kd = key.distanceTo(at), fwm = FW_D * D, pq = qv('pool') ?? POOL;
    m.keyCone!.value = lerp(Math.cos(Math.atan((pq[0]! * fwm) / kd)), 0.82, wide);
    m.keyOut!.value = lerp(Math.cos(Math.atan((Math.max(pq[1]!, LL.out) * fwm) / kd)), 0.74, wide);
    m.keyFloor!.value = lerp(pq[2]!, 0.3, wide);
    m.keyShape!.value = 1 - wide;
    m.keyGam!.value = qv('gam')?.[0] ?? POOL_GAM;
    (m.fillDir!.value as THREE.Vector3).copy(pos.clone().sub(at).normalize());
    m.fillI!.value = qv('fill')?.[0] ?? 0.012;
    m.coatK!.value = lerp(0.4, 1, far);
    const cq = qv('coat') ?? COAT;
    // (round 4: the whites belong to the close framings; the exhibit photograph (the approved 48.75) keeps its look)
    (m.coatS!.value as THREE.Vector2).set(cq[0]!, cq[1]! * (1 - wide));
    m.wetS!.value = (qv('wet')?.[0] ?? WET) * (1 - wide);
    m.cutK!.value = lerp(qv('cut')?.[0] ?? CUT, 0.5, wide);
    // (the strip: STRIP = its half length (mm), its tilt from the frame's vertical toward the right (degrees))
    const stq = qv('strip') ?? STRIP, sa = (stq[1]! * Math.PI) / 180;
    (m.keyStrip!.value as THREE.Vector3).copy(up).multiplyScalar(Math.cos(sa)).addScaledVector(rt, Math.sin(sa)).multiplyScalar(stq[0]! * (STRIP_K[Ln.k] ?? 1) * (1 - wide));
    // (the strip hangs above and beside the key's point: STRIP_C (mm up, right of the frame), so the streak's hot core
    // lands above and beside a line's opening word, never behind it; the diffuse key and its shadows are unchanged)
    const scq = qv('stripc' + Ln.k) ?? STRIP_C[Ln.k] ?? [0, 0];
    (m.keyStripC!.value as THREE.Vector3).copy(key).addScaledVector(up, scq[0]!).addScaledVector(rt, scq[1]!);
    const cbq = qv('coatb') ?? COAT_B;
    (m.coatB!.value as THREE.Vector2).set(cbq[0]!, cbq[1]! * (1 - wide));
    m.coatF!.value = lamp / (lamp + FG * fl);
    this.march.render(renderer, this.rt);

    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = onBand.clone().sub(pos).dot(fw);
    // (round 5: a macro stops down, so the line so far behind the hero stays sharp enough to read)
    d.aper!.value = (qv('aper')?.[0] ?? lerp(9 * Math.min(1, 70 / Dn), 2.5, wide)) * (cm.macro >= 0 ? 0.5 : 1);
    this.dof.render(renderer, out);
    this.drawDebris(Ln, t, cm, key, m.keyDir!.value as THREE.Vector3, m.keyOut!.value as number, lamp + FG * fl, out);
    // GRADED IMPACTS (R37, R79): tier 1 (a flash) a shake of up to 12 px and a small punch of zoom; tier 2 (other
    // downbeats) a nudge of up to 4 px; tier 3 (the other beats) up to 1.5 px. The words' stretch on the kicks and
    // condense on the snares (kinetic moves) carry the beat between.
    const beat = this.clk.lastBeat(t);
    const fp = this.flashes.reduce((a, x) => Math.max(a, x.k * pulse(t, x.t, 0.04)), 0);
    const down = this.clk.inBar(Math.round(this.clk.beat(beat))) === 0;
    shake = Math.max(shake, 12 * fp, (down ? 4 : 1.5) * pulse(t, beat, 0.04));
    return { exposure: 1, halation: 0.04, shake: kinShake(t, Math.min(12, shake)), zoom: 1 + 0.012 * fp };
  }

  /** CARVING DEBRIS (round 5): the live chips and dust of this line, flown (rest frame, turned with the apple), projected
   *  by the frame's camera and drawn over the frame, lit by the same key: a chip's lit face catches the key (and its
   *  streak as it tumbles), its far side falls to film; dust is a faint cream mote. Palette only: stone, a cream tint of
   *  stone toward lightbox, film. */
  private drawDebris(Ln: Line, t: number, cm: Cam, key: THREE.Vector3, keyDir: THREE.Vector3, keyOut: number, level: number, out: THREE.WebGLRenderTarget) {
    const live = this.chips.filter((c) => c.line === Ln.k && t >= c.ts && t < c.ts + c.life);
    if (!live.length) return;
    const c2 = this.L.ctx, H2 = FH / 2, W2 = FW / 2, asp = FW / FH;
    this.L.clear();
    const lin = (h: string) => [1, 3, 5].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2));
    const STONE = lin('#E8C35A'), LBOX = lin('#F1F3EE'), FILM = lin('#070A10');
    const CREAM = STONE.map((v, i) => lerp(v, LBOX[i]!, 0.62));
    const srgb = (v: number) => Math.round(255 * Math.pow(clamp(v), 1 / 2.2));
    let drawn = 0;
    for (const c of live) {
      const tau = t - c.ts;
      const p = c.p0.clone();
      if (c.kind === 1) {
        const k = (1 - Math.exp(-DEB_DRAG * tau)) / DEB_DRAG;
        p.addScaledVector(c.v0, k).y -= 0.5 * DEB_G[1]! * tau * tau;
      } else p.addScaledVector(c.v0, tau).y -= 0.5 * DEB_G[0]! * tau * tau;
      // inside the apple (fallen back against the skin): gone
      if (p.distanceTo(AC) < LAY.AR - 1) continue;
      const P = turn(p, cm.psi), q = P.clone().sub(cm.pos), z = q.dot(cm.fw);
      if (z < 6) continue;
      const sx = W2 + (q.dot(cm.rt) / (z * cm.tanH * asp)) * W2, sy = H2 - (q.dot(cm.up) / (z * cm.tanH)) * H2;
      if (sx < -40 || sx > FW + 40 || sy < -40 || sy > FH + 40) continue;
      const u = tau / c.life;
      let r = Math.min(16, (c.size / (z * cm.tanH)) * H2);
      if (c.kind === 0) r *= 1 - ease.inQuad(clamp((u - 0.75) / 0.25));
      if (r < 0.35) continue;
      const toKey = key.clone().sub(P).normalize(), toCam = cm.pos.clone().sub(P).normalize();
      // the key's pool (its cone), so a chip flying out of the light falls dark
      const pool = Math.pow(clamp((P.clone().sub(key).normalize().dot(keyDir) - keyOut) / Math.max(1e-3, 1 - keyOut)), 0.6);
      if (c.kind === 1) {
        const a = 0.5 * (1 - u) ** 2 * (0.25 + pool);
        const col = CREAM.map((v) => srgb(v * (0.25 + 0.9 * pool * level)));
        c2.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${Math.min(0.8, a).toFixed(3)})`;
        c2.beginPath(); c2.arc(sx, sy, Math.max(0.7, r), 0, Math.PI * 2); c2.fill();
      } else {
        // tumbling: the chip's skin side faces n
        const n = c.n0.clone().applyAxisAngle(c.ax, c.spin * tau), wP = n.clone().applyAxisAngle(UP, cm.psi);
        const skin = wP.dot(toCam) >= 0 !== c.flesh;
        const nn = wP.dot(toCam) >= 0 ? wP : wP.negate();
        const dif = Math.max(0, nn.dot(toKey)), hv = toKey.clone().add(toCam).normalize();
        const spec = Math.pow(Math.max(0, nn.dot(hv)), 36) * 2.2 * pool * level;
        const base = skin ? STONE : CREAM;
        const col = base.map((v, i) => srgb(lerp(FILM[i]!, v, clamp(0.05 + dif * pool * level * 1.1)) + spec * LBOX[i]!));
        c2.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        // an irregular flake, turning in the frame as it tumbles
        const rot = c.seed * 6.28 + c.spin * 0.4 * tau, nv = 3 + Math.floor(c.seed * 2.99);
        c2.beginPath();
        for (let k = 0; k < nv; k++) {
          const a = rot + (k / nv) * Math.PI * 2 + Math.sin(c.seed * 40 + k * 2.3) * 0.5;
          const rr = r * (0.6 + 0.4 * Math.abs(Math.sin(c.seed * 17 + k * 1.7))) * (k % 2 ? 1 : 0.55 + 0.45 * Math.abs(nn.dot(toCam)));
          if (k === 0) c2.moveTo(sx + rr * Math.cos(a), sy + rr * Math.sin(a)); else c2.lineTo(sx + rr * Math.cos(a), sy + rr * Math.sin(a));
        }
        c2.closePath(); c2.fill();
      }
      drawn++;
    }
    if (!drawn) return;
    this.L.upload();
    this.ctx.comp.draw(this.ctx.renderer, this.L.texture, out, { mode: 'normal' });
  }

  /** ROUND 5 LIGHT FOLLOWS THE LINE (lead 2026-11-22: no word may fall past the light into black, which reads as cut
   *  by the limb): for the frame's camera, the whole line's words (where they are or will be bitten) on screen. The
   *  pool is aimed at their extent (still leaning toward the key side by AIM) and opened to reach the farthest with a
   *  margin; the key swings toward the lens (dka, degrees, never below 18 off it) until every word faces it
   *  (n.l >= LIT_NL). Frames whose words already sit inside r4's pool and rake are unchanged. */
  private lineLight(Ln: Line, cm: Cam, ka0: number, kb: number) {
    const asp = FW / FH, pts: { x: number; y: number; n: THREE.Vector3 }[] = [];
    for (const q of Ln.lp ?? []) {
      const P = turn(q.p, cm.psi), d = P.clone().sub(cm.pos), z = d.dot(cm.fw);
      if (z < 1) continue;
      const x = (d.dot(cm.rt) / (z * cm.tanH * asp)) / 2, y = ((d.dot(cm.up) / (z * cm.tanH)) / 2) * (FH / FW);
      if (Math.abs(x) > 0.55 || Math.abs(y) > 0.32) continue;
      pts.push({ x, y, n: q.n.clone().applyAxisAngle(UP, cm.psi) });
    }
    if (!pts.length) return { dka: 0, aim: AIM, out: POOL[1]! };
    const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
    const y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
    const aim = [(x0 + x1) / 2 + 0.5 * AIM[0]!, (y0 + y1) / 2 + 0.5 * AIM[1]!];
    const out = Math.max(POOL[1]!, ...pts.map((p) => Math.hypot(p.x - aim[0]!, p.y - aim[1]!) + LIT_MARGIN));
    let dka = 0;
    for (let k = ka0; k >= 18; k -= 2) {
      const a = (k * Math.PI) / 180, b = (kb * Math.PI) / 180;
      const kd = cm.fw.clone().multiplyScalar(-Math.cos(a)).addScaledVector(cm.rt, -Math.sin(a) * Math.cos(b)).addScaledVector(cm.up, Math.sin(a) * Math.sin(b)).normalize();
      dka = ka0 - k;
      if (pts.every((p) => p.n.dot(kd) >= LIT_NL)) break;
    }
    return { dka, aim, out };
  }

  /** The light at t: fl, the strobe's burst (its strength times a few frames' decay); lamp, the modelling lamp's
   *  level. After each flash the unit recharges: the lamp dips and ticks back up one step per beat until the next
   *  (the small light change between flashes, tier 2). Line 2 builds: each of its flashes leaves the lamp brighter. */
  private light(t: number) {
    let fl = 0, last = -1;
    for (let i = 0; i < this.flashes.length; i++) {
      const x = this.flashes[i]!;
      if (x.t <= t + 1e-6) last = i;
      fl = Math.max(fl, x.k * pulse(t, x.t, FLASH_HL));
    }
    const Lx = this.lineAt(t);
    // the line's lamp level: line 1 low (sparse), line 2 stepping up with each of its flashes, then high
    const inL2 = this.flashes.filter((x) => x.line === 1 && x.t <= t + 1e-6).length;
    const base = Lx.k === 0 ? 0.82 : Lx.k === 1 ? 0.86 + 0.12 * inL2 : 1.0;
    let rech = 1;
    if (last >= 0) {
      const tf = this.flashes[last]!.t, tn = this.flashes[last + 1]?.t ?? tf + 4;
      const nb = Math.max(1, Math.round(this.clk.beat(tn) - this.clk.beat(tf)));
      rech = lerp(0.8, 1, clamp(this.clk.steps(tf, t, 0.08) / nb));
    }
    return { fl, lamp: base * rech };
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
    drawKin(c, kw, P, x, base, { fill: trgba(ink), brk, tag: { role: 'hero', start: this.lines[1]?.words.find((w) => w.key === 'teeth')?.start } });
    this.L.upload();
    this.ctx.comp.draw(this.ctx.renderer, this.L.texture, out, { mode: 'replace' });
    return { exposure: 1, halation: 0, shake: kinShake(t, shake), zoom: 1 + 0.03 * P.shake }; // no halation: a slam is never haloed
  }

  /** The type probe (kinetic.ts THE TYPE PROBE; lint only, never in a normal render): where every word of the line is on
   *  screen. A word's (s, h) on the band -> its point on the apple's skin and normal, turned with the apple (psi, as the
   *  camera target in render() is) -> projected by the frame's camera. */
  private kinProbe(Ln: Line, t: number, pos: THREE.Vector3, fw: THREE.Vector3, rt: THREE.Vector3, up: THREE.Vector3, psi: number, tanH: number) {
    const cam = kinCam(pos, fw, rt, up, tanH);
    const surf = (s: number, h: number) => {
      const f = flank(Ln.az0 + s / RB, HB + h), C = turn(f.C, psi), N = f.N.clone().applyAxisAngle(UP, psi);
      return [C.x, C.y, C.z, N.x, N.y, N.z];
    };
    for (const w of Ln.words) if (t >= w.m0 - 0.4) kinRecord3D(w.kw, this.wordPose(w, t), w.cap, w.hc, surf, cam, { start: w.start, role: w.hero ? 'hero' : 'sup' });
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
