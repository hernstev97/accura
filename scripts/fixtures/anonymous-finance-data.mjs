export const anonymousFinanceData = {
  schemaVersion: 1,
  asOf: '2026-08-08',
  currency: 'EUR',
  monthlyIncomeCents: 259132,
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
    ['housing', 'Wohnen', 100000, 'essential', 'expense', 1],
    ['groceries', 'Lebensmittel', 50000, 'essential', 'expense', 2],
    ['reserve', 'Rücklagen', 30000, 'worthwhile', 'reserve', 3],
    ['utilities', 'Nebenkosten', 20000, 'necessary', 'expense', 4],
    ['mobility', 'Mobilität', 15000, 'necessary', 'expense', 5],
    ['insurance', 'Versicherungen', 10000, 'essential', 'expense', 6],
    ['fitness', 'Fitness', 6000, 'optional', 'expense', 7],
    ['internet', 'Internet', 5000, 'necessary', 'expense', 8],
    ['gifts', 'Geschenke', 5000, 'unnecessary', 'expense', 9],
    ['subscriptions', 'Abos', 4000, 'optional', 'expense', 10],
  ].map(([id, label, monthlyAmountCents, necessityId, kind, displayOrder]) => ({ id, label, monthlyAmountCents, necessityId, kind, displayOrder, active: true, note: null })),
  debts: [
    { id: 'dkb', name: 'DKB', kind: 'loan', monthlyPaymentCents: 22022, displayOrder: 1, active: true, note: 'Raw English DKB spreadsheet note' },
    { id: 'coolblue', name: 'Coolblue', kind: 'installment', monthlyPaymentCents: 16400, displayOrder: 2, active: true, note: 'Letzte Rate im September 2026' },
    { id: 'fabfilter', name: 'Fabfilter', kind: 'installment', monthlyPaymentCents: 3870, displayOrder: 3, active: true, note: 'Software-Finanzierung' },
    { id: 'straight-outta-cotton', name: 'Straight Outta Cotton', kind: 'installment', monthlyPaymentCents: 1838, displayOrder: 4, active: true, note: 'Ratenkauf' },
    { id: 'soulframe', name: 'Soulframe', kind: 'installment', monthlyPaymentCents: 500, displayOrder: 5, active: true, note: 'Ratenkauf' },
  ],
  debtSnapshots: [
    { debtId: 'dkb', asOf: '2026-08-08', payoffBalanceCents: 1389002, remainingPaymentCount: 86, remainingScheduledTotalCents: 1893914 },
    { debtId: 'coolblue', asOf: '2026-08-08', payoffBalanceCents: 16424, remainingPaymentCount: 1, remainingScheduledTotalCents: 16424 },
    { debtId: 'fabfilter', asOf: '2026-08-08', payoffBalanceCents: 19352, remainingPaymentCount: 5, remainingScheduledTotalCents: 19352 },
    { debtId: 'straight-outta-cotton', asOf: '2026-08-08', payoffBalanceCents: 5515, remainingPaymentCount: 3, remainingScheduledTotalCents: 5515 },
    { debtId: 'soulframe', asOf: '2026-08-08', payoffBalanceCents: 2000, remainingPaymentCount: 4, remainingScheduledTotalCents: 2000 },
  ],
  debtMilestones: [
    ['dkb', '2026-08', 1389002], ['coolblue', '2026-08', 16424], ['fabfilter', '2026-08', 19352],
    ['straight-outta-cotton', '2026-08', 5515], ['soulframe', '2026-08', 2000],
    ['dkb', '2027-01', 1300000], ['coolblue', '2027-01', 0], ['fabfilter', '2027-01', 0],
    ['straight-outta-cotton', '2027-01', 0], ['soulframe', '2027-01', 0],
    ['dkb', '2029-09', 800000], ['dkb', '2033-09', 0],
  ].map(([debtId, date, balanceCents]) => ({ debtId, date, balanceCents })),
  reliefMilestones: [
    { date: '2033-09', monthlyReliefCents: 22022, event: 'DKB', eventDetail: 'Letzte Rate' },
    { date: '2026-09', monthlyReliefCents: 16400, event: 'debt-payment-ends', eventDetail: 'Coolblue' },
    { date: '2027-01', monthlyReliefCents: 3870, event: 'Fabfilter', eventDetail: 'Letzte Rate' },
    { date: '2026-10', monthlyReliefCents: 1838, event: 'Straight Outta Cotton', eventDetail: 'Letzte Rate' },
    { date: '2026-12', monthlyReliefCents: 500, event: 'Soulframe', eventDetail: 'Letzte Rate' },
  ],
};

export const anonymousSession = {
  authenticated: true,
  user: { email: 'owner@example.test' },
  csrfToken: 'browser-test-csrf-token',
  connection: { connected: true, spreadsheet: { id: 'anonymous-sheet-id', name: 'Anonyme Finanzen' } },
};

export const anonymousFinanceResponse = {
  spreadsheet: anonymousSession.connection.spreadsheet,
  data: anonymousFinanceData,
  refreshedAt: '2026-08-08T10:00:00.000Z',
};

export async function installFinanceApiMocks(page, state = 'connected') {
  await page.route('**/api/session', async (route) => {
    if (state === 'loading') await new Promise((resolve) => setTimeout(resolve, 350));
    if (state === 'signed-out') return route.fulfill({ json: { authenticated: false } });
    if (state === 'no-spreadsheet') return route.fulfill({ json: { ...anonymousSession, connection: { connected: true, spreadsheet: null } } });
    return route.fulfill({ json: anonymousSession });
  });
  await page.route('**/api/finance', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (state === 'validation-error') return route.fulfill({ status: 422, json: { error: { code: 'invalid_finance_schema', message: 'Die Tabelle entspricht nicht Finance Data Schema v1.', details: { issues: [{ tab: '_Meta', row: 2, column: 'schema_version', message: 'Schema-Version wird nicht unterstützt.', expected: '1' }] } } } });
    if (state === 'reconnect') return route.fulfill({ status: 401, json: { error: { code: 'reconnect_required', message: 'Die Google-Verbindung muss erneut autorisiert werden.' } } });
    return route.fulfill({ json: anonymousFinanceResponse });
  });
  await page.route('**/api/google/picker', (route) => route.fulfill({ json: { accessToken: 'short-lived-browser-token', expiresIn: 3600, apiKey: 'public-picker-key', appId: '123456', clientId: 'client-id' } }));
  await page.route('**/api/google/spreadsheet', (route) => route.fulfill({ json: anonymousFinanceResponse }));
  await page.route('**/api/auth/logout', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/connection/disconnect', (route) => route.fulfill({ json: { ok: true } }));
}

export async function installPickerMock(page) {
  await page.addInitScript(() => {
    class DocsView { setMimeTypes() { return this; } setSelectFolderEnabled() { return this; } }
    class PickerBuilder {
      addView() { return this; } setAppId() { return this; } setDeveloperKey() { return this; }
      setOAuthToken() { return this; } setOrigin() { return this; }
      setCallback(callback) { this.callback = callback; return this; }
      build() { return { setVisible: () => this.callback({ action: 'picked', docs: [{ id: 'anonymous-sheet-id', name: 'Anonyme Finanzen' }] }) }; }
    }
    window.google = { picker: { Action: { PICKED: 'picked', CANCEL: 'cancel' }, ViewId: { SPREADSHEETS: 'spreadsheets' }, DocsView, PickerBuilder } };
  });
}
