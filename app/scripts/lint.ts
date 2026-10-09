// Frame checker (`render.ts lint`): steps the scenes frame by frame without drawing them, reads where every 3D
// letter (Word3D) stands on screen and checks the mechanical rules of docs/critic-checklist.md against the sung
// timings in data/<song>/lyrics.json. It replaces the frame-by-frame part of a critic's job (pops, overlaps,
// leftovers, crops); the critic keeps the judgement calls (composition, readability at a glance, taste).
//
// How it reads the frames: every scene is searched (4 levels of its fields) for stages, objects with `render()`,
// `words: Word3D[]` and `cam: StageCam` (Stage, CupStage, HorseStage, ...). Each stage's render is wrapped: right after
// it draws, the checker takes the camera and, for every shown letter (`on` and visible up to the stage's scene), the
// extent of its mesh's bounding box in logical px, its front face as a screen polygon (both cut at a clip plane in
// the letter's shader: circe's wine) and how squarely it faces the camera. Words drawn with fillText during a scene's
// render (drawPhrase) are recorded too, for the timing checks only. The renderer's draw calls are stubbed out
// (`--draw` keeps them), so a frame costs the scene logic only (the whole video: 16 s in the cloud container).
//
// Not seen: type painted into a texture (endless' inscription, symbolon's REUNITE, souls' LINE), letters hidden
// behind geometry or shown only in a mirror image, stages created after init or drawn into a texture that is then
// remapped. A stage drawn twice in one frame is checked as of its last draw. Intended re-letterings are reported
// like any other case (circe's COLDER losing its C to read OLDER).
//
// Timing warnings beyond the checklist (client rules, 2026-10-09):
//  - LINGER: a hero word (all capitals) still on screen more than LINGER (0.6 s) after its sung end while later
//    words of its own line are being sung (a hero leaves ~0.3 s after its word unless something still happens to it).
//  - SLOW-RISE: a word not fully up within min(RISE = 0.12 s, its sung length) of its onset, per run that shows it:
//    fully up = every letter shown and the word's median facing at least RISE_SQUARE (90%) of its best facing with
//    all letters shown in the first RISE_LOOK (0.5 s) (and not edge-on). Words shown late are left to LATE.
import type { Page } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const W = 1920, H = 1080;
/** Title-safe margin (logical px), docs/critic-checklist.md item 3. */
const SAFE = 96;
/** A word shown more than this before its sung onset is an error (item 1); more than EARLY_WARN, a warning
 *  (popWords starts letters POP.lead = 45 ms before the onset, plus 14 ms per letter). */
const EARLY_ERR = 0.4, EARLY_WARN = 0.11;
/** First on screen this long after its onset: late. */
const LATE = 0.1;
/** Two lyric lines on screen together for longer than this (an exit fall is 0.22 s): a couplet (item 2). */
const LINES_MAX = 0.3;
/** The front faces of two different words' letters overlapping by more than this share of the smaller face, and by
 *  COLLIDE_PX px² at least: a collision (item 5). */
const COLLIDE = 0.2, COLLIDE_PX = 150;
/** A cut: the camera turns more than this in one frame (degrees), or moves more than CUT_MOVE of its distance to the
 *  letters (at least 1 unit), or the scene, the stage or the fov (by 20%) changes. */
const CUT_TURN = 12, CUT_MOVE = 0.15;
/** Letters this many frames before a cut must not be new on screen (item 7). */
const PRECUT = 2;
/** Readable size (px of the tallest letter's ink box), edge-on (|cos| of the face to the camera, ~75 degrees), and
 *  how long a state must last to count (s). */
const TINY = 14, EDGE = 0.26, HOLD = 0.1;
/** A word fully on screen for less than this: a blink. */
const SHORT = 0.2;
/** A hero word still on screen this long after its sung end while later words of its line are sung: lingering. */
const LINGER = 0.6;
/** A word must be fully up (every letter shown, facing the camera as squarely as it will) within this long of its
 *  onset, or within its sung length if shorter; `RISE_SQUARE` of its best facing in the first RISE_LOOK s counts. */
const RISE = 0.12, RISE_SQUARE = 0.9, RISE_LOOK = 0.5;
/** Accepted overlaps (client-approved: "us?" over EVERYTHING's T and H), as pairs of normalised words. */
const ALLOW: [string, string][] = [['us', 'everything']];

type Sev = 'ERROR' | 'WARN' | 'INFO';
export interface Issue { sev: Sev; code: string; t0: number; t1: number; what: string; detail: string }
interface Entry { id: string; start: number; end: number }
interface LW { id: string; line: number; k: number; w: string; n: string; start: number; end: number; voice: string }
/** [index in string, word index, x0, y0, x1, y1 (the box's extent, logical px, y down), cos (front face to camera),
 *  nearest and farthest depth, the front face as a screen polygon (x, y, x, y, ...; empty when it crosses the near plane)] */
type LetterRec = [number, number, number, number, number, number, number, number, number, number[]];
interface RunRec { ri: number; text: string; wl: number[]; L: LetterRec[] }
interface Cap { scene: string; stage: string; cam?: number[]; runs: RunRec[]; error?: string }
/** `texts`: strings drawn with fillText on a 2D canvas during a scene's render (drawPhrase), with their alpha. */
interface Frame { t: number; scenes: string[]; caps: Cap[]; texts: { scene: string; text: string; a: number }[] }

// ------------------------------------------------------------------ the page side
/** Runs in the page: stubs the draw calls, finds the stages, wraps their render. Self-contained (serialised). */
function installProbe(draw: boolean) {
  const P = (window as any).__pdoom, E = P.engine;
  if (!draw) { const R = E.renderer; R.render = () => {}; R.clear = () => {}; }
  const isStage = (o: any) => typeof o.render === 'function' && Array.isArray(o.words) && o.cam && typeof o.cam.project === 'function';
  const skip = (o: any) => o.isObject3D || o.isMaterial || o.isTexture || o.isBufferGeometry || o.isRenderTarget || o.isWebGLRenderTarget
    || ArrayBuffer.isView(o) || o instanceof ArrayBuffer || typeof o.getContext === 'function' || o instanceof CanvasRenderingContext2D
    || o === E || o === E.renderer || o === E.audio || o === E.lyrics || o === E.comp || o === E.hud || o === E.post;
  const r1 = (v: number) => Math.round(v * 10) / 10, r3 = (v: number) => Math.round(v * 1000) / 1000;
  const wlCache = new WeakMap<object, number[]>();
  const wl = (w: any) => {
    let a = wlCache.get(w);
    if (!a) { a = []; for (const l of w.letters) a[l.word] = (a[l.word] ?? 0) + 1; for (let i = 0; i < a.length; i++) a[i] ??= 0; wlCache.set(w, a); }
    return a;
  };
  const capture = (st: any) => {
    const C = st.cam.cam;
    C.updateMatrixWorld();
    if (st.scene) st.scene.updateMatrixWorld();
    const ce = C.matrixWorld.elements;
    const px = ce[12], py = ce[13], pz = ce[14];
    const fl = Math.hypot(ce[8], ce[9], ce[10]) || 1;
    const runs: any[] = [];
    st.words.forEach((w: any, ri: number) => {
      let vis = true, root = w.group;
      for (let o = w.group; o; o = o.parent) { if (!o.visible) vis = false; root = o; }
      if (!vis || (st.scene && root !== st.scene) || w.prop) return;
      const L: number[][] = [];
      for (const l of w.letters) {
        const m = l.mesh;
        if (!(l.on > 0.5) || !m.visible) continue;
        const g = m.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        const b = g.boundingBox, e = m.matrixWorld.elements;
        const wp = (lx: number, ly: number, lz: number) => [e[0] * lx + e[4] * ly + e[8] * lz + e[12], e[1] * lx + e[5] * ly + e[9] * lz + e[13], e[2] * lx + e[6] * ly + e[10] * lz + e[14]];
        const corner = (k: number) => wp(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z);
        const C8 = [0, 1, 2, 3, 4, 5, 6, 7].map(corner);
        // a clip plane in the letter's shader (circe's cup: discarded where clipS * (y - clipY) < 0)
        const u = l.mat?.uniforms;
        const clip = u?.clipY && u?.clipS ? [u.clipY.value as number, u.clipS.value as number] : null;
        const keep = (p: number[]) => !clip || clip[1]! * (p[1]! - clip[0]!) >= 0;
        const cut = (p: number[], q: number[]) => { const s = (clip![0]! - p[1]!) / (q[1]! - p[1]!); return [p[0]! + s * (q[0]! - p[0]!), clip![0]!, p[2]! + s * (q[2]! - p[2]!)]; };
        const pts = C8.filter(keep);
        if (clip) for (let k = 0; k < 8; k++) for (const bit of [1, 2, 4]) if (!(k & bit) && keep(C8[k]!) !== keep(C8[k | bit]!)) pts.push(cut(C8[k]!, C8[k | bit]!));
        if (!pts.length) continue;   // wholly under the surface
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, d0 = Infinity, d1 = -Infinity;
        for (const q of pts) {
          const p = st.cam.project({ x: q[0], y: q[1], z: q[2] });
          x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
          d0 = Math.min(d0, p.depth); d1 = Math.max(d1, p.depth);
        }
        // the front face (local +z) as a screen polygon, clipped by the plane too: what collides with other letters
        let face = [C8[4]!, C8[5]!, C8[7]!, C8[6]!];
        if (clip) {
          const f2: number[][] = [];
          face.forEach((p, k) => { const q = face[(k + 1) % 4]!; if (keep(p)) f2.push(p); if (keep(p) !== keep(q)) f2.push(cut(p, q)); });
          face = f2;
        }
        const fp = face.map((q) => st.cam.project({ x: q[0], y: q[1], z: q[2] }));
        const poly = fp.some((p: any) => p.depth <= 0.05) ? [] : fp.flatMap((p: any) => [r1(p.x), r1(p.y)]);
        // facing: the letter's front (local +z) against the direction to the camera, from the box's centre
        const c = wp((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
        const vx = px - c[0]!, vy = py - c[1]!, vz = pz - c[2]!;
        const cos = (e[8] * vx + e[9] * vy + e[10] * vz) / ((Math.hypot(vx, vy, vz) || 1) * (Math.hypot(e[8], e[9], e[10]) || 1));
        L.push([l.i, l.word, r1(x0), r1(y0), r1(x1), r1(y1), r3(cos), r3(d0), r3(d1), poly]);
      }
      if (L.length) runs.push({ ri, text: w.text, wl: wl(w), L });
    });
    return { cam: [px, py, pz, -ce[8] / fl, -ce[9] / fl, -ce[10] / fl, C.fov].map(r3), runs };
  };
  const caps = new Map<string, any[]>(), rendered: string[] = [];
  // 2D type (drawPhrase): every fillText inside a scene's render, with its alpha (globalAlpha x the fill's)
  let texts: { scene: string; text: string; a: number }[] = [], current: string | null = null, recording = false;
  for (const C2 of [globalThis.CanvasRenderingContext2D, (globalThis as any).OffscreenCanvasRenderingContext2D]) {
    if (!C2) continue;
    const fill = C2.prototype.fillText;
    C2.prototype.fillText = function (this: any, text: string, ...rest: any[]) {
      if (recording && current) {
        let a = this.globalAlpha;
        const m = typeof this.fillStyle === 'string' ? /rgba\(([^)]*)\)/.exec(this.fillStyle) : null;
        if (m) a *= parseFloat(m[1]!.split(',')[3] ?? '1');
        if (a > 0.05) texts.push({ scene: current, text: String(text), a: r3(a) });
      }
      return fill.call(this, text, ...rest);
    };
  }
  const stagesOf: Record<string, string[]> = {};
  for (const [id, rec] of E.loaded as Map<string, any>) {
    const s = rec.scene;
    if (!s) continue;
    const found = new Map<any, string>(), seen = new Set<any>([s]);
    let q: [any, string][] = [[s, '']];
    for (let d = 0; d < 4 && q.length; d++) {
      const next: [any, string][] = [];
      for (const [o, p] of q) {
        const kids: [string, any][] = Array.isArray(o) ? o.slice(0, 64).map((v: any, i: number) => [`${p}[${i}]`, v])
          : o instanceof Map ? [...o].slice(0, 64).map(([k, v]) => [`${p}[${String(k)}]`, v])
          : Object.keys(o).map((k) => [p ? `${p}.${k}` : k, o[k]]);
        for (const [k, v] of kids) {
          if (!v || typeof v !== 'object' || seen.has(v)) continue;
          seen.add(v);
          if (skip(v)) continue;
          if (isStage(v)) { found.set(v, k); continue; }
          next.push([v, k]);
        }
      }
      q = next;
    }
    stagesOf[id] = [...found.values()];
    caps.set(id, []);
    for (const [st, key] of found) {
      const orig = st.render;
      st.render = function (this: any, ...a: any[]) {
        const r = orig.apply(this, a);
        const list = caps.get(id)!;
        const k = list.findIndex((x) => x.stage === key);
        if (k >= 0) list.splice(k, 1);
        try { list.push({ scene: id, stage: key, ...capture(this) }); } catch (err) { list.push({ scene: id, stage: key, runs: [], error: String(err) }); }
        return r;
      };
    }
    const origS = s.render;
    // (a stateful scene pre-rolls through several renders after a seek: only the frame's own render counts)
    s.render = function (this: any, ...a: any[]) {
      caps.set(id, []);
      texts = texts.filter((x) => x.scene !== id);
      if (!rendered.includes(id)) rendered.push(id);
      const was = current;
      current = id;
      try { return origS.apply(this, a); } finally { current = was; }
    };
  }
  (window as any).__lint = {
    frames(ts: number[], dt: number) {
      return ts.map((t) => {
        rendered.length = 0;
        texts = [];
        recording = true;
        try { E.render(t, dt, false, 1, 0.5); } finally { recording = false; }
        return { t, scenes: [...rendered], caps: rendered.flatMap((id) => caps.get(id) ?? []), texts };
      });
    },
  };
  return { stagesOf, loaded: [...(E.loaded as Map<string, any>)].filter(([, r]) => r.scene).map(([id]) => id) };
}

// ------------------------------------------------------------------ analysis
const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
const isHero = (text: string) => /[A-Z]/.test(text) && text === text.toUpperCase() && text.replace(/[^A-Za-z]/g, '').length >= 2;
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1]! : 0; };
/** Shoelace area (signed), a flat x,y list → counter-clockwise points (in the sense of a positive area), and the
 *  intersection of two convex polygons (Sutherland-Hodgman). */
const polyArea = (p: number[][]) => p.reduce((a, q, i) => { const r = p[(i + 1) % p.length]!; return a + q[0]! * r[1]! - r[0]! * q[1]!; }, 0) / 2;
function ccw(flat: number[]) {
  const p: number[][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) p.push([flat[i]!, flat[i + 1]!]);
  return polyArea(p) < 0 ? p.reverse() : p;
}
function clipPoly(subject: number[][], clip: number[][]) {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i]!, b = clip[(i + 1) % clip.length]!, inp = out;
    const side = (p: number[]) => (b[0]! - a[0]!) * (p[1]! - a[1]!) - (b[1]! - a[1]!) * (p[0]! - a[0]!);
    out = [];
    inp.forEach((p, j) => {
      const q = inp[(j + 1) % inp.length]!, sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0]! + t * (q[0]! - p[0]!), p[1]! + t * (q[1]! - p[1]!)]); }
    });
  }
  return out;
}

/** Consecutive frame indices → [first, last] spans. */
function spans(fs: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const f of fs) { const l = out[out.length - 1]; if (l && f === l[1] + 1) l[1] = f; else out.push([f, f]); }
  return out;
}

/** One word of a run on one frame. */
interface WV {
  key: string; run: string; wi: number; text: string; hero: boolean; lw: LW | null;
  n: number; shown: number; on: number; boxes: number[][]; faces: number[][][]; h: number; cos: number; near: boolean; crop: boolean; unsafe: boolean;
}

function lyricWords(lyrics: any): LW[] {
  const out: LW[] = [];
  for (const l of lyrics.lines) l.words.forEach((w: any, k: number) =>
    out.push({ id: `L${l.i}.${k}`, line: l.i, k, w: w.w, n: norm(w.w), start: w.start, end: w.end, voice: l.voice ?? 'lead' }));
  return out;
}

/** The lyric words a run's words stand for: the contiguous match whose onsets sit nearest to when they were first
 *  seen; failing that, word by word. */
function mapRun(words: string[], seen: (number | undefined)[], lyr: LW[]): (LW | null)[] {
  const ns = words.map(norm);
  let best = -1, bestCost = Infinity;
  for (let p = 0; p + ns.length <= lyr.length; p++) {
    let ok = true;
    for (let j = 0; j < ns.length && ok; j++) ok = lyr[p + j]!.n === ns[j];
    if (!ok) continue;
    let c = 0, m = 0;
    ns.forEach((_, j) => { if (seen[j] !== undefined) { c += Math.abs(seen[j]! - lyr[p + j]!.start); m++; } });
    const cost = m ? c / m : 1e6;
    if (cost < bestCost) { bestCost = cost; best = p; }
  }
  if (best >= 0) return ns.map((_, j) => lyr[best + j]!);
  return ns.map((n, j) => {
    let b: LW | null = null, bc = Infinity;
    for (const x of lyr) if (x.n === n) { const c = Math.abs((seen[j] ?? x.start) - x.start); if (c < bc) { bc = c; b = x; } }
    return b;
  });
}

export function analyse(frames: Frame[], timeline: Entry[], loaded: string[], lyrics: any, from: number, to: number, fps: number) {
  const issues: Issue[] = [];
  const add = (sev: Sev, code: string, f0: number, f1: number, what: string, detail: string) =>
    issues.push({ sev, code, t0: +frames[f0]!.t.toFixed(3), t1: +frames[f1]!.t.toFixed(3), what, detail });
  const N = frames.length, dt = 1 / fps;
  const lyr = lyricWords(lyrics);
  const minFrames = (s: number) => Math.max(1, Math.round(s * fps));

  // pass 1: what each run's words look like and when each is first seen
  const runs = new Map<string, { text: string; words: string[]; seen: (number | undefined)[]; map: (LW | null)[] }>();
  for (const fr of frames) for (const c of fr.caps) for (const r of c.runs) {
    const key = `${c.scene}/${c.stage}#${r.ri}`;
    let R = runs.get(key);
    if (!R) runs.set(key, R = { text: r.text, words: r.text.split(/\s+/).filter(Boolean), seen: [], map: [] });
    for (const l of r.L) if (R.seen[l[1]] === undefined && l[8] > 0.05) R.seen[l[1]] = fr.t;
  }
  for (const R of runs.values()) R.map = mapRun(R.words, R.seen, lyr);
  const label = (v: { text: string; lw: LW | null; run?: string }) => `'${v.text}'${v.lw ? ` (L${v.lw.line}.${v.lw.k})` : ' (no lyric match)'}${v.run?.endsWith('/2D') ? ' (2D)' : ''}`;

  // pass 2: every shown run word on every frame
  const vis: WV[][] = frames.map((fr) => {
    const out: WV[] = [];
    for (const c of fr.caps) for (const r of c.runs) {
      const rk = `${c.scene}/${c.stage}#${r.ri}`, R = runs.get(rk)!;
      const byWord = new Map<number, LetterRec[]>();
      for (const l of r.L) { const a = byWord.get(l[1]) ?? []; a.push(l); byWord.set(l[1], a); }
      for (const [wi, ls] of byWord) {
        const lw = R.map[wi] ?? null, text = R.words[wi] ?? '?';
        const v: WV = { key: lw ? lw.id : `?${rk}:${wi}`, run: rk, wi, text, hero: isHero(text), lw, n: r.wl[wi] ?? ls.length, shown: ls.length, on: 0,
          boxes: [], faces: [], h: 0, cos: 1, near: false, crop: false, unsafe: false };
        const coss: number[] = [];
        for (const l of ls) {
          const b = [l[2], l[3], l[4], l[5]];
          if (l[7] <= 0.05) { if (l[8] > 0.05) { v.on++; v.near = true; } continue; }
          if (b[2]! < 0 || b[0]! > W || b[3]! < 0 || b[1]! > H) { v.crop = true; continue; }
          v.on++;
          v.boxes.push(b);
          const face = ccw(l[9]);
          if (face.length >= 3 && polyArea(face) > 1) v.faces.push(face);
          coss.push(l[6]);
          v.h = Math.max(v.h, b[3]! - b[1]!);
          if (b[0]! < 0 || b[2]! > W || b[1]! < 0 || b[3]! > H) v.crop = true;
          else if (b[0]! < SAFE || b[2]! > W - SAFE || b[1]! < SAFE || b[3]! > H - SAFE) v.unsafe = true;
        }
        v.cos = coss.length ? median(coss) : 1;
        out.push(v);
      }
    }
    return out;
  });

  // cuts: the first frame of each new shot. A change of scene or stage is a cut; a camera jump is one when it is a
  // one-frame spike, several times the camera's motion on the frames either side (a fast crane or a whip is not)
  const active = (t: number) => timeline.filter((e) => t >= e.start && t < e.end).map((e) => e.id).join(',');
  const capKeys = (fr: Frame) => fr.caps.map((c) => `${c.scene}/${c.stage}`).sort().join();
  const hard: (string | null)[] = frames.map((fr, f) => {
    if (f === 0) return null;
    const a = frames[f - 1]!;
    if (active(a.t) !== active(fr.t)) return 'scene';
    const ka = capKeys(a), kb = capKeys(fr);
    return ka !== kb && ka && kb ? 'stage' : null;
  });
  // camera change against the frame before, in units of the cut thresholds (> 1: a jump)
  const jump = frames.map((fr, f) => {
    let worst = 0, why = '';
    if (f === 0 || hard[f]) return { d: 0, why };
    for (const cb of fr.caps) {
      const ca = frames[f - 1]!.caps.find((c) => c.scene === cb.scene && c.stage === cb.stage);
      if (!ca?.cam || !cb.cam) continue;
      const [ax, ay, az, afx, afy, afz, afov] = ca.cam as [number, number, number, number, number, number, number];
      const [bx, by, bz, bfx, bfy, bfz, bfov] = cb.cam as [number, number, number, number, number, number, number];
      const turn = (Math.acos(Math.min(1, Math.max(-1, afx * bfx + afy * bfy + afz * bfz))) * 180) / Math.PI;
      const ds = ca.runs.flatMap((r) => r.L.map((l) => l[7])).filter((d) => d > 0.05);
      const move = Math.hypot(bx - ax, by - ay, bz - az), moveMax = Math.max(1, CUT_MOVE * (ds.length ? median(ds) : 8));
      const d = Math.max(turn / CUT_TURN, move / moveMax, Math.abs(bfov / afov - 1) / 0.2);
      if (d > worst) { worst = d; why = `camera (${turn.toFixed(0)} deg, ${move.toFixed(2)} units)`; }
    }
    return { d: worst, why };
  });
  const cuts: { f: number; why: string }[] = [];
  for (let f = 1; f < N; f++) {
    if (hard[f]) { cuts.push({ f, why: hard[f]! }); continue; }
    const d = jump[f]!.d, around = Math.max(jump[f - 1]?.d ?? 0, jump[f + 1]?.d ?? 0);
    if (d > 1 && d > 2.5 * around) cuts.push({ f, why: jump[f]!.why });
  }

  // per screen key (a lyric word, or an unmatched run word): the frames it is on screen
  const onSet = new Map<string, Set<number>>(), sample = new Map<string, { text: string; lw: LW | null; run: string }>();
  const mark = (k: string, f: number) => { const a = onSet.get(k) ?? new Set<number>(); a.add(f); onSet.set(k, a); };
  vis.forEach((vs, f) => {
    for (const v of vs) if (v.on > 0) mark(v.key, f);
    for (const v of vs) if (!sample.has(v.key)) sample.set(v.key, v);
  });
  // 2D words (timing only: where they sit on screen is not known): each stretch a scene draws a word stands for the
  // sung word of that text whose onset is nearest to the stretch's start
  const twoD = new Map<string, { text: string; scene: string; fs: number[] }>();
  frames.forEach((fr, f) => {
    for (const x of fr.texts ?? []) for (const w of x.text.split(/\s+/)) {
      const n = norm(w);
      if (!n) continue;
      const k = `${x.scene}|${n}`, e = twoD.get(k) ?? { text: w, scene: x.scene, fs: [] };
      if (e.fs[e.fs.length - 1] !== f) e.fs.push(f);
      twoD.set(k, e);
    }
  });
  for (const [k, e] of twoD) for (const [s0, s1] of spans(e.fs)) {
    const n = norm(e.text), t0 = frames[s0]!.t;
    let lw: LW | null = null;
    for (const x of lyr) if (x.n === n && (!lw || Math.abs(x.start - t0) < Math.abs(lw.start - t0))) lw = x;
    const key = lw && Math.abs(lw.start - t0) < 8 ? lw.id : `?2d:${k}`;
    for (let f = s0; f <= s1; f++) mark(key, f);
    if (!sample.has(key)) sample.set(key, { text: e.text, lw: key.startsWith('?') ? null : lw, run: `${e.scene}/2D` });
  }
  const onFrames = new Map([...onSet].map(([k, fs]) => [k, [...fs].sort((a, b) => a - b)] as const));

  // timing: early, late, pre-cut pops, blinks
  for (const [k, fs] of onFrames) {
    const v = sample.get(k)!, lw = v.lw;
    const f0 = fs[0]!;
    if (lw) {
      const t0 = frames[f0]!.t, lead = lw.start - t0;
      if (lead > EARLY_ERR) add('ERROR', 'EARLY', f0, f0, label(v), `on screen ${lead.toFixed(2)} s before it is sung (${lw.start.toFixed(2)})${f0 === 0 ? ' (already at the range start)' : ''}`);
      else if (lead > EARLY_WARN) add('WARN', 'EARLY', f0, f0, label(v), `on screen ${lead.toFixed(2)} s before it is sung (${lw.start.toFixed(2)})`);
      else if (f0 > 0 && -lead > LATE + dt) add('WARN', 'LATE', f0, f0, label(v), `first on screen ${(-lead).toFixed(2)} s after its onset (${lw.start.toFixed(2)})`);
    }
    for (const [s0, s1] of spans(fs)) {
      const cut = cuts.find((c) => c.f > s0 && c.f - s0 <= PRECUT);
      if (s0 > 0 && cut) add('ERROR', 'PRE-CUT POP', s0, s1, label(v), `new on screen ${cut.f - s0} frame(s) before the cut at ${frames[cut.f]!.t.toFixed(3)} (${cut.why})`);
      if (s0 > 0 && s1 < N - 1 && (s1 - s0 + 1) * dt < SHORT) add('WARN', 'BLINK', s0, s1, label(v), `on screen ${((s1 - s0 + 1) * dt).toFixed(2)} s only`);
    }
  }

  // missing: sung in the checked range, inside a loaded scene, never on screen
  const covered = (t: number) => timeline.some((e) => loaded.includes(e.id) && t >= e.start && t < e.end);
  for (const w of lyr) if (w.start >= from && w.start < to - dt && covered(w.start) && !onFrames.has(w.id))
    issues.push({ sev: 'WARN', code: 'MISSING', t0: w.start, t1: w.end, what: `'${w.w}' (L${w.line}.${w.k}, ${w.voice})`, detail: 'sung but never on screen' });

  // two lyric lines on screen together (not sung together)
  const lineSpan = new Map<number, [number, number]>();
  for (const l of lyrics.lines) lineSpan.set(l.i, [l.start, l.end]);
  const pairFrames = new Map<string, number[]>();
  vis.forEach((vs, f) => {
    const lines = [...new Set(vs.filter((v) => v.on > 0 && v.lw).map((v) => v.lw!.line))].sort((a, b) => a - b);
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const a = lineSpan.get(lines[i]!)!, b = lineSpan.get(lines[j]!)!;
      if (a[0] < b[1] && b[0] < a[1]) continue;   // sung over each other (lead and ensemble)
      const k = `${lines[i]}|${lines[j]}`, arr = pairFrames.get(k) ?? [];
      arr.push(f); pairFrames.set(k, arr);
    }
  });
  for (const [k, fs] of pairFrames) for (const [s0, s1] of spans(fs)) {
    if ((s1 - s0 + 1) * dt <= LINES_MAX) continue;
    const [a, b] = k.split('|');
    add('WARN', 'TWO LINES', s0, s1, `L${a} + L${b}`, `both on screen for ${((s1 - s0 + 1) * dt).toFixed(2)} s`);
  }

  // collisions: letter boxes of different words overlapping
  const pairHits = new Map<string, { fs: number[]; worst: number; a: WV; b: WV }>();
  vis.forEach((vs, f) => {
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
      const a = vs[i]!, b = vs[j]!;
      if (a.key === b.key) continue;
      if (ALLOW.some(([x, y]) => (norm(a.text) === x && norm(b.text) === y) || (norm(a.text) === y && norm(b.text) === x))) continue;
      let worst = 0;
      for (const fa of a.faces) for (const fb of b.faces) {
        const x = clipPoly(fa, fb), xa = x.length >= 3 ? polyArea(x) : 0;
        if (xa >= COLLIDE_PX) worst = Math.max(worst, xa / Math.min(polyArea(fa), polyArea(fb)));
      }
      if (worst <= COLLIDE) continue;
      const k = [a.key, b.key].sort().join('|');
      const e = pairHits.get(k) ?? { fs: [], worst: 0, a, b };
      e.fs.push(f); e.worst = Math.max(e.worst, worst); pairHits.set(k, e);
    }
  });
  for (const e of pairHits.values()) for (const [s0, s1] of spans(e.fs)) {
    const n = s1 - s0 + 1;
    add(n >= 3 ? 'ERROR' : 'WARN', 'COLLISION', s0, s1, `${label(e.a)} x ${label(e.b)}`, `letters overlap (up to ${(e.worst * 100).toFixed(0)}% of the smaller face) for ${n} frame(s)`);
  }

  // per run word: leftovers, size, angle, crops
  const byRunWord = new Map<string, { v: WV; fs: Map<number, WV> }>();
  vis.forEach((vs, f) => { for (const v of vs) { const k = `${v.run}:${v.wi}`; const e = byRunWord.get(k) ?? { v, fs: new Map() }; e.fs.set(f, v); byRunWord.set(k, e); } });
  const held = (fs: Map<number, WV>, pred: (v: WV) => boolean, s: number, code: string, sev: Sev, v0: WV, detail: (vs: WV[]) => string, not?: Set<number>) => {
    for (const [s0, s1] of spans([...fs].filter(([f, v]) => pred(v) && !not?.has(f)).map(([f]) => f))) {
      if ((s1 - s0 + 1) * dt < s - 1e-6) continue;
      const vs = [...fs].filter(([f]) => f >= s0 && f <= s1).map(([, v]) => v);
      add(sev, code, s0, s1, `${label(v0)} [${v0.run}]`, detail(vs));
    }
  };
  for (const { v, fs } of byRunWord.values()) {
    // a lone letter left over (more were shown just before) is an error; a word still being built is only partial
    const left = new Set<number>();
    if (v.n >= 3) for (const [s0, s1] of spans([...fs].filter(([, x]) => x.shown === 1).map(([f]) => f))) {
      if ((fs.get(s0 - 1)?.shown ?? 0) < 2 || (s1 - s0 + 1) * dt < HOLD - 1e-6) continue;
      for (let f = s0; f <= s1; f++) left.add(f);
      add('ERROR', 'LEFTOVER', s0, s1, `${label(v)} [${v.run}]`, `1 of ${v.n} letters left on screen after the others went`);
    }
    held(fs, (x) => x.shown > 0 && x.shown < x.n, SHORT, 'PARTIAL', 'WARN', v, (vs) => `${Math.min(...vs.map((x) => x.shown))}-${Math.max(...vs.map((x) => x.shown))} of ${v.n} letters shown`, left);
    held(fs, (x) => x.on > 0 && !x.near && x.boxes.length > 0 && x.h < TINY, HOLD, 'TINY', 'WARN', v, (vs) => `${Math.max(...vs.map((x) => x.h)).toFixed(0)} px tall at most`);
    held(fs, (x) => x.on > 0 && x.h >= TINY && x.cos > -EDGE && x.cos < EDGE, HOLD, 'EDGE-ON', 'WARN', v, (vs) => `faces the camera at ${Math.min(...vs.map((x) => (Math.acos(Math.min(1, Math.abs(x.cos))) * 180) / Math.PI)).toFixed(0)}-${Math.max(...vs.map((x) => (Math.acos(Math.min(1, Math.abs(x.cos))) * 180) / Math.PI)).toFixed(0)} deg off square`);
    held(fs, (x) => x.on > 0 && x.cos <= -EDGE, 2 * dt, 'BACKWARDS', 'WARN', v, () => 'seen from behind (reads mirrored)');
    held(fs, (x) => x.crop && x.shown > 0, HOLD, 'CROP', 'WARN', v, () => 'letters cut by the frame edge or off frame');
    held(fs, (x) => x.unsafe && !x.crop, HOLD, 'TITLE-SAFE', 'WARN', v, (vs) => {
      const m = Math.min(...vs.flatMap((x) => x.boxes.map((b) => Math.min(b[0]!, W - b[2]!, b[1]!, H - b[3]!))));
      return `${v.hero ? 'hero ' : ''}letters ${m.toFixed(0)} px from the edge (safe: ${SAFE})`;
    });
  }

  // lingering heroes: on screen > LINGER after their sung end while a later word of their line is being sung
  const lineSung = new Map<number, [number, number][]>();
  for (const w of lyr) { const a = lineSung.get(w.line) ?? []; a.push([w.start, w.end]); lineSung.set(w.line, a); }
  for (const [k, fs] of onFrames) {
    const v = sample.get(k)!, lw = v.lw;
    if (!lw || !isHero(v.text)) continue;
    const later = lyr.filter((x) => x.line === lw.line && x.k > lw.k);
    const sung = (t: number) => later.some((x) => t >= x.start && t < x.end);
    for (const [s0, s1] of spans(fs.filter((f) => frames[f]!.t > lw.end + LINGER && sung(frames[f]!.t))))
      add('WARN', 'LINGER', s0, s1, `${label(v)} [${v.run}]`, `hero still on screen ${(frames[s1]!.t - lw.end).toFixed(2)} s after its sung end (${lw.end.toFixed(2)}) while the rest of its line is sung`);
  }

  // slow rises: a word not fully up (all letters on, facing as squarely as it will soon) within min(RISE, its sung
  // length) of its onset, in each run that shows it by then
  for (const { v, fs } of byRunWord.values()) {
    const lw = v.lw;
    if (!lw || v.run.endsWith('/2D')) continue;
    const allow = Math.min(RISE, lw.end - lw.start), at = (f: number) => frames[f]!.t;
    const near = [...fs].filter(([f, x]) => x.on > 0 && at(f) >= lw.start - EARLY_WARN && at(f) <= lw.start + RISE_LOOK).sort((a, b) => a[0] - b[0]);
    if (!near.length || at(near[0]![0]) > lw.start + allow) continue;   // (shown late, or not by this run: LATE / MISSING)
    if (at(near[near.length - 1]![0]) < lw.start + allow + dt || near[near.length - 1]![0] >= N - 1) continue;   // (gone or range end before the deadline)
    const best = Math.max(...near.filter(([, x]) => x.on >= x.n).map(([, x]) => x.cos), -1);
    const full = near.find(([f, x]) => at(f) >= lw.start - dt / 2 && x.on >= x.n && x.cos >= Math.max(EDGE, RISE_SQUARE * best));
    const tFull = full ? at(full[0]) - lw.start : Infinity;
    if (tFull > allow + dt / 2) {
      const f0 = near.find(([f]) => at(f) >= lw.start - dt / 2)?.[0] ?? near[0]![0];
      add('WARN', 'SLOW-RISE', f0, full ? full[0] : near[near.length - 1]![0], `${label(v)} [${v.run}]`,
        full ? `fully up ${tFull.toFixed(2)} s after its onset (${lw.start.toFixed(2)}; allowed ${allow.toFixed(2)})` : `not fully up within ${RISE_LOOK} s of its onset (${lw.start.toFixed(2)})`);
    }
  }

  // unmatched run words
  for (const [k, fs] of onFrames) if (k.startsWith('?')) { const v = sample.get(k)!; add('INFO', 'NO LYRIC', fs[0]!, fs[fs.length - 1]!, `${label(v)} [${v.run}]`, 'a shown word that matches no sung word'); }

  const order: Record<Sev, number> = { ERROR: 0, WARN: 1, INFO: 2 };
  issues.sort((a, b) => order[a.sev] - order[b.sev] || a.t0 - b.t0);

  // the words table: sung vs shown
  const words = lyr.filter((w) => w.start >= from && w.start < to).map((w) => {
    const fs = onFrames.get(w.id);
    return { id: w.id, w: w.w, sung: [w.start, w.end], shown: fs ? [frames[fs[0]!]!.t, frames[fs[fs.length - 1]!]!.t] : null };
  });
  return { issues, cuts: cuts.map((c) => ({ t: +frames[c.f]!.t.toFixed(3), why: c.why })), words };
}

// ------------------------------------------------------------------ the mode
export async function lint(page: Page, o: { from: number; to: number; fps: number; draw: boolean; lyrics: string; out: string; strict: boolean }) {
  const probe: { stagesOf: Record<string, string[]>; loaded: string[] } = await page.evaluate(installProbe, o.draw);
  const timeline: Entry[] = await page.evaluate(() => (window as any).__pdoom.timeline);
  const lyrics = await Bun.file(o.lyrics).json();
  const n = Math.max(1, Math.round((o.to - o.from) * o.fps));
  const frames: Frame[] = [];
  const t0 = performance.now();
  for (let k = 0; k < n; k += 30) {
    const ts = Array.from({ length: Math.min(30, n - k) }, (_, j) => +(o.from + (k + j) / o.fps).toFixed(6));
    frames.push(...(await page.evaluate(([ts, dt]) => (window as any).__lint.frames(ts, dt), [ts, 1 / o.fps] as const)) as Frame[]);
    process.stdout.write(`\r${frames.length}/${n} frames  ${((performance.now() - t0) / 1000).toFixed(0)}s   `);
  }
  process.stdout.write('\n');
  const errs = frames.flatMap((f) => f.caps.filter((c) => c.error).map((c) => `${f.t.toFixed(3)} ${c.scene}/${c.stage}: ${c.error}`));
  if (errs.length) console.error(`probe errors (${errs.length}):\n${errs.slice(0, 5).join('\n')}`);
  const res = analyse(frames, timeline, probe.loaded, lyrics, o.from, o.to, o.fps);
  const stages = Object.entries(probe.stagesOf).map(([id, s]) => `${id}: ${s.join(', ') || '(none)'}`).join('; ');
  console.log(`lint ${o.from}-${o.to} s at ${o.fps} fps: ${n} frames; stages ${stages}; ${res.cuts.length} cut(s)`);
  if (res.cuts.length) console.log(`cuts: ${res.cuts.map((c) => `${c.t.toFixed(3)} ${c.why}`).join(', ')}`);
  const count = (s: Sev) => res.issues.filter((i) => i.sev === s).length;
  for (const i of res.issues) {
    const when = i.t1 > i.t0 ? `${i.t0.toFixed(3)}-${i.t1.toFixed(3)}` : i.t0.toFixed(3);
    console.log(`${i.sev.padEnd(5)}  ${i.code.padEnd(11)}  ${when.padEnd(15)}  ${i.what}: ${i.detail}`);
  }
  console.log(`${count('ERROR')} error(s), ${count('WARN')} warning(s), ${count('INFO')} note(s)`);
  mkdirSync(path.dirname(o.out), { recursive: true });
  await Bun.write(o.out, JSON.stringify({ from: o.from, to: o.to, fps: o.fps, stages: probe.stagesOf, ...res }, null, 1));
  console.log(`wrote ${o.out}`);
  return o.strict && count('ERROR') > 0 ? 1 : 0;
}
