import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  rewrites: Array<{ source: string; destination: string }>;
};

const rewriteToShell = new RegExp(`^${vercelConfig.rewrites[0]?.source}$`);

describe('SPA deep-link rewrite', () => {
  it('sends extensionless app and unknown paths to the shell', () => {
    expect(vercelConfig.rewrites).toEqual([
      {
        source: '/((?!api(?:/|$)|src(?:/|$)|@|node_modules(?:/|$)|.*\\.[^/]+$).*)',
        destination: '/index.html',
      },
    ]);
    expect(rewriteToShell.test('/budget')).toBe(true);
    expect(rewriteToShell.test('/demnaechst')).toBe(true);
    expect(rewriteToShell.test('/schulden')).toBe(true);
    expect(rewriteToShell.test('/unbekannt')).toBe(true);
  });

  it('does not intercept API, Vite modules, or files with an extension', () => {
    expect(rewriteToShell.test('/api')).toBe(false);
    expect(rewriteToShell.test('/api/finance')).toBe(false);
    expect(rewriteToShell.test('/src/main.tsx')).toBe(false);
    expect(rewriteToShell.test('/@vite/client')).toBe(false);
    expect(rewriteToShell.test('/@react-refresh')).toBe(false);
    expect(rewriteToShell.test('/node_modules/vite/dist/client/env.mjs')).toBe(false);
    expect(rewriteToShell.test('/icons/pwa-192.png')).toBe(false);
    expect(rewriteToShell.test('/dev-sw.js')).toBe(false);
    expect(rewriteToShell.test('/THIRD_PARTY_NOTICES.txt')).toBe(false);
  });
});
