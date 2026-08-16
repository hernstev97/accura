# Konfigurationsreferenz

> **Zielgruppe:** Betreiber und Backend-Entwickler.
> **Zweck und Lernziel:** Jede Umgebungsvariable korrekt klassifizieren, setzen und validieren.
> **Voraussetzungen:** [Produktions-Setup](../anleitungen/produktions-setup.md)
> **Kanonisch für:** Umgebungsvariablen und Konfigurationsvalidierung.
> **Verwandte Dokumente:** [Backend und Sicherheit](../architektur/backend-und-sicherheit.md), [Fehlerdiagnose](../anleitungen/fehlerdiagnose.md)

## Servervariablen

| Variable | Geheim? | Vertrag |
| --- | --- | --- |
| `APP_ORIGIN` | nein | absolute kanonische Origin ohne Pfad/abschließenden Slash; in Produktion HTTPS |
| `GOOGLE_CLIENT_ID` | nein | OAuth-Web-Client-ID für die Identitätsanmeldung |
| `GOOGLE_CLIENT_SECRET` | ja | OAuth-Web-Client-Secret, nur Server |
| `GOOGLE_OAUTH_REDIRECT_URI` | nein | absolute URL mit derselben Origin wie `APP_ORIGIN` und exakt `/api/auth/google/callback` |
| `ALLOWED_GOOGLE_EMAIL` | personenbezogene Zugriffspolitik | gültige E-Mail; wird kleingeschrieben und bei Callback sowie Sitzung geprüft |
| `DATABASE_URL` | ja | gepoolte PostgreSQL-Verbindungs-URL |
| `SESSION_SECRET` | ja | mindestens 32 UTF-8-Byte für HMAC-signierte OAuth-/Sessiontokens |

Alle Variablen sind serverseitig erforderlich. Produktion im Sinne von HTTPS und `Secure`-Cookies gilt nur bei `VERCEL_ENV=production` und nicht für `localhost`. `vercel dev` setzt oft `NODE_ENV=production`; das allein darf eine lokale HTTP-Origin nicht verwerfen.

Der Operator-Import akzeptiert keine Google-Subjekt-ID als Umgebungsvariable. Die verifizierte Anmeldung legt den Owner serverseitig an; der Single-Owner-Import verweigert eine fehlende oder mehrdeutige Zuordnung.

## Öffentliche Build- und Entwicklungsvariablen

| Variable | Vertrag |
| --- | --- |
| `VITE_USE_MOCK_API` | optionaler lokaler Schalter; nur exakt `true` zusammen mit Vite Development aktiviert die anonyme Mock-API |
| `VITE_VERCEL_ENV` | öffentliche Vercel-Systemvariable; exakt `preview` aktiviert automatisch die anonyme Mock-API, `production` niemals |
| `ACCURA_SOURCE_REPOSITORY_URL` | optionaler Build-Override; vollständige GitHub-Repository-URL, nur gemeinsam mit `ACCURA_SOURCE_COMMIT_SHA` |
| `ACCURA_SOURCE_COMMIT_SHA` | optionaler Build-Override; vollständiger 40-stelliger Git-Commit-SHA, nur gemeinsam mit `ACCURA_SOURCE_REPOSITORY_URL` |
| `VITE_VERCEL_GIT_REPO_OWNER` | öffentlicher, von Vercel bereitgestellter Repository-Owner für den versionsgebundenen Source-Link |
| `VITE_VERCEL_GIT_REPO_SLUG` | öffentlicher, von Vercel bereitgestellter Repository-Name für den versionsgebundenen Source-Link |
| `VITE_VERCEL_GIT_COMMIT_SHA` | öffentlicher, vollständiger Vercel-Deployment-Commit für den versionsgebundenen Source-Link |

`POSTGRES_TEST_URL` ist eine ausschließlich für `npm run test:postgres` gelesene Testprozess-Variable. Sie muss auf eine dedizierte temporäre oder lokale PostgreSQL-Datenbank mit Schema-Erzeugungsrecht zeigen, ist kein Vercel-Runtime-Wert und darf niemals eine Production-URL enthalten. Ohne sie bricht die dedizierte Suite absichtlich ab; `npm test` benötigt sie nicht.

Jede `VITE_`-Variable wird grundsätzlich als browseröffentlich behandelt. Niemals Secret, Token, Datenbank-URL oder persönliche Finanzdaten mit diesem Präfix setzen. Vercels automatische Systemvariablen müssen für das Projekt aktiviert bleiben, damit Preview-Builds eindeutig erkannt werden.

Explizite `ACCURA_SOURCE_*`-Overrides haben Vorrang vor den Vercel-Git-Werten. Ohne beide Quellen verwendet ein lokaler Build `git rev-parse HEAD`. Ein Produktionsbuild ohne gültigen vollständigen SHA bricht ab; ausschließlich der Dev-Server darf auf `master` zurückfallen. Repository-URL, vollständiger SHA, Kurz-SHA und daraus abgeleitete Rechtslinks werden als öffentliche Konstanten in das Browser-Bundle eingebettet und enthalten keine Geheimnisse.

## Konsistenzregeln

Wenn `APP_ORIGIN=https://accura.example` lautet, muss der Callback `https://accura.example/api/auth/google/callback` lauten. Die Vercel-Preview verwendet ausschließlich anonyme Mock-Daten und darf keine produktiven Google- oder PostgreSQL-Secrets benötigen. Ein zukünftiges reales Integrationsenvironment müsste bewusst eigene Redirect-Einträge, Datenbank und Secrets erhalten.

## Rotation

Die Folgen von Schlüsselrotation stehen im [Produktions-Setup](../anleitungen/produktions-setup.md#secret-rotation). `SESSION_SECRET` invalidiert bestehende Sessions unmittelbar.

## Implementierung und Tests

- Vorlage: [.env.example](../../.env.example)
- Parser/Validierung: [api/_lib/config.ts](../../api/_lib/config.ts)
- Tests: [src/server/config.test.ts](../../src/server/config.test.ts)
