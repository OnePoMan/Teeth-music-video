// HOOK ×3 — the one recurring event, in three grammatical moods (docs/MONSTER.md):
//   n=1 "What if I'm the monster?"  The shore of black mirror water, wine-dark; the line is the waterline. The
//       fire behind us (never seen) lights the words. The question is voiced top left; MONSTER? stands up on the
//       waterline as it is sung, bone, lit (red-figure: a lit figure on black). Its reflection is not a mirror
//       image: below the line the water shows the future, a black-figure MONSTER on the clay's orange, with no
//       question mark (the figure asks, the reflection answers), bent by the swell. On the word the camera dips
//       until the waterline crosses the middle of the frame: half figure, half reflection, while the orange
//       develops in the water.
//   n=2 "If I became the monster…" (the conditional): the same shore; the orange creeps a little above the line.
//   n=3 "Then I'll become the monster" (the declarative): black-figure. The frame is the clay's orange, the word a
//       black silhouette with its detail incised, and there is no flame: he is the reflection now.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, W, H } from '../../engine/gl';
import { F, font, layout, measure, type TextLayout } from '../../engine/type';
import type { Word } from '../../engine/lyrics';
import { clamp, ease, lerp, prog, pulse, noise1 } from '../../engine/util';
import { flameState, meanderBand } from '../motifs';

const CAP = 0.686; // Archivo cap height / em
/** The ground line of the black-figure frieze (n=3). */
const GROUND = H * 0.78;
/** The waterline before and after the camera dips on MONSTER (n=1, 2). */
export const WL0 = H * 0.71, WL1 = H * 0.535;

interface Placed { w: Word; text: string; fam: string; size: number; x: number; base: number; lay: TextLayout; big: boolean }

export default class Hook extends Scene {
  n = 1;
  L = new Layer2D();
  words: Placed[] = [];
  shore = new FSPass(/* glsl */ `
    uniform sampler2D tex; uniform float wl, develop, light, t, wordL, wordR, wordH, creep;
    const vec3 C_WINE = vec3(0.028, 0.0006, 0.0062);
    void main() {
      vec2 px = FRAG_PX;                                   // logical px, y up
      vec3 c;
      if (px.y >= wl) {
        // above the water: darkness; the words, bone, lit by the fire behind us
        c = C_INK;
        // (n=2: the clay's warmth creeping a little way up from the waterline)
        c = mix(c, C_SIGNAL * 0.62, creep * exp(-(px.y - wl) / 90.0) * 0.5);
        vec4 tx = texture(tex, vUv);
        float side = clamp(0.8 + 0.2 * px.x / ${W.toFixed(1)}, 0.0, 1.0);    // the fire is over our right shoulder
        float foot = mix(1.0, 0.82, clamp((px.y - wl) / 260.0, 0.0, 1.0));      // and low
        vec3 face = C_BONE * (0.6 + 0.4 * side * foot) * (0.84 + 0.16 * light);
        c = mix(c, face, tx.a);
      } else {
        float depth = wl - px.y;
        // ripples: the reflection is displaced sideways, barely at the line, more with depth, broken into bands
        float band = sin(depth * 0.21 - t * 1.7 + 0.6 * snoise(vec2(px.x / 260.0, t * 0.35)));
        float dx = (0.6 + depth * 0.022) * (0.65 * band + 0.35 * snoise(vec2(px.x / 90.0, depth / 14.0 - t * 0.8))) * smoothstep(0.0, 24.0, depth);
        vec2 ruv = vUv + vec2(dx / ${W.toFixed(1)}, 0.0);
        vec4 r = texture(tex, ruv);
        // the water: a black mirror, wine-dark; nothing drawn on it, its swell shows only in what it mirrors
        c = mix(C_INK, C_WINE, 0.85 * smoothstep(0.0, 160.0, depth));
        // the other world in the water: the clay's orange behind the reflected word, fading with depth and to the sides
        float edgeN = 26.0 * snoise(vec2(depth / 30.0, t * 0.4));
        float across = smoothstep(wordL - 70.0, wordL + 10.0, px.x + edgeN) * (1.0 - smoothstep(wordR - 10.0, wordR + 70.0, px.x + edgeN));
        // the mirrored field breaks up in the swell as it fades with depth
        float down = 1.0 - smoothstep(wordH * 0.9, wordH * 2.3, depth + edgeN * 0.5);
        float strips = mix(1.0, smoothstep(-0.35, 0.55, band), smoothstep(wordH * 0.75, wordH * 1.3, depth));
        float field = develop * across * down * strips * (0.9 + 0.1 * band);
        vec3 clay = mix(C_SIGNAL * 0.6, C_EMBER * 0.62, 0.2 + 0.2 * snoise(vec2(px.x / 500.0, depth / 200.0)));
        c = mix(c, clay, field);
        // the reflected word in black slip, its contour incised back to the clay (red channel)
        float letter = r.a;
        float inc = smoothstep(0.5, 0.9, r.r - r.g) * letter;
        float shown = smoothstep(0.08, 0.35, field);
        c = mix(c, C_INK, letter * shown);
        c = mix(c, clay * 1.1, inc * shown);
      }
      // the waterline: the line
      float d = abs(px.y - wl);
      c = mix(c, C_BONE * 0.8, pxLine(d * PX_SCALE, 0.6, 1.4) * 0.75);
      fragColor = vec4(c, 1.0);
    }`, {
    tex: { value: this.L.texture }, wl: { value: H - WL0 }, develop: { value: 0 }, light: { value: 1 }, t: { value: 0 },
    wordL: { value: 0 }, wordR: { value: W }, wordH: { value: 180 }, creep: { value: 0 },
  });
  black = new FSPass(/* glsl */ `
    uniform sampler2D words; uniform float t, warm;
    void main() {
      // black-figure: the clay's orange field, the figure in black slip, detail incised back to the clay
      vec2 px = FRAG_PX;
      float g = 0.5 + 0.5 * snoise(vec2(px.x / 900.0, px.y / 700.0));
      vec3 clay = mix(C_SIGNAL * 0.62, C_EMBER * 0.7, 0.25 * g) * (0.92 + 0.08 * warm);
      vec4 wd = texture(words, vUv);
      vec3 c = mix(clay, C_INK, wd.a);
      // incised lines are drawn into the layer's red channel (white on the black figure)
      c = mix(c, clay * 1.08, wd.a * smoothstep(0.5, 0.9, wd.r - wd.g));
      fragColor = vec4(c, 1.0);
    }`, { words: { value: this.L.texture }, t: { value: 0 }, warm: { value: 0 } });

  override init() {
    const { lyrics, params, start, end } = this.ctx;
    this.n = Number(params.n ?? 1);
    const line = lyrics.lines.find((l) => l.voice !== 'ensemble' && l.start >= start - 0.3 && l.start < end)!;
    const ws = line.words.filter((w) => w.start < end);
    // the question voiced small, top left; MONSTER standing big on the line
    const bigIdx = ws.findIndex((w) => /monster/i.test(w.w));
    const small = ws.slice(0, bigIdx), big = ws[bigIdx]!;
    const fS = F.archivo(100, 500), fB = this.n === 3 ? F.archivo(125, 900) : F.archivo(112.5, 900);
    const sizeS = 66;
    const bigText = big.w.toUpperCase().replace(/[,.]$/, '');
    const sizeB = Math.min(this.n === 3 ? 330 : 250, (W - (this.n === 3 ? 260 : 640)) / (measure(bigText, fB, 100) / 100));
    let x = 120;
    for (const w of small) {
      const lay = layout(w.w, fS, sizeS);
      this.words.push({ w, text: w.w, fam: fS, size: sizeS, x, base: 230, lay, big: false });
      x += lay.width + measure(' ', fS, sizeS);
    }
    const layB = layout(bigText, fB, sizeB);
    const bx = W / 2 - layB.width / 2;
    this.words.push({ w: big, text: bigText, fam: fB, size: sizeB, x: bx, base: GROUND, lay: layB, big: true });
  }

  /** 0..1: a word stands up from its line as it is sung (a cut-out rising on its hinge). */
  private stand(p: Placed, t: number) {
    const a = p.w.start - (p.big ? 0.02 : 0.0);
    return p.big ? ease.outBack(prog(t, a, a + 0.22), 1.6) : ease.outCubic(prog(t, a, a + 0.16));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    return this.n === 3 ? this.render3(f, out) : this.renderShore(f, out);
  }

  /** n=1, 2: the shore, the word, and the water that answers it. */
  private renderShore(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio: au } = this.ctx;
    const t = f.t;
    const fl = flameState(au, t, 3);
    const big = this.words[this.words.length - 1]!;
    // the camera dips onto the waterline as MONSTER is sung
    const dip = ease.inOutCubic(prog(t, big.w.start - 0.1, big.w.start + 0.42));
    const wl = lerp(WL0, WL1, dip);
    const L = this.L; L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';
    // the question, voiced (screen-fixed, it is the voice not an object)
    for (const p of this.words) {
      if (p.big) continue;
      const s = this.stand(p, t);
      if (s <= 0.001) continue;
      c.save();
      c.translate(0, p.base); c.scale(1, Math.max(0.001, s));
      c.font = font(p.fam, p.size); c.fillStyle = 'rgb(255,255,255)';
      c.fillText(p.text, p.x, 0);
      c.restore();
    }
    const s = this.stand(big, t);
    const answer = big.text.replace(/\?$/, ''); // the reflection answers: no question mark
    if (s > 0.001) {
      // the figure, standing on the line
      c.save();
      c.translate(0, wl); c.scale(1, s);
      c.font = font(big.fam, big.size); c.fillStyle = 'rgb(255,255,255)';
      c.fillText(big.text, big.x, 0);
      c.restore();
      // its reflection below the line, mirrored, black slip with an incised inner contour (red)
      c.save();
      c.translate(0, wl + 3); c.scale(1, -s);
      c.font = font(big.fam, big.size);
      c.fillStyle = 'rgb(0,0,0)';
      c.fillText(answer, big.x, 0);
      c.globalCompositeOperation = 'source-atop';
      c.lineJoin = 'round';
      c.strokeStyle = 'rgb(255,0,0)'; c.lineWidth = 13; c.strokeText(answer, big.x, 0);
      c.strokeStyle = 'rgb(0,0,0)'; c.lineWidth = 9.5; c.strokeText(answer, big.x, 0);
      c.restore();
    }
    // the ledger: the line is named
    const la = prog(t, big.w.start + 0.25, big.w.start + 0.55);
    if (la > 0) {
      c.save();
      c.font = font(F.mono(400), 12);
      c.letterSpacing = '2px';
      c.textAlign = 'right';
      c.fillStyle = `rgba(255,255,255,${(0.42 * la).toFixed(3)})`;
      c.fillText('WATERLINE', W - 96, wl - 10);
      c.restore();
    }
    L.upload();

    const u = this.shore.u;
    u.wl!.value = H - wl; u.t!.value = t; u.light!.value = fl.I;
    u.develop!.value = ease.outCubic(prog(t, big.w.start + 0.05, big.w.start + 0.7));
    u.wordH!.value = big.size * CAP;
    u.wordL!.value = big.x; u.wordR!.value = big.x + measure(answer, big.fam, big.size);
    u.creep!.value = this.n === 2 ? 0.25 : 0;
    this.shore.render(renderer, out);
    const hit = pulse(t, big.w.start, 0.08);
    return { bloom: 0.62, bloomThreshold: 0.95, vignette: 0.5, grain: 0.06, ca: 0.55, halation: 0.3, shake: [noise1(t * 60, 1) * 9 * hit, noise1(t * 60, 2) * 9 * hit] };
  }

  /** Black-figure: the frame is clay, the word a black silhouette with incised detail. */
  private render3(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const L = this.L; L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';
    for (const p of this.words) {
      const s = this.stand(p, t);
      if (s <= 0.001) continue;
      c.save();
      c.translate(0, p.base);
      c.scale(1, Math.max(0.001, s));
      c.font = font(p.fam, p.size);
      c.fillStyle = 'rgba(0,0,0,1)';
      c.fillText(p.text, p.x, 0);
      // incised detail: a contour scratched through the black just inside each letter's edge, back to the clay
      // (red channel): a wide red stroke clipped to the letters, then most of it painted black again
      if (p.big) {
        c.globalCompositeOperation = 'source-atop';
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(255,0,0,1)'; c.lineWidth = 15;
        c.strokeText(p.text, p.x, 0);
        c.strokeStyle = 'rgba(0,0,0,1)'; c.lineWidth = 11;
        c.strokeText(p.text, p.x, 0);
        c.globalCompositeOperation = 'source-over';
      }
      c.restore();
    }
    // the frieze's ground line and a meander band below it, in black slip like the figure
    c.fillStyle = 'rgba(0,0,0,1)';
    c.fillRect(0, GROUND + 18, W, 3);
    const mb = meanderBand(60, W - 60, GROUND + 44, 36);
    c.strokeStyle = 'rgba(0,0,0,1)'; c.lineWidth = 3.2; c.lineJoin = 'miter';
    c.beginPath(); mb.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.stroke();
    c.fillRect(0, GROUND + 98, W, 3);
    L.upload();
    this.black.u.t!.value = t;
    this.black.u.warm!.value = 0;
    this.black.render(renderer, out);
    return { bloom: 0.3, bloomThreshold: 1.2, vignette: 0.35, grain: 0.07, ca: 0.4, halation: 0.1 };
  }
}

void clamp; void CAP;
