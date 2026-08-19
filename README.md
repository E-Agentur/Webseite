# Kr3is

Statische Website (deutsch) für **Kr3is** (kr3is.com) mit den Schwerpunkten
Informationssicherheit, KI-Automatisierung und IT-Betrieb für den Mittelstand.

## Dateien

```
index.html          Startseite
it-sicherheit.html  Unterseite: die sechs Sicherheitsleistungen im Detail
impressum.html      Pflichtseite (Gerüst)
datenschutz.html    Pflichtseite (Gerüst)
assets/
  base.css          Design-Tokens, Reset, Typografie, Layout, Reveal-Utility
  components.css    Kopfzeile, Hero, Kacheln, Abschnitte, Fußzeile, Rechtstexte
  app.js            Farbschema-Umschalter, mobiles Menü, Lichtkegel, Reveal-Fallback
og.png              Vorschaubild fürs Teilen (1200 × 630)
robots.txt
sitemap.xml
```

`components.css` wird **nach** `base.css` geladen; der Block „Nutzerpräferenzen“
steht bewusst ganz am Ende, damit seine Überschreibungen in der Kaskade gewinnen.

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

## Vorschau

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Ein Webserver ist nötig, weil die Seite auf
`assets/` verweist.

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

### Barrierefreiheit und Fallbacks

- Bewegung liegt hinter `prefers-reduced-motion`, Glaseffekte hinter
  `prefers-reduced-transparency`.
- Scroll-Animationen stehen in `@supports`; ohne Unterstützung greift ein
  IntersectionObserver-Fallback, ohne JavaScript ist alles sofort sichtbar.
- Sprunglink, sichtbare Fokusringe, `aria-expanded` am mobilen Menü, `Esc`
  schließt.
- Textkontraste erfüllen WCAG AA in beiden Schemata. Geprüft wird über alle
  vier Seiten; der niedrigste gemessene Wert liegt bei 4,66:1.

## Vor dem Livegang

### 1. NIS2-Angaben prüfen

Der Abschnitt „NIS2“ nennt Schwellenwerte (50 Beschäftigte bzw. 10 Mio. €
Umsatz), die 24-Stunden-Frühwarnung und die Pflichten der Geschäftsleitung.
Diese Angaben stammen aus Sekundärquellen und sind **gegen den Gesetzestext des
NIS2UmsuCG zu prüfen**. Für ein Unternehmen, dessen Produkt regulatorische
Genauigkeit ist, wäre eine falsche Zahl hier besonders schädlich. Konkrete
Fristdaten wurden bewusst weggelassen, weil sie sich verschieben können.

### 2. Rechtstexte

`impressum.html` und `datenschutz.html` sind **Gerüste, keine fertigen
Rechtstexte**. Beide enthalten oben einen Hinweiskasten, der vor der
Veröffentlichung zu entfernen ist. Die Datenschutzerklärung beschreibt die Seite
so, wie sie gebaut ist – statisch, ohne Formulare, Cookies oder Drittinhalte.
Sobald ein Kontaktformular, eine Terminbuchung oder Analysesoftware dazukommt,
muss sie erweitert werden. Beides anwaltlich prüfen lassen.

### 3. Offene Platzhalter

Alle in eckigen Klammern:

- `[Rechtsform]` in den Fußzeilen aller vier Seiten
- `[Vorname Nachname]` sowie die Initialen `VN` in den Profil-Kacheln
- `[+49 ___ _______]` – auch der `tel:`-Link steht noch auf `tel:+49`,
  auf der Startseite wie auf `it-sicherheit.html`
- `[Straße Hausnummer]`, `[PLZ Ort]`
- im Impressum zusätzlich Registergericht, Registernummer, USt-IdNr.,
  Berufshaftpflicht
- in der Datenschutzerklärung Hosting-Anbieter, Löschfrist der Logdateien,
  zuständige Aufsichtsbehörde, Stand-Datum

Anschrift, Telefon und Rechtsform fehlen bewusst auch in den strukturierten
Daten (JSON-LD) – lieber weglassen als falsch auszeichnen. Nach dem Ergänzen
dort nachtragen.

### 4. Sonstiges

- Die Leiste „Unsere Arbeit orientiert sich an“ nennt Regelwerke, an denen sich
  die Arbeit ausrichtet – das ist **keine Zertifizierungsaussage**. Prüfen, ob
  die Auswahl zum tatsächlichen Leistungsbild passt.
- Die Seiten verlinken auf `impressum.html` und `datenschutz.html`, damit sie auf
  jedem Hoster funktionieren. Wer saubere URLs ohne Endung möchte, kann die
  Verweise und die `<link rel="canonical">` entsprechend anpassen.
- `og.png` wurde aus `index.html` abgeleitet. Nach einer Änderung der Kernaussage
  neu erzeugen.
