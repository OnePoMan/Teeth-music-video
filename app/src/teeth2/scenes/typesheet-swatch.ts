// `typesheet` page 2, section 08: the palette in context. Six small lit scenes, each colour as it will actually
// appear: on film over the lightbox, on a light plate, under the UV lamp (plate 6), under luminol (plate 11), in the
// stone (plates 9, 10, 13), the match red on the acetate (165.16 on).
import { F, font, measure } from '../../engine/type';
import { strokeText, drawStrokeText } from '../../engine/stroke';
import { T_HEX, T_LIN, trgba, type TKey } from '../palette';
import { MONOGRAM, drawMonogram } from '../monogram';
import { LT } from './typesheet-gl';
import { HIS, tooth, occlusalOutline, incisalEdge, cuspTips, grooves, type V2 as V2T } from '../teeth';
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

  // 3 under the UV lamp (plate 6): the pillowcase on the dark bench, the beam's edge crossing it; the dried trace
  // fluoresces in the cotton's threads inside the beam only, never brighter than white (no halo)
  scene(2, (x, y) => {
    c.fillStyle = T_HEX.film; c.fillRect(x, y, vw, vh);
    // the pillowcase, its open end hemmed (a doubled band, a line of stitches) near the bench's edge
    const ex = x + vw * 0.86;
    c.fillStyle = shade('lightbox', 0.82);
    c.beginPath(); c.moveTo(x, y); c.lineTo(ex + 10, y); c.lineTo(ex - 6, y + vh); c.lineTo(x, y + vh); c.closePath(); c.fill();
    c.fillStyle = shade('lightbox', 0.62);
    c.beginPath(); c.moveTo(ex - 26, y); c.lineTo(ex - 24, y); c.lineTo(ex - 40, y + vh); c.lineTo(ex - 42, y + vh); c.closePath(); c.fill();
    for (let k = 0; k < vh; k += 8) c.fillRect(ex - 14 - (k / vh) * 16, y + k, 1.4, 4.5);
    C.regions.push({ rect: [x, y, vw, vh], type: LT.UV, a: [x + vw * 0.4, y + vh * 0.52, vw * 0.41, vh * 0.66], b: [-0.2, 0.42, 0] });
    const g = C.g;
    g.font = font(F.archivo(112, 500), 62);
    g.fillStyle = T_HEX.fluor;
    g.fillText('never', x + 34, y + 108);
  });
  chips(C, vx(2), vy(2) + vh + 22, vw, ['uv', 'fluor'], 'PLATE 6 ONLY: IN THE THREADS, INSIDE THE BEAM');

  // 4 under luminol (plate 11): his shirt on a hanger in the dark, the evidence bag's clear face in front; the glow
  // only in the shirt's weave, one bloom over the heart (his left), SHIRT printed on the bag, dark against it
  scene(3, (x, y) => {
    c.fillStyle = T_HEX.film; c.fillRect(x, y, vw, vh);
    const cx = x + vw * 0.42;
    const shirt = (k: CanvasRenderingContext2D) => {
      k.beginPath();
      k.moveTo(cx - 18, y + 20); k.quadraticCurveTo(cx, y + 26, cx + 18, y + 20);
      k.lineTo(cx + 104, y + 44); k.quadraticCurveTo(cx + 132, y + 54, cx + 140, y + 80); k.lineTo(cx + 150, y + vh + 2);
      k.lineTo(cx - 150, y + vh + 2); k.lineTo(cx - 140, y + 80); k.quadraticCurveTo(cx - 132, y + 54, cx - 104, y + 44);
      k.closePath();
    };
    // the hanger's hook above the collar
    c.strokeStyle = shade('silver', 0.7); c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx, y + 22); c.lineTo(cx, y + 12); c.arc(cx + 6, y + 10, 6, Math.PI, Math.PI * 1.85); c.stroke();
    shirt(c); c.fillStyle = shade('film2', 2.1); c.fill();
    // the seams: the sleeves, the placket and its buttons, the pocket on his left (the viewer's right), the collar
    c.strokeStyle = shade('film2', 1.2); c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(cx - 104, y + 44); c.quadraticCurveTo(cx - 112, y + 110, cx - 104, y + vh);
    c.moveTo(cx + 104, y + 44); c.quadraticCurveTo(cx + 112, y + 110, cx + 104, y + vh);
    c.moveTo(cx - 6, y + 44); c.lineTo(cx - 6, y + vh); c.moveTo(cx + 8, y + 44); c.lineTo(cx + 8, y + vh);
    c.rect(cx + 38, y + 66, 44, 48);
    c.stroke();
    c.fillStyle = shade('film2', 2.6);
    c.beginPath(); c.moveTo(cx - 18, y + 20); c.lineTo(cx - 2, y + 48); c.lineTo(cx - 34, y + 38); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(cx + 18, y + 20); c.lineTo(cx + 2, y + 48); c.lineTo(cx + 34, y + 38); c.closePath(); c.fill();
    c.fillStyle = shade('silver', 0.5);
    for (const by of [62, 100, 138]) { c.beginPath(); c.arc(cx + 1, y + by, 3, 0, Math.PI * 2); c.fill(); }
    const h = C.h;
    shirt(h); h.fillStyle = 'rgb(0,0,255)'; h.fill();
    C.regions.push({ rect: [x, y, vw, vh], type: LT.LUMINOL, a: [cx + 58, y + 84, 44, 1.0] });
    // the bag's clear face: its heat seal across the top, a sheen, and the print
    c.fillStyle = trgba('halide', 0.2); c.fillRect(x, y + 4, vw, 5);
    const sh = c.createLinearGradient(x, y, x + vw, y + vh);
    sh.addColorStop(0.3, 'rgba(241,243,238,0)'); sh.addColorStop(0.45, trgba('lightbox', 0.1)); sh.addColorStop(0.6, 'rgba(241,243,238,0)');
    c.fillStyle = sh; c.fillRect(x, y, vw, vh);
    const fam = F.archivo(62, 900), sz = 62, tw = measure('SHIRT', fam, sz);
    const tx = cx + 58 - tw / 2, ty = y + 106;
    c.font = font(fam, sz); c.fillStyle = T_HEX.film; c.fillText('SHIRT', tx, ty);
    h.save(); h.globalCompositeOperation = 'destination-out'; h.font = font(fam, sz); h.fillText('SHIRT', tx, ty); h.restore();
  });
  chips(C, vx(3), vy(3) + vh + 22, vw, ['luminol'], 'PLATE 11 ONLY: ONE BLOOM, OVER HIS HEART');

  // 5 the stone (plates 9, 10, 13): matt dental stone under a raking light; TEETH in relief, sweet set in wax
  scene(4, (x, y) => {
    // as plate 9: the words raised out of the stone; TEETH in condensed black Archivo (the hit), sweet in wax Cormorant.
    // Painted as a low relief under a key from the upper left: a soft contact shadow, the far (lower-right) walls in
    // shade, the near edge catching the light, the flat top face
    c.fillStyle = T_HEX.stone; c.fillRect(x, y, vw, vh);
    C.regions.push({ rect: [x, y, vw, vh], type: LT.STONE, a: [-0.8, -0.55, 0, 0], col: [1, 1, 1] });
    const words: [string, string, number, number, number, TKey][] = [
      ['TEETH', F.archivo(62, 900), 78, 24, 90, 'stone'], ['sweet', F.serif(600, true), 74, 176, 146, 'wax'],
    ];
    for (const [s, fam, sz, dx, dy, k] of words) {
      const X = x + dx, Y = y + dy;
      c.font = font(fam, sz);
      c.save(); c.filter = 'blur(4px)'; c.fillStyle = shade('stone', 0.5, 0.5); c.fillText(s, X + 4, Y + 5); c.restore();
      c.fillStyle = shade(k, 0.62);
      for (let d = 3; d >= 1; d -= 0.5) c.fillText(s, X + d * 0.8, Y + d);
      c.fillStyle = shade(k, 1.12); c.fillText(s, X - 0.8, Y - 0.8);
      c.fillStyle = k === 'stone' ? shade('stone', 1.03) : T_HEX.wax; c.fillText(s, X, Y);
    }
  });
  chips(C, vx(4), vy(4) + vh + 22, vw, ['stone', 'wax'], 'THE CASTS: RELIEF IN STONE, TENDER WORDS IN WAX');

  // 6 the match red (165.16 to ~186 s), in the match plate's idiom: the photograph of the matched cast (his upper
  // arch, from the kit's tooth set) on the grey card under the acetate, the bite traced in red over the anterior
  // teeth (canine to canine) with the chip on #8 ringed, TEETH in the pen's hand
  scene(5, (x, y) => {
    c.fillStyle = shade('silver', 0.62); c.fillRect(x, y, vw, vh);
    C.regions.push({ rect: [x, y, vw, vh], type: LT.STONE, a: [-0.5, -0.85, 0, 7], col: [1, 1, 1] });
    const s = 5.6, ox = x + vw * 0.62, oy = y + 46;
    const P = (v: V2T): [number, number] => [ox + v[0] * s, oy + v[1] * s];
    const path = (ctx: CanvasRenderingContext2D, pts: V2T[], close = true) => {
      ctx.beginPath();
      pts.forEach((v, i) => { const [px, py] = P(v); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      if (close) ctx.closePath();
    };
    const up = Array.from({ length: 16 }, (_, i) => tooth(HIS, i + 1));
    // the base and palate (stone), then the crowns; the relief in hgt.r (base low, crowns high, fissures cut in)
    const base = (ctx: CanvasRenderingContext2D, col: string, wmm: number) => {
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.lineWidth = wmm * s;
      path(ctx, up.map((t) => t.center)); ctx.fill(); ctx.stroke();
      for (const t of up) { path(ctx, occlusalOutline(t)); ctx.fill(); ctx.stroke(); }
    };
    base(c, shade('stone', 0.92), 6);
    for (const t of up) { path(c, occlusalOutline(t)); c.fillStyle = T_HEX.stone; c.fill(); }
    const h = C.h;
    h.save(); h.filter = 'blur(4px)'; base(h, 'rgb(120,0,0)', 6); h.restore();
    h.save(); h.filter = 'blur(1.3px)';
    for (const t of up) { path(h, occlusalOutline(t)); h.fillStyle = 'rgb(255,0,0)'; h.fill(); }
    h.restore();
    h.save(); h.strokeStyle = 'rgb(150,0,0)'; h.lineWidth = 1.2; h.filter = 'blur(0.6px)';
    for (const t of up) for (const g of grooves(t)) { path(h, g, false); h.stroke(); }
    h.restore();
    // the tracing on the acetate, as in plate 13: a red bar on each incisor's incisal edge, a red mark on each
    // canine's tip (the bite records only the anteriors), TEETH above; the chip on #8 ringed in film ink
    for (const [ctx, col] of [[c, T_HEX.match], [C.g, trgba('match', 0.45)]] as const) {
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const n of [7, 8, 9, 10]) {
        const e = incisalEdge(tooth(HIS, n));
        if (e) capsule(ctx, trim(e.map(P), n === 8 ? 0 : 0.08, 0.08), 3);
      }
      for (const n of [6, 11]) {
        const tip = cuspTips(tooth(HIS, n))[0];
        if (tip) { const [tx, ty] = P(tip.p); ctx.beginPath(); ctx.ellipse(tx, ty, 4.5, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); }
      }
      const st = strokeText('TEETH', 'sans', 38, 38 * 0.04);
      ctx.translate(x + 16, y + 48);
      ctx.lineWidth = 2.2;
      drawStrokeText(ctx, st, st.total);
      ctx.restore();
    }
    const [cx8, cy8] = P(incisalEdge(tooth(HIS, 8))![0]!);
    c.strokeStyle = T_HEX.film; c.lineWidth = 1.4;
    c.beginPath(); c.arc(cx8, cy8, 11, 0, Math.PI * 2); c.stroke();
  });
  chips(C, vx(5), vy(5) + vh + 22, vw, ['match'], 'FROM 165.16: THE OUTLINE, THE MONOGRAM, THE STAMP');
}

/** The part of an open polyline between fractions a (from its start) and b (from its end) of its length. */
function trim(pts: [number, number][], a: number, b: number): [number, number][] {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const T = L[L.length - 1]!, s0 = a * T, s1 = (1 - b) * T;
  const at = (s: number): [number, number] => {
    let i = 1; while (i < pts.length - 1 && L[i]! < s) i++;
    const u = (s - L[i - 1]!) / Math.max(1e-6, L[i]! - L[i - 1]!), p = pts[i - 1]!, q = pts[i]!;
    return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
  };
  return [at(s0), ...pts.filter((_, i) => L[i]! > s0 && L[i]! < s1), at(s1)];
}

/** Stroke the outline of a round-ended band of half-width r around an open polyline (px). */
function capsule(c: CanvasRenderingContext2D, pts: [number, number][], r: number) {
  const n = pts.length;
  const nrm = (i: number) => {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(n - 1, i + 1)]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    return [-dy / d, dx / d] as const;
  };
  c.beginPath();
  for (let i = 0; i < n; i++) { const [nx, ny] = nrm(i); const p = pts[i]!; if (i) c.lineTo(p[0] + nx * r, p[1] + ny * r); else c.moveTo(p[0] + nx * r, p[1] + ny * r); }
  const [ex, ey] = nrm(n - 1), pe = pts[n - 1]!;
  const ae = Math.atan2(ey, ex);
  c.arc(pe[0], pe[1], r, ae, ae - Math.PI, true);
  for (let i = n - 1; i >= 0; i--) { const [nx, ny] = nrm(i); const p = pts[i]!; c.lineTo(p[0] - nx * r, p[1] - ny * r); }
  const [sx, sy] = nrm(0), ps = pts[0]!;
  const as = Math.atan2(-sy, -sx);
  c.arc(ps[0], ps[1], r, as, as - Math.PI, true);
  c.closePath();
  c.stroke();
}
