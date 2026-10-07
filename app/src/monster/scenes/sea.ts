// `sea` — verse 1b, lines 3–4: "What if the greatest threat we'll find across the sea / Is me?" (docs/MONSTER.md,
// revision 1). His side of the line has become the sea: black water in engraved swells, the flame afloat in its clay
// lamp, and far off the line itself, now a shore. On "threat" the word stands up on the far shore, black against the
// burning line, its reflection broken in the swell. "across the sea": the camera is pulled back across the water and
// the word goes small; it sinks; the water settles into hook 1's frame (the waterline at 0.71 H, the lamp at the left),
// and "Is me?" is asked where hook 1's question will stand.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D, makeRT, W, H } from '../../engine/gl';
import { F } from '../../engine/type';
import type { Line, Word } from '../../engine/lyrics';
import { ease, lerp, noise1, prog, pulse, springStep } from '../../engine/util';
import { FlameSprite, flameState, drawLamp2D, lampFlame } from '../motifs';
import { Stage, Word3D, drawPhrase, vkeys } from '../stage';
import { WL0, LAMP } from './hook';

/** The far shore (z), THREAT's cap height, the final camera (hook 1's frame): height, distance to the lamp, pitch. */
const SHORE = -16, CAP = 2.1;
const END = { y: 0.25, z: 9.5, pitch: 0.152 };

const HOOKS = /* glsl */ `
uniform sampler2D refl; uniform float tSea, shoreZ; uniform vec2 flamePx; uniform float flameHpx;
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) {
  return u + 0.3 * sin(P.x * 1.4 + 0.8 * sin(P.z * 0.9 + tSea * 0.35) + tSea * 0.7) + 0.05 * sin(P.x * 3.7 - tSea * 1.2);
}
float extraShadow(vec3 P, bool wall) { return 0.0; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  if (wall) return col;
  // the water ends at the far shore; the shore is the line, burning
  float beyond = smoothstep(shoreZ + 0.02, shoreZ - 0.02, P.z);
  float lineG = exp(-abs(P.z - shoreZ) / max(0.06, gPix * 1.5));
  col = mix(col, C_INK, beyond);
  col += mix(C_BLOOD, C_EMBER, 0.55) * lineG * 1.1;
  if (beyond > 0.99) return col;
  // reflections, broken into ripple bands with depth
  vec2 uv = FRAG_PX / vec2(${W.toFixed(1)}, ${H.toFixed(1)});
  float rip = 0.5 * sin(P.z * 9.0 + tSea * 2.2) + 0.5 * sin(P.x * 5.0 - tSea * 1.6);
  float band = 0.55 + 0.45 * sin(FRAG_PX.y * 0.9 + tSea * 3.0 + rip * 2.0);
  vec3 r = texture(refl, uv + vec2(0.004 * rip, 0.0)).rgb;
  col += r * 0.6 * band * (1.0 - beyond);
  // the flame's own reflection: a broken column under it
  float dx = abs(FRAG_PX.x - flamePx.x);
  float below = flamePx.y - FRAG_PX.y;
  float colm = exp(-dx / (5.0 + 0.05 * max(below, 0.0))) * smoothstep(0.0, 10.0, below) * exp(-max(below, 0.0) / (flameHpx * 2.6));
  col += mix(C_SIGNAL, C_EMBER, 0.6) * colm * band * 1.5;
  return col;
}`;

export default class Sea extends Scene {
  private st!: Stage;
  private word!: Word3D;
  private txt = new Layer2D();
  private flame = new FlameSprite();
  private refl = makeRT();
  private l1!: Line;
  private l2!: Line;

  override async init() {
    this.st = new Stage({
      hooks: HOOKS,
      uniforms: { refl: { value: this.refl.texture }, tSea: { value: 0 }, shoreZ: { value: SHORE }, flamePx: { value: new THREE.Vector2() }, flameHpx: { value: 60 } },
    });
    this.word = new Word3D('THREAT', F.archivo(75, 900), { size: 220 });
    for (const l of this.word.letters) l.mat.side = THREE.DoubleSide;
    this.st.add(this.word);
    this.l1 = this.ctx.lyrics.get('What if the greatest threat');
    this.l2 = this.ctx.lyrics.get('Is me');
  }

  private w(l: Line, s: string): Word {
    return l.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === s)!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, comp, audio } = this.ctx;
    const T0 = this.ctx.start, T1 = this.ctx.end;
    const threat = this.w(this.l1, 'threat'), across = this.w(this.l1, 'across'), sea = this.w(this.l1, 'sea');
    const wi = this.l1.words.indexOf(threat), ai = this.l1.words.indexOf(across);
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
      const tk = threat.start + (k / (n - 1)) * Math.min(0.4, threat.end - threat.start);
      l.on = t >= tk - 0.02 && sink < 0.999 ? 1 : 0;
      l.hinge = (Math.PI / 2) * (1 - springStep(t - tk, 2.2, 0.42));
      l.mat.uniforms.glow!.value = 0.4 * pulse(t, tk, 0.2) * l.on;
      l.mat.uniforms.amb!.value = 0.05;
    }
    wd.update();

    // ---- the lamp: afloat, drifting left and nearer until it sits where hook 1 has it
    const fl = flameState(audio, t, 21);
    const lampW = new THREE.Vector3(lerp(-1.1, -2.74, Math.max(back, settle)) + 0.08 * noise1(t * 0.4, 5), 0, lerp(-1.4, END.z - 5.8, Math.max(back * 0.9, settle)));
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

    // ---- reflections: the word mirrored in the water, rendered from the same camera
    renderer.setRenderTarget(this.refl);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);
    wd.group.scale.y = -1; wd.group.updateMatrixWorld(true);
    renderer.render(this.st.scene, this.st.cam.cam);
    wd.group.scale.y = 1; wd.group.updateMatrixWorld(true);

    const u = this.st.bg.u;
    u.tSea!.value = t;
    (u.flamePx!.value as THREE.Vector2).set(fpx.x, H - fpx.y);
    u.flameHpx!.value = flH;
    // the light sits in the lamp's flame (world: just above the water at the lamp)
    const Lbase = new THREE.Vector3(lampW.x + 0.35, 0.05, lampW.z);
    this.st.render(renderer, out, t, { base: Lbase, h: 0.45 * fl.h, I: fl.I * 1.35, reach: 6.5 }, { wall: 0, freqFloor: 4.2 }, { noFlame: true, cards: false, rim: 1.4 });

    // ---- the lamp, its flame, the small voice
    const c = this.txt.ctx;
    this.txt.clear();
    c.save(); c.translate(lx, ly); c.scale(k, k); drawLamp2D(c, 0, 0, 1); c.restore();
    const ws = this.l1.words;
    drawPhrase(c, ws.slice(0, wi), t, 160, 150, { exit: prog(t, threat.start, threat.start + 0.25) });
    drawPhrase(c, ws.slice(wi + 1, ai), t, 160, 150, { exit: prog(t, across.start - 0.05, across.start + 0.15) });
    drawPhrase(c, ws.slice(ai), t, 160, 150, { exit: prog(t, sea.end + 0.6, sea.end + 1.0) });
    drawPhrase(c, this.l2.words, t, 120, 230, { exit: prog(t, T1 - 0.12, T1) });
    comp.draw(renderer, this.txt.upload(), out);
    this.flame.draw(renderer, out, fpx.x, fpx.y, flH, t, { seed: 3, gust: fl.gust * 0.6, intensity: fl.I });

    return { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35 };
  }
}

