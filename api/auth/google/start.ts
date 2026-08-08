import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerConfig } from '../../_lib/config.js';
import { buildGoogleAuthorizationUrl } from '../../_lib/google.js';
import { handle, method } from '../../_lib/http.js';
import { createOAuthTransaction, oauthCookie } from '../../_lib/security.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!method(request, response, ['GET'])) return;
  await handle(response, async () => {
    const config = getServerConfig();
    const { token, transaction, challenge } = createOAuthTransaction(config.sessionSecret);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Set-Cookie', oauthCookie(token, config.production));
    response.redirect(302, buildGoogleAuthorizationUrl(config, {
      state: transaction.state,
      challenge,
      nonce: transaction.nonce,
    }));
  });
}
