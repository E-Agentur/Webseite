#!/usr/bin/env node
/**
 * Kr3is – Prüfung der gebauten Seiten.
 *
 *   cd tools && npm install && npx playwright install chromium && npm run check
 *
 * Ist bereits ein Chromium vorhanden, genügt CHROMIUM_PATH=/pfad/zu/chrome.
 *
 * Der lokale Server liefert dieselben Kopfzeilen aus wie Netlify – die
 * Content-Security-Policy wird dazu aus netlify.toml gelesen. Was die Policy
 * blockiert, fällt damit hier als Konsolenfehler auf und nicht erst live.
 *
 * Geprüft wird je Seite in Chromium:
 *   1. Auslieferung   – keine fehlgeschlagenen Anfragen, keine Konsolenfehler
 *   2. Layout         – kein horizontaler Überlauf über zehn Breiten
 *   3. Plausibilität  – h1 nicht hinter der Kopfzeile, eine h1 je Seite,
 *                       keine Sprünge in der Überschriftenebene, Zeilenlänge
 *   4. Kontrast       – jeder sichtbare Textknoten auf einfarbigem Grund
 *                       gegen WCAG AA, in beiden Farbschemata
 *   5. Trefferflächen – Bedienelemente gegen die 24 px aus WCAG 2.2 (2.5.8)
 *   6. Zeigerbewegung – keine Skriptfehler, Drossel greift
 *   7. Formular       – Netlify-Merkmale, Pflichtfelder, Labels, Honigtopf
 *   8. Auszeichnung   – JSON-LD gültig, jede @id-Verweisung löst auf
 *   9. Auslieferbares – CSP-Hash passt zum Inline-Skript, Sitemap vollständig
 *  10. Ohne Skript   – kein Bedienelement, das ohne JavaScript nichts tut
 *  11. Build         – die erzeugten Dateien sind auf dem Stand von src/
 *
 * Punkt 3 gibt es, weil die übrigen Prüfungen eine Seite durchwinken, die
 * lediglich falsch gestaltet ist: Als das Layout der Rechtstexte einmal verloren
 * ging, meldete keine von ihnen etwas. Punkt 4 misst seit demselben Grund jeden
 * Textknoten statt einer Handvoll ausgewählter Paare – die Auswahl enthielt
 * keinen einzigen Button, und genau die verfehlten AA um 0,85 Stufen.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
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

/* Die Policy kommt aus netlify.toml, damit hier genau das gilt, was auch live
   gilt. Blockiert sie etwas, meldet Chromium einen Konsolenfehler – und den
   fängt Prüfung 1 bereits ab. */
const NETLIFY = readFileSync(join(ROOT, 'netlify.toml'), 'utf8');
const CSP = NETLIFY.match(/Content-Security-Policy = "([^"]+)"/)?.[1] ?? null;
if (!CSP) note('netlify.toml: keine Content-Security-Policy gefunden');

const server = createServer(async (req, res) => {
  const path = join(ROOT, normalize(decodeURI(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(path);
    const headers = { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' };
    if (CSP && extname(path) === '.html') headers['Content-Security-Policy'] = CSP;
    res.writeHead(200, headers);
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
      /* Über die CSSOM statt über ein <style>-Element: Letzteres verbietet
         die Content-Security-Policy, die dieser Server mitliefert. */
      await p.evaluate(() => {
        document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
        scrollTo(0, document.body.scrollHeight);
      });
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
/* Gemessen wird jeder sichtbare Textknoten, nicht eine Auswahl von Paaren.

   Was hinter einem Text liegt, verrät der Elternbaum nicht zuverlässig: Die
   Kopfzeile ist durchsichtig und schwebt über dem dunklen Hero, im Baum steht
   über ihr aber der weiße body. Deshalb wird der Text erst in die Mitte des
   Bildes gerollt, dann das Rechteck der Glyphen selbst bestimmt und über
   elementsFromPoint der Stapel geholt, der dort wirklich übereinanderliegt.
   Dessen Hintergründe werden von hinten nach vorne verrechnet, halbdurch-
   sichtige Schichten eingeschlossen. Liegt in diesem Stapel ein Verlauf oder
   ein Bild, ist die Farbe nicht eindeutig – solche Knoten werden gezählt und
   übergangen, statt einen erfundenen Wert zu melden. */
const parseColor = (c) => {
  const n = c.match(/[\d.]+/g).map(Number);
  return { r: n[0], g: n[1], b: n[2], a: n[3] === undefined ? 1 : n[3] };
};
const composite = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});
const ratioOf = (fg, bg) => {
  const rel = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const [hi, lo] = [rel(fg), rel(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let measured = 0;
let skipped = 0;
for (const colorScheme of ['light', 'dark']) {
  for (const page of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme });
    const p = await ctx.newPage();
    await p.goto(url(page), { waitUntil: 'networkidle' });
    await p.waitForTimeout(200);
    const nodes = await p.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        const texts = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
        if (!texts.length) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
        if (!el.getBoundingClientRect().width) continue;

        el.scrollIntoView({ block: 'center', behavior: 'instant' });

        /* Das Rechteck der Glyphen selbst, nicht das der Box – sonst zeigt der
           Messpunkt womöglich auf Weißraum neben dem Text. */
        const range = document.createRange();
        range.selectNodeContents(texts[0]);
        const line = [...range.getClientRects()].find((r) => r.width > 1 && r.height > 1);
        if (!line) continue;
        const x = line.left + Math.min(line.width / 2, 12);
        const y = line.top + line.height / 2;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;

        const stack = document.elementsFromPoint(x, y);
        if (!stack.includes(el)) continue;   // etwas liegt darüber, nicht messbar

        /* Von oben nach unten nur so weit, bis eine deckende Fläche kommt.
           Was darunter liegt, ist unsichtbar und darf die Messung weder
           färben noch – mit einem Verlauf – unmessbar machen: Ein Button mit
           eigener voller Fläche ist messbar, auch wenn er auf dem Hero sitzt. */
        const layers = [];
        let hasImage = false;
        for (const n of [...stack, document.documentElement]) {
          const s = getComputedStyle(n);
          const alpha = Number(s.backgroundColor.match(/[\d.]+/g)?.[3] ?? 1);
          if (s.backgroundImage !== 'none') hasImage = true;
          layers.push(s.backgroundColor);
          if (alpha === 1) break;
        }

        out.push({
          label: el.tagName.toLowerCase() +
            (typeof el.className === 'string' && el.className.trim()
              ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
          text: texts.map((n) => n.textContent.trim()).join(' ').slice(0, 32),
          color: cs.color, layers, hasImage,
          size: parseFloat(cs.fontSize), weight: cs.fontWeight,
        });
      }
      return out;
    });
    for (const n of nodes) {
      const ink = parseColor(n.color);
      if (ink.a === 0) continue;               // etwa Text mit background-clip
      if (n.hasImage) { skipped++; continue; } // Verlauf dahinter, nicht messbar
      let bg = { r: 255, g: 255, b: 255, a: 1 };
      for (let i = n.layers.length - 1; i >= 0; i--) {
        const layer = parseColor(n.layers[i]);
        if (layer.a > 0) bg = composite(layer, bg);
      }
      const value = ratioOf(composite(ink, bg), bg);
      const large = n.size >= 24 || (n.size >= 18.66 && Number(n.weight) >= 700);
      const required = large ? 3 : 4.5;
      measured++;
      if (value < required)
        note(`Kontrast ${colorScheme} ${page} ${n.label} "${n.text}": ` +
             `${value.toFixed(2)}:1, nötig ${required}:1 bei ${n.size}px`);
    }
    await ctx.close();
  }
}
console.log(`Kontraste geprüft: ${measured} Textknoten gegen WCAG AA ` +
            `(${skipped} auf Verlauf oder Bild, nicht eindeutig messbar).`);

/* ---------- 5: Trefferflächen ---------- */
/* WCAG 2.2 (2.5.8) verlangt 24×24 px. Links, die in einem Satz stehen, sind
   davon ausgenommen – ihre Größe gibt die Zeile vor. Geprüft wird deshalb nur,
   was für sich steht: Schaltflächen, Formularfelder, Navigationslinks. */
for (const page of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(url(page), { waitUntil: 'networkidle' });
  const tight = await p.evaluate(() => {
    /* Die Ausnahme in 2.5.8 gilt Links im Fließtext, deren Größe die Zeile
       vorgibt. Entscheidend ist deshalb, ob der Elternknoten eigenen Text
       führt – nicht, ob er noch weitere Links enthält: Eine Navigationsliste
       aus lauter Links ist kein Satz. */
    const inSentence = (el) => {
      if (el.tagName !== 'A') return false;
      const parent = el.parentElement;
      if (!parent) return false;
      return [...parent.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    };
    return [...document.querySelectorAll('a[href],button,input,select,textarea,summary')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;         // ausgeblendet
        if (el.closest('label')) return false;           // das Label ist das Ziel
        if (inSentence(el)) return false;
        return r.height < 24 || r.width < 24;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()} "${(el.textContent || el.name || '').trim().slice(0, 24)}" ` +
               `${Math.round(r.width)}×${Math.round(r.height)}`;
      });
  });
  for (const t of tight) note(`${page}: Trefferfläche unter 24 px – ${t}`);
  await ctx.close();
}
console.log('Trefferflächen geprüft.');

/* ---------- 6: Zeigerbewegung ---------- */
/* Der Lichtkegel auf den Kacheln hing an einer Drossel, deren Wächterabfrage
   nie zutraf: jede Bewegung meldete ein eigenes Bild an, und wer im selben
   Bild als Zweiter drankam, las eine bereits geleerte Ablage. Sichtbar war
   nichts davon – die übrigen Prüfungen bewegen keinen Zeiger. */
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(url('index.html'), { waitUntil: 'networkidle' });
  const frames = await p.evaluate(async () => {
    const card = document.querySelector('#leistungen .card');
    card.scrollIntoView();
    await new Promise((r) => setTimeout(r, 120));
    const original = window.requestAnimationFrame;
    let count = 0;
    window.requestAnimationFrame = function (cb) { count++; return original.call(window, cb); };
    const box = card.getBoundingClientRect();
    for (let i = 0; i < 20; i++) {
      card.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, clientX: box.left + 10 + i, clientY: box.top + 10,
      }));
    }
    await new Promise((r) => setTimeout(r, 300));
    window.requestAnimationFrame = original;
    return count;
  });
  if (frames > 3) note(`Zeigerbewegung: 20 Ereignisse melden ${frames} Bilder an – Drossel greift nicht`);
  for (const e of errors) note(`Zeigerbewegung: ${e}`);
  await ctx.close();
}
console.log('Zeigerbewegung geprüft.');

/* ---------- 7: Formular ---------- */
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

/* ---------- 8: Strukturierte Daten ---------- */
/* Jede Seite trägt genau einen Graphen. Wichtig ist nicht nur, dass er gültig
   ist, sondern dass jede Verweisung darin auch aufgeht: Der Service auf
   it-sicherheit.html nannte einmal einen Anbieter, den keine Seite definierte –
   gültiges JSON, aber ein Knoten, der ins Leere zeigt. */
for (const page of PAGES) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(url(page), { waitUntil: 'domcontentloaded' });
  const blocks = await p.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent));
  if (!blocks.length) { note(`${page}: kein JSON-LD`); await ctx.close(); continue; }
  const defined = new Set();
  const referenced = [];
  for (const raw of blocks) {
    let data;
    try { data = JSON.parse(raw); }
    catch (e) { note(`${page}: JSON-LD ist ungültig – ${e.message}`); continue; }
    const walk = (node, parentIsRef) => {
      if (Array.isArray(node)) return node.forEach((n) => walk(n, false));
      if (!node || typeof node !== 'object') return;
      const keys = Object.keys(node);
      if (typeof node['@id'] === 'string') {
        // Ein Objekt, das nur aus @id besteht, verweist; jedes andere definiert.
        if (keys.length === 1) referenced.push(node['@id']);
        else defined.add(node['@id']);
      }
      for (const k of keys) if (k !== '@id') walk(node[k], false);
    };
    walk(data, false);
  }
  for (const id of new Set(referenced))
    if (!defined.has(id)) note(`${page}: JSON-LD verweist auf "${id}", die Seite definiert den Knoten nicht`);
  await ctx.close();
}
console.log('Strukturierte Daten geprüft.');

/* ---------- 9: Auslieferbares ---------- */
/* Der CSP-Hash steht fest in netlify.toml, das Skript dazu wird gebaut. Gehen
   beide auseinander, blockiert der Browser das Skript gegen das Farb-Aufblitzen
   und die Seite erscheint kurz in der falschen Farbe. Das fällt live niemandem
   auf – hier schon. */
{
  const inline = new Set();
  for (const page of PAGES) {
    const html = readFileSync(join(ROOT, page), 'utf8');
    const re = /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g;
    for (const m of html.matchAll(re)) inline.add(m[1]);
  }
  for (const body of inline) {
    const hash = `sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`;
    if (CSP && !CSP.includes(hash))
      note(`CSP: Hash für ein Inline-Skript fehlt – erwartet '${hash}'`);
  }
  if (CSP && /script-src[^;]*'unsafe-inline'/.test(CSP))
    note("CSP: script-src erlaubt 'unsafe-inline' – der Hash macht das entbehrlich");
  if (CSP && /style-src[^;]*'unsafe-inline'/.test(CSP))
    note("CSP: style-src erlaubt 'unsafe-inline'");
  for (const page of PAGES) {
    const html = readFileSync(join(ROOT, page), 'utf8');
    if (/<[^>]+\sstyle="/.test(html))
      note(`${page}: style-Attribut im Markup – unter style-src 'self' wirkungslos`);
  }
  console.log(`Inline-Skripte: ${inline.size} verschiedene, jeweils über CSP-Hash freigegeben.`);
}

/* Eine neue Seite, die in der Sitemap fehlt, wird schlechter gefunden; eine
   noindex-Seite darin ist ein Widerspruch. Beides bleibt sonst unbemerkt. */
{
  const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  const listed = [...sitemap.matchAll(/<loc>https:\/\/kr3is\.com\/([^<]*)<\/loc>/g)].map((m) => m[1]);
  for (const page of PAGES) {
    const html = readFileSync(join(ROOT, page), 'utf8');
    const noindex = /name="robots"[^>]*noindex/.test(html);
    const canonical = html.match(/rel="canonical" href="https:\/\/kr3is\.com\/([^"]*)"/)?.[1];
    if (canonical === undefined) { note(`${page}: kein canonical`); continue; }
    const inSitemap = listed.includes(canonical);
    if (noindex && inSitemap) note(`sitemap.xml führt ${page}, die Seite trägt aber noindex`);
    if (!noindex && !inSitemap) note(`sitemap.xml führt ${page} nicht`);
  }
  for (const loc of listed)
    if (!PAGES.some((page) => {
      const html = readFileSync(join(ROOT, page), 'utf8');
      return html.includes(`rel="canonical" href="https://kr3is.com/${loc}"`);
    })) note(`sitemap.xml führt "${loc}" – dazu gibt es keine Seite`);
  console.log(`Sitemap geprüft: ${listed.length} Adressen.`);
}

/* ---------- 10: Ohne JavaScript ---------- */
/* Die Seite ist so gebaut, dass sie ohne Skript trägt – Reveal und Kopfzeile
   laufen über CSS. Eine Ausnahme gibt es: Das mobile Menü bedient app.js. Ohne
   Skript stand dort eine Schaltfläche, die nichts tat. Geprüft wird deshalb,
   dass ohne Skript keine Bedienelemente sichtbar bleiben, die es braucht –
   und dass die Seite ansonsten vollständig ankommt. */
for (const page of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  p.on('requestfailed', (r) => note(`${page} ohne JS: Anfrage fehlgeschlagen ${r.url()}`));
  await p.goto(url(page), { waitUntil: 'networkidle' });
  const { result } = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      /* Sichtbar heißt: gerendert und nicht von einem Vorfahren ausgeblendet. */
      const gezeigt = (el) => {
        if (!el) return false;
        if (!el.getClientRects().length) return false;
        return getComputedStyle(el).visibility === 'visible';
      };
      return JSON.stringify({
        menuBtn: gezeigt(document.querySelector('.menu-btn')),
        h1: (document.querySelector('h1') || {}).textContent ? true : false,
        fuss: document.querySelectorAll('footer a[href]').length,
        ueberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      });
    })()`,
  });
  const r = JSON.parse(result.value);
  if (r.menuBtn) note(`${page} ohne JS: Menü-Schaltfläche sichtbar, ohne Skript tut sie nichts`);
  if (!r.h1) note(`${page} ohne JS: keine h1`);
  if (r.fuss < 2) note(`${page} ohne JS: Fußzeile führt ${r.fuss} Links`);
  if (r.ueberlauf > 0) note(`${page} ohne JS: horizontaler Überlauf ${r.ueberlauf}px`);
  await ctx.close();
}
console.log('Verhalten ohne JavaScript geprüft.');

/* ---------- 11: Erzeugte Dateien gegen src/ ---------- */
/* Geprüft werden die gebauten Dateien. Sind sie veraltet, prüft die Suite
   einen Stand, den niemand mehr bearbeitet hat. */
{
  const build = spawnSync(process.execPath, [join(ROOT, 'build.mjs'), '--check'],
                          { cwd: ROOT, encoding: 'utf8' });
  if (build.status !== 0) note(`Build: ${(build.stderr || build.stdout).trim()}`);
}
console.log('Stand der erzeugten Dateien geprüft.');

await browser.close();
server.close();

console.log('\n=== ERGEBNIS ===');
if (problems.length) { console.log(problems.join('\n')); process.exitCode = 1; }
else console.log('Keine Befunde.');
