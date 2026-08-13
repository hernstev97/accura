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
| `GOOGLE_CLIENT_ID` | nein | OAuth-Web-Client-ID; wird authentifiziert an Picker geliefert |
| `GOOGLE_CLIENT_SECRET` | ja | OAuth-Web-Client-Secret, nur Server |
| `GOOGLE_API_KEY` | nein, aber einschränken | Picker-Key, auf Picker API und exakte Referrer beschränken |
| `GOOGLE_CLOUD_PROJECT_NUMBER` | nein | ausschließlich Ziffern; Picker App ID, nicht Projektname |
| `GOOGLE_OAUTH_REDIRECT_URI` | nein | absolute URL mit derselben Origin wie `APP_ORIGIN` und exakt `/api/auth/google/callback` |
| `ALLOWED_GOOGLE_EMAIL` | personenbezogene Zugriffspolitik | gültige E-Mail; wird kleingeschrieben und bei Callback sowie Sitzung geprüft |
| `DATABASE_URL` | ja | gepoolte PostgreSQL-Verbindungs-URL |
| `TOKEN_ENCRYPTION_KEY` | ja | Base64-kodiert genau 32 Byte für AES-256-GCM |
| `SESSION_SECRET` | ja | mindestens 32 UTF-8-Byte für HMAC-signierte OAuth-/Sessiontokens |

Alle Variablen sind serverseitig erforderlich. `VERCEL_ENV=production` oder `NODE_ENV=production` aktiviert Produktion und damit HTTPS-Prüfung sowie `Secure`-Cookies.

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

Jede `VITE_`-Variable wird grundsätzlich als browseröffentlich behandelt. Niemals Secret, Token, Datenbank-URL oder persönliche Finanzdaten mit diesem Präfix setzen. Vercels automatische Systemvariablen müssen für das Projekt aktiviert bleiben, damit Preview-Builds eindeutig erkannt werden.

Explizite `ACCURA_SOURCE_*`-Overrides haben Vorrang vor den Vercel-Git-Werten. Ohne beide Quellen verwendet ein lokaler Build `git rev-parse HEAD`. Ein Produktionsbuild ohne gültigen vollständigen SHA bricht ab; ausschließlich der Dev-Server darf auf `master` zurückfallen. Repository-URL, vollständiger SHA, Kurz-SHA und daraus abgeleitete Rechtslinks werden als öffentliche Konstanten in das Browser-Bundle eingebettet und enthalten keine Geheimnisse.

## Konsistenzregeln

Wenn `APP_ORIGIN=https://accura.example` lautet, muss der Callback `https://accura.example/api/auth/google/callback` lauten. Die Vercel-Preview verwendet ausschließlich anonyme Mock-Daten und darf keine produktiven Google- oder PostgreSQL-Secrets benötigen. Ein zukünftiges reales Integrationsenvironment müsste bewusst eigene Redirect-Einträge, Datenbank und Secrets erhalten.

## Rotation

Die Folgen von Schlüsselrotation stehen im [Produktions-Setup](../anleitungen/produktions-setup.md#secret-rotation). Besonders wichtig: Ohne Keyring kann ein neuer `TOKEN_ENCRYPTION_KEY` alte Token nicht lesen. `SESSION_SECRET` invalidiert bestehende Sessions unmittelbar.

## Implementierung und Tests

- Vorlage: [.env.example](../../.env.example)
- Parser/Validierung: [api/_lib/config.ts](../../api/_lib/config.ts)
- Tests: [src/server/config.test.ts](../../src/server/config.test.ts)
