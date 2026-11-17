// `typesheet` page 2 (t >= 100): the colour. The lyric colour treatments A / B / C side by side, each on film and on
// lightbox white; the palette in context (on film over the lightbox, on a light plate, under the UV lamp, under
// luminol, the stone, the match red); the warm-lamp variant beside the cold key on the lamp-lit plates (taste call 4).
import type { Lyrics } from '../../engine/lyrics';
import { F, font, fitSize } from '../../engine/type';
import { paletteInContext } from './typesheet-swatch';
import { T_HEX, T_LIN, trgba } from '../palette';
import { LT } from './typesheet-gl';
import { type Ctx2, type LineOpts, type TreatId, cap, drawLine, head, inRect, lineWidth, paper, shade } from './typesheet-kit';
import { X0, X1, frame } from './typesheet-p1';

const TREATS: { id: TreatId; name: string; lines: string[] }[] = [
  { id: 'A', name: 'DEFAULT, AS WRITTEN', lines: ['UNSUNG HALIDE AT 35% · SUNG LIGHTBOX WHITE', 'HERO CONDENSED BLACK, IN ITS PLATE’S IDIOM', 'ON WHITE: UNSUNG FILM AT 30% · SUNG FILM INK'] },
  { id: 'B', name: 'HAIRLINE TO HEAVY', lines: ['UNSUNG A SILVER HAIRLINE (ARCHIVO 300)', 'SUNG TURNS HEAVY AND WHITE: THE WEIGHT IS', 'THE WIPE · ON WHITE: SILVER TO FILM INK'] },
  { id: 'C', name: 'THE HERO IN ITS MATERIAL', lines: ['AS A, BUT THE HERO TAKES ITS PLATE’S MATERIAL:', 'STONE ON THE CAST CHORUSES (9, 10, 13), WAX ON', 'THE TENDER WORDS · ON WHITE, A SHADE OF IT'] },
];


export function page2(C: Ctx2, ly: Lyrics, t: number) {
  const c = C.a;
  frame(C, 2, 'COLOUR');

  // ------------------------------------------------------------------ 07 lyric colour treatments
  head(c, '07', 'LYRIC COLOUR · THREE TREATMENTS, THE SAME LINE, ON FILM AND ON LIGHTBOX WHITE', X0, 156, X1 - X0);
  const line = ly.get('Late night devil');
  const ws = line.words.slice(2, 6); // devil, put your hands
  const your = line.words[4]!;
  const tk = your.start - 0.045 + 0.625 * (your.end - your.start);
  const colW = (X1 - X0 - 48) / 3;
  TREATS.forEach((tr, i) => {
    const x = X0 + i * (colW + 24);
    c.font = font(F.archivo(62, 900), 44);
    c.fillStyle = T_HEX.lightbox;
    c.fillText(tr.id, x, 232);
    cap(c, tr.name, x + 44, 202, { size: 12, track: 2.5, col: trgba('lightbox', 0.9) });
    tr.lines.forEach((s, j) => cap(c, s, x + 44, 221 + j * 14, { size: 10, track: 1.1 }));
    for (const [gi, ground] of (['film', 'white'] as const).entries()) {
      const ty = 262 + gi * 120, th = 110;
      if (ground === 'white') {
        c.fillStyle = T_HEX.lightbox;
        c.fillRect(x, ty, colW, th);
        C.regions.push({ rect: [x, ty, colW, th], type: LT.LIGHTBOX, col: [1, 1, 1] });
      } else {
        c.fillStyle = T_HEX.film;
        c.fillRect(x, ty, colW, th);
        c.strokeStyle = trgba('silver', 0.4); c.lineWidth = 1;
        c.strokeRect(x + 0.5, ty + 0.5, colW - 1, th - 1);
      }
      const o: LineOpts = { treat: tr.id, ground, size: 34, hero: 86, heroIdx: 0, heroMat: 'stone' };
      const w = lineWidth(ws, o);
      const k = Math.min(1, (colW - 56) / w);
      o.size *= k; o.hero *= k;
      drawLine(c, ws, tk, o, x + 28, ty + th / 2 + o.hero * 0.36);
      cap(c, ground === 'film' ? 'ON FILM' : 'ON LIGHTBOX WHITE', x + colW - 14, ty + 20, { size: 9, track: 1.5, align: 'right', col: ground === 'film' ? trgba('silver') : trgba('film', 0.45) });
    }
  });

  // ------------------------------------------------------------------ 08 the palette in context
  const PX1 = 1180;
  head(c, '08', 'THE PALETTE IN CONTEXT', X0, 536, PX1 - X0);
  paletteInContext(C, X0, 562, PX1 - X0);

  // ------------------------------------------------------------------ 09 the warm-lamp variant (taste call 4)
  const WX = 1210, WW = X1 - WX;
  head(c, '09', 'TASTE CALL 4 · THE LAMP KEY', WX, 536, WW);
  const tw2 = (WW - 20) / 2;
  const keys: { name: string; sub: string; col: [number, number, number] }[] = [
    { name: 'COLD KEY · AS WRITTEN', sub: 'LIGHTBOX WHITE · PLATES 3 AND 12', col: T_LIN.lightbox },
    { name: 'TUNGSTEN KEY · VARIANT', sub: `TUNGSTEN ${T_HEX.tungsten.slice(1)} · PLATES 3 AND 12`, col: T_LIN.tungsten.map((v) => v * 0.92) as [number, number, number] },
  ];
  const stranger = ly.get('stranger in my bed').words.find((w) => /stranger/i.test(w.w))!;
  keys.forEach((k, i) => {
    const x = WX + i * (tw2 + 20);
    // plate 3: the sheet under the raking work light, evidence marker 1
    const by = 562, bh = 238;
    c.fillStyle = shade('lightbox', 0.9); c.fillRect(x, by, tw2, bh);
    C.regions.push({ rect: [x, by, tw2, bh], type: LT.BED, a: [-0.85, -0.5, -0.5, 0.05], b: [x + tw2 * 0.3, by + bh * 0.3, tw2 * 1.15], col: k.col });
    const mk = { x: x + 42, y: by + 96, w: 214, h: 92, rot: -0.08 };
    // its shadow on the sheet (the light rakes from the upper left)
    c.save();
    c.translate(mk.x + mk.w / 2 + 16, mk.y + mk.h / 2 + 12); c.rotate(mk.rot);
    c.filter = 'blur(7px)'; c.fillStyle = 'rgba(7,10,16,0.55)';
    c.fillRect(-mk.w / 2, -mk.h / 2, mk.w, mk.h);
    c.restore();
    inRect(c, mk.x, mk.y, mk.w, mk.h, mk.rot, () => {
      // a tent placard seen from above: the near face lit, the far face falling away
      c.fillStyle = T_HEX.lightbox; c.fillRect(0, 0, mk.w, mk.h);
      c.fillStyle = 'rgba(7,10,16,0.16)'; c.fillRect(0, 0, mk.w, 14);
      c.fillStyle = 'rgba(7,10,16,0.35)'; c.fillRect(0, 13, mk.w, 1);
      cap(c, '1', 12, 36, { col: T_HEX.film, size: 16, track: 0, fam: F.mono(600) });
      const fam = F.archivo(62, 900);
      const s = fitSize(stranger.w.toUpperCase(), fam, mk.w - 24, 64);
      c.font = font(fam, s); c.fillStyle = T_HEX.film;
      c.fillText(stranger.w.toUpperCase(), 12, mk.h - 12);
    });
    inRect(C.h, mk.x, mk.y, mk.w, mk.h, mk.rot, () => { C.h.fillStyle = 'rgb(0,255,0)'; C.h.fillRect(0, 0, mk.w, mk.h); });
    // plate 12: the print and its acetate on the dark desk, under the desk lamp
    const dy = by + bh + 12, dh = 152;
    c.fillStyle = shade('film2', 1.5); c.fillRect(x, dy, tw2, dh);
    C.regions.push({ rect: [x, dy, tw2, dh], type: LT.LAMP, a: [x + tw2 * 0.42, dy + dh * 0.3, tw2 * 0.85, dh * 1.0], b: [0.35, 0.05, 1.3], col: k.col });
    const pr = { x: x + 26, y: dy + 22, w: tw2 - 52, h: dh - 40, rot: 0.03 };
    paper(c, pr.x, pr.y, pr.w, pr.h, { rot: pr.rot, col: shade('lightbox', 0.92) });
    inRect(c, pr.x, pr.y, pr.w, pr.h, pr.rot, () => {
      const gr = c.createLinearGradient(0, 0, pr.w, pr.h);
      gr.addColorStop(0, shade('halide', 0.8)); gr.addColorStop(0.6, shade('lightbox', 0.9)); gr.addColorStop(1, shade('halide', 0.75));
      c.fillStyle = gr; c.fillRect(8, 8, pr.w - 16, pr.h - 16);
      const fam = F.archivo(112, 300);
      c.font = font(fam, 22); c.fillStyle = T_HEX.film;
      c.fillText('your heart got', 18, 44);
      c.font = font(F.archivo(62, 900), 50);
      c.fillText('TEETH', 18, 92);
      // the traced line, ink on the acetate
      c.strokeStyle = T_HEX.film; c.lineWidth = 1.5;
      c.beginPath();
      for (let j = 0; j < 5; j++) {
        const x0 = 150 + j * 18;
        c.moveTo(x0, 70 - j * 7); c.quadraticCurveTo(x0 + 9, 60 - j * 7 - 6, x0 + 18, 70 - (j + 1) * 7);
      }
      c.stroke();
      const sh = c.createLinearGradient(0, 0, pr.w * 0.6, pr.h);
      sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, trgba('lightbox', 0.3)); sh.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = sh; c.fillRect(-4, -4, pr.w + 8, pr.h + 8);
    });
    cap(c, k.name, x, dy + dh + 22, { size: 10, track: 1.5, col: trgba('lightbox', 0.9) });
    cap(c, k.sub, x, dy + dh + 40, { size: 9.5, track: 1.2 });
  });
  void t;
}
