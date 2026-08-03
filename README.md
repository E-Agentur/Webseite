# IT-Systemhaus

Statische Landingpage (deutsch) für ein IT-Systemhaus mit den Schwerpunkten
Informationssicherheit, KI-Automatisierung und IT-Betrieb für den Mittelstand.

## Aufbau

- `index.html` – vollständige Seite, eine Datei ohne externe Abhängigkeiten
  (CSS inline, keine Skripte, keine Webfonts).

Abschnitte: Hero, Leistungen, KI-Automatisierung, Vorgehen, Über uns, Kontakt.

## Vorschau

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

## Noch zu ersetzende Platzhalter

Alle Platzhalter stehen in eckigen Klammern:

- `[Firmenname]`, `[Firmen]name` (Logo), `[Rechtsform]`
- `[Vorname Nachname]` (technische und kaufmännische Leitung)
- `[kontakt@ihredomain.de]`, `[+49 ___ _______]`
- `[Straße Hausnummer]`, `[PLZ Ort]`

Zusätzlich fehlen die verlinkten Rechtstexte unter `/impressum` und
`/datenschutz` – beide sind für einen gewerblichen Auftritt in Deutschland
verpflichtend.
