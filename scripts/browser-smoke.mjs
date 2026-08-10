import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installFinanceApiMocks, installPickerMock } from './fixtures/anonymous-finance-data.mjs';
import { createAppearanceImageFixture } from './fixtures/appearance-image.mjs';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173';
const overviewHeading = /^(?:Guten Morgen|Guten Tag|Guten Abend|Gute Nacht)$/;
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

async function financeRoleGeometry(page, screenSelector) {
  return page.evaluate((selector) => {
    const styleSnapshot = (element, properties) => {
      const style = getComputedStyle(element);
      return Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]));
    };
    const screen = document.querySelector(selector);
    const hero = screen.querySelector('.financial-hero');
    const heroValue = screen.querySelector('.financial-hero__value');
    const metric = screen.querySelector('.metric-card');
    const metricValue = screen.querySelector('.metric-card__value');
    return {
      hero: styleSnapshot(hero, ['border-radius', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left']),
      heroValue: styleSnapshot(heroValue, ['font-size', 'font-weight', 'font-variation-settings', 'line-height', 'white-space']),
      metric: styleSnapshot(metric, ['border-radius', 'min-height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left']),
      metricValue: styleSnapshot(metricValue, ['font-size', 'font-weight', 'font-variation-settings', 'line-height', 'white-space']),
    };
  }, screenSelector);
}

function assertSharedFinanceRoles(reference, actual, label) {
  assert.deepEqual(actual.hero, reference.hero, `${label}: Hero-Geometrie weicht ab`);
  assert.deepEqual(actual.heroValue, reference.heroValue, `${label}: Hero-Zahlenrolle weicht ab`);
  assert.deepEqual(actual.metric, reference.metric, `${label}: Metric-Card-Geometrie weicht ab`);
  assert.deepEqual(actual.metricValue, reference.metricValue, `${label}: Metric-Zahlenrolle weicht ab`);
}

async function assertAdaptiveNavigation(page, viewportWidth, label) {
  assert.equal(await page.getByRole('navigation').count(), 1, `${label}: Es gibt nicht genau ein Navigation-Landmark`);
  const geometry = await page.locator('.adaptive-navigation').evaluate((navigation) => {
    const rect = navigation.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      position: getComputedStyle(navigation).position,
      right: rect.right,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      width: rect.width,
    };
  });
  if (viewportWidth < 840) {
    assert.equal(geometry.position, 'fixed', `${label}: Compact/Medium verwendet keine Bottom Navigation`);
    assert.equal(approximately(geometry.bottom, geometry.viewportHeight, 1), true, `${label}: Bottom Navigation sitzt nicht am Viewportende`);
    assert.equal(geometry.width >= geometry.viewportWidth - 1, true, `${label}: Bottom Navigation nutzt nicht die verfügbare Breite`);
  } else {
    assert.equal(geometry.position, 'sticky', `${label}: Expanded verwendet keine Navigation Rail`);
    assert.equal(approximately(geometry.width, 96, 1), true, `${label}: Navigation Rail ist nicht 96px breit`);
    assert.equal(geometry.height >= geometry.viewportHeight - 1, true, `${label}: Navigation Rail füllt den App-Canvas nicht`);
  }
}

async function assertLastContentNotObscured(page, screenSelector, label) {
  const last = page.locator(`${screenSelector} > :last-child`);
  await last.evaluate((element) => element.scrollIntoView({ block: 'end', behavior: 'instant' }));
  await page.waitForTimeout(50);
  const geometry = await last.evaluate((element) => {
    const content = element.getBoundingClientRect();
    const navigation = document.querySelector('.adaptive-navigation').getBoundingClientRect();
    const navigationPosition = getComputedStyle(document.querySelector('.adaptive-navigation')).position;
    const overlaps = content.left < navigation.right && content.right > navigation.left && content.top < navigation.bottom && content.bottom > navigation.top;
    return { contentBottom: content.bottom, navigationPosition, navigationTop: navigation.top, overlaps };
  });
  if (geometry.navigationPosition === 'fixed') {
    assert.equal(geometry.contentBottom <= geometry.navigationTop + 1, true, `${label}: letzter Inhalt liegt hinter der Bottom Navigation: ${JSON.stringify(geometry)}`);
  } else {
    assert.equal(geometry.overlaps, false, `${label}: letzter Inhalt liegt hinter der Navigation Rail: ${JSON.stringify(geometry)}`);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}

async function assertNoVisibleTextBelow12px(page, screenSelector, label) {
  const offenders = await page.locator(screenSelector).evaluate((screen) => {
    const walker = document.createTreeWalker(screen, NodeFilter.SHOW_TEXT);
    const found = [];
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      const element = walker.currentNode.parentElement;
      if (!text || !element || element.closest('.sr-only, [aria-hidden="true"]')) continue;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const size = Number.parseFloat(style.fontSize);
      if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && size < 11.95) {
        found.push({ className: element.className?.baseVal ?? element.className, size, tag: element.tagName, text: text.slice(0, 80) });
      }
    }
    return found;
  });
  assert.deepEqual(offenders, [], `${label}: sichtbarer Text unter 12px: ${JSON.stringify(offenders)}`);
}

async function assertReliefScaleContainsData(page) {
  const scale = await page.locator('.relief-chart').evaluate((chart) => ({
    domainMax: Number(chart.getAttribute('data-domain-max')),
    domainMin: Number(chart.getAttribute('data-domain-min')),
    valueMax: Number(chart.getAttribute('data-value-max')),
    valueMin: Number(chart.getAttribute('data-value-min')),
  }));
  assert.equal(scale.domainMin <= scale.valueMin, true, `Relief-Domain schneidet das Minimum ab: ${JSON.stringify(scale)}`);
  assert.equal(scale.domainMax >= scale.valueMax, true, `Relief-Domain schneidet das Maximum ab: ${JSON.stringify(scale)}`);
  assert.equal(scale.domainMax > 400, true, `Relief-Domain verwendet offenbar noch den festen [100, 400]-Bereich: ${JSON.stringify(scale)}`);
}

async function assertGoogleSansFlex(page, label) {
  await page.waitForFunction(() => document.fonts.check('16px "Google Sans Flex Variable"'));
  const typography = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const previousFontElements = [...document.querySelectorAll('body *')].filter((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 && /Roboto Flex/i.test(getComputedStyle(element).fontFamily);
    });
    const nonRoundedText = [...document.querySelectorAll('body *')].filter((element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const hasDirectText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      return hasDirectText
        && bounds.width > 0
        && bounds.height > 0
        && /Google Sans Flex Variable/i.test(style.fontFamily)
        && !/"ROND" 100/.test(style.fontVariationSettings);
    }).slice(0, 12).map((element) => ({
      className: element.getAttribute('class'),
      tag: element.tagName,
      text: element.textContent?.trim().slice(0, 60),
      variation: getComputedStyle(element).fontVariationSettings,
    }));
    return {
      family: rootStyle.fontFamily,
      nonRoundedText,
      opticalSizing: rootStyle.fontOpticalSizing,
      previousFontCount: previousFontElements.length,
      variation: rootStyle.fontVariationSettings,
    };
  });
  assert.match(typography.family, /Google Sans Flex Variable/, `${label}: falsche Schriftfamilie`);
  assert.equal(typography.opticalSizing, 'auto', `${label}: optische Größenachse ist nicht automatisch`);
  assert.match(typography.variation, /"ROND" 100/, `${label}: Google Sans Flex verwendet nicht durchgehend die volle Rundungsachse: ${typography.variation}`);
  assert.match(typography.variation, /"wdth" 100/, `${label}: normale Breite fehlt: ${typography.variation}`);
  assert.equal(typography.previousFontCount, 0, `${label}: sichtbarer Text verwendet noch Roboto Flex`);
  assert.deepEqual(typography.nonRoundedText, [], `${label}: sichtbarer Text verwendet nicht ROND 100: ${JSON.stringify(typography.nonRoundedText)}`);
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
  assert.equal(Boolean(geometry.text?.trim()), true, `${label}: Ringzentrum ist leer`);
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
    arcs: [...ring.querySelectorAll('.circular-allocation__arc[data-allocation-id]')].map((arc) => ({
      cap: Number(arc.getAttribute('data-cap-extension')),
      dash: Number(arc.getAttribute('data-dash-length')),
      dasharray: arc.getAttribute('stroke-dasharray'),
      order: Number(arc.getAttribute('data-draw-order')),
      overlapAfter: Number(arc.getAttribute('data-overlap-after')),
      overlapBefore: Number(arc.getAttribute('data-overlap-before')),
      tiny: arc.getAttribute('data-tiny') === 'true',
      visible: Number(arc.getAttribute('data-visible-span')),
      id: arc.getAttribute('data-allocation-id'),
    })),
    endCaps: [...ring.querySelectorAll('[data-allocation-end-cap]')].map((cap) => ({
      id: cap.getAttribute('data-allocation-end-cap'),
      overlays: cap.getAttribute('data-overlays-allocation-id'),
      shape: cap.getAttribute('data-overlay-shape'),
    })),
    markup: ring.innerHTML,
    mode: ring.getAttribute('data-geometry'),
  }));
  assert.equal(geometry.mode, 'directed-end-cap-overlap', `${label}: falscher Geometriemodus`);
  assert.equal(/NaN|Infinity|undefined/.test(geometry.markup), false, `${label}: ungültiges SVG-Attribut`);
  assert.deepEqual(geometry.arcs.map(({ order }) => order), geometry.arcs.map((_, index) => index), `${label}: Zeichenreihenfolge ist instabil`);
  assert.equal(geometry.arcs.every(({ cap, dash, visible }) => Number.isFinite(cap) && Number.isFinite(dash) && Number.isFinite(visible) && dash >= 0 && visible > 0 && visible <= 100), true, `${label}: ungültige Bogenlänge`);
  assert.equal(geometry.arcs.every(({ cap, dash, visible }) => approximately(dash + cap * 2, visible, 0.02)), true, `${label}: Rundkappen wurden nicht aus der sichtbaren Länge korrigiert`);
  assert.equal(geometry.arcs.every(({ overlapAfter, overlapBefore }) => overlapAfter > 0 && overlapBefore > 0), true, `${label}: Layer-Überlappung fehlt`);
  assert.equal(geometry.arcs.every(({ dasharray }) => dasharray && !dasharray.includes('-')), true, `${label}: ungültiges stroke-dasharray`);
  assert.deepEqual(geometry.endCaps, geometry.arcs.length > 1 ? geometry.arcs.map(({ id }, index, arcs) => ({
    id,
    overlays: arcs[(index + 1) % arcs.length].id,
    shape: 'full-circle',
  })) : [], `${label}: Endkappen liegen nicht gerichtet über dem Folgesegment`);
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
  const dialog = page.getByRole('dialog', { name: 'Informationen' });
  await dialog.waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Informationen schließen');
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
    await assertNoVisibleTextBelow12px(test.page, '.connection-state', state);
    if (state === 'signed-out') {
      const primaryAction = test.page.locator('.connection-state .app-button--filled');
      const before = await primaryAction.evaluate((element) => getComputedStyle(element).backgroundColor);
      await test.page.evaluate(() => document.documentElement.style.setProperty('--color-system-accent-source', 'rgb(188, 38, 164)'));
      await test.page.waitForTimeout(160);
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
  await loading.page.getByRole('heading', { name: overviewHeading }).waitFor();
  assert.deepEqual(loading.errors, [], loading.errors.join('\n'));
  await loading.context.close();

  const picker = await statePage('no-spreadsheet');
  await picker.page.goto(baseUrl, { waitUntil: 'networkidle' });
  await picker.page.getByRole('button', { name: 'Google-Tabelle auswählen' }).click();
  await picker.page.getByRole('heading', { name: overviewHeading }).waitFor();
  assert.match(await picker.page.locator('body').innerText(), /Frei verfügbar/);
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
  await appearance.page.getByRole('heading', { name: overviewHeading }).waitFor();
  const initialTheme = await themeSnapshot(appearance.page);
  const settings = await openSettings(appearance.page);
  const settingsSurface = appearance.page.locator('.settings-surface');
  await assertGoogleSansFlex(appearance.page, 'Informationsdialog');
  assert.equal(await settings.getAttribute('aria-modal'), 'true');
  assert.equal(await appearance.page.getByLabel('Informationen schließen').evaluate((element) => element === document.activeElement), true, 'Informationsdialog setzt keinen sinnvollen Anfangsfokus');
  await assertModalWithinViewport(appearance.page, '.settings-surface', 'Einstellungen 412×915');
  await appearance.page.screenshot({ path: '/tmp/finance-appearance-settings-412x915.png' });

  let colors = await openColors(appearance.page);
  await assertGoogleSansFlex(appearance.page, 'Farbdialog');
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
  const draftPrimary = await colors.locator('.color-theme-dialog').evaluate((element) => getComputedStyle(element).getPropertyValue('--color-primary').trim());
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

  await appearance.page.getByLabel('Informationen schließen').click();
  await settings.waitFor({ state: 'detached' });
  await appearance.page.reload({ waitUntil: 'networkidle' });
  await appearance.page.getByRole('heading', { name: overviewHeading }).waitFor();
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
  for (const name of ['Tonal Spot', 'Neutral', 'Vibrant', 'Expressiv', 'Monochrom']) {
    assert.equal(await colors.getByRole('radio', { name, exact: true }).count(), 1, `${name} fehlt`);
  }
  assert.equal(await colors.getByText('Farben aus diesem Bild').isVisible(), true, 'Bildquelle ist nicht klar von der App-Vorschau getrennt');
  await colors.getByRole('radio', { name: 'Vibrant', exact: true }).check();
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

  await appearance.page.getByLabel('Informationen schließen').click();
  await appearance.page.reload({ waitUntil: 'networkidle' });
  await appearance.page.getByRole('heading', { name: overviewHeading }).waitFor();
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
  await appearance.page.getByRole('dialog', { name: 'Informationen' }).waitFor({ state: 'detached' });
  assert.equal(await appearance.page.evaluate(() => document.body.style.overflow), '', 'Body-Scroll bleibt nach Modalende gesperrt');
  await appearance.page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Einstellungen öffnen');
  assert.equal(await appearance.page.getByLabel('Einstellungen öffnen').evaluate((element) => element === document.activeElement), true, 'Fokus kehrt nach Informationen nicht zum Auslöser zurück');
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
  await tabSync.page.getByRole('heading', { name: overviewHeading }).waitFor();
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
    await visual.page.getByRole('heading', { name: overviewHeading }).waitFor();
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
  await mobile.page.getByRole('heading', { name: overviewHeading }).waitFor();
  await assertGoogleSansFlex(mobile.page, 'Mobile Übersicht');
  const overviewScreen = mobile.page.locator('[data-destination="overview"]');
  const overviewRoleGeometry = await financeRoleGeometry(mobile.page, '.overview-screen');
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
  const statusBoundsBeforeToggle = await bounds(mobile.page.locator('.overview-screen .financial-hero'));
  const followingBoundsBeforeToggle = await bounds(mobile.page.locator('.overview-screen .metric-grid'));
  await overviewRing.locator('svg').evaluate((element) => { element.dataset.persistenceProbe = 'same-svg'; });
  await statusTrigger.click();
  assert.equal(await statusTrigger.getAttribute('aria-pressed'), 'true');
  assert.equal(await overviewRing.getAttribute('data-detailed'), 'true');
  assert.equal(await overviewRing.locator('svg').getAttribute('data-persistence-probe'), 'same-svg');
  assert.deepEqual(await bounds(mobile.page.locator('.overview-screen .financial-hero')), statusBoundsBeforeToggle);
  assert.deepEqual(await bounds(mobile.page.locator('.overview-screen .metric-grid')), followingBoundsBeforeToggle);
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

  const forecastRadii = await mobile.page.locator('.next-relief-notice').evaluate((element) => {
    const style = getComputedStyle(element);
    return { bottomLeft: Number.parseFloat(style.borderBottomLeftRadius), topLeft: Number.parseFloat(style.borderTopLeftRadius) };
  });
  assert.equal(forecastRadii.topLeft, forecastRadii.bottomLeft, `Spielraum-Callout hat ungleiche Ecken: ${JSON.stringify(forecastRadii)}`);

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
  await assertNoVisibleTextBelow12px(mobile.page, '.overview-screen', 'Mobile Übersicht');
  await assertAdaptiveNavigation(mobile.page, 412, 'Mobile Übersicht');

  await assertConcentric(mobile.page, '.overview-screen .financial-hero', '.overview-screen .allocation-legend__item', 'Übersichts-Hero');
  await assertConcentric(mobile.page, '.overview-screen .metric-grid', '.overview-screen .metric-card', 'Paarmetriken');
  await assertConcentric(mobile.page, '.overview-screen .data-list', '.overview-screen .data-list__item', 'Kontenliste');
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

  const pocketAction = mobile.page.locator('.pocket-collection .app-button');
  await pocketAction.click();
  assert.match(await mobile.page.locator('.pocket-collection').innerText(), /Technik/);
  await assertConcentric(mobile.page, '.pocket-collection', '.pocket-collection .pocket', 'Pockets ausgeklappt');

  await mobile.page.getByRole('button', { name: 'Demnächst', exact: true }).click();
  await mobile.page.getByRole('heading', { name: 'Demnächst' }).waitFor();
  assertSharedFinanceRoles(overviewRoleGeometry, await financeRoleGeometry(mobile.page, '.upcoming-screen'), 'Demnächst');
  assert.equal(await mobile.page.locator('[data-destination="upcoming"]').getAttribute('data-entrance'), 'first');
  assert.match(await mobile.page.locator('.upcoming-screen').innerText(), /Bis Gehalt verfügbar/);
  assert.match(await mobile.page.locator('.upcoming-screen').innerText(), /5 Tage vor Gehalt/);
  await assertNoOverflow(mobile.page, 'Mobile Demnächst');
  await assertNoVisibleTextBelow12px(mobile.page, '.upcoming-screen', 'Mobile Demnächst');

  await mobile.page.getByRole('button', { name: 'Budget', exact: true }).click();
  const navigationSamples = await navigationTransitionSamples(mobile.page);
  navigationSamples.forEach((sample, index) => assertStableNavigationGeometry(overviewNavigationGeometry, sample, `Indikatorframe ${index}`));
  await mobile.page.getByRole('heading', { name: 'Dein Budget' }).waitFor();
  assertSharedFinanceRoles(overviewRoleGeometry, await financeRoleGeometry(mobile.page, '.budget-screen'), 'Budget');
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
  await assertConcentric(mobile.page, '.budget-screen .financial-hero', '.budget-screen .allocation-legend__item', 'Budget-Einkommen');
  await mobile.page.locator('.budget-chart .recharts-bar-rectangle').first().waitFor();
  assert.equal(await mobile.page.locator('.budget-chart .recharts-bar-rectangle').count(), 10);
  await assertChartsHaveLayout(mobile.page, 'Budget');
  await mobile.page.waitForFunction(() => document.querySelector('.budget-chart')?.getAttribute('data-animation-active') === 'false');
  await mobile.page.getByLabel('Finanzdaten aktualisieren').click();
  await mobile.page.locator('.sync-status[data-finance-state="syncing"]').waitFor();
  await mobile.page.locator('.sync-status[data-finance-state="idle"]').waitFor();
  assert.equal(await mobile.page.locator('.budget-chart').getAttribute('data-animation-active'), 'false', 'Datenaktualisierung animiert das Budgetdiagramm erneut');
  const categoryTab = mobile.page.getByRole('tab', { name: 'Kategorien' });
  const necessityTab = mobile.page.getByRole('tab', { name: 'Notwendigkeit' });
  assert.equal(await categoryTab.getAttribute('aria-controls'), 'budget-chart-categories');
  assert.equal(await necessityTab.getAttribute('aria-controls'), 'budget-chart-necessity');
  assert.equal(await categoryTab.getAttribute('tabindex'), '0');
  assert.equal(await necessityTab.getAttribute('tabindex'), '-1');
  await categoryTab.focus();
  await mobile.page.keyboard.press('ArrowRight');
  await mobile.page.waitForFunction(() => document.querySelector('.budget-chart')?.getAttribute('data-animation-active') === 'true');
  assert.equal(await necessityTab.getAttribute('aria-selected'), 'true');
  assert.equal(await necessityTab.evaluate((element) => element === document.activeElement), true);
  assert.equal(await mobile.page.locator('.budget-chart .recharts-bar-rectangle').count(), 5);
  await mobile.page.keyboard.press('Home');
  assert.equal(await categoryTab.getAttribute('aria-selected'), 'true');
  await mobile.page.keyboard.press('End');
  assert.equal(await necessityTab.getAttribute('aria-selected'), 'true');
  await mobile.page.keyboard.press('ArrowLeft');
  assert.equal(await categoryTab.getAttribute('aria-selected'), 'true');
  await mobile.page.keyboard.press('ArrowDown');
  assert.equal(await necessityTab.getAttribute('aria-selected'), 'true');
  await mobile.page.keyboard.press('ArrowUp');
  assert.equal(await categoryTab.getAttribute('aria-selected'), 'true');
  await necessityTab.click();
  assert.equal(await mobile.page.locator('.budget-chart .recharts-bar-rectangle').count(), 5);
  await assertNoVisibleTextBelow12px(mobile.page, '.budget-screen', 'Mobiles Budget');
  await mobile.page.screenshot({ path: '/tmp/finance-budget.png', fullPage: true });

  await mobile.page.getByRole('button', { name: 'Schulden', exact: true }).click();
  await mobile.page.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
  assertSharedFinanceRoles(overviewRoleGeometry, await financeRoleGeometry(mobile.page, '.debt-screen'), 'Schulden');
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
  await assertConcentric(mobile.page, '.creditors-section .data-list', '.creditors-section .data-list__item', 'Gläubigerliste');
  await assertChartsHaveLayout(mobile.page, 'Schulden');
  await assertReliefScaleContainsData(mobile.page);
  const debtAction = mobile.page.locator('.debt-progress .app-button');
  await debtAction.click();
  assert.match(await mobile.page.locator('.debt-progress').innerText(), /September 2033[\s\S]*0,00\s*€/);
  await assertConcentric(mobile.page, '.debt-progress', '.debt-milestones', 'Schuldenverlauf');
  await assertConcentric(mobile.page, '.milestone-flow', '.milestone-flow .milestone-row', 'Entlastungsstufen');
  await assertNoOverflow(mobile.page, 'Mobile Schuldenansicht');
  await assertNoVisibleTextBelow12px(mobile.page, '.debt-screen', 'Mobile Schuldenansicht');
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
  await mobile.page.getByRole('heading', { name: overviewHeading }).waitFor();
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
  const dialog = mobile.page.getByRole('dialog', { name: 'Informationen' });
  await dialog.waitFor();
  assert.equal(await mobile.page.getByLabel('Informationen schließen').evaluate((element) => element === document.activeElement), true);
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
    { width: 320, height: 720, name: '320x720' },
    { width: 360, height: 800, name: '360x800' },
    { width: 412, height: 915, name: '412x915' },
    { width: 768, height: 1024, name: '768x1024' },
    { width: 840, height: 1000, name: '840x1000' },
    { width: 1440, height: 1000, name: '1440x1000' },
  ]) {
    const test = await statePage('connected', viewport);
    await test.page.goto(baseUrl, { waitUntil: 'networkidle' });
    await test.page.getByRole('heading', { name: overviewHeading }).waitFor();
    await test.page.waitForTimeout(360);
    await assertGoogleSansFlex(test.page, `Light ${viewport.name}`);
    await assertRingCenterFits(test.page, '.overview-screen .circular-allocation', `Übersichtsring ${viewport.name}`);
    await assertNoOverflow(test.page, `Light Übersicht ${viewport.name}`);
    await assertNoVisibleTextBelow12px(test.page, '.overview-screen', `Light Übersicht ${viewport.name}`);
    await assertAdaptiveNavigation(test.page, viewport.width, `Light Übersicht ${viewport.name}`);
    await assertLastContentNotObscured(test.page, '.overview-screen', `Light Übersicht ${viewport.name}`);
    await test.page.screenshot({ path: `/tmp/finance-${viewport.name}.png`, fullPage: true });
    await test.page.screenshot({ path: `/tmp/finance-light-${viewport.name}-overview.png`, fullPage: true });
    if (viewport.width === 1440) {
      const appBounds = await bounds(test.page.locator('.app-content'));
      assert.equal(appBounds.width <= 1120, true);
      assert.equal(Math.abs(appBounds.left - (1440 - appBounds.width) / 2) < 2, true);
    }
    await test.page.getByRole('button', { name: 'Demnächst', exact: true }).click();
    await test.page.getByRole('heading', { name: 'Demnächst' }).waitFor();
    await test.page.waitForTimeout(100);
    await assertNoOverflow(test.page, `Light Demnächst ${viewport.name}`);
    await assertLastContentNotObscured(test.page, '.upcoming-screen', `Light Demnächst ${viewport.name}`);
    await test.page.getByRole('button', { name: 'Budget', exact: true }).click();
    await test.page.getByRole('heading', { name: 'Dein Budget' }).waitFor();
    await test.page.waitForTimeout(360);
    await assertRingCenterFits(test.page, '.budget-screen .circular-allocation', `Budgetring ${viewport.name}`);
    await assertNoOverflow(test.page, `Light Budget ${viewport.name}`);
    await assertLastContentNotObscured(test.page, '.budget-screen', `Light Budget ${viewport.name}`);
    await test.page.screenshot({ path: `/tmp/finance-light-${viewport.name}-budget.png`, fullPage: true });
    await test.page.getByRole('button', { name: 'Schulden', exact: true }).click();
    await test.page.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
    await test.page.locator('.debt-progress .app-button').click();
    await test.page.waitForTimeout(560);
    await assertNoOverflow(test.page, `Light Schulden ${viewport.name}`);
    await assertChartsHaveLayout(test.page, `Light Schulden ${viewport.name}`);
    await assertReliefScaleContainsData(test.page);
    await assertLastContentNotObscured(test.page, '.debt-screen', `Light Schulden ${viewport.name}`);
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
    await dark.page.getByRole('heading', { name: overviewHeading }).waitFor();
    await dark.page.waitForTimeout(360);
    const resolvedDarkTheme = await themeSnapshot(dark.page);
    assert.equal(resolvedDarkTheme.resolved, 'dark');
    assert.match(resolvedDarkTheme.page, /^#[\dA-F]{6}$/i);
    await assertGoogleSansFlex(dark.page, `Dark ${viewport.name}`);
    await assertRingCenterFits(dark.page, '.overview-screen .circular-allocation', `Dark Übersichtsring ${viewport.name}`);
    await assertNoOverflow(dark.page, `Dark Übersicht ${viewport.name}`);
    await assertConcentric(dark.page, '.overview-screen .financial-hero', '.overview-screen .allocation-legend__item', `Dark-Mode-Hero ${viewport.name}`);
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
    await dark.page.locator('.debt-progress .app-button').click();
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
  await reduced.getByRole('heading', { name: overviewHeading }).waitFor();
  const reducedScreen = reduced.locator('[data-destination="overview"]');
  assert.equal(await reducedScreen.getAttribute('data-entrance'), 'reduced');
  assert.equal(await reducedScreen.evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.animationName === 'screen-entrance').length), 0);
  const reducedStatusTrigger = reduced.locator('.overview-screen .circular-allocation__button');
  await reducedStatusTrigger.click();
  assert.equal(await reducedStatusTrigger.getAttribute('aria-pressed'), 'true');
  await reduced.getByRole('button', { name: 'Budget', exact: true }).click();
  assert.equal(await reduced.locator('[data-destination="budget"]').getAttribute('data-entrance'), 'reduced');
  assert.equal(await reduced.locator('.budget-chart').getAttribute('data-animation-active'), 'false');
  await reduced.getByRole('tab', { name: 'Notwendigkeit' }).click();
  assert.equal(await reduced.locator('.budget-chart .recharts-bar-rectangle').count(), 5);
  await reduced.screenshot({ path: '/tmp/finance-reduced-motion.png', fullPage: true });
  assert.deepEqual(reducedErrors, [], reducedErrors.join('\n'));
  await reducedContext.close();

  const forcedContext = await browser.newContext({
    colorScheme: 'light',
    forcedColors: 'active',
    locale: 'de-DE',
    serviceWorkers: 'block',
    viewport: { width: 412, height: 915 },
  });
  const forced = await forcedContext.newPage();
  const forcedErrors = collectErrors(forced);
  await installFinanceApiMocks(forced);
  await installPickerMock(forced);
  await forced.goto(baseUrl, { waitUntil: 'networkidle' });
  await forced.getByRole('heading', { name: overviewHeading }).waitFor();
  assert.equal(await forced.evaluate(() => matchMedia('(forced-colors: active)').matches), true, 'Forced Colors wurde nicht emuliert');
  assert.notEqual(await forced.locator('.financial-hero').evaluate((element) => getComputedStyle(element).borderStyle), 'none', 'Hero verliert in Forced Colors seine Begrenzung');
  await assertAdaptiveNavigation(forced, 412, 'Forced Colors Übersicht');
  await assertNoOverflow(forced, 'Forced Colors Übersicht');
  await assertNoVisibleTextBelow12px(forced, '.overview-screen', 'Forced Colors Übersicht');
  await forced.getByRole('button', { name: 'Budget', exact: true }).click();
  await forced.getByRole('heading', { name: 'Dein Budget' }).waitFor();
  await forced.getByRole('tab', { name: 'Notwendigkeit' }).press('End');
  await assertNoOverflow(forced, 'Forced Colors Budget');
  await forced.getByRole('button', { name: 'Schulden', exact: true }).click();
  await forced.getByRole('heading', { name: 'Dein Weg auf null' }).waitFor();
  await forced.locator('.debt-progress .app-button').click();
  await assertChartsHaveLayout(forced, 'Forced Colors Schulden');
  await assertNoOverflow(forced, 'Forced Colors Schulden');
  await forced.screenshot({ path: '/tmp/finance-forced-colors.png', fullPage: true });
  assert.deepEqual(forcedErrors, [], forcedErrors.join('\n'));
  await forcedContext.close();

  console.log('Browser-Smoke-Test bestanden: Zustände, gemeinsame Finanzrollen, adaptive Navigation, dynamische Charts, responsive Größen, Dark/Forced Colors, Fokus, Touch-Ziele und reduzierte Bewegung funktionieren mit gemockten Google-Endpunkten.');
} finally {
  await browser.close();
}
