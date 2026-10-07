// The shadow theatre (docs/MONSTER.md, revision 1 grammar): a small 3D stage for the verse plates.
//  - Letters are solid things standing on the cave floor, extruded from the font's own outlines (`Word3D`).
//  - The flame is the one light. The floor and the walls are white-line engravings whose lines thicken in its
//    light and stop in shadow; the shadow's edge burns blood-orange (`StageBG`).
//  - Every letter casts an exact, soft shadow: each is a card in the shadow shader. The ray from a surface point
//    to the flame is cut by the card's plane and the glyph's mask is read there, blurred by the flame's size
//    seen from that point (a mip level), so shadows sharpen at the letters' feet and soften far from them.
// Units: world units, y up, the floor at y = 0; letters are modelled in font px and scaled into the world.
import * as THREE from 'three';
import type { PathCommand } from 'opentype.js';
import { FSPass, W, H } from '../engine/gl';
import { GLSL_COMMON } from '../engine/glsl/common';
import { F, font, layout, ot } from '../engine/type';
import type { Word } from '../engine/lyrics';
import { rgba } from '../engine/palette';
import { prog, ease, clamp } from '../engine/util';
import { FlameSprite } from './motifs';

export const MAX_CARDS = 16;

// ---------------------------------------------------------------- letters
export interface Letter {
  ch: string;
  mesh: THREE.Mesh;
  mat: THREE.RawShaderMaterial;
  /** Ink box in mesh-local units (font px, x centred on the glyph's ink, y up from the baseline). */
  box: [number, number, number, number];
  /** Atlas canvas px of the mesh-local origin. */
  ox: number; oy: number;
  /** x of the local origin along the word as set (font px, from the word's pen origin). */
  penX: number;
  /** Index of the word (space-separated) this letter belongs to, and its index in the whole string. */
  word: number; i: number;
  /** Pose, written by the scene each frame: feet at (x, z) on the floor, yaw about y, hinge about the
   *  baseline (0 standing, +pi/2 lying on its back), lift above the floor, size (world units per font px). */
  x: number; z: number; y: number; yaw: number; hinge: number; s: number;
  /** 0 hidden, 1 shown (hidden letters cast no shadow). */
  on: number;
}

const LETTER_VERT = /* glsl */ `
precision highp float;
in vec3 position; in vec3 normal;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
out vec3 vW; out vec3 vNW; out vec3 vP; out vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vNW = mat3(modelMatrix) * normal; vP = position; vN = normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const LETTER_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec3 vW; in vec3 vNW; in vec3 vP; in vec3 vN;
out vec4 fragColor;
${GLSL_COMMON}
uniform vec3 Lc; uniform float LI, reach, glow, lineFreq, rim, amb;
void main() {
  vec3 N = normalize(vNW);
  vec3 L = Lc - vW; float d = length(L); L /= d;
  float fall = LI / (1.0 + (d / reach) * (d / reach) * 4.0);
  float ndl = dot(N, L);
  float face = step(0.9, abs(normalize(vN).z));          // the letter's face (front or back) vs its sides
  float lit = pow(max(ndl, 0.0), 1.3) * fall;
  float tone = sat(lit * 1.35);
  // cut stone: the face bone in the light, the sides a step darker; where the light falls away, a black-line
  // engraving (horizontal on the face, along the depth on the sides) carries the shading
  vec3 base = mix(C_BONE * 0.72, C_BONE * 1.02, face);
  float u = face > 0.5 ? vP.y * lineFreq : vP.z * lineFreq * 1.6;
  float lines = hatch(u, sat(1.0 - tone * 1.15) * 0.75) * smoothstep(0.1, 0.3, tone);
  vec3 col = base * tone * (1.0 - 0.85 * lines);
  // turned from the light, a letter is a silhouette: ink with a graphite hairline engraving and a burning rim
  float back = sat(-ndl);
  col += C_GRAPHITE * 0.018 * (1.0 - tone) * (1.0 - hatch(vP.y * lineFreq, 0.35));
  col += mix(C_SIGNAL, C_EMBER, 0.5) * rim * fall * pow(1.0 - abs(ndl), 6.0) * (1.0 - face) * 1.4;
  // afterglow: a sung letter keeps a little warm light of its own
  col += mix(C_BONE, C_EMBER, 0.3) * amb * (0.35 + 0.65 * face) * (1.0 - 0.5 * lines);
  col = mix(col, C_EMBER * 2.2, glow * (0.6 + 0.4 * face));
  fragColor = vec4(col, 1.0);
}`;

/** Splits glyph path commands (y down) into contours, classifies holes by winding, returns extrudable shapes (y up). */
function glyphShapes(cmds: PathCommand[], div: number): THREE.Shape[] {
  const paths: THREE.Path[] = [];
  let cur: THREE.Path | null = null;
  for (const c of cmds) {
    if (c.type === 'M') { cur = new THREE.Path(); cur.moveTo(c.x, -c.y); paths.push(cur); }
    else if (c.type === 'L') cur!.lineTo(c.x, -c.y);
    else if (c.type === 'Q') cur!.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === 'C') cur!.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
  }
  const polys = paths.map((p) => {
    const ps = p.getPoints(div);
    const a = ps[0]!, b = ps[ps.length - 1]!;
    if (ps.length > 2 && a.distanceTo(b) < 1e-6) ps.pop();
    return ps;
  }).filter((ps) => ps.length >= 3);
  const area = polys.map((ps) => THREE.ShapeUtils.area(ps));
  let big = 0;
  area.forEach((a, i) => { if (Math.abs(a) > Math.abs(area[big]!)) big = i; });
  const sgn = Math.sign(area[big]!);
  const outers: { shape: THREE.Shape; pts: THREE.Vector2[]; a: number }[] = [];
  const holes: THREE.Vector2[][] = [];
  polys.forEach((ps, i) => {
    if (Math.abs(area[i]!) < 1e-3) return;
    if (Math.sign(area[i]!) === sgn) outers.push({ shape: new THREE.Shape(ps), pts: ps, a: Math.abs(area[i]!) });
    else holes.push(ps);
  });
  const inside = (p: THREE.Vector2, poly: THREE.Vector2[]) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]!, b = poly[j]!;
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  for (const h of holes) {
    const owners = outers.filter((o) => inside(h[0]!, o.pts)).sort((x, y) => x.a - y.a);
    (owners[0] ?? outers[0])?.shape.holes.push(new THREE.Path(h));
  }
  return outers.map((o) => o.shape);
}

export interface WordOpts {
  /** Modelling size (font px): sets the atlas resolution too. */
  size?: number;
  /** Extrusion depth and bevel, font px. */
  depth?: number;
  bevel?: number;
  tracking?: number;
  /** Subdivisions per outline curve. */
  div?: number;
  /** Engraving line frequency on the stone (lines per font px). */
  lineFreq?: number;
}

/**
 * A run of solid letters (spaces separate words). Each letter is its own mesh and its own shadow card, so a
 * scene can pose letters one by one (fold them up from the floor, turn them, topple them).
 */
export class Word3D {
  readonly letters: Letter[] = [];
  readonly atlas: THREE.CanvasTexture;
  readonly aw: number; readonly ah: number;
  /** Advance width of the whole string and the font's cap height (font px). */
  readonly width: number; readonly cap: number;
  /** Pen x where each space-separated word starts and its advance (font px). */
  readonly words: { x0: number; w: number; text: string }[] = [];
  readonly group = new THREE.Group();
  constructor(readonly text: string, family: string, o: WordOpts = {}) {
    const size = o.size ?? 220, depth = o.depth ?? size * 0.17, bevel = o.bevel ?? size * 0.014, div = o.div ?? 10;
    const f = ot(family);
    const lay = layout(text, family, size, o.tracking ?? 0);
    const os2 = (f.tables as { os2?: { sCapHeight?: number } }).os2;
    this.cap = ((os2?.sCapHeight ?? f.unitsPerEm * 0.7) / f.unitsPerEm) * size;
    this.width = lay.width;
    // words
    let w0 = -1;
    lay.glyphs.forEach((g, i) => {
      const sp = g.ch === ' ';
      if (!sp && w0 < 0) w0 = i;
      if ((sp || i === lay.glyphs.length - 1) && w0 >= 0) {
        const last = sp ? i - 1 : i;
        const a = lay.glyphs[w0]!, b = lay.glyphs[last]!;
        this.words.push({ x0: a.x, w: b.x + b.w - a.x, text: text.slice(w0, last + 1) });
        w0 = -1;
      }
    });
    // atlas: one cell per glyph, padded so the widest shadow blur never reaches a neighbour
    const pad = Math.ceil(size * 0.35);
    const items: { g: (typeof lay.glyphs)[number]; cmds: PathCommand[]; bb: { x1: number; y1: number; x2: number; y2: number }; word: number }[] = [];
    let wi = 0;
    for (const g of lay.glyphs) {
      if (g.ch === ' ') { wi++; continue; }
      const p = f.charToGlyph(g.ch).getPath(0, 0, size);
      const bb = p.getBoundingBox();
      items.push({ g, cmds: p.commands, bb, word: wi });
    }
    const cellW = items.map((it) => Math.ceil(it.bb.x2 - it.bb.x1) + pad * 2);
    const top = Math.max(...items.map((it) => -it.bb.y1), 1), bot = Math.max(...items.map((it) => it.bb.y2), 0);
    this.aw = Math.max(4, cellW.reduce((a, b) => a + b, 0));
    this.ah = Math.ceil(top + bot) + pad * 2;
    const cv = document.createElement('canvas');
    cv.width = this.aw; cv.height = this.ah;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#fff';
    const geoMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: LETTER_VERT, fragmentShader: LETTER_FRAG,
      uniforms: {
        Lc: { value: new THREE.Vector3() }, LI: { value: 1 }, reach: { value: 6 }, glow: { value: 0 },
        lineFreq: { value: o.lineFreq ?? 0.075 }, rim: { value: 1 }, amb: { value: 0 },
      },
    });
    let ax = 0;
    items.forEach((it, k) => {
      const cx = (it.bb.x1 + it.bb.x2) / 2;
      // atlas: draw the outline (y down) with its pen origin at (ax + pad - x1, pad + top)
      const penAx = ax + pad - it.bb.x1, base = pad + top;
      const path = new Path2D(new PathShim(it.cmds).d);
      c.save(); c.translate(penAx, base); c.fill(path); c.restore();
      // mesh
      const shapes = glyphShapes(it.cmds, div);
      const geo = new THREE.ExtrudeGeometry(shapes, {
        depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 2, curveSegments: div, steps: 1,
      });
      geo.translate(-cx, 0, -depth / 2);
      geo.computeVertexNormals();
      const mat = geoMat.clone();
      mat.uniforms = THREE.UniformsUtils.clone(geoMat.uniforms);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.letters.push({
        ch: it.g.ch, mesh, mat, box: [it.bb.x1 - cx, -it.bb.y2, it.bb.x2 - cx, -it.bb.y1],
        ox: penAx + cx, oy: base, penX: it.g.x + cx, word: it.word, i: it.g.i,
        x: 0, z: 0, y: 0, yaw: 0, hinge: 0, s: 0.01, on: 1,
      });
      ax += cellW[k]!;
    });
    this.atlas = new THREE.CanvasTexture(cv);
    this.atlas.flipY = false;
    this.atlas.colorSpace = THREE.NoColorSpace;
    this.atlas.generateMipmaps = true;
    this.atlas.minFilter = THREE.LinearMipmapLinearFilter;
    this.atlas.magFilter = THREE.LinearFilter;
    this.atlas.needsUpdate = true;
  }

  /** Applies the letters' poses to their meshes (call once per frame after posing). */
  update() {
    for (const l of this.letters) {
      const m = l.mesh;
      m.visible = l.on > 0.001;
      m.position.set(l.x, l.y, l.z);
      m.rotation.set(-l.hinge, l.yaw, 0, 'YXZ');
      m.scale.setScalar(l.s);
      m.updateMatrixWorld(true);
    }
  }

  /** Sets the light uniforms on every letter. */
  light(Lc: THREE.Vector3, LI: number, reach: number, rim = 1) {
    for (const l of this.letters) {
      const u = l.mat.uniforms;
      (u.Lc!.value as THREE.Vector3).copy(Lc);
      u.LI!.value = LI; u.reach!.value = reach; u.rim!.value = rim;
    }
  }
}

/** opentype path commands → SVG path data (Path2D), without going through opentype's Path class. */
class PathShim {
  d: string;
  constructor(cmds: PathCommand[]) {
    const r = (v: number) => +v.toFixed(2);
    this.d = cmds.map((c) => {
      if (c.type === 'M') return `M${r(c.x)} ${r(c.y)}`;
      if (c.type === 'L') return `L${r(c.x)} ${r(c.y)}`;
      if (c.type === 'Q') return `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}`;
      if (c.type === 'C') return `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}`;
      return 'Z';
    }).join('');
  }
}

// ---------------------------------------------------------------- the camera
export class StageCam {
  cam = new THREE.PerspectiveCamera(35, W / H, 0.05, 600);
  private v = new THREE.Vector3();
  /** Places the camera at `pos` looking at `at`, with a roll (radians) and a vertical fov (degrees). */
  set(pos: THREE.Vector3Like, at: THREE.Vector3Like, fov = 35, roll = 0, up: THREE.Vector3Like = { x: 0, y: 1, z: 0 }) {
    const c = this.cam;
    c.fov = fov; c.updateProjectionMatrix();
    c.position.set(pos.x, pos.y, pos.z);
    c.up.set(up.x, up.y, up.z).normalize();
    c.lookAt(at.x, at.y, at.z);
    if (roll) c.rotateZ(roll);
    c.updateMatrixWorld(true);
  }
  /** Places the camera at `pos` with an orientation quaternion. */
  setQ(pos: THREE.Vector3Like, q: THREE.Quaternion, fov = 35) {
    const c = this.cam;
    c.fov = fov; c.updateProjectionMatrix();
    c.position.set(pos.x, pos.y, pos.z);
    c.quaternion.copy(q);
    c.updateMatrixWorld(true);
  }
  /** The orientation a camera at `pos` looking at `at` with `up` would have. */
  static look(pos: THREE.Vector3Like, at: THREE.Vector3Like, up: THREE.Vector3Like = { x: 0, y: 1, z: 0 }) {
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(pos.x, pos.y, pos.z), new THREE.Vector3(at.x, at.y, at.z), new THREE.Vector3(up.x, up.y, up.z));
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }
  /** NDC → world (homogeneous): the shader's ray origin is the camera position. */
  invVP(m: THREE.Matrix4) { return m.multiplyMatrices(this.cam.matrixWorld, this.cam.projectionMatrixInverse); }
  /** World point → logical px (y down), plus its distance in front of the camera (negative behind). */
  project(p: THREE.Vector3Like) {
    const v = this.v.set(p.x, p.y, p.z);
    const depth = -v.clone().applyMatrix4(this.cam.matrixWorldInverse).z;
    v.project(this.cam);
    return { x: (v.x * 0.5 + 0.5) * W, y: (0.5 - v.y * 0.5) * H, depth };
  }
  /** Screen height (px) of a vertical world segment of length h standing at p. */
  pxHeight(p: THREE.Vector3Like, h: number) {
    const a = this.project(p), b = this.project({ x: p.x, y: p.y + h, z: p.z });
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
}

// ---------------------------------------------------------------- floor, walls, shadows
export interface StageLight {
  /** The flame's foot (world) and height (world units): the light sits a third of the way up the flame. */
  base: THREE.Vector3;
  h: number;
  I: number;
  reach: number;
}

export interface StageSurfaces {
  /** 0 none, 1 a plane z = wallZ facing +z, 2 inside a cylinder of radius R about (cx, cz). */
  wall: 0 | 1 | 2;
  wallZ?: number;
  cyl?: [number, number, number];
  /** Engraving lines per world unit on the floor (across z) and the wall (along y). */
  freqFloor?: number;
  freqWall?: number;
  /** 0..1: how much of the floor is drawn (the light's own pool fades in with it). */
  floor?: number;
}

/** Default surface hooks: no grooves, no extra shadows (scenes pass their own, see `Stage` options). */
export const STAGE_HOOKS_DEFAULT = /* glsl */ `
float carve(vec2 xz) { return 0.0; }
float extraShadow(vec3 P, bool wall) { return 0.0; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return col; }`;

const BG_FRAG = (hooks: string) => /* glsl */ `
uniform mat4 invVP; uniform vec3 camPos;
uniform vec3 Lc; uniform float LI, reach, rL;
uniform int wallMode; uniform float wallZ; uniform vec3 cyl;
uniform float freqF, freqW, floorOn;
uniform mat4 cardM[${MAX_CARDS}]; uniform vec4 cardBox[${MAX_CARDS}]; uniform vec4 cardMap[${MAX_CARDS}];
uniform float cardS[${MAX_CARDS}]; uniform int nCards; uniform sampler2D atlas;

float cardShadow(vec3 P) {
  float lit = 1.0;
  for (int i = 0; i < ${MAX_CARDS}; i++) {
    if (i >= nCards) break;
    vec3 p = (cardM[i] * vec4(P, 1.0)).xyz;
    vec3 l = (cardM[i] * vec4(Lc, 1.0)).xyz;
    if (p.z * l.z >= 0.0) continue;                       // the card isn't between this point and the light
    float s = p.z / (p.z - l.z);
    vec2 h = mix(p.xy, l.xy, s);
    vec4 b = cardBox[i];
    float rpx = rL * s / cardS[i];                        // the light's disc seen from P, cut by the card (font px)
    float m = rpx + 2.0;
    if (h.x < b.x - m || h.x > b.z + m || h.y < b.y - m || h.y > b.w + m) continue;
    vec2 uv = vec2(cardMap[i].x + h.x, cardMap[i].y - h.y) * cardMap[i].zw;
    float occ = textureLod(atlas, uv, log2(max(1.0, 2.0 * rpx))).a;
    lit *= 1.0 - occ;
  }
  return 1.0 - lit;
}

// engraving lines along u, each wPx wide on screen (logical px) whatever the distance: near the camera they stand
// apart as hairlines, toward the horizon they close up into a tone
float pxLines(float u, float wPx) {
  float fu = max(fwidth(u), 1e-7);
  return hatchD(u, sat(wPx * fu * PX_SCALE), fu);
}

vec3 warm(float b) {
  // the engraving's line colour by the light it catches: blood at the edge of the light, signal and ember in it,
  // bone only in the flame's own pool
  b = max(b, 0.0);
  vec3 c = mix(C_BLOOD * 0.55, C_SIGNAL * 0.7, smoothstep(0.02, 0.35, b));
  c = mix(c, C_EMBER * 0.85, smoothstep(0.3, 0.75, b));
  return mix(c, C_BONE * 0.95, smoothstep(0.7, 1.6, b));
}

// the current pixel's footprint on the surface (world units), for the hooks' anti-aliasing
float gPix = 0.01;

${hooks}

void main() {
  vec2 ndc = FRAG_PX / vec2(${W.toFixed(1)}, ${H.toFixed(1)}) * 2.0 - 1.0;
  vec4 q = invVP * vec4(ndc, 1.0, 1.0);
  vec3 D = normalize(q.xyz / q.w - camPos);
  float tG = (D.y < -1e-6 && floorOn > 0.0) ? -camPos.y / D.y : 1e9;
  float tW = 1e9;
  if (wallMode == 1 && D.z < -1e-6) tW = (wallZ - camPos.z) / D.z;
  if (wallMode == 2) {
    vec2 o = camPos.xz - cyl.xy, d = D.xz;
    float a = dot(d, d), b = dot(o, d), c = dot(o, o) - cyl.z * cyl.z;
    float disc = b * b - a * c;
    if (disc > 0.0 && a > 1e-8) tW = (-b + sqrt(disc)) / a;
  }
  vec3 col = C_INK;
  float tt = min(tG, tW);
  vec3 P0 = camPos + D * min(tt, 1e3);
  gPix = max(length(fwidth(P0)), 1e-5);
  if (tt < 1e8 && tt > 0.0) {
    vec3 P = P0;
    bool wall = tW < tG;
    vec3 N = vec3(0.0, 1.0, 0.0);
    float u;
    if (wall) {
      N = wallMode == 1 ? vec3(0.0, 0.0, 1.0) : vec3(cyl.x - P.x, 0.0, cyl.y - P.z) / cyl.z;
      float across = wallMode == 1 ? P.x : atan(P.z - cyl.y, P.x - cyl.x) * cyl.z;
      // strata: near-horizontal lines, gently warped like bedded rock
      u = P.y * freqW + 0.38 * snoise(vec2(across * 0.11, P.y * 0.19)) + 0.05 * snoise(vec2(across * 0.8, P.y * 1.5));
    } else {
      // the floor: lines across the view, the dust of the cave floor in a slow warp
      u = P.z * freqF + 0.3 * snoise(P.xz * 0.15) + 0.04 * snoise(P.xz * 1.2);
    }
    vec3 Lv = Lc - P; float d = length(Lv); Lv /= d;
    float fall = LI / (1.0 + (d / reach) * (d / reach) * 4.0);
    // grooves cut in the floor (letters, the meander): a height field lit by the flame, one wall bright, one dark
    float g = 0.0;
    if (!wall) {
      g = carve(P.xz);
      if (g > 0.0) {
        float e = 0.012;
        vec2 gr = vec2(carve(P.xz + vec2(e, 0.0)) - g, carve(P.xz + vec2(0.0, e)) - g) / e;
        N = normalize(vec3(0.05 * gr.x, 1.0, 0.05 * gr.y));
      }
    }
    float ndl = max(dot(N, Lv), 0.0);
    float light = fall * (wall ? (0.3 + 0.7 * ndl) : (0.45 + 0.55 * ndl));
    float occ = 1.0 - (1.0 - cardShadow(P)) * (1.0 - extraShadow(P, wall));
    float b = light * (1.0 - occ);
    // white-line engraving: hairlines that swell a little in the light and stop in the shadow
    float ink = pxLines(u, 0.6 + 1.9 * sat(b * 0.85)) * smoothstep(0.015, 0.09, b);
    col = mix(C_INK, warm(b) * min(1.0, 0.35 + b), ink);
    // a groove: its floor dark and finely cross-hatched, its walls hairlines (the one facing the flame bright)
    if (g > 0.0) {
      float wallM = sat(g * (1.0 - g) * 4.0);
      float facing = sat(ndl * 1.8 - 0.45);
      vec3 inG = warm(b * 0.6) * min(1.0, 0.3 + b) * 0.6 * pxLines((P.x + P.z) * freqF * 1.3, 0.5 + 1.1 * sat(b));
      col = mix(col, inG, smoothstep(0.55, 0.95, g));
      col = mix(col, warm(b * 1.25) * min(1.0, 0.45 + b), wallM * facing);
      col = mix(col, C_INK, wallM * (1.0 - facing) * 0.85);
    }
    // where the wall meets the floor: one engraved line
    if (wall) col += warm(light) * pxLine(abs(P.y) / max(fwidth(P.y), 1e-5), 0.6, 1.4) * 0.7 * min(light * 1.5, 1.0);
    col = surfaceTint(P, wall, b, col);
  }
  fragColor = vec4(col, 1.0);
}`;

/** The stage: a floor, an optional wall, the flame and a set of solid letters casting shadows. */
export class Stage {
  readonly cam = new StageCam();
  readonly scene = new THREE.Scene();
  readonly flame = new FlameSprite();
  readonly bg: FSPass;
  private m4 = new THREE.Matrix4();
  private Lc = new THREE.Vector3();
  words: Word3D[] = [];
  /** `hooks`: GLSL defining carve(xz), extraShadow(P, wall) and surfaceTint(P, wall, b, col) (see STAGE_HOOKS_DEFAULT),
   *  with their own uniforms passed in `uniforms`. */
  constructor(o: { hooks?: string; uniforms?: Record<string, THREE.IUniform> } = {}) {
    const arr = <T>(f: () => T) => Array.from({ length: MAX_CARDS }, f);
    this.bg = new FSPass(BG_FRAG(o.hooks ?? STAGE_HOOKS_DEFAULT), {
      ...(o.uniforms ?? {}),
      invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() },
      Lc: { value: new THREE.Vector3() }, LI: { value: 1 }, reach: { value: 6 }, rL: { value: 0.1 },
      wallMode: { value: 0 }, wallZ: { value: -10 }, cyl: { value: new THREE.Vector3(0, 0, 8) },
      freqF: { value: 7 }, freqW: { value: 5 }, floorOn: { value: 1 },
      cardM: { value: arr(() => new THREE.Matrix4()) }, cardBox: { value: arr(() => new THREE.Vector4()) },
      cardMap: { value: arr(() => new THREE.Vector4()) }, cardS: { value: arr(() => 1) }, nCards: { value: 0 },
      atlas: { value: null },
    });
  }

  add(w: Word3D) {
    this.words.push(w);
    this.scene.add(w.group);
    if (this.words.length === 1) this.bg.u.atlas!.value = w.atlas;
  }

  /** The light's centre for a flame foot and height. */
  lightCentre(L: StageLight) { return this.Lc.set(L.base.x, L.base.y + L.h * 0.33, L.base.z); }

  /**
   * Renders the stage into `out`: floor and wall (with the letters' shadows), then the flame and the letters
   * (the flame first when it stands behind them). The camera must be set; the letters posed and `update()`d.
   */
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, t: number, L: StageLight, S: StageSurfaces,
    o: { flameBehind?: boolean; flameSeed?: number; gust?: number; flameI?: number; rim?: number; noFlame?: boolean } = {}) {
    const u = this.bg.u;
    const Lc = this.lightCentre(L);
    this.cam.invVP(u.invVP!.value as THREE.Matrix4);
    (u.camPos!.value as THREE.Vector3).copy(this.cam.cam.position);
    (u.Lc!.value as THREE.Vector3).copy(Lc);
    u.LI!.value = L.I; u.reach!.value = L.reach; u.rL!.value = L.h * 0.22;
    u.wallMode!.value = S.wall; u.wallZ!.value = S.wallZ ?? -10;
    const cy = S.cyl ?? [0, 0, 8];
    (u.cyl!.value as THREE.Vector3).set(cy[0], cy[1], cy[2]);
    u.freqF!.value = S.freqFloor ?? 7; u.freqW!.value = S.freqWall ?? 5; u.floorOn!.value = S.floor ?? 1;
    // shadow cards (first word's atlas)
    let n = 0;
    const w0 = this.words[0];
    if (w0) for (const l of w0.letters) {
      if (n >= MAX_CARDS || l.on <= 0.001) continue;
      (u.cardM!.value as THREE.Matrix4[])[n]!.copy(this.m4.copy(l.mesh.matrixWorld).invert());
      (u.cardBox!.value as THREE.Vector4[])[n]!.set(...l.box);
      (u.cardMap!.value as THREE.Vector4[])[n]!.set(l.ox, l.oy, 1 / w0.aw, 1 / w0.ah);
      (u.cardS!.value as number[])[n] = l.s;
      n++;
    }
    u.nCards!.value = n;
    this.bg.render(renderer, out);
    for (const w of this.words) w.light(Lc, L.I, L.reach, o.rim ?? 1);
    const drawFlame = () => {
      if (o.noFlame) return;
      const p = this.cam.project(L.base);
      if (p.depth <= 0.05) return;
      const hpx = this.cam.pxHeight(L.base, L.h);
      this.flame.draw(renderer, out, p.x, p.y, hpx, t, { seed: o.flameSeed ?? 0, gust: o.gust ?? 0, intensity: o.flameI ?? 1 });
    };
    if (o.flameBehind) drawFlame();
    renderer.setRenderTarget(out);
    renderer.clearDepth();
    renderer.render(this.scene, this.cam.cam);
    if (!o.flameBehind) drawFlame();
  }
}

// ---------------------------------------------------------------- the small voice
/** The verse's small voice (the words around the hero): Archivo wide and light, bone. */
export const VOICE = { fam: () => F.archivo(112.5, 500), size: 56, track: 0.5 };

/**
 * Draws a phrase (some words of a line) left-aligned at (x, baseline y): each word appears as it is sung (a quick
 * rise and fade, never early) and the whole phrase leaves with `exit` (0..1: fades and slides up). `align` 0 left,
 * 0.5 centred, 1 right. Returns the phrase's width.
 */
export function drawPhrase(c: CanvasRenderingContext2D, words: Word[], t: number, x: number, y: number,
  o: { size?: number; fam?: string; exit?: number; align?: number; alpha?: number; color?: string } = {}) {
  const fam = o.fam ?? VOICE.fam(), size = o.size ?? VOICE.size;
  const text = words.map((w) => w.w).join(' ');
  const lay = layout(text, fam, size, VOICE.track);
  const x0 = x - lay.width * (o.align ?? 0);
  const exit = o.exit ?? 0, a0 = (o.alpha ?? 1) * (1 - exit);
  if (a0 <= 0) return lay.width;
  c.font = font(fam, size);
  c.textBaseline = 'alphabetic';
  c.letterSpacing = `${VOICE.track}px`;
  let gi = 0;
  for (const w of words) {
    const gx = lay.glyphs[gi]!.x;
    const a = prog(t, w.start - 0.02, w.start + 0.12);
    const rise = (1 - prog(t, w.start - 0.02, w.start + 0.22, ease.outCubic)) * 8 + exit * 14;
    if (a > 0) {
      c.fillStyle = o.color ?? rgba('bone', a * a0);
      if (o.color) c.globalAlpha = a * a0;
      c.fillText(w.w, x0 + gx, y + rise);
      c.globalAlpha = 1;
    }
    gi += Array.from(w.w).length + 1;
  }
  c.letterSpacing = '0px';
  return lay.width;
}

/** Vector keyframes: [time, [x, y, z], ease?] → interpolated vector (ease shapes the segment ending at a key). */
export function vkeys(t: number, ks: [number, [number, number, number], ((u: number) => number)?][]): THREE.Vector3 {
  const out = new THREE.Vector3();
  if (!ks.length) return out;
  if (t <= ks[0]![0]) return out.fromArray(ks[0]![1]);
  for (let i = 1; i < ks.length; i++) {
    const k = ks[i]!;
    if (t <= k[0]) {
      const p = ks[i - 1]!;
      const u = (k[2] ?? ease.inOutCubic)(clamp((t - p[0]) / (k[0] - p[0])));
      return out.set(p[1][0] + (k[1][0] - p[1][0]) * u, p[1][1] + (k[1][1] - p[1][1]) * u, p[1][2] + (k[1][2] - p[1][2]) * u);
    }
  }
  return out.fromArray(ks[ks.length - 1]![1]);
}
