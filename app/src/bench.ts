// Render bench: times the real engine on a few representative P(doom) plates (2D type, paper, 3D lines,
// raymarched 3D) at 1920x1080, one sub-frame per frame, GPU-synced through the export's pixel readback,
// so devices can be compared before choosing where the Monster video is rendered. Built on its own
// (vite.bench.config.ts) and published as an artifact page; runs are kept in the artifact's db.
import { Engine } from './engine/engine';
import { makeTimeline } from './timeline';
import { PW, PH } from './engine/gl';

declare global {
  interface Window { claude?: { use(name: string): Promise<any> }; __bench: any }
}

/** The plates timed, lightest first. `w` is the share of a typical video's frames this kind stands for (for the estimate). */
const PLATES = [
  { id: 'hook1', name: 'Typographic slam', kind: '2D type', w: 0.35 },
  { id: 'bureau', name: 'Paper form', kind: '2D layers', w: 0.2 },
  { id: 'loss', name: 'Contour landscape', kind: '3D lines', w: 0.2 },
  { id: 'paperclips', name: 'Paperclip lattice', kind: 'Raymarched 3D', w: 0.15 },
  { id: 'shoggoth', name: 'Shoggoth', kind: 'Raymarched 3D, heavy', w: 0.1 },
] as const;

/**
 * The same bench in this project's cloud container (headless Chromium, WebGL on 4 CPU cores through
 * SwiftShader, no GPU): median ms per frame. Measured with scripts/bench-run.ts --swiftshader.
 */
const CONTAINER: Record<string, number> = { hook1: 438, bureau: 1095, loss: 931, paperclips: 30271, shoggoth: 7651 };

const VIDEO_FRAMES = Math.round(218.7 * 60);
const BLUR_SUBFRAMES = 36; // P(doom)'s adaptive motion blur settles around 36 sub-frames for ordinary motion
const FRAMES_PER_SPOT = 4;
const SPOTS = [0.35, 0.7];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(ms < 10 ? 1 : 0)} ms`);
const fmtH = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`);
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]!; };

interface Result { id: string; ms: number }
interface Run { device: string; gpu: string; browser: string; results: Result[]; at: number; ok: boolean }

function probeGL() {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2');
  if (!gl) return { ok: false, gpu: 'WebGL2 unavailable', missing: ['webgl2'] };
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const missing = ['EXT_color_buffer_float', 'EXT_color_buffer_half_float'].filter((n) => !gl.getExtension(n));
  // the engine renders into half-float targets and sums sub-frames in float targets
  return { ok: !missing.includes('EXT_color_buffer_float'), gpu, missing };
}

function browserName() {
  const ua = navigator.userAgent;
  const m = /(Edg|OPR|Chrome|Chromium|Firefox|Version)\/(\d+)/.exec(ua);
  const name = m ? ({ Edg: 'Edge', OPR: 'Opera', Version: 'Safari' } as Record<string, string>)[m[1]!] ?? m[1]! : 'Unknown';
  const os = /CrOS/.test(ua) ? 'ChromeOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return `${name} ${m?.[2] ?? ''}${os ? ` · ${os}` : ''}`;
}

/** Hours for the whole song: one sub-frame per frame, and with motion blur, from a weighted mix of the plates. */
function estimate(results: Result[]) {
  let ms = 0;
  for (const p of PLATES) ms += p.w * (results.find((r) => r.id === p.id)?.ms ?? 0);
  const one = (ms * VIDEO_FRAMES) / 3.6e6;
  return { one, blur: one * BLUR_SUBFRAMES };
}

function speedup(results: Result[]) {
  const r = results.filter((x) => CONTAINER[x.id]! > 0 && x.ms > 0).map((x) => CONTAINER[x.id]! / x.ms);
  if (!r.length) return null;
  return Math.exp(r.reduce((a, b) => a + Math.log(b), 0) / r.length);
}

function renderResults(results: Result[]) {
  const tb = $('results');
  tb.replaceChildren();
  for (const p of PLATES) {
    const r = results.find((x) => x.id === p.id);
    const tr = document.createElement('tr');
    const base = CONTAINER[p.id]!;
    const cells = [
      p.name, p.kind,
      r ? fmtMs(r.ms) : '—',
      base > 0 ? fmtMs(base) : '—',
      r && base > 0 ? `${(base / r.ms).toFixed(base / r.ms >= 10 ? 0 : 1)}×` : '—',
    ];
    cells.forEach((v, i) => { const td = document.createElement('td'); td.textContent = v; if (i >= 2) td.className = 'num'; tr.appendChild(td); });
    tb.appendChild(tr);
  }
  const done = results.length === PLATES.length;
  const sp = speedup(results);
  const est = estimate(results);
  $('verdict').hidden = !done;
  if (done) {
    $('v-speed').textContent = sp ? `${sp.toFixed(sp >= 10 ? 0 : 1)}×` : '—';
    $('v-draft').textContent = fmtH(est.one);
    $('v-final').textContent = fmtH(est.blur);
  }
}

function renderRuns(runs: Run[]) {
  const tb = $('runs');
  tb.replaceChildren();
  $('runs-empty').hidden = runs.length > 0;
  $('runs-table').hidden = runs.length === 0;
  for (const run of runs) {
    const tr = document.createElement('tr');
    const sp = speedup(run.results), est = estimate(run.results);
    const cells = [run.device, run.gpu, ...PLATES.map((p) => { const r = run.results.find((x) => x.id === p.id); return r ? fmtMs(r.ms) : '—'; }),
      sp ? `${sp.toFixed(sp >= 10 ? 0 : 1)}×` : '—', fmtH(est.blur)];
    cells.forEach((v, i) => { const td = document.createElement('td'); td.textContent = v; if (i >= 2) td.className = 'num'; if (i === 1) td.className = 'gpu'; tr.appendChild(td); });
    tb.appendChild(tr);
  }
}

async function main() {
  const probe = probeGL();
  $('gpu').textContent = probe.gpu;
  $('browser').textContent = browserName();
  if (probe.missing.length) $('warn').textContent = `Missing WebGL features: ${probe.missing.join(', ')}. ${probe.ok ? 'The engine may still run.' : 'The renderer cannot run in this browser.'}`;
  if (!/Chrome|Chromium|Edg/.test(navigator.userAgent)) $('warn').textContent += ' The final render runs in Chrome or Chromium: if you can, run this in Chrome too.';
  renderResults([]);

  // runs saved from every device, side by side (db is null for signed-out views: the page works without it)
  let db: any = null;
  window.claude?.use('db').then((d) => {
    db = d;
    if (!db) return;
    $('runs-note').textContent = 'Runs from all your devices appear here.';
    db.collection('runs').orderBy('at').onSnapshot(
      (snap: any) => renderRuns(snap.docs.map((d: any) => d.data() as Run)),
      () => { $('runs-note').textContent = 'Saved runs are unavailable right now.'; },
    );
  }).catch(() => {});

  const canvas = $<HTMLCanvasElement>('c');
  canvas.width = PW; canvas.height = PH;
  const engine = new Engine(canvas, makeTimeline);
  const ids = new Set<string>(PLATES.map((p) => p.id));
  $('status').textContent = 'Loading fonts, timing data and plates…';
  try {
    await engine.init((e) => ids.has(e.id));
  } catch (e) {
    $('status').textContent = `The engine failed to start: ${String((e as Error)?.message ?? e)}`;
    return;
  }
  if (engine.errors.length) { $('status').textContent = `A plate failed to load: ${engine.errors[0]!.split('\n')[0]}`; return; }
  engine.render(engine.timeline.find((e) => e.id === 'hook1')!.start + 0.6, 1 / 60, true, 1);
  $('status').textContent = probe.ok ? 'Ready. Keep this tab in front while it runs.' : 'This browser cannot run the renderer.';
  const run = $<HTMLButtonElement>('run');
  run.disabled = !probe.ok;

  const results: Result[] = [];
  const buf = new Uint8Array(PW * PH * 4);
  const go = async () => {
    run.disabled = true;
    results.length = 0;
    renderResults(results);
    const total = PLATES.length * SPOTS.length * (FRAMES_PER_SPOT + 1);
    let n = 0;
    for (const p of PLATES) {
      const e = engine.timeline.find((x) => x.id === p.id)!;
      const ms: number[] = [];
      for (const s of SPOTS) {
        const t0 = e.start + (e.end - e.start) * s;
        // first frame at each spot: shader compiles and uploads, not timed
        for (let k = -1; k < FRAMES_PER_SPOT; k++) {
          $('status').textContent = `Rendering ${p.name} (${p.kind})…`;
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          const a = performance.now();
          engine.render(t0 + Math.max(0, k) / 60, 1 / 60, true, 1);
          await engine.readPixelsAsync(buf);
          if (k >= 0) ms.push(performance.now() - a);
          $<HTMLProgressElement>('bar').value = ++n / total;
        }
      }
      results.push({ id: p.id, ms: median(ms) });
      renderResults(results);
    }
    const device = ($<HTMLSelectElement>('device').value === 'Other' ? $<HTMLInputElement>('device-other').value.trim() : $<HTMLSelectElement>('device').value) || 'Unnamed device';
    const rec: Run = { device, gpu: probe.gpu, browser: browserName(), results: [...results], at: Date.now(), ok: true };
    window.__bench.last = rec;
    $('status').textContent = 'Done.';
    if (db) {
      try { await db.collection('runs').add(rec); $('status').textContent = 'Done. Saved with your other devices below.'; }
      catch { $('status').textContent = 'Done. Saving failed: use Copy results and paste them into the chat.'; }
    } else $('status').textContent = 'Done. Use Copy results and paste them into the chat.';
    run.disabled = false;
    $('copy').hidden = false;
  };
  run.onclick = () => { go().catch((e) => { $('status').textContent = `Run failed: ${String(e?.message ?? e)}`; run.disabled = false; }); };
  $('copy').onclick = async () => {
    const txt = JSON.stringify(window.__bench.last ?? {}, null, 0);
    try { await navigator.clipboard.writeText(txt); $('copy').textContent = 'Copied'; }
    catch { const pre = $('copy-text'); pre.textContent = txt; pre.hidden = false; }
  };
  $<HTMLSelectElement>('device').onchange = () => { $('device-other').hidden = $<HTMLSelectElement>('device').value !== 'Other'; };
}

window.__bench = { last: null, plates: PLATES };
main().catch((e) => { $('status').textContent = `Error: ${String(e?.message ?? e)}`; });
