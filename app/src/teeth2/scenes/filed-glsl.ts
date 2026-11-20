// Plate 14 `filed`: shaders.
//  DESK_FRAG  174.77 – 186.85, inside folder 08-32: the hanging folder lying open on a dark bench under one overhead
//             fluorescent fitting (an opal diffuser panel), his three exhibits (the radiograph, the cast's photograph,
//             his chart) turned into it, the back panel closing over them. Everything is a rectangle, traced
//             analytically (no march): the folder's two panels and rods, the tab (typed label in front, the lyric
//             written on its back), the exhibits with their prints and the TEETH / monogram overlay; soft shadows from
//             four jittered points on the panel per tap. Output: linear colour, view depth in alpha (for DOF_FRAG).
//  BANK_FRAG  186.85 – 193.76, the carry: plate 1's march (drawer-glsl.ts MARCH_FRAG), patched so that folder 08-32
//             can leave its slot (a rigid offset and yaw, drawn outside the drawer's bounds while carried). With the
//             carry off the patch is a no-op, so the same pass also renders the mirrored riff.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL, W, H } from '../../engine/gl';
import { LAY, MARCH_FRAG } from './drawer-glsl';

const f = (x: number) => x.toFixed(4);

/** Desk layout (m): the bench top is y = 0, the folder's fold on z = 0, the near panel N on z in [0, PH] (+z is the
 *  camera side), the far panel F hinged on the fold (phi = 0 lying open on z < 0, pi closed over N). */
export const DESK = {
  PH: 0.236, PW: 0.1855, YN: 0.0008, YF: 0.0045,
  /** the tab on F's top edge (as plate 1's: across the folder, half sizes, the typed insert) */
  TABX: LAY.TABX, TABW: LAY.TABW, TABH: 0.0145, TAB0: -0.004, INSW: LAY.INSW, INSH: LAY.INSH,
  /** the light: an opal diffuser panel over the bench, centre and half sizes (x, z) */
  LC: [0.0, 0.86, 0.42] as const, LS: [0.42, 0.11] as const,
};

/** Throws if a patch anchor has drifted (plate 1's shader is read-only: a silent miss would break the carry). */
function patch(src: string, from: string, to: string) {
  if (!src.includes(from)) throw new Error(`filed-glsl: patch anchor not found: ${from.slice(0, 60)}`);
  return src.replace(from, to);
}

let bank = MARCH_FRAG;
bank = patch(bank, 'uniform float openZ, lift08,', 'uniform vec3 c08off; uniform float c08yaw, carry08, c08zmax;\nuniform float openZ, lift08,');
bank = patch(bank, '// ---------------------------------------------------------------- the open drawer and its folders', `
/** 08-32's carry: its frame (relative to its rod in the slot) offset and turned about the vertical. */
vec3 carryXf(vec3 f) {
  f -= c08off;
  float c = cos(c08yaw), s = sin(c08yaw);
  return vec3(c * f.x - s * f.z, f.y, s * f.x + c * f.z);
}
// ---------------------------------------------------------------- the open drawer and its folders`);
bank = patch(bank, '  vec3 f = q - vec3(0.0, YR + up, zk);\n  f.yz = tiltYZ(f.yz, a);', '  vec3 f = q - vec3(0.0, YR + up, zk);\n  if (k == K0832) f = carryXf(f);\n  f.yz = tiltYZ(f.yz, a);');
bank = patch(bank, 'for (int k = k0; k <= k1; k++) r = opU(r, folder(q, k));', 'for (int k = k0; k <= k1; k++) { if (k == K0832 && carry08 > 0.5) continue; r = opU(r, folder(q, k)); }');
bank = patch(bank, '  if (bb < r.x) r = opU(r, openDrawer(p));\n  return r;', `  if (bb < r.x) r = opU(r, openDrawer(p));
  if (carry08 > 0.5) {
    vec3 q = p - vec3(0.0, 0.0, openZ);
    vec3 c = vec3(0.0, YR + lift08 - 0.1, -FZ0 - float(K0832) * FDZ) + c08off;
    if (dBox(q - c, vec3(0.26, 0.2, 0.26)) < r.x) r = opU(r, folder(q, K0832));
  }
  return r;`);
bank = patch(bank, '  float zmax = max(openZ, 0.0) + 0.1;', '  float zmax = max(max(openZ, 0.0) + 0.1, c08zmax);');
bank = patch(bank, '  vec3 f = q - vec3(0.0, YR + lift08, -FZ0 - float(K0832) * FDZ + fzs[K0832]);\n  f.yz = tiltYZ(f.yz, ftilt[K0832]);',
  '  vec3 f = q - vec3(0.0, YR + lift08, -FZ0 - float(K0832) * FDZ + fzs[K0832]);\n  f = carryXf(f);\n  f.yz = tiltYZ(f.yz, ftilt[K0832]);');
export const BANK_FRAG = bank;

export const DESK_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform vec3 exC[3], exX[3], exY[3]; uniform vec2 exS[3];
uniform float exOn[3], exInk[3], exSnap[3], exMono[3];
uniform sampler2D radTex, castTex, chartTex, ov0, ov1, ov2, labelTex, lyrTex;
uniform vec4 castWin, castCrop;   // the photograph's window on the print, and the part of the photograph printed (uv min, max)
uniform float phiF, litK, ambK;

const float PH = ${f(DESK.PH)}, PW = ${f(DESK.PW)}, YN = ${f(DESK.YN)}, YF = ${f(DESK.YF)};
const float TABX = ${f(DESK.TABX)}, TABW = ${f(DESK.TABW)}, TABH = ${f(DESK.TABH)}, TAB0 = ${f(DESK.TAB0)};
const float INSW = ${f(DESK.INSW)}, INSH = ${f(DESK.INSH)};
const vec3 LC = vec3(${DESK.LC.map(f).join(',')}); const vec2 LS = vec2(${DESK.LS.map(f).join(',')});
const int ID_NONE = 0, ID_BENCH = 1, ID_N = 2, ID_F = 3, ID_NROD = 4, ID_FROD = 5, ID_TAB = 6, ID_LIGHT = 7, ID_EX = 10;

struct Hit { float t; int id; vec2 l; bool front; vec3 n; };

void rect(vec3 ro, vec3 rd, vec3 C, vec3 X, vec3 Y, vec2 S, int id, inout Hit h) {
  vec3 N = cross(X, Y);
  float dn = dot(rd, N);
  if (abs(dn) < 1e-7) return;
  float t = dot(C - ro, N) / dn;
  if (t <= 1e-5 || t >= h.t) return;
  vec3 p = ro + rd * t - C;
  vec2 l = vec2(dot(p, X), dot(p, Y));
  if (abs(l.x) > S.x || abs(l.y) > S.y) return;
  h.t = t; h.id = id; h.l = l; h.front = dn < 0.0; h.n = dn < 0.0 ? N : -N;
}

vec3 vF() { return vec3(0.0, sin(phiF), -cos(phiF)); }

/** Everything that can shade another surface: the exhibits, F and its tab. */
void occluders(vec3 ro, vec3 rd, inout Hit h) {
  vec3 v = vF(), X = vec3(1.0, 0.0, 0.0), O = vec3(0.0, YF, 0.0);
  rect(ro, rd, O + v * (PH * 0.5), X, v, vec2(PW, PH * 0.5), ID_F, h);
  rect(ro, rd, vec3(TABX, YF, 0.0) + v * (PH + TAB0 + TABH), X, v, vec2(TABW, TABH), ID_TAB, h);
  for (int i = 0; i < 3; i++) if (exOn[i] > 0.5) rect(ro, rd, exC[i], exX[i], exY[i], exS[i], ID_EX + i, h);
}

Hit trace(vec3 ro, vec3 rd) {
  Hit h; h.t = 1e9; h.id = ID_NONE; h.l = vec2(0.0); h.front = true; h.n = vec3(0.0, 1.0, 0.0);
  if (rd.y < 0.0) { float t = -ro.y / rd.y; if (t < h.t) { h.t = t; h.id = ID_BENCH; h.n = vec3(0.0, 1.0, 0.0); vec3 p = ro + rd * t; h.l = p.xz; } }
  vec3 X = vec3(1.0, 0.0, 0.0), Z = vec3(0.0, 0.0, 1.0);
  rect(ro, rd, vec3(0.0, YN, PH * 0.5), X, Z, vec2(PW, PH * 0.5), ID_N, h);
  rect(ro, rd, vec3(0.0, YN + 0.0012, PH + 0.0015), X, Z, vec2(PW + 0.011, 0.0022), ID_NROD, h);
  vec3 v = vF();
  rect(ro, rd, vec3(0.0, YF, 0.0) + v * (PH + 0.0015) + vec3(0.0, 0.0012, 0.0) * cos(phiF), X, v, vec2(PW + 0.011, 0.0022), ID_FROD, h);
  occluders(ro, rd, h);
  rect(ro, rd, LC, X, Z, LS, ID_LIGHT, h);
  return h;
}

float shadowRay(vec3 P, vec3 L, float d) {
  Hit h; h.t = d; h.id = ID_NONE; h.l = vec2(0.0); h.front = true; h.n = vec3(0.0);
  occluders(P, L, h);
  return h.id == ID_NONE ? 1.0 : 0.0;
}

/** Diffuse light from the panel (and its shadows) at P, normal n. */
vec3 direct(vec3 P, vec3 n, float tap) {
  float acc = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 j = vec2(float(i % 2), float(i / 2));
    j = (j + vec2(hash12(FRAG_PX * 0.913 + vec2(tap * 7.1, float(i) * 3.3)), hash12(FRAG_PX * 1.37 + vec2(float(i) * 5.7, tap * 2.9)))) - 1.0;
    vec3 Lp = LC + vec3(j.x * LS.x, 0.0, j.y * LS.y);
    vec3 L = Lp - P; float d2 = dot(L, L); float d = sqrt(d2); L /= d;
    float cs = dot(n, L);
    if (cs <= 0.0 || L.y <= 0.0) continue;
    acc += cs * L.y / d2 * shadowRay(P + n * 0.0004, L, d - 0.001);
  }
  return T_LIGHTBOX * litK * acc * LS.x * LS.y;   // 4 samples of the 4·LS.x·LS.y panel
}

/** The panel seen in a glossy reflection (crisp: lamp reflections are shapes, not orbs). */
float panelRefl(vec3 P, vec3 R) {
  if (R.y <= 0.0) return 0.0;
  float t = (LC.y - P.y) / R.y;
  vec2 q = (P + R * t).xz - LC.xz;
  vec2 e = abs(q) - LS;
  return 1.0 - smoothstep(-0.004, 0.004, max(e.x, e.y));
}

vec3 pressboard(vec3 P, vec2 l) {
  float fib = snoise(vec3(l.x * 900.0, l.y * 160.0, P.y * 50.0)) * 0.5 + snoise(vec3(l * 60.0, 1.3)) * 0.5;
  return mix(T_SILVER, T_HALIDE, 0.42) * (0.62 + 0.05 * fib);
}

/** An exhibit's face: its print, then the overlay (R heavy TEETH, G light TEETH, B monogram). */
vec3 exFace(int i, vec2 uv, vec3 P, out float gloss) {
  vec3 col; vec4 ov;
  gloss = 0.0;
  if (i == 0) {
    // the radiograph in its white film mount, viewed as a print: teeth and metal light, the base a cold slate
    vec3 d = texture(radTex, uv).rgb;
    float dn = sat(0.95 * d.r + 0.32 * d.g + 1.2 * d.b);
    col = mix(T_FILM2 * 1.1 + T_SILVER * 0.16, T_LIGHTBOX * 0.88, pow(dn, 0.85));
    col *= 0.96 + 0.04 * snoise(vec3(uv * 300.0, 2.0));
    gloss = 0.5;
    ov = texture(ov0, uv);
  } else if (i == 1) {
    vec2 w = (uv - castWin.xy) / (castWin.zw - castWin.xy);
    bool inW = all(greaterThan(w, vec2(0.0))) && all(lessThan(w, vec2(1.0)));
    col = inW ? texture(castTex, mix(castCrop.xy, castCrop.zw, w)).rgb : T_LIGHTBOX * 0.84;
    gloss = 0.22;
    ov = texture(ov1, uv);
  } else {
    vec3 c = texture(chartTex, uv).rgb;
    col = T_LIGHTBOX * (0.86 + 0.02 * snoise(vec3(uv * 500.0, 4.0)));
    col = mix(col, T_SILVER * 0.7, c.b * 0.75);
    col = mix(col, T_FILM * 0.6, c.r);
    ov = texture(ov2, uv);
  }
  float ink = mix(ov.g, ov.r, exSnap[i]) * exInk[i];
  col = mix(col, T_FILM * 0.22, ink);
  vec3 mono = mix(T_FILM * 0.35, T_MATCH * 0.82, exMono[i]);
  col = mix(col, mono, ov.b * exInk[i]);
  return col;
}

vec4 shade(vec3 ro, vec3 rd, float tap) {
  Hit h = trace(ro, rd);
  if (h.id == ID_NONE) return vec4(T_FILM * 0.4, 30.0);
  if (h.id == ID_LIGHT) return vec4(T_LIGHTBOX * 0.95, 30.0);
  vec3 P = ro + rd * h.t, n = h.n;
  vec3 alb = vec3(0.1); float gloss = 0.0;
  if (h.id == ID_BENCH) {
    // a dark linoleum bench top, worn to a satin
    alb = T_FILM2 * (1.15 + 0.12 * snoise(vec3(P.xz * 22.0, 0.5)) + 0.05 * snoise(vec3(P.xz * 300.0, 1.5)));
    gloss = 0.06;
  } else if (h.id == ID_N || h.id == ID_F) {
    alb = pressboard(P, h.l);
    // the scored fold line along the hem, a shade darker
    alb *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.0015, abs(h.l.y - (PH * 0.5 - 0.0075))));
  } else if (h.id == ID_NROD || h.id == ID_FROD) {
    alb = T_SILVER * 0.4; gloss = 0.35;
  } else if (h.id == ID_TAB) {
    vec2 g = h.l;
    float inIns = step(abs(g.x), INSW) * step(abs(g.y), INSH);
    vec3 sleeve = mix(T_HALIDE, T_LIGHTBOX, 0.5) * 0.5;
    if (h.front) {
      vec2 uv = vec2(g.x / (2.0 * INSW) + 0.5, g.y / (2.0 * INSH) + 0.5);
      float ink = texture(labelTex, uv).a * inIns;
      alb = mix(sleeve, mix(T_LIGHTBOX * 0.86, T_FILM * 0.6, ink), inIns);
    } else {
      // the back of the insert, the lyric written on it (reads with its top toward the fold)
      vec2 uv = vec2(g.x / (2.0 * INSW) + 0.5, -g.y / (2.0 * INSH) + 0.5);
      float ink = texture(lyrTex, uv).r * inIns;
      alb = mix(sleeve, mix(T_LIGHTBOX * 0.8, T_FILM * 0.5, ink), inIns);
    }
    gloss = 0.08;
  } else {
    int i = h.id - ID_EX;
    vec2 uv = h.l / (2.0 * exS[i]) + 0.5;
    if (h.front) alb = exFace(i, uv, P, gloss);
    else { alb = T_HALIDE * 0.5 * (0.95 + 0.05 * snoise(vec3(uv * 200.0, 3.0))); }
  }
  vec3 col = alb * (direct(P, n, tap) + ambK * T_HALIDE);
  if (gloss > 0.0) {
    vec3 R = reflect(rd, n);
    float fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    col += T_LIGHTBOX * 0.9 * gloss * fr * panelRefl(P, R) * 2.0;
  }
  col = min(col, vec3(0.95));
  return vec4(col, dot(P - ro, camF));
}

void main() {
  vec3 acc = vec3(0.0); float dep = 0.0;
  for (int k = ssK0(); k < ssK1(); k++) {
    vec2 px = FRAG_PX + rgss(k) / PX_SCALE;
    vec2 ndc = px / vec2(${W.toFixed(1)}, ${H.toFixed(1)}) * 2.0 - 1.0;
    vec3 rd = normalize(camF + camR * ndc.x * tanH * ${(W / H).toFixed(5)} + camU * ndc.y * tanH);
    vec4 s = shade(camPos, rd, float(k));
    acc += s.rgb; dep += s.a;
  }
  float w = ssWeight();
  vec3 col = acc * w;
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  fragColor = vec4(col, dep * w);
}`;
