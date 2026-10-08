#!/usr/bin/env bun
// Runs the render bench (dist-bench/, see vite.bench.config.ts) headless and prints its timings:
//   bun scripts/bench-run.ts [--swiftshader] [--browser /path/to/chrome]
import { chromium } from 'playwright-core';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const DIR = path.resolve(import.meta.dir, '../dist-bench');
const types: Record<string, string> = { js: 'text/javascript', json: 'application/json', ttf: 'font/ttf', svg: 'image/svg+xml', html: 'text/html' };
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/') p = '/bench.html';
    const f = Bun.file(path.join(DIR, p));
    if (!(await f.exists())) return new Response('not found', { status: 404 });
    return new Response(f, { headers: { 'content-type': types[p.split('.').pop()!] ?? 'application/octet-stream' } });
  },
});
const exe = opt('browser') ?? process.env.CHROME_PATH;
const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : { channel: 'chrome' }),
  args: [...(argv.includes('--swiftshader') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`http://localhost:${server.port}/`);
await page.waitForFunction(() => !(document.getElementById('run') as HTMLButtonElement).disabled || /fail|Error|cannot/.test(document.getElementById('status')!.textContent ?? ''), null, { timeout: 300000 });
console.log('status:', await page.textContent('#status'), '| gpu:', await page.textContent('#gpu'));
await page.selectOption('#device', 'Other');
await page.fill('#device-other', 'Cloud container');
await page.click('#run');
await page.waitForFunction(() => (window as any).__bench.last, null, { timeout: 3600000, polling: 2000 });
const last = await page.evaluate(() => (window as any).__bench.last);
for (const r of last.results) console.log(`${r.id.padEnd(12)} ${r.ms.toFixed(1)} ms`);
console.log(JSON.stringify(Object.fromEntries(last.results.map((r: any) => [r.id, Math.round(r.ms)]))));
await browser.close();
server.stop();
