// Plate 4 `polygraph`: the frame. One pass: a ray from the camera to the chart paper (a plane that shivers on the
// butterflies), the printed chart (grid, channel lines), the ink (a world-space target drawn each frame: lyric in R,
// pen traces in G, landing blots in B), the header, the pens' shadows on the paper (a raking key from the upper
// left), the four pen arms (screen-space capsules from projected 3D endpoints), the tear. Seen from under, the same
// paper is lit from behind: translucent, its formation showing, the ink reversed, the pens only soft shadows.
import { GLSL_TEETH_PALETTE } from '../palette';
import { CH } from './polygraph-script';

export const POLY_FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
uniform vec3 camPos, camR, camU, camF;
uniform vec2 tanHV;
uniform sampler2D inkTex; uniform vec4 inkWin;
uniform sampler2D hdrTex; uniform vec4 hdrWin;
uniform float tNow, shiv, vel, pxu, soft;
uniform vec4 penT[4];       // world tip (x, y, z), w = 1 when the pen is on the paper
uniform vec4 armS[4];       // projected tip and far end, logical px, y up
uniform vec3 armDir;
uniform float armLen;
uniform vec4 tearP[15];     // x, y, time the tip passed, rag seed
uniform float tearOn, tearOpen;
uniform float exposure;
const float PAPER_H = 900.0;
const vec2 SOFF = vec2(0.42, -0.62);
const vec3 KEY = vec3(-0.42, 0.52, 0.74);

float hgt(vec2 p) {
  float h = 7.0 * sin(p.x * 0.0033 + 0.6) * sin(p.y * 0.0046 + 1.3) + 3.0 * sin(p.x * 0.0071 - p.y * 0.0052);
  if (shiv > 0.0) {
    h += shiv * (3.4 * sin(p.x * 0.022 + tNow * 57.0 + 2.0 * sin(p.y * 0.01)) * cos(p.y * 0.017 - tNow * 43.0) + 1.8 * sin(p.x * 0.047 - tNow * 83.0 + p.y * 0.031));
  }
  return h;
}
float gridL(float c, float per, float wd) {
  float fw = max(fwidth(c), 1e-4);
  float d = abs(fract(c / per + 0.5) - 0.5) * per;
  float a = 1.0 - smoothstep(wd * 0.5, wd * 0.5 + fw, d);
  return a * clamp(wd / fw, 0.0, 1.0);
}
float segD(vec2 p, vec2 a, vec2 b, out float u) {
  vec2 pa = p - a, ba = b - a;
  u = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * u);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rd = normalize(camF + ndc.x * tanHV.x * camR + ndc.y * tanHV.y * camU);
  bool back = camPos.z < 0.0;
  float t = -camPos.z / (abs(rd.z) < 1e-5 ? 1e-5 : rd.z);
  vec3 P = camPos + rd * t;
  for (int k = 0; k < 2; k++) {
    float h = hgt(P.xy);
    t = (h - camPos.z) / (abs(rd.z) < 1e-5 ? 1e-5 : rd.z);
    P = camPos + rd * t;
  }
  vec2 w = P.xy;
  vec3 ground = T_FILM * 1.4 + T_FILM2 * 0.6 * smoothstep(0.6, 0.0, length(ndc));
  if (t <= 0.0 || abs(w.y) > PAPER_H || t > 60000.0) {
    // the paper's edge shadow on the ground is not needed: the ground is film black
    fragColor = vec4(ground * exposure, 1.0);
    return;
  }
  // the paper is shaken in its own plane too
  vec2 ws = w;
  if (shiv > 0.0) ws += shiv * vec2(2.6 * sin(w.y * 0.031 + tNow * 71.0), 1.8 * cos(w.x * 0.021 - tNow * 61.0));
  // ---- the surface: normal from the displacement, the key
  const float e = 4.0;
  float h0 = hgt(w), hx = hgt(w + vec2(e, 0.0)), hy = hgt(w + vec2(0.0, e));
  vec3 N = normalize(vec3(-(hx - h0) / e, -(hy - h0) / e, 1.0));
  float diff = dot(N, normalize(KEY)) / normalize(KEY).z;
  // formation: the paper's fibres (visible as cloudiness, strongest seen against light)
  float fib = 0.5 * snoise(ws * 0.045) + 0.28 * snoise(ws * 0.13 + 3.0) + 0.16 * snoise(ws * 0.41 + 9.0);
  float grn = hash12(floor(ws * 1.4)) - 0.5;
  vec3 paper = T_LIGHTBOX * 0.93;
  paper *= 1.0 + (back ? 0.05 : 0.020) * fib + 0.008 * grn;
  if (back) paper *= 1.07 + 0.06 * smoothstep(1.2, 0.0, length(ndc));
  paper *= 1.0 + 0.8 * (diff - 1.0);
  // a soft fall-off of the lightbox beneath: brightest where the camera looks
  paper *= 1.0 - 0.11 * smoothstep(0.1, 1.5, length(ndc));
  // ---- the printed chart: fine grid, major grid, the channels' own lines
  float mot = clamp(1.0 / (1.0 + vel * vel * 1.2e-5 * 0.01), 0.0, 1.0);
  float bx = 1.0 / (1.0 + vel * 0.012 / 10.0);
  float bX = 1.0 / (1.0 + vel * 0.012 / 50.0);
  float gw = back ? 2.2 : 1.0;
  float gx = gridL(ws.x, 10.0, 0.7 * gw) * 0.15 * bx + gridL(ws.x, 50.0, 1.1 * gw) * 0.30 * bX;
  float gy = gridL(ws.y, 10.0, 0.7 * gw) * 0.15 + gridL(ws.y, 50.0, 1.1 * gw) * 0.30;
  float chl = 0.0;
  for (int i = 0; i < 4; i++) {
    float cy = float(i == 0 ? ${CH[0]} : i == 1 ? ${CH[1]} : i == 2 ? ${CH[2]} : ${CH[3]});
    float fw = max(fwidth(ws.y), 1e-4);
    chl = max(chl, (1.0 - smoothstep(0.7, 0.7 + fw, abs(ws.y - cy))) * 0.34);
    chl = max(chl, (1.0 - smoothstep(0.55, 0.55 + fw, abs(abs(ws.y - cy) - 88.0))) * 0.20);
  }
  float grid = clamp(max(gx, gy) + chl, 0.0, 0.75);
  vec3 print = mix(T_SILVER, T_HALIDE, 0.35);
  paper = mix(paper, print * 0.86, grid * (back ? 0.75 : 1.0));
  // fan-fold: a crease and a line of perforations every 1300 units (a scrolling reference, and paper's own physics)
  {
    float sd = (fract(ws.x / 1300.0 + 0.5) - 0.5) * 1300.0;
    paper *= 1.0 + sd * exp(-sd * sd / 110.0) * 0.010;
    float py = (fract(ws.y / 14.0 + 0.5) - 0.5) * 14.0;
    float hole = 1.0 - smoothstep(1.3, 2.1, length(vec2(sd, py)));
    paper = mix(paper, T_FILM2 * 2.0, hole * (back ? 0.35 : 0.6));
  }
  // the margin: a printed rule top and bottom (the paper's width)
  paper = mix(paper, T_SILVER * 0.8, (1.0 - smoothstep(0.8, 0.8 + max(fwidth(ws.y), 1e-4), abs(abs(ws.y) - 860.0))) * 0.5);
  // ---- the header (SUBJECT, left blank)
  vec2 hu = (ws - hdrWin.xy) / hdrWin.zw;
  if (hu.x > 0.0 && hu.x < 1.0 && hu.y > 0.0 && hu.y < 1.0) {
    vec4 hd = texture(hdrTex, vec2(hu.x, hu.y));
    paper = mix(paper, T_FILM * 1.6, hd.a * 0.9);
  }
  // ---- the ink
  vec2 iu = (ws - inkWin.xy) / inkWin.zw;
  vec3 ink = vec3(0.0);
  if (iu.x > 0.0 && iu.x < 1.0 && iu.y > 0.0 && iu.y < 1.0) {
    if (back) {
      // seen through the paper: it has bled in a little, softer and less black
      float r = 1.6 / inkWin.z;
      vec3 a = texture(inkTex, iu).rgb * 0.36;
      a += texture(inkTex, iu + vec2(r, 0.0)).rgb * 0.16 + texture(inkTex, iu - vec2(r, 0.0)).rgb * 0.16;
      a += texture(inkTex, iu + vec2(0.0, 2.2 * r)).rgb * 0.16 + texture(inkTex, iu - vec2(0.0, 2.2 * r)).rgb * 0.16;
      ink = a * 0.95;
    } else ink = texture(inkTex, iu).rgb;
  }
  float cov = clamp(max(max(ink.r, ink.g * 0.92), ink.b), 0.0, 1.0);
  vec3 inkC = mix(T_FILM * 1.7, T_FILM2 * 1.6, 0.35 * fib);
  paper = mix(paper, inkC, cov);
  // ---- the pens' shadows on the paper (the key rakes from the upper left, so they fall lower right)
  float shade = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 T = penT[i].xyz;
    vec3 B = T + armDir * armLen;
    vec2 sa = T.xy + SOFF * T.z, sb = B.xy + SOFF * B.z;
    float u; float d = segD(w, sa, sb, u);
    float z = mix(T.z, B.z, u);
    float pen = (back ? 9.0 : 2.0) + 0.045 * z;
    float s = 1.0 - smoothstep(1.5, 1.5 + pen, d);
    shade = max(shade, s * (back ? 0.30 : 0.36) * (0.45 + 0.55 * smoothstep(0.0, 120.0, T.z + 100.0 * u)));
    // the tip's contact: a small darker bead where the nib meets the paper
    float dc = length(w - sa);
    shade = max(shade, (1.0 - smoothstep(0.0, 8.0 + 0.2 * T.z, dc)) * 0.22 * (1.0 - clamp(T.z / 80.0, 0.0, 1.0)));
  }
  paper *= 1.0 - shade;
  // ---- the tear
  vec3 col = paper;
  if (tearOn > 0.5) {
    float best = 1e9, hwB = 0.0, ed = 1e9;
    for (int i = 0; i < 14; i++) {
      vec4 a = tearP[i], b = tearP[i + 1];
      float u; float d = segD(w, a.xy, b.xy, u);
      float to = mix(a.z, b.z, u);
      float kc = clamp((tNow - to) / 0.03, 0.0, 1.0);
      float ko = clamp((tNow - tearOpen) / 0.13, 0.0, 1.0);
      float s01 = (float(i) + u) / 14.0;
      float taper = 0.04 + 0.96 * pow(smoothstep(0.0, 0.62, s01), 1.1);
      float hw = kc * (3.5 + 1.2 * snoise(vec2(s01 * 30.0, 1.0)) + 300.0 * ko * ko * (3.0 - 2.0 * ko) * taper * (1.0 + 0.3 * snoise(vec2(s01 * 9.0, 3.0))));
      float rag = (snoise(w * 0.045 + float(i) * 3.1) * 0.55 + snoise(w * 0.17) * 0.3) * (1.6 + 0.08 * hw);
      float dd = d + rag - hw;
      if (dd < ed) { ed = dd; hwB = hw; }
    }
    if (hwB > 0.5) {
      // inside the slit: the black beneath; at its edge, torn fibres (white) and the flap's shadow beyond
      float inside = 1.0 - smoothstep(-0.5, 0.8, ed);
      float fibre = (1.0 - smoothstep(0.0, 5.0, ed)) * smoothstep(-0.5, 0.5, ed);
      float flap = smoothstep(40.0, 0.0, ed) * smoothstep(-0.5, 0.5, ed);
      vec3 black = T_FILM * (0.7 + 0.5 * smoothstep(-90.0, 0.0, ed) * 0.0);
      col = mix(col, col * (1.0 - 0.38 * flap * min(1.0, hwB / 40.0)), step(0.0, ed));
      col = mix(col, T_LIGHTBOX * 0.97, fibre * 0.85);
      col = mix(col, black, inside);
    }
  }
  if (back) col *= 1.04;
  // ---- the pen arms (above the paper: seen through it from beneath as soft darks)
  vec2 fp = gl_FragCoord.xy / PX_SCALE;
  for (int i = 0; i < 4; i++) {
    vec2 a = armS[i].xy, b = armS[i].zw;
    float u; float d = segD(fp, a, b, u);
    float s = u * length(b - a);
    float hw = (s < 26.0 ? mix(1.2, 2.4, s / 26.0) : s < 90.0 ? mix(2.4, 5.8, smoothstep(26.0, 60.0, s)) : 5.8 - 3.0 * smoothstep(380.0, 560.0, s)) * (pxu / 1.0);
    vec2 dir = normalize(b - a + 1e-5);
    float side = dot(fp - a, vec2(-dir.y, dir.x)) / max(hw, 0.5);
    float aa = back ? 7.0 : max(fwidth(d), 0.6);
    float cover = 1.0 - smoothstep(hw - aa * 0.5, hw + aa * 0.5, d);
    vec3 ac = mix(T_FILM2 * 1.5, T_SILVER * 0.9, 0.55 * smoothstep(-0.1, 0.9, side));
    ac += T_LIGHTBOX * 0.22 * (1.0 - smoothstep(0.0, 0.25, abs(side - 0.5)));
    if (s < 26.0) ac = T_FILM * 1.4;
    col = mix(col, ac, cover * (back ? 0.16 : 1.0));
  }
  fragColor = vec4(col * exposure, 1.0);
}`;
