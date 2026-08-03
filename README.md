# IT-Systemhaus

Statische Landingpage (deutsch) für ein IT-Systemhaus mit den Schwerpunkten
Informationssicherheit, KI-Automatisierung und IT-Betrieb für den Mittelstand.

## Aufbau

- `index.html` – vollständige Seite in einer Datei, ohne externe Abhängigkeiten:
  CSS inline, Icons als eingebettetes SVG-Sprite, System-Schriften, kein CDN
  und keine Webfonts. Es entstehen keinerlei Anfragen an Dritte, was die
  Datenschutzerklärung erheblich vereinfacht.
- Ein kleines Inline-Skript (~60 Zeilen) für Farbschema-Umschalter, mobiles
  Menü, Lichtkegel auf den Karten und den Reveal-Fallback. Die Seite ist ohne
  JavaScript vollständig lesbar und bedienbar.

Abschnitte: Hero, Leistungen, KI-Automatisierung, Vorgehen, Über uns, Kontakt.

## Visuelle Umsetzung

- **Hero** – dunkle Bühne mit Aurora-Verlauf (drei weich überblendete Farbfelder,
  sehr langsam driftend) und einem radial ausmaskierten Raster. Die Kopfzeile
  liegt transparent darüber.
- **Kopfzeile** – färbt sich beim Scrollen über eine Scroll-Timeline von
  transparent/hell auf Glas/dunkel um. Umgesetzt über registrierte Custom
  Properties (`@property`), damit die Farben interpolieren.
- **Reveal beim Scrollen** – native CSS Scroll-Driven Animations
  (`animation-timeline: view()`), gestaffelt über `animation-range`.
- **Bento-Raster** bei den Leistungen: sechs gleich große Karten, die
  KI-Automatisierung als hervorgehobene Karte über die volle Breite.
- **Zeitstrahl** im Abschnitt „Vorgehen“ – die farbige Linie baut sich beim
  Scrollen auf (horizontal ab 900 px, darunter vertikal) und läuft hinter dem
  letzten Schritt aus.
- **Karten** mit Lichtkegel, der dem Zeiger folgt, plus Anheben und
  Rahmenakzent beim Überfahren.
- **Helles und dunkles Farbschema**, folgt der Systemeinstellung und lässt sich
  manuell umschalten (in `localStorage` gemerkt, ohne Aufblitzen beim Laden).

### Barrierefreiheit und Fallbacks

- Alle Bewegung liegt hinter `prefers-reduced-motion`; bei reduzierter Bewegung
  ist die Seite statisch und vollständig sichtbar.
- `prefers-reduced-transparency` schaltet die Glaseffekte ab.
- Scroll-Animationen stehen in `@supports`-Blöcken. Browser ohne Unterstützung
  (~16 %) bekommen einen IntersectionObserver-Fallback, ohne JavaScript ist
  einfach alles sofort sichtbar.
- Sprunglink zum Inhalt, sichtbare Fokusringe, `aria-expanded` am mobilen Menü,
  Schließen per `Esc`.
- Textkontraste erfüllen WCAG AA (geprüft in beiden Farbschemata; der
  niedrigste Wert liegt bei 4,9:1).

## Vorschau

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

## Noch zu ersetzende Platzhalter

Alle Platzhalter stehen in eckigen Klammern:

- `[Firmenname]`, `[Firmen]name` (Logo), `[Rechtsform]`
- `[Vorname Nachname]` (technische und kaufmännische Leitung) sowie die
  Initialen `VN` in den beiden Profil-Kacheln
- `[kontakt@ihredomain.de]`, `[+49 ___ _______]` (auch im `tel:`-Link)
- `[Straße Hausnummer]`, `[PLZ Ort]`

Zusätzlich fehlen die verlinkten Rechtstexte unter `/impressum` und
`/datenschutz` – beide sind für einen gewerblichen Auftritt in Deutschland
verpflichtend.

Die Leiste „Unsere Arbeit orientiert sich an“ im Hero (NIS2, ISO/IEC 27001,
BSI IT-Grundschutz, DSGVO, EU AI Act) benennt bewusst nur die Regelwerke, an
denen sich die Arbeit ausrichtet – sie ist keine Zertifizierungsaussage. Vor
dem Livegang prüfen, ob die Auswahl zum tatsächlichen Leistungsbild passt.
