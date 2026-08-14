export const anonymousFinanceData = {
  schemaVersion: 1,
  asOf: '2026-08-08',
  currency: 'EUR',
  monthlyIncomeCents: 259132,
  salaryDay: 25,
  accounts: [
    { id: 'daily-account', name: 'Alltagskonto', kind: 'bank', displayOrder: 1, active: true },
    { id: 'travel-wallet', name: 'Reise-Wallet', kind: 'wallet', displayOrder: 2, active: true },
    { id: 'cash-box', name: 'Bargeld', kind: 'cash', displayOrder: 3, active: true },
  ],
  accountSnapshots: [
    { accountId: 'daily-account', asOf: '2026-07-31', balanceCents: 110000 },
    { accountId: 'daily-account', asOf: '2026-08-08', balanceCents: 120025 },
    { accountId: 'travel-wallet', asOf: '2026-08-08', balanceCents: 12050 },
    { accountId: 'cash-box', asOf: '2026-08-08', balanceCents: 3000 },
  ],
  pockets: [
    { id: 'home-reserve', accountId: 'daily-account', name: 'Wohnen', displayOrder: 1, active: true },
    { id: 'food-reserve', accountId: 'daily-account', name: 'Lebensmittel', displayOrder: 2, active: true },
    { id: 'trip-reserve', accountId: 'travel-wallet', name: 'Reise', displayOrder: 3, active: true },
    { id: 'tech-reserve', accountId: 'daily-account', name: 'Technik', displayOrder: 4, active: true },
    { id: 'gift-reserve', accountId: 'daily-account', name: 'Geschenke', displayOrder: 5, active: true },
    { id: 'empty-reserve', accountId: 'daily-account', name: 'Später', displayOrder: 6, active: true },
  ],
  pocketSnapshots: [
    { pocketId: 'home-reserve', asOf: '2026-08-08', balanceCents: 30000 },
    { pocketId: 'food-reserve', asOf: '2026-08-08', balanceCents: 15025 },
    { pocketId: 'trip-reserve', asOf: '2026-08-08', balanceCents: 7500 },
    { pocketId: 'tech-reserve', asOf: '2026-08-08', balanceCents: 0 },
    { pocketId: 'gift-reserve', asOf: '2026-08-08', balanceCents: 2500 },
    { pocketId: 'empty-reserve', asOf: '2026-08-08', balanceCents: 0 },
  ],
  budgetItems: [
    ['housing', 'Wohnen', 100000, 'essential', 'expense', 1, 1],
    ['groceries', 'Lebensmittel', 50000, 'essential', 'expense', 2, 5],
    ['reserve', 'Rücklagen', 30000, 'worthwhile', 'reserve', 3, null],
    ['utilities', 'Nebenkosten', 20000, 'necessary', 'expense', 4, null],
    ['mobility', 'Mobilität', 15000, 'necessary', 'expense', 5, null],
    ['insurance', 'Versicherungen', 10000, 'essential', 'expense', 6, 15],
    ['fitness', 'Fitness', 6000, 'optional', 'expense', 7, null],
    ['internet', 'Internet', 5000, 'necessary', 'expense', 8, null],
    ['gifts', 'Geschenke', 5000, 'unnecessary', 'expense', 9, null],
    ['subscriptions', 'Abos', 4000, 'optional', 'expense', 10, null],
  ].map(([id, label, monthlyAmountCents, necessityId, kind, displayOrder, dueDay]) => ({ id, label, monthlyAmountCents, necessityId, kind, displayOrder, active: true, note: null, dueDay })),
  debts: [
    { id: 'primary-loan', name: 'Ratenkredit', kind: 'loan', monthlyPaymentCents: 25000, displayOrder: 1, active: true, note: 'Interner Quellhinweis', dueDay: 20 },
    { id: 'installment-a', name: 'Finanzierung A', kind: 'installment', monthlyPaymentCents: 12000, displayOrder: 2, active: true, note: 'Letzte Rate im September 2026', dueDay: null },
    { id: 'installment-b', name: 'Finanzierung B', kind: 'installment', monthlyPaymentCents: 6000, displayOrder: 3, active: true, note: 'Vier verbleibende Raten', dueDay: null },
    { id: 'installment-c', name: 'Finanzierung C', kind: 'installment', monthlyPaymentCents: 3000, displayOrder: 4, active: true, note: 'Drei verbleibende Raten', dueDay: null },
    { id: 'installment-d', name: 'Finanzierung D', kind: 'installment', monthlyPaymentCents: 1500, displayOrder: 5, active: true, note: 'Zwei verbleibende Raten', dueDay: null },
  ],
  debtSnapshots: [
    { debtId: 'primary-loan', asOf: '2026-08-08', payoffBalanceCents: 1234567, remainingPaymentCount: 60, remainingScheduledTotalCents: 1500000 },
    { debtId: 'installment-a', asOf: '2026-08-08', payoffBalanceCents: 12000, remainingPaymentCount: 1, remainingScheduledTotalCents: 12000 },
    { debtId: 'installment-b', asOf: '2026-08-08', payoffBalanceCents: 24000, remainingPaymentCount: 4, remainingScheduledTotalCents: 24000 },
    { debtId: 'installment-c', asOf: '2026-08-08', payoffBalanceCents: 9000, remainingPaymentCount: 3, remainingScheduledTotalCents: 9000 },
    { debtId: 'installment-d', asOf: '2026-08-08', payoffBalanceCents: 3000, remainingPaymentCount: 2, remainingScheduledTotalCents: 3000 },
  ],
  debtMilestones: [
    ['primary-loan', '2026-08', 1234567], ['installment-a', '2026-08', 12000], ['installment-b', '2026-08', 24000],
    ['installment-c', '2026-08', 9000], ['installment-d', '2026-08', 3000],
    ['installment-a', '2026-09', 0], ['installment-c', '2026-10', 0], ['installment-d', '2026-12', 0],
    ['primary-loan', '2027-01', 1100000], ['installment-b', '2027-01', 0],
    ['primary-loan', '2029-01', 500000], ['primary-loan', '2031-08', 0],
  ].map(([debtId, date, balanceCents]) => ({ debtId, date, balanceCents })),
  reliefMilestones: [
    { date: '2031-08', monthlyReliefCents: 25000, event: 'Ratenkredit', eventDetail: 'Letzte Rate' },
    { date: '2026-09', monthlyReliefCents: 12000, event: 'Finanzierung A', eventDetail: 'Letzte Rate' },
    { date: '2027-01', monthlyReliefCents: 6000, event: 'Finanzierung B', eventDetail: 'Letzte Rate' },
    { date: '2026-10', monthlyReliefCents: 3000, event: 'Finanzierung C', eventDetail: 'Letzte Rate' },
    { date: '2026-12', monthlyReliefCents: 1500, event: 'Finanzierung D', eventDetail: 'Letzte Rate' },
  ],
};

export const anonymousSession = {
  authenticated: true,
  user: { email: 'owner@example.test' },
  csrfToken: 'browser-test-csrf-token',
};

export const anonymousFinanceResponse = {
  data: anonymousFinanceData,
  refreshedAt: '2026-08-08T10:00:00.000Z',
};

export async function installFinanceApiMocks(page, state = 'connected', financeData = anonymousFinanceData) {
  const financeResponse = { ...anonymousFinanceResponse, data: financeData };
  await page.route('**/api/session', async (route) => {
    if (state === 'loading') await new Promise((resolve) => setTimeout(resolve, 350));
    if (state === 'signed-out') return route.fulfill({ json: { authenticated: false } });
    return route.fulfill({ json: anonymousSession });
  });
  await page.route('**/api/finance', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (state === 'no-finance') return route.fulfill({ status: 409, json: { error: { code: 'finance_missing', message: 'Es ist noch kein Finanzstand vorhanden.' } } });
    if (state === 'validation-error') return route.fulfill({ status: 422, json: { error: { code: 'finance_data_integrity', message: 'Der gespeicherte Finanzstand ist ungültig.' } } });
    return route.fulfill({ json: financeResponse });
  });
  await page.route('**/api/auth/logout', (route) => route.fulfill({ json: { ok: true } }));
}
