import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const milestoneDatePattern = /^\d{4}-\d{2}(?:-\d{2})?$/;
const isActualDate = (value: string) => {
  if (!isoDatePattern.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
const isActualMilestoneDate = (value: string) => {
  if (!milestoneDatePattern.test(value) || value.startsWith('0000-')) return false;
  if (value.length === 7) {
    const month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12;
  }
  return isActualDate(value);
};
const isoDate = z.string().refine(isActualDate);
const milestoneDate = z.string().refine(isActualMilestoneDate);
const cents = z.number().int().safe();
const count = z.number().int().safe().nonnegative();
const nonBlankText = z.string().refine((value) => value.trim().length > 0);
const optionalText = nonBlankText.nullable();

export const financeDataV1Schema = z.object({
  schemaVersion: z.literal(1),
  asOf: isoDate,
  currency: z.literal('EUR'),
  monthlyIncomeCents: cents,
  salaryDay: z.number().int().min(1).max(31).nullable(),
  accounts: z.array(z.object({
    id,
    name: nonBlankText,
    kind: z.enum(['bank', 'wallet', 'cash']),
    displayOrder: z.number().int().safe(),
    active: z.boolean(),
  })),
  accountSnapshots: z.array(z.object({ accountId: id, asOf: isoDate, balanceCents: cents })),
  pockets: z.array(z.object({
    id,
    accountId: id,
    name: nonBlankText,
    displayOrder: z.number().int().safe(),
    active: z.boolean(),
  })),
  pocketSnapshots: z.array(z.object({ pocketId: id, asOf: isoDate, balanceCents: cents })),
  budgetItems: z.array(z.object({
    id,
    label: nonBlankText,
    monthlyAmountCents: cents,
    necessityId: z.enum(['essential', 'necessary', 'worthwhile', 'optional', 'unnecessary']),
    kind: z.enum(['expense', 'reserve']),
    displayOrder: z.number().int().safe(),
    active: z.boolean(),
    note: optionalText,
    dueDay: z.number().int().min(1).max(31).nullable(),
  })),
  debts: z.array(z.object({
    id,
    name: nonBlankText,
    kind: z.enum(['loan', 'installment']),
    monthlyPaymentCents: cents,
    displayOrder: z.number().int().safe(),
    active: z.boolean(),
    note: optionalText,
    dueDay: z.number().int().min(1).max(31).nullable(),
  })),
  debtSnapshots: z.array(z.object({
    debtId: id,
    asOf: isoDate,
    payoffBalanceCents: cents,
    remainingPaymentCount: count,
    remainingScheduledTotalCents: cents,
  })),
  debtMilestones: z.array(z.object({ debtId: id, date: milestoneDate, balanceCents: cents })),
  reliefMilestones: z.array(z.object({ date: milestoneDate, monthlyReliefCents: cents, event: nonBlankText, eventDetail: optionalText })),
}).strict().superRefine((data, context) => {
  const unique = <T>(values: T[], key: (value: T) => string, path: (number | string)[]) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      const candidate = key(value);
      if (seen.has(candidate)) {
        context.addIssue({ code: 'custom', message: 'Doppelter Schlüssel.', path: [...path, index] });
      }
      seen.add(candidate);
    });
  };
  const knownReference = <T>(
    values: T[],
    reference: (value: T) => string,
    known: Set<string>,
    path: (number | string)[],
  ) => values.forEach((value, index) => {
    if (!known.has(reference(value))) {
      context.addIssue({ code: 'custom', message: 'Referenzierte Entität fehlt.', path: [...path, index] });
    }
  });

  unique(data.accounts, ({ id: value }) => value, ['accounts']);
  unique(data.accountSnapshots, (value) => `${value.accountId}|${value.asOf}`, ['accountSnapshots']);
  unique(data.pockets, ({ id: value }) => value, ['pockets']);
  unique(data.pocketSnapshots, (value) => `${value.pocketId}|${value.asOf}`, ['pocketSnapshots']);
  unique(data.budgetItems, ({ id: value }) => value, ['budgetItems']);
  unique(data.debts, ({ id: value }) => value, ['debts']);
  unique(data.debtSnapshots, (value) => `${value.debtId}|${value.asOf}`, ['debtSnapshots']);
  unique(data.debtMilestones, (value) => `${value.debtId}|${value.date}`, ['debtMilestones']);

  const accountIds = new Set(data.accounts.map(({ id: value }) => value));
  const pocketIds = new Set(data.pockets.map(({ id: value }) => value));
  const debtIds = new Set(data.debts.map(({ id: value }) => value));
  knownReference(data.accountSnapshots, ({ accountId }) => accountId, accountIds, ['accountSnapshots']);
  knownReference(data.pockets, ({ accountId }) => accountId, accountIds, ['pockets']);
  knownReference(data.pocketSnapshots, ({ pocketId }) => pocketId, pocketIds, ['pocketSnapshots']);
  knownReference(data.debtSnapshots, ({ debtId }) => debtId, debtIds, ['debtSnapshots']);
  knownReference(data.debtMilestones, ({ debtId }) => debtId, debtIds, ['debtMilestones']);
});
