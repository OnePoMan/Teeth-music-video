// SHIRT — bridge + stripped chorus (docs/TEETH.md): "Blood on my shirt, rose in my hand / You're looking at
// me like you don't know who I am / Blood on my shirt, heart in my hand / Still beating", then the chorus
// sung over no drums. A white shirt (weave, placket, buttons) in flat daylight. "Blood": red stains bloom
// through the cloth. "rose in my hand": a rose drawn by a pen out of rhodonea curves. "who I am" loses
// focus. "heart in my hand": the rose's line unwinds into a heart, which beats on the grid with nothing
// under it ("Still beating"). The stripped chorus is set word by word beside the beating heart: on "heart
// got teeth" its cleft becomes a bite; "put your hands on me" leaves prints on the shirt; on "never let
// go" it is squeezed and held until the drums come back (the cut to jaw3).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, W, H } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { F, font, fitSize } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { clamp, ease, prog, smoothstep, lerp, hash, mulberry32, TAU, noise1, frameIdx } from '../../engine/util';
import { TEETH_GLSL, TL, tc } from '../palette';
import { handPath, handCreases, inkSpeckle, heartXY, makeJaw, jawY, type Jaw } from '../motifs';

const HX = 1340, HY = 500; // the heart / rose centre

export default class Shirt extends Scene {
  bg!: FSPass;
  lb = new LineBatch(30000, { blend: 'normal' });
  glow = new LineBatch(4000, { blend: 'add' });
  T = new Layer2D();
  P = new Layer2D(); // prints (under the text)
  lines: Line[] = [];
  bloods: Word[] = []; rose!: Word; who!: Word; heart!: Word; still!: Word; beating!: Word;
  chorus: Line[] = [];
  roseRnd: { k: number; R: number; rot: number; turns: number }[] = [];
  famB = F.archivo(100, 800);
  famX = F.archivo(125, 900);
  serif = F.serif(600, true);
  mono = F.mono(400);
  jaw!: Jaw;

  override init() {
    const { lyrics, start, end } = this.ctx;
    this.lines = lyrics.lines.filter((l) => l.words[0]!.start >= start - 0.1 && l.words[0]!.start < end);
    const ws = this.lines.flatMap((l) => l.words);
    this.bloods = ws.filter((w) => /^blood/i.test(w.w));
    this.rose = ws.find((w) => /^rose/i.test(w.w))!;
    this.who = ws.find((w) => /^who/i.test(w.w))!;
    this.heart = ws.find((w) => /^heart/i.test(w.w))!;
    this.still = ws.find((w) => /^still/i.test(w.w))!;
    this.beating = ws.find((w) => /^beating/i.test(w.w))!;
    this.chorus = this.lines.filter((l) => /^(fight|talk|late|and never)/i.test(l.text));
    this.roseRnd = [{ k: 5 / 4, R: 300, rot: 0.2, turns: 8 }, { k: 7 / 3, R: 200, rot: 1.1, turns: 6 }, { k: 4, R: 105, rot: 0.4, turns: 2 }];
    this.jaw = makeJaw(HX - 360, HX + 360, 44, 20, 3, 0.4);
    this.bg = new FSPass(/* glsl */ `
      ${TEETH_GLSL}
      uniform vec4 stains[10]; uniform int nStains; uniform float t, dim;
      float button(vec2 p, vec2 c) { return length(p - c) - 17.0; }
      void main() {
        vec2 px = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
        // cloth: weave and soft folds
        float weave = 0.5 + 0.25 * sin(px.x * 2.2) + 0.25 * sin(px.y * 2.2 + sin(px.x * 0.05));
        float fold = fbm(px / vec2(900.0, 500.0) + 4.0, 3);
        vec3 col = T_ENAMEL * (0.86 + 0.06 * weave + 0.1 * fold);
        // placket and buttons down the left third
        float px0 = 560.0;
        float pl = abs(px.x - px0);
        col *= 1.0 - 0.07 * smoothstep(46.0, 44.0, pl) * smoothstep(40.0, 44.0, pl) - 0.05 * step(pl, 44.0) * step(px.x, px0);
        float stitch = step(abs(pl - 38.0), 0.8) * step(0.5, fract(px.y / 9.0));
        col *= 1.0 - 0.18 * stitch;
        for (int i = 0; i < 4; i++) {
          vec2 bc = vec2(px0, 150.0 + float(i) * 260.0);
          float b = button(px, bc);
          float sh = smoothstep(6.0, -2.0, button(px - vec2(3.0, 4.0), bc));
          col *= 1.0 - 0.18 * sh * step(0.0, b);
          if (b < 0.0) {
            col = T_ENAMEL * 0.97 - 0.05 * smoothstep(-6.0, 0.0, b);
            vec2 q = abs(px - bc) - vec2(5.5);
            col *= 1.0 - 0.6 * smoothstep(2.6, 1.8, length(q));
          }
        }
        // blood: stains bloom through the weave, wet red, a dried rim
        for (int i = 0; i < 10; i++) {
          if (i >= nStains) break;
          vec4 s = stains[i];
          if (s.w <= 0.0) continue;
          vec2 d = (px - s.xy) / s.z;
          float r = length(d);
          float n = fbm(px * 0.012 + float(i) * 7.1, 3);
          float grow = 1.0 - exp(-s.w * 2.2);
          float f = r - (0.55 + 0.45 * grow) + 0.32 * n;
          float stain = smoothstep(0.03, -0.03, f) * step(0.001, grow);
          // wicking along the threads
          stain *= 0.85 + 0.15 * weave;
          float rim = smoothstep(-0.12, 0.0, f) * stain;
          vec3 bl = mix(T_RED * 0.62, T_WINE * 0.75, clamp(rim * 0.9 + 0.35 * smoothstep(1.0, 8.0, s.w), 0.0, 1.0));
          col = mix(col, bl, stain * 0.93);
          // satellite drops
          vec2 g = floor(px / 26.0);
          float h = hash12(g + float(i) * 13.0);
          vec2 dc = (g + 0.5 + 0.35 * (hash22(g + float(i)) - 0.5)) * 26.0;
          float dr = length(px - dc) - (2.0 + 6.0 * h * h);
          float near = smoothstep(1.7, 1.0, r) * step(1.05, r + 0.3 * n);
          col = mix(col, T_RED * 0.6, smoothstep(1.0, -1.0, dr) * step(0.88, h) * near * grow);
        }
        col *= dim;
        fragColor = vec4(col, 1.0);
      }`, { stains: { value: new Float32Array(40) }, nStains: { value: 0 }, t: { value: 0 }, dim: { value: 1 } });
  }

  // ------------------------------------------------------------------ the rose / heart line
  /** Points of the rose (all its curves joined) at fraction `u` drawn, and the heart they unwind into. */
  private roseCurve(n: number) {
    const pts: [number, number][] = [];
    const per = Math.floor(n / this.roseRnd.length);
    for (const c of this.roseRnd) {
      for (let i = 0; i < per; i++) {
        const th = (i / (per - 1)) * c.turns * Math.PI;
        const r = c.R * Math.cos(c.k * th);
        pts.push([HX + r * Math.cos(th + c.rot), HY + r * Math.sin(th + c.rot)]);
      }
    }
    return pts;
  }
  private heartCurve(n: number, s: number, squeeze = 1) {
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = heartXY((i / (n - 1)) * TAU * 3); // wound three times: concentric-ish contours
      const k = 1 - 0.09 * Math.floor((i / n) * 3);
      pts.push([HX + x * s * k * squeeze, HY + y * s * k + 20]);
    }
    return pts;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, au = this.ctx.audio;
    // ---- stains: one big bloom per "Blood", then drops on the chorus' bites
    const stains: number[][] = [];
    const r = mulberry32(5);
    // (kept clear of the heart on the right and of the text column top left)
    const spots = [[780, 800, 190], [380, 860, 150]];
    this.bloods.forEach((b, i) => {
      const age = t - b.start;
      const [x, y, rad] = spots[i] ?? [700, 700, 150];
      stains.push([x!, y!, rad!, Math.max(0, age)]);
      stains.push([x! + 160 * (r() - 0.3), y! - 140 * r(), 50 + 40 * r(), Math.max(0, age - 0.25)]);
    });
    for (const l of this.chorus) {
      const w = l.words[0]!;
      stains.push([700 + hash(w.gi, 1) * 330, 160 + hash(w.gi, 2) * 760, 34 + 30 * hash(w.gi, 3), Math.max(0, t - w.start)]);
    }
    const u = this.bg.u;
    const sa = u.stains!.value as Float32Array;
    sa.fill(0);
    stains.slice(0, 10).forEach((v, i) => sa.set(v, i * 4));
    u.nStains!.value = Math.min(10, stains.length);
    u.t!.value = t;
    u.dim!.value = 1 - 0.12 * smoothstep(this.still.start, this.still.start + 1, t);
    this.bg.render(this.ctx.renderer, out);

    // ---- prints on the shirt ("put your hands on me")
    const Pl = this.P, pc = Pl.ctx;
    Pl.clear();
    const late = this.chorus.find((l) => /^late/i.test(l.text));
    if (late) late.words.slice(3).forEach((w, k) => {
      if (t < w.start) return;
      const rr = mulberry32(w.gi * 3 + 7);
      const s = 260 + 120 * rr();
      pc.save();
      pc.translate(160 + rr() * 820, 220 + rr() * 700);
      pc.rotate((rr() - 0.5) * 1.4);
      const hp = handPath(s, w.gi, k % 2 === 1);
      pc.fillStyle = tc('wine', 0.78 * Math.min(1, (t - w.start) / 0.05));
      pc.fill(hp);
      pc.clip(hp);
      handCreases(pc, s, w.gi, k % 2 === 1);
      inkSpeckle(pc, 0, 0, s * 0.7, w.gi, 300);
      pc.restore();
    });
    Pl.upload();
    this.ctx.comp.draw(this.ctx.renderer, Pl.texture, out);

    // ---- the rose, then the heart
    const lb = this.lb, gl = this.glow;
    lb.clear(); gl.clear();
    const N = 900;
    const draw = prog(t, this.rose.start, this.rose.start + 1.6, ease.inOutCubic);
    const morph = ease.inOutCubic(prog(t, this.heart.start - 0.05, this.heart.start + 0.9));
    if (draw > 0) {
      const ro = this.roseCurve(N);
      // the heart beats on every beat from "Still" (lub-dub), harder in the chorus
      const bp = au.beatAt(t), ph = bp - Math.floor(bp);
      const beatOn = smoothstep(this.heart.start + 0.6, this.still.start, t);
      const lub = Math.exp(-ph * 9) + 0.6 * Math.exp(-Math.max(0, ph - 0.22) * 11) * (ph > 0.22 ? 1 : 0);
      const lastNever = this.chorus.find((l) => /never/i.test(l.text));
      const squeeze = lastNever ? 1 - 0.35 * ease.inOutCubic(prog(t, lastNever.words[1]!.start, lastNever.words[lastNever.words.length - 1]!.start + 0.3)) : 1;
      const scale = 300 * (1 + 0.07 * lub * beatOn);
      const he = this.heartCurve(N, scale, squeeze);
      // the bite: the heart's cleft opens on "got" and shuts on "teeth"
      const talk = this.chorus.find((l) => /^talk/i.test(l.text));
      let gap = 0;
      if (talk) {
        const got = talk.words.find((w) => /^got/i.test(w.w))!, teeth = talk.words.find((w) => /^teeth/i.test(w.w))!;
        gap = 70 * ease.outCubic(prog(t, got.start, got.start + 0.2)) * (1 - ease.outExpo(prog(t, teeth.start, teeth.start + 0.06)));
      }
      const bitten = talk ? t >= talk.words.find((w) => /^teeth/i.test(w.w))!.start : false;
      const nDraw = Math.floor(N * draw);
      let prev: [number, number] | null = null;
      for (let i = 0; i < nDraw; i++) {
        let x = lerp(ro[i]![0], he[i]![0], morph), y = lerp(ro[i]![1], he[i]![1], morph);
        if (morph > 0.99 && (gap > 0.5 || bitten)) {
          // split along the jaw: points above the seam move up, below move down
          const sy = HY + 20 + jawY(this.jaw, x);
          y += y < sy ? -gap / 2 : gap / 2;
        }
        if (prev) lb.seg2(prev[0], prev[1], x, y, 3.2, [TL.red[0] * 0.85, TL.red[1], TL.red[2]], 1);
        prev = [x, y];
      }
      // the seam's teeth once the heart has a mouth
      if (morph > 0.99 && (gap > 0.5 || bitten)) {
        let pu: [number, number] | null = null, pl: [number, number] | null = null;
        for (let x = HX - 300 * squeeze; x <= HX + 300 * squeeze; x += 4) {
          const y = HY + 20 + jawY(this.jaw, x);
          const a: [number, number] = [x, y - gap / 2], b: [number, number] = [x, y + gap / 2];
          if (pu) { lb.seg2(pu[0], pu[1], a[0], a[1], 2, [TL.ink[0], TL.ink[1], TL.ink[2]], 1); lb.seg2(pl![0], pl![1], b[0], b[1], 2, [TL.ink[0], TL.ink[1], TL.ink[2]], 1); }
          pu = a; pl = b;
        }
      }
      // the pen
      if (draw < 1 && prev) gl.seg2(prev[0], prev[1], prev[0] + 0.01, prev[1], 9, [3, 0.1, 0.12], 1);
      // a beat ring around the heart
      if (beatOn > 0.01) {
        const rr2 = 330 + 240 * ph;
        const a = (1 - ph) * 0.5 * beatOn;
        let q: [number, number] | null = null;
        for (let i = 0; i <= 120; i++) {
          const [hx, hy] = heartXY((i / 120) * TAU);
          const p: [number, number] = [HX + hx * rr2, HY + 20 + hy * rr2];
          if (q) lb.seg2(q[0], q[1], p[0], p[1], 1, [TL.red[0], TL.red[1], TL.red[2]], a);
          q = p;
        }
      }
    }
    lb.render(this.ctx.renderer, out);
    gl.render(this.ctx.renderer, out);

    // ---- the words
    const Tl = this.T, c = Tl.ctx;
    Tl.clear();
    c.textBaseline = 'alphabetic';
    const cur = [...this.lines].reverse().find((l) => t >= l.words[0]!.start - 0.35) ?? this.lines[0]!;
    if (this.chorus.includes(cur)) this.chorusWords(c, t, cur);
    else this.bridgeLine(c, t, cur);
    // the clinician
    c.font = font(this.mono, 14);
    c.letterSpacing = '3px';
    c.fillStyle = tc('ink', 0.5);
    const bpm = t >= this.still.start ? Math.round(au.bpm) : null;
    c.fillText(bpm ? `PULSE ${bpm} BPM · NO DRUMS` : 'EXHIBIT A · ONE SHIRT, WHITE', 96, H - 80);
    c.letterSpacing = '0px';
    Tl.upload();
    this.ctx.comp.draw(this.ctx.renderer, Tl.texture, out);

    const o: PostOverrides = { paper: 1, vignette: 0.4, bloom: 0.4, bloomThreshold: 1.0, bloomKnee: 0.12, grain: 0.05 };
    const bp = au.beatAt(t);
    if (t > this.still.start) {
      const sh = 2.5 * Math.exp(-(bp % 1) * 8);
      o.shake = [noise1(frameIdx(t), 31) * sh, noise1(frameIdx(t), 32) * sh];
    }
    for (const b of this.bloods) if (t >= b.start) o.zoom = (o.zoom ?? 1) + 0.03 * Math.exp(-(t - b.start) / 0.15);
    return o;
  }

  /** The bridge lines, top left in ink; "who I am" loses focus; "Still beating" big. */
  private bridgeLine(c: CanvasRenderingContext2D, t: number, l: Line) {
    const big = l.words.some((w) => w === this.still);
    const size = big ? 150 : 84;
    const fam = big ? this.famX : this.famB;
    const maxW = big ? 1500 : 820;
    // wrap to rows in the left half
    const space = size * 0.28;
    const rows: Word[][] = [[]];
    let wsum = 0;
    c.font = font(fam, size);
    for (const w of l.words) {
      const ww = c.measureText(w.w.toUpperCase()).width;
      if (rows[rows.length - 1]!.length && wsum + space + ww > maxW) { rows.push([]); wsum = 0; }
      rows[rows.length - 1]!.push(w);
      wsum += (wsum ? space : 0) + ww;
    }
    const x0 = big ? 120 : 120, lh = size * 1.02;
    const y0 = big ? H - 170 : 200;
    rows.forEach((row, ri) => {
      let x = x0;
      for (const w of row) {
        const txt = w.w.toUpperCase();
        const ww = c.measureText(txt).width;
        const sungNow = t >= w.start, active = sungNow && t < w.end + 0.1;
        let blur = 0;
        if (l.words.indexOf(w) >= l.words.indexOf(this.who) && l.words.includes(this.who) && sungNow) blur = 9 * ease.inCubic(prog(t, w.start, w.start + 1.2));
        c.save();
        if (blur > 0.2) c.filter = `blur(${blur.toFixed(1)}px)`;
        c.fillStyle = sungNow ? (active || /^blood/i.test(w.w) ? tc('red', 1) : tc('ink', 0.92)) : tc('ink', 0.13);
        c.fillText(txt, x, y0 + ri * lh);
        c.restore();
        x += ww + space;
      }
    });
  }

  /** The stripped chorus: one word per beat, stacked in the left column, the line's tender words in serif. */
  private chorusWords(c: CanvasRenderingContext2D, t: number, l: Line) {
    const ws = l.words;
    const x0 = 120;
    let y = 130;
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i]!;
      if (t < w.start) break;
      const tender = /^(love|sweet|pretty|so)$/i.test(w.w.replace(/[^a-z']/gi, '')) && /^(fight|talk)/i.test(l.text) && i >= 5 || /pretty/i.test(w.w);
      const small = /^(your|but|and|on)$/i.test(w.w.replace(/[^a-z]/gi, ''));
      const txt = tender ? w.w.replace(/[,]/g, '').toLowerCase() : w.w.replace(/[,]/g, '').toUpperCase();
      const fam = tender ? this.serif : this.famX;
      let size = small ? 56 : tender ? 104 : 92;
      c.font = font(fam, size);
      size = Math.min(size, fitSize(txt, fam, 760, size));
      c.font = font(fam, size);
      const k = ease.outExpo(prog(t, w.start, w.start + 0.12));
      const active = t < w.end + 0.08;
      c.fillStyle = active ? tc('red', 1) : tc(tender ? 'rose' : 'ink', tender ? 1 : 0.9);
      y += size * 0.9;
      c.save();
      c.translate(x0 - (1 - k) * 40, y);
      c.fillText(txt, 0, 0);
      c.restore();
    }
  }
}
void clamp;
