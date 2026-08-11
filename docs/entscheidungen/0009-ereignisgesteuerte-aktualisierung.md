# ADR 0009: Ereignisgesteuerte Aktualisierung

> **Zielgruppe:** Daten- und PWA-Entwickler.
> **Zweck und Lernziel:** Aktualisierungsauslöser und Verzicht auf Polling begründen.
> **Voraussetzungen:** [Synchronisation und Offline](../architektur/synchronisation-und-offline.md)
> **Kanonisch für:** Begründung der manuellen und browserereignisgesteuerten Synchronisierung.
> **Verwandte Dokumente:** [Abläufe und Zustände](../produkt/ablaeufe-und-zustaende.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

Die private Tabelle ändert sich selten; permanentes Polling würde Google-/Serverlast und versteckte Aktivität erzeugen.

## Entscheidung

Aktualisierung erfolgt bei Start, Auswahl, Nutzeraktion, Online-Rückkehr und sichtbarer Rückkehr nach mehr als zehn Minuten. Gleichzeitige Requests werden dedupliziert und alte Generationen verworfen.

## Begründung

Diese Ereignisse decken reale Nutzung ab, während Verhalten und Datenstand sichtbar bleiben.

## Erwogene Alternativen

Intervall-Polling, Cron, Webhook oder nur manuell. Polling/Cron sind unnötig, Google Sheets liefert hier keinen einfachen privaten Push; nur manuell wäre fehleranfällig.

## Konsequenzen

### Positiv

Wenig Last, keine Hintergrundschleife, expliziter Syncstatus.

### Negativ

Kein Echtzeitstand; Browserereignisse sind Hinweise und können verzögert sein.

## Implementierung und Tests

- Implementierung: [src/data/FinanceDataProvider.tsx](../../src/data/FinanceDataProvider.tsx)
- Tests: [src/data/FinanceDataProvider.test.ts](../../src/data/FinanceDataProvider.test.ts), [scripts/browser-smoke.mjs](../../scripts/browser-smoke.mjs)
