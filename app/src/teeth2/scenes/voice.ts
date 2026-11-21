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
// Lyric layer (kinetic.ts, docs/TEETH2.md "Kinetic type"): the lane's words spring and track; MORNING, LIE and THROUGH
// stamp in the waveform panel and LIE breaks along the razor's diagonal; from bar 5 copies of the chunk being sung
// condense and pack the panel on the kicks (pressure); ALIVE (102.57) slams full-frame, re-stamps on every beat, and on
// the beat after its line ends the slam's field turns dental-stone yellow with the pour's table edge across the top,
// so the cut at 103.976 lands on pour's first frame (the stone field, the letters gone).
// Files: voice-script.ts (clock, tape, cut, camera, hand), voice-type.ts (heroes, pressure, caption lane, label),
// voice-glsl.ts (the frame; the glove is taken from match-glsl.ts), voice-data.ts (generated), voice-precompute.mjs.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, SS_TAP, W as FW, H as FH } from '../../engine/gl';
import { clamp, pulse } from '../../engine/util';
import { trgba } from '../palette';
import { KinClock, KinWord, drawKin, kinShake } from '../kinetic';
import { VD, SPEC_B64 } from './voice-data';
import { VOICE_FRAG } from './voice-glsl';
import { buildHeroes, buildChunks, newLaneCanvas, newKinCanvas, drawLane, drawPanel, LANE, buildLabel, dataTex, waveBytes, type Hero, type Chunk } from './voice-type';
import { scr, tDisp, dispRate, tapeTime, TSPD, splice, stripAt, gain, camAt, handAt, CUTS, TCUT, T0, T1 } from './voice-script';

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export default class Voice extends Scene {
  private pass!: FSPass;
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 5, 4000);
  private heroes: Hero[] = [];
  private chunks: Chunk[] = [];
  private laneCv!: HTMLCanvasElement; private laneTex!: THREE.CanvasTexture;
  private downs: number[] = [];
  private clk!: KinClock;
  private kinCv!: HTMLCanvasElement; private kinTex!: THREE.CanvasTexture;
  private L = new Layer2D();
  /** ALIVE, the full-frame slam: its word, when it lands (the slam's start, 45 ms ahead), when its field turns to stone */
  private alive!: { kw: KinWord; t0: number; start: number; stone: number; stamps: number[]; cap: number };

  override init() {
    const au = this.ctx.audio;
    this.downs = au.downbeats.filter((b) => b >= T0 - 0.01 && b < this.ctx.end);
    this.clk = new KinClock(au, { backbeat: true });
    this.heroes = buildHeroes(this.ctx.lyrics, this.clk);
    this.chunks = buildChunks(this.ctx.lyrics, au.beats);
    this.laneCv = newLaneCanvas();
    this.laneTex = dataTex(this.laneCv);
    this.kinCv = newKinCanvas();
    this.kinTex = dataTex(this.kinCv);
    // ALIVE: full-frame, Archivo 62/900, 1560 px wide at rest and stood tall; it re-stamps on every beat to the cut
    const line = this.ctx.lyrics.lines.find((l) => l.start >= 100 && l.start < T1)!;
    const aw = line.words[line.words.length - 1]!;
    const probe = new KinWord('ALIVE', { size: 100, width: 62, weight: 900 });
    const kw = new KinWord('ALIVE', { size: (1560 * 100) / probe.width, width: 62, weight: 900 });
    const t0 = aw.start - 0.045, stone = this.clk.leave(line.end);
    const stamps = [t0]; for (let b = this.clk.nextBeat(t0 + 1e-3); b < T1 - 0.05; b = this.clk.nextBeat(b + 1e-3)) stamps.push(b);
    this.alive = { kw, t0, start: aw.start, stone, stamps, cap: 0.686 * kw.style.size * 1.5 };
    const lin = (t: THREE.Texture) => { t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t; };
    const waveTex = lin(new THREE.DataTexture(waveBytes, VD.nWave, 1, THREE.RGBAFormat, THREE.UnsignedByteType));
    const specTex = new THREE.DataTexture(b64(SPEC_B64), VD.nSpec, VD.nBands, THREE.RedFormat, THREE.UnsignedByteType);
    specTex.unpackAlignment = 1; lin(specTex);
    this.pass = new FSPass(VOICE_FRAG, {
      invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, res: { value: new THREE.Vector2() }, pxAng: { value: 0.001 },
      waveTex: { value: waveTex }, specTex: { value: specTex }, laneTex: { value: this.laneTex }, kinTex: { value: this.kinTex }, labTex: { value: dataTex(buildLabel()) },
      keyPos: { value: new THREE.Vector3(-150, -170, 270) },
      hTip: { value: new THREE.Vector3() }, hE1: { value: new THREE.Vector3() }, hE2: { value: new THREE.Vector3() }, hE3: { value: new THREE.Vector3() },
      handOn: { value: 0 }, bladeOn: { value: 0 },
      stp: { value: new THREE.Vector4() }, dof: { value: new THREE.Vector2(300, 0) }, tDisp: { value: 0 }, blurTau: { value: 0 }, gain: { value: 1 }, flash: { value: 0 }, glow: { value: 0.3 },
      spl: { value: new THREE.Vector4() }, tp: { value: new THREE.Vector4() },
      kinOn: { value: 0 },
      ssTap: SS_TAP,
    });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t, u = this.pass.u;
    if (t >= this.alive.t0) return this.renderSlam(t, out);
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

    // ---- the kinetic layers: the panel (heroes, pressure) and the caption lane
    const pan = drawPanel(this.kinCv, this.heroes, this.chunks, t, this.clk); this.kinTex.needsUpdate = true;
    u.kinOn!.value = pan.on ? 1 : 0;
    // the lane's left stop: the lane edge, or the frame's edge where the camera crops the monitor (a sung word is never cut)
    let left = LANE.x0 + 1.5;
    const pv = new THREE.Vector3();
    for (let sx = LANE.x0; sx < 60; sx += 3) {
      const q = scr(sx, 47); pv.set(q[0], q[1], q[2]).project(this.cam);
      if (pv.x > -0.93) { left = Math.max(left, sx + 2.0); break; }
    }
    drawLane(this.laneCv, this.chunks, this.clk, t, td, left); this.laneTex.needsUpdate = true;

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
    const ks = kinShake(t, pan.shake * 9);
    return { shake: [sh * Math.cos(a) + ks[0], sh * 0.7 * Math.sin(a * 1.3) + ks[1]] as [number, number], halation: 0.06, vignette: 0.3 };
  }

  /** ALIVE, the pre-chorus's payoff: a full-frame slam (kinetic.ts; flat fills in Archivo 900, no outline, no halo). It lands
   *  on its onset (45 ms ahead) over two inverted punch frames: lightbox letters on film, stood tall, springing up from
   *  below, stamped on every beat and stretched on the kicks (leaning a little more each beat). On the beat after its line
   *  ends the field turns to dental stone with the pour's table edge across the top: the cut at 103.976 lands on pour's
   *  first frame. The word is never faded or popped: the cut swallows it. */
  private renderSlam(t: number, out: THREE.WebGLRenderTarget): PostOverrides {
    const c = this.L.ctx, A = this.alive;
    const stone = t >= A.stone;
    const punch = t < A.t0 + 0.06 || (stone && t < A.stone + 0.06);
    const field = stone ? (punch ? 'film' : 'stone') : (punch ? 'lightbox' : 'film');
    const ink = stone ? (punch ? 'stone' : 'film') : (punch ? 'film' : 'lightbox');
    this.L.clear(trgba(field));
    c.textBaseline = 'alphabetic';
    const kw = A.kw;
    const base = FH / 2 + A.cap / 2 + 24;
    const x = (FW - kw.width) / 2;
    const P = kw.pose(t, this.clk, {
      t0: A.start, lead: A.start - A.t0,
      spring: { stagger: 0.02, freq: 5.5, damp: 0.4, rise: 0.6 },
      stamp: { at: A.stamps, over: 1.18 },
      stretch: { kick: 0.12, snare: 0 },
      weight: { from: 400, to: 900, dur: 0.05 },
      track: { amt: 0.02 },
      lean: { perBeat: 0.025, max: 0.1, from: A.t0 },
    });
    for (const g of P.glyphs) g.sy *= 1.5;
    if (stone) {
      // the pour's table edge: the dark band across the top of its first frame
      c.fillStyle = '#1d222c'; c.fillRect(0, 0, FW, 90);
      c.fillStyle = '#0a0c12'; c.fillRect(0, 0, FW, 8);
    }
    drawKin(c, kw, P, x, base, { fill: trgba(ink) });
    this.L.upload();
    this.ctx.comp.draw(this.ctx.renderer, this.L.texture, out, { mode: 'replace' });
    return { exposure: 1, halation: 0, vignette: 0.2, shake: kinShake(t, P.shake * 20 + 8 * pulse(t, A.stone, 0.05) * (stone ? 1 : 0)), zoom: 1 + 0.03 * P.shake };
  }
}
