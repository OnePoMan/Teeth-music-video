// Plate 1 `drawer` — the intro riff (0 – 7.23), docs/TEETH2.md. A bank of steel filing cabinets under one cold
// overhead fluorescent tube, ray-marched (drawer-glsl.ts), then a depth-of-field gather; grain, cold halation and
// vignette come from the timeline's shared post (every value here stays under its bloom threshold: nothing glows).
//
// The loop frame (t < 0.36, and plate 14's last frame from 200.70): the second drawer from the top of one cabinet open
// a hand's width,
// its hanging folders inside, folder 08-32 standing proud of the rest, its tab "08-32 · BITE MARK" the plate's one
// readable label. Everything that moves is a function of t, keyed so the loop frame holds until the riff's first note:
//  - drawerOpen(t): a hand's width, then on the first note (0.36) the drawer rolls fully open and stops with a knock;
//  - the folders: the stop swings them forward into two leaning groups with a V-gap 12 folders behind 08-32; on each real riff
//    note the folder in front of the gap flicks back over it, so the gap walks forward one folder per note toward
//    08-32 (12 notes, gap 15 -> 3, 08-32 being the fourth folder from the front), nothing moving in the riff's gaps (2.05–2.94, 5.50–6.39);
//  - the camera: from the loop pose it rises over the drawer as it rolls out, then dollies along the rail with the
//    gap, continuously through each phrase (it carries the speed) and dead still in the gaps; on the last beat
//    (6.855) 08-32 is lifted and the camera tips down into it (blocked in; the whip and the open folder are to come).
// Riff notes from the analysed mid-band envelope (data/teeth/audio.json has no `other` onsets for the intro): phrase A
// 0.36 0.79 1.22 1.64 | the chord 2.08, held to 2.94 | phrase B 2.96 3.17 3.60 3.82 4.24 4.67 5.10 | the chord 5.53,
// held to 6.39 | 6.40 6.64 | the last beat 6.855, 7.06.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, hash, lerp, springStep } from '../../engine/util';
import { DOF_FRAG, LAY, MARCH_FRAG } from './drawer-glsl';

/** The riff's first note: the loop frame holds until here. */
export const T_FIRST = 0.36;
/** Real riff notes that flick a folder (the first note opens the drawer instead). */
export const FLICKS = [0.79, 1.22, 1.64, 2.96, 3.17, 3.6, 3.82, 4.24, 4.67, 5.1, 6.4, 6.64];
/** The riff's held chords: everything stops dead on them until the next phrase. */
export const STOPS: [number, number][] = [[2.08, 2.94], [5.53, 6.39]];
/** The last beat: 08-32 is lifted and the camera tips down into it. */
export const T_LIFT = 6.855;

/** The loop frame's drawer opening (a hand's width) and the full travel. */
const OPEN0 = 0.1, OPEN1 = 0.58;
/** 08-32's lift at the loop frame (it stands proud of the rest) and its lean back. */
const LIFT0 = 0.055, LEAN0 = -0.09;

export function drawerOpen(t: number) {
  if (t <= T_FIRST) return OPEN0;
  // ball-bearing slides: a fast roll, decelerating into the stop, a small knock back off it
  const u = clamp((t - T_FIRST) / 0.36);
  const roll = lerp(OPEN0, OPEN1, ease.outCubic(u));
  const knock = t > T_FIRST + 0.36 ? -0.006 * Math.sin(Math.min(1, (t - T_FIRST - 0.36) / 0.12) * Math.PI) : 0;
  return roll + knock;
}

/** The gap's position: folder index of the first folder behind it (continuous; G0 after the open, 08-32 after the last
 * flick). Each flick takes ~0.11 s and lands dead. */
export function gapIndex(t: number) {
  let g = G0;
  for (const tf of FLICKS) g -= ease.outCubic(clamp((t - tf) / 0.11));
  return g;
}
/** The gap after the open: one folder per flick brings it to 08-32. */
const G0 = LAY.K0832 + FLICKS.length;

/** How far the open's stop has swung the folders into their groups (0 at the loop frame). */
function swing(t: number) {
  const ts = T_FIRST + 0.3;
  return t <= ts ? 0 : springStep(t - ts, 2.2, 0.45);
}

/** Per-folder tilt (rad, + leans the top to the front) and rod shift (m, along z). */
export function folders(t: number, tilt: number[], zs: number[]) {
  const g = gapIndex(t), s = swing(t);
  for (let k = 0; k < LAY.NF; k++) {
    // the loop frame: hanging near plumb, each a little its own way; 08-32 lifted and leaning back on the next
    const rest = k === LAY.K0832 ? LEAN0 : (hash(k, 3.1) - 0.5) * 0.05 + (k === 0 ? 0.03 : 0);
    const back = clamp(k + 1 - g);                // 0: in the front group, 1: flicked back
    const grp = lerp(0.045, -0.2, back);
    tilt[k] = lerp(rest, grp, clamp(s));
    zs[k] = lerp(0, lerp(-0.012, -0.06, back), clamp(s));
  }
}

/** 08-32's lift (m above its rail). */
export function lift0832(t: number) {
  return LIFT0 + 0.14 * ease.inOutCubic(clamp((t - T_LIFT) / 0.3));
}

export type Pose = { pos: THREE.Vector3; at: THREE.Vector3; fov: number; focus: number; aper: number };

/** The loop frame's camera: in front of the bank and to the left of the open drawer, a little above it, looking down
 * at 08-32's tab, the bank receding to the right into the dark. */
export const LOOP_POSE: Pose = {
  pos: new THREE.Vector3(-0.432, 1.283, 0.476),
  at: new THREE.Vector3(-0.019, 1.045, 0.117),
  fov: 33, focus: 0, aper: 22,
};

/** The gap's z (world) at gap index g. */
function gapZ(t: number, g: number) {
  return drawerOpen(t) - LAY.FZ0 - (g - 0.5) * LAY.FDZ;
}

/** The dolly's gap index: continuous through each phrase, still in the riff's gaps. */
function dollyIndex(t: number) {
  // phrase spans (first flick .. last flick + its landing), the index running from one note to the next
  // within a phrase the dolly runs at the phrase's mean speed (linear in time between its first and last flick)
  const phrases: [number, number][] = [[0, 2], [3, 9], [10, 11]];
  for (const [a, b] of phrases) {
    const t0 = FLICKS[a]!, t1 = FLICKS[b]! + 0.11, g0 = G0 - a, g1 = G0 - b - 1;
    if (t >= t0 - 0.43 && t <= t1) {
      // eases in from the previous note's time (it is already moving as the first flick lands)
      const u = clamp((t - (t0 - 0.43)) / (t1 - (t0 - 0.43)));
      return lerp(g0 + 0.5, g1, u * u * (3 - 2 * u) * 0.25 + u * 0.75);
    }
    if (t > t1 && (b === 11 || t < FLICKS[b + 1]! - 0.43)) return g1;
  }
  return G0 + 0.5;
}

export function cameraPose(t: number): Pose {
  if (t <= T_FIRST) return { ...LOOP_POSE, pos: LOOP_POSE.pos.clone(), at: LOOP_POSE.at.clone() };
  // over the drawer, looking down at the gap
  const gi = dollyIndex(t);
  const gz = gapZ(t, gi);
  const over: Pose = {
    pos: new THREE.Vector3(-0.1, LAY.YR + 0.38, gz + 0.36),
    at: new THREE.Vector3(0.01, LAY.YR - 0.016, gz - 0.02),
    fov: 38, focus: -1, aper: 14,
  };
  const u = ease.inOutCubic(clamp((t - T_FIRST) / 0.5));
  let p: Pose = {
    pos: LOOP_POSE.pos.clone().lerp(over.pos, u),
    at: LOOP_POSE.at.clone().lerp(over.at, u),
    fov: lerp(LOOP_POSE.fov, over.fov, u), focus: u < 0.5 ? 0 : -1, aper: lerp(LOOP_POSE.aper, over.aper, u),
  };
  if (t > T_LIFT) {
    // tip down into the lifted folder (blocked in)
    const v = ease.inOutCubic(clamp((t - T_LIFT) / 0.35));
    const z832 = drawerOpen(t) - LAY.FZ0 - LAY.K0832 * LAY.FDZ;
    p = {
      pos: p.pos.clone().lerp(new THREE.Vector3(-0.02, LAY.YR + 0.34, z832 + 0.05), v),
      at: p.at.clone().lerp(new THREE.Vector3(-0.02, LAY.YR + 0.02, z832 - 0.01), v),
      fov: lerp(p.fov, 44, v), focus: 0, aper: p.aper,
    };
  }
  return p;
}

const LABEL = '08-32 · BITE MARK';

/** Look-development overrides from the page URL (render.ts --query dr_cam=...): dr_<name>=v1,v2,... */
const QP = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
function qv(name: string): number[] | null {
  const s = QP?.get('dr_' + name);
  return s ? s.split(',').map(Number) : null;
}

export default class Drawer extends Scene {
  private march!: FSPass;
  private dof!: FSPass;
  private rt = makeRT();
  private label!: THREE.CanvasTexture;
  private tilt = new Array<number>(LAY.NF).fill(0);
  private zs = new Array<number>(LAY.NF).fill(0);

  override init() {
    // 08-32's tab insert, typed: Plex Mono, ink on transparent (the paper is shaded in the march)
    const cw = 2048, ch = Math.round((2048 * LAY.INSH) / LAY.INSW);
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, cw, ch);
    const fam = F.mono(500);
    let size = 200;
    c.font = font(fam, size);
    const w0 = c.measureText(LABEL).width;
    size = (size * cw * 0.9) / w0;
    c.font = font(fam, size);
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    // centred on the insert's visible part (the bottom ~8% sits behind the card's hem); cap height ~0.7 em
    const capH = size * 0.7;
    c.fillText(LABEL, cw / 2, ch * (1 - 0.52) + capH / 2);
    this.label = new THREE.CanvasTexture(cv);
    this.label.generateMipmaps = true;
    this.label.minFilter = THREE.LinearMipmapLinearFilter;
    this.label.magFilter = THREE.LinearFilter;
    this.label.anisotropy = 8;

    this.march = new FSPass(MARCH_FRAG, {
      ssTap: SS_TAP,
      camPos: { value: new THREE.Vector3() }, camR: { value: new THREE.Vector3() }, camU: { value: new THREE.Vector3() },
      camF: { value: new THREE.Vector3() }, tanH: { value: 0.3 },
      openZ: { value: OPEN0 }, lift08: { value: LIFT0 }, lean08: { value: LEAN0 }, tubeI: { value: 1 }, difK: { value: 0.24 }, specK: { value: 1.5 }, louv: { value: 12 }, ambK: { value: 0.002 }, paintK: { value: 0.4 }, chromeR: { value: 0.26 }, ccK: { value: 8 }, ccR: { value: 0.14 },
      ftilt: { value: this.tilt }, fzs: { value: this.zs },
      labelTex: { value: this.label },
      TA: { value: new THREE.Vector3(...LAY.TA) }, TB: { value: new THREE.Vector3(...LAY.TB) }, labelTexSize: { value: new THREE.Vector2(cw, ch) },
    });
    this.dof = new FSPass(DOF_FRAG, {
      src: { value: null }, focusD: { value: 0.5 }, aper: { value: 16 }, maxCoc: { value: 22 },
    });
  }

  /** The plate's own clock for song time t. Plate 14 (filed) can subclass this scene and map its outro onto it
   * (the mirrored riff, and any t <= T_FIRST for the loop frame at 200.70+). */
  protected plateTime(t: number) { return t; }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = this.plateTime(f.t), { renderer } = this.ctx;
    const u = this.march.u;
    const P = cameraPose(t);
    const qc = qv('cam');
    if (qc) { P.pos.set(qc[0]!, qc[1]!, qc[2]!); P.at.set(qc[3]!, qc[4]!, qc[5]!); P.fov = qc[6] ?? P.fov; P.aper = qc[7] ?? P.aper; }
    const fw = P.at.clone().sub(P.pos).normalize();
    const rt = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(rt, fw);
    (u.camPos!.value as THREE.Vector3).copy(P.pos);
    (u.camF!.value as THREE.Vector3).copy(fw);
    (u.camR!.value as THREE.Vector3).copy(rt);
    (u.camU!.value as THREE.Vector3).copy(up);
    u.tanH!.value = Math.tan((P.fov * Math.PI) / 360);
    u.openZ!.value = drawerOpen(t);
    u.lift08!.value = lift0832(t);
    folders(t, this.tilt, this.zs);
    // the tube: steady, flicker-free
    u.tubeI!.value = 1.0;
    for (const k of ['difK', 'specK', 'louv', 'ambK', 'paintK', 'chromeR', 'ccK', 'ccR']) { const q = qv(k); if (q) u[k]!.value = q[0]; }
    const qa = qv('TA'), qb = qv('TB');
    if (qa) (u.TA!.value as THREE.Vector3).set(qa[0]!, qa[1]!, qa[2]!);
    if (qb) (u.TB!.value as THREE.Vector3).set(qb[0]!, qb[1]!, qb[2]!);
    this.march.render(renderer, this.rt);

    // focus on 08-32's tab (its distance along the view axis)
    const tab = new THREE.Vector3(LAY.TABX, LAY.YR + lift0832(t) + 0.02, drawerOpen(t) - LAY.FZ0 - LAY.K0832 * LAY.FDZ);
    const focus = P.focus > 0 ? P.focus : P.focus < 0 ? P.at.clone().sub(P.pos).length() : tab.clone().sub(P.pos).dot(fw);
    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = focus;
    d.aper!.value = P.aper;
    this.dof.render(renderer, out);
    // the Teeth look (grain, cold halation, vignette, CA) comes from the timeline; the march keeps every value under
    // its bloom threshold, so nothing here glows
    return {};
  }
}
