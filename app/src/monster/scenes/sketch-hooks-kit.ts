// Shared parts of the hook 2 / hook 3 sketches (stills only: options for the client, not the build). The shore of
// hook 1 (shore.ts) plus what the options need beyond it: a depth-only occluder on the surface (so a lit word can sink
// and a black one rise through it), black-figure words in the direct render and in the mirrored one (posed as the
// mirror of a sinking word, so its sunk part shows under the surface, black on clay), a second clay field (optionally
// in a rolled frame), and the flood of water and sky to the clay's orange (the black-figure flip).
import * as THREE from 'three';
import { W, H } from '../../engine/gl';
import type { AudioData } from '../../engine/audio';
import { ease, lerp, prog, pulse } from '../../engine/util';
import { SHORE, Stage, Word3D, keyLight, type Letter } from '../stage';
import { LOW, SHORE_KEY, SHORE_OPTS, SHORE_SURF, WORD_Z, heroFont, shoreStage } from '../shore';

export const opt = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('opt') : null) ?? 'a';

const KIT_GLSL = /* glsl */ `
#define SHORE_FIELD
#define SHORE_SKY
uniform float wFlood, sFlood, g2On, g2Roll;
uniform vec4 g2;
vec3 fieldPaint(vec2 q, vec3 col) {
  vec4 rt = texture(reflTex, q / vec2(${W.toFixed(1)}, ${H.toFixed(1)}));
  if (any(isnan(rt)) || any(isinf(rt))) rt = vec4(0.0);
  float bfA = reflOn > 0.0 ? sat(rt.a * 2.0) : 0.0;
  // the flip: the water floods with the clay's orange
  col = mix(col, clayField(q, 0.0), wFlood);
  // a second answer field (L, R, waterline B, height H; GL px in the unrolled frame)
  if (g2On > 0.0) {
    vec2 c = vec2(${(W / 2).toFixed(1)}, ${(H / 2).toFixed(1)});
    vec2 d = q - c; float cr = cos(g2Roll), sr = sin(g2Roll);
    vec2 u = c + vec2(cr * d.x - sr * d.y, sr * d.x + cr * d.y);
    float depth = g2.z - u.y;
    float edgeN = 20.0 * snoise(vec2(depth / 30.0, stageT * 0.4));
    float across = smoothstep(g2.x - 60.0, g2.x + 10.0, u.x + edgeN) * (1.0 - smoothstep(g2.y - 10.0, g2.y + 60.0, u.x + edgeN));
    float down = smoothstep(-4.0, 2.0, depth) * (1.0 - smoothstep(g2.w * 0.95, g2.w * 1.9, depth + edgeN * 0.5));
    float f = g2On * across * down;
    col = mix(col, clayField(q, depth), f);
    col = mix(col, rt.rgb, bfA * smoothstep(0.08, 0.35, max(f, wFlood)));
  } else col = mix(col, rt.rgb, bfA * wFlood);
  return col;
}
vec3 skyPaint(vec2 px, vec3 col) {
  vec3 clay = mix(C_SIGNAL * 0.6, C_EMBER * 0.62, 0.25 + 0.1 * snoise(vec2(px.x / 900.0, px.y / 700.0)));
  return sFlood > 0.0 ? mix(col, clay, sFlood) : col;
}
`;

/** Pose of one letter (world): standing (hinge 0) with its foot at (x, y, z). */
export interface Pose { x: number; y: number; z: number; hinge: number; yaw?: number; on: boolean }

export class Kit {
  readonly st: Stage;
  readonly occ: THREE.Mesh;
  /** Black-figure runs drawn in the direct render (hidden from the mirrored one), and runs only the mirror shows. */
  private direct: Word3D[] = [];
  private mirror: Word3D[] = [];

  constructor() {
    this.st = shoreStage(KIT_GLSL, {
      wFlood: { value: 0 }, sFlood: { value: 0 }, g2On: { value: 0 }, g2Roll: { value: 0 }, g2: { value: new THREE.Vector4() },
    });
    // the surface, depth only: what sinks below it is hidden in the direct render
    this.occ = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshBasicMaterial({ colorWrite: false }));
    this.occ.rotation.x = -Math.PI / 2;
    this.occ.renderOrder = -10;
    this.st.scene.add(this.occ);
  }
  get u() { return this.st.bg.u; }

  /** A lit hero word (bone face, black-glazed sides). */
  lit(text: string) {
    const w = new Word3D(text, heroFont(), { size: 220 });
    w.lightMul = 2.8;
    this.st.add(w, { shadows: false });
    for (const l of w.letters) l.mat.side = THREE.DoubleSide;
    return w;
  }
  /** A black-figure word (black slip, incised contour): in the direct render, or only in the mirrored one. */
  bf(text: string, where: 'direct' | 'mirror') {
    const w = new Word3D(text, heroFont(), { size: 220, incise: true });
    for (const l of w.letters) { l.mat.uniforms.bf!.value = 1; l.mat.side = THREE.DoubleSide; l.on = 0; }
    this.st.add(w, { shadows: false });
    (where === 'direct' ? this.direct : this.mirror).push(w);
    w.update();
    return w;
  }

  /** Poses a run letter by letter, centred at x (s world units per font px). */
  static pose(w: Word3D, x: number, s: number, f: (l: Letter, k: number, lx: number) => Pose) {
    w.letters.forEach((l, k) => {
      const p = f(l, k, x + (l.penX - w.width / 2) * s);
      l.x = p.x; l.y = p.y; l.z = p.z; l.hinge = p.hinge; l.yaw = p.yaw ?? 0; l.s = s; l.on = p.on ? 1 : 0;
    });
    w.update();
  }
  /** Poses `dst` (mirror-only, black-figure) as the mirror image of `src`: in the water it shows where `src` is,
   *  right way round (only letters that reach below the surface). */
  static mirrorOf(src: Word3D, dst: Word3D, show = (l: Letter) => l.y < -1e-4) {
    src.letters.forEach((l, k) => {
      const m = dst.letters[k]!;
      m.x = l.x; m.z = l.z; m.yaw = l.yaw; m.s = l.s;
      m.y = -l.y; m.hinge = Math.PI - l.hinge; m.on = show(l) ? 1 : 0;
    });
    dst.update();
  }

  /** The second clay field around a run standing at z (screen box from the stage camera as set: set it unrolled
   *  first, then pass the roll it will have). */
  field2(w: Word3D, z: number, depthH: number, on: number, roll = 0) {
    const c = this.st.cam;
    let L = 1e9, R = -1e9;
    for (const l of w.letters) {
      for (const bx of [l.box[0], l.box[2]]) {
        const p = c.project({ x: l.x + bx * l.s * Math.cos(l.yaw), y: 0, z });
        L = Math.min(L, p.x); R = Math.max(R, p.x);
      }
    }
    const cx = (w.letters[0]!.x + w.letters[w.letters.length - 1]!.x) / 2;
    const pB = c.project({ x: cx, y: 0, z }), pT = c.project({ x: cx, y: depthH, z });
    (this.u.g2!.value as THREE.Vector4).set(L, R, H - pB.y, Math.max(1, pB.y - pT.y));
    this.u.g2On!.value = on; this.u.g2Roll!.value = roll;
  }

  /** Renders the shore: the mirrored render shows only the mirror-only runs (and Answers posed in `before`). */
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, audio: AudioData, t: number,
    before?: () => void, after?: () => void) {
    const mirror = {
      before: () => {
        this.occ.visible = false;
        for (const w of this.direct) for (const l of w.letters) l.mesh.visible = false;
        for (const w of this.mirror) w.update();
        before?.();
      },
      after: () => {
        this.occ.visible = true;
        for (const w of this.direct) w.update();
        for (const w of this.mirror) for (const l of w.letters) l.mesh.visible = false;
        after?.();
      },
    };
    this.st.render(renderer, out, t, keyLight(this.st.cam, audio, t, SHORE_KEY), SHORE_SURF, { ...SHORE_OPTS, mirror });
  }
}

/** Hook 1's camera: the shore's first frame, drifting; on the hero word's onset it dips to the waterline and levels,
 *  then pushes in slowly. */
export function hookCam(t: number, on: number, T0: number, T1: number) {
  const tD0 = on - 0.12, tD1 = on + 0.45;
  const dip = ease.inOutCubic(prog(t, tD0, tD1)), drift = prog(t, T0, tD0);
  const C = SHORE.cam;
  const pos = new THREE.Vector3(lerp(0.14 * drift, 0, dip), lerp(C.y, LOW.y, dip),
    lerp(C.z - 0.25 * drift, LOW.z, dip) - 0.3 * prog(t, tD1, T1 + 0.6));
  return { pos, pitch: lerp(C.pitch, LOW.pitch, dip), dip };
}
export const look = (pos: THREE.Vector3, pitch: number) => pos.clone().add(new THREE.Vector3(0, 30 * pitch, -30));

/** The lit word's landing: a flash of ember, then a little warm light of its own (as hook 1). */
export function landGlow(w: Word3D, t: number, on: number) {
  w.letters.forEach((l, k) => {
    const tk = on + k * 0.014;
    l.mat.uniforms.glow!.value = 0.5 * pulse(t, tk, 0.14) * (t >= tk ? 1 : 0) * l.on;
    l.mat.uniforms.amb!.value = 0.05 * prog(t, tk, tk + 0.3);
  });
}

export { WORD_Z };
