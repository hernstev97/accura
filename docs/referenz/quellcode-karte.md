# Quellcode-Karte

> **Zielgruppe:** Neue und erfahrene Entwickler.
> **Zweck und Lernziel:** Zuständiges Modul für eine Änderung schnell finden.
> **Voraussetzungen:** [Architekturüberblick](../architektur/ueberblick.md)
> **Kanonisch für:** Repository-Verzeichnisse und Modulzuständigkeiten.
> **Verwandte Dokumente:** [Frontend](../architektur/frontend.md), [API](api.md), [Tests und Qualität](../architektur/tests-und-qualitaet.md)

| Pfad | Verantwortung |
| --- | --- |
| `index.html` | Browserdokument, Root, frühe Metadaten |
| `src/main.tsx` | Service Worker, Pre-Render-Initialisierung, Providerreihenfolge |
| `src/App.tsx` | App-Shell, Connection States, Zielnavigation, Lazy Loading |
| `src/screens/` | vier Finance-Ansichten |
| `src/components/` | gemeinsame UI-, Dialog-, Navigation-, Privacy- und Diagrammrollen |
| `src/data/` | Browser-API, Picker, Finance-Provider, Laufzeitmodus und IndexedDB-Finance-Cache |
| `src/finance/` | Schemaheader, Parser, Laufzeitschema, Typen, Selektoren, Upcoming, View-Model |
| `src/appearance/` | Präferenz, Paletten, Tokens, Worker und Wallpaper-IndexedDB |
| `src/privacy/` | Geldmaskierung, App-Schutz-/PIN-Store, Expressive-PIN-Formen und gemeinsamer Context |
| `src/navigation/` | kanonische App-Pfade, History-/Startauflösung und letzte Destination |
| `src/design/` | zentrale CSS-Tokens, Schriftimport, Diagramm-/Motion-Helfer |
| `src/styles/` | Basis, Shell, Primitives, Screens, Zustände, Responsive Regeln |
| `src/mocks/` | ausschließlich anonyme Entwicklungsdaten und Mock-API |
| `build/` | geprüfte Buildzeit-Auflösung für Source-Link und Preview-Modus |
| `api/` | Vercel Function Entry Points |
| `api/_lib/` | Konfiguration, HTTP, Security, Google, gemeinsamer PostgreSQL-Pool, Connection-/Finance-Repositories und Sheets-Finance-Service |
| `migrations/` | transaktionale PostgreSQL-Migrationen für Google-Verbindung und ownergebundenes Finance-v1-Schema |
| `scripts/` | Node-ESM-, Browser-, Offline- und Service-Worker-Smokes sowie Docs-Check |
| `tests/postgres/` | echte, synthetische PostgreSQL-Migrations-, Constraint- und Finance-Reader-Tests |
| `tests/visual/` | Playwright Golden-/Axe-Spezifikation und Referenzbilder |
| `public/` | Icons und statische PWA-Assets |
| `vercel.json` | SPA-Deep-Link-Rewrite unter explizitem Ausschluss von `/api` |
| `.github/workflows/ci.yml` | bestehende GitHub-CI |
| `docs/` | deutschsprachige SSOT-Dokumentation |

## Wert von der Zelle zur Komponente

Für einen Geldwert beginnt die Spur in einem Header aus [src/finance/schema.ts](../../src/finance/schema.ts), läuft über [src/finance/parser.ts](../../src/finance/parser.ts) in einen Cent-Typ aus [src/finance/types.ts](../../src/finance/types.ts), wird in [src/finance/selectors.ts](../../src/finance/selectors.ts) gewählt/aggregiert, in [src/finance/viewModel.ts](../../src/finance/viewModel.ts) präsentationsfertig und über [src/data/FinanceDataProvider.tsx](../../src/data/FinanceDataProvider.tsx) an einen Screen gereicht. [src/components/MoneyValue.tsx](../../src/components/MoneyValue.tsx) formatiert und maskiert den Wert.

Der noch nicht produktiv angeschlossene PostgreSQL-Pfad beginnt bei der verifizierten Google-Subjekt-ID, löst den internen Owner in [financeRepository.ts](../../api/_lib/financeRepository.ts) auf, liest die Tabellen aus [Migration 002](../../migrations/002_finance_data_v1.sql) und endet ebenfalls am unveränderten `FinanceDataV1`. Beide Repositories teilen [database.ts](../../api/_lib/database.ts); `/api/finance` verwendet bis ACC-66 weiterhin ausschließlich den Sheets-Service.

## Änderungshinweise

- Tabellenvertrag: zuerst Schema-Referenz, Typen, Parser/Laufzeitschema und Tests gemeinsam prüfen.
- Neue Geldanzeige: View-Model/Formatierung und `MoneyValue` verwenden, damit Privacy greift.
- Neue API-Aktion: Methode, Auth, Origin/CSRF, Zod-Grenze und öffentliche Fehlerform berücksichtigen.
- Neue Appearance-Eigenschaft: versioniertes Speicherparsing, Pre-Render und Cross-Tab-Verhalten berücksichtigen.
- Neue App-Schutz-Eigenschaft: fail-closed Parsing, Pre-Render-Abdeckung, Lifecycle und Recovery gemeinsam prüfen.
- Neue Dokumentseite: im [zentralen Index](../README.md) und in der Themenmatrix aufnehmen.
