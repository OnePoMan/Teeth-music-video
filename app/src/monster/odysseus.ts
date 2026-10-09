// Odysseus as a shadow on the wall: the one figure among the shades of the dead you can tell apart (client,
// 2026-10-09). The same shadow-play language as the shades (motifs' GLSL_SHADE), but his own: a tall pointed
// traveller's cap (pilos), a beard, a Scythian double-curved bow with its string, a short belted tunic (the cloak
// is an option, off since the client's 2026-10-09 note: with the long hair it made two black masses), a planted wide
// stance, head a little bowed. Only he carries black-figure incision (thin lines back to the clay along the cap's
// rim, the hair's contour, the tunic's belt and hem, and the bow), and only he throws a true cast shadow: long, slanting, joined at his feet.
// Bigger than the shades; no face, no colour.
//
// GLSL: odysseus(q, pose, turn, cap, hair, cloak, px, inc) is his signed distance in units of his height (feet at the origin, y up,
// facing +x); odysseusOcc(p, A, B, C, px) is the wall's occlusion at wall point p (world: along the wall, height), with
// A = (x, h, pose, turn), B = (incise, lean, stretch, on), C = (cap, hair, cloak, -); odysseusWall(p, px) reads them from
// the uniforms odyA / odyB / odyC (see odysseusUniforms / setOdysseus). Needs sdSegment, smin and sat (GLSL_COMMON).
import * as THREE from 'three';

export const ODY_POSE = { calm: 0, archer: 1, traveller: 2 } as const;
export type OdyPose = keyof typeof ODY_POSE;
export const ODY_HAIR = { short: 0, loose: 1, tied: 2 } as const;
export type OdyHair = keyof typeof ODY_HAIR;

export interface OdysseusParams {
  /** Where he stands along the wall (world) and his height (world, feet to crown; the cap rises ~0.2 h above). */
  x: number;
  h: number;
  /** calm: bow held low at his side; archer: bow drawn, an arrow nocked; traveller: bow slung, a quiver. */
  pose: OdyPose;
  /** 0 his head in profile (facing +x), 1 turned to look at us. */
  turn?: number;
  /** The felt cap (default off). */
  cap?: boolean;
  /** His hair without the cap: long, thick and wavy, loose past the shoulders (default) or tied in a low ponytail; or short. */
  hair?: OdyHair;
  /** The cloak (chlamys) over his back shoulder (default off: a short tunic only, so the long hair reads on its own). */
  cloak?: boolean;
  /** The black-figure incision (default on). */
  incise?: boolean;
  /** The cast shadow: its sideways slant per unit of his height (negative leans left) and its stretch (>= 1). */
  lean?: number;
  stretch?: number;
  on?: boolean;
}

export function odysseusUniforms(): Record<string, THREE.IUniform> {
  return { odyA: { value: new THREE.Vector4(0, 4, 0, 0) }, odyB: { value: new THREE.Vector4(1, -0.8, 1.35, 0) }, odyC: { value: new THREE.Vector4(0, 1, 0, 0) } };
}

export function setOdysseus(u: Record<string, THREE.IUniform>, p: OdysseusParams) {
  (u.odyA!.value as THREE.Vector4).set(p.x, p.h, ODY_POSE[p.pose], p.turn ?? 0);
  (u.odyB!.value as THREE.Vector4).set(p.incise === false ? 0 : 1, p.lean ?? -0.8, Math.max(1, p.stretch ?? 1.35), p.on === false ? 0 : 1);
  (u.odyC!.value as THREE.Vector4).set(p.cap ? 1 : 0, ODY_HAIR[p.hair ?? 'loose'], p.cloak ? 1 : 0, 0);
}

export const GLSL_ODYSSEUS = /* glsl */ `
uniform vec4 odyA, odyB, odyC;
// an isosceles triangle, apex at the origin, base at y = q.y below it (y down; iq)
float odyTri(vec2 p, vec2 q) {
  p.x = abs(p.x);
  vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
  vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
  float s = -sign(q.y);
  vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)), vec2(dot(b, b), s * (p.y - q.y)));
  return -sqrt(d.x) * sign(d.y);
}
vec2 odyRot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
// the Scythian bow: grip at c, axis ax (unit, tip1 end), half-length L, bulge b (the limbs' two humps, signed: + to the
// right of the axis), the grip set forward of the string, the tips curling back onto it
float odyBow(vec2 q, vec2 c, vec2 ax, float L, float b, out vec2 t0, out vec2 t1) {
  vec2 n = vec2(ax.y, -ax.x);
  float d = 1e9; vec2 pv = c; t0 = c;
  for (int i = 0; i <= 16; i++) {
    float t = -1.0 + float(i) / 8.0, at = abs(t);
    float x = b * (0.45 * (1.0 - at) + 0.8 * sin(3.14159265 * at) + 0.12 * smoothstep(0.88, 1.0, at));
    vec2 P = c + ax * (t * L) + n * x;
    if (i == 0) t0 = P; else d = min(d, sdSegment(q, pv, P) - 0.012 * (1.0 - 0.5 * at));
    pv = P;
  }
  t1 = pv;
  return d;
}
// Odysseus: signed distance in units of his height; inc returns the incision (0..1, the clay showing through)
float odysseus(vec2 q, float pose, float turn, float cap, float hair, float cloak, float px, out float inc) {
  int ps = int(floor(pose + 0.5));
  float pr = 1.0 - sat(turn);                                       // how much the head is in profile
  float arch = ps == 1 ? 1.0 : 0.0;
  // legs: planted wide (the archer wider still), feet pointing forward
  float st = 0.17 + 0.05 * arch;
  float d = sdSegment(q, vec2(-0.045, 0.5), vec2(-st, 0.035)) - 0.037;
  d = smin(d, sdSegment(q, vec2(0.045, 0.5), vec2(st, 0.035)) - 0.037, 0.03);
  d = min(d, sdSegment(q, vec2(-st - 0.015, 0.014), vec2(-st + 0.05, 0.014)) - 0.016);
  d = min(d, sdSegment(q, vec2(st - 0.015, 0.014), vec2(st + 0.06, 0.014)) - 0.016);
  // a broad chest over a narrow waist, square shoulders
  d = smin(d, sdSegment(q, vec2(0.0, 0.5), vec2(0.012, 0.75)) - 0.075, 0.05);
  d = smin(d, sdSegment(q, vec2(-0.12, 0.775), vec2(0.12, 0.775)) - 0.044, 0.04);
  // the head: in profile (pr = 1) a long skull, the nose and a short beard pointing where he faces (+x); turned to us
  // (pr = 0) round and front-on, the beard a rounded chin under it
  vec2 hc = vec2(0.012 + 0.012 * pr, 0.935);
  d = smin(d, sdSegment(q, vec2(0.01, 0.8), hc + vec2(0.0, -0.03)) - 0.03, 0.015);
  d = smin(d, length((q - hc - vec2(-0.006 * pr, 0.0)) / vec2(0.05 + 0.008 * pr, 0.052)) * 0.05 - 0.05, 0.01);
  if (pr > 0.01) d = smin(d, odyTri(vec2(q.y - hc.y + 0.005, hc.x + 0.072 * pr - q.x), vec2(0.016, 0.03)) - 0.003, 0.008);  // the nose
  vec2 bc = hc + vec2(0.03 * pr, -0.05 + 0.01 * pr);
  d = smin(d, length((q - bc) / vec2(0.034 + 0.008 * (1.0 - pr), 0.03)) * 0.03 - 0.03, 0.012);                 // the beard
  if (pr > 0.01) d = smin(d, sdSegment(q, bc, bc + vec2(0.035 * pr, -0.022)) - 0.012 * pr, 0.01);           // its point, forward
  // the cap (pilos): an egg of felt on a thin rim, tipped back a little in profile, symmetric turned to us; or bare,
  // short hair, its edge rough
  vec2 cb = hc + vec2(-0.008 * pr, 0.022);
  vec2 cp = odyRot(q - cb, -0.18 * pr);
  float rx = 0.058 * (1.0 - 0.3 * sat(cp.y / 0.1));
  float dCap = max(length(cp / vec2(rx, 0.1)) * rx - rx, -cp.y);
  float strand = 1e9;                                               // distance to the hair's incised strand lines
  if (cap > 0.5) d = min(d, dCap);
  else if (hair < 0.5) {
    float ha = atan(q.y - hc.y, q.x - hc.x);
    float sh = length((q - hc - vec2(-0.008 * pr, 0.004)) / vec2(0.056, 0.056)) * 0.056 - 0.056 - 0.0025 * (0.5 + 0.5 * sin(ha * 14.0));
    sh = max(sh, -(q.y - hc.y + 0.01 - 0.03 * pr * sat((hc.x - q.x) / 0.05)));
    d = min(d, sh);
    dCap = sh;
  }
  // long, thick, wavy hair (no cap): a full mass over the skull, back from the brow in profile; loose, it flows down
  // behind his neck and past his back shoulder, its curly ends out against the wall (turned to us, two masses frame
  // the face); tied, gathered into a low ponytail. Added after the cloak, so one incised contour can part them.
  float dHair = 1e9;
  if (cap < 0.5 && hair > 0.5) {
    float tied = hair > 1.5 ? 1.0 : 0.0;
    vec2 sc = hc + vec2(-0.014 * pr, 0.01);
    float sk = length(q - sc) - 0.06;
    dHair = max(sk, -(q.y - hc.y + 0.006 - 0.05 * pr * sat((hc.x - 0.005 - q.x) / 0.03)) - 0.08 * (1.0 - pr) * sat(abs(q.x - hc.x) / 0.04 - 0.7));
    for (int k = 0; k < 2; k++) {
      float sd = k == 0 ? -1.0 : 1.0;
      vec2 a = mix(hc + vec2(0.048 * sd, 0.0), hc + vec2(-0.035, 0.005), pr);
      vec2 b = mix(hc + vec2(0.105 * sd, -0.15), hc + vec2(-0.21, -0.165), pr);
      if (tied > 0.5) { a = mix(hc + vec2(0.045 * sd, 0.0), hc + vec2(-0.05, -0.035), pr); b = mix(hc + vec2(0.05 * sd, -0.04), hc + vec2(-0.075, -0.19), pr); }
      vec2 ab = b - a; float lab = length(ab);
      float t = sat(dot(q - a, ab) / (lab * lab));
      vec2 dir = ab / lab, nrm = vec2(-dir.y, dir.x);
      float side = dot(q - a - ab * t, nrm);
      float wav = (1.0 - tied) * 0.012 * sin(t * 5.5 + 0.4);                 // one long, smooth wave
      float r = tied > 0.5 ? mix(0.018, 0.014, t) + 0.008 * smoothstep(0.85, 1.0, t) : mix(0.048, 0.034, t) * (1.0 - 0.15 * pr * (1.0 - t)) ;
      float lk = max(abs(side - wav) - r, max(-dot(q - a, dir) - 0.02, dot(q - b, dir)));
      if (tied < 0.5) {
        // the curly ends, out against the wall
        vec2 e = b + nrm * wav;
        lk = min(lk, length(q - e - nrm * 0.022 + dir * 0.004) - 0.022);
        lk = min(lk, length(q - e + nrm * 0.02 - dir * 0.01) - 0.02);
        lk = min(lk, length(q - e - dir * 0.022) - 0.017);
      }
      dHair = smin(dHair, lk, 0.012);
      // two long smooth strand lines along the mass, short of its ends
      float sl = min(abs(side - wav - 0.38 * r), abs(side - wav + 0.32 * r));
      if (tied > 0.5) sl = min(abs(side), abs(t - 0.14) * lab + step(r, abs(side)));
      strand = min(strand, sl + step(0.86, t) + step(t, 0.1));
    }
  }
  // the cloak (chlamys): over his back shoulder, its edge crossing his chest, hanging behind him in folds to a zigzag hem
  float back = 0.135 + (0.05 + 0.04 * arch) * sat((0.8 - q.y) / 0.35);
  float hem = 0.47 - 0.07 * sat(-q.x / 0.2) + 0.03 * abs(fract(q.x * 14.0) - 0.5);
  float front = -0.03 + 0.11 * sat((q.y - 0.5) / 0.3);
  float dCl = max(max(q.y - 0.835 + 0.06 * sat(q.x / 0.1), hem - q.y), max(-q.x - back, q.x - front));
  if (cloak > 0.5) d = smin(d, dCl, 0.012);
  else dCl = 1e9;
  // or bare: a short tunic, belted at the waist and flaring to a hem at mid-thigh (the archer's skirt a little wider)
  float tHem = 0.4, tBelt = 0.575;
  float tuW = mix(0.13 + 0.025 * arch, 0.07, sat((q.y - tHem) / (tBelt - tHem)));
  float dTu = max(abs(q.x - 0.004) - tuW, max(tHem - q.y, q.y - 0.62));
  if (cloak < 0.5) d = smin(d, dTu, 0.01);
  // the hair over him, parted from the cloak and his back by one incised contour
  float hairEdge = abs(dHair) + step(-0.004, d) + step(hc.y - 0.07, q.y);
  d = min(d, dHair);
  // the arms, the bow, the string (and the arrow, the quiver)
  vec2 t0, t1, gS = vec2(0.0);
  float dBow, dStr, dX = 1e9;
  if (ps == 1) {
    // the archer: bow arm straight out at the target, the string drawn back to the chin, an arrow on it
    d = smin(d, sdSegment(q, vec2(0.1, 0.785), vec2(0.4, 0.8)) - 0.026, 0.02);
    d = smin(d, sdSegment(q, vec2(-0.1, 0.785), vec2(-0.13, 0.84)) - 0.028, 0.02);
    d = smin(d, sdSegment(q, vec2(-0.13, 0.84), vec2(0.05, 0.84)) - 0.025, 0.02);
    dBow = odyBow(q, vec2(0.41, 0.8), vec2(0.0, 1.0), 0.29, 0.065, t0, t1);
    gS = vec2(0.05, 0.84);
    dStr = min(sdSegment(q, t0, gS), sdSegment(q, gS, t1));
    dX = sdSegment(q, vec2(-0.02, 0.84), vec2(0.53, 0.82)) - 0.006;                          // the shaft
    dX = min(dX, odyTri(vec2(q.y - 0.82, 0.6 - q.x), vec2(0.02, 0.065)));                       // its head
    dX = min(dX, sdSegment(q, vec2(-0.04, 0.84), vec2(0.03, 0.84)) - 0.012);                 // the fletching
  } else if (ps == 2) {
    // the traveller: the bow slung on his back, a quiver over his shoulder, arms down
    d = smin(d, sdSegment(q, vec2(0.11, 0.775), vec2(0.155, 0.64)) - 0.027, 0.02);
    d = smin(d, sdSegment(q, vec2(0.155, 0.64), vec2(0.15, 0.51)) - 0.025, 0.02);
    d = smin(d, sdSegment(q, vec2(-0.11, 0.775), vec2(-0.14, 0.52)) - 0.027, 0.02);
    dBow = odyBow(q, vec2(-0.25, 0.62), normalize(vec2(0.35, 1.0)), 0.3, -0.055, t0, t1);
    dStr = sdSegment(q, t0, t1);
    vec2 qa = vec2(-0.13, 0.5), qb = vec2(-0.07, 0.88);
    dX = sdSegment(q, qa, qb) - 0.03 - 0.012 * sat((q.y - 0.48) / 0.38);                                                     // the quiver
    dX = min(dX, sdSegment(q, qb, qb + vec2(0.012, 0.03)) - 0.042);                           // its mouth
    for (int k = 0; k < 3; k++) {                                                             // arrows standing in it
      vec2 a0 = qb + vec2(-0.02 + 0.02 * float(k), 0.02), a1 = a0 + vec2(-0.02 + 0.014 * float(k - 1), 0.1 - 0.012 * abs(float(k - 1)));
      dX = min(dX, sdSegment(q, a0, a1) - 0.006);
      dX = min(dX, sdSegment(q, a1 - (a1 - a0) * 0.25, a1) - 0.013);
    }
  } else {
    // calm: arms down, the bow held low at his side in the front hand, upright, its string toward him
    d = smin(d, sdSegment(q, vec2(0.11, 0.775), vec2(0.145, 0.64)) - 0.027, 0.02);
    d = smin(d, sdSegment(q, vec2(0.145, 0.64), vec2(0.16, 0.51)) - 0.025, 0.02);
    d = smin(d, sdSegment(q, vec2(-0.11, 0.775), vec2(-0.14, 0.52)) - 0.027, 0.02);
    dBow = odyBow(q, vec2(0.175, 0.5), normalize(vec2(0.1, 1.0)), 0.29, 0.06, t0, t1);
    dStr = sdSegment(q, t0, t1);
  }
  float body = d;                                                   // the man, without the bow
  d = min(d, min(dBow, dStr - 0.0035));
  d = min(d, dX);
  // the incision: thin lines back to the clay, only within his black
  float w = 0.0042 + 0.5 * px;
  float inside = 1.0 - smoothstep(-0.012, -0.004, body);
  float L = 0.0;
  if (cap > 0.5) L = max(L, (1.0 - smoothstep(w * 0.5, w, abs(cp.y - 0.016))) * step(dCap, -0.006));   // the cap's rim
  else if (hair < 0.5) L = max(L, (1.0 - smoothstep(w * 0.5, w, abs(dCap + 0.012))) * step(hc.y - 0.012, q.y) * step(dCap, -0.004));   // the hairline
  L = max(L, (1.0 - smoothstep(w * 0.5, w, strand)) * step(d, -0.006));                                 // the hair's strands
  L = max(L, (1.0 - smoothstep(w * 0.5, w, hairEdge)) * step(d, -0.006));                               // its contour
  float dEdge = max(hem - q.y, max(-q.x - back, q.x - front)), fu = (front - q.x) / (front + back);
  if (cloak > 0.5) {
    L = max(L, (1.0 - smoothstep(w * 0.5, w, abs(dEdge + 0.014))) * step(dCl, -0.004) * step(q.y, 0.8));    // the cloak's edge
    float fold = min(min(abs(fu - 0.35), abs(fu - 0.58)), abs(fu - 0.8)) * (front + back);
    L = max(L, (1.0 - smoothstep(w * 0.5, w, fold)) * step(dCl, -0.03) * step(q.y, 0.72) * (ps == 2 ? 0.0 : 1.0));   // its folds
  } else {
    float tIn = step(dTu, -0.008);
    L = max(L, (1.0 - smoothstep(w * 0.5, w, abs(q.y - tBelt + 0.012))) * tIn);                         // the tunic's belt
    L = max(L, (1.0 - smoothstep(w * 0.5, w, abs(q.y - tHem - 0.018))) * tIn);                          // its hem border
    float tf = (q.x - 0.004) / tuW;                                                                     // two folds in the skirt
    L = max(L, (1.0 - smoothstep(w * 0.5, w, min(abs(tf - 0.4), abs(tf + 0.4)) * tuW)) * tIn * step(q.y, tBelt - 0.03) * step(tHem + 0.035, q.y));
  }
  L = max(L, (1.0 - smoothstep(w * 0.5, w, abs(dBow - 0.008))) * inside);                          // the bow over him
  L = max(L, (1.0 - smoothstep(w * 0.5, w, dStr)) * inside * (ps == 2 ? 0.0 : 1.0));                                      // the string over him
  inc = L;
  return d;
}
float odysseusOcc(vec2 p, vec4 A, vec4 B, vec4 C, float px) {
  if (B.w <= 0.0) return 0.0;
  vec2 q = vec2(p.x - A.x, p.y) / A.y;
  float pq = px / A.y, occ = 0.0, inc;
  if (q.y > -0.05 && q.y < 1.12 && abs(q.x) < 0.7) {
    float d = odysseus(q, A.z, A.w, C.x, C.y, C.z, pq, inc);
    occ = (1.0 - smoothstep(-pq, pq, d)) * (1.0 - inc * B.x);
  }
  // the cast: his shadow thrown by a low fire, long and slanting, joined at his feet, crisp enough to show the bow
  float yc = q.y / B.z;
  vec2 qc = vec2(q.x - B.y * yc, yc);
  if (yc > -0.02 && yc < 1.12 && abs(qc.x) < 0.7) {
    float dc = odysseus(qc, A.z, A.w, C.x, C.y, C.z, pq, inc);
    float soft = pq + 0.002 + 0.005 * yc;
    occ = max(occ, 0.6 * (1.0 - smoothstep(-soft, soft, dc)) * (1.0 - 0.25 * yc));
  }
  return occ;
}
float odysseusWall(vec2 p, float px) { return odysseusOcc(p, odyA, odyB, odyC, px); }`;
