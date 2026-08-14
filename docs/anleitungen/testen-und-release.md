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
npm run test:postgres
npm run lint
npm run licenses:check
npm run build
npm run test:visual
npm run smoke
```

`test:postgres` benötigt eine dedizierte `POSTGRES_TEST_URL`, darf nie gegen Production laufen und wird ohne URL absichtlich nicht übersprungen. Die CI stellt dafür einen temporären PostgreSQL-Service bereit. `test:visual` und `smoke` starten beziehungsweise orchestrieren ihre benötigten lokalen Browserabläufe gemäß den Skripten. Sie benötigen installierte Playwright-Chromium-Binaries. Externe Links können zusätzlich diagnostiziert werden:

```bash
npm run docs:check:external
```

Der PWA-Teil der Smoke-Suite kann gezielt ausgeführt werden:

```bash
npm run smoke:pwa
```

Er prüft das gebaute Manifest über Chromium-CDP, Installierbarkeitsfehler, Icon-Pixelverträge, Light/Dark-Systemfarben sowie einen echten Wechsel zwischen zwei Service-Worker-Generationen einschließlich „Später“ und „Jetzt neu laden“. Der Offline-Smoke deckt Warmstart, Start ohne Finance-Cache und die automatische Synchronisierung bei Netzrückkehr ab.

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
- Login, Sync, fehlender Finanzstand und Integritätsprobleme;
- Offline-Start mit und ohne vorherigen Cache;
- Logout blendet lokale Finanzdaten aus; erneute Anmeldung mit derselben Identität stellt den ownergebundenen Cache und den PostgreSQL-Stand wieder her;
- Appearance-Entwurf, Anwenden, Abbrechen, Bildentfernung und OS-Moduswechsel;
- Privacy sichtbar und mit Screenreader-Ausgabe, einschließlich Tabsynchronisierung;
- Tastatur, Fokus, Reduced Motion, 320-Pixel-Reflow und Forced Colors.

Chromes nativer Installationsdialog, Android-Launcher, Task-Switcher und OS-Splash werden von Desktop-Chromium nicht gerendert. ACC-7 akzeptiert hierfür ausdrücklich die automatisierten Manifest-, Farb-, Icon- und Installierbarkeitsverträge; eine spätere Realgeräte- oder Emulatorprobe bleibt optional und ist kein Gate dieser Abnahme.

## Release-Entscheidung

Arbeitsbranches entstehen von `develop` und werden per Pull Request dorthin integriert. Vercel stellt sie und den dauerhaften `develop`-Stand mit anonymer, bereits angemeldeter Mock-Sitzung bereit. Dieser Pfad darf keine realen Google-/Datenbankabläufe vortäuschen.

Ein Produktionsrelease von `develop` nach `master` erfolgt nur als eigener bewusster Schritt, wenn automatische Prüfungen grün, Änderungen und Migrationen verstanden, Secrets/Finanzwerte ausgeschlossen und relevante reale Szenarien abgenommen sind. GitHub-CI prüft Pushes auf `develop` und `master` sowie Pull Requests mit Lint, Unit, PostgreSQL, Build und Smoke. Externe Neon-Betriebsabläufe bleiben außerhalb CI.

## Nachweis

- Skripte: [package.json](../../package.json)
- CI: [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Visual-Konfiguration: [playwright.config.ts](../../playwright.config.ts)
- Smoke-Orchestrator: [scripts/run-smoke-tests.mjs](../../scripts/run-smoke-tests.mjs)
