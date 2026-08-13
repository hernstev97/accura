import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { anonymousFinanceData, installFinanceApiMocks, installPickerMock } from '../../scripts/fixtures/anonymous-finance-data.mjs';
import {
  denseOverviewFinanceData,
  emptyCollectionsFinanceData,
  extremeOverdrawnFinanceData,
} from '../../scripts/fixtures/finance-edge-cases.mjs';

type Theme = 'light' | 'dark';
type FinanceDestination = 'overview' | 'upcoming' | 'budget' | 'debt';
type FinanceState = 'connected' | 'signed-out' | 'no-spreadsheet' | 'validation-error' | 'reconnect';
const defaultVisualTime = new Date('2026-08-09T06:00:00Z');
const overviewHeading = /^(?:Guten Morgen|Guten Tag|Guten Abend|Gute Nacht)$/;
const destinationPaths: Record<FinanceDestination, string> = {
  overview: '/',
  upcoming: '/demnaechst',
  budget: '/budget',
  debt: '/schulden',
};

async function preparePage(
  page: Page,
  context: BrowserContext,
  state: FinanceState | 'offline-empty' = 'connected',
  theme: Theme = 'light',
  fixGreetingTime = false,
  initialPath = '/',
  financeData?: typeof extremeOverdrawnFinanceData,
) {
  if (fixGreetingTime) await page.clock.setFixedTime(defaultVisualTime);
  await context.setOffline(false);
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.removeItem('finance-appearance-v1');
    sessionStorage.clear();
  });
  await installPickerMock(page);
  if (state === 'offline-empty') {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false });
    });
    await page.route('**/api/**', (route) => route.abort('internetdisconnected'));
  } else {
    await installFinanceApiMocks(page, state, financeData);
  }
  await page.goto(initialPath, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--color-system-accent-source', '#2F667A');
    document.documentElement.style.setProperty('--color-on-system-accent-source', '#FFFFFF');
  });
  await page.waitForFunction(() => document.fonts.status === 'loaded');
}

async function openDestination(page: Page, destination: FinanceDestination) {
  const headings = { overview: overviewHeading, upcoming: 'Demnächst', budget: 'Dein Budget', debt: 'Dein Weg auf null' } as const;
  const labels = { overview: 'Übersicht', upcoming: 'Demnächst', budget: 'Budget', debt: 'Schulden' } as const;
  if (new URL(page.url()).pathname !== destinationPaths[destination]) {
    await page.getByRole('link', { name: labels[destination], exact: true }).click();
  }
  await page.getByRole('heading', { name: headings[destination] }).waitFor();
  expect(new URL(page.url()).pathname).toBe(destinationPaths[destination]);
}

async function capture(page: Page, name: string) {
  await expect(page).toHaveScreenshot(name, { fullPage: true });
}

async function expectNoAxeViolations(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations, `${label}: ${JSON.stringify(result.violations, null, 2)}`).toEqual([]);
}

function trackRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`Konsole: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`Laufzeit: ${error.message}`));
  return errors;
}

function financeDataWithExampleSubscription() {
  const financeData = structuredClone(anonymousFinanceData);
  financeData.asOf = '2026-08-12';
  financeData.budgetItems.push({
    id: 'example-subscription',
    label: 'Beispiel-Abo',
    monthlyAmountCents: 2300,
    necessityId: 'worthwhile',
    kind: 'expense',
    displayOrder: 99,
    active: true,
    note: null,
    dueDay: 12,
  });
  return financeData;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

async function expectMoneyValuesInsideContainers(page: Page, minimumCount = 1) {
  const inspected = await page.locator('.money-value').evaluateAll((values) => {
    const unmatched: object[] = [];
    const overflowing: object[] = [];
    values.forEach((value, index) => {
      const container = value.closest([
        '.financial-hero__value',
        '.metric-card__value',
        '.financial-hero',
        '.metric-card',
        '.allocation-legend__item',
        '.data-list__item',
        '.data-list__footer',
        '.pocket',
        '.milestone-row',
        '.debt-milestones > div',
        '.debt-progress__summary > div',
        '.finance-chart-tooltip',
        '.inline-notice',
      ].join(','));
      const identity = {
        index,
        value: value.textContent,
        className: value.className,
        parent: value.parentElement?.className ?? value.parentElement?.tagName ?? null,
      };
      if (!container) {
        unmatched.push(identity);
        return;
      }
      const valueRect = value.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const tolerance = 1;
      if (valueRect.left < containerRect.left - tolerance || valueRect.right > containerRect.right + tolerance) {
        overflowing.push({
          ...identity,
          container: container.className,
          containerWidth: containerRect.width,
          valueLeft: valueRect.left,
          valueRight: valueRect.right,
          valueWidth: valueRect.width,
        });
      }
    });
    return { count: values.length, overflowing, unmatched };
  });
  expect(inspected.count).toBeGreaterThanOrEqual(minimumCount);
  expect(inspected.unmatched).toEqual([]);
  expect(inspected.overflowing).toEqual([]);
}

async function expectPrimaryMoneyValuesOnOneLine(page: Page, minimumCount = 1) {
  const valueMetrics = await page
    .locator('.financial-hero__value > .money-value, .metric-card__value > .money-value')
    .evaluateAll((values) => values.map((value) => {
      const style = getComputedStyle(value);
      return {
        value: value.textContent,
        className: value.className,
        parent: value.parentElement?.className ?? value.parentElement?.tagName ?? null,
        height: value.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(style.lineHeight),
        whiteSpace: style.whiteSpace,
      };
    }));
  const offenders = valueMetrics.filter(({ height, lineHeight, whiteSpace }) =>
    whiteSpace !== 'nowrap' || !Number.isFinite(lineHeight) || height > lineHeight + 1);
  expect(valueMetrics.length).toBeGreaterThanOrEqual(minimumCount);
  expect(offenders).toEqual([]);
}

async function expectCompactHeroRingBesideCopy(page: Page, destination: 'overview' | 'budget') {
  const geometry = await page.locator(`.${destination}-screen .financial-hero`).evaluate((hero) => {
    const content = hero.querySelector('.financial-hero__content')?.getBoundingClientRect();
    const ringElement = hero.querySelector('.circular-allocation');
    const ring = ringElement?.getBoundingClientRect();
    const centerValue = hero.querySelector('.circular-allocation__center strong');
    const arcIds = [...(ringElement?.querySelectorAll('.circular-allocation__arc[data-allocation-id]') ?? [])]
      .map((arc) => arc.getAttribute('data-allocation-id'));
    return {
      arcIds,
      endCaps: [...(ringElement?.querySelectorAll('[data-allocation-end-cap]') ?? [])].map((cap) => ({
        id: cap.getAttribute('data-allocation-end-cap'),
        overlays: cap.getAttribute('data-overlays-allocation-id'),
        shape: cap.getAttribute('data-overlay-shape'),
      })),
      contentRight: content?.right ?? 0,
      ringLeft: ring?.left ?? 0,
      ringWidth: ring?.width ?? 0,
      centerWhiteSpace: centerValue ? getComputedStyle(centerValue).whiteSpace : '',
    };
  });
  expect(geometry.ringLeft).toBeGreaterThanOrEqual(geometry.contentRight - 0.5);
  expect(geometry.ringWidth).toBeGreaterThanOrEqual(164);
  expect(geometry.centerWhiteSpace).toBe('nowrap');
  expect(geometry.endCaps).toEqual(geometry.arcIds.length > 1 ? geometry.arcIds.map((id, index, arcIds) => ({
    id,
    overlays: arcIds[(index + 1) % arcIds.length],
    shape: 'full-circle',
  })) : []);
}

for (const scenario of [
  { name: 'overview-default', destination: 'overview' as const },
  { name: 'overview-detailed', destination: 'overview' as const, interact: async (page: Page) => page.locator('.overview-screen .circular-allocation__button').click() },
  { name: 'budget-categories', destination: 'budget' as const },
  { name: 'budget-necessity', destination: 'budget' as const, interact: async (page: Page) => page.getByRole('tab', { name: 'Notwendigkeit' }).click() },
  { name: 'debt-collapsed', destination: 'debt' as const },
  { name: 'debt-expanded', destination: 'debt' as const, interact: async (page: Page) => page.getByRole('button', { name: 'Verlauf anzeigen' }).click() },
]) {
  test(`412 light ${scenario.name}`, async ({ page, context }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await preparePage(page, context, 'connected', 'light', scenario.destination === 'overview', destinationPaths[scenario.destination]);
    await openDestination(page, scenario.destination);
    await scenario.interact?.(page);
    if (scenario.destination === 'overview' || scenario.destination === 'budget') {
      await expectCompactHeroRingBesideCopy(page, scenario.destination);
    }
    await capture(page, `412-light-${scenario.name}.png`);
  });
}

for (const scenario of [
  { name: 'signed-out', state: 'signed-out' as const, heading: 'Mit deiner Tabelle verbinden' },
  { name: 'no-spreadsheet', state: 'no-spreadsheet' as const, heading: 'Google-Tabelle auswählen' },
  { name: 'validation-error', state: 'validation-error' as const, heading: 'Tabelle konnte nicht übernommen werden' },
  { name: 'offline-empty', state: 'offline-empty' as const, heading: 'Noch kein lokaler Datenstand' },
]) {
  test(`412 light state ${scenario.name}`, async ({ page, context }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await preparePage(page, context, scenario.state);
    await page.getByRole('heading', { name: scenario.heading }).waitFor();
    await capture(page, `412-light-state-${scenario.name}.png`);
  });
}

test('overview greeting follows the local device time', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context, 'connected', 'light', true);

  for (const { time, greeting } of [
    { time: '2026-08-09T02:00:00Z', greeting: 'Gute Nacht' },
    { time: '2026-08-09T06:00:00Z', greeting: 'Guten Morgen' },
    { time: '2026-08-09T12:00:00Z', greeting: 'Guten Tag' },
    { time: '2026-08-09T18:00:00Z', greeting: 'Guten Abend' },
    { time: '2026-08-09T21:00:00Z', greeting: 'Gute Nacht' },
  ]) {
    await page.clock.setFixedTime(new Date(time));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('heading', { name: greeting })).toBeVisible();
  }

  await page.clock.setSystemTime(new Date('2026-08-09T08:59:59Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Guten Morgen' })).toBeVisible();
  await page.clock.fastForward(1_000);
  await expect(page.getByRole('heading', { name: 'Guten Tag' })).toBeVisible();
});

test('upcoming payments refresh after the local day changes', async ({ page, context }) => {
  const financeData = financeDataWithExampleSubscription();
  await page.clock.install({ time: new Date('2026-08-12T21:59:50.000Z') });
  await preparePage(page, context, 'connected', 'light', false, '/demnaechst', financeData);
  await expect(page.getByText('Beispiel-Abo', { exact: true })).toBeVisible();

  await page.clock.pauseAt(new Date('2026-08-12T21:59:59.900Z'));
  await page.clock.runFor(200);

  await expect(page.getByText('Beispiel-Abo', { exact: true })).toHaveCount(0);
});

test('upcoming payments refresh when the app becomes visible on a later day', async ({ page, context }) => {
  const financeData = financeDataWithExampleSubscription();
  await page.clock.install({ time: new Date('2026-08-12T10:00:00.000Z') });
  await preparePage(page, context, 'connected', 'light', false, '/demnaechst', financeData);
  await expect(page.getByText('Beispiel-Abo', { exact: true })).toBeVisible();

  await page.clock.setSystemTime(new Date('2026-08-13T10:00:00.000Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(page.getByText('Beispiel-Abo', { exact: true })).toHaveCount(0);
});

test('412 light info dialog', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context, 'connected', 'light', true);
  await page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  await page.getByLabel('Einstellungen öffnen').click();
  await page.getByRole('dialog', { name: 'Informationen' }).waitFor();
  await capture(page, '412-light-info-dialog.png');
});

test('412 light disconnect confirmation', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context, 'connected', 'light', true);
  await page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  await page.getByLabel('Einstellungen öffnen').click();
  await page.getByRole('button', { name: /Google-Verbindung trennen/ }).click();
  await page.getByText('Google-Verbindung trennen?').waitFor();
  await capture(page, '412-light-disconnect-confirmation.png');
});

for (const scenario of [
  { name: 'overview', destination: 'overview' as const },
  { name: 'budget', destination: 'budget' as const },
  { name: 'debt', destination: 'debt' as const },
]) {
  test(`412 dark ${scenario.name}`, async ({ page, context }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await preparePage(page, context, 'connected', 'dark', scenario.destination === 'overview', destinationPaths[scenario.destination]);
    await openDestination(page, scenario.destination);
    await capture(page, `412-dark-${scenario.name}.png`);
  });
}

test('412 dark validation error', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context, 'validation-error', 'dark');
  await page.getByRole('heading', { name: 'Tabelle konnte nicht übernommen werden' }).waitFor();
  await capture(page, '412-dark-validation-error.png');
});

test('412 dark info dialog', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context, 'connected', 'dark', true);
  await page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  await page.getByLabel('Einstellungen öffnen').click();
  await page.getByRole('dialog', { name: 'Informationen' }).waitFor();
  await capture(page, '412-dark-info-dialog.png');
});

for (const viewport of [{ width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
  for (const theme of viewport.width === 1440 ? (['light', 'dark'] as const) : (['light'] as const)) {
    for (const destination of ['overview', 'budget', 'debt'] as const) {
      test(`${viewport.width} ${theme} ${destination}`, async ({ page, context }) => {
        await page.setViewportSize(viewport);
        await preparePage(page, context, 'connected', theme, destination === 'overview', destinationPaths[destination]);
        await openDestination(page, destination);
        await capture(page, `${viewport.width}-${theme}-${destination}.png`);
      });
    }
  }
}

test('WCAG AA finance screens', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context);
  for (const destination of ['overview', 'upcoming', 'budget', 'debt'] as const) {
    await openDestination(page, destination);
    await expectNoAxeViolations(page, destination);
  }
});

test('WCAG AA connection states and dialogs', async ({ browser }) => {
  for (const state of ['signed-out', 'no-spreadsheet', 'validation-error', 'reconnect', 'offline-empty'] as const) {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'de-DE', serviceWorkers: 'block' });
    const page = await context.newPage();
    await preparePage(page, context, state);
    await expectNoAxeViolations(page, state);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'de-DE', serviceWorkers: 'block' });
  const page = await context.newPage();
  await preparePage(page, context);
  await page.getByLabel('Einstellungen öffnen').click();
  await page.getByRole('dialog', { name: 'Informationen' }).waitFor();
  await expectNoAxeViolations(page, 'Info-Dialog');
  await page.getByRole('button', { name: /Google-Verbindung trennen/ }).click();
  await expectNoAxeViolations(page, 'Disconnect-Dialog');
  await context.close();
});

test('320 extreme values, negative balances, and an overdrawn budget stay exact and readable', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await preparePage(page, context, 'connected', 'light', true, '/', extremeOverdrawnFinanceData);
  await page.getByRole('heading', { name: overviewHeading }).waitFor();

  await expect(page.getByRole('heading', { name: 'Budgetsaldo' })).toBeVisible();
  await expect(page.getByText('Budget liegt über dem Einkommen')).toBeVisible();
  await expect(page.getByText('Negative Kontostände berücksichtigt')).toBeVisible();
  await expect(page.getByText('-111.111.101,11 €', { exact: true }).first()).toBeVisible();
  await expect(page.locator('#overview-hero')).toHaveClass(/financial-hero--attention/);
  await expect(page.locator('#overview-hero [data-testid="allocation-center-value"]')).toHaveText('190,0 %');
  await expect(page.locator('#overview-hero [data-testid="allocation-accessible-summary"]')).toContainText('Fehlbetrag: -111.111.101,11 €');
  await expectNoHorizontalOverflow(page);
  await expectMoneyValuesInsideContainers(page);
  await expectPrimaryMoneyValuesOnOneLine(page);

  await openDestination(page, 'upcoming');
  await expect(page.getByText('Ausstehende Zahlungen übersteigen Guthaben')).toBeVisible();
  await expect(page.locator('#upcoming-hero .financial-hero__value')).not.toContainText(/frei/i);
  await expectNoHorizontalOverflow(page);
  await expectMoneyValuesInsideContainers(page);
  await expectPrimaryMoneyValuesOnOneLine(page);

  await openDestination(page, 'budget');
  await expect(page.getByText('Budgetsaldo', { exact: true })).toBeVisible();
  await expect(page.locator('#budget-hero')).toHaveClass(/financial-hero--attention/);
  await expect(page.locator('#budget-hero [data-testid="allocation-center-value"]')).toHaveText('190,0 %');
  await expectNoHorizontalOverflow(page);
  await expectMoneyValuesInsideContainers(page);
  await expectPrimaryMoneyValuesOnOneLine(page);

  await openDestination(page, 'debt');
  await expect(page.getByText('765.432.109,87 €', { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectMoneyValuesInsideContainers(page);
  await expectPrimaryMoneyValuesOnOneLine(page);
});

test('412 maximum safe cent values still fit hero and metric slots on one line', async ({ page, context }) => {
  const maximumSafeFinanceData = structuredClone(extremeOverdrawnFinanceData);
  maximumSafeFinanceData.monthlyIncomeCents = Number.MAX_SAFE_INTEGER;
  maximumSafeFinanceData.accounts = maximumSafeFinanceData.accounts.slice(0, 1);
  maximumSafeFinanceData.accountSnapshots = [{
    ...maximumSafeFinanceData.accountSnapshots[0],
    balanceCents: Number.MAX_SAFE_INTEGER,
  }];
  maximumSafeFinanceData.pockets = [];
  maximumSafeFinanceData.pocketSnapshots = [];
  maximumSafeFinanceData.budgetItems = [];
  maximumSafeFinanceData.reliefMilestones = [];

  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context, 'connected', 'light', true, '/', maximumSafeFinanceData);

  const overviewHeroValue = page.locator('#overview-hero .financial-hero__value');
  await expect(overviewHeroValue).toHaveText('90.071.992.547.409,91 €');
  await expect(overviewHeroValue).not.toContainText(/frei/i);
  await expectNoHorizontalOverflow(page);
  await expectMoneyValuesInsideContainers(page);
  await expectPrimaryMoneyValuesOnOneLine(page);

  await openDestination(page, 'budget');
  await expectNoHorizontalOverflow(page);
  await expectMoneyValuesInsideContainers(page);
  await expectPrimaryMoneyValuesOnOneLine(page);
});

test('320 negative income without budget items remains an empty deficit state', async ({ page, context }) => {
  const negativeEmptyBudgetData = structuredClone(emptyCollectionsFinanceData);
  negativeEmptyBudgetData.monthlyIncomeCents = -12_345;

  await page.setViewportSize({ width: 320, height: 800 });
  await preparePage(page, context, 'connected', 'light', true, '/', negativeEmptyBudgetData);

  await expect(page.getByRole('heading', { name: 'Budgetsaldo' })).toBeVisible();
  await expect(page.locator('#overview-hero')).toHaveClass(/financial-hero--attention/);
  await expect(page.locator('#overview-hero [data-testid="allocation-center-value"]')).toHaveText('–');
  await expect(page.locator('#overview-hero [data-testid="allocation-accessible-summary"]')).toContainText('Fehlbetrag: -123,45 €');
  await expect(page.getByText('Monatseinkommen ist negativ')).toBeVisible();
  await expect(page.getByText('Frei verfügbar', { exact: true })).toHaveCount(0);

  await openDestination(page, 'budget');
  await expect(page.locator('#budget-hero')).toHaveClass(/financial-hero--attention/);
  await expect(page.locator('#budget-hero')).toContainText('Negatives Monatseinkommen');
  await expect(page.locator('#budget-hero [data-testid="allocation-center-value"]')).toHaveText('–');
  await expect(page.locator('.metric-card').filter({ hasText: 'Budgetsaldo' })).toHaveClass(/metric-card--attention/);
  await expect(page.getByText('Monatseinkommen ist negativ')).toBeVisible();
  await expect(page.getByText('Noch keine Budgetpositionen', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectMoneyValuesInsideContainers(page);
  await expectPrimaryMoneyValuesOnOneLine(page);
});

test('320 empty finance collections show explanations instead of empty lists and charts', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await preparePage(page, context, 'connected', 'light', true, '/', emptyCollectionsFinanceData);

  await expect(page.getByText('Noch keine Konten')).toBeVisible();
  await expect(page.getByText('Noch keine Pockets')).toBeVisible();
  await expect(page.locator('#account-list [role="list"]')).toHaveCount(0);
  await expect(page.locator('#pocket-list article')).toHaveCount(0);

  await openDestination(page, 'upcoming');
  await expect(page.getByText('Keine anstehenden Abzüge')).toBeVisible();

  await openDestination(page, 'budget');
  await expect(page.getByText('Noch keine Budgetpositionen', { exact: true })).toBeVisible();
  await expect(page.locator('.budget-chart')).toHaveCount(0);

  await openDestination(page, 'debt');
  await expect(page.getByText('Keine aktiven Schulden', { exact: true })).toBeVisible();
  await expect(page.locator('#debt-hero, .debt-chart, .relief-chart')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('320 dense overview progressively exposes every account and pocket', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await preparePage(page, context, 'connected', 'light', true, '/', denseOverviewFinanceData);

  const accountButton = page.getByRole('button', { name: 'Alle 12 zeigen' });
  const pocketButton = page.getByRole('button', { name: 'Alle 18 zeigen' });
  const totalBefore = await page.locator('#account-list .data-list__footer').textContent();
  const heroBefore = await page.locator('#overview-hero .financial-hero__value').textContent();
  await expect(page.locator('#account-list [role="listitem"]')).toHaveCount(5);
  await expect(page.locator('#pocket-list .pocket')).toHaveCount(6);
  await expect(accountButton).toHaveAttribute('aria-expanded', 'false');
  await expect(pocketButton).toHaveAttribute('aria-expanded', 'false');

  await accountButton.click();
  const collapseAccountsButton = page.locator('#accounts').getByRole('button', { name: 'Weniger zeigen' });
  await expect(collapseAccountsButton).toBeFocused();
  await expect(collapseAccountsButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#account-list [role="listitem"]')).toHaveCount(12);
  await expect(page.locator('#account-list .data-list__footer')).toHaveText(totalBefore ?? '');

  await pocketButton.click();
  const collapsePocketsButton = page.locator('#pockets').getByRole('button', { name: 'Weniger zeigen' });
  await expect(collapsePocketsButton).toBeFocused();
  await expect(collapsePocketsButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#pocket-list .pocket')).toHaveCount(18);
  await expectNoHorizontalOverflow(page);
  await expectMoneyValuesInsideContainers(page);
  await expectPrimaryMoneyValuesOnOneLine(page);

  await collapseAccountsButton.click();
  await expect(page.locator('#account-list [role="listitem"]')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Alle 12 zeigen' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Alle 12 zeigen' })).toHaveAttribute('aria-expanded', 'false');

  await collapsePocketsButton.click();
  await expect(page.locator('#pocket-list .pocket')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Alle 18 zeigen' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Alle 18 zeigen' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#account-list .data-list__footer')).toHaveText(totalBefore ?? '');
  await expect(page.locator('#overview-hero .financial-hero__value')).toHaveText(heroBefore ?? '');
});

test('320 all-zero pockets keep their empty explanation and remain expandable', async ({ page, context }) => {
  const allZeroPocketsFinanceData = structuredClone(denseOverviewFinanceData);
  allZeroPocketsFinanceData.pocketSnapshots = allZeroPocketsFinanceData.pocketSnapshots.map((snapshot) => ({
    ...snapshot,
    balanceCents: 0,
  }));

  await page.setViewportSize({ width: 320, height: 800 });
  await preparePage(page, context, 'connected', 'light', true, '/', allZeroPocketsFinanceData);

  await expect(page.getByText('Alle Pockets sind leer', { exact: true })).toBeVisible();
  await expect(page.locator('#pocket-list .pocket')).toHaveCount(0);
  const expandButton = page.getByRole('button', { name: 'Alle 18 zeigen' });
  await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
  await expandButton.click();
  await expect(page.locator('#pocket-list .pocket')).toHaveCount(18);
  await expect(page.getByRole('button', { name: 'Weniger zeigen' })).toHaveAttribute('aria-expanded', 'true');
  await expectNoHorizontalOverflow(page);
});

test('320 active debts without milestones show both targeted empty chart states', async ({ page, context }) => {
  const debtsWithoutMilestonesFinanceData = structuredClone(extremeOverdrawnFinanceData);
  debtsWithoutMilestonesFinanceData.debtMilestones = [];
  debtsWithoutMilestonesFinanceData.reliefMilestones = [];

  await page.setViewportSize({ width: 320, height: 800 });
  await preparePage(page, context, 'connected', 'light', false, '/schulden', debtsWithoutMilestonesFinanceData);
  await openDestination(page, 'debt');

  await expect(page.getByText('Kein Restschuldverlauf hinterlegt', { exact: true })).toBeVisible();
  await expect(page.getByText('Keine künftige Entlastung hinterlegt', { exact: true })).toBeVisible();
  await expect(page.locator('.debt-chart, .relief-chart')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

for (const theme of ['light', 'dark'] as const) {
  for (const scenario of [
    { name: 'edge-extreme-overview', destination: 'overview' as const, data: extremeOverdrawnFinanceData },
    { name: 'edge-extreme-budget', destination: 'budget' as const, data: extremeOverdrawnFinanceData },
    { name: 'edge-empty-overview', destination: 'overview' as const, data: emptyCollectionsFinanceData },
    { name: 'edge-empty-budget', destination: 'budget' as const, data: emptyCollectionsFinanceData },
    { name: 'edge-empty-debt', destination: 'debt' as const, data: emptyCollectionsFinanceData },
    { name: 'edge-dense-overview-expanded', destination: 'overview' as const, data: denseOverviewFinanceData, expand: true },
  ]) {
    test(`412 ${theme} ${scenario.name}`, async ({ page, context }) => {
      const runtimeErrors = trackRuntimeErrors(page);
      await page.setViewportSize({ width: 412, height: 915 });
      await preparePage(page, context, 'connected', theme, scenario.destination === 'overview', destinationPaths[scenario.destination], scenario.data);
      await openDestination(page, scenario.destination);
      await expect(page.locator('html')).toHaveAttribute('data-theme-resolved', theme);
      if (scenario.expand) {
        await page.getByRole('button', { name: 'Alle 12 zeigen' }).click();
        await page.getByRole('button', { name: 'Alle 18 zeigen' }).click();
      }
      await expectNoHorizontalOverflow(page);
      const minimumMoneyValues = scenario.name === 'edge-empty-debt' ? 0 : 1;
      await expectMoneyValuesInsideContainers(page, minimumMoneyValues);
      await expectPrimaryMoneyValuesOnOneLine(page, minimumMoneyValues);
      await capture(page, `412-${theme}-${scenario.name}.png`);
      expect(runtimeErrors).toEqual([]);
    });
  }

  for (const scenario of [
    { name: 'extreme overview', destination: 'overview' as const, data: extremeOverdrawnFinanceData },
    { name: 'extreme budget', destination: 'budget' as const, data: extremeOverdrawnFinanceData },
    { name: 'empty overview', destination: 'overview' as const, data: emptyCollectionsFinanceData },
    { name: 'empty budget', destination: 'budget' as const, data: emptyCollectionsFinanceData },
    { name: 'empty debt', destination: 'debt' as const, data: emptyCollectionsFinanceData },
    { name: 'dense overview', destination: 'overview' as const, data: denseOverviewFinanceData },
  ]) {
    test(`412 ${theme} WCAG AA ${scenario.name} edge fixture`, async ({ page, context }) => {
      await page.setViewportSize({ width: 412, height: 915 });
      await preparePage(page, context, 'connected', theme, scenario.destination === 'overview', destinationPaths[scenario.destination], scenario.data);
      await openDestination(page, scenario.destination);
      await expectNoAxeViolations(page, `${theme} ${scenario.name}`);
    });
  }
}
