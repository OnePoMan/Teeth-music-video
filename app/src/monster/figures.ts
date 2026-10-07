// Shadow-theatre figures (docs/MONSTER.md): the four monsters of verse 2 as flat silhouettes for the clay wall,
// signed distances in world units (negative inside), feet at the origin, y up. They are puppets' shadows: no
// faces, only outlines and cut-outs, like the perforations of a shadow puppet or the incised lines of a
// black-figure vase, through which the lit clay shows.
//   polyphemus(p, eye, t)              the one-eyed giant, head and shoulders over his flock, club in hand; eye 0 shut, 1 open
//   circe(p, k, look)                  the witch with her staff in her cup; a man on all fours at the cup becomes a pig (k)
//   poseidon(p, k, thrust, tip, look)  a wave heaving (k) and curling over; an arm drives the trident up through it
//                                      (thrust); a galley before the wave pitches up (tip)
//   trojanHorse(p, h1, h2, roll, look) the wooden horse on its wheeled platform; its hatch opens (h1), a rope ladder
//                                      drops (h2); roll turns the wheels
// look (0..1) opens frontal eyes on us: Circe's, the pig's, the horse's, an eye in the heart of the wave.
// Needs GLSL_COMMON (sdCircle, sdBox, sdSegment, smin, rot2, snoise).
export const GLSL_FIGURES = /* glsl */ `
float sdEll(vec2 p, vec2 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float sdTrap(vec2 p, float r1, float r2, float he) {           // isosceles trapezoid: bottom half-width r1, top r2, half-height he
  vec2 k1 = vec2(r2, he), k2 = vec2(r2 - r1, 2.0 * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, (p.y < 0.0) ? r1 : r2), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
float sdCap(vec2 p, vec2 a, vec2 b, float ra, float rb) {      // a tapered capsule
  vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
// an incision: a line (l: the unsigned distance to it) of half-width w cut through the black
float incise(float d, float l, float w) { return max(d, w - l); }
// a figure in front of another, parted from it by a reserved line of clay (the vase painters' convention)
float before(float back, float front, float gap) { return min(max(back, gap - front), front); }
// an archaic frontal eye (the vase painters drew eyes from the front even in faces in profile): an almond of
// half-width w cut through the black and opened by k, its iris black
float frontEye(float d, vec2 p, vec2 c, float w, float k) {
  if (k <= 0.001) return d;
  vec2 e = (p - c) / vec2(1.0, k);
  float al = max(length(e - vec2(0.0, -0.85 * w)) - 1.31 * w, length(e - vec2(0.0, 0.85 * w)) - 1.31 * w) * min(1.0, k);
  return min(max(d, -al), max(length(p - c) - 0.38 * w, al));
}

// ---- a sheep, walking (phase w), facing +x, about 1.3 tall
float sheep(vec2 p, float w) {
  float d = sdEll(p - vec2(0.0, 0.8), vec2(0.7, 0.4));
  for (int i = 0; i < 5; i++) d = min(d, sdCircle(p - vec2(-0.55 + 0.28 * float(i), 1.06 + 0.06 * sin(float(i) * 2.3)), 0.21));   // fleece
  d = smin(d, sdEll(rot2(0.45) * (p - vec2(0.86, 0.86)), vec2(0.3, 0.17)), 0.1);                    // head, a little lowered
  d = min(d, sdEll(rot2(-0.35) * (p - vec2(0.7, 1.06)), vec2(0.15, 0.06)));                          // ear
  d = min(d, sdCircle(p - vec2(-0.74, 0.92), 0.11));                                                 // tail
  for (int i = 0; i < 4; i++) {
    float x = -0.45 + 0.3 * float(i), sw = 0.12 * sin(w + float(i) * 1.6);
    d = min(d, sdSegment(p, vec2(x, 0.55), vec2(x + sw, 0.0)) - 0.07);
  }
  return d;
}

// ---- Polyphemus: a giant from the chest up, facing us; his one eye a cut-out in the brow; a club; his flock
float polyphemus(vec2 p, float eye, float t) {
  vec2 h = p - vec2(0.0, 6.4);
  float d = sdEll(h, vec2(1.85, 2.25)) + 0.11 * snoise(p * 1.6) * smoothstep(-0.5, 1.8, h.y);   // shaggy head
  d = smin(d, sdEll(p - vec2(0.0, 5.0), vec2(1.6, 1.2)) + 0.13 * snoise(p * 2.2), 0.3);           // jaw and beard
  d = min(d, sdEll(p - vec2(-1.92, 6.25), vec2(0.3, 0.52)));                                       // ears
  d = min(d, sdEll(p - vec2(1.92, 6.25), vec2(0.3, 0.52)));
  d = smin(d, sdBox(p - vec2(0.0, 4.1), vec2(1.0, 0.7)), 0.4);                                     // neck
  d = smin(d, max(sdEll(p - vec2(0.0, 2.3), vec2(4.7, 2.4)), p.y - 4.3), 0.6);                    // shoulders
  d = min(d, sdBox(p - vec2(0.0, 0.9), vec2(4.2, 1.1)));
  // the club in his fist, rising past his head, knotted
  vec2 c0 = vec2(3.65, 2.3), c1 = vec2(4.95, 8.9), cn = vec2(0.981, -0.193);
  d = smin(d, sdEll(p - vec2(3.85, 3.45), vec2(0.78, 0.64)), 0.2);
  d = min(d, sdCap(p, c0, c1, 0.26, 0.62) + 0.07 * snoise(p * 3.0));
  for (int i = 0; i < 3; i++) {
    float f = 0.5 + 0.15 * float(i), s = (i == 1) ? -1.0 : 1.0;
    d = min(d, sdCircle(p - mix(c0, c1, f) - s * cn * (0.26 + 0.36 * f) * 0.85, 0.17));
  }
  // incisions: a scowling brow, the beard's strands, the fingers round the club
  d = incise(d, sdSegment(p, vec2(-1.35, 7.62), vec2(-0.14, 7.25)), 0.065);
  d = incise(d, sdSegment(p, vec2(1.35, 7.62), vec2(0.14, 7.25)), 0.065);
  d = incise(d, max(abs(length((p - vec2(0.0, 6.45)) * vec2(0.82, 1.0)) - 1.28), p.y - 5.75), 0.045);   // the beard's edge
  for (int i = 0; i < 7; i++) {                                                                     // its strands, fanning down
    float f = -1.0 + 2.0 * float(i) / 6.0;
    vec2 a0 = vec2(0.0, 6.45) + vec2(f * 1.0, -1.28 * sqrt(max(1.0 - f * f * 0.62, 0.0)) - 0.12);
    d = incise(d, sdSegment(p, a0, a0 + vec2(f * 0.45, -0.95 + 0.2 * abs(f))), 0.028);
  }
  for (int i = 0; i < 3; i++) d = incise(d, sdSegment(p, vec2(3.3, 3.25 + 0.22 * float(i)), vec2(4.3, 3.45 + 0.22 * float(i))), 0.03);
  // the eye: one almond through the brow, opening (the lit clay shows through it), its iris black
  float ey = max(eye, 0.001);
  vec2 e = (p - vec2(0.0, 6.75)) / vec2(1.0, ey);
  float almond = max(length(e - vec2(0.0, -0.66)) - 1.02, length(e - vec2(0.0, 0.66)) - 1.02) * min(1.0, ey);
  d = max(d, -almond);
  d = min(d, max(sdCircle(p - vec2(0.0, 6.73), 0.27), almond));
  // the flock crossing before him: reserved in the clay where they cross his shadow, black beyond it
  float fl = 1e3;
  for (int i = 0; i < 3; i++) {
    float x = -5.2 + 2.6 * float(i) + 1.4 * t;
    fl = min(fl, sheep(p - vec2(x, 0.0), t * 9.0 + float(i) * 2.1));
  }
  return max(min(d, fl), -max(d, fl));
}

// ---- a man on all fours at the cup, facing -x (k 0); a pig (k 1)
float circeMan(vec2 p, float k, float look) {
  float man = sdSegment(p, vec2(0.72, 1.42), vec2(-0.5, 1.5)) - 0.32;                              // back
  man = smin(man, sdCircle(p - vec2(-1.02, 1.66), 0.27), 0.1);                                     // head, raised to the cup
  man = smin(man, sdSegment(p, vec2(-0.55, 1.4), vec2(-0.82, 0.05)) - 0.12, 0.1);                  // arms
  man = min(man, sdSegment(p, vec2(-0.35, 1.4), vec2(-0.5, 0.05)) - 0.11);
  man = smin(man, sdSegment(p, vec2(0.75, 1.35), vec2(0.82, 0.14)) - 0.17, 0.1);                   // thigh, knee down
  man = min(man, sdSegment(p, vec2(0.82, 0.11), vec2(1.62, 0.08)) - 0.1);                          // shin
  float pig = sdEll(p - vec2(0.12, 1.02), vec2(1.06, 0.6));                                        // body
  pig = smin(pig, sdEll(p - vec2(-0.98, 1.15), vec2(0.42, 0.36)), 0.12);                           // head
  pig = smin(pig, sdBox(p - vec2(-1.47, 1.02), vec2(0.18, 0.15)) - 0.03, 0.06);                    // snout
  pig = min(pig, sdTrap(rot2(0.55) * (p - vec2(-0.86, 1.56)), 0.15, 0.02, 0.2));                   // ear
  for (int i = 0; i < 4; i++) {
    float x = (i < 2) ? -0.62 + 0.24 * float(i) : 0.52 + 0.24 * float(i - 2);
    pig = min(pig, sdSegment(p, vec2(x, 0.6), vec2(x, 0.0)) - 0.1);                               // legs
  }
  float a = atan(p.y - 1.28, p.x - 1.33);
  pig = min(pig, max(abs(length(p - vec2(1.33, 1.28)) - 0.17) - 0.045, -(a + 0.6)));              // the curled tail
  pig = incise(pig, length(p - vec2(-1.07, 1.24)), 0.055 * (1.0 - look));                          // eye
  pig = frontEye(pig, p, vec2(-1.04, 1.24), 0.17 * (1.0 + 0.5 * look), look);
  pig = incise(pig, abs(p.x + 1.32) + max(0.0, abs(p.y - 1.02) - 0.1), 0.025);                     // the snout's end
  return mix(man, pig, k);
}

// ---- Circe: robed, her hair down her back, her staff in the cup on its stand; the man (the pig) at the cup
float circe(vec2 p, float k, float look) {
  vec2 q = p - vec2(-3.4, 0.0);
  float d = sdTrap(q - vec2(0.05, 1.98), 1.0, 0.3, 1.98);                                          // the skirt, flaring to the floor
  d = smin(d, sdEll(q - vec2(0.02, 4.55), vec2(0.34, 0.66)), 0.12);                               // the body above the belt
  d = smin(d, sdEll(q - vec2(0.24, 4.7), vec2(0.19, 0.17)), 0.08);                                // breast
  d = min(d, sdEll(q - vec2(1.0, 0.07), vec2(0.2, 0.08)));                                         // her foot
  d = smin(d, sdBox(q - vec2(0.06, 5.25), vec2(0.12, 0.2)), 0.05);                                 // neck
  vec2 hc = q - vec2(0.1, 5.75);                                                                    // head in profile, facing +x
  float head = sdEll(hc, vec2(0.3, 0.37));
  head = min(head, sdSegment(hc, vec2(0.22, 0.08), vec2(0.39, -0.06)) - 0.055);                   // nose
  head = smin(head, sdCircle(hc - vec2(0.18, -0.25), 0.12), 0.07);                                // lips, chin
  d = smin(d, head, 0.05);
  d = min(d, sdBox(rot2(-0.2) * (hc - vec2(0.02, 0.3)), vec2(0.32, 0.06)));                       // diadem
  // her hair, long, down her back in waves
  float hw = 0.06 * sin(q.y * 7.0);
  d = smin(d, sdCap(q - vec2(hw, 0.0), vec2(-0.1, 5.95), vec2(-0.42, 3.85), 0.3, 0.12), 0.1);
  // the arm, bent, reaching forward to hold the staff
  d = smin(d, sdSegment(q, vec2(0.1, 5.0), vec2(0.78, 4.62)) - 0.1, 0.06);
  d = smin(d, sdSegment(q, vec2(0.78, 4.62), vec2(1.62, 5.22)) - 0.085, 0.05);
  d = min(d, sdCircle(q - vec2(1.7, 5.25), 0.13));                                                  // hand
  d = min(d, sdSegment(q, vec2(1.25, 6.6), vec2(2.75, 2.55)) - 0.065);                              // the staff, into the cup
  d = min(d, sdCircle(q - vec2(1.25, 6.6), 0.15));
  // incisions: the belt, the folds fanning from it, a zigzag border at the hem
  d = incise(d, abs(q.y - 3.92) + max(0.0, abs(q.x - 0.03) - 0.45), 0.035);
  for (int i = 0; i < 3; i++) {
    float f = -0.55 + 0.55 * float(i);
    d = incise(d, sdSegment(q, vec2(0.03 + f * 0.22, 3.75), vec2(0.06 + f * 0.85, 0.75)), 0.03);
  }
  d = incise(d, abs(q.y - 0.3), 0.03);
  d = incise(d, abs(q.y - 0.64), 0.03);
  d = incise(d, abs(q.y - (0.38 + 0.18 * abs(fract(q.x * 2.5) - 0.5) * 2.0)) / 1.35, 0.025);
  // the cup: a deep bowl with handles, on a stem and foot
  vec2 c = p - vec2(-0.5, 0.0);
  float bowl = max(sdEll(c - vec2(0.0, 2.35), vec2(1.15, 0.85)), c.y - 2.75);
  bowl = min(bowl, sdBox(c - vec2(0.0, 2.75), vec2(1.22, 0.07)));
  bowl = min(bowl, abs(sdEll(c - vec2(-1.2, 2.38), vec2(0.3, 0.25))) - 0.055);
  bowl = min(bowl, abs(sdEll(c - vec2(1.2, 2.38), vec2(0.3, 0.25))) - 0.055);
  bowl = min(bowl, sdBox(c - vec2(0.0, 1.05), vec2(0.13, 0.5)));
  bowl = min(bowl, sdEll(c - vec2(0.0, 0.25), vec2(0.62, 0.25)));
  bowl = incise(bowl, abs(c.y - 2.22) + max(0.0, abs(c.x) - 0.95), 0.03);                          // a band round the bowl
  d = min(d, bowl);
  // the fumes: three wisps rising
  for (int i = 0; i < 3; i++) {
    float x0 = -0.5 + 0.5 * float(i);
    vec2 w = c - vec2(x0 + 0.18 * sin(c.y * 2.6 + float(i) * 1.7), 0.0);
    d = min(d, max(abs(w.x) - 0.06 * (1.0 - sat((c.y - 3.0) / 2.2)), max(3.0 - c.y, c.y - 5.2)));
  }
  d = frontEye(d, p, vec2(-3.15, 5.82), 0.13 * (1.0 + 0.5 * look), look);
  return min(d, circeMan((p - vec2(2.9, 0.0)) / 1.25, k, look) * 1.25);
}

// ---- Poseidon: the god himself, bearded, rising waist-deep out of the sea (k) with his trident raised (thrust); the
// sea's running-wave border breaks before him; a galley pitches up beside him (tip). Archaic black-figure: a frontal
// chest, the head in profile toward the ship, a long wedge beard, hair down his back, a fillet; the eye incised.
// a scroll: a spiral arm leaving at angle a0 (radius R) and winding inward, counter-clockwise, for 'turns'
float scroll(vec2 p, float R, float a0, float w, float turns) {
  float r = length(p), th = atan(p.y, p.x), L = turns * 6.2831853, d = 1e3;
  for (int n = 0; n < 3; n++) {
    float ph = th - a0 + 6.2831853 * float(n);
    if (ph < 0.0 || ph > L) continue;
    d = min(d, abs(r - R * (1.0 - ph / (L + 2.4))) - w * (1.0 - 0.55 * ph / L));
  }
  return d;
}
float galley(vec2 p) {
  float d = max(sdEll(p - vec2(0.0, 0.32), vec2(2.35, 0.62)), p.y - 0.32);                         // hull: a long curved belly
  d = min(d, sdSegment(p, vec2(1.6, -0.12), vec2(2.85, -0.2)) - 0.09);                             // the ram, at the waterline
  d = min(d, sdCap(p, vec2(2.0, 0.2), vec2(2.5, 0.75), 0.12, 0.07));                               // the bow, raised
  d = min(d, max(abs(length(p - vec2(-2.05, 0.85)) - 0.55) - 0.08, min(p.x + 2.05, 0.85 - p.y)));   // the stern post curling up and over
  d = min(d, sdSegment(p, vec2(0.0, 0.2), vec2(0.0, 2.75)) - 0.06);                                // mast
  d = min(d, sdBox(p - vec2(0.0, 1.9), vec2(1.05, 0.72)));                                          // sail
  d = min(d, sdSegment(p, vec2(-1.25, 2.62), vec2(1.25, 2.62)) - 0.05);                             // yard
  for (int i = 0; i < 6; i++) d = min(d, sdSegment(p, vec2(-1.3 + 0.5 * float(i), -0.1), vec2(-1.62 + 0.5 * float(i), -0.85)) - 0.04);  // oars
  d = incise(d, length(p - vec2(1.6, 0.05)), 0.08);                                                 // the eye on the bow
  d = incise(d, abs(p.y - 0.06) + max(0.0, abs(p.x) - 1.4), 0.025);                                 // the oar ports' rail
  for (int i = 0; i < 3; i++) d = incise(d, abs(p.x + 0.5 * float(i - 1)) + max(0.0, abs(p.y - 1.9) - 0.6), 0.025);   // the sail's seams
  return d;
}
float poseidonGod(vec2 g, float thrust, float look) {
  // g: his own space, the waist at y 0.6, the ship to his left (-x)
  float d = sdTrap(g - vec2(0.0, 2.1), 0.72, 1.28, 1.5);                                          // torso
  d = smin(d, sdCircle(g - vec2(-1.16, 3.36), 0.4), 0.2);                                          // shoulders
  d = smin(d, sdCircle(g - vec2(1.16, 3.36), 0.4), 0.2);
  d = smin(d, sdBox(g - vec2(0.0, 3.86), vec2(0.3, 0.32)), 0.08);                                  // neck
  vec2 h = g - vec2(0.02, 4.66);
  float head = sdEll(h, vec2(0.54, 0.62));
  head = smin(head, sdSegment(h, vec2(-0.44, 0.2), vec2(-0.66, -0.12)) - 0.05, 0.08);             // a straight nose
  head = smin(head, sdCap(g, vec2(0.3, 4.95), vec2(0.66, 3.5), 0.44, 0.3), 0.12);                 // his hair, down his back
  // the beard: full from the cheek, falling to a point on his chest, parted from it by a line of clay
  float beard = min(sdCap(g, vec2(-0.12, 4.36), vec2(-0.56, 3.2), 0.42, 0.05), sdEll(g - vec2(-0.12, 4.25), vec2(0.46, 0.3)));
  d = smin(d, head, 0.06);
  d = before(d, beard, 0.045);
  d = min(d, head);
  // one arm stretched toward the ship, the palm raised against it; the other lifting the trident
  d = smin(d, sdCap(g, vec2(-1.12, 3.36), vec2(-2.5, 3.08), 0.27, 0.18), 0.12);
  d = smin(d, sdEll(rot2(-0.12) * (g - vec2(-2.66, 3.32)), vec2(0.13, 0.32)), 0.05);
  d = min(d, sdCap(g, vec2(-2.56, 3.1), vec2(-2.42, 3.38), 0.05, 0.04));                          // the thumb
  float ty = mix(4.4, 7.2, thrust), tx = 2.05;                                                      // the trident's crossbar
  vec2 hand = vec2(tx - 0.02, ty - 1.65), sh = vec2(1.18, 3.42), el = mix(sh, hand, 0.5) + vec2(0.5, -0.1);
  d = smin(d, sdCap(g, sh, el, 0.3, 0.24), 0.1);
  d = smin(d, sdCap(g, el, hand, 0.24, 0.2), 0.08);
  d = min(d, sdEll(g - hand, vec2(0.25, 0.22)));                                                     // the fist
  float tri = sdSegment(g, vec2(tx, ty - 5.2), vec2(tx, ty + 0.15)) - 0.085;
  tri = min(tri, sdBox(g - vec2(tx, ty), vec2(0.78, 0.09)));
  for (int i = 0; i < 3; i++) {
    float x = tx - 0.75 + 0.75 * float(i), pt = ty + (i == 1 ? 1.5 : 1.12);
    tri = min(tri, sdSegment(g, vec2(x, ty), vec2(x, pt)) - 0.075);
    vec2 b = g - vec2(x, pt);
    tri = min(tri, max(abs(b.x) * 1.5 + b.y - 0.24, -b.y - 0.2));                                   // barbed point
  }
  d = min(d, tri);
  // incisions, as the vase painters drew a strong man: the chest, the arch of the ribs, the line down the belly, the
  // navel; the fingers round the shaft; the beard's and the hair's strands; the eye, archaic and frontal
  d = incise(d, max(abs(length((g - vec2(-0.5, 3.15)) * vec2(1.0, 1.5)) - 0.48), g.y - 3.15), 0.035);
  d = incise(d, max(abs(length((g - vec2(0.5, 3.15)) * vec2(1.0, 1.5)) - 0.48), g.y - 3.15), 0.035);
  d = incise(d, max(max(abs(length((g - vec2(0.0, 1.95)) * vec2(1.0, 1.25)) - 0.78), 2.2 - g.y), 0.22 - abs(g.x)), 0.03);
  d = incise(d, sdSegment(g, vec2(0.0, 2.85), vec2(0.0, 1.85)), 0.028);
  d = incise(d, length(g - vec2(0.0, 1.55)), 0.06);
  for (int i = 0; i < 3; i++) d = incise(d, sdSegment(g, hand + vec2(-0.2, 0.1 - 0.1 * float(i)), hand + vec2(0.2, 0.1 - 0.1 * float(i))), 0.018);
  for (int i = 0; i < 3; i++) d = incise(d, sdSegment(g, vec2(-0.36 + 0.15 * float(i), 4.08), vec2(-0.5 + 0.1 * float(i), 3.5 + 0.12 * float(i))), 0.022);
  for (int i = 0; i < 3; i++) d = incise(d, sdSegment(g, vec2(0.28 + 0.15 * float(i), 4.85), vec2(0.5 + 0.13 * float(i), 3.75)), 0.022);
  float ek = max(0.7, look);
  return frontEye(d, g, vec2(-0.26, 4.78), 0.13 * (1.0 + 0.6 * look), ek);
}
float poseidon(vec2 p, float k, float thrust, float tip, float look) {
  // the god, rising out of the sea as it heaves
  float d = poseidonGod(p - vec2(0.6, -5.2 * (1.0 - k)), thrust, look);
  // the sea before him: a band with a running-wave border, swelling round him
  float sea = p.y - (0.8 + 0.06 * sin(p.x * 2.1) + 0.35 * k * exp(-(p.x - 0.6) * (p.x - 0.6) / 3.0));
  vec2 cp = vec2(mod(p.x + 0.8, 1.6) - 0.8, p.y - 1.08 - 0.35 * k * exp(-(p.x - 0.6) * (p.x - 0.6) / 3.0));
  sea = min(sea, scroll(cp, 0.34, -0.5, 0.085, 1.1));
  d = before(d, sea, 0.06);
  // the galley beside him, its bow lifting
  vec2 gp = rot2(0.6 * tip) * (p - vec2(-4.2, 1.15 + 0.3 * k));
  return before(d, galley(gp * 1.1) / 1.1, 0.06);
}

// ---- the Trojan horse: a wooden horse on a wheeled platform, planked; two hatches in its belly
float wheel(vec2 p, float a) {
  p = rot2(a) * p;
  float r = length(p);
  float d = abs(r - 0.5) - 0.1;
  float an = atan(p.y, p.x);
  float spokes = abs(fract(an / 6.2831853 * 6.0 + 0.5) - 0.5) * r * 6.2831853 / 6.0 - 0.045;
  d = min(d, max(spokes, r - 0.45));
  return min(d, r - 0.13);
}
float trojanHorse(vec2 p, float h1, float h2, float roll, float look) {
  float d = sdBox(p - vec2(0.0, 1.07), vec2(3.4, 0.2));                                            // platform
  for (int i = 0; i < 4; i++) d = min(d, wheel(p - vec2(-2.6 + 1.73 * float(i), 0.6), -roll / 0.6));
  for (int i = 0; i < 4; i++) {                                                                     // stiff legs, hooves
    float x = (i < 2) ? -2.15 + 0.7 * float(i) : 1.25 + 0.7 * float(i - 2);
    d = min(d, sdBox(p - vec2(x, 2.1), vec2(0.17, 1.0)));
    d = min(d, sdBox(p - vec2(x, 1.33), vec2(0.24, 0.08)));
  }
  d = min(d, sdBox(p - vec2(-0.1, 3.75), vec2(2.5, 0.62)) - 0.35);                                 // body, a barrel
  d = smin(d, sdEll(p - vec2(2.05, 3.95), vec2(0.75, 0.8)), 0.3);                                  // chest
  vec2 n = rot2(-0.62) * (p - vec2(2.45, 5.0));                                                     // neck
  d = smin(d, sdBox(n, vec2(0.5, 1.35)), 0.15);
  for (int i = 0; i < 8; i++) d = min(d, sdBox(n - vec2(-0.6, -1.0 + 0.36 * float(i)), vec2(0.17, 0.08)));   // the mane, a comb
  vec2 hd = rot2(0.95) * (p - vec2(3.55, 6.15));                                                    // head, muzzle down
  d = smin(d, sdTrap(vec2(hd.x, -hd.y), 0.4, 0.28, 0.85) - 0.05, 0.12);
  d = min(d, sdTrap(rot2(0.25) * (p - vec2(2.78, 7.0)), 0.14, 0.02, 0.34));                         // ears
  d = min(d, sdTrap(rot2(0.45) * (p - vec2(3.12, 6.98)), 0.14, 0.02, 0.32));
  vec2 tq = rot2(-0.42) * (p - vec2(-3.05, 3.35));                                                 // tail, bushy
  float tail = sdEll(tq, vec2(0.26, 1.0));
  tail = incise(tail, abs(tq.x + 0.06 * tq.y), 0.025);
  d = smin(d, tail, 0.1);
  // incisions: the planks (staggered joints), the eye, the bridle
  for (int i = 0; i < 4; i++) d = incise(d, abs(p.y - (3.0 + 0.45 * float(i))) + max(0.0, abs(p.x + 0.1) - 2.75), 0.022);
  for (int i = 0; i < 3; i++) {
    float y0 = 3.22 + 0.45 * float(i);
    float x = mod(p.x + 0.4 + 1.05 * float(i), 2.1) - 1.05;
    d = incise(d, abs(x) + max(0.0, abs(p.y - y0) - 0.21) + max(0.0, abs(p.x + 0.1) - 2.5), 0.02);
  }
  d = incise(d, length(p - vec2(3.25, 6.3)), 0.09 * (1.0 - look));
  d = frontEye(d, p, vec2(3.22, 6.3), 0.24 * (1.0 + 0.4 * look), look);
  d = incise(d, sdSegment(p, vec2(3.0, 6.25), vec2(3.95, 5.55)), 0.025);
  // the hatch in the flank: on h1 its door swings down on its hinge and the light shows through; on h2 a rope ladder drops
  vec2 hp = p - vec2(-0.15, 3.02);                                                                   // the hinge, at the hatch's foot
  float hole = sdBox(hp - vec2(0.0, 0.32), vec2(0.42, 0.32));
  d = incise(d, abs(hole), 0.022);
  float ext = 0.64 * cos(3.14159265 * h1);                                                         // the door's height above (+) or below (-) the hinge
  d = max(d, -hole);
  d = min(d, sdBox(hp - vec2(0.18, ext * 0.5), vec2(0.24, abs(ext) * 0.5 + 0.015)));
  d = min(d, sdBox(hp - vec2(-0.25, ext * 0.5), vec2(0.13, abs(ext) * 0.5 + 0.015)));
  float drop = 1.75 * h2;                                                                           // the ladder: two ropes, rungs
  float lad = max(min(abs(hp.x + 0.62) - 0.025, abs(hp.x + 0.22) - 0.025), max(hp.y, -drop - hp.y));
  lad = min(lad, max(max(abs(hp.x + 0.42) - 0.2, abs(fract(hp.y / 0.25) - 0.5) * 0.25 - 0.022), max(hp.y + 0.05, -drop - hp.y)));
  return min(d, mix(1e3, lad, step(0.001, h2)));
}
`;
