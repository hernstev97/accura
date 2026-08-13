# Finance Data Schema v1

> **Zielgruppe:** Nutzer, Betreiber und Entwickler, die das Google-Workbook pflegen.
> **Zweck und Lernziel:** Eine Tabelle erstellen, validieren und ohne Interpretationsspielraum an `FinanceDataV1` anbinden.
> **Voraussetzungen:** Google-Sheets-Grundkenntnisse; für Berechnungen [Finanz-Domäne](../architektur/finanz-domaene.md)
> **Kanonisch für:** Zehn Tabellen-Tabs, Header, Zellformate, Validierungsregeln und normalisierte `FinanceDataV1`-Grenze.
> **Verwandte Dokumente:** [Produktions-Setup](../anleitungen/produktions-setup.md), [API](api.md), [ADR 0002](../entscheidungen/0002-versionierte-domaenengrenze-und-integer-cents.md)

## Grundvertrag

Die ausgewählte native Google-Sheets-Datei enthält genau die benötigten zehn underscore-präfigierten Maschinen-Tabs. Sichtbare Hilfs-Tabs sind zulässig, werden aber ignoriert. Die App liest je Maschinen-Tab `A:Z` mit `UNFORMATTED_VALUE`, verändert keine Zelle und erwartet die Header in Zeile 1. Leere Datenzeilen werden ignoriert.

Pflicht-Tabs:

```text
_Meta
_Accounts
_AccountSnapshots
_Pockets
_PocketSnapshots
_BudgetItems
_Debts
_DebtSnapshots
_DebtMilestones
_ReliefMilestones
```

Header dürfen in A:Z in anderer Reihenfolge stehen; jeder Pflichtheader muss eindeutig vorhanden sein. Zusätzliche eindeutige Spalten sind erlaubt. `salary_day` und `due_day` sind optionale v1-Spalten: Fehlen sie, bleibt das Workbook rückwärtskompatibel gültig und die normalisierten Werte werden `null`.

## Allgemeine Zellregeln

| Art | Regel |
| --- | --- |
| ID | nicht leer, lowercase-kebab-case: `[a-z0-9]+` mit optionalen `-`-Segmenten |
| Geld | echte numerische Google-Zelle in Euro, ohne `€` im Wert; wird auf sichere Integer-Cents gerundet |
| Ganzzahl | echte sichere Ganzzahl, keine Textzahl |
| Boolean | echtes `TRUE`/`FALSE`, kein Text „ja/nein“ |
| ISO-Datum | Text/formatierter Wert `YYYY-MM-DD`, tatsächlich gültiges Kalenderdatum |
| Monat/Datum | `YYYY-MM` oder gültiges `YYYY-MM-DD` |
| optionaler Text | nicht leerer Text oder leere Zelle |
| Monatstag | Ganzzahl 1–31 oder leer; bei Projektion auf letztes gültiges Monatsdatum begrenzt |

Geld wird beim Parsen zu `Math.sign(x) × Math.round((Math.abs(x) + Number.EPSILON) × 100)` normalisiert und muss im sicheren JavaScript-Ganzzahlbereich liegen. Die Tabelle bleibt Euro-only (`currency = EUR`).

## `_Meta`

Genau eine Datenzeile.

| Header | Pflicht | Wert |
| --- | --- | --- |
| `schema_version` | ja | Ganzzahl `1` |
| `as_of` | ja | fachlicher Stichtag `YYYY-MM-DD` |
| `currency` | ja | exakt `EUR` |
| `monthly_income` | ja | monatliches Einkommen als Euro-Zahl |
| `salary_day` | nein | Monatstag 1–31 oder leer |

Beispiel:

| schema_version | as_of | currency | monthly_income | salary_day |
| ---: | --- | --- | ---: | ---: |
| 1 | 2026-08-01 | EUR | 3200.00 | 25 |

`as_of` steuert Snapshot-Auswahl und Demnächst-Projektion. Die Browseruhr ersetzt diesen Stichtag nicht.

## `_Accounts`

| Header | Wert |
| --- | --- |
| `id` | eindeutige stabile Account-ID |
| `name` | nicht leerer Anzeigename |
| `kind` | `bank`, `wallet` oder `cash` |
| `display_order` | Ganzzahl |
| `active` | Boolean |

| id | name | kind | display_order | active |
| --- | --- | --- | ---: | --- |
| alltag | Alltagskonto | bank | 10 | TRUE |

IDs sind Referenzschlüssel und sollten nach Einführung nicht umbenannt werden.

## `_AccountSnapshots`

| Header | Wert |
| --- | --- |
| `account_id` | vorhandene `_Accounts.id` |
| `as_of` | Snapshot-Datum |
| `balance` | Kontostand in Euro |

Die Kombination `(account_id, as_of)` ist eindeutig. Für jedes aktive Konto muss mindestens ein Snapshot mit Datum kleiner/gleich `_Meta.as_of` existieren.

## `_Pockets`

| Header | Wert |
| --- | --- |
| `id` | eindeutige stabile Pocket-ID |
| `account_id` | vorhandene `_Accounts.id` |
| `name` | nicht leerer Anzeigename |
| `display_order` | Ganzzahl |
| `active` | Boolean |

Pockets sind zweckgebundene Teilansichten eines Accounts. Das Schema erzwingt nicht, dass Pocket-Summen dem Accountsaldo entsprechen.

## `_PocketSnapshots`

| Header | Wert |
| --- | --- |
| `pocket_id` | vorhandene `_Pockets.id` |
| `as_of` | Snapshot-Datum |
| `balance` | Betrag in Euro |

Die Kombination `(pocket_id, as_of)` ist eindeutig. Für jedes aktive Pocket ist ein Snapshot spätestens zum Stichtag Pflicht.

## `_BudgetItems`

| Header | Pflicht | Wert |
| --- | --- | --- |
| `id` | ja | eindeutige stabile Budget-ID |
| `label` | ja | nicht leerer Anzeigename |
| `monthly_amount` | ja | Monatsbetrag in Euro |
| `necessity_id` | ja | `essential`, `necessary`, `worthwhile`, `optional` oder `unnecessary` |
| `kind` | ja | `expense` oder `reserve` |
| `display_order` | ja | Ganzzahl |
| `active` | ja | Boolean |
| `note` | ja | Text oder leer |
| `due_day` | nein | wiederkehrender Monatstag 1–31 oder leer |

| id | label | monthly_amount | necessity_id | kind | display_order | active | note | due_day |
| --- | --- | ---: | --- | --- | ---: | --- | --- | ---: |
| wohnen | Wohnen | 950.00 | essential | expense | 10 | TRUE |  | 3 |
| notgroschen | Notgroschen | 200.00 | worthwhile | reserve | 20 | TRUE | Zielrücklage |  |

Aktive Items fließen in Budgetberechnungen. Nur aktive Items mit `due_day` fließen als wiederkehrende Zahlung in Demnächst; das Schema unterscheidet dort nicht zusätzlich zwischen Expense und Reserve.

## `_Debts`

| Header | Pflicht | Wert |
| --- | --- | --- |
| `id` | ja | eindeutige stabile Debt-ID |
| `name` | ja | nicht leerer Anzeigename/Gläubiger |
| `kind` | ja | `loan` oder `installment` |
| `monthly_payment` | ja | Monatsrate in Euro |
| `display_order` | ja | Ganzzahl |
| `active` | ja | Boolean |
| `note` | ja | Text oder leer |
| `due_day` | nein | wiederkehrender Monatstag 1–31 oder leer |

Aktive Schulden benötigen einen aktuellen Debt-Snapshot. Aktive Schulden mit `due_day` werden in Demnächst projiziert.

## `_DebtSnapshots`

| Header | Wert |
| --- | --- |
| `debt_id` | vorhandene `_Debts.id` |
| `as_of` | Snapshot-Datum |
| `payoff_balance` | aktuelle Ablösesumme in Euro |
| `remaining_payments` | nicht negative Ganzzahl, Anzahl Raten |
| `remaining_scheduled_total` | Summe planmäßiger verbleibender Zahlungen in Euro |

Die Kombination `(debt_id, as_of)` ist eindeutig. `remaining_payments` ist ausdrücklich keine Geldspalte. Mehrkosten werden abgeleitet und nicht als eigene Quelle gespeichert.

## `_DebtMilestones`

| Header | Wert |
| --- | --- |
| `debt_id` | vorhandene `_Debts.id` |
| `date` | `YYYY-MM` oder `YYYY-MM-DD` |
| `balance` | projizierte Restschuld in Euro |

Die Kombination `(debt_id, date)` ist eindeutig. Meilensteine sind Verlaufspunkte und ersetzen keinen aktuellen Snapshot.

## `_ReliefMilestones`

| Header | Wert |
| --- | --- |
| `date` | `YYYY-MM` oder `YYYY-MM-DD` |
| `free_amount` | ab dann monatlich frei werdender Betrag in Euro |
| `event` | nicht leerer Titel |
| `event_detail` | Text oder leer |

Relief Milestones beschreiben planmäßige Entlastungsereignisse. Sie sind nicht mit einzelnen Demnächst-Fälligkeiten gleichzusetzen.

## Fremdschlüssel und Eindeutigkeit

Folgende Referenzen müssen existieren: AccountSnapshot → Account, Pocket → Account, PocketSnapshot → Pocket, DebtSnapshot → Debt und DebtMilestone → Debt. Stamm-IDs in Accounts, Pockets, BudgetItems und Debts sind jeweils innerhalb ihres Tabs eindeutig. Snapshot-/Milestone-Kombinationen sind wie oben beschrieben eindeutig. Ein Fehler verhindert die gesamte Auswahl beziehungsweise Aktualisierung; es gibt keinen Teilimport.

## Snapshot-Auswahl

Für jede aktive Entität wird der jüngste Snapshot mit Datum `<= _Meta.as_of` verwendet. Zukünftige Snapshots bleiben gespeichert, werden aber am früheren Stichtag nicht ausgewählt. Mehrere gültige ältere Snapshots sind erlaubt; Monate ohne eigenen Stand gelten als unverändert zum letzten bekannten Wert. Fehlt für eine aktive Entität ein solcher Stand, ist das Workbook ungültig.

## Normalisierte Grenze `FinanceDataV1`

Nach erfolgreicher Prüfung entstehen camelCase-Felder und Centbeträge:

```text
schemaVersion, asOf, currency, monthlyIncomeCents, salaryDay
accounts, accountSnapshots, pockets, pocketSnapshots
budgetItems (monthlyAmountCents, dueDay)
debts (monthlyPaymentCents, dueDay), debtSnapshots
debtMilestones, reliefMilestones
```

Diese Struktur enthält Quellen, keine abgeleiteten Totals. Exakte TypeScript-Typen: [src/finance/types.ts](../../src/finance/types.ts). Die HTTP-Antwort wird im Browser erneut mit [src/finance/runtime.ts](../../src/finance/runtime.ts) validiert.

## Demnächst-Erweiterung innerhalb v1

`salary_day` und `due_day` wurden optional ergänzt, ohne die Schema-Version zu erhöhen oder ältere v1-Workbooks ungültig zu machen. Leere/fehlende Spalten werden `null`; vorhandene Werte außerhalb 1–31 sind Validierungsfehler. Die vollständige Projektion, einschließlich Ausschluss des Gehaltstags, steht in der [Finanz-Domäne](../architektur/finanz-domaene.md#gehaltsbezogene-fälligkeitsprojektion).

## Typische Fehler

- falscher Tabname oder Pflichtheader;
- Text statt Zahl/Boolean;
- doppelte IDs oder Snapshot-Schlüssel;
- unbekannter Fremdschlüssel;
- ungültiges Kalenderdatum;
- Währung ungleich `EUR` oder Schema-Version ungleich `1`;
- aktive Entität ohne Snapshot bis zum Stichtag;
- `salary_day`/`due_day` außerhalb 1–31.

Die API meldet Issues mit Tab, 1-basierter Tabellenzeile, Spalte, Erwartung und deutscher Erklärung.

## Implementierung und Tests

- Header/Ranges: [src/finance/schema.ts](../../src/finance/schema.ts)
- Parser: [src/finance/parser.ts](../../src/finance/parser.ts)
- Laufzeitgrenze: [src/finance/runtime.ts](../../src/finance/runtime.ts)
- Typen: [src/finance/types.ts](../../src/finance/types.ts)
- Tests: [src/finance/parser.test.ts](../../src/finance/parser.test.ts), [src/finance/selectors.test.ts](../../src/finance/selectors.test.ts)
- Anonymes Beispiel: [src/mocks/anonymousWorkbook.ts](../../src/mocks/anonymousWorkbook.ts)
