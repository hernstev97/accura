import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AppError } from './_lib/errors.js';
import { readValidatedFinanceData } from './_lib/financeService.js';
import { authenticated, handle, json, method } from './_lib/http.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!method(request, response, ['GET'])) return;
  await handle(response, async () => {
    const { config, repository, session } = authenticated(request);
    const connection = await repository.get(session.sub);
    if (!connection) throw new AppError('connection_missing', 409, 'Google-Verbindung fehlt.');
    if (!connection.spreadsheetId || !connection.spreadsheetName) throw new AppError('spreadsheet_missing', 409, 'Es wurde noch keine Google-Tabelle ausgewählt.');
    const data = await readValidatedFinanceData(config, connection, connection.spreadsheetId);
    json(response, 200, {
      spreadsheet: { id: connection.spreadsheetId, name: connection.spreadsheetName },
      data,
      refreshedAt: new Date().toISOString(),
    });
  });
}
