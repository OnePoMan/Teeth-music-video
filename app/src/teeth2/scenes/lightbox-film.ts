// lightbox: the panoramic radiograph (OPG) drawn once into a density map, from the tooth set (teeth.ts).
// Film mm: X right (the patient's left), Y up, origin on the occlusal line at the midline. Channels (0..255):
//   R  teeth (dentin, the denser enamel cap, pulp hollowed out, overlaps add up)
//   G  bone and soft tissue (trabecular texture is added in the shader where G is bone), air spaces multiplied down
//   B  metal (amalgam fillings: radiopaque, the film stays clear)
// Everything is a pure function of the arch: built in init().
import { HIS, buccalProfile, panoramic, panoPoint, panoOcclusal, tooth, type Arch, type V2, type PanoTooth } from '../teeth';
import { mulberry32 } from '../../engine/util';

/** The film: extent (mm) and resolution of the density map. */
export const FILM = { x0: -122, x1: 122, y0: -64, y1: 64, ppm: 18, corner: 2.5 };
export const FILM_W = Math.round((FILM.x1 - FILM.x0) * FILM.ppm);
export const FILM_H = Math.round((FILM.y1 - FILM.y0) * FILM.ppm);
const px = (X: number) => (X - FILM.x0) * FILM.ppm;
const py = (Y: number) => (FILM.y1 - Y) * FILM.ppm;

export interface FilmTooth { n: number; pano: PanoTooth; tip: V2; crownTop: V2; H: number }
export interface FilmInfo { canvas: HTMLCanvasElement; teeth: FilmTooth[]; fillings: { n: number; center: V2 }[] }

type Ctx = CanvasRenderingContext2D;
const path = (c: Ctx, pts: V2[], close = true) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(px(x), py(y)) : c.moveTo(px(x), py(y))));
  if (close) c.closePath();
};
const ell = (c: Ctx, X: number, Y: number, rx: number, ry: number, rot = 0) => {
  c.beginPath();
  c.ellipse(px(X), py(Y), rx * FILM.ppm, ry * FILM.ppm, -rot, 0, Math.PI * 2);
};
/** Fill with additive density in one channel. */
function add(c: Ctx, ch: 'r' | 'g' | 'b', v: number, blurMm = 0) {
  c.globalCompositeOperation = 'lighter';
  c.filter = blurMm > 0 ? `blur(${(blurMm * FILM.ppm).toFixed(1)}px)` : 'none';
  const k = Math.round(Math.max(0, Math.min(255, v)));
  c.fillStyle = ch === 'r' ? `rgb(${k},0,0)` : ch === 'g' ? `rgb(0,${k},0)` : `rgb(0,0,${k})`;
  c.fill();
}
function addStroke(c: Ctx, ch: 'r' | 'g' | 'b', v: number, widthMm: number, blurMm = 0) {
  c.globalCompositeOperation = 'lighter';
  c.filter = blurMm > 0 ? `blur(${(blurMm * FILM.ppm).toFixed(1)}px)` : 'none';
  const k = Math.round(Math.max(0, Math.min(255, v)));
  c.strokeStyle = ch === 'r' ? `rgb(${k},0,0)` : ch === 'g' ? `rgb(0,${k},0)` : `rgb(0,0,${k})`;
  c.lineWidth = widthMm * FILM.ppm;
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.stroke();
}
/** Multiply one channel by k (0..1) inside the current path. */
function mul(c: Ctx, ch: 'r' | 'g' | 'b', k: number, blurMm = 0, stroke = 0) {
  c.globalCompositeOperation = 'multiply';
  c.filter = blurMm > 0 ? `blur(${(blurMm * FILM.ppm).toFixed(1)}px)` : 'none';
  const m = Math.round(Math.max(0, Math.min(1, k)) * 255);
  const col = ch === 'r' ? `rgb(${m},255,255)` : ch === 'g' ? `rgb(255,${m},255)` : `rgb(255,255,${m})`;
  if (stroke > 0) { c.strokeStyle = col; c.lineWidth = stroke * FILM.ppm; c.stroke(); } else { c.fillStyle = col; c.fill(); }
}
/** A smooth closed curve through points (Catmull-Rom sampled). */
function smoothClosed(pts: V2[], n = 8): V2[] {
  const out: V2[] = [];
  const L = pts.length;
  for (let i = 0; i < L; i++) {
    const p0 = pts[(i - 1 + L) % L]!, p1 = pts[i]!, p2 = pts[(i + 1) % L]!, p3 = pts[(i + 2) % L]!;
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return out;
}
function smoothOpen(pts: V2[], n = 8): V2[] {
  const P = [pts[0]!, ...pts, pts[pts.length - 1]!];
  const out: V2[] = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = P[i + 2]!;
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}
/** Mirror a right-side outline to the left (X -> -X). */
const mir = (pts: V2[]): V2[] => pts.map(([x, y]) => [-x, y]);
const both = (c: Ctx, pts: V2[], f: () => void, close = true) => { path(c, pts, close); f(); path(c, mir(pts), close); f(); };

/** The mandible's outline (left half, X >= 0), film mm: from the symphysis along the inferior border, the angle, the
 *  ramus, the condyle, the sigmoid notch, the coronoid, down the anterior border to the retromolar area. */
const MANDIBLE_HALF: V2[] = [
  [0, -41], [20, -39.5], [40, -35.5], [58, -30], [72, -25], [82, -21], [88.5, -16.5], [91.5, -9], [92.5, 2], [93.5, 14], [95, 26],
  [96.5, 33], [99.5, 38], [100, 43.5], [96.5, 46.5], [91.5, 45], [89.5, 40], [86, 33.5], [81, 30.5], [77.5, 33], [75, 39],
  [72.5, 39.5], [70.5, 33], [69, 22], [67.5, 12], [64, 6.5], [60, 3.5],
];
/** The maxillary sinus (left), film mm. */
const SINUS: V2[] = [[22, 30], [26, 26.5], [33, 24.2], [40, 22.6], [47, 22.9], [54, 24.5], [60, 28], [63.5, 34], [63, 42], [58, 49], [48, 53], [36, 53], [27, 48], [21.5, 39]];

export function buildFilm(arch: Arch = HIS): FilmInfo {
  const cv = document.createElement('canvas');
  cv.width = FILM_W; cv.height = FILM_H;
  const c = cv.getContext('2d', { willReadFrequently: false })!;
  c.fillStyle = 'rgb(0,0,0)';
  c.fillRect(0, 0, FILM_W, FILM_H);
  const R = mulberry32(808);

  // ---------------------------------------------------------------- soft tissue
  c.save();
  ell(c, 0, -2, 112, 70); add(c, 'g', 26, 9);                 // the face and neck
  ell(c, 0, -6, 70, 52); add(c, 'g', 12, 10);
  // the tongue: a broad soft mass across the posterior teeth region
  path(c, smoothClosed([[-62, 16], [-30, 21], [0, 22], [30, 21], [62, 16], [66, 4], [40, -6], [0, -9], [-40, -6], [-66, 4]])); add(c, 'g', 16, 4);
  // the soft palate and the posterior pharyngeal wall
  for (const s of [1, -1]) { ell(c, s * 74, 18, 7, 16, s * 0.25); add(c, 'g', 10, 3); }
  // the lips: soft shadows crossing the crowns
  path(c, smoothClosed([[-34, 2.5], [-18, 3.8], [0, 4.6], [18, 3.8], [34, 2.5], [30, 15], [0, 19], [-30, 15]])); add(c, 'g', 13, 2.2);
  path(c, smoothClosed([[-30, -3], [0, -4.5], [30, -3], [27, -15], [0, -19], [-27, -15]])); add(c, 'g', 11, 2.4);
  // cervical spine ghost (anterior, blurred out of the focal trough)
  path(c, [[-15, -64], [15, -64], [13, 4], [-13, 4]]); add(c, 'g', 34, 7);
  path(c, [[-9, -64], [9, -64], [8, -14], [-8, -14]]); add(c, 'g', 18, 5);
  // the hyoid (a faint double shadow below the mandible)
  for (const s of [1, -1]) { path(c, [[s * 18, -50], [s * 46, -46], [s * 47, -49], [s * 19, -53]]); add(c, 'g', 20, 2.5); }
  c.restore();

  // ---------------------------------------------------------------- the maxilla
  const pano = panoramic(arch);
  const P = new Map(pano.map((p) => [p.n, p]));
  // the alveolar crest of each jaw: a line through the cervical lines (+1.5 mm into the bone)
  const crest = (jaw: 'upper' | 'lower'): V2[] => {
    const ns = jaw === 'upper' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] : [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];
    return ns.map((n) => { const t = tooth(arch, n); const p = P.get(n)!; return panoPoint(p, t.crownH, 0, -1.6); });
  };
  const cu = crest('upper'), cl = crest('lower');
  c.save();
  // alveolar process and the body of the maxilla up to the floor of the nose / sinus
  const maxTop: V2[] = [[66, 30], [50, 33], [30, 31], [15, 29], [0, 28.5], [-15, 29], [-30, 31], [-50, 33], [-66, 30]];
  const maxilla = smoothOpen([[-70, 12], ...cu.map(([x, y]): V2 => [x, y]), [70, 12]], 4).concat(smoothOpen(maxTop.slice().reverse().reverse(), 6));
  path(c, maxilla); add(c, 'g', 70, 1.2);
  // above the palate: the face's bone (zygoma, maxillary walls)
  path(c, smoothClosed([[-100, 28], [-60, 33], [-20, 31], [20, 31], [60, 33], [100, 28], [100, 64], [-100, 64]])); add(c, 'g', 34, 4);
  // hard palate: a bright band above the apices, rising to the sides
  const pal = smoothOpen([[-62, 31.5], [-40, 29.5], [-15, 28.5], [0, 28.3], [15, 28.5], [40, 29.5], [62, 31.5]], 8);
  path(c, pal, false); addStroke(c, 'g', 70, 2.6, 0.6);
  path(c, pal.map(([x, y]): V2 => [x, y + 1.8]), false); addStroke(c, 'g', 30, 1.2, 0.5);
  // the sinuses: air, with a thin cortical floor that dips between the molar roots
  for (const s of [1, -1]) {
    const sp = smoothClosed(SINUS.map(([x, y]): V2 => [s * x, y]), 8);
    path(c, sp); mul(c, 'g', 0.42, 1.0);
    path(c, sp); addStroke(c, 'g', 34, 0.9, 0.7);
    // the zygomatic buttress (key ridge): a bright inverted U above the first molar
    path(c, smoothOpen([[s * 43, 30], [s * 44, 40], [s * 49, 46], [s * 55, 41], [s * 56, 31]], 8), false); addStroke(c, 'g', 40, 2.6, 1.3);
    // the zygomatic arch going back to the ear
    path(c, smoothOpen([[s * 56, 46], [s * 72, 49], [s * 90, 49.5], [s * 106, 47]], 6), false); addStroke(c, 'g', 60, 5, 1.4);
    // the pterygomaxillary fissure (teardrop)
    path(c, smoothClosed([[s * 66, 36], [s * 68.5, 44], [s * 67, 50], [s * 64.5, 44]], 6)); mul(c, 'g', 0.6, 0.6);
    // the orbit's floor at the top
    path(c, smoothOpen([[s * 14, 62], [s * 22, 57], [s * 36, 55.5], [s * 48, 58], [s * 54, 63]], 6), false); addStroke(c, 'g', 50, 1.6, 0.8);
    // the inferior turbinate
    ell(c, s * 9.5, 38, 5.5, 3.6, s * 0.15); add(c, 'g', 25, 1.4);
  }
  // the incisive canal between the central roots, the anterior nasal spine
  ell(c, 0, 20.5, 1.4, 3.2); mul(c, 'g', 0.72, 0.5);
  path(c, [[-6, 29.2], [0, 30.6], [6, 29.2], [0, 28.8]]); add(c, 'g', 40, 0.5);
  // the nasal cavity (air) and septum
  path(c, smoothClosed([[-17, 30], [0, 29.5], [17, 30], [19, 45], [15, 64], [-15, 64], [-19, 45]], 6)); mul(c, 'g', 0.45, 1.2);
  path(c, [[0, 30], [0.4, 46], [-0.3, 64]], false); addStroke(c, 'g', 45, 1.5, 0.6);
  // the palatoglossal air space: a dark band between the tongue and the palate, over the maxillary roots
  path(c, smoothOpen([[-64, 18], [-40, 22.5], [0, 23.8], [40, 22.5], [64, 18]], 8).concat(smoothOpen([[64, 13.5], [40, 18.8], [0, 20.5], [-40, 18.8], [-64, 13.5]], 8)));
  mul(c, 'g', 0.6, 2.6);
  c.restore();

  // ---------------------------------------------------------------- the mandible
  c.save();
  const half = smoothOpen(MANDIBLE_HALF, 6);
  const mand: V2[] = [...mir(half).reverse(), ...half];
  // the body is bounded above by the alveolar crest: build a polygon from the crest and the outline
  const body: V2[] = [...half, ...cl.filter(([x]) => x >= 0).slice().reverse().map(([x, y]): V2 => [x, y]), ...cl.filter(([x]) => x < 0).slice().reverse(), ...mir(half).reverse()];
  void mand;
  path(c, body); add(c, 'g', 78, 1.0);
  // the rami are thinner bone: a little less dense
  for (const s of [1, -1]) {
    path(c, smoothClosed([[s * 66, 8], [s * 72, 34], [s * 80, 30], [s * 90, 42], [s * 94, 20], [s * 91, -10], [s * 80, -18], [s * 70, -6]], 6)); mul(c, 'g', 0.85, 2);
  }
  // the inferior cortex: a thick bright band along the lower border, thinning up the ramus
  const lower = half.filter(([x, y]) => y < 12 || x < 92);
  path(c, lower.slice(0, Math.floor(lower.length * 0.42)).map(([x, y]): V2 => [x, y + 1.6]), false); addStroke(c, 'g', 85, 3.6, 0.5);
  path(c, mir(lower.slice(0, Math.floor(lower.length * 0.42))).map(([x, y]): V2 => [x, y + 1.6]), false); addStroke(c, 'g', 85, 3.6, 0.5);
  path(c, half.map(([x, y]): V2 => [x - 0.8 * Math.sign(x), y]), false); addStroke(c, 'g', 52, 1.5, 0.3);
  path(c, mir(half).map(([x, y]): V2 => [x + 0.8 * Math.sign(-x), y]), false); addStroke(c, 'g', 52, 1.5, 0.3);
  for (const s of [1, -1]) {
    // the condyle's head and the articular eminence of the fossa above it
    ell(c, s * 97.5, 43.5, 4.6, 3.4, s * 0.3); add(c, 'g', 40, 0.4);
    path(c, smoothOpen([[s * 88, 46], [s * 93, 49.5], [s * 99, 50.5], [s * 104, 48]], 6), false); addStroke(c, 'g', 45, 1.4, 0.5);
    // the styloid process
    path(c, [[s * 103, 40], [s * 96, 16]], false); addStroke(c, 'g', 35, 1.3, 0.5);
    // the mandibular canal: dark, with thin bright walls, from the foramen in the ramus to the mental foramen
    const can = smoothOpen([[s * 84, 14], [s * 79, 4], [s * 70, -7], [s * 56, -16], [s * 42, -20.5], [s * 31, -21]], 8);
    path(c, can, false); mul(c, 'g', 0.55, 0.6, 2.8);
    path(c, can.map(([x, y]): V2 => [x, y + 1.6]), false); addStroke(c, 'g', 28, 0.45, 0.2);
    path(c, can.map(([x, y]): V2 => [x, y - 1.6]), false); addStroke(c, 'g', 28, 0.45, 0.2);
    ell(c, s * 29, -20.5, 2.0, 1.6); mul(c, 'g', 0.55, 0.6);
    // the external oblique ridge
    path(c, smoothOpen([[s * 52, -4], [s * 62, 0], [s * 68, 8], [s * 70.5, 22]], 6), false); addStroke(c, 'g', 35, 1.6, 0.6);
    // the pharyngeal airway crossing the ramus
    path(c, smoothOpen([[s * 78, -40], [s * 80, -10], [s * 78, 20], [s * 80, 40]], 6), false); mul(c, 'g', 0.72, 3, 7);
  }
  // the symphysis: the lingual cortex shows as a bright U under the incisor roots
  path(c, smoothOpen([[-10, -27], [-5, -35], [0, -36.5], [5, -35], [10, -27]], 8), false); addStroke(c, 'g', 35, 1.6, 0.7);
  c.restore();

  // ---------------------------------------------------------------- the teeth
  const filmTeeth: FilmTooth[] = [];
  const fillings: { n: number; center: V2 }[] = [];
  const restor = new Map(arch.restorations.map((r) => [r.n, r.surf]));
  c.save();
  const pp = FILM.ppm;
  for (const t of arch.teeth) {
    if (!t.present) continue;
    const p = P.get(t.n)!;
    const pr = buccalProfile(t);
    const H = t.crownH, M = t.md / 2;
    // draw in the tooth's own (s, h): an affine map from (s, h) to canvas px
    const cs = Math.cos(p.angle), sn = Math.sin(p.angle);
    const X00 = p.x + sn * H * p.up, Y00 = p.y - cs * H * p.up;
    const local = () => c.setTransform(cs * p.mirror * p.mag * pp, -sn * p.mirror * p.mag * pp, -sn * p.up * pp, -cs * p.up * pp, (X00 - FILM.x0) * pp, (FILM.y1 - Y00) * pp);
    const lpath = (pts: V2[], close = true) => { c.beginPath(); pts.forEach(([s, h], i) => (i ? c.lineTo(s, h) : c.moveTo(s, h))); if (close) c.closePath(); };
    const blurPx = (mm: number) => `blur(${(mm * pp).toFixed(1)}px)`;
    const op = (mode: GlobalCompositeOperation, blur: number, style: string | CanvasGradient) => { c.globalCompositeOperation = mode; c.filter = blur > 0 ? blurPx(blur) : 'none'; c.fillStyle = style; c.fill(); };
    // focal trough: the anteriors a little softer
    const soft = t.pos <= 1 ? 0.28 : t.pos === 2 ? 0.24 : 0.18;
    local();
    // the socket: no outline, only density changes: the periodontal ligament space a thin soft dark line along the
    // root, the lamina dura a thin soft bright line just outside it
    const rootOnly = pr.outline.filter(([, h]) => h < 0.4);
    lpath(rootOnly, false);
    c.globalCompositeOperation = 'multiply'; c.filter = blurPx(0.13); c.strokeStyle = 'rgb(255,200,255)'; c.lineWidth = 0.32; c.stroke();
    lpath(rootOnly.map(([s, h]): V2 => [s + Math.sign(s) * 0.38, h - 0.25]), false);
    c.globalCompositeOperation = 'lighter'; c.filter = blurPx(0.12); c.strokeStyle = 'rgb(0,30,0)'; c.lineWidth = 0.3; c.stroke();
    // the root displaces the bone it sits in
    lpath(pr.outline); op('multiply', soft, 'rgb(255,196,255)');
    // a root seen through another (the upper molars' palatal root, the first premolar's second root)
    for (const r of pr.extraRoots) { lpath(r); op('lighter', 0.3, 'rgb(28,0,0)'); }
    // dentin with its thickness: a soft base and a centre-weighted body (a rounded solid seen through)
    lpath(pr.outline); op('lighter', soft, 'rgb(22,0,0)');
    c.save(); lpath(pr.outline); c.clip(); lpath(pr.outline); op('lighter', M * 0.5, 'rgb(60,0,0)'); c.restore(); local();
    // the pulp: chamber and canals, a soft hollow
    lpath(pr.pulp); op('multiply', soft * 0.5 + 0.06, 'rgb(118,255,255)');
    // the enamel cap: densest at the cusps and the edge, thinning to nothing at the cervical line
    const gE = c.createLinearGradient(0, H, 0, 0);
    gE.addColorStop(0, 'rgb(92,0,0)'); gE.addColorStop(0.55, 'rgb(64,0,0)'); gE.addColorStop(1, 'rgb(12,0,0)');
    lpath(pr.enamel); op('lighter', soft * 1.6 + 0.08, gE);
    // premolars and molars: the lingual cusps seen through the buccal ones, a second, lower enamel layer in the crown
    if (t.cls === 'premolar' || t.cls === 'molar') {
      const dh = t.cls === 'premolar' ? 1.0 : 0.75, ks = t.cls === 'premolar' ? 0.78 : 0.9;
      const gL = c.createLinearGradient(0, H - dh, 0, 0);
      gL.addColorStop(0, 'rgb(46,0,0)'); gL.addColorStop(0.5, 'rgb(28,0,0)'); gL.addColorStop(1, 'rgb(0,0,0)');
      c.save(); lpath(pr.outline); c.clip();
      lpath(pr.enamel.map(([s, h]): V2 => [s * ks, h - dh])); op('lighter', soft + 0.08, gL);
      c.restore(); local();
    }
    const tip = panoPoint(p, H, 0, H), top = panoPoint(p, H, 0, 0);
    filmTeeth.push({ n: t.n, pano: p, tip, crownTop: top, H });
    // amalgam: a smooth, hard-edged lump under the occlusal surface; a proximal box where it reaches mesial or distal
    const surf = restor.get(t.n);
    if (surf) {
      const m = surf.includes('M'), d = surf.includes('D');
      const s0 = m ? -M * 0.97 : -M * (0.38 + R() * 0.08), s1 = d ? M * 0.97 : M * (0.38 + R() * 0.08);
      const h1 = H - 0.6, h0 = H - 2.9 - R() * 0.5;
      // (a rounded box set into the crown; a proximal box steps down where it reaches M or D)
      const ctl: V2[] = [
        [s0 * 0.9, h1 - 0.35], [0, h1 - 0.5], [s1 * 0.9, h1 - 0.35],
        ...(d ? ([[s1, h0 - 1.0], [s1 * 0.75, h0 - 1.5], [s1 * 0.5, h0 - 0.2]] as V2[]) : ([[s1, h0 + 0.5]] as V2[])),
        [0, h0],
        ...(m ? ([[s0 * 0.5, h0 - 0.2], [s0 * 0.75, h0 - 1.5], [s0, h0 - 1.0]] as V2[]) : ([[s0, h0 + 0.5]] as V2[])),
      ];
      c.save(); lpath(pr.outline); c.clip();
      lpath(smoothClosed(ctl, 5)); op('lighter', 0.07, 'rgb(0,0,255)');
      c.restore(); local();
      fillings.push({ n: t.n, center: panoPoint(p, H, 0, (h0 + h1) / 2) });
    }
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.restore();
  c.globalCompositeOperation = 'source-over';
  c.filter = 'none';
  return { canvas: cv, teeth: filmTeeth, fillings };
}
void panoOcclusal;
