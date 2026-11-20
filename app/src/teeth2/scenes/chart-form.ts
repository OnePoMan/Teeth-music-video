// Plate 7 `chart`: the printed form. Her dental chart is an A3 landscape sheet (sheet mm, x right, y DOWN, origin at
// the sheet's centre): a header field (where the lyric's hero is typed and the examiner signs), the odontogram (two
// rows of 16 numbered teeth drawn from the kit's buccal profiles, the upper row roots up, the lower row roots down,
// a five-surface circle under each crown), a midline, a footer of empty fields. His chart is the same form, smaller,
// lying under hers; only a corner shows.
// Print canvases hold coverage in channels (black ground, 'lighter'): R = film ink, B = silver print. The shader
// turns them into paper and ink; nothing here is colour.
import { SCALE } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { HIS, archVariant, tooth, buccalProfile, type Arch, type V2, type Profile } from '../teeth';

export const SHEET = { w: 420, h: 270 };
/** Static print density (px per sheet mm). */
export const PPM = SCALE > 1 ? 11 : 8;
/** Tooth scale on the form (chart mm per real mm), cell width, the rows' cervical lines. */
export const TS = 1.28;
export const CELL = 24;
export const CEJ_Y = 30;
export const NUM_Y = 57;
export const CIR_Y = 8.2;
export const CIR_R = 3.3;
/** The pen's marks canvas covers this region of the sheet (mm); lifted marks drift up into the header. */
export const MK = { x0: -215, x1: 215, y0: -92, y1: 72 };
export const MPPM = SCALE > 1 ? 10 : 8;
/** Where the header's hero and the examiner's signature line sit. */
/** His chart is a scrap (a photocopy of one corner of the odontogram, teeth 6-10): its clip box in his sheet's mm. */
export const SCRAP = { cx: -12, cy: -37, hx: 66, hy: 35 };
export const HEAD = { y0: -128, y1: -64, base: -96, sigY: -72, sigX0: -60, sigX1: 50 };

/** Her teeth: a set that is not his (no chip): the kit's variant 7 (narrow, flared). */
export const HERS: Arch = archVariant(7);

export interface Cell { n: number; i: number; cx: number; upper: boolean; cejY: number; dir: number; circleY: number; numY: number; sx: number }
export function cell(n: number): Cell {
  const upper = n <= 16;
  const i = upper ? n - 1 : 32 - n;
  const cx = (i - 7.5) * CELL;
  const dir = upper ? 1 : -1;
  return { n, i, cx, upper, cejY: upper ? -CEJ_Y : CEJ_Y, dir, circleY: upper ? -CIR_Y : CIR_Y, numY: upper ? -NUM_Y : NUM_Y, sx: 1 };
}
/** Sheet position of a tooth-profile point (s lateral, h along the tooth's axis, crown positive). */
export function tp(c: Cell, s: number, h: number): V2 { return [c.cx + s * TS, c.cejY + c.dir * h * TS]; }
/** The tooth's crown centre, in sheet mm. */
export function crownCentre(c: Cell, H: number): V2 { return tp(c, 0, H * 0.5); }

const profCache = new Map<string, Profile>();
export function profile(arch: Arch, n: number): Profile {
  const k = `${arch === HIS ? 'h' : 'x'}${n}`;
  let p = profCache.get(k);
  if (!p) { p = buccalProfile(tooth(arch, n)); profCache.set(k, p); }
  return p;
}

export const INK = (a = 1) => `rgba(255,0,0,${a})`;
export const SILVER = (a = 1) => `rgba(0,0,255,${a})`;

export function polyPath(c: CanvasRenderingContext2D, pts: V2[], cl: Cell, close = true) {
  pts.forEach((q, i) => { const [x, y] = tp(cl, q[0], q[1]); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
  if (close) c.closePath();
}

/** The five-surface circle under a tooth (centre: M/D/B/L wedges round O). */
export function circle(c: CanvasRenderingContext2D, cl: Cell) {
  const x = cl.cx, y = cl.circleY, r = CIR_R, r0 = 1.3;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.moveTo(x + r0, y); c.arc(x, y, r0, 0, Math.PI * 2);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.stroke();
}

/** Draw the printed form onto a sheet canvas (already scaled: 1 unit = 1 sheet mm, origin centred). */
function drawForm(c: CanvasRenderingContext2D, arch: Arch, label: string, mk: (c: CanvasRenderingContext2D) => void) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.globalCompositeOperation = 'lighter';
  // border and rules (silver)
  c.strokeStyle = SILVER(0.9); c.lineWidth = 0.35;
  c.strokeRect(-205, -130, 410, 260);
  c.lineWidth = 0.22;
  c.strokeRect(-201.5, -126.5, 403, 253);
  c.lineWidth = 0.3;
  c.beginPath(); c.moveTo(-205, HEAD.y1); c.lineTo(205, HEAD.y1); c.moveTo(-205, 70); c.lineTo(205, 70); c.stroke();
  // the examiner's line under the header's hero, with its cross
  c.lineWidth = 0.28;
  c.beginPath(); c.moveTo(HEAD.sigX0, HEAD.sigY); c.lineTo(HEAD.sigX1, HEAD.sigY); c.stroke();
  c.lineWidth = 0.22;
  c.beginPath(); c.moveTo(HEAD.sigX0 + 1.5, HEAD.sigY - 5.2); c.lineTo(HEAD.sigX0 + 4.7, HEAD.sigY - 2); c.moveTo(HEAD.sigX0 + 4.7, HEAD.sigY - 5.2); c.lineTo(HEAD.sigX0 + 1.5, HEAD.sigY - 2); c.stroke();
  // midlines: the quadrants (dashed)
  c.setLineDash([2.2, 2.2]); c.lineWidth = 0.2; c.strokeStyle = SILVER(0.8);
  c.beginPath(); c.moveTo(0, -62); c.lineTo(0, 62); c.moveTo(-197, 0); c.lineTo(104, 0); c.stroke();
  c.setLineDash([]);
  // footer: empty fields (name fields stay blank)
  c.lineWidth = 0.25; c.strokeStyle = SILVER(0.85);
  for (let k = 0; k < 3; k++) {
    const x0 = -197 + k * 134, x1 = x0 + 126;
    c.strokeRect(x0, 78, x1 - x0, 24);
    c.strokeRect(x0, 106, x1 - x0, 14);
  }
  // captions: tiny, silver
  c.fillStyle = SILVER(0.9);
  c.font = font(F.mono(400), 2.3);
  c.textBaseline = 'alphabetic';
  const caps = ['PATIENT', 'DATE', 'EXAMINER'];
  caps.forEach((s, k) => c.fillText(s, -195 + k * 134, 81.4));
  c.font = font(F.mono(400), 2);
    // the exhibit label (the plate's one readable label), film ink
  c.fillStyle = INK(0.92);
  c.font = font(F.mono(600), 4.1);
  c.fillText(label, 114, 2.3);
  // teeth
  for (let n = 1; n <= 32; n++) {
    const cl = cell(n), p = profile(arch, n);
    c.strokeStyle = INK(0.95); c.lineWidth = 0.44;
    c.beginPath(); polyPath(c, p.outline, cl); c.stroke();
    for (const er of p.extraRoots) { c.strokeStyle = INK(0.55); c.lineWidth = 0.26; c.beginPath(); polyPath(c, er, cl); c.stroke(); }
    c.strokeStyle = INK(0.8); c.lineWidth = 0.32;
    c.beginPath(); polyPath(c, p.cej, cl, false); c.stroke();
    c.strokeStyle = INK(0.45); c.lineWidth = 0.2;
    c.beginPath(); polyPath(c, p.pulp, cl); c.stroke();
    // number and circle
    c.fillStyle = INK(0.95); c.font = font(F.mono(700), 3.6); c.textAlign = 'center';
    c.fillText(String(n), cl.cx, cl.numY + 1.2);
    c.textAlign = 'left';
    c.strokeStyle = INK(0.8); c.lineWidth = 0.27;
    circle(c, cl);
  }
  mk(c);
  c.globalCompositeOperation = 'source-over';
}

function sheetCanvas(ppm: number, arch: Arch, label: string, mk: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.round(SHEET.w * ppm); cv.height = Math.round(SHEET.h * ppm);
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(ppm, 0, 0, ppm, cv.width / 2, cv.height / 2);
  drawForm(c, arch, label, mk);
  return cv;
}

/** Her chart's print (the marks are drawn per frame, separately). */
export function buildHers(): HTMLCanvasElement {
  return sheetCanvas(PPM, HERS, '08-32 · EXHIBIT 6', () => {});
}

/** His chart's print: the same form with his marks; #8 ringed and the chip drawn on it. `drawMarks` paints the marks. */
export function buildHis(drawMarks: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  return sheetCanvas(PPM * 0.8, HIS, '', (c) => {
    drawMarks(c);
    // #8 is marked: ringed by hand (two passes, not quite closed) and the chipped corner crossed
    const cl = cell(8), p = profile(HIS, 8);
    const [x, y] = tp(cl, 0, p.H * 0.45);
    c.strokeStyle = INK(1); c.lineWidth = 0.95;
    c.beginPath();
    for (let k = 0; k <= 64; k++) {
      const a = -1.2 + (k / 64) * 7.1, r = 1 + 0.045 * Math.sin(a * 2 + 0.7) + 0.02 * (k / 64);
      const px = x + Math.cos(a) * 9.8 * r, py = y + Math.sin(a) * 15.5 * r;
      if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // the chip: a short pair of strokes at the incisal corner, and an arrow-less tick to the margin
    const [cx2, cy2] = tp(cl, 2.8, p.H);
    c.lineWidth = 0.4;
    c.beginPath(); c.moveTo(cx2 - 1.6, cy2 + 1.2); c.lineTo(cx2 + 1.6, cy2 - 1.2); c.moveTo(cx2 - 1.6, cy2 - 1.2); c.lineTo(cx2 + 1.6, cy2 + 1.2); c.stroke();
  });
}
