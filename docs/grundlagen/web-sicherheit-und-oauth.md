# Grundlagen: Web-Sicherheit und OAuth

> **Zielgruppe:** Junior-Entwickler und technische Betreiber.
> **Zweck und Lernziel:** OAuth, PKCE, CSRF, Cookies, Origin und Vertrauensgrenzen verstehen.
> **Voraussetzungen:** [Web und PWA](web-und-pwa.md)
> **Kanonisch für:** Allgemeine Sicherheits- und OAuth-Begriffe dieser Dokumentation.
> **Verwandte Dokumente:** [Backend und Sicherheit](../architektur/backend-und-sicherheit.md), [Produktions-Setup](../anleitungen/produktions-setup.md)

## Mentales Modell

OAuth delegiert begrenzten Zugriff: Der Nutzer bestätigt bei Google, dass `accura` ausgewählte Drive-Dateien verwenden darf. Das Google-Passwort wird nie an `accura` übermittelt. Ein Authorization Code gelangt zum Server und wird dort gegen Token getauscht.

**State** bindet Callback und gestartete Anmeldung zusammen und erschwert Login-CSRF. **Nonce** bindet das ID-Token an die Transaktion. **PKCE** bindet den Authorization Code an einen zuvor erzeugten geheimen Verifier. Das Refresh-Token erlaubt spätere Access-Token und ist deshalb ein langlebiges Server-Secret.

CSRF ist das Auslösen einer authentifizierten Aktion aus einer fremden Website. `SameSite=Lax`-Cookies helfen, reichen aber für schreibende Endpunkte nicht als einziger Vertrag. `accura` verlangt zusätzlich einen zur signierten Sitzung gehörenden CSRF-Header und die exakte konfigurierte Origin.

## Sicherheitsprinzipien

- Geheimnisse bleiben serverseitig und erhalten nie ein `VITE_`-Präfix.
- Eingaben werden an jeder Grenze validiert; Fehlermeldungen geben keine internen Geheimnisse preis.
- Least Privilege: `drive.file` statt vollständigem Drive-Zugriff.
- Single-User-Allowlist wird serverseitig anhand verifizierter E-Mail geprüft.
- Token werden bei Speicherung mit AES-256-GCM verschlüsselt und an die Google-Subjekt-ID gebunden.
- HTTPS ist in Produktion Pflicht; Cookie-Flags und genaue Redirect-URIs hängen davon ab.

## Was nicht garantiert wird

OAuth ist keine lokale Datenverschlüsselung. CSRF-Schutz verhindert nicht XSS. Tokenverschlüsselung schützt nicht gegen einen vollständig kompromittierten Server samt Schlüssel. `drive.file` begrenzt die sichtbaren Dateien, ersetzt aber nicht die serverseitige MIME- und Schemaprüfung.

## Implementierung und Tests

- OAuth-Start/Callback: [api/auth/google/start.ts](../../api/auth/google/start.ts), [api/auth/google/callback.ts](../../api/auth/google/callback.ts)
- Sicherheitsprimitive: [api/_lib/security.ts](../../api/_lib/security.ts)
- Origin/CSRF-Grenze: [api/_lib/http.ts](../../api/_lib/http.ts)
- Tests: [src/server/security.test.ts](../../src/server/security.test.ts), [scripts/server-esm.test.mjs](../../scripts/server-esm.test.mjs)

Primärquellen: [OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700), [PKCE](https://www.rfc-editor.org/rfc/rfc7636), [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
