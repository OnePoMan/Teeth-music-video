// Plate 2 `lightbox` (7.23 - 21.10): "Some days you're the only thing I know..." A panoramic radiograph (OPG) of his
// teeth (teeth.ts: HIS, the chip on #8) on a lightbox: cold white behind silver film. The film is drawn once into a
// density map (lightbox-film.ts); this shader develops it: radiopaque enamel and amalgam bright, dentin grey, pulp and
// soft tissue dark, trabecular bone, silver grain, the tube's banding through the diffuser, a slight scatter in the base
// around the clearest areas. The camera is a macro lens tilted a few degrees off the film plane (real depth of field),
// tracking along the jaw and pushing in on downbeats. The sung words are radiopaque: metal in the film, as fillings are,
// developing from a ghost to clear film as they are sung.
// Approved stills (gate 2): 9.05 ("know") and 10.60 (the signed tag). Gate 3 (block-in), the event script: the tube
// strikes on the first downbeat; line 1 tracks the jaw; between the lines the shared glove (GLSL_HAND) slides the tag up
// under the clip and signs it (the monogram's first sighting), then flicks away; line 2 cuts to a low angle on his left,
// BURNING flares one tube (a hot band across the film), "the nights grow cold" cools and dims it, the teeth faint; the
// loupe pushes in to #8's chip in two steps, the words inside its lens; "Beg you to stay" snaps tooth to tooth, each
// STAY coming through over a filling; "yeah" pulls back to the whole film on the box while the fillings come through one
// after another, back to the last molar. One hero per line (KNOW, BURNING, AWAY, STAY), each snapping light to heavy on
// its onset.
// Kinetic type (gate 3, the shared kit `kinetic.ts`; verse 1, low energy): the words stay radiopaque metal IN the film
// (they show only where the backlight comes through), but they move: an unsung word is a faint latent image; on its
// onset its letters spring up into it one by one; letter-spacing breathes open on every beat; the supporting words
// slide a step left along the film on each beat and collapse onto their baseline as the next phrase of the line
// springs in; a line slides off to the left on the beat after it ends. Only each line's hero stamps (lands oversized and
// settles, light to heavy, a small frame shake and a kick of the tube): KNOW, BURNING, AWAY, STAY. COLD condenses
// (Archivo's width axis, 112 -> 62) as the tube cools and dims.
import * as THREE from 'three';
import { Scene, type Frame } from '../../engine/scene';
import { FSPass, SS_TAP, SS_TAP_GLSL, SCALE } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, smoothstep, lerp } from '../../engine/util';
import type { Line, Word } from '../../engine/lyrics';
import { GLSL_TEETH_PALETTE, T_HEX, trgba } from '../palette';
import { drawMonogram, monoWritten, monoPenAt, MONO_H } from '../monogram';
import { HIS, tooth, panoramic } from '../teeth';
import { buildFilm, FILM, FILM_W, FILM_H, type FilmInfo } from './lightbox-film';
import { GLSL_HAND } from './match-glsl';
import { KinClock, KinWord, kinShake, type GlyphPose, type KinPose, type Moves } from '../kinetic';

const VFOV = 20; // degrees
const WORD_W = 2048, WORD_H = 1024;

const FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${SS_TAP_GLSL}
uniform sampler2D filmTex, wordTex;
uniform mat4 invVP; uniform vec3 camPos;
uniform vec2 res;
uniform vec4 filmRect;      // x0, y0, w, h (mm)
uniform vec4 wordRect;      // x0, y0, w, h (mm) of the word layer
uniform float focusT, aperture, box, boxCool, overex, texPpm;
uniform vec2 loupe; uniform float loupeR;   // the loupe's lens on screen (logical px), radius (0: none)
uniform sampler2D tagTex; uniform vec4 tagRect; uniform float tagRot, tagOn;   // the film's tag (centre, size mm)
uniform float overY, overH;                 // BURNING: the flaring tube's hot band across the film (film mm)
uniform vec2 fillC[${7}]; uniform float fillK[${7}];   // the amalgams: centre (film mm), density factor (0.3 ghost .. 1)
uniform vec3 hTip, hE1, hE2, hE3; uniform float handOn;  // the glove (GLSL_HAND): pen tip and frame, film mm, z to camera

${GLSL_HAND}
// ---- the gloved hand, ray-marched in its own frame (as plates 12 and 13); in front of the film, lit by the room and,
// round its silhouette, by the lightbox behind it
vec3 toH(vec3 p) { vec3 d = p - hTip; return vec3(dot(d, hE1), dot(d, hE2), dot(d, hE3)); }
vec3 dirH(vec3 v) { return vec3(dot(v, hE1), dot(v, hE2), dot(v, hE3)); }
vec3 fromH(vec3 v) { return hE1 * v.x + hE2 * v.y + hE3 * v.z; }
const vec3 HLO = vec3(-4.0, -64.0, -36.0), HHI = vec3(330.0, 50.0, 48.0);
vec2 boxHit(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  vec3 iv = 1.0 / rd; vec3 t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
float marchHand(vec3 ro, vec3 rd, float tMax, out int m) {
  m = -1;
  if (handOn < 0.5) return 1e9;
  vec3 o = toH(ro), d = dirH(rd);
  vec2 bh = boxHit(o, d, HLO, HHI);
  if (bh.x > bh.y || bh.y < 0.0) return 1e9;
  float t = max(bh.x, 0.0), te = min(bh.y, tMax);
  for (int i = 0; i < 140; i++) {
    if (t > te) break;
    int mm;
    float h = sdHand(o + d * t, mm);
    if (h < 0.03) { m = mm; return t; }
    t += h * 0.85;
  }
  return 1e9;
}
vec3 nrmHand(vec3 q) {
  const vec2 k = vec2(1.0, -1.0); const float e = 0.12;
  return normalize(k.xyy * sdHandD(q + k.xyy * e) + k.yyx * sdHandD(q + k.yyx * e) + k.yxy * sdHandD(q + k.yxy * e) + k.xxx * sdHandD(q + k.xxx * e));
}
vec3 shadeHand(vec3 P, vec3 rd, int m) {
  vec3 q = toH(P);
  vec3 nl = nrmHand(q);
  if (m == 0) {
    const float e = 0.25;
    vec3 g = vec3(wrinkle(q + vec3(e, 0.0, 0.0)) - wrinkle(q - vec3(e, 0.0, 0.0)), wrinkle(q + vec3(0.0, e, 0.0)) - wrinkle(q - vec3(0.0, e, 0.0)), wrinkle(q + vec3(0.0, 0.0, e)) - wrinkle(q - vec3(0.0, 0.0, e))) / (2.0 * e);
    g -= nl * dot(g, nl);
    nl = normalize(nl - g * 0.9);
  }
  vec3 N = fromH(nl), V = -rd;
  vec3 Lr = normalize(vec3(-0.45, 0.55, 0.7));      // the room's light, from the front upper left (as on the tag, the clip)
  float dif = max(dot(N, Lr), 0.0);
  float nv = max(dot(N, V), 0.0);
  // the lightbox behind: a lit plane filling the hemisphere behind the hand; it reaches only the planes turned from
  // the camera, so the hand is a dark shape against the box with a bright rim round its fingers and knuckles
  float back = box * 0.5 * (1.0 - N.z) * pow(1.0 - nv, 1.6);
  float sheen = pow(1.0 - nv, 4.0) * box;
  vec3 col;
  if (m == 0) {
    vec3 alb = T_SILVER * 0.24;
    vec3 Hh = normalize(Lr + V);
    float spec = pow(max(dot(N, Hh), 0.0), 14.0) * 0.08;
    float wrapD = max(dot(N, Lr) * 0.6 + 0.4, 0.0);
    col = alb * (0.5 * wrapD * wrapD + 0.015 + back * 3.2) + T_LIGHTBOX * (spec * 0.5 + sheen * 0.22 * (0.5 - 0.5 * N.z));
  } else if (m == 4) {
    float weave = 0.9 + 0.1 * snoise(q * vec3(0.5, 3.0, 3.0));
    col = T_FILM2 * 1.6 * weave * (0.62 * dif + 0.05 + back * 0.8);
  } else if (m == 1) {
    col = T_FILM * (0.62 * dif + 0.05) + T_LIGHTBOX * sheen * 0.08;
  } else if (m == 2) {
    col = T_HALIDE * (0.35 * dif + 0.08 + back * 0.5) + T_LIGHTBOX * sheen * 0.2;
  } else {
    vec3 alb = T_SILVER * (0.9 + 0.1 * sin(q.x * 9.0));
    vec3 Hh = normalize(Lr + V);
    col = alb * (0.62 * dif * 0.9 + 0.06 + back * 0.6) + T_LIGHTBOX * pow(max(dot(N, Hh), 0.0), 30.0) * 0.25;
  }
  return col;
}

// the developed film at film point P (mm): density -> clearness b (0 black film .. 1 clear film)
float bright(vec3 dn, vec2 P, float trabK) {
  float g = dn.g;
  float boneish = smoothstep(0.3, 0.46, dn.g);
  if (trabK * boneish > 0.0) {
    // trabecular bone, fibrous and porous: fine struts streaking along the bone (horizontal in the mandible, more
    // vertical round the maxillary roots), dark marrow pores between, a fine granular grain
    float mand = smoothstep(2.0, -6.0, P.y);
    vec2 Q = mix(vec2(P.x * 2.2, P.y * 1.1), vec2(P.x * 0.9, P.y * 2.8), mand);
    float fib = 1.0 - abs(snoise(Q * 1.3));
    fib = fib * fib;
    float fib2 = 1.0 - abs(snoise(Q * 2.9 + 5.0));
    float pores = smoothstep(0.35, 0.8, snoise(P * 4.2 + 17.0)) + 0.6 * smoothstep(0.5, 0.9, snoise(P * 8.5 + 3.0));
    float fine = snoise(P * 13.0);
    float web = 0.55 * fib + 0.3 * fib2 * fib2 - 0.45 * pores + 0.2 * fine - 0.35;
    g *= 1.0 + trabK * boneish * 0.17 * web;
  }
  float mu = 1.3 * dn.r + 1.12 * g + 0.38 * dn.b;
  return 1.0 - exp(-mu * 1.2);
}
vec3 ramp(float b) {
  vec3 sF = toSRGB(T_FILM), s2 = toSRGB(T_FILM2), sS = toSRGB(T_SILVER), sH = toSRGB(T_HALIDE), sL = toSRGB(T_LIGHTBOX);
  vec3 s = b < 0.28 ? mix(sF, s2, b / 0.28) : b < 0.55 ? mix(s2, sS, (b - 0.28) / 0.27) : b < 0.8 ? mix(sS, sH, (b - 0.55) / 0.25) : mix(sH, sL, (b - 0.8) / 0.2);
  return s;
}
vec3 shade(vec2 px) {
  vec2 ndc = px / res * 2.0 - 1.0;
  vec4 q = invVP * vec4(ndc, 1.0, 1.0);
  vec3 ro = camPos, rd = normalize(q.xyz / q.w - camPos);
  float t = -ro.z / rd.z;
  vec2 P = (ro + rd * t).xy;
  // the gloved hand, in front of everything on the box
  int hm;
  float th = marchHand(ro, rd, t, hm);
  if (th < t) return shadeHand(ro + rd * th, rd, hm);
  // defocus: circle of confusion on the film (mm) from the distance to the focal plane
  float coc = aperture * abs(t - focusT) / t;
  vec2 fuv = (P - filmRect.xy) / filmRect.zw;
  vec2 fw = fwidth(fuv) * vec2(${FILM_W.toFixed(1)}, ${FILM_H.toFixed(1)}) / PX_SCALE;
  float lod = max(log2(max(max(fw.x, fw.y), 1e-4)), log2(max(coc * texPpm, 1e-4)));
  float lodRaw = lod;
  lod = max(lod, 0.0);
  // the film's edge: rounded corners, a hair of unexposed margin
  vec2 hb = filmRect.zw * 0.5, c = P - (filmRect.xy + hb);
  vec2 qq = abs(c) - hb + ${FILM.corner.toFixed(1)};
  float edge = length(max(qq, 0.0)) + min(max(qq.x, qq.y), 0.0) - ${FILM.corner.toFixed(1)};
  // the lightbox behind: a diffuser lit by tubes (soft horizontal bands), a little brighter in the middle
  float tubes = (0.87 + 0.13 * pow(0.5 + 0.5 * cos((P.y - 14.0) * 6.2832 / 56.0), 1.5) + 0.03 * snoise(P * 0.025))
    * (1.0 - 0.14 * smoothstep(40.0, 150.0, length(P * vec2(0.75, 1.3))));
  float Lb = box * tubes;
  vec3 boxCol = mix(T_LIGHTBOX, T_LIGHTBOX * vec3(0.86, 0.93, 1.05), boxCool);
  float aaE = max(fwidth(edge) * 1.5, coc * 0.5);
  float onFilm = 1.0 - smoothstep(-aaE, aaE, edge);
  vec3 col;
  // the film
  vec3 dn = textureLod(filmTex, fuv, lod).rgb;
  // the amalgams: each one's metal can be a ghost that comes through ("yeah")
  float mk = 1.0;
  for (int i = 0; i < 7; i++) { vec2 d = P - fillC[i]; if (dot(d, d) < 42.0) mk = fillK[i]; }
  dn.b *= mk;
  float trabK = 1.0 - smoothstep(0.5, 2.5, lod);
  float b = bright(dn, P, trabK);
  // edge contrast (the film's adjacency effect / a processor's sharpening)
  vec3 dB = textureLod(filmTex, fuv, lod + 2.2).rgb;
  float bB = bright(dB, P, 0.0);
  b += 0.38 * (b - bB);
  b = clamp(b, 0.0, 1.0);
  // the film's characteristic: the base and the air (soft tissue only) go to film black, bone a dark grey, the teeth
  // and the metal up the scale
  b = clamp((b - 0.17) / 0.83, 0.0, 1.0);
  // "the nights grow cold": the teeth go faint under the cooling tube (the words keep their metal)
  b *= 1.0 - 0.42 * boxCool;
  // the sung words: radiopaque, a density in the film like the metal of a filling; it multiplies the film's
  // transmission, so the anatomy under a letter still shows a little through it; soft-edged like the rest of the image
  vec2 wuv = (P - wordRect.xy) / wordRect.zw;
  float wm = 0.0, wmW = 0.0;
  if (all(greaterThan(wuv, vec2(-0.05))) && all(lessThan(wuv, vec2(1.05)))) {
    float wl = max(lodRaw + log2(${WORD_W.toFixed(1)} / wordRect.z / texPpm), 0.0);
    // soft-edged like the rest of the radiograph (~0.12 mm), taps at the base level (no mip blocks)
    vec2 o = vec2(0.11) / wordRect.zw;
    wm = 0.36 * textureLod(wordTex, wuv, wl).r + 0.16 * (textureLod(wordTex, wuv + vec2(o.x, 0.0), wl).r + textureLod(wordTex, wuv - vec2(o.x, 0.0), wl).r + textureLod(wordTex, wuv + vec2(0.0, o.y), wl).r + textureLod(wordTex, wuv - vec2(0.0, o.y), wl).r);
    // the density falls off toward a stroke's edge, as a filling's does (thicker metal in the middle)
    wm *= 0.7 + 0.3 * textureLod(wordTex, wuv, wl + 1.6).r;
    wmW = textureLod(wordTex, wuv, wl + 5.0).r;
  }
  b = 1.0 - (1.0 - b) * exp(-1.75 * wm);
  // the film's edge: a zero-thickness sheet, only a hairline where the cut edge catches the light
  b *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.07 + coc, abs(edge + 0.08)));
  // the ID dot: a small embossed dimple near the corner, lit from the upper left, a little thinner than the film round it
  vec2 dot0 = filmRect.xy + filmRect.zw - vec2(5.0);
  vec2 dv = P - dot0;
  float dd = length(dv);
  float inDot = 1.0 - smoothstep(0.62, 0.7 + coc, dd);
  float ring = 1.0 - smoothstep(0.0, 0.1 + coc, abs(dd - 0.66));
  float lit = dot(dv / max(dd, 1e-3), vec2(-0.7071, 0.7071));
  b = mix(b, b + 0.22, inDot) + 0.26 * ring * lit;
  // overexposure (BURNING): the dark film goes thin, everything toward clear
  // (one tube flares: a hot band across the film, the top and bottom of the frame keep their blacks)
  float ob = overex * mix(0.22, 1.0, exp(-pow((P.y - overY) / max(overH, 1.0), 2.0)));
  b = mix(b, 1.0 - (1.0 - b) * 0.3, ob);
  Lb *= 1.0 + 0.2 * ob;
  b = clamp(b, 0.0, 1.0);
  // silver grain: clumps ~0.06 mm, strongest in the mid-tones, still there in the clear areas
  vec2 gq = floor(P / 0.055);
  float gn = hash12(gq) + hash12(gq + 17.3) - 1.0;
  float mid = 1.0 - abs(b - 0.45) * 1.7;
  float grainK = (1.0 - smoothstep(0.0, 2.0, lod));
  vec3 s = ramp(b) + gn * 0.05 * max(mid, 0.32) * grainK;
  col = toLinear(max(s, 0.0)) * Lb;
  col *= mix(vec3(1.0), boxCol / T_LIGHTBOX, 0.6);
  // halation: light scattered in the film base round the clearest areas (wide, faint, cold), the words' too
  vec3 dW = textureLod(filmTex, fuv, lod + 5.5).rgb;
  float bW = max(bright(dW, P, 0.0), wmW * 0.9);
  col += T_LIGHTBOX * Lb * 0.05 * bW * bW;
  // the film's surface: a faint sheen of the room on the gloss, dust, scratches in the emulsion
  float sheen = 0.006 * smoothstep(-60.0, 80.0, P.x * 0.6 + P.y);
  col += T_SILVER * sheen;
  vec2 dq = floor(P / 0.2);
  float dust = step(0.9993, hash12(dq + 3.1)) * (1.0 - smoothstep(0.2, 0.45, length(fract(P / 0.2) - 0.5)));
  col *= 1.0 - 0.6 * dust * smoothstep(0.4, 0.9, b);
  float scr = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 o = vec2(-80.0 + 70.0 * fk, -30.0 + 20.0 * fk);
    float ang = 0.35 + 0.5 * fk;
    vec2 r = rot2(ang) * (P - o);
    float curve = r.x * r.x * 0.0012 * (fk - 1.0);
    float d = abs(r.y - curve);
    float along = smoothstep(0.0, 20.0, r.x) * (1.0 - smoothstep(60.0 + 20.0 * fk, 90.0 + 20.0 * fk, r.x));
    scr += along * (1.0 - smoothstep(0.0, 0.035 + coc * 0.5, d));
  }
  col += T_HALIDE * 0.025 * scr * (1.0 - b);
  // off the film: the bare lightbox (its diffuser, the tubes behind it)
  // off the film: the bare lightbox, the brightest thing in frame (the diffuser's faint texture)
  vec3 bare = boxCol * box * 1.09 * (0.992 + 0.008 * snoise(P * 1.6));
  col = mix(bare, col, onFilm);
  // the film's tag, clipped to its corner: paper lit by the room, the type and his signature in ink
  if (tagOn > 0.5) {
    vec2 tq = rot2(-tagRot) * (P - tagRect.xy) / tagRect.zw + 0.5;
    if (all(greaterThan(tq, vec2(0.0))) && all(lessThan(tq, vec2(1.0)))) {
      vec4 tc = texture(tagTex, tq);
      float room = 0.62 + 0.08 * tq.y - 0.05 * tq.x;
      col = mix(col, tc.rgb * room, tc.a);
    }
  }
  // a spring (bulldog) clip at the film's top edge, holding film and tag: front-lit steel; nothing casts a shadow onto
  // backlit film
  vec2 cq = (P - vec2(filmRect.x + filmRect.z - 22.0, filmRect.y + filmRect.w + 4.3)) / 0.68;   // (clip units: 0.68 mm)
  float hwB = mix(10.0, 8.0, clamp((cq.y + 8.0) / 13.0, 0.0, 1.0));
  float dBody = max(abs(cq.x) - hwB, max(-8.0 - cq.y, cq.y - 5.0)) ;
  vec2 bq = abs(cq - vec2(0.0, 6.2)) - vec2(8.4, 1.5) + 1.4;
  float dBar = length(max(bq, 0.0)) + min(max(bq.x, bq.y), 0.0) - 1.4;
  vec2 wq = (cq - vec2(0.0, 6.5)) / vec2(7.2, 11.0);
  float dWire = cq.y > 6.5 ? abs(length(wq) - 1.0) * 7.2 - 0.38 : 1e3;
  float dClip = min(min(dBody, dBar), dWire);
  float aaC = max(fwidth(dClip) * 1.2, coc * 0.5);
  float onClip = 1.0 - smoothstep(-aaC, aaC, dClip);
  float brushed = 0.94 + 0.06 * snoise(vec2(cq.x * 6.0, cq.y * 0.4));
  vec3 steel = mix(T_SILVER * 0.32, T_HALIDE * 0.52, smoothstep(-8.0, 5.0, cq.y)) * brushed;
  steel *= 1.0 + 0.35 * (1.0 - smoothstep(0.0, 0.8, -dBody)) * step(dBody, dBar);   // the bevelled edge catches light
  float roll = clamp((cq.y - 6.2) / 1.5, -1.0, 1.0);
  vec3 barCol = T_HALIDE * (0.28 + 0.5 * pow(max(1.0 - abs(roll - 0.35), 0.0), 3.0));
  vec3 wireCol = T_SILVER * 0.45;
  vec3 clipCol = dWire < min(dBody, dBar) ? wireCol : dBar < dBody ? barCol : steel;
  col = mix(col, clipCol, onClip);
  // the loupe: a lens's dark rim and the falloff at its edge
  if (loupeR > 0.0) {
    float dl = length(FRAG_PX - loupe) / loupeR;
    col *= 1.0 - smoothstep(0.9, 1.0, dl) * 0.97;
    col *= 1.0 - 0.25 * smoothstep(0.5, 0.95, dl);
  }
  return col;
}
void main() {
  vec3 c = vec3(0.0);
  for (int k = ssK0(); k < ssK1(); k++) c += shade(gl_FragCoord.xy + rgss(k) * PX_SCALE);
  fragColor = vec4(c * ssWeight(), 1.0);
}`;

/** Where a phrase sits on the frame it is laid out on (logical px): 'row' the hero's cap centre at (x, y), the other
 *  words before it on its baseline; 'center' the phrase's cap centre at (x, y); 'stack' the hero's cap centre at (x, y),
 *  the other words in a row above it. Cap heights in px; maxW the widest it may be (px). */
interface Anchor { x: number; y: number; mode: 'row' | 'center' | 'stack'; hero?: number; sup?: number; maxW?: number; ref?: number }
interface Layout { x: number[]; y: number[]; w: number[]; size: number[]; kw: KinWord[] }
/** One phrase of the karaoke: words (indices into the line), which is the hero, where it sits in film mm. */
/** exit: how it leaves (a collapse onto its baseline as the next phrase of its line arrives, a slide off to the left
 *  on the beat after its line ends). */
interface Phrase { line: Line; words: Word[]; hero: number; t0: number; t1: number; anchor: Anchor; layout?: Layout; exit: NonNullable<Moves['exit']> }
/** The glove's pen: tip (film mm, z toward the camera), heading on the film (rad, y up), tilt above it. */
interface HandPose { x: number; y: number; z: number; head: number; tilt: number }

const CAP_K = 0.715; // Archivo cap height / em
const SIGN0 = 9.9, SIGN1 = 10.45;          // the signature (the type sheet's timing)
const TAG_RECT = { x: FILM.x1 - 34, y: FILM.y1 - 7.6, w: 44, h: 18.5, rot: -0.025 };
const TAG0 = 9.445, TAG1 = 9.86;           // the tag carried in under the glove and clipped
const PEN_HEAD = -0.62, PEN_TILT = 0.62;
/** The signature's unit box on the tag (its px): top-left and size, as the type sheet set it. */
const SIG = { x: 288, y: 252 - 34 - 296 * MONO_H * 0.84, size: 296 };

// ---------------------------------------------------------------------------------------------- glyph sprites
// The kit's drawKin sets every glyph with fillText each frame. Here each (glyph, Archivo instance) is set once, in
// init, into a sprite, and the word layer is drawn from the sprites with the kit's poses (the same transform as
// drawKin's): no font switching per frame, and the frame checker's 2D text hook never sees lone letters (it matched
// the "i" of "thing" to the sung "I", the "a" of "can't" to the "a" of the next plate's line).
interface Sprite { cv: HTMLCanvasElement; adv: number; ox: number; base: number; S: number }
class GlyphSprites {
  private m = new Map<string, Sprite>();
  /** Set glyph ch of an Archivo family (as KinWord.family gives it) at S px per em. */
  add(ch: string, fam: string, S: number) {
    const key = `${fam}|${ch}`;
    if (this.m.has(key) || !ch.trim()) return;
    const cv = document.createElement('canvas');
    const c = cv.getContext('2d')!;
    c.font = font(fam, S);
    const adv = c.measureText(ch).width, ox = Math.ceil(0.18 * S), base = Math.ceil(1.0 * S);
    cv.width = Math.ceil(adv + 2 * ox); cv.height = Math.ceil(1.3 * S);
    c.font = font(fam, S);
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#fff';
    c.fillText(ch, ox, base);
    this.m.set(key, { cv, adv, ox, base, S });
  }
  get(ch: string, fam: string) { return this.m.get(`${fam}|${ch}`); }
}
/** drawKin without fillText: a posed word at (0, 0) of the current transform (units: the word's em = kw.style.size),
 *  every glyph from its sprite. `fam` picks the instance a glyph is drawn in from its pose. */
function drawPosed(c: CanvasRenderingContext2D, sp: GlyphSprites, kw: KinWord, P: KinPose, alpha: number, fam: (p: GlyphPose) => string) {
  const a0 = c.globalAlpha, size = kw.style.size;
  P.glyphs.forEach((p, i) => {
    const g = kw.glyphs[i]!;
    if (p.on <= 0.001 || !g.ch.trim()) return;
    const s = sp.get(g.ch, fam(p));
    if (!s) return;
    const k = size / s.S, adv = s.adv * k;
    const corr = g.adv / Math.max(1e-6, adv);
    c.save();
    c.globalAlpha = a0 * clamp(p.on * 3) * alpha;
    c.translate(p.cx, p.y);
    if (p.rot) c.rotate(p.rot);
    c.scale(p.sx * corr, p.sy);
    c.drawImage(s.cv, -adv / 2 - s.ox * k, -s.base * k, s.cv.width * k, s.cv.height * k);
    c.restore();
  });
  c.globalAlpha = a0;
}

export default class Lightbox extends Scene {
  private pass!: FSPass;
  private film!: FilmInfo;
  private filmTex!: THREE.CanvasTexture;
  private wcv!: HTMLCanvasElement;
  private wctx!: CanvasRenderingContext2D;
  private wordTex!: THREE.CanvasTexture;
  private tagCv!: HTMLCanvasElement;
  private tagTex!: THREE.CanvasTexture;
  private tagLen = -1;
  private cam = new THREE.PerspectiveCamera(VFOV, 16 / 9, 1, 5000);
  private phrases: Phrase[] = [];
  private downbeats: number[] = [];
  private fillOrder: number[] = [];
  private clk!: KinClock;
  private sprites = new GlyphSprites();

  override init() {
    this.film = buildFilm(HIS);
    this.filmTex = new THREE.CanvasTexture(this.film.canvas);
    this.filmTex.colorSpace = THREE.NoColorSpace;
    this.filmTex.generateMipmaps = true;
    this.filmTex.minFilter = THREE.LinearMipmapLinearFilter;
    this.filmTex.magFilter = THREE.LinearFilter;
    this.filmTex.anisotropy = 8;
    this.filmTex.needsUpdate = true;
    this.wcv = document.createElement('canvas');
    this.wcv.width = WORD_W * SCALE; this.wcv.height = WORD_H * SCALE;
    this.wctx = this.wcv.getContext('2d')!;
    this.wordTex = new THREE.CanvasTexture(this.wcv);
    this.wordTex.colorSpace = THREE.NoColorSpace;
    this.wordTex.generateMipmaps = true;
    this.wordTex.minFilter = THREE.LinearMipmapLinearFilter;
    const fills = this.film.fillings.slice(0, 7);
    while (fills.length < 7) fills.push({ n: 0, center: [1e4, 1e4] });
    // "yeah": the fillings come through one after another across the arch, back to the last molar on his right
    this.fillOrder = fills.map((f, i) => [f.center[0], i] as [number, number]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
    this.pass = new FSPass(FRAG, {
      filmTex: { value: this.filmTex }, wordTex: { value: this.wordTex },
      invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, res: { value: new THREE.Vector2() },
      filmRect: { value: new THREE.Vector4(FILM.x0, FILM.y0, FILM.x1 - FILM.x0, FILM.y1 - FILM.y0) },
      wordRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      focusT: { value: 160 }, aperture: { value: 12 }, box: { value: 1 }, boxCool: { value: 0 }, overex: { value: 0 }, texPpm: { value: FILM.ppm },
      overY: { value: 0 }, overH: { value: 20 },
      fillC: { value: fills.map((f) => new THREE.Vector2(f.center[0], f.center[1])) }, fillK: { value: fills.map(() => 1) },
      hTip: { value: new THREE.Vector3() }, hE1: { value: new THREE.Vector3() }, hE2: { value: new THREE.Vector3() }, hE3: { value: new THREE.Vector3() },
      handOn: { value: 0 },
      loupe: { value: new THREE.Vector2() }, loupeR: { value: 0 }, ssTap: SS_TAP,
      tagTex: { value: null }, tagRect: { value: new THREE.Vector4(TAG_RECT.x, TAG_RECT.y, TAG_RECT.w, TAG_RECT.h) }, tagRot: { value: TAG_RECT.rot }, tagOn: { value: 0 },
    });
    this.downbeats = this.ctx.audio.downbeats.filter((d) => d > this.ctx.start - 0.5 && d < this.ctx.end + 0.5);
    this.tagCv = document.createElement('canvas');
    this.tagCv.width = 1200 * SCALE; this.tagCv.height = 504 * SCALE;
    this.tagTex = new THREE.CanvasTexture(this.tagCv);
    this.tagTex.colorSpace = THREE.SRGBColorSpace;
    this.tagTex.generateMipmaps = true;
    this.tagTex.minFilter = THREE.LinearMipmapLinearFilter;
    this.pass.u.tagTex!.value = this.tagTex;
    this.clk = new KinClock(this.ctx.audio);
    this.buildPhrases();
  }

  // ------------------------------------------------------------------ the karaoke phrases
  private buildPhrases() {
    const ly = this.ctx.lyrics;
    const ROW: Anchor = { x: 960, y: 232, mode: 'row' };
    const P = (q: string, idx: number[], hero: number, anchor: Anchor = ROW) => {
      const line = ly.get(q);
      return { line, words: idx.map((i) => line.words[i]!), hero, anchor } as Phrase;
    };
    const L1 = 'Some days you', L2 = 'Only thing that', L3 = 'look away, can', L4 = 'Beg you to stay';
    // one hero per line: KNOW, BURNING, the second AWAY (on the chip), the second STAY (in its filling)
    const list: Phrase[] = [
      P(L1, [0, 1], -1), P(L1, [2, 3, 4], -1), P(L1, [5, 6, 7], 2),
      P(L2, [0, 1, 2], -1), P(L2, [3], 0), P(L2, [4, 5, 6], -1), P(L2, [7, 8], -1),
      // inside the loupe's lens: the first phrase across it, the second with AWAY over the chip, the rest above it
      P(L3, [0, 1, 2], -1, { x: 960, y: 330, mode: 'center', sup: 70, maxW: 800 }),
      P(L3, [3, 4, 5], 2, { x: 960, y: 372, mode: 'stack', hero: 150, sup: 52, maxW: 840 }),
      // tooth to tooth: each STAY comes through in a filling, laid over it
      P(L4, [0, 1, 2], -1, { x: 960, y: 250, mode: 'row' }),
      P(L4, [3], -1, { x: 960, y: 540, mode: 'center', sup: 132 }),
      P(L4, [4, 5, 6], -1, { x: 960, y: 250, mode: 'row' }),
      P(L4, [7], 0, { x: 960, y: 540, mode: 'center', hero: 210 }),
      P(L4, [8], -1, { x: 960, y: 205, mode: 'center', sup: 64, ref: ly.get(L4).words[8]!.start + 0.6 }),
    ];
    // on screen from its first word's ghost (0.3 s ahead, never over the phrase before it) until its exit is over: it
    // collapses onto its baseline as the next phrase of its line springs in, or slides off to the left on the next
    // beat after its line ends
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!, nx = list[i + 1], pv = list[i - 1];
      p.t0 = p.words[0]!.start - 0.3;
      if (pv && pv.line === p.line) p.t0 = Math.max(p.t0, pv.exit.at + pv.exit.dur! * 1.2);
      // (a snap collapse, gone as the next phrase's letters spring: they share the frame's anchor)
      const last = p.words[p.words.length - 1]!;
      if (nx && nx.line === p.line) p.exit = { at: Math.max(last.start + 0.1, Math.min(last.end - 0.04, nx.words[0]!.start - 0.145)), kind: 'collapse', dur: 0.1 };
      else {
        let at = this.clk.leave(p.line.end);
        if (nx) at = Math.min(at, nx.words[0]!.start - 0.3);
        p.exit = { at, kind: 'slide', dir: -0.4, dur: 0.2 };
      }
      p.t1 = p.exit.at + p.exit.dur! * 1.25 + 0.02;
    }
    this.phrases = list;
    // lay every phrase out, and set its glyphs into sprites in every Archivo instance its moves reach: the
    // supporting words 112/500, the heroes light (300, the ghost) and heavy (900), COLD along its condensing
    const cold = this.ctx.lyrics.get('Only thing that').words[8]!;
    for (const p of list) {
      const L = this.layout(p);
      p.words.forEach((w, i) => {
        const kw = L.kw[i]!, fams: string[] = [];
        if (i === p.hero) fams.push(kw.family(125, 300), kw.family(125, 900));
        else if (w === cold) for (let k = 0; k <= 1.001; k += 0.05) fams.push(kw.family(lerp(112, 62, k), lerp(500, 800, k)));
        else fams.push(kw.family(112, 500));
        for (const f of new Set(fams)) for (const g of kw.glyphs) this.sprites.add(g.ch, f, i === p.hero ? 420 : 300);
      });
    }
  }

  // ------------------------------------------------------------------ the film's tag (the type sheet's design)
  /** The tag in its own px (600 x 252, drawn at 2x): 08-32, RADIOGRAPH · PANORAMIC, EXAMINED BY and his signature,
   *  written over 9.9 - 10.45 s with the pen's speed profile. Redrawn only while the ink moves. */
  private drawTag(t: number) {
    const len = monoWritten(t, SIGN0, SIGN1);
    if (len === this.tagLen) return;
    this.tagLen = len;
    const c = this.tagCv.getContext('2d')!;
    const w = 600, h = 252;
    c.setTransform(2 * SCALE, 0, 0, 2 * SCALE, 0, 0);
    c.clearRect(0, 0, w, h);
    // the card: cold white stock, a faint tooth to it
    c.fillStyle = T_HEX.lightbox;
    c.beginPath(); c.roundRect(0, 0, w, h, 5); c.fill();
    let sd = 7;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let i = 0; i < 900; i++) { c.fillStyle = trgba('halide', 0.05 + 0.08 * rnd()); c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 5, 0.6); }
    c.strokeStyle = trgba('film', 0.22); c.lineWidth = 1;
    c.strokeRect(12.5, 12.5, w - 25, h - 25);
    // the punched hole and its reinforcement ring
    c.fillStyle = trgba('halide', 0.9);
    c.beginPath(); c.arc(44, h / 2, 17, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.arc(44, h / 2, 8, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'source-over';
    const lab = (s: string, x: number, y: number, size: number, wt: number, col: string) => {
      c.font = font(F.mono(wt), size); (c as unknown as { letterSpacing: string }).letterSpacing = `px`;
      c.fillStyle = col; c.fillText(s, x, y);
    };
    lab('08-32', 86, 50, 22, 600, T_HEX.film);
    lab('RADIOGRAPH · PANORAMIC', 86, 72, 11, 500, trgba('film', 0.6));
    lab('EXAMINED BY', 86, h - 30, 10, 500, trgba('film', 0.6));
    (c as unknown as { letterSpacing: string }).letterSpacing = '0px';
    c.fillStyle = trgba('film', 0.45);
    c.fillRect(190, h - 34, w - 230, 1);
    if (len > 0) drawMonogram(c, len, { x: SIG.x, y: SIG.y, size: SIG.size, width: 4.6, pressure: 0.9, color: T_HEX.film2 });
    this.tagTex.needsUpdate = true;
  }
  /** The tag's centre (film mm): carried in from below right under the glove's pen, slid up under the clip. */
  private tagAt(t: number): [number, number] {
    const k = ease.outCubic(clamp((t - TAG0) / (TAG1 - TAG0)));
    return [TAG_RECT.x + 30 * (1 - k), TAG_RECT.y - 44 * (1 - k)];
  }
  /** A point of the tag (its own px, 600 x 252, y down) on the film (mm), the tag at centre c. */
  private tagToFilm(px: number, py: number, c: [number, number]): [number, number] {
    const lx = (px / 600 - 0.5) * TAG_RECT.w, ly = (0.5 - py / 252) * TAG_RECT.h;
    const a = -TAG_RECT.rot, ca = Math.cos(a), sa = Math.sin(a);
    return [c[0] + lx * ca - ly * sa, c[1] + lx * sa + ly * ca];
  }

  // ------------------------------------------------------------------ the gloved hand
  /** The pen: rests on the tag at the signature's first point while the hand slides the tag in, signs, and flicks away
   *  out of frame before 10.60 (the approved still). null when out of the frame. */
  private hand(t: number): HandPose | null {
    if (t < TAG0 || t > SIGN1 + 0.13) return null;
    const mk = (x: number, y: number, z: number): HandPose => ({ x, y, z, head: PEN_HEAD + 0.03 * Math.sin(t * 5.0), tilt: PEN_TILT });
    const sigAt = (tt: number, c: [number, number]) => { const p = monoPenAt(tt, SIGN0, SIGN1); return { ...this.tagToFilm(SIG.x + p.x * SIG.size, SIG.y + p.y * SIG.size, c), down: p.down }; };
    const cEnd = this.tagAt(TAG1 + 1);
    if (t < SIGN0) {
      const c = this.tagAt(t);
      const s = sigAt(SIGN0, c);
      // pressing the tag along under the nib, then a small lift as it lets go under the clip
      const lift = 2.5 * Math.sin(Math.PI * clamp((t - TAG1) / (SIGN0 - TAG1)));
      return mk(s[0], s[1], lift);
    }
    if (t <= SIGN1) {
      const s = sigAt(t, cEnd);
      return mk(s[0], s[1], s.down ? 0 : 3);
    }
    const e = sigAt(SIGN1, cEnd);
    const k = ease.inQuad(clamp((t - SIGN1) / 0.12));
    const away = 240 * k;
    return { x: e[0] + Math.cos(PEN_HEAD) * away, y: e[1] + Math.sin(PEN_HEAD) * away, z: 3 + 60 * k, head: PEN_HEAD, tilt: PEN_TILT };
  }

  // ------------------------------------------------------------------ the camera
  /** Film point at the centre of view, visible width (mm) and tilt, as a function of time. */
  private camState(t: number): { cx: number; cy: number; w: number; yaw: number; pitch: number; loupe: number } {
    const db = this.downbeats;
    const ly = this.ctx.lyrics;
    const tc0 = 9.445, tc1 = db.find((d) => d > 10.5) ?? 10.74;
    const L3 = ly.get('look away, can').words, L4 = ly.get('Beg you to stay').words;
    const s1 = L3[0]!.start, s2 = L3[3]!.start;
    const b0 = L4[0]!.start;
    const yaw0 = -0.06 + 0.04 * Math.sin(t * 0.4);
    // line 1 (the approved 9.05): along the jaw from the patient's right molars toward his left, on the occlusal
    // curve's smile, pushing in on each downbeat after the first, eased into it (0.55 s)
    const line1 = (t: number) => {
      const cx = 2 + 9 * (t - 9.05) - 18 * (1 - smoothstep(7.0, 9.1, t));
      const widths = [140, 120, 100, 88];
      let w = widths[0]!;
      for (let i = 1; i < db.length && i < widths.length; i++) {
        const k = ease.inOutCubic(clamp((t - (db[i]! - 0.55)) / 0.55));
        w = lerp(w, widths[i]!, k);
      }
      return { cx, cy: 0.5 + 0.0021 * cx * cx, w };
    };
    // line 2: a new angle, low on his left: the lower arch tracking back toward the midline, the camera turned the
    // other way; settles after the cut, pushes in on the next downbeat
    const line2 = (t: number) => {
      const u = t - tc1;
      const cx = 64 - 6.5 * u;
      let w = lerp(124, 104, ease.outCubic(clamp(u / 0.7)));
      w = lerp(w, 84, ease.inOutCubic(clamp((t - ((db[3] ?? 12.466) - 0.55)) / 0.55)));
      return { cx, cy: 0.0042 * cx * cx - 7, w };
    };
    if (t < tc0) {
      const a = line1(t);
      return { ...a, yaw: yaw0, pitch: -0.04, loupe: 0 };
    }
    // between the lines (9.45 - 10.74): a pan along the film to its top right corner, where the glove brings the tag
    // in, clips it and signs it; held until the downbeat, where it cuts to the jaw
    if (t < tc1) {
      const k = ease.inOutCubic(clamp((t - tc0) / 0.5));
      const drift = (t - tc0) * 1.2;
      // while the glove signs, the camera gives it room (the hand reads whole), then settles back on the signed tag
      // (the approved 10.60) as the hand flicks away
      const ks = ease.inOutCubic(clamp((t - 9.78) / 0.32)) * (1 - ease.inOutCubic(clamp((t - SIGN1 + 0.04) / 0.16)));
      return {
        cx: lerp(2 + 9 * (tc0 - 9.05), FILM.x1 - 33 + drift, k) + 15 * ks, cy: lerp(0.5, FILM.y1 - 10.5, k) - 13 * ks,
        w: lerp(lerp(120, 74, k), 124, ks),
        yaw: yaw0, pitch: -0.04, loupe: 0,
      };
    }
    if (t < s1 - 0.4) {
      const a = line2(t);
      return { ...a, yaw: 0.08 + 0.03 * Math.sin(t * 0.5), pitch: -0.1, loupe: 0 };
    }
    // "Can't look away" x2: the loupe pushes in to #8 in two steps, one per phrase; the chip sits low in the lens,
    // the words above it; the hand-held loupe wanders a little
    if (t < b0 - 0.0) {
      const t8 = tooth(HIS, 8);
      const p8 = panoramic(HIS).find((p) => p.n === 8)!;
      const tip8 = { x: p8.x - p8.mirror * t8.md * 0.38 * p8.mag, y: p8.y + 2.5 };
      const a = line2(s1 - 0.4);
      const k1 = ease.inOutCubic(clamp((t - (s1 - 0.4)) / 0.4)), k2 = ease.inOutCubic(clamp((t - (s2 - 0.35)) / 0.35));
      let w = lerp(a.w, 44, k1);
      w = lerp(w, 21, k2);
      const wob = (w / 44) * 0.5;
      const cx = lerp(a.cx, tip8.x + wob * Math.sin(t * 1.7), k1);
      const cy = lerp(a.cy, tip8.y + (150 * w) / 1920 + wob * Math.cos(t * 1.3), k1);
      return { cx, cy, w, yaw: lerp(0.08, 0.0, k1), pitch: lerp(-0.1, -0.03, k1), loupe: k1 };
    }
    // "Beg you to stay, beg you to stay, yeah": the camera snaps tooth to tooth along his upper left arch: the canine,
    // into #13's filling (stay), back out over #14, into #14's filling (STAY); on "yeah" it pulls back to the whole
    // film on the box while the fillings come through
    const fc = (n: number) => this.film.fillings.find((f) => f.n === n)?.center ?? [40, 8];
    const ft = (n: number) => this.film.teeth.find((f) => f.n === n)!;
    const c11 = ft(11).crownTop, f13 = fc(13), f14 = fc(14);
    const T = [b0, L4[3]!.start, L4[4]!.start, L4[7]!.start, L4[8]!.start];
    const shots = [
      (t: number) => ({ cx: c11[0] - 6 + 3.5 * (t - T[0]!), cy: c11[1] + 4, w: 76, yaw: -0.1, pitch: 0.06 }),
      (t: number) => ({ cx: f13[0] + 0.6 * (t - T[1]!), cy: f13[1], w: 46 - 2.5 * (t - T[1]!), yaw: 0.05, pitch: -0.08 }),
      (t: number) => ({ cx: f14[0] - 8 + 3 * (t - T[2]!), cy: f14[1] + 5, w: 74, yaw: 0.12, pitch: 0.02 }),
      (t: number) => ({ cx: f14[0] + 0.4 * (t - T[3]!), cy: f14[1], w: 42 - 3 * (t - T[3]!), yaw: -0.04, pitch: -0.06 }),
      (t: number) => ({ cx: 0, cy: 2, w: 268 - 16 * (t - T[4]!), yaw: -0.03, pitch: -0.03 }),
    ];
    let i = 0;
    while (i < T.length - 1 && t >= T[i + 1]! - 0.12) i++;
    const cur = shots[i]!(t);
    if (i > 0) {
      const dur = i === 4 ? 0.5 : 0.12;
      const st = T[i]! - 0.12;
      const k = i === 4 ? ease.inOutCubic(clamp((t - st) / dur)) : ease.outCubic(clamp((t - st) / dur));
      if (k < 1) {
        const prev = shots[i - 1]!(st);
        // a snap: through log-width, so the push and the pull read evenly
        const w = Math.exp(lerp(Math.log(prev.w), Math.log(cur.w), k));
        return { cx: lerp(prev.cx, cur.cx, k), cy: lerp(prev.cy, cur.cy, k), w, yaw: lerp(prev.yaw, cur.yaw, k), pitch: lerp(prev.pitch, cur.pitch, k), loupe: 0 };
      }
    }
    return { ...cur, loupe: 0 };
  }

  private placeCamera(t: number) {
    const s = this.camState(t);
    const hf = Math.atan(Math.tan((VFOV * Math.PI) / 360) * (16 / 9));
    const D = s.w / 2 / Math.tan(hf);
    const target = new THREE.Vector3(s.cx, s.cy, 0);
    const pos = new THREE.Vector3(Math.sin(s.yaw) * D, Math.sin(s.pitch) * D, Math.cos(s.yaw) * Math.cos(s.pitch) * D).add(target);
    this.cam.position.copy(pos);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(target);
    this.cam.fov = VFOV;
    this.cam.aspect = 16 / 9;
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    return { ...s, D };
  }
  /** Screen (logical px) -> film mm, through the camera as it is now. */
  private toFilm(x: number, y: number): [number, number] {
    const v = new THREE.Vector3((x / 1920) * 2 - 1, 1 - (y / 1080) * 2, 0.5).unproject(this.cam);
    const o = this.cam.position, d = v.sub(o).normalize();
    const k = -o.z / d.z;
    return [o.x + d.x * k, o.y + d.y * k];
  }

  /** Lay a phrase out in film mm on the frame where its hero (or first word) is sung, at its anchor: each word's rest
   *  position and em, and its KinWord (the kit poses it from there). */
  private layout(p: Phrase): Layout {
    if (p.layout) return p.layout;
    const ref = p.anchor.ref ?? (p.hero >= 0 ? p.words[p.hero]!.start + 0.12 : p.words[0]!.start + 0.1);
    this.placeCamera(ref);
    const A = p.anchor;
    const [x0, y0] = this.toFilm(A.x, A.y);
    const [x1] = this.toFilm(A.x + 100, A.y);
    const mmPerPx = (x1 - x0) / 100;
    const heroCapPx = A.hero ?? 236, supCapPx = A.sup ?? (p.hero >= 0 ? 66 : 92);
    const sizes: number[] = [], widths: number[] = [], kws: KinWord[] = [];
    p.words.forEach((w, i) => {
      const hero = i === p.hero;
      const em = ((hero ? heroCapPx : supCapPx) / CAP_K) * mmPerPx;
      // the kit's kerned rest layout at a 100-unit em (drawn scaled to the word's em in film mm)
      const txt = hero ? w.w.replace(/[,.]/g, '').toUpperCase() : w.w.replace(/'/g, '’');
      const kw = new KinWord(txt, hero ? { size: 100, width: 125, weight: 900 } : { size: 100, width: 112, weight: 500 });
      widths.push((kw.width / 100) * em);
      sizes.push(em); kws.push(kw);
    });
    const stack = A.mode === 'stack' && p.hero >= 0;
    const gap0 = ((supCapPx * 0.42) / CAP_K) * mmPerPx;
    // the rows: in a stack the hero on its own row, the rest above it
    const rows: number[][] = stack ? [p.words.map((_, i) => i).filter((i) => i !== p.hero), [p.hero]] : [p.words.map((_, i) => i)];
    const rowW = (r: number[]) => r.reduce((a, i) => a + widths[i]!, 0) + gap0 * (r.length - 1);
    const total = Math.max(...rows.map(rowW));
    // keep the phrase well inside title-safe (96 px): at most 1520 px wide on the layout frame (less in the loupe)
    const fit = Math.min(1, ((A.maxW ?? 1520) * mmPerPx) / total);
    for (let i = 0; i < widths.length; i++) { widths[i]! *= fit; sizes[i]! *= fit; }
    const gap = gap0 * fit;
    const xs: number[] = new Array(p.words.length).fill(0), ys: number[] = new Array(p.words.length).fill(0);
    const capMain = (p.hero >= 0 ? heroCapPx : supCapPx) * mmPerPx * fit;
    // the baseline of the main row (film y up): its cap centre on the anchor; a row phrase keeps the gate 2 layout
    const base = A.mode === 'row' ? y0 - (heroCapPx / 2) * mmPerPx * fit : y0 - capMain / 2;
    rows.forEach((r, ri) => {
      let x = x0 - (r.reduce((a, i) => a + widths[i]!, 0) + gap * (r.length - 1)) / 2;
      const y = stack && ri === 0 ? base + capMain + supCapPx * mmPerPx * fit * 1.05 : base;
      for (const i of r) { xs[i] = x; ys[i] = y; x += widths[i]! + gap; }
    });
    p.layout = { x: xs, y: ys, w: widths, size: sizes, kw: kws };
    return p.layout;
  }

  /** The kit's moves for word i of a phrase (verse 1: low energy, restrained and precise). Every word springs up
   *  letter by letter on its onset and its letter-spacing breathes open on each beat; the supporting words slide a
   *  step left along the film on every beat; only the hero stamps (oversized, settling) and snaps light to heavy. */
  private moves(p: Phrase, i: number): Moves {
    const w = p.words[i]!;
    // (the slide exit is the kit's; the collapse is squash(), eased out so it reads in its three frames)
    const m: Moves = { t0: w.start, lead: 0.045, track: { amt: 0.035, hl: 0.12 }, exit: p.exit.kind === 'slide' ? p.exit : undefined };
    if (i === p.hero) {
      m.spring = { stagger: 0.022, rise: 0.16, freq: 5.5, damp: 0.45 };
      m.stamp = { over: 1.2, freq: 4.5, damp: 0.55 };
      m.weight = { from: 300, dur: 0.05 };
    } else {
      m.spring = { stagger: 0.02, rise: 0.3, freq: 5.5, damp: 0.42 };
      m.slide = { perBeat: [-7, 0], from: p.words[0]!.start };
    }
    return m;
  }
  /** The collapse exit: squashed flat onto the baseline (eased out: most of it in the first frame), widening a little,
   *  the letters going left to right. */
  private squash(p: Phrase, P: KinPose, t: number) {
    const e = p.exit, n = P.glyphs.length;
    if (e.kind !== 'collapse' || t < e.at) return;
    P.glyphs.forEach((g, i) => {
      const u = clamp((t - e.at - 0.2 * e.dur! * (n > 1 ? i / (n - 1) : 0)) / e.dur!);
      g.sy *= 1 - ease.outQuad(u); g.sx *= 1 + 0.15 * u;
      if (u >= 1) g.on = 0;
    });
  }
  /** COLD condenses on Archivo's width axis (112 -> 62), and grows denser (500 -> 800), as the tube cools and dims,
   *  about its left edge. */
  private condense(kw: KinWord, P: KinPose, t: number) {
    const cold = this.ctx.lyrics.get('Only thing that').words[8]!;
    const k = ease.inOutCubic(clamp((t - (cold.start - 0.02)) / (cold.end - cold.start + 0.05)));
    if (k <= 0) return;
    const width = lerp(112, 62, k), wr = kw.widthRatio(width) / kw.widthRatio(P.glyphs[0]?.width ?? 112);
    const g0 = kw.glyphs[0]!, left = g0.cx - g0.adv / 2;
    for (const g of P.glyphs) { g.cx = left + (g.cx - left) * wr; g.sx *= wr; g.width = width; g.weight = lerp(500, 800, k); }
  }

  /** Draw the phrases on screen at t (the current one and, while it leaves, the one before it) into the word layer
   *  (film space); return the layer's rect (mm) and the heroes' stamp pulse. */
  private drawWords(t: number): { rect: [number, number, number, number] | null; shake: number } {
    const c = this.wctx;
    c.filter = 'none';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.wcv.width, this.wcv.height);
    let vis = this.phrases.filter((q) => t >= q.t0 && t < q.t1);
    if (!vis.length) return { rect: null, shake: 0 };
    const clk = this.clk;
    // pose every word: the sung letters, and the ghost (the latent image, 35 %) of the letters not yet sprung
    interface Drawn { L: Layout; i: number; hero: number; P: KinPose; G: KinPose }
    const posed = (p: Phrase) => {
      const L = p.layout!, out: Drawn[] = [];
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      p.words.forEach((w, i) => {
        // nothing on screen more than 0.4 s before it is sung (the ghost comes up 0.3 s ahead)
        if (t < w.start - 0.3) return;
        const kw = L.kw[i]!, m = this.moves(p, i), hero = i === p.hero;
        const P = kw.pose(t, clk, m);
        const G = kw.pose(t, clk, { ...m, t0: -1e3, spring: false, stamp: undefined, weight: hero ? { from: 300, to: 300 } : undefined });
        const sp = m.spring as { stagger: number };
        G.glyphs.forEach((g, j) => { g.on = t < w.start - 0.045 + j * sp.stagger && !(p.exit && t >= p.exit.at) ? 1 : 0; });
        if (w === this.ctx.lyrics.get('Only thing that').words[8]) { this.condense(kw, P, t); this.condense(kw, G, t); }
        this.squash(p, P, t);
        out.push({ L, i, hero: p.hero, P, G });
        // extents (mm): the rest box and every posed glyph
        const em = L.size[i]!, k = em / 100;
        x0 = Math.min(x0, L.x[i]!); x1 = Math.max(x1, L.x[i]! + L.w[i]!);
        y0 = Math.min(y0, L.y[i]! - em * 0.3); y1 = Math.max(y1, L.y[i]! + em * 0.85);
        P.glyphs.forEach((g, j) => {
          if (g.on <= 0.001) return;
          const hx = (kw.glyphs[j]!.adv * Math.abs(g.sx) * 0.5 + 12) * k, b = L.y[i]! - g.y * k;
          x0 = Math.min(x0, L.x[i]! + g.cx * k - hx); x1 = Math.max(x1, L.x[i]! + g.cx * k + hx);
          y0 = Math.min(y0, b - em * 0.3 * g.sy); y1 = Math.max(y1, b + em * 0.9 * g.sy);
        });
      });
      return { out, box: [x0, y0, x1, y1] as const };
    };
    let sets = vis.map(posed);
    // a leaving phrase far from the new one (the camera has cut away from it) goes with the cut
    const cur = sets[sets.length - 1]!.box;
    const span = (b: readonly number[]) => Math.max(b[2]! - b[0]!, (b[3]! - b[1]!) * 2);
    const union = (bs: (readonly number[])[]) => [Math.min(...bs.map((b) => b[0]!)), Math.min(...bs.map((b) => b[1]!)), Math.max(...bs.map((b) => b[2]!)), Math.max(...bs.map((b) => b[3]!))];
    if (sets.length > 1 && span(union(sets.map((s) => s.box))) > 2.4 * span(cur)) { sets = sets.slice(-1); vis = vis.slice(-1); }
    const [xMin, yMin, xMax, yMax] = union(sets.map((s) => s.box)) as [number, number, number, number];
    if (!(xMax > xMin)) return { rect: null, shake: 0 };
    // the layer's window around them (2:1)
    const ww = Math.max(xMax - xMin + 8, (yMax - yMin + 8) * 2, 40) * 1.04, wh = ww / 2;
    const wx = (xMin + xMax) / 2 - ww / 2, wy = (yMin + yMax) / 2 - wh / 2;
    const sx = this.wcv.width / ww;
    // film mm -> layer px (y up -> canvas y down)
    c.setTransform(sx, 0, 0, -sx, -wx * sx, (wy + wh) * sx);
    c.textBaseline = 'alphabetic';
    let shake = 0;
    for (const s of sets) for (const d of s.out) {
      const em = d.L.size[d.i]!, kw = d.L.kw[d.i]!;
      c.save();
      c.translate(d.L.x[d.i]!, d.L.y[d.i]!);
      c.scale(em / 100, -em / 100);
      // (a hero snaps light to heavy: its glyphs are set in the 300 and the 900 only)
      const fam = d.i === d.hero ? (g: GlyphPose) => kw.family(125, g.weight < 600 ? 300 : 900) : (g: GlyphPose) => kw.family(g.width, g.weight);
      drawPosed(c, this.sprites, kw, d.G, 0.35, fam);
      drawPosed(c, this.sprites, kw, d.P, 1, fam);
      c.restore();
      shake = Math.max(shake, d.P.shake);
    }
    // a clear border: nothing reaches the layer's edge (its texels clamp)
    const W = this.wcv.width, H = this.wcv.height, e = 4;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, e); c.clearRect(0, H - e, W, e); c.clearRect(0, 0, e, H); c.clearRect(W - e, 0, e, H);
    return { rect: [wx, wy, ww, wh], shake };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t;
    const s = this.placeCamera(t);
    const u = this.pass.u;
    (u.invVP!.value as THREE.Matrix4).multiplyMatrices(this.cam.matrixWorld, this.cam.projectionMatrixInverse);
    (u.camPos!.value as THREE.Vector3).copy(this.cam.position);
    (u.res!.value as THREE.Vector2).set(out.width, out.height);
    u.focusT!.value = s.D;
    u.aperture!.value = 3 + 5 * s.loupe + 2 * smoothstep(50, 30, s.w) * (1 - s.loupe);
    // the tube: two flickers as it strikes on the first downbeat, then steady
    const db0 = this.downbeats[0] ?? 7.286;
    let box = 1;
    if (t < db0 + 0.3) box = t < this.ctx.start + 0.02 ? 0.03 : t < db0 - 0.03 ? 0.18 : t < db0 + 0.05 ? 1 : t < db0 + 0.12 ? 0.25 : t < db0 + 0.17 ? 0.9 : t < db0 + 0.22 ? 0.4 : 1;
    // BURNING: the tube flares, a hot band through the word; "the nights grow cold": it cools and dims, the teeth faint
    const lyB = this.ctx.lyrics.get('Only thing that');
    const burn = lyB.words[3]!, cold = lyB.words[8]!;
    const over = smoothstep(burn.start - 0.04, burn.start + 0.1, t) * (1 - 0.35 * smoothstep(burn.start + 0.1, burn.end, t)) * (1 - smoothstep(lyB.words[4]!.start, lyB.words[6]!.start, t));
    const cool = smoothstep(lyB.words[6]!.start, cold.end, t) * (1 - smoothstep(13.9, 14.19, t));
    u.overex!.value = over * 0.95;
    if (over > 0) {
      const bp = this.phrases.find((q) => q.words[0] === burn)!;
      const bl = this.layout(bp);
      this.placeCamera(t);
      u.overY!.value = bl.y[0]! + bl.size[0]! * CAP_K * 0.5;
      u.overH!.value = s.w * (9 / 16) * 0.3;
    }
    u.box!.value = box * (1 + over * 0.2) * (1 - 0.22 * cool);
    u.boxCool!.value = cool;
    // the loupe
    (u.loupe!.value as THREE.Vector2).set(960, 540);
    u.loupeR!.value = s.loupe > 0.01 ? lerp(1400, 505, s.loupe) : 0;
    // the tag, carried in, clipped to the film's corner and signed (the monogram's first sighting)
    const tagOn = t >= TAG0;
    u.tagOn!.value = tagOn ? 1 : 0;
    if (tagOn) {
      this.drawTag(t);
      const tc = this.tagAt(t);
      (u.tagRect!.value as THREE.Vector4).set(tc[0], tc[1], TAG_RECT.w, TAG_RECT.h);
    }
    // the glove's pen
    const h = this.hand(t);
    u.handOn!.value = h ? 1 : 0;
    if (h) {
      const c = Math.cos(h.tilt), sn = Math.sin(h.tilt);
      const hx = Math.cos(h.head), hy = Math.sin(h.head);
      const e1 = new THREE.Vector3(hx * c, hy * c, sn);
      const e2 = new THREE.Vector3(hy, -hx, 0);
      const e3 = new THREE.Vector3().crossVectors(e1, e2).normalize();
      if (e3.z < 0) e3.negate();
      (u.hTip!.value as THREE.Vector3).set(h.x, h.y, 0.1 + h.z);
      (u.hE1!.value as THREE.Vector3).copy(e1);
      (u.hE2!.value as THREE.Vector3).copy(e2);
      (u.hE3!.value as THREE.Vector3).copy(e3);
    }
    // the fillings: ghosts as the camera pulls back on "yeah", then each comes through in turn, back to the last molar
    const yeah = this.ctx.lyrics.get('Beg you to stay').words[8]!;
    const fk = u.fillK!.value as number[];
    this.fillOrder.forEach((fi, j) => {
      const ti = yeah.start + 0.02 + j * 0.075;
      fk[fi] = t < yeah.start - 0.08 ? 1 : t < ti ? 0.25 : 1 + 0.9 * Math.exp(-(t - ti) / 0.12);
    });
    // the words
    const { rect: r, shake } = this.drawWords(t);
    // a hero's stamp: the tube kicks a little brighter and the frame shakes (restrained: verse 1)
    u.box!.value *= 1 + 0.06 * shake;
    if (r) {
      (u.wordRect!.value as THREE.Vector4).set(r[0], r[1], r[2], r[3]);
      this.wordTex.needsUpdate = true;
    } else (u.wordRect!.value as THREE.Vector4).set(-1e4, -1e4, 1, 1);
    this.pass.render(renderer, out);
    // the corner hold: the bare lightbox stays the brightest thing in frame, edge to edge
    const inCorner = t > 9.7 && t < (this.downbeats.find((d) => d > 10.5) ?? 10.74);
    const sh = kinShake(t, shake * 7);
    return inCorner ? { vignette: 0.1, shake: sh } : { shake: sh };
  }
}
