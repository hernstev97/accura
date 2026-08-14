import { z } from 'zod';
import { financeDataV1Schema } from '../finance/runtime';
import type { FinanceValidationIssue } from '../finance/types';

const sessionSchema = z.discriminatedUnion('authenticated', [
  z.object({ authenticated: z.literal(false) }),
  z.object({
    authenticated: z.literal(true),
    user: z.object({ email: z.string().email() }),
    csrfToken: z.string().min(1),
    ownerKey: z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
  }),
]);
const financeResponseSchema = z.object({
  data: financeDataV1Schema,
  refreshedAt: z.string().datetime(),
  ownerKey: z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

export type FinanceSession = z.infer<typeof sessionSchema>;
export type FinanceResponse = z.infer<typeof financeResponseSchema>;

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
  logout(csrfToken: string, signal?: AbortSignal): Promise<void>;
}

export const productionFinanceApi: FinanceApi = {
  getSession: (signal) => request('/api/session', sessionSchema, { signal }),
  getFinance: (signal) => request('/api/finance', financeResponseSchema, { signal }),
  logout: async (csrfToken, signal) => {
    await request('/api/auth/logout', z.object({ ok: z.literal(true) }), {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken },
      signal,
    });
  },
};
