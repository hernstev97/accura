# Produktions-Setup

> **Zielgruppe:** Eigentümer und Betreiber der privaten App.
> **Zweck und Lernziel:** Google, PostgreSQL, Vercel und Secrets reproduzierbar für Entwicklung und Produktion einrichten.
> **Voraussetzungen:** Google-Cloud-, Vercel- und PostgreSQL-Zugriff; eigene Domain/Deployment-URL; [Konfigurationsreferenz](../referenz/konfiguration.md)
> **Kanonisch für:** Externe Einrichtung und produktive Inbetriebnahme.
> **Verwandte Dokumente:** [Backend und Sicherheit](../architektur/backend-und-sicherheit.md), [Datenbank](../referenz/datenbank.md), [Finance Data Schema v1](../referenz/finance-data-schema-v1.md)

Repository-Code kann externe Konten, APIs, Redirects, Datenbank und Secrets nicht selbst bereitstellen. Diese Schritte werden für Development und Production getrennt und mit anonymen beziehungsweise kopierten Testdaten abgenommen.

## 1. Google-Cloud-Projekt

1. Ein dediziertes Google-Cloud-Projekt erstellen oder auswählen.
2. Google Auth Platform als **External** konfigurieren. Im Testmodus die erlaubte Person als Test User eintragen.
3. Nur `openid`, `email` und `profile` anfordern.
4. Einen OAuth Client vom Typ **Web application** erstellen.
5. Exakte Origins eintragen, zum Beispiel `http://localhost:3000` und die HTTPS-Produktions-Origin.
6. Exakte Redirect-URIs eintragen: Origin plus `/api/auth/google/callback`; keine abweichenden Ports oder abschließenden Slashes.

Sheets-, Drive- und Picker-APIs werden nicht mehr benötigt. Das Client-Secret bleibt serverseitig.

## 2. PostgreSQL und Neon-Betrieb

Neon ist der aktuelle Betreiber; das Schema und der Anwendungscode setzen nur PostgreSQL voraus. Development und Production verwenden getrennte Neon-Datenbanken oder Branches. Preview-Deployments erhalten keine Produktionskopie und arbeiten ausschließlich mit synthetischen Daten.

### Verbindungsarten und Migration

Zwei getrennte Verbindungen verwenden:

- Vercel Functions erhalten die gepoolte Neon-URL als `DATABASE_URL`.
- Migrationen, Rollenverwaltung und Restore-Prüfungen verwenden einen direkten Neon-Endpoint mit administrativen Credentials. Diese URL ist kein Runtime-Secret der App.

Vor jedem Lauf Zielhost, Datenbank, Benutzer und Environment sichtbar prüfen. Migrationen zuerst in Development anwenden, dort die Integrationstests und einen vollständigen Reader-Durchlauf ausführen und erst danach Production getrennt beauftragen:

```bash
psql "$DATABASE_DIRECT_URL" -f migrations/001_google_connections.sql
psql "$DATABASE_DIRECT_URL" -f migrations/002_finance_data_v1.sql
psql "$DATABASE_DIRECT_URL" -f migrations/003_drop_google_connections.sql
```

`DATABASE_DIRECT_URL` ist hier nur ein Name für die administrative Shell-Variable und keine von der Anwendung gelesene Konfiguration. Das tatsächliche Anwenden auf eine externe Development- oder Production-Datenbank ist ein eigener ausdrücklicher Betriebsauftrag.

Für eine lokale dedizierte Testdatenbank oder den CI-Service gilt:

```bash
POSTGRES_TEST_URL=postgresql://... npm run test:postgres
```

Die Suite bricht ohne URL ab, legt unter der Ziel-Datenbank ein isoliertes synthetisches Testschema an, führt 001 und 002 aus und entfernt dieses Schema anschließend wieder. Niemals eine Produktions-URL als `POSTGRES_TEST_URL` verwenden.

### Runtime-Rolle

Direkte Owner-/Migrations-Credentials dürfen nicht als `DATABASE_URL` verwendet werden. Die Runtime-Rolle benötigt:

- `SELECT` auf `owners` und allen Finance-Tabellen;
- keine DDL-, Rollenverwaltungs- oder Schema-Owner-Rechte;
- keine pauschalen Finance-Schreibrechte. Der Operator-Import und der spätere Editor verwenden einen administrativen beziehungsweise bewusst erweiterten Zugang.

Die konkrete `GRANT`-Konfiguration wird pro Datenbank mit dem administrativen direkten Endpoint angewandt und anschließend durch Anmeldung und einen Finance-Read mit synthetischem Owner geprüft.

### Region

Vor Production-Migration und Cutover werden die reale Neon-Region und die tatsächlich ausgeführte Vercel-Functions-Region im jeweiligen Dashboard geprüft. Ziel ist eine sinnvolle gemeinsame EU-Region. Ohne diesen Befund wird keine Region blind in `vercel.json` eingetragen. Gemessene Latenz und der gewählte Stand gehören ins private Betriebsprotokoll, nicht als vermutete Werte ins Repository.

### Backup und Restore vor dem privaten Import

Vor dem Import privater Daten sind folgende Punkte verpflichtend:

1. Ein für die privaten Daten ausreichendes Neon-Restore-Fenster und ein geeigneter Tarif sind aktiv.
2. Ein Restore wird mit ausschließlich synthetischen Development-Daten praktisch durchgeführt.
3. Auf dem wiederhergestellten Stand werden Migrationstabellen beziehungsweise Schema-Constraints geprüft.
4. `npm run test:postgres` läuft gegen eine dafür vorgesehene Testdatenbank; anschließend wird ein vollständiger `FinanceDataV1` über das Repository gelesen.
5. Dauer, Verantwortlicher, Ziel, Ergebnis und Rückkehrschritte werden im privaten Betriebsprotokoll festgehalten.

Das Repository automatisiert weder Neon-Restore noch externe Migrationen. Schema und Constraint-Vertrag stehen vollständig unter [Datenbank](../referenz/datenbank.md).

## 3. Secrets erzeugen

Unabhängige Werte erzeugen und nur im Vercel-/lokalen Secret Store ablegen:

```bash
openssl rand -base64 48
```

Der Wert eignet sich als starkes `SESSION_SECRET`. Nicht wiederverwenden, nicht in Shell-Historie kopieren, wenn diese geteilt wird, und nie in Git, Screenshots oder `VITE_`-Variablen ablegen.

## 4. Umgebungsvariablen

Alle Werte aus [.env.example](../../.env.example) in Vercel für Development und Production mit korrektem Scope setzen. Die vollständige Bedeutung und Validierung steht ausschließlich in der [Konfigurationsreferenz](../referenz/konfiguration.md).

Wichtig:

- `APP_ORIGIN` ist exakt die kanonische Origin ohne abschließenden Slash.
- `GOOGLE_OAUTH_REDIRECT_URI` hat dieselbe Origin und exakt den Pfad `/api/auth/google/callback`.
- Produktion benötigt HTTPS.
- `ALLOWED_GOOGLE_EMAIL` enthält genau die verifizierte Eigentümeradresse.
- Development- und Production-Schlüssel sollten verschieden sein.

## 5. Finance-Import

Den ersten Datenstand außerhalb der App importieren. Für lokale oder synthetische Tests:

```bash
GOOGLE_SUB=replace-with-google-sub DATABASE_URL="$DATABASE_DIRECT_URL" npm run import:finance -- --from-fixture
```

Für den privaten Bestand eine lokale, nicht versionierte JSON-Datei im Sheets-batchGet-Format oder als `FinanceDataV1` verwenden und `--from-file=` setzen. Die Datei darf nicht ins Repository. `salary_day` und `due_day` sind optionale v1-Felder; ohne sie bleibt der Stand gültig, Demnächst kann die entsprechende Projektion jedoch nicht vollständig bilden.

## 6. Lokale Realabnahme

```bash
npx vercel link
npx vercel env pull .env.local --environment=development
npx vercel dev --listen 3000
```

Mit der allowgelisteten Adresse anmelden. Der Finanzstand kommt aus PostgreSQL; ohne vorherigen Import zeigt die App „Finanzstand fehlt“.

## 7. Deployment und Produktionsabnahme

Nach grünen Prüfungen über den eigentümerkontrollierten Vercel-Workflow deployen. Vor der ersten echten Nutzung einzeln prüfen:

- Live-Anmeldung und Zurückleitung ohne `auth_error`;
- vorhandener Import erscheint nach der Anmeldung;
- fehlender Import zeigt „Finanzstand fehlt“;
- manueller Refresh;
- Offline-Reload nach erfolgreichem Sync;
- `/`, `/demnaechst`, `/budget` und `/schulden` jeweils direkt in einem neuen Browserkontext sowie nach Reload;
- unbekannten Pfad prüfen: kontrollierter Wechsel auf `/`, keine API- oder Asset-Umleitung auf die App-Shell;
- Browser-Zurück/Vorwärts über alle vier Hauptansichten und OAuth-Rückkehr zum vorherigen Pfad;
- installierte Android-PWA kalt aus jedem zuletzt verwendeten Hauptscreen starten und mehrfach systemseitig zurücknavigieren;
- Logout gegenüber erneuter Anmeldung, ohne den PostgreSQL-Stand zu löschen;
- Privacy und Appearance bleiben über Logout erhalten.
- der Info-Dialog verlinkt auf den vollständigen Commit-SHA des tatsächlich betriebenen Stands sowie dessen `LICENSE` und `TRADEMARKS.md`;
- `/THIRD_PARTY_NOTICES.txt` ist online und nach einmaligem Laden auch offline erreichbar.

## Secret-Rotation

- `SESSION_SECRET`: bestehende Sitzungen und OAuth-Transaktionen werden ungültig; kontrolliert wechseln und neu anmelden.
- Google Client Secret: Google- und Vercel-Konfiguration gemeinsam aktualisieren; Redirects erneut testen.
- `DATABASE_URL`: gepoolte Runtime-URL; Erreichbarkeit, eingeschränkte Rolle und Ziel-Environment prüfen, bevor der Appwert umgestellt wird.

## Nachweis und Fehlerdiagnose

- Setupfehler: [Fehlerdiagnose](fehlerdiagnose.md)
- Sicherheitsfluss: [Backend und Sicherheit](../architektur/backend-und-sicherheit.md)
- Releaseprüfungen: [Testen und Release](testen-und-release.md)
- Implementierung: [api/_lib/config.ts](../../api/_lib/config.ts), [api/_lib/database.ts](../../api/_lib/database.ts), [api/auth/google](../../api/auth/google), [Migrationen](../../migrations)
