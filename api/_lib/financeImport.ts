import { parseSheetsBatchResponse } from '../../src/finance/parser.ts';
import { financeDataV1Schema } from '../../src/finance/runtime.ts';
import { z } from 'zod';
import type { FinanceDataV1, FinanceValidationResult } from '../../src/finance/types.ts';

const sheetsBatchResponseSchema = z.object({
  spreadsheetId: z.string().min(1).optional(),
  valueRanges: z.array(z.object({
    range: z.string().min(1).optional(),
    values: z.array(z.array(z.unknown())).optional(),
  }).passthrough()),
}).passthrough();

/** Parses operator JSON without allowing V8 to echo source fragments in an error message. */
export function parseFinanceImportJson(contents: string): unknown {
  try {
    return JSON.parse(contents) as unknown;
  } catch {
    throw new Error('Die Importdatei ist kein gültiges JSON.');
  }
}

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
  if ('valueRanges' in raw || 'spreadsheetId' in raw) {
    const sheetsResponse = sheetsBatchResponseSchema.safeParse(raw);
    if (!sheetsResponse.success) {
      return {
        success: false,
        issues: [{
          tab: '_Meta',
          row: 1,
          column: '(file)',
          expected: 'vollständige Sheets-batchGet-Antwort',
          message: 'Die Importdatei enthält keine gültige Sheets-batchGet-Antwort.',
        }],
      };
    }
    return parseSheetsBatchResponse(sheetsResponse.data);
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
