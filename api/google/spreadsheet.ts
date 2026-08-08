import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { AppError } from '../_lib/errors.js';
import { validateAndSaveSpreadsheet } from '../_lib/financeService.js';
import { authenticated, handle, json, method } from '../_lib/http.js';

const bodySchema = z.object({ fileId: z.string().trim().min(10).max(256) }).strict();

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!method(request, response, ['PUT'])) return;
  await handle(response, async () => {
    const { config, repository, session } = authenticated(request, true);
    const body = bodySchema.safeParse(request.body);
    if (!body.success) throw new AppError('invalid_request', 400, 'Ungültige Tabellen-Auswahl.');
    const connection = await repository.get(session.sub);
    if (!connection) throw new AppError('connection_missing', 409, 'Google-Verbindung fehlt.');
    const result = await validateAndSaveSpreadsheet(config, repository, connection, body.data.fileId);
    json(response, 200, {
      spreadsheet: { id: result.file.id, name: result.file.name },
      data: result.data,
      refreshedAt: new Date().toISOString(),
    });
  });
}
