import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FinanceDataIntegrityError,
  FinanceOwnerMappingError,
  PostgresFinanceRepository,
} from '../../api/_lib/financeRepository';
import { financeDataV1Schema } from '../../src/finance/runtime';
import { parseSheetsBatchResponse } from '../../src/finance/parser';
import {
  selectLatestAccountSnapshot,
  selectLatestDebtSnapshot,
  selectLatestPocketSnapshot,
} from '../../src/finance/selectors';
import { anonymousSheetsResponse } from '../../src/mocks/anonymousWorkbook';
import type { FinanceDataV1 } from '../../src/finance/types';

const databaseUrl = process.env.POSTGRES_TEST_URL;
if (!databaseUrl) {
  throw new Error('POSTGRES_TEST_URL is required for the PostgreSQL integration suite.');
}

const parsedFixture = parseSheetsBatchResponse(anonymousSheetsResponse);
if (!parsedFixture.success) throw new Error('Anonymous finance fixture must be valid.');
const fixture = parsedFixture.data;

const schema = `accura_test_${randomUUID().replaceAll('-', '')}`;
const adminSql = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => undefined });
const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connection: { search_path: schema },
});
const repository = new PostgresFinanceRepository(sql);
let schemaCreated = false;

const financeTables = [
  'finance_meta',
  'accounts',
  'account_snapshots',
  'pockets',
  'pocket_snapshots',
  'budget_items',
  'debts',
  'debt_snapshots',
  'debt_milestones',
  'relief_milestones',
] as const;

beforeAll(async () => {
  await adminSql`CREATE SCHEMA ${adminSql(schema)}`;
  schemaCreated = true;
  const migration001 = await readFile(new URL('../../migrations/001_google_connections.sql', import.meta.url), 'utf8');
  const migration002 = await readFile(new URL('../../migrations/002_finance_data_v1.sql', import.meta.url), 'utf8');
  const migration003 = await readFile(new URL('../../migrations/003_drop_google_connections.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration001);
  await sql.unsafe(migration002);
  await sql.unsafe(migration003);
});

beforeEach(async () => {
  await sql.unsafe(`TRUNCATE TABLE ${[
    ...financeTables,
    'owners',
  ].join(', ')}`);
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
  if (schemaCreated) await adminSql`DROP SCHEMA ${adminSql(schema)} CASCADE`;
  await adminSql.end({ timeout: 5 });
});

describe.sequential('Finance PostgreSQL migration and repository', () => {
  it('applies migrations 001 to 003 with non-null owner isolation on every finance table', async () => {
    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ${schema}
      ORDER BY table_name
    `;
    expect(tables.map(({ table_name }) => table_name)).toEqual(expect.arrayContaining([
      'owners',
      ...financeTables,
    ]));
    expect(tables.map(({ table_name }) => table_name)).not.toContain('google_connections');

    const ownerColumns = await sql<{ table_name: string; is_nullable: string }[]>`
      SELECT table_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = ${schema}
        AND column_name = 'owner_id'
        AND table_name IN ${sql(financeTables)}
      ORDER BY table_name
    `;
    expect(ownerColumns).toHaveLength(financeTables.length);
    expect(ownerColumns.every(({ is_nullable }) => is_nullable === 'NO')).toBe(true);
  });

  it('replaces and reconstructs the complete normalized anonymous fixture as runtime-valid FinanceDataV1', async () => {
    const written = await repository.replaceForGoogleSub('fixture-owner', fixture);
    const result = await repository.readForGoogleSub('fixture-owner');

    expect(written).toEqual(inRepositoryOrder(fixture));

    expect(financeDataV1Schema.safeParse(result).success).toBe(true);
    expect(result).toEqual(inRepositoryOrder(fixture));
    expect(result?.monthlyIncomeCents).toBe(259_132);
    expect(result?.budgetItems.some(({ note, dueDay }) => note === null && dueDay === null)).toBe(true);
    expect(result?.accounts.some(({ active }) => !active)).toBe(true);
    expect(result?.accountSnapshots).toContainEqual({
      accountId: 'daily-account',
      asOf: '2026-07-31',
      balanceCents: 110_000,
    });
  });

  it('replaces an existing owner stand without leaving previous rows', async () => {
    await repository.replaceForGoogleSub('replace-owner', fixture);
    await repository.replaceForGoogleSub('other-owner', fixture);
    const reduced = {
      ...fixture,
      monthlyIncomeCents: 1,
      accounts: fixture.accounts.filter(({ id }) => id === 'daily-account'),
      accountSnapshots: fixture.accountSnapshots.filter(({ accountId }) => accountId === 'daily-account'),
      pockets: [],
      pocketSnapshots: [],
      budgetItems: [],
      debts: [],
      debtSnapshots: [],
      debtMilestones: [],
      reliefMilestones: [],
    };

    const written = await repository.replaceForGoogleSub('replace-owner', reduced);

    expect(written.monthlyIncomeCents).toBe(1);
    expect(written.accounts).toHaveLength(1);
    expect(written.pockets).toHaveLength(0);
    expect(written.debts).toHaveLength(0);
    const [replaced] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
      FROM budget_items AS items
      JOIN owners ON owners.id = items.owner_id
      WHERE owners.google_sub = 'replace-owner'
    `;
    expect(replaced).toEqual({ count: '0' });
    const untouched = await repository.readForGoogleSub('other-owner');
    expect(untouched?.budgetItems).toHaveLength(fixture.budgetItems.length);
  });

  it('imports only for the sole owner established by verified sign-in', async () => {
    await expect(repository.replaceForSoleOwner(fixture)).rejects.toMatchObject<FinanceOwnerMappingError>({ reason: 'missing' });

    await repository.ensureOwnerForGoogleSub('verified-owner');
    await expect(repository.replaceForSoleOwner(fixture)).resolves.toEqual(inRepositoryOrder(fixture));

    await repository.ensureOwnerForGoogleSub('second-verified-owner');
    await expect(repository.replaceForSoleOwner(fixture)).rejects.toMatchObject<FinanceOwnerMappingError>({ reason: 'ambiguous' });
  });

  it('preserves negative amounts and distinguishes month from day milestone precision', async () => {
    const ownerId = await createOwner('precision-owner');
    await insertFinanceData(ownerId, fixture);
    await sql`
      INSERT INTO account_snapshots (owner_id, account_id, as_of, balance_cents)
      VALUES (${ownerId}, 'old-account', '2026-08-01', -12345)
    `;
    await sql`
      INSERT INTO debt_milestones (owner_id, debt_id, milestone_date, date_precision, balance_cents)
      VALUES (${ownerId}, 'primary-loan', '2026-08-01', 'day', -99)
    `;
    await sql`
      INSERT INTO relief_milestones (
        owner_id, milestone_date, date_precision, monthly_relief_cents, event, event_detail
      ) VALUES (${ownerId}, '2026-09-01', 'day', -17, 'Tagesereignis', NULL)
    `;

    const result = await repository.readForGoogleSub('precision-owner');

    expect(result?.accountSnapshots).toContainEqual({
      accountId: 'old-account',
      asOf: '2026-08-01',
      balanceCents: -12_345,
    });
    expect(result?.debtMilestones).toEqual(expect.arrayContaining([
      { debtId: 'primary-loan', date: '2026-08', balanceCents: 1_234_567 },
      { debtId: 'primary-loan', date: '2026-08-01', balanceCents: -99 },
    ]));
    expect(result?.reliefMilestones).toEqual(expect.arrayContaining([
      { date: '2026-09', monthlyReliefCents: 12_000, event: 'Finanzierung A', eventDetail: 'Letzte Rate' },
      { date: '2026-09-01', monthlyReliefCents: -17, event: 'Tagesereignis', eventDetail: null },
    ]));
  });

  it('returns null when the owner or finance_meta row is absent', async () => {
    await createOwner('owner-without-meta');

    await expect(repository.readForGoogleSub('unknown-owner')).resolves.toBeNull();
    await expect(repository.readForGoogleSub('owner-without-meta')).resolves.toBeNull();
  });

  it('allows equal domain IDs for two owners and never returns the other owner rows', async () => {
    const ownerA = await createOwner('owner-a');
    const ownerB = await createOwner('owner-b');
    await insertFinanceData(ownerA, fixture);
    await insertFinanceData(ownerB, {
      ...fixture,
      monthlyIncomeCents: -777,
      accounts: fixture.accounts.map((account) => account.id === 'daily-account'
        ? { ...account, name: 'Owner B Konto' }
        : account),
    });

    const resultA = await repository.readForGoogleSub('owner-a');
    const resultB = await repository.readForGoogleSub('owner-b');

    expect(resultA?.monthlyIncomeCents).toBe(fixture.monthlyIncomeCents);
    expect(resultA?.accounts.find(({ id }) => id === 'daily-account')?.name).toBe('Alltagskonto');
    expect(resultB?.monthlyIncomeCents).toBe(-777);
    expect(resultB?.accounts.find(({ id }) => id === 'daily-account')?.name).toBe('Owner B Konto');
  });

  it('rejects cross-owner references in PostgreSQL', async () => {
    const ownerA = await createOwner('reference-owner-a');
    const ownerB = await createOwner('reference-owner-b');
    await sql`
      INSERT INTO accounts (owner_id, id, name, kind, display_order, active)
      VALUES (${ownerA}, 'shared-account', 'A', 'bank', 1, TRUE)
    `;

    await expect(sql`
      INSERT INTO pockets (owner_id, id, account_id, name, display_order, active)
      VALUES (${ownerB}, 'foreign-pocket', 'shared-account', 'Fremd', 1, TRUE)
    `).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects duplicate domain keys', async () => {
    const ownerId = await createOwner('duplicate-owner');
    await sql`
      INSERT INTO accounts (owner_id, id, name, kind, display_order, active)
      VALUES (${ownerId}, 'duplicate-account', 'Erstes Konto', 'bank', 1, TRUE)
    `;

    await expect(sql`
      INSERT INTO accounts (owner_id, id, name, kind, display_order, active)
      VALUES (${ownerId}, 'duplicate-account', 'Zweites Konto', 'cash', 2, TRUE)
    `).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects invalid due days, enums, blank optional text, and unsafe integers', async () => {
    const ownerId = await createOwner('constraint-owner');

    await expect(sql`
      INSERT INTO budget_items (
        owner_id, id, label, monthly_amount_cents, necessity_id, kind,
        display_order, active, note, due_day
      ) VALUES (${ownerId}, 'bad-day', 'Tag', 1, 'essential', 'expense', 1, TRUE, NULL, 32)
    `).rejects.toMatchObject({ code: '23514' });
    await expect(sql`
      INSERT INTO accounts (owner_id, id, name, kind, display_order, active)
      VALUES (${ownerId}, 'bad-kind', 'Konto', 'crypto', 1, TRUE)
    `).rejects.toMatchObject({ code: '23514' });
    await expect(sql`
      INSERT INTO debts (
        owner_id, id, name, kind, monthly_payment_cents, display_order, active, note, due_day
      ) VALUES (${ownerId}, 'blank-note', 'Schuld', 'loan', 1, 1, TRUE, '   ', NULL)
    `).rejects.toMatchObject({ code: '23514' });
    await expect(sql`
      INSERT INTO finance_meta (
        owner_id, schema_version, as_of, currency, monthly_income_cents, salary_day
      ) VALUES (${ownerId}, 1, '2026-08-08', 'EUR', 9007199254740992, NULL)
    `).rejects.toMatchObject({ code: '23514' });
  });

  it('returns all historical and future snapshots while selectors keep choosing the domain-current row', async () => {
    const ownerId = await createOwner('snapshot-owner');
    await insertFinanceData(ownerId, fixture);
    await sql`
      INSERT INTO account_snapshots (owner_id, account_id, as_of, balance_cents)
      VALUES
        (${ownerId}, 'daily-account', '2025-01-01', 1),
        (${ownerId}, 'daily-account', '2027-01-01', 999999)
    `;

    const result = await repository.readForGoogleSub('snapshot-owner');
    expect(result?.accountSnapshots.filter(({ accountId }) => accountId === 'daily-account')).toHaveLength(4);
    expect(selectLatestAccountSnapshot(result!, 'daily-account')).toEqual({
      accountId: 'daily-account',
      asOf: '2026-08-08',
      balanceCents: 120_025,
    });
  });

  it('reports active entities without a current snapshot as a sanitized integrity error', async () => {
    const ownerId = await createOwner('broken-owner');
    await insertMeta(ownerId, fixture);
    await sql`
      INSERT INTO accounts (owner_id, id, name, kind, display_order, active)
      VALUES (${ownerId}, 'sensitive-account-id', 'Geheimer Kontoname', 'bank', 1, TRUE)
    `;

    let caught: unknown;
    try {
      await repository.readForGoogleSub('broken-owner');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(FinanceDataIntegrityError);
    expect(caught).toMatchObject({
      code: 'finance_data_integrity_error',
      reason: 'missing_current_snapshot',
      message: 'Stored finance data failed integrity validation.',
    });
    const serialized = JSON.stringify(caught);
    expect(serialized).not.toContain('sensitive-account-id');
    expect(serialized).not.toContain('Geheimer Kontoname');
    expect(serialized).not.toContain(String(fixture.monthlyIncomeCents));
  });

  it('delivers identical cents from the parser and the postgres reader for the anonymous fixture', async () => {
    const ownerId = await createOwner('parity-cents-owner');
    await insertFinanceData(ownerId, fixture);

    const fromParser = fixture;
    const fromPostgres = requireStoredFinanceData(await repository.readForGoogleSub('parity-cents-owner'));

    const parserCents = moneyCentsByStableKey(fromParser);
    const postgresCents = moneyCentsByStableKey(fromPostgres);

    expect(parserCents).toHaveLength(ANONYMOUS_FIXTURE_MONEY_FIELD_COUNT);
    expect(parserCents).toContainEqual(['meta.monthlyIncomeCents', 259_132]);
    expect(postgresCents).toEqual(parserCents);
  });

  it('selects the same current snapshots from parser and postgres data for the anonymous fixture', async () => {
    const ownerId = await createOwner('parity-snapshot-owner');
    await insertFinanceData(ownerId, fixture);
    await sql`
      INSERT INTO account_snapshots (owner_id, account_id, as_of, balance_cents)
      VALUES
        (${ownerId}, 'daily-account', '2025-01-01', 1),
        (${ownerId}, 'daily-account', '2027-01-01', 999999)
    `;
    await sql`
      INSERT INTO pocket_snapshots (owner_id, pocket_id, as_of, balance_cents)
      VALUES
        (${ownerId}, 'home-reserve', '2025-01-01', 1),
        (${ownerId}, 'home-reserve', '2027-01-01', 999999)
    `;
    await sql`
      INSERT INTO debt_snapshots (
        owner_id, debt_id, as_of, payoff_balance_cents,
        remaining_payment_count, remaining_scheduled_total_cents
      ) VALUES
        (${ownerId}, 'primary-loan', '2025-01-01', 1, 1, 1),
        (${ownerId}, 'primary-loan', '2027-01-01', 999999, 1, 1)
    `;

    const fromPostgres = requireStoredFinanceData(await repository.readForGoogleSub('parity-snapshot-owner'));
    expect(fromPostgres.accountSnapshots.length).toBeGreaterThan(fixture.accountSnapshots.length);
    expect(fromPostgres.pocketSnapshots.length).toBeGreaterThan(fixture.pocketSnapshots.length);
    expect(fromPostgres.debtSnapshots.length).toBeGreaterThan(fixture.debtSnapshots.length);

    expect(selectedSnapshotsById(fromPostgres)).toEqual(selectedSnapshotsById(fixture));
  });

  it('delivers identical salary and due days from the parser and the postgres reader', async () => {
    const ownerId = await createOwner('parity-due-day-owner');
    await insertFinanceData(ownerId, fixture);

    const fromPostgres = requireStoredFinanceData(await repository.readForGoogleSub('parity-due-day-owner'));

    const parserDays = dueDaysByStableKey(fixture);
    const postgresDays = dueDaysByStableKey(fromPostgres);

    expect(parserDays['meta.salaryDay']).toBe(25);
    expect(Object.values(parserDays).some((day) => day === null)).toBe(true);
    expect(postgresDays).toEqual(parserDays);
  });
});

async function createOwner(googleSub: string): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO owners (google_sub)
    VALUES (${googleSub})
    RETURNING id
  `;
  return rows[0]!.id;
}

async function insertMeta(ownerId: string, data: FinanceDataV1): Promise<void> {
  await sql`
    INSERT INTO finance_meta (
      owner_id, schema_version, as_of, currency, monthly_income_cents, salary_day
    ) VALUES (
      ${ownerId}, ${data.schemaVersion}, ${data.asOf}, ${data.currency},
      ${data.monthlyIncomeCents}, ${data.salaryDay}
    )
  `;
}

async function insertFinanceData(ownerId: string, data: FinanceDataV1): Promise<void> {
  await insertMeta(ownerId, data);
  for (const account of data.accounts) {
    await sql`
      INSERT INTO accounts (owner_id, id, name, kind, display_order, active)
      VALUES (
        ${ownerId}, ${account.id}, ${account.name}, ${account.kind},
        ${account.displayOrder}, ${account.active}
      )
    `;
  }
  for (const snapshot of data.accountSnapshots) {
    await sql`
      INSERT INTO account_snapshots (owner_id, account_id, as_of, balance_cents)
      VALUES (${ownerId}, ${snapshot.accountId}, ${snapshot.asOf}, ${snapshot.balanceCents})
    `;
  }
  for (const pocket of data.pockets) {
    await sql`
      INSERT INTO pockets (owner_id, id, account_id, name, display_order, active)
      VALUES (
        ${ownerId}, ${pocket.id}, ${pocket.accountId}, ${pocket.name},
        ${pocket.displayOrder}, ${pocket.active}
      )
    `;
  }
  for (const snapshot of data.pocketSnapshots) {
    await sql`
      INSERT INTO pocket_snapshots (owner_id, pocket_id, as_of, balance_cents)
      VALUES (${ownerId}, ${snapshot.pocketId}, ${snapshot.asOf}, ${snapshot.balanceCents})
    `;
  }
  for (const item of data.budgetItems) {
    await sql`
      INSERT INTO budget_items (
        owner_id, id, label, monthly_amount_cents, necessity_id, kind,
        display_order, active, note, due_day
      ) VALUES (
        ${ownerId}, ${item.id}, ${item.label}, ${item.monthlyAmountCents},
        ${item.necessityId}, ${item.kind}, ${item.displayOrder}, ${item.active},
        ${item.note}, ${item.dueDay}
      )
    `;
  }
  for (const debt of data.debts) {
    await sql`
      INSERT INTO debts (
        owner_id, id, name, kind, monthly_payment_cents, display_order,
        active, note, due_day
      ) VALUES (
        ${ownerId}, ${debt.id}, ${debt.name}, ${debt.kind},
        ${debt.monthlyPaymentCents}, ${debt.displayOrder}, ${debt.active},
        ${debt.note}, ${debt.dueDay}
      )
    `;
  }
  for (const snapshot of data.debtSnapshots) {
    await sql`
      INSERT INTO debt_snapshots (
        owner_id, debt_id, as_of, payoff_balance_cents,
        remaining_payment_count, remaining_scheduled_total_cents
      ) VALUES (
        ${ownerId}, ${snapshot.debtId}, ${snapshot.asOf}, ${snapshot.payoffBalanceCents},
        ${snapshot.remainingPaymentCount}, ${snapshot.remainingScheduledTotalCents}
      )
    `;
  }
  for (const milestone of data.debtMilestones) {
    const precision = milestone.date.length === 7 ? 'month' : 'day';
    const date = precision === 'month' ? `${milestone.date}-01` : milestone.date;
    await sql`
      INSERT INTO debt_milestones (
        owner_id, debt_id, milestone_date, date_precision, balance_cents
      ) VALUES (${ownerId}, ${milestone.debtId}, ${date}, ${precision}, ${milestone.balanceCents})
    `;
  }
  for (const milestone of data.reliefMilestones) {
    const precision = milestone.date.length === 7 ? 'month' : 'day';
    const date = precision === 'month' ? `${milestone.date}-01` : milestone.date;
    await sql`
      INSERT INTO relief_milestones (
        owner_id, milestone_date, date_precision, monthly_relief_cents, event, event_detail
      ) VALUES (
        ${ownerId}, ${date}, ${precision}, ${milestone.monthlyReliefCents},
        ${milestone.event}, ${milestone.eventDetail}
      )
    `;
  }
}

const ANONYMOUS_FIXTURE_MONEY_FIELD_COUNT = 53;

function requireStoredFinanceData(data: FinanceDataV1 | null): FinanceDataV1 {
  if (!data) throw new Error('Expected stored FinanceDataV1 from the postgres reader.');
  return data;
}

function moneyCentsByStableKey(data: FinanceDataV1): Array<[string, number]> {
  const entries: Array<[string, number]> = [
    ['meta.monthlyIncomeCents', data.monthlyIncomeCents],
    ...data.accountSnapshots.map((row) => [
      `accountSnapshots.${row.accountId}.${row.asOf}`,
      row.balanceCents,
    ] as [string, number]),
    ...data.pocketSnapshots.map((row) => [
      `pocketSnapshots.${row.pocketId}.${row.asOf}`,
      row.balanceCents,
    ] as [string, number]),
    ...data.budgetItems.map((row) => [
      `budgetItems.${row.id}.monthlyAmountCents`,
      row.monthlyAmountCents,
    ] as [string, number]),
    ...data.debts.map((row) => [
      `debts.${row.id}.monthlyPaymentCents`,
      row.monthlyPaymentCents,
    ] as [string, number]),
    ...data.debtSnapshots.flatMap((row) => [
      [`debtSnapshots.${row.debtId}.${row.asOf}.payoffBalanceCents`, row.payoffBalanceCents],
      [`debtSnapshots.${row.debtId}.${row.asOf}.remainingScheduledTotalCents`, row.remainingScheduledTotalCents],
    ] as Array<[string, number]>),
    ...data.debtMilestones.map((row) => [
      `debtMilestones.${row.debtId}.${row.date}`,
      row.balanceCents,
    ] as [string, number]),
    ...data.reliefMilestones.map((row) => [
      `reliefMilestones.${row.date}.${row.event}.${row.eventDetail ?? ''}`,
      row.monthlyReliefCents,
    ] as [string, number]),
  ];
  return entries.sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    compareText(leftKey, rightKey) || leftValue - rightValue);
}

function dueDaysByStableKey(data: FinanceDataV1): Record<string, number | null> {
  const entries: Array<[string, number | null]> = [
    ['meta.salaryDay', data.salaryDay],
    ...data.budgetItems.map((row) => [`budgetItems.${row.id}.dueDay`, row.dueDay] as [string, number | null]),
    ...data.debts.map((row) => [`debts.${row.id}.dueDay`, row.dueDay] as [string, number | null]),
  ];
  return Object.fromEntries(entries.sort(([left], [right]) => compareText(left, right)));
}

function selectedSnapshotsById(data: FinanceDataV1) {
  return {
    accounts: Object.fromEntries(
      data.accounts.map((account) => [account.id, selectLatestAccountSnapshot(data, account.id) ?? null]),
    ),
    pockets: Object.fromEntries(
      data.pockets.map((pocket) => [pocket.id, selectLatestPocketSnapshot(data, pocket.id) ?? null]),
    ),
    debts: Object.fromEntries(
      data.debts.map((debt) => [debt.id, selectLatestDebtSnapshot(data, debt.id) ?? null]),
    ),
  };
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function inRepositoryOrder(data: FinanceDataV1): FinanceDataV1 {
  const result = structuredClone(data);
  const compareEntities = (left: { displayOrder: number; id: string }, right: { displayOrder: number; id: string }) =>
    left.displayOrder - right.displayOrder || compareText(left.id, right.id);
  result.accounts.sort(compareEntities);
  result.pockets.sort(compareEntities);
  result.budgetItems.sort(compareEntities);
  result.debts.sort(compareEntities);

  const accountOrder = new Map(result.accounts.map((account, index) => [account.id, index]));
  const pocketOrder = new Map(result.pockets.map((pocket, index) => [pocket.id, index]));
  const debtOrder = new Map(result.debts.map((debt, index) => [debt.id, index]));
  result.accountSnapshots.sort((left, right) =>
    accountOrder.get(left.accountId)! - accountOrder.get(right.accountId)!
    || compareText(left.accountId, right.accountId)
    || compareText(left.asOf, right.asOf));
  result.pocketSnapshots.sort((left, right) =>
    pocketOrder.get(left.pocketId)! - pocketOrder.get(right.pocketId)!
    || compareText(left.pocketId, right.pocketId)
    || compareText(left.asOf, right.asOf));
  result.debtSnapshots.sort((left, right) =>
    debtOrder.get(left.debtId)! - debtOrder.get(right.debtId)!
    || compareText(left.debtId, right.debtId)
    || compareText(left.asOf, right.asOf));
  result.debtMilestones.sort((left, right) =>
    compareText(`${left.date}-01`.slice(0, 10), `${right.date}-01`.slice(0, 10))
    || debtOrder.get(left.debtId)! - debtOrder.get(right.debtId)!
    || compareText(left.debtId, right.debtId)
    || compareText(left.date.length === 7 ? 'month' : 'day', right.date.length === 7 ? 'month' : 'day'));
  result.reliefMilestones.sort((left, right) =>
    compareText(`${left.date}-01`.slice(0, 10), `${right.date}-01`.slice(0, 10))
    || compareText(left.event, right.event)
    || compareText(left.eventDetail ?? '', right.eventDetail ?? ''));
  return result;
}
