import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { accuraManifest } from './src/branding';
import { resolveMockApiEnabled } from './build/financeRuntimeMode';
import { resolveSourceInformation } from './build/sourceInformation';

export default defineConfig(({ command }) => {
  const source = resolveSourceInformation({ command });
  const mockApiEnabled = resolveMockApiEnabled({ command });

  return {
    define: {
      __ACCURA_MOCK_API_ENABLED__: JSON.stringify(mockApiEnabled),
      __ACCURA_SOURCE_COMMIT_SHA__: JSON.stringify(source.commitSha),
      __ACCURA_SOURCE_SHORT_SHA__: JSON.stringify(source.shortSha),
      __ACCURA_SOURCE_URL__: JSON.stringify(source.sourceUrl),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        manifest: accuraManifest,
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,txt,woff2}'],
          globIgnores: ['**/icons/pwa-*.png'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          runtimeCaching: [
            {
              urlPattern: ({ sameOrigin, url }) => sameOrigin && /^\/api(?:\/|$)/.test(url.pathname),
              handler: 'NetworkOnly',
            },
          ],
          clientsClaim: true,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}', 'build/**/*.test.ts'],
      server: {
        deps: {
          inline: ['@material/material-color-utilities'],
        },
      },
    },
  };
});
