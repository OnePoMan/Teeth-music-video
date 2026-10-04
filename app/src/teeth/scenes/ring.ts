// RING — verse 2 (docs/TEETH.md): "Some days you're the best thing in my life / Sometimes when I look at
// you, I see my wife / Then you turn into somebody I don't know / And you push me away, push me away, yeah".
// A ring engraved in hairlines turns slowly in the dark, the first line written around its band. On
// "I see my wife" it faces us and WIFE is engraved inside it. "Then you turn into": it turns edge-on and
// back, and its inner face has grown teeth. "push me away": each push shoves it deeper into the dark.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D, W, H, FSPass } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { F, font, layout, fitSize } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { clamp, ease, prog, smoothstep, springStep, noise1, frameIdx, TAU, lerp } from '../../engine/util';
import { TEETH_GLSL, TL, tc } from '../palette';

type V3 = [number, number, number];

export default class Ring extends Scene {
  lb = new LineBatch(40000, { blend: 'add' });
  T = new Layer2D();
  bg!: FSPass;
  lines: Line[] = [];
  wife!: Word; turn!: Word; know!: Word; pushes: Word[] = [];
  famW = F.archivo(125, 300);
  famB = F.archivo(125, 700);
  serif = F.serif(600, true);
  mono = F.mono(400);

  override init() {
    const { lyrics, start, end } = this.ctx;
    this.lines = lyrics.lines.filter((l) => l.words[0]!.start >= start - 0.1 && l.words[0]!.start < end);
    const ws = this.lines.flatMap((l) => l.words);
    this.wife = ws.find((w) => /^wife/i.test(w.w))!;
    this.turn = ws.find((w) => /^turn/i.test(w.w))!;
    this.know = ws.filter((w) => /^know/i.test(w.w)).pop()!;
    this.pushes = ws.filter((w) => /^push/i.test(w.w));
    this.bg = new FSPass(/* glsl */ `
      ${TEETH_GLSL}
      uniform vec2 c; uniform float glow, t;
      void main() {
        vec2 px = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
        float r = length((px - c) / 520.0);
        vec3 col = T_INK + T_WINE * 0.22 * glow * exp(-r * r * 1.4);
        col += T_GRAPHITE * 0.03 * (fbm(px / 700.0 + t * 0.02, 2) * 0.5 + 0.5);
        fragColor = vec4(col, 1.0);
      }`, { c: { value: [W / 2, H / 2] }, glow: { value: 1 }, t: { value: 0 } });
  }

  /** Ring orientation and placement over time: Euler angles (x tilt, y turn, z roll) and depth. */
  private pose(t: number) {
    const s = this.ctx.start;
    let rx = 1.05 - 0.25 * Math.sin((t - s) * 0.4);
    let ry = (t - s) * 0.35;
    // facing us for "wife"
    const face = ease.inOutCubic(prog(t, this.wife.start - 1.4, this.wife.start - 0.1)) * (1 - ease.inOutCubic(prog(t, this.turn.start - 0.3, this.turn.start + 0.1)));
    rx = lerp(rx, 0, face);
    ry = lerp(ry, Math.round(ry / Math.PI) * Math.PI, face);
    // "turn": edge-on and back, a full half turn about the vertical axis
    const tr = ease.inOutCubic(prog(t, this.turn.start, this.turn.start + 0.9));
    ry += Math.PI * tr;
    rx = lerp(rx, 0.15, smoothstep(this.turn.start - 0.2, this.turn.start + 0.4, t));
    // pushes shove it away
    let z = 0;
    for (const p of this.pushes) z += 1.6 * springStep(t - p.start, 1.1, 0.55);
    const rz = 0.12 * Math.sin((t - s) * 0.6);
    return { rx, ry, rz, z };
  }

  private rot([x, y, z]: V3, rx: number, ry: number, rz: number): V3 {
    let c = Math.cos(rx), s = Math.sin(rx);
    [y, z] = [y * c - z * s, y * s + z * c];
    c = Math.cos(ry); s = Math.sin(ry);
    [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(rz); s = Math.sin(rz);
    [x, y] = [x * c - y * s, x * s + y * c];
    return [x, y, z];
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const { rx, ry, rz, z } = this.pose(t);
    const D = 4.2 + z; // camera distance
    const S = 410; // px per unit at distance D0
    const cx = W / 2, cy = H / 2 - 70;
    const proj = (p: V3): [number, number, number] => {
      const k = (S * 4.2) / (D + p[2]);
      return [cx + p[0] * k, cy - p[1] * k, p[2]];
    };
    const L: V3 = norm([-0.5, 0.6, -0.65]);
    const R = 1, r = 0.13;
    const lb = this.lb;
    lb.clear();
    // ---- the band: meridian circles around the tube, shaded by the light (engraving)
    const NU = 150, NV = 22;
    for (let i = 0; i < NU; i++) {
      const u = (i / NU) * TAU;
      let prev: [number, number, number] | null = null;
      for (let j = 0; j <= NV; j++) {
        const v = (j / NV) * TAU;
        const nL: V3 = [Math.cos(u) * Math.cos(v), Math.sin(u) * Math.cos(v), Math.sin(v)];
        const pL: V3 = [(R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)];
        const n = this.rot(nL, rx, ry, rz), p = this.rot(pL, rx, ry, rz);
        const q = proj(p);
        if (prev) {
          const facing = -n[2]; // toward camera (camera looks along +z)
          if (facing > -0.15) {
            const dif = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
            const spec = Math.pow(Math.max(0, dif), 18);
            const b = (0.12 + 0.9 * dif + 2.2 * spec) * smoothstep(-0.15, 0.25, facing);
            lb.seg2(prev[0], prev[1], q[0], q[1], 1.1, [TL.enamel[0] * b + spec * 0.6, TL.enamel[1] * b * 0.95, TL.enamel[2] * b * 0.9], 1);
          }
        }
        prev = q;
      }
    }
    // ---- teeth on the inner face, grown after the turn
    const grow = ease.outBack(prog(t, this.turn.start + 0.45, this.turn.start + 1.0), 1.6);
    if (grow > 0.001) {
      const NT = 30;
      for (let i = 0; i < NT; i++) {
        const u = ((i + 0.5) / NT) * TAU;
        const w = (TAU / NT) * 0.42;
        const len = (0.26 + 0.1 * Math.sin(i * 2.7)) * grow;
        const base = R - r;
        const a: V3 = [base * Math.cos(u - w), base * Math.sin(u - w), 0];
        const b: V3 = [base * Math.cos(u + w), base * Math.sin(u + w), 0];
        const tip: V3 = [(base - len) * Math.cos(u), (base - len) * Math.sin(u), 0];
        const pa = proj(this.rot(a, rx, ry, rz)), pb = proj(this.rot(b, rx, ry, rz)), pt = proj(this.rot(tip, rx, ry, rz));
        // a few hatch lines fill each tooth, the tip hot
        for (let h = 0; h <= 5; h++) {
          const k = h / 5;
          const ex = lerp(pa[0], pb[0], k), ey = lerp(pa[1], pb[1], k);
          lb.seg2(ex, ey, pt[0], pt[1], 1.0, [TL.enamel[0] * 0.55, TL.enamel[1] * 0.52, TL.enamel[2] * 0.5], 1);
        }
        lb.seg2(pt[0], pt[1], pt[0] + 0.01, pt[1], 3.2, [2.4, 0.04, 0.08], 1);
      }
    }
    // ---- background, lines
    this.bg.u.c!.value = [cx, cy];
    this.bg.u.glow!.value = 0.6 + 0.6 * f.a.kick;
    this.bg.u.t!.value = t;
    this.bg.render(this.ctx.renderer, out);
    lb.render(this.ctx.renderer, out);

    // ---- text
    const T = this.T, c = T.ctx;
    T.clear();
    c.textBaseline = 'alphabetic';
    const cur = [...this.lines].reverse().find((l) => t >= l.words[0]!.start - 0.4) ?? this.lines[0]!;
    const li = this.lines.indexOf(cur);
    const nxt = this.lines[li + 1];
    const fade = nxt ? 1 - smoothstep(nxt.words[0]!.start - 0.25, nxt.words[0]!.start - 0.02, t) : 1;
    if (li === 0) this.textOnBand(c, t, cur, { rx, ry, rz }, proj, fade);
    else this.caption(c, t, cur, fade, li);
    // WIFE engraved inside the ring
    if (t >= this.wife.start && t < this.turn.start + 0.2) {
      const a = ease.outCubic(prog(t, this.wife.start, this.wife.start + 0.3)) * (1 - prog(t, this.turn.start - 0.15, this.turn.start + 0.2));
      c.save();
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.font = font(this.serif, 230);
      c.fillStyle = tc('rose', 1);
      c.fillText('wife', cx, cy + 70);
      c.restore();
    }
    // the clinician's footnote
    c.font = font(this.mono, 14);
    c.letterSpacing = '3px';
    c.fillStyle = tc('ash', 0.55);
    c.fillText(t < this.turn.start + 0.5 ? 'BAND · INNER FACE: ENGRAVED' : 'BAND · INNER FACE: TEETH (30)', 96, 96);
    c.letterSpacing = '0px';
    T.upload();
    this.ctx.comp.draw(this.ctx.renderer, T.texture, out);

    const o: PostOverrides = { bloom: 0.8, bloomThreshold: 1.0, bloomKnee: 0.12, vignette: 0.55 };
    let sh = 0;
    for (const p of this.pushes) sh = Math.max(sh, 16 * Math.exp(-Math.max(0, t - p.start) / 0.09) * (t >= p.start ? 1 : 0));
    sh = Math.max(sh, 4 * f.a.kick);
    if (sh > 0.1) o.shake = [noise1(frameIdx(t), 21) * sh, noise1(frameIdx(t), 22) * sh];
    return o;
  }

  /** The first line written around the band, on a circle in the ring's plane (dim behind, bright in front). */
  private textOnBand(c: CanvasRenderingContext2D, t: number, l: Line, pose: { rx: number; ry: number; rz: number }, proj: (p: V3) => [number, number, number], fade: number) {
    const text = l.text.toUpperCase();
    const size = 54;
    const lay = layout(text, this.famB, size);
    const Rr = 1.42;
    const circ = TAU * Rr * 410; // px around at unit scale
    const span = (lay.width / circ) * TAU;
    const a0 = Math.PI / 2 + span / 2 - (t - this.ctx.start) * 0.0; // centred at the top of the ring
    // word index of each char
    const owner: number[] = [];
    let ci = 0;
    l.words.forEach((w, wi) => { const i = text.indexOf(w.w.toUpperCase(), ci); for (let k = i; k < i + w.w.length; k++) owner[k] = wi; ci = i + w.w.length; });
    c.font = font(this.famB, size);
    c.textAlign = 'center';
    for (const g of lay.glyphs) {
      if (g.ch === ' ') continue;
      const ang = a0 - ((g.x + g.w / 2) / lay.width) * span;
      const p: V3 = this.rot([Rr * Math.cos(ang), Rr * Math.sin(ang), 0], pose.rx, pose.ry, pose.rz);
      const tan: V3 = this.rot([-Math.sin(ang), Math.cos(ang), 0], pose.rx, pose.ry, pose.rz);
      const q = proj(p);
      const q2 = proj([p[0] + tan[0] * 0.01, p[1] + tan[1] * 0.01, p[2] + tan[2] * 0.01]);
      const rot = Math.atan2(q[1] - q2[1], q[0] - q2[0]);
      const sc = (4.2 / (4.2 + p[2])) * 1.0;
      const w = l.words[owner[g.i] ?? 0]!;
      const sungNow = t >= w.start, active = sungNow && t < w.end + 0.1;
      const front = smoothstep(0.6, -0.4, p[2]);
      c.save();
      c.translate(q[0], q[1]);
      c.rotate(rot);
      c.scale(sc, sc);
      c.fillStyle = sungNow ? (active ? tc('red', fade) : tc('enamel', (0.4 + 0.6 * front) * fade)) : tc('enamel', 0.14 * fade);
      c.fillText(g.ch, 0, size * 0.35);
      c.restore();
    }
  }

  /** Lines 2-4: a wide, thin caption under the ring; the sung word red, the rest enamel. */
  private caption(c: CanvasRenderingContext2D, t: number, l: Line, fade: number, li: number) {
    const text = l.text;
    const size = Math.min(84, fitSize(text, this.famW, 1640, 84));
    const lay = layout(text, this.famW, size);
    const x0 = W / 2 - lay.width / 2, y0 = H - 120;
    c.font = font(this.famW, size);
    c.textAlign = 'left';
    let ci = 0;
    // pushes shove the caption sideways too
    let dx = 0;
    if (li === 3) for (const p of this.pushes) dx += 60 * springStep(t - p.start, 1.4, 0.5);
    for (const w of l.words) {
      const i = text.indexOf(w.w, ci);
      ci = i + w.w.length;
      const sungNow = t >= w.start, active = sungNow && t < w.end + 0.08;
      const isWife = w === this.wife;
      c.fillStyle = sungNow ? (active || isWife ? tc(isWife ? 'rose' : 'red', fade) : tc('enamel', 0.9 * fade)) : tc('enamel', 0.16 * fade);
      c.fillText(w.w, x0 + (lay.glyphs[i]?.x ?? 0) + dx, y0);
    }
  }
}

function norm(v: V3): V3 { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; }
void clamp;
