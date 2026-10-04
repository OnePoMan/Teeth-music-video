// EMBER — verse 1a (docs/TEETH.md): "Some days you're the only thing I know / Only thing that's burning
// when the nights grow cold / Can't look away, can't look away / Beg you to stay, beg you to stay, yeah".
// Cold and nearly black. The lines are set wide and thin, frosted; each word thaws to red heat as it is
// sung and cools to a wine glow. "burning" catches fire (a flame shader fed by the glyphs), "nights grow
// cold" frosts the frame over, "Can't look away": the camera tries to pan off and is yanked back on a
// spring; "Beg you to stay": the words are dragged toward the edge and stretch rather than let go.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, W, H } from '../../engine/gl';
import { F, font, layout } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { clamp, ease, prog, springStep, smoothstep, lerp, noise1, frameIdx, TAU } from '../../engine/util';
import { TEETH_GLSL, tc } from '../palette';
import { embers } from '../motifs';

interface Placed { w: Word; x: number; y: number; width: number; size: number; fam: string; text: string }

export default class Ember extends Scene {
  T = new Layer2D();
  M = new Layer2D(W / 2, H / 2, 1); // flame mask (low res)
  lines: Line[] = [];
  placed = new Map<number, Placed[]>(); // line index -> placed words
  burning!: Word; cold!: Word; nights!: Word;
  looks: Word[] = []; aways: Word[] = []; stays: Word[] = [];
  pass!: FSPass;
  fam = F.archivo(125, 300);
  famH = F.archivo(125, 500);
  mono = F.mono(400);

  override init() {
    const { lyrics, start, end } = this.ctx;
    this.lines = lyrics.lines.filter((l) => l.words[0]!.start >= start - 0.1 && l.words[0]!.start < end);
    for (const l of this.lines) this.placed.set(l.i, this.setLine(l));
    const ws = this.lines.flatMap((l) => l.words);
    this.burning = ws.find((w) => /burning/i.test(w.w))!;
    this.cold = ws.find((w) => /^cold/i.test(w.w))!;
    this.nights = ws.find((w) => /^nights/i.test(w.w))!;
    this.looks = ws.filter((w) => /^look/i.test(w.w));
    this.aways = ws.filter((w) => /^away/i.test(w.w));
    this.stays = ws.filter((w) => /^stay/i.test(w.w));
    this.pass = new FSPass(/* glsl */ `
      ${TEETH_GLSL}
      uniform sampler2D txt; uniform sampler2D mask;
      uniform float t, frost, flame, pan, heatAmb;
      uniform vec2 coldPos; uniform vec2 textPos;
      // frost: ice crystals as Voronoi cell edges (straight facets), two scales
      float vedge(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        float d1 = 8.0, d2 = 8.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 o = hash22(i + g);
          float d = length(g + o - f);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        return d2 - d1;
      }
      float crystals(vec2 p) {
        float a = 1.0 - smoothstep(0.0, 0.035, vedge(p));
        float b = 1.0 - smoothstep(0.0, 0.05, vedge(p * 3.1 + 4.0));
        return a + 0.55 * b;
      }
      void main() {
        vec2 px = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
        vec2 q = px / 1080.0 + vec2(pan / 1080.0, 0.0);
        // cold mist drifting, barely there
        float fog = fbm(vec3(q * 1.4 + vec2(t * 0.03, 0.0), t * 0.05), 4) * 0.5 + 0.5;
        vec3 col = mix(T_INK, T_GRAPHITE * 0.16, smoothstep(0.45, 0.95, fog));
        // the heat of what has been sung warms the air around the words
        float near = exp(-pow(length((px - textPos) / vec2(1100.0, 380.0)), 2.0));
        col += T_WINE * 0.22 * heatAmb * near * (0.6 + 0.4 * fog);
        // frost creeping in from the edges (and from the word 'cold')
        float edge = min(min(vUv.x, 1.0 - vUv.x) * 1.78, min(vUv.y, 1.0 - vUv.y));
        float reach = frost * 0.13 + 0.07 * frost * exp(-pow(length((px - coldPos) / vec2(420.0, 220.0)), 2.0));
        float fz = smoothstep(reach + 0.02, reach - 0.1, edge + 0.05 * snoise(q * 5.0));
        float cr = crystals(q * 7.5 + 7.0);
        col += T_ENAMEL * (0.16 * cr + 0.02) * fz;
        // fire from the mask: sample the glyphs below this point through rising noise
        if (flame > 0.0) {
          float f = 0.0;
          vec2 uv = vUv;
          for (int k = 2; k < 16; k++) {
            float fk = float(k);
            vec2 o = vec2(snoise(vec3(uv * vec2(9.0, 4.0) - vec2(0.0, t * 2.2), fk * 0.3 + t)) * 0.005 * fk, -fk * 0.006);
            f += texture(mask, uv + o).r * (1.0 - fk / 16.0);
          }
          f /= 4.0;
          f *= 1.0 - texture(mask, uv).r * 0.85; // keep the letters themselves readable
          float n = snoise(vec3(vUv * vec2(26.0, 12.0) - vec2(0.0, t * 5.0), t * 1.5)) * 0.5 + 0.5;
          f *= mix(0.55, 1.25, n) * flame;
          col += tHeat(clamp(f * 1.1, 0.0, 1.0)) * 1.8 * smoothstep(0.12, 0.45, f);
        }
        // text on top (red heat pushed over the bloom threshold)
        vec4 tx = texture(txt, vUv);
        vec3 tc = tx.rgb;
        float red = tc.r - max(tc.g, tc.b);
        tc *= 1.0 + 1.6 * smoothstep(0.3, 0.9, red);
        col = mix(col, tc, tx.a);
        fragColor = vec4(col, 1.0);
      }`, { txt: { value: this.T.texture }, mask: { value: this.M.texture }, t: { value: 0 }, frost: { value: 0 }, flame: { value: 0 }, pan: { value: 0 }, heatAmb: { value: 0 }, coldPos: { value: [W / 2, H / 2] }, textPos: { value: [W / 2, H / 2] } });
  }

  /** Greedy-wrap a line at 1640 px, block centred vertically, ragged right from x = 150. */
  private setLine(l: Line): Placed[] {
    const size = 138, maxW = 1640, x0 = 140;
    const space = layout(' ', this.fam, size).width;
    const rows: Word[][] = [[]];
    let wsum = 0;
    for (const w of l.words) {
      const ww = layout(w.w, this.fam, size).width;
      if (rows[rows.length - 1]!.length && wsum + space + ww > maxW) { rows.push([]); wsum = 0; }
      rows[rows.length - 1]!.push(w);
      wsum += (wsum ? space : 0) + ww;
    }
    const lh = size * 1.12;
    const y0 = H / 2 - ((rows.length - 1) * lh) / 2 + size * 0.36;
    const out: Placed[] = [];
    rows.forEach((r, ri) => {
      let x = x0;
      for (const w of r) {
        const ww = layout(w.w, this.fam, size).width;
        out.push({ w, x, y: y0 + ri * lh, width: ww, size, fam: this.fam, text: w.w });
        x += ww + space;
      }
    });
    return out;
  }

  /** Flame tongues over a placed word (additive), deterministic flicker from value noise. */
  private flames(c: CanvasRenderingContext2D, p: Placed, t: number, a: number) {
    const ign = ease.outCubic(prog(t, p.w.start, p.w.start + 0.35));
    const step = 15;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let x = p.x + 6; x < p.x + p.width - 4; x += step) {
      const k = x * 0.013;
      const h = p.size * (0.45 + 0.95 * Math.max(0, noise1(k * 3.1 + t * 3.3, 41) * 0.5 + 0.5)) * ign * (0.6 + 0.4 * Math.sin(x * 0.05 + 1.3));
      const sway = noise1(k * 2 + t * 2.4, 43) * h * 0.35;
      const wd = step * (1.3 + 0.6 * noise1(k + t, 44));
      const y0 = p.y - p.size * 0.5;
      const g = c.createLinearGradient(0, y0 + p.size * 0.15, 0, y0 - h);
      g.addColorStop(0, `rgba(255,120,110,${0.45 * a})`);
      g.addColorStop(0.35, `rgba(255,27,45,${0.45 * a})`);
      g.addColorStop(1, 'rgba(122,10,23,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x - wd / 2, y0 + p.size * 0.15);
      c.bezierCurveTo(x - wd / 2, y0 - h * 0.4, x + sway - wd * 0.15, y0 - h * 0.7, x + sway, y0 - h);
      c.bezierCurveTo(x + sway + wd * 0.1, y0 - h * 0.65, x + wd / 2, y0 - h * 0.35, x + wd / 2, y0 + p.size * 0.15);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  /** Heat of a word 0..1: white-hot as sung, cooling to an ember. */
  private heat(w: Word, t: number) {
    if (t < w.start) return 0;
    const p = clamp((t - w.start) / Math.max(0.05, w.end - w.start));
    const cool = Math.exp(-Math.max(0, t - w.end) / 0.9);
    return Math.max(0.32, lerp(0.75, 1, p) * cool + 0.32 * (1 - cool));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const Tl = this.T, c = Tl.ctx;
    Tl.clear();
    this.M.clear();
    const m = this.M.ctx;

    // ---- camera: "Can't look away" — panned off on each "look", yanked back on "away"
    let pan = 0;
    for (let k = 0; k < this.looks.length; k++) {
      const lk = this.looks[k]!, aw = this.aways[k];
      if (!aw) continue;
      const off = ease.inOutCubic(prog(t, lk.start, aw.start));
      const back = springStep(t - aw.start, 2.2, 0.32);
      pan += -520 * off * (1 - back);
    }
    // "Beg you to stay": dragged toward the right edge, held by the stretched word
    let drag = 0;
    for (const st of this.stays) drag += 160 * ease.outCubic(prog(t, st.start, st.end + 0.25)) * (1 - ease.inOutCubic(prog(t, st.end + 0.3, st.end + 0.55)));
    const drift = 30 * Math.sin(t * 0.21) + 18 * noise1(t * 0.4, 9);

    // ---- the current line (and the next one, dim, up to 0.45 s early)
    const cur = [...this.lines].reverse().find((l) => t >= l.words[0]!.start - 0.45) ?? this.lines[0]!;
    const li = this.lines.indexOf(cur);
    const nxt = this.lines[li + 1];
    const fadeOut = nxt ? 1 - smoothstep(nxt.words[0]!.start - 0.1, nxt.words[0]!.start + 0.05, t) : 1;
    let heatAmb = 0;
    c.save();
    c.translate(pan * 0.9 + drift + drag, 0);
    c.textBaseline = 'alphabetic';
    // "burning" catches fire: flickering tongues rising from the word's x-height, behind the glyphs
    for (const p of this.placed.get(cur.i)!) if (p.w === this.burning && t >= p.w.start && fadeOut > 0.01) this.flames(c, p, t, fadeOut);
    for (const p of this.placed.get(cur.i)!) {
      const w = p.w;
      const h = this.heat(w, t);
      heatAmb = Math.max(heatAmb, h * 0.6);
      const appear = smoothstep(cur.words[0]!.start - 0.45, cur.words[0]!.start, t);
      // "stay" stretches (wider face and a horizontal scale) while it is held
      const isStay = /^stay/i.test(w.w);
      const stretch = isStay ? 1 + 0.55 * ease.inOutCubic(prog(t, w.start, w.end + 0.2)) * (1 - prog(t, w.end + 0.3, w.end + 0.6)) : 1;
      const fam = h > 0 ? this.famH : this.fam;
      c.save();
      c.translate(p.x, p.y);
      c.scale(stretch, 1);
      c.font = font(fam, p.size);
      if (h <= 0) c.fillStyle = tc('enamel', 0.16 * appear * fadeOut);
      else {
        // white-hot -> red -> wine
        const k = h;
        const col = k > 0.82 ? mixc([255, 226, 214], [255, 27, 45], (1 - k) / 0.18) : k > 0.5 ? mixc([255, 27, 45], [122, 10, 23], (0.82 - k) / 0.32) : [122, 10, 23];
        c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${fadeOut})`;
      }
      c.fillText(p.text, 0, 0);
      c.restore();
      // embers rising from words while they burn
      if (h > 0.4 && fadeOut > 0.01) {
        const big = w === this.burning;
        const es = embers(t, { x: p.x, y: p.y - p.size * 0.7, w: p.width, h: p.size * 0.6 }, { rate: big ? 70 : 9, life: big ? 2.2 : 1.4, rise: big ? 160 : 70, seed: w.gi * 31, t0: w.start });
        for (const [ex, ey, life, sz] of es) {
          c.fillStyle = `rgba(255,${Math.round(27 + 200 * life ** 3)},${Math.round(45 + 170 * life ** 3)},${life * fadeOut})`;
          c.beginPath(); c.arc(ex, ey, sz * (0.6 + life), 0, TAU); c.fill();
        }
      }
    }
    c.restore();

    // clinician-quiet annotation: the temperature of the room, falling
    const temp = 18 - 21 * smoothstep(this.nights.start, this.cold.end + 1.0, t);
    c.font = font(this.mono, 14);
    c.letterSpacing = '3px';
    c.fillStyle = tc('ash', 0.5);
    c.fillText(`ROOM ${temp >= 0 ? '+' : '−'}${Math.abs(temp).toFixed(1)} °C`, 150, H - 110);
    c.letterSpacing = '0px';

    Tl.upload(); this.M.upload();
    const u = this.pass.u;
    u.t!.value = t;
    u.frost!.value = smoothstep(this.nights.start, this.cold.end + 1.4, t);
    u.flame!.value = 0;
    u.pan!.value = pan * 0.5;
    const pc = [...this.placed.values()].flat().find((p) => p.w === this.cold);
    if (pc) u.coldPos!.value = [pc.x + pc.width / 2 + pan * 0.9 + drift, pc.y - pc.size * 0.3];
    const ps = this.placed.get(cur.i)!;
    u.textPos!.value = [ps.reduce((a, p) => a + p.x + p.width / 2, 0) / ps.length + pan * 0.9 + drift + drag, ps.reduce((a, p) => a + p.y, 0) / ps.length - 40];
    u.heatAmb!.value = heatAmb;
    this.pass.render(this.ctx.renderer, out);

    const o: PostOverrides = { bloom: 0.8, bloomThreshold: 1.0, bloomKnee: 0.15, vignette: 0.6 };
    // a little camera shake when the whip lands back
    let sh = 0;
    for (const aw of this.aways) sh = Math.max(sh, 10 * Math.exp(-Math.max(0, t - aw.start) / 0.08) * (t >= aw.start ? 1 : 0));
    if (sh > 0.1) o.shake = [noise1(frameIdx(t), 5) * sh, noise1(frameIdx(t), 6) * sh];
    o.zoom = 1.02 + 0.02 * Math.sin(t * 0.3);
    return o;
  }
}

function mixc(a: number[], b: number[], k: number) {
  k = clamp(k);
  return [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * k));
}
