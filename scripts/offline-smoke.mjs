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
  assert.equal(await page.locator('[data-destination="overview"]').getAttribute('data-entrance'), 'first');
  await page.getByLabel('Informationen öffnen').click();
  await page.getByRole('button', { name: /Farben & Design/ }).click();
  const colors = page.getByRole('dialog', { name: 'Farben' });
  await colors.locator('.appearance-source-picker').getByRole('radio', { name: 'Farben', exact: true }).check();
  await colors.getByRole('radio', { name: 'Grün', exact: true }).check();
  await colors.getByRole('button', { name: 'Anwenden', exact: true }).click();
  await colors.waitFor({ state: 'detached' });
  const onlineAppearance = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      mode: document.documentElement.dataset.themeMode,
      primary: style.getPropertyValue('--color-primary').trim(),
      source: document.documentElement.dataset.colorSource,
    };
  });
  assert.equal(onlineAppearance.source, 'preset');
  await page.getByLabel('Informationen schließen').click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller !== null), true, 'Service Worker kontrolliert die Seite nicht');

  await page.unrouteAll({ behavior: 'wait' });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  await page.waitForFunction(() => document.fonts.check('16px "Google Sans Flex Variable"'));
  const offlineFont = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const cachedRequests = (await Promise.all(cacheNames.map(async (name) => {
      const cache = await caches.open(name);
      return cache.keys();
    }))).flat();
    const style = getComputedStyle(document.documentElement);
    return {
      cachedFontCount: cachedRequests.filter(({ url }) => /google-sans-flex.*\.woff2/.test(url)).length,
      cachedPaletteWorkerCount: cachedRequests.filter(({ url }) => /palette\.worker.*\.js/.test(url)).length,
      family: style.fontFamily,
      mode: document.documentElement.dataset.themeMode,
      primary: style.getPropertyValue('--color-primary').trim(),
      source: document.documentElement.dataset.colorSource,
      variation: style.fontVariationSettings,
    };
  });
  assert.match(offlineFont.family, /Google Sans Flex Variable/, 'Offline-Ansicht verwendet nicht Google Sans Flex');
  assert.match(offlineFont.variation, /"ROND" 100/, 'Offline-Ansicht verlor die vollständig gerundete Google-Sans-Flex-Rolle');
  assert.ok(offlineFont.cachedFontCount >= 1, 'Google Sans Flex ist nicht im Service-Worker-App-Shell-Cache');
  assert.ok(offlineFont.cachedPaletteWorkerCount >= 1, 'Palette-Worker ist nicht im Service-Worker-App-Shell-Cache');
  assert.deepEqual({ mode: offlineFont.mode, primary: offlineFont.primary, source: offlineFont.source }, onlineAppearance, 'Gespeichertes Theme wurde offline nicht synchron wiederhergestellt');
  const offlineOverview = page.locator('[data-destination="overview"]');
  assert.equal(await offlineOverview.getAttribute('data-entrance'), 'visited', 'Service-Worker-Reload spielte den Eingang erneut ab');
  assert.equal(await offlineOverview.evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.animationName === 'screen-entrance').length), 0);
  const offlineText = await page.locator('body').innerText();
  assert.match(offlineText, /141,32\s*€\s*frei/);
  assert.match(offlineText, /Coolblue endet im September 2026/);
  assert.match(offlineText, /Danach voraussichtlich 305,32\s*€ frei/);
  assert.match(offlineText, /Offline · gespeicherter Stand/);
  await page.getByLabel('Informationen öffnen').click();
  const offlineInfo = await page.getByRole('dialog', { name: 'Informationen' }).innerText();
  assert.match(offlineInfo, /Andere Farben · Systemmodus/);
  assert.match(offlineInfo, /Offline verfügbar[\s\S]*Anonyme Finanzen/);
  assert.match(offlineInfo, /lokal auf diesem Gerät verfügbar/);
  assert.doesNotMatch(offlineInfo, /Jetzt aktualisieren|Andere Tabelle auswählen|Abmelden blendet Finanzdaten aus/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Budget', exact: true }).click();
  await page.getByRole('heading', { name: 'Dein Budget' }).waitFor();
  await page.getByRole('button', { name: 'Schulden', exact: true }).click();
  await page.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller !== null), true, 'Service Worker ging bei der Offline-Navigation verloren');
  const unexpectedErrors = errors.filter((error) => {
    const expectedOfflineSessionFailure = new URL(error.url || baseUrl).pathname === '/api/session'
      && /ERR_(?:FAILED|INTERNET_DISCONNECTED)/.test(error.message);
    return !expectedOfflineSessionFailure;
  });
  assert.deepEqual(unexpectedErrors, [], unexpectedErrors.map(({ message, url }) => `${message} (${url})`).join('\n'));
  console.log('Offline-Smoke-Test bestanden: App-Shell, lokales Google Sans Flex, Palette-Worker, gespeichertes Material-You-Theme und letzter gültiger normalisierter Datenstand laden offline.');
} finally {
  await context.setOffline(false);
  await context.close();
  await browser.close();
}
