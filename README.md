# Kr3is

Statische Website (deutsch) für **Kr3is** (kr3is.com) mit den Schwerpunkten
Informationssicherheit, KI-Automatisierung und IT-Betrieb für den Mittelstand.

## Dateien

Bearbeitet wird **`src/`**. Die Dateien im Wurzelverzeichnis werden von
`build.mjs` erzeugt und sind eingecheckt, damit die Seite auch ohne Build läuft.

```
src/
  css/          nach Dateinamen sortiert gebündelt – die Reihenfolge zählt
    01-tokens.css        Farben, Maße, Radien (hell und dunkel)
    02-base.css          Reset, Typografie, Layout, Reveal beim Scrollen
    03-header.css        Fortschrittsbalken, Kopfzeile, mobiles Menü
    04-hero.css          Hero, Buttons, Standards-Leiste
    05-cards.css         Kacheln, Bento-Raster, Schwerpunkt-Felder
    06-sections.css      Ausgangslagen, NIS2, FAQ, Zeitstrahl, Kontakt, Fußzeile
    07-forms.css         Formular und Bestätigungsseite
    08-legal.css         Rechtstexte, Unterseiten-Kopf
    09-preferences.css   prefers-reduced-*, Druck – muss zuletzt stehen
  js/app.js
  partials/     Bausteine, die auf jeder Seite gleich sind
    _shell.html   Grundgerüst mit head, body und Platzhaltern
    header.html   Kopfzeile samt Navigation
    footer.html   Fußzeile
    sprite.html   alle SVG-Icons
  pages/        je Seite nur der Inhalt, mit JSON-Kopf für Titel und Pfad

build.mjs       Build ohne jede Abhängigkeit
tools/          Prüfsuite (eigene package.json, damit der Netlify-Build
                keine Abhängigkeiten installiert)

Erzeugt (nicht direkt bearbeiten):
  index.html, it-sicherheit.html, betroffenheit.html, danke.html,
  impressum.html, datenschutz.html, 404.html
  assets/site.css, assets/site.js
```

### Bauen

```
node build.mjs
```

Kein npm, keine Abhängigkeiten, kein Watcher. Netlify führt den Befehl laut
`netlify.toml` bei jedem Deploy selbst aus.

**Warum ein Build?** Kopfzeile, Fußzeile und Icons lagen vorher in jeder Seite
erneut – ein neuer Navigationspunkt bedeutete acht Änderungen an vier Dateien.
Jetzt steht jeder Baustein genau einmal. Die gebündelten `site.css` und
`site.js` sorgen dafür, dass die feine Aufteilung im Quellcode den Besucher
trotzdem nur eine Anfrage kostet.

### Prüfen

```
cd tools
npm install
npx playwright install chromium
npm run check
```

Die Suite startet einen lokalen Server, öffnet jede Seite in Chromium und prüft
fünf Dinge: Auslieferung ohne fehlgeschlagene Anfragen oder Konsolenfehler,
kein horizontaler Überlauf über zehn Breiten in beiden Farbschemata,
Layout-Plausibilität, Textkontraste gegen WCAG AA und das Verhalten des
Formulars. Ist bereits ein Chromium vorhanden, genügt
`CHROMIUM_PATH=/pfad/zu/chrome npm run check`.

Die Layout-Plausibilität prüft, ob die `h1` hinter der Kopfzeile verschwindet,
ob es genau eine `h1` gibt, ob Überschriftenebenen übersprungen werden und wie
lang die längste Textzeile wird. Dieser Teil existiert, weil die übrigen
Prüfungen eine Seite durchwinken, die lediglich falsch gestaltet ist: Als das
Layout der Rechtstexte einmal verlorenging, meldete keine von ihnen etwas.

### Seitensyntax

Jede Datei in `src/pages/` beginnt mit einem JSON-Kopf und enthält danach nur
den Inhalt zwischen `<main>` und `</main>`:

```html
<!--{
  "title": "…",
  "description": "…",
  "path": "beispiel.html",
  "home": "index.html",
  "navPrefix": "index.html",
  "bodyClass": "plain"
}-->

<section> … </section>
```

In Bausteinen und Seiten stehen `<!-- include: name -->` für einen Baustein aus
`src/partials/` und `{{name}}` für einen Wert aus dem JSON-Kopf. Fehlt ein
Baustein oder eine Variable, bricht der Build mit einer klaren Meldung ab,
statt eine kaputte Seite zu erzeugen.

Bewusst **nicht** ausgelagert:

- Das Skript gegen das Farb-Aufblitzen bleibt inline im `<head>` – ausgelagert
  würde die Seite erst in der falschen Farbe erscheinen.
- Die SVG-Icon-Sammlung bleibt inline. Als externe Datei referenziert (`<use
  href="icons.svg#…">`) funktioniert sie nicht mehr über `file://` und ist auch
  sonst empfindlich; verschwindende Icons sind das Risiko nicht wert.
- Die strukturierten Daten (JSON-LD) bleiben inline, weil Suchmaschinen sie sonst
  nicht zuverlässig auslesen.

## Aufbau der Startseite

Die Startseite führt **zwei gleichrangige Schwerpunkte**:

1. **IT-Sicherheit** – ein Feld, das die sechs Leistungsbereiche nur benennt und
   auf `it-sicherheit.html` verweist. Die ausführlichen Karten liegen dort.
2. **Sichere KI-Automatisierung** – ein Feld gleicher Bauart, das in den
   ausführlichen Abschnitt weiter unten auf derselben Seite führt.

Beide nutzen dieselbe Komponente (`.card.feature` im Container `.focus`), damit
kein Thema optisch dominiert. Wer einen dritten Schwerpunkt ergänzen will, fügt
einfach ein weiteres `.card.feature` in `.focus` ein.

Abschnitte der Startseite: Hero, Typische Ausgangslagen, Zwei Schwerpunkte,
NIS2-Betroffenheit, KI-Automatisierung, Vorgehen, Über uns, Häufige Fragen,
Kontakt.

Es entstehen **keine Anfragen an Dritte** – keine Webfonts, kein CDN, kein
Tracking. Das vereinfacht die Datenschutzerklärung erheblich.

Netlify liefert das gesamte Verzeichnis aus, `src/` und `tools/` also mit. Beide
sind über `robots.txt` und einen `X-Robots-Tag`-Kopf aus dem Index genommen,
damit daraus keine doppelten Inhalte entstehen.

## Vorschau

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Ein Webserver ist nötig, weil die Seiten auf
`assets/` verweisen. Nach Änderungen in `src/` vorher `node build.mjs` ausführen.

Das Formular lässt sich lokal nur ansehen, nicht absenden – die Annahme
übernimmt Netlify erst nach dem Deploy.

## Gestaltung

In Anlehnung an Apple: große, eng laufende Überschriften, zentrierte
Abschnittseinleitungen bei linksbündigem Fließtext, rahmenlose Kacheln auf
`#f5f5f7`, Buttons in Pillenform, viel Weißraum, zurückhaltende Bewegung.

- **Hero** – schwarze Bühne mit Aurora-Verlauf und radial ausmaskiertem Raster,
  beide schwach dosiert, damit die Typografie trägt. Die Kopfzeile liegt
  transparent darüber und färbt sich beim Scrollen ein (Scroll-Timeline über
  `@property`-registrierte Custom Properties, damit die Farben interpolieren).
- **Reveal beim Scrollen** – native CSS Scroll-Driven Animations
  (`animation-timeline: view()`), gestaffelt über `animation-range`.
- **Bento-Raster** auf `it-sicherheit.html` für die sechs Leistungskarten.
- **Zeitstrahl** im Vorgehen – die Linie baut sich beim Scrollen auf, horizontal
  ab 900 px, darunter vertikal.
- **Helles und dunkles Schema**, folgt der Systemeinstellung, manuell
  umschaltbar, in `localStorage` gemerkt.

Zwei Entscheidungen zur Laufzeit, die man beim Ändern kennen sollte:

- Das Einblenden im Hero ist bewusst kurz (0,45 s, Staffelung bis 0,3 s). Die
  Überschrift ist das größte Element im ersten Bild; eine lange Einblendung
  verzögert direkt, wann sie sichtbar wird. Vorher dauerte das über eine
  Sekunde auf einer Seite, die nach 0,23 s fertig geladen ist.
- Aurora und Pulspunkt werden per `IntersectionObserver` angehalten, sobald ihr
  Abschnitt aus dem Bild ist. Sonst laufen sie über die gesamte Seitenlänge
  weiter und kosten dauerhaft Rechenzeit.

### Barrierefreiheit und Fallbacks

- Bewegung liegt hinter `prefers-reduced-motion`, Glaseffekte hinter
  `prefers-reduced-transparency`.
- Scroll-Animationen stehen in `@supports`; ohne Unterstützung greift ein
  IntersectionObserver-Fallback, ohne JavaScript ist alles sofort sichtbar.
- Sprunglink, sichtbare Fokusringe, `aria-expanded` am mobilen Menü, `Esc`
  schließt und gibt den Fokus an die Schaltfläche zurück.
- Bei offenem mobilem Menü wird alles außer der Kopfzeile per `inert`
  stillgelegt. Ohne das wandert der Fokus hinter die Überlagerung – sichtbar ist
  dann nichts, der Fokus aber weg.
- Textkontraste erfüllen WCAG AA in beiden Schemata. Geprüft wird über alle
  Seiten; der niedrigste gemessene Wert liegt bei 4,66:1.
- Genau eine `h1` je Seite, keine Sprünge in der Überschriftenebene. Auf
  `it-sicherheit.html` sorgt dafür eine nur für Screenreader sichtbare `h2`.

## Formular zur Betroffenheitsprüfung

`betroffenheit.html` sammelt die Angaben, die für eine NIS2-Einordnung zählen:
Sektor, Größenklasse, Umsatzklasse und Konzernzugehörigkeit, dazu Anlass, Stand
eines Managementsystems, Art der IT-Betreuung und Zeitrahmen sowie die
Kontaktdaten. Alles außer Unternehmen, Sektor, Beschäftigtenzahl, Name, E-Mail
und Einwilligung ist freiwillig.

Die Annahme läuft über **Netlify Forms**: `data-netlify="true"` aktiviert das
Formular beim Deploy, das versteckte Feld `form-name` ordnet die Einsendung zu,
`netlify-honeypot` benennt die unsichtbare Falle gegen automatisierte
Einsendungen. Nach dem Absenden leitet Netlify auf `danke.html`.

Damit Einsendungen tatsächlich ankommen, muss im Netlify-Projekt unter
**Forms → Form notifications** eine E-Mail-Benachrichtigung eingerichtet werden.
Ohne diesen Schritt landen die Daten nur im Netlify-Dashboard und niemand
erfährt davon.

## Vor dem Livegang

### 1. NIS2-Angaben prüfen

Der Abschnitt „NIS2“ nennt Schwellenwerte (50 Beschäftigte bzw. 10 Mio. €
Umsatz), die 24-Stunden-Frühwarnung und die Pflichten der Geschäftsleitung.
Diese Angaben stammen aus Sekundärquellen und sind **gegen den Gesetzestext des
NIS2UmsuCG zu prüfen**. Für ein Unternehmen, dessen Produkt regulatorische
Genauigkeit ist, wäre eine falsche Zahl hier besonders schädlich. Konkrete
Fristdaten wurden bewusst weggelassen, weil sie sich verschieben können.

### 2. Formular datenschutzrechtlich absichern

Das Formular verarbeitet personenbezogene Daten über einen Dienstleister. Vor
dem Livegang sind daher zwingend zu klären:

- **Auftragsverarbeitung** nach Art. 28 DSGVO mit dem Formularanbieter.
- **Drittlandübermittlung**: Netlify ist ein US-Unternehmen. Die Grundlage nach
  Art. 44 ff. DSGVO – Angemessenheitsbeschluss, Standardvertragsklauseln oder
  eine andere Garantie – muss benannt und in Abschnitt 5 der
  Datenschutzerklärung eingetragen werden. Dort steht dafür ein markierter
  Platzhalter.
- **Löschfrist** für die Formulardaten festlegen und eintragen.

Für ein Unternehmen, das Datensouveränität verkauft, ist dieser Punkt kein
Formalismus, sondern Teil der Glaubwürdigkeit. Wer die Drittlandfrage vermeiden
will, kann die Annahme auf einen Anbieter mit EU-Verarbeitung umstellen – am
Formular selbst ändert das nur das Attribut.

### 3. Rechtstexte

`impressum.html` und `datenschutz.html` sind **Gerüste, keine fertigen
Rechtstexte**. Beide enthalten oben einen Hinweiskasten, der vor der
Veröffentlichung zu entfernen ist. Die Datenschutzerklärung beschreibt die Seite
so, wie sie gebaut ist – statisch, ohne Formulare, Cookies oder Drittinhalte.
Sobald ein Kontaktformular, eine Terminbuchung oder Analysesoftware dazukommt,
muss sie erweitert werden. Beides anwaltlich prüfen lassen.

### 4. Offene Platzhalter

Alle in eckigen Klammern:

- `[Rechtsform]` in der Fußzeile – steht nur noch einmal in `src/partials/footer.html`
- `[Vorname Nachname]` sowie die Initialen `VN` in den Profil-Kacheln
- `[+49 ___ _______]` – auch der `tel:`-Link steht noch auf `tel:+49`,
  auf der Startseite wie auf `it-sicherheit.html`
- `[Straße Hausnummer]`, `[PLZ Ort]`
- im Impressum zusätzlich Registergericht, Registernummer, USt-IdNr.,
  Berufshaftpflicht
- in der Datenschutzerklärung Hosting-Anbieter, Formularanbieter samt
  Drittlandgrundlage, Löschfristen, zuständige Aufsichtsbehörde, Stand-Datum

Anschrift, Telefon und Rechtsform fehlen bewusst auch in den strukturierten
Daten (JSON-LD) – lieber weglassen als falsch auszeichnen. Nach dem Ergänzen
dort nachtragen.

### 5. Sonstiges

- Die Leiste „Unsere Arbeit orientiert sich an“ nennt Regelwerke, an denen sich
  die Arbeit ausrichtet – das ist **keine Zertifizierungsaussage**. Prüfen, ob
  die Auswahl zum tatsächlichen Leistungsbild passt.
- Die Seiten verlinken auf `impressum.html` und `datenschutz.html`, damit sie auf
  jedem Hoster funktionieren. Wer saubere URLs ohne Endung möchte, kann die
  Verweise und die `<link rel="canonical">` entsprechend anpassen.
- `og.png` wurde aus `index.html` abgeleitet. Nach einer Änderung der Kernaussage
  neu erzeugen.
