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
    schema.json   JSON-LD-Knoten, die auf jeder Seite gelten
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
node build.mjs            baut
node build.mjs --check    baut nichts, meldet nur Abweichungen
```

Kein npm, keine Abhängigkeiten, kein Watcher. Netlify führt den Befehl laut
`netlify.toml` bei jedem Deploy selbst aus.

`--check` schreibt nichts und endet mit Exitcode 1, sobald eine erzeugte Datei
nicht mehr zum Quellstand passt. Das ist nötig, weil die erzeugten Dateien
eingecheckt sind: Wer `src/` ändert und den Build vergisst, hinterlässt sie
veraltet – und die Prüfsuite prüfte dann einen Stand, den niemand mehr
bearbeitet. Sie ruft `--check` deshalb selbst auf.

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

Die Suite startet einen lokalen Server und öffnet jede Seite in Chromium. Der
Server liefert dabei dieselben Kopfzeilen aus wie Netlify – die
Content-Security-Policy wird aus `netlify.toml` gelesen, damit auffällt, was sie
blockiert. Ist bereits ein Chromium vorhanden, genügt
`CHROMIUM_PATH=/pfad/zu/chrome npm run check`.

Geprüft wird:

1. **Auslieferung** – keine fehlgeschlagenen Anfragen, keine Konsolenfehler
2. **Layout** – kein horizontaler Überlauf über zehn Breiten, beide Schemata
3. **Plausibilität** – `h1` nicht hinter der Kopfzeile, genau eine `h1`, keine
   Sprünge in der Überschriftenebene, Zeilenlänge
4. **Kontrast** – jeder sichtbare Textknoten gegen WCAG AA, beide Schemata
5. **Trefferflächen** – Bedienelemente gegen die 24 px aus WCAG 2.2 (2.5.8)
6. **Zeigerbewegung** – keine Skriptfehler, Drossel greift
7. **Formular** – Netlify-Merkmale, Pflichtfelder, Labels, Honigtopf
8. **Auszeichnung** – JSON-LD gültig, jede `@id`-Verweisung löst auf
9. **Auslieferbares** – CSP-Hash passt zum Inline-Skript, Sitemap vollständig
10. **Ohne Skript** – kein Bedienelement, das ohne JavaScript nichts tut; jede
    Seite kommt vollständig an
11. **Build** – die erzeugten Dateien sind auf dem Stand von `src/`
12. **Totes CSS** – keine Regel für eine Klasse, die es nicht gibt

Punkt 3 gibt es, weil die übrigen Prüfungen eine Seite durchwinken, die
lediglich falsch gestaltet ist: Als das Layout der Rechtstexte einmal
verlorenging, meldete keine von ihnen etwas.

Punkt 4 misst aus demselben Grund **jeden** Textknoten statt einer Handvoll
ausgewählter Paare. Die frühere Auswahl enthielt keinen einzigen Button – und
genau die verfehlten AA. Was hinter einem Text liegt, verrät der Elternbaum
dabei nicht zuverlässig: Die Kopfzeile ist durchsichtig und schwebt über dem
dunklen Hero, im Baum steht über ihr aber der weiße `body`. Gemessen wird
deshalb der Stapel aus `elementsFromPoint` am Rechteck der Glyphen selbst, von
oben bis zur ersten deckenden Fläche. Liegt darin ein Verlauf, ist die Farbe
nicht eindeutig; solche Knoten werden gezählt und übergangen, statt einen
erfundenen Wert zu melden.

Punkt 6 gibt es, weil die übrigen Prüfungen nie einen Zeiger bewegen. Der
Lichtkegel auf den Kacheln hing an einer Drossel, deren Wächterabfrage nie
zutraf: Jede Bewegung meldete ein eigenes Bild an, und wer im selben Bild als
Zweiter drankam, las eine bereits geleerte Ablage. Zwanzig Ereignisse
erzeugten zwanzig Bilder und neunzehn Skriptfehler – sichtbar war davon nichts.

Punkt 12 gibt es, weil totes CSS niemandem auffällt: Die Seite sieht richtig
aus, das Stylesheet wächst still weiter. Gefunden wurden so `.num`, `.split`
und `.d5` – Reste entfernter Bausteine. Eine Ausnahmeliste gibt es bewusst
nicht: Wer eine Klasse auf Vorrat anlegt, soll sie benutzen oder weglassen.

### Startbereitschaft

```
node tools/launch.mjs
```

Sammelt, was vor dem Livegang noch offen ist – Platzhalter, Redaktionshinweise
in den Rechtstexten, unvollständige `tel:`-Verweise, absichtliche Lücken in den
strukturierten Daten – und liest das aus den Dateien statt aus dieser Liste.
Eine Liste im README veraltet, sobald jemand einen Platzhalter ersetzt und das
Nachtragen vergisst.

Bewusst **kein** Teil von `npm run check`: Diese Punkte sind vor dem Livegang
richtig so und dürfen die laufende Prüfung nicht rot färben. Der Exitcode ist
trotzdem 1, solange etwas offen ist – damit taugt der Bericht als letzte Sperre
vor der Veröffentlichung. Der Abschnitt „Vor dem Livegang" weiter unten nennt
zusätzlich, was nur ein Mensch prüfen kann.

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

Der Schlüssel `schema` ist keine Variable, sondern eine **Liste von
JSON-LD-Knoten**. `build.mjs` verbindet sie mit den Knoten aus
`src/partials/schema.json` zu einem `@graph` und setzt ihn als `{{schema}}` ein.
So steht die Auszeichnung lesbar im Quelltext statt als escapte Zeichenkette.

Bewusst **nicht** ausgelagert:

- Das Skript gegen das Farb-Aufblitzen bleibt inline im `<head>` – ausgelagert
  würde die Seite erst in der falschen Farbe erscheinen.
- Die SVG-Icon-Sammlung bleibt inline. Als externe Datei referenziert (`<use
  href="icons.svg#…">`) funktioniert sie nicht mehr über `file://` und ist auch
  sonst empfindlich; verschwindende Icons sind das Risiko nicht wert.
- Die strukturierten Daten (JSON-LD) bleiben inline, weil Suchmaschinen sie sonst
  nicht zuverlässig auslesen. Sie stehen je Seite in **genau einem** `@graph`:
  Die seitenübergreifenden Knoten liegen in `src/partials/schema.json`, die
  seitenspezifischen im Schlüssel `schema` des JSON-Kopfs, und `build.mjs` fügt
  beides zusammen. Ein Graph je Seite ist nötig, damit Verweise über `@id`
  aufgehen – der `Service` auf `it-sicherheit.html` nannte einmal einen
  Anbieter, den keine Seite definierte: gültiges JSON, das ins Leere zeigte.

## Aufbau der Startseite

Die Startseite führt **zwei gleichrangige Schwerpunkte**:

1. **IT-Sicherheit** – ein Feld, das die sechs Leistungsbereiche nur benennt und
   auf `it-sicherheit.html` verweist. Die ausführlichen Karten liegen dort.
2. **Sichere KI-Automatisierung** – ein Feld gleicher Bauart, das in den
   ausführlichen Abschnitt weiter unten auf derselben Seite führt.

Beide nutzen dieselbe Komponente (`.card.feature` im Container `.focus`), damit
kein Thema optisch dominiert, und beide führen unter derselben Beschriftung
weiter („Mehr dazu“). Wer einen dritten Schwerpunkt ergänzen will, fügt einfach
ein weiteres `.card.feature` in `.focus` ein.

**Ungleich bleibt das Ziel:** IT-Sicherheit führt auf eine eigene Seite, KI-Auto-
matisierung nur auf einen Abschnitt derselben Seite. Eine eigene Unterseite für
die KI-Automatisierung gibt es noch nicht – solange das so ist, verspricht die
gleiche Beschriftung zwei verschiedene Tiefen.

Abschnitte der Startseite: Hero, Typische Ausgangslagen, Zwei Schwerpunkte,
NIS2-Betroffenheit, KI-Automatisierung, Vorgehen, Über uns, Häufige Fragen,
Kontakt.

Es entstehen **keine Anfragen an Dritte** – keine Webfonts, kein CDN, kein
Tracking. Das vereinfacht die Datenschutzerklärung erheblich.

Die Content-Security-Policy in `netlify.toml` kommt deshalb ohne
`'unsafe-inline'` aus – bei einem Haus, das Informationssicherheit verkauft,
wäre die Freigabe in der eigenen Policy ein unnötiger Angriffspunkt. Zwei
Dinge halten das aufrecht und sind beim Ändern zu beachten:

- Das Skript gegen das Farb-Aufblitzen ist auf allen Seiten byteidentisch und
  über genau **einen Hash** freigegeben. Ändert es sich, passt der Hash nicht
  mehr und der Browser blockiert es – die Seite erschiene kurz in der falschen
  Farbe. Die Prüfsuite vergleicht beides und schlägt vorher an.
- Es gibt **kein `style`-Attribut im Markup** und **kein zur Laufzeit erzeugtes
  `<style>`-Element**. Die Regeln für den Reveal-Rückfall stehen deshalb in
  `02-base.css`; das Skript setzt nur noch die Klasse. Was ein Skript über die
  CSSOM setzt (`element.style.setProperty`), bleibt erlaubt – der Lichtkegel
  auf den Kacheln funktioniert also weiter.

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
- **Schwerpunkt-Zeichen** über der Überschrift (`.triad`) – ein Ring aus drei
  Farbdritteln, eines je Schwerpunkt, zusammen der geschlossene Kreis. Es nimmt
  den Namen und das Zyklus-Zeichen der Kopfzeile auf und ersetzt die frühere
  Textzeile „IT-Sicherheit · KI-Automatisierung · Compliance“.
  Der Ring hat r=16, sein Umfang ist also 100,53; ein Drittel wären 33,51, der
  sichtbare Bogen ist mit 28 etwas kürzer, damit Lücken bleiben. Jedes Drittel
  wird allein über `stroke-dashoffset` gesetzt, nicht über eine Drehung – so
  braucht es weder `transform-box` noch `transform-origin` auf einem
  SVG-Element, und das Einzeichnen kann über `stroke-dasharray` laufen, ohne mit
  der Positionierung ins Gehege zu kommen. Der Ring ist `aria-hidden`, die drei
  Beschriftungen bleiben gewöhnlicher Text. Unter 560 px rückt das Zeichen über
  die Beschriftungen; nebeneinander drängte es sie auf zwei ungleiche Zeilen.
- **Reveal beim Scrollen** – native CSS Scroll-Driven Animations
  (`animation-timeline: view()`), gestaffelt über `animation-range`.
- **Bento-Raster** auf `it-sicherheit.html` für die sechs Leistungskarten.
- **Zeitstrahl** im Vorgehen – die Linie baut sich beim Scrollen auf, horizontal
  ab 900 px, darunter vertikal.
- **Helles und dunkles Schema**, folgt der Systemeinstellung, manuell
  umschaltbar, in `localStorage` gemerkt.
- **Blau in drei Stufen.** `--brand` (`#0064d2`) trägt weißen Text mit 5,59:1,
  `--brand-deep` (`#00509f`) als Hover-Stufe mit 7,93:1. `--brand-bright`
  (`#0a84ff`) käme nur auf 3,65:1 und bleibt deshalb Linien, Rahmen und
  Fokusringen vorbehalten – nie Grund für weißen Text. Die Buttons lagen
  vorher auf `--brand-bright` und erfüllten AA erst im Hover.

Zwei Entscheidungen zur Laufzeit, die man beim Ändern kennen sollte:

- Das Einblenden im Hero ist bewusst kurz (0,45 s, Staffelung bis 0,3 s). Die
  Überschrift ist das größte Element im ersten Bild; eine lange Einblendung
  verzögert direkt, wann sie sichtbar wird. Vorher dauerte das über eine
  Sekunde auf einer Seite, die nach 0,23 s fertig geladen ist.
- Die Aurora wird per `IntersectionObserver` angehalten, sobald ihr Abschnitt
  aus dem Bild ist. Sonst läuft sie über die gesamte Seitenlänge weiter und
  kostet dauerhaft Rechenzeit. Das Schwerpunkt-Zeichen braucht das nicht: Sein
  Bogen wird einmal gezeichnet und steht dann still.

### Druck

Rechtstexte werden ausgedruckt und abgeheftet, deshalb hat der Druckstil eigene
Regeln: Kopfzeile und Zierelemente entfallen, dunkle Flächen werden weiß, und
Links im Inhalt bekommen ihre Adresse in Klammern nachgestellt – auf Papier ist
ein Verweis sonst wertlos. Interne Verweise sind relativ notiert; ihnen wird
die Herkunft vorangestellt, weil „impressum.html“ auf Papier niemandem hilft.
`mailto:` und `tel:` bleiben ausgenommen, ihre Adresse steht bereits im Text. Umbrüche innerhalb von Kacheln, Schritten und
Hinweiskästen sind unterbunden.

### Sprache

- **NIS2** wird durchgängig beim Namen genannt, nicht als „die Richtlinie“
  bezeichnet. NIS2 ist zwar eine EU-Richtlinie, binden tut deutsche Unternehmen
  aber das nationale Umsetzungsgesetz – die verkürzte Formulierung wäre für ein
  Haus, das Regulatorik verkauft, angreifbar.
- „ISO 27001“ steht allein, „ISO-27001-Nachweis“ als Kompositum mit
  Bindestrichen. In der Standards-Leiste steht die formale Bezeichnung
  „ISO/IEC 27001“.
- Maßangaben wie `10&nbsp;Mio.&nbsp;€` und `24&nbsp;Stunden` enthalten
  geschützte Leerzeichen, damit sie nicht über Zeilen zerrissen werden.

### Barrierefreiheit und Fallbacks

- Bewegung liegt hinter `prefers-reduced-motion`, Glaseffekte hinter
  `prefers-reduced-transparency`.
- Scroll-Animationen stehen in `@supports`; ohne Unterstützung greift ein
  IntersectionObserver-Fallback. Ohne JavaScript trägt die Seite trotzdem: Das
  Reveal läuft über `animation-timeline: view()` und damit rein über CSS, die
  Kopfzeile hat eine `@supports not`-Stufe, und alle Inhalte sind erreichbar.
- Das mobile Menü ist die **eine** Ausnahme – es bedient app.js. Das Skript im
  `<head>` setzt deshalb `data-js` auf `<html>`, und das Stylesheet zeigt die
  Menü-Schaltfläche nur, wenn diese Markierung da ist. Ohne Skript stünde dort
  sonst eine Schaltfläche, die nichts tut; erreichbar bleiben die Inhalte über
  Logo, die Sprungmarken der Seite und die Fußzeile. Wird das Inline-Skript
  geändert, ändert sich sein CSP-Hash – siehe unten.
- Sprunglink, sichtbare Fokusringe, `aria-expanded` am mobilen Menü, `Esc`
  schließt und gibt den Fokus an die Schaltfläche zurück.
- Bei offenem mobilem Menü wird alles außer der Kopfzeile per `inert`
  stillgelegt. Ohne das wandert der Fokus hinter die Überlagerung – sichtbar ist
  dann nichts, der Fokus aber weg.
- Textkontraste erfüllen WCAG AA in beiden Schemata. Geprüft wird jeder
  sichtbare Textknoten über alle Seiten – rund 700 je Durchlauf.
- Bedienelemente, die nicht im Fließtext stehen, erfüllen die 24 px aus
  WCAG 2.2 (2.5.8). Die Fußzeilenlinks kamen auf 22 px und haben dafür einen
  Innenabstand bekommen, der die Zeile optisch unverändert lässt.
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

Der Abschnitt „NIS2“ nennt Schwellenwerte, die 24-Stunden-Frühwarnung und die
Pflichten der Geschäftsleitung. Diese Angaben stammen aus Sekundärquellen und
sind **gegen den Gesetzestext zu prüfen** – maßgeblich ist § 28 BSIG in der
Fassung des NIS2UmsuCG. Für ein Unternehmen, dessen Produkt regulatorische
Genauigkeit ist, wäre eine falsche Zahl hier besonders schädlich. Konkrete
Fristdaten wurden bewusst weggelassen, weil sie sich verschieben können.

**Eine Angabe war bereits zu weit gefasst und wurde berichtigt.** Der Text
fragte nach „mindestens 50 Beschäftigte **oder** mehr als zehn Millionen Euro
Jahresumsatz“. Die Finanzkennzahlen sind jedoch **kumulativ**: Unterhalb von 50
Beschäftigten greift das Größenkriterium nur, wenn Jahresumsatz **und**
Jahresbilanzsumme jeweils über 10 Mio. € liegen. Grundlage ist die
KMU-Definition der Empfehlung 2003/361/EG, auf die NIS2 verweist – ein
Unternehmen mit 12 Mio. € Umsatz und 8 Mio. € Bilanzsumme bleibt danach ein
kleines Unternehmen. Die alte Fassung hätte solche Unternehmen fälschlich als
betroffen ausgewiesen.

Aus demselben Grund fragt `betroffenheit.html` jetzt auch die
**Jahresbilanzsumme** ab. Ohne sie ließ sich aus einer Einsendung gar nicht
ablesen, ob die Schwelle erreicht ist.

Die Sektorenliste im Abschnitt nennt außerdem nicht mehr „Logistik“ – das ist
keine Bezeichnung aus den Anlagen; an ihrer Stelle stehen jetzt „Post- und
Kurierdienste“, passend zur Auswahlliste im Formular.

Die Korrektur beruht auf drei übereinstimmenden Sekundärquellen, **nicht auf
dem Gesetzestext selbst** – Gesetzestext und KMU-Empfehlung waren aus der
Arbeitsumgebung nicht erreichbar. Sie ersetzt die anwaltliche Prüfung also
nicht, engt die Aussage aber in die sichere Richtung ein.

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
Daten (JSON-LD) – lieber weglassen als falsch auszeichnen. Nach dem Ergänzen in
`src/partials/schema.json` am Knoten `Organization` nachtragen.

### 5. Sonstiges

- Die Leiste „Unsere Arbeit orientiert sich an“ nennt Regelwerke, an denen sich
  die Arbeit ausrichtet – das ist **keine Zertifizierungsaussage**. Prüfen, ob
  die Auswahl zum tatsächlichen Leistungsbild passt.
- Die Seiten verlinken auf `impressum.html` und `datenschutz.html`, damit sie auf
  jedem Hoster funktionieren. Wer saubere URLs ohne Endung möchte, kann die
  Verweise und die `<link rel="canonical">` entsprechend anpassen.
- `og.png` wurde aus `index.html` abgeleitet. Nach einer Änderung der Kernaussage
  neu erzeugen.
