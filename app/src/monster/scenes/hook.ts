// HOOK ×3 — the one recurring event, in three grammatical moods (docs/MONSTER.md). Its motif (client's choice for
// pilot v7, "the reflection disobeys"): the hero word stands lit on the waterline, and its reflection in the
// wine-dark mirror water is not quite its mirror image but the answer, black-figure on the clay's orange; hook by
// hook it obeys the word less. The signature shot of every hook: on MONSTER the camera dips to the waterline, half
// word, half reflection.
//   n=1 "What if I'm the monster?"  `sea`'s last frame, on the stage in 3D: black mirror water, wine-dark, lit by the
//       fire behind us (never seen); the far shore is the line, a bone hairline. ME? (carried over the cut at its
//       size and place in `sea`, the small word beside it) lies down; "What if I'm
//       the" pops up afloat near us, truly reflected; MONSTER? stands up on the waterline as it is sung, bone, lit
//       (red-figure: a lit figure on black). Its reflection follows it in everything but two: it has no question
//       mark, and it is black-figure (black slip, the contour incised back to the clay, the clay's orange developing
//       behind it in the water). The question is asked above the line; below it, the answer.
//   n=2 "If I became the monster…" (the conditional): the same shore; the reflection moves before the word does,
//       and the orange climbs a little above the line. (Placeholder until chorus 2 is designed.)
//   n=3 "Then I'll become the monster" (the declarative): black-figure. The frame is the clay's orange, the word a
//       black silhouette with its detail incised, and there is no flame: he is the reflection now. (2D draft; to be
//       rebuilt on the motif: the reflection stands up out of the water and takes the word's place.)
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, W, H } from '../../engine/gl';
import { F, font, layout, measure, type TextLayout } from '../../engine/type';
import type { Word } from '../../engine/lyrics';
import { ease, lerp, prog, pulse, noise1 } from '../../engine/util';
import { meanderBand } from '../motifs';
import { SHORE, Stage, Word3D, keyLight, popHinge, popWords } from '../stage';
import { LOW, SHORE_KEY, SHORE_OPTS, SHORE_POST, SHORE_SURF, VOICE, WORD_Z, Answer, bob as bobAt, heroFont, heroScale, hideFlat, placeMe, setRegion, shoreStage } from '../shore';

/** The answer's top under the surface (fraction of the hero word's cap height). */
const ANSWER_GAP = 0.06;
/** The ground line of the black-figure frieze (n=3). */
const GROUND = H * 0.78;
interface Placed { w: Word; text: string; fam: string; size: number; x: number; base: number; lay: TextLayout; big: boolean }

export default class Hook extends Scene {
  n = 1;
  // ---- n = 1, 2: the shore, on the stage
  private st!: Stage;
  /** MONSTER? (incised for its black-figure reflection), the question before it, and (n=1) `sea`'s last line: ME?
   *  and the small word before it. */
  private big!: Word3D;
  private voice!: Word3D;
  private prev: { is: Word3D; me: Word3D } | null = null;
  private bigW!: Word;
  private small: Word[] = [];
  private prevOn: number[] = [];
  /** World units per font px of MONSTER?. */
  private bigS = 0.01;
  /** The water's answer: MONSTER, painted right way round under the surface. */
  private ans!: Answer;
  // ---- n = 3: black-figure, 2D
  private L: Layer2D | null = null;
  private words: Placed[] = [];
  private black: FSPass | null = null;

  override async init() {
    const { lyrics, params, start, end } = this.ctx;
    this.n = Number(params.n ?? 1);
    const line = lyrics.lines.find((l) => l.voice !== 'ensemble' && l.start >= start - 0.3 && l.start < end)!;
    const ws = line.words.filter((w) => w.start < end);
    const bi = ws.findIndex((w) => /monster/i.test(w.w));
    if (this.n === 3) return this.init3(ws, bi);
    this.bigW = ws[bi]!;
    this.small = ws.slice(0, bi);
    this.st = shoreStage();
    const voice = F.archivo(112.5, 600);
    this.big = new Word3D(this.bigW.w.toUpperCase().replace(/[,.]$/, ''), F.archivo(112.5, 900), { size: 220, incise: true });
    this.big.lightMul = 2.8;                                // far off on the shore, lit as brightly as the near words
    this.voice = new Word3D(this.small.map((w) => w.w).join(' '), voice, { size: 200 });
    this.st.add(this.big, { shadows: false });
    this.st.add(this.voice, { shadows: false });
    if (this.n === 1) {
      // `sea`'s last line, carried over the cut exactly where it stood (as built there), to lie down
      const l2 = lyrics.get('Is me');
      this.prev = {
        is: new Word3D(l2.words[0]!.w, voice, { size: 200 }),
        me: new Word3D(l2.words.slice(1).map((w) => w.w.toUpperCase()).join(' '), heroFont(), { size: 220 }),
      };
      this.prevOn = l2.words.map((w) => w.start);
      this.st.add(this.prev.is, { shadows: false });
      this.st.add(this.prev.me, { shadows: false });
    }
    for (const w of this.st.words) for (const l of w.letters) l.mat.side = THREE.DoubleSide;
    // MONSTER? fills BIG_W of the frame once the camera is down
    this.bigS = heroScale(this.big);
    this.ans = new Answer(this.st, this.bigW.w);
  }

  private init3(ws: Word[], bi: number) {
    this.L = new Layer2D();
    this.black = new FSPass(/* glsl */ `
      uniform sampler2D words; uniform float t, warm;
      void main() {
        // black-figure: the clay's orange field, the figure in black slip, detail incised back to the clay
        vec2 px = FRAG_PX;
        float g = 0.5 + 0.5 * snoise(vec2(px.x / 900.0, px.y / 700.0));
        vec3 clay = mix(C_SIGNAL * 0.62, C_EMBER * 0.7, 0.25 * g) * (0.92 + 0.08 * warm);
        vec4 wd = texture(words, vUv);
        vec3 c = mix(clay, C_INK, wd.a);
        // incised lines are drawn into the layer's red channel (white on the black figure)
        c = mix(c, clay * 1.08, wd.a * smoothstep(0.5, 0.9, wd.r - wd.g));
        fragColor = vec4(c, 1.0);
      }`, { words: { value: this.L.texture }, t: { value: 0 }, warm: { value: 0 } });
    // the question voiced small, top left; MONSTER standing big on the ground line
    const small = ws.slice(0, bi), big = ws[bi]!;
    const fS = F.archivo(100, 500), fB = F.archivo(125, 900);
    const sizeS = 66;
    const bigText = big.w.toUpperCase().replace(/[,.]$/, '');
    const sizeB = Math.min(330, (W - 260) / (measure(bigText, fB, 100) / 100));
    let x = 120;
    for (const w of small) {
      const lay = layout(w.w, fS, sizeS);
      this.words.push({ w, text: w.w, fam: fS, size: sizeS, x, base: 230, lay, big: false });
      x += lay.width + measure(' ', fS, sizeS);
    }
    const layB = layout(bigText, fB, sizeB);
    this.words.push({ w: big, text: bigText, fam: fB, size: sizeB, x: W / 2 - layB.width / 2, base: GROUND, lay: layB, big: true });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    return this.n === 3 ? this.render3(f, out) : this.renderShore(f, out);
  }

  /** MONSTER?'s letters standing up on the waterline as it is sung (at time `t`). */
  private poseBig(t: number) {
    const wd = this.big, s = this.bigS;
    wd.letters.forEach((l, k) => {
      l.x = (l.penX - wd.width / 2) * s; l.z = WORD_Z; l.y = 0; l.yaw = 0; l.s = s;
      l.hinge = popHinge(t, this.bigW.start, k);
      l.on = l.hinge < Math.PI / 2 - 1e-4 ? 1 : 0;
    });
    wd.update();
  }

  /** n=1, 2: the shore, the word, and the water that answers it. */
  private renderShore(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio } = this.ctx;
    const t = f.t, T0 = this.ctx.start, T1 = this.ctx.end;
    const bw = this.bigW;

    // ---- the camera: `sea`'s last frame, drifting a little; on MONSTER it dips to the waterline and levels, so the
    // line crosses the middle of the frame (half word, half reflection), then keeps pushing in slowly
    const tD0 = bw.start - 0.12, tD1 = bw.start + 0.45;
    const dip = ease.inOutCubic(prog(t, tD0, tD1)), drift = prog(t, T0, tD0);
    const C = SHORE.cam;
    const pos = new THREE.Vector3(lerp(0.14 * drift, 0, dip), lerp(C.y, LOW.y, dip),
      lerp(C.z - 0.25 * drift, LOW.z, dip) - 0.3 * prog(t, tD1, T1 + 0.6));
    const pitch = lerp(C.pitch, LOW.pitch, dip);
    this.st.cam.set(pos, pos.clone().add(new THREE.Vector3(0, 30 * pitch, -30)), 40);
    const cam = this.st.cam.cam.position;

    // ---- MONSTER?: standing up on the waterline as sung, bone, lit; a flash of ember as it lands
    this.poseBig(t);
    this.big.letters.forEach((l, k) => {
      const tk = bw.start + k * 0.014;
      l.mat.uniforms.glow!.value = 0.5 * pulse(t, tk, 0.14) * (t >= tk ? 1 : 0) * l.on;
      l.mat.uniforms.amb!.value = 0.05 * prog(t, tk, tk + 0.3);
    });

    // ---- the question afloat near us, bobbing on the swell, facing us, truly reflected; it lies down as MONSTER?
    // stands. (n=1) ME? and the word before it, from `sea`, lie down first, from exactly where they stood.
    const bob = (x0: number, z0: number, cap: number, w: Word3D, amp: number) => bobAt(t, cam, x0, z0, cap, w, amp);
    // (a letter nearly flat, rising or folding, is hidden: hideFlat)
    if (this.prev) {
      const { is, me } = this.prev, mp = placeMe(t, cam, is, me);
      popWords(is, [this.prevOn[0]!], t, mp.is, { exit: T0 + 0.02, exitDur: 0.24 });
      popWords(me, [this.prevOn[1]!], t, mp.me, { exit: T0 + 0.02, exitDur: 0.24 });
      hideFlat(is); hideFlat(me);
    }
    // it folds away as the camera starts down, all its letters at once and fast: "the" is up only from 45.095, and
    // the question is gone before MONSTER?'s first letter starts up (45.275; one phrase at a time)
    popWords(this.voice, this.small.map((w) => w.start), t, bob(VOICE.x0, VOICE.z, VOICE.cap, this.voice, 0.012),
      { exit: tD0, exitDur: 0.06, exitRipple: 0 });
    hideFlat(this.voice);

    // ---- the answer in the water: where the mirrored word stands on screen, and how far the orange has developed
    const u = this.st.bg.u;
    const lead = this.n === 2 ? 0.15 : 0;                   // (n=2) the reflection moves first
    const gap = ANSWER_GAP * this.big.cap * this.bigS;
    setRegion(this.st, this.ans.box(this.st, 0, this.bigS, gap));
    u.develop!.value = ease.outCubic(prog(t, bw.start + 0.05 - lead, bw.start + 0.7 - lead));
    u.creep!.value = this.n === 2 ? 0.25 * prog(t, bw.start, bw.start + 0.6) : 0;

    // the mirrored render holds no image of MONSTER?, only the answer: MONSTER, right way round under the surface,
    // in black slip with its incised contour, unfolding from the deep as the word stands up
    const mirror = {
      before: () => {
        for (const l of this.big.letters) l.mesh.visible = false;
        this.ans.pose(t + lead, 0, this.bigS, bw.start, gap);
      },
      after: () => {
        this.ans.hide();
        this.big.update();
      },
    };
    // the fire behind us (as `sea`); the water mirrors, wine-dark, its swells bending what it mirrors. (n=1) `sea`
    // ends with the fire dipped to 0.35 of its light: it starts there and flares back up after the cut
    const relit = this.n === 1 ? 0.35 + 0.65 * prog(t, T0, T0 + 0.4, ease.outQuad) : 1;
    this.st.render(renderer, out, t, keyLight(this.st.cam, audio, t, { ...SHORE_KEY, I: SHORE_KEY.I * relit }), SHORE_SURF, { ...SHORE_OPTS, mirror });

    const hit = pulse(t, bw.start, 0.08);
    return { ...SHORE_POST,
      shake: [noise1(t * 60, 1) * 6 * hit, noise1(t * 60, 2) * 6 * hit] };
  }

  /** 0..1: a word stands up from its line as it is sung (a cut-out rising on its hinge; n=3). */
  private stand(p: Placed, t: number) {
    const a = p.w.start - (p.big ? 0.02 : 0.0);
    return p.big ? ease.outBack(prog(t, a, a + 0.22), 1.6) : ease.outCubic(prog(t, a, a + 0.16));
  }

  /** Black-figure: the frame is clay, the word a black silhouette with incised detail. */
  private render3(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const L = this.L!; L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';
    for (const p of this.words) {
      const s = this.stand(p, t);
      if (s <= 0.001) continue;
      c.save();
      c.translate(0, p.base);
      c.scale(1, Math.max(0.001, s));
      c.font = font(p.fam, p.size);
      c.fillStyle = 'rgba(0,0,0,1)';
      c.fillText(p.text, p.x, 0);
      // incised detail: a contour scratched through the black just inside each letter's edge, back to the clay
      // (red channel): a wide red stroke clipped to the letters, then most of it painted black again
      if (p.big) {
        c.globalCompositeOperation = 'source-atop';
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(255,0,0,1)'; c.lineWidth = 15;
        c.strokeText(p.text, p.x, 0);
        c.strokeStyle = 'rgba(0,0,0,1)'; c.lineWidth = 11;
        c.strokeText(p.text, p.x, 0);
        c.globalCompositeOperation = 'source-over';
      }
      c.restore();
    }
    // the frieze's ground line and a meander band below it, in black slip like the figure
    c.fillStyle = 'rgba(0,0,0,1)';
    c.fillRect(0, GROUND + 18, W, 3);
    const mb = meanderBand(60, W - 60, GROUND + 44, 36);
    c.strokeStyle = 'rgba(0,0,0,1)'; c.lineWidth = 3.2; c.lineJoin = 'miter';
    c.beginPath(); mb.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.stroke();
    c.fillRect(0, GROUND + 98, W, 3);
    L.upload();
    const bl = this.black!;
    bl.u.t!.value = t;
    bl.u.warm!.value = 0;
    bl.render(renderer, out);
    return { bloom: 0.3, bloomThreshold: 1.2, vignette: 0.35, grain: 0.07, ca: 0.4, halation: 0.1 };
  }
}
