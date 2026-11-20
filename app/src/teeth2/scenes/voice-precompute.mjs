// Plate 8 `voice`: offline precompute of the monitor's data -> voice-data.ts.  Run:  bun app/src/teeth2/scenes/voice-precompute.mjs
// (needs ffmpeg on PATH: source out/env.sh).  No vocal stem is on disk (work/teeth/stems was never kept), so:
//   * the SPECTROGRAM is a real STFT of the full mix, audio/teeth.mp3 (Hann 1024 @ 22 kHz, 10 ms hop, 96 log bands 120 Hz-8 kHz);
//   * the WAVEFORM's level is the stem-derived vocal envelope already in data/teeth/audio.json (`vocal`, 100 fps), and its
//     fine structure is the real positive/negative peaks of the mix's 120 Hz-5 kHz band (5 ms bins), normalised to the local
//     maximum so the level comes from the vocal analysis and the texture from the actual signal.  Nothing is synthesised.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const T0 = 88.0, T1 = 107.0;            // data window (song s)
const SR = 22000;
const dec = (filter) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(T0), '-t', String(T1 - T0), '-i', resolve(root, 'audio/teeth.mp3'), '-ac', '1', '-ar', String(SR), ...(filter ? ['-af', filter] : []), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr);
  const b = r.stdout; return new Float32Array(b.buffer, b.byteOffset, b.byteLength >> 2);
};
const pcm = dec(null);
const band = dec('highpass=f=120,lowpass=f=5000');
const audio = JSON.parse(readFileSync(resolve(root, 'data/teeth/audio.json'), 'utf8'));

// ---- waveform: 5 ms bins
const BIN = 110, NW = Math.floor(band.length / BIN);   // 110 samples = 5 ms
const NWT = Math.min(NW, 3800);
const pk = new Float32Array(NWT), nk = new Float32Array(NWT);
for (let i = 0; i < NWT; i++) {
  let a = 0, b = 0;
  for (let j = 0; j < BIN; j++) { const v = band[i * BIN + j]; if (v > a) a = v; if (-v > b) b = -v; }
  pk[i] = a; nk[i] = b;
}
const wave = new Uint8Array(NWT * 4);
for (let i = 0; i < NWT; i++) {
  let m = 1e-4;
  for (let k = Math.max(0, i - 14); k <= Math.min(NWT - 1, i + 14); k++) m = Math.max(m, pk[k], nk[k]);
  const t = T0 + (i + 0.5) * 0.005;
  const env = Math.min(1, audio.vocal[Math.round(t * 100)] ?? 0);
  const sm = (x) => Math.min(1, 0.32 + 0.68 * x);                  // keep the structure, never collapse a bin to nothing
  wave[i * 4 + 0] = Math.round(255 * env * sm(pk[i] / m));
  wave[i * 4 + 1] = Math.round(255 * env * sm(nk[i] / m));
  wave[i * 4 + 2] = Math.round(255 * env);
  wave[i * 4 + 3] = 255;
}

// ---- spectrogram
const N = 1024, HOP = 220, NB = 96, FLO = 120, FHI = 8000;
const NF = Math.floor((pcm.length - N) / HOP);
const win = new Float64Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
const rev = new Uint16Array(N); for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < 10; b++) if (i & (1 << b)) r |= 1 << (9 - b); rev[i] = r; }
const cosT = new Float64Array(N / 2), sinT = new Float64Array(N / 2);
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos((2 * Math.PI * i) / N); sinT[i] = -Math.sin((2 * Math.PI * i) / N); }
const re = new Float64Array(N), im = new Float64Array(N);
function fft() {
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let s = 0; s < N; s += size) for (let k = 0; k < half; k++) {
      const wr = cosT[k * step], wi = sinT[k * step];
      const a = s + k, b = a + half;
      const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
}
const edges = []; for (let b = 0; b <= NB; b++) edges.push(FLO * Math.pow(FHI / FLO, b / NB));
const db = new Float32Array(NF * NB);
let gmax = -1e9;
for (let f = 0; f < NF; f++) {
  for (let i = 0; i < N; i++) { re[rev[i]] = pcm[f * HOP + i] * win[i]; im[rev[i]] = 0; }
  fft();
  const binHz = SR / N;
  for (let b = 0; b < NB; b++) {
    const lo = edges[b] / binHz, hi = Math.max(edges[b + 1] / binHz, lo + 1e-3);
    let s = 0, w = 0;
    for (let k = Math.floor(lo); k <= Math.min(N / 2 - 1, Math.ceil(hi)); k++) {
      const ov = Math.min(k + 1, hi) - Math.max(k, lo); if (ov <= 0) continue;
      s += (re[k] * re[k] + im[k] * im[k]) * ov; w += ov;
    }
    const pw = s / Math.max(w, 1e-6);
    const emph = 3 * Math.log2(Math.sqrt(edges[b] * edges[b + 1]) / 1000);          // +3 dB / octave
    const d = 10 * Math.log10(pw + 1e-9) + emph;
    db[f * NB + b] = d; if (d > gmax) gmax = d;
  }
}
const RANGE = 58;
const spec = new Uint8Array(NF * NB);
for (let f = 0; f < NF; f++) for (let b = 0; b < NB; b++) {
  const v = (db[f * NB + b] - (gmax - RANGE)) / RANGE;
  spec[b * NF + f] = Math.round(255 * Math.min(1, Math.max(0, v)));   // row = band (0 low), column = frame
}

const b64 = (u8) => Buffer.from(u8).toString('base64');
const out = `// GENERATED by voice-precompute.mjs from audio/teeth.mp3 + data/teeth/audio.json. Do not edit.
// Window ${T0}-${T0 + NWT * 0.005} s. WAVE: ${NWT} bins x RGBA8 (5 ms): R pos peak, G neg peak, B vocal envelope. SPEC: ${NF} frames (10 ms) x ${NB} log bands (${FLO}-${FHI} Hz), row-major by band.
export const VD = { t0: ${T0}, nWave: ${NWT}, waveDt: 0.005, nSpec: ${NF}, specDt: 0.01, nBands: ${NB} } as const;
export const WAVE_B64 = '${b64(wave)}';
export const SPEC_B64 = '${b64(spec)}';
`;
writeFileSync(resolve(here, 'voice-data.ts'), out);
console.log('voice-data.ts written', NWT, NF, NB, 'gmax', gmax.toFixed(1), 'bytes', out.length);
