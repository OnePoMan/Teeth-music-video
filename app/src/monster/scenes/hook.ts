// HOOK ×3 — the one recurring event, in three grammatical moods (docs/MONSTER.md):
//   n=1 "What if I'm the monster?"  The words stand up on the ground line as they are sung, lit from below by
//       the flame; behind them, on a wall engraved with light, their shadows are thrown up larger than they are,
//       splayed and detached, and the shadow of MONSTER? towers over everything. Every flicker of the flame
//       swings the shadow (a small light near the words, a big lever on the wall).
//   n=2 "If I became the monster and threw that guilt away" (the conditional) — see render2.
//   n=3 "Then I'll become the monster" (the declarative): black-figure. The ground is the clay's orange, the
//       word is a black silhouette with its detail incised, and there is no flame: he is the shadow now.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, W, H } from '../../engine/gl';
import { rgba } from '../../engine/palette';
import { F, font, layout, measure, type TextLayout } from '../../engine/type';
import { Lyrics, type Word } from '../../engine/lyrics';
import { clamp, ease, lerp, prog, pulse, noise1 } from '../../engine/util';
import { FlameSprite, flameState, GLSL_FLAME_LIGHT, GLSL_WALL_SHADOW, meanderBand } from '../motifs';

const CAP = 0.686; // Archivo cap height / em

/** The ground line and the flame (the same spot as the plates around it). */
const GROUND = H * 0.78;
const FLAME = { x: W / 2, y: H * 0.94, h: 128 };

interface Placed { w: Word; text: string; fam: string; size: number; x: number; base: number; lay: TextLayout; big: boolean }

export default class Hook extends Scene {
  n = 1;
  L = new Layer2D();
  flame = new FlameSprite();
  words: Placed[] = [];
  wall = new FSPass(/* glsl */ `
    uniform sampler2D words; uniform vec2 flameUv, flamePx; uniform float flameH, light, k, soft, ground, t;
    ${GLSL_FLAME_LIGHT}
    ${GLSL_WALL_SHADOW}
    float castAt(vec2 uv) { vec4 m = texture(words, uv); return m.a * m.g; }
    void main() {
      vec2 px = FRAG_PX;                                  // logical px, y up
      vec2 aspect = vec2(1.0, ${(W / H).toFixed(4)});
      float above = px.y - ground;                         // > 0 on the wall
      float Lw = light * flameLight(px, flamePx, flameH, 760.0);
      // the shadow of what stands on the ground, thrown on the wall from the flame (8 taps over the flame's size)
      float sh = 0.0;
      if (above > 0.0) {
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 2.39996 + 0.7;
          vec2 j = vec2(cos(a), sin(a)) * soft * sqrt((float(i) + 0.5) / 8.0) / aspect;
          vec2 Lj = flameUv + j;
          vec2 src = Lj + (vUv - Lj) / k;
          if (src.x >= 0.0 && src.x <= 1.0 && src.y >= 0.0 && src.y <= 1.0) sh += castAt(src);
        }
        sh /= 8.0;
      }
      float lit = Lw * (1.0 - sh);
      // the wall: ashlar courses engraved in light (scratchboard: light is line, shadow is the black ground)
      float row = floor(px.y / 52.0);
      float blockX = (px.x + 131.0 * hash11(row)) / 230.0;
      float joint = min(fract(blockX), 1.0 - fract(blockX)) * 230.0;      // px to the nearest vertical joint
      float bed = min(fract(px.y / 52.0), 1.0 - fract(px.y / 52.0)) * 52.0; // px to the nearest bed joint
      float stone = 0.5 + 0.5 * snoise(vec2(floor(blockX) * 1.7, row * 2.3));
      float course = px.y / 6.0 + 0.25 * snoise(vec2(px.x / 380.0, px.y / 60.0)) + 0.6 * stone;
      float dark = smoothstep(0.045, 0.9, lit * (0.6 + 0.4 * stone)) * 0.82;
      // (hatch draws a faint hairline even at zero darkness: unlit stone stays black)
      float ink = hatch(course, dark) * smoothstep(0.02, 0.08, dark) * smoothstep(2.0, 5.0, joint) * smoothstep(1.5, 4.0, bed) * step(0.0, above);
      // the floor in front of the wall: dark wet stone, a few receding joints, the word reflected in it
      float below = -above;
      float z = 1.0 / max(below, 0.5);
      float Lf = light * flameLight(px, flamePx, flameH, 420.0);
      float joints = hatch(180.0 * z, 0.05) * step(0.0, below) * smoothstep(2.0, 12.0, below);
      vec2 ruv = vec2(vUv.x + 0.0025 * snoise(vec2(px.x / 40.0, below / 9.0 + t * 0.6)), (ground - below * 1.04) / ${H.toFixed(1)});
      vec4 refl = texture(words, ruv) * step(0.0, below);
      float fade = exp(-below / 70.0);
      vec3 c = C_INK + C_BONE * (0.5 * ink + 0.18 * joints * Lf) + mix(C_BLOOD, C_SIGNAL, 0.5) * 0.04 * Lw;
      c += C_BONE * 0.16 * refl.a * fade * (0.5 + 0.5 * light);
      // the flame's own reflection, a broken streak on the wet floor under it
      float rx = abs(px.x - flamePx.x) / (flameH * 0.18);
      float streak = exp(-rx * rx) * step(0.0, flamePx.y - px.y + flameH * 0.05) * exp(-max(0.0, flamePx.y - px.y) / (flameH * 1.2));
      streak *= 0.55 + 0.45 * snoise(vec2(px.y / 5.0 + t * 3.0, px.x / 30.0));
      c += mix(C_SIGNAL, C_EMBER, 0.5) * 0.7 * streak * light;
      // the words themselves, bone, lit from below (brighter at the foot, warm where the flame is close)
      vec4 wd = texture(words, vUv);
      float grad = mix(1.0, 0.6, clamp((px.y - ground) / 300.0, 0.0, 1.0));
      vec3 face = C_BONE * (0.6 + 0.4 * grad) * (0.8 + 0.2 * light) + C_SIGNAL * 0.08 * Lw;
      c = mix(c, face, wd.a);
      fragColor = vec4(c, 1.0);
    }`, {
    words: { value: this.L.texture }, flameUv: { value: new THREE.Vector2() }, flamePx: { value: new THREE.Vector2() },
    flameH: { value: 90 }, light: { value: 1 }, k: { value: 2.2 }, soft: { value: 0.004 }, ground: { value: H - GROUND }, t: { value: 0 },
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
    // layout: the small words in a row above the ground, MONSTER standing big on the ground line
    const bigIdx = ws.findIndex((w) => /monster/i.test(w.w));
    const small = ws.slice(0, bigIdx), big = ws[bigIdx]!;
    const fS = F.archivo(100, 500), fB = this.n === 3 ? F.archivo(125, 900) : F.archivo(112.5, 900);
    const sizeS = 66;
    const bigText = big.w.toUpperCase().replace(/[,.]$/, '');
    const sizeB = Math.min(this.n === 3 ? 330 : 280, (W - 260) / (measure(bigText, fB, 100) / 100));
    const smallText = small.map((w) => w.w).join(' ');
    void smallText;
    let x = 120;
    const yS = 230;
    for (const w of small) {
      const lay = layout(w.w, fS, sizeS);
      this.words.push({ w, text: w.w, fam: fS, size: sizeS, x, base: yS, lay, big: false });
      x += lay.width + measure(' ', fS, sizeS);
    }
    const layB = layout(bigText, fB, sizeB);
    this.words.push({ w: big, text: bigText, fam: fB, size: sizeB, x: W / 2 - layB.width / 2, base: GROUND, lay: layB, big: true });
  }

  /** 0..1: a word stands up from the ground line as it is sung (a cut-out rising on its hinge). */
  private stand(p: Placed, t: number) {
    const a = p.w.start - (p.big ? 0.02 : 0.0);
    return p.big ? ease.outBack(prog(t, a, a + 0.22), 1.6) : ease.outCubic(prog(t, a, a + 0.16));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    if (this.n === 3) return this.render3(f, out);
    const { renderer, audio: au } = this.ctx;
    const t = f.t;
    const fl = flameState(au, t, 3);
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
      // green marks what casts a shadow: only the word standing on the ground (the question is only voiced)
      c.fillStyle = p.big ? 'rgb(255,255,255)' : 'rgb(255,0,255)';
      c.fillText(p.text, p.x, 0);
      c.restore();
    }
    L.upload();

    // the flame sways; the shadow is a lever: k grows as MONSTER is held
    const big = this.words[this.words.length - 1]!;
    const held = prog(t, big.w.start, big.w.end + 0.3);
    const sway = fl.gust * 26 + noise1(t * 2.3, 5) * 8;
    const fx = FLAME.x + sway, fy = FLAME.y;
    const k = lerp(1.8, 2.35, ease.inOutCubic(held)) + 0.05 * Math.sin(t * 9.1) * fl.h;
    // the ledger: the shadow measured against the figure that casts it
    const a = prog(t, big.w.start + 0.2, big.w.start + 0.5);
    if (a > 0) {
      c.save();
      c.font = font(F.mono(400), 13);
      c.letterSpacing = '2px';
      c.fillStyle = 'rgba(255,0,255,' + (0.55 * a).toFixed(3) + ')';
      c.textAlign = 'right';
      c.fillText(`SHADOW : FIGURE = ${k.toFixed(2)} : 1`, W - 120, GROUND + 34);
      c.fillText('LIGHT SOURCE 1 · OIL, OLIVE', W - 120, GROUND + 56);
      c.restore();
      L.upload();
    }
    const u = this.wall.u;
    (u.flameUv!.value as THREE.Vector2).set(fx / W, 1 - fy / H);
    (u.flamePx!.value as THREE.Vector2).set(fx, H - fy);
    u.flameH!.value = FLAME.h * fl.h; u.light!.value = fl.I; u.k!.value = k; u.soft!.value = 0.0018 + 0.0012 * fl.h; u.t!.value = t;
    this.wall.render(renderer, out);
    this.flame.draw(renderer, out, fx, fy, FLAME.h * fl.h, t, { seed: 3, gust: fl.gust, intensity: fl.I });

    const hit = pulse(t, big.w.start, 0.08);
    return { bloom: 0.65, bloomThreshold: 0.95, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.3, shake: [noise1(t * 60, 1) * 10 * hit, noise1(t * 60, 2) * 10 * hit] };
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

void clamp; void Lyrics;
