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
uniform vec4 pivW[4];       // the arms' pivots (world)
uniform vec4 tearP[15];     // x, y, time the tip passed, rag seed
uniform float tearOn, tearOpen;
uniform float exposure;
const float PAPER_H = 1500.0;
const vec2 SOFF = vec2(0.42, -0.62);
const vec3 KEY = vec3(-0.42, 0.52, 0.74);

float hgt(vec2 p) {
  float h = 7.0 * sin(p.x * 0.0033 + 0.6) * sin(p.y * 0.0046 + 1.3) + 3.0 * sin(p.x * 0.0071 - p.y * 0.0052);
  if (shiv > 0.0) {
    h += shiv * (3.4 * sin(p.x * 0.022 + tNow * 57.0 + 2.0 * sin(p.y * 0.01)) * cos(p.y * 0.017 - tNow * 43.0) + 1.8 * sin(p.x * 0.047 - tNow * 83.0 + p.y * 0.031));
  }
  return h;
}
float gridL(float c, float per, float wd, float bl) {
  float fw = max(fwidth(c), 1e-4) * bl;
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
  vec3 paper = T_LIGHTBOX * (back ? 1.05 : 0.93);
  paper *= 1.0 + (back ? 0.13 : 0.020) * fib + (back ? 0.004 : 0.008) * grn;
  if (back) {
    // backlit: the light is behind the sheet, so it is a lamp seen through it: a hot centre, falling away to dim paper at the edges,
    // the fibres' formation showing as cloud; the key's raking falls away (nothing lights the face we see)
    float lamp = smoothstep(1.35, 0.05, length(ndc * vec2(0.78, 1.0)));
    paper *= mix(0.34, 1.0, lamp) * (1.0 + 0.5 * (diff - 1.0) * 0.25);
  } else {
    paper *= 1.0 + 0.8 * (diff - 1.0);
    // a soft fall-off of the lightbox beneath: brightest where the camera looks
    paper *= 1.0 - 0.11 * smoothstep(0.1, 1.5, length(ndc));
  }
  // ---- the printed chart: fine grid, major grid, the channels' own lines
  float mot = clamp(1.0 / (1.0 + vel * vel * 1.2e-5 * 0.01), 0.0, 1.0);
  float bx = 1.0 / (1.0 + vel * 0.012 / 10.0);
  float bX = 1.0 / (1.0 + vel * 0.012 / 50.0);
  float gw = back ? 2.0 : 1.0, gb = back ? 4.0 : 1.0;
  float gx = gridL(ws.x, 10.0, 0.7 * gw, gb) * 0.09 * bx + gridL(ws.x, 50.0, 1.1 * gw, gb) * 0.20 * bX;
  float gy = gridL(ws.y, 10.0, 0.7 * gw, gb) * 0.09 + gridL(ws.y, 50.0, 1.1 * gw, gb) * 0.20;
  float chl = 0.0;
  for (int i = 0; i < 4; i++) {
    float cy = float(i == 0 ? ${CH[0]} : i == 1 ? ${CH[1]} : i == 2 ? ${CH[2]} : ${CH[3]});
    float fw = max(fwidth(ws.y), 1e-4) * gb;
    chl = max(chl, (1.0 - smoothstep(0.7, 0.7 + fw, abs(ws.y - cy))) * (back ? 0.14 : 0.40));
    chl = max(chl, (1.0 - smoothstep(0.55, 0.55 + fw, abs(abs(ws.y - cy) - 88.0))) * (back ? 0.07 : 0.16));
  }
  float grid = clamp(max(gx, gy) + chl, 0.0, 0.34);
  vec3 print = mix(T_SILVER, T_HALIDE, 0.35);
  paper = mix(paper, print * 0.86, grid * (back ? 0.5 : 1.0));
  // fan-fold: a crease and a line of perforations every 1300 units (a scrolling reference, and paper's own physics)
  {
    float sd = (fract(ws.x / 1300.0 + 0.5) - 0.5) * 1300.0;
    paper *= 1.0 + sd * exp(-sd * sd / 110.0) * 0.010;
    float py = (fract(ws.y / 14.0 + 0.5) - 0.5) * 14.0;
    float hole = 1.0 - smoothstep(1.3, 2.1, length(vec2(sd, py)));
    paper = mix(paper, T_FILM2 * 2.0, hole * (back ? 0.35 : 0.6));
  }
  // the margin: a printed rule top and bottom (the paper's width)
  paper = mix(paper, T_SILVER * 0.8, (1.0 - smoothstep(0.8, 0.8 + max(fwidth(ws.y), 1e-4), abs(abs(ws.y) - 1420.0))) * 0.4);
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
      // seen through the paper: the lyric has bled in a little (soft but still dark: it has to read from beneath); the other
      // channels' traces and the blots are only softened shadows of themselves
      vec2 r = vec2(5.0 / inkWin.z, 5.0 / inkWin.w);
      vec3 sh = texture(inkTex, iu + r * vec2(1.0, 0.7), 2.8).rgb + texture(inkTex, iu + r * vec2(-1.0, 0.7), 2.8).rgb
              + texture(inkTex, iu + r * vec2(1.0, -0.7), 2.8).rgb + texture(inkTex, iu + r * vec2(-1.0, -0.7), 2.8).rgb;
      sh *= 0.25;
      vec2 q = vec2(1.5 / inkWin.z, 1.5 / inkWin.w);
      float ly = texture(inkTex, iu, 0.4).r * 0.5 + 0.125 * (texture(inkTex, iu + vec2(q.x, 0.0)).r + texture(inkTex, iu - vec2(q.x, 0.0)).r
               + texture(inkTex, iu + vec2(0.0, q.y)).r + texture(inkTex, iu - vec2(0.0, q.y)).r);
      ink = vec3(min(1.0, ly * 0.94 + sh.r * 0.2), sh.g * 0.8, sh.b * 0.6);
    } else ink = texture(inkTex, iu).rgb;
  }
  float cov = clamp(max(max(ink.r, ink.g), ink.b), 0.0, 1.0);
  vec3 inkC = mix(T_FILM * 1.7, T_FILM2 * 1.6, 0.35 * fib);
  paper = mix(paper, inkC, cov);
  // ---- the pens' shadows on the paper (the key rakes from the upper left, so they fall lower right)
  float shade = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 T = penT[i].xyz;
    vec3 B = pivW[i].xyz;
    vec2 sa = T.xy + SOFF * T.z, sb = B.xy + SOFF * B.z;
    float u; float d = segD(w, sa, sb, u);
    float z = mix(T.z, B.z, u);
    float pen = (back ? 9.0 : 2.0) + 0.045 * z;
    float s = 1.0 - smoothstep(1.5, 1.5 + pen, d);
    shade = max(shade, s * (back ? 0.30 : 0.36) * (0.45 + 0.55 * smoothstep(0.0, 120.0, T.z + 100.0 * u)));
    // the tip's contact: a small darker bead where the nib meets the paper
    float dc = length(w - sa);
    shade = max(shade, (1.0 - smoothstep(0.0, 8.0 + 0.2 * T.z, dc)) * 0.22 * (1.0 - clamp(T.z / 80.0, 0.0, 1.0)));
    // the pivot's housing
    shade = max(shade, (1.0 - smoothstep(10.0, back ? 40.0 : 24.0, length(w - sb))) * (back ? 0.3 : 0.24));
  }
  paper *= 1.0 - shade;
  // ---- the tear: a narrow ragged slit along the pen's path, the paper's white fibres curling up at its edges, a thin gap
  // of the film beneath showing through (it opens a little behind the nib; never more than a few percent of the frame)
  vec3 col = paper;
  if (tearOn > 0.5) {
    float ed = 1e9, hwB = 0.0, openB = 0.0, sideB = 1.0;
    for (int i = 0; i < 14; i++) {
      vec4 a = tearP[i], b = tearP[i + 1];
      float u; float d = segD(w, a.xy, b.xy, u);
      float to = mix(a.z, b.z, u);
      float kc = clamp((tNow - to) / 0.03, 0.0, 1.0);
      float ko = smoothstep(0.0, 1.0, (tNow - to) / 0.42);
      float s01 = (float(i) + u) / 14.0;
      float stp = 0.25 + 0.75 * smoothstep(0.0, 0.22, s01);
      float hw = kc * stp * (1.3 + 0.5 * snoise(vec2(s01 * 30.0, 1.0)) + 8.5 * ko * (0.75 + 0.25 * snoise(vec2(s01 * 9.0, 3.0))));
      float rag = (snoise(w * 0.07 + float(i) * 3.1) * 0.6 + snoise(w * 0.26) * 0.35) * (1.0 + 0.12 * hw);
      float dd = d + rag - hw;
      if (dd < ed) { ed = dd; hwB = hw; openB = ko; sideB = (dot(w - a.xy, vec2(-(b.y - a.y), b.x - a.x)) >= 0.0) ? 1.0 : -1.0; }
    }
    if (hwB > 0.4) {
      float inside = 1.0 - smoothstep(-0.4, 0.5, ed);
      float fwid = sideB > 0.0 ? 3.0 : 7.5;
      float fibre = (1.0 - smoothstep(0.0, fwid, ed + 1.6 * snoise(w * 0.4))) * smoothstep(-0.4, 0.4, ed);
      float flap = smoothstep(26.0, 2.0, ed) * smoothstep(-0.4, 0.4, ed) * (sideB > 0.0 ? 1.0 : 0.15);
      float fib2 = snoise(w * vec2(0.9, 0.25));
      // the film below, lit a little at the far edge of the gap, darker where the paper's own edge shades it
      vec3 gap = mix(T_FILM2 * 1.4, T_FILM2 * 3.2, smoothstep(-5.0, 0.0, ed) * 0.6 + 0.3 * (0.5 + 0.5 * fib2));
      col = mix(col, col * (1.0 - 0.42 * flap * min(1.0, hwB / 4.0)), step(0.0, ed));
      col = mix(col, vec3(1.0) * (1.0 + 0.04 * fib2), fibre * (0.7 + 0.3 * openB));
      col = mix(col, gap, inside);
    }
  }
  // ---- the pen arms and their pivots (above the paper; seen through it from beneath as soft dark shadows against the lamp)
  vec2 fp = gl_FragCoord.xy / PX_SCALE;
  for (int i = 0; i < 4; i++) {
    vec2 a = armS[i].xy, b = armS[i].zw;
    float u; float d = segD(fp, a, b, u);
    float L = length(b - a);
    float s = u * L;
    float tip = s < 26.0 ? mix(1.2, 2.4, s / 26.0) : mix(2.4, 5.4, smoothstep(26.0, 60.0, s));
    float hw = (s < 60.0 ? tip : mix(5.4, 4.2, smoothstep(60.0, max(L, 120.0), s))) * pxu;
    vec2 dir = normalize(b - a + 1e-5);
    float side = dot(fp - a, vec2(-dir.y, dir.x)) / max(hw, 0.5);
    float cover;
    vec3 ac;
    if (back) {
      float hb = hw * 1.7;
      float aa = 18.0 * pxu;
      cover = (1.0 - smoothstep(hb - aa * 0.5, hb + aa * 0.5, d)) * 0.34;
      float hub = 1.0 - smoothstep(18.0 * pxu, 18.0 * pxu + aa, length(fp - b));
      cover = max(cover, hub * 0.32);
      ac = T_FILM2 * 1.2;
    } else {
      float aa = max(fwidth(d), 0.6);
      cover = 1.0 - smoothstep(hw - aa * 0.5, hw + aa * 0.5, d);
      ac = mix(T_FILM2 * 1.5, T_SILVER * 0.9, 0.55 * smoothstep(-0.1, 0.9, side));
      ac += T_LIGHTBOX * 0.22 * (1.0 - smoothstep(0.0, 0.25, abs(side - 0.5)));
      if (s < 26.0) ac = T_FILM * 1.4;
      col = mix(col, ac, cover); cover = 0.0;
      // the pivot: a round housing, a lighter bearing ring, a dark pin
      float rb = length(fp - b), R = 18.0 * pxu;
      float disc = 1.0 - smoothstep(R - 1.0, R + 0.6, rb);
      vec3 hc = mix(T_FILM2 * 1.5, T_SILVER * 0.8, 0.5 * smoothstep(-R, R, dot(fp - b, vec2(-0.55, 0.83))));
      hc = mix(hc, T_SILVER * 0.95, (1.0 - smoothstep(0.7, 1.7, abs(rb - R * 0.6))) * 0.6);
      hc = mix(hc, T_FILM * 1.3, 1.0 - smoothstep(R * 0.2, R * 0.3, rb));
      col = mix(col, hc, disc);
    }
    col = mix(col, ac, cover);
  }
  fragColor = vec4(col * exposure, 1.0);
}`;
