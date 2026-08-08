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

const approximately = (actual, expected, tolerance = 0.5) => Math.abs(actual - expected) <= tolerance;

async function navigationGeometry(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return { height: bounds.height, left: bounds.left, top: bounds.top, width: bounds.width };
    };
    return {
      bar: rect(document.querySelector('.bottom-navigation')),
      indicator: rect(document.querySelector('[data-testid="navigation-indicator"]')),
      items: [...document.querySelectorAll('.bottom-navigation__item')].map(rect),
    };
  });
}

async function navigationTransitionSamples(page) {
  return page.evaluate(async () => {
    const samples = [];
    for (let index = 0; index < 14; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const rect = (element) => {
        const bounds = element.getBoundingClientRect();
        return { height: bounds.height, left: bounds.left, top: bounds.top, width: bounds.width };
      };
      samples.push({
        bar: rect(document.querySelector('.bottom-navigation')),
        indicator: rect(document.querySelector('[data-testid="navigation-indicator"]')),
        items: [...document.querySelectorAll('.bottom-navigation__item')].map(rect),
      });
    }
    return samples;
  });
}

function assertStableNavigationGeometry(reference, sample, label) {
  assert.equal(approximately(sample.bar.top, reference.bar.top), true, `${label}: Navigationsleiste änderte ihre y-Position`);
  assert.equal(approximately(sample.bar.height, reference.bar.height), true, `${label}: Navigationsleiste änderte ihre Höhe`);
  assert.equal(sample.items.length, reference.items.length, `${label}: Navigationselemente änderten sich`);
  sample.items.forEach((item, index) => {
    assert.equal(approximately(item.top, reference.items[index].top), true, `${label}: Navigationselement ${index} änderte seine y-Position`);
    assert.equal(approximately(item.height, reference.items[index].height), true, `${label}: Navigationselement ${index} änderte seine Höhe`);
  });
  assert.equal(approximately(sample.indicator.top, reference.indicator.top), true, `${label}: Indikator änderte seine y-Position`);
  assert.equal(approximately(sample.indicator.height, reference.indicator.height), true, `${label}: Indikator änderte seine Höhe`);
  assert.equal(approximately(sample.indicator.width, reference.indicator.width), true, `${label}: Indikator änderte seine Breite`);
}

async function assertConcentric(page, outerSelector, innerSelector, label) {
  const geometry = await page.evaluate(({ outerSelector, innerSelector }) => {
    const outer = document.querySelector(outerSelector);
    const inner = document.querySelector(innerSelector);
    const outerBounds = outer.getBoundingClientRect();
    const innerBounds = inner.getBoundingClientRect();
    return {
      inset: innerBounds.left - outerBounds.left,
      innerRadius: Number.parseFloat(getComputedStyle(inner).borderTopLeftRadius),
      outerRadius: Number.parseFloat(getComputedStyle(outer).borderTopLeftRadius),
    };
  }, { outerSelector, innerSelector });
  assert.equal(approximately(geometry.innerRadius, Math.max(0, geometry.outerRadius - geometry.inset)), true, `${label}: ${JSON.stringify(geometry)}`);
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
  const overviewScreen = mobile.page.locator('[data-destination="overview"]');
  assert.equal(await overviewScreen.getAttribute('data-entrance'), 'first');
  const overviewText = await mobile.page.locator('body').innerText();
  assert.match(overviewText, /141,32\s*€\s*frei/);
  assert.match(overviewText, /1\.350,75\s*€/);
  assert.match(overviewText, /Coolblue endet im September 2026/);
  assert.match(overviewText, /Danach voraussichtlich 305,32\s*€ frei/);
  assert.match(overviewText, /164,00\s*€ mehr pro Monat/);
  assert.match(overviewText, /Zuletzt aktualisiert/);
  assert.doesNotMatch(overviewText, /debt-payment-ends/);
  assert.doesNotMatch(overviewText, /Raw English DKB spreadsheet note/);
  await mobile.page.screenshot({ path: '/tmp/finance-connected-mobile.png', fullPage: true });

  const overviewRing = mobile.page.locator('.overview-screen .circular-allocation');
  const statusTrigger = overviewRing.getByRole('button');
  const ringSegments = await overviewRing.locator('[data-allocation-id]').evaluateAll((elements) => elements.map((element) => ({
    amountCents: Number(element.getAttribute('data-amount-cents')),
    id: element.getAttribute('data-allocation-id'),
  })));
  assert.deepEqual(ringSegments, [
    { id: 'expenses', amountCents: 215_000 },
    { id: 'reserves', amountCents: 30_000 },
    { id: 'free', amountCents: 14_132 },
  ]);
  assert.equal(ringSegments.reduce((sum, segment) => sum + segment.amountCents, 0), Number(await overviewRing.getAttribute('data-total-cents')));
  assert.equal(Number(await overviewRing.getAttribute('data-summary-planned-cents')), 245_000);
  assert.match(await overviewRing.getByTestId('allocation-accessible-summary').textContent(), /Ausgaben: 2\.150,00\s*€.*Rücklagen: 300,00\s*€.*Frei: 141,32\s*€/);
  const statusBoundsBeforeToggle = await bounds(mobile.page.locator('.status-card'));
  const followingBoundsBeforeToggle = await bounds(mobile.page.locator('.quick-metrics'));
  await overviewRing.locator('svg').evaluate((element) => { element.dataset.persistenceProbe = 'same-svg'; });
  await statusTrigger.click();
  assert.equal(await statusTrigger.getAttribute('aria-pressed'), 'true');
  assert.equal(await overviewRing.getAttribute('data-detailed'), 'true');
  assert.equal(await overviewRing.locator('svg').getAttribute('data-persistence-probe'), 'same-svg');
  assert.deepEqual(await bounds(mobile.page.locator('.status-card')), statusBoundsBeforeToggle);
  assert.deepEqual(await bounds(mobile.page.locator('.quick-metrics')), followingBoundsBeforeToggle);
  await mobile.page.screenshot({ path: '/tmp/finance-overview-detailed.png', fullPage: true });
  await statusTrigger.press('Enter');
  assert.equal(await statusTrigger.getAttribute('aria-pressed'), 'false');

  await overviewScreen.evaluate((element) => {
    element.dataset.persistenceProbe = 'same-screen';
    window.__screenEntranceStarts = 0;
    element.addEventListener('animationstart', (event) => {
      if (event.animationName === 'screen-entrance') window.__screenEntranceStarts += 1;
    });
  });
  await mobile.page.getByLabel('Finanzdaten aktualisieren').click();
  await mobile.page.getByText('Aktuell', { exact: true }).waitFor();
  await mobile.page.waitForTimeout(350);
  assert.equal(await overviewScreen.getAttribute('data-persistence-probe'), 'same-screen');
  assert.equal(await mobile.page.evaluate(() => window.__screenEntranceStarts), 0, 'Datenaktualisierung spielte den Screen-Eingang erneut ab');
  await assertNoOverflow(mobile.page, 'Mobile Übersicht');
  await assertTouchTargets(mobile.page, 'Mobile Übersicht');

  await assertConcentric(mobile.page, '.status-card', '.allocation-metric', 'Übersichts-Hero');
  await assertConcentric(mobile.page, '.section-group', '.section-group .metric-card', 'Paarmetriken');
  await assertConcentric(mobile.page, '.grouped-list', '.grouped-list .grouped-row', 'Kontenliste');
  await assertConcentric(mobile.page, '.pocket-collection', '.pocket-collection .pocket', 'Pockets eingeklappt');

  const navigationIndicator = mobile.page.getByTestId('navigation-indicator');
  await navigationIndicator.evaluate((element) => { element.dataset.persistenceProbe = 'same-node'; });
  const overviewNavigationGeometry = await navigationGeometry(mobile.page);
  const navigationRadii = await mobile.page.evaluate(() => {
    const bar = document.querySelector('.bottom-navigation');
    const indicator = document.querySelector('[data-testid="navigation-indicator"]');
    return {
      inset: indicator.getBoundingClientRect().top - bar.getBoundingClientRect().top,
      inner: Math.min(
        Number.parseFloat(getComputedStyle(indicator).borderTopLeftRadius),
        indicator.getBoundingClientRect().height / 2,
        indicator.getBoundingClientRect().width / 2,
      ),
      outer: Number.parseFloat(getComputedStyle(bar).borderTopLeftRadius),
    };
  });
  assert.equal(approximately(navigationRadii.inner, navigationRadii.outer - navigationRadii.inset), true, `Navigationsecken sind nicht konzentrisch: ${JSON.stringify(navigationRadii)}`);

  const pocketAction = mobile.page.locator('.pocket-collection .extended-action');
  await pocketAction.click();
  assert.match(await mobile.page.locator('.pocket-collection').innerText(), /Technik/);
  await assertConcentric(mobile.page, '.pocket-collection', '.pocket-collection .pocket', 'Pockets ausgeklappt');

  await mobile.page.getByRole('button', { name: 'Budget', exact: true }).click();
  const navigationSamples = await navigationTransitionSamples(mobile.page);
  navigationSamples.forEach((sample, index) => assertStableNavigationGeometry(overviewNavigationGeometry, sample, `Indikatorframe ${index}`));
  await mobile.page.getByRole('heading', { name: 'Dein Budget' }).waitFor();
  assert.equal(await mobile.page.locator('[data-destination="budget"]').getAttribute('data-entrance'), 'first');
  assert.equal(await navigationIndicator.getAttribute('data-persistence-probe'), 'same-node');
  const budgetNavigationGeometry = await navigationGeometry(mobile.page);
  assertStableNavigationGeometry(overviewNavigationGeometry, budgetNavigationGeometry, 'Übersicht → Budget');
  assert.equal(budgetNavigationGeometry.indicator.left > overviewNavigationGeometry.indicator.left + 60, true);
  const budgetRing = mobile.page.locator('.budget-screen .circular-allocation');
  const budgetRingAmounts = await budgetRing.locator('[data-allocation-id]').evaluateAll((elements) => elements.map((element) => Number(element.getAttribute('data-amount-cents'))));
  assert.equal(budgetRingAmounts.reduce((sum, amount) => sum + amount, 0), Number(await budgetRing.getAttribute('data-total-cents')));
  assert.equal(await budgetRing.getAttribute('data-detailed'), 'true');
  await assertConcentric(mobile.page, '.allocation-group', '.reserve-row', 'Budget-Einkommen');
  await mobile.page.locator('.budget-chart .recharts-bar-rectangle').first().waitFor();
  assert.equal(await mobile.page.locator('.budget-chart .recharts-bar-rectangle').count(), 10);
  await assertChartsHaveLayout(mobile.page, 'Budget');
  await mobile.page.getByRole('tab', { name: 'Notwendigkeit' }).click();
  assert.equal(await mobile.page.locator('.budget-chart .recharts-bar-rectangle').count(), 5);
  await mobile.page.screenshot({ path: '/tmp/finance-budget.png', fullPage: true });

  await mobile.page.getByRole('button', { name: 'Schulden', exact: true }).click();
  await mobile.page.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
  assert.equal(await mobile.page.locator('[data-destination="debt"]').getAttribute('data-entrance'), 'first');
  const debtNavigationGeometry = await navigationGeometry(mobile.page);
  assertStableNavigationGeometry(overviewNavigationGeometry, debtNavigationGeometry, 'Budget → Schulden');
  const debtText = await mobile.page.locator('body').innerText();
  assert.match(debtText, /Ablösesumme heute[\s\S]*14\.322,93\s*€/);
  assert.match(debtText, /Noch planmäßig zu zahlen[\s\S]*19\.372,05\s*€/);
  assert.match(debtText, /99 verbleibende Raten/);
  assert.match(debtText, /Zukünftige Mehrkosten[\s\S]*5\.049,12\s*€/);
  assert.doesNotMatch(debtText, /99,00\s*€/);
  assert.doesNotMatch(debtText, /-14\.223,93\s*€/);
  assert.doesNotMatch(debtText, /debt-payment-ends|Raw English DKB spreadsheet note/);
  assert.match(debtText, /DKB[\s\S]*Kredit mit monatlicher Rate/);
  await assertChartsHaveLayout(mobile.page, 'Schulden');
  const debtAction = mobile.page.locator('.debt-progress .extended-action');
  await debtAction.click();
  assert.match(await mobile.page.locator('.debt-progress').innerText(), /September 2033[\s\S]*0,00\s*€/);
  await assertConcentric(mobile.page, '.debt-progress', '.debt-milestones', 'Schuldenverlauf');
  await assertConcentric(mobile.page, '.milestone-flow', '.milestone-flow .milestone-row', 'Entlastungsstufen');
  await assertNoOverflow(mobile.page, 'Mobile Schuldenansicht');
  await mobile.page.waitForTimeout(550);
  await mobile.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await mobile.page.screenshot({ path: '/tmp/finance-debt.png', fullPage: true });
  await mobile.page.locator('[data-destination="debt"]').evaluate((element) => { element.dataset.rapidTapProbe = 'same-screen'; });

  await mobile.page.evaluate(() => {
    const labels = ['Budget', 'Übersicht', 'Schulden'];
    labels.forEach((label) => [...document.querySelectorAll('.bottom-navigation__item')].find((item) => item.textContent.includes(label))?.click());
  });
  await mobile.page.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
  assert.equal(await mobile.page.getByRole('button', { name: 'Schulden', exact: true }).getAttribute('aria-current'), 'page');
  assert.equal(await mobile.page.locator('[data-destination="debt"]').getAttribute('data-rapid-tap-probe'), 'same-screen');
  assertStableNavigationGeometry(overviewNavigationGeometry, await navigationGeometry(mobile.page), 'Schnelle Navigation');

  await mobile.page.getByRole('button', { name: 'Übersicht', exact: true }).click();
  await mobile.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  const revisitedOverview = mobile.page.locator('[data-destination="overview"]');
  assert.equal(await revisitedOverview.getAttribute('data-entrance'), 'visited');
  assert.equal(await revisitedOverview.evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.animationName === 'screen-entrance').length), 0);
  assert.equal(await mobile.page.locator('.screen-transition').count(), 0, 'Veralteter Screen-Transition-Container ist noch vorhanden');
  await mobile.page.getByRole('button', { name: 'Budget', exact: true }).click();
  await mobile.page.getByRole('heading', { name: 'Dein Budget' }).waitFor();
  const revisitedBudget = mobile.page.locator('[data-destination="budget"]');
  assert.equal(await revisitedBudget.getAttribute('data-entrance'), 'visited');
  assert.equal(await revisitedBudget.evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.animationName === 'screen-entrance').length), 0);

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
    await test.page.screenshot({ path: `/tmp/finance-${viewport.name}.png`, fullPage: true });
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
  await dark.screenshot({ path: '/tmp/finance-connected-dark.png', fullPage: true });
  await assertNoOverflow(dark, 'Dark Mode');
  await assertConcentric(dark, '.status-card', '.allocation-metric', 'Dark-Mode-Hero');
  assert.deepEqual(darkErrors, [], darkErrors.join('\n'));
  await darkContext.close();

  const reducedContext = await browser.newContext({ viewport: { width: 412, height: 915 }, reducedMotion: 'reduce', locale: 'de-DE', serviceWorkers: 'block' });
  const reduced = await reducedContext.newPage();
  const reducedErrors = collectErrors(reduced);
  await installFinanceApiMocks(reduced);
  await reduced.goto(baseUrl, { waitUntil: 'networkidle' });
  await reduced.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  const reducedScreen = reduced.locator('[data-destination="overview"]');
  assert.equal(await reducedScreen.getAttribute('data-entrance'), 'reduced');
  assert.equal(await reducedScreen.evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.animationName === 'screen-entrance').length), 0);
  const reducedStatusTrigger = reduced.locator('.status-card').getByRole('button');
  await reducedStatusTrigger.click();
  assert.equal(await reducedStatusTrigger.getAttribute('aria-pressed'), 'true');
  await reduced.getByRole('button', { name: 'Budget', exact: true }).click();
  assert.equal(await reduced.locator('[data-destination="budget"]').getAttribute('data-entrance'), 'reduced');
  await reduced.getByRole('tab', { name: 'Notwendigkeit' }).click();
  assert.equal(await reduced.locator('.budget-chart .recharts-bar-rectangle').count(), 5);
  assert.deepEqual(reducedErrors, [], reducedErrors.join('\n'));
  await reducedContext.close();

  console.log('Browser-Smoke-Test bestanden: Auth-/Setup-/Picker-/Fehlerzustände, Finanzscreens, responsive Größen, Dark Mode, Fokus, Touch-Ziele und reduzierte Bewegung funktionieren mit gemockten Google-Endpunkten.');
} finally {
  await browser.close();
}
