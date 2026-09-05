#!/usr/bin/env node
/**
 * Kr3is – Bericht zur Startbereitschaft.
 *
 *   node tools/launch.mjs
 *
 * Sammelt, was vor dem Livegang noch offen ist, und liest das aus den Dateien
 * statt aus dem README: Eine Liste im README veraltet, sobald jemand einen
 * Platzhalter ersetzt und das Nachtragen vergisst.
 *
 * Bewusst kein Teil von "npm run check". Die Punkte hier sind vor dem Livegang
 * richtig so und dürfen die laufende Prüfung nicht rot färben. Der Exitcode ist
 * trotzdem 1, solange etwas offen ist – damit taugt der Bericht als Sperre
 * unmittelbar vor der Veröffentlichung.
 *
 * Ohne Abhängigkeiten; läuft auch ohne "npm install" in tools/.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const quellen = readdirSync(join(ROOT, 'src/pages')).map((f) => `src/pages/${f}`)
  .concat(readdirSync(join(ROOT, 'src/partials')).filter((f) => f.endsWith('.html'))
    .map((f) => `src/partials/${f}`));

let offen = 0;
const abschnitt = (titel, zeilen, rat) => {
  if (!zeilen.length) return;
  offen += zeilen.length;
  console.log(`\n${titel} (${zeilen.length})`);
  for (const z of zeilen) console.log(`  ${z}`);
  if (rat) console.log(`  → ${rat}`);
};

/* ---------- Platzhalter in eckigen Klammern ---------- */
{
  const treffer = [];
  for (const datei of quellen) {
    read(datei).split('\n').forEach((zeile, i) => {
      for (const m of zeile.matchAll(/\[([^\]\n]{2,60})\]/g)) {
        if (/^https?:/.test(m[1])) continue;          // Markdown-artige Verweise
        treffer.push(`${datei}:${i + 1}  [${m[1]}]`);
      }
    });
  }
  const nachName = new Map();
  for (const t of treffer) {
    const name = t.slice(t.indexOf('['));
    nachName.set(name, (nachName.get(name) ?? 0) + 1);
  }
  abschnitt('Platzhalter, noch nicht ersetzt',
    [...nachName].sort().map(([name, n]) => `${name}${n > 1 ? `  (${n}×)` : ''}`),
    'Jeder steht genau einmal in src/ – die gebauten Dateien entstehen daraus.');
}

/* ---------- Hinweiskästen der Rechtstexte ---------- */
{
  const zeilen = [];
  for (const datei of quellen) {
    read(datei).split('\n').forEach((zeile, i) => {
      if (/Hinweis für die Redaktion/.test(zeile)) zeilen.push(`${datei}:${i + 1}`);
    });
  }
  abschnitt('Redaktionshinweise stehen noch in der Seite', zeilen,
    'Vor der Veröffentlichung den umgebenden <div class="box"> entfernen.');
}

/* ---------- Unvollständige Telefonverweise ---------- */
{
  const zeilen = [];
  for (const datei of quellen) {
    read(datei).split('\n').forEach((zeile, i) => {
      for (const m of zeile.matchAll(/href="tel:([^"]*)"/g)) {
        const ziffern = m[1].replace(/[^\d]/g, '');
        if (ziffern.length < 6) zeilen.push(`${datei}:${i + 1}  tel:${m[1]}`);
      }
    });
  }
  abschnitt('Telefonverweise ohne Nummer', zeilen,
    'Ein tel:-Verweis ohne Nummer führt beim Antippen ins Leere.');
}

/* ---------- Strukturierte Daten: was bewusst fehlt ---------- */
{
  const org = JSON.parse(read('src/partials/schema.json'))
    .find((n) => n['@type'] === 'Organization') ?? {};
  const fehlend = ['address', 'telephone', 'legalName']
    .filter((k) => !(k in org))
    .map((k) => `Organization.${k}`);
  abschnitt('Strukturierte Daten, absichtlich fehlende Angaben', fehlend,
    'Bewusst weggelassen – lieber nichts als falsch. Nach dem Ergänzen der '
    + 'Platzhalter in src/partials/schema.json nachtragen.');
}

/* ---------- Alter der Sitemap ---------- */
{
  const daten = [...read('sitemap.xml').matchAll(/<lastmod>([\d-]+)<\/lastmod>/g)].map((m) => m[1]);
  const aeltestes = daten.sort()[0];
  const tage = Math.round((Date.now() - Date.parse(aeltestes)) / 86400000);
  if (tage > 90)
    abschnitt('sitemap.xml', [`ältestes lastmod: ${aeltestes} (${tage} Tage alt)`],
      'Von Hand gepflegt – nach inhaltlichen Änderungen mitziehen.');
}

/* ---------- Was nur ein Mensch prüfen kann ---------- */
console.log(`
Nicht maschinell prüfbar – siehe README, „Vor dem Livegang":
  · NIS2-Angaben (Schwellenwerte, 24-Stunden-Frist, Pflichten der Leitung)
    gegen den Gesetzestext des NIS2UmsuCG prüfen.
  · Auftragsverarbeitung nach Art. 28 DSGVO mit dem Formularanbieter.
  · Drittlandgrundlage nach Art. 44 ff. DSGVO benennen und in Abschnitt 5 der
    Datenschutzerklärung eintragen.
  · Löschfrist für die Formulardaten festlegen.
  · Impressum und Datenschutzerklärung anwaltlich prüfen lassen.
  · In Netlify unter Forms → Form notifications eine Benachrichtigung
    einrichten, sonst erfährt niemand von einer Einsendung.`);

console.log(`\n=== ${offen === 0 ? 'Maschinell prüfbare Punkte: alle erledigt.'
  : `Offen: ${offen} maschinell prüfbare Punkte.`} ===`);
process.exitCode = offen === 0 ? 0 : 1;
