import type { VercelRequest, VercelResponse } from '@vercel/node';
import { revokeGoogleToken } from '../_lib/google.js';
import { authenticated, handle, json, method } from '../_lib/http.js';
import { clearCookie, decryptRefreshToken, SESSION_COOKIE } from '../_lib/security.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!method(request, response, ['POST'])) return;
  await handle(response, async () => {
    const { config, repository, session } = authenticated(request, true);
    const connection = await repository.get(session.sub);
    if (connection) {
      try {
        const refreshToken = decryptRefreshToken(connection.encryptedRefreshToken, config.tokenEncryptionKey, session.sub);
        await revokeGoogleToken(refreshToken);
      } finally {
        await repository.delete(session.sub);
      }
    }
    response.setHeader('Set-Cookie', clearCookie(SESSION_COOKIE, config.production));
    json(response, 200, { ok: true });
  });
}
