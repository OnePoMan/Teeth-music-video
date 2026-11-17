// `typesheet` page 2, section 08: the palette in context. Six small lit scenes, each colour as it will actually
// appear: on film over the lightbox, on a light plate, under the UV lamp (plate 6), under luminol (plate 11), in the
// stone (plates 9, 10, 13), the match red on the acetate (165.16 on).
import { F, font, measure } from '../../engine/type';
import { strokeText, drawStrokeText } from '../../engine/stroke';
import { T_HEX, T_LIN, trgba, type TKey } from '../palette';
import { MONOGRAM, drawMonogram } from '../monogram';
import { LT } from './typesheet-gl';
import { type Ctx2, cap, shade } from './typesheet-kit';

/** A colour chip + token + hex (three to a row), then a line saying where it lives. */
function chips(C: Ctx2, x: number, y: number, w: number, keys: TKey[], where: string) {
  const c = C.a;
  const per = 2, cw = w / per;
  keys.forEach((k, i) => {
    const cx = x + (i % per) * cw, cy = y + Math.floor(i / per) * 15;
    c.fillStyle = T_HEX[k];
    c.fillRect(cx, cy - 9, 9, 9);
    if (k === 'film' || k === 'film2') { c.strokeStyle = trgba('silver', 0.6); c.lineWidth = 1; c.strokeRect(cx + 0.5, cy - 8.5, 8, 8); }
    cap(c, `${k.toUpperCase()} ${T_HEX[k].slice(1)}`, cx + 15, cy, { size: 10, track: 1, col: trgba('halide') });
  });
  cap(c, where, x, y + Math.ceil(keys.length / per) * 15 + 3, { size: 9.5, track: 1 });
}

/** Clip the three canvases to a rect while `fn` draws. */
function clipped(C: Ctx2, x: number, y: number, w: number, h: number, fn: () => void) {
  for (const k of [C.a, C.g, C.h]) { k.save(); k.beginPath(); k.rect(x, y, w, h); k.clip(); }
  fn();
  for (const k of [C.a, C.g, C.h]) k.restore();
}

export function paletteInContext(C: Ctx2, x0: number, y0: number, w: number) {
  const c = C.a;
  const vw = (w - 40) / 3, vh = 168;
  const vx = (i: number) => x0 + (i % 3) * (vw + 20);
  const vy = (i: number) => y0 + Math.floor(i / 3) * 228;
  const scene = (i: number, fn: (x: number, y: number) => void) => clipped(C, vx(i), vy(i), vw, vh, () => fn(vx(i), vy(i)));

  // 1 on film, over the lightbox: the sung word comes through as a filling does; the film's densities as a wedge
  scene(0, (x, y) => {
    c.fillStyle = T_HEX.lightbox; c.fillRect(x, y, vw, vh);
    C.regions.push({ rect: [x, y, vw, vh], type: LT.FILM, col: [1, 1, 1] });
    c.fillStyle = T_HEX.film; c.fillRect(x + 12, y + 12, vw - 24, vh - 24);
    c.save();
    c.filter = 'blur(0.7px)';
    const gr = c.createLinearGradient(0, y + 40, 0, y + 98);
    gr.addColorStop(0, T_HEX.lightbox); gr.addColorStop(1, T_HEX.halide);
    c.fillStyle = gr;
    c.font = font(F.archivo(125, 300), 70);
    c.fillText('know', x + 32, y + 98);
    c.restore();
    const ks: TKey[] = ['film', 'film2', 'silver', 'halide', 'lightbox'];
    const sw = (vw - 64) / ks.length;
    ks.forEach((k, j) => { c.fillStyle = T_HEX[k]; c.fillRect(x + 32 + j * sw, y + 120, sw, 22); });
    c.strokeStyle = trgba('silver', 0.5); c.lineWidth = 1; c.strokeRect(x + 32.5, y + 120.5, sw * ks.length - 1, 21);
  });
  chips(C, vx(0), vy(0) + vh + 22, vw, ['film', 'film2', 'silver', 'halide'], 'THE GROUND, PANELS, HAIRLINES, UNSUNG TYPE');

  // 2 on lightbox white: a light plate (her chart, plate 7): film ink, silver hairlines, the wax header, his mark
  scene(1, (x, y) => {
    c.fillStyle = T_HEX.lightbox; c.fillRect(x, y, vw, vh);
    C.regions.push({ rect: [x, y, vw, vh], type: LT.LIGHTBOX, col: [1, 1, 1] });
    c.font = font(F.serif(600, true), 60);
    c.fillStyle = T_HEX.wax;
    c.fillText('wife', x + 24, y + 64);
    drawMonogram(c, MONOGRAM.length, { x: x + 160, y: y + 16, size: 128, width: 2.4, color: T_HEX.film });
    const cw = (vw - 48) / 8;
    for (let j = 0; j < 8; j++) {
      const cx = x + 24 + j * cw, cy = y + 100;
      c.strokeStyle = trgba('silver', 0.9); c.lineWidth = 1;
      c.strokeRect(cx + 0.5, cy + 0.5, cw - 5, 34);
      cap(c, String(j + 1), cx + 2, cy + 50, { size: 9, track: 0, col: trgba('film', 0.7) });
      c.fillStyle = T_HEX.film;
      if (j === 3 || j === 5) c.fillRect(cx + (cw - 5) / 2 - 5, cy + 12, 10, 10); // fillings
      if (j === 7) {
        // #8: the chip, hatched across the cell's inner corner
        c.save(); c.beginPath(); c.moveTo(cx + cw - 5, cy + 14); c.lineTo(cx + cw - 5, cy); c.lineTo(cx + cw - 19, cy); c.closePath(); c.clip();
        c.strokeStyle = T_HEX.film; c.lineWidth = 1;
        for (let k = -20; k < 20; k += 3) { c.beginPath(); c.moveTo(cx + cw - 20 + k, cy); c.lineTo(cx + cw + k, cy + 20); c.stroke(); }
        c.restore();
        c.beginPath(); c.moveTo(cx + cw - 19, cy + 0.5); c.lineTo(cx + cw - 5, cy + 14); c.stroke();
      }
    }
  });
  chips(C, vx(1), vy(1) + vh + 22, vw, ['lightbox', 'wax'], 'LIGHT PLATES: PAPER, FILM INK, THE WAX HEADER');

  // 3 under the UV lamp (plate 6): the pillowcase on the dark bench, the beam, the dried trace fluorescing in it
  scene(2, (x, y) => {
    c.fillStyle = shade('lightbox', 0.8); c.fillRect(x, y, vw, vh);
    // the hem: a fold and its stitching
    c.fillStyle = shade('lightbox', 0.55); c.fillRect(x, y + 30, vw, 2);
    for (let k = 0; k < vw; k += 9) c.fillRect(x + k, y + 40, 5, 1.4);
    C.regions.push({ rect: [x, y, vw, vh], type: LT.UV, a: [x + vw * 0.5, y + vh * 0.52, vw * 0.5, vh * 0.66], b: [-0.25, 1.0, 0] });
    const g = C.g;
    g.save();
    g.font = font(F.archivo(112, 500), 64);
    g.fillStyle = T_HEX.fluor;
    g.filter = 'blur(0.8px)';
    g.fillText('never', x + 44, y + 112);
    g.restore();
  });
  chips(C, vx(2), vy(2) + vh + 22, vw, ['uv', 'fluor'], 'PLATE 6 ONLY, IN THE BEAM: THE WORD GLOWS');

  // 4 under luminol (plate 11): his shirt behind the evidence bag; one bloom over the heart, the print against it
  scene(3, (x, y) => {
    c.fillStyle = shade('film2', 1.7); c.fillRect(x, y, vw, vh);
    c.fillStyle = shade('silver', 0.45);
    const pk = x + vw * 0.34;
    c.fillRect(pk, y, 2, vh); c.fillRect(pk + 20, y, 1, vh);
    for (const by of [30, 98, 166]) { c.beginPath(); c.arc(pk + 10, y + by, 5, 0, Math.PI * 2); c.fill(); }
    C.regions.push({ rect: [x, y, vw, vh], type: LT.LUMINOL, a: [x + vw * 0.68, y + vh * 0.42, 62, 1.0] });
    C.h.fillStyle = 'rgb(0,0,255)'; C.h.fillRect(x, y, vw, vh);
    c.fillStyle = trgba('halide', 0.16); c.fillRect(x, y + 8, vw, 6); // the bag's heat seal
    const fam = F.archivo(62, 900), sz = 84, tw = measure('SHIRT', fam, sz);
    c.font = font(fam, sz); c.fillStyle = T_HEX.film;
    c.fillText('SHIRT', x + vw - tw - 22, y + vh - 26);
    C.h.save();
    C.h.globalCompositeOperation = 'destination-out';
    C.h.font = font(fam, sz);
    C.h.fillText('SHIRT', x + vw - tw - 22, y + vh - 26);
    C.h.restore();
  });
  chips(C, vx(3), vy(3) + vh + 22, vw, ['luminol'], 'PLATE 11 ONLY: ONE BLOOM, THE PRINT AGAINST IT');

  // 5 the stone (plates 9, 10, 13): matt dental stone under a raking light; TEETH in relief, sweet set in wax
  scene(4, (x, y) => {
    c.fillStyle = T_HEX.stone; c.fillRect(x, y, vw, vh);
    C.regions.push({ rect: [x, y, vw, vh], type: LT.STONE, a: [-0.8, -0.55, 0, 2.6], col: [1, 1, 1] });
    const tf = F.archivo(62, 900), sf = F.serif(600, true);
    const words: [string, string, number, number, number][] = [['TEETH', tf, 70, 26, 84], ['sweet', sf, 72, 168, 142]];
    // the letters stand proud of the stone: a little occlusion at their feet, their faces a touch smoother and paler
    c.save();
    c.filter = 'blur(5px)';
    c.fillStyle = shade('stone', 0.55, 0.55);
    for (const [s, fam, sz, dx, dy] of words) { c.font = font(fam, sz); c.fillText(s, x + dx + 2, y + dy + 3); }
    c.restore();
    c.font = font(tf, 70); c.fillStyle = shade('stone', 1.07); c.fillText('TEETH', x + 26, y + 84);
    c.font = font(sf, 72); c.fillStyle = T_HEX.wax; c.fillText('sweet', x + 168, y + 142);
    const h = C.h;
    h.save();
    h.filter = 'blur(1.1px)';
    h.fillStyle = 'rgb(255,0,0)';
    for (const [s, fam, sz, dx, dy] of words) { h.font = font(fam, sz); h.fillText(s, x + dx, y + dy); }
    h.restore();
  });
  chips(C, vx(4), vy(4) + vh + 22, vw, ['stone', 'wax'], 'THE CASTS: RELIEF IN STONE, TENDER WORDS IN WAX');

  // 6 the match red (165.16 to ~186 s): the tracing on the acetate over the matched cast's photograph
  scene(5, (x, y) => {
    c.fillStyle = shade('film2', 1.2); c.fillRect(x, y, vw, vh);
    C.regions.push({ rect: [x, y, vw, vh], type: LT.LAMP, a: [x + vw * 0.55, y + vh * 0.4, vw * 0.9, vh * 1.1], b: [0.3, 0.14, 1.2], col: T_LIN.lightbox });
    const ax = x + vw * 0.64, by = y + vh + 4, R = 96, Rv = vh - 34;
    const arch = (u: number, r: number) => {
      const a = Math.PI * (0.02 + 0.96 * u);
      return { x: ax - Math.cos(a) * r, y: by - Math.sin(a) * Rv * (r / R) };
    };
    // the teeth along the arch, back molar to back molar: relative widths and depths (molars wide, incisors slim)
    const TW = [1.45, 1.55, 1.0, 1.0, 1.0, 0.8, 1.05, 1.05, 0.8, 1.0, 1.0, 1.0, 1.55, 1.45];
    const TD = [1.4, 1.45, 1.15, 1.1, 1.0, 0.72, 0.7, 0.7, 0.72, 1.0, 1.1, 1.15, 1.45, 1.4];
    const tot = TW.reduce((s, v) => s + v, 0);
    const u0: number[] = [];
    TW.reduce((s, v) => (u0.push(s / tot), s + v), 0);
    // the cast's base under the crowns: a horseshoe of stone, the palate falling away inside it
    c.save();
    c.filter = 'blur(3px)';
    c.strokeStyle = shade('stone', 0.42); c.lineWidth = 40; c.lineCap = 'butt';
    c.beginPath();
    for (let k = 0; k <= 40; k++) { const p = arch(k / 40, R - 14); if (k) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
    c.stroke();
    c.restore();
    // the photograph: the stone cast seen from above, one crown per tooth, a little soft
    c.save();
    c.filter = 'blur(0.9px)';
    TW.forEach((tw, j) => {
      const um = u0[j]! + tw / tot / 2;
      const d = 15 * TD[j]!;
      const m = arch(um, R - d / 2 - 2), m2 = arch(um + 0.002, R - d / 2 - 2);
      const ang = Math.atan2(m2.y - m.y, m2.x - m.x);
      const len = ((Math.PI * 0.96 * (R + Rv) / 2) * tw) / tot * 0.47;
      const g = c.createRadialGradient(m.x - 3, m.y - 3, 1, m.x, m.y, Math.max(len, d / 2) * 1.2);
      g.addColorStop(0, shade('stone', 1.0)); g.addColorStop(1, shade('stone', 0.5));
      c.fillStyle = g;
      c.beginPath(); c.ellipse(m.x, m.y, len, d / 2, ang, 0, Math.PI * 2); c.fill();
    });
    c.restore();
    // the traced outline: one arc per tooth along the arch's outer edge
    for (const [ctx, col] of [[c, T_HEX.match], [C.g, trgba('match', 0.6)]] as const) {
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      TW.forEach((tw, j) => {
        const ua = u0[j]!, ub = ua + tw / tot, um = (ua + ub) / 2;
        const p0 = arch(ua, R), p1 = arch(ub, R), pm = arch(um, R);
        const nx = pm.x - ax, ny = pm.y - by, d = Math.hypot(nx, ny);
        if (j === 0) ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(pm.x + (nx / d) * 6 * tw, pm.y + (ny / d) * 6 * tw, p1.x, p1.y);
      });
      ctx.stroke();
      const st = strokeText('TEETH', 'tech', 40);
      ctx.translate(x + 22, y + 58);
      ctx.lineWidth = 2.4;
      drawStrokeText(ctx, st, st.total);
      ctx.restore();
    }
  });
  chips(C, vx(5), vy(5) + vh + 22, vw, ['match'], 'FROM 165.16: THE OUTLINE, THE MONOGRAM, THE STAMP');
}
