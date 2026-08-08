import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });

function collectErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`Konsole: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`Laufzeit: ${error.message}`));
  return errors;
}

async function bounds(locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
  });
}

async function assertNoOverflow(page, label) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    true,
    `${label} läuft horizontal über`,
  );
}

async function assertTouchTargets(page, label) {
  const targets = await page.locator('button').evaluateAll((buttons) => buttons
    .filter((button) => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    })
    .map((button) => {
      const rect = button.getBoundingClientRect();
      return { height: rect.height, name: button.getAttribute('aria-label') ?? button.textContent?.trim(), width: rect.width };
    }));
  assert.equal(
    targets.every(({ height, width }) => height >= 47.5 && width >= 47.5),
    true,
    `${label} enthält ein Touch-Ziel unter 48px: ${JSON.stringify(targets)}`,
  );
}

async function captureInteraction(page, name, action) {
  await page.screenshot({ path: `/tmp/finanzen-${name}-000ms.png` });
  await action();
  await page.waitForTimeout(80);
  await page.screenshot({ path: `/tmp/finanzen-${name}-080ms.png` });
  await page.waitForTimeout(100);
  await page.screenshot({ path: `/tmp/finanzen-${name}-180ms.png` });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `/tmp/finanzen-${name}-380ms.png` });
}

async function assertChartsHaveLayout(page, label) {
  const chartLayouts = await page.locator('.recharts-surface').evaluateAll((charts) => charts.map((chart) => {
    const rect = chart.getBoundingClientRect();
    return { height: rect.height, width: rect.width };
  }));
  assert.equal(chartLayouts.length > 0, true, `${label} enthält kein Diagramm`);
  assert.equal(chartLayouts.every(({ height, width }) => height > 0 && width > 0), true, `${label}: Diagramm ohne Layoutfläche`);
}

try {
  const mobileContext = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    hasTouch: true,
    isMobile: true,
    locale: 'de-DE',
  });
  const mobile = await mobileContext.newPage();
  const mobileErrors = collectErrors(mobile);

  await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
  await mobile.locator('.screen-identity').filter({ hasText: 'Finanzen' }).waitFor();
  assert.equal(await mobile.locator('.vite-error-overlay').count(), 0, 'Vite-Fehleroverlay ist sichtbar');
  assert.match(await mobile.locator('body').innerText(), /141,32\s*€\s*frei/);
  assert.match(await mobile.locator('body').innerText(), /305,82\s*€/);
  assert.equal((await mobile.getByRole('heading', { name: 'Konten' }).boundingBox()).y < 915, true, 'Erster Viewport zeigt den nächsten Abschnitt nicht');
  await assertNoOverflow(mobile, 'Mobile Übersicht');
  await assertTouchTargets(mobile, 'Mobile Übersicht');
  await mobile.getByLabel('Über diese App').focus();
  assert.equal(await mobile.getByLabel('Über diese App').evaluate((element) => getComputedStyle(element).outlineWidth), '3px', 'Fokusbehandlung ist nicht sichtbar');
  await mobile.locator('main').focus();
  await mobile.screenshot({ path: '/tmp/finanzen-overview-mobile.png', fullPage: true });

  const navigationIndicator = mobile.getByTestId('navigation-indicator');
  assert.equal(await navigationIndicator.count(), 1, 'Es gibt nicht genau einen Navigationsindikator');
  await navigationIndicator.evaluate((element) => { element.dataset.persistenceProbe = 'same-node'; });
  const overviewIndicatorBounds = await bounds(navigationIndicator);

  const statusCard = mobile.locator('.status-card');
  const statusTrigger = statusCard.getByRole('button');
  const collapsedStatusHeight = (await bounds(statusCard)).height;
  await captureInteraction(mobile, 'metric-expansion', () => statusTrigger.click());
  assert.equal(await statusTrigger.getAttribute('aria-expanded'), 'true');
  assert.equal((await bounds(statusCard)).height > collapsedStatusHeight + 80, true, 'Statusfläche ist nicht geometrisch gewachsen');
  await assertNoOverflow(mobile, 'Erweiterte Statusfläche');
  await statusTrigger.click();
  await mobile.waitForTimeout(400);

  const pocketCollection = mobile.locator('.pocket-collection');
  const pocketAction = pocketCollection.locator('.extended-action');
  assert.match(await pocketAction.innerText(), /Alle zeigen/);
  const collapsedPocketHeight = (await bounds(pocketCollection)).height;
  await captureInteraction(mobile, 'pocket-expansion', () => pocketAction.click());
  assert.equal(await pocketAction.getAttribute('aria-expanded'), 'true');
  assert.match(await pocketAction.innerText(), /Ausblenden/);
  assert.match(await pocketCollection.innerText(), /Urlaub/);
  assert.match(await pocketCollection.innerText(), /Technik/);
  assert.equal((await bounds(pocketCollection)).height > collapsedPocketHeight + 70, true, 'Pocket-Container ist nicht gewachsen');
  await assertNoOverflow(mobile, 'Erweiterte Pockets');

  await captureInteraction(mobile, 'navigation', () => mobile.getByRole('button', { name: 'Budget', exact: true }).click());
  await mobile.getByRole('heading', { name: 'Dein Budget' }).waitFor();
  assert.equal(await navigationIndicator.getAttribute('data-persistence-probe'), 'same-node', 'Navigationsindikator wurde ersetzt');
  assert.equal(await navigationIndicator.count(), 1, 'Navigationsindikator wurde dupliziert');
  assert.equal((await bounds(navigationIndicator)).left > overviewIndicatorBounds.left + 60, true, 'Navigationsindikator ist nicht gereist');
  assert.equal(await mobile.getByRole('button', { name: 'Budget', exact: true }).getAttribute('aria-current'), 'page');

  await mobile.locator('.budget-chart .recharts-bar-rectangle').first().waitFor();
  assert.equal(await mobile.locator('.budget-chart .recharts-bar-rectangle').count(), 10, 'Kategoriediagramm enthält nicht zehn Balken');
  assert.match(await mobile.locator('body').innerText(), /Lebensmittel:\s*650,00\s*€/);
  await assertChartsHaveLayout(mobile, 'Budget');
  await assertNoOverflow(mobile, 'Mobiles Budget');
  await assertTouchTargets(mobile, 'Mobiles Budget');
  await mobile.screenshot({ path: '/tmp/finanzen-budget-mobile.png', fullPage: true });

  const segmentIndicator = mobile.getByTestId('segment-indicator');
  assert.equal(await segmentIndicator.count(), 1, 'Es gibt nicht genau einen Segmentindikator');
  await segmentIndicator.evaluate((element) => { element.dataset.persistenceProbe = 'same-node'; });
  const categoryIndicatorBounds = await bounds(segmentIndicator);
  const categoryChartHeight = (await bounds(mobile.locator('.budget-chart'))).height;
  await captureInteraction(mobile, 'budget-segment', () => mobile.getByRole('tab', { name: 'Notwendigkeit' }).click());
  assert.equal(await mobile.getByRole('tab', { name: 'Notwendigkeit' }).getAttribute('aria-selected'), 'true');
  assert.equal(await segmentIndicator.getAttribute('data-persistence-probe'), 'same-node', 'Segmentindikator wurde ersetzt');
  const necessityIndicatorBounds = await bounds(segmentIndicator);
  assert.equal(necessityIndicatorBounds.left > categoryIndicatorBounds.left + 40, true, 'Segmentindikator hat seine Position nicht geändert');
  assert.equal(Math.abs(necessityIndicatorBounds.width - categoryIndicatorBounds.width) > 8, true, 'Segmentindikator hat seine Breite nicht geändert');
  assert.equal((await bounds(mobile.locator('.budget-chart'))).height < categoryChartHeight - 100, true, 'Diagrammrahmen reagiert nicht auf den Modus');
  assert.equal(await mobile.locator('.budget-chart .recharts-bar-rectangle').count(), 4, 'Notwendigkeitsdiagramm enthält nicht vier Balken');

  await mobile.getByRole('button', { name: 'Schulden', exact: true }).click();
  await mobile.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
  assert.match(await mobile.locator('body').innerText(), /5\.049,12\s*€/);
  assert.equal(await mobile.locator('.recharts-surface').count(), 2, 'Schuldenansicht enthält nicht zwei Diagramme');
  await assertChartsHaveLayout(mobile, 'Schulden');
  await assertTouchTargets(mobile, 'Mobile Schuldenansicht');

  const debtProgress = mobile.locator('.debt-progress');
  const debtAction = debtProgress.locator('.extended-action');
  assert.match(await debtAction.innerText(), /Verlauf/);
  const collapsedDebtHeight = (await bounds(debtProgress)).height;
  await debtAction.click();
  await mobile.waitForTimeout(420);
  assert.equal(await debtAction.getAttribute('aria-expanded'), 'true');
  assert.equal((await bounds(debtProgress)).height > collapsedDebtHeight + 300, true, 'Schuldenverlauf ist nicht expandiert');
  assert.match(await debtProgress.innerText(), /September 2033[\s\S]*0,00\s*€/);
  await mobile.screenshot({ path: '/tmp/finanzen-debt-expanded-mobile.png', fullPage: true });
  await assertNoOverflow(mobile, 'Mobile Schuldenansicht');

  await mobile.getByLabel('Über diese App').click();
  await mobile.getByRole('dialog', { name: 'Finanzen · v0.1' }).waitFor();
  assert.equal(await mobile.getByLabel('Informationen schließen').evaluate((element) => element === document.activeElement), true, 'Infofläche übernimmt den Fokus nicht');
  await mobile.keyboard.press('Tab');
  assert.equal(await mobile.getByLabel('Informationen schließen').evaluate((element) => element === document.activeElement), true, 'Fokus verlässt die Infofläche');
  await mobile.keyboard.press('Escape');
  await mobile.getByRole('dialog').waitFor({ state: 'detached' });
  assert.deepEqual(mobileErrors, [], mobileErrors.join('\n'));
  await mobileContext.close();

  for (const viewport of [
    { width: 360, height: 800, name: '360x800' },
    { width: 768, height: 1024, name: '768x1024' },
    { width: 1440, height: 1000, name: '1440x1000' },
  ]) {
    const context = await browser.newContext({ viewport, locale: 'de-DE' });
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
    await assertNoOverflow(page, viewport.name);
    assert.equal(await page.locator('.navigation-rail').count(), 0, `${viewport.name} enthält noch eine Desktop-Rail`);
    assert.equal(await page.locator('.bottom-navigation').isVisible(), true, `${viewport.name} zeigt keine Bottom Navigation`);
    if (viewport.width === 1440) {
      const appBounds = await bounds(page.locator('.app-content'));
      assert.equal(appBounds.width <= 840, true, 'Desktop ist kein zentrierter Android-Feed');
      assert.equal(Math.abs(appBounds.left - (1440 - appBounds.width) / 2) < 2, true, 'Desktop-Feed ist nicht zentriert');
    }
    await page.screenshot({ path: `/tmp/finanzen-${viewport.name}.png`, fullPage: true });
    assert.deepEqual(errors, [], errors.join('\n'));
    await context.close();
  }

  const darkContext = await browser.newContext({ viewport: { width: 412, height: 915 }, colorScheme: 'dark', locale: 'de-DE' });
  const dark = await darkContext.newPage();
  const darkErrors = collectErrors(dark);
  await dark.goto(baseUrl, { waitUntil: 'networkidle' });
  await dark.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  const darkPageColor = await dark.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-page').trim());
  assert.equal(darkPageColor, '#111418', 'Dark-Mode-Tokens sind nicht aktiv');
  await dark.locator('.status-card').getByRole('button').click();
  await dark.screenshot({ path: '/tmp/finanzen-overview-dark-expanded.png', fullPage: true });
  await dark.getByRole('button', { name: 'Budget', exact: true }).click();
  await dark.locator('.recharts-surface').waitFor();
  await dark.screenshot({ path: '/tmp/finanzen-budget-dark.png', fullPage: true });
  await dark.getByRole('button', { name: 'Schulden', exact: true }).click();
  await dark.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
  await dark.locator('.debt-progress .extended-action').click();
  await dark.screenshot({ path: '/tmp/finanzen-debt-dark-expanded.png', fullPage: true });
  assert.deepEqual(darkErrors, [], darkErrors.join('\n'));
  await darkContext.close();

  const reducedContext = await browser.newContext({ viewport: { width: 412, height: 915 }, reducedMotion: 'reduce', locale: 'de-DE' });
  const reduced = await reducedContext.newPage();
  const reducedErrors = collectErrors(reduced);
  await reduced.goto(baseUrl, { waitUntil: 'networkidle' });
  const reducedStatusTrigger = reduced.locator('.status-card').getByRole('button');
  await reducedStatusTrigger.click();
  assert.equal(await reducedStatusTrigger.getAttribute('aria-expanded'), 'true', 'Reduzierte Bewegung verliert den Endzustand');
  await reduced.getByRole('button', { name: 'Budget', exact: true }).click();
  await reduced.getByRole('tab', { name: 'Notwendigkeit' }).click();
  assert.equal(await reduced.getByRole('tab', { name: 'Notwendigkeit' }).getAttribute('aria-selected'), 'true');
  assert.equal(
    await reduced.locator('.budget-chart .recharts-bar-rectangle').count(),
    4,
    'Reduzierte Bewegung rendert nicht den finalen Diagrammzustand',
  );
  assert.deepEqual(reducedErrors, [], reducedErrors.join('\n'));
  await reducedContext.close();

  console.log('Browser-Smoke-Test bestanden: MD3-Geometrie, persistente Indikatoren, Expansionen, Diagramme, responsive Größen, Dark Mode, Fokus und reduzierte Bewegung funktionieren fehlerfrei.');
} finally {
  await browser.close();
}
