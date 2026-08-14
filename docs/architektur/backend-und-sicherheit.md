# Backend und Sicherheit

> **Zielgruppe:** Backend-Entwickler, Security-Reviewer und Betreiber.
> **Zweck und Lernziel:** Vercel Functions, Google-Zugriff, OAuth-Schutz und Server-Vertrauensgrenze nachvollziehen.
> **Voraussetzungen:** [Web-Sicherheit und OAuth](../grundlagen/web-sicherheit-und-oauth.md)
> **Kanonisch für:** Serverseitigen Datenfluss, OAuth- und Sicherheitsverträge sowie Vertrauensannahmen.
> **Verwandte Dokumente:** [API-Referenz](../referenz/api.md), [Datenbank](../referenz/datenbank.md), [Produktions-Setup](../anleitungen/produktions-setup.md)

## Mentales Modell

Die Vercel Functions sind Backend-for-Frontend und Sicherheitsgrenze. Sie verifizieren die einzige erlaubte Identität, lesen den ownergebundenen Finanzstand aus PostgreSQL und liefern eine kleine same-origin JSON-API. Google wird nur für die Anmeldung angesprochen. Ein zentraler Lazy-Pool mit höchstens einer Verbindung pro `DATABASE_URL` bedient das Finance-Repository.

PostgreSQL ist die einzige produktive Finanzquelle. Es gibt weder Dual-Read noch einen Laufzeit-Fallback auf Sheets. Google OAuth fordert nur `openid email profile`. Picker, `drive.file`, Drive-/Sheets-Laufzeitzugriff und persistierte Refresh-Tokens sind entfernt. Der einmalige Import liegt außerhalb der Produkt-UI.

## Implementierter PostgreSQL-Reader

`FinanceRepository.readForGoogleSub(googleSub)` ist eine reine interne Servergrenze. `googleSub` darf nur aus der verifizierten Sitzung stammen; der Browser sendet keine Owner-UUID. Das Repository löst die Subjekt-ID einmalig zu `owners.id` auf und filtert jede weitere Abfrage mit dieser internen ID.

Der vollständige Read läuft `READ ONLY` und `REPEATABLE READ`. Meta, Stammdaten, sämtliche historische und zukünftige Snapshots sowie Meilensteine stammen deshalb aus einem konsistenten Datenbankstand. `DATE` wird direkt in SQL zu ISO-Text formatiert; `BIGINT` wird nur aus gültiger Integerdarstellung in einen sicheren JavaScript-Integer überführt. Anschließend validiert das gemeinsame Zod-Schema den vollständigen `FinanceDataV1`-Vertrag. Aktive Accounts, Pockets und Debts brauchen zusätzlich einen Snapshot mit Datum am oder vor `asOf`.

Fehlender Owner oder fehlendes `finance_meta` liefert `null` und wird als `409 finance_missing` abgebildet. Ein ungültiger gespeicherter Stand erzeugt einen eigenen internen Integritätsfehler ohne Zeilen, IDs oder Finanzwerte und wird als `422 finance_data_integrity` ohne Details nach außen gegeben.

Implementierung und Test: [api/_lib/financeRepository.ts](../../api/_lib/financeRepository.ts), [PostgreSQL-Integrationstest](../../tests/postgres/financeRepository.postgres.test.ts).

## OAuth-Sequenz

```mermaid
sequenceDiagram
  actor U as Freigegebene Person
  participant B as Browser
  participant A as Vercel Functions
  participant G as Google OAuth
  participant P as PostgreSQL
  U->>B: Mit Google anmelden
  B->>A: GET /api/auth/google/start?return_to=/budget
  A->>A: Rückweg allowlisten; State, Nonce, PKCE-Verifier erzeugen
  A-->>B: signiertes HttpOnly-Transaktionscookie + Redirect
  B->>G: Authorization Request mit Challenge
  G-->>B: Code + State an Callback
  B->>A: GET /api/auth/google/callback
  A->>A: Cookie/State prüfen
  A->>G: Code + PKCE-Verifier tauschen
  G-->>A: ID-Token
  A->>A: Nonce, Signatur, Audience, verifizierte Allowlist-Mail prüfen
  A-->>B: signiertes HttpOnly-Session-Cookie + Redirect zum gebundenen Rückweg
```

`return_to` akzeptiert ausschließlich `/`, `/demnaechst`, `/budget` oder `/schulden`. Der validierte Pfad liegt im HMAC-signierten OAuth-Transaktionscookie und kann im Callback weder durch Queryparameter noch durch eine externe URL ersetzt werden. Fehlt er in einer vor dem Deployment begonnenen Transaktion, gilt rückwärtskompatibel `/`. Nur nach verifizierter Transaktion darf auch ein OAuth-Fehler zum gebundenen Pfad zurückkehren; andernfalls wird `/` verwendet.

Implementierung und Tests: [api/auth/google/start.ts](../../api/auth/google/start.ts), [api/auth/google/callback.ts](../../api/auth/google/callback.ts), [api/_lib/security.ts](../../api/_lib/security.ts), [src/server/security.test.ts](../../src/server/security.test.ts), [scripts/server-esm.test.mjs](../../scripts/server-esm.test.mjs).

## Sitzung und CSRF

Das Session-Cookie heißt `finance_session`, ist `HttpOnly`, `SameSite=Lax`, auf `/` begrenzt und in Produktion `Secure`. Sein signierter Inhalt bindet Google-`sub`, normalisierte E-Mail, CSRF-Token sowie Ausgabe/Ablauf. Jeder authentifizierte Endpunkt prüft Signatur und die konfigurierte `ALLOWED_GOOGLE_EMAIL` erneut.

Schreibende Aktionen (Logout) verlangen den CSRF-Wert aus der Sitzung im Header `x-csrf-token` und eine exakte `Origin`, die `APP_ORIGIN` entspricht. Antworten tragen `Cache-Control: no-store`. Die vollständige Methoden-/Antworttabelle steht ausschließlich in der [API-Referenz](../referenz/api.md).

## Identität ohne Drive-Zugriff

Der Authorization-Code-Fluss fordert nur `openid email profile`. Ein kurzlebiges Access- oder Refresh-Token aus dem Tausch wird nicht persistiert. Die Sitzung entsteht ausschließlich aus dem verifizierten ID-Token. Client-Secret, Datenbank-URL und Session-Secret werden nie an den Browser ausgeliefert.

## Fehlerfälle

Fehlender Finanzstand ergibt `409 finance_missing`. Ein intern ungültiger gespeicherter Stand ergibt `422 finance_data_integrity` ohne Issues, IDs oder Beträge. Unbekannte Serverfehler werden auf eine generische Meldung reduziert. Logout löscht nur das Session-Cookie und niemals PostgreSQL-Finanzzeilen.

## Sicherheitsannahmen und Grenzen

- Betreiber, Vercel-Projekt und Secret Store gelten als vertrauenswürdig.
- Das Modell verhindert keinen Schaden bei kompromittiertem Server plus Secrets.
- Single-User ist eine harte Zugriffspolitik, keine generische Mandantentrennung.
- Lokaler Cache liegt außerhalb der Serververschlüsselung.
- Origin-/CSRF-Schutz ersetzt keine XSS-Prävention; React-Escaping und zurückhaltende Abhängigkeiten bleiben wichtig.
- Es existiert derzeit kein dediziertes Rate-Limit; die Bewertung steht in der Roadmap.

## Begründung und Nachweis

Siehe [ADR 0013](../entscheidungen/0013-postgresql-als-finanzquelle.md), [ADR 0014](../entscheidungen/0014-google-oauth-nur-als-identitaet.md) und [ADR 0004](../entscheidungen/0004-single-user-sicherheitsmodell.md).

- Konfiguration: [api/_lib/config.ts](../../api/_lib/config.ts)
- Gemeinsamer Datenbankzugang: [api/_lib/database.ts](../../api/_lib/database.ts)
- HTTP-Grenze: [api/_lib/http.ts](../../api/_lib/http.ts)
- Google-Identität: [api/_lib/google.ts](../../api/_lib/google.ts)
- PostgreSQL-Finance-Repository: [api/_lib/financeRepository.ts](../../api/_lib/financeRepository.ts)
- Operator-Import: [api/_lib/financeImport.ts](../../api/_lib/financeImport.ts), [scripts/import-finance.ts](../../scripts/import-finance.ts)
- Server-Tests: [src/server](../../src/server)
