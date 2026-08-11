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
| `refresh_token_missing` | Google gab keinen Offline-Grant aus | App-Grant widerrufen und bewusst neu verbinden |
| `missing_required_scope` | `drive.file` nicht erteilt | Consent/Scope-Konfiguration korrigieren |
| `connection_missing` | Sitzung vorhanden, Postgres-Zeile fehlt | neu verbinden; DB/Environment nicht verwechseln |
| `spreadsheet_missing` | noch keine Auswahl | Picker öffnen und gültige Kopie wählen |
| `spreadsheet_inaccessible` | Datei nicht vom Grant erfasst/gelöscht | Zugriff prüfen und erneut über Picker wählen |
| `invalid_spreadsheet_type` | keine aktive native Google-Tabelle | Google Sheets statt XLSX/PDF wählen |
| `invalid_finance_schema` | Tab, Header, Wert, Referenz oder Snapshot ungültig | strukturierte Issues und [Schema](../referenz/finance-data-schema-v1.md) abarbeiten |
| `reconnect_required` | Grant abgelaufen oder widerrufen | Google neu verbinden |
| `csrf_failed` | Origin/CSRF passt nicht | `APP_ORIGIN`, Proxy-Origin und Session prüfen; nicht Token umgehen |
| Offline ohne Daten | noch nie erfolgreich synchronisiert oder Browsercache gelöscht | online ersten gültigen Sync durchführen |
| alter Stand trotz Netz | Refresh fehlgeschlagen oder Vordergrundschwelle nicht erreicht | manuell aktualisieren und `/api/finance` prüfen |
| Bildvorschau fehlt | IndexedDB blockiert/gelöscht | Palette bleibt nutzbar; Bild neu wählen, Speicherrechte prüfen |
| Privacy nicht tabübergreifend | `localStorage` blockiert oder anderer Origin | beide Tabs auf exakt derselben Origin und Speicherzugriff prüfen |

## Schemafehler lesen

Ein Issue nennt `tab`, Tabellenzeile (Header ist Zeile 1), `column`, erwartete Form und eine deutsche Meldung. Erst fehlende Tabs/Header beheben, dann Datentypen, IDs/Fremdschlüssel und zuletzt fehlende Snapshots. Tabellen-ID wird bei einer neuen Auswahl erst nach vollständig erfolgreicher Prüfung gespeichert.

## Offline und Service Worker

Prüfen, ob App-Shell und Finance-Cache getrennt betroffen sind: Lädt die Oberfläche, aber zeigt „kein lokaler Datenstand“, fehlt IndexedDB-Finance. Lädt die Oberfläche selbst nicht, Service-Worker/Deployment/HTTPS prüfen. Site-Daten löschen entfernt möglicherweise Finance, Appearance und Privacy; nur mit Einverständnis und nach Hinweis auf Datenverlust tun.

## Eskalationsdaten ohne Geheimnisse

Sinnvoll sind Commit/Deployment-ID, UTC-Zeit, Browser/Version, anonymisierter Statuscode und Fehlercode, betroffener Endpoint sowie reproduzierbare Schritte. Nicht sinnvoll sind Authorization-Header, Cookies, Refresh-Token, Datenbank-URLs, Sheets-Inhalte oder Screenshots realer Beträge.

## Implementierung und Tests

- Öffentliche Fehlerform: [api/_lib/errors.ts](../../api/_lib/errors.ts)
- Client-Mapping: [src/data/financeApi.ts](../../src/data/financeApi.ts), [src/data/FinanceDataProvider.tsx](../../src/data/FinanceDataProvider.tsx)
- Schema-Issues: [src/finance/parser.ts](../../src/finance/parser.ts)
- Fehlerzustands-Smokes: [scripts/browser-smoke.mjs](../../scripts/browser-smoke.mjs)
