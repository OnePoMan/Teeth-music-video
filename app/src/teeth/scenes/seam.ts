// SEAM — the intro (docs/TEETH.md). Black. On the riff's first note a red hairline cuts across the
// frame: the closed bite. The bass envelope opens it like breath, each note a gasp of red light between
// two rows of teeth. In the last bar TEETH is set across the seam, split along the zigzag; the jaw yawns
// and snaps shut on the first sung word (the cut to `ember`).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D, W, H } from '../../engine/gl';
import { F, font, fitSize } from '../../engine/type';
import { clamp, ease, noise1, prog, pulse, frameIdx } from '../../engine/util';
import { TL, tc } from '../palette';
import { TeethComp, makeJaw, drawBitten, jawGapPath, jawSeam, drawTeeth, type Jaw } from '../motifs';

const CY = H / 2;

export default class Seam extends Scene {
  L = new Layer2D();
  B = new Layer2D();
  comp = new TeethComp();
  jaw!: Jaw;
  /** first riff note, the title bar, the snap */
  t0 = 0.4; tTitle = 0; tSnap = 0;
  fBig = F.archivo(125, 900);
  mono = F.mono(500);

  override init() {
    const au = this.ctx.audio;
    this.jaw = makeJaw(-120, W + 120, 92, 38, 5, 0.5);
    // the first audible bass note
    for (let t = 0; t < 2; t += 0.01) if (au.env('bass', t) > 0.25) { this.t0 = t; break; }
    this.tTitle = au.downbeats[3] ?? this.ctx.end - 1.7;
    this.tSnap = this.ctx.end - 0.03;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, au = this.ctx.audio;
    const L = this.L, Bk = this.B;
    L.clear(); Bk.clear();
    const c = L.ctx, b = Bk.ctx;

    // the seam draws out from the centre on the first note
    const draw = ease.outExpo(prog(t, this.t0, this.t0 + 0.9));
    // breath: the riff opens the jaw (peak-held so each note reads as a gasp)
    const bass = au.envPeak('bass', t, 0.06);
    let gap = draw * (3 + 120 * Math.pow(clamp((bass - 0.15) / 0.8), 1.7));
    // the title bar: a long yawn into the snap
    const yawn = ease.inOutCubic(prog(t, this.tSnap - 0.9, this.tSnap - 0.12));
    gap = Math.max(gap, 300 * yawn);
    if (t >= this.tSnap - 0.12) gap = 300 * (1 - ease.inExpo(prog(t, this.tSnap - 0.12, this.tSnap)));

    const half = (W / 2 + 140) * draw;
    b.save();
    b.beginPath(); b.rect(W / 2 - half, 0, 2 * half, H); b.clip();
    if (gap > 0.5) {
      // the throat: red light, hottest at the centre line
      const g = b.createLinearGradient(0, CY - gap / 2 - 40, 0, CY + gap / 2 + 40);
      g.addColorStop(0, tc('ink')); g.addColorStop(0.35, tc('wine')); g.addColorStop(0.5, tc('red')); g.addColorStop(0.65, tc('wine')); g.addColorStop(1, tc('ink'));
      b.fillStyle = g;
      b.fill(jawGapPath(this.jaw, CY, gap));
      // the teeth: enamel rows on both jaws, lit from inside
      drawTeeth(b, this.jaw, CY, gap, tc('enamel', 0.92), tc('dentin', 1), 70);
      // gums: the dark beyond the roots
      b.fillStyle = tc('ink');
      b.fillRect(-10, CY - gap / 2 - 70 - 2000, W + 20, 2000);
      b.fillRect(-10, CY + gap / 2 + 70, W + 20, 2000);
      // the teeth fade into the dark toward the roots
      for (const s of [-1, 1]) {
        const y0 = CY + s * (gap / 2 + 70), y1 = CY + s * (gap / 2 + 4);
        const gg = b.createLinearGradient(0, y0, 0, y1);
        gg.addColorStop(0, tc('ink', 1)); gg.addColorStop(1, tc('ink', 0));
        b.fillStyle = gg;
        b.fillRect(-10, Math.min(y0, y1), W + 20, Math.abs(y1 - y0));
      }
    }
    // the hairline (closed) / lips (open)
    b.lineJoin = 'round';
    for (const s of gap > 0.5 ? [-1, 1] : [0]) {
      b.save();
      b.translate(0, s * gap / 2);
      b.strokeStyle = tc('red', 1);
      b.lineWidth = 2;
      b.stroke(jawSeam(this.jaw, CY));
      b.restore();
    }
    b.restore();

    // ---- title: TEETH across the seam in the last bar
    const tin = prog(t, this.tTitle, this.tTitle + 0.12);
    if (tin > 0) {
      const size = Math.min(470, fitSize('TEETH', this.fBig, 1700, 470));
      drawBitten(c, this.jaw, CY, gap, (h) => {
        c.save();
        c.font = font(this.fBig, size * (1.06 - 0.06 * ease.outExpo(tin)));
        c.textAlign = 'center';
        c.textBaseline = 'alphabetic';
        c.fillStyle = tc('enamel', ease.outCubic(tin));
        c.fillText('TEETH', W / 2, CY + 0.345 * size);
        c.restore();
        void h;
      });
    }
    // credits, typed in mono on bar 2
    const cr = '5 SECONDS OF SUMMER';
    const n = Math.floor(cr.length * prog(t, au.downbeats[1] ?? 2, (au.downbeats[1] ?? 2) + 0.7));
    if (n > 0) {
      c.save();
      c.font = font(this.mono, 15);
      c.letterSpacing = '5px';
      c.fillStyle = tc('ash', 0.85 * (1 - prog(t, this.tSnap - 0.3, this.tSnap)));
      c.fillText(cr.slice(0, n), 96, 112);
      c.fillStyle = tc('red', 0.9 * (1 - prog(t, this.tSnap - 0.3, this.tSnap)));
      const m = Math.floor(5 * prog(t, (au.downbeats[2] ?? 4) - 0.1, (au.downbeats[2] ?? 4) + 0.3));
      c.textAlign = 'right';
      if (m > 0) c.fillText('TEETH'.slice(0, m), W - 96, H - 96);
      c.restore();
    }

    Bk.upload(); L.upload();
    this.comp.render(this.ctx.renderer, out, { a: Bk.texture, b: L.texture, bg: TL.ink, hot: 1.6, hotB: 0.6 });

    const o: PostOverrides = { bloom: 0.75, bloomThreshold: 1.0, bloomKnee: 0.12, vignette: 0.55 };
    const kick = pulse(t, this.tSnap, 0.07);
    const sh = 3 * clamp((bass - 0.5) * 2) + 22 * kick;
    if (sh > 0.1) o.shake = [noise1(frameIdx(t) * 0.8, 3) * sh, noise1(frameIdx(t) * 0.8, 4) * sh];
    o.zoom = 1 + 0.06 * prog(t, 0, this.ctx.end, ease.inQuad) + 0.05 * kick;
    o.fade = 1 - prog(t, 0, 0.3);
    return o;
  }
}
