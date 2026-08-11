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

## Browser-/Entwicklungsvariable

| Variable | Vertrag |
| --- | --- |
| `VITE_USE_MOCK_API` | optional; nur exakt `true`, Vite Development und `import.meta.env.DEV` aktivieren anonyme Mock-API |

Jede `VITE_`-Variable wird grundsätzlich als browseröffentlich behandelt. Niemals Secret, Token, Datenbank-URL oder persönliche Finanzdaten mit diesem Präfix setzen.

## Konsistenzregeln

Wenn `APP_ORIGIN=https://accura.example` lautet, muss der Callback `https://accura.example/api/auth/google/callback` lauten. Preview-URLs benötigen entweder bewusst eigene Google-Redirect-Einträge und passende Variablen oder dürfen den realen OAuth-Fluss nicht verwenden. Development und Production sollten eigene Datenbank/Secrets nutzen.

## Rotation

Die Folgen von Schlüsselrotation stehen im [Produktions-Setup](../anleitungen/produktions-setup.md#secret-rotation). Besonders wichtig: Ohne Keyring kann ein neuer `TOKEN_ENCRYPTION_KEY` alte Token nicht lesen. `SESSION_SECRET` invalidiert bestehende Sessions unmittelbar.

## Implementierung und Tests

- Vorlage: [.env.example](../../.env.example)
- Parser/Validierung: [api/_lib/config.ts](../../api/_lib/config.ts)
- Tests: [src/server/config.test.ts](../../src/server/config.test.ts)
