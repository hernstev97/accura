# Finanzen

“Finanzen” is a mobile-first personal-finance PWA. Its Material Design 3 Expressive interface shows available money, accounts, pockets, monthly planning, and projected debt relief. Visible product copy remains German; light/dark mode, safe areas, reduced motion, responsive charts, keyboard behavior, and the centered Android-derived desktop composition are preserved.

Production contains no hardcoded personal finance fixture. One allowlisted user authenticates with Google, selects one native Google Sheet through Picker, and receives validated, normalized finance data through same-origin Vercel Functions.

## Architecture

```text
Google OAuth web-server flow (state + nonce + PKCE)
  → Google Picker (one Sheet, drive.file)
  → encrypted refresh token + selected Sheet in Postgres
  → server-only Drive validation and Sheets batchGet
  → Finance Data Schema v1 parser and integer-cent normalization
  → versioned FinanceDataV1
  → cent-based selectors and localized view model
  → React FinanceDataProvider
  → Overview / Budget / Debt screens
```

The browser never receives a refresh token, OAuth client secret, database URL, token-encryption key, or session secret. A short-lived access token is returned only to the authenticated Picker launch and is never persisted. The last valid normalized snapshot is cached in IndexedDB for offline startup.

Detailed design: [security and data flow](docs/security-and-data-flow.md).

Interface contracts: [motion, concentric shapes, circular allocation, and local Material You appearance](docs/design-system.md).

## Stack

- React 19 and TypeScript with Vite
- root `api/` Node.js Vercel Functions
- PostgreSQL via the maintained `postgres` client
- Zod runtime schemas
- JOSE ID-token verification
- Motion, Recharts, Material Web compatibility, official Material Color Utilities, centralized MD3 tokens
- `vite-plugin-pwa` service worker and IndexedDB last-good cache
- Vitest, ESLint, TypeScript project builds, and Playwright smoke tests

## Finance workbook

The selected spreadsheet must implement ten exact underscore-prefixed machine tabs. It stores source records and dated snapshots—not UI totals. Money is normalized to integer cents before calculations, while installment counts remain separate integers; active records use their latest snapshot on or before `_Meta.as_of`.

Complete contract and anonymous examples: [Finance Data Schema v1](docs/finance-data-schema-v1.md).

## Environment and external setup

Copy `.env.example` and provide all server variables through local/Vercel secret storage. Never add secrets to `VITE_` variables or tracked env files.

The required owner actions include Google APIs, External OAuth consent, exact origins/callbacks, restricted Picker key, Postgres provisioning/migration, and Vercel variables:

- concise checklist: [USER_SETUP.md](USER_SETUP.md)
- exact walkthrough and troubleshooting: [Google OAuth/Vercel setup](docs/google-oauth-vercel-setup.md)

## Local development

Requirements: Node.js 20.19+ (current LTS recommended), npm, and Vercel CLI access for the real server flow.

```bash
npm install
npx vercel link
npx vercel env pull .env.local --environment=development
npx vercel dev --listen 3000
```

Open `http://localhost:3000`. Plain `npm run dev` starts only Vite and therefore does not provide the `api/` Functions.

### Anonymous mocked development

For UI work with no Google/Postgres credentials:

```bash
npm run dev:mock
```

This mode is gated to Vite development, uses only anonymous data under `src/mocks`, and stubs Picker selection. It is not a substitute for the real local `vercel dev` flow.

## Verification

```bash
npm test
npm run lint
npm run build
```

Browser tests mock Google and require no credentials. With a preview server running:

```bash
# terminal 1
npm run preview

# terminal 2
SMOKE_URL=http://127.0.0.1:4173 npm run smoke:browser
SMOKE_URL=http://127.0.0.1:4173 npm run smoke:offline
npm run smoke:auth-sw
```

The suites cover all schema tabs and failures, cent conversion, latest snapshots, selectors, encryption, allowlisting, OAuth state/CSRF, revoked grants, mocked Picker/Sheets, provider last-good retention, signed-out/setup/loading/stale/offline/validation/reconnect UI states, responsive layouts, dark mode, reduced motion, focus, touch targets, console/runtime errors, charts, overflow, IndexedDB, and service-worker offline reload.

They also cover the complete Appearance flow: browser-accent fallback, curated Material You presets, explicit/system light-dark resolution, local image quantization, five-to-seven palette candidates, thumbnail persistence/removal, reload and offline restoration, stacked-modal keyboard behavior, and stable financial semantic colors.

## Connection lifecycle

1. Sign in with the email configured in `ALLOWED_GOOGLE_EMAIL`.
2. Choose **Google-Tabelle auswählen**; Picker shows Sheets only and permits one selection.
3. The server validates Drive access/MIME and every schema rule before saving the selection.
4. Data refreshes on startup, after selection, manually, on connectivity return, and when returning to the foreground after ten minutes. There is no cron or polling.
5. Invalid or failed refreshes retain the visibly stale last-known-good snapshot.
6. **Abmelden** clears only the app session. **Google-Verbindung trennen** attempts Google revocation, deletes the Postgres connection, clears the session, and removes IndexedDB finance data on that device.

## PWA installation

Build and host over HTTPS, open the production URL in Chrome on Android, and select **App installieren** / **Zum Startbildschirm hinzufügen**. The application shell and a previously synchronized last-good snapshot remain usable offline. See the local-data caveat in [security and data flow](docs/security-and-data-flow.md#indexeddb-and-offline-implications).

## Local appearance data

System colors exposed to a web page are only a browser hint and are not reliable Android-wallpaper detection. The **Bild** source therefore analyzes only a JPG, PNG, or WebP that the user deliberately selects. All palette extraction stays in the browser; the original image is never uploaded or permanently stored. At most one reduced WebP preview is kept in the local `finance-appearance-v1` IndexedDB database. Applying System/Andere Farben, removing the image, or resetting appearance removes that preview. The complete generated light/dark token pair is small, versioned device-local data in `localStorage` and is intentionally independent of Google sign-out/disconnect.
