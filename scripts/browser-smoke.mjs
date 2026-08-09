import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installFinanceApiMocks, installPickerMock } from './fixtures/anonymous-finance-data.mjs';
import { createAppearanceImageFixture } from './fixtures/appearance-image.mjs';

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

async function assertGoogleSansFlex(page, label) {
  await page.waitForFunction(() => document.fonts.check('16px "Google Sans Flex Variable"'));
  const typography = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const previousFontElements = [...document.querySelectorAll('body *')].filter((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 && /Roboto Flex/i.test(getComputedStyle(element).fontFamily);
    });
    return {
      family: rootStyle.fontFamily,
      opticalSizing: rootStyle.fontOpticalSizing,
      previousFontCount: previousFontElements.length,
      variation: rootStyle.fontVariationSettings,
    };
  });
  assert.match(typography.family, /Google Sans Flex Variable/, `${label}: falsche Schriftfamilie`);
  assert.equal(typography.opticalSizing, 'auto', `${label}: optische Größenachse ist nicht automatisch`);
  assert.match(typography.variation, /"ROND" 100/, `${label}: ROND 100 fehlt: ${typography.variation}`);
  assert.match(typography.variation, /"wdth" 100/, `${label}: normale Breite fehlt: ${typography.variation}`);
  assert.equal(typography.previousFontCount, 0, `${label}: sichtbarer Text verwendet noch Roboto Flex`);
}

async function assertRingCenterFits(page, ringSelector, label) {
  const geometry = await page.locator(ringSelector).evaluate((ring) => {
    const value = ring.querySelector('[data-testid="allocation-center-value"]');
    const ringBounds = ring.getBoundingClientRect();
    const valueBounds = value.getBoundingClientRect();
    const strokeWidth = Number(ring.getAttribute('data-stroke-width'));
    const radius = Number(ring.getAttribute('data-path-radius'));
    const innerRadius = (radius - strokeWidth / 2) * (ringBounds.width / 132);
    const centerX = ringBounds.left + ringBounds.width / 2;
    const centerY = ringBounds.top + ringBounds.height / 2;
    const style = getComputedStyle(value);
    return {
      innerBottom: centerY + innerRadius,
      innerLeft: centerX - innerRadius,
      innerRight: centerX + innerRadius,
      innerTop: centerY - innerRadius,
      text: value.textContent,
      textOverflow: style.textOverflow,
      valueBottom: valueBounds.bottom,
      valueLeft: valueBounds.left,
      valueRight: valueBounds.right,
      valueTop: valueBounds.top,
      whiteSpace: style.whiteSpace,
    };
  });
  assert.match(geometry.text, /\d[\d.]*,\d{2}\s*€/, `${label}: Betrag ist nicht vollständig deutsch formatiert`);
  assert.equal(geometry.text.includes('…'), false, `${label}: Betrag enthält Ellipsis`);
  assert.notEqual(geometry.textOverflow, 'ellipsis', `${label}: Betrag verwendet text-overflow: ellipsis`);
  assert.equal(geometry.whiteSpace, 'nowrap', `${label}: Betrag ist nicht gegen Umbruch geschützt`);
  assert.equal(geometry.valueLeft >= geometry.innerLeft + 2, true, `${label}: Betrag berührt den Ring links`);
  assert.equal(geometry.valueRight <= geometry.innerRight - 2, true, `${label}: Betrag berührt den Ring rechts`);
  assert.equal(geometry.valueTop >= geometry.innerTop + 2, true, `${label}: Betrag berührt den Ring oben`);
  assert.equal(geometry.valueBottom <= geometry.innerBottom - 2, true, `${label}: Betrag berührt den Ring unten`);
}

async function assertLayeredRing(page, ringSelector, label) {
  const geometry = await page.locator(ringSelector).evaluate((ring) => ({
    arcs: [...ring.querySelectorAll('[data-allocation-id]')].map((arc) => ({
      cap: Number(arc.getAttribute('data-cap-extension')),
      dash: Number(arc.getAttribute('data-dash-length')),
      dasharray: arc.getAttribute('stroke-dasharray'),
      order: Number(arc.getAttribute('data-draw-order')),
      overlapAfter: Number(arc.getAttribute('data-overlap-after')),
      overlapBefore: Number(arc.getAttribute('data-overlap-before')),
      tiny: arc.getAttribute('data-tiny') === 'true',
      visible: Number(arc.getAttribute('data-visible-span')),
    })),
    markup: ring.innerHTML,
    mode: ring.getAttribute('data-geometry'),
  }));
  assert.equal(geometry.mode, 'layered-overlap', `${label}: falscher Geometriemodus`);
  assert.equal(/NaN|Infinity|undefined/.test(geometry.markup), false, `${label}: ungültiges SVG-Attribut`);
  assert.deepEqual(geometry.arcs.map(({ order }) => order), geometry.arcs.map((_, index) => index), `${label}: Zeichenreihenfolge ist instabil`);
  assert.equal(geometry.arcs.every(({ cap, dash, visible }) => Number.isFinite(cap) && Number.isFinite(dash) && Number.isFinite(visible) && dash >= 0 && visible > 0 && visible <= 100), true, `${label}: ungültige Bogenlänge`);
  assert.equal(geometry.arcs.every(({ cap, dash, visible }) => approximately(dash + cap * 2, visible, 0.02)), true, `${label}: Rundkappen wurden nicht aus der sichtbaren Länge korrigiert`);
  assert.equal(geometry.arcs.every(({ overlapAfter, overlapBefore }) => overlapAfter > 0 && overlapBefore > 0), true, `${label}: Layer-Überlappung fehlt`);
  assert.equal(geometry.arcs.every(({ dasharray }) => dasharray && !dasharray.includes('-')), true, `${label}: ungültiges stroke-dasharray`);
}

async function accentSnapshot(page) {
  return page.evaluate(() => {
    const style = (selector) => getComputedStyle(document.querySelector(selector));
    const root = getComputedStyle(document.documentElement);
    return {
      expense: style('.overview-screen [data-allocation-id="expenses"]').stroke,
      focus: style('.circular-allocation__button').outlineColor,
      free: style('.overview-screen [data-allocation-id="free"]').stroke,
      navigation: style('[data-testid="navigation-indicator"]').backgroundColor,
      reserve: style('.overview-screen [data-allocation-id="reserves"]').stroke,
      resolved: root.getPropertyValue('--color-system-accent').trim(),
    };
  });
}

async function themeSnapshot(page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      mode: document.documentElement.dataset.themeMode,
      resolved: document.documentElement.dataset.themeResolved,
      source: document.documentElement.dataset.colorSource,
      page: style.getPropertyValue('--color-page').trim(),
      primary: style.getPropertyValue('--color-primary').trim(),
      primaryContainer: style.getPropertyValue('--color-primary-container').trim(),
      positive: style.getPropertyValue('--color-positive-container').trim(),
      attention: style.getPropertyValue('--color-attention-container').trim(),
      reserve: style.getPropertyValue('--chart-worthwhile').trim(),
      free: style.getPropertyValue('--chart-free').trim(),
    };
  });
}

async function openSettings(page) {
  await page.getByLabel('Einstellungen öffnen').click();
  const dialog = page.getByRole('dialog', { name: 'Einstellungen' });
  await dialog.waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Einstellungen schließen');
  return dialog;
}

async function openColors(page) {
  await page.getByRole('button', { name: /Farben & Design/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Farben' });
  await dialog.waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Farben schließen');
  return dialog;
}

async function appearancePreviewExists(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.open('finance-appearance-v1', 1);
    request.onerror = () => resolve(false);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('assets')) request.result.createObjectStore('assets');
    };
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('assets')) { database.close(); resolve(false); return; }
      const getRequest = database.transaction('assets', 'readonly').objectStore('assets').get('wallpaper-preview');
      getRequest.onsuccess = () => { resolve(Boolean(getRequest.result?.blob)); database.close(); };
      getRequest.onerror = () => { resolve(false); database.close(); };
    };
  }));
}

async function assertModalWithinViewport(page, selector, label) {
  const geometry = await page.locator(selector).evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      bottom: bounds.bottom,
      height: bounds.height,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  assert.equal(geometry.left >= -0.5 && geometry.right <= geometry.viewportWidth + 0.5, true, `${label} läuft horizontal aus dem Viewport: ${JSON.stringify(geometry)}`);
  assert.equal(geometry.top >= -0.5 && geometry.bottom <= geometry.viewportHeight + 0.5, true, `${label} läuft vertikal aus dem Viewport: ${JSON.stringify(geometry)}`);
}

async function assertAppearanceControlLayout(dialog, label) {
  const segmented = await dialog.locator('.appearance-segmented__option').evaluateAll((options) => options.map((option) => {
    const bounds = option.getBoundingClientRect();
    const copy = option.querySelector('span');
    return {
      height: bounds.height,
      labelFits: copy.scrollWidth <= copy.clientWidth + 1,
      width: bounds.width,
    };
  }));
  assert.equal(segmented.every(({ height, labelFits, width }) => height >= 47.5 && width >= 47.5 && labelFits), true, `${label} enthält ein zu kleines oder abgeschnittenes Segment: ${JSON.stringify(segmented)}`);

  const focusGeometry = await dialog.locator('.palette-swatch[data-selected="true"]').evaluate((swatch) => {
    swatch.querySelector('input').focus();
    const color = swatch.querySelector('.palette-swatch__color');
    const scroller = swatch.closest('.palette-swatches');
    const colorBounds = color.getBoundingClientRect();
    const scrollerBounds = scroller.getBoundingClientRect();
    const style = getComputedStyle(color);
    const focusExtent = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
    return {
      bottom: colorBounds.bottom + focusExtent <= scrollerBounds.bottom + 0.5,
      left: colorBounds.left - focusExtent >= scrollerBounds.left - 0.5,
      right: colorBounds.right + focusExtent <= scrollerBounds.right + 0.5,
      size: { height: colorBounds.height, width: colorBounds.width },
      top: colorBounds.top - focusExtent >= scrollerBounds.top - 0.5,
    };
  });
  assert.equal(focusGeometry.size.height >= 58 && focusGeometry.size.width >= 58, true, `${label} enthält eine zu kleine Palette: ${JSON.stringify(focusGeometry)}`);
  assert.equal(focusGeometry.top && focusGeometry.right && focusGeometry.left && focusGeometry.bottom, true, `${label} schneidet den Swatch-Fokusrahmen ab: ${JSON.stringify(focusGeometry)}`);
}

async function assertDecorativeSquiggle(page, selector, label) {
  const geometry = await page.locator(selector).evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const container = element.closest('aside, .milestone-flow, .debt-progress__arrow');
    const containerBounds = container?.getBoundingClientRect();
    const path = element.querySelector('path');
    return {
      ariaHidden: element.getAttribute('aria-hidden'),
      clipped: containerBounds ? bounds.left < containerBounds.left - 1 || bounds.right > containerBounds.right + 1 || bounds.top < containerBounds.top - 1 || bounds.bottom > containerBounds.bottom + 1 : false,
      height: bounds.height,
      opacity: Number(getComputedStyle(element).opacity),
      pathStrokeWidth: Number.parseFloat(getComputedStyle(path).strokeWidth),
      width: bounds.width,
    };
  });
  assert.equal(geometry.ariaHidden, 'true', `${label}: Squiggle ist nicht dekorativ verborgen`);
  assert.equal(geometry.width > 0 && geometry.height > 0, true, `${label}: Squiggle hat keine sichtbare Fläche`);
  assert.equal(geometry.clipped, false, `${label}: Squiggle ist am Container abgeschnitten`);
  assert.equal(geometry.opacity >= 0.45, true, `${label}: Squiggle ist wieder nahezu unsichtbar`);
  assert.equal(geometry.pathStrokeWidth >= 3, true, `${label}: Squiggle ist zu dünn`);
}

async function statePage(state, viewport = { width: 412, height: 915 }, contextOptions = {}) {
  const context = await browser.newContext({ viewport, locale: 'de-DE', serviceWorkers: 'block', ...contextOptions });
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
    await assertGoogleSansFlex(test.page, state);
    if (state === 'signed-out') {
      const primaryAction = test.page.locator('.primary-action');
      const before = await primaryAction.evaluate((element) => getComputedStyle(element).backgroundColor);
      await test.page.evaluate(() => document.documentElement.style.setProperty('--color-system-accent-source', 'rgb(188, 38, 164)'));
      const after = await primaryAction.evaluate((element) => getComputedStyle(element).backgroundColor);
      assert.notEqual(after, before, 'Injizierter Akzent änderte die primäre Aktion nicht');
      await test.page.evaluate(() => document.documentElement.style.removeProperty('--color-system-accent-source'));
    }
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
  await openSettings(logout.page);
  await logout.page.getByRole('button', { name: 'Abmelden' }).click();
  await logout.page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();
  assert.deepEqual(logout.errors, [], logout.errors.join('\n'));
  await logout.context.close();

  const appearance = await statePage('connected');
  await appearance.page.goto(baseUrl, { waitUntil: 'networkidle' });
  await appearance.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  const initialTheme = await themeSnapshot(appearance.page);
  const settings = await openSettings(appearance.page);
  const settingsSurface = appearance.page.locator('.settings-surface');
  assert.equal(await settings.getAttribute('aria-modal'), 'true');
  assert.equal(await appearance.page.getByLabel('Einstellungen schließen').evaluate((element) => element === document.activeElement), true, 'Einstellungsdialog setzt keinen sinnvollen Anfangsfokus');
  await assertModalWithinViewport(appearance.page, '.settings-surface', 'Einstellungen 412×915');
  await appearance.page.screenshot({ path: '/tmp/finance-appearance-settings-412x915.png' });

  let colors = await openColors(appearance.page);
  assert.equal(await colors.getAttribute('aria-modal'), 'true');
  assert.equal(await colors.getByRole('button', { name: 'Anwenden', exact: true }).isDisabled(), true, 'Anwenden ist ohne Draft-Änderung aktiv');
  assert.equal(await appearance.page.evaluate(() => document.body.style.overflow), 'hidden', 'Modal verhindert Body-Scroll-Leak nicht');
  assert.equal(await settingsSurface.getAttribute('aria-hidden'), 'true', 'Einstellungen bleiben hinter dem Farbdialog für Assistive Technology sichtbar');
  assert.equal(await settingsSurface.getAttribute('inert'), '', 'Einstellungen bleiben hinter dem Farbdialog bedienbar');
  assert.equal(await appearance.page.locator('.app-shell').getAttribute('inert'), '', 'App-Hintergrund bleibt während des Modals bedienbar');
  assert.equal(await appearance.page.getByLabel('Farben schließen').evaluate((element) => element === document.activeElement), true, 'Farbdialog setzt keinen Anfangsfokus');
  await appearance.page.keyboard.press('Shift+Tab');
  assert.equal(await colors.evaluate((element) => element.contains(document.activeElement)), true, 'Fokus verlässt den Farbdialog');
  await assertModalWithinViewport(appearance.page, '.color-theme-dialog', 'Farben 412×915');
  const systemCopy = await colors.innerText();
  assert.match(systemCopy, /Verwendet den vom Browser bereitgestellten Akzent, falls verfügbar\. Andernfalls nutzt die App ihr Standardtheme\./);
  assert.doesNotMatch(systemCopy, /Wallpaper erkannt|Android-Systemfarbe erkannt|Mit deinem aktuellen Hintergrund synchronisiert/i);
  await colors.locator('.color-theme-dialog__scroll').evaluate((element) => { element.scrollTop = 0; });
  await appearance.page.screenshot({ path: '/tmp/finance-appearance-system-412x915.png' });

  const sourceControl = colors.locator('.appearance-source-picker');
  await sourceControl.getByRole('radio', { name: 'Farben', exact: true }).check();
  await colors.getByRole('radio', { name: 'Violett', exact: true }).check();
  const draftPrimary = await colors.evaluate((element) => getComputedStyle(element).getPropertyValue('--color-primary').trim());
  assert.notEqual(draftPrimary, initialTheme.primary, 'Preset ändert die Draft-Vorschau nicht');
  assert.deepEqual(await themeSnapshot(appearance.page), initialTheme, 'Draft-Preset verändert das aktive Theme vor Anwenden');
  await appearance.page.keyboard.press('Escape');
  await colors.waitFor({ state: 'detached' });
  assert.deepEqual(await themeSnapshot(appearance.page), initialTheme, 'Abbrechen verändert das aktive Theme');
  await appearance.page.waitForFunction(() => document.activeElement?.classList.contains('appearance-settings-action'));
  assert.equal(await appearance.page.getByRole('button', { name: /Farben & Design/ }).evaluate((element) => element === document.activeElement), true, 'Fokus kehrt nach Abbrechen nicht zur Farben-Aktion zurück');

  colors = await openColors(appearance.page);
  await colors.locator('.appearance-source-picker').getByRole('radio', { name: 'Farben', exact: true }).check();
  await colors.getByRole('radio', { name: 'Violett', exact: true }).check();
  await colors.getByRole('button', { name: 'Anwenden', exact: true }).click();
  await colors.waitFor({ state: 'detached' });
  const presetTheme = await themeSnapshot(appearance.page);
  assert.equal(presetTheme.source, 'preset');
  assert.notEqual(presetTheme.primary, initialTheme.primary, 'Angewendetes Preset ändert das aktive Theme nicht');
  for (const semantic of ['positive', 'attention', 'reserve', 'free']) assert.equal(presetTheme[semantic], initialTheme[semantic], `Preset verändert fachliche Farbe ${semantic}`);
  assert.equal(await appearance.page.locator('meta[data-appearance-theme-color]').getAttribute('content'), presetTheme.page, 'Aktives theme-color folgt der Page-Farbe nicht');

  await appearance.page.getByLabel('Einstellungen schließen').click();
  await settings.waitFor({ state: 'detached' });
  await appearance.page.reload({ waitUntil: 'networkidle' });
  await appearance.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  assert.deepEqual(await themeSnapshot(appearance.page), presetTheme, 'Preset bleibt nach Reload nicht erhalten');
  const storedPreset = await appearance.page.evaluate(() => localStorage.getItem('finance-appearance-v1'));
  assert.match(storedPreset, /"version":1/);
  assert.doesNotMatch(storedPreset, /blob:|data:image|filePath|originalImage/i);

  await openSettings(appearance.page);
  colors = await openColors(appearance.page);
  const modeControl = colors.locator('.appearance-control-group');
  await modeControl.getByRole('radio', { name: 'Dunkel', exact: true }).check();
  await colors.getByRole('button', { name: 'Anwenden', exact: true }).click();
  await colors.waitFor({ state: 'detached' });
  assert.equal((await themeSnapshot(appearance.page)).resolved, 'dark', 'Explizit dunkel überschreibt den OS-Modus nicht');
  colors = await openColors(appearance.page);
  await colors.locator('.appearance-control-group').getByRole('radio', { name: 'Hell', exact: true }).check();
  await colors.getByRole('button', { name: 'Anwenden', exact: true }).click();
  await colors.waitFor({ state: 'detached' });
  assert.equal((await themeSnapshot(appearance.page)).resolved, 'light', 'Explizit hell überschreibt den OS-Modus nicht');
  colors = await openColors(appearance.page);
  await colors.locator('.appearance-control-group').getByRole('radio', { name: 'System', exact: true }).check();
  await colors.getByRole('button', { name: 'Anwenden', exact: true }).click();
  await colors.waitFor({ state: 'detached' });
  await appearance.page.emulateMedia({ colorScheme: 'dark' });
  await appearance.page.waitForFunction(() => document.documentElement.dataset.themeResolved === 'dark');
  await appearance.page.emulateMedia({ colorScheme: 'light' });
  await appearance.page.waitForFunction(() => document.documentElement.dataset.themeResolved === 'light');

  colors = await openColors(appearance.page);
  await colors.locator('.appearance-source-picker').getByRole('radio', { name: 'Bild', exact: true }).check();
  await colors.locator('input[type="file"]').setInputFiles([]);
  assert.equal(await colors.getByRole('button', { name: 'Anwenden', exact: true }).isDisabled(), true, 'Abgebrochene Bildauswahl aktiviert Anwenden');
  assert.equal(await colors.locator('.appearance-error').count(), 0, 'Abgebrochene Bildauswahl erzeugt einen Fehler');
  await colors.locator('input[type="file"]').setInputFiles({
    name: 'material-you-fixture.png',
    mimeType: 'image/png',
    buffer: createAppearanceImageFixture(),
  });
  await colors.getByText(/Paletten wurden lokal erstellt/).waitFor({ timeout: 30_000 });
  const wallpaperPaletteCount = await colors.locator('.palette-swatches input[type="radio"]').count();
  assert.equal(wallpaperPaletteCount >= 5 && wallpaperPaletteCount <= 7, true, `Hintergrundbild erzeugte ${wallpaperPaletteCount} statt fünf bis sieben Paletten`);
  for (const name of ['Tonal Spot aus Hintergrundbild', 'Neutral aus Hintergrundbild', 'Vibrant aus Hintergrundbild', 'Expressiv aus Hintergrundbild', 'Monochrom aus Hintergrundbild']) {
    assert.equal(await colors.getByRole('radio', { name, exact: true }).count(), 1, `${name} fehlt`);
  }
  assert.equal(await colors.getByText('Farben aus diesem Bild').isVisible(), true, 'Bildquelle ist nicht klar von der App-Vorschau getrennt');
  await colors.getByRole('radio', { name: 'Vibrant aus Hintergrundbild', exact: true }).check();
  await colors.locator('.color-theme-dialog__scroll').evaluate((element) => { element.scrollTop = 0; });
  await appearance.page.waitForTimeout(260);
  await appearance.page.screenshot({ path: '/tmp/finance-appearance-wallpaper-412x915.png' });
  await colors.getByRole('button', { name: 'Anwenden', exact: true }).click();
  await colors.waitFor({ state: 'detached' });
  const wallpaperTheme = await themeSnapshot(appearance.page);
  assert.equal(wallpaperTheme.source, 'wallpaper');
  assert.equal(await appearancePreviewExists(appearance.page), true, 'Verkleinertes Wallpaper-Thumbnail wurde nicht in IndexedDB gespeichert');
  const localWallpaperData = await appearance.page.evaluate(async () => {
    const preference = localStorage.getItem('finance-appearance-v1') ?? '';
    const record = await new Promise((resolve, reject) => {
      const request = indexedDB.open('finance-appearance-v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const getRequest = database.transaction('assets', 'readonly').objectStore('assets').get('wallpaper-preview');
        getRequest.onsuccess = () => { resolve(getRequest.result); database.close(); };
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
    const bitmap = await createImageBitmap(record.blob);
    const dimensions = { height: bitmap.height, width: bitmap.width };
    bitmap.close();
    return { dimensions, preference, size: record.blob.size, type: record.blob.type };
  });
  assert.equal(localWallpaperData.size <= 250 * 1024, true, 'Thumbnail überschreitet ungefähr 250 KB');
  assert.equal(Math.max(localWallpaperData.dimensions.width, localWallpaperData.dimensions.height) <= 480, true, 'Thumbnail überschreitet 480 Pixel');
  assert.equal(localWallpaperData.type, 'image/webp');
  assert.doesNotMatch(localWallpaperData.preference, /data:image|blob:|material-you-fixture|filePath/i);

  await appearance.page.getByLabel('Einstellungen schließen').click();
  await appearance.page.reload({ waitUntil: 'networkidle' });
  await appearance.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  assert.deepEqual(await themeSnapshot(appearance.page), wallpaperTheme, 'Wallpaper-Theme bleibt nach Reload nicht erhalten');
  await openSettings(appearance.page);
  colors = await openColors(appearance.page);
  await colors.getByText('Farben aus diesem Bild').waitFor();
  assert.equal(await colors.locator('.palette-swatches input[type="radio"]').count() >= 5, true, 'Wallpaper-Paletten fehlen nach Reload');
  await colors.locator('.appearance-source-picker').getByRole('radio', { name: 'Farben', exact: true }).check();
  await colors.getByRole('radio', { name: 'Indigo', exact: true }).check();
  await colors.locator('.color-theme-dialog__scroll').evaluate((element) => { element.scrollTop = 0; });
  await appearance.page.waitForTimeout(260);
  await appearance.page.screenshot({ path: '/tmp/finance-appearance-preset-412x915.png' });
  await colors.getByRole('button', { name: 'Anwenden', exact: true }).click();
  await colors.waitFor({ state: 'detached' });
  assert.equal((await themeSnapshot(appearance.page)).source, 'preset');
  assert.equal(await appearancePreviewExists(appearance.page), false, 'Wechsel zum Preset entfernt das nicht mehr benötigte Thumbnail nicht');

  await appearance.page.keyboard.press('Escape');
  await appearance.page.getByRole('dialog', { name: 'Einstellungen' }).waitFor({ state: 'detached' });
  assert.equal(await appearance.page.evaluate(() => document.body.style.overflow), '', 'Body-Scroll bleibt nach Modalende gesperrt');
  await appearance.page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Einstellungen öffnen');
  assert.equal(await appearance.page.getByLabel('Einstellungen öffnen').evaluate((element) => element === document.activeElement), true, 'Fokus kehrt nach Einstellungen nicht zum Zahnrad zurück');
  const themeBeforeLogout = await themeSnapshot(appearance.page);
  await openSettings(appearance.page);
  await appearance.page.getByRole('button', { name: 'Abmelden' }).click();
  await appearance.page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();
  assert.deepEqual(await themeSnapshot(appearance.page), themeBeforeLogout, 'Abmelden entfernt die gerätebezogene Appearance-Präferenz');
  assert.match(await appearance.page.evaluate(() => localStorage.getItem('finance-appearance-v1') ?? ''), /"version":1/);
  await assertNoOverflow(appearance.page, 'Appearance-Flow 412×915');
  assert.deepEqual(appearance.errors, [], appearance.errors.join('\n'));
  await appearance.context.close();

  const tabSync = await statePage('connected');
  await tabSync.page.goto(baseUrl, { waitUntil: 'networkidle' });
  await tabSync.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  const peer = await tabSync.context.newPage();
  const peerErrors = collectErrors(peer);
  await installFinanceApiMocks(peer, 'connected');
  await installPickerMock(peer);
  await peer.goto(baseUrl, { waitUntil: 'networkidle' });
  await openSettings(peer);
  const peerColors = await openColors(peer);
  await peerColors.locator('.appearance-source-picker').getByRole('radio', { name: 'Farben', exact: true }).check();
  await peerColors.getByRole('radio', { name: 'Grün', exact: true }).check();
  await peerColors.getByRole('button', { name: 'Anwenden', exact: true }).click();
  await peerColors.waitFor({ state: 'detached' });
  await tabSync.page.waitForFunction(() => document.documentElement.dataset.colorSource === 'preset'
    && JSON.parse(localStorage.getItem('finance-appearance-v1')).palette.id === 'preset-green');
  assert.equal((await themeSnapshot(tabSync.page)).source, 'preset', 'Storage-Event aktualisiert einen zweiten Tab nicht');
  assert.deepEqual([...tabSync.errors, ...peerErrors], [], [...tabSync.errors, ...peerErrors].join('\n'));
  await tabSync.context.close();

  for (const viewport of [
    { width: 320, height: 720, name: '320x720' },
    { width: 412, height: 915, name: '412x915-dark-dialog' },
    { width: 1440, height: 1000, name: '1440x1000-dialog' },
  ]) {
    const visual = await statePage('connected', viewport);
    await visual.page.goto(baseUrl, { waitUntil: 'networkidle' });
    await visual.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
    const visualSettings = await openSettings(visual.page);
    await assertModalWithinViewport(visual.page, '.settings-surface', `Einstellungen ${viewport.name}`);
    if (viewport.width === 1440) await visual.page.screenshot({ path: '/tmp/finance-appearance-settings-desktop.png' });
    const visualColors = await openColors(visual.page);
    if (viewport.width === 412) {
      await visualColors.locator('.appearance-control-group').getByRole('radio', { name: 'Dunkel', exact: true }).check();
    }
    if (viewport.width === 1440) {
      await visualColors.locator('.appearance-source-picker').getByRole('radio', { name: 'Farben', exact: true }).check();
      await visualColors.getByRole('radio', { name: 'Koralle', exact: true }).check();
    }
    await visualColors.locator('.color-theme-dialog__scroll').evaluate((element) => { element.scrollTop = 0; });
    await visual.page.waitForTimeout(260);
    if (viewport.width === 412) {
      const selectedContrast = await visualColors.locator('.appearance-control-group .appearance-segmented__option[data-selected="true"]').evaluate((element) => {
        const channels = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
        const luminance = (value) => channels(value).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const style = getComputedStyle(element);
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
      assert.equal(selectedContrast >= 4.5, true, `Dark-Draft-Auswahl verfehlt WCAG AA: ${selectedContrast}`);
    }
    await assertModalWithinViewport(visual.page, '.color-theme-dialog', `Farben ${viewport.name}`);
    await assertAppearanceControlLayout(visualColors, `Farben ${viewport.name}`);
    await assertNoOverflow(visual.page, `Farben ${viewport.name}`);
    await assertTouchTargets(visual.page, `Farben ${viewport.name}`);
    await visual.page.screenshot({ path: `/tmp/finance-appearance-${viewport.name}.png` });
    await visual.page.keyboard.press('Escape');
    await visualColors.waitFor({ state: 'detached' });
    assert.equal(await visualSettings.isVisible(), true, 'Escape schließt mehr als den obersten Dialog');
    assert.deepEqual(visual.errors, [], visual.errors.join('\n'));
    await visual.context.close();
  }

  const mobile = await statePage('connected');
  await mobile.page.goto(baseUrl, { waitUntil: 'networkidle' });
  await mobile.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  await assertGoogleSansFlex(mobile.page, 'Mobile Übersicht');
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
  await assertRingCenterFits(mobile.page, '.overview-screen .circular-allocation', 'Übersichtsring 412px');
  await assertLayeredRing(mobile.page, '.overview-screen .circular-allocation', 'Übersichtsring');
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
  await statusTrigger.focus();
  await mobile.page.keyboard.press('Tab');
  await mobile.page.keyboard.press('Shift+Tab');

  const fallbackAccent = await accentSnapshot(mobile.page);
  await mobile.page.evaluate(() => {
    document.documentElement.style.setProperty('--color-system-accent-source', 'rgb(188, 38, 164)');
    document.documentElement.style.setProperty('--color-on-system-accent-source', 'rgb(255, 255, 255)');
  });
  await mobile.page.waitForTimeout(240);
  const injectedAccent = await accentSnapshot(mobile.page);
  assert.notEqual(injectedAccent.navigation, fallbackAccent.navigation, 'Injizierter Akzent änderte den Navigationsindikator nicht');
  assert.notEqual(injectedAccent.expense, fallbackAccent.expense, 'Injizierter Akzent änderte die ausgewählte Ringrolle nicht');
  assert.notEqual(injectedAccent.focus, fallbackAccent.focus, 'Injizierter Akzent änderte den Fokusrahmen nicht');
  assert.equal(injectedAccent.reserve, fallbackAccent.reserve, 'Systemakzent veränderte die semantische Rücklagenfarbe');
  assert.equal(injectedAccent.free, fallbackAccent.free, 'Systemakzent veränderte die semantische Frei-Farbe');
  await mobile.page.evaluate(() => {
    document.documentElement.style.removeProperty('--color-system-accent-source');
    document.documentElement.style.removeProperty('--color-on-system-accent-source');
  });
  await mobile.page.waitForTimeout(240);
  assert.equal((await accentSnapshot(mobile.page)).navigation, fallbackAccent.navigation, 'Akzent-Fallback wurde nach dem Test nicht wiederhergestellt');

  await assertDecorativeSquiggle(mobile.page, '.forecast-callout__squiggle', 'Spielraum-Callout');
  const forecastRadii = await mobile.page.locator('.forecast-callout').evaluate((element) => {
    const style = getComputedStyle(element);
    return { bottomLeft: Number.parseFloat(style.borderBottomLeftRadius), topLeft: Number.parseFloat(style.borderTopLeftRadius) };
  });
  assert.equal(forecastRadii.topLeft > forecastRadii.bottomLeft, true, `Spielraum-Callout hat keine absichtsvolle Kontextform: ${JSON.stringify(forecastRadii)}`);

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
  await assertGoogleSansFlex(mobile.page, 'Budget');
  await assertRingCenterFits(mobile.page, '.budget-screen .circular-allocation', 'Budgetring 412px');
  await assertLayeredRing(mobile.page, '.budget-screen .circular-allocation', 'Budgetring');
  const budgetAccentBefore = await mobile.page.evaluate(() => ({
    essential: getComputedStyle(document.querySelector('.budget-screen [data-allocation-id="essential"]')).stroke,
    free: getComputedStyle(document.querySelector('.budget-screen [data-allocation-id="free"]')).stroke,
    segmented: getComputedStyle(document.querySelector('.segmented-control__indicator-slot')).backgroundColor,
  }));
  await mobile.page.evaluate(() => document.documentElement.style.setProperty('--color-system-accent-source', 'rgb(188, 38, 164)'));
  await mobile.page.waitForTimeout(240);
  const budgetAccentAfter = await mobile.page.evaluate(() => ({
    essential: getComputedStyle(document.querySelector('.budget-screen [data-allocation-id="essential"]')).stroke,
    free: getComputedStyle(document.querySelector('.budget-screen [data-allocation-id="free"]')).stroke,
    segmented: getComputedStyle(document.querySelector('.segmented-control__indicator-slot')).backgroundColor,
  }));
  assert.notEqual(budgetAccentAfter.segmented, budgetAccentBefore.segmented, 'Injizierter Akzent änderte die segmentierte Auswahl nicht');
  assert.equal(budgetAccentAfter.essential, budgetAccentBefore.essential, 'Systemakzent veränderte eine Budget-Kategoriefarbe');
  assert.equal(budgetAccentAfter.free, budgetAccentBefore.free, 'Systemakzent veränderte die Frei-Farbe im Budgetring');
  await mobile.page.evaluate(() => document.documentElement.style.removeProperty('--color-system-accent-source'));
  await mobile.page.waitForTimeout(240);
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
  await assertGoogleSansFlex(mobile.page, 'Schulden');
  await assertConcentric(mobile.page, '.creditor-list', '.creditor-list .creditor-row', 'Gläubigerliste');
  await assertChartsHaveLayout(mobile.page, 'Schulden');
  const debtAction = mobile.page.locator('.debt-progress .extended-action');
  await debtAction.click();
  assert.match(await mobile.page.locator('.debt-progress').innerText(), /September 2033[\s\S]*0,00\s*€/);
  await assertConcentric(mobile.page, '.debt-progress', '.debt-milestones', 'Schuldenverlauf');
  await assertConcentric(mobile.page, '.milestone-flow', '.milestone-flow .milestone-row', 'Entlastungsstufen');
  await assertDecorativeSquiggle(mobile.page, '.milestone-flow__squiggle', 'Vertikaler Schuldenweg');
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

  await openSettings(mobile.page);
  const dialog = mobile.page.getByRole('dialog', { name: 'Einstellungen' });
  await dialog.waitFor();
  assert.equal(await mobile.page.getByLabel('Einstellungen schließen').evaluate((element) => element === document.activeElement), true);
  await mobile.page.keyboard.press('Shift+Tab');
  assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true, 'Fokus verlässt den Dialog');
  await mobile.page.getByRole('button', { name: /Google-Verbindung trennen/ }).click();
  await mobile.page.getByText('Google-Verbindung trennen?').waitFor();
  await mobile.page.getByRole('button', { name: 'Abbrechen' }).click();
  await mobile.page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await openSettings(mobile.page);
  const disconnectColors = await openColors(mobile.page);
  await disconnectColors.locator('.appearance-source-picker').getByRole('radio', { name: 'Farben', exact: true }).check();
  await disconnectColors.getByRole('radio', { name: 'Blau', exact: true }).check();
  await disconnectColors.getByRole('button', { name: 'Anwenden', exact: true }).click();
  await disconnectColors.waitFor({ state: 'detached' });
  const themeBeforeDisconnect = await themeSnapshot(mobile.page);
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
  assert.deepEqual(await themeSnapshot(mobile.page), themeBeforeDisconnect, 'Disconnect entfernt die gerätebezogene Appearance-Präferenz');
  assert.match(await mobile.page.evaluate(() => localStorage.getItem('finance-appearance-v1') ?? ''), /"version":1/);
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
    await test.page.waitForTimeout(360);
    await assertGoogleSansFlex(test.page, `Light ${viewport.name}`);
    await assertRingCenterFits(test.page, '.overview-screen .circular-allocation', `Übersichtsring ${viewport.name}`);
    await assertNoOverflow(test.page, `Light Übersicht ${viewport.name}`);
    assert.equal(await test.page.locator('.bottom-navigation').isVisible(), true);
    await test.page.screenshot({ path: `/tmp/finance-${viewport.name}.png`, fullPage: true });
    await test.page.screenshot({ path: `/tmp/finance-light-${viewport.name}-overview.png`, fullPage: true });
    if (viewport.width === 1440) {
      const appBounds = await bounds(test.page.locator('.app-content'));
      assert.equal(appBounds.width <= 840, true);
      assert.equal(Math.abs(appBounds.left - (1440 - appBounds.width) / 2) < 2, true);
    }
    await test.page.getByRole('button', { name: 'Budget', exact: true }).click();
    await test.page.getByRole('heading', { name: 'Dein Budget' }).waitFor();
    await test.page.waitForTimeout(360);
    await assertRingCenterFits(test.page, '.budget-screen .circular-allocation', `Budgetring ${viewport.name}`);
    await assertNoOverflow(test.page, `Light Budget ${viewport.name}`);
    await test.page.screenshot({ path: `/tmp/finance-light-${viewport.name}-budget.png`, fullPage: true });
    await test.page.getByRole('button', { name: 'Schulden', exact: true }).click();
    await test.page.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
    await test.page.locator('.debt-progress .extended-action').click();
    await test.page.waitForTimeout(560);
    await assertNoOverflow(test.page, `Light Schulden ${viewport.name}`);
    await assertChartsHaveLayout(test.page, `Light Schulden ${viewport.name}`);
    await test.page.screenshot({ path: `/tmp/finance-light-${viewport.name}-debt.png`, fullPage: true });
    assert.deepEqual(test.errors, [], test.errors.join('\n'));
    await test.context.close();
  }

  for (const viewport of [
    { width: 360, height: 800, name: '360x800' },
    { width: 412, height: 915, name: '412x915' },
    { width: 768, height: 1024, name: '768x1024' },
    { width: 1440, height: 1000, name: '1440x1000' },
  ]) {
    const dark = await statePage('connected', viewport, { colorScheme: 'dark' });
    await dark.page.goto(baseUrl, { waitUntil: 'networkidle' });
    await dark.page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
    await dark.page.waitForTimeout(360);
    const resolvedDarkTheme = await themeSnapshot(dark.page);
    assert.equal(resolvedDarkTheme.resolved, 'dark');
    assert.match(resolvedDarkTheme.page, /^#[\dA-F]{6}$/i);
    await assertGoogleSansFlex(dark.page, `Dark ${viewport.name}`);
    await assertRingCenterFits(dark.page, '.overview-screen .circular-allocation', `Dark Übersichtsring ${viewport.name}`);
    await assertNoOverflow(dark.page, `Dark Übersicht ${viewport.name}`);
    await assertConcentric(dark.page, '.status-card', '.allocation-metric', `Dark-Mode-Hero ${viewport.name}`);
    await dark.page.screenshot({ path: `/tmp/finance-dark-${viewport.name}-overview.png`, fullPage: true });
    if (viewport.width === 412) {
      await dark.page.screenshot({ path: '/tmp/finance-connected-dark.png', fullPage: true });
      await dark.page.locator('.overview-screen .circular-allocation__button').click();
      await dark.page.screenshot({ path: '/tmp/finance-dark-412x915-overview-detailed.png', fullPage: true });
    }
    await dark.page.getByRole('button', { name: 'Budget', exact: true }).click();
    await dark.page.getByRole('heading', { name: 'Dein Budget' }).waitFor();
    await dark.page.waitForTimeout(360);
    await assertRingCenterFits(dark.page, '.budget-screen .circular-allocation', `Dark Budgetring ${viewport.name}`);
    await assertNoOverflow(dark.page, `Dark Budget ${viewport.name}`);
    await dark.page.screenshot({ path: `/tmp/finance-dark-${viewport.name}-budget.png`, fullPage: true });
    await dark.page.getByRole('button', { name: 'Schulden', exact: true }).click();
    await dark.page.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
    await dark.page.locator('.debt-progress .extended-action').click();
    await dark.page.waitForTimeout(560);
    await assertNoOverflow(dark.page, `Dark Schulden ${viewport.name}`);
    await assertChartsHaveLayout(dark.page, `Dark Schulden ${viewport.name}`);
    await dark.page.screenshot({ path: `/tmp/finance-dark-${viewport.name}-debt.png`, fullPage: true });
    assert.deepEqual(dark.errors, [], dark.errors.join('\n'));
    await dark.context.close();
  }

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
  await reduced.screenshot({ path: '/tmp/finance-reduced-motion.png', fullPage: true });
  assert.deepEqual(reducedErrors, [], reducedErrors.join('\n'));
  await reducedContext.close();

  console.log('Browser-Smoke-Test bestanden: Auth-/Setup-/Picker-/Fehlerzustände, Finanzscreens, responsive Größen, Dark Mode, Fokus, Touch-Ziele und reduzierte Bewegung funktionieren mit gemockten Google-Endpunkten.');
} finally {
  await browser.close();
}
