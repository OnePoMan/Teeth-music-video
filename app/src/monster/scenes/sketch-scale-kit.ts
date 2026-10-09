// Kit for the `scale` sketch stills (scenes/sketch-scale.ts): the shore's hooks rewritten with what the three options
// need (the clay seeping above the waterline, A's balance painted across the waterline, C's cracked horizon), and B's
// hanging balance as real meshes (black-glaze pans with lit rims, the lives as small black men).
import * as THREE from 'three';
import { W, H } from '../../engine/gl';
import { LIN } from '../../engine/palette';
import { GLSL_SHADE } from '../motifs';
import { SHORE, Stage } from '../stage';

const v3 = (c: [number, number, number]) => `vec3(${c.map((x) => x.toFixed(5)).join(', ')})`;

/** The shore's hooks plus: `seep` (the clay's orange rising above the waterline, falling off with elevation by
 *  `seepK`), A's balance (`bOn`; beam on the waterline: above it lit bone, below it black-figure on clay), C's crack. */
const HOOKS = /* glsl */ `
#define WATER_HOOK
#define REFL_KEEP
uniform float shoreZ, skyI, seep, seepK;
uniform vec2 hzP, hzD;            // a point on the horizon line and its direction (GL px)
uniform vec4 crack;               // C: the fissure's place along the line (px from hzP), the far shore's drop (px), width, on
uniform float bOn, bA, bArm, bStem, bBowlW, bBowlH, bCord, bTh, menOn, menH, bfOn;
uniform vec2 bP;                  // A: the pivot on the waterline (GL px); bA > 0 tips the left end up
uniform vec4 bfBox;               // A: the clay under the surface: L, R, top, bottom (GL px)
${GLSL_SHADE}
bool onFloor = false;
float carve(vec2 xz) { onFloor = true; return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) { return 0.0; }
vec3 clayField(vec2 q, float depth) {
  return mix(C_SIGNAL * 0.6, C_EMBER * 0.62, 0.2 + 0.2 * snoise(vec2(q.x / 500.0, depth / 200.0)));
}
float fillM(float d) { return 1.0 - smoothstep(-0.8, 0.8, d); }

float balDist(vec2 q) {
  vec2 dir = vec2(cos(bA), -sin(bA));
  vec2 eL = bP - dir * bArm, eR = bP + dir * bArm;
  float d = sdSegment(q, eL, eR) - bTh;
  d = min(d, length(q - bP) - bTh * 2.4);
  d = min(d, sdSegment(q, bP, bP - vec2(0.0, bCord * 0.95)) - bTh * 1.1);
  d = min(d, sdSegment(q, bP - vec2(bBowlW * 0.3, bCord * 0.95), bP - vec2(-bBowlW * 0.3, bCord * 0.95)) - bTh);
  // the lit pan, on a stem from the left end
  vec2 rU = eL + vec2(0.0, bStem + bBowlH);
  d = min(d, sdSegment(q, eL, eL + vec2(0.0, bStem)) - bTh * 0.8);
  vec2 b = (q - rU) / vec2(bBowlW, bBowlH);
  d = min(d, max((length(b) - 1.0) * bBowlH, q.y - rU.y));
  d = min(d, sdSegment(q, rU - vec2(bBowlW * 1.04, 0.0), rU + vec2(bBowlW * 1.04, 0.0)) - bTh * 0.6);
  // the pan below, hung on cords from the right end
  vec2 rD = eR - vec2(0.0, bCord);
  d = min(d, sdSegment(q, eR, rD - vec2(bBowlW * 0.95, 0.0)) - bTh * 0.35);
  d = min(d, sdSegment(q, eR, rD + vec2(bBowlW * 0.95, 0.0)) - bTh * 0.35);
  b = (q - rD) / vec2(bBowlW, bBowlH);
  d = min(d, max((length(b) - 1.0) * bBowlH, q.y - rD.y));
  d = min(d, sdSegment(q, rD - vec2(bBowlW * 1.04, 0.0), rD + vec2(bBowlW * 1.04, 0.0)) - bTh * 0.6);
  // the lives: small men standing in it
  if (menOn > 0.0) for (int i = 0; i < 3; i++) {
    vec2 foot = rD + vec2((float(i) - 1.0) * bBowlW * 0.52, -bBowlH * 0.3);
    d = min(d, figure((q - foot) / menH, 0.13 + 0.29 * float(i)) * menH);
  }
  return d;
}
float patchM(vec2 q, vec4 b) {
  float e = 22.0 * snoise(vec2(q.y / 30.0, stageT * 0.4));
  float across = smoothstep(b.x - 50.0, b.x + 10.0, q.x + e) * (1.0 - smoothstep(b.y - 10.0, b.y + 50.0, q.x + e));
  float down = (1.0 - smoothstep(b.z - 3.0, b.z + 3.0, q.y)) * smoothstep(b.w - 40.0, b.w + 40.0, q.y + e * 0.5);
  return across * down;
}
vec3 skyBase(vec3 D, vec3 col) {
  float e = max(D.y, 0.0);
  col += mix(C_BLOOD, C_SIGNAL, 0.45) * skyI * (0.6 * exp(-e * 30.0) + 0.06 * exp(-e * 9.0));
  return mix(col, clayField(FRAG_PX, 0.0) * 0.8, seep * exp(-e * seepK));
}
float hzAlong(vec2 px) { return dot(px - hzP, hzD); }
float hzUp(vec2 px) { return dot(px - hzP, vec2(-hzD.y, hzD.x)); }
float crackX(float el) {
  float zig = abs(fract(el / 46.0) - 0.5) * 2.0 - 0.5;
  return crack.x + crack.z * (0.9 * zig + 0.5 * snoise(vec2(el / 37.0, 3.1)));
}
float crackSide(vec2 px) { return crack.w <= 0.0 ? 0.0 : smoothstep(-0.8, 0.8, hzAlong(px) - crackX(hzUp(px))) * crack.w; }
vec3 crackPaint(vec2 px, vec3 col) {
  if (crack.w <= 0.0) return col;
  float el = hzUp(px), a = hzAlong(px) - crackX(el);
  float w = crack.z * 0.25 * exp(-abs(el + crack.y * 0.5) / (0.12 * ${H.toFixed(1)})) + 0.5;
  return mix(col, C_INK, (1.0 - smoothstep(w - 0.8, w + 0.8, abs(a))) * crack.w * (1.0 - smoothstep(0.1, 0.25, abs(el) / ${H.toFixed(1)})));
}
vec3 litBal(vec2 px, vec3 col) {
  if (bOn <= 0.0 || px.y < bP.y) return col;
  return mix(col, C_BONE * 0.62, fillM(balDist(px)) * bOn * smoothstep(bP.y, bP.y + 2.0, px.y));
}
vec3 skyTint(vec3 D, vec3 col) {
  col = skyBase(D, col);
  if (onFloor) return col;
  return crackPaint(FRAG_PX, litBal(FRAG_PX, col));
}
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  if (wall) return col;
  vec3 D = normalize(P - camPos);
  float beyond = smoothstep(shoreZ + 0.02, shoreZ - 0.02, P.z);
  float lineG = exp(-abs(P.z - shoreZ) / max(0.06, min(gPix, 0.5) * 1.5));
  col = mix(col, skyBase(D, C_INK), beyond);
  vec2 px = FRAG_PX;
  float side = crackSide(px);
  if (side > 0.0) {
    float el = hzUp(px);
    col = mix(col, skyBase(normalize(vec3(D.x, 0.002, D.z)), C_INK), side * smoothstep(-crack.y - 1.0, -crack.y + 1.0, el));
    col += C_BONE * 0.8 * exp(-abs(el + crack.y) / 1.3) * side;
  }
  col += C_BONE * 0.8 * lineG * (1.0 - side);
  return crackPaint(px, litBal(px, col));
}
vec3 waterHook(vec2 px, vec2 ruv, vec4 rt, vec3 col) {
  if (bfOn <= 0.0) return col;
  vec2 q = ruv * vec2(${W.toFixed(1)}, ${H.toFixed(1)});
  float m = bfOn * patchM(q, bfBox);
  float bd = balDist(q);
  col = mix(col, clayField(q, bfBox.z - q.y), m);
  float k = smoothstep(0.1, 0.5, m);
  col = mix(col, C_INK, fillM(bd) * k);
  return mix(col, rt.rgb, sat(rt.a * 2.0) * k);
}`;

export function scaleStage() {
  return new Stage({
    hooks: HOOKS,
    uniforms: {
      shoreZ: { value: SHORE.z }, skyI: { value: 0.06 }, seep: { value: 0 }, seepK: { value: 20 },
      hzP: { value: new THREE.Vector2(W / 2, H / 2) }, hzD: { value: new THREE.Vector2(1, 0) }, crack: { value: new THREE.Vector4(0, 0, 0, 0) },
      bOn: { value: 0 }, bA: { value: 0 }, bArm: { value: 100 }, bStem: { value: 10 }, bBowlW: { value: 50 }, bBowlH: { value: 10 },
      bCord: { value: 50 }, bTh: { value: 4 }, menOn: { value: 0 }, menH: { value: 40 }, bfOn: { value: 0 },
      bP: { value: new THREE.Vector2() }, bfBox: { value: new THREE.Vector4() },
    },
  });
}

// ---------------------------------------------------------------- B: the hanging balance, as meshes
const MESH_FRAG = /* glsl */ `
uniform vec3 Lc, camP; uniform float LI, mode;
varying vec3 vN; varying vec3 vP;
void main() {
  vec3 N = vN;
  if (!(dot(N, N) > 1e-8)) N = vec3(0.0, 1.0, 0.0);
  N = normalize(N);
  vec3 V = normalize(camP - vP);
  if (dot(N, V) < 0.0) N = -N;
  vec3 Ld = Lc - vP; float d = length(Ld); vec3 L = Ld / max(d, 1e-4);
  float fall = LI / (1.0 + (d / 25.0) * (d / 25.0) * 4.0);
  float ndl = max(dot(N, L), 0.0);
  vec3 ink = ${v3(LIN.ink)}, bone = ${v3(LIN.bone)}, ember = ${v3(LIN.ember)}, graph = ${v3(LIN.graphite)};
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float sp = pow(max(dot(N, normalize(L + V)), 0.0), 60.0);
  vec3 col = ink * 1.4 + mix(ember, bone, 0.35) * 0.035 * ndl * fall + mix(ember, bone, 0.5) * sp * 0.22 * fall + ember * 0.06 * fr * ndl * fall;
  if (mode > 0.5 && mode < 1.5) col = mix(ember, bone, 0.62) * (0.18 + 0.7 * ndl) * fall;   // a lit rim
  if (mode > 1.5) col = mix(graph, bone, 0.25) * (0.25 + 0.4 * ndl) * fall;                 // a cord
  gl_FragColor = vec4(col, 1.0);
}`;
const MESH_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz; vN = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FIG_FRAG = /* glsl */ `
uniform float v;
varying vec2 vUv;
float sat(float x) { return clamp(x, 0.0, 1.0); }
float sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
${GLSL_SHADE}
void main() {
  float d = figure(vec2(vUv.x - 0.5, vUv.y), v);
  float aa = fwidth(d);
  if (d > aa) discard;
  gl_FragColor = vec4(${v3(LIN.ink)}, 1.0);
}`;

const meshMat = (mode: number) => new THREE.ShaderMaterial({
  uniforms: { Lc: { value: new THREE.Vector3() }, camP: { value: new THREE.Vector3() }, LI: { value: 1 }, mode: { value: mode } },
  vertexShader: MESH_VERT, fragmentShader: MESH_FRAG, side: THREE.DoubleSide,
});

/** A small black man (a life) standing at his feet, `h` tall, turned to the camera. */
export class Man {
  readonly mesh: THREE.Mesh;
  constructor(v: number) {
    const g = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: { v: { value: v } }, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FIG_FRAG,
    });
    this.mesh = new THREE.Mesh(g, m);
  }
  pose(x: number, y: number, z: number, h: number, cam: THREE.Vector3, on = true) {
    this.mesh.visible = on;
    this.mesh.position.set(x, y, z);
    this.mesh.scale.setScalar(h);
    this.mesh.rotation.set(0, Math.atan2(cam.x - x, cam.z - z), 0);
  }
}

/** Zeus' scales: a beam on a cord from out of the frame, two shallow pans on three cords each. */
export class Balance3D {
  readonly group = new THREE.Group();
  private mats = [meshMat(0), meshMat(1), meshMat(2)];
  private beam: THREE.Mesh;
  private knob: THREE.Mesh;
  private top: THREE.Mesh;
  private pans: THREE.Group[] = [];
  private cords: THREE.Mesh[] = [];
  /** Rim centres of the pans after `pose` (world). */
  rims: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3()];
  constructor(readonly arm: number, readonly R: number, readonly depth: number, readonly hang: number) {
    const [glaze, rim, cord] = this.mats as [THREE.ShaderMaterial, THREE.ShaderMaterial, THREE.ShaderMaterial];
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 2 * arm, 16).rotateZ(Math.PI / 2), glaze);
    const ends = new THREE.SphereGeometry(0.13, 16, 10);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(ends, glaze); e.position.x = s * arm; this.beam.add(e); }
    this.knob = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 24), rim);
    this.top = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6).translate(0, 0.5, 0), cord);
    this.group.add(this.beam, this.knob, this.top);
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16; prof.push(new THREE.Vector2(Math.max(1e-3, R * u), -depth * (1 - u * u))); }
    const bowl = new THREE.LatheGeometry(prof, 64);
    const lip = new THREE.TorusGeometry(R, 0.05, 8, 96).rotateX(Math.PI / 2);
    for (let p = 0; p < 2; p++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(bowl, glaze), new THREE.Mesh(lip, rim));
      this.pans.push(g); this.group.add(g);
      for (let c = 0; c < 3; c++) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 5).translate(0, 0.5, 0), cord);
        this.cords.push(m); this.group.add(m);
      }
    }
  }
  /** Hangs it from `pivot`, tipped by `a` (> 0: the left end up), lit from Lc. */
  pose(pivot: THREE.Vector3, a: number, Lc: THREE.Vector3, LI: number, cam: THREE.Vector3) {
    for (const m of this.mats) { m.uniforms.Lc!.value.copy(Lc); m.uniforms.camP!.value.copy(cam); m.uniforms.LI!.value = LI; }
    this.beam.position.copy(pivot); this.beam.rotation.set(0, 0, -a);
    this.knob.position.copy(pivot).add(new THREE.Vector3(0, 0.2, 0));
    this.top.position.copy(pivot).add(new THREE.Vector3(0, 0.4, 0)); this.top.scale.set(1, 40, 1);
    const up = new THREE.Vector3(0, 1, 0);
    [-1, 1].forEach((s, p) => {
      const end = pivot.clone().add(new THREE.Vector3(s * this.arm * Math.cos(a), -s * this.arm * Math.sin(a), 0));
      const rimC = end.clone().add(new THREE.Vector3(0, -this.hang, 0));
      this.rims[p]!.copy(rimC);
      this.pans[p]!.position.copy(rimC);
      for (let c = 0; c < 3; c++) {
        const th = Math.PI / 2 + (c * 2 * Math.PI) / 3 + 0.3;
        const r = rimC.clone().add(new THREE.Vector3(this.R * Math.cos(th), 0, this.R * Math.sin(th)));
        const m = this.cords[p * 3 + c]!, dir = end.clone().sub(r);
        m.position.copy(r); m.scale.set(1, dir.length(), 1);
        m.quaternion.setFromUnitVectors(up, dir.normalize());
      }
    });
  }
}
