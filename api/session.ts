import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerConfig } from './_lib/config.js';
import { handle, json, method } from './_lib/http.js';
import { getConnectionRepository } from './_lib/repository.js';
import { clearCookie, parseCookies, SESSION_COOKIE, verifySession } from './_lib/security.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!method(request, response, ['GET'])) return;
  await handle(response, async () => {
    const config = getServerConfig();
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    if (!token) {
      json(response, 200, { authenticated: false });
      return;
    }
    let session;
    try {
      session = verifySession(token, config.sessionSecret);
    } catch {
      response.setHeader('Set-Cookie', clearCookie(SESSION_COOKIE, config.production));
      json(response, 200, { authenticated: false });
      return;
    }
    if (session.email.toLowerCase() !== config.allowedGoogleEmail) {
      response.setHeader('Set-Cookie', clearCookie(SESSION_COOKIE, config.production));
      json(response, 200, { authenticated: false });
      return;
    }
    const connection = await getConnectionRepository(config.databaseUrl).get(session.sub);
    json(response, 200, {
      authenticated: true,
      user: { email: session.email },
      csrfToken: session.csrf,
      connection: connection ? {
        connected: true,
        spreadsheet: connection.spreadsheetId ? { id: connection.spreadsheetId, name: connection.spreadsheetName } : null,
      } : { connected: false, spreadsheet: null },
    });
  });
}
