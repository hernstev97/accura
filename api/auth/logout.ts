import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticated, handle, json, method } from '../_lib/http';
import { clearCookie, SESSION_COOKIE } from '../_lib/security';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!method(request, response, ['POST'])) return;
  await handle(response, async () => {
    const { config } = authenticated(request, true);
    response.setHeader('Set-Cookie', clearCookie(SESSION_COOKIE, config.production));
    json(response, 200, { ok: true });
  });
}
