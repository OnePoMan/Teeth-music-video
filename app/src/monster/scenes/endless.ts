// `endless` — verse 1, line 2: "How did suffering become so endless?" (docs/MONSTER.md, revision 1).
// From above: a Greek-key frieze in the black-glazed floor, an inscription band over it, and one straight groove
// between them, glowing as it is cut: its white-hot head runs along with the voice and the groove cools behind it.
// "suffering" is burned into the band as the head passes under each letter (never ahead of the voice). On "so" the
// camera corkscrews down and the groove bends into an infinity loop: the head runs the loop with a comet's tail
// (the "loading" chase), and "endless?" stands up on it letter by letter as the head reaches each on its
// syllable: E-N-D-L on the near arc of the left lobe, E-S-S-? on the far arc of the right, so every lap passes
// them in reading order. The lap closes as the shot cuts. The light is the unseen fire behind us (keyLight).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F, font, layout } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, keys, lerp, prog, pulse } from '../../engine/util';
import { GLSL_KEY_DIST } from '../motifs';
import { Stage, StageCam, Word3D, keyLight, popHinge } from '../stage';

/** Frieze geometry (world units): cell size; z of the flame's line, of the lower border; groove half-width. */
const C = 0.3, Z_LINE = -4.9 * C, Z_LOW = 0.9 * C, LINE_W = 0.06;
/** Inscription: baseline z, cap height (world), font. */
const INSC = { zBase: -5.9 * C, cap: 2.1 * C, fam: () => F.archivo(87.5, 800), px: 300 };
/** The infinity loop (a lemniscate on the floor): its left tip is where the line ends, `dx` past the inscription;
 *  half-width `a`; the hero's cap height; the trail's samples and spacing (s). */
const INF = { dx: 1.6, a: 3.5, cap: 0.72, trailN: 14, trailDt: 0.03 };
/** A point of the loop: u = pi is the left tip; pi..3pi/2 the left lobe's near arc; 3pi/2..2pi the right lobe's far arc. */
const lem = (u: number, cx: number, cz: number, a: number) => {
  const s = Math.sin(u), c = Math.cos(u), d = 1 + s * s;
  return { x: cx + (a * c) / d, z: cz + (a * s * c) / d };
};
/** Where the hero's letters stand on the loop (parameter u). */
const LETTER_U = (k: number) => (k < 4 ? Math.PI + 0.42 + k * 0.33 : 1.5 * Math.PI + 0.3 + (k - 4) * 0.33);

const HOOKS = /* glsl */ `
${GLSL_KEY_DIST}
uniform float cellW, zLine, zLow, zTopB, lineW, flameX, trailL, revealX, xEnd;
uniform sampler2D insc; uniform vec4 inscRect;
uniform vec4 inf;                                   // the loop: centre x, z, half-width, shown
uniform vec2 trail[${INF.trailN}];
uniform vec2 head;                                  // the cutting point (x, z)
// distance to the lemniscate (x^2 + z^2)^2 = a^2 (x^2 - z^2), first order (good at the crossing too)
float lemD(vec2 xz) {
  vec2 p = xz - inf.xy; float a2 = inf.z * inf.z, r2 = dot(p, p);
  float f = r2 * r2 - a2 * (p.x * p.x - p.y * p.y);
  vec2 g = vec2(4.0 * p.x * r2 - 2.0 * a2 * p.x, 4.0 * p.y * r2 + 2.0 * a2 * p.y);
  return abs(f) / max(length(g), 1e-3 * a2 * inf.z);
}
float infG(vec2 xz) {
  if (inf.w <= 0.0) return 0.0;
  return 1.0 - smoothstep(lineW * 0.5 - gPix, lineW + gPix, lemD(xz));
}
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
  // the frieze ends before the loop; the flame's line runs on to the loop's left tip
  float fr = smoothstep(xEnd + 0.3, xEnd - 0.3, xz.x);
  float g = max(max(meanderG(xz), max(lineG(xz.y, zLow), lineG(xz.y, zTopB))) * fr, lineG(xz.y, zLine) * step(xz.x, inf.x - inf.z));
  g = max(g, infG(xz));
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
  // the groove glows behind its cutting point and cools
  float onLine = 1.0 - smoothstep(lineW * 0.35, lineW * 1.1 + gPix, abs(P.z - zLine));
  float tr = exp(-max(flameX - P.x, 0.0) / trailL) * step(P.x, flameX) * onLine * step(P.x, inf.x - inf.z + 0.02);
  col += mix(C_BLOOD, C_EMBER, tr) * tr * 1.4;
  // the loop: a dim ember all round once the flame is on it, white-hot along the flame's tail
  float onInf = infG(P.xz);
  if (onInf > 0.0) {
    float tl = 0.0;
    for (int i = 0; i < ${INF.trailN}; i++) tl = max(tl, exp(-length(P.xz - trail[i]) / 0.2) * (1.0 - float(i) / ${INF.trailN.toFixed(1)}));
    col += mix(C_BLOOD, C_EMBER, tl) * (0.3 + 1.3 * tl) * onInf;
  }
  // the cutting point: white-hot, a small glow round it
  float dh = length(P.xz - head);
  col += mix(C_EMBER, C_BONE, 0.65) * (2.2 * exp(-dh / 0.035) + 0.5 * exp(-dh / 0.22));
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
        flameX: { value: 0 }, trailL: { value: 2 }, revealX: { value: -99 }, xEnd: { value: 99 }, head: { value: new THREE.Vector2(-999, -999) },
        inf: { value: new THREE.Vector4(0, Z_LINE, INF.a, 0) }, trail: { value: Array.from({ length: INF.trailN }, () => new THREE.Vector2(-999, -999)) },
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
    const W0 = this.inscW;
    // the loop: its left tip where the line ends
    const tipX = W0 + INF.dx, cx = tipX + INF.a, cz = Z_LINE;
    const nH = this.hero.letters.length;
    const tk = (k: number) => endless.start + (k / (nH - 1)) * Math.max(0.3, endless.end - endless.start - 0.05);
    const tEntry = endless.start - 0.1;

    // ---- the cutting point: along its line under the inscription with the voice, a dash to the loop, then round and round
    const wx = this.wx;
    const lineX = (tt: number) => keys(tt, [
      [T0, -2.6],
      ...ws.slice(0, -1).map((w, i) => [w.start - 0.02, wx[i]!.x0 - 0.04, i === 0 ? ease.outQuad : ease.linear] as [number, number, (u: number) => number]),
      [Math.min(ws[ws.length - 2]!.end - 0.12, tEntry - 0.25), wx[wx.length - 1]!.x1 + 0.05, ease.linear],
      [tEntry, tipX, ease.inQuad],
    ]);
    // on the loop: through each letter's place as its syllable sounds, then on round the return half to close the lap
    const loopU = (tt: number) => keys(tt, [
      [tEntry, Math.PI],
      ...Array.from({ length: nH }, (_, k) => [tk(k), LETTER_U(k), ease.linear] as [number, number, (u: number) => number]),
      [T1, 3 * Math.PI, ease.linear],
    ]);
    const flameAt = (tt: number) => {
      if (tt < tEntry) return { x: lineX(tt), z: Z_LINE };
      return lem(loopU(tt), cx, cz, INF.a);
    };
    const fp = flameAt(t);
    const fx = t < tEntry ? fp.x : tipX;
    const reveal = t < ws[0]!.start - 0.03 ? -99 : Math.min(fx, W0 + 1);
    const onLoop = prog(t, tEntry - 0.05, tEntry + 0.05);
    const u = this.st.bg.u;
    u.flameX!.value = fx; u.revealX!.value = reveal; u.trailL!.value = 1.8;
    (u.head!.value as THREE.Vector2).set(fp.x, fp.z);
    u.xEnd!.value = W0 + 0.5;
    (u.inf!.value as THREE.Vector4).set(cx, cz, INF.a, onLoop);
    (u.trail!.value as THREE.Vector2[]).forEach((v, i) => {
      const tt = t - i * INF.trailDt;
      if (tt < tEntry) v.set(-999, -999); else { const p = flameAt(tt); v.set(p.x, p.z); }
    });

    // ---- the camera: overhead tracking the burn; on "so" a corkscrew down to a high three-quarter view of the loop
    const posA = new THREE.Vector3(Math.max(fx - 1.1, -1.2), 6.0, -1.5);
    const xA = Math.min(posA.x, tipX - 1.0);
    posA.x = xA;
    const atA = new THREE.Vector3(xA, 0, -1.5);
    const rest = new THREE.Vector3(cx - 0.3, 4.6, cz + 6.9), restAt = new THREE.Vector3(cx, 0.2, cz - 0.2);
    const drift = prog(t, tilt1, T1, ease.inOutQuad);
    const posB = rest.clone().add(new THREE.Vector3(0.5 * drift, -0.35 * drift, -0.9 * drift));
    const u2 = prog(t, tilt0, tilt1, ease.inOutCubic);
    const q = StageCam.look(posA, atA, { x: 0, y: 0, z: -1 }).slerp(StageCam.look(posB, restAt), u2);
    const pos = posA.clone().lerp(posB, u2);
    this.st.cam.setQ(pos, q, lerp(35, 42, u2));

    // ---- ENDLESS? on the loop, each letter popping as the flame reaches it, facing the camera
    const hw = this.hero, s = INF.cap / hw.cap;
    const camP = this.st.cam.cam.position;
    for (let k = 0; k < nH; k++) {
      const l = hw.letters[k]!, t0 = tk(k), p = lem(LETTER_U(k), cx, cz, INF.a);
      l.x = p.x; l.z = p.z; l.y = 0; l.s = s;
      l.yaw = Math.atan2(camP.x - l.x, camP.z - l.z);
      l.hinge = popHinge(t, t0);
      l.on = l.hinge < Math.PI / 2 - 1e-4 ? 1 : 0;
      l.mat.uniforms.glow!.value = 0.55 * pulse(t, t0, 0.16) * (t >= t0 ? 1 : 0) * l.on;
      l.mat.uniforms.amb!.value = 0.14 * prog(t, t0 + 0.2, t0 + 0.7) * l.on;
    }
    hw.update();

    this.st.render(renderer, out, t, keyLight(this.st.cam, audio, t, { seed: 3, I: 1.1 }), { wall: 0, freqFloor: lerp(9, 5.5, u2) },
      { noFlame: true, rim: 0.8, spec: 0.05 });

    return { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35 };
  }
}
