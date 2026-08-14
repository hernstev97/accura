# Tests und Qualität

> **Zielgruppe:** Entwickler und Release-Verantwortliche.
> **Zweck und Lernziel:** Vorhandene Prüfarten, CI-Grenze und bekannte Abdeckungslücken verstehen.
> **Voraussetzungen:** [Lokale Entwicklung](../anleitungen/lokale-entwicklung.md)
> **Kanonisch für:** Testaufteilung, Golden Screenshots, Accessibility und bestehende GitHub-CI.
> **Verwandte Dokumente:** [Testen und Release](../anleitungen/testen-und-release.md), [Entwicklungsstand](../produkt/entwicklungsstand.md)

## Mentales Modell

Keine einzelne Prüfung beweist das Produkt. Reine Unit-Tests decken fachliche Regeln und Stores schnell ab; Node-ESM prüft reale Server-Modulauflösung; Build und Lint prüfen statische Verträge; Browser-Smoke prüft die gebaute Anwendung; Golden Screens vergleichen definierte UI-Zustände; Axe sucht automatisiert häufige Accessibility-Verstöße.

## Vorhandene Prüfungen

| Befehl | Inhalt | Netzwerk/Secrets |
| --- | --- | --- |
| `npm test` | Node-Tests für ESM und den Lizenzgenerator sowie Vitest-Dateien unter `src/` und `build/` | keine externen Dienste |
| `npm run test:postgres` | Migrationen 001/002, Finance-Constraints, Owner-Isolation, Reader, Selektorgrenze und ACC-29-Parität (Cents, Fälligkeiten, Snapshot-Auswahl) gegen echtes PostgreSQL | dedizierte `POSTGRES_TEST_URL`, nur synthetische Daten |
| `npm run lint` | ESLint über das Repository | nein |
| `npm run licenses:check` | installierten Produktionsgraph fail-closed gegen Policy und eingecheckte Drittanbieterhinweise prüfen | nein |
| `npm run build` | TypeScript-Projektbuild und Vite/PWA-Produktionsbuild | nein |
| `npm run test:visual` | Playwright, 38 committed Chromium-Golden-Screens plus Axe-Szenarien | lokaler Server/Browser |
| `npm run smoke` | orchestrierte Auth-, PWA-Lifecycle-, Browser- und Offline-Smokes | lokale Mocks, keine Google-Secrets |
| `npm run smoke:pwa` | Manifest, Chromium-Installierbarkeit, Icons, offline precachte Lizenzhinweise, Theme-Metadaten und Zwei-Versionen-Update | lokaler Server, keine Secrets |
| `npm run docs:check` | interne Dokumentstruktur, Links und Anker | nein |
| `npm run docs:check:external` | zusätzlich deduplizierte externe Links | ja, optional |

Die Browser-Suiten verwenden anonyme Fixtures und simulierte Google-/API-Antworten. Neben dem normalen Datenstand decken deterministische Edge-Fixtures extreme und negative Beträge mit Budgetüberziehung, vollständig leere Collections sowie dichte Konto-/Pocketlisten ab. Sie prüfen unter anderem Connection States, IndexedDB, Service Worker, kontrollierte Worker-Aktualisierung, Chromium-Installierbarkeit, Icon-Safe-Zone, Responsive Layout, Dark Mode, Reduced Motion, Fokus, Touch-Ziele, Konsole, Charts, URL-Routing, History, OAuth-Rückweg, Offline-Deep-Link-Reload und Netzrückkehr.

## Golden Screenshots und Axe

Unter `tests/visual/__screenshots__/chromium` liegen 38 Referenzbilder für 412, 768 und 1440 Pixel, Light/Dark, die Finance-Screens sowie ausgewählte Dialog-, Fehler- und Finanz-Grenzzustände. Zwölf davon bilden bei 412 Pixeln extreme/überzogene, leere und dichte Finance-Fixtures in Light und Dark ab. Zusätzliche funktionale Prüfungen bei 320 Pixeln sichern Umbruch, Dokumentbreite, Leerzustände und progressive Offenlegung. Screenshots sind Regressionstests, keine kanonische Produktdokumentation.

`@axe-core/playwright` prüft automatisierbare WCAG-Probleme. Das ersetzt weder Tastatur-, Screenreader- noch visuelle manuelle Prüfung. Demnächst und Privacy sind noch nicht vollständig in Golden- und Axe-Matrix enthalten; diese Lücke steht in [Now](../produkt/roadmap.md#now).

## GitHub-CI

`.github/workflows/ci.yml` läuft für Pushes nach `master`/`develop` und Pull Requests. Die Jobs prüfen Lint einschließlich `licenses:check`, Unit-Tests, Build und Smoke-Tests. Ein separater Job startet PostgreSQL 17 als temporären Service und führt die dedizierte Suite mit synthetischen Daten aus. Der lokale Dokumentationscheck wird bewusst nicht in diese Datei oder `npm test` aufgenommen. Externe Links sind aufgrund temporärer Netzfehler nie Release-Gate.

## Fehlerfälle und Grenzen

Golden Screens hängen an Browser-/Fontdeterminismus; Updates dürfen nur nach bewusster visueller Prüfung committed werden. Axe findet nicht jede Barriere. Mock-Smokes beweisen keine echte Google- oder Vercel-Konfiguration. Die PostgreSQL-Suite beweist Standard-SQL, Constraints und Reader gegen eine echte temporäre Instanz, aber weder Neon-Region/Rollen/Restore noch produktive Daten. Reale OAuth-, Picker-, Sheets- und Disconnect-Abläufe bleiben Betreiber-Abnahme. Desktop-Chromium beweist außerdem nicht die tatsächlich von Android gerenderten Installations-, Launcher-, Task-Switcher- und Splash-Flächen; ACC-7 deckt stattdessen deren Web-Verträge automatisiert ab.

## Implementierung und Tests

- CI: [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Unit-Konfiguration: [vite.config.ts](../../vite.config.ts)
- PostgreSQL-Konfiguration und Suite: [vitest.postgres.config.ts](../../vitest.postgres.config.ts), [tests/postgres](../../tests/postgres)
- Smoke-Orchestrierung: [scripts/run-smoke-tests.mjs](../../scripts/run-smoke-tests.mjs)
- Visual/Axe: [tests/visual/finance-ui.spec.ts](../../tests/visual/finance-ui.spec.ts)
