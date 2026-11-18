// Plate 2 `lightbox` (7.23 - 21.10): "Some days you're the only thing I know..." A panoramic radiograph (OPG) of his
// teeth (teeth.ts: HIS, the chip on #8) on a lightbox: cold white behind silver film. The film is drawn once into a
// density map (lightbox-film.ts); this shader develops it: radiopaque enamel and amalgam bright, dentin grey, pulp and
// soft tissue dark, trabecular bone, silver grain, the tube's banding through the diffuser, a slight scatter in the base
// around the clearest areas. The camera is a macro lens tilted a few degrees off the film plane (real depth of field),
// tracking along the jaw and pushing in on downbeats. The sung words are radiopaque: metal in the film, as fillings are,
// developing from a ghost to clear film as they are sung.
// Still for gate 2: t = 9.05 ("know"). Built later (stubs here, simple but not broken): the tube's strike (7.23), BURNING
// overexposing the film, the cooling on "nights grow cold", the loupe to #8, STAY in new fillings. The tag and the
// monogram (9.3 - 10.8) are the lead's.
import * as THREE from 'three';
import { Scene, type Frame } from '../../engine/scene';
import { FSPass, SS_TAP, SS_TAP_GLSL, SCALE } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, smoothstep, lerp } from '../../engine/util';
import type { Line, Word } from '../../engine/lyrics';
import { GLSL_TEETH_PALETTE } from '../palette';
import { HIS, tooth, panoramic } from '../teeth';
import { buildFilm, FILM, FILM_W, FILM_H, type FilmInfo } from './lightbox-film';

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
    float pores = smoothstep(0.35, 0.8, snoise(P * 2.4 + 17.0)) + 0.6 * smoothstep(0.5, 0.9, snoise(P * 5.1 + 3.0));
    float fine = snoise(P * 7.5);
    float web = 0.55 * fib + 0.3 * fib2 * fib2 - 0.45 * pores + 0.2 * fine - 0.35;
    g *= 1.0 + trabK * boneish * 0.2 * web;
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
  // defocus: circle of confusion on the film (mm) from the distance to the focal plane
  float coc = aperture * abs(t - focusT) / t;
  vec2 fuv = (P - filmRect.xy) / filmRect.zw;
  vec2 fw = fwidth(fuv) * vec2(${FILM_W.toFixed(1)}, ${FILM_H.toFixed(1)}) / PX_SCALE;
  float lod = max(log2(max(max(fw.x, fw.y), 1e-4)), log2(max(coc * texPpm, 1e-4)));
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
  float trabK = 1.0 - smoothstep(0.5, 2.5, lod);
  float b = bright(dn, P, trabK);
  // edge contrast (the film's adjacency effect / a processor's sharpening)
  vec3 dB = textureLod(filmTex, fuv, lod + 2.2).rgb;
  float bB = bright(dB, P, 0.0);
  b += 0.38 * (b - bB);
  b = clamp(b, 0.0, 1.0);
  // the sung words: radiopaque, a density in the film like the metal of a filling; it multiplies the film's
  // transmission, so the anatomy under a letter still shows a little through it; soft-edged like the rest of the image
  vec2 wuv = (P - wordRect.xy) / wordRect.zw;
  float wm = 0.0, wmW = 0.0;
  if (all(greaterThan(wuv, vec2(-0.05))) && all(lessThan(wuv, vec2(1.05)))) {
    float wl = max(lod + log2(${WORD_W.toFixed(1)} / wordRect.z / texPpm), 0.0);
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
  b = mix(b, 1.0 - (1.0 - b) * 0.35, overex);
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
  // a lightbox clip at the film's top edge: opaque, so a silhouette against the light, its metal edges catching a
  // little of the room
  vec2 cq = P - vec2(filmRect.x + filmRect.z - 34.0, filmRect.y + filmRect.w + 4.5);
  vec2 cb = abs(cq) - vec2(8.0, 8.0) + 1.5;
  float dClip = length(max(cb, 0.0)) + min(max(cb.x, cb.y), 0.0) - 1.5;
  vec2 jq = cq - vec2(0.0, -8.6); vec2 jb = abs(jq) - vec2(6.4, 1.1) + 0.6;
  dClip = min(dClip, length(max(jb, 0.0)) + min(max(jb.x, jb.y), 0.0) - 0.6);
  float aaC = max(fwidth(dClip) * 1.2, coc * 0.5);
  float onClip = 1.0 - smoothstep(-aaC, aaC, dClip);
  float rim = 1.0 - smoothstep(0.0, 0.5, -dClip);
  vec3 clipCol = T_FILM2 * (0.5 + 0.2 * smoothstep(-9.0, 9.0, cq.y)) + T_SILVER * 0.012 * rim;
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

/** One phrase of the karaoke: words (indices into the line), which is the hero, where it sits in film mm. */
interface Phrase { line: Line; words: Word[]; hero: number; t0: number; t1: number; layout?: { x: number[]; y: number; size: number[]; fam: string[] } }

export default class Lightbox extends Scene {
  private pass!: FSPass;
  private film!: FilmInfo;
  private filmTex!: THREE.CanvasTexture;
  private wcv!: HTMLCanvasElement;
  private wctx!: CanvasRenderingContext2D;
  private wordTex!: THREE.CanvasTexture;
  private cam = new THREE.PerspectiveCamera(VFOV, 16 / 9, 1, 5000);
  private phrases: Phrase[] = [];
  private downbeats: number[] = [];

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
    this.pass = new FSPass(FRAG, {
      filmTex: { value: this.filmTex }, wordTex: { value: this.wordTex },
      invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, res: { value: new THREE.Vector2() },
      filmRect: { value: new THREE.Vector4(FILM.x0, FILM.y0, FILM.x1 - FILM.x0, FILM.y1 - FILM.y0) },
      wordRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      focusT: { value: 160 }, aperture: { value: 12 }, box: { value: 1 }, boxCool: { value: 0 }, overex: { value: 0 }, texPpm: { value: FILM.ppm },
      loupe: { value: new THREE.Vector2() }, loupeR: { value: 0 }, ssTap: SS_TAP,
    });
    this.downbeats = this.ctx.audio.downbeats.filter((d) => d > this.ctx.start - 0.5 && d < this.ctx.end + 0.5);
    this.buildPhrases();
  }

  // ------------------------------------------------------------------ the karaoke phrases
  private buildPhrases() {
    const ly = this.ctx.lyrics;
    const P = (q: string, idx: number[], hero: number) => {
      const line = ly.get(q);
      return { line, words: idx.map((i) => line.words[i]!), hero } as Phrase;
    };
    const L1 = 'Some days you', L2 = 'Only thing that', L3 = 'look away, can', L4 = 'Beg you to stay';
    const list: Phrase[] = [
      P(L1, [0, 1], -1), P(L1, [2, 3, 4], -1), P(L1, [5, 6, 7], 2),
      P(L2, [0, 1, 2], -1), P(L2, [3], 0), P(L2, [4, 5, 6], -1), P(L2, [7, 8], 1),
      P(L3, [0, 1, 2], 2), P(L3, [3, 4, 5], 2),
      P(L4, [0, 1, 2, 3], 3), P(L4, [4, 5, 6, 7], 3), P(L4, [8], -1),
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

  // ------------------------------------------------------------------ the camera
  /** Film point at the centre of view, visible width (mm) and tilt, as a function of time. */
  private camState(t: number): { cx: number; cy: number; w: number; yaw: number; pitch: number; loupe: number } {
    const db = this.downbeats;
    // the track: along the jaw from the patient's right molars toward his left, on the occlusal curve's smile
    // (from the patient's right premolars to the midline by "know", then on toward his left at ~9 mm/s)
    let cx = 2 + 9 * (t - 9.05) - 18 * (1 - smoothstep(7.0, 9.1, t));
    // a push in on each downbeat after the first, eased into it (0.55 s), the width stepping down
    const widths = [140, 120, 100, 88];
    let w = widths[0]!;
    for (let i = 1; i < db.length && i < widths.length; i++) {
      const d = db[i]!;
      const k = ease.inOutCubic(clamp((t - (d - 0.55)) / 0.55));
      w = lerp(w, widths[i]!, k);
    }
    let cy = 0.5 + 0.0021 * cx * cx;
    let loupe = 0;
    // between the lines (9.45 - 10.74): a pan along the film to its top right corner (the ID dot; the tag is clipped
    // there), held until the downbeat, where it cuts back to the jaw
    const tc0 = 9.445, tc1 = db.find((d) => d > 10.5) ?? 10.74;
    if (t >= tc0 && t < tc1) {
      const k = ease.inOutCubic(clamp((t - tc0) / 0.5));
      const drift = (t - tc0) * 1.2;
      cx = lerp(2 + 9 * (tc0 - 9.05), FILM.x1 - 33 + drift, k);
      cy = lerp(0.5, FILM.y1 - 16.5, k);
      w = lerp(120, 74, k);
    }
    // "Can't look away" x2: the loupe pushes in to #8 in two steps
    const t8 = tooth(HIS, 8);
    const p8 = panoramic(HIS).find((p) => p.n === 8)!;
    const tip8 = { x: p8.x - p8.mirror * t8.md * 0.38 * p8.mag, y: p8.y + 2.5 }; // the mesial-incisal corner: the chip
    const L1 = this.ctx.lyrics.get('look away, can');
    const s1 = L1.words[0]!.start, s2 = L1.words[3]!.start;
    const k1 = ease.inOutCubic(clamp((t - (s1 - 0.4)) / 0.4)), k2 = ease.inOutCubic(clamp((t - (s2 - 0.35)) / 0.35));
    if (t > s1 - 0.4 && t < 17.4) {
      cx = lerp(cx, tip8.x, k1); cy = lerp(cy, tip8.y, k1); w = lerp(w, 44, k1);
      w = lerp(w, 21, k2);
      loupe = k1;
    }
    // "Beg you to stay": snap tooth to tooth along the arch to the fillings
    if (t >= 17.4) {
      const stops = [8, 13, 14, 3, 2];
      const ws = this.ctx.lyrics.get('Beg you to stay').words;
      const times = [17.4, ws[3]!.start, ws[7]!.start, ws[8]!.start, ws[8]!.start + 0.3];
      let i = 0;
      while (i < times.length - 1 && t >= times[i + 1]! - 0.12) i++;
      const pt = panoramic(HIS).find((p) => p.n === stops[i])!;
      const prev = panoramic(HIS).find((p) => p.n === stops[Math.max(0, i - 1)])!;
      const k = ease.outCubic(clamp((t - (times[i]! - 0.12)) / 0.12));
      cx = lerp(prev.x, pt.x, i === 0 ? 1 : k); cy = lerp(prev.y, pt.y, i === 0 ? 1 : k) + 10; w = 60;
    }
    const yaw = -0.06 + 0.04 * Math.sin(t * 0.4);
    const pitch = -0.04;
    return { cx, cy, w, yaw, pitch, loupe };
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

  /** Lay a phrase out in film mm: the hero large, centred over the upper roots, the others smaller before it. */
  private layout(p: Phrase) {
    if (p.layout) return p.layout;
    const ref = p.hero >= 0 ? p.words[p.hero]!.start + 0.12 : p.words[0]!.start + 0.1;
    this.placeCamera(ref);
    const [x0, y0] = this.toFilm(960, 200);
    const [x1] = this.toFilm(1060, 200);
    const mmPerPx = (x1 - x0) / 100;
    const c = this.wctx;
    const heroFam = F.archivo(125, 900), supFam = F.archivo(112, 500);
    // sizes in mm (font px at 1 mm = 1 unit)
    const heroCapPx = 250, supCapPx = p.hero >= 0 ? 66 : 92;
    const sizes: number[] = [], fams: string[] = [], widths: number[] = [];
    const capK = 0.715; // Archivo cap height / em
    p.words.forEach((w, i) => {
      const hero = i === p.hero;
      const em = ((hero ? heroCapPx : supCapPx) / capK) * mmPerPx;
      const fam = hero ? heroFam : supFam;
      c.font = font(fam, 100);
      const txt = hero ? w.w.replace(/[,.]/g, '').toUpperCase() : w.w;
      widths.push((c.measureText(txt).width / 100) * em);
      sizes.push(em); fams.push(fam);
    });
    let gap = (supCapPx * 0.42) / capK * mmPerPx;
    let total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    // keep the phrase well inside title-safe (96 px): at most 1520 px wide on the layout frame
    const fit = Math.min(1, (1520 * mmPerPx) / total);
    for (let i = 0; i < widths.length; i++) { widths[i]! *= fit; sizes[i]! *= fit; }
    gap *= fit; total *= fit;
    const xs: number[] = [];
    let x = x0 - total / 2;
    for (let i = 0; i < widths.length; i++) { xs.push(x); x += widths[i]! + gap; }
    p.layout = { x: xs, y: y0 - (heroCapPx / 2) * mmPerPx * fit, size: sizes, fam: fams };
    return p.layout;
  }

  /** Draw the phrase on screen at t into the word layer (film space) and return the layer's rect (mm). */
  private drawWords(t: number): [number, number, number, number] | null {
    const p = this.phrases.find((q) => t >= q.t0 && t < q.t1);
    const c = this.wctx;
    c.filter = "none";
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.wcv.width, this.wcv.height);
    if (!p) return null;
    const L = this.layout(p);
    // the layer's window around the phrase (2:1)
    const xMin = L.x[0]! - 4, xMax = L.x[L.x.length - 1]! + L.size[L.size.length - 1]! * 4 + 4;
    const ww = Math.max(xMax - xMin, 40) * 1.08, wh = ww / 2;
    const wx = (xMin + xMax) / 2 - ww / 2, wy = L.y + Math.max(...L.size) * 0.3 - wh / 2;
    const sx = this.wcv.width / ww;
    // film mm -> layer px (y up -> canvas y down)
    c.setTransform(sx, 0, 0, -sx, -wx * sx, (wy + wh) * sx);
    c.fillStyle = "#fff";
    p.words.forEach((w, i) => {
      const hero = i === p.hero;
      const txt = hero ? w.w.replace(/[,.]/g, '').toUpperCase() : w.w;
      // development: a ghost (unsung, 35 %) then clear film, wiped across the word from its onset to 3/4 of it
      const t0 = w.start - 0.045, t1 = w.start + Math.max(0.12, (w.end - w.start) * 0.5);
      const pr = clamp((t - t0) / (t1 - t0));
      const prE = 1 - Math.pow(1 - pr, 3);
      const em = L.size[i]!;
      c.save();
      c.translate(L.x[i]!, L.y);
      c.scale(em / 100, -em / 100);
      c.font = font(L.fam[i]!, 100);
      c.textBaseline = 'alphabetic';
      const wpx = c.measureText(txt).width;
      // ghost
      c.globalAlpha = 0.35;
      c.fillText(txt, 0, 0);
      if (pr > 0) {
        // the developed part: a soft-edged wipe
        const edge = wpx * prE * 1.06;
        const g = c.createLinearGradient(edge - wpx * 0.06, 0, edge, 0);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = g;
        c.fillText(txt, 0, 0);
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
    u.aperture!.value = 3 + 18 * s.loupe;
    // the tube: two flickers as it strikes on the first downbeat, then steady
    const db0 = this.downbeats[0] ?? 7.286;
    let box = 1;
    if (t < db0 + 0.3) box = t < this.ctx.start + 0.02 ? 0.03 : t < db0 - 0.03 ? 0.18 : t < db0 + 0.05 ? 1 : t < db0 + 0.12 ? 0.25 : t < db0 + 0.17 ? 0.9 : t < db0 + 0.22 ? 0.4 : 1;
    // BURNING: the tube overexposes the film; "the nights grow cold": it cools and dims
    const lyB = this.ctx.lyrics.get('Only thing that');
    const burn = lyB.words[3]!, cold = lyB.words[8]!;
    const over = smoothstep(burn.start - 0.04, burn.end, t) * (1 - smoothstep(lyB.words[4]!.start, lyB.words[6]!.start, t));
    const cool = smoothstep(lyB.words[6]!.start, cold.end, t) * (1 - smoothstep(13.9, 14.19, t));
    u.overex!.value = over * 0.85;
    u.box!.value = box * (1 + over * 0.25) * (1 - 0.42 * cool);
    u.boxCool!.value = cool;
    // the loupe
    (u.loupe!.value as THREE.Vector2).set(960, 540);
    u.loupeR!.value = s.loupe > 0.01 ? lerp(1400, 470, s.loupe) : 0;
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
