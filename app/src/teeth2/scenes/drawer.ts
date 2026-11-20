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
//  - the camera: one framing per bar, cut on the downbeats (audio.json), each dollying with the gap through the
//    phrases (it carries the speed) and only creeping in the held chords: bar 1 rises from the loop pose over the
//    drawer as it rolls out (plate 14's mirror echoes this over-the-drawer dolly); bar 2 low and raking from the
//    right along the tabs; bar 3 high from the left, tight on the tab row; bar 4 front-on to 08-32's tab, the gap
//    reaching it on the last two notes;
//  - the last beat (6.855): the glove takes 08-32 by its front rod, lifts it clear and opens it on its fold, the
//    camera tips down into it and whips in (a zoom blur), cutting to plate 2 on the first sung word (7.23).
// Riff notes from the analysed mid-band envelope (data/teeth/audio.json has no `other` onsets for the intro): phrase A
// 0.36 0.79 1.22 1.64 | the chord 2.08, held to 2.94 | phrase B 2.96 3.17 3.60 3.82 4.24 4.67 5.10 | the chord 5.53,
// held to 6.39 | 6.40 6.64 | the last beat 6.855, 7.06.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, hash, lerp, springStep } from '../../engine/util';
import { DOF_FRAG, LAY } from './drawer-glsl';
import { DRAWER_FRAG, WHIP_FRAG } from './drawer-fx';
import { pinch, type HandPose } from './filed-desk';

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
  // clear of the folders in front (their tabs stand to ~YR + 0.03), then held
  return LIFT0 + 0.3 * ease.inOutCubic(clamp((t - T_LIFT) / 0.3));
}
/** 08-32's front panel swung forward on its fold (rad): the glove opens it as it clears the drawer. */
export function open0832(t: number) {
  // the front panel falls open forward like a book's cover, nearly flat: its inside, with the papers, faces the tube
  return 1.3 * ease.outCubic(clamp((t - T_LIFT - 0.09) / 0.24));
}
/** The glove: reaches in after the last flick, takes 08-32's front rod at its right end (6.855), lifts and opens. */
const T_REACH = FLICKS[FLICKS.length - 1]! + 0.03;

/** The downbeats of the plate's four bars (audio.json; these defaults are its values). */
let BAR = [0.38, 2.107, 3.833, 5.56];
/** The whip: from the tip-down to the cut. */
const T_WHIP = T_LIFT + 0.2, T_CUT = 7.23;

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

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function mixPose(a: Pose, b: Pose, u: number): Pose {
  return { pos: a.pos.clone().lerp(b.pos, u), at: a.at.clone().lerp(b.at, u), fov: lerp(a.fov, b.fov, u), focus: u < 0.5 ? a.focus : b.focus, aper: lerp(a.aper, b.aper, u) };
}
/** 08-32's rod z (world). */
const z0832 = (t: number) => drawerOpen(t) - LAY.FZ0 - LAY.K0832 * LAY.FDZ;

export function cameraPose(t: number): Pose {
  if (t <= T_FIRST) return { ...LOOP_POSE, pos: LOOP_POSE.pos.clone(), at: LOOP_POSE.at.clone() };
  // over the drawer, looking down at the gap
  const gi = dollyIndex(t);
  const gz = gapZ(t, gi);
  const YR = LAY.YR;
  if (t >= BAR[1]! && t < BAR[2]!) {
    // bar 2: low from the right, raking along the tabs; a slow creep in through the chord
    const c = (t - BAR[1]!) / (BAR[2]! - BAR[1]!);
    return { pos: v3(0.3 - 0.05 * c, YR + 0.17 - 0.02 * c, gz + 0.27), at: v3(-0.07, YR - 0.045, gz - 0.07), fov: 34, focus: -1, aper: 18 };
  }
  if (t >= BAR[2]! && t < BAR[3]!) {
    // bar 3: high from the left, tight on the tab row
    const c = (t - BAR[2]!) / (BAR[3]! - BAR[2]!);
    return { pos: v3(-0.31 + 0.04 * c, YR + 0.27 - 0.03 * c, gz + 0.17), at: v3(0.03, YR - 0.035, gz - 0.07), fov: 30, focus: -1, aper: 16 };
  }
  if (t >= BAR[3]!) {
    // bar 4: front-on to 08-32's tab, pushing in through the chord; on the last beat up and over it, then the whip
    const z = z0832(t), c = ease.inOutQuad(clamp((t - BAR[3]!) / (T_LIFT - BAR[3]!)));
    const D: Pose = { pos: v3(0.01 - 0.03 * c, YR + 0.28 - 0.02 * c, z + 0.37 - 0.08 * c), at: v3(-0.04, YR - 0.005, z - 0.06), fov: 30, focus: 0, aper: 18 };
    if (t <= T_LIFT) return D;
    const lf = lift0832(t);
    // over the opened folder: its front panel lying open toward the camera, the papers in it under the tube
    const E: Pose = { pos: v3(0.03, YR + lf + 0.33, z + 0.44), at: v3(0.0, YR + lf - 0.19, z + 0.16), fov: 34, focus: -1, aper: 12 };
    let p = mixPose(D, E, ease.inOutCubic(clamp((t - T_LIFT) / (T_WHIP - T_LIFT))));
    if (t > T_WHIP) {
      const W: Pose = { pos: v3(0.0, YR + lf - 0.02, z + 0.24), at: v3(0.0, YR + lf - 0.19, z + 0.16), fov: 24, focus: -1, aper: 10 };
      p = mixPose(p, W, ease.inCubic(clamp((t - T_WHIP) / (T_CUT - T_WHIP))));
    }
    return p;
  }
  const over: Pose = {
    pos: new THREE.Vector3(-0.1, LAY.YR + 0.38, gz + 0.36),
    at: new THREE.Vector3(0.01, LAY.YR - 0.016, gz - 0.02),
    fov: 38, focus: -1, aper: 14,
  };
  const u = ease.inOutCubic(clamp((t - T_FIRST) / 0.5));
  const p: Pose = {
    pos: LOOP_POSE.pos.clone().lerp(over.pos, u),
    at: LOOP_POSE.at.clone().lerp(over.at, u),
    fov: lerp(LOOP_POSE.fov, over.fov, u), focus: u < 0.5 ? 0 : -1, aper: lerp(LOOP_POSE.aper, over.aper, u),
  };
  return p;
}

/** The glove at t, holding 08-32's front rod at its right end (the folder's tilt a, its rod at (0, y, z)). */
function handPose(t: number, a: number, y: number, z: number): HandPose | null {
  if (t < T_REACH || t > T_CUT) return null;
  const o = open0832(t), HB = 0.236, th = 0.0045;
  // the folder frame to world (the inverses of the shader's tiltYZ by the panel's opening, then the folder's tilt)
  const un = (v: THREE.Vector3, ang: number) => v3(v.x, Math.cos(ang) * v.y - Math.sin(ang) * v.z, Math.sin(ang) * v.y + Math.cos(ang) * v.z);
  const dir = (v: THREE.Vector3) => un(un(v, o), a);
  const corner = un(v3(0.1855, HB + 0.0015, th * 0.5), o).add(v3(0, -HB, 0));
  const pt = un(corner, a).add(v3(0, y, z));
  const h = pinch(pt, v3(1, 0, 0), dir(v3(0, 1, 0)), 0.1);
  // the reach: in from the right and above, landing on the rod at the lift
  const r = 1 - ease.outCubic(clamp((t - T_REACH) / (T_LIFT - T_REACH)));
  h.tip.add(v3(0.3 * r, 0.14 * r, 0.06 * r));
  return h;
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
  private whip!: FSPass;
  private rt = makeRT();
  private rt2: THREE.WebGLRenderTarget | null = null;
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

    // the bars' downbeats from the data (the plate's window: the first four)
    const db = this.ctx.audio.downbeats.filter((d) => d < 7.0);
    if (db.length >= 4) BAR = db.slice(0, 4);
    this.march = new FSPass(DRAWER_FRAG, {
      ssTap: SS_TAP,
      camPos: { value: new THREE.Vector3() }, camR: { value: new THREE.Vector3() }, camU: { value: new THREE.Vector3() },
      camF: { value: new THREE.Vector3() }, tanH: { value: 0.3 },
      openZ: { value: OPEN0 }, lift08: { value: LIFT0 }, lean08: { value: LEAN0 }, tubeI: { value: 1 }, difK: { value: 0.24 }, specK: { value: 1.5 }, louv: { value: 12 }, ambK: { value: 0.002 }, paintK: { value: 0.4 }, chromeR: { value: 0.26 }, ccK: { value: 8 }, ccR: { value: 0.14 },
      ftilt: { value: this.tilt }, fzs: { value: this.zs },
      labelTex: { value: this.label },
      TA: { value: new THREE.Vector3(...LAY.TA) }, TB: { value: new THREE.Vector3(...LAY.TB) }, labelTexSize: { value: new THREE.Vector2(cw, ch) },
      // plate 14's carry (unused here) and the shared glove; 08-32's opening
      c08off: { value: new THREE.Vector3() }, c08yaw: { value: 0 }, carry08: { value: 0 }, c08zmax: { value: -1e9 },
      hTip: { value: new THREE.Vector3() }, hE1: { value: new THREE.Vector3(1, 0, 0) }, hE2: { value: new THREE.Vector3(0, 1, 0) },
      hE3: { value: new THREE.Vector3(0, 0, 1) }, handOn: { value: 0 }, penOn: { value: 0 }, open08: { value: 0 },
    });
    this.whip = new FSPass(WHIP_FRAG, { src: { value: null }, k: { value: 0 }, ctr: { value: new THREE.Vector2(0.5, 0.5) } });
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
    const K = LAY.K0832, o8 = open0832(t);
    u.open08!.value = o8;
    const hp = handPose(t, this.tilt[K]!, LAY.YR + lift0832(t), drawerOpen(t) - LAY.FZ0 - K * LAY.FDZ + this.zs[K]!);
    u.handOn!.value = hp ? 1 : 0;
    if (hp) {
      (u.hTip!.value as THREE.Vector3).copy(hp.tip);
      (u.hE1!.value as THREE.Vector3).copy(hp.e1);
      (u.hE2!.value as THREE.Vector3).copy(hp.e2);
      (u.hE3!.value as THREE.Vector3).copy(hp.e3);
    }
    // the glove and the opened panel reach out of the drawer's front: march from the camera
    u.c08zmax!.value = hp || o8 > 0 ? 1e9 : -1e9;
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
    const wk = 0.2 * ease.inQuad(clamp((t - T_WHIP) / (T_CUT - T_WHIP)));
    if (wk > 0) {
      this.rt2 ??= makeRT();
      this.dof.render(renderer, this.rt2);
      this.whip.u.src!.value = this.rt2.texture;
      this.whip.u.k!.value = wk;
      this.whip.render(renderer, out);
    } else this.dof.render(renderer, out);
    // the Teeth look (grain, cold halation, vignette, CA) comes from the timeline; the march keeps every value under
    // its bloom threshold, so nothing here glows
    return {};
  }
}
