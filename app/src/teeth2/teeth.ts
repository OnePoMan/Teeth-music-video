// Teeth v2 kit: THE TOOTH SET. One set of 32 permanent teeth, his (the canonical arch, with the chip on #8), and the
// suspects' (archVariant). Every plate that shows teeth builds them from here: the radiograph (2), the apple bite (5),
// the charts (7, 14), the poured cast (9), the articulator (10), the acetate tracing (12), the match (13).
//
// ===================================================================================================== API (read this)
// UNITS AND FRAMES. Everything is in millimetres (real anatomical size).
//  - Arch frame (2D, occlusal view): x = the patient's LEFT (+), y = POSTERIOR (+, toward the throat); origin = the
//    midline point between the upper central incisors' incisal edges. The lower arch sits behind it (y0 ~ 2.6:
//    the overjet). Drawn with +x to the right and +y DOWN the page this is the UPPER arch seen from below (incisors at
//    the top, the patient's right on the viewer's left, as in a dental chart). The LOWER arch seen from above with its
//    incisors at the top has the patient's right on the viewer's RIGHT: draw it with x negated (-x) for that view.
//  - Head frame (3D, for the SDF), RIGHT-HANDED as three.js: X = patient's left, Y = UP, Z = ANTERIOR (= -arch y).
//    A camera at +Z looking down -Z faces the patient (his left on screen right). The occlusal plane is Y ~ 0: upper
//    crowns hang from the gum at Y ~ +8..10 to their tips at Y ~ -1 (incisors overlap the lowers: overbite ~2.4,
//    overjet ~2.5), lower crowns rise to Y ~ +1. Upper and lower are in occlusion (Class I) as given (articulator:
//    move the upper). An UPPER cast standing teeth-up on a bench: head = (x, -y, -z) of the bench point (a 180 degree
//    turn about X; its incisors then face bench -z). Do not mirror: the chip must stay on the patient's right.
//  - Tooth-local frame: a = along the arch toward DISTAL (+), b = toward BUCCAL/labial (+), c = height above the
//    cervical line toward the incisal edge / cusps (crown 0..H). Buccal-view profiles use (s, h) = (a, c): s distal +,
//    h up from the CEJ into the crown (+) and down the root (-).
// NUMBERING. Universal 1..32: 1 = upper right third molar .. 8 = upper right central .. 9 = upper left central .. 16 =
//    upper left third molar; 17 = lower left third molar .. 24 = lower left central, 25 = lower right central .. 32 =
//    lower right third molar. toothJaw(n), toothSide(n) ('R'|'L', the patient's), toothPos(n) (0 = central .. 7 = M3),
//    toothType(n), toothNumber(jaw, side, pos), TOOTH_NAME(n) ('upper right central incisor').
// THE ARCHES.
//    HIS: Arch                 the canonical set (his). #8 carries `chip` (mesial-incisal corner, CHIP_8 mm).
//    archVariant(seed): Arch   a suspect: clearly another person (2-3 of: diastema, crowding/rotations, a missing
//                              lateral, a peg lateral, a wide or narrow arch, flared incisors), never the chip.
//                              seed 1..n give distinct people; arch.features lists what was done (for the builder).
//    Arch = { teeth: Tooth[32] (index n-1), features, upperForm, lowerForm, restorations }
//    tooth(arch, n): Tooth. Tooth fields: n, jaw, side, type, cls, pos, present, peg, md/bl/crownH/rootL/cervMD/cervBL
//    (mm), center (arch mm, a point on the arch line), u (unit, distal), v (unit, buccal), outlineOff (b of the
//    outline's centre), yTip / torque / tip (3D placement), cusps, edge (anteriors), chip (#8 only, his).
// 2D SHAPES (all closed polygons are V2[] = [x, y][], counter-clockwise not guaranteed; draw with nonzero fill).
//    occlusalOutline(t, n=56): V2[]          crown silhouette from the occlusal side, arch mm (chip notched on #8)
//    incisalEdge(t): V2[] | null             the incisal edge / cusp-ridge line of an anterior, arch mm (open polyline;
//                                            #8's is shortened at its mesial end with a diagonal facet)
//    cuspTips(t): {p: V2, depth}[]           cusp tips, arch mm (depth below the tooth's top, mm)
//    grooves(t): V2[][]                      main fissures of a posterior tooth, arch mm (open polylines)
//    toLocal / toArch(t, a, b)               arch <-> tooth-local (a, b)
//    buccalProfile(t): Profile               buccal (radiograph) view in (s, h): outline (crown + roots, one polygon;
//                                            dentin = outline minus pulp), enamel (the cap, thick at the edge/cusps,
//                                            0 at the cervical line), pulp (chamber + canals), extraRoots (the upper
//                                            molars' palatal root, superimposed), cej (open polyline), H, R; the chip
//                                            cuts #8's mesial-incisal corner (s < 0, h ~ H). Cached per tooth.
//    clipHalfPlane(poly, p0, n)              polygon helper (keeps dot(p - p0, n) <= 0)
//    biteMark(arch, {gap=16, mirror=false}): {upper: Mark[], lower: Mark[]}
//                                            the marks the anterior teeth (canine to canine) leave in a bitten surface,
//                                            as PHOTOGRAPHED from the biter's side: X right, Y UP, mm, origin at the
//                                            centre of the bite; upper arc above (incisors at the top), lower arc below,
//                                            the arcs concave toward each other; the biter's right on the image's right.
//                                            Incisors: rounded bars along the incisal edge; canines: small triangles.
//                                            #8's bar is shortened and slanted at its mesial end (the chip: a notch).
//                                            Mark = { n, poly, center, angle, depth (0..1, how deep it bites) }.
//    panoramic(arch): PanoTooth[]            layout of a panoramic radiograph (OPG): film mm, X = arch x side (the
//                                            patient's right on the viewer's left), Y UP, origin on the occlusal line at
//                                            the midline; per tooth the film position of its tip, axis angle, mirror
//                                            and magnification. panoPoint(pt, s, h) maps a profile point to film mm.
// 3D (ray-marching). GLSL_TEETH (needs GLSL_COMMON first: smin/smax/sdSegment) declares `uniform highp sampler2D
//    teethTex` and:
//      float sdTeeth(vec3 p, int jaw, out int id)  crowns only (head frame, jaw 0 upper / 1 lower); id = tooth n or 0
//                                                  (use id for per-tooth colour: ink marks on cusps, the red match)
//      float sdGum(vec3 p, int jaw)                the gum (sockets with papillae) and the cast's base (upper: palate +
//                                                  trimmed base up to Y = +CAST.top; lower: horseshoe down to -top)
//      float sdCast(vec3 p, int jaw, out int id)   the stone cast: crowns + gum + base, smooth-joined (id 0 on gum/base);
//                                                  skips the crowns when far from the dentate zone (use this, not the two)
//      vec3 castBounds(int jaw, out vec3 lo)       a box (lo, hi) around the cast (head frame), for the ray's entry/exit
//      void teethRay(vec3 ro, vec3 rd)             OPTIONAL, big speed-up: call once per ray (head frame, rd unit) before
//                                                  marching; the loops then only visit teeth whose bounds the ray passes.
//                                                  Call again for a shadow ray. Without it every tooth is considered.
//      float tCrown(int i, vec3 p)                 one crown (i = n - 1), e.g. a single tooth in close-up
//    Bind the data with `const tt = new TeethTex(); tt.set(arch)` and `uniforms: { teethTex: { value: tt.texture } }`
//    (call set() again for another suspect: no recompilation). The SDF is a conservative estimate: march with a step
//    factor of ~0.85 and a hit threshold of ~0.0004 * t + 0.0006 (mm), normals with eps 0.05. Crowns are open below the
//    gum (they run on up into the base): render them through sdCast or with the gum. Reference renderer (camera, soft
//    shadows, AO, stone shading): scenes/kittest.ts. Cost there: see the gate 2 report.
// RESTORATIONS. HIS.restorations: which surfaces carry amalgam fillings on his teeth (for the radiograph, the charts).
// =====================================================================================================================
import * as THREE from 'three';
import { mulberry32 } from '../engine/util';

export type V2 = [number, number];
export type Jaw = 'upper' | 'lower';
export type Side = 'R' | 'L';
export type ToothType = 'central' | 'lateral' | 'canine' | 'premolar1' | 'premolar2' | 'molar1' | 'molar2' | 'molar3';
export type ToothClass = 'incisor' | 'canine' | 'premolar' | 'molar';
export const TOOTH_TYPES: ToothType[] = ['central', 'lateral', 'canine', 'premolar1', 'premolar2', 'molar1', 'molar2', 'molar3'];

// ------------------------------------------------------------------------------------------------ numbering
export const toothJaw = (n: number): Jaw => (n <= 16 ? 'upper' : 'lower');
export const toothSide = (n: number): Side => (n <= 8 || n >= 25 ? 'R' : 'L');
/** 0 = central incisor .. 7 = third molar. */
export const toothPos = (n: number) => (n <= 8 ? 8 - n : n <= 16 ? n - 9 : n <= 24 ? 24 - n : n - 25);
export const toothType = (n: number): ToothType => TOOTH_TYPES[toothPos(n)]!;
export function toothNumber(jaw: Jaw, side: Side, pos: number) {
  if (jaw === 'upper') return side === 'R' ? 8 - pos : 9 + pos;
  return side === 'L' ? 24 - pos : 25 + pos;
}
const CLS: Record<ToothType, ToothClass> = {
  central: 'incisor', lateral: 'incisor', canine: 'canine', premolar1: 'premolar', premolar2: 'premolar', molar1: 'molar', molar2: 'molar', molar3: 'molar',
};
const NAMES: Record<ToothType, string> = {
  central: 'central incisor', lateral: 'lateral incisor', canine: 'canine', premolar1: 'first premolar', premolar2: 'second premolar',
  molar1: 'first molar', molar2: 'second molar', molar3: 'third molar',
};
export const TOOTH_NAME = (n: number) => `${toothJaw(n)} ${toothSide(n) === 'R' ? 'right' : 'left'} ${NAMES[toothType(n)]}`;

// ------------------------------------------------------------------------------------------------ dimensions
/** Mean permanent-tooth dimensions (mm; Wheeler): mesiodistal crown, buccolingual crown, crown height, root length,
 *  mesiodistal and buccolingual at the cervix. */
interface Dim { md: number; bl: number; crownH: number; rootL: number; cervMD: number; cervBL: number }
const D = (md: number, bl: number, crownH: number, rootL: number, cervMD: number, cervBL: number): Dim => ({ md, bl, crownH, rootL, cervMD, cervBL });
const DIM: Record<Jaw, Record<ToothType, Dim>> = {
  upper: {
    central: D(8.5, 7.0, 10.5, 13, 7.0, 6.0), lateral: D(6.5, 6.0, 9.0, 13, 5.0, 5.0), canine: D(7.5, 8.0, 10.0, 17, 5.5, 7.0),
    premolar1: D(7.0, 9.0, 8.5, 14, 5.0, 8.0), premolar2: D(6.5, 9.0, 8.5, 14, 5.0, 8.0),
    molar1: D(10.0, 11.0, 7.5, 13, 8.0, 10.0), molar2: D(9.0, 11.0, 7.0, 12, 7.0, 10.0), molar3: D(8.5, 10.0, 6.5, 11, 6.5, 9.5),
  },
  lower: {
    central: D(5.0, 6.0, 9.0, 12.5, 3.5, 5.3), lateral: D(5.5, 6.5, 9.5, 14, 4.0, 5.8), canine: D(7.0, 7.5, 11.0, 16, 5.5, 7.0),
    premolar1: D(7.0, 7.5, 8.5, 14, 5.0, 6.5), premolar2: D(7.0, 8.0, 8.0, 14.5, 5.0, 7.0),
    molar1: D(11.0, 10.5, 7.5, 14, 9.0, 9.0), molar2: D(10.5, 10.0, 7.0, 13, 8.0, 9.0), molar3: D(10.0, 9.5, 7.0, 11, 7.5, 9.0),
  },
};

/** Occlusal-view shape: superellipse exponents (labial, lingual half), lingual taper (0..1: how much narrower the
 *  lingual end is), skew (upper molars' rhomboid), outline centre offset from the arch line (b, mm). */
interface Shape { nLab: number; nLing: number; taper: number; skew: number; bOff: number }
const S = (nLab: number, nLing: number, taper: number, skew: number, bOff: number): Shape => ({ nLab, nLing, taper, skew, bOff });
const SHAPE: Record<Jaw, Record<ToothType, Shape>> = {
  upper: {
    central: S(2.6, 1.7, 0.55, 0, -1.5), lateral: S(2.3, 1.8, 0.5, 0, -1.3), canine: S(2.0, 1.8, 0.45, 0, -1.0),
    premolar1: S(2.5, 2.3, 0.2, 0, -0.2), premolar2: S(2.6, 2.4, 0.06, 0, -0.2),
    molar1: S(2.9, 2.6, 0.1, 0.22, -0.3), molar2: S(2.7, 2.3, 0.35, 0.3, -0.3), molar3: S(2.3, 2.0, 0.42, 0.28, -0.3),
  },
  lower: {
    central: S(2.5, 2.3, 0.15, 0, -1.2), lateral: S(2.5, 2.3, 0.15, 0, -1.2), canine: S(2.1, 1.9, 0.35, 0, -1.0),
    premolar1: S(2.2, 1.9, 0.42, 0, -0.4), premolar2: S(2.6, 2.6, 0.0, 0, -0.3),
    molar1: S(3.0, 2.9, 0.06, 0, -0.4), molar2: S(3.2, 3.0, 0.05, 0, -0.4), molar3: S(2.6, 2.5, 0.15, 0, -0.4),
  },
};

/** Cusps of the posterior teeth: (a/A, b/B, depth below the tallest, radius), before taper and skew. */
type CuspN = [number, number, number, number];
const CUSPS: Record<Jaw, Partial<Record<ToothType, CuspN[]>>> = {
  upper: {
    premolar1: [[0.05, 0.42, 0, 1.5], [-0.05, -0.45, 0.9, 1.4]],
    premolar2: [[0, 0.42, 0, 1.5], [0, -0.42, 0.4, 1.5]],
    molar1: [[-0.45, 0.45, 0.1, 1.7], [0.45, 0.48, 0.4, 1.6], [-0.28, -0.42, 0, 2.0], [0.5, -0.5, 1.1, 1.4]],
    molar2: [[-0.45, 0.45, 0.1, 1.6], [0.4, 0.45, 0.5, 1.4], [-0.25, -0.4, 0, 1.9], [0.5, -0.5, 1.6, 1.1]],
    molar3: [[-0.4, 0.4, 0.2, 1.5], [0.35, 0.45, 0.6, 1.3], [0.0, -0.4, 0.1, 1.8]],
  },
  lower: {
    premolar1: [[0, 0.25, 0, 1.7], [0, -0.55, 2.3, 1.0]],
    premolar2: [[0, 0.4, 0, 1.6], [-0.4, -0.45, 0.6, 1.2], [0.4, -0.45, 0.9, 1.1]],
    molar1: [[-0.55, 0.45, 0.4, 1.6], [0.0, 0.5, 0.5, 1.5], [0.62, 0.3, 0.9, 1.2], [-0.45, -0.45, 0, 1.7], [0.3, -0.45, 0.1, 1.6]],
    molar2: [[-0.45, 0.45, 0.4, 1.6], [0.45, 0.45, 0.6, 1.5], [-0.45, -0.45, 0, 1.7], [0.45, -0.45, 0.2, 1.6]],
    molar3: [[-0.42, 0.42, 0.4, 1.5], [0.42, 0.42, 0.7, 1.4], [-0.42, -0.42, 0, 1.6], [0.4, -0.42, 0.4, 1.5]],
  },
};

/** Anterior incisal edge: b of the edge's centre line (from the outline centre), half its thickness, corner radii
 *  (mesial, distal) for incisors; for canines and pegs: the cusp tip's a (mesial < 0) and the cusp-ridge slope. */
export interface Edge { b: number; half: number; rM: number; rD: number; pointed: boolean; tipA: number; slope: number }
const E = (b: number, half: number, rM: number, rD: number): Edge => ({ b, half, rM, rD, pointed: false, tipA: 0, slope: 0 });
const EC = (b: number, half: number, tipA: number, slope: number): Edge => ({ b, half, rM: 0, rD: 0, pointed: true, tipA, slope });
const EDGE: Record<Jaw, Partial<Record<ToothType, Edge>>> = {
  upper: { central: E(1.3, 0.55, 0.45, 1.3), lateral: E(1.1, 0.5, 0.8, 1.6), canine: EC(1.2, 0.7, -0.3, 0.62) },
  lower: { central: E(0.9, 0.45, 0.35, 0.45), lateral: E(0.9, 0.45, 0.4, 0.7), canine: EC(1.0, 0.6, -0.25, 0.6) },
};

/** 3D placement per type: tip level (head Y; upper negative = below the occlusal plane), labial crown torque (rad),
 *  mesial crown tip (rad), papilla height (mm above the margin). */
const PLACE: Record<Jaw, Record<ToothType, [number, number, number, number]>> = {
  upper: {
    central: [-1.2, 0.3, 0.06, 3.2], lateral: [-0.7, 0.24, 0.12, 3.0], canine: [-1.0, 0.12, 0.16, 2.8],
    premolar1: [-0.5, -0.06, 0.05, 2.3], premolar2: [-0.4, -0.08, 0.05, 2.2],
    molar1: [-0.2, -0.14, 0.08, 1.9], molar2: [0.3, -0.16, 0.1, 1.7], molar3: [1.0, -0.2, 0.14, 1.5],
  },
  lower: {
    central: [1.2, 0.04, 0.03, 2.8], lateral: [1.1, 0.04, 0.04, 2.8], canine: [1.0, -0.06, 0.08, 2.6],
    premolar1: [0.5, -0.16, 0.03, 2.2], premolar2: [0.3, -0.2, 0.03, 2.1],
    molar1: [0.2, -0.26, 0.05, 1.9], molar2: [0.5, -0.3, 0.06, 1.7], molar3: [1.1, -0.3, 0.1, 1.5],
  },
};

// ------------------------------------------------------------------------------------------------ the tooth
export interface Cusp { a: number; b: number; depth: number; r: number }
/** The chip: a diagonal break off the mesial-incisal corner: `along` mm along the incisal edge, `down` mm down the
 *  mesial side (buccal view), `inward` how far it reaches lingually through the edge (0..1 of the thickness). */
export interface Chip { along: number; down: number }
export const CHIP_8: Chip = { along: 2.8, down: 3.6 };

export interface Tooth {
  n: number; jaw: Jaw; side: Side; type: ToothType; cls: ToothClass; pos: number;
  present: boolean; peg: boolean;
  md: number; bl: number; crownH: number; rootL: number; cervMD: number; cervBL: number;
  /** arch mm: the crown's point on the arch line (midpoint of its contacts) */
  center: V2;
  contactM: V2; contactD: V2;
  /** unit vectors (arch frame): u toward distal along the arch, v toward buccal; includes `rot` */
  u: V2; v: V2;
  /** extra rotation about the long axis (rad, + turns the mesial edge labially on either side) */
  rot: number;
  /** b of the occlusal outline's centre (mm, from the arch line) */
  outlineOff: number;
  shape: Shape;
  /** 3D: head-frame Y of the tip level; torque (labial crown, rad); mesial crown tip (rad); papilla (mm) */
  yTip: number; torque: number; tip: number; papilla: number;
  cusps: Cusp[];
  edge: Edge | null;
  chip: Chip | null;
}

export interface ArchForm { a: number; b: number; thetaC: number; div: number; y0: number }
/** Upper and lower arch lines (through the contact points): an elliptic anterior segment then straight, slightly
 *  diverging posterior segments (a: half width of the ellipse, b: its depth, thetaC: where the line takes over,
 *  div: extra divergence of the line (rad), y0: the arch's front point). */
export const UPPER_FORM: ArchForm = { a: 22, b: 19, thetaC: 1.18, div: -0.2, y0: 0 };
export const LOWER_FORM: ArchForm = { a: 16.5, b: 10, thetaC: 1.3, div: -0.17, y0: 2.6 };

/** Amalgam restorations (surfaces: O occlusal, M mesial, D distal, B buccal, L lingual). */
export type Restoration = { n: number; surf: string };
export interface Arch {
  teeth: Tooth[];
  features: string[];
  upperForm: ArchForm;
  lowerForm: ArchForm;
  restorations: Restoration[];
}
export const tooth = (arch: Arch, n: number) => arch.teeth[n - 1]!;

// ------------------------------------------------------------------------------------------------ arch geometry
function archLine(f: ArchForm, len = 80): V2[] {
  // half arch, x >= 0, from the midline, sampled every ~0.05 mm
  const pts: V2[] = [];
  const nE = 600;
  for (let i = 0; i <= nE; i++) {
    const th = (f.thetaC * i) / nE;
    pts.push([f.a * Math.sin(th), f.y0 + f.b * (1 - Math.cos(th))]);
  }
  const last = pts[pts.length - 1]!;
  let tx = f.a * Math.cos(f.thetaC), ty = f.b * Math.sin(f.thetaC);
  const l = Math.hypot(tx, ty);
  tx /= l; ty /= l;
  const c = Math.cos(f.div), s = Math.sin(f.div);
  const dx = tx * c + ty * s, dy = -tx * s + ty * c; // div > 0 rotates toward +x (more divergent)
  for (let i = 1; i <= len * 20; i++) pts.push([last[0] + dx * i * 0.05, last[1] + dy * i * 0.05]);
  return pts;
}
/** The point on the polyline (from index i0 onward) at chord distance `d` from `p`, and its index. */
function chordFrom(pts: V2[], i0: number, p: V2, d: number): [V2, number] {
  for (let i = Math.max(i0, 1); i < pts.length; i++) {
    const q = pts[i]!;
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) >= d) {
      const q0 = pts[i - 1]!;
      const d0 = Math.hypot(q0[0] - p[0], q0[1] - p[1]), d1 = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const k = (d - d0) / Math.max(d1 - d0, 1e-9);
      return [[q0[0] + (q[0] - q0[0]) * k, q0[1] + (q[1] - q0[1]) * k], i];
    }
  }
  return [pts[pts.length - 1]!, pts.length - 1];
}

/** Per-tooth overrides used by the variants. */
interface Mod { missing?: boolean; peg?: boolean; rot?: number; shiftB?: number; space?: number; scale?: number; torque?: number; drop?: number }

function buildJaw(jaw: Jaw, form: ArchForm, mods: Record<number, Mod>, sizeK: number, midGap: number, chip8: boolean): Tooth[] {
  const line = archLine(form);
  const out: Tooth[] = [];
  for (const side of ['R', 'L'] as Side[]) {
    const sx = side === 'L' ? 1 : -1;
    let p: V2 = [midGap / 2, form.y0];
    let idx = 0;
    // find the start index near p
    while (idx < line.length - 1 && line[idx]![0] < p[0]) idx++;
    p = [line[idx]![0], line[idx]![1]];
    for (let pos = 0; pos < 8; pos++) {
      const type = TOOTH_TYPES[pos]!;
      const n = toothNumber(jaw, side, pos);
      const m = mods[n] ?? {};
      const dim = DIM[jaw][type];
      let k = sizeK * (m.scale ?? 1);
      const peg = !!m.peg;
      const md = (peg ? dim.md * 0.62 : dim.md) * k;
      // space taken on the arch: a rotated tooth takes less (its width projects), extra space opens a gap
      const rot = m.rot ?? 0;
      const take = md * (0.55 + 0.45 * Math.abs(Math.cos(rot)));
      if (m.space) [p, idx] = chordFrom(line, idx, p, m.space);
      const start = p;
      const [end, i1] = chordFrom(line, idx, start, take);
      idx = i1;
      p = end;
      // contacts (on the line); the crown sits centred in its own width
      const ux0 = end[0] - start[0], uy0 = end[1] - start[1];
      const ul = Math.hypot(ux0, uy0) || 1;
      const ux = ux0 / ul, uy = uy0 / ul;
      const cM: V2 = [start[0], start[1]];
      const mid: V2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      // the arch line's sagitta: put the centre on the curve, not the chord
      let best = line[idx]!, bd = 1e9;
      for (let j = Math.max(0, idx - 400); j <= idx; j++) {
        const q = line[j]!;
        const dd = (q[0] - mid[0]) ** 2 + (q[1] - mid[1]) ** 2;
        if (dd < bd) { bd = dd; best = q; }
      }
      let center: V2 = [best[0], best[1]];
      // the buccal normal (x >= 0 half: rotate u clockwise in (x, y-down) terms)
      let vx = uy, vy = -ux;
      // rotation about the long axis: + turns the mesial edge labially
      const cr = Math.cos(rot), sr = Math.sin(rot);
      let rux = ux * cr - vx * sr, ruy = uy * cr - vy * sr;
      let rvx = ux * sr + vx * cr, rvy = uy * sr + vy * cr;
      const shiftB = m.shiftB ?? 0;
      center = [center[0] + vx * shiftB, center[1] + vy * shiftB];
      // mirror to the patient's right
      const mir = (q: V2): V2 => [q[0] * sx, q[1]];
      const shp = SHAPE[jaw][type];
      const edge0 = peg ? EC(0.9, 0.5, 0, 0.75) : EDGE[jaw][type] ?? null;
      const [yTip, torque, tip, papilla] = PLACE[jaw][type];
      const cusps = (CUSPS[jaw][type] ?? []).map(([na, nb, depth, r]) => {
        const A = (md / 2), B = (dim.bl * k) / 2;
        let a = na * A, b = nb * B;
        a *= 1 - shp.taper * smooth01(0, -B, b);
        a -= shp.skew * b;
        return { a, b, depth, r: r * k };
      });
      const t: Tooth = {
        n, jaw, side, type, cls: CLS[type], pos, present: !m.missing, peg,
        md, bl: dim.bl * k * (peg ? 0.8 : 1), crownH: dim.crownH * k * (peg ? 0.78 : 1), rootL: dim.rootL * k * (peg ? 0.85 : 1),
        cervMD: dim.cervMD * k * (peg ? 0.75 : 1), cervBL: dim.cervBL * k * (peg ? 0.8 : 1),
        center: mir(center), contactM: mir(cM), contactD: mir(end),
        u: [rux * sx, ruy], v: [rvx * sx, rvy], rot,
        outlineOff: shp.bOff, shape: shp,
        yTip: yTip + (m.drop ?? 0) * (jaw === 'upper' ? -1 : 1) + (peg ? (jaw === 'upper' ? 1.2 : -1.2) : 0),
        torque: torque + (m.torque ?? 0), tip, papilla,
        cusps, edge: edge0,
        chip: chip8 && n === 8 ? { ...CHIP_8 } : null,
      };
      out.push(t);
    }
  }
  return out;
}

function smooth01(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function makeArch(opts: { upper?: Partial<ArchForm>; lower?: Partial<ArchForm>; mods?: Record<number, Mod>; size?: number; diastema?: number; lowerGap?: number; chip?: boolean; features?: string[]; restorations?: Restoration[] }): Arch {
  const uf = { ...UPPER_FORM, ...(opts.upper ?? {}) };
  const lf = { ...LOWER_FORM, ...(opts.lower ?? {}) };
  const up = buildJaw('upper', uf, opts.mods ?? {}, opts.size ?? 1, opts.diastema ?? 0, !!opts.chip);
  const lo = buildJaw('lower', lf, opts.mods ?? {}, opts.size ?? 1, opts.lowerGap ?? 0, false);
  const teeth: Tooth[] = new Array(32);
  for (const t of [...up, ...lo]) teeth[t.n - 1] = t;
  return { teeth, features: opts.features ?? [], upperForm: uf, lowerForm: lf, restorations: opts.restorations ?? [] };
}

/** His teeth: the canonical arch. #8 is chipped; a few old amalgams. */
export const HIS: Arch = makeArch({
  chip: true,
  features: ['chip #8'],
  restorations: [
    { n: 3, surf: 'MO' }, { n: 14, surf: 'O' }, { n: 2, surf: 'O' }, { n: 19, surf: 'MOD' }, { n: 30, surf: 'O' }, { n: 31, surf: 'OB' }, { n: 13, surf: 'DO' },
  ],
});

/** A suspect: a different person's teeth, clearly distinct, never the chip. Deterministic in `seed` (1, 2, 3, ...). */
export function archVariant(seed: number): Arch {
  const R = mulberry32(seed * 7919 + 17);
  const pick = <T,>(xs: T[]) => xs[Math.floor(R() * xs.length) % xs.length]!;
  // the first eight people are composed (each clearly someone else); later seeds draw two or three at random
  const TABLE: string[][] = [
    ["diastema", "wide"], ["crowding", "narrow"], ["missing", "rotated"], ["peg", "flared"],
    ["crowding", "missing"], ["wide", "rotated", "peg"], ["narrow", "flared"], ["diastema", "rotated"],
  ];
  const all = ["diastema", "crowding", "missing", "peg", "wide", "narrow", "flared", "rotated"];
  let feats: string[];
  if (seed >= 1 && seed <= TABLE.length) feats = TABLE[seed - 1]!;
  else {
    feats = [];
    while (feats.length < 2 + (R() < 0.5 ? 1 : 0)) {
      const f = pick(all);
      if (feats.includes(f)) continue;
      if ((f === "wide" && feats.includes("narrow")) || (f === "narrow" && feats.includes("wide"))) continue;
      if ((f === "diastema" && feats.includes("crowding")) || (f === "crowding" && feats.includes("diastema"))) continue;
      feats.push(f);
    }
  }
  const mods: Record<number, Mod> = {};
  const upper: Partial<ArchForm> = {};
  const lower: Partial<ArchForm> = {};
  let diastema = 0, lowerGap = 0;
  const size = 0.95 + R() * 0.1;
  for (const f of feats) {
    if (f === 'diastema') { diastema = 2.2 + R() * 1.6; if (R() < 0.4) lowerGap = 1.0 + R(); }
    if (f === 'crowding') {
      const s = R() < 0.5 ? 1 : -1;
      mods[7] = { ...mods[7], rot: s * (0.45 + R() * 0.25), shiftB: -1.2 };
      mods[10] = { ...mods[10], rot: -s * (0.3 + R() * 0.3), shiftB: 0.9 };
      mods[24] = { ...mods[24], rot: 0.5 + R() * 0.3, shiftB: 1.0 };
      mods[26] = { ...mods[26], rot: -(0.4 + R() * 0.3), shiftB: -1.1 };
      mods[23] = { ...mods[23], shiftB: -0.8 };
      upper.a = UPPER_FORM.a * 0.95; lower.a = LOWER_FORM.a * 0.95;
    }
    if (f === 'missing') { const n = pick([7, 10, 12, 21]); mods[n] = { ...mods[n], missing: true }; }
    if (f === 'peg') { const n = pick([7, 10]); mods[n] = { ...mods[n], peg: true, space: 1.4 }; }
    if (f === 'wide') { upper.a = UPPER_FORM.a * 1.1; upper.b = UPPER_FORM.b * 0.94; lower.a = LOWER_FORM.a * 1.1; lower.b = LOWER_FORM.b * 0.94; upper.div = 0.04; lower.div = 0.05; }
    if (f === 'narrow') { upper.a = UPPER_FORM.a * 0.88; upper.b = UPPER_FORM.b * 1.12; lower.a = LOWER_FORM.a * 0.9; lower.b = LOWER_FORM.b * 1.08; upper.div = -0.1; lower.div = -0.08; }
    if (f === 'flared') { for (const n of [7, 8, 9, 10]) mods[n] = { ...mods[n], torque: 0.22, space: 0.7 }; upper.b = (upper.b ?? UPPER_FORM.b) * 1.08; }
    if (f === 'rotated') { const n = pick([6, 11]); mods[n] = { ...mods[n], rot: (R() < 0.5 ? 1 : -1) * (0.5 + R() * 0.3), shiftB: 0.8, drop: -0.8 }; const m = pick([5, 12, 20, 29]); mods[m] = { ...mods[m], rot: 0.6 }; }
  }
  return makeArch({ upper, lower, mods, size, diastema, lowerGap, chip: false, features: feats });
}

// ------------------------------------------------------------------------------------------------ 2D: occlusal view
export function toArch(t: Tooth, a: number, b: number): V2 {
  return [t.center[0] + t.u[0] * a + t.v[0] * b, t.center[1] + t.u[1] * a + t.v[1] * b];
}
export function toLocal(t: Tooth, p: V2): V2 {
  const dx = p[0] - t.center[0], dy = p[1] - t.center[1];
  return [dx * t.u[0] + dy * t.u[1], dx * t.v[0] + dy * t.v[1]];
}

/** The crown's occlusal outline in tooth-local (a, b) (b from the arch line), before the chip. */
function outlineLocal(t: Tooth, steps = 56): V2[] {
  const A = t.md / 2, B = t.bl / 2, sh = t.shape;
  const pts: V2[] = [];
  for (let i = 0; i < steps; i++) {
    const ph = (i / steps) * Math.PI * 2;
    const c = Math.cos(ph), s = Math.sin(ph);
    const nn = s > 0 ? sh.nLab : sh.nLing;
    let a = A * Math.sign(c) * Math.pow(Math.abs(c), 2 / nn);
    const b = B * Math.sign(s) * Math.pow(Math.abs(s), 2 / nn);
    a *= 1 - sh.taper * smooth01(0, -B, b);
    a -= sh.skew * b;
    pts.push([a, b + t.outlineOff]);
  }
  return pts;
}

/** Sutherland-Hodgman: keep the part of `poly` where dot(p - p0, n) <= 0. */
export function clipHalfPlane(poly: V2[], p0: V2, n: V2, closed = true): V2[] {
  const out: V2[] = [];
  const f = (p: V2) => (p[0] - p0[0]) * n[0] + (p[1] - p0[1]) * n[1];
  const L = poly.length;
  for (let i = 0; i < (closed ? L : L - 1); i++) {
    const a = poly[i]!, b = poly[(i + 1) % L]!;
    const fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa <= 0) !== (fb <= 0)) {
      const k = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
    if (!closed && i === L - 2 && fb <= 0) out.push(b);
  }
  return out;
}

/** The chip's cut in the occlusal view: the mesial end of the incisal third, cut diagonally from the edge's mesial
 *  end toward the labial-mesial contour (local a, b). Returns [p0, n] for clipHalfPlane. */
function chipOcclusal(t: Tooth): [V2, V2] {
  const A = t.md / 2, e = t.edge!, c = t.chip!;
  const bE = t.outlineOff + e.b;
  // through (-A + along, bE + half) .. (-A + 0.2, bE - 2.2): removes the mesio-incisal corner seen from below
  const p0: V2 = [-A + c.along, bE + e.half + 0.6];
  const p1: V2 = [-A + 0.25, bE - 2.4];
  let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0];
  if ((-A - p0[0]) * nx + (bE - p0[1]) * ny < 0) { nx = -nx; ny = -ny; }
  return [p0, [nx, ny]];
}

export function occlusalOutline(t: Tooth, steps = 56): V2[] {
  let pts = outlineLocal(t, steps);
  if (t.chip && t.edge) {
    // the silhouette loses only the corner's tip (the contact area is in the incisal third)
    const A = t.md / 2;
    const bE = t.outlineOff + t.edge.b;
    const p0: V2 = [-A + t.chip.along * 0.55, bE + 3];
    const p1: V2 = [-A - 0.1, bE - 1.2];
    let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0];
    if ((-A - 1 - p0[0]) * nx + (bE - p0[1]) * ny < 0) { nx = -nx; ny = -ny; }
    pts = clipHalfPlane(pts, p0, [nx, ny]);
  }
  return pts.map(([a, b]) => toArch(t, a, b));
}

/** The incisal edge (incisors) or the cusp ridges through the tip (canines, pegs), local (a, b), open polyline. */
function edgeLocal(t: Tooth): V2[] {
  const e = t.edge!;
  const A = t.md / 2, bE = t.outlineOff + e.b;
  const pts: V2[] = [];
  const N = 16;
  if (e.pointed) {
    // cusp ridges: from the mesial contact corner to the tip and on to the distal corner, curving with the labial face
    const tip = e.tipA * A;
    for (let i = 0; i <= N; i++) {
      const a = -A * 0.88 + (A * 1.76 * i) / N;
      const bow = 0.5 * (1 - ((a - tip) / A) ** 2);
      pts.push([a, bE + bow * 0.6 - 0.25]);
    }
  } else {
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N;
      const a = u * (A - (u < 0 ? e.rM : e.rD) * 0.5);
      pts.push([a, bE - 0.35 * u * u]); // the edge follows the labial curvature
    }
  }
  return pts;
}

export function incisalEdge(t: Tooth): V2[] | null {
  if (!t.edge) return null;
  let pts = edgeLocal(t);
  if (t.chip) {
    // shortened at the mesial end, ending in a diagonal facet
    const A = t.md / 2;
    const a0 = -A + t.chip.along;
    pts = pts.filter((p) => p[0] >= a0);
    const first = pts[0]!;
    pts.unshift([a0 - 0.35, first[1] - 0.55]);
  }
  return pts.map(([a, b]) => toArch(t, a, b));
}

export function cuspTips(t: Tooth): { p: V2; depth: number }[] {
  if (t.edge?.pointed) return [{ p: toArch(t, t.edge.tipA * (t.md / 2), t.outlineOff + t.edge.b), depth: 0 }];
  return t.cusps.map((c) => ({ p: toArch(t, c.a, c.b + t.outlineOff), depth: c.depth }));
}

/** Main fissures of a posterior tooth (arch mm). */
export function grooves(t: Tooth): V2[][] {
  if (t.cls !== 'premolar' && t.cls !== 'molar') return [];
  const A = t.md / 2, B = t.bl / 2, o = t.outlineOff;
  const L = (pts: V2[]) => pts.map(([a, b]) => toArch(t, a, b + o));
  const sk = t.shape.skew;
  if (t.cls === 'premolar') {
    const g: V2[][] = [L([[-A * 0.55, 0.05 * B], [0, -0.05 * B], [A * 0.55, 0.05 * B]])];
    if (t.cusps.length === 3) g.push(L([[0, -0.05 * B], [0.05 * A, -0.75 * B]]));
    return g;
  }
  if (t.jaw === 'upper') {
    // central groove (mesial pit to the oblique ridge), buccal groove, distolingual groove
    return [
      L([[-A * 0.55 + sk * 0.1, 0.05 * B], [-A * 0.05, 0.1 * B], [A * 0.12, 0.2 * B]]),
      L([[-A * 0.05, 0.1 * B], [0.0 - sk * B * 0.6, 0.85 * B]]),
      L([[A * 0.2, -0.05 * B], [A * 0.55, 0.0], [A * 0.3 + sk * B * 0.5, -0.85 * B]]),
    ];
  }
  const g: V2[][] = [L([[-A * 0.7, 0], [-A * 0.2, -0.05 * B], [A * 0.25, 0.02 * B], [A * 0.7, 0]]), L([[-A * 0.25, -0.05 * B], [-A * 0.25, 0.9 * B]]), L([[-A * 0.05, 0], [-A * 0.05, -0.9 * B]])];
  if (t.cusps.length === 5) g.push(L([[A * 0.3, 0.02 * B], [A * 0.42, 0.85 * B]]));
  return g;
}

// ------------------------------------------------------------------------------------------------ 2D: buccal view
export interface Profile {
  /** the whole tooth (crown + roots), closed polygon, (s, h) */
  outline: V2[];
  /** the enamel cap, closed polygon */
  enamel: V2[];
  /** pulp chamber and canals, closed polygon */
  pulp: V2[];
  /** further roots seen through the others (the upper molars' palatal root), closed polygons */
  extraRoots: V2[][];
  /** the cervical line (open polyline) */
  cej: V2[];
  H: number; R: number;
}

/** Chaikin corner cutting on a closed polygon, keeping the vertices flagged sharp. */
function chaikin(pts: V2[], sharp: boolean[], iters = 3): V2[] {
  let P = pts, Sh = sharp;
  for (let it = 0; it < iters; it++) {
    const Q: V2[] = [], QS: boolean[] = [];
    const L = P.length;
    for (let i = 0; i < L; i++) {
      const a = P[i]!, b = P[(i + 1) % L]!;
      if (Sh[i]) { Q.push(a); QS.push(true); }
      Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]); QS.push(false);
      Q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); QS.push(false);
    }
    P = Q; Sh = QS;
  }
  return P;
}
function chaikinOpen(pts: V2[], iters = 3): V2[] {
  let P = pts;
  for (let it = 0; it < iters; it++) {
    const Q: V2[] = [P[0]!];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i]!, b = P[i + 1]!;
      Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    Q.push(P[P.length - 1]!);
    P = Q;
  }
  return P;
}

/** Control points of the crown in buccal view, mesial CEJ -> over the top -> distal CEJ; [s, h, sharp]. */
function crownCtl(t: Tooth): [number, number, boolean][] {
  const M = t.md / 2, C = t.cervMD / 2, H = t.crownH, e = t.edge;
  if (t.cls === 'incisor' && !t.peg) {
    const rM = e!.rM, rD = e!.rD;
    return [
      [-C, 0, true], [-M * 0.93, 0.4 * H, false], [-M, 0.78 * H, false], [-M + rM * 0.25, H - rM * 0.4, false],
      [-M * 0.5, H, false], [0, H + 0.05, false], [M * 0.5, H - 0.05, false], [M - rD * 0.55, H - rD * 0.3, false],
      [M * 0.99, H - rD * 1.1, false], [M, 0.64 * H, false], [M * 0.9, 0.3 * H, false], [C, 0, true],
    ];
  }
  if (t.cls === 'canine' || t.peg) {
    const tip = (e?.tipA ?? 0) * M, sl = e?.slope ?? 0.6;
    return [
      [-C, 0, true], [-M * 0.95, 0.45 * H, false], [-M, 0.72 * H, false], [tip - (M + tip) * 0.55, H - (M + tip) * 0.55 * sl, false],
      [tip, H, true], [tip + (M - tip) * 0.5, H - (M - tip) * 0.5 * sl * 1.1, false], [M, 0.6 * H, false], [M * 0.9, 0.3 * H, false], [C, 0, true],
    ];
  }
  if (t.cls === 'premolar') {
    return [
      [-C, 0, true], [-M * 0.95, 0.4 * H, false], [-M, 0.74 * H, false], [-M * 0.42, H - 1.0, false], [-0.1, H, false],
      [M * 0.45, H - 1.05, false], [M, 0.7 * H, false], [M * 0.95, 0.4 * H, false], [C, 0, true],
    ];
  }
  // molars: buccal cusps with grooves between
  const pts: [number, number, boolean][] = [[-C, 0, true], [-M * 0.97, 0.35 * H, false], [-M, 0.7 * H, false]];
  if (t.jaw === 'lower' && t.cusps.length === 5) {
    pts.push([-M * 0.6, H, false], [-M * 0.18, H - 0.9, false], [M * 0.2, H - 0.1, false], [M * 0.5, H - 0.95, false], [M * 0.78, H - 0.5, false]);
  } else {
    pts.push([-M * 0.55, H, false], [-M * 0.05, H - 1.0, false], [M * 0.45, H - 0.25, false]);
  }
  pts.push([M, 0.66 * H, false], [M * 0.95, 0.35 * H, false], [C, 0, true]);
  return pts;
}

/** Root control points, distal CEJ -> apex(es) -> mesial CEJ (exclusive of the CEJ points); [s, h]. */
/** Root length drawn in the buccal profile: the lower anteriors' roots a little shorter than the table (their crowns
 *  read short on a pano; the crown : root ratio stays ~1 : 1.2 - 1.4). */
function profileRootL(t: Tooth) { return t.rootL * (t.jaw === 'lower' && t.pos <= 2 ? 0.82 : 1); }
function rootCtl(t: Tooth): { pts: V2[]; apices: V2[]; trunk: number; extra: V2[][] } {
  const C = t.cervMD / 2, R = profileRootL(t);
  const curve = t.cls === 'molar' ? 1.6 : t.cls === 'canine' ? 0.9 : 0.6; // apices bend distally
  const bend = (s: number, h: number): V2 => [s + curve * Math.pow(Math.max(0, -h) / R, 2), h];
  if (t.cls !== 'molar' || t.type === 'molar3') {
    const w = t.type === 'molar3' ? C * 0.9 : C;
    const pts: V2[] = [bend(w * 0.92, -0.3 * R), bend(w * 0.58, -0.72 * R), bend(w * 0.18, -0.97 * R), bend(0, -R), bend(-w * 0.22, -0.96 * R), bend(-w * 0.6, -0.7 * R), bend(-w * 0.93, -0.3 * R)];
    // the upper first premolar: buccal and palatal roots, split in their apical half (a bifid apex, the second root
    // seen through the first)
    const extra: V2[][] = t.jaw === 'upper' && t.type === 'premolar1'
      ? [chaikin([bend(w * 0.55, -0.42 * R), bend(w * 0.7, -0.75 * R), bend(w * 0.45, -0.98 * R), bend(w * 0.12, -0.9 * R), bend(w * 0.05, -0.55 * R)], [false, false, false, false, false], 3)]
      : [];
    return { pts, apices: [bend(0, -R)], trunk: R, extra };
  }
  const T = t.jaw === 'upper' ? 4.2 : 3.2;
  if (t.jaw === 'upper') {
    // distobuccal (shorter), mesiobuccal; the palatal root superimposed between them
    const RD = R * 0.86, RM = R * 0.95;
    // the two buccal roots diverge from a short trunk, the furcation well clear of the cervical line
    const pts: V2[] = [
      bend(C * 1.0, -T * 0.6), bend(C * 1.06, -0.5 * RD), bend(C * 0.96, -0.9 * RD), bend(C * 0.8, -RD), bend(C * 0.6, -0.9 * RD), bend(C * 0.46, -0.5 * RD), bend(C * 0.3, -T * 1.12), bend(C * 0.05, -T),
      bend(-C * 0.2, -T * 1.12), bend(-C * 0.34, -0.5 * RM), bend(-C * 0.5, -0.9 * RM), bend(-C * 0.72, -RM), bend(-C * 0.94, -0.88 * RM), bend(-C * 1.08, -0.5 * RM), bend(-C * 1.02, -T * 0.6),
    ];
    const RP = R * 1.05;
    const pal = chaikin([bend(C * 0.28, -T * 0.8), bend(C * 0.24, -0.6 * RP), bend(C * 0.08, -RP), bend(-C * 0.12, -0.96 * RP), bend(-C * 0.3, -0.6 * RP), bend(-C * 0.32, -T * 0.8)], [false, false, false, false, false, false], 3);
    return { pts, apices: [bend(C * 0.8, -RD), bend(-C * 0.72, -RM)], trunk: T, extra: [pal] };
  }
  // lower molars: mesial (broad, curved) and distal roots
  const RM = R, RD = R * 0.92;
  const pts: V2[] = [
    bend(C * 0.98, -T * 0.6), bend(C * 1.0, -0.5 * RD), bend(C * 0.9, -0.9 * RD), bend(C * 0.7, -RD), bend(C * 0.5, -0.9 * RD), bend(C * 0.36, -0.5 * RD), bend(C * 0.25, -T * 1.08), bend(C * 0.02, -T),
    bend(-C * 0.2, -T * 1.08), bend(-C * 0.26, -0.5 * RM), bend(-C * 0.36, -0.92 * RM), bend(-C * 0.56, -RM), bend(-C * 0.8, -0.92 * RM), bend(-C * 1.0, -0.5 * RM), bend(-C * 1.0, -T * 0.6),
  ];
  return { pts, apices: [bend(C * 0.7, -RD), bend(-C * 0.56, -RM)], trunk: T, extra: [] };
}

/** The chip in buccal view: removes the mesial-incisal corner (s < 0). [p0, n] for clipHalfPlane. */
function chipBuccal(t: Tooth): [V2, V2] {
  const M = t.md / 2, H = t.crownH, c = t.chip!;
  const p0: V2 = [-M + c.along, H + 0.2];
  const p1: V2 = [-M - 0.2, H - c.down];
  let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0];
  if ((-M - p0[0]) * nx + (H - p0[1]) * ny < 0) { nx = -nx; ny = -ny; }
  return [p0, [nx, ny]];
}

const profileCache = new WeakMap<Tooth, Profile>();
export function buccalProfile(t: Tooth): Profile {
  const hit = profileCache.get(t);
  if (hit) return hit;
  const H = t.crownH, R = profileRootL(t), C = t.cervMD / 2, M = t.md / 2;
  const cc = crownCtl(t);
  const rr = rootCtl(t);
  // whole outline
  const ctl: V2[] = [...cc.map(([s, h]) => [s, h] as V2), ...rr.pts];
  // the canine's cusp tip stays a point
  let outline = chaikin(ctl, [...cc.map((c) => c[2] && c[1] > 0.5 * H), ...rr.pts.map(() => false)], 3);
  // the crown curve alone (open), for the enamel
  const crown = chaikinOpen(cc.map(([s, h]) => [s, h] as V2), 3);
  const tMax = t.cls === 'molar' ? 2.0 : t.cls === 'premolar' ? 1.7 : t.cls === 'canine' ? 1.5 : 1.2;
  const inner: V2[] = [];
  for (let i = 0; i < crown.length; i++) {
    const a = crown[Math.max(0, i - 1)]!, b = crown[Math.min(crown.length - 1, i + 1)]!;
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const p = crown[i]!;
    const th = 0.08 + tMax * Math.pow(smooth01(0.0, 0.8 * H, p[1]), 0.8);
    inner.push([p[0] + ty * th, p[1] - tx * th]); // right normal = inward (the crown is traced clockwise)
  }
  let enamel: V2[] = [...crown, ...inner.reverse()];
  // pulp
  const hT = t.cls === 'incisor' ? 0.58 * H : t.cls === 'canine' ? 0.55 * H : 0.42 * H;
  let pulpCtl: V2[];
  if (t.cls === 'molar' && rr.apices.length === 2) {
    const [aD, aM] = rr.apices as [V2, V2];
    pulpCtl = [
      [-C * 0.55, 0.12 * H], [-M * 0.45, hT + 0.4], [-M * 0.2, hT - 0.3], [M * 0.25, hT - 0.3], [M * 0.45, hT + 0.2], [C * 0.55, 0.12 * H],
      [C * 0.5, -rr.trunk * 0.55], [aD[0] + 0.25, aD[1] * 0.75], [aD[0] + 0.05, aD[1] + 0.6], [aD[0] - 0.12, aD[1] + 0.6], [aD[0] - 0.3, aD[1] * 0.75], [C * 0.1, -rr.trunk * 0.7],
      [-C * 0.1, -rr.trunk * 0.7], [aM[0] + 0.3, aM[1] * 0.75], [aM[0] + 0.12, aM[1] + 0.6], [aM[0] - 0.05, aM[1] + 0.6], [aM[0] - 0.25, aM[1] * 0.75], [-C * 0.5, -rr.trunk * 0.55],
    ];
  } else {
    const ap = rr.apices[0]!;
    const w = C * (t.cls === 'premolar' ? 0.32 : 0.34);
    pulpCtl = t.cls === 'premolar' || t.type === 'molar3'
      ? [[-w * 1.2, 0.1 * H], [-M * 0.38, hT + 0.5], [-M * 0.15, hT - 0.2], [M * 0.15, hT - 0.2], [M * 0.38, hT + 0.3], [w * 1.2, 0.1 * H], [w * 0.75, -0.35 * R], [ap[0] + 0.12, ap[1] + 0.7], [ap[0] - 0.12, ap[1] + 0.7], [-w * 0.75, -0.35 * R]]
      : [[-w, 0.1 * H], [-w * 0.7, hT * 0.8], [-0.25, hT], [0.25, hT], [w * 0.7, hT * 0.8], [w, 0.1 * H], [w * 0.6, -0.35 * R], [ap[0] + 0.1, ap[1] + 0.7], [ap[0] - 0.1, ap[1] + 0.7], [-w * 0.6, -0.35 * R]];
  }
  let pulp = chaikin(pulpCtl, pulpCtl.map(() => false), 3);
  let extraRoots = rr.extra;
  if (t.chip) {
    const [p0, n] = chipBuccal(t);
    outline = clipHalfPlane(outline, p0, n);
    enamel = clipHalfPlane(enamel, p0, n);
    pulp = clipHalfPlane(pulp, p0, n);
  }
  // the cervical line: the enamel's ends
  const cej: V2[] = chaikinOpen([[-C, 0.15], [-C * 0.4, -0.6], [C * 0.4, -0.6], [C, 0.15]], 2);
  const prof: Profile = { outline, enamel, pulp, extraRoots, cej, H, R };
  profileCache.set(t, prof);
  return prof;
}

// ------------------------------------------------------------------------------------------------ bite mark
export interface Mark { n: number; poly: V2[]; center: V2; angle: number; depth: number }
/** The bite pattern of the anterior teeth (canine to canine), as photographed from the biter's side (see header). */
export function biteMark(arch: Arch, opts: { gap?: number; mirror?: boolean } = {}): { upper: Mark[]; lower: Mark[] } {
  const gap = opts.gap ?? 16;
  const res = { upper: [] as Mark[], lower: [] as Mark[] };
  for (const jaw of ['upper', 'lower'] as Jaw[]) {
    const ns = jaw === 'upper' ? [6, 7, 8, 9, 10, 11] : [22, 23, 24, 25, 26, 27];
    const ts = ns.map((n) => tooth(arch, n)).filter((t) => t.present);
    // the canines' depth: the arc's open ends sit at Y = +-gap/2
    const canY = Math.max(...ts.filter((t) => t.cls === 'canine').map((t) => t.center[1]), ...ts.map((t) => t.center[1]));
    const map = (p: V2): V2 => {
      const X = -p[0] * (opts.mirror ? -1 : 1);
      const Y = gap / 2 + (canY - p[1]);
      return jaw === 'upper' ? [X, Y] : [X, -Y];
    };
    for (const t of ts) {
      const e = t.edge!;
      const A = t.md / 2, bE = t.outlineOff + e.b;
      let loc: V2[] = [];
      if (e.pointed) {
        // a small triangle: the cusp tip pressed in, wider toward its ridges
        const ta = e.tipA * A;
        loc = [[ta - 1.25, bE + 0.15], [ta + 1.35, bE + 0.05], [ta + 0.05, bE - 1.6]];
        loc = chaikin(loc, [false, false, false], 2);
      } else {
        // a rounded bar along the edge, a little wider than the edge
        const half = e.half + (jaw === 'upper' ? 0.25 : 0.2);
        const a0 = -A + e.rM * 0.7, a1 = A - e.rD * 0.6;
        const N = 12;
        const top: V2[] = [], bot: V2[] = [];
        for (let i = 0; i <= N; i++) {
          const a = a0 + ((a1 - a0) * i) / N;
          const u = a / A;
          const bc = bE - 0.35 * u * u;
          top.push([a, bc + half]);
          bot.push([a, bc - half]);
        }
        loc = chaikin([...top, ...bot.reverse()], [...top.map(() => false), ...bot.map(() => false)], 2);
        if (t.chip) {
          // the chip: the mesial end is missing, cut on a slant (the facet bites shallower, leaving a notch)
          const p0: V2 = [-A + t.chip.along, bE + half + 0.2];
          const p1: V2 = [-A + t.chip.along - 1.0, bE - half - 0.2];
          let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0];
          if ((-A - p0[0]) * nx + (bE - p0[1]) * ny < 0) { nx = -nx; ny = -ny; }
          loc = clipHalfPlane(loc, p0, [nx, ny]);
        }
      }
      const poly = loc.map(([a, b]) => map(toArch(t, a, b)));
      const cen = map(toArch(t, 0, bE));
      const d0 = map(toArch(t, -1, bE)), d1 = map(toArch(t, 1, bE));
      const depth = t.cls === 'canine' ? 1 : t.type === 'central' ? 0.85 : 0.65;
      res[jaw].push({ n: t.n, poly, center: cen, angle: Math.atan2(d1[1] - d0[1], d1[0] - d0[0]), depth });
    }
  }
  return res;
}

// ------------------------------------------------------------------------------------------------ panoramic layout
export interface PanoTooth {
  n: number;
  /** film mm (X right = the patient's left, Y up): the tooth's tip (incisal edge / cusp level) */
  x: number; y: number;
  /** rotation of the tooth's axis (rad, counter-clockwise), mirror of s (-1 on the patient's right), up (+1 lower
   *  tooth: crown up; -1 upper: crown down), horizontal magnification (anteriors narrower, as in a real OPG) */
  angle: number; mirror: number; up: number; mag: number;
}
const PANO_MAG = [0.9, 0.86, 0.92, 0.98, 1.0, 1.04, 1.06, 1.07];
/** The occlusal curve of the panoramic ("smile"): film Y of the occlusal line at film X. */
export const panoOcclusal = (X: number) => 0.0042 * X * X;
export function panoramic(arch: Arch): PanoTooth[] {
  const out: PanoTooth[] = [];
  for (const jaw of ['upper', 'lower'] as Jaw[]) {
    for (const side of ['R', 'L'] as Side[]) {
      let X = 0;
      let prev: Tooth | null = null;
      for (let pos = 0; pos < 8; pos++) {
        const n = toothNumber(jaw, side, pos);
        const t = tooth(arch, n);
        // arc length along the arch between contacts (keeps gaps and spacing)
        const cm = t.contactM, cd = t.contactD;
        const gap = prev ? Math.hypot(cm[0] - prev.contactD[0], cm[1] - prev.contactD[1]) : Math.abs(cm[0]);
        const w = Math.hypot(cd[0] - cm[0], cd[1] - cm[1]);
        const mag = PANO_MAG[pos]!;
        X += gap * mag;
        const xc = X + (w * mag) / 2;
        X += w * mag;
        prev = t;
        const sx = side === 'L' ? 1 : -1;
        const fx = sx * xc;
        const occ = panoOcclusal(fx);
        // the bite block: incisors edge to edge, the posteriors a little apart
        const open = 0.6 + 2.2 * smooth01(8, 30, Math.abs(fx));
        const up = jaw === 'lower' ? 1 : -1;
        const y = occ - up * open * 0.5 + up * 0.0;
        // the axis is normal to the occlusal curve, and fans out a little toward the back
        const slope = Math.atan(0.0084 * fx);
        const fan = sx * up * -0.05 * pos * 0.5;
        out.push({ n, x: fx, y, angle: slope + fan + sx * up * -t.tip * 0.6, mirror: sx, up, mag });
      }
    }
  }
  return out.sort((a, b) => a.n - b.n);
}
/** A buccal-profile point (s, h) of tooth `p` (with crown height H) in film mm. */
export function panoPoint(p: PanoTooth, H: number, s: number, h: number): V2 {
  const lx = s * p.mirror * p.mag, ly = (h - H) * p.up; // tip at the origin; lower crowns up, upper crowns down
  const c = Math.cos(p.angle), sn = Math.sin(p.angle);
  return [p.x + lx * c - ly * sn, p.y + lx * sn + ly * c];
}

// ------------------------------------------------------------------------------------------------ 3D: data texture
/** Cast base dimensions (mm): base top (upper: +Y, lower: -Y), the trim's buccal reach beyond the arch line. */
export const CAST = { top: 26, reach: 10.5, back: 4 };
const TEX_W = 16, TEX_H = 34;
/** Pack an arch into the RGBA32F rows GLSL_TEETH reads (32 tooth rows + 2 arch-line rows). */
export function teethData(arch: Arch): Float32Array {
  const d = new Float32Array(TEX_W * TEX_H * 4);
  const put = (row: number, k: number, x: number, y: number, z: number, w: number) => { const o = (row * TEX_W + k) * 4; d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = w; };
  for (const t of arch.teeth) {
    const r = t.n - 1;
    const sJaw = t.jaw === 'upper' ? -1 : 1;
    const kind = !t.present ? 0 : t.peg ? 2 : t.cls === 'incisor' ? 1 : t.cls === 'canine' ? 2 : t.cls === 'premolar' ? 3 : 4;
    const ycej = t.yTip - sJaw * t.crownH; // upper: above the tip; lower: below
    put(r, 0, t.center[0], t.center[1], t.u[0], t.u[1]);
    put(r, 1, t.md / 2, t.bl / 2, t.crownH, kind);
    put(r, 2, ycej, sJaw, t.outlineOff, 0.7 * t.crownH);
    put(r, 3, t.cervMD / 2, t.cervBL / 2, t.shape.nLab, t.shape.nLing);
    put(r, 4, t.shape.taper, t.shape.skew, t.torque, t.tip);
    const e = t.edge;
    if (e) put(r, 5, e.b, e.half, e.pointed ? e.tipA * (t.md / 2) : e.rM, e.pointed ? e.slope : e.rD);
    put(r, 6, t.chip ? 1 : 0, t.chip?.along ?? 0, t.chip?.down ?? 0, t.papilla);
    t.cusps.slice(0, 5).forEach((c, i) => put(r, 7 + i, c.a, c.b, c.depth, c.r));
    // bound: mid-crown, radius over the crown and its socket
    const ym = ycej + sJaw * t.crownH * 0.45;
    const br = Math.hypot(Math.max(t.md, t.bl) / 2 + 2.6, t.crownH * 0.6 + 3.5);
    const cb = toArch(t, 0, t.outlineOff);
    put(r, 12, cb[0], ym, -cb[1], t.present ? br : -1);
    put(r, 13, 0.75, t.v[0], t.v[1], 0);
    put(r, 14, Math.sin(t.torque), Math.cos(t.torque), Math.sin(t.tip), Math.cos(t.tip));
  }
  // arch lines (half arch, x >= 0): 16 points with the gum level (head Y)
  for (const [row, jaw] of [[32, 'upper'], [33, 'lower']] as [number, Jaw][]) {
    const ns = jaw === 'upper' ? [9, 10, 11, 12, 13, 14, 15, 16] : [24, 23, 22, 21, 20, 19, 18, 17];
    const pts: [number, number, number][] = [];
    const f = jaw === 'upper' ? arch.upperForm : arch.lowerForm;
    {
      const t0 = tooth(arch, ns[0]!);
      const s0 = t0.jaw === 'upper' ? -1 : 1;
      pts.push([0, f.y0 - 0.4, t0.yTip - s0 * (t0.crownH - 0.8)]);
    }
    for (const n of ns) {
      const t = tooth(arch, n);
      const sJaw = t.jaw === 'upper' ? -1 : 1;
      const gy = t.yTip - sJaw * (t.crownH - 0.8);
      const L = toArch(t, 0, t.outlineOff * 0.5);
      pts.push([Math.abs(L[0]), L[1], gy]);
    }
    // continue behind the last molar
    const a = pts[pts.length - 2]!, b = pts[pts.length - 1]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    pts.push([b[0] + (dx / l) * 5, b[1] + (dy / l) * 5, b[2]]);
    for (let i = 0; i < 16; i++) { const p = pts[Math.min(i, pts.length - 1)]!; put(row, i, p[0], p[1], p[2], i < pts.length ? 1 : 0); }
  }
  return d;
}

/** The arch as a float texture for GLSL_TEETH. `set(arch)` swaps the person without recompiling. */
export class TeethTex {
  texture: THREE.DataTexture;
  constructor(arch: Arch = HIS) {
    this.texture = new THREE.DataTexture(teethData(arch), TEX_W, TEX_H, THREE.RGBAFormat, THREE.FloatType);
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;
  }
  set(arch: Arch) {
    (this.texture.image.data as Float32Array).set(teethData(arch));
    this.texture.needsUpdate = true;
  }
}

// ------------------------------------------------------------------------------------------------ 3D: the SDF
export const GLSL_TEETH = /* glsl */ `
// ---- the tooth set (teeth.ts). Head frame, mm, right-handed: X patient's left, Y up, Z ANTERIOR (arch y = -Z).
uniform highp sampler2D teethTex;
vec4 tth(int i, int k) { return texelFetch(teethTex, ivec2(k, i), 0); }
/** Per-ray candidates (bit i = tooth i+1): teethRay(ro, rd) keeps only the teeth whose bounds the ray passes; the
 *  loops skip the rest. All set by default (every tooth considered). Call it again for a shadow ray. */
uint tCand = 0xFFFFFFFFu;
void teethRay(vec3 ro, vec3 rd) {
  tCand = 0u;
  for (int i = 0; i < 32; i++) {
    vec4 bd = tth(i, 12);
    if (bd.w <= 0.0) continue;
    float R = bd.w + 4.5;
    vec3 oc = ro - bd.xyz;
    float b = dot(oc, rd), c = dot(oc, oc) - R * R;
    if (c < 0.0 || (b < 0.0 && b * b - c >= 0.0)) tCand |= 1u << uint(i);
  }
}
const float CAST_TOP = ${CAST.top.toFixed(2)}, CAST_REACH = ${CAST.reach.toFixed(2)}, CAST_BACK = ${CAST.back.toFixed(2)};

/** Superellipse (exponent nB on the +y half, nL on the -y half): (radial distance estimate, level value). */
vec2 tSuper(vec2 p, vec2 r, float nB, float nL) {
  float n = mix(nL, nB, smoothstep(-0.45 * r.y, 0.45 * r.y, p.y));
  vec2 q = abs(p) / r;
  float k = pow(pow(q.x, n) + pow(q.y, n), 1.0 / n);
  float l = length(p);
  return vec2(k > 1e-3 ? l - l / k : -min(r.x, r.y), k);
}

/** Tooth i's local frame: (a distal, b buccal from the outline centre, c up the crown), crown upright. */
vec3 tLocal(int i, vec3 p, out vec4 dims) {
  vec4 t0 = tth(i, 0), t2 = tth(i, 2), t14 = tth(i, 14), t13 = tth(i, 13);
  dims = tth(i, 1);
  vec2 rel = vec2(p.x, -p.z) - t0.xy;
  float a = dot(rel, t0.zw), b = dot(rel, t13.yz);
  float c = t2.y * (p.y - t2.x);
  // torque (labial crown) and tip (mesial crown) about the contact level
  float cp = t2.w;
  float st = t14.x, ct = t14.y;
  vec2 bc = vec2(b, c - cp);
  b = bc.x * ct - bc.y * st; c = bc.x * st + bc.y * ct + cp;
  float sp = t14.z, cq = t14.w;
  vec2 ac = vec2(a, c - cp);
  a = ac.x * cq + ac.y * sp; c = -ac.x * sp + ac.y * cq + cp;
  return vec3(a, b - t2.z, c);
}

/** Posterior crown: a bulging superellipse prism under an occlusal surface of rounded cusp cones and a marginal rim. */
float tCrownPost(int i, vec3 q, vec4 D) {
  vec4 cer = tth(i, 3), shp = tth(i, 4);
  float A = D.x, B = D.y, H = D.z;
  float t = q.z / H;
  float sA = mix(cer.x / A, 1.0, smoothstep(-0.05, 0.6, t)) * (1.0 - 0.07 * smoothstep(0.65, 1.0, t));
  float sB = mix(cer.y / B, 1.0, smoothstep(-0.05, 0.38, t)) * (1.0 - 0.17 * smoothstep(0.5, 1.05, t));
  vec2 p = q.xy;
  p.x += shp.y * p.y;
  p.x /= 1.0 - shp.x * (1.0 - smoothstep(-B, 0.0, p.y));
  vec2 sd = tSuper(p, vec2(A * sA, B * sB), cer.z, cer.w);
  float z = -1e3;
  for (int k = 0; k < 5; k++) {
    vec4 cu = tth(i, 7 + k);
    if (cu.w <= 0.0) break;
    float d = length(q.xy - cu.xy);
    float r = cu.w * 0.7;
    z = smax(z, H - cu.z - 0.78 * (sqrt(d * d + r * r) - r), 0.28);
  }
  float kr = tSuper(p, vec2(A, B), cer.z, cer.w).y;
  float marg = smoothstep(0.35, 0.75, abs(p.x) / A);
  z = smax(z, H - 1.5 - 1.3 * abs(kr - 0.74) * min(A, B) - 2.0 * (1.0 - marg), 0.35);
  return smax(sd.x * 0.8, (q.z - z) * 0.62, 0.45);
}

/** Anterior crown: a blade, labial face convex, lingual shovel with marginal ridges and cingulum; incisal edge flat
 *  with rounded corners (incisors) or a cusp (canines, pegs); the chip off the mesial-incisal corner. */
float tCrownAnt(int i, vec3 q, vec4 D, bool pointed) {
  vec4 cer = tth(i, 3), shp = tth(i, 4), E = tth(i, 5), ch = tth(i, 6);
  // (a touch wider than the nominal crown, so neighbours meet at their contact points: a tight arch, no gaps)
  float A = D.x * 1.05, B = D.y, H = D.z;
  float a = q.x, b = q.y, c = q.z;
  float t = clamp(c / H, -0.5, 1.2);
  float u = a / A, u2 = min(u * u, 1.6);
  float eB = E.x, eh = E.y;
  // the labial face: full in the cervical third, curving in toward the edge, rounded across
  float tl = max(t - 0.2, 0.0) / 0.8;
  float lab = B - (B - eB - eh) * tl * tl - (pointed ? 1.35 : 0.95) * u2 * smoothstep(-0.3, 0.5, t);
  if (pointed) {
    // the canine's labial ridge: a broad vertical crest down from the cusp tip
    float ra = (a - E.z) / (0.55 * A);
    lab += 0.6 * exp(-ra * ra) * smoothstep(0.05, 0.6, t);
  } else {
    // incisors: three labial lobes, two shallow developmental depressions between them in the incisal two thirds
    float au = abs(u);
    lab -= 0.05 * exp(-((au - 0.36) * (au - 0.36)) / 0.03) * smoothstep(0.35, 0.85, t);
  }
  // the lingual face: the cingulum near the cervix, the fossa between marginal ridges
  float rs = 1.0 - smoothstep(0.04, 0.9, t);
  float ramp = 1.0 - rs * rs;
  float lin = mix(-B, eB - eh, ramp);
  lin += (pointed ? 0.35 : 0.85) * max(1.0 - u2 / 0.5, 0.0) * smoothstep(0.28, 0.52, t) * (1.0 - smoothstep(0.78, 0.96, t));
  lin -= (pointed ? 0.45 : 0.6) * exp(-((t - 0.22) * (t - 0.22)) / 0.012) * max(1.0 - u2 / 0.35, 0.0);
  lin -= 0.25 * u2 * (1.0 - t);
  float dB = max(b - lab, lin - b) * 0.85;
  // the cross-section: the occlusal outline (triangular: broad labially, the cingulum narrow), shrinking to the cervix
  float sA = mix(cer.x / A * 0.94, 1.0, smoothstep(0.05, 0.92, t));   // the crown narrows toward the gum
  float sB = mix(cer.y / B, 1.0, smoothstep(-0.05, 0.3, t));
  vec2 p = vec2(a, b);
  p.x /= 1.0 - shp.x * (1.0 - smoothstep(-B, 0.0, p.y));
  float dXS = tSuper(p, vec2(A * sA, B * sB), cer.z, cer.w).x * 0.8;
  float d2 = smax(dXS, dB, 0.4);
  float d;
  if (pointed) {
    // a distinct cusp: steeper ridges, a small rounded tip, the mesial ridge shorter than the distal
    float sl = E.w * 1.4;
    float da = a - E.z;
    float top = c - (H - sl * (da < 0.0 ? 1.15 : 0.9) * (sqrt(da * da + 0.09) - 0.3));
    d = smax(d2, top / sqrt(1.0 + sl * sl), 0.35);
  } else {
    // incisal outline: slightly rounded across, softened mamelons, the corners rounded (mesial sharper)
    float r = a < 0.0 ? E.z : E.w;
    float edgeH = H - 0.22 * u2 + 0.06 * cos(u * 9.4) * (1.0 - u2);
    vec2 w = vec2(abs(a) - (A - r), c - (edgeH - r));
    d = smax(d2, length(max(w, 0.0)) + min(max(w.x, w.y), 0.0) - r, 0.25);
  }
  if (ch.x > 0.5) {
    // the chip: material missing off the mesial-incisal corner; a shallow concave (conchoidal) fracture scooped
    // straight through the edge, meeting the incisal edge "along" mm from the corner and the mesial side "down" mm
    // below it, with crisp edges (a sphere subtracted, no blending)
    float al = ch.y, dn = ch.z, yy = 1.0;
    float xx = (dn * dn - al * al + 2.0 * dn * yy) / (2.0 * al);
    vec2 cc = vec2(-A - xx, H + yy);
    float R = length(vec2(al + xx, yy));
    float ds = length(vec3(a - cc.x, (b - eB) * 0.45, c - cc.y));
    d = max(d, R - ds);
  }
  return d;
}

float tCrown(int i, vec3 p) {
  vec4 D;
  vec3 q = tLocal(i, p, D);
  int kind = int(D.w + 0.5);
  if (kind >= 3) return tCrownPost(i, q, D);
  return tCrownAnt(i, q, D, kind == 2);
}

/** Tooth i's gum socket: the margin follows the cervical line, rising to papillae between the teeth. */
float tSocket(int i, vec3 p) {
  vec4 D;
  vec3 q = tLocal(i, p, D);
  vec4 cer = tth(i, 3), ch = tth(i, 6);
  float depth = max(-q.z, 0.0);
  vec2 hw = vec2(cer.x + 1.0 + 0.12 * depth, cer.y + 1.35 + 0.2 * depth);
  float s2 = tSuper(q.xy + vec2(0.0, 0.3), hw, 2.4, 2.4).x;
  float ua = abs(q.x) / hw.x;
  // the margin follows the cervical line; the papillae fill the embrasures as low, rounded cones (not spikes)
  float gc = 0.75 + ch.w * smoothstep(0.4, 1.05, ua);   // the papillae fill the embrasures up to the contacts
  float d = smax(s2, (q.z - gc) * 0.8, 1.3);
  return max(d, -9.0 - q.z);
}

/** Crowns of one jaw (0 upper, 1 lower): distance and the nearest tooth's number (0 if none near). */
float sdTeeth(vec3 p, int jaw, out int id) {
  float d = 1e3; id = 0;
  int i0 = jaw == 0 ? 0 : 16;
  for (int i = i0; i < i0 + 16; i++) {
    if (((tCand >> uint(i)) & 1u) == 0u) continue;
    vec4 bd = tth(i, 12);
    if (bd.w <= 0.0) continue;
    float db = length(p - bd.xyz) - bd.w;
    if (db > d) continue;
    float dc = tCrown(i, p);
    if (dc < d) { d = dc; id = i + 1; }
  }
  return d;
}

/** Signed distance (2D, head XZ) to a jaw's arch line, + buccal; and the gum level (head Y) there. */
vec2 tArchLine(vec2 xz, int jaw) {
  // a smooth (soft-min) distance, so the vault and the base have no creases where the nearest segment changes.
  // Both halves of the arch take part (the mirrored half too): with the half arch alone the soft-min has a kink on
  // the midline (x = 0), a crease down the front of the base; with both, the midline joins like any other vertex.
  int row = 32 + jaw;
  vec2 q = vec2(abs(xz.x), xz.y);
  float sgn = 1.0, es = 0.0, gs = 0.0, ws = 0.0;
  const float K = 2.0;
  vec4 a = tth(row, 0);
  for (int k = 1; k < 16; k++) {
    vec4 b = tth(row, k);
    if (b.w <= 0.0) break;
    for (int m = 0; m < 2; m++) {
      vec2 A = a.xy, B = b.xy;
      if (m == 1) { A.x = -A.x; B.x = -B.x; }
      vec2 pa = q - A, ba = B - A;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      float dd = length(pa - ba * h);
      es += exp(-dd / K);
      float w = 1.0 / (dd * dd + 4.0);
      gs += w * mix(a.z, b.z, h); ws += w;
    }
    if (q.x >= a.x && q.x < b.x) { float kk = (q.x - a.x) / max(b.x - a.x, 1e-4); sgn = q.y > mix(a.y, b.y, kk) ? -1.0 : 1.0; }
    a = b;
  }
  if (q.x >= a.x) sgn = 1.0;
  float d = -K * log(max(es, 1e-30));
  return vec2(max(d, 0.0) * sgn, gs / max(ws, 1e-6));
}

/** The cast's base without the sockets: alveolar ridge, palatal vault (upper) or tongue space (lower), vestibule,
 *  the trim. al = tArchLine(vec2(p.x, -p.z), jaw). */
float tBase(vec3 p, int jaw, vec2 al) {
  float s = jaw == 0 ? 1.0 : -1.0;        // +Y is "into the cast" for the upper
  float d = al.x, gy = al.y;
  float h;
  if (jaw == 0) h = 2.2 + 12.0 * (1.0 - smoothstep(-18.0, -1.5, d)) + 5.5 * smoothstep(2.5, 8.5, d);
  else h = 2.2 + 8.0 * (1.0 - smoothstep(-6.5, -2.0, d)) + 5.5 * smoothstep(2.5, 8.5, d);
  float low = (gy + s * h);
  float dLow = s * (low - p.y) * 0.62;
  float dW = d - CAST_REACH;
  float dTop = s * p.y - CAST_TOP;
  // trimmed behind the arch's end
  vec4 e = tth(32 + jaw, 9);
  float dBack = -p.z - (e.y + CAST_BACK - 5.0);
  float base = smax(smax(dLow, dW, 1.2), max(dTop, dBack), 1.0);
  if (jaw == 1) base = smax(base, -(d + 10.5), 1.0);    // the tongue space
  return base;
}

/** The gum sockets of one jaw (smooth union). */
float tSockets(vec3 p, int jaw) {
  float g = 1e3;
  int i0 = jaw == 0 ? 0 : 16;
  for (int i = i0; i < i0 + 16; i++) {
    if (((tCand >> uint(i)) & 1u) == 0u) continue;
    vec4 bd = tth(i, 12);
    if (bd.w <= 0.0) continue;
    if (length(p - bd.xyz) - bd.w - 4.0 > g) continue;
    g = smin(g, tSocket(i, p), 1.4);
  }
  return g;
}

/** The gum and the cast's base. Upper: alveolar ridge, palatal vault, vestibule, base to Y = +CAST_TOP, trimmed
 *  CAST_REACH buccal of the arch line and CAST_BACK behind the last molar. Lower: the same, horseshoe (tongue space). */
float sdGum(vec3 p, int jaw) {
  vec2 al = tArchLine(vec2(p.x, -p.z), jaw);
  return smin(tSockets(p, jaw), tBase(p, jaw, al), 2.2);
}

float sdCast(vec3 p, int jaw, out int id) {
  vec2 al = tArchLine(vec2(p.x, -p.z), jaw);
  float base = tBase(p, jaw, al);
  id = 0;
  // far from the dentate zone (9.5 mm either side of the arch line, from the tips to 15 mm into the gum): base only
  float yz = jaw == 0 ? max(-3.5 - p.y, p.y - 15.0) : max(p.y - 3.5, -15.0 - p.y);
  float zone = max(abs(al.x) - 9.5, yz);
  if (zone > base + 2.5) return base;
  float dg = smin(tSockets(p, jaw), base, 2.2);
  if (zone > dg + 0.6) return dg;
  float dt = sdTeeth(p, jaw, id);
  if (dg < dt) id = 0;
  return smin(dt, dg, 0.55);
}

/** A box around the cast (head frame). */
vec3 castBounds(int jaw, out vec3 lo) {
  if (jaw == 0) { lo = vec3(-40.0, -3.0, -62.0); return vec3(40.0, CAST_TOP + 0.5, 12.0); }
  lo = vec3(-38.0, -CAST_TOP - 0.5, -62.0); return vec3(38.0, 3.0, 9.0);
}
`;
