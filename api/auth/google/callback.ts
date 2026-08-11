import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerConfig } from '../../_lib/config.js';
import { AppError } from '../../_lib/errors.js';
import { exchangeAuthorizationCode, verifyGoogleIdentity } from '../../_lib/google.js';
import { method } from '../../_lib/http.js';
import { getConnectionRepository } from '../../_lib/repository.js';
import {
  clearCookie,
  createSession,
  encryptRefreshToken,
  isAllowedGoogleUser,
  OAUTH_COOKIE,
  parseCookies,
  sessionCookie,
  verifyOAuthTransaction,
} from '../../_lib/security.js';
import type { AppPath } from '../../../src/navigation/appNavigation.js';

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!method(request, response, ['GET'])) return;
  response.setHeader('Cache-Control', 'no-store');
  let config;
  try {
    config = getServerConfig();
  } catch {
    response.status(500).json({ error: { code: 'server_configuration_error', message: 'Serverkonfiguration ist unvollständig.' } });
    return;
  }
  let returnPath: AppPath = '/';
  try {
    const code = first(request.query.code);
    const state = first(request.query.state);
    const oauthError = first(request.query.error);
    const transactionCookie = parseCookies(request.headers.cookie)[OAUTH_COOKIE];
    response.setHeader('Set-Cookie', clearCookie(OAUTH_COOKIE, config.production));

    if (!state || !transactionCookie) {
      throw new AppError('oauth_callback_failed', 400, 'Google-Anmeldung wurde abgebrochen oder ist unvollständig.');
    }
    const transaction = verifyOAuthTransaction(transactionCookie, state, config.sessionSecret);
    returnPath = transaction.returnPath;
    if (oauthError || !code) {
      throw new AppError('oauth_callback_failed', 400, 'Google-Anmeldung wurde abgebrochen oder ist unvollständig.');
    }
    const tokens = await exchangeAuthorizationCode(config, code, transaction.verifier);
    if (!tokens.scopes.includes('https://www.googleapis.com/auth/drive.file')) {
      throw new AppError('missing_required_scope', 403, 'Der erforderliche Zugriff auf ausgewählte Drive-Dateien wurde nicht erteilt.');
    }
    const identity = await verifyGoogleIdentity(tokens.idToken, config.googleClientId, transaction.nonce);
    if (!isAllowedGoogleUser(identity.email, identity.emailVerified, config.allowedGoogleEmail)) {
      throw new AppError('user_not_allowed', 403, 'Dieses Google-Konto ist für die App nicht freigeschaltet.');
    }

    const repository = getConnectionRepository(config.databaseUrl);
    await repository.upsertAuthorization({
      googleSub: identity.sub,
      email: identity.email,
      encryptedRefreshToken: encryptRefreshToken(tokens.refreshToken, config.tokenEncryptionKey, identity.sub),
      scopes: tokens.scopes,
    });
    const { token } = createSession(identity.sub, identity.email, config.sessionSecret);
    response.setHeader('Set-Cookie', [clearCookie(OAUTH_COOKIE, config.production), sessionCookie(token, config.production)]);
    response.redirect(302, new URL(returnPath, `${config.appOrigin}/`).href);
  } catch (error) {
    response.setHeader('Set-Cookie', clearCookie(OAUTH_COOKIE, config.production));
    const code = error instanceof AppError ? error.code : 'oauth_callback_failed';
    const safeCode = ['user_not_allowed', 'missing_required_scope', 'refresh_token_missing', 'invalid_oauth_state', 'oauth_callback_failed', 'oauth_exchange_failed', 'invalid_google_identity'].includes(code)
      ? code : 'oauth_callback_failed';
    const errorUrl = new URL(returnPath, `${config.appOrigin}/`);
    errorUrl.searchParams.set('auth_error', safeCode);
    response.redirect(302, errorUrl.href);
  }
}
