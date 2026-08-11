# API-Referenz

> **Zielgruppe:** Frontend-, Backend- und Integrationsentwickler.
> **Zweck und Lernziel:** Aktuelle `/api/*`-Methoden, Requests, Responses und Fehler nachschlagen.
> **Voraussetzungen:** [Backend und Sicherheit](../architektur/backend-und-sicherheit.md)
> **Kanonisch für:** HTTP-Endpunkte und Request-/Response-Verträge.
> **Verwandte Dokumente:** [Konfiguration](konfiguration.md), [Finance Data Schema v1](finance-data-schema-v1.md)

Alle Endpunkte sind same-origin Vercel Functions, antworten mit `Cache-Control: no-store` und akzeptieren nur die angegebene Methode. Authentifizierung erfolgt über das signierte HttpOnly-Cookie `finance_session`. Schreibende Endpunkte verlangen zusätzlich `Origin: <APP_ORIGIN>` und `x-csrf-token`.

## Endpunkte

| Methode | Pfad | Auth/CSRF | Erfolg |
| --- | --- | --- | --- |
| `GET` | `/api/auth/google/start` | nein | 302 zu Google, setzt OAuth-Transaktionscookie |
| `GET` | `/api/auth/google/callback` | OAuth-Cookie, Query `code`/`state` | 302 zur App, setzt Session-Cookie |
| `GET` | `/api/session` | optionales Session-Cookie | Sitzungsstatus |
| `GET` | `/api/finance` | Session | validierter Finance-Snapshot |
| `GET` | `/api/google/picker` | Session | kurzlebige Picker-Konfiguration |
| `PUT` | `/api/google/spreadsheet` | Session + CSRF + Origin | geprüfte Auswahl und Finance-Snapshot |
| `POST` | `/api/auth/logout` | Session + CSRF + Origin | Sitzung beendet |
| `POST` | `/api/connection/disconnect` | Session + CSRF + Origin | Grant best-effort widerrufen, Verbindung gelöscht |

Nicht erlaubte Methoden ergeben 405 und einen `Allow`-Header.

## `GET /api/session`

Ohne gültige Sitzung:

```json
{ "authenticated": false }
```

Mit Sitzung:

```json
{
  "authenticated": true,
  "user": { "email": "owner@example.invalid" },
  "csrfToken": "…",
  "connection": {
    "connected": true,
    "spreadsheet": { "id": "…", "name": "Anonyme Finanzen" }
  }
}
```

`connection.connected` kann `false` sein; `spreadsheet` kann `null` sein. Ein ungültiges/abgelaufenes Cookie wird gelöscht und als abgemeldet beantwortet.

## `GET /api/finance`

```json
{
  "spreadsheet": { "id": "…", "name": "Anonyme Finanzen" },
  "data": { "schemaVersion": 1, "asOf": "2026-08-01", "currency": "EUR" },
  "refreshedAt": "2026-08-11T12:00:00.000Z"
}
```

`data` ist vollständig gemäß dem normalisierten `FinanceDataV1`-Vertrag; die Kürzung oben ist nur Darstellung. Fehlende Verbindung/Auswahl ergibt 409, ungültiges Workbook 422, abgelaufener Grant 401 `reconnect_required`.

## `GET /api/google/picker`

```json
{
  "accessToken": "…",
  "expiresIn": 3600,
  "apiKey": "…",
  "appId": "1234567890",
  "clientId": "….apps.googleusercontent.com"
}
```

Das Access-Token ist kurzlebig und darf nicht persistiert werden. `apiKey`, `appId` und `clientId` sind browserverwendete Identifikatoren.

## `PUT /api/google/spreadsheet`

Header: `content-type: application/json`, `x-csrf-token: …`. Exakter Body:

```json
{ "fileId": "google-drive-file-id" }
```

`fileId` ist ein nicht leerer String von 10 bis 256 Zeichen; zusätzliche Felder sind unzulässig. Der Server prüft Drive-Datei und vollständiges Schema vor Speicherung. Die Erfolgsantwort entspricht `/api/finance`.

## Logout und Disconnect

Beide sind `POST` ohne Body und antworten:

```json
{ "ok": true }
```

Logout löscht nur das Session-Cookie. Disconnect versucht Google-Widerruf, löscht die Postgres-Verbindung auch bei Revocation-Netzfehler und löscht das Session-Cookie. Der Client entfernt nach Erfolg zusätzlich seinen Finance-IndexedDB-Cache.

## Fehlerformat

```json
{
  "error": {
    "code": "invalid_finance_schema",
    "message": "Die Tabelle entspricht nicht Finance Data Schema v1.",
    "details": { "issues": [] }
  }
}
```

`details` ist optional. Relevante Codes sind `method_not_allowed`, `unauthenticated`, `forbidden`, `csrf_failed`, `connection_missing`, `spreadsheet_missing`, `invalid_request`, `spreadsheet_inaccessible`, `invalid_spreadsheet_type`, `invalid_finance_schema`, `reconnect_required`, `google_token_error`, `sheets_read_failed` und `internal_error`. OAuth-Callbackfehler werden als sicher allowgelisteter `auth_error`-Queryparameter zur App umgeleitet.

## Implementierung und Tests

- Endpunkte: [api](../../api)
- Client-Laufzeitverträge: [src/data/financeApi.ts](../../src/data/financeApi.ts)
- Server-Tests: [src/server](../../src/server), [scripts/server-esm.test.mjs](../../scripts/server-esm.test.mjs)
