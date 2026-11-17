// Board `kittest` (not part of the edit): proves the tooth set (teeth.ts).
//   default        an upper dental-stone cast, ray-marched with GLSL_TEETH, teeth up on a dark bench under a raking light
//   ?view=lower    the lower cast; ?view=both: the two casts in occlusion (head frame, from the front-left)
//   ?view=2d       the 2D data: occlusal outlines (his arch and two suspects), buccal profiles of a quadrant,
//                  the bite-mark pattern
//   ?suspect=N     use archVariant(N) instead of his arch
import * as THREE from 'three';
import { Scene, type Frame } from '../../engine/scene';
import { FSPass, Layer2D, SS_TAP, SS_TAP_GLSL } from '../../engine/gl';
import { GLSL_TEETH_PALETTE, trgba } from '../palette';
import {
  GLSL_TEETH, TeethTex, HIS, archVariant, tooth, occlusalOutline, incisalEdge, cuspTips, grooves, buccalProfile, biteMark,
  type Arch, type V2,
} from '../teeth';

const FRAG = /* glsl */ `
${GLSL_TEETH_PALETTE}
${GLSL_TEETH}
${SS_TAP_GLSL}
uniform mat4 invVP; uniform vec3 camPos; uniform vec3 Ld; uniform int mode;
uniform vec2 res; uniform int toothN; uniform float shOn;

// bench frame (y up, the cast standing on its base); mode 0: upper cast teeth-up, 1: lower cast, 2: both in head frame
vec3 toHead(vec3 p) { return mode == 0 ? vec3(p.x, -p.y, -p.z) : p; }
float BENCH;
float map(vec3 p, out int id) {
  vec3 h = toHead(p);
  if (mode == 3) { id = toothN; return tCrown(toothN - 1, h); }
  if (mode == 2) {
    int i1, i2;
    float a = sdCast(h + vec3(0.0, 0.0, 0.0), 0, i1);
    float b = sdCast(h, 1, i2);
    id = a < b ? i1 : i2;
    return min(a, b);
  }
  return sdCast(h, mode == 0 ? 0 : 1, id);
}
float mapD(vec3 p) { int id; return map(p, id); }
vec3 nrm(vec3 p) {
  const vec2 k = vec2(1.0, -1.0); const float e = 0.05;
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}
vec2 boxHit(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  vec3 iv = 1.0 / rd; vec3 t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
void bounds(out vec3 lo, out vec3 hi) {
  if (mode == 3) { vec4 bd = tth(toothN - 1, 12); lo = bd.xyz - bd.w; hi = bd.xyz + bd.w; return; }
  if (mode == 2) { vec3 l0, l1; vec3 h0 = castBounds(0, l0), h1 = castBounds(1, l1); lo = min(l0, l1); hi = max(h0, h1); return; }
  vec3 l; vec3 h = castBounds(mode == 0 ? 0 : 1, l);
  if (mode == 0) { lo = vec3(l.x, -h.y, -h.z); hi = vec3(h.x, -l.y, -l.z); } else { lo = l; hi = h; }
}
float shadow(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
  // improved soft shadows (Aaltonen), jittered start: no banding in the penumbrae
  teethRay(toHead(ro), toHead(rd));
  vec2 bh = boxHit(ro, rd, lo, hi);
  float tEnd = min(bh.y, 90.0);
  float res = 1.0, t = 0.06 + 0.12 * hash12(gl_FragCoord.xy), ph = 1e10;
  for (int i = 0; i < 96; i++) {
    if (t > tEnd) break;
    float h = mapD(ro + rd * t);
    float y = h * h / (2.0 * ph);
    float d = sqrt(max(h * h - y * y, 0.0));
    res = min(res, 7.0 * d / max(0.0, t - y));
    ph = h;
    if (res < 0.005) break;
    t += clamp(h * 0.85, 0.04, 2.0);
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
float ao(vec3 p, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) { float h = 0.3 * float(i) * float(i) * 0.45; o += w * (h - mapD(p + n * h)); w *= 0.62; }
  return clamp(1.0 - 1.1 * o, 0.0, 1.0);
}
vec3 shade(vec2 px) {
  vec2 ndc = px / res * 2.0 - 1.0;
  vec4 q = invVP * vec4(ndc, 1.0, 1.0);
  vec3 ro = camPos, rd = normalize(q.xyz / q.w - camPos);
  vec3 lo, hi; bounds(lo, hi);
  // the bench under the cast
  float yB = lo.y + 0.02;
  float tB = rd.y < 0.0 ? (yB - ro.y) / rd.y : 1e9;
  vec2 bh = boxHit(ro, rd, lo, hi);
  float t = max(bh.x, 0.0), tEnd = min(bh.y, tB);
  bool hit = false; int id = 0;
  teethRay(toHead(ro), toHead(rd));
  if (bh.x < bh.y) {
    for (int i = 0; i < 260; i++) {
      float d = map(ro + rd * t, id);
      if (d < 0.0004 * t + 0.0006) { hit = true; break; }
      t += d * 0.85;
      if (t > tEnd) break;
    }
  }
  vec3 L = normalize(Ld);
  if (!hit) {
    if (tB > 1e8) return T_FILM * 0.4;
    vec3 P = ro + rd * tB;
    float sh = shadow(P + vec3(0.0, 0.05, 0.0), L, lo, hi);
    float grainB = 0.92 + 0.08 * snoise(P.xz * 0.9);
    float fall = exp(-length(P.xz - vec2(-10.0, 10.0)) * 0.012);
    return T_FILM2 * (0.25 + 1.6 * sh * max(L.y, 0.0) * fall) * grainB;
  }
  for (int k = 0; k < 2; k++) t += mapD(ro + rd * t) * 0.9;
  vec3 P = ro + rd * t;
  vec3 N = nrm(P);
  // dental stone: matte, slightly translucent at thin edges, a fine powdery grain and the odd pore
  float ndl = dot(N, L);
  float sh = ndl > -0.2 ? (shOn > 0.5 ? shadow(P + N * 0.08, L, lo, hi) : 1.0) : 0.0;
  float a = ao(P, N);
  float wrap = max((ndl + 0.18) / 1.18, 0.0);
  float pore = smoothstep(0.82, 0.9, snoise(P * 2.6)) * 0.35;
  float grain = 0.94 + 0.06 * snoise(P * 7.0) + 0.03 * snoise(P * 19.0);
  vec3 alb = T_STONE * grain * (1.0 - pore);
  vec3 sky = T_LIGHTBOX * 0.10;
  vec3 col = alb * (1.4 * wrap * sh + 1.3 * sky.r * (0.45 + 0.55 * N.y) * a + 0.06 * a);
  // sheen of the dry stone at grazing angles
  vec3 V = -rd, Hh = normalize(L + V);
  col += T_LIGHTBOX * 0.035 * pow(max(dot(N, Hh), 0.0), 18.0) * sh;
  // ink marks? (none on the test board) — the tooth id is available for that
  return col;
}
void main() {
  vec2 px = gl_FragCoord.xy;
  vec3 c = vec3(0.0);
  for (int k = ssK0(); k < ssK1(); k++) c += shade(px + rgss(k) * PX_SCALE);
  c *= ssWeight();
  fragColor = vec4(c, 1.0);
}`;

export default class KitTest extends Scene {
  private tt!: TeethTex;
  private pass!: FSPass;
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 1, 2000);
  private layer = new Layer2D();
  private view = 'upper';
  private arch: Arch = HIS;

  override init() {
    const q = new URLSearchParams(location.search);
    this.view = q.get('view') ?? 'upper';
    const s = q.get('suspect');
    if (s) this.arch = archVariant(+s);
    this.tt = new TeethTex(this.arch);
    this.pass = new FSPass(FRAG, {
      teethTex: { value: this.tt.texture }, invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() },
      Ld: { value: new THREE.Vector3() }, mode: { value: 0 }, toothN: { value: 8 }, shOn: { value: 1 }, res: { value: new THREE.Vector2() }, ssTap: SS_TAP,
    });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    // query params, or ?shots=view:n:yaw:elev:dist:nosh,... with the shot picked by round(t) (one session, many views)
    const q0 = new URLSearchParams(location.search);
    const shots = q0.get('shots');
    const q = new Map<string, string>();
    q0.forEach((v, k) => q.set(k, v));
    if (shots) {
      const s = shots.split(',')[Math.round(f.t)] ?? '';
      const [v, n, yw, el, di, ns] = s.split(':');
      for (const [k, x] of [['view', v], ['n', n], ['yaw', yw], ['elev', el], ['dist', di], ['nosh', ns]] as [string, string | undefined][]) if (x) q.set(k, x);
    }
    const view = q.get('view') ?? this.view;
    if (view === '2d') return this.render2d(out);
    const u = this.pass.u;
    const mode = view === 'lower' ? 1 : view === 'both' ? 2 : view === 'tooth' ? 3 : 0;
    const tn = +(q.get('n') ?? 8);
    u.toothN!.value = tn;
    u.shOn!.value = q.get('nosh') === '1' ? 0 : 1;
    // camera: in front of the cast, high, looking down onto the occlusal surfaces
    const yaw = +(q.get('yaw') ?? 0.32);
    const elev = +(q.get('elev') ?? (mode === 2 ? 0.25 : 0.62));
    const dist = +(q.get('dist') ?? (mode === 2 ? 190 : 215));
    const tt = tooth(this.arch, tn);
    const target = mode === 3 ? new THREE.Vector3(tt.center[0], tt.yTip + (tt.jaw === "upper" ? 5 : -5), -tt.center[1]) : mode === 0 ? new THREE.Vector3(0, -9, 24) : mode === 1 ? new THREE.Vector3(0, 0, -22) : new THREE.Vector3(0, 1, -18);
    const fwd = mode === 0 ? -1 : 1; // which way the cast faces (its anterior): bench -z for the upper teeth-up, head +z otherwise
 // the upper cast faces +z on the bench, the lower faces -z
    const pos = new THREE.Vector3(Math.sin(yaw) * Math.cos(elev) * dist, Math.sin(elev) * dist, fwd * Math.cos(yaw) * Math.cos(elev) * dist).add(target);
    this.cam.position.copy(pos);
    if (elev > 1.3) this.cam.up.set(0, 0, -fwd); else this.cam.up.set(0, 1, 0);
    this.cam.lookAt(target);
    this.cam.fov = 21;
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    (u.invVP!.value as THREE.Matrix4).multiplyMatrices(this.cam.matrixWorld, this.cam.projectionMatrixInverse);
    (u.camPos!.value as THREE.Vector3).copy(pos);
    // the raking light: low, from the left and a little behind
    (u.Ld!.value as THREE.Vector3).set(-0.85, 0.36, fwd * -0.32).normalize();
    u.mode!.value = mode;
    (u.res!.value as THREE.Vector2).set(out.width, out.height);
    this.pass.render(renderer, out);
    return { halation: 0.1 };
  }

  private render2d(out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const L = this.layer, c = L.ctx;
    L.clear(trgba('film'));
    const arches: [Arch, string][] = [[HIS, 'HIS'], [archVariant(1), 'S1'], [archVariant(2), 'S2'], [archVariant(3), 'S3']];
    const S = 4.2;
    arches.forEach(([arch, name], k) => {
      const ox = 150 + k * 290, oy = 70;
      c.fillStyle = trgba('halide'); c.font = '14px monospace'; c.fillText(`${name} ${arch.features.join(' ')}`, ox - 120, 40);
      for (const t of arch.teeth) {
        if (!t.present) continue;
        const jawOff = t.jaw === "upper" ? 0 : 520;
        const P = (p: V2) => [ox + p[0] * S, oy + jawOff + p[1] * S * (t.jaw === 'upper' ? 1 : -1) + (t.jaw === 'upper' ? 0 : 0)] as const;
        const o = occlusalOutline(t);
        c.beginPath(); o.forEach((p, i) => (i ? c.lineTo(...P(p)) : c.moveTo(...P(p)))); c.closePath();
        c.fillStyle = trgba('stone', 0.85); c.fill();
        c.strokeStyle = trgba('film'); c.lineWidth = 1; c.stroke();
        const e = incisalEdge(t);
        if (e) { c.beginPath(); e.forEach((p, i) => (i ? c.lineTo(...P(p)) : c.moveTo(...P(p)))); c.strokeStyle = trgba('film'); c.lineWidth = 1.5; c.stroke(); }
        for (const g of grooves(t)) { c.beginPath(); g.forEach((p, i) => (i ? c.lineTo(...P(p)) : c.moveTo(...P(p)))); c.strokeStyle = trgba('film', 0.7); c.lineWidth = 1; c.stroke(); }
        for (const cu of cuspTips(t)) { const [x, y] = P(cu.p); c.fillStyle = trgba('film'); c.beginPath(); c.arc(x, y, 1.6, 0, 6.3); c.fill(); }
      }
    });
    // buccal profiles: the upper right and lower right quadrants, 8 -> 1 and 25 -> 32
    const S2 = 5;
    let x = 1180;
    for (const [n0, dir] of [[8, -1], [25, 1]] as [number, number][]) {
      x = 1180;
      for (let k = 0; k < 8; k++) {
        const t = tooth(HIS, n0 + dir * k);
        const pr = buccalProfile(t);
        const up = t.jaw === 'upper';
        const by = up ? 760 : 800;
        const Q = (p: V2) => [x + p[0] * S2, up ? by - (pr.H - p[1]) * S2 : by + (pr.H - p[1]) * S2] as const;
        const draw = (poly: V2[], fill: string) => { c.beginPath(); poly.forEach((p, i) => { const [a, b] = Q(p); if (i) c.lineTo(a, b); else c.moveTo(a, b); }); c.closePath(); c.fillStyle = fill; c.fill(); };
        for (const r of pr.extraRoots) draw(r, trgba('silver', 0.5));
        draw(pr.outline, trgba('silver'));
        draw(pr.enamel, trgba('lightbox'));
        draw(pr.pulp, trgba('film2'));
        x += t.md * S2 + 12;
      }
    }
    // the bite mark
    const bm = biteMark(HIS);
    const bx = 1560, byy = 840, S3 = 7;
    for (const m of [...bm.upper, ...bm.lower]) {
      c.beginPath(); m.poly.forEach((p, i) => (i ? c.lineTo(bx + p[0] * S3, byy - p[1] * S3) : c.moveTo(bx + p[0] * S3, byy - p[1] * S3))); c.closePath();
      c.fillStyle = trgba('lightbox', 0.4 + 0.6 * m.depth); c.fill();
    }
    comp.draw(renderer, L.upload(), out, { mode: 'replace' });
    return { bloom: 0, halation: 0, vignette: 0, grain: 0, ca: 0 };
  }
}
