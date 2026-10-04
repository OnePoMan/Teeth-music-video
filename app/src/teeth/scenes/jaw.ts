// JAW ×3 — the chorus (docs/TEETH.md). The frame is a mouth: every word is set full-frame and bitten
// into place on its beat. The jaws part over the end of the previous word (the throat glows between
// them) and snap shut as the new word is sung. Each chorus line has its own idiom:
//   Fight so dirty …        grimed type, red splatter on each bite; "love's so sweet" in rose serif, dripping
//   Talk so pretty …        glossy serif "pretty"; a heart whose cleft opens into a bite on "got teeth"
//   Late night devil …      the field turns red; handprints slap onto the frame, one per word
//   And never, never …      NEVER stacks row on row; on "go" the jaw clamps and will not let go
// n=1 ink, n=2 paper (the second half answers on ink), n=3 strobes between all of them.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D, W, H } from '../../engine/gl';
import { F, font, fitSize, measure } from '../../engine/type';
import type { Word, Line } from '../../engine/lyrics';
import { clamp, ease, hash, lerp, mulberry32, noise1, prog, pulse, TAU, frameIdx } from '../../engine/util';
import { T, TL, tc, type TKey } from '../palette';
import { TeethComp, makeJaw, drawBitten, jawGapPath, drawTeeth, heartPath, handPath, handCreases, inkSpeckle, type Jaw } from '../motifs';

const CY = H / 2;
const CAP = 0.69; // Archivo cap height (em)

type Kind = 'fight' | 'talk' | 'late' | 'never';
interface LineInfo { line: Line; kind: Kind; half: number; idx: number }
interface Pal { bg: TKey; ink: TKey; throat: TKey; accent: TKey }

const PALS: Record<string, Pal> = {
  dark: { bg: 'ink', ink: 'enamel', throat: 'red', accent: 'red' },
  paper: { bg: 'enamel', ink: 'ink', throat: 'red', accent: 'red' },
  red: { bg: 'red', ink: 'ink', throat: 'ink', accent: 'enamel' },
  redE: { bg: 'red', ink: 'enamel', throat: 'ink', accent: 'ink' },
};

export default class JawScene extends Scene {
  n = 1;
  back = new Layer2D();
  front = new Layer2D();
  comp = new TeethComp();
  lines: LineInfo[] = [];
  words: { w: Word; li: LineInfo; k: number }[] = [];
  jaw!: Jaw;
  jawB!: Jaw;
  grime!: HTMLCanvasElement;
  f = {
    black: F.archivo(100, 900), blackW: F.archivo(125, 900), blackC: F.archivo(75, 900), blackXC: F.archivo(62, 900),
    mid: F.archivo(100, 500), serif: F.serif(600, true), serifR: F.serif(400, true), mono: F.mono(500),
  };

  override init() {
    const { lyrics, params, start, end } = this.ctx;
    this.n = Number(params.n ?? 1);
    const ls = lyrics.lines.filter((l) => l.words[0]!.start >= start - 0.05 && l.words[0]!.start < end);
    ls.forEach((line, i) => {
      const k = /^fight/i.test(line.text) ? 'fight' : /^talk/i.test(line.text) ? 'talk' : /^late/i.test(line.text) ? 'late' : 'never';
      const li: LineInfo = { line, kind: k, half: Math.floor(i / 4), idx: i };
      this.lines.push(li);
      line.words.forEach((w, wk) => this.words.push({ w, li, k: wk }));
    });
    this.jaw = makeJaw(-200, W + 200, 66, 30, 11 + this.n, 0.6);
    this.jawB = makeJaw(-200, W + 200, 58, 18, 31 + this.n, 0.7);
    this.grime = makeGrime(7 + this.n);
  }

  // ------------------------------------------------------------------ timing helpers
  /** Index of the current word (last started), -1 before the first. */
  private cur(t: number) {
    let i = -1;
    for (let k = 0; k < this.words.length; k++) if (t >= this.words[k]!.w.start - 1e-4) i = k;
    return i;
  }
  /** Jaw opening 0..1 at t: opens over the tail of word i toward word i+1, snaps shut on it. */
  private opening(t: number, i: number) {
    const nx = this.words[i + 1];
    const cw = this.words[i];
    let g = 0;
    if (nx) {
      const s = nx.w.start, prev = cw ? cw.w.start : s - 0.4;
      const d = Math.min(0.62 * (s - prev), 0.26);
      g = ease.outCubic(prog(t, s - d, s - 0.012));
      if (!this.biteFor(nx)) g *= 0.15;
      if (this.inHeart(nx)) g = 0;
    }
    // the snap: the new word arrives still a little open and shuts in ~50 ms
    if (cw && !this.inHeart(cw)) g = Math.max(g, 0.42 * (1 - ease.outExpo(prog(t, cw.w.start, cw.w.start + 0.07))) * (this.biteFor(cw) ? 1 : 0.2));
    return g;
  }
  /** heart / got / teeth: the heart plate bites these itself */
  private inHeart(x: { w: Word; li: LineInfo }) { return x.li.kind === 'talk' && /^(heart|got|teeth)/i.test(x.w.w); }
  /** Is this word a full bite (vs. a quick passing word)? */
  private biteFor(x: { w: Word; li: LineInfo; k: number }) {
    const s = x.w.w.toLowerCase().replace(/[^a-z']/g, '');
    return !['your', 'but', 'and', 'ever'].includes(s);
  }
  private pal(li: LineInfo, wIdx: number): Pal {
    const n = this.n;
    if (n === 3) {
      // strobe: the palette steps on every word, red on the devil line
      if (li.kind === 'late') return wIdx % 2 ? PALS.redE! : PALS.red!;
      return [PALS.dark!, PALS.paper!, PALS.dark!, PALS.redE!][(wIdx + li.idx) % 4]!;
    }
    if (li.kind === 'late') return n === 2 && li.half === 0 ? PALS.redE! : PALS.red!;
    const paper = n === 2 ? li.half === 0 : false;
    return paper ? PALS.paper! : PALS.dark!;
  }

  // ------------------------------------------------------------------ render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const i = Math.max(0, this.cur(t));
    const cw = this.words[i]!;
    const li = cw.li;
    const pal = this.pal(li, cw.k);
    const gap01 = this.opening(t, i);
    const B = this.back, Fr = this.front;
    B.clear(); Fr.clear();
    const cb = B.ctx, cf = Fr.ctx;
    cb.textBaseline = cf.textBaseline = 'alphabetic';

    // camera: the seam tilts on the second half; n=3 swings with the bar
    const tilt = this.n === 3 ? 0.07 * Math.sin(f.bar * Math.PI) : li.half === 1 ? -0.055 : 0;
    for (const c of [cb, cf]) { c.translate(W / 2, CY); c.rotate(tilt); c.translate(-W / 2, -CY); }

    const gapPx = gap01 * 230;
    // ---- throat (behind everything): the open mouth glowing between the jaws
    if (gapPx > 0.5) {
      const g = cb.createLinearGradient(0, CY - gapPx / 2 - 30, 0, CY + gapPx / 2 + 30);
      const th = pal.throat;
      g.addColorStop(0, tc(th === 'red' ? 'wine' : th, 1));
      g.addColorStop(0.5, tc(th, 1));
      g.addColorStop(1, tc(th === 'red' ? 'wine' : th, 1));
      cb.fillStyle = g;
      cb.fill(jawGapPath(this.jaw, CY, gapPx));
    }

    // ---- per-kind background furniture
    if (li.kind === 'late') this.drawHands(cb, t, li, pal);
    if (li.kind === 'fight') this.drawSplatter(cb, t, li, pal);
    if (li.kind === 'talk') this.drawHeart(cb, cf, t, li, pal, gapPx);

    // ---- the word, bitten
    this.drawWordBitten(cf, t, i, pal, gapPx);
    if (li.kind === 'fight' && this.isGrimy(cw)) this.applyGrime(cf, cw);
    if (li.kind === 'fight' && /sweet/i.test(cw.w.w)) this.drawDrips(cf, t, cw, pal);

    // hairline seam when closed: the crack left across the letters
    const crack = (1 - clamp(gap01 * 6)) * (this.biteFor(cw) ? 1 : 0.5) * (this.inHeart(cw) && !/teeth/i.test(cw.w.w) ? 0 : 1);
    if (crack > 0.01) {
      cf.save();
      cf.globalAlpha = 0.85 * crack;
      cf.strokeStyle = tc(pal.accent === 'red' ? 'red' : pal.accent, 1);
      cf.lineWidth = 2.2;
      cf.lineJoin = 'round';
      cf.stroke(seamPath(this.jaw, CY, 260 + measure(cw.w.w.toUpperCase(), this.f.black, 300) * 0.0));
      cf.restore();
    }

    // ---- clinician's corner note (mono): the bite counter
    this.drawCounter(cf, t, i, pal, tilt);

    B.upload(); Fr.upload();
    const hot = pal.bg === 'ink' ? 1.3 : 0;
    this.comp.render(this.ctx.renderer, out, { a: B.texture, b: Fr.texture, bg: TL[pal.bg], hot, hotB: pal.bg === 'ink' ? 1.0 : 0 });

    // ---- post: shake on every bite, heavier on the big ones; flash on TEETH and GO
    const o: PostOverrides = { bloom: pal.bg === 'red' ? 0.3 : 0.65, bloomThreshold: pal.bg === 'red' ? 1.3 : 1.0, bloomKnee: 0.12, vignette: pal.bg === 'enamel' ? 0.25 : 0.45, paper: pal.bg === 'enamel' ? 1 : 0 };
    let sh = 0;
    for (let k = Math.max(0, i - 2); k <= i; k++) {
      const x = this.words[k]!;
      if (!this.biteFor(x)) continue;
      const amp = /teeth|go|dirty|devil/i.test(x.w.w) ? 26 : 13;
      sh = Math.max(sh, amp * (this.n === 3 ? 1.4 : 1) * pulse(t, x.w.start, 0.055));
    }
    if (/^go$/i.test(cw.w.w.replace(/[^a-z]/gi, ''))) sh = Math.max(sh, 7 * (1 - prog(t, cw.w.start, cw.w.end + 0.6)));
    if (sh > 0.05) o.shake = [noise1(frameIdx(t) * 0.9, 1) * sh, noise1(frameIdx(t) * 0.9, 2) * sh];
    o.zoom = 1 + 0.035 * pulse(t, cw.w.start, 0.09) * (this.biteFor(cw) ? 1 : 0);
    if (/teeth/i.test(cw.w.w)) o.zoom = 1 + 0.08 * pulse(t, cw.w.start, 0.07);
    return o;
  }

  // ------------------------------------------------------------------ the word
  private wordStyle(x: { w: Word; li: LineInfo; k: number }) {
    const raw = x.w.w.replace(/[,.!?]/g, '');
    const s = raw.toLowerCase();
    const kind = x.li.kind;
    // tender words in rose serif, lower case; quick words small; everything else Archivo black caps
    if ((kind === 'fight' && x.k >= 5) || (kind === 'talk' && s === 'pretty'))
      return { text: raw.toLowerCase(), fam: this.f.serif, max: s === 'pretty' ? 470 : 420, maxW: 1500, col: 'rose' as TKey, serif: true };
    if (['your', 'but', 'and', 'ever'].includes(s))
      return { text: s === 'ever' ? 'ever' : raw.toUpperCase(), fam: s === 'ever' ? this.f.serifR : this.f.mid, max: 150, maxW: 900, col: null, serif: s === 'ever' };
    const short = raw.length <= 3;
    return { text: raw.toUpperCase(), fam: short ? this.f.blackW : raw.length >= 6 ? this.f.blackC : this.f.black, max: short ? 560 : 520, maxW: 1640, col: null, serif: false };
  }

  private drawWordBitten(c: CanvasRenderingContext2D, t: number, i: number, pal: Pal, gapPx: number) {
    const x = this.words[i]!;
    const kind = x.li.kind;
    if (kind === 'never') return this.drawNever(c, t, i, pal, gapPx);
    if (kind === 'talk' && /^(heart|got)$/i.test(x.w.w)) return; // the heart plate carries these words
    const st = this.wordStyle(x);
    const size = Math.min(st.max, fitSize(st.text, st.fam, st.maxW, st.max));
    const col = st.col === 'rose' ? (pal.bg === 'ink' ? 'rose' : pal.bg === 'enamel' ? 'red' : 'enamel') : st.col ?? pal.ink;
    // held words creep toward camera; the devil line leans
    const hold = 1 + 0.06 * prog(t, x.w.start, x.w.start + 1.2, ease.outCubic);
    const lean = kind === 'late' && /devil/i.test(x.w.w) ? -0.18 : 0;
    const baseline = CY + (st.serif ? 0.28 : CAP / 2) * size;
    drawBitten(c, this.jaw, CY, gapPx, () => {
      c.save();
      c.translate(W / 2, CY); c.scale(hold, hold); c.transform(1, 0, lean, 1, 0, 0); c.translate(-W / 2, -CY);
      c.font = font(st.fam, size);
      c.textAlign = 'center';
      c.fillStyle = tc(col);
      // karaoke: the sung part in the word's own colour, the rest waits dimmer (a wipe, left to right)
      c.fillText(st.text, W / 2, baseline);
      c.restore();
    });
  }

  // ---- fight: grime, splatter, drips
  private isGrimy(x: { w: Word; k: number }) { return x.k <= 2; }
  private applyGrime(c: CanvasRenderingContext2D, x: { w: Word }) {
    c.save();
    c.resetTransform();
    c.globalCompositeOperation = 'destination-out';
    const ox = -hash(x.w.gi, 3) * 400, oy = -hash(x.w.gi, 4) * 300;
    c.drawImage(this.grime, ox, oy, W + 400, H + 300);
    c.restore();
  }
  private drawSplatter(c: CanvasRenderingContext2D, t: number, li: LineInfo, pal: Pal) {
    const ws = li.line.words;
    for (let k = 0; k < 3; k++) {
      const w = ws[k]!;
      if (t < w.start) break;
      const age = t - w.start;
      const grow = ease.outExpo(clamp(age / 0.05));
      const r = mulberry32(w.gi * 13 + 5);
      const col = pal.bg === 'red' ? 'ink' : 'red';
      c.fillStyle = tc(col, 1);
      const cx = W / 2 + (r() - 0.5) * 900, cy = CY + (r() - 0.5) * 360;
      for (let s = 0; s < 46; s++) {
        const a = r() * TAU, d = (40 + 520 * r() ** 1.6) * grow;
        const rr = 2 + 26 * r() ** 4;
        const el = 1 + 2.5 * r() ** 2;
        c.save();
        c.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7);
        c.rotate(a);
        c.beginPath(); c.ellipse(0, 0, rr * el, rr, 0, 0, TAU); c.fill();
        // drips run down the wall from the bigger drops
        if (rr > 12) { const dl = Math.min(140, age * 90 * (0.5 + r())); c.rotate(-a); c.fillRect(-rr * 0.3, 0, rr * 0.6, dl); c.beginPath(); c.arc(0, dl, rr * 0.38, 0, TAU); c.fill(); }
        c.restore();
      }
    }
  }
  private drawDrips(c: CanvasRenderingContext2D, t: number, x: { w: Word }, pal: Pal) {
    const st = { size: 420 };
    const w = measure('sweet', this.f.serif, st.size);
    const r = mulberry32(x.w.gi);
    const age = t - x.w.start;
    c.save();
    c.fillStyle = tc(pal.bg === 'ink' ? 'rose' : pal.bg === 'enamel' ? 'red' : 'enamel', 1);
    for (let d = 0; d < 9; d++) {
      const px = W / 2 - w * 0.42 + r() * w * 0.84;
      const L = Math.max(0, age - 0.08 * r()) * (120 + 260 * r()) * (1 - 0.3 * age);
      const wd = 5 + 9 * r();
      const y0 = CY + 0.06 * st.size;
      if (L <= 0) continue;
      c.beginPath();
      c.moveTo(px - wd / 2, y0);
      c.lineTo(px - wd / 2, y0 + L);
      c.arc(px, y0 + L, wd * 0.75, Math.PI, 0, true);
      c.lineTo(px + wd / 2, y0);
      c.fill();
    }
    c.restore();
    void pal;
  }

  // ---- talk: the heart with teeth
  private drawHeart(cb: CanvasRenderingContext2D, cf: CanvasRenderingContext2D, t: number, li: LineInfo, pal: Pal, _gapPx: number) {
    const ws = li.line.words;
    const wHeart = ws.find((w) => /heart/i.test(w.w))!, wGot = ws.find((w) => /^got/i.test(w.w))!, wTeeth = ws.find((w) => /teeth/i.test(w.w))!;
    if (t < wHeart.start) return;
    const inT = ease.outBack(prog(t, wHeart.start, wHeart.start + 0.16), 2.2);
    // the heart beats on the beat until it bites
    const bp = this.ctx.audio.beatAt(t) % 1;
    const beatPulse = 1 + 0.06 * Math.pow(1 - bp, 6);
    const bitten = t >= wTeeth.start;
    // after the bite it hangs back, huge and dark, behind TEETH
    const back = bitten ? ease.outExpo(prog(t, wTeeth.start, wTeeth.start + 0.12)) : 0;
    const S = 300 * inT * beatPulse * (1 + 0.75 * back);
    // its cleft opens on "got" and bites on "teeth"
    let open = 0;
    if (t >= wGot.start) open = ease.outCubic(prog(t, wGot.start, wGot.start + 0.2));
    if (bitten) open = 0.55 * (1 - ease.outExpo(prog(t, wTeeth.start, wTeeth.start + 0.05)));
    const gap = open * 210;
    const hcol: TKey = bitten ? (pal.bg === 'enamel' ? 'dentin' : 'wine') : pal.bg === 'red' ? 'ink' : 'red';
    const cy = CY - 20;
    const hj = makeJawCached(this, 300);
    const heart = heartPath(W / 2, cy, S);
    cb.save();
    cb.translate(W / 2, cy); cb.scale(S / 300, S / 300); cb.translate(-W / 2, -cy);
    const hs = heartPath(W / 2, cy, 300);
    // inside: the dark of the mouth behind the heart's halves
    if (gap > 1) {
      cb.save();
      cb.clip(hs);
      cb.fillStyle = tc(pal.bg === 'enamel' ? 'ink' : 'ink', 1);
      cb.fill(jawGapPath(hj, cy, gap));
      cb.restore();
    }
    for (const upper of [true, false]) {
      cb.save();
      cb.translate(0, upper ? -gap / 2 : gap / 2);
      cb.clip(hs);
      cb.clip(regionOf(hj, cy, upper));
      cb.fillStyle = tc(hcol, 1);
      cb.fillRect(W / 2 - 400, cy - 400, 800, 800);
      cb.restore();
    }
    // the teeth along the cut (once it has opened; interlocked after the bite)
    if (t >= wGot.start && !bitten) {
    cb.save();
    cb.clip(hs);
    const tf = bitten ? tc(pal.bg === 'enamel' ? 'enamel' : 'ink2', 1) : tc('enamel', 1);
    drawTeeth(cb, hj, cy, gap, tf, tc(bitten ? (pal.bg === 'enamel' ? 'dentin' : 'ink') : 'dentin', 1), 30);
    cb.restore();
    }
    cb.restore();
    void heart;
    // the words: HEART on the heart, GOT in its open mouth
    cf.save();
    cf.textAlign = 'center';
    if (t < wGot.start) {
      const size = 104 * inT;
      cf.font = font(this.f.blackW, size);
      cf.fillStyle = tc(pal.bg === 'red' ? 'red' : 'enamel', 1);
      cf.fillText('HEART', W / 2, cy + 0.05 * S + CAP * size / 2);
    } else if (!bitten) {
      const size = 120 * clamp(open * 1.6);
      cf.font = font(this.f.blackW, size);
      cf.fillStyle = tc(pal.bg === 'enamel' ? 'red' : 'red', 1);
      cf.fillText('GOT', W / 2, cy + CAP * size / 2);
    }
    cf.restore();
    if (bitten) {
      const size = Math.min(500, fitSize('TEETH', this.f.blackW, 1720, 500));
      const k = ease.outExpo(prog(t, wTeeth.start, wTeeth.start + 0.07));
      const g = 150 * (1 - k);
      drawBitten(cf, this.jaw, CY, g, () => {
        cf.save();
        cf.font = font(this.f.blackW, size * (1.1 - 0.1 * k));
        cf.textAlign = 'center';
        cf.fillStyle = tc(pal.ink, 1);
        cf.fillText('TEETH', W / 2, CY + CAP / 2 * size);
        cf.restore();
      });
    }
  }

  // ---- late: handprints
  private drawHands(c: CanvasRenderingContext2D, t: number, li: LineInfo, pal: Pal) {
    const ws = li.line.words.slice(3); // put your hands on me
    ws.forEach((w, k) => {
      if (t < w.start) return;
      const r = mulberry32(w.gi * 7 + 1);
      const age = t - w.start;
      const s = (300 + 220 * r()) * (1 + 0.25 * (1 - ease.outExpo(clamp(age / 0.09))));
      const x = W / 2 + (r() - 0.5) * 1500, y = CY + (r() - 0.5) * 700;
      const rot = (r() - 0.5) * 1.6 + (x < W / 2 ? 0.3 : -0.3);
      c.save();
      c.translate(x, y); c.rotate(rot);
      const hp = handPath(s, w.gi, k % 2 === 1);
      c.fillStyle = tc(pal.ink === 'ink' ? 'wine' : 'ink', 0.92);
      c.fill(hp);
      c.clip(hp);
      handCreases(c, s, w.gi, k % 2 === 1);
      inkSpeckle(c, 0, 0, s * 0.7, w.gi, 260);
      c.restore();
    });
  }

  // ---- never: stacked rows, then the clamp on GO
  private drawNever(c: CanvasRenderingContext2D, t: number, i: number, pal: Pal, gapPx: number) {
    const x = this.words[i]!;
    const ws = x.li.line.words;
    const nevers = ws.filter((w) => /^never/i.test(w.w));
    const nSung = nevers.filter((w) => t >= w.start).length;
    const wLet = ws.find((w) => /^let/i.test(w.w))!, wGo = ws.find((w) => /^go/i.test(w.w))!;
    const wEver = ws.find((w) => /^ever/i.test(w.w))!;
    c.save();
    c.textAlign = 'center';
    if (t < wLet.start) {
      // the stack: each NEVER bites in at the bottom and pushes the others up
      const size = 250;
      drawBitten(c, this.jaw, CY, gapPx, () => {
        for (let r = 0; r < nSung; r++) {
          const w = nevers[r]!;
          const k = ease.outExpo(prog(t, w.start, w.start + 0.12));
          const fromBottom = nSung - 1 - r;
          const y = CY + CAP * size / 2 + (fromBottom * -0.86 * size) + (nSung - 1) * 0.43 * size - (r === nSung - 1 ? (1 - k) * -80 : 0);
          c.font = font(r === nSung - 1 ? this.f.blackW : this.f.black, size * (r === nSung - 1 ? 1 : 0.92));
          const lit = r === nSung - 1;
          c.fillStyle = tc(lit ? pal.ink : pal.ink, lit ? 1 : 0.35 + 0.2 * r);
          c.fillText('NEVER', W / 2, y);
        }
        if (nSung === 0 && t >= ws[0]!.start) {
          c.font = font(this.f.mid, 150);
          c.fillStyle = tc(pal.ink, 1);
          c.fillText('AND', W / 2, CY + CAP * 75);
        }
        if (t >= wEver.start) {
          c.font = font(this.f.serif, 300);
          c.fillStyle = tc(pal.bg === 'ink' ? 'rose' : pal.bg === 'enamel' ? 'red' : 'enamel', 1);
          c.fillText('ever', W / 2 + 520, CY + 330 * 0.28 + 260);
        }
      });
    } else {
      const go = t >= wGo.start;
      const txt = go ? 'GO' : 'LET';
      const size = go ? 760 : 560;
      // GO is held between the teeth: a tug that shakes it, the jaw never opens again
      const held = go ? prog(t, wGo.start, wGo.end) : 0;
      const tug = go ? Math.sin((t - wGo.start) * TAU * 6.5) * 22 * (1 - 0.6 * held) * Math.min(1, (t - wGo.start) * 8) : 0;
      const stretch = go ? 1 + 0.18 * ease.inOutCubic(held) : 1;
      for (const upper of [true, false]) {
        // held in the bite: the two halves grind against each other, the word pulled long
        const shear = go ? (upper ? 1 : -1) * tug * 0.8 : 0;
        const g = go ? 0 : gapPx;
        c.save();
        c.translate(shear, upper ? -g / 2 : g / 2);
        c.clip(regionOf(this.jaw, CY, upper));
        c.translate(W / 2 + (go ? 0 : tug), CY); c.scale(stretch, 1 / Math.sqrt(stretch)); c.translate(-W / 2, -CY);
        c.font = font(go ? this.f.blackW : this.f.black, size);
        c.fillStyle = tc(pal.ink, 1);
        c.fillText(txt, W / 2, CY + CAP / 2 * size);
        c.restore();
      }
    }
    c.restore();
  }

  private drawCounter(c: CanvasRenderingContext2D, t: number, i: number, pal: Pal, tilt: number) {
    c.save();
    c.translate(W / 2, CY); c.rotate(-tilt); c.translate(-W / 2, -CY);
    const bites = this.words.slice(0, i + 1).filter((x) => this.biteFor(x)).length + [0, 0, 64, 128][this.n]!;
    c.font = font(this.f.mono, 14);
    c.letterSpacing = '3px';
    c.fillStyle = tc(pal.ink, 0.55);
    c.textAlign = 'left';
    c.fillText(`BITE ${String(bites).padStart(3, '0')}`, 96, 92);
    c.textAlign = 'right';
    const line = this.words[i]!.li;
    c.fillText(`CHORUS ${['I', 'II', 'III'][this.n - 1]} · ${line.half === 0 ? 'A' : 'B'}${line.idx % 4 + 1}`, W - 96, 92);
    c.restore();
    void t;
  }
}

// ------------------------------------------------------------------ helpers
const jawCache = new WeakMap<object, Map<number, Jaw>>();
function makeJawCached(owner: object, S: number) {
  let m = jawCache.get(owner);
  if (!m) { m = new Map(); jawCache.set(owner, m); }
  const k = Math.round(S / 40);
  let j = m.get(k);
  if (!j) { j = makeJaw(W / 2 - S * 1.3, W / 2 + S * 1.3, Math.max(20, S * 0.2), Math.max(8, S * 0.08), 77, 0.7); m.set(k, j); }
  return j;
}
function regionOf(j: Jaw, cy: number, upper: boolean) {
  const p = new Path2D();
  p.moveTo(j.x0, cy + j.ys[0]!);
  for (let k = 1; k < j.ys.length; k++) p.lineTo(j.x0 + k * j.step, cy + j.ys[k]!);
  const xb = j.x0 + (j.ys.length - 1) * j.step;
  p.lineTo(xb, upper ? cy - 3000 : cy + 3000);
  p.lineTo(j.x0, upper ? cy - 3000 : cy + 3000);
  p.closePath();
  return p;
}
function seamPath(j: Jaw, cy: number, _w: number) {
  const p = new Path2D();
  p.moveTo(j.x0, cy + j.ys[0]!);
  for (let k = 1; k < j.ys.length; k++) p.lineTo(j.x0 + k * j.step, cy + j.ys[k]!);
  return p;
}
/** A grime mask: specks, scuffs and scratches (alpha = how much ink is rubbed off). */
function makeGrime(seed: number) {
  const cv = document.createElement('canvas');
  cv.width = W + 400; cv.height = H + 300;
  const c = cv.getContext('2d')!;
  const r = mulberry32(seed);
  for (let i = 0; i < 2600; i++) {
    c.globalAlpha = 0.25 + 0.75 * r();
    c.fillStyle = '#000';
    const x = r() * cv.width, y = r() * cv.height, s = 0.6 + 7 * r() ** 5;
    c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
  }
  c.strokeStyle = '#000';
  for (let i = 0; i < 70; i++) {
    c.globalAlpha = 0.4 + 0.6 * r();
    c.lineWidth = 0.8 + 2.5 * r() ** 3;
    const x = r() * cv.width, y = r() * cv.height, a = (r() - 0.5) * 0.6 + (r() < 0.5 ? 0 : Math.PI / 2), l = 60 + 300 * r();
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 40, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 40, x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  // scuffed patches
  for (let i = 0; i < 40; i++) {
    const x = r() * cv.width, y = r() * cv.height, R = 30 + 120 * r();
    const g = c.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(0,0,0,${0.25 + 0.35 * r()})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 1; c.fillStyle = g; c.fillRect(x - R, y - R, 2 * R, 2 * R);
  }
  return cv;
}
void lerp; void T;
