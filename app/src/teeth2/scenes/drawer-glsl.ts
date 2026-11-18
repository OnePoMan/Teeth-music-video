// `drawer` shaders: the ray-marched bank of steel filing cabinets under one cold overhead fluorescent tube, and a
// depth-of-field gather pass. Units: metres, y up, the cabinets' front faces at z = 0 (the room is +z), the open
// cabinet centred on x = 0. See drawer.ts for the layout and the motion.
import { GLSL_TEETH_PALETTE } from '../palette';
import { SS_TAP_GLSL, W, H } from '../../engine/gl';

/** Layout shared with drawer.ts. */
export const LAY = {
  /** cabinet pitch, shell half width, depth, top */
  CW: 0.47, CHW: 0.2325, CD: 0.7, CTOP: 1.335,
  /** drawer rows: the first row's bottom and the row pitch; the front's half sizes */
  Y0: 0.068, DH: 0.315, FHW: 0.2135, FHH: 0.1525,
  /** the open drawer's row (0 = bottom) */
  OPEN_J: 2,
  /** the hanging rails' height (the folders' rods rest there), the first folder's distance behind the front, pitch */
  YR: 0.068 + 2 * 0.315 + 0.278, FZ0: 0.016, FDZ: 0.0185,
  /** the folders, and which one is 08-32 */
  NF: 28, K0832: 3,
  /** 08-32's tab: its centre across the drawer, half width; the typed insert's half sizes */
  TABX: -0.062, TABW: 0.0565, INSW: 0.0525, INSH: 0.0102,
  /** the tube: its ends and radius */
  TA: [-0.1, 1.75, 0.24] as const, TB: [1.42, 1.75, 0.24] as const, TR: 0.013,
};

const f = (x: number) => x.toFixed(4);
const v = (a: readonly number[]) => `vec3(${a.map(f).join(',')})`;

export const MARCH_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
uniform vec3 camPos, camR, camU, camF; uniform float tanH;
uniform float openZ, lift08, lean08, tubeI, difK, specK, louv, ambK, paintK, chromeR, ccK, ccR;
uniform float ftilt[${LAY.NF}]; uniform float fzs[${LAY.NF}];
uniform sampler2D labelTex; uniform vec2 labelTexSize;

const float CW = ${f(LAY.CW)}, CHW = ${f(LAY.CHW)}, CD = ${f(LAY.CD)}, CTOP = ${f(LAY.CTOP)};
const float Y0 = ${f(LAY.Y0)}, DH = ${f(LAY.DH)}, FHW = ${f(LAY.FHW)}, FHH = ${f(LAY.FHH)};
const float OPEN_J = ${LAY.OPEN_J.toFixed(1)};
const float YB = Y0 + OPEN_J * DH;   // the open drawer's row bottom
const float FZ = 0.006, FTH = 0.011;
const float YR = ${f(LAY.YR)}, FZ0 = ${f(LAY.FZ0)}, FDZ = ${f(LAY.FDZ)};
const int NF = ${LAY.NF}, K0832 = ${LAY.K0832};
uniform vec3 TA, TB;
const float TR = ${f(LAY.TR)};
const float TABX = ${f(LAY.TABX)}, TABW = ${f(LAY.TABW)}, INSW = ${f(LAY.INSW)}, INSH = ${f(LAY.INSH)};
const float WALLZ = -0.72, CEIL = 2.75;

// materials
const float M_PAINT = 1.0, M_CHROME = 2.0, M_CARD = 3.0, M_FOLDER = 4.0, M_TAB = 5.0, M_LABEL = 6.0, M_RAW = 7.0;
const float M_ROD = 8.0, M_PAPER = 9.0, M_FLOOR = 10.0, M_WALL = 11.0;

float dBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float dRBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float dCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = sat(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h) - r; }
vec2 opU(vec2 a, vec2 b) { return a.x < b.x ? a : b; }
/** Rotation of (y, z) by a about x: positive a leans a hanging folder's top toward +z (the front). */
vec2 tiltYZ(vec2 yz, float a) { float c = cos(a), s = sin(a); return vec2(c * yz.x + s * yz.y, -s * yz.x + c * yz.y); }

// ---------------------------------------------------------------- the drawer front (local x, world y, world z)
/** A pressed-steel drawer front with its label holder (chrome frame, card) and a chrome bar pull. */
vec2 drawerFront(vec3 q, float yc, float zo) {
  vec3 c = q - vec3(0.0, yc, FZ + zo);
  float d = dRBox(c, vec3(FHW, FHH, FTH), 0.0095);
  // the pressed rim: a shallow step 14 mm in from the edge
  float inset = dRBox(c - vec3(0.0, 0.0, FTH), vec3(FHW - 0.014, FHH - 0.014, 0.0009), 0.004);
  d = max(d, -inset);
  vec2 r = vec2(d, M_PAINT);
  float bb = dBox(c - vec3(0.0, 0.045, FTH + 0.02), vec3(0.085, 0.06, 0.03));
  if (bb > 0.01) return vec2(min(d, bb), M_PAINT);
  // the label holder: a chrome frame, its window, the card behind
  vec3 h = c - vec3(0.0, 0.074, FTH - 0.0009);
  float frame = dRBox(h, vec3(0.043, 0.0195, 0.0021), 0.0016);
  float win = dBox(h - vec3(0.0, 0.0, 0.002), vec3(0.0362, 0.0128, 0.0035));
  frame = max(frame, -win);
  r = opU(r, vec2(frame, M_CHROME));
  float card = dBox(h - vec3(0.0, 0.0, -0.0004), vec3(0.0372, 0.0138, 0.0005));
  r = opU(r, vec2(card, M_CARD));
  // the bar pull: a straight chrome bar, its ends bent back to two escutcheon plates on the front
  vec3 b = c - vec3(0.0, 0.016, FTH - 0.0009);
  float bar = dCap(b, vec3(-0.052, 0.0, 0.03), vec3(0.052, 0.0, 0.03), 0.0055);
  vec3 bb2 = vec3(abs(b.x) - 0.052, b.y, b.z - 0.012);   // the bend: a quarter ring from the bar back to the plate
  float bend = length(vec2(length(bb2.xz) - 0.018, bb2.y)) - 0.0055;
  bend = max(bend, max(-bb2.x, -bb2.z + 0.0));
  bar = min(bar, bend);
  bar = min(bar, dCap(vec3(abs(b.x), b.yz), vec3(0.07, 0.0, 0.012), vec3(0.07, 0.0, 0.0015), 0.0055));
  bar = min(bar, dRBox(vec3(abs(b.x) - 0.07, b.y, b.z - 0.0012), vec3(0.0085, 0.011, 0.0012), 0.0011));
  r = opU(r, vec2(bar, M_CHROME));
  return r;
}

// ---------------------------------------------------------------- a cabinet's shell
float shell(vec3 q) {
  float d = dRBox(q - vec3(0.0, CTOP * 0.5, -CD * 0.5), vec3(CHW, CTOP * 0.5, CD * 0.5), 0.004);
  // the plinth, set back under the bottom drawer
  d = max(d, -dBox(q - vec3(0.0, 0.0, 0.0), vec3(CHW + 0.01, 0.055, 0.028)));
  // the lid, a hair proud, its front edge a bullnose
  float lid = dRBox(q - vec3(0.0, CTOP - 0.0065, -CD * 0.5 + 0.0015), vec3(CHW + 0.0012, 0.0065, CD * 0.5 + 0.0015), 0.006);
  return min(d, lid);
}
/** The open drawer's opening in cabinet 0. */
float cavity(vec3 q) {
  float yb = Y0 + OPEN_J * DH;
  return dBox(q - vec3(0.0, yb + DH * 0.5 - 0.001, -0.33), vec3(0.207, DH * 0.5 - 0.004, 0.36));
}

// ---------------------------------------------------------------- the bank (repeated cabinets)
/** How far a march may step from the last bank() evaluation without crossing a cell wall whose neighbour it did
 *  not evaluate (a step limit only: shadows and AO read the plain distance). */
float gGuard = 1e9;
vec2 bank(vec3 p) {
  float ix = clamp(floor(p.x / CW + 0.5), -14.0, 14.0);
  vec3 q = vec3(p.x - ix * CW, p.y, p.z);
  float j = clamp(floor((p.y - Y0) / DH), 0.0, 3.0);
  float yc = Y0 + (j + 0.5) * DH;
  float sh = shell(q);
  if (ix == 0.0) sh = max(sh, -cavity(q));
  vec2 r = vec2(sh, M_PAINT);
  // the fronts of this row and the nearer neighbouring row (nothing reaches past the next row)
  float far = max(p.z - 0.065, p.y - CTOP - 0.02);
  float jn = clamp(fract((p.y - Y0) / DH) > 0.5 ? j + 1.0 : j - 1.0, 0.0, 3.0);
  if (!(ix == 0.0 && j == OPEN_J)) r = opU(r, drawerFront(q, yc, 0.0));
  if (jn != j && !(ix == 0.0 && jn == OPEN_J)) r = opU(r, drawerFront(q, Y0 + (jn + 0.5) * DH, 0.0));
  float gx = CW * 0.5 - abs(q.x);
  gGuard = min(gGuard, max(gx, far) + 0.0015);
  return r;
}

// ---------------------------------------------------------------- the open drawer and its folders
/** Folder k in the open drawer's frame (q: world minus the drawer's travel in z). */
vec2 folder(vec3 q, int k) {
  float fk = float(k);
  float zk = -FZ0 - fk * FDZ + fzs[k];
  float a = ftilt[k];
  float up = k == K0832 ? lift08 : 0.0;
  vec3 f = q - vec3(0.0, YR + up, zk);
  f.yz = tiltYZ(f.yz, a);
  float h = hash11(fk * 7.13 + 1.7), h2 = hash11(fk * 3.71 + 9.2);
  float th = k == K0832 ? 0.0045 : 0.0014 + 0.0055 * h * h;   // its thickness (what's inside)
  // the pocket: card from the rod down, its top edge (a rolled hem round the rod) a little above the rod
  float body = dRBox(f - vec3(0.0, -0.106, 0.0), vec3(0.1855, 0.118, th), 0.0011);
  vec2 r = vec2(body, M_FOLDER);
  // papers inside, a few standing a hair proud of the card, offset
  if (h2 > 0.3) {
    float pap = dBox(f - vec3(0.012 * (h - 0.5), -0.106 + 0.0035 * h2, 0.0), vec3(0.15 + 0.02 * h, 0.118, th * 0.6));
    r = opU(r, vec2(pap, M_PAPER));
  }
  // the rod and its hooks, over the rails
  float rod = dCap(f, vec3(-0.193, 0.0, 0.0), vec3(0.193, 0.0, 0.0), 0.0016);
  rod = min(rod, dCap(vec3(abs(f.x), f.yz), vec3(0.193, 0.0, 0.0), vec3(0.1965, -0.0045, 0.0), 0.0014));
  r = opU(r, vec2(rod, M_ROD));
  // the tab: a clear plastic sleeve clipped on the top edge, raked back; staggered across the drawer
  float slot = floor(hash11(fk * 1.37 + 0.3) * 4.0);
  bool has = hash11(fk * 5.91 + 2.1) > 0.18 || k == K0832;
  if (has) {
    float tx = -0.135 + slot * 0.09, tw = 0.025;
    if (k == K0832) { tx = TABX; tw = TABW; }
    vec3 g = f - vec3(tx, 0.012, 0.0);
    g.yz = tiltYZ(g.yz, -0.2);
    float tab = dRBox(g - vec3(0.0, 0.0085, 0.0), vec3(tw, 0.0145, 0.0011), 0.0012);
    r = opU(r, vec2(tab, k == K0832 ? M_LABEL : M_TAB));
  }
  return r;
}

vec2 openDrawer(vec3 p) {
  float yc = Y0 + (OPEN_J + 0.5) * DH;
  vec2 r = drawerFront(p, yc, openZ);
  vec3 q = p - vec3(0.0, 0.0, openZ);
  // the drawer box: sheet-steel sides, bottom and back, open at the top
  float zb0 = -0.655, zb1 = -0.004;
  float box = dBox(q - vec3(0.0, YB + 0.146, (zb0 + zb1) * 0.5), vec3(0.204, 0.129, (zb1 - zb0) * 0.5));
  float inner = dBox(q - vec3(0.0, YB + 0.156, (zb0 + zb1) * 0.5), vec3(0.198, 0.129, (zb1 - zb0) * 0.5 - 0.005));
  box = max(box, -inner);
  // the hanging rails along the inside of the walls' top edges
  box = min(box, dRBox(vec3(abs(q.x) - 0.1935, q.y - (YR - 0.0065), q.z - (zb0 + zb1) * 0.5), vec3(0.0035, 0.0055, (zb1 - zb0) * 0.5), 0.0012));
  r = opU(r, vec2(box, M_RAW));
  // the folders near p (they hang in z order; neighbours either side cover the tilts)
  float kc = (-FZ0 - q.z) / FDZ;
  int k0 = int(clamp(floor(kc) - 3.0, 0.0, float(NF - 1)));
  int k1 = int(clamp(floor(kc) + 4.0, 0.0, float(NF - 1)));
  float fb = dBox(q - vec3(0.0, YB + 0.19, -0.33), vec3(0.21, 0.2, 0.34));
  if (fb < r.x) for (int k = k0; k <= k1; k++) r = opU(r, folder(q, k));
  return r;
}

vec2 map(vec3 p) {
  gGuard = 1e9;
  vec2 r = bank(p);
  r = opU(r, vec2(p.y, M_FLOOR));
  r = opU(r, vec2(p.z - WALLZ, M_WALL));
  float bb = dBox(p - vec3(0.0, YB + 0.16, openZ * 0.5 - 0.3), vec3(0.235, 0.24, openZ * 0.5 + 0.42));
  if (bb < r.x) r = opU(r, openDrawer(p));
  return r;
}
float mapD(vec3 p) { return map(p).x; }

vec3 calcN(vec3 p, float e) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}

vec2 march(vec3 ro, vec3 rd, float tmax, out float tHit) {
  float t = 0.0;
  // start at the room's near side of the bank (nothing stands in front of z = openZ + 0.1)
  float zmax = max(openZ, 0.0) + 0.1;
  if (ro.z > zmax && rd.z < 0.0) t = (ro.z - zmax) / -rd.z;
  for (int i = 0; i < 200; i++) {
    vec3 p = ro + rd * t;
    vec2 h = map(p);
    if (h.x < 0.00012 * t + 0.00004) { tHit = t; return vec2(t, h.y); }
    t += min(h.x, gGuard) * 0.92;
    if (t > tmax) break;
  }
  tHit = 1e9;
  return vec2(-1.0, 0.0);
}

float softShadow(vec3 ro, vec3 rd, float maxt, float k) {
  float res = 1.0, t = 0.003;
  for (int i = 0; i < 48; i++) {
    float h = mapD(ro + rd * t);
    res = min(res, k * h / t);
    t += clamp(min(h, gGuard), 0.002, 0.12);
    if (res < 0.001 || t > maxt) break;
  }
  res = sat(res);
  return res * res * (3.0 - 2.0 * res);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, w = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.006 * float(i * i);
    occ += (h - mapD(p + n * h)) * w;
    w *= 0.62;
  }
  return sat(1.0 - 9.0 * occ);
}

// ---------------------------------------------------------------- light
/** 0 while tracing chrome reflections: the tube itself comes from the analytic lobe there (no double image). */
float envTube = 1.0;
/** Radiance seen along a ray that leaves the scene: the tube (bare, its ends dark), its batten, the ceiling and the
 *  room's dark walls. */
vec3 env(vec3 ro, vec3 rd) {
  vec3 ax = normalize(TB - TA); float tl = length(TB - TA);
  // the aisle behind the camera: the opposite bank's dark fronts, faintly lit near the tube's height and x
  vec3 col = T_FILM * 0.3;
  if (rd.z > 0.0) {
    float tw = (2.4 - ro.z) / rd.z;
    vec3 P = ro + rd * tw;
    vec3 c = TA + ax * clamp(dot(P - TA, ax), 0.0, tl);
    float d2 = dot(P - c, P - c);
    float band = smoothstep(0.0, 0.3, P.y) * (1.0 - smoothstep(1.3, 1.45, P.y));
    col = T_FILM * 0.3 + T_SILVER * 0.6 * tubeI * difK * band / (0.5 + d2);
  }
  // the ceiling, lit from the tube below it
  if (rd.y > 0.0) {
    float tc = (CEIL - ro.y) / rd.y;
    vec3 P = ro + rd * tc;
    vec3 c = TA + ax * clamp(dot(P - TA, ax), 0.0, tl);
    float d = length((P - c).xz);
    col = T_FILM2 * (0.2 + 1.6 * tubeI / (1.0 + d * d * 8.0));
  }
  // the batten above the tube: a dark steel channel
  {
    vec3 bc = (TA + TB) * 0.5 + vec3(0.0, 0.04, 0.0);
    vec3 bh = abs(TB - TA) * 0.5 + vec3(0.05, 0.025, 0.05);
    vec3 m = 1.0 / rd, n = m * (ro - bc), k = abs(m) * bh;
    vec3 t1 = -n - k, t2 = -n + k;
    float tN = max(max(t1.x, t1.y), t1.z), tF = min(min(t2.x, t2.y), t2.z);
    if (tN < tF && tN > 0.0) col = T_FILM2 * 0.6 + T_SILVER * 0.06 * tubeI;
  }
  // the tube: a bare cylinder, its ends dark
  {
    vec3 oc = ro - TA;
    vec3 dp = rd - ax * dot(rd, ax), op = oc - ax * dot(oc, ax);
    float a = dot(dp, dp), b = dot(op, dp), c = dot(op, op) - TR * TR;
    float disc = b * b - a * c;
    if (disc > 0.0 && a > 1e-8) {
      float t = (-b - sqrt(disc)) / a;
      vec3 P = ro + rd * t;
      float u = dot(P - TA, ax) / tl;
      if (t > 0.0 && u > 0.0 && u < 1.0) {
        float ends = smoothstep(0.0, 0.03, u) * smoothstep(1.0, 0.97, u);
        float caps = 1.0 - 0.35 * (1.0 - smoothstep(0.03, 0.07, u)) - 0.35 * (1.0 - smoothstep(0.97, 0.93, u));
        col = mix(col, mix(T_SILVER * 0.4, T_LIGHTBOX * 7.5 * tubeI * caps, ends), envTube);
      }
    }
  }
  return col;
}

float D_GGX(float NoH, float a) { float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
float V_SmithJ(float NoV, float NoL, float a) {
  float a2 = a * a;
  float gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2), gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
  return 0.5 / max(gv + gl, 1e-5);
}
vec3 F_Schlick(vec3 f0, float VoH) { return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0); }

/** The fitting's louvre: the tube throws its light down (L: from the surface to the tube). */
float louvre(vec3 L) { return pow(sat(L.y), louv) * (1.0 + louv); }

/** Direct light from the tube at P (normal N, view V): diffuse (4 points along it) and a GGX lobe at the tube's
 *  representative point, shadowed by sh. */
void tubeLight(vec3 P, vec3 N, vec3 V, float rough, vec3 f0, float sh, out vec3 dif, out vec3 spe) {
  dif = vec3(0.0); spe = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 Lp = mix(TA, TB, (float(i) + 0.5) / 4.0);
    vec3 L = Lp - P; float d2 = dot(L, L); L *= inversesqrt(d2);
    dif += T_LIGHTBOX * tubeI * difK * louvre(L) * max(dot(N, L), 0.0) / d2;
  }
  dif *= sh;
  // the specular lobe: the point on the tube nearest the reflected ray, the roughness widened by its radius
  vec3 R = reflect(-V, N);
  vec3 ab = TB - TA, ao = P - TA;
  float abab = dot(ab, ab), abR = dot(ab, R);
  float s = sat((dot(ao, ab) - dot(ao, R) * abR) / max(abab - abR * abR, 1e-6));
  vec3 Lp = TA + ab * s;
  // pull it to the nearest point of the tube's cylinder along the ray
  vec3 toL = Lp - P; float dl = length(toL);
  vec3 cr = dot(toL, R) * R - toL;
  Lp += cr * sat(TR / max(length(cr), 1e-5));
  vec3 L = normalize(Lp - P);
  vec3 Hh = normalize(L + V);
  float NoL = max(dot(N, L), 0.0), NoV = max(dot(N, V), 1e-4), NoH = max(dot(N, Hh), 0.0);
  float a = max(rough * rough, 0.002);
  float a2 = sat(a + TR / (2.0 * dl));
  float norm = a / a2;
  vec3 F = F_Schlick(f0, max(dot(V, Hh), 0.0));
  spe = F * D_GGX(NoH, a2) * V_SmithJ(NoV, NoL, a2) * NoL * norm * tubeI * specK * louvre(L) * sh / (0.25 + dl * dl);
}

// ---------------------------------------------------------------- surfaces
/** 08-32's tab frame at world p: (x across the tab, y up the tab, z its normal), from its centre. */
vec3 tabFrame(vec3 p) {
  vec3 q = p - vec3(0.0, 0.0, openZ);
  vec3 f = q - vec3(0.0, YR + lift08, -FZ0 - float(K0832) * FDZ + fzs[K0832]);
  f.yz = tiltYZ(f.yz, ftilt[K0832]);
  vec3 g = f - vec3(TABX, 0.012, 0.0);
  g.yz = tiltYZ(g.yz, -0.2);
  return g - vec3(0.0, 0.0085, 0.0);
}

/** A cheap shade for points seen in reflections: the tube's diffuse light, no shadow, a flat ambient. */
vec3 shadeSimple(vec3 P, vec3 N, float m) {
  vec3 alb = m == M_PAINT ? T_SILVER * 0.95 : m == M_FOLDER ? mix(T_SILVER, T_HALIDE, 0.45) * 0.8 : m == M_PAPER || m == M_CARD || m == M_LABEL ? T_LIGHTBOX * 0.75 : m == M_WALL || m == M_FLOOR ? T_FILM2 : T_SILVER * 0.6;
  vec3 dif = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    vec3 Lp = mix(TA, TB, (float(i) + 0.5) / 2.0);
    vec3 L = Lp - P; float d2 = dot(L, L); L *= inversesqrt(d2);
    dif += T_LIGHTBOX * tubeI * difK * 2.0 * louvre(L) * max(dot(N, L), 0.0) / d2;
  }
  float sh = P.z < 0.0 && P.y < CTOP ? 0.35 : 1.0;    // inside the cabinets' shade
  return alb * (dif * sh + T_HALIDE * 0.012);
}

vec3 traceRefl(vec3 P, vec3 R) {
  float th;
  vec2 h = march(P + R * 0.002, R, 4.0, th);
  if (h.x < 0.0) return env(P, R);
  vec3 Q = P + R * h.x;
  vec3 Nq = calcN(Q, 0.0006);
  return shadeSimple(Q, Nq, h.y);
}

vec4 shade(vec3 ro, vec3 rd, float tap) {
  float tH;
  vec2 h = march(ro, rd, 9.0, tH);
  if (h.x < 0.0) return vec4(min(env(ro, rd), vec3(0.95)), 30.0);
  float t = h.x, m = h.y;
  vec3 P = ro + rd * t;
  vec3 N = calcN(P, max(0.00025, 0.00035 * t));
  vec3 V = -rd;
  if (dot(N, V) < 0.0 && (m == M_TAB || m == M_LABEL || m == M_FOLDER)) N = -N;
  // the tube's shadow: one soft ray per tap to a point jittered along the tube (the taps cover its length)
  // the tube's shadow: two soft rays per tap to points jittered in their eighths of the tube (the taps cover it)
  float sh = 0.0;
  for (int i = 0; i < 2; i++) {
    float jit = hash12(FRAG_PX * 0.913 + vec2(tap * 17.0, float(i) * 5.3));
    vec3 Ls = mix(TA, TB, (tap * 2.0 + float(i) + jit) / 8.0);
    vec3 Ld = Ls - P; float ld = length(Ld);
    // (faces turned from the tube need no ray)
    if (dot(N, Ld) > 0.0) sh += 0.5 * softShadow(P + N * 0.0012, Ld / ld, ld, 16.0);
  }
  float ao = calcAO(P, N);
  vec3 alb = T_SILVER; float rough = 0.4; vec3 f0 = vec3(0.04); float metal = 0.0; float refl = 0.0;
  float ccRough = 1.0, ccAmt = 1.0;
  vec3 emit = vec3(0.0);
  float fp = 1.0;
  if (m == M_PAINT) {
    // baked enamel, cold grey: a fine orange peel, wear polished in round the pulls, grime in the seams
    float n = snoise(P * 260.0) * 0.5 + snoise(P * 37.0) * 0.5;
    alb = T_SILVER * paintK * (1.0 + 0.06 * n + 0.05 * snoise(P * 4.0));
    rough = 0.24 + 0.05 * snoise(P * 11.0);
    ccRough = 1.0 + 0.45 * (snoise(P * 23.0) * 0.5 + 0.5);   // the gloss varies over the sheet
    fp = 0.95;
    // the drawer front under P, in its own frame
    float ix = floor(P.x / CW + 0.5);
    float jr = clamp(floor((P.y - Y0) / DH), 0.0, 3.0);
    float zo = (ix == 0.0 && jr == OPEN_J) ? openZ : 0.0;
    vec3 c = vec3(P.x - ix * CW, P.y - (Y0 + (jr + 0.5) * DH), P.z - FZ - zo);
    if (abs(c.z) < FTH + 0.003 && abs(c.x) < FHW + 0.002 && abs(c.y) < FHH + 0.002) {
      // grime settles low on each front; the paint round the pull's bosses is polished by hands
      alb *= mix(0.8, 1.0, smoothstep(-FHH, -FHH + 0.07, c.y));
      float hand = 1.0 - smoothstep(0.012, 0.03, length(vec2(abs(c.x) - 0.06, c.y - 0.016)));
      rough -= 0.1 * hand;
      // fingermarks round the pull and along the lip, where the drawer is pulled: they dull the gloss
      float lipBand = 1.0 - smoothstep(0.0, 0.03, FHH - c.y);
      float smudge = smoothstep(0.05, 0.75, snoise(vec3(P.xy * 32.0, jr + ix * 3.0)) * 0.75 + snoise(P * 90.0) * 0.25)
        * max(1.0 - smoothstep(0.02, 0.07, length(vec2(abs(c.x) - 0.03, c.y - 0.016))), lipBand * 0.7);
      ccRough *= 1.0 + 2.5 * smudge; ccAmt = 1.0 - 0.5 * smudge;
      // the rolled rim worn through to bare steel in places, most along the top where it is pulled
      vec2 ex = abs(c.xy) - vec2(FHW, FHH) + 0.0075;
      float rim = smoothstep(-0.001, 0.003, max(ex.x, ex.y));
      float wn = snoise(vec3(P.x * 140.0 + ix * 13.0, P.y * 140.0, jr * 7.0)) * 0.6 + snoise(P * 700.0) * 0.4;
      float wear = rim * smoothstep(0.72, 0.9, wn + (c.y > 0.0 ? 0.1 : -0.3));
      alb = mix(alb, T_HALIDE * 0.35, wear);
      metal = wear; rough = mix(rough, 0.32, wear);
      f0 = mix(f0, T_HALIDE * 0.75, wear);
    }
  } else if (m == M_CHROME) {
    alb = vec3(0.0); metal = 1.0; f0 = mix(T_HALIDE, T_LIGHTBOX, 0.5) * 0.92; rough = chromeR; refl = 1.0;
    // fingermarks: dull, greasy blooms where hands take the bar; fine pitting
    float fm = smoothstep(0.15, 0.7, snoise(P * 70.0) * 0.6 + snoise(P * 260.0) * 0.4);
    rough += 0.18 * fm + 0.04 * snoise(P * 900.0);
    f0 *= 1.0 - 0.18 * fm;
  } else if (m == M_CARD) {
    // a printed index card: a hairline border and a ruled line, nothing typed on it
    alb = mix(T_HALIDE, T_LIGHTBOX, 0.3) * 0.55; rough = 0.8;
    float xl = P.x - floor(P.x / CW + 0.5) * CW;
    float jr = floor((P.y - Y0) / DH);
    vec2 cu = vec2(xl, P.y - (Y0 + (jr + 0.5) * DH + 0.074));
    float px = 0.0005;
    float ln = 1.0 - smoothstep(0.00025, 0.00025 + px, abs(sdBox(cu, vec2(0.0335, 0.0102))));
    ln = max(ln, (1.0 - smoothstep(0.0002, 0.0002 + px, abs(cu.y + 0.004))) * step(abs(cu.x), 0.03));
    alb = mix(alb, T_SILVER * 0.35, ln * 0.6);
  } else if (m == M_FOLDER) {
    // pressboard grey card: fibre, a scored line under the hem, edges rubbed lighter
    float fib = snoise(vec3(P.x * 900.0, P.y * 160.0, P.z * 900.0)) * 0.5 + snoise(P * 60.0) * 0.5;
    alb = mix(T_SILVER, T_HALIDE, 0.42) * (0.62 + 0.05 * fib);
    rough = 0.7;
    // the row of tab slots punched under the hem, and the hem's fold
    vec3 q = P - vec3(0.0, 0.0, openZ);
    int k = int(clamp(floor((-FZ0 - q.z) / FDZ + 0.5), 0.0, float(NF - 1)));
    vec3 fl = q - vec3(0.0, YR + (k == K0832 ? lift08 : 0.0), -FZ0 - float(k) * FDZ + fzs[k]);
    fl.yz = tiltYZ(fl.yz, ftilt[k]);
    float px = 0.0009;
    float sx = abs(fract((fl.x + 0.1688) / 0.0225) - 0.5) * 0.0225;
    float slot = (1.0 - smoothstep(0.004 - px, 0.004 + px, sx)) * (1.0 - smoothstep(0.0009 - px, 0.0009 + px, abs(fl.y - 0.0035)))
      * step(abs(fl.x), 0.17) * step(abs(fl.z), 0.02);
    float hem = (1.0 - smoothstep(0.0, 0.0012, abs(fl.y + 0.0045))) * 0.25;
    alb = mix(alb * (1.0 - hem), alb * 0.3, slot * 0.8);
  } else if (m == M_PAPER) {
    alb = T_LIGHTBOX * (0.78 + 0.04 * snoise(P * 300.0)); rough = 0.85;
  } else if (m == M_TAB) {
    // a clear sleeve over a blank insert, dimmer than 08-32's typed one
    alb = mix(T_HALIDE, T_LIGHTBOX, 0.35) * 0.58; rough = 0.1; f0 = vec3(0.05);
  } else if (m == M_LABEL) {
    vec3 g = tabFrame(P);
    vec2 uv = vec2(g.x / (2.0 * INSW) + 0.5, g.y / (2.0 * INSH) + 0.5);
    float inIns = step(abs(g.x), INSW) * step(abs(g.y), INSH);
    // the label's footprint in texels per pixel
    float mpp = t * 2.0 * tanH / ${H.toFixed(1)} / PX_SCALE;
    float tpp = mpp * labelTexSize.x / (2.0 * INSW) / max(abs(dot(N, V)), 0.25);
    float ink = textureLod(labelTex, uv, log2(max(tpp, 1.0)) - 0.3).a * inIns;
    // typewriter ink: a little uneven
    ink *= 0.86 + 0.14 * snoise(vec2(P.x * 2200.0, P.y * 1800.0));
    vec3 paper = T_LIGHTBOX * (0.86 + 0.03 * snoise(P * 500.0));
    vec3 sleeve = mix(T_HALIDE, T_LIGHTBOX, 0.5) * 0.5;
    alb = mix(sleeve, mix(paper, T_FILM * 0.6, ink), inIns);
    rough = 0.1; f0 = vec3(0.05);
  } else if (m == M_RAW) {
    // zinc-plated sheet inside the drawer: dull metal
    alb = T_SILVER * 0.55; rough = 0.5; f0 = T_SILVER * 0.9; metal = 0.6;
  } else if (m == M_ROD) {
    // galvanised rod ends, dull
    alb = T_SILVER * 0.3; rough = 0.42; f0 = T_HALIDE * 0.9; metal = 1.0;
  } else if (m == M_FLOOR) {
    alb = T_FILM2 * 1.4; rough = 0.45;
  } else if (m == M_WALL) {
    alb = T_FILM2 * 1.6 + T_SILVER * 0.05; rough = 0.9;
  }
  if (metal > 0.0) f0 = mix(vec3(0.04), f0, metal);
  vec3 dif, spe;
  tubeLight(P, N, V, rough, f0, sh, dif, spe);
  // baked enamel has a gloss over its satin: the tube itself, a hard line along every rolled lip
  if (m == M_PAINT && metal < 0.5) {
    vec3 d2, s2;
    tubeLight(P, N, V, ccR * ccRough, vec3(0.04), sh, d2, s2);
    spe += s2 * ccK * ccAmt;
  }
  vec3 col = alb * (1.0 - metal) * (dif * fp + mix(T_HALIDE, T_FILM2 * 6.0, 0.5) * ambK * ao) + spe * mix(1.0, ao, 0.5);
  // inside the drawer and under the lid the light falls away (the AO gives the seams their grime)
  col *= mix(0.55, 1.0, ao);
  if (refl > 0.0) {
    vec3 R = reflect(rd, N);
    vec3 F = F_Schlick(f0, max(dot(N, V), 0.0));
    // rough chrome: jitter the reflected ray a little per tap
    vec3 jr = (hash33(vec3(FRAG_PX, tap) * 1.7) - 0.5) * rough * 0.5;
    envTube = 0.0;
    col += traceRefl(P + N * 0.001, normalize(R + jr)) * F * mix(0.4, 1.0, ao);
    envTube = 1.0;
  }
  float depth = dot(P - ro, camF);
  // nothing but the glow colours may bloom: speculars stop just under the bloom threshold
  col = min(col + emit, vec3(0.95));
  return vec4(col, depth);
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

/** Depth of field: a gather over a golden-angle disc; each tap spreads by its own circle of confusion, and what lies
 *  behind a sharper pixel cannot spread over it. */
export const DOF_FRAG = /* glsl */ `
uniform sampler2D src; uniform float focusD, aper, maxCoc;
const int NT = 112;
float coc(float d) { return min(aper * abs(d - focusD) / max(d, 1e-3), maxCoc); }
void main() {
  vec4 c0 = texture(src, vUv);
  float d0 = c0.a, r0 = coc(d0);
  float w0 = 1.0 / max(r0 * r0, 1.0) / (1.0 + 0.25 * luma(c0.rgb));
  vec3 acc = c0.rgb * w0; float ws = w0;
  float R = max(maxCoc, 1.0);
  float rot = hash12(FRAG_PX) * 6.2831853;
  for (int i = 0; i < NT; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(NT)) * R;
    float th = fi * 2.39996323 + rot;
    vec2 off = r * vec2(cos(th), sin(th));
    vec4 s = texture(src, vUv + off / vec2(${W.toFixed(1)}, ${H.toFixed(1)}));
    float rs = coc(s.a);
    if (s.a > d0) rs = min(rs, r0 + 0.5);
    float w = sat(rs - r + 0.75) / max(rs * rs, 1.0);
    w /= 1.0 + 0.25 * luma(s.rgb);
    acc += s.rgb * w; ws += w;
  }
  fragColor = vec4(acc / ws, 1.0);
}`;
