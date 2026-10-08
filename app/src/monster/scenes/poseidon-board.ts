// `poseidon` helpers: the god's board game (docs/verse2-plan.md). The sea seen from above as a game board: black
// mirror water, wine-dark, inside a clay border with a running-wave band; under the water a clay seabed where the
// sunk galleys lie painted in black-figure (the answer under the surface); the galley pieces (bone-faced tokens with
// black-glazed sides, hull-shaped, oars and a square sail); and the trident's shadow, cast by the fire behind us by a
// trident we never see.
// Everything here is local to the plate (the shared kit is being changed on another branch); see the plate's report
// for what should move into the kit.
import * as THREE from 'three';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_FIGURES } from '../figures';

/** The water's half extent (x, z), the clay border's width, the seabed's depth under the surface. */
export const BOARD = { hx: 3.6, hz: 2.3, bw: 0.62, depth: 0.45 };
/** The opening's clay wall (z), beyond the board's far edge. */
export const WALL_Z = -4.6;
/** Galley pieces / wrecks / ripple rings the shaders hold. */
export const NP = 12;
/** One painted wreck's length on the seabed (world units). */
export const WRECK_L = 1.05;

/**
 * The trident's shadow (shared by the board and the pieces). The trident lies in a plane over the board, out of
 * frame, between the fire and the board; we only see what it casts. In board coordinates (x, z): the hand that holds
 * it (triA.xy), the shaft's heading (triA.z, radians in xz), the distance from the hand to the crossbar (triA.w);
 * its scale (triB.x), how far it has lifted toward the fire (triB.y: the shadow grows about triC and blurs), its
 * strength (triB.z) and its penumbra (triB.w).
 */
export const GLSL_TRIDENT = /* glsl */ `
uniform vec4 triA, triB; uniform vec2 triC;
// the trident (its own units: the crossbar at the origin, the prongs up +y, the shaft down -y to length L)
float triSD(vec2 q, float L) {
  float d = sdSegment(q, vec2(0.0, -L), vec2(0.0, 0.15)) - 0.085;
  d = min(d, sdBox(q - vec2(0.0, 0.02), vec2(0.8, 0.1)));
  for (int i = 0; i < 3; i++) {
    float x = -0.75 + 0.75 * float(i), pt = (i == 1 ? 1.5 : 1.15);
    d = min(d, sdSegment(q, vec2(x, 0.0), vec2(x, pt)) - 0.075);
    vec2 b = q - vec2(x, pt);
    d = min(d, max(abs(b.x) * 1.5 + b.y - 0.26, -b.y - 0.22));                // a barbed point
  }
  // the ferrule where the head meets the shaft
  d = min(d, sdBox(q - vec2(0.0, -0.32), vec2(0.15, 0.22)));
  return d;
}
float triShadowAA(vec2 xz, float aa) {
  if (triB.z <= 0.0) return 0.0;
  float g = 1.0 + triB.y;
  vec2 p = triC + (xz - triC) / g;
  vec2 dir = vec2(cos(triA.z), sin(triA.z));
  vec2 r = p - (triA.xy + dir * triA.w);
  vec2 q = vec2(dot(r, vec2(-dir.y, dir.x)), dot(r, dir)) / triB.x;
  float d = triSD(q, triA.w / triB.x + 3.0) * triB.x * g;
  float w = max(aa * 0.75, triB.w + 0.18 * triB.y);
  return triB.z * (1.0 - smoothstep(-w, w, d));
}`;

/** The stage hooks: the board (water, seabed, clay border), the opening's wall with the god's silhouette. */
export const BOARD_HOOKS = GLSL_FIGURES + GLSL_TRIDENT + /* glsl */ `
#define HX ${BOARD.hx.toFixed(3)}
#define HZ ${BOARD.hz.toFixed(3)}
#define BW ${BOARD.bw.toFixed(3)}
#define DEPTH ${BOARD.depth.toFixed(3)}
uniform float godOn, clarity, tNow;
uniform vec4 godT;
uniform vec4 wreck[${NP}];
uniform vec4 ring[${NP}];
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
vec3 skyTint(vec3 D, vec3 col) { return col; }
// the opening: the god on the wall, from the opening's tableau (trident raised, the sea band before him, no galley)
float godShadow(vec2 p) {
  vec2 q = (p - godT.xy) / godT.z;
  if (abs(q.x) > 12.0 || q.y > 10.0 || q.y < -1.0) return 0.0;
  float d = poseidon(q, 1.0, 1.0, 0.0, 0.0, 0.0, vec4(0.0), 0.0, vec3(0.0)) * godT.z;
  float w = max(gPix * 0.75, 0.01);
  return 1.0 - smoothstep(-w, w, d);
}
float extraShadow(vec3 P, bool wall) {
  if (wall) return godOn > 0.0 ? godOn * godShadow(P.xy) : 0.0;
  return triShadowAA(P.xz, gPix);
}
// ripples where a piece went under: rings that only bend what the water mirrors (and the seabed seen through it)
vec2 ringGrad(vec2 xz) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < ${NP}; i++) {
    vec4 R = ring[i];
    float dt = tNow - R.z;
    if (R.w <= 0.0 || dt <= 0.0 || dt > 3.0) continue;
    vec2 v = xz - R.xy; float r = length(v);
    float s = r - 0.85 * dt;
    if (abs(s) > 0.7) continue;
    float a = R.w * exp(-dt / 0.9) * exp(-s * s / 0.06);
    float dh = a * (13.0 * cos(13.0 * s) - (2.0 * s / 0.06) * sin(13.0 * s));
    g += dh * v / max(r, 1e-3) * smoothstep(0.0, 0.15, r);
  }
  return g * exp(-gPix * 20.0);
}
// the sunk fleet, painted on the seabed in black-figure: each wreck a galley lying where it went down (galley() from
// figures.ts, its incisions scratched back to the clay)
float wrecks(vec2 xz, float aa) {
  float m = 0.0;
  for (int i = 0; i < ${NP}; i++) {
    vec4 W = wreck[i];
    if (W.w <= 0.0) continue;
    vec2 r = xz - W.xy;
    if (dot(r, r) > ${(WRECK_L * WRECK_L * 0.5).toFixed(3)}) continue;
    float k = ${(WRECK_L / 5.7).toFixed(4)};
    vec2 q = rot2(W.z) * r / k;
    float d = galley(q - vec2(0.0, 0.9)) * k;
    m = max(m, W.w * (1.0 - smoothstep(-aa, aa, d)));
  }
  return m;
}
// the board's edge: a running-wave band (black on the clay), between two rules
float waveBand(vec2 xz, float dIn, float aa) {
  vec2 a = abs(xz) - vec2(HX, HZ);
  bool side = a.x > a.y;
  float along = side ? xz.y * sign(xz.x) : -xz.x * sign(xz.y);
  float v = dIn / BW;
  float k = BW * 0.56 / 1.25;                                    // world units per band unit
  float y = (v - 0.2) * BW / k;
  float cx = mod(along / k + 0.8, 1.6) - 0.8;
  float d = min(y - 0.42, scroll(vec2(cx, y - 0.78), 0.34, -0.5, 0.085, 1.1));
  d = max(d, -y) * k;
  float ink = 1.0 - smoothstep(-aa, aa, d);
  if (a.x > 0.0 && a.y > 0.0) ink = 0.0;                         // the corners: plain clay
  float rules = max(1.0 - smoothstep(0.012 - aa, 0.012 + aa, abs(dIn - BW * 0.1)), 1.0 - smoothstep(0.012 - aa, 0.012 + aa, abs(dIn - BW * 0.9)));
  return max(ink, rules);
}
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  if (wall) return col;
  float aa = max(gPix, 1e-4);
  vec2 xz = P.xz;
  vec2 dq = abs(xz) - vec2(HX, HZ);
  float dBox = max(dq.x, dq.y);                                   // (square corners)
  if (dBox > BW + 2.0 * aa) return C_INK;
  // ---- the clay border, lit; the trident's shadow and the words' fall on it as black-figure
  vec3 clay = clayCol(b * 1.1 + 0.02);
  clay = mix(clay, C_INK * 0.85, waveBand(xz, max(dBox, 0.0), aa));
  // ---- the water: black glaze, wine-dark; it mirrors the pieces and the words; through it the clay seabed
  vec3 V = normalize(camPos - P);
  vec2 g = swellGrad(xz, stageT) * swell + ringGrad(xz);
  vec3 Nf = normalize(vec3(-g.x, 1.0, -g.y));
  float c1 = 1.0 - max(dot(V, Nf), 0.0);
  float fres = 0.04 + 0.96 * c1 * c1 * c1 * c1 * c1;
  vec2 ruv = FRAG_PX / vec2(1920.0, 1080.0) + vec2(Nf.x, -Nf.z) * reflBend;
  vec4 rt = vec4(0.0);
  if (reflOn > 0.0) { rt = texture(reflTex, ruv); if (any(isnan(rt)) || any(isinf(rt))) rt = vec4(0.0); }
  // the seabed: seen through the water a little displaced (depth, refraction, the swell)
  vec2 bed = xz - V.xz / max(V.y, 0.25) * DEPTH * 0.75 + vec2(Nf.x, Nf.z) * 0.6;
  float bb = b;
  vec3 floorC = clayCol(bb * 0.95 + 0.015);
  // (faint through the dark water: the fleet shows plainly only when the water clears)
  float wk = wrecks(bed, aa * 1.2) * (0.4 + 0.6 * smoothstep(0.3, 0.85, clarity));
  floorC = mix(floorC, C_INK * 0.7, wk);
  // the water absorbs: the bed reads wine-dark, deeper as the water darkens
  vec3 through = floorC * mix(vec3(0.55, 0.085, 0.12), vec3(0.42, 0.12, 0.15), smoothstep(0.3, 0.85, clarity));
  vec3 deep = mix(C_INK * 0.9, C_WINE, wine);
  vec3 water = mix(deep, through, clarity);
  water += rt.rgb * rt.a * max(fres, 0.22) * gloss;
  float m = smoothstep(-aa, aa, dBox);
  vec3 c = mix(water, clay, m);
  // the board's outer edge: a black line, then nothing (the board lies in the dark)
  c = mix(c, C_INK, 1.0 - smoothstep(0.01 - aa, 0.01 + aa, abs(dBox - BW + 0.01)));
  return mix(c, C_INK, smoothstep(BW - aa, BW + aa, dBox));
}`;

// ---------------------------------------------------------------- the galley pieces
const PIECE_VERT = /* glsl */ `
precision highp float;
in vec3 position; in vec3 normal;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
out vec3 vW; out vec3 vNW; out vec3 vP; out vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vNW = mat3(modelMatrix) * normal; vP = position; vN = normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const PIECE_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec3 vW; in vec3 vNW; in vec3 vP; in vec3 vN;
out vec4 fragColor;
${GLSL_COMMON}
${GLSL_TRIDENT}
uniform vec3 Lc, camPosL, faceAxis; uniform float LI, reach, glow, clipSign, kind;
void main() {
  // under the water nothing shows (and the mirror image shows only what is above it)
  if (vW.y * clipSign < -0.002) discard;
  // (degenerate bevel triangles carry zero normals: guard them)
  float nl = length(vNW);
  vec3 N = nl > 1e-6 ? vNW / nl : vec3(0.0, 1.0, 0.0);
  float ln = length(vN);
  vec3 n0 = ln > 1e-6 ? vN / ln : vec3(0.0, 1.0, 0.0);
  vec3 L = Lc - vW; float d = length(L); L /= max(d, 1e-5);
  float fall = LI / (1.0 + (d / reach) * (d / reach) * 4.0);
  float ndl = dot(N, L);
  // the trident's shadow falls on the pieces too (read where the piece stands, at the water)
  vec2 sxz = vec2(vW.x, vW.z);
  float sh = triShadowAA(sxz, 0.01);
  float lit = pow(max(ndl, 0.0), 1.3) * fall * (1.0 - 0.9 * sh);
  float tone = sat(lit * 1.35);
  float face = kind > 1.5 ? 0.0 : step(0.85, abs(dot(n0, faceAxis)));
  // the face: bone (added white), with a gangway down the hull; the sides black glaze with a narrow sheen
  vec3 faceC = C_BONE * min(0.08 + tone, 0.82);
  if (kind < 0.5) faceC = mix(faceC, C_INK * 0.6, (1.0 - smoothstep(0.008, 0.014, abs(vP.x))) * step(-0.3, vP.z) * step(vP.z, 0.28));
  vec3 V = normalize(camPosL - vW), Hh = normalize(L + V);
  float spec = pow(max(dot(N, Hh), 0.0), 90.0) * fall * (1.0 - sh);
  vec3 sideC = C_INK * (0.5 + 0.5 * tone) + mix(C_EMBER, C_BONE, 0.5) * spec * 0.5;
  vec3 col = mix(sideC, faceC, face);
  col = mix(col, C_EMBER * 2.0, glow * (0.5 + 0.5 * face));
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  fragColor = vec4(col, 1.0);
}`;

/** The uniforms of the trident's shadow (shared by reference between the board and every piece). */
export function tridentUniforms() {
  return { triA: { value: new THREE.Vector4() }, triB: { value: new THREE.Vector4(1, 0, 0, 0.02) }, triC: { value: new THREE.Vector2() } };
}

export interface Piece {
  grp: THREE.Group;
  sail: THREE.Mesh;
  mats: THREE.RawShaderMaterial[];
  glow: { value: number };
}

/** The galley pieces' shared uniforms: the light, the camera, the clip side (1 the scene, -1 its mirror image). */
export class Fleet {
  readonly shared = {
    Lc: { value: new THREE.Vector3() }, camPosL: { value: new THREE.Vector3() }, LI: { value: 1 }, reach: { value: 20 },
    clipSign: { value: 1 },
  };
  readonly pieces: Piece[] = [];
  private geo: { hull: THREE.BufferGeometry; sail: THREE.BufferGeometry; black: THREE.BufferGeometry };

  constructor(readonly tri: ReturnType<typeof tridentUniforms>, n: number, scene: THREE.Scene) {
    this.geo = buildPieceGeometry();
    for (let i = 0; i < n; i++) {
      const glow = { value: 0 };
      const mk = (kind: number, axis: [number, number, number]) => new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: PIECE_VERT, fragmentShader: PIECE_FRAG,
        uniforms: { ...this.shared, ...this.tri, glow, kind: { value: kind }, faceAxis: { value: new THREE.Vector3(...axis) } },
      });
      const mHull = mk(0, [0, 1, 0]), mSail = mk(1, [0, 0, 1]), mBlack = mk(2, [0, 1, 0]);
      mSail.side = THREE.DoubleSide;
      const grp = new THREE.Group();
      const hull = new THREE.Mesh(this.geo.hull, mHull), black = new THREE.Mesh(this.geo.black, mBlack);
      const sail = new THREE.Mesh(this.geo.sail, mSail);
      sail.position.set(0, SAIL.top, 0.02);
      sail.rotation.y = 0.55;                          // braced round, so its face shows to a camera off the bow
      for (const m of [hull, black, sail]) { m.frustumCulled = false; grp.add(m); }
      scene.add(grp);
      this.pieces.push({ grp, sail, mats: [mHull, mSail, mBlack], glow });
    }
  }

  light(Lc: THREE.Vector3, LI: number, reach: number, cam: THREE.Vector3) {
    this.shared.Lc.value.copy(Lc); this.shared.camPosL.value.copy(cam);
    this.shared.LI.value = LI; this.shared.reach.value = reach;
  }
}

/** The sail: its yard's height, its width and drop (it hangs from the yard, so it can be brailed up). */
export const SAIL = { top: 0.44, w: 0.36, h: 0.27 };

/** A galley piece (bow toward -z, the deck at y = H): the hull token, its oars, mast and yard, and its sail. */
function buildPieceGeometry() {
  const H = 0.085, w = 0.125;
  // the hull seen from above: a long lens, the ram at the bow, the stern drawn in to a point that curls up
  const pts: THREE.Vector2[] = [];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const y = -0.37 + (0.71 * i) / N;                  // stern -0.37 .. bow 0.34 (shape y = toward the bow)
    const u = (y + 0.015) / 0.36;
    pts.push(new THREE.Vector2(w * Math.sqrt(Math.max(0, 1 - u * u * u * u)) + 0.004, y));
  }
  const right = pts, left = pts.slice().reverse().map((p) => new THREE.Vector2(-p.x, p.y));
  const outline = [new THREE.Vector2(0, -0.43), ...right, new THREE.Vector2(0.028, 0.36), new THREE.Vector2(0, 0.47), new THREE.Vector2(-0.028, 0.36), ...left];
  const shape = new THREE.Shape(outline);
  const hull = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelOffset: -0.01, bevelSegments: 1, curveSegments: 4 });
  hull.rotateX(-Math.PI / 2);                          // extrusion → up, bow → -z
  hull.computeVertexNormals();
  // oars (five a side, raked aft), the mast and the yard: black
  const parts: THREE.BufferGeometry[] = [];
  for (let s = -1; s <= 1; s += 2) for (let k = 0; k < 5; k++) {
    const g = new THREE.BoxGeometry(0.16, 0.012, 0.016);
    g.rotateY(s * 0.32);
    g.translate(s * (w + 0.05), H * 0.55, -0.2 + 0.1 * k);
    parts.push(g);
  }
  const mast = new THREE.BoxGeometry(0.016, SAIL.top + 0.04 - H, 0.016); mast.translate(0, H + (SAIL.top + 0.04 - H) / 2, 0.02); parts.push(mast);
  const yard = new THREE.BoxGeometry(SAIL.w + 0.06, 0.014, 0.014); yard.translate(0, SAIL.top + 0.005, 0.02); parts.push(yard);
  const black = mergeBoxes(parts);
  // the sail hangs from the yard (its top at the origin)
  const sail = new THREE.BoxGeometry(SAIL.w, SAIL.h, 0.012); sail.translate(0, -SAIL.h / 2, 0);
  return { hull, sail, black };
}

/** Merges non-indexed copies of simple geometries (position + normal only). */
function mergeBoxes(gs: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [];
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...(g.getAttribute('position').array as Float32Array));
    nor.push(...(g.getAttribute('normal').array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}
