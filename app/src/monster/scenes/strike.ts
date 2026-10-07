// `strike` — the intro (0 → the first sung word). Black. The meander frame (the bookend, P(doom)'s crop marks'
// successor) draws itself round the frame as one endless line while the strings swell; a flint strikes on the
// low bass note and on each note of the rising figure that follows (sparks, darkness again), and the last
// strike catches: the flame is born at the bottom centre and the line (the horizon of every plate after this)
// runs out from it to both edges. The first frame matches the outro's last, so the video loops.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, W, H } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { LIN } from '../../engine/palette';
import { clamp, ease, hash, lerp, polylineLengths, pointAtLength, prog, smoothstep, TAU } from '../../engine/util';
import { sparkParticles } from '../../scenes/_motifs';
import { FlameSprite, flameState, GLSL_FLAME_LIGHT, meanderFrame } from '../motifs';

/** Where the flame stands from here on: the next plate picks it up at the same spot. */
export const FLAME_HOME = { x: W / 2, y: H * 0.78, h: 86 };
/** The bookend frame: inset and band height (logical px). */
export const FRAME_BOX = { inset: 40, band: 18 };

export default class Strike extends Scene {
  private bg = new FSPass(/* glsl */ `
    uniform vec2 base; uniform float h, light, strike, t;
    ${GLSL_FLAME_LIGHT}
    void main() {
      vec2 px = FRAG_PX;
      // the flame's light, and each strike's instant of light, pooled round the flame's foot
      float L = light * flameLight(px, base, h, 430.0) + strike * flameLight(px, base, 20.0, 260.0);
      // the ground below the line, receding to it: hairline strata closer together toward the horizon
      float below = base.y - px.y;                          // px under the horizon (y up)
      float ground = step(0.0, below);
      float z = 1.0 / max(below, 0.5);                      // ~ depth
      float strata = hatch(260.0 * z + 0.08 * snoise(vec2(px.x / (900.0 * z + 40.0), 260.0 * z * 0.25)), 0.16) * ground * smoothstep(0.5, 6.0, below);
      vec3 c = C_INK + mix(C_SIGNAL, C_EMBER, 0.4) * 0.035 * L + C_BONE * 0.28 * L * strata;
      fragColor = vec4(c, 1.0);
    }`, { base: { value: new THREE.Vector2() }, h: { value: 70 }, light: { value: 0 }, strike: { value: 0 }, t: { value: 0 } });
  private lines = new LineBatch(20000);
  private flame = new FlameSprite();
  private frame: { x: number; y: number }[][] = [];
  private frameL: Float32Array[] = [];
  /** strike times: the bass note, then the rising figure's notes; the last one catches */
  private strikes: number[] = [];
  private tCatch = 3.84;

  override init() {
    const au = this.ctx.audio, end = this.ctx.end;
    const hits = au.events('orch', 2.5, end - 0.05).map(([t]) => t);
    const bass = au.timeOfBeat(3); // the low note on beat 4 of the first bar
    this.strikes = [bass, ...hits].filter((t, i, a) => i === 0 || t - a[i - 1]! > 0.12);
    this.tCatch = this.strikes.length > 1 ? this.strikes[this.strikes.length - 2]! : 3.84;
    const { inset, band } = FRAME_BOX;
    this.frame = meanderFrame(inset, inset, W - 2 * inset, H - 2 * inset, band);
    this.frameL = this.frame.map((p) => polylineLengths(p));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio: au } = this.ctx;
    const t = f.t;
    const fl = flameState(au, t, 0, { voice: 0 });
    const born = prog(t, this.tCatch, this.tCatch + 0.5, ease.outCubic);
    const light = born * fl.I;
    const u = this.bg.u;
    (u.base!.value as THREE.Vector2).set(FLAME_HOME.x, H - FLAME_HOME.y);
    // each strike lights the ground for an instant
    let flash = 0;
    for (const ts of this.strikes) flash = Math.max(flash, t >= ts ? Math.pow(0.5, (t - ts) / 0.06) : 0);
    u.h!.value = FLAME_HOME.h; u.light!.value = light; u.strike!.value = 1.6 * flash * (1 - born); u.t!.value = t;
    this.bg.render(renderer, out);

    const lb = this.lines;
    lb.clear();
    // the meander frame: one line drawn round the frame with the swell, then held dim
    const draw = prog(t, 0.0, 2.6, ease.inOutCubic);
    const bone = LIN.bone;
    const a = 0.2 + 0.1 * light;
    const sides = this.frame.length;
    for (let s = 0; s < sides; s++) {
      const pts = this.frame[s]!, L = this.frameL[s]!;
      const total = L[L.length - 1]!;
      const k = clamp(draw * sides - s);
      if (k <= 0) continue;
      const len = total * k;
      let prev = pts[0]!;
      for (let i = 1; i < pts.length; i++) {
        if (L[i - 1]! >= len) break;
        const p = L[i]! <= len ? pts[i]! : pointAtLength(pts, L, len);
        lb.seg2(prev.x, prev.y, p.x, p.y, 1.2, bone, a);
        prev = p;
      }
      if (k < 1) {
        const head = pointAtLength(pts, L, len);
        lb.seg2(head.x, head.y, head.x + 0.01, head.y, 3, [bone[0] * 2, bone[1] * 2, bone[2] * 2], 0.8);
      }
    }
    // the line: born with the flame, running out to both edges along the ground
    const run = prog(t, this.tCatch + 0.05, this.ctx.end, ease.outExpo);
    if (run > 0) {
      const half = (W / 2 - 40) * run;
      const y = FLAME_HOME.y + 0.5;
      lb.seg2(FLAME_HOME.x - half, y, FLAME_HOME.x + half, y, 1.3, bone, 0.85);
    }
    // flint strikes: a short burst of sparks each, nothing caught until the last
    for (let i = 0; i < this.strikes.length; i++) {
      const ts = this.strikes[i]!;
      if (t < ts || t > ts + 0.7) continue;
      const head = (tb: number) => (tb >= ts && tb < ts + 0.06 ? { x: FLAME_HOME.x + (hash(i, 3) - 0.5) * 6, y: FLAME_HOME.y - 6 } : null);
      sparkParticles(lb, t, head, { rate: 900, life: 0.5, speed: 420 + 120 * hash(i, 5), gravity: 900, intensity: 1.2, seed: 17 + i * 13 });
    }
    lb.render(renderer, out);
    if (born > 0) {
      const h = FLAME_HOME.h * fl.h * lerp(0.25, 1, born);
      this.flame.draw(renderer, out, FLAME_HOME.x, FLAME_HOME.y, h, t, { seed: 1, gust: fl.gust * 0.5, intensity: fl.I * lerp(1.6, 1, born) });
    }
    return { bloom: 0.7, bloomRadius: 0.6, vignette: 0.45, grain: 0.06, ca: 0.8, halation: 0.3 };
  }
}

void TAU; void smoothstep;
