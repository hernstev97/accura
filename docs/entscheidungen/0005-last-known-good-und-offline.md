# ADR 0005: Last-known-good und Offline

> **Zielgruppe:** PWA- und Datenentwickler.
> **Zweck und Lernziel:** Offline-Datenhaltung und Fehlerverhalten begründen.
> **Voraussetzungen:** [Synchronisation und Offline](../architektur/synchronisation-und-offline.md)
> **Kanonisch für:** Begründung des IndexedDB-Last-known-good-Snapshots.
> **Verwandte Dokumente:** [Abläufe und Zustände](../produkt/ablaeufe-und-zustaende.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

Die private Finanzübersicht soll nach erfolgreichem Sync auch ohne Netz nützlich bleiben, darf aber ungültige oder teilweise Antworten nicht cachen.

## Entscheidung

Der Browser speichert genau den letzten vollständig validierten `FinanceDataV1`-Snapshot in IndexedDB. Refreshfehler behalten ihn sichtbar veraltet; der Service Worker cached keine API-Antwort.

## Begründung

Fachlicher Cache und App-Shell bleiben getrennt, und ein Fehler verschlechtert einen bekannten guten Stand nicht.

## Erwogene Alternativen

Kein Offline, HTTP-Cache für API, mehrere unversionierte Snapshots oder Cache-Löschung bei jedem Logout.

## Konsequenzen

### Positiv

Offline-Start, robuste Fehlerzustände, erneut validierter lokaler Vertrag.

### Negativ

Unverschlüsselte sensitive Gerätedaten, mögliche Veraltung und Browserlöschung; Disconnect löscht nur dieses Gerät.

## Implementierung und Tests

- Implementierung: [src/data/financeCache.ts](../../src/data/financeCache.ts), [vite.config.ts](../../vite.config.ts)
- Tests: [src/data/financeCache.test.ts](../../src/data/financeCache.test.ts), [scripts/offline-smoke.mjs](../../scripts/offline-smoke.mjs)
