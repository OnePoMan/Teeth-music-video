// THROAT — the outro (docs/TEETH.md). Three shouts of TEETH, each a different bite (enamel on ink, ink
// on red, red on enamel); "Never, never, never ever let go": every ring of the throat clamps shut on "go".
// Then eight bars of riff: the camera is swallowed down a throat of concentric tooth rings, one ring per
// beat, the rings biting on every snare. At the hard stop (the music cuts) everything goes black but the
// red seam, which closes to a hairline and goes out.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D, W, H } from '../../engine/gl';
import { F, font, fitSize } from '../../engine/type';
import type { Word } from '../../engine/lyrics';
import { clamp, ease, prog, smoothstep, pulse, noise1, frameIdx, TAU, mulberry32 } from '../../engine/util';
import { TL, tc, type TKey } from '../palette';
import { TeethComp, makeJaw, drawBitten, jawSeam, drawTeeth, type Jaw } from '../motifs';

const CY = H / 2;
const CAP = 0.69;

export default class Throat extends Scene {
  L = new Layer2D();
  B = new Layer2D();
  comp = new TeethComp();
  jaw!: Jaw;
  shouts: Word[] = [];
  never: Word[] = [];
  go!: Word;
  tStop = 0; // the music's hard stop
  stage = 0; // the outro tunnel's escalation step (set by tunnel())
  fam = F.archivo(125, 900);
  mono = F.mono(500);

  override init() {
    const { lyrics, start, end, audio } = this.ctx;
    const ls = lyrics.lines.filter((l) => l.words[0]!.start >= start - 0.1 && l.words[0]!.start < end);
    this.shouts = ls.filter((l) => /^teeth$/i.test(l.text.trim())).map((l) => l.words[0]!);
    const nl = ls.find((l) => /never/i.test(l.text))!;
    this.never = nl.words;
    this.go = nl.words[nl.words.length - 1]!;
    this.jaw = makeJaw(-200, W + 200, 80, 34, 23, 0.6);
    // the hard stop: where the mix falls silent
    this.tStop = end;
    for (let t = end - 0.5; t > start; t -= 0.01) if (audio.env('rms', t) > 0.3) { this.tStop = t + 0.01; break; }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, au = this.ctx.audio;
    const L = this.L, B = this.B;
    L.clear(); B.clear();
    const c = L.ctx, b = B.ctx;
    const o: PostOverrides = { bloom: 0.8, bloomThreshold: 1.0, bloomKnee: 0.12, vignette: 0.6 };
    let bg: [number, number, number] = TL.ink;
    let sh = 0;

    // which shout is on (each holds until the next event)
    const events = [...this.shouts.map((w) => w.start), this.never[0]!.start];
    let si = -1;
    this.stage = 0;
    for (let k = 0; k < this.shouts.length; k++) if (t >= this.shouts[k]!.start && t < events[k + 1]!) si = k;
    const inNever = t >= this.never[0]!.start && t < this.go.end + 0.25;
    const stopped = t >= this.tStop;

    if (stopped) {
      // ---- black, the seam closes to a hairline and goes out
      const k = prog(t, this.tStop, this.tStop + 3.2);
      b.save();
      b.globalAlpha = 1 - ease.inCubic(k);
      b.strokeStyle = tc('red', 1);
      b.lineWidth = 2.5 * (1 - 0.6 * k);
      b.lineJoin = 'round';
      b.translate(W / 2, CY); b.scale(1, 1 - 0.95 * ease.outCubic(prog(t, this.tStop + 0.3, this.tStop + 2.4))); b.translate(-W / 2, -CY);
      b.stroke(jawSeam(this.jaw, CY));
      b.restore();
      const m = prog(t, this.tStop + 0.6, this.tStop + 1.2) * (1 - prog(t, this.ctx.end - 1.0, this.ctx.end - 0.2));
      if (m > 0) {
        c.font = font(this.mono, 15);
        c.letterSpacing = '6px';
        c.textAlign = 'center';
        c.fillStyle = tc('ash', 0.7 * m);
        c.fillText('TEETH', W / 2, CY + 110);
        c.fillStyle = tc('graphite', 0.7 * m);
        c.fillText('5 SECONDS OF SUMMER', W / 2, CY + 140);
      }
      o.vignette = 0.7;
    } else if (si >= 0) {
      // ---- a shout: TEETH bitten full-frame
      const w = this.shouts[si]!;
      const styles: { bg: TKey; ink: TKey; throat: TKey }[] = [
        { bg: 'ink', ink: 'enamel', throat: 'red' },
        { bg: 'red', ink: 'ink', throat: 'ink' },
        { bg: 'enamel', ink: 'red', throat: 'ink' },
      ];
      const st = styles[si]!;
      bg = TL[st.bg];
      const age = t - w.start;
      // it opens wide as it is shouted, and bites on the following beat
      const nb = au.timeOfBeat(Math.floor(au.beatAt(w.start)) + 2);
      const gap = 260 * ease.outCubic(clamp(age / 0.25)) * (1 - ease.inExpo(prog(t, nb - 0.18, nb)));
      if (gap > 0.5) {
        const g = b.createLinearGradient(0, CY - gap / 2 - 40, 0, CY + gap / 2 + 40);
        if (st.throat === 'red') { g.addColorStop(0, tc('ink')); g.addColorStop(0.4, tc('wine')); g.addColorStop(0.5, tc('red')); g.addColorStop(0.6, tc('wine')); g.addColorStop(1, tc('ink')); }
        else { g.addColorStop(0, tc('ink')); g.addColorStop(0.5, tc('wine')); g.addColorStop(1, tc('ink')); }
        b.fillStyle = g;
        b.fillRect(0, CY - gap / 2 - 40, W, gap + 80);
        drawTeeth(b, this.jaw, CY, gap, tc(st.bg === 'enamel' ? 'ink2' : 'enamel', 1), tc(st.bg === 'enamel' ? 'graphite' : 'dentin', 1), 90);
      }
      const size = Math.min(560, fitSize('TEETH', this.fam, 1760, 560));
      const sc = 1.25 - 0.25 * ease.outExpo(clamp(age / 0.12)) + 0.04 * age;
      drawBitten(c, this.jaw, CY, gap, () => {
        c.save();
        c.translate(W / 2, CY); c.scale(sc, sc); c.translate(-W / 2, -CY);
        c.font = font(this.fam, size);
        c.textAlign = 'center';
        c.fillStyle = tc(st.ink, 1);
        c.fillText('TEETH', W / 2, CY + CAP * size / 2);
        c.restore();
      });
      sh = 30 * pulse(t, w.start, 0.07) + 26 * pulse(t, nb, 0.06);
      o.paper = st.bg === 'enamel' ? 1 : 0;
      if (st.bg === 'red') { o.bloomThreshold = 1.4; o.bloom = 0.3; }
    } else {
      // ---- the throat: rings of teeth down a tunnel
      const go = this.go;
      const clamp_ = inNever && t >= go.start ? 1 - 0.25 * ease.outExpo(prog(t, go.start, go.start + 0.08)) : 1;
      this.tunnel(b, t, clamp_);
      if (inNever) this.neverWords(c, t);
      sh = 8 * f.a.snare + 5 * f.a.kick + (inNever ? 22 * pulse(t, go.start, 0.08) : 0);
      // the last two bars rush in
      const rush = smoothstep(this.tStop - 3.6, this.tStop, t);
      o.zoom = 1 + 0.25 * rush * rush;
      o.bloom = this.stage > 0 ? 0.35 : 0.8 + 0.6 * rush;
      if (this.stage > 0) o.bloomThreshold = 1.3;
    }

    B.upload(); L.upload();
    const light = bg === TL.red || bg === TL.enamel || this.stage > 0;
    this.comp.render(this.ctx.renderer, out, { a: B.texture, b: L.texture, bg, hot: light ? 0 : 1.6, hotB: light ? 0 : 1.1 });
    if (sh > 0.1) o.shake = [noise1(frameIdx(t), 41) * sh, noise1(frameIdx(t), 42) * sh];
    return o;
  }

  /** Concentric rings of inward teeth at increasing depth; the camera moves one ring per beat. */
  private tunnel(c: CanvasRenderingContext2D, t: number, clampK: number) {
    const au = this.ctx.audio;
    const bp = au.beatAt(t);
    // one ring per beat: an eased step on each beat
    const fl = Math.floor(bp), fr = bp - fl;
    const cam = fl + ease.inOutCubic(clamp(fr / 0.55));
    const Fz = 900;
    // the riff's eight bars escalate every two: dark throat -> red-hot -> negative (paper and ink) -> strobing
    const b0 = au.barAt(this.go.end + 0.3);
    const stage = clamp(Math.floor((au.barAt(t) - b0) / 2), 0, 3);
    this.stage = stage;
    const neg = stage === 2 || (stage === 3 && fl % 2 === 1);
    const hotK = stage === 1 ? 1 : stage === 3 ? 0.7 : 0;
    // deep red light at the end of the throat
    const g = c.createRadialGradient(W / 2, CY, 0, W / 2, CY, 700 + 500 * hotK);
    if (neg) { g.addColorStop(0, tc('red', 1)); g.addColorStop(0.12, tc('enamel', 1)); g.addColorStop(1, tc('dentin', 1)); }
    else { g.addColorStop(0, tc('red', 1)); g.addColorStop(0.18 + 0.2 * hotK, tc(hotK > 0 ? 'red' : 'wine', 1)); g.addColorStop(1, tc(hotK > 0 ? 'wine' : 'ink', 1)); }
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // the throat rolls, faster each stage
    c.save();
    c.translate(W / 2, CY); c.rotate((t - b0) * 0.08 * stage * stage); c.translate(-W / 2, -CY);
    const snare = au.hit('snare', t, 0.12);
    const NR = 14;
    for (let k = NR; k >= 0; k--) {
      const idx = Math.floor(cam) + k;
      const z = (idx - cam) * 1.0 + 0.35; // depth in ring spacings
      if (z <= 0.05) continue;
      const R = (Fz * 1.0) / z;
      if (R < 6) continue;
      const rnd = mulberry32(idx * 31 + 7);
      const N = 22 + Math.floor(rnd() * 6);
      const rot = idx * 0.37 + (idx % 2 ? 1 : -1) * t * 0.25;
      // each ring bites on the snare (closes inward), and everything clamps on "go"
      const bite = (1 - 0.18 * snare) * clampK;
      const fog = clamp(1 - (z - 1) / 9);
      const len = 0.42 * bite;
      // gum: a wine annulus
      c.beginPath();
      c.arc(W / 2, CY, R * 1.28, 0, TAU);
      c.arc(W / 2, CY, R * 0.98, 0, TAU, true);
      c.fillStyle = neg ? tc('red', 0.25 + 0.75 * fog) : `rgba(${Math.round(122 * fog + 133 * hotK * fog)},${Math.round(10 * fog)},${Math.round(23 * fog + 20 * hotK * fog)},1)`;
      c.fill();
      for (let i = 0; i < N; i++) {
        const a = rot + (i / N) * TAU;
        const wv = (TAU / N) * (0.42 + 0.08 * rnd());
        const tl = len * (0.75 + 0.5 * rnd()) * (i % 7 === 3 ? 1.35 : 1);
        const x1 = W / 2 + Math.cos(a - wv) * R, y1 = CY + Math.sin(a - wv) * R;
        const x2 = W / 2 + Math.cos(a + wv) * R, y2 = CY + Math.sin(a + wv) * R;
        const tx = W / 2 + Math.cos(a) * R * (1 - tl), ty = CY + Math.sin(a) * R * (1 - tl);
        const lum = fog * (0.55 + 0.45 * Math.max(0, Math.cos(a + 2.2)));
        c.fillStyle = neg ? `rgba(${Math.round(10 + 40 * (1 - fog))},${Math.round(8 + 30 * (1 - fog))},${Math.round(10 + 30 * (1 - fog))},1)` : `rgba(${Math.round(240 * lum)},${Math.round(235 * lum * 0.97)},${Math.round(225 * lum * 0.92)},1)`;
        c.beginPath();
        c.moveTo(x1, y1);
        c.quadraticCurveTo(W / 2 + Math.cos(a - wv * 0.4) * R * (1 - tl * 0.6), CY + Math.sin(a - wv * 0.4) * R * (1 - tl * 0.6), tx, ty);
        c.quadraticCurveTo(W / 2 + Math.cos(a + wv * 0.4) * R * (1 - tl * 0.6), CY + Math.sin(a + wv * 0.4) * R * (1 - tl * 0.6), x2, y2);
        c.closePath();
        c.fill();
      }
    }
    c.restore();
  }

  /** "Never, never, never ever let go": stacked in the throat's mouth, LET GO bitten by the clamp. */
  private neverWords(c: CanvasRenderingContext2D, t: number) {
    const ws = this.never;
    let cur = -1;
    for (let k = 0; k < ws.length; k++) if (t >= ws[k]!.start) cur = k;
    if (cur < 0) return;
    const w = ws[cur]!;
    const txt = w.w.replace(/[,]/g, '').toUpperCase();
    const size = /^GO$/.test(txt) ? 640 : /^LET$/.test(txt) ? 470 : 300;
    const age = t - w.start;
    const sc = 1.2 - 0.2 * ease.outExpo(clamp(age / 0.1));
    c.save();
    c.translate(W / 2, CY); c.scale(sc, sc); c.translate(-W / 2, -CY);
    c.font = font(this.fam, Math.min(size, fitSize(txt, this.fam, 1700, size)));
    c.textAlign = 'center';
    c.fillStyle = tc('enamel', 1);
    c.fillText(txt, W / 2, CY + CAP * size / 2);
    c.restore();
  }
}
