# ADR 0008: Material Design und dynamische Farben

> **Zielgruppe:** Designsystem- und Frontend-Entwickler.
> **Zweck und Lernziel:** Visuelle Grammatik und lokale Farbquellen begründen.
> **Voraussetzungen:** [Appearance und Designsystem](../architektur/appearance-und-designsystem.md)
> **Kanonisch für:** Begründung von MD3-Rollen, dynamischen Tokens und lokaler Bildanalyse.
> **Verwandte Dokumente:** [Tests und Qualität](../architektur/tests-und-qualitaet.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

Die Finanzoberfläche braucht ruhige Konsistenz, adaptive Geräteformen und persönliche Farben, ohne Finanzsemantik oder Offline-Fähigkeit zu verlieren.

## Entscheidung

Gemeinsame Material-3-Expressive-Rollen, zentrale CSS-Tokens, stabile Finanzfarben und lokale Google Sans Flex werden verwendet. Farben kommen aus Browserhint, Presets oder bewusst lokal analysiertem Bild; ein komplettes Light-/Dark-Paar wird versioniert gespeichert.

## Begründung

Rollen statt screenlokaler Werte ermöglichen konsistente Themes, Accessibility und responsive Komposition. Lokale Bildanalyse wahrt die Upload-Grenze.

## Erwogene Alternativen

Festes Theme, serverseitiger Wallpaper-Upload, pro-Screen-CSS oder eine zweite Komponentenbibliothek.

## Konsequenzen

### Positiv

Personalisierung, Offline-Restore, klare Tokenverantwortung, stabile Finanzsemantik.

### Negativ

Kontrast-/Persistenztests, Worker-/IndexedDB-Komplexität und heuristische Palettenqualität.

## Implementierung und Tests

- Implementierung: [src/appearance](../../src/appearance), [src/design/tokens.css](../../src/design/tokens.css)
- Tests: [src/appearance](../../src/appearance), [tests/visual/finance-ui.spec.ts](../../tests/visual/finance-ui.spec.ts)
