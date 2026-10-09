// SKETCH (stills only) — chorus 1, line 1 (the WRONG? line, 46.02–49.0), ?sketch=mirror&opt=wrong: "the world turns
// over". Verse 1's shadow theatre: a clay wall, a black-glaze floor, the fire unseen behind us. The small phrase pops on
// the floor as sung (its shadows thrown up the wall) and folds flat before the roll. Slamming into the 48.02 downbeat,
// the room rolls a half turn about our line of sight: the floor and its shadows hang overhead, the wall upside down.
// WRONG? stands up on the same hit and reads the right way up: the word is turned with us, the world is not.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { F } from '../../engine/type';
import type { Line } from '../../engine/lyrics';
import { ease, prog } from '../../engine/util';
import { GLSL_ODYSSEUS } from '../odysseus';
import { Stage, StageCam, Word3D, keyLight, popWords, type Letter } from '../stage';
import { BIG_W, heroFont } from '../shore';

const FOV = 40, TANF = Math.tan((FOV * Math.PI) / 360);
const WALL_Z = -5.5, CAM = new THREE.Vector3(0, 1.8, 5.6), AT = new THREE.Vector3(0, 0.35, -5.5);
/** The hero's foot line (z) in the unrolled room, and the small phrase's row on the floor. */
const HERO_Z = 0.4, SMALL = { x: -1.9, z: 1.2, cap: 0.24 };
/** Our own shadow, Odysseus's (odysseus.ts, the archer, long loose hair, no cloak): a figure standing between the fire
 * and the room, just behind the camera (x, z, height; short enough that, rolled, his head stays clear of WRONG?). */
const US = { x: 1.4, z: 6.0, h: 1.45 };

// the shadow theatre's one puppet is us, as Odysseus: the fire behind us throws his figure up the floor and onto the wall;
// the black glaze takes a little of the firelight so the shadows read on the floor too
const HOOKS = /* glsl */ `
uniform vec3 usFig;
${GLSL_ODYSSEUS}
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) {
  vec3 r = Lc - P;
  if (r.z < 1e-4) return 0.0;
  float k = (usFig.y - P.z) / r.z;
  if (k <= 0.0 || k >= 1.0) return 0.0;
  vec2 q = (P.xy + r.xy * k - vec2(usFig.x, 0.0)) / usFig.z;
  if (abs(q.x) > 0.7 || q.y > 1.12 || q.y < -0.05) return 0.0;
  float soft = gPix * 2.0 + 0.02 * k, inc;
  float d = odysseus(q, 1.0, 0.0, 0.0, 1.0, 0.0, gPix / usFig.z, inc) * usFig.z;
  return 0.92 * (1.0 - smoothstep(-soft, soft, d)) * (1.0 - 0.85 * inc);
}
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return wall ? col : col + mix(C_EMBER, C_BONE, 0.35) * 0.065 * sat(b); }
vec3 skyTint(vec3 D, vec3 col) { return col; }`;

export default class SketchC1Wrong extends Scene {
  private st!: Stage;
  private hero!: Word3D;
  private small!: Word3D;
  private line!: Line;
  private flat = new StageCam();

  override async init() {
    this.st = new Stage({ hooks: HOOKS, maxCards: 24, uniforms: { usFig: { value: new THREE.Vector3(US.x, US.z, US.h) } } });
    this.line = this.ctx.lyrics.lines.find((l) => l.start > 46 && l.start < 47.5 && /wrong/i.test(l.text))!;
    const ws = this.line.words, wi = ws.findIndex((w) => /wrong/i.test(w.w));
    this.hero = new Word3D(ws[wi]!.w.toUpperCase().replace(/[^A-Z?]/g, ''), heroFont(), { size: 220 });
    this.small = new Word3D(ws.slice(0, wi).map((w) => w.w).join(' '), F.archivo(112.5, 600), { size: 200 });
    this.hero.lightMul = 2.2;
    this.st.add(this.small);
    this.st.add(this.hero, { shadows: false });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const ws = this.line.words, wi = ws.findIndex((w) => /wrong/i.test(w.w));
    const tW = ws[wi]!.start, tR0 = tW - 0.17;

    // the roll: accelerating into the downbeat, a half turn that lands on it, a short recoil after
    const a = Math.PI * prog(t, tR0, tW, ease.inCubic);
    const after = Math.max(0, t - tW);
    const roll = a + (t > tW ? 0.07 * Math.exp(-after / 0.12) * Math.sin(after * 2 * Math.PI * 4.5) : 0);
    this.st.cam.set(CAM, AT, FOV, roll);
    this.flat.set(CAM, AT, FOV);

    // the small phrase on the floor, its letters' shadows on the wall; flat again before the roll
    const sm = this.small, ss = SMALL.cap / sm.cap;
    popWords(sm, ws.slice(0, wi).map((w) => w.start), t, (l: Letter) => {
      l.x = SMALL.x + l.penX * ss; l.z = SMALL.z; l.y = 0; l.yaw = 0; l.s = ss;
    }, { exit: tR0 - 0.1, exitDur: 0.1, exitRipple: 0.004 });

    // WRONG? stands on the hit. It is posed on the floor of the unrolled room, then the whole run is turned a half
    // turn about our line of sight (so it reads upright on screen while the room hangs upside down)
    const hw = this.hero, dist = CAM.z - HERO_Z;
    const s = (BIG_W * 2 * dist * TANF * (16 / 9)) / hw.width;
    popWords(hw, [tW], t, (l: Letter) => { l.x = (l.penX - hw.width / 2) * s; l.z = HERO_Z; l.y = 0; l.yaw = 0; l.s = s; }, { glow: 0.7 });
    const fwd = AT.clone().sub(CAM).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(fwd, roll);
    hw.group.quaternion.copy(q);
    hw.group.position.copy(CAM).sub(CAM.clone().applyQuaternion(q));
    hw.group.updateMatrixWorld(true);

    // the fire stays where it was in the room (behind us, over the right shoulder, above)
    const L = keyLight(this.flat, audio, t, { seed: 7, right: 2.0, up: -0.9, back: 3.4, I: 1.45, reach: 30 });
    this.st.render(renderer, out, t, L, { wall: 1, wallZ: WALL_Z, gloss: 0.4 }, { noFlame: true, rim: 0.8, spec: 0.05 });
    const jolt = Math.exp(-after / 0.08) * (t > tW ? 1 : 0);
    return { bloom: 0.55, bloomThreshold: 0.9, vignette: 0.55, grain: 0.06, ca: 0.5, halation: 0.3, shake: [0.004 * jolt, 0.008 * jolt] };
  }
}
