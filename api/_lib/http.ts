import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ServerConfig } from './config';
import { getServerConfig } from './config';
import { AppError, publicError } from './errors';
import { getConnectionRepository, type ConnectionRepository } from './repository';
import { assertCsrf, parseCookies, SESSION_COOKIE, verifySession, type AppSession } from './security';

export type HandlerContext = {
  config: ServerConfig;
  repository: ConnectionRepository;
  session: AppSession;
};

export const json = (response: VercelResponse, status: number, body: unknown) => {
  response.setHeader('Cache-Control', 'no-store');
  return response.status(status).json(body);
};

export const method = (request: VercelRequest, response: VercelResponse, allowed: string[]) => {
  if (!request.method || !allowed.includes(request.method)) {
    response.setHeader('Allow', allowed.join(', '));
    json(response, 405, { error: { code: 'method_not_allowed', message: 'Methode nicht erlaubt.' } });
    return false;
  }
  return true;
};

export function authenticated(request: VercelRequest, csrfRequired = false): HandlerContext {
  const config = getServerConfig();
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (!token) throw new AppError('unauthenticated', 401, 'Nicht angemeldet.');
  const session = verifySession(token, config.sessionSecret);
  if (session.email.toLowerCase() !== config.allowedGoogleEmail) throw new AppError('forbidden', 403, 'Zugriff nicht erlaubt.');
  if (csrfRequired) {
    const csrfHeader = Array.isArray(request.headers['x-csrf-token']) ? request.headers['x-csrf-token'][0] : request.headers['x-csrf-token'];
    const origin = Array.isArray(request.headers.origin) ? request.headers.origin[0] : request.headers.origin;
    assertCsrf(session, csrfHeader, origin, config.appOrigin);
  }
  return { config, repository: getConnectionRepository(config.databaseUrl), session };
}

export async function handle(response: VercelResponse, task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    const result = publicError(error);
    json(response, result.status, result.body);
  }
}
