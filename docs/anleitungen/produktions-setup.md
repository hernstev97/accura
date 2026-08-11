# Produktions-Setup

> **Zielgruppe:** Eigentümer und Betreiber der privaten App.
> **Zweck und Lernziel:** Google, PostgreSQL, Vercel und Secrets reproduzierbar für Entwicklung und Produktion einrichten.
> **Voraussetzungen:** Google-Cloud-, Vercel- und PostgreSQL-Zugriff; eigene Domain/Deployment-URL; [Konfigurationsreferenz](../referenz/konfiguration.md)
> **Kanonisch für:** Externe Einrichtung und produktive Inbetriebnahme.
> **Verwandte Dokumente:** [Backend und Sicherheit](../architektur/backend-und-sicherheit.md), [Datenbank](../referenz/datenbank.md), [Finance Data Schema v1](../referenz/finance-data-schema-v1.md)

Repository-Code kann externe Konten, APIs, Redirects, Datenbank und Secrets nicht selbst bereitstellen. Diese Schritte werden für Development und Production getrennt und mit anonymen beziehungsweise kopierten Testdaten abgenommen.

## 1. Google-Cloud-Projekt

1. Ein dediziertes Google-Cloud-Projekt erstellen oder auswählen und die numerische Projektnummer notieren.
2. Google Sheets API, Google Drive API und Google Picker API aktivieren.
3. Google Auth Platform als **External** konfigurieren. Im Testmodus die erlaubte Person als Test User eintragen.
4. Nur `openid`, `email`, `profile` und `https://www.googleapis.com/auth/drive.file` anfordern.
5. Einen OAuth Client vom Typ **Web application** erstellen.
6. Exakte Origins eintragen, zum Beispiel `http://localhost:3000` und die HTTPS-Produktions-Origin.
7. Exakte Redirect-URIs eintragen: Origin plus `/api/auth/google/callback`; keine abweichenden Ports oder abschließenden Slashes.
8. Einen API-Key für Picker erstellen und auf Google Picker API sowie die exakten HTTP-Referrer einschränken.

`GOOGLE_CLOUD_PROJECT_NUMBER` ist die numerische Nummer, nicht die textuelle Projekt-ID. OAuth Client ID und Picker-Key sind browserlesbare Identifikatoren, aber ihre Einschränkungen bleiben sicherheitsrelevant. Das Client-Secret bleibt serverseitig.

## 2. PostgreSQL

Eine gepoolte PostgreSQL-Verbindung bereitstellen; für Vercel eignet sich ein kompatibler Marketplace-Anbieter wie Neon. Die gepoolte URL als `DATABASE_URL` verwenden. Migration zuerst bewusst in Development und erst nach Prüfung in Production anwenden:

```bash
psql "$DATABASE_URL" -f migrations/001_google_connections.sql
```

Vor Ausführung Zielhost und Datenbanknamen prüfen. Die Migration ist idempotent angelegt, aber Datenbankänderungen bleiben Betreiberverantwortung. Schema und Rotation stehen unter [Datenbank](../referenz/datenbank.md).

## 3. Secrets erzeugen

Unabhängige Werte erzeugen und nur im Vercel-/lokalen Secret Store ablegen:

```bash
openssl rand -base64 32
openssl rand -base64 48
```

Der erste Wert eignet sich als 32-Byte-`TOKEN_ENCRYPTION_KEY`; der zweite als starkes `SESSION_SECRET`. Nicht wiederverwenden, nicht in Shell-Historie kopieren, wenn diese geteilt wird, und nie in Git, Screenshots oder `VITE_`-Variablen ablegen.

## 4. Umgebungsvariablen

Alle Werte aus [.env.example](../../.env.example) in Vercel für Development und Production mit korrektem Scope setzen. Die vollständige Bedeutung und Validierung steht ausschließlich in der [Konfigurationsreferenz](../referenz/konfiguration.md).

Wichtig:

- `APP_ORIGIN` ist exakt die kanonische Origin ohne abschließenden Slash.
- `GOOGLE_OAUTH_REDIRECT_URI` hat dieselbe Origin und exakt den Pfad `/api/auth/google/callback`.
- Produktion benötigt HTTPS.
- `ALLOWED_GOOGLE_EMAIL` enthält genau die verifizierte Eigentümeradresse.
- Development- und Production-Schlüssel sollten verschieden sein.

## 5. Finance-Workbook

Eine Google-Tabelle mit allen zehn exakten underscore-präfigierten Tabs des [Finance Data Schema v1](../referenz/finance-data-schema-v1.md) anlegen. Für den ersten Durchlauf eine Kopie mit anonymen oder nicht sensitiven Werten verwenden. `salary_day` und `due_day` sind optionale v1-Erweiterungsspalten; ohne sie bleibt das Workbook gültig, Demnächst kann die entsprechende Projektion jedoch nicht vollständig bilden.

## 6. Lokale Realabnahme

```bash
npx vercel link
npx vercel env pull .env.local --environment=development
npx vercel dev --listen 3000
```

Mit der allowgelisteten Adresse anmelden, Consent vollständig bestätigen und die kopierte Tabelle auswählen. Falls Google kein Refresh-Token liefert, den bestehenden App-Grant im Google-Konto entfernen und die Verbindung mit `prompt=consent` neu aufbauen.

## 7. Deployment und Produktionsabnahme

Nach grünen Prüfungen über den eigentümerkontrollierten Vercel-Workflow deployen. Vor der ersten echten Nutzung einzeln prüfen:

- Live-Anmeldung und Zurückleitung ohne `auth_error`;
- Picker zeigt Sheets und akzeptiert genau eine Datei;
- Tabellenprüfung, erster Sync und manueller Refresh;
- Wechsel auf eine zweite Testtabelle und zurück;
- Offline-Reload nach erfolgreichem Sync;
- Logout gegenüber erneuter Anmeldung;
- Disconnect löscht Serververbindung und lokalen Finance-Cache;
- Wiederverbinden und erneute Auswahl;
- Privacy und Appearance bleiben über Logout/Disconnect erhalten.

Google-OAuth-Apps im External-Testmodus können Grants mit nicht ausschließlich Basisprofil-Scopes nach sieben Tagen verlieren. Vor Dauerbetrieb den Veröffentlichungsstatus passend konfigurieren und danach bewusst neu verbinden.

## Secret-Rotation

- `SESSION_SECRET`: bestehende Sitzungen und OAuth-Transaktionen werden ungültig; kontrolliert wechseln und neu anmelden.
- `TOKEN_ENCRYPTION_KEY`: vorhandene Refresh-Token sind ohne alten Schlüssel nicht entschlüsselbar. Aktuell gibt es keinen Keyring; Verbindung vor/nach koordiniertem Wechsel löschen und neu autorisieren oder eine explizite Migration bauen.
- Google Client Secret/API-Key: Google- und Vercel-Konfiguration gemeinsam aktualisieren; Referrer/Redirects erneut testen.
- `DATABASE_URL`: Migration und Erreichbarkeit im Ziel prüfen, bevor der Appwert umgestellt wird.

## Nachweis und Fehlerdiagnose

- Setupfehler: [Fehlerdiagnose](fehlerdiagnose.md)
- Sicherheitsfluss: [Backend und Sicherheit](../architektur/backend-und-sicherheit.md)
- Releaseprüfungen: [Testen und Release](testen-und-release.md)
- Implementierung: [api/_lib/config.ts](../../api/_lib/config.ts), [api/auth/google](../../api/auth/google), [migrations/001_google_connections.sql](../../migrations/001_google_connections.sql)
