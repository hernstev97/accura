import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerConfig } from '../../_lib/config.js';
import { AppError } from '../../_lib/errors.js';
import { exchangeAuthorizationCode, verifyGoogleIdentity } from '../../_lib/google.js';
import { getFinanceRepository } from '../../_lib/financeRepository.js';
import { method } from '../../_lib/http.js';
import {
  clearCookie,
  createSession,
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
    const identity = await verifyGoogleIdentity(tokens.idToken, config.googleClientId, transaction.nonce);
    if (!isAllowedGoogleUser(identity.email, identity.emailVerified, config.allowedGoogleEmail)) {
      throw new AppError('user_not_allowed', 403, 'Dieses Google-Konto ist für die App nicht freigeschaltet.');
    }

    await getFinanceRepository(config.databaseUrl).ensureOwnerForGoogleSub(identity.sub);
    const { token } = createSession(identity.sub, identity.email, config.sessionSecret);
    response.setHeader('Set-Cookie', [clearCookie(OAUTH_COOKIE, config.production), sessionCookie(token, config.production)]);
    response.redirect(302, new URL(returnPath, `${config.appOrigin}/`).href);
  } catch (error) {
    response.setHeader('Set-Cookie', clearCookie(OAUTH_COOKIE, config.production));
    const code = error instanceof AppError ? error.code : 'oauth_callback_failed';
    const safeCode = ['user_not_allowed', 'invalid_oauth_state', 'oauth_callback_failed', 'oauth_exchange_failed', 'invalid_google_identity'].includes(code)
      ? code : 'oauth_callback_failed';
    const errorUrl = new URL(returnPath, `${config.appOrigin}/`);
    errorUrl.searchParams.set('auth_error', safeCode);
    response.redirect(302, errorUrl.href);
  }
}
