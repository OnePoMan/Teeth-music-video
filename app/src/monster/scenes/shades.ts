// `shades` — verse 1b, the land of the dead (docs/MONSTER.md). It opens on `questions`' last frame (the flame on
// the ground, the camera low, the line split at the vanishing point) and ends on hook 1's first (the shore, the
// lamp afloat at the left).
//   "I'm surrounded by the souls of those I've lost": the camera cranes on up; a shadow falls across the lit
//      ground beyond the flame on each word, long and human, radiating from the flame, and nobody casts it. They
//      waver with the flame and stretch when it dips.
//   "I'm the only one whose line I haven't crossed": on "line" a line is drawn in the dust at the shadows' feet
//      (every one of them lies beyond it) while the split horizon heals.
//   "What if the greatest threat we'll find across the sea": his side of the line turns to black water, from the
//      line toward the camera; the flame sits into its clay lamp and floats; the camera sinks to the water and
//      the far shore with its shadows flattens into the line, which is now the waterline; on "across the sea"
//      the lamp drifts left.
//   "Is me?": the water holds still. Cut to hook 1 on the beat.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, W, H } from '../../engine/gl';
import { F, font } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { clamp, ease, lerp, noise1, prog, smoothstep } from '../../engine/util';
import { FlameSprite, flameState, drawLamp2D, lampFlame, LAMP_BODY, GLSL_KEY_DIST, layoutVerse, drawVerse, type VerseRow, type FlameState } from '../motifs';
import { FOCAL, Z_FLAME, Q_END } from './questions';
import { WL0, LAMP } from './hook';

/** The line in the dust lies this far along the ground (the flame stands at Z_FLAME, the shadows beyond). */
const Z_LINE = 10.0;
/** The camera at the top of its crane (height, horizon y). */
// (the horizon stays under the lyrics all the way up)
const CAM_UP = { camH: 3.4, yh: 410 };
/** Ground light reach (ground units) when the shades are lit, and in `questions`. */
const REACH = 6.0, REACH_Q = 3.2;

/**
 * The shades: feet just beyond the line at x (ground units, + right), dz past it; a shadow L long; ws: shoulder
 * half-width at the feet; kind 0 stands in a tunic to mid-thigh, 1 without; v varies the build and the stance.
 * One falls on each word of the line. (The ones that point away from the camera are longer: foreshortening.)
 */
const SHADES = [
  { x: 2.3, dz: 0.35, L: 8.2, ws: 0.25, kind: 0, v: 0.31 },
  { x: -1.7, dz: 0.55, L: 8.6, ws: 0.24, kind: 1, v: 0.72 },
  { x: 5.0, dz: 0.25, L: 7.6, ws: 0.27, kind: 1, v: 0.12 },
  { x: -3.9, dz: 0.3, L: 7.8, ws: 0.25, kind: 0, v: 0.55 },
  { x: 0.9, dz: 0.8, L: 9.4, ws: 0.23, kind: 1, v: 0.9 },
  { x: -6.4, dz: 0.35, L: 7.4, ws: 0.27, kind: 1, v: 0.43 },
  { x: 3.6, dz: 0.7, L: 8.0, ws: 0.24, kind: 1, v: 0.66 },
  { x: -2.7, dz: 0.95, L: 8.4, ws: 0.26, kind: 1, v: 0.2 },
  { x: -0.6, dz: 1.15, L: 9.8, ws: 0.24, kind: 0, v: 0.84 },
];
const NS = SHADES.length;

/** Integral of a smooth plateau (0 → 1 over a..b, 1 until c, → 0 over c..d) from -∞ to x. */
function plateauInt(x: number, a: number, b: number, c: number, d: number) {
  const I = (u: number) => u * u * u - (u * u * u * u) / 2; // ∫ smoothstep
  let s = (b - a) * I(clamp((x - a) / (b - a)));
  s += clamp(x - b, 0, c - b);
  if (x > c) { const u = clamp((x - c) / (d - c)); s += (d - c) * (u - I(u)); }
  return s;
}

interface VLine { line: Line; rows: VerseRow[]; t0: number; t1: number }

export default class Shades extends Scene {
  private L = new Layer2D();
  private flame = new FlameSprite();
  private vl: VLine[] = [];
  private T = { craneEnd: 0, frontA: 0, frontB: 0, sinkA: 0, sinkB: 0, driftA: 0, driftB: 0, lamp: 0, endless: 0, bankA: 0, holdA: 0, holdB: 0, holdC: 0, holdD: 0, bank: 0 };
  private wLine!: Word;
  private wSea!: Word;
  private shA = Array.from({ length: NS }, () => new THREE.Vector4());
  private shB = Array.from({ length: NS }, () => new THREE.Vector4());
  private bg = new FSPass(/* glsl */ `
    #define NS ${NS}
    uniform float yh, camH, light, reach, tintK, meanderA, scroll, split, horizonA, lineY, lineHalf, farLight, frontY, tw, colA, airK, lampH;
    uniform vec2 flameScr, lamp;
    uniform vec4 shA[NS];   // per shade: angle, distance of the feet, length, shoulder half-width at the feet (ground units)
    uniform vec4 shB[NS];   // per shade: grown 0..1, opacity, kind, variant
    ${GLSL_KEY_DIST}
    float sdTrap(vec2 p, float r1, float r2, float he) {
      vec2 k1 = vec2(r2, he), k2 = vec2(r2 - r1, 2.0 * he);
      p.x = abs(p.x);
      vec2 ca = vec2(p.x - min(p.x, (p.y < 0.0) ? r1 : r2), abs(p.y) - he);
      vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
      float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
      return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
    }
    float sdCap(vec2 p, vec2 a, vec2 b, float r) { return sdSegment(p, a, b) - r; }
    // a standing figure, 1 tall (feet at y = 0), shoulders at x = ±0.125; kind 0 wears a tunic to mid-thigh;
    // v (0..1) varies the stance, the arms and the head
    float figureSD(vec2 p, float kind, float v) {
      vec2 q = vec2(abs(p.x), p.y);
      float spread = mix(0.045, 0.085, fract(v * 3.7));            // feet apart
      float hand = mix(0.13, 0.17, fract(v * 7.3));                 // arms hang close or a little away
      float hs = mix(0.95, 1.12, fract(v * 5.1));                   // head size
      float head = (length((p - vec2(0.0, 0.915)) / (vec2(0.062, 0.072) * hs)) - 1.0) * 0.062 * hs;
      float neck = sdCap(p, vec2(0.0, 0.82), vec2(0.0, 0.86), 0.034);
      float torso = sdTrap(p - vec2(0.0, 0.655), 0.092, 0.12, 0.145) - 0.014;
      float arm = sdCap(q, vec2(0.112, 0.775), vec2(hand, 0.47), 0.03);
      float legs = min(sdCap(q, vec2(0.052, 0.5), vec2(mix(0.052, spread, 0.5), 0.26), 0.048),
                       sdCap(q, vec2(mix(0.052, spread, 0.5), 0.26), vec2(spread, 0.03), 0.036));
      float d = smin(torso, legs, 0.03);
      if (kind < 0.5) d = min(d, sdTrap(p - vec2(0.0, 0.47), 0.13, 0.1, 0.09) - 0.008);   // the tunic
      d = smin(d, arm, 0.02);
      d = smin(d, neck, 0.025);
      return smin(d, head, 0.02);
    }
    void main() {
      vec2 px = vec2(FRAG_PX.x, ${H.toFixed(1)} - FRAG_PX.y);       // logical px, y DOWN
      vec3 c = C_INK;
      float d = px.y - yh;                                           // px below the horizon
      // the ground (computed everywhere so its derivatives stay valid; used below the horizon)
      float dd = max(d, 0.5);
      float z = ${FOCAL.toFixed(1)} * max(camH, 1e-5) / dd;
      float xg = (px.x - ${(W / 2).toFixed(1)}) * max(camH, 1e-5) / dd;
      vec2 rel = vec2(xg, z - ${Z_FLAME.toFixed(1)});
      float r = max(length(rel), 1e-4);
      float th = atan(rel.y, rel.x);                                 // 0 = to the right, PI/2 = straight away
      float dr = fwidth(r);
      // (angle footprint from the derivatives of rel: atan wraps behind the flame)
      vec2 rx = dFdx(rel), ry = dFdy(rel);
      float dth = length(vec2(rel.x * rx.y - rel.y * rx.x, rel.x * ry.y - rel.y * ry.x)) / (r * r);
      // the strata (questions' ground joints), kept at one density on screen as the camera rises: each octave's
      // in-between lines fade in as the height doubles
      float oct = log2(max(camH, 0.05) / ${Q_END.camH.toFixed(2)});
      float n0 = floor(oct), fr = oct - n0, f0 = 1.1 * exp2(n0);
      float strata = max(hatch(z * f0, 0.035), fr * hatch(z * f0 * 2.0, 0.035));
      float Lg = light / (1.0 + pow(r / reach, 2.0));
      bool ground = d > 0.5 && camH > 1e-4;
      bool far = z > ${Z_LINE.toFixed(1)};
      // the flame's light in the air (questions'), becoming the lamp's mist over the water (hook's)
      float flA = light * exp(-length((px - flameScr) * vec2(1.0, 1.5)) / 520.0);
      float glow = light * exp(-length((px - lamp) * vec2(1.0, 1.6)) / 300.0);
      vec3 warm = mix(C_BLOOD, C_SIGNAL, 0.5);
      bool water = px.y > lineY && px.y < frontY && lineHalf > 0.0;
      if (!water) c += warm * mix(0.035 * flA, 0.05 * glow, airK);
      if (ground && !water) {
        // the shades: a shadow on the lit ground, no one casting it
        float sh = 0.0, fringe = 0.0;
        if (far) for (int i = 0; i < NS; i++) {
          vec4 A = shA[i], B = shB[i];
          if (B.y <= 0.0) continue;
          float g = max(B.x, 1e-3);
          float u = (r - A.y) / (A.z * g);                          // 0 at the feet, 1 at the head; grows from the feet
          if (u < -0.04 || u > 1.04) continue;
          float hw = A.w * (1.0 + 0.35 * (r - A.y) / A.y);           // shoulder half-width there (widens away from the light)
          float b = (th - A.x) * r / hw * 0.125;                      // across, in body units
          if (abs(b) > 0.3) continue;
          float sd = figureSD(vec2(b, u), B.z, B.w);
          float aa = length(vec2(dr / (A.z * g), dth * r / hw * 0.125)) + 0.004 + 0.018 * clamp(u, 0.0, 1.0);
          float cov = (1.0 - smoothstep(-aa, aa, sd)) * B.y;
          sh = max(sh, cov);
          fringe = max(fringe, cov * (1.0 - cov) * 4.0 * B.y);
        }
        float lit = Lg * (far ? farLight : 1.0);
        float Ls = lit * (1.0 - sh);
        float st = strata * smoothstep(1.0, 8.0, d) * smoothstep(mix(0.06, 0.02, tintK), mix(0.3, 0.16, tintK), lit);
        c += C_BONE * 0.13 * st * Ls;
        // the dust the light falls on: a dim warm tone, so a shadow reads as a shape and not only as gaps in the lines
        c += mix(C_ASH, C_EMBER, 0.55) * 0.022 * tintK * Ls * smoothstep(0.5, 3.0, d);
        c += C_BLOOD * 0.03 * fringe * lit;
        // the meander, still running from the viewer's feet through the flame (questions'), fading out
        if (meanderA > 0.0) {
          float bw = 0.62;
          float bb = (xg / (2.0 * bw) + 0.5) * 4.0;
          float cell = 2.0 * bw / 4.0;
          float zn = 1.5;
          float a = (z - zn) / cell + scroll;
          float fw = fwidth(a) + fwidth(bb);
          if (z > zn && (z - zn) / cell < 160.0 && bb > -1.2 && bb < 5.2) {
            float uu = mod(a, 5.0);
            float dk = min(keyDist(vec2(uu, bb)), keyDist(vec2(uu - 5.0, bb)));
            dk = min(dk, min(abs(bb + 0.9), abs(bb - 4.9)));
            float ink = 1.0 - smoothstep(0.075 - fw, 0.075 + fw, dk);
            ink *= 1.0 - smoothstep(0.35, 0.9, fw);
            float fade = smoothstep(160.0, 154.0, (z - zn) / cell);
            c += C_BONE * 0.42 * ink * fade * clamp(Lg * 1.5 + 0.13, 0.0, 1.0) * meanderA;
          }
        }
      }
      if (water) {
        // hook 1's water: black, engraved with ripple hairlines that catch the lamp's light, the lamp's column
        vec2 pu = FRAG_PX;                                            // y up, as in hook.ts
        vec2 lu = vec2(lamp.x, ${H.toFixed(1)} - lamp.y);
        float depth = px.y - lineY;
        float band = sin(depth * 0.21 - tw * 1.7 + 0.6 * snoise(vec2(pu.x / 260.0, tw * 0.35)));
        float dx = (0.6 + depth * 0.022) * (0.65 * band + 0.35 * snoise(vec2(pu.x / 90.0, depth / 14.0 - tw * 0.8))) * smoothstep(0.0, 24.0, depth);
        float rl = hatch(depth / 9.0 + 0.6 * snoise(vec2(pu.x / 300.0, depth / 40.0 + tw * 0.2)), 0.12) * smoothstep(1.5, 6.0, depth);
        vec3 wc = C_INK + C_BONE * 0.10 * rl * (0.07 + 1.7 * glow);
        float col = exp(-pow((pu.x + dx * 1.5 - lu.x) / (lampH * 0.22), 2.0)) * exp(-max(0.0, lu.y - pu.y) / (lampH * 2.6));
        col *= smoothstep(-0.2, 0.6, band);
        wc += mix(C_SIGNAL, C_EMBER, 0.45) * 0.85 * col * light * step(pu.y, lu.y) * colA;
        // (the front: the last of the lit ground going under)
        float edge = smoothstep(frontY - 26.0, frontY, px.y);
        c = mix(wc + warm * 0.035 * flA * (1.0 - airK), c, edge);
      }
      // the horizon, split at the vanishing point; it heals on "line" and sinks into the line as the camera does
      float gap = split * ${Q_END.gap.toFixed(1)};
      float onH = 1.0 - smoothstep(0.6, 1.4, abs(px.y - yh) * PX_SCALE);
      float inGap = smoothstep(gap - 2.0, gap, abs(px.x - ${(W / 2).toFixed(1)}) * 2.0);
      c = mix(c, C_BONE * 0.8, onH * (split > 0.0 ? inGap : 1.0) * 0.8 * horizonA);
      // the line in the dust (it becomes the waterline)
      float drawn = 1.0 - smoothstep(lineHalf - 2.0, lineHalf, abs(px.x - ${(W / 2).toFixed(1)}));
      c = mix(c, C_BONE * 0.8, pxLine(abs(px.y - lineY) * PX_SCALE, 0.6, 1.4) * 0.75 * drawn);
      fragColor = vec4(c, 1.0);
    }`, {
    yh: { value: Q_END.yh }, camH: { value: Q_END.camH }, light: { value: 1 }, reach: { value: REACH_Q }, tintK: { value: 0 }, meanderA: { value: 1 },
    scroll: { value: 0 }, split: { value: 1 }, horizonA: { value: 1 }, lineY: { value: 0 }, lineHalf: { value: 0 }, farLight: { value: 1 },
    frontY: { value: 0 }, tw: { value: 0 }, colA: { value: 0 }, airK: { value: 0 }, lampH: { value: LAMP.h },
    flameScr: { value: new THREE.Vector2() }, lamp: { value: new THREE.Vector2() },
    shA: { value: this.shA }, shB: { value: this.shB },
  });

  override init() {
    const ly = this.ctx.lyrics, au = this.ctx.audio, { start, end } = this.ctx;
    const lines = ["I'm surrounded", 'whose line', 'greatest threat', 'Is me'].map((q) => ly.get(q));
    this.vl = lines.map((line) => ({ line, rows: layoutVerse(line), t0: line.words[0]!.start - 0.4, t1: 0 }));
    // (a line clears before the next one is anticipated in the same place)
    for (let i = 0; i < this.vl.length; i++) this.vl[i]!.t1 = i + 1 < this.vl.length ? this.vl[i + 1]!.t0 - 0.35 : end - 0.6;
    const [l4, l5, l6, l7] = lines as [Line, Line, Line, Line];
    this.wLine = l5.words.find((w) => /^line/i.test(w.w))!;
    this.wSea = l6.words[l6.words.length - 1]!;
    const across = l6.words.find((w) => /across/i.test(w.w))!;
    const beat = (t: number) => au.timeOfBeat(Math.round(au.beatAt(t)));
    const T = this.T;
    // the crane comes to rest on the downbeat under "only"; the camera sinks over the bar from "greatest"
    T.craneEnd = beat(l5.words[2]!.start);
    T.frontA = l6.words[0]!.start; T.frontB = l6.words.find((w) => /find/i.test(w.w))!.start;
    T.sinkA = au.timeOfBeat(Math.ceil(au.beatAt(T.frontA) / 4) * 4); T.sinkB = T.sinkA + 4 * (au.timeOfBeat(1) - au.timeOfBeat(0));
    T.driftA = across.start - 0.4; T.driftB = across.start + 2.3;
    // the water holds still on "Is me?" and runs a little fast during the sink to bank the time it stands still,
    // so it is back in step with hook 1's water at the cut
    T.holdA = l7.words[0]!.start - 0.4; T.holdB = l7.words[0]!.start; T.holdC = l7.end; T.holdD = l7.end + 0.3;
    T.bankA = T.sinkA;
    const held = plateauInt(1e9, T.holdA, T.holdB, T.holdC, T.holdD);
    const banked = plateauInt(1e9, T.bankA, T.bankA + 0.5, T.holdA - 0.9, T.holdA - 0.4);
    T.bank = held / banked;
    // the flame sits into its lamp when the water reaches it
    T.lamp = T.frontB;
    for (let t = T.frontA; t < T.frontB; t += 1 / 240) if (this.frontY(t) >= this.flameGroundY(t)) { T.lamp = t; break; }
    const q2 = ly.get('How did suffering');
    T.endless = q2.words.find((w) => /endless/i.test(w.w))!.start;
    void start; void l4;
  }

  /** The camera: height and horizon y at t. */
  private cam(t: number) {
    const up = ease.inOutCubic(prog(t, this.ctx.start + 0.15, this.T.craneEnd));
    const down = ease.inOutCubic(prog(t, this.T.sinkA, this.T.sinkB));
    return { camH: lerp(lerp(Q_END.camH, CAM_UP.camH, up), 0, down), yh: lerp(lerp(Q_END.yh, CAM_UP.yh, up), WL0, down) };
  }
  private lineY(t: number) { const k = this.cam(t); return k.yh + (FOCAL * k.camH) / Z_LINE; }
  private flameGroundY(t: number) { const k = this.cam(t); return k.yh + (FOCAL * k.camH) / Z_FLAME; }
  /** The water's front, from the line down to below the frame (it speeds up as it nears the camera). */
  private frontY(t: number) {
    const k = prog(t, this.T.frontA, this.T.frontB);
    return k <= 0 ? -1 : lerp(this.lineY(t), H + 60, ease.inQuad(k));
  }
  /** The water's own time: it runs a little fast during the sink and stands still on "Is me?". */
  private tw(t: number) {
    const T = this.T;
    return t + T.bank * plateauInt(t, T.bankA, T.bankA + 0.5, T.holdA - 0.9, T.holdA - 0.4) - plateauInt(t, T.holdA, T.holdB, T.holdC, T.holdD);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio: au } = this.ctx;
    const t = f.t, T = this.T;
    const { camH, yh } = this.cam(t);
    const lineY = this.lineY(t);
    const tw = this.tw(t);
    // ---- the flame: `questions`' (guttered, seed 1) recovering, then hook 1's (seed 3, in its lamp)
    const drift = ease.inOutCubic(prog(t, T.driftA, T.driftB));
    const f0 = flameState(au, t, 0), f3 = flameState(au, t, 3);
    const fl: FlameState = { h: lerp(f0.h, f3.h, drift), I: lerp(f0.I, f3.I, drift), gust: lerp(f0.gust * 0.5, f3.gust * 0.6, drift) };
    const g = lerp(Q_END.gutter, 1, ease.inOutCubic(prog(t, this.ctx.start, this.ctx.start + 1.2)));
    const I = fl.I * g;
    const hgt = lerp(86, LAMP.h, drift) * fl.h * lerp(0.45, 1, g);
    const lampA = smoothstep(T.lamp, T.lamp + 0.35, t);
    const bob = (Math.sin(tw * 1.9) * 2.5 + noise1(tw * 0.7, 9) * 2) * lampA;
    const home = lampFlame(LAMP.x + noise1(tw * 0.4, 13) * 6, WL0 + LAMP.dy);
    const fx = lerp(W / 2, home.x, drift), fy = lerp(this.flameGroundY(t), home.y, drift) + bob;
    const body = { x: fx - LAMP_BODY.w * LAMP_BODY.nozzle.x, y: fy - LAMP_BODY.h * LAMP_BODY.nozzle.y };

    // ---- the shades
    const l4 = this.vl[0]!.line;
    const farLight = 1 - smoothstep(T.sinkA + 0.2, T.sinkB - 0.3, t);
    for (let i = 0; i < NS; i++) {
      const s = SHADES[i]!, w = l4.words[Math.min(i, l4.words.length - 1)]!;
      const zf = Z_LINE + s.dz;
      const R = Math.hypot(s.x, zf - Z_FLAME);
      const th0 = Math.atan2(zf - Z_FLAME, s.x);
      // they swing against the flame's lean, each breathing a little on its own; a dipping flame stretches them
      const th = th0 + (0.1 * fl.gust * Math.sin(th0)) / R + 0.006 * noise1(t * 0.45, 31 + i);
      const L = s.L * (1 + 0.3 * (1 - fl.h));
      const grow = ease.outCubic(prog(t, w.start - 0.05, w.start + 0.55));
      const a = smoothstep(w.start - 0.05, w.start + 0.2, t) * farLight;
      this.shA[i]!.set(th, R, L, s.ws);
      this.shB[i]!.set(Math.max(0.05, grow), a, s.kind, s.v);
    }

    const u = this.bg.u;
    u.yh!.value = yh; u.camH!.value = camH; u.light!.value = I;
    u.reach!.value = lerp(REACH_Q, REACH, ease.inOutCubic(prog(t, this.ctx.start, l4.words[2]!.start)));
    u.tintK!.value = smoothstep(this.ctx.start, l4.words[1]!.start, t);
    u.meanderA!.value = 1 - smoothstep(this.ctx.start, this.ctx.start + 1.3, t);
    u.scroll!.value = Math.max(0, t - T.endless) * 1.6;
    u.split!.value = 1 - ease.inOutCubic(prog(t, this.wLine.start - 0.05, this.wLine.end + 0.25));
    u.horizonA!.value = smoothstep(1.5, 12, lineY - yh);
    u.lineY!.value = lineY;
    u.lineHalf!.value = (W / 2 + 4) * ease.inOutCubic(prog(t, this.wLine.start - 0.05, this.wLine.end + 0.1));
    u.farLight!.value = farLight;
    u.frontY!.value = this.frontY(t);
    u.tw!.value = tw;
    u.colA!.value = lampA;
    u.airK!.value = ease.inOutCubic(prog(t, T.frontA, T.sinkB));
    u.lampH!.value = hgt;
    (u.flameScr!.value as THREE.Vector2).set(fx, fy);
    (u.lamp!.value as THREE.Vector2).set(body.x, body.y);
    this.bg.render(renderer, out);

    // ---- the lamp, the words, the ledger
    const L = this.L; L.clear();
    const c = L.ctx;
    if (lampA > 0) drawLamp2D(c, body.x, body.y, lampA);
    for (const v of this.vl) {
      const fo = v === this.vl[this.vl.length - 1] ? 0.6 : 0.3;
      if (t < v.t0 || t >= v.t1 + fo) continue;
      drawVerse(c, v.rows, t, 1 - smoothstep(v.t1, v.t1 + fo, t));
    }
    const la = smoothstep(this.wLine.end - 0.1, this.wLine.end + 0.3, t) * (1 - smoothstep(this.wSea.start, this.wSea.end + 0.4, t));
    if (la > 0) {
      c.save();
      c.font = font(F.mono(400), 12);
      c.letterSpacing = '2px';
      c.textAlign = 'right';
      c.fillStyle = `rgba(238,233,223,${(0.42 * la).toFixed(3)})`;
      c.fillText('LINE', W - 96, lineY - 10);
      c.restore();
    }
    this.ctx.comp.draw(renderer, L.upload(), out);
    this.flame.draw(renderer, out, fx, fy, hgt, t, { seed: lerp(1, 3, drift), gust: fl.gust, intensity: I });

    const k = ease.inOutCubic(prog(t, T.sinkA, T.sinkB));
    return { bloom: lerp(0.65, 0.62, k), bloomThreshold: 0.95, vignette: lerp(0.45, 0.5, k), grain: 0.06, ca: lerp(0.6, 0.55, k), halation: 0.3 };
  }
}
