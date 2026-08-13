import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installFinanceApiMocks } from './fixtures/anonymous-finance-data.mjs';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173';
const overviewHeading = /^(?:Guten Morgen|Guten Tag|Guten Abend|Gute Nacht)$/;
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
  await page.getByRole('heading', { name: overviewHeading }).waitFor();
  assert.equal(await page.locator('[data-destination="overview"]').getAttribute('data-entrance'), 'first');
  await page.getByLabel('Einstellungen öffnen').click();
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
  await page.getByRole('heading', { name: overviewHeading }).waitFor();
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
  const offlineHeroValue = await page.locator('#overview-hero .overview-allocation-bar[data-allocation-id="free"] .overview-allocation-bar__value').innerText();
  assert.match(offlineHeroValue, /^141,32\s*€$/, 'Offline-Hero zeigt nicht den erwarteten Betrag ohne frei-Zusatz');
  assert.match(offlineText, /Finanzierung A endet im September 2026/);
  assert.match(offlineText, /Danach voraussichtlich 261,32\s*€ frei/);
  assert.match(offlineText, /Offline · gespeicherter Stand/);
  await page.getByLabel('Einstellungen öffnen').click();
  const offlineInfo = await page.getByRole('dialog', { name: 'Informationen' }).innerText();
  assert.match(offlineInfo, /Andere Farben · Systemmodus/);
  assert.match(offlineInfo, /Offline verfügbar[\s\S]*Anonyme Finanzen/);
  assert.match(offlineInfo, /lokal auf diesem Gerät verfügbar/);
  assert.doesNotMatch(offlineInfo, /Jetzt aktualisieren|Andere Tabelle auswählen|Abmelden blendet Finanzdaten aus/);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Budget', exact: true }).click();
  await page.getByRole('heading', { name: 'Dein Budget' }).waitFor();
  await page.getByRole('link', { name: 'Schulden', exact: true }).click();
  await page.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/schulden', 'Offline-Reload verlor den Deep-Link-Pfad');
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller !== null), true, 'Offline-Deep-Link wurde nicht vom Service Worker kontrolliert');
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller !== null), true, 'Service Worker ging bei der Offline-Navigation verloren');

  const recoveredFinanceResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/finance' && response.ok());
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.locator('.sync-status__copy strong').getByText('Wird aktualisiert …', { exact: true }).waitFor();
  const recoveryResponse = await recoveredFinanceResponse;
  assert.equal(recoveryResponse.fromServiceWorker(), true, 'Online-Rückkehr umging den kontrollierenden Service Worker');
  await page.locator('.sync-status__copy strong').getByText('Aktuell', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-destination="debt"]').isVisible(), true, 'Online-Rückkehr verlor die aktive Ansicht');
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller !== null), true, 'Online-Rückkehr verlor die Service-Worker-Kontrolle');
  const recoveredCache = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('finance-overview', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('last-good', 'readonly');
      const getRequest = transaction.objectStore('last-good').get('finance-data-v1');
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        resolve(getRequest.result ?? null);
        database.close();
      };
    };
  }));
  assert.equal(recoveredCache?.refreshedAt, '2026-08-08T10:00:00.000Z', 'Erfolgreiche Online-Rückkehr wurde nicht lokal gespeichert');

  const unexpectedErrors = errors.filter((error) => {
    const expectedOfflineSessionFailure = new URL(error.url || baseUrl).pathname === '/api/session'
      && /ERR_(?:FAILED|INTERNET_DISCONNECTED)/.test(error.message);
    return !expectedOfflineSessionFailure;
  });
  assert.deepEqual(unexpectedErrors, [], unexpectedErrors.map(({ message, url }) => `${message} (${url})`).join('\n'));

  const coldContext = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'de-DE', serviceWorkers: 'allow' });
  const coldPage = await coldContext.newPage();
  const coldErrors = [];
  coldPage.on('console', (message) => {
    if (message.type() === 'error') coldErrors.push({ message: `Konsole: ${message.text()}`, url: message.location().url });
  });
  coldPage.on('pageerror', (error) => coldErrors.push({ message: `Laufzeit: ${error.message}`, url: '' }));
  try {
    await installFinanceApiMocks(coldPage, 'signed-out');
    await coldPage.goto(baseUrl, { waitUntil: 'networkidle' });
    await coldPage.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();
    await coldPage.evaluate(() => navigator.serviceWorker.ready);
    await coldPage.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await coldPage.unrouteAll({ behavior: 'wait' });
    await coldContext.setOffline(true);
    await coldPage.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
    await coldPage.getByRole('heading', { name: 'Noch kein lokaler Datenstand' }).waitFor();
    assert.equal(await coldPage.getByRole('button', { name: /Google|anmelden|aktualisieren/i }).count(), 0, 'Leerer Offline-Start bietet eine nicht ausführbare Netzwerkaktion an');
    assert.equal(await coldPage.evaluate(() => navigator.serviceWorker.controller !== null), true, 'Leerer Offline-Start verlor die Service-Worker-Kontrolle');
    const unexpectedColdErrors = coldErrors.filter((error) => {
      const expectedOfflineSessionFailure = new URL(error.url || baseUrl).pathname === '/api/session'
        && /ERR_(?:FAILED|INTERNET_DISCONNECTED)/.test(error.message);
      return !expectedOfflineSessionFailure;
    });
    assert.deepEqual(unexpectedColdErrors, [], unexpectedColdErrors.map(({ message, url }) => `${message} (${url})`).join('\n'));
  } finally {
    await coldContext.setOffline(false);
    await coldContext.close();
  }

  console.log('Offline-Smoke-Test bestanden: Warmstart, leerer Offline-Start, lokales Theme und letzter gültiger Datenstand sowie automatische Online-Rückkehr funktionieren.');
} finally {
  await context.setOffline(false);
  await context.close();
  await browser.close();
}
