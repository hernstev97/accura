# Fehlerdiagnose

> **Zielgruppe:** Nutzer, Betreiber und Entwickler.
> **Zweck und Lernziel:** Sichtbare Fehler systematisch einer Schicht zuordnen und ohne Datenverlust untersuchen.
> **Voraussetzungen:** [Abläufe und Zustände](../produkt/ablaeufe-und-zustaende.md)
> **Kanonisch für:** Operative Fehlerbilder und Diagnosepfade.
> **Verwandte Dokumente:** [Produktions-Setup](produktions-setup.md), [API-Referenz](../referenz/api.md), [Konfiguration](../referenz/konfiguration.md)

## Diagnoseprinzip

Zuerst sichtbaren Zustand, Browser-Online-Status, betroffene Aktion und Zeitpunkt notieren. Dann Browser-Konsole/Netzwerk, Vercel Function Logs und gegebenenfalls Datenbankzustand vergleichen. Keine Tokens, Cookies, vollständigen Finanzantworten oder persönliche Werte in Tickets/Logs kopieren.

## Häufige Fehlerbilder

| Symptom/Code | Wahrscheinliche Ursache | Prüfung und sichere Maßnahme |
| --- | --- | --- |
| `server_configuration_error` | Variable fehlt oder Origin/Callback inkonsistent | Vercel-Scope und [Konfiguration](../referenz/konfiguration.md) prüfen |
| `user_not_allowed` | falsche oder unverifizierte Google-E-Mail | `ALLOWED_GOOGLE_EMAIL` und Google-Testnutzer prüfen |
| `invalid_oauth_state` | abgelaufene/zweite Transaktion oder Cookie blockiert | Anmeldung in einem Tab neu starten; Cookie-Einstellungen prüfen |
| `finance_missing` | Sitzung vorhanden, kein `finance_meta` | Operator-Import prüfen; DB/Environment nicht verwechseln |
| `finance_data_integrity` | gespeicherter Stand verletzt den v1-Vertrag | Importquelle und Constraints prüfen; keine Werte aus Logs erwarten |
| `csrf_failed` | Origin/CSRF passt nicht | `APP_ORIGIN`, Proxy-Origin und Session prüfen; nicht Token umgehen |
| Offline ohne Daten | noch nie erfolgreich synchronisiert oder Browsercache gelöscht | online ersten gültigen Sync durchführen |
| alter Stand trotz Netz | Refresh fehlgeschlagen oder Vordergrundschwelle nicht erreicht | manuell aktualisieren und `/api/finance` prüfen |
| Bildvorschau fehlt | IndexedDB blockiert/gelöscht | Palette bleibt nutzbar; Bild neu wählen, Speicherrechte prüfen |
| Privacy nicht tabübergreifend | `localStorage` blockiert oder anderer Origin | beide Tabs auf exakt derselben Origin und Speicherzugriff prüfen |

## Schemafehler lesen

Operator-Importfehler nennen `tab`, Tabellenzeile (Header ist Zeile 1), `column`, erwartete Form und eine deutsche Meldung. Erst fehlende Tabs/Header beheben, dann Datentypen, IDs/Fremdschlüssel und zuletzt fehlende Snapshots. Die Produkt-API gibt für einen ungültigen gespeicherten Stand keine Issues aus.

## Offline und Service Worker

Prüfen, ob App-Shell und Finance-Cache getrennt betroffen sind: Lädt die Oberfläche, aber zeigt „kein lokaler Datenstand“, fehlt IndexedDB-Finance. Lädt die Oberfläche selbst nicht, Service-Worker/Deployment/HTTPS prüfen. Site-Daten löschen entfernt möglicherweise Finance, Appearance und Privacy; nur mit Einverständnis und nach Hinweis auf Datenverlust tun.

## Eskalationsdaten ohne Geheimnisse

Sinnvoll sind Commit/Deployment-ID, UTC-Zeit, Browser/Version, anonymisierter Statuscode und Fehlercode, betroffener Endpoint sowie reproduzierbare Schritte. Nicht sinnvoll sind Authorization-Header, Cookies, Refresh-Token, Datenbank-URLs, Sheets-Inhalte oder Screenshots realer Beträge.

## Implementierung und Tests

- Öffentliche Fehlerform: [api/_lib/errors.ts](../../api/_lib/errors.ts)
- Client-Mapping: [src/data/financeApi.ts](../../src/data/financeApi.ts), [src/data/FinanceDataProvider.tsx](../../src/data/FinanceDataProvider.tsx)
- Schema-Issues: [src/finance/parser.ts](../../src/finance/parser.ts)
- Fehlerzustands-Smokes: [scripts/browser-smoke.mjs](../../scripts/browser-smoke.mjs)
