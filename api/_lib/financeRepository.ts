import type postgres from 'postgres';
import { financeDataV1Schema } from '../../src/finance/runtime.js';
import type { FinanceDataV1 } from '../../src/finance/types.js';
import { getDatabase } from './database.js';

export interface FinanceRepository {
  readForGoogleSub(googleSub: string): Promise<FinanceDataV1 | null>;
}

export type FinanceDataIntegrityReason = 'invalid_integer' | 'invalid_shape' | 'missing_current_snapshot';

/** Sanitized internal error: it deliberately carries no row, entity ID, or financial value. */
export class FinanceDataIntegrityError extends Error {
  readonly code = 'finance_data_integrity_error';

  constructor(readonly reason: FinanceDataIntegrityReason) {
    super('Stored finance data failed integrity validation.');
    this.name = 'FinanceDataIntegrityError';
  }
}

type OwnerRow = { id: string };
type MetaRow = {
  schema_version: number;
  as_of: string;
  currency: string;
  monthly_income_cents: string;
  salary_day: number | null;
};
type AccountRow = {
  id: string;
  name: string;
  kind: string;
  display_order: string;
  active: boolean;
};
type AccountSnapshotRow = {
  account_id: string;
  as_of: string;
  balance_cents: string;
};
type PocketRow = {
  id: string;
  account_id: string;
  name: string;
  display_order: string;
  active: boolean;
};
type PocketSnapshotRow = {
  pocket_id: string;
  as_of: string;
  balance_cents: string;
};
type BudgetItemRow = {
  id: string;
  label: string;
  monthly_amount_cents: string;
  necessity_id: string;
  kind: string;
  display_order: string;
  active: boolean;
  note: string | null;
  due_day: number | null;
};
type DebtRow = {
  id: string;
  name: string;
  kind: string;
  monthly_payment_cents: string;
  display_order: string;
  active: boolean;
  note: string | null;
  due_day: number | null;
};
type DebtSnapshotRow = {
  debt_id: string;
  as_of: string;
  payoff_balance_cents: string;
  remaining_payment_count: string;
  remaining_scheduled_total_cents: string;
};
type DebtMilestoneRow = {
  debt_id: string;
  date: string;
  balance_cents: string;
};
type ReliefMilestoneRow = {
  date: string;
  monthly_relief_cents: string;
  event: string;
  event_detail: string | null;
};

const integerPattern = /^-?(?:0|[1-9]\d*)$/;

function safeInteger(value: unknown): number {
  if (typeof value !== 'string' || !integerPattern.test(value)) {
    throw new FinanceDataIntegrityError('invalid_integer');
  }
  const mapped = Number(value);
  if (!Number.isSafeInteger(mapped)) throw new FinanceDataIntegrityError('invalid_integer');
  return mapped;
}

function hasCurrentSnapshot<T>(
  id: string,
  asOf: string,
  snapshots: T[],
  getId: (snapshot: T) => string,
  getDate: (snapshot: T) => string,
): boolean {
  return snapshots.some((snapshot) => getId(snapshot) === id && getDate(snapshot) <= asOf);
}

function assertCurrentSnapshots(data: FinanceDataV1): void {
  const accountSnapshotsValid = data.accounts
    .filter(({ active }) => active)
    .every(({ id }) => hasCurrentSnapshot(id, data.asOf, data.accountSnapshots, (entry) => entry.accountId, (entry) => entry.asOf));
  const pocketSnapshotsValid = data.pockets
    .filter(({ active }) => active)
    .every(({ id }) => hasCurrentSnapshot(id, data.asOf, data.pocketSnapshots, (entry) => entry.pocketId, (entry) => entry.asOf));
  const debtSnapshotsValid = data.debts
    .filter(({ active }) => active)
    .every(({ id }) => hasCurrentSnapshot(id, data.asOf, data.debtSnapshots, (entry) => entry.debtId, (entry) => entry.asOf));

  if (!accountSnapshotsValid || !pocketSnapshotsValid || !debtSnapshotsValid) {
    throw new FinanceDataIntegrityError('missing_current_snapshot');
  }
}

export class PostgresFinanceRepository implements FinanceRepository {
  constructor(private readonly sql: postgres.Sql) {}

  async readForGoogleSub(googleSub: string): Promise<FinanceDataV1 | null> {
    return this.sql.begin('read only isolation level repeatable read', async (transaction) => {
      const owners = await transaction<OwnerRow[]>`
        SELECT id
        FROM owners
        WHERE google_sub = ${googleSub}
        LIMIT 1
      `;
      const ownerId = owners[0]?.id;
      if (!ownerId) return null;

      const metaRows = await transaction<MetaRow[]>`
        SELECT schema_version,
               TO_CHAR(as_of, 'YYYY-MM-DD') AS as_of,
               currency,
               monthly_income_cents,
               salary_day
        FROM finance_meta
        WHERE owner_id = ${ownerId}
        LIMIT 1
      `;
      const meta = metaRows[0];
      if (!meta) return null;

      const accountRows = await transaction<AccountRow[]>`
        SELECT id, name, kind, display_order, active
        FROM accounts
        WHERE owner_id = ${ownerId}
        ORDER BY display_order, id
      `;
      const accountSnapshotRows = await transaction<AccountSnapshotRow[]>`
        SELECT snapshots.account_id,
               TO_CHAR(snapshots.as_of, 'YYYY-MM-DD') AS as_of,
               snapshots.balance_cents
        FROM account_snapshots AS snapshots
        JOIN accounts AS accounts
          ON accounts.owner_id = snapshots.owner_id AND accounts.id = snapshots.account_id
        WHERE snapshots.owner_id = ${ownerId}
        ORDER BY accounts.display_order, accounts.id, snapshots.as_of
      `;
      const pocketRows = await transaction<PocketRow[]>`
        SELECT id, account_id, name, display_order, active
        FROM pockets
        WHERE owner_id = ${ownerId}
        ORDER BY display_order, id
      `;
      const pocketSnapshotRows = await transaction<PocketSnapshotRow[]>`
        SELECT snapshots.pocket_id,
               TO_CHAR(snapshots.as_of, 'YYYY-MM-DD') AS as_of,
               snapshots.balance_cents
        FROM pocket_snapshots AS snapshots
        JOIN pockets AS pockets
          ON pockets.owner_id = snapshots.owner_id AND pockets.id = snapshots.pocket_id
        WHERE snapshots.owner_id = ${ownerId}
        ORDER BY pockets.display_order, pockets.id, snapshots.as_of
      `;
      const budgetItemRows = await transaction<BudgetItemRow[]>`
        SELECT id, label, monthly_amount_cents, necessity_id, kind, display_order,
               active, note, due_day
        FROM budget_items
        WHERE owner_id = ${ownerId}
        ORDER BY display_order, id
      `;
      const debtRows = await transaction<DebtRow[]>`
        SELECT id, name, kind, monthly_payment_cents, display_order, active, note, due_day
        FROM debts
        WHERE owner_id = ${ownerId}
        ORDER BY display_order, id
      `;
      const debtSnapshotRows = await transaction<DebtSnapshotRow[]>`
        SELECT snapshots.debt_id,
               TO_CHAR(snapshots.as_of, 'YYYY-MM-DD') AS as_of,
               snapshots.payoff_balance_cents,
               snapshots.remaining_payment_count,
               snapshots.remaining_scheduled_total_cents
        FROM debt_snapshots AS snapshots
        JOIN debts AS debts
          ON debts.owner_id = snapshots.owner_id AND debts.id = snapshots.debt_id
        WHERE snapshots.owner_id = ${ownerId}
        ORDER BY debts.display_order, debts.id, snapshots.as_of
      `;
      const debtMilestoneRows = await transaction<DebtMilestoneRow[]>`
        SELECT milestones.debt_id,
               CASE milestones.date_precision
                 WHEN 'month' THEN TO_CHAR(milestones.milestone_date, 'YYYY-MM')
                 ELSE TO_CHAR(milestones.milestone_date, 'YYYY-MM-DD')
               END AS date,
               milestones.balance_cents
        FROM debt_milestones AS milestones
        JOIN debts AS debts
          ON debts.owner_id = milestones.owner_id AND debts.id = milestones.debt_id
        WHERE milestones.owner_id = ${ownerId}
        ORDER BY milestones.milestone_date, debts.display_order, debts.id, milestones.date_precision
      `;
      const reliefMilestoneRows = await transaction<ReliefMilestoneRow[]>`
        SELECT CASE date_precision
                 WHEN 'month' THEN TO_CHAR(milestone_date, 'YYYY-MM')
                 ELSE TO_CHAR(milestone_date, 'YYYY-MM-DD')
               END AS date,
               monthly_relief_cents,
               event,
               event_detail
        FROM relief_milestones
        WHERE owner_id = ${ownerId}
        ORDER BY milestone_date, event, event_detail NULLS FIRST, id
      `;

      const candidate = {
        schemaVersion: meta.schema_version,
        asOf: meta.as_of,
        currency: meta.currency,
        monthlyIncomeCents: safeInteger(meta.monthly_income_cents),
        salaryDay: meta.salary_day,
        accounts: accountRows.map((row) => ({
          id: row.id,
          name: row.name,
          kind: row.kind,
          displayOrder: safeInteger(row.display_order),
          active: row.active,
        })),
        accountSnapshots: accountSnapshotRows.map((row) => ({
          accountId: row.account_id,
          asOf: row.as_of,
          balanceCents: safeInteger(row.balance_cents),
        })),
        pockets: pocketRows.map((row) => ({
          id: row.id,
          accountId: row.account_id,
          name: row.name,
          displayOrder: safeInteger(row.display_order),
          active: row.active,
        })),
        pocketSnapshots: pocketSnapshotRows.map((row) => ({
          pocketId: row.pocket_id,
          asOf: row.as_of,
          balanceCents: safeInteger(row.balance_cents),
        })),
        budgetItems: budgetItemRows.map((row) => ({
          id: row.id,
          label: row.label,
          monthlyAmountCents: safeInteger(row.monthly_amount_cents),
          necessityId: row.necessity_id,
          kind: row.kind,
          displayOrder: safeInteger(row.display_order),
          active: row.active,
          note: row.note,
          dueDay: row.due_day,
        })),
        debts: debtRows.map((row) => ({
          id: row.id,
          name: row.name,
          kind: row.kind,
          monthlyPaymentCents: safeInteger(row.monthly_payment_cents),
          displayOrder: safeInteger(row.display_order),
          active: row.active,
          note: row.note,
          dueDay: row.due_day,
        })),
        debtSnapshots: debtSnapshotRows.map((row) => ({
          debtId: row.debt_id,
          asOf: row.as_of,
          payoffBalanceCents: safeInteger(row.payoff_balance_cents),
          remainingPaymentCount: safeInteger(row.remaining_payment_count),
          remainingScheduledTotalCents: safeInteger(row.remaining_scheduled_total_cents),
        })),
        debtMilestones: debtMilestoneRows.map((row) => ({
          debtId: row.debt_id,
          date: row.date,
          balanceCents: safeInteger(row.balance_cents),
        })),
        reliefMilestones: reliefMilestoneRows.map((row) => ({
          date: row.date,
          monthlyReliefCents: safeInteger(row.monthly_relief_cents),
          event: row.event,
          eventDetail: row.event_detail,
        })),
      };

      const result = financeDataV1Schema.safeParse(candidate);
      if (!result.success) throw new FinanceDataIntegrityError('invalid_shape');
      assertCurrentSnapshots(result.data);
      return result.data;
    });
  }
}

const repositories = new Map<string, FinanceRepository>();

export function getFinanceRepository(databaseUrl: string): FinanceRepository {
  const existing = repositories.get(databaseUrl);
  if (existing) return existing;

  const repository = new PostgresFinanceRepository(getDatabase(databaseUrl));
  repositories.set(databaseUrl, repository);
  return repository;
}
