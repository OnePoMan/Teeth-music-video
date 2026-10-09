// `cyclops` helper: the set's GLSL (docs/verse2-plan.md, "cyclops: his eye is the cave mouth").
// Polyphemus' shadow on the clay wall, adapted from `polyphemus()` in `figures.ts` (copied here, not imported: the
// shared kit may change on the chorus 1 branch): head and shoulders without the flock, his own eye only a shut slit
// (the open eye is the cave mouth, painted by the wall hook), the bust extended below the floor line so it can rise
// out of it, and the club swung by an angle about his fist.
// The wall hook paints what is not shadow: the cave mouth (an almond of night with the moon in it, its pupil), the
// boulder that rolls across it like an eyelid (reserved clay with a black contour).
// His men are shadow puppets too (extraShadow): small running figures on a thin rail beside him; a struck man folds flat
// onto the rail, hinged at his feet like the letters fold, with a puff of clay chips.
// (Kit candidates, see cyclops.ts: cyEll/cyCap/cyInc duplicate figures.ts' sdEll/sdCap/incise.)

/** Fist (club pivot) and the club's resting direction (radians, counter-clockwise from +x) in figure units. */
export const CLUB = { piv: [3.85, 3.45] as const, phi0: Math.atan2(8.9 - 2.3, 4.95 - 3.65) };
/** The cave mouth in figure units: the almond's half-width, its half-height when open; the boulder's radius;
 *  where the boulder rests when rolled clear (offset from the mouth's centre). */
export const MOUTH = { aw: 1.0, ah: 0.5, rb: 1.18, clear: [-2.25, -0.12] as const, eyeY: 6.75 };
/** His men (figure units): how many, the rail they run on (y), the first man's x and the spacing, a man's height. */
export const N_MEN = 6;
export const MEN = { rail: 2.5, x0: 5.4, dx: 0.72, h: 1.08 };

export const CYCLOPS_HOOKS = /* glsl */ `
#define WALL_HOOK
uniform vec4 gT;                     // the giant: x, base y (world), scale (world per figure unit), on
uniform float clubR;                 // the club's turn about his fist from its resting pose (radians, ccw)
uniform vec4 mouth;                  // the cave mouth: centre x, y (world), scale (world per figure unit), opening 0..1
uniform vec4 bould;                  // the boulder: centre offset from the mouth (figure units), its roll (radians), on
uniform vec4 men[${N_MEN}];          // each man: x on the rail (figure units), height left (1 up .. ~0.1 flat), run phase, facing (+-1; 0 none)
uniform float chipT[${N_MEN}];       // time since his fall landed (s; < 0 none): the puff of chips
uniform float railK;                 // the rail drawn out from his fist (0 none .. 1)
uniform float nightK;                // the night's own faint light (0 dark)
uniform vec4 pool;                   // the fire's pool on the wall: centre x, y (world), radius, how dark beyond it
float gOcc = 0.0;                    // the giant's shadow at the wall point being shaded (set by extraShadow)

float cyEll(vec2 p, vec2 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float cyCap(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float cyInc(float d, float l, float w) { return max(d, w - l); }

// ---- one of his men, running (feet at the origin, facing +x; ph the stride's phase, amp its reach: 0 legs together)
float cyMan(vec2 p, float ph, float amp) {
  float s1 = sin(ph), c1 = cos(ph);
  vec2 hip = vec2(0.0, 0.47 + 0.03 * abs(c1)), neck = hip + vec2(0.1, 0.25);
  float d = sdSegment(p, hip, neck) - 0.1;                                                     // torso, leaning into the run
  d = min(d, length(p - neck - vec2(0.05, 0.15)) - 0.125);                                        // head
  d = min(d, cyEll(p - neck - vec2(0.0, 0.3), vec2(0.17, 0.055)));                               // helmet crest
  for (int k = 0; k < 2; k++) {
    float sg = (k == 0) ? 1.0 : -1.0;
    float a = -1.5708 + amp * 0.65 * sg * s1, b = a - amp * (0.25 + 0.75 * max(0.0, sg * c1));
    vec2 knee = hip + 0.24 * vec2(cos(a), sin(a));
    d = min(d, sdSegment(p, hip, knee) - 0.07);                                                 // thigh
    d = min(d, sdSegment(p, knee, knee + 0.25 * vec2(cos(b), sin(b))) - 0.058);                  // shin
    float aa = -1.5708 - amp * (0.8 * sg * s1 - 0.25);
    vec2 sh = neck - vec2(0.0, 0.04), el = sh + 0.16 * vec2(cos(aa), sin(aa));
    d = min(d, min(sdSegment(p, sh, el), sdSegment(p, el, el + 0.15 * vec2(cos(aa + 1.3 * amp), sin(aa + 1.3 * amp)))) - 0.05); // arm
  }
  return d;
}

// his men on their rail, the struck ones folded flat, and the chips their fall throws up (figure units)
float cyMen(vec2 q) {
  float R = ${MEN.rail.toFixed(3)};
  float d = 1e3;
  if (railK > 0.0) d = sdSegment(q, vec2(4.6, R - 0.03), vec2(mix(4.6, 16.0, railK), R - 0.03)) - 0.028;
  for (int i = 0; i < ${N_MEN}; i++) {
    vec4 m = men[i];
    if (m.w == 0.0) continue;
    vec2 r = q - vec2(m.x, R);
    float ct = chipT[i];
    if (ct >= 0.0 && ct < 0.45) {
      for (int j = 0; j < 7; j++) {
        float h1 = fract(sin(float(j) * 12.9898 + float(i) * 78.233) * 43758.5453), h2 = fract(h1 * 91.7 + 0.3);
        vec2 c = vec2((h1 - 0.5) * 2.6 * ct, (1.2 + 1.8 * h2) * ct - 4.5 * ct * ct);
        d = min(d, length(r - c) - (0.045 + 0.035 * h2) * (1.0 - ct / 0.45));
      }
    }
    if (abs(r.x) > 1.0 || r.y < -0.3 || r.y > 1.3) continue;
    // folded about his feet: the shadow foreshortens to a sliver on the rail, his stride closing as he goes down
    float f = m.y, amp = mix(0.12, 1.0, smoothstep(0.25, 0.95, f));
    d = min(d, cyMan(vec2(r.x * m.w, r.y / f), m.z, amp) * min(f, 1.0));
  }
  return d;
}

// ---- Polyphemus from the chest up, facing us (figure units, the floor line at y 0; the bust runs on below it)
float cyGiant(vec2 p, float club) {
  vec2 h = p - vec2(0.0, 6.4);
  float d = cyEll(h, vec2(1.85, 2.25)) + 0.11 * snoise(p * 1.6) * smoothstep(-0.5, 1.8, h.y);    // shaggy head
  d = smin(d, cyEll(p - vec2(0.0, 5.2), vec2(1.55, 1.1)) + 0.1 * snoise(p * 2.2), 0.3);          // cheeks and jaw
  d = min(d, cyEll(p - vec2(-1.92, 6.25), vec2(0.3, 0.52)));                                     // ears
  d = min(d, cyEll(p - vec2(1.92, 6.25), vec2(0.3, 0.52)));
  d = smin(d, sdBox(p - vec2(0.0, 4.1), vec2(1.0, 0.7)), 0.4);                                   // neck
  d = smin(d, max(cyEll(p - vec2(0.0, 2.3), vec2(4.7, 2.4)), p.y - 4.3), 0.6);                  // shoulders
  d = smin(d, sdBox(p - vec2(0.0, -2.5), vec2(4.55, 4.8)), 0.4);                                  // the chest, on below the floor
  // the club in his fist, knotted, turned about the fist by 'club'
  vec2 c0 = vec2(3.65, 2.3), c1 = vec2(4.95, 8.9), cn = vec2(0.981, -0.193), piv = vec2(3.85, 3.45);
  d = smin(d, cyEll(p - piv, vec2(0.78, 0.64)), 0.2);
  vec2 pc = piv + rot2(club) * (p - piv);
  float cl = cyCap(pc, c0, c1, 0.26, 0.62) + 0.07 * snoise(pc * 3.0);
  for (int i = 0; i < 3; i++) {
    float f = 0.5 + 0.15 * float(i), s = (i == 1) ? -1.0 : 1.0;
    cl = min(cl, sdCircle(pc - mix(c0, c1, f) - s * cn * (0.26 + 0.36 * f) * 0.85, 0.17));
  }
  d = min(d, cl);
  // the beard, parted from the chest by a line of clay that fades out at the chin
  float beard = min(cyEll(p - vec2(0.0, 4.55), vec2(1.3, 0.95)), cyEll(p - vec2(0.0, 3.85), vec2(1.0, 0.85))) + 0.09 * snoise(p * 2.4);
  float gap = 0.06 * smoothstep(4.75, 4.4, p.y);
  d = min(mix(d, max(d, gap - beard), smoothstep(0.0, 0.03, gap)), beard);
  // incisions: a scowling brow (raised clear of the cave mouth), the fingers round the club, his own eye shut (a slit)
  d = cyInc(d, sdSegment(p, vec2(-1.45, 7.95), vec2(-0.3, 7.6)), 0.065);
  d = cyInc(d, sdSegment(p, vec2(1.45, 7.95), vec2(0.3, 7.6)), 0.065);
  for (int i = 0; i < 3; i++) d = cyInc(d, sdSegment(p, vec2(3.3, 3.25 + 0.22 * float(i)), vec2(4.3, 3.45 + 0.22 * float(i))), 0.03);
  d = cyInc(d, sdSegment(p, vec2(-0.85, 6.75), vec2(0.85, 6.75)), 0.035);
  return d;
}

float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
vec3 skyTint(vec3 D, vec3 col) { return col; }
// the fire's pool: the clay falls off toward the frame's edges
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  if (!wall) return col;
  vec2 d = (P.xy - pool.xy) / pool.z;
  return col * mix(pool.w, 1.0, exp(-dot(d, d)));
}

float extraShadow(vec3 P, bool wall) {
  gOcc = 0.0;
  if (!wall || gT.w <= 0.0) return 0.0;
  vec2 q = (P.xy - gT.xy) / gT.z;
  if (abs(q.x) > 16.0 || q.y > 11.0) return 0.0;
  float d = min(cyGiant(q, clubR), cyMen(q)) * gT.z;
  float w = max(gPix * 0.75, 0.012);
  gOcc = gT.w * (1.0 - smoothstep(-w, w, d));
  return gOcc;
}

// what is not shadow: the cave mouth, the boulder
vec3 wallHook(vec3 P, vec3 col) {
  vec3 Lv = Lc - P; float dl = length(Lv);
  float fall = LI / (1.0 + (dl / reach) * (dl / reach) * 4.0);
  vec3 clay = clayCol(fall * (0.3 + 0.7 * max(Lv.z / dl, 0.0)));
  float aw = max(gPix * 0.8, 1e-4);
  float ms = mouth.z, a = aw / ms;
  vec2 e = (P.xy - mouth.xy) / ms;
  if (abs(e.x) > 4.0 || abs(e.y) > 2.5) return col;
  // the almond: two arcs meeting at the corners; its half-height follows the opening
  float ah = max(${MOUTH.ah.toFixed(3)} * mouth.w, 0.012), hw = ${MOUTH.aw.toFixed(3)};
  float sq = hw * hw / ah, R = 0.5 * (sq + ah), cc = 0.5 * (sq - ah);
  float al = max(length(e - vec2(0.0, -cc)) - R, length(e - vec2(0.0, cc)) - R);
  // the night through it: dark, a little moonlight about the moon; the moon a bone disc, his pupil
  float mr = length(e - vec2(0.0, -0.02));
  vec3 night = C_INK * 0.7 + C_INK2 * 0.5 + C_GRAPHITE * (0.035 + 0.05 * nightK) * exp(-mr * mr * 2.2);
  float st = min(min(length(e - vec2(-0.62, 0.17)), length(e - vec2(0.58, 0.24))), min(length(e - vec2(0.8, -0.08)), length(e - vec2(-0.4, -0.22))));
  night = mix(night, C_BONE * 0.4, 1.0 - smoothstep(0.022 - a, 0.022 + a, st));
  night = mix(night, C_BONE * 0.74, 1.0 - smoothstep(0.36 - a, 0.36 + a, mr));
  col = mix(col, night, 1.0 - smoothstep(-a, a, al));
  // its rim, reserved in the clay: the eye's contour scratched through his shadow
  col = mix(col, clay, (1.0 - smoothstep(0.035 - a, 0.035 + a, abs(al - 0.1))) * smoothstep(0.02, 0.1, mouth.w));
  // the boulder: a round stone of clay, outlined in black slip, its markings turning as it rolls
  if (bould.w > 0.0) {
    vec2 bq = rot2(bould.z) * (e - bould.xy);
    float ang = atan(bq.y, bq.x);
    float rb = ${MOUTH.rb.toFixed(3)} * (1.0 + 0.035 * sin(3.0 * ang + 0.7) + 0.02 * sin(5.0 * ang + 2.1));
    float bd = length(bq) - rb;
    float inS = 1.0 - smoothstep(-a, a, bd);
    if (inS > 0.0) {
      // a body: darker clay, lit from the fire's side (the shading stays put while the markings turn)
      vec2 bn = (e - bould.xy) / ${MOUTH.rb.toFixed(3)};
      vec3 stone = clay * (0.36 + 0.26 * sat(0.5 + 0.6 * dot(bn, vec2(0.55, 0.5)))) * (0.94 + 0.06 * snoise(bq * 2.3));
      // its markings, incised: one jagged crack across it and a branch (they turn as it rolls)
      float m = sdSegment(bq, vec2(-1.0, 0.48), vec2(-0.42, 0.24));
      m = min(m, sdSegment(bq, vec2(-0.42, 0.24), vec2(-0.2, -0.18)));
      m = min(m, sdSegment(bq, vec2(-0.2, -0.18), vec2(0.28, -0.3)));
      m = min(m, sdSegment(bq, vec2(0.28, -0.3), vec2(0.6, -0.86)));
      m = min(m, sdSegment(bq, vec2(-0.2, -0.18), vec2(-0.5, -0.55)));
      stone = mix(stone, C_INK * 0.8, 1.0 - smoothstep(0.028 - a, 0.028 + a, m));
      stone = mix(stone, C_INK * 0.8, 1.0 - smoothstep(0.06 - a, 0.06 + a, -bd));                    // its contour
      col = mix(col, stone, inS * bould.w);
    }
  }
  return col;
}`;
