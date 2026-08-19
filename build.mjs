#!/usr/bin/env node
/**
 * Kr3is – Build ohne Abhängigkeiten.
 *
 *   node build.mjs
 *
 * Setzt die Seiten aus src/ zusammen:
 *   src/css/*.css      -> assets/site.css   (nach Dateinamen sortiert, Reihenfolge zählt)
 *   src/js/*.js        -> assets/site.js
 *   src/pages/*.html   -> ./*.html          (mit Bausteinen aus src/partials/)
 *
 * Seitensyntax: eine JSON-Kopfzeile <!--{ ... }--> am Dateianfang, danach der
 * Inhalt. Bausteine werden mit <!-- include: name --> eingesetzt, Variablen mit
 * {{name}}. Bausteine dürfen ihrerseits Bausteine und Variablen enthalten.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const BANNER = 'GENERIERT von build.mjs – nicht direkt bearbeiten, sondern src/ ändern.';
const read = (p) => readFileSync(p, 'utf8');

/* ---------- Stylesheet und Skript bündeln ---------- */
function bundle(dir, out, comment) {
  const files = readdirSync(dir).filter((f) => !f.startsWith('.')).sort();
  const body = files
    .map((f) => `/* ---------- ${f} ---------- */\n${read(join(dir, f)).trim()}\n`)
    .join('\n');
  writeFileSync(out, `/* ${BANNER} */\n/* ${comment}: ${files.join(', ')} */\n\n${body}`);
  return files.length;
}

/* ---------- Bausteine und Variablen einsetzen ---------- */
const partials = Object.fromEntries(
  readdirSync('src/partials')
    .filter((f) => f.endsWith('.html'))
    .map((f) => [basename(f, '.html'), read(join('src/partials', f))]),
);

function expand(text, vars, depth = 0) {
  if (depth > 10) throw new Error('Bausteine sind zirkulär verschachtelt');
  let out = text.replace(/[ \t]*<!--\s*include:\s*([\w-]+)\s*-->/g, (_, name) => {
    if (!(name in partials)) throw new Error(`Baustein "${name}" fehlt in src/partials/`);
    return partials[name];
  });
  out = out.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    if (!(key in vars)) throw new Error(`Variable "${key}" ist nicht gesetzt`);
    return vars[key];
  });
  return /<!--\s*include:|\{\{/.test(out) ? expand(out, vars, depth + 1) : out;
}

/* ---------- Seiten bauen ---------- */
function buildPages() {
  const shell = read('src/partials/_shell.html');
  const names = readdirSync('src/pages').filter((f) => f.endsWith('.html'));
  for (const file of names) {
    const raw = read(join('src/pages', file));
    const m = raw.match(/^<!--(\{[\s\S]*?\})-->\n?/);
    if (!m) throw new Error(`${file}: JSON-Kopf <!--{ ... }--> fehlt`);
    const meta = JSON.parse(m[1]);
    const vars = {
      bodyClass: '',
      ogTitle: meta.title,
      ogDescription: meta.description,
      noindex: '',
      ...meta,
      content: raw.slice(m[0].length).trim(),
    };
    writeFileSync(file, expand(shell, vars).replace(/\n{3,}/g, '\n\n'));
  }
  return names.length;
}

mkdirSync('assets', { recursive: true });
const css = bundle('src/css', 'assets/site.css', 'Reihenfolge');
const js = bundle('src/js', 'assets/site.js', 'Dateien');
const pages = buildPages();
console.log(`Gebaut: ${pages} Seiten, ${css} CSS-Bausteine, ${js} Skript(e).`);
