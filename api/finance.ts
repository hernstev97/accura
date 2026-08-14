import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AppError } from './_lib/errors.js';
import { FinanceDataIntegrityError, getFinanceRepository } from './_lib/financeRepository.js';
import { authenticated, handle, json, method } from './_lib/http.js';
import { financeCacheOwnerKey } from './_lib/security.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!method(request, response, ['GET'])) return;
  await handle(response, async () => {
    const { config, session } = authenticated(request);
    try {
      const data = await getFinanceRepository(config.databaseUrl).readForGoogleSub(session.sub);
      if (!data) throw new AppError('finance_missing', 409, 'Es ist noch kein Finanzstand vorhanden.');
      json(response, 200, {
        data,
        refreshedAt: new Date().toISOString(),
        ownerKey: financeCacheOwnerKey(session.sub, config.sessionSecret),
      });
    } catch (error) {
      if (error instanceof FinanceDataIntegrityError) {
        throw new AppError('finance_data_integrity', 422, 'Der gespeicherte Finanzstand ist ungültig.');
      }
      throw error;
    }
  });
}
