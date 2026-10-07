// `endless` — verse 1, line 2: "How did suffering become so endless?" (docs/MONSTER.md, revision 1).
// From above: a Greek-key frieze cut in the cave floor, an inscription band over it, and one straight groove
// between them that the flame runs along like a fuse, burning behind it. "suffering" is burned into the band as
// the flame passes under each letter (never ahead of the voice). On "so" the camera corkscrews down behind the
// flame and races it along the line: "endless?" folds up out of the floor letter by letter, standing in a row to the
// horizon, each lit as the flame reaches it; the flame runs on to the vanishing point and the line burns behind it.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F, font, layout } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, keys, lerp, prog, pulse } from '../../engine/util';
import { flameState, GLSL_KEY_DIST } from '../motifs';
import { Stage, StageCam, Word3D, popHinge } from '../stage';

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
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) { return 0.0; }
vec3 skyTint(vec3 D, vec3 col) { return col; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  if (wall) return col;
  // the flame's line burns behind it like a fuse
  float onLine = 1.0 - smoothstep(lineW * 0.35, lineW * 1.1 + gPix, abs(P.z - zLine));
  float tr = exp(-max(flameX - P.x, 0.0) / trailL) * step(P.x, flameX) * onLine;
  col += mix(C_BLOOD, C_EMBER, tr) * tr * 1.4;
  // the inscription glows where it has just been burned in
  float m = smoothstep(0.3, 0.7, inscM(P.xz));
  // ...and keeps a cooling ember glow, so the burned words stay readable behind the flame
  float dxb = max(revealX - P.x, 0.0);
  col += mix(C_BLOOD, C_EMBER, exp(-dxb / 1.2)) * m * (0.3 + 0.75 * exp(-dxb / 0.6)) * step(P.x, revealX + 0.02);
  return col;
}`;

export default class Endless extends Scene {
  private st!: Stage;
  private hero!: Word3D;
  private line!: Line;
  private inscW = 1;
  private insc!: THREE.CanvasTexture;

  /** Each burned word's x range on the floor (world), in sung order. */
  private wx: { x0: number; x1: number }[] = [];

  override async init() {
    this.line = this.ctx.lyrics.get('How did suffering');
    const ws = this.line.words;
    // the inscription: the whole line but its last word, burned along the band in two voices (SUFFERING the
    // heavy one), as a mask on the floor
    const px = INSC.px, cap = px * 0.7, pad = Math.round(px * 0.25), k = INSC.cap / cap;
    const runs = ws.slice(0, -1).map((w) => {
      const hero = w.w.toLowerCase().startsWith('suffering');
      const fam = hero ? INSC.fam() : F.archivo(112.5, 600), size = hero ? px : px * 0.78;
      const text = hero ? w.w.toUpperCase() : w.w.toLowerCase();
      return { text, fam, size, w: layout(text, fam, size, size * 0.03).width };
    });
    const gap = px * 0.42;
    const total = runs.reduce((a, r) => a + r.w, 0) + gap * (runs.length - 1);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(total + pad * 2); cv.height = Math.ceil(cap + pad * 2);
    const c = cv.getContext('2d')!;
    c.fillStyle = '#fff'; c.textBaseline = 'alphabetic';
    let x = pad;
    for (const r of runs) {
      c.font = font(r.fam, r.size); c.letterSpacing = `${r.size * 0.03}px`;
      c.fillText(r.text, x, pad + cap);
      this.wx.push({ x0: (x - pad) * k, x1: (x - pad + r.w) * k });
      x += r.w + gap;
    }
    this.insc = new THREE.CanvasTexture(cv);
    this.insc.flipY = false; this.insc.colorSpace = THREE.NoColorSpace;
    this.insc.generateMipmaps = true; this.insc.minFilter = THREE.LinearMipmapLinearFilter;
    this.inscW = total * k;
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
  }

  private w(s: string): Word {
    return this.line.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const ws = this.line.words;
    const suf = this.w('suffering'), so = this.w('so'), endless = this.w('endless');
    const T0 = this.ctx.start, T1 = this.ctx.end;
    const tilt0 = audio.nearestBeat(so.start - 0.1), tilt1 = tilt0 + 0.62;
    const W0 = this.inscW, xE = W0 + HERO.lead, xLast = heroX(xE, 7);
    const nH = this.hero.letters.length;
    const tk = (k: number) => endless.start + (k / (nH - 1)) * Math.max(0.3, endless.end - endless.start - 0.05);

    // ---- the flame along its line: under the inscription with the voice, then racing the hero word
    // the flame reaches each burned word's first letter as it is sung, and SUFFERING's last as it ends
    const wx = this.wx;
    const fx = keys(t, [
      [T0, -2.6],
      ...ws.slice(0, -1).map((w, i) => [w.start - 0.02, wx[i]!.x0 - 0.04, i === 0 ? ease.outQuad : ease.linear] as [number, number, (u: number) => number]),
      [Math.min(ws[ws.length - 2]!.end, endless.start - 0.08), wx[wx.length - 1]!.x1 + 0.05, ease.linear],
      [endless.start, xE - 1.2, ease.inQuad],
      // through the row: reaching each letter just after it stands
      ...Array.from({ length: nH }, (_, k) => [tk(k) + 0.07, heroX(xE, k) + 0.3, ease.linear] as [number, number, (u: number) => number]),
      [T1, xLast + 40, ease.outQuad],
    ]);
    const fl = flameState(audio, t, 3);
    const base = new THREE.Vector3(fx, 0, Z_LINE);
    const reveal = t < ws[0]!.start - 0.03 ? -99 : Math.min(fx, W0 + 1);
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
      l.hinge = popHinge(t, t0);
      l.on = l.hinge < Math.PI / 2 - 1e-4 ? 1 : 0;
      l.mat.uniforms.glow!.value = 0.3 * pulse(t, t0, 0.15) * (t >= t0 ? 1 : 0) * l.on;
      l.mat.uniforms.amb!.value = 0.16 * prog(t, t0 + 0.25, t0 + 0.8) * l.on;
    }
    hw.update();

    // ---- the camera: overhead, tracking the burn; a corkscrew down behind the flame on "so"; racing; braking
    // overhead, the camera keeps the burn front a little left of centre
    const xc = Math.max(fx - 1.1, -1.2);
    const posA = new THREE.Vector3(xc, 6.0, -1.5), atA = new THREE.Vector3(xc, 0, -1.5);
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

    return { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6 + 0.8 * race * (1 - prog(t, endless.end, T1)), halation: 0.35 };
  }
}
