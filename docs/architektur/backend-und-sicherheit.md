# Backend und Sicherheit

> **Zielgruppe:** Backend-Entwickler, Security-Reviewer und Betreiber.
> **Zweck und Lernziel:** Vercel Functions, Google-Zugriff, OAuth-Schutz und Server-Vertrauensgrenze nachvollziehen.
> **Voraussetzungen:** [Web-Sicherheit und OAuth](../grundlagen/web-sicherheit-und-oauth.md)
> **Kanonisch für:** Serverseitigen Datenfluss, OAuth- und Sicherheitsverträge sowie Vertrauensannahmen.
> **Verwandte Dokumente:** [API-Referenz](../referenz/api.md), [Datenbank](../referenz/datenbank.md), [Produktions-Setup](../anleitungen/produktions-setup.md)

## Mentales Modell

Die Vercel Functions sind Backend-for-Frontend und Sicherheitsgrenze. Sie verifizieren die einzige erlaubte Identität, verwalten Google-Token und Datenbankverbindung, lesen Sheets, validieren das Finance-Schema und liefern eine kleine same-origin JSON-API. Der Browser spricht Google nur beim bewusst geöffneten Picker direkt an.

Dies beschreibt den aktuell implementierten Übergangsstand. Im verbindlichen Zielbild aus [ADR 0013](../entscheidungen/0013-postgresql-als-finanzquelle.md) und [ADR 0014](../entscheidungen/0014-google-oauth-nur-als-identitaet.md) liest der Server `FinanceDataV1` ownergebunden aus PostgreSQL. Google bleibt nur Identitätsanbieter; Picker, `drive.file`, Sheets-Laufzeitzugriff und persistierte Refresh-Tokens entfallen beim Cutover. Bis dahin bleibt der alte Pfad betriebsfähig, wird aber nicht weiter ausgebaut.

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
  G-->>A: ID-, Access- und Refresh-Token
  A->>A: Nonce, Signatur, Audience, verifizierte Allowlist-Mail prüfen
  A->>P: Refresh-Token AES-256-GCM-verschlüsselt upserten
  A-->>B: signiertes HttpOnly-Session-Cookie + Redirect zum gebundenen Rückweg
```

`return_to` akzeptiert ausschließlich `/`, `/demnaechst`, `/budget` oder `/schulden`. Der validierte Pfad liegt im HMAC-signierten OAuth-Transaktionscookie und kann im Callback weder durch Queryparameter noch durch eine externe URL ersetzt werden. Fehlt er in einer vor dem Deployment begonnenen Transaktion, gilt rückwärtskompatibel `/`. Nur nach verifizierter Transaktion darf auch ein OAuth-Fehler zum gebundenen Pfad zurückkehren; andernfalls wird `/` verwendet.

Implementierung und Tests: [api/auth/google/start.ts](../../api/auth/google/start.ts), [api/auth/google/callback.ts](../../api/auth/google/callback.ts), [api/_lib/security.ts](../../api/_lib/security.ts), [src/server/security.test.ts](../../src/server/security.test.ts), [scripts/server-esm.test.mjs](../../scripts/server-esm.test.mjs).

## Sitzung und CSRF

Das Session-Cookie heißt `finance_session`, ist `HttpOnly`, `SameSite=Lax`, auf `/` begrenzt und in Produktion `Secure`. Sein signierter Inhalt bindet Google-`sub`, normalisierte E-Mail, CSRF-Token sowie Ausgabe/Ablauf. Jeder authentifizierte Endpunkt prüft Signatur und die konfigurierte `ALLOWED_GOOGLE_EMAIL` erneut.

Schreibende Aktionen (`PUT /api/google/spreadsheet`, Logout, Disconnect) verlangen den CSRF-Wert aus der Sitzung im Header `x-csrf-token` und eine exakte `Origin`, die `APP_ORIGIN` entspricht. Antworten tragen `Cache-Control: no-store`. Die vollständige Methoden-/Antworttabelle steht ausschließlich in der [API-Referenz](../referenz/api.md).

## Google Picker, Drive und Sheets

Nach authentifizierter Anfrage erzeugt der Server über das gespeicherte Refresh-Token ein kurzes Access-Token und liefert es nur an die Picker-Konfiguration. Der Picker filtert auf eine native Google-Sheets-Datei. Die Auswahl-ID ist trotzdem untrusted: Der Server validiert sie mit Drive (`id`, `name`, MIME-Typ) und liest erst danach die zehn Bereiche via Sheets `batchGet`.

Der Scope `drive.file` beschränkt den Zugriff auf mit der App geöffnete/ausgewählte Dateien. Die App schreibt keine Sheets-Werte. Eine Tabellen-ID wird erst nach vollständiger MIME-, Tab-, Header-, Werte-, Fremdschlüssel- und Snapshot-Prüfung gespeichert.

## Token-Schutz

Refresh-Token werden mit AES-256-GCM verschlüsselt. Eine zufällige Nonce und Auth-Tag erkennen Manipulation; die Google-Subjekt-ID ist Additional Authenticated Data und bindet das Chiffrat an den Datensatz. `TOKEN_ENCRYPTION_KEY` muss Base64-kodiert genau 32 Byte ergeben. Rotation erfordert derzeit erneute Verbindung oder eine bewusste Migration, weil kein Keyring implementiert ist.

Der Picker-Access-Token ist kurzlebig und wird nicht persistiert. Client-Secret, Datenbank-URL, Token-Schlüssel und Session-Secret werden nie an den Browser ausgeliefert. Die Picker-API-Key und Client-ID sind öffentliche Identifikatoren, müssen aber auf API/Referrer eingeschränkt werden.

## Fehlerfälle

Widerrufene oder abgelaufene Google-Grants werden als `reconnect_required` abgebildet. Eine ungültige Tabelle ergibt 422 mit strukturierten Issues. Fehlende Verbindung oder Auswahl ergibt 409. Unbekannte Serverfehler werden auf eine generische Meldung reduziert. Beim Disconnect wird die Postgres-Verbindung in `finally` gelöscht, selbst wenn die Google-Widerruf-Anfrage fehlschlägt.

## Sicherheitsannahmen und Grenzen

- Betreiber, Vercel-Projekt und Secret Store gelten als vertrauenswürdig.
- Das Modell verhindert keinen Schaden bei kompromittiertem Server plus Secrets.
- Single-User ist eine harte Zugriffspolitik, keine generische Mandantentrennung.
- Lokaler Cache liegt außerhalb der Serververschlüsselung.
- Origin-/CSRF-Schutz ersetzt keine XSS-Prävention; React-Escaping und zurückhaltende Abhängigkeiten bleiben wichtig.
- Es existiert derzeit kein dediziertes Rate-Limit; die Bewertung steht in der Roadmap.

## Begründung und Nachweis

Für den aktuellen Übergangsstand siehe die ersetzte [ADR 0003](../entscheidungen/0003-serverseitiger-google-zugriff-und-drive-file.md). Das Zielbild steht in [ADR 0013](../entscheidungen/0013-postgresql-als-finanzquelle.md) und [ADR 0014](../entscheidungen/0014-google-oauth-nur-als-identitaet.md); [ADR 0004](../entscheidungen/0004-single-user-sicherheitsmodell.md) bleibt gültig.

- Konfiguration: [api/_lib/config.ts](../../api/_lib/config.ts)
- HTTP-Grenze: [api/_lib/http.ts](../../api/_lib/http.ts)
- Google-Client: [api/_lib/google.ts](../../api/_lib/google.ts)
- Finance-Service: [api/_lib/financeService.ts](../../api/_lib/financeService.ts)
- Server-Tests: [src/server](../../src/server)
