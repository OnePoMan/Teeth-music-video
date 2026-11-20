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
// its onset in fixed letter slots.
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
interface Layout { x: number[]; y: number[]; w: number[]; size: number[]; fam: string[]; slots: number[] }
/** One phrase of the karaoke: words (indices into the line), which is the hero, where it sits in film mm. */
interface Phrase { line: Line; words: Word[]; hero: number; t0: number; t1: number; anchor: Anchor; layout?: Layout }
/** The glove's pen: tip (film mm, z toward the camera), heading on the film (rad, y up), tilt above it. */
interface HandPose { x: number; y: number; z: number; head: number; tilt: number }

const HERO_LIGHT = F.archivo(125, 300), HERO_HEAVY = F.archivo(125, 900), SUP_FAM = F.archivo(112, 500);
const CAP_K = 0.715; // Archivo cap height / em
const SIGN0 = 9.9, SIGN1 = 10.45;          // the signature (the type sheet's timing)
const TAG_RECT = { x: FILM.x1 - 34, y: FILM.y1 - 7.6, w: 44, h: 18.5, rot: -0.025 };
const TAG0 = 9.445, TAG1 = 9.86;           // the tag carried in under the glove and clipped
const PEN_HEAD = -0.62, PEN_TILT = 0.62;
/** The signature's unit box on the tag (its px): top-left and size, as the type sheet set it. */
const SIG = { x: 288, y: 252 - 34 - 296 * MONO_H * 0.84, size: 296 };

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
    // on screen from its first word (letters spring ~45 ms early) until the next phrase of the line starts, or the
    // next beat after the line ends
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!, nx = list[i + 1];
      p.t0 = p.words[0]!.start - 0.045;
      if (nx && nx.line === p.line) p.t1 = nx.words[0]!.start - 0.045;
      else {
        const beats = this.ctx.audio.beats;
        p.t1 = beats.find((b) => b > p.line.end + 0.02) ?? p.line.end + 0.4;
        if (nx) p.t1 = Math.min(p.t1, nx.words[0]!.start - 0.045);
      }
    }
    this.phrases = list;
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

  /** Lay a phrase out in film mm on the frame where its hero (or first word) is sung, at its anchor. The hero's letters
   *  get fixed slots (centres, from the heavy cut) so the light-to-heavy snap never reflows them. */
  private layout(p: Phrase): Layout {
    if (p.layout) return p.layout;
    const ref = p.anchor.ref ?? (p.hero >= 0 ? p.words[p.hero]!.start + 0.12 : p.words[0]!.start + 0.1);
    this.placeCamera(ref);
    const A = p.anchor;
    const [x0, y0] = this.toFilm(A.x, A.y);
    const [x1] = this.toFilm(A.x + 100, A.y);
    const mmPerPx = (x1 - x0) / 100;
    const c = this.wctx;
    const heroCapPx = A.hero ?? 236, supCapPx = A.sup ?? (p.hero >= 0 ? 66 : 92);
    const sizes: number[] = [], fams: string[] = [], widths: number[] = [], slots: number[] = [];
    p.words.forEach((w, i) => {
      const hero = i === p.hero;
      const em = ((hero ? heroCapPx : supCapPx) / CAP_K) * mmPerPx;
      const fam = hero ? HERO_HEAVY : SUP_FAM;
      c.font = font(fam, 100);
      const txt = hero ? w.w.replace(/[,.]/g, '').toUpperCase() : w.w;
      widths.push((c.measureText(txt).width / 100) * em);
      sizes.push(em); fams.push(fam);
      if (hero) for (let k = 0; k < txt.length; k++) slots.push(c.measureText(txt.slice(0, k)).width + c.measureText(txt[k]!).width / 2);
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
    p.layout = { x: xs, y: ys, w: widths, size: sizes, fam: fams, slots };
    return p.layout;
  }

  /** Draw the phrase on screen at t into the word layer (film space) and return the layer's rect (mm). */
  private drawWords(t: number): [number, number, number, number] | null {
    const p = this.phrases.find((q) => t >= q.t0 && t < q.t1);
    const c = this.wctx;
    c.filter = 'none';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.wcv.width, this.wcv.height);
    if (!p) return null;
    const L = this.layout(p);
    // the layer's window around the phrase (2:1)
    let xMin = 1e9, xMax = -1e9, yMin = 1e9, yMax = -1e9;
    L.x.forEach((x, i) => {
      xMin = Math.min(xMin, x); xMax = Math.max(xMax, x + L.w[i]!);
      yMin = Math.min(yMin, L.y[i]! - L.size[i]! * 0.3); yMax = Math.max(yMax, L.y[i]! + L.size[i]! * 0.85);
    });
    const ww = Math.max(xMax - xMin + 8, (yMax - yMin + 8) * 2, 40) * 1.04, wh = ww / 2;
    const wx = (xMin + xMax) / 2 - ww / 2, wy = (yMin + yMax) / 2 - wh / 2;
    const sx = this.wcv.width / ww;
    // film mm -> layer px (y up -> canvas y down)
    c.setTransform(sx, 0, 0, -sx, -wx * sx, (wy + wh) * sx);
    c.fillStyle = '#fff';
    p.words.forEach((w, i) => {
      // nothing on screen more than 0.4 s before it is sung (the ghost comes up 0.3 s ahead)
      if (t < w.start - 0.3) return;
      const hero = i === p.hero;
      const txt = hero ? w.w.replace(/[,.]/g, '').toUpperCase() : w.w;
      // development: a ghost (unsung, 35 %) then clear film, wiped across the word from its onset to 3/4 of it
      const t0 = w.start - 0.045, t1 = w.start + Math.max(0.12, (w.end - w.start) * 0.5);
      const pr = clamp((t - t0) / (t1 - t0));
      const prE = 1 - Math.pow(1 - pr, 3);
      const em = L.size[i]!;
      c.save();
      c.translate(L.x[i]!, L.y[i]!);
      c.scale(em / 100, -em / 100);
      c.textBaseline = 'alphabetic';
      // the hero snaps from light to heavy on its onset, each letter in its fixed slot
      const heavy = !hero || t >= t0;
      const fam = hero ? (heavy ? HERO_HEAVY : HERO_LIGHT) : L.fam[i]!;
      c.font = font(fam, 100);
      const wpx = (L.w[i]! / em) * 100;
      const put = () => {
        // (the heavy cut set the slots, so the heavy word as one run sits exactly in them)
        if (!hero || heavy) { c.fillText(txt, 0, 0); return; }
        // the light cut tracked out so its letters stand in the heavy slots (first and last centred on theirs), one run
        const n = txt.length, wa = c.measureText(txt[0]!).width, wz = c.measureText(txt[n - 1]!).width;
        const ls = n > 1 ? (L.slots[n - 1]! - L.slots[0]! - (c.measureText(txt).width - wa / 2 - wz / 2)) / (n - 1) : 0;
        const cc = c as unknown as { letterSpacing: string };
        cc.letterSpacing = `${ls.toFixed(2)}px`;
        c.fillText(txt, L.slots[0]! - wa / 2, 0);
        cc.letterSpacing = '0px';
      };
      // ghost
      c.globalAlpha = 0.35;
      put();
      if (pr > 0) {
        // the developed part: a soft-edged wipe
        const edge = wpx * prE * 1.06;
        const g = c.createLinearGradient(edge - wpx * 0.06, 0, edge, 0);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = g;
        put();
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#fff';
      }
      c.restore();
    });
    return [wx, wy, ww, wh];
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
    const r = this.drawWords(t);
    if (r) {
      (u.wordRect!.value as THREE.Vector4).set(r[0], r[1], r[2], r[3]);
      this.wordTex.needsUpdate = true;
    } else (u.wordRect!.value as THREE.Vector4).set(-1e4, -1e4, 1, 1);
    this.pass.render(renderer, out);
    // the corner hold: the bare lightbox stays the brightest thing in frame, edge to edge
    const inCorner = t > 9.7 && t < (this.downbeats.find((d) => d > 10.5) ?? 10.74);
    return inCorner ? { vignette: 0.1 } : {};
  }
}
