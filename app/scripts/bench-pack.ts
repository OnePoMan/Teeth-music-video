#!/usr/bin/env bun
// After `bunx vite build -c vite.bench.config.ts`: copies the files the engine fetches at run time
// (font instances, stroke fonts, P(doom)'s timing data) into dist-bench/, and writes dist-bench/page.html,
// the page body the artifact publisher wraps in its own document skeleton (no doctype/html/head/body).
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const APP = path.resolve(import.meta.dir, '..');
const OUT = path.join(APP, 'dist-bench');
const fonts = path.join(APP, 'public/fonts');
mkdirSync(path.join(OUT, 'fonts/src'), { recursive: true });
mkdirSync(path.join(OUT, 'fonts/stroke'), { recursive: true });
for (const f of readdirSync(fonts)) if (f.endsWith('.ttf')) cpSync(path.join(fonts, f), path.join(OUT, 'fonts', f));
for (const f of readdirSync(path.join(fonts, 'src'))) if (/^IBMPlexMono-.*\.ttf$/.test(f)) cpSync(path.join(fonts, 'src', f), path.join(OUT, 'fonts/src', f));
// (the artifact host refuses XML files with a DOCTYPE; the fonts only use XML's predefined entities)
for (const f of readdirSync(path.join(fonts, 'stroke'))) {
  writeFileSync(path.join(OUT, 'fonts/stroke', f), readFileSync(path.join(fonts, 'stroke', f), 'utf8').replace(/<!DOCTYPE[^>]*>\s*/, ''));
}
mkdirSync(path.join(OUT, 'data'), { recursive: true });
for (const f of ['audio.json', 'lyrics.json']) cpSync(path.join(APP, '..', 'data', f), path.join(OUT, 'data', f));

const html = readFileSync(path.join(OUT, 'bench.html'), 'utf8');
const head = /<head>([\s\S]*?)<\/head>/.exec(html)![1]!;
const body = /<body>([\s\S]*?)<\/body>/.exec(html)![1]!;
const keep = head.split('\n').filter((l) => !/<meta charset|<meta name="viewport"/.test(l)).join('\n').trim();
// module scripts move to the end of the body so the markup exists when they run
const scripts = (keep.match(/<script[\s\S]*?<\/script>/g) ?? []).join('\n');
const headRest = keep.replace(/<script[\s\S]*?<\/script>/g, '').trim();
writeFileSync(path.join(OUT, 'page.html'), `${headRest}\n${body.trim()}\n${scripts}\n`);
console.log('packed', OUT);
