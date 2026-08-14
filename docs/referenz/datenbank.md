# Datenbankreferenz

> **Zielgruppe:** Betreiber und Backend-Entwickler.
> **Zweck und Lernziel:** PostgreSQL-Schema, Owner-Isolation, Constraints und Betriebsgrenzen verstehen.
> **Voraussetzungen:** PostgreSQL-Grundkenntnisse und [Backend und Sicherheit](../architektur/backend-und-sicherheit.md)
> **Kanonisch für:** Migrationen 001–003 und das ownergebundene Finance-v1-Schema.
> **Verwandte Dokumente:** [Produktions-Setup](../anleitungen/produktions-setup.md), [Finance Data Schema v1](finance-data-schema-v1.md)

`accura` besitzt drei transaktionale Migrationen. [001_google_connections.sql](../../migrations/001_google_connections.sql) legte historisch die Google-Verbindung an. [002_finance_data_v1.sql](../../migrations/002_finance_data_v1.sql) bildet sämtliche Quellenfelder aus `FinanceDataV1` relational ab. [003_drop_google_connections.sql](../../migrations/003_drop_google_connections.sql) entfernt die Verbindungs- und Tokentabelle nach dem Cutover. `/api/finance` liest ausschließlich das ownergebundene Finance-Schema.

## Owner-Modell

`owners` trennt externe Identität und interne Datenzuordnung:

| Spalte | Typ | Null? | Vertrag |
| --- | --- | --- | --- |
| `id` | `UUID` | nein | Primärschlüssel, Default `gen_random_uuid()` |
| `google_sub` | `TEXT` | nein | eindeutig, nach Trimmung nicht leer |
| `created_at` | `TIMESTAMPTZ` | nein | Default `NOW()` |

Es besteht absichtlich kein Foreign Key von Finance-Tabellen zur historischen Verbindungstabelle. Logout darf Finanzdaten nicht löschen. OAuth erzeugt keinen Owner; erst der kontrollierte Operator-Import legt den produktiven Datensatz an. Der Reader nimmt ausschließlich Google `sub` aus der verifizierten Sitzung entgegen, löst intern `owners.id` auf und verwendet danach nur diese UUID.

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

## Historische Tabelle `google_connections`

Migration 001 erzeugt diese Tabelle noch, damit bestehende Datenbanken denselben Pfad durchlaufen. Migration 003 entfernt sie einschließlich gespeicherter Refresh-Tokens. Die Laufzeit schreibt nicht mehr darauf.

## Reader, Import und Integritätsgrenze

Der Reader läuft in einer `READ ONLY, REPEATABLE READ`-Transaktion und liest sämtliche Snapshots. `BIGINT`-Strings werden explizit geparst und erneut als sichere JavaScript-Integer geprüft; `DATE` wird in SQL als Text formatiert. Das rekonstruierte Objekt muss das Laufzeitschema erfüllen. Zusätzlich braucht jede aktive Account-, Pocket- und Debt-Zeile mindestens einen Snapshot am oder vor `finance_meta.as_of`.

Fehlender Owner oder fehlendes `finance_meta` ergibt `null`, keinen erfundenen Leerstand. Der Operator-Import ersetzt den vollständigen Stand eines Owners transaktional und liest ihn vor der Bestätigung erneut. Interne Integritätsfehler enthalten weder Datenbankzeilen noch IDs oder Finanzwerte. Snapshot-Auswahl und Berechnungen bleiben in den TypeScript-Selektoren.

## Migration, Rollen und Backup

Migrationen werden über einen direkten administrativen PostgreSQL-Endpunkt bewusst zuerst in Development, später in Production ausgeführt. Die Vercel Runtime verwendet dagegen die gepoolte `DATABASE_URL` und einen eingeschränkten Runtime-Benutzer. Neon ist der aktuelle Betreiber, aber keine Neon-Funktion ist Teil des Schemas; ein anderer PostgreSQL-Anbieter kann denselben Vertrag ausführen.

Backups enthalten hochsensible Finanzzeilen. Restore-Fenster, Rollen, Region und ein praktischer Restore-Test mit synthetischen Daten gehören zum Betriebsprotokoll vor einem produktiven Import. Details stehen im [Produktions-Setup](../anleitungen/produktions-setup.md#2-postgresql-und-neon-betrieb).

## Implementierung und Tests

- Pool und Repository: [database.ts](../../api/_lib/database.ts), [financeRepository.ts](../../api/_lib/financeRepository.ts)
- Migrationen: [001](../../migrations/001_google_connections.sql), [002](../../migrations/002_finance_data_v1.sql), [003](../../migrations/003_drop_google_connections.sql)
- Echte PostgreSQL-Suite: [financeRepository.postgres.test.ts](../../tests/postgres/financeRepository.postgres.test.ts)
