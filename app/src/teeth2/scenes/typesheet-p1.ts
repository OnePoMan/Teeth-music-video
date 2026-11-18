// `typesheet` page 1 (t < 100): the type. His voice in Archivo (verses wide and light, hits condensed and black), the
// karaoke states on one line, the lab's Plex Mono inside objects, the tender words in wax Cormorant, the pen's
// single-stroke hand (the polygraph, the acetate), and the T.F. monogram on a tag and, red, in a NAME field.
import type { Lyrics } from '../../engine/lyrics';
import { F, font, fitSize, measure } from '../../engine/type';
import { strokeText, drawStrokeText } from '../../engine/stroke';
import { T_HEX, trgba } from '../palette';
import { MONO_H, MONOGRAM, drawMonogram, monoPen, monoWritten } from '../monogram';
import { LT } from './typesheet-gl';
import { type Ctx2, MONO, bracket, cap, drawLine, head, inRect, paper, shade, ticks } from './typesheet-kit';

export const X0 = 96, X1 = 1824;

/** The sheet's header and its corner ticks (both pages). */
export function frame(C: Ctx2, page: number, title: string) {
  const c = C.a;
  cap(c, '08-32 · BITE MARK', X0, 92, { col: trgba('lightbox', 0.9), size: 14, track: 4 });
  cap(c, 'TEETH · DENTAL RECORDS', X0 + 250, 92, { col: trgba('silver'), size: 14, track: 4 });
  cap(c, `GATE 2 · ${title} · SHEET ${page} / 2`, X1, 92, { col: trgba('halide'), size: 14, track: 4, align: 'right' });
  c.fillStyle = trgba('silver', 0.5);
  c.fillRect(X0, 108, X1 - X0, 1);
  ticks(c, 60, 52, 1800, 976, trgba('silver', 0.6), 14);
}

export function page1(C: Ctx2, ly: Lyrics, t: number) {
  const c = C.a;
  frame(C, 1, 'TYPE');

  // ------------------------------------------------------------------ 01 his voice
  const L1 = 1130;
  head(c, '01', 'HIS VOICE · ARCHIVO', X0, 156, L1 - X0);
  cap(c, 'VERSES — WIDE AND LIGHT · ARCHIVO 125 / 300', X0, 190, { size: 11 });
  const verse = ly.get('Some days you').text;
  const vf = F.archivo(125, 300);
  const vs = Math.min(54, fitSize(verse, vf, L1 - X0));
  c.font = font(vf, vs);
  c.fillStyle = T_HEX.lightbox;
  c.fillText(verse, X0 - 2, 258);
  cap(c, 'THE HITS — CONDENSED AND BLACK · ARCHIVO 62 / 900', X0, 312, { size: 11 });
  const hf = F.archivo(62, 900);
  c.font = font(hf, 318);
  c.fillText('TEETH', X0 - 10, 566);
  const tw = measure('TEETH', hf, 318);
  // the axis between them: the width and weight steps a word can move through
  const lx = X0 + tw + 46;
  const steps: [number, number][] = [[75, 900], [87.5, 700], [100, 500], [112.5, 500], [125, 300]];
  steps.forEach(([wd, wt], i) => {
    const y = 372 + i * 40;
    c.font = font(F.archivo(wd, wt), 34);
    c.fillStyle = trgba('lightbox', 0.92 - i * 0.1);
    c.fillText('teeth', lx, y);
    cap(c, `${wd} / ${wt}`, L1, y, { size: 10, align: 'right', col: trgba('silver', 0.9) });
  });
  c.fillStyle = trgba('silver', 0.5);
  c.fillRect(lx, 550, L1 - lx, 1);
  cap(c, 'WIDTH STEPS 62–125 · WEIGHTS 300–900', lx, 568, { size: 10 });

  // ------------------------------------------------------------------ 02 karaoke states
  head(c, '02', 'KARAOKE STATES · THE PHRASE ON SCREEN', X0, 628, L1 - X0);
  const line = ly.get('Late night devil');
  const your = line.words[4]!;
  const tk = your.start - 0.045 + 0.625 * (your.end - your.start); // "your" mid-word: "yo" lit, "u" springing
  // the phrase on screen at tk: 1-4 words from the hero on, nothing more than 0.4 s ahead of its onset
  const ws = line.words.slice(2, 6).filter((w) => w.start - tk <= 0.4);
  const o = { treat: 'A' as const, ground: 'film' as const, size: 54, hero: 118, heroIdx: 0 };
  const placed = drawLine(c, ws, tk, o, X0, 758);
  const by = 780;
  const names = ['HERO · SUNG', 'SUNG', 'SINGING', 'UNSUNG'];
  placed.forEach((p, i) => bracket(c, p.x, p.x + p.width, by, names[i]!));
  cap(c, `CHORUS 1, “LATE NIGHT DEVIL, PUT YOUR HANDS ON ME”, AT ${tk.toFixed(2)} S: “YOUR” MID-WORD · UNSUNG HALIDE 35% · TREATMENT A`, X0, 656, { size: 10 });

  // ------------------------------------------------------------------ 06 the monogram
  const MX = 1196, MW = X1 - MX;
  head(c, '06', 'THE MONOGRAM · T.F.', MX, 156, MW);
  // the film's tag (plate 2): signed in ink
  const tg = { x: MX + 14, y: 196, w: 600, h: 252, rot: -0.025 };
  paper(c, tg.x, tg.y, tg.w, tg.h, { rot: tg.rot });
  inRect(c, tg.x, tg.y, tg.w, tg.h, tg.rot, () => {
    c.strokeStyle = trgba('film', 0.22);
    c.lineWidth = 1;
    c.strokeRect(12.5, 12.5, tg.w - 25, tg.h - 25);
    // the punched hole and its reinforcement ring, the string through it
    c.fillStyle = shade('lightbox', 0.86);
    c.beginPath(); c.arc(44, tg.h / 2, 17, 0, Math.PI * 2); c.fill();
    c.fillStyle = T_HEX.film;
    c.beginPath(); c.arc(44, tg.h / 2, 8, 0, Math.PI * 2); c.fill();
    c.strokeStyle = trgba('halide', 0.9);
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(44, tg.h / 2); c.bezierCurveTo(30, tg.h / 2 + 60, 10, tg.h - 10, 40, tg.h + 90); c.stroke();
    cap(c, '08-32', 86, 50, { col: T_HEX.film, size: 22, track: 3, fam: F.mono(600) });
    cap(c, 'RADIOGRAPH · PANORAMIC', 86, 72, { col: trgba('film', 0.6), size: 11, track: 2 });
    cap(c, 'EXAMINED BY', 86, tg.h - 30, { col: trgba('film', 0.6), size: 10, track: 2 });
    c.fillStyle = trgba('film', 0.45);
    c.fillRect(190, tg.h - 34, tg.w - 230, 1);
    const sz = 296;
    drawMonogram(c, monoWritten(t, 9.9, 10.45), { x: 288, y: tg.h - 34 - sz * MONO_H * 0.84, size: sz, width: 4.6, pressure: 0.9, color: shade('film', 1.4) });
  });
  // the matched cast's label (plate 13, 165.16): the NAME field, signed in match red
  const cy = 484;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 16; c.shadowOffsetY = 6;
  c.fillStyle = shade('stone', 0.9);
  c.fillRect(MX + 4, cy, MW - 4, 170);
  c.restore();
  // the cast's trimmed base: a band of stone, its ground edge catching the light
  c.fillStyle = T_HEX.stone;
  c.fillRect(MX + 4, cy, MW - 4, 6);
  C.regions.push({ rect: [MX + 4, cy, MW - 4, 170], type: LT.STONE, a: [-0.7, -0.6, 0, 6], col: [1, 1, 1] });
  const lb = { x: MX + 58, y: cy + 22, w: 520, h: 128, rot: 0.012 };
  paper(c, lb.x, lb.y, lb.w, lb.h, { rot: lb.rot });
  // the label is flat (no stone relief under it)
  inRect(C.h, lb.x, lb.y, lb.w, lb.h, lb.rot, () => { C.h.fillStyle = 'rgb(0,255,0)'; C.h.fillRect(0, 0, lb.w, lb.h); });
  inRect(c, lb.x, lb.y, lb.w, lb.h, lb.rot, () => {
    cap(c, '08-32 · CAST', 16, 22, { col: trgba('film', 0.6), size: 10, track: 2 });
    cap(c, 'NAME:', 16, 98, { col: T_HEX.film, size: 20, track: 2, fam: F.mono(600) });
    c.fillStyle = trgba('film', 0.45);
    c.fillRect(100, 101, lb.w - 120, 1);
  });
  const ms = 184;
  const mpl = { x: 0, y: 0, size: ms, width: 3.6 };
  for (const [ctx, col] of [[c, T_HEX.match], [C.g, trgba('match', 0.55)]] as const)
    inRect(ctx, lb.x, lb.y, lb.w, lb.h, lb.rot, () => drawMonogram(ctx, MONOGRAM.length, { ...mpl, x: 136, y: 101 - ms * MONO_H * 0.86, color: col }));
  cap(c, 'IN INK WHERE A SIGNATURE GOES · IN MATCH RED, ONCE, AT 165.16', MX, 678, { size: 10 });
  // the signing, frame by frame (0.55 s from the beat)
  const fr = [0.12, 0.28, 0.44, 0.6, 0.78, 1.0];
  const fw = 92, fh = 60, fg = (MW - fr.length * fw) / (fr.length - 1);
  fr.forEach((u, i) => {
    const x = MX + i * (fw + fg), y = 692;
    c.fillStyle = T_HEX.film2;
    c.fillRect(x, y, fw, fh);
    const len = monoWritten(u, 0, 1);
    const s = 74;
    const pl = { x: x + 9, y: y + 8, size: s, width: 2.2, color: T_HEX.lightbox };
    drawMonogram(c, len, pl);
    if (u < 1) {
      const pen = monoPen(len);
      c.fillStyle = trgba('halide');
      c.beginPath(); c.arc(pl.x + pen.x * s, pl.y + pen.y * s, 2.4, 0, Math.PI * 2); c.fill();
    }
    cap(c, `${(u * 0.55).toFixed(2)} S`, x, y + fh + 16, { size: 9, track: 1.5 });
  });

  // ------------------------------------------------------------------ 03 lab labels
  const R3 = 820;
  const cw = [540, 540, X1 - (X0 + 540 * 2 + 48)];
  const cx = [X0, X0 + 540 + 24, X0 + 2 * (540 + 24)];
  head(c, '03', 'THE LAB · IBM PLEX MONO', cx[0]!, R3, cw[0]!);
  cap(c, 'INSIDE OBJECTS ONLY · ONE READABLE LABEL PER PLATE', cx[0]!, R3 + 26, { size: 10 });
  // a hanging folder's edge and its tab
  const fx = cx[0]!, fy = R3 + 70;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 14; c.shadowOffsetY = 4;
  c.fillStyle = shade('film2', 1.35);
  c.beginPath();
  c.moveTo(fx, fy + 44); c.lineTo(fx + 14, fy + 44); c.lineTo(fx + 24, fy); c.lineTo(fx + 262, fy); c.lineTo(fx + 272, fy + 44); c.lineTo(fx + cw[0]!, fy + 44);
  c.lineTo(fx + cw[0]!, 1008); c.lineTo(fx, 1008); c.closePath(); c.fill();
  c.restore();
  c.fillStyle = trgba('silver', 0.35);
  c.fillRect(fx, fy + 44, 14, 1); c.fillRect(fx + 272, fy + 44, cw[0]! - 272, 1);
  paper(c, fx + 34, fy + 8, 220, 30);
  cap(c, '08-32 · BITE MARK', fx + 44, fy + 29, { col: T_HEX.film, size: 15, track: 1.5, fam: F.mono(600) });
  // an exhibit label and a cast label's blank NAME field, laid on the folder
  const ex = { x: fx + 300, y: fy + 66, w: 226, h: 38, rot: -0.02 };
  paper(c, ex.x, ex.y, ex.w, ex.h, { rot: ex.rot });
  inRect(c, ex.x, ex.y, ex.w, ex.h, ex.rot, () => cap(c, '08-32 · EXHIBIT 4', 12, 25, { col: T_HEX.film, size: 15, track: 1.5, fam: F.mono(600) }));
  const nm = { x: fx + 22, y: fy + 76, w: 250, h: 46, rot: 0.015 };
  paper(c, nm.x, nm.y, nm.w, nm.h, { rot: nm.rot });
  inRect(c, nm.x, nm.y, nm.w, nm.h, nm.rot, () => {
    cap(c, 'NAME:', 12, 30, { col: T_HEX.film, size: 15, track: 1.5, fam: F.mono(600) });
    c.fillStyle = trgba('film', 0.45);
    c.fillRect(74, 32, nm.w - 88, 1);
  });

  // ------------------------------------------------------------------ 04 the tender words
  head(c, '04', 'TENDER · CORMORANT ITALIC, WAX', cx[1]!, R3, cw[1]!);
  cap(c, 'SWEET · PRETTY · ROSE · WIFE — NOTHING ELSE', cx[1]!, R3 + 26, { size: 10 });
  const tl = 'your love’s so';
  const tf = F.archivo(112, 300);
  c.font = font(tf, 34);
  c.fillStyle = T_HEX.lightbox;
  c.fillText(tl, cx[1]!, R3 + 116);
  const sx = cx[1]! + measure(tl, tf, 34) + 14;
  c.font = font(F.serif(600, true), 104);
  c.fillStyle = T_HEX.wax;
  c.fillText('sweet', sx, R3 + 116);
  const tender = ['sweet', 'pretty', 'rose', 'wife'];
  let tx = cx[1]!;
  tender.forEach((w, i) => {
    c.font = font(F.serif(400, true), 44);
    c.fillStyle = T_HEX.wax;
    c.fillText(w, tx, R3 + 176);
    tx += measure(w, F.serif(400, true), 44) + 18;
    if (i < tender.length - 1) { c.fillStyle = trgba('silver'); c.fillRect(tx, R3 + 162, 3, 3); tx += 3 + 16; }
  });

  // ------------------------------------------------------------------ 05 the pen
  const px = cx[2]!, pw = cw[2]!;
  head(c, '05', 'THE PEN · ONE TECHNICAL HAND', px, R3, pw);
  cap(c, 'HERSHEY SANS CAPITALS, UPRIGHT · POLYGRAPH, ACETATE, MATCH', px, R3 + 26, { size: 10 });
  // polygraph chart paper, the cardio pen climbing out of its trace into the line
  const cy0 = R3 + 40, ch = 84;
  paper(c, px, cy0, pw, ch);
  for (let gx = 0; gx <= pw; gx += 10) { c.fillStyle = gx % 50 === 0 ? trgba('silver', 0.32) : trgba('halide', 0.28); c.fillRect(px + gx, cy0, 1, ch); }
  for (let gy = 0; gy <= ch; gy += 10) { c.fillStyle = gy % 50 === 0 ? trgba('silver', 0.32) : trgba('halide', 0.28); c.fillRect(px, cy0 + gy, pw, 1); }
  const pol = ly.get('Every little lie').text;
  const st = strokeText(pol.toUpperCase(), 'sans', 26, 26 * 0.04);
  const scale = Math.min(1, (pw - 86) / st.width);
  const tx0 = px + 72, tb = cy0 + 54;
  c.save();
  c.strokeStyle = T_HEX.film;
  c.lineWidth = 1.7;
  c.lineJoin = 'round'; c.lineCap = 'round';
  // the trace before the words: the heartbeat, then the climb
  c.beginPath();
  const y0 = cy0 + 64;
  c.moveTo(px + 4, y0);
  for (let x = 4; x < 56; x += 1) {
    const ph = (x % 26) / 26;
    const beat = ph > 0.3 && ph < 0.42 ? -Math.sin(((ph - 0.3) / 0.12) * Math.PI) * 14 : ph > 0.42 && ph < 0.5 ? Math.sin(((ph - 0.42) / 0.08) * Math.PI) * 5 : 0;
    c.lineTo(px + x, y0 + beat);
  }
  const s0 = st.strokes[0]![0]!;
  c.bezierCurveTo(px + 64, y0, tx0 + s0.x * scale - 8, tb + s0.y * scale + 4, tx0 + s0.x * scale, tb + s0.y * scale);
  c.stroke();
  c.translate(tx0, tb);
  c.scale(scale, scale);
  c.lineWidth = 1.5 / scale;
  drawStrokeText(c, st, st.total);
  c.restore();
  // the acetate over a print (plate 12): a photographic print, clear acetate taped over it, the tracing pen's hand
  const ay = cy0 + ch + 12, ah = 1008 - ay;
  paper(c, px, ay, pw, ah);
  const ph = c.createLinearGradient(px, ay, px + pw, ay);
  ph.addColorStop(0, shade('halide', 0.92)); ph.addColorStop(0.45, shade('lightbox', 0.93)); ph.addColorStop(1, shade('halide', 0.8));
  c.fillStyle = ph;
  c.fillRect(px + 6, ay + 6, pw - 12, ah - 12);
  const sh = c.createLinearGradient(px, ay, px + 200, ay + 120);
  sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, trgba('lightbox', 0.35)); sh.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sh;
  c.fillRect(px + 2, ay + 2, pw - 4, ah - 4);
  c.fillStyle = trgba('halide', 0.55);
  c.fillRect(px + 14, ay - 5, 40, 12); c.fillRect(px + pw - 54, ay - 5, 40, 12);
  const ac = strokeText(ly.get('heart got teeth', 0).text.replace(/^.*?your/i, 'your').toUpperCase(), 'sans', 30, 30 * 0.04);
  c.save();
  c.strokeStyle = T_HEX.film;
  c.lineWidth = 1.7; c.lineJoin = 'round'; c.lineCap = 'round';
  c.translate(px + 24, ay + ah * 0.66);
  drawStrokeText(c, ac, ac.total);
  c.restore();
}
