// RORSCHACH ×2 — the pre-choruses (docs/TEETH.md): "Call me in the morning to apologize / Every little
// lie gives me butterflies / Something in the way you're looking through my eyes / Don't know if I'm
// gonna make it out alive". One enamel card per line; ink pressed out from the centre fold in black and
// red. The card folds shut and reopens on each new line (a fresh blot). Card I a moth, II a butterfly
// whose wings are the card itself flapping on the beat (and small ones fluttering off on "butterflies"),
// III a mask we fall through on "eyes", IV a jaw whose mouth snaps shut into the chorus' bite.
// A clinician scores every response in the margin. n=2 repeats the test on cards V–VIII, wetter, redder.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, W, H } from '../../engine/gl';
import { F, font, layout, fitSize } from '../../engine/type';
import type { Line } from '../../engine/lyrics';
import { clamp, ease, prog, smoothstep, mulberry32, TAU, noise1, frameIdx } from '../../engine/util';
import { TEETH_GLSL, tc } from '../palette';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const NOTES: Record<number, { resp: string; code: string }[]> = {
  1: [
    { resp: '“a moth. it called to apologize.”', code: 'W  FM  A  P' },
    { resp: '“butterflies. they’re lying.”', code: 'W  FM.FC  A  P' },
    { resp: '“a mask. someone is looking out of it.”', code: 'WS  F  (Hd)' },
    { resp: '“a mouth. I don’t think I get out.”', code: 'W  CF  Hd, Bl' },
  ],
  2: [
    { resp: '“the same moth. it called again.”', code: 'W  FM  A  P  (perseveration)' },
    { resp: '“a swarm. every one of them a lie.”', code: 'D  FM  A  (2)' },
    { resp: '“eyes. they’re mine, I think.”', code: 'DdS  F  Hd' },
    { resp: '“teeth. I’m still inside.”', code: 'W  C  Hd, Bl  — no form' },
  ],
};

export default class Rorschach extends Scene {
  n = 1;
  T = new Layer2D();
  lines: Line[] = [];
  pass!: FSPass;
  fam = F.archivo(100, 800);
  serif = F.serif(400, true);
  mono = F.mono(400);
  monoB = F.mono(600);

  override init() {
    const { lyrics, start, end, params } = this.ctx;
    this.n = Number(params.n ?? 1);
    this.lines = lyrics.lines.filter((l) => l.words[0]!.start >= start - 0.1 && l.words[0]!.start < end);
    this.pass = new FSPass(/* glsl */ `
      ${TEETH_GLSL}
      uniform float t, grow, fold, jawOpen, redness, wet, seed, holeGlow;
      uniform int shape;
      float sdE(vec2 p, vec2 c, vec2 r, float a) { p = rot2(a) * (p - c); return (length(p / r) - 1.0) * min(r.x, r.y); }
      float tri(float x) { return abs(fract(x) - 0.5) * 2.0; }
      // the blot in mirrored px space (P.x = distance from the fold), < 0 inside the ink
      float blot(vec2 P, out float hole) {
        hole = 1e3;
        float d;
        if (shape == 0) { // moth
          d = sdE(P, vec2(0.0, 520.0), vec2(46.0, 230.0), 0.0);
          d = smin(d, sdE(P, vec2(250.0, 390.0), vec2(270.0, 150.0), -0.42), 60.0);
          d = smin(d, sdE(P, vec2(200.0, 650.0), vec2(170.0, 115.0), 0.55), 50.0);
          d = smin(d, sdE(P, vec2(90.0, 280.0), vec2(26.0, 110.0), 0.5), 30.0);
        } else if (shape == 1) { // butterfly
          d = sdE(P, vec2(0.0, 510.0), vec2(30.0, 210.0), 0.0);
          d = smin(d, sdE(P, vec2(310.0, 360.0), vec2(320.0, 200.0), -0.32), 50.0);
          d = smin(d, sdE(P, vec2(240.0, 660.0), vec2(210.0, 150.0), 0.42), 50.0);
          hole = sdE(P, vec2(360.0, 340.0), vec2(62.0, 46.0), -0.3);
          d = max(d, -hole);
        } else if (shape == 2) { // mask with eye holes
          d = sdE(P, vec2(0.0, 470.0), vec2(600.0, 330.0), 0.0);
          d = smin(d, sdE(P, vec2(470.0, 240.0), vec2(120.0, 210.0), -0.6), 80.0);
          hole = sdE(P, vec2(235.0, 420.0), vec2(120.0, 66.0), 0.18);
          d = max(d, -hole);
          d = max(d, -sdE(P, vec2(0.0, 700.0), vec2(150.0, 22.0), 0.0));
        } else { // jaw: an open mouth with teeth, closing on 'jawOpen'
          d = sdE(P, vec2(0.0, 480.0), vec2(660.0, 360.0), 0.0);
          float G = jawOpen * 190.0 * (1.0 - pow(min(P.x / 560.0, 1.0), 2.0));
          float up = 480.0 - G + 95.0 * pow(1.0 - tri(P.x / 105.0), 1.2) * step(0.02, jawOpen);
          float lo = 480.0 + G - 95.0 * pow(1.0 - tri(P.x / 105.0 + 0.5), 1.2) * step(0.02, jawOpen);
          float mouth = max(up - P.y, P.y - lo);
          mouth = max(mouth, P.x - 560.0 * (0.4 + 0.6 * jawOpen));
          hole = mouth;
          d = max(d, -mouth);
        }
        return d;
      }
      void main() {
        vec2 px = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
        // the fold: each half turns about the centre line (0 = open flat, 1 = shut)
        float ang = fold * 1.5707;
        float c = cos(ang);
        float xs = 960.0 + (px.x - 960.0) / max(c, 0.015);
        vec3 bg = T_INK;
        if (abs(xs - 960.0) > 900.0 || px.y < 60.0 || px.y > 1020.0) { fragColor = vec4(bg, 1.0); return; }
        vec2 p = vec2(xs, px.y);
        vec2 P = vec2(abs(p.x - 960.0), p.y);
        // paper: fibres and a little tooth
        float fib = fbm(p * vec2(0.004, 0.02) + 3.0, 3) * 0.5 + 0.5;
        vec3 paper = T_ENAMEL * (0.93 + 0.05 * fib + 0.02 * hash12(floor(p)));
        // the crease down the middle
        paper *= 1.0 - 0.07 * exp(-abs(p.x - 960.0) / 3.0) - 0.03 * exp(-abs(p.x - 960.0) / 40.0);
        float hole;
        vec2 Q = (P - vec2(0.0, 470.0)) / 0.9 + vec2(0.0, 500.0);
        float d = blot(Q, hole);
        // ink edge: ragged at two scales, pressed out from the fold with 'grow'
        float n1 = fbm(vec2(P.x, p.y) * 0.006 + seed, 3);
        float n2 = snoise(vec2(P.x, p.y) * 0.035 + seed * 1.7);
        d += 50.0 * n1 + 6.0 * n2;
        d += (1.0 - grow) * (P.x * 0.9 + 60.0);
        // satellite droplets near the edge
        float sat_ = snoise(vec2(P.x, p.y) * 0.018 + seed * 3.1);
        float drops = step(0.0, d) * step(d, 45.0) * smoothstep(0.80, 0.83, sat_) * grow;
        // wet runs below the blot (n=2)
        float run = 0.0;
        if (wet > 0.0) {
          // a few runs from the blot's lower edge: thin, wavering, a bead at the end
          float colw = 70.0;
          float ci = floor(P.x / colw);
          float h = hash11(ci * 7.3 + seed);
          float cx = (ci + 0.3 + 0.4 * hash11(ci * 3.1 + seed)) * colw;
          float len = wet * (90.0 + 420.0 * h * h);
          float y0 = 560.0 + 120.0 * hash11(ci * 1.7 + seed);
          float yy = p.y - y0;
          float wd = (2.0 + 4.0 * h) * (1.0 - 0.5 * clamp(yy / max(len, 1.0), 0.0, 1.0));
          float xx = abs(P.x - cx - 6.0 * sin(yy * 0.02 + h * 9.0));
          float bead = length(vec2(xx, yy - len)) - wd * 1.9;
          run = step(h, 0.4) * step(0.0, yy) * max(step(xx, wd) * step(yy, len), step(bead, 0.0));
        }
        float ink = smoothstep(1.5, -1.5, d);
        ink = max(ink, drops);
        ink = max(ink, run);
        // pooling: darker rim, lighter, mottled interior
        float rim = smoothstep(-26.0, -2.0, d);
        float dens = mix(0.86 + 0.14 * (fbm(vec2(P.x, p.y) * 0.0045 + seed, 2) * 0.5 + 0.5), 1.0, rim);
        // two inks: red where the second ink landed
        float redM = smoothstep(0.05, 0.25, snoise(vec2(P.x, p.y) * 0.003 + seed * 2.3) + redness - 0.5);
        redM = clamp(redM + step(0.99, redness), 0.0, 1.0);
        vec3 inkC = mix(T_INK, T_RED * 0.82, redM);
        // thin wash in the interior lets the paper through a little; the rim is solid
        float wash = (1.0 - rim) * (0.5 + 0.5 * fbm(vec2(P.x, p.y) * 0.003 - seed, 2));
        inkC = mix(inkC, mix(inkC, paper, 0.35), wash * 0.45 * (1.0 - 0.8 * redM));
        vec3 col = mix(paper, inkC, ink * dens);
        // through the holes (the mask's eyes, the jaw's mouth): red light behind the card
        if (holeGlow > 0.0 && hole < 0.0 && ink < 0.5) {
          vec3 behind = shape == 3 ? T_INK * 0.6 + T_WINE * 0.4 * exp(-abs(p.y - 480.0) / 60.0) : T_RED * 1.6;
          col = mix(col, behind, holeGlow * smoothstep(0.0, -12.0, hole));
        }
        // shading as the halves turn
        col *= mix(1.0, 0.45, fold) * (1.0 - 0.25 * fold * smoothstep(0.0, 900.0, abs(p.x - 960.0)));
        fragColor = vec4(col, 1.0);
      }`, {
      t: { value: 0 }, grow: { value: 1 }, fold: { value: 0 }, jawOpen: { value: 1 }, redness: { value: 0 }, wet: { value: 0 },
      seed: { value: 1 }, shape: { value: 0 }, holeGlow: { value: 0 },
    });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, n = this.n;
    const k = Math.max(0, this.lines.findIndex((l, i) => t < (this.lines[i + 1]?.words[0]!.start ?? 1e9) - 0.12));
    const line = this.lines[k]!;
    const ws = line.words;
    const tStart = k === 0 ? this.ctx.start : line.words[0]!.start - 0.12;
    const tNext = this.lines[k + 1] ? this.lines[k + 1]!.words[0]!.start - 0.12 : this.ctx.end;
    // fold: shut over the 0.15 s before a new card, open over the 0.25 s after (not before the first)
    let fold = 0;
    if (k > 0) fold = 1 - ease.outCubic(prog(t, tStart, tStart + 0.28));
    fold = Math.max(fold, ease.inCubic(prog(t, tNext - 0.16, tNext)) * (this.lines[k + 1] ? 1 : 0));
    const cardFold = fold;
    // the butterfly flaps: the card itself, on every beat
    const shape = k;
    if (shape === 1) {
      const bp = this.ctx.audio.beatAt(t);
      const flap = 0.5 - 0.5 * Math.cos(TAU * (bp % 1));
      fold = Math.max(fold, 0.55 * flap * smoothstep(tStart + 0.5, tStart + 0.9, t));
    }
    const grow = ease.outCubic(prog(t, tStart + (k > 0 ? 0.05 : 0), tStart + 0.9));
    // the jaw: open while the line is sung, snaps shut into the chorus
    const jawOpen = shape === 3 ? (0.3 + 0.7 * ease.outCubic(prog(t, ws[0]!.start, ws[0]!.start + 0.6))) * (1 - ease.inCubic(prog(t, this.ctx.end - 0.14, this.ctx.end - 0.01))) : 1;
    const eyes = ws[ws.length - 1]!;
    const u = this.pass.u;
    u.t!.value = t; u.grow!.value = grow; u.fold!.value = fold; u.jawOpen!.value = jawOpen;
    u.shape!.value = shape;
    u.seed!.value = 3.1 + shape * 5.7 + n * 13.3;
    u.redness!.value = n === 1 ? [0.2, 0.55, 0.3, 1.0][shape]! : [0.6, 0.8, 0.7, 1.0][shape]!;
    u.wet!.value = n === 2 ? ease.outCubic(prog(t, tStart + 0.6, tNext)) : 0;
    u.holeGlow!.value = shape === 2 ? smoothstep(eyes.start - 1.2, eyes.start, t) : shape === 3 ? 0.9 : 0;
    this.pass.render(this.ctx.renderer, out);

    // ---- text: card number, the line (karaoke), the clinician's scoring
    const L = this.T, c = L.ctx;
    L.clear();
    const shut = 1 - cardFold;
    c.globalAlpha = clamp(shut * 1.4 - 0.2);
    c.textBaseline = 'alphabetic';
    c.font = font(this.monoB, 15);
    c.letterSpacing = '4px';
    c.fillStyle = tc('ink', 0.8);
    c.fillText(`CARD ${ROMAN[(n - 1) * 4 + k]}`, 120, 128);
    c.textAlign = 'right';
    c.fillStyle = tc('red', 0.9);
    c.fillText(n === 1 ? ['07:12', '07:31', '07:58', '08:04'][k]! : ['07:12', '07:12', '07:13', '07:13'][k]!, W - 120, 128);
    c.textAlign = 'left';
    c.letterSpacing = '0px';
    // the lyric: across the bottom of the card, ink; the sung word red, unsung dim
    const text = line.text;
    const size = Math.min(76, fitSize(text, this.fam, 1560, 76));
    const lay = layout(text, this.fam, size);
    const x0 = W / 2 - lay.width / 2, y0 = 960;
    c.font = font(this.fam, size);
    let ci = 0;
    for (let wi = 0; wi < ws.length; wi++) {
      const w = ws[wi]!;
      const idx = text.indexOf(w.w, ci);
      ci = idx + w.w.length;
      const gx = lay.glyphs[idx]?.x ?? 0;
      const sungNow = t >= w.start;
      const active = sungNow && t < w.end + 0.05;
      c.fillStyle = sungNow ? (active ? tc('red', 1) : tc('ink', 0.95)) : tc('ink', 0.18 * smoothstep(tStart, tStart + 0.4, t));
      c.fillText(w.w, x0 + gx, y0);
    }
    // the scoring column (appears once the line is sung)
    const note = NOTES[n]![k]!;
    const sc = prog(t, ws[ws.length - 1]!.start, ws[ws.length - 1]!.start + 0.5);
    if (sc > 0) {
      c.font = font(this.serif, 30);
      c.fillStyle = tc('ink', 0.85);
      const chars = Math.floor(note.resp.length * sc);
      c.fillText(note.resp.slice(0, chars), 120, 186);
      c.font = font(this.mono, 15);
      c.letterSpacing = '3px';
      c.fillStyle = tc('red', 0.85 * sc);
      c.fillText(note.code, 120, 222);
      c.letterSpacing = '0px';
    }
    // butterflies: small blots fluttering off the card on the word
    const bw = ws.find((w) => /butterflies/i.test(w.w));
    if (bw && t >= bw.start) this.flutter(c, t, bw.start, n === 2 ? 26 : 12);
    c.globalAlpha = 1;
    L.upload();
    this.ctx.comp.draw(this.ctx.renderer, L.texture, out);

    // ---- post: paper plate; falling through the mask's eye on "eyes"
    const o: PostOverrides = { paper: 1, vignette: 0.45, bloom: 0.5, bloomThreshold: 1.05, bloomKnee: 0.15 };
    if (shape === 2) {
      const z = ease.inExpo(prog(t, eyes.start + 0.1, tNext - 0.02));
      o.zoom = 1 + 14 * z;
      // aim at the right eye hole (235 px right of the fold, y 420): it slides to the centre as we fall in
      const a = ease.outCubic(prog(t, eyes.start - 0.3, eyes.start + 0.4));
      o.shake = [-235 * a, -120 * a];
    }
    if (shape === 3 && t > this.ctx.end - 0.12) o.shake = [noise1(frameIdx(t), 11) * 16, noise1(frameIdx(t), 12) * 16];
    return o;
  }

  private flutter(c: CanvasRenderingContext2D, t: number, t0: number, count: number) {
    const r = mulberry32(17 + this.n);
    for (let i = 0; i < count; i++) {
      const delay = r() * 0.6, sp = 160 + 260 * r(), ang = -Math.PI / 2 + (r() - 0.5) * 2.4;
      const age = t - t0 - delay;
      if (age < 0) continue;
      const x = W / 2 + (r() - 0.5) * 500 + Math.cos(ang) * sp * age + 30 * Math.sin(age * 5 + i);
      const y = 480 + (r() - 0.5) * 300 + Math.sin(ang) * sp * age;
      const s = 14 + 22 * r();
      const flap = Math.abs(Math.cos(age * (14 + 6 * r()) + i));
      c.save();
      c.translate(x, y);
      c.rotate((r() - 0.5) * 0.8);
      c.fillStyle = r() < 0.5 ? tc('red', 0.9) : tc('ink', 0.85);
      for (const sgn of [-1, 1]) {
        c.beginPath(); c.ellipse(sgn * s * 0.55 * flap, -s * 0.2, s * 0.55 * flap, s * 0.45, sgn * -0.4, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(sgn * s * 0.4 * flap, s * 0.35, s * 0.38 * flap, s * 0.3, sgn * 0.4, 0, TAU); c.fill();
      }
      c.restore();
    }
  }
}
