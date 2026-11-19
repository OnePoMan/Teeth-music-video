// Plate 11 `luminol`: the two gloved hands as GLSL SDFs (mm), each in its own frame.
//  - the pen hand (the same matte nitrile glove and pen as plate 13's, `match-glsl.ts`, copied here so the plate stays
//    self-contained): frame origin at the pen tip, x up the pen toward its cap, the glove behind the grip;
//  - the spray hand: a white trigger sprayer held by the neck, the index finger on the trigger; frame origin at the
//    nozzle, x the spray direction, y to the sprayer's left, z up. `sPull` (0..1) pulls the trigger.
export const GLSL_HANDS = /* glsl */ `
float rcap(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float finger(vec3 p, vec3 a, vec3 b, vec3 c, vec3 d, vec4 r) {
  float f = rcap(p, a, b, r.x, r.y);
  f = smin(f, rcap(p, b, c, r.y, r.z), 1.4);
  f = smin(f, rcap(p, c, d, r.z, r.w), 1.6);
  return f;
}
// ---- the pen hand
float sdPen(vec3 p, out int m) {
  float r = length(p.yz);
  float cone = max(r - mix(0.3, 2.9, clamp(p.x / 9.0, 0.0, 1.0)), max(-p.x, p.x - 9.0));
  float grip = max(r - 4.2, max(9.0 - p.x, p.x - 36.0));
  float barrel = max(r - 4.5, max(35.5 - p.x, p.x - 136.0));
  float cap = length(vec3(max(p.x - 136.0, 0.0), p.yz)) - 4.5;
  barrel = min(barrel, max(cap, 134.0 - p.x));
  vec3 q = p - vec3(116.0, 0.0, 5.1);
  vec3 bq = abs(q) - vec3(18.0, 1.2, 0.5);
  float clip = length(max(bq, 0.0)) + min(max(bq.x, max(bq.y, bq.z)), 0.0) - 0.3;
  float d = cone; m = 2;
  if (grip < d) { d = grip; m = 1; }
  if (barrel < d) { d = barrel; m = 3; }
  if (clip < d) { d = clip; m = 2; }
  return d;
}
const vec3 W0 = vec3(138.0, -18.0, 2.0), W1 = vec3(205.0, -12.0, 6.0);
const float GRIP = 7.0;
float sdGlove(vec3 p) {
  p.x -= GRIP;
  float th = finger(p, vec3(30.0, 8.0, 0.6), vec3(47.0, 14.0, 3.0), vec3(70.0, 19.0, -2.0), vec3(98.0, 14.0, -9.0), vec4(6.4, 7.5, 9.2, 11.0));
  float ix = finger(p, vec3(24.0, -1.4, 9.9), vec3(40.0, -3.0, 13.0), vec3(54.0, -5.0, 21.0), vec3(80.0, -11.0, 16.0), vec4(5.9, 6.7, 7.5, 9.3));
  float mi = finger(p, vec3(26.0, -8.6, -3.0), vec3(40.0, -14.0, -6.0), vec3(55.0, -22.0, -2.0), vec3(84.0, -27.0, 8.0), vec4(6.1, 6.9, 7.7, 9.5));
  float ri = finger(p, vec3(52.0, -30.0, -14.0), vec3(66.0, -35.0, -11.0), vec3(80.0, -40.0, -4.0), vec3(100.0, -42.0, 6.0), vec4(6.6, 7.3, 7.9, 9.0));
  float li = finger(p, vec3(66.0, -43.0, -18.0), vec3(78.0, -49.0, -14.0), vec3(92.0, -53.0, -7.0), vec3(108.0, -54.0, 2.0), vec4(5.7, 6.3, 6.9, 7.9));
  float d = smin(smin(th, ix, 1.8), smin(mi, smin(ri, li, 1.8), 1.8), 1.8);
  float back = sdEll(p - vec3(114.0, -20.0, 6.0), vec3(38.0, 32.0, 13.0));
  float then = sdEll(p - vec3(110.0, 10.0, -8.0), vec3(28.0, 18.0, 12.0));
  float wrist = rcap(p, W0, W1, 23.0, 25.0);
  float palm = smin(smin(back, then, 14.0), wrist, 14.0);
  d = smin(d, palm, 6.5);
  vec3 ax = normalize(W1 - W0);
  vec3 q = p - (W0 + ax * 50.0);
  float along = dot(q, ax);
  float rad = length(q - ax * along);
  float cuff = length(vec2(rad - 25.4, along)) - 4.3;
  d = smin(d, cuff, 1.2);
  return max(d, along - 3.0);
}
float sdSleeve(vec3 p) {
  p.x -= GRIP;
  vec3 ax = normalize(W1 - W0);
  return max(rcap(p, W0 + ax * 50.0, W0 + ax * 190.0, 29.0, 33.0), -dot(p - W0 - ax * 52.0, ax));
}
float sdPenHand(vec3 p, out int m) {
  float pen = sdPen(p, m);
  float g = sdGlove(p);
  float sl = sdSleeve(p);
  float d = pen;
  if (g < d) { d = g; m = 0; }
  if (sl < d) { d = sl; m = 4; }
  return d;
}
float jn(vec3 q, vec3 c, float r2) { vec3 d = q - c; return exp(-dot(d, d) / r2); }
float wrinkle(vec3 q) {
  q.x -= GRIP;
  float mk = jn(q, vec3(40.0, -3.0, 13.0), 30.0) + jn(q, vec3(54.0, -5.0, 21.0), 45.0) + jn(q, vec3(80.0, -11.0, 18.0), 70.0)
    + jn(q, vec3(47.0, 14.0, 3.0), 40.0) + jn(q, vec3(70.0, 21.0, -2.0), 60.0) + jn(q, vec3(40.0, -14.0, -6.0), 30.0)
    + jn(q, vec3(55.0, -22.0, -2.0), 45.0) + 0.6 * jn(q, vec3(84.0, -27.0, 8.0), 80.0);
  float ph = q.x * 1.55 + 2.2 * snoise(q * 0.18);
  return mk * 0.55 * sin(ph) + 0.12 * snoise(q * 0.35);
}

// ---- the spray hand
// a finger wrapped round the sprayer's vertical axis (at x = -42): an arc of radius R at height z, angles a0..a1
// (0 = toward the nozzle, -pi/2 = the sprayer's right side)
float wrapF(vec3 q, float R, float z, float a0, float a1, float rf) {
  vec2 r2 = vec2(q.x + 42.0, q.y);
  float a = clamp(atan(r2.y, r2.x), a0, a1);
  vec2 c = R * vec2(cos(a), sin(a));
  return length(vec3(r2 - c, q.z - z)) - rf;
}
float sdSprayHand(vec3 q, float pull, out int m) {
  // the sprayer: trigger head, nozzle, neck, ribbed cap, bottle, trigger
  float head = sdBox3(q - vec3(-30.0, 0.0, 2.0), vec3(23.0, 7.5, 8.0)) - 3.5;
  float noz = rcap(q, vec3(-8.0, 0.0, 2.5), vec3(0.0, 0.0, 2.5), 5.6, 5.0);
  float neck = max(length(q.xy - vec2(-42.0, 0.0)) - 12.0, max(q.z + 8.0, -34.0 - q.z));
  float cap = max(length(q.xy - vec2(-42.0, 0.0)) - 17.0, max(q.z + 32.0, -54.0 - q.z)) - 0.8;
  float bot = max(length(q.xy - vec2(-42.0, 0.0)) - 31.0 + 4.0, max(q.z + 60.0, -172.0 - q.z)) - 4.0;
  vec3 tq = q - vec3(-15.0 - 5.0 * pull, 0.0, -21.0);
  float trig = sdBox3(tq, vec3(2.6, 6.0, 11.5)) - 1.5;
  float d = min(min(head, neck), min(cap, bot)); m = 5;
  if (trig < d) { d = trig; m = 5; }
  if (noz < d) { d = noz; m = 6; }
  // the glove: the palm behind the neck, three fingers round the cap and the bottle's shoulder, the index on the
  // trigger, the thumb over the head's left
  float palm = sdEll(q - vec3(-76.0, 3.0, -48.0), vec3(18.0, 29.0, 34.0));
  float f2 = wrapF(q, 26.0, -41.0, -2.95, -0.55, 8.3);
  float f3 = wrapF(q, 39.5, -62.0, -2.95, -0.45, 8.1);
  float f4 = wrapF(q, 38.5, -79.0, -2.95, -0.75, 7.2);
  float ix = rcap(q, vec3(-68.0, -22.0, -20.0), vec3(-34.0, -19.0, -24.0), 9.0, 8.4);
  ix = smin(ix, rcap(q, vec3(-34.0, -19.0, -24.0), vec3(-12.0 - 5.0 * pull, -7.0, -25.0), 8.4, 7.4), 2.0);
  float thb = rcap(q, vec3(-82.0, 22.0, -38.0), vec3(-62.0, 22.0, -10.0), 11.0, 9.8);
  thb = smin(thb, rcap(q, vec3(-62.0, 22.0, -10.0), vec3(-46.0, 13.0, 5.0), 9.8, 8.6), 2.0);
  vec3 wa = vec3(-86.0, 0.0, -56.0), wb = vec3(-215.0, -10.0, -104.0);
  float wrist = rcap(q, wa, wb, 25.0, 28.0);
  float g = smin(smin(f2, f3, 2.0), f4, 2.0);
  g = smin(g, smin(ix, thb, 3.0), 3.0);
  g = smin(g, smin(palm, wrist, 12.0), 7.0);
  vec3 ax = normalize(wb - wa);
  vec3 cq = q - (wa + ax * 70.0);
  float along = dot(cq, ax);
  float cuff = length(vec2(length(cq - ax * along) - 27.0, along)) - 4.4;
  g = max(smin(g, cuff, 1.2), along - 3.0);
  float sl = max(rcap(q, wa + ax * 68.0, wa + ax * 260.0, 31.0, 35.0), -along - 2.0);
  if (g < d) { d = g; m = 0; }
  if (sl < d) { d = sl; m = 4; }
  return d;
}
`;
