// SKETCH (stills only) — Odysseus's shadow, a design sheet (client, 2026-10-09): on souls' clay wall, Odysseus
// (odysseus.ts) beside two generic shades for comparison, chosen with ?opt=:
//   a  calm: the bow held low at his side      b  the archer: bow drawn, an arrow nocked
//   c  the traveller: bow slung, a quiver      aturn  pose a, his head turned to look at us
//   bturn  pose b turned to us; add "-loose" / "-tied" / "-short" for the hair, "-cap" for the cap, "-cloak" for the cloak, "-plain" for no incision (e.g. opt=bturn-tied)
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLSL_SHADE } from '../motifs';
import { GLSL_ODYSSEUS, odysseusUniforms, setOdysseus, type OdyHair, type OdyPose } from '../odysseus';
import { Stage, keyLight } from '../stage';

const R = 6.5, WALL_A = -Math.PI / 2;
/** The two shades (along the wall, height, build). */
const SHADES: [number, number, number][] = [[1.7, 3.3, 0.31], [3.4, 3.5, 0.77]];

const HOOKS = /* glsl */ `
uniform float cylR;
uniform vec3 shA, shB;
${GLSL_SHADE}
${GLSL_ODYSSEUS}
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return length(P.xz) * 2.4 + 0.2 * snoise(P.xz * 0.2); }
float shadeOcc(vec2 p, vec3 s) {
  vec2 q = vec2(p.x - s.x, p.y) / s.y;
  if (abs(q.x) > 0.4 || q.y > 1.1) return 0.0;
  return 1.0 - smoothstep(-0.05, 0.07, figure(q, s.z) * s.y);
}
float extraShadow(vec3 P, bool wall) {
  if (!wall) return 0.0;
  float da = atan(P.z, P.x) - ${WALL_A.toFixed(6)};
  da = da - 6.2831853 * floor((da + 3.14159265) / 6.2831853);
  vec2 p = vec2(da * cylR, P.y);
  return max(max(shadeOcc(p, shA), shadeOcc(p, shB)), odysseusWall(p, gPix));
}
vec3 skyTint(vec3 D, vec3 col) { return col; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return col; }`;

export default class SketchSouls extends Scene {
  private st!: Stage;
  private pose: OdyPose = 'calm';
  private turn = 0;
  private incise = true;
  private cap = false;
  private cloak = false;
  private hair: OdyHair = 'loose';

  override async init() {
    const opt = (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('opt') : null) ?? 'a';
    this.pose = opt.startsWith('b') ? 'archer' : opt.startsWith('c') ? 'traveller' : 'calm';
    this.turn = opt.includes('turn') ? 1 : 0;
    this.cap = opt.includes('-cap');
    this.cloak = opt.includes('-cloak');
    this.hair = opt.includes('tied') ? 'tied' : opt.includes('short') ? 'short' : 'loose';
    this.incise = !opt.endsWith('-plain');
    this.st = new Stage({
      hooks: HOOKS,
      maxCards: 1,
      uniforms: {
        cylR: { value: R },
        shA: { value: new THREE.Vector3(...SHADES[0]!) }, shB: { value: new THREE.Vector3(...SHADES[1]!) },
        ...odysseusUniforms(),
      },
    });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    setOdysseus(this.st.bg.u, { x: -1.4, h: 4.1, pose: this.pose, turn: this.turn, cap: this.cap, cloak: this.cloak, hair: this.hair, incise: this.incise, lean: -0.75, stretch: 1.3 });
    // facing the wall square on, a little above floor level; the fire low behind us
    const pos = new THREE.Vector3(0.4, 1.6, 2.6), at = new THREE.Vector3(0.4, 2.1, -R);
    this.st.cam.set(pos, at, 42);
    const L = keyLight(this.st.cam, audio, t, { seed: 13, I: 1.5, reach: 25, up: -0.9 });
    this.st.render(renderer, out, t, L,
      { wall: 2, cyl: [0, 0, R], freqWall: 6.5, freqFloor: 6, toneWall: 1, toneFloor: 0.45 },
      { cards: false, noFlame: true, rim: 0.8, spec: 0.05 });
    return { bloom: 0.7, bloomThreshold: 0.9, vignette: 0.5, grain: 0.06, ca: 0.6, halation: 0.35 };
  }
}
