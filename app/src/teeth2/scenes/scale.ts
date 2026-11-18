// Plate 5 `scale` — chorus 1, first half (48.73 – 62.54), docs/TEETH2.md. Bite-mark photography and the first stomp:
// a bitten apple standing on film-black velvet, an L-shaped ABFO No. 2 scale standing on the cloth in the plane of the
// bite beside it, one flash. The stomp is the shutter: every beat a flash, every flash a new photograph, a cut to a new
// camera on every beat (the wide exhibit, the ruler's edge, the bite in profile, macro on the arc, the scale's corner,
// the chip), never cycling. The apple is ray-marched (scale-glsl.ts); the bite is his (teeth.ts biteMark(HIS), the
// chip on #8), baked to distance fields (scale-bite.ts) and sunk into the skin: cut walls, scallops dragged toward the
// bite's centre, white flesh, torn skin edges, the canines as punctures.
//
// The hero words are BITTEN INTO THE APPLE, between his two arcs: Archivo condensed black capitals built from
// tooth-width scallop impressions, landing on a raking-flash macro so their relief reads (DIRTY, SWEET, PRETTY, TEETH;
// DEVIL, HANDS, NEVER, GO; SWEET in Cormorant, its flesh blushing wax). His incisal arc with #8's diagonal notch
// brackets the word in every bite. A hero shot cuts on the word's onset (45 ms ahead) when the beat lands just after
// it, so the bite and its flash are one event; the word stays until the line leaves (the next beat after its end).
// The flash: the scene's light overshoots as the shutter fires and exposure kicks (no grey veil: blacks stay black);
// the first one in the video is on 48.725 (the plate's first frame), an on-axis flash on the wide exhibit.
// One readable label: the case sticker on the scale, 08-32 · EXHIBIT 4.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, hash, pulse } from '../../engine/util';
import { DOF_FRAG, LAY, MARCH_FRAG } from './scale-glsl';
import { bakeMarks, bakeWord } from './scale-bite';

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

interface Hero { word: string; start: number; cut: number; leave: number; tex: THREE.DataTexture; wax: boolean }
interface Shot { i: number; t0: number; t1: number; kind: Kind; hero: number }
type Pose = { pos: THREE.Vector3; at: THREE.Vector3; fov: number; roll: number; aper: number; focus: THREE.Vector3 };
type Light = { pos: THREE.Vector3; I: number; rad: number; fillDir: THREE.Vector3; fill: number; cone?: number; coat?: number };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/** The bite's frame on the apple: its centre on the skin (BC), normal (BN), tangent (BT, photo X). */
const BN = V(Math.sin(LAY.BAZ), 0, Math.cos(LAY.BAZ));
const BT = V(Math.cos(LAY.BAZ), 0, -Math.sin(LAY.BAZ));
const AC = V(...LAY.AC);
const BC = (() => {
  // the body without its noise and wells (scale-glsl.ts appleBody): bisect outward along BN at the bite's height
  const c = Math.cos(LAY.AROT), s = Math.sin(LAY.AROT);
  const body = (p: THREE.Vector3) => {
    const qx = p.x - AC.x, qy = p.y - AC.y, qz = p.z - AC.z;
    const lx = c * qx + s * qy, ly = -s * qx + c * qy;
    const h = ly / LAY.AH;
    const rad = LAY.AR * (1 + 0.08 * h - 0.06 * h * h) - 6.5 * Math.max(-h, 0) ** 2;
    return Math.hypot(Math.hypot(lx, qz), (ly * LAY.AR) / LAY.AH) - rad;
  };
  const at = (k: number) => AC.clone().add(V(0, LAY.BH, 0)).addScaledVector(BN, k);
  let lo = 0, hi = 60;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (body(at(m)) > 0) hi = m; else lo = m; }
  return at(lo);
})();
/** The scale's outer corner: on the cloth, SU0 along the bite's tangent from it, its face just behind the skin. */
const SO = BC.clone().addScaledVector(BT, LAY.SU0).addScaledVector(BN, -LAY.SW0).setY(0);
/** A point in the bite's photo frame (mm), `out` along the bite's normal; the skin curves away (sag) from its centre. */
function bp(X: number, Y: number, out = 0) {
  const sag = (X * X + Y * Y) / (2 * LAY.AR);
  return BC.clone().addScaledVector(BT, X).addScaledVector(UP, Y).addScaledVector(BN, out - sag);
}
/** A point d from `at` in a direction given in the bite's frame (x along BT, y up, z along BN), normalised. */
function from(at: THREE.Vector3, x: number, y: number, z: number, d: number) {
  const v = BT.clone().multiplyScalar(x).addScaledVector(UP, y).addScaledVector(BN, z).normalize();
  return at.clone().addScaledVector(v, d);
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
  private c8: [number, number] = [4.2, 14.3];

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

    const marks = bakeMarks();
    this.c8 = marks.c8;
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
      this.heroes.push({ word, start: w.start, cut, leave, tex: bakeWord(word, wax), wax });
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
      marksTex: { value: marks.tex }, wordTex: { value: this.empty }, labelTex: { value: label }, digitTex: { value: digits },
      wordAmt: { value: 0 }, wordWax: { value: 0 }, coatK: { value: 1 },
      BC: { value: BC }, BN: { value: BN }, BT: { value: BT }, SO: { value: SO },
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
    const B = bp(0, 0);
    let P: Pose, L: Light;
    const fill = (d: THREE.Vector3, f: number) => ({ fillDir: d.clone().normalize(), fill: f });
    switch (s.kind) {
      case 'wide': {
        // the exhibit: the apple, the scale beside the bite, the case sticker; an on-axis flash on the camera, falling
        // off with distance into the velvet
        const at = bp(30 + 10 * (h1 - 0.5), -4 + 4 * h2, -16);
        const pos = from(at, -0.12 + 0.3 * (h2 - 0.5), 0.26 + 0.14 * h3, 1, 205 + 50 * h1);
        P = { pos, at, fov: 27, roll: (h3 - 0.5) * 0.12, aper: 2.5, focus: B };
        L = { pos: pos.clone().addScaledVector(UP, 14), I: 0.55, rad: 5, ...fill(pos.clone().sub(at), 0.0) };
        break;
      }
      case 'oblique': {
        const at = bp(20, -10, -25);
        const pos = from(at, -1.1 + 1.4 * h1, 0.45 + 0.35 * h2, 1, 280 + 60 * h3);
        P = { pos, at, fov: 24, roll: (h2 - 0.5) * 0.15, aper: 5, focus: B };
        L = { pos: from(at, -1.0, 0.9, 0.6, 360), I: 1.5, rad: 18, ...fill(pos.clone().sub(at), 0.02) };
        break;
      }
      case 'ruler': {
        // low along the foot of the scale, its ticks rushing toward the apple (out of focus beyond)
        const at = bp(10, -30, -3);
        const pos = SO.clone().addScaledVector(BT, 115 + 20 * h1).addScaledVector(BN, 26 + 14 * h2).setY(14 + 10 * h3);
        P = { pos, at, fov: 30, roll: (h3 - 0.5) * 0.15, aper: 24, focus: SO.clone().addScaledVector(BT, 60).setY(14) };
        L = { pos: from(B, 0.5, 0.6, 1, 300), I: 1.3, rad: 14, ...fill(V(0, 1, 0), 0.02) };
        break;
      }
      case 'profile': {
        // the bite in profile from its far side: the impressions break the apple's outline, a hard flash from behind
        const at = bp(-4, 0, -6);
        const pos = from(at, -1, 0.05 + 0.08 * h3, 0.25 + 0.35 * h2, 170 + 30 * h1);
        P = { pos, at, fov: 20, roll: 0, aper: 10, focus: B };
        L = { pos: from(at, -0.2, 0.5, -1, 300), I: 2.0, rad: 12, ...fill(pos.clone().sub(at), 0.03) };
        break;
      }
      case 'macro': {
        // macro on the arc with a flat flash beside the lens: the pattern of the bite
        const at = bp(-8 + 16 * h1, -6 + 12 * h2, -1);
        const pos = from(at, -0.4 + 0.8 * h3, -0.2 + 0.5 * h1, 1, 95);
        P = { pos, at, fov: 22, roll: (h2 - 0.5) * 0.3, aper: 40, focus: at };
        L = { pos: pos.clone().addScaledVector(UP, 30), I: 0.32, rad: 14, ...fill(pos.clone().sub(at), 0.02) };
        break;
      }
      case 'corner': {
        // the scale's corner circle sharp, the bite soft behind it
        const at = SO.clone().addScaledVector(BT, 9).setY(10);
        const pos = from(at, -0.5 + 0.4 * h1, 0.25 + 0.3 * h2, 1, 75 + 20 * h3);
        P = { pos, at, fov: 26, roll: (h1 - 0.5) * 0.2, aper: 30, focus: at };
        L = { pos: from(at, -0.8, 0.8, 0.6, 250), I: 1.4, rad: 16, ...fill(V(0, 1, 0), 0.02) };
        break;
      }
      case 'chip': {
        // extreme macro on #8: its diagonal notch in the arc
        const at = bp(this.c8[0] - 1.2, this.c8[1] - 1.0, -0.6);
        const pos = from(at, -0.2 + 0.3 * h1, 0.15, 1, 40);
        P = { pos, at, fov: 20, roll: (h2 - 0.5) * 0.2, aper: 55, focus: at };
        L = { pos: from(at, -1, 0.3, 0.32, 260), I: 2.4, rad: 10, ...fill(pos.clone().sub(at), 0.05) };
        break;
      }
      case 'rake':
      default: {
        // the hero frame: macro on the bite in a raking flash from the left (grazing the skin at ~20 degrees, the scale
        // on the right out of its way); the word between his arcs, the scale's ruler edge framing the right side
        const at = bp(10.0, 1.0, -0.5);
        const pos = from(at, -0.04 + 0.04 * (h1 - 0.5), 0.07 + 0.05 * h2, 1, 88);
        P = { pos, at, fov: 24, roll: -0.02 + (h3 - 0.5) * 0.05, aper: 22, focus: bp(0, 2, -0.3) };
        L = { pos: from(at, -1, 0.3, 0.5, 260), I: 1.05, rad: 22, ...fill(pos.clone().sub(at), 0.1), cone: Math.cos(0.2), coat: 0.12 };
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
    m.keyI!.value = L.I * (1 + 0.8 * burst);
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
