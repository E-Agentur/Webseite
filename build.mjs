#!/usr/bin/env node
/**
 * Kr3is – Build ohne Abhängigkeiten.
 *
 *   node build.mjs            baut
 *   node build.mjs --check    baut nichts, meldet nur Abweichungen
 *
 * Setzt die Seiten aus src/ zusammen:
 *   src/css/*.css      -> assets/site.css   (nach Dateinamen sortiert, Reihenfolge zählt)
 *   src/js/*.js        -> assets/site.js
 *   src/pages/*.html   -> ./*.html          (mit Bausteinen aus src/partials/)
 *
 * Seitensyntax: eine JSON-Kopfzeile <!--{ ... }--> am Dateianfang, danach der
 * Inhalt. Bausteine werden mit <!-- include: name --> eingesetzt, Variablen mit
 * {{name}}. Bausteine dürfen ihrerseits Bausteine und Variablen enthalten.
 *
 * Der Schlüssel "schema" im Kopf ist keine Variable, sondern eine Liste von
 * JSON-LD-Knoten. Sie werden mit den seitenübergreifenden Knoten aus
 * src/partials/schema.json zu genau einem @graph je Seite verbunden und als
 * {{schema}} eingesetzt. Ein einziger Graph je Seite stellt sicher, dass
 * Verweise über "@id" – etwa der Anbieter eines Service – auch aufgehen.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const BANNER = 'GENERIERT von build.mjs – nicht direkt bearbeiten, sondern src/ ändern.';
const read = (p) => readFileSync(p, 'utf8');

/* Die erzeugten Dateien sind eingecheckt, damit die Seite auch ohne Build
   läuft. Wer src/ ändert und den Build vergisst, hinterlässt sie veraltet –
   ohne dass irgendetwas anschlägt. --check vergleicht deshalb, statt zu
   schreiben, und meldet jede Datei, die nicht zum Quellstand passt. */
const CHECK = process.argv.includes('--check');
const stale = [];
const emit = (path, content) => {
  if (!CHECK) return writeFileSync(path, content);
  if (!existsSync(path)) stale.push(`${path}: fehlt`);
  else if (read(path) !== content) stale.push(`${path}: nicht auf dem Stand von src/`);
};

/* ---------- Stylesheet und Skript bündeln ---------- */
function bundle(dir, out, comment) {
  const files = readdirSync(dir).filter((f) => !f.startsWith('.')).sort();
  const body = files
    .map((f) => `/* ---------- ${f} ---------- */\n${read(join(dir, f)).trim()}\n`)
    .join('\n');
  emit(out, `/* ${BANNER} */\n/* ${comment}: ${files.join(', ')} */\n\n${body}`);
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

/* ---------- Strukturierte Daten ---------- */
const baseNodes = JSON.parse(read('src/partials/schema.json'));

function schemaBlock(pageNodes) {
  const graph = [...baseNodes, ...(pageNodes ?? [])];
  const body = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
  return `<script type="application/ld+json">\n${body}\n</script>`;
}

/* ---------- Seiten bauen ---------- */
function buildPages() {
  const shell = read('src/partials/_shell.html');
  const names = readdirSync('src/pages').filter((f) => f.endsWith('.html'));
  for (const file of names) {
    const raw = read(join('src/pages', file));
    const m = raw.match(/^<!--(\{[\s\S]*?\})-->\n?/);
    if (!m) throw new Error(`${file}: JSON-Kopf <!--{ ... }--> fehlt`);
    const { schema, ...meta } = JSON.parse(m[1]);
    if (schema !== undefined && !Array.isArray(schema)) {
      throw new Error(`${file}: "schema" muss eine Liste von JSON-LD-Knoten sein`);
    }
    const vars = {
      bodyClass: '',
      mainClass: '',
      ogTitle: meta.title,
      ogDescription: meta.description,
      noindex: '',
      headExtra: '',
      ...meta,
      schema: schemaBlock(schema),
      content: raw.slice(m[0].length).trim(),
    };
    const html = expand(shell, vars)
      .replace(/ class=""/g, '')          // leere Attribute nicht ausliefern
      .replace(/\n{3,}/g, '\n\n');
    emit(file, html);
  }
  return names.length;
}

if (!CHECK) mkdirSync('assets', { recursive: true });
const css = bundle('src/css', 'assets/site.css', 'Reihenfolge');
const js = bundle('src/js', 'assets/site.js', 'Dateien');
const pages = buildPages();

if (CHECK) {
  if (stale.length) {
    console.error(`Veraltet gegenüber src/:\n  ${stale.join('\n  ')}\n\nnode build.mjs ausführen.`);
    process.exit(1);
  }
  console.log(`Erzeugte Dateien sind auf dem Stand von src/ (${pages} Seiten, ${css + js} Bündel).`);
} else {
  console.log(`Gebaut: ${pages} Seiten, ${css} CSS-Bausteine, ${js} Skript(e), ${baseNodes.length} Basis-Schemaknoten.`);
}
