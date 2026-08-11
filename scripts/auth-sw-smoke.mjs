import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const distRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};
const apiHits = { callback: 0, session: 0, start: 0 };
let authenticated = false;
let oauthReturnPath = '/';
const allowedReturnPaths = new Set(['/', '/demnaechst', '/budget', '/schulden']);

function sendJson(response, statusCode, body, functionName) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Smoke-Function': functionName,
  });
  response.end(JSON.stringify(body));
}

async function serveStatic(response, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  let filePath = join(distRoot, relativePath);
  if (!filePath.startsWith(distRoot)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
  } catch {
    filePath = join(distRoot, 'index.html');
  }
  const body = await readFile(filePath);
  response.writeHead(200, {
    'Cache-Control': filePath.endsWith('sw.js') ? 'no-cache' : 'public, max-age=0',
    'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
  });
  response.end(body);
}

async function handleRequest(request, response) {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/api/auth/google/start') {
    apiHits.start += 1;
    const requestedReturnPath = url.searchParams.get('return_to');
    oauthReturnPath = allowedReturnPaths.has(requestedReturnPath) ? requestedReturnPath : '/';
    response.writeHead(302, {
      'Cache-Control': 'no-store',
      Location: '/api/auth/google/callback?code=smoke-code&state=smoke-state',
      'X-Smoke-Function': 'auth-start',
    });
    response.end();
    return;
  }
  if (url.pathname === '/api/auth/google/callback') {
    apiHits.callback += 1;
    if (url.searchParams.get('code') !== 'smoke-code') {
      sendJson(response, 400, { error: { code: 'oauth_callback_failed' } }, 'auth-callback');
      return;
    }
    authenticated = true;
    response.writeHead(302, {
      'Cache-Control': 'no-store',
      Location: oauthReturnPath,
      'X-Smoke-Function': 'auth-callback',
    });
    response.end();
    return;
  }
  if (url.pathname === '/api/session') {
    apiHits.session += 1;
    sendJson(response, 200, authenticated ? {
      authenticated: true,
      user: { email: 'smoke@example.com' },
      csrfToken: 'smoke-csrf-token',
      connection: { connected: true, spreadsheet: null },
    } : { authenticated: false }, 'session');
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: { code: 'not_found' } }, 'not-found');
    return;
  }
  await serveStatic(response, url.pathname);
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : String(error));
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'de-DE', serviceWorkers: 'allow' });
const page = await context.newPage();
page.setDefaultNavigationTimeout(15_000);
page.setDefaultTimeout(15_000);

try {
  await page.goto(`${baseUrl}/budget`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/budget', 'Abgemeldeter Deep Link verlor seinen Pfad');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller !== null), true, 'Service Worker kontrolliert die Testseite nicht');

  const sessionResponse = await page.goto(`${baseUrl}/api/session`, { waitUntil: 'domcontentloaded' });
  assert.ok(sessionResponse);
  assert.equal(sessionResponse.fromServiceWorker(), true, 'Session navigation did not pass through the controlling service worker');
  assert.equal(sessionResponse.headers()['x-smoke-function'], 'session');
  assert.match(sessionResponse.headers()['content-type'] ?? '', /^application\/json/);
  assert.equal(sessionResponse.headers()['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(await sessionResponse.text()), { authenticated: false });

  const rejectedCallback = await page.goto(`${baseUrl}/api/auth/google/callback?error=access_denied`, { waitUntil: 'domcontentloaded' });
  assert.ok(rejectedCallback);
  assert.equal(rejectedCallback.fromServiceWorker(), true, 'Callback navigation did not pass through the controlling service worker');
  assert.equal(rejectedCallback.headers()['x-smoke-function'], 'auth-callback');
  assert.match(rejectedCallback.headers()['content-type'] ?? '', /^application\/json/);
  assert.doesNotMatch(await rejectedCallback.text(), /<html|<!doctype/i, 'OAuth callback received the cached SPA shell');

  await page.goto(`${baseUrl}/budget`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/budget', 'Deep Link ging vor dem Login verloren');
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller !== null), true, 'Service Worker verlor vor dem Login die Kontrolle');

  const startResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/google/start');
  const callbackResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/auth/google/callback' && url.searchParams.get('code') === 'smoke-code';
  });
  await page.getByRole('button', { name: 'Mit Google anmelden' }).click();
  const [startResponse, callbackResponse] = await Promise.all([startResponsePromise, callbackResponsePromise]);
  assert.equal(startResponse.status(), 302);
  assert.equal(new URL(startResponse.url()).searchParams.get('return_to'), '/budget');
  assert.equal(startResponse.fromServiceWorker(), true, 'Auth start navigation did not pass through the controlling service worker');
  assert.equal(startResponse.headers().location, '/api/auth/google/callback?code=smoke-code&state=smoke-state');
  assert.equal(startResponse.headers()['x-smoke-function'], 'auth-start');
  assert.equal(startResponse.headers()['cache-control'], 'no-store');
  assert.equal(callbackResponse.status(), 302);
  assert.equal(callbackResponse.fromServiceWorker(), true, 'Auth callback navigation did not pass through the controlling service worker');
  assert.equal(callbackResponse.headers()['x-smoke-function'], 'auth-callback');
  assert.equal(callbackResponse.headers()['cache-control'], 'no-store');
  await page.getByRole('heading', { name: 'Google-Tabelle auswählen' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/budget', 'OAuth-Rückkehr verlor den validierten Deep Link');

  assert.equal(apiHits.start, 1, 'Login navigation did not reach the auth start function');
  assert.equal(apiHits.callback, 2, 'Expected one rejected callback probe and one successful login callback');
  assert.ok(apiHits.session >= 3, 'Session function was not reached through the controlling service worker');
  console.log('Auth-Service-Worker-Smoke-Test bestanden: API-Navigationen erreichen das Netzwerk und die Anmeldung funktioniert ohne Hard Reload.');
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
