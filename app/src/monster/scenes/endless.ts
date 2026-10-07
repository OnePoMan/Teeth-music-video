// `endless` — verse 1, line 2: "How did suffering become so endless?" (docs/MONSTER.md, revision 1).
// From above: a Greek-key frieze cut in the cave floor, an inscription band over it, and one straight groove
// between them that the flame runs along like a fuse, burning behind it. "suffering" is burned into the band as
// the flame passes under each letter (never ahead of the voice). On "so" the camera corkscrews down behind the
// flame and races it along the line: "endless?" folds up out of the floor letter by letter, standing in a row to the
// horizon, each lit as the flame reaches it; the flame runs on to the vanishing point and the line burns behind it.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { F, font, layout } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, keys, lerp, prog, pulse, springStep } from '../../engine/util';
import { flameState, GLSL_KEY_DIST } from '../motifs';
import { Stage, StageCam, Word3D, drawPhrase } from '../stage';

/** Frieze geometry (world units): cell size; z of the flame's line, of the lower border; groove half-width. */
const C = 0.3, Z_LINE = -4.9 * C, Z_LOW = 0.9 * C, LINE_W = 0.06;
/** Inscription: baseline z, cap height (world), font. */
const INSC = { zBase: -5.9 * C, cap: 2.1 * C, fam: () => F.archivo(87.5, 800), px: 300 };
/** The hero word stands on the key band, letters this far apart, cap height. */
const HERO = { z: -2.0 * C, cap: 1.15, lead: 4.2, ratio: 1.32 };
/** Where the camera comes to rest (x relative to the hero's first letter, z): the letters turn to face it, and
 *  stand at distances growing by HERO.ratio from it, so each keeps its own place on screen as the row recedes. */
const REST = { dx: -3.4, z: -2.0 * C + 3.5, y: 1.35 };
const heroX = (xE: number, k: number) => xE + REST.dx - REST.dx * Math.pow(HERO.ratio, k);
const FLAME_H = 0.5;

const HOOKS = /* glsl */ `
${GLSL_KEY_DIST}
uniform float cellW, zLine, zLow, zTopB, lineW, flameX, trailL, revealX;
uniform sampler2D insc; uniform vec4 inscRect;
float meanderG(vec2 xz) {
  vec2 p = vec2(xz.x, -xz.y) / cellW;
  if (p.y < -0.6 || p.y > 4.6) return 0.0;
  float d = keyDist(vec2(mod(p.x, 5.0), p.y));
  float aa = gPix / cellW;
  return 1.0 - smoothstep(0.1 - aa, 0.24 + aa, d);
}
float inscM(vec2 xz) {
  vec2 uv = (xz - inscRect.xy) / (inscRect.zw - inscRect.xy);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return textureLod(insc, uv, 1.2).a;
}
float lineG(float z, float z0) { return 1.0 - smoothstep(lineW * 0.5 - gPix, lineW + gPix, abs(z - z0)); }
float carve(vec2 xz) {
  float g = max(meanderG(xz), max(lineG(xz.y, zLine), max(lineG(xz.y, zLow), lineG(xz.y, zTopB))));
  float m = inscM(xz);
  if (m > 0.0) g = max(g, smoothstep(0.25, 0.75, m) * smoothstep(0.02, -0.1, xz.x - revealX));
  // far away the grooves close up into the engraving's tone
  return g * (1.0 - smoothstep(0.03, 0.09, gPix));
}
float extraShadow(vec3 P, bool wall) { return 0.0; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  if (wall) return col;
  // the flame's line burns behind it like a fuse
  float onLine = 1.0 - smoothstep(lineW * 0.35, lineW * 1.1 + gPix, abs(P.z - zLine));
  float tr = exp(-max(flameX - P.x, 0.0) / trailL) * step(P.x, flameX) * onLine;
  col += mix(C_BLOOD, C_EMBER, tr) * tr * 1.4;
  // the inscription glows where it has just been burned in
  float m = smoothstep(0.3, 0.7, inscM(P.xz));
  col += C_EMBER * m * exp(-max(revealX - P.x, 0.0) / 0.45) * step(P.x, revealX + 0.02) * 0.9;
  return col;
}`;

export default class Endless extends Scene {
  private st!: Stage;
  private hero!: Word3D;
  private txt = new Layer2D();
  private line!: Line;
  private inscW = 1;
  private insc!: THREE.CanvasTexture;

  override async init() {
    // the inscription, as a mask on the floor
    const fam = INSC.fam(), px = INSC.px;
    const lay = layout('SUFFERING', fam, px, px * 0.04);
    const cap = px * 0.7, pad = Math.round(px * 0.25), k = INSC.cap / cap;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(lay.width + pad * 2); cv.height = Math.ceil(cap + pad * 2);
    const c = cv.getContext('2d')!;
    c.font = font(fam, px); c.letterSpacing = `${px * 0.04}px`; c.fillStyle = '#fff'; c.textBaseline = 'alphabetic';
    c.fillText('SUFFERING', pad, pad + cap);
    this.insc = new THREE.CanvasTexture(cv);
    this.insc.flipY = false; this.insc.colorSpace = THREE.NoColorSpace;
    this.insc.generateMipmaps = true; this.insc.minFilter = THREE.LinearMipmapLinearFilter;
    this.inscW = lay.width * k;
    const zTop = INSC.zBase - (pad + cap) * k, zBot = INSC.zBase + pad * k;
    this.st = new Stage({
      hooks: HOOKS,
      uniforms: {
        cellW: { value: C }, zLine: { value: Z_LINE }, zLow: { value: Z_LOW }, zTopB: { value: INSC.zBase - INSC.cap - 1.0 * C }, lineW: { value: LINE_W },
        flameX: { value: 0 }, trailL: { value: 2 }, revealX: { value: -99 },
        insc: { value: this.insc }, inscRect: { value: new THREE.Vector4(-pad * k, zTop, (cv.width - pad) * k, zBot) },
      },
    });
    this.hero = new Word3D('ENDLESS?', F.archivo(75, 900), { size: 220 });
    this.st.add(this.hero);
    this.line = this.ctx.lyrics.get('How did suffering');
  }

  private w(s: string): Word {
    return this.line.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, comp, audio } = this.ctx;
    const [how, did] = this.line.words as [Word, Word];
    const suf = this.w('suffering'), become = this.w('become'), so = this.w('so'), endless = this.w('endless');
    const T0 = this.ctx.start, T1 = this.ctx.end;
    const tilt0 = audio.nearestBeat(so.start - 0.1), tilt1 = tilt0 + 0.62;
    const W0 = this.inscW, xE = W0 + HERO.lead, xLast = heroX(xE, 7);
    const nH = this.hero.letters.length;
    const tk = (k: number) => endless.start + (k / (nH - 1)) * Math.max(0.3, endless.end - endless.start - 0.05);

    // ---- the flame along its line: under the inscription with the voice, then racing the hero word
    const fx = keys(t, [
      [T0, -3.2], [suf.start, -0.05, ease.linear], [suf.end, W0 + 0.05, ease.linear], [so.start, W0 + 1.6, ease.outQuad],
      [endless.start, xE - 1.2, ease.inQuad],
      // through the row: reaching each letter just after it stands
      ...Array.from({ length: nH }, (_, k) => [tk(k) + 0.07, heroX(xE, k) + 0.3, ease.linear] as [number, number, (u: number) => number]),
      [T1, xLast + 40, ease.outQuad],
    ]);
    const fl = flameState(audio, t, 3);
    const base = new THREE.Vector3(fx, 0, Z_LINE);
    const reveal = t < suf.start ? -99 : Math.min(fx, W0 + 1);
    const race = prog(t, tilt0, endless.start + 0.2);
    const u = this.st.bg.u;
    u.flameX!.value = fx; u.revealX!.value = reveal;
    u.trailL!.value = lerp(1.6, 14, race);

    // ---- the hero word: ENDLESS? folds up letter by letter as sung, in a row along the frieze, facing back
    const hw = this.hero, s = HERO.cap / hw.cap;
    for (let k = 0; k < nH; k++) {
      const l = hw.letters[k]!, t0 = tk(k);
      l.x = heroX(xE, k); l.z = HERO.z; l.y = 0; l.s = s;
      l.yaw = Math.atan2(xE + REST.dx - l.x, REST.z - l.z);
      l.on = t >= t0 - 0.02 ? 1 : 0;
      l.hinge = (Math.PI / 2) * (1 - springStep(t - t0, 2.6, 0.42));
      l.mat.uniforms.glow!.value = 0.25 * pulse(t, t0, 0.15) * l.on;
      l.mat.uniforms.amb!.value = 0.16 * prog(t, t0 + 0.25, t0 + 0.8) * l.on;
    }
    hw.update();

    // ---- the camera: overhead, tracking the burn; a corkscrew down behind the flame on "so"; racing; braking
    const xc = keys(t, [[T0, -1.6], [suf.start, 0.4, ease.inOutQuad], [suf.end, W0 - 0.5, ease.linear], [tilt0, W0 + 0.8, ease.outQuad]]);
    const posA = new THREE.Vector3(xc, 4.4, -1.4), atA = new THREE.Vector3(xc, 0, -1.4);
    // after the corkscrew the camera hangs back behind the word and eases to a stop; the flame runs on alone
    const camX = keys(t, [[tilt0, W0 + 0.8], [tilt1, xE - 6.4, ease.inOutCubic], [endless.end, xE - 4.3, ease.linear], [T1, xE + REST.dx, ease.outCubic]]);
    const posB = new THREE.Vector3(camX, REST.y, REST.z), atB = new THREE.Vector3(camX + 10, 0.25, REST.z - 4.6);
    const u2 = prog(t, tilt0, tilt1, ease.inOutCubic);
    const q = StageCam.look(posA, atA, { x: 0, y: 0, z: -1 }).slerp(StageCam.look(posB, atB), u2);
    const pos = posA.clone().lerp(posB, u2);
    this.st.cam.setQ(pos, q, lerp(35, 42, u2));

    const reach = lerp(4.2, 7.5, race);
    this.st.render(renderer, out, t, { base, h: FLAME_H * fl.h, I: fl.I * 1.1, reach }, { wall: 0, freqFloor: 9 },
      { gust: fl.gust * 0.5 - 0.9 * race * (1 - prog(t, endless.end, T1)), rim: 1.2, flameBehind: u2 > 0.5 });

    // ---- the small voice
    const c = this.txt.ctx;
    this.txt.clear();
    drawPhrase(c, [how, did], t, 160, 990, { exit: prog(t, suf.start + 0.25, suf.start + 0.5) });
    drawPhrase(c, [become, so], t, 160, 990, { exit: prog(t, endless.start, endless.start + 0.25) });
    comp.draw(renderer, this.txt.upload(), out);

    return { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6 + 0.8 * race * (1 - prog(t, endless.end, T1)), halation: 0.35 };
  }
}
