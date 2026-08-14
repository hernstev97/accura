# Datenbankreferenz

> **Zielgruppe:** Betreiber und Backend-Entwickler.
> **Zweck und Lernziel:** PostgreSQL-Schema, Owner-Isolation, Constraints und Betriebsgrenzen verstehen.
> **Voraussetzungen:** PostgreSQL-Grundkenntnisse und [Backend und Sicherheit](../architektur/backend-und-sicherheit.md)
> **Kanonisch für:** Migrationen 001/002, `google_connections` und das ownergebundene Finance-v1-Schema.
> **Verwandte Dokumente:** [Produktions-Setup](../anleitungen/produktions-setup.md), [Finance Data Schema v1](finance-data-schema-v1.md)

`accura` besitzt zwei transaktionale Migrationen. [001_google_connections.sql](../../migrations/001_google_connections.sql) speichert die Google-Verbindung. [002_finance_data_v1.sql](../../migrations/002_finance_data_v1.sql) bildet sämtliche Quellenfelder aus `FinanceDataV1` relational ab. Das Finance-Repository ist implementiert und getestet, `/api/finance` liest bis zum späteren Cutover aber weiterhin Google Sheets.

## Owner-Modell

`owners` trennt externe Identität und interne Datenzuordnung:

| Spalte | Typ | Null? | Vertrag |
| --- | --- | --- | --- |
| `id` | `UUID` | nein | Primärschlüssel, Default `gen_random_uuid()` |
| `google_sub` | `TEXT` | nein | eindeutig, nach Trimmung nicht leer |
| `created_at` | `TIMESTAMPTZ` | nein | Default `NOW()` |

Es besteht absichtlich kein Foreign Key zu `google_connections`. Disconnect darf Finanzdaten nicht löschen. In ACC-71 erzeugt OAuth keinen Owner; erst der kontrollierte Import aus ACC-66 legt den produktiven Datensatz an. Der Reader nimmt ausschließlich Google `sub` aus der verifizierten Sitzung entgegen, löst intern `owners.id` auf und verwendet danach nur diese UUID.

Jede Finance-Tabelle besitzt ein nicht-nullbares `owner_id`. Fachliche Primär- und Fremdschlüssel enthalten den Owner, beispielsweise `(owner_id, id)` und `(owner_id, account_id)`. Gleiche fachliche IDs bei zwei Ownern sind damit erlaubt, eine Referenz über Ownergrenzen wird von PostgreSQL abgewiesen. Foreign Keys verwenden das Standardverhalten `NO ACTION`; es gibt keine stillen Lösch-Cascades.

## Gemeinsame Finance-Constraints

- Geld und Anzahlen werden als `BIGINT` gespeichert. Geld muss zwischen `-9007199254740991` und `9007199254740991` liegen; Anzahlen zusätzlich bei null oder höher.
- `display_order` ist ein sicherer Integer, darf negativ sein und muss nicht eindeutig sein.
- Fachliche IDs entsprechen lowercase-kebab-case. Namen, Labels und Ereignistexte sind nach Trimmung nicht leer; optionale Notizen sind `NULL` oder nach Trimmung nicht leer.
- `salary_day` und `due_day` sind `NULL` oder liegen zwischen 1 und 31.
- Enums sind `TEXT` plus `CHECK`, keine PostgreSQL-Enums. Negative Finanzbeträge bleiben erlaubt.
- Kalendertage sind `DATE`; nur echte Erzeugungs-/Änderungszeitpunkte sind `TIMESTAMPTZ`.
- Es werden weder aktuelle Stände noch Summen, `safeToSpend` oder andere Ableitungen gespeichert.

## Finance-Tabellen

| Tabelle | Spalten neben `owner_id` | Schlüssel und Beziehungen |
| --- | --- | --- |
| `finance_meta` | `schema_version`, `as_of`, `currency`, `monthly_income_cents`, `salary_day` | PK `owner_id`; FK zu `owners`; exakt Schema 1 und Währung `EUR` |
| `accounts` | `id`, `name`, `kind`, `display_order`, `active` | PK `(owner_id, id)`; `kind`: `bank`, `wallet`, `cash` |
| `account_snapshots` | `account_id`, `as_of`, `balance_cents` | PK `(owner_id, account_id, as_of)`; zusammengesetzter FK zu `accounts` |
| `pockets` | `id`, `account_id`, `name`, `display_order`, `active` | PK `(owner_id, id)`; zusammengesetzter FK `(owner_id, account_id)` zu `accounts` |
| `pocket_snapshots` | `pocket_id`, `as_of`, `balance_cents` | PK `(owner_id, pocket_id, as_of)`; zusammengesetzter FK zu `pockets` |
| `budget_items` | `id`, `label`, `monthly_amount_cents`, `necessity_id`, `kind`, `display_order`, `active`, `note`, `due_day` | PK `(owner_id, id)`; fünf Necessity-Werte; `kind`: `expense`, `reserve` |
| `debts` | `id`, `name`, `kind`, `monthly_payment_cents`, `display_order`, `active`, `note`, `due_day` | PK `(owner_id, id)`; `kind`: `loan`, `installment` |
| `debt_snapshots` | `debt_id`, `as_of`, `payoff_balance_cents`, `remaining_payment_count`, `remaining_scheduled_total_cents` | PK `(owner_id, debt_id, as_of)`; zusammengesetzter FK zu `debts` |
| `debt_milestones` | `debt_id`, `milestone_date`, `date_precision`, `balance_cents` | PK `(owner_id, debt_id, milestone_date, date_precision)`; zusammengesetzter FK zu `debts` |
| `relief_milestones` | interne `id`, `milestone_date`, `date_precision`, `monthly_relief_cents`, `event`, `event_detail` | PK `(owner_id, id)`; FK zu `owners`; fachlich gleiche Ereignisse bleiben erlaubt |

Die fünf gültigen `necessity_id`-Werte sind `essential`, `necessary`, `worthwhile`, `optional` und `unnecessary`. Reihenfolge-Indizes auf Accounts, Pockets, Budgetpositionen und Schulden unterstützen den deterministischen Reader, begründen aber keine fachliche Eindeutigkeit.

## Meilensteinpräzision

Debt- und Relief-Meilensteine speichern neben `milestone_date` eine `date_precision` mit `month` oder `day`. Bei `month` erzwingt ein Check den Monatsersten. Der Reader rekonstruiert daraus ohne Zeitzonenkonvertierung exakt `YYYY-MM` beziehungsweise `YYYY-MM-DD`. Die interne UUID eines Relief-Meilensteins verlässt die Persistenz nicht und erlaubt doppelte fachliche Ereignisse.

## Tabelle `google_connections`

| Spalte | Typ | Null? | Bedeutung |
| --- | --- | --- | --- |
| `google_sub` | `TEXT` | nein | Primärschlüssel, stabile Google-Subjekt-ID |
| `verified_email` | `TEXT` | nein | beim ID-Token verifizierte, normalisierte E-Mail |
| `encrypted_refresh_token` | `TEXT` | nein | versioniertes AES-256-GCM-Chiffrat, kein Klartext |
| `granted_scopes` | `TEXT[]` | nein | beim OAuth-Tausch gemeldete Scopes |
| `spreadsheet_id`, `spreadsheet_name` | `TEXT` | ja | gemeinsam gesetzte oder gemeinsam leere Auswahl |
| `created_at`, `updated_at`, `token_updated_at` | `TIMESTAMPTZ` | nein | Lebenszykluszeitpunkte |
| `spreadsheet_updated_at` | `TIMESTAMPTZ` | ja | letzte Auswahländerung |

Ein Check hält Sheet-ID und -Name vollständig; ein eindeutiger Index auf `LOWER(verified_email)` verhindert mehrere Verbindungen derselben Adresse. OAuth schreibt Authorization-Daten, die Picker-Prüfung aktualisiert die Auswahl, Disconnect löscht ausschließlich diese Zeile.

## Reader und Integritätsgrenze

Der Reader läuft in einer `READ ONLY, REPEATABLE READ`-Transaktion und liest sämtliche Snapshots. `BIGINT`-Strings werden explizit geparst und erneut als sichere JavaScript-Integer geprüft; `DATE` wird in SQL als Text formatiert. Das rekonstruierte Objekt muss das Laufzeitschema erfüllen. Zusätzlich braucht jede aktive Account-, Pocket- und Debt-Zeile mindestens einen Snapshot am oder vor `finance_meta.as_of`.

Fehlender Owner oder fehlendes `finance_meta` ergibt `null`, keinen erfundenen Leerstand. Interne Integritätsfehler enthalten weder Datenbankzeilen noch IDs oder Finanzwerte. Snapshot-Auswahl und Berechnungen bleiben in den TypeScript-Selektoren.

## Migration, Rollen und Backup

Migrationen werden über einen direkten administrativen PostgreSQL-Endpunkt bewusst zuerst in Development, später in Production ausgeführt. Die Vercel Runtime verwendet dagegen die gepoolte `DATABASE_URL` und einen eingeschränkten Runtime-Benutzer. Neon ist der aktuelle Betreiber, aber keine Neon-Funktion ist Teil des Schemas; ein anderer PostgreSQL-Anbieter kann denselben Vertrag ausführen.

Backups enthalten verschlüsselte Google-Tokens und künftig hochsensible Finanzzeilen. Vor ACC-66 müssen Restore-Fenster, Rollen, Region und ein praktischer Restore-Test mit synthetischen Daten geklärt sein. Details stehen im [Produktions-Setup](../anleitungen/produktions-setup.md#2-postgresql-und-neon-betrieb).

## Implementierung und Tests

- Pool und Repositories: [database.ts](../../api/_lib/database.ts), [repository.ts](../../api/_lib/repository.ts), [financeRepository.ts](../../api/_lib/financeRepository.ts)
- Migrationen: [001](../../migrations/001_google_connections.sql), [002](../../migrations/002_finance_data_v1.sql)
- Echte PostgreSQL-Suite: [financeRepository.postgres.test.ts](../../tests/postgres/financeRepository.postgres.test.ts)
