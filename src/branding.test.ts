import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ACCURA_DARK_THEME_COLOR,
  ACCURA_DESCRIPTION,
  ACCURA_FULL_NAME,
  ACCURA_NAME,
  ACCURA_PAGE_TITLE,
  ACCURA_THEME_COLOR,
  accuraManifest,
} from './branding';
import { AccuraLogo } from './components/AccuraLogo';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const logoSource = readFileSync(new URL('../public/icons/accura-source.svg', import.meta.url), 'utf8');
const shellStyles = readFileSync(new URL('./styles/shell.css', import.meta.url), 'utf8');
const previewStyles = readFileSync(new URL('./styles/primitives.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('./design/tokens.css', import.meta.url), 'utf8');

function meta(attribute: 'name' | 'property', key: string) {
  return new RegExp(`<meta ${attribute}="${key}" content="([^"]+)"`).exec(indexHtml)?.[1];
}

function pngDimensions(relativePath: string) {
  const fileUrl = new URL(`../public${relativePath}`, import.meta.url);
  const png = readFileSync(fileUrl);
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('accura branding contracts', () => {
  it('defines the intended manifest and purpose-specific icon mapping', () => {
    expect(accuraManifest).toMatchObject({
      name: ACCURA_FULL_NAME,
      short_name: ACCURA_NAME,
      lang: 'de-DE',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait-primary',
      theme_color: ACCURA_THEME_COLOR,
      background_color: ACCURA_THEME_COLOR,
    });
    expect(accuraManifest.icons).toEqual([
      { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/pwa-monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
    ]);

    for (const icon of accuraManifest.icons) {
      expect(existsSync(new URL(`../public${icon.src}`, import.meta.url))).toBe(true);
      const size = Number.parseInt(icon.sizes, 10);
      expect(pngDimensions(icon.src)).toEqual({ width: size, height: size });
    }
    expect(accuraManifest.icons.filter(({ purpose }) => purpose === 'maskable')).toHaveLength(1);
    expect(accuraManifest.icons.filter(({ purpose }) => purpose === 'monochrome')).toHaveLength(1);
    expect(tokens).toContain(`--color-page: ${ACCURA_THEME_COLOR}`);
    expect(tokens).toContain(`--color-page: ${ACCURA_DARK_THEME_COLOR}`);
  });

  it('exposes complete app, social, theme and icon metadata without invented public URLs', () => {
    expect(indexHtml).toContain(`<html lang="de-DE">`);
    expect(indexHtml).toContain(`<title>${ACCURA_PAGE_TITLE}</title>`);
    expect(meta('name', 'description')).toBe(ACCURA_DESCRIPTION);
    expect(meta('name', 'application-name')).toBe(ACCURA_NAME);
    expect(meta('name', 'apple-mobile-web-app-title')).toBe(ACCURA_NAME);
    expect(meta('name', 'mobile-web-app-capable')).toBe('yes');
    expect(meta('property', 'og:site_name')).toBe(ACCURA_NAME);
    expect(meta('property', 'og:title')).toBe(ACCURA_PAGE_TITLE);
    expect(meta('property', 'og:description')).toBe(ACCURA_DESCRIPTION);
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:image')).toBe('/icons/pwa-512.png');
    expect(meta('name', 'twitter:title')).toBe(ACCURA_PAGE_TITLE);
    expect(meta('name', 'twitter:description')).toBe(ACCURA_DESCRIPTION);
    expect(meta('name', 'twitter:image')).toBe('/icons/pwa-512.png');
    expect(indexHtml).toContain('rel="icon" type="image/svg+xml" href="/icons/favicon.svg"');
    expect(indexHtml).toContain('rel="apple-touch-icon" sizes="192x192" href="/icons/pwa-192.png"');
    expect(indexHtml).not.toMatch(/rel="canonical"|property="og:url"/);
  });

  it('uses the unchanged source geometry through a reusable, currentColor logo', () => {
    const markup = renderToStaticMarkup(createElement(AccuraLogo, { className: 'test-logo', style: { color: '#123456' } }));
    expect(markup).toContain('viewBox="0 0 327 248"');
    expect(markup).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(markup).toContain('href="/icons/accura-source.svg#accura-mark"');
    expect(markup).toContain('color:#123456');
    expect(logoSource).toContain('id="accura-mark"');
    expect(logoSource).toContain('fill="currentColor"');
    expect(logoSource).not.toMatch(/fill="(?:black|#[0-9a-f]{3,8})"/i);
    expect(shellStyles).toMatch(/\.brand-mark\s*{[^}]*color:\s*var\(--color-system-accent\)/s);
    expect(previewStyles).toMatch(/\.appearance-preview__logo\s*{[^}]*color:\s*var\(--color-primary\)/s);
    expect(`${shellStyles}\n${previewStyles}`).not.toMatch(/(?:\.brand-mark|\.appearance-preview__logo)\s*{[^}]*(?:background|filter):/s);
  });
});
