// Plate 14 `filed` — the outro (174.77 – 204.96, hard stop 200.70), docs/TEETH2.md. Four movements:
//  1 (to 186.85) inside folder 08-32 on the bench: his radiograph, his cast's photograph and his chart turned into it,
//    TEETH across each with the red monogram; the far panel closes over them, the line written on its tab, the last
//    red draining in the closing wedge (filed-desk.ts, DESK_FRAG);
//  2 (to 193.33) the carry along plate 1's cabinet bank and the drop into the drawer on a snare (filed-bank.ts, plate 1's
//    march patched so 08-32 can leave its slot: BANK_FRAG);
//  3 (to 201.9) plate 1's riff mirrored: the folders flick back one per riff note, the dolly carrying the speed, the
//    drawer sliding back to a hand's width on the hard stop, the folders' last swing settling;
//  4 (201.9 –) plate 1 itself at t = 0: the loop frame, rendered by plate 1's own scene, so the last frame is the first.
// Every time is read from the data (beats, kicks, snares, the lyric) except the hard stop (the treatment's 200.70).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT } from '../../engine/gl';
import { clamp, ease, lerp } from '../../engine/util';
import { HIS, TeethTex } from '../teeth';
import Drawer, { type Pose } from './drawer';
import { DOF_FRAG, LAY } from './drawer-glsl';
import { PHOTO_FRAG } from './match-glsl';
import { PHOTO } from './match-ink';
import { buildFilm } from './lightbox-film';
import { buildHis } from './chart-form';
import { drawHisMarks } from './chart-marks';
import { DESK_FRAG, BANK_FRAG } from './filed-glsl';
import { EX_S, exhibits, phiF, deskShots, shotPose, overlay, labelCanvas, TabLyric, type DeskTimes, type Shot, type CamPose } from './filed-desk';
import { riffNotes, gapIndex, swingAmt, folders, drawerOpen, carry, carryPose, mirrorPose, OPEN1, LIFT0, type BankTimes } from './filed-bank';

/** The hard stop (the treatment's; the analysis has no event for it). */
const STOP = 200.7;
/** The folders' and the tab's last swing is gone by here; from here on plate 1 renders its own first frame. */
const SETTLED = STOP + 1.2;

const tex = (cv: HTMLCanvasElement, alpha = false) => {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  void alpha;
  return t;
};

const nearest = (xs: number[], t: number) => xs.reduce((a, x) => (Math.abs(x - t) < Math.abs(a - t) ? x : a), xs[0]!);

export default class Filed extends Scene {
  private desk!: FSPass;
  private bank!: FSPass;
  private dof!: FSPass;
  private photoPass!: FSPass;
  private castRT: THREE.WebGLRenderTarget | null = null;
  private tt!: TeethTex;
  private rt = makeRT();
  private loop!: Drawer;
  private lyric!: TabLyric;
  private lyrTex!: THREE.CanvasTexture;
  private shots: Shot[] = [];
  private DT!: DeskTimes;
  private BT!: BankTimes;
  private notes: number[] = [];
  private go = 0;
  private tilt = new Array<number>(LAY.NF).fill(0);
  private zs = new Array<number>(LAY.NF).fill(0);

  override init() {
    const { audio, lyrics, start, end } = this.ctx;
    // ---------------------------------------------------------------- times from the data
    const i0 = audio.beats.findIndex((b) => b >= start - 0.05);
    const b = (k: number) => audio.beats[i0 + k]!;
    const kicks = audio.onsets.kick!.map((o) => o[0]), snares = audio.onsets.snare!.map((o) => o[0]);
    const lines = lyrics.lines.filter((l) => l.start >= start && l.start < end);
    const teeth = lines.filter((l) => /teeth/i.test(l.text)).map((l) => l.words[0]!.start) as [number, number, number];
    const never = lines.find((l) => /^never/i.test(l.text))!;
    this.go = never.words[5]!.start;
    this.DT = { b, teeth, kickNear: (t) => nearest(kicks, t) };
    this.shots = deskShots(this.DT, never.words[4]!.start);
    const riff0 = nearest(audio.downbeats, b(44));
    this.BT = { b, snare: nearest(snares, b(41)), riff0, intro0: audio.downbeats[0]!, stop: STOP };
    this.notes = riffNotes(this.BT);

    // ---------------------------------------------------------------- the exhibits' prints
    const film = tex(buildFilm(HIS).canvas);
    const chart = tex(buildHis((c) => drawHisMarks(c, HIS)));
    this.tt = new TeethTex(HIS);
    this.photoPass = new FSPass(PHOTO_FRAG, { teethTex: { value: this.tt.texture }, rtRes: { value: new THREE.Vector2() }, seedF: { value: 0 } });
    this.lyric = new TabLyric(never.words.map((w) => ({ w: w.w, start: w.start, end: w.end })));
    this.lyrTex = tex(this.lyric.cv);
    const label = labelCanvas();
    const labelTex = tex(label);

    const V = () => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    // the photo's window on the print (a 6 mm white border)
    const [px, py] = EX_S[1]!;
    const bx = 0.006 / (2 * px), by = (2 * py - (2 * px - 0.012) * (PHOTO.y1 - PHOTO.y0) / (PHOTO.x1 - PHOTO.x0)) / (4 * py);
    this.desk = new FSPass(DESK_FRAG, {
      ssTap: SS_TAP,
      camPos: { value: new THREE.Vector3() }, camR: { value: new THREE.Vector3() }, camU: { value: new THREE.Vector3() },
      camF: { value: new THREE.Vector3() }, tanH: { value: 0.3 },
      exC: { value: V() }, exX: { value: V() }, exY: { value: V() },
      exS: { value: EX_S.map(([x, y]) => new THREE.Vector2(x, y)) },
      exOn: { value: [0, 0, 0] }, exInk: { value: [0, 0, 0] }, exSnap: { value: [0, 0, 0] }, exMono: { value: [1, 1, 1] },
      radTex: { value: film }, castTex: { value: null }, chartTex: { value: chart },
      ov0: { value: tex(overlay(0)) }, ov1: { value: tex(overlay(1)) }, ov2: { value: tex(overlay(2)) },
      labelTex: { value: labelTex }, lyrTex: { value: this.lyrTex },
      castWin: { value: new THREE.Vector4(bx, by, 1 - bx, 1 - by) },
      // the cast sits low in the copy-stand frame: print the part around it (the print's aspect), TEETH above it
      castCrop: { value: new THREE.Vector4(0.12, -0.02, 0.8, 0.66) },
      phiF: { value: 0 }, litK: { value: 4.2 }, ambK: { value: 0.025 },
    });
    // plate 1's march, patched for the carry; plate 1's own defaults (drawer.ts)
    this.bank = new FSPass(BANK_FRAG, {
      ssTap: SS_TAP,
      camPos: { value: new THREE.Vector3() }, camR: { value: new THREE.Vector3() }, camU: { value: new THREE.Vector3() },
      camF: { value: new THREE.Vector3() }, tanH: { value: 0.3 },
      openZ: { value: OPEN1 }, lift08: { value: LIFT0 }, lean08: { value: -0.09 }, tubeI: { value: 1 }, difK: { value: 0.24 }, specK: { value: 1.5 }, louv: { value: 12 }, ambK: { value: 0.002 }, paintK: { value: 0.4 }, chromeR: { value: 0.26 }, ccK: { value: 8 }, ccR: { value: 0.14 },
      ftilt: { value: this.tilt }, fzs: { value: this.zs },
      labelTex: { value: labelTex },
      TA: { value: new THREE.Vector3(...LAY.TA) }, TB: { value: new THREE.Vector3(...LAY.TB) }, labelTexSize: { value: new THREE.Vector2(label.width, label.height) },
      c08off: { value: new THREE.Vector3() }, c08yaw: { value: 0 }, carry08: { value: 0 }, c08zmax: { value: -1e9 },
    });
    this.dof = new FSPass(DOF_FRAG, { src: { value: null }, focusD: { value: 0.5 }, aper: { value: 16 }, maxCoc: { value: 22 } });
    // the loop frame: plate 1 renders it
    this.loop = new Drawer(this.ctx);
    this.loop.init();
  }

  /** His cast's photograph (plate 13's copy-stand shot from above), rendered once. */
  private cast() {
    if (this.castRT) return this.castRT;
    const w = Math.round((PHOTO.x1 - PHOTO.x0) * 15), h = Math.round((PHOTO.y1 - PHOTO.y0) * 15);
    this.castRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false });
    this.tt.set(HIS);
    this.photoPass.u.rtRes!.value.set(w, h);
    this.photoPass.u.seedF!.value = 0;
    this.photoPass.render(this.ctx.renderer, this.castRT);
    return this.castRT;
  }

  private setCam(u: Record<string, THREE.IUniform>, pos: THREE.Vector3, at: THREE.Vector3, fov: number, upHint?: THREE.Vector3) {
    const fw = at.clone().sub(pos).normalize();
    const rt = new THREE.Vector3().crossVectors(fw, upHint ?? new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(rt, fw);
    (u.camPos!.value as THREE.Vector3).copy(pos);
    (u.camF!.value as THREE.Vector3).copy(fw);
    (u.camR!.value as THREE.Vector3).copy(rt);
    (u.camU!.value as THREE.Vector3).copy(up);
    u.tanH!.value = Math.tan((fov * Math.PI) / 360);
    return fw;
  }

  private dofTo(out: THREE.WebGLRenderTarget, focus: number, aper: number) {
    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = focus;
    d.aper!.value = aper;
    this.dof.render(this.ctx.renderer, out);
  }

  // ------------------------------------------------------------------ 1: the desk
  private renderDesk(t: number, out: THREE.WebGLRenderTarget) {
    const u = this.desk.u, T = this.DT;
    u.castTex!.value = this.cast().texture;
    const ex = exhibits(t, T);
    ex.forEach((e, i) => {
      (u.exC!.value as THREE.Vector3[])[i]!.copy(e.c);
      (u.exX!.value as THREE.Vector3[])[i]!.copy(e.x);
      (u.exY!.value as THREE.Vector3[])[i]!.copy(e.y);
      (u.exOn!.value as number[])[i] = e.on ? 1 : 0;
      const w = T.teeth[i]!;
      (u.exInk!.value as number[])[i] = t >= w - 0.045 ? 1 : 0;
      (u.exSnap!.value as number[])[i] = ease.outCubic(clamp((t - w + 0.01) / 0.07));
    });
    // the last red, in the closing wedge: drains as the panel shuts
    (u.exMono!.value as number[])[2] = 1 - ease.inOutQuad(clamp((t - T.b(20)) / (this.go - T.b(20))));
    u.phiF!.value = phiF(t, T, this.go);
    if (this.lyric.draw(t)) this.lyrTex.needsUpdate = true;
    const P: CamPose = shotPose(this.shots, t);
    const fw = this.setCam(u, P.pos, P.at, P.fov, P.up);
    this.desk.render(this.ctx.renderer, this.rt);
    this.dofTo(out, P.at.clone().sub(P.pos).dot(fw), P.aper);
  }

  // ------------------------------------------------------------------ 2, 3: the bank
  private renderBank(t: number, out: THREE.WebGLRenderTarget) {
    const u = this.bank.u, T = this.BT, n = this.notes;
    const mirror = t >= T.b(43);
    const cr = carry(t, T);
    const open = mirror ? drawerOpen(t, n, STOP) : OPEN1;
    folders(mirror ? gapIndex(t, n) : LAY.K0832, mirror ? swingAmt(t, n, STOP) : 1, this.tilt, this.zs);
    // 08-32: upright while carried, settling back against the folders behind once it lands
    const K = LAY.K0832, land = clamp((t - T.snare) / 0.32);
    if (cr) this.tilt[K] = cr.tilt;
    else if (land < 1) this.tilt[K] = lerp(0, this.tilt[K]!, ease.outBack(land));
    const zk = open - LAY.FZ0 - K * LAY.FDZ + this.zs[K]!;
    let lift = LIFT0;
    if (!cr && t - T.snare < 0.2) lift += 0.004 * Math.exp(-(t - T.snare) * 25) * Math.abs(Math.sin((t - T.snare) * 60));
    // the carry comes out of the dark end of the bank: the tube's louvre opened up there so the folder reads
    u.louv!.value = mirror ? 12 : lerp(3.5, 12, ease.inOutQuad(clamp((t - T.b(34)) / (T.b(42) - T.b(34)))));
    u.ambK!.value = mirror ? 0.002 : 0.012;
    u.openZ!.value = open;
    u.lift08!.value = lift;
    u.carry08!.value = cr ? 1 : 0;
    const off = u.c08off!.value as THREE.Vector3;
    if (cr) off.set(cr.pos.x, cr.pos.y - (LAY.YR + LIFT0), cr.pos.z - zk); else off.set(0, 0, 0);
    u.c08yaw!.value = cr ? cr.yaw : 0;
    u.c08zmax!.value = cr ? cr.pos.z + 0.3 : -1e9;
    const P: Pose = mirror ? mirrorPose(t, n, STOP) : carryPose(t, T, cr?.pos ?? null);
    const fw = this.setCam(u, P.pos, P.at, P.fov);
    this.bank.render(this.ctx.renderer, this.rt);
    const tab = cr ? cr.pos.clone().add(new THREE.Vector3(LAY.TABX, 0.02, 0)) : new THREE.Vector3(LAY.TABX, LAY.YR + lift + 0.02, zk);
    const focus = P.focus > 0 ? P.focus : P.focus < 0 ? P.at.clone().sub(P.pos).length() : tab.sub(P.pos).dot(fw);
    this.dofTo(out, focus, P.aper);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    if (t < this.DT.b(28)) this.renderDesk(t, out);
    else if (t < SETTLED) this.renderBank(t, out);
    else return this.loop.render({ ...f, t: 0 }, out);
    return {};
  }
}
