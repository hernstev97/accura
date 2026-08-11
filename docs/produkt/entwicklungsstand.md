# Entwicklungsstand

> **Zielgruppe:** Eigentümer, Produktbeteiligte und Entwickler.
> **Zweck und Lernziel:** Verifizierte erreichte Funktionen von offenen Vorhaben trennen.
> **Voraussetzungen:** [Produktüberblick](ueberblick.md)
> **Kanonisch für:** Aktueller Implementierungs- und Prüfstand.
> **Verwandte Dokumente:** [Roadmap](roadmap.md), [Tests und Qualität](../architektur/tests-und-qualitaet.md)

## Aktuell erreicht

- Private Single-User-PWA mit `accura`-Branding und zeitabhängiger Begrüßung.
- Übersicht, Demnächst, Budget und Schulden mit adaptiver Bottom-Navigation beziehungsweise Navigation Rail.
- Google OAuth mit State, Nonce und PKCE; Picker mit `drive.file`; serverseitige Drive-/Sheets-Zugriffe; verschlüsselte Refresh-Tokens in PostgreSQL.
- Finance Data Schema v1 mit zehn Maschinen-Tabs, Laufzeitvalidierung, Integer-Cents, Fremdschlüsseln, Snapshot-Auswahl, `salary_day` und `due_day`.
- Last-known-good-Cache in IndexedDB, Offline-App-Shell, manuelle und ereignisgesteuerte Aktualisierung sowie Race-Schutz.
- Appearance mit Systemmodus, Hell/Dunkel, Browser-Akzent, neun Presets, lokaler Bildanalyse im Worker und lokaler WebP-Vorschau.
- Lokaler Privacy-Modus einschließlich Tabsynchronisierung und Maskierung von sichtbaren sowie zugänglichen Geldtexten.
- Wiederverwendbare MD3-Komponenten, Responsive/Reflow, Reduced Motion, Forced Colors, Fokusmanagement und lokale Google-Sans-Flex-Schrift.
- GitHub-CI für Lint, Unit-Tests, Build und Smoke; aktuell 166 Vitest-Tests plus ein Node-ESM-Test sowie Smoke-, Offline-, Golden- und Axe-Prüfungen.

## Historische Meilensteine

Am 8. August 2026 entstanden React-/TypeScript-/Vite-Grundlage, Finanzdomäne, drei ursprüngliche Ansichten, PWA, produktiver Google-/Postgres-Datenfluss und Offline-Cache. Am 9. August folgten Appearance, vereinheitlichte Komponenten, Accessibility-Pass, 26 Golden Screenshots und Branding. Danach wurden GitHub-CI, Demnächst einschließlich Gehaltstagkorrektur und Privacy-Modus integriert.

Die genaue Commit-Historie bleibt in Git; diese Seite ist kein tägliches Journal, sondern ein überprüfbarer Status. Zukünftige Arbeit wird nicht hier, sondern in der [Roadmap](roadmap.md) geführt.

## Bekannte Abdeckungslücken

Demnächst und Privacy besitzen Unit-/Komponententests, sind aber noch nicht vollständig in Golden-Screenshots und Axe-Szenarien abgebildet. Reale Produktionsabläufe mit persönlichen externen Diensten können im Repository nicht automatisiert bewiesen werden und benötigen eine Eigentümer-Abnahme.

## Nachweis

- CI: [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Tests: [src](../../src), [scripts](../../scripts), [tests/visual](../../tests/visual)
- Produktcode: [src/main.tsx](../../src/main.tsx), [api](../../api)
