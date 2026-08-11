# Testen und Release

> **Zielgruppe:** Entwickler und Release-Verantwortliche.
> **Zweck und Lernziel:** Änderungen vollständig prüfen und eine private Produktion kontrolliert freigeben.
> **Voraussetzungen:** [Lokale Entwicklung](lokale-entwicklung.md); für reale Abnahme [Produktions-Setup](produktions-setup.md)
> **Kanonisch für:** Lokale Prüf- und Release-Reihenfolge.
> **Verwandte Dokumente:** [Tests und Qualität](../architektur/tests-und-qualitaet.md), [Fehlerdiagnose](fehlerdiagnose.md)

## Verbindliche automatische Abnahme

Vom Repository-Root aus:

```bash
npm run docs:check
npm test
npm run lint
npm run build
npm run test:visual
npm run smoke
```

`test:visual` und `smoke` starten beziehungsweise orchestrieren ihre benötigten lokalen Browserabläufe gemäß den Skripten. Sie benötigen installierte Playwright-Chromium-Binaries. Externe Links können zusätzlich diagnostiziert werden:

```bash
npm run docs:check:external
```

Der externe Check ist wegen Redirects, Rate-Limits und temporärer Netzausfälle nicht blockierend. Der interne Dokumentationscheck ist ebenfalls kein GitHub-CI-Gate, gehört aber zur Dokumentationsabnahme.

## Golden Screens aktualisieren

Nur bei beabsichtigter visueller Änderung:

```bash
npm run test:visual:update
npm run test:visual
```

Jedes geänderte Bild einzeln auf Layout, Texte, Theme, Fokuszustand und unerwartete Finanzdaten prüfen. Golden Screens nicht blind aktualisieren. Keine realen Finanzwerte aufnehmen.

## Manuelle Stichproben

- zentrale Überschriften- und Quellcode-Zeilenanker;
- alte Dokumentationspfade und alle fünf Lesepfade;
- Login, Picker, Sync, Tabellenwechsel und Schemaprobleme;
- Offline-Start mit und ohne vorherigen Cache;
- Logout versus Disconnect und anschließendes Wiederverbinden;
- Appearance-Entwurf, Anwenden, Abbrechen, Bildentfernung und OS-Moduswechsel;
- Privacy sichtbar und mit Screenreader-Ausgabe, einschließlich Tabsynchronisierung;
- Tastatur, Fokus, Reduced Motion, 320-Pixel-Reflow und Forced Colors.

## Release-Entscheidung

Ein Release erfolgt nur, wenn automatische Prüfungen grün, Änderungen und Migrationen verstanden, Secrets/Finanzwerte ausgeschlossen und relevante manuelle Szenarien abgenommen sind. GitHub-CI prüft Pushes auf `master` und Pull Requests mit Lint, Unit, Build und Smoke. Reale Google-/Datenbankabläufe bleiben außerhalb CI.

## Nachweis

- Skripte: [package.json](../../package.json)
- CI: [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Visual-Konfiguration: [playwright.config.ts](../../playwright.config.ts)
- Smoke-Orchestrator: [scripts/run-smoke-tests.mjs](../../scripts/run-smoke-tests.mjs)
