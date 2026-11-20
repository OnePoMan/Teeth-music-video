// Plate 3 `scene` (21.10 - 34.64): "Sometimes you're a stranger in my bed". A top-down shot of an empty, unmade bed under a
// warm bedside lamp (the one warm plate: tungsten) and the investigation's cold work light, which rakes across it from
// a swinging arm. The covers are thrown back along a diagonal fold, one pillow cased and rumpled, the other bare (its case
// is already bagged: plate 5's exhibit); no body shape, no dent, no stain. The words are evidence markers set down on
// the sheet on the bass notes: STRANGER (1), LOVE (2), DEAD (3), PUSH (4), STAY (5), the supporting words as small
// folded cards. On each "push" the focus is pulled away (racked from the near marker to the far edge of the bed; the
// near word dissolves into blur: an optical distance, nothing is shoved). On "stay" the work light's swing lands on STAY,
// the only thing in focus. No flash here (the first flash in the video is the chorus). Every frame is a pure function of t.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT } from '../../engine/gl';
import { clamp, ease, hash, lerp, pulse, smoothstep } from '../../engine/util';
import { T_LIN } from '../palette';
import { DOF_FRAG, HF, HF_FRAG, MARCH_FRAG, NP } from './scene-glsl';
import { HERO_D, HERO_H, SMALL_D, SMALL_H, TAG_D, TAG_H, TAG_W, buildHeroAtlases, buildSmallAtlas, type Rect } from './scene-cards';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const RAD = Math.PI / 180;
const ASPECT = 16 / 9;
const TANH = Math.tan((32 * RAD) / 2);

// ---- the camera: keyed poses, eased into the beats (t, at x, at z, dist, tilt from vertical, phi = screen-up heading) ----
type CamRow = [t: number, ax: number, az: number, d: number, tilt: number, phi: number, ease?: (u: number) => number];
const CUT2 = 29.30; // the second "push": a hard cut to a deeper framing
let CAM: CamRow[] = makeCam(CUT2);
function makeCam(cut: number): CamRow[] {
  return [
    [21.10, -22, 14, 168, 12, -90],
    [21.30, -22, 14, 168, 12, -90],
    [21.80, -8, 31, 108, 18, -90],
    [22.42, -8, 31, 108, 18, -90],
    [22.83, -14, 22, 170, 45, -90],
    [23.50, -14, 22, 170, 45, -90],
    [24.55, -2, 24, 140, 16, -90],
    [25.42, -2, 24, 136, 22, -84],
    [26.28, 0, 24, 122, 28, -98],
    [27.08, 32, 32, 92, 21, -88],
    [27.75, 32, 32, 92, 21, -88],
    [28.01, 16, 28, 70, 62, -180],
    [cut - 0.001, 14, 28, 65, 62, -180],
    [cut, -14, 20, 76, 66, -90],
    [29.73, -14, 19, 74, 66, -90],
    [30.59, -14, 17, 70, 66, -90],
    [31.46, 0, 16, 135, 18, -92],
    [32.17, -4, 31, 80, 20, -90],
    [33.40, -4, 32, 70, 28, -93],
    [33.519, -4, 32, 69, 28, -93],
    [33.52, -6, 30, 76, 46, -88],
    [34.64, -6, 30, 70, 48, -88],
    [34.80, -6, 30, 70, 48, -88],
  ];
}
interface Cam { pos: THREE.Vector3; f: THREE.Vector3; r: THREE.Vector3; u: THREE.Vector3; at: THREE.Vector3; phi: number }
function camAt(t: number): Cam {
  let i = 1;
  while (i < CAM.length - 1 && t > CAM[i]![0]) i++;
  const a = CAM[i - 1]!, b = CAM[i]!;
  const u = clamp((t - a[0]) / (b[0] - a[0]));
  const k = (b[6] ?? ease.inOutCubic)(u);
  const L = (n: number) => lerp(a[n] as number, b[n] as number, k);
  return camFrom(L(1), L(2), L(3), L(4), L(5));
}
function camFrom(ax: number, az: number, d: number, tiltDeg: number, phiDeg: number): Cam {
  const tau = tiltDeg * RAD, phi = phiDeg * RAD;
  const h = V(Math.cos(phi), 0, Math.sin(phi));
  const at = V(ax, 0, az);
  const pos = at.clone().addScaledVector(h, -Math.sin(tau) * d).addScaledVector(V(0, 1, 0), Math.cos(tau) * d);
  const f = h.clone().multiplyScalar(Math.sin(tau)).addScaledVector(V(0, 1, 0), -Math.cos(tau));
  const u = h.clone().multiplyScalar(Math.cos(tau)).addScaledVector(V(0, 1, 0), Math.sin(tau));
  const r = new THREE.Vector3().crossVectors(f, u);
  return { pos, f, r, u, at, phi: phiDeg };
}
/** The point on the plane y = yp seen at screen (sx, sy) (0..1, y down). */
function ground(c: Cam, sx: number, sy: number, yp = 1.0) {
  const d = c.f.clone().addScaledVector(c.r, (2 * sx - 1) * TANH * ASPECT).addScaledVector(c.u, (1 - 2 * sy) * TANH).normalize();
  const t = (yp - c.pos.y) / d.y;
  return c.pos.clone().addScaledVector(d, t);
}

// ---- the evidence markers ----
interface Card {
  slot: number; kind: 0 | 1 | 2; key: string; x: number; z: number; phi: number; yaw: number; sc: number;
  tApp: number; tLand: number; tLeave: number; snap: [number, number][]; // times at which the weight state steps to heavy (with a light dip before)
}
const STR = { x: -8, z: 30 }, LOV = { x: -30, z: 30 }, DED = { x: 32, z: 34 }, STY = { x: -4, z: 30 };
const TAGP = { x: -36, z: 8 };

/** Small-card groups: [line, word indices], the time to read the camera from, the screen anchor, the size, the leave time
 *  (the next beat after the group's last word ends). */
interface Group { line: number; idx: number[]; anchor: number; sx: number; sy: number; sc: number; leave: number }
const GROUPS: Group[] = [
  { line: 0, idx: [0, 1, 2], anchor: 21.80, sx: 0.5, sy: 0.7, sc: 1.4, leave: 22.39 },
  { line: 0, idx: [4, 5, 6], anchor: 22.83, sx: 0.5, sy: 0.82, sc: 2.0, leave: 23.26 },
  { line: 1, idx: [0, 1, 2, 3], anchor: 24.55, sx: 0.5, sy: 0.82, sc: 1.2, leave: 25.42 },
  { line: 1, idx: [5, 6, 7, 8], anchor: 26.28, sx: 0.5, sy: 0.82, sc: 1.2, leave: 26.71 },
  { line: 1, idx: [9], anchor: 27.08, sx: 0.5, sy: 0.82, sc: 1.2, leave: 27.57 },
  { line: 2, idx: [1, 2], anchor: 28.44, sx: 0.38, sy: 0.26, sc: 1.7, leave: 29.30 },
  { line: 2, idx: [4, 5], anchor: 29.73, sx: 0.5, sy: 0.36, sc: 1.7, leave: 30.59 },
  { line: 3, idx: [0, 1, 2, 3], anchor: 32.17, sx: 0.5, sy: 0.82, sc: 1.1, leave: 32.75 },
  { line: 3, idx: [5, 6, 7], anchor: 33.19, sx: 0.5, sy: 0.82, sc: 1.1, leave: 34.05 },
  { line: 3, idx: [9], anchor: 34.2, sx: 0.5, sy: 0.82, sc: 1.1, leave: 99 },
];

const clean = (w: string) => w.replace(/[,.!?]+$/g, '');
const WARM_POS = V(-100, 42, 8);

/** Word onsets the light and the focus are scripted to (read from the lyric data in init). */
const WT = { love: 25.42, dead: 27.14, push1: 28.01, push2: 29.30, stay1: 32.22, stay2: 33.52 };

function lightPose(t: number) {
  // the cold work light on its arm, low and raking: [t, aim x, aim z, s (deg: where it stands relative to the camera, + = camera right), pool radius]
  type LR = [number, number, number, number, number, ((u: number) => number)?];
  const swing = (u: number) => 1 - Math.cos((Math.PI / 2) * u); // released from rest, fastest at the bottom of the arc
  const rows: LR[] = [
    [21.10, -10, 10, 45, 165],
    [21.80, STR.x, STR.z, 28, 78],
    [22.83, -30, 14, 22, 120],
    [23.50, -25, 14, 18, 120],
    [24.55, -4, 26, 26, 118],
    [WT.love, LOV.x, LOV.z, 34, 62],
    [WT.love + 0.53, LOV.x - 22, LOV.z, 14, 64],
    [WT.dead, DED.x, DED.z, -34, 66, swing],
    [27.57, DED.x, DED.z, -34, 66],
    [WT.push1, 4, 28, 20, 86],
    [WT.push2 - 0.04, 4, 28, 20, 86],
    [WT.push2, -12, 20, 30, 92],
    [30.59, -12, 20, 34, 92],
    [WT.stay1 - 0.65, STY.x + 40, STY.z + 10, 30, 190],
  ];
  const phi = camAt(t).phi;
  let ax: number, az: number, sdeg: number, R: number;
  const t0 = WT.stay1 - 0.65;
  if (t >= t0) {
    const u0 = clamp((t - t0) / 0.65), u1 = clamp((t - WT.stay1) / (WT.stay2 - WT.stay1));
    let m = 40 * Math.cos((Math.PI / 2) * u0);
    if (t >= WT.stay1) m = -34 * Math.sin(Math.PI * u1);
    if (t >= WT.stay2) m = 6 * Math.exp(-(t - WT.stay2) / 0.2) * Math.sin((2 * Math.PI * (t - WT.stay2)) / 0.3);
    const dir = V(1, 0, 0.25).normalize();
    ax = STY.x + dir.x * m; az = STY.z + dir.z * m;
    sdeg = 36 - 0.35 * m;
    R = lerp(152, 56, smoothstep(t0, WT.stay1, t));
  } else {
    let i = 1;
    while (i < rows.length - 1 && t > rows[i]![0]) i++;
    const a = rows[i - 1]!, b = rows[i]!;
    const u = (b[5] ?? ease.inOutCubic)(clamp((t - a[0]) / (b[0] - a[0])));
    const L = (n: number) => lerp(a[n] as number, b[n] as number, u);
    ax = L(1); az = L(2); sdeg = L(3); R = L(4) * 0.8;
    if (t >= WT.dead) { // DEAD: the arm overshoots and settles
      const o = 7 * Math.exp(-(t - WT.dead) / 0.3) * Math.sin((Math.PI * (t - WT.dead)) / 0.42);
      ax += o; sdeg += o * 0.8;
    }
  }
  const ang = (phi + 180 - sdeg) * RAD;
  const pos = V(ax + 120 * Math.cos(ang), 54, az + 120 * Math.sin(ang));
  return { pos, aim: V(ax, 0, az), R };
}

export default class BedPlate extends Scene {
  private hfRT = makeRT(HF.w, HF.h, { pxScale: 1, depthBuffer: false });
  private rt = makeRT();
  private hfPass!: FSPass;
  private march!: FSPass;
  private dof!: FSPass;
  private cards: Card[] = [];
  private rectsHero!: Record<string, Rect>;
  private rectsSmall!: Record<string, Rect>;
  private pushFar: [THREE.Vector3, THREE.Vector3] = [V(-40, 0, 28), V(-40, 0, 28)];
  private farEdge: THREE.Vector3 = V(-14, 0, -55);
  private pushNear: [THREE.Vector3, THREE.Vector3] = [V(30, 0, 28), V(0, 0, 30)];

  override init() {
    const { renderer, lyrics } = this.ctx;
    const hero = buildHeroAtlases();
    this.rectsHero = hero.rects;
    // the lyric words of the window, by line start
    const lines = lyrics.lines.filter((l) => l.start >= 21.0 && l.start < 34.6);
    const L = lines.map((l) => l.words);
    const [l1, l2, l3, l4] = [L[0]!, L[1]!, L[2]!, L[3]!];
    WT.love = l2[4]!.start; WT.dead = l2[10]!.start; WT.push1 = l3[0]!.start; WT.push2 = l3[3]!.start; WT.stay1 = l4[4]!.start; WT.stay2 = l4[8]!.start;
    CAM = makeCam(WT.push2);
    const wordsOf = (ws: typeof l1, idx: number[]) => idx.map((i) => ws[i]!);
    const linesOf = [l1, l2, l3, l4];
    const smallWords = new Set<string>();
    const mk = (kind: 0 | 1 | 2, key: string, slot: number, x: number, z: number, phi: number, yaw: number, sc: number, tLand: number, tLeave: number, snaps: number[] = [tLand]): Card => ({
      slot, kind, key, x, z, phi, yaw, sc, tApp: tLand - (kind === 1 ? 0.06 : 0.1), tLand, tLeave, snap: snaps.map((s) => [s, s]),
    });
    // the heroes (the word's onset is the landing; the card is in its unsung state while it falls)
    this.cards.push(mk(0, 'STRANGER', 0, STR.x, STR.z, -90, 11 * RAD, 1, l1[3]!.start, 23.26));
    this.cards.push(mk(0, 'LOVE', 1, LOV.x, LOV.z, -90, -12 * RAD, 1, l2[4]!.start, 27.57));
    this.cards.push(mk(0, 'DEAD', 2, DED.x, DED.z, -90, 11 * RAD, 1, l2[10]!.start, 27.75));
    this.cards.push(mk(0, 'STAY', 4, STY.x, STY.z, -90, -10 * RAD, 1, l4[4]!.start, 99, [l4[4]!.start, l4[8]!.start]));
    // PUSH: set down near the lens on each "push", lifted between (read from the camera of that moment)
    const c1 = camAt(l3[0]!.start), c2 = camAt(l3[3]!.start);
    const p1 = ground(c1, 0.5, 0.78, 0.5), p2 = ground(c2, 0.42, 0.76, 0.5);
    this.cards.push(mk(0, 'PUSH', 3, p1.x, p1.z, c1.phi, 9 * RAD, 0.6, l3[0]!.start, 29.0));
    this.cards.push(mk(0, 'PUSH', 3, p2.x, p2.z, c2.phi, -9 * RAD, 0.6, l3[3]!.start, 30.59));
    this.pushNear = [p1, p2];
    this.cards.push(mk(2, 'TAG', 5, TAGP.x, TAGP.z, -90, 8 * RAD, 1, 20.0, 99, [20.0]));
    // supporting words: small folded cards in a row, anchored to the camera of the moment
    const pending: { g: Group; ws: typeof l1 }[] = [];
    for (const g of GROUPS) {
      const ws = wordsOf(linesOf[g.line]!, g.idx);
      pending.push({ g, ws });
      for (const w of ws) smallWords.add(clean(w.w));
    }
    const sm = buildSmallAtlas([...smallWords]);
    this.rectsSmall = sm.rects;
    let n = 0;
    for (const { g, ws } of pending) {
      const cam = camAt(g.anchor);
      const keys = ws.map((w) => clean(w.w));
      const wcm = keys.map((k) => sm.rects[k]!.faceW * g.sc);
      const gap = 1.8 * g.sc;
      const total = wcm.reduce((a, b) => a + b, 0) + gap * (keys.length - 1);
      const centre = ground(cam, g.sx, g.sy, 1.0);
      const phi = cam.phi * RAD;
      const rh = V(-Math.sin(phi), 0, Math.cos(phi));
      let off = -total / 2;
      ws.forEach((w, i) => {
        const p = centre.clone().addScaledVector(rh, off + wcm[i]! / 2);
        off += wcm[i]! + gap;
        const slot = 6 + (n++ % 6);
        this.cards.push(mk(1, keys[i]!, slot, p.x, p.z, cam.phi, (n % 2 ? 1 : -1) * (0.13 + 0.07 * hash(n, 3.1)), g.sc, w.start, g.leave));
      });
    }
    // the far edge where the focus is racked to: the centres of the "me away" rows
    const rowC = (anchor: number) => ground(camAt(anchor), 0.5, 0.26, 1.0);
    this.pushFar = [rowC(28.44), ground(camAt(29.73), 0.5, 0.36, 1.0)];
    this.farEdge = ground(camAt(29.73), 0.5, 0.14, 1.0);

    this.hfPass = new FSPass(HF_FRAG, { hfLo: { value: new THREE.Vector2(...HF.lo) }, hfSize: { value: new THREE.Vector2(...HF.size) } });
    this.hfPass.render(renderer, this.hfRT);
    const zero4 = () => Array.from({ length: NP }, () => new THREE.Vector4());
    this.march = new FSPass(MARCH_FRAG, {
      ssTap: SS_TAP,
      hfTex: { value: this.hfRT.texture }, heroA: { value: hero.A }, heroB: { value: hero.B }, smallTex: { value: sm.tex },
      hfLo: { value: new THREE.Vector2(...HF.lo) }, hfSize: { value: new THREE.Vector2(...HF.size) },
      camPos: { value: V(0, 0, 0) }, camR: { value: V(0, 0, 0) }, camU: { value: V(0, 0, 0) }, camF: { value: V(0, 0, 0) }, tanH: { value: TANH },
      cPos: { value: V(0, 0, 0) }, cAim: { value: V(0, 0, 0) }, cCol: { value: V(1, 1, 1) }, cRad: { value: 80 },
      wPos: { value: WARM_POS }, wCol: { value: V(1, 0.5, 0.15) },
      PA: { value: zero4() }, PX: { value: zero4() }, PD: { value: zero4() }, PE: { value: zero4() }, PS: { value: zero4() },
      atlasW: { value: 2048 },
    });
    this.dof = new FSPass(DOF_FRAG, { src: { value: null }, focusD: { value: 100 }, aper: { value: 40 }, maxCoc: { value: 26 } });
  }

  /** A card's state at t: lift above the cloth (0 = on it), whether it exists, and its weight snap. */
  private state(c: Card, t: number): { on: boolean; lift: number; snap: number } {
    const dur = c.kind === 1 ? 0.08 : 0.1;
    if (t < c.tApp || t >= c.tLeave + dur) return { on: false, lift: 0, snap: 0 };
    let lift = 0;
    if (t < c.tLand) {
      const u = (t - c.tApp) / (c.tLand - c.tApp);
      lift = 9 * c.sc * (1 - u * u);
    } else {
      const dt = t - c.tLand;
      lift = 0.45 * c.sc * Math.exp(-dt / 0.05) * Math.abs(Math.sin(dt * 46));
    }
    if (t >= c.tLeave) lift = Math.max(lift, (c.kind === 1 ? 5 : 8) * c.sc * ease.inQuad((t - c.tLeave) / dur));
    let snap = 0;
    for (const [s] of c.snap) snap = Math.max(snap, smoothstep(s - 0.0, s + 0.04, t) * (t >= s ? 1 : 0));
    if (c.key === 'STAY') {
      // the second "stay": the weight dips to light just before it and snaps heavy again on the word
      const dip = smoothstep(WT.stay2 - 0.12, WT.stay2 - 0.06, t) * (1 - smoothstep(WT.stay2, WT.stay2 + 0.04, t));
      snap = Math.min(snap, 1 - dip);
    }
    return { on: true, lift, snap };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer } = this.ctx;
    // the camera, with a small thud on each marker set down on a bass note
    let cam = camAt(t);
    let thud = 0;
    for (const c of this.cards) if (c.kind === 0 && c.key !== 'PUSH') thud = Math.max(thud, pulse(t, c.tLand, 0.07));
    if (thud > 0.001) {
      const toward = cam.at.clone().sub(cam.pos).multiplyScalar(0.012 * thud);
      cam = { ...cam, pos: cam.pos.clone().add(toward) };
    }
    const m = this.march.u;
    (m.camPos!.value as THREE.Vector3).copy(cam.pos);
    (m.camF!.value as THREE.Vector3).copy(cam.f);
    (m.camR!.value as THREE.Vector3).copy(cam.r);
    (m.camU!.value as THREE.Vector3).copy(cam.u);

    // lights
    const lp = lightPose(t);
    (m.cPos!.value as THREE.Vector3).copy(lp.pos);
    (m.cAim!.value as THREE.Vector3).copy(lp.aim);
    m.cRad!.value = lp.R;
    (m.cCol!.value as THREE.Vector3).set(0.92, 1.0, 1.1).multiplyScalar(3.0);
    const tl = T_LIN.tungsten; // warm light, desaturated a little toward white: illumination only
    (m.wCol!.value as THREE.Vector3).set(tl[0], tl[1] * 0.88, tl[2] * 0.6).multiplyScalar(3.2);

    // markers
    const PA = m.PA!.value as THREE.Vector4[], PX = m.PX!.value as THREE.Vector4[], PD = m.PD!.value as THREE.Vector4[], PE = m.PE!.value as THREE.Vector4[], PS = m.PS!.value as THREE.Vector4[];
    for (let i = 0; i < NP; i++) PA[i]!.set(0, 0, 0, 0);
    let focusCard: Card | null = null;
    for (const c of this.cards) {
      const s = this.state(c, t);
      if (!s.on) continue;
      const i = c.slot;
      const phi = c.phi * RAD + c.yaw;
      const sc = c.sc;
      let rect: Rect, W: number, D: number, H: number;
      if (c.kind === 0) { rect = this.rectsHero[c.key]!; W = (rect.faceW * sc) / 2; D = HERO_D * sc; H = HERO_H * sc; }
      else if (c.kind === 2) { rect = this.rectsHero.TAG!; W = TAG_W / 2; D = TAG_D; H = TAG_H; }
      else { rect = this.rectsSmall[c.key]!; W = (rect.faceW * sc) / 2; D = SMALL_D * sc; H = SMALL_H * sc; }
      // the tent's base is deeper than a bare card's: keep its front edge where the card's was (no collisions with the chips)
      const sh = c.kind === 2 ? 0 : D * 0.5 - (c.kind === 0 ? 11.45 : 3.51) * sc;
      PA[i]!.set(c.x + Math.cos(phi) * sh, c.z + Math.sin(phi) * sh, s.lift, 1);
      PX[i]!.set(-Math.sin(phi), Math.cos(phi), -Math.cos(phi), -Math.sin(phi));
      PD[i]!.set(W, D, H, c.kind);
      PE[i]!.set(rect.u0, rect.vtop, rect.du, rect.dv);
      PS[i]!.set(s.snap, rect.tpc / (c.kind === 2 ? 1 : sc), 0, 0);
      if (c.kind === 0 && c.key !== 'PUSH' && t >= c.tApp && t < c.tLeave) focusCard = c;
    }
    this.march.render(renderer, this.rt);

    // depth of field: focus on the marker being sung; on each "push" the focus is racked from the near marker to the
    // far edge of the bed, then pulled back for the next
    let fp = cam.at.clone().setY(2);
    let aper = 55;
    if (focusCard) { fp = V(focusCard.x, 4, focusCard.z); aper = focusCard.key === 'STAY' ? lerp(60, 90, smoothstep(32.2, 33.6, t)) : 62; }
    if (t < 21.8) aper = 30;
    if (t >= 22.5 && t < 24.4 && !focusCard) { fp = V(TAGP.x, 1, TAGP.z); aper = 40; }
    if (t >= 28.01 && t < 30.6) {
      aper = 220; this.dof.u.maxCoc!.value = 46;
      if (t < WT.push2 - 0.001) {
        // the first rack: from the near marker out to the chips on the far part of the bed, and back
        const a = this.pushNear[0].clone().setY(3), b = this.pushFar[0].clone().setY(1);
        const k = t < 28.44 ? ease.inOutCubic(clamp((t - 28.01) / 0.43)) : t < 29.0 ? 1 : 1 - ease.inOutCubic(clamp((t - 29.0) / 0.3));
        fp = a.lerp(b, k);
      } else {
        // the second rack, deeper: near marker, the chips as they are sung, then past them to the bed's far edge
        const a = this.pushNear[1].clone().setY(3), c = this.pushFar[1].clone().setY(1), e = this.farEdge.clone().setY(3);
        if (t < 29.73) fp = a.lerp(c, ease.inOutCubic(clamp((t - WT.push2) / 0.43)));
        else if (t < 30.05) fp = c;
        else fp = c.lerp(e, ease.inOutCubic(clamp((t - 30.05) / 0.42)));
      }
    }
    const d = this.dof.u;
    if (!(t >= 28.01 && t < 30.6)) d.maxCoc!.value = 26;
    d.src!.value = this.rt.texture;
    d.focusD!.value = fp.clone().sub(cam.pos).dot(cam.f);
    d.aper!.value = aper;
    this.dof.render(renderer, out);
    return { exposure: 1, halation: 0.08 };
  }
}
