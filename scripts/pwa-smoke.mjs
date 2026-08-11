import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const distRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const installColor = '#455e91';
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};
let serviceWorkerGeneration = 1;

function serviceWorkerProbe(generation) {
  return `\n;self.__ACCURA_SMOKE_GENERATION=${generation};self.addEventListener('message',(event)=>{if(event.data?.type==='ACCURA_GET_SMOKE_GENERATION'&&event.ports?.[0])event.ports[0].postMessage(${generation})});\n`;
}

async function serveStatic(response, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  let filePath = join(distRoot, relativePath);
  if (!filePath.startsWith(distRoot)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
  } catch {
    filePath = join(distRoot, 'index.html');
  }
  let body = await readFile(filePath);
  if (filePath.endsWith('/sw.js')) body = Buffer.concat([body, Buffer.from(serviceWorkerProbe(serviceWorkerGeneration))]);
  response.writeHead(200, {
    'Cache-Control': filePath.endsWith('/sw.js') ? 'no-cache, no-store, must-revalidate' : 'public, max-age=0',
    'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
  });
  response.end(body);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/api/session') {
    response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ authenticated: false }));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    response.writeHead(404, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: { code: 'not_found' } }));
    return;
  }
  void serveStatic(response, url.pathname).catch((error) => {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : String(error));
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });

function contrast(first, second) {
  const luminance = (rgb) => {
    const channels = rgb.map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function inspectIcon(page, src) {
  return page.evaluate(async (iconSrc) => {
    const image = new Image();
    image.src = iconSrc;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas context unavailable');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const opaqueColors = new Set();
    let transparentPixels = 0;
    let opaquePixels = 0;
    let foregroundPixels = 0;
    let maxForegroundRadius = 0;
    const centerX = (canvas.width - 1) / 2;
    const centerY = (canvas.height - 1) / 2;
    for (let offset = 0; offset < data.length; offset += 4) {
      const pixel = offset / 4;
      const alpha = data[offset + 3];
      if (alpha === 0) transparentPixels += 1;
      if (alpha === 255) {
        opaquePixels += 1;
        opaqueColors.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`);
      }
      const isInstallBackground = data[offset] === 69 && data[offset + 1] === 94 && data[offset + 2] === 145;
      if (alpha > 0 && !isInstallBackground) {
        foregroundPixels += 1;
        const x = pixel % canvas.width;
        const y = Math.floor(pixel / canvas.width);
        maxForegroundRadius = Math.max(maxForegroundRadius, Math.hypot(x - centerX, y - centerY));
      }
    }
    return {
      foregroundPixels,
      height: canvas.height,
      maxForegroundRadius,
      opaqueColors: [...opaqueColors],
      opaquePixels,
      totalPixels: canvas.width * canvas.height,
      transparentPixels,
      width: canvas.width,
    };
  }, src);
}

async function controllerGeneration(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return reject(new Error('No controlling service worker'));
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => reject(new Error('Service worker generation probe timed out')), 5_000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      resolve(event.data);
    };
    controller.postMessage({ type: 'ACCURA_GET_SMOKE_GENERATION' }, [channel.port2]);
  }));
}

async function assertTheme(base, colorScheme, expectedMode) {
  const context = await browser.newContext({ colorScheme, locale: 'de-DE', serviceWorkers: 'allow' });
  const page = await context.newPage();
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();
    const theme = await page.evaluate(() => ({
      active: document.querySelector('meta[data-appearance-theme-color]')?.getAttribute('content'),
      page: getComputedStyle(document.documentElement).getPropertyValue('--color-page').trim(),
      resolved: document.documentElement.dataset.themeResolved,
    }));
    assert.equal(theme.resolved, expectedMode);
    assert.equal(theme.active?.toUpperCase(), theme.page.toUpperCase(), `${colorScheme}: aktives theme-color folgt nicht der Page-Farbe`);
  } finally {
    await context.close();
  }
}

const context = await browser.newContext({ colorScheme: 'light', locale: 'de-DE', serviceWorkers: 'allow', viewport: { width: 412, height: 915 } });
const page = await context.newPage();
page.setDefaultNavigationTimeout(15_000);
page.setDefaultTimeout(15_000);
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`Konsole: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`Laufzeit: ${error.message}`));

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();

  const manifestResponse = await context.request.get(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifestResponse.ok(), true, 'Manifest konnte nicht geladen werden');
  assert.match(manifestResponse.headers()['content-type'] ?? '', /^application\/manifest\+json/);
  const manifest = await manifestResponse.json();
  assert.deepEqual({
    background_color: manifest.background_color,
    display: manifest.display,
    id: manifest.id,
    scope: manifest.scope,
    start_url: manifest.start_url,
    theme_color: manifest.theme_color,
  }, {
    background_color: installColor,
    display: 'standalone',
    id: '/',
    scope: '/',
    start_url: '/',
    theme_color: installColor,
  });
  assert.deepEqual(manifest.icons.map(({ purpose, sizes, src, type }) => ({ purpose, sizes, src, type })), [
    { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/pwa-monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
  ]);
  for (const icon of manifest.icons) {
    const response = await context.request.get(new URL(icon.src, baseUrl).href);
    assert.equal(response.ok(), true, `${icon.src} konnte nicht geladen werden`);
    assert.match(response.headers()['content-type'] ?? '', /^image\/png/);
  }

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  if (!await page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).isVisible().catch(() => false)) {
    throw new Error(`App failed after service-worker control. URL=${page.url()} errors=${errors.join(' | ')} body=${(await page.locator('body').innerText()).slice(0, 500)}`);
  }
  await page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  assert.equal(await controllerGeneration(page), 1);

  const cdp = await context.newCDPSession(page);
  const [{ errors: manifestErrors }, { installabilityErrors }] = await Promise.all([
    cdp.send('Page.getAppManifest'),
    cdp.send('Page.getInstallabilityErrors'),
  ]);
  assert.deepEqual(manifestErrors, [], `Manifestfehler: ${JSON.stringify(manifestErrors)}`);
  assert.deepEqual(installabilityErrors, [], `Installierbarkeitsfehler: ${JSON.stringify(installabilityErrors)}`);

  const maskable = await inspectIcon(page, '/icons/pwa-maskable-512.png');
  assert.deepEqual({ width: maskable.width, height: maskable.height }, { width: 512, height: 512 });
  assert.equal(maskable.opaquePixels, maskable.totalPixels, 'Maskable-Icon ist nicht vollständig opak');
  assert.ok(maskable.foregroundPixels > maskable.totalPixels * 0.15, 'Maskable-Logo besitzt zu wenig sichtbare Fläche');
  assert.ok(maskable.maxForegroundRadius <= maskable.width * 0.405, `Maskable-Logo verlässt die Safe-Zone: ${maskable.maxForegroundRadius}`);
  assert.ok(contrast([255, 255, 255], [69, 94, 145]) >= 4.5, 'Logo und Installationsfarbe unterschreiten WCAG-AA-Kontrast');

  const monochrome = await inspectIcon(page, '/icons/pwa-monochrome-512.png');
  assert.deepEqual({ width: monochrome.width, height: monochrome.height }, { width: 512, height: 512 });
  assert.ok(monochrome.transparentPixels > 0, 'Monochrome-Icon besitzt keinen transparenten Hintergrund');
  assert.deepEqual(monochrome.opaqueColors, ['0,0,0'], 'Monochrome-Icon enthält mehr als eine tintbare Vordergrundfarbe');

  const standard = await inspectIcon(page, '/icons/pwa-512.png');
  assert.deepEqual({ width: standard.width, height: standard.height }, { width: 512, height: 512 });
  assert.ok(standard.transparentPixels > 0 && standard.opaquePixels > standard.totalPixels * 0.8, 'Standard-Icon trennt Markenfläche und Launcher-Hintergrund nicht robust');
  assert.ok(standard.opaqueColors.includes('69,94,145') && standard.opaqueColors.includes('255,255,255'), 'Standard-Icon enthält Markenfläche oder Logo nicht');

  let mainNavigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) mainNavigations += 1;
  });
  serviceWorkerGeneration = 2;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  const notice = page.locator('.pwa-update-notice');
  await notice.getByText('Neue Version verfügbar').waitFor();
  assert.equal(await notice.getByText('accura wurde aktualisiert. Lade die App neu, um die neue Version zu verwenden.').isVisible(), true);
  assert.equal(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting)), true, 'Generation 2 wartet nicht auf die Nutzerentscheidung');
  await page.waitForTimeout(500);
  assert.equal(mainNavigations, 0, 'Die App lud vor der Nutzerentscheidung neu');

  const assertNoticeLayout = async (label) => {
    const result = await notice.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const buttons = [...element.querySelectorAll('button')].map((button) => {
        const rect = button.getBoundingClientRect();
        return { height: rect.height, width: rect.width };
      });
      return { bounds: { left: bounds.left, right: bounds.right, width: bounds.width }, buttons };
    });
    assert.ok(result.bounds.left >= 0 && result.bounds.right <= await page.evaluate(() => innerWidth), `${label}: Hinweis verlässt den Viewport`);
    assert.ok(result.bounds.width > 0, `${label}: Hinweis besitzt keine sichtbare Breite`);
    assert.ok(result.buttons.every(({ height, width }) => height >= 48 && width >= 48), `${label}: Aktion unterschreitet das Touch-Ziel`);
  };
  await assertNoticeLayout('412 Light');
  const updateAction = notice.getByRole('button', { name: 'Jetzt neu laden' });
  await updateAction.focus();
  const focusStyle = await updateAction.evaluate((button) => {
    const style = getComputedStyle(button);
    return { outlineColor: style.outlineColor, outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
  });
  assert.equal(await updateAction.evaluate((button) => button === document.activeElement), true, 'Update-Aktion erhält keinen Fokus');
  assert.equal(focusStyle.outlineStyle, 'solid', 'Update-Aktion besitzt keinen klaren Fokusrahmen');
  assert.ok(focusStyle.outlineWidth >= 3 && focusStyle.outlineColor !== 'rgba(0, 0, 0, 0)', 'Update-Fokusrahmen ist nicht ausreichend sichtbar');
  const lightNoticeBackground = await notice.locator('.inline-notice').evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.themeResolved === 'dark');
  await assertNoticeLayout('320 Dark');
  const darkNoticeBackground = await notice.locator('.inline-notice').evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.notEqual(darkNoticeBackground, lightNoticeBackground, 'Update-Hinweis reagiert visuell nicht auf Light/Dark');
  const darkTheme = await page.evaluate(() => ({
    active: document.querySelector('meta[data-appearance-theme-color]')?.getAttribute('content') ?? '',
    page: getComputedStyle(document.documentElement).getPropertyValue('--color-page').trim(),
  }));
  assert.equal(darkTheme.active.toUpperCase(), darkTheme.page.toUpperCase(), 'Update-Zustand verlor die Dark-Statusleistenfarbe');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  assert.deepEqual(axe.violations, [], `Update-Hinweis verletzt Axe-Regeln: ${JSON.stringify(axe.violations, null, 2)}`);

  await notice.getByRole('button', { name: 'Später' }).click();
  await notice.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting)), true, 'Später aktivierte den wartenden Worker');

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();
  await notice.getByText('Neue Version verfügbar').waitFor();
  const navigationsBeforeUpdate = mainNavigations;
  await notice.getByRole('button', { name: 'Jetzt neu laden' }).click();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null && !document.querySelector('.pwa-update-notice'));
  await page.getByRole('heading', { name: 'Mit deiner Tabelle verbinden' }).waitFor();
  assert.equal(mainNavigations, navigationsBeforeUpdate + 1, 'Aktivierung lud die App nicht genau einmal neu');
  assert.equal(await controllerGeneration(page), 2, 'Generation 2 kontrolliert die App nach der Aktualisierung nicht');
  assert.deepEqual(errors, [], errors.join('\n'));

  await assertTheme(baseUrl, 'light', 'light');
  await assertTheme(baseUrl, 'dark', 'dark');
  console.log('PWA-Smoke-Test bestanden: Manifest, Installierbarkeit, Icons, Light/Dark-Systemfarbe und kontrollierter Zwei-Versionen-Update-Flow sind gültig.');
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
