import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installFinanceApiMocks } from './fixtures/anonymous-finance-data.mjs';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'de-DE', serviceWorkers: 'allow' });
const page = await context.newPage();
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push({ message: `Konsole: ${message.text()}`, url: message.location().url });
});
page.on('pageerror', (error) => errors.push({ message: `Laufzeit: ${error.message}`, url: '' }));

try {
  await installFinanceApiMocks(page);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller !== null), true, 'Service Worker kontrolliert die Seite nicht');

  await page.unrouteAll({ behavior: 'wait' });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  assert.match(await page.locator('body').innerText(), /550,00\s*€\s*frei/);
  assert.match(await page.locator('body').innerText(), /Offline · gespeicherter Stand/);
  const unexpectedErrors = errors.filter((error) => {
    const expectedOfflineSessionFailure = new URL(error.url || baseUrl).pathname === '/api/session'
      && /ERR_(?:FAILED|INTERNET_DISCONNECTED)/.test(error.message);
    return !expectedOfflineSessionFailure;
  });
  assert.deepEqual(unexpectedErrors, [], unexpectedErrors.map(({ message, url }) => `${message} (${url})`).join('\n'));
  console.log('Offline-Smoke-Test bestanden: App-Shell und letzter gültiger normalisierter Datenstand laden offline aus Service Worker und IndexedDB.');
} finally {
  await context.setOffline(false);
  await context.close();
  await browser.close();
}
