#!/usr/bin/env node
/**
 * Kr3is – Build ohne Abhängigkeiten.
 *
 *   node build.mjs            baut
 *   node build.mjs --check    baut nichts, meldet nur Abweichungen
 *
 * Setzt die Seiten aus src/ zusammen:
 *   src/css/*.css      -> assets/site.<hash>.css  (nach Dateinamen sortiert)
 *   src/js/*.js        -> assets/site.<hash>.js
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
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';

const BANNER = 'GENERIERT von build.mjs – nicht direkt bearbeiten, sondern src/ ändern.';
const read = (p) => readFileSync(p, 'utf8');

/* Die erzeugten Dateien sind eingecheckt, damit die Seite auch ohne Build
   läuft. Wer src/ ändert und den Build vergisst, hinterlässt sie veraltet –
   ohne dass irgendetwas anschlägt. --check vergleicht deshalb, statt zu
   schreiben, und meldet jede Datei, die nicht zum Quellstand passt. */
const CHECK = process.argv.includes('--check');
let assets = null;   // von bundle() gesetzt, von buildPages() in die Seiten eingesetzt
const stale = [];
const emit = (path, content) => {
  if (!CHECK) return writeFileSync(path, content);
  if (!existsSync(path)) stale.push(`${path}: fehlt`);
  else if (read(path) !== content) stale.push(`${path}: nicht auf dem Stand von src/`);
};

/* ---------- Stylesheet und Skript bündeln ----------
   Der Dateiname trägt einen Hash des Inhalts. Das erlaubt, die Bündel ein Jahr
   lang unveränderlich zwischenspeichern zu lassen, ohne je einen alten Stand
   auszuliefern: Ändert sich eine Zeile, ändert sich der Name, und der Browser
   holt die Datei neu. Vorher hießen sie fest site.css und site.js und lagen
   eine Stunde im Cache – frisches HTML traf dann auf altes CSS, was aussieht
   wie eine halb aktualisierte Seite. */
function bundle(dir, base, ext, comment) {
  const files = readdirSync(dir).filter((f) => !f.startsWith('.')).sort();
  const body = files
    .map((f) => `/* ---------- ${f} ---------- */\n${read(join(dir, f)).trim()}\n`)
    .join('\n');
  const content = `/* ${BANNER} */\n/* ${comment}: ${files.join(', ')} */\n\n${body}`;
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 10);
  const name = `${base}.${hash}${ext}`;
  emit(join('assets', name), content);
  return { name, count: files.length };
}

/* Bündel früherer Stände entfernen, sonst sammeln sie sich im Verzeichnis an
   und landen mit im Repository. */
function tidyAssets(behalten) {
  const alt = readdirSync('assets')
    .filter((f) => /^site\.[0-9a-f]{10}\.(css|js)$/.test(f) && !behalten.includes(f));
  if (CHECK) alt.forEach((f) => stale.push(`assets/${f}: Bündel eines früheren Standes`));
  else alt.forEach((f) => unlinkSync(join('assets', f)));
  return alt.length;
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

/* Die FAQ stand einmal doppelt in der Seite: einmal als <details> für den
   Leser, einmal als FAQPage-Knoten im Kopf für die Suchmaschine. Wer den
   sichtbaren Text änderte, ließ die Auszeichnung still zurück – und eine
   Auszeichnung, die vom sichtbaren Inhalt abweicht, verstößt gegen die
   Richtlinien für strukturierte Daten. Jetzt ist das Markup die Quelle und
   der Knoten entsteht daraus. */
const entities = (t) => t
  .replace(/&nbsp;/g, '\u00a0').replace(/&shy;/g, '\u00ad')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"');
const plain = (t) => entities(t.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function faqNode(content, path) {
  /* Nur was im Block .faq steht. Ein <details> anderswo ist ein Aufklappelement,
     keine Frage – und darf nicht als FAQPage ausgezeichnet werden. */
  const start = content.indexOf('<div class="faq');
  if (start < 0) return null;
  const ende = content.indexOf('</section>', start);
  const block = content.slice(start, ende < 0 ? undefined : ende);
  const treffer = [...block.matchAll(
    /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (!treffer.length) return null;
  return {
    '@type': 'FAQPage',
    '@id': `https://kr3is.com/${path}#faq`,
    mainEntity: treffer.map(([, frage, antwort]) => ({
      '@type': 'Question',
      name: plain(frage),
      acceptedAnswer: { '@type': 'Answer', text: plain(antwort) },
    })),
  };
}

function schemaBlock(pageNodes, faq) {
  const graph = [...baseNodes, ...(pageNodes ?? []), ...(faq ? [faq] : [])];
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
    const content = raw.slice(m[0].length).trim();
    const vars = {
      bodyClass: '',
      mainClass: '',
      ogTitle: meta.title,
      ogDescription: meta.description,
      noindex: '',
      headExtra: '',
      ...meta,
      ...assets,
      schema: schemaBlock(schema, faqNode(content, meta.path ?? '')),
      content,
    };
    const html = expand(shell, vars)
      .replace(/ class=""/g, '')          // leere Attribute nicht ausliefern
      .replace(/\n{3,}/g, '\n\n');
    emit(file, html);
  }
  return names.length;
}

if (!CHECK) mkdirSync('assets', { recursive: true });
const css = bundle('src/css', 'site', '.css', 'Reihenfolge');
const js = bundle('src/js', 'site', '.js', 'Dateien');
assets = { cssFile: css.name, jsFile: js.name };
const pages = buildPages();
tidyAssets([css.name, js.name]);

if (CHECK) {
  if (stale.length) {
    console.error(`Veraltet gegenüber src/:\n  ${stale.join('\n  ')}\n\nnode build.mjs ausführen.`);
    process.exit(1);
  }
  console.log(`Erzeugte Dateien sind auf dem Stand von src/ (${pages} Seiten, ${css.name}, ${js.name}).`);
} else {
  console.log(`Gebaut: ${pages} Seiten, ${css.count} CSS-Bausteine, ${js.count} Skript(e), ${baseNodes.length} Basis-Schemaknoten.\n        Bündel: ${css.name}, ${js.name}`);
}
