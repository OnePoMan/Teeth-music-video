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
import { FSPass, makeRT, W, H } from '../engine/gl';
import { GLSL_COMMON } from '../engine/glsl/common';
import { F, font, layout, ot } from '../engine/type';
import type { Word } from '../engine/lyrics';
import { rgba } from '../engine/palette';
import { prog, ease, clamp } from '../engine/util';
import type { AudioData } from '../engine/audio';
import { FlameSprite, flameState } from './motifs';

export const MAX_CARDS = 40;
/** Atlases (Word3D runs) one stage can cast shadows from. */
export const MAX_ATLAS = 4;

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
uniform vec3 Lc, camPosL; uniform float LI, reach, glow, lineFreq, rim, amb, vaseL;
void main() {
  // (degenerate bevel triangles carry zero normals: guard them, or their NaN blooms into a white star)
  float nl = length(vNW);
  vec3 N = nl > 1e-6 ? vNW / nl : vec3(0.0, 0.0, 1.0);
  vec3 L = Lc - vW; float d = length(L); L /= d;
  float fall = LI / (1.0 + (d / reach) * (d / reach) * 4.0);
  float ndl = dot(N, L);
  float face = step(0.9, abs(vN.z) / max(length(vN), 1e-6));   // the letter's face (front or back) vs its sides
  float lit = pow(max(ndl, 0.0), 1.3) * fall;
  float tone = sat(lit * 1.35);
  // cut stone: the face bone in the light, the sides a step darker; where the light falls away, a black-line
  // engraving (horizontal on the face, along the depth on the sides) carries the shading
  vec3 base = mix(C_BONE * 0.72, C_BONE * 1.02, face);
  // faces: a fine engraving only in the shade; sides: coarser lines along the depth
  float lines = face > 0.5
    ? hatch(vP.y * lineFreq * 1.7, sat(0.36 - tone) * 1.3) * smoothstep(0.04, 0.14, tone)
    : hatch(vP.z * lineFreq * 1.6, sat(0.62 - tone) * 1.1) * smoothstep(0.08, 0.25, tone);
  // bone type stays crisp: the lit face tops out just under the bloom threshold
  vec3 col = base * min(tone, 0.82) * (1.0 - 0.85 * lines);
  // turned from the light, a letter is a silhouette: ink with a graphite hairline engraving and a burning rim
  float back = sat(-ndl);
  col += C_GRAPHITE * 0.018 * (1.0 - tone) * (1.0 - hatch(vP.y * lineFreq, 0.35));
  col += mix(C_SIGNAL, C_EMBER, 0.5) * rim * fall * pow(1.0 - abs(ndl), 6.0) * (1.0 - face) * 1.4;
  // the vase style: the face is added white on the pot (bone, unhatched), the sides black glaze with a sheen
  if (vaseL > 0.5) {
    vec3 Vv = normalize(camPosL - vW), Hh = normalize(L + Vv);
    float spec = pow(max(dot(N, Hh), 0.0), 90.0) * fall;
    vec3 faceC = C_BONE * min(tone, 0.82);
    vec3 sideC = C_INK * (0.5 + 0.5 * tone) + mix(C_EMBER, C_BONE, 0.5) * spec * 1.6;
    col = mix(sideC, faceC, face);
    col += mix(C_SIGNAL, C_EMBER, 0.5) * rim * fall * pow(1.0 - abs(ndl), 6.0) * (1.0 - face) * 1.2;
  }
  // afterglow: a sung letter keeps a little warm light of its own
  col += mix(C_BONE, C_EMBER, 0.3) * amb * (0.35 + 0.65 * face) * (1.0 - 0.5 * lines);
  col = mix(col, C_EMBER * 2.2, glow * (0.6 + 0.4 * face));
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
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
        lineFreq: { value: o.lineFreq ?? 0.12 }, rim: { value: 1 }, amb: { value: 0 }, vaseL: { value: 1 }, camPosL: { value: new THREE.Vector3() },
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

  /** Scales the light this run receives (0: a black silhouette, whatever the flame does). */
  lightMul = 1;
  /** Sets the light uniforms on every letter. */
  light(Lc: THREE.Vector3, LI: number, reach: number, rim = 1, camPos?: THREE.Vector3) {
    for (const l of this.letters) {
      const u = l.mat.uniforms;
      (u.Lc!.value as THREE.Vector3).copy(Lc);
      if (camPos) (u.camPosL!.value as THREE.Vector3).copy(camPos);
      u.LI!.value = LI * this.lightMul; u.reach!.value = reach; u.rim!.value = rim * this.lightMul;
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
  /** 0 engraved lines, 1 a continuous lit tone (plaster), for the wall and the floor (engraving style only). */
  toneWall?: number;
  toneFloor?: number;
  /** The vase style (default): clay walls, black-glaze floors. false: P(doom)'s engraving. */
  vase?: boolean;
  /** Vase style: how much of the floor's line field (floorLines) is painted, e.g. water's waves (default 0). */
  floorLines?: number;
  /** Vase style: how much the glaze mirrors the room (default 0.36). */
  gloss?: number;
  /** Water: swell amplitude (0 still glaze, 1 the sea's swells; they only bend the reflections), its wine-dark tint
   *  (0..1), and how far the swells push the mirrored scene (screen fraction per unit of tilt). */
  swell?: number;
  wine?: number;
  reflBend?: number;
}

/** Default surface hooks: no grooves, no extra shadows (scenes pass their own, see `Stage` options). */
export const STAGE_HOOKS_DEFAULT = /* glsl */ `
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
float extraShadow(vec3 P, bool wall) { return 0.0; }
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) { return col; }
vec3 skyTint(vec3 D, vec3 col) { return col; }`;

const BG_FRAG = (hooks: string) => /* glsl */ `
uniform mat4 invVP; uniform vec3 camPos;
uniform vec3 Lc; uniform float LI, reach, rL;
uniform int wallMode; uniform float wallZ; uniform vec3 cyl;
uniform float freqF, freqW, floorOn, toneW, toneF;
// the vase style: walls of lit clay (their shadows are black-figure), floors of black glaze that mirror the room,
// lines only as decoration reserved in the clay
uniform float vase, floorLineAmt, gloss, reflOn, flameOn, flameHpx, specK;
// water: swells that only bend what the surface mirrors (no lines on it), and Homer's wine-dark tint
uniform float swell, wine, reflBend, stageT;
uniform vec2 flamePx;
uniform sampler2D reflTex;
uniform mat4 cardM[${MAX_CARDS}]; uniform vec4 cardBox[${MAX_CARDS}]; uniform vec4 cardMap[${MAX_CARDS}];
uniform float cardS[${MAX_CARDS}]; uniform float cardAt[${MAX_CARDS}]; uniform int nCards;
uniform sampler2D atlas0, atlas1, atlas2, atlas3;
float atlasA(float k, vec2 uv, float lod) {
  if (k < 0.5) return textureLod(atlas0, uv, lod).a;
  if (k < 1.5) return textureLod(atlas1, uv, lod).a;
  if (k < 2.5) return textureLod(atlas2, uv, lod).a;
  return textureLod(atlas3, uv, lod).a;
}

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
    float occ = atlasA(cardAt[i], uv, log2(max(1.0, 2.0 * rpx)));
    lit *= 1.0 - occ;
  }
  return 1.0 - lit;
}

// engraving lines along u, each wPx wide on screen (logical px) whatever the distance: near the camera they stand
// apart as hairlines, toward the horizon they close up into a tone
float pxLines(float u, float wPx) {
  float fu = max(fwidth(u), 1e-7);
  float cover = sat(wPx * fu * PX_SCALE);
  // lines closer than ~3 px are drawn as their mean tone (no moire)
  return mix(hatchD(u, cover, fu), cover, smoothstep(0.28, 0.5, fu * PX_SCALE * 1.2));
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

/** The clay's orange, lit by b (a touch of white heat in the flame's own pool). */
vec3 clayCol(float b) {
  vec3 clay = mix(mix(C_BLOOD, C_SIGNAL, 0.75), C_EMBER, 0.2) * 0.8;
  return clay * (0.02 + 0.8 * sat(b)) + C_BONE * 0.08 * smoothstep(0.9, 1.8, b);
}
/** The water's swells: the gradient of a height field of three long swells and a finer chop, each term fading where
 *  it would alias. Nothing is drawn of them; they only bend the reflections. */
vec2 swellGrad(vec2 xz, float t) {
  vec2 d1 = vec2(0.287, 0.958), d2 = vec2(-0.514, 0.857), d3 = vec2(0.970, 0.243), g = vec2(0.0);
  g += d1 * 0.08 * cos(dot(xz, d1) * 0.8 + t * 0.9) * exp(-gPix * 3.2);
  g += d2 * 0.077 * cos(dot(xz, d2) * 1.7 - t * 1.3) * exp(-gPix * 6.8);
  g += d3 * 0.043 * cos(dot(xz, d3) * 3.6 + t * 2.1) * exp(-gPix * 14.4);
  return g;
}
const vec3 C_WINE = vec3(0.028, 0.0006, 0.0062);
/** Where a ray from o along r meets the wall (1e9: never). */
float wallHit(vec3 o, vec3 r) {
  if (wallMode == 1 && r.z < -1e-6) return (wallZ - o.z) / r.z;
  if (wallMode == 2) {
    vec2 oo = o.xz - cyl.xy, d = r.xz;
    float a = dot(d, d), b = dot(oo, d), c = dot(oo, oo) - cyl.z * cyl.z;
    float disc = b * b - a * c;
    if (disc > 0.0 && a > 1e-8) return (-b + sqrt(disc)) / a;
  }
  return 1e9;
}

${hooks}

/** A point of the clay wall, lit and shadowed (for the wall and for its mirror image in the glaze). */
vec3 clayWall(vec3 P, vec3 N, out float occ) {
  vec3 Lv = Lc - P; float d = length(Lv); Lv /= d;
  float fall = LI / (1.0 + (d / reach) * (d / reach) * 4.0);
  float light = fall * (0.3 + 0.7 * max(dot(N, Lv), 0.0));
  occ = 1.0 - (1.0 - cardShadow(P)) * (1.0 - extraShadow(P, true));
  float across = wallMode == 1 ? P.x : atan(P.z - cyl.y, P.x - cyl.x) * cyl.z;
  vec2 sp = vec2(across, P.y);
  float grain = 0.92 + 0.06 * snoise(sp * 1.1) + 0.04 * snoise(sp * 19.0);
#ifdef WALL_HOOK
  // a scene that paints its own wall (a backdrop) defines WALL_HOOK and wallHook(P, col) in its hooks
  return wallHook(P, clayCol(light * (1.0 - occ)) * grain);
#else
  return clayCol(light * (1.0 - occ)) * grain;
#endif
}
vec3 wallNormal(vec3 P) { return wallMode == 1 ? vec3(0.0, 0.0, 1.0) : vec3(cyl.x - P.x, 0.0, cyl.y - P.z) / cyl.z; }

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
      u = floorLines(P, P.z * freqF + 0.3 * snoise(P.xz * 0.15) + 0.04 * snoise(P.xz * 1.2));
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
    float occ, b;
    if (vase > 0.5) {
      if (wall) {
        col = clayWall(P, N, occ);
        b = light * (1.0 - occ);
      } else {
        occ = 1.0 - (1.0 - cardShadow(P)) * (1.0 - extraShadow(P, wall));
        b = light * (1.0 - occ);
        // black glaze: a little warmth where the flame is near, its highlight, and the room mirrored in it
        vec3 Nf = vec3(0.0, 1.0, 0.0), V = -D;
        if (swell > 0.0) { vec2 sg = swellGrad(P.xz, stageT) * swell; Nf = normalize(vec3(-sg.x, 1.0, -sg.y)); }
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(V, Nf), 0.0), 5.0);
        vec3 R = reflect(D, Nf);
        R.y = abs(R.y);
        float tR = wallHit(P, R);
        vec3 refl = C_INK;
        if (tR < 1e8) { float o3; vec3 PR = P + R * tR; refl = PR.y > 0.0 ? clayWall(PR, wallNormal(PR), o3) : C_INK; }
        else refl = skyTint(R, C_INK);
        if (reflOn > 0.0) {
          vec2 ruv = FRAG_PX / vec2(${W.toFixed(1)}, ${H.toFixed(1)}) + vec2(Nf.x, -Nf.z) * reflBend;
          vec4 rt = texture(reflTex, ruv);
          if (!(any(isnan(rt)) || any(isinf(rt)))) refl = mix(refl, rt.rgb, rt.a);
        }
        vec3 Hh = normalize(Lv + V);
        float spec = pow(max(dot(Nf, Hh), 0.0), 260.0) * fall * (1.0 - occ);
        col = mix(C_INK * 0.9, C_WINE, wine) + clayCol(b) * 0.05 + refl * fres * gloss + mix(C_EMBER, C_BONE, 0.45) * spec * 2.5 * specK;
        // the flame mirrored: a broken column under it
        if (flameOn > 0.0) {
          float dx = abs(FRAG_PX.x - flamePx.x), below = flamePx.y - FRAG_PX.y;
          float colm = exp(-dx / (4.0 + 0.04 * max(below, 0.0))) * smoothstep(0.0, 6.0, below) * exp(-max(below, 0.0) / (flameHpx * 1.6));
          col += mix(C_SIGNAL, C_EMBER, 0.6) * colm * flameOn * (0.4 + 0.6 * fres) * 1.2;
        }
        // decoration: grooves and bands reserved in the clay, and (for water) an optional painted line field
        float dec = carve(P.xz);
        if (floorLineAmt > 0.0) dec = max(dec, floorLineAmt * pxLines(u, 0.9 + 1.2 * sat(b)) * smoothstep(0.01, 0.06, b + 0.03));
        col = mix(col, clayCol(b * 1.15 + 0.06), sat(dec));
      }
      col = surfaceTint(P, wall, b, col);
      fragColor = vec4(col, 1.0);
      return;
    }
    occ = 1.0 - (1.0 - cardShadow(P)) * (1.0 - extraShadow(P, wall));
    b = light * (1.0 - occ);
    // white-line engraving: hairlines that swell a little in the light and stop in the shadow
    float ink = pxLines(u, 0.6 + 1.9 * sat(b * 0.85)) * smoothstep(0.015, 0.09, b);
    col = mix(C_INK, warm(b) * min(1.0, 0.35 + b), ink);
    // or a continuous tone: lime plaster lit by the flame, like a shadow-theatre screen (a little mottling and grain)
    float tone = wall ? toneW : toneF;
    if (tone > 0.0) {
      vec2 sp = wall ? vec2(P.x + P.z, P.y) : P.xz;
      float grain = 0.9 + 0.1 * snoise(sp * 1.3) + 0.05 * snoise(sp * 23.0);
      vec3 plaster = warm(b) * (0.03 + 0.42 * sat(b) * sat(b)) * grain;
      col = mix(col, plaster, tone);
    }
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
  } else {
    col = skyTint(D, col);
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
  private refl: THREE.WebGLRenderTarget | null = null;
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
      freqF: { value: 7 }, freqW: { value: 5 }, floorOn: { value: 1 }, toneW: { value: 0 }, toneF: { value: 0 },
      vase: { value: 1 }, floorLineAmt: { value: 0 }, gloss: { value: 0.36 }, reflOn: { value: 0 }, reflTex: { value: null },
      flameOn: { value: 0 }, flameHpx: { value: 60 }, flamePx: { value: new THREE.Vector2() }, specK: { value: 1 },
      swell: { value: 0 }, wine: { value: 0 }, reflBend: { value: 0.3 }, stageT: { value: 0 },
      cardM: { value: arr(() => new THREE.Matrix4()) }, cardBox: { value: arr(() => new THREE.Vector4()) },
      cardMap: { value: arr(() => new THREE.Vector4()) }, cardS: { value: arr(() => 1) }, cardAt: { value: arr(() => 0) }, nCards: { value: 0 },
      atlas0: { value: null }, atlas1: { value: null }, atlas2: { value: null }, atlas3: { value: null },
    });
  }

  /** Adds a run of letters to the stage; the first MAX_ATLAS runs cast shadows (pass `shadows: false` to skip one). */
  add(w: Word3D, o: { shadows?: boolean } = {}) {
    this.words.push(w);
    this.scene.add(w.group);
    if (o.shadows === false) return;
    const k = this.casters.length;
    if (k >= MAX_ATLAS) return;
    this.casters.push(w);
    for (let j = 0; j < MAX_ATLAS; j++) if (j >= k) this.bg.u[`atlas${j}`]!.value = w.atlas;   // unused slots keep a valid texture
  }
  private casters: Word3D[] = [];

  /** The light's centre for a flame foot and height. */
  lightCentre(L: StageLight) { return this.Lc.set(L.base.x, L.base.y + L.h * 0.33, L.base.z); }

  /**
   * Renders the stage into `out`: floor and wall (with the letters' shadows), then the flame and the letters
   * (the flame first when it stands behind them). The camera must be set; the letters posed and `update()`d.
   */
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, t: number, L: StageLight, S: StageSurfaces,
    o: { flameBehind?: boolean; flameSeed?: number; gust?: number; flameI?: number; rim?: number; noFlame?: boolean; cards?: boolean;
      /** Vase style: mirror the scene in the glaze (default true). */
      reflect?: boolean;
      /** The light's highlight on the glaze (default 1; keep it low for the unseen key light: its mirror image is a flame). */
      spec?: number;
      /** Where the flame stands on screen (logical px, y down) and its height, for scenes that draw their own. */
      flameScreen?: { x: number; y: number; h: number } } = {}) {
    const u = this.bg.u;
    const Lc = this.lightCentre(L);
    this.cam.invVP(u.invVP!.value as THREE.Matrix4);
    (u.camPos!.value as THREE.Vector3).copy(this.cam.cam.position);
    (u.Lc!.value as THREE.Vector3).copy(Lc);
    u.LI!.value = L.I; u.reach!.value = L.reach; u.rL!.value = L.h * 0.11;
    u.wallMode!.value = S.wall; u.wallZ!.value = S.wallZ ?? -10;
    const cy = S.cyl ?? [0, 0, 8];
    (u.cyl!.value as THREE.Vector3).set(cy[0], cy[1], cy[2]);
    u.freqF!.value = S.freqFloor ?? 7; u.freqW!.value = S.freqWall ?? 5; u.floorOn!.value = S.floor ?? 1;
    u.toneW!.value = S.toneWall ?? 0; u.toneF!.value = S.toneFloor ?? 0;
    u.vase!.value = S.vase === false ? 0 : 1;
    u.floorLineAmt!.value = S.floorLines ?? 0;
    u.gloss!.value = S.gloss ?? 0.36;
    u.specK!.value = o.spec ?? 1;
    u.swell!.value = S.swell ?? 0; u.wine!.value = S.wine ?? 0; u.reflBend!.value = S.reflBend ?? 0.3; u.stageT!.value = t;
    // shadow cards: every shown letter of every casting run
    let n = 0;
    if (o.cards !== false) this.casters.forEach((w, k) => {
      for (const l of w.letters) {
        if (n >= MAX_CARDS || l.on <= 0.001) continue;
        (u.cardM!.value as THREE.Matrix4[])[n]!.copy(this.m4.copy(l.mesh.matrixWorld).invert());
        (u.cardBox!.value as THREE.Vector4[])[n]!.set(...l.box);
        (u.cardMap!.value as THREE.Vector4[])[n]!.set(l.ox, l.oy, 1 / w.aw, 1 / w.ah);
        (u.cardS!.value as number[])[n] = l.s;
        (u.cardAt!.value as number[])[n] = k;
        n++;
      }
    });
    u.nCards!.value = n;
    for (const w of this.words) w.light(Lc, L.I, L.reach, o.rim ?? 1, this.cam.cam.position);
    // the glaze mirrors the room: the scene rendered upside down about the floor, read back by the floor shader
    const vase = S.vase !== false;
    if (vase && o.reflect !== false && this.scene.children.length) {
      this.refl ??= makeRT();
      renderer.setRenderTarget(this.refl);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      this.scene.scale.y = -1; this.scene.updateMatrixWorld(true);
      renderer.render(this.scene, this.cam.cam);
      this.scene.scale.y = 1; this.scene.updateMatrixWorld(true);
      u.reflTex!.value = this.refl.texture; u.reflOn!.value = 1;
    } else u.reflOn!.value = 0;
    // the flame's mirror column
    const fs = o.flameScreen ?? (() => {
      const p = this.cam.project(L.base);
      return p.depth > 0.05 ? { x: p.x, y: p.y, h: this.cam.pxHeight(L.base, L.h) } : null;
    })();
    if (fs && !(o.noFlame && !o.flameScreen)) {
      (u.flamePx!.value as THREE.Vector2).set(fs.x, H - fs.y); u.flameHpx!.value = fs.h; u.flameOn!.value = o.flameI ?? 1;
    } else u.flameOn!.value = 0;
    this.bg.render(renderer, out);
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

// ---------------------------------------------------------------- the key light
/**
 * The unseen key light (through-line A, docs/MONSTER.md): a fire behind the camera, over its right shoulder, never
 * in frame. It breathes and flares on the 'orch' hits as the flame did (flameState). Offsets are in the camera's
 * frame (right, back) and the world's (up); `I` scales its brightness.
 */
export function keyLight(cam: StageCam, au: AudioData, t: number,
  o: { right?: number; up?: number; back?: number; I?: number; reach?: number; seed?: number } = {}): StageLight {
  const m = cam.cam.matrixWorld;
  const right = new THREE.Vector3().setFromMatrixColumn(m, 0), back = new THREE.Vector3().setFromMatrixColumn(m, 2);
  const base = cam.cam.position.clone().addScaledVector(right, o.right ?? 1.8).addScaledVector(back, o.back ?? 3.0);
  base.y += o.up ?? 1.2;
  const fl = flameState(au, t, o.seed ?? 0);
  return { base, h: 0.6, I: (o.I ?? 1) * fl.I, reach: o.reach ?? 30 };
}

// ---------------------------------------------------------------- the pop
/**
 * Every word lands on its onset: its letters spring up from the floor fast (upright ~45 ms after the spring
 * starts), so the spring starts POP.lead before the sung onset and the letter is up as the syllable sounds.
 */
export const POP = { lead: 0.045, freq: 5.5, damp: 0.42, ripple: 0.014 };

/** Fold-up angle (pi/2 flat, 0 standing) for a letter whose word is sung at `onset`; `k` its index in the word. */
export function popHinge(t: number, onset: number, k = 0) {
  const t0 = onset - POP.lead + k * POP.ripple;
  return t < t0 ? Math.PI / 2 : (Math.PI / 2) * (1 - springStepFast(t - t0));
}
function springStepFast(x: number) {
  const w = 2 * Math.PI * POP.freq, z = POP.damp;
  return 1 - Math.exp(-z * w * x) * Math.cos(w * Math.sqrt(1 - z * z) * x);
}

/**
 * Poses a run of lyric words (a Word3D built from the words joined by spaces) and animates it: each word pops
 * up on its onset (letters rippling 14 ms apart), flashes ember, and after `exit` falls back flat and vanishes.
 * `place(l, i)` sets each letter's x, z, yaw, s (and y if needed).
 */
export function popWords(w: Word3D, onsets: number[], t: number, place: (l: Letter, i: number) => void,
  o: { exit?: number; exitDur?: number; glow?: number; amb?: number } = {}) {
  const exit = o.exit ?? 1e9, dur = o.exitDur ?? 0.22;
  const kInWord = new Map<number, number>();
  w.letters.forEach((l, i) => {
    place(l, i);
    const k = kInWord.get(l.word) ?? 0;
    kInWord.set(l.word, k + 1);
    const on = onsets[Math.min(l.word, onsets.length - 1)]!;
    const up = popHinge(t, on, k);
    const gone = prog(t, exit + k * 0.01, exit + k * 0.01 + dur, ease.inCubic);
    l.hinge = up + (Math.PI / 2 - up) * gone;
    l.on = t >= on - POP.lead + k * POP.ripple && gone < 0.999 ? 1 : 0;
    l.mat.uniforms.glow!.value = (o.glow ?? 0.45) * Math.pow(0.5, Math.max(0, t - on) / 0.16) * (t >= on - 0.02 ? 1 : 0) * l.on;
    if (o.amb !== undefined) l.mat.uniforms.amb!.value = o.amb;
  });
  w.update();
}

/** Places letters in a straight row standing on the floor: the row starts at (x0, z0), letters face `yaw`. */
export function row(x0: number, z0: number, yaw: number, s: number, y = 0) {
  const dx = Math.cos(yaw), dz = -Math.sin(yaw);
  return (l: Letter) => { l.x = x0 + dx * l.penX * s; l.z = z0 + dz * l.penX * s; l.y = y; l.yaw = yaw; l.s = s; };
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
