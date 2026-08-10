# Finance Data Schema v1

Finance Data Schema v1 is the external source contract for the application. It is intentionally different from UI view models: the workbook stores source records and snapshots; the application derives balances, aggregates, labels, and percentages.

The spreadsheet may contain unrelated tabs and additional columns. They are ignored for forward compatibility. The ten machine tabs below, their exact names, and every listed column are required. Column order is not significant. Blank rows are ignored.

## Common rules

- IDs are stable lowercase kebab-case: `daily-account`, `home-reserve`, `community-loan`.
- ID values must not be reused for a different real-world record.
- Money cells are Google Sheets numeric cells in euros, without a `€` character or thousands separator embedded in text.
- The server requests `UNFORMATTED_VALUE` and converts money to integer cents immediately. Half cents round away from zero to the nearest cent.
- Counts are plain non-negative integers and are never normalized, formatted, or calculated as money.
- Format date cells as plain text or with an ISO display format so Google returns the exact required ISO representation.
- Full dates use `YYYY-MM-DD`. Projection dates allow `YYYY-MM` or `YYYY-MM-DD` where stated.
- Boolean cells must be actual Sheets booleans (`TRUE` or `FALSE`), not text.
- `display_order` is an integer. Lower values appear first.
- Historical snapshots after `_Meta.as_of` may exist but are not used for the current view.
- Duplicate IDs, duplicate snapshot keys, broken references, missing current snapshots, missing tabs/columns, and unsupported versions reject the workbook.

The examples are anonymous and do not correspond to production finances.

## `_Meta`

Exactly one data row.

| Column | Required | Type and rule | Anonymous example |
|---|---:|---|---|
| `schema_version` | yes | integer; exactly `1` | `1` |
| `as_of` | yes | ISO full date | `2026-08-08` |
| `currency` | yes | currently exactly `EUR` | `EUR` |
| `monthly_income` | yes | numeric euros | `3000` |
| `salary_day` | no | integer (1..31) or blank | `25` |

Example:

```csv
schema_version,as_of,currency,monthly_income,salary_day
1,2026-08-08,EUR,3000,25
```

## `_Accounts`

Defines accounts without balances.

| Column | Required | Type and rule | Anonymous example |
|---|---:|---|---|
| `id` | yes | unique kebab-case ID | `daily-account` |
| `name` | yes | non-empty text | `Alltagskonto` |
| `kind` | yes | `bank`, `wallet`, or `cash` | `bank` |
| `display_order` | yes | integer | `1` |
| `active` | yes | boolean | `TRUE` |

## `_AccountSnapshots`

| Column | Required | Type and rule | Anonymous example |
|---|---:|---|---|
| `account_id` | yes | references `_Accounts.id` | `daily-account` |
| `as_of` | yes | ISO full date | `2026-08-08` |
| `balance` | yes | numeric euros | `1200.25` |

`account_id + as_of` must be unique. Every active account requires at least one snapshot on or before `_Meta.as_of`. The latest eligible snapshot provides its current balance.

## `_Pockets`

| Column | Required | Type and rule | Anonymous example |
|---|---:|---|---|
| `id` | yes | unique kebab-case ID | `home-reserve` |
| `account_id` | yes | references `_Accounts.id` | `daily-account` |
| `name` | yes | non-empty text | `Wohnen` |
| `display_order` | yes | integer | `1` |
| `active` | yes | boolean | `TRUE` |

## `_PocketSnapshots`

| Column | Required | Type and rule | Anonymous example |
|---|---:|---|---|
| `pocket_id` | yes | references `_Pockets.id` | `home-reserve` |
| `as_of` | yes | ISO full date | `2026-08-08` |
| `balance` | yes | numeric euros | `300` |

`pocket_id + as_of` must be unique. Every active pocket requires a latest eligible snapshot.

## `_BudgetItems`

| Column | Required | Type and rule | Anonymous example |
|---|---:|---|---|
| `id` | yes | unique kebab-case ID | `housing` |
| `label` | yes | non-empty text | `Wohnen` |
| `monthly_amount` | yes | numeric euros | `1000` |
| `necessity_id` | yes | enum below | `essential` |
| `kind` | yes | `expense` or `reserve` | `expense` |
| `display_order` | yes | integer | `1` |
| `active` | yes | boolean | `TRUE` |
| `note` | no | text or blank | `Fest eingeplant` |
| `due_day` | no | integer (1..31) or blank | `1` |

`necessity_id` is one of:

- `essential` — Existentiell
- `necessary` — Notwendig
- `worthwhile` — Sinnvoll
- `optional` — Optional
- `unnecessary` — Unnötig

The German labels, chart colors, and shape tokens live in application presentation configuration, not in the workbook.

## `_Debts`

| Column | Required | Type and rule | Anonymous example |
|---|---:|---|---|
| `id` | yes | unique kebab-case ID | `community-loan` |
| `name` | yes | non-empty text | `Gemeinschaftsdarlehen` |
| `kind` | yes | `loan` or `installment` | `loan` |
| `monthly_payment` | yes | numeric euros | `300` |
| `display_order` | yes | integer | `1` |
| `active` | yes | boolean | `TRUE` |
| `note` | no | text or blank | `Fester Zahlungsplan` |
| `due_day` | no | integer (1..31) or blank | `20` |

## `_DebtSnapshots`

| Column | Required | Type and rule | Anonymous example |
|---|---:|---|---|
| `debt_id` | yes | references `_Debts.id` | `community-loan` |
| `as_of` | yes | ISO full date | `2026-08-08` |
| `payoff_balance` | yes | numeric euros | `5000` |
| `remaining_payments` | yes | non-negative integer installment count | `24` |
| `remaining_scheduled_total` | yes | numeric euros still payable under the schedule | `6000` |

`remaining_payments` and `remaining_scheduled_total` are intentionally separate: the first is a count and the second is money. The count must never be used as a monetary fallback. A missing or invalid `remaining_scheduled_total` rejects the workbook.

`debt_id + as_of` must be unique. Every active debt requires a latest eligible snapshot.

## `_DebtMilestones`

External projected balances may be imported because they are projections rather than duplicated current totals.

| Column | Required | Type and rule | Anonymous example |
|---|---:|---|---|
| `debt_id` | yes | references `_Debts.id` | `community-loan` |
| `date` | yes | `YYYY-MM` or `YYYY-MM-DD` | `2027-08` |
| `balance` | yes | numeric euros | `3500` |

`debt_id + date` must be unique. The UI aggregates active debts that share a milestone date.

## `_ReliefMilestones`

| Column | Required | Type and rule | Anonymous example |
|---|---:|---|---|
| `date` | yes | final-payment/ending date as `YYYY-MM` or `YYYY-MM-DD` | `2026-12` |
| `free_amount` | yes | additional monthly amount released by this event, in numeric euros | `50` |
| `event` | yes | non-empty text | `Gerätefinanzierung` |
| `event_detail` | no | text or blank | `Letzte Rate` |

`free_amount` is the event's monthly relief, not the cumulative free budget. The application derives the amount free after an event from the current free amount plus relief. Multiple rows may share a calendar month; the application groups their relief amounts and orders their event names deterministically. Milestones on or before `_Meta.as_of` are not future events. For month-only values, the current `as_of` month is treated as current rather than future.

## Derivations

After runtime validation and normalization, all financial calculations operate on integer cents:

- Current account/pocket balance: latest snapshot on or before `_Meta.as_of`.
- Account/pocket total: sum of current balances for active records.
- Planned monthly amount: sum of `monthly_amount` for active budget items.
- Free amount: `monthly_income - planned amount`.
- Free percentage: cent-based ratio, rounded to basis points for display.
- Necessity groups: active budget items grouped by `necessity_id`.
- Reserve total: active items where `kind = reserve`.
- Current payoff total: sum of latest `payoff_balance` for active debts.
- Remaining installment count: sum of latest `remaining_payments` counts for active debts.
- Remaining scheduled total: sum of latest `remaining_scheduled_total` monetary values for active debts.
- Future additional debt cost: remaining scheduled total minus payoff total.
- Next relief milestone: earliest grouped calendar month strictly after `_Meta.as_of`, independent of source-row order.
- Free amount after the next relief: current free amount plus the grouped next `free_amount` values.
- Next salary date: earliest date on or after `as_of` matching configured `salary_day` (clamped to the last day of target month if the target month has fewer days).
- Next occurrence of recurring payment: earliest date on or after `as_of` matching `due_day` (clamped to target month's last valid day).
- Pending recurring payments until next salary: active budget items and debts with a specified `due_day` whose next occurrence falls in `[as_of, nextSalaryDate)` (strictly before salary day).
- Safe to spend: `currentlyAvailableMoney - pendingPaymentsUntilNextSalary`.
- Shortly before salary flag: payment due date falls within 7 calendar days strictly before `nextSalaryDate`.
- Dates and labels: localized in the UI from ISO source dates.

The workbook must not contain account totals, pocket totals, free totals, necessity aggregates, reserve totals, payoff totals, or future-cost totals.

## Validation failures

The candidate workbook is rejected as a whole. Errors identify the machine tab, one-based Sheet row, column, and expected format without echoing cell values. Examples:

- `_Meta`, row 2, `schema_version`: expected supported schema version `1`.
- `_AccountSnapshots`, row 4, `as_of`: expected `YYYY-MM-DD`.
- `_Pockets`, row 3, `account_id`: expected an existing `_Accounts.id`.
- `_BudgetItems`, row 7, `monthly_amount`: expected a numeric euro value without a currency symbol.

When refresh validation fails, the app retains and clearly marks the previous last-known-good snapshot. A newly picked spreadsheet is never committed before it validates.

## Version policy

`schema_version = 1` is the only supported version. The required `remaining_scheduled_total` column corrects the current pre-stable v1 contract; it does not introduce a second schema version. Workbooks and cached normalized data that still confuse the installment count with money fail validation instead of being migrated silently. Unknown extra columns are ignored, but a workbook declaring v2 or later is never silently treated as v1. A future version must add an explicit parser/migration boundary and corresponding tests before it can be accepted.
