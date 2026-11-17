// Plate 5 `scale` — chorus 1, first half (48.73 – 62.54), docs/TEETH2.md. Bite-mark photography and the first stomp:
// a bitten apple on black velvet, an L-shaped ABFO No. 2 scale beside the bite on its risers, one flash. The stomp is
// the shutter: every beat a flash, every flash a new photograph, a cut to a new camera on every beat (wide on the
// stand, the ruler's edge, the bite in profile, macro on the arc, the scale's corner, the chip), never cycling. The
// apple is ray-marched (scale-glsl.ts); the bite is his (teeth.ts biteMark(HIS), the chip on #8), baked to distance
// fields (scale-bite.ts).
//
// The hero words are BITTEN INTO THE APPLE: on each hero word the upper incisors' marks become its letters (rounded
// incisal bars set on the arc, the letter over #8 chipped at its mesial-incisal corner, so the chip shows as a gap in
// the arc), landing on a raking-flash macro so their relief reads: DIRTY, SWEET, PRETTY, TEETH; DEVIL, HANDS, NEVER,
// GO. A hero shot cuts on the word's onset (45 ms ahead) when the beat lands just after it, so the bite and its flash
// are one event; the word stays bitten in until the line leaves (the next beat after the line's end).
// The flash: in the scene (the light's overshoot as the shutter fires, decaying in ~25 ms) plus a short post flash;
// the first one in the video is on 48.725 (the plate's first frame).
// One readable label: the case sticker on the scale, 08-32 · EXHIBIT 4. The scale's own markings are pattern only.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, hash, pulse } from '../../engine/util';
import { DOF_FRAG, LAY, MARCH_FRAG } from './scale-glsl';
import { bakeMarks, bakeWord, type WordLayout } from './scale-bite';

const LABEL = '08-32 · EXHIBIT 4';

/** The hero words, by line (docs/TEETH2.md, plate 5). [line search text, word index in the line]. */
const HEROES: [string, number][] = [
  ['Fight so dirty', 2], ['Fight so dirty', 7],
  ['Talk so pretty', 2], ['Talk so pretty', 7],
  ['Late night devil', 2], ['Late night devil', 5],
  ['And never, never', 1], ['And never, never', 6],
];

type Kind = 'top' | 'oblique' | 'ruler' | 'profile' | 'macro' | 'rake' | 'corner' | 'chip';
/** One camera per beat (the hero beats are 'rake'), designed in order so nothing repeats. */
const KINDS: Kind[] = [
  'top', 'ruler', 'rake', 'profile', 'oblique', 'macro', 'rake', 'corner',
  'top', 'macro', 'rake', 'profile', 'oblique', 'ruler', 'rake', 'chip',
  'top', 'macro', 'rake', 'corner', 'rake', 'profile', 'oblique', 'ruler',
  'rake', 'macro', 'top', 'chip', 'profile', 'oblique', 'corner', 'rake',
];

interface Hero { word: string; start: number; cut: number; leave: number; tex: THREE.DataTexture; layout: WordLayout }
interface Shot { i: number; t0: number; t1: number; kind: Kind; hero: number }
type Pose = { pos: THREE.Vector3; at: THREE.Vector3; fov: number; roll: number; aper: number; focus: THREE.Vector3; up?: THREE.Vector3 };
/** Screen-up for the overhead views: the photo's up (world -z), tipped a little toward Y. */
const PHOTO_UP = new THREE.Vector3(0, 0.2, -1).normalize();
type Light = { pos: THREE.Vector3; I: number; rad: number; fillDir: THREE.Vector3; fill: number; cone?: number };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** World point on the apple's top at photo (X, Y) mm (an approximation of the body's surface). */
function biteP(X: number, Y: number, below = 0.6) {
  // the body without its noise and cavities (scale-glsl.ts appleBody), tilted by AROT; bisect down from above
  const [ax, ay, az] = LAY.AC, c = Math.cos(LAY.AROT), s = Math.sin(LAY.AROT);
  const z = LAY.BOFF - Y;
  const body = (y: number) => {
    const qx = X - ax, qy = y - ay, qz = z - az;
    const lx = c * qx + s * qy, ly = -s * qx + c * qy;
    const h = lx / LAY.AH, rad = LAY.AR * (1 + 0.04 * h - 0.05 * h * h);
    return Math.hypot(Math.hypot(ly, qz), (lx * LAY.AR) / LAY.AH) - rad;
  };
  let lo: number = ay, hi: number = ay + 60;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (body(m) > 0) hi = m; else lo = m; }
  return V(X, lo - below, z);
}
/** A point at distance `d` from `at` in the direction (azimuth about Y from +Z toward +X, elevation above XZ). */
function orbit(at: THREE.Vector3, az: number, el: number, d: number) {
  return at.clone().add(V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d));
}

/** Look-development overrides from the page URL (render.ts --query sc_cam=...): sc_<name>=v1,v2,... */
const QP = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
function qv(name: string): number[] | null {
  const s = QP?.get('sc_' + name);
  return s ? s.split(',').map(Number) : null;
}

export default class ScalePlate extends Scene {
  private march!: FSPass;
  private dof!: FSPass;
  private rt = makeRT();
  private marks!: THREE.DataTexture;
  private empty!: THREE.DataTexture;
  private label!: THREE.CanvasTexture;
  private heroes: Hero[] = [];
  private shots: Shot[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    // the label sticker: Plex Mono, ink on transparent (the paper is shaded in the march); 29.8 x 8 mm
    const cw = 2048, ch = Math.round((2048 * 8) / 29.8);
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d')!;
    const fam = F.mono(500);
    let size = 200;
    c.font = font(fam, size);
    size = (size * cw * 0.86) / c.measureText(LABEL).width;
    c.font = font(fam, size);
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(LABEL, cw / 2, ch * 0.52);
    this.label = new THREE.CanvasTexture(cv);
    this.label.generateMipmaps = false;
    this.label.minFilter = THREE.LinearFilter;

    this.marks = bakeMarks();
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
      const cut = j >= 0 ? w.start - 0.045 : w.start - 0.045;
      if (j >= 0) cuts[j] = cut;
      const leave = beats.find((b) => b > l.end + 0.01) ?? this.ctx.end;
      const word = w.w.replace(/[^A-Za-z]/g, '');
      const { tex, layout } = bakeWord(word);
      this.heroes.push({ word, start: w.start, cut, leave, tex, layout });
    }
    // a hero leaves when the next one in its line lands
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
      keyPos: { value: V(0, 0, 0) }, keyDir: { value: V(0, -1, 0) }, keyI: { value: 1 }, keyRad: { value: 10 }, keyCone: { value: 0.9 },
      fillDir: { value: V(0, 1, 0) }, fillI: { value: 0.02 },
      marksTex: { value: this.marks }, wordTex: { value: this.empty }, labelTex: { value: this.label },
      wordAmt: { value: 0 }, plainAmt: { value: 1 },
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
    const B = biteP(0, 2);
    let P: Pose, L: Light;
    const fill = (d: THREE.Vector3, f: number) => ({ fillDir: d.normalize(), fill: f });
    switch (s.kind) {
      case 'top': {
        // the copy stand's view: straight down on the exhibit, the scale and its sticker, the velvet
        const at = V(-22 + 44 * h1, 40, -10 + 30 * h2);
        P = { pos: at.clone().add(V(-30 + 60 * h2, 140 + 120 * h3, 18 + 30 * h1)), at, fov: 30 + 10 * h3, roll: (h1 - 0.5) * 1.2, aper: 3, focus: B };
        L = { pos: V(-260, 360, -160 + 120 * h2), I: 1.5, rad: 30, ...fill(V(1, 1, 1), 0.04) };
        break;
      }
      case 'oblique': {
        const at = V(-4, 46, 4);
        const az = 0.5 + 4.4 * h1;
        P = { pos: orbit(at, az, 0.38 + 0.25 * h2, 300 + 60 * h3), at, fov: 24, roll: (h2 - 0.5) * 0.1, aper: 6, focus: B };
        L = { pos: orbit(at, az + 2.0 + h3, 0.75, 400), I: 2.0, rad: 30, ...fill(orbit(V(0, 0, 0), az, 0.4, 1), 0.04) };
        break;
      }
      case 'ruler': {
        // low along an arm of the scale, its ticks rushing to the bite (out of focus beyond)
        const arm2 = h1 > 0.5;
        const ax = LAY.SX0 + LAY.SW / 2, az1 = LAY.SZ0 - LAY.SW / 2;
        const at = arm2 ? V(ax, LAY.SY, -10) : V(0, LAY.SY, az1);
        const pos = arm2 ? V(ax - 3 + 6 * h2, LAY.SY + 9 + 5 * h3, 72) : V(-80, LAY.SY + 9 + 5 * h3, az1 + 3 + 6 * h2);
        P = { pos, at, fov: 30, roll: (h3 - 0.5) * 0.12, aper: 22, focus: arm2 ? V(ax, LAY.SY, 40) : V(-48, LAY.SY, az1) };
        L = { pos: arm2 ? V(120, 140, 40) : V(-20, 160, 220), I: 1.6, rad: 18, ...fill(V(0, 1, 0.3), 0.03) };
        break;
      }
      case 'profile': {
        // the bite in profile: the bitten notch against the dark, a hard flash from behind-side
        const az = (h1 > 0.5 ? 0 : Math.PI) + (h2 - 0.5) * 0.9;
        const at = V(0, 72, 0);
        P = { pos: orbit(at, az, 0.06 + 0.06 * h3, 170 + 30 * h2), at, fov: 20, roll: 0, aper: 10, focus: biteP(0, 0) };
        L = { pos: orbit(at, az + Math.PI * 0.75, 0.45, 300), I: 2.2, rad: 14, ...fill(orbit(V(0, 0, 0), az, 0.3, 1), 0.05) };
        break;
      }
      case 'macro': {
        // macro on the arc with a flat on-axis flash: the pattern of the bite, no relief
        const at = biteP(-6 + 12 * h1, -6 + 10 * h2);
        const pos = orbit(at, -1.6 + 3.2 * h3, 0.95 + 0.4 * h1, 80 + 50 * h2);
        P = { pos, at, fov: 22, roll: (h2 - 0.5) * 0.3, aper: 40, focus: at };
        L = { pos: pos.clone().add(V(0, 40, 0)), I: 0.9, rad: 20, ...fill(V(0, 1, 0), 0.03) };
        break;
      }
      case 'corner': {
        // the scale's corner circle sharp, the bite soft behind it
        const at = V(LAY.SX0 + 14, LAY.SY + 2, LAY.SZ0 - 22);
        const pos = V(-62 + 10 * h1, LAY.SY + 34 + 10 * h2, 72 + 8 * h3);
        P = { pos, at, fov: 26, roll: (h1 - 0.5) * 0.15, aper: 30, focus: V(LAY.SX0 + LAY.SW / 2, LAY.SY, LAY.SZ0 - LAY.SW / 2) };
        L = { pos: V(-200, 170, -60), I: 1.6, rad: 20, ...fill(V(1, 1, 1), 0.03) };
        break;
      }
      case 'chip': {
        // extreme macro on #8: the chipped letter (or the plain #8 mark)
        const hk = this.heroAt(s.t0 + 0.02)[0];
        const c = hk >= 0 ? this.heroes[hk]!.layout.chipAt : ([2.3, 14.2] as [number, number]);
        const at = biteP(c[0] + 1.0, c[1] - 2.0);
        const pos = orbit(at, -0.25 + 0.3 * h1, 1.05, 52);
        P = { pos, at, fov: 20, roll: (h2 - 0.5) * 0.2, aper: 55, focus: at };
        L = { pos: orbit(at, -1.75, 0.2, 260), I: 2.6, rad: 10, ...fill(V(0.3, 1, 0.5), 0.05) };
        break;
      }
      case 'rake':
      default: {
        // the hero frame: macro on the bitten word in a raking flash, so the letters' relief reads. The flash skims
        // the bite from one side (~12 degrees up), the camera a little off the bite's normal, toward the front.
        // the flash comes from behind and right of the bite (the scale's arms lie front and left: nothing in its way)
        const LAZ = [2.5, 1.75, 2.85, 1.95, 1.9, 2.6, 2.05, 2.95];
        const k = Math.max(0, s.hero);
        const at = biteP(-4.0, 8.4, 0.8);
        const az = -0.3 + 0.24 * (h1 - 0.5);
        const pos = orbit(at, az, 1.36 + 0.06 * h2, 60);
        P = { pos, at, fov: 24, roll: -0.02 + (h3 - 0.5) * 0.06, aper: 20, focus: biteP(0, 10, 0.8), up: PHOTO_UP };
        L = { pos: orbit(at, LAZ[k]!, 0.42, 260), I: 1.15, rad: 24, ...fill(pos.clone().sub(at), 0.09), cone: Math.cos(0.15) };
        break;
      }
    }
    // within the photograph the camera settles in a little (eased push toward the subject)
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
    const ql = qv('key');
    if (ql) { L.pos.set(ql[0]!, ql[1]!, ql[2]!); L.I = ql[3] ?? L.I; }
    const fw = P.at.clone().sub(P.pos).normalize();
    let rt = new THREE.Vector3().crossVectors(fw, P.up ?? V(0, 1, 0));
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
    const burst = pulse(t, s.t0, 0.025);
    (m.keyPos!.value as THREE.Vector3).copy(L.pos);
    m.keyI!.value = L.I * (1 + 1.6 * burst);
    m.keyRad!.value = L.rad;
    // the head is aimed at the shot's subject; its beam's half angle (cosine) per shot (wide by default)
    (m.keyDir!.value as THREE.Vector3).copy(P.at.clone().sub(L.pos).normalize());
    m.keyCone!.value = L.cone ?? 0.8;
    (m.fillDir!.value as THREE.Vector3).copy(L.fillDir);
    m.fillI!.value = L.fill;
    const [hk, amt] = this.heroAt(t);
    m.wordTex!.value = hk >= 0 ? this.heroes[hk]!.tex : this.empty;
    m.wordAmt!.value = hk >= 0 ? amt : 0;
    // a hero photograph shows the letters in place of the incisors' plain marks (never both: each photograph is new)
    m.plainAmt!.value = hk >= 0 ? 0 : 1;
    this.march.render(renderer, this.rt);

    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = P.focus.clone().sub(P.pos).dot(fw);
    d.aper!.value = qv('aper')?.[0] ?? P.aper;
    this.dof.render(renderer, out);
    // the flash also reaches the lens: a short white pop over the frame (the first one in the video is at 48.725)
    return { flash: 0.16 * pulse(t, s.t0, 0.02) };
  }
}


