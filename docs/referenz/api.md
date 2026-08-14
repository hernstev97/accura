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
| `GET` | `/api/auth/google/start?return_to=/budget` | nein | 302 zu Google, setzt OAuth-Transaktionscookie |
| `GET` | `/api/auth/google/callback` | OAuth-Cookie, Query `code`/`state` | 302 zur App, setzt Session-Cookie |
| `GET` | `/api/session` | optionales Session-Cookie | Sitzungsstatus |
| `GET` | `/api/finance` | Session | validierter Finance-Snapshot aus PostgreSQL |
| `POST` | `/api/auth/logout` | Session + CSRF + Origin | Sitzung beendet |

Nicht erlaubte Methoden ergeben 405 und einen `Allow`-Header.

`return_to` am OAuth-Start ist optional und akzeptiert exakt `/`, `/demnaechst`, `/budget` oder `/schulden`. Jeder andere Wert fällt auf `/` zurück. Der validierte Pfad wird in der signierten OAuth-Transaktion gebunden; der Callback übernimmt keinen freien Redirectparameter. Erfolg und Fehler einer verifizierten Transaktion kehren zu diesem Pfad zurück, ältere Transaktionen ohne Feld sowie unverifizierbare Callbacks zu `/`.

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
  "ownerKey": "pseudonymer-HMAC-Schlüssel"
}
```

Ein ungültiges/abgelaufenes Cookie wird gelöscht und als abgemeldet beantwortet. Die Sitzung sagt nichts über das Vorhandensein eines Finanzstands.

## `GET /api/finance`

```json
{
  "data": { "schemaVersion": 1, "asOf": "2026-08-01", "currency": "EUR" },
  "refreshedAt": "2026-08-11T12:00:00.000Z",
  "ownerKey": "pseudonymer-HMAC-Schlüssel"
}
```

`data` ist vollständig gemäß dem normalisierten `FinanceDataV1`-Vertrag; die Kürzung oben ist nur Darstellung. `ownerKey` ist ein serverseitig mit `SESSION_SECRET` aus der verifizierten Google-Subjekt-ID abgeleiteter HMAC-Wert. Er partitioniert und bindet Browser-Caches, enthält weder die Google-ID noch `owners.id` und ist kein Autorisierungstoken. Client und Server liefern ihn in Sitzungs- und Finance-Antworten, damit ein Identitätswechsel zwischen Tabs keine Antwort in die falsche Cache-Partition schreibt. Fehlender Owner oder fehlendes `finance_meta` ergibt 409 `finance_missing`. Ein intern ungültiger gespeicherter Stand ergibt 422 `finance_data_integrity` ohne Issues, IDs oder Beträge.

## Logout

`POST /api/auth/logout` ohne Body antwortet:

```json
{ "ok": true }
```

Logout löscht nur das Session-Cookie. PostgreSQL-Finanzzeilen bleiben unverändert. Der lokale Finance-Cache bleibt erhalten, bis eine PIN-Recovery ihn bewusst entfernt.

## Fehlerformat

```json
{
  "error": {
    "code": "finance_missing",
    "message": "Es ist noch kein Finanzstand vorhanden."
  }
}
```

`details` ist optional und wird für Integritätsfehler des gespeicherten Stands nicht gesetzt. Relevante Codes sind `method_not_allowed`, `unauthenticated`, `forbidden`, `csrf_failed`, `finance_missing`, `finance_data_integrity` und `internal_error`. OAuth-Callbackfehler werden als sicher allowgelisteter `auth_error`-Queryparameter zum verifizierten internen Rückweg oder ersatzweise zu `/` umgeleitet.

## Implementierung und Tests

- Endpunkte: [api](../../api)
- Client-Laufzeitverträge: [src/data/financeApi.ts](../../src/data/financeApi.ts)
- Server-Tests: [src/server](../../src/server), [scripts/server-esm.test.mjs](../../scripts/server-esm.test.mjs)
