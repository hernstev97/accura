import { anonymousFinanceData } from './anonymous-finance-data.mjs';

const cloneBase = () => structuredClone(anonymousFinanceData);

export const extremeOverdrawnFinanceData = (() => {
  const data = cloneBase();
  data.monthlyIncomeCents = 12_345_678_901;
  data.accounts = [
    { id: 'investment-account', name: 'Langfristiges Vermögenskonto', kind: 'bank', displayOrder: 1, active: true },
    { id: 'overdraft-account', name: 'Gemeinschaftskonto mit eingeräumtem Dispokredit', kind: 'bank', displayOrder: 2, active: true },
    { id: 'cash-reserve', name: 'Bargeldreserve', kind: 'cash', displayOrder: 3, active: true },
  ];
  data.accountSnapshots = [
    { accountId: 'investment-account', asOf: data.asOf, balanceCents: 98_765_432_109 },
    { accountId: 'overdraft-account', asOf: data.asOf, balanceCents: -123_456_789_012 },
    { accountId: 'cash-reserve', asOf: data.asOf, balanceCents: 1_234_567_890 },
  ];
  data.pockets = [
    { id: 'property-reserve', accountId: 'investment-account', name: 'Rücklage für langfristige Immobilieninstandhaltung', displayOrder: 1, active: true },
    { id: 'tax-adjustment', accountId: 'overdraft-account', name: 'Steuernachzahlung', displayOrder: 2, active: true },
    { id: 'later', accountId: 'investment-account', name: 'Später', displayOrder: 3, active: true },
  ];
  data.pocketSnapshots = [
    { pocketId: 'property-reserve', asOf: data.asOf, balanceCents: 1_234_567_890 },
    { pocketId: 'tax-adjustment', asOf: data.asOf, balanceCents: -987_654_321 },
    { pocketId: 'later', asOf: data.asOf, balanceCents: 0 },
  ];
  data.budgetItems = [
    { id: 'housing', label: 'Wohnen und laufende Gebäudekosten', monthlyAmountCents: 15_000_000_000, necessityId: 'essential', kind: 'expense', displayOrder: 1, active: true, note: null, dueDay: 12 },
    { id: 'reserves', label: 'Langfristige Rücklagen', monthlyAmountCents: 7_000_000_000, necessityId: 'worthwhile', kind: 'reserve', displayOrder: 2, active: true, note: null, dueDay: null },
    { id: 'operations', label: 'Betriebliche Verpflichtungen', monthlyAmountCents: 1_456_789_012, necessityId: 'necessary', kind: 'expense', displayOrder: 3, active: true, note: null, dueDay: 18 },
  ];
  data.debts = [
    { id: 'property-loan', name: 'Langfristige Immobilienfinanzierung', kind: 'loan', monthlyPaymentCents: 45_678_901, displayOrder: 1, active: true, note: 'Planmäßige Finanzierung', dueDay: 20 },
  ];
  data.debtSnapshots = [
    { debtId: 'property-loan', asOf: data.asOf, payoffBalanceCents: 76_543_210_987, remainingPaymentCount: 240, remainingScheduledTotalCents: 87_654_321_098 },
  ];
  data.debtMilestones = [
    { debtId: 'property-loan', date: '2026-08', balanceCents: 76_543_210_987 },
    { debtId: 'property-loan', date: '2036-08', balanceCents: 38_271_605_493 },
    { debtId: 'property-loan', date: '2046-08', balanceCents: 0 },
  ];
  data.reliefMilestones = [
    { date: '2046-08', monthlyReliefCents: 45_678_901, event: 'Immobilienfinanzierung', eventDetail: 'Letzte Rate' },
  ];
  return data;
})();

export const emptyCollectionsFinanceData = (() => {
  const data = cloneBase();
  data.accounts = [];
  data.accountSnapshots = [];
  data.pockets = [];
  data.pocketSnapshots = [];
  data.budgetItems = [];
  data.debts = [];
  data.debtSnapshots = [];
  data.debtMilestones = [];
  data.reliefMilestones = [];
  return data;
})();

export const denseOverviewFinanceData = (() => {
  const data = cloneBase();
  data.accounts = Array.from({ length: 12 }, (_, index) => ({
    id: `account-${index + 1}`,
    name: `Haushaltskonto für laufende Ausgaben ${String(index + 1).padStart(2, '0')}`,
    kind: index % 4 === 3 ? 'cash' : index % 3 === 2 ? 'wallet' : 'bank',
    displayOrder: index + 1,
    active: true,
  }));
  data.accountSnapshots = data.accounts.map((account, index) => ({
    accountId: account.id,
    asOf: data.asOf,
    balanceCents: (index + 1) * 123_456,
  }));
  data.pockets = Array.from({ length: 18 }, (_, index) => ({
    id: `pocket-${index + 1}`,
    accountId: data.accounts[index % data.accounts.length].id,
    name: `Rücklage für jährliche Verpflichtung ${String(index + 1).padStart(2, '0')}`,
    displayOrder: index + 1,
    active: true,
  }));
  data.pocketSnapshots = data.pockets.map((pocket, index) => ({
    pocketId: pocket.id,
    asOf: data.asOf,
    balanceCents: [5, 11, 17].includes(index) ? 0 : (index + 1) * 23_456,
  }));
  return data;
})();
