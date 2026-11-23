// Plate 6 `uv`: the lyric as dried traces on the pillowcase. Every word of the window is laid out once on the cloth
// (cloth mm, x right, y away from the camera; the case is 760 x 510 mm) and baked into two textures in cloth space:
//   cov  the trace's coverage, blurred into a soft distance-like ramp (thresholded in the shader: a dried edge that
//        can be eroded, so a hero word appears thin and snaps heavy on its onset with its letters locked in place)
//   id   which word a texel belongs to (dilated round each word; read with texelFetch), so each word is gated by its
//        own sung onset and its line's cut.
// ROUND 1 LYRIC-LED LAYOUT (brief docs/gate3/brief-uv-r1.md; the uv type card in docs/teeth2/PLATES.md): each line is
// a compact block of two rows, one half-line per row, each row ending on its hero, the second row indented to the
// right (so the camera riding the words only ever moves right and down):
//      Fight so DIRTY                       Talk so PRETTY
//         but your love's so sweet             but your heart got          (TEETH slams full-frame)
//      Late night DEVIL,                     And NEVER,
//         put your HANDS                        never, never ever let GO
//                 on me And                  (line 3 carries AND, the pickup, as the head of line 4: R39)
// Each block sits on its own part of the case: line 1 over the open end and its hem (far right), line 2 in the middle,
// line 3 along the side seam by the closed end (near left), line 4 over the hem by the side seam (near right). Supporting
// words are Archivo wide-ish (100/500, mixed case as sung), heroes Archivo condensed black, *sweet* Cormorant italic
// (the tender register, fluor-white under the lamp: R15), the second and third "never" condensed black at a middle size.
import * as THREE from 'three';
import { F, font } from '../../engine/type';
import type { Line } from '../../engine/lyrics';

export const CLOTH = { x0: -380, x1: 380, y0: -255, y1: 255 };
/** Texels per cloth mm. */
export const TPPM = 5;
export const TW = (CLOTH.x1 - CLOTH.x0) * TPPM;
export const TH = (CLOTH.y1 - CLOTH.y0) * TPPM;
/** The evidence tag (EXHIBIT 5, the plate's one label): lying by the closed end, far side (clear of the four blocks);
 *  centre, half size (mm), rotation (rad). */
export const TAG = { x: -262, y: 196, hx: 30, hy: 13, rot: 0.1 };

export type St = 'sup' | 'hero' | 'serif' | 'mid' | 'go';
export interface TWord {
  id: number; text: string; start: number; end: number; hero: boolean; serif?: boolean; st: St;
  /** centre and size on the cloth (mm) */
  x: number; y: number; w: number; h: number;
  /** left edge, baseline, cap height (mm), em size (mm), the family; per glyph centre and advance (cloth x, mm) */
  x0: number; base: number; cap: number; size: number; fam: string; cells: { cx: number; adv: number }[];
  /** the lyric line (0..3 in the window) and word index the trace stands for; the block (line) it is shown in */
  line: number; k: number; disp: number;
  /** its row in the block; which "never" (1..3, else 0) */
  row: number; rep: number;
}
export interface TBlock { disp: number; words: TWord[] }

/** Cap heights (mm): supporting words, heroes, sweet (Cormorant: its cap, the lowercase reads a size down), the second
 *  and third "never", GO (lands biggest). Heroes 3x the supporting words: a whole line fits title-safe at its framing
 *  with every supporting word >= 5% of the frame (R22) and every hero spanning >= 30% of the width or, in its macro,
 *  a cap of >= 20% (R21). */
export const CAP = { sup: 13, hero: 42, serif: 36, mid: 15, go: 52 };
/** Line 3's heroes a little smaller (its tail row makes it the widest block). */
const HERO3 = 40;
const ROW_GAP = 10;
const FAM: Record<St, () => string> = {
  sup: () => F.archivo(100, 500), hero: () => F.archivo(62, 900), serif: () => F.serif(600, true), mid: () => F.archivo(62, 900), go: () => F.archivo(62, 900),
};

interface Item { l: number; k: number; st: St }
interface RowSpec { items: Item[]; dx: number; /** start under this item's centre (by lyric k) in the row above */ under?: number }
interface BlockSpec { disp: number; x0: number; base: number; rows: RowSpec[] }
const I = (l: number, ks: number[], st: St = 'sup'): Item[] => ks.map((k) => ({ l, k, st }));
const BLOCKS: BlockSpec[] = [
  { disp: 0, x0: 36, base: 196, rows: [{ items: [...I(0, [0, 1]), ...I(0, [2], 'hero')], dx: 0 }, { items: [...I(0, [3, 4, 5, 6]), ...I(0, [7], 'serif')], dx: 15 }] },
  { disp: 1, x0: -170, base: 72, rows: [{ items: [...I(1, [0, 1]), ...I(1, [2], 'hero')], dx: 0 }, { items: I(1, [3, 4, 5, 6]), dx: 15 }] },
  { disp: 2, x0: -366, base: -108, rows: [{ items: [...I(2, [0, 1]), ...I(2, [2], 'hero')], dx: 0 }, { items: [...I(2, [3, 4]), ...I(2, [5], 'hero')], dx: 15 }, { items: [...I(2, [6, 7]), ...I(3, [0])], dx: 0, under: 5 }] },
  { disp: 3, x0: 24, base: -78, rows: [{ items: [...I(3, [0]), ...I(3, [1], 'hero')], dx: 0 }, { items: [...I(3, [2, 3], 'mid'), ...I(3, [4, 5]), ...I(3, [6], 'go')], dx: 15 }] },
];

const clean = (s: string) => s.replace(/'/g, '’').replace(/[^A-Za-z’]/g, '');

/** The tag's face: manila card, the label in Plex Mono (lab text lives only inside objects). */
export function bakeTag(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 544; cv.height = 240;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#000'; c.textBaseline = 'middle'; c.textAlign = 'center';
  c.font = font(F.mono(500), 62);
  c.fillText('EXHIBIT 5', cv.width / 2 + 34, cv.height / 2 - 6);
  c.fillRect(150, 162, 300, 4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

export interface Baked { words: TWord[]; blocks: TBlock[]; cov: THREE.CanvasTexture; id: THREE.CanvasTexture }

/** Lays the lyric out on the cloth and bakes the textures. `lines`: the window's four lines in order. */
export function bakeTraces(lines: Line[]): Baked {
  const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, TW, TH);
  const iv = document.createElement('canvas'); iv.width = TW; iv.height = TH;
  const ic = iv.getContext('2d')!;
  ic.fillStyle = '#000'; ic.fillRect(0, 0, TW, TH);
  const X = (x: number) => (x - CLOTH.x0) * TPPM, Y = (y: number) => (CLOTH.y1 - y) * TPPM;
  const capRatio = (fam: string) => { c.font = font(fam, 1000); return c.measureText('H').actualBoundingBoxAscent / 1000; };
  const meas = (fam: string, sizeMM: number, s: string) => { c.font = font(fam, sizeMM * TPPM); return c.measureText(s).width / TPPM; };

  const words: TWord[] = [];
  const blocks: TBlock[] = [];
  for (const b of BLOCKS) {
    const bw: TWord[] = [];
    let base = b.base;
    b.rows.forEach((r, ri) => {
      const capOf = (st: St) => (st === 'serif' ? CAP.serif : st === 'hero' ? (b.disp === 2 ? HERO3 : CAP.hero) : st === 'mid' ? CAP.mid : st === 'go' ? CAP.go : CAP.sup);
      // (a row of supporting words alone sits a little further down: clear of the descenders above)
      if (ri > 0) { const m = Math.max(...r.items.map((it) => capOf(it.st))); base -= (m <= CAP.sup ? ROW_GAP + 5 : ROW_GAP) + m; }
      let x = b.x0 + r.dx;
      if (r.under !== undefined) { const u = bw.find((w) => w.k === r.under && w.line === b.disp); if (u) x = u.x; }
      for (const it of r.items) {
        const wd = lines[it.l]!.words[it.k]!;
        const fam = FAM[it.st]();
        const cap = capOf(it.st);
        const size = cap / capRatio(fam);
        const raw = clean(wd.w);
        const text = it.st === 'sup' ? raw : it.st === 'serif' ? raw.toLowerCase() : raw.toUpperCase();
        const w = meas(fam, size, text);
        c.font = font(fam, size * TPPM);
        const m = c.measureText(text);
        const asc = m.actualBoundingBoxAscent / TPPM, desc = m.actualBoundingBoxDescent / TPPM;
        const cells = Array.from(text).map((_, i) => {
          const a = meas(fam, size, text.slice(0, i)), z = meas(fam, size, text.slice(0, i + 1));
          return { cx: x + (a + z) / 2, adv: z - a };
        });
        const rep = 0;
        const tw: TWord = {
          id: words.length + 1, text, start: wd.start, end: wd.end, hero: it.st === 'hero' || it.st === 'serif' || it.st === 'go', serif: it.st === 'serif', st: it.st,
          x: x + w / 2, y: base + (asc - desc) / 2, w, h: asc + desc, x0: x, base, cap, size, fam, cells,
          line: it.l, k: it.k, disp: b.disp, row: ri, rep,
        };
        words.push(tw); bw.push(tw);
        // the gap to the next word: the supporting face's space, at least a fifth of this word's cap
        x += w + Math.max(meas(FAM.sup(), CAP.sup / capRatio(FAM.sup()), ' ') * 1.1, 0.2 * cap);
      }
    });
    blocks.push({ disp: b.disp, words: bw });
  }
  // the NEVERs in order (1: the hero; 2, 3 the middle copies)
  let n = 0;
  for (const w of words) if (w.text.toLowerCase() === 'never' && w.disp === 3) w.rep = ++n;

  // coverage: white on black, blurred (heroes wider: their threshold erodes them to a light weight)
  for (const w of words) {
    c.save();
    c.filter = `blur(${w.hero && !w.serif ? 9 : 4}px)`;
    c.fillStyle = '#fff'; c.textBaseline = 'alphabetic';
    c.font = font(w.fam, w.size * TPPM);
    c.fillText(w.text, X(w.x0), Y(w.base));
    c.restore();
  }
  // ids: dilated round each word (heroes widest: their stamp and stretch reach past the rest shape), heroes first;
  // then every word's own letters (and a thin margin) on top, so no neighbour's dilation ever takes a word's letters
  const order = [...words].sort((a, b) => Number(b.hero) - Number(a.hero));
  // (a hero's dilation is wide across, for its stamp, stretch and lean, and shallow up and down, clear of the next row)
  for (const pass of [0, 1]) for (const w of order) {
    ic.font = font(w.fam, w.size * TPPM);
    const col = `rgb(${w.id},0,0)`;
    ic.fillStyle = col; ic.strokeStyle = col;
    ic.lineJoin = 'round';
    const wide = !pass && (w.hero || w.st === 'mid');
    ic.lineWidth = (pass ? 1.5 : wide ? 5 : 4) * 2 * TPPM;
    for (const dx of wide ? [-16, -12, -8, -4, 0, 4, 8, 12, 16] : [0]) {
      ic.strokeText(w.text, X(w.x0 + dx), Y(w.base));
      ic.fillText(w.text, X(w.x0 + dx), Y(w.base));
    }
  }

  const tex = (cvs: HTMLCanvasElement, mips: boolean) => {
    const t = new THREE.CanvasTexture(cvs);
    t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = mips;
    t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
    t.magFilter = mips ? THREE.LinearFilter : THREE.NearestFilter;
    t.anisotropy = mips ? 8 : 1;
    t.needsUpdate = true;
    return t;
  };
  return { words, blocks, cov: tex(cv, true), id: tex(iv, false) };
}
