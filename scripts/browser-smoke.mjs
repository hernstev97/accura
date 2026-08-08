import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installFinanceApiMocks, installPickerMock } from './fixtures/anonymous-finance-data.mjs';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });

function collectErrors(page) {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`Konsole: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`Laufzeit: ${error.message}`));
  return errors;
}

async function bounds(locator) {
  return locator.evaluate((element) => { const rect = element.getBoundingClientRect(); return { height: rect.height, left: rect.left, top: rect.top, width: rect.width }; });
}

async function assertNoOverflow(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${label} läuft horizontal über`);
}

async function assertTouchTargets(page, label) {
  const targets = await page.locator('button').evaluateAll((buttons) => buttons.filter((button) => {
    const style = getComputedStyle(button); const rect = button.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }).map((button) => { const rect = button.getBoundingClientRect(); return { height: rect.height, name: button.getAttribute('aria-label') ?? button.textContent?.trim(), width: rect.width }; }));
  assert.equal(targets.every(({ height, width }) => height >= 47.5 && width >= 47.5), true, `${label} enthält ein Touch-Ziel unter 48px: ${JSON.stringify(targets)}`);
}

async function assertChartsHaveLayout(page, label) {
  const chartLayouts = await page.locator('.recharts-surface').evaluateAll((charts) => charts.map((chart) => { const rect = chart.getBoundingClientRect(); return { height: rect.height, width: rect.width }; }));
  assert.equal(chartLayouts.length > 0, true, `${label} enthält kein Diagramm`);
  assert.equal(chartLayouts.every(({ height, width }) => height > 0 && width > 0), true, `${label}: Diagramm ohne Layoutfläche`);
}

async function statePage(state, viewport = { width: 412, height: 915 }) {
  const context = await browser.newContext({ viewport, locale: 'de-DE', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = collectErrors(page);
  await installFinanceApiMocks(page, state);
  await installPickerMock(page);
  return { context, page, errors };
}

try {
  for (const [state, expected] of [
    ['signed-out', 'Mit deiner Tabelle verbinden'],
    ['no-spreadsheet', 'Google-Tabelle auswählen'],
    ['validation-error', 'Tabelle konnte nicht übernommen werden'],
    ['reconnect', 'Google erneut verbinden'],
  ]) {
    const test = await statePage(state);
    await test.page.goto(baseUrl, { waitUntil: 'networkidle' });
    await test.page.getByRole('heading', { name: expected }).waitFor();
    await assertNoOverflow(test.page, state);
    await assertTouchTargets(test.page, state);
    const expectedStatus = state === 'validation-error' ? '422' : state === 'reconnect' ? '401' : null;
    const unexpectedErrors = expectedStatus ? test.errors.filter((error) => !error.includes(`status of ${expectedStatus}`)) : test.errors;
    assert.deepEqual(unexpectedErrors, [], unexpectedErrors.join('\n'));
    await test.context.close();
  }

  const loading = await statePage('loading');
  await loading.page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await loading.page.getByText('Verbindung wird geprüft …').waitFor();
  await loading.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  assert.deepEqual(loading.errors, [], loading.errors.join('\n'));
  await loading.context.close();

  const picker = await statePage('no-spreadsheet');
  await picker.page.goto(baseUrl, { waitUntil: 'networkidle' });
  await picker.page.getByRole('button', { name: 'Google-Tabelle auswählen' }).click();
  await picker.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  assert.match(await picker.page.locator('body').innerText(), /Anonyme|Google Sheets/);
  assert.deepEqual(picker.errors, [], picker.errors.join('\n'));
  await picker.context.close();

  const logout = await statePage('connected');
  await logout.page.goto(baseUrl, { waitUntil: 'networkidle' });
  await logout.page.getByLabel('Verbindung und Informationen').click();
  await logout.page.getByRole('button', { name: 'Abmelden' }).click();
  await logout.page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();
  assert.deepEqual(logout.errors, [], logout.errors.join('\n'));
  await logout.context.close();

  const mobile = await statePage('connected');
  await mobile.page.goto(baseUrl, { waitUntil: 'networkidle' });
  await mobile.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  assert.match(await mobile.page.locator('body').innerText(), /550,00\s*€\s*frei/);
  assert.match(await mobile.page.locator('body').innerText(), /1\.350,75\s*€/);
  assert.match(await mobile.page.locator('body').innerText(), /Zuletzt aktualisiert/);
  await mobile.page.screenshot({ path: '/tmp/finance-connected-mobile.png', fullPage: true });
  await mobile.page.getByLabel('Finanzdaten aktualisieren').click();
  await mobile.page.getByText('Aktuell', { exact: true }).waitFor();
  await assertNoOverflow(mobile.page, 'Mobile Übersicht');
  await assertTouchTargets(mobile.page, 'Mobile Übersicht');

  const navigationIndicator = mobile.page.getByTestId('navigation-indicator');
  await navigationIndicator.evaluate((element) => { element.dataset.persistenceProbe = 'same-node'; });
  const overviewIndicatorBounds = await bounds(navigationIndicator);

  const statusTrigger = mobile.page.locator('.status-card').getByRole('button');
  await statusTrigger.click();
  assert.equal(await statusTrigger.getAttribute('aria-expanded'), 'true');
  await statusTrigger.click();

  const pocketAction = mobile.page.locator('.pocket-collection .extended-action');
  await pocketAction.click();
  assert.match(await mobile.page.locator('.pocket-collection').innerText(), /Technik/);

  await mobile.page.getByRole('button', { name: 'Budget', exact: true }).click();
  await mobile.page.getByRole('heading', { name: 'Dein Budget' }).waitFor();
  assert.equal(await navigationIndicator.getAttribute('data-persistence-probe'), 'same-node');
  assert.equal((await bounds(navigationIndicator)).left > overviewIndicatorBounds.left + 60, true);
  await mobile.page.locator('.budget-chart .recharts-bar-rectangle').first().waitFor();
  assert.equal(await mobile.page.locator('.budget-chart .recharts-bar-rectangle').count(), 10);
  await assertChartsHaveLayout(mobile.page, 'Budget');
  await mobile.page.getByRole('tab', { name: 'Notwendigkeit' }).click();
  assert.equal(await mobile.page.locator('.budget-chart .recharts-bar-rectangle').count(), 5);

  await mobile.page.getByRole('button', { name: 'Schulden', exact: true }).click();
  await mobile.page.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
  assert.match(await mobile.page.locator('body').innerText(), /1\.060,00\s*€/);
  await assertChartsHaveLayout(mobile.page, 'Schulden');
  const debtAction = mobile.page.locator('.debt-progress .extended-action');
  await debtAction.click();
  assert.match(await mobile.page.locator('.debt-progress').innerText(), /September 2029[\s\S]*0,00\s*€/);
  await assertNoOverflow(mobile.page, 'Mobile Schuldenansicht');

  await mobile.page.getByLabel('Verbindung und Informationen').click();
  const dialog = mobile.page.getByRole('dialog', { name: 'Finanzen · v1' });
  await dialog.waitFor();
  assert.equal(await mobile.page.getByLabel('Informationen schließen').evaluate((element) => element === document.activeElement), true);
  await mobile.page.keyboard.press('Shift+Tab');
  assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true, 'Fokus verlässt den Dialog');
  await mobile.page.getByRole('button', { name: /Google-Verbindung trennen/ }).click();
  await mobile.page.getByText('Google-Verbindung trennen?').waitFor();
  await mobile.page.getByRole('button', { name: 'Abbrechen' }).click();
  await mobile.page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await mobile.page.getByLabel('Verbindung und Informationen').click();
  await mobile.page.getByRole('button', { name: /Google-Verbindung trennen/ }).click();
  await mobile.page.getByRole('button', { name: 'Endgültig trennen' }).click();
  await mobile.page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();
  const cachedAfterDisconnect = await mobile.page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('finance-overview', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('last-good', 'readonly');
      const getRequest = transaction.objectStore('last-good').get('finance-data-v1');
      getRequest.onsuccess = () => { resolve(getRequest.result ?? null); database.close(); };
      getRequest.onerror = () => reject(getRequest.error);
    };
  }));
  assert.equal(cachedAfterDisconnect, null, 'Disconnect hat den IndexedDB-Datenstand nicht entfernt');
  assert.deepEqual(mobile.errors, [], mobile.errors.join('\n'));
  await mobile.context.close();

  for (const viewport of [
    { width: 360, height: 800, name: '360x800' },
    { width: 768, height: 1024, name: '768x1024' },
    { width: 1440, height: 1000, name: '1440x1000' },
  ]) {
    const test = await statePage('connected', viewport);
    await test.page.goto(baseUrl, { waitUntil: 'networkidle' });
    await test.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
    await assertNoOverflow(test.page, viewport.name);
    assert.equal(await test.page.locator('.bottom-navigation').isVisible(), true);
    if (viewport.width === 1440) {
      const appBounds = await bounds(test.page.locator('.app-content'));
      assert.equal(appBounds.width <= 840, true);
      assert.equal(Math.abs(appBounds.left - (1440 - appBounds.width) / 2) < 2, true);
    }
    assert.deepEqual(test.errors, [], test.errors.join('\n'));
    await test.context.close();
  }

  const darkContext = await browser.newContext({ viewport: { width: 412, height: 915 }, colorScheme: 'dark', locale: 'de-DE', serviceWorkers: 'block' });
  const dark = await darkContext.newPage();
  const darkErrors = collectErrors(dark);
  await installFinanceApiMocks(dark);
  await dark.goto(baseUrl, { waitUntil: 'networkidle' });
  await dark.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  assert.equal(await dark.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-page').trim()), '#111418');
  assert.deepEqual(darkErrors, [], darkErrors.join('\n'));
  await darkContext.close();

  const reducedContext = await browser.newContext({ viewport: { width: 412, height: 915 }, reducedMotion: 'reduce', locale: 'de-DE', serviceWorkers: 'block' });
  const reduced = await reducedContext.newPage();
  const reducedErrors = collectErrors(reduced);
  await installFinanceApiMocks(reduced);
  await reduced.goto(baseUrl, { waitUntil: 'networkidle' });
  const reducedStatusTrigger = reduced.locator('.status-card').getByRole('button');
  await reducedStatusTrigger.click();
  assert.equal(await reducedStatusTrigger.getAttribute('aria-expanded'), 'true');
  await reduced.getByRole('button', { name: 'Budget', exact: true }).click();
  await reduced.getByRole('tab', { name: 'Notwendigkeit' }).click();
  assert.equal(await reduced.locator('.budget-chart .recharts-bar-rectangle').count(), 5);
  assert.deepEqual(reducedErrors, [], reducedErrors.join('\n'));
  await reducedContext.close();

  console.log('Browser-Smoke-Test bestanden: Auth-/Setup-/Picker-/Fehlerzustände, Finanzscreens, responsive Größen, Dark Mode, Fokus, Touch-Ziele und reduzierte Bewegung funktionieren mit gemockten Google-Endpunkten.');
} finally {
  await browser.close();
}
