// SKETCH (stills only) — `mirror`, chorus 1's last line, ?opt=monster (client-approved design B, 2026-10-09). Back on
// hook 1's shore at night: "What if I'm the" small near us, MONSTER? standing lit on the waterline at hero scale. Its
// shadow, thrown by the fire behind us onto the far bank, is Odysseus (odysseus.ts, the drawn bow), large, among a
// crowd of the dead (generic shades, smaller, their heads turned to him). On the downbeat after "monster" he turns his
// head and looks straight back at us, and the dead turn theirs with him. (The earlier chorus 1 sketch is in git.)
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { H as HPX } from '../../engine/gl';
import { F } from '../../engine/type';
import type { Line } from '../../engine/lyrics';
import { ease, mulberry32, prog } from '../../engine/util';
import { GLSL_SHADE } from '../motifs';
import { GLSL_ODYSSEUS, odysseusUniforms, setOdysseus } from '../odysseus';
import { SHORE, Stage, Word3D, keyLight, popHinge, popWords, type Letter } from '../stage';
import { BIG_W, FOV, LOW, SHORE_KEY, SHORE_POST, WORD_Z, heroFont } from '../shore';

const TANF = Math.tan((FOV * Math.PI) / 360);
const NS = 12;
/** The far bank (z, height), Odysseus on it (x, height), the waterline's screen height (px from the top). */
const BANK = { z: SHORE.z - 2.0, h: 12.5 }, ODY = { x: -3.2, h: 9.6 }, LINE_PX = 700;

const HOOKS = /* glsl */ `
uniform float shoreZ, skyI, bankH, turnK;
uniform float shX[${NS}], shH[${NS}], shV[${NS}];
${GLSL_SHADE}
${GLSL_ODYSSEUS}
float carve(vec2 xz) { return 0.0; }
float floorLines(vec3 P, float u) { return u; }
vec3 skyGlow(vec3 D) { float e = max(D.y, 0.0); return mix(C_BLOOD, C_SIGNAL, 0.45) * skyI * (0.6 * exp(-e * 30.0) + 0.06 * exp(-e * 9.0)); }
vec3 skyTint(vec3 D, vec3 col) { return col + skyGlow(D); }
// a shade of the dead, its head in profile toward Odysseus (a nose) until it turns to us with him
float shadeOcc(vec2 p, float x, float h, float v) {
  vec2 q = vec2(p.x - x, p.y) / h;
  if (abs(q.x) > 0.4 || q.y > 1.1 || q.y < -0.02) return 0.0;
  float d = figure(q, v);
  float bw = step(0.55, fract(v * 13.7)) * 0.03, dir = sign(${ODY.x.toFixed(2)} - x);
  vec2 hc = vec2(bw, 0.925 - bw * 0.6);
  d = min(d, sdSegment(q, hc + vec2(dir * 0.05, -0.006), hc + vec2(dir * 0.074, -0.026)) - 0.009 * (1.0 - turnK) + 0.02 * turnK);
  return 1.0 - smoothstep(-gPix, gPix + 0.02, d * h);
}
float extraShadow(vec3 P, bool wall) {
  if (!wall) return 0.0;
  float occ = odysseusWall(P.xy, gPix);
  for (int i = 0; i < ${NS}; i++) occ = max(occ, shadeOcc(P.xy, shX[i], shH[i], shV[i]));
  return occ;
}
vec3 surfaceTint(vec3 P, bool wall, float b, vec3 col) {
  // the bank: clay lit by our fire; above its ragged top, the night
  if (wall) return mix(col, C_INK + skyGlow(normalize(P - camPos)), smoothstep(-gPix, gPix, P.y - bankH * (0.94 + 0.06 * snoise(vec2(P.x * 0.05, 1.7)))));
  float beyond = smoothstep(shoreZ + 0.02, shoreZ - 0.02, P.z);
  float lineG = exp(-abs(P.z - shoreZ) / max(0.06, gPix * 1.5));
  col = mix(col, C_INK + skyGlow(normalize(P - camPos)), beyond);
  return col + C_BONE * 0.8 * lineG;
}`;

export default class SketchMirror extends Scene {
  private st!: Stage;
  private hero!: Word3D;
  private small!: Word3D;
  private line!: Line;

  override async init() {
    const r = mulberry32(5);
    // the dead: smaller than him, spread along the bank on both sides (none in front of him)
    const xs: number[] = [], hs: number[] = [], vs: number[] = [];
    for (let i = 0; i < NS; i++) {
      let x = -17 + (34 * (i + 0.5)) / NS + (r() - 0.5) * 1.6;
      if (Math.abs(x - ODY.x) < 3.4) x += x < ODY.x ? -1.8 : 1.8;
      xs.push(x); hs.push(4.6 + r() * 1.6); vs.push(r());
    }
    this.st = new Stage({
      hooks: HOOKS,
      maxCards: 4,
      uniforms: {
        shoreZ: { value: SHORE.z }, skyI: { value: 0.12 }, bankH: { value: BANK.h }, turnK: { value: 0 },
        shX: { value: xs }, shH: { value: hs }, shV: { value: vs }, ...odysseusUniforms(),
      },
    });
    this.line = this.ctx.lyrics.lines.find((l) => l.start > 64.5 && l.start < 66.5 && /monster/i.test(l.text))!;
    const mi = this.line.words.findIndex((w) => /monster/i.test(w.w));
    this.hero = new Word3D(this.line.words.slice(mi).map((w) => w.w.toUpperCase()).join(' ').replace(/[^A-Z? ]/g, ''), heroFont(), { size: 220 });
    this.small = new Word3D(this.line.words.slice(0, mi).map((w) => w.w).join(' '), F.archivo(112.5, 600), { size: 200 });
    this.hero.lightMul = 2.4;
    this.st.add(this.hero, { shadows: false });
    this.st.add(this.small, { shadows: false });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer, audio } = this.ctx;
    const ws = this.line.words, mi = ws.findIndex((w) => /monster/i.test(w.w)), tM = ws[mi]!.start;
    const tTurn = audio.timeOfBeat(Math.ceil(audio.beatAt(tM)));
    const turn = prog(t, tTurn - 0.02, tTurn + 0.16, ease.outCubic);

    // the camera: low over the water, the waterline low in frame so the bank stands tall behind the word
    const y = 0.5, z = LOW.z;
    const below = Math.atan(y / (z - SHORE.z));
    const pitch = -Math.tan(below - Math.atan(((LINE_PX - HPX / 2) / (HPX / 2)) * TANF));
    const pos = new THREE.Vector3(0, y, z);
    this.st.cam.set(pos, pos.clone().add(new THREE.Vector3(0, 30 * pitch, -30)), FOV);

    // MONSTER? on the waterline, lit, at hero scale; "What if I'm the" small near us
    const hw = this.hero, dist = z - WORD_Z;
    const s = (BIG_W * 2 * dist * TANF * (16 / 9)) / hw.width;
    popWords(hw, [tM], t, (l: Letter) => { l.x = (l.penX - hw.width / 2) * s; l.z = WORD_Z; l.y = 0; l.yaw = 0; l.s = s; });
    const sm = this.small, ss = 0.13 / sm.cap;
    popWords(sm, ws.slice(0, mi).map((w) => w.start), t, (l: Letter) => {
      l.x = -1.9 + l.penX * ss; l.z = 3.4; l.s = ss; l.yaw = 0; l.y = 0.012 * Math.sin(t * 2.1 + l.penX * 0.004);
    }, { exit: tM + 0.6 });

    // his shadow on the bank (rising with the word), and the dead turning with him
    const u = this.st.bg.u;
    const up = Math.max(0, Math.min(1, 1 - popHinge(t, tM) / (Math.PI / 2)));
    setOdysseus(u, { x: ODY.x, h: ODY.h * (0.3 + 0.7 * up), pose: 'archer', turn, lean: 0, stretch: 1, on: up > 0.01 });
    u.turnK!.value = turn;

    this.st.render(renderer, out, t, keyLight(this.st.cam, audio, t, SHORE_KEY),
      { wall: 1, wallZ: BANK.z, gloss: 0.75, swell: 0.45, wine: 0.85, reflBend: 0.3 },
      { noFlame: true, cards: false, rim: 1.0, spec: 0.05 });
    return SHORE_POST;
  }
}
