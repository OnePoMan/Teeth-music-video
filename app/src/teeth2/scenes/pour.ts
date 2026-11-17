// Plate 9 `pour` — chorus 2, first half (103.98 – 117.79), docs/TEETH2.md. Ray-marched (pour-glsl.ts), then a
// depth-of-field gather; grain, cold halation and vignette come from the timeline's shared post.
//
//  THE POUR (103.98 – 109.91). An upper impression tray brimming with wet yellow stone on a dental vibrator table, no
//  pouring ribbon (scope guard: the stone is already in). The table shakes on every stomp: ripple packets run in from
//  the tray walls on each beat and bubbles rise and burst. Each phrase's words rise out of the wet surface as relief
//  and harden from gloss to matt by the word's end; the tender words (sweet, pretty) are wax pink set into the yellow.
//  On "heart got" (109.16 – 109.91) the whole surface sets, gloss to matt, in one wave across the tray. Lit by a low
//  raking lamp; the overhead tube's reflection lies in the wet stone and breaks up in the ripples.
//  THE CAST (from 109.91, a hard cut on "teeth"). The cast turned out of the impression and set on the dark bench,
//  teeth up, the chip on #8 at the front, on a trimmed plinth whose flat front facet carries the line's last phrase
//  in relief: HEART GOT over TEETH (the line's hero, condensed black, at frame scale), crossed by the raking lamp.
//  Later (stubbed for gate 2): "Late night devil…" the lamp swings across the cast on each word, the words on the
//  facet change per phrase; "never… let go" (the model trimmer, the dust) is not built yet.
//
// No label in the plate (the cast is unlabelled, docs/TEETH2.md clue ledger). Nothing glows: every value stays
// under the bloom threshold.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, SS_TAP, makeRT } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, lerp, smoothstep } from '../../engine/util';
import type { Line, Word } from '../../engine/lyrics';
import { TeethTex, HIS } from '../teeth';
import { DOF_FRAG, MARCH_FRAG, POUR } from './pour-glsl';

/** The hard cut on "teeth": the cast turned out. */
const T_CUT = 109.91;

/** A row of a phrase as set in relief: word indices (into the phrase), cap height (mm), family, wax. */
interface Row { idx: number[]; cap: number; fam: string; wax?: boolean; lower?: boolean }
interface Phrase { words: Word[]; rows: Row[]; surf: 'A' | 'B'; t0: number; t1: number; key: string }

const CANVAS_W = 2048, CANVAS_H = 1024;

interface Shot { t0: number; pos0: number[]; pos1: number[]; at0: number[]; at1: number[]; fov: number; aper: number; focus?: number[] }

const num = (q: URLSearchParams | null, k: string, d: number) => { const v = q?.get(k); return v != null && v !== '' ? +v : d; };

export default class Pour extends Scene {
  private tt!: TeethTex;
  private march!: FSPass;
  private dof!: FSPass;
  private rt = makeRT();
  private cv!: HTMLCanvasElement;
  private wordTex!: THREE.CanvasTexture;
  private drawn = '';
  private phrases: Phrase[] = [];
  private beats: number[] = [];

  override init() {
    this.tt = new TeethTex(HIS);
    this.cv = document.createElement('canvas');
    this.cv.width = CANVAS_W; this.cv.height = CANVAS_H;
    this.wordTex = new THREE.CanvasTexture(this.cv);
    this.wordTex.colorSpace = THREE.NoColorSpace;
    this.wordTex.minFilter = THREE.LinearFilter;
    this.wordTex.magFilter = THREE.LinearFilter;
    this.wordTex.generateMipmaps = false;
    const v3 = () => new THREE.Vector3();
    this.march = new FSPass(MARCH_FRAG, {
      ssTap: SS_TAP, teethTex: { value: this.tt.texture },
      camPos: { value: v3() }, camR: { value: v3() }, camU: { value: v3() }, camF: { value: v3() }, tanH: { value: 0.3 },
      mode: { value: 0 }, time: { value: 0 },
      wordTex: { value: this.wordTex }, wordRect: { value: new THREE.Vector4() }, wordDepth: { value: 0.8 },
      wRise: { value: new Array(8).fill(0) }, wWet: { value: new Array(8).fill(0) },
      rip: { value: Array.from({ length: POUR.NRIP }, () => new THREE.Vector4()) },
      trayOff: { value: v3() }, setP: { value: 0 }, wetAll: { value: 1 },
      lampPos: { value: v3() }, lampDir: { value: v3() }, lampI: { value: 1 }, lampCone: { value: 0.8 },
      tubeP: { value: v3() }, tubeI: { value: 1 }, fillK: { value: 0.05 }, topK: { value: 0.0 }, vibA: { value: 0 }, castOff: { value: v3() },
    });
    this.dof = new FSPass(DOF_FRAG, { src: { value: null }, focusD: { value: 100 }, aper: { value: 10 }, maxCoc: { value: 18 } });
    const { start, end } = this.ctx;
    this.beats = this.ctx.audio.beats.filter((b) => b > start - 2 && b < end + 1);
    this.buildPhrases();
  }

  // ------------------------------------------------------------------ the phrases
  private buildPhrases() {
    const { start, end, lyrics } = this.ctx;
    const line = (q: string): Line => {
      const l = lyrics.find(q).find((x) => x.start >= start - 0.2 && x.start < end);
      if (!l) throw new Error(`pour: lyric not found in window: ${q}`);
      return l;
    };
    const sup = F.archivo(100, 700), hero = F.archivo(75, 900), wax = F.serif(600, true);
    const L1 = line('Fight so dirty'), L2 = line('Talk so pretty'), L3 = line('Late night devil'), L4 = line('never ever let go');
    const mk = (l: Line, ids: number[], rows: Row[], surf: 'A' | 'B'): Phrase =>
      ({ words: ids.map((i) => l.words[i]!), rows, surf, t0: 0, t1: 0, key: `${l.i}:${ids.join(',')}:${surf}` });
    const R = (idx: number[], cap: number, fam = sup, w = false): Row => ({ idx, cap, fam, wax: w, lower: w });
    const list: Phrase[] = [
      mk(L1, [0, 1, 2], [R([0, 1, 2], 6.2)], 'A'),
      mk(L1, [3, 4, 5], [R([0, 1, 2], 6.2)], 'A'),
      mk(L1, [6, 7], [R([0], 4.2), R([1], 16, wax, true)], 'A'),
      mk(L2, [0, 1, 2], [R([0, 1], 5.0), R([2], 13, wax, true)], 'A'),
      mk(L2, [3, 4], [R([0, 1], 6.5)], 'A'),
      mk(L2, [5, 6], [R([0, 1], 10.0)], 'A'),
      mk(L2, [5, 6, 7], [R([0, 1], 3.4), R([2], 14, hero)], 'B'),
      mk(L3, [0, 1, 2], [R([0, 1, 2], 4.6)], 'B'),
      mk(L3, [3, 4, 5], [R([0, 1], 3.4), R([2], 12, hero)], 'B'),
      mk(L3, [6, 7], [R([0, 1], 5.5)], 'B'),
      mk(L4, [0, 1, 2], [R([0, 1, 2], 4.2)], 'B'),
      mk(L4, [3, 4], [R([0, 1], 5.0)], 'B'),
      mk(L4, [5, 6], [R([0], 3.4), R([1], 14, hero)], 'B'),
    ];
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!;
      p.t0 = Math.max(start, p.words[0]!.start - 0.045);
      if (p.surf === 'B' && list[i - 1]?.surf === 'A') p.t0 = T_CUT;
    }
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!, nx = list[i + 1];
      const lineEnd = p.words[0]!.line === nx?.words[0]!.line ? null : lyrics.lines[p.words[0]!.line]!.end;
      if (nx && lineEnd === null) p.t1 = nx.t0;
      else {
        p.t1 = this.beats.find((b) => b > (lineEnd ?? p.words[p.words.length - 1]!.end) + 0.02) ?? end;
        if (nx) p.t1 = Math.min(p.t1, nx.t0);
      }
    }
    this.phrases = list;
  }
  private phraseAt(t: number) { return this.phrases.find((p) => t >= p.t0 && t < p.t1) ?? null; }

  /** Set the phrase into the word canvas: r = height (blurred, the bevel), g = r * (index + 1) / 8, b = r * wax. */
  private drawPhrase(p: Phrase | null) {
    const key = p?.key ?? '-';
    if (key === this.drawn) return;
    this.drawn = key;
    const c = this.cv.getContext('2d')!;
    c.filter = 'none';
    c.fillStyle = '#000';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (p) {
      const rect = p.surf === 'A' ? POUR.RECT_A : POUR.RECT_B;
      const ppm = CANVAS_W / rect[2];
      const maxW = (rect[2] - (p.surf === 'A' ? 6 : 3.5)) * ppm;
      // rows: measure, fit, then stack centred
      const capK = (r: Row) => (r.wax ? 0.42 : 0.715); // x-height for the wax italic (lowercase), cap height otherwise
      const rows = p.rows.map((r) => {
        const txt = r.idx.map((i) => this.label(p.words[i]!, r));
        let em = (r.cap * ppm) / capK(r);
        c.font = font(r.fam, em);
        const gapF = 0.32;
        const width = () => txt.reduce((a, s) => a + c.measureText(s).width, 0) + gapF * em * (txt.length - 1);
        const w0 = width();
        if (w0 > maxW) { em *= maxW / w0; c.font = font(r.fam, em); }
        return { r, txt, em, w: width(), cap: em * capK(r), gap: gapF * em };
      });
      const lead = (a: (typeof rows)[number], b: (typeof rows)[number]) => 0.42 * Math.min(a.cap, b.cap) + (b.r.wax ? 0.35 * b.cap : 0);
      let total = rows.reduce((a, r) => a + r.cap, 0);
      for (let i = 1; i < rows.length; i++) total += lead(rows[i - 1]!, rows[i]!);
      let y = (CANVAS_H - total) / 2;
      for (let k = 0; k < rows.length; k++) {
        const row = rows[k]!;
        if (k > 0) y += lead(rows[k - 1]!, row);
        const base = y + row.cap;
        c.font = font(row.r.fam, row.em);
        c.textBaseline = 'alphabetic';
        let x = (CANVAS_W - row.w) / 2;
        row.r.idx.forEach((wi, j) => {
          const s = row.txt[j]!;
          c.filter = `blur(${row.r.wax ? 4 : 8}px)`;
          c.fillStyle = `rgb(255,${Math.min(255, (wi + 1) * 32)},${row.r.wax ? 255 : 0})`;
          c.fillText(s, x, base);
          x += c.measureText(s).width + row.gap;
        });
        y = base;
      }
    }
    c.filter = 'none';
    this.wordTex.needsUpdate = true;
  }
  private label(w: Word, r: Row) {
    const s = w.w.replace(/[,.!?]/g, '');
    return r.lower ? s.toLowerCase() : s.toUpperCase();
  }

  // ------------------------------------------------------------------ the camera
  private shots(): Shot[] {
    return [
      // the pour: the vibrator table and the tray, wide, pushing in
      { t0: this.ctx.start, pos0: [-48, 128, -118], pos1: [-32, 108, -92], at0: [0, 9, 19], at1: [0, 10, 19], fov: 30, aper: 7 },
      // the surface, from the front, drifting right
      { t0: 105.7, pos0: [-30, 118, -88], pos1: [-5, 112, -80], at0: [0, 12, 21], at1: [0, 12, 21], fov: 30, aper: 9 },
      // lower across the surface, from the left
      { t0: 107.43, pos0: [55, 78, -78], pos1: [40, 74, -72], at0: [0, 12, 19], at1: [0, 12, 19], fov: 30, aper: 9 },
      // "heart got": high and close over the words, the set front crossing
      { t0: 109.16, pos0: [18, 92, -56], pos1: [14, 88, -50], at0: [-2, 12, 20], at1: [-2, 12, 20], fov: 30, aper: 9 },
      // THE CAST: low on the front, the plinth's facet nearly square to the lens, pushing in
      { t0: T_CUT, pos0: [-46, -11, -126], pos1: [-39, -14, -116], at0: [-2, -18, 5], at1: [-2, -18.5, 5], fov: 28, aper: 7, focus: [0, -28, -12] },
      { t0: 110.88, pos0: [70, 10, -120], pos1: [55, 6, -125], at0: [0, -16, 10], at1: [0, -16, 10], fov: 28, aper: 7, focus: [0, -28, -12] },
      { t0: 112.61, pos0: [-55, 30, -110], pos1: [-40, 24, -118], at0: [0, -18, 8], at1: [0, -18, 8], fov: 28, aper: 7, focus: [0, -28, -12] },
      { t0: 114.33, pos0: [10, 40, -125], pos1: [0, 30, -120], at0: [0, -16, 10], at1: [0, -16, 10], fov: 28, aper: 7, focus: [0, -28, -12] },
      { t0: 116.06, pos0: [-35, 0, -118], pos1: [-28, -4, -112], at0: [0, -18, 6], at1: [0, -18, 6], fov: 28, aper: 7, focus: [0, -28, -12] },
    ];
  }
  private camera(t: number) {
    const S = this.shots();
    let i = 0;
    while (i < S.length - 1 && t >= S[i + 1]!.t0) i++;
    const s = S[i]!, t1 = S[i + 1]?.t0 ?? this.ctx.end;
    const k = ease.outCubic(clamp((t - s.t0) / Math.max(0.1, t1 - s.t0)));
    const L = (a: number[], b: number[]) => new THREE.Vector3(lerp(a[0]!, b[0]!, k), lerp(a[1]!, b[1]!, k), lerp(a[2]!, b[2]!, k));
    return { pos: L(s.pos0, s.pos1), at: L(s.at0, s.at1), fov: s.fov, aper: s.aper, focus: s.focus ? new THREE.Vector3(...s.focus) : null };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { renderer } = this.ctx;
    const u = this.march.u;
    const castMode = t >= T_CUT;
    // query overrides for framing work: ?pcam=x,y,z,ax,ay,az,fov,aper
    const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    const C = this.camera(t);
    const qc = qs?.get('pcam')?.split(',').map(Number);
    if (qc && qc.length >= 6) { C.pos.set(qc[0]!, qc[1]!, qc[2]!); C.at.set(qc[3]!, qc[4]!, qc[5]!); if (qc[6]) C.fov = qc[6]; if (qc[7]) C.aper = qc[7]; }
    const fw = C.at.clone().sub(C.pos).normalize();
    const rt = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(rt, fw);
    (u.camPos!.value as THREE.Vector3).copy(C.pos);
    (u.camF!.value as THREE.Vector3).copy(fw);
    (u.camR!.value as THREE.Vector3).copy(rt);
    (u.camU!.value as THREE.Vector3).copy(up);
    u.tanH!.value = Math.tan((C.fov * Math.PI) / 360);
    u.mode!.value = castMode ? 1 : 0;
    u.time!.value = t;

    // the words
    const p = this.phraseAt(t);
    this.drawPhrase(p);
    const rect = castMode ? POUR.RECT_B : POUR.RECT_A;
    (u.wordRect!.value as THREE.Vector4).set(rect[0], rect[1], rect[2], rect[3]);
    u.wordDepth!.value = castMode ? 0.65 : 0.7;
    const rise = u.wRise!.value as number[], wet = u.wWet!.value as number[];
    rise.fill(0); wet.fill(0);
    if (p) {
      p.words.forEach((w, i) => {
        const tw = w.start - 0.045;
        let r = p.surf === 'B' && p.t0 === T_CUT ? 1 : ease.outCubic(clamp((t - tw) / 0.22));
        if (p.surf === 'A') r *= 1 - smoothstep(p.t1 - 0.1, p.t1, t); // sinks back into the wet stone as the next phrase comes
        rise[i] = r;
        wet[i] = p.surf === 'A' ? 1 - smoothstep(w.start, w.end, t) : 0;
      });
    }

    // the stomps: ripples from the last beats; the tray's vibration
    const rip = u.rip!.value as THREE.Vector4[];
    const past = this.beats.filter((b) => b <= t && b >= this.ctx.start - 0.01).slice(-POUR.NRIP);
    for (let i = 0; i < POUR.NRIP; i++) {
      const b = past[past.length - 1 - i];
      rip[i]!.set(b !== undefined ? 1 : 0, b ?? -10, 0, 0);
    }
    const lastB = past[past.length - 1] ?? -10;
    const vib = Math.pow(0.5, (t - lastB) / 0.07) * 0.18 + 0.02;
    (u.trayOff!.value as THREE.Vector3).set(vib * Math.sin(t * 2 * Math.PI * 47.3), 0, vib * Math.cos(t * 2 * Math.PI * 51.7));
    u.setP!.value = ease.inOutQuad(clamp((t - 109.16) / (T_CUT - 0.08 - 109.16)));
    u.wetAll!.value = 1;
    u.vibA!.value = 0.35 + 0.65 * Math.pow(0.5, (t - lastB) / 0.12);

    // light: the raking lamp (low, from the left of frame = bench +x) and the overhead tube behind
    if (!castMode) {
      (u.lampPos!.value as THREE.Vector3).set(420, 150, 40);
      (u.tubeP!.value as THREE.Vector3).set(0, 520, 470);
      u.lampI!.value = 1.0; u.tubeI!.value = 1.0; u.fillK!.value = 0.05; u.topK!.value = 0.06;
    } else {
      // the lamp's swing on each word of "Late night devil, put your hands on me" (stub): from the left, past the front
      let sw = 0;
      const L3 = this.phrases.find((q) => q.key.startsWith(`${this.phrases[7]!.words[0]!.line}:`));
      if (L3) {
        const ws = this.ctx.lyrics.lines[L3.words[0]!.line]!.words;
        ws.forEach((w, i) => { sw += ease.inOutCubic(clamp((t - w.start + 0.05) / 0.3)) * (i % 2 ? -1 : 1); });
      }
      const ang = num(qs, 'lang', 0.36) + 0.55 * sw;
      (u.lampPos!.value as THREE.Vector3).set(330 * Math.cos(ang), num(qs, 'ly', 60), -330 * Math.sin(ang));
      (u.tubeP!.value as THREE.Vector3).set(0, 600, 300);
      u.lampI!.value = num(qs, 'li', 1.0); u.tubeI!.value = 0.5; u.fillK!.value = 0.03; u.topK!.value = num(qs, 'top', 0.1);
    }
    const lp = u.lampPos!.value as THREE.Vector3;
    const aim = castMode ? new THREE.Vector3(0, -20, 0) : new THREE.Vector3(0, 10, 20);
    (u.lampDir!.value as THREE.Vector3).copy(aim.clone().sub(lp).normalize());
    u.lampCone!.value = 0.86;
    // the cast set down: a few tenths of a mm of settle in the first frames after the cut
    const ds = castMode ? 0.5 * Math.pow(0.5, (t - T_CUT) / 0.03) : 0;
    (u.castOff!.value as THREE.Vector3).set(0, ds, 0);

    this.march.render(renderer, this.rt);
    const fp = C.focus ?? (castMode ? new THREE.Vector3(0, -28, -12) : new THREE.Vector3(0, POUR.SURF, 18));
    const d = this.dof.u;
    d.src!.value = this.rt.texture;
    d.focusD!.value = fp.clone().sub(C.pos).dot(fw);
    d.aper!.value = C.aper * 1.0;
    d.maxCoc!.value = 18;
    this.dof.render(renderer, out);
    return {};
  }
}
