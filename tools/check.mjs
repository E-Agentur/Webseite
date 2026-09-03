#!/usr/bin/env node
/**
 * Kr3is – Prüfung der gebauten Seiten.
 *
 *   cd tools && npm install && npx playwright install chromium && npm run check
 *
 * Ist bereits ein Chromium vorhanden, genügt CHROMIUM_PATH=/pfad/zu/chrome.
 *
 * Startet einen lokalen Server, öffnet jede Seite in Chromium und prüft:
 *   1. Auslieferung   – keine fehlgeschlagenen Anfragen, keine Konsolenfehler
 *   2. Layout         – kein horizontaler Überlauf über zehn Breiten
 *   3. Plausibilität  – h1 nicht hinter der Kopfzeile, eine h1 je Seite,
 *                       keine Sprünge in der Überschriftenebene, Zeilenlänge
 *   4. Kontrast       – gemessene Text-/Hintergrundpaare gegen WCAG AA
 *   5. Formular       – Netlify-Merkmale, Pflichtfelder, Labels, Honigtopf
 *   6. Auslieferung   – Assets aufloesbar, CSP ohne 'unsafe-inline' und mit
 *                       passendem Prüfwert, keine style-Attribute
 *   7. Zeiger         – Lichtkegel auf den Karten ohne Skriptfehler
 *   8. Auffindbarkeit – JSON-LD gültig, jede @id-Verweisung aufgelöst, jede
 *                       indexierbare Seite in sitemap.xml und mit canonical
 *
 * Punkt 3 gibt es, weil die ersten drei Prüfungen eine Seite durchwinken, die
 * lediglich falsch gestaltet ist: Als das Layout der Rechtstexte einmal verloren
 * ging, meldete keine von ihnen etwas.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8899;
const PAGES = ['index.html', 'it-sicherheit.html', 'betroffenheit.html',
               'danke.html', 'impressum.html', 'datenschutz.html', '404.html'];
const WIDTHS = [1600, 1440, 1200, 1024, 900, 768, 640, 480, 390, 360];
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css',
                '.js': 'text/javascript', '.png': 'image/png',
                '.xml': 'application/xml', '.txt': 'text/plain' };

const problems = [];
const note = (m) => problems.push(m);

/* Die Kopfzeilen aus netlify.toml gehören zur Seite. Liefert der Prüfserver sie
   nicht mit, prüft er etwas anderes als das Netz: eine zu enge Policy fällt
   dann erst in der Produktion auf. Verstöße erscheinen als Konsolenfehler und
   landen damit in Prüfung 1. */
/* Ausführbare Inline-Skripte: ohne src, und ohne type oder mit einem
   JavaScript-Typ. Ein <script type="application/ld+json"> ist ein Datenblock. */
const JS_TYPE = /^(text\/javascript|application\/javascript|module)$/i;
function* inlineScripts(html) {
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const [, attrs, code] = m;
    if (/\bsrc=/.test(attrs)) continue;
    const type = attrs.match(/\btype="([^"]*)"/)?.[1];
    if (type && !JS_TYPE.test(type.trim())) continue;
    yield [attrs, code];
  }
}

const TOML = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
const CSP = TOML.match(/Content-Security-Policy = "([^"]*)"/)?.[1];
if (!CSP) note('netlify.toml: Content-Security-Policy nicht gefunden');

/* Relative Leuchtdichte und Kontrastverhältnis nach WCAG 2.1 */
const luminance = (c) => {
  const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number)
    .map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const server = createServer(async (req, res) => {
  const path = join(ROOT, normalize(decodeURI(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(path);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
      ...(CSP ? { 'Content-Security-Policy': CSP } : {}),
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('nicht gefunden');
  }
});
await new Promise((r) => server.listen(PORT, r));
const url = (p) => `http://localhost:${PORT}/${p}`;

/* CHROMIUM_PATH erlaubt einen bereits vorhandenen Browser, etwa in einer CI,
   in der „npx playwright install“ nicht laufen soll. */
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

/* ---------- 1 + 2: Auslieferung und Überlauf ---------- */
for (const page of PAGES) {
  for (const colorScheme of ['light', 'dark']) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      const p = await ctx.newPage();
      const where = `${page}/${colorScheme}/${width}`;
      p.on('pageerror', (e) => note(`${where}: Skriptfehler ${e.message}`));
      p.on('console', (m) => m.type() === 'error' && note(`${where}: ${m.text()}`));
      p.on('requestfailed', (r) => note(`${where}: Anfrage fehlgeschlagen ${r.url()}`));
      p.on('response', (r) => r.status() >= 400 && note(`${where}: ${r.status()} ${r.url()}`));
      await p.goto(url(page), { waitUntil: 'networkidle' });
      /* Kein style-Element einhängen: die ausgelieferte CSP verbietet inline
         Stile. Eine Zuweisung über das CSSOM fällt nicht darunter. */
      await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
      await p.evaluate(() => scrollTo(0, document.body.scrollHeight));
      await p.waitForTimeout(120);
      const over = await p.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) note(`${where}: horizontaler Überlauf ${over}px`);
      await ctx.close();
    }
  }
}
console.log(`Auslieferung und Überlauf: ${PAGES.length * 2 * WIDTHS.length} Kombinationen geprüft.`);

/* ---------- 3: Layout-Plausibilität ---------- */
for (const page of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url(page), { waitUntil: 'networkidle' });
  await p.waitForTimeout(250);
  const r = await p.evaluate(() => {
    const header = document.querySelector('header').getBoundingClientRect().height;
    const h1 = document.querySelector('h1');
    let widest = 0;
    for (const el of document.querySelectorAll('p, li')) {
      if (el.textContent.trim().length < 80) continue;
      const chars = el.getBoundingClientRect().width / (parseFloat(getComputedStyle(el).fontSize) * 0.5);
      if (chars > widest) widest = chars;
    }
    const levels = [...document.querySelectorAll('h1,h2,h3,h4')].map((e) => +e.tagName[1]);
    const skips = levels.flatMap((lvl, i) =>
      i && lvl - levels[i - 1] > 1 ? [`h${levels[i - 1]}→h${lvl}`] : []);
    return { header, h1Top: h1?.getBoundingClientRect().top ?? null,
             chars: Math.round(widest), skips, h1Count: document.querySelectorAll('h1').length };
  });
  if (r.h1Top !== null && r.h1Top < r.header) note(`${page}: h1 liegt hinter der Kopfzeile`);
  if (r.chars > 110) note(`${page}: Zeilenlänge etwa ${r.chars} Zeichen`);
  if (r.h1Count !== 1) note(`${page}: ${r.h1Count} h1-Elemente statt einer`);
  if (r.skips.length) note(`${page}: Überschriftensprung ${r.skips.join(', ')}`);
  await ctx.close();
}
console.log('Layout-Plausibilität geprüft.');

/* ---------- 4: Kontraste ---------- */
const PAIRS = [
  ['index.html', 'Fließtext', '#leistungen .lead', 'body'],
  ['index.html', 'Kachel-Liste', '#leistungen .card ul li', '#leistungen .card'],
  ['index.html', 'Fußzeile', '.foot', 'footer'],
  ['it-sicherheit.html', 'Kacheltext', '.card p', '.card'],
  ['it-sicherheit.html', 'Rücklink', '.backlink', 'body'],
  ['betroffenheit.html', 'Feldbeschriftung', '.field label', 'body'],
  ['betroffenheit.html', 'Hinweis', '.hint', 'body'],
  ['betroffenheit.html', 'Einwilligung', '.consent', '.consent'],
  ['impressum.html', 'Link im Rechtstext', '.legal a', 'body'],
];
for (const colorScheme of ['light', 'dark']) {
  for (const [page, label, fgSel, bgSel] of PAIRS) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme });
    const p = await ctx.newPage();
    await p.goto(url(page), { waitUntil: 'networkidle' });
    const pair = await p.evaluate(([f, b]) => {
      const fe = document.querySelector(f); const be = document.querySelector(b);
      return fe && be ? [getComputedStyle(fe).color, getComputedStyle(be).backgroundColor] : null;
    }, [fgSel, bgSel]);
    if (!pair) { note(`${page}: Kontrastpaar "${label}" nicht gefunden`); await ctx.close(); continue; }
    const ratio = contrast(pair[0], pair[1]);
    if (ratio < 4.5) note(`Kontrast ${colorScheme} ${page} ${label}: ${ratio.toFixed(2)}:1`);
    await ctx.close();
  }
}
console.log(`Kontraste geprüft: ${PAIRS.length * 2} Paare gegen WCAG AA.`);

/* ---------- 5: Formular ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url('betroffenheit.html'), { waitUntil: 'networkidle' });
  const f = await p.evaluate(() => {
    const el = document.querySelector('form');
    return { name: el.getAttribute('name'), netlify: el.getAttribute('data-netlify'),
             honeypot: el.getAttribute('netlify-honeypot'),
             method: el.getAttribute('method'),
             formName: document.querySelector('input[name="form-name"]')?.value,
             hpOffscreen: document.querySelector('.hp').getBoundingClientRect().right < 0,
             unlabeled: [...document.querySelectorAll('input:not([type=hidden]),select,textarea')]
               .filter((e) => !e.closest('label') &&
                 !(e.id && document.querySelector(`label[for="${e.id}"]`)))
               .map((e) => e.name || e.id) };
  });
  if (f.netlify !== 'true') note('Formular: data-netlify fehlt');
  if (f.formName !== f.name) note('Formular: form-name passt nicht zum Namen');
  if (!f.honeypot) note('Formular: netlify-honeypot fehlt');
  if (f.method?.toUpperCase() !== 'POST') note('Formular: Methode ist nicht POST');
  if (!f.hpOffscreen) note('Formular: Honigtopf ist sichtbar');
  if (f.unlabeled.length) note(`Formular: Felder ohne Label – ${f.unlabeled.join(', ')}`);

  await p.click('button[type="submit"]');
  await p.waitForTimeout(250);
  if (!p.url().includes('betroffenheit')) note('Formular: wurde ohne Pflichtfelder abgeschickt');
  await ctx.close();
}
console.log('Formular geprüft.');

/* ---------- 6: Auslieferung – Assets, CSP, Markup ---------- */
{
  const root = new URL('..', import.meta.url).pathname;
  for (const page of PAGES) {
    const html = await readFile(join(root, page), 'utf8');

    /* Der Dateiname der Bündel trägt einen Inhalts-Hash. Wer src/ ändert und
       den Build vergisst, verweist auf einen Namen, den es nicht mehr gibt. */
    for (const [, href] of html.matchAll(/(?:href|src)="((?:assets|og)[^"]*)"/g)) {
      if (!existsSync(join(root, href))) note(`${page}: verweist auf fehlendes ${href}`);
    }

    /* style-Attribute zwängen die Auslieferung zurück zu style-src
       'unsafe-inline'. Was sie regeln, gehört ins Stylesheet. */
    const styles = html.match(/ style="[^"]*"/g);
    if (styles) note(`${page}: ${styles.length} style-Attribut(e) – ${styles[0].trim()}`);

    /* Jedes ausführbare Inline-Skript muss mit seinem Prüfwert in script-src
       stehen. Datenblöcke wie application/ld+json führt kein Browser aus und
       prüft sie deshalb auch nicht gegen script-src. */
    for (const [attrs, code] of inlineScripts(html)) {
      void attrs;
      const digest = `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`;
      if (CSP && !CSP.includes(digest)) {
        note(`${page}: Inline-Skript ${digest} fehlt in der CSP – „node build.mjs“ vergessen?`);
      }
    }
  }
  if (CSP && CSP.includes("'unsafe-inline'")) note("CSP enthält 'unsafe-inline'");
  if (CSP && !/max-age=31536000/.test(TOML)) note('Assets werden nicht langfristig zwischengespeichert');
}
console.log('Auslieferung geprüft: Assets, CSP, Markup.');

/* ---------- 7: Zeiger über den Karten ----------
   Der Lichtkegel folgt dem Zeiger über requestAnimationFrame. Fasst ein Browser
   pointermove nicht je Frame zusammen – ein Stift, eine Maus mit hoher
   Abtastrate –, treffen mehrere Ereignisse denselben Frame. Genau da lag ein
   Fehler; deshalb wird hier nicht die Maus bewegt, sondern gezielt gestapelt. */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(url('index.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const card = document.querySelector('.card');
    card.scrollIntoView();
    const r = card.getBoundingClientRect();
    for (let i = 0; i < 8; i++) {
      card.dispatchEvent(new PointerEvent('pointermove',
        { bubbles: true, clientX: r.left + 10 + i, clientY: r.top + 10 + i }));
    }
  });
  /* Auf den Frame warten statt eine Frist zu raten: der Rückruf hängt an
     requestAnimationFrame, und wann der Browser den nächsten Frame zeichnet,
     entscheidet nicht die Prüfung. Eine feste Wartezeit hat hier schon einmal
     grundlos angeschlagen. */
  try {
    await p.waitForFunction(
      () => document.querySelector('.card').style.getPropertyValue('--mx') !== '',
      null, { timeout: 5000 });
  } catch {
    note('Zeiger über Karte: --mx wurde nicht gesetzt');
  }
  if (errors.length) note(`Zeiger über Karte: ${errors[0]}`);
  await ctx.close();
}
console.log('Zeigerbewegung über den Karten geprüft.');

/* ---------- 8: Auffindbarkeit ----------
   Strukturierte Daten verweisen mit @id aufeinander. Ein Verweis, den keine
   Seite definiert, sieht im Quelltext richtig aus und bleibt für Suchmaschinen
   leer – genau das war der Fall, als die Unterseite ihren Anbieter über
   „#organisation“ benannte und die Startseite den Knoten nirgends führte. */
{
  const root = new URL('..', import.meta.url).pathname;
  const defined = new Set();
  const referenced = [];

  const walk = (node, page) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, page));
    if (!node || typeof node !== 'object') return;
    if (node['@id']) (node['@type'] ? defined : { add: () => {} }).add(node['@id']);
    if (node['@id'] && !node['@type']) referenced.push([page, node['@id']]);
    Object.values(node).forEach((v) => walk(v, page));
  };

  const indexable = [];
  for (const page of PAGES) {
    const html = await readFile(join(root, page), 'utf8');
    for (const m of html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { walk(JSON.parse(m[1]), page); }
      catch (e) { note(`${page}: JSON-LD ist kein gültiges JSON – ${e.message}`); }
    }
    if (!/name="robots"[^>]*noindex/.test(html)) {
      indexable.push(page);
      if (!/<link rel="canonical"/.test(html)) note(`${page}: kein canonical`);
    }
  }
  for (const [page, id] of referenced) {
    if (!defined.has(id)) note(`${page}: JSON-LD verweist auf ${id}, das keine Seite führt`);
  }

  /* Wer eine Seite hinzufügt, denkt selten an die sitemap. */
  const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
  for (const page of indexable) {
    const loc = page === 'index.html' ? 'https://kr3is.com/' : `https://kr3is.com/${page}`;
    if (!sitemap.includes(`<loc>${loc}</loc>`)) note(`${page}: fehlt in sitemap.xml`);
  }
  for (const [, loc] of sitemap.matchAll(/<loc>https:\/\/kr3is\.com\/([^<]*)<\/loc>/g)) {
    const page = loc === '' ? 'index.html' : loc;
    if (!existsSync(join(root, page))) note(`sitemap.xml führt ${loc}, das es nicht gibt`);
  }
}
console.log('Auffindbarkeit geprüft: JSON-LD, canonical, sitemap.');

await browser.close();
server.close();

console.log('\n=== ERGEBNIS ===');
if (problems.length) { console.log(problems.join('\n')); process.exitCode = 1; }
else console.log('Keine Befunde.');
