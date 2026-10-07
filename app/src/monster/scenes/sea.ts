// `sea` — verse 1b, lines 3–4: "What if the greatest threat we'll find across the sea / Is me?" (docs/MONSTER.md,
// revision 1). His side of the line has become the sea: black water in engraved swells, the flame afloat in its clay
// lamp, and far off the line itself, now a shore. On "threat" the word stands up on the far shore, black against the
// burning line, its reflection broken in the swell. "across the sea": the camera is pulled back across the water and
// the word goes small; it sinks; the water settles into hook 1's frame (the waterline at 0.71 H, the lamp at the left),
// and "Is me?" is asked where hook 1's question will stand.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D, W, H } from '../../engine/gl';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, noise1, prog, pulse } from '../../engine/util';
import { FlameSprite, flameState, drawLamp2D, lampFlame } from '../motifs';
import { Stage, Word3D, popHinge, popWords, vkeys, type Letter } from '../stage';
import { WL0, LAMP } from './hook';

/** The far shore (z), THREAT's cap height, the final camera (hook 1's frame): height, distance to the lamp, pitch. */
const SHORE = -16, CAP = 2.1;
const END = { y: 0.25, z: 9.5, pitch: 0.152 };

const HOOKS = /* glsl */ `
uniform float tSea, shoreZ;
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) {
  return u + 0.3 * sin(P.x * 1.4 + 0.8 * sin(P.z * 0.9 + tSea * 0.35) + tSea * 0.7) + 0.05 * sin(P.x * 3.7 - tSea * 1.2);
}
float extraShadow(vec3 P, bool wall) { return 0.0; }
uniform float skyI;
// the far shore burns: a low band of light over the horizon that the words stand black against
vec3 skyGlow(vec3 D) {
  float e = max(D.y, 0.0);
  return mix(C_BLOOD, C_SIGNAL, 0.45) * skyI * (0.7 * exp(-e * 55.0) + 0.06 * exp(-e * 12.0));
}
vec3 skyTint(vec3 D, vec3 col) { return col + skyGlow(D); }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  if (wall) return col;
  // the water ends at the far shore; the shore is the line, burning
  float beyond = smoothstep(shoreZ + 0.02, shoreZ - 0.02, P.z);
  float lineG = exp(-abs(P.z - shoreZ) / max(0.06, gPix * 1.5));
  col = mix(col, C_INK, beyond);
  col += mix(C_BLOOD, C_EMBER, 0.55) * lineG * 1.1;
  return col;
}`;

export default class Sea extends Scene {
  private st!: Stage;
  private word!: Word3D;
  private txt = new Layer2D();
  private flame = new FlameSprite();
  private l1!: Line;
  private l2!: Line;
  /** The floating phrases: "What if the greatest", "we'll find", "across the sea" (tracked wide), "Is me?". */
  private ph: Word3D[] = [];

  override async init() {
    this.st = new Stage({
      hooks: HOOKS,
      uniforms: { tSea: { value: 0 }, shoreZ: { value: SHORE }, skyI: { value: 1 } },
    });
    this.word = new Word3D('THREAT', F.archivo(75, 900), { size: 220 });
    this.word.lightMul = 0.12;                            // black against the burning shore
    this.st.add(this.word, { shadows: false });
    this.l1 = this.ctx.lyrics.get('What if the greatest threat');
    this.l2 = this.ctx.lyrics.get('Is me');
    const ws = this.l1.words, voice = F.archivo(112.5, 600);
    const wi = ws.findIndex((w) => w.w.toLowerCase().startsWith('threat')), ai = ws.findIndex((w) => w.w.toLowerCase().startsWith('across'));
    this.ph = [
      new Word3D(ws.slice(0, wi).map((w) => w.w).join(' '), voice, { size: 200 }),
      new Word3D(ws.slice(wi + 1, ai).map((w) => w.w).join(' '), voice, { size: 200 }),
      new Word3D(ws.slice(ai).map((w) => w.w).join(' '), voice, { size: 200, tracking: 90 }),
      new Word3D(this.l2.words.map((w) => w.w).join(' '), voice, { size: 200 }),
    ];
    for (const w of this.ph) this.st.add(w, { shadows: false });
    for (const w of this.st.words) for (const l of w.letters) l.mat.side = THREE.DoubleSide;
  }

  private w(l: Line, s: string): Word {
    return l.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, comp, audio } = this.ctx;
    const T0 = this.ctx.start, T1 = this.ctx.end;
    const threat = this.w(this.l1, 'threat'), across = this.w(this.l1, 'across'), sea = this.w(this.l1, 'sea');
    const wi = this.l1.words.indexOf(threat);
    const back = prog(t, across.start - 0.05, sea.end + 0.4, ease.outExpo);
    const settle = prog(t, sea.end + 0.2, this.l2.words[0]!.start - 0.1, ease.inOutCubic);

    // ---- the camera: low over the water gliding toward the shore; pulled back across the sea; settling into hook 1
    const p0 = vkeys(t, [[T0, [0.7, 0.8, 3.2]], [across.start - 0.05, [0.45, 0.7, 1.6], ease.linear]]);
    const p1 = new THREE.Vector3(0.1, 0.4, END.z - 1.2), p2 = new THREE.Vector3(0, END.y, END.z);
    const pos = p0.clone().lerp(p1, back).lerp(p2, settle);
    const at = pos.clone().add(new THREE.Vector3(lerp(-0.8, 0, back), lerp(0.4, 30 * END.pitch, Math.max(back, settle)), -30));
    this.st.cam.set(pos, at, 40);

    // ---- THREAT: standing up on the far shore as sung, black against the line; sinking once the sea is between us
    const wd = this.word, n = wd.letters.length, s = CAP / wd.cap;
    const sink = prog(t, sea.end + 0.1, sea.end + 1.4, ease.inCubic);
    for (let k = 0; k < n; k++) {
      const l = wd.letters[k]!;
      l.x = -0.4 + (l.penX - wd.width / 2) * s; l.z = SHORE - 0.25; l.y = -CAP * 1.05 * sink; l.yaw = 0; l.s = s;
      const tk = threat.start + (k / (n - 1)) * Math.min(0.36, threat.end - threat.start);
      l.hinge = popHinge(t, tk);
      l.on = l.hinge < Math.PI / 2 - 1e-4 && sink < 0.999 ? 1 : 0;
      l.mat.uniforms.glow!.value = 0.5 * pulse(t, tk, 0.14) * (t >= tk ? 1 : 0) * l.on;
      l.mat.uniforms.amb!.value = 0;
    }
    wd.update();

    // ---- the floating words: each pops up out of the swell on its onset, bobbing, facing the camera; one phrase at a time
    const ws = this.l1.words, cam = this.st.cam.cam.position;
    const ai = ws.indexOf(across);
    const bobRow = (x0: number, z0: number, cap: number, w: Word3D) => (l: Letter) => {
      const sc = cap / w.cap;
      l.x = x0 + l.penX * sc; l.z = z0; l.s = sc;
      l.y = 0.025 * Math.sin(t * 2.1 + l.penX * 0.004 + z0);
      l.yaw = Math.atan2(cam.x - (x0 + (w.width * sc) / 2), cam.z - z0);
    };
    const [q0, q1, pA, pM] = this.ph as [Word3D, Word3D, Word3D, Word3D];
    const cx = (w: Word3D, cap: number, xc: number) => xc - (w.width * cap / w.cap) / 2;
    popWords(q0, ws.slice(0, wi).map((w) => w.start), t, bobRow(cx(q0, 0.3, 0.75), -2.2, 0.3, q0), { exit: threat.start - 0.02 });
    popWords(q1, ws.slice(wi + 1, ai).map((w) => w.start), t, bobRow(cx(q1, 0.36, 0.5), -2.8, 0.36, q1), { exit: across.start - 0.02 });
    // "across the sea": one row tracked wide, spanning the water between us and the shore
    popWords(pA, ws.slice(ai).map((w) => w.start), t, bobRow(cx(pA, 0.62, 0.2), -6.5, 0.62, pA), { exit: sea.end + 0.9, amb: 0.16 });
    popWords(pM, this.l2.words.map((w) => w.start), t, bobRow(-1.75, END.z - 4.5, 0.3, pM));

    // ---- the lamp: afloat, drifting left and nearer until it sits where hook 1 has it
    const fl = flameState(audio, t, 21);
    const lampW = new THREE.Vector3(lerp(-1.35, -2.74, Math.max(back, settle)) + 0.08 * noise1(t * 0.4, 5), 0, lerp(-0.7, END.z - 5.8, Math.max(back * 0.9, settle)));
    const pl = this.st.cam.project(lampW);
    const kL = Math.max(0.2, 5.8 / Math.max(pl.depth, 0.5));
    // in the last bar, the lamp's screen place eases onto hook 1's exactly
    const hook = prog(t, T1 - 1.4, T1 - 0.2, ease.inOutCubic);
    const bob = 2.5 * Math.sin(t * 1.7);
    const lx = lerp(pl.x, LAMP.x, hook), ly = lerp(pl.y, WL0 + LAMP.dy, hook) + bob;
    const k = lerp(kL, 1, hook);
    const fp = lampFlame(lx, ly);
    const flH = LAMP.h * k * fl.h;
    const fpx = { x: lx + (fp.x - lx) * k, y: ly + (fp.y - ly) * k };

    const u = this.st.bg.u;
    u.tSea!.value = t;
    u.skyI!.value = 0.55 + 0.45 * prog(t, threat.start - 0.3, threat.start + 0.2) - 0.35 * settle;
    // the light sits in the lamp's flame (world: just above the water at the lamp)
    const Lbase = new THREE.Vector3(lampW.x + 0.35, 0.05, lampW.z);
    this.st.render(renderer, out, t, { base: Lbase, h: 0.45 * fl.h, I: fl.I * 1.35, reach: 6.5 }, { wall: 0, freqFloor: 3.0, floorLines: 0.5, gloss: 0.55 },
      { noFlame: true, cards: false, rim: 1.4, flameScreen: { x: fpx.x, y: fpx.y, h: flH } });

    // ---- the lamp, its flame, the small voice
    const c = this.txt.ctx;
    this.txt.clear();
    c.save(); c.translate(lx, ly); c.scale(k, k); drawLamp2D(c, 0, 0, 1); c.restore();
    comp.draw(renderer, this.txt.upload(), out);
    this.flame.draw(renderer, out, fpx.x, fpx.y, flH, t, { seed: 3, gust: fl.gust * 0.6, intensity: fl.I });

    return { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35 };
  }
}

