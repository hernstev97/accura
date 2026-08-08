import type { VercelRequest, VercelResponse } from '@vercel/node';
import { accessForConnection } from '../_lib/financeService';
import { AppError } from '../_lib/errors';
import { authenticated, handle, json, method } from '../_lib/http';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!method(request, response, ['GET'])) return;
  await handle(response, async () => {
    const { config, repository, session } = authenticated(request);
    const connection = await repository.get(session.sub);
    if (!connection) throw new AppError('connection_missing', 409, 'Google-Verbindung fehlt.');
    const token = await accessForConnection(config, connection);
    json(response, 200, {
      accessToken: token.accessToken,
      expiresIn: token.expiresIn,
      apiKey: config.googleApiKey,
      appId: config.googleCloudProjectNumber,
      clientId: config.googleClientId,
    });
  });
}
