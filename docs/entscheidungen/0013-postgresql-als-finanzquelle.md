# ADR 0013: PostgreSQL als Finanzquelle

> **Zielgruppe:** Finance-, Backend- und Security-Entwickler.
> **Zweck und Lernziel:** Verbindliche Quelle, Persistenzgrenze und Übergang von Google Sheets nach PostgreSQL festlegen.
> **Voraussetzungen:** [Finanz-Domäne](../architektur/finanz-domaene.md), [ADR 0002](0002-versionierte-domaenengrenze-und-integer-cents.md)
> **Kanonisch für:** PostgreSQL als Finanzquelle, Google Sheets als Importformat und das v1-Persistenzmodell mit internem Owner.
> **Verwandte Dokumente:** [ADR 0014](0014-google-oauth-nur-als-identitaet.md), [Architekturüberblick](../architektur/ueberblick.md), [ADR-Index](README.md)

- **Status:** Angenommen

## Kontext

Google Sheets ist im implementierten Stand gleichzeitig Bearbeitungsoberfläche und fachliche Quelle. Jeder produktive Finance-Read benötigt deshalb Google-Token, eine ausgewählte Datei und einen vollständigen `batchGet`- und Parserdurchlauf. Das erschwert eine gezielte In-App-Bearbeitung und bindet die Finanzdaten dauerhaft an eine externe Dateiintegration.

Der bestehende `FinanceDataV1`-Vertrag, die Integer-Cent-Repräsentation und die reinen Selektoren haben sich dagegen bewährt. Der Quellenwechsel soll diese fachliche Grenze erhalten und weder ein Schema v2 noch eine neue Berechnungsschicht einführen.

## Entscheidung

Nach dem einmaligen Cutover ist PostgreSQL die einzige produktive Quelle der Finanzzeilen. Google Sheets ist ausschließlich ein Importformat für den bestehenden Datenstand: kein dauerhafter Sync, kein Zurückschreiben und kein Laufzeit-Fallback auf Sheets.

Das Persistenzmodell bildet exakt die Quellen des heutigen `FinanceDataV1` ab:

| Persistenz | Abbildung |
| --- | --- |
| `owners` | interne stabile Owner-ID und eindeutige Zuordnung zur aktuell erlaubten Google-Identität |
| `finance_meta` | `schemaVersion`, `asOf`, `currency`, `monthlyIncomeCents`, `salaryDay` |
| `accounts`, `account_snapshots` | Konten und ihre Stände |
| `pockets`, `pocket_snapshots` | Pockets und ihre Stände |
| `budget_items` | Budgetquellen einschließlich Betrag, Fälligkeit und Aktivstatus |
| `debts`, `debt_snapshots` | Schulden und ihre Stände |
| `debt_milestones`, `relief_milestones` | Restschuld- und Entlastungsmeilensteine |

`owners.id` ist eine interne UUID. Google `sub` wird eindeutig auf diesen Owner abgebildet, ist aber nicht selbst der fachliche Schlüssel jeder Finanzzeile. Jede Finance-Tabelle trägt ein nicht-nullbares `owner_id`; Primär- und Fremdschlüssel schließen `owner_id` ein, damit Beziehungen nicht versehentlich über Ownergrenzen hinweg aufgelöst werden können. Der Server leitet den Owner ausschließlich aus der verifizierten Sitzung ab. Ein Client darf `owner_id` weder wählen noch überschreiben.

`owner_id` ist Persistenz- und Isolationsinformation und wird nicht Bestandteil von `FinanceDataV1` oder der Browserantwort. Für diesen Schnitt bleibt genau eine Allowlist-Identität zugelassen. `owner_id` allein ist noch keine vollständige Multi-User-Sicherheitsgrenze; diese wird erst vor der Private Alpha umgesetzt.

Geld wird als `bigint` in Cents gespeichert und an der JavaScript-Grenze weiterhin als sicherer Integer validiert. Reine Kalendertage werden als `date`, Ereigniszeitpunkte als `timestamptz` gespeichert. Bei Meilensteinen muss zusätzlich erhalten bleiben, ob der v1-Wert einen Monat (`YYYY-MM`) oder einen exakten Tag (`YYYY-MM-DD`) bezeichnet; eine Normalisierung auf den Monatsersten darf diese Information nicht verlieren.

Ein Repository liest für den Session-Owner den vollständigen Quellenstand und baut daraus exakt ein validiertes `FinanceDataV1`. Fehlt `finance_meta`, existiert noch kein gültiger Finanzstand. Dieser Fall wird außerhalb von `FinanceDataV1` als eigener Anwendungszustand behandelt; die Anwendung erfindet keinen künstlichen leeren Snapshot.

SQL erzwingt strukturelle Integrität, Typen, Eindeutigkeit und Owner-gebundene Referenzen. Snapshot-Auswahl, Summen, Fälligkeitsprojektion, `safeToSpend` und andere Finanzlogik bleiben in Parsern, Selektoren und dem View-Model. Abgeleitete Kennzahlen werden nicht als zweite Wahrheit persistiert.

## Übergang

ACC-71, ACC-29 und ACC-66 sind umgesetzt: Schema, Reader, Paritätsnachweis, produktiver `/api/finance`-Read und Operator-Import existieren. Google Sheets ist nur noch Importformat. ACC-72 baut anschließend den In-App-Editor.

Der Cutover ist eindeutig. Ein dauerhafter Feature-Flag-Dualbetrieb oder stiller Rückfall auf Sheets ist nicht vorgesehen.

## Begründung

Die interne Owner-ID entkoppelt Finanzdaten von einem externen Identitätsanbieter, ohne bereits eine Mandanten- oder Rollenarchitektur zu bauen. Das unveränderte `FinanceDataV1` hält Parser, Cache, Selektoren, View-Model und UI stabil. Ein einziger produktiver Lesepfad verhindert divergierende Datenstände und unklare Fehlerbehandlung.

## Erwogene Alternativen

Google Sheets als dauerhafte Quelle beizubehalten würde Editor und Laufzeit weiter an Picker, Token und externe Verfügbarkeit binden. Ein dauerhafter Dual-Source-Betrieb erzeugt Konflikt- und Prioritätsregeln ohne Produktnutzen. JSON-Dokumente in einer einzelnen Spalte würden relationale Integrität und gezielte sichere Bearbeitung erschweren. Finanzlogik oder vorberechnete UI-Kennzahlen in SQL würden eine zweite Berechnungsquelle neben den getesteten Selektoren schaffen. Google `sub` direkt auf jede Finanzzeile zu schreiben wäre kurzfristig kleiner, koppelte die Daten aber unnötig an Google und erschwerte ACC-64.

Convex wurde ebenfalls geprüft. Sein dokumenten- und function-orientiertes Backend-Modell würde Auth-, Datenzugriffs- und Deploymentgrenzen stärker verändern als der benötigte Quellenwechsel. Vor allem kann der gewählte relationale Vertrag mit zusammengesetzten Owner-Fremdschlüsseln und von der Datenbank erzwungener referenzieller Integrität dort nicht unverändert abgebildet werden. Für ACC-71 überwiegen Portabilität des PostgreSQL-Schemas, bestehende Vercel-Integration und technisch erzwungene Owner-Beziehungen; deshalb wurde Convex verworfen.

## Konsequenzen

### Positiv

Die App erhält eine selbst kontrollierte, transaktionale Finanzquelle und kann gezielte Bearbeitung anbieten. Bestehende Cent-, Cache- und Selektorverträge bleiben erhalten. Owner-Zuordnung und relationale Integrität sind von Anfang an explizit.

### Negativ

Schema, Migration, Repository und Schreibgrenzen müssen sorgfältig umgesetzt und gegen die bestehende Fixture geprüft werden. Backups enthalten künftig hochsensible Finanzzeilen. Der einmalige Cutover benötigt eine kontrollierte Import- und Rückfallplanung, darf aber keinen dauerhaften zweiten Produktionspfad hinterlassen.

## Implementierung und Tests

- Domänenvertrag: [FinanceDataV1](../../src/finance/types.ts), [Sheets-Parser als Import](../../src/finance/parser.ts)
- Persistenz und produktiver Read/Write: [Migration 002](../../migrations/002_finance_data_v1.sql), [Migration 003](../../migrations/003_drop_google_connections.sql), [PostgreSQL-Repository](../../api/_lib/financeRepository.ts), [Operator-Import](../../scripts/import-finance.ts)
- Paritätsnachweis: [Integrationstest](../../tests/postgres/financeRepository.postgres.test.ts)
- Nächster Produktschritt: ACC-72 in Linear
