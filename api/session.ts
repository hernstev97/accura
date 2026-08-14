import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerConfig } from './_lib/config.js';
import { handle, json, method } from './_lib/http.js';
import { clearCookie, financeCacheOwnerKey, parseCookies, SESSION_COOKIE, verifySession } from './_lib/security.js';

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
    json(response, 200, {
      authenticated: true,
      user: { email: session.email },
      csrfToken: session.csrf,
      ownerKey: financeCacheOwnerKey(session.sub, config.sessionSecret),
    });
  });
}
