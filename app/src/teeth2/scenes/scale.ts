// Plate 5 `scale` — chorus 1, first half (48.73 – 62.54), docs/TEETH2.md. Bite-mark photography and the first stomp,
// shot as a BLACK-AND-WHITE forensic photograph (cold silver and film greys, a hard flash, true blacks; the only
// colour in the plate is SWEET's wax when it is bitten). An apple stands stem up, one leaf on the stem, on film-black
// velvet, ONE BITE taken out of its flank (a crescent scooped into the white flesh, its rim scalloped by his incisal
// edges with #8's chip a notch in the scallop, his incisors' grooves dragged down the scoop's wall, the lowers' short
// scrapes below; teeth.ts biteMark(HIS)). An ABFO No. 2 scale stands on the cloth beside it, facing the copy camera,
// its sticker the plate's one readable label (08-32 · EXHIBIT 4). The stomp is the shutter: every beat a flash, every
// flash a new photograph, a new camera each time (the exhibit at 3/4, the bite in profile, macro on the bitten rim, the
// ruler's edge, the scale's corner, the chip), never framing the bite frontally (two opposing arcs read as a mouth).
//
// The hero words are bitten OUT of the apple's other flank: letter-shaped cavities into the flesh, Archivo condensed
// black built from tooth-width scallop bites, the letter over #8's position chipped; a 3/4 macro so the skin curves
// away and the cavities show depth (scale-bite.ts). A hero shot cuts on the word's onset (45 ms ahead) when the beat
// lands just after it; the word stays until the line leaves (the next beat after its end). The flash: the scene's
// light overshoots as the shutter fires and exposure kicks (multiplicative: blacks stay black).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, hash, pulse } from '../../engine/util';
import { DOF_FRAG, LAY, MARCH_FRAG } from './scale-glsl';
import { bakeWord, toothSpans } from './scale-bite';

const LABEL = '08-32 · EXHIBIT 4';

/** The hero words, by line (docs/TEETH2.md, plate 5). [line search text, word index in the line]. */
const HEROES: [string, number][] = [
  ['Fight so dirty', 2], ['Fight so dirty', 7],
  ['Talk so pretty', 2], ['Talk so pretty', 7],
  ['Late night devil', 2], ['Late night devil', 5],
  ['And never, never', 1], ['And never, never', 6],
];

type Kind = 'wide' | 'oblique' | 'ruler' | 'profile' | 'macro' | 'rake' | 'corner' | 'chip';
/** One camera per beat (the hero beats are 'rake'), designed in order so nothing repeats. */
const KINDS: Kind[] = [
  'wide', 'ruler', 'rake', 'profile', 'oblique', 'macro', 'rake', 'corner',
  'wide', 'macro', 'rake', 'profile', 'oblique', 'ruler', 'rake', 'chip',
  'oblique', 'macro', 'rake', 'corner', 'rake', 'profile', 'wide', 'ruler',
  'rake', 'macro', 'oblique', 'chip', 'profile', 'wide', 'corner', 'rake',
];

interface Hero { word: string; start: number; cut: number; leave: number; tex: THREE.DataTexture; wax: boolean; chip: [number, number] }
interface Shot { i: number; t0: number; t1: number; kind: Kind; hero: number }
type Pose = { pos: THREE.Vector3; at: THREE.Vector3; fov: number; roll: number; aper: number; focus: THREE.Vector3 };
type Light = { pos: THREE.Vector3; I: number; rad: number; fillDir: THREE.Vector3; fill: number; cone?: number; coat?: number };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

const AC = V(...LAY.AC);
/** A frame on the apple's flank at azimuth az (from +Z toward +X) and height h over its centre: the skin point C,
 *  its outward normal N (horizontal), its tangent T (to the right, seen from outside). */
function flank(az: number, h: number) {
  const N = V(Math.sin(az), 0, Math.cos(az)), T = V(Math.cos(az), 0, -Math.sin(az));
  // the body without its noise and wells (scale-glsl.ts appleBody): bisect outward along N
  const c = Math.cos(LAY.AROT), s = Math.sin(LAY.AROT);
  const body = (p: THREE.Vector3) => {
    const qx = p.x - AC.x, qy = p.y - AC.y, qz = p.z - AC.z;
    const lx = c * qx + s * qy, ly = -s * qx + c * qy;
    const hh = ly / LAY.AH;
    const rad = LAY.AR * (1 + 0.08 * hh - 0.06 * hh * hh) - 6.5 * Math.max(-hh, 0) ** 2;
    return Math.hypot(Math.hypot(lx, qz), (ly * LAY.AR) / LAY.AH) - rad;
  };
  const at = (k: number) => AC.clone().add(V(0, h, 0)).addScaledVector(N, k);
  let lo = 0, hi = 60;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (body(at(m)) > 0) hi = m; else lo = m; }
  return { C: at(lo), N, T };
}
/** The bite (its crescent faces right-front), the word (on the left-front flank). */
const BITE = flank(LAY.BAZ, LAY.BH);
const WORDF = flank(LAY.WAZ, LAY.WH);
/** The copy camera's azimuth for the exhibit: the bite seen at 3/4 on the apple's right, its crescent in the outline. */
const CAZ = LAY.BAZ - 1.08;
const DC = V(Math.sin(CAZ), 0, Math.cos(CAZ)), RC = V(Math.cos(CAZ), 0, -Math.sin(CAZ));
/** The scale: standing on the cloth to the right of the apple (beside the bite), its face to the copy camera. */
const SO = AC.clone().addScaledVector(RC, 47).addScaledVector(DC, -6).setY(0);
/** A direction at azimuth az (from +Z toward +X) and elevation el. */
const dirAz = (az: number, el: number) => V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
/** A point on a flank frame at (X right, Y up) mm, `out` along its normal, the skin's sag allowed for. */
function onF(F: { C: THREE.Vector3; N: THREE.Vector3; T: THREE.Vector3 }, X: number, Y: number, out = 0) {
  const sag = (X * X + Y * Y) / (2 * LAY.AR);
  return F.C.clone().addScaledVector(F.T, X).addScaledVector(UP, Y).addScaledVector(F.N, out - sag);
}

/** Look-development overrides from the page URL (render.ts --query sc_cam=...): sc_<name>=v1,v2,... */
const QP = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
function qv(name: string): number[] | null {
  const s = QP?.get('sc_' + name);
  return s ? s.split(',').map(Number) : null;
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, mips = false) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const tex = new THREE.CanvasTexture(cv);
  tex.generateMipmaps = mips;
  tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export default class ScalePlate extends Scene {
  private march!: FSPass;
  private dof!: FSPass;
  private rt = makeRT();
  private empty!: THREE.DataTexture;
  private heroes: Hero[] = [];
  private shots: Shot[] = [];
  private c8: [number, number] = [4.2, 12.5];

  override init() {
    const { lyrics, audio } = this.ctx;
    // the case sticker: Plex Mono, ink on transparent (the paper is shaded in the march); 29.8 x 8 mm
    const label = canvasTex(2048, Math.round((2048 * 8) / 29.8), (c) => {
      const fam = F.mono(500);
      let size = 200;
      c.font = font(fam, size);
      size = (size * 2048 * 0.86) / c.measureText(LABEL).width;
      c.font = font(fam, size);
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(LABEL, 1024, c.canvas.height * 0.52);
    });
    // the scale's cm numerals: Plex Mono digits, one per cell (64 x 106 px)
    const digits = canvasTex(640, 106, (c) => {
      c.font = font(F.mono(500), 128);
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (let k = 0; k < 10; k++) c.fillText(String(k), 32 + k * 64, 58, 60);
    }, true);

    const spans = toothSpans();
    const s8 = spans.upper.find((s) => s[3] === 8)!;
    this.c8 = [s8[0]!, LAY.SCY + 11];
    const v4 = (a: number[][]) => a.map((s) => new THREE.Vector4(s[0], s[1], s[2], s[3]));
    const e = new THREE.DataTexture(new Uint16Array([THREE.DataUtils.toHalfFloat(6)]), 1, 1, THREE.RedFormat, THREE.HalfFloatType);
    e.needsUpdate = true;
    this.empty = e;

    // the cuts: every beat in the window; a hero word's beat moves to its onset (45 ms ahead) when it lands just after
    const beats = audio.beats.filter((b) => b >= this.ctx.start - 0.01 && b < this.ctx.end - 0.01);
    const cuts = beats.slice();
    for (const [line, wi] of HEROES) {
      const l = lyrics.get(line);
      const w = l.words[wi]!;
      const j = beats.findIndex((b) => b >= w.start - 0.12 && b <= w.start + 0.2);
      const cut = w.start - 0.045;
      if (j >= 0) cuts[j] = cut;
      const leave = beats.find((b) => b > l.end + 0.01) ?? this.ctx.end;
      const word = w.w.replace(/[^A-Za-z]/g, '');
      const wax = word.toLowerCase() === 'sweet';
      const bw = bakeWord(word, wax);
      this.heroes.push({ word, start: w.start, cut, leave, tex: bw.tex, wax, chip: bw.chip });
    }
    for (let k = 0; k + 1 < this.heroes.length; k++) this.heroes[k]!.leave = Math.min(this.heroes[k]!.leave, this.heroes[k + 1]!.cut);
    this.shots = cuts.map((t0, i) => ({
      i, t0, t1: cuts[i + 1] ?? this.ctx.end, kind: KINDS[i % KINDS.length]!,
      hero: this.heroes.findIndex((h) => Math.abs(h.cut - t0) < 1e-3),
    }));
    for (const s of this.shots) if (s.hero >= 0) s.kind = 'rake';

    this.march = new FSPass(MARCH_FRAG, {
      ssTap: SS_TAP,
      camPos: { value: V(0, 0, 0) }, camR: { value: V(0, 0, 0) }, camU: { value: V(0, 0, 0) }, camF: { value: V(0, 0, 0) },
      tanH: { value: 0.3 },
      keyPos: { value: V(0, 0, 0) }, keyDir: { value: V(0, -1, 0) }, keyI: { value: 1 }, keyRad: { value: 10 }, keyCone: { value: 0.8 },
      fillDir: { value: V(0, 1, 0) }, fillI: { value: 0.02 },
      wordTex: { value: this.empty }, labelTex: { value: label }, digitTex: { value: digits },
      wordAmt: { value: 0 }, wordWax: { value: 0 }, coatK: { value: 1 },
      BC: { value: BITE.C }, BN: { value: BITE.N }, BT: { value: BITE.T },
      WC: { value: WORDF.C }, WN: { value: WORDF.N }, WT: { value: WORDF.T },
      SO: { value: SO }, SN: { value: DC }, SU: { value: RC },
      upT: { value: v4(spans.upper) }, loT: { value: v4(spans.lower) },
    });
    this.dof = new FSPass(DOF_FRAG, { src: { value: null }, focusD: { value: 100 }, aper: { value: 10 }, maxCoc: { value: 18 } });
  }

  private shotAt(t: number): Shot {
    let s = this.shots[0]!;
    for (const x of this.shots) if (x.t0 <= t + 1e-6) s = x;
    return s;
  }

  /** The hero word in the bite at t (or -1), and how far it has bitten in (0..1). */
  private heroAt(t: number): [number, number] {
    for (let k = 0; k < this.heroes.length; k++) {
      const h = this.heroes[k]!;
      if (t >= h.cut && t < h.leave) {
        // the jaw closes: the letters press in over ~50 ms from the cut, a hair past full, settling
        const u = clamp((t - h.cut) / 0.05);
        return [k, u >= 1 ? 1 : ease.outBack(u, 1.2)];
      }
    }
    return [-1, 0];
  }

  /** The camera and the flash for a shot at local progress u (0..1) through it. */
  private pose(s: Shot, u: number): { P: Pose; L: Light } {
    const h1 = hash(s.i, 1.7), h2 = hash(s.i, 5.3), h3 = hash(s.i, 9.1);
    const B = BITE.C;
    let P: Pose, L: Light;
    const fill = (d: THREE.Vector3, f: number) => ({ fillDir: d.clone().normalize(), fill: f });
    const flashOn = (pos: THREE.Vector3, at: THREE.Vector3, I: number, rad = 5): Light => ({
      // the flash on the camera, a hand above the lens
      pos: pos.clone().addScaledVector(UP, 16), I, rad, ...fill(pos.clone().sub(at), 0.0),
    });
    switch (s.kind) {
      case 'wide': {
        // the exhibit at 3/4: the apple with its bite in the outline on the right, the scale beside it, the sticker
        const at = AC.clone().addScaledVector(RC, 30 + 8 * (h1 - 0.5)).add(V(0, -2 + 4 * h2, 0));
        const pos = at.clone().addScaledVector(dirAz(CAZ + 0.18 * (h2 - 0.5), 0.22 + 0.12 * h3), 300 + 40 * h1);
        P = { pos, at, fov: 24, roll: (h3 - 0.5) * 0.1, aper: 2.5, focus: B };
        L = flashOn(pos, at, 0.85);
        break;
      }
      case 'oblique': {
        const at = AC.clone().add(V(0, 0, 0));
        const pos = at.clone().addScaledVector(dirAz(LAY.BAZ - 0.6 + 1.0 * h1, 0.45 + 0.35 * h2), 260 + 50 * h3);
        P = { pos, at, fov: 26, roll: (h2 - 0.5) * 0.15, aper: 5, focus: B };
        L = flashOn(pos, at, 0.85);
        break;
      }
      case 'ruler': {
        // low along the scale's foot, its ticks running to the apple (soft beyond)
        const at = SO.clone().addScaledVector(RC, 10).setY(14);
        const pos = SO.clone().addScaledVector(RC, 125 + 20 * h1).addScaledVector(DC, 30 + 15 * h2).setY(12 + 10 * h3);
        P = { pos, at, fov: 30, roll: (h3 - 0.5) * 0.15, aper: 24, focus: SO.clone().addScaledVector(RC, 55).setY(12) };
        L = flashOn(pos, at, 0.9, 8);
        break;
      }
      case 'profile': {
        // the bite in profile: its crescent cut out of the outline, the flash raking across its wall
        const at = B.clone().addScaledVector(BITE.N, -10).add(V(0, 2, 0));
        const pos = at.clone().addScaledVector(dirAz(LAY.BAZ - 1.45 + 0.25 * (h1 - 0.5), 0.06 + 0.1 * h3), 170 + 30 * h2);
        P = { pos, at, fov: 20, roll: 0, aper: 10, focus: B };
        L = { pos: at.clone().addScaledVector(dirAz(LAY.BAZ - 0.6, 0.5), 300), I: 1.1, rad: 12, ...fill(pos.clone().sub(at), 0.03) };
        break;
      }
      case 'macro': {
        // macro on the bitten rim at 3/4: the incisors' scallops and their grooves down the wall
        const at = onF(BITE, -4 + 8 * h1, LAY.SCY + 5 + 3 * h2, -4);
        const pos = at.clone().addScaledVector(dirAz(LAY.BAZ - 0.75 + 0.3 * (h3 - 0.5), 0.3 + 0.15 * h1), 90);
        P = { pos, at, fov: 22, roll: (h2 - 0.5) * 0.2, aper: 30, focus: at };
        L = flashOn(pos, at, 0.9, 8);
        break;
      }
      case 'corner': {
        const at = SO.clone().addScaledVector(RC, 9).setY(9);
        const pos = at.clone().addScaledVector(DC, 80 + 15 * h3).addScaledVector(RC, -20 + 10 * h1).add(V(0, 22 + 10 * h2, 0));
        P = { pos, at, fov: 26, roll: (h1 - 0.5) * 0.2, aper: 30, focus: at };
        L = flashOn(pos, at, 0.9, 8);
        break;
      }
      case 'chip': {
        // extreme macro on his chip: the chipped letter of the word bitten in, or #8's notch in the bite's rim
        const hk = this.heroAt(s.t0 + 0.02)[0];
        if (hk >= 0) {
          const c = this.heroes[hk]!.chip;
          const at = onF(WORDF, c[0] + 0.6, c[1] - 1.2, -1.2);
          const pos = at.clone().addScaledVector(dirAz(LAY.WAZ + 0.4 + 0.1 * (h1 - 0.5), 0.14), 44);
          P = { pos, at, fov: 20, roll: (h2 - 0.5) * 0.12, aper: 45, focus: at };
          L = { pos: pos.clone().addScaledVector(UP, 18).addScaledVector(WORDF.T, -14), I: 0.85, rad: 5, ...fill(pos.clone().sub(at), 0.03), coat: 0.3 };
        } else {
          const at = onF(BITE, this.c8[0], this.c8[1], -2);
          const pos = at.clone().addScaledVector(dirAz(LAY.BAZ - 0.6, 0.45), 45);
          P = { pos, at, fov: 20, roll: (h2 - 0.5) * 0.12, aper: 45, focus: at };
          L = flashOn(pos, at, 0.85);
        }
        break;
      }
      case 'rake':
      default: {
        // the hero frame: a 3/4 macro on the flank where the word is bitten out, the skin curving away to the left, a
        // hard flash a little above and left of the lens so each cavity's walls take light on one side
        const at = onF(WORDF, 1.2, 0.2, -1.0);
        const pos = at.clone().addScaledVector(dirAz(LAY.WAZ + 0.42 + 0.06 * (h1 - 0.5), 0.1 + 0.04 * h2), 50);
        P = { pos, at, fov: 24, roll: -0.02 + (h3 - 0.5) * 0.05, aper: 22, focus: onF(WORDF, 0, 0, -0.6) };
        L = { pos: pos.clone().addScaledVector(UP, 24).addScaledVector(WORDF.T, 18), I: 1.15, rad: 9, ...fill(pos.clone().sub(at), 0.05), coat: 0.25 };
        break;
      }
    }
    const push = 0.035 * ease.outCubic(clamp(u));
    P.pos = P.pos.clone().lerp(P.at, push);
    return { P, L };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer } = this.ctx;
    const s = this.shotAt(t);
    const u = (t - s.t0) / Math.max(1e-3, s.t1 - s.t0);
    const { P, L } = this.pose(s, u);
    const qc = qv('cam');
    if (qc) { P.pos.set(qc[0]!, qc[1]!, qc[2]!); P.at.set(qc[3]!, qc[4]!, qc[5]!); P.fov = qc[6] ?? P.fov; }
    const fw = P.at.clone().sub(P.pos).normalize();
    let rt = new THREE.Vector3().crossVectors(fw, UP);
    if (rt.lengthSq() < 1e-6) rt = V(1, 0, 0);
    rt.normalize();
    let up = new THREE.Vector3().crossVectors(rt, fw);
    if (P.roll) { rt = rt.clone().applyAxisAngle(fw, P.roll); up = up.clone().applyAxisAngle(fw, P.roll); }
    const m = this.march.u;
    (m.camPos!.value as THREE.Vector3).copy(P.pos);
    (m.camF!.value as THREE.Vector3).copy(fw);
    (m.camR!.value as THREE.Vector3).copy(rt);
    (m.camU!.value as THREE.Vector3).copy(up);
    m.tanH!.value = Math.tan((P.fov * Math.PI) / 360);
    // the flash: the shutter fires on the cut; the head's output overshoots and settles into the photograph
    const burst = pulse(t, s.t0, 0.02);
    (m.keyPos!.value as THREE.Vector3).copy(L.pos);
    // L.I is the irradiance at the subject: the head sits wherever the shot needs it, inverse-square beyond
    m.keyI!.value = (L.I * L.pos.distanceToSquared(P.at)) / 1e5 * (1 + 0.8 * burst);
    m.keyRad!.value = L.rad;
    (m.keyDir!.value as THREE.Vector3).copy(P.at.clone().sub(L.pos).normalize());
    m.keyCone!.value = L.cone ?? 0.8;
    (m.fillDir!.value as THREE.Vector3).copy(L.fillDir);
    m.fillI!.value = L.fill;
    m.coatK!.value = L.coat ?? 1;
    const [hk, amt] = this.heroAt(t);
    m.wordTex!.value = hk >= 0 ? this.heroes[hk]!.tex : this.empty;
    m.wordAmt!.value = hk >= 0 ? amt : 0;
    m.wordWax!.value = hk >= 0 && this.heroes[hk]!.wax ? 1 : 0;
    this.march.render(renderer, this.rt);

    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = P.focus.clone().sub(P.pos).dot(fw);
    d.aper!.value = qv('aper')?.[0] ?? P.aper;
    this.dof.render(renderer, out);
    // the flash reaches the film as an exposure kick (multiplicative: the blacks stay black)
    return { exposure: 1 + 0.25 * pulse(t, s.t0, 0.025) };
  }
}
