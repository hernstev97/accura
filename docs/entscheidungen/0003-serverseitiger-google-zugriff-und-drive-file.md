# ADR 0003: Serverseitiger Google-Zugriff und drive.file

> **Zielgruppe:** Backend- und Security-Entwickler.
> **Zweck und Lernziel:** Google-Tokenplatzierung und Scope-Wahl begründen.
> **Voraussetzungen:** [Backend und Sicherheit](../architektur/backend-und-sicherheit.md)
> **Kanonisch für:** Begründung des serverseitigen Tokenflusses und `drive.file`-Scopes.
> **Verwandte Dokumente:** [Web-Sicherheit und OAuth](../grundlagen/web-sicherheit-und-oauth.md), [ADR-Index](README.md)

- **Status:** Ersetzt durch [ADR 0014](0014-google-oauth-nur-als-identitaet.md)

## Kontext

Wiederholte Sheets-Zugriffe benötigen ein Refresh-Token; vollständiger Drive-Zugriff wäre unverhältnismäßig.

## Entscheidung

Refresh-Token bleiben verschlüsselt serverseitig. Der Scope ist `drive.file`; nur Picker erhält nach authentifizierter Anfrage ein kurzes Access-Token. Der Server validiert Datei und Schema erneut.

## Begründung

Least Privilege und eine klare Secret-Grenze reduzieren Auswirkungen von Browserkompromittierung und Fehlbedienung.

## Erwogene Alternativen

Refresh-Token im Browser, Sheets-API-Key, vollständiger Drive-Scope oder Service Account. Sie passen schlechter zu privater Nutzerhoheit und Sicherheitsgrenze.

## Konsequenzen

### Positiv

Keine langlebigen Google-Token im Browser, begrenzter Dateizugriff, zentrale Prüfung.

### Negativ

Backend, PostgreSQL, OAuth-Consent und Reconnect-Behandlung sind erforderlich.

## Implementierung und Tests

- Implementierung: [api/_lib/google.ts](../../api/_lib/google.ts), [api/_lib/financeService.ts](../../api/_lib/financeService.ts)
- Tests: [src/server/google.test.ts](../../src/server/google.test.ts), [src/server/financeService.test.ts](../../src/server/financeService.test.ts)
