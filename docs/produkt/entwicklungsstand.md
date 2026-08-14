# Entwicklungsstand

> **Zielgruppe:** Eigentümer, Produktbeteiligte und Entwickler.
> **Zweck und Lernziel:** Verifizierte erreichte Funktionen von offenen Vorhaben trennen.
> **Voraussetzungen:** [Produktüberblick](ueberblick.md)
> **Kanonisch für:** Aktueller Implementierungs- und Prüfstand.
> **Verwandte Dokumente:** [Roadmap](roadmap.md), [Tests und Qualität](../architektur/tests-und-qualitaet.md)

## Aktuell erreicht

- Private Single-User-PWA mit `accura`-Branding und zeitabhängiger Begrüßung.
- Übersicht, Demnächst, Budget und Schulden mit adaptiver Bottom-Navigation beziehungsweise Navigation Rail.
- Kanonische URLs für alle vier Hauptansichten mit Deep Links, Browser-/PWA-History, sicherer OAuth-Rückkehr und gezielter PWA-Kaltstart-Wiederherstellung.
- Google OAuth mit State, Nonce und PKCE; Picker mit `drive.file`; serverseitige Drive-/Sheets-Zugriffe; verschlüsselte Refresh-Tokens in PostgreSQL.
- Finance Data Schema v1 mit zehn Maschinen-Tabs, Laufzeitvalidierung, Integer-Cents, Fremdschlüsseln, Snapshot-Auswahl, `salary_day` und `due_day`.
- Ownergebundenes PostgreSQL-v1-Schema mit zusammengesetzten Fremdschlüsseln, gemeinsamem Lazy-Pool und internem `READ ONLY`-/`REPEATABLE READ`-Reader zurück zum unveränderten `FinanceDataV1`. Der produktive `/api/finance`-Pfad bleibt bis ACC-66 auf Sheets.
- Last-known-good-Cache in IndexedDB, Offline-App-Shell, getesteter leerer Offline-Start und Netzrückkehr, manuelle und ereignisgesteuerte Datenaktualisierung sowie Race-Schutz.
- Kontrollierter PWA-Versionswechsel mit verständlichem „Jetzt neu laden“/„Später“-Hinweis, stabilem Installationsmanifest und automatisierten Android-orientierten Icon-/Systemfarben-Verträgen.
- Appearance mit Systemmodus, Hell/Dunkel, Browser-Akzent, neun Presets, lokaler Bildanalyse im Worker und lokaler WebP-Vorschau.
- Lokaler Privacy-Modus einschließlich Tabsynchronisierung und Maskierung von sichtbaren sowie zugänglichen Geldtexten.
- Optionaler App-Vorschau-Schutz und lokaler sechsstelliger PIN-Lock mit Android-orientiertem, thematisiertem Lockscreen, Expressive-PIN-Formen, Fehlversuchs-Wartezeit und fail-closed Recovery.
- Wiederverwendbare MD3-Komponenten, Responsive/Reflow, Reduced Motion, Forced Colors, Fokusmanagement und lokale Google-Sans-Flex-Schrift.
- GitHub-CI für Lint, Unit-Tests, echte PostgreSQL-Integrationstests, Build und Smoke; aktuell 237 normale Vitest-Tests, zehn dedizierte PostgreSQL-Fälle und elf Node-Tests sowie PWA-, Offline-, Golden- und Axe-Prüfungen.

## Historische Meilensteine

Am 8. August 2026 entstanden React-/TypeScript-/Vite-Grundlage, Finanzdomäne, drei ursprüngliche Ansichten, PWA, produktiver Google-/Postgres-Datenfluss und Offline-Cache. Am 9. August folgten Appearance, vereinheitlichte Komponenten, Accessibility-Pass, 26 Golden Screenshots und Branding. Danach wurden GitHub-CI, Demnächst einschließlich Gehaltstagkorrektur und Privacy-Modus integriert.

Die genaue Commit-Historie bleibt in Git; diese Seite ist kein tägliches Journal, sondern ein überprüfbarer Status. Zukünftige Arbeit wird nicht hier, sondern in der [Roadmap](roadmap.md) geführt.

## Bekannte Abdeckungslücken

Reale Produktionsabläufe mit persönlichen externen Diensten können im Repository nicht automatisiert bewiesen werden und benötigen eine Eigentümer-Abnahme. Für den PostgreSQL-Cutover sind insbesondere reale Neon-/Vercel-Region, eingeschränkte Runtime-Rolle, Restore-Fenster und ein praktischer synthetischer Restore vor ACC-66 noch als Betriebsaufgaben offen. Androids tatsächlich gerenderter Installationsdialog, Launcher, Splash und App-Switcher liegen ebenfalls außerhalb der gewählten Desktop-Chromium-Automation; Manifest, Installierbarkeit, Icon-Pixelverträge, Worker-Update und der Web-Lockscreen sind automatisiert abgedeckt.

## Nachweis

- CI: [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Tests: [src](../../src), [scripts](../../scripts), [tests/visual](../../tests/visual)
- Produktcode: [src/main.tsx](../../src/main.tsx), [api](../../api)
