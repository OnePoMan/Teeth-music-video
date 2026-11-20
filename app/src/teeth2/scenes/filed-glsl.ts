// Plate 14 `filed`: shaders.
//  DESK_FRAG  174.77 – 186.85, inside folder 08-32: the hanging folder lying open on a bench in the one pool of a louvred overhead
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
import { GLSL_HAND } from './match-glsl';

const f = (x: number) => x.toFixed(4);

/** Desk layout (m): the bench top is y = 0, the folder's fold on z = 0, the near panel N on z in [0, PH] (+z is the
 *  camera side), the far panel F hinged on the fold (phi = 0 lying open on z < 0, pi closed over N). */
export const DESK = {
  PH: 0.236, PW: 0.1855, YN: 0.0008, YF: 0.0045,
  /** the tab on F's top edge (as plate 1's: across the folder, half sizes, the typed insert) */
  TABX: LAY.TABX, TABW: LAY.TABW, TABH: 0.0145, TAB0: -0.004, INSW: LAY.INSW, INSH: LAY.INSH,
  /** the tube: a louvred fitting over the folder (its opal panel's centre and half sizes x, z); the louvre's cut-off
   *  (deg from the vertical, full to zero) makes one pool: lightbox-bright on the folder, film-black at the bench's edges */
  LC: [0.06, 0.7, 0.1] as const, LS: [0.2, 0.05] as const, LV: [18, 30] as const,
};

/** Throws if a patch anchor has drifted (plate 1's shader is read-only: a silent miss would break the carry). */
function patch(src: string, from: string, to: string) {
  if (!src.includes(from)) throw new Error(`filed-glsl: patch anchor not found: ${from.slice(0, 60)}`);
  return src.replace(from, to);
}

/** The shared glove (GLSL_HAND, imported as is) placed in the world: its frame (the pen tip, e1 up the pen, e2 to the
 *  thumb's side, e3 up from the pen; world metres, the hand's own mm inside), the pen only while writing, and the
 *  forearm carried on past the sleeve's end so it always enters from the frame's edge. */
const HAND_RIG = /* glsl */ `
${GLSL_HAND}
uniform vec3 hTip, hE1, hE2, hE3; uniform float handOn, penOn;
vec3 toHm(vec3 p) { vec3 d = (p - hTip) * 1000.0; return vec3(dot(d, hE1), dot(d, hE2), dot(d, hE3)); }
vec3 dirHm(vec3 v) { return vec3(dot(v, hE1), dot(v, hE2), dot(v, hE3)); }
vec3 fromHm(vec3 v) { return hE1 * v.x + hE2 * v.y + hE3 * v.z; }
float sdArm(vec3 p) { p.x -= GRIP; vec3 ax = normalize(W1 - W0); return rcap(p, W0 + ax * 180.0, W0 + ax * 620.0, 32.5, 38.0); }
float handMap(vec3 p, out int m) {
  float d = sdGlove(p); m = 0;
  float s = min(sdSleeve(p), sdArm(p));
  if (s < d) { d = s; m = 4; }
  if (penOn > 0.5) { int pm; float pd = sdPen(p, pm); if (pd < d) { d = pd; m = pm; } }
  return d;
}
float handMapD(vec3 p) { int m; return handMap(p, m); }
const vec3 HB_LO = vec3(-8.0, -72.0, -48.0), HB_HI = vec3(810.0, 82.0, 82.0);
`;

let bank = MARCH_FRAG;
bank = patch(bank, 'uniform float openZ, lift08,', 'uniform vec3 c08off; uniform float c08yaw, carry08, c08zmax;\nuniform float openZ, lift08,');
bank = patch(bank, '// ---------------------------------------------------------------- the open drawer and its folders', `
/** 08-32's carry: its frame (relative to its rod in the slot) offset and turned about the vertical. */
vec3 carryXf(vec3 f) {
  f -= c08off;
  float c = cos(c08yaw), s = sin(c08yaw);
  return vec3(c * f.x - s * f.z, f.y, s * f.x + c * f.z);
}
${HAND_RIG}
// ---------------------------------------------------------------- the open drawer and its folders`);
bank = patch(bank, '  vec3 f = q - vec3(0.0, YR + up, zk);\n  f.yz = tiltYZ(f.yz, a);', '  vec3 f = q - vec3(0.0, YR + up, zk);\n  if (k == K0832) f = carryXf(f);\n  f.yz = tiltYZ(f.yz, a);');
bank = patch(bank, 'for (int k = k0; k <= k1; k++) r = opU(r, folder(q, k));', 'for (int k = k0; k <= k1; k++) { if (k == K0832 && carry08 > 0.5) continue; r = opU(r, folder(q, k)); }');
// the carried folder, and the glove gripping its edge (materials 12 nitrile, 13 sleeve)
bank = patch(bank, '  if (bb < r.x) r = opU(r, openDrawer(p));\n  return r;', `  if (bb < r.x) r = opU(r, openDrawer(p));
  if (carry08 > 0.5) {
    vec3 q = p - vec3(0.0, 0.0, openZ);
    vec3 c = vec3(0.0, YR + lift08 - 0.1, -FZ0 - float(K0832) * FDZ) + c08off;
    if (dBox(q - c, vec3(0.26, 0.2, 0.26)) < r.x) r = opU(r, folder(q, K0832));
  }
  if (handOn > 0.5) {
    vec3 hq = toHm(p);
    if (dBox(hq - (HB_LO + HB_HI) * 0.5, (HB_HI - HB_LO) * 0.5) * 0.001 < r.x) {
      int hm; float hd = handMap(hq, hm) * 0.001;
      r = opU(r, vec2(hd, hm == 4 ? 13.0 : 12.0));
    }
  }
  return r;`);
bank = patch(bank, '  float zmax = max(openZ, 0.0) + 0.1;', '  float zmax = max(max(openZ, 0.0) + 0.1, c08zmax);');
bank = patch(bank, '  vec3 f = q - vec3(0.0, YR + lift08, -FZ0 - float(K0832) * FDZ + fzs[K0832]);\n  f.yz = tiltYZ(f.yz, ftilt[K0832]);',
  '  vec3 f = q - vec3(0.0, YR + lift08, -FZ0 - float(K0832) * FDZ + fzs[K0832]);\n  f = carryXf(f);\n  f.yz = tiltYZ(f.yz, ftilt[K0832]);');
// the glove: matte film2 nitrile with a soft sheen under the tube (knuckle highlights), the sleeve dark cotton
bank = patch(bank, '  if (metal > 0.0) f0 = mix(vec3(0.04), f0, metal);', `  if (m == 12.0) { alb = T_SILVER * 0.2; rough = 0.45; f0 = vec3(0.04); }
  else if (m == 13.0) { alb = T_FILM2 * 1.8 * (0.9 + 0.1 * snoise(P * vec3(300.0, 900.0, 900.0))); rough = 0.95; f0 = vec3(0.02); }
  if (metal > 0.0) f0 = mix(vec3(0.04), f0, metal);`);
/** The glove's rim in the tube's light: its gain, and the throw (linear) above which it compresses, so the rim still
 *  reads at the bank's dark end, where the louvred tube gives the folder little more than its bounce. */
const RIM_K = 13, RIM_S = 0.015;
// the glove and its cuff in the tube's light (review 5): matte nitrile and cotton turned from the camera catch the
// tube's throw at P as a rim along the knuckles, the fingers' backs, the cuff and the forearm (the tube's own
// unshadowed throw plus its bounce, the ambient every surface gets: no new source)
bank = patch(bank, '  col *= mix(0.55, 1.0, ao);', `  col *= mix(0.55, 1.0, ao);
  if (m > 11.5) {
    vec3 E0 = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      vec3 L = mix(TA, TB, (float(i) + 0.5) / 4.0) - P; float d2 = dot(L, L); L *= inversesqrt(d2);
      E0 += T_LIGHTBOX * tubeI * difK * louvre(L) / d2;
    }
    E0 += mix(T_HALIDE, T_FILM2 * 6.0, 0.5) * ambK;
    E0 *= ${f(RIM_S)} / (dot(E0, vec3(0.333)) + ${f(RIM_S)});
    vec3 Lc = normalize(mix(TA, TB, 0.5) - P);
    float fr = 1.0 - max(dot(N, V), 0.0);
    float rim = (pow(fr, 2.0) * 0.8 + 0.06) * sat(dot(N, Lc) * 0.5 + 0.6);
    col += (m == 12.0 ? T_HALIDE : T_SILVER) * E0 * rim * ${f(RIM_K)} * mix(0.5, 1.0, ao);
  }`);
export const BANK_FRAG = bank;

export const DESK_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
${HAND_RIG}
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform vec3 exC[3], exX[3], exY[3]; uniform vec2 exS[3];
uniform float exOn[3], exInk[3], exSnap[3], exMk[3], exRed[3];
uniform sampler2D radTex, castTex, chartTex, ov0, ov1, ov2, labelTex, lyrTex;
uniform vec4 castWin, castCrop;   // the photograph's window on the print, and the part of the photograph printed (uv min, max)
uniform float phiF, litK, ambK;

const float PH = ${f(DESK.PH)}, PW = ${f(DESK.PW)}, YN = ${f(DESK.YN)}, YF = ${f(DESK.YF)};
const float TABX = ${f(DESK.TABX)}, TABW = ${f(DESK.TABW)}, TABH = ${f(DESK.TABH)}, TAB0 = ${f(DESK.TAB0)};
const float INSW = ${f(DESK.INSW)}, INSH = ${f(DESK.INSH)};
const vec3 LC = vec3(${DESK.LC.map(f).join(',')}); const vec2 LS = vec2(${DESK.LS.map(f).join(',')});
const float LV0 = ${f(Math.cos((DESK.LV[1] * Math.PI) / 180))}, LV1 = ${f(Math.cos((DESK.LV[0] * Math.PI) / 180))};
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

// ---- the glove (marched in its own frame, mm)
vec2 boxHit(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  vec3 iv = 1.0 / rd; vec3 t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
/** World distance to the glove along rd (1e9 for a miss), its material. */
float marchHand(vec3 ro, vec3 rd, float tMax, out int m) {
  m = -1;
  if (handOn < 0.5) return 1e9;
  vec3 o = toHm(ro), d = dirHm(rd);
  vec2 bh = boxHit(o, d, HB_LO, HB_HI);
  if (bh.x > bh.y || bh.y < 0.0) return 1e9;
  float t = max(bh.x, 0.0), te = min(bh.y, tMax * 1000.0);
  for (int i = 0; i < 160; i++) {
    if (t > te) break;
    int mm;
    float h = handMap(o + d * t, mm);
    if (h < 0.02 + t * 0.0004) { m = mm; return t * 0.001; }
    t += h * 0.85;
  }
  return 1e9;
}
/** The glove's soft shadow at P toward the tube. */
float handShadow(vec3 P) {
  if (handOn < 0.5) return 1.0;
  vec3 l = normalize(LC - P);
  vec3 o = toHm(P), d = dirHm(l);
  vec2 bh = boxHit(o, d, HB_LO, HB_HI);
  if (bh.x > bh.y || bh.y < 0.0) return 1.0;
  float t = max(bh.x, 0.5), res = 1.0;
  for (int i = 0; i < 48; i++) {
    if (t > bh.y) break;
    float h = handMapD(o + d * t);
    res = min(res, 6.0 * h / t);
    if (res < 0.01) break;
    t += clamp(h, 0.6, 12.0);
  }
  res = sat(res);
  return res * res * (3.0 - 2.0 * res);
}
vec3 nrmHand(vec3 q) {
  const vec2 k = vec2(1.0, -1.0); const float e = 0.08;
  return normalize(k.xyy * handMapD(q + k.xyy * e) + k.yyx * handMapD(q + k.yyx * e) + k.yxy * handMapD(q + k.yxy * e) + k.xxx * handMapD(q + k.xxx * e));
}
float aoHand(vec3 q, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) { float h = 1.4 * float(i * i); o += w * (h - handMapD(q + n * h)); w *= 0.55; }
  return clamp(1.0 - 0.08 * o, 0.0, 1.0);
}

float shadowRay(vec3 P, vec3 L, float d) {
  Hit h; h.t = d; h.id = ID_NONE; h.l = vec2(0.0); h.front = true; h.n = vec3(0.0);
  occluders(P, L, h);
  return h.id == ID_NONE ? 1.0 : 0.0;
}

/** The louvre: the fitting throws its light down inside a cone (L from the surface to the panel). */
float louvre(vec3 L) { return smoothstep(LV0, LV1, L.y); }

/** Diffuse light from the panel (and its shadows) at P, normal n. */
vec3 direct(vec3 P, vec3 n, float tap) {
  float acc = 0.0;
  for (int i = 0; i < 8; i++) {
    vec2 j = vec2(float(i % 4), float(i / 4));
    j = (j + vec2(hash12(FRAG_PX * 0.913 + vec2(tap * 7.1, float(i) * 3.3)), hash12(FRAG_PX * 1.37 + vec2(float(i) * 5.7, tap * 2.9)))) * vec2(0.5, 1.0) - 1.0;
    vec3 Lp = LC + vec3(j.x * LS.x, 0.0, j.y * LS.y);
    vec3 L = Lp - P; float d2 = dot(L, L); float d = sqrt(d2); L /= d;
    float cs = dot(n, L);
    if (cs <= 0.0 || L.y <= 0.0) continue;
    acc += cs * L.y / d2 * louvre(L) * shadowRay(P + n * 0.0004, L, d - 0.001);
  }
  return T_LIGHTBOX * litK * acc * LS.x * LS.y * 0.5;   // 8 samples (a 4 x 2 grid, jittered) of the 4·LS.x·LS.y panel
}

/** The panel seen in a glossy reflection (crisp: lamp reflections are shapes, not orbs). */
float panelRefl(vec3 P, vec3 R) {
  if (R.y <= 0.0) return 0.0;
  float t = (LC.y - P.y) / R.y;
  vec2 q = (P + R * t).xz - LC.xz;
  vec2 e = abs(q) - LS;
  return 1.0 - smoothstep(-0.004, 0.004, max(e.x, e.y));
}
/** The tube's opal panel behind a film along rd: full on the panel, falling off round it (its glow in the fitting). */
float backlight(vec3 P, vec3 rd) {
  if (rd.y <= 0.02) return 0.0;
  float t = (LC.y - P.y) / rd.y;
  vec2 q = abs((P + rd * t).xz - LC.xz) - LS;
  float d = length(max(q, 0.0));
  return 1.0 - smoothstep(0.0, 0.32, d);
}

vec3 pressboard(vec3 P, vec2 l) {
  float fib = snoise(vec3(l.x * 900.0, l.y * 160.0, P.y * 50.0)) * 0.5 + snoise(vec3(l * 60.0, 1.3)) * 0.5;
  return mix(T_SILVER, T_HALIDE, 0.42) * (0.62 + 0.05 * fib);
}

float stoneOf(vec3 c) { return smoothstep(0.08, 0.3, (c.r - c.b) / max(c.r, 0.01)) * smoothstep(0.004, 0.03, c.r); }

/** An exhibit's face: its print (albedo), the overlay (R heavy TEETH, G light TEETH, B monogram); the red T.F.'s mask
 *  out (it is laid on after the light: full match red wherever the pool reaches it), and for the radiograph its
 *  transmission (it is seen by the tube behind it). */
vec3 exFace(int i, vec2 uv, vec3 P, out float gloss, out float red, out float trans) {
  vec3 col; vec4 ov;
  gloss = 0.0; trans = 0.0;
  if (i == 0) {
    // film: a glossy blue-black base by reflection; by transmission the teeth and the bone bright, the base black
    vec3 d = texture(radTex, uv).rgb;
    float dn = sat(0.95 * d.r + 0.55 * d.g + 1.2 * d.b);
    col = T_FILM2 * 0.9 + T_HALIDE * 0.05 * dn;
    trans = pow(dn, 1.25) * (0.96 + 0.04 * snoise(vec3(uv * 300.0, 2.0)));
    gloss = 0.6;
    ov = texture(ov0, uv);
  } else if (i == 1) {
    // the cast photographed on a white card: the stone kept, the dark ground of the copy stand turned to card, a soft
    // shadow of the cast on it
    vec2 w = (uv - castWin.xy) / (castWin.zw - castWin.xy);
    bool inW = all(greaterThan(w, vec2(0.0))) && all(lessThan(w, vec2(1.0)));
    vec3 card = T_LIGHTBOX * 0.9;
    if (inW) {
      vec2 cu = mix(castCrop.xy, castCrop.zw, w);
      vec3 c = texture(castTex, cu).rgb;
      float stone = stoneOf(c);
      float sh = 0.0;
      for (int k = 0; k < 6; k++) {
        vec2 o = vec2(0.012, -0.018) + 0.012 * vec2(cos(float(k) * 1.047), sin(float(k) * 1.047));
        sh += stoneOf(texture(castTex, cu + o).rgb);
      }
      card *= 1.0 - 0.35 * sh / 6.0;
      col = mix(card, c * 1.6, stone);
    } else col = T_LIGHTBOX * 0.86;
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
  col = mix(col, T_FILM * 0.12, ink);
  trans *= 1.0 - ink;
  float mk = ov.b * exMk[i];
  col = mix(col, T_FILM * 0.3, mk);
  trans *= 1.0 - mk;
  red = mk * exRed[i];
  return col;
}

float ggx(vec3 N, vec3 H, float rough) {
  float a2 = rough * rough * rough * rough, nh = max(dot(N, H), 0.0);
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * dd * dd);
}
/** The glove: matte film2 nitrile with joint creases, lit only by the tube (a soft sheen on the knuckles and the
 *  tops of the fingers), the pen (steel, black grip, satin barrel), the sleeve dark cotton. */
vec3 shadeHand(vec3 P, vec3 rd, int m, float tap) {
  vec3 q = toHm(P);
  vec3 nl = nrmHand(q);
  if (m == 0) {
    const float e = 0.25;
    vec3 g = vec3(wrinkle(q + vec3(e, 0.0, 0.0)) - wrinkle(q - vec3(e, 0.0, 0.0)), wrinkle(q + vec3(0.0, e, 0.0)) - wrinkle(q - vec3(0.0, e, 0.0)), wrinkle(q + vec3(0.0, 0.0, e)) - wrinkle(q - vec3(0.0, 0.0, e))) / (2.0 * e);
    g -= nl * dot(g, nl);
    nl = normalize(nl - g * 0.9);
  }
  vec3 N = fromHm(nl);
  vec3 E = direct(P + N * 0.0006, N, tap);
  float e = dot(E, vec3(0.333));
  vec3 L = normalize(LC - P), V = -rd, Hh = normalize(L + V);
  float o = aoHand(q, nl);
  float nv = max(dot(N, V), 0.0);
  vec3 col;
  if (m == 0) {
    vec3 alb = T_SILVER * 0.14;
    float spec = ggx(N, Hh, 0.5) * (0.06 + 0.3 * pow(1.0 - nv, 5.0));
    col = alb * (E + ambK * T_HALIDE * 2.0) + T_LIGHTBOX * spec * e;
  } else if (m == 2) {
    col = T_HALIDE * 0.8 * (ggx(N, Hh, 0.2) * 0.5 * e + 0.12 * e + 0.01);
  } else if (m == 3) {
    vec3 alb = T_SILVER * (0.9 + 0.1 * sin(q.x * 9.0 + snoise(q * 2.0)));
    col = alb * (ggx(N, Hh, 0.32) * 0.48 * e + 0.45 * e + 0.01);
  } else if (m == 1) {
    col = T_FILM * (e * 0.8 + 0.02) + T_LIGHTBOX * ggx(N, Hh, 0.45) * 0.04 * e;
  } else {
    float weave = 0.9 + 0.1 * snoise(q * vec3(0.5, 3.0, 3.0));
    col = T_FILM2 * 1.6 * weave * (E + 0.03);
  }
  return col * mix(1.0, o, 0.6);
}

vec4 shade(vec3 ro, vec3 rd, float tap) {
  Hit h = trace(ro, rd);
  int hm;
  float th = marchHand(ro, rd, min(h.t, 5.0), hm);
  if (th < h.t) return vec4(min(shadeHand(ro + rd * th, rd, hm, tap), vec3(0.95)), dot(rd * th, camF));
  if (h.id == ID_NONE) return vec4(T_FILM * 0.4, 30.0);
  if (h.id == ID_LIGHT) return vec4(T_LIGHTBOX * 0.95, 30.0);
  vec3 P = ro + rd * h.t, n = h.n;
  vec3 alb = vec3(0.1); float gloss = 0.0, red = 0.0, trans = 0.0;
  if (h.id == ID_BENCH) {
    // a grey linoleum bench top worn to a satin: the pool shows on it and dies to black at its edges
    alb = T_SILVER * (0.42 + 0.05 * snoise(vec3(P.xz * 22.0, 0.5)) + 0.02 * snoise(vec3(P.xz * 300.0, 1.5)));
    gloss = 0.05;
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
      alb = mix(sleeve, mix(T_LIGHTBOX * 0.9, T_FILM * 0.3, ink), inIns);
    }
    gloss = 0.08;
  } else {
    int i = h.id - ID_EX;
    vec2 uv = h.l / (2.0 * exS[i]) + 0.5;
    if (h.front) alb = exFace(i, uv, P, gloss, red, trans);
    else { alb = T_HALIDE * 0.5 * (0.95 + 0.05 * snoise(vec3(uv * 200.0, 3.0))); }
  }
  vec3 lit = direct(P, n, tap) * mix(0.4, 1.0, handShadow(P)) + ambK * T_HALIDE;
  vec3 col = alb * lit;
  if (gloss > 0.0) {
    vec3 R = reflect(rd, n);
    float fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    col += T_LIGHTBOX * 0.9 * gloss * fr * panelRefl(P, R) * 2.0;
  }
  // the radiograph: what of the tube shows through it
  if (trans > 0.0) col += T_LIGHTBOX * 1.15 * trans * backlight(P, rd);
  // the red T.F.: full match red in the light, holding its colour into the shade of the closing panel
  float lum = dot(lit, vec3(0.333));
  col = mix(col, T_MATCH * clamp(lum * 1.2, 0.72, 1.0), red);
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
