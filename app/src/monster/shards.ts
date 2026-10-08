// Shards: a word of solid letters (as `Word3D` builds them) broken into pieces of glazed pottery, for `change`.
// Each glyph is triangulated and cut by a few seeded straight fracture lines; the pieces on one side of every line
// and connected are one shard (slivers are merged into a neighbour). Each shard is extruded with three materials:
// its front added white (bone), its back black glaze, its broken sections the orange clay under the slip (the
// outline's own sides stay black glaze, as on the letters). Each shard is also a shadow card (`Letter`) for the
// stage, drawn in its own atlas cell; the atlas' colour channels carry, inside each shard, the glyph's incised
// contour (red, as hook's black-figure reflection) and the fracture lines along its broken edges (green).
// Everything is built once from a seed: no state from frame to frame.
import * as THREE from 'three';
import type { PathCommand } from 'opentype.js';
import { GLSL_COMMON } from '../engine/glsl/common';
import { layout, ot } from '../engine/type';
import { mulberry32 } from '../engine/util';
import { glyphShapes, type Letter } from './stage';

const SHARD_VERT = /* glsl */ `
precision highp float;
in vec3 position; in vec3 normal; in float part;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
out vec3 vW; out vec3 vNW; out vec3 vP; out vec3 vN; out float vPart;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vNW = mat3(modelMatrix) * normal; vP = position; vN = normal; vPart = part;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SHARD_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec3 vW; in vec3 vNW; in vec3 vP; in vec3 vN; in float vPart;
out vec4 fragColor;
${GLSL_COMMON}
uniform vec3 Lc, camPosL; uniform float LI, reach, rim;
// flip 1: the shard has turned over (its front is the black side now, its fractures incised to the clay)
// crackA: the fracture hairlines drawn on the face; crackR: how far they have run from crackO (word font px);
// glowK: their ember glow; rest: this shard's centre in the word (font px)
uniform float flip, crackA, crackR, glowK;
uniform vec2 crackO, rest;
uniform sampler2D atl; uniform vec4 amap;
vec3 clayLit(float tone) {
  vec3 clay = mix(mix(C_BLOOD, C_SIGNAL, 0.75), C_EMBER, 0.2);
  return clay * (0.1 + 0.8 * tone);
}
void main() {
  float nl = length(vNW);
  vec3 N = nl > 1e-6 ? vNW / nl : vec3(0.0, 0.0, 1.0);
  vec3 L = Lc - vW; float d = max(length(L), 1e-4); L /= d;
  float fall = LI / (1.0 + (d / reach) * (d / reach) * 4.0);
  float ndl = dot(N, L);
  float c = max(ndl, 0.0);
  float tone = sat(c * sqrt(c) * fall * 1.35);
  vec3 Vv = normalize(camPosL - vW), Hh = normalize(L + Vv);
  float nh = max(dot(N, Hh), 0.0);
  float spec = pow(nh, 90.0) * fall;
  float sheen = pow(nh, 600.0) * fall;
  vec4 tx = texture(atl, (amap.xy + vec2(vP.x, -vP.y)) * amap.zw);
  float ran = 1.0 - smoothstep(crackR - 30.0, crackR, length(rest + vP.xy - crackO));
  float crk = tx.g * ran;
  vec3 glaze = C_INK * (0.55 + 0.35 * tone) + mix(C_EMBER, C_BONE, 0.5) * sheen * 0.2;
  vec3 col;
  if (vPart < 1.5) {
    bool front = vPart < 0.5;
    bool bone = front ? flip < 0.5 : flip > 0.5;
    if (bone) {
      // added white; the fracture a fine dark hairline with the clay's orange in it
      col = C_BONE * min(tone, 0.82);
      col = mix(col, clayLit(tone) * 0.55, crk * crackA);
    } else if (front) {
      // turned over: black slip, the contour and the fractures incised back to the clay
      float inc = max(tx.r, tx.g);
      col = mix(glaze, clayLit(tone) * 0.95 + C_SIGNAL * 0.08, sat(inc));
    } else col = glaze;
    col = mix(col, C_EMBER * 2.2, glowK * crk);
  } else if (vPart < 2.5) {
    // the letter's own sides: black glaze, a sheen, a burning rim
    col = C_INK * (0.5 + 0.5 * tone) + mix(C_EMBER, C_BONE, 0.5) * spec * 1.6;
    float e = 1.0 - abs(ndl);
    float e2 = e * e, e3 = e2 * e;
    col += mix(C_SIGNAL, C_EMBER, 0.5) * rim * fall * e3 * e3 * 1.2;
  } else {
    // the broken section: the orange clay under the slip, a little grain
    float g = 0.88 + 0.12 * snoise(vP.xz * 0.21 + vP.y * 0.13);
    col = mix(clayLit(tone * 0.9 + 0.1), C_EMBER * (0.2 + 0.75 * tone), 0.3) * g;
    col = mix(col, C_EMBER * 2.0, glowK * 0.8);
  }
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  fragColor = vec4(col, 1.0);
}`;

/** One shard: a stage shadow card (`Letter`) plus where it sits in the word. */
export interface Shard extends Letter {
  /** Index of its glyph in the word. */
  glyph: number;
  /** Its centre in glyph-local font px (x from the glyph's ink centre, y up from the baseline) and in the word
   *  (x from the word's pen origin). */
  c: THREE.Vector2;
  wc: THREE.Vector2;
  /** Area (font px²) and a seeded random vector for its motion. */
  area: number;
  r: number[];
}

export interface ShardOpts {
  size?: number;
  depth?: number;
  div?: number;
  seed?: number;
  /** Fracture lines per glyph (by glyph index; default 4). */
  lines?: (i: number, ch: string) => number;
  /** Slivers smaller than this share of their glyph merge into a neighbour. */
  minShare?: number;
  /** Incised contour depths (fractions of the cap height, as Word3D's `incise`) and the fracture line width (font px). */
  incise?: [number, number];
  crackW?: number;
}

type V2 = THREE.Vector2;
const v2 = (x: number, y: number) => new THREE.Vector2(x, y);
const key = (p: V2) => `${Math.round(p.x * 64)},${Math.round(p.y * 64)}`;
const ekey = (a: V2, b: V2) => { const ka = key(a), kb = key(b); return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`; };
const area2 = (ps: V2[]) => { let a = 0; for (let i = 0; i < ps.length; i++) { const p = ps[i]!, q = ps[(i + 1) % ps.length]!; a += p.x * q.y - q.x * p.y; } return a / 2; };

/** Splits a convex polygon by the line n·p = c. Intersections are computed from the canonically ordered edge, so a
 *  shared edge of two polygons splits at the very same point. */
function splitConvex(ps: V2[], n: V2, c: number): [V2[], V2[]] {
  const a: V2[] = [], b: V2[] = [];
  const sd = (p: V2) => n.x * p.x + n.y * p.y - c;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!, q = ps[(i + 1) % ps.length]!;
    const dp = sd(p), dq = sd(q);
    if (dp >= 0) a.push(p); if (dp <= 0) b.push(p);
    if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) {
      const [u, w] = key(p) < key(q) ? [p, q] : [q, p];
      const du = sd(u), dw = sd(w);
      const x = u.clone().lerp(w, du / (du - dw));
      a.push(x); b.push(x);
    }
  }
  return [a, b];
}

/**
 * A word as shards. Shards are meshes in `group` (posed by the scene, which writes each mesh's matrix and the
 * `flip`, `glowK`, `crackA`, `crackR` uniforms); `letters` are the shards as stage shadow cards, so the class can be
 * passed to `Stage.add` like a `Word3D`.
 */
export class ShardWord {
  readonly letters: Shard[] = [];
  readonly group = new THREE.Group();
  readonly atlas: THREE.CanvasTexture;
  readonly aw: number; readonly ah: number;
  readonly width: number; readonly cap: number;
  /** Each glyph: its pen x of the ink centre (font px), its ink box (glyph-local), its fracture lines. */
  readonly glyphs: { ch: string; penX: number; box: [number, number, number, number]; lines: [number, number, number][] }[] = [];
  lightMul = 1;
  constructor(readonly text: string, family: string, o: ShardOpts = {}) {
    const size = o.size ?? 220, depth = o.depth ?? size * 0.045, div = o.div ?? 10, h = depth / 2;
    const rnd = mulberry32(o.seed ?? 7);
    const f = ot(family);
    const lay = layout(text, family, size, 0);
    const os2 = (f.tables as { os2?: { sCapHeight?: number } }).os2;
    this.cap = ((os2?.sCapHeight ?? f.unitsPerEm * 0.7) / f.unitsPerEm) * size;
    this.width = lay.width;
    const [inI, inO] = o.incise ?? [0.035, 0.047];
    const crackW = o.crackW ?? 1.6;

    interface Built { glyph: number; cmds: PathCommand[]; cx: number; polys: V2[][]; crack: [V2, V2][]; c: V2; area: number; box: [number, number, number, number] }
    const built: Built[] = [];
    let gi = 0;
    for (const g of lay.glyphs) {
      if (g.ch === ' ') continue;
      const p = f.charToGlyph(g.ch).getPath(0, 0, size);
      const bb = p.getBoundingBox();
      const cx = (bb.x1 + bb.x2) / 2;
      const box: [number, number, number, number] = [bb.x1 - cx, -bb.y2, bb.x2 - cx, -bb.y1];
      // triangulate the glyph (glyph-local: x from the ink centre, y up)
      const tris: V2[][] = [];
      for (const sh of glyphShapes(p.commands, div)) {
        const ex = sh.extractPoints(div);
        const contour = ex.shape.map((q) => v2(q.x - cx, q.y));
        const holes = ex.holes.map((hh) => hh.map((q) => v2(q.x - cx, q.y)));
        const all = contour.concat(...holes);
        const faces = THREE.ShapeUtils.triangulateShape(contour.slice(), holes.map((hh) => hh.slice()));
        for (const fc of faces) {
          const t = [all[fc[0]!]!, all[fc[1]!]!, all[fc[2]!]!];
          const a = area2(t);
          if (Math.abs(a) < 1e-4) continue;
          tris.push(a > 0 ? t : [t[0]!, t[2]!, t[1]!]);
        }
      }
      const gArea = tris.reduce((s, t) => s + area2(t), 0);
      // fracture lines: stratified angles, through points scattered about the ink box's middle
      const nL = o.lines?.(gi, g.ch) ?? 4;
      const W = box[2] - box[0], H = box[3] - box[1];
      const lines: [number, number, number][] = [];
      const a0 = rnd() * Math.PI;
      for (let j = 0; j < nL; j++) {
        const th = a0 + (j + 0.5 + (rnd() - 0.5) * 0.6) * (Math.PI / nL);
        const nx = Math.cos(th), ny = Math.sin(th);
        const px = box[0] + W * (0.5 + (rnd() - 0.5) * 0.6), py = box[1] + H * (0.5 + (rnd() - 0.5) * 0.7);
        lines.push([nx, ny, nx * px + ny * py]);
      }
      // split every triangle by every line; each piece carries its side of each line
      let pieces: { ps: V2[]; sig: number }[] = tris.map((ps) => ({ ps, sig: 0 }));
      lines.forEach(([nx, ny, c], j) => {
        const nxt: typeof pieces = [];
        for (const pc of pieces) {
          const [a, b] = splitConvex(pc.ps, v2(nx, ny), c);
          if (a.length >= 3 && Math.abs(area2(a)) > 1e-3) nxt.push({ ps: a, sig: pc.sig | (1 << j) });
          if (b.length >= 3 && Math.abs(area2(b)) > 1e-3) nxt.push({ ps: b, sig: pc.sig });
        }
        pieces = nxt;
      });
      // connected pieces on the same sides of every line are one shard
      const par = pieces.map((_, i) => i);
      const find = (i: number): number => (par[i] === i ? i : (par[i] = find(par[i]!)));
      const edges = new Map<string, number[]>();
      pieces.forEach((pc, i) => pc.ps.forEach((p, k) => {
        const kk = ekey(p, pc.ps[(k + 1) % pc.ps.length]!);
        const l = edges.get(kk); if (l) l.push(i); else edges.set(kk, [i]);
      }));
      for (const l of edges.values()) for (let k = 1; k < l.length; k++) if (pieces[l[0]!]!.sig === pieces[l[k]!]!.sig) par[find(l[k]!)] = find(l[0]!);
      // slivers merge into the neighbour they share the longest fracture with
      const pa = pieces.map((pc) => area2(pc.ps));
      for (let pass = 0; pass < 4; pass++) {
        const compA = new Map<number, number>();
        pieces.forEach((_, i) => compA.set(find(i), (compA.get(find(i)) ?? 0) + pa[i]!));
        let merged = false;
        for (const [r, a] of compA) {
          if (a >= gArea * (o.minShare ?? 0.05)) continue;
          const shared = new Map<number, number>();
          for (const [kk, l] of edges) {
            if (l.length < 2) continue;
            const ra = find(l[0]!), rb = find(l[1]!);
            if (ra === rb || (ra !== r && rb !== r)) continue;
            const other = ra === r ? rb : ra;
            const [s0, s1] = kk.split('|').map((s) => s.split(',').map(Number)) as [number[], number[]];
            shared.set(other, (shared.get(other) ?? 0) + Math.hypot(s0[0]! - s1[0]!, s0[1]! - s1[1]!));
          }
          let best = -1, bl = 0;
          for (const [k2, len] of shared) if (len > bl) { bl = len; best = k2; }
          if (best >= 0) { par[r] = best; merged = true; }
        }
        if (!merged) break;
      }
      const groups = new Map<number, number[]>();
      pieces.forEach((_, i) => { const r = find(i); const l = groups.get(r); if (l) l.push(i); else groups.set(r, [i]); });
      const onLine = (p: V2) => lines.some(([nx, ny, c]) => Math.abs(nx * p.x + ny * p.y - c) < 0.05);
      for (const ids of groups.values()) {
        const polys = ids.map((i) => pieces[i]!.ps);
        let A = 0; const C = v2(0, 0);
        for (const ps of polys) {
          const a = area2(ps);
          const pc = ps.reduce((s, p) => s.add(p), v2(0, 0)).multiplyScalar(1 / ps.length);
          A += a; C.addScaledVector(pc, a);
        }
        C.multiplyScalar(1 / A);
        // its boundary: edges used once within the shard; a boundary edge on a fracture line is a broken section
        const cnt = new Map<string, number>();
        for (const ps of polys) ps.forEach((p, k) => { const kk = ekey(p, ps[(k + 1) % ps.length]!); cnt.set(kk, (cnt.get(kk) ?? 0) + 1); });
        const crack: [V2, V2][] = [];
        for (const ps of polys) ps.forEach((p, k) => {
          const q = ps[(k + 1) % ps.length]!;
          if (cnt.get(ekey(p, q)) === 1 && onLine(p) && onLine(q)) crack.push([p, q]);
        });
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const ps of polys) for (const p of ps) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
        built.push({ glyph: gi, cmds: p.commands, cx, polys, crack, c: C, area: A, box: [x0 - C.x, y0 - C.y, x1 - C.x, y1 - C.y] });
      }
      this.glyphs.push({ ch: g.ch, penX: g.x + cx, box, lines });
      gi++;
    }

    // the atlas: one padded cell per shard, packed in rows
    const pad = Math.ceil(size * 0.2), maxW = 4096;
    let cx0 = 0, cy0 = 0, rowH = 0;
    const cells = built.map((b) => {
      const w = Math.ceil(b.box[2] - b.box[0]) + 2 * pad, hh = Math.ceil(b.box[3] - b.box[1]) + 2 * pad;
      if (cx0 + w > maxW) { cx0 = 0; cy0 += rowH; rowH = 0; }
      const cell = { ox: cx0 + pad - b.box[0], oy: cy0 + pad + b.box[3] };
      cx0 += w; rowH = Math.max(rowH, hh);
      return cell;
    });
    this.aw = maxW; this.ah = cy0 + rowH;
    const cv = document.createElement('canvas');
    cv.width = this.aw; cv.height = this.ah;
    const cg = cv.getContext('2d')!;
    const mat0 = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: SHARD_VERT, fragmentShader: SHARD_FRAG, side: THREE.DoubleSide,
      uniforms: {
        Lc: { value: new THREE.Vector3() }, camPosL: { value: new THREE.Vector3() }, LI: { value: 1 }, reach: { value: 6 }, rim: { value: 1 },
        flip: { value: 0 }, crackA: { value: 0 }, crackR: { value: 0 }, glowK: { value: 0 },
        crackO: { value: new THREE.Vector2() }, rest: { value: new THREE.Vector2() }, atl: { value: null }, amap: { value: new THREE.Vector4() },
      },
    });
    built.forEach((b, i) => {
      const { ox, oy } = cells[i]!;
      const G = this.glyphs[b.glyph]!;
      // the cell: the shard's mask, the glyph's incised contour (red) and the fracture lines (green) inside it
      const sp = new Path2D();
      for (const ps of b.polys) {
        ps.forEach((p, k) => (k ? sp.lineTo(p.x - b.c.x, p.y - b.c.y) : sp.moveTo(p.x - b.c.x, p.y - b.c.y)));
        sp.closePath();
      }
      cg.save();
      cg.translate(ox, oy); cg.scale(1, -1);
      cg.fillStyle = '#000'; cg.fill(sp, 'nonzero');
      cg.clip(sp, 'nonzero');
      cg.globalCompositeOperation = 'source-atop';
      cg.lineJoin = 'round'; cg.lineCap = 'round';
      cg.save();
      // the glyph's outline, from its pen origin: local = (x - cx - c.x, -yd - c.y)
      cg.translate(-b.cx - b.c.x, -b.c.y); cg.scale(1, -1);
      const gp = new Path2D(pathD(b.cmds));
      cg.strokeStyle = '#f00'; cg.lineWidth = 2 * inO * this.cap; cg.stroke(gp);
      cg.strokeStyle = '#000'; cg.lineWidth = 2 * inI * this.cap; cg.stroke(gp);
      cg.restore();
      cg.strokeStyle = '#0f0'; cg.lineWidth = 2 * crackW;
      cg.beginPath();
      for (const [p, q] of b.crack) { cg.moveTo(p.x - b.c.x, p.y - b.c.y); cg.lineTo(q.x - b.c.x, q.y - b.c.y); }
      cg.stroke();
      cg.restore();
      // the mesh: front (part 0), back (1), the outline's sides (2), the broken sections (3)
      const pos: number[] = [], nor: number[] = [], part: number[] = [];
      const tri = (a: number[], bb: number[], c: number[], n: number[], k: number) => {
        pos.push(...a, ...bb, ...c); for (let j = 0; j < 3; j++) { nor.push(...n); part.push(k); }
      };
      const cnt = new Map<string, number>();
      for (const ps of b.polys) ps.forEach((p, k) => { const kk = ekey(p, ps[(k + 1) % ps.length]!); cnt.set(kk, (cnt.get(kk) ?? 0) + 1); });
      const crackSet = new Set(b.crack.map(([p, q]) => ekey(p, q)));
      for (const ps0 of b.polys) {
        const ps = ps0.map((p) => [p.x - b.c.x, p.y - b.c.y] as [number, number]);
        for (let k = 1; k < ps.length - 1; k++) {
          const A = ps[0]!, B = ps[k]!, C = ps[k + 1]!;
          tri([A[0], A[1], h], [B[0], B[1], h], [C[0], C[1], h], [0, 0, 1], 0);
          tri([A[0], A[1], -h], [C[0], C[1], -h], [B[0], B[1], -h], [0, 0, -1], 1);
        }
        ps0.forEach((p, k) => {
          const q = ps0[(k + 1) % ps0.length]!;
          const kk = ekey(p, q);
          if (cnt.get(kk) !== 1) return;
          const ax = p.x - b.c.x, ay = p.y - b.c.y, bx = q.x - b.c.x, by = q.y - b.c.y;
          const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy);
          if (l < 1e-6) return;
          const n = [dy / l, -dx / l, 0], kind = crackSet.has(kk) ? 3 : 2;
          tri([ax, ay, h], [ax, ay, -h], [bx, by, -h], n, kind);
          tri([ax, ay, h], [bx, by, -h], [bx, by, h], n, kind);
        });
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('part', new THREE.Float32BufferAttribute(part, 1));
      const mat = mat0.clone();
      mat.uniforms = THREE.UniformsUtils.clone(mat0.uniforms);
      (mat.uniforms.amap!.value as THREE.Vector4).set(ox, oy, 1 / this.aw, 1 / this.ah);
      const wc = v2(G.penX + b.c.x, b.c.y);
      (mat.uniforms.rest!.value as THREE.Vector2).copy(wc);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      this.letters.push({
        ch: G.ch, mesh, mat, box: b.box, ox, oy, penX: wc.x, word: 0, i,
        x: 0, z: 0, y: 0, yaw: 0, hinge: 0, s: 0.01, on: 1,
        glyph: b.glyph, c: b.c, wc, area: b.area, r: Array.from({ length: 8 }, () => rnd()),
      });
    });
    this.atlas = new THREE.CanvasTexture(cv);
    this.atlas.flipY = false;
    this.atlas.colorSpace = THREE.NoColorSpace;
    this.atlas.generateMipmaps = true;
    this.atlas.minFilter = THREE.LinearMipmapLinearFilter;
    this.atlas.magFilter = THREE.LinearFilter;
    this.atlas.anisotropy = 4;
    this.atlas.needsUpdate = true;
    // (set after cloning: cloned uniforms would copy the texture once per shard)
    for (const l of this.letters) l.mat.uniforms.atl!.value = this.atlas;
  }

  /** Each shard's pose is written by the scene (mesh.matrix); this only refreshes the world matrices. */
  update() {
    for (const l of this.letters) { l.mesh.visible = l.on > 0.001; l.mesh.updateMatrixWorld(true); }
  }

  light(Lc: THREE.Vector3, LI: number, reach: number, rim = 1, camPos?: THREE.Vector3) {
    for (const l of this.letters) {
      const u = l.mat.uniforms;
      (u.Lc!.value as THREE.Vector3).copy(Lc);
      if (camPos) (u.camPosL!.value as THREE.Vector3).copy(camPos);
      u.LI!.value = LI * this.lightMul; u.reach!.value = reach; u.rim!.value = rim * this.lightMul;
    }
  }
}

function pathD(cmds: PathCommand[]) {
  const r = (v: number) => +v.toFixed(2);
  return cmds.map((c) => {
    if (c.type === 'M') return `M${r(c.x)} ${r(c.y)}`;
    if (c.type === 'L') return `L${r(c.x)} ${r(c.y)}`;
    if (c.type === 'Q') return `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}`;
    if (c.type === 'C') return `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}`;
    return 'Z';
  }).join('');
}
