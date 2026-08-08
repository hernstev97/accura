import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const milestoneDate = z.string().regex(/^\d{4}-\d{2}(?:-\d{2})?$/);
const cents = z.number().int().safe();

export const financeDataV1Schema = z.object({
  schemaVersion: z.literal(1),
  asOf: isoDate,
  currency: z.literal('EUR'),
  monthlyIncomeCents: cents,
  accounts: z.array(z.object({
    id,
    name: z.string().min(1),
    kind: z.enum(['bank', 'wallet', 'cash']),
    displayOrder: z.number().int().safe(),
    active: z.boolean(),
  })),
  accountSnapshots: z.array(z.object({ accountId: id, asOf: isoDate, balanceCents: cents })),
  pockets: z.array(z.object({
    id,
    accountId: id,
    name: z.string().min(1),
    displayOrder: z.number().int().safe(),
    active: z.boolean(),
  })),
  pocketSnapshots: z.array(z.object({ pocketId: id, asOf: isoDate, balanceCents: cents })),
  budgetItems: z.array(z.object({
    id,
    label: z.string().min(1),
    monthlyAmountCents: cents,
    necessityId: z.enum(['essential', 'necessary', 'worthwhile', 'optional', 'unnecessary']),
    kind: z.enum(['expense', 'reserve']),
    displayOrder: z.number().int().safe(),
    active: z.boolean(),
    note: z.string().nullable(),
  })),
  debts: z.array(z.object({
    id,
    name: z.string().min(1),
    kind: z.enum(['loan', 'installment']),
    monthlyPaymentCents: cents,
    displayOrder: z.number().int().safe(),
    active: z.boolean(),
    note: z.string().nullable(),
  })),
  debtSnapshots: z.array(z.object({ debtId: id, asOf: isoDate, payoffBalanceCents: cents, remainingPaymentsCents: cents })),
  debtMilestones: z.array(z.object({ debtId: id, date: milestoneDate, balanceCents: cents })),
  reliefMilestones: z.array(z.object({ date: milestoneDate, freeAmountCents: cents, event: z.string().min(1), eventDetail: z.string().nullable() })),
}).strict();
