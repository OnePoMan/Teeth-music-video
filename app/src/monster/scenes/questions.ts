// `questions` — verse 1a, four questions (the strike's flame at the same spot when it opens).
// The camera starts where `strike` left it, lying on the ground (everything on one line: the horizon is the
// line), and slowly cranes up over the verse, so the ground opens out below the horizon in perspective.
//   Q1 "How has everything been turned against us?" — on "turned" the words already sung turn round, one after
//      another, and show their unlit backs; "against us?" is left facing us alone.
//   Q2 "How did suffering become so endless?" — a meander, the Greek key's one unbroken line, draws itself from
//      the flame's feet to the horizon's vanishing point; on "endless" it starts to run and never stops.
//   Q3 "How am I to reunite with my estranged?" — "reunite" closes up its letter-spacing; "estranged?" drifts
//      apart while the line (the horizon) splits at the vanishing point and its halves pull away.
//   Q4 "Do I need to change?" — "change?" goes through Archivo's widths and weights, from the questions' wide
//      light cut to the decisions' condensed black, while the flame gutters almost to nothing and recovers.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, W, H } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { LIN, rgba } from '../../engine/palette';
import { F, font, layout, measure } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { clamp, ease, keys, lerp, prog, smoothstep } from '../../engine/util';
import { FlameSprite, flameState, GLSL_KEY_DIST } from '../motifs';
import { FLAME_HOME } from './strike';

/** Focal length (px) of the camera that looks along the ground. */
export const FOCAL = 1100;
/** The flame stands this far along the ground (camera-height units at the end of the crane). */
export const Z_FLAME = 7.0;
/** Where the plate leaves the camera, the flame and the split line (`shades` picks them up). */
export const Q_END = { camH: 0.85, yh: H * 0.6, gutter: 0.85, gap: 520 };

interface Row { words: { w: Word; x: number; lay: ReturnType<typeof layout> }[]; y: number }
interface Q { line: Line; rows: Row[]; size: number; fam: string; t0: number; t1: number }

export default class Questions extends Scene {
  private L = new Layer2D();
  private lines = new LineBatch(4000);
  private flame = new FlameSprite();
  private qs: Q[] = [];
  private bg = new FSPass(/* glsl */ `
    uniform float yh, camH, light, meander, scroll, t, split, dimAll;
    uniform vec2 flameScr;
    ${GLSL_KEY_DIST}
    void main() {
      vec2 px = vec2(FRAG_PX.x, ${H.toFixed(1)} - FRAG_PX.y);     // logical px, y DOWN (canvas convention)
      vec3 c = C_INK;
      float d = px.y - yh;                                          // px below the horizon
      // the flame's light: a pool on the ground round its feet, a faint glow in the air
      float fl = light * exp(-length((px - flameScr) * vec2(1.0, 1.5)) / 520.0);
      c += mix(C_BLOOD, C_SIGNAL, 0.5) * 0.035 * fl * (1.0 - dimAll);
      if (d > 0.5 && camH > 0.001) {
        // the ground plane: depth z and lateral position x (camera-height units)
        float z = ${FOCAL.toFixed(1)} * camH / d;
        float xg = (px.x - ${(W / 2).toFixed(1)}) * camH / d;
        float zf = ${Z_FLAME.toFixed(1)};
        float Lg = light * 1.0 / (1.0 + pow(length(vec2(xg, z - zf)) / 3.2, 2.0));
        // receding strata (joints of a stone floor), parallel to the horizon, only where the light reaches
        float strata = hatch(z * 1.1, 0.035) * smoothstep(1.0, 8.0, d) * smoothstep(0.06, 0.3, Lg);
        c += C_BONE * 0.13 * strata * Lg;
        // the meander, laid along the ground from the flame's feet to the vanishing point
        float bw = 0.62;                                             // band half-width
        float b = (xg / (2.0 * bw) + 0.5) * 4.0;                     // across, 0..4 cells
        float cell = 2.0 * bw / 4.0;
        float zn = 1.5;                                              // the path starts at the viewer's feet
        float a = (z - zn) / cell + scroll;                          // along, in cells
        float reach = meander;                                       // drawn so far (cells from the near end)
        if (z > zn && (z - zn) / cell < reach && b > -1.2 && b < 5.2) {
          float u = mod(a, 5.0);
          float dk = min(keyDist(vec2(u, b)), keyDist(vec2(u - 5.0, b)));
          dk = min(dk, min(abs(b + 0.9), abs(b - 4.9)));             // the band's rails
          float fw = fwidth(a) + fwidth(b);
          float hw = 0.075;
          float ink = 1.0 - smoothstep(hw - fw, hw + fw, dk);
          ink *= 1.0 - smoothstep(0.35, 0.9, fw);                     // too fine to draw: let it go
          float fade = smoothstep(reach, reach - 6.0, (z - zn) / cell);
          c += C_BONE * 0.42 * ink * fade * clamp(Lg * 1.5 + 0.13, 0.0, 1.0);
        }
      }
      // the line (the horizon), split at the vanishing point: its halves drift apart
      float gap = split * ${Q_END.gap.toFixed(1)};
      float onLine = 1.0 - smoothstep(0.6, 1.4, abs(px.y - yh) * PX_SCALE);
      float inGap = smoothstep(gap - 2.0, gap, abs(px.x - ${(W / 2).toFixed(1)}) * 2.0);
      c = mix(c, C_BONE * 0.8, onLine * (split > 0.0 ? inGap : 1.0) * 0.8 * (1.0 - 0.6 * dimAll));
      fragColor = vec4(c, 1.0);
    }`, {
    yh: { value: FLAME_HOME.y }, camH: { value: 0 }, light: { value: 1 }, meander: { value: 0 }, scroll: { value: 0 }, t: { value: 0 },
    split: { value: 0 }, dimAll: { value: 0 }, flameScr: { value: new THREE.Vector2(FLAME_HOME.x, FLAME_HOME.y) },
  });

  override init() {
    const ly = this.ctx.lyrics;
    const fam = F.archivo(125, 300);
    const size = 78;
    const maxW = 1240;
    const src = ['How has everything', 'How did suffering', 'How am I to reunite', 'Do I need to change'];
    for (const q of src) {
      const line = ly.get(q);
      // wrap at the widest row that fits, keeping the last word with its neighbour
      const rows: Row[] = [];
      let cur: Row = { words: [], y: 0 };
      let x = 0;
      const space = measure(' ', fam, size);
      for (const w of line.words) {
        const lay = layout(w.w, fam, size);
        if (cur.words.length && x + lay.width > maxW) { rows.push(cur); cur = { words: [], y: 0 }; x = 0; }
        cur.words.push({ w, x, lay });
        x += lay.width + space;
      }
      rows.push(cur);
      rows.forEach((r, i) => (r.y = 250 + i * size * 1.18));
      this.qs.push({ line, rows, size, fam, t0: line.words[0]!.start - 0.4, t1: line.end });
    }
    // each question holds until the next one is anticipated; the last fades in the instrumental
    for (let i = 0; i < this.qs.length; i++) this.qs[i]!.t1 = i + 1 < this.qs.length ? this.qs[i + 1]!.t0 - 0.05 : this.ctx.end - 1.2;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio: au } = this.ctx;
    const t = f.t;
    const [q1, q2, q3, q4] = this.qs as [Q, Q, Q, Q];
    // the crane: from the ground (strike's view) up over the verse; the horizon rises a little as it tilts
    const crane = ease.inOutCubic(prog(t, this.ctx.start + 0.3, q3.line.start));
    const camH = lerp(0.0, Q_END.camH, crane);
    const yh = lerp(FLAME_HOME.y, Q_END.yh, ease.inOutCubic(prog(t, this.ctx.start + 0.3, q2.line.start + 1.5)));
    const flameY = yh + (FOCAL * camH) / Z_FLAME;
    // the flame: it gutters on "change?" and comes back with the strings' figure
    const ch = q4.line.words[q4.line.words.length - 1]!;
    const gutter = keys(t, [[ch.start - 0.05, 1], [ch.start + 0.35, 0.18, ease.outCubic], [ch.end + 0.25, 0.12], [ch.end + 1.6, Q_END.gutter, ease.inOutCubic]]);
    const fl = flameState(au, t, 0);
    const I = fl.I * gutter, hgt = FLAME_HOME.h * fl.h * lerp(0.45, 1, gutter);
    // the meander: drawn from the flame's feet as "suffering… become so endless" is sung, then it runs
    const suf = q2.line.words.find((w) => /suffering/i.test(w.w))!, endl = q2.line.words.find((w) => /endless/i.test(w.w))!;
    const meander = keys(t, [[suf.start, 0], [endl.start, 30, ease.inOutCubic], [endl.end + 0.5, 160, ease.inCubic]]);
    const scroll = Math.max(0, t - endl.start) * 1.6;
    // the line splits on "estranged?"
    const est = q3.line.words[q3.line.words.length - 1]!;
    const split = ease.inOutCubic(prog(t, est.start, est.end + 0.6));
    const u = this.bg.u;
    u.yh!.value = yh; u.camH!.value = camH; u.light!.value = I; u.meander!.value = meander; u.scroll!.value = scroll; u.t!.value = t;
    u.split!.value = split; u.dimAll!.value = 0;
    (u.flameScr!.value as THREE.Vector2).set(FLAME_HOME.x, flameY);
    this.bg.render(renderer, out);
    this.flame.draw(renderer, out, FLAME_HOME.x, flameY, hgt, t, { seed: 1, gust: fl.gust * 0.5, intensity: I });

    // ---- the words
    const L = this.L; L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';
    for (const [qi, q] of this.qs.entries()) {
      if (t < q.t0 || t >= q.t1 + 0.6) continue;
      const out_ = 1 - smoothstep(q.t1, q.t1 + 0.6, t);
      for (const r of q.rows) for (const it of r.words) {
        const w = it.w;
        const sung = prog(t, w.start, w.start + 0.12);
        const a = (0.16 + 0.8 * sung) * out_;
        if (qi === 0) this.drawTurning(c, q, it, r.y, t, a);
        else if (qi === 2) this.drawTracking(c, q, it, r, t, a);
        else if (qi === 3 && w === ch) this.drawChange(c, q, it, r.y, t, a);
        else { c.font = font(q.fam, q.size); c.fillStyle = rgba('bone', a); c.fillText(w.w, 140 + it.x, r.y); }
      }
    }
    // the ledger, small, beside what it measures
    c.font = font(F.mono(400), 12);
    c.letterSpacing = '2px';
    const mA = smoothstep(endl.start, endl.start + 0.4, t) * (1 - smoothstep(q2.t1, q2.t1 + 0.5, t));
    if (mA > 0) { c.fillStyle = rgba('bone', 0.42 * mA); c.fillText('MEANDER · ONE LINE, NO END', W / 2 + 250, flameY + 40); }
    const tA = smoothstep(est.start, est.start + 0.3, t) * (1 - smoothstep(q3.t1, q3.t1 + 0.5, t));
    if (tA > 0) { c.fillStyle = rgba('bone', 0.42 * tA); c.fillText(`TRACKING +${Math.round(this.estTrack(est, t))}`, 140, q3.rows[q3.rows.length - 1]!.y + 38); }
    c.letterSpacing = '0px';
    this.ctx.comp.draw(renderer, L.upload(), out);
    void LIN; void this.lines; void clamp;
    return { bloom: 0.65, bloomThreshold: 0.95, vignette: 0.45, grain: 0.06, ca: 0.6, halation: 0.3 };
  }

  /** Q1: after "turned", the words already sung turn round one after another and show their unlit backs. */
  private drawTurning(c: CanvasRenderingContext2D, q: Q, it: Row['words'][number], y: number, t: number, a: number) {
    const words = q.line.words;
    const turned = words.find((w) => /turned/i.test(w.w))!;
    const k = words.indexOf(it.w), kt = words.indexOf(turned);
    c.font = font(q.fam, q.size);
    if (k > kt) { c.fillStyle = rgba('bone', a); c.fillText(it.w.w, 140 + it.x, y); return; }
    // a wave from the first word to "turned", each glyph a card turning on its vertical axis
    for (const g of it.lay.glyphs) {
      const gi = it.x + g.x;
      const t0 = turned.start + 0.05 + (gi / 1200) * 0.45;
      const th = Math.PI * ease.inOutCubic(prog(t, t0, t0 + 0.32));
      const sx = Math.cos(th);
      const cx = 140 + gi + g.w / 2;
      c.save();
      c.translate(cx, y);
      c.scale(Math.abs(sx) < 0.02 ? 0.02 * Math.sign(sx || 1) : sx, 1);
      // the back is the unlit side: graphite, and seen mirrored
      c.fillStyle = sx >= 0 ? rgba('bone', a) : rgba('graphite', Math.min(1, a * 1.1));
      c.fillText(g.ch, -g.w / 2, 0);
      c.restore();
    }
  }

  private estTrack(est: Word, t: number) { return 46 * ease.inOutCubic(prog(t, est.start, est.end + 0.4)); }

  /** Q3: "reunite" closes its letter-spacing as it is sung; "estranged?" pulls its letters apart. */
  private drawTracking(c: CanvasRenderingContext2D, q: Q, it: Row['words'][number], r: Row, t: number, a: number) {
    const w = it.w;
    c.font = font(q.fam, q.size);
    c.fillStyle = rgba('bone', a);
    let track = 0;
    if (/reunite/i.test(w.w)) track = lerp(14, -4, ease.inOutCubic(prog(t, w.start, w.end)));
    if (/estranged/i.test(w.w)) track = this.estTrack(w, t);
    if (track === 0) { c.fillText(w.w, 140 + it.x, r.y); return; }
    // (letters spread about the word's own start, so the row keeps its place)
    for (const g of it.lay.glyphs) c.fillText(g.ch, 140 + it.x + g.x + g.i * track, r.y);
  }

  /** Q4: "change?" steps through Archivo's widths and weights, wide light to condensed black. */
  private drawChange(c: CanvasRenderingContext2D, q: Q, it: Row['words'][number], y: number, t: number, a: number) {
    const w = it.w;
    const steps: [number, number][] = [[125, 300], [112.5, 500], [100, 500], [87.5, 700], [75, 700], [62, 900]];
    const k = Math.min(steps.length - 1, Math.max(0, Math.floor(prog(t, w.start, w.end + 0.15) * steps.length)));
    const [wd, wt] = steps[k]!;
    const fam = F.archivo(wd, wt);
    c.font = font(fam, q.size);
    c.fillStyle = rgba('bone', a);
    c.fillText(w.w, 140 + it.x, y);
    // the type specimen's ledger: the instance in use
    if (t >= w.start) {
      c.save();
      c.font = font(F.mono(400), 12); c.letterSpacing = '2px';
      c.fillStyle = rgba('bone', 0.42 * a);
      c.fillText(`ARCHIVO · WIDTH ${wd} · WEIGHT ${wt}`, 140 + it.x, y + 38);
      c.restore();
    }
  }
}
