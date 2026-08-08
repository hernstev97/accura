import type { FinanceFixture } from '../types/finance';

/**
 * Einzige lokale Datenquelle der v0.1.
 * Dieses Objekt wird bei der späteren Google-Sheets-Anbindung durch einen
 * typisierten Adapter mit derselben FinanceFixture-Struktur ersetzt.
 */
export const financeFixture: FinanceFixture = {
  meta: {
    asOf: '2026-08-06',
    asOfLabel: '06.08.2026',
    monthlyIncome: 2048.18,
    remainingDebtPayments: 19372.05,
  },
  accounts: [
    { id: 'revolut', name: 'Revolut', balance: 288.84, kind: 'wallet' },
    { id: 'sparkasse', name: 'Sparkasse', balance: 16.98, kind: 'bank' },
  ],
  pockets: [
    { id: 'main', name: 'Hauptkonto', balance: 213.69, accountId: 'revolut' },
    { id: 'food', name: 'Essen', balance: 47.85, accountId: 'revolut' },
    { id: 'shared', name: 'Nina & Steven', balance: 27.12, accountId: 'revolut' },
    { id: 'license', name: 'Führerschein', balance: 0.18, accountId: 'revolut' },
    { id: 'holiday', name: 'Urlaub', balance: 0, accountId: 'revolut' },
    { id: 'technology', name: 'Technik', balance: 0, accountId: 'revolut' },
  ],
  budgetCategories: [
    { id: 'food', label: 'Lebensmittel', amount: 650, necessityId: 'essential', kind: 'expense' },
    { id: 'debt', label: 'Schulden', amount: 461.93, necessityId: 'essential', kind: 'expense' },
    { id: 'utilities', label: 'Nebenkosten', amount: 406.36, necessityId: 'necessary', kind: 'expense' },
    { id: 'savings', label: 'Rücklagen', amount: 145, necessityId: 'worthwhile', kind: 'reserve' },
    { id: 'internet', label: 'Internet', amount: 83.91, necessityId: 'necessary', kind: 'expense' },
    { id: 'subscription', label: 'Abos', amount: 72.19, necessityId: 'worthwhile', kind: 'expense' },
    { id: 'fitness', label: 'Fitness', amount: 55, necessityId: 'optional', kind: 'expense' },
    { id: 'insurance', label: 'Versicherungen', amount: 17.23, necessityId: 'essential', kind: 'expense' },
    { id: 'banking', label: 'Bankgebühren', amount: 13.99, necessityId: 'necessary', kind: 'expense' },
    { id: 'business', label: 'Gewerbe', amount: 1.25, necessityId: 'worthwhile', kind: 'expense' },
  ],
  necessityGroups: [
    { id: 'essential', label: 'Existentiell', amount: 1266.91, colorToken: '--chart-essential' },
    { id: 'necessary', label: 'Notwendig', amount: 483.87, colorToken: '--chart-necessary' },
    { id: 'worthwhile', label: 'Sinnvoll', amount: 132.21, colorToken: '--chart-worthwhile' },
    { id: 'optional', label: 'Optional', amount: 23.87, colorToken: '--chart-optional' },
  ],
  debtCreditors: [
    { id: 'dkb', name: 'DKB', payoffBalance: 13890.02, note: 'Ratenkredit' },
    { id: 'klarna', name: 'Klarna', payoffBalance: 432.91, note: 'Auslaufende Raten' },
  ],
  debtBalanceMilestones: [
    { date: '2026-08', label: 'August 2026', shortLabel: 'Aug. 26', balance: 13890.02 },
    { date: '2027-08', label: 'August 2027', shortLabel: 'Aug. 27', balance: 12315.83 },
    { date: '2028-08', label: 'August 2028', shortLabel: 'Aug. 28', balance: 10718.95 },
    { date: '2029-08', label: 'August 2029', shortLabel: 'Aug. 29', balance: 8970.55 },
    { date: '2030-08', label: 'August 2030', shortLabel: 'Aug. 30', balance: 7056.26 },
    { date: '2031-08', label: 'August 2031', shortLabel: 'Aug. 31', balance: 4960.32 },
    { date: '2032-08', label: 'August 2032', shortLabel: 'Aug. 32', balance: 2665.52 },
    { date: '2033-09', label: 'September 2033', shortLabel: 'Sep. 33', balance: 0 },
  ],
  debtReliefMilestones: [
    { date: '2026-08', label: 'Aktuell', freeAmount: 141.32, event: null, eventDetail: null },
    { date: '2026-10', label: 'Ab Oktober 2026', freeAmount: 305.32, event: 'Coolblue', eventDetail: 'endet im September 2026' },
    { date: '2026-12', label: 'Ab Dezember 2026', freeAmount: 323.57, event: 'Straight Outta Cotton', eventDetail: 'endet im November 2026' },
    { date: '2027-01', label: 'Ab Januar 2027', freeAmount: 328.58, event: 'Soulframe', eventDetail: 'endet im Dezember 2026' },
    { date: '2027-02', label: 'Ab Februar 2027', freeAmount: 367.37, event: 'Fabfilter', eventDetail: 'endet im Januar 2027' },
  ],
};
