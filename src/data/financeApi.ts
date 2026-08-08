import { z } from 'zod';
import { financeDataV1Schema } from '../finance/runtime';
import type { FinanceValidationIssue } from '../finance/types';

const spreadsheetSchema = z.object({ id: z.string().min(1), name: z.string().min(1) });
const sessionSchema = z.discriminatedUnion('authenticated', [
  z.object({ authenticated: z.literal(false) }),
  z.object({
    authenticated: z.literal(true),
    user: z.object({ email: z.string().email() }),
    csrfToken: z.string().min(1),
    connection: z.object({ connected: z.boolean(), spreadsheet: spreadsheetSchema.nullable() }),
  }),
]);
const financeResponseSchema = z.object({
  spreadsheet: spreadsheetSchema,
  data: financeDataV1Schema,
  refreshedAt: z.string().datetime(),
});
const pickerConfigSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().positive(),
  apiKey: z.string().min(1),
  appId: z.string().min(1),
  clientId: z.string().min(1),
});

export type FinanceSession = z.infer<typeof sessionSchema>;
export type FinanceResponse = z.infer<typeof financeResponseSchema>;
export type PickerConfig = z.infer<typeof pickerConfigSchema>;

export class FinanceApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 0,
    public readonly issues?: FinanceValidationIssue[],
  ) {
    super(message);
    this.name = 'FinanceApiError';
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...options });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new FinanceApiError('network_error', 'Der Server ist momentan nicht erreichbar.');
  }
  const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string; details?: { issues?: FinanceValidationIssue[] } } } | null;
  if (!response.ok) {
    throw new FinanceApiError(
      body?.error?.code ?? 'request_failed',
      body?.error?.message ?? 'Die Anfrage ist fehlgeschlagen.',
      response.status,
      body?.error?.details?.issues,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new FinanceApiError('invalid_server_response', 'Der Server hat eine ungültige Antwort geliefert.', response.status);
  return parsed.data;
}

export interface FinanceApi {
  getSession(signal?: AbortSignal): Promise<FinanceSession>;
  getFinance(signal?: AbortSignal): Promise<FinanceResponse>;
  getPickerConfig(signal?: AbortSignal): Promise<PickerConfig>;
  saveSpreadsheet(fileId: string, csrfToken: string, signal?: AbortSignal): Promise<FinanceResponse>;
  logout(csrfToken: string): Promise<void>;
  disconnect(csrfToken: string): Promise<void>;
}

export const productionFinanceApi: FinanceApi = {
  getSession: (signal) => request('/api/session', sessionSchema, { signal }),
  getFinance: (signal) => request('/api/finance', financeResponseSchema, { signal }),
  getPickerConfig: (signal) => request('/api/google/picker', pickerConfigSchema, { signal }),
  saveSpreadsheet: (fileId, csrfToken, signal) => request('/api/google/spreadsheet', financeResponseSchema, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify({ fileId }),
    signal,
  }),
  logout: async (csrfToken) => { await request('/api/auth/logout', z.object({ ok: z.literal(true) }), { method: 'POST', headers: { 'x-csrf-token': csrfToken } }); },
  disconnect: async (csrfToken) => { await request('/api/connection/disconnect', z.object({ ok: z.literal(true) }), { method: 'POST', headers: { 'x-csrf-token': csrfToken } }); },
};
