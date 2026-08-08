import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'de-DE', serviceWorkers: 'allow' });
const page = await context.newPage();
const errors = [];

page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`Konsole: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`Laufzeit: ${error.message}`));

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => 'serviceWorker' in navigator);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller !== null), true, 'Service Worker kontrolliert die Seite nicht');

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.locator('.screen-identity').filter({ hasText: 'Finanzen' }).waitFor();
  assert.match(await page.locator('body').innerText(), /141,32\s*€\s*frei/);
  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('Offline-Smoke-Test bestanden: Die vorgecachete App-Shell lädt nach der Erstnutzung ohne Netzwerk.');
} finally {
  await context.setOffline(false);
  await context.close();
  await browser.close();
}
