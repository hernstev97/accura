import type { ManifestOptions } from 'vite-plugin-pwa';

export const ACCURA_NAME = 'accura';
export const ACCURA_FULL_NAME = 'accura – Finanzüberblick';
export const ACCURA_PAGE_TITLE = 'accura – Dein persönlicher Finanzüberblick';
export const ACCURA_DESCRIPTION = 'accura bündelt Einnahmen, Ausgaben, Budgets, Ersparnisse und Schulden in einem klaren persönlichen Finanzüberblick.';
export const ACCURA_MANIFEST_DESCRIPTION = 'Persönlicher Überblick über Einnahmen, Ausgaben, Budgets, Ersparnisse und Schulden.';
export const ACCURA_THEME_COLOR = '#f7f9fe';
export const ACCURA_DARK_THEME_COLOR = '#111418';

export const accuraManifest = {
  name: ACCURA_FULL_NAME,
  short_name: ACCURA_NAME,
  description: ACCURA_MANIFEST_DESCRIPTION,
  lang: 'de-DE',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait-primary',
  background_color: ACCURA_THEME_COLOR,
  theme_color: ACCURA_THEME_COLOR,
  categories: ['finance', 'productivity'],
  icons: [
    { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/pwa-monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
  ],
} satisfies Partial<ManifestOptions>;
