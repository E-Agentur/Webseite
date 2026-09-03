#!/usr/bin/env node
/**
 * Kr3is – Build ohne Abhängigkeiten.
 *
 *   node build.mjs
 *
 * Setzt die Seiten aus src/ zusammen:
 *   src/css/*.css      -> assets/site.<hash>.css   (nach Dateinamen sortiert, Reihenfolge zählt)
 *   src/js/*.js        -> assets/site.<hash>.js
 *   src/pages/*.html   -> ./*.html                 (mit Bausteinen aus src/partials/)
 *
 * Seitensyntax: eine JSON-Kopfzeile <!--{ ... }--> am Dateianfang, danach der
 * Inhalt. Bausteine werden mit <!-- include: name --> eingesetzt, Variablen mit
 * {{name}}. Bausteine dürfen ihrerseits Bausteine und Variablen enthalten.
 *
 * Der Name der Bündel trägt den Inhalt: ändert sich eine Zeile CSS, ändert sich
 * der Dateiname, und erst dann lädt ein wiederkehrender Besucher neu. Deshalb
 * darf netlify.toml die Assets ein Jahr lang als unveränderlich ausliefern.
 * Die Seiten selbst verweisen auf den gebauten Namen, alte Stände werden
 * gelöscht.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';

const BANNER = 'GENERIERT von build.mjs – nicht direkt bearbeiten, sondern src/ ändern.';
const read = (p) => readFileSync(p, 'utf8');
const hash8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8);

/* ---------- Kommentare entfernen ----------
   CSS: ein Durchlauf, der Zeichenketten kennt – ein /* in content:"…" oder in
   einer url() darf nicht als Kommentaranfang gelesen werden.
   JS: zeilenweise, damit weder Zeichenketten noch reguläre Ausdrücke in der
   Mitte einer Zeile angefasst werden. Entfernt wird nur, was allein auf seiner
   Zeile steht. */
function stripCssComments(css) {
  let out = '';
  let quote = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      out += c;
      if (c === '\\') { out += css[++i] ?? ''; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; out += c; continue; }
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) throw new Error('CSS: Kommentar ohne Ende');
      i = end + 1;
      continue;
    }
    out += c;
  }
  return out;
}

function stripJsComments(js) {
  const out = [];
  let inBlock = false;
  for (const line of js.split('\n')) {
    const t = line.trim();
    if (inBlock) { if (t.endsWith('*/')) inBlock = false; continue; }
    if (t.startsWith('/*')) { if (!t.endsWith('*/')) inBlock = true; continue; }
    if (t.startsWith('//')) continue;
    out.push(line);
  }
  if (inBlock) throw new Error('JS: Kommentar ohne Ende');
  return out.join('\n');
}

/* Leerzeilen und Einzug fallen weg. Bewusst nicht mehr: Kürzen von Bezeichnern
   oder Zusammenziehen von Regeln spart wenig und bricht leicht etwas. */
const squeeze = (s) => s.replace(/^[ \t]+/gm, '').replace(/\n{2,}/g, '\n').trim();

/* ---------- Stylesheet und Skript bündeln ---------- */
function bundle(dir, ext, strip) {
  const files = readdirSync(dir).filter((f) => !f.startsWith('.')).sort();
  const body = squeeze(strip(files.map((f) => read(join(dir, f))).join('\n')));
  const name = `site.${hash8(body)}.${ext}`;
  writeFileSync(join('assets', name), `/* ${BANNER} */\n${body}\n`);
  return { name, count: files.length };
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
    /* Der Zeilenumbruch am Dateiende gehört zur Datei, nicht zum Baustein –
       sonst reißt jeder Einsatz eine Leerzeile in die Seite. */
    return partials[name].replace(/\n+$/, '');
  });
  out = out.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    if (!(key in vars)) throw new Error(`Variable "${key}" ist nicht gesetzt`);
    return vars[key];
  });
  return /<!--\s*include:|\{\{/.test(out) ? expand(out, vars, depth + 1) : out;
}

/* ---------- Fragen und Antworten auszeichnen ----------
   schema.org/FAQPage aus dem Markup erzeugen statt danebenzuschreiben: eine
   von Hand gepflegte Kopie läuft irgendwann auseinander, und ausgezeichnet
   werden darf nur, was auch auf der Seite steht. Die Seite nutzt <details>
   ausschließlich für diesen Abschnitt. */
const plain = (html) => html
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function faqJsonLd(content) {
  const items = [...content.matchAll(
    /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (!items.length) return '';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([, q, a]) => ({
      '@type': 'Question',
      name: plain(q),
      acceptedAnswer: { '@type': 'Answer', text: plain(a) },
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

/* ---------- Seiten bauen ---------- */
function buildPages(assets) {
  const shell = read('src/partials/_shell.html');
  const names = readdirSync('src/pages').filter((f) => f.endsWith('.html'));
  for (const file of names) {
    const raw = read(join('src/pages', file));
    const m = raw.match(/^<!--(\{[\s\S]*?\})-->\n?/);
    if (!m) throw new Error(`${file}: JSON-Kopf <!--{ ... }--> fehlt`);
    const meta = JSON.parse(m[1]);
    const vars = {
      bodyClass: '',
      mainClass: '',
      ogTitle: meta.title,
      ogDescription: meta.description,
      noindex: '',
      headExtra: '',
      ...assets,
      ...meta,
      content: raw.slice(m[0].length).trim(),
    };
    const faq = faqJsonLd(vars.content);
    if (faq) vars.headExtra = [vars.headExtra, faq].filter(Boolean).join('\n');
    const html = expand(shell, vars)
      .replace(/ class=""/g, '')          // leere Attribute nicht ausliefern
      .replace(/\n{3,}/g, '\n\n');
    writeFileSync(file, html);
  }
  return names.length;
}

/* ---------- Content-Security-Policy nachziehen ----------
   Das Skript gegen das Farb-Aufblitzen muss inline im <head> stehen, sonst
   blitzt beim Laden die falsche Farbe auf. Statt script-src für alles zu
   öffnen, steht sein Prüfwert in der Kopfzeile.
   Netlify liest netlify.toml, bevor der Build läuft – die Datei hier zu
   ändern wirkt also erst beim nächsten Deploy. Darum schreibt der Build den
   Wert in die eingecheckte Datei und sagt es, wenn er sich geändert hat;
   tools/check.mjs schlägt Alarm, falls jemand das Ergebnis nicht mitcommittet. */
function syncCsp() {
  const shell = read('src/partials/_shell.html');
  /* Nur ausführbare Skripte zählen: einen Datenblock wie
     <script type="application/ld+json"> führt kein Browser aus, er wird
     darum auch nicht gegen script-src geprüft. */
  const scripts = [...shell.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(
    ([, attrs]) => {
      if (/\bsrc=/.test(attrs)) return false;
      const type = attrs.match(/\btype="([^"]*)"/)?.[1];
      return !type || /^(text\/javascript|application\/javascript|module)$/i.test(type.trim());
    },
  );
  if (!scripts.length) throw new Error('Kein Inline-Skript in der Shell gefunden');
  const digests = scripts.map(
    (m) => `'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`,
  );
  const toml = read('netlify.toml');
  const line = /(Content-Security-Policy = ")([^"]*)(")/;
  if (!line.test(toml)) throw new Error('netlify.toml: Content-Security-Policy nicht gefunden');
  let changed = false;
  const next = toml.replace(line, (_, a, policy, c) => {
    const updated = policy.replace(
      /script-src [^;]*/,
      `script-src 'self' ${digests.join(' ')}`,
    );
    changed = updated !== policy;
    return a + updated + c;
  });
  if (changed) writeFileSync('netlify.toml', next);
  return changed;
}

mkdirSync('assets', { recursive: true });
for (const f of readdirSync('assets')) {
  if (/^site\.[0-9a-f]{8}\.(css|js)$/.test(f) || f === 'site.css' || f === 'site.js') {
    rmSync(join('assets', f));
  }
}
const css = bundle('src/css', 'css', stripCssComments);
const js = bundle('src/js', 'js', stripJsComments);
const pages = buildPages({ cssHref: `assets/${css.name}`, jsHref: `assets/${js.name}` });
const cspChanged = syncCsp();
console.log(`Gebaut: ${pages} Seiten, ${css.count} CSS-Bausteine, ${js.count} Skript(e).`);
console.log(`Assets: ${css.name}, ${js.name}`);
if (cspChanged) console.log('Hinweis: CSP in netlify.toml angepasst – bitte mitcommitten.');
