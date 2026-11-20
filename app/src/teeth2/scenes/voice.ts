// Plate 8 `voice` (90.16 - 103.98), pre-chorus 2. Forensic audio: her voicemail dubbed onto quarter-inch tape that runs
// across a splicing block, its waveform drawn on the lab's monitor behind it, scrolling under a playhead, a real
// spectrogram building beneath. Each hero word sits in the waveform, its letters shaped by the sung sound.
//   90.16  "Call me in the morning": the bench, the tape rolling; MORNING in the waveform
//   93.62  "Every little lie": the gloved hand lays a razor in the 45 degree slot; on "lie" (94.48) the edge reaches
//          the bottom and cuts the tape; the waveform splits with a slanted gap of silence, and LIE is cut with it
//   94.91  "gives me butterflies": a strip of splicing tape across the joint; the two halves slid back and forth,
//          failing to line up (the glove nudges the right half; on the monitor the halves slide against each other)
//   98.80  "looking through my eyes": the playhead scrubs back over the line to the splice, the waveform reversing,
//          then whips forward onto the downbeat
//   102.25 "make it out alive": the waveform swells to clip, its peaks flattened; the last frame is the flat top of
//          the clipped wave filling the frame (match-cut to the flat, level surface of wet stone, plate 9)
// Spectrogram: a real STFT of the full mix (no vocal stem is on disk); the waveform's level is the stem-derived vocal
// envelope of data/teeth/audio.json with the real peak structure of the mix's vocal band (see voice-precompute.mjs).
// Files: voice-script.ts (clock, tape, cut, camera, hand), voice-type.ts (hero, caption lane, label), voice-glsl.ts
// (the frame; the glove is taken from match-glsl.ts), voice-data.ts (generated), voice-precompute.mjs.
import * as THREE from 'three';
import { Scene, type Frame } from '../../engine/scene';
import { FSPass, SS_TAP } from '../../engine/gl';
import { clamp, pulse } from '../../engine/util';
import { VD, SPEC_B64 } from './voice-data';
import { VOICE_FRAG } from './voice-glsl';
import { buildHeroes, heroState, buildChunks, newLaneCanvas, drawLane, LANE, buildLabel, dataTex, waveBytes, type Hero, type Chunk } from './voice-type';
import { scr, tDisp, dispRate, tapeTime, TSPD, splice, stripAt, gain, camAt, handAt, CUTS, TCUT, T0, XP } from './voice-script';

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export default class Voice extends Scene {
  private pass!: FSPass;
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 5, 4000);
  private heroes: Hero[] = [];
  private chunks: Chunk[] = [];
  private laneCv!: HTMLCanvasElement; private laneTex!: THREE.CanvasTexture;
  private downs: number[] = [];
  private probe!: CanvasRenderingContext2D;

  override init() {
    const au = this.ctx.audio;
    this.downs = au.downbeats.filter((b) => b >= T0 - 0.01 && b < this.ctx.end);
    const { heroes, atlas } = buildHeroes(this.ctx.lyrics, au.beats);
    this.heroes = heroes;
    this.chunks = buildChunks(this.ctx.lyrics, au.beats);
    this.probe = document.createElement('canvas').getContext('2d')!;
    this.laneCv = newLaneCanvas();
    this.laneTex = dataTex(this.laneCv);
    const lin = (t: THREE.Texture) => { t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t; };
    const waveTex = lin(new THREE.DataTexture(waveBytes, VD.nWave, 1, THREE.RGBAFormat, THREE.UnsignedByteType));
    const specTex = new THREE.DataTexture(b64(SPEC_B64), VD.nSpec, VD.nBands, THREE.RedFormat, THREE.UnsignedByteType);
    specTex.unpackAlignment = 1; lin(specTex);
    this.pass = new FSPass(VOICE_FRAG, {
      invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, res: { value: new THREE.Vector2() }, pxAng: { value: 0.001 },
      waveTex: { value: waveTex }, specTex: { value: specTex }, laneTex: { value: this.laneTex }, heroTex: { value: dataTex(atlas) }, labTex: { value: dataTex(buildLabel()) },
      keyPos: { value: new THREE.Vector3(-150, -170, 270) },
      hTip: { value: new THREE.Vector3() }, hE1: { value: new THREE.Vector3() }, hE2: { value: new THREE.Vector3() }, hE3: { value: new THREE.Vector3() },
      handOn: { value: 0 }, bladeOn: { value: 0 },
      stp: { value: new THREE.Vector4() }, dof: { value: new THREE.Vector2(300, 0) }, tDisp: { value: 0 }, blurTau: { value: 0 }, gain: { value: 1 }, flash: { value: 0 }, glow: { value: 0.3 },
      spl: { value: new THREE.Vector4() }, tp: { value: new THREE.Vector4() },
      heroA: { value: new THREE.Vector4(-1, 0, 100, 50) }, heroB: { value: new THREE.Vector4(0, 0, 0, 1000) },
      hLX: { value: new Array(13).fill(1) }, hS: { value: new Array(12).fill(1) },
      ssTap: SS_TAP,
    });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t, u = this.pass.u;
    // ---- camera
    const c = camAt(t);
    const kick = this.downs.reduce((m, b) => Math.max(m, pulse(t, b, 0.05)), 0);
    const D = c.D * (1 - 0.012 * kick);
    const az = (c.az * Math.PI) / 180, el = (c.el * Math.PI) / 180;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), -Math.sin(el));
    const tgt = new THREE.Vector3(c.tx, c.ty, c.tz);
    this.cam.position.copy(tgt).addScaledVector(dir, -D);
    this.cam.up.set(0, 0, 1);
    this.cam.lookAt(tgt);
    this.cam.rotateZ(c.roll);
    this.cam.fov = c.fov; this.cam.aspect = 16 / 9; this.cam.updateProjectionMatrix(); this.cam.updateMatrixWorld();
    (u.invVP!.value as THREE.Matrix4).multiplyMatrices(this.cam.matrixWorld, this.cam.projectionMatrixInverse);
    (u.camPos!.value as THREE.Vector3).copy(this.cam.position);
    (u.res!.value as THREE.Vector2).set(out.width, out.height);
    u.pxAng!.value = (2 * Math.tan((c.fov * Math.PI) / 360)) / 1080;
    (u.dof!.value as THREE.Vector2).set(c.D, c.dof);

    // ---- the display, the tape, the cut
    const td = tDisp(t);
    u.tDisp!.value = td;
    u.blurTau!.value = Math.min(dispRate(t) / 60 * 0.9, 0.5) * (dispRate(t) > 2.5 ? 1 : 0);
    u.gain!.value = gain(t);
    const sp = splice(t);
    (u.spl!.value as THREE.Vector4).set(sp.cutOn, sp.gh, sp.oL, sp.oR);
    (u.tp!.value as THREE.Vector4).set(tapeTime(t) * TSPD, sp.gapTape, sp.yJog, 0);
    const st = stripAt(t);
    (u.stp!.value as THREE.Vector4).set(st.x, st.y, st.z, st.on);
    u.flash!.value = 0.07 * pulse(t, TCUT, 0.06) * (t >= TCUT ? 1 : 0);

    // ---- the hero word and the caption lane
    const h = this.heroes.find((x) => t >= x.t0 && t < x.t1);
    const hA = u.heroA!.value as THREE.Vector4, hB = u.heroB!.value as THREE.Vector4;
    if (h) {
      this.probe.fillText(h.text, 0, 0);   // the hero is drawn in the shader from an atlas: say so to the frame checker
      const hs0 = heroState(h, t);
      hA.set(h.row, hs0.state, h.Wm, h.Hn);
      const isLie = h === this.heroes[1];
      hB.set(isLie ? XP + h.Wm * (0.5 - h.lx[1]!) : 0, isLie && t >= TCUT ? 1 : 0, h.n, h.Wpx);
      const lx = u.hLX!.value as number[], hs = u.hS!.value as number[];
      for (let i = 0; i < 13; i++) lx[i] = i < h.lx.length ? h.lx[i]! : 2;
      const gm = h === this.heroes[3] ? 1 + 0.22 * clamp((t - 102.0) / 1.2) : 1;
      for (let i = 0; i < 12; i++) hs[i] = i < h.n ? hs0.s[i]! * (hs0.state === 2 ? gm : 1) : 1;
    } else { hA.set(-1, 0, 100, 50); hB.set(0, 0, 0, 1000); }
    // the lane's left stop: the lane edge, or the frame's edge where the camera crops the monitor (a sung word is never cut)
    let left = LANE.x0 + 1.5;
    const pv = new THREE.Vector3();
    for (let sx = LANE.x0; sx < 60; sx += 3) {
      const q = scr(sx, 47); pv.set(q[0], q[1], q[2]).project(this.cam);
      if (pv.x > -0.93) { left = Math.max(left, sx + 2.0); break; }
    }
    drawLane(this.laneCv, this.chunks, t, td, left); this.laneTex.needsUpdate = true;

    // ---- the hand
    const hp = handAt(t);
    u.handOn!.value = hp.on ? 1 : 0; u.bladeOn!.value = hp.blade ? 1 : 0;
    if (hp.on) {
      (u.hTip!.value as THREE.Vector3).copy(hp.tip); (u.hE1!.value as THREE.Vector3).copy(hp.e1);
      (u.hE2!.value as THREE.Vector3).copy(hp.e2); (u.hE3!.value as THREE.Vector3).copy(hp.e3);
    }
    this.pass.render(renderer, out);

    // ---- post: a jolt on the downbeats and the cuts; a harder one on the cut itself
    const cuts = CUTS.reduce((m, b) => Math.max(m, pulse(t, b, 0.04)), 0);
    const sh = 2.4 * kick + 2.0 * cuts + 5 * pulse(t, TCUT, 0.05) * (t >= TCUT ? 1 : 0);
    const a = t * 97;
    return { shake: [sh * Math.cos(a), sh * 0.7 * Math.sin(a * 1.3)] as [number, number], halation: 0.06, vignette: 0.3 };
  }
}
