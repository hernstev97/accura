# Datenbankreferenz

> **Zielgruppe:** Betreiber und Backend-Entwickler.
> **Zweck und Lernziel:** PostgreSQL-Schema, gespeicherte Daten und Lebenszyklus der Google-Verbindung verstehen.
> **Voraussetzungen:** PostgreSQL-Grundkenntnisse und [Backend und Sicherheit](../architektur/backend-und-sicherheit.md)
> **Kanonisch für:** Tabelle `google_connections` und deren Datenvertrag.
> **Verwandte Dokumente:** [Produktions-Setup](../anleitungen/produktions-setup.md), [Konfiguration](konfiguration.md)

`accura` besitzt genau eine Migration und speichert keine Finanzzeilen in PostgreSQL. Die Tabelle hält die serverseitige Google-Verbindung und optionale Referenz auf das gewählte Sheet.

## Tabelle `google_connections`

| Spalte | Typ | Null? | Bedeutung |
| --- | --- | --- | --- |
| `google_sub` | `TEXT` | nein | Primärschlüssel, stabile Google-Subjekt-ID |
| `verified_email` | `TEXT` | nein | beim ID-Token verifizierte, normalisierte E-Mail |
| `encrypted_refresh_token` | `TEXT` | nein | versioniertes AES-256-GCM-Chiffrat, kein Klartext |
| `granted_scopes` | `TEXT[]` | nein | beim OAuth-Tausch gemeldete Scopes |
| `spreadsheet_id` | `TEXT` | ja | ausgewählte und geprüfte Drive-Datei |
| `spreadsheet_name` | `TEXT` | ja | zum Auswahlzeitpunkt gelesener Dateiname |
| `created_at` | `TIMESTAMPTZ` | nein | Erzeugung, Default `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | nein | letzte allgemeine Änderung |
| `token_updated_at` | `TIMESTAMPTZ` | nein | letzte Authorization-Aktualisierung |
| `spreadsheet_updated_at` | `TIMESTAMPTZ` | ja | letzte Auswahländerung |

Ein Check Constraint erzwingt, dass `spreadsheet_id` und `spreadsheet_name` entweder beide `NULL` oder beide gesetzt sind. Zusätzlich verhindert ein eindeutiger Index auf `LOWER(verified_email)` mehrere Verbindungen derselben Adresse. `google_sub` bleibt der technische Schlüssel.

## Schreibpfade

- OAuth-Callback führt `INSERT … ON CONFLICT (google_sub) DO UPDATE` für E-Mail, Token und Scopes aus; eine bestehende Tabellenauswahl bleibt erhalten.
- Erfolgreiche Picker-/Schemaprüfung aktualisiert ID, Name und Zeitstempel.
- Disconnect löscht die Zeile. Logout ändert die Datenbank nicht.
- Finance-Reads sind nur `SELECT`; Tabellenwerte selbst kommen direkt aus Google Sheets.

## Migration und Backup

Die Migration [001_google_connections.sql](../../migrations/001_google_connections.sql) läuft in einer Transaktion und nutzt `IF NOT EXISTS`. Sie muss je Environment bewusst angewandt werden. Backups enthalten sensible verschlüsselte Token und sind wie Secrets zu behandeln. Wiederherstellung benötigt denselben `TOKEN_ENCRYPTION_KEY`; ohne ihn ist erneutes OAuth erforderlich.

## Grenzen

Das Schema ist auf Single-User-Betrieb ausgerichtet, auch wenn die Tabelle technisch mehrere Subs aufnehmen könnte. Anwendung und Allowlist erlauben genau eine E-Mail. Es gibt keine Finance-Historie, Audit-Events oder Mandanten-ID in PostgreSQL.

## Implementierung und Tests

- Migration: [migrations/001_google_connections.sql](../../migrations/001_google_connections.sql)
- Repository: [api/_lib/repository.ts](../../api/_lib/repository.ts)
- Server-Service-Tests: [src/server/financeService.test.ts](../../src/server/financeService.test.ts)
