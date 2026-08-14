import { parseSheetsBatchResponse } from '../../src/finance/parser.js';
import { financeDataV1Schema } from '../../src/finance/runtime.js';
import type { FinanceDataV1, FinanceValidationResult, RawSheetsBatchResponse } from '../../src/finance/types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accepts a Sheets batchGet payload or an already normalized FinanceDataV1 object. */
export function parseFinanceImportSource(raw: unknown): FinanceValidationResult {
  if (!isRecord(raw)) {
    return {
      success: false,
      issues: [{
        tab: '_Meta',
        row: 1,
        column: '(file)',
        expected: 'JSON-Objekt',
        message: 'Die Importdatei muss ein JSON-Objekt sein.',
      }],
    };
  }
  if (Array.isArray(raw.valueRanges) || typeof raw.spreadsheetId === 'string') {
    return parseSheetsBatchResponse(raw as RawSheetsBatchResponse);
  }
  const parsed = financeDataV1Schema.safeParse(raw);
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    issues: [{
      tab: '_Meta',
      row: 1,
      column: '(file)',
      expected: 'FinanceDataV1 oder Sheets-batchGet',
      message: 'Die Importdatei entspricht weder Finance Data Schema v1 noch einer Sheets-batchGet-Antwort.',
    }],
  };
}

export function financeImportFingerprint(data: FinanceDataV1) {
  return {
    asOf: data.asOf,
    currency: data.currency,
    salaryDay: data.salaryDay,
    accounts: data.accounts.length,
    accountSnapshots: data.accountSnapshots.length,
    pockets: data.pockets.length,
    pocketSnapshots: data.pocketSnapshots.length,
    budgetItems: data.budgetItems.length,
    debts: data.debts.length,
    debtSnapshots: data.debtSnapshots.length,
    debtMilestones: data.debtMilestones.length,
    reliefMilestones: data.reliefMilestones.length,
  };
}
