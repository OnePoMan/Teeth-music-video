// SHEETS — verse 1b (docs/TEETH.md): "Sometimes you're a stranger in my bed / Don't know if you love me,
// or you want me dead / Push me away, push me away / Then beg me to stay, beg me to stay, yeah".
// A white sheet in a dark room under a raking light through blinds, rendered as a height field. Each word
// rises from under the cloth as it is sung (relief with real cast shadows); "stranger" is the biggest
// shape in the bed. On "dead" the light drops and the relief sinks. "Push me away": a fold is shoved
// across the sheet on each push and the words slide off with it. "beg me to stay": the cloth is gripped at
// the word that holds on, tension wrinkles radiating from it.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, W, H, makeRT } from '../../engine/gl';
import { F, font, layout } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { clamp, ease, prog, smoothstep, springStep, noise1, frameIdx } from '../../engine/util';
import { TEETH_GLSL, tc } from '../palette';

interface Placed { w: Word; x: number; y: number; width: number; size: number }

export default class Sheets extends Scene {
  R = new Layer2D(W / 2, H / 2, 1); // relief heights (half res, blurred; a full-res canvas blur costs seconds on the CPU)
  T = new Layer2D(); // mono annotations
  lines: Line[] = [];
  placed = new Map<number, Placed[]>();
  pushes: Word[] = []; stays: Word[] = []; dead!: Word; stranger!: Word;
  pass!: FSPass;
  hpass!: FSPass;
  hRT = makeRT(W, H, { depthBuffer: false, pxScale: 1 });
  fam = F.archivo(100, 900);
  mono = F.mono(400);

  override init() {
    const { lyrics, start, end } = this.ctx;
    this.lines = lyrics.lines.filter((l) => l.words[0]!.start >= start - 0.1 && l.words[0]!.start < end);
    for (const l of this.lines) this.placed.set(l.i, this.setLine(l));
    const ws = this.lines.flatMap((l) => l.words);
    this.pushes = ws.filter((w) => /^push/i.test(w.w));
    this.stays = ws.filter((w) => /^stay/i.test(w.w));
    this.dead = ws.find((w) => /^dead/i.test(w.w))!;
    this.stranger = ws.find((w) => /^stranger/i.test(w.w))!;
    // pass 1 (half res): the sheet's height field = folds + the words' relief
    this.hpass = new FSPass(/* glsl */ `
      uniform sampler2D relief; uniform float t, push, pushX, grip, flat_;
      uniform vec2 gripPos;
      // a long soft ridge: |sin| folded into a crease
      float ridge(vec2 q, vec2 d, float f, float ph) { return pow(1.0 - abs(sin(dot(q, d) * f + ph)), 1.6); }
      float folds(vec2 p) {
        vec2 q = p / 1080.0;
        q += 0.06 * vec2(snoise(q * 1.3 + 2.0), snoise(q * 1.3 - 7.0)); // the cloth never lies straight
        float h = 0.0;
        h += 48.0 * ridge(q, normalize(vec2(0.9, 0.45)), 2.4, 0.4 + 0.15 * sin(t * 0.37));
        h += 28.0 * ridge(q, normalize(vec2(-0.35, 1.0)), 3.7, 1.9);
        h += 10.0 * ridge(q, normalize(vec2(1.0, -0.2)), 6.3, 0.3) * smoothstep(0.2, 1.1, q.x);
        h += 2.0 * sin(q.x * 40.0 + q.y * 9.0) * smoothstep(0.6, 1.6, q.x + q.y);
        // breathing under the cloth
        h += 6.0 * sin(t * 1.3) * exp(-dot(q - vec2(0.9, 0.55), q - vec2(0.9, 0.55)) * 3.0);
        // the shove: a ridge travelling to the right
        float d = (p.x - pushX) / 140.0;
        h += push * 70.0 * exp(-d * d) * (0.8 + 0.2 * snoise(q * 4.0));
        // the grip: radial tension wrinkles around the held word
        vec2 g = p - gripPos;
        float r = length(g) / 1080.0;
        float a = atan(g.y, g.x);
        h += grip * 7.0 * sin(a * 7.0 + r * 10.0) * smoothstep(0.05, 0.16, r) * exp(-r * 2.4);
        h -= grip * 14.0 * exp(-r * r * 40.0);
        return h;
      }
      void main() {
        vec2 px = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
        float rel = pow(texture(relief, vUv).r, 0.4545);
        fragColor = vec4(folds(px) + 16.0 * rel * flat_, pow(texture(relief, vUv).g, 0.4545), 0.0, 1.0);
      }`, {
      relief: { value: this.R.texture }, t: { value: 0 }, push: { value: 0 }, pushX: { value: 0 },
      grip: { value: 0 }, gripPos: { value: [W / 2, H / 2] }, flat_: { value: 1 },
    });
    // pass 2 (full res): light it — normals, cast shadows marched through the height field, blinds
    this.pass = new FSPass(/* glsl */ `
      ${TEETH_GLSL}
      uniform sampler2D hf; uniform float t, light;
      float height(vec2 px) { return texture(hf, vec2(px.x / 1920.0, 1.0 - px.y / 1080.0)).r; }
      void main() {
        vec2 px = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
        float e = 2.0;
        float h = height(px);
        vec3 n = normalize(vec3(height(px - vec2(e, 0.0)) - height(px + vec2(e, 0.0)), height(px - vec2(0.0, e)) - height(px + vec2(0.0, e)), 2.0 * e));
        vec3 L = normalize(vec3(-0.75, -0.55, 0.62));
        float dif = max(dot(n, L), 0.0);
        float sh = 1.0;
        vec2 dir = normalize(L.xy);
        float rise = L.z / length(L.xy);
        for (int k = 1; k <= 10; k++) {
          float s = float(k) * 7.0;
          float hk = height(px + dir * s);
          sh = min(sh, clamp(1.0 - (hk - (h + s * rise)) / 5.0, 0.0, 1.0));
        }
        float bl = smoothstep(-0.5, 0.5, sin((px.x * 0.6 + px.y) / 1080.0 * 13.0 + t * 0.15));
        float pool = exp(-pow(length((px - vec2(860.0, 500.0)) / vec2(1150.0, 680.0)), 2.0) * 1.4);
        float lit = (0.25 + 0.75 * dif) * mix(0.45, 1.0, sh) * mix(0.62, 1.0, bl) * pool * light;
        float weave = 0.5 + 0.5 * sin(px.x * 1.9) * sin(px.y * 1.9);
        vec3 cloth = T_ENAMEL * (0.92 + 0.08 * weave);
        vec3 col = cloth * (0.025 + 1.25 * lit) + T_WINE * 0.03 * pool;
        col *= 0.75 + 0.25 * smoothstep(-40.0, 30.0, h);
        // the sung word: red seeping up through the cloth, hottest on the crest
        float heat = texture(hf, vUv).g;
        col = mix(col, T_RED * (0.12 + 1.1 * lit), clamp(heat, 0.0, 1.0) * 0.9);
        fragColor = vec4(col, 1.0);
      }`, { hf: { value: this.hRT.texture }, t: { value: 0 }, light: { value: 1 } });
  }

  private setLine(l: Line): Placed[] {
    const size = l.words.some((w) => /stranger/i.test(w.w)) ? 175 : 160;
    const maxW = 1560;
    const space = layout(' ', this.fam, size).width;
    const rows: Word[][] = [[]];
    let wsum = 0;
    for (const w of l.words) {
      const ww = layout(w.w.toUpperCase(), this.fam, size).width;
      if (rows[rows.length - 1]!.length && wsum + space + ww > maxW) { rows.push([]); wsum = 0; }
      rows[rows.length - 1]!.push(w);
      wsum += (wsum ? space : 0) + ww;
    }
    const lh = size * 1.0;
    const out: Placed[] = [];
    const y0 = H / 2 - ((rows.length - 1) * lh) / 2 + size * 0.35;
    rows.forEach((r, ri) => {
      const total = r.reduce((a, w) => a + layout(w.w.toUpperCase(), this.fam, /stranger/i.test(w.w) ? size * 1.12 : size).width, 0) + space * (r.length - 1);
      let x = W / 2 - total / 2;
      for (const w of r) {
        const sz = /stranger/i.test(w.w) ? size * 1.12 : size;
        const ww = layout(w.w.toUpperCase(), this.fam, sz).width;
        out.push({ w, x, y: y0 + ri * lh, width: ww, size: sz });
        x += ww + space;
      }
    });
    return out;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const R = this.R, r = R.ctx;
    R.clear('#000');
    const cur = [...this.lines].reverse().find((l) => t >= l.words[0]!.start - 0.4) ?? this.lines[0]!;
    const li = this.lines.indexOf(cur);
    const nxt = this.lines[li + 1];

    // the shove: each "push" sends a fold across the bed; the words ride out with it
    let push = 0, pushX = -400, slide = 0;
    for (const pw of this.pushes) {
      const k = prog(t, pw.start - 0.05, pw.start + 0.75, ease.outCubic);
      if (t >= pw.start - 0.05 && t < pw.start + 1.1) { push = Math.max(push, Math.sin(Math.PI * clamp(k * 1.1))); pushX = -300 + 2400 * k; }
      slide += 420 * ease.outCubic(prog(t, pw.start + 0.05, pw.start + 0.5)) * (cur.words.includes(pw) ? 1 : 0);
    }
    // the line leaves before the next arrives (sinks into the bed)
    const sink = nxt ? 1 - smoothstep(nxt.words[0]!.start - 0.35, nxt.words[0]!.start - 0.02, t) : 1 - smoothstep(this.ctx.end - 0.3, this.ctx.end, t);
    // grip on "stay"
    let grip = 0, gripPos: [number, number] = [W / 2, H / 2];
    r.save();
    r.scale(0.5, 0.5);
    r.filter = 'blur(1.4px)';
    r.textBaseline = 'alphabetic';
    for (const p of this.placed.get(cur.i)!) {
      const w = p.w;
      // rises as sung; the next line's words wait as the faintest impression
      const rise = t < w.start ? 0.025 * smoothstep(cur.words[0]!.start - 0.4, cur.words[0]!.start, t) : 0.25 + 0.75 * ease.outCubic(prog(t, w.start, Math.min(w.end, w.start + 0.35) + 0.05));
      const deadSink = w === this.dead ? 1 : 1;
      const sx = slide * (0.6 + 0.4 * (p.x / W));
      const v = Math.round(255 * clamp(rise * sink * deadSink));
      const heat = t < w.start ? 0 : Math.max(0, 1 - Math.max(0, t - w.end) / 0.6) * Math.min(1, (t - w.start) / 0.08);
      r.fillStyle = `rgb(${v},${Math.round(255 * heat * sink)},0)`;
      r.font = font(this.fam, p.size);
      r.fillText(w.w.toUpperCase(), p.x + sx, p.y);
      if (/^stay/i.test(w.w) && t >= w.start) {
        const g = ease.outCubic(prog(t, w.start, w.start + 0.3)) * (1 - prog(t, w.end + 0.2, w.end + 0.7));
        if (g > grip) { grip = g; gripPos = [p.x + p.width / 2 + sx, p.y - p.size * 0.35]; }
      }
    }
    r.restore();
    r.filter = 'none';
    R.upload();

    // the light: drops on "dead" and comes back up for the pushes
    const light = 1 - 0.72 * ease.outCubic(prog(t, this.dead.start, this.dead.start + 0.6)) * (1 - prog(t, this.pushes[0]!.start - 0.3, this.pushes[0]!.start + 0.1));
    const u = this.hpass.u;
    u.t!.value = t; u.push!.value = push; u.pushX!.value = pushX;
    u.grip!.value = grip; u.gripPos!.value = gripPos;
    u.flat_!.value = 1 - 0.65 * ease.inOutCubic(prog(t, this.dead.start + 0.1, this.dead.end + 0.4)) * (1 - prog(t, this.pushes[0]!.start - 0.3, this.pushes[0]!.start));
    this.hpass.render(this.ctx.renderer, this.hRT);
    this.pass.u.t!.value = t; this.pass.u.light!.value = light;
    this.pass.render(this.ctx.renderer, out);

    // the clinician's note, bottom left (mono, typewriter quotes)
    const T = this.T, c = T.ctx;
    T.clear();
    c.font = font(this.mono, 14);
    c.letterSpacing = '3px';
    c.fillStyle = tc('ash', 0.6);
    const note = t < this.dead.start ? 'OCCUPANTS: 1 (+1 UNIDENTIFIED)' : t < this.pushes[0]!.start ? 'OCCUPANTS: 1 (+1 UNRESPONSIVE)' : 'OCCUPANTS: 1';
    c.fillText(note, 96, H - 96);
    T.upload();
    this.ctx.comp.draw(this.ctx.renderer, T.texture, out);

    const o: PostOverrides = { bloom: 0.3, bloomThreshold: 1.1, vignette: 0.6, paper: 0 };
    let sh = 0;
    for (const pw of this.pushes) sh = Math.max(sh, 14 * Math.exp(-Math.max(0, t - pw.start) / 0.1) * (t >= pw.start ? 1 : 0));
    if (sh > 0.1) o.shake = [noise1(frameIdx(t), 7) * sh, noise1(frameIdx(t), 8) * sh * 0.4];
    o.zoom = 1.01 + 0.015 * Math.sin(t * 0.25) + 0.02 * springStep(t - (this.stays[0]?.start ?? 1e9), 1.5, 0.4);
    return o;
  }
}
